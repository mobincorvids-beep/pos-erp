import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function ProfessionalServicesPage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [clientCustomerId, setClientCustomerId] = useState('');
  const [entries, setEntries] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  function load() {
    if (!clientCustomerId) return;
    api.get(`/professional-services/time-entries/unbilled?clientCustomerId=${clientCustomerId}`).then(setEntries).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [clientCustomerId]);

  const totalHours = entries?.reduce((sum, e) => sum + e.hours, 0) || 0;
  const totalAmount = entries?.reduce((sum, e) => sum + e.hours * e.hourlyRate, 0) || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="page-title">{t('professionalServices.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('professionalServices.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowLogForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('professionalServices.logTime')}
        </button>
      </div>

      <div className="card p-4 mt-5 mb-5 max-w-md">
        <label className="field-label">{t('professionalServices.client')}</label>
        <select className="field-input" value={clientCustomerId} onChange={(e) => setClientCustomerId(e.target.value)}>
          <option value="">{t('professionalServices.selectClientPlaceholder')}</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {!clientCustomerId && <EmptyState title={t('professionalServices.selectAClient')} description={t('professionalServices.selectAClientDescription')} />}
      {clientCustomerId && !entries && <Loading />}
      {clientCustomerId && entries?.length === 0 && <EmptyState title={t('professionalServices.noUnbilledTime')} />}
      {clientCustomerId && entries?.length > 0 && (
        <>
          <div className="card overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                    <th className="px-4 py-2.5 font-semibold">{t('professionalServices.employee')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('professionalServices.description')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('professionalServices.date')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('professionalServices.hours')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('professionalServices.rate')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('professionalServices.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-4 py-2.5 font-medium text-ink">{e.employeeId?.name || '-'}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{e.description}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDate(e.date)}</td>
                      <td className="px-4 py-2.5 num text-right">{e.hours}</td>
                      <td className="px-4 py-2.5 num text-right">{formatMoney(e.hourlyRate, company?.currency)}</td>
                      <td className="px-4 py-2.5 num text-right font-semibold text-ink">{formatMoney(e.hours * e.hourlyRate, company?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card p-4 flex items-center justify-between max-w-md mb-4">
            <div>
              <p className="eyebrow">{t('professionalServices.total')}</p>
              <p className="text-sm text-ink-muted mt-0.5">{t('professionalServices.hoursBilledHint', { hours: totalHours })}</p>
            </div>
            <p className="font-display text-xl num font-bold text-ink">{formatMoney(totalAmount, company?.currency)}</p>
          </div>
          <button className="btn-primary" onClick={() => setShowInvoiceForm(true)}>{t('professionalServices.generateInvoiceForClient')}</button>
        </>
      )}

      {showLogForm && <LogTimeForm onClose={() => setShowLogForm(false)} onSaved={() => { setShowLogForm(false); load(); }} />}
      {showInvoiceForm && <InvoiceForm clientCustomerId={clientCustomerId} entryCount={entries?.length} totalAmount={totalAmount} onClose={() => setShowInvoiceForm(false)} onSaved={() => { setShowInvoiceForm(false); load(); }} />}
    </div>
  );
}

function LogTimeForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ branchId: '', employeeId: '', clientCustomerId: '', description: '', hours: '', hourlyRate: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/hr/employees').then(setEmployees).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/professional-services/time-entries', { ...form, hours: Number(form.hours), hourlyRate: Number(form.hourlyRate) });
      toast(t('professionalServices.timeLogged'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('professionalServices.logTime')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('professionalServices.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('professionalServices.selectPlaceholder')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('professionalServices.employee')}</label>
            <select required className="field-input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">{t('professionalServices.selectPlaceholder')}</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('professionalServices.client')}</label>
            <select required className="field-input" value={form.clientCustomerId} onChange={(e) => setForm({ ...form, clientCustomerId: e.target.value })}>
              <option value="">{t('professionalServices.selectPlaceholder')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">{t('professionalServices.description')}</label><input required className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="field-label">{t('professionalServices.date')}</label><input type="date" required className="field-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="field-label">{t('professionalServices.hours')}</label><input type="number" step="0.25" required className="field-input num" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
            <div><label className="field-label">{t('professionalServices.rate')}</label><input type="number" required className="field-input num" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('professionalServices.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('professionalServices.logging') : t('professionalServices.logTime')}</button>
        </div>
      </form>
    </div>
  );
}

function InvoiceForm({ clientCustomerId, entryCount, totalAmount, onClose, onSaved }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ warehouseId: '', billingProductId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/warehouses').then(setWarehouses).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.billingProductId);
      if (!product) throw new Error(t('professionalServices.selectBillingProductError'));
      const result = await api.post(`/professional-services/clients/${clientCustomerId}/generate-invoice`, { ...form, billingVariantId: product.variants[0]?._id, paymentAccountId: form.paymentAccountId || undefined });
      toast(t('professionalServices.invoicedEntries', { count: result.entriesInvoiced, amount: formatMoney(result.totalAmount, company?.currency) }), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-1">{t('professionalServices.generateInvoice')}</p>
        <p className="text-sm text-ink-muted mb-4">{t('professionalServices.unbilledEntriesSummary', { count: entryCount, amount: formatMoney(totalAmount, company?.currency) })}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('professionalServices.warehouseForSale')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">{t('professionalServices.selectPlaceholder')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('professionalServices.billingProduct')}</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
              <option value="">{t('professionalServices.selectPlaceholder')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('professionalServices.paymentAccountOptional')}</label>
            <select className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">{t('professionalServices.billAsReceivable')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('professionalServices.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('professionalServices.generating') : t('professionalServices.generateInvoice')}</button>
        </div>
      </form>
    </div>
  );
}
