$ErrorActionPreference = 'Stop'
$bunnyRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'start-bunny-host.ps1') -Root $bunnyRoot
if(Test-Path -LiteralPath (Join-Path $bunnyRoot '.bunny-a/deployment.json')) { & (Join-Path $PSScriptRoot 'start-bunny-gateway.ps1') }
$consentPath=Join-Path $bunnyRoot '.bunny-a/remote-consent.json'
if((Test-Path -LiteralPath $consentPath) -and (Get-Content -LiteralPath $consentPath -Raw | ConvertFrom-Json).enabled) { & (Join-Path $PSScriptRoot 'start-bunny-remote.ps1') }
# A per-user named mutex prevents duplicate islands; closing never stops Host.
$created = $false
$mutex = [Threading.Mutex]::new($true,'Local\Bunny-A-Island',[ref]$created)
if (-not $created) { $mutex.Dispose(); return }
try { & (Join-Path $bunnyRoot 'install/Bunny-Island.ps1') -Root $bunnyRoot }
finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
