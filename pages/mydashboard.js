'use strict';

// ════════════════════════════════════════════════════════════════
// MY DASHBOARD — personal view filtered to logged-in user
// ════════════════════════════════════════════════════════════════
function renderMyDashboard() {
  const me      = window.CURRENT_USER_NAME || '';
  const myEmail = (window.CURRENT_USER_EMAIL || '').toLowerCase().split('@')[0];
  const today   = new Date().toISOString().slice(0, 10);
  const SO      = { Running:0, Bidding:1, Pipeline:2, Prospect:3, Done:4, Cancelled:5 };

  // Match owner by display name (case-insensitive) OR email prefix
  function isMe(val) {
    if (!val) return false;
    const v = val.trim().toLowerCase();
    if (me && v === me.trim().toLowerCase()) return true;
    if (myEmail && v.replace(/[^a-z]/g,'').includes(myEmail.replace(/[^a-z]/g,''))) return true;
    // Also match via DATA_OWNERS email
    const o = DATA_OWNERS.find(o => (o.displayName||'').toLowerCase() === v);
    if (o && o.email && myEmail && o.email.toLowerCase().split('@')[0] === myEmail) return true;
    return false;
  }

  const myOpps  = DATA_PIPE.filter(r => isMe(r.owner)).sort((a,b) => (SO[a.s]??9)-(SO[b.s]??9));
  const myTasks = DATA_TASKS.filter(t => isMe(t.responsible) && t.status === 'Open')
                    .sort((a,b) => (a.dueDate||'9999') < (b.dueDate||'9999') ? -1 : 1);
  const myComp  = DATA_COMPANIES.filter(c => isMe(c.owner));
  const overdue = myTasks.filter(t => t.dueDate && t.dueDate < today).length;

  $('mydash-out').innerHTML = `
  <div style="margin-bottom:18px">
    <div style="font-size:1.05rem;font-weight:700;color:var(--navy2)">👋 ${me || 'Welcome'}</div>
    <div style="font-size:.78rem;color:var(--slate);margin-top:2px">${new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
  </div>

  <div class="kpi-row">
    <div class="kpi k-tot"><div class="lbl">My Opportunities</div><div class="val">${myOpps.length}</div><div class="sub">Total assigned</div></div>
    <div class="kpi k-run"><div class="lbl">Running</div><div class="val">${myOpps.filter(r=>r.s==='Running').length}</div><div class="sub">Active</div></div>
    <div class="kpi k-pip"><div class="lbl">Pipeline</div><div class="val">${myOpps.filter(r=>r.s==='Pipeline').length}</div><div class="sub">Active BD</div></div>
    <div class="kpi k-pro"><div class="lbl">Prospect</div><div class="val">${myOpps.filter(r=>r.s==='Prospect').length}</div><div class="sub">Early stage</div></div>
    <div class="kpi k-pink"><div class="lbl">Open Tasks</div><div class="val">${myTasks.length}</div><div class="sub">${overdue > 0 ? `<span style="color:var(--red)">${overdue} overdue</span>` : 'none overdue'}</div></div>
    <div class="kpi k-teal"><div class="lbl">My Companies</div><div class="val">${myComp.length}</div><div class="sub">Assigned to me</div></div>
  </div>

  ${myComp.length ? `
  <div class="sect">My Companies</div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Company</th><th>Type</th><th>Industry</th><th>Opportunities</th><th>Contacts</th></tr></thead>
    <tbody>${myComp.map(co => {
      const opps     = DATA_PIPE.filter(r => r.c === co.name);
      const contacts = DATA_CONTACTS.filter(r => r.company === co.name);
      const safeId   = (co.id || co.name).replace(/'/g, '__SQ__');
      return `<tr class="edit-row" onclick="openCompanyDrawer('${safeId}')">
        <td><div style="display:flex;align-items:center;gap:8px">${companyLogoFromName(co.name, 24)}
          <b style="color:var(--navy2)">${co.name}</b></div></td>
        <td>${compTypeBadge(co.type)}</td>
        <td style="font-size:.77rem">${co.industry || '—'}</td>
        <td style="font-size:.75rem">${opps.map(o =>
          `<span class="sb2 ${o.s==='Running'?'s-running':o.s==='Pipeline'?'s-pipeline':o.s==='Bidding'?'s-bidding':o.s==='Done'?'s-done':o.s==='Cancelled'?'s-cancelled':'s-prospect'}" style="margin-right:3px;font-size:.62rem">${o.p||o.c}</span>`
        ).join('') || '—'}</td>
        <td style="font-size:.77rem">${contacts.length || '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>` : ''}

  <div class="sect">My Opportunities ${myOpps.length ? `<small>${myOpps.length} total</small>` : ''}</div>
  ${myOpps.length ? `
  <div class="tbl-wrap"><table>
    <thead><tr><th>Client</th><th>Project</th><th>Category</th><th>Status</th><th>Contact</th><th>Updated</th></tr></thead>
    <tbody>${myOpps.map(r => {
      const safeKey = (r.c+'|||'+r.p).replace(/'/g,'__SQ__');
      const contactDisplay = r.contact
        ? `<span class="contact-link" onclick="event.stopPropagation();openContactFromPipeline('${r.contact.replace(/'/g,'__SQ__')}')">${r.contact}</span>`
        : '—';
      return `<tr class="edit-row" onclick="openPipeDrawer('${safeKey}')">
        <td><div style="display:flex;align-items:center;gap:7px">${companyLogoFromName(r.c, 20)}
          <b style="color:var(--navy2)">${r.c}</b></div></td>
        <td style="font-size:.75rem;color:var(--slate)">${r.p || '—'}</td>
        <td>${catBadge(r.cat)}</td>
        <td>${badge(r.s)}</td>
        <td onclick="event.stopPropagation()" style="font-size:.75rem">${contactDisplay}</td>
        <td style="font-size:.72rem;color:var(--slate2)">${r.updDate || '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>` :
  `<div style="padding:20px;text-align:center;color:var(--slate2);font-size:.82rem;background:var(--card);border-radius:10px;border:1px solid var(--border)">
    No opportunities assigned to you yet.
  </div>`}

  <div class="sect" style="margin-top:8px">My Open Tasks ${myTasks.length ? `<small>${myTasks.length} open${overdue ? ` · <span style="color:var(--red)">${overdue} overdue</span>` : ''}</small>` : ''}</div>
  ${myTasks.length ? `
  <div class="tbl-wrap"><table>
    <thead><tr><th>Type</th><th>Priority</th><th>Linked Opportunity</th><th>Linked Contact</th><th>Due Date</th><th>Notes</th></tr></thead>
    <tbody>${myTasks.map(t => {
      const isOverdue = t.dueDate && t.dueDate < today;
      const safeId    = (t.id || '').replace(/'/g, '__SQ__');
      return `<tr class="edit-row" onclick="openTaskDrawer('${safeId}')">
        <td style="font-size:.78rem;font-weight:500">${t.type || '—'}</td>
        <td>${prioBadge(t.priority)}</td>
        <td style="font-size:.73rem">
          <span class="contact-link" onclick="event.stopPropagation();openOppFromTask('${(t.linkedOpp||'').replace(/'/g,'__SQ__')}')">${t.linkedOpp || '—'}</span>
        </td>
        <td style="font-size:.73rem">
          <span class="contact-link" onclick="event.stopPropagation();openContactFromTask('${(t.linkedContact||'').replace(/'/g,'__SQ__')}')">${t.linkedContact || '—'}</span>
        </td>
        <td style="font-size:.75rem;${isOverdue?'color:var(--red);font-weight:600':''}">${t.dueDate || '—'}${isOverdue ? ' ⚠' : ''}</td>
        <td style="font-size:.72rem;color:var(--slate2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.notes || '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>` :
  `<div style="padding:20px;text-align:center;color:var(--slate2);font-size:.82rem;background:var(--card);border-radius:10px;border:1px solid var(--border)">
    No open tasks assigned to you. 🎉
  </div>`}`;
}
