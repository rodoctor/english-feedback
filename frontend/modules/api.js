/**
 * API Module
 * Centralized HTTP communication with backend
 */

const API = (() => {
  const call = async (path, options = {}) => {
    const response = await fetch(`/api${path}`, {
      headers: options.body instanceof FormData 
        ? undefined 
        : { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let message = '';
      if (contentType.includes('application/json')) {
        const payload = await response.json().catch(() => null);
        if (typeof payload === 'string') {
          message = payload;
        } else if (payload && typeof payload === 'object') {
          message = payload.detail || payload.message || JSON.stringify(payload);
        }
      } else {
        message = await response.text();
      }
      throw new Error(message || `Request failed: ${response.status}`);
    }
    return response.json();
  };

  return {
    // Tasks
    getTasks: () => call('/tasks'),
    createTask: (data) => call('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    updateTask: (id, data) => call(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTask: (id) => call(`/tasks/${id}`, { method: 'DELETE' }),

    // Training/Practice
    submitTraining: (formData) => call('/analyze', { method: 'POST', body: formData }),

    // Flashcards
    getFlashcards: () => call('/flashcards'),
    deleteFlashcard: (id) => call(`/flashcards/${id}`, { method: 'DELETE' }),

    // Report & Analytics
    getReport: (query) => call(`/report?${query}`),
    getDaySessionsSessions: (query) => call(`/report/sessions?${query}`),

    // Daily Words
    getDailyWordsToday: () => call('/daily-words/today/open', { method: 'POST' }),
    submitDailyWords: (data) => call('/daily-words/today/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getDailyWordsDictionary: () => call('/daily-words/dictionary'),
    searchDailyWordsDictionary: (word) => call(`/daily-words/dictionary/search?word=${encodeURIComponent(word)}`),

    // Config
    getConfig: () => call('/config'),
    updateConfig: (data) => call('/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

    // Backup
    exportBackup: async () => {
      const res = await fetch('/api/backup/export');
      if (!res.ok) throw new Error(await res.text());
      return res.blob();
    },

    importBackup: (file) => {
      const form = new FormData();
      form.append('file', file);
      return call('/backup/import', { method: 'POST', body: form });
    },

    // Reset
    resetAll: (confirmWord) => call('/reset', {
      method: 'POST',
      body: JSON.stringify({ confirm: confirmWord }),
      headers: { 'Content-Type': 'application/json' },
    }),
  };
})();
