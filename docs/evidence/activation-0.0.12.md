# 0.0.12 重启后激活证据

用户确认已重启。官方 plugin_manager set_bundle enabled=true 返回 changed=true、application=applied、warnings=[]。本次不再出现旧 webServer without inject 激活错误。

Host Config Inspect 找到 include:session-notebook；status=absent 表示插件没有 Config schema，不代表插件条目缺失。

Client Slots Inspect 在 conversation.composer.dock 找到 dsh-session-notebook.entry，active=true、order=5。这是 Client 入口注册证据，不是用户视觉或业务通信 PASS。

用户在所提供测试清单后回复“确认ok, 继续”，记录为当前客户端的手动验收反馈：版本、连接状态、设置与基本交互清单获整体 OK。没有逐项截图和两个独立平台的明确标识，不扩展为双端全矩阵通过。尚未直接执行正式 Gateway HTTP 状态测试、双端全部 UI 检查或存储操作。Step 1/2 剩余门禁仍需补齐；允许开展 Step 3 文档/契约调查准备，不开放产品写入，整体目标 active。
