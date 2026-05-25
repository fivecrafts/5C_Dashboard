'use strict';

// ════════════════════════════════════════════════════════════════
// COMPANIES PAGE — table view (consistent with all other pages)
// ════════════════════════════════════════════════════════════════
function renderCompanies(q, ft) {
  q = q || ''; ft = ft || '';
  const filtered  = DATA_COMPANIES.filter(r =>
    (!q  || (r.name + r.industry + r.country + r.owner + r.notes).toLowerCase().includes(q.toLowerCase())) &&
    (!ft || r.type === ft)
  );
  const customers = DATA_COMPANIES.filter(r => r.type === 'Customer'    || r.type === 'Both').length;
  const partners  = DATA_COMPANIES.filter(r => r.type === 'Partnership' || r.type === 'Both').length;
  const withOpps  = DATA_COMPANIES.filter(r => DATA_PIPE.some(p => p.c === r.name)).length;

  $('companies-out').innerHTML = `
  <div class="kpi-row">
    <div class="kpi k-tot"><div class="lbl">Total</div><div class="val">${DATA_COMPANIES.length}</div><div class="sub">Companies</div></div>
    <div class="kpi k-run"><div class="lbl">Customers</div><div class="val" style="color:var(--green)">${customers}</div><div class="sub">Customer / Both</div></div>
    <div class="kpi k-pip"><div class="lbl">Partners</div><div class="val" style="color:var(--blue)">${partners}</div><div class="sub">Partnership / Both</div></div>
    <div class="kpi k-pro"><div class="lbl">With Opps</div><div class="val" style="color:var(--amber)">${withOpps}</div><div class="sub">Linked to pipeline</div></div>
  </div>

  <div class="filter-bar">
    <input type="text" id="coq" placeholder="🔍  Search company, industry, country…" value="${q}" oninput="renderCompanies(this.value,undefined)">
    <select id="coft" onchange="renderCompanies(undefined,this.value)">
      <option value="">All Types</option>
      <option value="Customer"${ft === 'Customer' ? ' selected' : ''}>Customer</option>
      <option value="Partnership"${ft === 'Partnership' ? ' selected' : ''}>Partnership</option>
      <option value="Both"${ft === 'Both' ? ' selected' : ''}>Both</option>
    </select>
    <span class="cnt">${filtered.length}/${DATA_COMPANIES.length}</span>
  </div>

  ${DATA_COMPANIES.length === 0 ? `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:32px;text-align:center;color:var(--slate)">
      <div style="font-size:2rem;margin-bottom:8px">🏢</div>
      <div style="font-weight:600;margin-bottom:4px">No companies yet</div>
      <div style="font-size:.8rem">Add a <b>Companies</b> sheet to 5C_Pipeline.xlsx with headers:<br>
      Company ID · Company Name · Type · Website · Industry · Country · Owner · Notes · Created Date · Updated Date</div>
    </div>` :
  `<div class="tbl-wrap"><table>
    <thead><tr>
      <th>ID</th>
      <th>Company</th>
      <th>Type</th>
      <th>Industry</th>
      <th>Country</th>
      <th>Opportunities</th>
      <th>Contacts</th>
      <th>Owner</th>
      <th>Website</th>
    </tr></thead>
    <tbody>${filtered.map(co => {
      const opps     = DATA_PIPE.filter(r => r.c === co.name);
      const contacts = DATA_CONTACTS.filter(r => r.company === co.name);
      const safeId   = (co.id || co.name).replace(/'/g, '__SQ__');
      // Show up to 2 opp badges inline
      const oppBadges = opps.slice(0, 2).map(o =>
        `<span class="sb2 ${o.s==='Running'?'s-running':o.s==='Pipeline'?'s-pipeline':o.s==='Bidding'?'s-bidding':o.s==='Done'?'s-done':o.s==='Cancelled'?'s-cancelled':'s-prospect'}" style="margin-right:3px;font-size:.62rem">${o.p||o.c}</span>`
      ).join('') + (opps.length > 2 ? `<span style="font-size:.68rem;color:var(--slate2)"> +${opps.length - 2}</span>` : '');
      return `<tr class="edit-row" onclick="openCompanyDrawer('${safeId}')">
        <td style="font-size:.7rem;color:var(--slate2)">${co.id || '—'}</td>
        <td><div style="display:flex;align-items:center;gap:8px">${companyLogo(co.website, co.name, 28)}<div><b style="color:var(--navy2)">${co.name || '—'}</b>${co.notes ? `<div class="dc" style="margin-top:1px" title="${(co.notes||'').replace(/"/g,"'")}">${co.notes}</div>` : ''}</div></div></td>
        <td>${compTypeBadge(co.type)}</td>
        <td style="font-size:.77rem">${co.industry || '—'}</td>
        <td style="font-size:.77rem">${co.country || '—'}</td>
        <td style="font-size:.75rem">${opps.length > 0 ? oppBadges : '<span style="color:var(--slate2)">—</span>'}</td>
        <td style="font-size:.77rem;color:var(--teal)">${contacts.length > 0 ? contacts.length + ' contact' + (contacts.length !== 1 ? 's' : '') : '<span style="color:var(--slate2)">—</span>'}</td>
        <td style="font-size:.75rem">${co.owner || '—'}</td>
        <td style="font-size:.72rem">${co.website ? `<a href="${co.website}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue)">${co.website.replace(/^https?:\/\//,'')}</a>` : '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`}`;
}

// ── Company Edit Drawer ───────────────────────────────────────
function openCompanyDrawer(safeId) {
  const id = safeId.replace(/__SQ__/g, "'");
  const co = DATA_COMPANIES.find(r => r.id === id || r.name === id);
  if (!co) return;

  const opps     = DATA_PIPE.filter(r => r.c === co.name);
  const contacts = DATA_CONTACTS.filter(r => r.company === co.name);

  const oppList = opps.length
    ? opps.map(o => `<div class="linked-opp-item">
        <span class="linked-opp-link" onclick="openOppFromContact('${esc(o.c + (o.p ? ' · ' + o.p : ''))}')">${o.p || o.c}</span>
        ${badge(o.s)}
      </div>`).join('')
    : '<div style="color:var(--slate2);font-size:.77rem">No opportunities</div>';

  const contList = contacts.length
    ? contacts.map(c => {
        const name = ((c.firstName || '') + ' ' + (c.lastName || '')).trim();
        return `<div class="linked-opp-item">
          <span class="linked-opp-link" onclick="openContactFromPipeline('${esc(name)}')">${name}</span>
          <span style="font-size:.7rem;color:var(--slate)">${c.email || ''}</span>
        </div>`;
      }).join('')
    : '<div style="color:var(--slate2);font-size:.77rem">No contacts</div>';

  const body = `
    <div class="field-row">
      <div class="field-group"><label>Company Name</label><input id="dco-name" value="${esc(co.name || '')}"></div>
      <div class="field-group"><label>Type</label><select id="dco-type">
        ${['Customer','Partnership','Both'].map(t => `<option${co.type === t ? ' selected' : ''}>${t}</option>`).join('')}
      </select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Industry</label><input id="dco-ind" value="${esc(co.industry || '')}"></div>
      <div class="field-group"><label>Country</label><input id="dco-cou" value="${esc(co.country || '')}"></div>
    </div>
    <div class="field-group"><label>Website</label><input id="dco-web" value="${esc(co.website || '')}"></div>
    <div class="field-group"><label>Owner</label>
      <input id="dco-own" value="${esc(co.owner || '')}" list="owners-list" autocomplete="off">
    </div>
    <div class="field-group"><label>Notes</label><textarea id="dco-notes">${esc(co.notes || '')}</textarea></div>
    <div class="field-group"><label>Opportunities (${opps.length})</label><div class="linked-opps">${oppList}</div></div>
    <div class="field-group"><label>Contacts (${contacts.length})</label><div class="linked-opps">${contList}</div></div>
    <div style="font-size:.7rem;color:var(--slate);margin-top:4px">${co.id || ''} · Created ${co.createdDate || '—'}</div>`;

  const foot = `
    <button class="sbtn sbtn-p" onclick="saveCompanyDrawer('${esc(co.id || co.name)}')" style="flex:1">✓ Save</button>
    <button class="sbtn" style="background:var(--teal-t);color:var(--teal);border:1px solid var(--teal-l)" onclick="openNewTask('company','','')">+ Task</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;

  // Pass logo-enhanced title directly to openDrawer
  const logoHtml = companyLogo(co.website, co.name, 32);
  const titleHtml = `<span style="display:flex;align-items:center;gap:10px">${logoHtml}<span>${esc(co.name || 'Company')}</span></span>`;
  openDrawer(co.name || 'Company', body, foot, 'company', id);
  // Set after openDrawer since openDrawer uses textContent
  setTimeout(() => { const dh = $('drawer-title'); if (dh) dh.innerHTML = titleHtml; }, 0);
}

async function saveCompanyDrawer(origId) {
  const co = DATA_COMPANIES.find(r => r.id === origId || r.name === origId);
  if (!co) return;
  toast('Saving…', 'info');
  const fields = {
    name:     $('dco-name').value.trim(),
    type:     $('dco-type').value,
    industry: $('dco-ind').value.trim(),
    country:  $('dco-cou').value.trim(),
    website:  $('dco-web').value.trim(),
    owner:    $('dco-own').value.trim(),
    notes:    $('dco-notes').value.trim(),
  };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const ok = await P.patchRange(
      activeCfg.sheets.companies,
      `B${co._row}:J${co._row}`,
      [[fields.name, fields.type, fields.website, fields.industry, fields.country, fields.owner, fields.notes, co.createdDate || today, today]]
    );
    if (ok) { Object.assign(co, fields); renderCompanies('', ''); toast('✓ Saved', 'success'); closeDrawer(); }
    else toast('⚠ Save failed', 'error');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ── New Company Drawer ────────────────────────────────────────
function openNewCompanyDrawer() {
  const body = `
    <div class="field-row">
      <div class="field-group"><label>Company Name</label><input id="dco-name" value=""></div>
      <div class="field-group"><label>Type</label><select id="dco-type">
        <option>Customer</option><option>Partnership</option><option>Both</option>
      </select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Industry</label><input id="dco-ind" value=""></div>
      <div class="field-group"><label>Country</label><input id="dco-cou" value=""></div>
    </div>
    <div class="field-group"><label>Website</label><input id="dco-web" value=""></div>
    <div class="field-group"><label>Owner</label>
      <input id="dco-own" value="${window.CURRENT_USER_NAME || ''}" list="owners-list" autocomplete="off">
    </div>
    <div class="field-group"><label>Notes</label><textarea id="dco-notes"></textarea></div>`;
  const foot = `
    <button class="sbtn sbtn-p" onclick="createCompanyDrawer()" style="flex:1">+ Create Company</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;
  openDrawer('New Company', body, foot, 'new-company', null);
}

async function createCompanyDrawer() {
  const name = $('dco-name').value.trim();
  if (!name) { toast('Company name required', 'error'); return; }
  toast('Creating…', 'info');
  const today = new Date().toISOString().slice(0, 10);
  const newId = `CO-${String(DATA_COMPANIES.length + 1).padStart(3, '0')}`;
  const fields = {
    name,
    type:     $('dco-type').value,
    website:  $('dco-web').value.trim(),
    industry: $('dco-ind').value.trim(),
    country:  $('dco-cou').value.trim(),
    owner:    $('dco-own').value.trim(),
    notes:    $('dco-notes').value.trim(),
  };
  try {
    await P.appendRow(activeCfg.sheets.companies,
      [[newId, fields.name, fields.type, fields.website, fields.industry,
        fields.country, fields.owner, fields.notes, today, today]]
    );
    const j = await P.loadSheet(activeCfg.sheets.companies);
    DATA_COMPANIES = P.parseCompanies(j);
    updateCounts(); renderCompanies('', '');
    toast('✓ Company created', 'success'); closeDrawer();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}
