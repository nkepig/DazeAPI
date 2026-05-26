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

## Billing / 用户分组倍率（约定）

- `users.group` 不参与倍率与 relay 选路语义（可为空）。
- `users.groupratio`（JSON → `UserGroupRatio`）：**空对象 `{}`** 表示允许使用所有渠道分组、计费倍率 **1**；非空时仅允许 JSON 中出现的分组名为渠道分组，倍率为对应数值。
- API 请求的 **`UsingGroup`** 以 **令牌 `tokens.group`** 为初值；分发选路后可对齐为实际渠道分组名，计费在 `helper.HandleGroupRatio` 中 **只** 查 `UserGroupRatio[UsingGroup]`（不再使用「账号分组 + 模型」折扣表或运营全局分组倍率）。
- 未在 `ModelPrice` 配置的模型：分发与 `RequireModelPricing` 直接返回 `model_price_error`，不使用占位价。

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
