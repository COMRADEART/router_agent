param([switch]$Dashboard,[switch]$NoIsland)
$ErrorActionPreference='Stop'
$bunnyRoot=$PSScriptRoot
$bunnyRuntime=Join-Path $bunnyRoot 'runtime/node.exe'
if(Test-Path -LiteralPath (Join-Path $bunnyRoot 'remote.json')) {
  $remote=Get-Content (Join-Path $bunnyRoot 'remote.json') -Raw | ConvertFrom-Json
  $env:BUNNY_REMOTE_ORIGIN=$remote.url
}
$bunnyData=Join-Path $bunnyRoot '.bunny-a'
New-Item -ItemType Directory -Path $bunnyData -Force | Out-Null
$env:BUNNY_HOST_DATA_DIRECTORY=$bunnyData
try {$health=Invoke-RestMethod 'http://127.0.0.1:43119/health' -TimeoutSec 2} catch {$health=$null}
if($health) {
  $credentialsPath=Join-Path $bunnyData 'credentials.json'
  if(-not(Test-Path -LiteralPath $credentialsPath)) {throw 'Another Bunny-A installation owns the Host address. No process was replaced.'}
  $credentials=Get-Content $credentialsPath -Raw | ConvertFrom-Json
  if($credentials.instanceId -ne $health.instanceId) {throw 'Host identity mismatch. No process was replaced.'}
} else {
  $entry=Join-Path $bunnyRoot 'Bunny-Host.mjs'
  Start-Process $bunnyRuntime -ArgumentList @('--experimental-strip-types',('"'+$entry+'"')) -WorkingDirectory $bunnyRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bunnyData 'host.log') -RedirectStandardError (Join-Path $bunnyData 'host-error.log') | Out-Null
  for($attempt=0;$attempt -lt 80;$attempt++) {try {$health=Invoke-RestMethod 'http://127.0.0.1:43119/health' -TimeoutSec 1;break} catch {Start-Sleep -Milliseconds 250}}
  if(-not $health) {throw 'Bunny-A Host did not start.'}
}
# Dashboard service may run in the background for phone connectivity; no large
# application window opens unless Dashboard was explicitly requested.
try {$dashboardHealth=Invoke-RestMethod 'http://127.0.0.1:8084/bunny-health' -TimeoutSec 2} catch {$dashboardHealth=$null}
if($dashboardHealth -and $dashboardHealth.root -ne $bunnyRoot) {throw 'Another Bunny-A dashboard owns the address.'}
if(-not $dashboardHealth) {
  $entry=Join-Path $bunnyRoot 'Bunny-Server.mjs'
  Start-Process $bunnyRuntime -ArgumentList ('"'+$entry+'"') -WorkingDirectory $bunnyRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bunnyData 'dashboard.log') -RedirectStandardError (Join-Path $bunnyData 'dashboard-error.log') | Out-Null
}
if($Dashboard) {Start-Process 'http://127.0.0.1:8084/'}
if(-not $NoIsland) {& (Join-Path $bunnyRoot 'Bunny-Island.ps1') -Root $bunnyRoot}
