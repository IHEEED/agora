@echo off
chcp 65001 >nul
rem Сборка приложения для iPhone в облаке Expo.
rem
rem Профиль development: приложение с отладочным клиентом, к которому можно
rem подключаться с компьютера и править код на ходу.
cd /d "%~dp0"

set "EAS=%APPDATA%\npm\eas.cmd"
if not exist "%EAS%" set "EAS=eas"

echo Сборка для iPhone. На все вопросы отвечайте Yes,
echo кроме Apple ID (введите свою почту) и кода из СМС.
echo Идёт около пятнадцати минут, ссылка придёт на почту.
echo.
call "%EAS%" build --profile development --platform ios

echo.
pause
