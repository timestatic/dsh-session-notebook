# API Gateway 通道冲突修复 0.0.9

> 更新：0.0.9 的 `/rpc/dsh-session-notebook` 被参考 SDK 的单段 channel 校验拒绝，尚不可部署。当前 0.0.10 使用 `/dsh-session-notebook`。下文为历史方案与测试结果；最新证据见 [单段通道兼容修正](<channel-contract-fix.md>)。

## 问题与旧测试盲区

用户提供的 Desktop 0.2.0-rc.2 排查结果显示：0.0.8 注册第二个 `ctx.connection.rpc.intercept('/api', ...)` 后，官方 `POST /api/settings/describe` 返回 404；暂时移除插件 bundle 后恢复 200。本次没有重新执行该真实 Desktop HTTP 验证。

源码确认 Host 注册了共享 `/api` 拦截器，Client 也通过该通道调用 Notebook。旧测试只检查 endpoint matcher，不模拟官方 Gateway 的通道占用；GET 测试中的模拟 RPC caller 还把 POST RPC 转成 GET，因此不能证明 Gateway 共存正常。

## 修复决策

- Host 改为 `ctx.connection.rpc.handle('/rpc/dsh-session-notebook', handler)`，不再注册共享 `/api` 拦截器。
- Client 使用同一个独立通道，endpoint 为 `health` / `list`。继续走 `ctx.connection.rpc.call`，保留 Desktop carrier 与认证，不回退 global fetch，不读取 token 或自行拼接 origin。
- 保留现有 `/api/dsh-session-notebook/health` 与 `/api/dsh-session-notebook/list` 的独立 GET 路由。它们只注册精确路径及 GET 方法，不占用共享 RPC 拦截器。
- 独立 RPC handler 显式拒绝未知 endpoint，继续验证空对象、取消请求；所有注册仍通过 effect 持有 disposer。
- 包版本与 Client 版本标识同步为 0.0.9。

当前 Host Inspect 的 `connection` 契约确认 `rpc.handle(channel, handler)` 支持独立通道。Client Inspect 查询未返回可用 connection 契约，回退读取工作区已保存的 0.2.0-rc.2 SDK 类型与 README；其 Client RPC 允许泛用逻辑通道。这不是对实际 Desktop carrier 的运行时验收。

## 自动验证

- `npm run check`：通过。
- `npm test`：18/18 通过。
- 回归测试禁止调用 `rpc.intercept`，验证独立 RPC health/list 实际 Host handler 与 Client 的进程内往返，且 global fetch 调用即失败。
- 模拟官方 `/api` Gateway，在插件连续两次加载/卸载前后，`settings/describe` 结果与 handler 引用均保持不变；验证独立通道与 GET 路由释放。
- 测试覆盖未知端点、非法参数、取消、超时、卸载与安全诊断。
- 默认 npm 缓存访问出现 EPERM；切换平台临时目录的 npm 缓存后 `pack:check` 通过。未修改全局缓存所有权。
- `git diff --check`：通过。

这些结果仅为本地自动检查，尚未安装到 Desktop Profile、重新启用插件或证明真实 HTTP 200。

## 部署验收

通过 Harness 插件管理安装工作区 0.0.9 bundle（不要手工编辑 Profile package.json）。根据安装结果决定是否需重启；替换已加载 JavaScript 包应完全退出 Desktop 后重新打开。

启用后验收：

1. Desktop welcome 正常，`POST /api/settings/describe` 返回 200，启动后多次读取不回归。
2. Notebook 面板显示 v0.0.9，health/list 经独立 RPC 通道返回正确值，连接检查通过。
3. Web 与 Desktop 双端验证；独立 GET 路由保留原认证边界，未登录不能绕过认证。
4. 禁用插件后官方 Gateway 继续工作。

若实际 Desktop carrier 不支持独立逻辑通道，应保持插件禁用并继续诊断，或迁移到官方 Gateway 的 Remote Service；不要恢复第二个 `/api` interceptor。
