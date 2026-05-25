'use strict';

// ════════════════════════════════════════════════════════════════
// OWNERS PAGE — read-only owner cards with stats + open task count
// ════════════════════════════════════════════════════════════════
function renderOwners() {
  $('owners-out').innerHTML = `
  <div class="kpi-row">
    <div class="kpi k-tot"><div class="lbl">Owners</div><div class="val">${DATA_OWNERS.length}</div><div class="sub">Account managers</div></div>
    <div class="kpi k-run"><div class="lbl">Total Running</div><div class="val">${cnt('Running')}</div><div class="sub">Active projects</div></div>
    <div class="kpi k-pip"><div class="lbl">Total Pipeline</div><div class="val">${cnt('Pipeline')}</div><div class="sub">Active BD</div></div>
    <div class="kpi k-pro"><div class="lbl">Total Prospect</div><div class="val">${cnt('Prospect')}</div><div class="sub">Early stage</div></div>
  </div>
  <div class="owner-grid">${DATA_OWNERS.map(o => {
    const name  = o.displayName || ((o.firstName || '') + ' ' + (o.lastName || '')).trim();
    const rows  = DATA_PIPE.filter(r => r.r === name);
    const col   = OC[name] || '#64748b';
    const ini   = name.split(' ').map(w => w[0]).join('');
    const tasks = DATA_TASKS.filter(t => t.responsible === name && t.status === 'Open').length;
    const sq    = name.replace(/'/g, '__SQ__');
    return `<div class="oc" onclick="UI.nf('',null,'${sq}')">
      <div class="oc-top">
        <div class="oc-av" style="background:${col}">${ini}</div>
        <div>
          <div class="oc-name">${name}</div>
          <div class="oc-role">${o.email || ''}</div>
          <div class="oc-role">${rows.length} opps · <span class="contact-link" onclick="event.stopPropagation();UI.nav('tasks',null);setTimeout(()=>renderTasks('','Open',''+name),100)" style="font-size:.67rem">${tasks} open tasks</span></div>
        </div>
      </div>
      <div class="oc-stats">
        <div class="oc-stat" style="background:var(--green-t)"><div class="v" style="color:var(--green)">${rows.filter(r => r.s === 'Running').length}</div><div class="l">Run</div></div>
        <div class="oc-stat" style="background:var(--blue-t)"><div class="v" style="color:var(--blue)">${rows.filter(r => r.s === 'Pipeline').length}</div><div class="l">Pipe</div></div>
        <div class="oc-stat" style="background:var(--amber-t)"><div class="v" style="color:var(--amber)">${rows.filter(r => r.s === 'Prospect').length}</div><div class="l">Pro</div></div>
        <div class="oc-stat" style="background:var(--purple-t)"><div class="v" style="color:var(--purple)">${rows.filter(r => r.s === 'Bidding').length}</div><div class="l">Bid</div></div>
      </div>
    </div>`;
  }).join('')}</div>`;
}
