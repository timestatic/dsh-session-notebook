# Harness 兼容性与测试证据摘要

> 本页压缩历史 Step 0–2、存储与 UI 逐轮日志，只保留能指导当前开发的**契约、事故和验收边界**。当前工作区实现以[现行设计](../DESIGN.md)和源码为准，历史测试数字不代表当前版本或 Desktop 实机通过。旧记录可在 Git 历史中按文件名查找；本页不是对它们逐字保全。

## 宿主兼容：不可回退的结论

- Desktop `0.2.0-rc.2` 上，旧版 `0.0.8` 注册第二个共享 `/api` interceptor 后，官方 `POST /api/settings/describe` 曾由 200 变 404；移除 Bundle 后恢复。后来 `0.0.9` 提出的 `/rpc/dsh-session-notebook` 多段 channel 被 SDK 单段校验拒绝；`0.0.10`/`0.0.11` 的 `rpc.handle` 方案在实机触发 `webServer` 注入失败，添加调用者 inject 仍未解决。当前采用 `connection.fetch.register` 的精确 Notebook 路由，Client 保持 `rpc.call('/api', ...)`。完整事故因果和阶段结果见 [Gateway](./api-gateway-conflict-fix.md)、[channel](./channel-contract-fix.md)、[注入](./caller-injection-fix.md)、[精确 POST](./exact-post-fix.md)；其中旧修复**不是可复用方案**。
- Host 必须有宿主公开的 admission 才开放业务写入，不能自拼 Desktop token、请求地址或接管官方 Gateway。GET/POST 与业务端点、RPC 信封和卸载活动门的现行实现以 `src/host/index.js`、`src/host/preview-routes.js` 为准；Client 以 `src/client/preview-api.js` 为准。
- 旧 Desktop Step 0–2 门禁曾记录 `0.0.12` 人工观察：真实窗口版本/入口、health/list、深浅主题与导航、启用及禁用期间新请求 `POST /api/settings/describe` 200；另有当时的匿名 health/list 401 记录。它们是**历史特定版本与人工证据**，并非当前工作区包的安装、认证或稳定性结果；内部监听器零泄漏也未由窗口可见性证明。

## 存储选型：保留的决策

- 早期 Storage Domain 隔离实验发现独立 Host 可能丢更新；旧锁/worker 路线存在释放锁后目录同步失败导致第二写者可进入的窗口。原 Storage Domain ADR、实验日志和工作区原型不是正式产品路线；不得据此恢复实验 backend、覆盖宿主存储或宣称跨 Host 安全。
- 2026-10-06 转向专属文件存储：`notes.json` 元数据作为提交点，`data/<uuid>.json` 存不可变笔记；失败、介质损坏、残留 sentinel 不被当作空库或自动接管。参见[文件存储决策](./lightweight-notebook-0.0.16.md)及当前 `src/host/json-store.js`。该文档的 0.0.16 测试数据与旧打包路径仅属当时版本。
- 工作区源码当前提供完整 JSON 导出及导入影响预览，**尚无应用内整库恢复提交入口**。不因旧恢复方案有草案或单测候选就标记已交付；单 Desktop/单库边界和 50 MiB 技术预算见[当前架构](../developer/architecture.md)。

## 回归矩阵及真实验收

| 层级 | 核对点 | 不能推导 |
|---|---|---|
| 单测 `npm test` | 共享通道守卫、SDK 通道语法、精确路由/Gateway 先后顺序、参数/认证/取消/超时/畸形响应、两轮卸载、文件库故障保护 | 模拟 Gateway 不等于 Desktop 真正 HTTP 200 |
| 隔离业务 `npm run test:integration` | Host handler 与 Client carrier 契约、保存后重开、路由/存储故障 | 不等于 Desktop 认证/窗口/持久化验收 |
| Cordis `npm run test:runtime` | 正式入口在测试 Context 中加载/卸载与资源回收 | 不等于实际 Desktop 连接 Registry |
| 打包 `npm run pack:check` | 发布文件清单 | 不等于安装、启用或重启后运行 |
| 真实 Desktop | welcome、启用及禁用后分时新 POST `settings/describe` 200、Notebook 版本和 health/list、未认证拒绝、真实保存与重启读回、面板/高亮重挂载 | 必须在当前包、当前 Harness/Profile 下重新执行并记录版本、时间、结果 |

应用内故障注入仅用隔离测试介质，不对用户数据做损坏试验。安装、启用/禁用、重启或 Profile 变更均需单独授权。具体人工用例见[Desktop 验收清单](./first-mvp-desktop-test-checklist.md)；正式安全和发布门禁以 [AGENTS.md](../../AGENTS.md) 为准。
