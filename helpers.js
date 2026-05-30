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
  return `<img src="https://logo.clearbit.com/${domain}" width="${size}" height="${size}"
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
    _openDrop = null;
  }
}
document.addEventListener('click', closeDrop);

function openDrop(menuId, triggerEl) {
  if (_openDrop && _openDrop.id !== menuId) closeDrop();
  const menu = document.getElementById(menuId);
  if (!menu) return;
  // Position menu below trigger
  const rect = triggerEl.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 4) + 'px';
  menu.style.left = rect.left + 'px';
  menu.classList.toggle('open');
  _openDrop = menu.classList.contains('open') ? menu : null;
}

// Build status badge HTML (inline, no ::before dot — uses coloured dot span)
function statusDot(s) {
  const cols = {Running:'var(--green)',Bidding:'var(--purple)',Pipeline:'var(--blue)',
                Prospect:'var(--amber)',Done:'var(--slate2)',Cancelled:'var(--red)'};
  return `<span style="width:7px;height:7px;border-radius:50%;background:${cols[s]||'#ccc'};display:inline-block;flex-shrink:0"></span>`;
}
function prioDot(p) {
  // Bright colours matching the badge styles — visible in dropdown
  const cols = {Critical:'#db2777',High:'#dc2626',Medium:'#d97706',Low:'#059669'};
  return `<span style="width:7px;height:7px;border-radius:50%;background:${cols[p]||'#94a3b8'};display:inline-block;flex-shrink:0"></span>`;
}

// ── Update all sidebar count badges ──
function updateCounts() {
  ALL_S.forEach(s => { const el = $('pl-' + s.toLowerCase()); if (el) el.textContent = cnt(s); });
  $('pl-total').textContent = $('pl-all').textContent = DATA_PIPE.length;
  const myOppEl = $('pl-myopps');
  if (myOppEl) myOppEl.textContent = DATA_PIPE.filter(r => r.owner && window.CURRENT_USER_NAME && r.owner.trim().toLowerCase() === window.CURRENT_USER_NAME.trim().toLowerCase()).length;
  $('pl-contacts').textContent = DATA_CONTACTS.length;
  const plComp = $('pl-companies'); if (plComp) plComp.textContent = DATA_COMPANIES.length;
  $('pl-tasks').textContent = DATA_TASKS.filter(t => t.status === 'Open').length + ' open';
  $('pl-owners').textContent = DATA_OWNERS.length;
  const n = Object.keys(CHANGES).length + Object.keys(PRIO_CHANGES).length;
  $('chg-n').textContent = n;
  $('chip-chg').style.display = n > 0 ? 'inline-flex' : 'none';
}
