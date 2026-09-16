const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DB_DIR || path.join(__dirname, '..', 'data-store');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    test_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    answers TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_results_test ON results(test_id);

  CREATE TABLE IF NOT EXISTS test_settings (
    test_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'macisanas' CHECK (mode IN ('macisanas', 'kontroldarbs')),
    enabled INTEGER NOT NULL DEFAULT 1,
    review_enabled INTEGER NOT NULL DEFAULT 0
  );
`);

const testSettingsColumns = db.prepare('PRAGMA table_info(test_settings)').all().map((c) => c.name);
if (!testSettingsColumns.includes('enabled')) {
  db.exec('ALTER TABLE test_settings ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
}
if (!testSettingsColumns.includes('review_enabled')) {
  db.exec('ALTER TABLE test_settings ADD COLUMN review_enabled INTEGER NOT NULL DEFAULT 0');
}

const resultsColumns = db.prepare('PRAGMA table_info(results)').all().map((c) => c.name);
if (!resultsColumns.includes('answers')) {
  db.exec('ALTER TABLE results ADD COLUMN answers TEXT');
}

function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createUser(name) {
  const key = normalizeName(name);
  const stmt = db.prepare('INSERT INTO users (name, name_key) VALUES (?, ?)');
  const info = stmt.run(name.trim(), key);
  return { id: info.lastInsertRowid, name: name.trim() };
}

function findUserByName(name) {
  const key = normalizeName(name);
  return db.prepare('SELECT * FROM users WHERE name_key = ?').get(key);
}

function nameExists(name) {
  return !!findUserByName(name);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getAllUsers() {
  return db.prepare('SELECT id, name, created_at AS createdAt FROM users ORDER BY name COLLATE NOCASE').all();
}

function renameUser(id, newName) {
  const key = normalizeName(newName);
  const existing = db.prepare('SELECT id FROM users WHERE name_key = ? AND id != ?').get(key, id);
  if (existing) {
    const err = new Error('name_taken');
    err.code = 'NAME_TAKEN';
    throw err;
  }
  const info = db.prepare('UPDATE users SET name = ?, name_key = ? WHERE id = ?').run(newName.trim(), key, id);
  if (info.changes === 0) return null;
  return getUserById(id);
}

function saveResult({ userId, testId, score, total, answers }) {
  const stmt = db.prepare(
    'INSERT INTO results (user_id, test_id, score, total, answers) VALUES (?, ?, ?, ?, ?)'
  );
  const info = stmt.run(userId, testId, score, total, answers ? JSON.stringify(answers) : null);
  return info.lastInsertRowid;
}

function getLeaderboard(testId) {
  return db
    .prepare(
      `SELECT r.id AS id, r.user_id AS userId, u.name AS name, r.score AS score, r.total AS total, r.created_at AS createdAt
       FROM results r
       JOIN users u ON u.id = r.user_id
       WHERE r.test_id = ?
       ORDER BY (CAST(r.score AS REAL) / r.total) DESC, r.created_at ASC`
    )
    .all(testId);
}

function getResultDetail(resultId) {
  const row = db
    .prepare(
      `SELECT r.id AS id, r.user_id AS userId, u.name AS name, r.test_id AS testId, r.score AS score, r.total AS total,
              r.answers AS answers, r.created_at AS createdAt
       FROM results r
       JOIN users u ON u.id = r.user_id
       WHERE r.id = ?`
    )
    .get(resultId);
  if (!row) return null;
  return { ...row, answers: row.answers ? JSON.parse(row.answers) : null };
}

function getResultsByUser(userId) {
  return db
    .prepare(
      `SELECT id, test_id AS testId, score, total, created_at AS createdAt
       FROM results WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(userId);
}

function getTestMode(testId) {
  const row = db.prepare('SELECT mode FROM test_settings WHERE test_id = ?').get(testId);
  return row ? row.mode : 'macisanas';
}

function setTestMode(testId, mode) {
  db.prepare(
    `INSERT INTO test_settings (test_id, mode) VALUES (?, ?)
     ON CONFLICT(test_id) DO UPDATE SET mode = excluded.mode`
  ).run(testId, mode);
  return getTestMode(testId);
}

function getTestEnabled(testId) {
  const row = db.prepare('SELECT enabled FROM test_settings WHERE test_id = ?').get(testId);
  return row ? !!row.enabled : true;
}

function setTestEnabled(testId, enabled) {
  db.prepare(
    `INSERT INTO test_settings (test_id, enabled) VALUES (?, ?)
     ON CONFLICT(test_id) DO UPDATE SET enabled = excluded.enabled`
  ).run(testId, enabled ? 1 : 0);
  return getTestEnabled(testId);
}

function getReviewEnabled(testId) {
  const row = db.prepare('SELECT review_enabled FROM test_settings WHERE test_id = ?').get(testId);
  return row ? !!row.review_enabled : false;
}

function setReviewEnabled(testId, enabled) {
  db.prepare(
    `INSERT INTO test_settings (test_id, review_enabled) VALUES (?, ?)
     ON CONFLICT(test_id) DO UPDATE SET review_enabled = excluded.review_enabled`
  ).run(testId, enabled ? 1 : 0);
  return getReviewEnabled(testId);
}

function getAllResults() {
  return db
    .prepare(
      `SELECT r.id AS id, u.name AS name, r.test_id AS testId, r.score AS score, r.total AS total, r.created_at AS createdAt
       FROM results r
       JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC`
    )
    .all();
}

module.exports = {
  createUser,
  findUserByName,
  nameExists,
  getUserById,
  getAllUsers,
  renameUser,
  saveResult,
  getLeaderboard,
  getResultDetail,
  getResultsByUser,
  normalizeName,
  getTestMode,
  setTestMode,
  getTestEnabled,
  setTestEnabled,
  getReviewEnabled,
  setReviewEnabled,
  getAllResults,
};
