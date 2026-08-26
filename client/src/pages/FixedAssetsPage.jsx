import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function FixedAssetsPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [disposing, setDisposing] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  function load() {
    setLoading(true);
    api.get('/fixed-assets').then(setAssets).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="font-display text-lg">Fixed Assets</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Register asset</button>
      </div>

      {loading && <Loading />}
      {!loading && assets.length === 0 && <EmptyState title="No fixed assets registered" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Register one</button>} />}

      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assets.map((a) => (
            <div key={a._id} className="card p-3">
              <p className="text-sm font-medium">{a.name}</p>
              {a.category && <p className="text-xs text-ink-muted">{a.category}</p>}
              <p className="num text-sm mt-1">{formatMoney(a.purchaseCost, company?.currency)}</p>
              <p className="text-xs text-ink-muted mt-0.5 capitalize">{a.status}</p>
              <div className="flex gap-3 mt-2">
                <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setHistoryFor(a)}>Maintenance history</button>
                {a.status === 'active' && <button className="btn-ghost !text-red-600 !px-0 text-xs" onClick={() => setDisposing(a)}>Dispose</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <AssetForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {disposing && <DisposeForm asset={disposing} onClose={() => setDisposing(null)} onSaved={() => { setDisposing(null); load(); }} />}
      {historyFor && <HistoryPanel asset={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function AssetForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    branchId: '', name: '', category: '', assetAccountId: '', depreciationExpenseAccountId: '',
    accumulatedDepreciationAccountId: '', purchaseDate: '', purchaseCost: '', usefulLifeMonths: 60, salvageValue: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/fixed-assets', { ...form, purchaseCost: Number(form.purchaseCost), usefulLifeMonths: Number(form.usefulLifeMonths), salvageValue: Number(form.salvageValue) });
      toast('Asset registered.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4 py-8 overflow-y-auto">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">Register a fixed asset</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <input required className="field-input" placeholder="Asset name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field-input" placeholder="Category (optional)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <div>
            <label className="field-label">Asset account (balance sheet)</label>
            <select required className="field-input" value={form.assetAccountId} onChange={(e) => setForm({ ...form, assetAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Depreciation expense account</label>
            <select required className="field-input" value={form.depreciationExpenseAccountId} onChange={(e) => setForm({ ...form, depreciationExpenseAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Accumulated depreciation account</label>
            <select required className="field-input" value={form.accumulatedDepreciationAccountId} onChange={(e) => setForm({ ...form, accumulatedDepreciationAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Purchase date</label><input type="date" required className="field-input" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></div>
          <div><label className="field-label">Purchase cost</label><input type="number" min="0.01" required className="field-input num" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Useful life (months)</label><input type="number" min="1" required className="field-input num" value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })} /></div>
            <div><label className="field-label">Salvage value</label><input type="number" min="0" className="field-input num" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Registering…' : 'Register'}</button>
        </div>
      </form>
    </div>
  );
}

function DisposeForm({ asset, onClose, onSaved }) {
  const toast = useToast();
  const [disposalProceeds, setDisposalProceeds] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/fixed-assets/${asset._id}/dispose`, { disposalProceeds: Number(disposalProceeds) });
      toast('Asset disposed.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg mb-4">Dispose — {asset.name}</p>
        <label className="field-label">Disposal proceeds</label>
        <input type="number" min="0" required className="field-input num" value={disposalProceeds} onChange={(e) => setDisposalProceeds(e.target.value)} />
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !bg-red-600 hover:!bg-red-700">{saving ? 'Disposing…' : 'Confirm dispose'}</button>
        </div>
      </form>
    </div>
  );
}

function HistoryPanel({ asset, onClose }) {
  const [history, setHistory] = useState(null);
  useEffect(() => { api.get(`/maintenance/assets/${asset._id}/history`).then(setHistory).catch(() => {}); }, [asset._id]);

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Maintenance history — {asset.name}</p>
        {!history && <Loading />}
        {history && (
          <div className="space-y-2 text-sm">
            <p>Completed work orders: <span className="num">{history.completedWorkOrders}</span></p>
            <p>Total downtime: <span className="num">{history.totalDowntimeHours}</span> hours</p>
            <p>Total cost: <span className="num">{history.totalCost}</span></p>
          </div>
        )}
        <div className="flex justify-end mt-5"><button className="btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
