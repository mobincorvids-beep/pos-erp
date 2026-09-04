import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatQty } from '../lib/format';

export function WarehouseZonesPage() {
  const { t } = useTranslation();
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
          <p className="page-title">{t('warehouseZones.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('warehouseZones.subtitle')}</p>
        </div>
        <select className="field-input w-auto" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-6">
        <button className={tab === 'bins' ? 'pill-active' : 'pill'} onClick={() => setTab('bins')}>
          <span className="material-symbols-outlined text-sm mr-1 align-middle">grid_view</span>
          {t('warehouseZones.zonesAndBins')}
        </button>
        <button className={tab === 'waves' ? 'pill-active' : 'pill'} onClick={() => setTab('waves')}>
          <span className="material-symbols-outlined text-sm mr-1 align-middle">route</span>
          {t('warehouseZones.pickWaves')}
        </button>
        <button className={tab === 'reorder' ? 'pill-active' : 'pill'} onClick={() => setTab('reorder')}>
          <span className="material-symbols-outlined text-sm mr-1 align-middle">inventory_2</span>
          {t('warehouseZones.reorderRules')}
        </button>
      </div>

      {!warehouseId && <EmptyState title={t('warehouseZones.noWarehouse')} description={t('warehouseZones.noWarehouseDescription')} />}
      {warehouseId && tab === 'bins' && <BinsTab warehouseId={warehouseId} />}
      {warehouseId && tab === 'waves' && <WavesTab warehouseId={warehouseId} />}
      {warehouseId && tab === 'reorder' && <ReorderRulesTab warehouseId={warehouseId} />}
    </div>
  );
}

function BinsTab({ warehouseId }) {
  const { t } = useTranslation();
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

  const zoneName = (id) => zones.find((z) => z._id === id)?.name || '-';

  if (loading) return <Loading />;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-base font-semibold text-ink">{t('warehouseZones.zones')}</p>
            <button className="btn-secondary" onClick={() => setShowZoneModal(true)}>
              <span className="material-symbols-outlined text-sm">add</span>
              {t('warehouseZones.addZone')}
            </button>
          </div>
          {zones.length === 0 && <EmptyState title={t('warehouseZones.noZonesYet')} description={t('warehouseZones.noZonesDescription')} />}
          {zones.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-rule bg-surface-sunken/60">
                      <th className="py-3 px-5 eyebrow font-medium">{t('warehouseZones.name')}</th>
                      <th className="py-3 px-5 eyebrow font-medium">{t('warehouseZones.code')}</th>
                      <th className="py-3 px-5 eyebrow font-medium">{t('warehouseZones.type')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {zones.map((z) => (
                      <tr key={z._id} className="hover:bg-accent-soft/30 transition-colors">
                        <td className="py-3 px-5 text-sm font-semibold text-ink">{z.name}</td>
                        <td className="py-3 px-5 text-sm text-ink-muted num">{z.code || '-'}</td>
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
            <p className="font-display text-base font-semibold text-ink">{t('warehouseZones.bins')}</p>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setShowAssignModal(true)}>{t('warehouseZones.assignStockToBin')}</button>
              <button className="btn-primary" onClick={() => setShowBinModal(true)}>
                <span className="material-symbols-outlined text-sm">add</span>
                {t('warehouseZones.addBin')}
              </button>
            </div>
          </div>
          {bins.length === 0 && <EmptyState title={t('warehouseZones.noBinsYet')} description={t('warehouseZones.noBinsDescription')} />}
          {bins.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-rule bg-surface-sunken/60">
                      <th className="py-3 px-5 eyebrow font-medium">{t('warehouseZones.binCode')}</th>
                      <th className="py-3 px-5 eyebrow font-medium">{t('warehouseZones.zone')}</th>
                      <th className="py-3 px-5 eyebrow font-medium text-right">{t('warehouseZones.capacity')}</th>
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
                        <td className="py-3 px-5 text-sm text-ink-muted num text-right">{b.capacity ?? '-'}</td>
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
        <p className="font-display text-base font-semibold text-ink mb-3">{t('warehouseZones.binStock')}</p>
        {summary.length === 0 && <EmptyState title={t('warehouseZones.noStockLocatedYet')} description={t('warehouseZones.noStockLocatedDescription')} />}
        {summary.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken/60">
                    <th className="py-3 px-4 eyebrow font-medium">{t('warehouseZones.bin')}</th>
                    <th className="py-3 px-4 eyebrow font-medium">{t('warehouseZones.product')}</th>
                    <th className="py-3 px-4 eyebrow font-medium text-right">{t('warehouseZones.qty')}</th>
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
  const { t } = useTranslation();
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
      toast(t('warehouseZones.zoneCreated'), 'success');
      onCreated(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">{t('warehouseZones.addZone')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('warehouseZones.name')}</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('warehouseZones.zoneNamePlaceholder')} />
          </div>
          <div>
            <label className="field-label">{t('warehouseZones.code')}</label>
            <input className="field-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Z-A" />
          </div>
          <div>
            <label className="field-label">{t('warehouseZones.type')}</label>
            <select className="field-input" value={type} onChange={(e) => setType(e.target.value)}>
              {['receiving', 'storage', 'picking', 'packing', 'shipping', 'other'].map((zt) => <option key={zt} value={zt}>{zt}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>{t('warehouseZones.cancel')}</button>
          <button className="btn-primary" disabled={busy || !name} onClick={save}>{t('warehouseZones.save')}</button>
        </div>
      </div>
    </div>
  );
}

function NewBinModal({ warehouseId, zones, onClose, onCreated }) {
  const { t } = useTranslation();
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
      toast(t('warehouseZones.binCreated'), 'success');
      onCreated(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">{t('warehouseZones.addBin')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('warehouseZones.binCode')}</label>
            <input className="field-input" value={binCode} onChange={(e) => setBinCode(e.target.value)} placeholder="A1-01" />
          </div>
          <div>
            <label className="field-label">{t('warehouseZones.zoneOptional')}</label>
            <select className="field-input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">{t('warehouseZones.unassigned')}</option>
              {zones.map((z) => <option key={z._id} value={z._id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('warehouseZones.capacityOptional')}</label>
            <input className="field-input num" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>{t('warehouseZones.cancel')}</button>
          <button className="btn-primary" disabled={busy || !binCode} onClick={save}>{t('warehouseZones.save')}</button>
        </div>
      </div>
    </div>
  );
}

function AssignStockModal({ bins, onClose, onCreated }) {
  const { t } = useTranslation();
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
      toast(t('warehouseZones.stockAssigned'), 'success');
      onCreated(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">{t('warehouseZones.assignStockToBin')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('warehouseZones.bin')}</label>
            <select className="field-input" value={binId} onChange={(e) => setBinId(e.target.value)}>
              {bins.map((b) => <option key={b._id} value={b._id}>{b.binCode}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('warehouseZones.productId')}</label>
            <input className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder={t('warehouseZones.pasteProductId')} />
          </div>
          <div>
            <label className="field-label">{t('warehouseZones.quantity')}</label>
            <input className="field-input num" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-3">{t('warehouseZones.assignQtyHint')}</p>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>{t('warehouseZones.cancel')}</button>
          <button className="btn-primary" disabled={busy || !binId || !productId || !quantity} onClick={save}>{t('warehouseZones.assign')}</button>
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
  const { t } = useTranslation();
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
          <p className="font-display text-base font-semibold text-ink">{t('warehouseZones.pickWaves')}</p>
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <span className="material-symbols-outlined text-sm">add</span>
            {t('warehouseZones.newPickWave')}
          </button>
        </div>
        {loading && <Loading />}
        {!loading && waves.length === 0 && <EmptyState title={t('warehouseZones.noPickWavesYet')} description={t('warehouseZones.noPickWavesDescription')} />}
        {!loading && waves.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken/60">
                    <th className="py-3 px-5 eyebrow font-medium">{t('warehouseZones.waveNumber')}</th>
                    <th className="py-3 px-5 eyebrow font-medium">{t('warehouseZones.status')}</th>
                    <th className="py-3 px-5 eyebrow font-medium text-right">{t('warehouseZones.sales')}</th>
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
  const { t } = useTranslation();
  const toast = useToast();
  const [saleIdsText, setSaleIdsText] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    const saleIds = saleIdsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (saleIds.length === 0) return;
    setBusy(true);
    try {
      await api.post('/pick-waves', { warehouseId, saleIds });
      toast(t('warehouseZones.pickWaveCreated'), 'success');
      onCreated(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">{t('warehouseZones.newPickWave')}</p>
        <label className="field-label">{t('warehouseZones.salesOrderIds')}</label>
        <textarea className="field-input" rows={4} value={saleIdsText} onChange={(e) => setSaleIdsText(e.target.value)} placeholder={t('warehouseZones.salesOrderIdsPlaceholder')} />
        <p className="text-xs text-ink-muted mt-3">{t('warehouseZones.waveAllocationHint')}</p>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>{t('warehouseZones.cancel')}</button>
          <button className="btn-primary" disabled={busy || !saleIdsText.trim()} onClick={create}>{t('warehouseZones.create')}</button>
        </div>
      </div>
    </div>
  );
}

function WavePanel({ wave, onClose, onChanged }) {
  const { t } = useTranslation();
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
      toast(t('warehouseZones.pickRecorded'), 'success');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function complete() {
    setBusy(true);
    try {
      await api.post(`/pick-waves/${wave._id}/complete`);
      toast(t('warehouseZones.waveCompleted'), 'success');
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
      {!loading && lines.length === 0 && <EmptyState title={t('warehouseZones.noLines')} description={t('warehouseZones.noLinesDescription')} />}
      {!loading && lines.length > 0 && (
        <div className="divide-y divide-rule">
          {lines.map((l) => (
            <div key={l._id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="text-ink">{l.productId?.name || l.productId}</p>
                <p className="text-xs text-ink-muted num mt-0.5">{t('warehouseZones.binQtyProgress', { bin: l.binId?.binCode || l.binId, picked: l.quantityPicked, toPick: l.quantityToPick })}</p>
              </div>
              {l.status !== 'picked'
                ? <button className="btn-secondary" disabled={busy} onClick={() => pick(l)}>{t('warehouseZones.pick')}</button>
                : <span className="chip-accent">{t('warehouseZones.picked')}</span>}
            </div>
          ))}
        </div>
      )}
      {!loading && lines.length > 0 && (
        <button className="btn-primary w-full mt-4" disabled={busy || wave.status === 'completed'} onClick={complete}>{t('warehouseZones.completeWave')}</button>
      )}
    </div>
  );
}

function ReorderRulesTab({ warehouseId }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [rules, setRules] = useState([]);
  const [belowPoint, setBelowPoint] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get(`/warehouse/rules?warehouseId=${warehouseId}`),
      api.get(`/warehouse/below-reorder-point?warehouseId=${warehouseId}`),
    ]).then(([r, b]) => { setRules(r); setBelowPoint(b); }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [warehouseId]);
  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  async function removeRule(id) {
    try {
      await api.del(`/warehouse/rules/${id}`);
      toast(t('warehouseZones.reorderRuleRemoved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {belowPoint.length > 0 && (
        <div className="card overflow-hidden border-warning/40">
          <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
            <p className="font-display font-bold text-ink">{t('warehouseZones.belowReorderPoint')}</p>
            <span className="chip-warning">{belowPoint.length}</span>
          </div>
          <div className="divide-y divide-rule">
            {belowPoint.map((p) => (
              <div key={p.productId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="text-ink">{p.productName}{p.sku ? ` (${p.sku})` : ''}</p>
                  <p className="text-xs text-ink-muted">{p.source === 'warehouse_rule' ? t('warehouseZones.perWarehouseRule') : t('warehouseZones.productDefault')}</p>
                </div>
                <span className="num text-ink-muted">{t('warehouseZones.onHandMin', { onHand: formatQty(p.onHand), min: formatQty(p.minQty) })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-ink">{t('warehouseZones.perWarehouseReorderRules')}</p>
            <p className="text-xs text-ink-muted mt-0.5">{t('warehouseZones.overridesGlobalHint')}</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>{t('warehouseZones.addRule')}</button>
        </div>
        {rules.length === 0
          ? <EmptyState title={t('warehouseZones.noWarehouseSpecificRules')} description={t('warehouseZones.noWarehouseSpecificRulesDescription')} />
          : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                  <th className="px-4 py-2.5 font-medium">{t('warehouseZones.product')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('warehouseZones.minQty')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('warehouseZones.maxQty')}</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r._id} className="border-b border-rule last:border-0">
                    <td className="px-4 py-2.5">{r.productId?.name || r.productId}</td>
                    <td className="px-4 py-2.5 num">{formatQty(r.minQty)}</td>
                    <td className="px-4 py-2.5 num">{r.maxQty != null ? formatQty(r.maxQty) : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="btn-ghost !text-danger" onClick={() => removeRule(r._id)}>{t('warehouseZones.remove')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {showForm && <ReorderRuleForm warehouseId={warehouseId} products={products} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ReorderRuleForm({ warehouseId, products, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [minQty, setMinQty] = useState(0);
  const [maxQty, setMaxQty] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/warehouse/rules', {
        warehouseId, productId, minQty: Number(minQty),
        maxQty: maxQty === '' ? null : Number(maxQty),
      });
      toast(t('warehouseZones.reorderRuleSaved'), 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('warehouseZones.addReorderRule')}</p>
        <label className="field-label">{t('warehouseZones.product')}</label>
        <select required className="field-input mb-3" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">{t('warehouseZones.selectAProduct')}</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div>
            <label className="field-label">{t('warehouseZones.minQtyReorderPoint')}</label>
            <input required type="number" min="0" className="field-input num" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('warehouseZones.maxQtyOptional')}</label>
            <input type="number" min="0" className="field-input num" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} placeholder={t('warehouseZones.maxQtyPlaceholder')} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('warehouseZones.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('warehouseZones.saving') : t('warehouseZones.save')}</button>
        </div>
      </form>
    </div>
  );
}
