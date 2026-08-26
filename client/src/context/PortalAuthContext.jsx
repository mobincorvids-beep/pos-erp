import { createContext, useContext, useEffect, useState } from 'react';
import { portalApi, setPortalTokens, getStoredPortalToken, setPortalAuthFailureHandler } from '../api/portalClient';

const PortalAuthContext = createContext(null);

export function PortalAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getStoredPortalToken());
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(isAuthenticated);

  useEffect(() => {
    setPortalAuthFailureHandler(() => {
      setIsAuthenticated(false);
      setDashboard(null);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    portalApi.get('/portal-session/dashboard')
      .then(setDashboard)
      .catch(() => setIsAuthenticated(false))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function login(email, password) {
    const result = await portalApi.post('/portal-session/login', { email, password });
    setPortalTokens(result.accessToken, result.refreshToken);
    setIsAuthenticated(true);
  }

  function logout() {
    setPortalTokens(null);
    setIsAuthenticated(false);
    setDashboard(null);
  }

  return (
    <PortalAuthContext.Provider value={{ isAuthenticated, dashboard, loading, login, logout, refreshDashboard: () => portalApi.get('/portal-session/dashboard').then(setDashboard) }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
}
