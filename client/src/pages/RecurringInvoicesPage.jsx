import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { active: 'chip-accent', paused: 'chip-warning', cancelled: 'chip-neutral' };
const FREQUENCY_ICON = { weekly: 'view_week', monthly: 'calendar_month', quarterly: 'update', annually: 'event_repeat' };

export function RecurringInvoicesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);

  const FREQUENCY_LABEL = { weekly: t('recurringInvoices.weekly'), monthly: t('recurringInvoices.monthly'), quarterly: t('recurringInvoices.quarterly'), annually: t('recurringInvoices.annually') };
  const ACTION_LABEL = { pause: t('recurringInvoices.paused'), resume: t('recurringInvoices.resumed'), cancel: t('recurringInvoices.cancelled') };

  function load() {
    setLoading(true);
    api.get('/recurring-invoices').then(setTemplates).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function changeStatus(id, action) {
    try {
      await api.post(`/recurring-invoices/${id}/${action}`, {});
      toast(t('recurringInvoices.templateStatusUpdated', { status: ACTION_LABEL[action] }), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <p className="page-title">{t('recurringInvoices.title')}</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">{t('recurringInvoices.subtitle')}</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span> {t('recurringInvoices.newTemplate')}
        </button>
      </div>

      {loading && <Loading />}
      {!loading && templates.length === 0 && (
        <EmptyState title={t('recurringInvoices.noRecurringInvoices')} description={t('recurringInvoices.noRecurringInvoicesDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('recurringInvoices.newTemplate')}</button>} />
      )}
      {!loading && templates.length > 0 && (
        <div className="card p-5">
          <p className="font-display text-lg font-semibold text-ink mb-4">{t('recurringInvoices.activeSubscriptionModels')}</p>
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div key={tpl._id} className="group flex items-center justify-between gap-4 p-4 rounded-lg border border-rule hover:bg-surface-sunken transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-accent-soft text-accent-strong flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{FREQUENCY_ICON[tpl.frequency] || 'autorenew'}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-ink truncate">{tpl.customerId?.name || '-'}</p>
                      <span className={STATUS_CHIP[tpl.status]}>{tpl.status}</span>
                    </div>
                    <p className="text-sm text-ink-muted mt-0.5">{FREQUENCY_LABEL[tpl.frequency]} · {t('recurringInvoices.itemCount', { count: tpl.items.length })}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="num text-ink-muted text-sm">{t('recurringInvoices.next')}: {formatDate(tpl.nextRunDate)}</p>
                  <div className="mt-1.5 flex items-center justify-end gap-1">
                    {tpl.status === 'active' && <button className="btn-ghost !text-warning !px-2 !py-1 text-xs" onClick={() => changeStatus(tpl._id, 'pause')}>{t('recurringInvoices.pause')}</button>}
                    {tpl.status === 'paused' && <button className="btn-ghost !text-accent !px-2 !py-1 text-xs" onClick={() => changeStatus(tpl._id, 'resume')}>{t('recurringInvoices.resume')}</button>}
                    {tpl.status !== 'cancelled' && <button className="btn-ghost !text-danger !px-2 !py-1 text-xs" onClick={() => changeStatus(tpl._id, 'cancel')}>{t('recurringInvoices.cancel')}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {templates.some((tpl) => tpl.status === 'active') && (
        <GenerateDueSection generating={generating} setGenerating={setGenerating} onGenerated={load} />
      )}

      {showForm && <TemplateForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function GenerateDueSection({ generating, setGenerating, onGenerated }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');

  useEffect(() => { api.get('/org/warehouses').then(setWarehouses).catch(() => {}); }, []);

  async function generate() {
    if (!warehouseId) { toast(t('recurringInvoices.chooseWarehouseFirst'), 'error'); return; }
    setGenerating(true);
    try {
      const result = await api.post('/recurring-invoices/generate-due', { warehouseId });
      toast(result.generatedCount > 0 ? t('recurringInvoices.billedDueInvoices', { count: result.generatedCount }) : t('recurringInvoices.nothingDueYet'), 'success');
      onGenerated();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="card p-4 mt-4 flex items-center gap-2 bg-accent-soft/40 border-accent/20">
      <span className="material-symbols-outlined text-accent">bolt</span>
      <select className="field-input !w-64" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
        <option value="">{t('recurringInvoices.warehouseForGeneratedInvoices')}</option>
        {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
      </select>
      <button className="btn-secondary" onClick={generate} disabled={generating}>{generating ? t('recurringInvoices.generating') : t('recurringInvoices.generateWhatsDue')}</button>
    </div>
  );
}

function TemplateForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([{ productId: '', variantId: '', quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);

  const FREQUENCY_LABEL = { weekly: t('recurringInvoices.weekly'), monthly: t('recurringInvoices.monthly'), quarterly: t('recurringInvoices.quarterly'), annually: t('recurringInvoices.annually') };

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function pickProduct(i, productId) {
    const product = products.find((p) => p._id === productId);
    updateLine(i, { productId, variantId: product?.variants?.[0]?._id || '', unitPrice: product?.sellingPrice || 0 });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/recurring-invoices', {
        branchId, customerId, frequency, startDate,
        items: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      });
      toast(t('recurringInvoices.templateCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('recurringInvoices.newRecurringInvoice')}</p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t('recurringInvoices.branchPlaceholder')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select required className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">{t('recurringInvoices.customerPlaceholder')}</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select className="field-input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {Object.entries(FREQUENCY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input type="date" required className="field-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <p className="field-label mb-1">{t('recurringInvoices.items')}</p>
        <div className="space-y-2 mb-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <select className="field-input col-span-2" value={line.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">{t('recurringInvoices.productPlaceholder')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input num" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} placeholder={t('recurringInvoices.qty')} />
              <input type="number" step="0.01" className="field-input num" value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} placeholder={t('recurringInvoices.price')} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setLines([...lines, { productId: '', variantId: '', quantity: 1, unitPrice: 0 }])}>
          {t('recurringInvoices.addLine')}
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('recurringInvoices.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('recurringInvoices.creating') : t('recurringInvoices.createTemplate')}</button>
        </div>
      </form>
    </div>
  );
}
