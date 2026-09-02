/**
 * Minimal RFC4180-ish CSV tokenizer: handles quoted fields, escaped quotes
 * ("") and commas/newlines inside quotes. Good enough for a spreadsheet
 * export without pulling in a dependency. (Mirrors the parser already used
 * for the product CSV import — kept as a separate small copy here rather
 * than shared, to avoid touching that unrelated module.)
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Normalize line endings and strip a UTF-8 BOM if Excel added one.
  const input = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  // Flush the last field/row (files not ending in a trailing newline).
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (nonEmpty.length === 0) return { headers: [], records: [] };

  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  const records = nonEmpty.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
  return { headers, records };
}

module.exports = { parseCsv };
