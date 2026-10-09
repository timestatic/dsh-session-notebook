# 0.0.13 只读测试包：验证说明

> 此文档对应工作区源码 `dsh-session-notebook@0.0.13`。打包与本地检查结果见交付回复；本文件是操作清单，不是 Desktop 已安装、已通过或已开放保存的证据。

## 1. 版本与能力边界

- Bundle 的实际入口为 `src/host/index.js` 和 `src/client/index.js`，Host 只注册精确 `/api/dsh-session-notebook/health`、`/api/dsh-session-notebook/list` GET/POST；返回 `phase: 0`、`storageReady: false`、空 `items`。
- 包内附带 `src/manual-notebook-service.js`、`src/snapshot-coordinator.js`、`src/host/preview-routes.js`、`src/client/preview-api.js` 等**未挂载**代码；它们可在工作区隔离集成测试中往返，但安装本包**不会**注册 `manual/create` 等生产端点或提供笔记保存。
- Client 可显示 AI 笔记入口、原生面板/浮层、连接状态与本地内存手工草稿；草稿不可保存。选区、引用、标签、导出等仅有未接 UI 的纯逻辑，不应据包内存在文件就判功能可用。
- 独立 Web 当前暂缓。本次包不测试正式存储可靠性、损坏恢复、真实笔记写入、跨 Host 排他或正式 MVP 功能。

## 2. 不安装即可执行的本地测试

从工作区根目录运行 `npm run check`、`npm test`、`npm run test:integration`、`npm run test:runtime`、`npm run pack:check`、`git diff --check`，分别记录退出码。默认 npm 缓存无权限时，仅临时指定可写的 `npm_config_cache`，不要 sudo/chown 全局缓存。

- `npm test`：语法外的业务/传输负例、禁用共享 `/api` interceptor、卸载迟到响应、错误码安全及轻量存储模块的单元级边界。
- `npm run test:integration`：工作区**隔离介质**下，真实 Cordis Domain → 未挂载业务服务 → 精确路由处理器 → Client RPC 适配的新增、列表、编辑、重开读回和取消/非法请求。测试中的 carrier 是限定模拟，**不是实际 Desktop 网络、认证或安装验证**。
- `npm run test:runtime`：保存版 SDK/Cordis 的隔离运行时测试，不读写用户 Profile 的笔记；结果不能替代实际 Desktop 生命周期/存储验收。
- `npm run pack:check`：只检查 tarball 清单，不安装。`npm pack --ignore-scripts` 则会生成可分发的 `.tgz`；检查包内 `package.json`、Bundle patch、Host/Client 和必要文件，确保没有工作区测试介质、诊断产物与凭据。

## 3. 可选 Desktop 手工验收（需要另行明确授权）

**本次交付不执行安装、启停、重启或 Profile 修改。**先备份用户数据，确认唯一目标 Desktop Profile、当前正在运行的插件版本、Host 和预期升级影响；经用户单独同意后仅通过官方 `plugin_manager` 安装/启用，读取返回的 `application`、`warnings`，按其要求安排重启。切勿手工编辑 Profile、启动第二套宿主或把源码文件更新当运行时升级。替换已加载包一般需完整退出 Desktop 再打开；是否操作重启须另获授权。

验收顺序：

1. Desktop 欢迎页正常；打开真实 Desktop AI 笔记入口，确认显示 **v0.0.13 · Phase 0**，不把仍显示 0.0.12 当新包通过。
2. 打开全局和会话入口，检查只读 health/list 连接状态、空列表、关闭再打开、Esc/焦点恢复、键盘 Tab、明暗主题和窄窗口；本地草稿输入/复制、复制失败、丢弃确认/取消，确认它确实**不可保存**。不要输入敏感或不可丢失的草稿。
3. 通过已授权的 Desktop 观察路径检查官方 `POST /api/settings/describe` 在加载前、启用后和运行一段时间后仍返回 200；不能以本 GUI、旧 Web 端口或模拟 Gateway 代替。绝不提取、硬编码或拼接 token/cookie/Host origin。
4. 经另行授权后进行禁用/恢复两轮，检查入口与 Notebook 路由释放、重新启用后不重复，并再次确认官方 Gateway 正常。宿主内部 listener **归零**、当前未经认证请求仍被拒绝，需要宿主支持的观测方式与单独授权；仅凭入口消失或本地 mock 不得标为 PASS。
5. 如需验证坏请求、取消、超时、畸形响应，只在隔离介质或经单独授权的真实环境中进行；禁止对用户笔记、官方端点注入故障。

任一官方 Gateway 不可用、认证边界异常或 Desktop 启动异常，立即停止验收并保持/恢复安全的禁用状态；依照授权与官方管理器操作，不做手工 Profile 修复。验收记录分别写明源码/本地检查、打包、安装、启用、重启、实际 Host/Client 通信的状态与证据；未操作项填 NOT RUN。

## 4. 不能以此包验证的后续版本要点

要测试真正的“单 Host 手工笔记预览版”，需先把 Domain 所有权、业务路由和 Client 保存 UI 接入正式入口，再在有界隔离库验证：仅介质确实缺失才初始化；坏 Schema/未来版本不空库覆盖；新增、编辑、重启读取；两页面版本冲突；请求重试不重复；写失败/回复丢失保留草稿；容量超限拒绝；JSON 实际下载；同一介质只有一个写 Host。正式 MVP 还需损坏介质保护、受控整库恢复、迁移、标签/选区/高亮/来源/导出等验收。这些都**不能**在本 0.0.13 测试包上打 PASS。
