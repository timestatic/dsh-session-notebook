<div align="center">

# dsh-session-notebook

面向 DeepSeek Harness（DSH）会话的本地笔记插件：把对话里值得留下的内容划线、引用、整理成可搜索的笔记库。

[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](./package.json)
[![Platform](https://img.shields.io/badge/platform-DSH%20Desktop%20%2B%20Web-lightgrey)](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/DESIGN.md)
[![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-purple)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/topic-deepseek--harness-purple)](https://github.com/topics/deepseek-harness)

[![note-taking](https://img.shields.io/badge/topic-note--taking-blue)](https://github.com/topics/note-taking)
[![personal-knowledge-management](https://img.shields.io/badge/topic-personal--knowledge--management-blue)](https://github.com/topics/personal-knowledge-management)
[![knowledge-management](https://img.shields.io/badge/topic-knowledge--management-blue)](https://github.com/topics/knowledge-management)
[![local-first](https://img.shields.io/badge/topic-local--first-blue)](https://github.com/topics/local-first)

</div>

`dsh-session-notebook`（界面名「AI 笔记」）是一个常驻 DSH 的 npm Bundle 插件。它在会话右侧栏提供一个统一的笔记库，让你把 AI 对话中的片段沉淀为持久、可检索、可导出的个人知识，而不是散落在一次次会话记录里。

插件只在本机存储数据，不采集遥测、不自动把笔记送给模型。它复用宿主提供的 React、主题与连接通道，不接管页面、不捆绑第二份运行时、不注册共享 `/api` 拦截器，因此不会破坏 DSH 官方的启动、API Gateway、认证与连接生命周期。


## 目录

- [能做什么](#能做什么)
- [快速开始](#快速开始)
- [打包与安装](#打包与安装)
- [数据存储](#数据存储)
- [能力边界与限制](#能力边界与限制)
- [开发检查](#开发检查)
- [文档](#文档)

## 能做什么

- **划线与引用**：选中会话正文即可保存为划线，附带准确原文、上下文与文本锚点；不伪造官方 messageId。
- **笔记与改写**：在划线上补充正文，或基于原文改写、空白新建手工笔记；原始引用只读，正文独立编辑。
- **标签组织**：创建、重命名、合并、删除标签，支持 AND/OR 与「无标签」组合筛选；内置 TODO、重要、待验证快捷标签。
- **搜索与查询**：按正文、引用、标题、来源、标签检索；按当前会话 / 当前工作区 / 全部来源筛选。
- **持久高亮**：在当前会话已挂载的消息上重绘高亮，点击命中可打开详情。
- **回收站**：普通删除进回收站可恢复，永久删除需单独确认；删除标签只解除关联，不删笔记。
- **导出与备份**：勾选笔记导出为单个 UTF-8 Markdown 文件，或导出完整 JSON 备份；下载文件名带本地时间后缀。

界面按明暗主题适配，右栏头部显示当前版本。左侧「AI 笔记」菜单是打开右栏笔记库的唯一外部入口。

## 快速开始

### 环境要求

- Node.js `>= 22`（开发基线见[仓库 .nvmrc](https://github.com/timestatic/dsh-session-notebook/blob/main/.nvmrc)；该文件不随 npm 包分发）。
- 已安装并登录的 **DeepSeek Harness Desktop 或独立 Web Host**（目标版本 `0.2.0-rc.2`）。安装与启用需使用目标 Profile 对应的官方管理入口。

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

插件通过 DSH 官方 `plugin_manager` 安装，**不手工修改 Profile**。完整步骤见[打包与安装](#打包与安装)与 [开发约束](https://github.com/timestatic/dsh-session-notebook/blob/main/AGENTS.md) §9。安装、启用、重启均需你单独授权。

### 开始使用

安装并启用、按需重启 Desktop 后：

1. 点击左侧「AI 笔记」菜单，打开右侧笔记库。
2. 在会话中选中一段文字，用浮层保存为划线，或补充正文 / 改写为笔记。
3. 在右栏用标签、搜索与来源筛选整理笔记；勾选后可导出 Markdown 或 JSON 备份。

## 打包与安装

> 本节是简要说明。权威流程与硬性约束以[开发约束](https://github.com/timestatic/dsh-session-notebook/blob/main/AGENTS.md) §9 为准。

### 1. 打包

插件直接发布 JS 源码，无编译步骤；Client 由 `scripts/build-client.mjs` 从模板内联生成。

```bash
npm run check                 # 生成/校验 Client + 语法检查
npm test                      # 单元测试
npm run pack:check            # npm pack --dry-run，核对 tarball 清单
npm pack --ignore-scripts     # 生成 timestatic-dsh-session-notebook-<version>.tgz
git diff --check
```

打包前确认版本号已在 **四处同步**：`package.json`、`src/client/index.template.js` 的 `version` 常量、生成后的 `src/client/index.js`、以及本 README。入包内容由 `package.json` 的 `files` 白名单决定，只含 Host/Client 源码、`locale/*.json`、`icon.svg`、`cordis.patch.yml` 与 README；测试、`docs/`、SDK 参考与测试产物不入包。

发布到 registry 属开发阶段流程，其命令与命名硬性约束见[开发约束](https://github.com/timestatic/dsh-session-notebook/blob/main/AGENTS.md) §9.3。

### 2. 安装 / 启用 / 卸载

普通终端的 `dsh plugin` CLI 只能管理非 Desktop Profile。发布到 registry 后，Web Profile 可按「包名@版本」安装：

```bash
dsh plugin --profile web add @timestatic/dsh-session-notebook@0.1.0
```

Profile 名可用 `ls ~/.dsh/profiles/` 查看（`$DSH_HOME` 未设置时为 `~/.dsh`）。

**尚未发布到 npm 时**，Web Profile 可安装本地包：

```bash
dsh plugin --profile web add /绝对路径/timestatic-dsh-session-notebook-0.1.0.tgz
```

Desktop Profile **由 Electron 应用独占管理**；普通终端执行 `dsh plugin --profile desktop ...` 会直接报错。请使用 Desktop 的插件管理页面，或在支持 `plugin_manager` 工具的 Desktop 会话中执行管理操作。不要手工编辑 Profile 文件或在 Profile 中运行包管理器。

`dsh plugin add` 的 spec 支持 registry 名、绝对路径、git 地址与 tarball；裸 `timestatic/dsh-session-notebook` 不是合法 registry 名会被拒。管理器可检查**已声明的 DSH peer 约束**；本包当前未声明 `peerDependencies`，因此安装前无法据此自动判定目标 DSH 版本兼容，须按下文在目标宿主实机验收，不把安装成功当作兼容性通过。

也可经官方 `plugin_manager` 工具安装，且每步先取得授权：

| 步骤 | 工具调用 | 关注返回 |
|---|---|---|
| 查看现状 | `list_bundles` | 当前 Profile 已装版本、`enabled` |
| 卸载旧包 | `remove_bundle`（包名 `@timestatic/dsh-session-notebook`） | `exitCode`、`changed`、`application`、`warnings` |
| 安装 | `install_bundle`（本地 `.tgz`、registry 名或 git/tarball spec） | `exitCode`、`changed`、`application`、`warnings` |
| 启用 / 禁用 | `set_bundle enabled=true/false` | `changed`、`application`、`warnings` |
| 复核 | `list_bundles` | 版本、`installed`、`enabled` |

- `application=restart-required` 时，替换已加载包通常需**完整退出 Desktop 再重开**；不得凭源码变化声称运行时已更新。
- **禁止**：手工编辑 Profile 的 `package.json`/`cordis.patch.yml`、在 Profile 内跑 pnpm/npm、删除插件数据、启动第二套宿主、用假端点或手改 bundles 绕过管理器。
- 旧 Web（如 3080，DSH `0.1.5-rc.1`）可能未挂载管理 Remote，此时不要改用手工 Profile 或旧 CLI 转发安装。

### 3. 安装后验收

安装成功（`exitCode 0` / Slot 注册成功）**不等于**功能通过。宣称「已安装可用」前需取得真实运行时证据：Desktop 启动正常、`POST /api/settings/describe` 返回 200、笔记库显示预期版本、health/list 经独立 RPC 通道返回正确结构、禁用后官方 Gateway 仍工作、未认证访问仍被拒绝。

## 数据存储

- 结构：`notes.json` 元数据 + 同目录 `data/<uuid>.json` 笔记文件。
- 默认位置：`$DSH_HOME/storages/dsh-session-notebook/`；未设置 `DSH_HOME` 时用 `~/.dsh/`。
- 插件配置 `storageFile` 可指定规范绝对路径；不读取其他插件数据。
- **多进程可打开同一库**：Web 与桌面端可同时读写。进程只在加载快照、刷新、提交清单和回收文件期间短暂取得目录锁；冲突的请求等待锁释放，最多等待 5 秒。每个存储目录有 `.dsh-session-notebook.owner`，确保一个 `data/` 目录只属于一个清单文件。
- 元数据是唯一提交点：变更笔记先写入 `data/.pending-<pid>-<uuid>/`，再在锁内重读清单并校验 `epoch` / `revision`，通过后才将 UUID 文件提升到 `data/` 并原子替换元数据。过期快照返回版本冲突，不覆盖其他进程的提交。成功后回收不再引用的 UUID 文件；冲突会清理本次暂存文件。下次打开时只清理可确认进程已退出的暂存目录。损坏或缺失已引用 data 时停写，不把故障库当空库。
- 读取接口会在短时锁内刷新当前快照。非正常退出若发生在磁盘操作期间，锁标记可能残留；插件不会自动删除无法确认所有者状态的标记，需先核实所有进程已停止，再按恢复流程处理。
- 预算：有效元数据与引用 data 总计 50 MiB；收据最多 100000 条、最多 16 MiB，超限拒绝新修改。

## 能力边界与限制

当前允许同一台机器上的 Web 与 Desktop Host 同时打开同一个本地笔记库。每个进程分别维护内存快照；提交时通过短时目录锁串行更新清单，并用 `epoch` / `revision` 检测过期写入。若两个进程同时修改，后提交的一方可能收到版本冲突，需要刷新后重新执行操作；插件不会自动合并两边的编辑。

以下能力**尚未提供**，界面与交付说明中会显式标注：

- 不支持跨设备、多机共享目录或网络文件系统上的一致性保证；锁机制面向同一台机器的本地文件系统。
- 不同 `storageFile` 不得指向同一个 `data/` 目录；存储目录中的 `.dsh-session-notebook.owner` 用于检测并拒绝这种配置。
- 锁文件若因进程异常退出而残留，插件不会自动删除状态不确定的锁；确认所有相关 Host 已退出后再按恢复流程处理。
- 不支持损坏库的应用内受控恢复与自动故障接管；JSON 备份导出不等于保护原始损坏介质。
- 不支持自动 Schema 迁移；不宣称支持无限库容量（业务仍在内存中组装完整 Snapshot）。
- 应用内 JSON 恢复尚未开放。
- Web 端已由用户确认完成验收；本仓库没有对应 `0.1.0` 包的逐项现场验收记录，不能将此前结果当作该版本在每个 Web Profile 的运行证明。

当前范围与后续能力（受控恢复、迁移、跨 Host 排他及版本化 Web 回归等）见[现行设计](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/DESIGN.md#8-验收与后续事项)；不可将后续目标表述为本版已交付。

## 开发检查

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

## 文档

以下为仓库文档，`docs/` 与 `AGENTS.md` 不进入 npm 包；在解包目录阅读时请访问仓库链接：

- [当前产品与技术设计](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/DESIGN.md) · [文档总导航](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/README.md)
- [开发者索引](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/developer/llms.txt) · [架构速览](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/developer/architecture.md)
- [交互原型](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/UI_PROTOTYPE.html)（历史草图） · [兼容事故与测试摘要](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/evidence/compatibility-and-tests.md)
- [证据索引](https://github.com/timestatic/dsh-session-notebook/blob/main/docs/evidence/README.md) · [开发与发布约束](https://github.com/timestatic/dsh-session-notebook/blob/main/AGENTS.md)
