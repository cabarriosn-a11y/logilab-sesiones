# LogiLab SENA · Sesiones (GitHub Pages)

Sitio: https://cabarriosn-a11y.github.io/logilab-sesiones/ (GitHub Pages, rama `main`, raíz). Se publica solo con cada push a `main`.
Creado porque el plan gratuito de Netlify (logilab-sena) se queda sin créditos por publicación. Aquí van las sesiones de clase estáticas; lo que necesita servidor (APIs con Netlify Blobs, zona docente protegida, inglés) sigue en `logilab-sena`.

## Reglas
- Solo HTML estático autocontenido (sin funciones de servidor). Librerías por CDN con versión fija.
- Una carpeta por sesión: `logistica/sN-nombre/index.html`; agregarla al arreglo `SESIONES` de `/index.html` (la más reciente primero).
- Enlaces internos RELATIVOS (el sitio vive en `/logilab-sesiones/`): el botón de portal es `../../`.
- Marca: verde SENA `#39A900`, pie "By Carlos Barrios · Instructor", tema claro/oscuro con tokens.
  - Excepción: sesiones de la Universidad de La Guajira (curso 732235) usan azul marino `#0B2545` con dorado y pie "By Carlos Barrios · Docente". Sin API: el producto del equipo se escoge a mano y las entregas van por WhatsApp, correo, copiar o descargar.
- Entregas de aprendices con respaldo: WhatsApp, correo, copiar y descargar.
- Excepción de backend: el Taller Plan Estratégico (`logistica/taller-plan-estrategico/`) envía al buzón `https://logilab-sena.netlify.app/api/plan` (función del repo `logilab-sena`, CORS para este sitio). La zona instructor trae entregas y guarda evaluaciones allí con la clave `ADMIN_KEY` (se pide una vez por dispositivo, nunca va en el código). Copiar código, WhatsApp, correo y archivo siguen como respaldo.
- NUNCA publicar solucionarios ni material docente aquí: el repositorio y el sitio son públicos.
