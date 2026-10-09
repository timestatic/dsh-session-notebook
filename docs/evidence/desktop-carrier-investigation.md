# Desktop carrier 只读调查（2026-10-03）

## 当前证据与未读取内容

用户选择先核实carrier，不开发诊断组件。本轮没有读取页面token/cookie/传输全局对象，没有改启动参数、重启、安装或操作3080。

尝试用Host read读取已安装Desktop app.asar的package.json，返回“Cannot mix BigInt and other types”。这是读取工具错误，不证明应用包损坏。未用shell/解包等方式绕过。公开仓库main的tree及猜测preload路径HTTP404，不能取得对应源码，也不能继续凭猜测实现下结论。unpkg客户端包根client.js404后回到已核实参考包lib/client.js读取真实路径。

## 同版参考合同实际说明

目标0.2.0-rc.2参考 [README](<../../.sdk-reference/connection/package/README.md#L28-L47>)：

- 静态Desktop transport拥有认证，streamBaseUrl只提供HTTP origin，不能用它自行认证。
- HTTP transport独立选择；shell-owned carrier可直接dispatch shared Fetch handler，logical RPC返回已解码原生值。
- connection/request只在认证后的HTTP桥接中执行；README明确Desktop也可使用此hook锁定新API工作，但不保证每一请求都会经该hook。

参考 [Client实现](<../../.sdk-reference/connection/package/lib/client.js#L1209-L1231>)证明createWebConnectionRpc在没有logical rpc override时使用选定fetch并发POST，检查HTTP response.ok、rpcId再返回result。installConnection使用transport.rpc优先于createWebConnectionRpc；所以仅从ctx.connection.rpc.call签名不能推断当前Electron窗口的物理HTTP/IPC路径。

## 结论

不能声称当前Desktop一定走IPC，也不能声称一定走HTTP。前轮诊断候选仍有覆盖不确定性；注册connection/request不等于证明settings/describe200。用户已提供真实Desktop业务/生命周期/主题交互通过，但当前网络状态指标未闭合。禁止据此改global fetch、导出token或增加共享interceptor。

## 下一步最小选择

若用户批准，开发独立临时的被动connection/request诊断（不改Notebook传输，不读取headers/body），实际触发设置操作观察是否有匹配HTTP请求。若观察不到，报告覆盖缺口，不宣称200；后续需要能读取目标Desktop对应桥接源码/正式诊断入口，或用户明确调整当前阶段指标。不能无限重复网络探测或把无源码能力记为已完成。

本轮仅资料调查，未解除Step0–2网络证据门禁，未打开Storage Domain或执行存储实验。
