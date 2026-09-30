// The user identity lives in an httpOnly session cookie set by the server;
// the browser just asks who it is. Old builds kept a name in localStorage —
// drop it so it can't be mistaken for a login.
try {
  localStorage.removeItem('dt_username');
  localStorage.removeItem('dt_userid');
} catch {
  /* ignore */
}

async function getMe() {
  const { ok, data } = await apiGet('/api/auth/me');
  return ok ? data : null;
}

function goToLogin() {
  location.href = '/?next=' + encodeURIComponent(location.pathname);
}

// Clears any saved in-progress test attempts (see quiz.js) so the next
// person on a shared computer never lands on someone else's answers.
function clearAllProgress() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('dt_progress_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function getAdminPw() {
  try {
    return sessionStorage.getItem('dt_admin_pw') || '';
  } catch {
    return '';
  }
}

// Fetches a URL with the admin password header when an admin session is
// active (the user session cookie is sent automatically).
async function apiGetAuthed(url) {
  const headers = {};
  const pw = getAdminPw();
  if (pw) headers['x-admin-password'] = pw;
  const res = await fetch(url, { headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
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
