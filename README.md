# Datortīklu testi

Vienkārša testēšanas platforma par datortīklu tēmām. Katrs dalībnieks reģistrē
unikālu vārdu vienreiz, tad kārto testus — rezultāti tiek saglabāti un rādīti
kopīgā rezultātu sarakstā katram testam.

## Struktūra

- `data/tests.json` — testu reģistrs (id, nosaukums, apraksts, jautājumu fails)
- `data/<test-id>.json` — konkrēta testa jautājumi
- `server/` — Express serveris + SQLite (better-sqlite3)
- `public/` — statiskais frontend (vārda reģistrācija, testu saraksts, testa lapa)

Katrs tests ir pieejams pa savu URL: `/testi/<test-id>` (piem. `/testi/kabeli`).

## Jauna testa pievienošana

1. Izveido `data/<jauns-id>.json` ar jautājumu masīvu:
   ```json
   [
     { "q": "Jautājuma teksts?", "opts": ["A", "B", "C", "D"], "a": 1 }
   ]
   ```
   (`a` ir pareizās atbildes indekss masīvā `opts`, sākot no 0.)
2. Pievieno ierakstu `data/tests.json`:
   ```json
   { "id": "jauns-id", "title": "Testa nosaukums", "description": "...", "file": "jauns-id.json" }
   ```
3. Viss cits (UI, reģistrācija, rezultāti) darbojas automātiski.

## Lokāla izstrāde

```bash
npm install
npm run dev
```

Serveris uz `http://localhost:3000`.

## Palaišana ar Docker

```bash
docker compose up -d --build
```

Dati (SQLite datubāze) tiek glabāti Docker volumē `datortiklu-testi-data`,
tāpēc paliek pāri pāri konteinera pārbūvēm/pārstartēšanai.
