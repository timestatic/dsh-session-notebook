# 工作区归属歧义保护

根据前轮证据，宿主唯一归属规则未被确认。当前 selector 使用 find 静默选择首个成员，可能显示错误工作区路径。本轮改为收集匹配成员，超过一个明确 workspaceAmbiguous，不主动修复工作区注册表或猜测 cwd。

[面板测试](<../../tests/unit/native-panel.test.js>) 覆盖多成员不展示任一路径、移除歧义后最新 title/path 更新。18 个测试 PASS，check/diff 退出码 0。仅模拟快照，不是实际 workspace feed 验收。

本轮工作区修改未安装；最新安装 0.0.8 仍为原归档，restart-required。不因用例增加再次发布版本；优先等待真实 carrier 修复运行结果。Step 1/2 双端/通信门禁未通过，目标 active。
