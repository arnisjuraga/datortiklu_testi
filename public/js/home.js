const gateCard = document.getElementById('gateCard');
const testsCard = document.getElementById('testsCard');
const whoami = document.getElementById('whoami');
const whoamiName = document.getElementById('whoamiName');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const loginErr = document.getElementById('loginErr');
const loginBtn = document.getElementById('loginBtn');
const registerForm = document.getElementById('registerForm');
const registerErr = document.getElementById('registerErr');
const registerBtn = document.getElementById('registerBtn');
const testList = document.getElementById('testList');
const myResultsCard = document.getElementById('myResultsCard');
const myResultsList = document.getElementById('myResultsList');

async function renderTests() {
  const { ok, data } = await apiGet('/api/tests');
  testList.innerHTML = '';
  if (!ok || !data.length) {
    testList.innerHTML = '<p class="empty">Pagaidām nav neviena testa.</p>';
    return;
  }
  data.forEach((t) => {
    const a = document.createElement('a');
    a.className = 'test-item';
    a.href = `/testi/${t.id}`;
    const badge = t.mode === 'kontroldarbs' ? '<span class="exam-badge">KONTROLDARBS</span>' : '';
    a.innerHTML = `
      <div>
        <h3>${t.title}${badge}</h3>
        <p>${t.description}</p>
      </div>
      <span class="go mono">${t.questionCount} JAUT. →</span>
    `;
    testList.appendChild(a);
  });
}

async function renderMyResults() {
  const { ok, data } = await apiGet('/api/my-results');
  if (!ok || !data.length) {
    myResultsCard.hidden = true;
    return;
  }
  myResultsCard.hidden = false;
  myResultsList.innerHTML = '';
  data.slice(0, 20).forEach((r) => {
    const date = new Date(r.createdAt.replace(' ', 'T') + 'Z');
    const dateStr = date.toLocaleString('lv-LV', { dateStyle: 'medium', timeStyle: 'short' });
    const canOpen = r.reviewEnabled;
    const row = document.createElement(canOpen ? 'a' : 'div');
    if (canOpen) row.href = `/rezultati/${r.id}`;
    row.className = 'lb-row';
    row.innerHTML = `
      <span class="lb-name">${r.testTitle} <span class="hint mono" style="font-weight:400;">${dateStr}</span></span>
      <span class="lb-score mono">${r.score}/${r.total}</span>
    `;
    myResultsList.appendChild(row);
  });
}

function getNextParam() {
  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  return next && next.startsWith('/') ? next : null;
}

function showLoggedIn(user) {
  const next = getNextParam();
  if (next) {
    location.href = next;
    return;
  }
  gateCard.hidden = true;
  whoami.hidden = false;
  whoamiName.textContent = user.name;
  testsCard.hidden = false;
  renderTests();
  renderMyResults();
}

function showTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  loginForm.hidden = tab !== 'login';
  registerForm.hidden = tab !== 'register';
  loginErr.textContent = '';
  registerErr.textContent = '';
  (tab === 'login' ? loginForm : registerForm).querySelector('input').focus();
}

function showGate() {
  whoami.hidden = true;
  testsCard.hidden = true;
  myResultsCard.hidden = true;
  gateCard.hidden = false;
  showTab('login');
}

document.querySelectorAll('.auth-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

logoutBtn.addEventListener('click', async () => {
  await apiPost('/api/auth/logout', {});
  loginForm.reset();
  registerForm.reset();
  showGate();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErr.textContent = '';
  loginBtn.disabled = true;
  const { ok, data } = await apiPost('/api/auth/login', {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value,
  });
  loginBtn.disabled = false;
  if (!ok) {
    loginErr.textContent = data.error || 'Neizdevās pieslēgties.';
    return;
  }
  loginForm.reset();
  showLoggedIn(data.user);
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerErr.textContent = '';
  const password = document.getElementById('regPassword').value;
  if (password !== document.getElementById('regPassword2').value) {
    registerErr.textContent = 'Paroles nesakrīt.';
    return;
  }
  registerBtn.disabled = true;
  const { ok, data } = await apiPost('/api/auth/register', {
    firstName: document.getElementById('regFirstName').value,
    lastName: document.getElementById('regLastName').value,
    email: document.getElementById('regEmail').value,
    password,
  });
  registerBtn.disabled = false;
  if (!ok) {
    registerErr.textContent = data.error || 'Kļūda reģistrējoties.';
    return;
  }
  registerForm.reset();
  showLoggedIn(data.user);
});

(async function init() {
  const me = await getMe();
  if (me) {
    showLoggedIn(me);
  } else {
    showGate();
  }
})();
