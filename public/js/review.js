const resultId = location.pathname.split('/').filter(Boolean)[1];

const revTitle = document.getElementById('revTitle');
const revScore = document.getElementById('revScore');
const revMeta = document.getElementById('revMeta');
const revBody = document.getElementById('revBody');
const adminBackLink = document.getElementById('adminBackLink');

try {
  if (sessionStorage.getItem('dt_admin_pw')) adminBackLink.hidden = false;
} catch { /* ignore */ }

// Coming from the results list: go back to it with its filters intact.
try {
  const ref = new URL(document.referrer);
  if (ref.origin === location.origin && ref.pathname === '/admin/rezultati') {
    adminBackLink.href = ref.pathname + ref.search;
  }
} catch { /* no referrer */ }

const letters = ['A', 'B', 'C', 'D'];

function renderQuestionCard(item, index) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginBottom = '12px';

  const meta = document.createElement('div');
  meta.className = 'qmeta';
  meta.style.marginBottom = '14px';
  const noAnswer = item.selected === null || item.selected === undefined;
  const isRight = !noAnswer && item.selected === item.correct;
  meta.innerHTML = `
    <span class="mono">JAUTĀJUMS ${String(index + 1).padStart(2, '0')}</span>
    <span class="mono" style="color:${noAnswer ? 'var(--muted)' : isRight ? 'var(--success)' : 'var(--error)'}">
      ${noAnswer ? 'NAV ATBILDĒTS' : isRight ? 'PAREIZI' : 'NEPAREIZI'}
    </span>
  `;

  const qtext = document.createElement('div');
  qtext.className = 'qtext';
  qtext.style.marginBottom = '14px';
  qtext.textContent = item.q;

  card.appendChild(meta);

  if (item.image) {
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = '';
    img.style.cssText = 'display:block;max-width:220px;margin:0 auto 16px;background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:16px;';
    card.appendChild(img);
  }

  card.appendChild(qtext);

  if (item.image) {
    const summary = document.createElement('div');
    summary.className = 'opts';
    if (!noAnswer) {
      const line = document.createElement('div');
      line.className = 'opt ' + (isRight ? 'right' : 'miss');
      line.innerHTML = `<span>Tava atbilde:</span><span class="opt-hint mono">${item.opts[item.selected]}</span>`;
      summary.appendChild(line);
    }
    if (noAnswer || !isRight) {
      const line2 = document.createElement('div');
      line2.className = 'opt correct-hint';
      line2.innerHTML = `<span>Pareizā atbilde:</span><span class="opt-hint mono">${item.opts[item.correct]}</span>`;
      summary.appendChild(line2);
    }
    card.appendChild(summary);
    return card;
  }

  const opts = document.createElement('div');
  opts.className = 'opts';
  item.opts.forEach((optText, i) => {
    const div = document.createElement('div');
    div.className = 'opt';
    div.style.cursor = 'default';
    const isCorrect = i === item.correct;
    const isPicked = i === item.selected;
    let hint = '';

    if (isPicked && isCorrect) {
      div.classList.add('right');
      hint = '✓ tava atbilde';
    } else if (isPicked && !isCorrect) {
      div.classList.add('miss');
      hint = '✗ tava atbilde';
    } else if (isCorrect) {
      div.classList.add('correct-hint');
      hint = 'pareizā atbilde';
    }

    div.innerHTML = `
      <span class="tag-letter">${letters[i]}</span><span>${optText}</span>
      ${hint ? `<span class="opt-hint mono">${hint}</span>` : ''}
    `;
    opts.appendChild(div);
  });

  card.appendChild(opts);
  return card;
}

(async function init() {
  const { ok, data } = await apiGetAuthed(`/api/results/detail/${resultId}`);
  if (!ok) {
    revBody.innerHTML = `<div class="card"><p class="empty">${data.error || 'Šī atbilžu apskate nav pieejama.'}</p></div>`;
    return;
  }

  revTitle.textContent = data.testTitle;
  revScore.textContent = `${data.score}/${data.total}`;
  const date = new Date(data.createdAt.replace(' ', 'T') + 'Z');
  revMeta.innerHTML = `<b>${data.name}</b> · ${date.toLocaleString('lv-LV', { dateStyle: 'medium', timeStyle: 'short' })}`;

  if (!data.answers) {
    revBody.innerHTML = '<div class="card"><p class="empty">Šim rezultātam nav saglabātas atbilžu detaļas.</p></div>';
    return;
  }

  revBody.innerHTML = '';
  data.answers.forEach((item, i) => revBody.appendChild(renderQuestionCard(item, i)));
})();
