'use strict';

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

// ════════════════════════════════════════════════════════════════
// EVENTS PAGE — table view
// ════════════════════════════════════════════════════════════════
function renderEvents(q, ftiming, fstatus, fmode, fown) {
  if (q       === undefined) { const el=$('evq');    q       = el?el.value:''; }
  if (ftiming === undefined) { const el=$('evtim');  ftiming = el?el.value:''; }
  if (fstatus === undefined) { const el=$('evstat'); fstatus = el?el.value:''; }
  if (fmode   === undefined) { const el=$('evmode'); fmode   = el?el.value:''; }
  if (fown    === undefined) { const el=$('evown');  fown    = el?el.value:''; }
  q=''; // reset search — re-apply below
  const qEl = $('evq'); if(qEl) q = qEl.value.toLowerCase();

  const today = new Date().toISOString().slice(0,10);

  const withTiming = DATA_EVENTS.map(ev => ({...ev, _timing: eventTiming(ev)}));
  const filtered   = withTiming.filter(ev =>
    (!q       || (ev.name+ev.place+ev.country+ev.description+ev.industry+ev.owner).toLowerCase().includes(q)) &&
    (!ftiming || ev._timing === ftiming) &&
    (!fstatus || ev.status  === fstatus) &&
    (!fmode   || ev.mode    === fmode) &&
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

  $('events-out').innerHTML = `
  <!-- KPI row -->
  <div class="kpi-row">
    <div class="kpi k-tot"><div class="lbl">Total</div><div class="val">${DATA_EVENTS.length}</div><div class="sub">Events</div></div>
    <div class="kpi k-pip" style="cursor:pointer" onclick="renderEvents('','Upcoming')"><div class="lbl">Upcoming</div><div class="val" style="color:var(--blue)">${cnt('Upcoming')}</div></div>
    <div class="kpi k-run" style="cursor:pointer" onclick="renderEvents('','Ongoing')"><div class="lbl">Ongoing</div><div class="val" style="color:var(--green)">${cnt('Ongoing')}</div></div>
    <div class="kpi k-tot" style="cursor:pointer" onclick="renderEvents('','Past')"><div class="lbl">Past</div><div class="val" style="color:var(--slate2)">${cnt('Past')}</div></div>
    <div class="kpi k-run"><div class="lbl">Active</div><div class="val" style="color:var(--green)">${DATA_EVENTS.filter(e=>e.status==='Active').length}</div></div>
    <div class="kpi k-pip"><div class="lbl">Watching</div><div class="val" style="color:var(--blue)">${DATA_EVENTS.filter(e=>e.status==='Watching').length}</div></div>
    <div class="kpi k-tot"><div class="lbl">Not Int.</div><div class="val" style="color:var(--slate2)">${DATA_EVENTS.filter(e=>e.status==='Not Interested').length}</div></div>
  </div>

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
    <select id="evmode" onchange="renderEvents()">
      <option value="">All Modes</option>
      ${EVENT_MODES.map(m=>`<option value="${m}"${fmode===m?' selected':''}>${m}</option>`).join('')}
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
      <th>Timing</th><th>Event</th><th>Status</th><th>Mode</th>
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
        <td style="font-size:.77rem">${ev.mode||'—'}</td>
        <td style="font-size:.75rem;color:var(--slate)">${ev.dateFrom||'—'}</td>
        <td style="font-size:.75rem;color:var(--slate)">${ev.dateTo||'—'}</td>
        <td style="font-size:.77rem"><div style="display:flex;align-items:center;gap:4px">${ev.country?countryFlag(ev.country):''}<span>${ev.place||'—'}</span></div></td>
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
      <div class="field-group"><label>Mode</label>
        <select id="dev-mode">${modeOpts}</select>
      </div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Date From</label><input id="dev-dfrom" type="date" value="${ev.dateFrom||''}"></div>
      <div class="field-group"><label>Date To</label><input id="dev-dto" type="date" value="${ev.dateTo||''}"></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Place</label><input id="dev-place" value="${esc(ev.place||'')}"></div>
      <div class="field-group"><label>Country</label><input id="dev-country" value="${esc(ev.country||'')}"></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Industry</label><select id="dev-ind"><option value="">— Select —</option>${indOpts}</select></div>
      <div class="field-group"><label>Owner</label>
        <select id="dev-own">${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();return`<option value="${n}"${ev.owner===n?' selected':''}>${n}</option>`;}).join('')}</select>
      </div>
    </div>
    <div class="field-group"><label>Website / Registration</label><input id="dev-link" value="${esc(ev.webLink||'')}" placeholder="https://…"></div>
    <div class="field-group"><label>Description</label><textarea id="dev-desc">${esc(ev.description||'')}</textarea></div>
    <div class="field-group"><label>Suggested Audience</label><input id="dev-aud" value="${esc(ev.audience||'')}" placeholder="Display (O-NN), …"></div>
    <div class="field-group"><label>Linked Companies</label>${parseLinks(ev.linkedCompanies,'CO')}
      <input id="dev-lco" value="${esc(ev.linkedCompanies||'')}" style="margin-top:4px" placeholder="Name (CO-NNN), …"></div>
    <div class="field-group"><label>Linked Opportunities</label>${parseLinks(ev.linkedOpps,'P')}
      <input id="dev-lopp" value="${esc(ev.linkedOpps||'')}" style="margin-top:4px" placeholder="Name (P-NNN), …"></div>
    <div class="field-group"><label>Linked Contacts</label>${parseLinks(ev.linkedContacts,'C')}
      <input id="dev-lcont" value="${esc(ev.linkedContacts||'')}" style="margin-top:4px" placeholder="Name (C-NNN), …"></div>
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
  const _evFlag = ev.country ? countryFlag(ev.country) : '';
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
      <div class="field-group"><label>Mode</label>
        <select id="dev-mode">${EVENT_MODES.map(m=>`<option>${m}</option>`).join('')}</select>
      </div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Date From</label><input id="dev-dfrom" type="date"></div>
      <div class="field-group"><label>Date To</label><input id="dev-dto" type="date"></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Place</label><input id="dev-place" placeholder="City…"></div>
      <div class="field-group"><label>Country</label><input id="dev-country" placeholder="CZ…"></div>
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
