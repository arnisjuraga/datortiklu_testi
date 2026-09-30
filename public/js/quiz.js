const testId = location.pathname.split('/').filter(Boolean)[1];

const testTitle = document.getElementById('testTitle');
const testTag = document.getElementById('testTag');
const playerNameEl = document.getElementById('playerName');
const portsEl = document.getElementById('ports');
const qNum = document.getElementById('qNum');
const qCat = document.getElementById('qCat');
const qImgWrap = document.getElementById('qImgWrap');
const qImg = document.getElementById('qImg');
const qText = document.getElementById('qText');
const optsEl = document.getElementById('opts');
const comboWrap = document.getElementById('comboWrap');
const comboInput = document.getElementById('comboInput');
const comboList = document.getElementById('comboList');
const comboFeedback = document.getElementById('comboFeedback');
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
const submitErr = document.getElementById('submitErr');

let QUESTIONS = [];
let mode = 'macisanas';
let reviewEnabled = false;
let answerType = 'buttons';
let current = 0;
let selected = [];
let submitted = false;
let submitInFlight = false;

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

  if (item.image) {
    qImg.src = item.image;
    qImgWrap.hidden = false;
  } else {
    qImgWrap.hidden = true;
  }

  if (answerType === 'dropdown') {
    optsEl.hidden = true;
    comboWrap.hidden = false;
    renderCombo(item, selected[current]);
  } else {
    comboWrap.hidden = true;
    optsEl.hidden = false;
    renderButtons(item, selected[current]);
  }

  prevBtn.classList.toggle('show', current > 0);
  nextBtn.classList.add('show');
  const isLast = current === QUESTIONS.length - 1;
  nextBtn.textContent = isLast ? (mode === 'kontroldarbs' ? 'BEIGT TESTU' : 'REZULTĀTS →') : 'TĀLĀK →';

  refreshScoreReadout();
  refreshPorts();
}

function renderButtons(item, sel) {
  optsEl.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
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
}

function renderCombo(item, sel) {
  comboInput.value = sel !== null ? item.opts[sel] : '';
  comboInput.classList.remove('right', 'miss', 'chosen');
  comboList.innerHTML = '';
  comboList.hidden = true;
  comboFeedback.textContent = '';
  comboFeedback.style.color = '';

  if (sel !== null) {
    if (mode === 'macisanas') {
      if (sel === item.a) {
        comboInput.classList.add('right');
        comboFeedback.textContent = '✓ pareizi';
        comboFeedback.style.color = 'var(--success)';
      } else {
        comboInput.classList.add('miss');
        comboFeedback.textContent = `✗ pareizā atbilde: ${item.opts[item.a]}`;
        comboFeedback.style.color = 'var(--error)';
      }
    } else {
      comboInput.classList.add('chosen');
    }
  }
}

function comboSuggestions(item, query) {
  const q = query.trim().toLowerCase();
  comboList.innerHTML = '';
  const matches = item.opts
    .map((opt, i) => ({ opt, i }))
    .filter(({ opt }) => opt.toLowerCase().includes(q));

  matches.forEach(({ opt, i }) => {
    const row = document.createElement('div');
    row.className = 'combo-item';
    row.textContent = opt;
    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectOption(i);
    });
    comboList.appendChild(row);
  });
  comboList.hidden = matches.length === 0;
}

comboInput.addEventListener('input', () => comboSuggestions(QUESTIONS[current], comboInput.value));
comboInput.addEventListener('focus', () => {
  comboInput.select();
  comboSuggestions(QUESTIONS[current], '');
});
comboInput.addEventListener('blur', () => {
  setTimeout(() => { comboList.hidden = true; }, 120);
});
comboInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') comboList.hidden = true;
});

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
  if (pct >= 0.87) { v = 'IZCILI'; cls = 'good'; d = 'Ļoti stabils rezultāts.'; }
  else if (pct >= 0.6) { v = 'LABI'; cls = 'mid'; d = 'Pietiekams rezultāts, dažas lietas vēl vērts atkārtot.'; }
  else { v = 'JĀPAPILDINA'; cls = 'bad'; d = 'Ir vērts atkārtot pamatus.'; }
  verdict.textContent = v;
  verdict.className = 'verdict ' + cls;
  verdictDesc.textContent = d;

  await submitResult();
  loadMyResults();
}

async function submitResult() {
  if (submitted || submitInFlight) return;
  submitInFlight = true;
  const score = computeScore();
  const answers = QUESTIONS.map((q, i) => ({
    q: q.q,
    opts: q.opts,
    correct: q.a,
    selected: selected[i],
    image: q.image || null,
  }));
  const { ok, status, data } = await apiPost('/api/results', {
    testId,
    score,
    total: QUESTIONS.length,
    answers,
  });
  submitInFlight = false;

  if (ok && data.resultId) {
    submitted = true;
    submitErr.hidden = true;
    if (reviewEnabled) {
      reviewLink.href = `/rezultati/${data.resultId}`;
      reviewLink.hidden = false;
    }
    return;
  }

  submitErr.hidden = false;
  if (status === 401) {
    // Session expired mid-test: log in in a new tab, then retry here so the
    // answers on this page aren't lost.
    submitErr.innerHTML = 'Rezultātu neizdevās saglabāt — sesija beigusies. <a href="/" target="_blank">Pieslēdzies jaunā cilnē</a>, tad <button type="button" id="retrySubmitBtn" class="hint">mēģini vēlreiz</button>.';
    document.getElementById('retrySubmitBtn').addEventListener('click', submitResult);
  } else {
    submitErr.innerHTML = `Rezultātu neizdevās saglabāt (${data.error || 'servera kļūda'}). <button type="button" id="retrySubmitBtn" class="hint">Mēģināt vēlreiz</button>`;
    document.getElementById('retrySubmitBtn').addEventListener('click', submitResult);
  }
}

async function loadMyResults() {
  const { ok, data } = await apiGet('/api/my-results');
  leaderboardEl.innerHTML = '';
  const mine = ok ? data.filter((r) => r.testId === testId) : [];
  if (!mine.length) {
    leaderboardEl.innerHTML = '<p class="empty">Vēl nav rezultātu.</p>';
    return;
  }
  mine.slice(0, 15).forEach((r) => {
    const date = new Date(r.createdAt.replace(' ', 'T') + 'Z');
    const dateStr = date.toLocaleString('lv-LV', { dateStyle: 'medium', timeStyle: 'short' });
    const row = document.createElement(reviewEnabled ? 'a' : 'div');
    if (reviewEnabled) row.href = `/rezultati/${r.id}`;
    row.className = 'lb-row';
    row.innerHTML = `
      <span class="lb-name mono">${dateStr}</span>
      <span class="lb-score mono">${r.score}/${r.total}</span>
    `;
    leaderboardEl.appendChild(row);
  });
}

function resetQuiz(freshOrder) {
  if (freshOrder) QUESTIONS = shuffle(QUESTIONS);
  current = 0;
  selected = new Array(QUESTIONS.length).fill(null);
  submitted = false;
  submitInFlight = false;
  submitErr.hidden = true;
  reviewLink.hidden = true;
  quizBody.classList.remove('hide');
  resultEl.classList.remove('show');
  buildPorts();
  renderQuestion();
}

prevBtn.addEventListener('click', goPrev);
nextBtn.addEventListener('click', goNext);
retryBtn.addEventListener('click', () => resetQuiz(true));

(async function init() {
  const me = await getMe();
  if (!me) {
    goToLogin();
    return;
  }
  playerNameEl.textContent = me.name;

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
  reviewEnabled = !!data.reviewEnabled;
  answerType = data.answerType || 'buttons';
  QUESTIONS = shuffle(data.questions);
  resetQuiz(false);
})();
