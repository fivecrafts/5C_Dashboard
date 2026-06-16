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
function companyLogo(website, name, size = 28) {
  // Strip protocol and www. regardless of whether http:// is present
  const domain = (website || '')
    .replace(/^https?:\/\//, '')   // strip https:// or http://
    .replace(/^www\./, '')           // strip www. (with or without protocol)
    .split('/')[0].split('?')[0];    // strip path and query
  const ini    = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const col    = (OC && OC[name]) ? OC[name] : '#64748b';
  const avatar = `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:6px;background:${col};color:#fff;font-size:${Math.round(size*0.38)}px;font-weight:700;align-items:center;justify-content:center;flex-shrink:0">${ini}</span>`;
  if (!domain) return avatar;
  // Google Favicon API — free, no key, works for any domain, reliable
  // Clearbit (logo.clearbit.com) was deprecated after HubSpot acquisition 2023
  const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  return `<img src="${logoUrl}" width="${size}" height="${size}"
    style="border-radius:6px;object-fit:contain;border:1px solid var(--border);background:#fff;vertical-align:middle;flex-shrink:0"
    onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"
    loading="lazy">${avatar.replace('display:inline-flex', 'display:none')}`;
}

// ── Company logo from name (looks up website from DATA_COMPANIES) ──
function companyLogoFromName(name, size = 24) {
  const co = (DATA_COMPANIES || []).find(c => c.name === name);
  // Always render — Clearbit logo if website known, initials avatar otherwise
  return companyLogo(co ? co.website : '', name, size);
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
