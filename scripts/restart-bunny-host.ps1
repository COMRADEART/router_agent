$ErrorActionPreference='Stop'
$bunnyRoot=Split-Path -Parent $PSScriptRoot
$credentialPath=Join-Path $bunnyRoot '.bunny-a/credentials.json'
if(Test-Path -LiteralPath $credentialPath) {
  $credentials=Get-Content -LiteralPath $credentialPath -Raw | ConvertFrom-Json
  $base='http://127.0.0.1:'+$credentials.port
  $health=Invoke-RestMethod ($base+'/health') -TimeoutSec 2
  if($health.app -ne 'Bunny-A' -or $health.instanceId -ne $credentials.instanceId -or $health.pid -ne $credentials.pid) {throw 'Host identity mismatch. No process stopped.'}
  $snapshot=Invoke-RestMethod ($base+'/state') -Headers @{Authorization='Bearer '+$credentials.token} -TimeoutSec 2
  if(@($snapshot.tasks | Where-Object state -in @('running','launching','verifying','waiting_for_input','waiting_for_agent_approval')).Count) {throw 'Host has active jobs. Stop them explicitly before a source restart.'}
  Stop-Process -Id $credentials.pid
}
& (Join-Path $PSScriptRoot 'start-bunny-host.ps1') -Root $bunnyRoot
