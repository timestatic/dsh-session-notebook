# 0.0.8 清理修复版

发布上一轮先失败再修复的全局入口空 owner 判断。同步 manifest 与两处 VersionLabel 为 0.0.8，README 为 18 测试。

check/test/diff 退出码 0，18 测试 PASS。归档 SHA1 b4783de8a36fe5aaaf0308dae448ca22146f102d，8 文件。Plugin Manager 安装 changed true、package exitCode 0、application restart-required。未自动重启 Desktop，未声称新版已经加载。

需运行验收：正常重开后确认 v0.0.8，再查看原生 Tab/global drawer Host 连接是否成功，失败则记录固定安全诊断码。关闭抽屉后切页/卸载不应抛空 owner 异常。全局无会话可见、两端主题/键盘/窗口变化、实际禁用重启再启用仍未验收。

当前不能依据 mock PASS 越过 Step 1/2 门禁，目标 active。后续等待实际页面证据，并继续有针对性复现，不添加笔记保存或存储写入。
