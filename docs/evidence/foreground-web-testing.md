# 前台 Playwright 测试方法与 3080 入口问题

## 已取得真实证据

- playwright-cli sn-foreground 通过 Chrome extension 附着用户选中的前台标签页；不是 headless sn-phase0。
- 实际 origin 为 http://127.0.0.1:3080；Notebook 按钮与 data-notebook-version 均不存在。
- 同源、现有登录态 GET /api/dsh-session-notebook/health 返回 404。
- 浏览器设置 → 插件 → 插件列表，搜索 notebook，返回“没有匹配的插件”，会话/全局匹配数均为 0。
- lsof 确认 3080 是 Node PID 2800，19387 是 Desktop PID 53742；两者不同 Host 进程。PID 是本次瞬时证据，后续必须重新核验。

结论：3080 的实际运行组合没有 Notebook 条目，而插件此前启用的是 Desktop Host。不是简单按钮样式/侧栏折叠问题。不据此断言磁盘包是否安装。用户选择继续修复原 3080 部署后，对该进程命令行做脱敏解析，仅输出 --profile 字段，确认实际 Profile 为 web；未输出完整命令行或环境变量。下一步需使用 web Host 的官方插件管理，不能调用当前 Desktop 管理工具假装已部署 web。

## 可重复接入

```bash
playwright-cli -s=sn-foreground attach --extension=chrome
```

用户在扩展授权页选择实际 Harness 标签页。连接可能异步等待，记录 job id，完成后收集结果；不要重复发起连接。不要用 open 创建未登录的新浏览器替代真实页面，不复用用户个人 Chrome profile 目录，不读取/导出 cookie、token 或 storage state。

## 最小只读定位

```bash
playwright-cli -s=sn-foreground eval "({origin:location.origin,notes:[...document.querySelectorAll('button')].filter(b=>/笔记|Notes/.test((b.getAttribute('aria-label')||'')+' '+b.innerText)).map(b=>({label:b.getAttribute('aria-label'),text:b.innerText})),versions:[...document.querySelectorAll('[data-notebook-version]')].map(e=>e.getAttribute('data-notebook-version'))})"
playwright-cli -s=sn-foreground eval "async () => ({health:await fetch('/api/dsh-session-notebook/health',{credentials:'same-origin'}).then(async r=>({status:r.status,body:r.ok?await r.json():null}))})"
```

这里 fetch 是浏览器验收的同源只读探测，不是生产 Client 绕过 Desktop carrier 的实现。只记录 origin，不记录可能含 token 的完整 URL。不要遍历整个页面正文或输出聊天历史。脚本 src 缺少 Notebook 不足以证明未加载，因为动态 ModuleLoader 不一定创建 script 标签。

## 插件库存核对

```bash
playwright-cli -s=sn-foreground click "getByRole('button', { name: '设置', exact: true })"
playwright-cli -s=sn-foreground click "getByRole('button', { name: '插件', exact: true })"
playwright-cli -s=sn-foreground click "getByRole('tab', { name: '插件列表', exact: true })"
playwright-cli -s=sn-foreground fill "getByPlaceholder('搜索插件')" "notebook"
playwright-cli -s=sn-foreground eval "[...document.querySelectorAll('[role=dialog]')].map(d=>d.innerText.slice(-3000))"
playwright-cli -s=sn-foreground fill "getByPlaceholder('搜索插件')" ""
playwright-cli -s=sn-foreground click "getByRole('dialog').getByRole('button', { name: '关闭', exact: true })"
```

控件 role 来自真实页面；插件列表是 tab，不是 button，搜索是 placeholder，不是有 label 的 textbox。“关闭”必须限定设置 dialog，避免误关会话 tab。定位失败后调查，不盲目点第一个匹配。测试已清空搜索并关闭设置对话框，无配置变更。

## 后续修复路径

1. 若用户仅要浏览器查看 Desktop 插件，使用 Desktop 提供的正式浏览器打开入口（19387），由用户正常认证，不复制 Desktop token/cookie。
2. 若要同时支持原 3080 独立 Web 部署，先确认其实际 Profile，再在那个 Host 的官方 plugin_manager 上安装/启用 Notebook。当前会话 plugin_manager 管理的是 Desktop，不能将 Desktop 的 applied 当作 3080 部署成功。
3. 不手工改 Web Profile，不运行包管理器修改 Profile，不启动替代服务器，不终止 PID 2800。变更会影响其所有会话，明确范围后才实施。
4. 两个真实客户端分别核对 v0.0.12、入口、RPC 连接、设置正常、关闭重开、主题与键盘，收集有限截图或结果。仍未关闭 Step 1/2 双端门禁。
