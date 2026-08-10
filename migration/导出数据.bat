@echo off
chcp 65001 >nul
echo ========================================
echo   木门库存系统 - 数据导出
echo ========================================
echo.
cd /d "%~dp0"
node export.js
echo.
pause
