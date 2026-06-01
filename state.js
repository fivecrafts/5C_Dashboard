'use strict';

// ════════════════════════════════════════════════════════════════
// STATE — all mutable runtime data
// These are global so all page modules can read/write them.
// ════════════════════════════════════════════════════════════════

// ── Data arrays (populated on login by App.loadAll) ──
let DATA_PIPE      = [];
let DATA_CONTACTS  = [];
let DATA_TASKS     = [];
let DATA_OWNERS    = [];
let DATA_COMPANIES = [];

// ── Codelists (populated from Codelists sheet, with fallbacks) ──
let TASK_TYPES    = ['Organize Meet','Send Pitchdeck','Organize Call','Followup Call','Send Contract','Send Proposal','LinkedIn Connect','Other'];
let TASK_STATUSES = ['Open','Done','Cancelled'];
let PRIORITIES    = ['Critical','High','Medium','Low']; // rev 19: Critical added
const INDUSTRIES  = ['Banking','Payments','Card Issuing','Card Acquiring','Crypto/Web3',
  'Lending','Insurance','Legal/Compliance','Consulting/Advisory','Software/Dev studio',
  'Identity/KYC','Analytics','Telco','Retail/POS','Government','Education','Other'];

// ── Pipeline pending changes (key = "client|||project" → newStatus) ──
let CHANGES = {};
let PRIO_CHANGES = {};  // pending priority edits, same pattern as CHANGES
let OWNER_PHOTOS  = {};  // email → object URL from Graph /photo/$value

// ── Owner color map (built dynamically from DATA_PIPE) ──
let OC = {};

// ── Sort state for pipeline table ──
let SORT_COL = 's';
let SORT_DIR = 1;   // 1 = asc, -1 = desc

// ── Session / stale detection ──
let LOAD_TIME   = 0;
let staleWarned = false;
const STALE_MS  = 30 * 60 * 1000;   // 30 minutes

// ── Stale check timer (runs every 60 seconds) ──
setInterval(() => {
  if (!LOAD_TIME) return;
  if (Date.now() - LOAD_TIME > STALE_MS && !staleWarned) {
    staleWarned = true;
    $('stale-banner').style.display = 'flex';
  }
}, 60000);
