/** Formatting helpers — kept in one place so every screen renders money/dates identically. */

export function formatMoney(amount, currency = 'PKR') {
  const n = Number(amount || 0);
  const formatted = n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
}

export function formatQty(qty) {
  const n = Number(qty || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-PK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function toDateInputValue(date) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}
