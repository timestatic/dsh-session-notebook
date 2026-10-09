# Phase 0 开发证据

## 本轮状态（2026-10-02，Goal round 1）

round 1 按 [开发指南](<../DEVELOPMENT_GUIDE.md#L355-L389>) 开展 Step 0，建立声明证据、合成样本与会话操作方案。round 3 已创建并安装 Step 1 空 Bundle，见 [加载证据](<step-1-loading.md>)；Step 0 实际环境/会话任务与 Step 1 双端可见门禁仍未完成，没有业务保存或存储写入。不得把 Inspect 注册填为可见 UI 功能 PASS。

## 环境基线

| 项目 | 实际证据 | 状态 / 限制 |
|---|---|---|
| 当前 GUI | 运行上下文提供 `http://127.0.0.1:19387` | 未操作页面，不表示截图或浏览器验证 |
| 工作目录 | `pwd` 返回 `/Users/didi_1/IdeaProjects/mytest/dsh-session-notebook` | 已核验 |
| Host OS | `sw_vers -productVersion`: 14.2；`uname -m`: arm64 | macOS Host；不能推出另一客户端 OS |
| Profile | `DSH_PROFILE=desktop`；目录 `/Users/didi_1/.dsh/profiles/desktop` | Profile 名不证明当前连接页是 Desktop 窗口 |
| Node | `node --version`: v24.19.0；位于用户 nvm 的 v24.19.0 目录 | 终端开发工具，不代表 Desktop 内嵌 Node |
| 包管理器 | `command -v pnpm` 找到同一 nvm 目录下 pnpm | 尚未核验 pnpm 版本或固定工程工具链 |
| DSH 版本 | 文件 read 安装根 manifest 报 `Cannot mix BigInt and other types, use explicit conversions` | 待查；未用 shell 解包或绕过文件读取 |
| 存储实例 | Host Inspect 声明存在 storage/storageDomain | backend 实例、路由、路径、隔离与多 Host 排他未验证 |
| Desktop | 未独立连接和操作真实窗口 | NOT RUN；不能以当前 Web 查询替代 |

环境命令退出码为 0。未记录认证 token、历史消息、用户笔记。现有 staged/unstaged 文档变更保留，没有提交或覆盖用户改动。

## 能力清单与复现入口

先调用 `cordis_inspect_list`；下表参数均是本轮实际查询。Inspect 为只读声明查询，不能执行表中业务方法。原始完整返回保存在本会话工具记录；本报告保留相关精确合同摘要，不依赖临时 spill 文件。

| 能力 | 声明查询（platform / provider.method / input） | 本轮实际结果 | 实验 / 限制 |
|---|---|---|---|
| Client 加载 | client / Service.listService / `{}` | 存在 slots、locale、theme、uiWorkspace 等目录 | 插件加载 NOT RUN；下一步最小 Bundle |
| composer 入口 | client / Slots.listSubTree / `{"root":"conversation.composer.dock"}` | available；list/session；独立 id；提供 sessionId、useChat、useInput、inputActions | 没有本插件 occupant；简单入口待 Step 1 |
| 浮层 | client / Slots.listSubTree / `{"root":"shell.overlay"}` | available；list/root；独立 id；无 sessionId 标准 prop | session 桥接、可关闭空浮层待 Step 1/2 |
| Slot 生命周期 | client / Service.listService / `{"service":"slots"}` | inject(key,callback) 返回 disposer；callback 提供同步 disposer/迭代；owner collapse 释放、重建重新安装；register 是 context effect | 实际卸载/重启/无重复入口 NOT RUN |
| Tab | client / Slots.listSubTree / `{"root":"sidebar.right.pane.tab"}` | available；keyed/session；key 为 string；TabHookContext / SidebarRightTabInjected | 仅内容 Slot，不证明 type/instance 创建 API；待 Step 2 类型读取 |
| Assistant ID | client / Slots.listSubTree / `{"root":"conversation.chat.assistant-actions"}` | available；finalized message；owner.messageId: MessageId | 不证明用户消息 DOM 身份；局部选区归属待 Step 5 |
| Markdown 冷读 | host / Service.listService / `{"service":"sessionQuery"}` | readSession 返回 SessionLogSnapshot，不 making live；readSurface/readEvent 可用；user/message 是 UserMessage，assistant/message 的 message 是 AssistantMessage | 文本 block shape、message ID 和实际冷读未验证；不调用 resolveAgent |
| 输入框 | composer 标准 props | InputActions 与 useInput 声明存在 | 具体写入参数、最新草稿、追加/替换、不发送均 NOT RUN |
| 归档 | host / Service.listService / `{"service":"workspaceRegistry"}` | archiveSession / unarchiveSession；SessionRecord 没有 archived；Workspace 本轮展开无归档集合读取字段 | 不用侧栏缺席判断删除；不修改真实会话 |
| 导航 | client / Service.listService / `{}` | uiWorkspace.openSession(target): void；unarchiveSession(sessionId): Promise<void> | 历史挂载、定位和恢复确认 NOT RUN |
| 通信 | host / Service.listService / `{"service":"connection"}` | rpc.handle(channel,handler)，rpc.intercept('/api',matches,handler)，fetch.register(route) 均返回异步 disposer；handler 含 signal 和 peer；Fetch 支持 GET/HEAD/POST | 正式持久 Bundle Client 调用、鉴权、断线、取消待 Step 2；不另起裸 HTTP 服务 |
| 存储 | host / Service.listService / `{"service":"storageDomain"}` | open(spec)、get(name)、closeAll；global.get()/set(value)；Domain.close；invalidRecords 可选 backup-and-skip | 同名 already-open 仅 facility 内；无 CAS/fsync/多 Host 保证；写失败缓存待 Step 3 |
| backend | host / Service.listService / `{"service":"storage"}` | backend.register/get/names；KvUnit.setGlobal、loadAll、close；可选 backupRecord | 不等于原始损坏介质备份能力；不进入生产介质故障试验 |
| 配置/包目录 | host / Config.listConfigs / `{"name":"@deepseek-ai/dsh-storage-domain"}`，再 `{"entry":"include:storage-domain"}` | backend 必填 string；routes 可选映射；packageDir 指向 DSH 安装中的 storage-domain 包 | 配置 Schema 不提供实际配置值，未猜 backend |
| 包文档读取 | read Config 返回 packageDir 下 README | 同样报 BigInt 类型转换错误 | 待获取可读且版本匹配的文档入口；不冒充已读实现 |
| 主题 | client / Theme.listTokens / `{}` | bg-layer-1/2、bg-overlay、border-l1/l2、brand-primary、label-primary/secondary、state-error/success/warn 等 `--dsw-alias-*` | 只发现 token；两主题 UI/焦点未测试 |
| 下载 / 剪贴板 | 本轮无精确能力合同查询 | 未验证 | Web Blob、用户动作 Clipboard 及 Desktop 正式能力待后续；不存在于此目录不等于不支持 |

## 受控样本与测试会话方案

[选区合成样本](<../../tests/fixtures/selection-cases.json>) 包含 14 个固定样本、3 个生成规则和 9 个排除上下文。其 visibleSelection 是测试意图，尤其列表/表格的 DOM 分隔符需实际渲染后固定，不是已验证来源 Markdown。它不是可追加到 Session 的事件，也不是 NotebookSnapshot。

真实会话状态：**NOT RUN**。不得以样本文件替代创建会话证据。准备好可信操作接缝后按以下顺序执行，保存专用 sessionId、messageId、role、block coordinate 和截图：

1. 在本工作区创建两个专用会话 `SN-E2E-A`、`SN-E2E-B`，只提交合成文本；覆盖 user 和 committed assistant；不将真实历史复制到 Fixture。
2. 按 SEL-001 至 SEL-014 渲染并测试正向/反向/键盘选择；跨消息、输入框、Tool 和流式内容必须拒绝。
3. 展开 LIMIT-8000/8001 验证码点限制；PERF-LONG 单独展开，避免污染正常消息验收。
4. 用第三个专用会话 `SN-E2E-ARCHIVED` 验证归档冷读/确认恢复；实际操作前确认其无运行任务，绝不归档当前开发会话。
5. 用第四个专用会话 `SN-E2E-DELETED`，先保存本插件快照并验证备份，随后对这个专用来源执行删除确认，验证快照仍读；**删除实验在可靠存储建立之前不执行**。
6. 故障介质使用独立命名 `dsh-session-notebook-test-*`，禁止损坏生产 Profile 或终止当前真实 Host。无专用测试 Host/介质时故障用例保留 NOT RUN。

## 门禁与下一轮

- 已核验：工作目录、OS、Profile 变量、Node；当前服务/Slot 仍存在；样本只含合成内容。
- 待完成 Step 0：实际 Host 包版本、存储实例边界、两端独立基线、受控会话创建。round 2 已确认 CLI 与 Desktop 外壳版本不同，浏览器匿名入口为 401；详见 [Runtime 基线与连接实验](<runtime-baseline.md>)。用户选择提供已登录浏览器连接方式，随后连接详情回答为空，目前仍无新的可用连接信息。
- 下一步先建立版本匹配的可读 SDK/模板入口和页面操作能力；之后按 Step 1 制作 composer 入口与可关闭空浮层，安装时使用授权 Plugin Manager。
- 不跨越双端 Phase 0 门禁开展 Step 4 业务保存；不能把包读取故障当可靠性已通过，也不改 PRD 删除 Desktop 或受控恢复。
- 本轮没有运行项目 lint/build/test：工程脚本尚不存在。样本结构检查只验证 JSON 和样本边界，不证明插件业务规则。

## 本轮执行验证

- Node `assert/strict` 检查通过（退出码 0）：JSON 可解析；14 个固定样本、3 个生成规则 ID 唯一；角色仅 user/assistant；原文、选区与期望非空；8000/8001 emoji 生成后码点数精确；单字符拒绝样本和 CRLF 样本存在；9 个排除上下文。
- `git diff --check` 通过（退出码 0）；这是差异空白检查，不是业务测试。
- 使用 read 回读样本、证据与 README，确认内容落盘且 README 不宣称实现完成。
- 未安装依赖、启动替代服务、改 Profile、创建真实会话或执行破坏性实验；Goal 保持 active。
