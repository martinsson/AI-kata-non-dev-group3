const STORAGE_KEY = 'team-absences-v1';
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

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

    const th1 = document.createElement('th');
    th1.className = 'day-col';
    if (isWeekend) th1.classList.add('weekend');
    if (isToday) th1.classList.add('today');
    th1.textContent = day;
    headRow1.appendChild(th1);

    const th2 = document.createElement('th');
    th2.className = 'day-col day-letter';
    if (isWeekend) th2.classList.add('weekend');
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
        const abs = state.absences.find(
          a => a.person === person && iso >= a.start && iso <= a.end,
        );

        const td = document.createElement('td');
        td.className = 'day-cell';
        if (isWeekend) td.classList.add('weekend');
        if (isToday) td.classList.add('today');
        if (abs) {
          td.classList.add('absent');
          td.style.setProperty('--person-fill', color.fill);
          td.style.setProperty('--person-bg', color.bg);
          td.title = `${person} : du ${formatDateFr(abs.start)} au ${formatDateFr(abs.end)}`;
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
