# Imprenta Sanchez — sitio web + panel de administración

Sitio web profesional para una imprenta, hecho con **HTML, CSS y JavaScript puro**, sin frameworks. Incluye catálogo dinámico, configurador de pedidos que envía el mensaje por WhatsApp, chatbot, reseñas con aprobación y panel de administración con acceso protegido. Puede funcionar en local con `INICIAR.bat` o publicarse en **GitHub Pages + Supabase**.

---

## 1. Cómo ejecutarlo

### Opción A — Ver la web pública (sin servidor)

Haz doble clic en **`index.html`**.

La web se muestra completa usando el archivo `js/data.js` (una instantánea de los datos). Esto funciona incluso sin internet para la estructura, aunque las fuentes de Google y el mapa sí lo requieren. El video del hero es local (`video/video_pagina_web.mp4`); si el navegador bloquea la reproducción automática, se muestra su póster (`img/formato_web.png`).

> Al abrir así, las reseñas nuevas se guardan en el navegador y se envían automáticamente la siguiente vez que abras la web con el servidor activo. Si configuras Supabase, se envían a la nube sin depender de `INICIAR.bat`.

### Opción B — Web + panel de administración (recomendado en local)

1. Haz doble clic en **`INICIAR.bat`**.
2. El iniciador detecta si tienes **Node.js** o **Python 3** y arranca el servidor correspondiente (no necesitas instalar nada: en tu equipo está Python 3.11).
3. Se abre automáticamente `http://localhost:3000/admin`.

**Acceso inicial del panel**

| Usuario | Contraseña |
|---|---|
| `admin` | `Imprenta2026!` |

Cámbiala en **Seguridad** dentro del panel.

Para abrir solo la web pública: `http://localhost:3000/`

### Opción C — Publicar en GitHub Pages

Con Supabase los visitantes pueden enviar reseñas **sin que tu PC esté encendido**, y el panel mantiene el login y la aprobación. La guía completa está en la **sección 6** y en `supabase/GUIA.md`.

### Cambiar el puerto

Edita `set PORT=3000` en `INICIAR.bat` y usa el mismo número en `backend/server.js` o `backend/server.py` (o define la variable de entorno `PORT`).

---

## 2. Estructura del proyecto

```
IMPRENTA WEB/
├─ index.html              Web pública
├─ INICIAR.bat             Iniciador automático del servidor local
├─ README.md               Esta guía
├─ .nojekyll               Evita que GitHub Pages ignore archivos/carpetas
├─ css/
│  ├─ styles.css           Diseño de la web pública
│  └─ admin.css            Diseño del panel
├─ js/
│  ├─ data.js              Instantánea pública (GENERADA por el backend, no editar)
│  ├─ cloud-config.js      URL, clave pública y activación de Supabase
│  ├─ cloud.js             Adaptador REST de Supabase (sin librerías)
│  ├─ site.js              Carruseles, configurador, reseñas, chatbot y animaciones
│  └─ admin.js             Lógica del panel de administración
├─ img/
│  ├─ logo.svg             Icono vectorial
│  ├─ logo_paraclaro.png   Logo azul/dorado (modo claro)
│  ├─ logo_paraoscuro.png  Logo blanco/dorado (modo oscuro y fondos oscuros)
│  ├─ producto-*.svg       Ilustraciones locales del catálogo
│  ├─ tajetas_servicios.png, volante_servicios.png, volante_2.jpeg  Fotos reales de servicios
│  └─ uploads/             Imágenes subidas desde el panel (modo local)
├─ video/
│  └─ video_pagina_web.mp4 Video de fondo del hero (31 MB)
├─ backend/
│  ├─ server.js            Servidor Node.js local (sin dependencias)
│  ├─ server.py            Servidor Python 3 local (sin frameworks)
│  └─ data.json            Datos y credencial del modo local
├─ supabase/
│  ├─ setup.sql            Tablas, políticas RLS y bucket de imágenes
│  ├─ seed.sql             Datos iniciales para Supabase
│  └─ GUIA.md              Paso a paso de GitHub + Supabase
└─ admin/index.html        Panel de administración
```

---

## 3. Qué se gestiona desde el panel

| Sección | Qué hace |
|---|---|
| **Resumen** | Contadores de servicios, productos y reseñas pendientes/publicadas. |
| **Datos del negocio** | Nombre, slogan, WhatsApp, correo, dirección, horarios y redes sociales. Se refleja en el hero, botón flotante, chatbot, configurador, mapa, contacto y footer. |
| **Servicios** | Crear, editar y eliminar tarjetas de servicios, con icono, descripción y foto (URL o subida desde el PC). |
| **Productos** | Crear, editar y eliminar productos con nombre, descripción, etiqueta e imagen (subida desde el PC o URL). |
| **Reseñas** | Las nuevas llegan como **pendientes**. Puedes aprobarlas (se publican), rechazarlas o eliminarlas. |
| **Seguridad** | Cambio de contraseña con verificación de la actual. |

Cada guardado en local actualiza `backend/data.json` y regenera `js/data.js`. Con `js/cloud-config.js` en modo nube, los mismos cambios se guardan en Supabase y aparecen en GitHub Pages; las imágenes subidas van al bucket `imagenes` de Supabase Storage.

---

## 4. Detalles de funcionamiento

- **WhatsApp:** todos los enlaces usan `https://wa.me/` con el número configurado. El configurador tiene 4 pasos —producto, cantidad, comentarios y datos del cliente— y arma el mensaje con esa información. En **Visítanos o escríbenos** ya no aparece el botón grande de WhatsApp; el número sigue como enlace en Datos de contacto, footer y botón flotante.
- **Producto:** la lista del configurador se llena solo con los productos dados de alta en **Productos** del panel; al guardar un cambio ahí, la lista se actualiza. Medidas, material y acabado se pueden indicar en los comentarios.
- **Nuevo pedido:** después de enviar por WhatsApp aparece el botón **Hacer otro pedido**, que limpia el formulario y vuelve al paso 1. El celular es opcional y los campos siguen siendo legibles en modo oscuro.
- **Carruseles:** en Productos destacados y Reseñas, las flechas son redondas, flotan a mitad de altura en ambos extremos y avanzan **una tarjeta por pulsación**, de izquierda a derecha (o al revés), con una animación lenta y continua; al terminar el recorrido vuelven al inicio. También responden a las flechas del teclado cuando el carrusel tiene el foco.
- **Panel:** junto a **Reseñas** aparece siempre un contador: en gris cuando no hay pendientes y en dorado con el número cuando hay reseñas por aprobar. Se actualiza automáticamente con el panel abierto. El aviso de desconexión solo se muestra si el servidor realmente no responde. En ventanas estrechas, el menú lateral se abre con ☰ y se cierra con la **X**, tocando fuera o con `Esc`.
- **Reseñas desde `index.html`:** si la web se abre con doble clic, la reseña se envía directamente al servidor local en cuanto `INICIAR.bat` está activo; si no lo está, queda guardada y se envía sola al volver a la pestaña con el servidor encendido. Siempre llega como **pendiente**.
- **Mapa:** se construye con `https://www.google.com/maps?q=<dirección>&output=embed`, por lo que no necesita clave de API. Cambiar la dirección en el panel cambia el mapa.
- **Asistente Printy:** chatbot con nombre propio y dibujo de robot (también en la cabecera del chat). Responde sobre servicios, horarios, ubicación, cotizaciones, pedidos, correo y contacto con los datos vigentes del panel. Los accesos rápidos se pueden arrastrar con el mouse o el dedo y, cuando no caben todos, también se deslizan con una pequeña flecha. Si no sabe, ofrece pasar a WhatsApp. Se cierra con el botón “X”, con `Esc` o desde el mismo botón flotante.
- **Modo claro/oscuro:** el botón de la cabecera de la web y el del panel cambian el tema y recuerdan la elección en el navegador. El logo y el favicon cambian automáticamente (`logo_paraclaro.png` en claro, `logo_paraoscuro.png` en oscuro). El panel muestra además un mensaje de bienvenida con el usuario y la fecha al entrar.
- **Colores e iconos:** paleta dorada `#F7BB01` y azul `#003D8E`, tomada del logo. Iconos SVG propios para WhatsApp, Printy, ubicación, correo, horarios y redes sociales.
- **Horarios:** se muestran en formato de 12 horas (a.m. / p.m.), editables desde **Datos del negocio**.
- **Seguridad:** en local, contraseña cifrada con PBKDF2-HMAC-SHA256 (120.000 iteraciones), sesiones con token aleatorio de 8 horas y límite de intentos. En la nube, el login lo gestiona **Supabase Auth** y el acceso a datos se controla con **RLS**; la clave `service_role` nunca se usa en el navegador.
- **Imágenes subidas:** en local se guardan en `img/uploads/`; en GitHub Pages se suben al bucket público `imagenes` de Supabase Storage. Se aceptan PNG, JPG, WebP y GIF de hasta 4 MB.
- **Reseñas en la nube:** cualquier visitante puede enviar una reseña con el servidor local apagado; llega como **pendiente** y solo se publica cuando la apruebas en el panel.
- **Movimiento:** animaciones suaves con `IntersectionObserver`, degradados lentos y autoayuda de `prefers-reduced-motion`.

---

## 5. Solución de problemas

| Situación | Solución |
|---|---|
| El panel muestra el aviso "No se pudo conectar" | En local solo aparece si `/api/ping` falla: comprueba que `INICIAR.bat` siga abierto y entra por `http://localhost:3000/admin`. En GitHub Pages, revisa la URL y la anon key de Supabase. |
| En GitHub Pages no se ven los datos | Verifica `enabled: true`, URL y clave pública en `js/cloud-config.js`, y que hayas ejecutado `setup.sql` y `seed.sql`. Si en consola dice “Could not find the table”, faltan esos SQL. Recarga con `Ctrl+F5`. |
| El login de la nube rechaza el usuario | Usa el correo creado en **Supabase Auth**. Si dice “Email not confirmed”, confirma al usuario o desactiva *Confirm email*. |
| El puerto 3000 está ocupado | Cambia `PORT` en `INICIAR.bat` y en el archivo del servidor que se use. |
| No se ven los cambios en `index.html` | Recarga con `Ctrl+F5`. Si abriste el archivo directamente, comprueba que `js/data.js` se haya regenerado tras guardar en el panel. |
| Olvidé la contraseña | Se puede regenerar el hash con Python y actualizar `admin.hash` y `admin.salt` en `backend/data.json`. |
| Faltan fuentes o el mapa | Requieren conexión a internet; el resto del sitio funciona sin ella. |
| El video del hero no se reproduce | Algunos navegadores bloquean el autoplay; se muestra el póster. Puedes reproducirlo desde el archivo local o ajustar `preload`. |

---

## 6. Publicar en GitHub Pages con Supabase

La guía detallada está en **`supabase/GUIA.md`**. Resumen:

1. Crea un repositorio público en GitHub, por ejemplo `imprenta-sanchez`.
2. Crea un proyecto en <https://supabase.com>. Si solo sale **New organization**, crea primero la organización. La clave pública está en **Connect** o en **Settings → API Keys**: copia **Publishable key** (`sb_publishable_...`) o **anon public** (*nunca* `sb_secret_...` ni `service_role`).
3. Pega esos valores en `js/cloud-config.js` y cambia `enabled` a `true`.
4. En Supabase → **SQL Editor**, ejecuta `supabase/setup.sql` y después `supabase/seed.sql`.
5. En Supabase → **Authentication → Users**, crea el correo y la contraseña del panel.
6. Sube **todo el contenido** de esta carpeta al repositorio (o usa `git init`, `git add .`, `git commit` y `git push`). `index.html` debe quedar en la raíz.
7. En GitHub → **Settings → Pages**, elige `main` y `/ (root)`, y guarda.
8. Abre `https://TU_USUARIO.github.io/TU_REPO/` y el panel en `/admin/`.

Con esto, las reseñas llegan aunque `INICIAR.bat` esté cerrado, y el panel sigue protegido con login y aprobación. Para volver al modo local, pon `enabled: false`.

---

## 7. Créditos y mantenimiento

Código comentado y organizado para facilitar cambios. No hay dependencias externas ni pasos de compilación.
