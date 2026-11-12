@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Docker。请先安装 Docker Desktop：
  echo        https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [错误] Docker 没有运行。请先启动 Docker Desktop，等它显示 Engine running 后再运行本脚本。
  pause
  exit /b 1
)

set PORT=8090
if exist .env (
  for /f "tokens=1,2 delims==" %%a in (.env) do if /i "%%a"=="EASYOVL_PORT" set PORT=%%b
)

echo 正在构建并启动 EasyOVL 控制台...
docker compose up -d --build
if errorlevel 1 (
  echo [错误] 启动失败，请查看上面的输出。
  pause
  exit /b 1
)

echo.
echo 控制台已启动： http://localhost:%PORT%
start "" http://localhost:%PORT%
timeout /t 5 >nul
