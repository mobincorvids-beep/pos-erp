/**
 * A separate token/request wrapper for the platform-admin section — deliberately
 * not sharing localStorage key or React context with the tenant app's `api`
 * client (client/src/api/client.js). A platform admin isn't a company user;
 * keeping the two fully separate means being logged into one never implies
 * or interferes with the other, even in the same browser.
 *
 * Same refresh-token-on-401 handling as the tenant client, against the
 * admin-specific /admin/auth/refresh endpoint and its own token pair.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'pos_erp_admin_token';
const REFRESH_KEY = 'pos_erp_admin_refresh_token';

let onAuthFailure = null;
let refreshInFlight = null;

export function setAdminAuthFailureHandler(fn) {
  onAuthFailure = fn;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

async function doRequest(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;

  return { response, data };
}

function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token available.');

      const { response, data } = await doRequest('POST', '/admin/auth/refresh', { refreshToken });
      if (!response.ok) throw new Error(data?.error || 'Session expired.');

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      return data.token;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request(method, path, body) {
  const token = getToken();
  let { response, data } = await doRequest(method, path, body, token);

  if (response.status === 401 && path !== '/admin/auth/login' && path !== '/admin/auth/refresh') {
    try {
      const newToken = await refreshAccessToken();
      ({ response, data } = await doRequest(method, path, body, newToken));
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      onAuthFailure?.();
    }
  }

  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const adminApi = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
};

export function setAdminToken(token, refreshToken) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function getStoredAdminToken() {
  return getToken();
}

export function getStoredAdminRefreshToken() {
  return getRefreshToken();
}
