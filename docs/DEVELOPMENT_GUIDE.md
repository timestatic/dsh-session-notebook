# DSH AI 会话笔记本：技术设计与逐步开发验证指南

> **当前执行主线（2026-10-05）：[第一版可靠 MVP：收敛开发计划](./FIRST_MVP_PLAN.md)。** 用户要求收敛实现、加速交付。本指南保留历史方案、宿主合同与详细验收参考；旧 Step 顺序、自建锁/worker/SQLite/大库专项不再作为单 Host 第一版功能开发的前置任务。冲突时按新计划的执行顺序推进，产品语义仍以 PRD 为准，AGENTS.md 的宿主资源和安全约束继续生效。正式 MVP 仍需完整恢复与真实 Desktop 验收，不能以预览测试代替。

> 版本：Draft v0.3 · 编写日期：2026-10-02 · 更新：同步 PRD 决策与 MVP 受控恢复\
> 依据：[产品功能文档](<./PRODUCT_REQUIREMENTS.md>)（v1.0 / Approved；需求准出不等于技术验收通过）\
> 交付性质：开发方案，不代表插件已经实现、安装或通过测试。\
> 当前平台范围：2026-10-03 用户决定暂缓独立 Web，优先 Desktop 开发与阶段交付；下述范围调整优先于本文历史双端门禁。

### 当前范围调整：Desktop 优先（2026-10-03）

- 用户最新要求“先放弃 web 端，继续开发桌面端”。解释为暂缓独立 Web 3080，不删除共享 Client 实现或永久取消未来 Web 支持。旧 Web 不升级、不安装、不改 Profile，全部既有插件保持不变。
- Step 0–2 的当前阶段门禁改为 **Desktop 正式持久 Bundle 加载、真实窗口可见、生产 carrier health/list、官方 Gateway 共存、认证与生命周期**；完成这些 Desktop 门禁即可进入 Step 3 的专用存储实验，不再等待独立 Web 安装。
- Step 3–14 的正式 MVP 可靠性、安全与产品不变量保持不变；2026-10-05 新增的受限预览交付阶段允许完整恢复等能力后移，详见 §2.3、Step 3A，不得将预览版称为正式 MVP。当前实际 UI、输入框、来源与文件验收先在 Desktop 执行。Step 15 当前正式发布范围为 Desktop，明确声明独立 Web 未验收/暂不支持，禁止宣称双端通过。
- 本文后续“双端均通过”是历史完整目标，当前仅对 Desktop 生效；未来恢复独立 Web 支持时必须补齐原有 Web 门禁，不能借用 Desktop 结果。
- 暂缓 Web 不等于 Desktop 已完成验收，也不豁免安装、启用、禁用、重启的授权要求；不在真实笔记介质做故障实验。

## 1. 如何使用本文

本文将产品功能拆解为按依赖顺序推进的实现任务。每一步都包含实现内容、验证动作和完成门禁。开发时按顺序执行：

```text
确认宿主能力 → 双端空插件 → 存储可靠性 → 最小保存闭环
→ 选区与引用 → 高亮 → 编辑与回收站 → 标签与查询
→ 来源回链 → 导出与备份 → 迁移与故障测试 → 双端发布验收
```

不要先完成所有 UI，再补存储、版本冲突和安全测试。首个写入操作就必须走最终的可靠保存链路。

本文使用三类标记：

- **已发现**：本次通过当前连接页面的 DSH Inspect 读取到声明、签名或 Slot；不等于已执行业务调用。
- **设计建议**：本插件拟实现的接口、数据、代码组织和测试，不是宿主已有 API。
- **待验证**：需要在实现阶段读取包文档/类型或实际实验后确认；不得直接作为保证。

### 1.1 仓库实际状态

截至 2026-10-05 本次检查结束，工作区包版本为 `0.0.14`；Desktop 安装版本仍以历史 `0.0.12` 记录为准，未在本次重新读取。正式 Host/Client 仍是加载与通信 Spike，尚无可用笔记存储或保存功能。已有未挂载业务模块、工作区隔离存储原型及独立完整 Cordis 测试工程，后者有锁定依赖与锁文件，不进入生产包；根工程有 `test:runtime` 和 `test:integration` 入口。尚无编译、lint 或类型检查脚本。当前批次和完成定义以[收敛计划](./FIRST_MVP_PLAN.md)为准。

- Desktop 已有正式安装、生产连接、主题/布局/键盘、上下文切换及两轮启停的手动验收记录。Round23 补齐启用状态下分时两次 `POST /api/settings/describe` HTTP 200。
- 禁用期间 Gateway 的新 POST HTTP 200 已有本会话用户手动证据及官方管理器 disable/restore applied/warnings=[]；实际路由释放、监听器和当前认证证据仍须按[Desktop 门禁矩阵](<./evidence/desktop-step-0-2-gate.md>)补齐或明确范围。Step 0–2 尚未全部关闭。
- Step 3 已完成 SDK/真实隔离介质、独立子进程、完整 Cordis Context、worker 所有权与容量实验，形成[PROPOSED 存储 ADR](<./evidence/storage-adr.md>)。约219.3MiB完整样本证明主线程阻塞风险，worker改善父线程响应但内存/恢复/实际Desktop重启仍未通过。**新增发布阻断**：隔离写锁删除后目录同步失败时，关闭返回失败、worker exit 0，第二写者仍可取得锁；固定 `RELEASE_UNKNOWN` 只改善诊断，不修复互斥。正式存储根、跨进程代际交接与离线恢复方案仍未批准；见[运行时门禁](<./evidence/storage-runtime-gate.md>)与[恢复设计](<./evidence/storage-recovery-design.md>)。没有安装存储实验Bundle或开放保存，Step 3 未关闭；Step 4–15 生产业务尚未实现。
- 工作区新增未挂载的手工笔记服务、精确业务 RPC 路由与 Client carrier 适配；`npm run test:integration` 在隔离介质上贯穿 Cordis Domain、完整 Snapshot、业务服务、真实业务 handler、Client RPC 适配及关闭重开。包内包含集成入口、Host admit 认证/信任门禁及 Client 丢失响应保草稿/同请求 ID 重试控制器；提交后取消不会伪装回滚。以上只在隔离测试验证。正式 Host 仍只开放只读 health/list，正式 Client 草稿仍不能保存；没有经核实的生产单写 Host/Domain、实际写路由激活、Desktop 写入/重启验收，不能据此关闭 Step 3A/4。
- 本文后续 TypeScript、共享 Schema 和目录结构仍是业务阶段方案，不代表当前加载 Spike 已采用这些模块。
- 原型仅用于理解交互，不应嵌入 DSH iframe 或替换宿主页面。
- 安装、启停和重启遵循授权与官方管理器要求。历史连接地址不能作为当前窗口或 Host 身份证明。

## 2. 范围、边界与决策

### 2.1 MVP 不能删减的闭环

1. 用户/Assistant 消息局部选区；无标签划线和快捷标签划线。
2. `note` 补充正文；`manual` 空白新建与基于原文改写。
3. 原始引用只读，正文独立编辑；Markdown 可靠时保留，否则显式纯文本降级。
4. 持久高亮、当前会话与全局列表、当前工作区筛选。
5. 标签创建、重命名、合并、删除、AND/OR 筛选和搜索。
6. 活跃/归档来源回链，删除会话后快照仍可读。
7. 单条/批量删除二次确认、回收站及恢复。
8. 勾选记录生成一个 UTF-8 Markdown 文件，另提供完整 JSON 备份与 FR-104A 受控整库恢复。
9. 可靠本地持久化、版本冲突、Schema 迁移、损坏保护。
10. Web/Desktop 独立通过核心流程验收。

### 2.2 已确定的 MVP 产品决策

2026-10-02 用户确认按评审解释中的建议修改，规则已写回 PRD §17.1，当前基线为 v1.0 / Approved（2026-10-02 需求准出）。以下是产品决定，不代表宿主能力已验证；技术门禁仍执行。

| 问题 | 已确定结论 | 实现约束 |
|---|---|---|
| 包名与界面名 | `dsh-session-notebook` / AI 笔记 | 发布前核对 npm 名称可用性 |
| 编辑器 | Markdown 文本编辑 + 预览切换 | 无所见即所得，不强制分屏 |
| note 正文 | 保存须同时有非空 Quote 与非空正文 | 空编辑草稿不落库，转换成功才改类型 |
| 引用长度 | 默认 8,000 Unicode 码点 | 超限提示阻止保存、保留选区、不截断；Host 校验最终 Quote |
| Markdown 降级 | 用户所选准确纯文本 | 不替换整条消息，不冒充源 Markdown |
| 默认快捷标签 | TODO、重要、待验证 | 稳定 Tag ID；删除后不自动复活 |
| 标签去重 | 显示名 trim；键为 NFKC + trim + toLowerCase | locale-independent；内部空白不折叠，冲突提示合并 |
| 回收站 | 普通删除必入，无自动过期 | 永久删除单独确认 |
| 导出排序 | 沿当前列表顺序 | 无默认会话分组模板 |
| 输入框写入 | MVP，确认追加/替换最新草稿 | 不自动发送/唤醒 Agent |
| 整条消息保存 | P1 | 不代替局部选区 |
| Tool、标签颜色编辑、Agent Tools/MCP | 不进入 MVP | 颜色可选字段仅保留兼容 |
| JSON 恢复/导入 | FR-104A 整库恢复必须；FR-104B 增量合并 P1 | 严格校验、预览、确认、保护介质、整体提交、回滚 |
| `notes.archive` | MVP 不实现 | 已从 PRD 候选接口移除，与来源归档分开 |

新增决策或删减 MVP 必须获用户确认并同时修改 PRD 与指南，不再把上表列为“待产品确认”。

### 2.3 新增交付阶段：Desktop 单 Host 便签预览版（2026-10-05）

用户同意先采用轻量存储路线，在对照项目“单 Host 管一份库、写操作串行”的思路上优先实现可保存的垂直闭环，**将完整受控恢复等正式 MVP 能力后移**。这是新增的受限预览交付阶段，不是宣布 PRD v1.0 的正式 MVP 已改完或准出；PRD §6.10、FR-103、FR-104A 及 AC-022 仍是正式 MVP 的目标与门禁。若要永久删减这些产品要求，须单独更新 PRD 并再次确认。本指南中 Step 3 的跨 Host/锁交接/最大容量实验、Step 14 的损坏保护与恢复等完整门禁仅约束正式 MVP 发布，不再全部阻断**受限预览版**源码闭环；预览版自身门禁见下文 Step 3A/4。

预览版能力：仅 Desktop 本机、明确的单 Host/单 Profile/单存储实例，先做手工新增、列表、编辑、刷新和重启读取、版本冲突拒绝、失败保留草稿、损坏/未知版本停写、完整 JSON 导出。不得宣称支持两个 Host 同时打开同一库、跨设备/共享目录、自动故障接管、损坏介质受控恢复、迁移或 5,000 条最大样本可用；这些能力缺失须在界面和交付说明中显式标注。JSON 导出不等于保护原始损坏介质或提供可操作的恢复入口。预览版也不得对用户真实数据做故障注入。

预览版**不是无条件开放写入的例外**：先确认 Desktop 的真实存储实例边界，确保部署/操作上可执行唯一写 Host；仅写免责声明、实例内队列或 revision 字段不能阻止第二 Host 对同一介质写入。如果无法明确限制为单 Host，或产品要求同时写同一库，就停在只读状态，先解决排他/一致性，不通过弱化测试来开放保存。存储根由 DSH 管理，不自建锁文件、worker、SQLite、shell fallback 或裸 JSON 主文件。现有隔离实验和事故证据保留，不按此提议改写成“已通过”。安装、启停、重启、Profile 及真实 Desktop 操作仍须各自授权。

## 3. 当前 DSH 能力检查结果

### 3.1 已发现接口与限制

本次使用 `cordis_inspect_list`，再按精确 Provider/方法查询。检查时间为 2026-10-02；只代表当前连接页面与当前 Host 组合。未独立连接 Desktop 客户端验收，也没有业务写入测试。

| 能力 | 已发现的声明 | 不能推导的保证 |
|---|---|---|
| Host 存储 | `ctx.storageDomain.open(spec)`、`get(name)`、`closeAll()` | 不能推出 CAS、跨进程排他、掉电耐久、多记录事务 |
| Domain | `global.get()/set(value)`、`table(name)`、`close()` | `set` 返回 Promise 不等于已证明 fsync/原子性 |
| KV 表 | `get/entries/keys/size/put/delete/update` | `update` 签名没有 expectedVersion；不能当成存储 CAS |
| DomainSpec | `name/version/layout/compatibleVersions/global/tables/invalidRecords` | `layout: 'single'` 不等于多表事务 |
| 空间隔离 | facility 内同名 Domain 二次 open 报 `already-open` | 仅一个 facility 实例的限制，不是多 Host 锁 |
| 错误处理 | open 校验已有记录，可能报 `version-mismatch`、`malformed-medium`、`invalid-record` | 必须验证底层原始介质保留与备份能力 |
| 选区浮层 | `shell.overlay`，list、root scope，以独立 `id` 注册 | root Slot 不提供当前会话 `sessionId`，需要桥接 |
| 会话控制锚点 | `conversation.composer.dock`，list、session scope | 不是官方消息 DOM 定位接口，向上查容器仍有兼容风险 |
| 右侧内容 | `sidebar.right.pane.tab`，keyed、session scope | 仅注册内容不能创建 Tab；Tab 类型/实例 API 仍未确认 |
| 消息操作 | `conversation.chat.assistant-actions` owner prop 提供 `messageId` | 不证明用户消息有同样操作区或所有 DOM 都暴露 messageId |
| Slot 会话属性 | 上述 session Slot 暴露 `sessionId`、`useSession`、`useChat`、`useWorkspaces`、`inputActions` 等 | Hook/Action 的具体签名仍需类型读取，不能直接猜 `setDraft` 入参 |
| 来源读取 | Host `sessionQuery.readSession/readSurface/readEvent/readTitle/listSessions` | `SessionRecord` 没有 archived 字段；不能用它判断归档 |
| 冷会话读取 | Host `sessionController.inspect` 和 Remote `page/follow/projections` | 阅读数据不应调用 `resolveAgent` 恢复 Agent |
| 当前客户端导航 | Client `uiWorkspace.openSession(target)` | 返回 void 不代表历史消息已挂载或滚动完成 |
| 恢复归档 | Client `uiWorkspace.unarchiveSession(sessionId)` | 必须确认后调用；直接打开归档是否可行仍待实测 |
| Host 归档操作 | `workspaceRegistry.archiveSession/unarchiveSession` | list 返回 Workspace，但公开的此次类型未给出归档集合读取方法 |
| 通信底座 | Host `connection.rpc.handle/intercept`、`connection.fetch.register` | Client 端调用匹配通道与生成 Remote 的构建步骤仍需确认 |
| 动态 Client builtin | `host.call(method,args)` | 属于动态执行能力，不能默认套用于持久 npm Bundle |
| Client 模块 | 模板使用 `window.__ModuleLoader__.load`，factory 内 `require('react')` | Desktop 是否同样消费 `platform: web` 仍需验证 |

**重要结论：** 目前已发现足够的接缝用于启动技术 Spike，但存储可靠性、完整 Tab 注册、消息 DOM 身份和双端加载还未满足 Phase 0 完成条件。

### 3.2 实施时的接口发现顺序

1. `cordis_inspect_list` 获取精确 Provider；不能把 Inspect 方法当业务服务调用。
2. `Service.listService({})` 查服务目录，再对选定 key 查询完整合同。
3. `Slots.listSubTree({ root: ... })` 查询目标 Slot 的注册选项、owner props、scope。
4. `Config.listConfigs({ name: ... })` 找 entry，再按 entry 查 `packageDir`。
5. 读取该目录 README，必要时读取 `lib/types/**/*.d.ts` 和具体实现。
6. 对需要订阅的事件先查 `Event.listEvents`，确认名字及派发模式；本文不预造事件名。
7. 保存能力检查证据，并实际跑最小调用和失败分支。

本次检查得到 Storage Domain 包目录为：

```text
/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-storage-domain
```

读取 DSH 安装根 manifest 时文件读取工具报错 `Cannot mix BigInt and other types`，因此本文不声称已确认 DSH 版本、具体构建工具或底层存储实现。开发时应通过可用的版本信息与包读取入口补齐；不绕过文件沙箱、不用 shell 尝试解包读取。

### 3.3 主题与 UI 原则

当前 Theme Inspect 已发现可用 token 示例：

```css
.sn-panel {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l1);
}
.sn-muted { color: var(--dsw-alias-label-secondary); }
.sn-popover { background: var(--dsw-alias-bg-overlay); }
```

- React 由 Client 模块表提供，不捆绑第二份 React，不从 CDN 读取。
- 不导入 Harness 内部 Client UI 组件包；自有控件匹配原生主题、焦点和布局模式。
- UI 通过 Slot 贡献，不接管 app root，不向 `document.body` 挂第二套应用。
- 可见文字走 Client locale；深浅主题均需测试。
- `ctx.slots.inject(ownerKey, callback)` 中注册 UI，遵循 owner 生命周期。
- 定时器、监听器、观察器、Domain、RPC 注册都需要 context effect cleanup。

## 4. 推荐技术架构

### 4.1 技术栈（业务阶段建议；当前加载 Spike 使用 JavaScript）

- TypeScript：Host、共享 Schema、导出器、Client Adapter。
- React：共享界面；实际运行时由 DSH 提供。
- Zod 或与宿主兼容的 Schema 工具：DomainSpec 校验与 RPC 入参校验；必须确认版本兼容。
- AST Markdown parser：只在可靠映射需要时引入；禁止依靠正则重建复杂 Markdown。
- Node 测试运行器或 Vitest：根据最终依赖和构建模式选择一种。
- Playwright：Web 行为回归；Desktop 按可用自动化接缝补充真实窗口测试。
- 主存储：DSH Storage Domain；不加入独立 SQLite、ORM、逐笔记文件或磁盘搜索索引。

### 4.2 模块边界

```text
共享 Client UI / Selection / Highlight
              │
          DshAdapter
              │ 经验证的 Remote/RPC
              ▼
Host NotebookService（统一入口、校验、版本、幂等）
      ├── SourceAdapter（只读会话数据）
      ├── Query / MarkdownExporter / Backup
      └── Repository（串行候选提交）
                    │
          DSH Storage Domain
```

Host 是插件笔记权威数据源。DSH 会话日志是消息源数据权威来源；两种权威数据职责不同，笔记不写回消息，也不作为新自定义会话事件插入日志。

Client 只维护筛选、选区快照、编辑草稿、列表缓存和临时 Range。切换会话只切换筛选条件，不切换 Notebook Domain。

### 4.3 拟建目录

以下是业务阶段计划目录；当前仅已实现 Host/Client JS 入口、locale 与部分测试，未实现 service/repository/shared 等业务模块：

```text
package.json
cordis.patch.yml
src/
  host/
    index.ts              # Host apply、注入和资源释放
    service.ts            # NotebookService
    repository.ts         # Storage Domain 读写、候选提交
    transport.ts          # 经验证的 Remote/RPC 绑定
    sources.ts            # 会话源数据与来源状态适配
    migrations.ts         # 版本迁移
  shared/
    schemas.ts            # Note、Tag、Snapshot、DTO
    query.ts              # 内存筛选、排序、搜索
    export-markdown.ts    # 纯函数 Markdown 输出
    backup.ts             # JSON 完整备份
  client/
    index.ts              # Client factory 与 Slot 注册
    adapters/             # DSH 接缝、双端能力差异
    selection/            # SelectionCapture、MessageResolver、QuoteMapper
    highlight/            # 文本索引、Range、命中检测、重绘协调
    ui/                   # Panel、Editor、TagManager、ExportDialog
locale/
  zh.json
  en.json
tests/
  unit/
  integration/
  e2e/
  fixtures/
docs/
  evidence/               # 以后生成的能力证据、故障记录、验收报告
```

不先建设通用数据库框架或庞大平台抽象，只隔离实际不稳定的 DSH 接缝。

### 4.4 Bundle 起点

下面是最小加载示意，不是完整可运行产品清单。最终依赖、peerDependencies、产物格式、generated Remote 注册必须在 Step 1 后确定。

```json
{
  "name": "dsh-session-notebook",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./dist/host/index.js",
    "./client": "./dist/client.js"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": ["@deepseek-ai/dsh-client-ui-conversation"]
    }
  }
}
```

```yaml
- insert:
    - id: session-notebook
      name: dsh-session-notebook
      config: {}
```

必须补齐实际用到的 Client 激活依赖；上例仅反映已读取模板，不能证明右侧栏注册完整。元信息使用 locale 的 `meta.title/description`，图标通过 manifest 顶层 `icon` 相对路径提供。

Host 可使用 `export function apply(ctx, config)` 与 `export const inject`；不要混用不同插件导出形式。配置通过 Config 暴露引用长度、快捷菜单设置等，并验证最终 Schema。

## 5. 数据模型与业务合同

### 5.1 持久对象

复用 PRD 第 9 节的 `NoteRecord`、`TagRecord`、`QuoteSnapshot`、`TextAnchor`、`NoteSource`，不再新增 `scope` 或持久化 `normalizedText`。

建议增加一个整体提交封套：

```ts
interface NotebookSnapshot {
  schemaVersion: 1
  revision: number
  notes: Record<string, NoteRecord>
  tags: Record<string, TagRecord>
  settings: {
    quickTagIds: string[]
    recentTagIds: string[]
    maxQuoteLength: number
  }
  // 只保存必要的重试收据，限制条数/体积，不保存任意 RPC 数据。
  operationReceipts: Record<string, {
    payloadHash: string
    resultNoteId?: string
    committedRevision: number
  }>
}
```

推荐先尝试在 Domain 的一个记录中保存 `NotebookSnapshot`，一次 `put` 提交笔记、标签、设置和必要幂等收据。是否采用该方案，必须由 backend 原子性、容量和性能测试决定；不因为提供 `put` 就假定合格。

Domain 的介质 `version` 与 Snapshot 的业务 `schemaVersion` 是两层版本，迁移时需分别处理。不要认为设置 `compatibleVersions` 会自动转换业务记录。

### 5.2 不变量

- `highlight` 必须有非空 Quote，不允许承载用户正文。
- `manual` 必须有非空正文；是否为改写由是否携带 Quote 表达，不新增 NoteKind。
- 持久化 `note` 必须同时有非空 Quote 与非空正文；正文 trim 仅用于非空判断，保存原串。空草稿/失败转换不落库、不自动降为 highlight。
- 修改接口只接收标题、正文、tagIds 等可编辑字段，不能覆盖 Quote、Anchor、Source 或 createdAt。
- highlight 转换保留 ID、来源、标签和创建时间；退回 highlight 必须显式确认正文移除。
- `tagIds` 唯一且不引用已删除标签；每条最多 10 个。
- 标签显示名 trim 后不超过 32 Unicode 码点；名称键为 `displayName.normalize('NFKC').trim().toLowerCase()`，locale-independent，内部空白不折叠；新建/重命名去重，冲突不自动合并。
- TODO 是普通稳定 ID 的标签，没有完成状态、截止日期或任务状态机。
- 创建时间、ID、version、createdBy 由 Host 分配；MVP 不信任 Client 任意写 `createdBy: agent`。
- 时间保存 ISO 8601；导出转为明确带时区的展示时间。
- 偏移统一使用 JavaScript UTF-16 索引，与 DOM Range 一致；有效字符计数另用 Unicode 码点规则。测试 emoji、组合字符和 CRLF。
- Anchor 偏移的文本串必须由统一索引器生成；不得将 `innerText` 偏移直接当 `textContent` 偏移使用。
- 源会话删除、归档或工作区注销，永不级联删除 Notebook 数据。

### 5.3 建议业务 API（插件自定义，不是 DSH 已有 Service）

| 操作 | 关键入参 | 结果/规则 |
|---|---|---|
| `notes.list/get` | Filter、游标/limit、id | 返回记录/摘要、revision；回收站默认排除 |
| `notes.create` | requestId、kind、正文、引用候选、标签 | Host 校验、生成 ID；相同请求重试得到同一结果 |
| `notes.update/convert` | id、expectedVersion、允许字段 | version + 1；Quote 等快照不可编辑 |
| `notes.trash/restore` | IDs 与各自 expectedVersion | 批量整体提交；删除需 UI 确认 |
| `notes.deletePermanently` | IDs、预览对应版本 | 独立确认；不得修改 DSH 来源 |
| `tags.create/rename` | 名称、expectedVersion | 同 normalizedKey 去重或提示冲突 |
| `tags.merge/delete` | 标签 ID、expectedRevision、影响预览 | 整体修改 notes/tag/settings/recentTagIds |
| `sources.resolve` | 唯一 sessionIds 或 noteId | 分开返回存在性、归档状态与定位能力 |
| `exports.markdown` | selectedIds、选项、排序序列 | 单一 .md 内容、文件名、数量、revision |
| `backups.exportJson` | 无任意路径参数 | 业务 Schema、全体记录、回收站、设置和完整锚点 |
| `backups.restoreJson` | 完整校验备份、预览 token、expectedEpoch/revision | MVP；预览确认 → 保护旧介质 → 版本核对 → 整体提交 → 新代际；通用合并 P1 |

建议返回可判别错误：`VALIDATION_FAILED`、`VERSION_CONFLICT`、`PERSIST_FAILED`、`STORAGE_UNAVAILABLE`、`CORRUPT_DATA`、`UNSUPPORTED_SCHEMA`、`SOURCE_UNAVAILABLE`。它们是本插件代码，不冒充 DSH 标准错误码。

批量操作先预览影响数量及对象，提交携带预览 revision；数据变化则要求重新预览，不静默作用于变化后的集合。

### 5.4 一次修改的可靠链路

```text
校验入参 → 进入 Host 串行队列 → 查幂等收据
→ 校验 expectedVersion / expectedRevision
→ 克隆旧快照并计算候选 → 校验完整候选
→ await 持久化整体提交 → 更新权威缓存
→ 发布 revision / 返回成功 → Client 清除草稿并刷新
```

伪代码（`persistSnapshot` 是插件封装，不是宿主现成方法）：

```ts
return mutationQueue.run(async () => {
  const current = authoritativeSnapshot
  const prior = lookupReceipt(current, request)
  if (prior) return prior
  checkExpectedVersions(current, request)
  const candidate = buildCandidate(current, request)
  validateSnapshot(candidate)
  await persistSnapshot(candidate)
  authoritativeSnapshot = candidate
  notifyCommittedRevision(candidate.revision)
  return resultOf(candidate, request)
})
```

必须同时验证 Domain/backend 的缓存更新时机。插件权威缓存最后更新并不能修复一个“失败时底层 Domain 已提前改缓存”的实现。

- 同一 Host 的不同页面通过同一服务队列写入；记录 version 控制同一记录冲突，全库 revision 控制关联批量修改。
- 相同 requestId 不同 payload 必须拒绝；重复点击、断线后重试不得重复生成笔记/标签。
- 写入响应丢失时结果可能“已提交但客户端未知”，用 requestId 查询/重试确认，不能盲目创建新请求。
- 幂等收据需持久化并明确有限保留窗口；过期请求不能承诺永久去重。
- 仅依靠内存队列无法跨 Host 安全。正式 MVP 若允许同一介质多 Host，必须经验证共享排他或原子 CAS，或可靠地使第二写者拒绝。Step 3A 预览版只允许**能在部署和运行中核实并维持**的单 Host/单 Profile 边界；若无法保证该边界则不开放写入。revision/version 只处理同一 Host 内的陈旧请求，不是跨 Host 栅栏。
- 断开连接/后台标签页重新可见时重新拉 revision；优先用已验证订阅机制同步，不能假设存在 Notebook 事件。

## 6. 一步一步实现与验证

### Step 0：建立开发证据与测试样本（Phase 0）

**实现动作**

1. 记录 Web/Desktop 的 DSH 版本、操作系统、Host、Profile、连接 URL 与存储实例边界；敏感 token 不写报告。
2. 列出关键能力：加载、Slot、Tab、消息 ID、Markdown、输入框、归档、存储、下载、剪贴板。
3. 创建受控测试会话和 Fixture：跨加粗、重复文字、链接、代码、列表、表格、emoji、长消息、归档与删除来源。
4. 建议建立 `docs/evidence/phase-0.md`，每项记录“声明证据 / 实验步骤 / 实际结果 / 限制”。

**验证**：对照第 3 节重新查询当前宿主，确认 Slot 与 Service 仍存在，未发现的类型标记待查。

**完成门禁**：没有将“接口存在”误记为“功能通过”；没有使用用户真实笔记做故障试验。

### Step 1：空 Bundle 与双端加载（Phase 0）

**实现动作**

1. 创建最小 manifest、Bundle patch、Host apply 和 Client factory。
2. Client 先注册 composer dock 内一个简单入口和 overlay 内一个可关闭空浮层，不制作独立预览 app。
3. 所有 ID 使用插件前缀，不覆盖 shipped 插件的 key/id。
4. 配置 locale、图标和必要的运行时依赖；本地构建后确认发布包含 patch、Client、Host 产物。
5. 经用户授权后用 `plugin_manager.install_bundle` 安装工作区包，不手工写 Profile manifest/patch，不在 Profile 跑 pnpm。
6. 读取安装返回的 `application` 与 `warnings`。`restart-required` 必须重启；新安装和替换包的加载语义不同。
7. 在 Desktop 的实际安装入口与 Profile 中独立操作，不能用 Web 注册结果替代。

**验证**

- Host 与 Client 均激活；Inspect 中能找到新的 Slot occupant。
- 当前真实页面/窗口能看到入口；关闭和重新打开正确，无 `slot entry crashed`。
- 卸载/禁用后监听器、样式、注册和浮层完全释放；再次启用只有一个入口。
- 深浅主题、键盘 Tab、Esc、窗口大小变化通过。

**完成门禁**：Web/Desktop 均有实际可见证据；否则仍停在 Phase 0。

**开发刷新注意**：Client HMR receiver 可用不等于产物会重建。只有确认同一 DSH checkout 的 `pnpm run dev:web` watcher 运行，才可承诺 Client 自动更新。修改 Web shell 或普通包需要重新构建并刷新现有 URL。当前仓库没有这些脚本；不得直接在此执行猜测的宿主命令。

### Step 2：打通右侧面板和 Host/Client 通信（Phase 0）

**实现动作**

1. 读取右侧栏包 README/类型，查清 Tab type 注册、Tab instance 创建/选择、标题 Slot 和卸载后的未知类型处理。
2. 使用独立 type key 注册 `sidebar.right.pane.tab`；面板内先显示当前 sessionId 与当前工作区快照。
3. 仅有内容 Slot 不能创建可选 Tab；如果创建机制不可用，改由 overlay 中等效右侧抽屉承载，不侵入原生 DOM 布局。
4. 选择实际可用的持久插件 Remote/RPC 入口，先实现 `health` 与只读空列表往返。
5. Host 注册资源随插件释放；Client 对断线、取消、异常显示明确错误。
6. 封装 DshAdapter：会话上下文、打开面板、打开来源、输入框草稿、文件下载分别实现，不混入领域逻辑。

**验证**

- 面板不覆盖聊天阅读主区，收起/调整宽度、会话切换正确。
- `shell.overlay` 没有会话 props；由 session Slot 桥接 sessionId，切换后旧选区立即失效。
- RPC 正常/非法参数/断线/取消均得到可控结果，不写裸 HTTP 无鉴权通道。
- Notebook 全局入口不依赖某条消息存在；没有会话时仍可访问全局库或等效入口。

**完成门禁**：确认的是正式持久 Bundle 通信，不是仅动态 `host.call` 的演示。

### Step 3：Storage Domain 可行性与可靠写入（Phase 0，发布阻断门禁）

**实现动作**

1. 根据 Inspect 返回的 packageDir 读取 Storage Domain 与实际路由 backend 文档/类型。
2. 定义稳定命名空间（建议 `dsh-session-notebook`），不使用 cwd/sessionId 拼接 Domain 名称。
3. 在专用测试 Domain 试验一个完整 Snapshot 的读写、关闭重开和宿主重启。
4. 核实底层原子替换/提交时机、失败回滚、容量、缓存行为、单进程/跨进程语义、备份与迁移能力。
5. 编写 Repository 和 mutationQueue；所有后续功能只走此路径。
6. 首次初始化只针对明确不存在的数据，读取失败不能当不存在。预置标签只初始化一次，用户删除后不自动复活。
7. Domain 打开失败进入只读/错误状态，不切换成空库继续保存。
8. 调用方拥有 Domain.close 生命周期，使用 context effect 清理。

**验证实验**

| 场景 | 预期 |
|---|---|
| 多行 Markdown、Quote、Anchor、Tag 保存后重启 | 各字符串与关系严格相等 |
| 注入 backend 写失败 | Promise 失败，旧缓存/旧数据不变，UI 草稿保留 |
| 提交期间终止测试 Host | 重启得到旧完整快照或新完整快照，不能半完成 |
| 标签合并期间提交失败 | 标签与所有 note 关联均保持操作前状态 |
| 两页面修改同一记录 | 一个成功，一个收到版本冲突 |
| 两页面修改不同记录 | 串行合并成功，或明确冲突重试；不能丢更新 |
| 两 Host 连接同一存储 | 安全排他拒绝或经证明的共享一致性 |
| 写锁释放时 unlink 前后同步失败/崩溃 | 严格区分旧写者能否继续提交、目录项是否耐久、新写者是否能进入；错误码、exit0 或一时不存在的锁文件都不能证明互斥；未知时冻结，禁止自动接管 |
| 无效 JSON/Schema/更高版本 | 停止写入，保留原介质，提供诊断和恢复 |
| 5,000 条最大代表性数据 | 容量、全快照提交时间与内存开销可接受 |

**完成门禁（正式 MVP）**：形成存储 ADR，选择整体 Snapshot 或经证明的事务记录方案。可靠性不足则阻断正式 MVP 发布；不自动退回裸文件覆盖、未批准 SQLite 或不安全跨 Host 队列。上表的跨 Host 排他、写锁释放故障、5,000 条最大样本、损坏介质保护与恢复仍是正式 MVP 证据；不能因为预览阶段被后移就标记 PASS。

### Step 3A：受限预览版的轻量存储门禁（先于 Step 4 的保存接入）

**存储实现选择**：优先使用当前目标 Desktop 版本经核实的 `ctx.storageDomain` 专属 Domain，一个整体 `NotebookSnapshot`，由 DSH 已配置 backend 管理物理介质；Host 单服务串行处理所有修改，不再为此阶段开发独立 backend、裸 JSON 文件、shell fallback、自有 `wx` 锁或 worker。目标是复用 Domain 的进程内写入队列、Schema 验证和持久写完成后才更新缓存的合同；这些性质需在所安装的 DSH 版本、实际 backend 和隔离测试介质上确认，不能从类型签名直接推断失败/崩溃行为。用 `global.set` 或单记录 `put` 做一次完整快照提交，具体接口以当前 Inspector/SDK 的确切合同及验证结果为准。插件层不要另建与 Domain 内存状态并行更新的权威缓存。

**不可省略的最小实现与验收**：

1. 在**明确缺失介质**时才初始化空库；解析失败、Schema 无效、未知更高版本、后台读错或提交结果不明均停止后续写入，不将旧数据当空数组，也不借用对照项目的 shell/full-access fallback。冻结后只读展示固定诊断，允许用户导出已验证数据；无法读取原件时不得假称已有安全备份。
2. 每次写入复用现有 Snapshot Schema/业务候选，限制单请求、单条及**整库序列化 UTF-8 字节数**；先提出保守预览容量预算，用真实样本测读取、单次提交与事件循环延迟。超限明确拒绝新写、不裁剪引用；既有 219.3 MiB / 5,000 条样本已显示主线程卡顿，不能作为本阶段无上限保证。初期只在有界数据量内开放，扩大上限须重新测量。
3. Host 请求比较 `expectedVersion` 或 `expectedRevision`，防止同一 Host 下旧页面覆盖新值；同一队列内生成并提交候选，`await` 成功后才回复保存成功、清除 Client 草稿。提交拒绝或回复中断时保留草稿；**未知是否落盘的写**冻结后续修改，需安全重开并核对现有状态，不能用新请求盲写或声称必定回滚。
4. 单 Host 是**运行边界而非代码保证**：明确 Host/Profile/介质唯一所有者、确认不共享该介质，验证加载/停用/重新加载以及重启后的唯一写者。宿主无法证明或运行中不能维持该边界时禁止真实写入；任何共享介质、多 Host、跨进程并发场景继续走 Step 3 正式门禁。
5. 加入完整 JSON 导出（从同一已验证快照生成，不含任意 Host 写路径）；在隔离介质测试首次写入、编辑、两页面冲突、写失败、坏数据拒绝、未知版本拒绝、关闭重开、Desktop 重启读回与已确认的单写者范围。只用一次“调用成功”或动态 demo 不算 Desktop 验收。安装、启停、重启与真实存储路径变动先单独授权。

**预览版完成定义**：满足以上安全边界，Step 4 手工笔记纵向保存链路实际可用，并公开标记“不支持损坏库恢复、多 Host 写入、超限大库及自动迁移”。本阶段只承诺已测范围内的完整写入/重启读取与错误时不主动空库覆盖，不承诺未验证的掉电耐久、跨进程强制排他或损坏介质备份。**正式 MVP** 仍需完成 Step 3 全部门禁、Step 14/FR-104A 受控恢复和其他 PRD 验收；没有原始坏介质保护/恢复能力时，不能以 JSON 导出代替正式发布验收。

### Step 4：共享 Schema 与最小手工保存闭环（Phase 1）

**实现动作**

1. 定义完整 Snapshot 与请求 Schema，拒绝未知修改字段，限制正文、引用、标签与请求总大小。
2. 实现手工新建、列表、详情、标题/正文编辑及 record version。
3. 编辑器先使用文本编辑 + 安全预览；保存中禁重复提交，但仍保留幂等键。
4. 保存成功后才能清空草稿；失败提供重试。未保存时离开/关闭/切会话需确认。
5. 列表查询默认排除 deletedAt，面板内完成列表 → 详情 → 编辑 → 返回。

**验证**：新建含代码/链接/任务列表的 manual，刷新与重启仍完全一致；空正文校验、冲突、失败与重复提交均通过。

**完成门禁**：最小纵向链路真正持久化，且没有 optimistic UI 把失败误报为保存成功。

### 当前开发顺序与受限预览边界

此前用户选择先完成可隔离功能、随后统一安排实机验收；2026-10-05 又确认优先轻量单 Host 保存方案，允许完整受控恢复等能力后移到正式 MVP。旧顺序例外**不再要求把 Step 3 全部跨 Host 锁/worker 实验做完，才可开发 Step 3A/4 的保存闭环**；但不豁免 Step 3A 的单写者边界、数据不空库覆盖、真实写入/重启验证，也不把未完成的 Step 0–2 Desktop 共存、认证和生命周期门禁算作通过。开发纯模块可继续先行；真实保存必须先满足 Step 3A 与对应 Desktop/通信安全条件，不用替身测试代替实机。真实消息归属和 DOM/Host 接缝须经受支持的 API 核对后才连接选区，不得伪造 messageId。任何安装、禁用/恢复、重启、当前 Desktop 新请求及 Profile 变更仍需各自授权；独立 Web 继续暂缓。正式 MVP 的 Step 3/14 门禁仍保留，**后续统一实机验收不是当前 PASS**。

### Step 5：选区捕获与消息身份（Phase 1）

**实现动作**

1. 在 session owning context 注册 `selectionchange`/pointer/keyboard 相关监听，避免全页面高频轮询。
2. SelectionCapture 判断非空、至少 2 个有效字符、不超过 maxQuoteLength（默认 8,000 Unicode 码点；超限提示阻止保存、保留选区、不截断）、同一条 user/assistant 消息。
3. 排除 input、textarea、contenteditable、插件面板、按钮操作区和非会话区域。
4. 优先使用受支持的消息 DOM 标识与数据查询；composer dock 向上寻找容器只作为经验证的兼容适配，不硬编码层级/类名，不读取其他插件 DOM 来估计布局。
5. 在用户动作前冻结 SelectionDraft：sessionId、messageId、role、exact、prefix/suffix、偏移、选区坐标、来源快照。
6. 点击浮层不会丢失此前 Range；不要阻止按钮获得键盘焦点，必要时用冻结快照而非依赖活 Selection。
7. root overlay 工具条从 session 桥接读取冻结选区；滚动、resize、Esc、外部点击与会话变更正确关闭。

**验证**：跨加粗节点、跨段落、反向拖选、键盘选区、代码/表格、跨消息、1 字符、超长、输入框、消息未提交的流式状态。

**完成门禁**：两个端点属于同一可验证消息；无法可靠归属的选区不能伪造 messageId。流式未提交内容的保存策略需明确，建议暂不创建持久引用并说明原因。

### Step 6：原始 Markdown 与纯文本降级（Phase 1）

**实现动作**

1. SourceAdapter 以 sessionId/messageId 读取 committed `user/message` 与 `assistant/message` 的文本块；只读查询不能唤醒 Agent。
2. 优先 `useChat`/宿主消息选择器或受控 Host 查询；不要每次选区遍历全部历史日志。
3. 必要时在 Host 建立增量消息投影；按宿主 projection 接缝实现并读取精确 API，不自行监听事件全量重放。
4. 消息可含多块内容，明确被选择的是哪个文本块；需要时给 Source/Anchor 增加可选 block coordinate，按业务 Schema 管理。
5. QuoteMapper 尝试 native source position，其次与同一渲染配置匹配的 AST/文本映射。
6. 记录源偏移仅在精确可证时生成，Quote 内容保留原串。不把 DOM 反推 Markdown 当作原始来源。
7. 局部选区可能切开 `**`、链接或代码围栏：若不能同时保证源片段真实且语义正确，降级 `plain_text`，不凭空补语法后声称原文。
8. 映射失败保存准确可见选择文本，保留换行并显示纯文本标识；不能用整条消息替代用户选区。

**验证矩阵**

- 普通段落、完整加粗、加粗内部局部、链接文字/部分链接、行内代码。
- 代码块整块/局部、列表跨项、表格跨列、引用块、重复段落。
- 多 text block、HTML、软换行、CRLF、emoji、自动空白变换。
- 每个样本记录 source Markdown、可见选择文本、Quote 格式与期望结果；失败降级不是测试失败，伪原始 Markdown 才是失败。

**完成门禁**：给出逐结构的保真能力表，而不是“全部 Markdown 100% 保留”的承诺。

### Step 7：无标签划线与快捷标签（Phase 1）

**实现动作**

1. 工具条主体立即创建 highlight；下拉展示固定 Tag ID 与最近使用标签。
2. TODO、重要、待验证为普通标签；初始化和设置随 Snapshot 保存。
3. 选择/新建标签支持多选；“创建标签 + 保存划线”作为一个关联操作整体提交。
4. 同一冻结选区的一次保存 intent 共用 requestId；重复点击/响应丢失重试返回原结果。
5. 有意再次摘录同一文字可创建新记录；不要仅用文本哈希永久禁止合法重复摘录。

**验证**：无标签 1 次点击、TODO 最多 2 次点击、创建重复规范化名称、快速保存两次、重试、标签重命名/隐藏/删除后快捷菜单正确。

**完成门禁**：无正文编辑器才能完成快捷划线；没有引入 TODO 状态机。

### Step 8：Text Anchor 与持久高亮（Phase 1）

**实现动作**

1. 以消息为边界收集文本节点，构建统一 DOM 文本索引：可见文本位置 ↔ Text node/offset。
2. 记录 exact、prefix/suffix、offset、occurrence；规范化只运行时计算，并保留归一化文本到原始 offset 的映射。
3. 匹配顺序：messageId → 合法偏移且 exact 一致 → exact + 上下文 → occurrence；存在多个不可区分候选则不高亮错误位置。
4. 使用 CSS Custom Highlight API 注册 Range；不通过 `innerHTML` 或插入 `<mark>` 破坏宿主 React DOM。
5. 高亮组与 noteIds 保持索引；仅恢复当前会话/已挂载消息，其他会话不处理。
6. CSS 高亮本身不是可点击 DOM 元素。为 FR-022 实现命中检测：比较 pointer 坐标与候选 Range 的 client rects/实际文字位置，命中后打开详情；提供列表/键盘替代入口。
7. 重叠引用显示多个匹配笔记供选择，不让最后一个注册覆盖全部关联。
8. 有笔记时才观察相关消息子树；防抖且只重建受影响消息。虚拟化未挂载标记 pending，不认定来源删除。
9. 卸载、会话切换、删除笔记时清除旧 Range/Highlight/观察器。

**验证**：跨节点刷新恢复、100 条高亮滚动、重复文字、虚拟消息挂载、代码块、删笔记、重叠引用、浏览器 API 缺失、点击命中和键盘入口。

**完成门禁**：定位失败快照仍可读；CSS Highlight 不支持时有明确提示/等效体验，不能静默丢功能。

### Step 9：补充、改写、转换和回收站（Phase 1）

**实现动作**

1. “加入”创建 note 草稿，正文从空白开始；“基于原文改写”创建 manual 草稿，复制 Quote 到 bodyMarkdown。
2. 引用区域只读，显示“原始引用”；正文区显示“我的笔记/我的改写”。
3. plain_text 初始化改写正文时转义 Markdown 控制字符或采用安全字面文本策略，不能意外解释为脚本/复杂格式；不得改 Quote。
4. highlight 转 note/manual 走显式 convert；退回 highlight 显示正文移除确认。
5. 单条删除显示标题，批量删除显示数量与列表；取消无写入。
6. 使用 deletedAt 实现回收站，恢复原 ID 与关联；永久删除另设高风险确认，不自动清空。

**验证**：修改正文后 Quote/Anchor/Source byte-for-byte 不变；转换 ID 不变；未保存离开确认；删除确认取消；批量中版本冲突整体失败；恢复高亮；来源会话无变化。

**完成门禁**：编辑和删除绝不调用 DSH 消息修改或会话删除 API。

### Step 10：标签完整管理（Phase 2）

**实现动作**

1. 实现全局标签字典、选择器、标签数量与最近使用时间。
2. 重命名仅改 Tag，不复制更新笔记名称；规范化冲突建议提示合并而非自动合并。
3. A → B 合并在候选快照中替换/去重 tagIds，同时更新快捷和最近标签列表，最后删除/标记 A。
4. 删除标签只解除关联；范围覆盖回收站记录，防止恢复后悬空。
5. 计数默认只统计未删除笔记；确认对话框另列回收站影响，保持规则明确。
6. AND/OR 与无标签筛选使用 Tag ID，不用名称做内部键。

**验证**：同名/大小写/Unicode 去重、重命名一致性、合并已有 B 的笔记、快捷标签替换、回收站恢复、影响预览后数据变化、失败回滚。

**完成门禁**：没有跨多次独立 put 留下半合并关系。

### Step 11：全局查询、搜索与批量选择（Phase 2）

**实现动作**

1. Query 纯函数接收 Snapshot 和 Filter，不产生存储副作用。
2. 来源条件覆盖全部/当前会话/当前工作区/手工/归档/不可用；“手工”细分 NoteKind 与“无会话来源”，不能混为一谈。
3. 工作区以 Host 已知 canonical path 比较，标题只用于显示；历史目录已不存在时使用已保存路径，不要求每次 realpath 成功。
4. 搜索覆盖正文、引用、标题、来源标题/路径及标签显示名称。缓存搜索文本为派生内存索引，随标签更名更新，不持久化 normalizedText。
5. 默认 updatedAt 降序，使用 ID 作为稳定 tie-break；补齐创建时间、会话顺序、工作区、标签排序。
6. 大列表分页/虚拟化，不一次挂载 2,000 张 Markdown 卡片；摘要用安全文本呈现。
7. 已选笔记存 Set<noteId>，导出使用选择 ID 和确定顺序。“全选结果”必须包括全部匹配，不只是当前加载页。
8. 筛选变化后显示隐藏已选数量，允许清除；不得悄悄导出未说明的记录。

**验证**：跨会话全局可见、工作区组合筛选、标签 AND/OR、无标签、时间边界、归档/未知来源、搜索标签更名同步、分页全选与排序稳定。

**完成门禁**：筛选不修改笔记可见性和主存储布局；按 PRD AC-013 的固定样本和 30 次测试记录搜索 p95 <150ms，并分别报告主动防抖时长与冷/热状态。

### Step 12：来源状态与回链（Phase 1/2 收敛）

**实现动作**

1. 从 exact sessionId 查询来源存在性，不能只查当前侧栏可见会话列表。
2. 分别判定“来源存在”和“是否归档”。此次 `SessionRecord` 不含归档字段，需补查 Workspace snapshot/类型的正式接缝。
3. sessionQuery/readSession 用于冷读原文；避免 resolveAgent、prompt 等会唤醒 Agent 的操作。
4. 当前客户端使用 `uiWorkspace.openSession` 打开来源，建立导航 token；用户切换导航后取消旧滚动任务。
5. 归档能直接打开则留在归档；必须恢复时提示用户，确认后 `unarchiveSession` 再 open，失败显示原因。
6. 等消息历史加载/虚拟化挂载后定位 messageId，进而定位 Anchor。没有官方消息滚动接口时单独做 adapter Spike，不无限轮询 DOM。
7. transient 网络错误标记 unavailable/unknown，不直接等同 deleted；来源状态只是缓存，不覆盖创建时来源快照。
8. 手工空白笔记无锚点时只打开上下文会话，不声称找到精确原文。

**验证**：活跃/冷会话、归档直接打开或确认恢复、恢复取消、会话删除、网络失败、消息 shadowed、旧消息不在首屏、快速连续点击不同来源。

**完成门禁**：按“精确引用 → 原消息 → 原会话 → 本地快照”降级；归档恢复未经确认不得执行。

### Step 13：复制、写入输入框、Markdown 导出和 JSON 备份（Phase 3）

**实现动作**

1. 实现共享纯函数 MarkdownExporter；Host 以一份确定 revision 快照校验 selectedIds，缺失/删除对象应提示重新选择，不默默少导。
2. 文件顺序沿列表排序，默认含正文、原始引用、标签、来源 ID、时间；manual 改写标为“我的改写”。
3. Markdown Quote 原样输出，避免无条件包 blockquote 破坏代码/表格；plain_text 用安全引用或动态长度围栏包裹。
4. 根据内容最长反引号连续串选择更长围栏；元数据标题/标签/路径安全转义，防止破坏文档结构。
5. 只在用户点击后生成一个 UTF-8 `.md` 文件。没有验证稳定 Deep Link 时只写来源文本，不构造猜测链接。
6. Web 使用 Blob/Object URL 下载并回收 URL；Desktop 优先正式保存能力，否则实测下载方式，取消保存不得报成功。
7. 不接收任意 Host 写入路径；文件名过滤分隔符、控制字符、路径穿越和非法名称。
8. Clipboard 在用户动作中调用，权限失败显示手工复制替代。
9. 读取 `inputActions` 精确合同后实现“写入当前输入框”，已有草稿先确认替换/追加，绝不自动 submit 或调用 prompt。
10. JSON Backup 包括业务版本、全体 notes（含回收站）、tags、settings、完整 Source/Anchor；不包含密钥、认证 token 或内存 Range。

**验证**：单条/任意多条/全部筛选导出、长围栏、恶意元数据、空选择禁用、取消保存、UTF-8 中文 emoji、外部 Markdown 阅读器打开、外部修改不回写笔记库。

**完成门禁**：5,000 条导出 UI 保持可操作，可采用 Host 计算/分块传输/让出任务等经验证方式；JSON 严格校验往返不丢业务字段。Web 与 Desktop 分别验证文件实际落地。

### Step 14：迁移、损坏恢复、升级卸载（Phase 3）

**实现动作**

1. 建立 `schemaVersion` 顺序迁移函数，纯函数生成新候选；迁移前创建并校验可用恢复点。
2. 更高未知版本进入只读，不能按旧 Schema 清空或降级覆盖。
3. 不选 `invalidRecords: 'backup-and-skip'` 来静默“丢坏记录继续用空库”；笔记主库默认 fail-closed，若使用跳过需显式错误、完整备份与一致性检查。
4. 读取损坏时冻结写操作，保存原介质副本；无法通过公开存储能力取副本时保留原件并报错，该能力未解决不得宣称满足 FR-103。
5. FR-104A 受控整库恢复为 MVP 必须：文件默认最多 50 MiB（读取前限额），严格校验本插件备份 Schema/关联/版本，预览数量与替换影响，二次确认后才执行；预览后重新核对 revision/介质状态，变化则重做预览。先保护有效旧库或原始损坏介质，保护失败禁止替换；无备份时保留只读错误状态，不清空修复。
6. 恢复进入同一 mutationQueue，将迁移后的完整候选整体提交，失败保留旧数据/损坏原件；成功刷新连接页面。保留原始业务 ID、createdAt、Quote/Anchor/Source，但更新提交代际，防止恢复前旧版本请求出现 ABA 覆盖；Host 可采用不可回退的 storeEpoch + revision 并纳入所有写 DTO。该字段属于并发元数据，不用备份中的旧值覆盖当前代际。恢复中崩溃和提交响应丢失也要验证；FR-104B 增量导入的冲突/标签合并继续 P1。
7. 卸载只释放资源，禁止在 disposer 中删除 Domain。独立清除数据功能需特别确认。
8. 更新 package 时遵循实际 install/restart 结果，确保新 Client artifact generation 真正加载。

**验证**：旧版本迁移成功/中断/失败、备份失败禁止迁移、更高版本拒绝写、损坏不会空库覆盖、恢复失败完整回滚、卸载再安装原数据仍在。

**完成门禁**：不是只有 JSON 导出按钮，恢复与迁移有可重复操作证据；安全处理数据损坏是发布门禁。

### Step 15：性能、安全、可访问性与双端发布（Phase 4）

**实现动作**

1. 安全 Markdown 渲染禁止 raw HTML 执行，限制链接协议；代码纯文本显示，测试 `javascript:`/`data:`、SVG/HTML 注入。
2. 所有 RPC 入口严格 Schema、大小限制、枚举和版本校验；非法字段不能任意覆盖记录。
3. 性能样本包含当前会话 100 条高亮、全局 2,000 条笔记、5,000 条导出；区分冷启动、普通查询、最坏体积。
4. 不含笔记时不轮询扫描聊天，DOM mutation 防抖、订阅最小 slice；卸载后无持续任务。
5. Keyboard：工具条、菜单、标签多选、编辑器、确认、回收站均可操作；弹层焦点陷阱与焦点恢复正确。
6. 明暗主题、窄窗口、长标签、空状态和错误状态完整。
7. 文档说明本地数据用途、实际隔离边界、备份恢复、卸载数据行为与已验证 DSH 版本。
8. 不采集远程遥测、不自动把历史笔记送模型；MVP 仅保留脱敏验收记录与用户反馈，不实现专用诊断统计页/统计导出。后续新增本地统计需单独定义 FR 与隐私范围。

**验证**：执行第 7 节所有自动/人工门禁，并在两个真实客户端逐条跑第 8 节验收映射。

**完成门禁**：双端都通过；存储故障、数据丢失、无授权恢复、伪 Markdown、XSS 任一未解均阻断发布。

## 7. 测试组织与执行证据

### 7.1 测试分层

| 层级 | 测试对象 | 最低覆盖 |
|---|---|---|
| 单元 | Schema、转换、Tag merge、Query、Anchor、Exporter、Migration | 正常边界 + 非法输入 + 不变量 |
| 集成 | Repository + 可故障注入 backend、真实测试 Domain、RPC | 冲突、幂等、失败缓存、关联提交、重启 |
| Web E2E | 当前真实 DSH 页面 | 选区→保存→刷新→详情→来源→导出 |
| Desktop | 实际客户端加载与窗口 | 相同主流程 + 重开窗口/应用 + 文件保存/复制 |
| 故障 | 测试 Host/专用介质 | 提交中断、损坏、版本不兼容、备份/迁移失败 |
| 性能 | 代表性大数据 | 100/2,000/5,000 场景、内存与耗时 |

不要使用生产 Profile 注入损坏或终止用户真实 Host。专用测试介质、测试 Host 与备份恢复必须先建立。

### 7.2 拟建脚本与 CI

当前已有 `check`（JS 语法）、`test` / `test:unit`（node:test）和 `pack:check`（npm dry-run 打包）。当前有 40 项测试，包含模拟通信、生命周期与诊断测试，不等于存储或 Desktop 全流程验收。尚无 build、lint、typecheck 或 E2E npm 脚本；已新增 `test:integration` 工作区隔离整体集成入口（不等于 Desktop 实机）。业务工程后续建议声明以下合同，并把实际执行命令写入 README：

```text
check        类型与静态校验
build        生成 Host/Client/共享产物
 test:unit   纯函数与 Schema
 test:integration  测试存储/传输/故障注入
 test:e2e    连接明确指定的真实测试 DSH Web
 pack:check  检查发布包入口、patch、locale、产物完整性
```

包管理器与 Node 版本需读取目标 DSH 工具链后固定并生成锁文件，不能在本文虚构版本号。CI 顺序建议：安装锁定依赖 → check → unit → integration → build → pack 检查；Web/Desktop 发布候选验收另留真实运行记录。

### 7.3 统一验证记录模板

```text
步骤/用例 ID：
DSH 版本与插件版本：
平台 / OS / Host / Profile / 存储实例别名：
前置数据与操作：
期望：
实际：
证据：截图、脱敏日志、文件 hash、revision、故障点
结果：PASS / FAIL / BLOCKED / NOT RUN
限制与后续：
```

NOT RUN 与“Inspect 已发现”不能填 PASS；插件安装成功和 Slot 注册成功也不能代替可见 UI 的验证。

## 8. PRD 验收追踪矩阵

| PRD 验收 | 实现步骤 | 必须留下的验证结果 |
|---|---|---|
| AC-001 划线 | 5–8 | 跨加粗节点创建，刷新高亮恢复 |
| AC-002 Markdown 引用 | 6、13 | 精确源片段或明确纯文本降级，导出一致 |
| AC-003 笔记 | 4、9 | 卡片/详情包含正文、Quote、来源 |
| AC-004 全局可见 | 4、11 | A 创建，B 的全部列表可见，当前会话过滤正确 |
| AC-005 工作区筛选 | 11 | 同工作区多会话记录正确组合筛选 |
| AC-006 标签管理 | 10 | rename/merge/delete 的关系一致性 |
| AC-007 Markdown 导出 | 13 | 任意勾选，多条仅一个 UTF-8 文件 |
| AC-008 来源回链 | 12 | 原会话可进入，消息/Anchor 可用时定位 |
| AC-009 归档会话 | 12 | 归档读取或确认恢复，取消不恢复 |
| AC-010 删除会话后笔记 | 12 | 快照完整，来源不可用，不删笔记 |
| AC-011 数据可靠性 | 3、14 | 读取失败/损坏不覆盖为空集合 |
| AC-012 多页面并发 | 3、4、10 | 不同对象不丢更新，同对象明确冲突 |
| AC-013 性能 | 8、11、15 | 100 高亮 / 2,000 笔记无持续卡顿 |
| AC-014 卸载安全 | 1、14 | 卸载保留数据，再装或备份恢复 |
| AC-015 改写笔记 | 9、13 | manual 正文改变、原始 Quote 不变 |
| AC-016 TODO 快捷划线 | 7 | 无编辑器、稳定标签、无任务状态 |
| AC-017 新建普通标签 | 7、10 | 全局去重、重试不重复记录 |
| AC-018 存储与内容保真 | 3、9、14 | 刷新/重启严格相等，失败保留草稿 |
| AC-019 存储与导出独立 | 3、10、13 | 无独立 SQLite/逐笔记文件，合并失败无半状态 |
| AC-020 Web/Desktop | 1–15 | 两端独立完整主流程、重启、导出与受控恢复记录 |
| AC-021 保存边界/标签键 | 4–7、9–10 | 码点上限、空 note、取消转换、名称键冲突 |
| AC-022 受控恢复安全 | 3、14 | 保护失败/提交失败/损坏/预览变化/旧 token 均安全拒绝 |
| AC-023 输入框草稿 | 13 | 追加/替换确认与最新草稿，双端不自动提交 |

### 8.1 发布检查清单

- [ ] Phase 0 能力与存储 ADR 有结论，未证明能力未被写成承诺。
- [ ] Web 与 Desktop 的安装、Client 加载、面板和选区都通过。
- [ ] 引用正文、用户正文、定位锚点各自独立。
- [ ] 普通划线、TODO、新标签、note、两种 manual 均可保存。
- [ ] 高亮重绘、重复文本、点击命中与定位降级通过。
- [ ] 标签删除/合并、回收站恢复、快捷配置无悬空 ID。
- [ ] 多页面冲突、请求幂等、写失败与提交中断测试通过。
- [ ] 归档来源确认、来源删除兜底、导航取消通过。
- [ ] 导出、剪贴板、输入框草稿行为在两端均通过。
- [ ] JSON 备份、迁移恢复点、损坏保护与受控恢复通过。
- [ ] 安全渲染、协议白名单、键盘/焦点与双主题通过。
- [ ] 性能目标和最坏数据体积有测试记录。
- [ ] 卸载不删除 Domain，安装说明和版本兼容范围明确。

## 9. 里程碑与完成定义

先增加一个**非正式 MVP 的交付点**：`P0 Desktop 单 Host 便签预览版`＝完成 Step 3A + Step 4 的最小手工保存链路、真实 Desktop 安全通信/重启读回和 JSON 完整导出，且在 UI/说明中标明单 Host/容量/无法恢复损坏介质/无迁移等限制；不足的 Desktop 认证、官方 Gateway 共存或资源释放仍不能放行。`P0` 的通过**不等于**下表 M0–M4 或 PRD AC-001–AC-023 通过，特别不替代 FR-104A。下表仍是正式 MVP 的完整路线；原历史双端文字按顶部 Desktop 优先决策解释。

| 里程碑 | 步骤 | 可演示交付 | 不可跳过的门禁 |
|---|---|---|---|
| M0 技术可行 | 0–3 | 双端空插件、面板、RPC、测试 Domain | 存储可靠性与跨 Host 边界 |
| M1 笔记闭环 | 4–9、12 基础 | 摘录、补充、改写、高亮、编辑、回收站、回链 | 快照不变、刷新恢复、失败不丢草稿 |
| M2 全局组织 | 10–12 完整 | 标签、组合查询、搜索、归档来源 | 关联修改整体提交、来源失效不删笔记 |
| M3 数据交付 | 13–14 | Markdown 导出、完整备份、迁移恢复 | 导出独立、损坏不覆盖、恢复可操作 |
| M4 发布候选 | 15 | 双端兼容矩阵、测试报告、安装说明 | AC-001 至 AC-023 和安全门禁 |

预置标签与最小标签创建在 M1 就需要，完整管理在 M2 补齐；可靠性骨架与测试从 M0 开始，不能拖到 M3 才建设。开发工时暂不承诺，先用 M0 的能力结果评估消息映射和存储风险。

## 10. 尚待关闭的问题（按优先级）

### P0：必须在开发启动阶段关闭

1. Storage backend 是什么，单次 Snapshot 写入是否真正原子/耐久，失败后缓存是否回滚？
2. 相同存储多 Host 如何安全排他或一致写入，第二个写者能否拒绝？
3. 持久 npm Bundle 的 Host/Client RPC 与类型生成具体流程是什么？
4. 右侧 Tab 类型/实例的正式注册与创建 API 是什么？
5. 用户/Assistant 消息 DOM 的稳定身份接缝，以及消息源文本块精确形状是什么？
6. Desktop 是否复用 Web Client Bundle，是否具有相同 Slot 和下载行为？

### P1：首个功能迭代中关闭

1. 原生 source position 是否存在；哪些 Markdown 结构可以证明局部保真？
2. Workspace 的归档集合通过何种公开 snapshot/API 读取？
3. 长会话按 messageId 加载并滚动的官方接缝是什么？
4. `inputActions` 写入草稿的精确签名及已有草稿处理方式？
5. 损坏介质副本、迁移恢复点和恢复操作由何种宿主能力承载？
6. 已确定标签名称键、note 非空保存和编辑/预览切换是否已落实为 Schema 与边界测试？这不是待产品确认项。

### P2：发布前关闭

1. 正式 npm 名称、peerDependencies 与实际支持的 DSH 版本范围。
2. 数据隔离边界、存储位置展示能力、Desktop/Web 不共享时的说明。
3. 性能数据、单请求与备份体积上限、幂等收据保留窗口。
4. 未来 Agent Tools 与 UI 共用 Host 服务的扩展方式；MVP 不注册工具、不注入上下文。

## 11. 社区项目代码参考：dsh-plugin-session-notes

### 11.1 分析基线与使用边界

参考项目：[iptton-ai/dsh-plugin-session-notes](<https://github.com/iptton-ai/dsh-plugin-session-notes>)。本次通过 GitHub tree API 固定读取的提交为 **`5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95`**，manifest 版本为 **1.0.1**；后续引用使用提交链接，避免 main 分支变化后结论漂移。

已读取源码、发布入口、README、manifest、patch 与许可证。本节是静态源码分析，没有安装或运行该插件，不把 README 的功能描述当作双端测试结果。当前目录中不复制整个参考仓库。

**源码导航：**

| 入口 | 内容与阅读重点 |
|---|---|
| [README](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/README.md>) | 动态/常驻两种形态、产品行为说明；需与代码交叉核对 |
| [manifest](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/package.json>) | `./client` 导出、`dsh.bundle.patch`、`platform: web` |
| [Bundle patch](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/cordis.patch.yml>) | 插入 row 的包名与 manifest 对齐 |
| [动态 Host](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/src/host.js>) | `harness.handle` RPC、fs/shell 存储、写队列 |
| [动态 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/src/client.js>) | `Anchor`、Selection、间隙索引、Range、高亮、右侧 Tab |
| [常驻 Host](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/lib/index.js>) | Node fs、temp+rename、同源 API 与路由清理 |
| [常驻 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/lib/client.js>) | ModuleLoader factory、fetch API、完整 apply teardown |
| [MIT License](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/LICENSE>) | Copyright (c) 2026 iptton-ai；复制代码或实质性部分需保留版权与许可声明 |

**先区分两种实现，不要只看 src 后直接移植：**

| 维度 | 动态源码形态 | 常驻 npm 形态 |
|---|---|---|
| Host 入口 | `return { apply(ctx) { ... } }` | `export function apply(ctx)`，注入 `webServer` |
| Client 入口 | `return { inject, apply }`，环境提供 React/host/styles | `window.__ModuleLoader__.load`，factory 内 require React |
| 通信 | `host.call('notes/...')` ↔ `harness.handle` | fetch `/session-notes/api/*` ↔ Host 路由 |
| 写入 | DSH fs，失败再尝试 shell，显式 full-access policy | Node fs `writeFile(tmp)` + `rename(tmp,file)` |
| 资源释放 | 有 Slot/effect，但 document click 匿名监听未显式清理 | apply 返回 teardown，释放 observer/highlights/timers/style/click |

本插件采用常驻 Bundle，**可以参考其 ModuleLoader、Slot 与适配分层，不采用其裸文件存储和动态执行权限策略**。README 中的手工 Profile 安装方法也不替代本指南的授权 Plugin Manager 流程。

### 11.2 可参考实现总表

| 参考符号/机制 | 可复用价值 | 必须调整 | 对应步骤 |
|---|---|---|---|
| manifest + patch + ModuleLoader | 一包 Host/Client 的最小发布结构 | 新包名、新 row、真实构建产物与依赖 | 1 |
| `Anchor` + `useWorkspaces/useInput` | session Slot 向 root overlay 桥接上下文 | 按会话实例隔离，读取最小 selector，冻结选区来源 | 2、5 |
| `findScrollParent/registerContainer` | 不依赖产品 class 的容器探索 Spike | 不是消息身份 API；多聊天视图与布局需验证 | 5 |
| `handleSelectionChange/SelButton` | Range 几何坐标、浮层边缘约束、排除插件点击 | 保留 exact，限制单消息与角色，补键盘/触控与取消 | 5 |
| `gapBetween/hasBreakBetween` | 跨 inline/段落/BR 的文本串组装 | 按消息构建，测试隐藏内容、表格与代码空白 | 6、8 |
| `foldWs` 的位置 map | 临时规范化后映射回原 DOM 偏移 | 保存起止跨度，不折叠持久内容，不首命中即定位 | 8 |
| `applyAll` 的 Range + Highlight | 不改变 React DOM 的高亮主路径 | 增量恢复、按锚点匹配、按类型区分样式 | 8 |
| `onDocClick` + `getClientRects` | CSS Highlight 没有 DOM 点击事件时的命中检测 | 排除 UI、限制消息容器、支持重叠候选与键盘 | 8 |
| `Panel(inTab)` + rightbar 注入 | 原生 Tab 与 fallback 共用面板组件 | 核对当前服务 API，不照搬版本注释 | 2 |
| `sendToComposer` | 附加到已有 draft，不自动提交 | 获取最新 draft、正确多行引用、确认策略与合同 | 13 |
| `readAll/persist` | 认识存储缓存与队列结构 | 全部替换为 Storage Domain 候选提交与版本校验 | 3、14 |
| 常驻 teardown | 聚合资源清理模式 | 处理未跟踪 setTimeout 与跨 context disposer | 1、8、15 |

### 11.3 加载与 Slot：可直接参考结构，不能直接套动态上下文

参考 [常驻 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/lib/client.js>) 的 `window.__ModuleLoader__.load`：factory 只取得 React 并返回插件定义，业务副作用在 apply 内执行。manifest 的 `name`、Loader factory `id`、Bundle row `name` 必须一致。

其 `conversation.composer.dock` 放置隐藏 `Anchor`，`shell.overlay` 承载浮层，`conversation.session.header.utilities` 放面板入口。2026-10-02 本次补查确认 **header utilities Slot 存在**，是 session scope list，标准 props 有 sessionId、useInput、inputActions 等；可以作为 Step 1/2 的正式入口候选。

下例为本插件拟写的结构示意，不是上游整段复制，也不代表已运行：

```js
window.__ModuleLoader__.load({
  id: 'dsh-session-notebook',
  factory(require) {
    const React = require('react')
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => ctx.slots.inject(
          'conversation.session.header.utilities',
          () => ctx.slots.register({
            name: 'conversation.session.header.utilities',
            id: 'session-notebook-toggle',
            order: 60,
          }, NotebookEntry),
        ))
        // NotebookEntry 由本插件定义；可见文字走 locale。
        // 选区、存储与面板各自登记 disposer，不在 factory 中启动。
      },
    }
  },
})
```

**验证**：安装后检查 factory id/row/module 对齐、真实 header 入口可见，禁用再启用只有一个入口；React 从运行时取得；不能把动态 `host.call` 当 npm Bundle 中天然可用的变量。

### 11.4 `Anchor`：共享上下文桥接可以参考，但选区保存必须冻结来源

在 [动态 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/src/client.js>) 搜索 `const Anchor`、`findScrollParent`、`registerContainer`：

1. Anchor 读取 props.sessionId。
2. useWorkspaces 遍历 items，找 sessionIds 包含当前会话的工作区。
3. useInput 读取 draft，缓存 inputActions。
4. 从 hidden ref 向上查 overflowY 为 auto/scroll 的祖先，注册 MutationObserver。
5. overlay 与多个 Slot 通过 apply 闭包的 `S` 和 listener 集合共享状态。

可以借鉴 **session Slot 获取上下文 → root overlay 使用** 的模式。但原版选区对象只有 x/y/quote，`addNote` 保存时才读取 `S.sessionId/workspacePath`：如果选中会话 A 后切到 B 再保存，可能把 A 的引用归到 B。Notebook 必须冻结来源：

```ts
// 本插件建议 DTO；不是上游已实现字段。
interface SelectionDraft {
  intentId: string
  sessionId: string
  messageId: string
  messageRole: 'user' | 'assistant'
  exact: string
  anchor: TextAnchor
  source: NoteSource
  rect: { left: number; top: number; width: number; height: number }
}
```

保存使用该 DTO，不重新从全局“当前会话”拼来源。切会话后关闭或清晰保留绑定来源的编辑草稿。另需注意侧栏 Chat、主 Chat、多个 Tab 可能同时挂载 session Slot：原版单一 `S.sessionId/container` 是“最后写入者生效”，Notebook 应按视图实例登记上下文，或明确仅主 Chat 选区激活，卸载旧实例不能清空新实例状态。

**验证**：选中 A → 切 B → 保存不得误归属；主聊天与侧栏聊天同时出现不串会话；Workspace 列表无当前项时不能把所有来源抹空。

### 11.5 文本索引：`gapBetween` 与 `foldWs` 是最值得移植的算法思路

在 [动态 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/src/client.js>) 搜索 `collectTextNodes`、`nearestBlock`、`hasBreakBetween`、`gapBetween`、`foldWs`。

**上游做法：**

- 收集非空文本节点，跳过 SCRIPT/STYLE/TEXTAREA/INPUT 和 `data-snote-ui`。
- 两文本节点在不同块元素或中间出现 BR 时补换行；inline 情况用 gapRange.toString 取被跳过的间隙文本。
- 给每个节点记 fullText 中的 start，形成 `spans`。
- 把连续空白折叠成一个空格，同时 map 保存折叠字符在原串中的起点。
- 匹配结果通过 map 找回原始文本范围，再映射为 DOM Range。

这解决了“简单 textContent 拼接把段落接成一行”和“规范化后丢失 DOM offset”的常见问题。但不能声称静态块标签表与 Selection.toString 在所有浏览器/布局都等价：隐藏元素、CSS white-space、BR、表格列间隔、代码空白都要用真实样本验证。

**本插件改造：**

1. 索引范围从整场会话缩为已识别 messageId 的消息正文，不混入工具栏或其它消息。
2. 同时维护 start/end 映射，避免折叠空白末尾用 `map[last] + 1` 只覆盖原空白 run 的第一个字符。
3. Quote 与 Anchor.exact 保留创建时原串；foldedText/map 只在内存使用。
4. exact + prefix/suffix + offset + occurrence 消歧；无法消歧时不画错误高亮。
5. Unicode 规范化如启用，必须映射整个归一化跨度，不能假设字符串长度不变。

下例是空白跨度映射的自有设计示意（仅处理空白，不含完整 Unicode 或 DOM 算法）：

```ts
function foldWhitespace(text: string) {
  let folded = ''
  const starts: number[] = []
  const ends: number[] = []
  for (let i = 0; i < text.length;) {
    const start = i
    if (/\s/u.test(text[i])) {
      while (i < text.length && /\s/u.test(text[i])) i++
      folded += ' '
    } else {
      folded += text[i++]
    }
    starts.push(start)
    ends.push(i)
  }
  return { folded, starts, ends }
}
// 匹配 [at, at + length) 后：
// originalStart = starts[at]
// originalEnd = ends[at + length - 1]
```

**验证**：`a  b`、NBSP、跨加粗节点、两段落、BR、表格、代码缩进、emoji、连续空白结尾和重复文本；断言构造 Range 的可见选择与目标 Anchor 等价。可见文本映射与 Markdown 源映射是两件事：此算法没有恢复 `**`、URL 或代码围栏，不能用它直接标记 Quote 为 markdown。

### 11.6 CSS Highlight 与点击：复用主路径，舍弃 DOM 包裹兜底

在 [常驻 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/lib/client.js>) 搜索 `supportsHighlight`、`applyAll`、`noteRanges`、`onDocClick`、`revealNote`：

- `new Highlight()` 收集 Range，`CSS.highlights.set('snote-hl', group)` 注册；CSS `::highlight` 绘制。
- `noteRanges` 保存 noteId ↔ Range，点击时用 `range.getClientRects()` 与指针坐标比较。
- `revealNote` 找 Range 起点父元素 `scrollIntoView`，只支持当前已加载消息区域。

这可用于 Notebook 的 Step 8。建议把注册 key 改成插件唯一前缀，并为 highlight/note/active 分组；点击限制在目标消息正文，忽略插件 UI/弹层、已有非空选区和不适宜打开详情的交互目标；重叠引用列候选，不选择数组第一个。仅 rect 判断可能命中浮层背后的正文，必须做事件路径/遮挡检查。

**明确不照搬：**

- 原版 `folded.text.indexOf(q)` 只找整场会话第一个匹配，无 messageId/上下文锚点，会把重复句子划错。
- fallback `wrapOrigin` 用 splitText + `<mark>` 改宿主 DOM，`clearMarkHighlights` 再 normalize；与 Notebook 的 React-safe 要求不一致。
- MutationObserver 全容器防抖 + 每 5 秒“笔记数是否等于 alive Range 数”对账：虚拟消息未挂载或永久无法匹配时，会持续重复全量 applyAll。
- `restoreObserver` 部分分支主动调用，finally 也调用，可能重复安排延迟恢复；应收敛成一次可取消的协调任务。

**替换方案**：消息级增量索引、按挂载事件协调、pending/unresolved 状态、不因未加载笔记数量触发永久周期扫描。缺少 Highlight API 时给出等效非侵入提示/定位能力，不能自动 `<mark>` 修改 DOM。

**验证**：两个消息同一句话不误定位、虚拟未挂载无持续扫描、重叠笔记可选、弹层覆盖高亮时不误打开、禁用插件后无 Range/observer/timer 遗留。

### 11.7 原生右侧栏：上游提供了具体候选，但当前合同仍需确认

在 [常驻 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/lib/client.js>) 搜索 `NotesTabBody`、`sidebarRightTabs`、`openTabIn`。上游具体调用顺序是：

```text
ctx.inject(['sidebarRightTabs', 'sidebarRight'], scope => ...)
→ scope.sidebarRightTabs.register({id, kind, priority:'extension', title})
→ sidebar.right.pane.tab 用 type id 作为 key 注册 NotesTabBody
→ rightbar.openTabIn(sessionId, 'session-notes')
→ Panel({inTab:true})
```

服务缺失/打开抛异常时使用 `Panel` 的 overlay fallback；Tab 与抽屉共用列表逻辑，是可参考的组件复用方式。

**本次核对限制**：当前 Client Service Inspect 目录没有列出 `sidebarRightTabs/sidebarRight`，只有 layout 等服务；因此这些名字是“上游已使用的候选”，不是“当前宿主合同已确认”。未列出也不证明服务一定不存在，应继续读取实际右侧栏包类型并做最小注册实验。源注释写 `dsh >= 0.1.5` 不能据此声明 Notebook 版本兼容范围。

**本插件适配**：用 Adapter 隔离上述候选调用，所有 disposer 由注入 scope 和插件自身共同持有；原生 Tab 卸载后 fallback 仍可打开。Tab body 应使用自身 session props，不能完全忽略 tabProps 而读取最后更新的全局会话。抽屉宽度、关闭按钮和焦点按当前 PRD 处理，不能直接固定 328px 覆盖聊天。

**验证**：服务存在/不存在、Tab 创建/聚焦/关闭/重新启用、切主会话但旧 Tab 尚在、窄窗口及卸载残留 tab 均测试。

### 11.8 共享状态、编辑与输入框：保留模式，修复数据安全细节

参考 [动态 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/src/client.js>) 的 `S/useStore/Editor/sendToComposer/filteredNotes`。

**可以参考：**

- 小规模插件用闭包 store + 订阅让多个 Slot 共享 UI 状态，不必直接引入大型状态框架。
- 高亮点击先 view，再显式 edit，避免误改原文。
- UI 等 Host 返回成功后才把新记录加入列表。
- `sendToComposer` 追加内容到已有 draft，只 setDraft，不触发 Agent prompt。
- 同一 notes 集合按 session/workspace/all 查询，不为每个项目维护独立数据文件。

**Notebook 必须修正：**

1. store 推荐不可变 snapshot + selector/useSyncExternalStore 或同等订阅，减少任一变化刷新所有组件；服务权威数据与编辑草稿分离。
2. 原版 Editor.save 在 saved 为 null（保存失败）时仍 clear selection 并 close；Notebook 只有确认成功才退出，失败保留正文/标签/intentId。
3. 原版正文保存前 trim，Host 长度超限直接 slice（quote 2,000、note 4,000）；会丢空白或截断 Markdown。Notebook 用明确长度校验拒绝，禁止静默截断保存内容。
4. 原版选区 `text.replace(/\s+/g,' ').trim()` 会永久丢换行、代码缩进；新模型 exact 与 Quote 不能这样生成。
5. scope 选择 UI 不采用。原版实际上没有持久 scope 字段，而是创建时决定 sessionId/workspacePath 是否为空；Notebook 创建时保留真实来源或可选上下文，视图筛选不改变记录来源。
6. `filteredNotes` 缺少 sessionId/workspacePath 时退回全部；Notebook 应显示当前条件不可用，不能把“当前会话”悄悄变成全部。
7. `'> ' + quote` 只给第一行加引用前缀；复用共享 Markdown formatter 处理多行及代码围栏。
8. sendToComposer 必须在操作时读取最新草稿，不能用可能过期的全局缓存覆盖用户刚输入文字；setDraft 的宿主精确签名仍需查类型。
9. Esc/点击遮罩不能无提示丢草稿；焦点陷阱、可读标签、编辑返回确认和重复保存按钮状态都要补齐。

**建议保存控制（伪代码）：**

```ts
const saved = await notebook.create(frozenRequest)
if (!saved.ok) {
  setSaveError(saved.error)
  return // 不关闭、不清正文、不更换 requestId
}
applyCommittedRecord(saved.note)
closeEditor()
clearBrowserSelection()
```

**验证**：失败/断线不丢草稿，多次点击不重复创建；用户输入 draft 后立即追加不丢最后字符；引用多行安全格式化；无当前会话筛选不返回假“当前”数据。

### 11.9 Host 存储与通信：参考职责划分，不能沿用持久化方案

[动态 Host](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/src/host.js>) 通过 shell 定位 DSH_HOME，fs 失败后用 shell read/write，显式 `danger-full-access` policy。[常驻 Host](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/lib/index.js>) 则使用 Node fs 与同源 route，`writeFile(tmp)` 后 rename。二者不能统称为“同一种存储实现”。

**可以参考**：list/add/update/delete 集中在 Host，Client 显示明确 ok/error；一次写入失败的 rejection 不使后续队列永远拒绝；注册 route 保存 disposer 并卸载清理。

**不满足本 PRD 的具体行为：**

| 原版代码行为 | 风险 | Notebook 替代 |
|---|---|---|
| readAll 对读取错误/解析错误最终返回空数组 | 错误或损坏被当成空库，后续保存覆盖原数据 | 区分不存在与失败，损坏只读与恢复点 |
| `notes.push/splice`、target.note 先改 cache，再 await persist | 写失败也污染 Host 内存，后续写可能提交先前失败修改 | 队列内克隆候选，成功后发布权威缓存 |
| persist 才排队，序列化时读取共享可变 cache | 排队的是写文件，不是完整业务修改；缺少隔离 | 校验/版本/候选/提交全过程同一队列 |
| 无 version/revision/requestId | 多页面覆盖、重试重复创建 | 记录版本、全库 revision、持久幂等收据 |
| 常驻 temp+rename | 改善文件替换，但不证明 fsync 耐久/多 Host 协调 | Storage Domain 经验证的提交语义与单写者边界 |
| 请求体 chunks 无明确大小上限 | 可无限缓冲；slice 字段不限制请求总大小 | 传输层/Schema 同时限请求与备份体积 |
| sameOrigin 自写门，GET list 无该门 | 不等于统一连接鉴权；缺 header 允许，部署安全仍待核实 | 正式 Remote 或 connection 接口及其信任验证 |
| notes/delete 物理移除 | 无回收站恢复 | deletedAt、批量确认、受控永久删除 |
| diag 可日志记录 quote sample/任意参数 | 来源文本可能落入日志 | 默认仅错误码/数量/耗时，不记录正文样本 |

这里不声称已验证上游 API 可被未授权访问：实际部署是否还有外层鉴权未测试。但不能把 its sameOrigin 函数当成 Notebook 完整鉴权方案。

**实施策略**：在 Step 2 保留 Transport Adapter 边界，优先正式 Remote；若选 HTTP fallback，确认当前 connection fetch/register 与 request admission 合同，不直接复制上游旧式 prefix route 的参数形状。Step 3 完全用 Storage Domain 替换文件/shell 路径，仍执行失败缓存、进程中断和跨 Host 测试。

### 11.10 生命周期：参考常驻 teardown，同时补齐漏项

[常驻 Client](<https://github.com/iptton-ai/dsh-plugin-session-notes/blob/5f4ca2a268d4e24c2ab0ca662b4f5bdb54690b95/lib/client.js>) 最后返回 teardown，清理 CSS Highlight、MutationObserver、timers、style 和 document click。这比动态版匿名 click 监听更完整，可以作为资源清单参考。

Notebook 不使用 `window.__snoteDocClick` 这类全局变量去替换其它实例的监听，而是 context effect 持有具名 handler 与 removeEventListener。还需覆盖：

- 原版 restoreObserver 直接 window.setTimeout，并不在 snTimeout 的 timers Set 中；卸载前取消或 generation guard。
- requestAnimationFrame 句柄、异步请求取消、debounce pending、Range cache 与 context bridge。
- 右侧 Tab 类型、Slot body 与注入 scope 的双重 ownership。
- styles 仅在 apply/effect 登记；再次启用不增加第二份 stylesheet。

**验证**：连续启用/禁用 5 次、会话快速切换、RPC 未完成时卸载，监听数/observer/Highlight 注册回到初始状态，无延迟任务复活。

### 11.11 功能差异与移植优先级

上游记录基本字段为 id、sessionId、workspacePath/title、quote、note、createdAt/updatedAt。不能从现有实现推导标签字典、Markdown 源片段、messageId/TextAnchor、kind、版本锁、回收站、JSON 备份或跨会话来源导航已经具备。`revealNote` 只是当前会话已挂载 Range 的滚动，不是 Notebook 的完整来源回链。

**建议迁移顺序（对应现有 Step，不增加额外产品分支）：**

1. Step 1/2：参考 manifest/ModuleLoader/header Slot/Panel 复用；补齐本机合同，不安装上游来代替 Notebook。
2. Step 3/4：先重写 Storage Domain Repository、DTO/Schema、版本和幂等，再接任何创建按钮。
3. Step 5：参考 Anchor 与 Range 坐标，但加入 messageId、冻结来源、单消息约束和准确 exact。
4. Step 6/8：抽取间隙拼接及 fold map 思路为消息级纯模块，测试通过后实现高亮；另做 Markdown source mapping。
5. Step 8/9：参考 rect 命中和 view-first，去掉 `<mark>`、周期全量扫描及保存失败关闭。
6. Step 10–14：标签、查询、回链、导出、备份与迁移按本指南实现，不把上游没有的能力补成事实。
7. Step 15：重新跑 Web/Desktop 全矩阵；上游 `platform: web` 和版本注释不能替代兼容性结论。

若未来选择导入旧版数据，作为 P1 明确实现：旧 quote 只能标记 `plain_text`；没有 messageId/Anchor 不伪造精确定位；旧 note 按正文/引用有无映射为合法 NoteKind，保留原始备份及可追溯旧 ID；无法恢复已被折叠/截断的原文，必须提示迁移限制。它不是启用新插件时自动扫描/覆盖旧文件的行为。

### 11.12 参考实现引入后的回归用例

| 用例 | 目的 | 期望 |
|---|---|---|
| REF-01 跨 inline + P + BR | 验证 gap-aware 索引 | 选择/Range 映射一致，Quote 不折叠 |
| REF-02 两消息同文本 | 排除首命中误定位 | 只在来源 messageId 中命中 |
| REF-03 选区 A，切会话 B | 排除实时来源串写 | 保存仍绑定冻结来源，或明确取消 |
| REF-04 主 Chat + 侧栏 Chat | 验证多个 Slot 实例 | container/session/inputActions 不相互覆盖 |
| REF-05 写失败后继续修改另一笔记 | 验证缓存隔离 | 失败修改不随下一次提交混入 |
| REF-06 损坏读取后创建 | 排除空库覆盖 | 阻止写入，保留介质与恢复入口 |
| REF-07 保存响应丢失后重试 | 验证幂等 | 原记录返回，不重复创建 |
| REF-08 保存失败/按 Esc/点外部 | 验证草稿保护 | 不静默关闭并丢用户输入 |
| REF-09 未挂载高亮永久无法命中 | 排除持续自愈全扫描 | pending 状态，无每 5 秒无效重建 |
| REF-10 多行代码引用写入 draft | 验证 formatter 与最新草稿 | 原 draft 不丢，引用格式正确，不提交 |
| REF-11 disable/re-enable ×5 | 验证资源释放 | 无重叠监听、样式、Range、定时任务 |
| REF-12 Tab 服务缺失与恢复 | 验证等效 UI | fallback 可用，服务回来后无重复实例 |

**结论：** 参考项目适合提供“DSH UI 接入与 DOM 文本高亮”的起点，不能作为 Notebook 数据可靠性与产品模型的直接底座。优先复用算法思路与接缝组织，重写存储、消息锚点和业务模型。

## 12. 开发执行约束

- 每完成一步先补测试证据，再进入下一步；失败按实际限制修复，不用未验证的替代方案绕过门禁。
- 代码、构建与测试只在普通工作区完成；修改 Profile 必须通过授权的 Plugin Manager。
- 公共接口优先于内部源码耦合；必须读取具体类型再调用，不从 PRD 候选名称猜 API。
- 未来如果增加 Agent 操作，复用 NotebookService，不再写一套业务逻辑；用户授权/确认行为仍是用户专属。
- 当前状态以 §1.1、[Desktop 门禁矩阵](<./evidence/desktop-step-0-2-gate.md>)和[Step 3 运行时门禁](<./evidence/storage-runtime-gate.md>)为准：Desktop 加载与通信 Spike 已实现，Step 0–2 的实机证据未全部关闭；Step 3 **仅隔离实验进行中**且存在释放写锁后的互斥阻断，笔记生产业务尚未执行。历史“双端”要求按顶部范围调整解释。

---

相关入口：[产品功能文档](<./PRODUCT_REQUIREMENTS.md>) · [交互原型](<./UI_PROTOTYPE.html>) · [开发文档索引](<./developer/llms.txt>)
