# AGENTS.md — setting

## Overview

Runtime configuration domain. Persists admin-controlled settings, ratios, pricing, performance toggles, system URLs, and provider policies.

## Structure

```text
setting/
├── config/              # registry + DB load/save bridge
├── model_setting/       # model/provider behavior toggles
├── operation_setting/   # admin/runtime ops defaults and guards
├── performance_setting/ # performance-related config
├── pricing/             # pricing data + defaults
├── ratio_setting/       # group/model/cache ratios
└── system_setting/      # server address, OAuth/legal/fetch switches
```

## Where to look

| Task | Location | Notes |
|---|---|---|
| Add persisted module | `setting/config/config.go` + module `init()` | unregistered modules never round-trip to DB |
| Global model policy | `setting/model_setting/global.go` | passthrough, thinking blacklist, responses policy |
| Operational defaults | `setting/operation_setting/` | disable keywords, quota/payment/channel-affinity knobs |
| Pricing tables | `setting/pricing/`, `setting/ratio_setting/` | quota multipliers and defaults |
| Public URL / callback base | `setting/system_setting/system_setting.go` | used by OAuth, worker, proxy URLs |

## Conventions

- Persisted modules register themselves with `config.GlobalConfig.Register(name, &cfg)` in `init()`.
- DB keys are `module.json_tag`; exported struct field JSON tags become storage keys.
- Pointer/map/slice/struct fields serialize as JSON strings in config storage; design fields accordingly.
- Keep setting packages declarative: config state + normalization helpers, not cross-domain orchestration.
- If a value is consumed outside this package, expose it through the module package instead of duplicating env parsing elsewhere.

## Anti-patterns

- Do not add persistent settings without registration; they will read default-only forever.
- Do not change JSON tags casually; that changes DB key names.
- Do not hide normalization in controllers/services when it belongs next to the owning setting module.
