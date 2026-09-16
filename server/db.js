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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_results_test ON results(test_id);

  CREATE TABLE IF NOT EXISTS test_settings (
    test_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'macisanas' CHECK (mode IN ('macisanas', 'kontroldarbs'))
  );
`);

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

function saveResult({ userId, testId, score, total }) {
  const stmt = db.prepare(
    'INSERT INTO results (user_id, test_id, score, total) VALUES (?, ?, ?, ?)'
  );
  const info = stmt.run(userId, testId, score, total);
  return info.lastInsertRowid;
}

function getLeaderboard(testId) {
  return db
    .prepare(
      `SELECT u.name AS name, r.score AS score, r.total AS total, r.created_at AS createdAt
       FROM results r
       JOIN users u ON u.id = r.user_id
       WHERE r.test_id = ?
       ORDER BY (CAST(r.score AS REAL) / r.total) DESC, r.created_at ASC`
    )
    .all(testId);
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

function getAllResults() {
  return db
    .prepare(
      `SELECT u.name AS name, r.test_id AS testId, r.score AS score, r.total AS total, r.created_at AS createdAt
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
  saveResult,
  getLeaderboard,
  normalizeName,
  getTestMode,
  setTestMode,
  getAllResults,
};
