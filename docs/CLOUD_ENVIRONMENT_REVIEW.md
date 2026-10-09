# 云端开发环境配置与检查审核

日期：2026-10-05（Asia/Shanghai）。状态：配置草案及本机检查完成，尚未在云端运行或发布。

本次执行环境是 macOS / Darwin arm64。当前会话没有云端环境配置接口，目标云端平台尚未确认。以下配置面向具备 Bash、Node.js、npm、tar、Git 的隔离 Linux 工作区；Linux 兼容性须在实际环境重新验证。

## 已读取的项目要求

- 根目录 `AGENTS.md`、`package.json` 和 `tests/runtime/package-lock.json`。
- 项目为 ESM，版本 `0.0.15`，要求 Node.js `>=22`。
- 根目录没有外部 dependencies / devDependencies，初始没有锁文件。
- 独立 runtime 测试有 npm v3 锁文件，锁定 9 个包。安装源写在锁文件中，为 `registry.npmmirror.com`。
- `.agents/skills/typescript-node-standards/SKILL.md` 含另一个 TypeScript 项目的依赖及构建说明；本项目实际为 JavaScript，未声明该文档所述 lint/typecheck/build 脚本。配置以本项目 package.json 和 AGENTS.md 为准，不添加这些依赖或脚本。

## 安装配置

| 配置 | 审核候选值 | 依据 |
| --- | --- | --- |
| Node.js | `24.19.0`，见根目录 `.nvmrc` | 满足 `>=22`，本次实际检查所用版本 |
| npm | `11.17.0` | 本次实际使用的版本；云端应核对一致性 |
| 根目录安装 | `npm ci --ignore-scripts --no-audit --no-fund` | 新增根锁文件，由 npm install 生成，再以 npm ci 验证 |
| runtime 测试依赖 | `npm ci --prefix tests/runtime --ignore-scripts --no-audit --no-fund` | 使用现有锁文件，不重写依赖版本 |
| npm cache | 工作区外独立临时目录 | 不修改全局缓存权限，不使用 sudo/chown |
| 服务端口、凭据 | 四项检查均不需要 | 不启动 Desktop、Profile 或业务服务 |

`--ignore-scripts` 用于依赖安装；之后仍显式运行项目指定的检查脚本。仅执行根目录 npm ci 不会安装 tests/runtime 的依赖。

在已有 nvm 的云端镜像中，先执行 `nvm install` 和 `nvm use`，读取根目录 `.nvmrc`。核对 `node --version` 为 `v24.19.0`、`npm --version` 为 `11.17.0`。若镜像没有 nvm，使用平台提供的 Node.js 版本配置，不能把 nvm 当成项目已安装依赖。

准备一个本次环境专用的缓存，再安装：

```bash
export npm_config_cache="$(mktemp -d "${TMPDIR:-/tmp}/dsh-notebook-npm.XXXXXX")"
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix tests/runtime --ignore-scripts --no-audit --no-fund
```

实际云端初始化前，需要允许 npm 镜像的下载访问。Node.js 安装器所需网络由所选镜像决定。不要把本机缓存、登录态、Desktop Profile 或 token 上传到环境。

## 单元测试的额外输入

`npm test` 会直接读取 `.sdk-reference/`。该目录被 Git 忽略，npm ci 不会创建它。干净云端检出必须额外准备以下公开包的原始源码。此步骤仅提供测试参考文件，不向 Harness 安装插件。

| 参考目录 | npm 包 | 版本 |
| --- | --- | --- |
| `connection` | `@deepseek-ai/dsh-client-connection` | `0.2.0-rc.2` |
| `cordis` | `@deepseek-ai/cordis` | `4.0.4` |
| `storage-json` | `@deepseek-ai/dsh-storage-json` | `0.2.0-rc.2` |
| `storage-domain` | `@deepseek-ai/dsh-storage-domain` | `0.2.0-rc.2` |

以下步骤仅用于新建的隔离工作区。已有 `.sdk-reference/` 时先核对，不能覆盖其他工作保存的证据。

```bash
set -e
test ! -e .sdk-reference
sdk_download_dir="$(mktemp -d "${TMPDIR:-/tmp}/dsh-notebook-sdk.XXXXXX")"
npm pack \
  @deepseek-ai/dsh-client-connection@0.2.0-rc.2 \
  @deepseek-ai/cordis@4.0.4 \
  @deepseek-ai/dsh-storage-json@0.2.0-rc.2 \
  @deepseek-ai/dsh-storage-domain@0.2.0-rc.2 \
  --ignore-scripts --registry https://registry.npmmirror.com \
  --pack-destination "$sdk_download_dir"
mkdir -p .sdk-reference/connection .sdk-reference/cordis \
  .sdk-reference/storage-json .sdk-reference/storage-domain
tar -xzf "$sdk_download_dir/deepseek-ai-dsh-client-connection-0.2.0-rc.2.tgz" -C .sdk-reference/connection
tar -xzf "$sdk_download_dir/deepseek-ai-cordis-4.0.4.tgz" -C .sdk-reference/cordis
tar -xzf "$sdk_download_dir/deepseek-ai-dsh-storage-json-0.2.0-rc.2.tgz" -C .sdk-reference/storage-json
tar -xzf "$sdk_download_dir/deepseek-ai-dsh-storage-domain-0.2.0-rc.2.tgz" -C .sdk-reference/storage-domain
```

下载及解包后，核对四个 `package/lib/index.js` 的 SHA-256。以下值来自本次下载，且与本机测试所读取文件逐字节相同：

```text
3950f524aed44e28240140a254cd928ea40eba8e2d04cc8fd04f92a687f5c91d  .sdk-reference/connection/package/lib/index.js
6a9394c0877ff45218818c6e815edd038f8057e1a1deb390a8d43ec81c57691e  .sdk-reference/cordis/package/lib/index.js
0a6b75d5569db3379edd93e863570170e1f4121b6c9fabd856f5b476cffe8df4  .sdk-reference/storage-json/package/lib/index.js
e536ba09b7ccc0f10bb54818dfe44454374e5cbf7aeba140b216ba1ca2e87517  .sdk-reference/storage-domain/package/lib/index.js
```

Linux 可将上述清单保存到临时文件，运行 `sha256sum -c <清单路径>`。散列不匹配时停止检查，先核对下载版本。

## 本次命令结果

执行环境：Node.js `v24.19.0`、npm `11.17.0`、Darwin arm64。使用工作区外临时 npm cache。

| 命令 | 退出码 | 结果或失败原因 |
| --- | --- | --- |
| 根目录 `npm install --ignore-scripts --no-audit --no-fund` | 0 | 无外部依赖，生成根目录 package-lock.json |
| 根目录 `npm ci --ignore-scripts --no-audit --no-fund` | 0 | 新锁文件可用 |
| `npm ci --prefix tests/runtime --ignore-scripts --no-audit --no-fund`，首次 | 1 | 沙箱内 `getaddrinfo ENOTFOUND registry.npmmirror.com` |
| 同一 runtime 安装命令，获准联网后 | 0 | 安装 9 个包，未修改原锁文件 |
| 下载上述四个固定版本 SDK 的 `npm pack` | 0 | 四份 lib/index.js 均与原测试参考文件一致 |
| `npm run check` | 0 | package.json 指定的 JavaScript 语法检查通过 |
| `npm test` | 0 | 236 tests，236 pass，0 fail，0 skipped，0 cancelled |
| `npm run pack:check` | 0 | npm 打包 dry-run 通过；未发布包 |
| `git diff --check` | 0 | 未暂存差异检查通过 |
| 额外执行 `git diff --cached --check` | 2 | 已有暂存文档的 8 行尾随空格：DEVELOPMENT_GUIDE.md 第 3–5 行、PRODUCT_REQUIREMENTS.md 第 3–7 行；本次未修改这些文件 |

安装命令还使用了 `--cache <本次临时目录>`；首次 runtime 安装及重试设置了 `--fetch-retries=0 --fetch-timeout=20000`，以限制网络失败等待。

语法检查不等于类型检查。npm 打包 dry-run 不等于安装成功或 Desktop 运行成功。本次未运行独立的 test:runtime、test:integration 或真实 UI 验收。

## 测试目录与资源

- 测试前 `.storage-test-output/` 有 340 个直接子目录，`du -sk` 为 7140 KiB。
- 本次检查结束后记录了 52 个新目录，文件逻辑大小合计 1,066,358 bytes。大文件用例自行清理，但部分小型测试仍留残留。
- 清理前核对了绝对路径、顶层目录非符号链接、目录内容清单和活动进程/打开文件。仅删除已记录的 52 个新目录。测试构造的目录内符号链接只随目录移除，没有跟随链接删除目标。
- 原有 340 个目录的名称和目录时间戳保持不变。工作期间另有 75 个目录出现，未归入本次记录，保持原样。清理后共 415 个直接子目录。因此不能声称整个目录回到最初磁盘占用。
- 没有清理整个 `.storage-test-output/`，没有触碰 Desktop/Profile 存储。
- 现有用例清理尚不完全。本次补做清理不代表已修复测试代码。云端持续复用工作区时，需先收敛这些用例的 finally 清理，或逐次记录并审查本批次残留；不能自动递归删除整目录。
- 本次默认单元测试包含 196,700,885 bytes 的容量样本及 188 MiB 流式保护样本。容量用例报告 RSS 约 1.33 GB，该值不是整个测试进程树的峰值。云端容量配置需留余量，并在目标机器实测。不要在初始化中循环运行压测。

## 云端检查与真实验收的边界

准备完依赖和参考 SDK 后，云端可执行本次四条命令。每条命令独立记录退出码，不能因前一条失败而漏报后续检查。四项全绿只证明该云端工作区中的源码、模拟/隔离测试和打包检查通过。

以下项目需要真实 DeepSeek Harness Desktop/Web 和对应授权：

1. Desktop welcome 正常启动；启动后分时验证 `POST /api/settings/describe` 为 200。
2. Notebook 显示预期版本，health/list 的 RPC 返回结构及连接状态正确。
3. 插件禁用后官方 Gateway 仍正常；重复加载/卸载不泄漏监听器。
4. 未认证请求仍被宿主拒绝；Web 与 Desktop 分别验收。
5. 安装、启用/禁用、完整退出重开通过正式 plugin_manager 及授权流程执行，恢复可恢复的测试状态。

这些真实验收本次均未执行。也未安装、启用、重启或发布 Harness 插件。

本次命令原始日志保留在本机临时目录 `/private/var/folders/5r/x45tc2y52b1fnjz8284r3vm40000gn/T/dsh-cloud-review-bgr435ag/`。其中 results.json 记录四条检查的退出码，cleanup-result.json 记录限定清理结果；临时目录不是长期证据仓库。

## 发布前审核项

1. 确认云端平台、仓库来源与初始化入口，再应用以上配置。
2. 核对完整源码、tests/fixtures、diagnostics 测试输入和 runtime 锁文件已进入待发布版本。当前仓库尚无提交，且有大量已有未跟踪文件；不能只发布本次新增的配置文件。
3. 在干净云端检出上重新执行安装和四条检查，保存命令退出码及测试目录前后差异。
4. 处理剩余测试清理问题后，再启用反复运行的自动检查。
5. 审核通过后由用户发布环境；本次没有提交、推送或发布。
