# Step 1 空 Bundle 加载证据（round 3）

## 范围与门禁

本轮交付 `dsh-session-notebook@0.0.1` 空插件，仅 composer 入口和可关闭非模态空浮层；无业务 Schema、RPC、笔记存储、选区或 Agent tools。整体仍处于 Phase 0。

Step 0 的声明/实验区分与非生产故障测试门禁继续执行。前两轮把尚未完成的全部环境实验当作禁止编写空 Bundle 的条件过于保守：指南 Step 0 的完成门禁不是所有后续能力实验都 PASS。受控会话和精确 Host 版本仍待补齐，不因此冒充 Step 0 全部完成。

## 文件与实现

- [manifest](<../../package.json>)：零 dependencies、零 install/build scripts；入口直接指向 ESM JS。
- [patch](<../../cordis.patch.yml>)：独立 `session-notebook` row，config 空对象。
- [Host](<../../src/host/index.js>)：空 apply，无存储或会话副作用。
- [Client](<../../src/client/index.js>)：ModuleLoader lazy factory；仅从宿主模块表取 React；不导入 Harness 内部 UI 包；Slot ID 均为 `dsh-session-notebook.*`。
- [英文元信息](<../../locale/en.json>)、[中文元信息](<../../locale/zh.json>)、[图标](<../../icon.svg>) 随包发布。可见文字走 ctx.locale，locale/change 通过 subscribe/getSnapshot 响应。
- 浮层非模态，不拦截 Tab；关闭按钮和 Esc 关闭，尝试恢复入口焦点。没有第二套 app、iframe、body 挂载或独立服务。界面颜色仅主题 token，图标颜色为 artwork。

此阶段暂用 JS 直接发布（官方空插件模板格式），不新增依赖和未确认版本 SDK。尚无 TypeScript 业务代码，因此不伪造 tsc build、lint/typecheck 的全绿记录。进入类型化工程时须采用项目严格项、原生 node:test，并说明 Client ModuleLoader factory 的 require 是宿主格式，不是 Node CommonJS。

## 本地验证

`npm run check && npm test && npm run pack:check && git diff --check` 退出码 0。

- Host/Client Node 语法检查 PASS。
- 2 个 [单元测试](<../../tests/unit/loading.test.js>) PASS：发布入口存在/元信息完整；lazy factory 无提前 import；Slot 独立 ID；模拟 context 卸载后 locale 和 Slot 清空；再次激活仍各一份。
- npm pack dry run 包含 8 个文件：README、manifest、patch、icon、双语 locale、Host、Client。
- 测试采用 VM + 假 ctx，仅证明注册逻辑，不证明 React 挂载、真实 disposer、窗口可见、焦点、无 console crash。

## 安装结果

第一调用显式 `registry: ''` 导致 Plugin Manager `operation-error`，`application: failed`、changed false。纠正参数为正式 npm registry 后成功；不是忽略失败。

第二调用 `install_bundle` target 为本工作区绝对目录：

- `application: applied`、`changed: true`、`warnings: []`。
- 包管理退出码 0；link 到工作区；Profile 的 pnpm 为 11.7.0，和终端 pnpm 12.3.4 不同，不混作项目工具链基线。
- pnpm 输出通用 peer warning；没有版本豁免、没有批准执行依赖脚本。Plugin Manager 结构化 warnings 为空，不据此声称所有 peer 关系已检查。
- 未手工修改 Profile 配置；Profile 变更完全由 Plugin Manager 执行。

安装后 live Inspect：

| 查询 | 实际结果 | 判定 |
|---|---|---|
| Client Slots `conversation.composer.dock` | `dsh-session-notebook.entry`，order 5，active true | 注册 PASS |
| Client Slots `shell.overlay` | `dsh-session-notebook.overlay`，order 5，active true | 注册 PASS |
| Host Config name `dsh-session-notebook` | `include:session-notebook`，patchId session-notebook，status absent | row 已存在；absent 指未导出 Config Schema，不是无 row |

不承诺热更新：尚未验证 dev:web watcher，后续更换已加载源码须按安装结果/模块代际重新加载。

## 未完成验收

- `sn-phase0` 浏览器本轮 snapshot 仍为 401；当前可用的 live Client Inspect 来自另一个已连接页面。不能把 Slot active 当页面截图。
- Desktop 用户手动反馈：按钮可见、打开、关闭、重新打开、Esc 全部正常；用户附输入框底部截图，能看到“AI 笔记”入口。此为 USER-REPORTED PASS，非自动化结果；截图不含浮层内容。
- 用户反馈入口字体偏大，希望位于左/右侧栏。源码已将按钮字号改为 0.75rem、padding 4px 8px，模拟渲染断言通过；当前 Client 是否加载新代际未验证，不能宣称屏幕已经变小。
- Web 可见交互、Desktop 深浅主题/Tab/窄窗口/console crash 检查：NOT RUN。
- 真实禁用/重启释放与再次启用无重复：NOT RUN（仅模拟测试通过）。
- Desktop 窗口交互已有用户明确验证；安装由当前 desktop Profile 的 Plugin Manager 完成。独立重启/再安装验收仍 NOT RUN。
- 侧栏调查：当前 Client Service 目录未暴露 sidebarRightTabs/sidebarRight 服务；Config 已给出 ui-sidebar-right 精确包目录，但 read README 再次遇 BigInt 错误。不能猜 Tab type/instance 参数，也不照搬旧 CLI API。按指南 Step 2 优先右侧原生 Tab，合同不可用时才考虑等效抽屉；本轮未虚构或添加原生 Tab。
- 专用受控会话：NOT RUN。

因此 **Step 1 尚未通过双端完成门禁**，不得进入产品保存或宣称插件交付完成。下一轮优先获取已认证测试页并实际点击空插件，完成 Phase 0 可见性验证；或继续有限的当前正式合同查询，不跳到业务存储写入。
