'use strict';

// ════════════════════════════════════════════════════════════════
// PROVIDERS — data access layer
// MsProvider: Microsoft Graph API (SharePoint / OneDrive)
// GglProvider: Google Sheets API (stub — ready for migration)
//
// Both implement the same interface:
//   tryAutoLogin()           → {name,email} | null
//   signIn()                 → null (redirect) or {name,email}
//   signOut()                → void
//   loadSheet(name)          → raw JSON from API
//   parsePipeline(json)      → Row[]
//   parseContacts(json)      → Contact[]
//   parseTasks(json)         → Task[]
//   parseOwners(json)        → Owner[]
//   parseCompanies(json)     → Company[]
//   parseCodelists(json)     → {ListName: [values]}
//   readCell(row, col)       → string  (for conflict detection)
//   patchRange(sheet,addr,v) → boolean
//   appendRow(sheet, values) → boolean
//   savePipelineRow(row, f)  → boolean
//   saveStatusOnly(row, s)   → boolean
//   saveContactRow(row, f)   → boolean
//   createContact(f)         → boolean
//   saveTaskRow(row, f)      → boolean
//   createTask(f)            → boolean
// ════════════════════════════════════════════════════════════════

// ── MICROSOFT ────────────────────────────────────────────────────
const MsProvider = (() => {
  const c = CFG.microsoft;
  let app = null;

  function boot() {
    if (app) return;
    app = new msal.PublicClientApplication({
      auth: {
        clientId: c.clientId,
        authority: `https://login.microsoftonline.com/${c.tenantId}`,
        redirectUri: window.location.origin + window.location.pathname.replace(/index\.html$/, ''),
      },
      cache: { cacheLocation: 'localStorage' },
    });
  }

  async function token() {
    const accs = app.getAllAccounts();
    if (!accs.length) throw new Error('Not signed in');
    return (await app.acquireTokenSilent({ scopes: c.scopes, account: accs[0] })).accessToken;
  }

  async function api(method, path, body, attempt = 0) {
    const t = await token();
    const r = await fetch('https://graph.microsoft.com/v1.0' + path, {
      method,
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    // Retry on 503 (service unavailable) or 429 (rate limit) with backoff
    if ((r.status === 503 || r.status === 429) && attempt < 3) {
      const wait = (attempt + 1) * 1500; // 1.5s, 3s, 4.5s
      await new Promise(res => setTimeout(res, wait));
      return api(method, path, body, attempt + 1);
    }
    if (!r.ok) throw new Error('Graph HTTP ' + r.status + ' ' + path);
    return method === 'PATCH' ? true : r.json();
  }

  function parseSheetByLetter(json) {
    const rows = json.values || [];
    if (rows.length < 2) return { headers: [], dataRows: [], allRows: rows };
    return {
      headers: rows[0].map(h => String(h).trim()),
      dataRows: rows.slice(1),
      allRows: rows,
    };
  }

  // Convert Excel date value to YYYY-MM-DD string
  // Handles: ISO strings, US format (m/d/yyyy), serial numbers, '###' overflow
  function excelDate(v) {
    const s = String(v ?? '').trim();
    if (!s || s.startsWith('#')) return '';  // empty or '###...' overflow
    // Already ISO format: 2026-05-24
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // US format: 5/19/2026 or 05/19/2026
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) return `${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
    // Excel serial number
    const n = Number(s);
    if (!isNaN(n) && n > 1) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return d.toISOString().slice(0, 10);
    }
    return s;
  }

  function mapRow(row, headers, mapping) {
    const rec = {};
    Object.entries(mapping).forEach(([field, hdr]) => {
      const idx = headers.indexOf(hdr);
      rec[field] = idx >= 0 ? String(row[idx] ?? '').trim() : '';
    });
    return rec;
  }

  return {
    async tryAutoLogin() {
      boot();
      await app.handleRedirectPromise().catch(() => {});
      const accs = app.getAllAccounts();
      return accs.length ? { name: accs[0].name, email: accs[0].username } : null;
    },

    async signIn() {
      boot();
      await app.loginRedirect({ scopes: c.scopes });
      return null;
    },

    async signOut() {
      boot();
      await app.logoutPopup().catch(() => {});
    },

    async loadSheet(sheetName) {
      return api('GET', `/drives/${c.driveId}/items/${c.fileId}/workbook/worksheets/${sheetName}/usedRange?$select=values`);
    },

    parsePipeline(json) {
      const { headers, dataRows } = parseSheetByLetter(json);
      if (!headers.length) return [];

      // Rev 22 — 13 cols A–M (Category removed, Phone+Email removed)
      const COL = {
        pid:0, p:1, c:2, d:3, s:4, prio:5,
        createdDate:6, updDate:7, owner:8, contact:9,
        projStart:10, src:11, coId:12
      };

      // Helper: get cell value, strip HYPERLINK formula if present
      function cell(row, idx) {
        const v = String(row[idx] ?? '').trim();
        if (v.includes('HYPERLINK')) {
          const m = v.match(/"([^"]+)"\s*\)?\s*$/);
          return m ? m[1] : '';
        }
        return v;
      }

      const out = [];
      dataRows.forEach((row, i) => {
        const rec = {
          _row:        i + 2,
          pid:         cell(row, COL.pid),
          p:           cell(row, COL.p),
          c:           cell(row, COL.c),
          d:           cell(row, COL.d),
          s:           cell(row, COL.s),
          prio:        cell(row, COL.prio),
          createdDate: excelDate(cell(row, COL.createdDate)),
          updDate:     excelDate(cell(row, COL.updDate)),
          owner:       cell(row, COL.owner),
          contact:     cell(row, COL.contact),
          projStart:   cell(row, COL.projStart),
          src:         cell(row, COL.src),
          coId:        cell(row, COL.coId),
        };
        if (rec.c || rec.pid) out.push(rec);
      });
      return out;
    },

    parseContacts(json) {
      const { headers, dataRows } = parseSheetByLetter(json);
      if (!dataRows || !dataRows.length) return [];
      // Rev 23: Company (col G=6) and Linked Opportunities (col H=7) are HYPERLINK cells
      // display = company name / "Client / Project Name" respectively
      // Schema: A=id,B=firstName,C=lastName,D=email,E=phone,F=web,
      //         G=company,H=linkedOpps,I=src,J=createdDate,K=updDate,L=coId
      const CMAP = {
        id:'Contact ID', firstName:'First Name', lastName:'Last Name',
        email:'Email', phone:'Phone', web:'Web', company:'Company',
        linkedOpps:'Linked Opportunities', src:'Source',
        createdDate:'Created Date', updDate:'Updated Date', coId:'Company ID',
      };
      const IDX = {id:0,firstName:1,lastName:2,email:3,phone:4,web:5,
                   company:6,linkedOpps:7,src:8,createdDate:9,updDate:10,coId:11};
      return dataRows.map((row, i) => {
        const rec = mapRow(row, headers, CMAP);
        // Index-based fallback if header lookup returned empty
        Object.entries(IDX).forEach(([f,idx]) => {
          if (!rec[f] && row[idx] !== undefined) rec[f] = String(row[idx]??'').trim();
        });
        // Strip HYPERLINK formulas from company and linkedOpps display cells
        ['company','linkedOpps'].forEach(f => {
          if (rec[f] && rec[f].includes('HYPERLINK')) {
            const m = rec[f].match(/"([^"]+)"\s*\)?\s*$/);
            if (m) rec[f] = m[1];
          }
        });
        rec._row        = i + 2;
        rec.createdDate = excelDate(rec.createdDate);
        rec.updDate     = excelDate(rec.updDate);
        return rec;
      }).filter(r => r.firstName || r.lastName);
    },
    parseTasks(json) {
      const { headers, dataRows } = parseSheetByLetter(json);
      if (!dataRows || !dataRows.length) return [];
      const TMAP = {
        id: 'Task ID', type: 'Task Type', linkedOpp: 'Linked Opportunity',
        linkedContact: 'Linked Contact', createdDate: 'Date Created',
        status: 'Status', responsible: 'Responsible', dueDate: 'Due Date',
        notes: 'Notes', priority: 'Priority',
      };
      // Rev 19: Linked Company col E(4) inserted; Priority now at col K(10)
      // Use column indices directly for reliability
      const TCOL = { id:0, type:1, linkedOpp:2, linkedContact:3, linkedCompany:4,
                     createdDate:5, status:6, responsible:7, dueDate:8, notes:9, priority:10 };
      return dataRows.map((row, i) => {
        const rec = {
          _row:          i + 2,
          id:            String(row[TCOL.id]          ?? '').trim(),
          type:          String(row[TCOL.type]         ?? '').trim(),
          linkedOpp:     String(row[TCOL.linkedOpp]    ?? '').trim(),
          linkedContact: String(row[TCOL.linkedContact] ?? '').trim(),
          linkedCompany: String(row[TCOL.linkedCompany] ?? '').trim(),
          createdDate:   excelDate(String(row[TCOL.createdDate] ?? '').trim()),
          status:        String(row[TCOL.status]       ?? '').trim(),
          responsible:   String(row[TCOL.responsible]  ?? '').trim(),
          dueDate:       excelDate(String(row[TCOL.dueDate] ?? '').trim()),
          notes:         String(row[TCOL.notes]        ?? '').trim(),
          priority:      String(row[TCOL.priority]     ?? '').trim(),
        };
        return rec;
      }).filter(r => r.id || r.type);
    },

    parseOwners(json) {
      const { headers, dataRows } = parseSheetByLetter(json);
      if (!dataRows || !dataRows.length) return [];
      const OMAP = {
        id: 'Owner ID', firstName: 'First Name', lastName: 'Last Name',
        displayName: 'Display Name', email: 'Email', notes: 'Notes',
      };
      return dataRows.map((row, i) => {
        const rec = mapRow(row, headers, OMAP);
        rec._row = i + 2;
        return rec;
      }).filter(r => r.displayName || r.firstName);
    },

    parseCompanies(json) {
      const { headers, dataRows } = parseSheetByLetter(json);
      if (!dataRows || !dataRows.length) return [];
      // Rev 19: Priority col D(3) inserted; website→E(4), industry→F(5)…
      // Schema: A=id, B=name, C=type, D=prio, E=website, F=industry, G=country, H=owner, I=notes, J=createdDate, K=updDate
      const COL_FALLBACK = { id:0, name:1, type:2, prio:3, website:4, industry:5, country:6, owner:7, notes:8, createdDate:9, updDate:10 };
      const CMAP = {
        id:'Company ID', name:'Company Name', type:'Type', prio:'Priority',
        website:'Website', industry:'Industry', country:'Country',
        owner:'Owner', notes:'Notes', createdDate:'Created Date', updDate:'Updated Date',
      };
      return dataRows.map((row, i) => {
        const rec = mapRow(row, headers, CMAP);
        // Fallback: if header-based lookup returned empty, try column index
        Object.entries(COL_FALLBACK).forEach(([field, idx]) => {
          if (!rec[field] && row[idx] !== undefined) {
            rec[field] = String(row[idx] ?? '').trim();
          }
        });
        rec._row        = i + 2;
        rec.createdDate = excelDate(rec.createdDate);
        rec.updDate     = excelDate(rec.updDate);
        return rec;
      }).filter(r => r.name || r.id);
    },

    parseCodelists(json) {
      const { dataRows } = parseSheetByLetter(json);
      const out = {};
      if (!dataRows || !dataRows.length) return out;
      dataRows.forEach(row => {
        const listName = String(row[0] ?? '').trim();
        const value    = String(row[1] ?? '').trim();
        if (listName && value) {
          if (!out[listName]) out[listName] = [];
          out[listName].push(value);
        }
      });
      return out;
    },

    async readCell(row, col) {
      // Col F = Status (rev 17)
      const json = await api('GET',
        `/drives/${c.driveId}/items/${c.fileId}/workbook/worksheets/${c.sheets.pipeline}/range(address='${col}${row._row}')?$select=values`
      );
      return json?.values?.[0]?.[0] ?? null;
    },

    async patchRange(sheet, address, values) {
      return api('PATCH',
        `/drives/${c.driveId}/items/${c.fileId}/workbook/worksheets/${sheet}/range(address='${address}')`,
        { values }
      );
    },

    async appendRow(sheet, values) {
      const json = await api('GET',
        `/drives/${c.driveId}/items/${c.fileId}/workbook/worksheets/${sheet}/usedRange?$select=rowCount`
      );
      const nextRow = (json.rowCount || 1) + 1;
      const colEnd  = String.fromCharCode(64 + values[0].length);
      return api('PATCH',
        `/drives/${c.driveId}/items/${c.fileId}/workbook/worksheets/${sheet}/range(address='A${nextRow}:${colEnd}${nextRow}')`,
        { values }
      );
    },

    async savePipelineRow(row, fields) {
      // Rev 17 column map:
      // A=Pipeline ID (immutable — never write)
      // B=Project, C=Client, D=Detail, E=Category, F=Status
      // G=Created (never write), H=Updated Date (auto), I=Owner, J=Contact
      // K=Phone, L=Email, M=ProjStart, N=Source, O=Company ID (FK)
      const s     = CFG.microsoft.sheets.pipeline;
      const today = new Date().toISOString().slice(0, 10);
      // Write B:N (all editable cols except A=PipelineID and G=CreatedDate)
      // Split: B:F (project→status), then H:N (updDate→source)
      // Rev 22: B:F = p,c,d,s,prio | H:L = updDate,owner,contact,projStart,src | M = coId
      // G = createdDate (immutable — never write)
      const r1 = await this.patchRange(s, `B${row._row}:F${row._row}`,
        [[fields.p, fields.c, fields.d, fields.s, fields.prio || 'Medium']]);
      const r2 = await this.patchRange(s, `H${row._row}:L${row._row}`,
        [[today, fields.owner, fields.contact, fields.projStart, fields.src]]);
      // Write Company ID to hidden col M
      const r3 = fields.coId
        ? await this.patchRange(s, `M${row._row}`, [[fields.coId]])
        : true;
      return r1 && r2 && r3;
    },

    async saveStatusOnly(row, newS) {
      // Rev 22: Status=E, Updated Date=H
      const s     = CFG.microsoft.sheets.pipeline;
      const today = new Date().toISOString().slice(0, 10);
      const r1 = await this.patchRange(s, `E${row._row}`, [[newS]]);
      await this.patchRange(s, `H${row._row}`, [[today]]).catch(() => {});
      return r1;
    },

    async savePriorityOnly(row, newP) {
      // Rev 22: Priority=F, Updated Date=H
      const s     = CFG.microsoft.sheets.pipeline;
      const today = new Date().toISOString().slice(0, 10);
      const r1 = await this.patchRange(s, `F${row._row}`, [[newP]]);
      await this.patchRange(s, `H${row._row}`, [[today]]).catch(() => {});
      return r1;
    },

    async saveContactRow(row, fields) {
      // Rev 17: col L = Company ID added
      const s     = CFG.microsoft.sheets.contacts;
      const today = new Date().toISOString().slice(0, 10);
      return this.patchRange(s, `B${row._row}:L${row._row}`,
        [[fields.firstName, fields.lastName, fields.email, fields.phone,
          fields.web, fields.company, fields.linkedOpps, fields.src,
          fields.createdDate || today, today, fields.coId || '']]
      );
    },

    async saveCompanyRow(row, fields) {
      // Rev 19: 11 cols B:K, prio at D(col 3)
      const s     = CFG.microsoft.sheets.companies;
      const today = new Date().toISOString().slice(0, 10);
      return this.patchRange(s, `B${row._row}:K${row._row}`,
        [[fields.name, fields.type, fields.prio || 'Medium',
          fields.website, fields.industry, fields.country,
          fields.owner, fields.notes, fields.createdDate || today, today]]
      );
    },

    async createContact(fields) {
      // Rev 17: 12 cols A-L including Company ID in col L
      const s     = CFG.microsoft.sheets.contacts;
      const today = new Date().toISOString().slice(0, 10);
      const newId = `C-${String(DATA_CONTACTS.length + 1).padStart(3, '0')}`;
      return this.appendRow(s, [[newId, fields.firstName, fields.lastName,
        fields.email, fields.phone, fields.web, fields.company,
        fields.linkedOpps || '', fields.src || 'Dashboard', today, today,
        fields.coId || '']]);
    },

    async saveTaskRow(row, fields) {
      // Rev 19: 11 cols A:K, linkedCompany at col E
      return this.patchRange(CFG.microsoft.sheets.tasks, `A${row._row}:K${row._row}`,
        [[row.id, fields.type, fields.linkedOpp, fields.linkedContact,
          fields.linkedCompany || '',
          row.createdDate, fields.status, fields.responsible,
          fields.dueDate, fields.notes, fields.priority]]
      );
    },

    async createTask(fields) {
      // Rev 19: 11 cols, linkedCompany at col E
      const s     = CFG.microsoft.sheets.tasks;
      const today = new Date().toISOString().slice(0, 10);
      const newId = `T-${String(DATA_TASKS.length + 1).padStart(3, '0')}`;
      return this.appendRow(s, [[newId, fields.type, fields.linkedOpp || '',
        fields.linkedContact || '', fields.linkedCompany || '',
        today, fields.status || 'Open',
        fields.responsible || '', fields.dueDate || '',
        fields.notes || '', fields.priority || 'Medium']]);
    },
  };
})();

// ── GOOGLE (stub — same interface, ready for migration) ──────────
const GglProvider = (() => {
  const c = CFG.google;
  let accessToken = null;

  function loadGSI() {
    return new Promise(res => {
      if (window.google?.accounts) { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = res;
      document.head.appendChild(s);
    });
  }

  async function t() { if (!accessToken) throw new Error('Not signed in'); return accessToken; }

  async function sheetsGet(r) {
    const tk = await t();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${c.sheetId}/values/${encodeURIComponent(r)}`,
      { headers: { Authorization: 'Bearer ' + tk } });
    if (!res.ok) throw new Error('Sheets ' + res.status);
    return res.json();
  }

  async function sheetsPut(r, values) {
    const tk = await t();
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${c.sheetId}/values/${encodeURIComponent(r)}?valueInputOption=RAW`,
      { method: 'PUT', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: r, majorDimension: 'ROWS', values }) }
    );
    return res.ok;
  }

  return {
    async tryAutoLogin() { return null; },
    async signIn() {
      await loadGSI();
      return new Promise((res, rej) => {
        google.accounts.oauth2.initTokenClient({
          client_id: c.clientId, scope: c.scopes.join(' '),
          callback: async resp => {
            if (resp.error) { rej(new Error(resp.error)); return; }
            accessToken = resp.access_token;
            const u = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo',
              { headers: { Authorization: 'Bearer ' + accessToken } })).json();
            res({ name: u.name, email: u.email });
          },
        }).requestAccessToken();
      });
    },
    async signOut() { if (accessToken && window.google) google.accounts.oauth2.revoke(accessToken); accessToken = null; },
    async loadSheet(name) { return sheetsGet(`${name}!A:Z`); },
    parsePipeline(j)  { return MsProvider.parsePipeline(j); },
    parseContacts(j)  { return MsProvider.parseContacts(j); },
    parseTasks(j)     { return MsProvider.parseTasks(j); },
    parseOwners(j)    { return MsProvider.parseOwners(j); },
    parseCompanies(j) { return MsProvider.parseCompanies(j); },
    parseCodelists(j) { return MsProvider.parseCodelists(j); },
    async readCell(row, col) {
      const j = await sheetsGet(`${c.sheets.pipeline}!${col}${row._row}`);
      return j?.values?.[0]?.[0] ?? null;
    },
    async patchRange(sheet, addr, vals) { return sheetsPut(`${sheet}!${addr}`, vals); },
    async appendRow(sheet, vals)        { return sheetsPut(`${sheet}!A:Z`, vals); },
    async savePipelineRow(row, f)  { return MsProvider.savePipelineRow.call(this, row, f); },
    async saveStatusOnly(row, s)   { return MsProvider.saveStatusOnly.call(this, row, s); },
    async savePriorityOnly(row, p)  { return MsProvider.savePriorityOnly.call(this, row, p); },
    async saveContactRow(row, f)   { return MsProvider.saveContactRow.call(this, row, f); },
    async createContact(f)         { return MsProvider.createContact.call(this, f); },
    async saveTaskRow(row, f)      { return MsProvider.saveTaskRow.call(this, row, f); },
    async createTask(f)            { return MsProvider.createTask.call(this, f); },
  };
})();

// ── REGISTRY ─────────────────────────────────────────────────────
const PROVIDERS = { microsoft: MsProvider, google: GglProvider };
let P         = PROVIDERS[CFG.ACTIVE] || MsProvider;
let activeCfg = CFG[CFG.ACTIVE]       || CFG.microsoft;

function setProvider(name) {
  if (PROVIDERS[name]) { P = PROVIDERS[name]; activeCfg = CFG[name]; }
}
