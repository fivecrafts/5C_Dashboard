// 5C Dashboard v1.39.3 · 2026-06-19 · Five Crafts s.r.o.
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
let TASK_TYPES    = [
  'Intro Call','Send Email','Organize Meeting','Follow-up Call','Schedule Demo',
  'Send Pitchdeck','Send Proposal','Send NDA','Send Contract',
  'Prepare RfP Response','Contract Review','Negotiate Terms','Close Deal',
  'LinkedIn Connect','Research / Due Diligence','Event Follow-up',
  'Intro to Team','Other'
];
let TASK_STATUSES = ['Open','Done','Cancelled'];
let PRIORITIES    = ['Critical','High','Medium','Low']; // rev 19: Critical added
const INDUSTRIES  = ['Banking','Payments','Card Issuing','Card Acquiring','Crypto/Web3',
  'Lending','Insurance','Legal/Compliance','Consulting/Advisory','Software/Dev studio',
  'Identity/KYC','Analytics','Telco','Retail/POS','Government','Education','Other'];

// ── Pipeline pending changes (key = "client|||project" → newStatus) ──
let CHANGES = {};
let PRIO_CHANGES = {};  // pending priority edits, same pattern as CHANGES
let OWNER_PHOTOS  = {};
let DATA_EVENTS   = [];  // Events sheet
let DATA_HR       = [];  // HR Candidates
let DATA_HR_COLS  = {};  // header→colIndex map
let DATA_POOL     = [];  // HR Search Tracking Pool
let DATA_POOL_COLS= {};  // pool header→colIndex map
let DATA_SOURCING_RUNS = []; // in-memory sourcing run history  // email → object URL from Graph /photo/$value

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
