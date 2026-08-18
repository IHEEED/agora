@echo off
rem Sborka prilozheniya dlya iPhone v oblake Expo.
rem Profil development: prilozhenie s otladochnym klientom, k kotoromu mozhno
rem podklyuchatsya s kompyutera i pravit kod na hodu.
cd /d "%~dp0"

set "EAS=%APPDATA%\npm\eas.cmd"
if not exist "%EAS%" set "EAS=eas"

echo Sborka dlya iPhone. Na vse voprosy otvechayte Yes,
echo krome Apple ID (vvedite svoyu pochtu) i koda iz SMS.
echo Idet okolo pyatnadcati minut, ssylka pridet na pochtu.
echo.
call "%EAS%" build --profile development --platform ios

echo.
pause
