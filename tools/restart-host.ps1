# restart-host.ps1 — 由插件在「新版本已落盘」后调用，负责重启宿主让新代码生效。
#
# 为什么要外部进程：插件跑在宿主体内，重启自己等于在装配中途自杀。
# 本脚本由插件以 detached 方式拉起，脱离宿主进程树后干活：
#   1) 等几秒让 HTTP 响应先回到面板
#   2) -Via schedule 时把自己交给计划任务执行（彻底脱离宿主的 job object）
#   3) 结束 Electron 主进程（无 --type= 的 DeepSeek Harness.exe）或 dsh web 的 node 进程
#   4) 用原路径 / 原命令行重新启动
#
# 用法：
#   pwsh -File restart-host.ps1              # 直接重启（默认 schedule）
#   pwsh -File restart-host.ps1 -DryRun      # 只报告会重启谁
#   pwsh -File restart-host.ps1 -Via direct  # 不经计划任务，自己在进程内重启
param(
  [int]$DelaySeconds = 3,
  [ValidateSet('schedule','direct')]
  [string]$Via = 'schedule',
  [int]$HostPid = 0,
  [string]$TaskName = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Find-DesktopHost {
  Get-CimInstance Win32_Process -Filter "Name='DeepSeek Harness.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -notmatch '--type=' } |
    Select-Object -First 1 @{n='Kind';e={'desktop'}}, ProcessId, @{n='Path';e={
      if ($_.CommandLine -match '^\s*"([^"]+\.exe)"') { $Matches[1] } else { $_.ExecutablePath }
    }}
}

function Find-WebHost {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'dsh' -and $_.CommandLine -match '\bweb\b' } |
    Select-Object -First 1 @{n='Kind';e={'web'}}, ProcessId, @{n='Path';e={$_.ExecutablePath}}, @{n='CommandLine';e={$_.CommandLine}}
}

function Get-Host {
  $h = Find-DesktopHost
  if (-not $h) { $h = Find-WebHost }
  return $h
}

# 计划任务跑起来后第一件事：把自己从任务表里删掉，不留垃圾
if ($TaskName) {
  try { & schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null } catch { }
}

if ($DelaySeconds -gt 0) { Start-Sleep -Seconds $DelaySeconds }

$host0 = Get-Host
if (-not $host0) { 'NO-HOST 找不到运行中的宿主'; exit 0 }
"RESTART-TARGET $($host0.Kind) pid=$($host0.ProcessId)"

if ($DryRun) { 'DRYRUN 不动手'; exit 0 }

if ($Via -eq 'schedule' -and -not $TaskName) {
  $self = $MyInvocation.MyCommand.Path
  if (-not $self) { $self = $PSCommandPath }
  $name = "gen4-restart-$PID"
  $cmd = "pwsh -NoProfile -ExecutionPolicy Bypass -File `"$self`" -Via direct -DelaySeconds 0 -HostPid $($host0.ProcessId) -TaskName $name"
  & schtasks.exe /Create /TN $name /TR $cmd /SC ONCE /ST 23:59 /F /RL LIMITED 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    & schtasks.exe /Run /TN $name 2>&1 | Out-Null
    "RESTART-SCHEDULED task=$name"
    exit 0
  }
  "WARN 计划任务创建失败，退回直接重启"
}

$exe = $host0.Path
$argLine = $null
if ($host0.Kind -eq 'web') { $argLine = ($host0.CommandLine -replace ('^\s*"?[^"\s]+\.exe"?\s*'), '') }

try { (Get-Process -Id $host0.ProcessId -ErrorAction Stop).CloseMainWindow() | Out-Null } catch { }
for ($i = 0; $i -lt 20; $i++) {
  if (-not (Get-Process -Id $host0.ProcessId -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 250
}
if (Get-Process -Id $host0.ProcessId -ErrorAction SilentlyContinue) {
  Stop-Process -Id $host0.ProcessId -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
}
if ($host0.Kind -eq 'desktop') { Start-Process -FilePath $exe | Out-Null }
else { Start-Process -FilePath $exe -ArgumentList $argLine | Out-Null }
'RESTART-OK 已重新启动宿主'
exit 0
