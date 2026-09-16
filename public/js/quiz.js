const testId = location.pathname.split('/').filter(Boolean)[1];

const playerName = getSavedName();
if (!playerName) {
  location.href = '/?next=' + encodeURIComponent(location.pathname);
}

const testTitle = document.getElementById('testTitle');
const testTag = document.getElementById('testTag');
const playerNameEl = document.getElementById('playerName');
const portsEl = document.getElementById('ports');
const qNum = document.getElementById('qNum');
const qText = document.getElementById('qText');
const optsEl = document.getElementById('opts');
const scoreLive = document.getElementById('scoreLive');
const scoreTotal = document.getElementById('scoreTotal');
const nextBtn = document.getElementById('nextBtn');
const quizBody = document.getElementById('quizBody');
const resultEl = document.getElementById('result');
const finalScore = document.getElementById('finalScore');
const verdict = document.getElementById('verdict');
const verdictDesc = document.getElementById('verdictDesc');
const retryBtn = document.getElementById('retryBtn');
const leaderboardEl = document.getElementById('leaderboard');

let QUESTIONS = [];
let current = 0;
let score = 0;
let answered = [];
let submitting = false;

function buildPorts() {
  portsEl.innerHTML = '';
  QUESTIONS.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'port mono';
    d.textContent = String(i + 1).padStart(2, '0');
    d.id = 'port-' + i;
    portsEl.appendChild(d);
  });
}

function refreshPorts() {
  QUESTIONS.forEach((_, i) => {
    const el = document.getElementById('port-' + i);
    el.classList.remove('current', 'correct', 'wrong');
    if (answered[i] === true) el.classList.add('correct');
    else if (answered[i] === false) el.classList.add('wrong');
    else if (i === current) el.classList.add('current');
  });
}

function renderQuestion() {
  const item = QUESTIONS[current];
  qNum.textContent = `JAUTĀJUMS ${String(current + 1).padStart(2, '0')}/${QUESTIONS.length}`;
  qText.textContent = item.q;
  optsEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  item.opts.forEach((optText, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.innerHTML = `<span class="tag-letter">${letters[i]}</span><span>${optText}</span>`;
    btn.addEventListener('click', () => selectOption(i));
    optsEl.appendChild(btn);
  });
  nextBtn.classList.remove('show');
  nextBtn.textContent = current === QUESTIONS.length - 1 ? 'REZULTĀTS →' : 'TĀLĀK →';
  scoreLive.textContent = score;
  refreshPorts();
}

function selectOption(i) {
  if (answered[current] !== null) return;
  const item = QUESTIONS[current];
  const isRight = i === item.a;
  answered[current] = isRight;
  if (isRight) score++;

  [...optsEl.children].forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === item.a) btn.classList.add('right');
    if (idx === i && !isRight) btn.classList.add('miss');
    if (idx === i) btn.classList.add('chosen');
  });

  scoreLive.textContent = score;
  refreshPorts();
  nextBtn.classList.add('show');
}

function goNext() {
  if (current < QUESTIONS.length - 1) {
    current++;
    renderQuestion();
  } else {
    showResult();
  }
}

async function showResult() {
  quizBody.classList.add('hide');
  resultEl.classList.add('show');
  finalScore.innerHTML = `${score}<span>/${QUESTIONS.length}</span>`;
  let v, d, cls;
  const pct = score / QUESTIONS.length;
  if (pct >= 0.87) { v = 'LĪNIJA TĪRA'; cls = 'good'; d = 'Izcili — kabeļu teorija tev sēž kā T568B secība atmiņā.'; }
  else if (pct >= 0.6) { v = 'SIGNĀLS STABILS'; cls = 'mid'; d = 'Labs rezultāts. Daži savienojumi vēl jāpārbauda vēlreiz.'; }
  else { v = 'TRAUCĒJUMI LĪNIJĀ'; cls = 'bad'; d = 'Ir vērts atkārtot pamatus.'; }
  verdict.textContent = v;
  verdict.className = 'verdict ' + cls;
  verdictDesc.textContent = d;

  if (!submitting) {
    submitting = true;
    await apiPost('/api/results', { name: playerName, testId, score, total: QUESTIONS.length });
  }
  loadLeaderboard();
}

async function loadLeaderboard() {
  const { ok, data } = await apiGet(`/api/results/${testId}`);
  leaderboardEl.innerHTML = '';
  if (!ok || !data.length) {
    leaderboardEl.innerHTML = '<p class="empty">Vēl nav rezultātu.</p>';
    return;
  }
  data.slice(0, 15).forEach((r) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (r.name === playerName ? ' me' : '');
    const date = new Date(r.createdAt.replace(' ', 'T') + 'Z');
    row.innerHTML = `
      <span class="lb-name">${r.name}</span>
      <span class="lb-score mono">${r.score}/${r.total}</span>
    `;
    leaderboardEl.appendChild(row);
  });
}

function resetQuiz() {
  current = 0;
  score = 0;
  answered = new Array(QUESTIONS.length).fill(null);
  submitting = false;
  quizBody.classList.remove('hide');
  resultEl.classList.remove('show');
  buildPorts();
  renderQuestion();
}

nextBtn.addEventListener('click', goNext);
retryBtn.addEventListener('click', resetQuiz);

(async function init() {
  if (!playerName) return;
  playerNameEl.textContent = playerName;

  const { ok, data } = await apiGet(`/api/tests/${testId}`);
  if (!ok) {
    qText.textContent = data.error || 'Tests nav atrasts.';
    return;
  }

  testTitle.textContent = data.title;
  testTag.textContent = `${data.questions.length} jautājumi`;
  QUESTIONS = data.questions;
  scoreTotal.textContent = QUESTIONS.length;
  answered = new Array(QUESTIONS.length).fill(null);
  buildPorts();
  renderQuestion();
})();
