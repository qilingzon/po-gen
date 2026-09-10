# rollback_desktop.ps1 - 一键回滚：把桌面端恢复到 po-gen 推送前的状态（gen2 v0.2.3 原样）
# 动作：卸载 gen4（plugins+node_modules 双位+bundles 摘除）→ 校验 gen2 完好 → 报告
$ErrorActionPreference = 'Continue'
Write-Output '=== po-gen 桌面端一键回滚 ==='
& (Join-Path $PSScriptRoot 'uninstall.ps1') -DshHome 'C:\Users\qiling\.dsh' -Generation 4 -Profiles desktop
$g2 = 'C:\Users\qiling\.dsh\node_modules\dsh-infinite-gen-2'
$pj = Get-Content 'C:\Users\qiling\.dsh\profiles\desktop\package.json' -Raw -ErrorAction SilentlyContinue
Write-Output '=== 回滚核验 ==='
Write-Output ("gen2 解析副本完好: " + (Test-Path $g2))
Write-Output ("desktop bundles 仍含 gen2: " + ($pj -match 'dsh-infinite-gen-2'))
Write-Output ("desktop bundles 已无 gen4: " + (-not ($pj -match 'dsh-infinite-gen-4')))
Write-Output '=== 完成：重启 DSH 桌面端即恢复推送前状态 ==='
