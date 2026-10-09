# Step 2 当前合同调查与释放回归

## 当前状态（2026-10-04 更新；下方旧调查属于历史切片）

工作区正式插件现为0.0.12，而非下方历史段落的0.0.1：[Client实现](<../../src/client/index.js>)在`sidebarRightTabs.register`和`sidebarRight.openTab`均可用时登记独立Tab type、注入面板内容与会话／工作区快照；否则保留全局overlay。[原生面板回归](<../../tests/unit/native-panel.test.js>)覆盖打开/关闭、工作区成员歧义、版本、全局入口与卸载。[Host实现](<../../src/host/index.js>)通过两条精确Notebook Fetch路由及正式`/api` RPC信封提供health/list，仍`storageReady=false`；Client只通过`ctx.connection.rpc.call('/api', ...)`连接，见[通信回归](<../../tests/unit/client-health.test.js>)及[SDK准入/Gateway回归](<../../tests/unit/connection-contract.test.js>)。因此下文“未增加原生Tab、RPC”的说法**仅描述当时历史状态，不能用于当前版本**。当前源码改动尚未重新安装或刷新当前Desktop，不因源码存在而声称实机已加载。Desktop当前路由释放、无凭据拒绝和内部监听器归零均未证实，见[验收矩阵](<./desktop-step-0-2-gate.md>)。

Step2第6项DshAdapter尚未封装：会话上下文/面板有初步实现，打开来源、输入框草稿、下载仍属于将来笔记功能的依赖，必须在所需宿主合同明确与前置验收关闭后实现，不能把未实现适配器称作完成。独立Web按用户要求暂缓，Step3仍仅隔离实验，不开放生产保存。

## 历史调查切片

Desktop 用户已反馈 Step 1 入口、打开、关闭、重新打开与 Esc 正常；Web 独立验收未完成。下文为当时 Phase 0 的 Step 2 接缝调查，不代表当前实现或 Step 1/2 完成。当时未增加原生 Tab、RPC 或业务写入。

## 正式侧栏接缝

重新 `cordis_inspect_list` 后查询 Client Slots `sidebar.right.pane.tab`：

- keyed/session；注册 key:string。
- owner 提供 TabHookContext 与 SidebarRightTabInjected，但本轮 referencedTypes 为空；未获得具体操作参数。
- 仅内容 Slot 无法创建 Tab 实例，不注册一个永远无法打开的占位内容来冒充成功。

Client Service `layout` 的完整合同：

- `openRightbar(track:boolean, fullscreen:boolean):void` 是 **Report the right panel's presentation without changing its expanded state**。
- `closeRightbar():void` 是报告隐藏状态。
- `selectPanel` 是全局 central panel，非右侧 Tab。

因此不能直接调用 openRightbar 抢占宿主布局；不能把中心页面当侧栏。

读取当前安装 sidebar-right 的 manifest、lib/index.js 均遇 `Cannot mix BigInt and other types`；尝试 lib/types/index.d.ts 返回 not found。没有用 shell 解包、没有猜 API、没有导入内部 Client 包。旧 CLI 与 Desktop 版本不同，旧文档仅参考，未作为实现合同。

## 本轮修复：DOM ref 清空后仍关闭旧上下文

[Client 入口](<../../src/client/index.js>) 原 cleanup 读取 `button.current`。React 卸载时可能已将 DOM ref 清空，此时与 openedBy.button 比较不相等，浮层会保留旧 session 上下文。

修正：effect setup 时捕获实际 element，cleanup 比较捕获身份，保持同一 session 多个入口实例隔离。没有全局 document 监听或轮询。

[回归测试](<../../tests/unit/context-cleanup.test.js>) 模拟打开 → React ref 置 null → effect cleanup → overlay null。与已有发布入口、注册释放及字号断言共 3 个测试通过。

命令 `npm run check && npm test && npm run pack:check && git diff --check` 退出码 0；8 个发布文件完整。测试为 VM 模拟，不声称实际 React 的两端切会话已验。

## 加载限制与后续

当前 Profile 已安装 0.0.1，源码为 link；**不等于当前 Client 已加载新源码**。尚未验证 dev:web watcher，也未通过本轮 install/restart 加载新代际。字号缩小与本轮 cleanup 仅源码/单测验证，不能告诉用户已经即时生效。

下一步需要版本匹配的可读 sidebar-right 类型/文档或 Inspect 展开 TabHookContext/SidebarRightTabInjected 正式合同。若原生创建机制确实不可用，再按指南选等效抽屉并明确其不是原生 Tab。不得任意操作 app DOM 改布局来规避正式接缝。

仍未关闭：双端独立加载、窄窗口/深浅主题/Tab、真实禁用释放、专用会话、正式持久 RPC 正常/取消/断线/非法输入。目标保持 active，不转入 Step 4 产品保存。
