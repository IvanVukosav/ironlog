# Iron Log

Powerlifting & Nutrition Tracker — mysitesfun.net

## Stack
- **Frontend:** React + Vite + Tailwind CSS (Vercel)
- **Backend:** Node.js + Express + SQLite + Prisma (Railway)

## Pokretanje lokalno

```bash
# Backend (prvi put: cp .env.example .env)
cd backend && npm install && npx prisma migrate dev && npm start

# Frontend (novi terminal)
cd frontend && npm install && npm run dev
```

## Varijable okruženja

**Backend** (`backend/.env` lokalno, Variables na Railwayu):

| Varijabla | Opis |
|---|---|
| `DATABASE_URL` | SQLite baza, npr. `file:./dev.db` |
| `APP_PASSWORD` | Lozinka za prijavu. Bez nje je API otvoren svima (ok samo lokalno). |
| `AUTH_SECRET` | Opcionalno. Ključ za potpisivanje tokena; bez njega se koristi `APP_PASSWORD`. |
| `CORS_ORIGIN` | Dozvoljene domene odvojene zarezom, npr. `https://mysitesfun.net`. Bez nje je dozvoljena svaka. |

**Frontend** (Vercel): `VITE_API_BASE_URL` — adresa backenda.
