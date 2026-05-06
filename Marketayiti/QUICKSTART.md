# AyitiMarket — Quick Start (Node.js v18+)

## Installation — ORDRE OBLIGATWA (3 terminal separe)

### Terminal 1 — Backend (KÒMANSE AN PREMYE)
```bash
cd backend
npm install
npm start
```
Ou dwe wè: `AyitiMarket API: http://localhost:4000`
Verifye: `curl http://localhost:4000/api/health` → `{"status":"ok",...}`

### Terminal 2 — Client (apre backend mache)
```bash
cd frontend-client
npm install
npm run dev
```
Louvri: http://localhost:3000

### Terminal 3 — Admin (opsyonèl)
```bash
cd frontend-admin
npm install
npm run dev
```
Louvri: http://localhost:3001

---

## Idantifyan Admin
- Email: `admin@ayitimarket.com`
- Modpas: `Admin2024!`

---

## Rezoud Pwoblèm Windows

### `MODULE_NOT_FOUND: minimatch`
**Kòz:** Ou te fè `npm install` nan dossye rasin (workspace issue).
**Koreksyon:**
```bash
# Efase node_modules nan backend
cd backend
rmdir /s /q node_modules
del package-lock.json
npm install
npm start
```

### `Cannot find module 'express-rate-limit/dist/index.cjs'`
**Kòz:** Ansyen vèsyon pakèt yo.
**Koreksyon:** Refè `npm install` nan dossye backend la.

### `500 Internal Server Error` sou frontend
**Kòz:** Backend pa mache oswa pa disponib.
**Koreksyon:** Asire w `npm start` nan backend/ ap mache anvan w louvri http://localhost:3000

### WebSocket errors nan console browser
**Se nòmal** si backend pa mache. Yo pral rete lè backend disponib.
Backoff: 2s → 4s → 8s → 16s → 30s (li rete la, pa spam).

---

## Arèt tout sèvis
- `Ctrl+C` nan chak terminal

## Docker (altènatif)
```bash
docker compose up --build
```
