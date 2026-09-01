import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Backend always responds success here (never reveals whether the
      // email exists), so this just shows the generic message on any 2xx.
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent text-white font-display font-bold text-xl flex items-center justify-center shadow-sm">
            M
          </div>
          <p className="font-display text-2xl font-bold text-ink mt-3">Muhasib</p>
          <p className="eyebrow mt-1">Reset your password</p>
        </div>

        {sent ? (
          <div className="card overflow-hidden">
            <div className="h-1.5 bg-accent" />
            <div className="p-6 space-y-4 text-center">
              <p className="page-title text-lg mb-1">Check your email</p>
              <p className="text-sm text-ink-muted">If that email exists, we've sent a link to reset your password.</p>
              <Link to="/login" className="btn-primary w-full inline-flex">Back to sign in</Link>
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="h-1.5 bg-accent" />
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <p className="page-title text-lg mb-1">Forgot password</p>

              {error && (
                <div className="chip-danger !inline-block w-full !rounded-lg px-3 py-2 text-sm">{error}</div>
              )}
              <div>
                <label className="field-label" htmlFor="email">Email</label>
                <input
                  id="email" type="email" required autoFocus
                  className="field-input"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@demo.test"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </div>
        )}

        <p className="text-sm text-ink-muted text-center mt-5">
          <Link to="/login" className="text-accent font-semibold underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
