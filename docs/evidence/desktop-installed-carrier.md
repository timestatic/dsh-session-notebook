# 实际安装Desktop carrier与设置缓存调查

2026-10-03，Round21。此前Host read对app.asar内路径抛BigInt类型错误；这是工具错误而非文件沙箱拒绝。本轮只读解析ASAR索引并提取静态实现到忽略的.desktop-reference，未改安装包、未读运行时token/cookie/global对象、未操作Profile/3080。提取含凭据变量处理逻辑的源码不等于读取凭据值。

## 实际安装源码

[主进程协议](<../../.desktop-reference/lib-main.js#L11542-L11549>)：dsh-app的app origin静态资源从安装目录读取，其余请求在Host可用时交给forwardWebRequest，否则503。

[转发实现](<../../.desktop-reference/lib-main.js#L7461-L7491>)：验证应用origin、复制源pathname/search到自有Host、由shell提供认证、保留method/body/signal、fetch后返回原status及过滤后的headers。这证明该安装版本实现使用HTTP转发，但仍不是当前某一请求实际200的证据。插件不能仿造此载体或导出其认证。

[实际Host connection](<../../.desktop-reference/dsh-client-connection-index.js#L829-L843>)与参考包一致：认证检查之后调用connection/request waterfall。前轮空摘要不应直接归为无HTTP路径。

## 关键测试盲区：设置describe缓存

[实际设置组件](<../../.desktop-reference/dsh-client-ui-settings-client.js#L1457-L1521>)通过ctx.remote.settings.describe读取共享mirror；启动mirror.ensure，settings/document-updated和connection/reset才mirror.load。打开/关闭设置页不是已核实的新网络请求触发器。因此Round20用户设置两次正常且空摘要，可能只是已经命中缓存；不能据此得出观察器无覆盖或IPC结论。

## 后续最小实测

仍需用户授权暂时重新安装观察器，并通过Desktop官方页面刷新/正常重开客户端（不重启Host、不改设置内容）触发mirror初始化；刷新可能影响未发送草稿/焦点，须先确认。至少两次分时明确的新初始化刷新才能取得重复HTTP200。若用户不批准刷新，保留缺口，不靠普通设置重开无限探测。具体刷新路径须由真实Desktop菜单支持，不能自己调用内部global或自行发认证请求。

先前“不要重复安装无覆盖观察器”结论由本调查修正：它只证明旧触发步骤不充分；重新试验须获得新的明确授权。当前观察器已移除，Notebook仍启用，本轮未部署任何包。Step0–2尚未全部关闭。
