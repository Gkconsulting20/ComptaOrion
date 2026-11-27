// Essai expiré : la page de connexion lit ce drapeau dans localStorage et
// affiche le message avec un appel à l'action vers les abonnements.
function flagTrialExpired(data) {
  const message = data?.error || data?.message
    || 'Votre période d’essai gratuit de 30 jours est terminée. Passez à un abonnement pour continuer.';
  localStorage.setItem('trialExpired', message);
  ['user', 'entreprise', 'entrepriseId', 'sessionId'].forEach(key => localStorage.removeItem(key));
  window.location.href = '/';
}

class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  async handleUnauthorized() {
    try {
      const response = await fetch('/api/auth-security/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) return true;
      let data = null;
      try { data = await response.json(); } catch { /* corps non JSON */ }
      if (data?.code === 'TRIAL_EXPIRED') {
        flagTrialExpired(data);
        return false;
      }
    } catch (error) {
      console.error('Refresh token failed:', error);
    }

    ['user', 'entreprise', 'entrepriseId', 'sessionId'].forEach(key => localStorage.removeItem(key));
    window.location.href = '/';
    return false;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      credentials: 'include',
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          const retryConfig = {
            ...config,
            headers: {
              ...config.headers,
              ...this.getHeaders()
            }
          };
          const retryResponse = await fetch(url, retryConfig);
          const retryData = await retryResponse.json();
          
          if (!retryResponse.ok) {
            if (retryData?.code === 'TRIAL_EXPIRED') flagTrialExpired(retryData);
            const error = new Error(retryData.message || retryData.error || 'Erreur API');
            error.status = retryResponse.status;
            throw error;
          }
          
          return retryData;
        }
        throw new Error('Session expirée');
      }
      
      const data = await response.json();

      if (!response.ok) {
        if (data?.code === 'TRIAL_EXPIRED') flagTrialExpired(data);
        const error = new Error(data.message || data.error || 'Erreur API');
        error.status = response.status;
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    const queryParams = new URLSearchParams(params);
    const queryString = queryParams.toString();
    return this.request(queryString ? `${endpoint}?${queryString}` : endpoint, { method: 'GET' });
  }

  async post(endpoint, data = {}, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
      ...options,
    });
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  async delete(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      body: data,
    });
  }
}

export const api = new ApiClient();
export default api;
