# Step 2 Client 只读往返准备

原生面板新增 ConnectionStatus：同源 GET health → list，credentials same-origin、cache no-store；两个成功响应分别校验 phase 0、storageReady false、health status ok 与 list.items 空数组。没有写入、认证 token、数据恢复或伪装真实空库。

React effect 拥有 AbortController 与 10 秒定时器；卸载/重试停止旧请求和定时器，active 标记阻止迟到结果更新；取消后不再发第二个请求。超时/非 2xx/非法 JSON/非法结构/断线转换为可见失败，提供重试按钮。此为 Phase 0 特定只读响应校验，不代替 Step 4 业务 Schema。

8 个 node:test 全部通过，包含 Client 成功双调用、畸形成功响应拒绝、卸载取消及禁止迟到 setState；已有 Host/原生面板/fallback 回归通过。语法与 diff check 退出码 0。

本轮未重新安装：当前已安装包是之前 0.0.3 原生面板归档，本轮 Host/Client 通信改动仍在工作区；不能沿用已安装版本号说新通信已运行。真正 Fetch 路由派发、401/403、面板状态可见、断线与取消仍 NOT RUN。相对 /api 路径在当前根 URL 下测试准备就绪，非根 mount/远程部署 URL 适配尚未证明。

Step 2 仍缺工作区快照、无会话全局入口、实际鉴权往返与取消/断线验证；Step 1 双端可见门禁保持未验收。不要把这轮模拟响应测试当作真实网络 PASS。目标保持 active。
