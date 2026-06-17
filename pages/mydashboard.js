// 5C Dashboard v1.30.0 · 2026-06-17 10:00 · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// MY DASHBOARD — inline status + priority dropdowns (same as pipeline)
// ════════════════════════════════════════════════════════════════
function buildMdStatusDrop(r, safeKey) {
  const menuId  = 'mds-' + safeKey;
  const cur     = r.s;
  const allowed = FLOW[r.s] || ALL_S;
  const safeK   = (r.c + '|||' + r.p).replace(/'/g,'__SQ__');
  const opts    = ALL_S.map(s => {
    const dis   = !allowed.includes(s) && s !== r.s;
    const safeS = s.replace(/'/g,'');
    const safeOr= r.s.replace(/'/g,'');
    return `<div class="cdrop-opt${cur===s?' active':''}${dis?' disabled':''}" onclick="closeDrop();onChgDirect('${safeK}','${safeOr}','${safeS}')">${statusDot(s)}<span>${s}</span></div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()"><div class="cdrop-trigger" onclick="event.stopPropagation();openDrop('${menuId}',this)">${statusDot(cur)}<span>${cur}</span><span class="arr">▾</span></div><div class="cdrop-menu" id="${menuId}">${opts}</div></div>`;
}

function buildMdPrioDrop(r, safeKey) {
  const menuId = 'mdp-' + safeKey;
  const cur    = r.prio || 'Medium';
  const origP  = cur.replace(/'/g,'');
  const safeK  = (r.c + '|||' + r.p).replace(/'/g,'__SQ__');
  const opts   = PRIORITIES.map(p => {
    const safeP = p.replace(/'/g,'');
    return `<div class="cdrop-opt${cur===p?' active':''}" onclick="closeDrop();onPrioChgDirect('${safeK}','${origP}','${safeP}')">${prioDot(p)}<span>${p}</span></div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()"><div class="cdrop-trigger" onclick="event.stopPropagation();openDrop('${menuId}',this)">${prioDot(cur)}<span>${cur}</span><span class="arr">▾</span></div><div class="cdrop-menu" id="${menuId}">${opts}</div></div>`;
}

// ════════════════════════════════════════════════════════════════
// MY DASHBOARD
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

  const MPO = {'Critical':0,'High':1,'Medium':2,'Low':3};
  const myOpps  = DATA_PIPE.filter(r => isMe(r.owner)).sort((a,b) => {
    const pd = (MPO[a.prio||'Medium']??2)-(MPO[b.prio||'Medium']??2);
    if (pd !== 0) return pd;
    const sd = (SO[a.s]??9)-(SO[b.s]??9);
    if (sd !== 0) return sd;
    return (a.c||'').localeCompare(b.c||'');
  });
  const myTasks = DATA_TASKS.filter(t => isMe(t.responsible) && t.status==='Open')
                    .sort((a,b) => (a.dueDate||'9999') < (b.dueDate||'9999') ? -1 : 1);
  const myComp  = DATA_COMPANIES.filter(c => isMe(c.owner)).sort((a,b) => {
    const pd = (MPO[a.prio||'Medium']??2)-(MPO[b.prio||'Medium']??2);
    if (pd !== 0) return pd;
    return (a.name||'').localeCompare(b.name||'');
  });
  const overdue = myTasks.filter(t => t.dueDate && t.dueDate < today).length;
  const sqMe    = me.replace(/'/g,'__SQ__');

  // Priority counts
  const prioCounts  = {};
  PRIORITIES.forEach(p => { prioCounts[p] = myOpps.filter(r => (r.prio||'Medium')===p).length; });
  const prioColors  = { Critical:'#7c3aed', High:'#ea580c', Medium:'#eab308', Low:'#16a34a' };
  const prioBgs     = { Critical:'#ede9fe',   High:'#fff1e6',   Medium:'#fefce8',   Low:'#dcfce7' };
  const prioBorders = { Critical:'#c4b5fd',   High:'#fed7aa',   Medium:'#fef08a',   Low:'#bbf7d0' };

  // Companies split
  const customers   = myComp.filter(c => c.type==='Customer'||c.type==='Both');
  const partners    = myComp.filter(c => c.type==='Partnership'||c.type==='Both');

  $('mydash-out').innerHTML = `

  <!-- ── Welcome header ── -->
  <div style="margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--navy2)">👋 ${me||'Welcome'}</div>
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

  <!-- ════════════════════════════════════════ -->
  <!-- MY OPPORTUNITIES                         -->
  <!-- ════════════════════════════════════════ -->
  <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;margin-bottom:20px;overflow:hidden">

    <!-- Section header -->
    <div style="padding:14px 18px;background:linear-gradient(135deg,#1e3a5f,#2563eb);display:flex;align-items:center;justify-content:space-between">
      <div style="font-weight:700;font-size:.88rem;color:#fff">⚡ My Opportunities</div>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:.72rem;color:rgba(255,255,255,.6)">${myOpps.length} total</span>
        ${myOpps.length>0?`<button onclick="UI.nf('',null,'${sqMe}')" style="padding:3px 10px;border:1px solid rgba(255,255,255,.3);border-radius:5px;background:rgba(255,255,255,.1);color:#fff;font-size:.7rem;font-family:var(--font);cursor:pointer">View all →</button>`:''}
      </div>
    </div>

    <div style="padding:14px 18px">
      <!-- Priority breakdown grid -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
        ${PRIORITIES.map(p => `
          <div style="text-align:center;padding:10px 6px;background:${prioBgs[p]};border:1px solid ${prioBorders[p]};border-radius:9px;cursor:pointer"
            onclick="UI.nf('',null,'${sqMe}');setTimeout(()=>{const fp=$('f-p');if(fp)fp.value='${p}';renderPipe('','','${p}','${sqMe}')},150)">
            <div style="font-size:1.8rem;font-weight:800;color:${prioColors[p]};line-height:1">${prioCounts[p]}</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:4px">
              ${prioDot(p)}<span style="font-size:.68rem;font-weight:600;color:${prioColors[p]}">${p}</span>
            </div>
            <div style="font-size:.62rem;color:var(--slate);margin-top:2px">${myOpps.filter(r=>(r.prio||'Medium')===p&&r.s==='Running').length} running</div>
          </div>`).join('')}
      </div>
      <!-- Status mini-bar -->
      <div style="display:flex;gap:4px;padding:8px 0 4px;border-top:1px solid var(--border)">
        ${['Running','Bidding','Pipeline','Prospect','Done','Cancelled'].map(s => {
          const n   = myOpps.filter(r=>r.s===s).length;
          const sc  = {Running:'var(--green)',Bidding:'var(--purple)',Pipeline:'var(--blue)',Prospect:'var(--amber)',Done:'var(--slate2)',Cancelled:'var(--red)'}[s];
          return `<div style="flex:1;text-align:center;padding:5px 2px;border-radius:6px;background:${n>0?'#f8fafc':'transparent'};cursor:pointer" onclick="UI.nf('${s}',null,'${sqMe}')">
            <div style="font-size:.95rem;font-weight:700;color:${n>0?sc:'var(--slate2)'}">${n}</div>
            <div style="font-size:.58rem;color:var(--slate)">${s}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Opportunities table -->
    ${myOpps.length>0?`
    <div style="border-top:1px solid var(--border)">
      <table style="width:100%;border-collapse:collapse;background:transparent">
        <thead><tr style="background:#f8fafc">
          <th style="padding:7px 14px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Client</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Project / Scope</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Priority</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Status</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Contact</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Updated</th>
        </tr></thead>
        <tbody>${myOpps.map(r => {
          const safeKey = (r.c+'|||'+r.p).replace(/'/g,'__SQ__');
          const cd = r.contact ? `<span class="contact-link" onclick="event.stopPropagation();openContactFromPipeline('${r.contact.replace(/'/g,'__SQ__')}')">${r.contact}</span>` : '—';
          return `<tr class="edit-row" onclick="openPipeDrawer('${safeKey}')">
            <td style="padding:7px 14px"><div style="display:flex;align-items:center;gap:7px">${companyLogoFromName(r.c,20)}<b style="color:var(--navy2)">${r.c}</b></div></td>
            <td style="padding:7px 11px;font-size:.75rem;color:var(--slate)">${r.p||'—'}</td>
            <td style="padding:7px 11px" onclick="event.stopPropagation()">${buildMdPrioDrop(r, safeKey)}</td>
            <td style="padding:7px 11px" onclick="event.stopPropagation()">${buildMdStatusDrop(r, safeKey)}</td>
            <td style="padding:7px 11px;font-size:.75rem" onclick="event.stopPropagation()">${cd}</td>
            <td style="padding:7px 11px;font-size:.72rem;color:var(--slate2)">${r.updDate||'—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`
    :`<div style="padding:20px;text-align:center;color:var(--slate2);font-size:.82rem">No opportunities assigned yet.</div>`}
  </div>

  <!-- ════════════════════════════════════════ -->
  <!-- MY COMPANIES                             -->
  <!-- ════════════════════════════════════════ -->
  ${myComp.length>0?`
  <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;margin-bottom:20px;overflow:hidden">

    <!-- Section header — same style as Opportunities -->
    <div style="padding:14px 18px;background:linear-gradient(135deg,#065f46,#059669)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:.88rem;color:#fff">🏢 My Companies</div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:.72rem;color:rgba(255,255,255,.6)">${myComp.length} total</span>
          <button onclick="UI.nav('companies',null)" style="padding:3px 10px;border:1px solid rgba(255,255,255,.3);border-radius:5px;background:rgba(255,255,255,.1);color:#fff;font-size:.7rem;font-family:var(--font);cursor:pointer">View all →</button>
        </div>
      </div>
      <!-- Summary KPI pills -->
      <div style="display:flex;gap:8px">
        <div style="flex:1;text-align:center;padding:7px 8px;background:rgba(255,255,255,.12);border-radius:8px;border:1px solid rgba(255,255,255,.15)">
          <div style="font-size:1.1rem;font-weight:700;color:#fff">${myComp.length}</div>
          <div style="font-size:.6rem;color:rgba(255,255,255,.65)">Total</div>
        </div>
        <div style="flex:1;text-align:center;padding:7px 8px;background:rgba(110,231,183,.2);border-radius:8px;border:1px solid rgba(110,231,183,.3)">
          <div style="font-size:1.1rem;font-weight:700;color:#6ee7b7">${customers.length}</div>
          <div style="font-size:.6rem;color:rgba(255,255,255,.65)">Customers</div>
        </div>
        <div style="flex:1;text-align:center;padding:7px 8px;background:rgba(249,168,212,.2);border-radius:8px;border:1px solid rgba(249,168,212,.3)">
          <div style="font-size:1.1rem;font-weight:700;color:#f9a8d4">${partners.length}</div>
          <div style="font-size:.6rem;color:rgba(255,255,255,.65)">Partners</div>
        </div>
        <div style="flex:1;text-align:center;padding:7px 8px;background:rgba(255,255,255,.1);border-radius:8px;border:1px solid rgba(255,255,255,.15)">
          <div style="font-size:1.1rem;font-weight:700;color:#fff">${myComp.filter(c=>DATA_PIPE.some(p=>p.c===c.name)).length}</div>
          <div style="font-size:.6rem;color:rgba(255,255,255,.65)">With Opps</div>
        </div>
        <div style="flex:1;text-align:center;padding:7px 8px;background:rgba(251,191,36,.15);border-radius:8px;border:1px solid rgba(251,191,36,.25)">
          <div style="font-size:1.1rem;font-weight:700;color:#fde68a">${myComp.filter(c=>c.prio==='Critical'||c.prio==='High').length}</div>
          <div style="font-size:.6rem;color:rgba(255,255,255,.65)">High+Crit</div>
        </div>
      </div>
    </div>

    <!-- Companies table — same style as Opportunities table -->
    <div style="border-top:1px solid var(--border)">
      <table style="width:100%;border-collapse:collapse;background:transparent">
        <thead><tr style="background:#f8fafc">
          <th style="padding:7px 14px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Company</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Type</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Priority</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Industry</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Opportunities</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Contacts</th>
          <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Website</th>
        </tr></thead>
        <tbody>${myComp.map(co => {
          const opps     = DATA_PIPE.filter(r => r.c===co.name);
          const contacts = DATA_CONTACTS.filter(r => r.company===co.name);
          const safeId   = (co.id||co.name).replace(/'/g,'__SQ__');
          const url      = co.website ? (co.website.match(/^https?:\/\//) ? co.website : 'https://'+co.website) : '';
          const oppBadges = opps.slice(0,2).map(o =>
            `<span onclick="event.stopPropagation();openPipeDrawer('${(o.c+'|||'+o.p).replace(/'/g,'__SQ__')}')" class="contact-link" style="font-size:.7rem;margin-right:4px">${statusDot(o.s)} ${o.p||o.c}</span>`
          ).join('') + (opps.length>2?`<span style="font-size:.68rem;color:var(--slate2)">+${opps.length-2}</span>`:'');
          return `<tr class="edit-row" onclick="openCompanyDrawer('${safeId}')">
            <td style="padding:7px 14px"><div style="display:flex;align-items:center;gap:8px">${companyLogo(co.website,co.name,22)}<b style="color:var(--navy2)">${co.name}</b></div></td>
            <td style="padding:7px 11px">${compTypeBadge(co.type)}</td>
            <td style="padding:7px 11px" onclick="event.stopPropagation()">${buildCoPrioDrop(co,safeId)}</td>
            <td style="padding:7px 11px;font-size:.77rem">${co.industry||'—'}</td>
            <td style="padding:7px 11px;font-size:.75rem" onclick="event.stopPropagation()">${opps.length>0?oppBadges:'—'}</td>
            <td style="padding:7px 11px;font-size:.77rem;color:var(--teal)">${contacts.length||'—'}</td>
            <td style="padding:7px 11px;font-size:.72rem">${url?`<a href="${url}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue)">${co.website.replace(/^https?:\/\/(www\.)?/,'')}</a>`:'—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  </div>`:``}

    <!-- ════════════════════════════════════════ -->
  <!-- MY OPEN TASKS                            -->
  <!-- ════════════════════════════════════════ -->
  <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden">
    <div style="padding:14px 18px;background:linear-gradient(135deg,#4c1d95,#7c3aed);display:flex;align-items:center;justify-content:space-between">
      <div style="font-weight:700;font-size:.88rem;color:#fff">✅ My Open Tasks</div>
      <div style="display:flex;gap:8px;align-items:center">
        ${overdue>0?`<span style="font-size:.72rem;color:#fca5a5;font-weight:600">${overdue} overdue ⚠</span>`:''}
        <span style="font-size:.72rem;color:rgba(255,255,255,.6)">${myTasks.length} open</span>
      </div>
    </div>
    ${myTasks.length>0?`
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f8fafc">
        <th style="padding:7px 14px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Type</th>
        <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Priority</th>
        <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Linked Opportunity</th>
        <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Linked Contact</th>
        <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Company</th>
        <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Due Date</th>
        <th style="padding:7px 11px;text-align:left;font-size:.64rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);border-bottom:1px solid var(--border)">Notes</th>
      </tr></thead>
      <tbody>${myTasks.map(t => {
        const isOverdue = t.dueDate && t.dueDate < today;
        const safeId    = (t.id||'').replace(/'/g,'__SQ__');
        const coName    = t.linkedCompany ? (DATA_COMPANIES.find(c=>c.id===t.linkedCompany)?.name||t.linkedCompany) : '—';
        return `<tr class="edit-row" onclick="openTaskDrawer('${safeId}')">
          <td style="padding:7px 14px;font-size:.78rem;font-weight:500">${t.type||'—'}</td>
          <td style="padding:7px 11px">${prioBadge(t.priority)}</td>
          <td style="padding:7px 11px;font-size:.73rem"><span class="contact-link" onclick="event.stopPropagation();openOppFromTask('${(t.linkedOpp||'').replace(/'/g,'__SQ__')}')">${t.linkedOpp||'—'}</span></td>
          <td style="padding:7px 11px;font-size:.73rem"><span class="contact-link" onclick="event.stopPropagation();openContactFromTask('${(t.linkedContact||'').replace(/'/g,'__SQ__')}')">${t.linkedContact||'—'}</span></td>
          <td style="padding:7px 11px;font-size:.73rem">${coName!=='—'?`<span class="contact-link" onclick="event.stopPropagation();openCompanyFromName('${coName.replace(/'/g,'__SQ__')}')">${coName}</span>`:'—'}</td>
          <td style="padding:7px 11px;font-size:.75rem;${isOverdue?'color:var(--red);font-weight:600':''}">${t.dueDate||'—'}${isOverdue?' ⚠':''}</td>
          <td style="padding:7px 11px;font-size:.72rem;color:var(--slate2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.notes||'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`
    :`<div style="padding:24px;text-align:center;color:var(--slate2);font-size:.82rem">No open tasks. 🎉</div>`}
  </div>`;
}
