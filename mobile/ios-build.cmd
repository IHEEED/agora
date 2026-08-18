@echo off
rem Sborka dlya iPhone v oblake Expo.
cd /d "%~dp0"

rem Ishem eas-cli po ochered: shim v APPDATA, potom PATH, potom pryamoy
rem zapusk cherez node. Odnoy proverki ne hvataet: okno, otkrytoe do
rem ustanovki, derzhit staryy PATH, a raspolozhenie shima zavisit ot togo,
rem kuda npm stavit globalnye pakety.
set "EAS="
if exist "%APPDATA%\npm\eas.cmd" set "EAS=%APPDATA%\npm\eas.cmd"
if not defined EAS for /f "delims=" %%i in ('where eas 2^>nul') do set "EAS=%%i"
if not defined EAS for /f "delims=" %%i in ('npm root -g 2^>nul') do set "NPMROOT=%%i"
if not defined EAS if exist "%NPMROOT%\eas-cli\bin\run" set "EAS=node|%NPMROOT%\eas-cli\bin\run"

if not defined EAS (
  echo NE NASHEL eas-cli. Ustanovite ego komandoy:
  echo    npm install -g eas-cli
  echo i zapustite etot fayl snova.
  pause
  exit /b 1
)

echo Sborka dlya iPhone. Na vse voprosy otvechayte Yes,
echo krome Apple ID (vvedite svoyu pochtu) i koda iz SMS.
echo Idet okolo pyatnadcati minut, ssylka pridet na pochtu.
echo.
echo %EAS% | find "node|" >nul
if errorlevel 1 (
  call "%EAS%" build --profile development --platform ios
) else (
  for /f "tokens=1,* delims=|" %%a in ("%EAS%") do call node "%%b" build --profile development --platform ios
)

echo.
pause
