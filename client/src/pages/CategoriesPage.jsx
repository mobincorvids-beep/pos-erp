import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function CategoriesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null); // null closed, { parentId, category } for the form
  const [reseeding, setReseeding] = useState(false);

  function load() {
    setLoading(true);
    api.get('/categories/tree').then(setTree).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function toggle(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleRemove(category) {
    if (!window.confirm(t('categories.confirmRemove', { name: category.name }))) return;
    try {
      await api.del(`/categories/${category._id}`);
      toast(t('categories.categoryRemoved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleReseed() {
    setReseeding(true);
    try {
      const result = await api.post('/categories/reseed-defaults');
      toast(t('categories.defaultCategoriesApplied', { count: result.created }), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setReseeding(false);
    }
  }

  const totalSubcategories = tree.reduce((sum, c) => sum + c.children.length, 0);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="page-title">{t('categories.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('categories.topLevelCount', { count: tree.length })} · {t('categories.subcategoryCount', { count: totalSubcategories })}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleReseed} disabled={reseeding}>
            <span className="font-icon text-[18px] leading-none">refresh</span>
            {reseeding ? t('categories.applying') : t('categories.reseedDefaultCategories')}
          </button>
          <button className="btn-primary" onClick={() => setEditing({ parentId: null, category: null })}>
            <span className="font-icon text-[18px] leading-none">add</span>
            {t('categories.newCategory')}
          </button>
        </div>
      </div>

      {loading && <Loading />}

      {!loading && tree.length === 0 && (
        <EmptyState
          title={t('categories.noCategoriesYet')}
          description={t('categories.emptyDescription')}
          action={
            <div className="flex gap-2 justify-center">
              <button className="btn-secondary" onClick={handleReseed} disabled={reseeding}>{reseeding ? t('categories.applying') : t('categories.useDefaultCategories')}</button>
              <button className="btn-primary" onClick={() => setEditing({ parentId: null, category: null })}>{t('categories.newCategory')}</button>
            </div>
          }
        />
      )}

      {!loading && tree.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('categories.categoryTree')}</p>
          </div>
          <div className="divide-y divide-rule">
            {tree.map((category) => (
              <div key={category._id}>
                <div className="flex items-center gap-2 px-5 py-3 hover:bg-accent-soft/20 transition-colors group">
                  <button
                    className="text-ink-muted w-5 shrink-0"
                    onClick={() => toggle(category._id)}
                    disabled={category.children.length === 0}
                    aria-label={t('categories.expand')}
                  >
                    <span className="font-icon text-[20px] leading-none">
                      {category.children.length === 0 ? 'remove' : (expanded[category._id] ? 'expand_more' : 'chevron_right')}
                    </span>
                  </button>
                  <span className="text-sm font-semibold text-ink flex-1">{category.name}</span>
                  {category.children.length > 0 && (
                    <span className="chip-neutral !text-xs">{t('categories.subcategoryCount', { count: category.children.length })}</span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="btn-ghost !text-ink-muted !px-2 text-xs" onClick={() => setEditing({ parentId: category._id, category: null })}>{t('categories.addSubcategory')}</button>
                    <button className="btn-ghost !text-ink-muted !px-2 text-xs" onClick={() => setEditing({ parentId: null, category })}>{t('categories.edit')}</button>
                    <button className="btn-ghost !text-danger !px-2 text-xs" onClick={() => handleRemove(category)}>{t('categories.remove')}</button>
                  </div>
                </div>
                {expanded[category._id] && category.children.map((sub) => (
                  <div key={sub._id} className="flex items-center gap-2 pl-14 pr-5 py-2.5 border-t border-rule/60 bg-surface-sunken/20 hover:bg-accent-soft/20 transition-colors group">
                    <span className="text-sm text-ink flex-1">{sub.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="btn-ghost !text-ink-muted !px-2 text-xs" onClick={() => setEditing({ parentId: category._id, category: sub })}>{t('categories.edit')}</button>
                      <button className="btn-ghost !text-danger !px-2 text-xs" onClick={() => handleRemove(sub)}>{t('categories.remove')}</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {editing !== null && (
        <CategoryForm
          parentId={editing.parentId}
          category={editing.category}
          topLevelOptions={tree}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CategoryForm({ parentId, category, topLevelOptions, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !category;
  const isSubcategory = !!parentId;
  const [name, setName] = useState(category?.name || '');
  const [selectedParentId, setSelectedParentId] = useState(parentId || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/categories', { name, parentId: selectedParentId || null });
        toast(selectedParentId ? t('categories.subcategoryCreated') : t('categories.categoryCreated'), 'success');
      } else {
        await api.put(`/categories/${category._id}`, { name });
        toast(t('categories.categoryUpdated'), 'success');
      }
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
        <p className="font-display text-lg font-bold text-ink mb-4">
          {isNew ? (isSubcategory ? t('categories.newSubcategory') : t('categories.newCategory')) : t('categories.editCategory')}
        </p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('categories.name')}</label>
            <input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {isNew && (
            <div>
              <label className="field-label">{t('categories.type')}</label>
              <select
                className="field-input"
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
              >
                <option value="">{t('categories.topLevelCategory')}</option>
                {topLevelOptions.map((c) => (
                  <option key={c._id} value={c._id}>{t('categories.subcategoryOf', { name: c.name })}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('categories.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('categories.saving') : t('categories.save')}</button>
        </div>
      </form>
    </div>
  );
}
