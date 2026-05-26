(() => {
  'use strict';

  const KEY = 'servicedesk-v1';

  // ── Default seed data ──────────────────────────────────
  const seed = () => ({
    tasks: [
      { id: uid(), number: 'TK-001', title: 'Mettre à jour les certificats SSL', assignee: 'Alice Martin', priority: 'critical', status: 'open',     due: '2026-06-01', description: 'Les certificats expirent dans 5 jours.' },
      { id: uid(), number: 'TK-002', title: 'Migrer la base de données vers PostgreSQL 16', assignee: 'Bob Dupont', priority: 'high', status: 'progress', due: '2026-06-15', description: '' },
      { id: uid(), number: 'TK-003', title: 'Revue du code de sécurité', assignee: 'Claire Leroy', priority: 'high', status: 'open', due: '2026-06-10', description: '' },
      { id: uid(), number: 'TK-004', title: 'Documenter l\'API REST v2', assignee: 'David Petit', priority: 'medium', status: 'progress', due: '2026-06-20', description: '' },
      { id: uid(), number: 'TK-005', title: 'Corriger bug formulaire contact', assignee: 'Alice Martin', priority: 'low', status: 'done', due: '2026-05-20', description: '' },
    ],
    notifications: [
      { id: uid(), title: 'Déploiement réussi', description: 'La version 2.4.1 a été déployée en production avec succès.', type: 'success', read: false, date: isoNow(-2) },
      { id: uid(), title: 'Alerte de performance', description: 'Le temps de réponse moyen dépasse 800ms sur l\'API /users.', type: 'warning', read: false, date: isoNow(-5) },
      { id: uid(), title: 'Nouvelle tâche assignée', description: 'La tâche TK-003 vous a été assignée par l\'administrateur.', type: 'info', read: true, date: isoNow(-60) },
      { id: uid(), title: 'Sauvegarde échouée', description: 'La sauvegarde nocturne du serveur DB-02 a échoué.', type: 'error', read: false, date: isoNow(-90) },
    ],
    alerts: [
      { id: uid(), message: 'Espace disque critique sur /srv/data (95% utilisé)', source: 'Serveur DB-01', severity: 'critical', active: true,  date: isoNow(-10) },
      { id: uid(), message: 'CPU élevé sur le serveur web WEB-03', source: 'Serveur WEB-03', severity: 'warning', active: true,  date: isoNow(-30) },
      { id: uid(), message: 'Nouvelle mise à jour de sécurité disponible', source: 'Système', severity: 'info',    active: true,  date: isoNow(-120) },
      { id: uid(), message: 'Tentatives de connexion échouées répétées', source: 'Firewall', severity: 'critical', active: false, date: isoNow(-240) },
    ],
    _taskCounter: 6,
  });

  function isoNow(offsetMinutes = 0) {
    return new Date(Date.now() + offsetMinutes * 60000).toISOString();
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── State ──────────────────────────────────────────────
  let state = load();
  let currentView = 'dashboard';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return seed();
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  // ── Routing ────────────────────────────────────────────
  function setView(name) {
    currentView = name;
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.view === name)
    );
    render();
    updateCounters();
  }

  // ── Render dispatcher ──────────────────────────────────
  function render() {
    const app = document.getElementById('app');
    const tpl = document.getElementById(`tpl-${currentView}`);
    if (!tpl) return;
    app.innerHTML = '';
    app.appendChild(tpl.content.cloneNode(true));

    app.querySelectorAll('[data-view-link]').forEach(el =>
      el.addEventListener('click', () => setView(el.dataset.viewLink))
    );

    ({ dashboard: renderDashboard, tasks: renderTasks,
       notifications: renderNotifications, alerts: renderAlerts }
    )[currentView]?.();
  }

  // ── Dashboard ──────────────────────────────────────────
  function renderDashboard() {
    const openTasks = state.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
    const doneTasks = state.tasks.filter(t => t.status === 'done');
    const activeAlerts = state.alerts.filter(a => a.active);
    const unreadNotifs = state.notifications.filter(n => !n.read);

    setStat('totalTasks',    state.tasks.length);
    setStat('openTasks',     openTasks.length);
    setStat('doneTasks',     doneTasks.length);
    setStat('activeAlerts',  activeAlerts.length);
    setStat('unreadNotifs',  unreadNotifs.length);

    // Recent tasks
    const tbody = document.getElementById('dash-tasks-body');
    const recent = [...state.tasks].sort((a, b) => (b.date||'').localeCompare(a.date||'')).slice(0, 5);
    tbody.innerHTML = !recent.length
      ? `<tr class="empty-row"><td colspan="3">Aucune tâche</td></tr>`
      : recent.map(t => `<tr>
          <td><strong>${esc(t.number)}</strong> ${esc(t.title)}</td>
          <td>${priorityBadge(t.priority)}</td>
          <td>${statusBadge(t.status)}</td>
        </tr>`).join('');

    // Active alerts
    const atbody = document.getElementById('dash-alerts-body');
    const ral = activeAlerts.slice(0, 5);
    atbody.innerHTML = !ral.length
      ? `<tr class="empty-row"><td colspan="3">Aucune alerte active</td></tr>`
      : ral.map(a => `<tr>
          <td>${esc(a.message)}</td>
          <td>${severityBadge(a.severity)}</td>
          <td style="white-space:nowrap;color:var(--sn-text-muted)">${fmtDate(a.date)}</td>
        </tr>`).join('');

    // Recent notifications
    const nlist = document.getElementById('dash-notifs-list');
    const rn = [...state.notifications].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    nlist.innerHTML = !rn.length
      ? `<div style="padding:24px;text-align:center;color:var(--sn-text-muted);font-style:italic">Aucune notification</div>`
      : rn.map(n => notifItemHTML(n, false)).join('');

    nlist.querySelectorAll('[data-mark-read]').forEach(b =>
      b.addEventListener('click', () => { markNotifRead(b.dataset.markRead); renderDashboard(); })
    );
    nlist.querySelectorAll('[data-delete-notif]').forEach(b =>
      b.addEventListener('click', () => { deleteNotif(b.dataset.deleteNotif); renderDashboard(); })
    );
  }

  function setStat(name, val) {
    const el = document.querySelector(`[data-stat="${name}"]`);
    if (el) el.textContent = val;
  }

  // ── Tasks ──────────────────────────────────────────────
  function renderTasks() {
    document.querySelector('[data-action="add-task"]')
      .addEventListener('click', () => openTaskForm());

    const filtersEl = { status: document.querySelector('[data-filter="status"]'),
                        priority: document.querySelector('[data-filter="priority"]') };
    const applyFilters = () => {
      let rows = [...state.tasks];
      if (filtersEl.status.value)   rows = rows.filter(t => t.status   === filtersEl.status.value);
      if (filtersEl.priority.value) rows = rows.filter(t => t.priority === filtersEl.priority.value);
      renderTasksTable(rows);
    };
    Object.values(filtersEl).forEach(el => el.addEventListener('change', applyFilters));
    applyFilters();
  }

  function renderTasksTable(rows) {
    const tbody = document.getElementById('tasks-body');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Aucune tâche trouvée</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(t => `<tr>
      <td style="color:var(--sn-text-muted);white-space:nowrap">${esc(t.number)}</td>
      <td><strong>${esc(t.title)}</strong>${t.description ? `<br><span style="font-size:11px;color:var(--sn-text-muted)">${esc(t.description.slice(0,60))}${t.description.length>60?'…':''}</span>` : ''}</td>
      <td style="white-space:nowrap">${esc(t.assignee || '—')}</td>
      <td>${priorityBadge(t.priority)}</td>
      <td>${statusBadge(t.status)}</td>
      <td style="white-space:nowrap;color:${isDue(t.due)?'var(--sn-danger)':'inherit'}">${fmtDateShort(t.due)}</td>
      <td class="row-actions">
        <button class="btn-icon" data-edit-task="${t.id}" title="Modifier">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" data-del-task="${t.id}" title="Supprimer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>`).join('');

    tbody.querySelectorAll('[data-edit-task]').forEach(b =>
      b.addEventListener('click', () => openTaskForm(b.dataset.editTask)));
    tbody.querySelectorAll('[data-del-task]').forEach(b =>
      b.addEventListener('click', () => { if (confirm('Supprimer cette tâche ?')) { state.tasks = state.tasks.filter(t => t.id !== b.dataset.delTask); save(); render(); } }));
  }

  function openTaskForm(id) {
    const editing = id ? state.tasks.find(t => t.id === id) : null;
    const d = editing || {};
    openModal(editing ? `Modifier ${editing.number}` : 'Nouvelle tâche', `
      <div class="field">
        <label>Titre <span class="req">*</span></label>
        <input type="text" name="title" value="${esc(d.title||'')}" required/>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Assigné à</label>
          <input type="text" name="assignee" value="${esc(d.assignee||'')}"/>
        </div>
        <div class="field">
          <label>Échéance</label>
          <input type="date" name="due" value="${d.due||''}"/>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Priorité <span class="req">*</span></label>
          <select name="priority">
            ${['critical','high','medium','low'].map(v =>
              `<option value="${v}"${(d.priority||'medium')===v?' selected':''}>${priorityLabel(v)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field">
          <label>Statut <span class="req">*</span></label>
          <select name="status">
            ${[['open','Ouverte'],['progress','En cours'],['done','Terminée'],['cancelled','Annulée']].map(([v,l]) =>
              `<option value="${v}"${(d.status||'open')===v?' selected':''}>${l}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea name="description">${esc(d.description||'')}</textarea>
      </div>
    `, () => {
      const f = collectForm();
      if (!f.title.trim()) return alert('Le titre est obligatoire.');
      if (editing) {
        Object.assign(editing, f);
      } else {
        const num = `TK-${String(state._taskCounter++).padStart(3,'0')}`;
        state.tasks.push({ id: uid(), number: num, ...f });
      }
      save(); closeModal(); render(); updateCounters();
    });
  }

  // ── Notifications ──────────────────────────────────────
  function renderNotifications() {
    document.querySelector('[data-action="add-notif"]')
      .addEventListener('click', () => openNotifForm());
    document.querySelector('[data-action="mark-all-read"]')
      .addEventListener('click', () => {
        state.notifications.forEach(n => n.read = true);
        save(); render(); updateCounters();
      });

    const filtersEl = { read: document.querySelector('[data-filter="read"]'),
                        type: document.querySelector('[data-filter="type"]') };
    const applyFilters = () => {
      let rows = [...state.notifications].sort((a, b) => b.date.localeCompare(a.date));
      if (filtersEl.read.value === 'unread') rows = rows.filter(n => !n.read);
      if (filtersEl.read.value === 'read')   rows = rows.filter(n =>  n.read);
      if (filtersEl.type.value) rows = rows.filter(n => n.type === filtersEl.type.value);
      renderNotifList(rows);
    };
    Object.values(filtersEl).forEach(el => el.addEventListener('change', applyFilters));
    applyFilters();
  }

  function renderNotifList(rows) {
    const list = document.getElementById('notifs-list');
    if (!rows.length) {
      list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--sn-text-muted);font-style:italic">Aucune notification</div>`;
      return;
    }
    list.innerHTML = rows.map(n => notifItemHTML(n, true)).join('');

    list.querySelectorAll('[data-mark-read]').forEach(b =>
      b.addEventListener('click', () => { markNotifRead(b.dataset.markRead); render(); updateCounters(); }));
    list.querySelectorAll('[data-delete-notif]').forEach(b =>
      b.addEventListener('click', () => { deleteNotif(b.dataset.deleteNotif); render(); updateCounters(); }));
  }

  function notifItemHTML(n) {
    const typeLabel = { info: 'Information', warning: 'Avertissement', error: 'Erreur', success: 'Succès' }[n.type] || n.type;
    return `<div class="notif-item ${n.read ? '' : 'unread'}">
      <div class="type-stripe ${n.type || 'info'}"></div>
      <div class="notif-dot ${n.read ? 'read' : ''}"></div>
      <div class="notif-body">
        <div class="notif-title">${esc(n.title)}</div>
        <div class="notif-desc">${esc(n.description)}</div>
        <div class="notif-time">${typeLabel} · ${fmtRelative(n.date)}</div>
      </div>
      <div class="notif-actions">
        ${!n.read ? `<button class="btn-icon" data-mark-read="${n.id}" title="Marquer comme lu">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>` : ''}
        <button class="btn-icon danger" data-delete-notif="${n.id}" title="Supprimer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }

  function openNotifForm() {
    openModal('Nouvelle notification', `
      <div class="field">
        <label>Titre <span class="req">*</span></label>
        <input type="text" name="title" required/>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea name="description"></textarea>
      </div>
      <div class="field">
        <label>Type</label>
        <select name="type">
          <option value="info">Info</option>
          <option value="warning">Avertissement</option>
          <option value="error">Erreur</option>
          <option value="success">Succès</option>
        </select>
      </div>
    `, () => {
      const f = collectForm();
      if (!f.title.trim()) return alert('Le titre est obligatoire.');
      state.notifications.unshift({ id: uid(), ...f, read: false, date: new Date().toISOString() });
      save(); closeModal(); render(); updateCounters();
    });
  }

  function markNotifRead(id) {
    const n = state.notifications.find(x => x.id === id);
    if (n) { n.read = true; save(); updateCounters(); }
  }

  function deleteNotif(id) {
    state.notifications = state.notifications.filter(n => n.id !== id);
    save(); updateCounters();
  }

  // ── Alerts ─────────────────────────────────────────────
  function renderAlerts() {
    document.querySelector('[data-action="add-alert"]')
      .addEventListener('click', () => openAlertForm());
    document.querySelector('[data-action="dismiss-all"]')
      .addEventListener('click', () => {
        if (!confirm('Acquitter toutes les alertes actives ?')) return;
        state.alerts.filter(a => a.active).forEach(a => a.active = false);
        save(); render(); updateCounters();
      });

    const filtersEl = {
      severity: document.querySelector('[data-filter="severity"]'),
      active:   document.querySelector('[data-filter="active"]'),
    };
    const applyFilters = () => {
      let rows = [...state.alerts].sort((a, b) => {
        const ord = { critical: 0, warning: 1, info: 2 };
        if (a.active !== b.active) return a.active ? -1 : 1;
        return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3);
      });
      if (filtersEl.severity.value) rows = rows.filter(a => a.severity === filtersEl.severity.value);
      if (filtersEl.active.value !== '') rows = rows.filter(a => String(a.active) === filtersEl.active.value);
      renderAlertsTable(rows);
    };
    Object.values(filtersEl).forEach(el => el.addEventListener('change', applyFilters));
    applyFilters();
  }

  function renderAlertsTable(rows) {
    const tbody = document.getElementById('alerts-body');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Aucune alerte</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(a => `<tr class="alert-row ${a.active ? a.severity : ''}">
      <td><strong>${esc(a.message)}</strong></td>
      <td style="color:var(--sn-text-muted)">${esc(a.source || '—')}</td>
      <td>${severityBadge(a.severity)}</td>
      <td>${a.active
        ? `<span class="badge badge-open">Active</span>`
        : `<span class="badge badge-cancelled">Acquittée</span>`}</td>
      <td style="white-space:nowrap;color:var(--sn-text-muted)">${fmtDate(a.date)}</td>
      <td class="row-actions">
        ${a.active ? `<button class="btn-icon" data-dismiss-alert="${a.id}" title="Acquitter" style="color:var(--sn-success)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>` : ''}
        <button class="btn-icon" data-edit-alert="${a.id}" title="Modifier">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" data-del-alert="${a.id}" title="Supprimer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </td>
    </tr>`).join('');

    tbody.querySelectorAll('[data-dismiss-alert]').forEach(b =>
      b.addEventListener('click', () => {
        const a = state.alerts.find(x => x.id === b.dataset.dismissAlert);
        if (a) { a.active = false; save(); render(); updateCounters(); }
      }));
    tbody.querySelectorAll('[data-edit-alert]').forEach(b =>
      b.addEventListener('click', () => openAlertForm(b.dataset.editAlert)));
    tbody.querySelectorAll('[data-del-alert]').forEach(b =>
      b.addEventListener('click', () => {
        if (!confirm('Supprimer cette alerte ?')) return;
        state.alerts = state.alerts.filter(a => a.id !== b.dataset.delAlert);
        save(); render(); updateCounters();
      }));
  }

  function openAlertForm(id) {
    const editing = id ? state.alerts.find(a => a.id === id) : null;
    const d = editing || {};
    openModal(editing ? 'Modifier l\'alerte' : 'Nouvelle alerte', `
      <div class="field">
        <label>Message <span class="req">*</span></label>
        <input type="text" name="message" value="${esc(d.message||'')}" required/>
      </div>
      <div class="field">
        <label>Source</label>
        <input type="text" name="source" value="${esc(d.source||'')}"/>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Sévérité</label>
          <select name="severity">
            ${[['critical','Critique'],['warning','Avertissement'],['info','Info']].map(([v,l]) =>
              `<option value="${v}"${(d.severity||'info')===v?' selected':''}>${l}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field">
          <label>Statut</label>
          <select name="active">
            <option value="true"${d.active!==false?' selected':''}>Active</option>
            <option value="false"${d.active===false?' selected':''}>Acquittée</option>
          </select>
        </div>
      </div>
    `, () => {
      const f = collectForm();
      if (!f.message.trim()) return alert('Le message est obligatoire.');
      f.active = f.active === 'true';
      if (editing) {
        Object.assign(editing, f);
      } else {
        state.alerts.unshift({ id: uid(), ...f, date: new Date().toISOString() });
      }
      save(); closeModal(); render(); updateCounters();
    });
  }

  // ── Counters ───────────────────────────────────────────
  function updateCounters() {
    const openTasks    = state.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length;
    const unreadNotifs = state.notifications.filter(n => !n.read).length;
    const activeAlerts = state.alerts.filter(a => a.active).length;

    setBadge('nav-tasks-count',  openTasks,    'nav-count');
    setBadge('nav-notif-count',  unreadNotifs, 'nav-count');
    setBadge('nav-alerts-count', activeAlerts, 'nav-count danger');

    const notifDot  = document.getElementById('notif-badge-dot');
    const alertDot  = document.getElementById('alert-badge-dot');
    if (notifDot)  notifDot.style.display  = unreadNotifs > 0 ? '' : 'none';
    if (alertDot)  alertDot.style.display  = activeAlerts > 0 ? '' : 'none';
  }

  function setBadge(id, count, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.className = cls;
    el.style.display = count > 0 ? '' : 'none';
  }

  // ── Modal ──────────────────────────────────────────────
  let _submitCb = null;

  function openModal(title, bodyHTML, onSubmit) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-secondary" id="modal-cancel">Annuler</button>
      <button class="btn btn-primary"   id="modal-submit">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Enregistrer
      </button>`;
    _submitCb = onSubmit;
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-submit').addEventListener('click', () => _submitCb?.());
    document.getElementById('modal').classList.remove('hidden');
    setTimeout(() => document.querySelector('#modal-body input, #modal-body select')?.focus(), 30);
  }

  function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    _submitCb = null;
  }

  function collectForm() {
    const out = {};
    document.querySelectorAll('#modal-body [name]').forEach(el => {
      out[el.name] = el.value;
    });
    return out;
  }

  // ── Helpers ────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
    );
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function fmtDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('fr-FR');
  }

  function fmtRelative(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1)   return 'à l\'instant';
    if (min < 60)  return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24)    return `il y a ${h}h`;
    const days = Math.floor(h / 24);
    return `il y a ${days}j`;
  }

  function isDue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  function priorityBadge(p) {
    const map = { critical: ['badge-critical','Critique'], high: ['badge-high','Haute'],
                  medium: ['badge-medium','Moyenne'], low: ['badge-low','Basse'] };
    const [cls, label] = map[p] || ['badge-medium', p];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function priorityLabel(p) {
    return { critical:'Critique', high:'Haute', medium:'Moyenne', low:'Basse' }[p] || p;
  }

  function statusBadge(s) {
    const map = {
      open:      ['badge-open',     'Ouverte'],
      progress:  ['badge-progress', 'En cours'],
      done:      ['badge-done',     'Terminée'],
      cancelled: ['badge-cancelled','Annulée'],
    };
    const [cls, label] = map[s] || ['badge-open', s];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function severityBadge(s) {
    const map = {
      critical: ['badge-crit-sev', 'Critique'],
      warning:  ['badge-warn-sev', 'Avertissement'],
      info:     ['badge-info-sev', 'Info'],
    };
    const [cls, label] = map[s] || ['badge-info-sev', s];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  // ── Wire up nav & modal close ──────────────────────────
  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => setView(el.dataset.view))
  );

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('notif-header-btn').addEventListener('click', () => setView('notifications'));
  document.getElementById('alert-header-btn').addEventListener('click', () => setView('alerts'));

  // ── Init ───────────────────────────────────────────────
  setView('dashboard');
})();
