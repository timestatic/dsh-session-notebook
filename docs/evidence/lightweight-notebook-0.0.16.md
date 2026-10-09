# 0.0.16 轻量文件存储与文本锚点

2026-10-06 用户确认：不再等待 Storage Domain 接口。先交付单 Desktop 实例保存、重启读回与导出；应用内坏库恢复、多进程共享同一库暂缓。后续进一步确认一个元数据文件加多个 data 文件，首版需要支持几千条或较长笔记。

## 文件与提交

默认目录遵循目标 Harness 公开 `dsh-home-paths` 的 DSH_HOME / OS home 约定，使用插件独占 `storages/dsh-session-notebook/`。目录中 `notes.json` 是元数据，`data/<uuid>.json` 是不可变完整笔记。元数据包含格式版本、epoch/revision、标签、设置、收据、笔记摘要、data 文件引用和 SHA-256。

业务仍调用已有 Snapshot coordinator 和 Service；文件适配器负责组装与分拆。修改一条笔记只生成该笔记的新 data；未变化笔记复用引用。先写入并同步 data 及目录，再写入临时元数据、同步并替换 `notes.json`。元数据替换是提交点；文件和目录同步全部成功后才发布内存状态。标签合并可能生成多份变更 data，但仍只有一个元数据提交点。

成功后回收旧引用；正常打开完整验证后回收受控 UUID 命名的未引用 data。垃圾清理失败不把成功提交改报失败。坏库和未知提交不做清理；缺元数据但 data 非空时禁止创建空库。陌生文件与符号链接不作为可清理产物。旧整库 JSON 显式拒绝 STORE_UNSUPPORTED，不静默迁移。

有效元数据加引用 data 总预算50 MiB，完整 Snapshot 同样限制50 MiB；收据最多100000条/16 MiB。它是本轮具体技术预算，并非无限规模承诺。请求256 KiB、正文100000 UTF-16码元/Unicode码点、引用8000码点等已有输入边界继续保留。分文件减少磁盘重写，现有业务仍会验证和复制整个内存 Snapshot。

## 传输和正文来源

目标 Desktop 0.2.0-rc.2 静态包只读提取到忽略的 `.desktop-reference/`。Host 使用公开 `connection.fetch.register` 和 `connection.admit`，Client 使用 `connection.rpc.call`。未认证请求拒绝；不读取凭据或绕过 Desktop carrier。

会话 `conversation.composer.dock` 是增量注册位置。正文边界以实际包的 `UserStyleBubble` / `AssistantMarkdown` 为版本绑定证据，不猜官方消息 ID。只保存 sessionId、原文与上下文，流式、待提交、输入框和插件界面不接受摘录。高亮使用 CSS Highlight；重新挂载后只有唯一文字匹配才恢复，歧义与未加载明确提示。

## 验收边界

本地验证与真实 Desktop 验收分别报告。旧加载、连接和 Gateway 验收记录不作废；下一包主要验收创建/编辑/标签、重启读回、准确选区保存、重复文本不误定位、JSON/Markdown导出、坏库停写和失败保草稿。没有执行安装、启停、重启或修改 Profile。

## 有界规模抽样

在本仓库隔离测试目录生成3000条手工笔记，每条4096字符正文。有效文件13,966,360字节；首次生成10,378 ms，修改一条168 ms，重新打开580 ms。修改只新增1份data，GC后仍为3000份，重新打开全部读回。该Node进程RSS约366 MiB，测试包含多份合成Snapshot，不是Electron Host基线或峰值保证。所有抽样文件在finally清理；不加入日常门禁反复产生大样本。

这说明磁盘修改量已收敛到受影响笔记，但业务仍组装、复制和验证完整Snapshot。较大库的内存与真实Desktop响应仍需实际测量；没有由此宣称任意50 MiB库均满足性能目标。

## 最终本地门禁与产物

`npm run check`、`npm test`（379/379）、`npm run test:integration`（11/11）、`npm run test:runtime`（36/36）、`npm run test:mvp-manual`（9/9）、`npm run pack:check`、工作区和暂存区 diff 检查均退出0。真实 Cordis Context 测试直接加载正式 apply，验证两轮加载、存储就绪、卸载及路由释放。apply 使用不可构造的 arrow callback，防止 Cordis 的构造器分支忽略异步初始化。

复审关闭启动 GC 同步边界、物理容量预检、聊天区域整体替换恢复高亮和摘录草稿退出提醒问题；无剩余必要修复。浏览器退出提醒不提供草稿持久化保证。

测试包 `dist/test-packages/dsh-session-notebook-0.0.16.tgz`：37个文件，95,667字节。SHA-256：`e19cd2f48355c4b3a76466c2f1a579f575191788afc1b8c1aeb20659c5101ee4`。逐项验证包内容与当前源码一致，JS、package元数据、patch和locale与暂存区一致。代码已暂存；本轮Markdown修改未主动暂存。没有commit、push、安装或真实Desktop验收。
