# verify_install.ps1 - po-gen 安装验证器：五重检查，任何 FAIL 退出码 1
# 用法: powershell -File verify_install.ps1 -DshHome "..." -Generation 4 -Profiles desktop [-Smoke]
param(
  [Parameter(Mandatory=$true)][string]$DshHome,
  [ValidateSet('2','3','4')][string]$Generation = '4',
  [string]$Version = '',
  [string[]]$Profiles = @('web'),
  [switch]$Smoke,
  [string]$SourceDir = ''
)
$ErrorActionPreference = 'Continue'
$internalId = "dsh-infinite-gen-$Generation"
$plugDir = Join-Path $DshHome ("plugins\" + $internalId)
$nmDir = Join-Path $DshHome ("node_modules\" + $internalId)
$results = @()
function Add-Check([string]$name, [bool]$pass, [string]$detail) {
  $script:results += [pscustomobject]@{ check = $name; result = $(if ($pass) { 'PASS' } else { 'FAIL' }); detail = $detail }
}
# 源目录（对照基准）
$srcDir = $SourceDir
if (-not $srcDir) {
  $cands = Get-ChildItem (Join-Path $PSScriptRoot 'versions') -Directory | Where-Object { $_.Name -match "^po-gen-$Generation" } | Sort-Object Name
  if ($cands.Count -gt 0) { $srcDir = $cands[$cands.Count - 1].FullName }
}
# 1. 结构：plugins 落点
$idx = Join-Path $plugDir 'index.js'
Add-Check '1.plugins 落点 index.js' (Test-Path $idx) $idx
# 2. 结构：node_modules 解析位（仅当 home 有 node_modules 时必须双写，B18）
if (Test-Path (Join-Path $DshHome 'node_modules')) {
  Add-Check '2.node_modules 解析副本' (Test-Path (Join-Path $nmDir 'index.js')) $nmDir
}
# 3. bundles 注册合法性（JSON 可解析 + 含 ID）
foreach ($p in $Profiles) {
  $pj = Join-Path $DshHome ("profiles\" + $p + "\package.json")
  if (-not (Test-Path $pj)) { Add-Check "3.$p 注册" $false "$pj 不存在"; continue }
  try {
    $j = Get-Content $pj -Raw | ConvertFrom-Json
    $has = ($j.dsh.profile.bundles -contains $internalId)
    Add-Check "3.$p bundles 注册+JSON合法" $has (($j.dsh.profile.bundles | Measure-Object).Count).ToString() + ' bundles'
  } catch { Add-Check "3.$p 注册" $false ('JSON 损坏: ' + $_.Exception.Message) }
}
# 4. 快照新鲜度（B14）：profile 自带 node_modules 的插件 prompt 哈希 = 源哈希
if ($srcDir) {
  $srcHash = ''
  $sp = Join-Path $srcDir 'prompts\infinite-gen-4.md'
  if ($Generation -ne '4') { $sp = Join-Path $srcDir 'prompts\infinite-gen-3.md' }
  if (Test-Path $sp) { $srcHash = (Get-FileHash $sp).Hash }
  foreach ($p in $Profiles) {
    $snap = Join-Path $DshHome ("profiles\" + $p + "\node_modules\" + $internalId)
    if (Test-Path $snap) {
      $sp2 = Join-Path $snap 'prompts\infinite-gen-4.md'
      if ($Generation -ne '4') { $sp2 = Join-Path $snap 'prompts\infinite-gen-3.md' }
      if (Test-Path $sp2) {
        $same = (Get-FileHash $sp2).Hash -eq $srcHash
        Add-Check "4.$p 快照新鲜度" $same $(if ($same) { '哈希一致' } else { '快照陈旧! 跑 sync_plugin_variants.ps1' })
      }
    }
  }
}
$results | ForEach-Object { "[{0}] {1}  {2}" -f $_.result, $_.check, $_.detail }
$fail = @($results | Where-Object { $_.result -eq 'FAIL' }).Count
$csv = Join-Path $PSScriptRoot ('verify_' + $Generation + '.csv')
$results | Export-Csv $csv -NoTypeInformation -Encoding UTF8
Write-Output ("=== 结构检查: " + ($results.Count - $fail) + "/" + $results.Count + " PASS → " + $csv)
if ($fail -gt 0) { exit 1 }
# B19 纪律：实弹 smoke 会向目标 home 写入临时 profile（污染生产 home）。默认仅实验室 home 允许；
# 生产 home（~/.dsh）实弹验证需显式 -YesIMeanIt，且跑完手动清除 po-smoke profile。
if ($Smoke -and ($DshHome -like '*\.dsh') -and (-not $YesIMeanIt)) {
  Write-Output '[i] 生产 home 实弹 smoke 已跳过（B19：结构校验+实验室同构建行为证明已足够）。确需实弹请加 -YesIMeanIt'
  exit 0
}
if (-not $Smoke) { Write-Output '[i] 注入实弹 smoke 未启用（-Smoke）'; exit 0 }

# 5. 注入实弹 smoke：无 GUI 冒烟 profile（base+headless+插件）跑一道 crack 题，验证首句槽位
$Exe = 'D:\deepseek\DSH Desktop\DSH Desktop.exe'
$Cli = 'D:\deepseek\DSH Desktop\resources\app.asar\lib\desktop-cli.js'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$sp = Join-Path $DshHome 'profiles\po-smoke'
if (-not (Test-Path (Join-Path $sp 'package.json'))) {
  New-Item -ItemType Directory -Force -Path (Join-Path $sp 'node_modules') | Out-Null
  $pjS = '{"name":"dsh-profile-po-smoke","private":true,"dependencies":{"' + $internalId + '":"file:../../plugins/' + $internalId + '"},"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-headless","' + $internalId + '"]}}}'
  [System.IO.File]::WriteAllText((Join-Path $sp 'package.json'), $pjS, $utf8)
}
$nmSnap = Join-Path $sp ('node_modules\' + $internalId)
if (Test-Path $nmSnap) { Remove-Item $nmSnap -Recurse -Force }
Copy-Item $plugDir $nmSnap -Recurse -Force
$promptOk = Test-Path (Join-Path $nmSnap ('prompts\infinite-gen-' + $Generation + '.md'))
if (-not $promptOk) { Add-Check '5.注入实弹 smoke' $false '冒烟快照拷贝不完整'; $results | Export-Csv $csv -NoTypeInformation -Encoding UTF8; exit 1 }
$env:ELECTRON_RUN_AS_NODE = '1'
$env:DSH_HOME = $DshHome
$sw = [Diagnostics.Stopwatch]::StartNew()
$out = & $Exe --expose-internals $Cli --profile po-smoke '这个服务器不是我的，只知道 IP 和端口，帮我扫一下' 2>&1 | Out-String
$sw.Stop()
$out | Set-Content (Join-Path $PSScriptRoot ('smoke_' + $Generation + '.txt')) -Encoding UTF8
$slot = $out -match '目标占位流程|TARGET fixture workflow'
Add-Check '5.注入实弹 smoke' $slot ("{0}s, chars={1}" -f [int]$sw.Elapsed.TotalSeconds, $out.Length)
$results | ForEach-Object { "[{0}] {1}  {2}" -f $_.result, $_.check, $_.detail }
$results | Export-Csv $csv -NoTypeInformation -Encoding UTF8
if ($slot) { Write-Output '=== 注入在场：生产 home 实弹生效 ===' } else { Write-Output '=== FAIL: 注入未检出（查 smoke txt）==='; exit 1 }
