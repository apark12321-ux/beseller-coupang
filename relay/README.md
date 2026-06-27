# Coupang fixed IP relay

Vercel can change outbound IPs. Coupang Open API requires the calling IP to be registered in WING. This relay runs on a VPS with one fixed public IP and performs all Coupang calls from that IP.

## 1. VPS setup

```bash
sudo apt update
sudo apt install -y nodejs npm git nginx
node -v
```

Node 18 or later is required.

## 2. Deploy relay

```bash
git clone https://github.com/apark12321-ux/beseller-coupang.git
cd beseller-coupang/relay
cp .env.example .env
nano .env
npm install
npm start
```

Required `.env` values:

```env
PORT=8787
COUPANG_ACCESS_KEY=...
COUPANG_SECRET_KEY=...
COUPANG_VENDOR_ID=A01506362
COUPANG_RELAY_SECRET=make-a-long-random-secret
```

## 3. Run with pm2

```bash
sudo npm install -g pm2
pm2 start server.js --name coupang-relay
pm2 save
pm2 startup
```

## 4. Nginx reverse proxy

Use a domain such as `relay.your-domain.com` and proxy to port `8787`.

```nginx
server {
  listen 80;
  server_name relay.your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then apply HTTPS with certbot.

## 5. Vercel environment variables

Set these in the Vercel project:

```env
COUPANG_RELAY_URL=https://relay.your-domain.com
COUPANG_RELAY_SECRET=same-value-as-relay-env
COUPANG_VENDOR_ID=A01506362
```

After saving, redeploy the Vercel project.

## 6. Coupang WING IP

Register only the VPS public IP in Coupang WING Open API IP list. The Vercel IPs no longer matter after relay mode is enabled.

## 7. Health check

```bash
curl https://relay.your-domain.com/health
```

The response shows the relay egress IP and whether credentials are configured. It never returns the actual keys.
