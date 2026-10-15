param([string]$AppUrl=$env:PRINTPAY_URL,[string]$Key=$env:PRINTPAY_KEY,[int]$Port=8765)
$ErrorActionPreference='Stop'
$AppUrl=$AppUrl.TrimEnd('/')
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
$Sumatra=Join-Path $Root 'SumatraPDF\SumatraPDF.exe'
$CfgFile=Join-Path $Root 'bridge_config.json'
if(!(Test-Path $CfgFile)){ '{"bw_printer":"","color_printer":"","paper":"A4","auto_print":true}' | Set-Content -Encoding UTF8 $CfgFile }
function Cfg { return (Get-Content $CfgFile -Raw | ConvertFrom-Json) }
function SaveCfg($c){$c|ConvertTo-Json|Set-Content -Encoding UTF8 $CfgFile}
function Printers {
  try {
    $p=@(Get-Printer -ErrorAction Stop | Select-Object Name,DriverName,PortName,PrinterStatus,Default)
    if($p.Count -gt 0){ return $p }
  } catch {}
  try {
    return @(Get-CimInstance Win32_Printer -ErrorAction Stop | Select-Object @{N='Name';E={$_.Name}},@{N='DriverName';E={$_.DriverName}},@{N='PortName';E={$_.PortName}},@{N='PrinterStatus';E={$_.PrinterStatus}},@{N='Default';E={$_.Default}})
  } catch { return @() }
}
function Api($path,$method='GET',$body=$null){$h=@{'x-printpay-key'=$Key};if($body){$json=$body|ConvertTo-Json -Depth 10;return Invoke-RestMethod -Uri ($AppUrl+$path) -Method $method -Headers $h -ContentType 'application/json' -Body $json}else{return Invoke-RestMethod -Uri ($AppUrl+$path) -Method $method -Headers $h}}
function PrintPdf($file,$printer){if(!(Test-Path $Sumatra)){throw 'SumatraPDF.exe missing. Run install_bridge.bat.'};if([string]::IsNullOrWhiteSpace($printer)){throw 'Printer is not configured.'};& $Sumatra -silent -exit-when-done -print-to $printer -print-settings 'paper=A4,fit' $file | Out-Null;if($LASTEXITCODE -ne 0){throw "SumatraPDF print failed: $LASTEXITCODE"}}
function PollJobs {try{$d=Api '/api/print/jobs';foreach($j in @($d.jobs)){try{$c=Api '/api/print/claim' 'POST' @{order_id=$j.order_id;mode=$j.mode};if(!$c.ok){continue};$tmp=Join-Path $env:TEMP ('printpay_'+$j.order_id+'_'+$j.mode+'.pdf');$u=$AppUrl+'/api/print/file?'+[uri]::EscapeDataString('order_id')+'='+[uri]::EscapeDataString($j.order_id)+'&'+[uri]::EscapeDataString('mode')+'='+[uri]::EscapeDataString($j.mode);Invoke-WebRequest -Uri $u -Headers @{'x-printpay-key'=$Key} -OutFile $tmp;$cfg=Cfg;$printer=if($j.mode -eq 'bw'){$cfg.bw_printer}else{$cfg.color_printer};PrintPdf $tmp $printer;Api '/api/print/complete' 'POST' @{order_id=$j.order_id;mode=$j.mode}|Out-Null;Remove-Item $tmp -Force -ErrorAction SilentlyContinue}catch{try{Api '/api/print/fail' 'POST' @{order_id=$j.order_id;mode=$j.mode;error=$_.Exception.Message}|Out-Null}catch{} }}}catch{}}
function Send($ctx,$code,$obj){$bytes=[Text.Encoding]::UTF8.GetBytes(($obj|ConvertTo-Json -Depth 10));$ctx.Response.StatusCode=$code;$ctx.Response.ContentType='application/json; charset=utf-8';$ctx.Response.Headers.Add('Access-Control-Allow-Origin','*');$ctx.Response.Headers.Add('Access-Control-Allow-Headers','Content-Type');$ctx.Response.Headers.Add('Access-Control-Allow-Methods','GET,POST,OPTIONS');$ctx.Response.OutputStream.Write($bytes,0,$bytes.Length);$ctx.Response.Close()}
$listener=[Net.HttpListener]::new();$listener.Prefixes.Add("http://127.0.0.1:$Port/");$listener.Start();Write-Host "PrintPay Print Bridge running at http://127.0.0.1:$Port -> $AppUrl"
while($listener.IsListening){PollJobs; if($listener.Pending()){$ctx=$listener.GetContext();$path=$ctx.Request.Url.AbsolutePath;if($ctx.Request.HttpMethod -eq 'OPTIONS'){Send $ctx 204 @{ok=$true};continue};try{if($path -eq '/status' -and $ctx.Request.HttpMethod -eq 'GET'){Send $ctx 200 @{ok=$true;service='PrintPay Print Bridge';sumatra=(Test-Path $Sumatra);config=(Cfg)}}elseif($path -eq '/printers' -and $ctx.Request.HttpMethod -eq 'GET'){Send $ctx 200 @{ok=$true;printers=@(Printers)}}elseif($path -eq '/config' -and $ctx.Request.HttpMethod -eq 'POST'){$sr=New-Object IO.StreamReader($ctx.Request.InputStream);$b=$sr.ReadToEnd()|ConvertFrom-Json;$c=Cfg;$c.bw_printer=[string]$b.bw_printer;$c.color_printer=[string]$b.color_printer;$c.paper='A4';SaveCfg $c;Send $ctx 200 @{ok=$true;config=$c}}elseif($path -eq '/test' -and $ctx.Request.HttpMethod -eq 'POST'){$sr=New-Object IO.StreamReader($ctx.Request.InputStream);$b=$sr.ReadToEnd()|ConvertFrom-Json;$c=Cfg;$printer=if($b.mode -eq 'bw'){$c.bw_printer}else{$c.color_printer};$tmp=Join-Path $env:TEMP 'printpay_test.pdf';@('%PDF-1.4','1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj','2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj','3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R>>endobj','4 0 obj<</Length 0>>stream','endstream endobj','trailer<</Root 1 0 R>>','%%EOF') -join "`n" | Set-Content -Encoding ASCII $tmp;PrintPdf $tmp $printer;Remove-Item $tmp -Force;Send $ctx 200 @{ok=$true}}else{Send $ctx 404 @{ok=$false;error='Not found'}}}catch{Send $ctx 500 @{ok=$false;error=$_.Exception.Message}}}}
Start-Sleep -Milliseconds 250
}
