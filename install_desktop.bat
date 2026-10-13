@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title PrintPay Desktop - Setup

:findpython
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo.
  echo Python 3 was not found on this PC.
  echo.
  where winget >nul 2>&1
  if errorlevel 1 goto NOPYTHON
  echo Trying to install Python 3 for this Windows user using winget...
  winget install --id Python.Python.3.13 -e --scope user --accept-package-agreements --accept-source-agreements
  echo.
  echo Python installation command finished. Re-checking Python...
  where py >nul 2>&1 && set "PY=py -3"
  if not defined PY where python >nul 2>&1 && set "PY=python"
  if not defined PY goto NOPYTHON
)

echo [1/2] Python:
%PY% --version
if errorlevel 1 goto FAIL

rem Use bundled libraries first. No pywin32 and no internet are required.
set "PYTHONPATH=%~dp0lib"

echo [2/2] Starting PrintPay Desktop...
%PY% PrintPayDesktop.py
set "RC=%errorlevel%"
if not "%RC%"=="0" goto FAILRUN
exit /b %RC%

:NOPYTHON
echo.
echo Python 3 could not be installed automatically.
echo Install Python 3.13 for Windows, then run this installer again.
echo Download: https://www.python.org/downloads/windows/
echo During setup, enable "Add python.exe to PATH".
pause
exit /b 1

:FAILRUN
echo.
echo PrintPay Desktop stopped with error code %RC%.
echo The application window normally shows the exact error.
pause
exit /b %RC%

:FAIL
echo.
echo PrintPay Desktop could not start.
pause
exit /b 1
