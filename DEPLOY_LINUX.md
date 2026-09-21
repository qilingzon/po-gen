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

# ③ 重启 DSH 宿主进程（`./po-gen.sh install` 已自动做；直调 install.sh 时手动做，见第 3 节）
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
浏览器刷新只重载**客户端半体**（徽标），**不会**重新加载插件。所以必须重启**宿主进程**。

**首选：用一键入口重启**（`install` / `update` / `uninstall` 成功后已自动做这一步）：

```bash
./po-gen.sh restart --dry-run    # 只看：会 kill 哪个 PID、原命令行是什么
./po-gen.sh restart              # 真做：kill -TERM → 等退出 → 探测新 PID
# 关掉自动重启：PO_GEN_NO_RESTART=1
```

探测规则（`ps -eo pid=,args=`）：命中 `node … dsh web|serve|--port`；排除 `dsh-keeper`、`po-gen.sh` 自身、`grep`；
`DSH Desktop` 单独识别（提示手动完全退出重开）。有 keeper 时会明确告知"kill 后会自动拉起"。

**兜底：按你的启动方式手动重启**

| DSH 的启动方式 | 重启命令 |
| --- | --- |
| systemd（系统级） | `sudo systemctl restart <unit>`（先 `systemctl list-units \| grep -i dsh` 找 unit 名） |
| systemd（用户级） | `systemctl --user restart <unit>` |
| pm2 | `pm2 restart <name>` |
| Docker | `docker restart <container>` |
| screen / tmux | 重新 attach → `Ctrl-C` → 用原启动命令再拉起 |
| nohup / 手起 | `kill <宿主PID>`（确认没杀错）→ 原命令重新 `nohup … &` |
| keeper 守护（如 `/root/dsh-keeper.sh`） | `kill <宿主PID>`，keeper 会自己拉新进程 |
| **不确定** | `ps -eo pid=,args= \| grep -i dsh` 看启动命令行，再决定用哪种方式 |

**关键判据：`status` 全绿 ≠ 宿主已加载。** 若 `status` 里 `解析位 存在` / `解析位preheat 存在` 但徽标不出、行为没变，
就是**盘上新的、跑着的宿主是旧的** —— 重启即可；`status` 会直接提示
`[!] 插件文件比宿主进程新 → 宿主跑的还是旧副本，需要 restart`。
重启后 `tail -50 /var/log/dsh.err.log` 应**不再出现** `ERR_MODULE_NOT_FOUND … preheat.js` 与
`plugin tree failed to load`（这两行 = 12:41 那次旧包启动留下的）。

整台 VPS 重启：`sudo reboot` —— **一般不需要**，重启 DSH 宿主进程即可。

## 4. 脚本会做什么（静态审查所得，v0.4.6 安全顺序）

1. `[0]` 体检模式 `--doctor`：一次列全 5 项不通过项 + 每项给处置命令（`--check` 只报第一个问题）
2. `[1]` 检查 `$DSH_ROOT` 存在、探测 profile 目录（`DSH_PROFILE` → `web` → `default` → 唯一目录 → 交互选择）、检查 `pnpm`
3. `[1.5]` **包完整性闸门**：`files` 白名单必须覆盖全部相对导入 —— 不通过则**拒绝安装**（2026-09-21 装崩 DSH 的就是这一项）
4. `[2]` 复制插件到 `$DSH_HOME/plugins/dsh-infinite-gen-4`（先删旧代 `dsh-infinite-gen-3` 残留；副本里移除 `.git`/`install.sh`/`uninstall.sh`/`*.ps1`）
5. `[3]` **备份** profile 的 `package.json` → `package.json.bak-<YYYYmmdd-HHMMSS>`
6. `[4]` **只加依赖**（`file:../../plugins/dsh-infinite-gen-4`），**先不注册 bundle**
7. `[5]` 跑 `pnpm install`（`node_modules` 里物化出 `index.js` + `preheat.js`）
8. `[6]` **注册之前**校验插件可解析：文件齐 + 真 ESM `import()` 冒烟
9. `[7]` 校验通过，**才**把 `dsh-infinite-gen-4` 写进 `dsh.profile.bundles`
10. `[8]` 完成提示；走 `po-gen.sh install` 时接着**自动重启宿主**

> 顺序为什么必须是这个：**bundle 已注册却解析不到 = DSH 启动即崩**。
> 任一步失败会 `trap` 恢复 `package.json` 备份，绝不让宿主起不来。

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
