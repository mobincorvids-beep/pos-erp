import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setToken, getStoredToken, getStoredRefreshToken, setAuthFailureHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) api.post('/auth/logout', { refreshToken }).catch(() => {}); // best-effort — clear local state regardless
    setToken(null);
    setUser(null);
    setCompany(null);
    setPermissions(null);
  }, []);

  // If a background token refresh ever fails (refresh token expired or
  // revoked), the api client calls this to force a clean logout instead of
  // leaving the app in a half-authenticated state.
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      setCompany(null);
      setPermissions(null);
    });
  }, []);

  // Restore session on reload via GET /auth/me — a stored token alone isn't
  // enough context to render the app (company name, permissions), so we
  // re-fetch rather than trusting stale localStorage data for anything but the token.
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setInitializing(false);
      return;
    }
    api.get('/auth/me')
      .then((data) => {
        setUser(data.user);
        setCompany(data.company);
        setPermissions(data.permissions);
      })
      .catch(() => setToken(null))
      .finally(() => setInitializing(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token, data.refreshToken);
    const me = await api.get('/auth/me');
    setUser(me.user);
    setCompany(me.company);
    setPermissions(me.permissions);
    return me.user;
  }, []);

  // Self-serve signup: a new business provisions its own tenant (own
  // Company + admin user, fully isolated by companyId from every other
  // business on the platform) and is logged straight in, same as login().
  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    setToken(data.token, data.refreshToken);
    const me = await api.get('/auth/me');
    setUser(me.user);
    setCompany(me.company);
    setPermissions(me.permissions);
    return me.user;
  }, []);

  // Re-fetches /auth/me and updates state in place — for anything that
  // changes something on the user record itself (e.g. enabling 2FA)
  // without a full re-login, so the rest of the app sees the fresh value
  // immediately rather than a stale one until the next page reload.
  const refreshUser = useCallback(async () => {
    const me = await api.get('/auth/me');
    setUser(me.user);
    setCompany(me.company);
    setPermissions(me.permissions);
    return me.user;
  }, []);

  /** null permissions = super-admin (see backend requirePermission). */
  const can = useCallback((key) => {
    if (permissions === null) return true;
    if (!permissions) return false;
    const [module] = key.split('.');
    return permissions.includes(key) || permissions.includes(`${module}.*`) || permissions.includes('*');
  }, [permissions]);

  return (
    <AuthContext.Provider value={{ user, company, permissions, login, register, logout, refreshUser, initializing, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
