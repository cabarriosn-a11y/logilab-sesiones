# El Negociador · instalar el servidor en Cloudflare (una sola vez, ~10 min)

La página (`logistica/el-negociador/index.html`) vive en GitHub Pages. Las reglas del juego, las salas y los resultados viven en un Worker de Cloudflare con una base D1, igual que LogiLab Notas. Es gratis.

## 1. Base de datos
1. Cloudflare → **Storage & Databases → D1 → Create** → nombre `negociador`.
2. Abre la base → pestaña **Console** → pega todo `schema.sql` → **Execute**.

## 2. Worker
1. **Workers & Pages → Create → Worker** → nombre `logilab-negociador` → **Deploy**.
2. **Edit code** → borra lo que trae, pega todo `worker.js` → **Deploy**.
3. **Settings → Bindings → Add → D1 database**: nombre de variable `DB`, base `negociador`.
4. **Settings → Variables and Secrets**:
   | Nombre | Tipo | Valor |
   |---|---|---|
   | `ADMIN_KEY` | Secret | tu clave de instructor (mínimo 12 caracteres) |
   | `ALLOWED_ORIGINS` | Text | `https://cabarriosn-a11y.github.io` |
   | `IP_SALT` | Secret | cualquier texto largo y aleatorio |
5. Abre la URL del Worker (`https://logilab-negociador.TU-SUBDOMINIO.workers.dev`): debe decir **El Negociador · LogiLab SENA · OK**.

## 3. Conectar la página
En `index.html`, cambia `API_DEF` por la URL del paso 2.5 y haz push.
(Mientras tanto, también sirve pegarla en **Soy instructor → URL del servidor**: queda guardada en ese navegador.)

## Uso en clase
- **Soy instructor** → clave → **Crear varias…** (ej. ficha 3229854, 6 equipos → salas `3229854-E1` … `3229854-E6`).
- En cada sala, **WhatsApp** o **Enlace** → el aprendiz entra con el código ya puesto, escoge rol y escribe su nombre.
- Inicia la ronda en cada sala (1 a 4, minutos ajustables). La ronda se cierra sola al acabarse el tiempo, o con **Cerrar ronda**.
- **Resultados** por sala, **CSV** por sala o de todas. **🔄** reinicia la sala para un grupo nuevo.

Ninguna clave va en GitHub: `ADMIN_KEY` solo existe en Cloudflare y en el navegador del instructor.
