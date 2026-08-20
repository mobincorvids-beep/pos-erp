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
        {[['lookup', 'Find parts for a vehicle'], ['manage', 'Manage fitments']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'lookup' && <LookupTab />}
      {tab === 'manage' && <ManageFitmentsTab />}
    </div>
  );
}

function LookupTab() {
  const toast = useToast();
  const [form, setForm] = useState({ make: '', model: '', year: '' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (form.make) params.set('make', form.make);
      if (form.model) params.set('model', form.model);
      params.set('year', form.year);
      const rows = await api.get(`/auto-parts/lookup?${params.toString()}`);
      setResults(rows);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="card p-4 flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="field-label">Make</label>
          <input className="field-input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Toyota" />
        </div>
        <div>
          <label className="field-label">Model</label>
          <input className="field-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. Corolla" />
        </div>
        <div>
          <label className="field-label">Year</label>
          <input type="number" required className="field-input num" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2018" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Searching…' : 'Find parts'}</button>
      </form>

      {loading && <Loading />}
      {!loading && results !== null && results.length === 0 && <EmptyState title="No parts found" description="No fitment records match that vehicle." />}
      {!loading && results && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((r) => (
            <div key={r.fitmentId} className="card p-3">
              <p className="text-sm font-medium">{r.productName}</p>
              <p className="text-xs text-ink-muted mt-1">SKU {r.sku}</p>
              <p className="num text-sm text-accent-strong mt-1">{formatMoney(r.sellingPrice)}</p>
              <p className="text-xs text-ink-muted mt-1">{r.make} {r.model} · {r.yearFrom}–{r.yearTo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManageFitmentsTab() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [fitments, setFitments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch((err) => toast(err.message, 'error')); }, []);

  function loadFitments() {
    if (!productId) return;
    setLoading(true);
    api.get(`/auto-parts/products/${productId}/fitments`).then(setFitments).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(loadFitments, [productId]);

  async function handleDelete(id) {
    try {
      await api.del(`/auto-parts/fitments/${id}`);
      toast('Fitment removed.', 'success');
      loadFitments();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="card p-4 mb-5">
        <label className="field-label">Product</label>
        <select className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select a product…</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
        </select>
      </div>

      {!productId && <EmptyState title="Pick a product" description="Select a product above to view or manage its vehicle fitments." />}

      {productId && (
        <div>
          <div className="flex justify-end mb-3">
            <button className="btn-primary" onClick={() => setShowForm(true)}>Add fitment</button>
          </div>
          {loading && <Loading />}
          {!loading && fitments.length === 0 && (
            <EmptyState title="No fitments yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a fitment</button>} />
          )}
          {!loading && fitments.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-ink-muted">
                    <th className="px-3 py-2 font-medium">Make</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium">Years</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {fitments.map((f) => (
                    <tr key={f._id} className="border-b border-rule last:border-b-0">
                      <td className="px-3 py-2">{f.make}</td>
                      <td className="px-3 py-2">{f.model}</td>
                      <td className="px-3 py-2 num">{f.yearFrom}–{f.yearTo}</td>
                      <td className="px-3 py-2 text-right">
                        <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => handleDelete(f._id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <FitmentForm productId={productId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadFitments(); }} />
      )}
    </div>
  );
}

function FitmentForm({ productId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ make: '', model: '', yearFrom: '', yearTo: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auto-parts/fitments', {
        productId,
        make: form.make,
        model: form.model,
        yearFrom: Number(form.yearFrom),
        yearTo: Number(form.yearTo),
      });
      toast('Fitment added.', 'success');
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
        <p className="font-display text-lg mb-4">New fitment</p>
        <div className="space-y-3">
          <div><label className="field-label">Make</label><input required autoFocus className="field-input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Toyota" /></div>
          <div><label className="field-label">Model</label><input required className="field-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. Corolla" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Year from</label><input type="number" required className="field-input num" value={form.yearFrom} onChange={(e) => setForm({ ...form, yearFrom: e.target.value })} /></div>
            <div><label className="field-label">Year to</label><input type="number" required className="field-input num" value={form.yearTo} onChange={(e) => setForm({ ...form, yearTo: e.target.value })} /></div>
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
