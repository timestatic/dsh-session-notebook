# Step 3 收敛与受控运行时验收计划

状态：计划，不是实机结果。当前生产Notebook0.0.12无保存；所有适配仍在tests/fixtures。用户已批准隔离backend原型开发，未批准安装或新生产存储路径。

## 已有本地证据

同版SDK原始实现区域、真实工作区介质、完整产品形状Snapshot关闭重开；两个独立测试进程互斥；崩溃残留锁拒绝；目录sync失败/未知提交/保护失败停止写；坏介质raw副本；Domain与backend共用校验。模拟Cordis/最小Schema与进程断点均显式标识，不能冒充实际宿主。

## 不可提前宣布完成

1. 工作区完整Cordis Context真实注入、独立backend/service key、无preclose及在途写入卸载已通过。仍未部署到Desktop；官方Domain routes未改，不能覆盖默认json/storageDomain服务。独立依赖由用户批准，根工程 `npm run test:runtime` 单独执行（默认unit门禁不含它），缺依赖时在tests/runtime执行 `npm ci --ignore-scripts` 并使用工作区缓存。
2. 生产存储根未定。隔离worker已改为先验证绝对、规范、`0700`、`.storage-test-output/`直接子目录的合成根，拒绝symlink/嵌套/不存在/世界可访问根，然后才建立SDK；见[测试根规则](<../../tests/fixtures/test-root.js>)。这是工作区**测试专用白名单**，不是用户批准的生产根或 Config schema。正式根仍须显式配置与逐次授权、稳定namespace、不从cwd/Profile推导；同UID恶意路径替换与目录权限变化TOCTOU仍未消除。
3. 发现明确新阻断：测试守卫release先unlink再目录sync，故障后锁名已失且另一写者可以取得；现测试守卫报告`RELEASE_UNKNOWN`且重试不改报成功，但**未修复互斥缺口**，不能以“关闭失败保锁”概括所有失败；详见[ADR](<./storage-adr.md>)，生产锁释放/代际方案须重新设计与故障矩阵。Crash残留锁恢复只读保护安全，但未可操作。人工恢复必须完整确认所有潜在写者已停止，保护介质和锁；不得热删除、不按TTL/PID猜无人使用。实验Bundle不能自动重启/杀当前Host。
4. 约188MiB代表性介质读写及188MiB合成raw介质的64KiB流式保护均通过；默认保护限额仍1MiB，200MiB为显式测试参数而非生产配额。取消/中断/源增长不发布完成副本已测，仍缺完整产品最大样本、内存峰值、磁盘预算、断电/ENOSPC和可接受性能结论。
5. 产品Schema测试完整字段形状仍未是正式生产Schema，配额/日期/最小选区/完整备份一致性边界待定。未来production需复用同声明并避免静默变换。
6. 完整SDK已验证显式首次提交耐久、标签删除后重开不复活、已有null/missing global保护，以及标签合并写前失败旧磁盘/cache/关联不变；均是测试候选不是生产Repository。尚需业务请求队列、权限/时间戳/收据与上述操作整合。

## 最小后续实验建议（先本地完整Cordis，不安装）

- 工作区独立可安装实验Bundle，独立backend名与唯一test Domain，专用配置测试根，无Client/路由/业务写UI；自有facililty只服务testDomain，不替换官方服务。
- 验证backend/disposer/异步close生命周期及两轮启停模拟真实Cordis Context。
- 验证专用Domain正常重开、停写保护；只写固定synthetic数据，不采集真实会话内容。
- 完成后另行申请官方Plugin Manager安装/启用/验收/移除；若需Desktop重启必须另授权并保存草稿。注册成功不等于实际Host重启持久性验收。
- 安装结果application/warnings分别记录，验收后恢复原状态；失败不得开放产品保存。

## Root 与命名空间方案（Goal Round39）

[候选方案](<./storage-root-namespace-proposal.md>)明确独立 backend registry 名、service key、自有 DomainFacility/worker、显式私有根及各运行状态变更的授权边界；在固定SDK真实独立Context两轮测试中，专用 backend 与`json`共存、重复`json`被拒绝且不挂载默认Domain。测试 worker 的工作区白名单绝不成为已批准的产品 Config 或宿主根。同UID路径替换/跨平台fd绑定与真实Host装配尚未验证，仍不安装。

## 释放协议决策（Goal Round45）

[恢复设计的风险矩阵](<./storage-recovery-design.md>)区分写前关闭失败保锁、unlink前失败、unlink后sync失败，以及正常结束；两条候选路线分别是用户授权的全写者离线恢复（牺牲自动可用性）或证明跨进程代际栅栏/底层强制排他的全新协议。不能用`CLOSE_FAILED`、exit0、锁文件存在与否或mtime/PID直接推导介质可写。锁释放窗口尚未修复，不能装配实验Bundle或批准Step3。当前Node v24.19.0/darwin的标准FileHandle没有`lock`/`flock`方法，`wx`本身不提供旧写者栅栏；需要明确选择离线恢复可用性代价、获批宿主能力/依赖研究，或继续只读，详见[能力调查与路线表](<./storage-recovery-design.md>)。

## 下一开发切片

已补齐流式副本、有限收据、标签、完整219.3MiB容量及worker响应对照；已形成[离线恢复设计](<./storage-recovery-design.md>)但无恢复工具。worker完整Context所有权/有界DTO/正常关闭/异常终止保锁通过，仍非Host服务。

完整219.3MiB合成介质已通过显式256MiB**测试参数**的受保护backend打开失败→流式原件备份，副本SHA256/字节数与原件相等、保锁和第二写者拒绝；见[ADR](<./storage-adr.md>)。单次保护约1.97秒，进程RSS含样本构造，不代表可接受生产性能或配额。下一切片：设计并验证worker启动失败/超时/正常停止和关闭异常矩阵，审查独立worker fixture能否依公开契约成为插件自有facility，确定稳定namespace与受控Config；再做多轮分阶段容量/事件循环/峰值实验和完整备份恢复上限决策。可安装实验Bundle之前先补齐这些本地失效场景；安装/启停/重启逐次另授权、仅synthetic根。剩余实机/恢复/正式Schema门禁见ADR，不做保存UI或用测试数量宣称M0完成。
