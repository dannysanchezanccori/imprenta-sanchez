/* ==========================================================================
   IMPRENTA SANCHEZ — Lógica del panel de administración
   --------------------------------------------------------------------------
   Funciona con el servidor local (INICIAR.bat) o, al publicar en GitHub Pages,
   con Supabase configurado en js/cloud-config.js. En ambos casos la web pública
   muestra los mismos datos y el acceso sigue protegido.
   ========================================================================== */

'use strict';

const Admin = {
  token: sessionStorage.getItem('is_admin_token') || '',
  email: sessionStorage.getItem('is_admin_email') || '',
  data: null,
  baseline: null,
  filter: 'pending',
  online: false
};

const ADMIN_THEME_KEY = 'is_admin_theme';
const ADMIN_LOGO = { light: '../img/logo_paraclaro.png', dark: '../img/logo_paraoscuro.png' };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const PAGE_TEXT = {
  resumen: ['Resumen', 'Una vista rápida de tu imprenta'],
  negocio: ['Datos del negocio', 'La información se refleja en toda laweb'],
  servicios: ['Servicios', 'Gestiona lo que ofrece tu imprenta'],
  productos: ['Productos', 'Administra el catálogo público'],
  resenas: ['Reseñas', 'Aprueba o rechaza los comentarios recibidos'],
  seguridad: ['Seguridad', 'Protege el acceso a tu panel']
};

/* ------------------------------- Utilidades ------------------------------ */

function toast(message, kind = '') {
  const root = $('#adminToast');
  const item = document.createElement('div');
  item.className = 'toast' + (kind ? ' ' + kind : '');
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 3500);
}

function formatDate(value) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (Admin.token) headers.Authorization = 'Bearer ' + Admin.token;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    logout('Tu sesión ha expirado. Vuelve a iniciar sesión.');
    throw new Error('Sesión expirada');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la acción.');
  return result;
}

// El aviso de desconexión solo debe aparecer si el backend realmente no responde.
async function checkServer() {
  if (Cloud.enabled) return Cloud.ping();
  try {
    const response = await fetch('api/ping', { cache: 'no-store' });
    return response.ok;
  } catch (_) {
    return false;
  }
}

// En la nube el usuario es un correo de Supabase Auth, no "admin".
function initLoginMode() {
  if (!Cloud.enabled) return;
  const label = document.querySelector('label[for="loginUser"]');
  if (label) label.textContent = 'Correo electrónico';
  const user = $('#loginUser');
  user.type = 'email';
  user.placeholder = 'tu@correo.com';
  user.autocomplete = 'username';
  const hint = $('#loginView .login-hint');
  if (hint) hint.textContent = 'Acceso con el usuario creado en Supabase Auth. Puedes cambiar la contraseña en Seguridad.';
}

/* ------------------------------- Tema ------------------------------------ */

function initAdminTheme() {
  const button = $('#adminThemeToggle');
  let stored = 'light';
  try { stored = localStorage.getItem(ADMIN_THEME_KEY) || 'light'; } catch (_) { /* modo incógnito */ }

  const apply = theme => {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';

    $$('[data-admin-logo]').forEach(image => { image.src = ADMIN_LOGO[theme]; });
    const favicon = $('#adminFavicon');
    if (favicon) favicon.href = ADMIN_LOGO[theme];
    const meta = $('#adminThemeColor');
    if (meta) meta.content = dark ? '#0b1220' : '#003D8E';

    if (button) {
      const label = dark ? 'Activar modo claro' : 'Activar modo oscuro';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(dark));
      button.innerHTML = dark
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"/></svg>';
    }
  };

  apply(stored === 'dark' ? 'dark' : 'light');

  if (button) {
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(ADMIN_THEME_KEY, next); } catch (_) { /* modo incógnito */ }
      apply(next);
      toast(next === 'dark' ? 'Modo oscuro activado.' : 'Modo claro activado.', 'success');
    });
  }
}

/* ---------------------------- Inicialización ----------------------------- */

document.addEventListener('DOMContentLoaded', async () => {
  initAdminTheme();
  initLoginMode();
  bindEvents();

  const online = await checkServer();
  Admin.online = online;
  $('#offlineBanner').hidden = online;

  if (!Admin.token) {
    showLogin();
    return;
  }
  const loaded = await loadAdmin();
  if (loaded) showDashboard();
  else showLogin();

  // El contador de reseñas se actualiza aunque el panel permanezca abierto.
  setInterval(refreshPendingReviews, 15000);
});

function bindEvents() {
  $('#loginForm').addEventListener('submit', login);
  $('#logoutBtn').addEventListener('click', () => logout('Sesión cerrada correctamente.'));

  const sidebar = $('#sidebar');
  const backdrop = $('#sidebarBackdrop');
  const toggle = $('#sideToggle');
  const setSidebar = open => {
    sidebar.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  toggle.addEventListener('click', () => setSidebar(!sidebar.classList.contains('is-open')));
  $('#sidebarClose').addEventListener('click', () => setSidebar(false));
  backdrop.addEventListener('click', () => setSidebar(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setSidebar(false);
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 860) setSidebar(false); });

  $$('.side-link[data-tab]').forEach(button => button.addEventListener('click', () => {
    selectTab(button.dataset.tab);
    setSidebar(false);
  }));
  $$('[data-go]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.go)));

  $('#businessForm').addEventListener('submit', saveBusiness);
  $('#serviceForm').addEventListener('submit', saveService);
  $('#serviceCancel').addEventListener('click', () => resetServiceForm());
  $('#productForm').addEventListener('submit', saveProduct);
  $('#productCancel').addEventListener('click', () => resetProductForm());
  $('#passwordForm').addEventListener('submit', changePassword);

  $('#serviceList').addEventListener('click', handleServiceAction);
  $('#productList').addEventListener('click', handleProductAction);
  $('#reviewList').addEventListener('click', handleReviewAction);
  $('#reviewFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    Admin.filter = button.dataset.filter;
    renderReviews();
  });
}

/* ------------------------------- Sesión ---------------------------------- */

async function login(event) {
  event.preventDefault();
  const error = $('#loginError');
  error.hidden = true;
  const button = $('#loginForm button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Verificando...';

  try {
    const password = $('#loginPass').value;
    if (Cloud.enabled) {
      const email = $('#loginUser').value.trim();
      if (!email || !password) throw new Error('Escribe tu correo y contraseña.');
      const session = await Cloud.signIn(email, password);
      Admin.token = session.access_token;
      Admin.email = (session.user && session.user.email) || email;
      sessionStorage.setItem('is_admin_token', Admin.token);
      sessionStorage.setItem('is_admin_email', Admin.email);
    } else {
      const response = await fetch('api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: $('#loginUser').value.trim(),
          password
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo iniciar sesión.');
      Admin.token = result.token;
      sessionStorage.setItem('is_admin_token', result.token);
    }
    $('#loginForm').reset();
    const loaded = await loadAdmin();
    if (!loaded) throw new Error('No se pudo cargar la información del panel.');
    $('#offlineBanner').hidden = true;
    showDashboard();
    toast('Bienvenido al panel de administración.', 'success');
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    if (!Cloud.enabled && err instanceof TypeError) $('#offlineBanner').hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar al panel';
  }
}

function logout(message) {
  if (Cloud.enabled) Cloud.signOut().catch(() => {});
  Admin.token = '';
  Admin.email = '';
  Admin.data = null;
  Admin.baseline = null;
  ['is_admin_token', 'is_admin_email', 'is_admin_refresh', 'is_admin_expires']
    .forEach(key => sessionStorage.removeItem(key));
  showLogin(message);
}

function showLogin(message) {
  $('#dashboardView').hidden = true;
  $('#loginView').hidden = false;
  $('#adminUserBadge').hidden = true;
  const welcome = $('#adminWelcome');
  if (welcome) welcome.hidden = true;
  if (message) {
    $('#loginError').textContent = message;
    $('#loginError').hidden = false;
  }
}

function renderWelcome() {
  const banner = $('#adminWelcome');
  if (!banner) return;
  const user = Admin.data?.admin?.username || 'administrador';
  const title = $('#welcomeTitle');
  if (title) title.textContent = '¡Bienvenido, ' + user + '!';
  const text = $('#welcomeText');
  if (text) text.textContent = 'Aquí puedes actualizar los datos, el catálogo y las reseñas de tu imprenta.';
  const date = $('#welcomeDate');
  if (date) date.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  banner.hidden = false;
}

function showDashboard() {
  $('#loginView').hidden = true;
  $('#dashboardView').hidden = false;
  $('#offlineBanner').hidden = true;
  $('#adminUserBadge').hidden = false;
  $('#adminUserBadge').textContent = Admin.data?.admin?.username || 'Administrador';
  renderWelcome();
  renderAll();
  selectTab('resumen');
}

async function loadAdmin() {
  if (Cloud.enabled) {
    try {
      const data = await Cloud.loadAdminData();
      Admin.data = data;
      Admin.baseline = JSON.parse(JSON.stringify(data));
      Admin.email = (data.admin && data.admin.email) || Admin.email;
      Admin.online = true;
      return true;
    } catch (err) {
      if (err.status === 401) {
        logout('Tu sesión ha expirado. Vuelve a iniciar sesión.');
        return false;
      }
      $('#offlineBanner').hidden = false;
      return false;
    }
  }
  try {
    const data = await api('api/admin');
    Admin.data = data;
    Admin.baseline = JSON.parse(JSON.stringify(data));
    Admin.online = true;
    return true;
  } catch (err) {
    if (err.message !== 'Sesión expirada') {
      $('#offlineBanner').hidden = false;
    }
    return false;
  }
}

function selectTab(name) {
  $$('.side-link[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
  $$('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
  const [title, subtitle] = PAGE_TEXT[name] || ['Panel', ''];
  $('#pageTitle').textContent = title;
  $('#pageSubtitle').textContent = subtitle;
  if (name === 'resenas') refreshPendingReviews();
}

/* ------------------------------ Render general --------------------------- */

function renderAll() {
  if (!Admin.data) return;
  renderSummary();
  renderPendingBadge();
  renderBusiness();
  renderServices();
  renderProducts();
  renderReviews();
}

async function saveState() {
  const payload = {
    settings: Admin.data.settings,
    services: Admin.data.services,
    products: Admin.data.products,
    reviews: Admin.data.reviews
  };
  if (Cloud.enabled) await Cloud.saveState(payload, Admin.baseline);
  else await api('api/save', { method: 'POST', body: JSON.stringify(payload) });
  await loadAdmin();
  renderAll();
  toast('Cambios guardados y publicados.', 'success');
}

function renderSummary() {
  const reviews = Admin.data.reviews || [];
  $('#statServices').textContent = String((Admin.data.services || []).length);
  $('#statProducts').textContent = String((Admin.data.products || []).length);
  $('#statPending').textContent = String(reviews.filter(r => r.status === 'pending').length);
  $('#statApproved').textContent = String(reviews.filter(r => r.status === 'approved').length);
}

function renderPendingBadge() {
  const badge = $('#pendingReviewsBadge');
  if (!badge) return;
  const pending = (Admin.data?.reviews || []).filter(review => review.status === 'pending').length;
  badge.textContent = String(pending);
  badge.classList.toggle('has-pending', pending > 0);
  badge.title = pending === 1 ? '1 reseña pendiente de aprobación' : pending + ' reseñas pendientes de aprobación';
}

// Trae solo las reseñas para que el contador se actualice sin recargar el panel.
async function refreshPendingReviews() {
  if (!Admin.token || $('#dashboardView').hidden) return;
  try {
    const data = Cloud.enabled ? await Cloud.loadAdminData() : await api('api/admin');
    Admin.data.reviews = data.reviews || [];
    renderSummary();
    renderPendingBadge();
    renderReviews();
  } catch (err) {
    if (err.status === 401) logout('Tu sesión ha expirado. Vuelve a iniciar sesión.');
    // Si falla la consulta, se mantiene el último estado visible.
  }
}

/* ---------------------------- Datos del negocio -------------------------- */

function renderBusiness() {
  const s = Admin.data.settings || {};
  const fields = {
    setBrand: 'brand', setSlogan: 'slogan', setWhatsapp: 'whatsapp', setEmail: 'email',
    setAddress: 'address', setHours: 'hours', setFacebook: 'facebook',
    setInstagram: 'instagram', setTiktok: 'tiktok'
  };
  Object.entries(fields).forEach(([id, key]) => { $('#' + id).value = s[key] || ''; });
}

async function saveBusiness(event) {
  event.preventDefault();
  Admin.data.settings = {
    ...Admin.data.settings,
    brand: $('#setBrand').value.trim(),
    slogan: $('#setSlogan').value.trim(),
    whatsapp: $('#setWhatsapp').value.replace(/\D/g, ''),
    email: $('#setEmail').value.trim(),
    address: $('#setAddress').value.trim(),
    hours: $('#setHours').value.trim(),
    facebook: $('#setFacebook').value.trim(),
    instagram: $('#setInstagram').value.trim(),
    tiktok: $('#setTiktok').value.trim()
  };
  try { await saveState(); } catch (err) { toast(err.message, 'error'); }
}

/* -------------------------------- Servicios ------------------------------ */

function renderServices() {
  const list = $('#serviceList');
  list.innerHTML = '';
  if (!(Admin.data.services || []).length) {
    list.innerHTML = '<div class="empty-state">Todavía no hay servicios. Agrega el primero con el formulario de arriba.</div>';
    return;
  }
  Admin.data.services.forEach(service => {
    const row = document.createElement('article');
    row.className = 'list-row';

    const icon = document.createElement('span');
    if (service.image) {
      icon.className = 'row-thumb';
      const thumb = document.createElement('img');
      const source = String(service.image || '');
      thumb.src = /^https?:\/\//i.test(source) ? source : '../' + source.replace(/^\.\.\//, '');
      thumb.alt = '';
      thumb.loading = 'lazy';
      icon.appendChild(thumb);
    } else {
      icon.className = 'row-icon';
      icon.textContent = '✦';
    }

    const main = document.createElement('div');
    main.className = 'row-main';
    const title = document.createElement('h3');
    title.textContent = service.title;
    const description = document.createElement('p');
    description.textContent = service.description || 'Sin descripción';
    main.append(title, description);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      makeButton('Editar', 'ghost', 'edit', service.id),
      makeButton('Eliminar', 'danger', 'delete', service.id)
    );

    row.append(icon, main, actions);
    list.appendChild(row);
  });
}

function makeButton(label, style, action, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn ' + style + ' small';
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
}

function resetServiceForm() {
  $('#serviceForm').reset();
  $('#serviceId').value = '';
  $('#serviceIcon').value = 'digital';
  $('#serviceSubmit').textContent = 'Agregar servicio';
  $('#serviceCancel').hidden = true;
}

async function saveService(event) {
  event.preventDefault();
  const submit = $('#serviceSubmit');
  submit.disabled = true;
  submit.textContent = 'Guardando...';
  try {
    const id = $('#serviceId').value;
    let image = $('#serviceImage').value.trim();
    const file = $('#serviceFile').files[0];
    if (file) image = await uploadImage(file);

    const item = {
      id: id || 'srv_' + Date.now(),
      title: $('#serviceTitle').value.trim(),
      description: $('#serviceDescription').value.trim(),
      icon: $('#serviceIcon').value,
      image
    };
    if (!item.title) { toast('Escribe el título del servicio.', 'error'); return; }

    const services = Admin.data.services || [];
    if (id) {
      const index = services.findIndex(service => service.id === id);
      if (index >= 0) services[index] = item;
    } else {
      services.push(item);
    }
    Admin.data.services = services;
    await saveState();
    resetServiceForm();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = $('#serviceId').value ? 'Guardar cambios' : 'Agregar servicio';
  }
}

function handleServiceAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const service = Admin.data.services.find(item => item.id === id);
  if (!service) return;

  if (button.dataset.action === 'edit') {
    $('#serviceId').value = service.id;
    $('#serviceTitle').value = service.title;
    $('#serviceDescription').value = service.description || '';
    $('#serviceIcon').value = service.icon || 'digital';
    $('#serviceImage').value = service.image || '';
    $('#serviceFile').value = '';
    $('#serviceSubmit').textContent = 'Guardar cambios';
    $('#serviceCancel').hidden = false;
    $('#serviceTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (button.dataset.action === 'delete' && confirm('¿Eliminar el servicio "' + service.title + '"?')) {
    Admin.data.services = Admin.data.services.filter(item => item.id !== id);
    saveState().catch(err => toast(err.message, 'error'));
  }
}

/* -------------------------------- Productos ------------------------------ */

function renderProducts() {
  const list = $('#productList');
  list.innerHTML = '';
  if (!(Admin.data.products || []).length) {
    list.innerHTML = '<div class="empty-state">Todavía no hay productos. Agrega el primero con el formulario de arriba.</div>';
    return;
  }
  Admin.data.products.forEach(product => {
    const card = document.createElement('article');
    card.className = 'product-admin-card';
    const image = document.createElement('img');
    const source = String(product.image || '');
    image.src = source
      ? (/^https?:\/\//i.test(source) ? source : '../' + source.replace(/^\.\.\//, ''))
      : '../img/producto-tarjetas.svg';
    image.alt = product.name;
    image.loading = 'lazy';
    image.onerror = () => { image.onerror = null; image.src = '../img/producto-tarjetas.svg'; };

    const body = document.createElement('div');
    body.className = 'pac-body';
    const title = document.createElement('h3');
    title.textContent = product.name;
    const description = document.createElement('p');
    description.textContent = product.description || 'Sin descripción';
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      makeButton('Editar', 'ghost', 'edit', product.id),
      makeButton('Eliminar', 'danger', 'delete', product.id)
    );
    body.append(title, description, actions);
    card.append(image, body);
    list.appendChild(card);
  });
}

function resetProductForm() {
  $('#productForm').reset();
  $('#productId').value = '';
  $('#productSubmit').textContent = 'Agregar producto';
  $('#productCancel').hidden = true;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file) {
  if (Cloud.enabled) return Cloud.uploadImage(file);
  const dataUrl = await readFileAsDataUrl(file);
  const uploaded = await api('api/upload', {
    method: 'POST', body: JSON.stringify({ dataUrl })
  });
  return uploaded.path;
}

async function saveProduct(event) {
  event.preventDefault();
  const submit = $('#productSubmit');
  submit.disabled = true;
  submit.textContent = 'Guardando...';
  try {
    const id = $('#productId').value;
    let image = $('#productImage').value.trim();
    const file = $('#productFile').files[0];
    if (file) image = await uploadImage(file);

    const item = {
      id: id || 'prod_' + Date.now(),
      name: $('#productName').value.trim(),
      description: $('#productDescription').value.trim(),
      image: image || 'img/producto-tarjetas.svg',
      badge: $('#productBadge').value.trim()
    };
    if (!item.name) { toast('Escribe el nombre del producto.', 'error'); return; }

    const products = Admin.data.products || [];
    if (id) {
      const index = products.findIndex(product => product.id === id);
      if (index >= 0) products[index] = item;
    } else {
      products.push(item);
    }
    Admin.data.products = products;
    await saveState();
    resetProductForm();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = $('#productId').value ? 'Guardar cambios' : 'Agregar producto';
  }
}

function handleProductAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const product = Admin.data.products.find(item => item.id === id);
  if (!product) return;

  if (button.dataset.action === 'edit') {
    $('#productId').value = product.id;
    $('#productName').value = product.name;
    $('#productDescription').value = product.description || '';
    $('#productImage').value = product.image || '';
    $('#productBadge').value = product.badge || '';
    $('#productSubmit').textContent = 'Guardar cambios';
    $('#productCancel').hidden = false;
    $('#productName').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (button.dataset.action === 'delete' && confirm('¿Eliminar el producto "' + product.name + '"?')) {
    Admin.data.products = Admin.data.products.filter(item => item.id !== id);
    saveState().catch(err => toast(err.message, 'error'));
  }
}

/* -------------------------------- Reseñas --------------------------------- */

function renderReviews() {
  $$('#reviewFilters .filter').forEach(button => button.classList.toggle('active', button.dataset.filter === Admin.filter));
  const list = $('#reviewList');
  list.innerHTML = '';
  let reviews = Admin.data.reviews || [];
  if (Admin.filter !== 'all') reviews = reviews.filter(review => review.status === Admin.filter);
  if (!reviews.length) {
    list.innerHTML = '<div class="empty-state">No hay reseñas en esta categoría.</div>';
    return;
  }

  reviews.forEach(review => {
    const row = document.createElement('article');
    row.className = 'list-row';

    const icon = document.createElement('span');
    icon.className = 'row-icon';
    icon.textContent = '★';

    const main = document.createElement('div');
    main.className = 'row-main';
    const badge = document.createElement('span');
    badge.className = 'badge ' + review.status;
    badge.textContent = review.status === 'pending' ? 'Pendiente' : review.status === 'approved' ? 'Publicada' : 'Rechazada';
    const title = document.createElement('h3');
    title.textContent = review.name;
    const stars = document.createElement('span');
    stars.className = 'review-stars-admin';
    stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const date = document.createElement('span');
    date.className = 'review-date';
    date.textContent = formatDate(review.date);
    const text = document.createElement('p');
    text.textContent = '“' + review.text + '”';
    main.append(badge, title, stars, date, text);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    if (review.status !== 'approved') actions.append(makeButton('Aprobar', 'success', 'approve', review.id));
    if (review.status !== 'rejected') actions.append(makeButton('Rechazar', 'ghost', 'reject', review.id));
    actions.append(makeButton('Eliminar', 'danger', 'delete', review.id));

    row.append(icon, main, actions);
    list.appendChild(row);
  });
}

function handleReviewAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const review = Admin.data.reviews.find(item => item.id === id);
  if (!review) return;
  const action = button.dataset.action;

  if (action === 'delete') {
    if (!confirm('¿Eliminar la reseña de ' + review.name + '?')) return;
    Admin.data.reviews = Admin.data.reviews.filter(item => item.id !== id);
  } else {
    review.status = action === 'approve' ? 'approved' : 'rejected';
  }
  saveState().catch(err => toast(err.message, 'error'));
}

/* ------------------------------- Seguridad ------------------------------- */

async function changePassword(event) {
  event.preventDefault();
  const current = $('#currentPassword').value;
  const next = $('#newPassword').value;
  const confirmation = $('#confirmPassword').value;
  if (next !== confirmation) { toast('Las contraseñas nuevas no coinciden.', 'error'); return; }
  if (next.length < 8) { toast('La contraseña debe tener al menos 8 caracteres.', 'error'); return; }

  try {
    if (Cloud.enabled) await Cloud.updatePassword(current, next);
    else await api('api/password', { method: 'POST', body: JSON.stringify({ current, next }) });
    $('#passwordForm').reset();
    toast('Contraseña actualizada correctamente.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}
