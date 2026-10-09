# 0.0.7 全局入口版安装

将上轮 root sidebar.footer.action 全局入口纳入正式发布。GlobalEntry 改为返回 React Element，不直接调用 Entry 函数；共享 VersionLabel 在原生 Tab 与全局抽屉显示 v0.0.7，测试比对 manifest 并断言两处一致。

验证：npm run check、16 个 node:test、git diff --check 全部退出码 0。仍为 VM/fake React 和进程内通信，不代替真实挂载和焦点测试。

npm pack 8 文件，SHA1 1e00a80f49d616ea01b4550d20e653ae44e08179。Plugin Manager package exitCode 0、changed true、application restart-required；未自动重启活跃 Desktop。

正常重开后检查：左栏底部 AI 笔记（收起时符号）在无会话时打开抽屉；抽屉版本 v0.0.7，连接检查和诊断码可见；已有会话的 composer 入口仍打开原生 Tab。关闭/Esc/焦点恢复、无会话可见、窄窗口、主题、真实通信均需运行验收。没有实际笔记库或保存。

旧用户截图仅确认原生面板/workspace 可见和通信失败；未收到 carrier 修复后的 success 证据。Step 1/2 门禁仍不通过，目标 active。
