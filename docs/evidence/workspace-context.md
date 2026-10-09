# Step 2 工作区快照显示

## 精确合同

从官方 npm 获取同版 0.2.0-rc.2 的 conversation、api-session-controller、api-workspace-controller 公开参考包，只读 d.ts，不安装运行时依赖或执行脚本。npm pack SHA1 分别为 d8e6565b7e5792c97c5034ac3770aeb303b57f63、f5501adec4959d8db14596f5041ff8f5dbf12bb4、d0b2440e491f7ed469cab942945975f3d7110b01；材料处于已忽略的 .sdk-reference。

- SessionSnapshot 不含 cwd，不能猜 `useSession(s=>s.cwd)`。
- WorkspaceSnapshot.items 为 WorkspaceView[]，phase pending/ready，state idle/loading/error。
- WorkspaceView.sessionIds 为成员集合；path 已由 Host canonical 化；workspaceId/title/path 分开。
- 当前 Slot 已声明 useWorkspaces selector hook；读取快照不会创建或唤醒 Agent。

## 实现与限制

[Client](<../../src/client/index.js>) WorkspaceContext 使用成员 sessionIds 匹配 panel sessionId，展示工作区标题和 canonical path。pending/error/no membership 明确区分。没有以标题匹配路径、realpath、本机路径扫描或修改工作区。

只展示当前注册表成员快照，不把无成员等同于来源删除；历史/归档 session 所保存的来源路径将由后续 SourceAdapter/NoteSource 处理。多 workspace 歧义未主动修复宿主数据，目前取首个成员；正式保存前需核验宿主唯一归属规则。

[原生面板测试](<../../tests/unit/native-panel.test.js>) 覆盖不同会话成员筛选、canonical 路径、无成员、pending 与 error。12 个 node:test PASS；语法/diff 退出码 0。只是模拟 selector，不证明 Desktop 实际会话切换与工作区推送。

本轮变更在工作区，未安装；最新已安装归档仍 0.0.4（restart-required）。无会话全局入口、真实网络/双端验收仍缺，Step 2 未完成；不进入 Step 4 业务保存。目标 active。
