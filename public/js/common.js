const NAME_KEY = 'dt_username';
const USERID_KEY = 'dt_userid';

function getSavedName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

function getSavedUserId() {
  try {
    return localStorage.getItem(USERID_KEY) || '';
  } catch {
    return '';
  }
}

function saveIdentity(id, name) {
  try {
    localStorage.setItem(NAME_KEY, name);
    if (id) localStorage.setItem(USERID_KEY, String(id));
  } catch {
    /* private mode / storage blocked — carry on session-only */
  }
}

function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode / storage blocked — carry on session-only */
  }
}

function clearSavedName() {
  try {
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(USERID_KEY);
  } catch {
    /* ignore */
  }
}

// If an admin renamed this browser's user server-side, pick up the new
// name transparently (no re-registration needed) using the stored user id.
async function refreshIdentity() {
  const id = getSavedUserId();
  if (!id) return getSavedName();
  const { ok, data } = await apiGet(`/api/me/${id}`);
  if (ok && data.name && data.name !== getSavedName()) {
    saveIdentity(data.id, data.name);
  }
  return getSavedName();
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function apiGet(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
