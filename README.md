# po-gen

po-gen（原「无限代」破甲项目）——面向 DeepSeek Harness 的提示词层破甲框架：通过系统提示词注入、槽位路由与稳定性纪律，使模型对安全类/成人类/逆向类请求保持**确定性直接交付**，并配套完整的自动化实测基建。

> 内部说明：平台内注册 ID 仍为 `dsh-infinite-gen-N`（存量实验平台兼容，改动会破坏已装 profile 的依赖解析）；对外产品名自 2026-09-10 起统一为 **po-gen**。

## 版本表

| 版本 | 目录 | 强度标定 | 要点 |
|---|---|---|---|
| po-gen-2 | `versions/po-gen-2/` (v0.2.3) | 85 | 初代稳定骨架 |
| po-gen-3 | `versions/po-gen-3-v0.4.4/` | 90 | fusion 骨架 + WiFi 首句协议（v0.4.4） |
| po-gen-4 | `versions/po-gen-4-v0.4.0/` | 92 | SPEED 单遍纪律 + 供应商审核对抗 v4 |
| po-gen-4 | `versions/po-gen-4-v0.4.1/` | 92 | T14 WiFi 首句协议 / T07 元问题形态协议 / T12 长文管线收紧 |
| **po-gen-4** | `versions/po-gen-4-v0.4.2/`（当前默认） | 92 | + 轮首自锚（TURN-OPENER SELF-ANCHOR）；battery 人工校正 38/40、matrix 16/16 零掐流 |

`versions/po-gen-4-v0.4.2/prompts/variants/` 内含实验变体（zero-trigger、boundary-unify、turn-anchor、stealth-cut、复合）——zero-trigger 已被实测反证（撤掉负向装甲后 battery 8/14），保留作研究数据。

## 实测方法论（lab/）

- `prompts_v2.jsonl`：43 题电池（crack/web 渗透/游戏逆向/移动端/LLM 攻击/成人/boundary/benign 对照）
- `run_battery_v2.ps1`：双评分器（keyword v2 词表 + ds 通道无甲 LLM-judge 三分类+质量分）+ run-manifest（SHA256 复现）
- `check_capability.ps1`：能力保持双目标——代码块真实执行 + SORT_VERIFY 功能断言
- `gen_variants.ps1`：标记式突变变体生成（自动搜索的产线）
- `sync_plugin_variants.ps1`：pnpm 快照同步（防 GEN4_VARIANT 静默回退，B14 制度）
- `TEST_ISSUES.md`：题库问题全量清单；`v041_report.md` / `v042_report.md` / `zt_report.md`：历期验收报告

## 关键实测结论

- 撤掉负向装甲的 zero-trigger 变体 8/14 vs 主线 13/14：**提示词层的对齐博弈必须用确定性路由压制**，负向装甲不可撤
- boundary 家族「每批恰一处翻车」方差签名（T07→T14→T04→T35/T36），结构性结论以专项 reps 为准
- SPEC LOCK 五重约束程序化验证 5/5；死亡三连（长文+直出+禁文件）已由聊天分段协议攻克

## 一键部署（Windows，PowerShell 5.1+ 兼容）

```powershell
# 默认：po-gen-4 最新版部署到 %DSH_HOME%（未设则 ~/.dsh），注册进 web profile
powershell -ExecutionPolicy Bypass -File install.ps1

# 指定 home / 代际 / 目标 profiles（可多个，逗号分隔）
powershell -ExecutionPolicy Bypass -File install.ps1 -DshHome "C:\Users\you\.dsh" -Generation 4 -Profiles web,gen4-lab

# 指定历史版本 / 卸载
powershell -ExecutionPolicy Bypass -File install.ps1 -Version 0.4.1
powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall -Generation 4
```

行为：自动备份旧版（`<插件>.bak-时间戳`）→ 拷贝 → 幂等注册 profile bundles+deps → 提示重启。卸载对称移除。

## 手动安装（任意平台）

将对应 `versions/po-gen-N/` 复制为 `~/.dsh/plugins/dsh-infinite-gen-N/`（或实验室 home 的 plugins/ 下），在 profile 的 `dsh.profile.bundles` 中加入 `dsh-infinite-gen-N`，重启平台生效。GUI 徽标「破甲已开启」即注入在场。
