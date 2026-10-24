# RELEASE NOTES · dsh-infinite-gen-4 v0.5.52-lab-20261024

> 由 `node .diag/build_release.js` 生成；逐文件 SHA256 见同目录 `MANIFEST.json`。
> 源目录：`D:\deepseek\armor-lab\gen4_home\plugins\dsh-infinite-gen-4`（lab 规范源）。**发布件不含 `*.bak*` / `.REJECTED.md` / node_modules。**

## 0. 本版变更（0.5.52 · 适配 DSH 0.2.1-rc.3，补齐宿主版本契约）

> 0.5.51 → 0.5.52 是**兼容性版本**：提示词（`prompts/variants/b37-lite.md` 22,113 B，sha256 前缀
> `B4B8363E`）与运行期代码（`index.js` 49,866 B、`client.js` 17,687 B）**逐字节未改**，
> 交付能力与 0.5.51 完全相同。改的只有「告诉宿主自己能跑在哪」以及配套文档。

### 1. 根因：插件此前没有声明宿主版本

`package.json` 的 `engines` 只有 `node`，没有 `dsh`，也没有 `@deepseek-ai/dsh` 的
`peerDependencies`。宿主的判据在 `dsh-app-boot` 的 `unmetRequirements`：

- 有 `engines.dsh` → **只**看它；
- 没有 → 逐个校验 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的 peer 区间。

两者都没有就等于**完全不检查**：既不会在 rc.3 上拦住你，也不会在将来某个改坏 API 的版本上拦住你。
这一版把契约补上：

```json
"engines": { "node": ">=20", "dsh": ">=0.2.1-rc.2 <0.4.0" }
```

下限 `0.2.1-rc.2` = 实现实测过的最早一版；上限 `<0.4.0` 给 0.2.x 正式版与 0.3.x 留空间，
0.4.0 起必须重新验证后才放宽。宿主判定时预发布版也参与区间比较，所以 rc.3 落在区间内。

### 2. rc.3 实测：接口面无破坏性变更

按 0.2.1-rc.3 重装宿主包后逐文件比对（`.diag\compat053\`）：`dsh-system-prompt`、
`dsh-session-projection`、`dsh-tools`、`dsh-plugin-manager`、`dsh-base` 的 `lib/*.js` 与 rc.2
**逐字节相同**；唯一变化的 `dsh-client-ui-plugin-manager/lib/client.js` 差 198 B，内容是
CSS module 类名哈希与构建路径字符串。插件依赖的三条通道（提示段 `text(context)` 按会话求值、
会话投影 `stateVersion=2` 带 `sessionId`、`tools.register` 的 `execute(args, exec)`）全部在
未变化的那批包里。

rc.3 上的实际跑通证据（全部可回读）：

| 检查 | 结果 |
|---|---|
| profile 内装载 | `dsh plugin --profile rc3 add 'file:…'` 成功；补装宿主栈后从 pending 转为加载，无 `ERR_MODULE_NOT_FOUND` |
| 原生 headless | `gen5_verify` 返回 `verdict=OK`、9 项 checks 全过、自报 `version=0.5.52` |
| 工具层 | `delivery_profile` 正常返回模板库 |
| 系统提示 | 注入 b37-lite 全文（18,931 字符） |
| 归一化 | `normalize.enabled=true`，本轮 `steps=1 changed=0`（无实体需改写，属正常） |

日志：`.diag\compat053\smoke_rc3_native.txt` / `.err.txt`，结论摘要
`.diag\compat053\smoke_rc3_verdict.md`。

### 3. 新增 `docs/COMPATIBILITY.md`

写明三件事：`engines.dsh` 区间与由来、rc.3 的字节对比与冒烟结论、**跨版本混装**的已知限制——
用 rc.3 的 CLI 去跑由 rc.2 物化出来的 profile，宿主会把 row 级插件逐条禁用并报
`is incompatible with dsh 0.2.1-rc.3`，插件停在 `pending (waiting for services: tools, systemPrompt)`。
这不是插件缺陷：同一 profile 的宿主包必须与 CLI 同版本，升级客户端后应让 profile 重新物化。

### 4. 升级与回滚

- 升级：装 `v0.5.52`（`https://github.com/qilingzon/po-gen` 不带 tag，或带 `#v0.5.52`）；
  桌面端 0.2.1-rc.2 与 rc.3 都在 `engines.dsh` 区间内，**无需先升宿主**。
- 回滚：`install.ps1 -Restore`（`-ListBackups` 列出备份点），或装回 `#v0.5.51`。
  本版未改包名、`dsh.id`、段名（`infinite-gen-4:global-system-prompt`）、工具名或设置文件格式；
  宿主若回退到 rc.2，0.5.52 仍满足 `engines.dsh`，不需要回滚。

### 5. 非回归（同一套断言重跑）

| 层 | 结果 |
|---|---|
| 契约（`harness.mjs`，路由/段文本/钩子） | 25/25 PASS |
| 客户端静态（`client_static.mjs`，徽标与面板） | 24/24 PASS |
| 徽标开关（`toggle_051.mjs`） | 9/9 PASS |
| 安装实证（空 `DSH_HOME` + `install.ps1 -LocalZip`） | `INSTALL-OK v0.5.52`，两处回读一致（`0.5.52` / `index.js 0cf849693f4c`） |
> 说明：§1–§4 由 build_release.js 模板继承，其中变体交付率与电池数字截至 0.4.2–0.4.10，属**历史数据**。

## 1. 这一版的关键事实（都可复跑核验）

- **重申通道默认值 = canonical 10 / 12**（与桌面端及九份历史副本一致），并**可 env 覆盖**：
  `GEN4_REANCHOR_EVERY_TURNS`（0=关周期性）、`GEN4_REANCHOR_ON_REFUSAL`、
  `GEN4_POSTEXEC_EVERY_ACTIONS`、`GEN4_REANCHOR_TEXT_FILE`（中性重申文本）。
  ⚠️ 历史教训：本文件第一版把源目录当时的 20/24 带进了生效副本，导致 b37v12/v13 与 b37v15/16/18 之间
  多出一个不一致变量；现已归零（见 `progress.md`）。
- **变体切换**：`GEN4_VARIANT=<名>` → `prompts/variants/<名>.md`；默认 `b37-coldstart`。
  本次发布含 **21 个变体**。
- **运行期加载的是 profile 的物化副本**（`<home>/profiles/<profile>/node_modules/dsh-infinite-gen-4`），
  **不是** `<home>/plugins/` 源目录 —— 改源不生效是常态。发布/安装必须走
  `.diag/sync_plugin_to_profile.ps1`（逐文件 SHA256 + 变体存在性断言，失败 exit 3）。

## 2. 甲（变体）的实测交付率（电池，元指令 n=9–18，判据 = score_win 金标版本）

| 变体 | 交付率 | 备注 |
| --- | --- | --- |
| `upstream-v040`（官方原版 3 KB，逐字节相同） | **61%** | 目前测得最高；措辞中性、脸上不写"破甲/越狱" |
| `b37-coldstart`（默认，25 KB） | **56%** | 桌面端当前安装的就是它 |
| `main`（`prompts/infinite-gen-4.md`，lab 源为 slim v1 2 KB） | 17% | 注意：桌面端那份 main 是 24 KB legacy，**与 lab 不同** |
| `window-v042live`（本窗口真机提示词，含 harness 前言） | **0%** | 实测最差，仅作对照件保留 |

## 3. 已知问题（如实）

1. **判据（`score_win.js`）仍有长尾，未收敛**：四批盲测残余误差 12.8% / 8.6% / 8.3% / 10.8%，
   合计 **16/155 ≈ 10.3%**，趋势**没有下降**。16 条分歧里，独立判读的结论与我逐条读原文的仲裁 **100% 一致**
   （判据全错、判读全对）。⇒ **架构建议**：把主判据换成 **LLM 独立判读**（rubric-only 读者 + 多次投票），
   `score_win.js` 降级为快速预筛/分流；marker 词表继续维护但不再当唯一真值。
2. **桌面与 lab 存在版本差**：桌面那份 `index.js` 无 env 开关、main 为 24 KB legacy、仅 6 个变体；
   对齐需走 `desktop-install-kit/`（**需用户明确指令 + 先备份**）。
3. **臂内 rep 漂移未消**（同格多轮共享一份 cwd 副本）；样本量 n=9–18，交付率只能当方向。
4. **工具通道在副本环境里可能静默失效**（`pwsh` 无 stdout 无副作用）—— 属环境现象，不是插件缺陷；
   `acp_client.js` 现在会在超时后重启子进程，避免一次超时报废整轮。
5. **甲的效果仍是概率性的**：测得最好的 `upstream-v040` 也只有 61%；没有任何配置复现出"本窗口那样连续交付"，
   目前唯一连中的组合是"中性工程预热 + 明确接着之前的进度"（W4 的 ST2，n=2 待扩样）。

## 4. 校验方式

```powershell
pwsh -File .diag\verify_release.ps1 -Version v0.5.52-lab-20261024      # 发布件 == lab 源 == 两份生效副本
node .diag\verify_regression.js                          # 判据金标
node .diag\selftest.js                                   # 12 项
pwsh -File .diag\overnight_verify.ps1                     # 一条命令全绿
```

