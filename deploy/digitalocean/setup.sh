#!/bin/bash
# DigitalOcean Droplet Setup Script for FloodWatch LK Backend
# Run this on a fresh Ubuntu 22.04 droplet

set -e

echo "=== FloodWatch LK Backend Setup ==="

# Update system
apt-get update && apt-get upgrade -y

# Install dependencies
apt-get install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx git

# Create app user
useradd -m -s /bin/bash floodwatch || true

# Create app directory
mkdir -p /opt/floodwatch
chown floodwatch:floodwatch /opt/floodwatch

# Clone repository (replace with your repo URL)
# git clone https://github.com/yourusername/floodwatch-lk.git /opt/floodwatch

# Setup Python environment
cd /opt/floodwatch/backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create environment file
cat > /opt/floodwatch/backend/.env << 'EOF'
DATABASE_URL=postgresql://floodwatch:your_password@your_db_host:25060/floodwatch?sslmode=require
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
FRONTEND_URL=https://floodwatch.vercel.app
DEBUG=false
EOF

# Create systemd service
cat > /etc/systemd/system/floodwatch.service << 'EOF'
[Unit]
Description=FloodWatch LK Backend
After=network.target

[Service]
User=floodwatch
Group=floodwatch
WorkingDirectory=/opt/floodwatch/backend
Environment="PATH=/opt/floodwatch/backend/venv/bin"
ExecStart=/opt/floodwatch/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable floodwatch
systemctl start floodwatch

# Configure Nginx
cat > /etc/nginx/sites-available/floodwatch << 'EOF'
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/floodwatch /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== Setup Complete ==="
echo "Next steps:"
echo "1. Update /opt/floodwatch/backend/.env with your credentials"
echo "2. Update nginx config with your domain"
echo "3. Run: certbot --nginx -d your_domain.com"
echo "4. Restart: systemctl restart floodwatch"
