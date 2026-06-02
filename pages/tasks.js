'use strict';

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
  q='';fs=fs||'';fr=fr||'';ftype=ftype||'';fprio=fprio||'';fcomp=fcomp||'';

  const today = new Date().toISOString().slice(0, 10);
  const TPO = {'Critical':0,'High':1,'Medium':2,'Low':3};
  const filtered = DATA_TASKS.filter(r => {
    const overdue  = r.status === 'Open' && r.dueDate && r.dueDate < today;
    const fsMatch  = !fs || (fs === 'Overdue' ? overdue : r.status === fs);
    return (!q     || (r.type + r.linkedOpp + r.linkedContact + r.notes).toLowerCase().includes(q.toLowerCase())) &&
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

  $('tasks-out').innerHTML = `
  <div class="kpi-row">
    <div class="kpi k-tot"><div class="lbl">Total</div><div class="val">${DATA_TASKS.length}</div><div class="sub">All tasks</div></div>
    <div class="kpi k-pip"  onclick="renderTasks('','Open','')"><div class="lbl">Open</div><div class="val">${open}</div><div class="sub">Active</div></div>
    <div class="kpi k-done" onclick="renderTasks('','Done','')"><div class="lbl">Done</div><div class="val">${done}</div><div class="sub">Completed</div></div>
    <div class="kpi k-can"  onclick="renderTasks('','Cancelled','')"><div class="lbl">Cancelled</div><div class="val">${cancelled}</div><div class="sub">Dropped</div></div>
    <div class="kpi k-over" onclick="renderTasks('','Overdue','')"><div class="lbl">Overdue</div><div class="val">${overdue}</div><div class="sub">Past due date</div></div>
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
    <thead><tr><th>ID</th><th>Task Name</th><th>Type</th><th>Priority</th><th>Linked Opportunity</th><th>Linked Contact</th><th>Linked Company</th><th>Due Date</th><th>Status</th><th>Responsible</th><th>Notes</th></tr></thead>
    <tbody>${filtered.map(r => {
      const isOverdue = r.status === 'Open' && r.dueDate && r.dueDate < today;
      const safeId    = (r.id || '').replace(/'/g, '__SQ__');
      const dueCls    = isOverdue ? 'color:var(--red);font-weight:600' : 'color:var(--slate)';
      return `<tr class="edit-row" onclick="openTaskDrawer('${safeId}')">
        <td style="font-size:.7rem;color:var(--slate2)">${r.id || '—'}</td>
        <td style="font-size:.82rem;font-weight:600;color:var(--navy2)">${r.taskName || '—'}</td>
        <td style="font-size:.78rem;font-weight:500">${r.type || '—'}</td>
        <td onclick="event.stopPropagation()">${buildTaskPrioDrop(r)}</td>
        <td style="font-size:.73rem"><span class="contact-link" onclick="event.stopPropagation();openOppFromTask('${(r.linkedOpp || '').replace(/'/g, '__SQ__')}')">${r.linkedOpp || '—'}</span></td>
        <td style="font-size:.73rem"><span class="contact-link" onclick="event.stopPropagation();openContactFromTask('${(r.linkedContact || '').replace(/'/g, '__SQ__')}')">${r.linkedContact || '—'}</span></td>
        <td style="font-size:.73rem">${(()=>{
          const co = r.linkedCompany ? (DATA_COMPANIES||[]).find(c=>c.id===r.linkedCompany||c.name===r.linkedCompany) : null;
          const nm = co ? co.name : r.linkedCompany;
          const safeNm = (nm||'').replace(/'/g,'__SQ__');
          return nm ? `<div style="display:flex;align-items:center;gap:5px">${companyLogo(co?.website||'',nm,18)}<span class="contact-link" onclick="event.stopPropagation();openCompanyFromName('${safeNm}')" style="font-size:.75rem">${nm}</span></div>` : '—';
        })()}</td>
        <td style="font-size:.75rem;${dueCls}">${r.dueDate || '—'}${isOverdue ? ' ⚠' : ''}</td>
        <td>${taskStatusBadge(r.status)}</td>
        <td onclick="event.stopPropagation()" style="font-size:.75rem">${r.responsible ? `<span class="contact-link" onclick="UI.nf('',null,'${r.responsible.replace(/'/g,'__SQ__')}')">${r.responsible}</span>` : '—'}</td>
        <td style="font-size:.72rem;color:var(--slate2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes || '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ── Task Form (shared by edit + new) ─────────────────────────
function buildTaskForm(row, preOpp, preCont, preCo) {
  const oppOptions = DATA_PIPE.map(r => {
    const label = r.c + (r.p ? ' · ' + r.p : '');
    const sel   = row ? row.linkedOpp === label : (preOpp && preOpp === label);
    return `<option value="${esc(label)}"${sel ? ' selected' : ''}>${label}</option>`;
  }).join('');

  const contOptions = DATA_CONTACTS.map(r => {
    const name = ((r.firstName || '') + ' ' + (r.lastName || '')).trim();
    const sel  = row ? row.linkedContact === name : (preCont && preCont === name);
    return `<option value="${esc(name)}"${sel ? ' selected' : ''}>${name}</option>`;
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
      <div class="field-group"><label>Priority</label><select id="dt-prio">${prioOpts}</select></div>
    </div>
    <div class="field-row">
      <div class="field-group"><label>Status</label><select id="dt-status">${statOpts}</select></div>
      <div class="field-group"><label>Due Date</label><input id="dt-due" type="date" value="${row?.dueDate || ''}"></div>
    </div>
    <div class="field-group"><label>Responsible</label>
      <select id="dt-resp">
        ${(DATA_OWNERS||[]).map(o=>{const n=o.displayName||((o.firstName||'')+' '+(o.lastName||'')).trim();const cur=row?.responsible||window.CURRENT_USER_NAME||'';return `<option value="${n}"${cur===n?' selected':''}>${n}</option>`;}).join('')}
      </select>
    </div>
    <div class="field-group"><label>Linked Opportunity</label>
      <select id="dt-opp"><option value="">— None —</option>${oppOptions}</select>
    </div>
    <div class="field-group"><label>Linked Contact</label>
      <select id="dt-cont"><option value="">— None —</option>${contOptions}</select>
    </div>
    <div class="field-group"><label>Linked Company</label>
      <select id="dt-comp">
        <option value="">— None —</option>
        ${(DATA_COMPANIES||[]).map(co => {const selVal=row?.linkedCompany||preCo||'';const sel=selVal&&(selVal===co.id||selVal===co.name);return `<option value="${esc(co.id)}"${sel?' selected':''}>${co.name}</option>`;}).join('')}
      </select>
    </div>
    <div class="field-group"><label>Notes</label><textarea id="dt-notes">${esc(row?.notes || '')}</textarea></div>
    ${row ? `<div style="font-size:.7rem;color:var(--slate);margin-top:4px">${row.id} · Created ${row.createdDate || '—'}</div>` : ''}`;
}

// ── Edit existing task ────────────────────────────────────────
function openTaskDrawer(safeId) {
  const id  = safeId.replace(/__SQ__/g, "'");
  const row = DATA_TASKS.find(r => r.id === id);
  if (!row) return;
  drawerKey = id;
  const foot = `
    <button class="sbtn sbtn-p" onclick="saveTaskDrawer()" style="flex:1">✓ Save Task</button>
    <button class="sbtn sbtn-d" onclick="closeDrawer()">Cancel</button>`;
  openDrawer(row.id + ' · ' + row.type, buildTaskForm(row), foot, 'task', id);
}

async function saveTaskDrawer() {
  const id  = drawerKey;
  const row = DATA_TASKS.find(r => r.id === id);
  if (!row) return;
  toast('Saving…', 'info');
  const fields = {
    taskName: ($('dt-taskname') ? $('dt-taskname').value.trim() : ''),
    type: $('dt-type').value, priority: $('dt-prio').value, status: $('dt-status').value,
    dueDate: $('dt-due').value, responsible: $('dt-resp').value.trim(),
    linkedOpp: $('dt-opp').value, linkedContact: $('dt-cont').value,
    linkedCompany: $('dt-comp') ? $('dt-comp').value : '',
    notes: $('dt-notes').value.trim(),
  };
  try {
    const ok = await P.saveTaskRow(row, fields);
    if (ok) { Object.assign(row, fields); renderTasks('', '', '', '', '', ''); toast('✓ Saved', 'success'); closeDrawer(); }
    else toast('⚠ Save failed', 'error');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ── New task (optionally pre-filled from opp or contact) ──────
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
    await P.createTask(fields);
    const j = await P.loadSheet(activeCfg.sheets.tasks);
    DATA_TASKS = P.parseTasks(j);
    updateCounts(); renderTasks('', '', '', '', '', '');
    toast('✓ Task created', 'success'); closeDrawer();
    UI.nav('tasks', null);
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}
