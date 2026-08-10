@echo off
chcp 65001 >nul
echo ========================================
echo   木门库存系统 - 数据导入（恢复备份）
echo ========================================
echo.
echo 此操作会用备份文件覆盖当前数据库数据！
echo.
cd /d "%~dp0"
node import.js
echo.
pause
