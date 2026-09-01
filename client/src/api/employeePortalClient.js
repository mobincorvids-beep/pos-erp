/**
 * Separate from api/client.js and api/portalClient.js on purpose — an
 * employee-portal session is yet another distinct token, storage key, and
 * refresh endpoint. Keeping all three fully apart makes cross-use
 * structurally impossible rather than just "shouldn't happen".
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'pos_erp_employee_portal_token';
const REFRESH_KEY = 'pos_erp_employee_portal_refresh_token';

let onAuthFailure = null;
let refreshInFlight = null;

export function setEmployeePortalAuthFailureHandler(fn) {
  onAuthFailure = fn;
}

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }

async function doRequest(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;
  return { response, data };
}

function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token available.');
      const { response, data } = await doRequest('POST', '/employee-portal-session/refresh', { refreshToken });
      if (!response.ok) throw new Error(data?.error || 'Session expired.');
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      return data.accessToken;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request(method, path, body) {
  const token = getToken();
  let { response, data } = await doRequest(method, path, body, token);

  if (response.status === 401 && path !== '/employee-portal-session/login' && path !== '/employee-portal-session/refresh') {
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

export const employeePortalApi = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
};

export function setEmployeePortalTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function getStoredEmployeePortalToken() { return getToken(); }
