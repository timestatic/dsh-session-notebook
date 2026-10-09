# Step 1/2：Web 全局入口缺失调查

用户确认两个客户端都尝试过，但 Web 左下角没有 AI 笔记按钮。该反馈覆盖之前整体 OK 结论：Desktop 手动 OK，Web 全局入口可见性未通过。

Client Slots Inspect sidebar.footer.action：available=true，dsh-session-notebook.global-entry active=true。无法证明回应 Inspect 的就是用户报错标签页，不能用注册结果否定用户现象。

源码 GlobalEntry 接收 wide；Entry 在 wide=true 显示 locale title，wide=false 显示 ✎。无 sessionId 也可打开 global overlay。新增单元测试覆盖两种 wide 状态、无会话、连接状态组件可达、关闭重开与清理；23/23 测试通过，check/pack/diff 通过。未改生产源码，没有需要新版本发布的 UI 修复。

等待用户展开侧栏/刷新后的实际结果；仍缺失时需要脱敏 URL 与截图，确认 Host/Profile 和模块代数。不擅自读取认证 token 或另起替代服务器。保持 Step 1/2 未完成，不进入产品存储开发。
