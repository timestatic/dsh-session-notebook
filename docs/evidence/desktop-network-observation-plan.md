# Desktop Phase 0 网络观察候选方案（未实施）

## 背景与已发现合同

Desktop正式安装、两轮启停、用户手动主题/尺寸/键盘/会话切换已有证据，实际settings/describe HTTP状态尚缺。用户无法打开DevTools或找到请求，不能重复要求其提供不存在的网络结果。

本轮Host Inspect Service目录与connection/webServer精确合同未发现只读历史HTTP状态查询。Event目录发现`connection/request`，精确查询确认模式waterfall，参数request/response/next，接收已认证IncomingMessage。只读参考SDK [.sdk-reference connection](<../../.sdk-reference/connection/package/lib/index.js#L829-L843>)确认先connection.admit拒绝401/403，再进入waterfall，委托正式bridge。该证据来源为0.2.0-rc.2参考包+当前Inspect，不是本次业务调用。

## 候选设计（需授权，不进入生产Notebook默认功能）

独立临时诊断Bundle，通过ctx.on的正式waterfall监听，只对精确POST `/api/settings/describe`记录response finish后statusCode及单调计数/时间。始终delegate next恰好一次，不读/写headers/body，不保存URL query、token、cookie、设置响应、路径或用户会话内容；不改变响应，不吞异常。不注册任何HTTP/RPC路由、shared interceptor、fallback，不替换connection服务。注册和finish监听必须持有disposer，卸载和错误清理须自动测试。

结果只经固定摘要交付，不使用业务Inspect查询当执行接口，也不持久化完整日志。没有实际必要时不安装。实施前需要核对Cordis on/filter与disposal真实合同并测试，不仅凭类型猜事件捕获范围。

## 关键局限

此事件只位于webServer HTTP分支，不能推出Desktop IPC carrier一定产生HTTP请求。若Desktop设置操作不进入此事件，记录应为“观察不到，carrier差异/覆盖缺口”，不能伪造200、强行把Client切到global fetch、读取token、拼认证curl或启动第二服务器。外部浏览器的HTTP200仍不能替代Electron原窗口业务验收。

没有被动观察HTTP请求时，还需检查目标Desktop carrier的正式返回语义与指南HTTP指标是否适用于该请求路径。若需要调整指标，必须明确获得用户同意并同步文档，不由Agent默默免除事故验收规则。

## Round 15：最小组件与本地测试（未安装）

已获用户开发授权，新增独立 [临时Bundle](<../../diagnostics/desktop-http-observer/package.json>) 与 [实现](<../../diagnostics/desktop-http-observer/index.js>)，生产Notebook不变。使用ctx.on正式waterfall；参考Cordis实现确认on持有fiber disposer、waterfall需显式next。只匹配无query的精确POST目标；最多16个pending监听、32条完成摘要，仅记录固定日志码/计数/HTTP状态，不读header/body。finish才记录，close/异常/卸载清理；next返回值与异常身份保持，不吞carrier错误；日志失败不影响请求。

新增 [6个测试](<../../tests/unit/desktop-http-observer.test.js>)，覆盖委托恰好一次、next先结束但response迟到完成、未知请求、异常传播、两轮卸载/close和迟到响应、有界观察、日志失败。测试接缝使用Node EventEmitter及简化ctx，不代表真实Cordis事件可见性或Desktop请求覆盖。语法、32/32单测、主包与诊断包dry-run pack、diff检查均通过，exit0。诊断包仅3个文件，没有生产依赖/Client/工具/路由。

当前仅输出宿主固定摘要日志，尚未核实用户可读日志入口；不得搜全量日志/凭据来弥补。安装前还须明确摘要获取方法、实际日志logger合同与事件scope过滤；未获得安装/启用批准，不自动部署。观察不到目标依旧不能宣称200。

## Round17：用户提供日志目录的有限检查

用户给出日志目录`/Users/didi_1/Library/Logs/DeepSeek Harness/`。仅glob文件名，当前发现4份2026-10-03 crash日志：main、web-boot、两份renderer。未发现持续日志文件，不从文件名推断当前进程输出去向。仅grep固定`SETTINGS_HTTP_FINISH count=<number> status=<number>`，无匹配；诊断尚未安装，这不是失败或HTTP未发生的证据。未读取崩溃日志正文。

此目录尚不能证明ctx.logger.info会持续落盘，安装前不能假设摘要可读。下一步可核对官方常规日志exporter，或经用户批准增加仅固定摘要的独立展示（不能读取全量logger buffer或暴露凭据）。安装仍需单独批准，现有Notebook/旧Web均未变更。

## 当前状态与下一步

本轮只读调查，未编写/安装诊断Bundle、未启停/重启、未修改生产Host/Client或认证。下一步先让用户决定是否批准开发临时最小诊断组件；具体安装仍按plugin_manager逐次批准。诊断若不能证明目标网络状态，停下报告限制，不无限扩大宿主诊断改造。Step3仍仅允许只读存储合同准备。
