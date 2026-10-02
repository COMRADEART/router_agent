@echo off
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Launch-Bunny-A.ps1" %*
