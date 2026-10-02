$ErrorActionPreference = 'Stop'
$bunnyRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'start-bunny-host.ps1') -Root $bunnyRoot
try { $response = Invoke-WebRequest 'http://127.0.0.1:8080/' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { return } } catch { }
$npmPath = (Get-Command npm.cmd).Source
Start-Process -FilePath $npmPath -ArgumentList @('run','dev') -WorkingDirectory $bunnyRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bunnyRoot '.grok/dev.log') -RedirectStandardError (Join-Path $bunnyRoot '.grok/dev-error.log') | Out-Null
