# Session Notebook Agent 开发约束

本文件适用于整个仓库。目标：插件升级不得破坏 DeepSeek Harness 官方能力，尤其是 Desktop 启动、API Gateway、认证和连接生命周期。

## 1. 禁止占用宿主共享资源（硬性规则）

- **禁止注册 `ctx.connection.rpc.intercept('/api', ...)`，即使 matcher 只匹配 Notebook 端点。** `/api` 共享拦截器由官方 API Gateway 管理；精确 matcher 不代表可安全注册第二个拦截器。
- 禁止通过 `rpc.handle('/api', ...)`、泛匹配 HTTP 路由、fallback 或其他方式替换/抢占官方 `/api`、Remote 或 WebSocket 入口。
- Notebook 通过 `connection.fetch.register` 注册精确 `/api/dsh-session-notebook/health` 和 `/api/dsh-session-notebook/list` GET/POST 路由。POST 必须验证标准 RPC 信封并返回匹配 rpcId 的响应；Client 用 `rpc.call('/api', 'dsh-session-notebook/health', ...)`，不得安装 shared interceptor。
- 正式业务路由由 `src/host/manual-runtime.js` 调用 `src/host/preview-routes.js` 注册为 `/api/dsh-session-notebook/<业务端点>` 的精确 POST 路由。每条路由都必须复用宿主公开 admission、校验 RPC 信封，并由宿主生命周期释放；不得将旧的“仅 health/list”记录当作当前完整路由清单。
- 精确 Notebook POST 路由不得扩展到官方端点或前缀通配。当前宿主 `rpc.handle` 存在内部上下文依赖访问失败，禁止以增加调用者 inject 或宽松 mock 宣称解决；切换正式机制须实机验证。
- 其他共享资源同样遵守唯一所有者原则：不得替换宿主 Context 服务、启动第二套连接循环、接管应用根节点或覆盖其他插件注册项。

## 2. 修改前必须核对真实 API 契约

- 在设计或修改 Harness 插件前加载 `cordis-plugin-development` skill（环境提供时），先调用 `cordis_inspect_list`，再针对所用 Service/Event/Config/Slot 查询精确契约。
- 记录目标 Harness 版本和证据来源。Inspect 不可用时，读取该版本已安装包的 README、类型声明或工作区 SDK 参考；不得凭名称、历史实现或不同版本文档猜 API。
- 区分“类型签名允许调用”与“资源允许多重注册”。检查通道/拦截器的所有权、覆盖行为、加载顺序、清理行为及认证边界；不明确时停止扩展该共享资源。
- 独立通道还必须验证实现级语法限制；目标 SDK 的 channel 只接受单段 `/name`，不得使用 `/rpc/name`。使用参考 SDK 的真实校验函数做回归，不能仅以 `channel: string` 类型或自写 permissive mock 证明兼容。
- 核对 Service 内部上下文与调用者上下文的区别；普通对象 mock 不代表 Cordis 注入权限已通过。0.0.11 的 webServer 注入修复实机失败，不得复用。
- Inspect 方法只用于只读发现，不能当作插件业务 Service 调用。
- 通信修改必须一起核对 Host、Client、测试模拟器和 Desktop/Web carrier，不得只修改一端。

## 3. 保持 Desktop 传输与安全边界

- Client RPC 必须走 `ctx.connection.rpc.call`，不能为了连接成功改用 global `fetch('/api/...')` 绕过 Desktop carrier。
- 禁止读取或硬编码页面 token、cookie、内部全局传输对象、Host origin 和固定端口；不自行拼接 Desktop 认证请求。
- 所有独立通道与 GET 路由必须继承宿主的认证和信任校验。新增业务权限时必须显式实现，不得以独立命名空间代替访问控制。
- 参数、成功响应和未知端点均须验证；界面只显示固定安全诊断码，不泄露异常原文、路径、凭据或服务器内部信息。
- 所有注册由 `ctx.effect`/宿主生命周期持有 disposer；组件请求支持 AbortSignal、超时和卸载取消，卸载后不得继续更新状态。

## 4. 通信修改的强制回归测试

不能只验证 Notebook 自己返回成功。至少覆盖：

1. **共享资源守卫**：测试中调用 `rpc.intercept` 或注册保留通道立即失败。
2. **真实业务 handler 往返**：Client 使用正确独立通道和端点，调用实际 Host handler；global fetch 若被调用立即失败。
3. **官方 Gateway 共存**：模拟已注册的 `/api` Gateway，在 Notebook 启用前、启用后、卸载后，检查 `settings/describe` 的 handler 身份及返回值保持不变。涉及加载顺序时测试不同顺序。
4. **生命周期**：至少两轮加载/卸载；独立 RPC、GET 路由和监听器无泄漏，官方 Gateway 不被清理。
5. **失败分支**：未知端点、非法参数、取消、超时、认证失败、畸形成功响应和卸载后迟到响应。

测试模拟器不得偷偷把生产 POST RPC 改成 GET 后，声称已验证实际 RPC transport。GET 路由测试与独立 RPC handler 测试要分开表述；模拟 Gateway 共存不等于真实宿主共存。

## 5. 提交与发布门禁

每次修改后执行：

```bash
npm run check
npm test
npm run pack:check
git diff --check
```

- 检查退出码；失败必须解释和处理，不能忽略。npm 默认缓存无权限时可使用可写临时缓存；不得自行 sudo/chown 全局缓存。
- 更新包版本时同步 Client 可见版本，并确认打包包含 Host/Client、patch 与必要元数据。通道或协议变化必须同时更新测试与修复记录。
- 不覆盖或撤销用户已有改动。源码修改权限不等于安装、启用、重启或修改 Profile 的权限。
- 部署通过 `plugin_manager` 完成，按权限政策取得批准；不得手工改 Profile 的 package.json/patch、在 Profile 内运行包管理器或删除插件数据。
- 根据安装结果的 application/warnings 判断应用状态。替换已加载包通常需完整退出 Desktop 后重开；不得凭源码文件变化声称运行时已更新。

## 6. 真实运行时验收与结论边界

任何 Host 通道/路由/认证变更在宣称“Desktop 已修复”前必须取得真实证据：

- Desktop welcome 启动正常；**`POST /api/settings/describe` 返回 200**，启动后分时重复读取不回归。
- Notebook 显示预期版本；health/list 通过独立 RPC 通道返回正确结构，连接状态正确。
- 插件禁用后官方 Gateway 仍工作；Web 与 Desktop 分别验收。
- 确认未认证访问仍被宿主拒绝，不能通过新增路径绕过认证。
- 验收涉及重启、启用/禁用或用户状态变更时先取得授权，并恢复可恢复的测试状态。

没有真实 Desktop/浏览器访问能力时，只能报告“源码修复 / 本地测试通过 / 待运行时验收”。必须分开报告源码、打包、安装、启用、重启与实际通信状态；不得把模拟测试、注册成功或用户之前的结果当成本次真实 HTTP 验证。验收失败时保持或恢复安全的禁用状态，并报告具体阻塞证据。

## 7. 事故记录与按需参考

- 当前通道冲突修复及验收清单：`docs/evidence/api-gateway-conflict-fix.md`。
- 旧通信方案（仅历史背景，**其中共享 /api interceptor 方案已失效，不得复用**）：`docs/evidence/desktop-carrier-fix.md`。
- 当前 Host/Client：`src/host/index.js`、`src/client/index.js`。
- 通信回归测试：`tests/unit/host-health.test.js`、`tests/unit/client-health.test.js`。

发生新兼容性事故时，补充“宿主版本 → 真实现象 → 根因 → 旧测试盲区 → 最小修复 → 自动回归 → 真实验收状态”，并将防复发规则保持在本文件。历史修复文档应标注被替代的方案，避免再次引入同一问题。

## 8. 测试产物与磁盘空间（硬性规则）

- `.storage-test-output/` 只用于隔离测试，不是用户数据或长期证据仓库。测试创建的 `candidate-*`、`stream-*`、`capacity-*` 等临时目录，必须由创建它的用例在成功和失败路径中清理；大文件、保护副本和基准样本尤其不得留给下次运行。需要保留故障现场时，只保留明确命名、受限大小的必要证据，并说明清理方式。
- 禁止把反复运行测试产生的目录当作无成本输出。新增或修改落盘测试时，核对 `finally` 清理、临时目录路径约束、单次和重复运行后的磁盘占用；压测或大样本基准不得无上限自动累积，计划暂缓的性能专项不得混入日常门禁来制造大量产物。
- 曾因测试未清理而在 `.storage-test-output/` 累积约 9,799 个顶层目录、76 GB 数据。修复不能只删除一次产物：还须修复生成它们的测试，重新运行定向测试，并确认残留目录和磁盘占用。2026-10-05 已清理该目录，相关高频与大文件用例已加入运行后清理；其他用例若仍留少量产物，也须逐步按此规则收敛。
- **删除前先核实**解析后的绝对路径恰为本仓库 `.storage-test-output/`、目标不是符号链接、内容属于测试输出且没有活动写入；不要对未核实的计算路径或可能包含用户数据的目录执行递归删除。清理整目录须有用户明确授权；删除后检查结果。不得触碰 Desktop/Profile 存储介质。

## 9. 打包、分发与安装流程（唯一权威路径）

本节是本项目作为 DeepSeek Harness（DSH）插件的打包与安装权威说明。任何“如何发布/安装”的回答都必须与此一致，不得虚构 npm 发布、私有 registry 或手工 Profile 步骤。

### 9.1 产物形态与构建

- 插件是**常驻 npm Bundle**：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，`dsh.client` 声明 `platform: web`、`immediately: true` 与 `inject` 激活依赖；Host 入口 `src/host/index.js`，Client 入口 `src/client/index.js`。
- **直接发布 JS 源码，无编译/lint/typecheck 步骤。** Client 由 `scripts/build-client.mjs` 从 `src/client/index.template.js` 内联生成 `src/client/index.js`（把 `preview-api`、`manual-save-controller`、schema、备份、锚点等 ESM 模块拼进模板 marker）。改模板或任一被内联模块后必须重新生成，`npm run check` 会用 `--check` 校验产物与模板一致（不一致报 `CLIENT_BUNDLE_STALE`）。
- `package.json` 的 `files` 白名单决定入包内容，只含 Host/Client 源码、`locale/*.json`、`icon.svg`、`cordis.patch.yml`、`README.md`。测试、`docs/`、`.sdk-reference/`、诊断与测试产物**不入包**（见 `.gitignore`）。

### 9.2 打包命令

```bash
npm run check        # 生成/校验 Client 产物 + 全部发布入口语法检查
npm test             # 单元测试（node:test）
npm run pack:check   # npm pack --dry-run --ignore-scripts，核对 tarball 清单
npm pack --ignore-scripts   # 生成可分发 timestatic-dsh-session-notebook-<version>.tgz
git diff --check
```

- 发布前逐项检查退出码（§5 门禁）。`pack:check` 只核对清单，不安装。
- 打 `.tgz` 前确认版本号已在 `package.json`、`src/client/index.template.js` 的 `version` 常量、生成后的 `src/client/index.js` 与 `README.md` **四处同步**（§5）。
- `--ignore-scripts` 必带，避免在打包/安装阶段执行生命周期脚本。
- npm 默认缓存无权限时用可写临时 `npm_config_cache`，不得 sudo/chown 全局缓存。

### 9.3 发布到 npm registry

- npm 发布名为作用域形式 **`@timestatic/dsh-session-notebook`**；`package.json` 已含 `publishConfig.access: public`（作用域包默认 restricted，缺它 `npm publish` 失败）。裸 `timestatic/dsh-session-notebook` **不是合法 npm 名**：plugin-manager 的 `PACKAGE_NAME` 正则 `^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$` 只接受可选 `@scope/` 前缀加单段名，中段 `/` 会被 `parseInstallSpec` 判为 `not a package name the registry accepts`。
- **改名耦合（硬性）**：以下标识符必须等于 npm 包名（作用域包用作用域全名 `@timestatic/dsh-session-notebook`），改包名必须同步改，否则解析失败：
  - `cordis.patch.yml` 的 bundle row `name`——Cordis 加载 Host 的模块标识符，plugin-manager 按包名解析 bundle（`bundleManifest`）。
  - Client 模块加载 id——`src/client/index.template.js` 顶部 `window.__ModuleLoader__.load({ id })` 及其生成产物 `src/client/index.js`。这是 Host 解析 Client factory 的模块标识符，**约定为 id === 包名**：官方 `@deepseek-ai/dsh-client-ui-settings`、`@deepseek-ai/dsh-client-ui-chat` 及已安装的第三方作用域插件（`@zilliz/memsearch-dsh`、`@nanmicoder/dsh-agent-teams`、`@wxg-prc-cpg/browser-skill-dsh-plugin`、`@xmanrui/dsh-im`）均用作用域全名，裸名插件（`dsh-context` 等）用裸名。改名后若把 id 留成非作用域会与包名 mismatch。
  - `package-lock.json` 顶层与 `packages[""]` 的 `name`；断言包名的测试（`tests/unit/loading.test.js`，含 `definition.id === manifest.name`）也需同步。
- **内部标识不随包名变（硬性）**：locale/RPC `namespace`、slot id 前缀、Host 存储目录 `storages/dsh-session-notebook/`、API 路由前缀 `/api/dsh-session-notebook/` 保持非作用域 `dsh-session-notebook`。RPC 方法名是单段 `dsh-session-notebook/<endpoint>`（见 §1、§2 通道语法约束），改成含 `@`/`/` 的作用域形式会破坏通道契约；改存储目录会孤立既有用户数据。改包名时**不得**顺手改这些内部标识（注意与上一条的 Client 模块加载 id 区分：那个必须等于包名，这些必须保持非作用域）。
- 发布是外部不可逆动作（同版本号不能重发），需授权后由用户执行；不得代用户 `npm publish`。显式指定目标 registry，避免默认配置指向镜像。`npm view` 返回 404 只能说明该 registry 未找到版本或当前身份无访问权限，不能证明发布权限：

```bash
npm view @timestatic/dsh-session-notebook@0.0.36 version --registry=https://registry.npmjs.org
npm login --registry=https://registry.npmjs.org     # 核对 @timestatic 的发布权限
npm publish --dry-run --ignore-scripts --registry=https://registry.npmjs.org
# 核对内容、版本、账户与单独授权后由用户执行：
npm publish --ignore-scripts --registry=https://registry.npmjs.org
```

- 安装 spec：`dsh plugin --profile <profile> add @timestatic/dsh-session-notebook@<version>`；也支持绝对路径、git（`github:timestatic/dsh-session-notebook`）与 tarball。registry 解析经 `pnpm view`，顺序为 `options.registry` → 配置 `registry` → `fallbackRegistries`（默认含 `https://registry.npmmirror.com/`）。
- 可选：声明 DSH runtime `peerDependencies` 以启用 plugin-manager 安装前的兼容性检查；但 peer 包名与版本范围必须用已核实的真实值，不得臆造（§2）。当前仓库尚未取得确切 peer 依赖对，暂不声明。

### 9.4 安装 / 启用 / 卸载（仅通过官方 plugin_manager）

安装、启用、禁用、重启、Profile 变更都是**需单独授权**的动作（§5、§6）。取得授权后：

1. `list_bundles` 确认当前 Profile 已装版本与 `enabled` 状态，核对唯一目标 Profile。
2. `install_bundle` 安装工作区本地 `.tgz` 或指定 registry（历史用 `https://registry.npmjs.org`）；**不得传空 registry 字符串**（会 `application=failed`）。
3. 读取返回的 `packageResult.exitCode`、`changed`、`application`、`warnings`：`restart-required` 必须完整退出 Desktop 再重开；`applied` 才可继续。peer dependency warning 不得当作兼容性通过或擅自设版本豁免。
4. `set_bundle enabled=true/false` 切换启用；读取 `changed`/`application`/`warnings`。
5. 再次 `list_bundles` 核实版本、`installed`、`enabled`；不得凭源码文件变化声称运行时已更新。

**硬性禁止**：手工编辑 Profile 的 `package.json`/`cordis.patch.yml`、在 Profile 内运行 pnpm/npm、删除插件数据、启动第二套宿主、用假端点或手改 bundles 绕过管理器。旧 Web（如 3080，DSH 0.1.5-rc.1）可能未挂载管理 Remote（`/api/pluginManager/listBundles` 返回 404），此时**不得**改用手工 Profile 或旧 CLI pnpm 转发；只能在具备官方管理工具的 Host 上安装，或如实报告“无满足约束的持久安装入口”。

### 9.5 安装后验收边界

安装成功（exitCode 0 / Slot 注册成功）**不等于**功能通过。宣称任何端“已安装可用”前，必须按 §6 取得真实运行时证据：Desktop welcome 正常、`POST /api/settings/describe` 200、Notebook 显示预期版本、health/list 经独立 RPC 通道返回正确结构、禁用后官方 Gateway 仍工作、未认证访问仍被拒绝。无真实 Desktop/浏览器访问能力时，只能报告“源码 / 打包 / 本地测试通过，待运行时验收”，并分项标注安装、启用、重启、实际通信状态（未操作项填 NOT RUN）。
