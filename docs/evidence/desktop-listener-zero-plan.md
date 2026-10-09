# Desktop Step 0–2 内部资源归零：观测合同草案

状态：**仅工作区方案，未获安装／修改宿主／启停／实机观察授权；不是验收证据**。目标版本：Harness base/web-app 0.2.0-rc.2、Notebook 0.0.12。用户保留当前 Desktop 内部监听器归零门禁，不接受入口消失或本地 disposer 回归替代，且暂不做新的 Desktop 请求观察或 Notebook 启停。

## 只读合同与可证明的上限

Notebook Host [源码](<../../src/host/index.js>)仅用 `ctx.effect` 注册两条 `connection.fetch.register` 精确路由；未调用 `ctx.on`、`rpc.intercept` 或物理 `webServer.register`。当前 Host Inspect 的 Connection 合同只提供 `fetch.register(route): () => Promise<void>`，没有对注册拥有者的计数查询，也没有内部 listener 清单。保存版 Connection SDK [实现](<../../.sdk-reference/connection/package/lib/index.js#L608-L638>)表明精确路由存入私有 `fetchRoutes`，清理时删除对应 path。该实现级阅读不能证明当前 Desktop 的实际 Map 状态；不得读取运行时私有字段或把测试中的 Map 当成宿主。

现有 [被动 HTTP 观察器](<../../diagnostics/desktop-http-observer/index.js>)监听 `connection/request` 且只匹配 Gateway `settings/describe`，无法证明 Notebook 的 route 注册或 Host 内部 listener 零；不能复用它声称已覆盖此验收项。旧 handler 在卸载后自拒绝也只能证明插件活动门，不证明 Connection registry 清理。

## 最小可观测能力（仅候选，先评审宿主能力和授权）

首选由**正式 Connection 注册拥有者**提供只读、按插件 owner/生命周期限定的测试观测：在每次经 `fetch.register` 成功建立/完成注销时记录 `ownerLifecycleId`、两个固定 Notebook path 的活跃条数和注销是否成功。结果仅汇总 `health: 0|1`、`list: 0|1`、属于此生命周期的其他注册数，以及当前生命周期所有可归属的事件监听器数；不包含其他插件的注册、请求、header、body、token、真实会话内容或全部事件名称。新增观测能力如需修改 DSH 或安装诊断包，必须独立设计审查与单次批准，不能直接改 SDK 参考副本或 Profile。

验收必须观察**同一实际 Desktop Host** 的同一 owner 生命周期：启用期两条路由各为1；禁用后官方注销 settled 且两条均为0，同时该插件在宿主登记的事件监听器/其他可归属资源为0；重复启用只有各1，Gateway 身份和功能不变。任何观测缺失、生命周期 id 不一致、注销 reject/timeout、路由计数非零或无法枚举某类资源都记为 **UNKNOWN/FAIL，不能记 PASS**。禁止遍历全局 listener、读取其他插件私有状态或把 `404` 单独等同内部归零。

无授权时只保留此方案，不安装、不启停、不对 Desktop 发新请求。即使未来获批上述观测，当前 Desktop 的无凭据准入和禁用期间新请求路由状态仍是**独立门禁**；不得从内部计数自动推导认证或 HTTP 结果。授权申请也应分别限定修改／部署、一次禁用恢复、无凭据安全验证与结果读取范围，尊重用户先前拒绝，除非用户主动改变选择。
