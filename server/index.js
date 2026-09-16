const path = require('path');
const fs = require('fs');
const express = require('express');
try { require('dotenv').config(); } catch { /* dotenv optional */ }
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const VALID_MODES = ['macisanas', 'kontroldarbs'];

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
  return {
    ...meta,
    questions,
    mode: db.getTestMode(meta.id),
    enabled: db.getTestEnabled(meta.id),
    reviewEnabled: db.getReviewEnabled(meta.id),
  };
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD nav konfigurēts serverī.' });
  }
  const supplied = req.header('x-admin-password') || '';
  if (supplied !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Nepareiza parole.' });
  }
  next();
}

// --- Public API ---

app.get('/api/tests', (req, res) => {
  const registry = loadTestRegistry()
    .filter((t) => db.getTestEnabled(t.id))
    .map((t) => {
      const raw = fs.readFileSync(path.join(DATA_DIR, t.file), 'utf8');
      const questions = JSON.parse(raw);
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        questionCount: questions.length,
        mode: db.getTestMode(t.id),
        reviewEnabled: db.getReviewEnabled(t.id),
      };
    });
  res.json(registry);
});

app.get('/api/tests/:testId', (req, res) => {
  const test = loadTest(req.params.testId);
  if (!test) return res.status(404).json({ error: 'Tests nav atrasts.' });
  if (!test.enabled) return res.status(403).json({ error: 'Šis tests pašlaik nav pieejams.' });
  res.json(test);
});

app.post('/api/register', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Jāievada vārds.' });
  if (name.length > 40) return res.status(400).json({ error: 'Vārds ir pārāk garš.' });

  if (db.nameExists(name)) {
    return res.status(409).json({ error: `Vārds "${name}" jau ir aizņemts. Izvēlies citu.` });
  }

  try {
    const user = db.createUser(name);
    res.json({ ok: true, id: user.id, name: user.name });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: `Vārds "${name}" jau ir aizņemts. Izvēlies citu.` });
    }
    throw err;
  }
});

app.post('/api/check-name', (req, res) => {
  const name = (req.body?.name || '').trim();
  res.json({ exists: name ? db.nameExists(name) : false });
});

app.get('/api/me/:userId', (req, res) => {
  const user = db.getUserById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Lietotājs nav atrasts.' });
  res.json({ id: user.id, name: user.name });
});

app.post('/api/results', (req, res) => {
  const { name, testId, score, total, answers } = req.body || {};
  if (!name || !testId || typeof score !== 'number' || typeof total !== 'number') {
    return res.status(400).json({ error: 'Nepilnīgi dati.' });
  }
  if (answers && (!Array.isArray(answers) || answers.length !== total)) {
    return res.status(400).json({ error: 'Nederīgs atbilžu saraksts.' });
  }

  const user = db.findUserByName(name);
  if (!user) {
    return res.status(404).json({ error: 'Šāds vārds nav reģistrēts. Reģistrējies vēlreiz.' });
  }

  const test = loadTest(testId);
  if (!test) return res.status(404).json({ error: 'Tests nav atrasts.' });
  if (!test.enabled) return res.status(403).json({ error: 'Šis tests pašlaik nav pieejams.' });

  const resultId = db.saveResult({ userId: user.id, testId, score, total, answers });
  res.json({ ok: true, resultId });
});

app.get('/api/results/:testId', (req, res) => {
  res.json(db.getLeaderboard(req.params.testId));
});

app.get('/api/my-results', (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Jānorāda vārds.' });

  const user = db.findUserByName(name);
  if (!user) return res.status(404).json({ error: 'Šāds vārds nav reģistrēts.' });

  const registry = loadTestRegistry();
  const titleById = Object.fromEntries(registry.map((t) => [t.id, t.title]));
  const results = db.getResultsByUser(user.id).map((r) => ({
    ...r,
    testTitle: titleById[r.testId] || r.testId,
    reviewEnabled: db.getReviewEnabled(r.testId),
  }));
  res.json(results);
});

app.get('/api/results/detail/:resultId', (req, res) => {
  const detail = db.getResultDetail(req.params.resultId);
  if (!detail) return res.status(404).json({ error: 'Rezultāts nav atrasts.' });

  const isAdmin = !!ADMIN_PASSWORD && req.header('x-admin-password') === ADMIN_PASSWORD;
  const requestedName = (req.query.name || '').trim();
  const isOwner = !!requestedName && db.normalizeName(requestedName) === db.normalizeName(detail.name);
  const reviewOn = db.getReviewEnabled(detail.testId);

  if (!isAdmin && !(isOwner && reviewOn)) {
    return res.status(403).json({ error: 'Šī atbilžu apskate nav pieejama.' });
  }

  const registry = loadTestRegistry();
  const meta = registry.find((t) => t.id === detail.testId);
  res.json({ ...detail, testTitle: meta ? meta.title : detail.testId });
});

// --- Admin API ---

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD nav konfigurēts serverī.' });
  }
  const password = req.body?.password || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Nepareiza parole.' });
  }
  res.json({ ok: true });
});

app.get('/api/admin/tests', requireAdmin, (req, res) => {
  const registry = loadTestRegistry().map((t) => ({
    id: t.id,
    title: t.title,
    mode: db.getTestMode(t.id),
    enabled: db.getTestEnabled(t.id),
    reviewEnabled: db.getReviewEnabled(t.id),
  }));
  res.json(registry);
});

app.post('/api/admin/tests/:testId/mode', requireAdmin, (req, res) => {
  const { mode } = req.body || {};
  if (!VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: 'Nederīgs režīms.' });
  }
  const registry = loadTestRegistry();
  if (!registry.find((t) => t.id === req.params.testId)) {
    return res.status(404).json({ error: 'Tests nav atrasts.' });
  }
  const saved = db.setTestMode(req.params.testId, mode);
  res.json({ ok: true, mode: saved });
});

app.post('/api/admin/tests/:testId/enabled', requireAdmin, (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Nederīga vērtība.' });
  }
  const registry = loadTestRegistry();
  if (!registry.find((t) => t.id === req.params.testId)) {
    return res.status(404).json({ error: 'Tests nav atrasts.' });
  }
  const saved = db.setTestEnabled(req.params.testId, enabled);
  res.json({ ok: true, enabled: saved });
});

app.post('/api/admin/tests/:testId/review', requireAdmin, (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Nederīga vērtība.' });
  }
  const registry = loadTestRegistry();
  if (!registry.find((t) => t.id === req.params.testId)) {
    return res.status(404).json({ error: 'Tests nav atrasts.' });
  }
  const saved = db.setReviewEnabled(req.params.testId, enabled);
  res.json({ ok: true, reviewEnabled: saved });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json(db.getAllUsers());
});

app.post('/api/admin/users/:userId/rename', requireAdmin, (req, res) => {
  const newName = (req.body?.name || '').trim();
  if (!newName) return res.status(400).json({ error: 'Jāievada vārds.' });
  if (newName.length > 40) return res.status(400).json({ error: 'Vārds ir pārāk garš.' });

  const user = db.getUserById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Lietotājs nav atrasts.' });

  try {
    const updated = db.renameUser(req.params.userId, newName);
    res.json({ ok: true, id: updated.id, name: updated.name });
  } catch (err) {
    if (err.code === 'NAME_TAKEN' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: `Vārds "${newName}" jau ir aizņemts.` });
    }
    throw err;
  }
});

app.get('/api/admin/results', requireAdmin, (req, res) => {
  const registry = loadTestRegistry();
  const titleById = Object.fromEntries(registry.map((t) => [t.id, t.title]));
  const results = db.getAllResults().map((r) => ({
    ...r,
    testTitle: titleById[r.testId] || r.testId,
  }));
  res.json(results);
});

// --- Pages (clean routes per test) ---

app.get('/testi/:testId', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'test.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/rezultati/:resultId', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'review.html'));
});

app.listen(PORT, () => {
  console.log(`Datortīklu testi darbojas uz porta ${PORT}`);
  if (!ADMIN_PASSWORD) {
    console.warn('BRĪDINĀJUMS: ADMIN_PASSWORD nav iestatīts — admin panelis ir bloķēts.');
  }
});
