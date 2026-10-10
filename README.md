<div align="center">

# dsh-session-notebook

面向 DeepSeek Harness（DSH）会话的本地笔记插件：把对话里值得留下的内容划线、引用、整理成可搜索的笔记库。

[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/timestatic/dsh-session-notebook)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-DSH%20Desktop%20%2B%20Web-lightgrey)](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/DESIGN.md)

[![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-purple)](https://github.com/topics/dsh-plugin)
[![note-taking](https://img.shields.io/badge/topic-note--taking-blue)](https://github.com/topics/note-taking)
[![local-first](https://img.shields.io/badge/topic-local--first-blue)](https://github.com/topics/local-first)

![AI 笔记面板与会话持久高亮同屏](https://raw.githubusercontent.com/timestatic/dsh-session-notebook/main/docs/assets/hero-panorama.png)

</div>

`dsh-session-notebook`（界面名「AI 笔记」）是一个常驻 DSH 的 npm Bundle 插件。它把 AI 对话中的片段沉淀为持久、可检索、可导出的个人知识。

插件只在本机存储数据，不采集遥测、不自动把笔记送给模型。它复用宿主提供的 React、主题与连接通道，不接管页面、不捆绑第二份运行时、不注册共享 `/api` 拦截器，因此不会破坏 DSH 官方的启动、API Gateway、认证与连接生命周期。

## 为什么需要它

会话记录是一次性的流水，里面的结论、判断和踩过的坑却是长期资产。这个插件想让你**像读电子书一样读 AI 会话**：顺着正文往下读，遇到值得留下的句子就划下来，补一条自己的想法或标记「待验证」，高亮会持久重绘回原文位置；读完一轮，个人知识库里便多了几条可检索、可整理、可导出、能回链到来源会话的笔记。

- 长对话里翻找上一轮已经得出的结论，比重新问一遍还慢。
- AI 给的判断需要标注"待验证"，而不是和已确认的内容混在一起。
- 跨会话攒的 TODO、架构原则、踩坑记录，散在多个会话里就没有第二次生命。

## 目录

- [界面一览](#界面一览)
- [能做什么](#能做什么)
- [快速开始](#快速开始)
- [如何工作](#如何工作)
- [数据存储](#数据存储)
- [能力状态与已知边界](#能力状态与已知边界)
- [开发与检查](#开发与检查)
- [打包与安装](#打包与安装)
- [文档](#文档) · [许可](#许可) · [支持](#支持)

## 界面一览

上图即真实运行效果（DSH Web Host）：左侧会话正文里，黄色是插件重绘的**已保存划线**，蓝色是当前的文本选区；右侧「AI 笔记」面板列出笔记卡片，标签、来源与时间直接显示在卡片上。

面板分四个 Tab：**笔记库 / 回收站 / 标签 / 数据备份**。顶栏显示工作区，**面板底部显示插件版本与 Host 连接状态**。

## 能做什么

- **划线与引用**：选中会话正文即可保存为划线，附带准确原文、上下文与文本锚点；不伪造官方 messageId。
- **三种笔记类型**：`划线`（只有引用）、`笔记`（引用 + 自己的正文）、`手工笔记`（自己写正文，可携带原文作为改写来源）。原始引用只读，正文独立编辑。
- **标签组织**：创建、重命名、合并、删除标签；标签可选**自动分配或六种预设颜色**（亮粉、活力橙、明黄、薄荷绿、亮蓝、紫罗兰）。内置 TODO、重要、待验证快捷标签。
- **搜索与筛选**：按正文、引用、标题、来源、标签检索；范围可选**全部笔记 / 当前项目 / 当前会话**，类型可筛，标签可多选（任一命中即匹配），也可只看「无标签」；另有时间字段、起止时间与排序等「更多筛选」；列表每页 50 条。标签 Tab 的筛选 chips 直接显示每个标签的笔记数。
- **持久高亮**：在当前会话已挂载的消息上重绘高亮。点击命中一条划线直接打开详情；同一位置命中多条时先给出候选列表让你选。
- **回收站**：普通删除先入回收站、可恢复；永久删除需要单独确认。删除标签只解除关联，不删笔记。
- **导出与备份**：批量选择后导出为单个 UTF-8 Markdown 文件（可选包含标签与来源），确认后才下载；「数据备份」Tab 可下载含笔记、标签、来源锚点和回收站内容的完整 JSON。
- **回到对话**：复制笔记的 Markdown、写入当前输入框或追加到最新草稿——都只在你确认后发生，绝不自动发送。

界面按明暗主题适配。打开笔记库的入口是左侧栏的「打开 AI 笔记」按钮（位于「上下文洞察」与「设置」之间）。

### 标签与检索

![标签 Tab：标签列表与颜色选择](https://raw.githubusercontent.com/timestatic/dsh-session-notebook/main/docs/assets/tags-panel.png)

## 快速开始

### 环境要求

- Node.js `>= 22`（开发基线见[仓库 .nvmrc](https://github.com/timestatic/dsh-session-notebook/blob/main/.nvmrc)；该文件不随 npm 包分发）。
- 已安装并登录的 **DeepSeek Harness Desktop 或独立 Web Host**。开发目标版本 `0.2.0-rc.2`；安装与启用需使用目标 Profile 对应的官方管理入口。

### 本地构建

```bash
npm ci                        # 安装工作区依赖
npm run build:client          # 由模板生成 src/client/index.js（首次或改模板后）
npm run check                 # 校验 Client 产物与模板一致 + 全部入口语法检查
npm test                      # 运行单元测试
```

### 安装到 Web

```bash
dsh plugin --profile web add @timestatic/dsh-session-notebook@0.1.0
```

Profile 名可用 `ls ~/.dsh/profiles/` 查看（`$DSH_HOME` 未设置时为 `~/.dsh`）。安装后启用插件，按需重启 Web Host。

### 安装到 Desktop

Desktop 从 [Releases](https://github.com/timestatic/dsh-session-notebook/releases) 下载对应版本的发布包（例如 `v0.1.0` 的 `timestatic-dsh-session-notebook-0.1.0.tgz`），再作为本地插件包安装进 Desktop：

1. 下载 `.tgz`，放到你有权访问的目录，**不要解包**，也不要放进 Profile 目录。
2. 在 Desktop 的插件管理页面选择“从本地包安装”，指向这个 `.tgz`；或在支持 `plugin_manager` 工具的 Desktop 会话中用 `install_bundle` 传入该文件的**绝对路径**（registry 为空字符串会安装失败）。
3. 读取返回的 `application`：`restart-required` 时须**完整退出 Desktop 再重开**，`applied` 才能继续验收。
4. 复查 `list_bundles`，确认目标 Profile 只有一个版本且 `enabled` 正确。

Desktop Profile 由 Electron 应用独占管理，普通终端的 `dsh plugin --profile desktop ...` 会直接报错，也不要用 `npm install` 装进 Profile。完整约束见[打包与安装](#打包与安装)与[开发约束](https://github.com/timestatic/dsh-session-notebook/blob/main/AGENTS.md) §9；安装、启用、重启均需你单独授权。

### 开始使用

安装并启用、按需重启后：

1. 点击左侧「打开 AI 笔记」，进入笔记库面板。
2. 在会话中选中一段文字，用浮层保存为划线，或补充正文 / 改写为笔记。
3. 用标签、搜索与范围筛选整理笔记；批量勾选后可导出 Markdown 或下载 JSON 备份。

## 如何工作

```text
Client（会话标注 / 笔记库面板 / preview-api 传输适配）
  → connection.rpc.call('/api', 'dsh-session-notebook/<endpoint>', payload, signal)
  → 宿主 carrier + 精确 Notebook 路由（复用宿主 admission，校验 RPC 信封）
  → manual-runtime.js → preview-routes.js → manual-notebook-service.js
  → snapshot-coordinator.js → host/json-store.js → notes.json + data/<uuid>.json
```

关键点：本插件**不注册共享 `/api` 拦截器**，只注册自己命名空间下的精确路由；Client 走宿主提供的连接通道，不自行拼接认证请求、不读取页面 token。完整链路与安全边界见[设计文档 §2](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/DESIGN.md#2-包宿主接缝与整体链路)。

## 数据存储

- 结构：`notes.json` 元数据 + 同目录 `data/<uuid>.json` 不可变笔记文件；元数据是**唯一提交点**。
- 默认位置：`$DSH_HOME/storages/dsh-session-notebook/`；未设置 `DSH_HOME` 时用 `~/.dsh/`。插件配置 `storageFile` 可指定规范绝对路径；不读取其他插件数据。

```text
$DSH_HOME/storages/dsh-session-notebook/
├── notes.json                     # 元数据：唯一提交点
├── .dsh-session-notebook.owner    # 目录归属哨兵，拒绝多个清单共用同一 data/
└── data/
    ├── <uuid>.json                # 每条笔记一个不可变文件
    └── .pending-<pid>-<uuid>/     # 提交前暂存，冲突时清理
```

- **多进程可打开同一库**：Web 与桌面端可同时读写。进程只在加载快照、刷新、提交清单和回收文件期间短暂持有目录锁，冲突请求最多等待 5 秒。
- 变更先写入 `data/.pending-<pid>-<uuid>/`，锁内重读清单并校验 `epoch` / `revision`，通过后才把 UUID 文件提升到 `data/` 并原子替换元数据；过期快照返回版本冲突，不覆盖其他进程的提交。损坏或缺失已引用 data 时停写，不把故障库当空库。
- 预算：有效元数据与引用 data 总计 50 MiB；收据最多 100000 条、最多 16 MiB，超限拒绝新修改。
- 非正常退出可能残留锁标记；插件不会自动删除无法确认所有者状态的标记，需先核实所有进程已停止，再按恢复流程处理。

实现细节见[设计文档 §5](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/DESIGN.md#5-文件库与提交可靠性)。

## 能力状态与已知边界

下表只列**已取得的证据**，不把源码存在或历史结果当作本版验收通过。

| 事项 | 状态 | 说明 |
|---|---|---|
| 源码实现与单元测试 | 已完成 | `npm run check`、`npm test` 通过 |
| npm 打包 `0.1.0` | 已完成 | tarball 含 Host/Client、`locale/`、`icon.svg`、`cordis.patch.yml`、README |
| GitHub Release `v0.1.0` | 已确认 | Releases 附 `timestatic-dsh-session-notebook-0.1.0.tgz`，作为 Desktop 安装来源 |
| Web Profile 安装并启用 | 已确认 | 2026-10-10 本机 Web Host 实机浏览确认插件入口与面板渲染 |
| Web 界面功能核对 | 部分完成 | 笔记库/回收站/标签 Tab、筛选 chips、卡片动作、会话持久高亮已现场看到；官方 `POST /api/settings/describe`、未认证访问被拒、导出下载与删除流程本次未操作 |
| 该 Web Host 的 DSH 版本 | 未核对 | 截图来自本机 `127.0.0.1:3080`，未逐项确认其宿主版本号 |
| Desktop 安装 / 启用 / 重启 / 通信 | NOT RUN | 本次未操作 Desktop Profile |

以下能力**尚未提供**，界面与交付说明中会显式标注：

- 不支持跨设备、多机共享目录或网络文件系统上的一致性保证；锁机制面向同一台机器的本地文件系统。
- 不同 `storageFile` 不得指向同一个 `data/` 目录；存储目录中的 `.dsh-session-notebook.owner` 用于检测并拒绝这种配置。
- 锁文件若因进程异常退出而残留，插件不会自动删除状态不确定的锁；确认所有相关 Host 已退出后再按恢复流程处理。
- 不支持损坏库的应用内受控恢复与自动故障接管；JSON 备份导出不等于保护原始损坏介质。
- 不支持自动 Schema 迁移；不宣称支持无限库容量（业务仍在内存中组装完整 Snapshot）。
- 应用内 JSON 恢复尚未开放（「数据备份」Tab 只提供下载与替换影响预览，没有提交恢复入口）。
- 标签筛选只有「任一命中」（OR）：查询层已实现 AND，但界面没有切换入口，多选标签永远按 OR 匹配。

同一台机器上的 Web 与 Desktop Host 可同时打开同一个本地笔记库，各自维护内存快照，提交时通过短时目录锁串行更新清单并用 `epoch` / `revision` 检测过期写入；若两方同时修改，后提交的一方收到版本冲突，需刷新后重做——**插件不会自动合并两边的编辑**。

当前范围与后续能力（受控恢复、迁移、跨 Host 排他及版本化 Web 回归等）见[现行设计 §8](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/DESIGN.md#8-验收与后续事项)；不可将后续目标表述为本版已交付。

## 开发与检查

```bash
npm run check            # Client 产物一致性 + 发布入口语法
npm test                 # 单元测试（node:test）
npm run test:integration # 隔离介质下的 Host 保存/重开集成测试
npm run test:runtime     # 真实 Cordis Context 下的加载/卸载运行时测试
npm run pack:check       # 打包清单核对
git diff --check
```

运行 `npm run test:runtime` 前先 `npm ci --prefix tests/runtime` 准备隔离运行时依赖。部分单测直接校验目标 SDK 源码，需要本地 `.sdk-reference/`（对应 `@deepseek-ai/cordis@4.0.4`、`@deepseek-ai/dsh-client-connection@0.2.0-rc.2` 等同版本官方包解压内容）。SDK 参考、运行时依赖与测试产物均不提交、不入包。

这些本地测试**不替代**真实 Desktop 网络、浏览器绘制与全流程验收。

## 打包与安装

> 简要说明。权威流程与硬性约束以[开发约束](https://github.com/timestatic/dsh-session-notebook/blob/main/AGENTS.md) §9 为准。

插件直接发布 JS 源码，无编译步骤；Client 由 `scripts/build-client.mjs` 从模板内联生成。

```bash
npm run check && npm test && npm run pack:check
npm pack --ignore-scripts     # 生成 timestatic-dsh-session-notebook-<version>.tgz
```

- 版本号需在**四处同步**：`package.json`、`src/client/index.template.js` 的 `version` 常量、生成后的 `src/client/index.js`、本 README。
- 入包内容由 `package.json` 的 `files` 白名单决定（Host/Client 源码、`locale/*.json`、`icon.svg`、`cordis.patch.yml`）；测试、`docs/`、SDK 参考与测试产物不入包。
- 已发布版本的同一 `.tgz` 会附在 [GitHub Releases](https://github.com/timestatic/dsh-session-notebook/releases)（tag 形如 `v0.1.0`），这是 Desktop 侧的安装来源。
- 未发布到 registry 时，Web Profile 可安装本地包：`dsh plugin --profile web add /绝对路径/timestatic-dsh-session-notebook-0.1.0.tgz`。
- 安装、启用、禁用、重启都是**需单独授权**的动作；`application=restart-required` 时须完整退出 Desktop 再重开，不得凭源码变化声称运行时已更新。
- **禁止**：手工编辑 Profile 的 `package.json`/`cordis.patch.yml`、在 Profile 内跑 pnpm/npm、删除插件数据、启动第二套宿主、用假端点或手改 bundles 绕过管理器。

发布到 registry 的命令与命名硬性约束见[开发约束 §9.3](https://github.com/timestatic/dsh-session-notebook/blob/main/AGENTS.md)。

## 文档

`docs/` 与 `AGENTS.md` 不进入 npm 包；在解包目录阅读时请访问仓库链接。

- [当前产品与技术设计](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/DESIGN.md) · [文档总导航](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/README.md)
- [开发者索引](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/developer/llms.txt) · [架构速览](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/developer/architecture.md)
- [兼容事故与测试摘要](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/evidence/compatibility-and-tests.md) · [证据索引](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/evidence/README.md)
- [开发与发布约束](https://github.com/timestatic/dsh-session-notebook/blob/main/AGENTS.md) · [交互原型](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/UI_PROTOTYPE.html)（历史草图，**与当前实机界面已不一致**，仅作设计沿革参考）

## 许可

本项目以 [Apache License 2.0](./LICENSE) 授权。

## 支持

问题与需求请在 [GitHub Issues](https://github.com/timestatic/dsh-session-notebook/issues) 提出；涉及宿主兼容性的请附上 DSH 版本与复现步骤。
