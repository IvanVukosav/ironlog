# Nastavak: što je ostalo (22. 11. 2026.)

Bilješka za nastavak rada na drugom računalu. Sve je na grani `roadmap` i pushano je. Grana nije
spojena u `main` i nema PR-a: https://github.com/IvanVukosav/ironlog/pull/new/roadmap

## Pokretanje kod kuće

```powershell
git fetch
git checkout roadmap
git pull

cd backend
npm install
npx prisma migrate deploy   # nove migracije; zadnja je backoff_sets
npm start                   # API na :3001

# u drugom terminalu
cd frontend
npm install                 # nova ovisnost: exceljs
npm run dev                 # aplikacija na :5173
```

- **Ne pokreći `npx prisma format`.** Prepisao bi cijeli ručno poravnati `schema.prisma`.
- **Testovi:** `npm test` u `frontend` (212 unit testova, Vitest) i `npm test` u `backend` (25).
- **E2E provjere** (34 provjere u headless Chromeu) postoje samo na poslovnom računalu, u
  privremenoj mapi. Nisu u repou.
- **Podaci s posla.** Baza (`backend/prisma/dev.db`) nije u gitu. Da bi kod kuće imao iste
  podatke, na poslu u Postavkama otvori „Backup i izvoz” i kod „Backup (JSON)” klikni Preuzmi.
  Kod kuće tu datoteku vrati s „Vrati iz backupa”. Vraćanje **zamjenjuje sve** podatke kod kuće.

## 1. Uvoz programa (u tijeku)

**Uvezeni:** 12 Week Strength i Bridge 3.0, samo u bazu na poslovnom računalu. Kod kuće ih
ponovno uvezi iz tablica, po minutu po programu. Može i backupom, kako piše gore. Upute su u
[tools/program-import/README.md](../tools/program-import/README.md).

**Ostale tablice, po rasporedu:**

- **Isti list PROGRAMMING SKELETON kao Bridge 3.0.** Za njih bi `convert-skeleton.mjs` trebao
  raditi, uz pokoji novi uzorak teksta. Prvo provjeri retke: ovi predlošci imaju i list EXERCISE
  SELECTION, pa nazivi možda nisu u retcima 118, 173, 228 i 282.
  - BBM legacy: 4-Day Hypertrophy (8 tjedana; list je vidljiv)
  - Digital training templates (list je skriven):
    - Strength I, Strength II, Strength III i Strengthlifting II, po 13 tjedana
    - Hypertrophy I, Hypertrophy II, Powerbuilding II i General S&C, po 16 tjedana
    - Time Crunch I, 8 tjedana
    - Beginner Template, 32 tjedna u 3 faze; svaka faza ima svoj izbor vježbi
- **Drugi BBM predložak**, sa skrivenim listovima PROGRAM, SCHEDULE, TABLES i LISTS. Treba nova
  skripta za izvlačenje.
  - BBM 12 Week Strength Finished v2 (13 tjedana). Možda je isti program kao već uvezeni 12 Week
    Strength, pa ih prvo usporedi.
  - BBM HLM v2.0 (8 tjedana)
  - 12wk Press v2 (12 tjedana i MEET WEEK)
- **Vlastiti raspored**, pa svaka treba svoju skriptu:
  - Calgary Barbell 16 week: listovi Weeks 1-4, 5-8, 9-11, 12-15 i Taper Week
  - TSA 9 Week Intermediate: cijeli program je na listu TRAINING
  - Intermediate Strength (Brazos Valley Barbell): listovi Week 1–8, deload u 4. i 8. tjednu
  - Barbell Medicine Bridge v2.0: starija verzija Bridgea. Bridge 3.0 je već uvezen, pa ovu
    vjerojatno preskoči.
- **RTS:** postoje samo docx i pdf (Project Momentum 2016 i 2017, generalized intermediate
  9 week i 10 weeks cycle). Program treba izvući iz teksta.

Za uvoz su dogovoreni RTS, Calgary Barbell, BBM, Bridge i TSA. Za Digital training templates
treba odlučiti hoće li se i oni uvoziti.

## 2. Aplikacija na internetu (nije odobreno, košta)

Prijedlog je bio:

- backend na Railwayu, oko 5 € mjesečno
- frontend na Vercelu
- domena mysitesfun.net, koja je sad parkirana na Hostingeru

Prije toga treba spojiti `roadmap` u `main`. Prije prvog deploya:

- Na backendu postavi `APP_PASSWORD`, po želji `AUTH_SECRET`, te `CORS_ORIGIN` na pravu domenu
  frontenda.
- Naredba za pokretanje mora izvršiti `npx prisma migrate deploy`. Možda treba i
  `npx prisma generate`, jer npm iz Node 26 preskače Prismine install skripte.
- Korijen servisa mora biti `backend`. Root `package.json` (Prisma 7) je višak i ne smije se
  koristiti.
- `frontend/vercel.json` pretpostavlja da je korijen Vercel projekta `frontend`.
- Nakon deploya napravi backup (Postavke → Backup i izvoz).

## 3. Sitni otvoreni nalazi

- Tailwind paketi se ne koriste, a root `package.json` je višak. README piše da aplikacija koristi
  Tailwind, Vercel i Railway, a ne koristi ih.
- Zadnja oznaka datuma na grafu tjelesne težine na Početnoj nekad se vidi, a nekad ne. Recharts
  izmjeri tekst prije nego što se učita font.
- Odmor koji završi dok je mobitel zaključan ne zapišti, jer stranica tada spava. Kad se vratiš,
  preostalo vrijeme je točno.
- `npm audit` u frontendu javlja uuid unutar exceljs (moderate). Popravak bi spustio exceljs na
  3.4.0, a exceljs ionako koristi samo uuid v4.
- U e2e testu Statistike na mobitelu klizanje do „Uredi” ponekad stane oko 20 px prije cilja. To
  je stari problem.

## Dogovori za Claudea

- Odgovaraj na hrvatskom.
- Svaka značajka ide u svoj commit na `roadmap`.
- Push, PR ili merge samo na izričit „pushaj”.
- Mijenjaj samo ono što je traženo.
- Tekst u aplikaciji imenuje stranice i gumbe kao izbornik (Trening, ne „Log”).
- Ne predlaži pločice po strani ispod kilaže u Treningu.
