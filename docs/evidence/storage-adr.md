# ADR：Notebook 持久化策略（草案，未批准发布）

日期：2026-10-04；目标 Harness SDK 0.2.0-rc.2。状态：PROPOSED，Step3 可靠性门禁未通过。

## 已有证据

[首轮实验](<./storage-experiments-current.md>)验证 SDK 原始实现区域的真实工作区介质往返、失败和损坏拒绝；路由/Schema/Cordis 为明确的测试接缝，不代表正式宿主验收。

[容量实验](<../../tests/experiments/storage-capacity.test.js>)新增5000条代表性记录：每条6000 Unicode码点 Quote，同时保存完整 Anchor.exact、约2300字符正文和来源。不是最终产品完整Schema或最大正文限制。一次独立运行得到196,700,885字节（约187.6 MiB），提交992ms、重开1096ms；比较后进程RSS约1.68GiB，非峰值/增量内存，包含测试序列化与比较开销。仅单次本机样本，不能称p95、UI无卡顿或容量可接受。

注意：样本介质约187.6MiB超过PRD FR-104A恢复**默认**50MiB；PRD明确该限额可配置，不是已确定的总库上限，也不能将介质字节数直接冒充最终备份格式大小。保留50MiB默认值，未来对超限备份在解析前拒绝并引导显式提高配置；不得静默提高限制或截断引用。仍需测最终JSON备份大小、可配置安全上限、内存峰值与可取消恢复，才能确认大库可恢复。

后台close排空进行中的publish、拒绝新写，重开内容一致。首次两项断言失败是VM对象跨realm原型差异；改为完整JSON比较后2/2通过，非修改存储实现掩盖数据差异。

## 独立子进程证据（Goal Round2）

[进程实验](<../../tests/unit/storage-process.test.js>)和[受限子进程](<../../tests/fixtures/storage-child.js>)执行同版SDK原始single实现。子进程只接受工作区 `.storage-test-output` 的子目录，父测试只终止自身创建的fork。

- temp写完/fsync后、rename前暂停，父进程SIGKILL：读回完整旧快照。
- rename后、目录fsync前暂停，父进程SIGKILL：读回完整新快照。
- 两个独立子进程均读取旧值，A提交后B提交：B覆盖A新增笔记，真实进程丢更新已复现。

3/3通过表示原子替换检查点与风险复现符合预期；不是掉电耐久测试，也不是两个正式Harness Host安全验收。首次rename前测试子进程因空悬Promise无活动句柄以code13自行退出；补测试保活后明确验证exit signal=SIGKILL，不掩盖SDK故障。

本轮Inspect重查Host storage合同：BackendRegistry只有register/get/names，KvUnit只有loadAll/写入/close及可选backupRecord；未发现公开介质路径、全介质备份或排他方法。不存在于这一合同不证明宿主所有模块都没有能力，须继续定向调查，不能猜API或绕过沙箱。

## 测试专用候选队列（Goal Round3）

[队列原型](<../../tests/fixtures/candidate-store.js>)只在tests/fixtures，不在生产files、不绑定Domain。5项 [回归](<../../tests/unit/candidate-store.test.js>)验证：不同记录串行不丢更新；同记录旧version拒绝；receipt重建后幂等重试不重复提交；同requestId不同payload拒绝（对象key排序规范化hash）；输入/返回/persist参数深隔离；模拟已落盘后reject冻结当前及排队后续写入；校验失败不污染队列；close排空并拒绝新请求。

仅是业务算法设计实验，persist为模拟，不证明真实Domain整合/跨Host排他/损坏保护。尚缺请求总大小、完整产品Schema、receipt有限保留、restore代际更新、服务生命周期，不能直接移入生产。只读保护后没有自动解锁/重开，必须先有正式排他与介质核验方案。

本轮查询Host Service完整目录，存储相关公开接缝仍为storage/storageDomain；fs目录未列文件锁、原子排他或整介质备份。目录发现并非业务调用，不读取凭据或用通用fs任意访问Profile来绕过缺口。

## 队列与真实SDK组合（Goal Round4）

[组合回归](<../../tests/unit/candidate-sdk.test.js>)使用实际single SDK原始区域和测试队列，真实工作区介质：成功写后关闭重开，稳定requestId从持久receipt返回原结果，revision不再增加；真实rename后目录sync故障导致磁盘revision1/队列revision0，旧队列拒绝任何后续重试。测试在唯一写者条件下关闭重开，从落盘receipt确认原提交，未二次写盘。2/2通过；没有完整Domain/Cordis整合或生产自动解锁。

新增原型键/版本/超长正文边界1项负例通过：拒绝__proto__/constructor/prototype、非安全整数version、100001 UTF16长度正文，限制仅是测试原型保护，不决定产品正文配额。完整业务Schema、总字节限制、有限receipt保留仍待实现。

后续排他/保护方案必须先明确受支持存储边界再批准。可以调查插件专用配置根与旁路锁/原介质副本，但不能私访Profile或任意路径，也不把锁文件变成笔记主库；不使用TTL自动偷锁（暂停/挂起可造成双写），不把PID检测当锁。若宿主接口不能给出稳定介质标识、锁与保护能力，应请求明确批准的最小存储适配扩展或等待宿主支持，不自动退回不安全实现。

## 获批守卫与SDK生命周期原型（Goal Round5–8）

用户单独批准仅工作区专用backend适配原型；不安装、不改Profile、不接真实库、不开放保存。当前尚未注册backend，只实现 [守卫](<../../tests/fixtures/medium-guard.js>)与 [生命周期适配](<../../tests/fixtures/guarded-unit.js>)。

守卫证据：wx+token+inode、符号链接/超限拒绝、残留锁无自动抢占、两个独立测试进程第二写者拒绝、SIGKILL后残留拒绝、正常释放后可重新获取；损坏raw bytes副本fsync/hash验证。protect/release串行，release开始拒绝新工作；acquire目录sync失败保留锁；保护目录sync失败不报告成功。测试读取上限1MiB非产品配额；同UID恶意目录替换TOCTOU未彻底消除，仅受控信任根。

[组合回归](<../../tests/unit/guarded-sdk.test.js>)4/4：真实SDK提交后保护完整介质；close在rename检查点等待在途写并拒绝新请求，期间第二写者仍拒绝；rename后sync失败保留排他且关闭不自动解锁；模拟SDK close失败保锁且重复close返回同一失败。完整门禁76/76，生产包内容仍不含这些原型。

限制：不是完整KvUnit/Domain/Cordis backend；失败open的介质保护、保护副本失败后冻结、receipt配额和恢复人工残留锁处理未完成；SDK关闭错误不能安全自动释放。释放unlink后目录sync拒绝代表释放耐久未知，不可称回滚。后续必须受控根、完整descriptor安全限制和Domain实际整合证据，再决定是否可进入生产设计；不把这些局部测试宣称Step3全过。

## 新增组合证据（Goal Round9–19）

- [受保护SDK测试](<../../tests/unit/guarded-sdk.test.js>)覆盖失败open保护与保护失败冻结；[Domain测试](<../../tests/unit/guarded-domain.test.js>)加入完整产品形状Snapshot（引用/锚点/来源/标签/回收站/收据）严格重开，非法关联保护原件。发现Domain读盘后才校验的缺口，backend前置共用Schema校验补齐；目前Schema仍测试基线，非正式发布模型。
- [流式副本](<../../tests/experiments/stream-protection.test.js>)以64KiB分块覆盖188MiB合成raw介质，独立SHA256校验后no-overwrite发布、文件/目录同步；中断、取消、源增长不发布完成副本。没有峰值内存测量、断电证明或生产root安全结论；partial保留是测试产物。
- [完整Cordis实验](<../../tests/runtime/storage-lifecycle.test.js>)使用用户批准锁定安装的完整包，真实Context/Storage/JsonStorageBackend/DomainFacility、独立backend注册和service key，不调用官方json apply/不挂载替换官方Domain。两轮无预先Domain.close卸载及在途提交卸载均通过，卸载等待写入且期间锁保留，重开完整Snapshot一致。
- [backend关闭回归](<../../tests/unit/snapshot-lifecycle.test.js>)排空进行中open、memoized close、新open拒绝和未知commit失败保锁；pending open异常与完整Cordis异常卸载诊断仍需完善。

这些结果将结论从“仅SDK提取区模拟”提升为“工作区完整Cordis组合通过”，**仍非当前Desktop安装/重启或生产backend路由验收**。受控运行时范围与剩余决策见[验收计划](<./storage-runtime-gate.md>)。

## 收据、合并与初始化证据（Goal Round20–24）

[backend关闭回归](<../../tests/unit/snapshot-lifecycle.test.js>)已补pending open失败保锁与关闭聚合错误，参数拒绝不误报泄漏。[候选队列](<../../tests/fixtures/candidate-store.js>)限制完整请求UTF8字节与收据数量/字节，达到配额拒绝新意图不淘汰旧收据，已有意图重建后不二次写；长期收据回收可用性未决定。[合并实验](<../../tests/runtime/tag-merge.test.js>)完整SDK写前故障旧关联/cache/磁盘不变，成功重开笔记含trash、标签/settings整体一致。

[初始化实验](<../../tests/runtime/initialization.test.js>)发现并封堵SDK已有null/missing global回退initial风险：backend仅真实ENOENT可初始化；已有空global保护原件/保锁。Domain.initial只在内存，首次显式提交后才持久化，标签删除提交后重开不复活。上述业务转换仍测试接缝，非生产Repository，不改变PROPOSED状态。

## 完整产品形状容量测量（Goal Round25）

独立运行[容量探针](<../../tests/runtime/capacity-probe.js>)，完整SDK JsonStorageBackend、5000条产品形状笔记（6000码点引用+完整Anchor、约2340字符多行正文），逐记录重开比较完整相等。Node v24.19.0/darwin/arm64单次结果：介质229,943,414字节（约219.3MiB），验证682.47ms、提交972.48ms、重开1161.59ms；baseline RSS 51,003,392字节，进程maxRSS 1,288,552,448字节；事件循环最大691.01ms/p99 366.22ms。

maxRSS包含构造/校验/比较而非SDK增量，事件循环采样包含校验/比较，单次不能作为冷热p95或UI指标。**已经证明主进程直接全库同步校验/序列化存在明显阻塞风险，不能批准当前策略容量可接受。** 后续需阶段独立测量、多轮及worker隔离方案/受控配额，保持完整字段与恢复一致性；不能静默删Quote/Anchor或以秒级写入“感觉快”放行。现有200MiB保护测试参数也不足以覆盖此219.3MiB完整样本，配置预算需一致，不自动放宽生产限额。

## Worker 对照（Goal Round26）

[worker探针](<../../tests/runtime/capacity-worker-probe.js>)运行同一完整219.3MiB样本，全部构造/校验/SDK读写/比较在worker，父线程只读小型metrics。单次worker验证688.90ms、提交852.28ms、重开1287.34ms；父线程事件循环max42.47ms/p99 18.35ms，相比上轮主线程max691.01ms明显降低。全进程maxRSS1,506,099,200字节，没有证明内存改善；worker内部仍约698ms阻塞，不能作为业务取消响应保证。

这是可行隔离方向，不是已批准架构：没有跨线程完整库传输（刻意避免大对象clone）、公开Domain服务生命周期/锁故障/请求取消、分页查询与完整备份路径，且两轮环境负载不完全一致，未构成统计SLA。后续worker必须拥有权威Snapshot与队列、返回有界DTO而非全库；如何与宿主Storage Domain正式装配需公开契约与真实验收，不在worker另建未批准裸文件主库。Step3仍未过。

## 完整样本原件保护（Goal Round31，仍非发布批准）

[受保护容量探针](<../../tests/runtime/guarded-capacity-probe.js>)复用[同一产品形状合成样本](<../../tests/runtime/capacity-fixture.js>)的5000条note，在真实SDK写入后将业务schemaVersion设为99以定点触发backend预检失败。介质229,943,415字节，比有效样本仅多一位；显式**仅测试**256MiB上限，64KiB流式保护返回后独立分块SHA256验证原件和完成副本全字节相等，锁保留且第二写者被拒绝。单次保护1968.85ms；进程maxRSS1,260,093,440字节包含样本构造和SDK写入，不是保护过程内存增量。首次实验的第二写者断言误期望OPEN_FAILED，实际由锁直接拒绝WRITER_EXISTS，修正后重跑成功。该测试没有crash/ENOSPC、真实Desktop、初始备份格式或全局生产配额结论；成功后残留`.partial`与硬链接是隔离测试产物，不等于生产清理策略。

默认守卫仍1MiB，256MiB通过显式guardHooks注入，绝不静默提升产品限额。上轮“200MiB测试上限不足”缺口已在这一**单次合成原件保护场景**补上，但大库可用性与恢复限额尚未获准，ADR维持PROPOSED。

## Worker 初始化与停机负例（Goal Round32）

[worker 所有权回归](<../../tests/runtime/worker-ownership.test.js>)补足现有有效Snapshot重启的哈希不变：修复测试 worker 每次启动无条件 `global.set(initial/loaded)` 的重写，只有明确缺失介质才初始化写入；重开既有库不触发SDK set。损坏JSON启动不发READY，原件字节不变且保锁；定点SDK unit.close失败返回固定CLOSE_FAILED且保锁，不把退出码0误当安全解锁；正常关闭再次开放排他。当前worker启动失败依赖测试进程error/exit，尚未正式Host UI固定诊断或自动恢复。根目录恶意替换TOCTOU、worker无响应时主进程策略、部分清理失败资源归属及未知提交核验仍未完成。以上只对受控合成根成立，不能宣称实际Desktop存储生命周期通过。

## Worker 关闭继续清理（Goal Round33）

[关闭协调测试](<../../tests/runtime/close-owned.test.js>)验证Domain close或backend close失败时仍继续尝试注销、原始SDK和Context清理；只有全部成功才报告CLOSED_OK，否则固定CLOSE_FAILED不透传原始错误。worker内实际注入unit.close失败的[所有权回归](<../../tests/runtime/worker-ownership.test.js>)仍证明锁保留、不会声称成功。清理尝试不等于介质安全释放：原始SDK.close失败或锁unlink后目录sync失败的耐久语义尚未生产解决，不能因worker退出代码0判定可重新写。

## 初始化所有权边界（Goal Round34）

检查[测试worker](<../../tests/runtime/owned-worker.js>)发现启动时“介质是否缺失”判定原先在获取独占锁前，存在竞争窗口。已移至`facility.open`成功之后：实际受保护backend先获取锁/读库，再对同根`notebook.json`做lstat，仅确认ENOENT才显式初次提交。新增双worker同根启动负例：第二个不发READY，原件SHA256不变，第一owner仍可读且能正常关闭。此修复仅收窄非恶意同UID时序竞态；仍不能抵御持锁进程外主动篡改路径，SDK Domain初始化值在显式commit前只存在内存，异常/不明初始化状态必须fail closed。仍无实际Desktop证明。

## Worker 未答复只读请求（Goal Round35）

[隔离所有权测试](<../../tests/runtime/worker-ownership.test.js>)增加真实worker `list` 定点永不答复，而非仅监听一个永远匹配不到的消息：父测试请求30ms超时后移除监听器，第二写者仍被排他锁拒绝，之后worker可正常close。仅证明**一个只读list**等待超时不应热解锁，也不转移写者；当前测试 helper 不是Host服务、未实现待处理ID去重、预算/退出状态机、无响应写提交的不明状态处理或超时期间卸载协调。生产必须在未知写提交/worker失联时保持只读冻结并等待独立安全核验。

## 父侧只读请求相关性（Goal Round36）

[父侧测试原型](<../../tests/runtime/worker-reader.js>)将单个worker的只读list请求限制为16个在途、1–100条摘要和递增安全整数ID；一个监听器分发，超时移除该ID但**不复用**，迟到/重复/无ID响应直接丢弃，worker exit/error固定诊断拒绝待处理任务并清理监听器。纯协议回归和[真实Cordis worker回归](<../../tests/runtime/worker-ownership.test.js>)覆盖并发两读、超时后的ID隔离、主动detach仍保锁，随后正式close可释放。只读客户端的`close()`仅脱离父侧监听，不调用worker.close、不终止进程、不热解锁。此原型不包含提交请求、真正权限/Host lifecycle、查询分页、超时强制安全撤离；不能扩展为可写服务直至未知提交与取消语义明确。父侧进程退出code 0不能作为安全解锁证据。

## 显式合成根校验（Goal Round38）

[仅测试根规则](<../../tests/fixtures/test-root.js>)要求workerData.root是绝对规范字符串，且为工作区忽略目录`.storage-test-output/`的直接`0700`子目录；lstat目录且realpath与输入完全相等，拒绝symlink/嵌套/缺失/非私有目录，再建Context/SDK。20项完整runtime包含正常worker仍可启动；这只限制测试worker的根，绝不授权给产品使用工作区存储。生产根如何由Host Config显式配置、获得用户同意并保稳定名称尚未决策；受控根依赖可信目录与非恶意同UID执行者，校验与后续open之间仍可能路径替换。未经确认根所有权与恢复边界不部署实验Bundle，也不开放保存。

## Backend/Domain 唯一所有者设计（Goal Round39）

只读 Inspect 的Host `storage`/`storageDomain`与锁定版SDK都证明 backend name 的 registry 是唯一注册表、facility的后台路由由配置选择且`storageDomain`消费者handle由调用者关闭。`@deepseek-ai/dsh-storage-json.apply`固定占用 `json`，不可再次调用当独立实验后端。新增真实SDK [命名共存测试](<../../tests/runtime/storage-lifecycle.test.js>)两轮注册`notebook_test`与官方名`json`并存，拒绝重复`json`，未挂载默认Domain；但不代表真实Host已安全安装。完整候选配置、稳定私有根与root安全威胁边界详见[根与命名空间方案](<./storage-root-namespace-proposal.md>)，仍须单独用户授权。

## 隔离实验配置（Goal Round40）

[实验配置校验器](<../../tests/fixtures/experiment-config.js>)只接受单个显式root，继承工作区合成根0700、无链接/别名规则；输出固定不可变 `notebook_probe_v1` backend/domain，不允许来路不明的额外配置、getter或环境回退。两项[Runtime回归](<../../tests/runtime/experiment-config.test.js>)证明有效root无需在其内部创建任何介质即可校验，缺失/错误/非法输入不产生锁。此纯测试函数**不是**Host插件公开Config schema，不满足真实产品存储根授权、同UID路径替换、持久稳定映射、官方service key装配或跨Desktop重启。后续若拟安装须另行审查与授权，生产0.0.12仍没有保存。

## 私有基目录属主检查（Goal Round41）

审查[测试根规则](<../../tests/fixtures/test-root.js>)发现原只验直接子目录0700，却容许隔离基目录权限过宽或非当前UID属主；已在任何worker SDK初始化前检查基目录realpath必须匹配且基目录与子目录均`0700`、目录类型、当前进程UID，非私有拒绝。纯[权限谓词回归](<../../tests/runtime/test-root.test.js>)不修改共享基目录权限，覆盖外部属主、宽权限、普通文件；现存正常合成目录仍可启动worker。仍无法保证workspace更上层父目录安全或抵御同UID恶意进程重命名/替换；生产稳定根与所有父级可信性另需证据和单独授权。

## 排他锁释放失败安全阻断（Goal Round42）

[合成锁故障回归](<../../tests/unit/medium-guard.test.js>)注入`beforeDirectorySync('release')`失败，证实当前[测试守卫](<../../tests/fixtures/medium-guard.js>)已经先`unlink(lock)`，随后目录sync失败；原持有者的release拒绝，但锁名已消失，第二写者可重新`wx`获得锁。这不是安全验收通过，而是**架构安全缺口复现**：先前关于“关闭失败保锁”的描述仅适用unit/SDK失败发生在`guard.release()`之前或其他具体阶段，不适用于unlink之后的目录fsync失败。不能把此原型升级为生产排他，不应通过忽略fsync错误或简单调整同步顺序掩盖。不对实际Host尝试恢复；需重新设计代际/在线销毁/离线恢复与失效注入矩阵，直至任一失败不会使旧写者和新写者并存。仍在PROPOSED状态，无生产写入批准。

## 释放未知状态诊断收敛（Goal Round43）

测试守卫现在把`unlink(lock)`之后目录sync失败映射为固定`RELEASE_UNKNOWN`，再次`release()`仍返回相同码，旧句柄`protect()`拒绝；[故障回归](<../../tests/unit/medium-guard.test.js>)仍证实第二写者可在此时获取`wx`锁。此修改只是**不掩盖失败、避免原异常泄漏和重试误报成功**，没有消除并发窗口，更不证明崩溃持久性。父worker的close会报`CLOSE_FAILED`而非`CLOSED_OK`；不能由该码推断残留锁，也不能由新的写者可获取推断旧写者已被物理终止。生产仍禁止使用当前测试守卫，需完整关闭证明、代际协议、原子身份绑定和故障恢复设计。

## 完整worker释放失败传播（Goal Round44）

[完整Cordis worker回归](<../../tests/runtime/worker-ownership.test.js>)用test-only guardHooks令`release`目录sync失败，观察到worker最终回应`CLOSE_FAILED`且exit code仍为0，同时立即可由新的`acquireMedium`获得同根写者锁。它证明当前关闭协调器不谎报`CLOSED_OK`，**也证明退出码/失败码均不是独占锁保留证明**。所有相关行为仅发生在工作区隔离介质；未修复释放原子性、未建立跨Host写者停止或锁代际协议。现有原型禁止部署、Step3不通过。

## 父进程重启闸门（Goal Round47，仅隔离原型）

[父侧只读状态机](<../../tests/runtime/worker-restart-gate.js>)只有收到**精确**`CLOSED_OK`且同worker随后exit 0才允许本父进程尝试下一worker；`CLOSE_FAILED`、无回复/先退出、非零退出、畸形回复均永久拒绝自动重启，迟到成功不补救。[真实worker故障回归](<../../tests/runtime/worker-ownership.test.js>)在release-sync失败且锁名已消失时证明本父进程仍拒绝重启，但另一独立写者仍可取得锁。状态机只在测试中手工调用，**尚未连接实际父侧spawn路径或安装到Host**，不提供跨Host fencing、真实介质路径安全或可用性恢复。不得把它称作锁协议修复；生产阻断不变。

## 父侧启动/关闭集成（Goal Round48，仍仅隔离）

[合成worker父控制器](<../../tests/runtime/worker-parent.js>)在测试进程真实spawn/close事件中接入一次性重启闸门，精确成功答复且随后exit0才准一次替换；丢答复/错误/超时拒绝。本地[生命周期回归](<../../tests/runtime/worker-parent.test.js>)覆盖正常两次worker关闭与一次替换，以及release同步失败后即使另一进程可获得锁仍拒绝同父替换。第一次实现漏重置新worker的closing状态，回归报告`CLOSE_IN_PROGRESS`，修正后通过。入口**不在生产包/Host中**，没有状态跨父进程持久化、没有跨进程栅栏；`workerData.root`仍是合成根。其保护只防止同一个测试父进程擅自重启，不解决外部进程绕过或介质掉电恢复，Step3仍阻断。

## 离线优先保锁关闭实验（Goal Round49）

为审查路线A，[测试守卫](<../../tests/fixtures/medium-guard.js>)可选择合成介质的`retainLockOnClose`：正常关闭在核对锁所有者后拒绝unlink、返回固定`OFFLINE_RECOVERY_REQUIRED`；[单元](<../../tests/unit/medium-guard.test.js>)与[完整worker父侧](<../../tests/runtime/worker-parent.test.js>)均验证原锁保留、新写者拒绝、同父自动重启拒绝。**它不是发布候选**：正常停机也必须另授权走尚未完成的离线保护/恢复，违反无感重启可用性目标；原默认在线释放缺口未改，真实Host/跨机掉电/路径替换没有证明，未做真实介质处理。路线取舍见[恢复设计](<./storage-recovery-design.md>)，没有收到缩减MVP要求或采用离线模式的用户授权。

## 跨进程代际检查竞争（Goal Round51）

用户选“研究跨进程安全交接”，同时明确维持不授权Desktop再次禁用/恢复。本轮只读当前Host Service目录与锁定版`dsh-storage-json@0.2.0-rc.2`，确认标准Storage/Domain合同不包含跨进程锁/原子代际CAS：官方单global SDK `writeAtomic` 的发布顺序是写同目录tmp→file sync→`rename(tmp,target)`→directory sync，`SingleUnit.publish()`调用该函数；不能从单次检查代际推出发布时仍有所有权。[合成介质竞争回归](<../../tests/unit/fence-check-window.test.js>)执行保存版SDK atomic代码，只在`rename`测试接缝加入“先核对代际，之后暂停”——新写者将代际改为2且发布`new`，旧写者恢复后仍以原始`rename`覆盖为`old`。该测试的故障注入不是原生SDK已有栅栏；精确反证“在`setGlobal`之前/rename之前读一次代际即可保证安全”，但不排除宿主提供跨进程强制排他、原子CAS或不同存储协议。不得在未评估原子提交/所有者交接并获依赖或宿主能力授权前制作保存服务。

## 可观察的旧锁丢失预检（Goal Round52，非栅栏）

[测试守卫](<../../tests/fixtures/medium-guard.js>)开放顺序化`assertOwner`，在测试适配的每次`setGlobal`前比较私有根、锁inode/token；[合成SDK回归](<../../tests/unit/guarded-sdk.test.js>)先替换现有锁内容，再请求写入：固定`OWNERSHIP_UNKNOWN`、之后冻结为`COMMIT_UNKNOWN`，原盘revision保持1、替换锁未移除。只针对**写前已经可观察到**的所有权丢失，避免明知不再拥有锁仍调用SDK，属于防御补充而非安全交接证明。上节测试已证明检查和SDK的`rename`之间仍可能由新写者夺权；因此不能说写入受可靠跨进程栅栏保护。正式Host未采用此适配、SDK默认发布不含锁条件，生产0.0.12无保存。

## 条件提交替代介质可行性（Goal Round54，仅合成SQLite）

当前工作区Node v24.19.0可导入实验性内建`node:sqlite` `DatabaseSync`。[两独立进程实验](<../../tests/unit/sqlite-fence.test.js>)仅在新建私有合成根上存一行`(generation,body)`：旧进程先读1并等待，新进程在`BEGIN IMMEDIATE`内`UPDATE ... WHERE generation=1`提交`new`且变为2，旧进程再运行同条件更新得到0行、ROLLBACK，重开后仍为(2,`new`)。这里**代际条件与Snapshot数据在同一SQLite UPDATE中**，区别于上节先检查再由JSON SDK无条件`rename`；构成单机SQLite事务路径值得继续调查的候选，不是现有JSON SDK或Host Storage可靠性通过。

重大未证：`node:sqlite`当前平台/目标Electron内是否有相同API与成熟支持；SQLite与目标官方Storage Domain独立backend的装配、隔离根、保护现有介质、单线程同步阻塞、完整219.3MiB样本容量、busy/ENOSPC/掉电/SIGKILL/双进程、checkpoint与多目录身份、跨设备/网络FS语义及恢复。实验数据不是正式JSON Snapshot；不擅自切换SDK/产品介质，也不以SQLite自动事务替代明确的迁移与授权。用户只同意研究路线B、不授权安装/启停/重启或新正式根。

## SQLite合成故障边界（Goal Round55）

扩展[独立进程测试](<../../tests/unit/sqlite-fence.test.js>)：同一行UPDATE后、COMMIT前注入异常并ROLLBACK，重开仍(1,`initial`)，新独立进程随后可提交(2,`new`)；COMMIT后、发送成功答复前合成进程以78退出，父侧只收到退出码没有`COMMITTED`，重开可读(2,`new`)，旧代际进程再写被0行拒绝。**成功介质状态不等于调用方收到成功回执**：父控制器必须将丢答复记为未知提交，重新打开并按持久请求ID+内容指纹查原子同事务收据后才可安全决定重试。当时实验**没有收据表、请求ID、异常之后的产品重试协议**，更未证明`PRAGMA synchronous=FULL`在掉电、目标Electron、网络盘上满足预期；不可用这3项测试宣称Step3或路线B通过。下一节只补工作区最小收据实验，不替代正式协议。

## SQLite同事务收据（Goal Round56，仅合成最小协议）

[子进程测试](<../../tests/unit/sqlite-fence.test.js>)新增私有根`receipts(request_id,fingerprint,generation)`表；每个合成请求的代际和正文算SHA256，在`BEGIN IMMEDIATE`中先查收据，若无则执行同一事务的条件UPDATE与收据INSERT、再COMMIT。故障回归：COMMIT后进程78退出未答复，新进程同请求重试返回`REPLAYED`而不重复写、同ID不同正文返回`CONFLICT`，另ID旧代际返回`REJECTED`；COMMIT前合成回滚后同一请求仍可首次提交、再次重试才`REPLAYED`。实验进程可以凭收据在重新打开后区分一类未知提交；**不是正式幂等实现**：没有产品完整请求字段/结果、请求ID生命周期、指纹协议版本、收据容量上限与长期删除、完整SnapshotSchema或Cordis backend，亦未注入提交时磁盘故障、跨机器/路径替换、真实Host与掉电；此前SQLite路线B一切门禁保持开放。

## 同请求并发收据的隔离验证（Goal Round57）

[双子进程回归](<../../tests/unit/sqlite-fence.test.js>)令两个不同进程都在任何写入前读到generation1、同一requestId/同一意图，分时允许进入同一SQLite事务。第一进程提交(2,`new`)与收据，第二进程查到相同指纹返回`REPLAYED`，重新打开库只有一个收据和generation2；这是**合成同请求串行**证据，不代表目前实现提供大对象Schema校验、饱和并发超时与busy重试、永久收据上限、Host worker超时恢复或目标文件系统正确性。若将来映射Cordis `KvUnit.setGlobal(value)`，该接口本身不带requestId/expectedGeneration参数，必须在自有独立backend的Snapshot值内定义条件协议，且Domain写缓存/事件发布在CAS冲突与重放时不出现虚假更新；当前没有相应集成测试/发行批准。

## 真实Domain条件写冲突边界（Goal Round58）

[完整Cordis Context集成回归](<../../tests/runtime/domain-cas-rejection.test.js>)把**测试条件KvUnit stub**独立注册为backend，由真实`DomainFacility`打开；模拟另一进程在当前Domain缓存rev0后把介质改为rev1。`domain.global.set(rev1)`的测试KvUnit拒绝后，实际Domain未替换缓存rev0、未发`domain/changed`；同一旧Domain再写仍被拒，关闭/重开后读取rev1，提交rev2才更新介质并发一个事件。首次测试暴露`defineDomain`需要`schema.safeParse`，补全真实契约后通过。此证据**只覆盖测试stub明确抛错的分支**，没有证明SQLite原型能作为正式`KvUnit`、进程间缓存自动刷新、异常COMMIT后的未知状态可以继续写、冲突可安全无限重试。产品实现须在条件冲突/未知提交下冻结旧Domain并定制重开/收据恢复，不把`setGlobal`成功与消息答复成功混同。

## Domain重放语义不匹配（Goal Round59，阻止直接集成）

[真实Cordis Domain负向回归](<../../tests/runtime/domain-replay-event.test.js>)以测试`KvUnit.setGlobal`在持久收据表明“相同请求已提交”时**不落盘、返回resolved**模拟SQLite `REPLAYED`：真实Domain仍设置本地globalValue并发出1次`domain/changed`，尽管合成介质未修改。原因是保存版SDK `DomainImpl.global.set`在`await unit.setGlobal(value)`后无条件发布缓存与事件，`KvUnit`的返回值为`Promise<void>`、没有`REPLAYED`/no-change分支。上节的CAS拒绝回归只覆盖抛错不发事件，**不能解释为重放安全**。因此不得将SQLite同事务收据的`REPLAYED`直接映射为`setGlobal`的成功，或把它抛错等同可靠恢复；业务/worker层应在调用Domain前处理持久收据并对旧Domain冻结/重开，经目标介质复核缓存与事件设计。此测试是合成stub的接口反例，不是SQLite与Cordis的生产集成或Host实机验证。

## SQLite写事务争用快失败（Goal Round61，仅本机合成）

[独立进程回归](<../../tests/unit/sqlite-fence.test.js>)使进程A在`BEGIN IMMEDIATE`拿到事务后等待，进程B设`PRAGMA busy_timeout=1`并试图进入事务：B报告失败且退出1；待A放行后其提交(2,`new`)与唯一收据，重新打开数据库验证没有B的收据。结论仅是**在当前macOS/Node合成根的一种BUSY争用交错不产生假提交**。B固定`FAILED`不区分SQLite_BUSY与其它故障、无退避或有界重试协议；A可能超时/崩溃、磁盘故障、目标Desktop平台差异、进程间长事务阻塞和完整Snapshot峰值均未验收。生产业务层仍需将无法确认的提交保持UNKNOWN，不把快失败等同可立即重试新意图。

## 收敛选择（Goal Round29，仅下一实验方向，非发布批准）

选择继续验证：**单global整体Snapshot + 受保护专用backend + 单写者排他 + worker拥有权威库/串行队列 + 有界DTO**。理由：整体候选能一致提交note/tag/settings/receipts；已证明原始SDK多实例丢更新必须排他；主线程完整219.3MiB处理明显阻塞，worker对照改善父线程响应。拒绝裸文件主库、第二json apply、per-record多put伪事务和将全库postMessage回父线程。

[worker所有权实验](<../../tests/runtime/worker-ownership.test.js>)证明完整SDK/Context/受保护Domain在worker内可用，正常关闭释放、异常终止残留拒绝；协议有界摘要与非法id固定诊断通过。它不是当前宿主服务，不证明正式host storageDomain可跨线程调用。需明确独立插件自有facility/隔离上下文装配是否符合产品Storage Domain约束，安装仍另批。

| 剩余门禁 | 下一证据 | 当前是否允许保存 |
|---|---|---|
| Desktop资源/认证 | 按已有矩阵补缺范围，不重复已完成disable/restore | 否 |
| 专用稳定namespace/root | 公开Config、只允许受控显式根、service所有权，无默认服务覆盖 | 否 |
| 宿主重启持久化 | 独立实验Bundle，另授权安装/启停/重启，synthetic数据 | 否 |
| 容量与内存 | worker多轮+分页/恢复/取消，完整219.3MiB保护预算，峰值内存优化 | 否 |
| 故障恢复可操作性 | 离线恢复工具与故障矩阵，草案见[恢复设计](<./storage-recovery-design.md>) | 否 |
| 正式Schema/Repository | 产品配额、时间/关联/请求校验、统一队列和有界收据长期策略 | 否 |

未批准降低5000条要求或默认提高恢复限额。上述方向选择不改变PROPOSED状态，也不授权安装/开启生产保存。

## 候选决策（未实施）

1. 主存储仍走宿主Storage Domain，优先一个global Snapshot整体候选提交。不退回裸文件主库/SQLite，不用多put冒充事务。
2. Repository必须clone输入/输出及候选；严格完整Schema和关联校验由业务层负责。SDK当前global.set不做写候选Schema校验，get/set对象有别名风险。
3. 完整业务修改进入同一串行队列：幂等、expectedEpoch/version/revision、候选、校验、持久化、权威缓存、成功通知。单记录操作不单独绕过队列。
4. 持久化异常原则上进入提交状态未知的只读保护，保留草稿/请求ID；不能仅靠异常类型宣称磁盘未变。关闭重开核验需在排他有效且介质保护能力已明确的情况下执行。
5. 必须取得真实同介质单写者排他。当前facility单开限制只作用于同实例，两个独立实例已复现丢更新。进程PID、内存队列、声明只有一个用户都不构成证明。
6. 读取失败保留介质，拒绝空库初始化；未知版本不降级覆盖；恢复保护失败不得替换。后端single优先，per-record吞掉坏文档不符合主库要求。
7. 全快照容量暂不批准：本次近188MiB、约秒级提交和高内存证明需要测量/限额/优化。不得静默截断Quote或删Anchor。

## 必须关闭的事项

- 实际生产backend路由/存储隔离边界通过正式公开契约确认（Config schema不能推出实际值）。
- 独立子进程提交中断旧/新完整状态，两个真实专用写进程及安全排他设计。
- 并发expectedVersion、幂等收据、未知提交后安全只读与核验、候选隔离。
- 真实损坏介质保护、恢复点、迁移与恢复代际。
- 产品最大字段/全库配额与50MiB受控恢复一致；多轮冷/热性能、事件循环阻塞与内存峰值。
- 完整Step0–2实际资源与认证证据范围仍见 [Desktop矩阵](<./desktop-step-0-2-gate.md>)，本地实验不自动关闭正式门禁。

不实现生产Repository、不安装或开放保存，直到这些阻断项有可重复证据和批准的决策。生产版本仍0.0.12。
