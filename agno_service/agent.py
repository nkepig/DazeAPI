import os
from pathlib import Path
from urllib.parse import urlparse

from agno.agent import Agent
from agno.db.in_memory import InMemoryDb
from agno.models.openai import OpenAILike
from agno.tools.file import FileTools
from agno.tools.postgres import PostgresTools

SYSTEM_PROMPT = """
You are Clawd, a crab mascot in the API AGGREGATION PLATFORM admin dashboard. You help the admin investigate channel health, user quota, request logs, and service errors.

Workflow:
1. Analyze the request. Decide: database query, log reading, or both.
2. If database: use SQL tools (show_tables, describe_table, run_query).
3. If logs: list_files first, then read_file/search_files by name match.
4. Quote relevant lines or rows. Summarize findings. Never dump whole files or tables.

Rules:
- Friendly, concise, to the point. No emojis, no crab icons.
- Beijing Time (UTC+8). Quota: `Quota / 500000` USD.
- SQL: SELECT only. No DROP/DELETE/UPDATE/INSERT/ALTER. Prefer JOINs, LIMIT 50, ORDER BY.
- Output: markdown tables, narrow columns.
- If unclear, ask 1-3 clarification questions first.
- Defaults: last 24h, hourly grouping, top 10 rankings.
"""


_global_db = InMemoryDb()

LOG_DIR = os.environ.get("CLAWD_LOG_DIR", "/data/log")


def _parse_pg_url(url: str) -> dict:
    p = urlparse(url)
    return {
        "host": p.hostname,
        "port": p.port or 5432,
        "user": p.username,
        "password": p.password or "",
        "db_name": p.path.lstrip("/"),
    }


def build_agent(
    *,
    base_url: str,
    api_key: str,
    model: str,
    session_id: str,
    user_id: str,
) -> Agent:
    sql_dsn = os.environ["SQL_DSN"]
    pg = _parse_pg_url(sql_dsn)

    tools = [PostgresTools(**pg)]

    try:
        tools.append(
            FileTools(
                base_dir=Path(LOG_DIR),
                enable_read_file=True,
                enable_list_files=True,
                enable_search_files=True,
                exclude_tools=[
                    "save_file",
                    "replace_file_chunk",
                ],
            )
        )
    except Exception:
        pass

    return Agent(
        model=OpenAILike(
            id=model,
            api_key=api_key,
            base_url=base_url,
        ),
        instructions=SYSTEM_PROMPT,
        tools=tools,
        db=_global_db,
        session_id=session_id,
        user_id=user_id,
        add_history_to_context=True,
        num_history_runs=5,
        markdown=True,
        retries=2,
    )
