# AAI VABO IT Asset Manager

A full-stack **Node.js + Express** IT asset management system for Airports Authority of India — Vadodara (VABO).  
Features JWT authentication, role-based access control, asset lifecycle tracking, handover/takeover receipts, employee directory, and CSV export.

---

## 🚀 Live Demo

> Deployed on Railway — [https://your-app.up.railway.app](https://your-app.up.railway.app)  
> *(Update this link after you deploy)*

---

## 🖥️ Local Development

**Requirements:** Node.js 18+

```bash
git clone https://github.com/YOUR_USERNAME/aai-vabo-it-asset-manager.git
cd aai-vabo-it-asset-manager
npm install
cp .env.example .env       # edit .env with your JWT_SECRET
npm start
```

Open **http://localhost:8001** and sign in.  
Admin panel: **http://localhost:8001/accounts.html**

For auto-reload during development:
```bash
npm run dev
```

---

## ☁️ Deploy to Railway (Free)

### Step 1 — Sign up and connect GitHub
1. Go to [railway.app](https://railway.app) → **Sign up with GitHub**
2. Click **New Project → Deploy from GitHub Repo**
3. Select this repository

### Step 2 — Add a Persistent Volume
1. In your Railway project, click **+ New** → **Volume**
2. Set **Mount Path** to `/data`
3. This is where your database will live permanently

### Step 3 — Set Environment Variables
In Railway project → **Variables** tab, add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8001` |
| `DB_PATH` | `/data/database.db` |
| `JWT_SECRET` | *(generate a strong random string — see below)* |
| `ALLOWED_ORIGINS` | `*` or your Railway domain |

**Generate a strong JWT secret (PowerShell):**
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```
**Generate a strong JWT secret (bash/Linux/Mac):**
```bash
openssl rand -base64 48
```

### Step 4 — Deploy
Railway auto-deploys on every push to `main`. Your app will be live at:
```
https://YOUR_APP_NAME.up.railway.app
```

---

## ☁️ Deploy to Render (Alternative)

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Set **Build Command:** `npm install`
4. Set **Start Command:** `node server.js`
5. Add the same environment variables as above
6. Add a **Disk** (persistent storage) mounted at `/data`
7. Set `DB_PATH=/data/database.db`

---

## 🏗️ Architecture

```
Browser: Public/  ─── HTML + CSS + Vanilla JS
              │
              ▼
    server.js (Express, port 8001)
              │
         middleware/ → routes/
                          │
                     config/db.js
                          │
                   database.db (SQLite)
```

| Path | Responsibility |
|---|---|
| `server.js` | Entry point, Express app, graceful shutdown |
| `config/db.js` | SQLite connection, schema init, transaction queue |
| `middleware/` | JWT auth, validation, error handling |
| `routes/` | Assets, employees, transactions, auth, accounts |
| `Public/` | Frontend SPA (index.html + accounts.html) |

---

## 🔑 API Routes

| Endpoint | Description |
|---|---|
| `POST /api/auth/login` | Login → JWT token |
| `POST /api/auth/register` | Register new user (admin only) |
| `GET  /api/assets` | List assets (paginated + filtered) |
| `POST /api/assets` | Create asset |
| `PUT  /api/assets/:id` | Update asset |
| `DELETE /api/assets/:id` | Delete asset (admin only) |
| `GET  /api/assets/export` | Export all assets as CSV |
| `POST /api/assets/import` | Bulk import from CSV |
| `GET  /api/employees` | Employee directory |
| `GET  /api/transactions` | Handover/takeover history |
| `GET  /api/health` | Health check |
| `GET  /api/admin/users` | List users (admin only) |

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and fill in values:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8001` | HTTP port |
| `NODE_ENV` | `production` | Environment |
| `DB_PATH` | `./database.db` | SQLite file path |
| `JWT_SECRET` | *(required)* | Token signing key |
| `ALLOWED_ORIGINS` | `*` | CORS origins |
| `RATE_LIMIT_MAX` | `200` | Max API requests per window |

---

## 🧪 Testing

```bash
npm test                  # Full suite (215 tests)
npm run test:smoke        # Smoke test only
npm run test:integration  # Integration tests
```

---

## 📦 CSV Export

```bash
npm run export:csv
```

Exports all tables to timestamped CSV files under `exports/`.

---

## 📄 License

ISC — Airports Authority of India, VABO IT/CNS Department
