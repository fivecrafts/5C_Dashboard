// 5C Dashboard v1.38.2 · 2026-06-19 · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// COMPANIES INLINE PRIORITY DROPDOWN
// ════════════════════════════════════════════════════════════════
function buildCoPrioDrop(co, safeId) {
  const menuId = 'cop-' + safeId;
  const cur    = co.prio || 'Medium';
  const opts   = PRIORITIES.map(p => {
    const safeP = p.replace(/'/g,'');
    return `<div class="cdrop-opt${cur===p?' active':''}" onclick="closeDrop();saveCoPrio('${safeId}','${safeP}')">${prioDot(p)}<span>${p}</span></div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()"><div class="cdrop-trigger" onclick="event.stopPropagation();openDrop('${menuId}',this)">${prioDot(cur)}<span>${cur}</span><span class="arr">▾</span></div><div class="cdrop-menu" id="${menuId}">${opts}</div></div>`;
}

async function saveCoPrio(safeId, newP) {
  const id = safeId.replace(/__SQ__/g,"'");
  const co = DATA_COMPANIES.find(r => r.id === id || r.name === id);
  if (!co || co.prio === newP) return;
  const today = new Date().toISOString().slice(0,10);
  try {
    const ok = await P.patchRange(activeCfg.sheets.companies, `D${co._row}`, [[newP]]);
    if (ok) {
      co.prio = newP;
      await P.patchRange(activeCfg.sheets.companies, `K${co._row}`, [[today]]).catch(()=>{});
      renderCompanies();
      toast(`✓ Priority → ${newP}`, 'success');
    } else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ════════════════════════════════════════════════════════════════
// COMPANIES PAGE — table view with 4 filters
// ════════════════════════════════════════════════════════════════
function renderCompanies(q, ft, fown, fprio, find) {
  if (q    === undefined) { const el=$('coq');    q    = el?el.value:''; }
  if (ft   === undefined) { const el=$('coft');   ft   = el?el.value:''; }
  if (fown === undefined) { const el=$('cofown');  fown = el?el.value:''; }
  if (fprio=== undefined) { const el=$('cofprio'); fprio= el?el.value:''; }
  if (find === undefined) { const el=$('cofind');  find = el?el.value:''; }
  q=q||'';ft=ft||'';fown=fown||'';fprio=fprio||'';find=find||'';

  const CPO = {'Critical':0,'High':1,'Medium':2,'Low':3};
  const filtered = DATA_COMPANIES.filter(r =>
    (!q  || [(r.name||''),(r.industry||''),(r.country||''),(r.owner||''),(r.notes||''),(r.website||''),(r.type||'')].join(' ').toLowerCase().includes(q.toLowerCase())) &&
    (!ft   || r.type === ft) &&
    (!fown || r.owner === fown) &&
    (!fprio|| r.prio === fprio) &&
    (!find || r.industry === find)
  ).sort((a,b) => {
    const pd = (CPO[a.prio||'Medium']??2) - (CPO[b.prio||'Medium']??2);
    if (pd !== 0) return pd;
    return (a.name||'').localeCompare(b.name||'');
  });
  const customers = DATA_COMPANIES.filter(r => r.type==='Customer'||r.type==='Both').length;
  const partners  = DATA_COMPANIES.filter(r => r.type==='Partnership'||r.type==='Both').length;
  const withOpps  = DATA_COMPANIES.filter(r => DATA_PIPE.some(p => p.c===r.name)).length;
  const owners    = [...new Set(DATA_COMPANIES.map(r=>r.owner).filter(Boolean))].sort();
  const industries= [...new Set(DATA_COMPANIES.map(r=>r.industry).filter(Boolean))].sort();

  const _foc = _saveFocus();
  $('companies-out').innerHTML = `
  <div class="stats-row">
    <div class="stat-card s-blue"><div class="sc-icon">🏢</div><div class="sc-val">${DATA_COMPANIES.length}</div><div class="sc-lbl">Total</div></div>
    <div class="stat-card s-green"><div class="sc-icon">🤝</div><div class="sc-val">${customers}</div><div class="sc-lbl">Customers</div></div>
    <div class="stat-card s-purple"><div class="sc-icon">🔗</div><div class="sc-val">${partners}</div><div class="sc-lbl">Partners</div></div>
    <div class="stat-card s-amber"><div class="sc-icon">⚡</div><div class="sc-val">${withOpps}</div><div class="sc-lbl">With Opps</div></div>
  </div>
  </div>

  <div class="filter-bar">
    <input type="text" id="coq" placeholder="🔍  Search company, notes…" value="${q}" oninput="renderCompanies(this.value)">
    <select id="coft" onchange="renderCompanies(undefined,this.value)">
      <option value="">All Types</option>
      <option value="Customer"${ft==='Customer'?' selected':''}>Customer</option>
      <option value="Partnership"${ft==='Partnership'?' selected':''}>Partnership</option>
      <option value="Both"${ft==='Both'?' selected':''}>Both</option>
    </select>
    <select id="cofown" onchange="renderCompanies(undefined,undefined,this.value)">
      <option value="">All Owners</option>
      ${owners.map(o=>`<option value="${o}"${fown===o?' selected':''}>${o}</option>`).join('')}
    </select>
    <select id="cofprio" onchange="renderCompanies(undefined,undefined,undefined,this.value)">
      <option value="">All Priorities</option>
      ${PRIORITIES.map(p=>`<option value="${p}"${fprio===p?' selected':''}>${p}</option>`).join('')}
    </select>
    <select id="cofind" onchange="renderCompanies(undefined,undefined,undefined,undefined,this.value)">
      <option value="">All Industries</option>
      ${industries.map(i=>`<option value="${i}"${find===i?' selected':''}>${i}</option>`).join('')}
    </select>
    <span class="cnt">${filtered.length}/${DATA_COMPANIES.length}</span>
    <button class="sbtn sbtn-p" onclick="openNewCompanyDrawer()" style="margin-left:auto">+ New Company</button>
  </div>

  ${DATA_COMPANIES.length === 0 ? `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:32px;text-align:center;color:var(--slate)">
      <div style="font-size:2rem;margin-bottom:8px">🏢</div>
      <div style="font-weight:600;margin-bottom:4px">No companies yet</div>
    </div>` :
  `<div class="tbl-wrap"><table>
    <thead><tr>
      <th>ID</th><th>Company</th><th>Type</th><th>Priority</th>
      <th>Industry</th><th>Country</th><th>Opportunities</th>
      <th>Contacts</th><th>Owner</th><th>Notes</th><th>Website</th>
    </tr></thead>
    <tbody>${filtered.map(co => {
      const opps     = DATA_PIPE.filter(r => r.c === co.name);
      const contacts = DATA_CONTACTS.filter(r => r.company === co.name);
      const safeId   = (co.id||co.name).replace(/'/g,'__SQ__');
      const oppBadges = opps.slice(0,2).map(o =>
        `<span class="sb2 ${o.s==='Running'?'s-running':o.s==='Pipeline'?'s-pipeline':o.s==='Bidding'?'s-bidding':o.s==='Done'?'s-done':o.s==='Cancelled'?'s-cancelled':'s-prospect'}" style="margin-right:3px;font-size:.62rem">${o.p||o.c}</span>`
      ).join('') + (opps.length>2?`<span style="font-size:.68rem;color:var(--slate2)"> +${opps.length-2}</span>`:'');
      const url = co.website ? (co.website.match(/^https?:\/\//) ? co.website : 'https://'+co.website) : '';
      return `<tr class="edit-row" onclick="openCompanyDrawer('${safeId}')">
        <td style="font-size:.7rem;color:var(--slate2)">${co.id||'—'}</td>
        <td><div style="display:flex;align-items:center;gap:8px">${companyLogo(co.website,co.name,28,'🏦')}<b style="color:var(--navy2)">${co.name||'—'}</b></div></td>
        <td>${compTypeBadge(co.type)}</td>
        <td onclick="event.stopPropagation()">${buildCoPrioDrop(co,safeId)}</td>
        <td style="font-size:.77rem">${co.industry||'—'}</td>
        <td style="font-size:.77rem">${co.country||'—'}</td>
        <td style="font-size:.75rem">${opps.length>0?oppBadges:'<span style="color:var(--slate2)">—</span>'}</td>
        <td style="font-size:.77rem;color:var(--teal)">${contacts.length>0?contacts.length+' contact'+(contacts.length!==1?'s':''):'<span style="color:var(--slate2)">—</span>'}</td>
        <td onclick="event.stopPropagation()" style="font-size:.75rem">${co.owner?`<span class="contact-link" onclick="UI.nav('owners',null)">${co.owner}</span>`:'—'}</td>
        <td style="font-size:.75rem;color:var(--slate);min-width:200px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(co.notes||'').replace(/"/g,"'")}">${co.notes||'—'}</td>
        <td style="font-size:.72rem">${url?`<a href="${url}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue)">${co.website.replace(/^https?:\/\/(www\.)?/,'')}</a>`:'—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`}`;
  _restoreFocus(_foc);
}

// ── Company Edit Drawer ──────────────────────────────────────
function openCompanyDrawer(safeId) {
  const id = safeId.replace(/__SQ__/g,"'");
  const co = DATA_COMPANIES.find(r => r.id===id||r.name===id);
  if (!co) return;
  const opps     = DATA_PIPE.filter(r => r.c===co.name);
  const contacts = DATA_CONTACTS.filter(r => r.company===co.name);

  const oppList = opps.length
    ? opps.map(o=>`<div class="linked-opp-item"><span class="linked-opp-link" onclick="openOppFromContact('${esc(o.c+(o.p?' · '+o.p:''))}')">${o.p||o.c}</span>${badge(o.s)}</div>`).join('')
    : '<div style="color:var(--slate2);font-size:.77rem">No opportunities</div>';
  const contList = contacts.length
    ? contacts.map(c=>{const name=contactDisplayName(c);const stored=((c.firstName||'')+' '+(c.lastName||'')).trim();return `<div class="linked-opp-item"><span class="linked-opp-link" onclick="openContactFromPipeline('${esc(stored)}')">${name}</span><span style="font-size:.7rem;color:var(--slate)">${c.email||''}</span></div>`;}).join('')
    : '<div style="color:var(--slate2);font-size:.77rem">No contacts</div>';

  const indOpts = INDUSTRIES.map(i=>`<option${co.industry===i?' selected':''}>${i}</option>`).join('');

  const body = `
    <div class="field-row">
      <div class="field-group"><label>Company Name</label><input id="dco-name" value="${esc(co.name||'')}"></div>
      <div class="field-group"><label>Type</label><select id="dco-type">
        ${['Customer','Partnership','Both'].map(t=>`<option${co.type===t?' selected':''}>${t}</option>`).join('')}
      </select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Priority</label>
        ${buildDrawerPrioDrop('dco-prio', co.prio||'Medium')}
      </div>
      <div class="field-group"><label>Industry</label><select id="dco-ind">
        <option value="">— Select —</option>${indOpts}
      </select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Country</label><input id="dco-cou" value="${esc(co.country||'')}"></div>
      <div class="field-group"><label>Website</label><input id="dco-web" value="${esc(co.website||'')}"></div>
    </div>
    <div class="field-group"><label>Owner</label>
      <select id="dco-own">
        ${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();return `<option value="${n}"${(co.owner||'')===n?' selected':''}>${n}</option>`;}).join('')}
      </select>
    </div>
    <div class="field-group"><label>Notes</label><textarea id="dco-notes">${esc(co.notes||'')}</textarea></div>
    <div class="field-group"><label>Opportunities (${opps.length})</label><div class="linked-opps">${oppList}</div></div>
    <div class="field-group"><label>Contacts (${contacts.length})</label><div class="linked-opps">${contList}</div></div>
    <div style="font-size:.7rem;color:var(--slate);margin-top:4px">${co.id||''} · Created ${co.createdDate||'—'}</div>`;

  const foot = `
    <button class="sbtn sbtn-p" onclick="saveCompanyDrawer('${esc(co.id||co.name)}')" style="flex:1">✓ Save</button>
    <button class="sbtn" style="background:var(--teal-t);color:var(--teal);border:1px solid var(--teal-l)" onclick="openNewTask('company','','','${esc(co.id||co.name)}')">+ Task</button>
    <button class="sbtn" style="background:var(--purple-t);color:var(--purple);border:1px solid var(--purple-l)" onclick="openNewContactDrawer('${esc(co.name)}')">+ Contact</button>
    <button class="sbtn" style="background:#fff5f5;color:var(--red);border:1px solid var(--red-l)" onclick="archiveCompany('${esc(co.id||co.name)}')">⊘ Archive</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;

  const logoHtml = companyLogo(co.website,co.name,32);
  openDrawer(co.name||'Company',body,foot,'company',id);
  setTimeout(()=>{const dh=$('drawer-title');if(dh)dh.innerHTML=`<span style="display:flex;align-items:center;gap:10px">${logoHtml}<span>${esc(co.name||'Company')}</span></span>`;},0);
}

async function saveCompanyDrawer(origId) {
  const co = DATA_COMPANIES.find(r=>r.id===origId||r.name===origId);
  if (!co) return;
  toast('Saving…','info');
  const fields = {
    name:     $('dco-name').value.trim(),
    type:     $('dco-type').value,
    prio:     $('dco-prio').value,
    website:  $('dco-web').value.trim(),
    industry: $('dco-ind').value,
    country:  $('dco-cou').value.trim(),
    owner:    $('dco-own').value.trim(),
    notes:    $('dco-notes').value.trim(),
  };
  try {
    const today = new Date().toISOString().slice(0,10);
    const ok = await P.patchRange(activeCfg.sheets.companies, `B${co._row}:K${co._row}`,
      [[fields.name,fields.type,fields.prio||'Medium',fields.website,fields.industry,fields.country,fields.owner,fields.notes,co.createdDate||today,today]]
    );
    if (ok) { Object.assign(co,fields); renderCompanies(); toast('✓ Saved','success'); closeDrawer(); }
    else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ── New Company Drawer ────────────────────────────────────────
// ── Archive Company ──────────────────────────────────────────
async function archiveCompany(safeId) {
  const id = safeId.replace(/__SQ__/g,"'");
  const co = DATA_COMPANIES.find(r => r.id===id||r.name===id);
  if (!co) return;
  // Check: no linked opportunities
  const linkedOpps = DATA_PIPE.filter(r => r.c===co.name || r.coId===co.id);
  if (linkedOpps.length > 0) {
    toast(`⚠ Cannot archive — ${linkedOpps.length} linked opportunity/ies. Unlink them first.`,'error');
    return;
  }
  // Check: no linked contacts
  const linkedConts = DATA_CONTACTS.filter(r => r.company===co.name || r.coId===co.id);
  if (linkedConts.length > 0) {
    toast(`⚠ Cannot archive — ${linkedConts.length} linked contact(s). Unlink them first.`,'error');
    return;
  }
  if (!confirm(`Archive "${co.name}"?\nIt will be hidden from all views but kept in Excel.`)) return;
  try {
    await P.archiveRecord(activeCfg.sheets.companies, co._row, 'L');
    toast('✓ Archived','success');
    closeDrawer();
    const j = await P.loadSheet(activeCfg.sheets.companies);
    DATA_COMPANIES = P.parseCompanies(j);
    updateCounts(); renderCompanies();
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function openNewCompanyDrawer() {
  const indOpts = INDUSTRIES.map(i=>`<option>${i}</option>`).join('');
  const body = `
    <div class="field-row">
      <div class="field-group"><label>Company Name</label><input id="dco-name" value=""></div>
      <div class="field-group"><label>Type</label><select id="dco-type">
        <option>Customer</option><option>Partnership</option><option>Both</option>
      </select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Priority</label>
        ${buildDrawerPrioDrop('dco-prio','Medium')}
      </div>
      <div class="field-group"><label>Industry</label><select id="dco-ind">
        <option value="">— Select —</option>${indOpts}
      </select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Country</label><input id="dco-cou" value=""></div>
      <div class="field-group"><label>Website</label><input id="dco-web" value=""></div>
    </div>
    <div class="field-group"><label>Owner</label>
      <select id="dco-own">
        ${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();return `<option value="${n}"${(window.CURRENT_USER_NAME||'')===n?' selected':''}>${n}</option>`;}).join('')}
      </select>
    </div>
    <div class="field-group"><label>Notes</label><textarea id="dco-notes"></textarea></div>`;
  const foot = `
    <button class="sbtn sbtn-p" onclick="createCompanyDrawer()" style="flex:1">+ Create Company</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;
  openDrawer('New Company',body,foot,'new-company',null);
}

async function createCompanyDrawer() {
  const name = $('dco-name').value.trim();
  if (!name) { toast('Company name required','error'); return; }
  toast('Creating…','info');
  const today = new Date().toISOString().slice(0,10);
  const maxCN = DATA_COMPANIES.reduce((m,c)=>{const n=parseInt((c.id||'').replace('CO-',''),10);return isNaN(n)?m:Math.max(m,n);},0);
  const newId = `CO-${String(maxCN+1).padStart(3,'0')}`;
  const fields = {
    name, type:$('dco-type').value, prio:$('dco-prio').value,
    website:$('dco-web').value.trim(), industry:$('dco-ind').value,
    country:$('dco-cou').value.trim(), owner:$('dco-own').value.trim(),
    notes:$('dco-notes').value.trim(),
  };
  try {
    await P.appendRow(activeCfg.sheets.companies,
      [[newId,fields.name,fields.type,fields.prio||'Medium',fields.website,
        fields.industry,fields.country,fields.owner,fields.notes,today,today]]
    );
    const j = await P.loadSheet(activeCfg.sheets.companies);
    DATA_COMPANIES = P.parseCompanies(j);
    updateCounts(); renderCompanies();
    toast('✓ Company created','success'); closeDrawer();
  } catch(e) { toast('Error: '+e.message,'error'); }
}
