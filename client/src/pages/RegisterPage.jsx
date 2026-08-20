import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from '../api/client';

export function RegisterPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [industryType, setIndustryType] = useState('retail');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/register', {
        companyName, industryType, adminName, adminEmail, adminPassword,
      });
      setToken(data.token, data.refreshToken);
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
          <p className="text-sm text-ink-muted mt-1">Set up your company — takes a minute</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm">{error}</div>
          )}
          <div>
            <label className="field-label" htmlFor="companyName">Company name</label>
            <input
              id="companyName" type="text" required autoFocus
              className="field-input"
              value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Retail"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="industryType">Industry</label>
            <select
              id="industryType"
              className="field-input"
              value={industryType} onChange={(e) => setIndustryType(e.target.value)}
            >
              <option value="retail">Retail</option>
              <option value="restaurant">Restaurant</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="salon">Salon</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="adminName">Your name</label>
            <input
              id="adminName" type="text" required
              className="field-input"
              value={adminName} onChange={(e) => setAdminName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="adminEmail">Email</label>
            <input
              id="adminEmail" type="email" required
              className="field-input"
              value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="adminPassword">Password</label>
            <input
              id="adminPassword" type="password" required minLength={8}
              className="field-input"
              value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating your company…' : 'Create company'}
          </button>
        </form>

        <p className="text-xs text-ink-muted text-center mt-4">
          Already have an account? <Link to="/login" className="underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
