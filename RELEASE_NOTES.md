# RELEASE NOTES · dsh-infinite-gen-4 v0.5.61-lab-20261025

> 由 `node .diag/build_release.js` 生成；逐文件 SHA256 见同目录 `MANIFEST.json`。
> 源目录：`D:\deepseek\armor-lab\gen4_home\plugins\dsh-infinite-gen-4`（lab 规范源）。**发布件不含 `*.bak*` / `.REJECTED.md` / node_modules。**

## 0. 本版变更（0.5.61）

**新增**：在 DSH 面板里装完，插件自己安排重启，不必再开命令行。

面板设置里多一行「装完自动重启」：

- **开** —— 装完 5 秒内察觉磁盘版本变化，自动重启宿主。
- **关** —— 面板顶部出现「已安装 vX，当前运行 vY」横幅 + 「立即重启」按钮。

实现：`index.js` 起 5 秒版本哨兵（比对 `<插件目录>/package.json` 与内存里的 `PKG_VERSION`），
发现不一致就 `spawn` 脱离宿主的 `tools/restart-host.ps1`；脚本默认经计划任务二次脱离进程树，
再结束 Electron 主进程（无 `--type=` 的 `DeepSeek Harness.exe`）或 `dsh web` 的 node 进程，用原路径/原命令行拉起。
`GEN4_RESTART_DISABLE=1` 可禁止真实重启（测试用）。

宿主面板的安装框仍会提示「重启后生效」，可以忽略——重启由插件接管。
自动重启会掐断正在生成的回答；桌面端重启后回到最近会话，网页端需重新打开标签页。

### 证据
`.diag/restart061/route.test.mjs` 10/10、`client_static.mjs` 9/9、`tools/restart-host.ps1 -DryRun` 真机命中主进程 pid=51188。

### 升级
```powershell
dsh plugin --profile desktop add github:qilingzon/po-gen#v0.5.61
```

补一句：**升级到 0.5.61 这一次仍需手动重启一次**（旧版还没有重启能力），从下一版起才会自动。
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
pwsh -File .diag\verify_release.ps1 -Version v0.5.61-lab-20261025      # 发布件 == lab 源 == 两份生效副本
node .diag\verify_regression.js                          # 判据金标
node .diag\selftest.js                                   # 12 项
pwsh -File .diag\overnight_verify.ps1                     # 一条命令全绿
```

