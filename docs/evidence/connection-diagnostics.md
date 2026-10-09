# Step 2 连接失败安全诊断

当前真实成功往返未取得；不继续业务功能。本轮在 [Client](<../../src/client/index.js>) 增加安全诊断类别：TIMEOUT、TRANSPORT_FAILED、INVALID_HEALTH_RESPONSE、INVALID_LIST_RESPONSE 和固定允许列表 RPC 错误。未知服务端 code/message 不直接呈现，任意 throw（包括 null）安全转换。移除“检查认证”的未经诊断归因，重试清除旧诊断。

[Client 测试](<../../tests/unit/client-health.test.js>) 新增未知 RPC 文本不泄露、throw null、已知取消错误分类；16 个 node:test PASS，check/diff 退出码 0。仍是进程内模拟，不声称网络授权或 Desktop 实际成功。

本轮诊断改动仅工作区，未打包安装，最新安装仍为 0.0.5 carrier 修复归档（restart-required）。用户正常重开后应先检查 0.0.5 往返；若失败继续补足可安全收集的真实 transport 证据。不绕过认证，不自动重启用户会话。Step 1/2 门禁仍未通过，目标 active。

诊断不是 API 稳定错误合同；业务 Schema 与统一错误将按后续指南实现。
