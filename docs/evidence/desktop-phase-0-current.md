# Desktop Phase 0 当前验收（更新至 2026-10-04）

## 范围

用户已决定暂缓独立Web，优先Desktop；本轮没有操作3080、升级、安装替换包或重启Desktop。用户确认在真正Desktop窗口检查，不是Chrome。未获得Electron自动化控制，不将手动反馈说成自动HTTP实测。

## 正式安装与原状态

官方plugin_manager list_bundles返回 dsh-session-notebook@0.0.12：installed=true、enabled=true，row session-notebook / include:session-notebook。宿主官方base/web-app版本0.2.0-rc.2。本轮以此确认正式安装与原启用状态，不从工作区版本推断磁盘包。

## 当前手动功能与两轮生命周期

用户首次确认Desktop显示v0.0.12、“Host已连接；存储尚未就绪。”、设置和关闭重开均正常，并明确授权暂时禁用/启用两轮，恢复原状态，不删数据、不重启、不改其他插件。

| 操作 | 官方结果 | 当次Desktop手动反馈 |
|---|---|---|
| 第1轮禁用 | changed=true, application=applied, warnings=[] | 入口/浮层消失，设置正常 |
| 第1轮启用 | changed=true, application=applied, warnings=[] | 入口无重复，版本/连接/设置正常 |
| 第2轮禁用 | changed=true, application=applied, warnings=[] | 入口/浮层消失，设置正常 |
| 第2轮启用 | changed=true, application=applied, warnings=[] | 入口无重复，版本/连接/关闭重开/设置全部正常 |

最终enabled=true，与原状态相同。全部操作针对准确Bundle dsh-session-notebook，没有卸载包、修改其他插件或直接编辑Profile。

## Round 12：桌面主题、布局与上下文手动复验

用户在真正Desktop窗口按清单检查并确认“全部通过并已恢复”：深浅主题可读；缩窄窗口关闭按钮可见、无横向溢出；Tab导航、浮层内Esc；切换现有会话后对应session/workspace上下文正确、不残留旧上下文。记录为本轮用户手动PASS；没有Agent截图、像素测量或选区捕获（尚未实现）证据。主题和窗口由用户恢复。

官方Gateway网络状态：用户选择“无法打开开发者工具或找不到该请求”。因此没有取得本轮Desktop的POST settings/describe两次HTTP200；不得将设置正常推断为状态200，也不要求用户粘贴凭据或构造认证curl。不重复启停或借用3080证据。

本轮只读重查storageDomain精确合同：open调用者负责close，同facility禁止重复name；global.get/set仍无CAS或跨Host锁保证。未打开任何Domain、未运行写入或故障实验；Step3仅契约准备，不把接口存在记为可靠性通过。

## Round23：直接Desktop Network证据（2026-10-04）

读取真实安装main实现发现：主窗口devTools=true；隐藏toggleDevTools注册F12。用户随后确认在真正Desktop窗口可打开Network。此前“无法打开DevTools”限制已解除，禁止继续增加临时观察器或读取凭据。另发现reload菜单仅development显示，不能将它视为所有安装版本可见。

用户按清单保存草稿、清空Network并重新加载Desktop页面，第一次明确反馈“POST settings/describe为200，页面正常”；间隔后再次清空/重新加载，反馈“新的POST为200，Notebook版本/连接正常”。这是用户在Desktop DevTools直接观察的新HTTP请求状态，记录为手动网络PASS；不是Agent抓包，不含响应正文/rpcId截图，不延伸到禁用期间HTTP200。临时观察器此前已移除，本轮不再安装或修改Profile，未重启Host。

当前分时两次HTTP200缺口已补齐。仍需在Notebook禁用时一次官方Gateway直接状态检查（已有禁用时设置业务正常，但当时无HTTP状态），须先取得一次额外启停授权并最终恢复enabled=true。随后核对指南所有Desktop必需行，不能仅凭本条直接宣布所有门禁关闭。

## 结论边界与剩余门禁

已取得正式安装、当前Desktop用户可见入口、生产组件连接状态和两轮启停可见性证据。连接文字由生产Client health/list结构校验后显示，用户反馈可作为手动业务结果；未直接抓取Desktop carrier网络响应。

Round23 已补齐启用状态下分时两次 Gateway HTTP 200 的手动网络证据；Round12 已补齐主题、尺寸、键盘和上下文的手动证据。旧段落描述的是当时结果，不再作为当前缺口。

仍缺禁用期间 Gateway 的直接 HTTP 状态，以及实际路由释放和监听器清理的运行时证据。此前无凭据 401 仅证明当时认证拒绝；SDK 模拟测试不能替代当前真实宿主。完整状态与下一次验收步骤见[Desktop 门禁矩阵](<./desktop-step-0-2-gate.md>)。Step 3 专用存储实验等待剩余门禁关闭，当前允许只读契约和实验计划准备。
