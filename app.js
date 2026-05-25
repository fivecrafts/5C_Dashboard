'use strict';

// ════════════════════════════════════════════════════════════════
// APP — data loading & pipeline save actions
// ════════════════════════════════════════════════════════════════
const App = {
  async loadAll() {
    chip('ch-b', '⟳ Loading…');
    try {
      const [pj, cj, tj, oj, clj, compj] = await Promise.all([
        P.loadSheet(activeCfg.sheets.pipeline),
        P.loadSheet(activeCfg.sheets.contacts),
        P.loadSheet(activeCfg.sheets.tasks),
        P.loadSheet(activeCfg.sheets.owners),
        P.loadSheet(activeCfg.sheets.codelists),
        P.loadSheet(activeCfg.sheets.companies).catch(() => ({ values: [] })),
      ]);
      DATA_PIPE      = P.parsePipeline(pj);
      DATA_CONTACTS  = P.parseContacts(cj);
      DATA_TASKS     = P.parseTasks(tj);
      DATA_OWNERS    = P.parseOwners(oj);
      DATA_COMPANIES = P.parseCompanies(compj);
      const cls = P.parseCodelists(clj);
      if (cls.TaskType && cls.TaskType.length) TASK_TYPES = cls.TaskType;
      chip('ch-g', '● ' + activeCfg.label + ' · Live');
      toast(`Loaded ${DATA_PIPE.length} opps · ${DATA_CONTACTS.length} contacts · ${DATA_TASKS.length} tasks`, 'success');
    } catch (e) {
      chip('ch-a', '⚠ ' + e.message);
      toast('Load failed: ' + e.message, 'error');
      return;
    }
    CHANGES = {};
    LOAD_TIME = Date.now();
    buildOwnerColors();
    $('sb-loaded').textContent  = new Date().toLocaleTimeString();
    $('sb-pvdr-lbl').textContent = activeCfg.label;
    updateCounts();
    // Re-render active page
    const active = document.querySelector('.page.active');
    if (active) {
      const id = active.id.replace('page-', '');
      if      (id === 'dashboard') renderDash();
      else if (id === 'pipeline')  renderPipe('', '', '');
      else if (id === 'contacts')  renderContacts('', '');
      else if (id === 'tasks')     renderTasks('', '', '');
      else if (id === 'owners')    renderOwners();
      else if (id === 'companies') renderCompanies('', '');
    } else renderDash();
  },

  discard() { CHANGES = {}; updateCounts(); renderPipe('', '', ''); toast('Discarded', 'info'); },

  openModal() {
    $('mo-list').innerHTML = Object.entries(CHANGES).map(([k, ns]) => {
      const [c, p] = k.split('|||');
      const row = DATA_PIPE.find(r => r.c === c && r.p === p);
      return `<div class="mo-row"><span class="mo-cl">${c}${p ? ' · ' + p : ''}</span>${badge(row?.s || '?')}<span style="color:var(--slate2)">→</span>${badge(ns)}</div>`;
    }).join('');
    $('mo').classList.add('open');
  },

  closeMo() { $('mo').classList.remove('open'); },

  async save() {
    this.closeMo();
    toast('Saving…', 'info');
    let saved = 0, failed = 0;
    for (const [k, newS] of Object.entries(CHANGES)) {
      const [c, p] = k.split('|||');
      const row = DATA_PIPE.find(r => r.c === c && r.p === p);
      if (!row) continue;
      const ok = await P.saveStatusOnly(row, newS);
      if (ok) { row.s = newS; saved++; } else failed++;
    }
    CHANGES = {};
    updateCounts(); renderPipe('', '', ''); renderDash();
    if (failed === 0) toast(`✓ ${saved} change${saved > 1 ? 's' : ''} saved`, 'success');
    else toast(`⚠ ${saved} saved · ${failed} failed`, 'error');
  },
};

// ════════════════════════════════════════════════════════════════
// UI CONTROLLER — auth, navigation
// ════════════════════════════════════════════════════════════════
const UI = {
  async signIn(providerName) {
    setProvider(providerName);
    try {
      const user = await P.signIn();
      if (user) this._onLogin(user);
    } catch (e) {
      if (!e.message.includes('user_cancelled') && !e.message.includes('popup_closed'))
        showErr(e.message);
    }
  },

  async signOut() {
    await P.signOut().catch(() => {});
    $('app-shell').classList.remove('visible');
    $('login-screen').style.display = 'flex';
    DATA_PIPE = []; DATA_CONTACTS = []; DATA_TASKS = []; DATA_OWNERS = []; CHANGES = {};
  },

  _onLogin(user) {
    $('login-screen').style.display = 'none';
    $('app-shell').classList.add('visible');
    const name = user.name || user.email.split('@')[0];
    $('sb-user').textContent = name;
    window.CURRENT_USER_NAME = name;
    const pb = $('sb-pvdr');
    pb.textContent = activeCfg.label;
    pb.className   = 'sb-pvdr ' + activeCfg.badgeCls;
    const mc = $('my-opps-chip');
    if (mc) { mc.textContent = '👤 My opps'; mc.style.display = 'inline-flex'; }
    App.loadAll();
  },

  nav(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
    $('page-' + id).classList.add('active');
    if (el) el.classList.add('active');
    const titles = { dashboard:'Dashboard', pipeline:'All Opportunities', contacts:'Contacts', tasks:'Tasks', owners:'Owners', companies:'Companies' };
    const subs   = { dashboard:'Overview · Five Crafts BD 2026', pipeline:'Edit status · confirm to write back', contacts:'Contact database', tasks:'Tasks & follow-ups', owners:'Account managers', companies:'Company profiles' };
    $('tb-t').textContent = titles[id] || id;
    $('tb-s').textContent = subs[id]   || '';
    const nb = $('topbar-new-btn');
    if      (id === 'contacts')  { nb.style.display = 'inline-block'; nb.textContent = '+ New Contact'; }
    else if (id === 'tasks')     { nb.style.display = 'inline-block'; nb.textContent = '+ New Task'; }
    else if (id === 'companies') { nb.style.display = 'inline-block'; nb.textContent = '+ New Company'; }
    else nb.style.display = 'none';
    if      (id === 'dashboard') renderDash();
    else if (id === 'pipeline')  renderPipe('', '', '');
    else if (id === 'contacts')  renderContacts('', '');
    else if (id === 'tasks')     renderTasks('', '', '');
    else if (id === 'owners')    renderOwners();
    else if (id === 'companies') renderCompanies('', '');
  },

  nf(status, el, owner) {
    this.nav('pipeline', null);
    document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    $('tb-t').textContent = 'All Opportunities';
    owner = owner ? owner.replace(/__SQ__/g, "'") : '';
    $('tb-s').textContent = 'Filtered: ' + [status, owner].filter(Boolean).join(' · ');
    renderPipe('', status, owner);
  },
};

// ════════════════════════════════════════════════════════════════
// DRAWERS — shared open/close + context dispatcher
// ════════════════════════════════════════════════════════════════
let drawerKey  = null;
let drawerType = null;

function openDrawer(title, bodyHTML, footHTML, type, dKey) {
  drawerType = type;
  drawerKey  = dKey;
  $('drawer-title').textContent   = title;
  $('drawer-body').innerHTML      = bodyHTML;
  $('drawer-foot').innerHTML      = footHTML;
  $('drawer-task-btn').style.display = (type === 'pipeline' || type === 'contact') ? 'inline-block' : 'none';
  $('drawer-overlay').classList.add('open');
  $('drawer').classList.add('open');
}

function closeDrawer() {
  $('drawer-overlay').classList.remove('open');
  $('drawer').classList.remove('open');
  drawerKey = null;
  drawerType = null;
}

function openNewDrawer() {
  const active = document.querySelector('.page.active');
  if      (active?.id === 'page-contacts')  openNewContactDrawer();
  else if (active?.id === 'page-tasks')     openNewTask('', '', '');
  else if (active?.id === 'page-companies') openNewCompanyDrawer();
}

function openNewTaskFromContext() {
  if (drawerType === 'pipeline') {
    const [c, p] = drawerKey.split('|||');
    const row = DATA_PIPE.find(r => r.c === c && r.p === p);
    openNewTask('opp', row ? esc(row.c + (row.p ? ' · ' + row.p : '')) : '', '');
  } else if (drawerType === 'contact') {
    const row = DATA_CONTACTS.find(r => r.id === drawerKey || ((r.firstName + ' ' + r.lastName).trim() === drawerKey));
    const name = row ? ((row.firstName || '') + ' ' + (row.lastName || '')).trim() : '';
    openNewTask('contact', '', name);
  }
}

// ════════════════════════════════════════════════════════════════
// CONFLICT DETECTION
// ════════════════════════════════════════════════════════════════
let conflictData = null;

function showConflict({ field, liveVal, ourVal, client, project }) {
  conflictData = { liveVal, ourVal };
  $('conflict-details').innerHTML = `
    <div style="margin-bottom:8px"><b>Record:</b> ${client}${project ? ' · ' + project : ''}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <div style="flex:1;padding:8px;background:var(--amber-t);border-radius:6px;border:1px solid var(--amber-l)">
        <div style="font-size:.65rem;font-weight:600;color:var(--amber);text-transform:uppercase;margin-bottom:3px">Excel (current)</div>
        <div style="font-weight:600">${liveVal}</div>
      </div>
      <div style="color:var(--slate2)">vs</div>
      <div style="flex:1;padding:8px;background:var(--blue-t);border-radius:6px;border:1px solid var(--blue-l)">
        <div style="font-size:.65rem;font-weight:600;color:var(--blue);text-transform:uppercase;margin-bottom:3px">Your change</div>
        <div style="font-weight:600">${ourVal}</div>
      </div>
    </div>`;
  $('conflict-mo').classList.add('open');
}

function closeConflict() { $('conflict-mo').classList.remove('open'); conflictData = null; }

function useTheirVersion() {
  if (!conflictData) return;
  const sel = $('d-s'); if (sel) sel.value = conflictData.liveVal;
  const [c, p] = drawerKey.split('|||');
  const row = DATA_PIPE.find(r => r.c === c && r.p === p);
  if (row) row.s = conflictData.liveVal;
  closeConflict();
  toast('Updated to Excel version', 'info');
}

// ════════════════════════════════════════════════════════════════
// CROSS-NAVIGATION
// ════════════════════════════════════════════════════════════════
function openContactFromPipeline(safeContact) {
  const name = safeContact.replace(/__SQ__/g, "'");
  const row  = DATA_CONTACTS.find(r => ((r.firstName + ' ' + r.lastName).trim() === name) || r.id === name);
  if (row) {
    UI.nav('contacts', null);
    const id = (row.id || ((row.firstName + ' ' + row.lastName).trim())).replace(/'/g, '__SQ__');
    setTimeout(() => openContactDrawer(id), 100);
  } else {
    UI.nav('contacts', null);
    setTimeout(() => { const el = $('cq'); if (el) { el.value = name; renderContacts(name, ''); } }, 100);
  }
}

function openContactFromTask(safeName) {
  const name = safeName.replace(/__SQ__/g, "'");
  if (!name || name === '—') return;
  openContactFromPipeline(safeName);
}

function openOppFromContact(safeOpp) {
  const opp   = safeOpp.replace(/__SQ__/g, "'");
  closeDrawer();
  const parts = opp.split(' · ');
  const c = parts[0] || '', p = parts.slice(1).join(' · ') || '';
  const row = DATA_PIPE.find(r => r.c === c && (r.p === p || !p));
  if (row) {
    UI.nav('pipeline', null);
    setTimeout(() => {
      const el = $('f-q'); if (el) { el.value = c; renderPipe(c, '', ''); }
      setTimeout(() => openPipeDrawer((row.c + '|||' + row.p).replace(/'/g, '__SQ__')), 200);
    }, 100);
  }
}

function openOppFromTask(safeOpp) { openOppFromContact(safeOpp); }

// ════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════
(async () => {
  try {
    const user = await P.tryAutoLogin();
    if (user) { UI._onLogin(user); return; }
  } catch (e) {}
  // Falls through to show login screen — already visible by default
})();
