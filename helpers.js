// 5C Dashboard v1.39.11 · 2026-07-06 · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// HELPERS — utility functions shared across all pages
// ════════════════════════════════════════════════════════════════

// ── DOM shorthand ──
const $ = id => document.getElementById(id);

// ── Safe HTML escape ──
function esc(s) {
  return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Pipeline status badge ──
function badge(s) {
  const m = {
    Running:'s-running', Bidding:'s-bidding', Pipeline:'s-pipeline',
    Prospect:'s-prospect', Done:'s-done', Cancelled:'s-cancelled'
  };
  return `<span class="sb2 ${m[s] || 's-prospect'}">${s || '—'}</span>`;
}

// ── Category badge (coloured by type) ──
function catBadge(c) {
  const m = {
    Project:'cat-project', Partnership:'cat-partnership',
    Prospect:'cat-prospect', Pipeline:'cat-pipeline'
  };
  return `<span class="cb ${m[c] || ''}">${c || '—'}</span>`;
}

// ── Company type badge ──
function compTypeBadge(t) {
  const m = {
    Customer:    'background:#dcfce7;color:#166534;border:1px solid #bbf7d0',
    Partnership: 'background:#fce7f3;color:#9d174d;border:1px solid #fbcfe8',
    Both:        'background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe',
  };
  return t ? `<span class="cb" style="${m[t] || ''}">${t}</span>` : '—';
}

// ── Task status badge ──
function taskStatusBadge(s) {
  const m = { Open:'ts-open', Done:'ts-done', Cancelled:'ts-cancelled' };
  return `<span class="sb2 ${m[s] || 'ts-open'}">${s || 'Open'}</span>`;
}

// ── Priority badge ──
function prioBadge(p) {
  const m = { Critical:'pri-critical', High:'pri-high', Medium:'pri-medium', Low:'pri-low' };
  return p ? `<span class="${m[p] || 'pri-medium'}">${p}</span>` : '—';
}

// ── Topbar source chip ──
function chip(cls, txt) {
  const el = $('chip-src');
  el.className = 'chip ' + cls;
  el.textContent = txt;
}

// ── Login error display ──
function showErr(msg) {
  const el = $('login-err');
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
}

// ── Toast notification ──
function toast(msg, type = 'info') {
  const area = $('toasts');
  const t = document.createElement('div');
  t.className = `toast t-${type}`;
  t.textContent = msg;
  area.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4000);
}

// ── Pipeline row key (unique identifier) ──
function key(r) { return r.c + '|||' + r.p; }

// ── Build owner color map from live data ──
function buildOwnerColors() {
  const owners = [...new Set(DATA_PIPE.map(r => r.owner).filter(Boolean))].sort();
  OC = {};
  owners.forEach((o, i) => { OC[o] = OWNER_PALETTE[i % OWNER_PALETTE.length]; });
  window.OWNERS = owners;
  const dl = $('owners-list');
  if (dl) dl.innerHTML = owners.map(o => `<option value="${o}">`).join('');
}

// ── Count pipeline rows by status (respects pending CHANGES) ──
function cnt(s) {
  return DATA_PIPE.filter(r => (CHANGES[key(r)] ?? r.s) === s).length;
}

// ── Clearbit logo (free, no key) with initials fallback ──
function _fallbackBadge(icon, size) {
  // Generic emoji icon in a styled box — used when no favicon available
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:6px;background:#f1f5f9;border:1px solid var(--border);align-items:center;justify-content:center;flex-shrink:0;font-size:${Math.round(size*0.55)}px">${icon}</span>`;
}

function companyLogo(website, name, size = 28, fallback = '🏦') {
  // Strip protocol / www. / path from URL to get bare domain
  const domain = (website || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0].split('?')[0];
  const fbBadge = _fallbackBadge(fallback, size);
  if (!domain) return fbBadge;
  // Google Favicon API — free, no key, reliable
  const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  return `<img src="${logoUrl}" width="${size}" height="${size}"
    style="border-radius:6px;object-fit:contain;border:1px solid var(--border);background:#fff;vertical-align:middle;flex-shrink:0"
    onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"
    loading="lazy">${fbBadge.replace('display:inline-flex', 'display:none')}`;
}

// ── Company logo from name (looks up website from DATA_COMPANIES) ──
function companyLogoFromName(name, size = 24, fallback = '🏦') {
  const co = (DATA_COMPANIES || []).find(c => c.name === name);
  return companyLogo(co ? co.website : '', name, size, fallback);
}

// ── Custom styled dropdown (status + priority inline editing) ──
let _openDrop = null;

function closeDrop() {
  if (_openDrop) {
    _openDrop.classList.remove('open');
    // Return menu to its original parent if it was moved to body
    if (_openDrop.parentNode === document.body && _openDrop._originalParent) {
      _openDrop._originalParent.appendChild(_openDrop);
    }
    _openDrop = null;
  }
}
document.addEventListener('click', (e) => {
  // Don't close if clicking inside a cdrop element
  if (e.target.closest && e.target.closest('.cdrop')) return;
  closeDrop();
});

function openDrop(menuId, triggerEl) {
  if (_openDrop) {
    const wasOpen = _openDrop.id === menuId;
    closeDrop();
    if (wasOpen) return; // toggle off
  }
  const menu = document.getElementById(menuId);
  if (!menu) return;
  // Move to body to escape overflow:auto stacking context in drawer
  const rect = triggerEl.getBoundingClientRect();
  menu.style.top   = (rect.bottom + 4) + 'px';
  menu.style.left  = rect.left + 'px';
  menu.style.width = rect.width + 'px';
  menu._originalParent = menu.parentNode;
  document.body.appendChild(menu);
  menu.classList.add('open');
  _openDrop = menu;
}

// Build status badge HTML (inline, no ::before dot — uses coloured dot span)
function statusDot(s) {
  const cols = {Running:'var(--green)',Bidding:'var(--purple)',Pipeline:'var(--blue)',
                Prospect:'var(--amber)',Done:'var(--slate2)',Cancelled:'var(--red)'};
  return `<span style="width:7px;height:7px;border-radius:50%;background:${cols[s]||'#ccc'};display:inline-block;flex-shrink:0"></span>`;
}
// ── Contact display name — Surname Name format ──────────────────
function contactDisplayName(c) {
  const last  = (c.lastName  || '').trim();
  const first = (c.firstName || '').trim();
  return last && first ? `${last} ${first}` : (last || first);
}

function taskStatusDot(s) {
  const cols = {Open:'var(--blue)', Done:'var(--green)', Cancelled:'#94a3b8'};
  return `<span style="width:7px;height:7px;border-radius:50%;background:${cols[s]||'#94a3b8'};display:inline-block;flex-shrink:0"></span>`;
}
function taskStatusBadge(s) {
  const styles = {
    Open:      'background:var(--blue-t);color:var(--blue);border:1px solid var(--blue-l)',
    Done:      'background:var(--green-t);color:var(--green);border:1px solid var(--green-l)',
    Cancelled: 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0',
  };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:600;${styles[s]||styles.Open}">${s}</span>`;
}
function prioDot(p) {
  const cols = {Critical:'#7c3aed',High:'#ea580c',Medium:'#eab308',Low:'#16a34a'};
  return `<span style="width:7px;height:7px;border-radius:50%;background:${cols[p]||'#94a3b8'};display:inline-block;flex-shrink:0"></span>`;
}


// ── Styled dropdown for detail drawers (status + priority) ──────
// Renders a cdrop that also keeps a hidden <input> in sync for save functions
function buildDrawerStatusDrop(elId, currentVal, allowedVals, allStatuses) {
  const menuId = 'drd-' + elId;
  const opts = (allStatuses||ALL_S).map(s => {
    const dis = allowedVals && !allowedVals.includes(s) && s !== currentVal;
    return `<div class="cdrop-opt${currentVal===s?' active':''}${dis?' disabled':''}"
      onclick="closeDrop();_setDrop('${elId}','${menuId}',this,'${s}')">
      ${statusDot(s)}<span>${s}</span></div>`;
  }).join('');
  return `<div class="cdrop" style="display:block">
    <input type="hidden" id="${elId}" value="${currentVal}">
    <div class="cdrop-trigger" style="width:100%;justify-content:flex-start;gap:8px;padding:8px 12px"
      onclick="event.stopPropagation();openDrop('${menuId}',this)">
      <span id="${elId}_dot">${statusDot(currentVal)}</span>
      <span id="${elId}_lbl" style="flex:1">${currentVal}</span>
      <span class="arr">▾</span>
    </div>
    <div class="cdrop-menu" id="${menuId}" style="width:100%">${opts}</div>
  </div>`;
}

function buildDrawerTaskStatusDrop(elId, currentVal) {
  const cur     = currentVal || 'Open';
  const menuId  = 'drd-' + elId;
  const TSTAT   = ['Open','Done','Cancelled'];
  const opts    = TSTAT.map(s =>
    `<div class="cdrop-opt${cur===s?' active':''}"
      onclick="closeDrop();_setDrop('${elId}','${menuId}',this,'${s}')">
      ${taskStatusDot(s)}<span>${s}</span></div>`
  ).join('');
  return `<div class="cdrop" style="display:block">
    <input type="hidden" id="${elId}" value="${cur}">
    <div class="cdrop-trigger" style="width:100%;justify-content:flex-start;gap:8px;padding:8px 12px"
      onclick="event.stopPropagation();openDrop('${menuId}',this)">
      <span id="${elId}_dot">${taskStatusDot(cur)}</span>
      <span id="${elId}_lbl" style="flex:1">${cur}</span>
      <span class="arr">▾</span>
    </div>
    <div class="cdrop-menu" id="${menuId}" style="width:100%">${opts}</div>
  </div>`;
}

function buildDrawerPrioDrop(elId, currentVal) {
  const cur = currentVal || 'Medium';
  const menuId = 'drd-' + elId;
  const opts = PRIORITIES.map(p =>
    `<div class="cdrop-opt${cur===p?' active':''}"
      onclick="closeDrop();_setDrop('${elId}','${menuId}',this,'${p}')">
      ${prioDot(p)}<span>${p}</span></div>`
  ).join('');
  return `<div class="cdrop" style="display:block">
    <input type="hidden" id="${elId}" value="${cur}">
    <div class="cdrop-trigger" style="width:100%;justify-content:flex-start;gap:8px;padding:8px 12px"
      onclick="event.stopPropagation();openDrop('${menuId}',this)">
      <span id="${elId}_dot">${prioDot(cur)}</span>
      <span id="${elId}_lbl" style="flex:1">${cur}</span>
      <span class="arr">▾</span>
    </div>
    <div class="cdrop-menu" id="${menuId}" style="width:100%">${opts}</div>
  </div>`;
}

// Update hidden input + trigger label when option selected
function _setDrop(elId, menuId, optEl, val) {
  const hidden = document.getElementById(elId);
  if (hidden) hidden.value = val;
  const lbl = document.getElementById(elId + '_lbl');
  if (lbl) lbl.textContent = val;
  // Re-render dot
  const dot = document.getElementById(elId + '_dot');
  if (dot) {
    const isStatus = ['Running','Bidding','Pipeline','Prospect','Done','Cancelled'].includes(val);
    dot.innerHTML = isStatus ? statusDot(val) : prioDot(val);
  }
  // Update active class
  const menu = document.getElementById(menuId);
  if (menu) menu.querySelectorAll('.cdrop-opt').forEach(o => {
    o.classList.toggle('active', o.querySelector('span:last-child')?.textContent === val);
  });
}

// ── Update all sidebar count badges ──
function updateCounts() {
  // Guard every element — some sidebar items may not exist in all layouts
  const s_ = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  ALL_S.forEach(s => s_('pl-' + s.toLowerCase(), cnt(s)));
  s_('pl-total',    DATA_PIPE.length);
  s_('pl-all',      DATA_PIPE.length);
  s_('pl-myopps',   DATA_PIPE.filter(r => r.owner && window.CURRENT_USER_NAME &&
    r.owner.trim().toLowerCase() === window.CURRENT_USER_NAME.trim().toLowerCase()).length);
  s_('pl-contacts', DATA_CONTACTS.length);
  s_('pl-companies',DATA_COMPANIES.length);
  s_('pl-tasks',    DATA_TASKS.filter(t => t.status === 'Open').length + ' open');
  s_('pl-events',   (DATA_EVENTS||[]).length || '—');
  s_('pl-owners',   DATA_OWNERS.length);
  const n = Object.keys(CHANGES).length + Object.keys(PRIO_CHANGES).length;
  s_('chg-n', n);
  const chip = $('chip-chg'); if (chip) chip.style.display = n > 0 ? 'inline-flex' : 'none';
}

// ── Search focus save/restore — prevents re-render from breaking continuous typing ──
function _saveFocus() {
  const el = document.activeElement;
  if (!el || el === document.body || !el.id) return null;
  return { id: el.id, start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
}
function _restoreFocus(saved) {
  if (!saved?.id) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(saved.id);
    if (!el) return;
    try { el.focus(); el.setSelectionRange(saved.start ?? 0, saved.end ?? 0); } catch {}
  });
}

// ── Generic chip hidden-input sync (shared by Events + HR) ──────
function _updateChipHidden(chipsId, hiddenId) {
  const chips  = document.getElementById(chipsId);
  const hidden = document.getElementById(hiddenId);
  if (!chips || !hidden) return;
  const vals = [...chips.querySelectorAll('span[data-val]')].map(s => s.dataset.val);
  hidden.value = vals.join(', ');
}

// ── Safe URL — blocks javascript: and data: injection ────────────
function safeUrl(u) {
  if (!u || typeof u !== 'string') return '#';
  const s = u.trim();
  return /^https?:\/\//i.test(s) ? s : '#';
}

// ── Date formatting ──────────────────────────────────────────
// Format YYYY-MM-DD → "14 May 2026", returns '—' for blank
function fmtDate(s) {
  if (!s) return '—';
  const [y,m,d] = s.split('-');
  if (!y||!m||!d) return s;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d,10)} ${MONTHS[parseInt(m,10)-1]} ${y}`;
}
// "14–16 May 2026" same month, "30 Apr – 2 May 2026" cross-month
function fmtDateRange(from, to) {
  if (!from) return '—';
  if (!to || to === from) return fmtDate(from);
  const [fy,fm,fd] = from.split('-');
  const [ty,tm,td] = to.split('-');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (fy===ty && fm===tm) return `${parseInt(fd,10)}–${parseInt(td,10)} ${MONTHS[parseInt(fm,10)-1]} ${fy}`;
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

// ── MessageLinks conversation panel ─────────────────────────
// Renders a "Conversation" section at the bottom of any record drawer.
// DATA_MSG_LINKS is loaded at login; this is a pure render helper.
// ── Conversation panel ────────────────────────────────────────
// On-demand loader: fetches MessageLinks live if not yet in memory.
// Renders a placeholder, then fills async — works even if opened
// before the background load completes.

function _buildMsgHtml(msgs) {
  const CHANNEL_ICON = { 'BD General':'💬','BD Partnerships':'🤝','BD Events':'📅' };
  const CONF_COLOR   = { 'High':'var(--green)','Medium':'var(--amber)','Inherited':'var(--slate2)' };

  const items = msgs.map((m, i) => {
    const icon    = CHANNEL_ICON[m.channel] || '💬';
    const dStr    = m.ts ? fmtDate(m.ts.slice(0, 10)) : '—';
    const confDot = `<span title="${m.confidence}" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${CONF_COLOR[m.confidence]||'var(--slate2)'};flex-shrink:0;margin-top:4px"></span>`;
    const link    = m.webUrl ? `<a href="${safeUrl(m.webUrl)}" target="_blank" onclick="event.stopPropagation()" title="Open in Teams" style="color:var(--blue);font-size:.82rem;margin-left:auto;flex-shrink:0">↗</a>` : '';
    const isLast  = i === msgs.length - 1;
    return `<div style="padding:7px 0;${isLast?'':'border-bottom:1px solid var(--border)'}">
      <div style="display:flex;align-items:flex-start;gap:6px">
        ${confDot}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
            <span style="font-size:.68rem">${icon}</span>
            <span style="font-size:.68rem;font-weight:600;color:var(--slate)">${esc(m.channel)}</span>
            <span style="font-size:.67rem;color:var(--slate2)">${dStr} · ${esc(m.author)}</span>
            ${link}
          </div>
          <div style="font-size:.75rem;color:var(--ink);line-height:1.45">${esc(m.snippet)}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const showMore = msgs.length > 3;
  return `
    <div class="drawer-sec-label" style="display:flex;align-items:center;justify-content:space-between">
      <span>💬 Conversation <span style="font-size:.68rem;font-weight:400;color:var(--slate2)">(${msgs.length})</span></span>
      ${showMore ? `<button onclick="const l=this.closest('[data-msg-panel]').querySelector('.msg-list');const exp=l.style.maxHeight==='none';l.style.maxHeight=exp?'200px':'none';this.textContent=exp?'Show all (${msgs.length})':'Show less';" style="background:none;border:none;cursor:pointer;font-size:.7rem;color:var(--blue)">Show all (${msgs.length})</button>` : ''}
    </div>
    <div class="msg-list" style="max-height:${showMore?'200px':'none'};overflow-y:auto">${items}</div>`;
}

// Fill a panel element with messages for recordId, fetching live if needed
async function _fillMsgPanel(el, recordId) {
  if (!el) return;
  // If DATA_MSG_LINKS already loaded, render immediately from memory
  if (DATA_MSG_LINKS && DATA_MSG_LINKS.length > 0) {
    const msgs = DATA_MSG_LINKS.filter(m => m.recordId === recordId)
      .sort((a, b) => b.ts.localeCompare(a.ts));
    if (msgs.length === 0) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = _buildMsgHtml(msgs);
    return;
  }
  // DATA_MSG_LINKS not ready — fetch live now (both Pipeline + HR files)
  el.innerHTML = `<div style="font-size:.72rem;color:var(--slate2);padding:4px 0">💬 Loading…</div>`;
  try {
    const [mlj, hrmlj] = await Promise.all([
      P.loadMessageLinks(),
      P.loadHRMessageLinks(),
    ]);
    DATA_MSG_LINKS = [...P.parseMessageLinks(mlj), ...P.parseMessageLinks(hrmlj)];
    const msgs = DATA_MSG_LINKS.filter(m => m.recordId === recordId)
      .sort((a, b) => b.ts.localeCompare(a.ts));
    if (msgs.length === 0) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = _buildMsgHtml(msgs);
    // Also refresh any other open panels
    refreshOpenMsgPanels();
  } catch (e) {
    el.innerHTML = `<div style="font-size:.72rem;color:var(--slate2);padding:4px 0">💬 Messages unavailable</div>`;
  }
}

// Called after DATA_MSG_LINKS background load to refresh any open panels
function refreshOpenMsgPanels() {
  document.querySelectorAll('[data-msg-panel]').forEach(el => {
    const recordId = el.dataset.msgPanel;
    const msgs = (DATA_MSG_LINKS || []).filter(m => m.recordId === recordId)
      .sort((a, b) => b.ts.localeCompare(a.ts));
    if (msgs.length === 0) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = _buildMsgHtml(msgs);
  });
}

// Emits a placeholder div; fills itself on next tick via _fillMsgPanel
function renderMsgPanel(recordId) {
  if (!recordId) return '';
  const safeId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `<div class="drawer-sec" data-msg-panel="${esc(recordId)}" id="mp-${safeId}" style="margin-top:16px">
    <div style="font-size:.72rem;color:var(--slate2);padding:4px 0">💬 Loading messages…</div>
  </div>
  <script>setTimeout(()=>_fillMsgPanel(document.getElementById('mp-${safeId}'),'${recordId.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'),0);<\/script>`;
}
