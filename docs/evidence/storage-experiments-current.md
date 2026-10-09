# Step 3：首轮隔离存储实验（2026-10-04）

## 前置验收

本轮经用户单独批准，官方 manager 确认 Desktop Notebook 0.0.12 installed/enabled=true；临时 disable applied/warnings=[]。用户在真正 Desktop Network 确认入口消失、新 POST /api/settings/describe=200、页面/设置正常。随后 enable applied/warnings=[]，用户确认入口唯一、v0.0.12、Host 已连接及页面/设置正常。恢复原 enabled=true；没有重启、卸载或操作独立 Web。

这补齐已明确的禁用期间 Gateway 直接 HTTP 缺口。Step 0–2 当前 Desktop 加载/通信主要证据已补齐；本轮仅进行专用 Step 3 隔离调查，不宣称全部正式门禁关闭，不开放生产写入。监听器/路由实际释放、认证和失败分支的实机证据范围仍见 [门禁矩阵](<./desktop-step-0-2-gate.md>)，不能用本地测试代替。主题/尺寸/上下文和前两轮启停沿用有日期的历史用户手动证据，不冒充本轮重测。独立 Web 仍未正式持久安装验收。

## 实验范围与来源

- 本轮 Inspect 重查 storageDomain 精确合同、storage-json Config；官方 base/web-app 0.2.0-rc.2。
- 使用先前固定下载的同版 storage-domain/storage-json 参考包，执行原始实现区域；提取边界变化立即失败，不改写算法。
- 测试入口：[storage-sdk.test.js](<../../tests/unit/storage-sdk.test.js>)。
- 介质仅为工作区 `.storage-test-output/run-*`，Domain 名为 dsh-session-notebook-test。保留合成介质且 Git 忽略，不写 Profile/真实 Notebook Domain。
- 真实 Node 文件系统 write/fsync/rename/close/reopen；定点 sync 故障为测试 hook。Cordis 路由/events 和最小 Schema 为测试接缝，非完整 Cordis/Zod，非正式宿主重启或两个真实 Host。

## 已执行：8/8 实验断言通过

| 实验 | 实际结果 | 含义 |
|---|---|---|
| Snapshot 关闭重开 | Markdown/CRLF/emoji/组合字符/Quote/Anchor/Tag 严格一致 | 本地 SDK 介质往返通过，不等于应用重启验收 |
| rename 前 file-sync 失败 | 旧磁盘/缓存不变、无事件、临时文件清理、后续队列可用 | 本故障点安全 |
| rename 后 directory-sync 失败 | Promise 拒绝；内存旧值、磁盘新值；关闭重开读到新值 | **提交状态未知，不能称回滚** |
| 非法 JSON | malformed-medium，原介质不变 | 不作为空库 |
| 未来介质版本 | version-mismatch，原介质不变 | 不降级覆盖 |
| 不合法业务快照 | invalid-record，原介质不变，重试仍拒绝 | open 校验生效 |
| 两个独立 facility 写同介质 | 第二写者覆盖第一写者新增记录；第一缓存仍旧视图 | **丢更新风险已复现，跨 Host 门禁未通过** |
| 引用别名与写入校验 | 修改 set 的候选污染缓存但不改磁盘；global.set 接受不合法值，重开拒绝 | Repository 必须深隔离并显式校验候选，不能依赖 SDK 写入校验 |

测试绿表示风险断言得到证实，**不表示存储已满足可靠性发布门禁**。

## 下一步 / ADR 状态

ADR 尚未定稿，不开放生产保存。后续：

1. 真实独立子进程两写者与提交中断实验，5000 条代表性最坏体积性能。
2. 确认实际 backend 路由的公开配置入口；当前 Config schema 不暴露实际 root/routes，不假设生产必为 JSON。
3. 找到可验证的同介质单写者排他机制；无排他不允许产品并发写，不擅自改主存储为裸文件/SQLite。
4. 候选深隔离、严格 Schema、全库队列和 expectedVersion；任何不确定写失败冻结写入并核验介质，而非继续覆盖。
5. 读取损坏原件保护、备份/迁移恢复点的正式能力。

生产 Host/Client 保持 0.0.12，无新增路由或存储写入功能，未安装新包。

## 本轮仓库门禁

npm run check 通过；npm test 48/48 通过（含本轮新增8项）。首次 pack:check 因默认 npm cache EPERM 失败；改用已忽略的工作区 `.storage-test-output/npm-cache` 重跑通过，未 sudo/chown 或修改全局缓存。git diff --check 通过。打包清单只含原生产入口/元数据，没有包含实验介质或 SDK 参考。
