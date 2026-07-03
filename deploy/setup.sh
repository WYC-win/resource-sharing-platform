#!/bin/bash
#==============================================
# 📖 北地书阁 - 一键部署脚本
# 适用系统：Ubuntu 22.04 LTS
# 服务器配置：2C2G
#==============================================

set -e

# ============ 配置 ============
APP_DIR="/opt/resource-platform"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
DOMAIN=""  # 如有域名请填写，例如 "resource.example.com"

# ============ 颜色 ============
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo "=============================================="
echo "   北地书阁 - 一键部署脚本"
echo "=============================================="
echo ""

# ============ 检查 root ============
if [ "$EUID" -ne 0 ]; then
  err "请使用 root 用户或 sudo 运行此脚本"
fi

# ============ 1. 系统更新 ============
info "步骤 1/8：更新系统软件源..."
apt update -y
apt upgrade -y -q
log "系统更新完成"

# ============ 2. 安装依赖 ============
info "步骤 2/8：安装系统依赖..."
apt install -y nginx nodejs npm git curl certbot python3-certbot-nginx
log "系统依赖安装完成"

# ============ 3. 关闭不必要的服务（节约内存）============
info "步骤 3/8：优化系统内存..."

# 关闭 snapd（可节省 ~100MB）
if systemctl is-active snapd >/dev/null 2>&1; then
  systemctl stop snapd 2>/dev/null || true
  systemctl disable snapd 2>/dev/null || true
  warn "已禁用 snapd（可节省 ~100MB 内存）"
fi

# 关闭 unattended-upgrades
if systemctl is-active unattended-upgrades >/dev/null 2>&1; then
  systemctl stop unattended-upgrades 2>/dev/null || true
  warn "已禁用自动更新服务"
fi

# 配置 2GB Swap（如果还没有）
if ! swapon --show | grep -q .; then
  info "创建 2GB Swap 文件..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "Swap 已创建（2GB）"
fi

# 优化 swappiness
echo "vm.swappiness=10" > /etc/sysctl.d/99-swap.conf
sysctl -p /etc/sysctl.d/99-swap.conf 2>/dev/null || true
log "内存优化完成"

# ============ 4. 部署应用 ============
info "步骤 4/8：部署应用..."

if [ -d "$APP_DIR" ]; then
  warn "$APP_DIR 已存在，更新代码..."
  cd $APP_DIR
  git pull 2>/dev/null || warn "git pull 失败，跳过"
else
  # 如果当前脚本在项目目录中，直接复制
  SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  if [ -f "$SCRIPT_DIR/server/package.json" ]; then
    cp -r "$SCRIPT_DIR" "$APP_DIR"
    log "已从当前目录复制项目文件"
  else
    err "未找到项目文件，请将项目放在当前目录或配置 git 仓库"
  fi
fi

cd "$APP_DIR"

# ============ 5. 配置后端 ============
info "步骤 5/8：配置后端..."

# 创建 .env 文件（如果不存在）
if [ ! -f "$APP_DIR/server/.env" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  cat > "$APP_DIR/server/.env" << EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=${JWT_SECRET}
DB_PATH=${APP_DIR}/server/data/database.sqlite
UPLOAD_DIR=${APP_DIR}/server/uploads
MAX_FILE_SIZE=52428800
CORS_ORIGIN=http://${SERVER_IP}
EOF
  log "已生成 .env 配置文件"
fi

# 创建目录
mkdir -p "$APP_DIR/server/data"
mkdir -p "$APP_DIR/server/uploads"/{pending,approved,rejected}
mkdir -p /var/log/resource-api

# 安装后端依赖并初始化
cd "$APP_DIR/server"
npm install --production 2>&1 | tail -1
node seeds/seed.js
log "后端配置完成"

# ============ 6. 构建前端 ============
info "步骤 6/8：构建前端..."
cd "$APP_DIR/client"
npm install 2>&1 | tail -1
npx vite build
log "前端构建完成"

# ============ 7. 配置 Nginx ============
info "步骤 7/8：配置 Nginx..."

# 使用部署配置或自动生成
if [ -f "$APP_DIR/deploy/nginx.conf" ]; then
  cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/resource-platform
else
  # 自动生成 Nginx 配置
  cat > /etc/nginx/sites-available/resource-platform << 'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 60M;

    # Gzip
    gzip on;
    gzip_types text/plain application/json application/javascript text/css image/svg+xml;

    # Frontend static files
    root /opt/resource-platform/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
NGINX
fi

# 启用站点
if [ -f /etc/nginx/sites-enabled/default ]; then
  rm /etc/nginx/sites-enabled/default
fi
ln -sf /etc/nginx/sites-available/resource-platform /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
log "Nginx 配置完成"

# ============ 8. 配置 PM2 ============
info "步骤 8/8：配置 PM2 进程管理..."

# 安装 PM2
npm install -g pm2 2>&1 | tail -1

# 启动应用
cd "$APP_DIR/server"
pm2 start "$APP_DIR/deploy/ecosystem.config.js" 2>/dev/null || \
  pm2 start src/server.js --name resource-api \
    --node-args="--max-old-space-size=256" \
    --max-memory-restart="300M" \
    --log-date-format="YYYY-MM-DD HH:mm:ss Z" \
    -e /var/log/resource-api/error.log \
    -o /var/log/resource-api/out.log

pm2 save
pm2 startup systemd 2>/dev/null | tail -1 || true

log "PM2 配置完成"

# ============ 完成 ============
echo ""
echo "=============================================="
echo -e "${GREEN}  ✅ 部署完成！${NC}"
echo "=============================================="
echo ""
echo "  访问地址：http://${SERVER_IP}"
echo ""
echo "  管理员账号：admin"
echo "  管理员密码：admin123456"
echo "  ⚠️  请尽快修改默认密码！"
echo ""
echo "  日志文件：/var/log/resource-api/"
echo "  项目目录：${APP_DIR}"
echo ""
echo "  常用命令："
echo "    pm2 status              # 查看进程状态"
echo "    pm2 logs resource-api   # 查看日志"
echo "    pm2 restart resource-api # 重启服务"
echo ""

if [ -n "$DOMAIN" ]; then
  echo "  配置 SSL（Let's Encrypt）："
  echo "    certbot --nginx -d ${DOMAIN}"
fi

echo ""
echo "=============================================="
