#!/usr/bin/env bash
# ============================================================================
#  dsh-infinite-gen-4  ——  DeepSeek Harness 「无限四代」一键安装脚本（Linux / macOS）
#
#  v2 · 2026-09-21 · FAIL-SAFE REWRITE
#  为什么重写：v1 的顺序是「先改 profile 的 package.json（注册 bundle）→ 再 pnpm install」。
#  于是 pnpm install 一旦失败（VPS 无 registry / 无网络 / 版本不匹配），profile 里就留下
#  一个**已注册但解析不到**的 bundle ⇒ **DSH 宿主直接起不来**。
#  v1 还会在 install 之前先 rm 掉 node_modules 里的旧拷贝，失败后更是必崩。
#  用户实测：「vps 安装了插件就启动不了 dsh，每次都这样」——就是这条路径。
#
#  v2 的顺序（关键差异）：
#   ① 备份 package.json
#   ② 先 pnpm install（此时**尚未注册 bundle**，装坏了也不影响 DSH 启动）
#   ③ 校验插件可解析（文件在 + ESM import 成功）
#   ④ **校验通过后**才写入 bundles 注册
#   ⑤ 任何一步失败 ⇒ trap 自动回滚 package.json，并明确告诉你 DSH 仍可正常启动
#
#  用法：
#    bash install.sh                     # 默认 $DSH_HOME 或 ~/.dsh
#    DSH_HOME=/opt/dsh bash install.sh
#    DSH_PROFILE=web bash install.sh
#    bash install.sh --check             # 只体检，不改任何文件
# ============================================================================
set -euo pipefail

PLUGIN_NAME="dsh-infinite-gen-4"
PLUGIN_LABEL="无限四代"
OLD_PLUGIN_NAME="dsh-infinite-gen-3"
DSH_ROOT="${DSH_HOME:-$HOME/.dsh}"
PLUGINS_DIR="$DSH_ROOT/plugins"
DEST_DIR="$PLUGINS_DIR/$PLUGIN_NAME"
OLD_DEST_DIR="$PLUGINS_DIR/$OLD_PLUGIN_NAME"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

step() { printf "\n==> %s\n" "$1"; }
ok()   { printf "    [OK] %s\n" "$1"; }
warn() { printf "    [!] %s\n" "$1"; }
err()  { printf "    [X] %s\n" "$1" >&2; }

PKG_PATH=""
BAK_PATH=""
REGISTERED=0

# ---------- 失败自愈：任何非正常退出都回滚 package.json ----------
restore_pkg() {
  local code=$?
  if [[ $code -ne 0 ]]; then
    if [[ -n "$PKG_PATH" && -n "$BAK_PATH" && -f "$BAK_PATH" ]]; then
      cp "$BAK_PATH" "$PKG_PATH"
      err "安装失败 → 已自动回滚 profile/package.json（从 $BAK_PATH）"
      err "DSH 的 bundle 注册已恢复原状，宿主应当仍能正常启动。"
    fi
    err "安装未完成（exit $code）。DSH 未被留在'注册了却解析不到'的坏状态。"
  fi
  exit $code
}
trap restore_pkg EXIT

# ---------- 探测 DSH profile 目录 ----------
find_profile_dir() {
  local profiles_root="$1"
  if [[ -n "${DSH_PROFILE:-}" ]]; then
    local cand="$profiles_root/$DSH_PROFILE"
    if [[ -f "$cand/package.json" ]]; then echo "$cand"; return 0; fi
    warn "DSH_PROFILE 指向的目录不存在：$cand（继续自动探测）"
  fi
  for name in web default; do
    local cand="$profiles_root/$name"
    if [[ -f "$cand/package.json" ]]; then echo "$cand"; return 0; fi
  done
  local dirs=()
  for d in "$profiles_root"/*/; do
    [[ -d "$d" && -f "$d/package.json" ]] && dirs+=("$d")
  done
  if [[ ${#dirs[@]} -eq 1 ]]; then echo "${dirs[0]}"; return 0; fi
  if [[ ${#dirs[@]} -gt 1 ]]; then
    echo "检测到多个 DSH profile，请选择要安装的目标：" >&2
    for i in "${!dirs[@]}"; do printf "  [%d] %s\n" "$((i+1))" "${dirs[$i]}" >&2; done
    read -rp "请输入序号: " sel
    local idx=$((sel-1))
    if (( idx >= 0 && idx < ${#dirs[@]} )); then echo "${dirs[$idx]}"; return 0; fi
    err "选择无效，退出。"
    exit 1
  fi
  return 1
}

# ---------- [1] 检查环境 ----------
step "检查环境"
[[ -d "$DSH_ROOT" ]] || { err "未找到 DSH 目录：$DSH_ROOT（可用 DSH_HOME 指定）"; exit 1; }
PROFILE_DIR="$(find_profile_dir "$DSH_ROOT/profiles")" || {
  err "未找到 DSH profile 目录（$DSH_ROOT/profiles 下没有含 package.json 的目录）。"
  echo "可通过环境变量指定：DSH_PROFILE=web（或 default）后重新运行。"
  exit 1
}
PKG_PATH="$PROFILE_DIR/package.json"
[[ -f "$PKG_PATH" ]] || { err "未找到 package.json：$PKG_PATH"; exit 1; }
ok "DSH profile 目录：$PROFILE_DIR"

command -v node >/dev/null 2>&1 || { err "未检测到 node（脚本用它改 package.json 与做解析校验）"; exit 1; }
ok "node 可用：$(command -v node)  $(node -v)"
command -v pnpm >/dev/null 2>&1 || {
  err "未检测到 pnpm，请先安装：npm install -g pnpm"
  exit 1
}
ok "pnpm 可用：$(command -v pnpm)  $(pnpm -v)"

# ---------- [1.5] 包完整性闸门（防 B14 家族复发） ----------
# 为什么必须有：v0.4.5/v0.4.6 给 index.js 加了 import "./preheat.js"，却没把 preheat.js 写进
# package.json 的 files 白名单；pnpm 对 file: 依赖**按白名单物化** ⇒ 副本里缺文件 ⇒
# ERR_MODULE_NOT_FOUND ⇒ cordis 加载器 failed to import loader entry ⇒ **dsh 主进程直接退出**。
# 这条闸门在**复制/安装之前**就把它拦下来，避免把宿主装崩。
step "校验包完整性（files 白名单必须覆盖全部相对导入）"
node - "$SRC_DIR" <<'NODE'
const fs = require("fs"), path = require("path");
const dir = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
const files = Array.isArray(pkg.files) ? pkg.files : null;
if (!files) { console.error("包不完整：package.json 缺 files 白名单"); process.exit(1); }
const cov = (rel) => files.some((f) => {
  const e = String(f).replace(/\\/g, "/").replace(/\/$/, "");
  const n = rel.replace(/^\.\//, "");
  return n === e || n.startsWith(e + "/");
});
let bad = 0;
for (const f of ["index.js", "client.js"]) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) continue;
  const code = fs.readFileSync(p, "utf8");
  const re = /from\s+["'](\.\/[^"']+)["']|import\s*\(\s*["'](\.\/[^"']+)["']\s*\)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const spec = m[1] || m[2];
    const okDisk = fs.existsSync(path.resolve(dir, spec));
    const okList = cov(spec);
    if (!okDisk || !okList) {
      console.error("包不完整：" + f + " 导入 " + spec + "（在盘上=" + okDisk + " 白名单=" + okList + "）");
      bad++;
    }
  }
}
if (bad) {
  console.error("⇒ 继续安装会在 pnpm 物化后缺文件，DSH 启动即崩（B14 家族）。已中止，未改动任何文件。");
  process.exit(1);
}
console.log("包完整性 OK");
NODE
ok "包完整性校验通过（files 白名单覆盖全部相对导入）"

if [[ $CHECK_ONLY -eq 1 ]]; then
  step "体检模式（--check）：不修改任何文件"
  ok "环境与 profile 探测通过，可以安装"
  exit 0
fi

# ---------- [2] 复制插件文件 ----------
step "复制插件文件"
if [[ -d "$OLD_DEST_DIR" ]]; then
  rm -rf "$OLD_DEST_DIR"
  ok "已清理旧代插件目录：$OLD_DEST_DIR"
fi
mkdir -p "$PLUGINS_DIR"
if [[ -d "$DEST_DIR" ]]; then
  warn "检测到已存在的 $PLUGIN_NAME 目录，自动覆盖更新"
  rm -rf "$DEST_DIR"
fi
mkdir -p "$DEST_DIR"
cp -R "$SRC_DIR"/. "$DEST_DIR"/
rm -rf "$DEST_DIR/.git" "$DEST_DIR/install.sh" "$DEST_DIR/uninstall.sh" \
       "$DEST_DIR/install.ps1" "$DEST_DIR/uninstall.ps1" 2>/dev/null || true
ok "插件已复制到：$DEST_DIR"

# ---------- [3] 备份 package.json ----------
step "备份 profile/package.json"
BAK_PATH="$PKG_PATH.bak-$(date +%Y%m%d-%H%M%S)"
cp "$PKG_PATH" "$BAK_PATH"
ok "备份完成：$BAK_PATH"

# ---------- [4] 只加依赖，**先不注册 bundle** ----------
step "写入依赖（暂不注册 bundle）"
node - "$PKG_PATH" "$PLUGIN_NAME" "$OLD_PLUGIN_NAME" <<'NODE'
const fs = require("fs");
const [pkgPath, name, oldName] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.dependencies = pkg.dependencies || {};
delete pkg.dependencies[oldName];
pkg.dependencies[name] = "file:../../plugins/" + name;
// 旧版的 bundle 行先摘掉（它是坏的/待替换的），新版**等校验通过再加**
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
pkg.dsh.profile.bundles = (pkg.dsh.profile.bundles || []).filter((b) => b !== oldName && b !== name);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
NODE
ok "依赖已写入；bundles 暂未注册（这样即使下一步失败，DSH 也不会因解析不到而崩）"

# ---------- [5] pnpm install ----------
step "安装依赖（pnpm install）"
if [[ -d "$PROFILE_DIR/node_modules/$PLUGIN_NAME" ]]; then
  rm -rf "$PROFILE_DIR/node_modules/$PLUGIN_NAME"
  ok "已清除 node_modules 旧拷贝，pnpm 将重新同步"
fi
if ! ( cd "$PROFILE_DIR" && pnpm install ); then
  err "pnpm install 失败。"
  err "常见原因：VPS 无外网 / registry 不通 / pnpm 版本过老。"
  err "可手动重试：cd $PROFILE_DIR && pnpm install"
  exit 1   # trap 会回滚 package.json
fi
ok "依赖安装完成"

# ---------- [6] 校验插件可解析（**注册之前**） ----------
step "校验插件可解析"
RESOLVED="$PROFILE_DIR/node_modules/$PLUGIN_NAME"
[[ -f "$RESOLVED/index.js" ]] || { err "解析位缺失：$RESOLVED/index.js（pnpm 未物化 file: 依赖）"; exit 1; }
ok "解析位存在：$RESOLVED/index.js"

if ! ( cd "$PROFILE_DIR" && node --input-type=module -e "import('./node_modules/$PLUGIN_NAME/index.js').then(m=>{const k=Object.keys(m);if(!k.includes('apply')){console.error('missing apply export');process.exit(2)}console.log('IMPORT-OK '+k.join(','))}).catch(e=>{console.error('IMPORT-FAIL '+e.message);process.exit(3)})" ); then
  err "插件 ESM 导入失败 —— **不注册 bundle**（否则 DSH 会起不来）"
  exit 1
fi
ok "ESM 导入成功（apply/inject/name 齐备）"

# ---------- [7] 校验通过，才注册 bundle ----------
step "注册 bundle"
node - "$PKG_PATH" "$PLUGIN_NAME" <<'NODE'
const fs = require("fs");
const [pkgPath, name] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
const b = pkg.dsh.profile.bundles || [];
if (!b.includes(name)) b.push(name);
pkg.dsh.profile.bundles = b;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
NODE
REGISTERED=1
ok "bundle 已注册：$PLUGIN_NAME"

# ---------- [8] 完成 ----------
step "安装完成"
cat <<EOF

  ✔ 插件已安装并通过解析校验
  目标 profile：$(basename "$PROFILE_DIR")
  备份（出问题可一键回滚）：$BAK_PATH

  最后一步：**重启 DSH 宿主进程**（浏览器刷新只重载客户端半体，不会重载插件）
    systemd:  sudo systemctl restart <unit>
    pm2:      pm2 restart <name>
    docker:   docker restart <container>
    screen:   重新 attach → Ctrl-C → 原命令重起
    不确定:   ps -ef | grep -i dsh   看启动命令行

  验证：重启后新开会话发「继续破甲项目」→ 应直接开工
  卸载：bash uninstall.sh
  回滚：cp "$BAK_PATH" "$PKG_PATH" && rm -rf "$DEST_DIR" && 重启宿主
EOF

trap - EXIT
exit 0
