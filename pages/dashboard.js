// 5C Dashboard v1.30.0 · 2026-06-17 10:00 · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// DASHBOARD PAGE — KPI cards, legend, owner grid, opp table
// ════════════════════════════════════════════════════════════════
function renderDash() {
  const SO     = { Running:0, Bidding:1, Pipeline:2, Prospect:3, Done:4, Cancelled:5 };
  const sorted = [...DATA_PIPE].sort((a, b) => (SO[a.s] ?? 9) - (SO[b.s] ?? 9));
  const owners = (window.OWNERS || []).filter(Boolean);
  const openTasks = DATA_TASKS.filter(t => t.status === 'Open').length;
  const overdue   = DATA_TASKS.filter(t =>
    t.status === 'Open' && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)
  ).length;

  $('dash-out').innerHTML = `
  <div class="kpi-row">
    <div class="kpi k-tot" onclick="UI.nav('pipeline',null)"><div class="lbl">Total Opps</div><div class="val">${DATA_PIPE.length}</div><div class="sub">All opportunities</div></div>
    <div class="kpi k-run" onclick="UI.nf('Running',null)"><div class="lbl">Running</div><div class="val">${cnt('Running')}</div><div class="sub">Active</div></div>
    <div class="kpi k-bid" onclick="UI.nf('Bidding',null)"><div class="lbl">Bidding</div><div class="val">${cnt('Bidding')}</div><div class="sub">Proposals</div></div>
    <div class="kpi k-pip" onclick="UI.nf('Pipeline',null)"><div class="lbl">Pipeline</div><div class="val">${cnt('Pipeline')}</div><div class="sub">Active BD</div></div>
    <div class="kpi k-pro" onclick="UI.nf('Prospect',null)"><div class="lbl">Prospect</div><div class="val">${cnt('Prospect')}</div><div class="sub">Early stage</div></div>
    <div class="kpi k-teal" onclick="UI.nav('contacts',null)"><div class="lbl">Contacts</div><div class="val">${DATA_CONTACTS.length}</div><div class="sub">In database</div></div>
    <div class="kpi" style="--c:#0f766e" onclick="UI.nav('companies',null)"><div class="lbl">Companies</div><div class="val" style="color:#0f766e">${DATA_COMPANIES.length}</div><div class="sub">Customer &amp; partner</div></div>
    <div class="kpi k-pink" onclick="UI.nav('tasks',null)"><div class="lbl">Open Tasks</div><div class="val">${openTasks}</div><div class="sub">${overdue} overdue</div></div>
  </div>

  <div class="legend">
    <h3>Legend</h3>
    <div class="legend-grid">
      <div class="legend-section">
        <h4>Status Workflow</h4>
        <div class="legend-items">
          <span class="legend-item"><span class="legend-dot" style="background:var(--amber)"></span>Prospect — early signal</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--blue)"></span>Pipeline — active BD</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--purple)"></span>Bidding — proposal sent</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--green)"></span>Running — signed</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--slate2)"></span>Done — completed</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--red)"></span>Cancelled — archived</span>
        </div>
      </div>
      <div class="legend-section">
        <h4>Category</h4>
        <div class="legend-items">
          <span class="legend-item"><span class="cb cat-project">Project</span> Delivery engagement</span>
          <span class="legend-item"><span class="cb cat-partnership">Partnership</span> Partner/vendor</span>
          <span class="legend-item"><span class="cb cat-pipeline">Pipeline</span> Sales opportunity</span>
          <span class="legend-item"><span class="cb cat-prospect">Prospect</span> Named target</span>
        </div>
      </div>
    </div>
  </div>

  <div class="sect">By Owner <small>click card to filter · click stat to filter by status</small></div>
  <div class="owner-grid">${owners.map(o => {
    const rows = DATA_PIPE.filter(r => r.owner === o);
    const col  = OC[o] || '#64748b';
    const ini  = o.split(' ').map(w => w[0]).join('');
    const sq   = o.replace(/'/g, '__SQ__');
    return `<div class="oc" onclick="UI.nf('',null,'${sq}')">
      <div class="oc-top">
        <div class="oc-av" style="background:${col}">${ini}</div>
        <div>
          <div class="oc-name">${o}</div>
          <div class="oc-role">${rows.length} total · <span style="color:var(--blue);font-size:.65rem">view all →</span></div>
        </div>
      </div>
      <div class="oc-stats">
        <div class="oc-stat" style="background:var(--green-t)"  onclick="event.stopPropagation();UI.nf('Running',null,'${sq}')"><div class="v" style="color:var(--green)">${rows.filter(r => r.s === 'Running').length}</div><div class="l">Run</div></div>
        <div class="oc-stat" style="background:var(--blue-t)"   onclick="event.stopPropagation();UI.nf('Pipeline',null,'${sq}')"><div class="v" style="color:var(--blue)">${rows.filter(r => r.s === 'Pipeline').length}</div><div class="l">Pipe</div></div>
        <div class="oc-stat" style="background:var(--amber-t)"  onclick="event.stopPropagation();UI.nf('Prospect',null,'${sq}')"><div class="v" style="color:var(--amber)">${rows.filter(r => r.s === 'Prospect').length}</div><div class="l">Pro</div></div>
        <div class="oc-stat" style="background:var(--purple-t)" onclick="event.stopPropagation();UI.nf('Bidding',null,'${sq}')"><div class="v" style="color:var(--purple)">${rows.filter(r => r.s === 'Bidding').length}</div><div class="l">Bid</div></div>
      </div>
    </div>`;
  }).join('')}</div>

  <div class="sect">All Opportunities
    <small><button onclick="UI.nav('pipeline',null)" style="padding:2px 8px;border:1px solid var(--border2);border-radius:5px;background:var(--card);cursor:pointer;font-family:var(--font);font-size:.68rem;color:var(--blue)">Edit status →</button></small>
  </div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Client</th><th>Project</th><th>Category</th><th>Status</th><th>Owner</th></tr></thead>
    <tbody>${sorted.map(r => `<tr>
      <td><div style="display:flex;align-items:center;gap:7px">${companyLogoFromName(r.c, 22)}<b style="color:var(--navy2)">${r.c}</b></div></td>
      <td style="font-size:.75rem;color:var(--slate)">${r.p || '—'}</td>
      <td>${catBadge(r.cat)}</td>
      <td>${badge(r.s)}</td>
      <td style="font-size:.75rem">${r.owner || '—'}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
