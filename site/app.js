const STORAGE_KEY = 'team-absences-v1';
const USER_KEY = 'team-absences-user-v1';
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DB_NAME = 'absences-db';
const DB_STORE = 'handles';
const HANDLE_KEY = 'shared-file';

const fsApiAvailable = 'showOpenFilePicker' in window;

const state = {
  absences: load(),
  currentUser: localStorage.getItem(USER_KEY) || '',
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  fileHandle: null,
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.absences));
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function dbSet(key, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function dbDelete(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function verifyPermission(handle, mode = 'readwrite') {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return 'granted';
  return 'prompt';
}

async function requestPermission(handle, mode = 'readwrite') {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function readFromFile() {
  const file = await state.fileHandle.getFile();
  const text = await file.text();
  if (!text.trim()) return [];
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.absences)) return parsed.absences;
  return [];
}

async function writeToFile(absences) {
  const writable = await state.fileHandle.createWritable();
  await writable.write(JSON.stringify({ absences }, null, 2));
  await writable.close();
}

async function syncFromFile() {
  if (!state.fileHandle) return;
  try {
    state.absences = await readFromFile();
    state.absences.sort((a, b) => a.start.localeCompare(b.start));
    render();
    updateDataStatus('connected');
  } catch (err) {
    console.error('Erreur de lecture du fichier partagé', err);
    updateDataStatus('error', err.message);
  }
}

function updateDataStatus(status, detail = '') {
  const statusText = document.getElementById('data-status-text');
  const statusDetail = document.getElementById('data-status-detail');
  const connectBtn = document.getElementById('connect-file');
  const createBtn = document.getElementById('create-file');
  const grantBtn = document.getElementById('grant-permission');
  const refreshBtn = document.getElementById('refresh-file');
  const disconnectBtn = document.getElementById('disconnect-file');
  const card = document.querySelector('.data-source-card');

  [connectBtn, createBtn, grantBtn, refreshBtn, disconnectBtn].forEach(b => b.hidden = true);
  card.classList.remove('status-local', 'status-connected', 'status-prompt', 'status-error', 'status-unsupported');

  if (status === 'unsupported') {
    statusText.textContent = '⚠ Navigateur non compatible — données locales uniquement';
    statusDetail.textContent = 'Utilisez Chrome ou Edge pour partager un fichier sur le réseau.';
    card.classList.add('status-unsupported');
  } else if (status === 'local') {
    statusText.textContent = 'Données stockées dans ce navigateur uniquement';
    statusDetail.textContent = 'Pour partager avec votre équipe, connectez un fichier sur un emplacement réseau.';
    connectBtn.hidden = false;
    createBtn.hidden = false;
    card.classList.add('status-local');
  } else if (status === 'prompt') {
    const name = state.fileHandle ? state.fileHandle.name : '';
    statusText.textContent = `Fichier en attente de permission : ${name}`;
    statusDetail.textContent = '';
    grantBtn.hidden = false;
    disconnectBtn.hidden = false;
    card.classList.add('status-prompt');
  } else if (status === 'connected') {
    const name = state.fileHandle ? state.fileHandle.name : '';
    statusText.textContent = `✓ Connecté à ${name}`;
    statusDetail.textContent = 'Les absences sont partagées avec votre équipe.';
    refreshBtn.hidden = false;
    disconnectBtn.hidden = false;
    card.classList.add('status-connected');
  } else if (status === 'error') {
    statusText.textContent = '⚠ Erreur d\'accès au fichier';
    statusDetail.textContent = detail || '';
    connectBtn.hidden = false;
    disconnectBtn.hidden = false;
    card.classList.add('status-error');
  }
}

async function connectFile(create = false) {
  try {
    let handle;
    if (create) {
      handle = await window.showSaveFilePicker({
        suggestedName: 'absences.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
    } else {
      const [h] = await window.showOpenFilePicker({
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      handle = h;
    }
    state.fileHandle = handle;
    await dbSet(HANDLE_KEY, handle);
    if (create) {
      await writeToFile(state.absences);
    } else {
      await syncFromFile();
    }
    updateDataStatus('connected');
  } catch (err) {
    if (err.name !== 'AbortError') console.error(err);
  }
}

async function disconnectFile() {
  state.fileHandle = null;
  await dbDelete(HANDLE_KEY);
  state.absences = load();
  render();
  updateDataStatus('local');
}

async function restoreFileHandle() {
  if (!fsApiAvailable) {
    updateDataStatus('unsupported');
    return;
  }
  let handle;
  try {
    handle = await dbGet(HANDLE_KEY);
  } catch {
    updateDataStatus('local');
    return;
  }
  if (!handle) {
    updateDataStatus('local');
    return;
  }
  state.fileHandle = handle;
  const perm = await verifyPermission(handle);
  if (perm === 'granted') {
    await syncFromFile();
  } else {
    updateDataStatus('prompt');
  }
}

function saveUser(name) {
  state.currentUser = name.trim();
  localStorage.setItem(USER_KEY, state.currentUser);
  renderUserIdentity();
  document.getElementById('person').value = state.currentUser;
}

function renderUserIdentity() {
  const identity = document.getElementById('user-identity');
  const setup = document.getElementById('user-setup');
  const greeting = document.getElementById('user-greeting');
  if (state.currentUser) {
    greeting.textContent = `Connecté en tant que ${state.currentUser}`;
    identity.hidden = false;
    setup.hidden = true;
    document.getElementById('person').value = state.currentUser;
  } else {
    identity.hidden = true;
    setup.hidden = false;
    document.getElementById('user-name-input').focus();
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function jeuneGenevois(year) {
  const sept1 = new Date(year, 8, 1);
  const firstSunday = 1 + ((7 - sept1.getDay()) % 7);
  return new Date(year, 8, firstSunday + 4);
}

const holidayCache = {};

function holidaysForYear(year) {
  if (holidayCache[year]) return holidayCache[year];
  const easter = easterSunday(year);
  const map = {};
  const add = (d, name) => { map[isoDate(d)] = name; };
  add(new Date(year, 0, 1), 'Nouvel An');
  add(addDays(easter, -2), 'Vendredi saint');
  add(addDays(easter, 1), 'Lundi de Pâques');
  add(new Date(year, 4, 1), 'Fête du Travail');
  add(addDays(easter, 39), 'Ascension');
  add(addDays(easter, 50), 'Lundi de Pentecôte');
  add(new Date(year, 7, 1), 'Fête nationale');
  add(jeuneGenevois(year), 'Jeûne genevois');
  add(new Date(year, 11, 25), 'Noël');
  add(new Date(year, 11, 31), 'Restauration de la République');
  holidayCache[year] = map;
  return map;
}

function holidayName(iso) {
  const year = Number(iso.slice(0, 4));
  return holidaysForYear(year)[iso] || null;
}

function colorForPerson(name) {
  const key = name.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return {
    bg: `hsl(${hue} 70% 88%)`,
    fill: `hsl(${hue} 65% 55%)`,
    text: `hsl(${hue} 60% 28%)`,
    border: `hsl(${hue} 50% 70%)`,
  };
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateFr(s) {
  return parseISO(s).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

async function addAbsence(person, start, end) {
  const newAbs = { id: uid(), person: person.trim(), start, end };
  if (state.fileHandle) {
    try {
      const remote = await readFromFile();
      const merged = [...remote, newAbs].sort((a, b) => a.start.localeCompare(b.start));
      await writeToFile(merged);
      state.absences = merged;
    } catch (err) {
      console.error('Erreur d\'écriture', err);
      updateDataStatus('error', err.message);
      return;
    }
  } else {
    state.absences.push(newAbs);
    state.absences.sort((a, b) => a.start.localeCompare(b.start));
    save();
  }
  render();
}

async function deleteAbsence(id) {
  if (state.fileHandle) {
    try {
      const remote = await readFromFile();
      state.absences = remote.filter(a => a.id !== id);
      await writeToFile(state.absences);
    } catch (err) {
      console.error('Erreur d\'écriture', err);
      updateDataStatus('error', err.message);
      return;
    }
  } else {
    state.absences = state.absences.filter(a => a.id !== id);
    save();
  }
  render();
}

function absencesForDay(isoDay) {
  return state.absences.filter(a => isoDay >= a.start && isoDay <= a.end);
}

function uniquePeople() {
  const set = new Set(state.absences.map(a => a.person));
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
}

function renderCalendar() {
  const cal = document.getElementById('calendar');
  const label = document.getElementById('month-label');
  cal.innerHTML = '';

  const first = new Date(state.viewYear, state.viewMonth, 1);
  label.textContent = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
  const todayIso = isoDate(new Date());
  const people = uniquePeople();

  const table = document.createElement('table');
  table.className = 'absence-table';

  const thead = document.createElement('thead');
  const headRow1 = document.createElement('tr');
  const cornerTh = document.createElement('th');
  cornerTh.className = 'person-col';
  cornerTh.textContent = 'Personne';
  cornerTh.rowSpan = 2;
  headRow1.appendChild(cornerTh);

  const headRow2 = document.createElement('tr');

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(state.viewYear, state.viewMonth, day);
    const iso = isoDate(d);
    const wd = d.getDay();
    const isWeekend = wd === 0 || wd === 6;
    const isToday = iso === todayIso;
    const holiday = holidayName(iso);

    const th1 = document.createElement('th');
    th1.className = 'day-col';
    if (isWeekend) th1.classList.add('weekend');
    if (holiday) {
      th1.classList.add('holiday');
      th1.title = holiday;
    }
    if (isToday) th1.classList.add('today');
    th1.textContent = day;
    headRow1.appendChild(th1);

    const th2 = document.createElement('th');
    th2.className = 'day-col day-letter';
    if (isWeekend) th2.classList.add('weekend');
    if (holiday) {
      th2.classList.add('holiday');
      th2.title = holiday;
    }
    if (isToday) th2.classList.add('today');
    th2.textContent = DAY_LETTERS[wd];
    headRow2.appendChild(th2);
  }

  thead.appendChild(headRow1);
  thead.appendChild(headRow2);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  if (people.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = daysInMonth + 1;
    td.className = 'empty-row';
    td.textContent = 'Aucune personne — saisissez une absence pour commencer.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    for (const person of people) {
      const color = colorForPerson(person);
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.className = 'person-col';
      const dot = document.createElement('span');
      dot.className = 'person-dot';
      dot.style.background = color.fill;
      nameTd.appendChild(dot);
      nameTd.appendChild(document.createTextNode(person));
      tr.appendChild(nameTd);

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(state.viewYear, state.viewMonth, day);
        const iso = isoDate(d);
        const wd = d.getDay();
        const isWeekend = wd === 0 || wd === 6;
        const isToday = iso === todayIso;
        const holiday = holidayName(iso);
        const abs = state.absences.find(
          a => a.person === person && iso >= a.start && iso <= a.end,
        );

        const td = document.createElement('td');
        td.className = 'day-cell';
        if (isWeekend) td.classList.add('weekend');
        if (holiday) td.classList.add('holiday');
        if (isToday) td.classList.add('today');
        if (abs) {
          td.classList.add('absent');
          td.style.setProperty('--person-fill', color.fill);
          td.style.setProperty('--person-bg', color.bg);
          td.title = `${person} : du ${formatDateFr(abs.start)} au ${formatDateFr(abs.end)}`;
        } else if (holiday) {
          td.title = holiday;
        }
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
  }

  table.appendChild(tbody);
  cal.appendChild(table);
}

function renderList() {
  const ul = document.getElementById('absence-list');
  ul.innerHTML = '';

  if (state.absences.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Aucune absence enregistrée.';
    ul.appendChild(li);
    return;
  }

  for (const abs of state.absences) {
    const color = colorForPerson(abs.person);
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'person-dot';
    dot.style.background = color.fill;
    const span = document.createElement('span');
    span.className = 'absence-label';
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = abs.person;
    nameStrong.style.color = color.text;
    span.appendChild(nameStrong);
    span.appendChild(document.createTextNode(` — du ${formatDateFr(abs.start)} au ${formatDateFr(abs.end)}`));
    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.textContent = 'Supprimer';
    btn.addEventListener('click', () => deleteAbsence(abs.id));
    li.appendChild(dot);
    li.appendChild(span);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function render() {
  renderCalendar();
  renderList();
}

document.getElementById('save-user').addEventListener('click', () => {
  const name = document.getElementById('user-name-input').value.trim();
  if (!name) return;
  saveUser(name);
});

document.getElementById('user-name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('save-user').click();
});

document.getElementById('change-user').addEventListener('click', () => {
  state.currentUser = '';
  localStorage.removeItem(USER_KEY);
  renderUserIdentity();
});

document.getElementById('absence-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const person = document.getElementById('person').value;
  const start = document.getElementById('start').value;
  const end = document.getElementById('end').value;
  const err = document.getElementById('form-error');

  if (!person.trim() || !start || !end) return;
  if (end < start) {
    err.textContent = 'La date de fin doit être postérieure ou égale à la date de début.';
    err.hidden = false;
    return;
  }
  err.hidden = true;

  await addAbsence(person, start, end);
  e.target.reset();
  if (state.currentUser) document.getElementById('person').value = state.currentUser;
  document.getElementById('start').focus();
});

document.getElementById('connect-file').addEventListener('click', () => connectFile(false));
document.getElementById('create-file').addEventListener('click', () => connectFile(true));
document.getElementById('refresh-file').addEventListener('click', () => syncFromFile());
document.getElementById('disconnect-file').addEventListener('click', () => disconnectFile());
document.getElementById('grant-permission').addEventListener('click', async () => {
  if (!state.fileHandle) return;
  const ok = await requestPermission(state.fileHandle);
  if (ok) await syncFromFile();
});

window.addEventListener('focus', () => {
  if (state.fileHandle) syncFromFile();
});

document.getElementById('start').addEventListener('change', (e) => {
  const end = document.getElementById('end');
  if (!end.value || end.value < e.target.value) {
    end.value = e.target.value;
  }
});

document.getElementById('prev-month').addEventListener('click', () => {
  if (state.viewMonth === 0) {
    state.viewMonth = 11;
    state.viewYear--;
  } else {
    state.viewMonth--;
  }
  renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
  if (state.viewMonth === 11) {
    state.viewMonth = 0;
    state.viewYear++;
  } else {
    state.viewMonth++;
  }
  renderCalendar();
});

document.getElementById('today').addEventListener('click', () => {
  const now = new Date();
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  renderCalendar();
});

renderUserIdentity();
render();
restoreFileHandle();
