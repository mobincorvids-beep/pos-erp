import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatQty } from '../lib/format';

export function WarehouseZonesPage() {
  const toast = useToast();
  const [tab, setTab] = useState('bins'); // bins | waves
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');

  useEffect(() => {
    api.get('/org/warehouses').then((rows) => {
      setWarehouses(rows);
      if (rows.length) setWarehouseId(rows[0]._id);
    }).catch((err) => toast(err.message, 'error'));
  }, []);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="page-title">Warehouse locations</p>
          <p className="text-sm text-ink-muted mt-1">Manage zones, bins, and bin-level pick waves for a warehouse.</p>
        </div>
        <select className="field-input w-auto" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-6">
        <button className={tab === 'bins' ? 'pill-active' : 'pill'} onClick={() => setTab('bins')}>
          <span className="material-symbols-outlined text-sm mr-1 align-middle">grid_view</span>
          Zones &amp; bins
        </button>
        <button className={tab === 'waves' ? 'pill-active' : 'pill'} onClick={() => setTab('waves')}>
          <span className="material-symbols-outlined text-sm mr-1 align-middle">route</span>
          Pick waves
        </button>
      </div>

      {!warehouseId && <EmptyState title="No warehouse" description="Create a warehouse first to manage its locations." />}
      {warehouseId && tab === 'bins' && <BinsTab warehouseId={warehouseId} />}
      {warehouseId && tab === 'waves' && <WavesTab warehouseId={warehouseId} />}
    </div>
  );
}

function BinsTab({ warehouseId }) {
  const toast = useToast();
  const [zones, setZones] = useState([]);
  const [bins, setBins] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showBinModal, setShowBinModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get(`/warehouse/zones?warehouseId=${warehouseId}`),
      api.get(`/warehouse/bins?warehouseId=${warehouseId}`),
      api.get(`/warehouse/bin-stock/summary?warehouseId=${warehouseId}`),
    ]).then(([z, b, s]) => { setZones(z); setBins(b); setSummary(s); })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [warehouseId]);

  const zoneName = (id) => zones.find((z) => z._id === id)?.name || '—';

  if (loading) return <Loading />;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-base font-semibold text-ink">Zones</p>
            <button className="btn-secondary" onClick={() => setShowZoneModal(true)}>
              <span className="material-symbols-outlined text-sm">add</span>
              Add zone
            </button>
          </div>
          {zones.length === 0 && <EmptyState title="No zones yet" description="Zones group bins by function (receiving, storage, picking...)." />}
          {zones.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-rule bg-surface-sunken/60">
                      <th className="py-3 px-5 eyebrow font-medium">Name</th>
                      <th className="py-3 px-5 eyebrow font-medium">Code</th>
                      <th className="py-3 px-5 eyebrow font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {zones.map((z) => (
                      <tr key={z._id} className="hover:bg-accent-soft/30 transition-colors">
                        <td className="py-3 px-5 text-sm font-semibold text-ink">{z.name}</td>
                        <td className="py-3 px-5 text-sm text-ink-muted num">{z.code || '—'}</td>
                        <td className="py-3 px-5"><span className="chip-neutral capitalize">{z.type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-base font-semibold text-ink">Bins</p>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setShowAssignModal(true)}>Assign stock to bin</button>
              <button className="btn-primary" onClick={() => setShowBinModal(true)}>
                <span className="material-symbols-outlined text-sm">add</span>
                Add bin
              </button>
            </div>
          </div>
          {bins.length === 0 && <EmptyState title="No bins yet" description="Add bins to start locating stock within this warehouse." />}
          {bins.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-rule bg-surface-sunken/60">
                      <th className="py-3 px-5 eyebrow font-medium">Bin code</th>
                      <th className="py-3 px-5 eyebrow font-medium">Zone</th>
                      <th className="py-3 px-5 eyebrow font-medium text-right">Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {bins.map((b) => (
                      <tr key={b._id} className="hover:bg-accent-soft/30 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0">
                              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                            </div>
                            <span className="text-sm font-semibold text-ink num">{b.binCode}</span>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-sm text-ink-muted">{zoneName(b.zoneId)}</td>
                        <td className="py-3 px-5 text-sm text-ink-muted num text-right">{b.capacity ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-96 shrink-0">
        <p className="font-display text-base font-semibold text-ink mb-3">Bin stock</p>
        {summary.length === 0 && <EmptyState title="No stock located yet" description="Assign existing on-hand stock to bins to see the breakdown here." />}
        {summary.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken/60">
                    <th className="py-3 px-4 eyebrow font-medium">Bin</th>
                    <th className="py-3 px-4 eyebrow font-medium">Product</th>
                    <th className="py-3 px-4 eyebrow font-medium text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {summary.map((s) => (
                    <tr key={s._id} className="hover:bg-accent-soft/30 transition-colors">
                      <td className="py-3 px-4 text-sm num text-ink-muted">{s.binCode}</td>
                      <td className="py-3 px-4 text-sm text-ink">{s.productName}</td>
                      <td className="py-3 px-4 text-sm num text-right text-ink font-semibold">{formatQty(s.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showZoneModal && <NewZoneModal warehouseId={warehouseId} onClose={() => setShowZoneModal(false)} onCreated={load} />}
      {showBinModal && <NewBinModal warehouseId={warehouseId} zones={zones} onClose={() => setShowBinModal(false)} onCreated={load} />}
      {showAssignModal && <AssignStockModal warehouseId={warehouseId} bins={bins} onClose={() => setShowAssignModal(false)} onCreated={load} />}
    </div>
  );
}

function NewZoneModal({ warehouseId, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('storage');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name) return;
    setBusy(true);
    try {
      await api.post('/warehouse/zones', { warehouseId, name, code, type });
      toast('Zone created.', 'success');
      onCreated(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">Add zone</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Name</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bulk storage" />
          </div>
          <div>
            <label className="field-label">Code</label>
            <input className="field-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Z-A" />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select className="field-input" value={type} onChange={(e) => setType(e.target.value)}>
              {['receiving', 'storage', 'picking', 'packing', 'shipping', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !name} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

function NewBinModal({ warehouseId, zones, onClose, onCreated }) {
  const toast = useToast();
  const [binCode, setBinCode] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!binCode) return;
    setBusy(true);
    try {
      await api.post('/warehouse/bins', { warehouseId, binCode, zoneId: zoneId || null, capacity: capacity ? Number(capacity) : null });
      toast('Bin created.', 'success');
      onCreated(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">Add bin</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Bin code</label>
            <input className="field-input" value={binCode} onChange={(e) => setBinCode(e.target.value)} placeholder="A1-01" />
          </div>
          <div>
            <label className="field-label">Zone (optional)</label>
            <select className="field-input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">Unassigned</option>
              {zones.map((z) => <option key={z._id} value={z._id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Capacity (optional)</label>
            <input className="field-input num" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !binCode} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

function AssignStockModal({ bins, onClose, onCreated }) {
  const toast = useToast();
  const [binId, setBinId] = useState(bins[0]?._id || '');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!binId || !productId || !quantity) return;
    setBusy(true);
    try {
      await api.post('/warehouse/bin-stock/assign', { binId, productId, quantity: Number(quantity) });
      toast('Stock assigned to bin.', 'success');
      onCreated(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">Assign stock to bin</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Bin</label>
            <select className="field-input" value={binId} onChange={(e) => setBinId(e.target.value)}>
              {bins.map((b) => <option key={b._id} value={b._id}>{b.binCode}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Product ID</label>
            <input className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Paste product ID" />
          </div>
          <div>
            <label className="field-label">Quantity</label>
            <input className="field-input num" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-3">Cannot exceed the product's actual unassigned on-hand quantity at this warehouse.</p>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !binId || !productId || !quantity} onClick={save}>Assign</button>
        </div>
      </div>
    </div>
  );
}

const WAVE_STATUS_CHIP = {
  open: 'chip-info',
  picking: 'chip-warning',
  completed: 'chip-accent',
  cancelled: 'chip-danger',
};

function WavesTab({ warehouseId }) {
  const toast = useToast();
  const [waves, setWaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);

  function load() {
    setLoading(true);
    api.get(`/pick-waves?warehouseId=${warehouseId}`).then(setWaves).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [warehouseId]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-base font-semibold text-ink">Pick waves</p>
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <span className="material-symbols-outlined text-sm">add</span>
            New pick wave
          </button>
        </div>
        {loading && <Loading />}
        {!loading && waves.length === 0 && <EmptyState title="No pick waves yet" description="Create a wave from open sales orders to generate a bin-level pick list." />}
        {!loading && waves.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken/60">
                    <th className="py-3 px-5 eyebrow font-medium">Wave #</th>
                    <th className="py-3 px-5 eyebrow font-medium">Status</th>
                    <th className="py-3 px-5 eyebrow font-medium text-right">Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {waves.map((w) => (
                    <tr
                      key={w._id}
                      onClick={() => setSelected(w)}
                      className={`cursor-pointer transition-colors hover:bg-accent-soft/30 ${selected?._id === w._id ? 'bg-accent-soft/40' : ''}`}
                    >
                      <td className="py-3 px-5 text-sm font-semibold text-ink num">{w.waveNumber}</td>
                      <td className="py-3 px-5"><span className={`${WAVE_STATUS_CHIP[w.status] || 'chip-neutral'} capitalize`}>{w.status}</span></td>
                      <td className="py-3 px-5 text-sm text-ink-muted num text-right">{w.saleIds?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {selected && <WavePanel wave={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showNew && <NewWaveModal warehouseId={warehouseId} onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}

function NewWaveModal({ warehouseId, onClose, onCreated }) {
  const toast = useToast();
  const [saleIdsText, setSaleIdsText] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    const saleIds = saleIdsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (saleIds.length === 0) return;
    setBusy(true);
    try {
      await api.post('/pick-waves', { warehouseId, saleIds });
      toast('Pick wave created.', 'success');
      onCreated(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">New pick wave</p>
        <label className="field-label">Sales order IDs</label>
        <textarea className="field-input" rows={4} value={saleIdsText} onChange={(e) => setSaleIdsText(e.target.value)} placeholder="One ID per line, or comma-separated" />
        <p className="text-xs text-ink-muted mt-3">Allocates each line to whichever bin(s) currently hold enough stock, first-fit.</p>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !saleIdsText.trim()} onClick={create}>Create</button>
        </div>
      </div>
    </div>
  );
}

function WavePanel({ wave, onClose, onChanged }) {
  const toast = useToast();
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.get(`/pick-waves/${wave._id}/lines`).then(setLines).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [wave._id]);

  async function pick(line) {
    const remaining = line.quantityToPick - line.quantityPicked;
    setBusy(true);
    try {
      await api.post(`/pick-waves/${wave._id}/lines/${line._id}/pick`, { quantityPicked: remaining });
      toast('Pick recorded.', 'success');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function complete() {
    setBusy(true);
    try {
      await api.post(`/pick-waves/${wave._id}/complete`);
      toast('Wave completed.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-base font-semibold text-ink num">{wave.waveNumber}</p>
        <button className="text-ink-muted hover:text-ink" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      {loading && <Loading />}
      {!loading && lines.length === 0 && <EmptyState title="No lines" description="No bin stock could be allocated for this wave's products." />}
      {!loading && lines.length > 0 && (
        <div className="divide-y divide-rule">
          {lines.map((l) => (
            <div key={l._id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="text-ink">{l.productId?.name || l.productId}</p>
                <p className="text-xs text-ink-muted num mt-0.5">Bin {l.binId?.binCode || l.binId} — {l.quantityPicked}/{l.quantityToPick}</p>
              </div>
              {l.status !== 'picked'
                ? <button className="btn-secondary" disabled={busy} onClick={() => pick(l)}>Pick</button>
                : <span className="chip-accent">Picked</span>}
            </div>
          ))}
        </div>
      )}
      {!loading && lines.length > 0 && (
        <button className="btn-primary w-full mt-4" disabled={busy || wave.status === 'completed'} onClick={complete}>Complete wave</button>
      )}
    </div>
  );
}
