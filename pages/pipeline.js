// 5C Dashboard v1.30.0 · 2026-06-17 10:00 · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// DROPDOWN BUILDERS — called from renderPipe template literal
// Using functions avoids nested template literal parsing issues
// ════════════════════════════════════════════════════════════════
function buildStatusDrop(r, k, safeKey) {
  const menuId  = 'sm-' + safeKey;
  const cur     = r.s;
  const allowed = FLOW[r.s] || ALL_S;
  const safeK   = k.replace(/'/g, '__SQ__');
  const opts = ALL_S.map(s => {
    const dis    = !allowed.includes(s) && s !== r.s;
    const safeS  = s.replace(/'/g, '');
    const safeOr = r.s.replace(/'/g, '');
    return `<div class="cdrop-opt${cur===s?' active':''}${dis?' disabled':''}" data-skey="${safeK}" onclick="closeDrop();onChgDirect('${safeK}','${safeOr}','${safeS}')">${statusDot(s)}<span>${s}</span></div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()"><div class="cdrop-trigger" data-skey="${safeK}" onclick="event.stopPropagation();openDrop('${menuId}',this)">${statusDot(cur)}<span>${cur}</span><span class="arr">▾</span></div><div class="cdrop-menu" id="${menuId}">${opts}</div></div>`;
}

function buildPrioDrop(r, k, safeKey) {
  const menuId = 'pm-' + safeKey;
  const cur    = r.prio || 'Medium';
  const origP  = cur.replace(/'/g, '');
  const safeK  = k.replace(/'/g, '__SQ__');
  const opts   = PRIORITIES.map(p => {
    const safeP = p.replace(/'/g, '');
    return `<div class="cdrop-opt${cur===p?' active':''}" onclick="closeDrop();onPrioChgDirect('${safeK}','${origP}','${safeP}')">${prioDot(p)}<span>${p}</span></div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()"><div class="cdrop-trigger" onclick="event.stopPropagation();openDrop('${menuId}',this)">${prioDot(cur)}<span>${cur}</span><span class="arr">▾</span></div><div class="cdrop-menu" id="${menuId}">${opts}</div></div>`;
}

// ════════════════════════════════════════════════════════════════
// PIPELINE PAGE — sortable table, status dropdowns, edit drawer
// ════════════════════════════════════════════════════════════════
function renderPipe(q, fs, fp, fo) {
  if (q  === undefined) { const el = $('f-q'); q  = el ? el.value.toLowerCase() : ''; }
  if (fs === undefined) { const el = $('f-s'); if (el) fs = el.value; }
  if (fp === undefined) { const el = $('f-p'); if (el) fp = el.value; }
  if (fo === undefined) { const el = $('f-o'); if (el) fo = el.value; }
  q = q || ''; fs = fs || ''; fp = fp || ''; fo = fo || '';

  const SO = { Running:0, Bidding:1, Pipeline:2, Prospect:3, Done:4, Cancelled:5 };
  const PO = {'Critical':0,'High':1,'Medium':2,'Low':3};
  const SO2= {'Running':0,'Bidding':1,'Pipeline':2,'Prospect':3,'Done':4,'Cancelled':5};
  const filtered = DATA_PIPE
    .filter(r =>
      (!q  || (r.c + r.p + r.d + r.owner + r.contact).toLowerCase().includes(q)) &&
      (!fs || r.s === fs) &&
      (!fp || (r.prio||'Medium') === fp) &&
      (!fo || r.owner === fo)
    )
    .sort((a,b) => {
      const pd = (PO[a.prio||'Medium']??2) - (PO[b.prio||'Medium']??2);
      if (pd !== 0) return pd;
      const sd = (SO2[a.s]??9) - (SO2[b.s]??9);
      if (sd !== 0) return sd;
      return (a.c||'').localeCompare(b.c||'');
    })
    .sort((a, b) => {
      if (SORT_COL === 's') return ((SO[a.s] ?? 9) - (SO[b.s] ?? 9)) * SORT_DIR;
      const av = (a[SORT_COL] || '').toLowerCase();
      const bv = (b[SORT_COL] || '').toLowerCase();
      return av < bv ? -SORT_DIR : av > bv ? SORT_DIR : 0;
    });

  const nch    = Object.keys(CHANGES).length;
  const cols   = ['c','p','d','prio','s','owner','contact'];
  const labels = ['Client','Project / Scope','Detail','Priority','Status','Owner','Contact'];

  const _foc = _saveFocus();
  $('pipe-out').innerHTML = `
  <div class="legend" style="margin-bottom:14px;">
    <h3>Legend</h3>
    <div class="legend-grid">
      <div class="legend-section"><h4>Status</h4><div class="legend-items">
        ${ALL_S.map(s => `
  _restoreFocus(_foc);<span class="legend-item"><span class="legend-dot" style="background:var(--${
          s==='Running'?'green':s==='Bidding'?'purple':s==='Pipeline'?'blue':s==='Prospect'?'amber':s==='Done'?'slate2':'red'
        })"></span>${s}</span>`).join('')}
      </div></div>
      <div class="legend-section"><h4>Actions</h4>
        <div style="font-size:.68rem;color:var(--slate);margin-top:4px">Click row to edit all fields · Click Client name for Company · Click Contact name for profile</div>
      </div>
    </div>
  </div>

  <div class="filter-bar">
    <input type="text" id="f-q" placeholder="🔍  Search…" value="${q}" oninput="renderPipe(this.value,undefined,undefined,undefined)">
    <select id="f-s" onchange="renderPipe(undefined,this.value,undefined,undefined)">
      <option value="">All Statuses</option>
      ${ALL_S.map(s => `<option value="${s}"${fs === s ? ' selected' : ''}>${s}</option>`).join('')}
    </select>
    <select id="f-p" onchange="renderPipe(undefined,undefined,this.value,undefined)">
      <option value="">All Priorities</option>
      ${PRIORITIES.map(p => `<option value="${p}"${fp === p ? ' selected' : ''}>${p}</option>`).join('')}
    </select>
    <select id="f-o" onchange="renderPipe(undefined,undefined,undefined,this.value)">
      <option value="">All Owners</option>
      ${(window.OWNERS || []).map(o => `<option${fo === o ? ' selected' : ''}>${o}</option>`).join('')}
    </select>
    <span class="cnt">${filtered.length}/${DATA_PIPE.length}${nch > 0 ? ' · <b style="color:var(--amber)">' + nch + ' pending</b>' : ''}</span>
  </div>

  <div class="tbl-wrap"><table>
    <thead><tr>${cols.map((col, i) => {
      const cls = SORT_COL === col ? (SORT_DIR === 1 ? 'sort-asc' : 'sort-desc') : '';
      return `<th class="sortable ${cls}" onclick="sortBy('${col}')">${labels[i]}</th>`;
    }).join('')}</tr></thead>
    <tbody>${filtered.map(r => {
      const k       = key(r);
      const cur     = CHANGES[k] ?? r.s;
      const allowed = FLOW[r.s] || ALL_S;
      const changed = CHANGES[k] !== undefined;
      const opts    = ALL_S.map(s =>
        `<option value="${s}"${cur === s ? ' selected' : ''}${!allowed.includes(s) && s !== r.s ? ' disabled style="color:#ccc"' : ''}>${s}</option>`
      ).join('');
      const safeKey = k.replace(/'/g, '__SQ__');
      const contactDisplay = r.contact
        ? `<span class="contact-link" onclick="openContactFromPipeline('${r.contact.replace(/'/g, '__SQ__')}')" title="View contact profile">${r.contact}</span>`
        : '—';
      return `<tr class="edit-row" onclick="openPipeDrawer('${safeKey}')">
        <td onclick="event.stopPropagation()"><div style="display:flex;align-items:center;gap:7px">${companyLogoFromName(r.c,20)}<span class="contact-link" style="font-size:.82rem;font-weight:600" onclick="openCompanyFromName('${r.c.replace(/'/g,'__SQ__')}')" title="View company">${r.c}</span></div></td>
        <td style="font-size:.73rem;color:var(--slate)">${r.p || '—'}</td>
        <td><div class="dc" title="${(r.d || '').replace(/"/g, "'")}">${r.d || '—'}</div></td>
        <td onclick="event.stopPropagation()">${buildPrioDrop(r, k, safeKey)}</td>
        <td onclick="event.stopPropagation()">${buildStatusDrop(r, k, safeKey)}</td>
        <td onclick="event.stopPropagation()" style="font-size:.75rem">${r.owner ? `<span class="contact-link" onclick="UI.nf('',null,'${r.owner.replace(/'/g,'__SQ__')}')">${r.owner}</span>` : '—'}</td>
        <td onclick="event.stopPropagation()">${contactDisplay}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;

  $('save-bar').className = 'save-bar' + (nch > 0 ? ' on' : '');
  $('chg-count').textContent = nch + (nch === 1 ? ' change' : ' changes');
}

function onChg(sel) {
  const k = sel.dataset.key, orig = sel.dataset.orig, nv = sel.value;
  if (nv === orig) delete CHANGES[k]; else CHANGES[k] = nv;
  sel.className = 'ssel' + (CHANGES[k] !== undefined ? ' changed' : '');
  _refreshBar();
}

async function onChgDirect(k, orig, nv) {
  if (nv === orig) return;
  const [c, p] = k.split('|||');
  const row = DATA_PIPE.find(r => r.c === c && r.p === p);
  if (!row) return;
  const trigger = document.querySelector(`[data-skey="${k}"]`);
  if (trigger) trigger.style.opacity = '.5';
  try {
    const ok = await P.saveStatusOnly(row, nv);
    if (ok) {
      row.s = nv;
      toast('✓ Status → ' + nv, 'success');
    } else {
      toast('⚠ Save failed', 'error');
    }
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  renderPipe(undefined, undefined, undefined, undefined);
}

async function onPrioChgDirect(k, orig, nv) {
  if (nv === orig) return;
  const [c, p] = k.split('|||');
  const row = DATA_PIPE.find(r => r.c === c && r.p === p);
  if (!row) return;
  try {
    const ok = await P.savePriorityOnly(row, nv);
    if (ok) {
      row.prio = nv;
      toast('✓ Priority → ' + nv, 'success');
    } else {
      toast('⚠ Save failed', 'error');
    }
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  renderPipe(undefined, undefined, undefined, undefined);
}

function _refreshBar() {} // no-op — kept for compat

function onPrioChg(sel) {
  const k = sel.dataset.pkey, orig = sel.dataset.porig, nv = sel.value;
  if (nv === orig) delete PRIO_CHANGES[k]; else PRIO_CHANGES[k] = nv;
  sel.className = 'ssel' + (PRIO_CHANGES[k] !== undefined ? ' changed' : '');
  _refreshBar();
}

// ── Create new contact directly from Opportunity drawer ──────────
// Creates the contact in Contacts sheet and then links it to Pipeline col J
async function openNewContactFromOpp(pipeRow, companyName) {
  // Resolve company name from safeKey
  const coName = (companyName || '').replace(/__SQ__/g, "'");
  // Build a mini-form in a confirm dialog approach:
  // We'll open a new overlay inside the existing drawer
  const overlay = document.createElement('div');
  overlay.id = 'contact-mini-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--card);border-radius:14px;padding:24px;width:380px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="font-weight:700;font-size:.95rem;color:var(--navy2);margin-bottom:16px">+ New Contact</div>
      <div class="field-row">
        <div class="field-group"><label>First Name</label><input id="ncf-fn" placeholder="First…" autofocus></div>
        <div class="field-group"><label>Last Name</label><input id="ncf-ln" placeholder="Last…"></div>
      </div>
      <div class="field-group"><label>Company</label>
        <select id="ncf-co">
          <option value="">— None —</option>
          ${(DATA_COMPANIES||[]).map(c=>`<option value="${esc(c.name)}"${c.name===coName?' selected':''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Email</label><input id="ncf-em" type="email" placeholder="email@…"></div>
        <div class="field-group"><label>Phone</label><input id="ncf-ph" placeholder="+420…"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button onclick="createContactFromOpp(${pipeRow})" style="flex:1;padding:9px;background:var(--blue);color:#fff;border:none;border-radius:8px;font-family:var(--font);font-weight:600;cursor:pointer">✓ Create &amp; Link</button>
        <button onclick="document.getElementById('contact-mini-overlay').remove()" style="padding:9px 14px;background:var(--card);border:1px solid var(--border);border-radius:8px;font-family:var(--font);cursor:pointer">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function createContactFromOpp(pipeRowNum) {
  const fn = $('ncf-fn').value.trim();
  const ln = $('ncf-ln').value.trim();
  if (!fn && !ln) { toast('Enter a name','error'); return; }
  const companyName = $('ncf-co').value.trim();
  const coRow = DATA_COMPANIES.find(c => c.name === companyName);
  const fields = {
    firstName: fn, lastName: ln,
    company:   companyName,
    email:     $('ncf-em').value.trim(),
    phone:     $('ncf-ph').value.trim(),
    web: '', src: 'Manual user input',
    coId: coRow ? (coRow.id || '') : '',
  };
  toast('Creating contact…','info');
  try {
    await P.createContact(fields);
    // Reload contacts
    const j = await P.loadSheet(activeCfg.sheets.contacts);
    DATA_CONTACTS = P.parseContacts(j);
    // Link the new contact to the pipeline row
    const fullName = (fn + ' ' + ln).trim();
    const today = new Date().toISOString().slice(0,10);
    await P.patchRange(activeCfg.sheets.pipeline, `J${pipeRowNum}`, [[fullName]]);
    await P.patchRange(activeCfg.sheets.pipeline, `H${pipeRowNum}`, [[today]]);
    // Update in-memory pipeline row
    const pRow = DATA_PIPE.find(r => r._row === pipeRowNum);
    if (pRow) pRow.contact = fullName;
    // Update the contact select in the still-open drawer
    const sel = $('d-rsp');
    if (sel) {
      const opt = document.createElement('option');
      opt.value = fullName; opt.text = fullName + (companyName?' · '+companyName:'');
      opt.selected = true;
      sel.appendChild(opt);
    }
    document.getElementById('contact-mini-overlay')?.remove();
    renderPipe(undefined,undefined,undefined,undefined);
    toast(`✓ Contact ${fullName} created and linked`,'success');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ── Archive Opportunity ──────────────────────────────────────
async function archiveOpp(k) {
  const key = k.replace(/__SQ__/g,"'");
  const [c, p] = key.split('|||');
  const row = DATA_PIPE.find(r => r.c === c && r.p === p);
  if (!row) return;
  // Check: no linked tasks
  const linkedTasks = DATA_TASKS.filter(t =>
    t.linkedOpp && t.linkedOpp.includes(c) && t.status !== 'Cancelled'
  );
  if (linkedTasks.length > 0) {
    toast(`⚠ Cannot archive — ${linkedTasks.length} open task(s) linked. Cancel them first.`, 'error');
    return;
  }
  if (!confirm(`Archive "${c}${p?' · '+p:''}"?\nIt will be hidden from all views but kept in Excel.`)) return;
  try {
    await P.archiveRecord(activeCfg.sheets.pipeline, row._row, 'N');
    toast('✓ Archived', 'success');
    closeDrawer();
    const j = await P.loadSheet(activeCfg.sheets.pipeline);
    DATA_PIPE = P.parsePipeline(j);
    updateCounts(); renderPipe('','','','');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function sortBy(col) {
  if (SORT_COL === col) SORT_DIR *= -1; else { SORT_COL = col; SORT_DIR = 1; }
  renderPipe('', '', '', '');
}

// ── Pipeline Edit Drawer ──────────────────────────────────────
function openPipeDrawer(safeKey) {
  const k   = safeKey.replace(/__SQ__/g, "'");
  const [c, p] = k.split('|||');
  const row = DATA_PIPE.find(r => r.c === c && r.p === p);
  if (!row) return;
  drawerKey = k;
  const allowed = FLOW[row.s] || ALL_S;

  const body = `
    <div class="field-group"><label>Client</label>
        <div style="display:flex;align-items:center;gap:8px">
          <div id="d-c-logo" style="flex-shrink:0">${companyLogoFromName(row.c, 28)}</div>
          <select id="d-c" style="flex:1" onchange="(()=>{const co=(DATA_COMPANIES||[]).find(c=>c.name===this.value);$('d-c-logo').innerHTML=co?companyLogo(co.website,co.name,28):companyLogoFromName(this.value,28);})()">
            <option value="">— Select company —</option>
            ${[...(DATA_COMPANIES||[])].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(c=>`<option value="${esc(c.name)}"${row.c===c.name?' selected':''}>${c.name}</option>`).join('')}
          </select>
        </div></div>
    <div class="field-group"><label>Project / Scope</label><input id="d-p" value="${esc(row.p)}"></div>
    <div class="field-group"><label>Detail / Roles &amp; Requirements</label><textarea id="d-d">${esc(row.d)}</textarea></div>
    <div class="field-row">
      <div class="field-group"><label>Status</label>
        ${buildDrawerStatusDrop('d-s', row.s, allowed, ALL_S)}
      </div>
      <div class="field-group"><label>Priority</label>
        ${buildDrawerPrioDrop('d-prio', row.prio||'Medium')}
      </div>
    </div>
    <div class="field-group"><label>Project Start</label><input id="d-projStart" type="date" value="${row.projStart || ''}"></div>
    <div class="field-row">
      <div class="field-group"><label>Owner</label>
        <select id="d-r">
          ${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();return `<option value="${n}"${(row.owner||'')=== n?' selected':''}>${n}</option>`;}).join('')}
        </select>
      </div>
      <div class="field-group"><label>Contact</label>
        <div style="display:flex;gap:6px;align-items:center">
          <select id="d-rsp" style="flex:1">
            <option value="">— None —</option>
            ${[...(DATA_CONTACTS||[])].sort((a,b)=>(a.lastName||'').localeCompare(b.lastName||'') || (a.firstName||'').localeCompare(b.firstName||'')).map(c=>{
              const n=contactDisplayName(c);
              const stored=((c.firstName||'')+' '+(c.lastName||'')).trim();
              return `<option value="${esc(stored)}"${(row.contact||'')=== stored?' selected':''}>${n}${c.company?' · '+c.company:''}</option>`;
            }).join('')}
          </select>
          <button type="button" onclick="openNewContactFromOpp('${row._row}','${esc(row.c)}')"
            style="padding:5px 10px;border:1px solid var(--teal-l);border-radius:6px;background:var(--teal-t);color:var(--teal);font-size:.72rem;font-family:var(--font);cursor:pointer;white-space:nowrap;flex-shrink:0">+ New</button>
        </div>
      </div>
    </div>

    <div class="field-group"><label>Source</label><input id="d-src" value="${esc(row.src || '')}"></div>
    <div style="font-size:.7rem;color:var(--slate);margin-top:4px">Row ${row._row} · Created ${row.createdDate || '—'} · Updated ${row.updDate || '—'}</div>`;

  const foot = `
    <button class="sbtn sbtn-p" onclick="savePipeDrawer()" style="flex:1">✓ Save Changes</button>
    <button class="sbtn" style="background:var(--teal-t);color:var(--teal);border:1px solid var(--teal-l)" onclick="openNewTask('opp','${esc(row.c + (row.p ? ' · ' + row.p : ''))}','')">+ Task</button>
    <button class="sbtn" style="background:#fff5f5;color:var(--red);border:1px solid var(--red-l)" onclick="archiveOpp('${esc(k)}')">⊘ Archive</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;

  openDrawer((row.c + (row.p ? ' · ' + row.p : '')) || 'Edit Opportunity', body, foot, 'pipeline', k);
}

async function savePipeDrawer(forceOverwrite = false) {
  const [c, p] = drawerKey.split('|||');
  const row    = DATA_PIPE.find(r => r.c === c && r.p === p);
  if (!row) return;
  const newS = $('d-s').value;

  if (!forceOverwrite) {
    try {
      const live = await P.readCell(row, 'E'); // Rev 22: Status=col E
      if (live && live !== row.s) {
        showConflict({ field:'Status', liveVal:live, ourVal:newS, client:row.c, project:row.p });
        return;
      }
    } catch (e) { console.warn('Conflict check failed', e); }
  }

  toast('Saving…', 'info');
  const fields = {
    c:         $('d-c').value.trim() || row.c,
    p:         $('d-p').value.trim(),
    d:         $('d-d').value.trim(),
    s:         newS,
    prio:      $('d-prio').value,
    owner:     $('d-r').value.trim(),
    contact:   $('d-rsp').value.trim(),
    projStart: $('d-projStart').value,
    src:       $('d-src').value.trim(),
    coId:      row.coId || '',
  };
  try {
    const ok = await P.savePipelineRow(row, fields);
    if (ok) {
      Object.assign(row, fields);
      delete CHANGES[drawerKey];
      updateCounts(); renderDash(); renderPipe('', '', '', '');
      toast('✓ Saved', 'success'); closeDrawer();
    } else toast('⚠ Save failed', 'error');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}
