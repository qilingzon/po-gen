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
| po-gen-4 | `versions/po-gen-4-v0.4.2/` | 92 | + 轮首自锚（TURN-OPENER SELF-ANCHOR）；battery 人工校正 38/40、matrix 16/16 零掐流 |
| po-gen-4 | `versions/po-gen-4-v0.4.3/` | 92 | 交付修复：徽标 busy 改读 `turnBoundary` 投影（修 armor 假忙） |
| po-gen-4 | `versions/po-gen-4-v0.4.4/` | 92 | 交付修复：挂 inbox 投影待发计数＝静默丢件可见化 |
| **po-gen-4** | **`versions/po-gen-4-v0.4.6/`（当前默认）** | 92 | **首句门控冷启动预热**：续做类请求（「继续破甲项目」）38.5%→100%；普通任务题不注入（消除 v0.4.5 无门控版 66.7%→54.2% 的负优化）；三处版本串统一 |

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

## 一键安装 / 卸载 / 更新（Linux / macOS）

**真正的一条命令**（仓库公开，无需克隆）：

```bash
# 安装
curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s install
# 更新（先拉最新仓库，再装最新版本）
curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s update
# 卸载
curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s uninstall
# 体检（5 项全查，每项不通过都给修复命令）
curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s doctor
# 状态 / 可用版本
curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s status
curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s list
```

**已克隆的话**，本地同一个入口：

```bash
./po-gen.sh install      # 或 uninstall / update / doctor / status / list
./po-gen.sh install --version v0.4.6 --home /opt/dsh --profile web
```

> `po-gen.sh` 会自动把仓库缓存在 `~/.po-gen-src`（可 `PO_GEN_CACHE` 覆盖），
> 所以 curl 形式只需跑一次，之后每次都会更新缓存再执行。

### `doctor` 是什么

命名借用 `brew doctor` / `flutter doctor` 的习惯：**只体检、不改盘的自诊断命令**。
它跑 **5 项装前检查**，**不修改任何文件**；任何一项不通过，直接打印**可复制的修复命令**：

| # | 检查 | 不通过时的处置 |
| --- | --- | --- |
| 1/5 | DSH 目录存在（`$DSH_HOME` 或 `~/.dsh`） | 打印 `ls -d ~/.dsh /opt/dsh …` 与 `find / -maxdepth 4 -type d -name .dsh`，让你显式 `export DSH_HOME=` |
| 2/5 | profile 目录存在（含 `package.json`） | 提示"先启动一次 DSH 生成 profile"，或 `export DSH_PROFILE=web` |
| 3/5 | `node` 可用 | 给 `apt-get install -y nodejs npm` |
| 4/5 | `pnpm` 可用 | 给 `npm install -g pnpm` |
| 5/5 | **包完整性**：`files` 白名单覆盖全部相对导入 | **明确「不要强行安装」** + 重新取包命令（这就是 2026-09-21 把 DSH 装崩的那一类） |

**与 `--check` 的区别**：`install.sh --check` 遇到第一个问题就退出（你只看到一条错）；
**`doctor` 一次列全 5 项，每项都带修复命令**，所以排查时先跑 `doctor`。
全过时最后一行是 `DOCTOR-OK  5/5 通过，可以安装`；有不过则是 `DOCTOR-FAIL  N 项未通过`（退出码 = 未通过项数）。

**安全保证（都是踩过坑换来的）**：
- **安装**：先装依赖、**校验插件可解析（含真 ESM import）**，**最后才注册 bundle**；任何失败**自动回滚** `package.json` ⇒ 不会把 DSH 装到起不来。
- **卸载**：**先注销 bundle/依赖**，再删文件 ⇒ 卸载后 DSH 一定还能启动。
- **幂等**：重复 install 不会重复注册；卸载后可重复部署。
- **重启才生效**：浏览器刷新只重载客户端半体，**必须重启宿主进程**（见下节）。

## 一键部署（Linux / VPS）

```bash
# 0) 前提：DSH 已装且启动过（存在 ~/.dsh/profiles/<name>/package.json）、node 与 pnpm 可用
#    本仓库是私有库：先 gh auth login，或用带 token 的 URL
git clone --depth 1 https://github.com/qilingzon/po-gen.git /tmp/po-gen

# 1) 装（用 bash <脚本> 调用，不依赖执行位）
bash /tmp/po-gen/versions/po-gen-4-v0.4.6/install.sh

# 2) 重启 DSH 宿主进程（见下节）——不重启不生效
```

非默认 home / 多 profile 时显式指定（**无人值守场景必须给 `DSH_PROFILE`**，否则脚本会交互式问序号而卡住）：

```bash
DSH_HOME=/opt/dsh                 bash /tmp/po-gen/versions/po-gen-4-v0.4.6/install.sh
DSH_PROFILE=web                   bash /tmp/po-gen/versions/po-gen-4-v0.4.6/install.sh
DSH_HOME=/opt/dsh DSH_PROFILE=web bash /tmp/po-gen/versions/po-gen-4-v0.4.6/install.sh
```

脚本行为：检查 `$DSH_ROOT`/profile/`pnpm`（缺任一即 `exit 1`）→ 清理旧代 `dsh-infinite-gen-3` 残留 →
复制插件到 `$DSH_HOME/plugins/dsh-infinite-gen-4`（已存在先删再拷）→ 从副本移除 `.git`/`install.sh`/`*.ps1` →
**备份** profile 的 `package.json` → 用 `node -` **幂等**改写依赖与 bundles → `pnpm install` → 提示重启。

完整指南（前提表 / 逐步行为 / 5 条验证命令 / 回滚 / 已知未验证风险）见 **[`DEPLOY_LINUX.md`](DEPLOY_LINUX.md)**。

## 重启（改完必须做，否则不生效）

插件的**服务端半体**（系统提示词注入 + 工具注册）在**宿主进程启动时**加载；浏览器刷新只重载客户端半体（徽标），
**不会**重新加载插件。所以必须重启宿主进程：

| 你的 DSH 是怎么跑的 | 命令 |
| --- | --- |
| systemd（系统级） | `sudo systemctl restart <unit>`（unit 名先 `systemctl list-units | grep -i dsh`） |
| systemd（用户级） | `systemctl --user restart <unit>` |
| pm2 | `pm2 restart <name>` |
| Docker | `docker restart <container>` |
| screen / tmux | 重新 attach → `Ctrl-C` → 用原启动命令再拉起 |
| nohup / 手起 | `pkill -f 'dsh'`（确认没杀错进程）→ 用原命令重新 `nohup … &` |
| 不确定 | `ps -ef | grep -i dsh` 看启动命令行，再决定用哪种方式 |

重启后验证：`ls ~/.dsh/plugins/dsh-infinite-gen-4/index.js` 在 → **新开会话发一句「继续破甲项目」**，
预期**直接开工**（读盘 → 报现状 → 推进一项），而不是"请指明方向"或拒绝。

整台 VPS 重启：`sudo reboot`（一般**不需要**，重启 DSH 宿主进程即可）。

## 手动安装（任意平台）

将对应 `versions/po-gen-N/` 复制为 `~/.dsh/plugins/dsh-infinite-gen-N/`（或实验室 home 的 plugins/ 下），在 profile 的 `dsh.profile.bundles` 中加入 `dsh-infinite-gen-N`，重启平台生效。GUI 徽标「破甲已开启」即注入在场。
