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
      owners:    'Owners',
      codelists: 'Codelists',
      companies: 'Companies',
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
      owners:    'Owners',
      codelists: 'Codelists',
      companies: 'Companies',
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
// Rev 19+ — col L = Task Name added
const TASK_COLS = {
  A:'id', B:'type', C:'linkedOpp', D:'linkedContact', E:'linkedCompany',
  F:'createdDate', G:'status', H:'responsible', I:'dueDate', J:'notes', K:'priority',
  L:'taskName'
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
