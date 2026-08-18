@echo off
chcp 65001 >nul
rem Вход в Expo одним запуском.
rem
rem Файл, а не команда в терминале, по одной причине: путь к eas-cli длинный, а
rem разделители команд у cmd и PowerShell разные — набирая вручную, ошибиться
rem проще, чем не ошибиться. Здесь всё уже записано верно.
cd /d "%~dp0"

set "EAS=%APPDATA%\npm\eas.cmd"
if not exist "%EAS%" set "EAS=eas"

echo Вход в Expo. Спросит имя пользователя и пароль с expo.dev.
echo Пароль при вводе не отображается — это нормально.
echo.
call "%EAS%" login

echo.
echo Готово. Дальше запустите ios-build.cmd
pause
