import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatMoney, toDateInputValue } from '../lib/format';

const STATUS_CHIP = {
  draft: 'chip-neutral', active: 'chip-accent', expiring_soon: 'chip-warning',
  expired: 'chip-danger', terminated: 'chip-danger', renewed: 'chip-neutral',
};
const TYPE_LABEL_KEYS = {
  customer: 'contracts.typeCustomer', supplier: 'contracts.typeSupplier', lease: 'contracts.typeLease',
  employment: 'contracts.typeEmployment', nda: 'contracts.typeNda',
  service_agreement: 'contracts.typeServiceAgreement', other: 'contracts.typeOther',
};
const STATUS_LABEL_KEYS = {
  draft: 'contracts.statusDraft', active: 'contracts.statusActive', expiring_soon: 'contracts.statusExpiringSoon',
  expired: 'contracts.statusExpired', terminated: 'contracts.statusTerminated', renewed: 'contracts.statusRenewed',
};

export function ContractsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('contractType', typeFilter);
    const qs = params.toString();
    api.get(`/contracts${qs ? `?${qs}` : ''}`).then(setContracts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter, typeFilter]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title mb-1">{t('contracts.title')}</p>
          <p className="text-sm text-ink-muted">{t('contracts.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('contracts.newContract')}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select className="field-input !w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('contracts.allStatuses')}</option>
          {Object.keys(STATUS_CHIP).map((s) => <option key={s} value={s}>{t(STATUS_LABEL_KEYS[s])}</option>)}
        </select>
        <select className="field-input !w-48" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t('contracts.allTypes')}</option>
          {Object.entries(TYPE_LABEL_KEYS).map(([key, labelKey]) => <option key={key} value={key}>{t(labelKey)}</option>)}
        </select>
      </div>

      {loading && <Loading />}
      {!loading && contracts.length === 0 && (
        <EmptyState title={t('contracts.noContracts')} description={t('contracts.noContractsDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('contracts.newContract')}</button>} />
      )}
      {!loading && contracts.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">{t('contracts.number')}</th>
                <th className="py-3 px-4 font-semibold">{t('contracts.titleColumn')}</th>
                <th className="py-3 px-4 font-semibold">{t('contracts.type')}</th>
                <th className="py-3 px-4 font-semibold">{t('contracts.counterparty')}</th>
                <th className="py-3 px-4 font-semibold text-right">{t('contracts.endDate')}</th>
                <th className="py-3 px-4 font-semibold">{t('contracts.status')}</th>
                <th className="py-3 px-4 font-semibold text-center">{t('contracts.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {contracts.map((c) => (
                <tr key={c._id} className="group hover:bg-accent-soft/40 transition-colors cursor-pointer" onClick={() => setDetailId(c._id)}>
                  <td className="py-3 px-4 num text-accent">{c.contractNumber}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink">{c.title}</div>
                    <div className="text-xs text-ink-muted">{t(TYPE_LABEL_KEYS[c.contractType])}</div>
                  </td>
                  <td className="py-3 px-4 text-ink-muted">{t(TYPE_LABEL_KEYS[c.contractType])}</td>
                  <td className="py-3 px-4 text-ink-muted">{c.counterpartyName}</td>
                  <td className={`py-3 px-4 num text-right ${c.status === 'expiring_soon' ? 'text-warning font-semibold' : 'text-ink-muted'}`}>{formatDate(c.endDate)}</td>
                  <td className="py-3 px-4"><span className={STATUS_CHIP[c.status]}>{t(STATUS_LABEL_KEYS[c.status])}</span></td>
                  <td className="py-3 px-4 text-center">
                    <button
                      className="btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setDetailId(c._id); }}
                    >
                      {t('contracts.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ContractForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {detailId && <ContractDetail contractId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

function ContractForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [title, setTitle] = useState('');
  const [contractType, setContractType] = useState('customer');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [startDate, setStartDate] = useState(toDateInputValue());
  const [endDate, setEndDate] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const [renewalNoticeDays, setRenewalNoticeDays] = useState(30);
  const [attachmentNote, setAttachmentNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/contracts', {
        branchId, title, contractType, counterpartyName,
        value: value === '' ? null : Number(value), currency,
        startDate, endDate, autoRenew, renewalNoticeDays: Number(renewalNoticeDays),
        attachmentNote,
      });
      toast(t('contracts.contractCreated'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('contracts.newContract')}</p>

        <div className="mb-3">
          <label className="field-label">{t('contracts.titleColumn')}</label>
          <input required className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('contracts.titlePlaceholder')} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t('contracts.branchPlaceholder')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select className="field-input" value={contractType} onChange={(e) => setContractType(e.target.value)}>
            {Object.entries(TYPE_LABEL_KEYS).map(([key, labelKey]) => <option key={key} value={key}>{t(labelKey)}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="field-label">{t('contracts.counterpartyName')}</label>
          <input required className="field-input" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} placeholder={t('contracts.counterpartyPlaceholder')} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <input type="date" required className="field-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" required className="field-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <input type="number" step="0.01" className="field-input num" placeholder={t('contracts.valueOptional')} value={value} onChange={(e) => setValue(e.target.value)} />
          <input className="field-input" placeholder={t('contracts.currency')} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <input type="number" min="0" className="field-input num" placeholder={t('contracts.renewalNoticeDays')} value={renewalNoticeDays} onChange={(e) => setRenewalNoticeDays(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 mb-3 text-sm text-ink">
          <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
          {t('contracts.autoRenews')}
        </label>

        <div className="mb-4">
          <label className="field-label">{t('contracts.attachmentNote')}</label>
          <input className="field-input" value={attachmentNote} onChange={(e) => setAttachmentNote(e.target.value)} placeholder={t('contracts.attachmentNotePlaceholder')} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('contracts.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('contracts.creating') : t('contracts.createContract')}</button>
        </div>
      </form>
    </div>
  );
}

function ContractDetail({ contractId, onClose, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTerminate, setShowTerminate] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.get(`/contracts/${contractId}`).then(setContract).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [contractId]);

  async function activate() {
    setBusy(true);
    try {
      await api.post(`/contracts/${contractId}/activate`, {});
      toast(t('contracts.contractActivated'), 'success');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {loading && <div className="p-5"><Loading /></div>}
        {!loading && contract && (
          <>
            <div className="p-5 border-b border-rule flex items-start justify-between">
              <div>
                <p className="eyebrow text-accent mb-1">{contract.contractNumber}</p>
                <p className="font-display text-xl font-bold text-ink">{contract.title}</p>
              </div>
              <button className="btn-ghost !p-2" onClick={onClose} aria-label={t('contracts.close')}>
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-lg bg-surface-sunken p-3">
                  <p className="field-label mb-1">{t('contracts.status')}</p>
                  <span className={STATUS_CHIP[contract.status]}>{t(STATUS_LABEL_KEYS[contract.status])}</span>
                </div>
                <div className="rounded-lg bg-surface-sunken p-3">
                  <p className="field-label mb-1">{t('contracts.value')}</p>
                  <p className="num text-ink font-semibold">{contract.value != null ? formatMoney(contract.value, contract.currency) : '-'}</p>
                </div>
              </div>

              <p className="field-label border-b border-rule pb-2 mb-3">{t('contracts.keyDatesDetails')}</p>
              <div className="flex flex-col gap-2 text-sm mb-5">
                <div className="flex justify-between"><span className="text-ink-muted">{t('contracts.type')}</span><span className="text-ink">{t(TYPE_LABEL_KEYS[contract.contractType])}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">{t('contracts.counterparty')}</span><span className="text-ink">{contract.counterpartyName}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">{t('contracts.startDate')}</span><span className="num text-ink">{formatDate(contract.startDate)}</span></div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">{t('contracts.endDate')}</span>
                  <span className={`num ${contract.status === 'expiring_soon' ? 'text-warning font-semibold' : 'text-ink'}`}>{formatDate(contract.endDate)}</span>
                </div>
                <div className="flex justify-between"><span className="text-ink-muted">{t('contracts.autoRenew')}</span><span className="text-ink">{contract.autoRenew ? t('contracts.yes') : t('contracts.no')}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">{t('contracts.owner')}</span><span className="text-ink">{contract.ownerUserId?.name || '-'}</span></div>
                {contract.renewedFromContractId && (
                  <div className="flex justify-between"><span className="text-ink-muted">{t('contracts.renewedFrom')}</span><span className="num text-ink">{contract.renewedFromContractId.contractNumber}</span></div>
                )}
              </div>

              {(contract.terminationReason || contract.attachmentNote) && (
                <div className="rounded-lg bg-accent-soft/50 border border-accent-soft p-3 mb-5 flex flex-col gap-3">
                  {contract.terminationReason && (
                    <div>
                      <p className="text-xs font-semibold text-ink mb-1">{t('contracts.terminationReason')}</p>
                      <p className="rounded bg-surface px-2 py-1.5 text-sm text-ink-muted">{contract.terminationReason}</p>
                    </div>
                  )}
                  {contract.attachmentNote && (
                    <div>
                      <p className="text-xs font-semibold text-ink mb-1">{t('contracts.attachmentNote')}</p>
                      <p className="rounded bg-surface px-2 py-1.5 text-sm text-ink-muted">{contract.attachmentNote}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  {contract.status === 'draft' && (
                    <button className="btn-primary" disabled={busy} onClick={activate}>{t('contracts.activate')}</button>
                  )}
                  {['active', 'expiring_soon'].includes(contract.status) && (
                    <>
                      <button className="btn-secondary" onClick={() => setShowRenew(true)}>{t('contracts.renew')}</button>
                      <button className="btn-ghost !text-danger" onClick={() => setShowTerminate(true)}>{t('contracts.terminate')}</button>
                    </>
                  )}
                </div>
                <button className="btn-secondary" onClick={onClose}>{t('contracts.close')}</button>
              </div>

              {showTerminate && (
                <TerminateForm
                  onClose={() => setShowTerminate(false)}
                  onDone={() => { setShowTerminate(false); load(); onChanged(); }}
                  contractId={contractId}
                />
              )}
              {showRenew && (
                <RenewForm
                  onClose={() => setShowRenew(false)}
                  onDone={() => { setShowRenew(false); load(); onChanged(); }}
                  contractId={contractId}
                  contract={contract}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TerminateForm({ contractId, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/contracts/${contractId}/terminate`, { terminationReason: reason });
      toast(t('contracts.contractTerminated'), 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-rule">
      <label className="field-label">{t('contracts.terminationReason')}</label>
      <input required className="field-input mb-2" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>{t('contracts.cancel')}</button>
        <button type="submit" disabled={saving} className="btn-primary !bg-danger">{saving ? t('contracts.terminating') : t('contracts.confirmTerminate')}</button>
      </div>
    </form>
  );
}

function RenewForm({ contractId, contract, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [startDate, setStartDate] = useState(toDateInputValue(contract.endDate));
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState(contract.value ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/contracts/${contractId}/renew`, { startDate, endDate, value: value === '' ? undefined : Number(value) });
      toast(t('contracts.contractRenewed'), 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-rule">
      <p className="field-label mb-1">{t('contracts.newTerm')}</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="date" required className="field-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" required className="field-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <input type="number" step="0.01" className="field-input num mb-2" placeholder={t('contracts.valueOptional')} value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>{t('contracts.cancel')}</button>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? t('contracts.renewing') : t('contracts.confirmRenew')}</button>
      </div>
    </form>
  );
}
