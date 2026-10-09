# 全局入口空 owner 清理回归

新增 [抽屉焦点测试](<../../tests/unit/overlay-focus.test.js>) 发现真实源码缺陷：全局入口 sessionId 为 undefined，抽屉关闭后 openedBy 为 null，`openedBy?.sessionId === sessionId` 为 true，右侧 openedBy.button 解引用抛 TypeError。两个新用例均先 FAIL，不是仅推测问题。

[Client](<../../src/client/index.js>) 修复为先明确 openedBy 存在，再比较 sessionId/button 所有者。保持捕获 effect setup 时 DOM element，ref 清空不影响正确释放。

修复后 check/test/diff 退出码 0，共 18 测试 PASS。新增两种触发器连接状态用例验证：打开时 focus close、Tab 不拦截、Esc preventDefault 并关闭、ref 清空后原元素 keydown listener 释放、只对 isConnected 的原 trigger 恢复 focus、关闭后 entry cleanup 不抛错。仅模拟 DOM/effect，不声称真实浏览器焦点验收通过。

本轮源码修复未打包安装，最新安装 0.0.7 归档仍含此缺陷且需要重启。下轮应发布修复版本，不重复使用旧归档。真实通信、双端、主题与 unload 门禁仍未完成，目标 active。
