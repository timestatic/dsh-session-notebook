# 0.0.12：精确 Notebook POST 路由修复

用户重启后启用 0.0.11 仍实际失败：cannot get property webServer without inject。已通过官方插件管理恢复禁用，application=applied。增加调用者 inject 的方案被真实结果否定。

读取版本匹配的 Connection 注册与 Cordis traceable/shadow 实现发现 handle 调用涉及内部上下文，普通对象测试不能保证真实 Cordis service 访问。已避开 rpc.handle：Host 仅通过 connection.fetch.register 注册两条精确 Notebook GET/POST 路由，Client rpc.call('/api', 'dsh-session-notebook/health|list', {}, signal)。不注册共享 interceptor，不接管官方端点，继续走 Desktop carrier、宿主认证及 shared Fetch dispatcher。

POST 校验 content-type、JSON、type、rpcId、method、payload 与字段集合，返回标准 server-response 与原 rpcId。GET 仍兼容原行为。测试覆盖实际 POST 信封、SDK exact route 分发与官方 Gateway 两种注册顺序共存。

当前进程仍缓存旧 Host 模块：再次启用返回旧 rpc.handle 的堆栈，立即恢复禁用。官方 install_bundle 返回 ambiguous-install（package exitCode 0），不声称新运行时应用成功。工作区为 0.0.12；需完整退出并重开加载新模块，再启用确认。未手工改 Profile、未自动重启。

本轮本地 check、22/22 测试、pack dry-run 与 diff 检查通过；后续额外 POST 参数用例再运行。真实 Host/Client 与 Gateway HTTP 200 仍待验收，Step 1/2 未完成。
