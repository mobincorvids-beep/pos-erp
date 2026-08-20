import { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatMoney, formatQty } from '../lib/format';

export function PosPage() {
  const { company } = useAuth();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // [{ productId, variantId, name, unitPrice, quantity, taxRate }]
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [context, setContext] = useState(() => {
    try {
      const stored = localStorage.getItem('pos_erp_checkout_context');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }); // { warehouseId, branchId, posTerminalId, cashAccountId }
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/products').then(setProducts).catch((err) => setError(err.message)).finally(() => setLoadingProducts(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.includes(q));
  }, [products, search]);

  function addToCart(product) {
    const variant = product.variants?.[0];
    if (!variant) {
      toast('This product has no sellable variant configured.', 'error');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((line) => line.variantId === variant._id);
      if (existing) {
        return prev.map((line) => line.variantId === variant._id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...prev, {
        productId: product._id, variantId: variant._id, name: product.name,
        unitPrice: variant.sellingPrice ?? product.sellingPrice, quantity: 1, taxRate: 0,
      }];
    });
  }

  function updateQty(variantId, quantity) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((line) => line.variantId !== variantId));
      return;
    }
    setCart((prev) => prev.map((line) => line.variantId === variantId ? { ...line, quantity } : line));
  }

  function removeLine(variantId) {
    setCart((prev) => prev.filter((line) => line.variantId !== variantId));
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxTotal = cart.reduce((sum, l) => sum + (l.unitPrice * l.quantity) * (l.taxRate / 100), 0);
  const total = subtotal + taxTotal;

  async function handleCheckout() {
    if (cart.length === 0) return;
    if (!context?.warehouseId || !context?.cashAccountId) {
      toast('Set warehouse and payment account in Setup before checking out (see below).', 'error');
      return;
    }
    setCheckingOut(true);
    setError('');
    try {
      const sale = await api.post('/sales/checkout', {
        branchId: context.branchId,
        warehouseId: context.warehouseId,
        posTerminalId: context.posTerminalId || undefined,
        items: cart.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate })),
        payments: [{ paymentAccountId: context.cashAccountId, method: paymentMethod, amount: total }],
      });
      toast(`Sale ${sale.invoiceNumber} completed — ${formatMoney(sale.totalAmount, company?.currency)}`, 'success');
      setCart([]);
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[calc(100vh-3rem)]">
      {/* Product grid */}
      <div className="flex-1 min-w-0 flex flex-col">
        <p className="page-title mb-3">Checkout</p>
        <input
          type="text" placeholder="Search by name, SKU, or scan barcode…" autoFocus
          className="field-input mb-4"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <SetupBar context={context} setContext={setContext} />

        {loadingProducts ? (
          <p className="text-sm text-ink-muted mt-6">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-muted mt-6">No products match "{search}".</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:overflow-y-auto pr-1 mt-4">
            {filtered.map((product) => (
              <button
                key={product._id}
                onClick={() => addToCart(product)}
                className="card p-3 text-left hover:border-accent transition-colors"
              >
                <p className="text-sm font-medium text-ink truncate">{product.name}</p>
                <p className="text-xs text-ink-muted mt-0.5">{product.sku || '—'}</p>
                <p className="num text-sm text-accent-strong mt-2">{formatMoney(product.sellingPrice, company?.currency)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Receipt-style ticket — full width and in normal flow on small
          screens (stacked below the product grid); a fixed-width side
          panel from the lg breakpoint up, where there's room for both side by side. */}
      <div className="w-full lg:w-96 shrink-0 card p-4 flex flex-col">
        <p className="font-display text-lg mb-3">Current ticket</p>

        {cart.length === 0 ? (
          <p className="text-sm text-ink-muted flex-1 flex items-center justify-center text-center">
            Tap a product to add it to the ticket.
          </p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {cart.map((line) => (
              <div key={line.variantId} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{line.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <button className="btn-ghost !px-1.5 !py-0" onClick={() => updateQty(line.variantId, line.quantity - 1)}>−</button>
                    <span className="num w-6 text-center">{formatQty(line.quantity)}</span>
                    <button className="btn-ghost !px-1.5 !py-0" onClick={() => updateQty(line.variantId, line.quantity + 1)}>+</button>
                    <button className="text-xs text-danger ml-2" onClick={() => removeLine(line.variantId)}>Remove</button>
                  </div>
                </div>
                <p className="num text-right shrink-0">{formatMoney(line.unitPrice * line.quantity, company?.currency)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="tear-line my-3" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span className="num">{formatMoney(subtotal, company?.currency)}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">Tax</span><span className="num">{formatMoney(taxTotal, company?.currency)}</span></div>
          <div className="flex justify-between text-base font-medium mt-1"><span>Total</span><span className="num">{formatMoney(total, company?.currency)}</span></div>
        </div>

        <div className="mt-3">
          <label className="field-label">Payment method</label>
          <select className="field-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>

        {error && <p className="text-sm text-danger mt-2">{error}</p>}

        <button
          className="btn-primary w-full mt-3 !py-2.5 text-base"
          disabled={cart.length === 0 || checkingOut}
          onClick={handleCheckout}
        >
          {checkingOut ? 'Processing…' : `Charge ${formatMoney(total, company?.currency)}`}
        </button>
      </div>
    </div>
  );
}

/** One-time checkout setup — branch/warehouse/terminal/cash-account, picked from real data via dropdowns (not pasted IDs), persisted to localStorage so it's set once per browser. */
function SetupBar({ context, setContext }) {
  const [open, setOpen] = useState(!context);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [branchId, setBranchId] = useState(context?.branchId || '');
  const [warehouseId, setWarehouseId] = useState(context?.warehouseId || '');
  const [posTerminalId, setPosTerminalId] = useState(context?.posTerminalId || '');
  const [cashAccountId, setCashAccountId] = useState(context?.cashAccountId || '');

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!branchId) { setWarehouses([]); setTerminals([]); return; }
    api.get(`/org/warehouses?branchId=${branchId}`).then(setWarehouses).catch(() => {});
    api.get(`/org/pos-terminals?branchId=${branchId}`).then(setTerminals).catch(() => {});
  }, [branchId]);

  if (!open) {
    return (
      <button className="text-xs text-ink-muted hover:text-accent mb-2 self-start" onClick={() => setOpen(true)}>
        Change checkout setup
      </button>
    );
  }

  function save() {
    const next = { branchId, warehouseId, posTerminalId, cashAccountId };
    localStorage.setItem('pos_erp_checkout_context', JSON.stringify(next));
    setContext(next);
    setOpen(false);
  }

  return (
    <div className="card p-3 mb-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <div>
        <label className="field-label">Branch</label>
        <select className="field-input !text-xs" value={branchId} onChange={(e) => { setBranchId(e.target.value); setWarehouseId(''); setPosTerminalId(''); }}>
          <option value="">Select…</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">Warehouse</label>
        <select className="field-input !text-xs" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
          <option value="">Select…</option>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">Terminal (optional)</label>
        <select className="field-input !text-xs" value={posTerminalId} onChange={(e) => setPosTerminalId(e.target.value)} disabled={!branchId}>
          <option value="">None</option>
          {terminals.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">Cash/payment account</label>
        <select className="field-input !text-xs" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
          <option value="">Select…</option>
          {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
      </div>
      <div className="col-span-4">
        <button className="btn-secondary !text-xs" onClick={save} disabled={!branchId || !warehouseId || !cashAccountId}>
          Save
        </button>
      </div>
    </div>
  );
}
