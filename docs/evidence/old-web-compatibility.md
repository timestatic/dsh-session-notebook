# 旧 Web 兼容调查：配置覆盖实验

用户明确保持旧 Web，不升级 CLI，不混装新版管理包。

实际 CLI manifest 为 0.1.5-rc.1；其已安装 Connection manifest 为 0.1.5-rc.2（依赖范围导致版本不完全相同）。已读取本机 rpc.d.ts，确认 Host fetch.register 精确路由及 Client RPC shape；声明兼容不等于实际运行通过。

官方 bin.js 支持 --profile web --patch <workspace-file> --dump-config；参数解析明确 patches 数组随 boot invocation 传递。准备 web-compat-test.patch.yml 仅插入本项目 Host 模块路径。

执行只读配置合成，退出码 0，目标行已解析成当前工作区 src/host/index.js 的 file URL。出现两个既有 Profile override 目标不存在警告：ui-settings-account、agent-preset-registry。未修改或修复该 Profile。完整合成输出只做目标行核对后删除，避免可能的配置敏感字段进入交付。

## 限制

该覆盖只证明 Loader 能合成 Host 行。Client ModuleLoader 仍须包级 manifest/client 元数据贡献，直接 Host 文件路径不自动证明 Client bundle 被服务。因此不能建议用户用此 patch 当完整插件安装，也不能将该试验当 Step 1/2 持久 Bundle 通信通过。

未启动新的服务器，未停止 3080，未改 Profile。当前持久安装仍受“旧版无 plugin_manager + 不手改 Profile”约束，暂未解决。

## Client manifest 发现已验证

进一步读取本机 dsh-client-modules/lib/index.js 的 resolveMeta / locatePkgJson / nearestPackage：Loader 行的实际模块 URL 是权威来源，文件路径行也会向祖先查找 package.json，再读取 dsh.client 与 exports['./client']。并非只支持 Profile node_modules 中的包名。

提取该已安装包真实 nearestPackage 方法到 VM（只为文件系统扫描提供 node:fs/path/url），以本项目 Host file URL 调用，成功返回 dsh-session-notebook manifest；断言 dsh.client.platform=web、客户端导出文件存在，退出码 0。

因此工作区 Host 路径覆盖在机制上能被 Client 扫描器发现。仍未验证 resolveSync 的实际 Loader 接缝、Client 批次图构建、注入依赖可用性、Host 注册或浏览器执行，不宣称启动通过。下一步需要用户授权以原服务的正常启动方式追加 --patch 测试；只读合成和 VM probe 不等于持久 Bundle 安装，不关闭门禁。

## 旧版 Slot 初步源码核对

已安装 ui-sidebar/client.js 声明 sidebar.footer.action 为 root/list，并渲染 { wide }；ui-conversation/client.js 声明并渲染 conversation.composer.dock；ui-layout/client.js 声明并渲染 shell.overlay。最初猜测 ui-shell 路径不存在，后通过源码搜索定位真正提供者 ui-layout，未凭猜测路径作结论。

所以三个核心入口孔位在旧版已安装源码中存在，尚无 live 3080 Notebook occupant 或按钮证据。组件会话 props 注入、sidebar-right 服务及包依赖顺序仍需实际加载验证。无生产代码变更，未操作原服务；等待用户正常追加 --patch 启动后的测试反馈。
