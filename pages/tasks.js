// 5C Dashboard v1.40.1 · 2026-07-07 · Five Crafts s.r.o.
'use strict';

function taskTypeIcon(type) {
  const MAP = {
    'Intro Call':'📞','Send Email':'📧','Organize Meeting':'🤝','Follow-up Call':'🔄',
    'Schedule Demo':'📅','Send Pitchdeck':'💼','Send Proposal':'📋','Send NDA':'🧾',
    'Send Contract':'📄','Prepare RfP Response':'📝','Contract Review':'⚖️',
    'Negotiate Terms':'🏆','Close Deal':'✅','LinkedIn Connect':'🔗',
    'Research / Due Diligence':'🔍','Event Follow-up':'📣','Intro to Team':'👤',
    // Legacy types
    'Organize Meet':'🤝','Organize Call':'📞','Followup Call':'🔄',
    'Send Pitchdeck':'💼','Send Contract':'📄','Send Proposal':'📋',
    'Other':'💬',
  };
  return MAP[type] || '💬';
}

// ════════════════════════════════════════════════════════════════
// TASKS INLINE STATUS DROPDOWN  — Open=Blue, Done=Green, Cancelled=Grey
// ════════════════════════════════════════════════════════════════
function buildTaskStatusDrop(r) {
  // Outlook-linked tasks: status is read-only (synced from Outlook)
  if (r.outlookEventId) {
    const cur = r.status || 'Open';
    const isOwner = !r.responsible || r.responsible === (window.CURRENT_USER_NAME||'');
    const dot  = taskStatusDot(cur);
    const hint = isOwner ? 'Synced from Outlook — open drawer to sync' : 'Managed in owner\'s Outlook';
    return `<div title="${hint}" style="display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:6px;background:var(--blue-t);border:1px solid var(--blue-l);font-size:.75rem;white-space:nowrap">${dot}<span>${cur}</span><span style="font-size:.65rem;opacity:.6">⇄</span></div>`;
  }
  const menuId = 'tsd-' + (r.id||'').replace(/[^a-z0-9]/gi,'_');
  const cur    = r.status || 'Open';
  const TSTAT  = ['Open','Done','Cancelled'];
  const opts   = TSTAT.map(s => {
    const safeId = (r.id||'').replace(/'/g,'__SQ__');
    return `<div class="cdrop-opt${cur===s?' active':''}" onclick="closeDrop();saveTaskStatusDirect('${safeId}','${s}')">${taskStatusDot(s)}<span>${s}</span></div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()"><div class="cdrop-trigger" onclick="event.stopPropagation();openDrop('${menuId}',this)" style="min-width:100px">${taskStatusDot(cur)}<span>${cur}</span><span class="arr">▾</span></div><div class="cdrop-menu" id="${menuId}">${opts}</div></div>`;
}

async function saveTaskStatusDirect(safeId, newS) {
  const id  = safeId.replace(/__SQ__/g,"'");
  const row = DATA_TASKS.find(r => r.id === id);
  if (!row || row.status === newS) return;
  try {
    const ok = await P.patchRange(activeCfg.sheets.tasks, `G${row._row}`, [[newS]]);
    if (ok) {
      row.status = newS;
      renderTasks();
      toast(`✓ Status → ${newS}`, 'success');
    } else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

// ════════════════════════════════════════════════════════════════
// TASKS INLINE PRIORITY DROPDOWN
// ════════════════════════════════════════════════════════════════
function buildTaskPrioDrop(r) {
  const menuId = 'tp-' + (r.id || '').replace(/'/g,'__SQ__');
  const cur    = r.priority || 'Medium';
  const safeId = (r.id || '').replace(/'/g,'__SQ__');
  const opts   = PRIORITIES.map(p => {
    const safeP = p.replace(/'/g,'');
    return `<div class="cdrop-opt${cur===p?' active':''}" onclick="closeDrop();saveTaskPrio('${safeId}','${safeP}')">${prioDot(p)}<span>${p}</span></div>`;
  }).join('');
  return `<div class="cdrop" onclick="event.stopPropagation()"><div class="cdrop-trigger" onclick="event.stopPropagation();openDrop('${menuId}',this)">${prioDot(cur)}<span>${cur}</span><span class="arr">▾</span></div><div class="cdrop-menu" id="${menuId}">${opts}</div></div>`;
}

async function saveTaskPrio(safeId, newP) {
  const id  = safeId.replace(/__SQ__/g,"'");
  const row = DATA_TASKS.find(r => r.id === id);
  if (!row || row.priority === newP) return;
  try {
    // Rev 19: Priority at col K (index 10)
    const ok = await P.patchRange(activeCfg.sheets.tasks, `K${row._row}`, [[newP]]);
    if (ok) {
      row.priority = newP;
      renderTasks();
      toast(`✓ Priority → ${newP}`, 'success');
    } else toast('⚠ Save failed', 'error');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ════════════════════════════════════════════════════════════════
// TASKS PAGE — table with overdue detection, create/edit drawer
// ════════════════════════════════════════════════════════════════
function renderTasks(q, fs, fr, ftype, fprio, fcomp) {
  if (q     === undefined) { const el=$('tq');     q     = el?el.value:''; }
  if (fs    === undefined) { const el=$('tfs');    fs    = el?el.value:''; }
  if (fr    === undefined) { const el=$('tfr');    fr    = el?el.value:''; }
  if (ftype === undefined) { const el=$('tft');    ftype = el?el.value:''; }
  if (fprio === undefined) { const el=$('tfprio'); fprio = el?el.value:''; }
  if (fcomp === undefined) { const el=$('tfcomp'); fcomp = el?el.value:''; }
  q=q||'';fs=fs||'';fr=fr||'';ftype=ftype||'';fprio=fprio||'';fcomp=fcomp||'';

  const today = new Date().toISOString().slice(0, 10);
  const TPO = {'Critical':0,'High':1,'Medium':2,'Low':3};
  const filtered = DATA_TASKS.filter(r => {
    const overdue  = r.status === 'Open' && r.dueDate && r.dueDate < today;
    const fsMatch  = !fs || (fs === 'Overdue' ? overdue : r.status === fs);
    return (!q     || [(r.type||''),(r.linkedOpp||''),(r.linkedContact||''),(r.linkedCompany||''),(r.notes||''),(r.responsible||''),(r.priority||''),(r.taskName||'')].join(' ').toLowerCase().includes(q.toLowerCase())) &&
           fsMatch &&
           (!fr    || r.responsible === fr) &&
           (!ftype || r.type === ftype) &&
           (!fprio || (r.priority||'Medium') === fprio) &&
           (!fcomp || r.linkedCompany === fcomp);
  }).sort((a,b) => {
    const pd = (TPO[a.priority||'Medium']??2) - (TPO[b.priority||'Medium']??2);
    if (pd !== 0) return pd;
    return (a.taskName||a.type||'').localeCompare(b.taskName||b.type||'');
  });
  const open      = DATA_TASKS.filter(t => t.status === 'Open').length;
  const done      = DATA_TASKS.filter(t => t.status === 'Done').length;
  const cancelled = DATA_TASKS.filter(t => t.status === 'Cancelled').length;
  const overdue   = DATA_TASKS.filter(t => t.status === 'Open' && t.dueDate && t.dueDate < today).length;

  const _foc = _saveFocus();
  $('tasks-out').innerHTML = `
  <div class="stats-row">
    <div class="stat-card"><div class="sc-icon">📋</div><div class="sc-val" style="color:var(--navy)">${DATA_TASKS.length}</div><div class="sc-lbl">Total</div></div>
    <div class="stat-card s-amber clickable" onclick="renderTasks('','Open','')"><div class="sc-icon">✅</div><div class="sc-val">${open}</div><div class="sc-lbl">Open</div></div>
    <div class="stat-card s-green clickable" onclick="renderTasks('','Done','')"><div class="sc-icon">✔️</div><div class="sc-val">${done}</div><div class="sc-lbl">Done</div></div>
    <div class="stat-card s-red clickable" onclick="renderTasks('','Cancelled','')"><div class="sc-icon">⊘</div><div class="sc-val">${cancelled}</div><div class="sc-lbl">Cancelled</div></div>
  </div>
  </div>
  <div class="filter-bar">
    <input type="text" id="tq" placeholder="🔍  Search…" value="${q}" oninput="renderTasks(this.value)">
    <select id="tfs" onchange="renderTasks(undefined,this.value)">
      <option value="">All Statuses</option>
      <option value="Open"${fs==='Open'?' selected':''}>Open</option>
      <option value="Done"${fs==='Done'?' selected':''}>Done</option>
      <option value="Cancelled"${fs==='Cancelled'?' selected':''}>Cancelled</option>
      <option value="Overdue"${fs==='Overdue'?' selected':''}>Overdue</option>
    </select>
    <select id="tft" onchange="renderTasks(undefined,undefined,undefined,this.value)">
      <option value="">All Types</option>
      ${TASK_TYPES.map(t=>`<option value="${t}"${ftype===t?' selected':''}>${t}</option>`).join('')}
    </select>
    <select id="tfprio" onchange="renderTasks(undefined,undefined,undefined,undefined,this.value)">
      <option value="">All Priorities</option>
      ${PRIORITIES.map(p=>`<option value="${p}"${fprio===p?' selected':''}>${p}</option>`).join('')}
    </select>
    <select id="tfcomp" onchange="renderTasks(undefined,undefined,undefined,undefined,undefined,this.value)">
      <option value="">All Companies</option>
      ${DATA_COMPANIES.map(c=>`<option value="${c.id}"${fcomp===c.id?' selected':''}>${c.name}</option>`).join('')}
    </select>
    <select id="tfr" onchange="renderTasks(undefined,undefined,this.value)">
      <option value="">All Owners</option>
      ${(window.OWNERS||[]).map(o=>`<option${fr===o?' selected':''}>${o}</option>`).join('')}
    </select>
    <span class="cnt">${filtered.length}/${DATA_TASKS.length}</span>
  </div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>ID</th><th>Company</th><th>Task Name</th><th>Type</th><th>Priority</th><th>Linked Opportunity</th><th>Linked Contact</th><th>Due Date</th><th>Status</th><th>Responsible</th><th>Notes</th></tr></thead>
    <tbody>${filtered.map(r => {
      const isOverdue = r.status === 'Open' && r.dueDate && r.dueDate < today;
      const safeId    = (r.id || '').replace(/'/g, '__SQ__');
      const dueCls    = isOverdue ? 'color:var(--red);font-weight:600' : 'color:var(--slate)';
      return `<tr class="edit-row" onclick="openTaskDrawer('${safeId}')">
        <td style="font-size:.7rem;color:var(--slate2)">${r.id || '—'}</td>
        <td style="font-size:.73rem" onclick="event.stopPropagation()">${(()=>{
          const co = r.linkedCompany ? (DATA_COMPANIES||[]).find(c=>c.id===r.linkedCompany||c.name===r.linkedCompany) : null;
          const nm = co ? co.name : r.linkedCompany;
          const safeNm = (nm||'').replace(/'/g,'__SQ__');
          return nm ? `<div style="display:flex;align-items:center;gap:5px">${companyLogo(co?.website||'',nm,18)}<span class="contact-link" onclick="event.stopPropagation();openCompanyFromName('${safeNm}')" style="font-size:.75rem">${nm}</span></div>`
 : '—';
        })()}</td>
        <td style="font-size:.82rem;font-weight:600;color:var(--navy2)">${r.taskName || '—'}</td>
        <td style="font-size:.78rem;font-weight:500">${taskTypeIcon(r.type)} ${r.type || '—'}</td>
        <td onclick="event.stopPropagation()">${buildTaskPrioDrop(r)}</td>
        <td style="font-size:.73rem" onclick="event.stopPropagation()">${r.linkedOpp ? `<span class="contact-link" onclick="openOppFromTask('${r.linkedOpp.replace(/'/g,'__SQ__')}')">${r.linkedOpp}</span>` : '—'}</td>
        <td style="font-size:.73rem" onclick="event.stopPropagation()">${r.linkedContact ? `<span class="contact-link" onclick="openContactFromTask('${r.linkedContact.replace(/'/g,'__SQ__')}')">${r.linkedContact}</span>` : '—'}</td>
        <td style="font-size:.75rem;${dueCls}">${r.dueDate ? fmtDate(r.dueDate) : '—'}${isOverdue ? ' ⚠' : ''}</td>
        <td onclick="event.stopPropagation()">${buildTaskStatusDrop(r)}</td>
        <td onclick="event.stopPropagation()" style="font-size:.75rem">${r.responsible ? `<span class="contact-link" onclick="UI.nf('',null,'${r.responsible.replace(/'/g,'__SQ__')}')">${r.responsible}</span>` : '—'}</td>
        <td style="font-size:.72rem;color:var(--slate2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes || '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
  _restoreFocus(_foc);
}

// ── Task Form (shared by edit + new) ─────────────────────────
function buildTaskForm(row, preOpp, preCont, preCo) {
  const oppOptions = [...DATA_PIPE].sort((a,b)=>(a.c||'').localeCompare(b.c||'')||(a.p||'').localeCompare(b.p||'')).map(r => {
    const label = r.c + (r.p ? ' · ' + r.p : '');
    const sel   = row ? row.linkedOpp === label : (preOpp && preOpp === label);
    return `<option value="${esc(label)}"${sel ? ' selected' : ''}>${label}</option>`;
  }).join('');

  const contOptions = [...DATA_CONTACTS].sort((a,b)=>(a.lastName||'').localeCompare(b.lastName||'')||(a.firstName||'').localeCompare(b.firstName||'')).map(r => {
    const stored = ((r.firstName || '') + ' ' + (r.lastName || '')).trim();
    const name   = contactDisplayName(r);
    const sel    = row ? row.linkedContact === stored : (preCont && preCont === stored);
    return `<option value="${esc(stored)}"${sel ? ' selected' : ''}>${name}</option>`;
  }).join('');

  const typeOpts = TASK_TYPES.map(t  => `<option${row?.type     === t                    ? ' selected' : ''}>${t}</option>`).join('');
  const prioOpts = PRIORITIES.map(p  => `<option${(row?.priority || 'Medium') === p      ? ' selected' : ''}>${p}</option>`).join('');
  const statOpts = TASK_STATUSES.map(s => `<option${(row?.status  || 'Open')   === s      ? ' selected' : ''}>${s}</option>`).join('');

  return `
    <div class="field-group"><label>Task Name</label>
      <input id="dt-taskname" placeholder="Short task label…" value="${esc(row?.taskName||'')}">
    </div>
    <div class="field-row">
      <div class="field-group"><label>Task Type</label><select id="dt-type">${typeOpts}</select></div>
      <div class="field-group"><label>Priority</label>${buildDrawerPrioDrop('dt-prio', row?.priority||'Medium')}</div>
    </div>
    <div class="field-row">
      ${(()=>{
        if (row?.outlookEventId) {
          return `
      <div class="field-group"><label>Status <span style="font-size:.65rem;color:var(--blue)">⇄ Outlook</span></label>
        <div style="display:flex;align-items:center;gap:7px;padding:7px 10px;background:var(--blue-t);border:1px solid var(--blue-l);border-radius:7px;font-size:.82rem">
          ${taskStatusDot(row.status||'Open')}<span>${row.status||'Open'}</span>
        </div>
      </div>
      <div class="field-group"><label>Due Date <span style="font-size:.65rem;color:var(--blue)">⇄ Outlook</span></label>
        <div style="padding:7px 10px;background:var(--blue-t);border:1px solid var(--blue-l);border-radius:7px;font-size:.82rem">
          ${row.dueDate ? fmtDate(row.dueDate) : '— not set —'}
        </div>
      </div>`;
        }
        return `
      <div class="field-group"><label>Status</label>${buildDrawerTaskStatusDrop('dt-status', row?.status||'Open')}</div>
      <div class="field-group"><label>Due Date</label><input id="dt-due" type="date" value="${row?.dueDate || ''}"></div>`;
      })()}
    </div>
    <div class="field-group"><label>Responsible</label>
      ${row?.outlookEventId
        ? `<div style="padding:7px 10px;background:var(--blue-t);border:1px solid var(--blue-l);border-radius:7px;font-size:.82rem;display:flex;align-items:center;justify-content:space-between">
            <span>${esc(row.responsible||'—')}</span>
            <span style="font-size:.65rem;color:var(--blue)">⇄ Outlook</span>
           </div>`
        : `<select id="dt-resp">
            ${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();const cur=row?.responsible||window.CURRENT_USER_NAME||'';return `<option value="${n}"${cur===n?' selected':''}>${n}</option>`;}).join('')}
           </select>`}
    </div>
    <div class="field-group"><label>Linked Opportunity</label>
      <select id="dt-opp" onchange="(()=>{const v=this.value;if(!v)return;const [cl]=v.split(' · ');const co=(DATA_COMPANIES||[]).find(c=>c.name===cl);const dc=$('dt-comp');if(dc&&co&&!dc.value){dc.value=co.name;}})()"><option value="">— None —</option>${oppOptions}</select>
    </div>
    <div class="field-group"><label>Linked Contact</label>
      <select id="dt-cont"><option value="">— None —</option>${contOptions}</select>
    </div>
    <div class="field-group"><label>Linked Company</label>
      <select id="dt-comp">
        <option value="">— None —</option>
        ${[...(DATA_COMPANIES||[])].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(co => {const selVal=row?.linkedCompany||preCo||'';const sel=selVal&&(selVal===co.id||selVal===co.name);return `<option value="${esc(co.name)}"${sel?' selected':''}>${co.name}</option>`;}).join('')}
      </select>
    </div>
    <div class="field-group"><label>Notes</label><textarea id="dt-notes">${esc(row?.notes || '')}</textarea></div>

    <!-- Outlook Task integration -->
    <div style="margin:8px 0;padding:10px 12px;background:var(--blue-t);border:1px solid var(--blue-l);border-radius:8px">
      ${row?.outlookEventId ? `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span style="font-size:.78rem;color:var(--blue)">📅 Synced with Outlook To-Do</span>
          ${(!row.responsible || row.responsible === (window.CURRENT_USER_NAME||''))
            ? `<button onclick="syncTaskFromOutlook('${(row.id||'').replace(/'/g,'__SQ__')}')" style="padding:4px 12px;border-radius:6px;border:1px solid var(--blue-l);background:#fff;color:var(--blue);cursor:pointer;font-size:.75rem;font-weight:600">↻ Sync from Outlook</button>`
            : `<span style="font-size:.72rem;color:var(--slate2)" title="Only the task owner can sync">↻ Sync (owner only)</span>`
          }
        </div>` : `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="dt-cal" style="width:15px;height:15px;accent-color:var(--blue)" ${!row ? 'checked' : ''}>
          <span style="font-size:.78rem;color:var(--blue)">📅 ${row ? 'Add to Outlook Tasks' : 'Add to Outlook Tasks (no time blocked)'}</span>
        </label>`}
    </div>

    ${row ? `<div style="font-size:.7rem;color:var(--slate);margin-top:4px">${row.id} · Created ${row.createdDate || '—'}</div>
    ${renderMsgPanel(row.id)}` : ''}`;
}

// ── Sync task status + due date from Outlook To-Do ───────────────
async function syncTaskFromOutlook(safeId) {
  const id  = safeId.replace(/__SQ__/g,"'");
  const row = DATA_TASKS.find(r => r.id === id);
  if (!row || !row.outlookEventId) return;
  toast('↻ Syncing from Outlook…', 'info');
  try {
    const outlook = await P.getOutlookTask(row.outlookEventId);
    if (!outlook) { toast('⚠ Could not reach Outlook task', 'error'); return; }
    const changed = outlook.status !== row.status || (outlook.dueDate && outlook.dueDate !== row.dueDate);
    if (!changed) { toast('✓ Already up to date', 'success'); return; }
    // Write back to Excel
    const today = new Date().toISOString().slice(0,10);
    const patches = [];
    if (outlook.status !== row.status)
      patches.push(P.patchRange(activeCfg.sheets.tasks, `G${row._row}`, [[outlook.status]]));
    if (outlook.dueDate && outlook.dueDate !== row.dueDate)
      patches.push(P.patchRange(activeCfg.sheets.tasks, `H${row._row}`, [[outlook.dueDate]]));
    patches.push(P.patchRange(activeCfg.sheets.tasks, `I${row._row}`, [[today]])); // updDate
    await Promise.all(patches);
    // Update in-memory
    if (outlook.status)  row.status  = outlook.status;
    if (outlook.dueDate) row.dueDate = outlook.dueDate;
    row.updDate = today;
    toast(`✓ Synced: ${outlook.status}${outlook.dueDate?' · '+fmtDate(outlook.dueDate):''}`, 'success');
    // Refresh drawer and list
    renderTasks();
    openTaskDrawer(id.replace(/'/g,'__SQ__'));
  } catch(e) { toast('Sync error: '+e.message, 'error'); }
}

// ── Edit existing task ────────────────────────────────────────
function openTaskDrawer(safeId) {
  const id  = safeId.replace(/__SQ__/g, "'");
  const row = DATA_TASKS.find(r => r.id === id);
  if (!row) return;
  drawerKey = id;
  const foot = `
    <button class="sbtn sbtn-p" onclick="saveTaskDrawer()" style="flex:1">✓ Save Task</button>
    <button class="sbtn" style="background:#fff5f5;color:var(--red);border:1px solid var(--red-l)" onclick="archiveTaskCheck('${esc(row.id)}')">⊘ Archive</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;
  openDrawer(row.taskName || row.type || row.id, buildTaskForm(row), foot, 'task', id, row.id + (row.type ? ' · ' + row.type : ''));
}

async function saveTaskDrawer() {
  const id  = drawerKey;
  const row = DATA_TASKS.find(r => r.id === id);
  if (!row) return;
  toast('Saving…', 'info');
  // Outlook-linked tasks: status + dueDate are read-only (synced via Sync button)
  const isOutlookLinked = !!row.outlookEventId;
  const newDueDate = isOutlookLinked ? (row.dueDate || '') : ($('dt-due')?.value || '');
  const fields = {
    taskName:      $('dt-taskname') ? $('dt-taskname').value.trim() : '',
    type:          $('dt-type').value,
    priority:      $('dt-prio').value,
    status:        isOutlookLinked ? row.status : ($('dt-status')?.value || row.status),
    dueDate:       newDueDate,
    responsible:   isOutlookLinked ? (row.responsible||'') : ($('dt-resp')?.value?.trim()||''),
    linkedOpp:     $('dt-opp').value,
    linkedContact: $('dt-cont').value,
    linkedCompany: $('dt-comp') ? $('dt-comp').value : '',
    notes:         $('dt-notes').value.trim(),
    outlookEventId: row.outlookEventId || '',
  };
  // Outlook: only create new if not linked and checkbox ticked
  if (!isOutlookLinked && newDueDate && $('dt-cal') && $('dt-cal').checked) {
    const evId = await P.createCalendarEvent(fields);
    if (evId) { fields.outlookEventId = evId; toast('📅 Added to Outlook Tasks / To-Do', 'info'); }
  }
  try {
    const ok = await P.saveTaskRow(row, fields);
    if (ok) { Object.assign(row, fields); renderTasks('', '', '', '', '', ''); toast('✓ Saved', 'success'); closeDrawer(); }
    else toast('⚠ Save failed', 'error');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ── New task (optionally pre-filled from opp or contact) ──────
// ── Archive Task ─────────────────────────────────────────────
async function archiveTaskCheck(safeId) {
  const id  = safeId.replace(/__SQ__/g,"'");
  const row = DATA_TASKS.find(r => r.id === id);
  if (!row) return;
  const label = row.taskName || row.type || row.id;
  if (!confirm(`Archive "${label}"?\nIt will be hidden from all views but kept in Excel.`)) return;
  try {
    const ok = await P.archiveTask(row);
    if (ok) {
      toast('✓ Task archived','success');
      closeDrawer();
      const j = await P.loadSheet(activeCfg.sheets.tasks);
      DATA_TASKS = P.parseTasks(j);
      updateCounts();
      renderTasks();
    } else toast('⚠ Save failed','error');
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function openNewTask(context, linkedOpp, linkedContact, linkedCompany) {
  closeDrawer();
  drawerKey = null;
  const preOpp   = (linkedOpp       || '').replace(/__SQ__/g, "'");
  const preCont  = (linkedContact   || '').replace(/__SQ__/g, "'");
  const preCo    = (linkedCompany   || '').replace(/__SQ__/g, "'");
  const foot = `
    <button class="sbtn sbtn-p" onclick="createTaskDrawer()" style="flex:1">+ Create Task</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;
  openDrawer('New Task', buildTaskForm(null, preOpp, preCont, preCo), foot, 'new-task', null);
}

async function createTaskDrawer() {
  toast('Creating…', 'info');
  const fields = {
    taskName: ($('dt-taskname') ? $('dt-taskname').value.trim() : ''),
    type: $('dt-type').value, priority: $('dt-prio').value, status: 'Open',
    dueDate: $('dt-due').value, responsible: $('dt-resp').value.trim(),
    linkedOpp: $('dt-opp').value, linkedContact: $('dt-cont').value,
    linkedCompany: $('dt-comp') ? $('dt-comp').value : '',
    notes: $('dt-notes').value.trim(),
  };
  try {
    // Create Outlook To-Do task if checkbox ticked and due date set
    if ($('dt-cal') && $('dt-cal').checked && fields.dueDate) {
      const evId = await P.createCalendarEvent(fields);
      if (evId) { fields.outlookEventId = evId; toast('📅 Added to Outlook Tasks / To-Do', 'info'); }
    }
    await P.createTask(fields);
    const j = await P.loadSheet(activeCfg.sheets.tasks);
    DATA_TASKS = P.parseTasks(j);
    updateCounts(); renderTasks('', '', '', '', '', '');
    toast('✓ Task created', 'success'); closeDrawer();
    UI.nav('tasks', null);
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}
