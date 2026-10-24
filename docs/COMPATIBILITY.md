# 兼容性

## 宿主

`package.json` 里声明的宿主区间（宿主按 `dsh-app-boot` 的 `unmetRequirements` 校验，
预发布版也参与比较；不满足时插件管理器会拦下并给出 `incompatible-version`）：

```json
"engines": { "node": ">=20", "dsh": ">=0.2.1-rc.2 <0.4.0" }
```

| 项 | 要求 |
|---|---|
| DeepSeek Harness | **0.2.1-rc.2 起、0.4.0 之前**（含 rc.3；0.4.0 起须重新验证后放宽） |
| Node.js | ≥ 20（插件用 ESM、`node:crypto`、`Array.prototype.at`） |
| 操作系统 | Windows 10/11（`.ps1` 安装器）；Linux / macOS / Git Bash（`.sh` 安装器） |

插件只依赖宿主暴露的插件 API，不打包第三方运行时依赖；`package.json` 里没有 `dependencies`。

### 为什么下限是 0.2.1-rc.2

0.2.1-rc.2 是实现实测过的最早一版：提示段 `text(context)` 按会话求值、会话投影
`stateVersion=2` 携带 `sessionId`、`tools.register` 的 `execute(args, exec)` 签名都在这一版成立。
更低版本的宿主缺这些接口，装上也只会 pending（等不到 `tools` / `systemPrompt` 服务）。

### 0.2.1-rc.3 的实测结论

rc.3 与本插件相关的五个宿主包（`dsh-system-prompt`、`dsh-session-projection`、`dsh-tools`、
`dsh-plugin-manager`、`dsh-base`）的 `lib/*.js` 与 rc.2 **逐字节相同**；唯一变化的
`dsh-client-ui-plugin-manager/lib/client.js` 差 198 B，是 CSS module 类名哈希与构建路径字符串。
据此判定：rc.3 没有破坏性接口变更，本插件的段注册、投影、工具注册三条通道都不受影响。

## 版本线

| 版本 | 状态 | 说明 |
|---|---|---|
| 0.5.x | 当前代际 | 新增执行前归一化 + `gen5_verify` 后置验证；0.5.52 起声明 `engines.dsh` |
| 0.4.x | 维护 | b37-lite 默认变体、work-reminder 中性化 |
| ≤ 0.4.9 | 历史 | 见 `CHANGELOG.md` |

向后兼容承诺：0.5.0 的 `cordis.patch.yml` 与 0.4.x 相同（66 B），不新增宿主侧自动挂载项；`armor` 预设 id 不变，老会话继续可用。

## 已验证组合

| 宿主 | 安装方式 | 结果 |
|---|---|---|
| Windows 11 · 桌面端 0.2.1-rc.2 | `install.ps1` 三处刷入 | 三处 `version` 一致、`gen5_verify` OK |
| Windows 11 · CLI 0.2.1-rc.2（`dsh --profile gen4-hl`） | `dsh plugin add` / 源同步 | headless 会话可交付 |
| Windows 11 · CLI 0.2.1-rc.3，自建 profile（`dsh plugin --profile rc3 add file:`） | 装进 rc.3 profile | 安装 exit 0；`--dump-config` 树里出现 `- id: infinite-gen-4`（0.6s）；原生 headless **未跑通**（见下） |
| Windows 11 · CLI 0.2.1-rc.3 + 既有 `gen4-hl` profile | 源同步 + headless 单轮 | 会话正常起、17 KB reasoning 流、无导入错；工具层证据沿用 0.5.5 的 `gen5_verify`（同一 `index.js` 字节） |
| Git Bash · Windows | `install.sh` | `-f` / `-l` / `-r` 全通 |

## 未验证 / 已知限制

- **profile 物化副本**：宿主加载的是 `profiles/<p>/node_modules/` 下的副本，不是 `plugins/` 源目录；改源不生效属正常现象，须走安装器或 `dsh plugin add`。
- **运行期替换目录**：宿主运行中替换已加载的插件目录可能报 `EPERM`，需要完整退出应用后升级。
- **跨版本混装**：用 rc.3 的 CLI 去跑一个由 rc.2 物化出来的 profile，宿主会把 row 级插件逐条禁用
  （报 `is incompatible with dsh 0.2.1-rc.3`），插件则停在 `pending (waiting for services: tools, systemPrompt)`。
  这不是插件问题：同一 profile 的宿主包必须与 CLI 同版本，升级客户端后应让 profile 重新物化。
- **rc.3 自建 profile 的 headless 起不来**（宿主侧，本插件不改）：`--profile rc3 ... headless` 连续两次
  stdout/stderr 均 0 字节并超时（200s / 240s），未创建会话目录；同一 profile 的 `--dump-config` 却在
  0.6s 内正常退出 ⇒ 卡在模型调用之前。用既有 profile（`gen4-hl`）则能正常起会话。
- **rc.3 题干传参语义变化**：rc.2 可用 stdin 传题干；在 rc.3 上观察到的是 app 名 `headless` 被当成题干
  （stdin 的问题未被采用）。改用 app 参数位置传题干前请先自测。
- **rc.3 沙箱 workspace provisioning**：rc.3 下首次工具调用可能报 workspace 供给失败（模型侧原文：
  「This error came from the sandbox's workspace provisioning, before my command even ran」），
  与插件无关，属宿主沙箱行为。
- 多模型矩阵只覆盖 OpenAI 兼容端点，本地推理端点未做矩阵测评。
