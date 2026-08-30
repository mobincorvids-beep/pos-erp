import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatMoney, formatQty } from '../lib/format';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

export function PosPage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cart, setCart] = useState([]); // [{ productId, variantId, name, unitPrice, quantity, taxRate }]
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [gatewayPhone, setGatewayPhone] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState(null); // null | 'waiting' | 'failed'
  const isGatewayMethod = paymentMethod === 'jazzcash' || paymentMethod === 'easypaisa';
  const isGiftCardMethod = paymentMethod === 'gift_card';
  const [giftCardNumber, setGiftCardNumber] = useState('');
  const [giftCardLookup, setGiftCardLookup] = useState(null); // null | { balance, usable, reason }
  const [giftCardChecking, setGiftCardChecking] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null); // null | { coupon, discountAmount } | { error }
  const [couponChecking, setCouponChecking] = useState(false);
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

  // A coupon's discount amount is a snapshot of the cart total at the
  // moment it was applied — if the cart changes afterward the preview is
  // stale, so drop it rather than charge the wrong amount (checkout
  // re-validates server-side regardless, but the displayed total should
  // never lie to the cashier).
  useEffect(() => {
    if (couponResult) setCouponResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.includes(q));
  }, [products, search]);

  function addToCart(product) {
    const variant = product.variants?.[0];
    if (!variant) {
      toast(t('pos.noSellableVariant'), 'error');
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

  // Reuses the exact same lookup a typed/keyboard-wedge barcode already
  // goes through (products loaded once into local state, matched by
  // product.barcode or a variant's own barcode) — the camera scanner is
  // just another way to produce the code string, never a second lookup path.
  function handleScannedBarcode(code) {
    setScannerOpen(false);
    const match = products.find(
      (p) => p.barcode === code || p.variants?.some((v) => v.barcode === code)
    );
    if (!match) {
      toast(t('pos.noProductsMatch', { query: code }), 'error');
      return;
    }
    addToCart(match);
    toast(match.name, 'success');
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

  function clearCart() {
    setCart([]);
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxTotal = cart.reduce((sum, l) => sum + (l.unitPrice * l.quantity) * (l.taxRate / 100), 0);
  const preCouponTotal = subtotal + taxTotal;
  const couponDiscount = couponResult?.discountAmount || 0;
  const total = Math.max(preCouponTotal - couponDiscount, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  /** Previews a coupon code against the current cart total — mirrors checkGiftCard()'s "look up before committing" shape. Re-validated server-side again at actual checkout, so this is purely a cashier-facing preview. */
  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    try {
      const result = await api.post('/coupons/validate', { code: couponCode.toUpperCase().trim(), purchaseAmount: preCouponTotal });
      setCouponResult(result);
    } catch (err) {
      setCouponResult(null);
      toast(err.message, 'error');
    } finally {
      setCouponChecking(false);
    }
  }

  function removeCoupon() {
    setCouponCode('');
    setCouponResult(null);
  }

  // Quick cash suggestions: round the total up to the nearest note-sized
  // amounts, deduped, so cashiers can hand-key a tender without a keypad —
  // the reference screen shows fixed round numbers, ours derive from the total.
  const quickCashAmounts = useMemo(() => {
    if (total <= 0) return [];
    const round50 = Math.ceil(total / 50) * 50;
    const round100 = Math.ceil(total / 100) * 100;
    const amounts = [...new Set([round50, round100 === round50 ? round100 + 100 : round100])];
    return amounts.slice(0, 2);
  }, [total]);

  async function finalizeSale() {
    const sale = await api.post('/sales/checkout', {
      branchId: context.branchId,
      warehouseId: context.warehouseId,
      posTerminalId: context.posTerminalId || undefined,
      items: cart.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate })),
      payments: [{ paymentAccountId: context.cashAccountId, method: paymentMethod, amount: total }],
      couponCode: couponResult ? couponCode.toUpperCase().trim() : undefined,
    });

    // Gift card is redeemed AFTER the sale exists, so the redemption's
    // GiftCardTransaction can record a real saleId — same "create the real
    // record first, then link the side-effect to it" order checkout
    // already uses for inventory movements/serials above.
    if (isGiftCardMethod) {
      await api.post(`/gift-cards/${giftCardNumber.toUpperCase().trim()}/redeem`, { amount: total, saleId: sale._id });
    }

    toast(t('pos.saleCompleted', { invoiceNumber: sale.invoiceNumber, amount: formatMoney(sale.totalAmount, company?.currency) }), 'success');
    setCart([]);
    setGatewayStatus(null);
    setGatewayPhone('');
    setGiftCardNumber('');
    setGiftCardLookup(null);
    setCouponCode('');
    setCouponResult(null);
  }

  /** Checks a gift card's balance/usability before charging it — same idea as the JazzCash/Easypaisa flow confirming before it commits, just synchronous instead of polled. */
  async function checkGiftCard() {
    if (!giftCardNumber.trim()) return;
    setGiftCardChecking(true);
    try {
      const result = await api.get(`/gift-cards/${giftCardNumber.toUpperCase().trim()}/lookup`);
      setGiftCardLookup(result);
      if (!result.usable) toast(result.reason || t('pos.giftCardCannotBeUsed'), 'error');
    } catch (err) {
      setGiftCardLookup({ usable: false, reason: err.message, balance: 0 });
      toast(err.message, 'error');
    } finally {
      setGiftCardChecking(false);
    }
  }

  /** Waits for a mobile-wallet transaction to resolve, polling every 3s, and finalizes the sale once it's completed — same ledger-posting flow cash/card checkout already uses. */
  async function waitForGatewayPayment(transactionId) {
    const POLL_MS = 3000;
    const MAX_ATTEMPTS = 40; // ~2 minutes — long enough for a customer to approve on their phone, not indefinite
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      let status;
      try {
        status = await api.get(`/payment-gateway/transactions/${transactionId}`);
      } catch (err) {
        continue; // a transient network hiccup on one poll shouldn't abort the whole wait
      }
      if (status.status === 'completed') {
        await finalizeSale();
        return;
      }
      if (status.status === 'failed') {
        setGatewayStatus('failed');
        toast(status.responseMessage || t('pos.gatewayNotCompleted'), 'error');
        return;
      }
    }
    setGatewayStatus('failed');
    toast(t('pos.gatewayTimeout'), 'error');
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    if (!context?.warehouseId || !context?.cashAccountId) {
      toast(t('pos.setupBeforeCheckout'), 'error');
      return;
    }
    if (isGatewayMethod && !/^03\d{9}$/.test(gatewayPhone)) {
      toast(t('pos.enterValidMobile', { provider: paymentMethod === 'jazzcash' ? 'JazzCash' : 'Easypaisa' }), 'error');
      return;
    }
    if (isGiftCardMethod) {
      if (!giftCardNumber.trim() || !giftCardLookup?.usable) {
        toast(t('pos.lookUpGiftCardFirst'), 'error');
        return;
      }
      if (giftCardLookup.balance + 0.01 < total) {
        toast(t('pos.giftCardNotEnough', { balance: formatMoney(giftCardLookup.balance, company?.currency), total: formatMoney(total, company?.currency) }), 'error');
        return;
      }
    }
    setCheckingOut(true);
    setError('');
    try {
      if (isGatewayMethod) {
        const init = await api.post('/payment-gateway/initiate', {
          provider: paymentMethod, amount: total, phone: gatewayPhone,
        });
        if (init.status === 'failed') {
          setGatewayStatus('failed');
          toast(init.responseMessage || t('pos.gatewayDeclined'), 'error');
        } else if (init.status === 'completed') {
          await finalizeSale();
        } else {
          setGatewayStatus('waiting');
          toast(t('pos.gatewayRequestSent'), 'success');
          await waitForGatewayPayment(init.transactionId);
        }
      } else {
        await finalizeSale();
      }
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-6rem)]">
      {/* Left pane — product search & grid */}
      <div className="flex-1 min-w-0 flex flex-col">
        <p className="page-title mb-4">{t('pos.checkout')}</p>

        <div className="flex flex-col gap-3 mb-4 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-ink-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                type="text" placeholder={t('pos.searchPlaceholder')} autoFocus
                className="field-input !pl-11 rtl:!pl-3 rtl:!pr-11 !py-3"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button" onClick={() => setScannerOpen(true)}
              className="btn-secondary !py-3 !px-4 shrink-0 flex items-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
              </svg>
              <span className="hidden sm:inline">{t('pos.scanBarcode', 'Scan barcode')}</span>
            </button>
          </div>
        </div>

        {scannerOpen && (
          <BarcodeScannerModal onDetected={handleScannedBarcode} onClose={() => setScannerOpen(false)} />
        )}

        <SetupBar context={context} setContext={setContext} />

        {loadingProducts ? (
          <p className="text-sm text-ink-muted mt-6">{t('pos.loadingProducts')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-muted mt-6">{t('pos.noProductsMatch', { query: search })}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 lg:overflow-y-auto pr-1 rtl:pr-0 rtl:pl-1 mt-4 pb-4">
            {filtered.map((product) => (
              <button
                key={product._id}
                onClick={() => addToCart(product)}
                className="card overflow-hidden text-left rtl:text-right hover:border-accent/50 hover:shadow-md transition-all group flex flex-col"
              >
                <div className="h-24 bg-surface-sunken flex items-center justify-center shrink-0">
                  <span className="text-ink-muted/40 font-display text-xs uppercase tracking-widest">{product.sku || t('pos.item')}</span>
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <p className="text-sm font-semibold text-ink line-clamp-2 leading-tight">{product.name}</p>
                  <p className="text-xs text-ink-muted mt-1 mb-2">{product.sku ? t('pos.sku', { sku: product.sku }) : '—'}</p>
                  <div className="mt-auto flex items-end justify-between">
                    <span className="num text-sm font-bold text-accent">{formatMoney(product.sellingPrice, company?.currency)}</span>
                    <span className="w-7 h-7 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right pane — current ticket */}
      <div className="w-full lg:w-[380px] shrink-0 card flex flex-col lg:h-full overflow-hidden">
        {/* Ticket header */}
        <div className="p-4 border-b border-rule bg-surface-sunken flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{t('pos.currentTicket')}</h2>
            <p className="text-xs text-ink-muted">{t('pos.itemCount', { count: itemCount })}</p>
          </div>
          <button
            className="btn-ghost !p-2 !text-danger disabled:opacity-30"
            title={t('pos.clearTicket')} disabled={cart.length === 0}
            onClick={clearCart}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>

        {/* Line items */}
        {cart.length === 0 ? (
          <p className="text-sm text-ink-muted flex-1 flex items-center justify-center text-center px-4 py-10">
            {t('pos.tapToAdd')}
          </p>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
            {cart.map((line) => (
              <div key={line.variantId} className="card !shadow-none p-3 hover:border-accent/40 transition-colors">
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-ink leading-tight pr-2 rtl:pr-0 rtl:pl-2">{line.name}</p>
                  <span className="num text-sm font-bold text-ink shrink-0">{formatMoney(line.unitPrice * line.quantity, company?.currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-ink-muted">{formatMoney(line.unitPrice, company?.currency)} {t('pos.each')}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-surface-sunken rounded-md border border-rule">
                      <button
                        className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
                        onClick={() => updateQty(line.variantId, line.quantity - 1)}
                      >−</button>
                      <span className="num w-7 text-center text-xs font-semibold text-ink">{formatQty(line.quantity)}</span>
                      <button
                        className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
                        onClick={() => updateQty(line.variantId, line.quantity + 1)}
                      >+</button>
                    </div>
                    <button className="text-xs font-semibold text-danger hover:underline" onClick={() => removeLine(line.variantId)}>{t('pos.remove')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totals & checkout */}
        <div className="border-t border-rule p-4 shrink-0 bg-surface">
          <div className="mb-3">
            <label className="field-label">{t('pos.couponCode')}</label>
            {couponResult ? (
              <div className="flex items-center justify-between bg-accent-soft border border-transparent rounded-lg px-3 py-2">
                <span className="text-sm font-semibold text-accent-strong">{t('pos.couponApplied', { code: couponCode.toUpperCase(), amount: formatMoney(couponResult.discountAmount, company?.currency) })}</span>
                <button type="button" className="text-xs font-semibold text-ink-muted hover:text-danger" onClick={removeCoupon}>{t('pos.remove')}</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text" placeholder={t('pos.couponPlaceholder')} className="field-input flex-1"
                  value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={checkingOut}
                />
                <button
                  type="button" className="btn-secondary shrink-0"
                  onClick={applyCoupon} disabled={!couponCode.trim() || couponChecking || checkingOut || cart.length === 0}
                >
                  {couponChecking ? t('pos.checking') : t('pos.apply')}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-sm text-ink-muted mb-3">
            <div className="flex justify-between"><span>{t('pos.subtotal', { count: itemCount })}</span><span className="num">{formatMoney(subtotal, company?.currency)}</span></div>
            <div className="flex justify-between"><span>{t('pos.tax')}</span><span className="num">{formatMoney(taxTotal, company?.currency)}</span></div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-accent-strong"><span>{t('pos.couponDiscount')}</span><span className="num">−{formatMoney(couponDiscount, company?.currency)}</span></div>
            )}
          </div>
          <div className="tear-line mb-3" />
          <div className="flex justify-between items-end mb-4">
            <span className="font-display text-base font-bold text-ink">{t('pos.total')}</span>
            <span className="num text-2xl font-bold text-accent leading-none">{formatMoney(total, company?.currency)}</span>
          </div>

          {paymentMethod === 'cash' && quickCashAmounts.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {quickCashAmounts.map((amt) => (
                <span key={amt} className="num py-2 text-center bg-surface border border-rule-strong rounded-lg text-sm font-semibold text-ink">
                  {formatMoney(amt, company?.currency)}
                </span>
              ))}
              <span className="py-2 text-center bg-accent-soft border border-transparent rounded-lg text-sm font-semibold text-accent-strong">
                {t('pos.exact')}
              </span>
            </div>
          )}

          <div className="mb-2">
            <label className="field-label">{t('pos.paymentMethod')}</label>
            <select
              className="field-input"
              value={paymentMethod}
              onChange={(e) => { setPaymentMethod(e.target.value); setGatewayStatus(null); setGiftCardLookup(null); }}
            >
              <option value="cash">{t('pos.cash')}</option>
              <option value="card">{t('pos.card')}</option>
              <option value="bank_transfer">{t('pos.bankTransfer')}</option>
              <option value="jazzcash">{t('pos.jazzcash')}</option>
              <option value="easypaisa">{t('pos.easypaisa')}</option>
              <option value="gift_card">{t('pos.giftCard')}</option>
            </select>
          </div>

          {isGatewayMethod && (
            <div className="mb-2">
              <label className="field-label">{t('pos.customerMobileNumber')}</label>
              <input
                type="tel" placeholder={t('pos.gatewayPhonePlaceholder')} className="field-input"
                value={gatewayPhone} onChange={(e) => setGatewayPhone(e.target.value.trim())}
                disabled={checkingOut}
              />
            </div>
          )}

          {isGiftCardMethod && (
            <div className="mb-2">
              <label className="field-label">{t('pos.giftCardNumber')}</label>
              <div className="flex gap-2">
                <input
                  type="text" placeholder={t('pos.giftCardPlaceholder')} className="field-input flex-1"
                  value={giftCardNumber}
                  onChange={(e) => { setGiftCardNumber(e.target.value.toUpperCase()); setGiftCardLookup(null); }}
                  disabled={checkingOut}
                />
                <button
                  type="button" className="btn-secondary shrink-0"
                  onClick={checkGiftCard} disabled={!giftCardNumber.trim() || giftCardChecking || checkingOut}
                >
                  {giftCardChecking ? t('pos.checking') : t('pos.check')}
                </button>
              </div>
              {giftCardLookup && giftCardLookup.usable && (
                <p className="text-sm text-accent-strong mt-1.5">
                  {t('pos.balance', { amount: formatMoney(giftCardLookup.balance, company?.currency) })}
                  {giftCardLookup.balance + 0.01 < total && t('pos.notEnoughForSale')}
                </p>
              )}
              {giftCardLookup && !giftCardLookup.usable && (
                <p className="text-sm text-danger mt-1.5">{giftCardLookup.reason}</p>
              )}
            </div>
          )}

          {gatewayStatus === 'waiting' && (
            <p className="text-sm text-accent-strong mb-2">
              {t('pos.waitingForApproval')}
            </p>
          )}
          {gatewayStatus === 'failed' && (
            <p className="text-sm text-danger mb-2">
              {t('pos.paymentNotConfirmed')}
            </p>
          )}

          {error && <p className="text-sm text-danger mb-2">{error}</p>}

          <button
            className="btn-primary w-full !py-3.5 !rounded-xl text-base justify-between !px-5"
            disabled={cart.length === 0 || checkingOut}
            onClick={handleCheckout}
          >
            <span>
              {checkingOut
                ? (gatewayStatus === 'waiting' ? t('pos.waitingConfirmation') : t('pos.processing'))
                : t('pos.charge', { amount: formatMoney(total, company?.currency) })}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="rtl:rotate-180"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/** One-time checkout setup — branch/warehouse/terminal/cash-account, picked from real data via dropdowns (not pasted IDs), persisted to localStorage so it's set once per browser. */
function SetupBar({ context, setContext }) {
  const { t } = useTranslation();
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
      <button className="text-xs font-semibold text-ink-muted hover:text-accent mb-2 self-start" onClick={() => setOpen(true)}>
        {t('pos.changeCheckoutSetup')}
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
    <div className="card p-3 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
      <div>
        <label className="field-label">{t('pos.branch')}</label>
        <select className="field-input !text-xs" value={branchId} onChange={(e) => { setBranchId(e.target.value); setWarehouseId(''); setPosTerminalId(''); }}>
          <option value="">{t('common.select')}</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">{t('pos.warehouse')}</label>
        <select className="field-input !text-xs" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
          <option value="">{t('common.select')}</option>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">{t('pos.terminalOptional')}</label>
        <select className="field-input !text-xs" value={posTerminalId} onChange={(e) => setPosTerminalId(e.target.value)} disabled={!branchId}>
          <option value="">{t('common.none')}</option>
          {terminals.map((term) => <option key={term._id} value={term._id}>{term.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">{t('pos.cashPaymentAccount')}</label>
        <select className="field-input !text-xs" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
          <option value="">{t('common.select')}</option>
          {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
      </div>
      <div className="col-span-4">
        <button className="btn-secondary !text-xs" onClick={save} disabled={!branchId || !warehouseId || !cashAccountId}>
          {t('pos.save')}
        </button>
      </div>
    </div>
  );
}
