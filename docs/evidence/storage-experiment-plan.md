# Step 3 专用存储实验计划（待 Step 1/2 门禁完成）

本文件只准备验证，不实现生产 Repository、不打开真实笔记 Domain。当前范围优先 Desktop，独立 Web 暂缓。Desktop 已有正式安装、连接、主题/布局/键盘、两轮启停及启用状态下分时 Gateway HTTP 200 记录；剩余门禁以[Desktop 门禁矩阵](<./desktop-step-0-2-gate.md>)为准。实验尚未执行，不用旧 Web 状态阻断 Desktop，也不将诊断摘要写入测试视为 Notebook 存储通过。

## 实验隔离

使用工作区临时目录和独立子进程、专用 dsh-session-notebook-test Domain。不使用 Profile 的真实存储根目录，不终止运行中的 Desktop/Web。加载已核实版本的实际 storage-domain/storage-json 实现；记录包版本及后端配置。模拟只用于定点故障注入，结果明确标注模拟边界。

## 验证矩阵与通过判据

1. Snapshot 往返：Markdown/Quote/Anchor/Tag 含换行、Unicode 与长文本；写后关闭重开严格相等，返回引用不得改变缓存。
2. rename 前失败：拒绝 Promise；重开读盘仍旧值，Domain/backend 缓存一致。
3. rename 后目录 fsync 失败：实测读盘与缓存差异；判为提交状态未知，不声称可靠回滚；进入保护状态。
4. 子进程提交中断：仅终止专用测试进程；重开得到完整旧值或完整新值；不得破坏真实 Host。
5. 损坏/Schema/未来版本：保留原介质并停止写；读取失败不初始化空库。
6. 同进程两个调用者：串行 expectedVersion 核验；不同记录不丢更新，同记录产生冲突。
7. 两个专用测试 Host 同介质：证实排他或记录不满足安全共享；无锁 backend 不允许产品多Host写入。
8. 5000 条最大代表性 Snapshot：记录字节数、提交/重开时间、内存，阈值由实测和产品规模决定，不编造固定 SLA。

## ADR 必须回答

- 实际后端的成功与未知提交语义是什么？
- 能否实现同介质排他，生命周期关闭是否可验证？
- 同步候选隔离、Schema/版本校验、冲突控制如何与队列结合？
- 损坏介质备份、恢复与迁移的权限边界？

任何不通过项保留证据并阻止产品保存发布；不自动改用裸文件覆盖或 SQLite。所有实验结果分开标注：真实 SDK、本地故障接缝、专用子进程、实际用户 Host。
