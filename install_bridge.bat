@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ================================================
echo PrintPay Print Bridge - One Time Setup
echo ================================================
echo.

if not exist "SumatraPDF\SumatraPDF.exe" mkdir "SumatraPDF" >nul 2>&1
if not exist "SumatraPDF\SumatraPDF.exe" (
  echo Downloading official SumatraPDF 3.6.1 x64...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://www.sumatrapdfreader.org/dl/rel/3.6.1/SumatraPDF-3.6.1-64.zip'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile 'sumatra.zip'; Expand-Archive -Force 'sumatra.zip' 'SumatraPDF'; Remove-Item 'sumatra.zip' -Force; $e=Get-ChildItem 'SumatraPDF' -Filter 'SumatraPDF-*.exe' -Recurse | Select-Object -First 1; if($e){Copy-Item $e.FullName 'SumatraPDF\SumatraPDF.exe' -Force}"
)
if not exist "SumatraPDF\SumatraPDF.exe" (
  echo.
  echo SumatraPDF download failed. Check Internet and run this file again.
  pause
  exit /b 1
)

echo.
set /p APP=PrintPay Worker URL: 
set /p KEY=Print Bridge Key from Owner Settings: 
if "%APP%"=="" goto bad
if "%KEY%"=="" goto bad

>start_bridge.bat echo @echo off
>>start_bridge.bat echo cd /d "%%~dp0"
>>start_bridge.bat echo set PRINTPAY_URL=%APP%
>>start_bridge.bat echo set PRINTPAY_KEY=%KEY%
>>start_bridge.bat echo powershell -NoProfile -ExecutionPolicy Bypass -File print_bridge.ps1

>start_bridge_hidden.bat echo @echo off
>>start_bridge_hidden.bat echo cd /d "%%~dp0"
>>start_bridge_hidden.bat echo set PRINTPAY_URL=%APP%
>>start_bridge_hidden.bat echo set PRINTPAY_KEY=%KEY%
>>start_bridge_hidden.bat echo powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File print_bridge.ps1

>bridge_config.json echo {"bw_printer":"","color_printer":"","paper":"A4","auto_print":true}

rem Start automatically every time the Windows shop user logs in.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$task='PrintPay Print Bridge'; $bat=Join-Path '%CD%' 'start_bridge_hidden.bat'; try { Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue } catch {}; $a=New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c ""'+$bat+'""'); $t=New-ScheduledTaskTrigger -AtLogOn; Register-ScheduledTask -TaskName $task -Action $a -Trigger $t -RunLevel Highest -Force | Out-Null; Write-Host 'Automatic startup task created.'"

if errorlevel 1 (
  echo.
  echo Could not create the automatic startup task.
  echo Please run install_bridge.bat as Administrator once.
  pause
  exit /b 1
)

echo.
echo ================================================
echo Setup complete.
echo Bridge will start automatically at Windows login.
echo Printer mapping is saved on this PC and in Owner Settings.
echo You do NOT need to run install_bridge.bat every day.
echo ================================================
echo.
echo Starting Bridge now...
start "PrintPay Print Bridge" cmd /k ""%~dp0start_bridge.bat""
exit /b 0

:bad
echo Worker URL and Bridge Key are required.
pause
exit /b 1
