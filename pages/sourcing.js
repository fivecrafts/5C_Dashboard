// 5C Dashboard v1.37.2 · 2026-06-19 · sourcing-persist · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// SOURCING PAGE — AI-powered candidate matching for BD opportunities
// ════════════════════════════════════════════════════════════════

function scoreBg(score) {
  if (score >= 8) return 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7';
  if (score >= 6) return 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd';
  if (score >= 4) return 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d';
  return 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0';
}

function starBar(score) {
  const filled = Math.round(score);
  const stars = Array.from({length:10}, (_,i) =>
    `<span style="color:${i<filled?'#f59e0b':'#e2e8f0'};font-size:.7rem">★</span>`
  ).join('');
  return `<span style="display:inline-flex;gap:1px">${stars}</span>`;
}

function candidateStatusBadge(status) {
  const s = (status||'').toLowerCase();
  if (['placed','contracted','engaged'].includes(s))
    return `<span class="sb2 s-running">${status}</span>`;
  if (['proposed','hr screen','5c interview'].includes(s))
    return `<span class="sb2 s-pipeline">${status}</span>`;
  if (['not interested','rejected','blacklisted'].includes(s))
    return `<span class="sb2 s-cancelled">${status}</span>`;
  if (['on hold'].includes(s))
    return `<span class="sb2 s-prospect">${status}</span>`;
  return `<span class="sb2 s-prospect">${status||'Sourced'}</span>`;
}

// ── Load persisted runs from Excel on login ─────────────────────
async function loadSourcingRuns() {
  try {
    const json = await P.loadSourcingLog();
    const runs = P.parseSourcingLog(json);
    if (runs.length) {
      // Merge with session runs — Excel history first, session runs on top
      const sessionIds = new Set((DATA_SOURCING_RUNS||[]).map(r=>r.id));
      runs.forEach(r => { if (!sessionIds.has(r.id)) DATA_SOURCING_RUNS.push(r); });
    }
    if ($('sourcing-out')?.closest('.page.active')) renderSourcing();
  } catch(e) {
    console.warn('Sourcing log load failed:', e.message);
  }
}

function renderSourcing() {
  const el = $('sourcing-out');
  if (!el) return;
  const runs = DATA_SOURCING_RUNS || [];
  const oppCount = DATA_PIPE.filter(r => !['Cancelled','Done'].includes(r.s)).length;
  const hrCount  = (DATA_HR||[]).length + (DATA_POOL||[]).length;

  el.innerHTML = `
  <div style="max-width:1100px">
    <div class="stats-row">
      <div class="stat-card s-blue"><div class="sc-icon">🎯</div><div class="sc-val">${oppCount}</div><div class="sc-lbl">Active Opps</div></div>
      <div class="stat-card s-green"><div class="sc-icon">👥</div><div class="sc-val">${hrCount}</div><div class="sc-lbl">Candidate Pool</div></div>
      <div class="stat-card s-purple"><div class="sc-icon">🔍</div><div class="sc-val">${runs.length}</div><div class="sc-lbl">Sourcing Runs</div></div>
      <div class="stat-card s-amber"><div class="sc-icon">⭐</div><div class="sc-val">${runs.reduce((a,r)=>a+(r.results?.length||0),0)}</div><div class="sc-lbl">Total Matches</div></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:.82rem;font-weight:600;color:var(--navy2);text-transform:uppercase;letter-spacing:.5px">Sourcing Runs</div>
      <button class="btn-primary" onclick="openSourcingModal(null)" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border:none;border-radius:7px;background:var(--blue);color:#fff;cursor:pointer;font-size:.8rem;font-weight:600">
        🔍 New Sourcing Run
      </button>
    </div>
    ${runs.length === 0 ? `
      <div class="empty-state">
        <div class="es-icon">🔍</div>
        <div class="es-msg">No sourcing runs yet. Click "New Sourcing Run" or use the 🔍 button on any opportunity.</div>
      </div>
    ` : runs.slice().reverse().map(run => _renderRunCard(run)).join('')}
  </div>`;
}

function _renderRunCard(run) {
  const res = run.results || [];
  const top3 = res.slice(0,3);
  const more = res.length - 3;
  return `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:14px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
      <div>
        <div style="font-weight:700;color:var(--navy2);font-size:.9rem">${esc(run.oppLabel||'Unnamed')}</div>
        <div style="font-size:.75rem;color:var(--slate);margin-top:2px">${run.runDate} · ${res.length} candidates · Top: ${top3[0]?.score||'—'}/10</div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="openSourcingRunDetail('${esc(run.id)}')" style="padding:5px 10px;background:var(--card);border:1px solid var(--border);border-radius:7px;cursor:pointer;font-size:.75rem">View All</button>
        <button onclick="openSourcingModal('${esc(run.oppKey||'')}')" style="padding:5px 10px;background:var(--card);border:1px solid var(--border);border-radius:7px;cursor:pointer;font-size:.75rem">↻ Re-run</button>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
      ${(run.competencies||[]).map(c=>`<span style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:12px;padding:2px 8px;font-size:.7rem">${esc(c)}</span>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${top3.map(r=>_candidateMiniCard(r)).join('')}
      ${more>0?`<div style="display:flex;align-items:center;justify-content:center;background:var(--bg);border-radius:8px;border:1px dashed var(--border);font-size:.78rem;color:var(--slate);cursor:pointer;padding:12px" onclick="openSourcingRunDetail('${esc(run.id)}')">+${more} more →</div>`:''}
    </div>
    ${run.jd?`<details style="margin-top:12px"><summary style="font-size:.73rem;color:var(--slate);cursor:pointer">Show JD / context used</summary><pre style="font-size:.72rem;white-space:pre-wrap;color:var(--slate);margin-top:6px;background:var(--bg);padding:8px;border-radius:6px">${esc(run.jd)}</pre></details>`:''}
  </div>`;
}

function _candidateMiniCard(r) {
  const sc = r.score||0;
  return `
  <div style="background:var(--bg);border-radius:8px;border:1px solid var(--border);padding:10px 12px;cursor:pointer" onclick="openCandidateFromSourcing('${esc(r.candidateId||'')}','${esc(r.source||'')}')">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:4px;margin-bottom:4px">
      <div style="font-weight:600;font-size:.82rem;color:var(--navy2)">${esc(r.displayName||r.name||'—')}</div>
      <span style="${scoreBg(sc)};border-radius:20px;padding:1px 7px;font-size:.72rem;font-weight:700;flex-shrink:0">${sc}/10</span>
    </div>
    <div style="font-size:.73rem;color:var(--slate);margin-bottom:4px">${esc(r.role||'—')} · ${esc(r.seniority||'—')}</div>
    ${starBar(sc)}
    <div style="font-size:.7rem;color:var(--slate);margin-top:5px;line-height:1.3">${esc((r.reason||'').slice(0,120))}${(r.reason||'').length>120?'…':''}</div>
    <div style="margin-top:4px">${candidateStatusBadge(r.status)}</div>
  </div>`;
}

function openSourcingRunDetail(runId) {
  const run = (DATA_SOURCING_RUNS||[]).find(r=>r.id===runId);
  if (!run) return;
  const res = [...(run.results||[])].sort((a,b)=>(b.score||0)-(a.score||0));
  const overlay = document.createElement('div');
  overlay.id = 'src-detail-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:40px 24px;overflow-y:auto';
  overlay.innerHTML = `
  <div style="background:var(--card);border-radius:14px;width:100%;max-width:860px;box-shadow:0 20px 60px rgba(0,0,0,.3);margin:auto">
    <div class="drawer-head">
      <div>
        <div style="font-weight:700;font-size:.95rem">${esc(run.oppLabel||'Sourcing Run')}</div>
        <div style="font-size:.75rem;color:var(--slate)">${run.runDate} · ${res.length} candidates</div>
      </div>
      <button onclick="document.getElementById('src-detail-overlay').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--slate)">✕</button>
    </div>
    <div style="padding:16px 20px">
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
        ${(run.competencies||[]).map(c=>`<span style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:12px;padding:2px 8px;font-size:.7rem">${esc(c)}</span>`).join('')}
      </div>
      <div class="tbl-wrap"><table class="ds-table">
        <thead><tr><th>Candidate</th><th>Role</th><th>Status</th><th>Score</th><th>Stars</th><th>Match Reason</th><th>Source</th></tr></thead>
        <tbody>
          ${res.map(r=>`<tr style="cursor:pointer" onclick="openCandidateFromSourcing('${esc(r.candidateId||'')}','${esc(r.source||'')}')">
            <td style="font-weight:600">${esc(r.displayName||r.name||'—')}</td>
            <td style="font-size:.78rem">${esc(r.role||'—')}</td>
            <td>${candidateStatusBadge(r.status)}</td>
            <td><span style="${scoreBg(r.score||0)};border-radius:20px;padding:2px 10px;font-size:.78rem;font-weight:700">${r.score||0}/10</span></td>
            <td>${starBar(r.score||0)}</td>
            <td style="font-size:.75rem;color:var(--slate);max-width:260px">${esc(r.reason||'')}</td>
            <td style="font-size:.72rem">${esc(r.source||'HR')}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

function openSourcingFromOpp(safeKey) {
  openSourcingModal(safeKey.replace(/__SQ__/g,"'"));
}

function openCandidateFromSourcing(candidateId, source) {
  document.getElementById('src-detail-overlay')?.remove();
  document.getElementById('src-modal')?.remove();
  if (source === 'pool') {
    const c = (DATA_POOL||[]).find(r=>r.id===candidateId);
    if (c) { UI.nav('hr',null); setTimeout(()=>openHRDrawer(c),150); }
  } else {
    const c = (DATA_HR||[]).find(r=>r.id===candidateId);
    if (c) { UI.nav('hr',null); setTimeout(()=>openHRDrawer(c),150); }
  }
}

function openSourcingModal(oppKey) {
  let opp = null;
  if (oppKey) {
    const [c,p] = oppKey.split('|||');
    opp = DATA_PIPE.find(r=>r.c===c && r.p===(p||''));
  }
  const activeOpps = DATA_PIPE
    .filter(r=>!['Cancelled'].includes(r.s))
    .sort((a,b)=>(a.c||'').localeCompare(b.c||''));

  const overlay = document.createElement('div');
  overlay.id = 'src-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
  <div style="background:var(--card);border-radius:14px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.35)">
    <div class="drawer-head">
      <div style="font-weight:700;font-size:.95rem;color:var(--navy2)">🔍 New Sourcing Run</div>
      <button onclick="document.getElementById('src-modal').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--slate)">✕</button>
    </div>
    <div style="padding:20px 22px;display:flex;flex-direction:column;gap:14px">
      <div class="field-group">
        <label>Opportunity <span style="color:var(--red)">*</span></label>
        <select id="src-opp-sel" onchange="_srcOppSelected(this.value)">
          <option value="">— Select opportunity —</option>
          ${activeOpps.map(r=>{
            const k=`${r.c}|||${r.p||''}`;
            const sel=(opp&&r.c===opp.c&&r.p===opp.p)?'selected':'';
            return `<option value="${esc(k)}" ${sel}>${esc(r.c+(r.p?' · '+r.p:''))} [${r.s}]</option>`;
          }).join('')}
        </select>
      </div>
      <div id="src-context-panel" style="${opp?'':'display:none'}">
        <div style="background:#f8fafc;padding:12px 14px;border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:.73rem;font-weight:600;color:var(--slate);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Opportunity Context</div>
          <div id="src-context-body" style="font-size:.78rem;color:var(--navy2)">${opp?_srcContextHtml(opp):''}</div>
        </div>
      </div>
      <div class="field-group">
        <label>Required Competencies <span style="font-size:.72rem;color:var(--slate)">(auto-suggested, adjust as needed)</span></label>
        <div id="src-comp-chips" style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;border:1px solid var(--border);border-radius:8px;min-height:44px;background:#fff"></div>
        <select id="src-comp-add" onchange="_srcAddComp(this)" style="font-size:.78rem;padding:5px 8px;margin-top:6px;border:1px solid var(--border);border-radius:7px;background:var(--card)">
          <option value="">+ Add competency…</option>
          ${(HR_COMPETENCIES||[]).map(c=>`<option value="${esc(c)}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Job Description / Additional Context <span style="font-size:.72rem;color:var(--slate)">(optional)</span></label>
        <textarea id="src-jd" rows="4" placeholder="Paste JD, requirements, allocation %, mode…" style="font-size:.82rem;resize:vertical"></textarea>
      </div>
      <div class="field-group">
        <label>Search In</label>
        <div style="display:flex;border:1px solid var(--border);border-radius:7px;overflow:hidden;width:fit-content">
          <button id="src-pool-hr"   onclick="_srcTogglePool('hr')"   style="padding:6px 12px;font-size:.78rem;font-weight:600;border:none;cursor:pointer;background:var(--navy);color:#fff">HR Candidates</button>
          <button id="src-pool-pool" onclick="_srcTogglePool('pool')" style="padding:6px 12px;font-size:.78rem;font-weight:600;border:none;cursor:pointer;background:var(--card);color:var(--slate)">Search Pool</button>
          <button id="src-pool-both" onclick="_srcTogglePool('both')" style="padding:6px 12px;font-size:.78rem;font-weight:600;border:none;cursor:pointer;background:var(--card);color:var(--slate)">Both</button>
        </div>
      </div>
      <div class="field-group">
        <label>Minimum Match Score: <b id="src-min-score-lbl">5</b>/10</label>
        <input type="range" id="src-min-score" min="1" max="9" value="5" step="1"
          oninput="$('src-min-score-lbl').textContent=this.value" style="width:100%;accent-color:var(--blue)">
      </div>
    </div>
    <div id="src-results-wrap" style="display:none;padding:0 22px 16px"></div>
    <div class="drawer-foot" style="padding:12px 20px">
      <button id="src-run-btn" onclick="_srcRun()" style="flex:1;padding:8px 16px;background:var(--blue);color:#fff;border:none;border-radius:7px;font-size:.82rem;font-weight:600;cursor:pointer">▶ Run Sourcing</button>
      <button onclick="document.getElementById('src-modal').remove()" style="padding:8px 14px;background:var(--card);color:var(--slate);border:1px solid var(--border);border-radius:7px;font-size:.82rem;cursor:pointer">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  if (opp) _srcAutoCompetencies(opp);
}

function _srcAutoCompetencies(opp) {
  if (!opp) return;
  const text = ((opp.d||'')+(opp.c||'')+(opp.p||'')).toLowerCase();
  const matched = (HR_COMPETENCIES||[]).filter(c => text.includes(c.toLowerCase())).slice(0,8);
  const wrap = $('src-comp-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  matched.forEach(c => _srcAddCompByName(c));
}

function _srcOppSelected(val) {
  if (!val) { $('src-context-panel').style.display='none'; $('src-comp-chips').innerHTML=''; return; }
  const [c,p] = val.split('|||');
  const opp = DATA_PIPE.find(r=>r.c===c&&r.p===(p||''));
  if (!opp) return;
  $('src-context-panel').style.display = 'block';
  $('src-context-body').innerHTML = _srcContextHtml(opp);
  _srcAutoCompetencies(opp);
}

function _srcContextHtml(opp) {
  if (!opp) return '';
  return `<div style="display:flex;flex-direction:column;gap:3px">
    <div><b>${esc(opp.c)}</b>${opp.p?' · '+esc(opp.p):''}</div>
    ${opp.d?`<div style="font-size:.75rem;color:var(--slate);margin-top:2px">${esc(opp.d.slice(0,200))}${opp.d.length>200?'…':''}</div>`:''}
    <div style="font-size:.73rem;color:var(--slate)">Owner: ${esc(opp.owner||'—')} · Status: ${esc(opp.s||'—')}</div>
  </div>`;
}

function _srcAddComp(sel) {
  const val = sel.value; sel.value = '';
  if (!val) return;
  _srcAddCompByName(val);
}

function _srcAddCompByName(name) {
  const wrap = $('src-comp-chips');
  if (!wrap) return;
  const existing = [...wrap.querySelectorAll('[data-comp]')].map(el=>el.dataset.comp);
  if (existing.includes(name)) return;
  const chip = document.createElement('span');
  chip.dataset.comp = name;
  chip.style.cssText = 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:20px;padding:3px 10px;font-size:.72rem;font-weight:500;display:inline-flex;align-items:center;gap:4px';
  chip.innerHTML = `${esc(name)} <span style="cursor:pointer;opacity:.7;font-size:.7rem" onclick="this.parentElement.remove()">✕</span>`;
  wrap.appendChild(chip);
}

let _srcPoolMode = 'hr';
function _srcTogglePool(mode) {
  _srcPoolMode = mode;
  ['hr','pool','both'].forEach(m => {
    const btn = $(`src-pool-${m}`);
    if (btn) { btn.style.background = m===mode?'var(--navy)':'var(--card)'; btn.style.color = m===mode?'#fff':'var(--slate)'; }
  });
}

// ── Local scoring algorithm (replaces API call) ─────────────────
// CORS blocks direct fetch to api.anthropic.com from github.io
function _srcScoreLocally(candidates, competencies, opp, jd, minScore) {
  const reqComps   = competencies.map(c => c.toLowerCase());
  const oppText    = ((opp.d||'')+(opp.c||'')+(opp.p||'')+(jd||'')).toLowerCase();
  const reqGroup   = hrRoleGroup ? hrRoleGroup(opp.role || '') : null;

  // Status weight — prefer available candidates
  const statusScore = s => {
    s = (s||'').toLowerCase();
    if (['sourced','available','interested'].includes(s)) return 2;
    if (['proposed','hr screen','5c interview'].includes(s)) return 1;
    if (['placed','contracted','engaged'].includes(s)) return -1;
    return 0;
  };

  const scored = candidates.map(cand => {
    const candComps = (cand.competencies||'').toLowerCase().split(',').map(c=>c.trim()).filter(Boolean);

    // 1. Competency overlap (0–5 pts)
    const matched   = reqComps.filter(rc => candComps.some(cc => cc.includes(rc) || rc.includes(cc)));
    const compScore = reqComps.length > 0 ? (matched.length / reqComps.length) * 5 : 0;

    // 2. Role relevance (0–3 pts)
    const roleText = (cand.role||'').toLowerCase();
    const roleScore = reqComps.some(c => roleText.includes(c)) ? 2
      : oppText.split(' ').some(w => w.length > 4 && roleText.includes(w)) ? 1 : 0;

    // 3. Seniority (+1 for Senior)
    const senScore = (cand.seniority||'').toLowerCase().includes('senior') ? 1 : 0;

    // 4. Status adjustment
    const stScore = statusScore(cand.status);

    const raw   = compScore + roleScore + senScore + stScore;
    const score = Math.min(10, Math.max(1, Math.round(raw * 1.2)));

    // Build reason
    const matchedNames = matched.slice(0,3).map(c => reqComps.find(rc=>rc===c)||c);
    const reason = matched.length > 0
      ? `Matches ${matched.length}/${reqComps.length} required competencies (${matchedNames.join(', ')}${matched.length>3?'…':''}).${senScore?' Senior level.':''}${stScore<0?' Currently engaged.':''}`
      : `Limited competency overlap with required skills. Role: ${cand.role||'—'}.`;

    return {
      candidateId:  cand.id,
      source:       cand._source,
      name:         cand.name,
      displayName:  cand.displayName,
      role:         cand.role,
      seniority:    cand.seniority,
      status:       cand.status,
      linkedin:     cand.linkedin,
      score,
      reason,
      _matched:     matched.length,
    };
  })
  .filter(r => r.score >= minScore)
  .sort((a,b) => b.score - a.score || b._matched - a._matched)
  .slice(0, 15);

  return scored;
}

async function _srcRun() {
  const oppVal = $('src-opp-sel')?.value;
  if (!oppVal) { toast('Select an opportunity first','error'); return; }
  const [c,p] = oppVal.split('|||');
  const opp   = DATA_PIPE.find(r=>r.c===c&&r.p===(p||''));
  if (!opp)   { toast('Opportunity not found','error'); return; }

  const chips = [...($('src-comp-chips')?.querySelectorAll('[data-comp]')||[])];
  const competencies = chips.map(el=>el.dataset.comp);
  if (!competencies.length) { toast('Add at least one competency','error'); return; }

  const jd       = $('src-jd')?.value.trim()||'';
  const minScore = parseInt($('src-min-score')?.value||'5');

  let candidates = [];
  if (_srcPoolMode==='hr'||_srcPoolMode==='both')   candidates = candidates.concat((DATA_HR||[]).map(c=>({...c,_source:'hr'})));
  if (_srcPoolMode==='pool'||_srcPoolMode==='both') candidates = candidates.concat((DATA_POOL||[]).map(c=>({...c,_source:'pool'})));
  candidates = candidates.filter(c=>!['Blacklisted','Rejected'].includes(c.status||''));
  if (!candidates.length) { toast('No candidates loaded','error'); return; }

  const btn = $('src-run-btn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Running AI sourcing…'; }
  const resWrap = $('src-results-wrap');
  if (resWrap) { resWrap.style.display='block'; resWrap.innerHTML=`<div class="loading"><div class="spinner"></div><span>Scoring ${candidates.length} candidates locally…</span></div>`; }

  try {
    // ── Local scoring — no API call, no CORS, runs in browser ──
    // Direct fetch to api.anthropic.com is blocked by CORS from GitHub Pages.
    // Scoring is deterministic: competency overlap + role group + seniority.
    const results = _srcScoreLocally(candidates, competencies, opp, jd, minScore);

    const run = {
      id: 'run-'+Date.now(), oppKey:oppVal,
      oppLabel: opp.c+(opp.p?' · '+opp.p:''),
      runDate: new Date().toLocaleString('cs-CZ',{dateStyle:'short',timeStyle:'short'}),
      competencies, jd, results,
    };
    if (!window.DATA_SOURCING_RUNS) window.DATA_SOURCING_RUNS = [];
    DATA_SOURCING_RUNS.unshift(run);
    _srcShowResults(results, resWrap, run);
    if ($('sourcing-out')?.closest('.page.active')) renderSourcing();
    // Persist to Excel in background (fire-and-forget)
    P.saveSourcingRun(run).catch(e => console.warn('Sourcing save failed:', e.message));

  } catch(e) {
    if (resWrap) resWrap.innerHTML = `<div style="background:#fee2e2;color:#991b1b;border-radius:8px;padding:12px 14px;font-size:.82rem">⚠ Sourcing failed: ${esc(e.message)}</div>`;
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='↻ Re-run'; }
  }
}

function _srcShowResults(results, wrap, run) {
  if (!wrap) return;
  if (!results.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:20px;color:var(--slate);font-size:.85rem">No candidates met the minimum score. Try lowering the threshold or adding competencies.</div>`;
    return;
  }
  wrap.innerHTML = `
  <div style="border-top:1px solid var(--border);padding-top:16px">
    <div style="font-size:.82rem;font-weight:600;color:var(--navy2);margin-bottom:12px">✓ ${results.length} candidates matched</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${results.map(r=>`
      <div style="background:var(--bg);border-radius:8px;border:1px solid var(--border);padding:10px 14px;display:flex;align-items:flex-start;gap:12px;cursor:pointer" onclick="openCandidateFromSourcing('${esc(r.candidateId)}','${esc(r.source)}')">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
            <span style="font-weight:600;font-size:.85rem;color:var(--navy2)">${esc(r.displayName||r.name||'—')}</span>
            <span style="font-size:.75rem;color:var(--slate)">${esc(r.role||'—')} · ${esc(r.seniority||'—')}</span>
            ${candidateStatusBadge(r.status)}
            ${r.linkedin?`<a href="${safeUrl(r.linkedin)}" target="_blank" onclick="event.stopPropagation()" style="font-size:.7rem;color:var(--blue)">LinkedIn</a>`:''}
          </div>
          ${starBar(r.score)}
          <div style="font-size:.75rem;color:var(--slate);margin-top:4px">${esc(r.reason||'')}</div>
        </div>
        <span style="${scoreBg(r.score||0)};border-radius:20px;padding:3px 10px;font-size:.8rem;font-weight:700;flex-shrink:0">${r.score}/10</span>
      </div>`).join('')}
    </div>
    <div style="margin-top:12px;font-size:.73rem;color:var(--slate)">✓ Saved to Sourcing history · ${run.runDate}</div>
  </div>`;
}
