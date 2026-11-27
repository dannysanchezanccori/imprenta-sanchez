/* ==========================================================================
   IMPRENTA SANCHEZ — Lógica del sitio público (JavaScript puro)
   --------------------------------------------------------------------------
   Los datos se toman de Supabase en GitHub Pages, de la API local cuando
   corre el servidor, y de js/data.js al abrir index.html con doble clic.
   ========================================================================== */

'use strict';

const App = {
  data: window.SITE_DATA_DEFAULT || {},
  online: false,
  orderStep: 1,
  waMessage: ''
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const REVIEW_QUEUE_KEY = 'imprenta_sanchez_resenas_pendientes';
// Al abrir index.html con doble clic, las reseñas se envían al servidor local si está activo.
const LOCAL_SERVER = 'http://localhost:3000';
const THEME_KEY = 'is_theme';
const LOGO = { light: 'img/logo_paraclaro.png', dark: 'img/logo_paraoscuro.png' };

/* Iconos de redes sociales dibujados con SVG (se colorean desde CSS). */
const SOCIAL_ICONS = {
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-2.2 0-4 1.8-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8c0-.6.4-1 1-1Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3c.4 2.6 2 4.2 4.5 4.5v3a7 7 0 0 1-4.5-1.6v6.6a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.7 2.4V3H14Z"/></svg>'
};

/* Iconos SVG de los servicios (el administrador elige cuál usar). */
const ICONS = {
  digital: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  offset: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h7M7 16h4"/></svg>',
  tarjeta: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h5M7 10h8"/></svg>',
  volante: '<svg viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5z"/><path d="M16 3v4h3M8 12h8M8 16h6"/></svg>',
  banner: '<svg viewBox="0 0 24 24"><path d="M3 7h18v9H3zM7 16v4M17 16v4"/><path d="M3 11c3-2 5 2 8 0s5 2 10 0"/></svg>',
  sello: '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="6"/><path d="M12 8V3M9 3h6M9 14l2 2 4-4"/></svg>',
  etiqueta: '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
  afiche: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="9" r="3"/><path d="M7 17h10M7 19h6"/></svg>',
  laminado: '<svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>',
  default: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M12 8v8"/></svg>'
};

/* ------------------------------- Utilidades ------------------------------ */

function waUrl(number, message) {
  const digits = String(number || '').replace(/\D/g, '');
  return 'https://wa.me/' + digits + (message ? '?text=' + encodeURIComponent(message) : '');
}

function toast(message, kind = '') {
  const root = $('#toastRoot');
  if (!root) return;
  const item = document.createElement('div');
  item.className = 'toast' + (kind ? ' ' + kind : '');
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function formatDate(value) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ------------------------------- Tema ------------------------------------ */

function initTheme() {
  const button = $('#themeToggle');

  const apply = theme => {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';

    // El logo cambia con el fondo: claro sobre superficies oscuras y viceversa.
    $$('[data-logo]').forEach(image => { image.src = LOGO[theme]; });
    const favicon = $('#siteFavicon');
    if (favicon) favicon.href = LOGO[theme];
    const meta = $('#themeColorMeta');
    if (meta) meta.content = dark ? '#0b1220' : '#003D8E';

    if (button) {
      const label = dark ? 'Activar modo claro' : 'Activar modo oscuro';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(dark));
    }
  };

  apply(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  if (button) {
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* modo incógnito */ }
      apply(next);
      toast(next === 'dark' ? 'Modo oscuro activado.' : 'Modo claro activado.');
    });
  }
}

function initVideo() {
  const video = $('#heroVideo');
  if (!video || typeof video.play !== 'function') return;
  const playing = video.play();
  if (playing && typeof playing.catch === 'function') playing.catch(() => {
    // Si el navegador bloquea la reproducción automática, se conserva el póster.
  });
}

/* ----------------------------- Inicialización ---------------------------- */

document.addEventListener('DOMContentLoaded', async () => {
  $('#year').textContent = String(new Date().getFullYear());
  initTheme();
  initNav();
  initReveal();
  await loadData();
  renderAll();
  initVideo();
  initCarousels();
  initOrder();
  initReviews();
  initChat();
  flushPendingReviews();
});

async function loadData() {
  if (Cloud.enabled) {
    // En GitHub Pages no hay servidor local: los datos vienen de Supabase.
    try {
      const data = await Cloud.publicData();
      if (data && data.settings) {
        App.data = data;
        App.online = true;
        return;
      }
    } catch (_) {
      // Si Supabase no responde, se mantiene la instantánea de js/data.js.
    }
    return;
  }
  try {
    // Con servidor, la API siempre tiene los últimos cambios del panel.
    const response = await fetch('api/site', { cache: 'no-store' });
    const type = response.headers.get('content-type') || '';
    if (response.ok && type.includes('application/json')) {
      const data = await response.json();
      if (data && data.settings) {
        App.data = data;
        App.online = true;
      }
    }
  } catch (_) {
    // Abriendo el archivo desde disco (file://) se usa la instantánea local.
  }
}

function renderAll() {
  applySettings();
  renderServices();
  renderProducts();
  renderReviews();
  fillOrderProducts();
}

/* ---------------------------- Datos del negocio -------------------------- */

function applySettings() {
  const s = App.data.settings || {};

  $$('[data-setting]').forEach(element => {
    const value = s[element.dataset.setting] || '';
    element.textContent = value || (element.dataset.setting === 'brand' ? 'Imprenta Sanchez' : 'Por definir');
  });
  $$('[data-setting-brand-title]').forEach(element => {
    element.textContent = s.brand || 'Imprenta Sanchez';
  });

  const welcome = 'Hola, quisiera información sobre sus servicios.';
  ['heroWhatsapp', 'contactWhatsapp', 'footerWhatsapp', 'waFloat'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.href = waUrl(s.whatsapp, id === 'heroWhatsapp' ? welcome : '');
  });

  const number = String(s.whatsapp || '');
  ['contactWhatsapp', 'footerWhatsapp'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = number || 'Consultar por WhatsApp';
  });

  ['contactAddress', 'footerAddress'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = s.address || 'Dirección por definir';
  });
  ['contactHours', 'footerHours'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = s.hours || 'Horarios por definir';
  });

  const footerEmail = $('#footerEmail');
  if (footerEmail) footerEmail.textContent = s.email || 'Correo por definir';
  const contactEmail = $('#contactEmail');
  if (contactEmail) {
    if (s.email) {
      contactEmail.textContent = s.email;
      contactEmail.href = 'mailto:' + s.email;
      contactEmail.style.color = 'var(--blue)';
    } else {
      contactEmail.textContent = 'Correo por definir';
      contactEmail.removeAttribute('href');
    }
  }

  const map = $('#mapFrame');
  if (map) {
    map.src = 'https://www.google.com/maps?q=' + encodeURIComponent(s.address || 'Imprenta Sanchez') + '&output=embed';
  }

  const socials = $('#socialLinks');
  if (socials) {
    socials.innerHTML = ''; // Se reconstruye con los valores actuales del admin.
    [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']].forEach(([key, label]) => {
      const url = String(s[key] || '').trim();
      if (!url) return;
      const link = document.createElement('a');
      link.className = 'social-link';
      link.href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = label;
      link.setAttribute('aria-label', label);
      link.innerHTML = SOCIAL_ICONS[key] || '';
      socials.appendChild(link);
    });
  }
}

/* ------------------------------ Servicios -------------------------------- */

function renderServices() {
  const grid = $('#servicesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  (App.data.services || []).forEach((service, index) => {
    const card = document.createElement('article');
    card.className = 'service-card';
    card.dataset.reveal = '';
    card.style.transitionDelay = (index % 3) * 70 + 'ms';

    const number = document.createElement('span');
    number.className = 'service-index';
    number.textContent = String(index + 1).padStart(2, '0');

    if (service.image) {
      card.classList.add('has-image');
      const photo = document.createElement('div');
      photo.className = 'service-photo';
      const image = document.createElement('img');
      image.src = service.image;
      image.alt = service.title || 'Servicio de impresión';
      image.loading = 'lazy';
      image.onerror = () => { image.remove(); photo.remove(); card.classList.remove('has-image'); };
      photo.appendChild(image);
      card.appendChild(photo);
    }

    const body = document.createElement('div');
    body.className = 'service-body';

    const icon = document.createElement('div');
    icon.className = 'service-icon';
    icon.innerHTML = ICONS[service.icon] || ICONS.default;

    const title = document.createElement('h3');
    title.textContent = service.title || '';
    const description = document.createElement('p');
    description.textContent = service.description || '';

    body.append(icon, title, description);
    card.append(number, body);
    grid.appendChild(card);
  });
  observeReveals(grid);
}

/* ------------------------------ Productos -------------------------------- */

function renderProducts() {
  const track = $('#productsTrack');
  if (!track) return;
  track.innerHTML = '';
  const products = App.data.products || [];

  if (!products.length) {
    const empty = document.createElement('p');
    empty.className = 'form-note';
    empty.textContent = 'Próximamente publicaremos nuestro catálogo.';
    track.appendChild(empty);
    return;
  }

  products.forEach(product => {
    const card = document.createElement('article');
    card.className = 'product-card';

    const figure = document.createElement('div');
    figure.className = 'product-image';
    const image = document.createElement('img');
    image.src = product.image || 'img/producto-tarjetas.svg';
    image.alt = product.name || 'Producto de imprenta';
    image.loading = 'lazy';
    image.onerror = () => { image.onerror = null; image.src = 'img/producto-tarjetas.svg'; };
    figure.appendChild(image);

    const body = document.createElement('div');
    body.className = 'product-body';
    if (product.badge) {
      const badge = document.createElement('span');
      badge.className = 'product-badge';
      badge.textContent = product.badge;
      body.appendChild(badge);
    }
    const title = document.createElement('h3');
    title.textContent = product.name || '';
    const description = document.createElement('p');
    description.textContent = product.description || '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'product-btn';
    button.textContent = 'Pedir este producto';
    button.addEventListener('click', () => {
      selectProduct(product.name);
      $('#pedido').scrollIntoView({ behavior: 'smooth', block: 'start' });
      goToStep(1);
    });
    body.append(title, description, button);

    card.append(figure, body);
    track.appendChild(card);
  });
}

/* ------------------------------- Reseñas --------------------------------- */

function renderReviews() {
  const track = $('#reviewsTrack');
  if (!track) return;
  track.innerHTML = '';
  const approved = (App.data.reviews || []).filter(review => review.status === 'approved');

  if (!approved.length) {
    const empty = document.createElement('p');
    empty.className = 'form-note';
    empty.textContent = 'Aún no hay reseñas publicadas. ¡Sé la primera persona en compartir tu experiencia!';
    track.appendChild(empty);
    return;
  }

  approved.forEach(review => {
    const card = document.createElement('article');
    card.className = 'review-card';

    const stars = document.createElement('div');
    stars.className = 'review-stars';
    stars.setAttribute('aria-label', review.rating + ' de 5 estrellas');
    stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

    const text = document.createElement('p');
    text.textContent = '“' + (review.text || '') + '”';

    const author = document.createElement('div');
    author.className = 'review-author';
    const avatar = document.createElement('span');
    avatar.className = 'review-avatar';
    avatar.textContent = (review.name || 'C').charAt(0).toUpperCase();
    const meta = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = review.name || 'Cliente';
    const date = document.createElement('small');
    date.textContent = formatDate(review.date);
    meta.append(name, date);
    author.append(avatar, meta);

    card.append(stars, text, author);
    track.appendChild(card);
  });
}

/* ------------------------------- Carruseles ------------------------------ */

function initCarousel(track, previousButton, nextButton, options = {}) {
  if (!track || !previousButton || !nextButton) return;

  let animation = null;
  let fallbackTimer = null;

  const finishAnimation = target => {
    if (animation) cancelAnimationFrame(animation);
    if (fallbackTimer) clearTimeout(fallbackTimer);
    animation = null;
    fallbackTimer = null;
    if (typeof target === 'number') track.scrollLeft = target;
    track.style.scrollBehavior = '';
    track.style.scrollSnapType = '';
  };

  const stopAnimation = () => finishAnimation();

  // Deslizamiento lento y continuo, controlado cuadro a cuadro.
  const animateTo = (target, duration) => {
    stopAnimation();
    const start = track.scrollLeft;
    const distance = target - start;
    if (Math.abs(distance) < 2) { track.scrollLeft = target; return; }
    const easing = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const started = performance.now();
    track.style.scrollBehavior = 'auto';
    track.style.scrollSnapType = 'none';
    // Si la pestaña queda en segundo plano, el temporizador garantiza el estado final.
    fallbackTimer = setTimeout(() => finishAnimation(target), duration + 200);
    const step = now => {
      const t = Math.min(1, (now - started) / duration);
      track.scrollLeft = start + distance * easing(t);
      if (t < 1) animation = requestAnimationFrame(step);
      else finishAnimation(target);
    };
    animation = requestAnimationFrame(step);
  };

  // Un clic = un espacio de tarjeta; mantiene la animación lenta y el retorno al inicio.
  const stepWidth = () => {
    const cards = track.children;
    if (options.step === 'card' && cards.length > 1) {
      const pitch = Math.abs(cards[1].offsetLeft - cards[0].offsetLeft);
      if (pitch > 0) return pitch;
    }
    return Math.max(260, track.clientWidth);
  };

  const move = direction => {
    const max = track.scrollWidth - track.clientWidth;
    if (max <= 4) { animateTo(0, 600); return; }
    const step = stepWidth();
    const current = track.scrollLeft;
    let target;
    let wraps = false;
    if (direction > 0 && current >= max - 4) { target = 0; wraps = true; }
    else if (direction < 0 && current <= 4) { target = max; wraps = true; }
    else if (direction > 0) target = Math.min(max, current + step);
    else target = Math.max(0, current - step);
    animateTo(target, wraps ? 1000 : 800);
  };

  previousButton.disabled = false;
  nextButton.disabled = false;
  previousButton.addEventListener('click', () => move(-1));
  nextButton.addEventListener('click', () => move(1));
  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  });

  // Arrastre con mouse (en móvil se conserva el desplazamiento táctil nativo).
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  track.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    stopAnimation();
    dragging = true;
    startX = event.clientX;
    startScroll = track.scrollLeft;
    track.style.scrollSnapType = 'none';
  });
  window.addEventListener('pointermove', event => {
    if (dragging) track.scrollLeft = startScroll - (event.clientX - startX);
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    track.style.scrollSnapType = '';
  });
}

function initCarousels() {
  initCarousel($('#productsTrack'), $('#productsPrev'), $('#productsNext'), { step: 'card' });
  initCarousel($('#reviewsTrack'), $('#reviewsPrev'), $('#reviewsNext'), { step: 'card' });
}

/* --------------------------- Configurador pedido ------------------------- */

function fillOrderProducts() {
  const select = $('#orderProduct');
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '<option value="">Selecciona una opción</option>';
  (App.data.products || []).forEach(product => {
    const option = document.createElement('option');
    option.value = product.name;
    option.textContent = product.name;
    select.appendChild(option);
  });
  if (previous) select.value = previous;
}

function selectProduct(name) {
  const select = $('#orderProduct');
  if (!select || !name) return;
  const option = Array.from(select.options).find(item => item.value === name);
  if (option) select.value = name;
}

function showOrderError(message) {
  const error = $('#orderError');
  error.textContent = message;
  error.hidden = false;
}

function clearOrderError() {
  const error = $('#orderError');
  error.hidden = true;
  error.textContent = '';
}

function validateStep(step) {
  clearOrderError();
  const value = id => ($(id) || {}).value || '';
  if (step === 1 && !value('#orderProduct')) {
    showOrderError('Elige el producto para continuar.'); return false;
  }
  if (step === 2 && Number(value('#orderQty')) < 1) {
    showOrderError('Ingresa una cantidad válida.'); return false;
  }
  if (step === 4 && value('#orderName').trim().length < 2) {
    showOrderError('Escribe tu nombre.'); return false;
  }
  return true;
}

function goToStep(step) {
  App.orderStep = step;
  clearOrderError();
  $$('.order-step').forEach(section => { section.hidden = Number(section.dataset.step) !== step; });
  $('#stepCurrent').textContent = String(step);
  $('#progressBar').style.width = (step * 25) + '%';
  $('#stepPrev').hidden = step === 1;
  $('#stepNext').hidden = step === 4;
  $('#stepSubmit').hidden = step !== 4;
  $$('[data-step-dot]').forEach(dot => {
    const number = Number(dot.dataset.stepDot);
    dot.classList.toggle('active', number === step);
    dot.classList.toggle('done', number < step);
  });
  if (step === 4) renderOrderSummary();
}

function orderValues() {
  const value = id => String(($(id) || {}).value || '').trim();
  return {
    product: value('#orderProduct'),
    quantity: value('#orderQty'),
    comments: value('#orderComments'),
    name: value('#orderName'),
    phone: value('#orderPhone'),
    email: value('#orderEmail')
  };
}

function renderOrderSummary() {
  const values = orderValues();
  const rows = [
    ['Producto', values.product],
    ['Cantidad', values.quantity],
    ['Comentarios', values.comments || 'Sin comentarios'],
    ['Contacto', values.name + (values.phone ? ' · ' + values.phone : '') + (values.email ? ' · ' + values.email : '')]
  ];
  const box = $('#orderSummary');
  box.innerHTML = '<h4>Resumen de tu pedido</h4>';
  const list = document.createElement('dl');
  rows.forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value || '—';
    list.append(dt, dd);
  });
  box.appendChild(list);
}

function buildOrderMessage() {
  const v = orderValues();
  return [
    '¡Hola! 👋 Quiero solicitar una cotización de impresión.',
    '',
    '🖨️ Producto: ' + v.product,
    '🔢 Cantidad: ' + v.quantity,
    '💬 Comentarios: ' + (v.comments || 'Sin comentarios'),
    '',
    '👤 Nombre: ' + v.name,
    '📱 Celular: ' + (v.phone || 'No indicado'),
    '✉️ Correo: ' + (v.email || 'No indicado')
  ].join('\n');
}

function resetOrder() {
  const form = $('#orderForm');
  if (form) form.reset();
  App.orderStep = 1;
  App.waMessage = '';
  const success = $('#orderSuccess');
  if (success) success.hidden = true;
  const actions = $('#orderActions');
  if (actions) actions.hidden = false;
  clearOrderError();
  goToStep(1);
}

function initOrder() {
  $('#stepNext').addEventListener('click', () => {
    if (validateStep(App.orderStep)) goToStep(App.orderStep + 1);
  });
  $('#stepPrev').addEventListener('click', () => goToStep(App.orderStep - 1));

  ['#orderProduct', '#orderQty', '#orderComments', '#orderName', '#orderPhone', '#orderEmail'].forEach(id => {
    $(id).addEventListener('input', () => {
      if (App.orderStep === 4) renderOrderSummary();
    });
  });

  $('#newOrderBtn').addEventListener('click', () => {
    resetOrder();
    $('#orderForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Listo para armar otro pedido.', 'success');
  });

  $('#orderForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!validateStep(4)) return;
    App.waMessage = buildOrderMessage();
    const link = waUrl((App.data.settings || {}).whatsapp, App.waMessage);
    $('#orderSuccess').hidden = false;
    $('#orderActions').hidden = true;
    $$('.order-step').forEach(section => { section.hidden = true; });
    $('#orderSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.open(link, '_blank', 'noopener');
    toast('Mensaje listo. Revisa la ventana de WhatsApp.', 'success');
  });

  goToStep(1);
}

/* --------------------------- Reseñas de clientes ------------------------- */

function initReviews() {
  let rating = 5;
  const stars = $$('#reviewStars .star');
  const paintStars = () => stars.forEach(star => star.classList.toggle('active', Number(star.dataset.value) <= rating));
  paintStars();
  stars.forEach(star => star.addEventListener('click', () => {
    rating = Number(star.dataset.value);
    $('#reviewRating').value = String(rating);
    paintStars();
  }));

  $('#reviewForm').addEventListener('submit', async event => {
    event.preventDefault();
    const status = $('#reviewStatus');
    const name = $('#reviewName').value.trim();
    const text = $('#reviewText').value.trim();

    if (name.length < 2 || text.length < 8) {
      status.textContent = 'Escribe tu nombre y un comentario de al menos 8 caracteres.';
      status.classList.remove('ok');
      return;
    }

    const review = {
      id: 'rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name, text, rating, status: 'pending', date: new Date().toISOString()
    };

    status.textContent = 'Enviando reseña...';
    try {
      await postReview(review);
      status.textContent = '¡Gracias! Tu reseña quedó pendiente de aprobación.';
      status.classList.add('ok');
      toast('Reseña enviada. Gracias por compartir.', 'success');
    } catch (_) {
      const queue = JSON.parse(localStorage.getItem(REVIEW_QUEUE_KEY) || '[]');
      queue.push(review);
      localStorage.setItem(REVIEW_QUEUE_KEY, JSON.stringify(queue));
      status.textContent = Cloud.enabled
        ? 'Gracias. Tu reseña se enviará en cuanto vuelva la conexión.'
        : 'Gracias. Tu reseña se enviará en cuanto el sitio se abra con el servidor activo.';
      status.classList.add('ok');
      toast(Cloud.enabled ? 'Reseña guardada; se enviará al reconectar.' : 'Reseña guardada localmente.', 'success');
    }
    $('#reviewForm').reset();
    rating = 5;
    $('#reviewRating').value = '5';
    paintStars();
  });
}

async function postReview(review) {
  if (Cloud.enabled) return Cloud.insertReview(review);
  const endpoint = location.protocol === 'file:' ? LOCAL_SERVER + '/api/reviews' : 'api/reviews';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review)
  });
  if (!response.ok) throw new Error('No se pudo enviar');
}

async function flushPendingReviews() {
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(REVIEW_QUEUE_KEY) || '[]'); } catch (_) { queue = []; }
  if (!queue.length) return;
  const pending = [];
  for (const review of queue) {
    try { await postReview(review); } catch (_) { pending.push(review); }
  }
  localStorage.setItem(REVIEW_QUEUE_KEY, JSON.stringify(pending));
  if (queue.length !== pending.length) renderReviews();
}

// Si el servidor se inicia después, la cola se envía al volver a la pestaña.
window.addEventListener('focus', flushPendingReviews);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) flushPendingReviews();
});

/* -------------------------------- Chatbot -------------------------------- */

function initChat() {
  const panel = $('#chatPanel');
  const toggle = $('#chatToggle');
  const settings = App.data.settings || {};

  const open = () => {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    $('#chatInput').focus();
  };
  const close = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => panel.hidden ? open() : close());
  $('#chatClose').addEventListener('click', close);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(); });

  addBotMessage('¡Hola! 👋 Soy Printy, tu asistente en ' + (settings.brand || 'la imprenta') +
    '. Puedo ayudarte con servicios, horarios, ubicación y pedidos. ¿Qué necesitas?');

  const quick = $('#chatQuick');
  const quickPrev = $('#chatQuickPrev');
  const quickNext = $('#chatQuickNext');

  const updateQuickNav = () => {
    const max = quick.scrollWidth - quick.clientWidth;
    quickPrev.hidden = quick.scrollLeft <= 4;
    quickNext.hidden = max <= 4 || quick.scrollLeft >= max - 4;
  };
  quickPrev.addEventListener('click', () => quick.scrollBy({ left: -160, behavior: 'smooth' }));
  quickNext.addEventListener('click', () => quick.scrollBy({ left: 160, behavior: 'smooth' }));
  quick.addEventListener('scroll', updateQuickNav, { passive: true });
  window.addEventListener('resize', updateQuickNav);

  // Arrastre con el mouse (y con el dedo) sobre los botones rápidos.
  let quickDrag = null;
  let suppressQuickClick = false;
  quick.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    suppressQuickClick = false;
    quickDrag = { id: event.pointerId, x: event.clientX, left: quick.scrollLeft, moved: false };
    quick.style.scrollBehavior = 'auto';
    try { quick.setPointerCapture(event.pointerId); } catch (_) { /* navegador sin captura */ }
  });
  quick.addEventListener('pointermove', event => {
    if (!quickDrag || event.pointerId !== quickDrag.id) return;
    const dx = event.clientX - quickDrag.x;
    if (Math.abs(dx) > 5) quickDrag.moved = true;
    if (!quickDrag.moved) return;
    quick.scrollLeft = quickDrag.left - dx;
    suppressQuickClick = true;
    event.preventDefault();
  });
  const endQuickDrag = event => {
    if (!quickDrag || (event && event.pointerId !== quickDrag.id)) return;
    const moved = quickDrag.moved;
    try { quick.releasePointerCapture(quickDrag.id); } catch (_) { /* navegador sin captura */ }
    quickDrag = null;
    quick.style.scrollBehavior = '';
    if (moved) setTimeout(() => { suppressQuickClick = false; }, 120);
  };
  quick.addEventListener('pointerup', endQuickDrag);
  quick.addEventListener('pointercancel', endQuickDrag);

  ['Servicios', 'Horarios', 'Ubicación', 'Cotización', 'Hacer un pedido'].forEach(label => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = label;
    chip.addEventListener('click', () => {
      if (suppressQuickClick) { suppressQuickClick = false; return; }
      sendChatMessage(label);
    });
    quick.appendChild(chip);
  });
  updateQuickNav();
  requestAnimationFrame(updateQuickNav);

  $('#chatForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#chatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendChatMessage(text);
  });
}

function sendChatMessage(text) {
  addChatMessage(text, 'user');
  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.innerHTML = '<i></i><i></i><i></i>';
  $('#chatMessages').appendChild(typing);
  scrollChat();

  // Pequeña pausa para que la respuesta se sienta natural (no brusca).
  setTimeout(() => {
    typing.remove();
    const answer = botAnswer(text);
    addChatMessage(answer.text, 'bot', answer.link);
  }, 480);
}

function addChatMessage(text, who, link) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg ' + who;
  bubble.textContent = text;
  if (link) {
    const anchor = document.createElement('a');
    anchor.textContent = '\n' + link.label;
    anchor.href = link.href;
    if (link.external) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    if (link.close) {
      anchor.addEventListener('click', () => { $('#chatPanel').hidden = true; $('#chatToggle').setAttribute('aria-expanded', 'false'); });
    }
    bubble.appendChild(anchor);
  }
  $('#chatMessages').appendChild(bubble);
  scrollChat();
}

function addBotMessage(text, link) {
  addChatMessage(text, 'bot', link);
}

function scrollChat() {
  const container = $('#chatMessages');
  container.scrollTop = container.scrollHeight;
}

function botAnswer(rawText) {
  const text = rawText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const s = App.data.settings || {};
  const number = String(s.whatsapp || '');
  const wa = { label: '→ Abrir WhatsApp', href: waUrl(number, 'Hola, tengo una consulta.'), external: true };
  const orderLink = { label: '→ Ir a “Arma tu pedido”', href: '#pedido', close: true };

  if (/nombre|como te llamas|quien eres|tu nombre/.test(text)) {
    return { text: 'Soy Printy, el asistente virtual de ' + (s.brand || 'Imprenta Sanchez') + '. Estoy aquí para ayudarte con tus consultas de impresión. 😊' };
  }
  if (/hola|buenas|buen dia|hello|hey/.test(text)) {
    return { text: '¡Hola! Encantados de ayudarte. Puedo contarte sobre nuestros servicios, horarios, ubicación o cómo hacer un pedido.' };
  }
  if (/servicio|que hacen|ofrecen|imprimen|producto|catalogo/.test(text)) {
    const names = (App.data.services || []).slice(0, 6).map(item => '• ' + item.title).join('\n');
    return {
      text: 'Trabajamos con:\n' + (names || 'impresión digital, offset y gran formato') +
        '\n\nTambién puedes ver el catálogo completo en la sección Productos.'
    };
  }
  if (/horario|atienden|abierto|hora|dia de atencion/.test(text)) {
    return { text: 'Nuestros horarios son:\n' + (s.hours || 'Consúltanos por WhatsApp para conocer los horarios.'), link: wa };
  }
  if (/ubicacion|direccion|donde|local|llegar|mapa|domicilio/.test(text)) {
    return { text: 'Estamos en:\n' + (s.address || 'Dirección por definir'), link: { label: '→ Ver en el mapa', href: '#ubicacion', close: true } };
  }
  if (/cotiza|precio|cuanto|costo|presupuesto|valor|tarifa/.test(text)) {
    return {
      text: 'El precio depende del producto, cantidad, medidas, material y acabado. Si completas el configurador, el mensaje llega listo a nuestro WhatsApp y te respondemos sin compromiso.',
      link: orderLink
    };
  }
  if (/pedido|arma|hacer|solicitar|pedir|comprar/.test(text)) {
    return {
      text: 'Para pedir: 1) elige producto, 2) indica cantidad y medidas, 3) selecciona material y acabado, 4) agrega comentarios y 5) deja tus datos. Al final se abre WhatsApp con todo armado.',
      link: orderLink
    };
  }
  if (/correo|email/.test(text)) {
    return s.email
      ? { text: 'Puedes escribirnos a ' + s.email }
      : { text: 'Todavía no tenemos un correo registrado. Escríbenos por WhatsApp y te atendemos.', link: wa };
  }
  if (/whatsapp|celular|telefono|contacto/.test(text)) {
    return { text: 'Nuestro WhatsApp es ' + (number || 'el que aparece en la web') + '.', link: wa };
  }
  if (/gracias|genial|perfecto/.test(text)) {
    return { text: '¡Con gusto! Si tienes otra duda, aquí estoy. 😊' };
  }
  return {
    text: 'No estoy seguro de cómo responder eso. Te invito a escribirnos directamente por WhatsApp y te atenderemos personalmente.',
    link: wa
  };
}

/* --------------------------- Animaciones de entrada ---------------------- */

let revealObserver = null;

function initReveal() {
  $$('[data-reveal]').forEach(element => {
    if (element.dataset.delay) element.style.transitionDelay = element.dataset.delay + 'ms';
  });
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    $$('[data-reveal]').forEach(element => revealObserver.observe(element));
  } else {
    $$('[data-reveal]').forEach(element => element.classList.add('is-visible'));
  }
}

function observeReveals(root) {
  if (!revealObserver) return;
  $$('[data-reveal]', root).forEach(element => revealObserver.observe(element));
}

function initNav() {
  const toggle = $('#navToggle');
  const nav = $('#mainNav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  $$('#mainNav a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
  window.addEventListener('scroll', () => {
    $('#siteHeader').classList.toggle('is-scrolled', window.scrollY > 12);
  }, { passive: true });
}
