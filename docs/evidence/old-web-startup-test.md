# 旧 Web 原服务覆盖测试：启动与回退

## 范围

用户同意先整理步骤，不由 Agent 直接停止服务。CLI dsh --version 当前仍是 0.1.5-rc.1。3080 listener 已从历史 PID 2800 换为 95556；原 PID 查询失败已通过 lsof 重新定位，不能继续按旧 PID 操作。新进程未显示 --profile/--port/--host，可能使用 web alias 或环境/配置，不能据此断言原启动环境。

下列步骤为测试覆盖，不是 plugin_manager 持久安装。不会改 Profile；去掉 --patch 后恢复原加载组合。Profile 现有缺失 override 警告不属于 Notebook，不自动修复。

## 启动前

- 请用户确认当前是否已主动重启 Web；停止前等待正在执行的会话完成。
- 使用原服务的终端/管理器与工作目录、原有环境变量，不能丢失原 .env /启动选项。无需向 Agent 粘贴秘密。
- 原服务已有 trusted-host 或其他参数则保留；不新增信任豁免。
- 由用户正常停止原服务，不 kill PID，不保留两个服务争用 3080。

## 官方测试命令

若原启动就是普通 dsh web 且没有额外环境要求，可使用：

```bash
dsh --profile web --patch /Users/didi_1/IdeaProjects/mytest/dsh-session-notebook/docs/evidence/web-compat-test.patch.yml --host 127.0.0.1 --port 3080
```

--patch 属于 launcher 参数，必须放在 --host/--port 等应用参数之前。若原启动方式不同，应只将 --patch 和路径插在原 launcher 参数区，不直接替换原启动命令。

浏览器使用新进程打印的官方登录入口正常认证。不要把含 token 的 URL、cookie 或环境变量发给 Agent。原标签页认证可能因重启失效；没有自动复制登录态。

## 验收顺序

1. 启动无 Notebook FAILED fiber、无 Gateway ownership/injection 错误。
2. 前台 Playwright 重新授权接入实际 3080 标签页；确认 origin。
3. POST /api/settings/describe 返回 200。
4. global Notebook 入口出现（展开文字，折叠 ✎）；打开版本 0.0.12，连接正常。确认 list 是 Phase 0 空结果，不写笔记。
5. 等待并再次读取 settings/describe；关闭重开浮层、Esc/焦点、主题。测试后恢复主题等设置。
6. 不输出全页聊天内容、完整请求 header、cookie 或 token；仅保留有限状态和插件区域证据。

## 失败回退

由用户正常停止测试启动，去掉 --patch 按原命令/原环境重启。再验证 settings/describe 返回 200 和原功能恢复。若 Profile 没改则无需编辑其文件或卸载包。测试失败只报告实际证据，不将配置合成或 manifest probe 写成运行通过。

## 尚未证明

Client 元数据祖先发现已由真实方法验证，但 resolveSync、批次图与全部 inject/Slot 合同尚无完整实机证据。持久 Bundle 安装门禁仍未通过；启动覆盖测试成功也不等于解决持久部署。
