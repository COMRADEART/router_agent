$ErrorActionPreference = 'Stop'
$pidPath = Join-Path $PSScriptRoot 'service.pid'
if (Test-Path -LiteralPath $pidPath) {
  $servicePid = [int](Get-Content -LiteralPath $pidPath)
  $servicePath = Join-Path $PSScriptRoot 'server.mjs'
  $service = Get-CimInstance Win32_Process -Filter "ProcessId = $servicePid"
  if ($service -and $service.CommandLine -notlike "*$servicePath*") { throw 'Saved process belongs to another app; refusing to stop it.' }
  if ($service) { Stop-Process -Id $servicePid }
  Remove-Item -LiteralPath $pidPath
}
