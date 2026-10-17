// File upload page (/upload). Its own password, separate from admin: kept in
// sessionStorage (same tab only) and sent as a header on every call.
const PW_KEY = 'dt_upload_pw';

function getPw() {
  try { return sessionStorage.getItem(PW_KEY) || ''; } catch { return ''; }
}
function setPw(pw) {
  try { sessionStorage.setItem(PW_KEY, pw); } catch { /* ignore */ }
}
function clearPw() {
  try { sessionStorage.removeItem(PW_KEY); } catch { /* ignore */ }
}

async function uploadGet(url) {
  const res = await fetch(url, { headers: { 'x-upload-password': getPw() } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
async function uploadPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-upload-password': getPw() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const loginCard = document.getElementById('loginCard');
const uploadBody = document.getElementById('uploadBody');
const loginForm = document.getElementById('loginForm');
const pwInput = document.getElementById('pwInput');
const loginBtn = document.getElementById('loginBtn');
const loginErr = document.getElementById('loginErr');
const logoutBtn = document.getElementById('logoutBtn');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const folderBtn = document.getElementById('folderBtn');
const uploadStatus = document.getElementById('uploadStatus');
const fileList = document.getElementById('fileList');

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderFiles(files) {
  fileList.innerHTML = '';
  if (!files.length) {
    fileList.innerHTML = '<p class="empty">Vēl nav augšupielādētu failu.</p>';
    return;
  }
  files.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'test-item';
    row.innerHTML = `
      <div>
        <h3 class="file-name" style="font-size:1rem;"></h3>
        <p class="mono"></p>
      </div>
      <span style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" class="hint download-btn">Lejupielādēt</button>
        <button type="button" class="hint delete-btn">Dzēst</button>
      </span>
    `;
    row.querySelector('h3').textContent = f.name;
    row.querySelector('p').textContent = `${formatSize(f.size)} · ${f.createdAt}`;

    // Download goes through fetch so the admin password header is sent.
    row.querySelector('.download-btn').addEventListener('click', async () => {
      const res = await fetch(`/api/upload/files/${f.id}`, { headers: { 'x-upload-password': getPw() } });
      if (!res.ok) {
        alert('Neizdevās lejupielādēt failu.');
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name.split('/').pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    row.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm(`Dzēst failu "${f.name}"?`)) return;
      const { ok, data } = await uploadPost(`/api/upload/files/${f.id}/delete`, {});
      if (!ok) {
        alert(data.error || 'Kļūda.');
        return;
      }
      loadFiles();
    });

    fileList.appendChild(row);
  });
}

async function loadFiles() {
  const { ok, status, data } = await uploadGet('/api/upload/files');
  if (status === 401) {
    clearPw();
    showLogin('Sesija beigusies. Ievadi paroli vēlreiz.');
    return;
  }
  if (ok) renderFiles(data);
}

// Each item is { file, path }; path includes the folder for folder uploads.
async function uploadOne({ file, path }) {
  const res = await fetch('/api/upload/files', {
    method: 'POST',
    headers: {
      'x-upload-password': getPw(),
      'x-file-name': encodeURIComponent(path),
      'x-file-type': file.type,
      'Content-Type': 'application/octet-stream',
    },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Files go up one at a time, each with its own status line.
async function uploadFiles(items) {
  uploadStatus.innerHTML = '';
  if (!items.length) {
    uploadStatus.innerHTML = '<p class="empty">Nav atrasts neviens fails.</p>';
    return;
  }
  for (const item of items) {
    const line = document.createElement('div');
    line.className = 'hint file-name';
    line.textContent = `${item.path} — augšupielādē…`;
    uploadStatus.appendChild(line);

    const result = await uploadOne(item).catch(() => ({ ok: false, data: { error: 'Tīkla kļūda.' } }));
    line.textContent = `${item.path} — ${result.ok ? 'augšupielādēts' : result.data.error || 'kļūda'}`;
    line.classList.add(result.ok ? 'upload-ok' : 'upload-err');
  }
  fileInput.value = '';
  folderInput.value = '';
  loadFiles();
}

// Walks a dropped folder (FileSystemEntry API) and returns all files in it,
// subfolders included, with their path relative to the dropped item.
async function entryFiles(entry) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    return [{ file, path: entry.fullPath.replace(/^\//, '') }];
  }
  const reader = entry.createReader();
  const children = [];
  // readEntries returns results in batches; keep reading until empty.
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    children.push(...batch);
  }
  const nested = await Promise.all(children.map(entryFiles));
  return nested.flat();
}

async function droppedItems(dataTransfer) {
  // Entries must be taken synchronously, before the first await.
  const entries = [...dataTransfer.items]
    .map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null))
    .filter(Boolean);
  if (!entries.length) return [...dataTransfer.files].map((file) => ({ file, path: file.name }));
  const nested = await Promise.all(entries.map((e) => entryFiles(e).catch(() => [])));
  return nested.flat();
}

fileInput.addEventListener('change', () => uploadFiles([...fileInput.files].map((file) => ({ file, path: file.name }))));
folderBtn.addEventListener('click', () => folderInput.click());
folderInput.addEventListener('change', () => uploadFiles(
  [...folderInput.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }))
));
['dragenter', 'dragover'].forEach((ev) => dropZone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropZone.classList.add('over');
}));
['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropZone.classList.remove('over');
}));
dropZone.addEventListener('drop', async (e) => uploadFiles(await droppedItems(e.dataTransfer)));

function showLogin(err) {
  loginCard.hidden = false;
  uploadBody.hidden = true;
  loginErr.textContent = err || '';
  pwInput.value = '';
  pwInput.focus();
}

function showFiles() {
  loginCard.hidden = true;
  uploadBody.hidden = false;
  uploadStatus.innerHTML = '';
  loadFiles();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  setPw(pwInput.value);
  const { ok, data } = await uploadPost('/api/upload/login', {});
  loginBtn.disabled = false;

  if (!ok) {
    clearPw();
    loginErr.textContent = data.error || 'Kļūda.';
    return;
  }
  showFiles();
});

logoutBtn.addEventListener('click', () => {
  clearPw();
  showLogin();
});

(function init() {
  if (getPw()) {
    showFiles();
  } else {
    showLogin();
  }
})();
