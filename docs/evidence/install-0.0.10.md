# Step 1/2：0.0.10 安装状态

## 本轮实际操作

通过官方 plugin_manager 更新当前 Desktop Profile 的 Notebook 包，显式保持 enabled=false，未手工修改 Profile。

1. list_bundles 确认旧包 0.0.8 已安装但禁用。
2. 第一次 install_bundle 因传入空 registry 字符串失败：application=failed、changed=false。此为工具参数错误，不是插件启动失败。
3. 使用 https://registry.npmjs.org 重试工作区本地包安装：packageResult.exitCode=0、changed=true、application=restart-required、enabled=false。
4. 再次 list_bundles 确认 dsh-session-notebook 版本为 0.0.10、installed=true、enabled=false。dsh-context 保持 enabled=true。

包管理输出有 peer dependency warning，尚未取得具体依赖对；不能把该 warning 宣称为兼容性通过或擅自设置版本豁免。

## 状态边界

- 0.0.10 已安装：是，官方插件管理列表已核实。
- 已启用：否，显式保留禁用。
- 已完整重启 Desktop：未执行。
- 最新 Host/Client 激活：未验收。
- Desktop welcome / settings/describe 200 / Notebook health/list：本轮未运行。
- Web/Desktop UI 双端：仍待验收。

Step 1/2 完成门禁尚未关闭，不进入 Step 3/4。不能以包安装退出码 0 替代运行时通信证据。

## 下一步

取得允许测试启用与完整重启的明确授权，或使用用户提供的已准备测试环境；根据当前权限政策操作。批准提示不可用时不绕过 plugin_manager 手工改 Profile。重启后核对实际版本和官方 Gateway，再进行 Notebook 双端验收。

Goal 保持 active。
