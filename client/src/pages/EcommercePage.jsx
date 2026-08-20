import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';

export function EcommercePage() {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ defaultBranchId: '', defaultWarehouseId: '', defaultPaymentAccountId: '' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/ecommerce-config').then((c) => {
      setConfig(c);
      setForm({
        defaultBranchId: c.defaultBranchId || '', defaultWarehouseId: c.defaultWarehouseId || '',
        defaultPaymentAccountId: c.defaultPaymentAccountId || '',
      });
    }).catch((err) => toast(err.message, 'error'));
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }
  useEffect(load, []);
  useEffect(() => { if (form.defaultBranchId) api.get(`/org/warehouses?branchId=${form.defaultBranchId}`).then(setWarehouses).catch(() => {}); }, [form.defaultBranchId]);

  async function enable() {
    setBusy(true);
    try {
      const res = await api.post('/ecommerce-config/enable', form);
      setResult(res);
      toast('E-commerce integration enabled.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await api.post('/ecommerce-config/disable');
      toast('Integration disabled.', 'success');
      setResult(null);
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  if (!config) return <Loading />;

  return (
    <div>
      <p className="page-title mb-1">E-commerce integration</p>
      <p className="text-sm text-ink-muted mb-6">Lets an external store post orders and pull your live catalog — orders go through the exact same checkout as the counter, just tagged as an online sale.</p>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-4">
          <p className="text-sm font-medium mb-3">Configuration</p>
          <div className="space-y-3">
            <div>
              <label className="field-label">Default branch</label>
              <select className="field-input" value={form.defaultBranchId} onChange={(e) => setForm({ ...form, defaultBranchId: e.target.value })}>
                <option value="">Select…</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Default warehouse (stock is drawn from here)</label>
              <select className="field-input" value={form.defaultWarehouseId} onChange={(e) => setForm({ ...form, defaultWarehouseId: e.target.value })} disabled={!form.defaultBranchId}>
                <option value="">Select…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Settlement account (where online payments land)</label>
              <select className="field-input" value={form.defaultPaymentAccountId} onChange={(e) => setForm({ ...form, defaultPaymentAccountId: e.target.value })}>
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary flex-1" disabled={busy || !form.defaultBranchId || !form.defaultWarehouseId || !form.defaultPaymentAccountId} onClick={enable}>
              {config.enabled ? 'Save & rotate token' : 'Enable integration'}
            </button>
            {config.enabled && <button className="btn-secondary" disabled={busy} onClick={disable}>Disable</button>}
          </div>
        </div>

        <div className="card p-4">
          <p className="text-sm font-medium mb-3">Status</p>
          <p className="text-sm mb-2">
            <span className={config.enabled ? 'chip-accent' : 'chip-neutral'}>{config.enabled ? 'Enabled' : 'Not enabled'}</span>
          </p>
          {result && (
            <>
              <p className="text-xs text-ink-muted mb-1">Webhook token (shown once — copy it now):</p>
              <p className="num text-xs bg-paper border border-rule rounded p-2 mb-3 break-all">{result.webhookToken}</p>
              <p className="text-xs text-ink-muted mb-1">Order webhook:</p>
              <p className="num text-xs break-all mb-2">{result.webhookUrl}</p>
              <p className="text-xs text-ink-muted mb-1">Product feed:</p>
              <p className="num text-xs break-all">{result.productFeedUrl}</p>
            </>
          )}
          {!result && config.enabled && (
            <p className="text-xs text-ink-muted">Rotate the token above to see it again — it's never shown after the first time for security.</p>
          )}
        </div>
      </div>
    </div>
  );
}
