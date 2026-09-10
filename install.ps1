# install.ps1 - po-gen 一键部署：拷贝插件到 DSH home 并注册进 profile bundles（幂等，自动备份）
# 用法：
#   powershell -ExecutionPolicy Bypass -File install.ps1 -DshHome "C:\Users\you\.dsh"
#   powershell -ExecutionPolicy Bypass -File install.ps1 -DshHome "D:\...\gen4_home" -Generation 3 -Profiles gen3-lab
#   powershell -ExecutionPolicy Bypass -File install.ps1 -DshHome "..." -Uninstall -Generation 4
param(
  [ValidateSet('2','3','4')][string]$Generation = '4',
  [string]$Version = '',
  [string]$DshHome = '',
  [string[]]$Profiles = @('web'),
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$internalId = "dsh-infinite-gen-$Generation"
if (-not $DshHome) {
  if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME } else { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
}
$pluginsDir = Join-Path $DshHome 'plugins'
$profilesDir = Join-Path $DshHome 'profiles'
Write-Output "[i] DSH home: $DshHome"
Write-Output "[i] 内部注册 ID: $internalId（对外品牌 po-gen-$Generation）"

# 解析源版本目录（5.1 兼容：不用 $x = if 语句）
$src = $null
if ($Version) {
  $cand = Join-Path $root ("versions\po-gen-$Generation-v$Version")
  if (Test-Path $cand) { $src = $cand }
} else {
  $cands = Get-ChildItem (Join-Path $root 'versions') -Directory | Where-Object { $_.Name -match "^po-gen-$Generation" } | Sort-Object Name
  if ($cands.Count -gt 0) { $src = $cands[$cands.Count - 1].FullName }
}
if (-not $src -or -not (Test-Path $src)) { Write-Output "[FAIL] 找不到源版本目录"; exit 1 }
Write-Output "[i] 源版本: $src"

if ($Uninstall) {
  $tgt = Join-Path $pluginsDir $internalId
  if (Test-Path $tgt) { Remove-Item $tgt -Recurse -Force; Write-Output "[OK] 已移除 $tgt" } else { Write-Output "[i] 插件目录不存在（视为已卸载）" }
  foreach ($p in $Profiles) {
    $pj = Join-Path $profilesDir ($p + '\package.json')
    if (-not (Test-Path $pj)) { Write-Output "[WARN] profile $p 无 package.json，跳过"; continue }
    $c = Get-Content $pj -Raw
    $q = '"' + $internalId + '"'
    $c2 = $c.Replace($q + ', ', '').Replace(', ' + $q, '').Replace($q, '')
    [System.IO.File]::WriteAllText($pj, $c2, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "[OK] $p bundles/deps 已摘除"
  }
  Write-Output "[完成] 重启平台生效。"
  exit 0
}

New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null
$tgt = Join-Path $pluginsDir $internalId
if (Test-Path $tgt) {
  $bak = $tgt + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
  Copy-Item $tgt $bak -Recurse -Force
  Write-Output "[i] 旧版已备份: $bak"
}
Copy-Item $src $tgt -Recurse -Force
Write-Output "[OK] 插件已部署: $tgt"

foreach ($p in $Profiles) {
  $pj = Join-Path $profilesDir ($p + '\package.json')
  if (-not (Test-Path $pj)) { Write-Output "[WARN] profile $p 无 package.json，跳过"; continue }
  $c = Get-Content $pj -Raw
  $q = '"' + $internalId + '"'
  if ($c.Contains($q)) { Write-Output "[i] $p 已注册，跳过"; continue }
  $c2 = $c.Replace('"bundles": [', '"bundles": ["' + $internalId + '", ')
  $c3 = $c2.Replace('"dependencies": {', '"dependencies": {' + "`n" + '    "' + $internalId + '": "file:../../plugins/' + $internalId + '",')
  [System.IO.File]::WriteAllText($pj, $c3, (New-Object System.Text.UTF8Encoding($false)))
  Write-Output "[OK] $p bundles+deps 已注册"
}
Write-Output "[完成] 重启 DSH 平台（或实验窗口）后生效；GUI 徽标「破甲已开启」即注入在场。"
