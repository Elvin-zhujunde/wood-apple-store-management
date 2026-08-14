#!/bin/bash
# 部署脚本：被 webhook server.js 调用，参数 $1 = 上传的 zip 包路径
#
# 流程：校验包 → 备份原部署目录 → 解压新包 → 保留服务器 .env 与 uploads → npm install → pm2 reload
#
# 环境变量（在 deploy-hook/.env 配置，pm2 会注入）：
#   APP_DIR       部署根目录（含 dist/ server/），默认 /opt/wood-store
#   APP_NAME      pm2 进程名，默认 wood-store-server
#   KEEP_BACKUPS  保留最近几个备份，默认 5
set -euo pipefail

PKG="${1:-}"
APP_DIR="${APP_DIR:-/opt/wood-store}"
APP_NAME="${APP_NAME:-wood-store-server}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"

echo "[deploy] ====== 开始部署 ======"
echo "[deploy] 包路径 : $PKG"
echo "[deploy] 目标目录: $APP_DIR"
echo "[deploy] pm2进程: $APP_NAME"

# ---------- 1. 校验 ----------
[ -n "$PKG" ] && [ -f "$PKG" ] || { echo "[deploy] ✗ 包文件不存在"; exit 1; }

# ---------- 2. 备份原包 ----------
TS=$(date +%Y%m%d-%H%M%S)
BACKUP="${APP_DIR}.bak-${TS}"
if [ -d "$APP_DIR" ]; then
  cp -r "$APP_DIR" "$BACKUP"
  echo "[deploy] ✓ 已备份原包 → $BACKUP"
  # 清理旧备份，仅保留最近 KEEP_BACKUPS 个
  ls -dt "${APP_DIR}.bak-"* 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | while read -r old; do
    rm -rf "$old" && echo "[deploy] · 清理旧备份 $old"
  done
else
  echo "[deploy] · 首次部署，无原包可备份"
  mkdir -p "$APP_DIR"
fi

# ---------- 3. 解压新包到临时目录 ----------
# 注：解压到 mktemp 专属临时目录，即使 zip 内含恶意 ../ 路径也只影响 /tmp，不波及系统
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
unzip -q "$PKG" -d "$TMP"
# deploy.js 打包的是 deploy/ 目录，取其内容；兼容直接打内容的包
if [ -d "$TMP/deploy" ]; then SRC="$TMP/deploy"; else SRC="$TMP"; fi

# 清空目标目录（含隐藏文件），再拷入新内容
rm -rf "${APP_DIR:?}/"* 2>/dev/null || true
rm -rf "${APP_DIR:?}/".[!.]* 2>/dev/null || true
cp -r "$SRC"/. "$APP_DIR"/
echo "[deploy] ✓ 已解压新包到 $APP_DIR"

# ---------- 4. 保留服务器运行时数据（关键！） ----------
# deploy.js 打包会带入开发环境 server/.env（密码 010207）和空 uploads/
# 部署时必须用备份里的服务器实际 .env 和已上传图片覆盖回去，否则：
#   - .env 被覆盖回开发密码 → 连不上服务器 MySQL
#   - uploads 被清空 → 用户上传的历史图片全丢
if [ -f "$BACKUP/server/.env" ]; then
  cp "$BACKUP/server/.env" "$APP_DIR/server/.env"
  echo "[deploy] ✓ 已保留服务器 .env 配置"
fi
if [ -d "$BACKUP/server/uploads" ]; then
  mkdir -p "$APP_DIR/server/uploads"
  cp -r "$BACKUP/server/uploads/." "$APP_DIR/server/uploads/" 2>/dev/null || true
  echo "[deploy] ✓ 已保留 uploads 图片数据"
fi
mkdir -p "$APP_DIR/server/uploads"

# ---------- 5. 安装后端依赖 ----------
cd "$APP_DIR/server"
if [ -f package.json ]; then
  echo "[deploy] · npm install --production ..."
  npm install --production --no-audit --no-fund
  echo "[deploy] ✓ 依赖安装完成"
fi

# ---------- 6. pm2 重启（reload 零停机；进程不存在则 start） ----------
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME"
  echo "[deploy] ✓ pm2 reload $APP_NAME（零停机）"
else
  pm2 start "$APP_DIR/server/src/server.js" --name "$APP_NAME"
  echo "[deploy] ✓ pm2 start $APP_NAME（新进程，首次部署）"
fi
pm2 save >/dev/null 2>&1 || true

echo "[deploy] ✅ ====== 部署完成 ======"
echo "[deploy] 备份在: $BACKUP  （如需回滚：rm -rf $APP_DIR && mv $BACKUP $APP_DIR && pm2 reload $APP_NAME）"
