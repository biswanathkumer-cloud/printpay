@echo off
cd /d "%~dp0"
set "PYTHONPATH=%~dp0lib"
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo Python 3 not found. Run install_desktop.bat first.
  pause
  exit /b 1
)
%PY% PrintPayDesktop.py
pause
