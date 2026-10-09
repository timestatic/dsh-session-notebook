# Desktop Step 0–2 门禁矩阵

更新：2026-10-04。范围：Desktop 优先，独立 Web 暂缓。目标记录版本：Harness base/web-app 0.2.0-rc.2、Notebook 0.0.12。

本表汇总仓库既有证据，不表示本轮重新连接或测试了 Desktop。PASS 只适用于所列观察范围；模拟、本地文件测试和用户手动结果分别记录。

## 证据矩阵

| 项目 | 当前结果 | 来源与限制 |
|---|---|---|
| 能力与接口来源 | 已记录，后续按使用能力重查 | phase-0、step-2-contracts、desktop-installed-carrier；本轮无 cordis_inspect_list，不声称当前运行时重新发现 |
| 正式 Bundle 安装 | 历史 PASS | desktop-phase-0-current：官方 manager installed/enabled=true；本轮未重新 list |
| 实际窗口版本与入口 | 手动 PASS | desktop-phase-0-current：真正 Desktop 显示 0.0.12；有全局和会话入口，不用 Slot 注册替代视觉结果 |
| health/list 生产 carrier | 手动 PASS，网络正文未独立采集 | 生产 Client 严格校验两个结果后显示连接；Host 返回空列表和 storageReady=false，不能作为笔记查询验收 |
| 关闭重开、主题、窄窗口、Tab/Esc | 手动 PASS | Round11/12；不重复已完成的操作，不宣称像素或自动化测试 |
| 会话与工作区上下文 | 手动 PASS | Round12；选区捕获尚未实现，不能扩展为选区来源冻结通过 |
| 启用时 Gateway 分时读取 | 手动网络 PASS | Round23 两次新的 POST settings/describe=200，页面正常；不是 Agent 抓包 |
| 禁用时 Gateway HTTP 状态 | 本会话用户手动网络 PASS | 单独授权官方 disable applied/warnings=[]；真正Desktop新 POST settings/describe=200，页面/设置正常；随后 enable applied/warnings=[]，恢复原状态，版本连接入口唯一正常 |
| 两轮启停后入口/浮层 | 手动 PASS | 两轮官方 applied/warnings=[]；入口释放、恢复无重复，最终 enabled=true |
| 路由与监听器完整释放 | 本地测试 PASS；实际宿主证据不足 | tests/unit/connection-contract.test.js、context-cleanup.test.js、client-health.test.js 等覆盖注册清理与迟到响应；可见入口消失不证明所有内部资源零泄漏 |
| 非法参数、未知端点、取消、超时、迟到响应 | 本地测试 PASS；部分历史 Web HTTP 证据 | 40 项测试及 phase-0-current-verification；不作为本轮 Desktop 全部失败分支实测 |
| 未认证访问被拒绝 | 历史 HTTP PASS；本轮未重测 | phase-0-current-verification 记录两个当时 origin 的 health/list GET/POST 共 8 次 401；不自拼认证、不读 token/cookie |
| Step 3 专用存储 | 本会话首轮隔离调查已执行，可靠性门禁未通过 | storage-experiments-current：8个SDK区域+真实工作区介质实验；非完整Cordis/实际Host，不开放生产写入 |

## 主线源码进展（2026-10-04，隔离Cordis，不是Desktop验收）

按用户“先实现主进度内容”，暂停SQLite专项实验。本轮先补[真实Cordis Context Host生命周期测试](<../../tests/runtime/desktop-route-lifecycle.test.js>)：装载正式[Host插件](<../../src/host/index.js>)两轮，测试限定的Connection Fetch stand-in只允许精确`health/list`，对每条route记录注册/释放各一次；模拟Gateway路由保持原身份且不被清理，禁止Notebook调用共享`/api`拦截器。它比普通对象直接调用`apply`更进一步验证了Cordis fiber effect dispose，但**不是当前Desktop连接服务、HTTP状态或内部监听器清单**，不能据此把下方三项未证改PASS。未修改生产路由、Client、包版本、Host/Profile，也未禁用/恢复Desktop；所有用户拒绝的观察/状态变更保持不执行。下一步在新的明确授权前仅做不依赖实机的源码修复或测试，不叠加更多SQLite实验当主进度。

## Client订阅清理补证（2026-10-04，仅隔离源码）

[Client卸载回归](<../../tests/unit/context-cleanup.test.js>)载入正式Client factory两轮：各轮创建overlay订阅、触发一次入口通知，随后执行插件effect与Slot disposer；即使React尚未调用`unsubscribe`，旧订阅者也不再接收迟到入口点击的通知，随后卸载组件并核对所有测试Slot均移除。测试仅是VM运行Client工厂与狭窄的React/Slot替身，不能观测宿主内部真实监听器或当前Desktop，不改变版本和生产代码。当前Client Inspect `Service.connection`未提供catalogued服务（查询失败），因此没有从它推导新增Client API，也未修改RPC或通信。此项不能将下方三项真实Desktop缺口改成PASS。

## Host迟到请求卸载保护（2026-10-04，源码更改、未部署）

本轮对[正式Host](<../../src/host/index.js>)精确路由增加插件所有权活动门：`ctx.effect`注销时先标记`active=false`、再等待官方`connection.fetch.register` disposer；已取得旧handler引用的请求不会在卸载后返回成功，POST在等待`request.json()`结束后再次检查活动门。[回归测试](<../../tests/unit/host-health.test.js>)覆盖卸载期间POST正文解析完成与卸载后旧GET handler；SDK Gateway共存、本地Cordis fiber两轮仍通过。Host `connection`接口经当轮Inspect确认`fetch.register(route): () => Promise<void>`，未新增服务、共享拦截器或物理路由。**源码更改尚未安装/启用/刷新当前Desktop**，不能把模拟handler的404解释为当前Desktop禁用后的404，也不证明内部listener归零或当前无凭据拒绝。正式包依旧0.0.12、8文件且不支持保存；后续如需安装、更换已加载包或真正Desktop验证必须分别取得授权，用户先前拒绝的操作不重复执行。

## 卸载时解析失败分支补全（2026-10-04，本地修复）

复查[Host迟到请求处理](<../../src/host/index.js>)发现：在`request.json()`挂起期间卸载，解析**成功**会触发二次活动门，但解析**拒绝**此前直接返回400，从旧handler暴露了不同卸载后响应。现异常分支也先检查`active`，卸载后返回404（卸载前仍维持400）。[Host单元回归](<../../tests/unit/host-health.test.js>)以可控Promise模拟解析拒绝，卸载后断言404；本地runtime33/33、unit127/127、check/pack/diff均通过。仅适用于合成旧handler；不证明当前Desktop精确路由注销、内部listener归零或无凭据拒绝，也未部署。

## 注册部分失败与官方注销失败（2026-10-04，仅本地故障注入）

[真实Cordis Context/fiber测试](<../../tests/runtime/desktop-route-lifecycle.test.js>)新增第二个Notebook精确路由`list`同步注册失败的负向实验：Cordis卸载已成功注册的第一个`health`，模拟Gateway路由对象未受影响。[Host单元测试](<../../tests/unit/host-health.test.js>)还验证官方异步disposer悬挂或拒绝时，插件自身已捕获的旧handler先关闭活动门、不恢复成功响应，同时把disposer异常上抛；**异常绝不能解释为底层路由或宿主内部listener已释放**。原测试断言把Cordis Fiber当Promise导致一次ERR_INVALID_ARG_TYPE，改用async断言后通过。runtime34/34、unit128/128、check/pack/diff通过；无生产新增修改或Desktop操作。本地stand-in并非实际Desktop Connection Registry，Step0–2仍待真实验收。

## 内部资源验收路径审查（2026-10-04，未部署）

已形成[内部资源归零观测合同草案](<./desktop-listener-zero-plan.md>)：当前只读Inspect无宿主listener/route计数；保存版Connection SDK精确路由使用内部Map，而[既有Gateway被动观察器](<../../diagnostics/desktop-http-observer/index.js>)不能证明Notebook路由或内部资源清理。候选需经正式注册拥有者提供仅本插件owner生命周期的汇总，不窥探其他插件或凭据；必须另外审批能力修改／部署与真实启停，方可观测，且与当前无凭据拒绝／禁用时新请求分别验收。这是方案而非安装、宿主修改或PASS，沿用用户拒绝的Desktop操作边界。

## Host请求取消竞态（2026-10-04，源码修复、未部署）

审计[Host精确handler](<../../src/host/index.js>)发现POST在`request.json()`挂起期间，客户端取消后若解析成功仍返回成功信封；解析拒绝则误报400。现异步解析的成功/拒绝分支均先检查活动门再检查`request.signal.aborted`，保持卸载404优先，未卸载且已取消返回固定`CANCELLED`/499。[负向测试](<../../tests/unit/host-health.test.js>)以真实AbortController和可控正文Promise覆盖成功/拒绝两分支。SDK准入/Gateway共存回归、runtime34/34、unit129/129、check/pack/diff通过。生产Host源码已变、正式包仍0.0.12八文件；**未安装或更新Desktop**，不将本地取消回归算作真实认证／路由释放／内部listener归零证据。

## Step2合同进度校正（2026-10-04，源码核对）

复核指南Step2第1–6项、当前[Client](<../../src/client/index.js>)/[Host](<../../src/host/index.js>)及[原生Tab回归](<../../tests/unit/native-panel.test.js>)，修正[早期合同笔记](<./step-2-contracts.md>)开头未实现原生Tab/RPC、当时Profile 0.0.1的历史描述：工作区现为0.0.12，Tab和正式carrier的health/list源码已存在；但DshAdapter仅具初步会话/面板形态，打开来源/草稿/下载仍未封装，且当前源码修改未被Desktop重新加载。这一核对不替代当前Desktop真实资源/认证门禁，不越过Step3开启笔记功能。

## 用户改为先开发、后统一实机验收（2026-10-04，优先于旧顺序）

用户明确选择加快功能开发、将实机验收集中到后续；[指南新增顺序例外](<../DEVELOPMENT_GUIDE.md>)只调整开发顺序，不降低安全门禁或授权要求。首个不落盘切片是[纯SelectionDraft准备函数](<../../src/client/selection-draft.js>)和[合成测试](<../../tests/unit/selection-draft.test.js>)：码点长度8000、同一已提交user/assistant消息的*输入标签一致性*、准确UTF-16来源文本切片及纯文本降级；不读 DOM、不调用 Host、不添加保存入口。**输入标签真实性必须由未来session-owning受支持API独立验证**，本函数不证明messageId或消息已提交；未有真实偏移时anchor为null，不构造伪Markdown。当前包`files`只有正式Host/Client等8文件，独立模块尚未被正式Client引入，也未打包/安装，不得宣称功能在Desktop可用。Step0–2当前真实路由/认证/监听器证据仍待后续逐次授权，不在此轮模拟PASS。

## 隔离锚点定位切片（2026-10-04，仅源码与单元测试）

新增[纯文本锚点定位模块](<../../src/client/text-anchor.js>)及[合成回归](<../../tests/unit/text-anchor.test.js>)：先在同一**调用方已验证**的消息文本块检查准确UTF-16偏移与exact，再尝试唯一exact+prefix/suffix，最后仅允许唯一exact；重复候选即使有旧occurrence也返回`ambiguous`，避免文本插入后命中错误副本。无DOM索引、消息身份校验、CSS Highlight、交互或存储写入；未被正式Client引用，仍不在8文件发布包内。该切片不能视为Step8持久高亮/实机验收通过。完整单元测试136/136、check/pack/diff通过；后续若源文本快照代际可验证，才考虑安全occurrence兜底。

## 隔离Quote构建切片（2026-10-04，未接入正式Client）

新增[纯Quote准备函数](<../../src/client/quote.js>)及[合成来源矩阵测试](<../../tests/unit/quote.test.js>)：无经过可信SourceAdapter校验的原始消息块偏移、渲染可见文本一致性和完整语法证明时，逐字符保留`plain_text`（含换行、缩进、emoji）；只有调用方声明原始Markdown片段和语义可靠且已通过本地范围检查，才返回原字节Markdown，危险原始HTML/不安全链接回退。这些声明**不是函数本身的证明**；尚无Host真实committed消息查询、渲染配置同构映射或独立Markdown净化器，不能用本地字符串断言称Step6保真门禁已通过。功能未被正式Client引用，包仍8文件、未部署，保存仍关闭。unit140/140、check/pack/diff通过；后续需按合约实现可信SourceAdapter和安全预览，再连接到UI。

## 选区最小有效长度缺陷修复（2026-10-04，隔离模块）

[纯选区草稿](<../../src/client/selection-draft.js>)此前按选区总码点判定“至少2字符”，导致`字   \n`一个有效字符加多个空白绕过。现长度上限仍按完整Unicode码点计数，但最小有效长度排除空白并保留原始选区不裁剪；[回归](<../../tests/unit/selection-draft.test.js>)覆盖该样例及emoji加汉字。定向7/7、unit140/140、check/pack/diff通过；该模块仍未由正式Client引用、不在发布包内，未触及Desktop。此轮未取得真实消息/DOM接缝合同，不能把调用者`committed`或`verified`布尔标记当真实身份/语义证明。

## 内部非持久模块纳入包（工作区0.0.13，2026-10-04）

核对当前Client Inspect：`conversation.chat.assistant-actions`提供最终assistant消息id及sessionId props，但不能代表user或任意DOM选区；`sessions.binding(id)`可借用已保留的Client session与事件窗口，却不证明DOM两个端点的messageId。禁止覆盖占用中的`conversation.chat.node`渲染器、从composer DOM层级猜身份或用`committed:true`自我证明。为避免继续堆不在产品包中的模块，工作区[manifest](<../../package.json>)升到0.0.13且纳入三项纯模块、check覆盖其语法，[Client可见版本](<../../src/client/index.js>)同步；[包清单回归](<../../tests/unit/loading.test.js>)防止漏打包。`pack:check`为11文件、unit140/140及check/diff通过。**这些模块仅随包携带，不被正式入口导入/调用，尚无选择UI或保存；当前Desktop 0.0.12未安装0.0.13。**不将包内文件出现等同实机功能或Step5/6/8门禁通过。

## 锚点上下文边界修复（2026-10-04，0.0.13工作区）

[纯锚点模块](<../../src/client/text-anchor.js>)原先通过`slice(Math.max(0, position - prefix.length), position)`比较前缀，可能在原位置前字符不足时拿截断文本比较；现在要求完整prefix/suffix区间先落在消息文本内才参与比较。[定向测试](<../../tests/unit/text-anchor.test.js>)覆盖边界外前后文、重复候选的拒绝。check/unit140/140/pack11文件/diff通过。仍无正式Client调用或实际CSS高亮，0.0.13尚未部署，真实消息边界/挂载/验收仍待后续。

## Unicode有效字符边界（2026-10-04，工作区0.0.13）

[选区纯函数](<../../src/client/selection-draft.js>)发现两个码点可能仍只是一个可见字形（`e`加重音、ZWJ表情）。最小长度现按非空白/非纯标记的grapheme cluster计数；8000上限仍按全部Unicode码点，不改原文或offset。[回归测试](<../../tests/unit/selection-draft.test.js>)覆盖组合字、ZWJ表情、纯组合符、双有效字形。定向3/3、check/unit140/140/pack11文件/diff通过；仍无真实消息身份、DOM选区捕获或Desktop实机测试，不开放保存。

## 用户明确维持的验收范围（Goal Round60，优先于下方历史程序）

本轮用户就两个独立选项明确答复：**暂不观察当前Desktop新的Notebook health/list及未认证请求**；**保持“宿主内部监听器归零”作为Step0–2门禁，不接受仅靠两轮入口唯一与本地disposer回归替代**。此前拒绝再次Notebook Bundle禁用/恢复也继续有效。此处不反推用户授权修改Profile、诊断内部私有字段、读取token/cookie或构造未认证请求。本轮未访问Desktop或执行任何新的实机HTTP观察。

当前判定：历史两轮官方启停+Gateway 200仍限于当时证据；当前Desktop路由释放、未认证拒绝，以及Host内部监听器归零均**未证实**，不能改写成PASS。后续若用户重新授权，三类证据应分别取得：①禁用期间只在已授权的同一Desktop既有路径观察health/list新请求状态，再安全恢复；②当前Desktop无凭据准入仅通过经确认的安全观察途径，单独批准，绝不提取凭据或用本GUI/历史Web替代；③需先设计并获批准的最小宿主资源观测能力，仅汇总**本插件所持有**的注册/注销数量与生命周期标识，避免读取其他插件内部监听器或全量日志；现有公开Inspect尚无可直接读取内部listener归零的接口，尚未编写/部署观测插件。任何不具备授权或能力的项继续维持未通过，不再重复询问用户已经拒绝的操作。

Step3仍只准工作区隔离介质研究，不能借此绕过Desktop优先的Step0–2验收；独立Web暂缓，正式0.0.12仍无保存功能。

## 当前复核（Goal Round37，优先于下方历史程序）

当前只读 Inspect 的 Host `connection` 合同显示 `requestRejection` 与 `admit` 承担 Host/Origin 检查及浏览器认证；同版保存 SDK `.sdk-reference/connection/package/lib/index.js` 第829–843行在 `/api` bridge 前执行 `connection.admit`，第608–622行的 shared handler 才分派精确 Notebook 路由。新增[本地准入回归](<../../tests/unit/connection-contract.test.js>)把保存SDK的Connection实现与显式trust/auth测试接缝组合：403/401被拒绝，不进入精确Notebook handler；通过准入后才返回health 200。这个测试**不是**当前 Desktop HTTP观测，不能把历史Web origin的8次401自动升级为当前Desktop PASS；Client有显示连接也不证明未认证路径。

仅需补的实机证据与安全边界：

1. 路由释放：现有用户已授权的两轮禁用/恢复和Gateway 200不重做。若需在当前真实Desktop禁用状态直接观察 `/api/dsh-session-notebook/{health,list}` 新请求是否404，须再次取得单次禁用/恢复授权，使用该窗口已有DevTools登录态和原有调用路径；仅记录方法、路径尾段、状态。不复制cookie/token，不在终端拼带凭据HTTP；观察不到状态则记录未证实。返回404不能单独证明内部listener零泄漏。
2. 监听器完整释放：现有官方API没有读取其它插件listener计数的只读Inspect方法，本地disposer回归和入口消失是现有证据上限。要断言Host内部资源归零，必须另设计获批的最小观测方案或明确调整验收证据范围，不用全量Host日志、私有内部字段或重复装卸试探。
3. 当前未认证拒绝：现有无凭据8次401来自当时两个HTTP origin，需在**确认为同一当前Desktop Host**的受控只读观察下验证。未确认Host origin/认证路径时不要拿GUI `127.0.0.1:19387` 或旧3080替代Desktop，更不得读取/构造用户凭据；无法安全执行则继续保留历史范围。

因此Step0–2仍未关闭；本轮没有禁用/恢复、请求真实Host、改变Profile或在独立Web执行任何操作。下文Round30记录为历史状态；不能把其`runtime7`当当前总数。

## 当前补充（Goal Round30，历史优先于更早程序）

本会话可用官方 plugin_manager 与 Inspect，Round17已重查storage公开契约；未在本轮调用管理器或重测Desktop。下方“工具不可用”是历史轮次环境，不能继续当作当前阻塞。第18行disable/restore实机手动HTTP已补，不重复要求用户做相同启停；剩余仅按第20–22行补明确当前资源/认证证据范围，不能将本地worker实验当Desktop验收。

Step3已推进到完整Cordis/worker，runtime7项与unit113项本地通过，容量完整样本219.3MiB、主线程阻塞/内存风险见[ADR](<./storage-adr.md>)；首轮8项SDK描述仍保留为历史，不代表全部最新证据。生产仍0.0.12/storageReady=false，无保存，未部署专用存储。

## 剩余验收程序（历史，执行前核对上方当前补充和授权）

本轮没有可调用的 Harness plugin_manager 或 Inspect 工具。不能用 Codex 的插件卸载工具替代 Harness manager，不手改 Profile。以下是待执行程序，不是已执行结果。

1. 保存 Desktop 未提交草稿，确认官方 manager 能定位准确 Bundle `dsh-session-notebook`，读取并记录原启用状态。
2. 经授权仅禁用该 Bundle，记录官方 application/warnings。结果未知时先核对实际状态，不重复提交。
3. 在真正 Desktop 窗口确认 Notebook 入口和浮层消失。
4. 清空 DevTools Network，用上一轮已验证的页面重载操作触发新请求；检查新的 `POST /api/settings/describe` 状态与页面是否正常。只记录方法、端点、状态，不保存凭据、响应正文或会话内容。
5. 在可恢复情况下通过官方 manager 恢复原启用状态，并记录 application/warnings。重新确认 0.0.12、连接、入口唯一及设置正常；若启用失败，保持安全禁用并报告，不能声称恢复成功。
6. 单独补充或标明实际路由释放、监听器清理和认证证据的范围。汇总所有必需行后再决定 Step 0–2 是否关闭，不因单个 HTTP 200 自动关闭。

## 后续开发

Step 0–2 通过后，按 storage-experiment-plan 在工作区专用介质和独立测试进程执行 Step 3。先验证缓存隔离、rename 前后失败、损坏保护、跨 Host 边界与代表性容量，再形成存储 ADR。禁止在用户真实 Notebook Domain 或运行中的 Desktop 注入故障。

本轮仅同步文档与本地检查，未修改生产 Host/Client、安装、启停、重启或 Profile。临时 observer 按最新历史记录已移除，不再继续重复安装调查。
