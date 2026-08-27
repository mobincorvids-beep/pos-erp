import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
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
      navigate('/dashboard');
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
          <p className="eyebrow mt-1">POS &amp; ERP — sign in to your counter</p>
        </div>

        <div className="card overflow-hidden">
          <div className="h-1.5 bg-accent" />
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="page-title text-lg mb-1">Welcome back</p>

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
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password" type="password" required
                className="field-input"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-sm text-ink-muted text-center mt-5">
          New business? <Link to="/signup" className="text-accent font-semibold underline">Create your own account</Link>
        </p>
        <p className="text-xs text-ink-muted text-center mt-3">
          Seeded demo: admin@demo.test / password123
        </p>
      </div>
    </div>
  );
}
