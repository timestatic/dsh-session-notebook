# 0.0.26：DSH 0.2.0-rc.2 Web 兼容准备（源码阶段）

当前 `dsh --version` 为 `0.2.0-rc.2`，会话环境 `DSH_PROFILE=web`。当前 Host Config Inspect 查询 `dsh-session-notebook` 无条目；未执行 plugin_manager，不能证明实际安装/加载状态。本次不修改 Profile、Desktop 或用户笔记介质。

## 改动

- `src/host/json-store.js`：打开库前在库父目录原子创建固定独占 sentinel；另一进程/同目录另一 manifest 立即报 `STORE_OWNED`，Host 已有错误路径保持 `storageReady=false`，不注册业务写路由。持有期间、每次提交前比对锁路径与持有文件的 dev/ino；正常 close 排空已接收事务后仅删除仍为本进程持有的文件。崩溃遗留 sentinel 不自动回收：需操作员先确认全部写入进程已停止，并核实库介质，再经授权离线恢复。该协作协议不防范同 UID 恶意删除/替换锁文件，也不提供跨机器 NFS 强一致锁；遇身份异常停写。不能当成完整并发存储设计。
- `src/client/index.template.js`：来源回链先核对 workspace 已就绪和归档状态，再用 session Host list 的 `ids` 判定可导航；不将可能包含 retained subagent fallback 的 `byId` 误判为列表成员。同版本已安装 SDK 声明为证据。现有 `uiSession.adapter.current` 仅对当前会话的输入写入可用，且已校验 key；跨会话输入写入保持不可用，不改成不受支持的调用。DOM 选区使用已核对当前 0.2.0-rc.2 markup，但私有 CSS 类后续改版仍需真实浏览器回归。
- 同步发布版号与打包 Client，增加独立子进程持锁、正常释放、崩溃残锁拒绝、替换锁 fail-closed 回归；测试只在 `.storage-test-output` 内创建/清理自有临时目录，不碰 Profile。

## 发布门禁和剩余验收

本轮 `npm run check` 通过；`npm test` 最终 392/392 通过（期间有一次 tag color 断言受并行工作区既有改动影响，重跑该文件及全集均通过）；`npm run test:integration` 12/12，`npm run test:runtime` 37/37；`npm run pack:check` dry-run 通过，0.0.26 共 39 文件；另以 `npm pack --ignore-scripts` 在 `dist/test-packages/` 生成本地测试包 `dsh-session-notebook-0.0.26.tgz`（尚未安装/发布）；`git diff --check` 和 staged diff check 均通过。实际 Web 安装需要用户批准，通过本 Profile 官方 `plugin_manager` 安装，核对 application/warnings；更新已加载 Bundle 按官方返回判定是否需要重启。安装后验证 version=0.0.26、health/list 和所有业务 RPC、保存后重启读回、来源导航、选区/高亮、主题和窄屏、认证拒绝、官方 Gateway 在启用/禁用后的正常工作。Desktop 单独验收。上述真实项在本次源码准备中尚未完成。
