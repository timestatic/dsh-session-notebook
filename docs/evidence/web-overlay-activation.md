# 原 3080 覆盖启动后的真实检查

用户明确确认已按启动指南完成，并要求继续。Goal 恢复为 active。

通过脱敏进程参数读取，确认当前 3080 Web PID 33625，profile=web，--patch 指向工作区 web-compat-test.patch.yml。用户已执行启动步骤，不再将“等待用户重启”当作当前阻塞。

前台 Playwright 能返回部分 DOM 检查：origin=3080，未发现 Notebook 按钮或版本标识。两条独立 POST 探测 dsh-session-notebook/health 与 settings/describe 都在 8 秒 AbortSignal 超时后报告 AbortError。这是浏览器探测结果，不证明 Host handler 卡死或插件激活失败。

终端 curl 不带凭据 GET Notebook health 立即返回 401，表明该 HTTP 入口有宿主认证响应，但不能凭 401 证明 Notebook 路由已经注册（宿主可能先鉴权再判路由）。未复制浏览器 cookie 或 token。

尝试前台 reload 命令未返回，停止挂起工具调用，不关闭浏览器或服务。后续仅 DOM eval 也未在默认工具期限内返回，自动化扩展连接存在不稳定迹象，需与真实页面可用性分开判断。

下一步由用户使用新进程打印的正式入口正常登录并确认页面可用；之后重建扩展连接（仅 detach/attach，不终止用户 Chrome），核对 Notebook 插件区域及 Gateway 状态。不能要求用户再次完成已经确认的启动步骤，也不能声称共享 /api 再次冲突而无 Host 证据。

没有改 Profile、升级运行时、修改生产代码或执行产品保存。Step 1/2 的实机与持久安装门禁仍未关闭。

## Round 20–22 的对照结果

用户重新授权 Chrome 扩展后，detach/attach 成功且纯 DOM 查询正常，实际页面仍没有 Notebook 入口。两条 POST 在 3 秒预算内均超时；正常导航等待 domcontentloaded 也在 8 秒超时。不能把问题全部归为扩展失联；也不能凭历史控制台断线日志断言当前 Host 根因。

随后对根页面和 Notebook health 无凭据 curl，二者立即 401；Playwright page.request 的独立请求上下文探测未返回，已取消。无凭据 401 与有登录态链路无法完成是目前确定的差异。

当前需要原服务启动终端中的相关错误/FAILED fiber 行或“无错误”确认，以及用户实际页面是否可用。不收集完整日志、环境变量、token、cookie 或会话历史；没有可读日志路径，不擅自抓取终端正文。Round 22 不重复同样的网络探测，也不改通信协议来掩盖证据缺口。

## 最新 Round 24

用户反馈终端无错误、3080 页面正常且有 AI 笔记。自动化确认按钮存在。调查普通点击超时：按钮矩形和命中目标正常，但 document.hidden=true。page.bringToFront 后 hidden=false，普通 locator.click 成功，浮层显示 v0.0.12 与连接检查状态。之前隐藏页的点击超时不能归因于插件交互缺陷。

保持前台时官方 settings/describe POST 仍在 5 秒超时，实际 Notebook Client RPC 显示固定 TIMEOUT 诊断。入口/浮层可见与点击已取得真实证据，当时连接仍未通过。按 Escape 关闭浮层，未改主题、Profile、协议或服务。

## Round 25：单标签页对照成功

Chrome 对 3080 有 9 条已建立 TCP 连接。CDP network 诊断被扩展以 Not allowed 拒绝，未绕过。用户手动关闭其他 3080 页面、仅留当前页后，同一个 settings/describe POST 返回 200；正常点击 Notebook 后 v0.0.12 显示“Host 已连接；存储尚未就绪。”，证明生产 Client 的 health/list 校验成功。Esc 后 dialog=0、焦点返回“打开 AI 笔记”。

该对照支持多页面连接占用/排队相关解释，但没有网络 timing 证据，不能断言精确根因或宣称修复了宿主连接池。无需改 Notebook carrier 或增加超时来掩盖。持久安装、主题、禁用/重启后的Gateway证据仍待补齐。
