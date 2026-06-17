// 5C Dashboard v1.30.0 · 2026-06-17 10:00 · Five Crafts s.r.o.
'use strict';
let _calOffset = 0; // months offset from current month for calendar navigation

// ── Country flag emoji from country name ─────────────────────────
function countryFlag(country) {
  const MAP = {
    'Czech Republic':'CZ','Czechia':'CZ','Slovakia':'SK','Hungary':'HU',
    'Austria':'AT','Germany':'DE','Poland':'PL','Romania':'RO','Ukraine':'UA',
    'France':'FR','Spain':'ES','Italy':'IT','Netherlands':'NL','Belgium':'BE',
    'Switzerland':'CH','UK':'GB','United Kingdom':'GB','Great Britain':'GB',
    'Ireland':'IE','Portugal':'PT','Sweden':'SE','Norway':'NO','Denmark':'DK',
    'Finland':'FI','Estonia':'EE','Latvia':'LV','Lithuania':'LT','Croatia':'HR',
    'Slovenia':'SI','Serbia':'RS','Bulgaria':'BG','Greece':'GR','Cyprus':'CY',
    'Malta':'MT','Luxembourg':'LU','Albania':'AL','Moldova':'MD','Bosnia':'BA',
    'North Macedonia':'MK','Montenegro':'ME','Kosovo':'XK',
    'USA':'US','United States':'US','Canada':'CA','Australia':'AU',
    'Singapore':'SG','Japan':'JP','China':'CN','India':'IN','Brazil':'BR',
    'Russia':'RU','Turkey':'TR','Israel':'IL','UAE':'AE','South Africa':'ZA',
    'Netherlands Antilles':'AN','New Zealand':'NZ','Mexico':'MX',
  };
  const c = (country||'').trim();
  const code = MAP[c] || (c.length === 2 ? c.toUpperCase() : null);
  if (!code) return '';
  try {
    const flag = [...code.toUpperCase()].map(ch =>
      String.fromCodePoint(0x1F1E6 + ch.charCodeAt(0) - 65)
    ).join('');
    return `<span title="${c}" style="font-size:.95rem;line-height:1;flex-shrink:0">${flag}</span>`;
  } catch { return ''; }
}

// ── Event logo from website favicon ──────────────────────────────
function eventLogo(webLink, name, size) {
  size = size || 20;
  if (!webLink) return '';
  const domain = webLink.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0];
  if (!domain) return '';
  const ini = (name || '?')[0].toUpperCase();
  const avatar = `<span style="display:none;width:${size}px;height:${size}px;border-radius:4px;background:var(--blue-t);color:var(--blue);align-items:center;justify-content:center;font-size:${Math.round(size*0.55)}px;font-weight:700;flex-shrink:0">${ini}</span>`;
  return `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" width="${size}" height="${size}"
    style="border-radius:4px;object-fit:contain;vertical-align:middle;flex-shrink:0;border:1px solid var(--border);background:#fff"
    onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"
    loading="lazy">${avatar}`;
}

// ════════════════════════════════════════════════════════════════
// EVENTS — inline status dropdown + immediate save
// ════════════════════════════════════════════════════════════════
function buildEventStatusDrop(ev) {
  const menuId = 'esd-' + (ev.id||'').replace(/[^a-z0-9]/gi,'_');
  const cur    = ev.status || 'Watching';
  const cols   = { Active:'var(--green)', Watching:'var(--blue)', 'Not Interested':'var(--slate2)' };
  const opts   = EVENT_STATUSES.map(s => {
    const safeId = (ev.id||'').replace(/'/g,'__SQ__');
    return `<div class="cdrop-opt${cur===s?' active':''}" onclick="closeDrop();saveEventStatusDirect('${safeId}','${s}')">
      <span style="width:7px;height:7px;border-radius:50%;background:${cols[s]||'#94a3b8'};display:inline-block"></span>
      <span>${s}</span></div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()">
    <div class="cdrop-trigger" onclick="event.stopPropagation();openDrop('${menuId}',this)" style="min-width:110px">
      <span style="width:7px;height:7px;border-radius:50%;background:${cols[cur]||'#94a3b8'};display:inline-block;flex-shrink:0"></span>
      <span>${cur}</span><span class="arr">▾</span>
    </div>
    <div class="cdrop-menu" id="${menuId}">${opts}</div>
  </div>`;
}

async function saveEventStatusDirect(safeId, newS) {
  const id  = safeId.replace(/__SQ__/g,"'");
  const ev  = DATA_EVENTS.find(e => e.id === id);
  if (!ev || ev.status === newS) return;
  try {
    const ok = await P.saveEventStatus(ev, newS);
    if (ok) { ev.status = newS; renderEvents(); toast(`✓ Status → ${newS}`, 'success'); }
    else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ════════════════════════════════════════════════════════════════
// TIMING helper — computed from dates vs today (not stored)
// ════════════════════════════════════════════════════════════════
function eventTiming(ev) {
  const today = new Date().toISOString().slice(0,10);
  if (!ev.dateFrom) return 'Unknown';
  if (ev.dateTo  && ev.dateTo   < today) return 'Past';
  if (ev.dateFrom > today)               return 'Upcoming';
  return 'Ongoing';
}

function timingBadge(t) {
  const s = {
    Upcoming: 'background:var(--blue-t);color:var(--blue);border:1px solid var(--blue-l)',
    Ongoing:  'background:var(--green-t);color:var(--green);border:1px solid var(--green-l)',
    Past:     'background:#f1f5f9;color:var(--slate2);border:1px solid var(--border)',
    Unknown:  'background:#f1f5f9;color:var(--slate2);border:1px solid var(--border)',
  };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:.68rem;font-weight:600;${s[t]||s.Unknown}">${t}</span>`;
}

// ── Calendar day click helper ────────────────────────────────────
function _calDay(dateStr) {
  const el = document.getElementById('ev-fdate');
  if (el) el.value = dateStr;
  renderEvents();
}

// ── Chip add/remove helpers ─────────────────────────────────────
// _updateChipHidden moved to helpers.js
function removeAudChip(safeVal) {
  const val = safeVal.replace(/__SQ__/g,"'");
  const chips = document.getElementById('dev-aud-chips');
  if (!chips) return;
  chips.querySelectorAll('span[data-val]').forEach(s=>{ if(s.dataset.val===val) s.remove(); });
  _updateChipHidden('dev-aud-chips','dev-aud');
}
function addAudChip(sel) {
  const val = sel.value; if (!val) return;
  const hidden = document.getElementById('dev-aud');
  if (hidden && hidden.value && hidden.value.includes(val)) { sel.value=''; return; }
  const m = val.match(/^(.*?)\s*\(O-\d+\)$/);
  const label = m ? m[1].trim() : val;
  const chips = document.getElementById('dev-aud-chips');
  if (!chips) return;
  const span = document.createElement('span');
  span.dataset.val = val;
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--blue-t);color:var(--blue);border:1px solid var(--blue-l);border-radius:12px;font-size:.72rem;font-weight:600';
  span.innerHTML = `${label}<span onclick="this.parentElement.remove();_updateChipHidden('dev-aud-chips','dev-aud')" style="cursor:pointer;font-weight:700;margin-left:2px">×</span>`;
  chips.appendChild(span);
  _updateChipHidden('dev-aud-chips','dev-aud');
  sel.value = '';
}
function removeContChip(safeVal) {
  const val = safeVal.replace(/__SQ__/g,"'");
  const chips = document.getElementById('dev-lcont-chips');
  if (!chips) return;
  chips.querySelectorAll('span[data-val]').forEach(s=>{ if(s.dataset.val===val) s.remove(); });
  _updateChipHidden('dev-lcont-chips','dev-lcont');
}
function addContChip(sel) {
  const val = sel.value; if (!val) return;
  const hidden = document.getElementById('dev-lcont');
  if (hidden && hidden.value && hidden.value.includes(val)) { sel.value=''; return; }
  const m = val.match(/^(.*?)\s*\((C-\d+)\)$/);
  const cName = m ? m[1].trim() : val;
  const chips = document.getElementById('dev-lcont-chips');
  if (!chips) return;
  const span = document.createElement('span');
  span.dataset.val = val;
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--purple-t,#f3e8ff);border:1px solid var(--purple-l,#e9d5ff);border-radius:12px;font-size:.72rem;font-weight:600;color:var(--accent5)';
  span.innerHTML = `${cName}<span onclick="this.parentElement.remove();_updateChipHidden('dev-lcont-chips','dev-lcont')" style="cursor:pointer;font-weight:700;margin-left:2px">×</span>`;
  chips.appendChild(span);
  _updateChipHidden('dev-lcont-chips','dev-lcont');
  sel.value = '';
}
function removeCoChip(safeVal) {
  const val = safeVal.replace(/__SQ__/g,"'");
  const chips = document.getElementById('dev-lco-chips');
  if (!chips) return;
  chips.querySelectorAll('span[data-val]').forEach(s=>{ if(s.dataset.val===val) s.remove(); });
  _updateChipHidden('dev-lco-chips','dev-lco');
}
function addCoChip(sel) {
  const val = sel.value; if (!val) return;
  const hidden = document.getElementById('dev-lco');
  if (hidden && hidden.value && hidden.value.includes(val)) { sel.value=''; return; }
  const m = val.match(/^(.*?)\s*\((CO-\d+)\)$/);
  const coName = m ? m[1].trim() : val; const coId = m ? m[2] : '';
  const co = DATA_COMPANIES.find(c=>c.id===coId||c.name===coName);
  const chips = document.getElementById('dev-lco-chips');
  if (!chips) return;
  const span = document.createElement('span');
  span.dataset.val = val;
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--green-t);border:1px solid var(--green-l);border-radius:12px;font-size:.72rem;font-weight:600;color:var(--green)';
  span.innerHTML = `${companyLogo(co?.website||'',coName,14)}<span>${coName}</span><span onclick="this.parentElement.remove();_updateChipHidden('dev-lco-chips','dev-lco')" style="cursor:pointer;font-weight:700;margin-left:2px">×</span>`;
  chips.appendChild(span);
  _updateChipHidden('dev-lco-chips','dev-lco');
  sel.value = '';
}

// ════════════════════════════════════════════════════════════════
// EVENTS PAGE — table view
// ════════════════════════════════════════════════════════════════
function renderEvents(q, ftiming, fstatus, fmode, fown, fdate) {
  if (q       === undefined) { const el=$('evq');    q       = el?el.value:''; }
  if (ftiming === undefined) { const el=$('evtim');  ftiming = el?el.value:''; }
  if (fstatus === undefined) { const el=$('evstat'); fstatus = el?el.value:''; }
  fmode = '';
  if (fown    === undefined) { const el=$('evown');  fown    = el?el.value:''; }
  if (fdate   === undefined) { const el=$('ev-fdate'); fdate  = el?el.value:''; }
  q=''; // reset search — re-apply below
  const qEl = $('evq'); if(qEl) q = qEl.value.toLowerCase();

  const today = new Date().toISOString().slice(0,10);

  const withTiming = DATA_EVENTS.map(ev => ({...ev, _timing: eventTiming(ev)}));
  const filtered   = withTiming.filter(ev =>
    (!q       || (ev.name+ev.place+ev.country+ev.description+ev.industry+ev.owner).toLowerCase().includes(q)) &&
    (!ftiming || ev._timing === ftiming) &&
    (!fstatus || ev.status  === fstatus) &&
    (!fdate   || (ev.dateFrom && ev.dateFrom <= fdate && (!ev.dateTo || ev.dateTo >= fdate))) &&
    (!fown    || ev.owner   === fown)
  ).sort((a,b) => {
    // Upcoming first → Ongoing → Past → Unknown; within each: dateFrom asc
    const to = {Upcoming:0, Ongoing:1, Past:2, Unknown:3};
    const td = (to[a._timing]??3) - (to[b._timing]??3);
    if (td !== 0) return td;
    return (a.dateFrom||'').localeCompare(b.dateFrom||'');
  });

  const cnt = (t) => withTiming.filter(e=>e._timing===t).length;
  const owners = [...new Set(DATA_EVENTS.map(e=>e.owner).filter(Boolean))].sort();

  const _foc = _saveFocus();
  $('events-out').innerHTML = `
  <!-- 3-month event calendar -->
  ${(()=>{
    const _tn = new Date();
    const todayStr = _tn.getFullYear()+'-'+String(_tn.getMonth()+1).padStart(2,'0')+'-'+String(_tn.getDate()).padStart(2,'0');
    const todayD = new Date(_tn.getFullYear(), _tn.getMonth(), _tn.getDate());
    const evMap = {};
    const _parseLocal = s => { const p=s.split('-'); return p.length===3?new Date(+p[0],+p[1]-1,+p[2]):null; };
    const _fmtDate = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    DATA_EVENTS.forEach(ev => {
      if (!ev.dateFrom) return;
      const from = _parseLocal(ev.dateFrom);
      const to   = ev.dateTo ? _parseLocal(ev.dateTo) : new Date(from);
      if (!from || !to || from > to) { // single day or invalid range
        const k = ev.dateFrom;
        if (!evMap[k]) evMap[k] = [];
        evMap[k].push(ev);
        return;
      }
      for (let d = new Date(from); d <= to; d.setDate(d.getDate()+1)) {
        const k = _fmtDate(d);
        if (!evMap[k]) evMap[k] = [];
        evMap[k].push(ev);
      }
    });
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS   = ['Mo','Tu','We','Th','Fr','Sa','Su'];
    let html = '<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">';
    for (let m = 0; m < 3; m++) {
      const base = new Date(todayD.getFullYear(), todayD.getMonth()+m, 1);
      const yr = base.getFullYear(), mo = base.getMonth();
      const daysInMonth = new Date(yr, mo+1, 0).getDate();
      const firstDow = (new Date(yr, mo, 1).getDay()+6)%7;
      html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;flex:1;min-width:200px">';
      html += '<div style="font-size:.78rem;font-weight:700;color:var(--navy2);margin-bottom:8px;text-align:center">'+MONTHS[mo]+' '+yr+'</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center">';
      html += DAYS.map(d=>'<div style="font-size:.6rem;color:var(--slate2);font-weight:600;padding:2px 0">'+d+'</div>').join('');
      html += Array(firstDow).fill('<div></div>').join('');
      for (let i=1; i<=daysInMonth; i++) {
        const dateStr = yr+'-'+String(mo+1).padStart(2,'0')+'-'+String(i).padStart(2,'0');
        const evs = evMap[dateStr] || [];
        const isToday = dateStr === todayStr;
        const isPast  = dateStr < todayStr;
        const hasEv   = evs.length > 0;
        const dotColor = hasEv ? (evs[0].status==='Active'?'var(--green)':evs[0].status==='Not Interested'?'var(--red)':'var(--blue)') : '';
        const title = evs.map(e=>e.name).join(', ');
        html += '<div title="'+title+'" '
          +(hasEv?'onclick="_calDay(\''+dateStr+'\')" ':'' )
          +'style="font-size:.68rem;padding:3px 1px;border-radius:4px;'
          +'cursor:'+(hasEv?'pointer':'default')+';'
          +'background:'+(isToday?'var(--navy2)':hasEv?'var(--blue-t)':'transparent')+';'
          +'color:'+(isToday?'#fff':isPast?'var(--slate2)':'var(--navy2)')+';'
          +'font-weight:'+(hasEv||isToday?'700':'400')+'">'+i
          +(hasEv?'<span style="display:block;width:4px;height:4px;border-radius:50%;background:'+dotColor+';margin:1px auto 0"></span>':'<span style="display:block;height:5px"></span>')
          +'</div>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  })()}

    <!-- Filters -->
  <div class="filter-bar">
    <input type="text" id="evq" placeholder="🔍  Search name, place, industry…" value="${q}" oninput="renderEvents(undefined,undefined,undefined,undefined,undefined)">
    <select id="evtim" onchange="renderEvents()">
      <option value="">All Timing</option>
      ${['Upcoming','Ongoing','Past','Unknown'].map(t=>`<option value="${t}"${ftiming===t?' selected':''}>${t}</option>`).join('')}
    </select>
    <select id="evstat" onchange="renderEvents()">
      <option value="">All Statuses</option>
      ${EVENT_STATUSES.map(s=>`<option value="${s}"${fstatus===s?' selected':''}>${s}</option>`).join('')}
    </select>

    <select id="evown" onchange="renderEvents()">
      <option value="">All Owners</option>
      ${owners.map(o=>`<option value="${o}"${fown===o?' selected':''}>${o}</option>`).join('')}
    </select>
    <span class="cnt">${filtered.length}/${DATA_EVENTS.length}</span>
    <button class="sbtn sbtn-p" onclick="openNewEventDrawer()" style="margin-left:auto">+ New Event</button>
  </div>

  ${DATA_EVENTS.length === 0 ? `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:32px;text-align:center;color:var(--slate)">
      <div style="font-size:2rem;margin-bottom:8px">📅</div>
      <div style="font-weight:600;margin-bottom:4px">No events yet</div>
    </div>` :
  `<div class="tbl-wrap"><table>
    <thead><tr>
      <th>Timing</th><th>Event</th><th>Status</th>
      <th>Date From</th><th>Date To</th><th>Place</th>
      <th>Industry</th><th>Owner</th><th>Link</th>
    </tr></thead>
    <tbody>${filtered.map(ev => {
      const safeId = (ev.id||'').replace(/'/g,'__SQ__');
      const url    = ev.webLink ? (ev.webLink.match(/^https?:\/\//) ? ev.webLink : 'https://'+ev.webLink) : '';
      return `<tr class="edit-row" onclick="openEventDrawer('${safeId}')">
        <td>${timingBadge(ev._timing)}</td>
        <td><div style="display:flex;align-items:center;gap:6px">${ev.webLink?eventLogo(ev.webLink,ev.name,18):''}<div><b style="color:var(--navy2)">${ev.name||'—'}</b>${ev.country?`<div class="dc" style="font-size:.67rem">${ev.country}</div>`:''}</div></div></td>
        <td onclick="event.stopPropagation()">${buildEventStatusDrop(ev)}</td>
        <td style="font-size:.75rem;color:var(--slate)">${ev.dateFrom||'—'}</td>
        <td style="font-size:.75rem;color:var(--slate)">${ev.dateTo||'—'}</td>
        <td style="font-size:.77rem"><div style="display:flex;align-items:center;gap:4px">${ev.mode==='Online'?'<span title="Online" style="font-size:.95rem">🌐</span>':(ev.country?countryFlag(ev.country):'')}<span>${ev.place||(ev.mode==='Online'?'Online':'—')}</span></div></td>
        <td style="font-size:.75rem">${ev.industry||'—'}</td>
        <td style="font-size:.75rem">${ev.owner||'—'}</td>
        <td style="font-size:.72rem">${url?`<a href="${url}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue)">🔗 Website</a>`:'—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`}`;
}

// ════════════════════════════════════════════════════════════════
// EVENT DETAIL DRAWER
// ════════════════════════════════════════════════════════════════
function openEventDrawer(safeId) {
  const id = safeId.replace(/__SQ__/g,"'");
  const ev = DATA_EVENTS.find(e => e.id === id);
  if (!ev) return;

  // Parse multi-link fields — format: "Display (ID)"
  const parseLinks = (cell, type) => {
    if (!cell) return '<span style="color:var(--slate2);font-size:.77rem">—</span>';
    return cell.split(',').map(part => {
      const m = part.trim().match(/^(.*?)\s*\(([A-Z]+-\d+)\)\s*$/);
      if (!m) return `<span style="font-size:.77rem">${part.trim()}</span>`;

  _restoreFocus(_foc);
      const [, display, linkId] = m;
      let onclick = '';
      if (type === 'CO') onclick = `openCompanyDrawer('${linkId.replace(/'/g,'__SQ__')}')`;
      else if (type === 'P')  onclick = `openOppFromContact('${display.trim().replace(/'/g,'__SQ__')}')`;
      else if (type === 'C')  onclick = `openContactFromPipeline('${display.trim().replace(/'/g,'__SQ__')}')`;
      return `<span class="contact-link" onclick="${onclick}" style="margin-right:6px;font-size:.77rem">${display.trim()}</span>`;
    }).join('');
  };

  // Followup log — render [YYYY-MM-DD]: prefix as timeline
  const followupHtml = ev.followup
    ? ev.followup.split(/(?=\[\d{4}-\d{2}-\d{2}\]:)/).map(line => {
        const m = line.match(/^\[(\d{4}-\d{2}-\d{2})\]:\s*(.*)/s);
        if (m) return `<div style="padding:5px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.65rem;color:var(--slate2);font-weight:600">${m[1]}</span>
          <span style="font-size:.77rem;color:var(--navy2);margin-left:6px">${m[2].trim()}</span>
        </div>`;
        return line ? `<div style="font-size:.77rem;color:var(--slate);padding:3px 0">${line.trim()}</div>` : '';
      }).join('')
    : '<span style="color:var(--slate2);font-size:.77rem">No followup yet</span>';

  const indOpts = (INDUSTRIES||[]).map(i => `<option${ev.industry===i?' selected':''}>${i}</option>`).join('');
  const modeOpts = EVENT_MODES.map(m => `<option${ev.mode===m?' selected':''}>${m}</option>`).join('');
  const statusOpts = EVENT_STATUSES.map(s => `<option${ev.status===s?' selected':''}>${s}</option>`).join('');

  const body = `
    <div class="field-group"><label>Event Name</label><input id="dev-name" value="${esc(ev.name||'')}"></div>
    <div class="field-row">
      <div class="field-group"><label>Status</label>${buildDrawerEventStatusDrop('dev-status', ev.status)}</div>
    </div>
    <input type="hidden" id="dev-mode" value="${esc(ev.mode||'')}">
    <div class="field-row">
      <div class="field-group"><label>Date From</label><input id="dev-dfrom" type="date" value="${ev.dateFrom||''}"></div>
      <div class="field-group"><label>Date To</label><input id="dev-dto" type="date" value="${ev.dateTo||''}"></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Place</label><input id="dev-place" value="${esc(ev.place||'')}"></div>
      <div class="field-group"><label>Country</label>
      <select id="dev-country">
        <option value="">— Select country —</option>
        ${['Albania','Australia','Austria','Belgium','Bosnia','Brazil','Bulgaria','Canada','China','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','India','Ireland','Israel','Italy','Japan','Latvia','Lithuania','Luxembourg','Malta','Mexico','Moldova','Montenegro','Netherlands','New Zealand','North Macedonia','Norway','Poland','Portugal','Romania','Russia','Serbia','Singapore','Slovakia','Slovenia','South Africa','Spain','Sweden','Switzerland','Turkey','UAE','UK','USA','Ukraine'].map(c=>`<option value="${c}"${ev.country===c?' selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Industry</label><select id="dev-ind"><option value="">— Select —</option>${indOpts}</select></div>
      <div class="field-group"><label>Owner</label>
        <select id="dev-own">${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();return`<option value="${n}"${ev.owner===n?' selected':''}>${n}</option>`;}).join('')}</select>
      </div>
    </div>
    <div class="field-group"><label>Website / Registration</label><input id="dev-link" value="${esc(ev.webLink||'')}" placeholder="https://…"></div>
    <div class="field-group"><label>Description</label><textarea id="dev-desc">${esc(ev.description||'')}</textarea></div>
    <div class="field-group"><label>Suggested Audience</label>
      <div id="dev-aud-chips" style="display:flex;flex-wrap:wrap;gap:5px;min-height:28px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:#fff;margin-bottom:4px">
        ${(ev.audience||'').split(',').filter(x=>x.trim()).map(a=>{
          const m=a.trim().match(/^(.*?)\s*\(O-\d+\)$/) ;
          const label=m?m[1].trim():a.trim();
          const safeA=a.trim().replace(/'/g,'__SQ__');
          return `<span data-val="${a.trim()}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--blue-t);color:var(--blue);border:1px solid var(--blue-l);border-radius:12px;font-size:.72rem;font-weight:600">${label}<span onclick="removeAudChip('${safeA}')" style="cursor:pointer;font-weight:700;margin-left:2px">×</span></span>`;
        }).join('')}
      </div>
      <input type="hidden" id="dev-aud" value="${esc(ev.audience||'')}">
      <select id="dev-aud-add" onchange="addAudChip(this)" style="font-size:.78rem">
        <option value="">+ Add owner to audience…</option>
        ${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();const oid=o.id||'';return `<option value="${esc(n+' ('+oid+')')}">${n}</option>`;}).join('')}
      </select>
    </div>
    <div class="field-group"><label>Linked Companies</label>
      <div id="dev-lco-chips" style="display:flex;flex-wrap:wrap;gap:5px;min-height:28px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:#fff;margin-bottom:4px">
        ${(ev.linkedCompanies||'').split(',').filter(x=>x.trim()).map(a=>{
          const m=a.trim().match(/^(.*?)\s*\((CO-\d+)\)$/);
          const coName=m?m[1].trim():a.trim(); const coId=m?m[2]:'';
          const co=DATA_COMPANIES.find(c=>c.id===coId||c.name===coName);
          const safeA=a.trim().replace(/'/g,'__SQ__');
          return `<span data-val="${a.trim()}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--green-t);border:1px solid var(--green-l);border-radius:12px;font-size:.72rem;font-weight:600;color:var(--green)">${companyLogo(co?.website||'',coName,14)}<span>${coName}</span><span onclick="removeCoChip('${safeA}')" style="cursor:pointer;font-weight:700;margin-left:2px">×</span></span>`;
        }).join('')}
      </div>
      <input type="hidden" id="dev-lco" value="${esc(ev.linkedCompanies||'')}">
      <select id="dev-lco-add" onchange="addCoChip(this)" style="font-size:.78rem">
        <option value="">+ Add company…</option>
        ${[...(DATA_COMPANIES||[])].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(c=>`<option value="${esc(c.name+' ('+c.id+')')}">${c.name}</option>`).join('')}
      </select>
    </div>
    <!-- Linked Opportunities hidden — maintained via pipeline drawer -->
    <input type="hidden" id="dev-lopp" value="${esc(ev.linkedOpps||'')}">
    <div class="field-group"><label>Linked Contacts</label>
      <div id="dev-lcont-chips" style="display:flex;flex-wrap:wrap;gap:5px;min-height:28px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:#fff;margin-bottom:4px">
        ${(ev.linkedContacts||'').split(',').filter(x=>x.trim()).map(a=>{
          const m=a.trim().match(/^(.*?)\s*\((C-\d+)\)$/);
          const cName=m?m[1].trim():a.trim();
          const safeA=a.trim().replace(/'/g,'__SQ__');
          return `<span data-val="${a.trim()}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--purple-t,#f3e8ff);border:1px solid var(--purple-l,#e9d5ff);border-radius:12px;font-size:.72rem;font-weight:600;color:var(--accent5)">${cName}<span onclick="removeContChip('${safeA}')" style="cursor:pointer;font-weight:700;margin-left:2px">×</span></span>`;
        }).join('')}
      </div>
      <input type="hidden" id="dev-lcont" value="${esc(ev.linkedContacts||'')}">
      <select id="dev-lcont-add" onchange="addContChip(this)" style="font-size:.78rem">
        <option value="">+ Add contact…</option>
        ${[...(DATA_CONTACTS||[])].sort((a,b)=>(a.lastName||'').localeCompare(b.lastName||'')||(a.firstName||'').localeCompare(b.firstName||'')).map(c=>{
          const name=contactDisplayName(c);
          const stored=((c.firstName||'')+' '+(c.lastName||'')).trim();
          return `<option value="${esc(stored+' ('+c.id+')')}">${name}</option>`;
        }).join('')}
      </select>
    </div>
    <div class="field-group"><label>Followup / Result</label>
      <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px;max-height:120px;overflow-y:auto">${followupHtml}</div>
      <textarea id="dev-followup" rows="2" placeholder="Append new entry (will be prefixed with today's date)…"></textarea>
    </div>
    <div style="font-size:.7rem;color:var(--slate);margin-top:4px">${ev.id} · Created ${ev.createdDate||'—'} · Updated ${ev.updDate||'—'} · ${timingBadge(eventTiming(ev))}</div>`;

  const foot = `
    <button class="sbtn sbtn-p" onclick="saveEventDrawer('${esc(id)}')" style="flex:1">✓ Save</button>
    <button class="sbtn" style="background:#fff5f5;color:var(--red);border:1px solid var(--red-l)" onclick="archiveEventCheck('${esc(id)}')">⊘ Archive</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;

  const _evLogo = ev.webLink ? eventLogo(ev.webLink, ev.name, 28) : '';
  const _evFlag = ev.mode === 'Online' ? '<span title="Online" style="font-size:1.1rem">🌐</span>' : (ev.country ? countryFlag(ev.country) : '');
  openDrawer(ev.name || 'Event', body, foot, 'event', id);
  setTimeout(()=>{const dh=$('drawer-title');if(dh)dh.innerHTML=`<span style="display:flex;align-items:center;gap:8px">${_evLogo}${_evFlag}<span>${esc(ev.name||'Event')}</span></span>`;},0);
}

function buildDrawerEventStatusDrop(elId, currentVal) {
  const cur     = currentVal || 'Watching';
  const menuId  = 'drd-' + elId;
  const cols    = { Active:'var(--green)', Watching:'var(--blue)', 'Not Interested':'var(--slate2)' };
  const opts    = EVENT_STATUSES.map(s =>
    `<div class="cdrop-opt${cur===s?' active':''}"
      onclick="closeDrop();_setDrop('${elId}','${menuId}',this,'${s}')">
      <span style="width:7px;height:7px;border-radius:50%;background:${cols[s]||'#94a3b8'};display:inline-block"></span>
      <span>${s}</span></div>`
  ).join('');
  return `<div class="cdrop" style="display:block">
    <input type="hidden" id="${elId}" value="${cur}">
    <div class="cdrop-trigger" style="width:100%;justify-content:flex-start;gap:8px;padding:8px 12px"
      onclick="event.stopPropagation();openDrop('${menuId}',this)">
      <span id="${elId}_dot"><span style="width:7px;height:7px;border-radius:50%;background:${cols[cur]||'#94a3b8'};display:inline-block"></span></span>
      <span id="${elId}_lbl" style="flex:1">${cur}</span><span class="arr">▾</span>
    </div>
    <div class="cdrop-menu" id="${menuId}" style="width:100%">${opts}</div>
  </div>`;
}

async function saveEventDrawer(origId) {
  const ev = DATA_EVENTS.find(e => e.id === origId);
  if (!ev) return;
  toast('Saving…','info');
  const today = new Date().toISOString().slice(0,10);
  // Append new followup entry if filled
  const newFollowup = $('dev-followup') ? $('dev-followup').value.trim() : '';
  const followupVal = ev.followup
    ? (newFollowup ? ev.followup + `\n[${today}]: ${newFollowup}` : ev.followup)
    : (newFollowup ? `[${today}]: ${newFollowup}` : '');
  const fields = {
    name:            $('dev-name').value.trim(),
    owner:           $('dev-own').value.trim(),
    place:           $('dev-place').value.trim(),
    country:         $('dev-country').value.trim(),
    mode:            $('dev-mode').value,
    status:          $('dev-status').value,
    industry:        $('dev-ind').value,
    dateFrom:        $('dev-dfrom').value,
    dateTo:          $('dev-dto').value,
    webLink:         $('dev-link').value.trim(),
    description:     $('dev-desc').value.trim(),
    audience:        $('dev-aud').value.trim(),
    followup:        followupVal,
    linkedCompanies: $('dev-lco').value.trim(),
    linkedOpps:      $('dev-lopp').value.trim(),
    linkedContacts:  $('dev-lcont').value.trim(),
  };
  try {
    const ok = await P.saveEventRow(ev, fields);
    if (ok) {
      Object.assign(ev, fields);
      renderEvents();
      toast('✓ Saved','success');
      closeDrawer();
    } else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ── Archive ──────────────────────────────────────────────────
async function archiveEventCheck(origId) {
  const ev = DATA_EVENTS.find(e => e.id === origId);
  if (!ev) return;
  // Check for linked tasks
  const linkedTasks = DATA_TASKS.filter(t => t.linkedEvent === ev.id && t.status !== 'Cancelled');
  if (linkedTasks.length > 0) {
    toast(`⚠ Cannot archive — ${linkedTasks.length} linked task(s). Cancel them first.`,'error');
    return;
  }
  if (!confirm(`Archive "${ev.name}"?\nIt will be hidden from all views but kept in Excel.`)) return;
  try {
    const ok = await P.archiveEvent(ev);
    if (ok) {
      toast('✓ Archived','success');
      closeDrawer();
      const j = await P.loadSheet(activeCfg.sheets.events);
      DATA_EVENTS = P.parseEvents(j);
      updateCounts();
      renderEvents();
    } else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ── New Event Drawer ─────────────────────────────────────────
function openNewEventDrawer() {
  const indOpts  = (INDUSTRIES||[]).map(i=>`<option>${i}</option>`).join('');
  const body = `
    <div class="field-group"><label>Event Name</label><input id="dev-name" placeholder="Conference name…"></div>
    <div class="field-row">
      <div class="field-group"><label>Status</label>${buildDrawerEventStatusDrop('dev-status','Watching')}</div>
    </div>
    <input type="hidden" id="dev-mode" value="Offline">
    <div class="field-row">
      <div class="field-group"><label>Date From</label><input id="dev-dfrom" type="date"></div>
      <div class="field-group"><label>Date To</label><input id="dev-dto" type="date"></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Place</label><input id="dev-place" placeholder="City…"></div>
      <div class="field-group"><label>Country</label>
      <select id="dev-country">
        <option value="">— Select country —</option>
        ${['Albania','Australia','Austria','Belgium','Bosnia','Brazil','Bulgaria','Canada','China','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','India','Ireland','Israel','Italy','Japan','Latvia','Lithuania','Luxembourg','Malta','Mexico','Moldova','Montenegro','Netherlands','New Zealand','North Macedonia','Norway','Poland','Portugal','Romania','Russia','Serbia','Singapore','Slovakia','Slovenia','South Africa','Spain','Sweden','Switzerland','Turkey','UAE','UK','USA','Ukraine'].map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Industry</label><select id="dev-ind"><option value="">— Select —</option>${indOpts}</select></div>
      <div class="field-group"><label>Owner</label>
        <select id="dev-own">${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();const cur=window.CURRENT_USER_NAME||'';return`<option value="${n}"${cur===n?' selected':''}>${n}</option>`;}).join('')}</select>
      </div>
    </div>
    <div class="field-group"><label>Website / Registration</label><input id="dev-link" placeholder="https://…"></div>
    <div class="field-group"><label>Description</label><textarea id="dev-desc"></textarea></div>
    <div class="field-group"><label>Notes / Followup</label><textarea id="dev-followup"></textarea></div>`;
  const foot = `
    <button class="sbtn sbtn-p" onclick="createEventDrawer()" style="flex:1">+ Create Event</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;
  openDrawer('New Event', body, foot, 'new-event', null);
}

async function createEventDrawer() {
  const name = $('dev-name').value.trim();
  if (!name) { toast('Event name required','error'); return; }
  toast('Creating…','info');
  const today = new Date().toISOString().slice(0,10);
  const followupRaw = $('dev-followup') ? $('dev-followup').value.trim() : '';
  const fields = {
    name, status: $('dev-status').value || 'Watching',
    owner: $('dev-own').value.trim(), mode: $('dev-mode').value,
    dateFrom: $('dev-dfrom').value, dateTo: $('dev-dto').value,
    place: $('dev-place').value.trim(), country: $('dev-country').value.trim(),
    industry: $('dev-ind').value,
    webLink: $('dev-link').value.trim(),
    description: $('dev-desc').value.trim(),
    followup: followupRaw ? `[${today}]: ${followupRaw}` : '',
    audience:'', linkedCompanies:'', linkedOpps:'', linkedContacts:'',
  };
  try {
    await P.createEvent(fields);
    const j = await P.loadSheet(activeCfg.sheets.events);
    DATA_EVENTS = P.parseEvents(j);
    updateCounts(); renderEvents();
    toast('✓ Event created','success'); closeDrawer();
  } catch(e) { toast('Error: '+e.message,'error'); }
}
