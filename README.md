# dsh-session-notebook

DSH AI 会话笔记本：面向 DeepSeek Harness 会话的本地笔记插件，支持划线、引用、Markdown 笔记、标签、搜索、来源回链与导出。

## 当前状态

当前工作区版本 `0.0.36` 接入了正式 Host 的专属文件存储与笔记业务路由，并增加会话正文选区保存和文本锚点高亮。存储结构为 `notes.json` 元数据加同目录 `data/<uuid>.json` 笔记文件；默认位置为 `$DSH_HOME/storages/dsh-session-notebook/`，未设置 DSH_HOME 时使用 `~/.dsh/`。插件配置 `storageFile` 可指定规范绝对路径，不读取其他插件数据。

只支持单一进程独占一个库。0.0.26 增加固定路径独占 sentinel，另一进程尝试打开同库时立即 `STORE_OWNED`，Host 保持存储未就绪且不开放写路由；非正常退出的残留 sentinel 不自动清理，需要离线核实后人工恢复。此协作机制不代替恶意同用户进程或跨机器存储的一致性锁。有效元数据与引用 data 总预算为 50 MiB；保存还保留字段与请求限额。元数据是唯一提交点：先同步变更 data，再替换元数据，成功后发布内存状态并回收旧 data。损坏或缺失已引用 data 时停写，不把故障库当空库；未知提交停写并保留草稿。收据最多100000条、最多16 MiB，超过时拒绝新修改。没有应用内坏库替换恢复；JSON 备份导出仍可用。分文件降低写入量，现有业务仍在内存中组装完整 Snapshot，不宣称已支持无限库容量。

划线首版使用当前会话、准确原文和上下文，不保存虚构的官方 messageId。两个选区端点必须在目标版本同一正文内；多处文字匹配不自动选第一处。Client 继续走宿主 RPC carrier，Host 使用精确 Fetch 路由与公开 admission，不注册共享 `/api` interceptor。

本轮验证包括源码、隔离介质、本地浏览器合成场景和打包。没有安装、启停或重启 Desktop；新功能仍需用户对新包做真实保存、重启读回、选区与重新挂载验收。旧加载/连接/主题/键盘和 Gateway 结果保留在[Desktop门禁矩阵](<docs/evidence/desktop-step-0-2-gate.md>)，只对新包做必要回归，不重复作为主要交付目标。最新方案见[轻量文件存储与划线接入](<docs/evidence/lightweight-notebook-0.0.16.md>)。

0.0.18 按用户反馈收敛界面：左侧 AI 笔记菜单统一打开原生右边栏，移除下方重复入口；选区默认只显示划线、标签和记笔记按钮，展开后选择或创建标签；卡片不再显示转换类型，日常界面不再显示尚未完成恢复的 JSON 备份预览。保留笔记编辑、Markdown 操作和 JSON 备份导出。验证记录见[界面收敛与标签保存](docs/evidence/notebook-ui-0.0.18.md)。

0.0.19 优化侧栏布局、常用与高级筛选、卡片摘要与标签、时间和来源展示、手工编辑区、弹窗及明暗主题。验证覆盖 1400px 窗口中的 380px 右栏，详情、编辑和输入确认不受侧栏裁剪。见[界面优化记录](docs/evidence/notebook-ui-0.0.19.md)。

0.0.20 增加标签按钮即时筛选，选择标签会清除互斥的无标签条件；摘录保存后刷新已打开库和标签目录。侧栏菜单去白色框并增加图标，右栏头部显示版本。源码及本地测试通过。2026-10-07 经用户批准，标签保存→刷新→即时筛选、菜单及通用 UI/窄栏/主题浏览器场景通过。用户确认此前运行0.0.18。现有回收站逻辑保留，未改变删除语义。

0.0.21 统一右栏为一个笔记库，默认显示所有笔记；左侧菜单是打开右栏的唯一外部入口。右栏内部提供笔记、回收站、标签、备份导航和新建笔记。去掉第二套手工笔记列表与打开/关闭笔记库按钮。次要卡片操作收进“更多”，选择后才显示批量操作。普通删除移入回收站；永久删除只在回收站中经确认后执行。标签筛选不会提交未应用的搜索草稿；时间采用本地日期时间控件，传输仍为带时区的 ISO 时间。

选区批注正文不会因快捷标签或划线保存被丢弃；取消已有正文需要确认。为划线补充正文使用同一笔记的编辑事务，保留 ID、引用、锚点和来源。标签管理提供逐行重命名、合并、删除操作；删除标签只移除关联，不删除笔记。确认弹窗内可按原请求核对丢失回包，关闭弹窗保留待确认操作。冲突按钮改为“使用最新版本继续编辑”，不会声称已保存。详见[统一笔记库与操作回归](docs/evidence/notebook-ui-0.0.21.md)。

## 当前可执行检查

使用 Node.js 22 及以上版本。运行 `npm ci --prefix tests/runtime` 准备隔离运行时依赖。
部分单测直接验证目标 SDK 源码，需要本地 `.sdk-reference/`：`cordis/package` 对应
`@deepseek-ai/cordis@4.0.4`，`connection/package` 对应
`@deepseek-ai/dsh-client-connection@0.2.0-rc.2`，`storage-json/package` 和
`storage-domain/package` 分别对应同版本的 `@deepseek-ai/dsh-storage-json` 和
`@deepseek-ai/dsh-storage-domain`。这些目录使用官方 npm 包解压内容，保留 `package/lib/index.js`。
SDK 参考、运行时依赖和测试产物均不提交，也不进入插件包。

```bash
npm run check
npm test
npm run test:integration
npm run test:runtime
npm run pack:check
```

包直接发布 JS 源码，Client 由构建脚本内联生成。本地单元测试覆盖发布入口、生命周期、侧栏、选区、锚点和文件存储故障边界。集成测试使用正式 Host 验证保存与重开，运行时测试使用真实 Cordis Context 验证加载和卸载。这些结果不替代真实 Desktop 网络、浏览器绘制和全流程验收。

### 可重复的真实页面验收

使用已经授权且登录的 Playwright 会话运行 [Phase 0 浏览器检查](<tests/e2e/phase-0-browser-check.js>)：

```bash
playwright-cli -s=sn-foreground run-code --filename=tests/e2e/phase-0-browser-check.js
```

脚本检查全局入口、版本、生产 health/list RPC、键盘打开、浮层内 Esc/焦点恢复、关闭重开与官方 Gateway 两次 POST 200；成功或失败均尝试关闭本次打开的浮层。若页面已有 Notebook 浮层、入口不唯一或标签页在后台，先安全失败，不关闭原有浮层。不会创建浏览器、获取凭据、写笔记或修改安装状态。本轮在 3080 实际 Web 页面通过；不能代替 Desktop 窗口验收或正式持久安装。完整记录见 [当前验收证据](<docs/evidence/phase-0-current-verification.md>)。

另有 [非法请求验收脚本](<tests/e2e/phase-0-negative-check.js>)，在同一个授权会话运行：

```bash
playwright-cli -s=sn-foreground run-code --filename=tests/e2e/phase-0-negative-check.js
```

验证非法 query/payload/method/信封字段、畸形 JSON、错误 Content-Type 与未知端点；HTTP 200 的 RPC 错误也必须校验匹配 rpcId 与 VALIDATION_FAILED，不能误认成功。脚本的浏览器 fetch 仅是只读测试探测，不是生产 Client carrier。

[多视口检查](<tests/e2e/phase-0-viewport-check.js>) 需先取得临时改变视口的授权，检查 480×640、800×600 并在 finally 恢复原尺寸；运行 `playwright-cli -s=sn-desktop-web run-code --filename=tests/e2e/phase-0-viewport-check.js`。会话名称不代表平台，三个脚本都会验证实际 origin 为用户指定的 3080。

旧 Web 缺少官方插件管理工具且用户选择不升级，目前采用启动覆盖测试；仍不满足指南 Step 1/2 的正式持久 Bundle 门禁，不得因此提前开放存储写入。

## 文档

- [第一版可靠 MVP：收敛开发计划（当前执行主线）](<docs/FIRST_MVP_PLAN.md>)
- [产品功能文档](<docs/PRODUCT_REQUIREMENTS.md>)
- [技术设计与逐步开发验证指南](<docs/DEVELOPMENT_GUIDE.md>)
- [交互原型](<docs/UI_PROTOTYPE.html>)
- [开发上下文索引](<docs/developer/llms.txt>)

0.0.22 为全部 Markdown 下载和 JSON 备份文件增加本地时间后缀 `YYYYMMDDHHmmss`。编辑笔记的标签使用复选框，可直接多选，最多 10 个。JSON 保留完整数据；Markdown 用于阅读和分享。应用内 JSON 恢复尚未开放。

0.0.23 修复空临时选区重新选择时浮窗位置与引用不更新的问题。已有批注、标签编辑与待确认保存请求继续绑定原选区。

此前 `0.0.25` 工作区还包含侧栏布局、筛选、卡片操作和编辑标签的调整，以及仅选择标签时关闭未保存草稿的确认保护。`npm run check` 会校验生成的 Client 与模板一致。本地测试与打包检查只验证工作区文件；本次版本仍待真实 Desktop 验收。

`0.0.26` 针对 DSH 0.2.0-rc.2 Web 进行源码适配与打包准备：独占库 fail-fast、来源会话 Host list 判定及相应回归。尚未通过官方 manager 安装到 Web，真实页面功能待验收。见[Web 兼容记录](<docs/evidence/web-compat-0.0.26.md>)。
