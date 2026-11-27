/* ==========================================================================
   IMPRENTA SANCHEZ — Adaptador de Supabase (JavaScript puro)
   --------------------------------------------------------------------------
   Cuando cloud-config.js tiene enabled: true, la web y el panel usan la API
   REST de Supabase en lugar del servidor local. No hay dependencias ni claves
   secretas en el navegador: solo una clave pública y políticas RLS.
   ========================================================================== */

'use strict';

const Cloud = (() => {
  const cfg = window.CLOUD_CONFIG || {};
  const configured = !!(cfg.enabled && cfg.url && cfg.anonKey &&
    !String(cfg.anonKey).startsWith('TU_') && !String(cfg.url).includes('TU-PROYECTO'));
  const enabled = configured;
  const base = String(cfg.url || '').replace(/\/+$/, '');
  const anonKey = String(cfg.anonKey || '');
  const bucket = String(cfg.storageBucket || 'imagenes');

  const TOKEN_KEY = 'is_admin_token';
  const REFRESH_KEY = 'is_admin_refresh';
  const EXPIRES_KEY = 'is_admin_expires';
  const EMAIL_KEY = 'is_admin_email';

  const eq = value => 'eq.' + encodeURIComponent(String(value));

  function buildHeaders(token, extra) {
    const headers = { apikey: anonKey, ...(extra || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  async function request(path, options = {}) {
    const { method = 'GET', body, token = null, headers: extraHeaders = {}, prefer = '' } = options;
    const headers = buildHeaders(token, extraHeaders);
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      let message = '';
      try {
        const data = await response.json();
        message = data.message || data.error_description || data.error || data.msg || '';
      } catch (_) { /* respuesta sin JSON */ }
      const error = new Error(message || 'No se pudo completar la acción (' + response.status + ').');
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    const type = response.headers.get('content-type') || '';
    return type.includes('json') ? response.json() : response.text();
  }

  function setSession(data) {
    if (!data || !data.access_token) return;
    sessionStorage.setItem(TOKEN_KEY, data.access_token);
    sessionStorage.setItem(REFRESH_KEY, data.refresh_token || sessionStorage.getItem(REFRESH_KEY) || '');
    const expires = data.expires_in
      ? Date.now() + (Number(data.expires_in) * 1000) - 60000
      : 0;
    sessionStorage.setItem(EXPIRES_KEY, String(expires));
    const email = (data.user && data.user.email) || sessionStorage.getItem(EMAIL_KEY) || '';
    if (email) sessionStorage.setItem(EMAIL_KEY, email);
  }

  async function signIn(email, password) {
    const data = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      token: null,
      body: { email, password }
    });
    setSession(data);
    return data;
  }

  async function refreshSession() {
    const refreshToken = sessionStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return '';
    try {
      const data = await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        token: null,
        body: { refresh_token: refreshToken }
      });
      setSession(data);
      return data.access_token || '';
    } catch (_) {
      return '';
    }
  }

  async function validAdminToken() {
    let token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      const error = new Error('Inicia sesión para continuar.');
      error.status = 401;
      throw error;
    }
    const expires = Number(sessionStorage.getItem(EXPIRES_KEY) || 0);
    if (expires && Date.now() >= expires) token = await refreshSession() || token;
    return token;
  }

  async function adminRequest(path, options = {}) {
    const token = await validAdminToken();
    try {
      return await request(path, { ...options, token });
    } catch (err) {
      if (err.status !== 401) throw err;
      const fresh = await refreshSession();
      if (fresh) return request(path, { ...options, token: fresh });
      const expired = new Error('Tu sesión ha expirado. Vuelve a iniciar sesión.');
      expired.status = 401;
      throw expired;
    }
  }

  function stripPosition(rows) {
    return (rows || []).map(row => {
      const clean = { ...row };
      delete clean.position;
      return clean;
    });
  }

  async function ping() {
    if (!enabled) return false;
    try {
      await request('/rest/v1/site_settings?select=id&limit=1', { method: 'GET', token: null });
      return true;
    } catch (_) {
      return false;
    }
  }

  /* --------------------------- Web pública --------------------------- */

  async function publicData() {
    const [settingsRows, services, products, reviews] = await Promise.all([
      request('/rest/v1/site_settings?select=value&id=' + eq('main'), { token: null }),
      request('/rest/v1/services?select=id,title,description,icon,image,position&order=position.asc,id.asc', { token: null }),
      request('/rest/v1/products?select=id,name,description,image,badge,position&order=position.asc,id.asc', { token: null }),
      request('/rest/v1/reviews?select=id,name,text,rating,status,date&status=' + eq('approved') + '&order=date.desc', { token: null })
    ]);
    const settings = (settingsRows[0] && settingsRows[0].value) ||
      (window.SITE_DATA_DEFAULT || {}).settings || {};
    return {
      settings,
      services: stripPosition(services),
      products: stripPosition(products),
      reviews: reviews || []
    };
  }

  async function insertReview(review) {
    return request('/rest/v1/reviews', {
      method: 'POST',
      token: null,
      body: {
        id: String(review.id),
        name: String(review.name),
        text: String(review.text),
        rating: Number(review.rating) || 5,
        status: 'pending',
        date: review.date
      },
      prefer: 'return=minimal'
    });
  }

  /* ----------------------------- Panel ------------------------------- */

  async function loadAdminData() {
    const [settingsRows, services, products, reviews] = await Promise.all([
      adminRequest('/rest/v1/site_settings?select=value&id=' + eq('main')),
      adminRequest('/rest/v1/services?select=id,title,description,icon,image,position&order=position.asc,id.asc'),
      adminRequest('/rest/v1/products?select=id,name,description,image,badge,position&order=position.asc,id.asc'),
      adminRequest('/rest/v1/reviews?select=id,name,text,rating,status,date&order=date.desc')
    ]);
    const email = sessionStorage.getItem(EMAIL_KEY) || '';
    return {
      settings: (settingsRows[0] && settingsRows[0].value) ||
        (window.SITE_DATA_DEFAULT || {}).settings || {},
      services: stripPosition(services),
      products: stripPosition(products),
      reviews: reviews || [],
      admin: { username: email ? email.split('@')[0] : 'Administrador', email }
    };
  }

  async function syncTable(table, rows, previousRows, decorate) {
    const previous = Array.isArray(previousRows) ? previousRows : [];
    const currentIds = new Set((rows || []).map(row => String(row.id)));
    for (const old of previous) {
      if (!currentIds.has(String(old.id))) {
        await adminRequest('/rest/v1/' + table + '?id=' + eq(old.id), { method: 'DELETE' });
      }
    }
    if (!(rows || []).length) return;
    const prepared = rows.map((row, index) => decorate ? decorate(row, index) : row);
    await adminRequest('/rest/v1/' + table, {
      method: 'POST',
      body: prepared,
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
  }

  async function saveState(payload, baseline) {
    await adminRequest('/rest/v1/site_settings', {
      method: 'POST',
      body: { id: 'main', value: payload.settings || {} },
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
    await syncTable('services', payload.services, baseline && baseline.services,
      (row, index) => ({ ...row, position: index }));
    await syncTable('products', payload.products, baseline && baseline.products,
      (row, index) => ({ ...row, position: index }));
    await syncTable('reviews', payload.reviews, baseline && baseline.reviews);
  }

  async function uploadImage(file) {
    const token = await validAdminToken();
    const extension = (String(file.name || '').split('.').pop() || 'bin')
      .replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
    const filename = Date.now() + '_' + Math.random().toString(36).slice(2, 9) + '.' + extension;
    const endpoint = base + '/storage/v1/object/' + bucket + '/' + encodeURIComponent(filename);

    const send = authToken => fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + authToken,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: file
    });

    let response = await send(token);
    if (response.status === 401) {
      const fresh = await refreshSession();
      if (fresh) response = await send(fresh);
    }
    if (!response.ok) {
      let message = '';
      try {
        const data = await response.json();
        message = data.message || data.error || '';
      } catch (_) { /* respuesta sin JSON */ }
      throw new Error(message || 'No se pudo subir la imagen (' + response.status + ').');
    }
    return base + '/storage/v1/object/public/' + bucket + '/' + filename;
  }

  async function updatePassword(current, next) {
    const email = sessionStorage.getItem(EMAIL_KEY);
    if (!email) throw new Error('Vuelve a iniciar sesión para cambiar la contraseña.');
    try {
      await signIn(email, current);
    } catch (_) {
      throw new Error('La contraseña actual no es correcta.');
    }
    await adminRequest('/auth/v1/user', { method: 'PUT', body: { password: next } });
  }

  async function signOut() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;
    try { await request('/auth/v1/logout', { method: 'POST', token }); } catch (_) { /* sesión ya cerrada */ }
  }

  return {
    enabled,
    ping,
    publicData,
    insertReview,
    loadAdminData,
    saveState,
    uploadImage,
    updatePassword,
    signIn,
    signOut
  };
})();
