import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function AutoPartsPage() {
  const [tab, setTab] = useState('lookup');
  return (
    <div>
      <p className="page-title mb-4">Auto Parts</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['lookup', 'What fits my car'], ['fitments', 'Add fitment']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>
      {tab === 'lookup' && <LookupTab />}
      {tab === 'fitments' && <FitmentTab />}
    </div>
  );
}

function LookupTab() {
  const toast = useToast();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams({ year });
      if (make) params.set('make', make);
      if (model) params.set('model', model);
      const rows = await api.get(`/auto-parts/lookup?${params.toString()}`);
      setResults(rows);
    } catch (err) { toast(err.message, 'error'); } finally { setLoading(false); }
  }

  return (
    <div>
      <form onSubmit={search} className="card p-4 mb-4">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <input placeholder="Make" className="field-input" value={make} onChange={(e) => setMake(e.target.value)} />
          <input placeholder="Model" className="field-input" value={model} onChange={(e) => setModel(e.target.value)} />
          <input type="number" placeholder="Year" required className="field-input num" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Searching…' : 'Find parts'}</button>
      </form>
      {results && results.length === 0 && <EmptyState title="No matching parts found" />}
      {results && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((r) => (
            <div key={r.fitmentId} className="card p-3">
              <p className="text-sm font-medium">{r.productName}</p>
              <p className="text-xs text-ink-muted">SKU {r.sku}</p>
              <p className="num text-sm text-accent-strong mt-1">{formatMoney(r.sellingPrice)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FitmentTab() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: '', make: '', model: '', yearFrom: '', yearTo: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auto-parts/fitments', { ...form, yearFrom: Number(form.yearFrom), yearTo: Number(form.yearTo) });
      toast('Fitment added.', 'success');
      setForm({ productId: '', make: '', model: '', yearFrom: '', yearTo: '' });
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 max-w-sm">
      <p className="text-sm font-medium mb-3">Register which vehicles a part fits</p>
      <div className="space-y-3">
        <div><label className="field-label">Product</label><select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">Select…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2"><input placeholder="Make" required className="field-input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /><input placeholder="Model" required className="field-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2"><input type="number" placeholder="Year from" required className="field-input num" value={form.yearFrom} onChange={(e) => setForm({ ...form, yearFrom: e.target.value })} /><input type="number" placeholder="Year to" required className="field-input num" value={form.yearTo} onChange={(e) => setForm({ ...form, yearTo: e.target.value })} /></div>
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full mt-4">{saving ? 'Saving…' : 'Add fitment'}</button>
    </form>
  );
}
