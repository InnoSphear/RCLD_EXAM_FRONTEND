import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
});

let accessToken = null;
try {
  accessToken = localStorage.getItem('rcld_access_token') || null;
} catch {
  accessToken = null;
}
export function setAccessToken(token) {
  accessToken = token || null;
  try {
    if (accessToken) localStorage.setItem('rcld_access_token', accessToken);
    else localStorage.removeItem('rcld_access_token');
  } catch {
    /* storage unavailable */
  }
}
export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthRoute = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
    if (status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post('/auth/refresh');
        const r = await refreshing;
        refreshing = null;
        setAccessToken(r.data?.data?.accessToken || null);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        refreshing = null;
        setAccessToken(null);
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(err, fallback = 'Something went wrong') {
  const d = err?.response?.data;
  if (d?.details && typeof d.details === 'object') {
    const first = Object.values(d.details)[0];
    return { message: d.message || fallback, details: d.details, field: first };
  }
  return { message: d?.message || err?.message || fallback, details: null, field: null };
}

export default api;
