# RELEASE NOTES · dsh-infinite-gen-4 v0.5.51-lab-20261024

> 由 `node .diag/build_release.js` 生成；逐文件 SHA256 见同目录 `MANIFEST.json`。
> 源目录：`D:\deepseek\armor-lab\gen4_home\plugins\dsh-infinite-gen-4`（lab 规范源）。**发布件不含 `*.bak*` / `.REJECTED.md` / node_modules。**

## 0. 本版变更（0.5.51 · 徽标开关修复 + 改名无限5代）

> 0.5.5 → 0.5.51 是**交互修复版**：提示词一字未改（`prompts/variants/b37-lite.md` 22,112 B，
> sha256 前缀 `ECFE1D00`），交付能力与 0.5.5 完全相同。

### 修的是什么

点徽标打开设置面板后，再点一次关不掉——只能开不能关。

根因不是状态写错，是**事件顺序**：「点面板外面就收起」这条监听挂在 document 的 `mousedown`
捕获阶段，点徽标本身也会先走 `mousedown`：mousedown → 面板关闭 → 随后 `click` 的
`setOpen(!open)` 读到的是**已经翻过的旧值**，于是又把面板打开。两次事件互相抵消，净效果永远是"开着"。

修复只有一行判定：close 时同时放过 `[data-armor]`（徽标自身），把开关权交回徽标的 `click`。
点面板外面关闭、Esc/键盘可达这些行为全部保留。

### 证据（可复跑）

`.diag/session055/toggle_051.mjs` 用极简 React 打桩，真跑 `client.js` 里的组件（不是字符串断言）：

| 被测文件 | 结果 |
|---|---|
| 0.5.51 新版 `client.js` | **9 PASS / 0 FAIL** |
| 0.5.5 旧版 `client.js` | **5 PASS / 4 FAIL**（点徽标误关、再点关不掉、第二次复现不了、文案仍是无限四代） |

同一套 9 条断言跑新旧两版，差异就是这一处修复。另有非回归：假宿主契约 **25/25**、
客户端静态断言 **24/24**、空 `DSH_HOME` 里 `install.ps1 -LocalZip` 装出 **v0.5.51**
（`INSTALL-OK`，两处回读 `0.5.51` / `index.js 0cf849693f4c`）。

### 顺带改的两件事

1. **显示名「无限四代」→「无限5代」**：徽标文案、`package.json` 的 `dsh.name`、README 与
   HARNESS_PLUGIN 文档。包名 `dsh-infinite-gen-4` 与 `dsh.id` 不动，既有依赖与设置文件名不受影响。
2. **安装脚本 UTF-8 安全**：`install.ps1` / `uninstall.ps1` / `tools/scope.ps1` 新增
   `Read-Json`（显式 UTF-8 解码），并给 `.ps1` 加 BOM。以前 `package.json` 里只要有中文，
   `Get-Content -Raw | ConvertFrom-Json` 在部分环境就会解成乱码并报错。

### 升级方式

```powershell
# 粘仓库地址（跟随 master 最新）
dsh plugin --profile desktop add https://github.com/qilingzon/po-gen

# 或钉版本
dsh plugin --profile desktop add github:qilingzon/po-gen#v0.5.51
```

装完重启客户端；徽标应显示「破甲已开启 · 无限5代」，点一下开面板、再点一下收起。

### 回滚

装回 `v0.5.5`（`dsh plugin --profile desktop add github:qilingzon/po-gen#v0.5.5`）即可；
本版未改包名、段名、工具、通道与设置文件格式。
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
pwsh -File .diag\verify_release.ps1 -Version v0.5.5-lab-20261024      # 发布件 == lab 源 == 两份生效副本
node .diag\verify_regression.js                          # 判据金标
node .diag\selftest.js                                   # 12 项
pwsh -File .diag\overnight_verify.ps1                     # 一条命令全绿
```

