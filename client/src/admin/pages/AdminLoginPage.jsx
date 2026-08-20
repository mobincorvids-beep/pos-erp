import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display text-3xl text-paper">Muhasib</p>
          <p className="text-sm text-white/50 mt-1">Platform admin — not a shop login</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded p-6 space-y-4">
          {error && <div className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm">{error}</div>}
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoFocus className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="platform-admin@muhasib.test" />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" type="password" required className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <p className="text-xs text-white/40 text-center mt-4">Seeded: platform-admin@muhasib.test / admin12345</p>
      </div>
    </div>
  );
}
