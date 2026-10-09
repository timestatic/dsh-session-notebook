# Step 3 准备：Storage Domain 可靠性调查（未通过门禁）

## 证据来源

当前 Host Inspect 确认 storageDomain API，以及 include:storage-domain / include:storage-json Config 条目。Config schema 只声明字段，不暴露当前实际 backend 路由/root；不能默认 Notebook 一定落 JSON。安装目录 README 读取仍报 BigInt 错误，获取同版 0.2.0-rc.2 的公开参考包到 .sdk-reference。

参考包：storage-domain SHA1 271d5c08cb5f63d216e1512238a33be317de7e2c；storage-json SHA1 dcc26271492eac80cb0591b16a6023c776581c2f。未添加生产依赖，未修改 Profile。

## 已核实实现

- Domain global.set 排队，await unit.setGlobal 成功后更新 Domain 缓存；失败不更新 Domain 缓存。
- JSON single setGlobal 先设置 backend 缓存，publish 失败时回滚缓存。
- writeAtomic：同目录 temp → write → 文件 fsync → close → rename → 目录 fsync（POSIX）。
- JSON 文档明确没有跨进程写锁，两个 Host 可 last-completion-wins。
- Domain 不提供跨表事务或跨进程变更可见性；全库业务变更应优先评估一个 global Snapshot，不做独立多次 put 假事务。
- global.get 返回内部对象，Repository 必须隔离引用，避免调用者提前修改缓存；写入候选也需要快照隔离和 Schema 验证。

## 重要待验证风险

1. **rename 后目录 fsync 失败**：磁盘可能已是新值，而 setGlobal catch 会将 backend 缓存回滚旧值，Domain 缓存也不更新。不能把所有 Promise reject 认作“磁盘旧值未变”。Repository 需要提交状态未知错误/只读保护及重新读盘核验方案，不能继续写掩盖分歧。
2. **跨 Host 同一介质**：无排他保证，不满足指南安全排他或共享一致性门禁。需验证已有宿主能力或提出经批准的排他设计，不能用内存队列当跨进程锁，也不退回裸文件主存储/SQLite。
3. **损坏与高版本保护**：single 应拒绝 malformed-medium/version-mismatch；per-record 可将坏文档视为 absent，不符合“不当空库”目标，不能直接采用。
4. **引用/并发/Schema**：global set 的入参校验、队列复用与失败后可继续性需进一步读取和实验；业务 expectedVersion 必须在 Repository 串行候选提交中检查。
5. **容量/终止进程**：5000 条、专用测试 Host 中断与恢复仍未测；不能在真实 Host 做杀进程实验。

## 下一步

先补齐 Step 1/2 双端标识与真实 Gateway 证据；调查阶段不跳过门禁。随后用专用 workspace 临时介质运行实际 SDK 存储写失败与重开实验，特别区分 rename 前失败和 rename 后 fsync 失败；形成 ADR 后再实现业务 Repository。当前没有打开生产 Domain、写入存储或开放笔记保存。
