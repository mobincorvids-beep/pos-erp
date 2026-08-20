import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { adminApi, setAdminToken, getStoredAdminToken, getStoredAdminRefreshToken, setAdminAuthFailureHandler } from '../api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    const refreshToken = getStoredAdminRefreshToken();
    if (refreshToken) adminApi.post('/admin/auth/logout', { refreshToken }).catch(() => {});
    setAdminToken(null);
    setAdmin(null);
  }, []);

  useEffect(() => {
    setAdminAuthFailureHandler(() => setAdmin(null));
  }, []);

  useEffect(() => {
    const token = getStoredAdminToken();
    if (!token) { setInitializing(false); return; }
    adminApi.get('/admin/auth/me')
      .then((data) => setAdmin(data.admin))
      .catch(() => setAdminToken(null))
      .finally(() => setInitializing(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await adminApi.post('/admin/auth/login', { email, password });
    setAdminToken(data.token, data.refreshToken);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  return (
    <AdminAuthContext.Provider value={{ admin, login, logout, initializing }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
