import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

/**
 * Price Lists — customer-group / quantity-slab pricing management. A price
 * list holds, per product, one or more quantity-break tiers; it can be
 * marked default, or tied to a PriceGroup, and a Customer is assigned one
 * directly (see CustomersPage's price list field). See priceListService.js.
 */
export function PriceListsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const toast = useToast();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit

  function load() {
    setLoading(true);
    api.get('/price-lists').then(setLists).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const canManage = can('price_lists.manage');

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="eyebrow mb-1">Pricing</p>
          <p className="page-title">{t('priceLists.title', 'Price Lists')}</p>
        </div>
        {canManage && <button className="btn-primary" onClick={() => setEditing({})}>{t('priceLists.newList', 'New price list')}</button>}
      </div>
      <p className="text-sm text-ink-muted mb-5">{t('priceLists.subtitle', 'Customer-group and quantity-slab pricing books — assign one to a customer to control what they pay.')}</p>

      {loading && <Loading />}
      {!loading && lists.length === 0 && (
        <EmptyState title={t('priceLists.emptyTitle', 'No price lists yet')} description={t('priceLists.emptyDescription', 'Create Retail, Wholesale, and Distributor price books with quantity-break tiers.')} action={canManage ? <button className="btn-primary" onClick={() => setEditing({})}>{t('priceLists.newList', 'New price list')}</button> : null} />
      )}

      {!loading && lists.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((pl) => (
            <div key={pl._id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-display text-base font-semibold">{pl.name}</p>
                  {pl.isDefault && <span className="chip-accent mt-1 inline-block">{t('priceLists.default', 'Default')}</span>}
                </div>
                {canManage && <button className="btn-ghost !text-ink-muted !px-2 text-xs" onClick={() => setEditing(pl)}>{t('common.edit')}</button>}
              </div>
              <p className="text-xs text-ink-muted">{t('priceLists.entryCount', '{{count}} product(s) priced', { count: pl.entries?.length || 0 })}</p>
            </div>
          ))}
        </div>
      )}

      {editing !== null && <PriceListForm list={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function PriceListForm({ list, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !list._id;
  const [name, setName] = useState(list.name || '');
  const [isDefault, setIsDefault] = useState(Boolean(list.isDefault));
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState(
    (list.entries || []).map((e) => ({
      productId: e.productId?._id || e.productId,
      tiers: e.tiers.map((tr) => ({ minQuantity: tr.minQuantity, unitPrice: tr.unitPrice })),
    }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/products').then((rows) => setProducts(rows.items || rows)).catch(() => setProducts([]));
  }, []);

  function addEntry() {
    setEntries((es) => [...es, { productId: '', tiers: [{ minQuantity: 1, unitPrice: 0 }] }]);
  }
  function removeEntry(i) {
    setEntries((es) => es.filter((_, idx) => idx !== i));
  }
  function updateEntry(i, field, value) {
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }
  function addTier(i) {
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, tiers: [...e.tiers, { minQuantity: '', unitPrice: '' }] } : e)));
  }
  function updateTier(i, ti, field, value) {
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, tiers: e.tiers.map((tr, tidx) => (tidx === ti ? { ...tr, [field]: value } : tr)) } : e)));
  }
  function removeTier(i, ti) {
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, tiers: e.tiers.filter((_, tidx) => tidx !== ti) } : e)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { toast(t('priceLists.nameRequired', 'Name is required.'), 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        name,
        isDefault,
        entries: entries
          .filter((en) => en.productId && en.tiers.length > 0)
          .map((en) => ({
            productId: en.productId,
            tiers: en.tiers.map((tr) => ({ minQuantity: Number(tr.minQuantity) || 1, unitPrice: Number(tr.unitPrice) || 0 })),
          })),
      };
      if (isNew) {
        await api.post('/price-lists', payload);
        toast(t('priceLists.created', 'Price list created.'), 'success');
      } else {
        await api.put(`/price-lists/${list._id}`, payload);
        toast(t('priceLists.updated', 'Price list updated.'), 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[2px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <p className="eyebrow mb-1">{isNew ? t('priceLists.addTitle', 'New price list') : t('priceLists.editTitle', 'Edit price list')}</p>
        <p className="font-display text-lg font-semibold mb-4">{isNew ? t('priceLists.newList', 'New price list') : list.name}</p>

        <div className="mb-4">
          <label className="field-label">{t('priceLists.fieldName', 'Name')}</label>
          <input required className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Wholesale" />
        </div>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          {t('priceLists.fieldDefault', 'Default price list (used when a customer has no list/group assigned)')}
        </label>

        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">{t('priceLists.products', 'Priced products')}</p>
          <button type="button" className="btn-secondary text-xs" onClick={addEntry}>{t('priceLists.addProduct', '+ Add product')}</button>
        </div>

        <div className="space-y-3">
          {entries.map((en, i) => (
            <div key={i} className="border border-rule rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <select className="field-input flex-1" value={en.productId} onChange={(e) => updateEntry(i, 'productId', e.target.value)}>
                  <option value="">{t('priceLists.selectProduct', 'Select product…')}</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
                <button type="button" className="btn-ghost !text-danger !px-2 text-xs" onClick={() => removeEntry(i)}>{t('common.remove', 'Remove')}</button>
              </div>
              <div className="space-y-1.5">
                {en.tiers.map((tr, ti) => (
                  <div key={ti} className="flex items-center gap-2">
                    <span className="text-xs text-ink-muted shrink-0 w-20">{t('priceLists.buyAtLeast', 'From qty')}</span>
                    <input type="number" min="1" className="field-input num" value={tr.minQuantity} onChange={(e) => updateTier(i, ti, 'minQuantity', e.target.value)} />
                    <span className="text-xs text-ink-muted shrink-0">{t('priceLists.atPrice', '@ price')}</span>
                    <input type="number" min="0" step="0.01" className="field-input num" value={tr.unitPrice} onChange={(e) => updateTier(i, ti, 'unitPrice', e.target.value)} />
                    <button type="button" className="btn-ghost !px-2 text-xs" onClick={() => removeTier(i, ti)}>×</button>
                  </div>
                ))}
                <button type="button" className="text-xs text-accent font-semibold hover:underline" onClick={() => addTier(i)}>{t('priceLists.addTier', '+ Add quantity tier')}</button>
              </div>
            </div>
          ))}
          {entries.length === 0 && <p className="text-xs text-ink-muted">{t('priceLists.noProductsYet', 'No products priced yet — add one above.')}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('common.saving') : t('common.save')}</button>
        </div>
      </form>
    </div>
  );
}
