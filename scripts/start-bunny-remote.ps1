param([string]$PackagePath)
$ErrorActionPreference='Stop'
$bunnyRoot=Split-Path -Parent $PSScriptRoot
$bunnyData=Join-Path $bunnyRoot '.bunny-a'
& (Join-Path $PSScriptRoot 'start-bunny-gateway.ps1') -PackagePath $PackagePath
$consentPath=Join-Path $bunnyData 'remote-consent.json'
if(-not(Test-Path -LiteralPath $consentPath)) {throw 'Cloudflare connection has not been explicitly approved.'}
$consent=Get-Content -LiteralPath $consentPath -Raw | ConvertFrom-Json
if(-not $consent.enabled -or $consent.provider -ne 'Cloudflare') {throw 'Cloudflare connection is disabled.'}
$nodePath=(Get-Command node).Source
$record=Join-Path $bunnyData 'tunnel-process.json'
if(Test-Path -LiteralPath $record) {
  $saved=Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
  $worker=Get-CimInstance Win32_Process -Filter ('ProcessId='+$saved.pid) -ErrorAction SilentlyContinue
  if($worker -and $worker.CommandLine.Contains((Join-Path $PSScriptRoot 'bunny-tunnel.mjs'))) {return}
}
if(-not(Test-Path -LiteralPath (Join-Path $bunnyData 'tools/cloudflared.exe'))) {throw 'Verified Cloudflare client is not installed.'}
$entry=Join-Path $PSScriptRoot 'bunny-tunnel.mjs'
Start-Process $nodePath -ArgumentList ('"'+$entry+'"') -WorkingDirectory $bunnyRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bunnyData 'tunnel.log') -RedirectStandardError (Join-Path $bunnyData 'tunnel-error.log') | Out-Null
