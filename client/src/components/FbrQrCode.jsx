import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/**
 * Renders the QR code FBR's Digital Invoicing API returns on a submitted
 * invoice (Sale.fbrQrCode) — required on the printed/PDF receipt and shown
 * on the Sale detail view so a cashier/customer can visually confirm the
 * invoice was actually filed. Renders nothing when there's no code yet
 * (not submitted, or submission failed).
 */
export function FbrQrCode({ value, size = 120, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }, (err) => {
      if (err) console.error('Failed to render FBR QR code:', err.message);
    });
  }, [value, size]);

  if (!value) return null;
  return <canvas ref={canvasRef} width={size} height={size} className={className} aria-label="FBR invoice QR code" />;
}

/**
 * Opens a small printable window for the invoice (receipt), including the
 * FBR QR code as a data URL image (canvas-rendered QR codes don't survive
 * a fresh `window.open` document, so this renders straight to a data URL
 * instead of reusing the <canvas> component above).
 */
export async function printInvoice({ sale, company, t }) {
  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) return;

  let qrImg = '';
  if (sale.fbrQrCode) {
    try {
      const dataUrl = await QRCode.toDataURL(sale.fbrQrCode, { width: 140, margin: 1 });
      qrImg = `<img src="${dataUrl}" width="140" height="140" alt="FBR QR code" />`;
    } catch {
      // No QR on the printout if it fails to render — the rest of the receipt still matters.
    }
  }

  const rows = sale.items.map((item) => `
    <tr>
      <td>${item.quantity} x ${item.unitPrice.toFixed(2)}</td>
      <td style="text-align:right">${item.lineTotal.toFixed(2)}</td>
    </tr>
  `).join('');

  win.document.write(`
    <html>
      <head>
        <title>${sale.invoiceNumber || sale.documentNumber}</title>
        <style>
          body { font-family: monospace; font-size: 12px; padding: 16px; color: #111; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .center { text-align: center; }
          .total { font-weight: bold; font-size: 14px; border-top: 1px dashed #999; padding-top: 6px; margin-top: 6px; }
        </style>
      </head>
      <body>
        <h3 class="center">${company?.name || ''}</h3>
        <p class="center">${sale.invoiceNumber || sale.documentNumber}</p>
        <table>${rows}</table>
        <div class="total" style="display:flex;justify-content:space-between">
          <span>${t ? t('salesHistory.total') : 'Total'}</span>
          <span>${sale.totalAmount.toFixed(2)}</span>
        </div>
        ${qrImg ? `<div class="center" style="margin-top:12px">${qrImg}<p>${sale.fbrInvoiceNumber ? `FBR #${sale.fbrInvoiceNumber}` : ''}</p></div>` : ''}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
