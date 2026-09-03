import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { pending: 'chip-warning', cleared: 'chip-accent', bounced: 'chip-danger' };

function isOverdue(cheque) {
  return cheque.status === 'pending' && new Date(cheque.dueDate) < new Date(new Date().toDateString());
}

export function ChequesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('due-soon'); // due-soon | all
  const [statusFilter, setStatusFilter] = useState('');
  const [cheques, setCheques] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setCheques(null);
    const req = tab === 'due-soon'
      ? api.get('/cheques/due-soon?days=7')
      : api.get(`/cheques${statusFilter ? `?status=${statusFilter}` : ''}`);
    req.then(setCheques).catch((err) => toast(err.message, 'error'));
  }

  useEffect(load, [tab, statusFilter]);

  async function updateStatus(cheque, action) {
    setBusyId(cheque._id);
    try {
      if (action === 'clear') {
        await api.post(`/cheques/${cheque._id}/clear`);
        toast(t('cheques.markedCleared'), 'success');
      } else {
        const reason = window.prompt(t('cheques.bounceReasonPrompt')) || '';
        await api.post(`/cheques/${cheque._id}/bounce`, { reason });
        toast(t('cheques.markedBounced'), 'success');
      }
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const canManage = can('cheques.manage');

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="page-title mb-1">{t('cheques.title')}</p>
          <p className="text-sm text-ink-muted">{t('cheques.subtitle')}</p>
        </div>
        {canManage && <button className="btn-primary" onClick={() => setShowForm(true)}>{t('cheques.recordCheque')}</button>}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-rule mb-5">
        <div className="flex gap-1">
          {[['due-soon', t('cheques.tabDueSoon')], ['all', t('cheques.tabAll')]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 font-semibold ${tab === key ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'all' && (
          <select className="field-input !py-1.5 !w-auto mb-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('cheques.filterAllStatuses')}</option>
            <option value="pending">{t('cheques.statusPending')}</option>
            <option value="cleared">{t('cheques.statusCleared')}</option>
            <option value="bounced">{t('cheques.statusBounced')}</option>
          </select>
        )}
      </div>

      {!cheques && <Loading />}
      {cheques && cheques.length === 0 && (
        <EmptyState title={t('cheques.emptyTitle')} description={tab === 'due-soon' ? t('cheques.emptyDueSoonDescription') : t('cheques.emptyDescription')} />
      )}

      {cheques && cheques.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-surface-sunken/60 border-y border-rule">
                  <th className="py-3 px-4 eyebrow font-semibold">{t('cheques.colCheque')}</th>
                  <th className="py-3 px-4 eyebrow font-semibold">{t('cheques.colParty')}</th>
                  <th className="py-3 px-4 eyebrow font-semibold">{t('cheques.colBank')}</th>
                  <th className="py-3 px-4 eyebrow font-semibold">{t('cheques.colDueDate')}</th>
                  <th className="py-3 px-4 eyebrow font-semibold text-right">{t('cheques.colAmount')}</th>
                  <th className="py-3 px-4 eyebrow font-semibold text-center">{t('cheques.colStatus')}</th>
                  {canManage && <th className="py-3 px-4 eyebrow font-semibold"></th>}
                </tr>
              </thead>
              <tbody>
                {cheques.map((c) => {
                  const party = c.direction === 'receivable' ? c.customerId?.name : c.supplierId?.name;
                  return (
                    <tr key={c._id} className={`border-b border-rule last:border-0 ${isOverdue(c) ? 'bg-danger-soft/30' : ''}`}>
                      <td className="py-3.5 px-4 num font-medium">{c.chequeNumber}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-ink">{party || '—'}</span>
                        <span className="block text-xs text-ink-muted">{c.direction === 'receivable' ? t('cheques.fromCustomer') : t('cheques.toSupplier')}</span>
                      </td>
                      <td className="py-3.5 px-4 text-ink-muted">{c.bankName}</td>
                      <td className={`py-3.5 px-4 num ${isOverdue(c) ? 'text-danger font-semibold' : 'text-ink-muted'}`}>{formatDate(c.dueDate)}</td>
                      <td className="py-3.5 px-4 num font-medium text-right">{formatMoney(c.amount)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={STATUS_CHIP[c.status]}>{t(`cheques.status${c.status[0].toUpperCase()}${c.status.slice(1)}`)}</span>
                        {isOverdue(c) && <span className="chip-danger ml-1">{t('cheques.overdue')}</span>}
                      </td>
                      {canManage && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {c.status === 'pending' && (
                            <>
                              <button disabled={busyId === c._id} className="btn-ghost !text-accent" onClick={() => updateStatus(c, 'clear')}>{t('cheques.markCleared')}</button>
                              <button disabled={busyId === c._id} className="btn-ghost !text-danger" onClick={() => updateStatus(c, 'bounce')}>{t('cheques.markBounced')}</button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <RecordChequeForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function RecordChequeForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [direction, setDirection] = useState('receivable');
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    customerId: '', supplierId: '', paymentAccountId: '', amount: '',
    chequeNumber: '', bankName: '', chequeDate: '', dueDate: '', note: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/cheques', {
        direction,
        customerId: direction === 'receivable' ? form.customerId : undefined,
        supplierId: direction === 'payable' ? form.supplierId : undefined,
        paymentAccountId: form.paymentAccountId,
        amount: Number(form.amount),
        chequeNumber: form.chequeNumber,
        bankName: form.bankName,
        chequeDate: form.chequeDate,
        dueDate: form.dueDate || form.chequeDate,
        note: form.note,
      });
      toast(t('cheques.chequeRecorded'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">{t('cheques.recordCheque')}</p>

        <div className="flex gap-1 mb-3 border-b border-rule">
          {[['receivable', t('cheques.fromCustomer')], ['payable', t('cheques.toSupplier')]].map(([key, label]) => (
            <button type="button" key={key} onClick={() => setDirection(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 font-semibold ${direction === key ? 'border-accent text-accent' : 'border-transparent text-ink-muted'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {direction === 'receivable' ? (
            <div>
              <label className="field-label">{t('cheques.fieldCustomer')}</label>
              <select required className="field-input" value={form.customerId} onChange={(e) => set('customerId', e.target.value)}>
                <option value="">{t('cheques.selectOption')}</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="field-label">{t('cheques.fieldSupplier')}</label>
              <select required className="field-input" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                <option value="">{t('cheques.selectOption')}</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="field-label">{t('cheques.fieldAccount')}</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => set('paymentAccountId', e.target.value)}>
              <option value="">{t('cheques.selectOption')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('cheques.fieldChequeNumber')}</label>
              <input required className="field-input" value={form.chequeNumber} onChange={(e) => set('chequeNumber', e.target.value)} />
            </div>
            <div>
              <label className="field-label">{t('cheques.fieldBankName')}</label>
              <input required className="field-input" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('cheques.fieldChequeDate')}</label>
              <input required type="date" className="field-input" value={form.chequeDate} onChange={(e) => set('chequeDate', e.target.value)} />
            </div>
            <div>
              <label className="field-label">{t('cheques.fieldDueDate')}</label>
              <input type="date" className="field-input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} placeholder={t('cheques.dueDateHint')} />
            </div>
          </div>
          <div>
            <label className="field-label">{t('cheques.fieldAmount')}</label>
            <input required type="number" min="0" step="0.01" className="field-input num" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('cheques.fieldNote')}</label>
            <input className="field-input" value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('cheques.recording') : t('cheques.recordCheque')}</button>
        </div>
      </form>
    </div>
  );
}
