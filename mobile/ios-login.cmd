@echo off
rem Vhod v Expo odnim zapuskom.
rem
rem Fayl, a ne komanda v terminale: put k eas-cli dlinnyy, a razdeliteli
rem komand u cmd i PowerShell raznye - nabiraya vruchnuyu, oshibitsya proshche.
rem
rem Perevody strok obyazany byt CRLF. S yuniksovymi LF cmd chitaet fayl
rem vperemeshku i otvechaet "Sisteme ne udaetsya nayti ukazannyy put" -
rem pro put, kotorogo v fayle net.
cd /d "%~dp0"

set "EAS=%APPDATA%\npm\eas.cmd"
if not exist "%EAS%" set "EAS=eas"

echo Vhod v Expo. Sprosit login i parol s expo.dev.
echo Parol pri vvode ne otobrazhaetsya - eto normalno.
echo.
call "%EAS%" login

echo.
echo Gotovo. Dalshe zapustite ios-build.cmd
pause
