param([string]$PackageName = 'JEV-Windows')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
if ($PackageName -notmatch '^[A-Za-z0-9-]+$') { throw 'Invalid package name.' }
$buildDirectory = Join-Path $workspace ('test-results/desktop-build-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$packageDirectory = Join-Path $workspace ('releases/' + $PackageName)
if (Test-Path -LiteralPath $packageDirectory) { throw 'Package already exists. Use a new package name to preserve the previous version.' }
New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null
Push-Location $workspace
try {
  $sourceFiles = git ls-files --cached --others --exclude-standard
  foreach ($relative in $sourceFiles) {
    if ($relative.StartsWith('.vercel/output/')) { continue }
    $sourcePath = Join-Path $workspace $relative
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { continue }
    $targetPath = Join-Path $buildDirectory $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetPath) -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath
  }
  New-Item -ItemType Junction -Path (Join-Path $buildDirectory 'node_modules') -Target (Join-Path $workspace 'node_modules') | Out-Null
  $previousPreset = $env:JEV_DESKTOP_BUILD
  try {
    $env:JEV_DESKTOP_BUILD = '1'
    npm run build --prefix $buildDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Desktop production build failed.' }
  } finally { $env:JEV_DESKTOP_BUILD = $previousPreset }
  New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $buildDirectory '.output') -Destination (Join-Path $packageDirectory '.output') -Recurse
  Get-ChildItem -LiteralPath (Join-Path $workspace 'install') -File | Copy-Item -Destination $packageDirectory
  $runtimeDirectory = Join-Path $packageDirectory 'runtime'
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
  $nodePath = (Get-Command node).Source
  Copy-Item -LiteralPath $nodePath -Destination (Join-Path $runtimeDirectory 'node.exe')
  $nodeVersion = (& $nodePath --version).Trim()
  Invoke-WebRequest -Uri ('https://raw.githubusercontent.com/nodejs/node/' + $nodeVersion + '/LICENSE') -OutFile (Join-Path $runtimeDirectory 'LICENSE')
  # Include dependency notices from the standalone output; no application secrets
  # or browser task histories are copied into the package.
  $archivePath = $packageDirectory + '.zip'
  Compress-Archive -LiteralPath $packageDirectory -DestinationPath $archivePath
  Get-FileHash -LiteralPath $archivePath -Algorithm SHA256 | Format-List
  Write-Output ('Package: ' + $packageDirectory)
} finally { Pop-Location }
