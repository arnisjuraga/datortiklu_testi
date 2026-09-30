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
    answerType: meta.answerType || 'buttons',
    mode: db.getTestMode(meta.id),
    enabled: db.getTestEnabled(meta.id),
    reviewEnabled: db.getReviewEnabled(meta.id),
  };
}

// --- User sessions (httpOnly cookie) ---

const SESSION_COOKIE = 'dt_session';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return '';
}

function currentUser(req) {
  return db.getSessionUser(readCookie(req, SESSION_COOKIE));
}

function startSession(req, res, userId) {
  const { token, maxAgeMs } = db.createSession(userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: maxAgeMs,
    path: '/',
  });
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Jāpieslēdzas.' });
  req.user = user;
  next();
}

// Simple in-memory brute-force brake for login: max 10 failures per
// IP+e-mail in 15 minutes.
const loginFailures = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;

function loginBlocked(key) {
  const entry = loginFailures.get(key);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) return false;
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(key) {
  const entry = loginFailures.get(key);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { first: Date.now(), count: 1 });
  } else {
    entry.count++;
  }
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return `Parolei jābūt vismaz ${MIN_PASSWORD} simbolus garai.`;
  }
  if (password.length > 200) return 'Parole ir pārāk gara.';
  return null;
}

function validatePersonName(value, label) {
  const v = (value || '').trim();
  if (!v) return `Jāievada ${label}.`;
  if (v.length > 40) return `${label[0].toUpperCase() + label.slice(1)} ir pārāk garš.`;
  return null;
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
        answerType: t.answerType || 'buttons',
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

app.post('/api/auth/register', (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};
  const err =
    validatePersonName(firstName, 'vārds') ||
    validatePersonName(lastName, 'uzvārds') ||
    (!EMAIL_RE.test((email || '').trim()) || email.length > 120 ? 'Nederīga e-pasta adrese.' : null) ||
    validatePassword(password);
  if (err) return res.status(400).json({ error: err });

  if (db.emailExists(email)) {
    return res.status(409).json({ error: 'Ar šo e-pastu jau ir reģistrēts konts. Pieslēdzies.' });
  }

  try {
    const user = db.createAccount({ firstName, lastName, email, password });
    startSession(req, res, user.id);
    res.json({ ok: true, user });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ar šo e-pastu jau ir reģistrēts konts. Pieslēdzies.' });
    }
    throw e;
  }
});

app.post('/api/auth/login', (req, res) => {
  const email = (req.body?.email || '').trim();
  const password = req.body?.password || '';
  if (!email || !password) return res.status(400).json({ error: 'Jāievada e-pasts un parole.' });

  const key = `${req.ip}|${email.toLowerCase()}`;
  if (loginBlocked(key)) {
    return res.status(429).json({ error: 'Pārāk daudz neveiksmīgu mēģinājumu. Pamēģini vēlāk.' });
  }

  const user = db.authenticate(email, password);
  if (!user) {
    recordLoginFailure(key);
    return res.status(401).json({ error: 'Nepareizs e-pasts vai parole.' });
  }
  loginFailures.delete(key);
  startSession(req, res, user.id);
  res.json({ ok: true, user });
});

app.post('/api/auth/logout', (req, res) => {
  db.deleteSession(readCookie(req, SESSION_COOKIE));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireUser, (req, res) => {
  res.json(req.user);
});

app.post('/api/results', requireUser, (req, res) => {
  const { testId, score, total, answers } = req.body || {};
  if (!testId || typeof score !== 'number' || typeof total !== 'number') {
    return res.status(400).json({ error: 'Nepilnīgi dati.' });
  }
  if (answers && (!Array.isArray(answers) || answers.length !== total)) {
    return res.status(400).json({ error: 'Nederīgs atbilžu saraksts.' });
  }

  const test = loadTest(testId);
  if (!test) return res.status(404).json({ error: 'Tests nav atrasts.' });
  if (!test.enabled) return res.status(403).json({ error: 'Šis tests pašlaik nav pieejams.' });

  const resultId = db.saveResult({ userId: req.user.id, testId, score, total, answers });
  res.json({ ok: true, resultId });
});

app.get('/api/my-results', requireUser, (req, res) => {
  const registry = loadTestRegistry();
  const titleById = Object.fromEntries(registry.map((t) => [t.id, t.title]));
  const results = db.getResultsByUser(req.user.id).map((r) => ({
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
  const user = currentUser(req);
  const isOwner = !!user && user.id === detail.userId;
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
  const { name, firstName, lastName } = req.body || {};
  const user = db.getAllUsers().find((u) => String(u.id) === req.params.userId);
  if (!user) return res.status(404).json({ error: 'Lietotājs nav atrasts.' });

  const err = user.email
    ? validatePersonName(firstName, 'vārds') || validatePersonName(lastName, 'uzvārds')
    : validatePersonName(name, 'vārds');
  if (err) return res.status(400).json({ error: err });

  try {
    const updated = db.renameUser(user.id, { name, firstName, lastName });
    res.json({ ok: true, user: updated });
  } catch (e) {
    if (e.code === 'NAME_TAKEN' || e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: `Vārds "${(name || '').trim()}" jau ir aizņemts.` });
    }
    throw e;
  }
});

app.post('/api/admin/users/:userId/password', requireAdmin, (req, res) => {
  const password = req.body?.password;
  const err = validatePassword(password);
  if (err) return res.status(400).json({ error: err });
  if (!db.setPassword(req.params.userId, password)) {
    return res.status(404).json({ error: 'Kontam nav e-pasta (vecais lietotājs) vai tas nav atrasts.' });
  }
  res.json({ ok: true });
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
