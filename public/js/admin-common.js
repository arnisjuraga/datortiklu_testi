// Shared by the admin pages: the admin password lives in sessionStorage
// (same tab only) and is sent as a header on every admin API call.
const PW_KEY = 'dt_admin_pw';

function getPw() {
  try { return sessionStorage.getItem(PW_KEY) || ''; } catch { return ''; }
}
function setPw(pw) {
  try { sessionStorage.setItem(PW_KEY, pw); } catch { /* ignore */ }
}
function clearPw() {
  try { sessionStorage.removeItem(PW_KEY); } catch { /* ignore */ }
}

async function adminGet(url) {
  const res = await fetch(url, { headers: { 'x-admin-password': getPw() } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
async function adminPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': getPw() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const MODE_LABELS = {
  macisanas: 'Mācīšanās',
  kontroldarbs: 'Kontroldarbs',
};
