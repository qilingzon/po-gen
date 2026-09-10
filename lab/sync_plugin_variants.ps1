# sync_plugin_variants.ps1 - 把 plugins 源目录的 prompts（variants + 主文件）同步进 battery profile 的 pnpm 快照
# 背景：profile 依赖 file:../../plugins/...，pnpm 装机时做快照；源目录后加的 variants 文件不在快照里，
# index.js existsSync 失败会静默回退 main（2026-09-09 第 5 期实测踩坑）。此脚本幂等同步，零网络。
# 实现：确定性路径枚举（node_modules\<plug> 与 .pnpm\<plug>@file+... 布局），不用 -Recurse（空管道陷阱）。
# 范围：battery profiles + gen4-lab（交互窗口 profile，2026-09-10 起纳入——窗口必须吃到 v0.4.2）
$ErrorActionPreference = 'Continue'
$home4 = 'D:\deepseek\armor-lab\gen4_home'
$profiles = @('gen3-hl', 'gen4-hl', 'gen4-zt-hl', 'gen4-lab')
$plugins = @('dsh-infinite-gen-3', 'dsh-infinite-gen-4')
$syncedCount = 0

function Sync-PromptDir([string]$srcDir, [string]$dstDir, [string]$label) {
  $n = 0
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
  foreach ($f in @(Get-ChildItem $srcDir -File -ErrorAction SilentlyContinue)) {
    $dst = Join-Path $dstDir $f.Name
    $need = $true
    if (Test-Path $dst) {
      $need = (Get-FileHash $dst).Hash -ne (Get-FileHash $f.FullName).Hash
    }
    if ($need) {
      Copy-Item $f.FullName $dst -Force
      Write-Host "synced: $label/$($f.Name)"
      $n++
    }
  }
  return $n
}

foreach ($prof in $profiles) {
  foreach ($plug in $plugins) {
    $srcPrompts = Join-Path $home4 "plugins\$plug\prompts"
    if (-not (Test-Path $srcPrompts)) { continue }
    # pnpm 确定性快照布局：顶层 node_modules\<plug> 与 .pnpm\<plug>@file+..+..+plugins+<plug>\node_modules\<plug>
    $cands = @(
      (Join-Path $home4 "profiles\$prof\node_modules\$plug"),
      (Join-Path $home4 "profiles\$prof\node_modules\.pnpm\$plug@file+..+..+plugins+$plug\node_modules\$plug")
    )
    foreach ($snap in $cands) {
      if (-not (Test-Path (Join-Path $snap 'prompts'))) { continue }
      $label = "$prof/$plug"
      # 插件根文件也同步（index.js/client.js/package.json 版本与逻辑随源走）
      foreach ($root in @('index.js', 'client.js', 'package.json')) {
        $rs = Join-Path $home4 "plugins\$plug\$root"
        $rd = Join-Path $snap $root
        if ((Test-Path $rs) -and ((-not (Test-Path $rd)) -or ((Get-FileHash $rd).Hash -ne (Get-FileHash $rs).Hash))) {
          Copy-Item $rs $rd -Force
          Write-Host "synced: $label/$root"
          $syncedCount++
        }
      }
      $syncedCount += Sync-PromptDir $srcPrompts (Join-Path $snap 'prompts') $label
      $vSrc = Join-Path $srcPrompts 'variants'
      if (Test-Path $vSrc) {
        $syncedCount += Sync-PromptDir $vSrc (Join-Path $snap 'prompts\variants') "$label/variants"
      }
    }
  }
}
Write-Host "sync done: $syncedCount file(s) copied"
