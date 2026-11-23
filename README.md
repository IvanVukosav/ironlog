# Iron Log

Powerlifting & Nutrition Tracker.

Aplikacija zasad radi samo lokalno. Nigdje nije objavljena, a domena mysitesfun.net je za nju
rezervirana, ali je parkirana.

## Stack

- **Frontend:** React + Vite, CSS moduli
- **Backend:** Node.js + Express + SQLite + Prisma

## Pokretanje lokalno

```bash
# Backend (prvi put: cp .env.example .env)
cd backend && npm install && npx prisma migrate dev && npm start

# Frontend (novi terminal)
cd frontend && npm install && npm run dev
```

## Varijable okruženja

**Backend** (`backend/.env`):

| Varijabla      | Opis                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | SQLite baza, npr. `file:./dev.db`                                                            |
| `APP_PASSWORD` | Lozinka za prijavu. Bez nje je API otvoren svima (ok samo lokalno).                          |
| `AUTH_SECRET`  | Opcionalno. Ključ za potpisivanje tokena; bez njega se koristi `APP_PASSWORD`.               |
| `CORS_ORIGIN`  | Dozvoljene domene odvojene zarezom, npr. `https://mysitesfun.net`. Bez nje je dozvoljena svaka. |

**Frontend:** `VITE_API_BASE_URL` je adresa backenda. Bez nje je `http://localhost:3001`.

## Objava (plan, još nije napravljena)

Prijedlog je frontend na Vercelu (`frontend/vercel.json` je za to spreman) i backend s bazom na
Railwayu. Popis koraka prije prve objave je u [docs/nastavak.md](docs/nastavak.md).
