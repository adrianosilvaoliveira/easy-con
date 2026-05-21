#!/bin/bash
set -e

echo "🚀 Deploy Hospital Stock - DigitalOcean"

APP_DIR="/var/www/hospital-stock"
REPO_URL="${REPO_URL:-git@github.com:seu-usuario/hospital-stock.git}"

# Update code
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR && git pull origin main
else
  git clone $REPO_URL $APP_DIR
  cd $APP_DIR
fi

# Frontend build → backend/public
cd $APP_DIR/frontend
npm ci
npm run build

# Backend
cd $APP_DIR/backend
npm ci --only=production
npx prisma generate
npx prisma migrate deploy
npm run build

# PM2 (API + UI no mesmo processo)
pm2 reload ecosystem.config.js --env production || pm2 start ../deploy/ecosystem.config.js --env production

# NGINX (proxy único para Node)
sudo cp $APP_DIR/deploy/nginx/hospital-stock.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/hospital-stock.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deploy concluído! Acesse https://seu-dominio.com.br"
