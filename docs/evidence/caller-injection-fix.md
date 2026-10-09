# Step 2：实机启用发现调用者注入缺失

用户明确允许测试启用，Desktop 完整退出/重启由用户手动完成。

## 实际失败与安全回退

官方 set_bundle 启用 0.0.10：changed=true、application=failed。真实宿主错误为 `cannot get property "webServer" without inject`，位于 Connection.register 内调用 owner.webServer.register。

立即官方 set_bundle 禁用：changed=true、application=applied、warnings=[]。未重启 Desktop。

## 修复

Host inject 改为 connection + webServer。独立 RPC 注册虽然由 Connection 封装，访问的却是调用者 Cordis scope，因此调用者必须声明 webServer。测试更新依赖断言；参考 SDK 的简化 Service mock 不模拟 Cordis 权限，所以之前测试未能捕获这个问题。

包与 Client 版本升级 0.0.11。check、22/22 测试、临时缓存 pack:check 与 diff --check 均通过。

## 安装状态不确定性

install_bundle 工作区 0.0.11 返回 packageResult.exitCode=0，但 overall application=failed、changed=false、error=ambiguous-install。因此不能声称安装/启用成功。

随后只读读取 Profile node_modules 的 Notebook package.json 确认版本字段已为 0.0.11。这仅证明磁盘 package 版本，不证明当前 Host 模块重新加载或启用。

保持先前已恢复的禁用状态；不重复启用可能被缓存的旧 JavaScript。下一步用户完整退出并重开 Desktop，再通过官方插件管理核验并启用 0.0.11，验收 Gateway 与独立 RPC。没有实机成功证据，不进入存储开发，Goal active。

## 后续回归补充（Goal round 5）

用户明确确认尚未重启 Desktop，本轮不重新启用。SDK 注册测试加入调用者上下文 Proxy：未声明 webServer 时抛出与实机相同的依赖错误，声明依赖后允许注册。新增缺失注入负例验证失败发生在路由注册之前；现有共存/卸载测试也通过该守卫。此 Proxy 只建模服务访问限制，不是完整 Cordis 运行时。

语法检查、23/23 测试、临时缓存打包预检查和 diff --check 均通过。同步 AGENTS.md 依赖约束与 README 当前状态。仍待用户手动完整重启后验收，不写入存储。
