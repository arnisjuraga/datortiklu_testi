const resultId = location.pathname.split('/').filter(Boolean)[1];

const revTitle = document.getElementById('revTitle');
const revScore = document.getElementById('revScore');
const revMeta = document.getElementById('revMeta');
const revBody = document.getElementById('revBody');

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

  const opts = document.createElement('div');
  opts.className = 'opts';
  item.opts.forEach((optText, i) => {
    const div = document.createElement('div');
    div.className = 'opt';
    div.style.cursor = 'default';
    if (i === item.correct) div.classList.add('right');
    if (i === item.selected && item.selected !== item.correct) div.classList.add('miss');
    div.innerHTML = `<span class="tag-letter">${letters[i]}</span><span>${optText}</span>`;
    opts.appendChild(div);
  });

  card.appendChild(meta);
  card.appendChild(qtext);
  card.appendChild(opts);
  return card;
}

(async function init() {
  const { ok, data } = await apiGet(`/api/results/detail/${resultId}`);
  if (!ok) {
    revBody.innerHTML = `<div class="card"><p class="empty">${data.error || 'Rezultāts nav atrasts.'}</p></div>`;
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
