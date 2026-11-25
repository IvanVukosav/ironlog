# E2E provjere u headless Chromeu

Ove skripte otvaraju aplikaciju u Chromeu bez prozora i klikaju po njoj kao korisnik, na računalu
(1280 px) i na mobitelu (390 px). Nakon svakog koraka provjeravaju što piše na stranici i što je
spremljeno u bazi. Ne trebaju npm pakete, samo Node 22.15 ili noviji i Google Chrome. Ako Chrome
nije u `C:\Program Files\Google\Chrome\Application\chrome.exe`, postavi `$env:CHROME` na njegovu
putanju.

Skripte rade samo s testnim backendom na :3002 i njegovom zasebnom bazom `tools/e2e/e2e.db`.
Brišu i stvaraju podatke, pa ih nikad ne usmjeravaj na pravi backend (:3001).

## Pokretanje

Sve naredbe pokreći u PowerShellu, iz korijena repoa. Prije toga napravi `npm install` u
`backend` i `frontend`.

1. **Testni backend** (prvi terminal). Prvi put `migrate deploy` napravi praznu bazu, a kasnije
   samo doda nove migracije.

   ```powershell
   cd backend
   $env:DATABASE_URL = "file:../../tools/e2e/e2e.db"
   npx prisma migrate deploy
   $env:PORT = "3002"
   $env:OPEN_FOOD_FACTS_URL = "http://localhost:3098/api/v2/product/"
   node server.js
   ```

   `OPEN_FOOD_FACTS_URL` traženje proizvoda preusmjerava na zamjenski server, koji skripte skenera
   same pokrenu na :3098.

2. **Testni frontend** (drugi terminal). Produkcijski build daje stabilnije rezultate od dev
   servera:

   ```powershell
   cd frontend
   $env:VITE_API_BASE_URL = "http://localhost:3002"
   npx vite build --outDir ../tools/e2e/dist-e2e --emptyOutDir
   npx vite preview --outDir ../tools/e2e/dist-e2e --port 5198 --strictPort
   ```

   Build se ne mijenja dok uređuješ kod. Nakon promjene ga ponovno napravi. Umjesto builda može i
   dev server, `npx vite --port 5199 --strictPort` s istim `VITE_API_BASE_URL`. Skripte ga koriste
   kad `E2E_APP` nije postavljen.

3. **Sve provjere** (treći terminal):

   ```powershell
   cd tools/e2e
   $env:E2E_APP = "http://localhost:5198"
   node run-all-e2e.mjs
   ```

   Za svaku provjeru ispiše `ok` ili `FAIL`, a na kraju što nije prošlo. `e2e-page-split` i
   `e2e-offline-sw` rade samo na buildu (:5198).

Jedna provjera: `node e2e-repeat.mjs` za računalo, `node e2e-repeat.mjs --phone` za mobitel.
Iznimke su `node e2e-log.mjs new [--phone]` i `node e2e-settings.mjs [phone]`, bez crtica.
Slike ekrana završe u `tools/e2e/shots/`.

## Datoteke

- `cdp.mjs` pokreće Chrome i upravlja njime preko DevTools protokola: klik, tipkanje, čekanje,
  slika ekrana.
- `run-all-e2e.mjs` redom pokreće sve provjere.
- `e2e-*.mjs` su provjere, po jedna za svaku stranicu ili značajku.
- `seed-ponovi.mjs` puni bazu za `e2e-repeat.mjs`.
- `make-barcode-y4m.mjs` radi video s barkodom za lažnu kameru u `e2e-scanner-zxing.mjs`.
- `e2e-program-export.mjs` čita izvezenu tablicu ExcelJS-om iz `frontend/node_modules`.

## Poznati problemi

- Ponekad jedan zahtjev padne s „Failed to fetch”, najčešće u `e2e-active` ili
  `e2e-home-program`. Ponovno pokretanje prođe.
- `e2e-stats --phone` u otprilike trećini pokretanja ne dođe do „Uredi” jer se stranica zaustavi
  oko 20 px prije cilja.
- Provjere dijele bazu. Zato većina na početku obriše treninge ili programe koje bi ostavila
  neka druga provjera.
