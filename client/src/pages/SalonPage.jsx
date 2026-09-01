import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function SalonPage() {
  const [tab, setTab] = useState('services');
  const tabs = [['services', 'Services & billing'], ['packages', 'Membership packages'], ['commissions', 'Commissions']];
  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow">Salon</p>
        <h1 className="page-title">Manage salon</h1>
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
    if (!window.confirm(`Remove "${s.name}" from the menu? Past sales are unaffected.`)) return;
    try {
      await api.del(`/salon/services/${s._id}`);
      toast('Service removed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-muted">Services on the menu and what they bill against.</p>
        <button className="btn-primary" onClick={() => setEditing({})}>New service</button>
      </div>
      {loading && <Loading />}
      {!loading && services.length === 0 && <EmptyState title="No services yet" action={<button className="btn-primary" onClick={() => setEditing({})}>Add a service</button>} />}
      {!loading && services.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {services.map((s) => (
            <div key={s._id} className="card p-4 flex flex-col gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{s.name}</p>
                <p className="num text-sm text-accent-strong mt-1">{formatMoney(s.price)}</p>
                <span className="chip-neutral mt-1">{s.commissionRate}{s.commissionType === 'percentage' ? '%' : ''} commission</span>
              </div>
              <div className="flex items-center gap-3 mt-1 pt-2 border-t border-rule">
                <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setBilling(s)}>Bill this service</button>
                <button className="text-xs font-semibold text-ink-muted hover:text-ink" onClick={() => setEditing(s)}>Edit</button>
                <button className="text-xs font-semibold text-danger hover:opacity-80" onClick={() => handleDeactivate(s)}>Remove</button>
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
        if (!product) throw new Error('Select a billing product.');
        await api.post('/salon/services', { ...form, price: Number(form.price), commissionRate: Number(form.commissionRate) || 0, variantId: product.variants[0]?._id });
        toast('Service created.', 'success');
      } else {
        await api.put(`/salon/services/${service._id}`, {
          name: form.name, price: Number(form.price), commissionType: form.commissionType, commissionRate: Number(form.commissionRate) || 0,
        });
        toast('Service updated.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{isNew ? 'New service' : 'Edit service'}</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Haircut" /></div>
          {isNew && (
            <div>
              <label className="field-label">Billing product (trackingMode "service")</label>
              <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">Select…</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              {products.length === 0 && <p className="text-xs text-warning mt-1">Create a service-tracked product on the Products page first.</p>}
            </div>
          )}
          <div><label className="field-label">Price</label><input type="number" required className="field-input num" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Commission type</label>
              <select className="field-input" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div><label className="field-label">Rate</label><input type="number" className="field-input num" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function BillServiceForm({ service, onClose }) {
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
      toast(`Billed ${formatMoney(result.sale.totalAmount, company?.currency)}: commission recorded.`, 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-1">Bill {service.name}</p>
        <p className="text-sm text-ink-muted mb-4 num">{formatMoney(service.price, company?.currency)}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Stylist</label>
            <select required className="field-input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.useMembership} onChange={(e) => setForm({ ...form, useMembership: e.target.checked })} />
            Redeem from an active membership (no charge)
          </label>
          {!form.useMembership && (
            <div>
              <label className="field-label">Payment account</label>
              <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Billing…' : 'Bill'}</button>
        </div>
      </form>
    </div>
  );
}

function PackagesTab() {
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
    if (!window.confirm(`Remove "${p.name}"? Customers who already bought it keep their remaining sessions.`)) return;
    try {
      await api.del(`/salon/packages/${p._id}`);
      toast('Package removed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-muted">Bundled sessions customers can buy and redeem over time.</p>
        <button className="btn-primary" onClick={() => setEditing({})}>New package</button>
      </div>
      {loading && <Loading />}
      {!loading && packages.length === 0 && <EmptyState title="No membership packages yet" />}
      {!loading && packages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {packages.map((p) => (
            <div key={p._id} className="card p-4 flex flex-col gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{p.name}</p>
                <span className="chip-neutral mt-1 num">{p.totalSessions} sessions · {p.validityDays}d</span>
                <p className="num text-sm text-accent-strong mt-1">{formatMoney(p.price)}</p>
              </div>
              <div className="flex items-center gap-3 mt-1 pt-2 border-t border-rule">
                <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setSelling(p)}>Sell to a customer</button>
                <button className="text-xs font-semibold text-ink-muted hover:text-ink" onClick={() => setEditing(p)}>Edit</button>
                <button className="text-xs font-semibold text-danger hover:opacity-80" onClick={() => handleDeactivate(p)}>Remove</button>
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
        if (!product) throw new Error('Select a billing product.');
        await api.post('/salon/packages', { ...form, totalSessions: Number(form.totalSessions), price: Number(form.price), validityDays: Number(form.validityDays), variantId: product.variants[0]?._id });
        toast('Package created.', 'success');
      } else {
        await api.put(`/salon/packages/${pkg._id}`, {
          name: form.name, totalSessions: Number(form.totalSessions), price: Number(form.price), validityDays: Number(form.validityDays),
        });
        toast('Package updated.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{isNew ? 'New membership package' : 'Edit membership package'}</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          {isNew && (
            <>
              <div>
                <label className="field-label">Billing product (trackingMode "service")</label>
                <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  <option value="">Select…</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Redeemable for</label>
                <select required className="field-input" value={form.salonServiceId} onChange={(e) => setForm({ ...form, salonServiceId: e.target.value })}>
                  <option value="">Select a service…</option>
                  {services.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Sessions</label><input type="number" required className="field-input num" value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: e.target.value })} /></div>
            <div><label className="field-label">Price</label><input type="number" required className="field-input num" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          </div>
          <div><label className="field-label">Valid for (days)</label><input type="number" className="field-input num" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function SellPackageForm({ pkg, onClose }) {
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
      toast('Membership sold.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-1">Sell {pkg.name}</p>
        <p className="text-sm text-ink-muted mb-4 num">{formatMoney(pkg.price, company?.currency)}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Payment account</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Selling…' : 'Sell'}</button>
        </div>
      </form>
    </div>
  );
}

function CommissionsTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/salon/commissions').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title="No commissions recorded yet" />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
              <th className="px-3 py-2 font-semibold">Amount</th>
              <th className="px-3 py-2 font-semibold">Status</th>
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
      <p className="text-xs text-ink-muted p-3 border-t border-rule">Unpaid commissions get folded into the next payroll run automatically, see HR &amp; Payroll.</p>
    </div>
  );
}
