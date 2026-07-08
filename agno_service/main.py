import json
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agno.agent import RunEvent

from agent import build_agent

logger = logging.getLogger("clawd_sidecar")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="Clawd Agent Sidecar")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str
    user_id: str = "anonymous"
    base_url: str
    api_key: str
    model: str
    lang: str = "zh"


class ChatResponse(BaseModel):
    content: str
    session_id: str


@app.get("/health")
def health():
    return {"status": "ok"}


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _safe_str(val, max_len=2000) -> str:
    if val is None:
        return ""
    s = str(val)
    return s if len(s) <= max_len else s[:max_len] + "...(truncated)"


@app.post("/chat")
async def chat(req: ChatRequest, request: Request):
    try:
        agent = build_agent(
            base_url=req.base_url,
            api_key=req.api_key,
            model=req.model,
            session_id=req.session_id,
            user_id=req.user_id,
        )
        response = await agent.arun(req.message, session_id=req.session_id)
        content = response.content if hasattr(response, "content") else str(response)
        return ChatResponse(content=content, session_id=req.session_id)
    except Exception as e:
        logger.exception("agent run failed")
        return ChatResponse(content=f"出错了：{e}", session_id=req.session_id)


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, request: Request):
    """SSE streaming chat endpoint."""
    async def _stream():
        try:
            agent = build_agent(
                base_url=req.base_url,
                api_key=req.api_key,
                model=req.model,
                session_id=req.session_id,
                user_id=req.user_id,
            )

            started_emitted = False
            async for chunk in agent.arun(
                req.message,
                session_id=req.session_id,
                stream=True,
                stream_events=True,
            ):
                if await request.is_disconnected():
                    break

                event = chunk.event

                # Lifecycle
                if event == RunEvent.run_started:
                    if not started_emitted:
                        yield _sse({"type": "started"})
                        started_emitted = True
                elif event == RunEvent.run_completed:
                    yield _sse({"type": "completed"})
                elif event == RunEvent.run_cancelled:
                    yield _sse({"type": "cancelled"})
                elif event == RunEvent.run_error:
                    yield _sse({
                        "type": "error",
                        "content": _safe_str(chunk.content, 4000),
                    })

                # Content — skip empty pieces to avoid flooding SSE pipe
                elif event == RunEvent.run_content:
                    piece = chunk.content or ""
                    if not piece:
                        continue
                    logger.debug("run_content chunk len=%d", len(piece))
                    yield _sse({"type": "content", "content": piece})

                # Reasoning
                elif event == RunEvent.reasoning_started:
                    yield _sse({"type": "reasoning", "subtype": "started"})
                elif event == RunEvent.reasoning_step:
                    rc = getattr(chunk, "reasoning_content", "") or ""
                    if rc:
                        yield _sse({"type": "reasoning", "subtype": "step", "content": rc})
                elif event == RunEvent.reasoning_content_delta:
                    rc = getattr(chunk, "reasoning_content", "") or ""
                    if rc:
                        yield _sse({"type": "reasoning", "subtype": "delta", "content": rc})
                elif event == RunEvent.reasoning_completed:
                    yield _sse({"type": "reasoning", "subtype": "completed"})

                # Tool calls
                elif event == RunEvent.tool_call_started:
                    tool = getattr(chunk, "tool", None)
                    yield _sse({
                        "type": "tool_call",
                        "subtype": "started",
                        "tool_name": getattr(tool, "tool_name", "") if tool else "",
                        "tool_args": _safe_str(getattr(tool, "tool_args", ""), 1000) if tool else "",
                    })
                elif event == RunEvent.tool_call_completed:
                    tool = getattr(chunk, "tool", None)
                    yield _sse({
                        "type": "tool_call",
                        "subtype": "completed",
                        "tool_name": getattr(tool, "tool_name", "") if tool else "",
                        "result": _safe_str(getattr(tool, "result", ""), 2000) if tool else "",
                    })
                elif event == RunEvent.tool_call_error:
                    tool = getattr(chunk, "tool", None)
                    yield _sse({
                        "type": "tool_call",
                        "subtype": "error",
                        "tool_name": getattr(tool, "tool_name", "") if tool else "",
                        "error": _safe_str(getattr(tool, "tool_call_error", ""), 1000) if tool else _safe_str(getattr(chunk, "error", "")),
                    })

                # Memory
                elif event == RunEvent.memory_update_started:
                    yield _sse({"type": "memory", "subtype": "started"})
                elif event == RunEvent.memory_update_completed:
                    yield _sse({"type": "memory", "subtype": "completed"})

            yield _sse({"type": "done"})

        except Exception as e:
            logger.exception("agent stream failed")
            yield _sse({"type": "error", "content": f"出错了：{e}"})
            yield _sse({"type": "done"})

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )