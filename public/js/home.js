const gateCard = document.getElementById('gateCard');
const testsCard = document.getElementById('testsCard');
const whoami = document.getElementById('whoami');
const whoamiName = document.getElementById('whoamiName');
const changeNameBtn = document.getElementById('changeNameBtn');
const nameForm = document.getElementById('nameForm');
const nameInput = document.getElementById('nameInput');
const submitBtn = document.getElementById('submitBtn');
const errMsg = document.getElementById('errMsg');
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

async function renderMyResults(name) {
  const { ok, data } = await apiGet(`/api/my-results?name=${encodeURIComponent(name)}`);
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

function showLoggedIn(name) {
  const next = getNextParam();
  if (next) {
    location.href = next;
    return;
  }
  gateCard.hidden = true;
  whoami.hidden = false;
  whoamiName.textContent = name;
  testsCard.hidden = false;
  renderMyResults(name);
}

function showGate() {
  whoami.hidden = true;
  testsCard.hidden = true;
  myResultsCard.hidden = true;
  gateCard.hidden = false;
  nameInput.value = '';
  nameInput.focus();
}

changeNameBtn.addEventListener('click', () => {
  clearSavedName();
  showGate();
});

nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  errMsg.textContent = '';
  if (!name) return;

  submitBtn.disabled = true;
  const { ok, data } = await apiPost('/api/register', { name });
  submitBtn.disabled = false;

  if (!ok) {
    errMsg.textContent = data.error || 'Kļūda reģistrējot vārdu.';
    return;
  }

  saveIdentity(data.id, data.name);
  showLoggedIn(data.name);
});

(async function init() {
  renderTests();
  const saved = getSavedName();
  if (saved) {
    const fresh = await refreshIdentity();
    showLoggedIn(fresh || saved);
  } else {
    showGate();
  }
})();
