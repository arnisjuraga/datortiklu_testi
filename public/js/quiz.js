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
const qCat = document.getElementById('qCat');
const qText = document.getElementById('qText');
const optsEl = document.getElementById('opts');
const scoreLabel = document.getElementById('scoreLabel');
const scoreLive = document.getElementById('scoreLive');
const scoreTotal = document.getElementById('scoreTotal');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const quizBody = document.getElementById('quizBody');
const resultEl = document.getElementById('result');
const finalScore = document.getElementById('finalScore');
const verdict = document.getElementById('verdict');
const verdictDesc = document.getElementById('verdictDesc');
const retryBtn = document.getElementById('retryBtn');
const reviewLink = document.getElementById('reviewLink');
const leaderboardEl = document.getElementById('leaderboard');

let QUESTIONS = [];
let mode = 'macisanas';
let current = 0;
let selected = [];
let submitting = false;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function computeScore() {
  return selected.reduce((acc, sel, i) => acc + (sel !== null && sel === QUESTIONS[i].a ? 1 : 0), 0);
}
function answeredCount() {
  return selected.filter((s) => s !== null).length;
}

function buildPorts() {
  portsEl.innerHTML = '';
  QUESTIONS.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'port mono';
    d.textContent = String(i + 1).padStart(2, '0');
    d.id = 'port-' + i;
    d.addEventListener('click', () => {
      current = i;
      renderQuestion();
    });
    portsEl.appendChild(d);
  });
}

function refreshPorts() {
  QUESTIONS.forEach((_, i) => {
    const el = document.getElementById('port-' + i);
    el.classList.remove('current', 'correct', 'wrong', 'answered');
    const sel = selected[i];
    if (mode === 'macisanas' && sel !== null) {
      el.classList.add(sel === QUESTIONS[i].a ? 'correct' : 'wrong');
    } else if (mode === 'kontroldarbs' && sel !== null) {
      el.classList.add('answered');
    }
    if (i === current) el.classList.add('current');
  });
}

function refreshScoreReadout() {
  if (mode === 'macisanas') {
    scoreLabel.textContent = 'PUNKTI';
    scoreLive.textContent = computeScore();
    scoreTotal.textContent = QUESTIONS.length;
  } else {
    scoreLabel.textContent = 'ATBILDĒTS';
    scoreLive.textContent = answeredCount();
    scoreTotal.textContent = QUESTIONS.length;
  }
}

function renderQuestion() {
  const item = QUESTIONS[current];
  qNum.textContent = `JAUTĀJUMS ${String(current + 1).padStart(2, '0')}/${QUESTIONS.length}`;
  qCat.textContent = mode === 'kontroldarbs' ? 'KONTROLDARBS' : 'MĀCĪŠANĀS';
  qText.textContent = item.q;
  optsEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  const sel = selected[current];

  item.opts.forEach((optText, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.innerHTML = `<span class="tag-letter">${letters[i]}</span><span>${optText}</span>`;

    if (sel !== null) {
      if (mode === 'macisanas') {
        if (i === item.a) btn.classList.add('right');
        if (i === sel && sel !== item.a) btn.classList.add('miss');
        if (i === sel) btn.classList.add('chosen');
      } else if (i === sel) {
        btn.classList.add('chosen');
      }
    }

    btn.addEventListener('click', () => selectOption(i));
    optsEl.appendChild(btn);
  });

  prevBtn.classList.toggle('show', current > 0);
  nextBtn.classList.add('show');
  const isLast = current === QUESTIONS.length - 1;
  nextBtn.textContent = isLast ? (mode === 'kontroldarbs' ? 'BEIGT TESTU' : 'REZULTĀTS →') : 'TĀLĀK →';

  refreshScoreReadout();
  refreshPorts();
}

function selectOption(i) {
  selected[current] = i;
  renderQuestion();
}

function goPrev() {
  if (current > 0) {
    current--;
    renderQuestion();
  }
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
  const score = computeScore();
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
    const answers = QUESTIONS.map((q, i) => ({
      q: q.q,
      opts: q.opts,
      correct: q.a,
      selected: selected[i],
    }));
    const { ok, data } = await apiPost('/api/results', {
      name: playerName,
      testId,
      score,
      total: QUESTIONS.length,
      answers,
    });
    if (ok && data.resultId) {
      reviewLink.href = `/rezultati/${data.resultId}`;
      reviewLink.hidden = false;
    }
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
    const row = document.createElement('a');
    row.href = `/rezultati/${r.id}`;
    row.className = 'lb-row' + (r.name === playerName ? ' me' : '');
    row.innerHTML = `
      <span class="lb-name">${r.name}</span>
      <span class="lb-score mono">${r.score}/${r.total}</span>
    `;
    leaderboardEl.appendChild(row);
  });
}

function resetQuiz(freshOrder) {
  if (freshOrder) QUESTIONS = shuffle(QUESTIONS);
  current = 0;
  selected = new Array(QUESTIONS.length).fill(null);
  submitting = false;
  quizBody.classList.remove('hide');
  resultEl.classList.remove('show');
  buildPorts();
  renderQuestion();
}

prevBtn.addEventListener('click', goPrev);
nextBtn.addEventListener('click', goNext);
retryBtn.addEventListener('click', () => resetQuiz(true));

(async function init() {
  if (!playerName) return;
  playerNameEl.textContent = playerName;

  const { ok, data } = await apiGet(`/api/tests/${testId}`);
  if (!ok) {
    portsEl.hidden = true;
    document.querySelector('.foot').hidden = true;
    qNum.textContent = '';
    qCat.textContent = '';
    testTag.textContent = '';
    qText.textContent = data.error || 'Tests nav atrasts.';
    return;
  }

  testTitle.textContent = data.title;
  testTag.textContent = `${data.questions.length} jautājumi`;
  mode = data.mode || 'macisanas';
  QUESTIONS = shuffle(data.questions);
  resetQuiz(false);
})();
