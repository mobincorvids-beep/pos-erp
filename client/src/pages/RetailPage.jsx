import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function RetailPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('layaway');
  const TABS = [
    ['layaway', t('retail.title'), 'inventory_2'],
    ['promotions', t('retail.promotions'), 'sell'],
    ['scorecard', t('retail.supplierScorecard'), 'leaderboard'],
  ];
  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>{label}</button>
        ))}
      </div>
      {tab === 'layaway' && <LayawayTab />}
      {tab === 'promotions' && <PromotionsTab />}
      {tab === 'scorecard' && <SupplierScorecardTab />}
    </div>
  );
}

function LayawayTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState(null);
  const [editing, setEditing] = useState(null);
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [paymentAccountId, setPaymentAccountId] = useState('');

  function load() {
    setLoading(true);
    api.get('/retail/layaway').then(setPlans).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }
  useEffect(load, []);

  async function pay(e) {
    e.preventDefault();
    try {
      const result = await api.post(`/retail/layaway/${paying._id}/payments`, { amount: Number(amount), paymentAccountId });
      toast(result.completed ? t('retail.paymentCompleteFulfilled') : t('retail.paymentRecordedRemaining', { amount: formatMoney(result.remaining, company?.currency) }), 'success');
      setPaying(null); setAmount('');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">{t('retail.eyebrow')}</p>
          <p className="page-title">{t('retail.title')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('retail.newPlan')}
        </button>
      </div>

      {loading && <Loading />}
      {!loading && plans.length === 0 && (
        <EmptyState title={t('retail.noPlansYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('retail.startOne')}</button>} />
      )}
      {!loading && plans.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-widest">
                <th className="px-4 py-3 font-semibold">{t('retail.item')}</th>
                <th className="px-4 py-3 font-semibold">{t('retail.customer')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('retail.paidTotal')}</th>
                <th className="px-4 py-3 font-semibold">{t('retail.status')}</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{p.productId?.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{p.customerId?.name}</td>
                  <td className="px-4 py-3 num text-right">
                    {formatMoney(p.amountPaid, company?.currency)}
                    <span className="text-ink-muted"> / {formatMoney(p.totalPrice, company?.currency)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.status === 'completed' ? 'chip-accent' : p.status === 'cancelled' ? 'chip-danger' : 'chip-neutral'}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {p.status === 'active' && p.amountPaid === 0 && <button className="btn-ghost !text-accent" onClick={() => setEditing(p)}>{t('retail.edit')}</button>}
                    {p.status === 'active' && <button className="btn-ghost !text-accent" onClick={() => setPaying(p)}>{t('retail.pay')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <PlanForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <PlanEditForm plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {paying && (
        <div className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
          <form onSubmit={pay} className="card p-6 w-full max-w-xs">
            <p className="font-display text-lg font-semibold text-ink mb-4">{t('retail.recordPayment')}</p>
            <div className="space-y-3">
              <div>
                <label className="field-label">{t('retail.amount')}</label>
                <input type="number" required placeholder="0.00" className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="field-label">{t('retail.paymentAccount')}</label>
                <select required className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                  <option value="">{t('retail.selectAccount')}</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-secondary" onClick={() => setPaying(null)}>{t('retail.cancel')}</button>
              <button type="submit" className="btn-primary">{t('retail.pay')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PlanEditForm({ plan, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ totalPrice: plan.totalPrice, quantity: plan.quantity || 1 });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/retail/layaway/${plan._id}`, { totalPrice: Number(form.totalPrice), quantity: Number(form.quantity) });
      toast(t('retail.planUpdated'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-xs">
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('retail.editPlan', { name: plan.productId?.name })}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('retail.totalPrice')}</label>
            <input type="number" required className="field-input num" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('retail.quantity')}</label>
            <input type="number" min="1" required className="field-input num" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('retail.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('retail.saving') : t('retail.save')}</button>
        </div>
      </form>
    </div>
  );
}

function PlanForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', productId: '', customerId: '', totalPrice: '', depositLiabilityAccountId: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); api.get('/products').then(setProducts).catch(() => {}); api.get('/customers').then(setCustomers).catch(() => {}); api.get('/org/accounts?type=liability').then(setAccounts).catch(() => {}); }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.productId);
      await api.post('/retail/layaway', { ...form, variantId: product?.variants[0]?._id, totalPrice: Number(form.totalPrice) });
      toast(t('retail.layawayPlanOpened'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('retail.newLayawayPlan')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('retail.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('retail.selectBranch')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('retail.warehouse')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">{t('retail.selectWarehouse')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('retail.item')}</label>
            <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">{t('retail.selectItem')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('retail.customer')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('retail.selectCustomer')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('retail.totalPrice')}</label>
            <input type="number" required placeholder="0.00" className="field-input num" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('retail.depositLiabilityAccount')}</label>
            <select required className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}>
              <option value="">{t('retail.selectAccount')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('retail.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('retail.opening') : t('retail.openPlan')}</button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promotions — buy-X-get-Y and fixed-price bundles. Staff quote a cart
// against active promotions and apply the discount manually at checkout,
// same pattern as loyalty-point redemption and buyback credit elsewhere.
// ---------------------------------------------------------------------------

function PromotionsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/retail/promotions').then(setPromos).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggleActive(promo) {
    try {
      await api.put(`/retail/promotions/${promo._id}/active`, { active: !promo.active });
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-ink-muted max-w-md">{t('retail.promotionsDescription')}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('retail.newPromotion')}</button>
      </div>
      {loading && <Loading />}
      {!loading && promos.length === 0 && <EmptyState title={t('retail.noPromotionsYet')} description={t('retail.noPromotionsYetDescription')} />}
      {!loading && promos.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {promos.map((p) => (
            <div key={p._id} className="card p-5">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-ink">{p.name}</p>
                <span className={p.active ? 'chip-accent' : 'chip-neutral'}>{p.active ? t('retail.active') : t('retail.inactive')}</span>
              </div>
              <p className="text-xs text-ink-muted mb-3">
                {p.type === 'buy_x_get_y'
                  ? t('retail.buyXGetYSummary', { x: p.triggerQuantity, y: p.rewardQuantity, pct: p.rewardDiscountPercent })
                  : t('retail.bundleSummary', { count: p.bundleItems.length, price: p.bundlePrice })}
              </p>
              <button className="btn-ghost !px-0 text-xs" onClick={() => toggleActive(p)}>
                {p.active ? t('retail.deactivate') : t('retail.activate')}
              </button>
            </div>
          ))}
        </div>
      )}
      {showForm && <PromotionForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PromotionForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [type, setType] = useState('buy_x_get_y');
  const [name, setName] = useState('');
  const [triggerVariantId, setTriggerVariantId] = useState('');
  const [triggerQuantity, setTriggerQuantity] = useState(1);
  const [rewardVariantId, setRewardVariantId] = useState('');
  const [rewardQuantity, setRewardQuantity] = useState(1);
  const [rewardDiscountPercent, setRewardDiscountPercent] = useState(100);
  const [bundleItems, setBundleItems] = useState([{ variantId: '', quantity: 1 }]);
  const [bundlePrice, setBundlePrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  const allVariants = products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name, productId: p._id })));

  function updateBundleItem(i, patch) {
    setBundleItems((prev) => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = type === 'buy_x_get_y'
        ? { name, type, triggerVariantId, triggerQuantity: Number(triggerQuantity), rewardVariantId, rewardQuantity: Number(rewardQuantity), rewardDiscountPercent: Number(rewardDiscountPercent) }
        : {
            name, type, bundlePrice: Number(bundlePrice),
            bundleItems: bundleItems.filter((b) => b.variantId).map((b) => {
              const v = allVariants.find((av) => av._id === b.variantId);
              return { productId: v?.productId, variantId: b.variantId, quantity: Number(b.quantity) };
            }),
          };
      await api.post('/retail/promotions', payload);
      toast(t('retail.promotionCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('retail.newPromotion')}</p>
        <div className="space-y-3 mb-4">
          <div><label className="field-label">{t('retail.promotionName')}</label><input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <label className="field-label">{t('retail.promotionType')}</label>
            <select className="field-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="buy_x_get_y">{t('retail.buyXGetY')}</option>
              <option value="bundle">{t('retail.bundle')}</option>
            </select>
          </div>
        </div>

        {type === 'buy_x_get_y' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <label className="field-label">{t('retail.triggerItem')}</label>
                <select required className="field-input" value={triggerVariantId} onChange={(e) => setTriggerVariantId(e.target.value)}>
                  <option value="">{t('retail.selectItem')}</option>
                  {allVariants.map((v) => <option key={v._id} value={v._id}>{v.productName}</option>)}
                </select>
              </div>
              <div><label className="field-label">{t('retail.buyQty')}</label><input type="number" min="1" required className="field-input num" value={triggerQuantity} onChange={(e) => setTriggerQuantity(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <label className="field-label">{t('retail.rewardItem')}</label>
                <select required className="field-input" value={rewardVariantId} onChange={(e) => setRewardVariantId(e.target.value)}>
                  <option value="">{t('retail.selectItem')}</option>
                  {allVariants.map((v) => <option key={v._id} value={v._id}>{v.productName}</option>)}
                </select>
              </div>
              <div><label className="field-label">{t('retail.getQty')}</label><input type="number" min="1" required className="field-input num" value={rewardQuantity} onChange={(e) => setRewardQuantity(e.target.value)} /></div>
            </div>
            <div><label className="field-label">{t('retail.discountPercent')}</label><input type="number" min="1" max="100" required className="field-input num" value={rewardDiscountPercent} onChange={(e) => setRewardDiscountPercent(e.target.value)} /><p className="text-xs text-ink-muted mt-1">{t('retail.discountPercentHint')}</p></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="field-label mb-1">{t('retail.bundleItemsLabel')}</p>
            {bundleItems.map((b, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <select className="field-input col-span-2" value={b.variantId} onChange={(e) => updateBundleItem(i, { variantId: e.target.value })}>
                  <option value="">{t('retail.selectItem')}</option>
                  {allVariants.map((v) => <option key={v._id} value={v._id}>{v.productName}</option>)}
                </select>
                <input type="number" min="1" className="field-input num" value={b.quantity} onChange={(e) => updateBundleItem(i, { quantity: e.target.value })} />
              </div>
            ))}
            <button type="button" className="btn-ghost !px-0 text-xs" onClick={() => setBundleItems([...bundleItems, { variantId: '', quantity: 1 }])}>{t('retail.addBundleItem')}</button>
            <div><label className="field-label">{t('retail.bundlePrice')}</label><input type="number" required className="field-input num" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} /></div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('retail.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('retail.saving') : t('retail.savePromotion')}</button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supplier Scorecard — lead time, fulfillment rate, defect rate, built
// entirely from existing PO/GRN data, no new fields on the shared core.
// ---------------------------------------------------------------------------

function SupplierScorecardTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/retail/reports/supplier-scorecard').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title={t('retail.noScorecardDataYet')} description={t('retail.noScorecardDataYetDescription')} />;

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-widest">
            <th className="px-4 py-3 font-semibold">{t('retail.supplier')}</th>
            <th className="px-4 py-3 font-semibold text-right">{t('retail.poCount')}</th>
            <th className="px-4 py-3 font-semibold text-right">{t('retail.totalValue')}</th>
            <th className="px-4 py-3 font-semibold text-right">{t('retail.avgLeadDays')}</th>
            <th className="px-4 py-3 font-semibold text-right">{t('retail.fulfillmentRate')}</th>
            <th className="px-4 py-3 font-semibold text-right">{t('retail.defectRate')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.supplierId} className="border-b border-rule last:border-0">
              <td className="px-4 py-3 font-medium text-ink">{r.supplierName}</td>
              <td className="px-4 py-3 num text-right">{r.poCount}</td>
              <td className="px-4 py-3 num text-right">{formatMoney(r.totalValue)}</td>
              <td className="px-4 py-3 num text-right">{r.avgLeadDays != null ? `${r.avgLeadDays}d` : '—'}</td>
              <td className="px-4 py-3 num text-right">{r.fulfillmentRate != null ? `${r.fulfillmentRate}%` : '—'}</td>
              <td className="px-4 py-3 num text-right">
                {r.defectRate != null ? <span className={r.defectRate > 5 ? 'text-danger font-semibold' : ''}>{r.defectRate}%</span> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
