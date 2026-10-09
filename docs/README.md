# DSH Session Notebook 文档导航

本目录以[当前产品与技术设计](./DESIGN.md)为单一设计入口，另保留开发约束与必要的历史事故证据。设计以工作区源码为基线，不代表当前版本已安装或验收。

| 目的 | 文档 | 定位 |
|---|---|---|
| 当前产品与技术设计 | [DESIGN.md](./DESIGN.md) | 以工作区 `0.0.36` 的产品流程、通信、数据、文件库和测试为基线 |
| 机器可读入口 | [llms.txt](./developer/llms.txt) | 简短导航、命令与关键模块；[架构速览](./developer/architecture.md) |
| 开发、打包和安装 | [根 README](../README.md)、[开发约束](../AGENTS.md) | 发布流程以 AGENTS.md §9 为准；不得手工修改 Profile |
| 交互草图 | [UI 原型](./UI_PROTOTYPE.html) | 独立历史演示，不是生产界面或接口合同 |
| 验收与事故资料 | [兼容与测试摘要](./evidence/compatibility-and-tests.md)、[证据索引](./evidence/README.md) | 保留关键事故、设计决定和人工验收清单 |

## 文档判定规则

1. 当前行为以 `package.json`、`src/host/`、`src/client/index.template.js`、相关模块和测试为准。以 [DESIGN.md](./DESIGN.md) 对照实现和待验收范围；文档与代码冲突时先核实源码及宿主契约，再修正文档。
2. 开发/安装遵守 [AGENTS.md](../AGENTS.md)：共享 `/api` Gateway 不可抢占，Client 走宿主 RPC carrier；安装/启用/重启需分别取得授权。
3. 源码或本地测试通过不等于 Desktop/Web 实机通过。宿主版本、安装状态、认证与通信必须各自记录当次证据。
4. `evidence/` 仅保留关键兼容事故、当前存储决定与验收清单；逐轮日志和被淘汰的实验草案从工作树裁剪，原版仍可在 Git 历史追溯。失效方案见证据索引的警告。

文档只存放在仓库，`docs/` 不进入 npm Bundle（`package.json` 的 `files` 白名单）。
