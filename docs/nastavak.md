# Nastavak: što je ostalo (23. 11. 2026.)

Bilješka za nastavak rada na drugom računalu. Sve je na grani `roadmap`. Grana nije spojena u
`main` i nema PR-a: https://github.com/IvanVukosav/ironlog/pull/new/roadmap

## Pokretanje kod kuće

```powershell
git fetch
git checkout roadmap
git pull

cd backend
npm install
npx prisma migrate deploy   # nove migracije; zadnja je food_products
npm start                   # API na :3001

# u drugom terminalu
cd frontend
npm install                 # nova ovisnost: exceljs
npm run dev                 # aplikacija na :5173
```

- **Ne pokreći `npx prisma format`.** Prepisao bi cijeli ručno poravnati `schema.prisma`.
- **Testovi:** `npm test` u `frontend` (237 unit testova, Vitest) i `npm test` u `backend` (35).
- **E2E provjere** (38 skupina u headless Chromeu, s brzim unosom i skenerom) postoje samo na
  poslovnom računalu, u privremenoj mapi. Nisu u repou.
- **Podaci s posla.** Baza (`backend/prisma/dev.db`) nije u gitu. Da bi kod kuće imao iste
  podatke, na poslu u Postavkama otvori „Backup i izvoz” i kod „Backup (JSON)” klikni Preuzmi.
  Kod kuće tu datoteku vrati s „Vrati iz backupa”. Vraćanje **zamjenjuje sve** podatke kod kuće.

## 1. Uvoz programa

**Uvezeno je svih 12 dogovorenih programa** (RTS, Calgary Barbell, BBM, Bridge, TSA), ali samo u
bazu na poslovnom računalu. Kod kuće ih ponovno uvezi skriptama, po minutu po programu, ili
backupom, kako piše gore. Upute su u
[tools/program-import/README.md](../tools/program-import/README.md).

| Program                        | Datoteka                                                   | Skripta                |
| ------------------------------ | ---------------------------------------------------------- | ---------------------- |
| 12 Week Strength               | 12 Week Strength - Kilos.xlsx (`sheet22.xml`, 13 tjedana)  | `convert-skeleton`     |
| Bridge 3.0                     | Bridge 3.0 - Kilos.xlsx (`sheet17.xml`, 8)                 | `convert-skeleton`     |
| 4-Day Hypertrophy              | BBM legacy \ 4-Day Hypertrophy - Kilos.xlsx (`sheet17.xml`, 7) | `convert-skeleton` |
| HLM 2.0                        | BBM - HLM-V2.0.xlsx                                        | `convert-bbm-program`  |
| 12 Week Press                  | BBM legacy \ 12wk Press v2.xlsx                            | `convert-bbm-program`  |
| Calgary Barbell 16 Week        | Calgary Barbell 16 week \ 16 Week Complete Program.xlsx    | `convert-calgary`      |
| TSA 9 Week Intermediate        | TSA 9 Week Intermediate Program.xlsx                       | `convert-tsa`          |
| RTS Intermediate 9 Week        | RTS \ RTS ,Mike T,generilized intermidiate….docx           | `convert-rts`          |
| RTS 10 Week Cycle              | RTS \ Rts 10 Weeks Cycle.pdf                               | `convert-rts-text`     |
| Project Momentum 2016          | RTS \ Project Momentum 2016.docx                           | `convert-rts-text`     |
| Project Momentum 2017 Cycle 1 i 2 | RTS \ Project Momentum 2017.pdf (ciklus 1, pa 2)        | `convert-rts-text`     |

**Nije uvezeno:**

- BBM 12 Week Strength Finished v2 je isti program kao 12 Week Strength, ali s nepopunjenim
  nazivima iz predloška („sb 1 week 1”).
- Barbell Medicine Bridge v2.0 je starija verzija Bridgea, iz mape legacy programa.
- Još nije odlučeno uvoze li se Digital training templates (10 BBM tablica s istim listom
  PROGRAMMING SKELETON) i Intermediate Strength (Brazos Valley Barbell).

**Što treba znati o uvezenima:**

- Kod varijacija u Calgaryjevim tjednima 1-4 i kod TSA-ovog pauziranog mrtvog dizanja postotak
  se u izvorniku računa od maksimuma natjecateljskog lifta. Iron Log ga računa od e1RM-a te iste
  vježbe, pa će „≈ kg” biti preniska kad ta vježba dobije svoj e1RM. Rješenje bi bila mogućnost
  da vježba u programu uzima e1RM drugog lifta.
- Mini setovi myo-repova nemaju kilažu. Upisuje se na dan, ista kao kod aktivacijskog seta.
- RTS-ovi load drop i repeat setovi nemaju zadan broj, pa su planirani s rezervom. Kad je dosta,
  staneš, a neodrađeni se brišu na Završi.
- Izostavljeno je samo ono što se ne može zapisati kao setovi: RTS-ova zagrijavanja bez kilaže,
  „55%x__ @8 for NL=30”, Ab Wheel „One set @9, then half the reps”, GPP i tempo.

## 2. Prehrana: brži unos i skener barkoda (23. 11.)

Napravljeno po mockupu Brzi unos, Skener i Proizvod:

- Novi dan sam ponudi obroke iz zadnjeg dana, prazne. Prazan obrok nudi „Kao jučer” (ili „Kao
  zadnji put”) i Kopiraj. Otvoren je jedan obrok, s gumbima Nedavno i Omiljeno.
- Gumb s barkodom pokraj polja Namirnica otvara skener. Proizvod dolazi iz Open Food Facts preko
  backenda i pamti se u tablici `FoodProduct`. Proizvod kojeg nema upišeš jednom.

Što treba znati:

- **Kamera** čita barkod samo kad je stranica na https adresi (ili `localhost`) i u pregledniku
  koji sam čita barkodove, a to je Chrome na Androidu. Na računalu (Chrome na Windowsima) i na
  iPhoneu skener odmah nudi upis broja ispod barkoda.
- Za kameru i na tim preglednicima trebao bi paket `zxing-wasm` (oko 1 MB, učitava se tek kad se
  skener otvori). Instalacija nije odobrena, pa ga nema.
- `OPEN_FOOD_FACTS_URL` na backendu služi samo testovima: usmjerava traženje na zamjenski server.

## 3. Aplikacija na internetu (nije odobreno, košta)

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

## 4. Sitni otvoreni nalazi

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
