# AyitiMarket — Polymarket-style Prediction Platform

Production-ready prediction market platform built for Haiti, with full bilingual support (Kreyòl/Français), hybrid authentication, real-time order book via WebSocket, and local payment integrations (Unibank, Sogebank, Capital Bank, MonCash).

---

## Features

- **Hybrid Authentication** — single field detects email, username, or phone (with +509 normalization)
- **Bilingual** — full Kreyòl/Français support with language-prefixed routes (`/fr/connexion`, `/ht/konekte`)
- **Mobile-First UI** — thumb-friendly, no header overlap, bottom tab bar, glassmorphism
- **Real-Time** — WebSocket for live price updates and order book
- **Wallet** — local Haitian banks integration (simulated)
- **Admin Panel** — separate app for market management
- **Docker** — full-stack containerized
- **Performance** — code splitting, lazy loading, 60fps mobile

---

## Quick Start

### Option 1: npm (3 terminals)

```bash
# Install all dependencies
npm install --workspaces --include-workspace-root

# Terminal 1 - Backend
cd backend && cp .env.example .env && npm run dev
# → http://localhost:4000

# Terminal 2 - Client
cd frontend-client && npm run dev
# → http://localhost:3000

# Terminal 3 - Admin Panel
cd frontend-admin && npm run dev
# → http://localhost:3001
```

### Option 2: Docker

```bash
docker compose up --build
```

---

## Default Credentials

| Role | Identifier | Password |
|---|---|---|
| Admin | `admin@ayitimarket.com` (also: `admin`, or `+509admin`) | `Admin2024!` |

---

## Hybrid Auth Examples

The single auth input field accepts any of these:

```
user@example.com           → email
janpye_92                  → username
+509 3412 5678             → phone (normalized to +50934125678)
50934125678                → phone (auto +509)
34125678                   → phone (auto-prepend +509)
```

---

## URL Routes (Bilingual)

### Public
| Function | French | Kreyòl |
|---|---|---|
| Home | `/fr` | `/ht` |
| Login | `/fr/connexion` | `/ht/konekte` |
| Register | `/fr/inscription` | `/ht/enskri` |
| Markets | `/fr/markets` | `/ht/markets` (always `/markets`) |
| Portfolio | `/fr/portefeuille` | `/ht/pòtfolyo` |

### Market Detail
- Format: `/{lang}/market/{category}/{slug}`
- Example: `/ht/market/politik/eleksyon-2026`

---

## Architecture

```
ayiti-market/
├── backend/                  Express + WebSocket + sql.js (Prisma schema for prod)
│   ├── src/
│   │   ├── server.js         Entry point
│   │   ├── database.js       sql.js wrapper (zero-compilation SQLite)
│   │   ├── websocket/        WS server for live updates
│   │   ├── routes/           auth, markets, admin, wallet
│   │   ├── middleware/       auth, validate
│   │   └── utils/            identity, slug, security, logger
│   └── prisma/schema.prisma  Production PostgreSQL schema
│
├── frontend-client/          User-facing app (port 3000)
│   ├── src/
│   │   ├── api/              HTTP + WebSocket clients
│   │   ├── i18n/             ht.json + fr.json (110+ keys each)
│   │   ├── context/          AuthContext
│   │   ├── hooks/            useMarkets, useRealtime, useDebounce
│   │   ├── components/       UI (Header, MarketCard, charts/)
│   │   └── pages/            Home, Markets, MarketDetail, Auth, Portfolio
│
└── frontend-admin/           Admin panel (port 3001)
```

---

## API Endpoints

### Auth
```
POST /api/v1/auth/register      Hybrid: identifier + password
POST /api/v1/auth/login         Hybrid identifier
POST /api/v1/auth/detect        Live identifier type detection
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/refresh
```

### Markets
```
GET  /api/v1/markets            List with filters
GET  /api/v1/markets/:idOrSlug  Single market (UUID or slug)
POST /api/v1/markets/:id/bet    Place bet (auth required)
GET  /api/v1/markets/my-bets    User's bets
```

### Wallet
```
GET  /api/v1/wallet/methods     List available payment methods
POST /api/v1/wallet/deposit     Simulate deposit
POST /api/v1/wallet/withdraw    Simulate withdrawal
GET  /api/v1/wallet/transactions
```

### Admin
```
GET  /api/v1/admin/stats
GET  /api/v1/admin/users
PATCH /api/v1/admin/users/:id
POST /api/v1/admin/markets
POST /api/v1/admin/markets/:id/resolve
```

### WebSocket
```
ws://localhost:4000/ws
```
Subscribe with: `{ "type": "subscribe", "channel": "markets" }`
Receives: `market:update`, `market:resolved`, `order:filled` events

---

## Environment Variables

See `backend/.env.example` for full reference. Key vars:

```bash
PORT=4000
JWT_SECRET=<64-char random>
JWT_REFRESH_SECRET=<64-char random>
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
ADMIN_EMAIL=admin@ayitimarket.com
ADMIN_PASSWORD=Admin2024!
```

---

## Tech Stack

- **Backend:** Node.js 18+, Express 4, sql.js (dev) / Prisma+PostgreSQL (prod), ws, JWT
- **Frontend:** React 18, Vite 5, TypeScript, TailwindCSS, React Router v6 (with v7 future flags), i18next, Recharts, Zustand
- **DevOps:** Docker, docker-compose

---

## License

MIT — built with care for Haiti.
