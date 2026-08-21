@echo off
setlocal
rem PARAFRAZ on iPhone: serves the current version over the local network.
rem See PHONE.md for what to do with the address it prints.

set "ROOT=%~dp0"

rem Find this machine on the local network. Detection is delegated to
rem PowerShell on purpose: the address has to be one the phone can reach,
rem which means the adapter that actually has a default gateway. Batch can
rem list addresses but cannot tell a Wi-Fi card from a virtual switch, and
rem on a machine with Docker or WSL installed it picks the wrong one.
rem
rem No carets before the pipes below: inside double quotes cmd does not treat
rem ^ as an escape, it passes it through, and PowerShell then chokes on "^|".
set "LAN="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress"`) do set "LAN=%%A"

if "%LAN%"=="" (
  echo   Could not find a local network address. Is Wi-Fi on?
  echo.
  pause
  exit /b 1
)

rem The address is read by the browser, so it has to match what the phone
rem will use. Rewriting it here keeps the two in step even when the router
rem hands out a different address than it did last time.
powershell -NoProfile -Command "$f = Join-Path '%ROOT%frontend' '.env.local'; $t = Get-Content $f; $t = $t -replace '^NEXT_PUBLIC_API_URL=.*$', 'NEXT_PUBLIC_API_URL=http://%LAN%:4000'; Set-Content $f $t -Encoding utf8"

start "PARAFRAZ backend" cmd /k "cd /d %ROOT%backend && npm run dev"
start "PARAFRAZ frontend" cmd /k "cd /d %ROOT%frontend && npm run dev:phone"

echo.
echo   Backend and frontend are starting in two separate windows.
echo   Give them about twenty seconds.
echo.
echo   On the iPhone, with Wi-Fi on the same network, open:
echo.
echo       http://%LAN%:3000
echo.
echo   Then: Share -^> Add to Home Screen. It opens without the Safari bars.
echo.
echo   Nothing loads? Windows Firewall is blocking the ports. Allow Node.js
echo   for private networks when it asks, or right-click PHONE-FIREWALL.cmd
echo   and run it as administrator, once.
echo.
echo   Close the two windows to stop.
echo.
pause
