# 多阶段构建：前端 (Bun) + 后端 (Go)，用于本地/生产镜像
# 构建：docker compose build   或   docker build -t dazeapi:local .
# 基础镜像走 docker.1ms.run 国内镜像；GOPROXY 默认 goproxy.cn。
# 如需走官方源：docker build --build-arg GOPROXY=https://proxy.golang.org,direct .

FROM docker.1ms.run/oven/bun:1 AS frontend

WORKDIR /build
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
COPY ./web .
COPY ./VERSION .
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) bun run build

FROM docker.1ms.run/golang:1.26.1-alpine AS backend

ENV GO111MODULE=on CGO_ENABLED=0

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

# 可通过 compose build.args 或 docker build --build-arg 覆盖（见 docker-compose.yml 注释）
ARG GOPROXY=https://goproxy.cn,direct
ARG GOSUMDB=sum.golang.org
ENV GOPROXY=${GOPROXY} GOSUMDB=${GOSUMDB}

WORKDIR /build

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
COPY --from=frontend /build/dist ./web/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$(cat VERSION)'" -o new-api

FROM docker.1ms.run/debian:bookworm-slim

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
    && update-ca-certificates

COPY --from=backend /build/new-api /new-api

EXPOSE 3000
WORKDIR /data

# 与 docker-compose 中 healthcheck 一致；单独 docker run 时也可生效
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -q -O - http://127.0.0.1:3000/api/status | grep -oE '"success"[[:space:]]*:[[:space:]]*true' || exit 1

ENTRYPOINT ["/new-api"]
