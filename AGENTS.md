# AGENTS.md — new-api knowledge base

## Overview

AI gateway/proxy in Go. Unified surface over 40+ upstream providers, with admin dashboard, billing, rate limiting, OAuth/passkeys, and Electron packaging.

Primary stack:
- Backend: Go, Gin, GORM
- Frontend: React 18, Vite, Semi UI
- Data: SQLite + MySQL + PostgreSQL, Redis
- Frontend package manager: Bun

## Structure

```text
.
├── main.go              # server bootstrap; embeds web/dist
├── router/              # route assembly only
├── controller/          # HTTP handlers
├── service/             # business logic, billing, quota, settlement
├── model/               # GORM models, DB helpers, migrations
├── relay/               # upstream/provider relay layer
├── setting/             # persisted runtime configuration
├── common/              # cross-cutting helpers
├── dto/                 # request/response contracts
├── middleware/          # auth, rate limit, logging, distribution
├── web/                 # React app; Bun/Vite build
└── electron/            # desktop wrapper around backend + web build
```

Child guidance lives in:
- `relay/AGENTS.md`
- `setting/AGENTS.md`
- `web/src/AGENTS.md`

## Where to look

| Task | Location | Notes |
|---|---|---|
| Server bootstrap | `main.go` | embeds `web/dist`, initializes DB/cache/i18n/router |
| Route boundaries | `router/main.go` | API, dashboard, relay, video, web split |
| Provider registry | `relay/relay_adaptor.go` | API type -> adaptor / task adaptor |
| Task submit flow | `relay/relay_task.go` | pricing, preconsume, upstream submit, settle hooks |
| Settings persistence | `setting/config/config.go` | module registration, DB load/save, JSON key mapping |
| Admin settings UI | `web/src/pages/Setting/index.jsx` | top-level settings sections |
| Frontend bootstrap | `web/src/index.jsx` | providers, router, i18n, Semi locale |
| Frontend route map | `web/src/App.jsx` | lazy pages + auth guards |
| Shared API client | `web/src/helpers/api.js` | axios instance, auth headers, duplicate-GET suppression |
| Billing/settlement tests | `service/task_billing_test.go` | in-memory SQLite harness, quota/refund assertions |
| Release/build flow | `.github/workflows/`, `Dockerfile`, `makefile` | Bun + Go + Electron + Docker |

## Conventions

### Backend
- Layering stays `Router -> Controller -> Service -> Model`.
- Business-code JSON goes through `common/json.go` wrappers, not direct `encoding/json` calls.
- DB changes must work on SQLite, MySQL, and PostgreSQL together.
- Optional upstream request scalars use pointer fields with `omitempty`; explicit zero/false must survive re-marshal.
- `constant/` is constants-only: no project-local imports, no business logic, update `constant/README.md` when adding files.

### Frontend
- Use Bun in `web/`.
- `web/vite.config.js` treats `src/**/*.js` as JSX; do not assume only `.jsx` renders JSX.
- `@` aliases to `web/src`.
- `web/.eslintrc.cjs` enforces the AGPL/commercial-license header on `js`/`jsx` files.
- Frontend i18n keys are Chinese source strings in `web/src/i18n/locales/*.json`.

### Release / packaging
- `make all` builds frontend first, then runs backend.
- Docker build is multi-stage: Bun frontend -> Go backend -> slim Debian runtime.
- GitHub Actions releases Linux/macOS/Windows binaries; Docker workflows publish multi-arch images.

## Anti-patterns

- Do not remove or rename protected `new-api` / `QuantumNous` identifiers in code, docs, metadata, or packaging.
- Do not use the no-CAS task bulk-update path in billing/quota lifecycle transitions; see warning in `model/task.go`.
- Do not let task metadata overwrite `model`; `relay/channel/task/taskcommon/helpers.go` strips it to prevent billing bypass.

## Commands

```bash
make all
go test ./...
cd web && bun install
cd web && bun run build
docker compose up -d
```

## Notes

- `main.go` serves embedded frontend assets unless `FRONTEND_BASE_URL` redirects web routes externally.
- `docker-compose.yml` defaults to PostgreSQL + Redis; MySQL remains a commented alternative.
- `electron/` is a packaging target, not the source of truth for product logic.
