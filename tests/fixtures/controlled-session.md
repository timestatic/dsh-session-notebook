# 专用会话合成文本

本文件仅供 Phase 0 专用测试会话使用，不能直接追加为 DSH 事件。为 `SN-E2E-A` 和 `SN-E2E-B` 创建独立会话后，将下列文本作为 user 消息提交，并请求 Assistant 原样输出这些结构以检查 committed assistant 渲染。保存实际 messageId 和 block coordinate；不能以本文件证明会话已经创建。

---

前文 **重要结论** 后文。另一个完整加粗：**重要结论**。

重复文字。第一处。

重复文字。第二处。

查看 [开发指南](https://example.invalid/guide)。执行 `const value = 1` 后检查。

```ts
const value = 1;

  console.log(value);
```

- 第一项
- 第二项 **重点**
- 第三项

| 名称 | 值 |
| --- | --- |
| 中文 | 42 |
| emoji | 😀 |

第一段

第二段
软换行

中文😀🧑‍💻é尾部

> 引用第一行
> 引用第二行

单

---

恶意 HTML/协议、CRLF 和 8000/8001 限制样本应从 [结构化样本](<selection-cases.json>) 单独构造，不点击恶意链接。流式消息在提交完成前不创建持久引用。归档与删除来源仅操作专用会话；当前开发会话禁止用于破坏性测试。
