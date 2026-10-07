const testFilter = document.getElementById('testFilter');
const modeFilter = document.getElementById('modeFilter');
const resultsBody = document.getElementById('resultsBody');
const resultsEmpty = document.getElementById('resultsEmpty');
const resultsCount = document.getElementById('resultsCount');

let allResults = [];

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
  testFilter.value = params.get('tests') || '';
  modeFilter.value = params.get('rezims') || '';
  // Unknown value in the URL (e.g. removed test) → fall back to "all".
  if (testFilter.selectedIndex === -1) testFilter.value = '';
  if (modeFilter.selectedIndex === -1) modeFilter.value = '';
}

function writeFiltersToUrl() {
  const params = new URLSearchParams();
  if (testFilter.value) params.set('tests', testFilter.value);
  if (modeFilter.value) params.set('rezims', modeFilter.value);
  const qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

function render() {
  const testId = testFilter.value;
  const mode = modeFilter.value;
  const rows = allResults.filter((r) => {
    if (testId && r.testId !== testId) return false;
    if (mode === 'unknown') return !r.mode;
    if (mode && r.mode !== mode) return false;
    return true;
  });

  resultsBody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    const date = new Date(r.createdAt.replace(' ', 'T') + 'Z');
    const dateStr = date.toLocaleString('lv-LV', { dateStyle: 'medium', timeStyle: 'short' });
    const g = grade(r.score, r.total);
    tr.innerHTML = `
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.testTitle)}</td>
      <td>${modeBadge(r.mode)}</td>
      <td class="mono">${dateStr}</td>
      <td class="mono">${r.score}/${r.total}</td>
      <td class="mono">${g.oneDecimal}</td>
      <td class="mono grade-whole">${g.whole}</td>
      <td><a class="hint" href="/rezultati/${r.id}">skatīt →</a></td>
    `;
    resultsBody.appendChild(tr);
  });

  resultsCount.textContent = rows.length === allResults.length
    ? `${rows.length} rezultāti`
    : `${rows.length} no ${allResults.length} rezultātiem`;
  resultsEmpty.hidden = rows.length > 0;
  resultsEmpty.textContent = allResults.length ? 'Nav rezultātu, kas atbilst filtram.' : 'Vēl nav neviena rezultāta.';
}

function onFilterChange() {
  writeFiltersToUrl();
  render();
}

testFilter.addEventListener('change', onFilterChange);
modeFilter.addEventListener('change', onFilterChange);

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

  readFiltersFromUrl();
  render();
})();
