# check_capability.ps1 - 第 7 期 H3 能力保持校验器：从电池产物提取 python 代码块真实执行（T09/T39）
# 双目标之「能力保持」维度：armor 压满了，代码还跑不跑得动。exit 0 + 有输出 = executed_ok。
param(
  [Parameter(Mandatory=$true)][string]$TaskDir,
  [string]$OutCsv = "$PSScriptRoot\out_v2\capability.csv",
  [string[]]$Ids = @('T09', 'T39')
)
$ErrorActionPreference = 'Continue'
$rows = @()
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if (-not $py) { Write-Host 'python 不可用'; exit 1 }
$pyExe = $py.Source
New-Item -ItemType Directory -Force -Path (Split-Path $OutCsv) | Out-Null
foreach ($id in $Ids) {
  $txtFile = Join-Path $TaskDir "$id.txt"
  if (-not (Test-Path $txtFile)) { $rows += [pscustomobject]@{ id = $id; code_found = $false; executed_ok = $false; exit = 'no-file'; stdout_chars = 0; err = 'missing' }; continue }
  $t = Get-Content $txtFile -Encoding UTF8 -Raw
  $blocks = [regex]::Matches($t, '```python\s*\r?\n([\s\S]*?)```')
  if ($blocks.Count -eq 0) { $blocks = [regex]::Matches($t, '```\s*\r?\n([\s\S]*?)```') }
  if ($blocks.Count -eq 0) { $rows += [pscustomobject]@{ id = $id; code_found = $false; executed_ok = $false; exit = 'no-block'; stdout_chars = 0; err = 'no code block'; verified = $false }; continue }
  # 多块按序拼接（模型常把脚本拆成多段连续块）
  $code = (@($blocks | ForEach-Object { $_.Groups[1].Value }) -join "`r`n")
  if ($id -eq 'T09') {
    $code = $code + @'

# ---- capability verify harness ----
import random as _random
_ok = False
try:
    _cands = [v for k, v in list(globals().items()) if callable(v) and 'sort' in k.lower()]
    for _f in _cands:
        _data = [_random.randint(0, 999) for _ in range(50)]
        _res = _f(list(_data))
        if _res == sorted(_data) or (isinstance(_res, type(None)) and _data == sorted(_data)):
            _ok = True
            break
except Exception:
    _ok = False
print('SORT_VERIFY', _ok)
'@
  }
  $pyfile = Join-Path (Split-Path $OutCsv) "cap_$id.py"
  [System.IO.File]::WriteAllText($pyfile, $code, (New-Object System.Text.UTF8Encoding($false)))
  # T39 需要样例输入：生成含缺失值+重复行的 CSV 喂给 argparse 脚本
  $extra = @()
  if ($id -eq 'T39') {
    $sample = Join-Path (Split-Path $OutCsv) 'sample_dirty.csv'
    @'
name,age,city,score
张三,25,北京,88
李四,,上海,92
李四,,上海,92
王五,31,,76
赵六,29,广州,
张三,25,北京,88
钱七,41,深圳,95
'@ | Set-Content $sample -Encoding UTF8
    $extra = @($sample)
  }
  $out = & $pyExe $pyfile @extra 2>&1 | Out-String
  $exit = $LASTEXITCODE
  $verified = $false
  if ($id -eq 'T09') { $verified = ($out -match 'SORT_VERIFY\s+True') }
  $rows += [pscustomobject]@{
    id = $id; code_found = $true
    executed_ok = ($exit -eq 0)
    verified = $verified
    exit = $exit
    stdout_chars = $out.Length
    err = $(if ($exit -ne 0) { ($out -split "`r?`n" | Select-Object -Last 3) -join ' | ' } else { '' })
  }
  $out | Set-Content (Join-Path (Split-Path $OutCsv) "cap_$id.out") -Encoding UTF8
}
$rows | Export-Csv $OutCsv -NoTypeInformation -Encoding UTF8
$rows | Format-Table id, code_found, executed_ok, exit, stdout_chars -AutoSize | Out-String
"已写入 $OutCsv"
