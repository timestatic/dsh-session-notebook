# Step 2：参考 SDK 注册与共存回归

本轮只修改测试与文档，生产版本仍 0.0.10；未启用插件、重启 Desktop 或写入 Notebook 存储。

## 测试方式

从工作区保存的 Connection SDK lib/index.js 提取注册实现区域，在隔离 VM 中执行实际 HostConnectionService、register/registerInterceptor/registerFetchRoute、createSharedFetchHandler、通道和路由校验及响应编码。

测试替身仅用于 Cordis Service/Peer 生命周期底座、认证和信任输入、HTTP bridge 与 envelope schema。认证函数本身、严格 envelope 校验、真实 HTTP socket、Desktop carrier 未由本测试验证。

## 实际覆盖

- 官方 Gateway 先注册 / Notebook 先注册两种顺序。
- 每种顺序连续两轮 Notebook apply/dispose。
- Gateway settings/describe 经参考 SDK shared Fetch dispatcher 返回 HTTP-shaped Response 200，handler 注册项保持原引用。
- Notebook 精确 GET health/list 正常返回；卸载后返回 404。
- 独立 channel 实际注册为 webServer prefix route，不替换共享 interceptor。
- 该 prefix handler 在信任拒绝时返回 403，在未认证时返回 401，且未进入 bridge。
- Notebook 卸载不删除 Gateway；整体测试清理释放所有注册。

## 检查结果

npm run check：通过。npm test：22/22 通过。临时缓存 pack:check：通过。git diff --check：通过。退出码 0。

## 门禁边界

这是参考 SDK 实现级、隔离环境的注册与分发测试，不是已安装包、真实 HTTP 或双端 UI 验收。正式包安装状态见 install-0.0.10.md：已安装但禁用，application=restart-required。

仍停在 DEVELOPMENT_GUIDE Step 1/2。缺少授权测试启用、完整 Desktop 重启和双端实际验收证据，不能以新增测试替代门禁进入存储开发。Goal 保持 active。
