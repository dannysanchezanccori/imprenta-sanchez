'use strict';
/**
 * Imprenta Sanchez — backend simple sin dependencias (Node.js nativo).
 * ------------------------------------------------------------------
 * - Guarda toda la información en backend/data.json.
 * - Genera js/data.js (instantánea pública) para que la web funcione
 *   aunque se abra index.html directamente desde el disco (file://).
 * - Expone una API pequeña: /api/site, /api/login, /api/admin,
 *   /api/save, /api/reviews, /api/password, /api/upload.
 * - El panel se sirve en http://localhost:3000/admin
 *
 * Contraseña inicial: admin / Imprenta2026!  (cámbiala desde el panel).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(__dirname, 'data.json');
const SNAPSHOT_FILE = path.join(ROOT, 'js', 'data.js');
const UPLOAD_DIR = path.join(ROOT, 'img', 'uploads');
const PORT = Number(process.env.PORT) || 3000;
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 horas
const MAX_BODY = 8 * 1024 * 1024;      // 8 MB

// Credencial semilla. La contraseña NUNCA se guarda en texto plano.
const SEED_ADMIN = {
  username: 'admin',
  salt: 'a2e4f6cb9bce1d110629a70656d4cded',
  hash: 'f84c918096afde96c41adcdfd69c197628519b5b0d4dfaa0648a050b31e8e91a',
  iterations: 120000
};

const sessions = new Map();      // token -> { expires }
const loginAttempts = new Map(); // ip -> { count, until } (anti fuerza bruta básica)

/* ------------------------------ Utilidades ------------------------------ */

function defaultData() {
  return {
    settings: {
      brand: 'Imprenta Sanchez',
      slogan: 'Tu idea, impresa con excelencia.',
      whatsapp: '984508211',
      email: '',
      address: 'Tres Cruces de Oro 486 – Centro Comercial La Frontera, Int. 104',
      hours: 'Lunes a viernes, 9:00 – 19:00 · Sábados, 9:00 – 13:00',
      facebook: '', instagram: '', tiktok: ''
    },
    services: [], products: [], reviews: [],
    admin: { ...SEED_ADMIN }
  };
}

function publicData(data) {
  // Nunca exponemos hash, salt ni credenciales al sitio público.
  return {
    settings: { ...data.settings },
    services: data.services.map(s => ({ ...s })),
    products: data.products.map(p => ({ ...p })),
    reviews: data.reviews.filter(r => r.status === 'approved').map(r => ({ ...r }))
  };
}

function writeSnapshot(data) {
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  const header = '/* Archivo generado automáticamente por el backend. No editar a mano. */\n' +
                 '/* Se actualiza cada vez que guardas cambios en el panel de administración. */\n';
  fs.writeFileSync(SNAPSHOT_FILE, header + 'window.SITE_DATA_DEFAULT = ' +
    JSON.stringify(publicData(data), null, 2) + ';\n', 'utf8');
}

function saveData(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
  writeSnapshot(data);
}

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data.settings || !Array.isArray(data.services) || !Array.isArray(data.products) ||
        !Array.isArray(data.reviews) || !data.admin) throw new Error('estructura inválida');
    return data;
  } catch (err) {
    console.error('[AVISO] data.json no válido; se crean datos iniciales:', err.message);
    const data = defaultData();
    saveData(data);
    return data;
  }
}

let DATA = loadData();
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
writeSnapshot(DATA);

function hashPassword(password, saltHex, iterations) {
  return crypto.pbkdf2Sync(String(password), Buffer.from(saltHex, 'hex'), iterations, 32, 'sha256').toString('hex');
}

function equal(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function authToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return token;
}

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function send(res, status, payload, contentType, cors = false) {
  const type = contentType || 'application/json; charset=utf-8';
  const body = type.startsWith('application/json') ? JSON.stringify(payload) : payload;
  const headers = {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  // Solo las rutas públicas permiten el origen del index.html abierto desde disco.
  if (cors) headers['Access-Control-Allow-Origin'] = 'null';
  res.writeHead(status, headers);
  res.end(body);
}

function preflight(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': '0'
  });
  res.end();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('El contenido enviado es demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (_) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

const str = (value, max) => String(value == null ? '' : value).trim().slice(0, max);

function normalizeState(body, previous) {
  if (!body || typeof body !== 'object') throw new Error('Datos inválidos');
  const settings = { ...previous.settings };
  for (const key of ['brand', 'slogan', 'whatsapp', 'email', 'address', 'hours', 'facebook', 'instagram', 'tiktok']) {
    if (Object.prototype.hasOwnProperty.call(body.settings || {}, key)) {
      settings[key] = str(body.settings[key], key === 'address' ? 300 : 160);
    }
  }

  const services = Array.isArray(body.services) ? body.services.slice(0, 100).map(s => ({
    id: str(s.id || crypto.randomUUID(), 80),
    title: str(s.title, 100),
    description: str(s.description, 400),
    icon: str(s.icon || 'digital', 40),
    image: str(s.image, 600)
  })).filter(s => s.title) : previous.services;

  const products = Array.isArray(body.products) ? body.products.slice(0, 200).map(p => ({
    id: str(p.id || crypto.randomUUID(), 80),
    name: str(p.name, 120),
    description: str(p.description, 500),
    image: str(p.image, 600) || 'img/producto-tarjetas.svg',
    badge: str(p.badge, 60)
  })).filter(p => p.name) : previous.products;

  const reviews = Array.isArray(body.reviews) ? body.reviews.slice(0, 500).map(r => ({
    id: str(r.id || crypto.randomUUID(), 80),
    name: str(r.name, 80) || 'Cliente',
    rating: Math.min(5, Math.max(1, Number(r.rating) || 5)),
    text: str(r.text, 1200),
    status: ['approved', 'pending', 'rejected'].includes(r.status) ? r.status : 'pending',
    date: str(r.date || new Date().toISOString(), 40)
  })).filter(r => r.text) : previous.reviews;

  return { settings, services, products, reviews, admin: previous.admin };
}

/* --------------------------------- API --------------------------------- */

async function handleApi(req, res, pathname) {
  const method = req.method;

  if (pathname === '/api/ping' && method === 'GET') {
    return send(res, 200, { ok: true, service: 'imprenta-sanchez' }, null, true);
  }

  if (pathname === '/api/ping' && method === 'OPTIONS') {
    return preflight(res);
  }

  if (pathname === '/api/reviews' && method === 'OPTIONS') {
    return preflight(res);
  }

  if (pathname === '/api/site' && method === 'GET') {
    return send(res, 200, publicData(DATA));
  }

  if (pathname === '/api/login' && method === 'POST') {
    const ip = clientIp(req);
    const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
    if (attempt.until > Date.now()) {
      return send(res, 429, { ok: false, error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' });
    }
    const body = await readJson(req);
    const admin = DATA.admin;
    const userOk = equal(str(body.username, 120), admin.username);
    const passOk = equal(admin.hash, hashPassword(
      String(body.password || ''), admin.salt, admin.iterations));
    // Se calcula el hash incluso si el usuario es incorrecto (evita filtrar por tiempo).
    const ok = userOk && passOk;
    if (!ok) {
      attempt.count += 1;
      if (attempt.count >= 6) {
        attempt.until = Date.now() + 60000;
        attempt.count = 0;
      }
      loginAttempts.set(ip, attempt);
      return send(res, 401, { ok: false, error: 'Usuario o contraseña incorrectos.' });
    }
    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { expires: Date.now() + SESSION_MS });
    return send(res, 200, { ok: true, token, expiresIn: SESSION_MS });
  }

  if (pathname === '/api/admin' && method === 'GET') {
    if (!authToken(req)) return send(res, 401, { error: 'Sesión expirada. Inicia sesión nuevamente.' });
    return send(res, 200, { ...DATA, admin: { username: DATA.admin.username } });
  }

  if (pathname === '/api/save' && method === 'POST') {
    if (!authToken(req)) return send(res, 401, { error: 'Sesión expirada.' });
    const body = await readJson(req);
    DATA = normalizeState(body, DATA);
    saveData(DATA);
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/reviews' && method === 'POST') {
    const body = await readJson(req);
    const text = str(body.text, 1200);
    const name = str(body.name, 80);
    if (text.length < 8 || !name) throw new Error('Completa tu nombre y un comentario de al menos 8 caracteres.');
    DATA.reviews.unshift({
      id: 'rev_' + crypto.randomUUID(),
      name,
      rating: Math.min(5, Math.max(1, Number(body.rating) || 5)),
      text,
      status: 'pending', // Nunca se publica automáticamente.
      date: new Date().toISOString()
    });
    saveData(DATA);
    return send(res, 200, { ok: true, status: 'pending' }, null, true);
  }

  if (pathname === '/api/password' && method === 'POST') {
    if (!authToken(req)) return send(res, 401, { error: 'Sesión expirada.' });
    const body = await readJson(req);
    const current = String(body.current || '');
    const next = String(body.next || '');
    if (!equal(DATA.admin.hash, hashPassword(current, DATA.admin.salt, DATA.admin.iterations))) {
      throw new Error('La contraseña actual no es correcta.');
    }
    if (next.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
    const salt = crypto.randomBytes(16).toString('hex');
    DATA.admin = { ...DATA.admin, salt, hash: hashPassword(next, salt, DATA.admin.iterations) };
    saveData(DATA);
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/upload' && method === 'POST') {
    if (!authToken(req)) return send(res, 401, { error: 'Sesión expirada.' });
    const body = await readJson(req);
    const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(body.dataUrl || ''));
    if (!match) throw new Error('Formato de imagen no válido. Usa PNG, JPG, WebP o GIF.');
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (buffer.length > 4 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 4 MB.');
    const filename = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    return send(res, 200, { ok: true, path: 'img/uploads/' + filename });
  }

  return send(res, 404, { error: 'Ruta no encontrada.' });
}

/* ---------------------------- Archivos estáticos ---------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(res, pathname) {
  let rel = pathname;
  if (rel === '/' || rel === '') rel = '/index.html';
  else if (rel === '/admin' || rel === '/admin/') rel = '/admin/index.html';

  let filePath;
  try {
    filePath = path.resolve(ROOT, '.' + decodeURIComponent(rel));
  } catch (_) {
    return send(res, 400, { error: 'Ruta inválida.' });
  }
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return send(res, 403, { error: 'Acceso denegado.' });
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — No encontrado');
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const cache = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(ext)
      ? 'public, max-age=86400' : 'no-cache';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => { if (!res.headersSent) res.end(); });
    res.on('error', () => stream.destroy());
    stream.pipe(res);
  });
}

/* --------------------------------- Servidor -------------------------------- */

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = url.pathname;
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(res, pathname);
    return send(res, 405, { error: 'Método no permitido.' });
  } catch (err) {
    console.error('[ERROR]', err);
    if (!res.headersSent) send(res, 400, { error: err.message || 'Error inesperado.' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log('==================================================');
  console.log(' Imprenta Sanchez — servidor listo');
  console.log(' Web publica : http://localhost:' + PORT + '/');
  console.log(' Panel admin : http://localhost:' + PORT + '/admin');
  console.log(' Usuario     : admin / Imprenta2026!');
  console.log(' Datos       : backend/data.json');
  console.log('==================================================');
});
