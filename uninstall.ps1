# uninstall.ps1 - po-gen 卸载：移除插件目录并从 profile bundles 摘除（幂等）
param(
  [ValidateSet('2','3','4')][string]$Generation = '4',
  [string]$DshHome = '',
  [string[]]$Profiles = @('web')
)
$ErrorActionPreference = 'Stop'
$internalId = "dsh-infinite-gen-$Generation"
if (-not $DshHome) { $DshHome = $env:DSH_HOME }
if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
$tgt = Join-Path (Join-Path $DshHome 'plugins') $internalId
if (Test-Path $tgt) { Remove-Item $tgt -Recurse -Force; Write-Output "[OK] 已移除 $tgt" } else { Write-Output "[i] 插件目录不存在" }
# 生产解析位同步清除（B18：desktop bundle 从 node_modules 解析）
$nmTgt = Join-Path (Join-Path $DshHome 'node_modules') $internalId
if (Test-Path $nmTgt) { Remove-Item $nmTgt -Recurse -Force; Write-Output "[OK] 已移除解析副本 $nmTgt" } else { Write-Output "[i] 无解析副本" }
foreach ($p in $Profiles) {
  $pj = Join-Path (Join-Path $DshHome 'profiles') "$p\package.json"
  if (Test-Path $pj) {
    $c = Get-Content $pj -Raw
    $c2 = $c.Replace("`"$internalId`", ", '').Replace(", `"$internalId`"", '').Replace("`"$internalId`"", '')
    [System.IO.File]::WriteAllText($pj, $c2, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "[OK] $p bundles 已摘除"
  }
}
Write-Output "[完成] 重启平台生效。"
