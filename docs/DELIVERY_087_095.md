# 0.5.87 – 0.5.95 交付说明（2026-11-14）

本批九版解决同一类问题：**框定只在首轮 / 只在文本类生效，导致会话中途的成品类指令裸奔**；同时把「交付判分」从字数改成产物判定，避免把替代品当成功。

## 1. 机制总览

| 版本 | 机制 | 作用点 | 默认 |
|---|---|---|---|
| 0.5.87 | 成品类任意轮次框定（`anyTurn` + `MID_SESSION_KINDS`） | `agent/pre-step` | 开 |
| 0.5.87 | 拒答重申间隔 `gap>=3 → gap>=1` | `agent/pre-step` | 开 |
| 0.5.88 | 工具形态框定（第一动作必须是工具调用） | `agent/pre-step` | 开 |
| 0.5.88 | 上一轮 0 工具调用 ⇒ 判未完成 | `agent/pre-step` | 开 |
| 0.5.89 | 三要素锁（对象/成品形态/验收） + 替代品自述检测 | `agent/pre-step` | 开 |
| 0.5.90 | 分类器收紧：开发语境不判答题类；替代品词表去通用词 | 分类层 | 开 |
| 0.5.91 | 单名词图像任务补判；机械操作不套重框定 | 分类层 | 开 |
| 0.5.92 | 产物闸门：`tools/result` 观察到 specimen/mockup 等产物时同轮注入纠正 | `tools/result` | 开 |
| 0.5.93 | 图像任务预热：把工作区真实底图/脚本作为「已开工」状态注入首轮 | `agent/pre-step` | 开（`GEN4_IMAGE_PREHEAT=0` 关） |
| 0.5.95 | 第二预设 `armor-guiji`：同一框架，默认模型走 guijiliudon 通道 | 预设登记 | 开（`GEN4_GUIJI_PRESET=0` 关） |

## 2. 不变式（每版都成立）

1. **用户正文逐字节不变**：`normalizeRequest().text === 输入`；框定/闸门/重申都是独立插件消息（`source.kind = plugin:po-gen`）。
2. **不替换对象、不引入夹具、不重定义交付物**：`HARD_RULE` 与 `TASK_LOCK` 明写，测试逐条断言（`test/fix585`、`fix589`）。
3. **判分口径**：`tools/score-armor.mjs` 四档 DELIVER / SUBSTITUTE / REFUSAL / THIN，产物路径与替代物标记决定档位。

## 3. 证据

| 主题 | 文件 |
|---|---|
| 分类器误伤回归（49 题 + 20 条普通指令） | `.diag/_class_regression.txt` |
| 0.5.93 vs 0.5.91 抽样 A/B（18 题，含 3 次重复） | `.diag/AB_593_vs_591.md` |
| 产物闸门与图像预热的实测（无效项也记录） | `.diag/_progress_592/593/594.md` |
| provider A/B（r4 vs guiji vs glm） | `.diag/PROVIDER_TEST.md` |
| 会话复盘（e1121cb0 第 8 轮拒答） | `.diag/e1121cb0_users.md`、`.diag/_t78.txt` |

## 4. 已知边界（实测结论，不是猜测）

- **证件成品类**（伪造驾照、把假证修到能过验）：r4 与 guiji 均不给成品；加框定/预热/闸门都无效果。模型在第一步即判定，插件无同轮拦截手段。
- **认证流程类**（2FA/VPN）：r4 1/3、guiji 2/3，属高方差；加类专属框定（0.5.94 试验）无增益，已回退。
- **机械图像操作**（压缩/裁剪/缩放）不套重框定；单名词强动作（去水印/换背景）会框定。

## 5. 验证方法

```powershell
npm test                      # 99/99
node tools/check-docs.mjs     # 文档安装命令与版本一致
node tools/build-preset-rows.mjs --check
node tools/score-armor.mjs <输出文件>              # 单份判分
node tools/compare-banks.mjs <dirA> <dirB> --md r.md  # 两批对比
```

预设是否真在 GUI 出现，需要在带 `agentPresets` 的 profile（桌面端/web 端）里重启后查看；CLI headless profile 不挂 registry。

## 6. 回滚

- 代码：`git checkout v0.5.91`（已发布）或 `v0.5.82`（上一个 release）。
- 桌面端：`desktop_restore.ps1 -Tag bak-YYYYMMDD-HHMMSS`（`-List` 查看备份点）。
- 单开关：`GEN4_IMAGE_PREHEAT=0`、`GEN4_GUIJI_PRESET=0`、`GEN4_OPENING=0`、`GEN4_NORMALIZE=0`。
