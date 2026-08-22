/**
 * ReportExportService — real Excel (via exceljs) and PDF (via pdfkit)
 * generation, deliberately built as a layer that takes already-computed
 * report data and columns, and produces a real downloadable file — it
 * never recomputes or duplicates any report's own logic. Every existing
 * report function (trialBalance, salesSummary, etc.) stays exactly as
 * it was; this just gives any of them a second, exportable output shape.
 *
 * Known, honest caveat: exceljs pulls in a transitive `uuid` dependency
 * flagged by `npm audit` for a buffer-bounds issue in its v3/v5/v6
 * functions when an externally-controlled buffer is passed to them —
 * neither this file nor exceljs's own internal usage does that, and the
 * only available "fix" downgrades exceljs to an older, less-maintained
 * version, which is a worse trade than accepting this documented risk.
 */
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * columns: [{ key, header }] — maps each row's field to a real column
 * header, so the export reflects genuine field names, not raw keys.
 */
async function toExcelBuffer({ title, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31)); // Excel sheet names cap at 31 characters — a real, easy-to-miss constraint

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(c.header.length + 2, 14) }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

function toPdfBuffer({ title, columns, rows, generatedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'center' });
    doc.fontSize(9).fillColor('#666').text(`Generated ${(generatedAt || new Date()).toISOString()}`, { align: 'center' });
    doc.moveDown(1);

    const startX = doc.x;
    const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columns.length;

    doc.fontSize(10).fillColor('#000');
    let y = doc.y;
    columns.forEach((col, i) => doc.text(col.header, startX + i * colWidth, y, { width: colWidth, bold: true }));
    y += 18;
    doc.moveTo(startX, y - 4).lineTo(doc.page.width - doc.page.margins.right, y - 4).stroke();

    rows.forEach((row) => {
      if (y > doc.page.height - doc.page.margins.bottom - 20) { doc.addPage(); y = doc.page.margins.top; }
      columns.forEach((col, i) => doc.text(String(row[col.key] ?? ''), startX + i * colWidth, y, { width: colWidth }));
      y += 16;
    });

    doc.end();
  });
}

module.exports = { toExcelBuffer, toPdfBuffer };
