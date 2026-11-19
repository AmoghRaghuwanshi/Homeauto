@echo off
setlocal
title HomeAuto hardware hub
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1" -Mode Hardware
if errorlevel 1 (
  echo.
  echo HomeAuto hardware startup failed. Read the message above.
  pause
  exit /b 1
)
endlocal
