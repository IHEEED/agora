@echo off
setlocal
rem PARAFRAZ on iPhone: builds for production, then serves over the local
rem network. See PHONE.md.
rem
rem Production, not "next dev", on purpose. The dev server ships unminified
rem code, source maps, the hot-reload client, and React in development mode -
rem which renders every component twice under StrictMode. On a desktop that is
rem a rounding error. On a phone it is the difference between smooth and
rem unusable, and it was the first thing anyone opening this on an iPhone hit.

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

rem The address is baked into the frontend AT BUILD TIME, so it must be written
rem before the build runs, not after. Rewriting it here also keeps it in step
rem when the router hands out a different address than it did last time.
powershell -NoProfile -Command "$f = Join-Path '%ROOT%frontend' '.env.local'; $t = Get-Content $f; $t = $t -replace '^NEXT_PUBLIC_API_URL=.*$', 'NEXT_PUBLIC_API_URL=http://%LAN%:4000'; Set-Content $f $t -Encoding utf8"

echo.
echo   Building. About a minute - this is what makes it fast on the phone.
echo.

call npm --prefix "%ROOT%backend" run build
if errorlevel 1 (
  echo.
  echo   Backend build failed. Nothing started.
  pause
  exit /b 1
)

call npm --prefix "%ROOT%frontend" run build
if errorlevel 1 (
  echo.
  echo   Frontend build failed. Nothing started.
  pause
  exit /b 1
)

start "PARAFRAZ backend" cmd /k "cd /d %ROOT%backend && npm run start"
start "PARAFRAZ frontend" cmd /k "cd /d %ROOT%frontend && npm run start:phone"

echo.
echo   Running in two separate windows.
echo.
echo   On the iPhone, with Wi-Fi on the same network, open:
echo.
echo       http://%LAN%:3000
echo.
echo   Then Share -^> Add to Home Screen, and open it from the icon.
echo   Not optional: in Safari the address bar hides and reappears as you
echo   scroll, which resizes the page under your finger. From the Home Screen
echo   there is no address bar and nothing shifts.
echo.
echo   Nothing loads? Windows Firewall is blocking the ports. Allow Node.js
echo   for private networks when it asks, or right-click PHONE-FIREWALL.cmd
echo   and run it as administrator, once.
echo.
echo   Changed the code? Run this again - a production build is a snapshot,
echo   it does not pick up edits by itself.
echo.
echo   Close the two windows to stop.
echo.
pause
