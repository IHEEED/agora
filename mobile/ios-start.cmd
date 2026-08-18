@echo off
chcp 65001 >nul
rem Сервер разработки для установленного на телефон приложения.
rem Бэкенд при этом должен работать в отдельном окне: backend\npm run dev
cd /d "%~dp0"
echo Запускаю сервер разработки. Открывайте PARAFRAZ на телефоне.
echo Телефон и компьютер должны быть в одном Wi-Fi.
echo.
npx expo start --dev-client
pause
