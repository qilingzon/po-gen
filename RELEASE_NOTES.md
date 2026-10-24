# RELEASE NOTES · dsh-infinite-gen-4 v0.5.4-lab-20261024

> 由 `node .diag/build_release.js` 生成；逐文件 SHA256 见同目录 `MANIFEST.json`。
> 源目录：`D:\deepseek\armor-lab\gen4_home\plugins\dsh-infinite-gen-4`（lab 规范源）。**发布件不含 `*.bak*` / `.REJECTED.md` / node_modules。**

## 0. 本版变更（0.5.3 → 0.5.4，type=feature）

> 本节是 0.5.4 的实际内容。§1–§4 是 `build_release.js` 的模板继承文本，属于历史版本记录，不是本版声明。

### 0.1 改了什么：一个开关拆成两个

0.5.3 及以前，徽标点击 = 直接切「启用范围」：点一下从局部变全局，再点回去。两个概念被绑在一起——
**注不注入**（scope）和 **其他模式看不看得见**（visible）。于是「只想在其他模式看到徽标、但不要注入」
做不到；而一旦点了徽标，其他模式就被注入，用户的原话是「会污染其他模式」。

0.5.4 把徽标点击改成**打开设置面板**，面板里是两个互不牵连的开关：

| 开关 | 管什么 | 关 | 开 |
|---|---|---|---|
| 启用破甲（其他模式） | 注不注入 | 只有「破甲模式」注入（默认） | 本 profile 所有模式都注入 |
| 其他模式显示徽标 | 看不看得见 | 其他模式没有徽标（默认） | 其他模式也显示徽标 |

面板内容按预设分档：

- **破甲模式**：只有「其他模式显示徽标」一项。那里破甲本来就是开的，不需要再开一次。
- **其他模式**：多一项「启用破甲」。在普通模式里点徽标、打开它，普通模式也会破甲。

状态与徽标文案：

| 状态 | 徽标 |
|---|---|
| 破甲模式（已注入） | `破甲已开启 · 无限四代` |
| 其他模式，已全局注入 | `破甲已开启 · 全部模式` |
| 其他模式，仅显示徽标未注入 | `破甲未启用 · 点击开启` |

### 0.2 实现要点

| 位置 | 改动 |
|---|---|
| `client.js` | 徽标 `onClick` 由「切换 scope」改为「开关面板」；面板按 `isArmor` 决定是否渲染「启用破甲」行；`visible = isArmor \|\| global \|\| showBadge`；点面板外关闭；Enter/Space 可开面板；所有 hook 仍在 early-return 之前（热切换不崩） |
| `index.js` | `resolveShowBadge()`（`GEN4_SHOW_BADGE` > 行配置 `showBadge` > 设置文件 > 跟随 `scope`）；`GET /gen4/scope` 返回 `showBadge` 与 `showBadgeEnvOverride`；`POST` 支持只带 `showBadge` 的**合并写入**（切 scope 不清徽标设置）；`GEN4_SHOW_BADGE` 覆盖时 `409 env-override-badge` |
| `tools/scope.ps1` | 新增 `badge on\|off`；`show` 同时打印 scope 与 badge 的文件值 / 环境变量 / 生效值；环境变量覆盖时只提示不写盘 |
| `README.md` | 「启用范围」章节改写为「破甲设置：两个独立开关」，加四种组合表与文案对照；环境变量表补 `GEN4_SHOW_BADGE` |

两个开关都是**热生效**：设置写在 `<DSH_HOME>\.dsh-infinite-gen-4.json`，插件两个实例每 4 秒轮询，
不需要重启宿主。

### 0.3 证据（三层，全部实测）

| 层 | 脚本 | 结果 |
|---|---|---|
| 服务端路由行为 | `.diag\scope054\route_test.mjs` | **23/23 PASS** — 默认 local、badge 默认 false、只带 badge 的 POST、落盘、切 scope 不清 badge、global 下关徽标、空 body 400、非法值 400、PUT 405、跨站 origin 403、`sec-fetch-site: cross-site` 403、`dsh-app://app` 放行 |
| 客户端静态断言 | `.diag\scope054\client_static.mjs` | **26/26 PASS** — 可见性规则、破甲模式不渲染「启用破甲」行、徽标行两模式都渲染、两个 POST 只发各自字段、`aria-pressed`、三态文案、hook 顺序、键盘可达 |
| 注入矩阵（真跑模型） | `.diag\scope054\inject_matrix.ps1` | **4/4** — S1 local+普通预设=不注入、S2 global+普通预设=注入、S3 local+破甲预设=注入、**S4 local+仅徽标=不注入** |

S4 是本次最关键的一格：它是「看得见但不注入」这个新组合的实证。S1/S4 的回答分别是
`NO-TOOL` / `无需调用工具`（模型措辞会变，判据取「有没有答出 scope 值」，不押在固定字符串上）。

### 0.4 非回归

- 提示词 `prompts/variants/b37-lite.md` 与 0.5.3 发布件**逐字节相同**：22,113 B，
  SHA256 前 16 位 `B4B8363E3FF3C90A`。本版没有动提示词，0.5.3 的 12 题电池结论（11/12 complete，
  唯一 non-complete 是 H11 真实第三方入侵题）继续适用于本版。
- 徽标原有状态机（思考中脉冲 / ✓ 通过 / ◐ 未完交付 / ✗ 拒绝词）未改，静态断言覆盖。

### 0.5 回滚

- 装回旧版：把 profile 依赖里的 `#v0.5.4` 换成 `#v0.5.3` 重装即可（`dsh plugin --profile <p> add github:qilingzon/dsh-infinite-gen-4#v0.5.3`）。
- 设置文件兼容：0.5.4 写的 `{"scope":"local","showBadge":true}` 在 0.5.3 里会被忽略 `showBadge` 字段（只读 `scope`），不会报错。
- 想要「完全回到 0.5.3 行为」：删掉 `<DSH_HOME>\.dsh-infinite-gen-4.json` 即可（默认 local、无徽标）。

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
pwsh -File .diag\verify_release.ps1 -Version v0.5.4-lab-20261024      # 发布件 == lab 源 == 两份生效副本
node .diag\verify_regression.js                          # 判据金标
node .diag\selftest.js                                   # 12 项
pwsh -File .diag\overnight_verify.ps1                     # 一条命令全绿
```

