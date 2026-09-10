@echo off
chcp 936 >nul
title po-gen Desktop Rollback
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\deepseek\armor-lab\po-gen\rollback_desktop.ps1"
echo.
echo Rollback done. Restart DSH Desktop to apply.
pause
