/**
 * Validra Frontend — API Service Layer
 * Connects to the Express backend at http://localhost:3000
 */

const API_BASE = 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json();
  if (!data.success && res.status >= 400) {
    throw new Error(data.error || 'API request failed');
  }
  return data;
}

export const api = {
  // GET /health
  health: () => request('/health'),

  // POST /api/similarity
  findSimilar: (title, description, domain) =>
    request('/api/similarity', {
      method: 'POST',
      body: JSON.stringify({ title, description, domain }),
    }),

  // POST /api/ideas
  createIdea: (title, description, domain) =>
    request('/api/ideas', {
      method: 'POST',
      body: JSON.stringify({ title, description, domain }),
    }),

  // GET /api/ideas?page=1&limit=20
  listIdeas: (page = 1, limit = 20) =>
    request(`/api/ideas?page=${page}&limit=${limit}`),

  // GET /api/autocomplete?q=abc&limit=8
  autocomplete: (q, domain = '') => {
    const params = new URLSearchParams({ q, limit: 8 });
    if (domain) params.set('domain', domain);
    return request(`/api/autocomplete?${params}`);
  },

  // GET /api/trends
  trends: () => request('/api/trends'),

  // POST /api/classify
  classify: (title, description) =>
    request('/api/classify', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),

  // Auth & Private Collection
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (name, email, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  listPrivateIdeas: (token) =>
    request('/api/private-ideas', {
      headers: { Authorization: `Bearer ${token}` }
    }),

  createPrivateIdea: (token, title, description, domain) =>
    request('/api/private-ideas', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, description, domain }),
    }),
};
