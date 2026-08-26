import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatMoney, toDateInputValue } from '../lib/format';

const STATUS_CHIP = {
  draft: 'chip-neutral', active: 'chip-accent', expiring_soon: 'chip-warning',
  expired: 'chip-danger', terminated: 'chip-danger', renewed: 'chip-neutral',
};
const TYPE_LABEL = {
  customer: 'Customer', supplier: 'Supplier', lease: 'Lease', employment: 'Employment',
  nda: 'NDA', service_agreement: 'Service agreement', other: 'Other',
};

export function ContractsPage() {
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
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Contracts &amp; legal</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New contract</button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select className="field-input !w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_CHIP).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className="field-input !w-48" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {loading && <Loading />}
      {!loading && contracts.length === 0 && (
        <EmptyState title="No contracts" description="Supplier agreements, customer contracts, leases, NDAs, service agreements — track every formal agreement's term, renewal, and status in one place." action={<button className="btn-primary" onClick={() => setShowForm(true)}>New contract</button>} />
      )}
      {!loading && contracts.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Number</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Counterparty</th>
                <th className="px-3 py-2 font-medium">End date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2 text-ink-muted">{c.contractNumber}</td>
                  <td className="px-3 py-2">{c.title}</td>
                  <td className="px-3 py-2 text-ink-muted">{TYPE_LABEL[c.contractType]}</td>
                  <td className="px-3 py-2 text-ink-muted">{c.counterpartyName}</td>
                  <td className={`px-3 py-2 ${c.status === 'expiring_soon' ? 'text-warning' : 'text-ink-muted'}`}>{formatDate(c.endDate)}</td>
                  <td className="px-3 py-2"><span className={STATUS_CHIP[c.status]}>{c.status.replace('_', ' ')}</span></td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn-ghost" onClick={() => setDetailId(c._id)}>View</button>
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
      toast('Contract created.', 'success');
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
        <p className="font-display text-lg mb-4">New contract</p>

        <div className="mb-3">
          <label className="field-label">Title</label>
          <input required className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Acme Supply Agreement 2026" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select className="field-input" value={contractType} onChange={(e) => setContractType(e.target.value)}>
            {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="field-label">Counterparty name</label>
          <input required className="field-input" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} placeholder="The other party to this agreement" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <input type="date" required className="field-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" required className="field-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <input type="number" step="0.01" className="field-input num" placeholder="Value (optional)" value={value} onChange={(e) => setValue(e.target.value)} />
          <input className="field-input" placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <input type="number" min="0" className="field-input num" placeholder="Renewal notice days" value={renewalNoticeDays} onChange={(e) => setRenewalNoticeDays(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 mb-3 text-sm">
          <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
          Auto-renews
        </label>

        <div className="mb-4">
          <label className="field-label">Attachment note</label>
          <input className="field-input" value={attachmentNote} onChange={(e) => setAttachmentNote(e.target.value)} placeholder="e.g. see Contracts drive, Acme-NDA-2026.pdf" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create contract'}</button>
        </div>
      </form>
    </div>
  );
}

function ContractDetail({ contractId, onClose, onChanged }) {
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
      toast('Contract activated.', 'success');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {loading && <Loading />}
        {!loading && contract && (
          <>
            <div className="flex items-center justify-between mb-1">
              <p className="font-display text-lg">{contract.title}</p>
              <span className={STATUS_CHIP[contract.status]}>{contract.status.replace('_', ' ')}</span>
            </div>
            <p className="text-xs text-ink-muted mb-4">{contract.contractNumber}</p>

            <div className="grid grid-cols-2 gap-y-2 text-sm mb-4">
              <div><p className="field-label">Type</p><p>{TYPE_LABEL[contract.contractType]}</p></div>
              <div><p className="field-label">Counterparty</p><p>{contract.counterpartyName}</p></div>
              <div><p className="field-label">Start date</p><p>{formatDate(contract.startDate)}</p></div>
              <div><p className="field-label">End date</p><p className={contract.status === 'expiring_soon' ? 'text-warning' : ''}>{formatDate(contract.endDate)}</p></div>
              <div><p className="field-label">Value</p><p>{contract.value != null ? formatMoney(contract.value, contract.currency) : '—'}</p></div>
              <div><p className="field-label">Auto-renew</p><p>{contract.autoRenew ? 'Yes' : 'No'}</p></div>
              <div><p className="field-label">Owner</p><p>{contract.ownerUserId?.name || '—'}</p></div>
              {contract.renewedFromContractId && (
                <div><p className="field-label">Renewed from</p><p>{contract.renewedFromContractId.contractNumber}</p></div>
              )}
              {contract.terminationReason && (
                <div className="col-span-2"><p className="field-label">Termination reason</p><p>{contract.terminationReason}</p></div>
              )}
              {contract.attachmentNote && (
                <div className="col-span-2"><p className="field-label">Attachment note</p><p className="text-ink-muted">{contract.attachmentNote}</p></div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {contract.status === 'draft' && (
                  <button className="btn-primary" disabled={busy} onClick={activate}>Activate</button>
                )}
                {['active', 'expiring_soon'].includes(contract.status) && (
                  <>
                    <button className="btn-secondary" onClick={() => setShowRenew(true)}>Renew</button>
                    <button className="btn-ghost !text-danger" onClick={() => setShowTerminate(true)}>Terminate</button>
                  </>
                )}
              </div>
              <button className="btn-secondary" onClick={onClose}>Close</button>
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
          </>
        )}
      </div>
    </div>
  );
}

function TerminateForm({ contractId, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/contracts/${contractId}/terminate`, { terminationReason: reason });
      toast('Contract terminated.', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-rule">
      <label className="field-label">Termination reason</label>
      <input required className="field-input mb-2" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary !bg-danger">{saving ? 'Terminating…' : 'Confirm terminate'}</button>
      </div>
    </form>
  );
}

function RenewForm({ contractId, contract, onClose, onDone }) {
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
      toast('Contract renewed.', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-rule">
      <p className="field-label mb-1">New term</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="date" required className="field-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" required className="field-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <input type="number" step="0.01" className="field-input num mb-2" placeholder="Value (optional)" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Renewing…' : 'Confirm renew'}</button>
      </div>
    </form>
  );
}
