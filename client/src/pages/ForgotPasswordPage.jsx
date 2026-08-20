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
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display text-3xl text-ink">Muhasib</p>
          <p className="text-sm text-ink-muted mt-1">Reset your password</p>
        </div>

        {sent ? (
          <div className="card p-6 space-y-4 text-center">
            <p className="text-sm text-ink">If that email exists, we've sent a link to reset your password.</p>
            <Link to="/login" className="btn-primary w-full inline-block">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {error && (
              <div className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm">{error}</div>
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
        )}

        <p className="text-xs text-ink-muted text-center mt-4">
          <Link to="/login" className="underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
