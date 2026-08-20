import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
      navigate('/pos');
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
          <p className="text-sm text-ink-muted mt-1">POS &amp; ERP — sign in to your counter</p>
        </div>

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
          <p className="text-xs text-ink-muted text-center">
            <Link to="/forgot-password" className="underline">Forgot password?</Link>
          </p>
        </form>

        <p className="text-xs text-ink-muted text-center mt-4">
          Seeded demo: admin@demo.test / password123
        </p>
        <p className="text-xs text-ink-muted text-center mt-2">
          Don't have an account? <Link to="/register" className="underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
