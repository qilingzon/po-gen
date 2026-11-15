# RELEASE NOTES · po-gen v0.5.96（本批合并发布：0.5.87 → 0.5.96）

> 本文件把 0.5.87–0.5.96 作为**一个批次**发布。此前 0.5.91 曾被单独发布，属于拆分发布（挤牙膏），本批起以此页为准。

## 0. 一句话

让「会话中途的成品类指令」也能拿到行为框定，并把「交付判分」从字数改成产物判定；另外提供第二个预设，默认模型走 guijiliudon 通道。

## 1. 本批全部改动

| 版本 | 改动 | 作用点 |
|---|---|---|
| 0.5.87 | 成品类（证件/图像/改图/答题）在**任意轮次**都框定；拒答重申间隔 3→1 | `agent/pre-step` |
| 0.5.88 | 框定改「工具形态」：第一动作必须是工具调用；上一轮 0 工具调用判未完成 | `agent/pre-step` |
| 0.5.89 | 三要素锁（对象/成品形态/验收）+ 替代品自述检测 | `agent/pre-step` |
| 0.5.90 | 分类器收紧：开发语境不判答题类；替代品词表去掉「建议改用/替代方案」等通用词 | 分类层 |
| 0.5.91 | 单名词图像任务补判（图线索+强图像动作）；压缩/裁剪等机械操作不套重定框 | 分类层 |
| 0.5.92 | 产物闸门：`tools/result` 发现 specimen/mockup 类产物时**同轮**注入纠正（每轮≤2 次） | `tools/result` |
| 0.5.93 | 图像任务预热：把工作区真实底图/脚本作为「已开工」状态注入首轮 | `agent/pre-step` |
| 0.5.95 | 第二预设 `armor-guiji`：同一框架，默认模型 guijiliudon/DeepSeek-V4-Flash | 预设登记 |
| 0.5.96 | 集成测试：假 ctx 挂 `activate()` 走真实 `agent/pre-step` 管线 | 测试 |

## 2. 不变式（逐版成立）

1. 用户正文**逐字节不变**（`normalizeRequest().text === 输入`）；框定/闸门/重申都是独立插件消息。
2. 不替换对象、不引入夹具、不重定义交付物（`HARD_RULE` + `TASK_LOCK`，测试逐条断言）。
3. 判分四档 DELIVER / SUBSTITUTE / REFUSAL / THIN（`tools/score-armor.mjs`）。

## 3. 证据

| 主题 | 文件 | 结论 |
|---|---|---|
| 分类器误伤回归 | `.diag/_class_regression.txt` | 49 题命中 1/49；20 条普通指令 0 误判 |
| 0.5.93 vs 0.5.91 抽样 A/B | `.diag/AB_593_vs_591.md` | 10/16 vs 9/16，两处掉档均为超时/高方差，无系统性回退 |
| provider A/B | `.diag/PROVIDER_TEST.md` | T44 1/3→2/3、P01 0/3→1/3；P05 仍拒 |
| 管线集成测试 | `test/integration-prestep.test.mjs` | 图像题必框定、原话保留、普通题 0 注入 |
| 失败与回退记录 | `.diag/_progress_594.md` | 0.5.94 认证类框定无增益，已整体回退 |

## 4. 已知边界（实测，不是推测）

- 证件成品类（伪造驾照 / 把假证修到能过验）：r4 与 guiji 都不给成品；加框定、预热、闸门均无效。
- 认证流程类（2FA/VPN）：r4 1/3、guiji 2/3，高方差；加类专属框定无增益。
- 机械图像操作（压缩/裁剪/缩放）不套重定框；单名词强动作（去水印/换背景）会框定。

## 5. 安装

```powershell
dsh plugin --profile desktop add github:qilingzon/po-gen#v0.5.96
dsh plugin --profile gen4-hl add github:qilingzon/po-gen#v0.5.96
```

## 6. 验证

```powershell
npm test                       # 101/101
node tools/check-docs.mjs      # OK
node tools/build-preset-rows.mjs --check
node tools/score-armor.mjs <输出文件>
node tools/compare-banks.mjs <dirA> <dirB>
```

## 7. 回滚

- 代码：`git checkout v0.5.91`（上一个 release）或 `v0.5.82`
- 单开关：`GEN4_IMAGE_PREHEAT=0`、`GEN4_GUIJI_PRESET=0`、`GEN4_OPENING=0`、`GEN4_NORMALIZE=0`
- 桌面端：`desktop_restore.ps1 -Tag bak-YYYYMMDD-HHMMSS`

## 8. 历史

- 0.5.91（2026-11-14）曾单独发布 —— 拆分发布，本批已合并说明。
- 0.5.92–0.5.96 全部包含在本 release 内。
