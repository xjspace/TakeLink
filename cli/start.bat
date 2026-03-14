@echo off
chcp 65001 >nul 2>&1

echo.
echo ========================================
echo    LAN CLAUDE - 局域网远程终端
echo ========================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo 正在安装依赖...
    pnpm install
    if errorlevel 1 (
        echo 安装失败，请检查 pnpm 是否已安装
        pause
        exit /b 1
    )
)

echo 正在启动服务...
echo.
pnpm dev
