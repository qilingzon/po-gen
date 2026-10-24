
# 无限四代 · 破甲设置（命令行等价物）
#
# 徽标点击 = 本脚本的图形版：设置写在 <DSH_HOME>\.dsh-infinite-gen-4.json，
# 插件两个实例都轮询该文件，改完热生效（无需重启宿主）。
#
# 三个独立开关：
#   scope      local  —— 只有「破甲模式」预设的会话注入框架（默认，不污染其他模式）
#              global —— 本 profile 的所有预设都注入
#   showBadge  on/off —— 非破甲预设是否也显示徽标（只管看得见；是否注入由 scope 决定）
#   session    <会话id> on|off|auto
#              —— 0.5.5 按对话覆盖：这一场开 / 这一场关 / 恢复跟随 scope
#
# 用法：
#   pwsh -File tools\scope.ps1                        # 看当前设置（含按对话覆盖表）
#   pwsh -File tools\scope.ps1 global                 # 设为全部模式（其他模式也注入）
#   pwsh -File tools\scope.ps1 local                  # 设为仅破甲模式
#   pwsh -File tools\scope.ps1 badge on               # 其他模式也显示徽标
#   pwsh -File tools\scope.ps1 badge off              # 其他模式不显示徽标
#   pwsh -File tools\scope.ps1 session SESSION_ID on  # 只给这一场开
#   pwsh -File tools\scope.ps1 session SESSION_ID off # 只把这一场关掉
#   pwsh -File tools\scope.ps1 session SESSION_ID auto# 这一场恢复跟随
#   pwsh -File tools\scope.ps1 global -DshHome D:\some\home
#
# 注意：环境变量 GEN4_SCOPE / GEN4_SHOW_BADGE 优先级最高；若已设置，本脚本只提示、不写入。

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('show', 'local', 'global', 'badge', 'session')]
  [string]$Action = 'show',

  [Parameter(Position = 1)]
  [string]$Value = '',

  [Parameter(Position = 2)]
  [string]$State = '',

  [string]$DshHome = $env:DSH_HOME
)

# 0.5.51：显式 UTF-8 读 JSON。Windows PowerShell 5.1 的 Get-Content -Raw 按 ANSI 解码，
# package.json 里只要出现中文（如 dsh.name「无限5代」）ConvertFrom-Json 就会失败。
function Read-Json([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  $text = [IO.File]::ReadAllText($path, [Text.UTF8Encoding]::new($false))
  return ($text | ConvertFrom-Json)
}

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($DshHome)) {
  $DshHome = Join-Path $env:USERPROFILE '.dsh'
}
$file = Join-Path $DshHome '.dsh-infinite-gen-4.json'

function Read-Settings {
  if (-not (Test-Path $file)) { return $null }
  try { return (Read-Json $file) } catch { return $null }
}

# 把 sessions 归一化成有序字典（损坏条目直接丢弃，和插件侧 normalizeSessions 同规则）。
function Get-SessionMap($settings) {
  $map = [ordered]@{}
  if (-not $settings) { return $map }
  $raw = $settings.sessions
  if ($null -eq $raw) { return $map }
  foreach ($p in $raw.PSObject.Properties) {
    $id = [string]$p.Name
    $st = ([string]$p.Value).ToLowerInvariant()
    if ($id -match '^[A-Za-z0-9._:-]{1,128}$' -and ($st -eq 'on' -or $st -eq 'off')) { $map[$id] = $st }
  }
  return $map
}

function Show-State {
  $s = Read-Settings
  $envScope = $env:GEN4_SCOPE
  $envBadge = $env:GEN4_SHOW_BADGE
  $fileScope = if ($s -and $s.scope) { $s.scope } else { $null }
  $fileBadge = if ($s -and ($null -ne $s.showBadge)) { "$($s.showBadge)".ToLower() } else { $null }
  $effScope = if ($envScope) { $envScope } elseif ($fileScope) { $fileScope } else { 'local' }
  $effBadge = if ($envBadge) { $envBadge.ToLower() } elseif ($fileBadge) { $fileBadge } elseif ($effScope -eq 'global') { 'true' } else { 'false' }
  $sessions = Get-SessionMap $s
  "DSH_HOME     : $DshHome"
  "设置文件     : $file"
  "scope 文件值 : $(if ($fileScope) { $fileScope } else { '<未设置>' })"
  "badge 文件值 : $(if ($fileBadge) { $fileBadge } else { '<未设置>' })"
  "环境变量     : GEN4_SCOPE=$(if ($envScope) { $envScope } else { '<未设置>' })  GEN4_SHOW_BADGE=$(if ($envBadge) { $envBadge } else { '<未设置>' })"
  "生效 scope   : $effScope$(if ($envScope) { '  (环境变量优先，界面无法切换)' } else { '' })"
  "生效 badge   : $effBadge$(if ($envBadge) { '  (环境变量优先，界面无法切换)' } else { '' })"
  if ($sessions.Count -eq 0) {
    "按对话覆盖   : <无>  (全部跟随 scope)"
  } else {
    "按对话覆盖   : $($sessions.Count) 场"
    foreach ($k in $sessions.Keys) {
      $short = if ($k.Length -gt 12) { $k.Substring(0, 12) + '…' } else { $k }
      "               $short = $($sessions[$k])"
    }
  }
}

if ($Action -eq 'show') {
  Show-State
  exit 0
}

if (-not (Test-Path $DshHome)) { throw "DSH_HOME 不存在：$DshHome" }

$cur = Read-Settings
$scope = if ($cur -and $cur.scope) { $cur.scope } else { 'local' }
$badge = if ($cur -and ($null -ne $cur.showBadge)) { [bool]$cur.showBadge } else { $null }
$sessions = Get-SessionMap $cur

if ($Action -eq 'badge') {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "badge 需要 on|off：例 pwsh -File tools\scope.ps1 badge on" }
  if ($Value -notin @('on', 'off')) { throw "badge 只接受 on|off，收到：$Value" }
  if ($env:GEN4_SHOW_BADGE) {
    "环境变量 GEN4_SHOW_BADGE=$($env:GEN4_SHOW_BADGE) 优先级最高，本脚本不改写设置文件。"
    Show-State
    exit 2
  }
  $badge = ($Value -eq 'on')
} elseif ($Action -eq 'session') {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "session 需要会话 id：例 pwsh -File tools\scope.ps1 session SESSION_ID off" }
  if ($Value -notmatch '^[A-Za-z0-9._:-]{1,128}$') { throw "会话 id 含非法字符：$Value" }
  $st = if ([string]::IsNullOrWhiteSpace($State)) { '' } else { $State.ToLowerInvariant() }
  if ($st -notin @('on', 'off', 'auto')) { throw "session 需要第三参数 on|off|auto，收到：$State" }
  if ($st -eq 'auto') {
    if ($sessions.Contains($Value)) { $sessions.Remove($Value) }
    "SESSION-CLEARED $Value（恢复跟随 scope）"
  } else {
    $sessions[$Value] = $st
    "SESSION-SET $Value=$st"
  }
} else {
  if ($env:GEN4_SCOPE) {
    "环境变量 GEN4_SCOPE=$($env:GEN4_SCOPE) 优先级最高，本脚本不改写设置文件。"
    Show-State
    exit 2
  }
  $scope = $Action
}

$payload = [ordered]@{
  scope     = $scope
  updatedAt = (Get-Date).ToString('o')
  by        = 'scope.ps1'
}
if ($null -ne $badge) { $payload.showBadge = $badge }
if ($sessions.Count -gt 0) { $payload.sessions = $sessions }
(($payload | ConvertTo-Json -Depth 6) + "`n") | Set-Content -Path $file -Encoding utf8
if ($Action -ne 'session') { "SCOPE-SET $scope$(if ($null -ne $badge) { "  badge=$(if ($badge) { 'on' } else { 'off' })" } else { '' })" }
Show-State
