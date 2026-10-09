# 当前架构速览

详细产品规则、领域模型、接口与验收范围统一见[现行设计](../DESIGN.md)；本文只供快速定位代码。

> 基线：工作区 `package.json` 版本 `0.0.36`（2026-10-09）；这是源码清单，**不是当前 Desktop 已安装/已验收版本**。目标 Harness 包合同需在实际运行环境重新 Inspect；不要用旧证据推定本轮实机通过。

## 入口与装配

- `package.json`：ESM、Node.js `>=22`、Bundle patch `cordis.patch.yml`；Host 导出 `src/host/index.js`，Web Client 导出 `src/client/index.js`。`files` 白名单决定发布产物；文档、测试、模板不入包。
- `scripts/build-client.mjs` 把 Client 模块内联至 `src/client/index.template.js`，生成 `src/client/index.js`。修改模板或被内联模块后运行 `npm run build:client`，再运行 `npm run check` 校验生成文件一致性（否则 `CLIENT_BUNDLE_STALE`）。直接发布 JavaScript，无 TypeScript 编译、lint 或 typecheck 脚本。
- Client 复用宿主 React/Slot、locale 和主题；注册左侧全局入口、原生右侧面板与会话选区浮层。原型 HTML 不是插件入口。

## 读写与通信

```text
Client (index.template.js + 内联模块)
  → ctx.connection.rpc.call('/api', 'dsh-session-notebook/<端点>', ...)
  → Host connection.fetch.register 精确 /api/dsh-session-notebook/<端点>
  → manual-runtime → preview-routes → manual-notebook-service
  → snapshot-coordinator → host/json-store
  → notes.json (提交点) + data/<uuid>.json (笔记记录)
```

- Host 入口先注册精确 `health` / `list` GET+POST 路由；仅在宿主提供公开 `connection.admit` 且文件库正常打开时接入业务路由。业务端点见 `src/host/preview-routes.js`，均为精确 POST，验证宿主 admission、RPC 信封和请求体上限。源码文件头保留了早期“未激活”注释，**以 `manual-runtime.js` 的实际调用为准**。
- Client `preview-api.js` 只通过 `connection.rpc.call` 走 Desktop carrier，支持 AbortSignal、超时、响应结构和固定诊断码检查；不能改成 global fetch，也不能占用官方 `/api` interceptor。Gateway 共存测试不等于本轮实机认证验收。
- `manual-notebook-service.js` 组合 `note-domain.js`、`tag-domain.js`、`query.js`、`markdown-export.js`、`json-backup.js` 等业务模块。`notebook-schema.js` 校验记录；`snapshot-coordinator.js` 串行提交、处理 revision/epoch 与重试收据；`host/json-store.js` 实现文件介质。
- `src/client/conversation-annotations.js`、`message-text-index.js`、`text-anchor.js` 实现正文选区/文本锚点/高亮；不能从页面 DOM 伪造官方消息 ID。来源退化时保留原文与会话快照。

## 存储与已知限制

- 默认目录：`$DSH_HOME/storages/dsh-session-notebook/`，未设置时在 `~/.dsh/storages/dsh-session-notebook/`。`storageFile` 可指定规范绝对文件路径；主文件名默认为 `notes.json`。
- 元数据文件是唯一提交点，笔记 data 文件不可变；新 data 同步后替换元数据，成功后发布内存状态。损坏/不支持的库不能按空库初始化。固定路径 sentinel 用于跨进程 fail-fast；异常退出后的残留需要离线核实，**不得在应用中自动清除或推断支持共享介质/跨设备一致性**。
- 有效元数据与引用 data 总预算 50 MiB；收据最多 100000 条、最多 16 MiB。限额不是对任意数据库规模或响应时间的承诺。
- 当前 JSON 备份可导出；`backups/begin|chunk|finish|preview|cancel` 仅提供上传、校验和影响预览，**不提供应用内提交恢复**。旧设计文件中“受控整库恢复已完成”的要求仍属未来目标。
- 当前工作区侧重单 Desktop Host；独立 Web、Desktop 重启读回、禁用后 Gateway 共存与未认证访问须按新包重新验收；详见 [根 README 的状态](../../README.md#当前状态与验收边界) 和 [开发约束](../../AGENTS.md)。

## 定位和验证

| 主题 | 主代码 | 回归入口 |
|---|---|---|
| Host 入口 / 网关 | `src/host/index.js`、`src/host/preview-routes.js` | `tests/unit/host-health.test.js`、`tests/integration/` |
| Client carrier / UI | `src/client/preview-api.js`、`src/client/index.template.js` | `tests/unit/client-health.test.js`、`tests/e2e/` |
| 文件库 / 候选提交 | `src/host/json-store.js`、`src/snapshot-coordinator.js` | `tests/unit/`、`tests/integration/` |
| 选区 / 来源高亮 | `src/client/conversation-annotations.js`、`src/client/text-anchor.js` | `tests/unit/`、Desktop 手动验收 |

历史兼容事故和测试分层另见[兼容与测试摘要](../evidence/compatibility-and-tests.md)。

基础门禁：`npm run check`、`npm test`、`npm run pack:check`、`git diff --check`。隔离业务往返另用 `npm run test:integration`；Cordis 运行时另用 `npm run test:runtime`（先为 `tests/runtime` 安装其锁定依赖）。部分单测还读取未入库的 `.sdk-reference/`：需要与目标版本匹配的包文件，不能以自写宽松 mock 替代。安装、禁用或 Desktop 实机验证不包含在这些命令里。
