# DEPLOY_LINUX.md —— Linux / VPS 一键部署指南

> 目标版本：**po-gen-4 v0.4.6**（`versions/po-gen-4-v0.4.6/`）
> 平台：Linux / macOS（Windows 用户走根目录 `install.ps1`）
>
> **诚实声明**：本文命令来自对 `install.sh` 的**静态审查**，**尚未在真实 Linux 主机上端到端验证过**
> （编写时本机无可用 Linux 环境：WSL 无发行版、Docker 拉不到镜像）。请照第 4 节验证；
> 若某步失败，把输出贴回仓库 issue，按输出修。

---

## 1. 前提（缺一不可）

| # | 前提 | 检查命令 | 不满足时的表现 |
| --- | --- | --- | --- |
| 1 | **DSH 已装且至少启动过一次**（存在 `~/.dsh/profiles/<name>/package.json`） | `ls ~/.dsh/profiles/*/package.json` | 脚本 `exit 1`：未找到 DSH 目录 / profile |
| 2 | **node**（脚本用 `node -` 改 `package.json`） | `node -v` | `node: command not found` |
| 3 | **pnpm** | `pnpm -v` | 脚本 `exit 1`：未检测到 pnpm（`npm i -g pnpm`） |
| 4 | **仓库读取权限**（`po-gen` 是**私有库**） | `gh auth status` | `git clone` 要求用户名密码 |

## 2. 一键部署（三条命令）

```bash
# ① 取仓库（私有库：先 gh auth login，或用 https://<token>@github.com/... 形式）
git clone --depth 1 https://github.com/qilingzon/po-gen.git /tmp/po-gen

# ② 装（用 bash <脚本> 调用，不依赖执行位）
bash /tmp/po-gen/versions/po-gen-4-v0.4.6/install.sh

# ③ 重启 DSH 宿主进程（见第 3 节）——不重启不生效
```

**非默认位置 / 多 profile 时**：

```bash
DSH_HOME=/opt/dsh                 bash /tmp/po-gen/versions/po-gen-4-v0.4.6/install.sh
DSH_PROFILE=web                   bash /tmp/po-gen/versions/po-gen-4-v0.4.6/install.sh
DSH_HOME=/opt/dsh DSH_PROFILE=web bash /tmp/po-gen/versions/po-gen-4-v0.4.6/install.sh
```

> ⚠ 若 `~/.dsh/profiles` 下有**多个**含 `package.json` 的目录，脚本会**交互式**列出让你输序号 ——
> **无人值守（ssh 非交互 / CI）必须显式给 `DSH_PROFILE`**，否则会卡住。

## 3. 重启（改完必须做）

插件的**服务端半体**（系统提示词注入 + 工具注册）在**宿主进程启动时**加载；
浏览器刷新只重载**客户端半体**（徽标），**不会**重新加载插件。所以必须重启**宿主进程**：

| DSH 的启动方式 | 重启命令 |
| --- | --- |
| systemd（系统级） | `sudo systemctl restart <unit>`（先 `systemctl list-units \| grep -i dsh` 找 unit 名） |
| systemd（用户级） | `systemctl --user restart <unit>` |
| pm2 | `pm2 restart <name>` |
| Docker | `docker restart <container>` |
| screen / tmux | 重新 attach → `Ctrl-C` → 用原启动命令再拉起 |
| nohup / 手起 | `pkill -f 'dsh'`（确认没杀错）→ 原命令重新 `nohup … &` |
| **不确定** | `ps -ef \| grep -i dsh` 看启动命令行，再决定用哪种方式 |

整台 VPS 重启：`sudo reboot` —— **一般不需要**，重启 DSH 宿主进程即可。

## 4. 脚本会做什么（静态审查所得）

1. 检查 `$DSH_ROOT` 存在 → 否则 `exit 1`
2. 探测 profile 目录（`DSH_PROFILE` → `web` → `default` → 唯一目录 → 交互选择）
3. 检查 `pnpm` 可用 → 否则 `exit 1`
4. **删除旧代目录** `$DSH_HOME/plugins/dsh-infinite-gen-3`（如存在）
5. 复制插件到 `$DSH_HOME/plugins/dsh-infinite-gen-4`（已存在则先删再拷）
6. 从副本里**移除** `.git` / `install.sh` / `uninstall.sh` / `*.ps1`
7. **备份** profile 的 `package.json` → `package.json.bak-<YYYYmmdd-HHMMSS>`
8. 用 `node -` **幂等**改写 profile `package.json`（加依赖 `file:../../plugins/dsh-infinite-gen-4` + bundles 条目）
9. 跑 `pnpm install`
10. 提示重启

## 5. 验证（5 条全对才算成功）

```bash
# 1) 插件目录在
ls -la ~/.dsh/plugins/dsh-infinite-gen-4/index.js \
       ~/.dsh/plugins/dsh-infinite-gen-4/preheat.js \
       ~/.dsh/plugins/dsh-infinite-gen-4/prompts/preheat-card.md

# 2) 包身份正确（B23：必须等于注册 id，否则 profile 起不来、模型 0 调用）
node -e "console.log(require(process.env.HOME+'/.dsh/plugins/dsh-infinite-gen-4/package.json').name)"
#   期望： dsh-infinite-gen-4

# 3) 版本串（期望 0.4.6）
node -e "console.log(require(process.env.HOME+'/.dsh/plugins/dsh-infinite-gen-4/package.json').version)"
grep -m1 'version:' ~/.dsh/plugins/dsh-infinite-gen-4/index.js

# 4) profile 已被改写（应有 file: 依赖 + bundles 里出现 dsh-infinite-gen-4）
grep -n 'dsh-infinite-gen-4' ~/.dsh/profiles/*/package.json
ls ~/.dsh/profiles/*/package.json.bak-*        # 备份应在

# 5) 插件能被 Node 解析（ESM 导入冒烟）
node --input-type=module -e "import('$HOME/.dsh/plugins/dsh-infinite-gen-4/index.js').then(m=>console.log('IMPORT-OK',Object.keys(m).join(',')))"
#   期望： IMPORT-OK apply,inject,name
```

**最后一步是真验证**：按第 3 节重启宿主 → **新开一个会话发「继续破甲项目」** →
预期**直接开工**（读盘 → 报现状 → 推进一项），而不是"请指明方向"或拒绝。

## 6. 回滚

```bash
# A) 用仓库自带卸载脚本
bash /tmp/po-gen/versions/po-gen-4-v0.4.6/uninstall.sh

# B) 手工：恢复备份的 package.json + 删插件目录
cp ~/.dsh/profiles/<profile>/package.json.bak-<ts> ~/.dsh/profiles/<profile>/package.json
rm -rf ~/.dsh/plugins/dsh-infinite-gen-4
# 然后按第 3 节重启宿主
```

## 7. 已知风险（未验证项，按可能出问题的顺序）

1. **`pnpm install` 在 VPS 上可能需要网络 / registry** —— 最后一步若失败，插件文件已就位但 profile 依赖可能没装好。
2. **多 profile 的交互式选择**在无人值守（CI / ssh 非交互）下会**卡住** —— 必须显式 `DSH_PROFILE`。
3. **`node` 版本**：脚本用 `node -` 读 heredoc，Node 18+ 均可；过老版本可能不认。
4. **行尾**：`install.sh` 已验**纯 LF**（仓库 blob CR=0），`.gitattributes` 强制 `*.sh eol=lf`；
   其余 `.js/.md/.json` 走 `text=auto`，Linux 上 checkout 为 LF，不影响运行。
