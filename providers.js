// 5C Dashboard v1.39.15 · 2026-07-06 · Five Crafts s.r.o.
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
      try {
        const result = await app.handleRedirectPromise();
        // If redirect returned an error (e.g. AADSTS160021 stale session), clear cache
        if (result === null) {
          const accs = app.getAllAccounts();
          if (accs.length) {
            // Try silent token to confirm session is still alive
            try {
              await app.acquireTokenSilent({ scopes: c.scopes, account: accs[0] });
            } catch (silentErr) {
              // Silent failed → clear cached accounts so login page prompts fresh
              if (silentErr.errorCode === 'interaction_required' ||
                  (silentErr.message && silentErr.message.includes('AADSTS160021'))) {
                await app.clearCache().catch(() => {});
                return null; // caller will trigger signIn() with prompt:'select_account'
              }
            }
          }
        }
      } catch (e) {
        // handleRedirectPromise itself threw (e.g. AADSTS160021 on redirect return)
        await app.clearCache().catch(() => {});
        return null;
      }
      const accs = app.getAllAccounts();
      return accs.length ? { name: accs[0].name, email: accs[0].username } : null;
    },

    async signIn() {
      boot();
      await app.loginRedirect({ scopes: c.scopes, prompt: 'select_account' });
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

      // Rev 22+ — col N(13) = Archived flag
      const COL = {
        pid:0, p:1, c:2, d:3, s:4, prio:5,
        createdDate:6, updDate:7, owner:8, contact:9,
        projStart:10, src:11, coId:12, archived:13
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
        rec.archived = cell(row, COL.archived);
        if ((rec.c || rec.pid) && rec.archived !== 'Y') out.push(rec);
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
                   company:6,linkedOpps:7,src:8,createdDate:9,updDate:10,coId:11,archived:12};
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
      }).filter(r => (r.firstName || r.lastName) && r.archived !== 'Y');
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
      // Rev 19+: col L (index 11) = Task Name (free text label)
      const TCOL = { id:0, type:1, linkedOpp:2, linkedContact:3, linkedCompany:4,
                     createdDate:5, status:6, responsible:7, dueDate:8, notes:9,
                     priority:10, taskName:11, linkedEvent:12, outlookEventId:13,
                     archived:14 };
      return dataRows.map((row, i) => {
        const rec = {
          _row:          i + 2,
          id:            String(row[TCOL.id]          ?? '').trim(),
          taskName:      String(row[TCOL.taskName]     ?? '').trim(),
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
          linkedEvent:   String(row[TCOL.linkedEvent]   ?? '').trim(),
          outlookEventId:String(row[TCOL.outlookEventId]?? '').trim(),
          archived:      String(row[TCOL.archived]       ?? '').trim(),
        };
        return rec;
      }).filter(r => (r.id || r.type) && r.archived !== 'Y');
    },
    // <-- Ensure there is a comma here

    // parseEvents — schema-confirmed from actual Excel file
    // A=id, B=name, C=owner, D=place, E=country, F=mode, G=status, H=industry,
    // I=dateFrom, J=dateTo, K=webLink, L=description, M=audience, N=followup,
    // O=linkedCompanies, P=linkedOpps, Q=linkedContacts, R=createdDate, S=updDate, T=archived
    parseEvents(json) {
      const { dataRows } = parseSheetByLetter(json);
      if (!dataRows || !dataRows.length) return [];
      return dataRows.map((row, i) => ({
        _row:            i + 2,
        id:              String(row[0]  ?? '').trim(),
        name:            String(row[1]  ?? '').trim(),
        owner:           String(row[2]  ?? '').trim(),
        place:           String(row[3]  ?? '').trim(),
        country:         String(row[4]  ?? '').trim(),
        mode:            String(row[5]  ?? '').trim(),
        status:          String(row[6]  ?? '').trim() || 'Watching',
        industry:        String(row[7]  ?? '').trim(),
        dateFrom:        excelDate(String(row[8]  ?? '').trim()),
        dateTo:          excelDate(String(row[9]  ?? '').trim()),
        webLink:         String(row[10] ?? '').trim(),
        description:     String(row[11] ?? '').trim(),
        audience:        String(row[12] ?? '').trim(),
        followup:        String(row[13] ?? '').trim(),
        linkedCompanies: String(row[14] ?? '').trim(),
        linkedOpps:      String(row[15] ?? '').trim(),
        linkedContacts:  String(row[16] ?? '').trim(),
        createdDate:     excelDate(String(row[17] ?? '').trim()),
        updDate:         excelDate(String(row[18] ?? '').trim()),
        archived:        String(row[19] ?? '').trim(),
      })).filter(r => (r.name || r.id) && r.archived !== 'Y');
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
      const COL_FALLBACK = { id:0, name:1, type:2, prio:3, website:4, industry:5, country:6, owner:7, notes:8, createdDate:9, updDate:10, archived:11 };
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
      }).filter(r => (r.name || r.id) && r.archived !== 'Y');
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

    // Archive a record — PATCH the Archived col to "Y"
    async archiveRecord(sheet, rowNum, col) {
      return this.patchRange(sheet, `${col}${rowNum}`, [['Y']]);
    },

    // ── HR Candidates — separate SharePoint file ──────────────────
    async loadHRSheet() {
      const t = await token();
      if (!t) throw new Error('HR: empty access token — try reloading');
      // Request both values AND formulas — formulas needed to extract HYPERLINK("url","text") hrefs
      const url = `https://graph.microsoft.com/v1.0/drives/${HR_CFG.driveId}/items/${HR_CFG.fileId}/workbook/worksheets/${encodeURIComponent(HR_CFG.sheet)}/usedRange?$select=values,formulas`;
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`HR load ${res.status}: ${body?.error?.message || 'unknown'}`);
      }
      return res.json();
    },

    parseHRCandidates(json) {
      const rows     = json?.values   || [];
      const formulas = json?.formulas || [];
      if (rows.length < 2) return [];
      const headers = rows[0].map(h => String(h||'').trim());
      // Build column index map (store globally for save operations)
      DATA_HR_COLS = {};
      headers.forEach((h,i) => { DATA_HR_COLS[h] = i; });
      const g = (row, name) => {
        const i = DATA_HR_COLS[name];
        return i !== undefined ? String(row[i]??'').trim() : '';
      };
      // Extract href from =HYPERLINK("url","text") formula, else use cell value
      const gUrl = (row, fmls, name) => {
        const i = DATA_HR_COLS[name];
        if (i === undefined) return '';
        // Try formula first — handles =HYPERLINK("url","text") with double OR single quotes
        const formula = String(fmls?.[i] ?? '');
        if (formula.toUpperCase().startsWith('=HYPERLINK(')) {
          const m = formula.match(/=HYPERLINK\(["']([^"']+)["']/i);
          if (m && m[1]) return m[1];
        }
        // Cell value may already be the full URL (plain hyperlink, no formula)
        const val = String(row[i] ?? '').trim();
        if (val.startsWith('http')) return val;
        // Some cells store display text with the URL as hyperlink metadata —
        // try stripping any Excel display text (e.g. "CV" or "LinkedIn")
        // If value is a short word and formula has a URL somewhere, extract it
        const urlMatch = formula.match(/https?:\/\/[^\s"')]+/i);
        if (urlMatch) return urlMatch[0];
        return '';
      };
      return rows.slice(1).map((row, i) => {  // i+1 = formula row index
        if (!row.some(v => v !== null && v !== '')) return null;
        const fn = g(row,'Jméno'), ln = g(row,'Příjmení');
        return {
          _row:            i + 2,
          _raw:            [...row],
          id:              g(row,'ID'),
          firstName:       fn,
          lastName:        ln,
          name:            ln && fn ? `${fn} ${ln}` : (fn||ln),
          displayName:     ln && fn ? `${ln} ${fn}` : (fn||ln),  // Surname Name
          role:            g(row,'Role'),
          seniority:       g(row,'Seniorita'),
          status:          g(row,'Status'),
          owner:           g(row,'Odpovědný'),
          competencies:    g(row,'Competencies'),
          rateRequested:   g(row,'Cena požadovaná'),
          rateAgreed:      g(row,'Cena smluvená'),
          proposedProjects:g(row,'Projekty navržené'),
          updatedAt:       g(row,'UpdateDate'),
          linkedin:        gUrl(row, formulas[i+1], 'LI'),
          cv:              gUrl(row, formulas[i+1], 'CV'),
          country:         g(row,'Country'),
          commitment:      g(row,'Úvazek'),
          availableFrom:   g(row,'Nástup'),
          source:          g(row,'Source'),
          hrRole:          g(row,'HR | Role'),
          hrInterviewDate: g(row,'HR | Interview Date'),
          hrKnowhow:       g(row,'HR | Key Know-how'),
          hrMotivation:    g(row,'HR | Motivation'),
          hrExpectations:  g(row,'HR | Expectations'),
          hrSummary:       g(row,'HR | Summary'),
          phone:           g(row,'Telefon'),
          email:           g(row,'Email'),
          dob:             g(row,'DoB'),
          createdAt:       g(row,'CreateDate'),
          notes:           g(row,'Poznámka'),
          oldStatus:       g(row,'Old Status'),
        };
            }).filter(r => r && (r.id || r.name));
    },

    async saveHRStatus(candidate, newStatus) {
      const colIdx = DATA_HR_COLS['Status'];
      if (colIdx === undefined) return false;
      const col = _colLetter(colIdx + 1);
      const url = `https://graph.microsoft.com/v1.0/drives/${HR_CFG.driveId}/items/${HR_CFG.fileId}/workbook/worksheets/${encodeURIComponent(HR_CFG.sheet)}/range(address='${col}${candidate._row}')`;
      const t = await token();
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer '+t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[newStatus]] }),
      });
      return res.ok;
    },

    async saveHRNotes(candidate, newNotes) {
      const colIdx = DATA_HR_COLS['Poznámka'];
      if (colIdx === undefined) return false;
      const col = _colLetter(colIdx + 1);
      const url = `https://graph.microsoft.com/v1.0/drives/${HR_CFG.driveId}/items/${HR_CFG.fileId}/workbook/worksheets/${encodeURIComponent(HR_CFG.sheet)}/range(address='${col}${candidate._row}')`;
      const t = await token();
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer '+t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[newNotes]] }),
      });
      return res.ok;
    },

    async saveHRRow(candidate, fields) {
      const today = new Date().toISOString().slice(0,10);
      const raw   = [...candidate._raw];
      const set   = (name, val) => { const i=DATA_HR_COLS[name]; if(i!==undefined) raw[i]=val; };
      set('Status',          fields.status);
      set('Odpovědný',       fields.owner);
      set('Projekty navržené', fields.proposedProjects);
      if (fields.role         !== undefined) set('Role',             fields.role);
      if (fields.seniority    !== undefined) set('Seniorita',         fields.seniority);
      if (fields.phone        !== undefined) set('Telefon',          fields.phone);
      if (fields.email        !== undefined) set('Email',            fields.email);
      if (fields.competencies !== undefined) set('Competencies',     fields.competencies);
      set('Poznámka',        fields.notes);
      set('UpdateDate',      today);
      const lastCol = _colLetter(raw.length);
      const url = `https://graph.microsoft.com/v1.0/drives/${HR_CFG.driveId}/items/${HR_CFG.fileId}/workbook/worksheets/${encodeURIComponent(HR_CFG.sheet)}/range(address='A${candidate._row}:${lastCol}${candidate._row}')`;
      const t = await token();
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer '+t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [raw] }),
      });
      return res.ok;
    },


    // ── HR Search Tracking Pool ───────────────────────────────────
    async loadPoolSheet() {
      const t = await token();
      if (!t) throw new Error('Pool: empty access token');
      const url = `https://graph.microsoft.com/v1.0/drives/${HR_POOL_CFG.driveId}/items/${HR_POOL_CFG.fileId}/workbook/worksheets/${encodeURIComponent(HR_POOL_CFG.sheet)}/usedRange?$select=values,formulas`;
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Pool load ${res.status}: ${body?.error?.message || 'unknown'}`);
      }
      return res.json();
    },

    parsePoolCandidates(json) {
      const rows     = json?.values   || [];
      const formulas = json?.formulas || [];
      if (rows.length < 2) return [];
      const headers = rows[0].map(h => String(h||'').trim());
      DATA_POOL_COLS = {};
      headers.forEach((h,i) => { DATA_POOL_COLS[h] = i; });
      const g   = (row, name) => { const i=DATA_POOL_COLS[name]; return i!==undefined?String(row[i]??'').trim():''; };
      const gUrl= (row, fmls, name) => {
        const i = DATA_POOL_COLS[name];
        if (i===undefined) return '';
        const formula = String(fmls?.[i]??'');
        if (formula.toUpperCase().startsWith('=HYPERLINK(')) {
          const m = formula.match(/=HYPERLINK\(["']([^"']+)["']/i);
          if (m&&m[1]) return m[1];
        }
        const urlMatch = formula.match(/https?:\/\/[^\s"')]+/i);
        if (urlMatch) return urlMatch[0];
        const val = String(row[i]??'').trim();
        return val.startsWith('http') ? val : '';
      };
      return rows.slice(1).map((row, i) => {
        if (!row.some(v => v!==null && v!=='')) return null;
        const fmls   = formulas[i+1] || [];
        const code   = g(row,'Code');
        const fcId   = g(row,'Candidate FC ID');
        const arch   = g(row,'Archived');
        // Scope filter: Archived=N AND Candidate FC ID blank
        if (arch==='Y' || fcId) return null;
        const fn = g(row,'Name'), ln = g(row,'Surname');
        return {
          _row:       i + 2,
          _source:    'pool',
          _raw:       [...row],
          id:         code || `ST-${i+2}`,
          firstName:  fn,
          lastName:   ln,
          name:       fn&&ln ? `${fn} ${ln}` : (fn||ln),
          displayName:fn&&ln ? `${ln} ${fn}` : (fn||ln),
          role:       g(row,'Role'),
          seniority:  g(row,'Seniority'),
          status:     g(row,'Status') || 'Sourced',
          owner:      g(row,'Owner'),
          linkedin:   gUrl(row, fmls, 'LI Profile'),
          email:      g(row,'Email'),
          phone:      g(row,'Phone'),
          specializace:g(row,'Specializace'),
          activeSearch:g(row,'Active Search'),
          competencies:g(row,'Competencies'),
          hrNote:     g(row,'HR Poznámka'),
          approval5c: g(row,'5C Schválení'),
          note5c:     g(row,'5C Poznámka'),
          result:     g(row,'Výsledek'),
          noteGeneral:g(row,'NOTE'),
          duplicateFlag:g(row,'Duplicate Flag'),
          createdAt:  g(row,'DateCreated'),
          updatedAt:  g(row,'DateUpdated'),
          archived:   arch,
        };
      }).filter(r => r && (r.id || r.name));
    },

    async savePoolRow(candidate, fields) {
      const today = new Date().toISOString().slice(0,10);
      const raw   = [...candidate._raw];
      const set   = (name, val) => {
        if (POOL_READONLY.includes(name)) return; // never write protected cols
        const i = DATA_POOL_COLS[name];
        if (i !== undefined) raw[i] = val;
      };
      set('Surname',      fields.lastName  || candidate.lastName);
      set('Name',         fields.firstName || candidate.firstName);
      set('Role',         fields.role);
      set('Status',       fields.status);
      set('LI Profile',   fields.linkedin  || candidate.linkedin);
      set('Email',        fields.email);
      set('Phone',        fields.phone);
      set('Seniority',    fields.seniority);
      set('Owner',        fields.owner);
      set('Competencies', fields.competencies);
      set('Active Search',fields.activeSearch);
      set('5C Poznámka',  fields.note5c);
      set('Výsledek',     fields.result);
      set('NOTE',         fields.noteGeneral);
      set('Archived',     fields.archived || candidate.archived || 'N');
      set('DateUpdated',  today);
      const lastCol = _colLetter(raw.length);
      const url = `https://graph.microsoft.com/v1.0/drives/${HR_POOL_CFG.driveId}/items/${HR_POOL_CFG.fileId}/workbook/worksheets/${encodeURIComponent(HR_POOL_CFG.sheet)}/range(address='A${candidate._row}:${lastCol}${candidate._row}')`;
      const t = await token();
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer '+t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [raw] }),
      });
      return res.ok;
    },

    async archivePool(candidate) {
      const colIdx = DATA_POOL_COLS['Archived'];
      if (colIdx === undefined) return false;
      const col = _colLetter(colIdx + 1);
      const today = new Date().toISOString().slice(0,10);
      const t = await token();
      // Archive + update DateUpdated
      const updIdx = DATA_POOL_COLS['DateUpdated'];
      const prom1 = fetch(
        `https://graph.microsoft.com/v1.0/drives/${HR_POOL_CFG.driveId}/items/${HR_POOL_CFG.fileId}/workbook/worksheets/${encodeURIComponent(HR_POOL_CFG.sheet)}/range(address='${col}${candidate._row}')`,
        { method:'PATCH', headers:{ Authorization:'Bearer '+t,'Content-Type':'application/json' }, body: JSON.stringify({values:[['Y']]}) }
      );
      return (await prom1).ok;
    },


    // ── Sourcing log — read/write to Sourcing sheet ────────────────
    // Schema: RunID|RunDate|OppKey|OppLabel|Competencies|JD|
    //         CandidateID|CandidateName|Role|Seniority|CandStatus|Score|Reason|Source
    async loadSourcingLog() {
      const t = await token();
      if (!t) return { values: [] };
      const sheet = encodeURIComponent(activeCfg.sheets.sourcing || 'Sourcing');
      const url = `https://graph.microsoft.com/v1.0/drives/${activeCfg.driveId}/items/${activeCfg.fileId}/workbook/worksheets/${sheet}/usedRange?$select=values`;
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
      if (!res.ok) return { values: [] };
      return res.json();
    },

    parseSourcingLog(json) {
      const rows = json?.values || [];
      if (rows.length < 2) return [];
      // Group rows by RunID (col A)
      const runs = {};
      rows.slice(1).forEach(row => {
        if (!row[0]) return;
        const runId = String(row[0]);
        if (!runs[runId]) {
          runs[runId] = {
            id:           runId,
            runDate:      String(row[1]||''),
            oppKey:       String(row[2]||''),
            oppLabel:     String(row[3]||''),
            competencies: String(row[4]||'').split(',').map(c=>c.trim()).filter(Boolean),
            jd:           String(row[5]||''),
            results:      [],
          };
        }
        if (row[6]) {  // CandidateID present
          runs[runId].results.push({
            candidateId:  String(row[6]||''),
            name:         String(row[7]||''),
            displayName:  String(row[7]||''),
            role:         String(row[8]||''),
            seniority:    String(row[9]||''),
            status:       String(row[10]||''),
            score:        parseInt(row[11]||'0')||0,
            reason:       String(row[12]||''),
            source:       String(row[13]||'hr'),
          });
        }
      });
      return Object.values(runs).sort((a,b) => b.id.localeCompare(a.id));
    },

    async saveSourcingRun(run) {
      const t = await token();
      if (!t) return false;
      const sheet = encodeURIComponent(activeCfg.sheets.sourcing || 'Sourcing');
      const driveId = activeCfg.driveId;
      const fileId  = activeCfg.fileId;
      const base    = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/worksheets/${sheet}`;

      // Check if sheet is empty — if so write header row first
      const checkRes = await fetch(`${base}/range(address='A1')?$select=values`, { headers: { Authorization: 'Bearer '+t } });
      const checkData = await checkRes.json().catch(()=>({}));
      const a1 = checkData?.values?.[0]?.[0];
      if (!a1) {
        await fetch(`${base}/range(address='A1:N1')`, {
          method: 'PATCH',
          headers: { Authorization: 'Bearer '+t, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [['RunID','RunDate','OppKey','OppLabel','Competencies','JD','CandidateID','CandidateName','Role','Seniority','CandStatus','Score','Reason','Source']] }),
        });
      }

      // Find next empty row
      const usedRes = await fetch(`${base}/usedRange?$select=rowCount`, { headers: { Authorization: 'Bearer '+t } });
      const usedData = await usedRes.json().catch(()=>({}));
      let nextRow = (usedData?.rowCount || 1) + 1;

      // Write one row per result
      const compsStr = (run.competencies||[]).join(',');
      const rows = (run.results||[]).map(r => [
        run.id, run.runDate, run.oppKey||'', run.oppLabel||'',
        compsStr, run.jd||'',
        r.candidateId||'', r.displayName||r.name||'', r.role||'', r.seniority||'',
        r.status||'', r.score||0, r.reason||'', r.source||'hr',
      ]);
      if (!rows.length) return true;

      const lastRow = nextRow + rows.length - 1;
      const res = await fetch(`${base}/range(address='A${nextRow}:N${lastRow}')`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer '+t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows }),
      });
      return res.ok;
    },

    // Archive a Task — col O = Archived
    async archiveTask(row) {
      return this.patchRange(CFG.microsoft.sheets.tasks, `O${row._row}`, [['Y']]);
    },

    // ── MessageLinks sheet — Teams messages bridge ─────────────────
    // Schema rev 31/32: 12 cols A–L, read-only from BD dashboard
    // Col map: A=id, B=msgId, C=parentId, D=channel, E=author, F=ts,
    //          G=recordType, H=recordId, I=confidence, J=snippet, K=webUrl, L=archived
    async loadMessageLinks() {
      try {
        const sheet = encodeURIComponent(activeCfg.sheets.messageLinks || 'MessageLinks');
        const url = `https://graph.microsoft.com/v1.0/drives/${activeCfg.driveId}/items/${activeCfg.fileId}/workbook/worksheets/${sheet}/usedRange?$select=values`;
        const t = await token();
        if (!t) { console.warn('ML-Pipeline: no token'); return { values: [] }; }
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
        console.log(`ML-Pipeline: HTTP ${res.status}`);
        if (!res.ok) { const txt = await res.text().catch(()=>''); console.warn('ML-Pipeline err:', txt.slice(0,200)); return { values: [] }; }
        const j = await res.json();
        console.log(`ML-Pipeline: ${(j.values||[]).length} rows`);
        return j;
      } catch(e) { console.warn('ML-Pipeline error:', e.message); return { values: [] }; }
    },

    // HR_Candidates.xlsx also has its own MessageLinks sheet
    async loadHRMessageLinks() {
      try {
        const sheet = encodeURIComponent('MessageLinks');
        const url = `https://graph.microsoft.com/v1.0/drives/${HR_CFG.driveId}/items/${HR_CFG.fileId}/workbook/worksheets/${sheet}/usedRange?$select=values`;
        const t = await token();
        if (!t) { console.warn('ML-HR: no token'); return { values: [] }; }
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
        console.log(`ML-HR: HTTP ${res.status}`);
        if (!res.ok) { const txt = await res.text().catch(()=>''); console.warn('ML-HR err:', txt.slice(0,200)); return { values: [] }; }
        const j = await res.json();
        console.log(`ML-HR: ${(j.values||[]).length} rows`);
        return j;
      } catch(e) { console.warn('ML-HR error:', e.message); return { values: [] }; }
    },

    parseMessageLinks(json) {
      const { headers, dataRows } = parseSheetByLetter(json);
      if (!headers.length) return [];
      console.log('ML-parse headers:', headers.join(' | '));
      console.log(`ML-parse: ${dataRows.length} data rows`);
      const h = (name) => headers.findIndex(v => v.toLowerCase() === name.toLowerCase());
      const iId       = h('Link ID');
      const iMsgId    = h('Message ID');
      const iParent   = h('Parent Message ID');
      const iChannel  = h('Channel');
      const iAuthor   = h('Author');
      const iTs       = h('Timestamp');
      const iRecType  = h('Record Type');
      const iRecId    = h('Record ID');
      const iConf     = h('Confidence');
      const iSnippet  = h('Body Snippet');
      const iUrl      = h('Web URL');
      const iArch     = h('Archived');
      const g = (row, idx) => idx >= 0 ? String(row[idx] ?? '').trim() : '';
      return dataRows.map(r => ({
        id:         g(r, iId),
        msgId:      g(r, iMsgId),
        parentId:   g(r, iParent),
        channel:    g(r, iChannel),
        author:     g(r, iAuthor),
        ts:         g(r, iTs),
        recordType: g(r, iRecType),
        recordId:   g(r, iRecId),
        confidence: g(r, iConf),
        snippet:    g(r, iSnippet),
        webUrl:     g(r, iUrl),
        archived:   g(r, iArch),
      })).filter(r => r.recordId && r.archived !== 'Y');
      const sample = result.slice(0,5).map(r=>`${r.recordId}(${r.recordType})`).join(', ');
      console.log(`ML-parse result: ${result.length} active rows. Sample IDs: ${sample}`);
      return result;
    },

    // ── Outlook Task (To-Do) integration ────────────────────────
    // Requires Tasks.ReadWrite delegated permission (NOT Calendars)
    // Creates a task in Outlook/To-Do with due date + reminder — no time slot blocked
    // Stores "listId||taskId" in col N so we can update/complete later
    async _getDefaultTaskListId() {
      try {
        const t   = await token();
        const res = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', {
          headers: { Authorization: 'Bearer ' + t }
        });
        if (!res.ok) return null;
        const data = await res.json();
        const def  = (data.value || []).find(l => l.wellknownListName === 'defaultList') || data.value?.[0];
        return def?.id || null;
      } catch { return null; }
    },

    async createCalendarEvent(task) {
      try {
        const t      = await token();
        const listId = await this._getDefaultTaskListId();
        if (!listId) return null;
        const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
        const title = `📋 ${task.taskName || task.type || 'Task'}`
          + (task.linkedOpp ? ` · ${task.linkedOpp}` : '')
          + (task.linkedCompany ? ` [${task.linkedCompany}]` : '');
        const bodyText = [
          task.taskName || task.type,
          task.linkedOpp    ? `Opportunity: ${task.linkedOpp}`  : '',
          task.linkedCompany? `Company: ${task.linkedCompany}` : '',
          task.linkedContact? `Contact: ${task.linkedContact}` : '',
          task.notes        ? `Notes: ${task.notes}` : '',
          'Open 5C Dashboard: https://fivecrafts.github.io/5C_Dashboard/',
        ].filter(Boolean).join('\n');
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
          {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              body:          { content: bodyText, contentType: 'text' },
              dueDateTime:   task.dueDate ? { dateTime: task.dueDate + 'T09:00:00.000Z', timeZone: 'UTC' } : undefined,
              reminderDateTime: task.dueDate ? { dateTime: task.dueDate + 'T09:00:00.000Z', timeZone: 'UTC' } : undefined,
              isReminderOn:  true,
              importance:    task.priority === 'Critical' || task.priority === 'High' ? 'high' : 'normal',
            }),
          }
        );
        if (!res.ok) return null;
        const created = await res.json();
        // Store as "listId||taskId" for later updates
        return created.id ? `${listId}||${created.id}` : null;
      } catch { return null; }
    },

    async updateCalendarEvent(compositeId, newDate) {
      if (!compositeId || !newDate) return false;
      try {
        const [listId, taskId] = compositeId.split('||');
        if (!listId || !taskId) return false;
        const t   = await token();
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
          {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dueDateTime:      { dateTime: newDate + 'T09:00:00.000Z', timeZone: 'UTC' },
              reminderDateTime: { dateTime: newDate + 'T09:00:00.000Z', timeZone: 'UTC' },
            }),
          }
        );
        return res.ok;
      } catch { return false; }
    },

    async savePriorityOnly(row, newP) {
      // Rev 22: Priority=F, Updated Date=H
      const s     = CFG.microsoft.sheets.pipeline;
      const today = new Date().toISOString().slice(0, 10);
      const r1 = await this.patchRange(s, `F${row._row}`, [[newP]]);
      await this.patchRange(s, `H${row._row}`, [[today]]).catch(() => {});
      return r1;
    },

    // Fetch M365 profile photo for a user by email
    // Returns an object URL (blob) or null if unavailable
    // Requires User.ReadBasic.All delegated permission
    async loadOwnerPhoto(email) {
      if (!email) return null;
      try {
        const t = await token();
        const r = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photo/$value`,
          { headers: { Authorization: 'Bearer ' + t } }
        );
        if (!r.ok) return null;
        const blob = await r.blob();
        return URL.createObjectURL(blob);
      } catch { return null; }
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
      // Safe ID: find the highest existing C-NNN, increment from there
      const maxN = DATA_CONTACTS.reduce((m, c) => {
        const n = parseInt((c.id || '').replace('C-', ''), 10);
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      const newId = `C-${String(maxN + 1).padStart(3, '0')}`;
      return this.appendRow(s, [[newId, fields.firstName, fields.lastName,
        fields.email, fields.phone, fields.web, fields.company,
        fields.linkedOpps || '', fields.src || 'Manual user input', today, today,
        fields.coId || '']]);
    },

    async saveTaskRow(row, fields) {
      // Rev 19+: 12 cols A:L, taskName at col L (index 11)
      return this.patchRange(CFG.microsoft.sheets.tasks, `A${row._row}:N${row._row}`,
        [[row.id, fields.type, fields.linkedOpp, fields.linkedContact,
          fields.linkedCompany || '',
          row.createdDate, fields.status, fields.responsible,
          fields.dueDate, fields.notes, fields.priority,
          fields.taskName || '', row.linkedEvent || '',
          fields.outlookEventId || row.outlookEventId || '']]
      );
    },

    async createTask(fields) {
      const s     = CFG.microsoft.sheets.tasks;
      const today = new Date().toISOString().slice(0, 10);
      const maxTN = DATA_TASKS.reduce((m,t) => {
        const n = parseInt((t.id||'').replace('T-',''),10);
        return isNaN(n)?m:Math.max(m,n);
      }, 0);
      const newId = `T-${String(maxTN + 1).padStart(3, '0')}`;
      return this.appendRow(s, [[newId, fields.type, fields.linkedOpp || '',
        fields.linkedContact || '', fields.linkedCompany || '',
        today, fields.status || 'Open',
        fields.responsible || '', fields.dueDate || '',
        fields.notes || '', fields.priority || 'Medium',
        fields.taskName || '', '', fields.outlookEventId || '']]);
    },

    // ── Events write methods ───────────────────────────────────────
    // Column order: A=id,B=name,C=industry,D=country,E=place,F=status,G=mode,
    // H=dateFrom,I=owner,J=dateTo,K=webLink,...,S=updDate,T=archived
    async saveEventStatus(ev, newS) {
      const today = new Date().toISOString().slice(0,10);
      const s  = CFG.microsoft.sheets.events;
      const ok = await this.patchRange(s, `G${ev._row}`, [[newS]]);  // G = STATUS (index 6)
      if (ok) await this.patchRange(s, `S${ev._row}`, [[today]]).catch(()=>{});
      return ok;
    },

    async saveEventRow(ev, fields) {
      const today = new Date().toISOString().slice(0,10);
      const s     = CFG.microsoft.sheets.events;
      // Column order: A=id,B=name,C=owner,D=place,E=country,F=mode,G=status,H=industry,
      // I=dateFrom,J=dateTo,K=webLink,L=description,M=audience,N=followup,
      // O=linkedCompanies,P=linkedOpps,Q=linkedContacts,R=createdDate,S=updDate,T=archived
      return this.patchRange(s, `A${ev._row}:T${ev._row}`, [[
        ev.id,
        fields.name, fields.owner||'', fields.place||'', fields.country||'',
        fields.mode||'', fields.status||'Watching', fields.industry||'',
        fields.dateFrom||'', fields.dateTo||'', fields.webLink||'', fields.description||'',
        fields.audience||'', fields.followup||'',
        fields.linkedCompanies||'', fields.linkedOpps||'', fields.linkedContacts||'',
        ev.createdDate || today, today, ''
      ]]);
    },

    async createEvent(fields) {
      const s     = CFG.microsoft.sheets.events;
      const today = new Date().toISOString().slice(0,10);
      const maxEN = (DATA_EVENTS||[]).reduce((m,e)=>{
        const n=parseInt((e.id||'').replace('E-',''),10);
        return isNaN(n)?m:Math.max(m,n);
      },0);
      const newId = `E-${String(maxEN+1).padStart(3,'0')}`;
      return this.appendRow(s, [[
        newId, fields.name, fields.owner||'', fields.place||'', fields.country||'',
        fields.mode||'', fields.status||'Watching', fields.industry||'',
        fields.dateFrom||'', fields.dateTo||'', fields.webLink||'', fields.description||'',
        fields.audience||'', fields.followup||'',
        fields.linkedCompanies||'', fields.linkedOpps||'', fields.linkedContacts||'',
        today, today, ''
      ]]);
    },

    async archiveEvent(ev) {
      return this.patchRange(CFG.microsoft.sheets.events, `T${ev._row}`, [['Y']]);
    },
  };
})();

// ── GOOGLE (stub — same interface, ready for migration) ──────────
// ── Column letter helper (1→A, 26→Z, 27→AA, 32→AF) ──────────────
function _colLetter(n) {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65+(n%26))+s; n = Math.floor(n/26); }
  return s;
}

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
    async loadOwnerPhoto(email)     { return null; }, // Google provider — not implemented
    async createCalendarEvent(task) { return null; }, // Google provider — not implemented
    parseEvents(j)         { return MsProvider.parseEvents.call(this, j); },
    async saveEventStatus(e,s){ return false; },
    async saveEventRow(e,f)  { return false; },
    async createEvent(f)     { return false; },
    async archiveEvent(e)    { return false; },
    async archiveTask(row)   { return false; },
    async loadPoolSheet()    { return { values:[] }; },
    parsePoolCandidates(j)  { return MsProvider.parsePoolCandidates.call(this, j); },
    async savePoolRow(c,f)   { return false; },
    async archivePool(c)     { return false; },
    async loadSourcingLog()  { return { values:[] }; },
    parseSourcingLog(j)      { return MsProvider.parseSourcingLog(j); },
    async saveSourcingRun(r) { return false; },
    async loadMessageLinks() { return { values:[] }; },
    parseMessageLinks(j)     { return MsProvider.parseMessageLinks(j); },
    async loadHRMessageLinks() { return { values:[] }; },
    async loadHRSheet()      { return { values: [] }; },
    parseHRCandidates(j)    { return MsProvider.parseHRCandidates.call(this, j); },
    async saveHRStatus(c,s) { return false; },
    async saveHRNotes(c,n)  { return false; },
    async saveHRRow(c,f)    { return false; },
    async updateCalendarEvent(id, d){ return false; },
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
