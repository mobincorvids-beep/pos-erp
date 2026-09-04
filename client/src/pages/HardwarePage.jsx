import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function HardwarePage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [returning, setReturning] = useState(null);

  function load() {
    setLoading(true);
    api.get('/hardware/rentals').then(setRentals).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleVoid(r) {
    if (!window.confirm(t('hardware.confirmVoidRental', { name: r.customerId?.name }))) return;
    try {
      await api.post(`/hardware/rentals/${r._id}/void`);
      toast(t('hardware.rentalVoided'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div>
          <p className="eyebrow mb-1">{t('hardware.title')}</p>
          <p className="page-title">{t('hardware.toolRentals')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('hardware.checkOutRental')}</button>
      </div>

      {loading && <Loading />}
      {!loading && rentals.length === 0 && <EmptyState title={t('hardware.noRentalsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('hardware.checkOutATool')}</button>} />}
      {!loading && rentals.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-4 py-3 font-semibold">{t('hardware.item')}</th>
                  <th className="px-4 py-3 font-semibold">{t('hardware.customer')}</th>
                  <th className="px-4 py-3 font-semibold">{t('hardware.status')}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t('hardware.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((r) => (
                  <tr key={r._id} className="border-b border-rule last:border-0 hover:bg-paper">
                    <td className="px-4 py-3 text-ink font-medium">{r.productId?.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.customerId?.name}</td>
                    <td className="px-4 py-3"><span className={r.status === 'out' ? 'chip-warning' : 'chip-accent'}>{r.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'out' && (
                        <div className="inline-flex gap-1">
                          <button className="btn-ghost !text-accent" onClick={() => setReturning(r)}>{t('hardware.return')}</button>
                          <button className="btn-ghost !text-danger" onClick={() => handleVoid(r)}>{t('hardware.void')}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <RentalForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {returning && <ReturnForm rental={returning} onClose={() => setReturning(null)} onReturned={() => { setReturning(null); load(); }} />}
    </div>
  );
}

function RentalForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', productId: '', customerId: '', dailyRate: '', depositAmount: '', expectedReturnDate: '', depositReceivedInAccountId: '', depositLiabilityAccountId: '', rentalBillingProductId: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.productId);
      const billingProduct = products.find((p) => p._id === form.rentalBillingProductId);
      await api.post('/hardware/rentals', {
        ...form, variantId: product?.variants[0]?._id, rentalBillingVariantId: billingProduct?.variants[0]?._id,
        dailyRate: Number(form.dailyRate), depositAmount: Number(form.depositAmount),
      });
      toast(t('hardware.rentalCheckedOut'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg text-ink mb-4">{t('hardware.checkOutRental')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('hardware.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">{t('hardware.branchEllipsis')}</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select>
          </div>
          <div>
            <label className="field-label">{t('hardware.warehouse')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}><option value="">{t('hardware.warehouseEllipsis')}</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
          </div>
          <div>
            <label className="field-label">{t('hardware.itemToRent')}</label>
            <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">{t('hardware.itemToRentEllipsis')}</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
          </div>
          <div>
            <label className="field-label">{t('hardware.customer')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">{t('hardware.customerEllipsis')}</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('hardware.dailyRate')}</label><input type="number" required placeholder={t('hardware.dailyRate')} className="field-input num" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} /></div>
            <div><label className="field-label">{t('hardware.deposit')}</label><input type="number" required placeholder={t('hardware.deposit')} className="field-input num" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">{t('hardware.expectedReturnDate')}</label>
            <input type="date" required className="field-input" value={form.expectedReturnDate} onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })} />
          </div>
          <div className="tear-line !my-2" />
          <div>
            <label className="field-label">{t('hardware.depositReceivedInto')}</label>
            <select required className="field-input" value={form.depositReceivedInAccountId} onChange={(e) => setForm({ ...form, depositReceivedInAccountId: e.target.value })}><option value="">{t('hardware.depositReceivedIntoEllipsis')}</option>{accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
          </div>
          <div>
            <label className="field-label">{t('hardware.depositLiabilityAccount')}</label>
            <select required className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}><option value="">{t('hardware.depositLiabilityAccountEllipsis')}</option>{accounts.filter((a) => a.type === 'liability').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
          </div>
          <div>
            <label className="field-label">{t('hardware.usageBillingProduct')}</label>
            <select required className="field-input" value={form.rentalBillingProductId} onChange={(e) => setForm({ ...form, rentalBillingProductId: e.target.value })}><option value="">{t('hardware.usageBillingProductEllipsis')}</option>{products.filter((p) => p.trackingMode === 'service').map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>{t('hardware.cancel')}</button><button type="submit" disabled={saving} className="btn-primary">{saving ? t('hardware.checkingOut') : t('hardware.checkOut')}</button></div>
      </form>
    </div>
  );
}

function ReturnForm({ rental, onClose, onReturned }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [condition, setCondition] = useState('good');
  const [finalPaymentAccountId, setFinalPaymentAccountId] = useState('');
  const [forfeitPercentForMinorDamage, setForfeitPercentForMinorDamage] = useState(50);
  const [damageRevenueAccountId, setDamageRevenueAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { condition, finalPaymentAccountId };
      if (condition !== 'good') { payload.damageRevenueAccountId = damageRevenueAccountId; payload.forfeitPercentForMinorDamage = Number(forfeitPercentForMinorDamage); }
      await api.post(`/hardware/rentals/${rental._id}/return`, payload);
      toast(t('hardware.returned'), 'success');
      onReturned();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg text-ink mb-4">{t('hardware.returnRental')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('hardware.condition')}</label>
            <select className="field-input" value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="good">{t('hardware.conditionGood')}</option>
              <option value="minor_damage">{t('hardware.conditionMinorDamage')}</option>
              <option value="lost_or_major_damage">{t('hardware.conditionLostOrMajorDamage')}</option>
            </select>
          </div>
          {condition === 'minor_damage' && (
            <div><label className="field-label">{t('hardware.forfeitPercent')}</label><input type="number" placeholder={t('hardware.forfeitPercent')} className="field-input num" value={forfeitPercentForMinorDamage} onChange={(e) => setForfeitPercentForMinorDamage(e.target.value)} /></div>
          )}
          {condition !== 'good' && (
            <div><label className="field-label">{t('hardware.damageRevenueAccount')}</label><select required className="field-input" value={damageRevenueAccountId} onChange={(e) => setDamageRevenueAccountId(e.target.value)}><option value="">{t('hardware.damageRevenueAccountEllipsis')}</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select></div>
          )}
          <div>
            <label className="field-label">{t('hardware.finalPaymentAccount')}</label>
            <select required className="field-input" value={finalPaymentAccountId} onChange={(e) => setFinalPaymentAccountId(e.target.value)}><option value="">{t('hardware.finalPaymentAccountEllipsis')}</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>{t('hardware.cancel')}</button><button type="submit" disabled={saving} className="btn-primary">{saving ? t('hardware.processing') : t('hardware.return')}</button></div>
      </form>
    </div>
  );
}
