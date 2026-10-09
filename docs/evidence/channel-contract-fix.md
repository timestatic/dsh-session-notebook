# Step 2：独立通道实现级兼容修正 0.0.10

## 当前门禁

继续严格执行 DEVELOPMENT_GUIDE Step 0–2；不进入 Step 3 存储写入或 Step 4 产品保存。当前 Host `Config.listConfigs({name:'dsh-session-notebook'})` 返回 entries=[]：当前组合中未发现 Notebook 配置条目。不能据此推导磁盘包已删除，也不能声称已安装最新版本。

## 发现的缺陷

0.0.9 使用 `/rpc/dsh-session-notebook`。读取工作区参考 SDK `connection/package/lib/index.js` 发现：

- CHANNEL_PATTERN 为 `^/[A-Za-z0-9._~-]+$`，只接受单段 channel。
- `assertChannel` 拒绝多段 channel 与保留 `/api`。
- 独立 `rpc.handle` 注册带认证检查的 webServer prefix route；它与 shared `/api` interceptor 分离。
- `registerInterceptor` 检查 `/api` 唯一所有权，不能注册第二个。

因此旧签名 `channel: string` 与只验证固定值的 mock 不足以证明 0.0.9 能启动。此次未尝试部署该无效版本。

## 修复与证据

- Host / Client / 测试统一改为单段 `/dsh-session-notebook`。
- 包与 Client 可见版本同步 0.0.10。
- AGENTS.md 增加实现级通道语法校验规则；旧 0.0.9 文档显式标记方案失效。
- 新增 `tests/unit/connection-contract.test.js`：读取已保存 SDK，提取并直接执行其 CHANNEL_PATTERN 与 assertChannel，验证合法通道通过、旧多段通道和 `/api` 被拒绝。提取边界变化时测试失败，要求人工复核 SDK。
- Host 实际 apply 经 SDK validator 注册；检查只有 Notebook 独立通道、精确 GET 路由和正常释放。
- 现有实际 Notebook handler 与 Client 的进程内往返、模拟 Gateway 共存和反复加载/卸载测试仍通过。

这不是整个官方 Connection 类/真实 HTTP carrier 集成测试。参考 SDK 文件存在于 `.sdk-reference`，未添加生产依赖；在不含参考包的其他开发环境执行测试前须准备版本匹配的 SDK 参考，不能跳过测试当通过。

## 本轮自动检查

`npm run check` 通过；`npm test` 20/20 通过；使用临时 npm cache 的 `pack:check` 通过；`git diff --check` 通过，命令退出码 0。

## 下一步（仍未完成）

1. 通过授权 plugin_manager 安装 0.0.10；核对 application/warnings，必要时完整退出并重启 Desktop。
2. 正式持久 Bundle 在 Desktop 与 Web 独立验证入口、版本、health/list 与 Gateway settings/describe HTTP 200。
3. 验证认证拒绝、禁用卸载、主题与焦点；补真实证据后才关闭 Step 1/2 门禁。
4. 然后开始 Step 3 专用 Storage Domain 可靠性实验；不触碰真实 Notebook 数据。

本轮未安装、启用、重启宿主或写存储。Goal 保持 active。
