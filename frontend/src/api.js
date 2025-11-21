const ENTREPRISE_ID = 1;

class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async handleUnauthorized() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const response = await fetch(`/api/auth-security/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('token', data.token);
          return true;
        }
      } catch (error) {
        console.error('Refresh token failed:', error);
      }
    }
    
    localStorage.clear();
    window.location.href = '/';
    return false;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          window.location.reload();
        }
        throw new Error('Session expirée');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Erreur API');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    const queryParams = new URLSearchParams({
      entrepriseId: ENTREPRISE_ID,
      ...params,
    });
    return this.request(`${endpoint}?${queryParams}`, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: { entrepriseId: ENTREPRISE_ID, ...data },
    });
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: { entrepriseId: ENTREPRISE_ID, ...data },
    });
  }

  async delete(endpoint, data = {}) {
    const queryParams = new URLSearchParams({
      entrepriseId: ENTREPRISE_ID,
    });
    return this.request(`${endpoint}?${queryParams}`, {
      method: 'DELETE',
      body: { entrepriseId: ENTREPRISE_ID, ...data },
    });
  }
}

export const api = new ApiClient();
export default api;
