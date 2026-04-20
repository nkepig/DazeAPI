# 多阶段构建：前端 (Bun) + 后端 (Go)，用于本地/生产镜像
# 构建：docker compose build   或   docker build -t dazeapi:local .
# 国内若拉模块慢，可：docker compose build --build-arg GOPROXY=https://goproxy.cn,direct

FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS frontend

WORKDIR /build
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
COPY ./web .
COPY ./VERSION .
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) bun run build

FROM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS backend

ENV GO111MODULE=on CGO_ENABLED=0

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

# 可通过 compose build.args 或 docker build --build-arg 覆盖（见 docker-compose.yml 注释）
ARG GOPROXY=https://proxy.golang.org,direct
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

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=backend /build/new-api /new-api

EXPOSE 3000
WORKDIR /data

# 与 docker-compose 中 healthcheck 一致；单独 docker run 时也可生效
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -q -O - http://127.0.0.1:3000/api/status | grep -oE '"success"[[:space:]]*:[[:space:]]*true' || exit 1

ENTRYPOINT ["/new-api"]
