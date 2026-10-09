# 原 3080 Web Profile 正式安装入口调查

前台 Chrome 扩展已重新授权接入 3080。用户明确要求继续处理 web Profile 安装入口。

## 当前证据

- 只读读取 ~/.dsh/profiles/web/package.json：Profile bundles 不含 dsh-session-notebook；含 dsh-session-notes（另一社区插件，不等于本项目）。patchReload 为 live。没有修改该文件。
- 当前 Desktop Host Inspect 的 pluginManager Remote 契约确有 listBundles / installBundle；读取同版官方 generated Remote 元数据确认 namespace=pluginManager、payload.args 与 installBundle 的 spec/options 字段。
- 对实际 3080 登录页面调用 /api/pluginManager/listBundles 返回 404（text/plain）；此前假定 Web 提供该管理 Remote 不成立。
- 同页面 POST /api/settings/describe 返回 200（application/json），说明不是整个 Gateway 或登录态失效。
- 未执行 Web 安装、未修改 Profile、未重启 Web Host。

## 正式处理路径

当前会话的 plugin_manager 绑定 Desktop，不能改 web。3080 的管理 Remote 未挂载，不能改用假端点或手工编辑 Profile 绕过。

优先在原 3080 Web 的专用会话调用其 plugin_manager 工具（如果该 Agent 能发现工具），明确指定本项目工作区路径进行安装，读取 application/warnings 并做同源验收。如果该 Host 没有管理工具，先核对其版本及正式可选 management bundle/管理入口，取得授权后按官方方式启用；不要直接在 Profile 执行 pnpm、手改 bundles 或将另一社区笔记包当作本项目。

本轮解决了管理入口“声明存在但该 Host 未挂载”的诊断，安装尚未完成。Desktop 当前启用状态保持不变，双端门禁未关闭。

## 版本调查与用户决策

Web 会话确认 plugin_manager 工具不存在。终端 dsh --version 为 0.1.5-rc.1，读取该 CLI manifest 一致；Desktop 为 0.2.0-rc.2。旧 CLI 依赖树未发现 dsh-plugin-manager 包。dsh plugin 缺少 --profile 时退出 1；补 --profile web --help 仅显示 pnpm 帮助，未执行安装。

用户明确选择保持旧 Web 版本。因此禁止升级 CLI、混装新版管理包或豁免版本冲突。下一步仅调查 0.1.5-rc.1 的精确 Fetch 路由/Client carrier/Slot 合同及非持久测试加载机制。当前无满足项目约束的持久 Web 安装入口，不以手工 Profile 或旧 CLI pnpm 转发绕过。
