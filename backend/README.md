# BillIT Backend (JSON Storage Mode)

Backend is currently running in JSON storage mode for production simplicity while database integration is postponed.

## Current storage

- Core business data: `backend/data/store.json`
- Auth users: `backend/data/users.json`

Both files are auto-initialized from:

- `backend/data/seed-store.json`
- `backend/data/seed-users.json`

## Implemented foundations

- JWT login and profile endpoints
- Role-based access control (`ADMIN`, `STAFF`, `AGENT`)
- API rate limiting
- Redis/BullMQ queue wiring (optional runtime)
- OpenAPI JSON endpoint at `/api/docs`

## Auth endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users` (admin only)

## Setup

1. Install backend dependencies:

```bash
cd backend
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Start server:

```bash
npm run dev
```

## Auth behavior

- First `/api/auth/register` can bootstrap without token when no users exist.
- After first user exists, register requires `ADMIN` token.
- Mutating customer/detected-user/mpesa endpoints require auth token.
