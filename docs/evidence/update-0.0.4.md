# 0.0.4 只读通信联调与安装

## 本轮进展

Client 的 health/list 连接状态与 Host 正式 Connection FetchRoute 一起打包，依然为 Phase 0 加载检查。存储状态明确 false，空列表为占位，无笔记保存和实际历史读取。

[Client 测试](<../../tests/unit/client-health.test.js>) 新增真实 Host apply + 进程内路由适配的联调（不是固定模拟响应）；客户端可接受真正 Host Response 并显示 connected。补测 HTTP 401 不继续请求 list、非法非空列表拒绝、10 秒超时 abort 且只报告一次失败。

`npm run check && npm test && git diff --check` 退出码 0，12 个 node:test PASS。联调绕过真实 transport，仅测试实际 Host 处理器与实际 Client 流程；不验证宿主网络授权与精确路径派发。

## 安装

npm pack 输出 8 个发布文件，0.0.4 包 SHA1 `0e7fd44acbf57283ee93c6bef09395ac507d5961`。Plugin Manager 安装明确版本本地归档：changed true、packageResult.exitCode 0、**application restart-required**。没有自动重启 Desktop，未批准执行依赖脚本或版本豁免。

最新安装包为 0.0.4；此前 0.0.2/0.0.3 的证据是历史，不代表当前已加载代际。源码后续文档修改不会更新已经打包的 README 内容，发布校验以归档时清单为准。

## 用户运行验收清单

在方便时正常退出并重开 Desktop，继续原会话：

1. 输入框下紧凑“AI 笔记”入口优先打开右侧原生 Tab，不再仅旧浮层。
2. 面板显示当前 sessionId 与“Host 已连接；存储尚未就绪”。若失败保持原错误状态，不把空列表解释为库为空。
3. 重复点击保持原生 page 去重；关闭按钮只关闭自身 tab，原生面板收起/展开不改聊天。
4. 切会话后面板属于新会话；关闭/卸载停止请求，不显示迟到旧结果。
5. 深浅主题、窄窗口、键盘导航和 console crash 仍需分别验收。

真实已认证 health/list 往返、匿名 401/403、断线/取消、Desktop 与 Web 独立验证都 NOT RUN。工作区快照、无会话全局入口尚未实现。Step 1 双端和 Step 2 完成门禁未通过，不能转入产品保存。目标 active。
