import { createContext, useContext, useEffect, useState } from 'react';
import { supplierPortalApi, setSupplierPortalTokens, getStoredSupplierPortalToken, setSupplierPortalAuthFailureHandler } from '../api/supplierPortalClient';

const SupplierPortalAuthContext = createContext(null);

export function SupplierPortalAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getStoredSupplierPortalToken());
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(isAuthenticated);

  useEffect(() => {
    setSupplierPortalAuthFailureHandler(() => {
      setIsAuthenticated(false);
      setDashboard(null);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    supplierPortalApi.get('/supplier-portal-session/dashboard')
      .then(setDashboard)
      .catch(() => setIsAuthenticated(false))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function login(email, password) {
    const result = await supplierPortalApi.post('/supplier-portal-session/login', { email, password });
    setSupplierPortalTokens(result.accessToken, result.refreshToken);
    setIsAuthenticated(true);
  }

  function logout() {
    setSupplierPortalTokens(null);
    setIsAuthenticated(false);
    setDashboard(null);
  }

  return (
    <SupplierPortalAuthContext.Provider value={{ isAuthenticated, dashboard, loading, login, logout, refreshDashboard: () => supplierPortalApi.get('/supplier-portal-session/dashboard').then(setDashboard) }}>
      {children}
    </SupplierPortalAuthContext.Provider>
  );
}

export function useSupplierPortalAuth() {
  const ctx = useContext(SupplierPortalAuthContext);
  if (!ctx) throw new Error('useSupplierPortalAuth must be used within SupplierPortalAuthProvider');
  return ctx;
}
