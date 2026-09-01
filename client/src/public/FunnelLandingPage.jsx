import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

// The actual public page a customer visits, e.g. https://app.example/f/summer-sale
// No auth, no AppLayout/Sidebar — a clean standalone page, styled like
// client/src/portal/PortalApp.jsx's LoginPage (min-h-screen, centered
// card, same field-input/btn-primary utility classes as the rest of the
// app). Hits the PUBLIC backend router (src/routes/publicFunnelRoutes.js,
// mounted at /public/funnels — no JWT required) via the same `api` fetch
// wrapper the authenticated app uses; that wrapper only *attaches* a
// token when one happens to be in localStorage, it never requires one, so
// it works fine for an anonymous visitor here too.
export function FunnelLandingPage() {
  const { slug } = useParams();
  const [funnel, setFunnel] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/funnels/${slug}`)
      .then((data) => { if (!cancelled) setFunnel(data); })
      .catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [slug]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/public/funnels/${slug}/submit`, values);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-muted">This page isn't available.</p>
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card p-6 w-full max-w-lg">
        <p className="font-display text-2xl mb-2">{funnel.headline || funnel.name}</p>
        {funnel.bodyContent && (
          <p className="text-sm text-ink-muted mb-5 whitespace-pre-wrap">{funnel.bodyContent}</p>
        )}

        {submitted ? (
          <p className="text-sm text-accent-strong">Thanks — we've got your details and will be in touch.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {(funnel.formFields || []).map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="block text-ink-muted mb-1">
                  {field.label}{field.required && <span className="text-red-600"> *</span>}
                </span>
                {field.type === 'textarea' ? (
                  <textarea
                    className="field-input w-full"
                    rows={4}
                    required={field.required}
                    value={values[field.key] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    className="field-input w-full"
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                    required={field.required}
                    value={values[field.key] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  />
                )}
              </label>
            ))}
            <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
