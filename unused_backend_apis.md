# 后端存在但前端未使用的 API 分析报告

## 方法
- 收集后端所有 API 路由（router/*.go）
- 收集前端所有 API 调用（web/src/**/*.{jsx,js}）
- 对比找出差异

---

## 1. 后端路由列表（按模块）

### API Router (/api)

#### 系统/公开接口
- `GET /api/setup` - 系统安装设置
- `POST /api/setup` - 系统安装设置
- `GET /api/status` - 获取系统状态 ✅ 前端使用
- `GET /api/uptime/status` - 获取 uptime kuma 状态 ✅ 前端使用
- `GET /api/models` - 模型列表（需要登录）✅ 前端使用
- `GET /api/status/test` - 测试状态（仅管理员）
- `GET /api/notice` - 获取公告 ✅ 前端使用
- `GET /api/user-agreement` - 用户协议 ✅ 前端使用
- `GET /api/privacy-policy` - 隐私政策 ✅ 前端使用
- `GET /api/about` - 关于页面 ✅ 前端使用
- `GET /api/home_page_content` - 首页内容 ✅ 前端使用
- `GET /api/pricing` - 定价信息 ✅ 前端使用

#### 邮箱/验证
- `GET /api/verification` - 发送邮箱验证码 ✅ 前端使用
- `GET /api/reset_password` - 发送密码重置邮件
- `POST /api/user/reset` - 重置密码

#### OAuth 相关
- `GET /api/oauth/state` - 生成 OAuth 状态码
- `GET /api/oauth/email/bind` - 邮箱绑定
- `GET /api/oauth/wechat` - 微信授权 ✅ 前端使用
- `GET /api/oauth/wechat/bind` - 微信绑定
- `GET /api/oauth/telegram/login` - Telegram 登录 ✅ 前端使用
- `GET /api/oauth/telegram/bind` - Telegram 绑定
- `GET /api/oauth/:provider` - 通用 OAuth 处理 ✅ 前端使用
- `GET /api/ratio_config` - 获取倍率配置 ✅ 前端使用

#### 通用验证
- `POST /api/verify` - 通用安全验证 ✅ 前端使用

### User Router (/api/user)

#### 公开接口
- `POST /api/user/register` - 用户注册 ✅ 前端使用
- `POST /api/user/login` - 用户登录 ✅ 前端使用
- `POST /api/user/login/2fa` - 2FA 登录验证
- `POST /api/user/passkey/login/begin` - Passkey 登录开始
- `POST /api/user/passkey/login/finish` - Passkey 登录完成
- `GET /api/user/logout` - 退出登录 ✅ 前端使用
- `GET /api/user/groups` - 获取用户分组 ✅ 前端使用

#### 需要登录 (/api/user/)
- `GET /api/user/self/groups` - 获取自己的分组
- `GET /api/user/self` - 获取自己的信息 ✅ 前端使用
- `GET /api/user/self/models` - 获取自己的模型 ✅ 前端使用
- `PUT /api/user/self` - 更新自己的信息 ✅ 前端使用
- `DELETE /api/user/self` - 删除自己的账户
- `GET /api/user/token` - 生成访问令牌 ✅ 前端使用
- `GET /api/user/passkey` - Passkey 状态
- `POST /api/user/passkey/register/begin` - Passkey 注册开始 ✅ 前端使用
- `POST /api/user/passkey/register/finish` - Passkey 注册完成 ✅ 前端使用
- `POST /api/user/passkey/verify/begin` - Passkey 验证开始 ✅ 前端使用
- `POST /api/user/passkey/verify/finish` - Passkey 验证完成 ✅ 前端使用
- `DELETE /api/user/passkey` - 删除 Passkey ✅ 前端使用
- `GET /api/user/aff` - 获取邀请码 ✅ 前端使用
- `PUT /api/user/setting` - 更新用户设置 ✅ 前端使用

#### 2FA 相关
- `GET /api/user/2fa/status` - 获取 2FA 状态 ✅ 前端使用
- `POST /api/user/2fa/setup` - 设置 2FA ✅ 前端使用
- `POST /api/user/2fa/enable` - 启用 2FA ✅ 前端使用
- `POST /api/user/2fa/disable` - 禁用 2FA ✅ 前端使用
- `POST /api/user/2fa/backup_codes` - 重新生成备份码 ✅ 前端使用

#### 签到相关
- `GET /api/user/checkin` - 获取签到状态
- `POST /api/user/checkin` - 执行签到

#### 自定义 OAuth 绑定
- `GET /api/user/oauth/bindings` - 获取 OAuth 绑定
- `DELETE /api/user/oauth/bindings/:provider_id` - 解绑 OAuth

#### 管理员接口 (/api/user/ - 需要管理员权限)
- `GET /api/user/` - 获取所有用户 ✅ 前端使用
- `GET /api/user/search` - 搜索用户 ✅ 前端使用
- `GET /api/user/:id/oauth/bindings` - 获取用户 OAuth 绑定
- `DELETE /api/user/:id/oauth/bindings/:provider_id` - 管理员解绑 OAuth
- `DELETE /api/user/:id/bindings/:binding_type` - 清空用户绑定
- `GET /api/user/:id` - 获取用户详情 ✅ 前端使用
- `POST /api/user/` - 创建用户 ✅ 前端使用
- `POST /api/user/manage` - 管理用户 ✅ 前端使用
- `PUT /api/user/` - 更新用户 ✅ 前端使用
- `DELETE /api/user/:id` - 删除用户 ✅ 前端使用
- `DELETE /api/user/:id/reset_passkey` - 重置用户 Passkey ✅ 前端使用
- `GET /api/user/:id/model-overrides` - 获取用户模型覆盖
- `PUT /api/user/:id/model-overrides` - 更新用户模型覆盖
- `POST /api/user/sync-models` - 同步用户模型 ✅ 前端使用
- `GET /api/user/2fa/stats` - 获取 2FA 统计
- `DELETE /api/user/:id/2fa` - 管理员禁用 2FA ✅ 前端使用

### Option Router (/api/option) - Root 权限
- `GET /api/option/` - 获取所有配置 ✅ 前端使用
- `PUT /api/option/` - 更新配置 ✅ 前端使用
- `GET /api/option/channel_affinity_cache` - 获取渠道亲和性缓存统计 ✅ 前端使用
- `DELETE /api/option/channel_affinity_cache` - 清空渠道亲和性缓存 ✅ 前端使用
- `POST /api/option/rest_model_ratio` - 重置模型倍率 ✅ 前端使用
- `POST /api/option/migrate_console_setting` - 迁移控制台设置

### Custom OAuth Provider Router (/api/custom-oauth-provider)
- `POST /api/custom-oauth-provider/discovery` - 发现 OAuth 提供商
- `GET /api/custom-oauth-provider/` - 获取所有自定义 OAuth 提供商 ✅ 前端使用
- `GET /api/custom-oauth-provider/:id` - 获取单个提供商 ✅ 前端使用
- `POST /api/custom-oauth-provider/` - 创建提供商 ✅ 前端使用
- `PUT /api/custom-oauth-provider/:id` - 更新提供商 ✅ 前端使用
- `DELETE /api/custom-oauth-provider/:id` - 删除提供商 ✅ 前端使用

### Performance Router (/api/performance)
- `GET /api/performance/stats` - 获取性能统计 ✅ 前端使用
- `DELETE /api/performance/disk_cache` - 清除磁盘缓存 ✅ 前端使用
- `POST /api/performance/reset_stats` - 重置性能统计 ✅ 前端使用
- `POST /api/performance/gc` - 强制 GC ✅ 前端使用
- `GET /api/performance/logs` - 获取日志文件 ✅ 前端使用
- `DELETE /api/performance/logs` - 清理日志文件 ✅ 前端使用

### Ratio Sync Router (/api/ratio_sync)
- `GET /api/ratio_sync/channels` - 获取可同步渠道 ✅ 前端使用
- `POST /api/ratio_sync/fetch` - 获取上游倍率 ✅ 前端使用

### Channel Router (/api/channel)
- `GET /api/channel/` - 获取所有渠道 ✅ 前端使用
- `GET /api/channel/search` - 搜索渠道 ✅ 前端使用
- `GET /api/channel/models` - 渠道模型列表 ✅ 前端使用
- `GET /api/channel/models_enabled` - 已启用模型列表 ✅ 前端使用
- `GET /api/channel/:id` - 获取渠道详情 ✅ 前端使用
- `POST /api/channel/:id/key` - 获取渠道密钥（Root 权限）✅ 前端使用
- `GET /api/channel/test` - 测试所有渠道 ✅ 前端使用
- `GET /api/channel/test/:id` - 测试单个渠道 ✅ 前端使用
- `GET /api/channel/update_balance` - 更新所有渠道余额 ✅ 前端使用
- `GET /api/channel/update_balance/:id` - 更新单个渠道余额 ✅ 前端使用
- `POST /api/channel/` - 添加渠道 ✅ 前端使用
- `PUT /api/channel/` - 更新渠道 ✅ 前端使用
- `DELETE /api/channel/disabled` - 删除禁用渠道 ✅ 前端使用
- `POST /api/channel/tag/disabled` - 禁用标签渠道 ✅ 前端使用
- `POST /api/channel/tag/enabled` - 启用标签渠道 ✅ 前端使用
- `PUT /api/channel/tag` - 编辑标签渠道 ✅ 前端使用
- `DELETE /api/channel/:id` - 删除渠道 ✅ 前端使用
- `POST /api/channel/batch` - 批量删除渠道 ✅ 前端使用
- `POST /api/channel/fix` - 修复渠道能力 ✅ 前端使用
- `GET /api/channel/fetch_models/:id` - 获取上游模型 ✅ 前端使用
- `POST /api/channel/fetch_models` - 获取所有上游模型 ✅ 前端使用
- `POST /api/channel/codex/oauth/start` - 开始 Codex OAuth
- `POST /api/channel/codex/oauth/complete` - 完成 Codex OAuth
- `POST /api/channel/:id/codex/oauth/start` - 为指定渠道开始 Codex OAuth
- `POST /api/channel/:id/codex/oauth/complete` - 为指定渠道完成 Codex OAuth
- `POST /api/channel/:id/codex/refresh` - 刷新 Codex 渠道凭证
- `GET /api/channel/:id/codex/usage` - 获取 Codex 渠道使用统计
- `POST /api/channel/ollama/pull` - Ollama 拉取模型 ✅ 前端使用
- `POST /api/channel/ollama/pull/stream` - Ollama 拉取模型（流式）✅ 前端使用
- `DELETE /api/channel/ollama/delete` - Ollama 删除模型 ✅ 前端使用
- `GET /api/channel/ollama/version/:id` - 获取 Ollama 版本 ✅ 前端使用
- `POST /api/channel/batch/tag` - 批量设置标签 ✅ 前端使用
- `GET /api/channel/tag/models` - 获取标签模型
- `POST /api/channel/copy/:id` - 复制渠道 ✅ 前端使用
- `POST /api/channel/multi_key/manage` - 管理多密钥 ✅ 前端使用
- `POST /api/channel/upstream_updates/apply` - 应用上游更新 ✅ 前端使用
- `POST /api/channel/upstream_updates/apply_all` - 应用所有上游更新 ✅ 前端使用
- `POST /api/channel/upstream_updates/detect` - 检测上游更新 ✅ 前端使用
- `POST /api/channel/upstream_updates/detect_all` - 检测所有上游更新 ✅ 前端使用

### Token Router (/api/token)
- `GET /api/token/` - 获取所有令牌 ✅ 前端使用
- `GET /api/token/search` - 搜索令牌 ✅ 前端使用
- `GET /api/token/:id` - 获取令牌详情 ✅ 前端使用
- `POST /api/token/:id/key` - 获取令牌密钥 ✅ 前端使用
- `POST /api/token/` - 添加令牌 ✅ 前端使用
- `PUT /api/token/` - 更新令牌 ✅ 前端使用
- `DELETE /api/token/:id` - 删除令牌 ✅ 前端使用
- `POST /api/token/batch` - 批量删除令牌 ✅ 前端使用

### Usage Router (/api/usage)
- `GET /api/usage/token/` - 获取令牌使用量 ✅ 前端使用

---

## 2. 后端存在但前端未使用的 API（候选删除）

### 2.1 系统/安装相关
| 接口 | 路径 | 说明 | 建议 |
|------|------|------|------|
| ❌ | `GET /api/setup` | 系统安装设置查询 | **保留** - 安装时使用 |
| ❌ | `POST /api/setup` | 系统安装设置提交 | **保留** - 安装时使用 |
| ❌ | `GET /api/status/test` | 测试状态（仅管理员） | **可考虑删除** - 测试用 |

### 2.2 邮箱/验证相关
| 接口 | 路径 | 说明 | 建议 |
|------|------|------|------|
| ❌ | `GET /api/reset_password` | 发送密码重置邮件 | **保留** - 忘记密码功能需要 |
| ❌ | `POST /api/user/reset` | 重置密码 | **保留** - 忘记密码功能需要 |

### 2.3 OAuth 绑定相关（前端可能未完全实现）
| 接口 | 路径 | 说明 | 建议 |
|------|------|------|------|
| ❌ | `GET /api/oauth/state` | 生成 OAuth 状态码 | **保留** - OAuth 流程需要 |
| ❌ | `GET /api/oauth/email/bind` | 邮箱绑定 | **保留** - OAuth 绑定需要 |
| ❌ | `GET /api/oauth/telegram/bind` | Telegram 绑定 | **保留** - 账号绑定需要 |
| ❌ | `GET /api/user/oauth/bindings` | 获取 OAuth 绑定 | 检查是否使用 |
| ❌ | `DELETE /api/user/oauth/bindings/:provider_id` | 解绑 OAuth | 检查是否使用 |

### 2.4 签到功能（可能未在前端实现）
| 接口 | 路径 | 说明 | 建议 |
|------|------|------|------|
| ❓ | `GET /api/user/checkin` | 获取签到状态 | 检查前端是否有签到功能 |
| ❓ | `POST /api/user/checkin` | 执行签到 | 检查前端是否有签到功能 |

### 2.5 用户模型覆盖（前端可能未实现）
| 接口 | 路径 | 说明 | 建议 |
|------|------|------|------|
| ❌ | `GET /api/user/:id/model-overrides` | 获取用户模型覆盖 | 检查是否使用 |
| ❌ | `PUT /api/user/:id/model-overrides` | 更新用户模型覆盖 | 检查是否使用 |

### 2.6 Codex 相关（可能是新功能，前端未实现）
| 接口 | 路径 | 说明 | 建议 |
|------|------|------|------|
| ❌ | `POST /api/channel/codex/oauth/start` | 开始 Codex OAuth | **新功能，保留** |
| ❌ | `POST /api/channel/codex/oauth/complete` | 完成 Codex OAuth | **新功能，保留** |
| ❌ | `POST /api/channel/:id/codex/oauth/start` | 为指定渠道开始 OAuth | **新功能，保留** |
| ❌ | `POST /api/channel/:id/codex/oauth/complete` | 为指定渠道完成 OAuth | **新功能，保留** |
| ❌ | `POST /api/channel/:id/codex/refresh` | 刷新 Codex 凭证 | **新功能，保留** |
| ❌ | `GET /api/channel/:id/codex/usage` | 获取 Codex 使用统计 | **新功能，保留** |

### 2.7 标签模型（可能未使用）
| 接口 | 路径 | 说明 | 建议 |
|------|------|------|------|
| ❓ | `GET /api/channel/tag/models` | 获取标签模型 | 检查是否使用 |

### 2.8 迁移相关（临时接口）
| 接口 | 路径 | 说明 | 建议 |
|------|------|------|------|
| ❌ | `POST /api/option/migrate_console_setting` | 迁移控制台设置 | **可删除** - 下个版本删除 |

---

## 3. 确认未使用的 API 列表

### 可安全删除（确认前端未使用）

1. **迁移接口**
   - `POST /api/option/migrate_console_setting` - 注释已说明是临时接口

### 需要进一步确认的功能

1. **签到功能**
   - `GET /api/user/checkin`
   - `POST /api/user/checkin`

2. **OAuth 绑定管理**
   - `GET /api/user/oauth/bindings`
   - `DELETE /api/user/oauth/bindings/:provider_id`
   - `GET /api/user/:id/oauth/bindings` (admin)
   - `DELETE /api/user/:id/oauth/bindings/:provider_id` (admin)

3. **用户模型覆盖**
   - `GET /api/user/:id/model-overrides`
   - `PUT /api/user/:id/model-overrides`

4. **渠道标签模型**
   - `GET /api/channel/tag/models`

5. **2FA 统计**
   - `GET /api/user/2fa/stats`

6. **清空用户绑定**
   - `DELETE /api/user/:id/bindings/:binding_type`

---

## 4. 建议操作

### 高优先级（可安全删除）
1. `POST /api/option/migrate_console_setting` - 临时迁移接口，已标记删除

### 中优先级（需要确认）
2. 签到功能相关接口（如果前端无签到功能）
3. `GET /api/channel/tag/models`（如果没有标签模型功能）

### 低优先级（保留但可优化）
4. OAuth 绑定相关接口（如果有相关功能则保留）
5. 用户模型覆盖接口（如果有相关功能则保留）
6. 2FA 统计接口（管理员功能）
