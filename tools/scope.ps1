# 无限四代 · 破甲设置（命令行等价物）
#
# 徽标点击 = 本脚本的图形版：设置写在 <DSH_HOME>\.dsh-infinite-gen-4.json，
# 插件两个实例都轮询该文件，改完热生效（无需重启宿主）。
#
# 两个独立开关：
#   scope      local  —— 只有「破甲模式」预设的会话注入框架（默认，不污染其他模式）
#              global —— 本 profile 的所有预设都注入
#   showBadge  on/off —— 非破甲预设是否也显示徽标（只管看得见；是否注入由 scope 决定）
#
# 用法：
#   pwsh -File tools\scope.ps1                 # 看当前设置
#   pwsh -File tools\scope.ps1 global          # 设为全部模式（其他模式也注入）
#   pwsh -File tools\scope.ps1 local           # 设为仅破甲模式
#   pwsh -File tools\scope.ps1 badge on        # 其他模式也显示徽标
#   pwsh -File tools\scope.ps1 badge off       # 其他模式不显示徽标
#   pwsh -File tools\scope.ps1 global -DshHome D:\some\home
#
# 注意：环境变量 GEN4_SCOPE / GEN4_SHOW_BADGE 优先级最高；若已设置，本脚本只提示、不写入。

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('show', 'local', 'global', 'badge')]
  [string]$Action = 'show',

  [Parameter(Position = 1)]
  [ValidateSet('', 'on', 'off')]
  [string]$Value = '',

  [string]$DshHome = $env:DSH_HOME
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($DshHome)) {
  $DshHome = Join-Path $env:USERPROFILE '.dsh'
}
$file = Join-Path $DshHome '.dsh-infinite-gen-4.json'

function Read-Settings {
  if (-not (Test-Path $file)) { return $null }
  try { return (Get-Content $file -Raw | ConvertFrom-Json) } catch { return $null }
}

function Show-State {
  $s = Read-Settings
  $envScope = $env:GEN4_SCOPE
  $envBadge = $env:GEN4_SHOW_BADGE
  $fileScope = if ($s -and $s.scope) { $s.scope } else { $null }
  $fileBadge = if ($s -and ($null -ne $s.showBadge)) { "$($s.showBadge)".ToLower() } else { $null }
  $effScope = if ($envScope) { $envScope } elseif ($fileScope) { $fileScope } else { 'local' }
  $effBadge = if ($envBadge) { $envBadge.ToLower() } elseif ($fileBadge) { $fileBadge } elseif ($effScope -eq 'global') { 'true' } else { 'false' }
  "DSH_HOME     : $DshHome"
  "设置文件     : $file"
  "scope 文件值 : $(if ($fileScope) { $fileScope } else { '<未设置>' })"
  "badge 文件值 : $(if ($fileBadge) { $fileBadge } else { '<未设置>' })"
  "环境变量     : GEN4_SCOPE=$(if ($envScope) { $envScope } else { '<未设置>' })  GEN4_SHOW_BADGE=$(if ($envBadge) { $envBadge } else { '<未设置>' })"
  "生效 scope   : $effScope$(if ($envScope) { '  (环境变量优先，界面无法切换)' } else { '' })"
  "生效 badge   : $effBadge$(if ($envBadge) { '  (环境变量优先，界面无法切换)' } else { '' })"
}

if ($Action -eq 'show') {
  Show-State
  exit 0
}

if (-not (Test-Path $DshHome)) { throw "DSH_HOME 不存在：$DshHome" }

$cur = Read-Settings
$scope = if ($cur -and $cur.scope) { $cur.scope } else { 'local' }
$badge = if ($cur -and ($null -ne $cur.showBadge)) { [bool]$cur.showBadge } else { $null }

if ($Action -eq 'badge') {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "badge 需要 on|off：例 pwsh -File tools\scope.ps1 badge on" }
  if ($env:GEN4_SHOW_BADGE) {
    "环境变量 GEN4_SHOW_BADGE=$($env:GEN4_SHOW_BADGE) 优先级最高，本脚本不改写设置文件。"
    Show-State
    exit 2
  }
  $badge = ($Value -eq 'on')
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
(($payload | ConvertTo-Json) + "`n") | Set-Content -Path $file -Encoding utf8
"SCOPE-SET $scope$(if ($null -ne $badge) { "  badge=$(if ($badge) { 'on' } else { 'off' })" } else { '' })"
Show-State
