// 5C Dashboard v1.39.17 · 2026-07-07 · Five Crafts s.r.o.
'use strict';

// ════════════════════════════════════════════════════════════════
// CONFIG — Azure, SharePoint, Google credentials & sheet names
// To switch to Google: change ACTIVE to 'google' and fill in
// clientId and sheetId in the google block below.
// ════════════════════════════════════════════════════════════════
const CFG = {
  ACTIVE: 'microsoft',

  microsoft: {
    label:     'Microsoft',
    badgeCls:  'pvdr-ms',
    srcLabel:  '5C_Pipeline.xlsx',
    clientId:  'f40e3049-3a3e-45a4-bef4-76c21ed50419',
    tenantId:  'fivecrafts.cz',
    driveId:   'b!sfRUpRpD1UGP25IZgoe25EIG1LQLxKZMqzutcQq84SwTUIT0yfgyRa__hqyrQ6PI',
    fileId:    '01MIP6LSHXFSXX7HPIN5A2KEUXK6GPIPBJ',
    scopes:    ['Files.ReadWrite','Sites.ReadWrite.All','User.Read'],
    sheets: {
      pipeline:  'Pipeline',
      contacts:  'Contacts',
      tasks:     'Tasks',
    events:    'Events',
      owners:    'Owners',
      codelists: 'Codelists',
      companies: 'Companies',
      sourcing:      'Sourcing',
      messageLinks:  'MessageLinks',
    }
  },

  google: {
    label:     'Google',
    badgeCls:  'pvdr-google',
    srcLabel:  '5C_Pipeline (Sheets)',
    clientId:  'YOUR_GOOGLE_CLIENT_ID',
    sheetId:   'YOUR_SHEET_ID',
    scopes:    ['https://www.googleapis.com/auth/spreadsheets'],
    statusCol: 5,
    sheets: {
      pipeline:  'Pipeline',
      contacts:  'Contacts',
      tasks:     'Tasks',
    events:    'Events',
      owners:    'Owners',
      codelists: 'Codelists',
      companies: 'Companies',
      messageLinks: 'MessageLinks',
    }
  },
};

// ════════════════════════════════════════════════════════════════
// COLUMN MAPS — verified against live Excel 2026-05-19
// ════════════════════════════════════════════════════════════════
// Rev 22 — Category removed (E), Phone+Email removed (rev 20)
// Pipeline now 13 cols A–M
const PIPE_COLS = {
  A:'pid', B:'p', C:'c', D:'d', E:'s', F:'prio',
  G:'createdDate', H:'updDate', I:'owner', J:'contact',
  K:'projStart', L:'src', M:'coId'
};
// Rev 19 — Contacts unchanged from rev 16
const CONT_COLS = {
  A:'id', B:'firstName', C:'lastName', D:'email', E:'phone',
  F:'web', G:'company', H:'linkedOpps', I:'src', J:'createdDate', K:'updDate', L:'coId'
};
// Rev 19+ — col L = taskName, col M = outlookEventId
const TASK_COLS = {
  A:'id', B:'type', C:'linkedOpp', D:'linkedContact', E:'linkedCompany',
  F:'createdDate', G:'status', H:'responsible', I:'dueDate', J:'notes', K:'priority',
  L:'taskName', M:'linkedEvent', N:'outlookEventId', O:'archived'
};
const OWN_COLS  = { A:'id', B:'firstName', C:'lastName', D:'displayName', E:'email', F:'notes' };
// Rev 19 — Priority col D inserted, all subsequent shift +1
const COMP_COLS = {
  A:'id', B:'name', C:'type', D:'prio', E:'website', F:'industry',
  G:'country', H:'owner', I:'notes', J:'createdDate', K:'updDate'
};

// ════════════════════════════════════════════════════════════════
// WORKFLOW — allowed status transitions
// ════════════════════════════════════════════════════════════════
const FLOW = {
  Prospect:  ['Pipeline','Prospect','Cancelled'],
  Pipeline:  ['Bidding','Running','Prospect','Done','Cancelled','Pipeline'],
  Bidding:   ['Running','Done','Cancelled','Pipeline','Bidding'],
  Running:   ['Done','Cancelled','Running','Pipeline'],
  Done:      ['Pipeline','Prospect','Done'],
  Cancelled: ['Prospect','Pipeline','Cancelled'],
};

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════
const ALL_S          = ['Running','Bidding','Pipeline','Prospect','Done','Cancelled'];
const OWNER_PALETTE  = ['#2563eb','#059669','#7c3aed','#d97706','#dc2626','#0891b2','#65a30d','#c2410c'];

// Events sheet columns — confirmed from actual Excel file
// A=id, B=name, C=owner, D=place, E=country, F=mode, G=status, H=industry,
// I=dateFrom, J=dateTo, K=webLink, L=description, M=audience, N=followup,
// O=linkedCompanies, P=linkedOpps, Q=linkedContacts, R=createdDate, S=updDate, T=archived
const EVENT_COLS = {
  id:0, name:1, owner:2, place:3, country:4, mode:5, status:6, industry:7,
  dateFrom:8, dateTo:9, webLink:10, description:11, audience:12, followup:13,
  linkedCompanies:14, linkedOpps:15, linkedContacts:16,
  createdDate:17, updDate:18, archived:19
};
const EVENT_STATUSES  = ['Active','Watching','Not Interested'];
const EVENT_MODES     = ['Offline','Online','Hybrid'];

// ── Dashboard version ────────────────────────────────────────────
const DASHBOARD_VERSION      = 'v1.38.0';
const DASHBOARD_VERSION_DATE = '2026-06-19';

// ── HR Candidates file (separate SharePoint site: Hiring) ────────
const HR_CFG = {
  driveId:   'b!Qf__fE3UsEmhPGc-IR_mmlRRmYCEfTVIuZNk-vm3qRtip2w9wPpTS73_2bnbUkgG',
  fileId:    '014PLZ7ZIRZ5NYATW225HIYOI2H4E2FFBT',
  sheet:     '5C Candidates',
};
const HR_OWNERS    = ['Petr Macalík','Václav Malý','Marián Vandas','Viktor Gřešek','Eva Malková'];
const HR_STATUSES  = ['Sourced','Contacted','Engaged','HR Screen','5C Interview','On Hold',
                      'Proposed','Contracted','Placed','Not Interested','Rejected','Blacklisted'];
const HR_SENIORITY = ['Junior','Medior','Medior-Senior','Senior','Principal','Executive'];
const HR_STATUS_GROUP = {
  gray:  ['Sourced','Contacted','Engaged'],
  blue:  ['HR Screen','5C Interview'],
  amber: ['On Hold'],
  green: ['Proposed','Contracted','Placed'],
  red:   ['Not Interested','Rejected','Blacklisted'],
};

// ── HR competency codelist (61 values) ─────────────────────────
const HR_COMPETENCIES = [
  'Acquiring','Agile / SAFe','AI / Automation','AML','API Design',
  'Apple Pay / Google Pay','Authorization','Atlassian (Jira/Confluence)',
  'Banking','BPMN / Process Modeling','Business Analysis',
  'Card Payments','Chargebacks','Clearing & Settlement','Compliance',
  'Core Banking','Crypto / DLT','Cyber Security','CERTIS',
  'Data Architecture','Digital Banking','Digital Channels','Digital Wallet (EU)',
  'DORA','EMV','Enterprise Architecture','ESG','Fintech','Fraud','GDPR',
  'Insurance','Integration Architecture','Internet Banking','ISO 20022',
  'ISO 27001','ISO 8583','IT Security','Issuing','ITIL',
  'KYC','Licensing & Regulation','MiFID','Mobile Banking',
  'NIS2','Open Banking','PCI DSS','Payment Gateway','Payment Hub',
  'POS Terminals','PSD2 / AISP / PISP','Project Delivery','Public Sector',
  'Risk Management','SEPA','Solution Architecture','SQL / Data','SWIFT',
  'Temenos T24','Test Management / UAT','Tokenization','Transport',
];

// ── HR Search Tracking Pool (5C_POOL_Dasboard sheet) ─────────────
const HR_POOL_CFG = {
  driveId: 'b!Qf__fE3UsEmhPGc-IR_mmlRRmYCEfTVIuZNk-vm3qRtip2w9wPpTS73_2bnbUkgG',
  fileId:  '014PLZ7ZLV6A5CQ3I7O5AZTGCSWUKS5SVU',
  sheet:   '5C_POOL_Dasboard',   // intentional typo — missing h
};
// Pool note field labels (cols K–O)
const POOL_NOTES = [
  { col:'HR Poznámka',  label:'HR Note',     editable:false },
  { col:'5C Schválení', label:'5C Approval', editable:false },
  { col:'5C Poznámka',  label:'5C Note ★',   editable:true  },
  { col:'Výsledek',     label:'Result',      editable:true  },
  { col:'NOTE',         label:'General Note',editable:true  },
];
// Pool read-only cols — never written by App
const POOL_READONLY = ['Code','Duplicate Flag','DateCreated','Candidate FC ID'];

// ── HR Role Groups — shared between hr.js stats and filtering ────
const HR_ROLE_GROUPS = [
  { icon:'🧩', label:'Analyst',          roles:['IT Analyst','Business Analyst','Solution Architect','IT Architect'] },
  { icon:'💳', label:'Cards',            roles:['Card Specialist','Acquiring Specialist'] },
  { icon:'🧭', label:'Management',       roles:['Project Manager','Delivery Manager','Product Manager','Product Owner'] },
  { icon:'🛡️', label:'Risk & Compliance',roles:['Risk Specialist','Compliance Specialist','Cyber Security Specialist'] },
  { icon:'💰', label:'Finance',          roles:['Finance Specialist','CFO'] },
  { icon:'💻', label:'Technology',       roles:['Software Developer','Mobile Developer','IT Administrator','QA / Test Manager','DevOps Engineer'] },
  { icon:'🤝', label:'People',           roles:['HR Generalist','Legal Specialist'] },
  { icon:'🙋', label:'Other',            roles:['Other'] },
];
