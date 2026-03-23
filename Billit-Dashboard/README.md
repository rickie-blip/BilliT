# ISP Billing Hub

## Full-stack setup

This project now includes:

- Frontend (Vite + React): `src/`
- Backend API (Node HTTP server): `../backend/server.js`
- Persistent backend data store: `../backend/data/store.json`

## Run locally

1. Start backend API:

```bash
npm run dev:backend
```

2. Start frontend in a separate terminal:

```bash
npm run dev
```

Vite proxies `/api/*` requests to `http://localhost:4000` in development.

## API endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/customers`
- `GET /api/routers`
- `GET /api/detected-users`
- `PATCH /api/detected-users/:id/assign`
- `GET /api/mpesa/transactions`
- `POST /api/mpesa/stk-push`
