@echo off
rem Full local copy of the project as one dated archive.
rem The work is done by backup.ps1 next to this file - see the comments there.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup.ps1"
pause
