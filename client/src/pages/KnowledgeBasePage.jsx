import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { draft: 'chip-neutral', published: 'chip-accent' };

export function KnowledgeBasePage() {
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
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    try {
      await api.del(`/knowledge-base/${article._id}`);
      toast('Article deleted.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function togglePublish(article) {
    try {
      const action = article.status === 'published' ? 'unpublish' : 'publish';
      await api.post(`/knowledge-base/${article._id}/${action}`, {});
      toast(action === 'publish' ? 'Article published.' : 'Article moved to draft.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title">Knowledge Base</p>
          <p className="text-sm text-ink-muted mt-1">SOPs and how-to articles for staff — also used to suggest relevant articles when a Helpdesk ticket is raised.</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <span className="material-symbols-outlined text-base leading-none">add</span>
            New article
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-rule bg-surface-sunken/50">
          <input className="field-input max-w-xs" placeholder="Search title, body, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
          {categories.length > 0 && (
            <select className="field-input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {canManage && (
            <div className="flex gap-1.5 ml-auto">
              {[['', 'All'], ['published', 'Published'], ['draft', 'Draft']].map(([key, label]) => (
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
            <EmptyState title="No articles" description="Write down how your team does things once, and let it deflect repeat Helpdesk tickets forever." action={canManage && <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>New article</button>} />
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
                    {a.category ? `${a.category} · ` : ''}{a.viewCount} views · {a.helpfulCount} helpful · updated {formatDate(a.updatedAt)}
                  </p>
                  {a.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {a.tags.map((t) => <span key={t} className="chip-neutral">{t}</span>)}
                    </div>
                  )}
                </button>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <button className="btn-ghost !text-accent" onClick={() => togglePublish(a)}>{a.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                    <button className="btn-ghost" onClick={() => { setEditing(a); setShowForm(true); }}>Edit</button>
                    <button className="btn-ghost !text-danger" onClick={() => remove(a)}>Delete</button>
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
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (article) await api.put(`/knowledge-base/${article._id}`, payload);
      else await api.post('/knowledge-base', payload);
      toast(article ? 'Article updated.' : 'Article created.', 'success');
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
        <p className="font-display text-lg mb-4">{article ? 'Edit article' : 'New article'}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Title</label>
            <input required className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Category</label>
            <input className="field-input" placeholder="e.g. Sales, Returns, POS…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Tags (comma-separated)</label>
            <input className="field-input" placeholder="return, refund, exchange…" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Body (Markdown/plain text)</label>
            <textarea required rows={10} className="field-input font-mono text-xs" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
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

function ArticleDetail({ articleId, onClose }) {
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
      toast('Thanks for the feedback!', 'success');
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
              <button className="btn-ghost" onClick={onClose}>Close</button>
            </div>
            <p className="text-ink-muted text-xs mb-4">
              {article.category ? `${article.category} · ` : ''}{article.viewCount} views · updated {formatDate(article.updatedAt)}
            </p>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{article.body}</div>
            {article.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-4">
                {article.tags.map((t) => <span key={t} className="chip-neutral">{t}</span>)}
              </div>
            )}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-rule">
              <span className="text-sm text-ink-muted">Was this helpful?</span>
              <button className="btn-secondary" disabled={voted} onClick={() => vote(true)}>👍 {article.helpfulCount}</button>
              <button className="btn-secondary" disabled={voted} onClick={() => vote(false)}>👎 {article.notHelpfulCount}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
