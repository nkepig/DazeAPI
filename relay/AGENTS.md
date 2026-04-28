# AGENTS.md — relay

## Overview

Provider relay layer. Owns request adaptation, upstream transport, streaming/task handling, and relay-specific billing hooks.

## Structure

```text
relay/
├── relay_adaptor.go     # provider + task adaptor registry
├── relay_task.go        # async task submit lifecycle
├── common/              # relay info, overrides, billing helpers
├── helper/              # model mapping, pricing, validation, stream helpers
├── channel/             # provider-specific adaptors
├── common_handler/      # shared HTTP handlers
└── *_handler.go         # mode-specific entry handlers
```

## Where to look

| Task | Location | Notes |
|---|---|---|
| Add sync provider | `relay/relay_adaptor.go`, `relay/channel/<provider>/` | register adaptor and wire constants |
| Add task/video provider | `relay/relay_adaptor.go`, `relay/channel/task/<provider>/` | task adaptor registry is separate |
| Task submit lifecycle | `relay/relay_task.go` | model resolution, pricing, preconsume, upstream call |
| Shared relay state | `relay/common/relay_info.go` | channel/meta/request context |
| Model mapping / price helpers | `relay/helper/` | mapping and quota shaping live here |
| OpenAI-family baseline | `relay/channel/openai/` | broadest compatibility surface |
| Task metadata safety | `relay/channel/task/taskcommon/helpers.go` | strips unsafe `model` metadata |

## Conventions

- New providers register through `GetAdaptor`; task providers through `GetTaskAdaptor`.
- Keep adaptor-specific quirks inside provider folders; do not spread provider conditionals across generic handlers.
- Task pricing flow is: estimate ratios -> base price -> preconsume -> upstream response -> submit-time adjustment.
- If a new channel genuinely supports `StreamOptions`, add it to the stream-support registry; do not fake support.
- Relay DTOs that round-trip client JSON upstream must preserve explicit zero values with pointer fields.

## Anti-patterns

- Do not bypass `helper.ModelMappedHelper` / pricing helpers in submit paths.
- Do not reintroduce metadata-driven `model` overrides; billing bypass guard is intentional.
- Do not use the bulk task update path for refund/settlement state transitions.
- Do not copy provider behavior into unrelated adaptors; prefer local helper files in that provider subtree.
