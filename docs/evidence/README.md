# 保留的 Harness 兼容证据

本目录只保留**复发风险高的事故**、**实际采用的文件存储决定**和**可重复执行的验收清单**。逐版本 UI/安装日志、过期存储实验/提案、旧 Web 升级调查与长篇续接日志已合并为[兼容与测试摘要](./compatibility-and-tests.md)的可行动结论，原始文件仍可在 Git 历史按原文件名查阅。本目录并非当前运行时通过证明；工作区源码和当次 Desktop 验收要分别核对。

| 文档 | 用途与状态 |
|---|---|
| [兼容与测试摘要](./compatibility-and-tests.md) | 入口：事故因果、存储选型、测试层级和真实验收边界 |
| [Gateway 冲突](./api-gateway-conflict-fix.md) | `/api` 共享拦截器破坏官方 Gateway；其中 0.0.9 多段 channel 修复**已失效** |
| [旧 Desktop carrier](./desktop-carrier-fix.md) | 历史阶段做法，内含不能复用的共享拦截器方案 |
| [通道语法](./channel-contract-fix.md) | SDK 拒绝多段 channel 的证据；后续 `rpc.handle` 仍未通过实机 |
| [注入失败](./caller-injection-fix.md) | `webServer` 调用者注入假设被真实结果否定 |
| [精确 POST](./exact-post-fix.md) | 转为精确 route 的原因；业务路由清单以当前源码为准 |
| [文件库方案](./lightweight-notebook-0.0.16.md) | 当前元数据+data 文件路线的原始决策；其中数字只适用于 0.0.16 |
| [Desktop 测试清单](./first-mvp-desktop-test-checklist.md) | 待执行的人工验收步骤，**不是实机通过记录** |

通信禁令与正式打包/安装流程以 [AGENTS.md](../../AGENTS.md) 为准；当前实现见[现行设计](../DESIGN.md)。以后仅为新兼容事故、实机验收结论或重要存储决定增加有版本、环境、失败分支的记录，不再按每个开发轮次生成独立文件。
