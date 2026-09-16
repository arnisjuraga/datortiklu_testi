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

## Admin panelis

`/admin` — aizsargāts ar paroli no vides mainīgā `ADMIN_PASSWORD`. Tur var:

- redzēt visu dalībnieku rezultātus (vārds, tests, datums, rezultāts);
- katram testam ieslēgt/izslēgt pieejamību (izslēgts tests pazūd no publiskā
  saraksta un vairs nav uzsākams, kamēr atkal netiek ieslēgts);
- katram testam pārslēgt režīmu starp **Mācīšanās** un **Kontroldarbs**:
  - *Mācīšanās* — pēc katras atbildes uzreiz redzama pareizā atbilde, drīkst
    mainīt izvēli, kamēr tests nav pabeigts.
  - *Kontroldarbs* — pareizā atbilde netiek rādīta testa laikā, redzams tikai,
    ka jautājums ir atbildēts; drīkst brīvi pārvietoties starp jautājumiem un
    mainīt atbildes, līdz nospiests "Beigt testu".

Katrā testa reizē jautājumu secība tiek sajaukta no jauna.

## Atbilžu apskate

Katram saglabātajam rezultātam tiek atcerēta arī pati atbilžu secība un
izvēle — pieejama `/rezultati/<id>` (saite parādās gan pēc paša testa
pabeigšanas, gan rezultātu sarakstā pie testa, gan admin panelī). Tur redzams,
kāds bija jautājumu klāsts un secība tam konkrētajam mēģinājumam, ko dalībnieks
izvēlējās un vai tas bija pareizi.

Bez `ADMIN_PASSWORD` iestatīšanas admin panelis ir bloķēts.

## Lokāla izstrāde

```bash
cp .env.example .env   # iestati savu ADMIN_PASSWORD
npm install
npm run dev
```

Serveris uz `http://localhost:3000`.

## Palaišana ar Docker

```bash
cp .env.example .env   # iestati savu ADMIN_PASSWORD
docker compose up -d --build
```

Dati (SQLite datubāze) tiek glabāti Docker volumē `datortiklu-testi-data`,
tāpēc paliek pāri konteinera pārbūvēm/pārstartēšanai.
