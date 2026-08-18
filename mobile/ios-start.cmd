@echo off
rem Server razrabotki dlya ustanovlennogo na telefon prilozheniya.
rem Bekend pri etom dolzhen rabotat v otdelnom okne.
cd /d "%~dp0"

echo Server razrabotki. Otkryvayte PARAFRAZ na telefone.
echo Telefon i kompyuter dolzhny byt v odnom Wi-Fi.
echo.
rem --host lan obyazatelno: bez nego Metro zhdet na localhost, a telefonu
rem nuzhen adres kompyutera v seti. QR togda vedet v nikuda.
call npx expo start --dev-client --host lan --clear
pause
