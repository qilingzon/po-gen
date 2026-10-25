# update.ps1 — 无限5代 一键更新（绕过 GUI 的「无法从依赖变更中确定安装了哪一个包」）
#
# 为什么要这个脚本：宿主插件面板在安装后靠「package.json 依赖值有没有变化」判定装了哪个包。
# 用 https://github.com/qilingzon/po-gen 这种地址重复安装时，pnpm 会把它规范化成
# github:qilingzon/po-gen 存进 package.json；第二次粘贴同一串地址，存档不再变化，
# 宿主拿你粘贴的字符串去和存档比 → 比不中 → 报「无法从依赖变更中确定安装了哪一个包」。
# 本脚本改用 `dsh plugin add <tag 规格>`，值是新的 ⇒ 走 CLI，不经过那段判定。
#
# 用法：
#   .\update.ps1                      # 更新默认 profile（desktop）到最新 tag
#   .\update.ps1 -Profile gen4-hl     # 更新指定 profile
#   .\update.ps1 -Check               # 只看有没有新版本，不动手
#   .\update.ps1 -Restart auto        # 装完自动重启宿主（桌面端或 dsh web）
#   .\update.ps1 -Restart prompt      # 装完问一句（默认）
#   .\update.ps1 -Restart never       # 装完只提示，不重启
#   .\update.ps1 -DryRun              # 只报告会重启哪个进程，不动手
param(
  [string]$Profile = 'desktop',
  [string]$Repo    = 'qilingzon/po-gen',
  [string]$Tag     = '',
  [string]$DshHome = '',
  [switch]$Check,
  [switch]$SkipBackup,
  [ValidateSet('auto','prompt','never')]
  [string]$Restart = 'prompt',
  [switch]$DryRun
)

function Find-DesktopHost {
  # Electron 主进程 = 唯一没有 --type= 的那个；renderer/gpu/utility 都不能杀
  Get-CimInstance Win32_Process -Filter "Name='DeepSeek Harness.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -notmatch '--type=' } |
    Select-Object -First 1 @{n='Kind';e={'desktop'}}, ProcessId, @{n='Path';e={
      if ($_.CommandLine -match '^\s*"([^"]+\.exe)"') { $Matches[1] } else { $_.ExecutablePath }
    }}
}

function Find-WebHost {
  # dsh web 由 node 直接跑；billion-context 之类的旁路进程不在其列
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'dsh' -and $_.CommandLine -match '\bweb\b' } |
    Select-Object -First 1 @{n='Kind';e={'web'}}, ProcessId, @{n='Path';e={$_.ExecutablePath}}, @{n='CommandLine';e={$_.CommandLine}}
}

function Restart-Host($Mode) {
  $host0 = Find-DesktopHost
  if (-not $host0) { $host0 = Find-WebHost }
  if (-not $host0) { 'NO-HOST 找不到正在运行的宿主（也许本来就没开），手动启动即可'; return }
  $desc = if ($host0.Kind -eq 'desktop') { "桌面端 pid=$($host0.ProcessId) $($host0.Path)" } else { "dsh web pid=$($host0.ProcessId)" }
  "HOST         = $desc"

  if ($DryRun) { "DRYRUN       会结束上面的进程再重新启动，本次不动手"; return }
  if ($Mode -eq 'never') { '提示：重启宿主后新版本才生效（未自动重启）'; return }
  if ($Mode -eq 'prompt') {
    $ans = Read-Host '现在重启宿主让新版本生效？(y/N)'
    if ($ans -notmatch '^(y|yes)$') { '已跳过重启，稍后自行重启'; return }
  }

  $exe = $host0.Path
  $args0 = $null
  if ($host0.Kind -eq 'web') {
    # 用原始命令行重放：node.exe + 原参数
    $args0 = ($host0.CommandLine -replace ('^\s*"?[^"\s]+\.exe"?\s*'), '')
  }
  try { (Get-Process -Id $host0.ProcessId).CloseMainWindow() | Out-Null } catch { }
  for ($i = 0; $i -lt 20; $i++) { if (-not (Get-Process -Id $host0.ProcessId -ErrorAction SilentlyContinue)) { break }; Start-Sleep -Milliseconds 250 }
  if (Get-Process -Id $host0.ProcessId -ErrorAction SilentlyContinue) {
    Stop-Process -Id $host0.ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
  }
  if ($host0.Kind -eq 'desktop') { Start-Process -FilePath $exe | Out-Null }
  else { Start-Process -FilePath $exe -ArgumentList $args0 | Out-Null }
  "RESTART-OK   已重新启动宿主"
}

$ErrorActionPreference = 'Stop'
$env:CI = 'true'

$homeDir = if ($DshHome) { $DshHome } elseif ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profileDir = Join-Path $homeDir "profiles\$Profile"
if (-not (Test-Path $profileDir)) { "NO-PROFILE $profileDir"; exit 2 }

$installedFile = Join-Path $profileDir 'node_modules\dsh-infinite-gen-4\package.json'
$current = if (Test-Path $installedFile) { (Get-Content $installedFile -Raw | ConvertFrom-Json).version } else { 'none' }

if (-not $Tag) {
  $Tag = (& gh release view --repo $Repo --json tagName --jq '.tagName') 2>$null
  if (-not $Tag) {
    $tags = & git ls-remote --tags --refs "https://github.com/$Repo.git" 2>$null |
      ForEach-Object { ($_ -split 'refs/tags/')[1] } | Where-Object { $_ -match '^v\d' } | Sort-Object { [version]($_ -replace '^v','') }
    $Tag = $tags | Select-Object -Last 1
  }
}
if (-not $Tag) { 'NO-TAG（拿不到最新发布 tag，可用 -Tag vX.Y.Z 指定）'; exit 3 }

"PROFILE      = $profileDir"
"INSTALLED    = $current"
"LATEST TAG   = $Tag"

if ($current -eq ($Tag -replace '^v', '')) { 'UP-TO-DATE 已是最新'; exit 0 }
if ($Check) { "BEHIND 需要更新：$current → $($Tag -replace '^v','')"; exit 0 }

# 桌面端受保护：先备份并确认 BACKUP-OK
$isDesktop = $profileDir.StartsWith((Join-Path $env:USERPROFILE '.dsh'), [StringComparison]::OrdinalIgnoreCase)
if ($isDesktop -and -not $SkipBackup) {
  $bk = 'D:\deepseek\armor-lab\desktop-backup\desktop_backup.ps1'
  if (Test-Path $bk) {
    $out = & pwsh -NoProfile -File $bk -Reason "update plugin to $Tag" 2>&1 | Out-String
    if ($out -notmatch 'BACKUP-OK') { "BACKUP-FAILED 未更新（先修备份）"; $out; exit 4 }
    'BACKUP-OK'
  } else { 'WARN 找不到备份脚本，继续（-SkipBackup 可显式跳过）' }
}

# 子进程 CLI 必须锁定到我们刚刚检查过的这个 home，否则 dsh 会读它自己的 DSH_HOME
$env:DSH_HOME = $homeDir

$spec = "github:$Repo#$Tag"
"INSTALLING   = $spec"

# CLI 解析：优先 profile 同级的 runtime 副本（它是真正的 .js），否则退回 PATH 上的 dsh
# （注意 dsh 通常是 .cmd/.ps1 垫片，不能喂给 node，必须直接调用）
$runtimeCli = Join-Path $homeDir 'runtime\node_modules\@deepseek-ai\dsh\lib\bin.js'
if (Test-Path $runtimeCli) {
  & node $runtimeCli plugin --profile $Profile add $spec 2>&1 | ForEach-Object { "  $_" }
  $code = $LASTEXITCODE
} else {
  $cmd = Get-Command dsh -ErrorAction SilentlyContinue
  if (-not $cmd) { "NO-CLI 找不到 dsh：既无 $runtimeCli，PATH 里也没有 dsh"; exit 5 }
  if ($cmd.Source -match '\.js$') {
    & node $cmd.Source plugin --profile $Profile add $spec 2>&1 | ForEach-Object { "  $_" }
  } else {
    & $cmd.Source plugin --profile $Profile add $spec 2>&1 | ForEach-Object { "  $_" }
  }
  $code = $LASTEXITCODE
}

# 回读可能赶上 pnpm 重挂软链的瞬间：短重试，别把成功误报成失败
$after = $current
for ($i = 0; $i -lt 10; $i++) {
  if (Test-Path $installedFile) { $after = (Get-Content $installedFile -Raw | ConvertFrom-Json).version }
  if ($after -ne $current) { break }
  Start-Sleep -Milliseconds 300
}
if ($code -ne 0 -or $after -eq $current) { "UPDATE-FAILED exit=$code  $current → $after"; exit 6 }
"UPDATE-OK    $current → $after"
Restart-Host $Restart
exit 0
