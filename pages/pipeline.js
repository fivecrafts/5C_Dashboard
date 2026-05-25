'use strict';

// ════════════════════════════════════════════════════════════════
// PIPELINE PAGE — sortable table, status dropdowns, edit drawer
// ════════════════════════════════════════════════════════════════
function renderPipe(q, fs, fo) {
  if (q  === undefined) { const el = $('f-q'); q  = el ? el.value.toLowerCase() : ''; }
  if (fs === undefined) { const el = $('f-s'); if (el) fs = el.value; }
  if (fo === undefined) { const el = $('f-o'); if (el) fo = el.value; }
  q = q || ''; fs = fs || ''; fo = fo || '';

  const SO = { Running:0, Bidding:1, Pipeline:2, Prospect:3, Done:4, Cancelled:5 };
  const filtered = DATA_PIPE
    .filter(r =>
      (!q  || (r.c + r.p + r.d + r.r + r.rsp).toLowerCase().includes(q)) &&
      (!fs || r.s === fs) &&
      (!fo || r.r === fo)
    )
    .sort((a, b) => {
      if (SORT_COL === 's') return ((SO[a.s] ?? 9) - (SO[b.s] ?? 9)) * SORT_DIR;
      const av = (a[SORT_COL] || '').toLowerCase();
      const bv = (b[SORT_COL] || '').toLowerCase();
      return av < bv ? -SORT_DIR : av > bv ? SORT_DIR : 0;
    });

  const nch    = Object.keys(CHANGES).length;
  const cols   = ['c','p','d','cat','s','r','rsp'];
  const labels = ['Client','Project / Scope','Detail','Category','Status','Owner','Contact'];

  $('pipe-out').innerHTML = `
  <div class="legend" style="margin-bottom:14px;">
    <h3>Legend</h3>
    <div class="legend-grid">
      <div class="legend-section"><h4>Status</h4><div class="legend-items">
        ${ALL_S.map(s => `<span class="legend-item"><span class="legend-dot" style="background:var(--${
          s==='Running'?'green':s==='Bidding'?'purple':s==='Pipeline'?'blue':s==='Prospect'?'amber':s==='Done'?'slate2':'red'
        })"></span>${s}</span>`).join('')}
      </div></div>
      <div class="legend-section"><h4>Category &amp; Actions</h4>
        <div class="legend-items">
          <span class="cb cat-project">Project</span>
          <span class="cb cat-partnership">Partnership</span>
          <span class="cb cat-pipeline">Pipeline</span>
          <span class="cb cat-prospect">Prospect</span>
        </div>
        <div style="font-size:.68rem;color:var(--slate);margin-top:6px">Click row to edit all fields · Click contact name to view profile</div>
      </div>
    </div>
  </div>

  <div class="filter-bar">
    <input type="text" id="f-q" placeholder="🔍  Search…" value="${q}" oninput="renderPipe(this.value,undefined,undefined)">
    <select id="f-s" onchange="renderPipe(undefined,this.value,undefined)">
      <option value="">All Statuses</option>
      ${ALL_S.map(s => `<option value="${s}"${fs === s ? ' selected' : ''}>${s}</option>`).join('')}
    </select>
    <select id="f-o" onchange="renderPipe(undefined,undefined,this.value)">
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
      const contactDisplay = r.rsp
        ? `<span class="contact-link" onclick="openContactFromPipeline('${r.rsp.replace(/'/g, '__SQ__')}')" title="View contact profile">${r.rsp}</span>`
        : '—';
      return `<tr class="edit-row" onclick="openPipeDrawer('${safeKey}')">
        <td onclick="event.stopPropagation()"><div style="display:flex;align-items:center;gap:7px">${companyLogoFromName(r.c,20)}<span class="contact-link" style="font-size:.82rem;font-weight:600" onclick="openCompanyFromName('${r.c.replace(/'/g,'__SQ__')}')" title="View company">${r.c}</span></div></td>
        <td style="font-size:.73rem;color:var(--slate)">${r.p || '—'}</td>
        <td><div class="dc" title="${(r.d || '').replace(/"/g, "'")}">${r.d || '—'}</div></td>
        <td>${catBadge(r.cat)}</td>
        <td onclick="event.stopPropagation()"><select class="ssel${changed ? ' changed' : ''}" data-key="${k}" data-orig="${r.s}" onchange="onChg(this)">${opts}</select></td>
        <td onclick="event.stopPropagation()" style="font-size:.75rem">${r.r ? `<span class="contact-link" onclick="UI.nf('',null,'${r.r.replace(/'/g,'__SQ__')}')">${r.r}</span>` : '—'}</td>
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
  const n = Object.keys(CHANGES).length;
  $('chg-n').textContent = n;
  $('chip-chg').style.display = n > 0 ? 'inline-flex' : 'none';
  $('save-bar').className = 'save-bar' + (n > 0 ? ' on' : '');
  $('chg-count').textContent = n + (n === 1 ? ' change' : ' changes');
}

function sortBy(col) {
  if (SORT_COL === col) SORT_DIR *= -1; else { SORT_COL = col; SORT_DIR = 1; }
  renderPipe('', '', '');
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
    <div class="field-row">
      <div class="field-group"><label>Client Name</label><input id="d-c" value="${esc(row.c)}"></div>
      <div class="field-group"><label>Category</label><select id="d-cat">
        ${['Project','Partnership','Prospect','Pipeline'].map(v => `<option${row.cat === v ? ' selected' : ''}>${v}</option>`).join('')}
      </select></div>
    </div>
    <div class="field-group"><label>Project / Scope</label><input id="d-p" value="${esc(row.p)}"></div>
    <div class="field-group"><label>Detail / Roles &amp; Requirements</label><textarea id="d-d">${esc(row.d)}</textarea></div>
    <div class="field-row">
      <div class="field-group"><label>Status</label><select id="d-s">
        ${ALL_S.map(s => `<option value="${s}"${row.s === s ? ' selected' : ''}${!allowed.includes(s) && s !== row.s ? ' disabled style="color:#ccc"' : ''}>${s}</option>`).join('')}
      </select></div>
      <div class="field-group"><label>Project Start</label><input id="d-projStart" type="date" value="${row.projStart || ''}"></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Responsible</label>
        <input id="d-r" value="${esc(row.r)}" list="owners-list" autocomplete="off">
        <datalist id="owners-list">${(window.OWNERS || []).map(o => `<option value="${o}">`).join('')}</datalist>
      </div>
      <div class="field-group"><label>Contact</label><input id="d-rsp" value="${esc(row.rsp)}"></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Phone</label><input id="d-phone" value="${esc(row.phone || '')}"></div>
      <div class="field-group"><label>Email</label><input id="d-email" type="email" value="${esc(row.email || '')}"></div>
    </div>
    <div class="field-group"><label>Source</label><input id="d-src" value="${esc(row.src || '')}"></div>
    <div style="font-size:.7rem;color:var(--slate);margin-top:4px">Row ${row._row} · Created ${row.createdDate || '—'} · Updated ${row.updDate || '—'}</div>`;

  const foot = `
    <button class="sbtn sbtn-p" onclick="savePipeDrawer()" style="flex:1">✓ Save Changes</button>
    <button class="sbtn" style="background:var(--teal-t);color:var(--teal);border:1px solid var(--teal-l)" onclick="openNewTask('opp','${esc(row.c + (row.p ? ' · ' + row.p : ''))}','')">+ Task</button>
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
      const live = await P.readCell(row, 'E');
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
    cat:       $('d-cat').value,
    s:         newS,
    r:         $('d-r').value.trim(),
    rsp:       $('d-rsp').value.trim(),
    phone:     $('d-phone').value.trim(),
    email:     $('d-email').value.trim(),
    projStart: $('d-projStart').value,
    src:       $('d-src').value.trim(),
  };
  try {
    const ok = await P.savePipelineRow(row, fields);
    if (ok) {
      Object.assign(row, fields);
      delete CHANGES[drawerKey];
      updateCounts(); renderDash(); renderPipe('', '', '');
      toast('✓ Saved', 'success'); closeDrawer();
    } else toast('⚠ Save failed', 'error');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}
