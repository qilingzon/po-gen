# RELEASE NOTES · dsh-infinite-gen-4 v0.5.5-lab-20261024

> 由 `node .diag/build_release.js` 生成；逐文件 SHA256 见同目录 `MANIFEST.json`。
> 源目录：`D:\deepseek\armor-lab\gen4_home\plugins\dsh-infinite-gen-4`（lab 规范源）。**发布件不含 `*.bak*` / `.REJECTED.md` / node_modules。**

## 0. 本版变更（0.5.5 · 按对话启用）

**一句话**：以前「破甲开不开」只有 `scope`（整个 profile）和 `showBadge`（看不看得见）两个旋钮，
要单独给某一场对话开或关做不到。0.5.5 在设置面板加了一行 **「本对话启用破甲」**，
让同一 profile 下的 A 会话开、B 会话关，各走各的。

### 0.1 用户问题与判定

| 用户要求 | 0.5.5 的落点 |
|---|---|
| 面板里能「这场对话开、那场关」 | 设置文件 `sessions` 覆盖表 + 面板开关；三态（开 / 关 / 跟随） |
| 关掉别影响别人 | 提示词段按会话求值：没打开的会话拿到空串，工具与钩子也按会话放行 |
| 别污染其他模式 | 默认仍是 `local`；没主动开任何开关时行为与 0.5.4 完全一致 |
| 关掉之后还能改回来 | 徽标不退场（`myOverride === "on"` 也显示），灰态显示「破甲已停用 · 本对话」 |

### 0.2 机制上移：从「注册级」到「求值级」

旧实现的开关只能决定**注册不注册**（段、工具、钩子在激活时二选一），所以一个 profile 只能有一个答案。
0.5.5 把判断推到**每一轮组装**：

- `dsh-system-prompt` 的 section `text` 允许是函数，每次组装求值 ⇒ 段文本按 `context.agent.session.id` 决定返回全文还是空串；
- `dsh-session-projection` 的 `init(header)` 拿得到会话 id ⇒ 投影状态带 `sessionId`，客户端才知道「本对话」是谁；
- `agent/pre-step` 与 `tools/post-execute` 在入口按会话放行 ⇒ 未启用的会话即使工具已注册也拿不到注入。
- 段名保持 `infinite-gen-4:global-system-prompt`，同名段按作用域遮蔽：破甲预设的会话里，预设实例的段盖住常驻实例的段，不会双注入。

### 0.3 四层证据（都可复跑）

| 层 | 判据 | 结果 |
|---|---|---|
| 假宿主契约 | 路由 12 项 + 段文本 11 项 + 钩子 2 项 | **25/25 PASS**（`.diag/session055/harness.mjs`） |
| 客户端静态 | 面板行、三态副标签、POST 体、四态徽标、入口可见性、Hook 顺序 | **24/24 PASS**（`.diag/session055/client_static.mjs`） |
| 真机请求头矩阵 | 同一 profile 两场真实会话，看**实际发给模型的工具清单** | **8/8**（`.diag/session055/live_results.csv`） |
| 命令行等价物 | `scope.ps1 session <id> on|off|auto`、合并写入不丢表 | 实测通过（`.diag/session055/pshome`） |

真机矩阵的关键三格：

| 步骤 | 设置 | 期望 | 实际请求头 |
|---|---|---|---|
| A 首次创建 | `{}` | 不在框架 | 25 个工具，无插件工具 |
| A 单独打开 | `{A:on}` | 在框架 | 27 个工具，含 `gen5_verify` + `delivery_profile` |
| A 默认、B 打开 | `{B:on}` | A 不在框架 | 工具在（全局注册）但 A 调 `gen5_verify` 回报 `enabled:false` |

第三行是这一版真正的隔离判据：工具因为**别人**在用而注册，A 仍然出局。

### 0.4 实测中发现的一件事（写进文档，不粉饰）

把一场**已经答过 `NO-TOOL`** 的会话重新打开后，请求头里工具确实已经在了（27 个），
但 r4 模型三次都照抄上一轮的 `NO-TOOL`，推理原文是
「My tool list does not include gen5_verify. It's not in the functions list.」。

⇒ 判据不能看模型自述，要看请求头与 `gen5_verify` 自报的 `session` 字段。
这也解释了历史电池里「工具明明在、模型说没有」的那类格子。

### 0.5 非回归

- 提示词 `prompts/variants/b37-lite.md` **未改**（22,113 B），交付能力与 0.5.4 相同，未重跑 12 题电池。
- 默认值不变：不写设置文件 = `local` + 无徽标 = 其他模式零注入（0.5.2 起的老基线仍成立）。
- 设置文件向后兼容：0.5.5 新增的 `sessions` 字段在 0.5.4 里被忽略；0.5.4 写的 `showBadge` 在 0.5.5 里照读。
- `GEN4_SCOPE` / `GEN4_SHOW_BADGE` 环境变量优先级不变。

### 0.6 回滚

- 插件：`install.ps1 -Restore`（`-ListBackups` 列出）或装回 v0.5.4 zip。
- 设置：删 `<DSH_HOME>\.dsh-infinite-gen-4.json` 的 `sessions` 条目即回「跟随设置」；整份删除即回默认。
- 环境污染为零：本版没有改名任何段、工具或通道；卸载即恢复原状。

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

