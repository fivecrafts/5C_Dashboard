// 5C Dashboard v1.39.17 · 2026-07-07 · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// CONTACTS PAGE — table, search/filter, edit drawer, create new
// ════════════════════════════════════════════════════════════════
function renderContacts(q, fc) {
  q = q || ''; fc = fc || '';
  const filtered = DATA_CONTACTS.filter(r => {
    const name = contactDisplayName(r);  // Surname Name format
    return (!q  || [(name),(r.email||''),(r.company||''),(r.phone||''),(r.web||''),(r.src||''),(r.linkedOpps||'')].join(' ').toLowerCase().includes(q.toLowerCase())) &&
           (!fc || r.company === fc);
  }).sort((a,b)=>{
    const sl=(a.lastName||'').localeCompare(b.lastName||'');
    return sl!==0?sl:(a.firstName||'').localeCompare(b.firstName||'');
  });
  const companies = [...new Set(DATA_CONTACTS.map(r => r.company).filter(Boolean))].sort();
  const withEmail = DATA_CONTACTS.filter(r => r.email).length;
  const withPhone = DATA_CONTACTS.filter(r => r.phone).length;
  const linked    = DATA_CONTACTS.filter(r => r.linkedOpps).length;

  const _foc = _saveFocus();
  $('contacts-out').innerHTML = `
  <div class="stats-row">
    <div class="stat-card s-blue"><div class="sc-icon">👤</div><div class="sc-val">${DATA_CONTACTS.length}</div><div class="sc-lbl">Total Contacts</div></div>
    <div class="stat-card s-green"><div class="sc-icon">📧</div><div class="sc-val">${withEmail}</div><div class="sc-lbl">With Email</div><div class="sc-sub">${Math.round(withEmail/DATA_CONTACTS.length*100)||0}%</div></div>
    <div class="stat-card s-amber"><div class="sc-icon">📞</div><div class="sc-val">${withPhone}</div><div class="sc-lbl">With Phone</div><div class="sc-sub">${Math.round(withPhone/DATA_CONTACTS.length*100)||0}%</div></div>
    <div class="stat-card s-purple"><div class="sc-icon">🔗</div><div class="sc-val">${linked}</div><div class="sc-lbl">Linked to Opps</div></div>
  </div>
  </div>
  <div class="filter-bar">
    <input type="text" id="cq" placeholder="🔍  Search name, email, company…" value="${q}" oninput="renderContacts(this.value,undefined)">
    <select id="cfc" onchange="renderContacts(undefined,this.value)">
      <option value="">All Companies</option>
      ${companies.map(c => `<option${fc === c ? ' selected' : ''}>${c}</option>`).join('')}
    </select>
    <span class="cnt">${filtered.length}/${DATA_CONTACTS.length}</span>
  </div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>ID</th><th>Company</th><th>Name</th><th>Email</th><th>Phone</th><th>Linked Opportunities</th><th>Source</th></tr></thead>
    <tbody>${filtered.map(r => {
      const name  = [r.firstName, r.lastName].filter(Boolean).join(' ') || contactDisplayName(r);
      const safeId = (r.id || name).replace(/'/g, '__SQ__');
      const linkedCount = r.linkedOpps
        ? (r.linkedOpps.split(';').filter(Boolean).length + ' opp' +
           (r.linkedOpps.split(';').filter(Boolean).length !== 1 ? 's' : ''))
        : '—';
      return `<tr class="edit-row" onclick="openContactDrawer('${safeId}')">
        <td style="font-size:.7rem;color:var(--slate2)">${r.id || '—'}</td>
        <td onclick="event.stopPropagation()"><div style="display:flex;align-items:center;gap:6px">${r.company ? companyLogoFromName(r.company, 20) : ''}<span style="font-size:.77rem">${(()=>{const nm=r.company||(r.coId&&(DATA_COMPANIES||[]).find(c=>c.id===r.coId)?.name)||'';return nm?`<span class="contact-link" onclick="openCompanyFromName('${nm.replace(/'/g,'__SQ__')}')">${nm}</span>`:'—';})()}</span></div></td>
        <td><b style="color:var(--navy2)">${name || '—'}</b></td>
        <td style="font-size:.75rem"><a href="mailto:${r.email}" onclick="event.stopPropagation()" style="color:var(--blue)">${r.email || '—'}</a></td>
        <td style="font-size:.75rem">${r.phone || '—'}</td>
        <td style="font-size:.75rem;color:var(--blue);cursor:pointer">${linkedCount}</td>
        <td style="font-size:.68rem;color:var(--slate2)">${r.src || '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
  _restoreFocus(_foc);
}

// ── Contact Edit Drawer ───────────────────────────────────────
function openContactDrawer(safeId) {
  const id  = safeId.replace(/__SQ__/g, "'");
  const row = DATA_CONTACTS.find(r => r.id === id || ((r.firstName + ' ' + r.lastName).trim() === id));
  if (!row) return;
  drawerKey = id;
  const name = ((row.firstName || '') + ' ' + (row.lastName || '')).trim();

  const linkedList = row.linkedOpps
    ? row.linkedOpps.split(';').filter(Boolean).map(opp => {
        const oppTrimmed = opp.trim();
        return `<div class="linked-opp-item">
          <span class="linked-opp-link" onclick="openOppFromContact('${oppTrimmed.replace(/'/g, '__SQ__')}')">${oppTrimmed}</span>
        </div>`;
      }).join('')
    : '<div style="color:var(--slate2);font-size:.77rem">No linked opportunities</div>';

  const coLogo = row.company ? companyLogoFromName(row.company, 30) : '';
  const body = `
    ${row.company ? `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg);border-radius:8px;margin-bottom:10px;border:1px solid var(--border)">${coLogo}<span style="font-size:.82rem;font-weight:600;color:var(--navy2)">${esc(row.company)}</span></div>` : ''}
    <div class="field-row">
      <div class="field-group"><label>First Name</label><input id="dc-fn" value="${esc(row.firstName || '')}"></div>
      <div class="field-group"><label>Last Name</label><input id="dc-ln" value="${esc(row.lastName || '')}"></div>
    </div>
    <div class="field-group"><label>Company</label>
      <select id="dc-co">
        <option value="">— None —</option>
        ${[...(DATA_COMPANIES||[])].sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(c=>`<option value="${esc(c.name)}"${(row.company||'')=== c.name?' selected':''}>${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Email</label><input id="dc-em" type="email" value="${esc(row.email || '')}"></div>
      <div class="field-group"><label>Phone</label><input id="dc-ph" value="${esc(row.phone || '')}"></div>
    </div>
    <div class="field-group"><label>Web / LinkedIn</label><input id="dc-web" value="${esc(row.web || '')}"></div>
    <div class="field-group"><label>Source</label><input id="dc-src" value="${esc(row.src || '')}"></div>
    <div class="field-group"><label>Linked Opportunities</label>
      <div class="linked-opps">${linkedList}</div>
    </div>
    <div style="font-size:.7rem;color:var(--slate);margin-top:8px">${row.id || ''} · Created ${row.createdDate || '—'} · Updated ${row.updDate || '—'}</div>
    ${renderMsgPanel(row.id)}`;

  const foot = `
    <button class="sbtn sbtn-p" onclick="saveContactDrawer()" style="flex:1">✓ Save</button>
    <button class="sbtn" style="background:var(--teal-t);color:var(--teal);border:1px solid var(--teal-l)" onclick="openNewTask('contact','','${esc(name)}')">+ Task</button>
    <button class="sbtn" style="background:#fff5f5;color:var(--red);border:1px solid var(--red-l)" onclick="archiveContact('${esc(row.id)}')">⊘ Archive</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;

  openDrawer(name || 'Contact', body, foot, 'contact', id, row.id || '');
}

async function saveContactDrawer() {
  const id  = drawerKey;
  const row = DATA_CONTACTS.find(r => r.id === id || ((r.firstName + ' ' + r.lastName).trim() === id));
  if (!row) return;
  toast('Saving…', 'info');
  const companyName = $('dc-co').value.trim();
  const coRow = DATA_COMPANIES.find(c => c.name === companyName);
  const fields = {
    firstName:  $('dc-fn').value.trim(),
    lastName:   $('dc-ln').value.trim(),
    company:    companyName,
    email:      $('dc-em').value.trim(),
    phone:      $('dc-ph').value.trim(),
    web:        $('dc-web').value.trim(),
    src:        $('dc-src').value.trim(),
    linkedOpps: row.linkedOpps || '',
    createdDate: row.createdDate,
    coId:       coRow ? (coRow.id || '') : (row.coId || ''),
  };
  try {
    const ok = await P.saveContactRow(row, fields);
    if (ok) { Object.assign(row, fields); renderContacts('', ''); toast('✓ Saved', 'success'); closeDrawer(); }
    else toast('⚠ Save failed', 'error');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ── New Contact Drawer ────────────────────────────────────────
// ── Archive Contact ──────────────────────────────────────────
async function archiveContact(safeId) {
  const id = safeId.replace(/__SQ__/g,"'");
  const row = DATA_CONTACTS.find(r => r.id===id);
  if (!row) return;
  const fullName = ((row.firstName||'')+' '+(row.lastName||'')).trim();
  // Check: no linked pipeline rows
  const linkedOpps = DATA_PIPE.filter(r => r.contact === fullName);
  if (linkedOpps.length > 0) {
    toast(`⚠ Cannot archive — ${linkedOpps.length} opportunity/ies linked. Unlink them first.`,'error');
    return;
  }
  // Check: no open linked tasks
  const linkedTasks = DATA_TASKS.filter(t => t.linkedContact===fullName && t.status!=='Cancelled');
  if (linkedTasks.length > 0) {
    toast(`⚠ Cannot archive — ${linkedTasks.length} open task(s) linked. Cancel them first.`,'error');
    return;
  }
  if (!confirm(`Archive "${fullName}"?\nIt will be hidden from all views but kept in Excel.`)) return;
  try {
    await P.archiveRecord(activeCfg.sheets.contacts, row._row, 'M');
    toast('✓ Archived','success');
    closeDrawer();
    const j = await P.loadSheet(activeCfg.sheets.contacts);
    DATA_CONTACTS = P.parseContacts(j);
    updateCounts(); renderContacts('','');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function openNewContactDrawer(prefilledCompany) {
  const body = `
    <div class="field-row">
      <div class="field-group"><label>First Name</label><input id="dc-fn" value=""></div>
      <div class="field-group"><label>Last Name</label><input id="dc-ln" value=""></div>
    </div>
    <div class="field-group"><label>Company</label>
      <select id="dc-co">
        <option value="">— None —</option>
        ${[...(DATA_COMPANIES||[])].sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(c=>`<option value="${esc(c.name)}"${(prefilledCompany&&prefilledCompany=== c.name)?' selected':''}>${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Email</label><input id="dc-em" type="email" value=""></div>
      <div class="field-group"><label>Phone</label><input id="dc-ph" value=""></div>
    </div>
    <div class="field-group"><label>Web / LinkedIn</label><input id="dc-web" value=""></div>
    <div class="field-group"><label>Source</label><input id="dc-src" value="Manual user input"></div>`;
  const foot = `
    <button class="sbtn sbtn-p" onclick="createContactDrawer()" style="flex:1">+ Create Contact</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;
  openDrawer('New Contact', body, foot, 'new-contact', null);
}

async function createContactDrawer() {
  toast('Creating…', 'info');
  const companyName = $('dc-co').value.trim();
  // Resolve coId from company name → col L (FK to Companies sheet)
  const coRow = DATA_COMPANIES.find(c => c.name === companyName);
  const fields = {
    firstName: $('dc-fn').value.trim(),
    lastName:  $('dc-ln').value.trim(),
    company:   companyName,
    email:     $('dc-em').value.trim(),
    phone:     $('dc-ph').value.trim(),
    web:       $('dc-web').value.trim(),
    src:       $('dc-src').value.trim() || 'Manual user input',
    coId:      coRow ? (coRow.id || '') : '',
  };
  if (!fields.firstName && !fields.lastName) { toast('Enter at least a name', 'error'); return; }
  try {
    await P.createContact(fields);
    const j = await P.loadSheet(activeCfg.sheets.contacts);
    DATA_CONTACTS = P.parseContacts(j);
    updateCounts(); renderContacts('', '');
    toast('✓ Contact created', 'success'); closeDrawer();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}
