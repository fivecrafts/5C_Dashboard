// 5C Dashboard v1.39.17 · 2026-07-07 · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// APP — data loading & pipeline save actions
// ════════════════════════════════════════════════════════════════
const App = {
  async loadAll() {
    chip('ch-b', '⟳ Loading…');
    try {
      // Load in two waves to avoid Graph 503 burst errors
      // Wave 1: small/critical sheets
      const [pj, oj, clj] = await Promise.all([
        P.loadSheet(activeCfg.sheets.pipeline),
        P.loadSheet(activeCfg.sheets.owners),
        P.loadSheet(activeCfg.sheets.codelists),
      ]);
      // Wave 2: larger sheets
      const [cj, tj, compj, ej] = await Promise.all([
        P.loadSheet(activeCfg.sheets.contacts),
        P.loadSheet(activeCfg.sheets.tasks),
        P.loadSheet(activeCfg.sheets.companies).catch(() => ({ values: [] })),
        P.loadSheet(activeCfg.sheets.events).catch(()=>({values:[]})),
      ]);
      DATA_PIPE      = P.parsePipeline(pj);
      DATA_CONTACTS  = P.parseContacts(cj);
      DATA_TASKS     = P.parseTasks(tj);
      DATA_EVENTS    = P.parseEvents(ej);
      DATA_OWNERS    = P.parseOwners(oj);

      // Load MessageLinks — Pipeline file first (fast), HR file after (slower)
      // Show results as soon as Pipeline data arrives; merge HR when it lands
      P.loadMessageLinks().then(mlj => {
        DATA_MSG_LINKS = P.parseMessageLinks(mlj);
        console.log(`MessageLinks (Pipeline): ${DATA_MSG_LINKS.length} entries`);
        if (typeof refreshOpenMsgPanels === 'function') refreshOpenMsgPanels();
        // Now load HR MessageLinks and merge
        return P.loadHRMessageLinks();
      }).then(hrmlj => {
        if (!hrmlj) return;
        const hrLinks = P.parseMessageLinks(hrmlj);
        if (hrLinks.length > 0) {
          DATA_MSG_LINKS = [...DATA_MSG_LINKS, ...hrLinks];
          console.log(`MessageLinks (HR): +${hrLinks.length} = ${DATA_MSG_LINKS.length} total`);
          if (typeof refreshOpenMsgPanels === 'function') refreshOpenMsgPanels();
        }
      }).catch(e => console.warn('MessageLinks load failed:', e.message));

      // Load HR Candidates + Search Pool in background (delayed to avoid burst)
      setTimeout(() => {
        P.loadHRSheet().then(hrj => {
          DATA_HR = P.parseHRCandidates(hrj);
          const el = document.getElementById('pl-hr');
          if (el) el.textContent = DATA_HR.length + (DATA_POOL.length ? '+'+DATA_POOL.length : '');
        }).catch(e => {
          console.warn('HR load failed:', e.message);
          const el = document.getElementById('pl-hr'); if (el) el.textContent = '⚠';
        });
        P.loadPoolSheet().then(pj => {
          DATA_POOL = P.parsePoolCandidates(pj);
          const el = document.getElementById('pl-hr');
          if (el) el.textContent = DATA_HR.length + (DATA_POOL.length ? '+'+DATA_POOL.length : '');
          // Load persisted sourcing history after pool is ready
          setTimeout(() => {
            if (typeof loadSourcingRuns === 'function') {
              loadSourcingRuns().catch(e => console.warn('Sourcing log load failed:', e.message));
            }
          }, 1500);
        }).catch(e => console.warn('Pool load failed:', e.message));
      }, 1500);

      // Fetch M365 profile photos in background — non-blocking
      OWNER_PHOTOS = {};
      DATA_OWNERS.forEach(o => {
        if (!o.email) return;
        const safeKey = o.email.replace(/[^a-z0-9]/gi, '_');
        P.loadOwnerPhoto(o.email).then(url => {
          if (!url) return;
          OWNER_PHOTOS[o.email] = url;
          // Update live avatar if 5C Dashboard page is open
          const img = document.getElementById('oav-' + safeKey);
          if (img) { img.src = url; img.style.display = 'inline-block'; const sib = img.nextElementSibling; if (sib) sib.style.display = 'none'; }
        }).catch(() => {});
      });
      DATA_COMPANIES = P.parseCompanies(compj);
      const cls = P.parseCodelists(clj);
      if (cls.TaskType && cls.TaskType.length) {
        // Merge: start from hardcoded list in state.js, add any Excel-only types at end
        const extras = cls.TaskType.filter(t => !TASK_TYPES.includes(t));
        if (extras.length) TASK_TYPES = [...TASK_TYPES, ...extras];
      }
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
    const sbLoaded = $('sb-loaded'); if (sbLoaded) sbLoaded.textContent = new Date().toLocaleTimeString();
    const sbPvdr = $('sb-pvdr-lbl'); if (sbPvdr) sbPvdr.textContent = activeCfg.label;
    try { updateCounts(); } catch(e) { console.warn('updateCounts error:', e); }
    // Re-render active page
    const active = document.querySelector('.page.active');
    if (active) {
      const id = active.id.replace('page-', '');
      if      (id === 'mydashboard') renderMyDashboard();
      else if (id === 'dashboard')   renderDash();
      else if (id === 'pipeline')    renderPipe('', '', '', '');
      else if (id === 'contacts')    renderContacts('', '');
      else if (id === 'tasks')       renderTasks('', '', '');
      else if (id === 'events')      { if(typeof renderEvents==='function') renderEvents(); }
      else if (id === 'hr')          { if(typeof renderHR==='function') renderHR(); }
      else if (id === 'sourcing')  { if(typeof renderSourcing==='function') renderSourcing(); }
      else if (id === 'owners')      renderOwners();
      else if (id === 'companies')   renderCompanies('', '');
    } else {
      renderOwners();
    }
    // Always refresh mydashboard badge count
    const myOppEl = $('pl-myopps');
    if (myOppEl) myOppEl.textContent = DATA_PIPE.filter(r => r.owner === (window.CURRENT_USER_NAME||'')).length;
  },

  discard() { this.closeMo(); }, // no-op — changes save immediately

  openModal() {
    const statusRows = Object.entries(CHANGES).map(([k, ns]) => {
      const [c, p] = k.split('|||');
      const row = DATA_PIPE.find(r => r.c === c && r.p === p);
      return `<div class="mo-row"><span class="mo-cl">${c}${p ? ' · ' + p : ''}</span><span style="font-size:.68rem;color:var(--slate)">Status</span>${badge(row?.s || '?')}<span style="color:var(--slate2)">→</span>${badge(ns)}</div>`;
    });
    const prioRows = Object.entries(PRIO_CHANGES).map(([k, np]) => {
      const [c, p] = k.split('|||');
      return `<div class="mo-row"><span class="mo-cl">${c}${p ? ' · ' + p : ''}</span><span style="font-size:.68rem;color:var(--slate)">Priority</span><span style="color:var(--slate2)">→</span>${prioBadge(np)}</div>`;
    });
    $('mo-list').innerHTML = [...statusRows, ...prioRows].join('');
    $('mo').classList.add('open');
  },

  closeMo() { $('mo').classList.remove('open'); },

  async save() {
    this.closeMo();
    toast('Saving…', 'info');
    let saved = 0, failed = 0;
    // Save status changes
    for (const [k, newS] of Object.entries(CHANGES)) {
      const [c, p] = k.split('|||');
      const row = DATA_PIPE.find(r => r.c === c && r.p === p);
      if (!row) continue;
      const ok = await P.saveStatusOnly(row, newS);
      if (ok) { row.s = newS; saved++; } else failed++;
    }
    // Save priority changes
    for (const [k, newP] of Object.entries(PRIO_CHANGES)) {
      const [c, p] = k.split('|||');
      const row = DATA_PIPE.find(r => r.c === c && r.p === p);
      if (!row) continue;
      const ok = await P.savePriorityOnly(row, newP);
      if (ok) { row.prio = newP; saved++; } else failed++;
    }
    CHANGES = {}; PRIO_CHANGES = {};
    updateCounts(); renderPipe('', '', '', ''); renderDash();
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
      const msg = e.message || '';
      // AADSTS160021 = stale session — clear and redirect to fresh login
      if (msg.includes('AADSTS160021') || msg.includes('interaction_required')) {
        await P.signOut().catch(()=>{});
        await P.signIn(); // will use prompt:'select_account'
      } else if (!msg.includes('user_cancelled') && !msg.includes('popup_closed')) {
        showErr(msg);
      }
    }
  },

  async signOut() {
    await P.signOut().catch(() => {});
    $('app-shell').classList.remove('visible');
    $('login-screen').style.display = 'flex';
    DATA_PIPE = []; DATA_CONTACTS = []; DATA_TASKS = []; DATA_OWNERS = []; DATA_EVENTS = []; DATA_HR = []; DATA_HR_COLS = {}; DATA_POOL = []; DATA_POOL_COLS = {}; CHANGES = {};
  },

  _onLogin(user) {
    $('login-screen').style.display = 'none';
    $('app-shell').classList.add('visible');
    const name = user.name || user.email.split('@')[0];
    $('sb-user').textContent = name;
    window.CURRENT_USER_NAME = name;
    window.CURRENT_USER_EMAIL = user.email || '';
    const pb = $('sb-pvdr');
    pb.textContent = activeCfg.label;
    pb.className   = 'sb-pvdr ' + activeCfg.badgeCls;
    const mc = $('my-opps-chip');
    if (mc) { mc.textContent = '👤 My opps'; mc.style.display = 'inline-flex'; }
    // loadAll will render the active page, but also explicitly ensure
    // My Dashboard renders with the correct user name now set
    App.loadAll().then(() => {
      // Explicitly re-render My Dashboard after data is loaded
      // (handles the case where the active page check runs before DOM settles)
      setTimeout(() => {
        const active = document.querySelector('.page.active');
        if (!active || active.id === 'page-owners') renderOwners();
      else if (active.id === 'page-mydashboard') renderMyDashboard();
      }, 50);
    }).catch((e) => {
      console.error('loadAll failed:', e);
      // Still try to render the active page with whatever data loaded
      setTimeout(() => {
        const active = document.querySelector('.page.active');
        if (!active || active.id === 'page-owners') renderOwners();
        else if (active.id === 'page-mydashboard') renderMyDashboard();
      }, 100);
    });
  },

  nav(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
    $('page-' + id).classList.add('active');
    if (el) el.classList.add('active');
    const titles = { mydashboard:'My Dashboard', dashboard:'Overview', pipeline:'All Opportunities', contacts:'Contacts', tasks:'Tasks', owners:'5C Dashboard', events:'Events 📅', hr:'HR Pool', companies:'Companies', events:'Events' };
    const subs   = { mydashboard:'Your companies · opportunities · tasks', dashboard:'Five Crafts BD · all data', pipeline:'Edit status · confirm to write back', contacts:'Contact database', tasks:'Tasks & follow-ups', owners:'Team overview · Opportunities · Companies', companies:'Company profiles' };
    $('tb-t').textContent = titles[id] || id;
    $('tb-s').textContent = subs[id]   || '';
    const nb = $('topbar-new-btn');
    if      (id === 'contacts')    { nb.style.display = 'inline-block'; nb.textContent = '+ New Contact'; }
    else if (id === 'tasks')       { nb.style.display = 'inline-block'; nb.textContent = '+ New Task'; }
    else if (id === 'companies')   { nb.style.display = 'inline-block'; nb.textContent = '+ New Company'; }
    else nb.style.display = 'none';
    if      (id === 'mydashboard') renderMyDashboard();
    else if (id === 'dashboard')   renderDash();
    else if (id === 'pipeline')    renderPipe('', '', '', '');
    else if (id === 'contacts')    renderContacts('', '');
    else if (id === 'tasks')       renderTasks('', '', '');
      else if (id === 'events')      { if(typeof renderEvents==='function') renderEvents(); }
      else if (id === 'hr')          { if(typeof renderHR==='function') renderHR(); }
      else if (id === 'sourcing')  { if(typeof renderSourcing==='function') renderSourcing(); }
    else if (id === 'owners')      renderOwners();
    else if (id === 'companies')   renderCompanies('', '');
  },

  nf(status, el, owner) {
    this.nav('pipeline', null);
    document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    $('tb-t').textContent = 'All Opportunities';
    owner = owner ? owner.replace(/__SQ__/g, "'") : '';
    $('tb-s').textContent = 'Filtered: ' + [status, owner].filter(Boolean).join(' · ');
    renderPipe('', status, '', owner);
  },
};

// ════════════════════════════════════════════════════════════════
// DRAWERS — shared open/close + context dispatcher
// ════════════════════════════════════════════════════════════════
let drawerKey  = null;
let drawerType = null;

function openDrawer(title, bodyHTML, footHTML, type, dKey, subtitle) {
  drawerType = type;
  drawerKey  = dKey;
  if (subtitle) {
    $('drawer-title').innerHTML = `<span style="display:block">${title}</span><span style="display:block;font-size:.68rem;color:rgba(255,255,255,.55);font-weight:400;margin-top:1px">${subtitle}</span>`;
  } else {
    $('drawer-title').textContent = title;
  }
  $('drawer-body').innerHTML      = bodyHTML;
  $('drawer-foot').innerHTML      = footHTML;
  $('drawer-task-btn').style.display = 'none';
  $('drawer-overlay').classList.add('open');
  $('drawer').classList.add('open');
  // Fill all msg panels — scripts in innerHTML don't execute, so trigger explicitly
  setTimeout(() => {
    document.querySelectorAll('#drawer-body [data-msg-panel]').forEach(el => {
      _fillMsgPanel(el, el.dataset.msgPanel);
    });
  }, 0);
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
    // Also pass linked company (look up by client name)
    const pipeCoRow = row ? (DATA_COMPANIES||[]).find(c=>c.name===row.c) : null;
    const pipeCoId  = pipeCoRow ? (pipeCoRow.id||pipeCoRow.name) : (row ? row.c : '');
    openNewTask('opp', row ? esc(row.c + (row.p ? ' · ' + row.p : '')) : '', '', esc(pipeCoId));
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
      const el = $('f-q'); if (el) { el.value = c; renderPipe(c, '', '', ''); }
      setTimeout(() => openPipeDrawer((row.c + '|||' + row.p).replace(/'/g, '__SQ__')), 200);
    }, 100);
  }
}

function openOppFromTask(safeOpp) { openOppFromContact(safeOpp); }

function openCompanyFromName(safeName) {
  const name = safeName.replace(/__SQ__/g, "'");
  if (!name) return;
  const co = DATA_COMPANIES.find(c => c.name === name);
  UI.nav('companies', null);
  if (co) {
    setTimeout(() => openCompanyDrawer((co.id || co.name).replace(/'/g, '__SQ__')), 100);
  } else {
    // Company not in Companies sheet yet — just open Companies page
    setTimeout(() => { const el = $('coq'); if (el) { el.value = name; renderCompanies(name, ''); }}, 100);
  }
}

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
