import { createContext, useContext, useEffect, useState } from 'react';
import { employeePortalApi, setEmployeePortalTokens, getStoredEmployeePortalToken, setEmployeePortalAuthFailureHandler } from '../api/employeePortalClient';

const EmployeePortalAuthContext = createContext(null);

export function EmployeePortalAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getStoredEmployeePortalToken());
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(isAuthenticated);

  useEffect(() => {
    setEmployeePortalAuthFailureHandler(() => {
      setIsAuthenticated(false);
      setDashboard(null);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    employeePortalApi.get('/employee-portal-session/dashboard')
      .then(setDashboard)
      .catch(() => setIsAuthenticated(false))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function login(email, password) {
    const result = await employeePortalApi.post('/employee-portal-session/login', { email, password });
    setEmployeePortalTokens(result.accessToken, result.refreshToken);
    setIsAuthenticated(true);
  }

  function logout() {
    setEmployeePortalTokens(null);
    setIsAuthenticated(false);
    setDashboard(null);
  }

  return (
    <EmployeePortalAuthContext.Provider value={{ isAuthenticated, dashboard, loading, login, logout, refreshDashboard: () => employeePortalApi.get('/employee-portal-session/dashboard').then(setDashboard) }}>
      {children}
    </EmployeePortalAuthContext.Provider>
  );
}

export function useEmployeePortalAuth() {
  const ctx = useContext(EmployeePortalAuthContext);
  if (!ctx) throw new Error('useEmployeePortalAuth must be used within EmployeePortalAuthProvider');
  return ctx;
}
