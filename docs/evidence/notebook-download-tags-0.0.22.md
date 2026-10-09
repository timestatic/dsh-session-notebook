# 0.0.22 下载文件名与编辑标签

2026-10-07：全部实际 Markdown 下载与 JSON 备份统一使用本地时间后缀 `YYYYMMDDHHmmss`。同一秒内导出同一版本仍可能同名；本轮按用户要求提供秒级时间，不增加其他文件名概念。

编辑标签使用复选框，可直接连续多选。最多 10 个；保存中的冻结请求不允许更改。JSON 备份保留完整 Snapshot；Markdown 用于阅读和分享。应用内恢复仍未开放。

验证：`npm run check`、384/384 单元测试、12/12 集成测试、36/36 运行时模拟测试、`npm run pack:check`、工作区和暂存区 diff 检查均通过。只读代码复审无必修项。

独立浏览器加载生产 Client 与真实笔记服务，使用合成数据。验证连续勾选两标签、保存并服务读回、重开勾选回显、取消单个标签后保存重开、实际 Markdown 两次下载与 JSON 下载。最终文件名分别为：

- `dsh-session-notebook-rev-18-20261007152725.md`
- `dsh-session-notebook-rev-18-20261007152727.md`
- `dsh-session-notebook-rev-18-20261007152727.json`

测试包：`dist/test-packages/dsh-session-notebook-0.0.22.tgz`，38 文件，104090 字节。SHA256：`4f456d5cd288d7651b40a5fba3d775a5c8616c613c52005a7108e27f3d5fd3c0`。逐项核对包内文件与源码一致。

没有安装、启用、重启或真实 Desktop 验收。此前多段落选区的 `UNMAPPABLE_RANGE` 问题未包含在本轮修复中。
