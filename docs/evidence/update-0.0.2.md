# 0.0.2 修订安装与加载门禁

## 改动范围

- 入口紧凑字号 0.75rem 与 padding 4px 8px。
- 卸载时以 effect setup 捕获的按钮身份释放浮层，避免 ref 清空后留下旧会话。
- 扩展 [上下文回归测试](<../../tests/unit/context-cleanup.test.js>)：同一 session 两个入口，第二个打开后卸载第一个不得关闭浮层；卸载拥有者后关闭，即使 ref 已清空。
- 无原生侧栏、RPC 或笔记存储。Phase 0 双端门禁仍未通过。

## 执行证据

`npm run check && npm test && npm run pack:check && git diff --check` 退出码 0。3 个测试全部通过；发布清单 8 个文件。

首次用工作区目录更新：Plugin Manager `application: failed`、`error.code: ambiguous-install`，包命令 exitCode 0 不等于应用成功。为诊断调用 list_bundles，发现 notebook version 0.0.2、enabled/installed true，live 模块代际仍未知。该列表同时确认当前 dsh-base 与 dsh-web-app 均为 0.2.0-rc.2（比仅 Desktop 外壳版本证据更强）。

随后执行 `npm pack --ignore-scripts` 创建明确本地归档并经 Plugin Manager 安装：

- bundle `dsh-session-notebook`；changed true。
- packageResult.exitCode 0。
- **application: restart-required**。
- 没有批准构建脚本、版本豁免或手工修改 Profile。
- 包 SHA1：`0c622a316fd97aeeba33ee98be7ae47d0ae96fb8`（npm pack 输出）；发布 manifest version 0.0.2。

生成包以 *.tgz 忽略，不替代源码或双端测试。

## 当前运行判断

0.0.2 已进入安装状态，**尚不能称当前 Desktop 已运行新版**。不通过未变化 Slot id 或当前 manifest 版本推出模块刷新。尚未重启应用，不在活跃开发会话中自动终止 Host。

用户在合适时间正常退出并重开 Desktop 后，继续此会话验证：入口字号变小；打开/关闭/Esc；从 A 切 B 时旧浮层关闭；同会话多视图入口隔离；禁用后无重复入口；深浅主题与窄窗口。

Desktop 旧版基础点击已获用户反馈通过；0.0.2 的新版 UI、切会话及 Web 独立验收保持 NOT RUN。原生右侧 Tab 接缝调查见 [Step 2 合同](<step-2-contracts.md>)。当前目标保持 active。
