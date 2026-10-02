param([string]$PackagePath)
$ErrorActionPreference='Stop'
$bunnyRoot=Split-Path -Parent $PSScriptRoot
$bunnyData=Join-Path $bunnyRoot '.bunny-a'
& (Join-Path $PSScriptRoot 'start-bunny-host.ps1') -Root $bunnyRoot
if(-not $PackagePath) {$PackagePath=(Get-Content -LiteralPath (Join-Path $bunnyData 'deployment.json') -Raw | ConvertFrom-Json).packagePath}
$server=Join-Path $PackagePath 'Bunny-Server.mjs'
if(-not(Test-Path -LiteralPath $server)) {throw 'Production Bunny-A gateway package missing.'}
$nodePath=(Get-Command node).Source
$env:BUNNY_REMOTE_CONFIG=Join-Path $bunnyData 'remote.json'
$env:BUNNY_HOST_DATA_DIRECTORY=$bunnyData
try {$web=Invoke-RestMethod 'http://127.0.0.1:8084/bunny-health' -TimeoutSec 2} catch {$web=$null}
if($web -and $web.root -ne $bunnyRoot) {throw 'Another dashboard owns the address. Nothing was replaced.'}
if(-not $web) {Start-Process $nodePath -ArgumentList ('"'+$server+'"') -WorkingDirectory $bunnyRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bunnyData 'gateway.log') -RedirectStandardError (Join-Path $bunnyData 'gateway-error.log') | Out-Null}
