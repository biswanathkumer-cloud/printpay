@echo off
setlocal
cd /d "%~dp0"
if not exist "SumatraPDF\SumatraPDF.exe" mkdir "SumatraPDF"
if not exist "SumatraPDF\SumatraPDF.exe" (
  echo Downloading official SumatraPDF 3.6.1 x64...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://www.sumatrapdfreader.org/dl/rel/3.6.1/SumatraPDF-3.6.1-64.zip'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile 'sumatra.zip'; Expand-Archive -Force 'sumatra.zip' 'SumatraPDF'; Remove-Item 'sumatra.zip' -Force; $e=Get-ChildItem 'SumatraPDF' -Filter 'SumatraPDF-*.exe' -Recurse | Select-Object -First 1; if($e){Copy-Item $e.FullName 'SumatraPDF\SumatraPDF.exe' -Force}"
)
if not exist "SumatraPDF\SumatraPDF.exe" (echo SumatraPDF download failed.&pause&exit /b 1)
echo.
set /p APP=PrintPay URL (example https://your-worker.workers.dev): 
set /p KEY=Print Bridge Key from Owner Settings: 
>start_bridge.bat echo @echo off
>>start_bridge.bat echo cd /d "%%~dp0"
>>start_bridge.bat echo set PRINTPAY_URL=%APP%
>>start_bridge.bat echo set PRINTPAY_KEY=%KEY%
>>start_bridge.bat echo powershell -NoProfile -ExecutionPolicy Bypass -File print_bridge.ps1
>bridge_config.json echo {"bw_printer":"","color_printer":"","paper":"A4","auto_print":true}
echo Done. Run start_bridge.bat on the shop Windows PC.
pause
