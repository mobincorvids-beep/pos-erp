import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function SalonPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('services');
  const tabs = [['services', t('salon.servicesBilling')], ['packages', t('salon.membershipPackages')], ['commissions', t('salon.commissions')]];
  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow">{t('salon.eyebrow')}</p>
        <h1 className="page-title">{t('salon.manageSalon')}</h1>
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'services' && <ServicesTab />}
      {tab === 'packages' && <PackagesTab />}
      {tab === 'commissions' && <CommissionsTab />}
    </div>
  );
}

function ServicesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit
  const [billing, setBilling] = useState(null);

  function load() {
    setLoading(true);
    api.get('/salon/services').then(setServices).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleDeactivate(s) {
    if (!window.confirm(t('salon.removeServiceConfirm', { name: s.name }))) return;
    try {
      await api.del(`/salon/services/${s._id}`);
      toast(t('salon.serviceRemoved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-muted">{t('salon.servicesMenuHint')}</p>
        <button className="btn-primary" onClick={() => setEditing({})}>{t('salon.newService')}</button>
      </div>
      {loading && <Loading />}
      {!loading && services.length === 0 && <EmptyState title={t('salon.noServicesYet')} action={<button className="btn-primary" onClick={() => setEditing({})}>{t('salon.addAService')}</button>} />}
      {!loading && services.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {services.map((s) => (
            <div key={s._id} className="card p-4 flex flex-col gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{s.name}</p>
                <p className="num text-sm text-accent-strong mt-1">{formatMoney(s.price)}</p>
                <span className="chip-neutral mt-1">{s.commissionRate}{s.commissionType === 'percentage' ? '%' : ''} {t('salon.commission')}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 pt-2 border-t border-rule">
                <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setBilling(s)}>{t('salon.billThisService')}</button>
                <button className="text-xs font-semibold text-ink-muted hover:text-ink" onClick={() => setEditing(s)}>{t('salon.edit')}</button>
                <button className="text-xs font-semibold text-danger hover:opacity-80" onClick={() => handleDeactivate(s)}>{t('salon.remove')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing !== null && <ServiceForm service={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {billing && <BillServiceForm service={billing} onClose={() => setBilling(null)} />}
    </div>
  );
}

function ServiceForm({ service, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !service._id;
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    productId: service.productId || '', name: service.name || '', price: service.price ?? '',
    commissionType: service.commissionType || 'percentage', commissionRate: service.commissionRate ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isNew) api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {}); }, [isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const product = products.find((p) => p._id === form.productId);
        if (!product) throw new Error(t('salon.selectBillingProduct'));
        await api.post('/salon/services', { ...form, price: Number(form.price), commissionRate: Number(form.commissionRate) || 0, variantId: product.variants[0]?._id });
        toast(t('salon.serviceCreated'), 'success');
      } else {
        await api.put(`/salon/services/${service._id}`, {
          name: form.name, price: Number(form.price), commissionType: form.commissionType, commissionRate: Number(form.commissionRate) || 0,
        });
        toast(t('salon.serviceUpdated'), 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{isNew ? t('salon.newService') : t('salon.editService')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('salon.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('salon.namePlaceholder')} /></div>
          {isNew && (
            <div>
              <label className="field-label">{t('salon.billingProductLabel')}</label>
              <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">{t('salon.select')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              {products.length === 0 && <p className="text-xs text-warning mt-1">{t('salon.createServiceProductHint')}</p>}
            </div>
          )}
          <div><label className="field-label">{t('salon.price')}</label><input type="number" required className="field-input num" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('salon.commissionType')}</label>
              <select className="field-input" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
                <option value="percentage">{t('salon.percentage')}</option>
                <option value="fixed">{t('salon.fixedAmount')}</option>
              </select>
            </div>
            <div><label className="field-label">{t('salon.rate')}</label><input type="number" className="field-input num" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('salon.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('salon.saving') : t('salon.save')}</button>
        </div>
      </form>
    </div>
  );
}

function BillServiceForm({ service, onClose }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', employeeId: '', customerId: '', paymentAccountId: '', useMembership: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/hr/employees').then(setStaff).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post('/salon/services/bill', { ...form, salonServiceId: service._id });
      toast(t('salon.billedCommissionRecorded', { amount: formatMoney(result.sale.totalAmount, company?.currency) }), 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-1">{t('salon.billServiceName', { name: service.name })}</p>
        <p className="text-sm text-ink-muted mb-4 num">{formatMoney(service.price, company?.currency)}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('salon.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('salon.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('salon.warehouse')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">{t('salon.select')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('salon.stylist')}</label>
            <select required className="field-input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">{t('salon.select')}</option>
              {staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('salon.customer')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('salon.select')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.useMembership} onChange={(e) => setForm({ ...form, useMembership: e.target.checked })} />
            {t('salon.redeemFromMembership')}
          </label>
          {!form.useMembership && (
            <div>
              <label className="field-label">{t('salon.paymentAccount')}</label>
              <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
                <option value="">{t('salon.select')}</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('salon.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('salon.billing') : t('salon.bill')}</button>
        </div>
      </form>
    </div>
  );
}

function PackagesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [packages, setPackages] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit
  const [selling, setSelling] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/salon/packages'), api.get('/salon/services')])
      .then(([p, s]) => { setPackages(p); setServices(s); })
      .catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleDeactivate(p) {
    if (!window.confirm(t('salon.removePackageConfirm', { name: p.name }))) return;
    try {
      await api.del(`/salon/packages/${p._id}`);
      toast(t('salon.packageRemoved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-muted">{t('salon.bundledSessionsHint')}</p>
        <button className="btn-primary" onClick={() => setEditing({})}>{t('salon.newPackage')}</button>
      </div>
      {loading && <Loading />}
      {!loading && packages.length === 0 && <EmptyState title={t('salon.noPackagesYet')} />}
      {!loading && packages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {packages.map((p) => (
            <div key={p._id} className="card p-4 flex flex-col gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{p.name}</p>
                <span className="chip-neutral mt-1 num">{t('salon.sessionsValidity', { sessions: p.totalSessions, days: p.validityDays })}</span>
                <p className="num text-sm text-accent-strong mt-1">{formatMoney(p.price)}</p>
              </div>
              <div className="flex items-center gap-3 mt-1 pt-2 border-t border-rule">
                <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setSelling(p)}>{t('salon.sellToCustomer')}</button>
                <button className="text-xs font-semibold text-ink-muted hover:text-ink" onClick={() => setEditing(p)}>{t('salon.edit')}</button>
                <button className="text-xs font-semibold text-danger hover:opacity-80" onClick={() => handleDeactivate(p)}>{t('salon.remove')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing !== null && <PackageForm services={services} pkg={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {selling && <SellPackageForm pkg={selling} onClose={() => setSelling(null)} />}
    </div>
  );
}

function PackageForm({ services, pkg, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !pkg._id;
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    productId: pkg.productId || '', name: pkg.name || '', salonServiceId: pkg.salonServiceId || '',
    totalSessions: pkg.totalSessions ?? '', price: pkg.price ?? '', validityDays: pkg.validityDays ?? 365,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isNew) api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {}); }, [isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const product = products.find((p) => p._id === form.productId);
        if (!product) throw new Error(t('salon.selectBillingProduct'));
        await api.post('/salon/packages', { ...form, totalSessions: Number(form.totalSessions), price: Number(form.price), validityDays: Number(form.validityDays), variantId: product.variants[0]?._id });
        toast(t('salon.packageCreated'), 'success');
      } else {
        await api.put(`/salon/packages/${pkg._id}`, {
          name: form.name, totalSessions: Number(form.totalSessions), price: Number(form.price), validityDays: Number(form.validityDays),
        });
        toast(t('salon.packageUpdated'), 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{isNew ? t('salon.newMembershipPackage') : t('salon.editMembershipPackage')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('salon.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          {isNew && (
            <>
              <div>
                <label className="field-label">{t('salon.billingProductLabel')}</label>
                <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  <option value="">{t('salon.select')}</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">{t('salon.redeemableFor')}</label>
                <select required className="field-input" value={form.salonServiceId} onChange={(e) => setForm({ ...form, salonServiceId: e.target.value })}>
                  <option value="">{t('salon.selectAService')}</option>
                  {services.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('salon.sessions')}</label><input type="number" required className="field-input num" value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: e.target.value })} /></div>
            <div><label className="field-label">{t('salon.price')}</label><input type="number" required className="field-input num" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          </div>
          <div><label className="field-label">{t('salon.validForDays')}</label><input type="number" className="field-input num" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('salon.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('salon.saving') : t('salon.save')}</button>
        </div>
      </form>
    </div>
  );
}

function SellPackageForm({ pkg, onClose }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', customerId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/salon/packages/sell', { ...form, membershipPackageId: pkg._id });
      toast(t('salon.membershipSold'), 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-1">{t('salon.sellPackageName', { name: pkg.name })}</p>
        <p className="text-sm text-ink-muted mb-4 num">{formatMoney(pkg.price, company?.currency)}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('salon.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('salon.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('salon.warehouse')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">{t('salon.select')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('salon.customer')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('salon.select')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('salon.paymentAccount')}</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">{t('salon.select')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('salon.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('salon.selling') : t('salon.sell')}</button>
        </div>
      </form>
    </div>
  );
}

function CommissionsTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/salon/commissions').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title={t('salon.noCommissionsYet')} />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
              <th className="px-3 py-2 font-semibold">{t('salon.amount')}</th>
              <th className="px-3 py-2 font-semibold">{t('salon.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c._id} className="border-b border-rule last:border-0">
                <td className="px-3 py-2 num">{formatMoney(c.amount, company?.currency)}</td>
                <td className="px-3 py-2"><span className={c.status === 'paid' ? 'chip-accent' : 'chip-warning'}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted p-3 border-t border-rule">{t('salon.unpaidCommissionsHint')}</p>
    </div>
  );
}
