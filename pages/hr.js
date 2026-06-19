// 5C Dashboard v1.38.3 · 2026-06-19 · Five Crafts s.r.o.
// 5C Dashboard v1.34.0 · 2026-06-18 15:00 · Five Crafts s.r.o.
'use strict';

// Defensive init — in case state.js update wasn't uploaded
if (typeof DATA_HR      === 'undefined') window.DATA_HR      = [];
if (typeof DATA_HR_COLS === 'undefined') window.DATA_HR_COLS = {};


// ════════════════════════════════════════════════════════════════
// HR POOL — helpers
// ════════════════════════════════════════════════════════════════

let _hrShowRates     = false; // rates hidden in list by default
let _hrDrawerRates  = false; // rates hidden in drawer by default
let _hrSource       = 'both'; // 'hr' | 'pool' | 'both'
let _hrActiveGroups = new Set(); // clicked group labels for multi-select filter

function hrToggleGroup(label) {
  if (_hrActiveGroups.has(label)) _hrActiveGroups.delete(label);
  else _hrActiveGroups.add(label);
  renderHR();
}

function hrSeniorityStars(seniority) {
  const s = (seniority||'').toLowerCase();
  if (s.includes('senior')) return '<span style="color:#f59e0b;letter-spacing:1px">★★★</span>';
  if (s.includes('medior') || s.includes('mid'))
    return '<span style="color:#3b82f6;letter-spacing:1px">★★</span><span style="color:#cbd5e1;letter-spacing:1px">★</span>';
  if (s.includes('junior'))
    return '<span style="color:#10b981;letter-spacing:1px">★</span><span style="color:#cbd5e1;letter-spacing:1px">★★</span>';
  return '<span style="color:#cbd5e1;letter-spacing:1px">★★★</span>';
}

function hrSourceBadge(src) {
  if (src === 'pool') return '<span style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:.6rem;font-weight:700;background:#fef3c7;color:#92400e;margin-left:4px">POOL</span>';
  return '<span style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:.6rem;font-weight:700;background:#dbeafe;color:#1e40af;margin-left:4px">HR</span>';
}

function hrRoleIcon(role) {
  const r = (role||'').toLowerCase();
  if (/analyst|architect/.test(r))                          return '🧩';
  if (/card|acquiring/.test(r))                             return '💳';
  if (/project|delivery|product|owner/.test(r))            return '🧭';
  if (/risk|compliance|cyber|security/.test(r))            return '🛡️';
  if (/finance|cfo|financial/.test(r))                     return '💰';
  if (/developer|software|mobile|qa|test|admin/.test(r))   return '💻';
  if (/hr|legal|generalist/.test(r))                       return '🤝';
  return '🙋';
}

function hrStatusBadge(status) {
  const s = status || '—';
  let style = 'background:#f1f5f9;color:#64748b';
  if (HR_STATUS_GROUP.blue.includes(s))  style = 'background:#dbeafe;color:#1e40af';
  if (HR_STATUS_GROUP.amber.includes(s)) style = 'background:#fef3c7;color:#92400e';
  if (HR_STATUS_GROUP.green.includes(s)) style = 'background:#d1fae5;color:#065f46';
  if (HR_STATUS_GROUP.red.includes(s))   style = 'background:#fee2e2;color:#991b1b';
  return `<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:700;${style}">${s}</span>`;
}

function hrInitials(c) {
  const f = (c.firstName||'')[0]||'', l = (c.lastName||'')[0]||'';
  return (f+l).toUpperCase() || (c.name||'?')[0].toUpperCase();
}

function hrAvatar(c, size) {
  size = size || 32;
  const ini = hrInitials(c);
  const colors = ['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#0891b2'];
  const ci = (c.id||'FC_000').replace(/\D/g,'') % colors.length;
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;background:${colors[ci]};color:#fff;align-items:center;justify-content:center;font-size:${Math.round(size*.38)}px;font-weight:700;flex-shrink:0">${ini}</span>`;
}

function hrCompTags(competencies, max) {
  max = max || 3;
  if (!competencies) return '—';
  const tags = competencies.split(',').map(t=>t.trim()).filter(Boolean);
  const shown = tags.slice(0, max);
  const rest  = tags.length - max;
  const html  = shown.map(t => `<span style="display:inline-block;padding:1px 6px;border-radius:10px;font-size:.65rem;font-weight:600;background:#ede9fe;color:#6d28d9;margin:1px">${esc(t)}</span>`).join('');
  return html + (rest > 0 ? `<span style="font-size:.68rem;color:var(--slate);margin-left:3px" title="${tags.slice(max).join(', ')}">+${rest}</span>` : '');
}

function hrNotesTimeline(notes) {
  if (!notes) return '<span style="color:var(--slate2);font-size:.77rem">No notes yet</span>';
  return notes.split(' | ').filter(Boolean).map(entry => {
    const m = entry.match(/^(.*?)\((\d{4}-\d{2}-\d{2})\):\s*(.*)/s);
    if (m) {
      return `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          <span style="font-size:.65rem;font-weight:700;color:var(--blue)">${m[2]}</span>
          <span style="font-size:.65rem;color:var(--slate2)">${m[1].trim()}</span>
        </div>
        <div style="font-size:.78rem;color:var(--navy2)">${esc(m[3].trim())}</div>
      </div>`;
    }
    return `<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:.78rem;color:var(--navy2)">${esc(entry.trim())}</div>`;
  }).join('');
}

function hrAge(dob) {
  if (!dob) return '';
  const d = new Date(dob); if (isNaN(d)) return '';
  const age = Math.floor((new Date() - d) / (365.25*24*3600*1000));
  return isNaN(age) ? '' : `${age}y`;
}

// ── Inline status dropdown ────────────────────────────────────────
function buildHRStatusDrop(c) {
  const menuId = 'hrsd-' + (c.id||'').replace(/[^a-z0-9]/gi,'_');
  const cur    = c.status || '—';
  const opts   = HR_STATUSES.map(s => {
    const safeId = (c.id||'').replace(/'/g,'__SQ__');
    return `<div class="cdrop-opt${cur===s?' active':''}" onclick="closeDrop();saveHRStatusDirect('${safeId}','${s}')">${hrStatusBadge(s)}</div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()">
    <div class="cdrop-trigger" onclick="event.stopPropagation();openDrop('${menuId}',this)" style="min-width:130px;gap:6px">
      ${hrStatusBadge(cur)}<span class="arr" style="margin-left:auto">▾</span>
    </div>
    <div class="cdrop-menu" id="${menuId}" style="min-width:160px">${opts}</div>
  </div>`;
}

async function saveHRStatusDirect(safeId, newS) {
  const id = safeId.replace(/__SQ__/g,"'");
  const c  = DATA_HR.find(r => r.id === id);
  if (!c || c.status === newS) return;
  try {
    const ok = await P.saveHRStatus(c, newS);
    if (ok) { c.status = newS; renderHR(); toast(`✓ Status → ${newS}`, 'success'); }
    else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ── Competency chip helpers ─────────────────────────────────────
function hrRemoveComp(safeVal) {
  const val = safeVal.replace(/__SQ__/g,"'");
  const chips = document.getElementById('hrd-comp-chips');
  if (!chips) return;
  chips.querySelectorAll('span[data-val]').forEach(s => { if (s.dataset.val === val) s.remove(); });
  _updateChipHidden('hrd-comp-chips', 'hrd-comp');
  // Refresh the add dropdown (add back removed item)
  const sel = document.getElementById('hrd-comp-add');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = val;
    // Insert alphabetically
    const opts = [...sel.options].filter(o => o.value);
    const insertBefore = opts.find(o => o.value.localeCompare(val) > 0);
    if (insertBefore) sel.insertBefore(opt, insertBefore);
    else sel.appendChild(opt);
  }
}
function hrAddComp(sel) {
  const val = sel.value; if (!val) return;
  const hidden = document.getElementById('hrd-comp');
  const chips  = document.getElementById('hrd-comp-chips');
  if (!chips) return;
  // Avoid duplicates
  if ([...chips.querySelectorAll('span[data-val]')].some(s => s.dataset.val === val)) { sel.value=''; return; }
  const safeVal = val.replace(/'/g,'__SQ__');
  const span = document.createElement('span');
  span.dataset.val = val;
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:#ede9fe;color:#6d28d9;margin:1px';
  span.innerHTML = `${esc(val)}<span onclick="hrRemoveComp('${safeVal}')" style="cursor:pointer;font-weight:700;margin-left:2px;opacity:.7">×</span>`;
  chips.appendChild(span);
  _updateChipHidden('hrd-comp-chips', 'hrd-comp');
  // Remove from dropdown
  const opt = [...sel.options].find(o => o.value === val);
  if (opt) opt.remove();
  sel.value = '';
}

// ════════════════════════════════════════════════════════════════
// HR LIST VIEW
// ════════════════════════════════════════════════════════════════
function renderHR(q, frole, fsen, fstat, fown) {
  if (q     === undefined) { const el=$('hrq');    q     = el?el.value:''; }
  if (frole === undefined) { const el=$('hrole');  frole = el?el.value:''; }
  if (fsen  === undefined) { const el=$('hrsen');  fsen  = el?el.value:''; }
  if (fstat === undefined) { const el=$('hrstat'); fstat = el?el.value:''; }
  if (fown  === undefined) { const el=$('hrown');  fown  = el?el.value:''; }
  const qLow = (q||'').toLowerCase();

  // Merge sources based on toggle
  const _allCands = [
    ...(_hrSource === 'pool' ? [] : DATA_HR.map(c => ({...c, _source:'hr'}))),
    ...(_hrSource === 'hr'   ? [] : DATA_POOL),
  ];
  const filtered = _allCands.filter(c => {
    if (!qLow  && !frole && !fsen && !fstat && !fown && !_hrActiveGroups.size) return true;
    const fields = [(c.name||''),(c.displayName||''),(c.role||''),(c.competencies||''),(c.notes||''),(c.note5c||''),(c.result||''),(c.noteGeneral||''),(c.owner||''),(c.seniority||''),(c.email||''),(c.phone||''),(c.activeSearch||''),(c.specializace||'')].join(' ').toLowerCase();
    if (qLow   && !fields.includes(qLow))   return false;
    if (frole  && c.role !== frole)          return false;
    if (fsen   && c.seniority !== fsen)      return false;
    if (fstat  && c.status !== fstat)        return false;
    if (fown   && c.owner !== fown)          return false;
    if (_hrActiveGroups.size) {
      // Match against HR_ROLE_GROUPS roles arrays (same logic as stat cards)
      const matchedGroup = HR_ROLE_GROUPS.find(g => g.roles.some(r => (c.role||'').toLowerCase().includes(r.toLowerCase())));
      const grpLabel = matchedGroup ? matchedGroup.label : 'Other';
      if (!_hrActiveGroups.has(grpLabel)) return false;
    }
    return true;
  }).sort((a,b) => (a.lastName||'').localeCompare(b.lastName||'')||(a.firstName||'').localeCompare(b.firstName||''));

  const total = filtered.length;

  // Role options
  const roles = [...new Set(DATA_HR.map(c=>c.role).filter(Boolean))].sort();

  const _foc = _saveFocus();
  $('hr-out').innerHTML = `
  <!-- Role group comparison: HR Candidates vs Search Pool -->
  ${(()=>{
     let html = '<div class="stats-row">';
     HR_ROLE_GROUPS.forEach(g => {
       const hrCnt   = (DATA_HR   ||[]).filter(c => g.roles.some(r => (c.role||'').toLowerCase().includes(r.toLowerCase()))).length;
       const poolCnt = (DATA_POOL ||[]).filter(c => g.roles.some(r => (c.role||'').toLowerCase().includes(r.toLowerCase()))).length;
       if (hrCnt + poolCnt === 0) return;
       const isActive = _hrActiveGroups.has(g.label);
       const bg = isActive ? 'background:var(--accent);border-color:var(--accent)' : '';
       const lc = isActive ? 'color:rgba(255,255,255,.85)' : '';
       const p1 = isActive ? 'background:rgba(255,255,255,.25);color:#fff' : 'background:#eff6ff;color:var(--accent)';
       const p2 = isActive ? 'background:rgba(255,255,255,.25);color:#fff' : 'background:#fffbeb;color:var(--amber)';
       html += '<div class="stat-card clickable' + (isActive ? ' active' : '') + '" style="' + bg + ';cursor:pointer" onclick="hrToggleGroup(\'' + g.label.replace(/'/g,"\\'") + '\')" title="Filter by ' + g.label + '">';
       html += '<div class="sc-icon">' + g.icon + '</div>';
       html += '<div class="sc-lbl" style="' + lc + '">' + g.label + '</div>';
       html += '<div class="sc-pills"><span class="sc-pill" style="' + p1 + '">HR ' + hrCnt + '</span><span class="sc-pill" style="' + p2 + '">Pool ' + poolCnt + '</span></div>';
       html += '</div>';
     });
     html += '</div>';
     return html;
  })()}

    <div class="filter-bar">
    <input type="text" id="hrq" placeholder="🔍  Search name, role, skills…" value="${esc(q)}" oninput="renderHR()">
    <select id="hrole" onchange="renderHR()">
      <option value="">All Roles</option>
      ${roles.map(r=>`<option value="${esc(r)}"${frole===r?' selected':''}>${r}</option>`).join('')}
    </select>
    <select id="hrsen" onchange="renderHR()">
      <option value="">All Seniority</option>
      ${HR_SENIORITY.map(s=>`<option value="${s}"${fsen===s?' selected':''}>${s}</option>`).join('')}
    </select>
    <select id="hrstat" onchange="renderHR()">
      <option value="">All Statuses</option>
      ${HR_STATUSES.map(s=>`<option value="${s}"${fstat===s?' selected':''}>${s}</option>`).join('')}
    </select>
    <select id="hrown" onchange="renderHR()">
      <option value="">All Owners</option>
      ${HR_OWNERS.map(o=>`<option value="${o}"${fown===o?' selected':''}>${o}</option>`).join('')}
    </select>
    <span class="cnt">${total}/${_allCands.length}</span>
    ${_hrActiveGroups.size ? `<button class="btn btn-secondary btn-sm" onclick="_hrActiveGroups.clear();renderHR()">✕ Clear filter</button>` : ''}
    <div style="display:flex;border:1px solid var(--border);border-radius:7px;overflow:hidden;flex-shrink:0">
      ${['hr','both','pool'].map(s=>`<button onclick="_hrSource='${s}';renderHR()" style="padding:5px 10px;font-size:.72rem;font-weight:600;border:none;cursor:pointer;background:${_hrSource===s?'var(--navy2)':'var(--card)'};color:${_hrSource===s?'#fff':'var(--slate)'}">${s==='hr'?'HR Candidates':s==='pool'?'Search Pool':'Both'}</button>`).join('')}
    </div>
    <button onclick="_hrShowRates=!_hrShowRates;renderHR()" style="border:1px solid var(--border);background:${_hrShowRates?'var(--blue-t)':'var(--card)'};color:${_hrShowRates?'var(--blue)':'var(--slate)'};border-radius:7px;padding:5px 11px;cursor:pointer;font-size:.78rem">${_hrShowRates?'💰 Hide Rates':'💰 Show Rates'}</button>
  </div>

  ${DATA_HR.length === 0 ? `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:32px;text-align:center;color:var(--slate)">
      <div style="font-size:2rem;margin-bottom:8px">👤</div>
      <div style="font-weight:600;margin-bottom:4px">HR data loading…</div>
      <div style="font-size:.78rem">Data loads in the background — try again in a moment</div>
    </div>` :
  `<div class="tbl-wrap"><table>
    <thead><tr>
      <th>Candidate</th><th>Role</th><th>Seniority</th><th>Status</th>
      <th>Owner</th><th>Skills</th>${_hrShowRates?'<th>Rate</th>':''}<th></th>
    </tr></thead>
    <tbody>${filtered.map(c => {
      const safeId = (c.id||'').replace(/'/g,'__SQ__');
      const li = c.linkedin ? `<a href="${safeUrl(c.linkedin)}" target="_blank" onclick="event.stopPropagation()" title="LinkedIn" style="color:var(--blue);text-decoration:none;font-size:1rem">in</a>` : '';
      const cv = c.cv       ? `<a href="${safeUrl(c.cv)}"       target="_blank" onclick="event.stopPropagation()" title="CV / Resume" style="color:var(--slate);font-size:.85rem">📄</a>` : '';
      return `<tr class="edit-row" onclick="openHRDrawer('${safeId}')">
        <td>
          <div style="display:flex;align-items:center;gap:9px">
            ${hrAvatar(c,30)}
            <div>
              <div style="font-weight:600;font-size:.82rem;color:var(--navy2)">${esc(c.displayName||c.name||'—')}</div>
              <div style="font-size:.68rem;color:var(--slate);display:flex;align-items:center">${c.id||''} ${_hrSource==='both'?hrSourceBadge(c._source):''}</div>
            </div>
          </div>
        </td>
        <td style="font-size:.78rem">${hrRoleIcon(c.role)?`<span>${hrRoleIcon(c.role)}</span> `:''}<span>${c.role||'—'}</span></td>
        <td style="white-space:nowrap">${hrSeniorityStars(c.seniority)}</td>
        <td onclick="event.stopPropagation()">${buildHRStatusDrop(c)}</td>
        <td style="font-size:.75rem">${c.owner||'—'}</td>
        <td style="max-width:200px">${hrCompTags(c.competencies,3)}</td>
        ${_hrShowRates?`<td style="font-size:.75rem;color:var(--slate)">${c.rateRequested||'—'}</td>`:''}
        <td style="font-size:.72rem;color:var(--slate2)">${(c.updatedAt||'').slice(0,10)||'—'}</td>
        <td style="font-size:.85rem;white-space:nowrap">
          <div style="display:flex;gap:6px;align-items:center">${li}${cv}</div>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>
  `}`;
  _restoreFocus(_foc);
}

// ════════════════════════════════════════════════════════════════
// HR DETAIL DRAWER
// ════════════════════════════════════════════════════════════════
function openHRDrawer(safeId) {
  const id = safeId.replace(/__SQ__/g,"'");
  const c = DATA_HR.find(r => r.id === id) || DATA_POOL.find(r => r.id === id);
  if (!c) return;
  if (c._source === 'pool') { openPoolDrawer(c); return; }

  const sect = (title, rows, icon, collapsed) => {
    if (rows.every(r => !r[1])) return '';
    return `<div style="margin-bottom:14px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--slate);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--border)">${icon} ${title}</div>
      ${rows.filter(r=>r[1]).map(r=>`<div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start">
        <div style="font-size:.7rem;color:var(--slate2);min-width:110px;padding-top:2px">${r[0]}</div>
        <div style="font-size:.8rem;color:var(--navy2);flex:1">${r[1]}</div>
      </div>`).join('')}
    </div>`;
  };

  // Compute age
  const ageLbl = hrAge(c.dob) ? ` · ${hrAge(c.dob)}` : '';

  // Full competency tag cloud
  const allTags = (c.competencies||'').split(',').map(t=>t.trim()).filter(Boolean);
  const tagCloud = allTags.length
    ? allTags.map(t=>`<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:#ede9fe;color:#6d28d9;margin:2px">${t}</span>`).join('')
    : '<span style="color:var(--slate2);font-size:.77rem">None</span>';

  // HR section — only show if has data
  const hasHR = c.hrRole||c.hrInterviewDate||c.hrKnowhow||c.hrMotivation||c.hrExpectations||c.hrSummary;
  const hrSection = hasHR ? `
    <div style="margin-bottom:14px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--blue);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--blue-l)">🎤 HR Interview</div>
      ${c.hrSummary ? `<div style="background:#f0f9ff;border:1px solid var(--blue-l);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:.8rem;color:var(--navy2);font-style:italic">"${c.hrSummary}"</div>` : ''}
      ${[[' Role', c.hrRole],[' Date', c.hrInterviewDate]].filter(r=>r[1]).map(r=>`<div style="display:flex;gap:8px;margin-bottom:5px"><div style="font-size:.7rem;color:var(--slate2);min-width:110px">${r[0]}</div><div style="font-size:.8rem">${r[1]}</div></div>`).join('')}
      ${c.hrKnowhow    ? `<div style="margin-top:6px"><div style="font-size:.7rem;color:var(--slate2);margin-bottom:3px">Key Know-how</div><div style="font-size:.78rem;white-space:pre-wrap;background:#f8fafc;padding:8px;border-radius:6px">${esc(c.hrKnowhow)}</div></div>` : ''}
      ${c.hrMotivation ? `<div style="margin-top:6px"><div style="font-size:.7rem;color:var(--slate2);margin-bottom:3px">Motivation</div><div style="font-size:.78rem;white-space:pre-wrap;background:#f8fafc;padding:8px;border-radius:6px">${esc(c.hrMotivation)}</div></div>` : ''}
      ${c.hrExpectations ? `<div style="margin-top:6px"><div style="font-size:.7rem;color:var(--slate2);margin-bottom:3px">Expectations</div><div style="font-size:.78rem;white-space:pre-wrap;background:#f8fafc;padding:8px;border-radius:6px">${esc(c.hrExpectations)}</div></div>` : ''}
    </div>` : '';

  const statusOpts = HR_STATUSES.map(s=>`<option value="${s}"${c.status===s?' selected':''}>${s}</option>`).join('');
  const ownerOpts  = `<option value="">— Not assigned —</option>` + HR_OWNERS.map(o=>`<option value="${o}"${c.owner===o?' selected':''}>${o}</option>`).join('');

  const body = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
      ${hrAvatar(c,44)}
      <div style="flex:1">
        <div style="font-weight:700;font-size:.95rem;color:var(--navy2)">${c.displayName||c.name}</div>
        <div style="font-size:.78rem;color:var(--slate);display:flex;align-items:center;gap:6px">${esc(c.role||'')} ${hrSeniorityStars(c.seniority)}</div>
        <div style="margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${hrStatusBadge(c.status)}
          ${ageLbl?`<span style="font-size:.72rem;color:var(--slate)">${ageLbl}</span>`:''}
        </div>
      </div>
    </div>

    <!-- Editable pipeline fields -->
    <div class="field-row">
      <div class="field-group"><label>Role</label>
        <select id="hrd-role">
          ${['IT Analyst','Business Analyst','Solution Architect','IT Architect','Project Manager',
             'Delivery Manager','Product Manager','Product Owner','Card Specialist','Acquiring Specialist',
             'Risk Specialist','Compliance Specialist','Cyber Security Specialist','Finance Specialist',
             'CFO','Software Developer','Mobile Developer','QA / Test Manager','IT Administrator',
             'HR Generalist','Legal Specialist','Other'].map(r=>`<option value="${r}"${c.role===r?' selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="field-group"><label>Seniority</label>
        <select id="hrd-seniority">
          ${HR_SENIORITY.map(s=>`<option value="${s}"${c.seniority===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Status</label>
        <select id="hrd-status">${statusOpts}</select>
      </div>
      <div class="field-group"><label>Owner</label>
        <select id="hrd-owner">${ownerOpts}</select>
      </div>
    </div>

    <!-- Section 1: Contact -->
    <div style="margin-bottom:14px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--slate);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--border)">👤 Identity & Contact</div>
      <div style="font-size:.7rem;color:var(--slate2);margin-bottom:2px">${c.id}</div>
      <div class="field-row">
        <div class="field-group"><label>Phone</label><input id="hrd-phone" value="${esc(c.phone||'')}"></div>
        <div class="field-group"><label>Email</label><input id="hrd-email" type="email" value="${esc(c.email||'')}"></div>
      </div>
      ${c.linkedin ? `<div style="margin-bottom:4px"><a href="${safeUrl(c.linkedin)}" target="_blank" style="color:var(--blue);font-size:.78rem">in LinkedIn →</a></div>` : ''}
      ${c.cv ? `<div style="margin-top:6px">
        <a href="${safeUrl(c.cv)}" target="_blank"
          style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:var(--blue-t);color:var(--blue);border:1px solid var(--blue-l);border-radius:7px;font-size:.78rem;font-weight:600;text-decoration:none">
          📄 Open CV
        </a>
        <div style="font-size:.62rem;color:var(--slate2);margin-top:3px;word-break:break-all">${esc(c.cv)}</div>
      </div>` : ''}
    </div>

    <!-- Section 2: Availability & Financials -->
    <div style="margin-bottom:14px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--slate);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span>💰 Availability & Financials</span>
        <button onclick="_hrDrawerRates=!_hrDrawerRates;openHRDrawer('${esc(id)}')" style="font-size:.65rem;border:1px solid var(--border);background:${_hrDrawerRates?'var(--blue-t)':'#f8fafc'};color:${_hrDrawerRates?'var(--blue)':'var(--slate)'};border-radius:5px;padding:2px 8px;cursor:pointer">${_hrDrawerRates?'Hide Rates':'Show Rates'}</button>
      </div>
      ${_hrDrawerRates ? `
        <div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start">
          <div style="font-size:.7rem;color:var(--slate2);min-width:110px;padding-top:2px">Rate requested</div>
          <div style="font-size:.8rem;color:var(--navy2);flex:1">${c.rateRequested||'—'}</div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start">
          <div style="font-size:.7rem;color:var(--slate2);min-width:110px;padding-top:2px">Rate agreed</div>
          <div style="font-size:.8rem;flex:1"><b style="color:${c.rateAgreed&&c.rateAgreed!==c.rateRequested?'var(--green)':'var(--navy2)'}">${c.rateAgreed||'—'}</b></div>
        </div>` : ''}
      ${c.availableFrom ? `<div style="display:flex;gap:8px;margin-bottom:6px"><div style="font-size:.7rem;color:var(--slate2);min-width:110px;padding-top:2px">Available from</div><div style="font-size:.8rem;color:var(--navy2)">${c.availableFrom}</div></div>` : ''}
      ${c.commitment    ? `<div style="display:flex;gap:8px;margin-bottom:6px"><div style="font-size:.7rem;color:var(--slate2);min-width:110px;padding-top:2px">Commitment</div><div style="font-size:.8rem;color:var(--navy2)">${c.commitment}</div></div>` : ''}
    </div>

    <!-- Section 3: Pipeline -->
    ${sect('Pipeline',[
      ['Proposed for',   c.proposedProjects],
      ['Source',         c.source],
    ],'📋',false)}

    <!-- Proposed projects editable -->
    <div class="field-group"><label>Proposed Projects</label>
      <input id="hrd-projects" value="${esc(c.proposedProjects||'')}">
    </div>

    <!-- Section 4: HR Interview -->
    ${hrSection}

    <!-- Section 5: Competencies (chip add/remove) -->
    <div class="field-group">
      <label>🏷 Competencies</label>
      <div id="hrd-comp-chips" style="display:flex;flex-wrap:wrap;gap:5px;min-height:32px;padding:6px 8px;border:1px solid var(--border);border-radius:7px;background:#fff;margin-bottom:6px">
        ${(c.competencies||'').split(',').filter(x=>x.trim()).map(t=>{
          const tag = t.trim();
          const safeTag = tag.replace(/'/g,'__SQ__');
          return `<span data-val="${tag}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:#ede9fe;color:#6d28d9;margin:1px">${esc(tag)}<span onclick="hrRemoveComp('${safeTag}')" style="cursor:pointer;font-weight:700;margin-left:2px;opacity:.7">×</span></span>`;
        }).join('')}
      </div>
      <input type="hidden" id="hrd-comp" value="${esc(c.competencies||'')}">
      <select id="hrd-comp-add" onchange="hrAddComp(this)" style="font-size:.78rem;width:100%">
        <option value="">+ Add competency…</option>
        ${(HR_COMPETENCIES||[]).filter(comp => !(c.competencies||'').split(',').map(x=>x.trim()).includes(comp)).map(comp=>`<option value="${esc(comp)}">${comp}</option>`).join('')}
      </select>
    </div>

    <!-- Section 5: Notes timeline -->
    <div style="margin-bottom:14px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--slate);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--border)">📝 Notes / Activity</div>
      <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 12px;max-height:160px;overflow-y:auto;margin-bottom:6px">${hrNotesTimeline(c.notes)}</div>
      <textarea id="hrd-note" rows="2" placeholder="Append new note (prefixed with today's date)…"></textarea>
    </div>

    <!-- System info -->
    <div style="font-size:.68rem;color:var(--slate2);margin-top:4px">
      ${c.id} · Created ${(c.createdAt||'').slice(0,10)||'—'} · Updated ${(c.updatedAt||'').slice(0,10)||'—'}
    </div>`;

  const foot = `
    <button class="sbtn sbtn-p" onclick="saveHRDrawer('${esc(id)}')" style="flex:1">✓ Save</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;

  openDrawer((c.displayName||c.name||'Candidate'), body, foot, 'hr', id);
}

async function saveHRDrawer(origId) {
  const c = DATA_HR.find(r => r.id === origId);
  if (!c) return;
  toast('Saving…','info');
  const today = new Date().toISOString().slice(0,10);
  const newNote = $('hrd-note') ? $('hrd-note').value.trim() : '';
  const updNotes = newNote
    ? (c.notes ? c.notes + ` | ${c.owner||'User'} (${today}): ${newNote}` : `${c.owner||'User'} (${today}): ${newNote}`)
    : c.notes;
  const fields = {
    role:            $('hrd-role')     ? $('hrd-role').value     : c.role,
    seniority:       $('hrd-seniority')? $('hrd-seniority').value: c.seniority,
    status:          $('hrd-status').value,
    owner:           $('hrd-owner').value,
    proposedProjects:$('hrd-projects').value.trim(),
    phone:           $('hrd-phone') ? $('hrd-phone').value.trim() : c.phone,
    email:           $('hrd-email') ? $('hrd-email').value.trim() : c.email,
    competencies:    $('hrd-comp')  ? $('hrd-comp').value.trim()  : c.competencies,
    notes:           updNotes,
  };
  try {
    const ok = await P.saveHRRow(c, fields);
    if (ok) {
      Object.assign(c, fields, { notes: updNotes, updatedAt: today,
        phone: fields.phone, email: fields.email, competencies: fields.competencies });
      renderHR();
      toast('✓ Saved','success');
      closeDrawer();
    } else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ════════════════════════════════════════════════════════════════
// POOL DETAIL DRAWER — HR Search Tracking (5C_POOL_Dasboard)
// ════════════════════════════════════════════════════════════════
function openPoolDrawer(c) {
  const statusOpts  = HR_STATUSES.map(s=>`<option value="${s}"${c.status===s?' selected':''}>${s}</option>`).join('');
  const ownerOpts   = `<option value="">— Not assigned —</option>` + HR_OWNERS.map(o=>`<option value="${o}"${c.owner===o?' selected':''}>${o}</option>`).join('');
  const senOpts     = `<option value="">— Unknown —</option>` + HR_SENIORITY.map(s=>`<option value="${s}"${c.seniority===s?' selected':''}>${s}</option>`).join('');
  const roleOpts    = ['IT Analyst','Business Analyst','Solution Architect','IT Architect','Project Manager',
    'Delivery Manager','Product Manager','Product Owner','Card Specialist','Acquiring Specialist',
    'Risk Specialist','Compliance Specialist','Cyber Security Specialist','Finance Specialist',
    'CFO','Software Developer','Mobile Developer','QA / Test Manager','IT Administrator',
    'HR Generalist','Legal Specialist','Other'].map(r=>`<option value="${r}"${c.role===r?' selected':''}>${r}</option>`).join('');

  // Competency chips
  const allTags  = (c.competencies||'').split(',').map(t=>t.trim()).filter(Boolean);
  const tagCloud = allTags.length
    ? allTags.map(t=>`<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:#ede9fe;color:#6d28d9;margin:2px">${esc(t)}</span>`).join('')
    : '<span style="color:var(--slate2);font-size:.77rem">None</span>';

  const body = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
      ${hrAvatar(c,44)}
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-weight:700;font-size:.95rem;color:var(--navy2)">${esc(c.displayName||c.name)}</span>
          ${hrSourceBadge('pool')}
        </div>
        <div style="font-size:.78rem;color:var(--slate);display:flex;align-items:center;gap:6px">${esc(c.role||'')} ${hrSeniorityStars(c.seniority)}</div>
        <div style="margin-top:4px">${hrStatusBadge(c.status)}</div>
      </div>
    </div>

    <!-- Editable fields row 1 -->
    <div class="field-row">
      <div class="field-group"><label>First Name</label><input id="pd-fname" value="${esc(c.firstName||'')}"></div>
      <div class="field-group"><label>Surname</label><input id="pd-lname" value="${esc(c.lastName||'')}"></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Role</label><select id="pd-role">${roleOpts}</select></div>
      <div class="field-group"><label>Seniority</label><select id="pd-seniority">${senOpts}</select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Status</label><select id="pd-status">${statusOpts}</select></div>
      <div class="field-group"><label>Owner</label><select id="pd-owner">${ownerOpts}</select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Phone</label><input id="pd-phone" value="${esc(c.phone||'')}"></div>
      <div class="field-group"><label>Email</label><input id="pd-email" type="email" value="${esc(c.email||'')}"></div>
    </div>
    ${c.linkedin?`<div style="margin-bottom:10px"><a href="${safeUrl(c.linkedin)}" target="_blank" style="color:var(--blue);font-size:.78rem">in LinkedIn →</a></div>`:''}

    <!-- Specializace + Active Search -->
    ${c.specializace?`<div class="field-group"><label>Specializace</label><div style="font-size:.78rem;padding:6px;background:#f8fafc;border-radius:6px">${esc(c.specializace)}</div></div>`:''}
    <div class="field-group"><label>Active Search</label><input id="pd-active" value="${esc(c.activeSearch||'')}"></div>

    <!-- Competencies chip editor -->
    <div class="field-group">
      <label>🏷 Competencies</label>
      <div id="pd-comp-chips" style="display:flex;flex-wrap:wrap;gap:5px;min-height:32px;padding:6px 8px;border:1px solid var(--border);border-radius:7px;background:#fff;margin-bottom:6px">
        ${allTags.map(tag=>{const s=tag.replace(/'/g,'__SQ__');return `<span data-val="${tag}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:#ede9fe;color:#6d28d9;margin:1px">${esc(tag)}<span onclick="poolRemoveComp('${s}')" style="cursor:pointer;font-weight:700;margin-left:2px;opacity:.7">×</span></span>`;}).join('')}
      </div>
      <input type="hidden" id="pd-comp" value="${esc(c.competencies||'')}">
      <select id="pd-comp-add" onchange="poolAddComp(this)" style="font-size:.78rem;width:100%">
        <option value="">+ Add competency…</option>
        ${(HR_COMPETENCIES||[]).filter(comp=>!allTags.includes(comp)).map(comp=>`<option value="${esc(comp)}">${comp}</option>`).join('')}
      </select>
    </div>

    <!-- Note fields (5 types) -->
    <div style="margin-bottom:14px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--slate);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--border)">📝 Notes</div>
      ${(POOL_NOTES||[]).map(n=>`
        <div style="margin-bottom:10px">
          <div style="font-size:.7rem;font-weight:600;color:${n.editable?'var(--navy2)':'var(--slate2)'};margin-bottom:3px">
            ${n.label}${!n.editable?' 🔒':''}
          </div>
          ${n.editable
            ? `<textarea id="pd-note-${n.col.replace(/[^a-z0-9]/gi,'_')}" rows="2" style="font-size:.77rem">${esc(c[n.col==='5C Poznámka'?'note5c':n.col==='Výsledek'?'result':n.col==='NOTE'?'noteGeneral':'']||'')}</textarea>`
            : `<div style="font-size:.77rem;background:#f8fafc;padding:7px 10px;border-radius:6px;color:var(--slate)">${esc(c[n.col==='HR Poznámka'?'hrNote':'approval5c']||'—')}</div>`
          }
        </div>`).join('')}
    </div>

    <!-- System -->
    <div style="font-size:.68rem;color:var(--slate2)">
      ${c.id} · Duplicates: ${c.duplicateFlag||'—'} · Created ${(c.createdAt||'').slice(0,10)||'—'} · Updated ${(c.updatedAt||'').slice(0,10)||'—'}
    </div>`;

  const foot = `
    <button class="sbtn sbtn-p" onclick="savePoolDrawer('${esc(c.id)}')" style="flex:1">✓ Save</button>
    <button class="sbtn" style="background:#fff5f5;color:var(--red);border:1px solid var(--red-l)" onclick="archivePoolCheck('${esc(c.id)}')">⊘ Archive</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;

  openDrawer((c.displayName||c.name||'Candidate'), body, foot, 'pool', c.id);
}

// ── Pool competency chips ─────────────────────────────────────────
function poolRemoveComp(safeVal) {
  const val   = safeVal.replace(/__SQ__/g,"'");
  const chips = document.getElementById('pd-comp-chips');
  if (!chips) return;
  chips.querySelectorAll('span[data-val]').forEach(s=>{ if(s.dataset.val===val) s.remove(); });
  _updateChipHidden('pd-comp-chips','pd-comp');
  const sel = document.getElementById('pd-comp-add');
  if (sel) { const opt=document.createElement('option'); opt.value=val; opt.textContent=val; sel.appendChild(opt); }
}
function poolAddComp(sel) {
  const val = sel.value; if (!val) return;
  const chips = document.getElementById('pd-comp-chips'); if (!chips) return;
  if ([...chips.querySelectorAll('span[data-val]')].some(s=>s.dataset.val===val)) { sel.value=''; return; }
  const s = val.replace(/'/g,'__SQ__');
  const span = document.createElement('span');
  span.dataset.val = val;
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:#ede9fe;color:#6d28d9;margin:1px';
  span.innerHTML = `${esc(val)}<span onclick="poolRemoveComp('${s}')" style="cursor:pointer;font-weight:700;margin-left:2px;opacity:.7">×</span>`;
  chips.appendChild(span);
  _updateChipHidden('pd-comp-chips','pd-comp');
  const opt=[...sel.options].find(o=>o.value===val); if(opt) opt.remove();
  sel.value='';
}

// ── Pool save + archive ──────────────────────────────────────────
async function savePoolDrawer(origId) {
  const c = DATA_POOL.find(r => r.id === origId);
  if (!c) return;
  toast('Saving…','info');
  const fields = {
    firstName:    $('pd-fname')?.value.trim() || c.firstName,
    lastName:     $('pd-lname')?.value.trim() || c.lastName,
    role:         $('pd-role')?.value,
    seniority:    $('pd-seniority')?.value,
    status:       $('pd-status')?.value,
    owner:        $('pd-owner')?.value,
    phone:        $('pd-phone')?.value.trim(),
    email:        $('pd-email')?.value.trim(),
    activeSearch: $('pd-active')?.value.trim(),
    competencies: $('pd-comp')?.value.trim(),
    note5c:       $('pd-note-5C_Poznámka')?.value?.trim() ?? c.note5c,
    result:       $('pd-note-Výsledek')?.value?.trim()    ?? c.result,
    noteGeneral:  $('pd-note-NOTE')?.value?.trim()        ?? c.noteGeneral,
  };
  try {
    const ok = await P.savePoolRow(c, fields);
    if (ok) {
      Object.assign(c, fields, {
        name:        `${fields.firstName} ${fields.lastName}`.trim(),
        displayName: `${fields.lastName} ${fields.firstName}`.trim(),
        updatedAt:   new Date().toISOString().slice(0,10),
      });
      renderHR(); toast('✓ Saved','success'); closeDrawer();
    } else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

async function archivePoolCheck(origId) {
  const c = DATA_POOL.find(r => r.id === origId);
  if (!c) return;
  if (!confirm(`Archive "${c.displayName||c.name}"?\nRow will be hidden from App (Archived = Y in Excel).`)) return;
  try {
    const ok = await P.archivePool(c);
    if (ok) {
      toast('✓ Archived','success'); closeDrawer();
      DATA_POOL = DATA_POOL.filter(r => r.id !== origId);
      renderHR();
    } else toast('⚠ Archive failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}
