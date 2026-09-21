#!/usr/bin/env bash
# ============================================================================
#  po-gen 一键工具（Linux / macOS）
#
#  用法：
#    ./po-gen.sh install     [--version v0.4.6] [--home PATH] [--profile NAME]
#    ./po-gen.sh uninstall   [--version v0.4.6] [--home PATH] [--profile NAME]
#    ./po-gen.sh update      [--version v0.4.6] [--home PATH] [--profile NAME]
#    ./po-gen.sh restart     [--dry-run]     # 重启宿主（插件服务端半体只在宿主启动时加载）
#    ./po-gen.sh doctor      [--home PATH] [--profile NAME]
#    ./po-gen.sh status      [--home PATH] [--profile NAME]
#    ./po-gen.sh list
#
#  也可以完全不用克隆（单命令入口，仓库是公开库）：
#    curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s install
#    curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s update
#    curl -fsSL https://raw.githubusercontent.com/qilingzon/po-gen/master/po-gen.sh | bash -s uninstall
#
#  设计要点（都是踩过的坑）：
#   · **安装顺序**：先装依赖、校验可解析，**最后才注册 bundle** ——
#     bundle 已注册却解析不到 = DSH 启动即崩（2026-09-21 真实事故）。
#   · **包完整性闸门**：`files` 白名单必须覆盖全部相对导入（preheat.js 那次就是漏在这）。
#   · **任何失败自动回滚** profile 的 package.json，绝不让宿主起不来。
#   · **浏览器刷新不生效**：必须重启宿主进程。install/update 成功后会自动重启
#     （`PO_GEN_NO_RESTART=1` 可关闭；`--dry-run` 只看不做）。
# ============================================================================
set -uo pipefail

REPO_URL="${PO_GEN_REPO:-https://github.com/qilingzon/po-gen.git}"
CACHE="${PO_GEN_CACHE:-$HOME/.po-gen-src}"
PLUGIN_NAME="dsh-infinite-gen-4"

step() { printf "\n==> %s\n" "$1"; }
ok()   { printf "    [OK] %s\n" "$1"; }
warn() { printf "    [!] %s\n" "$1"; }
err()  { printf "    [X] %s\n" "$1" >&2; }
info() { printf "    %s\n" "$1"; }

# ---------- 自举：不在仓库里就克隆/更新缓存，然后重入 ----------
SELF="${BASH_SOURCE[0]:-$0}"
SELF_DIR=""
if [[ -f "$SELF" ]]; then SELF_DIR="$(cd "$(dirname "$SELF")" && pwd)"; fi

if [[ -z "$SELF_DIR" || ! -d "$SELF_DIR/versions" ]]; then
  echo "[bootstrap] 未在仓库内运行 → 使用缓存 $CACHE"
  if [[ -d "$CACHE/.git" ]]; then
    git -C "$CACHE" pull --ff-only >/dev/null 2>&1 && echo "[bootstrap] 已更新缓存" || echo "[bootstrap] 更新失败，用现有缓存"
  else
    git clone --depth 1 "$REPO_URL" "$CACHE" || { echo "[bootstrap] 克隆失败：$REPO_URL"; exit 1; }
  fi
  exec bash "$CACHE/po-gen.sh" "$@"
fi

# ---------- 参数解析 ----------
ACTION="${1:-}"; shift || true
VER=""; DSH_HOME_ARG=""; DSH_PROFILE_ARG=""; DRY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VER="${2:-}"; shift 2 ;;
    --home)    DSH_HOME_ARG="${2:-}"; shift 2 ;;
    --profile) DSH_PROFILE_ARG="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) ACTION="help"; shift ;;
    *) err "未知参数：$1"; exit 2 ;;
  esac
done
[[ -n "$DSH_HOME_ARG" ]] && export DSH_HOME="$DSH_HOME_ARG"
[[ -n "$DSH_PROFILE_ARG" ]] && export DSH_PROFILE="$DSH_PROFILE_ARG"
DSH_ROOT="${DSH_HOME:-$HOME/.dsh}"
[[ "${PO_GEN_DRY:-0}" == "1" ]] && DRY=1

# ---------- 版本解析 ----------
list_versions() {
  local d
  for d in "$SELF_DIR"/versions/po-gen-4-v*; do
    [[ -d "$d" ]] || continue
    basename "$d" | sed 's/^po-gen-4-//'
  done
}
latest_version() { list_versions | sort -V | tail -1; }

if [[ -z "$VER" ]]; then VER="$(latest_version)"; fi
VDIR="$SELF_DIR/versions/po-gen-4-$VER"
[[ -d "$VDIR" ]] || { err "找不到版本目录：$VDIR"; echo "可用版本："; list_versions | sed 's/^/    /'; exit 1; }

find_profile_dir() {
  local root="$1/profiles"
  if [[ -n "${DSH_PROFILE:-}" && -f "$root/$DSH_PROFILE/package.json" ]]; then echo "$root/$DSH_PROFILE"; return 0; fi
  for n in web default; do [[ -f "$root/$n/package.json" ]] && { echo "$root/$n"; return 0; }; done
  local dirs=(); for d in "$root"/*/; do [[ -f "$d/package.json" ]] && dirs+=("$d"); done
  [[ ${#dirs[@]} -eq 1 ]] && { echo "${dirs[0]}"; return 0; }
  return 1
}

# ---------- 宿主进程探测（重启用） ----------
# 只认「node 跑 dsh 的 web/serve 进程」，排除 keeper 与本次脚本自身。
dsh_host_pids() {
  ps -eo pid=,args= 2>/dev/null | awk -v self="$$" '
    {
      pid = $1
      $1 = ""
      args = $0
      if (pid == self) next
      if (args !~ /node/) next
      if (args !~ /dsh/) next
      if (args !~ /(web|serve|--port)/) next
      if (args ~ /dsh-keeper/) next
      if (args ~ /po-gen/) next
      if (args ~ /grep/) next
      print pid
    }'
}

# 桌面端（Electron）宿主：参数里是 "DSH Desktop"，不是 node dsh web
desktop_pids() {
  ps -eo pid=,args= 2>/dev/null | awk -v self="$$" '
    { pid=$1; $1=""; args=$0
      if (pid == self) next
      if (args ~ /DSH Desktop/ && args !~ /grep/) print pid }'
}

keeper_pids() {
  ps -eo pid=,args= 2>/dev/null | awk -v self="$$" '
    { pid=$1; $1=""; args=$0
      if (pid == self) next
      if (args ~ /dsh-keeper/) print pid }'
}

host_args_of() {
  local want="$1"
  ps -eo pid=,args= 2>/dev/null | awk -v w="$want" '
    { pid=$1; $1=""; args=$0
      if (pid == w) { sub(/^ +/, "", args); print args; exit } }'
}

# 重启宿主：插件服务端半体只在宿主进程启动时加载，刷新浏览器无效。
do_restart() {
  local pids newpids keep dpid
  pids="$(dsh_host_pids)"
  keep="$(keeper_pids)"
  dpid="$(desktop_pids | head -1)"

  if [[ -z "$pids" ]]; then
    warn "没有发现运行中的 dsh 宿主进程"
    if [[ -n "$dpid" ]]; then
      info "检测到桌面端 DSH Desktop（PID $dpid）→ 服务端半体同样只在进程启动时加载"
      info "请完全退出 DSH Desktop 再重新打开（退出到托盘图标也没了为止）"
      return 0
    fi
    if [[ -n "$keep" ]]; then ok "检测到 keeper（PID $(echo $keep | tr '\n' ' ')），它会自行拉起宿主"
    else info "请手动启动宿主（例如：dsh web --port 3080 --host 127.0.0.1 --no-open）"; fi
    return 0
  fi

  info "当前宿主 PID：$(echo $pids | tr '\n' ' ')"
  local first; first="$(echo "$pids" | head -1)"
  local cmdline; cmdline="$(host_args_of "$first")"
  info "原启动命令  ：$cmdline"
  [[ -n "$keep" ]] && info "keeper      ：PID $(echo $keep | tr '\n' ' ')（宿主退出后会自动拉起）"

  if [[ "$DRY" == "1" ]]; then
    info "[dry-run] 不会真的 kill；真实执行时会：kill -TERM 上述 PID，等待最多 20 秒，再探测新 PID"
    return 0
  fi

  kill $pids 2>/dev/null || true
  local i
  for i in $(seq 1 20); do
    sleep 1
    [[ -z "$(dsh_host_pids)" ]] || break
  done
  # 给 keeper 一点时间拉起
  for i in $(seq 1 10); do
    [[ -n "$(dsh_host_pids)" ]] && break
    sleep 1
  done

  newpids="$(dsh_host_pids)"
  if [[ -n "$newpids" ]]; then
    ok "宿主已重启，新 PID：$(echo $newpids | tr '\n' ' ')"
    return 0
  fi
  warn "宿主退出后没有自动回来（没有 keeper 或 keeper 未生效）"
  info "手动启动命令（沿用原参数）："
  info "  $cmdline"
  return 1
}

# 安装后收尾：默认自动重启（PO_GEN_NO_RESTART=1 关闭）
post_install_restart() {
  step "下一步：重启宿主（必做）"
  info "插件服务端半体只在宿主进程启动时加载；刷新浏览器只会重载客户端半体（徽标）。"
  if [[ "${PO_GEN_NO_RESTART:-0}" == "1" ]]; then
    warn "已设置 PO_GEN_NO_RESTART=1 → 跳过自动重启"
    info "请手动执行：$0 restart   或   kill <宿主PID>（有 keeper 会自动拉起）"
    return 0
  fi
  do_restart
}

case "$ACTION" in
  help|"")
    sed -n '3,22p' "$SELF" | sed 's/^# \{0,1\}//'
    exit 0
    ;;

  list)
    step "可用版本（$SELF_DIR/versions）"
    for v in $(list_versions); do
      printf "    %-12s %s\n" "$v" "$([[ "$v" == "$VER" ]] && echo '← 最新' || echo '')"
    done
    exit 0
    ;;

  status)
    step "安装状态"
    echo "    DSH_HOME   : $DSH_ROOT"
    PD="$(find_profile_dir "$DSH_ROOT" 2>/dev/null || true)"
    if [[ -n "$PD" ]]; then
      echo "    profile    : $PD"
      node -e '
        const fs=require("fs"),p=process.argv[1];
        const o=JSON.parse(fs.readFileSync(p,"utf8"));
        const b=(o.dsh&&o.dsh.profile&&o.dsh.profile.bundles)||[];
        console.log("    bundles    : "+JSON.stringify(b));
        console.log("    dep        : "+((o.dependencies||{})["dsh-infinite-gen-4"]||"(无)"));
      ' "$PD/package.json" 2>/dev/null || warn "profile/package.json 解析失败"
      echo "    解析位     : $([[ -f "$PD/node_modules/$PLUGIN_NAME/index.js" ]] && echo 存在 || echo 缺失)"
      echo "    解析位preheat: $([[ -f "$PD/node_modules/$PLUGIN_NAME/preheat.js" ]] && echo 存在 || echo '缺失 ← 会崩')"
      # 宿主是否在跑 / 是否跑的是旧副本
      HPIDS="$(dsh_host_pids)"
      if [[ -n "$HPIDS" ]]; then
        echo "    宿主进程   : PID $(echo $HPIDS | tr '\n' ' ')"
        FIRST="$(echo "$HPIDS" | head -1)"
        ETIME="$(ps -o lstart= -p "$FIRST" 2>/dev/null | sed 's/^ *//')"
        echo "    宿主启动于 : ${ETIME:-未知}"
        if [[ -f "$PD/node_modules/$PLUGIN_NAME/preheat.js" ]]; then
          IDX_MT="$(stat -c %Y "$PD/node_modules/$PLUGIN_NAME/index.js" 2>/dev/null || echo 0)"
          HP_START="$(stat -c %Y /proc/$FIRST 2>/dev/null || echo 0)"
          if [[ "$IDX_MT" != "0" && "$HP_START" != "0" && "$IDX_MT" -gt "$HP_START" ]]; then
            echo "    [!] 插件文件比宿主进程新 → 宿主跑的还是旧副本，需要 restart"
          fi
        fi
      else
        echo "    宿主进程   : 未运行"
      fi
      DPID="$(desktop_pids | head -1)"
      [[ -n "$DPID" ]] && echo "    桌面端宿主 : PID $DPID（DSH Desktop）"
    else
      warn "未找到 profile"
    fi
    echo "    插件源目录 : $([[ -d "$DSH_ROOT/plugins/$PLUGIN_NAME" ]] && echo 存在 || echo 不存在)"
    exit 0
    ;;

  doctor)
    step "体检（委托 install.sh --doctor）"
    DSH_HOME="$DSH_ROOT" bash "$VDIR/install.sh" --doctor
    exit $?
    ;;

  restart)
    step "重启 DSH 宿主"
    do_restart
    exit $?
    ;;

  install)
    step "安装 po-gen-4 $VER → $DSH_ROOT"
    DSH_HOME="$DSH_ROOT" bash "$VDIR/install.sh" || exit $?
    post_install_restart
    exit 0
    ;;

  update)
    step "更新：先拉最新仓库，再装最新版本"
    if [[ -d "$SELF_DIR/.git" ]]; then
      if git -C "$SELF_DIR" pull --ff-only; then ok "仓库已更新到最新"; else warn "git pull 失败（可能本地有改动），继续用当前副本"; fi
      NEWVER="$(latest_version)"
      if [[ "$NEWVER" != "$VER" ]]; then
        warn "版本目录变了：$VER → $NEWVER（改用 $NEWVER）"
        VER="$NEWVER"; VDIR="$SELF_DIR/versions/po-gen-4-$VER"
      fi
    else
      warn "当前不在 git 仓库内（缓存模式），缓存已在自举阶段更新"
    fi
    step "安装 $VER"
    DSH_HOME="$DSH_ROOT" bash "$VDIR/install.sh" || exit $?
    post_install_restart
    exit 0
    ;;

  uninstall)
    step "卸载 po-gen-4（版本目录 $VER，仅用于定位脚本）"
    DSH_HOME="$DSH_ROOT" bash "$SELF_DIR/uninstall.sh"
    RC=$?
    if [[ $RC -eq 0 ]]; then
      step "卸载后也需要重启宿主，插件树才会刷新"
      do_restart
    fi
    exit $RC
    ;;

  *)
    err "未知动作：$ACTION（可用：install / uninstall / update / restart / doctor / status / list）"
    exit 2
    ;;
esac