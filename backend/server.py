# -*- coding: utf-8 -*-
"""
Imprenta Sanchez — backend simple sin frameworks (Python 3.11, librería estándar).

Equivalente exacto de server.js. Se usa cuando Node.js no está instalado.
  - Guarda todo en backend/data.json
  - Regenera js/data.js para que la web pública funcione también desde file://
  - API: /api/site, /api/login, /api/admin, /api/save, /api/reviews,
         /api/password, /api/upload, /api/ping
  - Panel: http://localhost:3000/admin

Credencial inicial: admin / Imprenta2026!  (cámbiala desde el panel).
"""

import base64
import functools
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from datetime import datetime, timezone, timedelta
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = Path(__file__).resolve().parent / 'data.json'
SNAPSHOT_FILE = ROOT / 'js' / 'data.js'
UPLOAD_DIR = ROOT / 'img' / 'uploads'
PORT = int(os.environ.get('PORT', '3000'))
SESSION_SECONDS = 8 * 60 * 60
MAX_BODY = 8 * 1024 * 1024

SEED_ADMIN = {
    'username': 'admin',
    'salt': 'a2e4f6cb9bce1d110629a70656d4cded',
    'hash': 'f84c918096afde96c41adcdfd69c197628519b5b0d4dfaa0648a050b31e8e91a',
    'iterations': 120000
}

SESSIONS = {}          # token -> expiration epoch
LOGIN_ATTEMPTS = {}    # ip -> {'count': n, 'until': epoch}
LOCK = threading.Lock()


# -------------------------------- Utilidades --------------------------------

def default_data():
    return {
        'settings': {
            'brand': 'Imprenta Sanchez',
            'slogan': 'Tu idea, impresa con excelencia.',
            'whatsapp': '984508211',
            'email': '',
            'address': 'Tres Cruces de Oro 486 – Centro Comercial La Frontera, Int. 104',
            'hours': 'Lunes a viernes, 9:00 – 19:00 · Sábados, 9:00 – 13:00',
            'facebook': '', 'instagram': '', 'tiktok': ''
        },
        'services': [], 'products': [], 'reviews': [],
        'admin': dict(SEED_ADMIN)
    }


def public_data(data):
    """Nunca expone hash, salt ni credenciales."""
    return {
        'settings': dict(data['settings']),
        'services': [dict(s) for s in data['services']],
        'products': [dict(p) for p in data['products']],
        'reviews': [dict(r) for r in data['reviews'] if r.get('status') == 'approved']
    }


def write_snapshot(data):
    SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
    header = ('/* Archivo generado automáticamente por el backend. No editar a mano. */\n'
              '/* Se actualiza cada vez que guardas cambios en el panel de administración. */\n')
    payload = json.dumps(public_data(data), ensure_ascii=False, indent=2)
    SNAPSHOT_FILE.write_text(header + 'window.SITE_DATA_DEFAULT = ' + payload + ';\n', encoding='utf-8')


def save_data(data):
    tmp = DATA_FILE.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, DATA_FILE)
    write_snapshot(data)


def load_data():
    try:
        data = json.loads(DATA_FILE.read_text(encoding='utf-8'))
        for key in ('settings', 'services', 'products', 'reviews', 'admin'):
            if key not in data:
                raise ValueError('estructura inválida')
        return data
    except Exception as exc:
        print('[AVISO] data.json no válido; se crean datos iniciales:', exc)
        data = default_data()
        save_data(data)
        return data


DATA = load_data()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
write_snapshot(DATA)


def hash_password(password, salt_hex, iterations):
    return hashlib.pbkdf2_hmac('sha256', str(password).encode('utf-8'),
                               bytes.fromhex(salt_hex), iterations).hex()


def equal(a, b):
    return hmac.compare_digest(str(a), str(b))


def text(value, limit):
    return str(value if value is not None else '').strip()[:limit]


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def normalize_state(body, previous):
    if not isinstance(body, dict):
        raise ValueError('Datos inválidos')
    settings = dict(previous['settings'])
    incoming = body.get('settings') or {}
    for key in ('brand', 'slogan', 'whatsapp', 'email', 'address', 'hours',
                'facebook', 'instagram', 'tiktok'):
        if key in incoming:
            settings[key] = text(incoming[key], 300 if key == 'address' else 160)

    if isinstance(body.get('services'), list):
        services = []
        for item in body['services'][:100]:
            if not isinstance(item, dict):
                continue
            title = text(item.get('title'), 100)
            if title:
                services.append({
                    'id': text(item.get('id') or secrets.token_hex(8), 80),
                    'title': title,
                    'description': text(item.get('description'), 400),
                    'icon': text(item.get('icon') or 'digital', 40),
                    'image': text(item.get('image'), 600)
                })
    else:
        services = previous['services']

    if isinstance(body.get('products'), list):
        products = []
        for item in body['products'][:200]:
            if not isinstance(item, dict):
                continue
            name = text(item.get('name'), 120)
            if name:
                products.append({
                    'id': text(item.get('id') or secrets.token_hex(8), 80),
                    'name': name,
                    'description': text(item.get('description'), 500),
                    'image': text(item.get('image'), 600) or 'img/producto-tarjetas.svg',
                    'badge': text(item.get('badge'), 60)
                })
    else:
        products = previous['products']

    if isinstance(body.get('reviews'), list):
        reviews = []
        for item in body['reviews'][:500]:
            if not isinstance(item, dict):
                continue
            comment = text(item.get('text'), 1200)
            if comment:
                status = item.get('status')
                reviews.append({
                    'id': text(item.get('id') or secrets.token_hex(8), 80),
                    'name': text(item.get('name'), 80) or 'Cliente',
                    'rating': max(1, min(5, int(item.get('rating') or 5))),
                    'text': comment,
                    'status': status if status in ('approved', 'pending', 'rejected') else 'pending',
                    'date': text(item.get('date') or now_iso(), 40)
                })
    else:
        reviews = previous['reviews']

    return {'settings': settings, 'services': services, 'products': products,
            'reviews': reviews, 'admin': previous['admin']}


# --------------------------------- Servidor ---------------------------------

class Handler(SimpleHTTPRequestHandler):
    server_version = 'ImprentaSanchez/1.0'

    def log_message(self, fmt, *args):
        print('[%s] %s' % (self.log_date_time_string(), fmt % args))

    def list_directory(self, path):
        # Evita listar carpetas (por ejemplo, img/uploads).
        self.send_error(404, 'No encontrado')
        return None

    def copyfile(self, source, outputfile):
        # El navegador puede cerrar la conexión mientras envía el video.
        # Es normal: se ignora para no llenar la consola de tracebacks.
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def send_json(self, status, payload, cors=False):
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        # Solo las rutas públicas permiten el origen del index.html abierto desde disco.
        if cors:
            self.send_header('Access-Control-Allow-Origin', 'null')
        self.end_headers()
        self.wfile.write(raw)

    def body_json(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            raise ValueError('Content-Length inválido')
        if length > MAX_BODY:
            raise ValueError('El contenido enviado es demasiado grande')
        raw = self.rfile.read(length)
        if not raw:
            return {}
        value = json.loads(raw.decode('utf-8'))
        if not isinstance(value, dict):
            raise ValueError('JSON inválido')
        return value

    def authed(self):
        header = self.headers.get('Authorization', '')
        token = header[7:] if header.startswith('Bearer ') else ''
        expires = SESSIONS.get(token)
        if not expires or expires < time.time():
            SESSIONS.pop(token, None)
            return False
        return True

    def ip(self):
        return self.client_address[0] if self.client_address else 'unknown'

    # ------------------------------ GET ------------------------------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path.startswith('/api/'):
            return self.api_get(path)
        if path in ('/', ''):
            self.path = '/index.html'
        elif path in ('/admin', '/admin/'):
            self.path = '/admin/index.html'
        return super().do_GET()

    def do_OPTIONS(self):
        path = unquote(urlparse(self.path).path)
        if path in ('/api/ping', '/api/reviews'):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', 'null')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        self.send_json(404, {'error': 'Ruta no encontrada.'})

    def do_HEAD(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path.startswith('/api/'):
            return self.send_json(404, {'error': 'Ruta no encontrada.'})
        if path in ('/', ''):
            self.path = '/index.html'
        elif path in ('/admin', '/admin/'):
            self.path = '/admin/index.html'
        return super().do_HEAD()

    def api_get(self, path):
        global DATA
        if path == '/api/ping':
            return self.send_json(200, {'ok': True, 'service': 'imprenta-sanchez'}, cors=True)
        if path == '/api/site':
            return self.send_json(200, public_data(DATA))
        if path == '/api/admin':
            if not self.authed():
                return self.send_json(401, {'error': 'Sesión expirada. Inicia sesión nuevamente.'})
            safe = dict(DATA)
            safe['admin'] = {'username': DATA['admin']['username']}
            return self.send_json(200, safe)
        return self.send_json(404, {'error': 'Ruta no encontrada.'})

    # ------------------------------ POST ------------------------------
    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if not path.startswith('/api/'):
            return self.send_json(404, {'error': 'Ruta no encontrada.'})
        try:
            self.api_post(path)
        except Exception as exc:
            self.send_json(400, {'error': str(exc) or 'Error inesperado.'})

    def api_post(self, path):
        global DATA
        body = self.body_json()

        if path == '/api/login':
            ip = self.ip()
            attempt = LOGIN_ATTEMPTS.get(ip, {'count': 0, 'until': 0})
            if attempt['until'] > time.time():
                return self.send_json(429, {
                    'ok': False, 'error': 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'})
            username = text(body.get('username'), 120)
            password = str(body.get('password') or '')
            admin = DATA['admin']
            # Se calcula el hash siempre para no filtrar si el usuario existe.
            computed = hash_password(password, admin['salt'], admin['iterations'])
            ok = equal(username, admin['username']) and equal(admin['hash'], computed)
            if not ok:
                attempt['count'] += 1
                if attempt['count'] >= 6:
                    attempt['until'] = time.time() + 60
                    attempt['count'] = 0
                LOGIN_ATTEMPTS[ip] = attempt
                return self.send_json(401, {'ok': False, 'error': 'Usuario o contraseña incorrectos.'})
            LOGIN_ATTEMPTS.pop(ip, None)
            token = secrets.token_hex(32)
            with LOCK:
                SESSIONS[token] = time.time() + SESSION_SECONDS
            return self.send_json(200, {'ok': True, 'token': token, 'expiresIn': SESSION_SECONDS})

        if path == '/api/save':
            if not self.authed():
                return self.send_json(401, {'error': 'Sesión expirada.'})
            with LOCK:
                DATA = normalize_state(body, DATA)
                save_data(DATA)
            return self.send_json(200, {'ok': True})

        if path == '/api/reviews':
            name = text(body.get('name'), 80)
            comment = text(body.get('text'), 1200)
            if len(comment) < 8 or not name:
                raise ValueError('Completa tu nombre y un comentario de al menos 8 caracteres.')
            review = {
                'id': 'rev_' + secrets.token_hex(8),
                'name': name,
                'rating': max(1, min(5, int(body.get('rating') or 5))),
                'text': comment,
                'status': 'pending',  # Nunca se publica automáticamente.
                'date': now_iso()
            }
            with LOCK:
                DATA['reviews'].insert(0, review)
                save_data(DATA)
            return self.send_json(200, {'ok': True, 'status': 'pending'}, cors=True)

        if path == '/api/password':
            if not self.authed():
                return self.send_json(401, {'error': 'Sesión expirada.'})
            current = str(body.get('current') or '')
            following = str(body.get('next') or '')
            admin = DATA['admin']
            if not equal(admin['hash'], hash_password(current, admin['salt'], admin['iterations'])):
                raise ValueError('La contraseña actual no es correcta.')
            if len(following) < 8:
                raise ValueError('La nueva contraseña debe tener al menos 8 caracteres.')
            salt = secrets.token_hex(16)
            with LOCK:
                DATA['admin'] = dict(admin, salt=salt,
                                     hash=hash_password(following, salt, admin['iterations']))
                save_data(DATA)
            return self.send_json(200, {'ok': True})

        if path == '/api/upload':
            if not self.authed():
                return self.send_json(401, {'error': 'Sesión expirada.'})
            match = re.match(r'^data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$',
                             str(body.get('dataUrl') or ''))
            if not match:
                raise ValueError('Formato de imagen no válido. Usa PNG, JPG, WebP o GIF.')
            extension = 'jpg' if match.group(1) == 'jpeg' else match.group(1)
            buffer = base64.b64decode(re.sub(r'\s', '', match.group(2)))
            if len(buffer) > 4 * 1024 * 1024:
                raise ValueError('La imagen debe pesar menos de 4 MB.')
            filename = '%d-%s.%s' % (int(time.time() * 1000), secrets.token_hex(4), extension)
            (UPLOAD_DIR / filename).write_bytes(buffer)
            return self.send_json(200, {'ok': True, 'path': 'img/uploads/' + filename})

        return self.send_json(404, {'error': 'Ruta no encontrada.'})


if __name__ == '__main__':
    handler = functools.partial(Handler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(('0.0.0.0', PORT), handler)
    print('=' * 50)
    print(' Imprenta Sanchez — servidor listo')
    print(' Web publica : http://localhost:%d/' % PORT)
    print(' Panel admin : http://localhost:%d/admin' % PORT)
    print(' Usuario     : admin / Imprenta2026!')
    print(' Datos       : backend/data.json')
    print('=' * 50)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor detenido.')
        httpd.server_close()
