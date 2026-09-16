const PW_KEY = 'dt_admin_pw';

const loginCard = document.getElementById('loginCard');
const adminBody = document.getElementById('adminBody');
const loginForm = document.getElementById('loginForm');
const pwInput = document.getElementById('pwInput');
const loginBtn = document.getElementById('loginBtn');
const loginErr = document.getElementById('loginErr');
const logoutBtn = document.getElementById('logoutBtn');
const testModeList = document.getElementById('testModeList');
const userList = document.getElementById('userList');
const resultsBody = document.getElementById('resultsBody');
const resultsEmpty = document.getElementById('resultsEmpty');

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

function renderTestModes(tests) {
  testModeList.innerHTML = '';
  if (!tests.length) {
    testModeList.innerHTML = '<p class="empty">Nav neviena testa.</p>';
    return;
  }
  tests.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'test-item' + (t.enabled ? '' : ' test-item-off');
    row.innerHTML = `
      <div>
        <h3>${t.title}</h3>
        <p class="mono">${t.id}</p>
      </div>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
        <div class="mode-toggle" data-test-id="${t.id}">
          <button type="button" class="mode-btn ${t.mode === 'macisanas' ? 'active' : ''}" data-mode="macisanas">Mācīšanās</button>
          <button type="button" class="mode-btn ${t.mode === 'kontroldarbs' ? 'active' : ''}" data-mode="kontroldarbs">Kontroldarbs</button>
        </div>
        <label class="switch" data-test-id="${t.id}" data-field="enabled">
          <input type="checkbox" ${t.enabled ? 'checked' : ''}>
          <span class="switch-track"><span class="switch-thumb"></span></span>
          <span class="switch-label mono">${t.enabled ? 'IESLĒGTS' : 'IZSLĒGTS'}</span>
        </label>
        <label class="switch" data-test-id="${t.id}" data-field="review">
          <input type="checkbox" ${t.reviewEnabled ? 'checked' : ''}>
          <span class="switch-track"><span class="switch-thumb"></span></span>
          <span class="switch-label mono">ATBILŽU APSKATE: ${t.reviewEnabled ? 'IESLĒGTA' : 'IZSLĒGTA'}</span>
        </label>
      </div>
    `;
    testModeList.appendChild(row);
  });

  testModeList.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const wrap = btn.closest('.mode-toggle');
      const testId = wrap.dataset.testId;
      const mode = btn.dataset.mode;
      const { ok, data } = await adminPost(`/api/admin/tests/${testId}/mode`, { mode });
      if (ok) {
        wrap.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === data.mode));
      }
    });
  });

  testModeList.querySelectorAll('.switch[data-field="enabled"]').forEach((label) => {
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', async () => {
      const testId = label.dataset.testId;
      const enabled = checkbox.checked;
      const { ok, data } = await adminPost(`/api/admin/tests/${testId}/enabled`, { enabled });
      if (ok) {
        label.querySelector('.switch-label').textContent = data.enabled ? 'IESLĒGTS' : 'IZSLĒGTS';
        label.closest('.test-item').classList.toggle('test-item-off', !data.enabled);
      } else {
        checkbox.checked = !enabled;
      }
    });
  });

  testModeList.querySelectorAll('.switch[data-field="review"]').forEach((label) => {
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', async () => {
      const testId = label.dataset.testId;
      const enabled = checkbox.checked;
      const { ok, data } = await adminPost(`/api/admin/tests/${testId}/review`, { enabled });
      if (ok) {
        label.querySelector('.switch-label').textContent = `ATBILŽU APSKATE: ${data.reviewEnabled ? 'IESLĒGTA' : 'IZSLĒGTA'}`;
      } else {
        checkbox.checked = !enabled;
      }
    });
  });
}

function renderUsers(users) {
  userList.innerHTML = '';
  if (!users.length) {
    userList.innerHTML = '<p class="empty">Vēl neviens nav reģistrējies.</p>';
    return;
  }
  users.forEach((u) => {
    const row = document.createElement('div');
    row.className = 'test-item';
    row.dataset.userId = u.id;

    const view = document.createElement('div');
    view.className = 'user-row-view';
    view.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;gap:12px;';
    view.innerHTML = `
      <h3 style="font-size:1rem;">${u.name}</h3>
      <button type="button" class="hint rename-btn">Pārsaukt</button>
    `;

    row.appendChild(view);
    userList.appendChild(row);

    view.querySelector('.rename-btn').addEventListener('click', () => {
      row.innerHTML = '';
      const edit = document.createElement('div');
      edit.style.cssText = 'display:flex;gap:10px;align-items:center;width:100%;';
      edit.innerHTML = `
        <input type="text" class="rename-input" value="${u.name.replace(/"/g, '&quot;')}" maxlength="40" style="flex:1;">
        <button type="button" class="btn-primary rename-save" style="height:38px;">Saglabāt</button>
        <button type="button" class="hint rename-cancel">Atcelt</button>
      `;
      row.appendChild(edit);
      const input = edit.querySelector('.rename-input');
      input.focus();
      input.select();

      const errEl = document.createElement('div');
      errEl.className = 'err-msg';
      row.appendChild(errEl);

      edit.querySelector('.rename-cancel').addEventListener('click', () => loadAdminData());

      const save = async () => {
        const newName = input.value.trim();
        if (!newName) return;
        const { ok, data } = await adminPost(`/api/admin/users/${u.id}/rename`, { name: newName });
        if (!ok) {
          errEl.textContent = data.error || 'Kļūda.';
          return;
        }
        loadAdminData();
      };
      edit.querySelector('.rename-save').addEventListener('click', save);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') loadAdminData();
      });
    });
  });
}

function renderResults(results) {
  resultsBody.innerHTML = '';
  resultsEmpty.hidden = !!results.length;
  results.forEach((r) => {
    const tr = document.createElement('tr');
    const date = new Date(r.createdAt.replace(' ', 'T') + 'Z');
    const dateStr = date.toLocaleString('lv-LV', { dateStyle: 'medium', timeStyle: 'short' });
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.testTitle}</td>
      <td class="mono">${dateStr}</td>
      <td class="mono">${r.score}/${r.total}</td>
      <td><a class="hint" href="/rezultati/${r.id}" target="_blank">skatīt →</a></td>
    `;
    resultsBody.appendChild(tr);
  });
}

async function loadAdminData() {
  const [testsRes, usersRes, resultsRes] = await Promise.all([
    adminGet('/api/admin/tests'),
    adminGet('/api/admin/users'),
    adminGet('/api/admin/results'),
  ]);

  if (testsRes.status === 401 || usersRes.status === 401 || resultsRes.status === 401) {
    clearPw();
    showLogin('Sesija beigusies. Ievadi paroli vēlreiz.');
    return;
  }

  if (testsRes.ok) renderTestModes(testsRes.data);
  if (usersRes.ok) renderUsers(usersRes.data);
  if (resultsRes.ok) renderResults(resultsRes.data);
}

function showLogin(err) {
  loginCard.hidden = false;
  adminBody.hidden = true;
  loginErr.textContent = err || '';
  pwInput.value = '';
  pwInput.focus();
}

function showAdmin() {
  loginCard.hidden = true;
  adminBody.hidden = false;
  loadAdminData();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = pwInput.value;
  loginBtn.disabled = true;
  const { ok, data } = await adminPost('/api/admin/login', { password });
  loginBtn.disabled = false;

  if (!ok) {
    loginErr.textContent = data.error || 'Kļūda.';
    return;
  }
  setPw(password);
  showAdmin();
});

logoutBtn.addEventListener('click', () => {
  clearPw();
  showLogin();
});

(function init() {
  if (getPw()) {
    showAdmin();
  } else {
    showLogin();
  }
})();
