'use strict';

// ════════════════════════════════════════════════════════════════
// MY DASHBOARD — personal view filtered to logged-in user
// ════════════════════════════════════════════════════════════════
function renderMyDashboard() {
  const me      = window.CURRENT_USER_NAME || '';
  const myEmail = (window.CURRENT_USER_EMAIL || '').toLowerCase().split('@')[0];
  const today   = new Date().toISOString().slice(0,10);
  const SO      = { Running:0, Bidding:1, Pipeline:2, Prospect:3, Done:4, Cancelled:5 };

  function isMe(val) {
    if (!val) return false;
    const v = val.trim().toLowerCase();
    if (me && v === me.trim().toLowerCase()) return true;
    if (myEmail && v.replace(/[^a-z]/g,'').includes(myEmail.replace(/[^a-z]/g,''))) return true;
    const o = DATA_OWNERS.find(o => (o.displayName||'').toLowerCase() === v);
    if (o && o.email && myEmail && o.email.toLowerCase().split('@')[0] === myEmail) return true;
    return false;
  }

  const myOpps  = DATA_PIPE.filter(r => isMe(r.owner)).sort((a,b) => (SO[a.s]??9)-(SO[b.s]??9));
  const myTasks = DATA_TASKS.filter(t => isMe(t.responsible) && t.status==='Open')
                    .sort((a,b) => (a.dueDate||'9999') < (b.dueDate||'9999') ? -1 : 1);
  const myComp  = DATA_COMPANIES.filter(c => isMe(c.owner));
  const overdue = myTasks.filter(t => t.dueDate && t.dueDate < today).length;

  // Priority counts across my opps
  const prioCounts = {};
  PRIORITIES.forEach(p => { prioCounts[p] = myOpps.filter(r => (r.prio||'Medium')===p).length; });
  const prioColors = { Critical:'var(--pink)', High:'var(--red)', Medium:'var(--amber)', Low:'var(--green)' };
  const prioBgs    = { Critical:'var(--pink-t)', High:'var(--red-t)', Medium:'var(--amber-t)', Low:'var(--green-t)' };
  const prioBorders= { Critical:'var(--pink-l)', High:'var(--red-l)', Medium:'var(--amber-l)', Low:'var(--green-l)' };

  $('mydash-out').innerHTML = `
  <!-- ── Welcome ── -->
  <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--navy2)">👋 ${me || 'Welcome'}</div>
      <div style="font-size:.78rem;color:var(--slate);margin-top:2px">${new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    </div>
    <div style="display:flex;gap:8px">
      <div style="text-align:center;padding:8px 14px;background:var(--card);border:1px solid var(--border);border-radius:10px">
        <div style="font-size:1.4rem;font-weight:800;color:var(--navy2)">${myOpps.length}</div>
        <div style="font-size:.65rem;color:var(--slate)">My Opps</div>
      </div>
      <div style="text-align:center;padding:8px 14px;background:var(--card);border:1px solid var(--border);border-radius:10px">
        <div style="font-size:1.4rem;font-weight:800;color:var(--teal)">${myComp.length}</div>
        <div style="font-size:.65rem;color:var(--slate)">Companies</div>
      </div>
      <div style="text-align:center;padding:8px 14px;background:${overdue>0?'var(--red-t)':'var(--card)'};border:1px solid ${overdue>0?'var(--red-l)':'var(--border)'};border-radius:10px">
        <div style="font-size:1.4rem;font-weight:800;color:${overdue>0?'var(--red)':'var(--amber)'}">${myTasks.length}</div>
        <div style="font-size:.65rem;color:var(--slate)">${overdue>0?overdue+' overdue':'Tasks'}</div>
      </div>
    </div>
  </div>

  <!-- ── Priority breakdown ── -->
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:20px">
    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--slate);margin-bottom:10px">My Opportunities by Priority</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${PRIORITIES.map(p => `
        <div style="text-align:center;padding:10px 6px;background:${prioBgs[p]};border:1px solid ${prioBorders[p]};border-radius:9px;cursor:pointer" onclick="UI.nf('',null,'');setTimeout(()=>{const el=$('f-p');if(el){el.value='${p}';renderPipe('','','${p}','')}},100)">
          <div style="font-size:1.8rem;font-weight:800;color:${prioColors[p]};line-height:1">${prioCounts[p]}</div>
          <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:4px">
            ${prioDot(p)}<span style="font-size:.68rem;font-weight:600;color:${prioColors[p]}">${p}</span>
          </div>
          <div style="font-size:.62rem;color:var(--slate);margin-top:2px">${myOpps.filter(r=>(r.prio||'Medium')===p&&r.s==='Running').length} running</div>
        </div>`
      ).join('')}
    </div>
    <!-- Status mini-bar -->
    <div style="display:flex;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      ${['Running','Bidding','Pipeline','Prospect','Done','Cancelled'].map(s=>{
        const n = myOpps.filter(r=>r.s===s).length;
        const sc = {Running:'var(--green)',Bidding:'var(--purple)',Pipeline:'var(--blue)',Prospect:'var(--amber)',Done:'var(--slate2)',Cancelled:'var(--red)'}[s];
        return `<div style="flex:1;text-align:center;padding:5px 3px;border-radius:6px;background:${n>0?'#f8fafc':'transparent'};cursor:pointer" onclick="UI.nf('${s}',null,'')">
          <div style="font-size:.95rem;font-weight:700;color:${n>0?sc:'var(--slate2)'}">${n}</div>
          <div style="font-size:.58rem;color:var(--slate)">${s}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- ── My Opportunities ── -->
  <div style="margin-bottom:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="sect" style="margin:0;border:none;padding:0">⚡ My Opportunities <small style="font-size:.65rem;font-weight:400;color:var(--slate)">${myOpps.length} total</small></div>
      ${myOpps.length>0?`<button onclick="UI.nf('',null,'')" style="padding:3px 10px;border:1px solid var(--blue-l);border-radius:5px;background:var(--blue-t);color:var(--blue);font-size:.7rem;font-family:var(--font);cursor:pointer">View all →</button>`:''}
    </div>
    ${myOpps.length>0?`
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>Client</th><th>Project / Scope</th><th>Priority</th>
        <th>Status</th><th>Contact</th><th>Updated</th>
      </tr></thead>
      <tbody>${myOpps.map(r => {
        const safeKey = (r.c+'|||'+r.p).replace(/'/g,'__SQ__');
        const contactDisplay = r.contact
          ? `<span class="contact-link" onclick="event.stopPropagation();openContactFromPipeline('${r.contact.replace(/'/g,'__SQ__')}')">${r.contact}</span>`
          : '—';
        return `<tr class="edit-row" onclick="openPipeDrawer('${safeKey}')">
          <td><div style="display:flex;align-items:center;gap:7px">${companyLogoFromName(r.c,20)}<b style="color:var(--navy2)">${r.c}</b></div></td>
          <td style="font-size:.75rem;color:var(--slate)">${r.p||'—'}</td>
          <td>${prioBadge(r.prio||'Medium')}</td>
          <td>${badge(r.s)}</td>
          <td onclick="event.stopPropagation()" style="font-size:.75rem">${contactDisplay}</td>
          <td style="font-size:.72rem;color:var(--slate2)">${r.updDate||'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`
    :`<div style="padding:20px;text-align:center;color:var(--slate2);font-size:.82rem;background:var(--card);border-radius:10px;border:1px solid var(--border)">No opportunities assigned to you yet.</div>`}
  </div>

  <!-- ── My Companies ── -->
  ${myComp.length>0?`
  <div style="margin-bottom:20px">
    <div class="sect" style="margin-bottom:10px">🏢 My Companies <small style="font-size:.65rem;font-weight:400;color:var(--slate)">${myComp.length} total · ${myComp.filter(c=>c.type==='Customer'||c.type==='Both').length} customers · ${myComp.filter(c=>c.type==='Partnership'||c.type==='Both').length} partners</small></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Company</th><th>Type</th><th>Priority</th><th>Industry</th><th>Opportunities</th><th>Contacts</th></tr></thead>
      <tbody>${myComp.map(co => {
        const opps     = DATA_PIPE.filter(r => r.c===co.name);
        const contacts = DATA_CONTACTS.filter(r => r.company===co.name);
        const safeId   = (co.id||co.name).replace(/'/g,'__SQ__');
        return `<tr class="edit-row" onclick="openCompanyDrawer('${safeId}')">
          <td><div style="display:flex;align-items:center;gap:8px">${companyLogo(co.website,co.name,22)}<b style="color:var(--navy2)">${co.name}</b></div></td>
          <td>${compTypeBadge(co.type)}</td>
          <td>${prioBadge(co.prio||'Medium')}</td>
          <td style="font-size:.77rem">${co.industry||'—'}</td>
          <td style="font-size:.75rem">${opps.map(o=>`<span class="sb2 ${o.s==='Running'?'s-running':o.s==='Pipeline'?'s-pipeline':o.s==='Bidding'?'s-bidding':o.s==='Done'?'s-done':o.s==='Cancelled'?'s-cancelled':'s-prospect'}" style="margin-right:2px;font-size:.6rem">${o.p||o.c}</span>`).join('')||'—'}</td>
          <td style="font-size:.77rem;color:var(--teal)">${contacts.length||'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`:''}

  <!-- ── My Open Tasks ── -->
  <div>
    <div class="sect" style="margin-bottom:10px">✅ My Open Tasks <small style="font-size:.65rem;font-weight:400;color:var(--slate)">${myTasks.length} open${overdue>0?` · <span style="color:var(--red)">${overdue} overdue</span>`:''}</small></div>
    ${myTasks.length>0?`
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>Type</th><th>Priority</th><th>Linked Opportunity</th>
        <th>Linked Contact</th><th>Linked Company</th><th>Due Date</th><th>Notes</th>
      </tr></thead>
      <tbody>${myTasks.map(t => {
        const isOverdue = t.dueDate && t.dueDate < today;
        const safeId    = (t.id||'').replace(/'/g,'__SQ__');
        const coName    = t.linkedCompany ? (DATA_COMPANIES.find(c=>c.id===t.linkedCompany)?.name||t.linkedCompany) : '—';
        return `<tr class="edit-row" onclick="openTaskDrawer('${safeId}')">
          <td style="font-size:.78rem;font-weight:500">${t.type||'—'}</td>
          <td>${prioBadge(t.priority)}</td>
          <td style="font-size:.73rem"><span class="contact-link" onclick="event.stopPropagation();openOppFromTask('${(t.linkedOpp||'').replace(/'/g,'__SQ__')}')">${t.linkedOpp||'—'}</span></td>
          <td style="font-size:.73rem"><span class="contact-link" onclick="event.stopPropagation();openContactFromTask('${(t.linkedContact||'').replace(/'/g,'__SQ__')}')">${t.linkedContact||'—'}</span></td>
          <td style="font-size:.73rem">${coName!=='—'?`<span class="contact-link" onclick="event.stopPropagation();openCompanyFromName('${coName.replace(/'/g,'__SQ__')}')">${coName}</span>`:'—'}</td>
          <td style="font-size:.75rem;${isOverdue?'color:var(--red);font-weight:600':''}">${t.dueDate||'—'}${isOverdue?' ⚠':''}</td>
          <td style="font-size:.72rem;color:var(--slate2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.notes||'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`
    :`<div style="padding:20px;text-align:center;color:var(--slate2);font-size:.82rem;background:var(--card);border-radius:10px;border:1px solid var(--border)">No open tasks. 🎉</div>`}
  </div>`;
}
