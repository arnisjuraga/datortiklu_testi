const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function loadTestRegistry() {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'tests.json'), 'utf8');
  return JSON.parse(raw);
}

function loadTest(testId) {
  const registry = loadTestRegistry();
  const meta = registry.find((t) => t.id === testId);
  if (!meta) return null;
  const raw = fs.readFileSync(path.join(DATA_DIR, meta.file), 'utf8');
  const questions = JSON.parse(raw);
  return { ...meta, questions };
}

// --- API ---

app.get('/api/tests', (req, res) => {
  const registry = loadTestRegistry().map((t) => {
    const raw = fs.readFileSync(path.join(DATA_DIR, t.file), 'utf8');
    const questions = JSON.parse(raw);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      questionCount: questions.length,
    };
  });
  res.json(registry);
});

app.get('/api/tests/:testId', (req, res) => {
  const test = loadTest(req.params.testId);
  if (!test) return res.status(404).json({ error: 'Tests nav atrasts.' });
  res.json(test);
});

app.post('/api/register', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Jāievada vārds.' });
  if (name.length > 40) return res.status(400).json({ error: 'Vārds ir pārāk garš.' });

  if (db.nameExists(name)) {
    return res.status(409).json({ error: `Vārds "${name}" jau ir aizņemts. Izvēlies citu.` });
  }

  const user = db.createUser(name);
  res.json({ ok: true, name: user.name });
});

app.post('/api/check-name', (req, res) => {
  const name = (req.body?.name || '').trim();
  res.json({ exists: name ? db.nameExists(name) : false });
});

app.post('/api/results', (req, res) => {
  const { name, testId, score, total } = req.body || {};
  if (!name || !testId || typeof score !== 'number' || typeof total !== 'number') {
    return res.status(400).json({ error: 'Nepilnīgi dati.' });
  }

  const user = db.findUserByName(name);
  if (!user) {
    return res.status(404).json({ error: 'Šāds vārds nav reģistrēts. Reģistrējies vēlreiz.' });
  }

  const test = loadTest(testId);
  if (!test) return res.status(404).json({ error: 'Tests nav atrasts.' });

  db.saveResult({ userId: user.id, testId, score, total });
  res.json({ ok: true });
});

app.get('/api/results/:testId', (req, res) => {
  res.json(db.getLeaderboard(req.params.testId));
});

// --- Pages (clean routes per test) ---

app.get('/testi/:testId', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'test.html'));
});

app.listen(PORT, () => {
  console.log(`Datortīklu testi darbojas uz porta ${PORT}`);
});
