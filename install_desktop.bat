@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1 || (echo Python 3 is required. Install Python from python.org with Add Python to PATH enabled.& pause & exit /b 1)
py -m pip install -r desktop_requirements.txt
if errorlevel 1 (echo Dependency installation failed.& pause & exit /b 1)
echo.
echo PrintPay Desktop is ready.
echo Run: py PrintPayDesktop.py
pause
