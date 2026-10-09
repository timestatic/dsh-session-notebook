# Step 2 无会话全局入口

重新查 live Slots 后确认 sidebar.footer.action 为 root/list，owner props 仅 wide；独立 id 可叠加而非替换设置。sidebar.bottom 查询 unavailable 后不继续使用猜测名字。

[Client](<../../src/client/index.js>) 增加 dsh-session-notebook.global-entry，在展开侧栏显示本地化标题，56px rail 显示符号并保留 aria-label。全局模式始终打开 shell.overlay 加载检查抽屉，不调用依赖 mounted Session 的 sidebarRight.openTab，不启动 Session 或 Agent、不读取会话历史。

抽屉复用现有关闭/Esc/focus restoration 机制，附加 ConnectionStatus；仍显示尚无保存，不声称已经是可用全局笔记库。会话 composer 入口仍优先原生右侧 Tab。

16 个 node:test PASS，check/diff 退出码 0；扩展既有测试覆盖无 sessionId 的全局点击、收起栏 accessible name、不调用会话 controller、抽屉连接组件和关闭、卸载和再次启用的三项注册清理。模拟生命周期不等于真实焦点/窄窗口 PASS。

本轮仅工作区改动，未安装；最新安装 0.0.6 restart-required。后续修订需同步版本标识并正式打包安装再测试，无会话时左栏入口可见性尚 NOT RUN。真实通信/双端门禁仍未通过，目标 active。
