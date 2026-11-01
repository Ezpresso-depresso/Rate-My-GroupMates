@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0frontend\start-afterparty.ps1"
if errorlevel 1 (
  echo.
  echo Preview did not start. Keep this error message for troubleshooting.
  pause
)
