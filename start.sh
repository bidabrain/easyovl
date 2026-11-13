#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "[错误] 没有找到 Docker。安装方法：https://docs.docker.com/engine/install/"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "[错误] 无法连接 Docker。请确认 Docker 已启动，并且当前用户有权限（可能需要 sudo 或加入 docker 组）。"
  exit 1
fi

PORT=8090
if [ -f .env ]; then
  v=$(grep -E '^EASYOVL_PORT=' .env | tail -1 | cut -d= -f2 || true)
  [ -n "${v:-}" ] && PORT=$v
fi

echo "正在拉取并启动 EasyOVL 控制台..."
docker compose pull && docker compose up -d

URL="http://localhost:${PORT}"
echo
echo "控制台已启动：${URL}"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then open "$URL" || true
fi
