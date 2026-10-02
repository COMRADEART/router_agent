param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$bunnyRoot = Split-Path -Parent $PSScriptRoot
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'Bunny-A.lnk'
if ($Remove) { if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }; return }
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
$entry = Join-Path $PSScriptRoot 'start-bunny-island.ps1'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $entry + '"'
$shortcut.WorkingDirectory = $bunnyRoot
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start Bunny-A Host and compact Island at Windows login; dashboard stays closed.'
$shortcut.Save()
Write-Output 'Bunny-A starts at Windows login. No dashboard auto-launch.'
