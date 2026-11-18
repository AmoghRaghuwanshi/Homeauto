@echo off
setlocal
title HomeAuto launcher
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 (
  echo.
  echo HomeAuto could not finish starting. Read the message above.
  pause
  exit /b 1
)
endlocal
