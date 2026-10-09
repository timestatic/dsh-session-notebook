# Phase 0 当前轮真实复验（2026-10-03）

## 范围与证据

遵循开发指南 Step 1/2；使用既有 playwright-cli `sn-foreground` Chrome extension 会话。只查询插件区域，不读取会话正文、凭据或完整 URL。本轮未安装、禁用、重启、改 Profile 或修改生产源码，未进入 Step 3 产品存储。

- 当前附着页面 origin：`http://127.0.0.1:3080`，document.hidden=false。不是当前会话 Host 的 19387 页面，不能混用两端验收结论。
- 初始 AI 笔记全局按钮 1 个，dialog 0 个。
- 聚焦入口并按 Enter：dialog 1 个，焦点在浮层内，data-notebook-version=0.0.12。
- 浮层显示“Host 已连接；存储尚未就绪。”：实际生产 ConnectionStatus 先后调用 health/list 并校验成功结构，不是手工 GET 成功替代 RPC。
- 关闭按钮与重新打开后仍只有 1 个入口/1 个浮层，最终关闭后 dialog=0。
- 显式聚焦浮层关闭按钮后按 Escape，等待 dialog hidden：关闭成功，焦点恢复至全局入口。
- 当前 Web 页内使用标准 RPC 信封只读探测 `POST /api/settings/describe`，两次 status 均为 200；不输出响应设置数据。不构成分时长期稳定或禁用后的 Gateway 验收。
- 当前会话 Inspect（另一个 Host）中 Notebook Config entry 为 include:session-notebook/status=absent；shell.overlay 的 Notebook occupant active=true。这只是发现证据，不代替 Web 或 Desktop 窗口业务验收。

## 非模态键盘边界

第一次组合检查在 Tab 移出浮层后按 Escape，dialog 仍存在、入口未恢复焦点。源码及现有 overlay-focus 单测明确设计为非模态浮层：keydown 只监听浮层，Tab 不拦截。因此不能将 `tabInside=false` 判为缺陷，也不能宣称“页面任意焦点下 Esc 都可关闭”。随后显式聚焦关闭按钮独立复验 Esc，通过。没有为测试通过添加全局键盘拦截或 modal focus trap。

## 门禁仍未关闭

| 门禁 | 当前状态 |
|---|---|
| Web 全局入口/Enter/关闭/重开/浮层内 Esc | 本轮真实通过 |
| Web 生产 health/list RPC | 本轮真实通过（空库、未存储） |
| Web 官方 Gateway | 本轮两次 POST 200；禁用/分时复验仍缺 |
| Web 正式持久 Bundle 安装 | 既有覆盖启动不等于 install_bundle；待解决旧 Web 官方管理路径 |
| Web 深浅主题/尺寸 | 既有截图另存；本轮未重测 |
| Desktop 当前 welcome/Gateway/RPC/主题/键盘 | 历史用户反馈不等于本轮独立复验，待补 |
| 双端卸载/禁用/重启生命周期与认证 | 未执行，涉及状态变更必须授权 |
| Step 3 存储 ADR/实验 | 尚未开始，仅调查准备 |

后续优先解决正式持久安装与双端剩余验收；不得将上述部分通过写为 Phase 0 完成，不得用新的 Web 服务器替代原页面。旧 Web 的管理能力限制不能通过手工改 Profile 绕过。

## Round 2：可重复自动化验收

新增 [浏览器验收脚本](<../../tests/e2e/phase-0-browser-check.js>)，通过既有 `sn-foreground` 的 `run-code --filename` 执行。脚本先拒绝已有浮层、后台标签页或不唯一入口，测试打开生产组件而非模拟 RPC，finally 尝试关闭本次打开的浮层；只输出 origin、版本、布尔检查与 Gateway HTTP status。非模态 Tab 边界不被改为强制 focus trap。初次运行发现 CLI sandbox 没有 URL 全局对象，安全失败且未操作页面；改为 page.evaluate 读取 location.origin 后通过。

实际 3080 输出：14 项布尔检查全部 true，Gateway statuses=[200,200]。覆盖：初始关闭、唯一入口、前台、Gateway 第一次读取、生产 RPC、唯一浮层、版本、初始焦点、Esc 关闭、焦点恢复、重开连接、关闭按钮、无重复入口、Gateway 第二次读取。最终浮层关闭。

`npm run check` 已包含验收脚本语法检查；脚本使用 playwright-cli 注入 page，不作为 node:test 或生产发布文件。README 已纠正旧禁用/未重启状态并补操作入口。再次执行 check、23/23 单测、pack:check 和 diff --check 均通过，链退出码 0。未修改生产业务代码或提高包版本，未解决旧 Web 官方持久安装能力限制。

## Round 3：真实失败分支与未认证访问

新增 [非法请求脚本](<../../tests/e2e/phase-0-negative-check.js>)，实际 3080 已登录页面 7/7 通过：非法 query → 400；非空 payload、错误 method、额外信封字段 → HTTP 200 且 result.ok=false / VALIDATION_FAILED / rpcId 匹配；畸形 JSON → 400；错误 Content-Type → 415；未知 Notebook GET → 404。脚本只打印固定用例名、status 和 pass，不记录异常响应原文。浏览器出现失败 HTTP 资源 console 计数，这是负例请求的预期现象，不据此声称组件崩溃。

使用无 cookie/token 的 Node fetch 只读访问两个当前 origin 的 health/list GET/POST，共 8 次全部 401。该结果证明这些当前 HTTP 访问未绕过认证，不证明所有 trust/carrier 边界或未认证请求一定已到达 Notebook handler，也不等于 Desktop 登录后 RPC 验收。

负例后重跑真实正常脚本，14 项仍全部 true、Gateway statuses=[200,200]，最终浮层关闭。统一语法检查含两个浏览器脚本；23/23 单测、pack:check、diff --check 全部通过，检查链退出码 0。未修改生产 Host/Client、未安装/启用/重启。

旧 Web 无官方 plugin_manager 且用户选择不升级、禁止手工 Profile 安装的限制已连续三轮存在。继续重复 Web 正常检查不能关闭正式持久安装门禁；下一步需要用户明确选择官方部署路径或保持当前限制，以及授权接入 Desktop 验收窗口。没有以技术困难代替可复现限制，也没有宣称整项目完成。

## Round 4：用户指定正式 Web 3080，撤销 Desktop 入口切换要求

用户明确纠正当前验收对象为 `http://127.0.0.1:3080/` 独立 Web，不是 Desktop 正式浏览器入口。保留该正式页面继续验收，不再要求 19387 或误报页面选择错误。最终双端发布要求没有被删减；正式 Web 页面地址与 Notebook 持久安装证明分别判断。

两份浏览器脚本新增固定目标 origin 守卫（仅测试配置，生产代码没有硬编码 Host origin）。新增 [守卫单测](<../../tests/unit/browser-origin-guard.test.js>)，分别在 19387 与非目标域模拟输入，证明请求和 UI 方法均未调用。实际当前 sn-desktop-web 会话虽然名称含 desktop，origin 为用户指定 3080：正常检查 15/15、非法请求 7/7 全通过，Gateway 两次 200，浮层最终关闭。名称不作为平台判断依据。

统一语法检查、25/25 单测、pack:check、diff --check 全通过，检查链退出码 0。未改 Profile/安装/重启，用户此次仅纠正验收平台，没有授权改变部署机制。下一步围绕指定 Web 补主题、尺寸与生命周期门禁，不能将地址澄清当作持久安装通过。

## Round 5：当前视口与实际样式布局验收

正常浏览器脚本增加实际浮层布局检查。指定 Web 3080 前台视口 1512×736：浮层 bounds left=1176、top=460.703125、right=1496、bottom=656；完全位于视口内、无横向溢出、关闭按钮完整可见。实际解析背景 rgb(233,236,242)、前景 rgb(15,17,21)，背景非透明且前景不同。脚本现在 20 项全部 true，生产 RPC 正常，Gateway 两次 200，最终浮层关闭。

这些数值只证明本轮当前视口/样式，不等于深浅两主题、不同尺寸或 WCAG 对比度验收。未改变主题、窗口、Profile；统一门禁通过，单测 25/25，检查链退出码 0。后续需要用户授权临时切换实际主题及视口并恢复；不使用手改 CSS 或 localStorage 模拟宿主主题。正式持久安装及禁用/启用生命周期门禁仍未关闭。

## Round 5 后续授权：实际宿主主题切换与恢复

用户明确允许临时测试深浅主题和视口并恢复。通过设置 dialog 的真实主题按钮操作，读取 aria-pressed 确认原设置为“跟随系统”。分别点击浅色/深色：Notebook 当前视口均在边界内且无横向溢出；浅色背景 rgb(233,236,242)、前景 rgb(15,17,21)，深色背景 rgb(97,102,107)、前景 rgb(249,250,251)。finally 点击“跟随系统”并确认 aria-pressed=true，关闭设置；最终 Notebook 也关闭，dialog=0，视口仍为1512×736。未直接改 CSS/localStorage。

最初使用不限定名称的 getByRole('dialog') 发现同时存在设置和 Notebook 浮层而失败；改为按“设置”/“AI 笔记”精确名称定位。没有点击任意第一个 dialog。该检查仅证明实际主题解析和布局，不包含视觉截图判断或 WCAG 对比度结论。

附着 Chrome page.viewportSize() 返回 null，当前没有可直接恢复的自动化视口配置。本轮未调整窗口，也没有通过 CDP/设备模拟绕过，窄尺寸仍待独立验证。用户本次授权不包括插件启用/禁用或 Host 重启，生命周期与持久安装门禁仍未关闭。

## Round 6：标准视口接口真实可用与窄尺寸通过

前轮 page.viewportSize()=null 只意味着没有显式 viewport 配置，不能推出 setViewportSize 不支持。本轮在既有用户临时尺寸测试授权内尝试标准接口成功，没有 CDP、CSS 或凭据操作。

新增 [多视口脚本](<../../tests/e2e/phase-0-viewport-check.js>)：实际 3080 的 480×640、800×600 下生产 RPC 均成功，浮层完整在视口内、无横向溢出、关闭按钮可见；finally 关闭测试浮层并恢复尺寸。结果 restored=1512×736、dialogCount=0。恢复验证是尺寸恢复，不宣称恢复了原先 viewportSize=null 的自动跟随窗口语义（当前接口只支持配置尺寸）；没有更改用户物理窗口。

新增错误 origin 守卫测试，统一语法/26 项单测/pack:check/diff --check 全部通过，链退出码0。正式持久安装与启用/禁用生命周期仍需解决：旧 Web 无 plugin_manager，当前会话管理工具属于另一个 Host，不能跨 Host 替代操作。用户最新明确先验收 Web 3080，不转向19387。没有用覆盖启动与这些验收成功改写指南门禁，也没有开始 Step 3 产品存储。

## 本轮仓库检查

- `npm run check`：通过。
- `npm test`：23/23 通过。
- `npm --cache /tmp/dsh-session-notebook-npm-cache run pack:check`：通过；8 个发布文件包含 Host/Client、patch、locale 与图标。
- `git diff --check`：通过。

检查链退出码 0。检查范围是当前完整工作区，保留原有 staged/unstaged/untracked 修改。没有升级包版本或将模拟测试当作 Desktop 实机验收。
