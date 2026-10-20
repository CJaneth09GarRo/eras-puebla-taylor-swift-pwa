# Eras Puebla · Taylor Swift

PWA fan en español para explorar las eras de Taylor Swift y guardar herramientas personales sin cuentas ni comunidad: visitas, favoritos, quizzes, tiempo de escucha, playlists y retos.

## Estructura del proyecto

```text
.
|-- index.html                  # Secciones y estructura accesible de la página
|-- manifest.json               # Nombre, iconos, colores y modo de instalación PWA
|-- ServiceWorker.js            # Recursos offline, precarga y caché de la API
|-- sw.js                       # Puente de actualización para instalaciones antiguas
|-- server.js                   # Backend HTTP, migración SQLite y API del catálogo
|-- package.json                # Comandos start y test (Node.js 24+)
|-- css/
|   `-- styles.css              # Diseño responsive y estados de las herramientas
|-- js/
|   |-- app.js                  # Catálogo, detalle de eras, visitas e instalación
|   |-- fan-tools.js            # Favoritos, quizzes, timer, playlists, reto y exportación
|   `-- local-db.js             # Persistencia personal en IndexedDB
|-- data/
|   |-- eras.json               # Datos iniciales del catálogo
|   `-- app.db                  # SQLite local generado al iniciar (ignorado por Git)
|-- assets/
|   |-- icons/                 # Iconos del sitio y de la PWA
|   `-- img/eras/              # Ilustraciones originales de las doce eras
`-- tests/
    `-- server.test.js          # Pruebas de API, recursos y privacidad
```

## Ejecutar localmente

Requiere Node.js 24 o posterior. Desde la carpeta del proyecto ejecuta:

```powershell
npm start
```

Abre `http://localhost:3000`. Este servidor entrega la web y la API juntas; Live Server o `npx serve` no sirven para esta versión porque no implementan el endpoint `/api/eras`. SQLite se crea automáticamente en `data/app.db`. Puedes cambiar su ubicación definiendo `APP_DB_PATH`.

El catálogo se consulta en `GET /api/eras`. `data/eras.json` se sincroniza a SQLite al iniciar. No hay registro, login ni endpoints de escritura públicos.

Ejecuta las pruebas automatizadas del backend con:

```powershell
npm test
```

## Las dos bases de datos

**SQLite del servidor** (`data/app.db`) contiene el catálogo público: resumen, año, estética y canciones con pistas. `data/eras.json` es la fuente de datos del catálogo; editar ese JSON y reiniciar `npm start` actualiza SQLite. La API solo permite leer.

**IndexedDB del navegador** (`eras-puebla-fan`) conserva los datos personales de cada dispositivo y origen: visitas, favoritos, puntajes, sesiones, playlists y canciones adivinadas. No se envían al servidor ni se sincronizan con otros dispositivos.

Para mostrar los registros locales:

1. Abre **Mi espacio → Datos locales** y despliega **Mostrar registros guardados en este navegador**. Ahí aparece el JSON de cada colección.
2. Pulsa **Exportar copia JSON** para descargar un respaldo legible.
3. En Chrome o Edge también puedes abrir DevTools → **Application → Storage → IndexedDB → eras-puebla-fan**. Para SQLite, revisa `data/app.db` con una herramienta compatible con SQLite; no publiques ese archivo.

Si borras los datos del sitio desde DevTools, se eliminan los datos personales de IndexedDB y las cachés de ese origen.

## Probar las funcionalidades

1. **Visitas por era:** abre **Eras**, selecciona Fearless dos veces y verifica que el detalle muestre una visita por cada selección. Recarga: el contador permanece.
2. **Favoritos:** en el detalle marca la era, el álbum y una canción. En **Mi espacio → Favoritos** comprueba los tres contadores por categoría; quita uno y confirma que se actualice.
3. **Quiz:** selecciona Reputation y completa diez preguntas usando las pistas del panel. Al terminar debe mostrar el puntaje `/10`; recarga y confirma que conserva tu mejor resultado.
4. **Temporizador:** cambia la duración a 1 minuto, inicia mientras escuchas música en otra app y detén después de unos segundos. El tiempo se suma a las sesiones locales. La PWA no detecta ni reproduce audio.
5. **Playlists:** crea una lista, cámbiale el nombre, abre una era y añade una canción. Comprueba el conteo y prueba quitarla o eliminar la lista.
6. **Adivina la canción:** pide una pista, escribe el título y comprueba el resultado. Se guardan los intentos y aciertos; las pistas son originales y no reproducen letras protegidas.
7. **Offline:** abre la app con internet una vez, espera a que cargue el catálogo y luego activa modo avión o DevTools → **Network → Offline**. Las eras, imágenes y datos personales deben seguir disponibles; YouTube requiere conexión.

## Ver la caché

En Chrome o Edge abre DevTools → **Application → Storage → Cache Storage**:

- `eras-puebla-v25` (el número cambia al publicar nuevas versiones): HTML, CSS, JavaScript, manifest, iconos e ilustraciones locales.
- `eras-puebla-api-v1`: última respuesta de `GET /api/eras`, guardada por el service worker para abrir el catálogo sin conexión.

En **Application → Service Workers** puedes ver el worker activo. En **Application → Manifest** se inspecciona la configuración de instalación. DevTools → **Network** muestra la petición `/api/eras`; la respuesta viene de red con conexión y de Cache Storage cuando el dispositivo está offline.

Para guardar nuevas imágenes del proyecto, agrégalas a `assets/` y también a la lista `FILES` de `ServiceWorker.js`; después aumenta la versión de `CACHE`. Las ilustraciones originales de las eras ya están incluidas y se guardan offline. Los reproductores de YouTube requieren internet.

## Publicar en internet e instalar

Publica el proyecto completo como servicio Node (por ejemplo en Render, Railway o un VPS), configura almacenamiento persistente para `data/app.db` y habilita HTTPS. GitHub Pages por sí solo no puede alojar este backend ni la base SQLite. Define el comando de inicio `npm start`; la plataforma proporciona `PORT` automáticamente. Si el disco del proveedor es efímero, el catálogo se vuelve a crear desde `data/eras.json`, pero los cambios manuales en SQLite se perderían.

Una vez disponible por HTTPS, visita el sitio desde el navegador y elige **Instalar app** o **Instalar aplicación**. En iPhone/iPad: **Compartir → Agregar a pantalla de inicio**. En local, `localhost` también habilita service workers e instalación.

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

## Comentarios del código

Los módulos JS explican su responsabilidad y las operaciones importantes; `index.html` agrupa las secciones con comentarios, y `styles.css` divide los estilos por área. JSON no admite comentarios: el catálogo y el manifest se explican en esta guía.

## Cómo funciona `ServiceWorker.js`

El archivo gestiona:

1. `CACHE` y `FILES`: versión y archivos estáticos que se precargan.
2. `API_CACHE`: caché separada para las respuestas de la API.
3. `install` y `activate`: precarga recursos, limpia versiones anteriores de recursos y controla la pestaña.
4. `fetch`: actualiza el catálogo desde la red y usa la última respuesta guardada cuando no hay conexión.

Al añadir o renombrar una imagen local, actualiza `FILES` y aumenta `CACHE`. La primera carga del catálogo requiere conexión al backend; después queda cacheado para uso offline. YouTube requiere conexión.
