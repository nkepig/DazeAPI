# AGENTS.md — web/src

## Overview

React application source. Owns dashboard/admin UI, routing, providers, hooks, shared API client, and frontend i18n.

## Structure

```text
web/src/
├── index.jsx            # providers, router, i18n, Semi locale bootstrap
├── App.jsx              # route table + auth guards
├── pages/               # page-level composition
├── components/          # reusable UI blocks, tables, modals, layout
├── hooks/               # domain hooks by feature
├── helpers/             # API client, auth, formatting, utils
├── context/             # User / Status providers
└── i18n/                # locale wiring and language helpers
```

## Where to look

| Task | Location | Notes |
|---|---|---|
| Add route/page | `App.jsx`, `pages/` | routes are lazy-loaded and guard-wrapped |
| Change app bootstrap | `index.jsx` | `StatusProvider`, `UserProvider`, router, locale wrapper |
| Settings UI | `pages/Setting/index.jsx`, `components/settings/` | section-based admin UI |
| Channel admin UI | `components/table/channels/`, `hooks/channels/` | largest table/modal domain |
| Shared API behavior | `helpers/api.js` | auth header injection + duplicate GET suppression |
| i18n behavior | `i18n/`, `index.jsx` | i18next + Semi locale sync |

## Conventions

- Use Bun scripts from `web/package.json`.
- `src/**/*.js` is compiled as JSX; keep syntax/tooling compatible.
- Reuse `helpers/api.js` instead of ad-hoc axios instances when auth/error handling should stay consistent.
- Route/page composition lives in `pages/`; data/state-heavy logic belongs in `hooks/`; reusable surface area belongs in `components/`.
- UI text goes through `t(...)`; locale files use Chinese source-string keys.
- Keep required AGPL/commercial-license header on `js`/`jsx` files.

## Anti-patterns

- Do not hardcode locale-specific copy without `t(...)`.
- Do not bypass the shared API client if you still need auth headers, duplicate-request suppression, or common error handling.
- Do not add new channels against the deprecated Doubao Coding Plan base URL kept for legacy edits in channel modals.
