/*! LogiLab Entregas v1 · conecta cualquier actividad HTML con LogiLab Notas
 *  By Carlos Barrios · Instructor
 *
 *  USO en una actividad:
 *    <script src="logilab-entregas.js"></script>
 *    <script>
 *      LogiLabEntregas.config({
 *        api: 'https://logilab-notas.TU-SUBDOMINIO.workers.dev',
 *        whatsapp: '57XXXXXXXXXX',          // respaldo (opcional)
 *        email: 'cabarrios@uniguajira.edu.co' // respaldo (opcional)
 *      });
 *      // cuando el aprendiz termine:
 *      LogiLabEntregas.enviar({ actividad: 'F3538385-EXCEL2', contenido: {respuestas}, puntaje: 85 });
 *    </script>
 *
 *  Aquí NO hay ninguna clave: este archivo solo puede ENVIAR entregas, nunca leer notas.
 */
(function () {
  const CFG = { api: '', whatsapp: '', email: '', color: '#39A900' };
  let estilos = false;

  function css() {
    if (estilos) return; estilos = true;
    const s = document.createElement('style');
    s.textContent = `
    .lle-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;font-family:system-ui,sans-serif}
    .lle{background:#fff;color:#1b2118;border-radius:16px;max-width:420px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .lle h3{margin:0 0 4px;font-size:18px}.lle p{margin:6px 0;font-size:14px;color:#4b5548}
    .lle input{width:100%;box-sizing:border-box;font-size:18px;padding:12px;border:2px solid #dfe3da;border-radius:10px;margin:10px 0;letter-spacing:1px}
    .lle input:focus{outline:none;border-color:var(--lle)}
    .lle button{width:100%;padding:12px;border:0;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;background:var(--lle);color:#fff}
    .lle button.s{background:#f1f3ee;color:#1b2118}
    .lle .ok{background:#e3f4e6;color:#1f7a30;padding:12px;border-radius:10px;font-weight:600;margin:10px 0}
    .lle .er{background:#fbe4df;color:#a5321f;padding:10px;border-radius:10px;margin:10px 0;font-size:14px}
    .lle .ft{font-size:11px;color:#8a9486;text-align:center;margin-top:12px}`;
    document.head.appendChild(s);
  }

  function modal(html) {
    css();
    let bg = document.querySelector('.lle-bg');
    if (!bg) { bg = document.createElement('div'); bg.className = 'lle-bg'; document.body.appendChild(bg); }
    bg.innerHTML = `<div class="lle" style="--lle:${CFG.color}">${html}<div class="ft">LogiLab SENA · By Carlos Barrios · Instructor</div></div>`;
    return bg;
  }
  const cerrar = () => document.querySelector('.lle-bg')?.remove();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function post(ruta, data) {
    const r = await fetch(CFG.api.replace(/\/$/, '') + ruta, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
    });
    const j = await r.json().catch(() => ({ ok: false, error: 'Sin respuesta del servidor' }));
    if (!j.ok) { const e = new Error(j.error || 'Error'); e.status = r.status; throw e; }
    return j;
  }

  function texto(datos, doc) {
    return `ENTREGA LOGILAB\nActividad: ${datos.actividad}\nDocumento: ${doc}\nPuntaje: ${datos.puntaje ?? '-'}\nFecha: ${new Date().toLocaleString('es-CO')}\n\n${JSON.stringify(datos.contenido ?? {}, null, 1)}`;
  }

  function respaldos(datos, doc, motivo) {
    const t = texto(datos, doc);
    const bg = modal(`<h3>No se pudo enviar en línea</h3><div class="er">${esc(motivo)}</div>
      <p>Usa un respaldo. Tu trabajo no se pierde:</p>
      ${CFG.whatsapp ? '<button data-a="wa">📱 Enviar por WhatsApp</button>' : ''}
      ${CFG.email ? '<button data-a="em">✉️ Enviar por correo</button>' : ''}
      <button data-a="cp" class="s">📋 Copiar entrega</button>
      <button data-a="dl" class="s">⬇️ Descargar archivo</button>
      <button data-a="re" class="s">↻ Reintentar</button>
      <button data-a="x" class="s">Cerrar</button>`);
    bg.onclick = async ev => {
      const a = ev.target.dataset.a; if (!a) return;
      if (a === 'wa') window.open(`https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(t.slice(0, 3500))}`, '_blank');
      if (a === 'em') location.href = `mailto:${CFG.email}?subject=${encodeURIComponent('Entrega ' + datos.actividad + ' - ' + doc)}&body=${encodeURIComponent(t.slice(0, 1800))}`;
      if (a === 'cp') { try { await navigator.clipboard.writeText(t); ev.target.textContent = '✓ Copiado'; } catch { prompt('Copia este texto:', t); } }
      if (a === 'dl') { const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([JSON.stringify({ ...datos, documento: doc, fecha: new Date().toISOString() }, null, 2)], { type: 'application/json' })); l.download = `entrega_${datos.actividad}_${doc}.json`; l.click(); }
      if (a === 're') enviar(datos);
      if (a === 'x') cerrar();
    };
  }

  function enviar(datos) {
    return new Promise(resolve => {
      if (!datos || !datos.actividad) throw new Error('LogiLabEntregas: falta "actividad"');
      const guardado = (() => { try { return localStorage.getItem('lle_doc') || ''; } catch { return ''; } })();
      const bg = modal(`<h3>Entregar actividad</h3><p>Escribe tu número de documento (sin puntos).</p>
        <input id="lle-doc" inputmode="numeric" autocomplete="off" value="${esc(guardado)}" placeholder="1118...">
        <div id="lle-msg"></div>
        <button id="lle-ok">Verificar y enviar</button><button class="s" id="lle-x">Cancelar</button>`);
      const $ = id => bg.querySelector('#' + id);
      $('lle-x').onclick = () => { cerrar(); resolve({ ok: false, cancelado: true }); };
      $('lle-doc').focus();
      $('lle-ok').onclick = async () => {
        const doc = $('lle-doc').value.replace(/\D/g, '');
        if (doc.length < 5) { $('lle-msg').innerHTML = '<div class="er">Documento incompleto</div>'; return; }
        $('lle-ok').disabled = true; $('lle-ok').textContent = 'Verificando…';
        try {
          if (!CFG.api) throw new Error('La actividad no tiene configurado el servidor');
          const v = await post('/api/verificar', { documento: doc, actividad: datos.actividad });
          $('lle-ok').textContent = `Enviando como ${v.nombre}…`;
          const r = await post('/api/entregar', { documento: doc, actividad: datos.actividad, contenido: datos.contenido, puntaje: datos.puntaje });
          try { localStorage.setItem('lle_doc', doc); } catch {}
          const m = modal(`<h3>¡Listo, ${esc(r.nombre)}! ✅</h3><div class="ok">Entrega recibida<br>Recibo: <b>${esc(r.recibo)}</b></div>
            <p>Toma captura de este recibo por si lo necesitas.</p><button data-a="x">Cerrar</button>`);
          m.onclick = ev => { if (ev.target.dataset.a) cerrar(); };
          resolve({ ok: true, recibo: r.recibo });
        } catch (e) {
          if (e.status === 404 || e.status === 403 || e.status === 400) {
            $('lle-ok').disabled = false; $('lle-ok').textContent = 'Verificar y enviar';
            $('lle-msg').innerHTML = `<div class="er">${esc(e.message)}</div>`;
            if (e.status === 403) respaldos(datos, doc, e.message);
          } else respaldos(datos, doc, e.message);
          resolve({ ok: false, error: e.message });
        }
      };
      $('lle-doc').onkeydown = ev => { if (ev.key === 'Enter') $('lle-ok').click(); };
    });
  }

  window.LogiLabEntregas = { config: o => Object.assign(CFG, o || {}), enviar };
})();
