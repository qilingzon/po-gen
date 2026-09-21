#!/usr/bin/env bash
# ============================================================================
#  po-gen 一键卸载（Linux / macOS）
#
#  用法：
#    ./uninstall.sh                 # 默认 $DSH_HOME 或 ~/.dsh
#    DSH_HOME=/opt/dsh ./uninstall.sh
#    DSH_PROFILE=web   ./uninstall.sh
#    ./uninstall.sh --keep-files    # 只注销（不动插件目录），便于日后重装
#
#  安全顺序（与安装相反，目标是"卸载后 DSH 一定还能启动"）：
#    ① 备份 profile/package.json
#    ② **先注销 bundle 与依赖**  ← 关键：宿主下次启动就不会再去解析这个插件
#    ③ 再删插件目录与 node_modules 拷贝
#    ④ 校验：bundles 里已无该插件；解析位消失（若删了文件）
#    ⑤ 任一步失败 ⇒ 自动回滚 package.json
# ============================================================================
set -uo pipefail

PLUGIN_NAME="dsh-infinite-gen-4"
OLD_PLUGIN_NAME="dsh-infinite-gen-3"
DSH_ROOT="${DSH_HOME:-$HOME/.dsh}"
KEEP_FILES=0
[[ "${1:-}" == "--keep-files" ]] && KEEP_FILES=1

step() { printf "\n==> %s\n" "$1"; }
ok()   { printf "    [OK] %s\n" "$1"; }
warn() { printf "    [!] %s\n" "$1"; }
err()  { printf "    [X] %s\n" "$1" >&2; }

PKG_PATH=""; BAK_PATH=""; UNREGISTERED=0
restore_pkg() {
  local code=$?
  if [[ $code -ne 0 && -n "$PKG_PATH" && -n "$BAK_PATH" && -f "$BAK_PATH" ]]; then
    cp "$BAK_PATH" "$PKG_PATH"
    err "卸载中断 → 已回滚 profile/package.json（$BAK_PATH）"
  fi
  exit $code
}
trap restore_pkg EXIT

find_profile_dir() {
  local root="$1/profiles"
  if [[ -n "${DSH_PROFILE:-}" && -f "$root/$DSH_PROFILE/package.json" ]]; then echo "$root/$DSH_PROFILE"; return 0; fi
  for n in web default; do [[ -f "$root/$n/package.json" ]] && { echo "$root/$n"; return 0; }; done
  local dirs=(); for d in "$root"/*/; do [[ -f "$d/package.json" ]] && dirs+=("$d"); done
  [[ ${#dirs[@]} -eq 1 ]] && { echo "${dirs[0]}"; return 0; }
  return 1
}

step "定位 DSH 与 profile"
[[ -d "$DSH_ROOT" ]] || { err "未找到 DSH 目录：$DSH_ROOT（可用 DSH_HOME 指定）"; exit 1; }
PROFILE_DIR="$(find_profile_dir "$DSH_ROOT" 2>/dev/null || true)"
[[ -n "$PROFILE_DIR" ]] || { err "未找到 profile 目录"; exit 1; }
PKG_PATH="$PROFILE_DIR/package.json"
ok "DSH_HOME   : $DSH_ROOT"
ok "profile    : $PROFILE_DIR"

command -v node >/dev/null 2>&1 || { err "未检测到 node（注销需要改 JSON）"; exit 1; }

step "备份 profile/package.json"
BAK_PATH="$PKG_PATH.bak-uninstall-$(date +%Y%m%d-%H%M%S)"
cp "$PKG_PATH" "$BAK_PATH"
ok "备份：$BAK_PATH"

step "注销 bundle 与依赖（先做这一步，宿主就不会再解析它）"
node - "$PKG_PATH" "$PLUGIN_NAME" "$OLD_PLUGIN_NAME" <<'NODE'
const fs = require("fs");
const [p, name, oldName] = process.argv.slice(2);
const o = JSON.parse(fs.readFileSync(p, "utf8"));
o.dependencies = o.dependencies || {};
delete o.dependencies[name];
delete o.dependencies[oldName];
o.dsh = o.dsh || {};
o.dsh.profile = o.dsh.profile || {};
o.dsh.profile.bundles = (o.dsh.profile.bundles || []).filter((b) => b !== name && b !== oldName);
fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n");
console.log("bundles 现在 = " + JSON.stringify(o.dsh.profile.bundles));
NODE
UNREGISTERED=1
ok "已从 bundles / dependencies 移除"

step "校验注销结果"
if node -e '
const fs=require("fs");const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const b=(o.dsh&&o.dsh.profile&&o.dsh.profile.bundles)||[];
const d=(o.dependencies||{})["dsh-infinite-gen-4"];
if(b.includes("dsh-infinite-gen-4")||d){console.error("仍有残留");process.exit(1)}
' "$PKG_PATH"; then
  ok "profile 已无该插件的 bundle / 依赖"
else
  err "注销未生效"; exit 1
fi

if [[ $KEEP_FILES -eq 1 ]]; then
  step "保留文件模式（--keep-files）"
  warn "插件目录与 node_modules 拷贝**未删除**，仅完成注销"
else
  step "删除插件文件"
  for d in "$DSH_ROOT/plugins/$PLUGIN_NAME" "$DSH_ROOT/plugins/$OLD_PLUGIN_NAME"; do
    if [[ -d "$d" ]]; then rm -rf "$d"; ok "已删除：$d"; else ok "不存在（跳过）：$d"; fi
  done
  for d in "$PROFILE_DIR/node_modules/$PLUGIN_NAME" \
           "$PROFILE_DIR/node_modules/$PLUGIN_NAME.profile-copy-disabled" \
           "$DSH_ROOT/node_modules/$PLUGIN_NAME"; do
    if [[ -d "$d" ]]; then rm -rf "$d"; ok "已删除解析位：$d"; else ok "不存在（跳过）：$d"; fi
  done
  # .pnpm 下的物化副本交给 pnpm 自己管；留着不影响启动（bundle 已注销）
  warn "pnpm 的 .pnpm 缓存未动（无害；要彻底清可跑：cd $PROFILE_DIR && pnpm install）"
fi

step "卸载完成"
cat <<EOF

  ✔ 已卸载 $PLUGIN_NAME
  备份（如需还原）：$BAK_PATH

  最后一步：**重启 DSH 宿主进程**（浏览器刷新只重载客户端半体）
    systemctl restart <unit>  /  pm2 restart <name>  /  docker restart <container>
    不确定：ps -ef | grep -i dsh

  还原：cp "$BAK_PATH" "$PKG_PATH" 然后重启宿主
EOF

trap - EXIT
exit 0