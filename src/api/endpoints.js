import api, { setAccessToken } from './client';

export async function login(email, password) {
  const r = await api.post('/auth/login', { email, password });
  setAccessToken(r.data?.data?.accessToken);
  return r.data.data;
}
export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}
export async function me() {
  const r = await api.get('/auth/me');
  setAccessToken(r.data?.data?.accessToken);
  return r.data.data.user;
}
export async function changePassword(currentPassword, newPassword) {
  const r = await api.post('/auth/change-password', { currentPassword, newPassword });
  return r.data;
}
export async function refreshSession() {
  const r = await api.post('/auth/refresh');
  setAccessToken(r.data?.data?.accessToken);
  return r.data.data;
}

export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
export const post = (url, body) => api.post(url, body).then((r) => r.data);
export const put = (url, body) => api.put(url, body).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
export const del = (url) => api.delete(url).then((r) => r.data);

export function download(url, params, filename) {
  return api
    .get(url, { params, responseType: 'blob' })
    .then((r) => {
      const cd = r.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const name = filename || (match ? match[1] : 'download');
      const blobUrl = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      return true;
    });
}

export function upload(url, file, field = 'file', extra = {}) {
  const fd = new FormData();
  fd.append(field, file);
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v);
  });
  return api
    .post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
    .then((r) => r.data);
}
