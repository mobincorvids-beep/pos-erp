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

  // Finishes a login/register/verify response that carries real session
  // tokens (as opposed to a "pending step" response — see below) — the one
  // place that stores the tokens and hydrates user/company/permissions, so
  // every completed-auth path (password login, email-code verified, 2FA
  // verified) ends up in exactly the same state.
  const completeAuth = useCallback(async (data) => {
    setToken(data.token, data.refreshToken);
    const me = await api.get('/auth/me');
    setUser(me.user);
    setCompany(me.company);
    setPermissions(me.permissions);
    return me.user;
  }, []);

  // A login/register/verify call can resolve to one of three shapes:
  //   1. { token, refreshToken, ... }              -> fully signed in
  //   2. { requiresEmailVerification, preAuthToken } -> needs the mailed code
  //   3. { requires2FA, preAuthToken }               -> needs the TOTP/backup code
  // This turns any of those into a single consistent return value for the
  // caller: either the real user object, or a `{ pending, preAuthToken }`
  // marker the page can use to route to the right "enter your code" step.
  function resolvePendingOrComplete(data) {
    if (data.requiresEmailVerification) return { pending: 'email', preAuthToken: data.preAuthToken };
    if (data.requires2FA) return { pending: '2fa', preAuthToken: data.preAuthToken };
    return completeAuth(data);
  }

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    return resolvePendingOrComplete(data);
  }, [completeAuth]);

  // Self-serve signup: a new business provisions its own tenant (own
  // Company + admin user, fully isolated by companyId from every other
  // business on the platform). Almost never lands on "fully signed in"
  // immediately anymore — a brand-new local account always needs its email
  // verified first (see authController.register) — but is written the same
  // general way login() is, in case that ever changes.
  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    return resolvePendingOrComplete(data);
  }, [completeAuth]);

  // Step 2 of the email-verification pending flow: preAuthToken + the
  // 6-digit code the user got in their inbox. Can itself resolve to a
  // requires2FA pending step (an account can have both gates) rather than
  // straight to a full session — handled the same way via resolvePendingOrComplete.
  const verifyEmailCode = useCallback(async (preAuthToken, code) => {
    const data = await api.post('/auth/verify-email', { preAuthToken, code });
    return resolvePendingOrComplete(data);
  }, [completeAuth]);

  const resendEmailCode = useCallback(async (preAuthToken) => {
    return api.post('/auth/resend-verification', { preAuthToken });
  }, []);

  // Step 2 of the 2FA pending flow: preAuthToken + a TOTP or backup code.
  const verifyTwoFactorCode = useCallback(async (preAuthToken, token) => {
    const data = await api.post('/auth/verify-2fa', { preAuthToken, token });
    return completeAuth(data);
  }, [completeAuth]);

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
    <AuthContext.Provider value={{ user, company, permissions, login, register, verifyEmailCode, resendEmailCode, verifyTwoFactorCode, logout, refreshUser, initializing, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
