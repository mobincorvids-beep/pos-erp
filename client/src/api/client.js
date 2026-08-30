/**
 * Thin fetch wrapper — attaches the JWT, prefixes the API base URL, and
 * normalizes error handling so every page can just `await api.get(...)`
 * and catch a real Error with the backend's message.
 *
 * Also handles refresh-token exchange transparently: a request that comes
 * back 401 (access token expired — they last ~1h) triggers exactly one
 * refresh call even if several requests hit 401 at once (they all await
 * the same in-flight promise), then retries the original request once. If
 * the refresh itself fails (refresh token expired/revoked), every caller
 * gets the original 401 and `onAuthFailure` fires so AuthContext can clear
 * state and redirect to login — this file has no React/router dependency
 * itself, just a callback hook.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'pos_erp_token';
const REFRESH_KEY = 'pos_erp_refresh_token';

let onAuthFailure = null;
let refreshInFlight = null;

export function setAuthFailureHandler(fn) {
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

/** Exchanges the stored refresh token for a new access token — shared across concurrent 401s via refreshInFlight so only one network call happens. */
function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token available.');

      const { response, data } = await doRequest('POST', '/auth/refresh', { refreshToken });
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

  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
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

/** Multipart upload (e.g. CSV import) — same auth/refresh handling as request(), but skips the JSON Content-Type/body so the browser sets its own multipart boundary. */
async function uploadRequest(path, formData) {
  const token = getToken();
  const doUpload = async (t) => {
    const headers = {};
    if (t) headers.Authorization = `Bearer ${t}`;
    const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json().catch(() => null) : null;
    return { response, data };
  };

  let { response, data } = await doUpload(token);
  if (response.status === 401) {
    try {
      const newToken = await refreshAccessToken();
      ({ response, data } = await doUpload(newToken));
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

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
  upload: (path, formData) => uploadRequest(path, formData),
};

export function setToken(token, refreshToken) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function getStoredToken() {
  return getToken();
}

export function getStoredRefreshToken() {
  return getRefreshToken();
}
