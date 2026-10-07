const userFilter = document.getElementById('userFilter');
const testFilter = document.getElementById('testFilter');
const modeFilter = document.getElementById('modeFilter');
const gradedFilter = document.getElementById('gradedFilter');
const latestOnly = document.getElementById('latestOnly');
const bulkGradeBtn = document.getElementById('bulkGradeBtn');
const bulkCancelBtn = document.getElementById('bulkCancelBtn');
const bulkErr = document.getElementById('bulkErr');
const resultsTable = document.getElementById('resultsTable');
const resultsEmpty = document.getElementById('resultsEmpty');
const resultsCount = document.getElementById('resultsCount');

let allResults = [];
// Unmarked latest results currently on screen — what the bulk button marks.
let bulkIds = [];
let bulkArmed = false;

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Linear 10-point grade. The whole grade is rounded from the exact value
// (not from the 1-decimal one), so 8.45 → 8,5 but → 8.
function grade(score, total) {
  const exact = total ? (score * 10) / total : 0;
  const oneDecimal = Math.round(exact * 10 + 1e-9) / 10;
  const whole = Math.round(exact + 1e-9);
  return {
    oneDecimal: oneDecimal.toLocaleString('lv-LV', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    whole,
  };
}

function modeBadge(mode) {
  if (mode === 'kontroldarbs') return '<span class="mode-badge exam">Kontroldarbs</span>';
  if (mode === 'macisanas') return '<span class="mode-badge learn">Mācīšanās</span>';
  return '<span class="mode-badge unknown">nav zināms</span>';
}

// Filters live in the URL so a reload, or coming back from a result's
// review page, keeps them.
function readFiltersFromUrl() {
  const params = new URLSearchParams(location.search);
  userFilter.value = params.get('dalibnieks') || '';
  testFilter.value = params.get('tests') || '';
  modeFilter.value = params.get('rezims') || '';
  gradedFilter.value = params.get('zurnals') || '';
  latestOnly.checked = params.get('pedejie') === '1';
  // Unknown value in the URL (e.g. removed test) → fall back to "all".
  if (userFilter.selectedIndex === -1) userFilter.value = '';
  if (testFilter.selectedIndex === -1) testFilter.value = '';
  if (modeFilter.selectedIndex === -1) modeFilter.value = '';
  if (gradedFilter.selectedIndex === -1) gradedFilter.value = '';
}

function writeFiltersToUrl() {
  const params = new URLSearchParams();
  if (userFilter.value) params.set('dalibnieks', userFilter.value);
  if (testFilter.value) params.set('tests', testFilter.value);
  if (modeFilter.value) params.set('rezims', modeFilter.value);
  if (gradedFilter.value) params.set('zurnals', gradedFilter.value);
  if (latestOnly.checked) params.set('pedejie', '1');
  const qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

function formatDate(createdAt) {
  const date = new Date(createdAt.replace(' ', 'T') + 'Z');
  return date.toLocaleString('lv-LV', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDay(sqlDate) {
  const date = new Date(sqlDate.replace(' ', 'T') + 'Z');
  return date.toLocaleDateString('lv-LV', { day: 'numeric', month: 'short' });
}

async function setGraded(ids, graded) {
  const { ok, status, data } = await adminPost('/api/admin/results/graded', { ids, graded });
  if (status === 401) {
    clearPw();
    location.href = '/admin?next=' + encodeURIComponent(location.pathname + location.search);
    return false;
  }
  if (!ok) return false;
  const byId = new Map(data.results.map((r) => [r.id, r.gradedAt]));
  allResults.forEach((r) => { if (byId.has(r.id)) r.gradedAt = byId.get(r.id); });
  return true;
}

function render() {
  const userId = userFilter.value;
  const testId = testFilter.value;
  const mode = modeFilter.value;
  const rows = allResults.filter((r) => {
    if (userId && String(r.userId) !== userId) return false;
    if (testId && r.testId !== testId) return false;
    if (mode === 'unknown') return !r.mode;
    if (mode && r.mode !== mode) return false;
    return true;
  });

  // user → test → attempts (newest first). "Latest" is per user and test,
  // among the results that pass the filters.
  const byUser = new Map();
  rows.forEach((r) => {
    if (!byUser.has(r.userId)) byUser.set(r.userId, { name: r.name, email: r.email, tests: new Map() });
    const tests = byUser.get(r.userId).tests;
    if (!tests.has(r.testId)) tests.set(r.testId, []);
    tests.get(r.testId).push(r);
  });
  const users = [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'lv', { sensitivity: 'base' }));

  resultsTable.querySelectorAll('tbody').forEach((tb) => tb.remove());
  let shown = 0;
  let shownUsers = 0;
  bulkIds = [];
  users.forEach((u) => {
    const tbody = document.createElement('tbody');
    tbody.className = 'user-group';
    const head = document.createElement('tr');
    head.className = 'user-head';
    head.innerHTML = `<td colspan="8"><b>${escapeHtml(u.name)}</b>
      <span class="hint mono">${u.email ? escapeHtml(u.email) : 'vecais lietotājs (bez konta)'}</span></td>`;
    tbody.appendChild(head);

    const testGroups = [...u.tests.values()]
      .sort((a, b) => a[0].testTitle.localeCompare(b[0].testTitle, 'lv'))
      .map((attempts) => attempts.sort((a, b) => (b.createdAt.localeCompare(a.createdAt)) || (b.id - a.id)))
      // The grade-book status is judged on the latest attempt.
      .filter((attempts) => {
        if (gradedFilter.value === 'ne') return !attempts[0].gradedAt;
        if (gradedFilter.value === 'ja') return !!attempts[0].gradedAt;
        return true;
      });
    if (!testGroups.length) return;
    shownUsers++;

    testGroups.forEach((attempts) => {
      if (!attempts[0].gradedAt) bulkIds.push(attempts[0].id);
      (latestOnly.checked ? attempts.slice(0, 1) : attempts).forEach((r, i) => {
        const isLatest = i === 0;
        const g = grade(r.score, r.total);
        const tr = document.createElement('tr');
        tr.className = [isLatest ? 'latest' : '', r.gradedAt ? 'graded' : ''].join(' ').trim();
        tr.innerHTML = `
          <td>${escapeHtml(r.testTitle)}${isLatest ? ' <span class="latest-badge">PĒDĒJAIS</span>' : ''}
            ${r.legacyName ? `<div class="hint">kā „${escapeHtml(r.legacyName)}”</div>` : ''}</td>
          <td>${modeBadge(r.mode)}</td>
          <td class="mono">${formatDate(r.createdAt)}</td>
          <td class="mono">${r.score}/${r.total}</td>
          <td class="mono">${g.oneDecimal}</td>
          <td class="mono grade-whole">${g.whole}</td>
          <td><label class="graded-check">
            <input type="checkbox" ${r.gradedAt ? 'checked' : ''}>
            <span class="mono">${r.gradedAt ? '✓ ' + formatDay(r.gradedAt) : ''}</span>
          </label></td>
          <td><a class="hint" href="/rezultati/${r.id}">skatīt →</a></td>
        `;
        const box = tr.querySelector('.graded-check input');
        box.addEventListener('change', async () => {
          box.disabled = true;
          if (!(await setGraded([r.id], box.checked))) box.checked = !box.checked;
          render();
        });
        tbody.appendChild(tr);
        shown++;
      });
    });
    resultsTable.appendChild(tbody);
  });

  resultsCount.textContent = `${shownUsers} dalībnieki · ${shown} rezultāti` +
    (shown === allResults.length ? '' : ` (filtrēti no ${allResults.length})`);
  resultsEmpty.hidden = shownUsers > 0;
  renderBulk();
  resultsEmpty.textContent = allResults.length ? 'Nav rezultātu, kas atbilst filtram.' : 'Vēl nav neviena rezultāta.';
}

function renderBulk() {
  bulkErr.textContent = '';
  bulkCancelBtn.hidden = !bulkArmed;
  bulkGradeBtn.disabled = bulkIds.length === 0;
  bulkGradeBtn.classList.toggle('armed', bulkArmed);
  bulkGradeBtn.textContent = bulkArmed
    ? `APSTIPRINĀT: ATZĪMĒT ${bulkIds.length} KĀ IEVADĪTUS`
    : `ATZĪMĒT REDZAMOS PĒDĒJOS KĀ IEVADĪTUS (${bulkIds.length})`;
}

bulkGradeBtn.addEventListener('click', async () => {
  if (!bulkIds.length) return;
  if (!bulkArmed) {
    bulkArmed = true;
    renderBulk();
    return;
  }
  bulkGradeBtn.disabled = true;
  const ok = await setGraded(bulkIds, true);
  bulkArmed = false;
  render();
  if (!ok) bulkErr.textContent = 'Neizdevās saglabāt.';
});

bulkCancelBtn.addEventListener('click', () => {
  bulkArmed = false;
  renderBulk();
});

function onFilterChange() {
  bulkArmed = false;
  writeFiltersToUrl();
  render();
}

userFilter.addEventListener('change', onFilterChange);
testFilter.addEventListener('change', onFilterChange);
modeFilter.addEventListener('change', onFilterChange);
gradedFilter.addEventListener('change', onFilterChange);
latestOnly.addEventListener('change', onFilterChange);

(async function init() {
  if (!getPw()) {
    location.href = '/admin?next=' + encodeURIComponent(location.pathname + location.search);
    return;
  }

  const [testsRes, resultsRes] = await Promise.all([
    adminGet('/api/admin/tests'),
    adminGet('/api/admin/results'),
  ]);
  if (testsRes.status === 401 || resultsRes.status === 401) {
    clearPw();
    location.href = '/admin?next=' + encodeURIComponent(location.pathname + location.search);
    return;
  }

  allResults = resultsRes.ok ? resultsRes.data : [];

  // Test options: every registered test, plus any test id that only
  // appears in old results (e.g. a test since removed from tests.json).
  const titles = new Map();
  if (testsRes.ok) testsRes.data.forEach((t) => titles.set(t.id, t.title));
  allResults.forEach((r) => { if (!titles.has(r.testId)) titles.set(r.testId, r.testTitle); });
  titles.forEach((title, id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = title;
    testFilter.appendChild(opt);
  });

  // Student options: everyone who has results.
  const people = new Map();
  allResults.forEach((r) => people.set(r.userId, r.name));
  [...people].sort((a, b) => a[1].localeCompare(b[1], 'lv', { sensitivity: 'base' })).forEach(([id, name]) => {
    const opt = document.createElement('option');
    opt.value = String(id);
    opt.textContent = name;
    userFilter.appendChild(opt);
  });

  readFiltersFromUrl();
  render();
})();
