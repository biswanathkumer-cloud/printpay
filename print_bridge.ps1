param(
    [string]$AppUrl = $env:PRINTPAY_URL,
    [string]$Key = $env:PRINTPAY_KEY,
    [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$AppUrl = $AppUrl.TrimEnd('/')
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Sumatra = Join-Path $Root 'SumatraPDF\SumatraPDF.exe'
$CfgFile = Join-Path $Root 'bridge_config.json'

if ([string]::IsNullOrWhiteSpace($AppUrl)) { throw 'PRINTPAY_URL is empty.' }
if ([string]::IsNullOrWhiteSpace($Key)) { throw 'PRINTPAY_KEY is empty.' }

if (-not (Test-Path $CfgFile)) {
    $defaultConfig = [ordered]@{
        bw_printer = ''
        color_printer = ''
        paper = 'A4'
        auto_print = $true
    }
    $defaultConfig | ConvertTo-Json | Set-Content -Path $CfgFile -Encoding UTF8
}

function Get-BridgeConfig {
    return (Get-Content -Path $CfgFile -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Save-BridgeConfig([object]$Config) {
    $Config | ConvertTo-Json -Depth 10 | Set-Content -Path $CfgFile -Encoding UTF8
}

function Get-LocalPrinters {
    $items = @()
    try {
        $items = @(Get-Printer -ErrorAction Stop | Select-Object Name,DriverName,PortName,PrinterStatus,Default)
    } catch {
        $items = @()
    }
    if ($items.Count -gt 0) {
        return $items
    }

    try {
        $items = @(Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop | ForEach-Object {
            [pscustomobject]@{
                Name = $_.Name
                DriverName = $_.DriverName
                PortName = $_.PortName
                PrinterStatus = $_.PrinterStatus
                Default = $_.Default
            }
        })
    } catch {
        $items = @()
    }
    return $items
}

function Invoke-PrintPayApi([string]$Path, [string]$Method = 'GET', [object]$Body = $null) {
    $headers = @{ 'x-printpay-key' = $Key }
    $uri = $AppUrl + $Path
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 10 -Compress
        return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -ContentType 'application/json' -Body $json
    }
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
}

function Print-Pdf([string]$FilePath, [string]$PrinterName) {
    if (-not (Test-Path $Sumatra)) {
        throw 'SumatraPDF.exe missing. Run install_bridge.bat first.'
    }
    if ([string]::IsNullOrWhiteSpace($PrinterName)) {
        throw 'Printer is not configured.'
    }
    if (-not (Test-Path $FilePath)) {
        throw 'PDF file was not downloaded.'
    }

    & $Sumatra '-silent' '-exit-when-done' '-print-to' $PrinterName '-print-settings' 'paper=A4,fit' $FilePath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw ('SumatraPDF print failed with exit code ' + $LASTEXITCODE)
    }
}

function Poll-PrintJobs {
    try {
        $response = Invoke-PrintPayApi '/api/print/jobs'
        foreach ($job in @($response.jobs)) {
            try {
                $claim = Invoke-PrintPayApi '/api/print/claim' 'POST' @{ order_id = $job.order_id; mode = $job.mode }
                if (-not $claim.ok) { continue }

                $safeOrder = [uri]::EscapeDataString([string]$job.order_id)
                $safeMode = [uri]::EscapeDataString([string]$job.mode)
                $tmp = Join-Path $env:TEMP ('printpay_' + $job.order_id + '_' + $job.mode + '.pdf')
                $fileUri = $AppUrl + '/api/print/file?order_id=' + $safeOrder + '&mode=' + $safeMode
                Invoke-WebRequest -UseBasicParsing -Uri $fileUri -Headers @{ 'x-printpay-key' = $Key } -OutFile $tmp

                $config = Get-BridgeConfig
                $printerName = ''
                if ([string]$job.mode -eq 'bw') {
                    $printerName = [string]$config.bw_printer
                } else {
                    $printerName = [string]$config.color_printer
                }

                Print-Pdf $tmp $printerName
                Invoke-PrintPayApi '/api/print/complete' 'POST' @{ order_id = $job.order_id; mode = $job.mode } | Out-Null
                Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue
            } catch {
                try {
                    Invoke-PrintPayApi '/api/print/fail' 'POST' @{ order_id = $job.order_id; mode = $job.mode; error = $_.Exception.Message } | Out-Null
                } catch { }
            }
        }
    } catch {
        # Keep the bridge alive during temporary network errors.
    }
}

function Send-Json([System.Net.HttpListenerContext]$Context, [int]$StatusCode, [object]$Object) {
    $json = $Object | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = 'application/json; charset=utf-8'
    $Context.Response.Headers['Access-Control-Allow-Origin'] = '*'
    $Context.Response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
    $Context.Response.Headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.Close()
}

function Read-JsonBody([System.Net.HttpListenerContext]$Context) {
    $reader = New-Object System.IO.StreamReader($Context.Request.InputStream)
    try {
        return ($reader.ReadToEnd() | ConvertFrom-Json)
    } finally {
        $reader.Dispose()
    }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add(('http://127.0.0.1:' + $Port + '/'))
$listener.Start()

Write-Host ''
Write-Host 'PrintPay Print Bridge is RUNNING.' -ForegroundColor Green
Write-Host ('Local address: http://127.0.0.1:' + $Port)
Write-Host ('Worker: ' + $AppUrl)
Write-Host 'Do not close this window.'
Write-Host ''

try {
    # HttpListener has no Pending() method. Use BeginGetContext/EndGetContext
    # so the bridge can keep polling print jobs without blocking HTTP requests.
    $asyncContext = $null
    while ($listener.IsListening) {
        Poll-PrintJobs

        if ($null -eq $asyncContext) {
            $asyncContext = $listener.BeginGetContext($null, $null)
        }

        if ($asyncContext.AsyncWaitHandle.WaitOne(100)) {
            $context = $listener.EndGetContext($asyncContext)
            $asyncContext = $null
            $path = $context.Request.Url.AbsolutePath
            $method = $context.Request.HttpMethod

            if ($method -eq 'OPTIONS') {
                Send-Json $context 204 @{ ok = $true }
                continue
            }

            try {
                if ($path -eq '/status' -and $method -eq 'GET') {
                    Send-Json $context 200 @{ ok = $true; service = 'PrintPay Print Bridge'; sumatra = (Test-Path $Sumatra); config = (Get-BridgeConfig) }
                }
                elseif ($path -eq '/printers' -and $method -eq 'GET') {
                    Send-Json $context 200 @{ ok = $true; printers = @(Get-LocalPrinters) }
                }
                elseif ($path -eq '/config' -and $method -eq 'POST') {
                    $body = Read-JsonBody $context
                    $config = Get-BridgeConfig
                    $config.bw_printer = [string]$body.bw_printer
                    $config.color_printer = [string]$body.color_printer
                    $config.paper = 'A4'
                    $config.auto_print = $true
                    Save-BridgeConfig $config
                    Send-Json $context 200 @{ ok = $true; config = $config }
                }
                elseif ($path -eq '/test' -and $method -eq 'POST') {
                    $body = Read-JsonBody $context
                    $config = Get-BridgeConfig
                    $printerName = ''
                    if ([string]$body.mode -eq 'bw') {
                        $printerName = [string]$config.bw_printer
                    } else {
                        $printerName = [string]$config.color_printer
                    }

                    $tmp = Join-Path $env:TEMP 'printpay_test.pdf'
                    $pdf = @(
                        '%PDF-1.4',
                        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
                        '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj',
                        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<<>>>>endobj',
                        '4 0 obj<</Length 0>>stream',
                        'endstream',
                        'endobj',
                        'trailer<</Root 1 0 R>>',
                        '%%EOF'
                    ) -join "`r`n"
                    Set-Content -Path $tmp -Value $pdf -Encoding ASCII
                    Print-Pdf $tmp $printerName
                    Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue
                    Send-Json $context 200 @{ ok = $true }
                }
                else {
                    Send-Json $context 404 @{ ok = $false; error = 'Not found' }
                }
            }
            catch {
                Send-Json $context 500 @{ ok = $false; error = $_.Exception.Message }
            }
        }

        Start-Sleep -Milliseconds 150
    }
}
finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
}
