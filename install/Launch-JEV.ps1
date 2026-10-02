param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$appDirectory = $PSScriptRoot
$healthUrl = 'http://127.0.0.1:8082/jev-health'
function Test-Jev {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    return $health.app -eq 'JEV' -and $health.packageVersion -eq 1
  } catch { return $false }
}
if (-not (Test-Jev)) {
  # Refuse to take over another service's port.
  $listener = [System.Net.Sockets.TcpClient]::new()
  try {
    $listener.Connect('127.0.0.1', 8082)
    throw 'Another app uses the JEV service address. Close it before launching JEV.'
  } catch [System.Net.Sockets.SocketException] {
    # The port is free.
  } finally { $listener.Dispose() }
  $runtimePath = Join-Path $appDirectory 'runtime/node.exe'
  $servicePath = Join-Path $appDirectory 'server.mjs'
  $serviceProcess = Start-Process -FilePath $runtimePath -ArgumentList @('"' + $servicePath + '"') -WorkingDirectory $appDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $appDirectory 'service.log') -RedirectStandardError (Join-Path $appDirectory 'service-error.log') -PassThru
  $serviceProcess.Id | Set-Content -LiteralPath (Join-Path $appDirectory 'service.pid')
  for ($attempt = 0; $attempt -lt 80; $attempt++) {
    if (Test-Jev) { break }
    if ($serviceProcess.HasExited) { throw 'JEV stopped during startup. See service-error.log.' }
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-Jev)) { throw 'JEV did not finish starting. See service-error.log.' }
}
if (-not $NoBrowser) {
  $browserPath = @(
    "$env:ProgramFiles/Google/Chrome/Application/chrome.exe",
    "${env:ProgramFiles(x86)}/Microsoft/Edge/Application/msedge.exe",
    "$env:ProgramFiles/Microsoft/Edge/Application/msedge.exe"
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($browserPath) { Start-Process -FilePath $browserPath -ArgumentList '--app=http://127.0.0.1:8082/' -WindowStyle Normal }
  else { Start-Process 'http://127.0.0.1:8082/' }
}
