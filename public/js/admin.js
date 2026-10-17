const loginCard = document.getElementById('loginCard');
const adminBody = document.getElementById('adminBody');
const loginForm = document.getElementById('loginForm');
const pwInput = document.getElementById('pwInput');
const loginBtn = document.getElementById('loginBtn');
const loginErr = document.getElementById('loginErr');
const logoutBtn = document.getElementById('logoutBtn');
const testModeList = document.getElementById('testModeList');
const userList = document.getElementById('userList');

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

function escapeAttr(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Lowercase, strip Latvian diacritics and punctuation: "Artūrs" → "arturs".
function nameTokens(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean);
}

// Best-guess account for a legacy name: same first name, and if the legacy
// name has a second word (surname or initial), the surname must start with it.
// Only a unique match is suggested.
function suggestAccount(legacyName, accounts) {
  const [first, second] = nameTokens(legacyName);
  if (!first) return null;
  const matches = accounts.filter((a) => {
    const [aFirst, ...aRest] = nameTokens(a.name);
    if (aFirst !== first) return false;
    return !second || aRest.some((t) => t.startsWith(second));
  });
  return matches.length === 1 ? matches[0] : null;
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
    view.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;gap:12px;flex-wrap:wrap;';
    view.innerHTML = `
      <div>
        <h3 style="font-size:1rem;"></h3>
        <p class="mono"></p>
      </div>
      <span style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" class="hint rename-btn">Pārsaukt</button>
        ${u.email ? '<button type="button" class="hint password-btn">Jauna parole</button>' : ''}
        ${!u.email && u.resultCount ? '<button type="button" class="hint merge-btn">Pievienot kontam</button>' : ''}
      </span>
    `;
    view.querySelector('h3').textContent = u.name;
    view.querySelector('p').textContent = (u.email || 'vecais lietotājs (bez konta)') + ` · ${u.resultCount} rez.`;

    row.appendChild(view);
    userList.appendChild(row);

    const openEditor = (fieldsHtml, onSave) => {
      row.innerHTML = '';
      const edit = document.createElement('div');
      edit.style.cssText = 'display:flex;gap:10px;align-items:center;width:100%;flex-wrap:wrap;';
      edit.innerHTML = `
        ${fieldsHtml}
        <button type="button" class="btn-primary edit-save" style="height:38px;">Saglabāt</button>
        <button type="button" class="hint edit-cancel">Atcelt</button>
      `;
      row.appendChild(edit);
      const inputs = [...edit.querySelectorAll('input, select')];
      inputs[0].focus();
      if (inputs[0].select) inputs[0].select();

      const errEl = document.createElement('div');
      errEl.className = 'err-msg';
      row.appendChild(errEl);

      edit.querySelector('.edit-cancel').addEventListener('click', () => loadAdminData());
      const save = async () => {
        const { ok, data } = await onSave(inputs.map((i) => i.value.trim()));
        if (!ok) {
          errEl.textContent = data.error || 'Kļūda.';
          return;
        }
        loadAdminData();
      };
      edit.querySelector('.edit-save').addEventListener('click', save);
      inputs.forEach((input) => input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') loadAdminData();
      }));
    };

    view.querySelector('.rename-btn').addEventListener('click', () => {
      if (u.email) {
        openEditor(
          `<input type="text" value="${escapeAttr(u.firstName)}" maxlength="40" placeholder="Vārds" style="flex:1;">
           <input type="text" value="${escapeAttr(u.lastName)}" maxlength="40" placeholder="Uzvārds" style="flex:1;">`,
          ([firstName, lastName]) => adminPost(`/api/admin/users/${u.id}/rename`, { firstName, lastName })
        );
      } else {
        openEditor(
          `<input type="text" value="${escapeAttr(u.name)}" maxlength="40" style="flex:1;">`,
          ([name]) => adminPost(`/api/admin/users/${u.id}/rename`, { name })
        );
      }
    });

    const mergeBtn = view.querySelector('.merge-btn');
    if (mergeBtn) {
      mergeBtn.addEventListener('click', () => {
        const accounts = users.filter((a) => a.email);
        const suggested = suggestAccount(u.name, accounts);
        const options = accounts
          .map((a) => `<option value="${a.id}" ${suggested && suggested.id === a.id ? 'selected' : ''}>${escapeAttr(a.name)} (${escapeAttr(a.email)})</option>`)
          .join('');
        openEditor(
          `<span class="hint">${escapeAttr(u.name)} (${u.resultCount} rez.) →</span>
           <select style="flex:1;min-width:200px;">
             <option value="" ${suggested ? '' : 'selected'}>— izvēlies kontu —</option>
             ${options}
           </select>`,
          ([accountId]) => accountId
            ? adminPost(`/api/admin/users/${u.id}/merge`, { accountId: Number(accountId) })
            : Promise.resolve({ ok: false, data: { error: 'Jāizvēlas konts.' } })
        );
        row.querySelector('.edit-save').textContent = 'Pievienot';
        const note = document.createElement('div');
        note.className = 'hint';
        note.style.width = '100%';
        note.textContent = suggested
          ? 'Ieteikts pēc vārda — pārbaudi, vai tas tiešām ir tas pats dalībnieks.'
          : 'Automātisks ieteikums nav atrasts — izvēlies kontu pats.';
        row.insertBefore(note, row.querySelector('.err-msg'));
      });
    }

    const pwBtn = view.querySelector('.password-btn');
    if (pwBtn) {
      pwBtn.addEventListener('click', () => {
        openEditor(
          '<input type="text" maxlength="200" placeholder="Jaunā parole (min. 8 simboli)" autocomplete="off" style="flex:1;">',
          ([password]) => adminPost(`/api/admin/users/${u.id}/password`, { password })
        );
      });
    }
  });
}

async function loadAdminData() {
  const [testsRes, usersRes] = await Promise.all([
    adminGet('/api/admin/tests'),
    adminGet('/api/admin/users'),
  ]);

  if (testsRes.status === 401 || usersRes.status === 401) {
    clearPw();
    showLogin('Sesija beigusies. Ievadi paroli vēlreiz.');
    return;
  }

  if (testsRes.ok) renderTestModes(testsRes.data);
  if (usersRes.ok) renderUsers(usersRes.data);
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
  const next = new URLSearchParams(location.search).get('next');
  if (next && next.startsWith('/admin/')) {
    location.href = next;
    return;
  }
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
