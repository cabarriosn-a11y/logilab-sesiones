// El Negociador · Cloudflare Worker (backend del juego)
// LogiLab SENA · By Carlos Barrios · Instructor
//
// Juego de negociación de fletes Colombia ⇄ Brasil por SALAS (una sala = un grupo de 4 aprendices).
// Todas las reglas se validan AQUÍ, en el servidor: el navegador solo muestra y envía.
//
// Rutas públicas (aprendices):
//   GET  /api/sala?c=CODIGO                       roles libres/ocupados de la sala
//   POST /api/unirse    {sala, rol, nombre}       -> {token}
//   POST /api/estado    {sala, rol, token, v}     -> vista del jugador (o {same:true} si no cambió)
//   POST /api/ofertar   {sala, rol, token, receptor, trayecto, precio, viajes}
//   POST /api/responder {sala, rol, token, id, respuesta: 'Aceptada'|'Rechazada'}
//   POST /api/desistir  {sala, rol, token, id}
//   POST /api/salir     {sala, rol, token}
// Rutas del instructor (cabecera x-admin-key = ADMIN_KEY):
//   GET  /api/admin/salas            GET /api/admin/sala?c=   GET /api/admin/csv?c=CODIGO|TODAS
//   POST /api/admin/crear {codigo, nombre}   /iniciar {sala, ronda, minutos?}   /cerrar {sala}
//        /liberar {sala, rol}   /reiniciar {sala}   /borrar {sala}
//
// Variables (Settings → Variables and Secrets) — NINGUNA va en GitHub:
//   ADMIN_KEY        clave del instructor (secreto, mínimo 12 caracteres)
//   ALLOWED_ORIGINS  orígenes permitidos separados por coma (ej. https://cabarriosn-a11y.github.io)
//   IP_SALT          texto aleatorio largo (secreto) para anonimizar IPs en el limitador
// Binding D1: DB   (tablas en schema.sql)

export const KM = 2000;                // km por viaje Colombia ⇄ Brasil
export const MULTA = 5000;             // USD por viaje no cubierto / camión vacío
export const SPOT_MIN = 1.0, SPOT_MAX = 4.0;   // $/km del mercado externo (tercerización)
export const DUR_DEF = 15;             // minutos por ronda
export const MAX_OFERTAS_PEND = 25;    // ofertas pendientes por jugador

export const ROLES = {
  fabrica_col: { nombre: 'Fábrica Colombia', tipo: 'fabrica' },
  fabrica_bra: { nombre: 'Fábrica Brasil', tipo: 'fabrica' },
  transp_col: { nombre: 'Transportista Colombia', tipo: 'transporte' },
  transp_bra: { nombre: 'Transportista Brasil', tipo: 'transporte' }
};
const T = { col_bra: 500, bra_col: 500 };
export const ESCENARIOS = {
  1: { fabrica_col: { col_bra: 500, bra_col: 500 }, fabrica_bra: { col_bra: 500, bra_col: 500 }, transp_col: T, transp_bra: T },
  2: { fabrica_col: { col_bra: 700, bra_col: 300 }, fabrica_bra: { col_bra: 300, bra_col: 700 }, transp_col: T, transp_bra: T },
  3: { fabrica_col: { col_bra: 800, bra_col: 200 }, fabrica_bra: { col_bra: 200, bra_col: 800 }, transp_col: T, transp_bra: T },
  4: { fabrica_col: { col_bra: 100, bra_col: 900 }, fabrica_bra: { col_bra: 900, bra_col: 100 }, transp_col: T, transp_bra: T }
};
const RUTA = { col_bra: '🇨🇴➡️🇧🇷', bra_col: '🇧🇷➡️🇨🇴' };

export class ErrJuego extends Error { constructor(m, s = 400) { super(m); this.status = s; } }
const r2 = n => Math.round(n * 100) / 100;
const fmt = n => r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ───────────────────────── lógica pura del juego ─────────────────────────
export function salaNueva(codigo, nombre, ahora) {
  const roles = {}, metas = {};
  for (const id of Object.keys(ROLES)) { roles[id] = { jugador: null, th: null, unido: null }; metas[id] = metaVacia(); }
  return { codigo, nombre, creada: ahora, ronda: 0, activa: false, inicio: 0, dur: DUR_DEF * 60, roles, metas, ofertas: {}, seq: 0, historial: {} };
}
function metaVacia() { return { col_bra: 0, bra_col: 0, total: 0, balance: 0, contratos: [] }; }

export function iniciarRonda(d, ronda, ahora, minutos) {
  if (!ESCENARIOS[ronda]) throw new ErrJuego('Ronda no válida (1 a 4)');
  if (d.activa) throw new ErrJuego('Hay una ronda en curso. Ciérrala primero.');
  for (const [id, m] of Object.entries(ESCENARIOS[ronda])) {
    d.metas[id] = { col_bra: m.col_bra, bra_col: m.bra_col, total: m.col_bra + m.bra_col, balance: 0, contratos: [] };
  }
  const min = Number(minutos);
  d.dur = Number.isFinite(min) && min >= 3 && min <= 60 ? Math.round(min) * 60 : DUR_DEF * 60;
  d.ronda = ronda; d.activa = true; d.inicio = ahora; d.ofertas = {};
  return d;
}

export function vencida(d, ahora) { return d.activa && ahora >= d.inicio + d.dur * 1000; }

export function calcularReporte(d, rnd = Math.random, estimado = false) {
  const rep = [];
  for (const [id, info] of Object.entries(ROLES)) {
    const m = d.metas[id];
    const faltCB = Math.max(0, m.col_bra), faltBC = Math.max(0, m.bra_col);
    const faltantes = faltCB + faltBC;
    const penalizacion = faltantes * MULTA;
    let costo = 0, detalle = 'Sin tercerizar', resultado;
    if (info.tipo === 'transporte') {
      const det = [];
      for (const tr of ['col_bra', 'bra_col']) {
        const terc = Math.abs(Math.min(0, m[tr]));
        if (terc > 0) {
          const spot = estimado ? (SPOT_MIN + SPOT_MAX) / 2 : SPOT_MIN + rnd() * (SPOT_MAX - SPOT_MIN);
          costo += terc * KM * spot;
          det.push(`${RUTA[tr]}: ${terc} a $${spot.toFixed(2)}${estimado ? ' (estimado)' : ''}`);
        }
      }
      if (det.length) detalle = det.join(' | ');
      resultado = m.balance - penalizacion - costo;
    } else {
      resultado = m.balance + penalizacion;
    }
    rep.push({ rol: id, nombre: info.nombre, jugador: d.roles[id].jugador || '(vacante)', tipo: info.tipo,
      faltantes, dinero: r2(m.balance), penalizacion: r2(penalizacion), costo_terc: r2(costo), detalle_terc: detalle,
      resultado: r2(resultado), ganador: false, contratos: m.contratos.slice() });
  }
  const fab = rep.filter(r => r.tipo === 'fabrica'), tra = rep.filter(r => r.tipo === 'transporte');
  const minF = Math.min(...fab.map(r => r.resultado)), maxT = Math.max(...tra.map(r => r.resultado));
  fab.forEach(r => { r.ganador = r.resultado === minF; });
  tra.forEach(r => { r.ganador = r.resultado === maxT; });
  return rep;
}

export function cerrarRonda(d, rnd = Math.random) {
  if (!d.activa) throw new ErrJuego('No hay ronda en curso');
  d.historial[d.ronda] = calcularReporte(d, rnd);
  d.activa = false;
  for (const o of Object.values(d.ofertas)) if (o.estado === 'Pendiente') o.estado = 'Vencida';
  return d;
}

function exigirRonda(d, ahora) {
  if (!d.activa) throw new ErrJuego('La ronda no está activa');
  if (ahora >= d.inicio + d.dur * 1000) throw new ErrJuego('Se acabó el tiempo de la ronda');
}

export function ofertar(d, emisor, p, ahora) {
  exigirRonda(d, ahora);
  const yo = ROLES[emisor], rec = ROLES[p.receptor];
  if (!rec) throw new ErrJuego('Destinatario no válido');
  if (rec.tipo === yo.tipo) throw new ErrJuego('Solo puedes negociar con el otro tipo de empresa');
  if (!RUTA[p.trayecto]) throw new ErrJuego('Ruta no válida');
  const precio = r2(Number(p.precio));
  if (!Number.isFinite(precio) || precio < 0.01 || precio > 20) throw new ErrJuego('Precio por km no válido (0,01 a 20)');
  const viajes = Number(p.viajes);
  if (!Number.isInteger(viajes) || viajes < 1 || viajes > 2000) throw new ErrJuego('Cantidad de viajes no válida (1 a 2000)');
  if (yo.tipo === 'fabrica' && viajes > d.metas[emisor][p.trayecto])
    throw new ErrJuego(`Solo necesitas ${d.metas[emisor][p.trayecto]} viajes en esa ruta. No pidas más.`);
  const pend = Object.values(d.ofertas).filter(o => o.emisor === emisor && o.estado === 'Pendiente').length;
  if (pend >= MAX_OFERTAS_PEND) throw new ErrJuego('Tienes demasiadas ofertas pendientes. Retira algunas.');
  const id = 'o' + (++d.seq);
  d.ofertas[id] = { id, emisor, receptor: p.receptor, trayecto: p.trayecto, precio, viajes,
    total: r2(precio * KM * viajes), estado: 'Pendiente', ts: ahora };
  return d.ofertas[id];
}

export function responder(d, quien, id, respuesta, ahora) {
  exigirRonda(d, ahora);
  const o = d.ofertas[id];
  if (!o) throw new ErrJuego('La oferta no existe', 404);
  if (o.receptor !== quien) throw new ErrJuego('Esta oferta no es para ti', 403);
  if (o.estado !== 'Pendiente') throw new ErrJuego(`La oferta ya está ${o.estado.toLowerCase()}`, 409);
  if (respuesta === 'Rechazada') { o.estado = 'Rechazada'; return o; }
  if (respuesta !== 'Aceptada') throw new ErrJuego('Respuesta no válida');
  for (const lado of [o.emisor, o.receptor]) {
    if (ROLES[lado].tipo === 'fabrica' && o.viajes > d.metas[lado][o.trayecto]) {
      throw new ErrJuego(lado === quien
        ? `Supera tu necesidad en esa ruta (te faltan ${d.metas[lado][o.trayecto]}). Recházala.`
        : `La fábrica ya cubrió esa necesidad (le faltan ${d.metas[lado][o.trayecto]}). Recházala.`, 409);
    }
  }
  o.estado = 'Aceptada';
  const txt = otro => `Con ${ROLES[otro].nombre}: ${o.viajes} vjs (${RUTA[o.trayecto]}) a $${o.precio.toFixed(2)}/Km = $${fmt(o.total)}`;
  for (const [lado, otro] of [[o.emisor, o.receptor], [o.receptor, o.emisor]]) {
    const m = d.metas[lado];
    m.contratos.push(txt(otro));
    m[o.trayecto] -= o.viajes;
    m.balance = r2(m.balance + o.total);
    if (ROLES[lado].tipo === 'fabrica') m[o.trayecto] = Math.max(0, m[o.trayecto]);
    m.total = Math.max(0, m.col_bra) + Math.max(0, m.bra_col);
  }
  return o;
}

export function desistir(d, quien, id) {
  const o = d.ofertas[id];
  if (!o) throw new ErrJuego('La oferta no existe', 404);
  if (o.emisor !== quien) throw new ErrJuego('Solo quien envió la oferta puede retirarla', 403);
  if (o.estado !== 'Pendiente') throw new ErrJuego(`La oferta ya está ${o.estado.toLowerCase()}`, 409);
  o.estado = 'Desistida';
  return o;
}

export function vistaJugador(d, rol, version, ahora) {
  const yo = ROLES[rol];
  const ofertas = Object.values(d.ofertas).filter(o => o.emisor === rol || o.receptor === rol)
    .sort((a, b) => b.ts - a.ts)
    .map(o => ({ ...o, emisorNombre: ROLES[o.emisor].nombre, receptorNombre: ROLES[o.receptor].nombre }));
  const ult = d.historial[d.ronda];
  return {
    ok: true, v: version, now: ahora,
    sala: { codigo: d.codigo, nombre: d.nombre },
    ronda: d.ronda, activa: d.activa, inicio: d.inicio, dur: d.dur,
    yo: { rol, nombre: yo.nombre, tipo: yo.tipo, jugador: d.roles[rol].jugador, ...d.metas[rol] },
    destinatarios: Object.entries(ROLES).filter(([, r]) => r.tipo !== yo.tipo)
      .map(([id, r]) => ({ id, nombre: r.nombre, jugador: d.roles[id].jugador })),
    ofertas,
    resultado: !d.activa && ult ? ult : null
  };
}

// ───────────────────────── utilidades HTTP ─────────────────────────
function seg() { return { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' }; }
function corsH(req, env) {
  const origin = req.headers.get('origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && ok.includes(origin)) return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-admin-key', 'access-control-max-age': '86400', vary: 'Origin' };
  return {};
}
function json(obj, status, h) { return new Response(JSON.stringify(obj), { status: status || 200, headers: { ...seg(), ...h, 'content-type': 'application/json; charset=utf-8' } }); }
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const limpiaSala = c => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
const limpiaNombre = n => String(n || '').replace(/[<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
function token() { const a = new Uint8Array(24); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); }

async function leer(env, codigo) {
  const f = await env.DB.prepare('SELECT data, version FROM salas WHERE codigo=?').bind(codigo).first();
  if (!f) throw new ErrJuego('La sala no existe. Revisa el código con tu instructor.', 404);
  return { d: JSON.parse(f.data), v: f.version };
}
// Lectura-modificación-escritura con control de versión: dos clics simultáneos nunca se aplican dos veces.
async function mutar(env, codigo, fn) {
  for (let i = 0; i < 8; i++) {
    const { d, v } = await leer(env, codigo);
    const ahora = Date.now();
    let res, cerro = false;
    if (vencida(d, ahora)) { cerrarRonda(d); cerro = true; }   // cierre automático al acabarse el tiempo
    if (!(cerro && fn.requiereActiva)) res = fn(d, ahora);
    const r = await env.DB.prepare('UPDATE salas SET data=?, version=version+1 WHERE codigo=? AND version=?')
      .bind(JSON.stringify(d), codigo, v).run();
    if (r.meta && r.meta.changes === 1) {
      if (cerro && fn.requiereActiva) throw new ErrJuego('Se acabó el tiempo de la ronda');
      return { d, v: v + 1, res };
    }
    await new Promise(ok => setTimeout(ok, 15 + Math.random() * 40));
  }
  throw new ErrJuego('Mucho tráfico en la sala, intenta de nuevo', 503);
}
async function jugador(d, rol, tok) {
  const r = d.roles[rol];
  if (!r || !r.th || !tok || (await sha256(String(tok))) !== r.th) throw new ErrJuego('Tu sesión en esta sala ya no es válida. Vuelve a entrar.', 401);
}
async function limitar(env, req, tipo, max) {
  const ip = req.headers.get('cf-connecting-ip') || '0';
  const h = (await sha256(ip + '|' + (env.IP_SALT || ''))).slice(0, 32);
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM intentos WHERE ip_hash=? AND tipo=? AND creado > datetime('now','-10 minutes')").bind(h, tipo).first();
  if (n && n.n >= max) return false;
  await env.DB.prepare('INSERT INTO intentos(ip_hash,tipo) VALUES (?,?)').bind(h, tipo).run();
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM intentos WHERE creado < datetime('now','-1 day')").run();
  return true;
}
async function esAdmin(req, env) {
  const k = req.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || String(env.ADMIN_KEY).length < 12 || !k) return false;   // falla cerrado
  return (await sha256(k)) === (await sha256(env.ADMIN_KEY));
}
function publicaSala(d) {
  return { codigo: d.codigo, nombre: d.nombre, ronda: d.ronda, activa: d.activa,
    roles: Object.entries(ROLES).map(([id, r]) => ({ id, nombre: r.nombre, tipo: r.tipo, libre: !d.roles[id].jugador })) };
}
function adminSala(d, v) {
  const roles = {};
  for (const id of Object.keys(ROLES)) roles[id] = { jugador: d.roles[id].jugador, unido: d.roles[id].unido };
  const ofertas = Object.values(d.ofertas);
  return { codigo: d.codigo, nombre: d.nombre, creada: d.creada, ronda: d.ronda, activa: d.activa, inicio: d.inicio, dur: d.dur, v,
    roles, metas: d.metas, historial: d.historial,
    en_vivo: d.activa ? calcularReporte(d, Math.random, true) : null,
    n_ofertas: ofertas.length, n_acuerdos: ofertas.filter(o => o.estado === 'Aceptada').length };
}
function csv(salas) {
  const q = x => { const s = String(x ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const filas = [['Sala', 'Grupo', 'Ronda', 'Empresa', 'Aprendiz', 'Rol', 'Viajes incumplidos/vacíos', 'Detalle de acuerdos',
    'Dinero en contratos (USD)', 'Multa por faltantes (USD)', 'Costo de tercerización (USD)', 'Detalle mercado externo', 'RESULTADO FINAL (USD)', '¿Fue ganador?']];
  for (const d of salas) for (const [ronda, rep] of Object.entries(d.historial)) for (const f of rep) {
    filas.push([d.codigo, d.nombre, ronda, f.nombre, f.jugador, f.tipo.toUpperCase(), f.faltantes,
      f.contratos.length ? f.contratos.join(' \n ') : 'Sin acuerdos', f.dinero, f.penalizacion, f.costo_terc, f.detalle_terc, f.resultado, f.ganador ? 'SÍ' : 'NO']);
  }
  return '﻿' + filas.map(f => f.map(q).join(';')).join('\r\n');
}

// ───────────────────────── enrutador ─────────────────────────
export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname, h = corsH(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.headers.get('origin') && !h['access-control-allow-origin']) return json({ ok: false, error: 'Origen no permitido' }, 403);
    try {
      if (p === '/') return new Response('El Negociador · LogiLab SENA · OK', { headers: seg() });
      if (p.startsWith('/api/admin/')) return await rutasAdmin(req, env, p.slice(11), url, h);
      if (p.startsWith('/api/')) return await rutasJugador(req, env, p.slice(5), url, h);
      return json({ ok: false, error: 'No encontrado' }, 404, h);
    } catch (e) {
      if (e instanceof ErrJuego) return json({ ok: false, error: e.message }, e.status, h);
      console.error(e);
      return json({ ok: false, error: 'Error interno' }, 500, h);
    }
  }
};

async function cuerpo(req) {
  const t = await req.text();
  if (t.length > 4096) throw new ErrJuego('Solicitud demasiado grande', 413);
  try { return JSON.parse(t || '{}'); } catch { throw new ErrJuego('JSON inválido'); }
}

async function rutasJugador(req, env, ruta, url, h) {
  if (ruta === 'sala' && req.method === 'GET') {
    const { d } = await leer(env, limpiaSala(url.searchParams.get('c')));
    return json({ ok: true, sala: publicaSala(d) }, 200, h);
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405, h);
  const b = await cuerpo(req);
  const sala = limpiaSala(b.sala), rol = String(b.rol || '');
  if (!sala || !ROLES[rol]) throw new ErrJuego('Faltan la sala o el rol');

  if (ruta === 'unirse') {
    if (!(await limitar(env, req, 'unirse', 40))) throw new ErrJuego('Demasiados intentos. Espera unos minutos.', 429);
    const nombre = limpiaNombre(b.nombre);
    if (nombre.length < 2) throw new ErrJuego('Escribe tu nombre');
    const tok = token(), th = await sha256(tok);
    await mutar(env, sala, d => {
      if (d.roles[rol].jugador) throw new ErrJuego(`El rol ${ROLES[rol].nombre} ya está ocupado por ${d.roles[rol].jugador}`, 409);
      d.roles[rol] = { jugador: nombre, th, unido: Date.now() };
    });
    return json({ ok: true, token: tok }, 200, h);
  }

  if (ruta === 'estado') {
    let { d, v } = await leer(env, sala);
    await jugador(d, rol, b.token);
    if (vencida(d, Date.now())) ({ d, v } = await mutar(env, sala, () => {}));
    if (Number(b.v) === v) return json({ ok: true, same: true, v, now: Date.now() }, 200, h);
    return json(vistaJugador(d, rol, v, Date.now()), 200, h);
  }

  const acciones = {
    ofertar: (d, a) => ofertar(d, rol, { receptor: b.receptor, trayecto: b.trayecto, precio: b.precio, viajes: Number(b.viajes) }, a),
    responder: (d, a) => responder(d, rol, String(b.id || ''), b.respuesta, a),
    desistir: d => desistir(d, rol, String(b.id || '')),
    salir: d => { d.roles[rol] = { jugador: null, th: null, unido: null }; }
  };
  const fn = acciones[ruta];
  if (!fn) return json({ ok: false, error: 'No encontrado' }, 404, h);
  const { d: d0 } = await leer(env, sala);
  await jugador(d0, rol, b.token);
  const th = d0.roles[rol].th;
  const envuelta = (d, a) => {
    if (d.roles[rol].th !== th) throw new ErrJuego('Tu sesión en esta sala ya no es válida. Vuelve a entrar.', 401);
    return fn(d, a);
  };
  envuelta.requiereActiva = ruta !== 'salir';
  const { d, v } = await mutar(env, sala, envuelta);
  return json(ruta === 'salir' ? { ok: true } : vistaJugador(d, rol, v, Date.now()), 200, h);
}

async function rutasAdmin(req, env, ruta, url, h) {
  if (!(await esAdmin(req, env))) {
    await limitar(env, req, 'admin', 10).then(ok => { if (!ok) throw new ErrJuego('Demasiados intentos. Espera 10 minutos.', 429); });
    throw new ErrJuego('Clave de instructor incorrecta', 401);
  }
  if (req.method === 'GET') {
    if (ruta === 'salas') {
      const { results } = await env.DB.prepare('SELECT codigo FROM salas ORDER BY creada DESC').all();
      const out = [];
      for (const { codigo } of results) {
        let { d, v } = await leer(env, codigo);
        if (vencida(d, Date.now())) ({ d, v } = await mutar(env, codigo, () => {}));
        out.push(adminSala(d, v));
      }
      return json({ ok: true, salas: out, now: Date.now() }, 200, h);
    }
    if (ruta === 'sala') {
      const c = limpiaSala(url.searchParams.get('c'));
      let { d, v } = await leer(env, c);
      if (vencida(d, Date.now())) ({ d, v } = await mutar(env, c, () => {}));
      return json({ ok: true, sala: adminSala(d, v), now: Date.now() }, 200, h);
    }
    if (ruta === 'csv') {
      const c = limpiaSala(url.searchParams.get('c'));
      let lista;
      if (!c || c === 'TODAS') {
        const { results } = await env.DB.prepare('SELECT data FROM salas ORDER BY creada').all();
        lista = results.map(r => JSON.parse(r.data));
      } else lista = [(await leer(env, c)).d];
      return new Response(csv(lista), { headers: { ...seg(), ...h, 'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="Resultados_El_Negociador_${c || 'TODAS'}.csv"` } });
    }
    return json({ ok: false, error: 'No encontrado' }, 404, h);
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405, h);
  const b = await cuerpo(req);
  const sala = limpiaSala(b.sala || b.codigo);
  if (!sala || sala.length < 3) throw new ErrJuego('Código de sala no válido (3 a 24 letras, números o guiones)');

  if (ruta === 'crear') {
    const nombre = limpiaNombre(b.nombre) || sala;
    const d = salaNueva(sala, nombre, Date.now());
    const r = await env.DB.prepare('INSERT OR IGNORE INTO salas(codigo, data, version, creada) VALUES (?,?,1,?)')
      .bind(sala, JSON.stringify(d), d.creada).run();
    if (!r.meta || r.meta.changes !== 1) throw new ErrJuego('Ya existe una sala con ese código', 409);
    return json({ ok: true, sala: adminSala(d, 1) }, 200, h);
  }
  if (ruta === 'borrar') {
    await env.DB.prepare('DELETE FROM salas WHERE codigo=?').bind(sala).run();
    return json({ ok: true }, 200, h);
  }
  const acc = {
    iniciar: (d, a) => iniciarRonda(d, Number(b.ronda), a, b.minutos),
    cerrar: d => cerrarRonda(d),
    liberar: d => { if (!ROLES[b.rol]) throw new ErrJuego('Rol no válido'); d.roles[b.rol] = { jugador: null, th: null, unido: null }; },
    reiniciar: d => { const n = salaNueva(d.codigo, d.nombre, d.creada); Object.keys(d).forEach(k => delete d[k]); Object.assign(d, n); }
  }[ruta];
  if (!acc) return json({ ok: false, error: 'No encontrado' }, 404, h);
  const { d, v } = await mutar(env, sala, acc);
  return json({ ok: true, sala: adminSala(d, v) }, 200, h);
}
