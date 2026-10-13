@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PrintPay Desktop Installer

echo ========================================
echo       PRINTPAY DESKTOP INSTALLER
echo ========================================
echo.

set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo Python 3 is not installed.
  echo Please install Python 3 from https://www.python.org/downloads/windows/
  echo During installation tick: Add python.exe to PATH
  pause
  exit /b 1
)

echo [1/3] Checking Python...
%PY% --version
if errorlevel 1 goto FAIL

echo.
echo [2/3] Installing PrintPay Desktop dependencies...
%PY% -m pip install --upgrade pip
if errorlevel 1 goto FAIL
%PY% -m pip install -r desktop_requirements.txt
if errorlevel 1 goto FAIL

%PY% -c "import win32print; print('Windows printer API: OK')"
if errorlevel 1 (
  echo.
  echo pywin32 printer support is missing. Retrying...
  %PY% -m pip install --upgrade pywin32
  %PY% -c "import win32print; print('Windows printer API: OK')"
  if errorlevel 1 goto FAIL
)

echo.
echo [3/3] Starting PrintPay Desktop...
%PY% PrintPayDesktop.py
exit /b %errorlevel%

:FAIL
echo.
echo INSTALLATION FAILED.
echo Read the error above and make sure Windows is online.
pause
exit /b 1
