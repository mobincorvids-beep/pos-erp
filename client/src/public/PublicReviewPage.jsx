import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { api } from '../api/client';

// Public, token-based review-collection page — e.g.
// https://app.example/review/<token>. Same standalone-page pattern as
// FunnelLandingPage.jsx: no auth, no AppLayout, hits the public backend
// router (src/routes/publicReviewRoutes.js, mounted at /public/reviews).
export function PublicReviewPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { rating, offerShare }
  const [shared, setShared] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/reviews/${token}`)
      .then((data) => { if (!cancelled) setInfo(data); })
      .catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (!rating) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/public/reviews/${token}/respond`, { rating, feedback });
      setResult(res);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function share() {
    try {
      await api.post(`/public/reviews/${token}/share`, {});
      setShared(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-muted">This review link isn't valid.</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  if (info.status === 'responded' && !result) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 w-full max-w-md text-center">
          <p className="text-sm text-ink-muted">You've already submitted feedback for this — thank you!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card p-6 w-full max-w-md">
        {!result ? (
          <>
            <p className="font-display text-2xl mb-1">How was your experience{info.customerName ? `, ${info.customerName}` : ''}?</p>
            <p className="text-sm text-ink-muted mb-5">We'd love to hear how we did.</p>
            <form onSubmit={submit} className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} onClick={() => setRating(n)} className="p-1">
                    <Star size={32} className={n <= rating ? 'text-warning fill-warning' : 'text-rule'} />
                  </button>
                ))}
              </div>
              <textarea className="field-input w-full" rows={4} placeholder="Tell us more (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <button type="submit" disabled={submitting || !rating} className="btn-primary w-full">
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <p className="font-display text-xl mb-2">Thanks for your feedback!</p>
            {result.offerShare && !shared && (
              <>
                <p className="text-sm text-ink-muted mb-4">We're glad you had a great experience. Would you be OK with us sharing that internally as a highlight?</p>
                <button className="btn-primary" onClick={share}>Yes, share it</button>
              </>
            )}
            {shared && <p className="text-sm text-accent-strong">Thanks — noted!</p>}
            {!result.offerShare && <p className="text-sm text-ink-muted">We're sorry it wasn't a great experience — someone from our team will follow up.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
