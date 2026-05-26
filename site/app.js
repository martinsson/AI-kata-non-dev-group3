(() => {
  'use strict';

  const STORE = 'sdesk-workspace-v1';

  // ── Seed data ──────────────────────────────────────────
  const mkSeed = () => ({
    tasks: [
      { id: uid(), number: 'TK0001001', title: 'Mettre à jour les certificats SSL', assignee: 'Alice Martin',  priority: 'critical', status: 'open',     due: '2026-06-01', description: 'Les certificats expirent dans 5 jours sur srv-web-01.' },
      { id: uid(), number: 'TK0001002', title: 'Migrer la base vers PostgreSQL 16',  assignee: 'Bob Dupont',   priority: 'high',     status: 'progress', due: '2026-06-15', description: '' },
      { id: uid(), number: 'TK0001003', title: 'Revue du code de sécurité',          assignee: 'Claire Leroy', priority: 'high',     status: 'open',     due: '2026-06-10', description: '' },
      { id: uid(), number: 'TK0001004', title: 'Documenter l\'API REST v2',          assignee: 'David Petit',  priority: 'medium',   status: 'progress', due: '2026-06-20', description: '' },
      { id: uid(), number: 'TK0001005', title: 'Corriger bug formulaire contact',    assignee: 'Alice Martin',  priority: 'low',      status: 'done',     due: '2026-05-20', description: '' },
      { id: uid(), number: 'TK0001006', title: 'Audit accès Active Directory',       assignee: 'Bob Dupont',   priority: 'high',     status: 'open',     due: '2026-06-05', description: '' },
    ],
    notifications: [
      { id: uid(), title: 'Déploiement v2.4.1 réussi',        description: 'La version 2.4.1 a été déployée en production avec succès.', type: 'success', read: false, date: ago(2) },
      { id: uid(), title: 'Alerte performance API /users',    description: 'Temps de réponse moyen > 800ms sur le dernier intervalle.', type: 'warning', read: false, date: ago(15) },
      { id: uid(), title: 'Tâche TK0001003 assignée',         description: 'La tâche "Revue sécurité" vous a été assignée.', type: 'info', read: true, date: ago(60) },
      { id: uid(), title: 'Sauvegarde DB-02 échouée',         description: 'La sauvegarde nocturne du serveur DB-02 a échoué à 03:15.', type: 'error', read: false, date: ago(90) },
      { id: uid(), title: 'Certificat expirant dans 5 jours', description: 'Le certificat TLS de srv-web-01 expire le 2026-06-01.', type: 'warning', read: false, date: ago(120) },
    ],
    alerts: [
      { id: uid(), message: 'Espace disque critique /srv/data — 95% utilisé', source: 'srv-db-01',  severity: 'critical', active: true,  date: ago(5) },
      { id: uid(), message: 'CPU élevé en continu (>90%) depuis 15 min',       source: 'srv-web-03', severity: 'warning',  active: true,  date: ago(18) },
      { id: uid(), message: 'Mise à jour de sécurité disponible : kernel 6.x', source: 'Système',   severity: 'info',     active: true,  date: ago(60) },
      { id: uid(), message: 'Tentatives de connexion SSH répétées (>100/min)', source: 'Firewall',  severity: 'critical', active: false, date: ago(180) },
    ],
    _tkSeq: 7,
  });

  function ago(min) {
    return new Date(Date.now() - min * 60000).toISOString();
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── State ──────────────────────────────────────────────
  let S = (() => {
    try { const r = localStorage.getItem(STORE); if (r) return JSON.parse(r); } catch (_) {}
    return mkSeed();
  })();

  function save() { localStorage.setItem(STORE, JSON.stringify(S)); }

  // ── Tab management ────────────────────────────────────
  // tab = { id, module, label, icon, subview?, recordId? }
  let tabs = [
    { id: 'dashboard', module: 'dashboard', label: 'Tableau de bord', icon: 'grid' },
  ];
  let activeTabId = 'dashboard';

  function openTab(module, opts = {}) {
    const id = opts.id || module;
    const existing = tabs.find(t => t.id === id);
    if (existing) { activateTab(id); return; }
    tabs.push({
      id, module,
      label: opts.label || moduleLabel(module),
      icon: opts.icon || moduleIconName(module),
      ...opts,
    });
    activateTab(id);
  }

  function activateTab(id) {
    activeTabId = id;
    renderTabs();
    renderContent();
    syncNavActive();
  }

  function closeTab(id) {
    if (tabs.length === 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    tabs = tabs.filter(t => t.id !== id);
    if (activeTabId === id) {
      const next = tabs[Math.min(idx, tabs.length - 1)];
      activeTabId = next.id;
    }
    renderTabs();
    renderContent();
    syncNavActive();
  }

  function renderTabs() {
    const strip = document.getElementById('tab-strip');
    strip.innerHTML = tabs.map(t => `
      <div class="workspace-tab ${t.id === activeTabId ? 'active' : ''}" data-tab="${t.id}">
        <span class="tab-icon">${svgIcon(t.icon, 12)}</span>
        <span class="tab-label">${esc(t.label)}</span>
        <button class="tab-close" data-close-tab="${t.id}" aria-label="Fermer">×</button>
      </div>
    `).join('');

    strip.querySelectorAll('.workspace-tab').forEach(el =>
      el.addEventListener('click', e => {
        if (!e.target.closest('[data-close-tab]')) activateTab(el.dataset.tab);
      })
    );
    strip.querySelectorAll('[data-close-tab]').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); closeTab(b.dataset.closeTab); })
    );
  }

  function syncNavActive() {
    const cur = tabs.find(t => t.id === activeTabId);
    document.querySelectorAll('.nav-module').forEach(el =>
      el.classList.toggle('active', cur && el.dataset.module === cur.module)
    );
  }

  // ── Content rendering ─────────────────────────────────
  function renderContent() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    const el = document.getElementById('workspace-content');
    el.innerHTML = '';
    ({ dashboard: renderDashboard, tasks: renderTasksList,
       notifications: renderNotifList, alerts: renderAlertsList,
     })[tab.module]?.(el, tab);
  }

  // ── Dashboard ─────────────────────────────────────────
  function renderDashboard(root) {
    const open  = S.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
    const done  = S.tasks.filter(t => t.status === 'done');
    const actA  = S.alerts.filter(a => a.active);
    const unread = S.notifications.filter(n => !n.read);

    root.innerHTML = `
    <div class="dash-wrap">
      <div class="dash-stats">
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon blue">${svgIcon('check-sq', 18)}</div>
          <div><div class="kpi-val">${S.tasks.length}</div><div class="kpi-label">Tâches totales</div></div>
        </div>
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon orange">${svgIcon('clock', 18)}</div>
          <div><div class="kpi-val">${open.length}</div><div class="kpi-label">Ouvertes / En cours</div></div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon green">${svgIcon('check-circle', 18)}</div>
          <div><div class="kpi-val">${done.length}</div><div class="kpi-label">Terminées</div></div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon red">${svgIcon('alert-tri', 18)}</div>
          <div><div class="kpi-val">${actA.length}</div><div class="kpi-label">Alertes actives</div></div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon blue">${svgIcon('bell', 18)}</div>
          <div><div class="kpi-val">${unread.length}</div><div class="kpi-label">Notifs non lues</div></div>
        </div>
      </div>

      <div class="dash-panels">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">${svgIcon('check-sq',13)} Tâches récentes</div>
            <button class="btn btn-sm btn-ghost" data-open-module="tasks">Voir tout</button>
          </div>
          <table class="now-table">
            <thead><tr><th>Numéro</th><th>Titre</th><th>Priorité</th><th>Statut</th></tr></thead>
            <tbody>${
              !S.tasks.length
                ? `<tr class="empty-table"><td colspan="4">Aucune tâche</td></tr>`
                : [...S.tasks].slice(0,6).map(t => `<tr>
                    <td><span class="record-link" data-open-task="${t.id}">${esc(t.number)}</span></td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</td>
                    <td>${prioBadge(t.priority)}</td>
                    <td>${statusBadge(t.status)}</td>
                  </tr>`).join('')
            }</tbody>
          </table>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">${svgIcon('alert-tri',13)} Alertes actives</div>
            <button class="btn btn-sm btn-ghost" data-open-module="alerts">Voir tout</button>
          </div>
          <table class="now-table">
            <thead><tr><th>Message</th><th>Sévérité</th></tr></thead>
            <tbody>${
              !actA.length
                ? `<tr class="empty-table"><td colspan="2">Aucune alerte</td></tr>`
                : actA.slice(0,6).map(a => `<tr class="alert-${a.severity}">
                    <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis">${esc(a.message)}</td>
                    <td>${severBadge(a.severity)}</td>
                  </tr>`).join('')
            }</tbody>
          </table>
        </div>

        <div class="panel" style="grid-column:1/-1">
          <div class="panel-header">
            <div class="panel-title">${svgIcon('bell',13)} Notifications récentes</div>
            <button class="btn btn-sm btn-ghost" data-open-module="notifications">Voir tout</button>
          </div>
          <div id="dash-notif-list">
          ${[...S.notifications].sort((a,b) => b.date.localeCompare(a.date)).slice(0,4)
            .map(n => notifHTML(n)).join('') || `<div style="padding:20px;text-align:center;color:var(--w-text-muted);font-style:italic">Aucune notification</div>`}
          </div>
        </div>
      </div>
    </div>`;

    root.querySelectorAll('[data-open-module]').forEach(b =>
      b.addEventListener('click', () => openTab(b.dataset.openModule)));
    root.querySelectorAll('[data-open-task]').forEach(b =>
      b.addEventListener('click', () => openTaskForm(b.dataset.openTask)));
    wireNotifActions(root);
  }

  // ── Task list ─────────────────────────────────────────
  function renderTasksList(root) {
    let filter = { status: '', priority: '', q: '' };

    const rebuild = () => {
      let rows = [...S.tasks];
      if (filter.status)   rows = rows.filter(t => t.status   === filter.status);
      if (filter.priority) rows = rows.filter(t => t.priority === filter.priority);
      if (filter.q) {
        const q = filter.q.toLowerCase();
        rows = rows.filter(t => t.title.toLowerCase().includes(q) ||
          t.number.toLowerCase().includes(q) || (t.assignee||'').toLowerCase().includes(q));
      }
      renderRows(rows);
      root.querySelector('.list-footer .count').textContent =
        `${rows.length} enregistrement${rows.length !== 1 ? 's' : ''}`;
    };

    const renderRows = rows => {
      const tbody = root.querySelector('#task-tbody');
      if (!rows.length) {
        tbody.innerHTML = `<tr class="empty-table"><td colspan="8">Aucune tâche trouvée</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(t => `<tr data-id="${t.id}" class="${t.status === 'done' ? 'done-row' : ''}">
        <td class="td-check"><input type="checkbox" class="row-cb" data-id="${t.id}"/></td>
        <td><span class="record-link" data-open-task="${t.id}">${esc(t.number)}</span></td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</td>
        <td>${esc(t.assignee || '—')}</td>
        <td>${prioBadge(t.priority)}</td>
        <td>${statusBadge(t.status)}</td>
        <td style="color:${isOverdue(t.due) ? 'var(--w-red)' : 'var(--w-text-muted)'}">${fmtShort(t.due)}</td>
        <td>
          <div class="row-actions" style="display:flex;gap:3px">
            <button class="btn-icon" data-edit-task="${t.id}" title="Modifier">${svgIcon('edit',13)}</button>
            <button class="btn-icon del" data-del-task="${t.id}" title="Supprimer">${svgIcon('trash',13)}</button>
          </div>
        </td>
      </tr>`).join('');

      tbody.querySelectorAll('[data-open-task]').forEach(b =>
        b.addEventListener('click', () => openTaskForm(b.dataset.openTask)));
      tbody.querySelectorAll('[data-edit-task]').forEach(b =>
        b.addEventListener('click', () => openTaskForm(b.dataset.editTask)));
      tbody.querySelectorAll('[data-del-task]').forEach(b =>
        b.addEventListener('click', () => {
          if (!confirm('Supprimer cette tâche ?')) return;
          S.tasks = S.tasks.filter(t => t.id !== b.dataset.delTask);
          save(); rebuild(); updateBadges();
        }));

      tbody.querySelectorAll('.row-cb').forEach(cb =>
        cb.addEventListener('change', () =>
          tbody.querySelector(`tr[data-id="${cb.dataset.id}"]`)
            ?.classList.toggle('selected', cb.checked)
        )
      );
      const all = root.querySelector('#cb-all');
      if (all) {
        all.addEventListener('change', () => {
          tbody.querySelectorAll('.row-cb').forEach(cb => { cb.checked = all.checked; });
          tbody.querySelectorAll('tr[data-id]').forEach(tr => tr.classList.toggle('selected', all.checked));
        });
      }
    };

    root.innerHTML = `
    <div class="breadcrumb-bar">
      <span class="bc-link" data-open-module="dashboard">Accueil</span>
      <span class="bc-sep">›</span>
      <span class="bc-current">Tâches</span>
    </div>
    <div class="list-header">
      <div class="list-title">Tâches</div>
      <div class="list-actions">
        <button class="btn btn-primary" id="btn-new-task">${svgIcon('plus',13)} Nouveau</button>
      </div>
    </div>
    <div class="list-toolbar">
      <div class="search-box">
        ${svgIcon('search',12)}
        <input type="text" id="task-search" placeholder="Rechercher…"/>
      </div>
      <div class="filter-controls">
        <select id="task-filter-status" class="filter-select">
          <option value="">Tous statuts</option>
          <option value="open">Ouverte</option>
          <option value="progress">En cours</option>
          <option value="done">Terminée</option>
          <option value="cancelled">Annulée</option>
        </select>
        <select id="task-filter-prio" class="filter-select">
          <option value="">Toutes priorités</option>
          <option value="critical">Critique</option>
          <option value="high">Haute</option>
          <option value="medium">Moyenne</option>
          <option value="low">Basse</option>
        </select>
      </div>
    </div>
    <div class="now-table-wrap">
      <table class="now-table">
        <thead>
          <tr>
            <th class="th-check"><input type="checkbox" id="cb-all"/></th>
            <th>Numéro</th>
            <th>Titre</th>
            <th>Assigné à</th>
            <th>Priorité</th>
            <th>Statut</th>
            <th>Échéance</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="task-tbody"></tbody>
      </table>
    </div>
    <div class="list-footer">
      <span class="count">0 enregistrement</span>
    </div>`;

    root.querySelector('#btn-new-task').addEventListener('click', () => openTaskForm());
    root.querySelector('#task-search').addEventListener('input', e => { filter.q = e.target.value; rebuild(); });
    root.querySelector('#task-filter-status').addEventListener('change', e => { filter.status = e.target.value; rebuild(); });
    root.querySelector('#task-filter-prio').addEventListener('change', e => { filter.priority = e.target.value; rebuild(); });
    root.querySelector('.bc-link').addEventListener('click', () => openTab('dashboard'));
    rebuild();
  }

  // ── Task form (modal) ─────────────────────────────────
  function openTaskForm(id) {
    const rec = id ? S.tasks.find(t => t.id === id) : null;
    const d = rec || {};
    openModal(rec ? `Modifier ${rec.number}` : 'Nouvelle tâche', `
      <div class="form-section">
        <div class="form-section-header">
          <div class="form-section-title">${svgIcon('info',12)} Informations générales</div>
        </div>
        <div class="form-grid">
          <div class="form-field full">
            <label>Titre <span class="req">*</span></label>
            <input type="text" name="title" value="${esc(d.title||'')}" required/>
          </div>
          <div class="form-field">
            <label>Assigné à</label>
            <input type="text" name="assignee" value="${esc(d.assignee||'')}"/>
          </div>
          <div class="form-field">
            <label>Échéance</label>
            <input type="date" name="due" value="${d.due||''}"/>
          </div>
          <div class="form-field">
            <label>Priorité <span class="req">*</span></label>
            <select name="priority">
              ${optsMap({'critical':'Critique','high':'Haute','medium':'Moyenne','low':'Basse'}, d.priority||'medium')}
            </select>
          </div>
          <div class="form-field">
            <label>Statut <span class="req">*</span></label>
            <select name="status">
              ${optsMap({'open':'Ouverte','progress':'En cours','done':'Terminée','cancelled':'Annulée'}, d.status||'open')}
            </select>
          </div>
          <div class="form-field full">
            <label>Description</label>
            <textarea name="description">${esc(d.description||'')}</textarea>
          </div>
        </div>
      </div>
    `, () => {
      const f = collectModal();
      if (!f.title?.trim()) return alert('Le titre est obligatoire.');
      if (rec) { Object.assign(rec, f); }
      else {
        const num = `TK${String(S._tkSeq++).padStart(7,'0')}`;
        S.tasks.push({ id: uid(), number: num, ...f });
      }
      save(); closeModal();
      const t = tabs.find(t => t.id === activeTabId);
      if (t) renderContent();
      updateBadges();
    });
  }

  // ── Notifications list ────────────────────────────────
  function renderNotifList(root) {
    let filter = { read: '', type: '' };

    const rebuild = () => {
      let rows = [...S.notifications].sort((a,b) => b.date.localeCompare(a.date));
      if (filter.read === 'unread') rows = rows.filter(n => !n.read);
      if (filter.read === 'read')   rows = rows.filter(n =>  n.read);
      if (filter.type) rows = rows.filter(n => n.type === filter.type);
      const list = root.querySelector('#notif-list');
      list.innerHTML = rows.length
        ? rows.map(n => notifHTML(n)).join('')
        : `<div style="padding:32px;text-align:center;color:var(--w-text-muted);font-style:italic">Aucune notification</div>`;
      wireNotifActions(root);
    };

    root.innerHTML = `
    <div class="breadcrumb-bar">
      <span class="bc-link" data-bc>Accueil</span>
      <span class="bc-sep">›</span>
      <span class="bc-current">Notifications</span>
    </div>
    <div class="list-header">
      <div class="list-title">Notifications</div>
      <div class="list-actions">
        <button class="btn btn-ghost btn-sm" id="btn-mark-all">Tout marquer lu</button>
        <button class="btn btn-primary" id="btn-new-notif">${svgIcon('plus',13)} Nouvelle</button>
      </div>
    </div>
    <div class="list-toolbar">
      <div class="filter-controls">
        <select id="nf-read" class="filter-select">
          <option value="">Toutes</option>
          <option value="unread">Non lues</option>
          <option value="read">Lues</option>
        </select>
        <select id="nf-type" class="filter-select">
          <option value="">Tous types</option>
          <option value="info">Info</option>
          <option value="warning">Avertissement</option>
          <option value="error">Erreur</option>
          <option value="success">Succès</option>
        </select>
      </div>
    </div>
    <div id="notif-list" style="background:var(--w-surface);border-top:1px solid var(--w-border-light)"></div>`;

    root.querySelector('#btn-mark-all').addEventListener('click', () => {
      S.notifications.forEach(n => n.read = true); save(); rebuild(); updateBadges();
    });
    root.querySelector('#btn-new-notif').addEventListener('click', () => openNotifForm());
    root.querySelector('#nf-read').addEventListener('change',  e => { filter.read = e.target.value; rebuild(); });
    root.querySelector('#nf-type').addEventListener('change',  e => { filter.type = e.target.value; rebuild(); });
    root.querySelector('.bc-link').addEventListener('click', () => openTab('dashboard'));
    rebuild();
  }

  function openNotifForm() {
    openModal('Nouvelle notification', `
      <div class="form-section">
        <div class="form-grid">
          <div class="form-field full">
            <label>Titre <span class="req">*</span></label>
            <input type="text" name="title" required/>
          </div>
          <div class="form-field full">
            <label>Description</label>
            <textarea name="description"></textarea>
          </div>
          <div class="form-field">
            <label>Type</label>
            <select name="type">
              ${optsMap({info:'Info',warning:'Avertissement',error:'Erreur',success:'Succès'}, 'info')}
            </select>
          </div>
        </div>
      </div>
    `, () => {
      const f = collectModal();
      if (!f.title?.trim()) return alert('Le titre est obligatoire.');
      S.notifications.unshift({ id: uid(), ...f, read: false, date: new Date().toISOString() });
      save(); closeModal(); renderContent(); updateBadges();
    });
  }

  function notifHTML(n) {
    return `<div class="notif-item ${n.read ? '' : 'unread'}" data-nid="${n.id}">
      <div class="notif-dot ${n.read ? 'read' : ''}"></div>
      <div class="notif-body">
        <div class="notif-title">${esc(n.title)}</div>
        <div class="notif-desc">${esc(n.description)}</div>
        <div class="notif-meta">
          <span class="notif-type-chip ${n.type}">${typeLabel(n.type)}</span>
          <span>${fmtRelative(n.date)}</span>
        </div>
      </div>
      <div class="notif-actions">
        ${!n.read ? `<button class="btn-icon" data-mark-read="${n.id}" title="Marquer comme lu">${svgIcon('check',13)}</button>` : ''}
        <button class="btn-icon del" data-del-notif="${n.id}" title="Supprimer">${svgIcon('trash',13)}</button>
      </div>
    </div>`;
  }

  function wireNotifActions(root) {
    root.querySelectorAll('[data-mark-read]').forEach(b =>
      b.addEventListener('click', () => {
        const n = S.notifications.find(x => x.id === b.dataset.markRead);
        if (n) { n.read = true; save(); renderContent(); updateBadges(); }
      })
    );
    root.querySelectorAll('[data-del-notif]').forEach(b =>
      b.addEventListener('click', () => {
        S.notifications = S.notifications.filter(n => n.id !== b.dataset.delNotif);
        save(); renderContent(); updateBadges();
      })
    );
  }

  // ── Alerts list ───────────────────────────────────────
  function renderAlertsList(root) {
    let filter = { severity: '', active: '' };

    const rebuild = () => {
      let rows = [...S.alerts].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return ({'critical':0,'warning':1,'info':2}[a.severity]??3) - ({'critical':0,'warning':1,'info':2}[b.severity]??3);
      });
      if (filter.severity) rows = rows.filter(a => a.severity === filter.severity);
      if (filter.active !== '') rows = rows.filter(a => String(a.active) === filter.active);

      const tbody = root.querySelector('#alert-tbody');
      if (!rows.length) {
        tbody.innerHTML = `<tr class="empty-table"><td colspan="6">Aucune alerte</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(a => `<tr class="alert-${a.active ? a.severity : ''}">
        <td class="td-check"><input type="checkbox" class="row-cb"/></td>
        <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis"><strong>${esc(a.message)}</strong></td>
        <td style="color:var(--w-text-muted)">${esc(a.source||'—')}</td>
        <td>${severBadge(a.severity)}</td>
        <td>${a.active ? `<span class="badge b-active">Active</span>` : `<span class="badge b-resolved">Résolue</span>`}</td>
        <td style="color:var(--w-text-muted);white-space:nowrap">${fmtFull(a.date)}</td>
        <td>
          <div style="display:flex;gap:3px">
            ${a.active ? `<button class="btn-icon ok" data-dismiss="${a.id}" title="Acquitter">${svgIcon('check',13)}</button>` : ''}
            <button class="btn-icon" data-edit-alert="${a.id}" title="Modifier">${svgIcon('edit',13)}</button>
            <button class="btn-icon del" data-del-alert="${a.id}" title="Supprimer">${svgIcon('trash',13)}</button>
          </div>
        </td>
      </tr>`).join('');

      tbody.querySelectorAll('[data-dismiss]').forEach(b =>
        b.addEventListener('click', () => {
          const a = S.alerts.find(x => x.id === b.dataset.dismiss);
          if (a) { a.active = false; save(); rebuild(); updateBadges(); }
        }));
      tbody.querySelectorAll('[data-edit-alert]').forEach(b =>
        b.addEventListener('click', () => openAlertForm(b.dataset.editAlert)));
      tbody.querySelectorAll('[data-del-alert]').forEach(b =>
        b.addEventListener('click', () => {
          if (!confirm('Supprimer cette alerte ?')) return;
          S.alerts = S.alerts.filter(a => a.id !== b.dataset.delAlert);
          save(); rebuild(); updateBadges();
        }));
    };

    root.innerHTML = `
    <div class="breadcrumb-bar">
      <span class="bc-link" data-bc>Accueil</span>
      <span class="bc-sep">›</span>
      <span class="bc-current">Alertes</span>
    </div>
    <div class="list-header">
      <div class="list-title">Alertes</div>
      <div class="list-actions">
        <button class="btn btn-ghost btn-sm" id="btn-dismiss-all">Acquitter tout</button>
        <button class="btn btn-primary" id="btn-new-alert">${svgIcon('plus',13)} Nouvelle</button>
      </div>
    </div>
    <div class="list-toolbar">
      <div class="filter-controls">
        <select id="af-sev" class="filter-select">
          <option value="">Toutes sévérités</option>
          <option value="critical">Critique</option>
          <option value="warning">Avertissement</option>
          <option value="info">Info</option>
        </select>
        <select id="af-active" class="filter-select">
          <option value="">Tous statuts</option>
          <option value="true">Active</option>
          <option value="false">Résolue</option>
        </select>
      </div>
    </div>
    <div class="now-table-wrap">
      <table class="now-table">
        <thead>
          <tr>
            <th class="th-check"><input type="checkbox"/></th>
            <th>Message</th>
            <th>Source</th>
            <th>Sévérité</th>
            <th>Statut</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="alert-tbody"></tbody>
      </table>
    </div>
    <div class="list-footer"><span class="count"></span></div>`;

    root.querySelector('#btn-dismiss-all').addEventListener('click', () => {
      if (!confirm('Acquitter toutes les alertes actives ?')) return;
      S.alerts.filter(a => a.active).forEach(a => a.active = false);
      save(); rebuild(); updateBadges();
    });
    root.querySelector('#btn-new-alert').addEventListener('click', () => openAlertForm());
    root.querySelector('#af-sev').addEventListener('change',    e => { filter.severity = e.target.value; rebuild(); });
    root.querySelector('#af-active').addEventListener('change', e => { filter.active   = e.target.value; rebuild(); });
    root.querySelector('.bc-link').addEventListener('click', () => openTab('dashboard'));
    rebuild();
  }

  function openAlertForm(id) {
    const rec = id ? S.alerts.find(a => a.id === id) : null;
    const d = rec || {};
    openModal(rec ? 'Modifier l\'alerte' : 'Nouvelle alerte', `
      <div class="form-section">
        <div class="form-grid">
          <div class="form-field full">
            <label>Message <span class="req">*</span></label>
            <input type="text" name="message" value="${esc(d.message||'')}" required/>
          </div>
          <div class="form-field">
            <label>Source</label>
            <input type="text" name="source" value="${esc(d.source||'')}"/>
          </div>
          <div class="form-field">
            <label>Sévérité</label>
            <select name="severity">
              ${optsMap({critical:'Critique',warning:'Avertissement',info:'Info'}, d.severity||'info')}
            </select>
          </div>
          <div class="form-field">
            <label>Statut</label>
            <select name="active">
              <option value="true"${d.active!==false?' selected':''}>Active</option>
              <option value="false"${d.active===false?' selected':''}>Résolue</option>
            </select>
          </div>
        </div>
      </div>
    `, () => {
      const f = collectModal();
      if (!f.message?.trim()) return alert('Le message est obligatoire.');
      f.active = f.active === 'true';
      if (rec) { Object.assign(rec, f); }
      else { S.alerts.unshift({ id: uid(), ...f, date: new Date().toISOString() }); }
      save(); closeModal(); renderContent(); updateBadges();
    });
  }

  // ── Modal ─────────────────────────────────────────────
  let _onSubmit = null;

  function openModal(title, bodyHTML, onSubmit) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-ghost" id="modal-cancel">Annuler</button>
      <button class="btn btn-primary" id="modal-ok">${svgIcon('save',13)} Enregistrer</button>`;
    _onSubmit = onSubmit;
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-ok').addEventListener('click', () => _onSubmit?.());
    document.getElementById('modal').classList.remove('hidden');
    setTimeout(() => document.querySelector('#modal-body input,#modal-body select')?.focus(), 30);
  }

  function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    _onSubmit = null;
  }

  function collectModal() {
    const out = {};
    document.querySelectorAll('#modal-body [name]').forEach(el => { out[el.name] = el.value; });
    return out;
  }

  // ── Badge helpers ─────────────────────────────────────
  function updateBadges() {
    const open   = S.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length;
    const unread = S.notifications.filter(n => !n.read).length;
    const active = S.alerts.filter(a => a.active).length;

    setNavBadge('nav-badge-tasks',  open,   false);
    setNavBadge('nav-badge-notifs', unread, false);
    setNavBadge('nav-badge-alerts', active, true);

    const nb = document.getElementById('notif-badge');
    const ab = document.getElementById('alert-badge');
    if (nb) nb.style.display = unread > 0 ? '' : 'none';
    if (ab) ab.style.display = active > 0 ? '' : 'none';
  }

  function setNavBadge(id, n, danger) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = n;
    el.className = 'nav-module-badge' + (danger ? ' danger' : '');
    el.style.display = n > 0 ? '' : 'none';
  }

  // ── Nav sidebar toggle ────────────────────────────────
  let navExpanded = false;

  function toggleNav() {
    navExpanded = !navExpanded;
    const nav = document.getElementById('app-nav');
    nav.classList.toggle('expanded', navExpanded);
    const icon = document.getElementById('nav-toggle-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.querySelector('polyline').setAttribute('points', navExpanded ? '15 18 9 12 15 6' : '9 18 15 12 9 6');
    document.querySelector('.nav-toggle').title = navExpanded ? 'Réduire' : 'Développer';
  }

  // ── Helpers ───────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function fmtRelative(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'à l\'instant';
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h/24)}j`;
  }

  function fmtShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('fr-FR');
  }

  function fmtFull(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function isOverdue(iso) { return iso && new Date(iso) < new Date(); }

  function optsMap(map, sel) {
    return Object.entries(map).map(([v,l]) =>
      `<option value="${v}"${sel===v?' selected':''}>${l}</option>`).join('');
  }

  function typeLabel(t) {
    return {info:'Info',warning:'Attention',error:'Erreur',success:'Succès'}[t] || t;
  }

  function moduleLabel(m) {
    return {dashboard:'Tableau de bord',tasks:'Tâches',notifications:'Notifications',alerts:'Alertes'}[m] || m;
  }

  function moduleIconName(m) {
    return {dashboard:'grid',tasks:'check-sq',notifications:'bell',alerts:'alert-tri'}[m] || 'grid';
  }

  // ── Badges markup ─────────────────────────────────────
  function statusBadge(s) {
    const m = {open:['b-open','Ouverte'],progress:['b-progress','En cours'],done:['b-done','Terminée'],cancelled:['b-cancelled','Annulée']};
    const [c,l] = m[s] || ['b-cancelled', s];
    return `<span class="badge ${c}">${l}</span>`;
  }

  function prioBadge(p) {
    const m = {critical:['b-critical','Critique'],high:['b-high','Haute'],medium:['b-medium','Moyenne'],low:['b-low','Basse']};
    const [c,l] = m[p] || ['b-medium', p];
    return `<span class="badge ${c}">${l}</span>`;
  }

  function severBadge(s) {
    const m = {critical:['b-crit-sev','Critique'],warning:['b-warn-sev','Avertissement'],info:['b-info-sev','Info']};
    const [c,l] = m[s] || ['b-info-sev', s];
    return `<span class="badge ${c}">${l}</span>`;
  }

  // ── SVG icon library ──────────────────────────────────
  function svgIcon(name, size = 14) {
    const paths = {
      grid:       '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
      'check-sq': '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
      bell:       '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      'alert-tri':'<path d="m10.29 3.86-7 12A1 1 0 0 0 4 17.5h16a1 1 0 0 0 .87-1.5l-7-12a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      plus:       '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      check:      '<polyline points="20 6 9 17 4 12"/>',
      'check-circle':'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
      clock:      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      search:     '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
      edit:       '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
      trash:      '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
      save:       '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
      info:       '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;display:inline-block;vertical-align:middle">${paths[name]||''}</svg>`;
  }

  // ── Boot ──────────────────────────────────────────────
  document.getElementById('nav-toggle-btn').addEventListener('click', toggleNav);
  document.getElementById('nav-expand-btn').addEventListener('click', toggleNav);

  document.querySelectorAll('.nav-module').forEach(el =>
    el.addEventListener('click', () => openTab(el.dataset.module))
  );

  document.getElementById('btn-notif').addEventListener('click',  () => openTab('notifications'));
  document.getElementById('btn-alerts').addEventListener('click', () => openTab('alerts'));

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  renderTabs();
  renderContent();
  updateBadges();
})();
