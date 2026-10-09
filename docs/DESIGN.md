# DSH Session Notebook：当前产品与技术设计

> 适用基线：2026-10-09 工作区 `@timestatic/dsh-session-notebook@0.0.36`；以当前 `package.json`、`src/`、测试和 [AGENTS.md](../AGENTS.md) 为依据。本文件描述**已接入的源码设计**、**尚未开放的能力**和**待真实验收的事项**，不把历史需求批准、隔离测试或旧版本实机结果视为本版发布通过。原三份 PRD/指南/计划的逐轮状态、过期 Storage Domain / TypeScript 设想已从工作树移除，可在 Git 历史查询。

## 1. 产品定位与交付范围

插件界面名「AI 笔记」，从 DeepSeek Harness 对话中保存局部引用，补充或改写正文，并在同一全局笔记库按标签、来源、时间和关键词检索、导出。TODO 是普通标签而非任务状态；不自动向模型注入笔记，不改变 DSH 会话原文或官方连接生命周期；仅在用户明确确认后可请求宿主恢复归档来源。

当前交付以**单 Desktop Host、本地文件库**为边界。Client 声明 `platform: web`，但独立 Web 尚未按本版完成安装与功能验收。不是跨设备同步、多用户协作、共享目录多 Host 同写或 Agent/MCP 工具。应用内受控整库恢复、损坏库自动修复、自动 Schema 迁移及跨设备排他暂未交付；完整 JSON 导出并不等于可在应用内恢复。规模/搜索延迟没有当前版本的产品数值验收结论。

| 用户流程 | 当前源码范围 | 边界 |
|---|---|---|
| 摘录和编辑 | 已提交 user/assistant 正文的单消息局部选区；无标签或带标签划线、补充笔记、基于原文改写、空白手工笔记 | 不伪造官方 messageId；未可靠映射原始 Markdown 时保存准确可见纯文本 |
| 整理 | 全库、会话、工作区列表；搜索、类型、时间、标签 AND/OR、无标签、回收站；批量选择 | `src/query.js` 接受归档/不可用来源筛选，但 UI 完整可用性以实际入口核对；会话活动时间缺失时拒绝“会话顺序”，不猜排列 |
| 维护 | 创建/重命名/合并/删除标签，预览影响；笔记编辑、入回收站、恢复、确认后永久删除 | 删除标签只解除关联；卡片不提供类型转换入口，尽管业务 Service 保留转换 handler |
| 来源与输出 | 会话回链、需恢复归档时确认、复制/确认写入最新输入草稿；选定笔记导出一个 Markdown 文件和完整 JSON 备份 | 不自动发送输入；定位歧义不猜位置；JSON 导入只有分块校验与替换影响预览，没有提交恢复按钮 |

以上仅说明源代码接入的能力，不代表当前包已装入 Desktop 或逐项实际操作通过；实机结论按第 8 节单独记录。

## 2. 包、宿主接缝与整体链路

- `package.json`：ESM JavaScript、Node.js `>=22`、作用域包名 `@timestatic/dsh-session-notebook`；导出 Host `src/host/index.js` 和 Client `src/client/index.js`。`cordis.patch.yml` 的 Cordis row `name` 必须与 npm 包名一致。包名**不改变**内部 RPC 命名空间 `dsh-session-notebook`、Slot ID 或现有用户存储目录。
- `dsh.bundle.patch` 指向 `cordis.patch.yml`；Web Client `immediately: true` 并声明 conversation、sidebar-right、workspace、session 激活依赖。`src/client/index.template.js` 是编辑入口，`scripts/build-client.mjs` 内联指定 ESM 模块生成 `src/client/index.js`；生产发布直接打包 JS，不编译 TypeScript，不捆绑第二套 React。
- Client 在 `sidebar.footer.action` 提供全局菜单，在原生 `sidebar.right.pane.tab` 注册笔记内容，通过 `conversation.composer.dock` 和 `shell.overlay` 接入会话选区与浮层；跟随 Cordis/Slot 生命周期释放。`docs/UI_PROTOTYPE.html` 是离线草图，非宿主 UI 或 API 合同。

```text
Client index.template.js + preview-api.js / 会话标注模块
  → connection.rpc.call('/api', 'dsh-session-notebook/<endpoint>', payload, signal)
  → 宿主 carrier / 精确 Notebook fetch 路由（admission + RPC 信封校验）
  → host/manual-runtime.js → host/preview-routes.js
  → manual-notebook-service.js → snapshot-coordinator.js
  → host/json-store.js → notes.json + data/<uuid>.json
```

Host `src/host/index.js` 先注册独立 `health`/`list` GET+POST；仅在宿主公开 `connection.admit` 可用且文件库成功打开后激活由 `manual-runtime.js` 调用 `preview-routes.js` 注册的业务 POST 路由。业务端点按源码中的 `handlers` 映射：`notes/*`、`manual/*`、`library/query`、`tags/*`、`markdown/export`、`backups/*`；不是“仅 health/list”。旧模块文件头的“not activated”注释已过时，不能推翻实际调用链。

**禁止** `rpc.intercept('/api', ...)`、在 `/api` 上注册第二个共享入口、全局 `fetch('/api/...')` 绕过 Desktop carrier，或自行获取 token/Host origin。业务 POST 使用精确 `/api/dsh-session-notebook/<业务端点>`、宿主 admission、标准 `client-request`/`server-response` 信封及相同 `rpcId`；请求正文上限 256 KiB。Client `src/client/preview-api.js` 负责 AbortSignal、超时、结构校验与安全诊断，卸载后不得将迟到结果显示为成功。曾经的冲突和失效方案见[兼容事故与测试](./evidence/compatibility-and-tests.md)；任何 Harness API 变更先 Inspect 当次目标宿主，再核对 SDK 和真实 carrier。

## 3. 领域对象与不变量

`src/notebook-schema.js` 严格验证 `NotebookSnapshot`：`schemaVersion: 1`、`epoch`、递增 `revision`、`notes`、`tags`、`settings`、`operationReceipts`。笔记 `kind` 为 `highlight`、`note` 或 `manual`；标签使用稳定 ID，来源与锚点是创建时快照，全局可见性由查询决定而非按会话分库。Host 分配身份和时间，Client 不得伪造来源或覆盖只读 Quote/Anchor/Source。

- `highlight` 有非空引用、无用户正文；`note` 同时有非空引用和正文；`manual` 有非空正文，可空白创建或携带原始引用作为改写来源。正文非空按 trim 判断，保存原字符串，不截断引用。正文修改、回收站与标签变更均不修改 DSH 原消息。
- 引用 `quote.format` 为 `markdown` 或 `plain_text`。当前会话摘录的 `notes/excerpt` 接口明确要求 `plain_text`、`anchor.exact === quote.content` 及 `source.sessionId`；**不能因为 Schema 允许 `markdown` 就声称当前摘录已经保留原始 Markdown**。`src/client/quote.js` 中的可信映射是辅助能力，具体正式通路须以 handler/调用方为准。
- 文本锚点 `exact` 保留用户原选区；至少两个非空白 Unicode 码点，默认最长 8000 码点。DOM 定位偏移是 UTF-16；重复文本仅在上下文足以消歧时恢复 CSS Highlight，不可靠时保留可读引用及来源信息而不猜首个命中。
- 标签名称 trim 后以 NFKC + trim + 小写生成规范键；每条笔记最多 10 个标签。首次创建的 TODO、重要、待验证是普通快捷标签，删除后不自动重建；标签合并/删除与笔记关联作为同一快照变更，并覆盖回收站关系。
- 普通删除先入回收站；永久删除、标签合并/删除先预览并核对提交时的版本/范围。跨会话和工作区只是查询条件；来源被归档或删除也不级联删除笔记。

## 4. 查询、前端状态与文件输出

`src/query.js` 是只读筛选/排序函数，匹配标题、正文、引用、来源和标签文字；默认 `updatedAt` 倒序并以 ID 打破平局。会话排序要求调用方提供实际活动时间投影，不可用则抛 `SESSION_ACTIVITY_UNAVAILABLE`，而非偷偷采用 sessionId 或空目录。`src/manual-notebook-service.js` 按版本读取列表和详情；前端仅缓存 UI 状态、草稿、筛选及标注 Range，不是权威库。

保存草稿须等待 Host 确认后才能清除。请求丢失响应时结果可能已经落盘：沿用相同 requestId/意图和持久收据重试，不凭超时另建笔记；版本冲突需读取新状态并让用户确认，未知提交状态冻结后续写入。关闭面板、切换会话及卸载应保护或明确提示未保存草稿；缓存草稿不等于磁盘持久化。

`src/markdown-export.js` 按明确选择和顺序生成一个 UTF-8 `.md`，包含可选标签、来源、时间和只读引用；快照版本变化、对象丢失或重复选择不得静默少导。`src/json-backup.js` 从同一已验证 Snapshot 导出完整结构（含回收站/标签/锚点）。`src/restore-upload.js` 支持分块暂存并计算替换预览，`src/restore-candidate.js` 只构造候选；业务路由中**没有真正替换库的恢复提交端点**。JSON 和 Markdown 文件都只由用户动作触发，不接收任意 Host 写入路径。

## 5. 文件库与提交可靠性

`src/host/json-store.js` 默认使用 `$DSH_HOME/storages/dsh-session-notebook/notes.json`（未设置 `DSH_HOME` 时 `~/.dsh/`）；可通过 `storageFile` 指定规范绝对路径。主元数据含引用和摘要，各笔记在 `data/<uuid>.json` 不可变文件中；元数据是唯一提交点。存储实现验证文件类型、SHA-256、Schema 和引用完整性；仅库明确不存在且 data 目录为空时创建新快照；若整个存储目录已丢失，应用无法仅凭空目录判断是否曾有用户数据，需要介质级备份与运维约束，旧整库 JSON 不自动迁移。

每次写入复用未变笔记的 data 引用，为变更笔记写入并同步新文件及目录，再同步临时元数据并替换主文件；成功后发布内存状态，回收可验证的旧引用。`src/snapshot-coordinator.js` 串行化候选修改、核对 epoch/revision/version、持久化收据；I/O 成败不明时停写，绝不报告安全回滚。有效元数据和引用 data 合计技术限额 50 MiB，收据最多 100000 条/16 MiB；不以这些限额宣称任意规模的性能达标。

固定路径 sentinel 与进程内所有权只提供受控本机介质的 fail-fast 边界：第二写者拒绝，异常退出的残留不能自动删除；共享目录、跨设备以及恶意同 UID 替换不能据此认定安全。坏库、缺失已引用 data、不支持版本和提交未知时不能初始化空库、自动接管或写入真实用户介质做故障实验。应用内修复/恢复必须单独设计原始介质保护、预览确认、版本代际切换和失败回滚，并取得实机证据，当前**尚未实现**。

## 6. 开发与扩展边界

复用现有 ESM 模块，不按旧方案迁移 TypeScript/Storage Domain/SQLite/worker，也不因历史 Step 未完成而重建已运行模块。新增业务接口须同时核对 Host route、Service、Client adapter、生成后的 Client 入口、测试模拟器和 Desktop/Web carrier；新增共享资源必须验证所有权、加载顺序、清理及认证边界。来源回链不得调用会唤醒 Agent 的消息操作；归档恢复先确认，输入框追加/替换绝不自动 submit。UI 遵循宿主主题 token、焦点管理、响应取消与卸载清理，不接管 app root。

需要重新使用 Harness Service/Event/Config/Slot 时先按 [AGENTS.md §2](../AGENTS.md) 加载插件开发资料、`cordis_inspect_list` 再精确查询；Inspect 只用于只读发现，历史声明和普通 mock 不能替代当次合同。

## 7. 测试与打包

修改模板或任何被内联 Client 模块后先执行 `npm run build:client`；随后运行：

```bash
npm run check        # 生成文件一致性与发布入口 JS 语法，不是 typecheck
npm test             # node:test 单元测试
npm run pack:check   # npm pack --dry-run --ignore-scripts，检查发布清单
git diff --check
```

额外：涉及业务路由/文件库跑 `npm run test:integration`；涉及 Cordis 加载/卸载跑 `npm run test:runtime`（先安装 `tests/runtime` 的锁定依赖）；涉及 UI 的隔离脚本/合成检查与 Desktop 人工检验分别记录。部分单测要求匹配目标版本的本地 `.sdk-reference/`。`package.json` 的 `files` 白名单不包含 `docs/`、测试或 SDK 参考包。npm 缓存不可写时用可写临时 `npm_config_cache`，不更改全局权限。打包与授权安装的唯一权威步骤见 [AGENTS.md §9](../AGENTS.md)，不手工修改 Profile。

单测需覆盖：禁用 `/api` 共享拦截器、SDK 通道语法、精确业务 handler 往返和 Gateway 注册顺序、至少两轮加载卸载、无鉴权/畸形请求/取消/超时/迟到响应、失败保护与重复意图收据。模拟 Gateway 和临时文件往返**不等于**真实 Desktop 网络或 Web 行为。

## 8. 验收与后续事项

工作区源码版本 `0.0.36` 的安装、启用、重启读回及实际通信状态必须由当前宿主重新确认；历史 `0.0.12` 的 Gateway/入口结果不可借用。正式宣称 Desktop 可用前需：欢迎页正常；启用期间分时新 `POST /api/settings/describe` 均 200；Notebook 显示预期版本，health/list 经 carrier 返回有效结构；新建/编辑/标签/摘录高亮/来源/导出及重启读回真实可操作；禁用后 Gateway 仍好；未认证访问仍被拒绝。重启、启停、安装及 Profile 变动各自先取得授权，测试完恢复状态。参见[Desktop 验收清单](./evidence/first-mvp-desktop-test-checklist.md)。

后续能力需另立明确范围：受控整库恢复与损坏介质保护/迁移、跨 Host 或共享介质一致性、独立 Web 正式验收、性能/容量数值门禁、尚未接入 UI 的查询/菜单选项。**不得将“代码存在”“测试通过”或旧 PRD 的 Approved 状态写成该能力已经发布通过。**
