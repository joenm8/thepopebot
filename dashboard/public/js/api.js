// ── API Client ──────────────────────────────────────────────────────────────

const API = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },

  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },

  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },

  async del(url) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },

  async upload(url, file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(url, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },

  // Convenience methods
  getStats: () => API.get('/api/stats'),
  getAlumni: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return API.get(`/api/alumni${qs ? '?' + qs : ''}`);
  },
  getAlumniDetail: (id) => API.get(`/api/alumni/${id}`),
  createAlumni: (data) => API.post('/api/alumni', data),
  updateAlumni: (id, data) => API.put(`/api/alumni/${id}`, data),
  starAlumni: (id) => API.post(`/api/alumni/${id}/star`),
  archiveAlumni: (id) => API.post(`/api/alumni/${id}/archive`),
  deleteAlumni: (id) => API.del(`/api/alumni/${id}`),
  getSignals: (days = 7) => API.get(`/api/signals?days=${days}`),
  getUnreadSignals: () => API.get('/api/signals/unread'),
  getSignalTypes: () => API.get('/api/signals/types'),
  addSignal: (alumniId, data) => API.post(`/api/alumni/${alumniId}/signals`, data),
  markSignalRead: (id) => API.post(`/api/signals/${id}/read`),
  getDigest: (date) => API.get(`/api/digest${date ? '?date=' + date : ''}`),
  generateDigest: (days = 1) => API.post('/api/digest/generate', { days }),
  getDigests: () => API.get('/api/digests'),
  getCompanies: () => API.get('/api/companies'),
  createCompany: (data) => API.post('/api/companies', data),
  importAlumni: (file) => API.upload('/api/import/alumni', file),
  recalculate: () => API.post('/api/recalculate'),
  checkMilestones: () => API.post('/api/check-milestones'),
  getSources: () => API.get('/api/sources'),
  getPipelineRuns: () => API.get('/api/pipeline/runs'),
  runPipeline: (sources, dryRun) => API.post('/api/pipeline/run', { sources, dryRun }),
  runDiscovery: (maxQueries) => API.post('/api/discover', { maxQueries }),
  importDiscovered: (candidates) => API.post('/api/discover/import', { candidates }),
};
