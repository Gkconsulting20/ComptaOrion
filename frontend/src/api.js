const ENTREPRISE_ID = 1;

class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erreur API');
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
