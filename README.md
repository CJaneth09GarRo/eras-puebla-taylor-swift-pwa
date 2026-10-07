# Eras Puebla · Taylor Swift

Aplicación web progresiva (PWA) en español para explorar las eras de Taylor Swift, compartir publicaciones, reseñar discos y subir Fan Art. Proyecto escolar de Aplicaciones Web Progresivas, Grupo 10 B – 2026.

## Estructura del proyecto

```text
.
|-- index.html                  # Secciones y estructura accesible de la página
|-- manifest.json               # Nombre, iconos, colores y modo de instalación PWA
|-- ServiceWorker.js             # Caché offline, activación y estrategia de red
|-- css/
|   `-- styles.css              # Diseño, tarjetas, formularios y adaptación móvil
|-- js/
|   |-- app.js                  # Eras, selección, navegación e instalación PWA
|   |-- community.js            # Supabase Auth, feed, reseñas, likes y Fan Art
|   `-- supabase-config.js      # URL y clave pública (anon/publishable) de Supabase
|-- assets/
|   |-- icons/                  # Iconos del sitio y de la PWA
|   `-- img/eras/               # Ilustraciones originales de las doce eras
`-- supabase/
    `-- schema.sql              # Tablas, restricciones, políticas RLS y bucket Fan Art
```

## Ejecutar localmente

Abre la carpeta en VS Code y utiliza Live Server sobre `index.html`, o ejecuta desde PowerShell en la raíz:

```powershell
npx serve .
```

Abre la URL local que muestre el servidor. Los service workers funcionan en `localhost` y en sitios HTTPS; abrir el HTML como archivo (`file://`) no es suficiente.

## Configurar backend con Supabase

Sin Supabase, el sitio y las eras siguen funcionando, pero el feed, las reseñas, los likes y las subidas quedan desactivados.

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En **SQL Editor**, ejecuta el contenido completo de [`supabase/schema.sql`](./supabase/schema.sql). Este crea perfiles, publicaciones, reseñas, likes, el bucket público de imágenes/videos y las políticas de seguridad RLS. El script es re-ejecutable.
3. En **Authentication → URL Configuration**, añade la URL local y la URL de GitHub Pages a las direcciones permitidas para redirección.
4. Copia la URL del proyecto y la clave pública **anon/publishable** desde **Project Settings → API** a `js/supabase-config.js`.
5. Nunca copies la clave `service_role` al frontend ni al repositorio. La clave pública solo debe usarse con las políticas RLS incluidas.
6. En **Authentication → Providers → Email**, deja habilitado Email. Si la confirmación de correo está activada, cada persona debe confirmar su dirección antes de iniciar sesión.
7. Prueba con dos cuentas distintas: publicaciones y reseñas deben ser públicas; cada usuario solo puede eliminar sus propias entradas y administrar sus propios archivos.

Los archivos de Fan Art se almacenan en un bucket público para que la galería se pueda ver sin iniciar sesión. Se permiten JPG, PNG, WEBP, GIF, MP4 y WEBM hasta 25 MB. No subas archivos sin permiso; habilita moderación antes de abrir la aplicación al público.

## Publicar en GitHub Pages

1. Crea un repositorio, por ejemplo `eras-puebla-taylor-swift-pwa`.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio. Incluye `ServiceWorker.js`, `manifest.json`, `assets/` y `supabase/`.
3. En GitHub abre **Settings → Pages**. En **Build and deployment**, selecciona **Deploy from a branch**, elige `main` y la carpeta `/(root)`, y pulsa **Save**.
4. Espera a que GitHub Pages publique el sitio y abre la URL HTTPS que aparece en **Settings → Pages**.
5. En Supabase, añade esa URL en las URL permitidas de autenticación y usa las mismas credenciales públicas configuradas en `js/supabase-config.js`.
6. Abre la URL publicada en un navegador compatible y selecciona **Instalar app** o **Instalar aplicación** en el menú. En iPhone/iPad: **Compartir → Agregar a pantalla de inicio**.

Para subir cambios posteriormente: usa **Add file → Upload files** en GitHub, o haz `git add .`, `git commit -m "Describe los cambios"` y `git push`.

## Cómo está documentado el manifest

`manifest.json` es JSON estricto: JSON no admite comentarios `//` o `/* */`. Por eso sus propiedades se explican aquí:

- `name`, `short_name`, `description`: nombres y descripción que muestra el sistema al instalar.
- `id`, `start_url`, `scope`: identidad, página inicial y ruta controlada por la PWA.
- `display`: abre en ventana independiente (`standalone`).
- `background_color`, `theme_color`: colores de carga y de la interfaz del sistema.
- `lang`, `dir`, `categories`: idioma, dirección del texto y categorías.
- `icons`: rutas, tamaños, MIME y propósito (`any` o `maskable`) de los iconos instalables.

Al cambiar el nombre del sitio o un icono, actualiza el manifiesto y conserva archivos PNG en los tamaños recomendados de 192×192 y 512×512.

## Cómo está documentado `ServiceWorker.js`

El propio archivo está dividido en comentarios numerados por responsabilidad:

1. `CACHE` y `FILES`: versión del caché y lista de recursos locales precargados.
2. Evento `install`: descarga los archivos críticos y solo activa la versión si todos se guardaron.
3. Evento `activate`: elimina cachés antiguos y toma control de la página.
4. Evento `fetch`: usa caché para archivos locales y devuelve `index.html` si una navegación falla sin conexión.

Al añadir o renombrar un archivo esencial, actualiza `FILES` y aumenta el identificador `CACHE` para que los navegadores instalen la nueva versión. YouTube y las funciones de Supabase necesitan conexión; el sitio base y sus imágenes locales se guardan para uso sin conexión.
