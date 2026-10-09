# 重启后开发续接入口

## 用户要求

严格按照 docs/DEVELOPMENT_GUIDE.md 逐步开发。重启前用户要求先保存进度，随后用户手动完整退出并重新打开 Desktop。不要自动重启、关闭应用或终止当前 Host。

## 最新续接（2026-10-04，优先于下方历史状态）

2026-10-05 简单功能切片：仅修改 src/client/index.js 与 tests/unit/manual-draft-ui.test.js。ManualDraft新增用户点击复制正文，逐字保留空白/换行/Markdown/Unicode；缺少Clipboard API或拒绝时固定安全提示且保留草稿。重复点击去重，编辑后迟到结果不误报，组件卸载/丢弃重开使用epoch拒绝旧状态更新。面板关闭确认携带closeAfterDiscard，确认后关闭面板；取消继续编辑，编辑器内丢弃不关闭面板。定向6/6、语法check、unit176/176、runtime34/34、pack18文件、diff exit0。定向首次失败是旧React mock未保留useRef初值，修正测试后通过。人工检查本轮改动的异步状态/确认动作/失败提示范围，未使用独立review agent。版本仍工作区0.0.13，未部署、未调用Host写入或开保存。真实Desktop Clipboard可用性与宿主原生Tab关闭/会话切换保护待统一实机验收；本轮不新增Host资源/不重做存储实验。

目标Round30/30：src/notebook-schema.js时间字段要求带Z或明确时区偏移的ISO时间、合法月份日期小时分秒，额外验证月末避免Date.parse把2月31日自动滚动；tests/unit/notebook-snapshot.test.js新增无时区/非法日期/合法+08:00例。定向首次18/19暴露Date.parse进位，修复后19/19；最终check/unit172/172/pack18文件/diff通过。目标尚未完成：生产Storage Repository/原子持久写、认证/来源身份/选区DOM/高亮/查询UI/导出实际文件/FR-104A恢复、Desktop步骤0–2及发布验收仍未做；不因自动轮次上限宣称完成或打开保存。Desktop历史0.0.12、工作区0.0.13未安装；后续须由用户发起继续并遵守授权边界。



目标Round29/30：src/query.js拒绝未知筛选字段/数组filter、非法tag/selected ID及过长tagIds/selectedIds/search、非法sessionId/workspacePath类型，不再静默忽略未支持排序；tests/unit/query.test.js扩展负向例，定向3/3、最终check/unit171/171/pack18文件/diff通过。仍无查询Client UI、真实Snapshot来源、性能p95与虚拟化验收；保存关闭，Desktop历史0.0.12未安装0.0.13。目标仍未完成，不得到Round30时因轮次上限宣称完成；明确报告缺口并保持目标活跃或在能推进的代码上继续。



目标Round28/30：src/tag-domain.js新增tagUsage只读普通/回收站关联数及previewTagChange(merge/delete)只读预览revision/epoch/标签version/关联数量及quick/recent影响；tests/unit/tag-domain.test.js新增合成用例，check/unit171/171/pack18文件/diff通过。预览不能当确认token，尚无Host真实revision重检、UI计数或持久原子提交；保存仍关闭，Desktop历史0.0.12未部署0.0.13。



目标Round27/30：src/notebook-schema.js JSON形状递归加16层保守深度拒绝（克隆前执行），tests/unit/notebook-snapshot.test.js新增30层合成source负例；定向22/22、最终check/unit170/170/pack18文件/diff通过。此深度限额不是整体RPC/备份字节预读限制，超大量宽记录性能仍须上层限额/测试；Schema仍未接Host，保存关闭，Desktop历史0.0.12未安装0.0.13。



目标Round26/30：继续加固src/notebook-schema.js JSON无损边界：在读取输入值前检测拒绝数组空洞、自定义访问器(getter未执行)、非枚举属性；tests/unit/notebook-snapshot.test.js新增负例，定向26/26、最终check/unit169/169/pack18文件/diff通过。此Schema仍未被Host正式读写接入；递归校验对恶意极深JSON的栈深/总字节需另做入口限制，不能将其当可靠持久门禁。Desktop历史0.0.12未部署0.0.13，保存仍关闭。



目标Round25/30：按已读取cordis-plugin-development skill及Client Inspect Slots sidebar.right.pane.tab/Service目录，src/client/index.js现有原生Notebook面板新增本地手工草稿textarea，仅React内存状态无保存/RPC；非空草稿在编辑器丢弃或面板关闭时进入二次确认，取消保留内容；英中文案标明不可保存。tests/unit/manual-draft-ui.test.js及native-panel.test.js覆盖交互/关闭和无RPC；定向曾因合成测试复用旧闭包失败，改为模拟rerender后通过；check/unit168/168/pack18文件/diff通过。注意面板外的宿主原生右侧栏关闭/会话切换未验证是否给插件拦截机会，真实离开确认和键盘焦点仍未过E2E；未安装0.0.13，历史Desktop仍0.0.12、保存继续关闭。



目标Round24/30：src/notebook-schema.js增加输入克隆前/后递归JSON形状验证，拒绝undefined、symbol键、数组额外属性、Map/Set、非有限数、循环引用等会被JSON.stringify静默丢弃/变形的对象；tests/unit/notebook-snapshot.test.js新增恶意负例，修复tests/unit/note-domain.test.js中旧fixture用undefined表示缺失正文。定向首次29/30失败于数组附加属性或克隆丢symbol，修复后30/30；最终check/unit167/167/pack18文件/diff通过。仍只是未接Host/Repository的正式纯Schema，尚无有界总库尺寸、恢复性能/可靠介质验收；保存仍关，Desktop历史0.0.12未部署0.0.13。



目标Round23/30：src/markdown-export.js新增markdownExportFilename纯安全建议文件名，过滤路径分隔符、点段、控制字符及非法设备名；纯文本引用围栏扫描改为O(n)遍历，不再将所有反引号连续段展开为Math.max参数。tests/unit/markdown-export.test.js加恶意路径与70k段反引号回归；check/unit166/166/pack18文件/diff通过。仍仅内容构建/建议文件名，无UI点击下载、Blob回收、Desktop保存取消实测或5000条可操作性验收，不接任意Host写入路径。Desktop历史0.0.12、工作区0.0.13未部署。



目标Round22/30：新增src/client/rewrite-draft.js纯草稿初始化，note补充正文空白草稿、manual改写复制原始Markdown，plain_text改写以超出内含最长反引号的text围栏字面保留恶意HTML/代码等文字，不改Quote；tests/unit/rewrite-draft.test.js合成3例，package/files/check/loading包含，check/unit164/164/pack18文件/diff通过。仍未接正式Client UI/可信SourceAdapter，不能将未经来源确认的Quote当真；草稿不保存，Markdown渲染安全另外独立实现，Desktop历史0.0.12未部署0.0.13。



目标Round21/30：src/note-domain.js新增previewPermanentDelete与permanentlyDeleteNotes纯候选，要求回收站记录、数量/标题/kind/version预览，显式confirmed、epoch/revision与记录version重新核对；结果删除完整业务note但不触及来源DSH。tests/unit/note-domain.test.js加高风险预览/取消/过期确认/校验原快照不变，check/unit161/161/pack17文件/diff通过。预览对象只是数据，不是防伪授权token；还需Host绑定实际确认、授权、mutationQueue与可靠持久提交，绝不将纯函数直接暴露为RPC。保存仍关，Desktop历史0.0.12未部署0.0.13。



目标Round20/30：src/json-backup.js增加previewBackupReplacement纯只读影响预览，严格重新Schema校验当前与导入Snapshot，汇总当前epoch/revision、备份业务版本、总笔记/回收站/标签及ID交并差的删除/覆盖/新增数；明确整库替换、不做合并。tests/unit/json-backup.test.js增加合成重叠/回收站/未知版本用例；check/unit160/160/pack17文件/diff通过。预览不持有介质generation、无二次确认token、不核对确认后revision、不保护原件、无可靠原子恢复；不将其接Host恢复API或开放保存。Desktop仍历史0.0.12、工作区0.0.13未部署。



目标Round19/30：src/tag-domain.js新增createTag（trim后NFKC/小写键去重、删除墓碑ID不复用）和createTaggedNote（复用纯createNote，先在隔离候选中加标签和笔记，再以一个最终revision产出）；tests/unit/tag-domain.test.js新增两例，check/unit159/159/pack17文件/diff通过。内部两次调用validate仅是内存预检，不是两次介质put；真实原子提交与requestId幂等收据、来源核验、安全门禁仍未实现，保存仍关闭。工作区0.0.13未安装到历史Desktop0.0.12。



目标Round18/30：扩展src/note-domain.js纯createNote，分别输入可编辑draft与调用方已核实可信的provenance（Quote/Anchor/Source），Host提供ID/time/expectedRevision，强制createdBy=user/version=1；仅允许合法kind、已有非删除标签、正文规则，空白manual草稿不持久、note/highlight必须有可信Quote，来源字段不可由draft混入。tests/unit/note-domain.test.js覆盖创建与失败边界；check/unit157/157/pack17文件/diff通过。该纯函数本身不验证来源身份，不含requestId收据/确认/UI/持久提交；调用方必须先做真实消息归属、安全访问和原子存储，存储仍关闭，Desktop仍历史0.0.12未安装0.0.13。



目标Round17/30：按FR-104A前置实现src/json-backup.js纯备份序列化/预览，使用正式notebookSchema严格验证后生成带format/backupVersion envelope，保留回收站/Quote/Anchor/Source/settings并校验UTF-8 bytes，默认50MiB；读取方须在读取之前自己执行文件size预检，本函数只能核对declaredBytes与传入已读取字符串，不能代替实际预读限制。tests/unit/json-backup.test.js合成3例覆盖严格往返、emoji字节、超限、非法格式和悬空关系；package/check/loading加入模块，check/unit156/156/pack17文件/diff通过。尚无实际文件选择/下载、预览二次确认token、介质保护、共享队列提交、epoch推进或实机恢复；不可把这个纯模块当成可用受控恢复。保存仍不开，Desktop仍历史0.0.12。



目标Round16/30：把测试专用product-shaped Snapshot校验作为新src/notebook-schema.js正式纯模块，并让notebook-snapshot/tag-domain/note-domain单测使用它；增加不可结构化克隆函数、非字符串receipt hash、quote设置8001的失败回归。package/files/check/loading纳入Schema，check/unit153/153/pack16文件/diff通过。旧tests/fixtures/notebook-snapshot.js仍保留供隔离存储实验使用，两套schema并存暂未统一；正式模块配额仍是保守临时field ceiling而非批准的总库/收据窗口，尚未接Host/Client/Repository、真实持久化或验收。不要因“生产Schema文件存在”开放保存。Desktop仍历史0.0.12，工作区0.0.13未部署。



目标Round15/30：新增src/note-domain.js批量全Snapshot纯候选changeNotes，单次预检expectedRevision/各记录version/不同ID，edit只允许标题正文标签且不改Quote/Anchor/Source/createdAt，convert退回highlight需要明确正文移除确认，trash/restore保留ID及来源。tests/unit/note-domain.test.js合成3例涵盖批量一项冲突时旧快照不变、转换与恢复。package/files/check/loading列入模块；check、unit152/152、pack15文件、diff通过。无实际保存/用户确认UI、未实现创建/永久删除/Repository及产物校验的产品Schema；函数仍只生成候选，绝不作为Host持久事务；Desktop 0.0.12仍未部署0.0.13，统一实机验收未做。



目标Round14/30：按Step10实现src/tag-domain.js全快照候选纯转换（rename/merge/delete），外部需传入已校验current与validate，revision/Tag version检查、名称NFKC键冲突、回收站与普通笔记关联同步替换/去除、quick/recent同候选更新，失败不修改旧snapshot；tests/unit/tag-domain.test.js合成3例，check/unit149/149/pack14文件/diff通过。仍无生产Repository、持久整体提交、授权边界、影响预览token、真正Host API/UI；本地“原子候选”不等于持久原子性，存储ADR PROPOSED且保存仍关闭。当前Desktop历史0.0.12未部署0.0.13，统一实机验收以后逐项授权。



目标Round13/30：按Step13新增src/markdown-export.js纯导出，输入由调用方保证已校验且单revision Snapshot；selectedIds与明确orderedIds必须一一匹配，缺失/删除/重复拒绝不默默少导；metadata单行转义，plain_text引用用长度超出内含反引号的围栏，Markdown引用片段原样，manual改写标识；不接任意写入路径或实际文件下载。tests/unit/markdown-export.test.js覆盖恶意元数据/多条顺序/长围栏/失败条件，package/files/check和loading回归包含新模块；check/unit146/146/pack13文件/diff通过。还没有snapshot revision原子采集、真实UI/Host导出、实际下载、外部Markdown安全净化、5千条流式性能或JSON备份验收，当前Desktop仍未部署工作区0.0.13，存储写入仍关闭。



用户明确要求逐项实现未开发功能、统一实机测试后置；按AGENTS每次改动仍本地验。新增src/query.js纯业务查询（Step11独立切片）：validated Snapshot由调用者提供，按会话/工作区canonical path/归档/来源不可用/无会话来源筛选，与kind独立；标签AND/OR/无标签、跨字段及最新标签名搜索、稳定时间排序/ID tie-break、全部结果ids/分页/隐藏已选数量。tests/unit/query.test.js 3项合成回归，package files/check/loading.test防漏包；check、unit143/143、pack12文件、diff通过。仅包内纯逻辑，尚无正式Repository、Client调用或实际UI；不等于Step11完成或30次p95实测。当前Desktop仍历史0.0.12、工作区0.0.13未安装；存储ADR PROPOSED、写入不开启、Step0–2实机缺口留到经逐次授权统一验收。后续按域模型/导出/业务操作逐块开发，但不以测试原型替代生产可靠性。



目标Round12/12：修复src/client/selection-draft.js中单个可见字形含多个Unicode码点会绕过最小两个有效字符规则：Intl.Segmenter grapheme计数最小值，完整Unicode码点仍计8000上限、准确选区原文/UTF-16偏移不裁剪。tests/unit/selection-draft.test.js覆盖组合音标、ZWJ表情、单独标记与两个有效字形。定向3/3、check/unit140/140/pack11文件/diff通过。目标仅达到工作区隔离功能与本地回归的一部分：正式Client未引用模块，当前Desktop仍0.0.12未升级，真实DOM消息端点归属/SourceAdapter/高亮/保存和Step0–3统一验收均待后续；不得因自动轮次上限宣称完成或以此申请安装授权。



目标Round11/12：审计打包的src/client/text-anchor.js发现上下文prefix在开头可被截断slice比较；现要求整个prefix/suffix区间在同一文本块内，tests/unit/text-anchor.test.js覆盖起尾越界和重复文本，定向4/4、check/unit140/140/pack11文件/diff通过。仅修正纯函数，不是正式Client调用或CSS高亮，也未安装Desktop；保存未开放。后续勿因目标轮数耗尽宣称Step5/6/8完成，真实DOM消息端点归属和Desktop/存储验收仍未解决。可在下一轮优先核查包装实际JS加载机制与只读非保存接入条件，若无安全接缝就清晰列出仍需宿主合同而不造假身份。



目标Round10/12：加载cordis-plugin-development并重查Client Inspect，`conversation.chat.assistant-actions`只给finalized assistant messageId+sessionId props、不能支持任意user/DOM选区；`sessions.binding`只借现有会话和事件窗口，仍需真实DOM端点归属，不能猜消息身份。本轮未强行注册覆盖Chat renderer或开保存。将package.json工作区升0.0.13、Client显示版本同步、files包含selection-draft/quote/text-anchor、check覆盖三文件；tests/unit/loading.test.js锁定这三模块进入包；README区分当前工作区0.0.13与未安装Desktop0.0.12。check/unit140/140/pack11文件/diff均通过。三模块虽打包仍未由Client加载器入口调用，0.0.13未安装，不能声称已在UI可用或Step5/6/8通过。Step0–2实机和Step3可靠存储仍待授权/验收；未来只有获得真实消息来源及稳定DOM锚点合同才连接选区UI，不以旧composer祖先猜测身份。



目标Round9/12：回顾纯模块发现选区最小值以所有码点计数，`字   \n`一有效字符却通过；src/client/selection-draft.js现分别用完整码点长度判上限、排除空白的有效码点判2字符下限，保留原选区和空白；tests/unit/selection-draft.test.js加入负向样例。定向7/7、unit140/140、check/pack/diff通过；独立模块仍不在8文件正式包中、未接真实session/DOM/Host，未部署。Step0–2实机门禁和Step3仍待后续逐项授权；后续不应继续仅累积未打包纯函数，优先核实真实session owning消息身份合同并连接有意义的非保存功能，不能用未证`committed`布尔冒充真实已提交消息。



用户先开发后验收目标Round8/12：新增src/client/quote.js纯Quote构建与tests/unit/quote.test.js读取已有synthetic选区矩阵：仅调用方给出可信源范围/可见文本一致性/语法语义断言且危险内容初筛通过才原字节返回Markdown，其余准确回退plain_text（换行/缩进/Unicode原样）；verified布尔值非独立证明，尚无Host SourceAdapter/消息身份/真实渲染同构/Markdown渲染净化器。unit140/140、check/pack/diff通过，0.0.12包8文件不包含此模块，也未与正式Client集成、未部署；保存仍关闭，Step0–3验收后续逐次授权，独立Web继续暂缓。下一轮优先在隔离纯函数之外识别可信接入方案，避免重复堆不在发布包的函数冒充进展。



用户先开发后统一验收的目标Round7/12：新增src/client/text-anchor.js纯锚点定位与tests/unit/text-anchor.test.js，单条由调用方验证的消息文本块内优先合法UTF-16偏移+exact，退化为唯一上下文，再唯一exact；重复候选即使有旧occurrence也拒绝ambiguous，防止内容插入后错位。没有DOM/消息身份验证、CSS Highlight或存储；新模块未被生产Client引用且正式0.0.12仍8文件，不声称已可在Desktop运行。check、unit136/136、pack、diff通过（ordinal策略修改后定向4/4及diff再通过）；无安装/Profile/Desktop/独立Web操作。Step0–2与Step3实机和存储门禁统一后续另授权，下一切片可做Quote纯文本保真/安全映射，先区分不可信源数据与可证明的Markdown。



用户明确改为先开发、后集中实机验收加快进度；目标已编辑并恢复，docs/DEVELOPMENT_GUIDE.md新增顺序例外但不降低Step0–3发布门禁/逐项Desktop授权。首个隔离功能是src/client/selection-draft.js纯函数+tests/unit/selection-draft.test.js：合成消息两端标签一致且标记committed、Unicode8000码点/少于2拒绝、UTF-16偏移必须与显式文本切片一致，否则拒绝或无偏移草稿；输出plain_text，不推断Markdown，不读DOM或开保存。**仅检查调用者提供的标签，不验证真实消息或来源，未接session-owning API、未被Client入口引用，且包仍8文件不包含此模块。** check、unit132/132、pack、diff通过；无部署/Desktop/Profile/独立Web/真实数据操作。后续优先把纯功能连接到经过Inspect核实的会话真实身份接缝前做可独立的安全映射/锚点组件，不能称现有纯函数已在Desktop可用；Step0–2实机三缺口和Step3存储仍待统一验收。



自动目标Round5/12：对照指南Step2第1–6项、正式Host/Client与native-panel/connection-contract测试，发现docs/evidence/step-2-contracts.md仍把当年0.0.1未实现原生Tab/RPC描述放在顶部，易误导进度。现在优先节校正为工作区0.0.12已实现Tab注册、会话/工作区展示、正式精确RPC信封health/list；DshAdapter中的打开来源/输入框草稿/下载仍未封装且存储后续功能不可提前开放，当前源码修改未部署。Desktop验收矩阵已索引校正；check/unit129/129/pack/diff通过，仅文档，无Desktop/Profile/独立Web操作。下一轮不再因自动续接重复做文档/模拟测试替代当前Host证据；若无未解决本地缺陷和新授权，不得宣称Step0–2已关闭或转Step4。



自动目标Round4/12：回到真实本地缺陷，修复src/host/index.js POST `request.json()`期间AbortSignal变为aborted仍返回成功信封、或解析失败误报400：在成功及catch中均先检查active，再检查signal，取消固定499/CANCELLED；tests/unit/host-health.test.js可控异步正文/真实AbortController覆盖两条分支。SDK准入/Gateway共存本地回归与runtime34/34、unit129/129、check/pack/diff通过。生产源码已变、0.0.12包8文件未更新运行Desktop；用户拒绝新观察和再次启停持续有效，当前Desktop route释放、认证拒绝、内部listener零仍未证。未碰Profile/独立Web/真实存储。继续只做有明确本地缺陷的修复，勿靠堆替身宣称Step0–2已完成。



自动目标Round3/12：聚焦用户坚持的当前Desktop内部listener归零门禁，审查现有Gateway被动HTTP观察器、当前Host Inspect Connection与保存版Connection SDK实现；前者只能观察settings/describe、后者仅暴露fetch.register的disposer且内置精确Map非只读公开诊断，不能通过额外本地测试证明宿主内部零。新增docs/evidence/desktop-listener-zero-plan.md最小owner生命周期观测合同草案并链接Desktop矩阵：仅在未来逐项授权宿主能力和真实操作后，按同一插件owner限定注册/注销计数；不能读其他插件内部数据，不将404/旧handler活动门当零。仅文档；check/unit128/128/pack/diff均通过，生产包0.0.12八文件且未部署。没有Desktop/Profile/独立Web操作或再次SQLite专项研发。原用户拒绝再次启停与新只读观察有效，Step0–2三项门禁未闭。下一轮应避免重复文档与模拟测试，优先识别安全实机观测的可行路径；若无新授权就停在准确边界，不靠大量替身制造进度。



自动目标Round2/12：验证第二条精确路由同步注册失败后，真实Cordis fiber会运行第一条`ctx.effect` disposer，模拟Gateway不动；测试初次误将Fiber直接传assert.rejects，修正后通过。新增官方异步disposer悬挂/失败时旧Host handler始终关闭且错误上抛回归；不把异常上抛解释为底层路由或内部listener释放。仅改tests/runtime/desktop-route-lifecycle.test.js、tests/unit/host-health.test.js与证据；生产包仍0.0.12八文件无保存。runtime34/34、unit128/128、check/pack/diff通过；未部署、未观察Desktop或操作Profile。真实Desktop三项门禁仍未关闭，原用户拒绝新观察/禁用恢复继续有效；下一步应避免只加数量型模拟测试替代实机。



自动目标Round1/12：审计上轮Host活动门发现POST body解析失败的catch分支在卸载后仍返回400；在src/host/index.js异常分支增加`active`复查（卸载后404），tests/unit/host-health.test.js新增解析Promise拒绝/插件卸载竞态。runtime33/33、unit127/127、check/pack/diff通过。正式0.0.12生产源码未安装，不使用真实Desktop/Profile/独立Web；Step0–2三项实机门禁仍未验，延续用户拒绝再次启停及新观察的授权边界。下轮优先检查是否有真实剩余本地缺口，不能靠测试数量冒充实机验收。



本轮用户明确要求继续按DEVELOPMENT_GUIDE和AGENTS开发，建立新的Desktop优先目标；未重做SQLite。Inspect Host connection确认fetch.register返回异步disposer，正式src/host/index.js加入每条路由`active`活动门：卸载先关闭活动门后等待disposer；异步POST在request.json之后复查，避免已捕获旧handler的迟到请求在卸载后返回成功。tests/unit/host-health.test.js增加POST解析中卸载及卸载后GET迟到回归。runtime33/33、unit126/126、check/pack/diff exit0；0.0.12包8文件，Host源码已变但没有安装/启停/重启/Profile或Desktop请求。见docs/evidence/desktop-step-0-2-gate.md；真实Desktop内部listener零、当前route释放及未认证拒绝仍缺，用户此前拒绝操作仍有效，勿把本地handler的404当实机验收。若需部署/实机操作须分别获得授权，不开发暂缓的独立Web。



用户新请求“继续开发”：本轮继续Desktop主线而非SQLite，新增tests/unit/context-cleanup.test.js双轮Client插件VM生命周期订阅回归：入口打开通知后运行effect/Slot dispose，即使React未取消订阅，迟到入口点击不再调用旧listener，两轮Slot归零。当前Client Inspect精确Service.connection查询报无catalogued服务，因此未猜API/改Client通信。runtime33/33、unit125/125、check/pack/diff exit0，0.0.12正式包仍8文件无保存；Host/Client生产源码无变动。docs/evidence/desktop-step-0-2-gate.md记为隔离源码证据，不能当当前Desktop route/内部listener/未认证HTTP验收；此前用户不授权新的Desktop观察、再禁用/恢复并坚持内部归零的选择继续有效。未触Desktop/Profile/独立Web/真实笔记。Goal状态此前因round-limit被blocked，本轮get_goal返回null；不能宣称自动续接目标已达成，若需长期自动目标须按用户新请求重新建立并遵守授权边界。



用户要求“先实现主进度内容”，纠正此前过多SQLite实验。此轮暂停SQLite，重查仓库AGENTS与Inspect Host connection公开合同，新增tests/runtime/desktop-route-lifecycle.test.js：真实Cordis Context/fiber载入正式Host模块两轮，通过有限Connection Fetch stand-in记录Notebook的health/list各注册/清理一次，模拟Gateway路由对象两轮原样存活，禁止共享/api interceptor。测试33/33 runtime、124/124 unit、check/pack/diff exit0；正式0.0.12包仍八文件，Host/Client源码未变。docs/evidence/desktop-step-0-2-gate.md记录：比普通apply mock更真实的fiber disposer本地证据，**不是实机Desktop路由/内部listener零泄漏/当前未认证HTTP验收**。用户此前拒绝新的Desktop观察与再次禁用/恢复、坚持内部归零验收仍有效；不操作Profile/真实介质或独立Web，不误称Step0–2已关。下一步优先主线的可验证源码切片；任何部署/实机变动另逐次授权。目标当前被goal轮数上限标为blocked，需要直接用户继续请求后按策略处理，勿凭此前误报推定已验收。



Goal续接轮次60/60（本次实验记录）：新增tests/fixtures/sqlite-fence-child.js持有事务/快速busy测试接缝及tests/unit/sqlite-fence.test.js双进程争用回归：A进入BEGIN IMMEDIATE并等待，B busy_timeout=1后失败exit1且无收据，A放行提交唯一generation2/body=new/收据。ADR仅记录当前macOS/Node合成根单交错，不声称识别故障类型、重试协议、掉电或正式backend安全。runtime32/32、unit124/124、check/pack/diff exit0，正式0.0.12包8文件无保存；无Desktop/Profile/独立Web/真实笔记操作。用户已明确暂不授权Desktop再次启停及新的只读观察，并坚持内部监听器归零验收；Step0–2不能在当前范围关闭。Step3正式根、SQLite-Cordis集成、未知提交、性能恢复、Host生命周期仍开放；勿提升实验为生产。目标未达成，按goal工具策略保持目标活跃直到用户后续另作授权或调整，下一轮若可自动继续应尊重授权边界。



Goal Round60：为使Desktop优先门禁严格忠于用户意图，再询问两项具体选择，用户均选择保留原要求：①当前Desktop暂不做新的health/list与未认证只读观察；②内部监听器归零仍是必验，不接受入口唯一+本地disposer代替。此前不授权再次禁用/恢复仍有效。docs/evidence/desktop-step-0-2-gate.md新增优先节记录三项当前未证实（路由实际释放、当前Host未认证拒绝、内部监听器归零）及各自需单独安全授权的最小后续路径；无凭据请求不允许猜Host origin、复制Cookie/Token或访问本GUI冒充Desktop。runtime32/32、unit123/123、check/pack/diff exit0，0.0.12包8文件无保存。无Desktop/Host/Profile/独立Web/用户笔记介质操作。Step0–2实际门禁无法在当前授权下关闭，Step3稳定根、可靠跨进程backend与恢复仍未闭；不标目标完成。下一轮应尊重用户拒绝，不重复询问同一验收操作；继续可由工作区隔离验证的存储可靠性，并在有真正授权路径前保持生产只读。



Goal Round59：按上轮提醒审查真实Cordis Domain的幂等重放语义：保存版DomainImpl.global.set在KvUnit.setGlobal Promise<void> resolved后必更新缓存并emit domain/changed，没有“REPLAYED无变更”分支。新增tests/runtime/domain-replay-event.test.js负向回归，合成KvUnit已有相同持久请求且不写介质仅resolve，真实Domain仍发1次事件；这是具体接口不匹配，不是SQLite集成测试。ADR明确不可把SQLite事务收据REPLAYED直接映射setGlobal成功，业务worker层需先处理收据及冻旧Domain/重开，并另证明Unknown/失败语义。runtime32/32、unit123/123、check/pack/diff exit0，正式0.0.12仍八文件无保存。用户仅批准隔离路线B研究，继续拒绝再次Desktop禁用/恢复；未改变Desktop/Profile/独立Web/真实介质，Step0–2与Step3门禁仍未闭。下一轮应优先用户授权所需的当前Desktop验收范围/产品决策，避免更多存储局部实验遮盖Desktop优先目标。



Goal Round58：读取保存版dsh-storage-domain DomainImpl global.set真实实现：先await unit.setGlobal，随后更新本地缓存和emit domain/changed。新增tests/runtime/domain-cas-rejection.test.js在真实Cordis Context/DomainFacility下注册**测试条件KvUnit stub**：外部介质由rev0到rev1，旧Domain调用rev1因条件不符拒绝，旧缓存rev0保持且0事件；旧Domain再写仍拒绝，close/reopen看到rev1，再成功写rev2才发1事件。首次缺safeParse导致真实defineDomain失败，补契约后单测/全量通过。这证明stub明确拒绝时不假更新，**不证明SQLite接入成功、未知提交恢复、缓存自动失效或可发布**；ADR已记。runtime31/31、unit123/123、check/pack/diff exit0，0.0.12打包8文件。用户仍只选隔离路线B且不授权再次Desktop disable/restore；未动Desktop/Profile/独立Web/用户介质。Step0–2当前真实认证/路由/监听器与Step3均开放。下一轮应审查真实条件backend的故障语义与Domain未知状态，不堆更多stub当生产完成。



Goal Round57：补一个合成SQLite双进程同请求并发：两个独立子进程预读generation1，第一事务提交generation2/body=new及唯一收据，第二进入事务识别同指纹收据REPLAYED；重开确认generation2且收据count=1。ADR强调只是同请求序列的一项实验，不含bounded receipts、busy/超时/大Snapshot/正式Domain缓存事件安全。并明确当前公开KvUnit.setGlobal(value)无expectedGeneration/requestId显参，若自有backend将来处理条件协议须在Snapshot/业务层传递并验证CAS失败时Domain缓存及事件不假更新。runtime30/30、unit123/123、check/pack/diff exit0；生产0.0.12包八文件不含实验。未触Desktop/Profile/独立Web/真实介质；用户仍未授权再次Desktop disable/restore，Step0–2与Step3不关闭。下一轮优先检验真实Cordis Domain在条件失败时缓存/事件与底层介质一致性，仍只工作区。



Goal Round56：在原私有合成SQLite两进程实验中新增同库receipts表，完整测试意图(expected,next,body) SHA256与request_id同事务条件UPDATE+INSERT；独立新进程接手COMMIT后exit78丢答复时同ID同指纹返回REPLAYED、同ID不同意图CONFLICT、其它ID旧代际REJECTED，原事务回滚无收据允许同请求再提交且之后重放。ADR记录这只是极简实验，**没有产品收据上限/指纹版本/完整SnapshotSchema/真正Cordis backend/平台兼容/故障耐久**，不能升格Step3。runtime30/30、unit122/122、check/pack/diff exit0，正式0.0.12包8文件无保存。未安装/启停/重启/更改Desktop/Profile/独立Web/访问真实笔记；用户仍维持不授权Desktop再次disable/restore，仅选隔离研究路线B。Step0–2当前Desktop验收与Step3安全设计仍未闭。下一步需要评估SQLite替代backend与Domain公开KV合同/缓存一致性并先验证进程故障，不擅自部署。



Goal Round55：扩展隔离SQLite两进程合成实验的故障矩阵：同一条件UPDATE后/COMMIT前合成失败且ROLLBACK，重开(1,initial)，另进程可提交(2,new)；COMMIT后但父尚未收到成功消息子进程以78退出，父只见失败退出，重开读(2,new)，旧代际写被拒。实验没有持久请求ID/内容指纹/原子收据，因此父在丢答复时必须视为UNKNOWN、不得凭退出码断言回滚，也不声称简单重读就是通用幂等重试。ADR记录限制。runtime30/30、unit121/121、check/pack/diff exit0；生产0.0.12包仍8文件。未安装/操作Desktop/Profile/独立Web/用户介质；用户仍只选择路线B隔离研究，拒绝再次Desktop禁用/恢复，Step0–2与Step3仍未验收。下一步可在工作区验证收据与Snapshot同事务、失败后独立进程复查，然后才考虑Cordis backend接口装配，勿直接发布。



Goal Round54：按用户仅选“研究跨进程安全交接”做另一合成介质路径，不触真实Host：当前工作区Node v24.19.0支持node:sqlite DatabaseSync；新增tests/fixtures/sqlite-fence-child.js + tests/unit/sqlite-fence.test.js，在工作区私有根上让旧子进程读generation1后暂停，新子进程用BEGIN IMMEDIATE中UPDATE同一行的generation/body提交(2,new)，旧子进程条件更新影响0行而ROLLBACK，重开仍(2,new)。首次单测SQL错误用双引号字符串报no such column已改为单引号并重测。ADR标注这是替代介质的一次事务CAS可行性，非现有JSON SDK/Host/backend证明，目标Electron支持、全量Snapshot性能、损坏/ENOSPC/掉电/迁移/恢复/根身份均未过；不切换产品保存。runtime30/30、unit119/119、check/pack/diff exit0，生产0.0.12包8文件未变；用户仍未授权Desktop再次disable/restore、安装/启停/重启或正式根。Step0–2实机与Step3均未关闭。下一步应验证node:sqlite在隔离Cordis KvUnit挂载、故障后不明提交/崩溃等；谨防将一项成功交错泛化为正确性。



Goal Round53：再按仓库AGENTS要求加载cordis-plugin-development、Inspect.list→Host Service.storage与storageDomain精确合同：公开backend registry、KvUnit.setGlobal/close与Domain.open/get/closeAll，不提供跨进程锁、原子代际CAS或提交时有条件publish；不据此断言宿主内部所有机制都不可用。docs/evidence/storage-root-namespace-proposal.md新增路线B的现存ABI交接评估：当前JSON backend tmp+sync→rename覆盖→dir sync，插件前置检查/父闸门/同实例facility无法替代publish处原子所有权。运行runtime30/30、unit118/118、check/pack/diff exit0，生产0.0.12八文件未变。用户仅选研究路线B、继续不授权Desktop再次disable/restore；未安装/启停/重启/触碰真实介质或独立Web。Step0–2当前Desktop真实验收未闭，Step3稳定根/栅栏/恢复仍未闭。下一步如要设计不同底层原语，需先有公开能力与明确依赖/介质许可，不盲改官方Storage或放行保存。



Goal Round52：审查工作区合成守卫发现原guarded-unit每次setGlobal只依赖启动时wx，不检查已发生的token/inode丢失；增加guard.assertOwner顺序化提交前检测，能发现已观察到的锁替换→OWNERSHIP_UNKNOWN并冻结后续写、close不解替换锁。新增guarded-sdk合成介质回归原盘revision1/替换锁不变；**不是原子跨进程栅栏**，上轮保存版SDK rename前检查竞态依然成立。ADR明确区分预检查防御和原子所有权。runtime30/30、unit118/118、check/pack/diff exit0，生产0.0.12包八文件不含原型；未改Desktop/Profile/Web、未操作真实笔记。用户选择路线B继续研究，但仍不授权Desktop再次禁用/恢复或任何安装。Step0–2/3依旧开放；下一步重点明确宿主/平台可证明的强制互斥原语与权属，勿继续将检查次数增加冒充跨进程交接完成。



Goal Round51：用户通过ask_user_question明确选择仅继续研究跨进程安全交接路线B，且维持此前“不授权再次Desktop禁用/恢复”。只读Inspect Host Service目录、读取保存版dsh-storage-json@0.2.0-rc.2的writeAtomic：tmp+file sync→rename覆盖目标→目录sync，标准Storage/Domain合同没给原子栅栏。新增tests/unit/fence-check-window.test.js使用原SDK atomic源码、在测试rename接缝先查代际1并暂停：新写者设代际2写`new`，旧者再以原rename覆盖成`old`；故**只加发布前代际检查不安全**，这不是断言所有可能强制排他方案不可能。ADR/recovery-design记录路线B准入；runtime30/30、unit117/117、check/pack/diff exit0，生产0.0.12八文件不含实验。未安装依赖/Bundle、未触碰Desktop/Profile/Web/真实介质；Step0–2与Step3仍开放。下一轮若研究替代强制排他，必须以公开契约且将校验和publish原子绑定，不能用更多独立读代际伪安全。



Goal Round50：在当前隔离进程Node v24.19.0/darwin只读查FileHandle接口，sync/stat/read可用而lock/flock不存在，O_EXCL/O_NOFOLLOW存在；这只说明此标准API不能直接提供强制跨进程文件锁，非宿主全部平台不可能。docs/evidence/storage-recovery-design.md记录A保锁离线（正常重启不可用+需用户选择/恢复工具）、B获批稳定根及可靠强制排他/代际栅栏（可能需另外批准依赖/宿主能力）、C维持只读三路线和逐次授权；storage-runtime-gate索引。runtime30/30、unit116/116、check/pack/diff exit0，生产0.0.12八文件无保存。未修改Host/Profile/Desktop/独立Web、未安装依赖/读取真实笔记。Step0–2实机路由/认证/监听器待证，用户此前暂不授权再禁用；Step3互斥、正式根/恢复/容量仍开放。下轮建议用户明确路线或安全访问许可，避免自己假定离线可用性取舍；仍可继续非运行状态的产品独立研究。



Goal Round49：为审查路线A（非发布方案）在隔离测试守卫增加retainLockOnClose选项，检查锁所有者后正常close也拒绝unlink且返回OFFLINE_RECOVERY_REQUIRED；unit与完整Cordis worker父侧证实锁残留、第二写者WRITER_EXISTS、同父不自动restart。明确代价是**每次正常关闭也无法自动使用笔记库**，必须先获授权的全写者离线证据与尚不存在的恢复工具；没有产品选择/默认切换/真实介质修改，生产0.0.12仍八文件无保存；默认释放仍有unlink后sync窗口。ADR/recovery-design记录。runtime30/30、unit116/116、check/pack/diff exit0。Step0–2 Desktop认证/路由/监听器仍缺且用户曾拒绝再次disable/restore；Step3不关闭。下轮优先认真评估更可用的跨进程所有权机制，或请求用户明确接受降低正常重启可用性后再做恢复工具；不擅自恢复残留锁。



Goal Round48：将一次性workerRestartGate接入tests/runtime/worker-parent.js隔离父spawn/close/restart，父亲真实监听精确同id close回应与exit0；正常关闭可一次替换、release-sync失败虽锁已消失仍拒绝同父自动restart。首次新增测试发现closing标志在新worker未重置，修正后runtime29/29、unit115/115、check/pack/diff exit0；正式0.0.12仍八文件无保存。父控制器仅合成工作区root，不是Host服务、无跨进程持久状态/栅栏；另一独立写者可取得锁，Step3互斥阻断不变。未改Desktop/Profile/独立Web/真实介质；Step0–2真实Desktop当前验收仍依此前用户暂不授权禁用而开放。下一轮认真评估独立安全持久栅栏或简化可用性目标，不应让同父控制器扩展成没有价值的伪跨进程证明。



Goal Round47：新增tests/runtime/worker-restart-gate.js父侧**仅测试原型**，要求同worker精确CLOSED_OK后exit0才允许本进程尝试替换worker，CLOSE_FAILED/先退出/异常/畸形回复一律永久拒绝；两项纯状态回归及真实worker release-sync故障证明锁已消失、独立写者能进入而本父gate仍拒绝。注意目前状态机只在测试中手工调用，没接真实父spawn/Host，**不解决跨进程互斥**；ADR明确范围。runtime27/27、unit115/115、check/pack/diff exit0，生产0.0.12仍八文件无写。Desktop/Profile/Web未改，Step0–2当前实机认证/路由/监听器待证且此前用户拒绝再禁用；Step3写锁释放/正式root/恢复/容量未过。下一轮应将本父侧门禁接到单一测试父spawn入口并验证，或评估更有意义的跨进程方案，不制造生产安全错觉。



Goal Round46：核对主docs/DEVELOPMENT_GUIDE.md §1.1/Step3/末尾历史状态，纠正过期“存储实验未执行”并同步实际发布阻断：锁unlink后目录sync失败返回错误但新写者仍可获锁，增加Step3锁交接故障表行，明确固定RELEASE_UNKNOWN只是诊断，不能发布；链接runtime-gate/ADR/recovery-design。runtime25/25、unit115/115、check/pack/diff exit0，正式0.0.12八文件无保存。无Profile/Desktop/Web/真实介质改变。Step0–2当前Desktop验收依旧缺路由释放/未认证/监听器当前证据，且用户之前拒绝再次禁用/恢复；Step3锁、root、恢复、容量仍未通过。下一轮选择能形成真正新技术证据的安全互斥实验，而非继续只更新说明；不获授权不改运行状态。



Goal Round45：不再机械增加类似故障测试，审查release当前`checkOwner→unlink→sync`与已有单元+真实Cordis worker故障证据，完善docs/evidence/storage-recovery-design.md四阶段风险矩阵与A）逐次授权离线恢复，B）跨进程持久代际栅栏/底层强制排他，C）能力不足维持阻断的选择门槛；明确移动fsync、热重建同名锁、PID/mtime、exit0都不能作为快捷修复。storage-runtime-gate索引。runtime25/25、unit115/115、check/pack/diff exit0；0.0.12生产仍八文件无保存。无Host状态变更/真实介质/独立Web。Step0–2真实Desktop仍差当前路由/认证/监听器证据且此前用户拒绝新disable/restore；Step3仍受锁释放窗口、正式root/恢复/容量所阻。下一轮从可行性与正式授权依赖来推进，避免只靠文档/测试数字伪进度。



Goal Round44：完整Cordis worker合成release目录sync故障回归：worker返回`CLOSE_FAILED`、exit0，但锁名已被unlink，第二写者仍能acquire；证实父级关闭诊断不会谎报成功，也证实关闭失败/exit0不能证明持锁。通过test-only workerData.testFailReleaseSync→snapshotBackend guardHooks注入，不是生产配置；ADR补细化证据。runtime25/25、unit115/115、check/pack/diff exit0，生产包八文件不含实验。当前实机Step0–2仍缺真实当前Desktop路由释放/未认证/监听器可观测证据，用户此前明确暂不授权再次禁用恢复；Step3锁释放互斥和正式root/恢复/容量等依旧未通过。未动Desktop/Profile/Web/真实介质。下一轮应评估是否继续设计安全释放协议，避免重复相似故障测试而没有生产可行性。



Goal Round43：隔离守卫将lock unlink后的目录sync失败统一成固定`RELEASE_UNKNOWN`并保持终止状态，再次release不能静默报成功，旧protect固定`GUARD_CLOSED`。tests/unit/medium-guard.test.js仍**故意证实新写者可获得锁**：只是诊断改善，非互斥修复或Step3验收；ADR/runtime-gate明确不能将其提升生产。runtime24/24、unit115/115、check/pack/diff exit0，生产包0.0.12仍八文件、无保存。没有真实Desktop/Profile/Web更改、没有读取真实介质。下轮优先梳理两阶段安全关闭协议或离线安全运维方案，再决定是否可以独立Bundle；不要因未知码固定就宣称可靠。



Goal Round42：复查根与介质路径TOCTOU时发现更直接的安全阻断：测试守卫`guard.release`先unlink(lock)后目录sync失败，release拒绝但第二写者此时可`wx`取得锁；新增tests/unit/medium-guard.test.js仅合成介质故障注入复现，**不是通过可靠性门禁**。ADR/root方案/runtime-gate均更正先前“close失败保锁”过宽描述：仅unlink前故障保锁，后unlink故障必须重设计代际/生命周期/离线恢复，不能直接升生产；测试仍未改实际守卫，不触碰真实锁。runtime24/24、unit115/115、check/pack/diff exit0，生产包仍0.0.12八文件。本轮未操作Desktop/Profile/Web；用户暂不授权Desktop再次disable/restore保持有效；Step0–2、Step3均开放。下一切片优先给隔离守卫设计可证明不并发写的释放策略与故障注入矩阵；因生产保存被此阻断，避免开发写UI。



Goal Round41：审查测试根发现仅子目录0700不足；现checkedTestRoot在worker SDK前要求工作区基目录realpath原位、类型目录/0700/运行UID属主，且子目录同样私有和属主匹配。isOwnedPrivateDirectory纯predicate测foreign UID、宽权限、普通文件，不调整共享目录权限；实际stat基目录曾为drwx------ UID501与进程一致。runtime24/24、unit114/114、check/pack/diff exit0，生产0.0.12八文件未变。ADR/namespace方案强调workspace更上层父目录与同UID恶意替换不保，测试根并非正式产品根。不操作Desktop/独立Web、不安装插件；Step0-2/Step3依然未通过。下一步检查root/介质路径身份绑定的TOCTOU可否在Node能力内消除，否则记录明确技术阻断并专注可被授权的真实Desktop验收。



Goal Round40：新增tests/fixtures/experiment-config.js工作区**测试专用**严格配置函数：必须且仅有普通data property `root`，复用0700绝对直接子目录checkedTestRoot；固定backend/domain `notebook_probe_v1` 且输出冻结，不提供cwd/Profile/env默认、不自动mkdir/写介质。runtime配置正常/缺失/额外字段/getter/别名/缺失介质2项验证合计runtime23/23；unit114/114、check/pack/diff exit0（命令过10秒转后台job bash-245，已job_output确认退出0），生产Bundle仍八文件无原型。ADR/namespace方案更新：这不是Cordis插件导出Config schema，未有用户批准生产root或Host真正装配；不能借测试白名单宣称产品根安全。Step0–2不重复用户拒绝的Desktop禁用；Step3未通过。下一轮更应做严肃的设计评审/风险清单而非无限小测试补丁，确认服务依赖和worker生命周期后再决定是否构建独立实验Bundle（不安装）。



Goal Round39：先Inspect当前Host storage/storageDomain Config，读锁定SDK BackendRegistry/DomainFacility/Json apply实现。单独storage-root-namespace-proposal.md收敛独立root显式授权、backend名/service key自有、DomainFacility不挂载默认服务、worker权威状态/失败保锁，讨论同UID/FD TOCTOU、网络FS不保证及真正产品Config仍未设计。新增真实Cordis独立Context两轮backend `notebook_test`与官方名`json`共存、重复`json`拒绝、默认storageDomain不挂载：runtime21/21；unit114/114、check/pack/diff exit0，生产0.0.12八文件不含原型。ADR/runtime-gate索引方案。未安装Bundle、未选真实root、未操作Profile/Desktop或独立Web，Step0–2仍因用户暂不批准再次禁用而实际验收开放；Step3 PROPOSED。下一步选自洽的工作区实验Config严格缺省拒绝和Root威胁测试、独立bundle可装配性评估，但不要安装或提前生产写。



Goal Round38：用户明确选择暂不授权临时Desktop禁用/恢复，尊重之；不操作Plugin Manager/Profile或真实HTTP。隔离worker新checkedTestRoot仅接受绝对规范、工作区`.storage-test-output`的0700直接子目录、无symlink/嵌套/缺失/非私有目录；在Context/SDK初始化前fail-closed，后续只使用已验root。测试runtime20/20、unit114/114、check/pack/diff exit0，生产0.0.12仍八文件不含原型。ADR/runtime-gate说明白名单仅测试，非生产根授权，可信目录内同UID恶意替换TOCTOU仍未解决。下一步宜明确正式根配置/namespace服务所有权的设计审查与私有目录威胁模型，而非继续零碎worker协议；Step0–2实机缺口仍保留，Step3未通过。



Goal Round37：回到Desktop Step0–2真实门禁，read已存phase0/desktop证据及生产Host，Inspect list后读取当前Host connection合同；同版SDK `/api` apply先admit后waterfall/bridge，第608–622行后续才选择精确Notebook fetch route。新增tests/unit/connection-contract.test.js本地准入回归：显式test-seam trusted=false/auth=true→403、trusted=true/auth=false→401、双通过→health200；第一次插入误漏原test回调造成SyntaxError，修复后单文件6/6及全量unit114/114、runtime18/18、check/pack/diff exit0。注意断言只是保存版SDK+模拟trust/auth，不是当前Desktop HTTP；旧3080/Web 401不得升级成当前实机证明。Desktop矩阵加最小当前缺口：路由禁用时新请求状态需逐次授权与真实窗口；内部监听器计数无只读官方工具不能声称零泄漏；当前Desktop未认证Host需安全定位才测，不用19387或旧3080代替、不拿凭据。本轮未调用plugin_manager/启停/读取token/改Profile/触碰Web。下一步应请求当前Desktop真实验收所需具体授权，或继续独立root Config设计而不擅自启停。Step0-2/Step3均未关闭。



Goal Round36：检查cordis-plugin-development host-plugin参考并先调用Inspect list/Host storage contract，未编写生产插件。仅tests/runtime新增worker-reader.js只读父侧请求ID分发：默认16在途、list1–100、安全递增ID、超时移除且ID不复用、迟到/重复/无ID丢弃、error/exit固定错误拒绝和监听器清理；detach绝不command/terminate/解锁。纯协议与真实完整SDK worker并发两读、保锁后正常关闭回归18/18，unit113/113与check/pack/diff exit0，生产包仍8文件。ADR新增局限：没有Host权限/写提交/分页/取消，不能当业务服务。下一步避免无限小协议补丁，聚焦Desktop Step0-2剩余真实资源/认证证据或明确授权缺口、稳定测试namespace/Root配置方案；不擅自操作运行时。



Goal Round35：测试worker可仅在testPauseList=true定点让真正`list`请求永不回应；父侧30ms超时清理message/error/exit监听器，锁仍拒绝第二写者，随后正常close退出。区别上一轮的无匹配listener模拟；只读单请求实验，不说明Host服务状态机、写提交不明、取消/late reply业务语义。runtime14/14、unit113/113、check/pack/diff exit0，production仍0.0.12八文件无保存；ADR补限制。下一轮优先收敛未就绪/坏介质startup进程清理与多请求id冲突模型，避免用测试helper等同Host服务。没有对Desktop、Profile或独立Web操作。



Goal Round34：已先cordis_inspect_list，当前Host Service.storage公开后端register/get/names和KvFacet.open/KvUnit.close，Host Config Notebook entry仍status=absent（Inspect只读，不声称插件已卸载或当前窗口已验）；未修改插件或调用业务service。发现测试worker初次介质缺失lstat原在facility.open排他获取前；改为open成功持锁后决定是否显式初始化。新增同根第二worker启动失败/不发READY，第一owner介质SHA256未变、仍可list及安全close。runtime13/13 unit113/113 check/pack/diff exit0，生产包8文件不变。ADR更新；不能抵御恶意同UID路径替换，Step0-2/3仍未过，未安装/启停/重启或改Profile。下一切片：父侧无响应/取消的只读隔离策略，或小范围worker启动故障资源处理；不绕过正式Desktop门禁。



Goal Round33：测试worker关停原先串行await facility.closeAll失败即跳过backend/unregister/raw/Context；新close-owned.js捕获每一步继续清理，只有全部成功返回CLOSED_OK，失败固定CLOSE_FAILED不泄原文，锁是否保留仍由guard决定。12/12 runtime（含注入SDK unit.close失败保锁）、113/113 unit、check/pack/diff exit0。ADR补充说明清理尝试非介质安全，exit0不等于可重写。生产0.0.12未改/未安装/未开放保存。下一步：仍需worker父侧无响应策略与startup/close失败资源归属、稳定namespace/Config；真实Desktop Step0-2剩余当前资源认证范围尚未关闭。用户授权仅隔离测试，不改Profile。



Goal Round32：修正测试worker每次启动无条件global.set会覆写已有介质：仅明确ENOENT才提交初始化；真实同根正常关闭重启后原JSON SHA256不变且读取一致。新增损坏JSON启动不发READY、原件不变/锁保留；SDK unit.close定点故障返回固定CLOSE_FAILED、锁保留，异常terminate仍锁拒绝。runtime10/10、unit113/113与check/pack/diff exit0，生产pack仍8文件。ADR补启动/停机负例。注意worker异常状态对父端目前仅error/exit，尚无正式Host固定诊断；close失败的raw资源清理/进程退出语义仍需修复且不能因exit0视为成功；任何当前宿主或Profile仍未修改，Step3未关闭。下一步审查worker lifecycle失败覆盖与独立service key/Config，不直接安装。



Goal Round31/60：用户明确要求继续并增加自动续接轮数；goal revision4 active/max60。共用capacity-fixture.js后，受保护容量探针对5000条产品形状note写真实SDK并定点设置无效业务schemaVersion99，介质229943415字节，显式guardHooks 256MiB **仅测试上限**，真实snapshot backend预检失败触发64KiB原始流式副本，独立SHA256与字节数相等、源不变、锁保留、第二写者WRITER_EXISTS。单次保护1968.85ms，maxRSS1260093440字节含样本生成不是保护增量。首轮误期望第二写者OPEN_FAILED（实际WRITER_EXISTS），更正断言重跑通过。runtime7/7、unit113/113、check/pack/diff exit0；生产0.0.12包仍8文件不含原型。ADR/运行时计划更新；仍未做多轮/断电/ENOSPC/真正Desktop/产品容量批准，Step3 PROPOSED，不安装/不开放保存。下一切片：先检查自动目标状态，再收敛worker启动失败/超时/关闭失败安全语义及稳定namespace Config设计，不碰当前宿主运行状态。



Goal Round30/30：读取get_goal仍active revision1，不complete/blocked。校正DEVELOPMENT_GUIDE§1.1旧未实验/无锁文件叙述：production0.0.12无保存，独立runtime有lock、113unit+7runtime、ADR PROPOSED。Desktop矩阵追加当前工具可用/disable HTTP已补，保留历史程序不重做用户启停；storage-runtime-gate具体下一切片为完整219.3MiB受保护backend/流式副本预算256MiB仅测试（当前fixture openGuardedUnit未接guardHooks参数，需显式传递而非默认生产放宽），多轮性能，再审查插件自有worker facility配置/namespace与启动失败矩阵。全部runtime7/7+unit113/113/check/pack/diff exit0，生产pack仍8文件hash90d33400edaf2d20f2f3379bd5334f3b51ff37c2。未安装/改Profile/重启/操作独立Web，整个目标未完成；自动轮数到限不意味着完成，需要用户继续时resume并明确后续轮数授权（edit max_goal_rounds仅直接用户请求可用）。


Goal Round29：snapshot backend持锁后lstat普通文件才open SDK，符号链接/目录拒绝，负例external synthetic目标不变且SDK不调用；仍trusted root TOCTOU非恶意同UID安全。ADR明确下一实验选择single global+guarded专用backend+排他+worker权威队列有界DTO，列剩余Desktop资源/auth、稳定namespace/root、实际宿主重启、219MiB容量/恢复、正式Schema/Repository，不代表批准架构或部署。runtime7/7+unit113/113/check/pack/diff通过。下一轮30应最终状态校正（desktop矩阵有工具不可用历史描述不要覆盖历史、添加当前条目），准备可延续的具体最小切片；goal整个仍未完成，不因上限到达标complete或blocked，未生产保存。

Goal Round28：owned worker正safe id，非法对象/字符串/0/负id只固定id0拒绝不回显；list for-in+hasOwn不Object.values全库分配。测试response helper 5s边界/匹配id/error-exit/timeout listener cleanup，20ms定点超时无热解锁、无message监听残留；runtime7/7+unit112/112/check/pack/diff通过。这仍test protocol不是完整消息调度（并行duplicate id/服务异常/await close失败未统一处理）；下一轮应停止零碎协议修补，收敛ADR正式选择与受控部署验收方案并问必要产品容量决定，不宣称生产可用。goal28/30仍未Step3/实机全部通过。

Goal Round27：owned-worker.js独占完整Context/Storage/DomainFacility/实际SDK+guarded backend，父只list(limit1–100)摘要id/kind/version/revision、无quote/body全库传输、非法字段拒绝，固定synthetic初始化，normal close按Domain/backend/raw/Context释放；worker-ownership2项验证正常退出可重获锁、terminate异常残留拒绝。runtime7/7+unit112/112/check/pack/diff通过。尚非Host服务与生产架构：workerData root尚应先显式验证（raw实例构造不IO，guard.open先校验但初始化步骤需审视），list Object.values全库遍历/分配需改iterator；异步handler异常/超时有界等待及消息id唯一性待补。只有测试创建worker会terminate，不关闭宿主。下一轮收敛worker异常/请求协议及ADR选择，仍未安装。

Goal Round26：capacity-worker-probe.js同完整219.3MiB样本全构造校验SDK比较在worker，父只小metrics，parent loop max42.47ms/p99 18.35ms vs direct691ms，process maxRSS1506099200字节未改善，worker内部698ms阻塞不保证取消。ADR明确可行隔离非生产架构；新增storage-recovery-design.md离线恢复草案不执行，禁止TTL/PID抢锁/热删，先全部写者退出授权+原件/锁证据+核验收据/恢复新代际+重新启用另批。runtime5/5+unit112/112/check/pack/diff通过。下一轮正式worker所有权/有界DTO与Domain公开契约可行性审查，或实机受控Bundle验收申请；没有降配/生产根/安装授权，goal仍未完成。

Goal Round25：独立capacity-probe.js完整产品形状5000条完整SDK测量，介质229943414字节约219.3MiB，validation682.47ms/commit972.48ms/reopen1161.59ms，maxRSS1288552448字节（含构造比较），loop max691.01ms/p99 366.22ms含校验比较，Node24.19.0 darwin arm64单次非SLA。逐记录完整相等，明确主进程同步校验/序列化明显阻塞风险不能批准容量；200MiB保护测试参数不足覆盖完整样本。ADR新增性能证据。runtime5/5+unit112/112/check/pack/diff通过，探针独立未加默认门禁，未生产/安装。下一轮worker隔离验证或产品受控配额决策（不得直接降低5000要求），并定义可重复人工恢复安全流程；剩余goal继续。

Goal Round24：初始化runtime补明确ENOENT→显式提交→关闭重开/磁盘预置标签一致→删除后不复活；读取后先clone避免直接修改SDK别名。根package仅新增test:runtime入口，默认unit保持独立无runtime依赖；生产pack仍8文件，manifest脚本变所以hash变化但Host/Client/version未改。更新storage-runtime-gate已完成Cordis/流式/标签证据及ADR20–24章节，runtime5/5+unit112/112/check/pack/diff通过。下一切片完整产品最大代表性样本内存峰值/事件循环测量、人工锁恢复流程设计，受控Bundle另批准；尚未可接受性能或实际Desktop存储验收，goal继续。

Goal Round23：发现SDK把已存null/缺失global等同不存在，Domain回退initial；snapshot backend守卫持锁后lstat固定介质，仅ENOENT可初始化，已有null global invalid-record保护。新runtime initialization3项：预置标签删除且关联清除后重开不复活、已有null/missing全局原件保留/Domain无初始化/close聚合保护失败/锁保留。runtime5/5+unit112/112及check/pack/diff通过。首次初始化initial未自动落盘仍需业务显式提交，不能因Domain.open成功说标签已耐久；测试明确通过global.set提交删除候选。下一轮更新ADR矩阵并推进独立受控实验Bundle配置计划、人工恢复决策；未改生产/未安装。

Goal Round22：merge-tags.js仅测试整体候选，PRD形状notes（含trash）/tags/settings去重替换及expectedRevision；tests/runtime/tag-merge.test.js实际完整SDK Domain failure seam before SDK setGlobal验证旧磁盘/cache/源候选严格不变，成功重开整体一致。不是正式Repository：无时间更新时间/完整mutation receipts/权限接口；直接raw后端明确故障在写前，不能替代guard未知提交冻结证据。runtime2/2+unit112/112及check/pack/diff通过。下一轮预置标签只初始化一次/删除后不复活实验与ADR矩阵对齐，受控Bundle和真实Desktop验收仍待授权，生产0.0.12不变。

Goal Round21：candidate-store新增maxReceipts/maxReceiptBytes/maxRequestBytes测试配置，初始超限拒绝、新请求UTF8总字节限制、候选receipt数/体积持久化前拒绝；不淘汰旧收据，满额已提交重试仍返回原结果，重建后仍不二次写。新增2项，runtime1/1+unit112/112与check/pack/diff通过。策略是明确fail-closed实验非最终产品配额：达到上限停止新修改，长期可用性/用户提示/epoch切换与收据回收尚需产品决策；当前简化receipts并非完整operationReceipts适配。下一轮产品形状标签合并失败整体一致和预置标签只初始化一次实验，尽快推进ADR而非直接生产保存。

Goal Round20：backend保存OPEN_FAILED/MEDIUM_PROTECTED/PROTECTION_FAILED/LOCK_FAILED打开失败，close聚合报告避免残留保护锁却声称关闭干净；不记录未获介质的DESCRIPTOR_REJECTED/WRITER_EXISTS。新增进行中open失败shutdown保锁及未触盘参数拒绝不poison close两项，runtime1/1+unit110/110与check/pack/diff通过。下一轮停止小粒度生命周期补丁，优先有限receipt/产品形状Repository初始化标签和合并原子失败实验，或独立受控Bundle验收推进；不要以基础测试数量替代产品门禁，仍未生产发布。

Goal Round19：真实Cordis lifecycle加入第一轮SDK调用前暂停写入、fiber.dispose启动、setImmediate后尚未dispose且锁仍在、恢复写后disposal完成，第二轮重开完整Snapshot相等；runtime1/1及unit108/108/check/pack/diff通过。ADR补Round9–19完整产品Snapshot、Domain前置保护、188MiB流式副本和完整Context lifecycle证据，同时保持PROPOSED非Desktop验收。接缝仅暂停点不修改SDK原子发布。下一轮收敛pending失败open对backend.close的诊断、production schema限额决策和初始化标签/receipt持久化；受控Bundle部署另授权，无生产保存。

Goal Round18：snapshotBackend新增契约close：关闭准入、跟踪pending open/已获guarded unit，Promise.allSettled排空，memoized disposal，关闭失败AggregateError不隐藏。真实Cordis两轮移除caller Domain.close，以plugin dispose自清理registry/service/锁通过；disposer先backend.close再raw.close。新增open进行中shutdown与queued未知commit失败保锁2项，runtime1/1+unit108/108、check/pack/diff通过。尚有pending open失败close未传播及closed unit set保留等需审视；未测试Cordis下进行中真正write卸载。下一轮整理Step3 ADR最新证据/收敛Bundle测试入口并确认严格隔离配置，生产未改/未安装。

Goal Round17：tests/runtime/storage-lifecycle.test.js使用完整cordis4.0.4 Context/Storage/JsonStorageBackend/DomainFacility，无源码提取/Context mock，独立notebook_test registry+service key、完整Snapshot真实介质，两轮caller显式Domain.close后plugin dispose，registry/service/锁清理通过。首轮apply返回Fiber触发Invalid effect；修为Promise.resolve(injected).then(() => {})与官方apply一致，runtime1/1+unit106/106及check/pack/diff通过。注意backend fixture尚无契约close，测试disposer关闭raw；显式先Domain.close避开实际卸载顺序缺口，下一轮必须测未显式close的plugin dispose/关闭进行中写，保证guard锁不残留或明确保护；不能把这次通过当全生命周期完成或实际Desktop安装/重启。生产未改。

Goal Round16：流式保护复制/hash每块及link发布前AbortSignal检查，源size/mtime/ctime变化拒绝；新增取消/源增长2项，全106/106及check/pack/diff通过。用户明确批准独立tests/runtime npm测试工程依赖（不改根生产/宿主Profile），npm install --ignore-scripts已exit0安装9包，锁定cordis4.0.4/storage-domain/json/storage0.2.0-rc.2并生成lock，工作区cache无脚本。尚未运行完整Context测试，不把依赖安装当验证。下一轮读取安装包正式README/types，用完整Context/actual classes注册独立test backend、两轮plugin unload，验证real injection/disposer。生产0.0.12不变，未plugin_manager安装/重启。

Goal Round15：新增stream-protection.js分块64KiB读写/hash、partial文件fsync+独立hash复核、hardlink no-overwrite完成发布，guard发布后复核owner+目录fsync。明确maximumBytes测试参数，默认仍1MiB；188MiB合成介质在显式200MiB限额流式保护通过，中断仅留.partial不产生完成.json/原件不变。partial成功后保留hardlink为测试产物非双倍数据，不计完成副本；首轮旧测试误计两个已修只筛完成.json，104/104及check/pack/diff通过。尚需partial cleanup/磁盘配额/取消/source变更/真实保护性能与峰值测量；不宣称已解决生产容量。下一轮实际Cordis实验依赖装配和受控Bundle设计，不安装前要明确额外授权；仍无生产保存。

Goal Round14：完整产品形状Snapshot接入实际SDK Domain测试，notes/tags/trash/source deleted/quote/anchor/receipt关闭重开完整JSON相等，非法关联原件及副本相等/Domain未初始化。首次跨VM原型校验失败已parse入口深克隆归一化仍严格字段（无放宽keys）；102/102与check/pack/diff通过。新增storage-runtime-gate.md收敛计划：完整Cordis/独立实验Bundle未做；1MiB保护原型不能覆盖188MiB容量，下一轮有界流式副本/验证与中断故障；人工残留锁恢复和生产根仍需决策，不能热删锁。未安装/开放保存。

Goal Round13：按PRD§9/guide§5新增tests/fixtures/notebook-snapshot.js产品形状v1完整字段测试Schema（notes/tags/quote/anchor/source/settings/operationReceipts+epoch）与14项不变量测试，100/100及check/pack/diff通过。仅测试验证器，不是生产Zod/最终限额；正文100k/收据1000等为fixture上限未改产品配额。下一轮使用此完整样本替换Domain组合简化Schema并补未知可选字段值严格性/日期/引用最小有效字符和回收站标签语义；PRD tool/system只保留模型兼容，UI创建仍拒绝。人工残留锁恢复未定、生产backend注册和实机存储重启未做，Step3仍未过；不无限增原型，尽快形成受控实验Bundle与批准验收计划。

Goal Round12：区分loadAll I/O异常与Schema invalid-record，I/O close后OPEN_FAILED保锁不误报已保护；无变换Schema契约，parse输出变化拒绝，避免丢弃转换值。新增2项全86/86与check/pack/diff通过。核对PRD FR104A：50MiB恢复默认明确可配置，不是固定全库上限；ADR已纠正，不用介质大小冒充最终备份大小、不需擅自改PRD限额。下一轮应收敛完整Snapshot Schema/字段身份、容量控制和人工残留锁恢复决策，再将测试backend变为获批可安装专用实验Bundle（安装仍另批）；当前仅fixtures，未生产/部署。

Goal Round11：snapshot-backend强制共用Schema参数，openSdk后loadAll前置校验，失败先raw.close再抛invalid-record触发guard副本+保锁；setGlobal前校验拒绝非法候选不触盘。修改Round10缺口断言为原件副本/锁/Domain无残留/再次open锁拒绝，并增加非法候选缓存事件不变/队列健康。全84/84与check/pack/diff通过；仅最小Schema seam而非完整产品Schema。loadAll I/O失败当前误标invalid-record需区分，Schema.parse潜在变换输出未用需明确只验证或使用parse结果；下一轮收敛这两点并制定完整产品Schema与容量决定，不无限新增原型而不关闭ADR。未安装/开启保存。

Goal Round10：新增snapshot-backend.js仅测试global-only KvFacet与guarded-domain.test.js实际SDK DomainFacility组合，限制name notebook/version1/single/global/无tables，陌生descriptor在介质打开前拒绝；Domain写入/事件/关闭重开、独立facility锁拒绝通过。发现重要盲区：业务Schema在backend.open/loadAll之后Domain层才验证，invalid-record时普通unit.close会释放锁，无损坏副本；测试明确复现不是修复PASS。共新增3项，全83/83与check/pack/diff通过。下一轮将完整产品Schema的前置backend校验与Domain校验共用同一声明（先测试Schema seam），loadAll校验失败调用protect并保锁/close，再验证Domain不覆盖原件。不能仅用backend.open处理invalid-record，未生产注册/安装/开启保存。

Goal Round9：guarded-unit失败open遇malformed/version/invalid-record保护原始bytes后保锁并报告MEDIUM_PROTECTED，副本失败PROTECTION_FAILED，其他open失败OPEN_FAILED保锁。运行中保护失败冻结排队/新写入，close介质但保锁。新增4项真实SDK负例，全80/80、check/pack/diff通过（pack后台bash-170已收集exit0）。本轮容量样本负载下提交2223ms/重开2306ms，非稳定SLA，不能只引用早先~1秒。下一轮完整Domain global-only KvUnit adapter/descriptor约束与schema拒绝介质保护；未知open部分资源必须由openUnit合同保证清理，不能仅保锁宣称无泄漏。未生产backend/安装/启停，锁人工恢复和容量决策仍待。

Goal Round8：新增guarded-unit.js测试适配与guarded-sdk.test.js，实际SDK写入/保护/close共队列，验证保护在提交后、close排空rename暂停且拒新请求/不提前释放、未知提交保锁、SDK close失败保锁/同一失败Promise。4项通过，全76/76及check/pack/diff通过；ADR汇总Round5–8授权与边界。未backend注册/生产Domain/安装。下一步失败open损坏原介质保护（目前open失败直接release，原件保留但无副本）、保护失败后冻结、完整KvUnit descriptor/Domain整合；先修原型这些边界再决定生产方案。不自动抢残留锁、不操作Profile/Web。

Goal Round7：medium-guard将protect/release串行，release立即关闭新工作入口并排空已有保护；acquire文件fsync后目录fsync失败留锁拒绝；保护目录sync失败不返回成功、不改原件、锁保持。新增3项负例/并发测试，全72/72与check/pack/diff通过。release unlink后目录fsync失败会上报但锁可能已移除，后续不得声称耐久释放；仍原型/信任受控根，同UID目录替换TOCTOU未消除。下一轮与实际SDK介质close组合：必须先排空SDK所有写与保护，再释放锁；若SDK close失败保持锁，不自动清空/解锁。未安装/改Profile/开放保存。

Goal Round6：medium-guard增加lstat/O_NOFOLLOW/fstat dev+ino校验、有界读取1MiB（仅测试配额）、锁identity+token复核。新增链接/超限原件拒绝及两个真实测试进程互斥、持锁子进程SIGKILL后新写者拒绝残留锁、正常释放后新进程可获取。新增3项，总69/69与check/pack/diff通过。尚未backend整合/生产安全：同UID恶意目录替换TOCTOU并未由普通Node路径API彻底消除，保护失败注入/并发protect-release/目录持久性仍待验证。仅信任专用受控根的原型，不用于任意目录，不自动抢残留锁。下一轮收敛守卫操作串行和目录sync失败安全残留，再与实际SDK单介质生命周期整合；不部署/改Profile/开放保存。

Goal Round5：用户单独批准工作区专用Storage Domain backend适配隔离原型（独立注册名/显式测试根/排他/原介质保护），不安装/改Profile/接真实库/生产保存。官方JsonStorageBackend固定注册json，不能直接第二份apply；configEditor.configuration合同可读配置但Inspect不能调用，未业务读取生产root。实现tests/fixtures/medium-guard.js基础（尚未backend注册）：真实root校验、wx排他、随机owner token、无TTL/PID抢锁、残留锁拒绝、固定路径损坏raw bytes副本fsync/hash验证。5项测试通过，完整66/66与check/pack/diff通过。尚缺两进程排他/崩溃残留实测、symlink与根路径变更威胁/大小限制/保护失败注入、与SDK backend生命周期整合；不称生产安全。下一轮先加固路径与失败边界并做两进程守卫，不开放保存。

Goal Round4：新增candidate-sdk.test.js真实single SDK介质+队列原型2项组合验证：重开receipt稳定重试；真实rename后目录sync故障冻结旧队列，唯一测试写者关闭重开可确认receipt且不二次提交。加1项原型键/版本/体积边界回归；61/61及check/pack/diff通过。未完整Domain/Cordis、未生产化/安装/启停。ADR增加排他/保护设计边界：先确认稳定介质标识与获批准适配，不TTL偷锁/PID冒充排他/私访Profile/裸文件主库。下一轮调查Config公开配置与专用backend注册方案，准备最小受控扩展建议并取得明确批准，跨Host/保护/容量仍阻断保存发布。

Goal Round3：新增仅tests/fixtures的candidate-store队列原型和5项测试，验证串行不同记录/旧version冲突、receipt重建幂等及payload复用拒绝、深隔离、未知提交冻结后续请求、校验/epoch拒绝和close排空。全部58/58、check/pack/diff通过。未接生产Domain/更新包。Host Service目录调查未发现storage/fs公开锁或整介质保护，不能猜API或通过通用fs私访Profile。ADR保持草案：跨Host排他、损坏原介质保护、生产backend边界、容量/50MiB恢复一致性未关闭。下一步验证测试原型与实际SDK介质整合（仍隔离），并整理需要用户批准的最小排他/保护设计选项，而非直接生产化。

Goal Round2：新增 storage-child.js 和 storage-process.test.js，专用子进程rename前SIGKILL得到完整旧值、rename后SIGKILL得到完整新值；两个真实测试进程先读旧值再依次提交复现丢更新。3/3通过，不是掉电/正式Host安全证明；首次暂停因无活句柄code13自行退出，已修测试保活并明确验证SIGKILL。重新Inspect storage精确合同无公开介质路径/全介质备份/排他接口，未猜API。完整门禁53/53及check/pack/diff通过，ADR补证据；生产0.0.12与运行状态不变。下一步定向调查正式排他与介质保护扩展点，并验证业务队列/版本/幂等候选隔离；未过可靠性门禁不开放保存。

Goal Round1：新增 storage-capacity.test.js，5000条Quote+完整Anchor样本196,700,885字节，两次运行提交约992/1054ms、重开约1096/1092ms；RSS为比较后的整体进程值约1.68/1.02GiB，非峰值。明显超过默认50MiB恢复限额，需产品容量一致性决策，不能称全快照可接受。close排空测试通过。首次跨VM deepStrictEqual原型假失败已改完整JSON比较，完整门禁50/50、check/工作区cache pack/diff通过。新增 [存储ADR草案](<./storage-adr.md>)，未批准生产保存。未启停/安装/改Profile或Web。下一轮专用子进程中断及两进程写者实验、正式排他/备份保护能力调查；可靠性门禁仍未过。

本会话最新：用户单独批准官方查询/禁用/恢复，Notebook0.0.12 installed/enabled=true；disable 和 enable 均 applied/warnings=[]。用户真正 Desktop 确认禁用入口消失、新 POST settings/describe=200、页面设置正常；恢复后入口唯一、版本连接正常，最终 enabled=true。该明确HTTP缺口已补。新增 tests/unit/storage-sdk.test.js：8/8 SDK实现区域+真实工作区合成介质实验通过，复现 rename后fsync失败磁盘缓存分歧、独立facility丢更新、候选引用别名和缺写入Schema校验。详见 [首轮隔离存储实验](<./storage-experiments-current.md>)。仅进入隔离可靠性调查，不开放生产保存；完整Step0–2实际资源/认证证据范围仍按门禁矩阵保留，Step3可靠性未通过。下一步专用子进程中断与双写者、5000条性能、正式排他和保护介质能力，ADR定稿后才进入Step4；Web不动。

Round24（2026-10-04，本会话继续开发）：同步指南 §1.1/§4/§7.2/末尾、README、开发索引、Desktop 当前结论与存储实验计划；新增 desktop-step-0-2-gate.md 区分手动、模拟、历史认证与未运行证据。当前会话未提供 Harness cordis_inspect_list/plugin_manager，也未找到本地 cordis-plugin-development Skill，未操作运行时。下一步通过官方管理入口补禁用期间 Gateway 直接状态并恢复原状态；检查路由/监听器与认证证据范围后再关闭 Step0–2。不重复安装 observer，不进入存储实验，不把继续开发自动解释为启停授权。文档保持未暂存，既有暂存区保留。

Round23 (2026-10-04)读实际main确认隐藏F12 toggleDevTools和主窗口devTools=true，用户已成功打开真正Desktop Network。两次独立清空/页面重载分别反馈POST settings/describe200、页面正常，第二次Notebook版本/连接正常。手动Network证据，不是Agent抓包；分时200缺口已补。临时observer保持移除，未改Profile/重启。还缺禁用期间一次Gateway直接200（以前仅设置业务正常），需新授权一次disable/恢复+用户Network；之后按guide矩阵核对再进Step3，不要继续观测器调查。详见desktop-phase-0-current。

Round22 用户重新授权临时安装+官方Desktop刷新两次（草稿已保存）+移除。官方install applied/warnings=[]，新run13d0034a-5bb0-44ca-b861-e317fd8e5e4c初始空；用户第1次官方刷新后页面/设置/v0.0.12/Host连接全部正常，但同run仍records=[]。未做第2次无效刷新；立即官方disable applied/warnings=[]并remove applied/exit0，保持原Notebook。参考Gateway endpointOf明确namespace/method，无发现改名；仍无200，不再扩大为重复安装试验。下一步只读排查event分发/ctx绑定（参考无显式this假设可能不充分）或Host对应性，不能认为当前Inspect/manager与用户窗口仅靠名称必然同进程，不能读token证明对应。无Profile手改/重启/旧Web操作。

Round21 已只读解析ASAR并提取真实安装源码至忽略.desktop-reference。主进程dsh-app非静态请求forwardWebRequest走shell认证HTTP，实际connection也有认证后waterfall；设置mirror启动ensure，document-updated/reset刷新，普通关闭重开不保证describe请求。故Round20空摘要测试触发盲区，不能称观察器无覆盖。详见 [实际安装carrier](<./desktop-installed-carrier.md>)。下一步重新安装+真正Desktop官方页面刷新前须新授权（可能影响草稿），不自拼认证或改设置。未修改安装包/Profile/凭据，未部署，网络缺口仍保留。

Round20 接入固定授权工作区result目标、writer卸载flush，新增实际工作区synthetic介质测试（不写正式result），39/39通过。用户批准临时安装/启用/验后移除。官方第一次空registry拒绝，后显式registry安装发现patch.insert对象格式错误并官方回滚；修为数组后安装applied/warnings=[]。新runId=68a89024-9110-4052-bac2-b7b37a97b955初始records=[]；用户真正Desktop设置两次正常后，同run仍records=[]。只记接缝未捕获，不能判定IPC或HTTP200。诊断已官方禁用applied/warnings=[]并remove applied/exit0；无重启，原Notebook不变。新增精确patch格式回归，后续不要重复安装该无覆盖观察器；下一步需要实际Desktop桥接/事件实现或用户明确指标调整，Phase0HTTP缺口保留。当前用户policy改danger-full-access/approval never，不设sandbox_permissions升级。

Round19 新增独立summary-writer.js（尚未连接观察器或加入诊断files）：异步串行temp-write/rename、0600、最多32条、runId区别旧证据、write/rename错误隔离与close禁止新记录。4个mock I/O测试通过，总38/38及语法/主包pack/diff通过；未真实写result文件、未安装。下一轮接入观察器、显式固定工作区目标、更新诊断files并做实际工作区介质试验/卸载flush测试；需考虑同目标跨run并发，不能同时部署多个writer，旧文件runId必须由启动证据核对。诊断摘要无需生产Notebook持久性保证，不宣称fsync事务。

Round18 修复观察器并发预算缺陷：completed+pending达到32就不再观察，新增先红后绿回归（原失败exit1已修复），总34/34及语法/两包dry-run/diff通过。完整Config目录未发现可确认的常规logger出口，未读全量日志、未部署。用户明确授权在工作区 diagnostics/desktop-http-observer/result.json 写专用固定计数/status摘要（最多32），安装另行批准。下一轮实现隔离异步写入和失败不影响请求测试；不写Profile/Notebook Domain，不将文件路径从cwd推断，安装包目录与工作区可能不同，需显式安全固定配置/授权目标，防旧结果误认新证据。

Round17用户提供日志目录 /Users/didi_1/Library/Logs/DeepSeek Harness/。glob只发现4个2026-10-03 crash日志（main/web-boot/renderer），没有发现持续运行日志；仅grep固定SETTINGS_HTTP_FINISH计数/status无匹配，未读日志正文。诊断未安装，因此无匹配是预期，不证明没有HTTP请求。该目录当前不能证明可获取常规logger.info摘要，不盲目安装。下一步需核实官方持续日志出口或取得独立固定摘要展示开发授权；不读凭据/全量崩溃日志。

Round16 已核对真实Cordis logger callable与dispatch过滤；新增参考SDK原始dispatch/waterfall提取回归，总33/33通过和四项门禁通过。诊断仍未安装，无真实HTTP摘要。用户选择提供Desktop官方日志入口/路径但尚未给出实际值，下一步等待具体路径/入口；只筛固定SETTINGS_HTTP_FINISH摘要，不读全量日志/凭据。不要把选择本身当已有日志访问。

Round15 已实施获授权的diagnostics/desktop-http-observer独立临时包，精确POST被动finish计数，最多16pending/32日志，close/error/unload清理，无路由/敏感读取/生产Notebook改动。6个新测试通过，总32/32；主包/诊断包pack与语法/diff通过。未安装/启用，需先核实logger合同、事件scope和安全摘要获取入口，再请求安装。不能没有可读摘要就盲目装，也不能观察不到造200。

Round14最后用户明确允许开发独立临时被动HTTP状态观察组件；仅开发/本地测试，安装仍另行批准。不改生产Notebook/注册路由/读取凭据，观察不到不造200。下一轮可实施最小诊断与零干预、清理测试。

Round14 carrier只读调查：已安装app.asar读取工具BigInt错误，公开源码URL404；未shell解包绕过。参考README/Client代码支持physical fetch与logical rpc两种选择，不能判定当前Electron一定HTTP或IPC。见 [carrier调查](<./desktop-carrier-investigation.md>)。未开发/安装诊断，未改认证/传输，网络200缺口仍保留。下一步需用户批准最小被动观察或提供对应Desktop桥接源码/正式诊断入口，不凭合同推断当前状态。

Round 13用户选择先只读核实Desktop carrier，不开发诊断组件。下一轮读取目标版本已安装Desktop桥接实现，判断设置RPC是否产生HTTP，再决定指标；不要未经新批准开发/安装临时诊断。

Round 13 只读发现connection/request正式waterfall，SDK确认位于认证后的webServer HTTP分支；可候选被动观察精确settings/describe的finish状态，不需shared interceptor。但不保证Desktop IPC经过HTTP，注册不等于证据。新增 [网络观察候选](<./desktop-network-observation-plan.md>)，未写/装诊断组件，需用户批准开发及逐次安装；不能换carrier或读凭据以造200。

Round 12：用户确认Desktop深浅主题/窄窗口/Tab/Esc/现有会话工作区切换全部通过且已恢复原设置；网络面板无法打开或找不到请求，HTTP200仍未取得，不能推断。只读重查storageDomain合同，未open Domain/故障实验/产品写入。见Desktop当前验收。后续寻找获授权且合规的Desktop网络观察方式，不重复已通过的手动主题或启停，不借用Web证据。

Round 11：正式manager列表确认Notebook0.0.12 installed/enabled=true。用户确认真正Desktop窗口版本、Host连接、设置/关闭重开正常，并授权两轮启停；4次set_bundle均applied/warnings=[]，每次用户检查通过，最终恢复原enabled=true。见 [Desktop当前验收](<./desktop-phase-0-current.md>)。未重启/替换安装/改其他插件；设置正常不等于HTTP200，Electron网络、主题/尺寸/会话切换等仍待补。不要重复已完成的两轮启停。

**最新用户决定：暂缓独立 Web，继续 Desktop 开发。** 目标已修改并恢复 active，旧Web部署阻塞不再阻断Desktop。PRD/指南顶部已同步当前阶段Desktop范围：Desktop Step0–2门禁通过后进入专用存储实验；不能误报Web或双端通过。不要继续调查/升级3080及其插件，不改其Profile。

本次当前Inspect找到Notebook Host entry（status=absent仅表示无Config schema），composer occupant active=true；历史0.0.12正式激活application=applied/warnings=[]与用户基本操作OK仍是历史证据，不冒充本次Desktop HTTP实测。下一步完成Desktop实际窗口version/health/list/Gateway和生命周期验收，涉及禁用/启用或重启先授权。既有浏览器脚本限制3080，不直接拿它们当桌面测试，也不要求用外部浏览器代替Desktop carrier。存储写入仍待Desktop门禁，不改变可靠性和安全要求。

**历史Round 4（已被Desktop优先决定替代，不再作为当前任务）：验收对象为独立 Web 正式页面 http://127.0.0.1:3080/，不是 Desktop 的正式浏览器入口。不要再要求切换 19387，也不要把 3080 当作选错页面。** 不改变指南要求的最终双端验收，但当前任务先验收 Web。sn-desktop-web 是会话历史名称，实际 origin=3080；可继续使用，不将名称当平台证据。用户本次未批准升级、安装、禁用或重启。

两份浏览器脚本已加入 3080 origin 守卫，错误平台在请求/UI 操作前失败，新增 2 项回归测试。当前 Web 正常脚本 15/15 true、负例 7/7 true、Gateway 两次 200；统一门禁通过、单测 25/25。Notebook 的启动覆盖与“正式 Web 页面地址”是不同概念，持久安装状态仍未改变。下一步在用户指定 Web 补实际主题/尺寸/生命周期剩余证据；需状态变更时先授权，不重复切换 Desktop 请求。

本轮使用既有 sn-foreground 附着 3080 前台 Web：v0.0.12、生产 health/list 已连接、Enter 打开、关闭重开、浮层内 Esc 与焦点恢复均实测通过；官方 settings/describe 两次 POST 200。最终浮层关闭，未改 Profile/安装/启用/重启。详见 [当前轮验证](<./phase-0-current-verification.md>)。

3080 旧 Web 仍是覆盖启动，正式持久安装门禁未关闭；当前 Inspect 对应另一个 Host，不等于 3080 的官方管理器。不要重复“Web 无入口/等待用户重启”的历史判断。下一步补正式安装路径与 Desktop/双端剩余生命周期验收，之后才开始 Step 3 专用存储实验。非模态浮层允许 Tab 移出，Esc 仅在浮层内生效。

Round 2 新增可重复 [Phase 0 浏览器检查](<../../tests/e2e/phase-0-browser-check.js>)；实际 3080 执行 14 项均 true、Gateway 两次 200，最终浮层关闭。运行方式：`playwright-cli -s=sn-foreground run-code --filename=tests/e2e/phase-0-browser-check.js`。README 过时禁用状态已纠正，四项仓库门禁全部通过。无 Profile/运行状态变更；旧 Web 官方持久安装与 Desktop 窗口剩余验收仍待解决。

Round 3 新增 [非法请求检查](<../../tests/e2e/phase-0-negative-check.js>)，实际 3080 7/7 通过；3080/19387 无凭据 health/list GET/POST 共 8 次 401。负例后正常脚本仍 14 项通过、Gateway 两次 200。四项仓库门禁通过，浮层最终关闭。旧 Web 无官方管理器 + 不升级/不手改 Profile 的持久安装限制连续存在，不能继续靠重复正常探测关门禁；需用户明确官方部署路径及 Desktop 窗口验收接入。仍未进入 Step 3 或改 Profile。

以下 Round 3 选择与切换要求已被 Round 4 用户纠正替代，不再执行：用户在 Round 3 选择“使用 Desktop 的正式浏览器入口验收”：保留旧 3080，不升级、不改 Profile。已请求用户正常打开 Desktop 官方 19387 入口并在 Chrome 扩展授权。新会话 sn-desktop-web attach 初次受缓存路径沙箱拒绝，按原命令获更宽权限后启动；连接任务 bash-98 已收集，退出码 0。连接瞬间是 chrome-error 页面，随后只读 origin 查询实际为 3080，仍不是目标 19387；未将 sn-desktop-web 会话名称当作平台证据。需要用户通过 Desktop 正式入口正常登录 19387 并选择对应标签页；不要重复 attach 或输出含 token 的 URL。此选择只批准浏览器验收，不批准重启/安装/禁用。

Round 5 指定 Web 3080 当前 1512×736 视口布局通过：浮层在视口内、无横向溢出、关闭按钮可见、背景/前景有效。正常脚本现为 20 项 true，Gateway 两次 200；四项本地门禁通过、25/25 单测。只代表当前样式/尺寸，不当作双主题或窄视口完成。下一步向用户确认临时主题/视口切换并恢复的验收授权，不直接改 localStorage/CSS，不重复已通过的单尺寸检查。

Round 5 后续用户批准临时主题/视口测试并恢复。实际宿主设置确认原主题“跟随系统”，临时浅色与深色下 Notebook 均在当前视口内、无横向溢出，颜色实际变化；finally 已恢复跟随系统（aria-pressed=true），设置和 Notebook 全部关闭，最终 dialog=0，1512×736 未改。page.viewportSize()=null，未调整附着 Chrome 窗口，窄视口仍未验收。需要精确按 dialog 名称定位，不能使用无名称 getByRole('dialog')。该授权不包括启用/禁用或重启。

Round 6：不能由 viewportSize()=null 推断标准调整接口不可用。本轮 setViewportSize 实测成功，新 [多尺寸脚本](<../../tests/e2e/phase-0-viewport-check.js>) 在480×640和800×600生产RPC/布局均通过，finally恢复1512×736、dialog=0。没有恢复原null自动跟随语义的证据，勿声称全部视口配置完全恢复；没有改变物理窗口。四项本地门禁通过、单测26/26。正式安装和禁用/启用生命周期仍受旧Web官方管理器缺失限制，不得直接用当前Desktop管理器替代。下一步需与用户确定满足指南的正式Web管理/部署路径，不再重复主题/尺寸验收或请求切换19387。

Round 7 用户仅批准调查官方升级与回退方案，不批准实施。新增 [Web升级调查](<./web-upgrade-plan.md>)：旧dsh当前0.1.5-rc.1，registry确认精确目标@deepseek-ai/dsh@0.2.0-rc.2存在且依赖同版plugin-manager；同版参考文档说明base-backed Profile的管理机制。尚需只读核对旧Profile/插件兼容、官方迁移备份与恢复、隔离CLI和原启动参数，才能请求实施批准。不得把仅规划许可当成升级/安装/停服授权，不用latest、不混装新版管理包，不切换19387。

Round 8 只读核对现有7个第三方Bundle manifests：agent-teams0.1.17、browser-skill0.2.0、context-doctor0.7.2的DSH peers不覆盖目标0.2.0-rc.2，不能直接升级。dsh-context作者声明目标兼容，其余无严格peer的包仍实际未知。目标app-boot官方README确认启动检查peer并可能清理旧fallback投影；sanitizeProfile不是数据备份回滚。详情见 [升级调查](<./web-upgrade-plan.md>)。未执行升级/包更新/启停/配置恢复。下一步优先调查三个冲突包的官方目标兼容版本，不默认禁用或风险豁免，同时核实数据备份恢复。

Round 9 只读registry候选：agent-teams0.1.22全部DSH peers列目标rc.2，browser-skill0.3.2包含^0.2.0-rc.1；未安装/实测。Context Doctor npm E404（bash-122已收集exit1），其Profile Git来源main manifest仍0.7.2且旧dsh-tools peer，不能直接采用。详见 [升级调查](<./web-upgrade-plan.md>)。接下来需用户决定是否允许未来目标Web不加载Context Doctor或提供固定兼容版本；不修改第三方peer、不默认禁用/风险豁免；用户数据备份恢复仍待核实。

Round 9最新用户明确“必须保留全部插件能力”，拒绝未来目标Web暂不加载Context Doctor。升级尚无实施条件，不得由新版自动skip来绕过；不得禁用/删除/改peer/豁免。保持原3080和全部已有功能，只继续只读寻找固定兼容版本或旧版官方管理替代路径，无新证据则不重复升级尝试。26/26单测与全部门禁通过，未变更运行状态。

Round 10 核实Context Doctor固定tags/releases：未发现新目标兼容发行，只有旧0.7.2（不声称穷尽未发布分支）。读取旧CLI实际plugin实现确认在Profile cwd spawn pnpm并写manifest，虽然是旧官方命令，仍被当前AGENTS部署规则禁止，未执行。详见升级调查。现有约束不能靠已调查路径关闭正式部署门禁；不要无休止重复正常验收/扩大升级调查，需要用户提供兼容固定版本或明确改变部署约束与范围。保持原Web及所有插件功能不动。

Round 10最终用户明确“不改变部署约束”，拒绝评估旧CLI限定例外。结合“必须保留全部插件能力”，当前正式安装门禁具体阻塞：旧Web无plugin_manager；旧CLI内部Profile pnpm被禁止；目标运行时与现有Context Doctor peer不兼容，未找到目标兼容固定发行。不再自动重复调查/验收，等待用户提供兼容版本或新官方管理入口/明确改变约束后继续。仓库四项门禁通过26/26；服务与全部插件保持原样。

## 历史状态（按后续证据更新，不应直接作为当前状态）

- 阶段：Phase 0，Step 1/2 尚未完成双端实机门禁。
- 工作区版本：0.0.12，JS 零依赖加载 Spike；尚无笔记存储或保存功能。
- Notebook 仅注册精确 `/api/dsh-session-notebook/health` 和 `/api/dsh-session-notebook/list` GET/POST Fetch 路由，Client 经 rpc.call('/api', 'dsh-session-notebook/health|list', ...) 使用 Desktop carrier。
- Host inject：connection。旧独立 rpc.handle 及增加 webServer 注入的方案均被实机失败否定，不得恢复。
- 禁止再次注册 shared `/api` interceptor，禁止 global fetch 绕过 Desktop carrier。
- 最新实际激活：用户确认重启后，官方 set_bundle enabled=true 返回 application=applied、warnings=[]，旧 webServer 错误消失；Client composer 与 sidebar footer 的 Notebook occupant active=true。
- 用户回复整体 OK 后补充：Desktop 和 Web 都尝试过，但 Web 左下角没有 AI 笔记入口。Desktop 获手动 OK；Web 全局入口仍未验收，不得写双端通过。
- 已有 Playwright 会话 sn-phase0 为 headless，在 http://127.0.0.1:19387/ 停留于 authentication required，不是用户已登录页面。没有读取凭据或连接用户个人浏览器。
- 等待用户展开侧栏并刷新后的反馈；仍缺失时需要脱敏 URL 和截图，或经用户授权连接其实际浏览器。不能自动获取 token/cookie。
- 用户已批准测试启用；失败需恢复禁用。当前不要盲目重新安装、禁用或要求重复重启。
- Goal：严格逐步开发整个插件；目标未完成，保持 active。若会话恢复导致 goal disarmed，在用户直接要求继续时按 goal 工具政策 resume。

## 最近检查

npm run check：通过。
npm test：23/23 通过。
npm 使用临时 cache 的 pack:check：通过。
git diff --check：通过。

回归涵盖 Notebook 实际业务 handler 往返、Gateway 两种加载顺序与反复卸载、SDK 单段 channel 校验、caller webServer 缺失注入负例、认证拒绝路径、取消/超时及安全诊断。SDK 提取测试仍使用简化 Cordis/认证/envelope/bridge 接缝，不等于真实 socket/Desktop 验收。

## 重启后立即执行

1. 阅读根 AGENTS.md、本文件、docs/DEVELOPMENT_GUIDE.md Step 0–2 和最近修复记录。
2. 确认用户确已完整退出并重开，检查当前 runtime/Profile；不能假设地址或模块代数未改变。
3. 加载 cordis-plugin-development skill，cordis_inspect_list，再查询需要的 API。
4. 优先定位用户实际 Web 标签页的缺失入口，不复用 0.0.11 启用步骤。需要状态变更时使用官方 plugin_manager；读取 application/warnings；失败安全回退，不手工编辑 Profile。
5. 核验 Client 版本与可见入口；实测 Desktop welcome、POST /api/settings/describe 持续 200、精确 POST Notebook RPC health/list、连接状态。
6. 补 Web/Desktop 各自 UI、主题、键盘、关闭重开、卸载与认证证据。只读 Inspect 注册与单测不能冒充真实 UI PASS。
7. 完成 Step 1/2 门禁后才开展 Step 3 专用 Storage Domain 可靠性实验；当前不得进入产品保存或对真实数据做故障试验。

## 关键证据

- docs/evidence/web-global-entry.md：Web 缺失入口与回归边界。
- docs/evidence/activation-0.0.12.md：当前正式激活及用户反馈。
- docs/evidence/exact-post-fix.md：当前精确 POST 方案。
- docs/evidence/storage-feasibility.md：仅存储契约调查准备；尚未实验或通过门禁。

- docs/evidence/caller-injection-fix.md：0.0.10 实机失败、恢复禁用、0.0.11 ambiguous-install、注入负例。
- docs/evidence/connection-registry-tests.md：SDK 注册与路由分发测试。
- docs/evidence/channel-contract-fix.md：旧多段 channel 无效，改合法单段通道。
- docs/evidence/install-0.0.10.md：历史禁用安装结果。
- docs/evidence/api-gateway-conflict-fix.md：原共享 interceptor 冲突；其中 0.0.9 方案已标过时。
- docs/evidence/phase-0.md、step-1-loading.md：早期能力/可见证据限制。

## 工作区保护

有多项原有 staged/unstaged/untracked 修改；不要 reset/clean 或覆盖用户改动。此次进度保存只落工作区文档，没有创建 Git commit、提交远端、改 Profile 或改运行状态。继续前检查 git status。
