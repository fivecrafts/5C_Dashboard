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
  const m = { High:'pri-high', Medium:'pri-medium', Low:'pri-low' };
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
  const owners = [...new Set(DATA_PIPE.map(r => r.r).filter(Boolean))].sort();
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

// ── Company logo from name (looks up website from DATA_COMPANIES) ──
function companyLogoFromName(name, size = 24) {
  const co = (DATA_COMPANIES || []).find(c => c.name === name);
  if (!co) return ''; // no logo if company not in Companies sheet
  return companyLogo(co.website, name, size);
}

// ── Update all sidebar count badges ──
function updateCounts() {
  ALL_S.forEach(s => { const el = $('pl-' + s.toLowerCase()); if (el) el.textContent = cnt(s); });
  $('pl-total').textContent = $('pl-all').textContent = DATA_PIPE.length;
  $('pl-contacts').textContent = DATA_CONTACTS.length;
  const plComp = $('pl-companies'); if (plComp) plComp.textContent = DATA_COMPANIES.length;
  $('pl-tasks').textContent = DATA_TASKS.filter(t => t.status === 'Open').length + ' open';
  $('pl-owners').textContent = DATA_OWNERS.length;
  const n = Object.keys(CHANGES).length;
  $('chg-n').textContent = n;
  $('chip-chg').style.display = n > 0 ? 'inline-flex' : 'none';
}
