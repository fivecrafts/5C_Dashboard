'use strict';

// ════════════════════════════════════════════════════════════════
// OWNERS PAGE — owner cards with BD flow visual + companies section
// ════════════════════════════════════════════════════════════════
function renderOwners() {
  const today = new Date().toISOString().slice(0,10);

  $('owners-out').innerHTML = `
  <div class="kpi-row">
    <div class="kpi k-tot"><div class="lbl">Owners</div><div class="val">${DATA_OWNERS.length}</div><div class="sub">Account managers</div></div>
    <div class="kpi k-run"><div class="lbl">Running</div><div class="val">${cnt('Running')}</div><div class="sub">Active projects</div></div>
    <div class="kpi k-pip"><div class="lbl">Pipeline</div><div class="val">${cnt('Pipeline')}</div><div class="sub">Active BD</div></div>
    <div class="kpi k-pro"><div class="lbl">Prospect</div><div class="val">${cnt('Prospect')}</div><div class="sub">Early stage</div></div>
    <div class="kpi k-bid"><div class="lbl">Bidding</div><div class="val">${cnt('Bidding')}</div><div class="sub">Proposals out</div></div>
    <div class="kpi k-done"><div class="lbl">Done</div><div class="val">${cnt('Done')}</div><div class="sub">Completed</div></div>
  </div>

  ${DATA_OWNERS.map(o => {
    const name  = o.displayName || ((o.firstName||'')+' '+(o.lastName||'')).trim();
    const rows  = DATA_PIPE.filter(r => r.owner === name);
    const col   = OC[name] || '#64748b';
    const ini   = name.split(' ').map(w=>w[0]).join('');
    const tasks = DATA_TASKS.filter(t => t.responsible===name && t.status==='Open').length;
    const overdue = DATA_TASKS.filter(t => t.responsible===name && t.status==='Open' && t.dueDate && t.dueDate<today).length;
    const sq    = name.replace(/'/g,'__SQ__');

    // BD Flow counts for this owner
    const flow  = ['Prospect','Pipeline','Bidding','Running','Done','Cancelled'];
    const flowCols = {Prospect:'var(--amber)',Pipeline:'var(--blue)',Bidding:'var(--purple)',Running:'var(--green)',Done:'var(--slate2)',Cancelled:'var(--red)'};
    const flowBg   = {Prospect:'var(--amber-t)',Pipeline:'var(--blue-t)',Bidding:'var(--purple-t)',Running:'var(--green-t)',Done:'#f1f5f9',Cancelled:'var(--red-t)'};
    const flowCounts = flow.map(s => rows.filter(r => r.s===s).length);

    // Companies for this owner
    const myComp = DATA_COMPANIES.filter(c => c.owner===name);
    const customers   = myComp.filter(c=>c.type==='Customer'||c.type==='Both');
    const partnerCos  = myComp.filter(c=>c.type==='Partnership'||c.type==='Both');

    return `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px">

      <!-- Owner header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:44px;height:44px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700;color:#fff;flex-shrink:0;cursor:pointer" onclick="UI.nf('',null,'${sq}')">${ini}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.95rem;color:var(--navy2)">${name}</div>
          <div style="font-size:.73rem;color:var(--slate)">${o.email||''}</div>
        </div>
        <div style="display:flex;gap:8px">
          <div style="text-align:center;padding:6px 10px;background:var(--blue-t);border-radius:8px;cursor:pointer" onclick="UI.nf('',null,'${sq}')">
            <div style="font-size:1.1rem;font-weight:700;color:var(--blue)">${rows.length}</div>
            <div style="font-size:.6rem;color:var(--slate)">Opps</div>
          </div>
          <div style="text-align:center;padding:6px 10px;background:${overdue>0?'var(--red-t)':'var(--amber-t)'};border-radius:8px;cursor:pointer" onclick="UI.nav('tasks',null);setTimeout(()=>renderTasks('','Open','${sq}'),100)">
            <div style="font-size:1.1rem;font-weight:700;color:${overdue>0?'var(--red)':'var(--amber)'}">${tasks}</div>
            <div style="font-size:.6rem;color:var(--slate)">${overdue>0?overdue+' overdue':'Tasks'}</div>
          </div>
          <div style="text-align:center;padding:6px 10px;background:var(--teal-t);border-radius:8px">
            <div style="font-size:1.1rem;font-weight:700;color:var(--teal)">${myComp.length}</div>
            <div style="font-size:.6rem;color:var(--slate)">Cos</div>
          </div>
        </div>
      </div>

      <!-- BD Flow pipeline visual -->
      <div style="margin-bottom:14px">
        <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--slate);margin-bottom:8px">BD Flow</div>
        <div style="display:flex;align-items:stretch;gap:0;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
          ${flow.map((s,i) => {
            const n = flowCounts[i];
            const isLast = i === flow.length-1;
            return `<div onclick="UI.nf('${s}',null,'${sq}')" style="flex:${s==='Cancelled'||s==='Done'?'0.7':'1'};text-align:center;padding:8px 4px;background:${n>0?flowBg[s]:'#f8fafc'};cursor:pointer;border-right:${isLast?'none':'1px solid var(--border)'};opacity:${n===0?'0.45':'1'};transition:opacity .15s">
              <div style="font-size:1rem;font-weight:700;color:${n>0?flowCols[s]:'var(--slate2)'}">${n}</div>
              <div style="font-size:.58rem;color:var(--slate);margin-top:1px">${s}</div>
            </div>`;
          }).join('')}
        </div>
        <!-- Flow arrows -->
        <div style="display:flex;align-items:center;margin-top:4px;font-size:.6rem;color:var(--slate2)">
          <span>Prospect</span><span style="flex:1;text-align:center">→</span>
          <span>Pipeline</span><span style="flex:1;text-align:center">→</span>
          <span>Bidding</span><span style="flex:1;text-align:center">→</span>
          <span>Running</span><span style="flex:1;text-align:center">→</span>
          <span>Done</span><span style="padding:0 6px">|</span>
          <span style="color:var(--red)">Cancelled</span>
        </div>
      </div>

      <!-- Companies section -->
      ${myComp.length > 0 ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

        <!-- Customers -->
        <div>
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--green);margin-bottom:6px">
            Customers &amp; Both (${customers.length})
          </div>
          ${customers.length > 0 ? `<div style="display:flex;flex-direction:column;gap:4px">
            ${customers.slice(0,6).map(c=>{
              const coOpps = DATA_PIPE.filter(r=>r.c===c.name).length;
              const safeCoId = (c.id||c.name).replace(/'/g,'__SQ__');
              return `<div onclick="openCompanyDrawer('${safeCoId}')" style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:#f8fafc;border-radius:6px;border:1px solid var(--border);cursor:pointer" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='#f8fafc'">
                ${companyLogo(c.website,c.name,18)}
                <span style="font-size:.75rem;font-weight:500;color:var(--navy2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
                ${coOpps>0?`<span style="font-size:.65rem;background:var(--blue-t);color:var(--blue);padding:1px 5px;border-radius:3px">${coOpps}</span>`:''}
              </div>`;
            }).join('')}
            ${customers.length>6?`<div style="font-size:.68rem;color:var(--slate);text-align:center;padding:2px">+${customers.length-6} more</div>`:''}
          </div>` : '<div style="font-size:.73rem;color:var(--slate2)">—</div>'}
        </div>

        <!-- Partners -->
        <div>
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--pink);margin-bottom:6px">
            Partners (${partnerCos.length})
          </div>
          ${partnerCos.length > 0 ? `<div style="display:flex;flex-direction:column;gap:4px">
            ${partnerCos.slice(0,6).map(c=>{
              const safeCoId = (c.id||c.name).replace(/'/g,'__SQ__');
              return `<div onclick="openCompanyDrawer('${safeCoId}')" style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:#fdf2f8;border-radius:6px;border:1px solid #fbcfe8;cursor:pointer" onmouseover="this.style.background='#fce7f3'" onmouseout="this.style.background='#fdf2f8'">
                ${companyLogo(c.website,c.name,18)}
                <span style="font-size:.75rem;font-weight:500;color:var(--navy2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
              </div>`;
            }).join('')}
            ${partnerCos.length>6?`<div style="font-size:.68rem;color:var(--slate);text-align:center;padding:2px">+${partnerCos.length-6} more</div>`:''}
          </div>` : '<div style="font-size:.73rem;color:var(--slate2)">—</div>'}
        </div>

      </div>` : '<div style="font-size:.73rem;color:var(--slate2)">No companies assigned</div>'}

    </div>`;
  }).join('')}`;
}
