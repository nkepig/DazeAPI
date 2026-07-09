FROM docker.1ms.run/python:3.12-slim

WORKDIR /app

ENV UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

COPY --from=ghcr.nju.edu.cn/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev || uv sync --no-dev

COPY . .

EXPOSE 6000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "6000"]
