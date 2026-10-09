# 第一版 MVP 执行记录

更新：2026-10-06。本记录沿用 [执行主线](../FIRST_MVP_PLAN.md)，不替代正式准出条件。

2026-10-06 新状态：0.0.16 已实现元数据加 data 文件存储、正式 Host 业务装配和文本锚点入口。用户已撤销首版等待 Storage Domain 的决定。以下旧的只读结论保留为历史记录；新方案见 [轻量文件存储证据](lightweight-notebook-0.0.16.md)。本地测试不替代用户的真实 Desktop 写入、重启读回和选区验收。

## A：当前批次

- 实际工作区基线为 0.0.15，不是计划编写时的 0.0.14；未变更版本、安装、启停或重启。
- 本轮加载插件开发 skill，读取 Host/UI/practices/user-actions 参考，调用 Inspect 发现并精确查询 Host storageDomain/connection、Client Service 目录和 sidebar.right.pane.tab。只读审查补核 storage/Config。目标参考 SDK 为 0.2.0-rc.2；不声称安装包本轮字节复核。
- 开始时检测到外部写入，停止编辑并询问。用户确认已停止其他写入后，重新读取最新保存控制器，保留已存在的 Promise.race 超时/卸载取消修复。
- 本轮修改保存控制器：支持手工标题、加载详情编辑、带 expectedVersion 更新；保留草稿和稳定请求 ID；已知 VERSION_CONFLICT/EPOCH_CONFLICT 禁止盲目重试，读取最新元数据后必须显式确认再建立新意图；COMMIT_UNKNOWN 不得冲突重基或直接重试。成功/明确丢弃后清除编辑身份。
- 正式 Host/Client **仍未接入持久保存**。保存控制器完成不代表 A 流程完成。

## A1/A2 的具体前置缺口（保持真实写入关闭）

1. 实际 backend/routes 值、专属 namespace 对应介质与单 Host/Profile 写者边界尚无证据。Config Inspect 给 schema 而非生效值；单 facility 单开不等于跨 Host 排他。JSON SDK 明确没有跨进程写锁。下一步只做受支持的定向诊断，不重开锁/worker/SQLite 实验。
2. 公开 Domain API 无法区分真实 ENOENT 与已有 missing/null global。JSON 解析将后者归 null，Domain 回退 initial；initial 仅内存，首次 set 才持久化。不得凭读到 initial 或捕获 open 错误推断缺库并覆盖。证据：[Domain 实现](../../.sdk-reference/storage-domain/package/lib/index.js)、[JSON 实现](../../.sdk-reference/storage-json/package/lib/index.js)。
3. 可继续实现 A3 自有 handle 生命周期与无依赖业务/Client 源码；未补上前置证据不得开放真实写入口，不以调用者布尔标记称边界已验证。

## D 的独立公开能力缺口

Domain/KvUnit 当前合同未发现全介质原始字节保护入口。backupRecord 只适用单条 table record，不保护损坏 global 或 open 失败的介质。JSON 逻辑导出不能冒充坏原件备份。此项不阻断其余源码工作，但必须闭合才能正式 MVP 准出。

## 本轮验证

- 保存控制器定向测试通过，含传输忽略 abort、卸载、迟到回复、稳定意图重试。
- npm run check：通过（语法检查，不是类型检查）。
- npm test：217/217 通过，新增编辑标题/版本冲突明确恢复、未知提交不可重基测试。
- npm run pack:check：首次默认 npm cache 因 EPERM 失败；未 sudo/chown，改用工作区可写 .npm-cache 后通过（dry-run，非已生成发布包）。
- git diff --check：通过。
- npm run test:integration：5/5 通过；明确其中一项验证正式 Host 仍只读，不能称正式保存已接。
- 单元全套包含历史存储/容量实验；执行现有门禁不表示重新开展专项，样本指标不作为本轮性能准出。
- Desktop：本轮未安装、启用、重启、保存或 HTTP 实测；历史证据不计本次验收。

## 续轮 1：A3 生命周期与读取超时

- 新增 `src/host/manual-runtime.js`，装配已打开的 Domain、同一 Service/协调器和精确路由。没有打开/初始化介质、注册 backend 或替换官方服务，也没有把传入 Domain 等同真实所有权证明。正式 Host 未调用它。
- 关闭同步拒绝新增业务写入并停用全部路由，排空已接收候选后关闭自己的 Domain；不调用全局 closeAll。路由/Domain 清理失败仍尝试后续清理，最终固定 CLOSE_FAILED，memoized close 不会二次释放或误报成功。
- 精确路由提供整体 stop，保留各自 ctx.effect disposer；两条路径都幂等，停用期间 retained handler 返回 404。
- Client API 给 list/get/backup 等所有调用增加实际本地超时和 caller abort 竞争；即使 carrier 忽略 abort 也结束等待，迟到 rejection 被观察，不泄露异常原文。
- 新增单元生命周期失败/排空测试及真实 Cordis + Domain + JSON backend 两轮卸载重开测试。真实连接 carrier 仍是明确模拟接缝，此测试不是 Desktop 验收。
- 定向首次 runtime 测试失败原因是测试用 ctx.set 未先 provide，改为真实 Cordis ctx.provide 并 await 实际 plugin fiber 后 4/4 通过；没有放宽生产注入权限。
- 本轮第一次完整门禁：check、220 单元、5 integration、35 runtime、pack dry-run、diff check 全通过。读取超时增量后再次全套通过：check、222 单元、5 integration、35 runtime、pack dry-run、diff check，全部退出码 0。

## 续轮 2：A7 宿主关闭与上下文切换草稿保护

- 重新 Inspect 原生标签 slot；固定 SDK 的 tab actions 只有 close，没有 before-close veto。未篡改宿主关闭操作、未接管根节点。
- 正式 Client 现有草稿由插件 owner 的 Map 持有，而非面板组件；宿主直接关闭/重挂载保留原正文，会话切换立即读对应键，A/B 草稿隔离，明确丢弃仅清当前草稿。全局 overlay 草稿同样保留。该 Map 仅 transient 草稿，不是已保存笔记权威库。
- 有正文时注册浏览器 beforeunload 警告，丢弃后不拦截，插件卸载清理监听器和 Map。浏览器是否显示对话框取决于运行环境；不能称 Desktop 关闭/退出已保护。刷新和插件卸载草稿不持久化，界面明确提示，不能以此替代正式保存。
- 新增组件重挂载、复用组件切会话、显式丢弃、刷新警告和监听器释放回归。现有复制、关闭确认、迟到 clipboard、焦点测试继续通过。
- 最终门禁：check、223/223 单元、5/5 integration、pack dry-run 和 diff check 全通过，退出码 0。本轮无 Host Domain 改动，未重复 runtime；上一轮 35/35 证据范围不变。
- 未安装、启停、重启或实测 Desktop；版本仍 0.0.15。正式保存与安全 Markdown 预览尚未挂载，A 不能勾选完成。

## 续轮 3：A 基础安全 Markdown 预览

- 在正式 [Client 草稿组件](../../src/client/index.js)接入折叠预览，支持标题、加粗、行内代码、围栏代码、任务列表、基本列表、HTTP(S) 链接和普通段落。仅基础子集，不声称完整 CommonMark；HTML、图片、未支持语法按文字显示。
- 全程 React 元素和文本节点，无 HTML 注入入口；不加载图片。链接仅允许绝对 HTTP(S)，拒绝凭据及控制字符，打开使用 noopener/noreferrer/no-referrer。预览不改变原始草稿或触发保存。
- [新增测试](../../tests/unit/safe-preview.test.js)通过实际草稿入口验证预览结构和恶意输入。最终 check、225/225 单元、5/5 integration、pack dry-run、diff check 全通过，退出码 0。
- 未安装、启停、重启或进行浏览器可视验收。实际 Desktop 不因源码变化自动升级。保存闭环仍未接，A–D 不算完成。

## 续轮 4：可重复执行的隔离手工往返测试

- 关闭 query 接受 `trashOnly/timeField/from/to` 却静默忽略的缺口；仅回收站隔离，创建/更新时间比较使用带显式时区的包含式瞬时边界，非法/倒置时间或冲突模式拒绝。回归中组合来源约束，2026 年范围及非法日期；之前的 review 复现不再成立。
- 上轮开始的选区两个非空白 Unicode 码点与标签重命名先 trim 改动均通过定向测试；这仅是候选逻辑，不算 B/C 流程完成。
- 新增端到端隔离集成路径：真实 `manualSaveController → previewApi → /api 精确 RPC 信封 → Host service → Cordis Domain/JSON backend`，完成标题和正文创建、列表、详情、标题/正文更新、完整 JSON 内容检查、关闭重开后读回。测试 `npm run test:integration` 可重复运行，共 6/6 通过。
- 此测试使用工作区 `.storage-test-output` 专用临时介质与 mock Connection carrier；不调用正式 Host 写入口，不依赖 Desktop，也不证明实际 Profile 单写者、认证、真实缺库初始化或原介质保护。正式入口依旧 `storageReady: false`。
- 使用可写 `.npm-cache` 的 `npm run check`、`npm test` (226/226)、`npm run pack:check`、`git diff --check` 及增量前的 integration (5/5) 通过；新增往返后 integration 6/6 通过。最终门禁再次执行完成：check、226/226 单元、pack dry-run、diff check、6/6 integration、35/35 runtime 均通过，全部退出码 0。

## 如何复现当前可测试范围

在仓库根目录运行 `npm run test:mvp-manual`：7 个精确 Notebook RPC/手工闭环集成用例和 1 个真实 Cordis Domain 双周期卸载/读回用例，总计 8 个测试。产生的数据仅在工作区 `.storage-test-output` 的测试隔离目录。该脚本仅对正式 Host entry 做只读路由断言，不打开正式 Host 写入口；不读取 Profile、不修改 Desktop 用户笔记、不安装或启用插件。可以测试手工 DTO、RPC、服务、Domain、重开及资源释放；**不能**测试真实 Desktop 的认证、界面按钮、真实缺库判定、唯一写者或受控恢复。

## 续轮 5：用户要求“继续开发，直到可以测试”

- 增加 `npm run test:mvp-manual`，单命令可独立验证 7 个用例；本次 7/7 通过。
- 修改 package.json 后再次执行全部门禁：check、226/226 单元、pack dry-run、diff check、6/6 integration、35/35 runtime 均通过，退出码 0。测试使用当前工作区目录，未安装或启用 Desktop 插件。
- **可测试的是隔离手工往返，不是完整 MVP，也不是 Desktop UI 手工保存。** 尚无正式 Host 写入口与唯一写 Host、确实缺库区分的运行时证据；生产界面继续显示不可保存。计划 A 的安全门禁不允许为“能测试”而放开用户介质写入。

## 续轮 6：丢失回复的端到端失败分支

- 隔离往返添加 Host 已提交且 RPC 回复丢失的模拟：Controller 保留原正文和请求 ID，Client 重试同一意图，Host 读取持久收据；revision 不重复递增、笔记不重复创建。`npm run test:mvp-manual` 8/8 通过。
- 进一步在真实 Cordis Domain/JSON backend 的完整 Controller 往返中模拟首次创建落盘后丢失 RPC 回复：草稿与请求 ID 保留；重试后 revision=1、持久收据仅 1 条，再完成编辑、备份、关闭重开读回。另保留内存 Domain 的单独失败分支；模拟 Connection 仍不是正式 Desktop carrier 或跨进程故障试验。
- 增强真实 SDK 往返后完整门禁再次通过：check、226/226 单元、pack dry-run、diff check、7/7 integration、35/35 runtime；均退出码 0。

## 续轮 7：D 的 Markdown 导出候选补强

- 纯 Markdown 导出补全导出时间、笔记总数、会话/工作区标题以及带时区的时间展示；增加 `includeTags/includeSource/includeIds/includeTimes/includeQuote` 五个可选内容开关（默认包含全部），未知/错误选项显式拒绝。引用和正文保持原始 Markdown 或安全纯文本围栏，导出顺序继续由查询顺序确定。
- 定向测试 6/6，修改后 check、227/227 单元、pack dry-run、diff check、7/7 integration 均通过，退出码 0；本轮没有 Domain/生命周期修改，不把上一轮 35/35 runtime 当作本轮重复运行。
- 该功能仍是导出候选：文件保存入口和 Client 选项 UI 尚未接入，不称 D 已完成。

## 续轮 8：A 的标题草稿输入与保护

- 正式 Client 草稿加入手工标题字段（最长 1000 字符，与 Snapshot 标题字段上限对齐），与正文一起按面板会话留存、显式丢弃清除。仅填写标题时，宿主面板按钮、overlay 关闭、编辑器丢弃以及浏览器 beforeunload 都按未保存草稿处理。
- 新增标题单独填写后面板重挂载、关闭确认、取消、丢弃与卸载提示回归；草稿面板仍然是**内存草稿且不发送写入**，正式 Host health/list 依旧只读，未绕过 A1/A2 安全门禁。
- 定向草稿/预览测试 10/10；check、228/228 单元、pack dry-run、diff check、7/7 integration 全部通过（退出码 0）。本轮未变更 Domain/Host 生命周期，不将早前 runtime 结果冒充本轮实测；未安装/启用插件、未实测 Desktop。

## 续轮 9：A 的 JSON 文件出口候选

- 新增独立 `client/backup-file.js`：在已有 Host `manual/backup` 返回后，用原格式完整校验、UTF-8 字节与 revision 校验生成 JSON Blob；用户动作下载时使用临时 Blob URL 并在点击成功/异常后 revoke，不使用全局 fetch、宿主文件路径或 Profile 写入。
- 隔离 Cordis Domain → Service → 精确 RPC → Client backup → JSON Blob → Schema 读回往返通过；额外单元覆盖回收站、字节/版本不匹配、损坏 JSON、超限及点击失败释放临时 URL。`npm run test:mvp-manual` 8/8，文件适配定向 3/3，修改后 check、231/231 单元、pack dry-run、diff check、7/7 integration 全部退出码 0；未修改 Domain/生命周期，不将历史 runtime 结果称为本轮实测。全门禁测试后 `.storage-test-output` 约 2.7 MiB，没有重新制造 76 GB 大文件。
- **尚未接正式 Client 文件按钮或正式 Host backup 路由**；隔离文件可测不等于 Desktop 可下载，也不等于 D 的整库恢复完成。未安装、启用或修改 Profile。

## 续轮 10：手工编辑冲突读取及用户显式确认候选

- 保存控制器在明确的 `VERSION_CONFLICT/EPOCH_CONFLICT` 后新增 `inspectConflict()`：使用已存在的 Client API 读取最新列表 epoch/revision 和编辑目标详情，检查两次读取的代际/修订号一致后提供原文与本地草稿并排比较的 DTO。超时即使 carrier 忽略 abort 也终止等待；取消、详情消失或期间版本变化拒绝形成确认候选。读取不清空草稿、不自动提交。
- `resolveConflictConfirmed` 现在只接受刚由 Host 读取的 epoch/revision/note version，拒绝调用者伪造“最新版”；确认后才清原冲突请求并允许用新请求 ID 提交。`COMMIT_UNKNOWN` 仍无法重基或盲目重试，组件卸载中止冲突读取。新增单元和通过精确路由的实际 Service 并发编辑集成用例。
- 定向 9/9 控制器、8/8 integration、9/9 `test:mvp-manual`；check、233/233 单元、pack dry-run、diff check 均通过（退出码 0）。测试目录当前约 4.1 MiB。Client 实际界面与正式 Host 写入口仍未接入，故这不是 Desktop 版本冲突可视操作验收；未安装或改变 Profile。

## 续轮 11：待重试意图与收据的引用隔离

- 审阅保存控制器发现 `snapshot()`/`onChange` 暴露可变 pending/receipt，`send` 直接向 RPC 传入同一意图引用，测试替身或显示层可将下一次重试的请求改写，而 Host 收据哈希只识别实际到达的版本。现在状态快照与回调深复制意图/收据，RPC 每次取得隔离副本；收到收据先验证 epoch、revision 增量和 noteId，再清草稿。异常“成功”响应保留原待重试意图与正文。
- 新增状态/传输篡改与畸形收据单测，定向控制器 11/11；check、235/235 单元、pack dry-run、diff check、8/8 integration、9/9 `test:mvp-manual` 均退出码 0。运行后 `.storage-test-output` 约 5.5 MiB；现有少量其他测试目录仍逐轮增长，后续改动落盘用例必须自行 finally 清理。
- 核对计划 A1/A2：宿主实际介质、专属命名空间、单 Host/Profile 写者及原始介质缺失/损坏区分仍未完成；实验性独立 backend/锁释放存在明确故障反例，不能升格为正式写入。正式 Host 只读、Client 仍只有内存草稿；未部署也未修改 Profile。

## 下一步

继续 A：草稿保护、正式手工界面和最小存储前置证据。A3 已实现隔离装配与 SDK 生命周期测试，但正式入口未接，不能勾选 A 完成。B/C/D 与集中 Desktop 验收均未完成，不宣称 MVP 完成。

## 续轮 12：清理偏离项与来源定位修正

- 删除未被脚本或文档引用的独立规模基准 `tests/query-benchmark.mjs` 和旧 Web 探针 `tests/probe-old-web-client.mjs`。两者原为未跟踪文件；保留已被历史证据引用的诊断工具、存储实验和 A–D 候选模块。
- 修复 Anchor 定位：旧 UTF-16 偏移处的 exact 仍相同时，也核对已保存的前后文。上下文不符时仅在唯一可靠候选上重新定位；否则报告缺失或歧义。新增“原偏移词未变、前后文已变”的回归。
- 手工运行时、SQLite 隔离测试和独立容量探针清理各自创建的目录，清理回调在测试目录创建后立即注册。两轮手工运行时/SQLite 定向测试各 7/7，通过后这两类目录总数未增长。完整门禁之后 `.storage-test-output` 尚有 490 个历史及其他用例目录、约 9.7 MiB；本轮没有将它们整体删除，也未声称其他测试用例已全部实现清理。
- `npm run check`、`npm test`（236/236）、`npm run test:integration`（8/8）、`npm run test:runtime`（35/35）、`npm run pack:check`、`git diff --check` 通过。首次 pack 检查因默认 npm 缓存 EPERM 失败；改用可写的临时缓存重跑通过。未安装、启用、重启或进行 Desktop 实测。
- A 的正式保存仍受真实介质缺失判定、唯一 Host/Profile 写者及认证边界证据约束；正式 Host 仍仅提供只读 health/list。Anchor 修正只是 B 的候选逻辑，不代表高亮已接入。

## 续轮 13：隔离测试产物收敛与正式 Client 接缝核对

- 将 `medium-guard`、`guarded-sdk`、`guarded-domain` 三组测试创建的每个临时目录绑定到对应 `node:test` 用例的 `t.after`，并在 `mkdtemp` 后立即登记；用例失败时也由测试框架清理。两轮定向运行各 26/26 通过，这三组目录计数均为 203，没有新增残留；历史目录没有被批量删除。
- 正式 Client 入口当前是单个 `window.__ModuleLoader__.load` 脚本，只在 factory 中 `require('react')`。现有保存控制器和 RPC adapter 是 ESM 候选模块，打包进 npm 不等于该入口能加载它们。未验证模块装载/构建合同前，不在入口复制第二套保存逻辑；正式保存按钮仍未开放。

## 续轮 14：正式 Client 模块生成接缝

- 新增 `src/client/index.template.js` 与无外部依赖的固定生成脚本 `scripts/build-client.mjs`。生成器只接受两个无 import 的已知 ESM 模块：`preview-api.js` 和 `manual-save-controller.js`；若源码出现不支持的导入或导出，构建显式失败。生成文件仍是宿主原有的 `window.__ModuleLoader__.load` 入口，factory 依旧只向宿主 require React；两个业务函数来自各自唯一源码，不再需要在页面脚本里复制实现。
- `npm run build:client` 重建 `src/client/index.js`，`npm run check` 首先校验生成文件未过期。现有 17 项正式 Client/预览/连接定向回归通过。生成接缝尚未把保存按钮或读写路由开放；Host 仍返回 `storageReady: false`。
- 尝试通过默认 npm 镜像安装固定构建器失败，原因是域名无法解析；官方 registry 的提权请求因自动审批服务容量不足而未执行。固定生成脚本不依赖这次安装，未添加第三方构建依赖。

## 续轮 15：A 的正式 Client 界面接入（Host 就绪门禁后）

- 正式 Client 模板在 Host 返回 `phase: 1`、`storageReady: true` 且 `manual/list` 结构通过 Client adapter 校验后，才显示手工保存、列表、详情和编辑控件。当前正式 Host 仍返回 Phase 0，因此真实运行时不会开放这些写控件；没有凭前端健康标记自行打开正式路由。
- 界面使用同一份 `previewApi` 和 `manualSaveController`。创建前读最新 revision；保存中锁定草稿，成功后刷新列表与详情；失败保留正文和原请求 ID。丢失回复时同意图重试。已知版本冲突先读取并展示服务器正文与本地草稿，再由用户显式确认重基；`COMMIT_UNKNOWN` 不提供盲重试。
- 面板卸载时控制器的 `cancel()` 结束等待，但保留待重试意图；插件 owner 继续持有各会话草稿和控制器。插件卸载才 dispose 全部控制器。Phase 0 下仍只显示原内存草稿、复制和安全预览。
- 新增正式生成入口的隔离 UI 回归：Phase 0 不触及 manual API、虚假的就绪但畸形列表拒绝开放、创建/详情、丢失回复同 ID 重试、编辑、预检期间锁草稿、版本冲突显式确认。真实 Desktop、宿主认证、实际存储所有权与重启读回仍未验证；A 不能标为完成。
- 就绪时列表在编辑器未展开前也可见；详情可返回列表。预检 revision 时立即锁住草稿，避免等待期间的修改被旧提交成功清掉。卸载后的旧按钮处理器不再发起新保存；用户诊断只显示固定码。Phase 0 的版本和未开放提示保持原语义，就绪后切换为 Phase 1 显示。
- 最终本地门禁：`npm run check`、245/245 单元、8/8 集成、35/35 runtime、pack dry-run、`git diff --check` 及本批暂存代码差异检查均通过。这里的 Phase 1 Host 是测试模拟；正式 Host 未切换，Desktop 无本轮真实保存证据。

## 续轮 16：D 的来源 ID 导出开关

- 依 PRD FR-085，把 Markdown 导出中的来源标题/工作区路径与 Session ID/Message ID 拆成两个独立选项。新增 `includeSourceIds`，默认包含来源 ID；原有 `includeIds` 继续控制笔记自身 ID。关闭来源 ID 时仍能保留可阅读的来源标题和路径。
- 定向导出测试 6/6，完整单元测试 245/245，`npm run check`、`git diff --check` 均通过。`pack:check` 首次因默认 npm 缓存 EPERM 失败；改用 `/private/tmp/dsh-notebook-npm-cache` 重跑成功。未修改 Domain 或 Host 生命周期，本轮没有重复运行 runtime/集成测试，也没有 Desktop 实机验收。
- 正式 Client 导出入口仍未接入。核对目标 SDK 后，公开 Domain API 仍无法证明真实介质缺失、实际 backend/namespace 和跨 Profile 唯一写者；正式 Host 保持 Phase 0 只读，A、D 均不能标为完成。

## 续轮 17：就绪后手工列表的关键词入口

- 正式 Client 在 Phase 1 且已通过 `manual/list` 结构校验后，显示手工笔记关键词搜索与清除筛选。搜索沿用现有 `manual/list` RPC 和 Service 的 `queryNotes`，不引入 global fetch 或第二份列表状态；晚到的旧列表响应不会覆盖较新的筛选结果。切换面板会话时清除旧搜索条件。
- 隔离 UI 测试新增关键词、空结果、清除筛选和乱序响应；定向 9/9，通过后完整 `npm run check`、246/246 单元、8/8 集成、35/35 runtime、pack dry-run 和 `git diff --check` 均通过。该测试以模拟 Phase 1 Host 检查界面行为，不是 Desktop 实机搜索验收。
- 目前只覆盖手工笔记的关键词查询。C 的跨会话全库、标签/时间筛选、回收站与批量操作仍未接入。正式 Host 继续 Phase 0 只读，A 的存储和运行时门禁未解除。

## 续轮 18：就绪后 JSON 备份下载入口

- 在现有固定 Client 生成脚本中加入已知模块图：Snapshot 校验、JSON 备份校验和文件下载适配器。生成器只接受当前明确的 import/export 结构，变动时失败；正式 ModuleLoader Client 继续只向宿主 `require('react')`，没有增加运行时依赖或第二套备份校验实现。
- Phase 1 已校验界面显示“下载已保存笔记的 JSON 备份”。用户点击后经宿主 RPC 调用 `manual/backup`，完整校验格式、字段、字节数和 revision，再创建 UTF-8 Blob 并发起下载；随后释放临时 URL。无效备份或卸载后的迟到响应不发起下载。提示仅说“已发起下载”，不把点击视为磁盘落盘成功。
- 定向 UI/文件测试 14/14；`npm run check`、248/248 单元、8/8 集成、35/35 runtime、pack dry-run、`git diff --check` 均通过。这里的 Phase 1 是模拟 Host；正式 Host 仍处于 Phase 0，只读备份路由未挂载，未进行 Desktop 文件下载验收。A 的 JSON 出口源码已接入 Client 门禁，正式可用仍取决于 A1/A2 的存储证据和运行时验收。D 的受控整库恢复尚未实现。
- 追加重复点击回归后，248/248 单元和必需的 check、pack dry-run、diff check 重跑通过；不把前一次 runtime/集成结果称为本次重跑。只读核对 Desktop Profile：清单与已安装包均标为 0.0.15，但已安装 Client 文件约 17.7 KiB，本轮生成的 Client 约 70 KiB，说明版本号相同不能证明最新源码已进入 Desktop。`dsh --profile desktop --dump-default-config` 明确拒绝 CLI 读取受 Electron 管理的 Profile；没有借该命令声称得到实际存储配置。

## 续轮 19：全库只读查询的单链路

- 在原 `manualNotebookService` 所持有的同一 Snapshot 协调器上增加 `library(filter)`，复用 `queryNotes` 取得全部/会话/工作区、关键词、类型、标签、时间、回收站和分页结果，返回列表项与选中项可见性。没有增设并行权威库，也没有让只读查询写 Domain。
- 通过 `connection.fetch.register` 增加唯一精确 POST 路由 `/api/dsh-session-notebook/library/query`，沿用现有 RPC 信封、admit 认证/信任检查、取消与 disposer。Client adapter 仍调用 `ctx.connection.rpc.call('/api', ...)`；对结果的 ID、页、选中项和列表字段做结构校验。正式 Host `index.js` 未挂载该候选路由，仍只读 Phase 0。
- 新增 Service、畸形响应、真实 Cordis Domain/JSON backend 与精确 RPC 往返测试。真实 SDK 路由测试在 Gateway 先后加载的两种顺序中验证 `settings/describe` 身份和返回不变，并覆盖两轮卸载。新增路由后两处生命周期测试的预期路由数从 5 更新为 6；首次全量门禁因此失败，修订后定向及全量重跑通过。
- 最终 `npm run check`、250/250 单元、8/8 集成、35/35 runtime、pack dry-run、`git diff --check` 均退出码 0。全库查询尚未接 Client 列表 UI，未在实际 Desktop/Web 安装验收；C 的写操作与来源/输入框流程也未完成。

## 续轮 20：就绪后笔记库筛选与批量选择界面

- 正式 Client 的 Phase 1 手工面板加入可展开的全库视图；打开后才调用 `library/query`。全球入口默认全部笔记；会话面板可按真实 sessionId 和唯一工作区成员路径筛选。界面接关键词、类型、标签多选 AND/OR、无标签、仅回收站、含时区 ISO 时间边界、更新/创建/工作区/标签排序和每页 50 条的前后翻页。未提供会话 ID 字典序排序或本轮暂缓的来源状态筛选。
- Service 查询响应增加活跃标签目录与使用数量，直接从同一份 Snapshot 派生；Client 对目录结构做校验。列表可逐条勾选、全选当前筛选的全部结果、清空选择，并显示筛选后隐藏的已选数量。晚到查询响应由请求序号/取消保护；卸载中止请求。列表只展示受 React 文本节点保护的摘要和来源，不改变笔记或来源。
- 新增独立 UI 回归验证 Phase 0 不触发全库查询、Phase 1 会话/工作区/类型/标签/时间/回收站组合、分页和隐藏选择。`npm run check`、252/252 单元、8/8 集成、35/35 runtime、pack dry-run、`git diff --check` 通过。这里仍是模拟 Phase 1 Host，正式 Host 保持 Phase 0；真实 Desktop/Web 未安装验收。C 的标签修改、删除、来源/输入框操作及 Markdown 导出 UI 未完成。

## 续轮 21：标签管理候选 Service 与精确 RPC

- 在同一 Snapshot 协调器上增加标签列表、合并/删除影响预览、新建、重命名、合并和删除。标签新建使用 epoch 与 requestId 派生稳定 ID；四类写操作都记录持久收据，同一请求丢失回复后可用原请求 ID 重试。重命名和新建共用名称规范化与冲突检查。
- 合并与删除在提交时重新计算影响，要求请求携带完全一致的预览，覆盖 revision、标签版本、活动及回收站影响数、快捷及最近使用引用。预览过期或不匹配时返回固定 `CONFIRM_REQUIRED`；写入仍由同一个队列整体提交。
- 增加精确的 `tags/*` POST 候选路由与 Client RPC adapter，继续走宿主 `/api` carrier 和原认证/信任检查。实际 Cordis Domain/JSON backend 往返、新建/删除、非法预览、认证失败、Gateway 前后加载和两轮卸载已通过测试。生产 Host 尚未挂载候选路由，正式界面也未显示标签管理；不能把候选链路称作已可用功能。
- `npm run check`、254/254 单元、8/8 集成、35/35 runtime、`npm run pack:check` 和 `git diff --check` 均退出码 0。打包版本仍是 0.0.15；本轮未安装、启用或进行 Desktop/Web 真实通信验收。A1/A2 存储前置条件及 C 的标签界面、回收站/来源操作仍未完成。

## 续轮 22：Phase 1 标签管理界面

- 笔记库增加标签管理区，展示每个标签在正常笔记和回收站笔记中的使用数。可新建、重命名、合并和删除；新建和重命名在提交前 trim 名称。合并与删除须先显示影响数，再由用户确认；提交使用该预览的 epoch/revision，避免误用较旧标签列表的 revision。
- 标签写请求在插件 owner 中保留原请求 ID 和完整 payload。传输失败、超时或卸载取消后，界面仅提供同一请求重试；`COMMIT_UNKNOWN` 不提供盲重试。成功后刷新标签目录和当前笔记库筛选结果。切换操作或字段后，旧的预览响应不会重新显示。
- 新增隔离 UI 回归：Phase 0 不开放入口、创建前 trim、丢失回复后同意图重试且只写一次、合并先预览正常/回收站影响、列表 revision 在预览前变化时以预览 revision 提交。完整 `npm run check`、单元/集成/runtime 测试、`npm run pack:check` 与 `git diff --check` 均通过。
- 界面仍受 Phase 1 就绪门禁控制。正式 Host 未挂载候选标签路由，真实 Desktop/Web 未验收；这不是已开放的正式标签功能。C 的删除/恢复、来源与输入框操作，以及 A 的存储前置证据仍未完成。

## 续轮 23：回收站与永久删除的候选完整链路

- 复用 `note-domain` 的批量 `changeNotes` 与永久删除变换，在同一 Snapshot 协调器中增加 `notes/preview`、`notes/apply` 两个精确 RPC 候选路由。预览对 1–200 个有序 ID 返回 epoch、revision、标题、类型与版本；提交须显式确认，写队列内再次核对整个预览。旧 revision、伪造条目、取消确认均不提交。普通删除只设置 `deletedAt`，恢复清除该字段；永久删除只接受已在回收站的条目。
- Phase 1 笔记库已选条目可先预览，再移入回收站、恢复或永久删除。预览显示数量、每条标题和版本；取消不写。一次确认提交整个批次。传输失败后在插件 owner 保留原请求 ID 与 payload，重试仅重发同一意图；`COMMIT_UNKNOWN` 不提供盲重试。成功后刷新当前列表和选择。
- 定向测试覆盖批量原子性、持久收据、真实 Cordis Domain/JSON backend RPC 往返、Gateway 共存、取消确认、丢失回复同请求重试，以及恢复和永久删除。`npm run check`、完整单元/集成/runtime 测试、`npm run pack:check`、`git diff --check` 全部退出码 0。
- 正式 Host 仍只读 Phase 0，以上写路由尚未挂载；真实 Desktop 未运行或验收。删除后高亮移除依赖 B 的持久高亮接入，当前不能宣称已实现。A 的存储前置证据与 C 的来源/输入框操作、类型转换等仍未完成。

## 续轮 24：笔记类型转换候选完整链路

- 增加所有正常笔记的只读详情 `notes/get` 与转换 `notes/convert` 精确 RPC 候选路由；仍由原 Service 和 Snapshot 协调器持有，不引入第二套模型或写队列。转换使用原 ID、引用、锚点、来源、标签和创建时间。转换收据含 `noteId`，Client 按该精确 ID 校验；首次集成测试因此发现误用标签收据校验并已修正。
- Phase 1 笔记库卡片可打开转换草稿。划线转 note 的正文先为空，非空才允许保存；转 manual 时可从原文引用初始化草稿。已有正文退回划线前须勾选明确移除确认；没有引用的手工笔记不提供无效目标。转换草稿在插件 owner 中保留，关闭面板后不丢失；已编辑草稿或待重试请求触发离页提醒，插件卸载/页面刷新仍可能丢失，界面明确提示。
- 传输失败或超时保留原请求 ID 与 payload 供同意图重试；`COMMIT_UNKNOWN` 不提供盲重试。版本冲突时显示最新服务器正文和本地草稿，用户显式确认后才用新 revision/version 建立新意图。取消、空白正文或未确认移除正文都不改变原笔记。
- 单元/集成/runtime 定向及完整门禁通过：`npm run check`、266/266 单元、8/8 集成、35/35 runtime、`npm run pack:check`、`git diff --check` 均退出码 0。正式 Host 仍为 Phase 0，候选路由未挂载，未做 Desktop 真实通信验收；A 存储前置证据、B 消息选区/高亮以及 C 来源和输入框操作仍待完成。

## 续轮 25：来源会话打开与归档确认

- 只读核对本机 Desktop 应用包：`Info.plist` 与内置 DSH 包标识为 0.2.0-rc.2；全局 CLI 另为 0.1.5-rc.1。本轮按应用包内 `dsh-client-ui-workspace` 的 `openSession`、`unarchiveSession` 和会话列表快照实现来源回链，没有把旧 CLI 的接口视为 Desktop 合同。应用包版本不证明当前运行实例已加载该源码。
- Phase 1 笔记库卡片显示已保存的会话标题/ID 和工作区路径。活动来源调用宿主 `uiWorkspace.openSession`；归档来源先显示确认，再调用宿主 `unarchiveSession` 并打开。取消不恢复。来源缺失或导航失败只显示固定提示，保留来源信息。切换上下文或卸载后，迟到的恢复结果不会继续打开会话。
- 定向界面测试 10/10；完整 `npm run check`、267/267 单元、8/8 集成、35/35 runtime、pack dry-run 和 `git diff --check` 均退出码 0。正式 Host 仍只读 Phase 0，因此这条界面分支尚未在真实 Desktop 开放或验收。消息级定位、引用复制、最新输入草稿操作仍待开发；A1/A2 存储门禁未解除。

## 续轮 26：完整 Markdown 复制链路

- 在现有 Service 上复用 `markdown-export.js`，按 Client 所见 epoch/revision 读取完整笔记及引用，返回 UTF-8 字节数；版本变化时拒绝。新增精确 `markdown/export` POST 候选路由，仍经宿主 carrier、原认证/信任检查和同一 Snapshot 所有者；正式 Host 未挂载它。
- Phase 1 笔记库卡片加入“复制 Markdown”。点击后从 Host 获取完整格式内容，再写系统剪贴板；不从 240 字符列表摘要拼凑。不可复制或剪贴板失败时只显示固定提示，卸载和上下文切换取消待处理读取。
- 单元覆盖完整引用、UTF-8 字节、旧 revision、畸形响应及剪贴板失败；真实 Cordis Domain 的隔离集成往返覆盖精确 RPC 与两条笔记的导出顺序。新增路由后，生命周期测试的路由数预期从 16 调为 17。首次全量单元测试因此失败，修订该预期后重新执行全套门禁；最终 `npm run check`、270/270 单元、8/8 集成、35/35 runtime、pack dry-run 和 `git diff --check` 均退出码 0。Gateway 前后加载两种顺序、两轮卸载和新增路由未认证拒绝的定向测试也通过。
- 卡片复制只覆盖正常笔记。回收站复制、Markdown 文件下载与导出选项 UI、最新输入草稿追加/替换尚未完成。正式 Host 仍只读 Phase 0；没有 Desktop 文件、剪贴板或认证实测。

## 续轮 27：Markdown 文件下载与内容选项候选

- Phase 1 笔记库增加单条和已选笔记的 Markdown 文件下载入口。导出前可控制标签、来源、会话与消息 ID、时间和原文引用；默认全部包含。下载时重新取得当前排序下全部正常笔记的 ID，包含被当前筛选隐藏但仍已勾选的笔记；旧 revision 或已选项不再正常可用时拒绝，不静默少导。Host 仍用同一个 `markdown/export` 候选路由和 `markdown-export.js` 格式结果。
- 新增 `client/markdown-file.js`，校验 UTF-8 字节并创建一个 `.md` Blob。用户点击后经临时 Blob URL 发起下载并立即释放；界面仅报告“已发起下载”，不把点击视为磁盘落盘。此适配器当前技术上限为 8 MiB，不是批准的产品容量上限。生成 Client 和打包清单已包含它。
- 定向 UI 测试覆盖内容选项、顺序、筛选隐藏的已选项和单文件下载；文件适配器测试覆盖 UTF-8 内容、字节错误及点击失败时 URL 释放。真实 Cordis Domain 集成往返检查导出结果可形成同内容 Markdown Blob。`npm run check`、274/274 单元、8/8 集成、35/35 runtime、pack dry-run 和 `git diff --check` 均退出码 0。
- 正式 Host 仍只读 Phase 0，真实 Desktop 尚未下载或打开此文件验收。D 的受控整库恢复、B 的摘录高亮以及 C 的输入草稿操作仍未完成。

## 续轮 28：最新输入草稿追加/替换候选

- 只读核对本机 Desktop 应用包 0.2.0-rc.2 的 `dsh-client-ui-session` 与 `dsh-client-ui-conversation` 实现：标准 Session 绑定提供 `hooks.input` 和 `props.inputActions`；输入状态包含 `draft`、`draftRev`、`phase`、`occurrences`、`attachmentIds`。`insertText(text, span)` 在修订号变化、提交阶段或编辑器拒绝时返回 false，不触发 `submit`。这是目标安装包源码证据，不等于当前运行实例实测。
- 正式 Client 的 Phase 1 笔记库使用当前 Session 绑定。用户先读取完整笔记 Markdown 并查看最新草稿，再明确选择追加、替换或取消。确认前草稿变动时仅刷新对照内容，须再次确认。追加定位在草稿末尾；引用节点使用官方投影的 `offset/length` 换算检测坐标，编辑由 `insertText` 的 revision 守卫处理，附件保留。替换在引用或附件存在时禁用，避免丢失语义。输入不可用时按钮禁用，保留复制 Markdown。
- 插入内容拒绝宿主保留的引用占位码，技术上限为 UTF-8 256 KiB；超限或无法定位不截断，改用复制。插件没有调用 `submit`、global fetch 或私有编辑器对象。生成 Client 与包清单加入独立输入适配模块。
- 定向测试覆盖追加到末尾、引用节点坐标、替换确认、草稿变化再次确认、提交冻结、畸形投影及不可用输入；全套 `npm run check`、280/280 单元、8/8 集成、35/35 runtime、pack dry-run 和 `git diff --check` 均退出码 0。正式 Host 仍为 Phase 0，尚无 Desktop 输入框真实验收；不能声称 C 已完成。

## 续轮 29：目标包复核与 B 锚点歧义修正

- 只读复核本机 Desktop 应用包中的 `dsh-storage-domain`、`dsh-storage-json`，版本均为 0.2.0-rc.2。两者 `lib/index.js` 与仓库 `.sdk-reference` 对应文件的 SHA-256 分别完全一致。JSON 的 `parse` 对缺失或 null `global` 归一为 null，Domain `open` 又把 null 映射为 `initial`；因此 A1/A2 的缺库判定问题仍在，正式写路由继续关闭。应用包 `desktop-runtime.json` 未提供运行中 Profile 的有效 backend/routes 值；本轮未读取或改动 Profile。
- B 的纯文本锚点定位不再把旧偏移当身份依据。旧偏移即使命中原文，也须有非空上下文且该上下文只命中一次；重复句子或重复上下文返回歧义，避免把持久高亮落到任意一句。仍缺真实消息身份接缝与 DOM/Client 集成，不能称 B 已完成。
- 新增重复上下文回归后，定向 5/5、`npm run check`、280/280 单元、8/8 集成和 `git diff --check` 通过。`npm run pack:check` 首次因全局 npm cache EPERM 失败；改用可写的 `/private/tmp/dsh-notebook-npm-cache` 后 dry-run 通过。未改 Host/Domain 生命周期，未重跑 runtime；未安装、启停或实测 Desktop。

## 续轮 30：Desktop Profile 的只读存储边界核对

- 从目标 Desktop 0.2.0-rc.2 应用包的 `dsh-base/cordis.patch.yml` 确认默认 `storage-json` 根为 `dshHomePath('storages')`，`storage-domain` 默认 `backend: json`。应用包的 Desktop home 解析规则是未覆盖时 `~/.dsh`，Desktop Profile 为 `~/.dsh/profiles/desktop`；本机环境未设置 `DSH_HOME`。
- 只读检查当前 Desktop Profile 的包清单与补丁：Notebook 包仅在 Desktop Profile 安装，Web Profile 未安装；Desktop 补丁未出现 Storage backend/routes 覆盖。本机 `~/.dsh/storages` 顶层未见名称包含 notebook 的介质。应用包使用 Electron 单实例锁限制同一 Desktop 应用的第二实例；这不能证明其他 Host/Profile 永远不能写共享 `storages` 根，也不能证明当前正在运行的实例的最终有效配置。
- 正式 Host 尚未定义专属 Domain 名称，也没有公开 API 给出指定 Domain 介质的真实存在状态或原始字节备份。当前证据可缩小 A1 的默认路由与当前安装范围，但不足以完成 A2 首次初始化和 D 原始坏介质保护。正式写路由仍关闭。本轮只读检查未访问笔记内容、修改 Profile、安装或重启 Desktop。

## 续轮 31：删除本轮范围外的标签状态

- 按计划 §1，删除未启用的 `recentTagIds`、标签实体中的 `isQuickTag`/`quickTagOrder` 和影响预览中的 `recentTagAffected`。保留 `settings.quickTagIds`，它仍代表稳定的默认快捷标签，并在合并/删除确认中显示影响。清理同步覆盖 Snapshot 校验、变换、Client RPC 校验、生成 Client、隔离夹具和测试。
- 当前正式 Host 一直只读，没有已经落盘的正式 Notebook Snapshot；本轮不为这些未发布字段编造迁移器。若将来需要读取历史候选格式，须明确格式版本和迁移策略，不能静默丢字段。
- `npm run check`、283/283 单元、8/8 集成、35/35 runtime、使用可写 npm cache 的 pack dry-run、`git diff --check` 全部通过。相关新 JavaScript 文件已按仓库规则暂存；本文档未暂存。测试只证明本地候选链路，正式 Host 写路由和 Desktop 验收仍未完成。

## B 的目标版本消息接缝（只读发现）

- 目标 Desktop 包内 `dsh-client-ui-chat/lib/client.js` 的 `conversation.chat.node` 由 Chat 自己按 `user`、`steering`、`assistant-step` 等 key 注册渲染器；外层 DOM 有 `data-chat-node-key`，但它是实现细节，不是经核实的插件消息身份 API。`conversation.chat.assistant-actions` 只在已关闭 Turn 且有 `finalNode.messageId` 时渲染，不能覆盖 user 消息或正文 Range。User 事件含 `event.data.id`，Assistant 完成事件含 `event.data.message.id`，但这只证明 Chat 内部能取得 ID，不证明插件可安全把任意 DOM 选区映射到已提交消息。
- B 需要目标 SDK 提供或明确支持一个消息正文接缝：按当前 Session 返回已提交 user/assistant 消息的稳定 `messageId`、角色、正文根元素或 Range 边界、原始内容及挂载/卸载通知。未取得合同前，不能用 DOM class、节点顺序或全会话文本搜索冒充身份；现有 `selection-draft` 和 `text-anchor` 仅是纯候选逻辑。

## 续轮 32：大样本实验退出日常门禁

- 计划 §1/§5 暂缓容量和性能专项，且 AGENTS.md 禁止大样本测试混入日常门禁。将含 5000 条样本、188 MiB 流式保护的两个测试文件从 `tests/unit` 移到 `tests/experiments`；新增 `npm run test:storage-experiments` 供明确需要时单独运行。旧存储 ADR 的链接同步到新位置，历史结果不改写为正式容量验收。
- 移动后只定向执行四项小样本实验测试，4/4 通过；没有再次运行 5000 条或 188 MiB 样本。日常 `npm test` 由 283 项变为 277 项，277/277 通过，且不再生成两类大样本。`npm run check`、pack dry-run、`git diff --check` 通过。实验文件和 package.json 已暂存，Markdown 仍未暂存。

## 续轮 33：拒绝错误的“会话顺序”查询

- PRD FR-056 只列出“会话顺序”，未定义跨会话的排序依据。原 `queryNotes(sort: 'session')` 实际按 `sessionId` 字典序分组，与计划 §3 C4 的明确提醒冲突；正式 Client 本来也没有提供这个选项。现在查询 API 明确拒绝该值，保留最近创建、最近更新、工作区和标签排序。已提出产品口径问题；得到确认后再接宿主会话顺序数据，不能把 ID 顺序重新命名为会话顺序。
- 定向查询 6/6，完整 `npm run check`、277/277 单元、8/8 集成、pack dry-run、`git diff --check` 均通过。仅改纯查询和测试，未重跑 Domain runtime；正式 Host 仍为 Phase 0，Desktop UI 读取尝试被 Computer Use 服务启动失败阻断，未声称实机验收。

## 续轮 34：首次 Snapshot 与默认快捷标签

- 新增 `createInitialSnapshot`：在调用方已经证明专属介质不存在的前提下，生成新的 epoch、revision 0、空笔记/收据，以及固定 Tag ID 的 TODO、重要、待验证三个普通内置标签。`quickTagIds` 直接指向这些 ID，设置上限为 8000 码点；结果走正式 `notebookSchema` 校验。无介质证明时不得调用它来覆盖 Domain 的 `initial` 回退结果。
- 真实 Cordis Domain/JSON 后端的手工运行时测试现在用此工厂作为初始值。首次写入后关闭并重开，可读回笔记和三个标签；此测试仍是隔离目录与模拟 Connection，不是正式 Host 或 Desktop 初始化验收。初次定向断言把标签展示顺序误认为 ID 顺序，按实际名称排序规则修正后通过。
- `npm run check`、279/279 单元、8/8 集成、35/35 runtime、pack dry-run、`git diff --check` 均通过；包清单已包含新模块。相关 JavaScript 和 package.json 已暂存，本文档未暂存。A2 的真实缺库判定、单 Host 边界及正式写入口仍未完成。

## 续轮 35：D6 输入限额与原文保留

- 候选 Client 移除标题、正文、搜索和标签名称输入框的原生 `maxLength`。浏览器不再在粘贴时按 UTF-16 长度静默裁剪。手工保存控制器在发送前核对 Host 当前的标题/正文双重长度约束（UTF-16 码元与 Unicode 码点）、256 KiB UTF-8 请求限额；搜索按 1000 码点、标签名称去除首尾空白后按 32 码点拒绝。界面显示固定诊断码与静态限额提示，保留原输入供修改。
- 明确的 Host `VALIDATION_FAILED`、`REQUEST_LIMIT`、`SNAPSHOT_LIMIT`、`RECEIPT_LIMIT` 拒绝会释放旧待发送意图，保留草稿以便缩短后重新提交；超时、连接失败和未知提交仍保留原请求 ID，不擅自重发新意图。README 列出候选技术限额，并明确这些值不是批准的产品容量。
- 单元用例覆盖 emoji、中文 UTF-8 超限、界面粘贴保留、搜索和标签无 RPC 提交，以及明确拒绝后的继续编辑。`npm run check`、全量 `npm test`、8/8 集成、pack dry-run、`git diff --check` 均退出码 0。未改 Domain/Host 生命周期，本轮未重跑 runtime；正式 Host 仍只读，Desktop 输入限额和恢复流程尚未实测，不能勾选 D 完成。

## 续轮 36：D2 本地备份文件的读前限额

- 在候选 Client 文件适配器增加 `readBackupFile`。它先检查浏览器 `Blob.size` 和 50 MiB 当前技术上限，再读入文本；读后继续调用完整备份格式与 Snapshot Schema 校验。过大的文件不会调用 `text()`，取消后不返回已检验结果。测试覆盖超限未读、合法文件、损坏 JSON 和读中取消。
- 生成 Client 已包含此适配器，但正式界面尚未提供受控恢复按钮；这只是 D2 的文件读取前置能力。D3/D4 的替换确认、旧库及坏介质保护、同队列提交、新 epoch 和刷新仍未实现。本轮 `npm run check`、全量 `npm test`、8/8 集成、pack dry-run、`git diff --check` 均退出码 0；无正式 Desktop 验收。

## 续轮 37：请求总字节边界与 Desktop 观察

- 复核目标 0.2.0-rc.2 Connection 参考实现：`rpc.call('/api', ...)` 发送 `client-request` JSON 信封，含 `type`、UUID `rpcId`、`method` 和 `payload`。精确 Notebook Host 路由对整个请求体实行 256 KiB 限制。旧保存控制器只量 `payload`，接近上限时可通过本地检查却在路由层得到 HTTP 413，导致草稿被锁在待重试意图。
- Client 保存预检现在按完整信封计算，并为 Host 允许的最长 128 字符 `rpcId` 预留空间。边界单测证明“payload 未超限、完整信封已超限”时本地拒绝、无 RPC、草稿仍可编辑。此预留略保守；不把 256 KiB 声称为任何文本内容的保证容量。
- `npm run check`、全量 `npm test`、8/8 集成、pack dry-run、`git diff --check` 均退出码 0。尝试只读打开当前 Desktop 应用时 Computer Use 服务返回 `Sky Computer Use service startup request failed`；没有取得运行实例证据。本轮未修改 Host/Domain 生命周期，也未安装、启停或重启。

## 续轮 38：集成测试产物自动清理

- 发现 `preview-package.test.js` 的两项真实 Cordis/JSON 往返测试各自创建隔离目录，但此前未删除。现用 `node:test` 的 `t.after` 在资源关闭后清理，并复用 `checkedTestRoot` 核实目录位于本仓库 `.storage-test-output`、非符号链接且为当前用户的私有目录。
- 连续两轮定向集成测试均为 8/8；这两类目录的已有数量在第二轮前后保持 108，没有新增残留。没有对 108 个历史目录执行批量清理。随后 `npm run check`、全量 `npm test`、8/8 集成、pack dry-run、`git diff --check` 均退出码 0。此项是测试卫生修复，不代表 Desktop 运行时验收。

## 续轮 39：C 的引用卡片与只读详情候选

- 目标 Conversation 0.2.0-rc.2 类型复核仍未给插件提供已提交 user/assistant 消息 ID 与正文 DOM Range 的共同接缝。B 的选区身份验证不能用 Chat 私有 DOM 属性代替；本轮没有把候选 Anchor 或高亮接入正式消息 UI。
- 候选笔记库的 Service 列表项增加引用格式和 240 码点原文摘要。Client 卡片显示引用、标签名称和更新时间；详情经现有 `notes/get` 精确 RPC 读取完整记录，显示只读原文、正文安全预览、来源以及创建/更新时间。切换筛选、关闭详情和卸载均使旧读取失效；迟到响应不能重新打开旧详情。
- 单元用例覆盖正常卡片/详情及迟到详情响应；`npm run check`、全量 `npm test`、8/8 集成、pack dry-run、`git diff --check` 均退出码 0。本次未改 Domain/生命周期，不将历史 runtime 结果称为本轮执行。正式 Host 仍只读 Phase 0，C 的详情尚无 Desktop 实测，也不代表 B 已完成。

## 续轮 40：C 的通用笔记编辑业务链路

- 复用 `changeNotes`，在候选 Service 增加 `noteEdit`，经现有单 Snapshot 协调器提交。只接受标题、Markdown 正文和标签变更；引用、锚点、来源和创建时间无法从请求改写。新增精确 `notes/edit` POST 路由和 Client carrier 方法，继续使用现有 Host admit、RPC 信封、单队列、revision/version 与持久收据；未改共享 `/api` Gateway。
- 单元验证原始来源字段保留、同请求重试只写一次、过期 revision 与伪造引用被拒绝；隔离 Cordis/JSON 集成往返验证新端点及关闭重开读回。Gateway 共存、未认证拒绝和两轮卸载测试同步覆盖新增路由，路由数由 17 更新为 18。
- `npm run check`、全量 `npm test`、8/8 集成、35/35 runtime、pack dry-run 和 `git diff --check` 均退出码 0。此轮只完成候选业务链路；通用编辑 UI、草稿保护与冲突处理还未接入。正式 Host 仍只读，Desktop 未实测。

## 续轮 41：C 的通用笔记编辑候选界面

- 候选笔记库新增编辑入口，使用已有 `notes/get` 读取完整笔记，再用上一轮 `notes/edit` 改标题、Markdown 正文和标签。引用与来源在编辑器中只读；`highlight` 不出现正文输入。未保存草稿按笔记 ID 留在当前插件内存，编辑器自有关闭需确认，浏览器 `beforeunload` 也识别这些草稿。宿主发起的面板关闭仍没有得到独立的受支持拦截接缝，故不能称 A7/C 编辑草稿保护已通过正式 Desktop 门禁。
- 新编辑器在提交前检查标题/正文 UTF-16 与码点上限、标签数量和完整 RPC 信封 256 KiB 限额；超限不截断或发送。版本冲突读取最新笔记后明确确认才用新 revision 提交；丢失回复、取消、超时及畸形成功响应保留原请求 ID。复核同时修复候选标签、批量笔记和类型转换路径：畸形成功响应也应视为提交结果未知，保留原意图供同 ID 追认。
- 定向 UI 测试覆盖只读引用、标题/正文/标签编辑、关窗保留草稿、丢失回复、畸形收据、冲突处理及超限。`npm run check`、全量 `npm test`、8/8 集成、pack dry-run、`git diff --check` 均退出码 0。本轮未改 Domain/生命周期，不将上一轮 runtime 结果算为本轮执行。正式 Host 仍只读 Phase 0，界面只是候选，未进行 Desktop 实测。

## 续轮 42：D 的整库替换候选

- 再次核对目标 `dsh-storage-domain`/`dsh-storage-json` 0.2.0-rc.2 的公开接口与实现：Domain 公开 `global.get/set` 不区分真实缺库与已有文件中的 null/missing global；JSON 后端没有公开的原始介质保护接口。A2 和 D 的坏介质保护门禁仍未闭合，不据此开放正式写入口。
- 新增 Host 侧纯函数 `prepareBackupReplacement`。它校验当前库和已检查备份，保留备份中笔记、回收站、标签、设置、来源与锚点；提交代际使用独立新 epoch、当前 revision 加一，清空旧操作收据。调用方仍须在同一队列重新核对介质、保护原始字节、提交并刷新页面；本函数不能执行恢复。
- 定向备份测试 5/5，`npm run check`、295/295 单元、pack dry-run、`git diff --check` 通过。pack 首次因本机全局 npm 缓存 EPERM 失败，改用 `/private/tmp/dsh-notebook-npm-cache` 后通过。未改正式 Host 或 Domain 生命周期，未进行 Desktop 实测；D3/D4 尚未完成。

## 续轮 43：回收站详情可读

- 发现候选笔记库的回收站卡片一直显示“查看详情”，但 Service 的 `notes/get` 对已删除笔记返回 null。现在 `notes/get` 对尚未永久删除的笔记返回完整记录，详情标出移入回收站时间。回收站卡片继续隐藏编辑、复制、Markdown 导出与输入框操作；永久删除后仍返回 null。
- 补充 Service、Client UI 和真实 Cordis/JSON 精确 RPC 往返断言。定向 34/34、`npm run check`、296/296 单元、8/8 集成、pack dry-run、`git diff --check` 通过。打包使用可写临时 npm cache。正式 Host 仍只读，未作 Desktop 实测；这项是 C 的候选链路修正，不代表 C 或 MVP 已准出。

## 续轮 44：D 的备份文件替换影响预览

- 再核对目标 0.2.0-rc.2 Storage 合同：单文件 `KvUnit` 没有整份介质的原始备份或存在状态 API；`backupRecord` 只用于逐条记录布局。此只读核对未解除 A2/D3 的保护门禁。尝试读取 Desktop 当前 UI 时 Computer Use 服务超时并重置，未取得实机通信证据。
- 候选笔记库增加只读 JSON 文件预览。先按 50 MiB 技术限额检查文件大小，再读取并严格校验备份；随后经宿主 RPC 读取当前完整备份，计算将替换的笔记、回收站及标签记录数量和笔记 ID 影响。重新选文件会取消旧读取；卸载也取消请求并拒绝迟到结果。界面明确写明当前只可预览，没有恢复按钮，不能把预览当作提交授权。
- UI 用例覆盖超限文件在读取前被拒、损坏格式、合法文件的影响数字及没有写 RPC。`npm run check`、297/297 单元、8/8 集成、pack dry-run、`git diff --check` 通过；打包使用可写临时 npm cache。正式 Host 仍只读，预览 UI 随 Phase 1 候选界面未挂载，D3/D4 的保护、确认、同队列提交及 Desktop 验收仍未完成。

## 续轮 45：备份文件读取取消立即结算

- 只读访问当前 Desktop 再次遇到 `Sky Computer Use service startup request failed`；未取得实机证据，未启停或修改 Profile。
- 修复候选备份读取的取消边界：原实现等待 `Blob.text()` 返回后才检查 AbortSignal；新实现让取消与读取竞争，取消立即以固定 `CANCELLED` 码结束等待，移除监听器，并拒绝迟到文件内容。文件大小仍在读取前检查，不改变 50 MiB 技术限额。
- 新增永不返回的 `Blob.text()` 回归，验证取消可结算。定向 30/30、`npm run check`、298/298 单元、8/8 集成、pack dry-run 和 `git diff --check` 通过。正式 Host 仍只读，D 的恢复提交与 Desktop 验收仍待完成。

## 续轮 46：D 的有界 Host 备份暂存候选

- 当前精确 RPC POST 请求上限为 256 KiB，不能单次上传计划允许的 50 MiB JSON 备份。目标 Connection 0.2.0-rc.2 的 `admit(request)` 返回操作员 `PeerScope`，其 `id` 可用于把暂存 token 绑定到已认证身份。新增最多一个、默认十分钟空闲到期的内存暂存候选：最多 50 MiB，每块最多 128 KiB 原始字节；严格 Base64、序号、大小与重复块一致性检查，收齐后由 Host 重新校验完整 JSON/Schema。关闭或取消清空候选；它不是权威库，也不触发写入。
- 候选 Service、精确 `backups/begin|chunk|finish|preview|cancel` 路由和 Client RPC 适配复用现有 Host admission、RPC 信封、生命周期及固定错误码。隔离真实 Cordis/JSON 往返验证分块、同块重试、预览和取消；预览后当前库 revision 仍为 8。正式 Host 未挂载这些路由，未执行恢复提交。受限文件适配器与等待宿主公开 API 的架构选择已单独征询用户，答复前不跨越 A2/D3 的原始介质边界。
- 首次 `test:runtime` 因路由数由 18 增至 23 而失败；同步更新生命周期断言后，`npm run check`、302/302 单元、35/35 runtime、8/8 集成、pack dry-run、`git diff --check` 通过。新增非 Markdown 源码和测试已按仓库规则暂存，本文档未暂存。尚无 Desktop 实机验收。

## 续轮 47：候选文件经 Client carrier 分块预览

- 候选笔记库的文件入口现在先在 Client 校验 JSON 备份，再按每块最多 128 KiB 经 `rpc.call('/api', ...)` 上传。Host 独立重验完整文件后计算替换影响，界面只显示预览，不开放恢复写入。丢失分块响应时复用同一上传 ID，从 Host 返回的进度续传；取消、更换文件和卸载会请求清理暂存候选。
- 修复取消竞态：`backups/cancel` 可用上传 ID 在开始响应丢失时取消；Host 在十分钟暂存期限内记住有限数量已取消 ID，拒绝随后迟到的同 ID `begin`。候选不进入权威库。超出期限后的极迟到请求仍需由宿主传输生命周期处理；这不是永久去重机制。
- 新增文件传输定向测试，覆盖 Unicode 大文件、丢失分块响应后续传、文件读取不响应时取消，以及先取消后到达的开始请求。候选 UI 测试核对实际 Host 暂存与取消。`npm run check`、307/307 单元、8/8 集成、35/35 runtime、pack dry-run 和 `git diff --check` 均退出码 0。正式 Host 仍只有只读 Phase 0 路由；D3/D4 的原始介质保护和整库提交仍未实现，尚无 Desktop 实机验收。

## 续轮 48：真实候选 RPC 验证上传与迟到请求

- 隔离 Cordis/JSON 集成往返现在直接调用 `stageBackupFile`，把超过 128 KiB 的完整 JSON 文件经 Client adapter、精确 POST 路由和 Host 暂存服务上传；Host 返回两条笔记的替换预览，当前库 revision 保持不变。同一往返还验证先取消上传 ID、后到达 `begin` 时，路由返回 `UPLOAD_NOT_FOUND`。
- 首次定向运行因测试样本正文超过 Schema 的单条 100000 码点上限而失败；缩小样本后仍跨分块边界，定向 8/8 通过。随后 `npm run check`、307/307 单元、8/8 集成、pack dry-run 与 `git diff --check` 均退出码 0。此次只修改集成测试，未重跑上一轮 35/35 runtime。尝试读取当前 Desktop 时 Computer Use 服务超时；没有取得实机通信证据，正式 Host 和恢复写入门禁均未改变。

## 续轮 49：补齐整库替换预览的格式信息

- 对照 FR-104A，原预览没有显示备份文件格式版本，也没有直接说明替换范围。`inspectBackupJson` 现在把严格校验过的 `backupVersion` 放入摘要；Host 预览带出该版本，Client 校验响应后在候选界面展示备份格式版本、数据 Schema 版本、整库替换说明，以及标签的移除/替换/新增影响。界面仍没有恢复写入按钮。
- 更新纯备份与界面断言，重新生成 Client。`npm run check`、307/307 单元、8/8 集成、pack dry-run 与 `git diff --check` 均退出码 0。本轮未改正式 Host 或 Domain 生命周期，也没有 Desktop 实测；FR-104A 的原始介质保护、二次确认和提交仍未完成。

## 续轮 50：预览后保留已校验候选

- 候选恢复界面原先在显示影响预览后立刻取消 Host 暂存，导致将来二次确认无法使用同一份已校验候选。现在预览成功后保留候选 token 和上传 ID；用户明确取消、更换文件或卸载时请求清理，Host 仍按十分钟空闲期限释放过期候选。恢复写入按钮仍关闭。
- 界面测试按本次上传 ID 核对：预览和完成校验不发送取消或恢复请求，明确点击“取消暂存”后发送一次取消并移除预览；换文件先取消旧候选，卸载时也请求取消当前候选。重新生成 Client 后，`npm run check`、308/308 单元、8/8 集成、pack dry-run 与 `git diff --check` 均退出码 0。本轮未修改 Domain/Host 生命周期，未重跑 runtime，也无 Desktop 实机验收。

## 续轮 51：用同一候选刷新替换影响

- 候选恢复界面增加“按当前笔记库重新计算影响”。刷新只用保留的 Host token 调用精确 `backups/preview`，不重新上传文件。刷新开始即撤下旧影响；读取失败时显示固定诊断码并保留同上传 ID 重试入口，避免把过期数字作为当前结果展示。
- 界面测试验证库变化后的影响刷新、无重复上传、失败撤下旧结果和同 ID 重试。隔离 Cordis/JSON 往返在当前库由 revision 8 更新到 9 后，验证同一暂存候选再次预览返回 revision 9。`npm run check`、308/308 单元、8/8 集成、pack dry-run 与 `git diff --check` 均退出码 0。正式 Host 仍只读，提交前同队列 revision/介质复核及 Desktop 实测尚未完成。

## 续轮 52：取消 ID 缓存溢出时拒绝迟到上传

- Host 候选暂存原先最多记住 32 个已取消上传 ID；第 33 个不同 ID 会淘汰最旧记录，迟到的旧 `begin` 可能重新占用唯一暂存槽。现在一旦发生淘汰，Host 在一个暂存 TTL 内拒绝所有新候选，仍允许既有候选按同一 ID 续传；期限结束后恢复接受。此边界是有界内存的保守拒绝，不保证超过 TTL 的无限延迟请求。
- 新增溢出边界测试，验证被淘汰 ID 与全新 ID 在 TTL 内均收到 `UPLOAD_BUSY`，仍保留的取消 ID 收到 `UPLOAD_NOT_FOUND`，TTL 后可开始新上传。`npm run check`、309/309 单元、8/8 集成、35/35 runtime、pack dry-run 与 `git diff --check` 均退出码 0。正式 Host 仍只读，没有 Desktop 实测。

## 续轮 53：日常测试目录不再累积

- 基线对比确认：修改前 `.storage-test-output/` 有 2,525 个顶层目录、约 18 MiB；一次完整单元、集成、runtime 运行新增 46 个目录。新增主要来自 `run-*`、`owner-worker-*`、`snapshot-*`、`coordinator-*` 等历史测试。修复针对生成它们的测试，而不是仅做一次性删除。
- 新增仅供测试的 `autoTestRoot`：只在仓库私有测试根目录下创建随机子目录；文件级测试结束后逐项验证绝对路径、所有者、权限和非符号链接，再清理。相关单元及 runtime 用例已改用此夹具。原 `checked-root` 用例故意改为公开权限，现在在 `finally` 中恢复私有权限，以便安全清理。
- 连续两轮完整日常单元、集成、runtime 运行，顶层目录数保持 2,571，不再增长。随后确认没有活动文件句柄，仅对基线运行明确新增的 46 个目录逐项核实并删除；总数回到 2,525。历史目录未批量清理。`npm run check`、309/309 单元、8/8 集成、35/35 runtime、pack dry-run 和 `git diff --check` 均退出码 0。此项是测试产物治理，不代表正式 Host 或 Desktop 已验收。

## 续轮 54：核对正式存储门禁与独立业务进度

- 只读核对目标 0.2.0-rc.2 Storage 实现和正式 `src/host/index.js`：正式入口仍只注册 `health/list`，返回 `storageReady: false`；候选恢复、标签、输入草稿等模块未开放为正式 Desktop 写入。目标 SDK 的真实缺库判定、整份原始介质保护及跨进程唯一写者是三项不同门禁；受限原始介质适配器即使获准研究，也不能单独解除唯一写者门禁。具体证据和选择范围见[存储决定](./storage-root-namespace-proposal.md#与第一版-mvp-的存储决定2026-10-06)。
- 核对 `FIRST_MVP_PLAN` 与包清单：历史实验和测试未列入发布包；C 的输入草稿追加/替换候选及界面已存在，尚不能据此勾选正式 Desktop 验收。本轮不新增平行实现或删除计划明确要求保留的查询、实验记录。Desktop 只读 UI 访问仍超时，没有取得真实 Gateway、身份或存储证据。本轮只改证据文档，未改代码、安装状态或 Profile。

## 续轮 55：导出时间校验拒绝不存在的日期

- D 的 Markdown 导出原先仅靠正则和 `Date.parse` 校验 `exportedAt`；Node 会把 `2026-02-31` 等不存在的日期顺延，导出文件仍写入错误的元数据。现在在已有格式及可解析检查后核对闰年和每月天数，拒绝不存在的日期。真实闰日 `2024-02-29` 保持可导出。
- 先用定向测试复现失败，再修正导出器。`npm run check`、310/310 单元、8/8 集成、`npm run pack:check`、`git diff --check` 均退出码 0。`.storage-test-output/` 顶层目录仍为 2,525；本轮未改 Domain/生命周期，未重跑 runtime。正式 Host 仍只读，Desktop 读取再次超时，未取得实机文件导出证据。

## 续轮 56：会话顺序的可用数据与产品口径

- 核对目标 Session Controller 的 `ApiSessionList.list()` 类型声明：它返回按活动时间排序的可见 Session 摘要；摘要含 `sessionId` 和 `updatedAt`。这是可用数据，不等于 PRD FR-056 已确认“会话顺序”指最近活动。当前 `queryNotes(sort: 'session')` 继续拒绝，避免旧的 `sessionId` 字典序冒充产品排序。已向用户询问会话排序口径，答复前不加入正式排序选项。
- B 的消息正文身份接缝仍未得到目标 SDK 的公开合同。仅靠 DOM 位置或候选文本匹配不能验证 `messageId`；本轮没有把未验证的 DOM 工具装入 Client。Desktop UI 读取再次超时，未取得新的实机验收证据。本轮无代码变更。

## 续轮 57：Desktop 开发决定与可独立实现代码

- 用户确认继续 Desktop，先完成可独立实现源码，再统一测试；存储只用公开 SDK，等待宿主补接口，不实现受限原始介质适配器。真实缺库判定、原始介质保护和唯一写者仍是独立门禁。
- 用户确认会话最近活动倒序、组内笔记更新时间倒序。查询、Service、精确 RPC 和候选 Client 接入该排序，Client 从目标 0.2.0-rc.2 `ctx.sessions.list` 的 ready snapshot 读取 `ids` 成员的 `byId.updatedAt`；retained fallback 不作为当前 Host 会话目录。活动时间只作临时排序输入，不落盘、不作来源身份证明。缺少活动时间的放置规则已重新询问，未答复前明确 SESSION_ACTIVITY_UNAVAILABLE，不宣称最终降级口径已确认。
- D 的 Host 替换预览测量独立新 Snapshot（清旧收据、revision+1、保守预留最大128字符 epoch），返回 estimatedBytes/limitBytes/fits。候选界面显示容量；Client 严格检查影响数等式、回收站数量、Schema版本与容量一致性。50 MiB 文件校验与 1 MiB 预览库限额不再被混为一个许可；真实提交仍须同队列精确检查，没有恢复执行按钮。
- B 新增 `message-text-index.js` 和 `message-highlights.js`：单一已验证正文根的文本/元素 Range 映射、块/BR间隙、准确原文、派生空白偏移映射、旧结构拒绝、CSS Highlight 专属注册、歧义不绘制、重叠供选择、选区/遮挡/交互目标保护、observer合并和两轮卸载。模块未挂正式 Client，不能证明消息身份，也不采用全会话文本搜索。固定参考 commit 本轮网络读取仍未成功；新增实现按本仓库规则独立编写，未复制第三方代码。
- 独立 code-reviewer 发现块首元素端点误含前置间隙，以及已排队时再次变更可能保留重绘高亮；均已修复并补回归。最后增量复审无未解决的确定问题。
- 本地验证：check通过、328/328单元、8/8集成、35/35 runtime、9/9 test:mvp-manual、pack dry-run通过（35文件）、git diff --check通过。测试目录仍约18 MiB，本轮未删除历史产物。现有暂存Markdown的行尾空白仍使 git diff --cached --check失败，未改动这些既有暂存内容。
- 未修改正式 Host 写入状态，未安装/启停/重启或操作 Profile。版本仍0.0.15，实际 Desktop 未验收。计划增加源码/正式接入/验收分列，统一清单为未来方案，不能提前称可执行完整 MVP 验收。

### 2026-10-06 提交前检查与测试包

- 清理误复制的 session-correction-analysis TypeScript 规范；本仓库继续使用 JS、node:test 和 AGENTS.md 门禁。删除 `.gitignore` 中逐文件忽略测试源码的规则，新增 npm 本地缓存忽略规则，清理两份主文档尾部空白。
- 修复候选 Client 连接检查超时后未撤销 storageReady，以及会话排序 Markdown 导出遗漏 sessionActivity 的失败分支。正式 Host 保持只读。
- SDK 参考、缓存、测试介质、诊断运行结果和 tgz 均不提交。测试包在 `dist/test-packages/`，只包含 package.json 指定的源码、元数据与 README；不会安装或修改 Desktop。
- 最新验证：check、330/330 单元、8/8 集成、35/35 runtime、9/9 MVP 切片、35文件 pack dry-run 通过。两条新增回归覆盖 ready 后再超时撤销 gate，以及会话排序后 Markdown 导出补齐活动目录。
