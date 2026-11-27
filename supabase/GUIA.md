# Guía: GitHub Pages + Supabase

Esta guía deja la web pública en GitHub Pages y el panel administrativo funcionando con login y aprobación de reseñas en Supabase. **El modo local con `INICIAR.bat` se conserva**: solo se usa Supabase cuando `js/cloud-config.js` tiene `enabled: true`.

Resumen de lo que se usa:

| Parte | Dónde vive | Para qué |
|---|---|---|
| Web y panel | GitHub Pages | Archivos HTML, CSS, JS, imágenes y video |
| Datos del negocio, servicios, productos y reseñas | Supabase PostgreSQL | Catálogo y reseñas pendientes/aprobadas |
| Usuario y contraseña del panel | Supabase Auth | Login del panel |
| Imágenes que subes desde el panel | Supabase Storage (`imagenes`) | Fotos de servicios y productos |
| WhatsApp | Sin cambios | Los pedidos siguen abriendo `wa.me` |

---

## Paso 1 — Crear el repositorio en GitHub

1. Entra a <https://github.com> e inicia sesión.
2. Clic en **New repository**.
3. Nombre sugerido: `imprenta-sanchez`.
4. Elige **Public** y marca **Add a README file** si quieres tener un README inicial.
5. Clic en **Create repository**.

El nombre del repositorio aparecerá en la dirección final. Por ejemplo, si tu usuario es `juan` y el repo `imprenta-sanchez`, la web será:

```
https://juan.github.io/imprenta-sanchez/
```

---

## Paso 2 — Crear el proyecto en Supabase

1. Entra a <https://supabase.com> e inicia sesión (puedes usar GitHub).
2. Si solo ves **New organization**, créala primero: haz clic ahí, pon un nombre como `Imprenta Sanchez` y confirma. Es el paso inicial de las cuentas nuevas.
3. Después de crearla, entra a esa organización (arriba a la izquierda puede haber un selector con el nombre de la organización).
4. Dentro de la organización abre **Projects** y haz clic en **New project**. Si no aparece, actualiza la página o vuelve a entrar a <https://supabase.com/dashboard>.
5. Elige un nombre, una contraseña para la base de datos y una región cercana.
6. Espera 1–2 minutos a que el proyecto quede listo.

### Copiar la URL y la clave pública

En la interfaz actual de Supabase ya no existe **Project Settings → API**. Usa una de estas dos formas:

1. **Forma fácil:** dentro de tu proyecto haz clic en **Connect**. Ahí aparecen la URL y la clave pública lista para copiar.
2. **Forma alternativa:** en el menú lateral entra a **Settings → API Keys** (el engranaje). Busca la clave **Publishable key** (`sb_publishable_...`) o, si tu proyecto todavía usa las anteriores, **anon public** (`eyJ...`).

- La URL también se forma con el **Project Ref**: `https://TU_PROJECT_REF.supabase.co`.
- **Nunca copies** `sb_secret_...` ni `service_role`.

---

## Paso 3 — Configurar el proyecto

Abre `js/cloud-config.js`. La URL ya quedó puesta con tu Project Ref; solo falta la clave:

```js
window.CLOUD_CONFIG = {
  enabled: true,
  url: 'https://pvrcmdhruhykyrsbqotj.supabase.co',
  anonKey: 'TU_PUBLISHABLE_KEY',
  storageBucket: 'imagenes'
};
```

- `enabled: true` activa el modo nube.
- Pega tu clave **Publishable** o **anon public** donde dice `TU_PUBLISHABLE_KEY`.
- Mientras siga diciendo `TU_PUBLISHABLE_KEY`, el sitio sigue en modo local automáticamente.
- **Nunca pongas una clave secreta**: no hace falta y sería peligroso.

Para volver al modo local, cambia `enabled` a `false`.

---

## Paso 4 — Crear tablas, permisos y almacenamiento

1. En Supabase entra a **SQL Editor**.
2. Clic en **New query**.
3. Abre `supabase/setup.sql` con un bloc de notas, copia todo su contenido y pégalo.
4. Clic en **Run**. Debe terminar sin errores.
5. Crea otra **New query**.
6. Abre `supabase/seed.sql`, pégalo y haz clic en **Run**.

`setup.sql` crea:

- `site_settings`: datos del negocio.
- `services` y `products`: catálogo.
- `reviews`: reseñas con estado `pending`, `approved` o `rejected`.
- Políticas RLS: el público solo lee reseñas aprobadas y solo puede enviar pendientes; el panel autenticado puede editar todo.
- El bucket público `imagenes` para las fotos que subas desde el panel.

`seed.sql` carga los 6 servicios, 6 productos y 2 reseñas aprobados que ya tiene tu sitio. No sobrescribe datos si ya existen.

---

## Paso 5 — Crear el usuario del panel

1. En Supabase entra a **Authentication** → **Users**.
2. Clic en **Add user** → **Create user**.
3. Escribe un correo, por ejemplo `admin@imprentasanchez.com`.
4. Escribe una contraseña de al menos 8 caracteres y guárdala.
5. Marca el usuario como confirmado si el sistema te lo pide.

Ese correo y esa contraseña son los que usarás en `https://TU_USUARIO.github.io/TU_REPO/admin/`.

> Si al entrar aparece **“Email not confirmed”**, abre **Authentication → Providers → Email**, desmarca **Confirm email** y guarda, o confirma al usuario desde la lista de usuarios.

La contraseña se puede cambiar después dentro de **Seguridad** en el panel.

---

## Paso 6 — Subir los archivos a GitHub

### Opción A — Desde el navegador (sin instalar Git)

1. Entra a tu repositorio en GitHub.
2. Clic en **Add file** → **Upload files**.
3. Arrastra **todo el contenido** de la carpeta `IMPRENTA WEB`:
   - `index.html`
   - `INICIAR.bat`
   - `README.md`
   - las carpetas `css`, `js`, `img`, `video`, `backend` y `supabase`
   - el archivo `.nojekyll`
4. **Importante:** arrastra el contenido de la carpeta, no la carpeta entera. GitHub Pages debe encontrar `index.html` en la raíz.
5. Escribe un mensaje, por ejemplo `Publicar sitio con Supabase`.
6. Clic en **Commit changes**.

### Opción B — Desde tu PC con Git

Abre PowerShell en la carpeta del proyecto:

```powershell
cd "C:\Users\User\Desktop\IMPRENTA WEB"
git init
git add .
git commit -m "Publicar sitio con Supabase"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Si el repositorio ya tenía un README creado por GitHub, ejecuta antes:

```powershell
git pull origin main --allow-unrelated-histories
```

Si Git no está instalado, usa la Opción A.

---

## Paso 7 — Activar GitHub Pages

1. En tu repositorio ve a **Settings** → **Pages**.
2. En **Build and deployment** elige:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main`
   - **Folder:** `/ (root)`
3. Clic en **Save**.
4. Espera 1–2 minutos. Arriba aparecerá la dirección publicada.

Abre:

```
https://TU_USUARIO.github.io/TU_REPO/
```

Panel:

```
https://TU_USUARIO.github.io/TU_REPO/admin/
```

---

## Paso 8 — Probar que todo funciona

1. Abre la web pública y revisa que aparezcan servicios, productos y las 2 reseñas aprobadas.
2. Envía una reseña de prueba desde **Déjanos tu opinión**.
3. Abre el panel con tu correo y contraseña de Supabase.
4. En **Reseñas** debe aparecer como **Pendiente** y el contador debe subir.
5. Aprueba la reseña y recarga la web pública con `Ctrl+F5`: debe aparecer en el carrusel de reseñas.
6. Cambia un dato en **Datos del negocio** y comprueba que se refleje en la web.

Si no ves los cambios de inmediato, espera unos segundos y recarga con `Ctrl+F5`.

---

## Actualizaciones futuras

- Cambia normalmente los datos desde el panel: se guardan en Supabase y se ven en GitHub Pages sin volver a subir archivos.
- Si cambias HTML/CSS/JS, vuelve a hacer **Commit** en GitHub (o `git add .`, `git commit`, `git push`).
- No vuelvas a ejecutar `seed.sql` salvo que quieras restaurar los datos iniciales.
- La web pública se actualiza en cuanto recarga; GitHub Pages puede tardar un par de minutos en publicar cambios de archivos.

---

## Solución de problemas

| Situación | Qué hacer |
|---|---|
| Supabase muestra “Esta consulta incluye operaciones destructivas” | Es normal con `setup.sql`: usa `DROP POLICY IF EXISTS` solo para reemplazar las políticas de este proyecto y `ON CONFLICT DO UPDATE` solo para marcar el bucket `imagenes` como público. En un proyecto recién creado no hay datos que perder. Marca la confirmación y ejecuta. |
| `seed.sql` da error de sintaxis cerca de “on” | Ya corregido: `on conflict (id) do nothing;` debe ir **antes** del punto y coma final. Copia la versión actualizada del archivo. No traduzcas las palabras SQL al español. |
| La web sale con datos de ejemplo y en consola aparecen 404 de `/rest/v1/...` | Es normal antes de crear las tablas: ejecuta `setup.sql` y `seed.sql` en SQL Editor. La clave y la URL ya son correctas si el error dice “Could not find the table”. |
| La web sale sin datos | Revisa que `enabled: true`, URL y clave pública estén bien en `js/cloud-config.js`; recarga con `Ctrl+F5`. |
| El panel dice “No se pudo conectar” | Comprueba que Supabase esté activo y que ejecutaste `setup.sql`. |
| Login dice “Invalid login credentials” | Confirma que usas el correo creado en Supabase Auth y su contraseña. |
| Login dice “Email not confirmed” | Confirma al usuario o desactiva *Confirm email* en Authentication → Providers → Email. |
| Las reseñas nuevas no llegan al panel | Verifica la política `reviews_public_insert` y que `status` sea `pending`. |
| No se ven imágenes subidas | Comprueba que el bucket `imagenes` sea público y que exista la política de inserción de `storage.objects`. |
| Quieres volver a trabajar solo en local | Pon `enabled: false` en `js/cloud-config.js` y usa `INICIAR.bat`. |

---

## Seguridad

- La clave **anon** es pública y está protegida por las políticas RLS de `setup.sql`.
- Las API privadas del servidor local (`/api/admin`, `/api/save`, `/api/password`) **no** se exponen en este modo.
- No subas a GitHub ningún archivo con la clave `service_role` ni contraseñas de Supabase.
