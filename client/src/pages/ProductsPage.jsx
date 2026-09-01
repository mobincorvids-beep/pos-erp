import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';
import { ImportCsvModal } from '../components/ImportCsvModal';
import { FieldError, errorInputClass } from '../components/FieldError';
import { validate, validateRequired, validateNonNegativeNumber, hasErrors } from '../lib/validation';

export function ProductsPage() {
  const { t } = useTranslation();
  const TRACKING_LABELS = {
    simple: t('products.trackingLabels.simple'),
    variant: t('products.trackingLabels.variant'),
    batch: t('products.trackingLabels.batch'),
    serial: t('products.trackingLabels.serial'),
    weight: t('products.trackingLabels.weight'),
    bundle: t('products.trackingLabels.bundle'),
    service: t('products.trackingLabels.service'),
  };
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  function load() {
    setLoading(true);
    api.get('/products').then(setProducts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleRemove(p) {
    if (!window.confirm(t('products.removeConfirm', { name: p.name }))) return;
    try {
      await api.del(`/products/${p._id}`);
      toast(t('products.removed'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  const lowStockCount = products.filter((p) => p.reorderLevel != null && p.minStock != null && Number(p.minStock) <= Number(p.reorderLevel)).length;

  const filtered = products.filter((p) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title">{t('products.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('products.subtitle', { count: products.length })}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setImportOpen(true)}>
            <span className="font-icon text-[18px] leading-none">upload_file</span>
            {t('products.importCsv')}
          </button>
          <button className="btn-primary" onClick={() => setEditing({})}>
            <span className="font-icon text-[18px] leading-none">add</span>
            {t('products.newProduct')}
          </button>
        </div>
      </div>

      {loading && <Loading />}

      {!loading && products.length === 0 && (
        <EmptyState
          title={t('products.emptyTitle')}
          description={t('products.emptyDescription')}
          action={<button className="btn-primary" onClick={() => setEditing({})}>{t('products.addProduct')}</button>}
        />
      )}

      {!loading && products.length > 0 && (
        <>
          {/* Catalog overview strip */}
          <div className="grid grid-cols-12 gap-6 mb-6">
            <div className="col-span-12 lg:col-span-4 card p-6">
              <p className="font-display text-lg font-semibold text-accent mb-4">{t('products.catalogOverview')}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-sunken p-4 rounded-lg">
                  <p className="eyebrow mb-1">{t('products.totalItems')}</p>
                  <p className="font-display text-3xl font-bold text-accent num">{products.length}</p>
                </div>
                <div className="bg-surface-sunken p-4 rounded-lg">
                  <p className="eyebrow mb-1">{t('products.reorderAlerts')}</p>
                  <p className="font-display text-3xl font-bold text-danger num">{lowStockCount}</p>
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-8 card p-6 flex flex-col justify-center">
              <p className="font-display text-lg font-semibold text-accent mb-2">{t('products.trackingModesInUse')}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TRACKING_LABELS).map(([key, label]) => {
                  const count = products.filter((p) => p.trackingMode === key).length;
                  if (!count) return null;
                  return <span key={key} className="chip-neutral">{label} · <span className="num">{count}</span></span>;
                })}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-5 border-b border-rule flex items-center justify-between gap-4 flex-wrap">
              <p className="font-display text-lg font-semibold text-accent">{t('products.currentCatalog')}</p>
              <div className="relative">
                <span className="font-icon text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">search</span>
                <input
                  type="text"
                  className="field-input !w-64 pl-9"
                  placeholder={t('products.searchPlaceholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left bg-surface-sunken">
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide">{t('products.colSku')}</th>
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide">{t('products.colName')}</th>
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide">{t('products.colTracking')}</th>
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide text-right">{t('products.colCost')}</th>
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide text-right">{t('products.colPrice')}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const lowStock = p.reorderLevel != null && p.minStock != null && Number(p.minStock) <= Number(p.reorderLevel);
                  return (
                    <tr
                      key={p._id}
                      className={`border-b border-rule last:border-0 hover:bg-paper cursor-pointer group ${lowStock ? 'bg-danger-soft/30' : ''}`}
                      onClick={() => setEditing(p)}
                    >
                      <td className="px-6 py-3 num text-ink-muted">{p.sku || '-'}</td>
                      <td className="px-6 py-3 font-medium text-ink">
                        <span className="inline-flex items-center gap-2">
                          {p.name}
                          {lowStock && <span className="font-icon text-[16px] text-danger" title={t('products.lowStock')}>warning</span>}
                        </span>
                      </td>
                      <td className="px-6 py-3"><span className="chip-neutral capitalize">{TRACKING_LABELS[p.trackingMode] || p.trackingMode}</span></td>
                      <td className="px-6 py-3 num text-right">{formatMoney(p.costPrice, company?.currency)}</td>
                      <td className="px-6 py-3 num text-right text-accent-strong font-medium">{formatMoney(p.sellingPrice, company?.currency)}</td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <button
                          className="btn-ghost !text-ink-muted !px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          className="btn-ghost !text-danger !px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); handleRemove(p); }}
                        >
                          {t('common.remove')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-ink-muted">{t('products.noMatch', { query })}</td></tr>
                )}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-rule bg-surface-sunken flex items-center justify-between">
              <span className="text-sm text-ink-muted">{t('products.showing', { shown: filtered.length, total: products.length, count: products.length })}</span>
            </div>
          </div>
        </>
      )}

      {editing !== null && <ProductForm product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      {importOpen && (
        <ImportCsvModal
          endpoint="/products/import-csv"
          title={t('products.importCsv')}
          templateHeaders={['name', 'sku', 'barcode', 'category', 'subcategory', 'unit', 'costPrice', 'sellingPrice', 'openingStock', 'minStock', 'reorderLevel']}
          templateFilename="product_import_template.csv"
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !product._id;
  const [form, setForm] = useState({
    name: product.name || '', sku: product.sku || '', barcode: product.barcode || '',
    costPrice: product.costPrice ?? '', sellingPrice: product.sellingPrice ?? '',
    minStock: product.minStock ?? '', reorderLevel: product.reorderLevel ?? '',
    trackingMode: product.trackingMode || 'simple',
    description: product.description || '',
  });
  const [images, setImages] = useState(product.images || []);
  const MAX_IMAGES = 4;
  const MAX_DIMENSION = 800;
  const JPEG_QUALITY = 0.7;

  // Downscale to ~800px on the longest side and export as JPEG at ~0.7 quality, so
  // the resulting base64 string stays well under the 1.5MB per-image cap enforced
  // server-side (see Product.js / productController.js) — this app has no cloud/
  // object storage, so images are stored as data-URI strings on the product itself.
  function resizeImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not decode image file.'));
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleImagesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast(t('products.tooManyImages'), 'error');
      return;
    }
    const toProcess = files.slice(0, room);
    if (files.length > toProcess.length) toast(t('products.tooManyImages'), 'error');
    try {
      const resized = await Promise.all(toProcess.map(resizeImageFile));
      setImages((prev) => [...prev, ...resized]);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function removeImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }
  const [categoryTree, setCategoryTree] = useState([]);
  // Existing products may have a categoryId that's itself a subcategory — resolve
  // which top-level row to preselect from the tree once it's loaded.
  const [topCategoryId, setTopCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({});

  const rules = {
    name: (v) => validateRequired(v, 'Name'),
    costPrice: (v) => validateNonNegativeNumber(v, 'Cost price', { required: false }),
    sellingPrice: (v) => validateNonNegativeNumber(v, 'Selling price'),
    minStock: (v) => (isNew ? null : validateNonNegativeNumber(v, 'Min stock', { required: false })),
    reorderLevel: (v) => (isNew ? null : validateNonNegativeNumber(v, 'Reorder level', { required: false })),
  };
  const errors = validate(form, rules);
  // Business-rule warning (not a hard error): selling below cost is unusual but not invalid
  // (e.g. clearance stock), so it never blocks submit — just flags it for a second look.
  const sellingBelowCost = form.costPrice !== '' && form.sellingPrice !== ''
    && Number(form.sellingPrice) < Number(form.costPrice);

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  useEffect(() => {
    api.get('/categories/tree').then((tree) => {
      setCategoryTree(tree);
      const currentId = product.categoryId?._id || product.categoryId;
      if (!currentId) return;
      const asTop = tree.find((c) => c._id === currentId);
      if (asTop) { setTopCategoryId(asTop._id); return; }
      for (const top of tree) {
        const asSub = top.children.find((c) => c._id === currentId);
        if (asSub) { setTopCategoryId(top._id); setSubCategoryId(asSub._id); return; }
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTop = categoryTree.find((c) => c._id === topCategoryId);
  const effectiveCategoryId = subCategoryId || topCategoryId;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, costPrice: true, sellingPrice: true, minStock: true, reorderLevel: true });
    if (!effectiveCategoryId) {
      setError(t('products.chooseCategory'));
      return;
    }
    if (hasErrors(errors)) {
      setError(t('products.fixFields'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await api.post('/products', {
          name: form.name, sku: form.sku || undefined, barcode: form.barcode || undefined,
          categoryId: effectiveCategoryId,
          trackingMode: form.trackingMode,
          description: form.description || undefined,
          images: images.length ? images : undefined,
          costPrice: Number(form.costPrice) || 0, sellingPrice: Number(form.sellingPrice) || 0,
          variants: [{ sku: form.sku || undefined, barcode: form.barcode || undefined, sellingPrice: Number(form.sellingPrice) || 0 }],
        });
        toast(t('products.created'), 'success');
      } else {
        await api.put(`/products/${product._id}`, {
          name: form.name, sku: form.sku || undefined, barcode: form.barcode || undefined,
          categoryId: effectiveCategoryId,
          description: form.description || undefined,
          images,
          costPrice: Number(form.costPrice) || 0, sellingPrice: Number(form.sellingPrice) || 0,
          minStock: Number(form.minStock) || 0, reorderLevel: Number(form.reorderLevel) || 0,
        });
        toast(t('products.updated'), 'success');
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-md">
        <p className="font-display text-lg mb-4">{isNew ? t('products.newProduct') : t('products.editProduct')}</p>
        {error && <p className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm mb-3">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="field-label">{t('products.fieldName')}</label>
            <input
              required autoFocus maxLength={200}
              className={`field-input ${errorInputClass(touched.name && errors.name)}`}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => markTouched('name')}
              aria-invalid={Boolean(touched.name && errors.name)}
            />
            <FieldError message={touched.name ? errors.name : null} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('products.fieldCategory')}</label>
              <select
                required className="field-input"
                value={topCategoryId}
                onChange={(e) => { setTopCategoryId(e.target.value); setSubCategoryId(''); }}
              >
                <option value="">{t('common.select')}</option>
                {categoryTree.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{t('products.fieldSubcategory')} {selectedTop?.children.length ? '' : t('products.subcategoryNone')}</label>
              <select
                className="field-input"
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                disabled={!selectedTop?.children.length}
              >
                <option value="">{t('common.none')}</option>
                {selectedTop?.children.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('products.fieldSku')}</label>
              <input className="field-input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('products.fieldBarcode')}</label>
              <input className="field-input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('products.fieldCostPrice')}</label>
              <input
                type="number" step="0.01" min="0"
                className={`field-input num ${errorInputClass(touched.costPrice && errors.costPrice)}`}
                value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                onBlur={() => markTouched('costPrice')}
                aria-invalid={Boolean(touched.costPrice && errors.costPrice)}
              />
              <FieldError message={touched.costPrice ? errors.costPrice : null} />
            </div>
            <div>
              <label className="field-label">{t('products.fieldSellingPrice')}</label>
              <input
                type="number" step="0.01" min="0" required
                className={`field-input num ${errorInputClass(touched.sellingPrice && errors.sellingPrice)}`}
                value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                onBlur={() => markTouched('sellingPrice')}
                aria-invalid={Boolean(touched.sellingPrice && errors.sellingPrice)}
              />
              <FieldError message={touched.sellingPrice ? errors.sellingPrice : null} />
              {!errors.sellingPrice && sellingBelowCost && (
                <p className="mt-1 text-xs font-medium text-warning">{t('products.sellingBelowCost')}</p>
              )}
            </div>
          </div>
          {!isNew && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">{t('products.fieldMinStock')}</label>
                <input
                  type="number" min="0"
                  className={`field-input num ${errorInputClass(touched.minStock && errors.minStock)}`}
                  value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  onBlur={() => markTouched('minStock')}
                  aria-invalid={Boolean(touched.minStock && errors.minStock)}
                />
                <FieldError message={touched.minStock ? errors.minStock : null} />
              </div>
              <div>
                <label className="field-label">{t('products.fieldReorderLevel')}</label>
                <input
                  type="number" min="0"
                  className={`field-input num ${errorInputClass(touched.reorderLevel && errors.reorderLevel)}`}
                  value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                  onBlur={() => markTouched('reorderLevel')}
                  aria-invalid={Boolean(touched.reorderLevel && errors.reorderLevel)}
                />
                <FieldError message={touched.reorderLevel ? errors.reorderLevel : null} />
              </div>
            </div>
          )}
          <div>
            <label className="field-label">{t('products.fieldTrackingMode')}</label>
            {isNew ? (
              <select className="field-input" value={form.trackingMode} onChange={(e) => setForm({ ...form, trackingMode: e.target.value })}>
                <option value="simple">{t('products.trackingOptions.simple')}</option>
                <option value="variant">{t('products.trackingOptions.variant')}</option>
                <option value="batch">{t('products.trackingOptions.batch')}</option>
                <option value="serial">{t('products.trackingOptions.serial')}</option>
                <option value="weight">{t('products.trackingOptions.weight')}</option>
                <option value="bundle">{t('products.trackingOptions.bundle')}</option>
                <option value="service">{t('products.trackingOptions.service')}</option>
              </select>
            ) : (
              <p className="text-sm text-ink-muted">{form.trackingMode} <span className="text-xs">{t('products.trackingLocked')}</span></p>
            )}
          </div>
          <div>
            <label className="field-label">{t('products.fieldDescription')}</label>
            <textarea
              rows={3}
              maxLength={2000}
              className="field-input resize-none"
              placeholder={t('products.descriptionPlaceholder')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">{t('products.fieldImages')}</label>
            <p className="text-xs text-ink-muted mb-2">{t('products.imagesHint')}</p>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {images.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-rule" />
                    <button
                      type="button"
                      className="btn-danger !p-0 !w-5 !h-5 !min-h-0 rounded-full absolute -top-2 -right-2 flex items-center justify-center leading-none text-xs"
                      onClick={() => removeImage(i)}
                      aria-label={t('products.removeImage')}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length < MAX_IMAGES && (
              <input
                type="file"
                accept="image/*"
                multiple
                className="field-input"
                onChange={handleImagesSelected}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving || hasErrors(errors)} className="btn-primary">{saving ? t('common.saving') : t('products.saveProduct')}</button>
        </div>
      </form>
    </div>
  );
}
