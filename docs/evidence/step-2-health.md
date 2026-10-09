# Step 2 只读 Host 端点准备

## 范围

在 [Host](<../../src/host/index.js>) 增加 `inject=['connection']`，通过 `ctx.connection.fetch.register` 注册 GET health/list 两个精确路径。此为正式 Host 服务注册，不是动态 host.call 或自启 HTTP server。没有会话操作、存储初始化、写入或读取真实历史。

端点：`/api/dsh-session-notebook/health`、`/api/dsh-session-notebook/list`。GET 不接受任何 query 参数；取消返回 CANCELLED；成功 Cache-Control no-store。health 明确 storageReady false，list 的 items [] 是 **Phase 0 空列表占位**，不是损坏库或读失败时返回空库。

## 合同与来源

本轮重新查询 Host Service connection 的精确合同，确认 FetchRoute 的 path、methods、requestBody、fetch，以及 register 的异步 disposer。`createSharedFetchHandler('/api')` 组合共享 RPC 和精确 Fetch 路由，声明其面向 trusted/authenticated requests。注册通过 ctx.effect 管理释放。

尝试猜测的 npm 包名 dsh-connection 返回 E404，已停止使用该名称；后续应从 Config 精确包目录取得实际 transport 文档。不能把 E404 解释为宿主没有 connection。当前仅宿主声明与模拟测试确认，**实际 transport 鉴权/路由派发尚未运行验证**。

## 本轮验证

[端点测试](<../../tests/unit/host-health.test.js>) 覆盖：两个独立路径、仅 GET、buffered 模式、正确结果、不接受未知参数、预取消、no-store、异步 disposer 清空注册。既有 Client/fallback/native panel 测试仍通过。

`npm run check && npm test && git diff --check` 退出码 0，共 5 个 node:test PASS。模拟 ctx 不测试网络 401/403、页面断线或真实 Host 取消派发。

## 加载与下一步

本轮 Host 变更仅在工作区，未打包/安装，不复用 0.0.3 的安装归档宣称已运行新 Host。当前已安装 0.0.3 原生侧栏版仍以 restart-required 为证据；不自动重启活跃会话。

后续建立 Client 同源 fetch 调用与响应校验、mount AbortController、错误/断线状态和重试；在真实已认证页面验证 health/list 往返并验证匿名端点拒绝访问。业务共享 Schema 和存储必须等可靠性门禁，不把当前空端点扩大为笔记保存。Step 1 双端/Step 2 完成门禁尚未通过，目标保持 active。
