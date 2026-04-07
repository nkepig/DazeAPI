# 后端 API 清理报告

## 已删除的 API（前端未使用）

### 1. 签到功能 ✅ 已删除
- ~~`GET /api/user/checkin`~~ - 获取签到状态
- ~~`POST /api/user/checkin`~~ - 执行签到
- 删除文件：`controller/checkin.go`

### 2. OAuth 绑定管理 ✅ 已删除
- ~~`GET /api/user/oauth/bindings`~~ - 获取用户 OAuth 绑定
- ~~`DELETE /api/user/oauth/bindings/:provider_id`~~ - 解绑 OAuth
- ~~`GET /api/user/:id/oauth/bindings`~~ - 管理员获取用户 OAuth 绑定
- ~~`DELETE /api/user/:id/oauth/bindings/:provider_id`~~ - 管理员解绑 OAuth
- 删除函数：`controller/custom_oauth.go` 中的相关函数

### 3. 清空用户绑定 ✅ 已删除
- ~~`DELETE /api/user/:id/bindings/:binding_type`~~ - 管理员清空用户绑定
- 删除函数：`controller/user.go` 中的 `AdminClearUserBinding`

### 4. 2FA 统计 ✅ 已删除
- ~~`GET /api/user/2fa/stats`~~ - 管理员获取 2FA 统计
- 删除函数：`controller/twofa.go` 中的 `Admin2FAStats`

### 5. 渠道标签模型 ✅ 已删除
- ~~`GET /api/channel/tag/models`~~ - 获取标签模型
- 删除函数：`controller/channel.go` 中的 `GetTagModels`

### 6. 控制台设置迁移 ✅ 已删除
- ~~`POST /api/option/migrate_console_setting`~~ - 迁移控制台设置（临时接口）
- 删除文件：`controller/console_migrate.go`

## 保留的 API（确认前端在使用）

### 用户模型覆盖 ✅ 保留
- `GET /api/user/:id/model-overrides` - 获取用户模型覆盖
- `PUT /api/user/:id/model-overrides` - 更新用户模型覆盖
- 原因：前端 EditUserModal.jsx 中使用

## 修改的文件列表

1. `router/api-router.go` - 删除了未使用的路由注册
2. `controller/checkin.go` - 已删除整个文件
3. `controller/custom_oauth.go` - 删除了 OAuth 绑定相关函数
4. `controller/user.go` - 删除了 `AdminClearUserBinding` 函数
5. `controller/twofa.go` - 删除了 `Admin2FAStats` 函数
6. `controller/channel.go` - 删除了 `GetTagModels` 函数
7. `controller/console_migrate.go` - 已删除整个文件

## 编译检查

建议在删除后运行以下命令检查是否能正常编译：

```bash
cd /workspace/dazeapi
go build -o /tmp/dazeapi ./main.go
```

如果编译失败，可能是因为某些函数在内部被其他代码调用，需要进一步检查。
