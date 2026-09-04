import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { draft: 'chip-neutral', published: 'chip-accent' };

export function KnowledgeBasePage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const toast = useToast();
  const canManage = can('knowledge_base.manage');

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openArticle, setOpenArticle] = useState(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (statusFilter) params.set('status', statusFilter);
    const query = params.toString() ? `?${params.toString()}` : '';
    api.get(`/knowledge-base${query}`)
      .then(setArticles)
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [q, category, statusFilter]);

  const categories = [...new Set(articles.map((a) => a.category).filter(Boolean))];

  async function remove(article) {
    if (!window.confirm(t('knowledgeBase.confirmDelete', { title: article.title }))) return;
    try {
      await api.del(`/knowledge-base/${article._id}`);
      toast(t('knowledgeBase.articleDeleted'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function togglePublish(article) {
    try {
      const action = article.status === 'published' ? 'unpublish' : 'publish';
      await api.post(`/knowledge-base/${article._id}/${action}`, {});
      toast(action === 'publish' ? t('knowledgeBase.articlePublished') : t('knowledgeBase.articleMovedToDraft'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title">{t('knowledgeBase.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('knowledgeBase.subtitle')}</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <span className="material-symbols-outlined text-base leading-none">add</span>
            {t('knowledgeBase.newArticle')}
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-rule bg-surface-sunken/50">
          <input className="field-input max-w-xs" placeholder={t('knowledgeBase.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          {categories.length > 0 && (
            <select className="field-input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t('knowledgeBase.allCategories')}</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {canManage && (
            <div className="flex gap-1.5 ml-auto">
              {[['', t('knowledgeBase.all')], ['published', t('knowledgeBase.published')], ['draft', t('knowledgeBase.draft')]].map(([key, label]) => (
                <button key={key} onClick={() => setStatusFilter(key)} className={statusFilter === key ? 'pill-active' : 'pill'}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <div className="p-6"><Loading /></div>}
        {!loading && articles.length === 0 && (
          <div className="p-6">
            <EmptyState title={t('knowledgeBase.noArticles')} description={t('knowledgeBase.noArticlesDescription')} action={canManage && <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>{t('knowledgeBase.newArticle')}</button>} />
          </div>
        )}
        {!loading && articles.length > 0 && (
          <div>
            {articles.map((a) => (
              <div key={a._id} className="flex items-start justify-between gap-3 px-5 py-3 border-b border-rule last:border-0 hover:bg-surface-sunken/40 transition-colors">
                <button className="text-left flex-1" onClick={() => setOpenArticle(a)}>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{a.title}</p>
                    <span className={STATUS_CHIP[a.status]}>{a.status}</span>
                  </div>
                  <p className="text-ink-muted text-xs mt-0.5">
                    {a.category ? `${a.category} · ` : ''}{t('knowledgeBase.viewsHelpfulUpdated', { views: a.viewCount, helpful: a.helpfulCount, date: formatDate(a.updatedAt) })}
                  </p>
                  {a.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {a.tags.map((tag) => <span key={tag} className="chip-neutral">{tag}</span>)}
                    </div>
                  )}
                </button>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <button className="btn-ghost !text-accent" onClick={() => togglePublish(a)}>{a.status === 'published' ? t('knowledgeBase.unpublish') : t('knowledgeBase.publish')}</button>
                    <button className="btn-ghost" onClick={() => { setEditing(a); setShowForm(true); }}>{t('knowledgeBase.edit')}</button>
                    <button className="btn-ghost !text-danger" onClick={() => remove(a)}>{t('knowledgeBase.delete')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ArticleForm
          article={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
      {openArticle && (
        <ArticleDetail
          articleId={openArticle._id}
          onClose={() => { setOpenArticle(null); load(); }}
        />
      )}
    </div>
  );
}

function ArticleForm({ article, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({
    title: article?.title || '',
    body: article?.body || '',
    category: article?.category || '',
    tags: article?.tags?.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      body: form.body,
      category: form.category || null,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    };
    try {
      if (article) await api.put(`/knowledge-base/${article._id}`, payload);
      else await api.post('/knowledge-base', payload);
      toast(article ? t('knowledgeBase.articleUpdated') : t('knowledgeBase.articleCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-lg">
        <p className="font-display text-lg mb-4">{article ? t('knowledgeBase.editArticle') : t('knowledgeBase.newArticle')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('knowledgeBase.titleField')}</label>
            <input required className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('knowledgeBase.category')}</label>
            <input className="field-input" placeholder={t('knowledgeBase.categoryPlaceholder')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('knowledgeBase.tagsCommaSeparated')}</label>
            <input className="field-input" placeholder={t('knowledgeBase.tagsPlaceholder')} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('knowledgeBase.bodyField')}</label>
            <textarea required rows={10} className="field-input font-mono text-xs" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('knowledgeBase.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('knowledgeBase.saving') : t('knowledgeBase.save')}</button>
        </div>
      </form>
    </div>
  );
}

function ArticleDetail({ articleId, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [article, setArticle] = useState(null);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    api.get(`/knowledge-base/${articleId}`).then(setArticle).catch((err) => toast(err.message, 'error'));
    api.post(`/knowledge-base/${articleId}/view`, {}).catch(() => {});
  }, [articleId]);

  async function vote(helpful) {
    if (voted) return;
    try {
      const updated = await api.post(`/knowledge-base/${articleId}/vote`, { helpful });
      setArticle(updated);
      setVoted(true);
      toast(t('knowledgeBase.thanksForFeedback'), 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {!article && <Loading />}
        {article && (
          <>
            <div className="flex items-start justify-between mb-1">
              <p className="font-display text-xl">{article.title}</p>
              <button className="btn-ghost" onClick={onClose}>{t('knowledgeBase.close')}</button>
            </div>
            <p className="text-ink-muted text-xs mb-4">
              {article.category ? `${article.category} · ` : ''}{t('knowledgeBase.viewsUpdated', { views: article.viewCount, date: formatDate(article.updatedAt) })}
            </p>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{article.body}</div>
            {article.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-4">
                {article.tags.map((tag) => <span key={tag} className="chip-neutral">{tag}</span>)}
              </div>
            )}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-rule">
              <span className="text-sm text-ink-muted">{t('knowledgeBase.wasThisHelpful')}</span>
              <button className="btn-secondary" disabled={voted} onClick={() => vote(true)}>👍 {article.helpfulCount}</button>
              <button className="btn-secondary" disabled={voted} onClick={() => vote(false)}>👎 {article.notHelpfulCount}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
