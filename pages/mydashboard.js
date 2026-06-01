'use strict';

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

  const myOpps  = DATA_PIPE.filter(r => isMe(r.owner)).sort((a,b) => (SO[a.s]??9)-(SO[b.s]??9));
  const myTasks = DATA_TASKS.filter(t => isMe(t.responsible) && t.status==='Open')
                    .sort((a,b) => (a.dueDate||'9999') < (b.dueDate||'9999') ? -1 : 1);
  const myComp  = DATA_COMPANIES.filter(c => isMe(c.owner));
  const overdue = myTasks.filter(t => t.dueDate && t.dueDate < today).length;
  const sqMe    = me.replace(/'/g,'__SQ__');

  // Priority counts
  const prioCounts  = {};
  PRIORITIES.forEach(p => { prioCounts[p] = myOpps.filter(r => (r.prio||'Medium')===p).length; });
  const prioColors  = { Critical:'var(--pink)',  High:'var(--red)',  Medium:'var(--amber)',  Low:'var(--green)' };
  const prioBgs     = { Critical:'var(--pink-t)',High:'var(--red-t)',Medium:'var(--amber-t)',Low:'var(--green-t)' };
  const prioBorders = { Critical:'var(--pink-l)',High:'var(--red-l)',Medium:'var(--amber-l)',Low:'var(--green-l)' };

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
            <td style="padding:7px 11px">${prioBadge(r.prio||'Medium')}</td>
            <td style="padding:7px 11px">${badge(r.s)}</td>
            <td style="padding:7px 11px;font-size:.75rem" onclick="event.stopPropagation()">${cd}</td>
            <td style="padding:7px 11px;font-size:.72rem;color:var(--slate2)">${r.updDate||'—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`
    :`<div style="padding:20px;text-align:center;color:var(--slate2);font-size:.82rem">No opportunities assigned yet.</div>`}
  </div>

  <!-- ════════════════════════════════════════ -->
  <!-- MY COMPANIES BOARD                       -->
  <!-- ════════════════════════════════════════ -->
  ${myComp.length>0?`
  <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;margin-bottom:20px;overflow:hidden">

    <!-- Section header -->
    <div style="padding:14px 18px;background:linear-gradient(135deg,#065f46,#059669)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:.88rem;color:#fff">🏢 My Companies</div>
        <span style="font-size:.72rem;color:rgba(255,255,255,.6)">${myComp.length} total</span>
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
          <div style="font-size:1.1rem;font-weight:700;color:#fde68a">${myComp.filter(c=>c.industry).length}</div>
          <div style="font-size:.6rem;color:rgba(255,255,255,.65)">Industries</div>
        </div>
      </div>
    </div>

    <!-- Company summary KPI row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:1px;background:var(--border);border-bottom:1px solid var(--border)">
      ${[
        {l:'Total',       v:myComp.length,                                    c:'var(--navy2)',  bg:'#fff'},
        {l:'Customers',   v:customers.length,                                  c:'var(--green)',  bg:'var(--green-t)'},
        {l:'Partners',    v:partners.length,                                   c:'var(--pink)',   bg:'var(--pink-t)'},
        {l:'With Opps',   v:myComp.filter(c=>DATA_PIPE.some(p=>p.c===c.name)).length, c:'var(--blue)', bg:'var(--blue-t)'},
        {l:'Critical',    v:myComp.filter(c=>c.prio==='Critical').length,      c:'var(--pink)',   bg:'var(--pink-t)'},
        {l:'High',        v:myComp.filter(c=>c.prio==='High').length,          c:'var(--red)',    bg:'var(--red-t)'},
        {l:'Without Web', v:myComp.filter(c=>!c.website).length,              c:'var(--slate)',  bg:'#f8fafc'},
      ].map(({l,v,c,bg})=>`
        <div style="text-align:center;padding:10px 6px;background:${bg}">
          <div style="font-size:1.3rem;font-weight:800;color:${c};line-height:1">${v}</div>
          <div style="font-size:.62rem;color:var(--slate);margin-top:2px">${l}</div>
        </div>`).join('')}
    </div>

    <div style="padding:14px 18px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

        <!-- Customers column -->
        <div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--green);margin-bottom:8px;display:flex;align-items:center;gap:6px">
            🏢 Customers &amp; Both
            <span style="background:var(--green);color:#fff;font-size:.65rem;padding:1px 6px;border-radius:8px">${customers.length}</span>
          </div>
          ${customers.length>0?customers.map(co=>{
            const opps     = DATA_PIPE.filter(r=>r.c===co.name);
            const contacts = DATA_CONTACTS.filter(r=>r.company===co.name);
            const safeId   = (co.id||co.name).replace(/'/g,'__SQ__');
            return `<div onclick="openCompanyDrawer('${safeId}')" style="background:#f0fdf4;border:1px solid var(--green-l);border-radius:9px;padding:10px 12px;margin-bottom:7px;cursor:pointer" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                ${companyLogo(co.website,co.name,24)}
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:.82rem;color:var(--navy2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${co.name}</div>
                  <div style="font-size:.68rem;color:var(--slate)">${co.industry||'—'} ${co.country?'· '+co.country:''}</div>
                </div>
                ${prioBadge(co.prio||'Medium')}
              </div>
              <div style="display:flex;gap:6px">
                <div style="flex:1;text-align:center;padding:4px;background:#fff;border-radius:5px;border:1px solid var(--green-l)">
                  <div style="font-size:.9rem;font-weight:700;color:var(--blue)">${opps.length}</div>
                  <div style="font-size:.58rem;color:var(--slate)">Opps</div>
                </div>
                <div style="flex:1;text-align:center;padding:4px;background:#fff;border-radius:5px;border:1px solid var(--green-l)">
                  <div style="font-size:.9rem;font-weight:700;color:var(--teal)">${contacts.length}</div>
                  <div style="font-size:.58rem;color:var(--slate)">Contacts</div>
                </div>
                ${opps.length>0?`<div style="flex:2;padding:4px 6px;background:#fff;border-radius:5px;border:1px solid var(--green-l);overflow:hidden">
                  <div style="font-size:.58rem;color:var(--slate);margin-bottom:2px">Latest</div>
                  <div style="font-size:.68rem;color:var(--navy2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${opps[0].p||opps[0].c}</div>
                </div>`:''}
              </div>
            </div>`;
          }).join('')
          :`<div style="padding:10px;text-align:center;color:var(--slate2);font-size:.78rem">None</div>`}
        </div>

        <!-- Partners column -->
        <div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--pink);margin-bottom:8px;display:flex;align-items:center;gap:6px">
            🤝 Partners
            <span style="background:var(--pink);color:#fff;font-size:.65rem;padding:1px 6px;border-radius:8px">${partners.length}</span>
          </div>
          ${partners.length>0?partners.map(co=>{
            const opps     = DATA_PIPE.filter(r=>r.c===co.name);
            const contacts = DATA_CONTACTS.filter(r=>r.company===co.name);
            const safeId   = (co.id||co.name).replace(/'/g,'__SQ__');
            return `<div onclick="openCompanyDrawer('${safeId}')" style="background:#fdf2f8;border:1px solid var(--pink-l);border-radius:9px;padding:10px 12px;margin-bottom:7px;cursor:pointer" onmouseover="this.style.background='#fce7f3'" onmouseout="this.style.background='#fdf2f8'">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                ${companyLogo(co.website,co.name,24)}
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:.82rem;color:var(--navy2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${co.name}</div>
                  <div style="font-size:.68rem;color:var(--slate)">${co.industry||'—'} ${co.country?'· '+co.country:''}</div>
                </div>
                ${prioBadge(co.prio||'Medium')}
              </div>
              <div style="display:flex;gap:6px">
                <div style="flex:1;text-align:center;padding:4px;background:#fff;border-radius:5px;border:1px solid var(--pink-l)">
                  <div style="font-size:.9rem;font-weight:700;color:var(--blue)">${opps.length}</div>
                  <div style="font-size:.58rem;color:var(--slate)">Opps</div>
                </div>
                <div style="flex:1;text-align:center;padding:4px;background:#fff;border-radius:5px;border:1px solid var(--pink-l)">
                  <div style="font-size:.9rem;font-weight:700;color:var(--teal)">${contacts.length}</div>
                  <div style="font-size:.58rem;color:var(--slate)">Contacts</div>
                </div>
                ${opps.length>0?`<div style="flex:2;padding:4px 6px;background:#fff;border-radius:5px;border:1px solid var(--pink-l);overflow:hidden">
                  <div style="font-size:.58rem;color:var(--slate);margin-bottom:2px">Latest</div>
                  <div style="font-size:.68rem;color:var(--navy2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${opps[0].p||opps[0].c}</div>
                </div>`:''}
              </div>
            </div>`;
          }).join('')
          :`<div style="padding:10px;text-align:center;color:var(--slate2);font-size:.78rem">None</div>`}
        </div>

      </div>
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
