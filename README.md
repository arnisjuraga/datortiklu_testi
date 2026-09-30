# Datortīklu testi

Vienkārša testēšanas platforma par datortīklu tēmām. Katrs dalībnieks izveido
kontu (vārds, uzvārds, e-pasts, parole), tad kārto testus — rezultāti tiek
saglabāti. Katrs
dalībnieks redz tikai savus rezultātus; visu dalībnieku rezultāti redzami tikai
admin panelī.

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

### Attēls un dropdown atbildes (piem. shēmu simbolu atpazīšana)

Testam `data/tests.json` ierakstā var pievienot `"answerType": "dropdown"` —
tad atbilžu poga-saraksts tiek aizstāts ar meklējamu (autocomplete) lauku.
Katram jautājumam papildus var pievienot `"image": "/img/.../fails.svg"` —
attēls parādās virs jautājuma teksta gan testa lapā, gan atbilžu apskatē.
`opts`/`a` shēma paliek tā pati — vienkārši ērtāk parādīt garu variantu
sarakstu kā meklējamu lauku, nevis pogas. Skat. `data/elektrika.json` un
`public/img/elektrika/*.svg` piemēram (vājstrāvas komponenšu simboli).

## Konti un pieslēgšanās

- Reģistrācijā jānorāda vārds, uzvārds, e-pasts (tas ir arī lietotājvārds) un
  parole (vismaz 8 simboli, jāievada divreiz). E-pastam jābūt unikālam; vārds
  un uzvārds drīkst sakrist citiem dalībniekiem.
- Paroles glabājas tikai kā `scrypt` jaucējvērtība ar sāli.
- Pēc pieslēgšanās serveris iestata `httpOnly` sīkdatni `dt_session` (derīga
  30 dienas); datubāzē glabājas tikai tās SHA-256 jaucējvērtība.
- Pēc 10 neveiksmīgiem pieslēgšanās mēģinājumiem 15 minūšu laikā konkrētajam
  e-pastam no tās pašas IP pieslēgšanās uz laiku tiek bloķēta.
- Paroles atjaunošana pa e-pastu nav — aizmirstas paroles gadījumā admins
  iestata jaunu paroli admin panelī (tas izbeidz visas dalībnieka sesijas).
- Lietotāji no agrākās versijas (tikai vārds, bez e-pasta) paliek datubāzē kā
  "vecie lietotāji": viņu rezultāti saglabājas un redzami adminam, bet ar tiem
  pieslēgties nevar.

## Admin panelis

`/admin` — aizsargāts ar paroli no vides mainīgā `ADMIN_PASSWORD`. Tur var:

- redzēt visu dalībnieku rezultātus (vārds, tests, datums, rezultāts);
- labot dalībnieka vārdu un uzvārdu un iestatīt jaunu paroli ("Dalībnieki"
  sadaļā);
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
izvēle — pieejama `/rezultati/<id>`. Tur redzams, kāds bija jautājumu klāsts
un secība tam konkrētajam mēģinājumam, ko dalībnieks izvēlējās un vai tas
bija pareizi.

Piekļuve tai ir ierobežota:

- **Admins** (ar `x-admin-password`) redz jebkuru rezultātu vienmēr —
  neatkarīgi no zemāk minētā pārslēga.
- **Pieslēdzies dalībnieks** var redzēt tikai *savus* rezultātus, un tikai
  tad, ja admins konkrētajam testam admin panelī ir ieslēdzis "Atbilžu
  apskate". Pēc noklusējuma tā ir izslēgta.

Kad atbilžu apskate testam ir ieslēgta, sākumlapā pieteiktam dalībniekam
parādās sadaļa "Mani rezultāti" ar visiem viņa pašu mēģinājumiem un saitēm uz
to apskati.

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
