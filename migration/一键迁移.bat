@echo off
chcp 65001 >nul
echo ========================================
echo   木门库存系统 - 一键迁移（导出+建库+导入）
echo   用途：把当前数据完整搬到新机器
echo   前提：新机器已装 Node.js 和 MySQL
echo ========================================
echo.
cd /d "%~dp0"

echo [1/4] 检查备份文件...
if not exist "wood_store_backup.sql" (
  echo ❌ 当前目录没有 wood_store_backup.sql
  echo    请先在旧机器执行「导出数据.bat」，把生成的 wood_store_backup.sql 拷到此目录。
  pause
  exit /b 1
)
echo ✅ 找到备份文件
echo.

echo [2/4] 安装后端依赖（如未安装）...
cd ..\server
if not exist "node_modules" (
  call npm install
)
echo.

echo [3/4] 创建空数据库...
cd ..\migration
call node create-db.js
echo.

echo [4/4] 导入备份数据...
call node import.js
echo.
echo ========================================
echo   迁移完成！接下来按 README-迁移说明.md
echo   的「三、首次部署」步骤4启动系统即可。
echo ========================================
pause
