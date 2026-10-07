const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DB_DIR || path.join(__dirname, '..', 'data-store');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE,
    password_hash TEXT,
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

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL
  );
`);

// Earlier versions identified users by name only (users.name_key NOT NULL).
// Rebuild the table so it can also hold e-mail/password accounts; the old
// name-only rows stay as legacy users (their results are kept, no login).
const usersColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!usersColumns.includes('email')) {
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_key TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        email TEXT UNIQUE,
        password_hash TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_new (id, name, name_key, created_at) SELECT id, name, name_key, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  })();
  db.pragma('foreign_keys = ON');
}

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
// Test mode at the time the result was saved; NULL for results saved
// before this was recorded.
if (!resultsColumns.includes('mode')) {
  db.exec('ALTER TABLE results ADD COLUMN mode TEXT');
}
// Set when an admin attaches a legacy (name-only) user to an account:
// results.legacy_user_id remembers who the result originally belonged to,
// users.merged_into marks the legacy user as absorbed.
if (!resultsColumns.includes('legacy_user_id')) {
  db.exec('ALTER TABLE results ADD COLUMN legacy_user_id INTEGER');
}
// When the admin marked the result's grade as entered into the external
// grade book (NULL = not yet).
if (!resultsColumns.includes('graded_at')) {
  db.exec('ALTER TABLE results ADD COLUMN graded_at TEXT');
}
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'merged_into')) {
  db.exec('ALTER TABLE users ADD COLUMN merged_into INTEGER');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
  };
}

function createAccount({ firstName, lastName, email, password }) {
  const name = `${firstName.trim()} ${lastName.trim()}`;
  const info = db
    .prepare('INSERT INTO users (name, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?)')
    .run(name, firstName.trim(), lastName.trim(), normalizeEmail(email), hashPassword(password));
  return publicUser(getUserById(info.lastInsertRowid));
}

function emailExists(email) {
  return !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalizeEmail(email));
}

function authenticate(email, password) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return publicUser(row);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getAllUsers() {
  return db
    .prepare(
      `SELECT u.id, u.name, u.first_name AS firstName, u.last_name AS lastName, u.email, u.created_at AS createdAt,
              (SELECT COUNT(*) FROM results r WHERE r.user_id = u.id) AS resultCount
       FROM users u WHERE u.merged_into IS NULL ORDER BY u.name COLLATE NOCASE`
    )
    .all();
}

// Legacy (name-only) users are renamed via `name`; accounts via first/last name.
function renameUser(id, { name, firstName, lastName }) {
  const user = getUserById(id);
  if (!user) return null;
  if (user.email) {
    const full = `${firstName.trim()} ${lastName.trim()}`;
    db.prepare('UPDATE users SET name = ?, first_name = ?, last_name = ? WHERE id = ?')
      .run(full, firstName.trim(), lastName.trim(), id);
  } else {
    const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = db.prepare('SELECT id FROM users WHERE name_key = ? AND id != ?').get(key, id);
    if (existing) {
      const err = new Error('name_taken');
      err.code = 'NAME_TAKEN';
      throw err;
    }
    db.prepare('UPDATE users SET name = ?, name_key = ? WHERE id = ?').run(name.trim(), key, id);
  }
  return publicUser(getUserById(id));
}

// Moves all results of a legacy (name-only) user to an account.
function mergeLegacyUser(legacyId, accountId) {
  const legacy = getUserById(legacyId);
  const account = getUserById(accountId);
  if (!legacy || legacy.email || legacy.merged_into) return { error: 'legacy' };
  if (!account || !account.email) return { error: 'account' };
  const moved = db.transaction(() => {
    const info = db
      .prepare('UPDATE results SET legacy_user_id = user_id, user_id = ? WHERE user_id = ?')
      .run(account.id, legacy.id);
    db.prepare('UPDATE users SET merged_into = ? WHERE id = ?').run(account.id, legacy.id);
    return info.changes;
  })();
  return { moved };
}

function setPassword(id, password) {
  const info = db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ? AND email IS NOT NULL')
    .run(hashPassword(password), id);
  if (info.changes) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  return info.changes > 0;
}

// --- Sessions: the cookie holds a random token; only its hash is stored. ---

const SESSION_DAYS = 30;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
    .run(sha256(token), userId, `+${SESSION_DAYS} days`);
  return { token, maxAgeMs: SESSION_DAYS * 24 * 60 * 60 * 1000 };
}

function getSessionUser(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
    )
    .get(sha256(token));
  return publicUser(row);
}

function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();

function saveResult({ userId, testId, score, total, answers, mode }) {
  const stmt = db.prepare(
    'INSERT INTO results (user_id, test_id, score, total, answers, mode) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(userId, testId, score, total, answers ? JSON.stringify(answers) : null, mode || null);
  return info.lastInsertRowid;
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
      `SELECT r.id AS id, r.user_id AS userId, u.name AS name, u.email AS email, r.test_id AS testId,
              r.score AS score, r.total AS total, r.mode AS mode, r.created_at AS createdAt,
              r.graded_at AS gradedAt, lu.name AS legacyName
       FROM results r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN users lu ON lu.id = r.legacy_user_id
       ORDER BY r.created_at DESC`
    )
    .all();
}

function setResultsGraded(ids, graded) {
  const stmt = graded
    ? db.prepare(`UPDATE results SET graded_at = COALESCE(graded_at, datetime('now')) WHERE id = ?`)
    : db.prepare('UPDATE results SET graded_at = NULL WHERE id = ?');
  db.transaction(() => ids.forEach((id) => stmt.run(id)))();
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT id, graded_at AS gradedAt FROM results WHERE id IN (${ph})`).all(...ids);
}

module.exports = {
  setResultsGraded,
  createAccount,
  emailExists,
  authenticate,
  getAllUsers,
  renameUser,
  setPassword,
  mergeLegacyUser,
  createSession,
  getSessionUser,
  deleteSession,
  saveResult,
  getResultDetail,
  getResultsByUser,
  getTestMode,
  setTestMode,
  getTestEnabled,
  setTestEnabled,
  getReviewEnabled,
  setReviewEnabled,
  getAllResults,
};
