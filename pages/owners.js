'use strict';

// ════════════════════════════════════════════════════════════════
// FIVE CRAFTS DASHBOARD — owner cards with BD flow + companies
// ════════════════════════════════════════════════════════════════

// Five Crafts logo SVG (inline, brand colours from brandbook)
const FC_LOGO_SVG = `<svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="38" cy="30" r="18" fill="#2CE6C7"/>
  <circle cx="65" cy="42" r="13" fill="#002F6C"/>
  <circle cx="30" cy="62" r="14" fill="#002F6C"/>
  <circle cx="60" cy="68" r="10" fill="#2CE6C7" opacity=".85"/>
  <circle cx="44" cy="48" r="8" fill="#002F6C" opacity=".7"/>
</svg>`;

function renderOwners() {
  const today = new Date().toISOString().slice(0,10);

  $('owners-out').innerHTML = `

  <!-- ══════════════════════════════════════════════════ -->
  <!-- FIVE CRAFTS BRANDED HEADER                         -->
  <!-- ══════════════════════════════════════════════════ -->
  <div style="background:linear-gradient(135deg,#002F6C 0%,#0f4fa8 60%,#0e7a70 100%);border-radius:16px;padding:24px 28px;margin-bottom:22px;position:relative;overflow:hidden">
    <!-- Subtle wave pattern overlay (brand element) -->
    <div style="position:absolute;inset:0;opacity:.07;background:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(44,230,199,.5) 8px,rgba(44,230,199,.5) 9px)"></div>
    <div style="position:relative;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <!-- Logo + title -->
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:52px;height:52px;background:rgba(255,255,255,.12);border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.2)">
          ${FC_LOGO_SVG}
        </div>
        <div>
          <div style="font-family:'Unbounded',sans-serif;font-weight:600;font-size:1.1rem;color:#fff;letter-spacing:.3px">5C Dashboard</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.6);margin-top:2px">Business Development Dashboard · ${new Date().getFullYear()}</div>
        </div>
      </div>
      <!-- KPI pills -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${[
          {l:'Total Opps', v:DATA_PIPE.length,      c:'rgba(255,255,255,.15)'},
          {l:'Running',    v:cnt('Running'),         c:'rgba(44,230,199,.25)'},
          {l:'Pipeline',   v:cnt('Pipeline'),        c:'rgba(37,99,235,.35)'},
          {l:'Prospect',   v:cnt('Prospect'),        c:'rgba(217,119,6,.35)'},
          {l:'Bidding',    v:cnt('Bidding'),         c:'rgba(124,58,237,.35)'},
          {l:'Done',       v:cnt('Done'),            c:'rgba(255,255,255,.1)'},
        ].map(({l,v,c})=>`
          <div style="text-align:center;padding:8px 12px;background:${c};border-radius:10px;border:1px solid rgba(255,255,255,.15);min-width:56px">
            <div style="font-size:1.2rem;font-weight:700;color:#fff;line-height:1">${v}</div>
            <div style="font-size:.6rem;color:rgba(255,255,255,.65);margin-top:2px">${l}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════ -->
  <!-- OWNER CARDS                                        -->
  <!-- ══════════════════════════════════════════════════ -->
  ${DATA_OWNERS.map(o => {
    const name     = o.displayName || ((o.firstName||'')+' '+(o.lastName||'')).trim();
    const rows     = DATA_PIPE.filter(r => r.owner === name);
    const col      = OC[name] || '#64748b';
    const ini      = name.split(' ').map(w=>w[0]).join('');
    const tasks    = DATA_TASKS.filter(t => t.responsible===name && t.status==='Open').length;
    const overdue  = DATA_TASKS.filter(t => t.responsible===name && t.status==='Open' && t.dueDate && t.dueDate<today).length;
    const sq       = name.replace(/'/g,'__SQ__');
    const myComp   = DATA_COMPANIES.filter(c => c.owner===name);
    const customers    = myComp.filter(c=>c.type==='Customer'||c.type==='Both');
    const partnerCos   = myComp.filter(c=>c.type==='Partnership'||c.type==='Both');
    const ownerId  = 'own_' + name.replace(/[^a-z0-9]/gi,'_');

    const FLOW_STEPS = [
      {s:'Prospect', col:'var(--amber)', bg:'var(--amber-t)', border:'var(--amber-l)'},
      {s:'Pipeline', col:'var(--blue)',  bg:'var(--blue-t)',  border:'var(--blue-l)'},
      {s:'Bidding',  col:'var(--purple)',bg:'var(--purple-t)',border:'var(--purple-l)'},
      {s:'Running',  col:'var(--green)', bg:'var(--green-t)', border:'var(--green-l)'},
      {s:'Done',     col:'var(--slate2)',bg:'#f1f5f9',        border:'var(--border)'},
    ];
    const cancelled = rows.filter(r=>r.s==='Cancelled').length;

    // Company card helper
    const compCard = (c, accentColor, hoverBg, borderColor) => {
      const coOpps = DATA_PIPE.filter(r=>r.c===c.name).length;
      const safeCoId = (c.id||c.name).replace(/'/g,'__SQ__');
      return `<div onclick="openCompanyDrawer('${safeCoId}')"
        style="display:flex;align-items:center;gap:7px;padding:6px 8px;background:#fff;border-radius:7px;border:1px solid ${borderColor};cursor:pointer;margin-bottom:5px"
        onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='#fff'">
        ${companyLogo(c.website,c.name,18)}
        <span style="font-size:.75rem;font-weight:500;color:var(--navy2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
        ${prioBadge(c.prio||'Medium')}
        ${coOpps>0?`<span style="font-size:.62rem;background:var(--blue-t);color:var(--blue);padding:1px 5px;border-radius:3px;white-space:nowrap;flex-shrink:0">${coOpps}</span>`:''}
      </div>`;
    };

    return `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;margin-bottom:18px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06)">

      <!-- Owner header -->
      <div style="display:flex;align-items:center;gap:14px;padding:18px 20px;background:linear-gradient(135deg,#0f2540 0%,#1a3a5c 100%);cursor:pointer" onclick="UI.nf('',null,'${sq}')">
        <div style="width:48px;height:48px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:#fff;flex-shrink:0;border:3px solid rgba(255,255,255,.2)">${ini}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:1rem;color:#fff">${name}</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.5);margin-top:1px">${o.email||''}</div>
        </div>
        <div style="display:flex;gap:8px">
          <div style="text-align:center;padding:8px 12px;background:rgba(255,255,255,.1);border-radius:10px;border:1px solid rgba(255,255,255,.15)">
            <div style="font-size:1.3rem;font-weight:700;color:#fff">${rows.length}</div>
            <div style="font-size:.62rem;color:rgba(255,255,255,.6)">Opportunities</div>
          </div>
          <div style="text-align:center;padding:8px 12px;background:rgba(255,255,255,.1);border-radius:10px;border:1px solid rgba(255,255,255,.15);cursor:pointer" onclick="event.stopPropagation();UI.nav('tasks',null);setTimeout(()=>renderTasks('','Open','${sq}'),100)">
            <div style="font-size:1.3rem;font-weight:700;color:${overdue>0?'#fca5a5':'#fff'}">${tasks}</div>
            <div style="font-size:.62rem;color:rgba(255,255,255,.6)">${overdue>0?overdue+' overdue':'Tasks'}</div>
          </div>
          <div style="text-align:center;padding:8px 12px;background:rgba(255,255,255,.1);border-radius:10px;border:1px solid rgba(255,255,255,.15)">
            <div style="font-size:.82rem;color:#fff"><span style="font-size:1rem;font-weight:700;color:#6ee7b7">${customers.length}</span> Cos&nbsp;·&nbsp;<span style="font-size:1rem;font-weight:700;color:#f9a8d4">${partnerCos.length}</span> P</div>
            <div style="font-size:.62rem;color:rgba(255,255,255,.5);margin-top:2px">Companies</div>
          </div>
        </div>
      </div>

      <div style="padding:16px 20px;display:flex;flex-direction:column;gap:16px">

        <!-- ── Opportunities ── -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--navy2)">⚡ Opportunities</div>
            ${rows.length>0?`<button onclick="UI.nf('',null,'${sq}')" style="padding:3px 10px;border:1px solid var(--blue-l);border-radius:5px;background:var(--blue-t);color:var(--blue);font-size:.7rem;font-family:var(--font);cursor:pointer">View all ${rows.length} →</button>`:''}
          </div>
          ${rows.length>0?`
          <div style="display:flex;gap:0;border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-bottom:8px">
            ${FLOW_STEPS.map(({s,col,bg,border},i)=>{
              const n=rows.filter(r=>r.s===s).length;
              return `<div onclick="UI.nf('${s}',null,'${sq}')" style="flex:1;text-align:center;padding:10px 4px;background:${n>0?bg:'#f8fafc'};cursor:pointer;border-right:${i<FLOW_STEPS.length-1?'1px solid var(--border)':'none'};transition:filter .15s" onmouseover="this.style.filter='brightness(.95)'" onmouseout="this.style.filter=''">
                <div style="font-size:1.4rem;font-weight:800;color:${n>0?col:'var(--slate2)'};line-height:1">${n}</div>
                <div style="font-size:.62rem;color:var(--slate);margin-top:3px;font-weight:${n>0?'600':'400'}">${s}</div>
              </div>`;
            }).join('')}
            <div onclick="UI.nf('Cancelled',null,'${sq}')" style="flex:.65;text-align:center;padding:10px 4px;background:${cancelled>0?'var(--red-t)':'#f8fafc'};border-left:2px dashed var(--border);cursor:pointer">
              <div style="font-size:1.4rem;font-weight:800;color:${cancelled>0?'var(--red)':'var(--slate2)'};line-height:1">${cancelled}</div>
              <div style="font-size:.62rem;color:var(--slate);margin-top:3px">Cancelled</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:3px;font-size:.6rem;color:var(--slate2)">
            ${FLOW_STEPS.map(({s},i)=>`<span style="font-weight:500">${s}</span>${i<FLOW_STEPS.length-1?'<span>→</span>':''}`).join('')}
            <span style="margin-left:8px;padding-left:8px;border-left:1px dashed var(--slate2);color:var(--red)">✕ Cancelled</span>
          </div>`
          :`<div style="padding:12px;text-align:center;color:var(--slate2);font-size:.8rem;background:#f8fafc;border-radius:8px;border:1px solid var(--border)">No opportunities assigned</div>`}
        </div>

        <!-- ── Companies + Partners ── -->
        ${myComp.length>0?`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

          <!-- Customers -->
          <div style="background:var(--green-t);border:1px solid var(--green-l);border-radius:10px;padding:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--green)">🏢 Customers</div>
              <span style="background:var(--green);color:#fff;font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:10px">${customers.length}</span>
            </div>
            ${customers.length>0?`
            ${customers.slice(0,4).map(c=>compCard(c,'var(--green)','#f0fdf4','var(--green-l)')).join('')}
            ${customers.length>4?`
              <div id="${ownerId}_cust_more" style="display:none">
                ${customers.slice(4).map(c=>compCard(c,'var(--green)','#f0fdf4','var(--green-l)')).join('')}
              </div>
              <button onclick="toggleExpand('${ownerId}_cust_more',this)"
                style="width:100%;padding:4px;border:1px dashed var(--green-l);border-radius:6px;background:transparent;color:var(--green);font-size:.7rem;cursor:pointer;font-family:var(--font)">
                + ${customers.length-4} more
              </button>`:''}
            `:'<div style="font-size:.73rem;color:var(--green);opacity:.6">None assigned</div>'}
          </div>

          <!-- Partners -->
          <div style="background:var(--pink-t);border:1px solid var(--pink-l);border-radius:10px;padding:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--pink)">🤝 Partners</div>
              <span style="background:var(--pink);color:#fff;font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:10px">${partnerCos.length}</span>
            </div>
            ${partnerCos.length>0?`
            ${partnerCos.slice(0,4).map(c=>compCard(c,'var(--pink)','#fdf2f8','var(--pink-l)')).join('')}
            ${partnerCos.length>4?`
              <div id="${ownerId}_part_more" style="display:none">
                ${partnerCos.slice(4).map(c=>compCard(c,'var(--pink)','#fdf2f8','var(--pink-l)')).join('')}
              </div>
              <button onclick="toggleExpand('${ownerId}_part_more',this)"
                style="width:100%;padding:4px;border:1px dashed var(--pink-l);border-radius:6px;background:transparent;color:var(--pink);font-size:.7rem;cursor:pointer;font-family:var(--font)">
                + ${partnerCos.length-4} more
              </button>`:''}
            `:'<div style="font-size:.73rem;color:var(--pink);opacity:.6">None assigned</div>'}
          </div>

        </div>`:''}

      </div>
    </div>`;
  }).join('')}`;
}

function toggleExpand(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const hidden = el.style.display === 'none';
  el.style.display = hidden ? 'block' : 'none';
  const count = btn.textContent.match(/\d+/)?.[0] || '';
  btn.textContent = hidden ? '▲ Show less' : `+ ${count} more`;
}
