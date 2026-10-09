# 同版公开合同与原生侧栏 0.0.3

## 合同获取

Desktop app.asar 读取失败后，从正式 npm registry 获取 **@deepseek-ai/dsh-client-ui-sidebar-right@0.2.0-rc.2**，与当前 bundle 版本一致。未安装为插件依赖、未执行脚本、未替换宿主包。

来源：https://registry.npmjs.org/@deepseek-ai/dsh-client-ui-sidebar-right/-/dsh-client-ui-sidebar-right-0.2.0-rc.2.tgz

npm metadata integrity：`sha512-ocVUP6v3X7vShYeJ5I1Z3t1lDC02hJdZ49/kIRj29Xbe+BIfMY9HSDyUVUUDdijdd3jP8dpmhmbHbDJudwFUtQ==`；npm pack SHA1：`6726f95a75f5ef93cdb09c5ca2c9f9c8ed936f49`。包放在 .sdk-reference（已忽略），只读 README 与 d.ts。同版公开包是 coding contract，不等于已证明 Desktop 内嵌字节完全相同。

README §Adding a tab type 和类型确认：

1. `ctx.sidebarRightTabs.register({ id, kind, title, guide? })` 返回 disposer；默认 extension。
2. 内容 Slot key **等于 definition.id**，不是随意 kind。
3. `ctx.sidebarRight.openTab(kind)` 创建/选择并展开当前会话原生面板；普通 page 在目标 pane 去重。
4. props `useTabInfo()` 返回 tab.actions；`tab.actions.close()` 关闭该 tab 自己所属会话，不按当前前台会话误关。
5. 卸载类型后宿主显示未知类型提示，存储 tab 不自动删除；插件不删除用户其他 tab。

Inspect 当前 `Service.listService sidebarRightTabs` 返回 no catalogued Service；这说明未收录进 Inspect 目录，不等于运行时不存在。因此代码通过已发现的 ctx.get 查询并检查 register/openTab，在 provider 缺失时保留兼容空浮层。

## 实现

[Client](<../../src/client/index.js>) 注册独立 id/kind `dsh-session-notebook` 和 guide 入口；入口优先调用 sidebar.openTab。原生 body 通过 useTabInfo 关闭，先展示 sessionId 和加载说明。加入 sidebar-right Client 激活依赖，没有 runtime import Harness Client 包。

原生服务缺失保留旧浮层；本轮尚不称其等效完整侧栏。没有侵入 DOM、改宿主 grid 或使用 layout.openRightbar。尚无工作区快照、无会话全局入口、health/list RPC，这些 Step 2 动作仍待完成。

## 验证与安装

4 个 node:test PASS：原生 type/body key 配对、openTab 调用、自己 tab.actions.close、类型 disposer；旧 fallback 及上下文清理仍通过。JS 语法与 diff check PASS。均为 VM 模拟，真实 React/render/provider 验证 NOT RUN。

明确版本包 0.0.3 安装：Plugin Manager changed true、packageResult exitCode 0、**application restart-required**。包 SHA1 `4efc327a1a2e074b01e4dad064a110462b52fa25`，8 个文件。没有执行构建脚本/版本豁免，也没有自动重启 Desktop。

用户正常重开 Desktop 后：点击紧凑入口应优先出现右侧原生 AI 笔记 tab；若仍旧浮层，记录为 provider 不可用而非通过。验证开关、原生 tab 关闭、重复打开、会话切换、窄窗口/深浅主题。再查询 live keyed occupant。Step 1 双端与 Step 2 正式通信仍未验收，目标保持 active。
