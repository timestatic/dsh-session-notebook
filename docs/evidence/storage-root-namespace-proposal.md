# 专用存储根与命名空间方案（候选，未获部署批准）

状态：PROPOSED；目标：Desktop Step 3 的隔离实验 Bundle，不是生产保存配置。目标接口来源：2026-10-04 当前 Host Inspect `Service.storage` 与 `Service.storageDomain`，并核对同版 `@deepseek-ai/dsh-storage{,-domain,-json}@0.2.0-rc.2` 的工作区固定依赖实现。未执行 Host 业务 Service 调用、安装或 Profile 写入。

## 唯一所有者与命名

| 资源 | 候选所有者和规则 | 禁止事项 |
|---|---|---|
| 测试介质根 | 唯一显式 `root` 配置；操作前用户选择并单独批准该私有专用根。不得默认为 cwd、Profile、用户主目录或系统 temp。缺失、别名、符号链接、权限过宽均拒绝激活；不自动 mkdir/chmod/migrate。当前 `checkedTestRoot` **只能**验证工作区合成介质，不可直接升格为生产 root 校验。 | 根据 Host 配置猜真实Notebook路径、扫描其他插件目录、后台创建永久根。 |
| backend registry | 独立名字（实验建议 `notebook_probe_v1`），仅自有 Context effect 注册和注销；独立 service key `storage.backend.notebook_probe_v1` 确保依赖激活顺序。相同名字已占用就拒绝；不向 `json` 注册第二个backend。 | 调用官方 `dsh-storage-json.apply()`，覆盖官方 `json`，把实验 backend 注入默认域的路由。 |
| Domain | 自有 `DomainFacility`、唯一固定实验 domain 名（建议 `notebook_probe_v1`），不调用/挂载宿主默认 `storageDomain` 或 `ctx.storage.mount('domain', ...)`。Handle 由自身关闭，随后backend关闭/注销。 | 替换官方 DomainFacility 服务、迁移或打开用户真实 Notebook Domain。 |
| worker | 完整 Context/SDK/队列与介质归同一 worker；父只发送有界命令和接收有界 DTO；异常/超时不热删锁，启动未 READY 不宣称可写。 | 把完整Snapshot跨线程clone、主线程保留另一权威副本或自动PID/TTL抢锁。 |

当前 Inspect：storage.backend.register/get/names 是命名registry，`storageDomain.open` 的backend路由由其 Config 指定；它自己的 facility 只防同实例相同domain重复打开，不是跨Host排他。固定SDK `BackendRegistry.register` 对重复名字报 `duplicate-backend`；`JsonStorageBackend.apply`固定注册 `json`；DomainFacility 使用 `config.routes?.[spec.name] ?? config.backend` 选路，默认插件挂载 form/key。真实SDK [注册表共存测试](<../../tests/runtime/storage-lifecycle.test.js>)验证独立 backend 与既有 `json` 两轮并存、不挂载默认 Domain，重复 `json` 被拒绝；只是隔离测试 Context，未在宿主安装。

## 根目录准入设计与运行限制

部署候选 Config 只能提供单个显式绝对路径，不存默认值；展示前不回传 root 字符串到 Client/diagnostics。进入任何SDK/worker创建前校验：路径为规范绝对路径，预先存在普通私有目录，基目录及最终目录权限与运行UID属主一致、真实路径一致；禁止symlink/父级不可信目录、重复共享介质、网络文件系统（若不能证明锁+fsync语义，则拒绝）。当前**仅测试根**已校验工作区基目录与直接子目录皆0700且UID相符，拒绝外部属主/宽权限（纯谓词负例）；更上层workspace父级和实际生产介质仍未验证。对同 UID 恶意修改与路径替换，单次 lstat/realpath 不是充分防护；设计应评估目录fd-relative + `O_NOFOLLOW`/inode及跨平台可用性。不能提供安全绑定时暂不写入，需用户批准其他正式存储能力，而不是放宽校验。

**新增明确阻断：**[释放同步故障测试](<../../tests/unit/medium-guard.test.js>)复现测试守卫先`unlink(lock)`，后`syncDirectory('release')`失败，此时失败已返回但新的写者可以`wx`拿锁；原实现不能在此路径证明“错误=仍排他”。生产设计不得直接提升该守卫，必须定义销毁前停写、代际与锁交换/离线恢复语义，完成sync/崩溃矩阵，并防旧worker与新writer交叠；绝不能声称把`fsync`简单移到`unlink`前即可保证unlink持久。测试只揭示缺口，未对用户锁执行恢复。

根身份必须在 Host 生命周期重新核验；首次启用和重启两次实验中根保持不变。同介质多写者必须由 `wx` 残留锁拒绝；损坏/未知版本/失败恢复须先保护原字节并保持停写。启动失败与停止失败仍不得让父以 exit0 或前端连接状态判断解锁。上限、恢复预算与离线工具没有获准，完整产品样本约219.3MiB，测试256MiB保护预算不是产品配置。

## 路线B与现有Storage ABI的交接评估（Goal Round53）

用户选研究可自动交接路线，未授权安装或真实Desktop启停。当前Host只读`Service`目录中与介质有关的是`storage`和`storageDomain`（另有文件上传/引用服务，未作为通用锁使用）；精确Inspect声明`storage.backend.register/get/names`、`KvFacet.open`、`KvUnit.loadAll/setGlobal/close`和`storageDomain.open/get/closeAll`，**不声明跨进程锁、原子代际CAS、受条件保护的publish或根fd能力**。这只界定当前可见公开合同，不证明宿主内部或另经批准的扩展永无可用能力。

同版本`dsh-storage-json`实现`setGlobal`调用`writeAtomic(path,data)`，先写tmp并sync，再`rename(tmp,path)`覆盖，再sync目录；[测试竞争反例](<../../tests/unit/fence-check-window.test.js>)证明在`rename`前单读代际仍可被旧写者超越。即使独立插件自行命名backend并注入自有Domain，**仍需backend在发布动作处具有跨进程原子所有权/栅栏能力**；在Domain调用前检查、`ctx.effect`关闭、worker父侧gate或FileHandle无内建lock均不能替代。若引入宿主支持或经批准的外部能力，还须证明跨进程一致性、根fd绑定、SIGKILL/ENOSPC/掉电与目标平台矩阵；不能调用默认`json`或替换官方Storage服务来抢所有权。当前不启动可安装实验Bundle。

## 下一门禁与授权

### 与第一版 MVP 的存储决定（2026-10-06）

本页的路线 B 是历史隔离实验方案，不能作为 [FIRST_MVP_PLAN](../FIRST_MVP_PLAN.md) A/D 正式写入的默认实现。计划明确停止新增自建 backend、锁文件和 worker。本轮复核目标 `dsh-storage-domain` 与 `dsh-storage-json` 0.2.0-rc.2 后，正式接入仍有三个独立门禁：

1. **真实缺库判定。** `openSingleUnit` 把文件不存在和已有文件中 `global` 为 null 等状态交给上层的同一个 null；`DomainFacility.open` 把 null 映射为 `initial`。公开 Domain 读值无法证明介质确实不存在，因此不能据此写入初始 Snapshot。
2. **原始介质保护。** 公开 `backupRecord` 仅服务逐条记录布局；没有整份介质原始字节保护合同。严格校验 JSON 备份和保存旧库的业务 Snapshot，均不能代替 FR-104A 对原始坏介质的保护。
3. **唯一写者与发布栅栏。** Domain 同实例的打开限制不是跨进程排他。目标 JSON backend 在原子替换前没有公开的跨进程条件发布操作；旧 Host 与新 Host 交叠时，单次代际检查不能保证后写者获胜。

如果用户批准研究受限原始介质适配器，它最多先解决第 1、2 项；**该批准不自动解决第 3 项，也不授权替换默认 backend、安装插件或打开正式写路由**。适配器须先在隔离根证明介质路径绑定、缺失与已有 null 的区分、原始字节保护和故障清理。第 3 项仍须目标宿主提供可验证的单 Host 生命周期或受条件保护的写入能力，并经真实 Desktop 验收。若继续只用公开 SDK，应等到这些合同可用；两种选择均保持正式 Host 只读，直到三项门禁全部闭合。

1. 在不接 Host 的隔离 Context 已证明专用registry名与`json`共存；[测试配置原型](<../../tests/fixtures/experiment-config.js>)进一步只允许单个显式`root`且按工作区私有根规则校验，固定 `notebook_probe_v1` backend/domain，拒绝缺失/额外/别名/getter，不在根内mkdir或写介质。**它不是Cordis插件导出的Config schema，也不验证实际Host service key生命周期**；部署前还需真实独立Context完整装配与正式Config语义审查、用户先选/批准私有根，再设计稳定映射。
2. 若形成独立实验 Bundle：Host-only、无 Client/路由/Tool、只固定 synthetic 样本、默认禁用，无安装前写入；原生产 Notebook 包保持0.0.12无保存。所有打开、清理和异常模式在隔离测试先过。
3. **安装、启用/禁用、重启、实验根创建/选定、移除**各自取得明确授权；通过官方 Plugin Manager，记录 application/warnings，失败保持安全停写。用户已明确暂不授权再次 Desktop 禁用/恢复，不能拿这份文档当作许可。
4. Step 0–2 当前 Desktop 路由/认证与内部监听器验收仍开放；不得以本地 SDK 测试或其他 Web 页替代。存储 ADR 仍 PROPOSED，Step 4 保存UI不启动。
