param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$dataDirectory = Join-Path $Root '.bunny-a'
New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
$credentialsPath = Join-Path $dataDirectory 'credentials.json'
try {
  $health = Invoke-RestMethod 'http://127.0.0.1:43119/health' -TimeoutSec 2
  if ($health.app -eq 'Bunny-A' -and (Test-Path -LiteralPath $credentialsPath)) {
    $saved = Get-Content -LiteralPath $credentialsPath -Raw | ConvertFrom-Json
    if ($saved.instanceId -eq $health.instanceId) { return }
  }
  throw 'Another service holds the Bunny-A Host address.'
} catch [System.Net.WebException] { }
$nodePath = (Get-Command node).Source
$entryPath = Join-Path $Root 'scripts/bunny-host.mjs'
$hostProcess = Start-Process -FilePath $nodePath -ArgumentList @('--experimental-strip-types', ('"' + $entryPath + '"')) -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataDirectory 'host.log') -RedirectStandardError (Join-Path $dataDirectory 'host-error.log') -PassThru
for ($attempt = 0; $attempt -lt 80; $attempt++) {
  try { $health = Invoke-RestMethod 'http://127.0.0.1:43119/health' -TimeoutSec 1; if ($health.app -eq 'Bunny-A') { return } } catch { }
  if ($hostProcess.HasExited) { throw 'Bunny-A Host stopped. See .bunny-a/host-error.log.' }
  Start-Sleep -Milliseconds 250
}
throw 'Bunny-A Host did not become reachable.'
