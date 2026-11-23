# Uvoz programa iz tablica i dokumenata

Ove skripte pretvaraju program iz Excel tablice, Word dokumenta ili PDF-a (Barbell Medicine,
Calgary Barbell, TSA, RTS) u Iron Log program i šalju ga API-ju. Ne trebaju npm pakete, samo Node
22.15 ili noviji. Za PDF treba `pdftotext`, koji dolazi s Git Bashom. Sve naredbe pokreći iz
korijena repoa, u PowerShellu.

## Koraci

1. **Raspakiraj datoteku.** xlsx i docx su zip. Raspakiraj ih u novu, praznu mapu izvan repoa:

   ```powershell
   $file = "C:\...\programi\Bridge 3.0 - Kilos.xlsx"
   $dir = "$env:TEMP\ironlog-import\bridge3"
   New-Item -ItemType Directory -Force $dir | Out-Null
   Copy-Item $file "$dir.zip"
   Expand-Archive "$dir.zip" -DestinationPath $dir -Force
   ```

   PDF se ne raspakirava, nego se iz njega izvuče tekst: `pdftotext -layout program.pdf "$dir.txt"`.

2. **Pogledaj listove tablice.** Bez broja lista dobiješ popis listova. S brojem dobiješ ćelije tog
   lista, a zadnja dva broja su najviše redaka i stupaca.

   ```powershell
   node tools\program-import\read-xlsx.mjs $dir
   node tools\program-import\read-xlsx.mjs $dir 17 70 14
   ```

3. **Pretvori skriptom za taj raspored** (tablica ispod). Svaka ispiše program po danima i
   tjednima, pa ga usporedi s izvornikom. Ako naiđe na tekst koji ne razumije, stane s porukom
   `not understood: "…"`. Tada dodaj uzorak za taj tekst.

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

## Skripta za svaki raspored

| Raspored                                                | Skripta i naredba                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| BBM, list PROGRAMMING SKELETON (12 Week Strength, Bridge 3.0, 4-Day Hypertrophy) | `extract-skeleton.mjs $dir sheet17.xml 8 "$dir-extract.json"`, pa `convert-skeleton.mjs "$dir-extract.json" "Bridge 3.0" "$dir-program.json"` |
| BBM, skriveni listovi PROGRAM i SCHEDULE (HLM, 12wk Press)          | `convert-bbm-program.mjs $dir "HLM 2.0" "$dir-program.json"`                                                |
| Calgary Barbell 16 week (LiftVault)                     | `convert-calgary.mjs $dir "Calgary Barbell 16 Week" "$dir-program.json"`                              |
| TSA 9 week (LiftVault)                                  | `convert-tsa.mjs $dir "TSA 9 Week Intermediate" "$dir-program.json"`                                  |
| RTS, Word s tablicama (generalized intermediate 9 week) | `convert-rts.mjs $dir "RTS Intermediate 9 Week" "$dir-program.json"`                                  |
| RTS kao tekst (10 Weeks Cycle i Project Momentum, PDF ili Word)    | PDF: `pdftotext`; Word: `docx-text.mjs $dir "$dir.txt"`. Zatim `convert-rts-text.mjs "$dir.txt" "Naziv" "$dir-program.json" [ciklus]` |

Ispred svake skripte ide `node tools\program-import\`. Kod BBM SKELETON lista upiši datoteku lista
s popisa iz koraka 2 i broj tjedana. Raspored retka je ovaj: slotovi 1–6 u stupcima D–I od
retka 3, slotovi 7–12 od retka 57, nazivi od redaka 118, 173, 228 i 282. Dokument s više ciklusa
(Project Momentum 2017) pretvara se ciklus po ciklus: zadnji argument je broj ciklusa.

## Kako se tekst prepisuje

| U izvorniku                                                    | U Iron Logu                                        |
| -------------------------------------------------------------- | -------------------------------------------------- |
| 4 reps @ RPE 8 (84%), x4 @9                                    | `1x4 rpe8`, `1x4 rpe9`                             |
| -5% from 5 @ 9 x 2 sets, Take off 20% … 5 reps x 5 sets        | back-off od seta prije: `2x5@-5%`, `5x5@-20%`      |
| 75% e1RM x 4 reps x 3 sets, 16 reps (sets of 4) at 75%         | `3x4@75%`, `4x4@75%`                               |
| Repeat 10 @ 8 x 2 more sets, plus 2 down sets (repeat)         | isti setovi još dvaput: `2x10 rpe8`                |
| raspon (2-3 sets, 14-16 reps)                                  | gornja granica: 3 seta, 16 ponavljanja             |
| within 10% of …                                                | sredina: `@-5%`                                    |
| myo-reps (aktivacijski set, pa mini setovi)                    | `1x16 rpe8, 3x5`: mini setovi bez kilaže, upisuje se na dan |
| Calgary 1+2F / 1+2R                                            | top set i 2 seta na −5 % / 2 ista seta             |
| RTS Load Drop / plus N down sets (load drop)                   | back-off na sredini zamora (4-6 %: −5 %)           |
| RTS 4-6 % / 6-9 % Fatigue                                      | 3 / 4 planirana seta; neodrađeni se brišu na Završi |
| opener, natjecanje                                             | `1x1 rpe8`; tri pokušaja `1x1 rpe8, 1x1 rpe9, 1x1 rpe10` |
| AMRAP na 80 %                                                  | ponavljanja do otkaza po RTS tablici: `1x7@80%`    |
| jednaki setovi zaredom                                         | spojeni: `1x8 rpe8` + `2x8 rpe8` = `3x8 rpe8`      |

- Isti lift napisan na drugi način dobije jedan naziv (`SAME_LIFT` u svakoj skripti; npr.
  „Deadlift with Belt” postaje „Deadlift with belt”). Editor traži e1RM po točnom nazivu.
- Ako slot promijeni vježbu, nastanu dvije vježbe. Svaka ima prazne tjedne u kojima se ne radi.
- GPP, bilješke o odmoru i tempo se ne uvoze, jer Iron Log programi nemaju bilješke. Ono što se
  ne može zapisati kao setovi (zagrijavanje bez kilaže, „NL=30”) skripta ispiše kao izostavljeno.
- U WEEK listovima BBM tablica spremljene vrijednosti formula mogu biti zastarjele, pa se čita
  izvor (PROGRAM ili ćelija na koju formula pokazuje).
