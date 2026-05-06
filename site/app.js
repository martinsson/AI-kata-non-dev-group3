const STORAGE_KEY = 'team-absences-v1';
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const state = {
  absences: load(),
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
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

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

function addAbsence(person, start, end) {
  state.absences.push({ id: uid(), person: person.trim(), start, end });
  state.absences.sort((a, b) => a.start.localeCompare(b.start));
  save();
  render();
}

function deleteAbsence(id) {
  state.absences = state.absences.filter(a => a.id !== id);
  save();
  render();
}

function absencesForDay(isoDay) {
  return state.absences.filter(a => isoDay >= a.start && isoDay <= a.end);
}

function renderCalendar() {
  const cal = document.getElementById('calendar');
  const label = document.getElementById('month-label');
  cal.innerHTML = '';

  const first = new Date(state.viewYear, state.viewMonth, 1);
  label.textContent = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  for (const name of DAY_NAMES) {
    const el = document.createElement('div');
    el.className = 'day-name';
    el.textContent = name;
    cal.appendChild(el);
  }

  const startWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(state.viewYear, state.viewMonth, 1 - startWeekday);
  const todayIso = isoDate(new Date());

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = isoDate(d);

    const cell = document.createElement('div');
    cell.className = 'day';
    if (d.getMonth() !== state.viewMonth) cell.classList.add('other-month');
    const wd = d.getDay();
    if (wd === 0 || wd === 6) cell.classList.add('weekend');
    if (iso === todayIso) cell.classList.add('today');

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = d.getDate();
    cell.appendChild(num);

    for (const abs of absencesForDay(iso)) {
      const pill = document.createElement('div');
      pill.className = 'absence-pill';
      pill.textContent = abs.person;
      pill.title = `${abs.person} (${formatDateFr(abs.start)} → ${formatDateFr(abs.end)})`;
      cell.appendChild(pill);
    }

    cal.appendChild(cell);
  }
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
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${abs.person} — du ${formatDateFr(abs.start)} au ${formatDateFr(abs.end)}`;
    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.textContent = 'Supprimer';
    btn.addEventListener('click', () => deleteAbsence(abs.id));
    li.appendChild(span);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function render() {
  renderCalendar();
  renderList();
}

document.getElementById('absence-form').addEventListener('submit', (e) => {
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

  addAbsence(person, start, end);
  e.target.reset();
  document.getElementById('person').focus();
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

render();
