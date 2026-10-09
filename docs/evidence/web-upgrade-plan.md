# 原 3080 Web 官方管理能力升级调查与回退方案

## 授权范围与结论

Round 7 用户允许调查升级与回退方案，仅限方案准备；未批准升级、安装、停服、重启或 Profile 修改。验收目标继续为独立 Web `http://127.0.0.1:3080/`，不改为 Desktop，不启动替代服务。

候选目标为官方 `@deepseek-ai/dsh@0.2.0-rc.2`，不是 latest。已通过 npm view 确认该精确版本存在、依赖同版 `@deepseek-ai/dsh-plugin-manager`。这只证明包依赖，不保证现有 web Profile 升级后管理服务实际挂载或插件兼容。

## 本轮只读证据

- `command -v dsh`：`/Users/didi_1/.nvm/versions/node/v24.19.0/bin/dsh`。
- `dsh --version`：0.1.5-rc.1。
- 官方 registry 元数据：目标 0.2.0-rc.2，dist.integrity 为 `sha512-EAJ3gPNcVt/uv8X19PMm9NkVhWgT7xXNMk0UKCVm+IQ5rpSQOcsMUa0HWlnYYVybKMsccjcRB21vVVsaXQ6IdA==`，plugin-manager 依赖固定 0.2.0-rc.2。此次 engines 查询未返回字段，不能据此保证所有 Node 版本兼容。
- 同版参考包 [manifest](<../../.sdk-reference/plugin-manager/package/package.json>) 声明许多 0.2.0-rc.2 精确 peer；不得将单个新版管理包混装旧运行时。
- 同版 [README](<../../.sdk-reference/plugin-manager/package/README.md>)：base-backed profiles 提供 manager；Web 的 Plugins 页面与 Creator 的 plugin_manager 工具提供官方操作，Settings 插件列表只读。操作影响当前 Profile 的所有会话；新安装通常默认启用，替换已加载包需要进程重启；application/warnings 才决定实际应用状态。

## Round 8：现有 Bundle 兼容核对（升级不能直接实施）

只读读取当前 Web Profile manifest：已选 base/web-app 与7个第三方 Bundle，patchReload=live，本项目仍不在选中列表。读取各安装包 manifest，未执行其代码或修改文件。

| 已安装包 | 版本 | 目标0.2.0-rc.2的声明证据 |
|---|---|---|
| dsh-context | 0.61.0 | dshReleases明确列compatible；DSH peers为>=0.1.5-rc.1。仅作者声明，不是本轮实机通过 |
| @nanmicoder/dsh-agent-teams | 0.1.17 | 多项DSH peers仅列0.1.5-rc.1及更旧精确版本，不包含目标；明确不满足目标版本范围 |
| @wxg-prc-cpg/browser-skill-dsh-plugin | 0.2.0 | DSH peers为^0.1.0-rc.6，0.x范围不覆盖0.2.0；需要兼容版本或用户决定 |
| dsh-context-doctor | 0.7.2 | dsh-tools peer为^0.1.2-rc.1，不覆盖0.2.0 |
| @xmanrui/dsh-im | 4.20.2 | 自声明compatibility只列旧0.1.x；不代表官方peer检查拒绝，但目标实际兼容未知 |
| @zilliz/memsearch-dsh | 0.1.4 | dsh-llm peer为*，不构成版本限制；实际兼容未知 |
| dsh-session-notes | 1.0.1 | 未声明DSH peers，不构成版本限制；实际兼容未知，且不是本项目 |

目标官方 [app-boot README](<https://unpkg.com/@deepseek-ai/dsh-app-boot@0.2.0-rc.2/README.md>) 明确启动时检查所有声明的DSH peer范围（包括prerelease）；不兼容Bundle被跳过，配置列表保留但功能可能缺失。无peer不代表功能兼容，optional peer也不能自动视为允许不兼容。不能在已有三个明确范围冲突的情况下宣称升级安全。

同一官方文档还说明：profile加载会清理旧link backend的`.dsh-module-fallback`投影；这表明新版启动可能触及文件系统，不是只替换CLI的纯内存操作。文档的sanitizeProfile是配置恢复（移动patch、重设bundle列表），不是用户数据备份/迁移回滚协议，本项目不得未经授权调用它。

因此本轮不提供“一条升级命令”。下一步先选择：调查这三个包的目标兼容版本（再独立授权包更新），或明确允许目标运行时不加载它们（仍需对应官方管理方式及回退验证）。不得自动删除/禁用它们，也不得默认授予崩溃/数据丢失风险豁免。用户数据介质与备份恢复路径尚未核实，仍不实施升级。

## Round 9：冲突包候选版本调查

通过只读npm view查询，未下载/安装/执行候选包：

- `@nanmicoder/dsh-agent-teams@0.1.22`：返回的全部DSH peer范围明确包含`0.2.0-rc.2`，可作为后续审核候选；不是已实测兼容。
- `@wxg-prc-cpg/browser-skill-dsh-plugin@0.3.2`：返回的DSH peer范围为`^0.1.5-rc.3 || ^0.2.0-rc.1`，目标rc.2在0.2.0 prerelease范围内；仍须正式manager兼容检查和实机验收。
- `dsh-context-doctor` npm查询返回E404，后台bash-122已收集、退出码1。调查现有Profile声明的Git来源后，[main manifest](<https://raw.githubusercontent.com/Zhenyu98/dsh-context-doctor/main/package.json>) HTTP200，仍是0.7.2/private=true、dsh-tools peer=`^0.1.2-rc.1`，没有发现可直接采用的目标兼容声明。main是可变引用，不作为固定可发布候选。

候选只是当前查询返回的精确版本，实施时必须再查该精确版本及integrity，不能使用latest滚动安装。Context Doctor仍是确定的范围冲突，不能默认更新、删除、禁用、修改第三方peer或授予版本豁免。需要用户决定是否允许在目标Web不加载它，或者提供官方兼容固定版本。备份恢复前置条件仍独立存在。

## 实施前必须补齐（尚未完成）

1. 确认原服务的启动终端/管理方式、工作目录、Profile=web 与原启动参数；只记录脱敏字段，不输出环境变量或含 token 的入口。保留原 host/port/trust 配置，不扩大信任范围。
2. 确认现有 Profile 的官方升级/迁移与数据备份恢复办法。备份必须涵盖会受升级影响的 Profile 配置、锁文件和实际存储介质，不假定只回退 CLI 就能回退数据。备份路径含潜在秘密，不能交付或读取其内容。需要写工作区外备份时另获授权。
3. 只读核对现有 bundles 对目标 runtime 的 peer 兼容性，以及目标 CLI 的 base profile 启动机制。现有其他插件不得未经批准禁用或删除；不申请版本豁免来掩盖兼容失败。
4. 准备隔离的目标 CLI 安装位置和旧 CLI 保留方式，避免默认覆盖全局 dsh。安装运行脚本、全局工具或工作区外操作均需单独批准。当前不提供未经核实的实际安装/迁移命令。
5. 提交精确实施范围和回退触发点给用户确认；当前方案许可不等于实施许可。

## 授权后建议实施顺序（不是已执行结果）

1. 等待正在执行的会话完成，由用户正常停止原3080服务；不 kill Host、不同时启动两个服务。
2. 完成已核实且获批准的备份，再使用隔离的精确新版CLI按原配置启动同一个3080入口。首次启动不混装管理包、不修改Notebook传输、不沿用未知的迁移假设。
3. 用户通过新进程提供的官方入口正常登录，保持单标签页验收。先确认版本、启动日志没有新FAILED条目，官方 settings/describe重复200；管理服务和Creator工具确实可用。
4. 由该Web Host的官方 plugin_manager执行本工作区Bundle安装；当前Desktop工具不能代操作。先列出准确标识，确认安装权限后读取application/warnings。新安装可能默认启用，需明确该行为；需要重启则由用户正常操作。
5. 使用工作区已有三份Web浏览器检查验证版本、生产RPC、非法请求、尺寸；补深浅主题和认证。停止使用启动覆盖前确认正式Bundle已实际提供Client/Host，避免覆盖层使禁用测试成为假通过。
6. 用户另行授权后，测试正式Notebook禁用/启用两轮：官方Gateway保持工作，Notebook路由/入口/监听器释放，再启用唯一入口。失败保留或恢复安全禁用状态，并记录官方返回状态。

## 回退触发与限制

发生新的启动失败、Gateway非200、认证绕过、兼容拒绝或管理服务缺失，停止继续安装/启用。由用户正常停止测试后的原服务，恢复旧CLI的原启动方式。若已执行配置或数据迁移，必须使用事先核实的对应恢复程序，不直接用旧CLI打开新版介质。不能手改Profile清理新版条目、删插件数据或未经授权撤销其他插件变更。

回退后核对旧0.1.5-rc.1、原3080页面、官方Gateway、既有功能及用户数据；Notebook需要恢复此前的启动覆盖时保留原patch参数，不把回退运行算正式安装。若未取得备份/迁移恢复证据，不实施升级。

## Round 9 用户决策：必须保留全部插件能力

用户明确选择“必须保留全部插件能力”。因此不采纳暂不加载Context Doctor的方案；不得因启动自动跳过不兼容包而声称满足用户要求。当前没有已核实的Context Doctor目标兼容固定版本，升级方案不具备实施条件。不得自动禁用/删除、改peer或风险豁免，也不将旧版启动覆盖误算正式安装。

允许继续只读查找固定兼容版本及官方旧版管理替代路径，但若没有新证据，不重复安装/升级尝试。必须保持原3080及全部现有插件能力。Step1/2门禁未关闭，Step3产品写入不开展。

## Round 10：固定发行与旧 CLI 管理实现核实

- [Context Doctor tags](<https://api.github.com/repos/Zhenyu98/dsh-context-doctor/tags?per_page=100>) 返回 v0.6.1、v0.2.0、untagged-373005105c4eac2e526e；该查询未发现更新目标兼容发行。
- [releases](<https://api.github.com/repos/Zhenyu98/dsh-context-doctor/releases?per_page=100>) 只有标题“v0.7.2 — 兼容 DSH 0.1.2”的发行，无assets。其正文声称>=0.1.2不覆盖manifest旧peer范围的约束；不能用发行文字替代目标启动检查。当前没有已核实目标兼容固定版本，亦不声称穷尽所有未发布commit/branch。
- 只读读取当前CLI实际 [参数入口](</Users/didi_1/.nvm/versions/node/v24.19.0/lib/node_modules/@deepseek-ai/dsh/lib/bin.js>) 与 [plugin实现](</Users/didi_1/.nvm/versions/node/v24.19.0/lib/node_modules/@deepseek-ai/dsh/lib/plugin-Ddi42qoW.js>)：plugin命令通过spawnSync('pnpm', ...)且cwd为Profile，再writeProfileManifest调整bundle列表。它确实是旧版官方入口，但行为就是Profile内包管理器转发，不是新版plugin_manager机制，不符合本仓库AGENTS现有部署约束。本轮未执行它。

结论：已调查的旧CLI入口与固定发行仍不能同时满足“保留全部已有插件能力 + plugin_manager正式部署 + 不手改/不在Profile跑包管理器”的约束。该具体限制已持续多轮；保持运行不变，不无休止重复正常Web验收。下一步需要用户提供目标兼容固定版本，或明确修改部署约束/实施范围；Agent不能自行修改AGENTS放行，更不能让技术调查变成替代升级任务。

## 当前状态

仅完成精确目标版本与官方管理能力的资料核对。现有3080、Profile、Notebook与Desktop均未更改，目标仍active；Step1/2持久安装和生命周期门禁尚未关闭，未进入Step3存储写入。
