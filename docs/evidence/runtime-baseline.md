# Runtime 基线与版本隔离（Step 0，round 2）

日期：2026-10-02。本文仅描述真实读取/命令结果，不代表插件安装或双端运行已验收。

## 已确认的两套安装

| 项目 | 证据 | 结论 |
|---|---|---|
| PATH 上 CLI | `dsh --version` = `0.1.5-rc.1`；读取 CLI manifest version 同值 | 终端 CLI 版本已确认，不是当前 GUI Host 版本证据 |
| Desktop 应用外壳 | macOS 应用 Info.plist 的 CFBundleShortVersionString / CFBundleVersion 均为 `0.2.0-rc.2` | 应用发行版本已确认，不等于其中每个 DSH 包的版本 |
| 开发 Node | `v24.19.0` | 工作区终端可用 |
| pnpm | `12.3.4` | 终端可用，尚未选择项目包管理器 |
| Playwright CLI | 更新提示显示现装 `0.1.18` | 已安装，不需另行全局安装或升级 |

CLI manifest 的包根为 `/Users/didi_1/.nvm/versions/node/v24.19.0/lib/node_modules/@deepseek-ai/dsh`。当前 Host Config 返回的包根仍在 Desktop 的 `app.asar/dsh/node_modules` 下，两者不是同一安装。

**约束：** 不把 CLI 的旧 SDK 当作当前 Host SDK；不据此固定当前插件 peerDependencies；不启动旧 CLI Web 服务代替 `http://127.0.0.1:19387`。

## 文档可读性

- 当前 Desktop 安装根 manifest 和 storage-domain README 的 read 操作均报 BigInt 类型转换错误（round 1）。未 shell 解包、未修改 app.asar。
- round 2 通过 glob 找到 CLI 中 storage-domain README，并用 read 成功读取。这是独立安装的参考，尚未证明与当前 Host 同版。
- 旧包 README 说明：每 Domain 一条串行写链，backend 成功后才修改内存；读出的对象本身不可原位修改；无跨表事务和跨进程变化推送。以上只作后续验证假设，**不得替代当前实现/故障实验**。
- 该 README 的 `No data migration` 和当前 Inspect 暴露 `compatibleVersions` 等内容也提醒不得盲用旧文档推断新版行为。
- 已读 bundled decoration 的四个模板：manifest、patch、Host apply、Client ModuleLoader factory。尚未复制为插件包，因为 Step 0 实际会话和客户端操作门禁未完成。

## 浏览器连接实验

### BROWSER-01：访问既有 URL

前置：新建隔离自动化浏览器会话 `sn-phase0`，不加载用户 Profile 或凭据。

操作：`playwright-cli -s=sn-phase0 open http://127.0.0.1:19387`。

实际：首次受 workspace-write 沙箱拦截缓存 daemon 写入；精确命令获得批准后打开浏览器成功（pid 333），但页面返回 **401 Unauthorized**。snapshot 只显示 `dsh web authentication required; reopen the URL printed by dsh web.`。没有 app DOM 可操作。

结论：页面鉴权正确拦截匿名浏览器；这不是插件失败，也不是页面可见验收 PASS。不得关闭鉴权、猜 token、打印凭据或从其他用户目录扫描 token。

### BROWSER-02：连接现有 Chrome

操作：`playwright-cli -s=sn-connected attach --cdp=chrome`。

实际：工具找到 localhost:9222，WebSocket connected 后 30 秒超时，daemon 退出码 1；后台任务 `bash-19` 已收集。后续有限时 `/json/version` 请求没有输出（curl 退出码 0），不构成可用浏览器证据。

结论：当前 Chrome 自动化连接不可用；不能声称已附着 Desktop 窗口。没有反复轮询，没有改浏览器启动参数或重启用户浏览器。

## 继续开发所需的连接

优先使用现有应用提供的已认证 Web 入口，在隔离的 `sn-phase0` 浏览器完成正常登录。不要把含认证 token 的 URL、cookie 或截图加入仓库、报告和聊天日志。另一条路径是用户将测试页面接到可用的浏览器调试/扩展入口；仍需要独立 Desktop 窗口验收。

拿到已认证页面后：核验实际 Host 版本 → 按 [Phase 0 操作方案](<phase-0.md#L47-L58>) 创建专用测试会话 → 保存精确消息坐标 → Step 1 最小 Bundle。当前保持 Phase 0，不开展产品保存链路。

## 本轮安全边界

Plugin Manager `list_plugins` 成功，只查询前五条以确认管理入口可用；没有 enable/disable/install/remove。未改 Profile 配置、未启动替代服务、未新增依赖、未读真实会话。一次匿名访问产生的 Console HTTP 401 错误不归类为 slot entry crash。
