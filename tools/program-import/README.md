# Uvoz programa iz Excel tablica

Ove skripte pretvaraju program iz tablice (Barbell Medicine i slične) u Iron Log program i šalju ga
API-ju. Ne trebaju npm pakete, samo Node 22.15 ili noviji. Sve naredbe pokreći iz korijena repoa,
u PowerShellu.

## Koraci

1. **Raspakiraj tablicu.** xlsx je zip. Raspakiraj ga u novu, praznu mapu izvan repoa:

   ```powershell
   $xlsx = "C:\...\programi\Bridge 3.0 - Kilos.xlsx"
   $dir = "$env:TEMP\ironlog-import\bridge3"
   New-Item -ItemType Directory -Force $dir | Out-Null
   Copy-Item $xlsx "$dir.zip"
   Expand-Archive "$dir.zip" -DestinationPath $dir -Force
   ```

2. **Pogledaj listove.** Bez broja lista dobiješ popis listova. S brojem dobiješ ćelije tog lista,
   a zadnja dva broja su najviše redaka i stupaca. Tražiš list PROGRAMMING SKELETON, koji je
   ponekad skriven.

   ```powershell
   node tools\program-import\read-xlsx.mjs $dir
   node tools\program-import\read-xlsx.mjs $dir 17 70 14
   ```

3. **Izvuci i pretvori.** Upiši datoteku lista s popisa (npr. `sheet17.xml`) i broj tjedana:

   ```powershell
   node tools\program-import\extract-skeleton.mjs $dir sheet17.xml 8 "$dir-extract.json"
   node tools\program-import\convert-skeleton.mjs "$dir-extract.json" "Bridge 3.0" "$dir-program.json"
   ```

   `convert-skeleton` ispiše tablicu po danima i tjednima. Usporedi je s Excelom. Ako naiđe na
   redak koji ne razumije, stane s porukom `not understood: "…"`. Tada u `groupsOf` dodaj uzorak
   za taj redak.

4. **Provjeri sheme parserom aplikacije** (`frontend/src/utils/programScheme.js`). Mora javiti
   `0 problems`:

   ```powershell
   node tools\program-import\check-schemes.mjs "$dir-program.json"
   ```

5. **Pošalji u aplikaciju.** Backend mora raditi na :3001. Ako program s tim nazivom već postoji,
   skripta ništa ne šalje. Ako je na backendu postavljen `APP_PASSWORD`, isti upiši u
   `$env:IRONLOG_PASSWORD`.

   ```powershell
   node tools\program-import\post-program.mjs "$dir-program.json"
   ```

6. **Pregledaj.** Otvori Programi → Uredi i prođi kroz tjedne.

## Raspored lista PROGRAMMING SKELETON

| Što                       | Gdje                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| Slotovi 1–6               | stupci D–I, od retka 3 (1. tjedan; svaki sljedeći redak je tjedan)    |
| Slotovi 7–12              | isti stupci, od retka 57                                              |
| Nazivi vježbi za dane 1–4 | od redaka 118, 173, 228 i 282 (1. tjedan), vježbe u stupcima D, G i J |

Dan N čine slotovi 3N−2 do 3N. Dan bez ijedne vježbe se izostavlja. Raspored je provjeren na
12 Week Strength (`sheet22.xml`, 13 tjedana) i Bridge 3.0 (`sheet17.xml`, 8 tjedana). Kod drugih
predložaka prvo s `read-xlsx` provjeri te retke.

## Kako se tekst prepisuje

| U tablici                                                              | U Iron Logu                         |
| ---------------------------------------------------------------------- | ----------------------------------- |
| 4 reps @ RPE 8 (84%)                                                   | `1x4 rpe8`                          |
| -5% from 5 @ 9 x 2 sets of 5 / Take off 20% from 1 @ 8 for 5 reps x 5 sets | back-off od seta prije: `2x5@-5%`, `5x5@-20%` |
| 75% e1RM x 4 reps x 3 sets                                             | `3x4@75%`                           |
| Repeat 10 @ 8 x 2 more sets of 10                                      | `2x10 rpe8`                         |
| … do 2-3 sets of 4                                                     | najviše setova: `3x4@-5%`           |
| jednaki setovi zaredom                                                 | spojeni: `1x8 rpe8` + `2x8 rpe8` = `3x8 rpe8` |

- Isti lift napisan na drugi način dobije jedan naziv (`SAME_LIFT`; npr. „Deadlift with Belt”
  postaje „Deadlift with belt”). Editor traži e1RM po točnom nazivu.
- Ako slot promijeni vježbu, nastanu dvije vježbe. Svaka ima prazne tjedne u kojima se ne radi.
- GPP (kardio, leđa, trbuh, ruke) i bilješke o odmoru se ne uvoze, jer Iron Log programi nemaju
  bilješke.
