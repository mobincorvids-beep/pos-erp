import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('This reset link is missing its token — please request a new one.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      navigate('/login');
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
          <p className="text-sm text-ink-muted mt-1">Choose a new password</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm">{error}</div>
          )}
          <div>
            <label className="field-label" htmlFor="newPassword">New password</label>
            <input
              id="newPassword" type="password" required minLength={8} autoFocus
              className="field-input"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword" type="password" required minLength={8}
              className="field-input"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="text-xs text-ink-muted text-center mt-4">
          <Link to="/login" className="underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
