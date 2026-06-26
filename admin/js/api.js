const API_ADMIN = '/api/admin';
const API_PUBLIC = '/api';

const listeners = { start: [], stop: [], progress: [] };

export const loadingEvents = {
  on(event, cb) {
    if (listeners[event]) listeners[event].push(cb);
  },
};

function emit(event, arg) {
  (listeners[event] || []).forEach((cb) => cb(arg));
}

async function request(url, options = {}) {
  const headers =
    options.body instanceof FormData
      ? { ...options.headers }
      : { 'Content-Type': 'application/json', ...options.headers };

  emit('start');
  try {
    const res = await fetch(url, { ...options, headers });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const details = data.details?.map((d) => d.message).join(', ');
      throw new Error(details || data.error || 'Request failed');
    }

    return data;
  } finally {
    emit('stop');
  }
}

// Upload via XHR so we can report real upload progress for files.
function uploadRequest(url, method, formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    emit('start');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        emit('progress', Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      emit('stop');
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        const details = data.details?.map((d) => d.message).join(', ');
        reject(new Error(details || data.error || 'Request failed'));
      }
    });

    xhr.addEventListener('error', () => {
      emit('stop');
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      emit('stop');
      reject(new Error('Upload cancelled'));
    });

    xhr.send(formData);
  });
}

export const api = {
  listProjects: () => request(`${API_PUBLIC}/projects`),

  getProject: (id) => request(`${API_PUBLIC}/projects/${id}`),

  createProject: (body) =>
    request(`${API_ADMIN}/projects`, { method: 'POST', body: JSON.stringify(body) }),

  updateProject: (id, body) =>
    request(`${API_ADMIN}/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteProject: (id) => request(`${API_ADMIN}/projects/${id}`, { method: 'DELETE' }),

  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return uploadRequest(`${API_ADMIN}/upload`, 'POST', fd);
  },

  createSection: (projectId, body) =>
    request(`${API_ADMIN}/projects/${projectId}/sections`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateSection: (sectionId, body) =>
    request(`${API_ADMIN}/sections/${sectionId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteSection: (sectionId) =>
    request(`${API_ADMIN}/sections/${sectionId}`, { method: 'DELETE' }),

  reorderSections: (sectionId, items) =>
    request(`${API_ADMIN}/sections/${sectionId}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  createMedia: (sectionId, formData) =>
    uploadRequest(`${API_ADMIN}/sections/${sectionId}/media`, 'POST', formData),

  deleteMedia: (mediaId) => request(`${API_ADMIN}/media/${mediaId}`, { method: 'DELETE' }),

  reorderMedia: (mediaId, items) =>
    request(`${API_ADMIN}/media/${mediaId}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
};

export function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('//')) return url;
  return `${window.location.origin}${url}`;
}
