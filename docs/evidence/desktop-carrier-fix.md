# Desktop 连接失败修复 0.0.5

> 历史记录：下述共享 `/api` interceptor 方案已被用户实际启动故障证明存在 Gateway 冲突；不要照此实现。0.0.9 改用独立 RPC 通道，见 [API Gateway 冲突修复](<api-gateway-conflict-fix.md>)。

用户截图证明原生 AI 笔记 tab、sessionId、工作区标题/path 可见，同时连接失败；这是真实失败证据，不是 Step 2 PASS。旧错误文案提认证并非已诊断认证失效。

发现 Client 用 global fetch('/api/...')，绕开宿主 carrier。根据 Config 精确发现 @deepseek-ai/dsh-client-connection，获取官方 npm 0.2.0-rc.2 参考包（SHA1 29cf54187cfcc6d3b70dbd5417b1f70249f513f9）；README 28 行及 ClientTransportHooks/ConnectionHandle/ClientConnectionRpc 明确静态 Desktop transport 自有 HTTP 目标与认证，逻辑 rpc.call 是选择 transport 的接口。API Gateway 同版代码也调用 connection.rpc.call('/api', endpoint, payload, signal)。未读取页面 token/全局传输对象，不自行拼接 Host origin。

修复：Client inject connection，改为 ctx.connection.rpc.call('/api', endpoint, {}, signal)；Host 精确 rpc.intercept 两个 notebook endpoint，校验空对象与取消，保留 GET FetchRoute。endpoint matcher 不拦截其他命名空间；effect 拥有 disposer。仍没有笔记写入。

新增实际 Host RPC handler 与 Client 联调，global fetch 若调用即抛错，验证 connected、参数拒绝、matcher 不拦 session/delete、intercept 释放。13 测试 PASS，check/diff PASS。并不证明实际 Desktop carrier 已成功；截图只表明旧错误，不能直接确定失败的 HTTP 状态。

0.0.5 归档 SHA1 e941440b93010e05f68f91a28b7ca71e31008cac；正式安装 changed true，package exitCode 0，application restart-required。需用户正常重开 Desktop 后重试连接；尚未自动重启、真实网络 PASS 未取得。工作区快照本轮一起发布。Step 2 继续未验收，目标 active。
