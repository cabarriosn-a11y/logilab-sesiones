/* =====================================================================
   LogiLab SENA · Motor 3D v1.3
   Visor de equipos en piezas: giro 3D, vista explosionada, movimiento,
   etiquetas, ficha por pieza y librería de piezas básicas (K).
   Requiere antes: three.js r128 + OrbitControls (examples/js).
   Uso: LogiLab3D.mount({ title, accent, lede, specs, motion, portal, parts:[...] })
   spread: n (en una parte) separa sus hijos izquierdo/derecho n metros en la vista explosionada
   LogiLab3D.kit() devuelve K para escenas propias (simuladores); LogiLab3D.linearize(obj) ajusta sus colores.
   portal: ruta de regreso (ej. '/' o '../') y portalText: texto del enlace del pie
   By Carlos Barrios · Instructor
   ===================================================================== */
(function (global) {
'use strict';

const CSS = `
:root{color-scheme:dark;--bg:#07111d;--bg2:#0c1d30;--panel:rgba(14,30,48,.82);--panel-solid:#0e1e30;--ink:#e6f1f8;--muted:#8aa3b6;--line:rgba(120,190,230,.22);--holo:#3ee0f0;--holo-dim:rgba(62,224,240,.35);--sena:#39A900;--paint:#f2b316;
--display:"Barlow Condensed","Arial Narrow",Arial,sans-serif;--body:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.5;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:18px 24px}
.ll-wrap{max-width:1360px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.ll-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 24px}
.ll-brand{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:8px}
.ll-brand i{width:10px;height:10px;background:var(--sena);display:inline-block}
.ll-head h1{font-family:var(--display);font-weight:800;font-size:clamp(30px,5vw,48px);line-height:1;margin:4px 0 0;letter-spacing:.02em;text-transform:uppercase;text-wrap:balance}
.ll-head h1 span{color:var(--paint)}
.ll-lede{margin:6px 0 0;color:var(--muted);max-width:62ch}
.ll-specs{display:flex;gap:20px;flex-wrap:wrap;font-family:var(--mono);font-size:11.5px;color:var(--muted);letter-spacing:.03em}
.ll-specs b{display:block;font-family:var(--display);font-size:24px;color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.ll-grid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px}
@media (max-width:960px){.ll-grid{grid-template-columns:minmax(0,1fr)}}
.ll-stage{position:relative;border:1px solid var(--line);border-radius:6px;overflow:hidden;min-width:0;background:radial-gradient(120% 90% at 50% 35%,var(--bg2) 0%,var(--bg) 70%)}
.ll-stage canvas{display:block;width:100%;height:min(70vh,660px);min-height:380px;cursor:grab;touch-action:none}
.ll-stage canvas:active{cursor:grabbing}
.ll-mode{position:absolute;left:14px;top:14px;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.ll-mode div{font-family:var(--display);font-size:17px;font-weight:500;padding:5px 14px;border:1px solid var(--line);background:var(--panel);border-radius:3px;color:var(--muted);letter-spacing:.02em}
.ll-mode div:first-child{color:var(--ink);border-left:3px solid var(--holo);box-shadow:0 0 18px rgba(62,224,240,.18)}
.ll-hint{position:absolute;right:14px;top:16px;font-family:var(--mono);font-size:11px;color:var(--muted);pointer-events:none;text-align:right}
@media (max-width:600px){.ll-hint{display:none}}
.ll-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.ll-overlay line{stroke:var(--holo);stroke-width:1;opacity:.75}
.ll-overlay circle.ring{fill:none;stroke:var(--holo);stroke-width:1.5}
.ll-overlay circle.core{fill:var(--holo)}
.ll-card{position:absolute;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:8px 12px;max-width:260px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.ll-card .t{font-family:var(--display);font-weight:700;font-size:19px;text-transform:uppercase;letter-spacing:.03em;line-height:1.1;display:block;border-bottom:1px solid var(--line);padding-bottom:4px;margin-bottom:4px}
.ll-card .d{font-size:13px;line-height:1.35}
.ll-card .r{font-family:var(--mono);font-size:10px;color:var(--holo);letter-spacing:.08em}
.ll-tip{opacity:0;transition:opacity .12s;border-color:var(--holo-dim);box-shadow:0 0 22px rgba(62,224,240,.22)}
.ll-tip.on{opacity:1}
.ll-lbl{padding:3px 9px;max-width:none;white-space:nowrap;transform:translate(-50%,-50%)}
.ll-lbl .t{font-size:14px;border:0;margin:0;padding:0}
.labels-off .ll-lbl,.labels-off .ll-leaders{display:none}
.ll-pulse{animation:llpulse 1.4s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes llpulse{0%{transform:scale(.6);opacity:1}100%{transform:scale(2.2);opacity:0}}
.ll-controls{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;padding:12px 14px;border-top:1px solid var(--line);background:rgba(7,17,29,.6)}
.ll-ctl{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--muted);flex:1 1 210px}
.ll-ctl label{white-space:nowrap}
.ll-ctl output{font-variant-numeric:tabular-nums;color:var(--ink);min-width:52px;text-align:right}
.ll-ctl input[type=range]{flex:1;accent-color:var(--holo);min-width:80px}
.ll-btns{display:flex;gap:8px;flex-wrap:wrap}
.ll-btns button{font:600 13px var(--body);padding:7px 12px;border-radius:4px;border:1px solid var(--line);background:var(--panel-solid);color:var(--ink);cursor:pointer}
.ll-btns button:hover{border-color:var(--holo)}
.ll-btns button.primary{background:var(--sena);border-color:var(--sena);color:#fff}
.ll-btns button[aria-pressed="true"]{border-color:var(--holo);color:var(--holo)}
button:focus-visible,input:focus-visible,.ll-list li:focus-visible{outline:2px solid var(--holo);outline-offset:2px}
.ll-aside{background:var(--panel-solid);border:1px solid var(--line);border-radius:6px;display:flex;flex-direction:column;min-width:0}
.ll-aside h2{font-family:var(--display);font-size:20px;text-transform:uppercase;letter-spacing:.05em;margin:0;padding:12px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:baseline}
.ll-aside h2 small{font-family:var(--mono);font-size:11px;color:var(--muted)}
.ll-list{list-style:none;margin:0;padding:6px;overflow:auto;max-height:440px}
.ll-list li{display:grid;grid-template-columns:30px 1fr 10px;gap:8px;align-items:center;padding:6px 8px;border-radius:3px;cursor:pointer;font-size:14px;border-left:2px solid transparent}
.ll-list li .n{font-family:var(--mono);font-size:11px;color:var(--muted)}
.ll-list li .sw{width:10px;height:10px;border-radius:50%}
.ll-list li:hover,.ll-list li.on{background:rgba(62,224,240,.09);border-left-color:var(--holo)}
.ll-list li.on .n{color:var(--holo)}
.ll-detail{border-top:1px solid var(--line);padding:12px 14px;min-height:160px}
.ll-detail .ref{font-family:var(--mono);font-size:11px;color:var(--holo);letter-spacing:.08em;text-transform:uppercase}
.ll-detail h3{font-family:var(--display);font-size:25px;text-transform:uppercase;margin:2px 0 6px;line-height:1.05;letter-spacing:.02em}
.ll-detail p{margin:0 0 6px;font-size:14px}
.ll-detail .mat{font-family:var(--mono);font-size:12px;color:var(--muted)}
.ll-foot{font-family:var(--mono);font-size:12px;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;border-top:1px solid var(--line);padding-top:10px}
.ll-foot b{color:var(--sena)}
.ll-foot a{color:var(--holo);text-decoration:none}.ll-foot a:hover{text-decoration:underline}
@media (prefers-reduced-motion:reduce){.ll-pulse{animation:none}.ll-tip{transition:none}}`;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');

/* ---------------- Librería de piezas (K) ---------------- */
function makeKit() {
  const T = THREE;
  const std = (c, m, r, o) => new T.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, o || {}));
  const M = {
    paint: (c = 0xf2b316) => new T.MeshPhysicalMaterial({ color: c, metalness: 0.25, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.6 }),
    steel: () => std(0x9ea6ac, 0.85, 0.35),
    dark: () => std(0x4a5258, 0.7, 0.45),
    chrome: () => std(0xf2f5f7, 1, 0.08),
    rubber: () => std(0x1a1c1e, 0, 0.85),
    pu: (c = 0x8a2a1c) => std(c, 0.05, 0.5),
    nylon: () => std(0xd8d4c8, 0, 0.6),
    brass: () => std(0xc9a24a, 0.9, 0.3),
    spring: () => std(0x7d8a92, 0.9, 0.28),
    cable: () => std(0x5b6268, 0.8, 0.5),
    wood: (c = 0xb8895a) => std(c, 0, 0.82),
    glass: () => new T.MeshPhysicalMaterial({ color: 0xaee6ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.35 }),
    color: (c, m = 0.3, r = 0.5) => std(c, m, r),
    tire: () => std(0x1b1c1e, 0, 0.92),
    rim: (c = 0x2a2e33) => std(c, 0.6, 0.38),
    vinyl: (c = 0x1e2124) => std(c, 0.05, 0.62),
    lens: (c = 0xfff1c2, i = 1.4) => std(0xffffff, 0, 0.15, { emissive: c, emissiveIntensity: i }),
    beacon: (c = 0xff9a1a) => new T.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.85 }),
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const orient = (g, axis) => { if (axis === 'x') g.rotateY(Math.PI / 2); else if (axis === 'y') g.rotateX(-Math.PI / 2); return g; };

  // Caja con bordes redondeados (w=x, h=y, d=z)
  function rbox(w, h, d, mat, x = 0, y = 0, z = 0, r) {
    r = r == null ? Math.min(w, h, d) * 0.12 : r; r = Math.min(r, w / 2.01, h / 2.01, d / 2.01);
    const s = new T.Shape(), hw = w / 2 - r, hh = h / 2 - r;
    s.moveTo(-hw, -h / 2); s.lineTo(hw, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh); s.lineTo(w / 2, hh); s.quadraticCurveTo(w / 2, h / 2, hw, h / 2);
    s.lineTo(-hw, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh); s.lineTo(-w / 2, -hh); s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(d - 2 * r, 0.0001), bevelEnabled: r > 0, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * r) / 2); return mesh(g, mat, x, y, z);
  }
  // Cilindro; axis 'x' | 'y' (defecto) | 'z'
  function cyl(r, h, mat, x = 0, y = 0, z = 0, axis, seg = 32) {
    const m = mesh(new T.CylinderGeometry(r, r, h, seg), mat, x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2; if (axis === 'z') m.rotation.x = Math.PI / 2; return m;
  }
  // Rueda con eje en X; spokes>0 dibuja rayos (ruedas grandes)
  function wheel(r, w, tireMat, x = 0, y = 0, z = 0, spokes = 0) {
    const g = new T.Group();
    const tire = new T.Mesh(new T.CylinderGeometry(r, r, w, 40), tireMat); tire.rotation.z = Math.PI / 2; g.add(tire);
    const edge = new T.Mesh(new T.TorusGeometry(r - w * 0.18, w * 0.2, 10, 40), tireMat); edge.rotation.y = Math.PI / 2;
    const e1 = edge.clone(); e1.position.x = w / 2 - w * 0.15; const e2 = edge.clone(); e2.position.x = -w / 2 + w * 0.15; g.add(e1, e2);
    const hubR = spokes ? r * 0.68 : r * 0.5;
    const hub = new T.Mesh(new T.CylinderGeometry(hubR, hubR, w * 1.04, 32), spokes ? M.dark() : M.steel()); hub.rotation.z = Math.PI / 2; g.add(hub);
    if (spokes) for (const side of [-1, 1]) {
      const disc = new T.Mesh(new T.CylinderGeometry(hubR * 0.92, hubR * 0.92, 0.004, 32), M.steel()); disc.rotation.z = Math.PI / 2; disc.position.x = side * w * 0.53; g.add(disc);
      const cap = new T.Mesh(new T.CylinderGeometry(hubR * 0.3, hubR * 0.3, w * 0.24, 20), M.chrome()); cap.rotation.z = Math.PI / 2; cap.position.x = side * w * 0.5; g.add(cap);
      for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2; const sp = new T.Mesh(new T.BoxGeometry(w * 0.16, hubR * 0.62, hubR * 0.15), M.dark());
        sp.position.set(side * w * 0.56, Math.cos(a) * hubR * 0.6, Math.sin(a) * hubR * 0.6); sp.rotation.x = a; g.add(sp); }
    }
    g.position.set(x, y, z); return g;
  }
  // Recorre puntos [x,y] y curvas ['q',cx,cy,x,y]
  function trace(path, pts) { let first = true;
    pts.forEach(p => { if (p[0] === 'q') path.quadraticCurveTo(p[1], p[2], p[3], p[4]); else if (first) { path.moveTo(p[0], p[1]); first = false; } else path.lineTo(p[0], p[1]); });
    return path; }
  // Perfil 2D extruido (los puntos aceptan curvas ['q',cx,cy,x,y]). plane 'xy' (extruye en z, centrado) | 'xz' (puntos x,z; espesor hacia arriba desde y=0) | 'zy' (puntos z,y; espesor en x centrado)
  function extrude(pts, depth, mat, o = {}) {
    const s = trace(new T.Shape(), pts);
    (o.holes || []).forEach(h => s.holes.push(trace(new T.Path(), h)));
    const b = o.bevel == null ? Math.min(depth * 0.25, 0.006) : o.bevel;
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(depth - 2 * b, 0.0001), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 12 });
    const plane = o.plane || 'xy';
    if (plane === 'xy') g.translate(0, 0, -depth / 2 + b);
    else if (plane === 'xz') { g.rotateX(Math.PI / 2); g.translate(0, depth - b, 0); }
    else if (plane === 'zy') { g.rotateY(-Math.PI / 2); g.translate(depth / 2 - b, 0, 0); }
    return mesh(g, mat, o.x || 0, o.y || 0, o.z || 0);
  }
  // Tubo por puntos [[x,y,z],...]
  function tube(points, r, mat, closed = false, seg = 120) {
    const c = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)), closed, 'centripetal');
    return new T.Mesh(new T.TubeGeometry(c, seg, r, 12, closed), mat);
  }
  // Aro rectangular redondeado (empuñaduras), en plano XY, base en y
  function loop(w, h, corner, r, mat, x = 0, y = 0, z = 0) {
    const pts = []; const c = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const t = a0 + i / 6 * Math.PI / 2; pts.push([cx + corner * Math.cos(t), cy + corner * Math.sin(t), 0]); } };
    c(w / 2 - corner, h - corner, 0); c(-w / 2 + corner, h - corner, Math.PI / 2); c(-w / 2 + corner, corner, Math.PI); c(w / 2 - corner, corner, Math.PI * 1.5);
    const m = tube(pts, r, mat, true); m.position.set(x, y, z); return m;
  }
  // Resorte helicoidal vertical
  function helix(radius, height, turns, wire, mat, x = 0, y = 0, z = 0) {
    class H extends T.Curve { getPoint(t) { const a = t * Math.PI * 2 * turns; return new T.Vector3(radius * Math.cos(a), t * height, radius * Math.sin(a)); } }
    return mesh(new T.TubeGeometry(new H(), Math.ceil(turns * 24), wire, 8, false), mat, x, y, z);
  }
  // Cable recto entre dos puntos
  function cable(a, b, r, mat) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const m = new T.Mesh(new T.CylinderGeometry(r, r, L, 10), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m;
  }
  // Viga I: alto h, ancho de ala w, largo len a lo largo de axis
  function beamI(len, h, w, mat, o = {}) {
    const tw = o.tw || h * 0.08, tf = o.tf || h * 0.1, a = w / 2, t = tw / 2, y = h / 2;
    const pts = [[-a, -y], [a, -y], [a, -y + tf], [t, -y + tf], [t, y - tf], [a, y - tf], [a, y], [-a, y], [-a, y - tf], [-t, y - tf], [-t, -y + tf], [-a, -y + tf]];
    const m = extrude(pts, len, mat, { bevel: Math.min(tf, tw) * 0.3 }); orient(m.geometry, o.axis || 'x'); m.position.set(o.x || 0, o.y || 0, o.z || 0); return m;
  }
  // Perfil en U (canal): abierto hacia arriba ('up') o hacia abajo ('down')
  function channelU(len, w, h, t, mat, o = {}) {
    let pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h], [w / 2 - t, h], [w / 2 - t, t], [-w / 2 + t, t], [-w / 2 + t, h], [-w / 2, h]];
    if (o.open === 'down') pts = pts.map(p => [p[0], h - p[1]]).reverse();
    const m = extrude(pts, len, mat, { bevel: t * 0.3 }); orient(m.geometry, o.axis || 'z'); m.position.set(o.x || 0, o.y || 0, o.z || 0); return m;
  }
  // Cilindro hidráulico vertical: agrega cuerpo al grupo y devuelve el vástago (moverlo con motion)
  function hydraulic(g, o = {}) {
    const r = o.r || 0.05, len = o.len || 0.3, rodLen = o.rodLen || len * 0.9, x = o.x || 0, y = o.y || 0, z = o.z || 0;
    g.add(cyl(r, len, o.bodyMat || M.paint(), x, y + len / 2, z, null, 40));
    g.add(cyl(r * 1.15, len * 0.06, M.dark(), x, y + len * 0.03, z, null, 40));
    g.add(cyl(r * 1.15, len * 0.06, M.dark(), x, y + len * 0.97, z, null, 40));
    const rod = cyl(r * 0.45, rodLen, o.rodMat || M.chrome(), x, y + len - rodLen * 0.4 + rodLen / 2, z, null, 28);
    if (o.addRod !== false) g.add(rod); return rod;
  }
  // Cadena vertical de n eslabones colgando desde y hacia abajo
  function chain(n, link, wire, mat, x = 0, y = 0, z = 0) {
    const g = new T.Group();
    for (let i = 0; i < n; i++) { const l = new T.Mesh(new T.TorusGeometry(link * 0.5, wire, 8, 20), mat); l.scale.set(0.6, 1, 1); l.position.y = -i * link * 0.78; l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); }
    g.position.set(x, y, z); return g;
  }
  // Gancho de izaje: tope del vástago en y
  function hook(size, mat, x = 0, y = 0, z = 0) {
    const g = new T.Group(), s = size;
    g.add(cyl(s * 0.12, s * 0.5, mat, 0, -s * 0.25, 0, null, 16));
    g.add(new T.Mesh(new T.TorusGeometry(s * 0.12, s * 0.07, 8, 16), mat)); g.children[1].position.y = 0.0;
    const arc = new T.Mesh(new T.TorusGeometry(s * 0.32, s * 0.11, 12, 32, Math.PI * 1.45), mat); arc.position.set(s * 0.0, -s * 0.82, 0); arc.rotation.z = Math.PI * 0.62; g.add(arc);
    const tip = new T.Mesh(new T.ConeGeometry(s * 0.11, s * 0.22, 12), mat); tip.position.set(s * 0.3, -s * 0.66, 0); g.add(tip);
    g.position.set(x, y, z); return g;
  }
  // Panel corrugado (paredes de contenedor): ancho w (x), alto h (y), costillas en x, profundidad en z
  function corrugated(w, h, ribs, depth, thick, mat, x = 0, y = 0, z = 0) {
    const p = w / ribs, top = [];
    for (let i = 0; i < ribs; i++) { const b = i * p; top.push([b, 0], [b + p * 0.18, 0], [b + p * 0.32, depth], [b + p * 0.68, depth], [b + p * 0.82, 0]); }
    top.push([w, 0]);
    const pts = top.concat(top.slice().reverse().map(q => [q[0], q[1] - thick]));
    const s = new T.Shape(); pts.forEach((q, i) => i ? s.lineTo(q[0] - w / 2, q[1]) : s.moveTo(q[0] - w / 2, q[1]));
    const g = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    return mesh(g, mat, x, y, z);
  }
  // Brazo pivotante: crea un grupo en pivot con rotación y construye dentro
  function arm(g, pivot, rot, build) { const a = new T.Group(); build(a); a.position.set(...pivot); a.rotation.set(...(rot || [0, 0, 0])); g.add(a); return a; }

  // Torno: perfil [[radio,y],...] girado alrededor del eje y
  function lathe(profile, mat, seg = 48) { const g = new T.LatheGeometry(profile.map(p => new T.Vector2(p[0], p[1])), seg); return new T.Mesh(g, mat); }
  // Llanta neumática con labrado, rin con tuercas; eje en X. o.side: 1 (rin hacia +x) o -1
  function tire(r, w, x = 0, y = 0, z = 0, o = {}) {
    const g = new T.Group(), inner = new T.Group(), hw = w / 2, rub = M.tire();
    const prof = [[r * 0.64, -hw * 0.92], [r * 0.8, -hw], [r * 0.93, -hw * 0.97], [r * 0.99, -hw * 0.8], [r, -hw * 0.5], [r, hw * 0.5], [r * 0.99, hw * 0.8], [r * 0.93, hw * 0.97], [r * 0.8, hw], [r * 0.64, hw * 0.92]];
    const t = lathe(prof, rub, 56); t.material.side = T.DoubleSide; inner.add(t);
    if (o.tread !== false) { const n = Math.round(2 * Math.PI * r / 0.06), bw = w * 0.36;
      const geo = new T.BoxGeometry(r * 0.07, bw, 2 * Math.PI * r / n * 0.55);
      for (let i = 0; i < n; i++) for (const k of [-1, 1]) { const a = (i + (k > 0 ? 0.5 : 0)) / n * Math.PI * 2;
        const b = new T.Mesh(geo, rub); b.position.set((r + r * 0.012) * Math.cos(a), k * w * 0.21, (r + r * 0.012) * Math.sin(a)); b.rotation.set(0, -a, 0); b.rotateX(k * 0.32); inner.add(b); } }
    const rm = M.rim(o.rimColor), rr = r * 0.64;
    inner.add(lathe([[0.001, hw * 0.34], [rr * 0.45, hw * 0.34], [rr * 0.55, hw * 0.2], [rr * 0.85, hw * 0.12], [rr * 0.95, hw * 0.5], [rr, hw * 0.62], [rr, -hw * 0.62], [rr * 0.95, -hw * 0.5], [rr * 0.6, -hw * 0.1], [0.001, -hw * 0.1]], rm, 40));
    const cap = new T.Mesh(new T.CylinderGeometry(rr * 0.22, rr * 0.26, hw * 0.25, 24), M.chrome()); cap.position.y = hw * 0.42; inner.add(cap);
    const lugs = o.lugs || 6; for (let i = 0; i < lugs; i++) { const a = i / lugs * Math.PI * 2; const l = new T.Mesh(new T.CylinderGeometry(rr * 0.055, rr * 0.055, hw * 0.16, 6), M.chrome());
      l.position.set(Math.cos(a) * rr * 0.36, hw * 0.4, Math.sin(a) * rr * 0.36); inner.add(l); }
    const side = o.side || (x < 0 ? -1 : 1); inner.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(inner);
    g.position.set(x, y, z); return g;
  }
  // Asiento acolchado mirando a +z; origen en la base
  function seat(w = 0.5, x = 0, y = 0, z = 0) {
    const g = new T.Group(), v = M.vinyl();
    g.add(rbox(w * 0.8, 0.06, w * 0.75, M.dark(), 0, 0.03, 0, 0.01));
    g.add(rbox(w, 0.11, w * 0.9, v, 0, 0.1, 0.02, 0.045));
    g.add(rbox(w * 0.82, 0.04, w * 0.7, v, 0, 0.165, 0.04, 0.02));
    [-1, 1].forEach(k => g.add(rbox(w * 0.14, 0.13, w * 0.86, v, k * w * 0.43, 0.13, 0.02, 0.05)));
    const back = new T.Group(); back.add(rbox(w, w * 1.0, 0.11, v, 0, w * 0.5, 0, 0.045)); back.add(rbox(w * 0.78, w * 0.8, 0.03, v, 0, w * 0.52, 0.055, 0.015));
    back.add(rbox(w * 0.5, w * 0.22, 0.09, v, 0, w * 1.12, 0, 0.04));
    back.position.set(0, 0.12, -w * 0.42); back.rotation.x = -0.18; g.add(back);
    g.position.set(x, y, z); return g;
  }
  // Volante con columna; el aro mira al operador (-z) e inclina 'tilt'
  function steering(r = 0.17, x = 0, y = 0, z = 0, tilt = 0.6, col = 0.45) {
    const g = new T.Group(), w = new T.Group(), rub = M.rubber();
    const ring = new T.Mesh(new T.TorusGeometry(r, r * 0.11, 14, 48), rub); ring.rotation.x = Math.PI / 2; w.add(ring);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2; const sp = rbox(r * 0.95, r * 0.07, r * 0.16, M.dark(), Math.cos(a) * r * 0.5, 0, Math.sin(a) * r * 0.5, r * 0.03); sp.rotation.y = -a; w.add(sp); }
    w.add(cyl(r * 0.22, r * 0.18, M.dark(), 0, 0, 0, null, 24));
    const knob = cyl(r * 0.09, r * 0.35, M.rubber(), r * 0.72, r * 0.17, r * 0.72, null, 16); w.add(knob);
    w.add(cyl(r * 0.12, col, M.dark(), 0, -col / 2, 0, null, 16));
    w.rotation.x = tilt; g.add(w); g.position.set(x, y, z); return g;
  }
  // Polea acanalada, eje en X
  function pulley(r, w, mat, x = 0, y = 0, z = 0) {
    const m = lathe([[0.001, -w / 2], [r, -w / 2], [r, -w * 0.3], [r * 0.78, 0], [r, w * 0.3], [r, w / 2], [0.001, w / 2]], mat || M.steel(), 32);
    m.rotation.z = Math.PI / 2; m.position.set(x, y, z); return m;
  }
  // Banco de baterías: celdas con bornes rojo/negro y puentes; origen en la base
  function battery(cols, rows, cw, ch, cd, x = 0, y = 0, z = 0) {
    const g = new T.Group(), W = cols * cw, D = rows * cd;
    g.add(rbox(W + 0.03, ch * 0.9, D + 0.03, M.dark(), 0, ch * 0.45, 0, 0.006));
    const red = M.color(0xc8261d, 0.2, 0.45), blk = M.color(0x15171a, 0.2, 0.5), cell = M.color(0x2f3439, 0.15, 0.55), top = M.color(0x3d434a, 0.1, 0.6);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const cx = -W / 2 + cw * (i + 0.5), cz = -D / 2 + cd * (j + 0.5);
      g.add(rbox(cw * 0.92, ch, cd * 0.92, cell, cx, ch / 2, cz, 0.006));
      g.add(rbox(cw * 0.8, 0.012, cd * 0.8, top, cx, ch + 0.004, cz, 0.004));
      g.add(cyl(cw * 0.09, 0.03, red, cx - cw * 0.25, ch + 0.02, cz, null, 14));
      g.add(cyl(cw * 0.09, 0.03, blk, cx + cw * 0.25, ch + 0.02, cz, null, 14));
      g.add(cyl(cw * 0.05, 0.016, M.color(0x8a8f94, 0.2, 0.5), cx, ch + 0.012, cz + cd * 0.22, null, 10));
      if (i < cols - 1) g.add(rbox(cw * 0.55, 0.008, cw * 0.1, M.brass(), cx + cw * 0.5, ch + 0.035, cz, 0.002));
    }
    g.position.set(x, y, z); return g;
  }
  // Faro de trabajo apuntando a +z
  function lamp(r, x = 0, y = 0, z = 0, color) {
    const g = new T.Group(); g.add(rbox(r * 2.4, r * 2, r * 1.4, M.dark(), 0, 0, 0, r * 0.3));
    const lens = cyl(r * 0.85, r * 0.12, M.lens(color), 0, 0, r * 0.72, 'z', 24); g.add(lens);
    g.add(cyl(r * 0.25, r * 0.8, M.dark(), 0, -r * 1.2, 0, null, 10));
    g.position.set(x, y, z); return g;
  }
  // Baliza giratoria ámbar
  function beacon(r, x = 0, y = 0, z = 0) {
    const g = new T.Group(); g.add(cyl(r * 1.1, r * 0.4, M.dark(), 0, r * 0.2, 0, null, 24));
    g.add(lathe([[0.001, r * 1.6], [r * 0.5, r * 1.55], [r * 0.85, r * 1.3], [r, r * 0.9], [r, r * 0.4]], M.beacon(), 32));
    g.position.set(x, y, z); return g;
  }
  // Cilindro hidráulico entre dos puntos (cuerpo + vástago + ojos)
  function ram(a, b, r, bodyMat) {
    const g = new T.Group(), A = new T.Vector3(...a), B = new T.Vector3(...b), m = A.clone().lerp(B, 0.62);
    g.add(cable(a, m.toArray(), r, bodyMat || M.paint()));
    g.add(cable(A.clone().lerp(B, 0.55).toArray(), b, r * 0.45, M.chrome()));
    [A, B].forEach(P => { const e = new T.Mesh(new T.SphereGeometry(r * 0.9, 16, 12), M.dark()); e.position.copy(P); g.add(e); });
    return g;
  }
  // Rejilla (respaldo de carga, barandas): marco + barras verticales, plano XY
  function grille(w, h, bars, r, mat, x = 0, y = 0, z = 0) {
    const g = new T.Group(); g.add(loop(w, h, r * 3, r, mat, 0, 0, 0));
    for (let i = 1; i < bars; i++) g.add(rbox(r * 2.2, h - r * 2, r * 1.6, mat, -w / 2 + w * i / bars, h / 2, 0, r * 0.5));
    g.add(rbox(w - r * 2, r * 2, r * 1.6, mat, 0, h * 0.5, 0, r * 0.5));
    g.position.set(x, y, z); return g;
  }

  return { THREE: T, M, mesh, lathe, tire, seat, steering, pulley, battery, lamp, beacon, ram, grille, rbox, cyl, wheel, extrude, tube, loop, helix, cable, beamI, channelU, hydraulic, chain, hook, corrugated, arm, orient };
}

/* ---------------- Montaje del visor ---------------- */
function mount(cfg) {
  const T = THREE, K = makeKit();
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"><style>' + CSS + (cfg.paint ? ':root{--paint:' + cfg.paint + '}' : '') + '</style>');
  const mo = cfg.motion;
  const root = document.createElement('div'); root.className = 'll-wrap';
  root.innerHTML = `
  <header class="ll-head"><div>
    <div class="ll-brand"><i></i>LogiLab SENA · ${esc(cfg.eyebrow || 'Equipos de manipulación de carga')}</div>
    <h1>${esc(cfg.title)} ${cfg.accent ? '<span>' + esc(cfg.accent) + '</span>' : ''}</h1>
    <p class="ll-lede">${esc(cfg.lede || 'Gira el modelo, desármalo y pasa el puntero por cada componente para ver su nombre y función. En celular, toca la pieza.')}</p>
  </div><div class="ll-specs">${(cfg.specs || []).map(s => `<div><b>${esc(s[0])}</b>${esc(s[1])}</div>`).join('')}</div></header>
  <div class="ll-grid">
    <section class="ll-stage labels-off">
      <canvas aria-label="Modelo 3D: ${esc(cfg.title)}"></canvas>
      <svg class="ll-overlay" aria-hidden="true"><g class="ll-leaders"></g><g class="ll-spot" style="display:none"><circle class="ring ll-pulse" r="7"></circle><circle class="core" r="3.5"></circle></g></svg>
      <div class="ll-labels"></div>
      <div class="ll-mode"><div class="ll-modetxt">Modo: Vista ensamblada</div><div>Análisis de componentes</div></div>
      <div class="ll-hint">Arrastra: girar · Rueda: zoom<br>Clic derecho: mover</div>
      <div class="ll-card ll-tip" role="status"></div>
      <div class="ll-controls">
        <div class="ll-ctl"><label for="ll-explode">Vista explosionada</label><input id="ll-explode" type="range" min="0" max="100" value="0"><output>0 %</output></div>
        ${mo ? `<div class="ll-ctl"><label for="ll-motion">${esc(mo.label)}</label><input id="ll-motion" type="range" min="0" max="100" value="0"><output></output></div>` : ''}
        <div class="ll-btns"><button class="primary" data-a="explode">Desarmar</button><button data-a="labels" aria-pressed="false">Etiquetas</button><button data-a="spin" aria-pressed="false">Girar solo</button><button data-a="reset">Reiniciar</button></div>
      </div>
    </section>
    <aside class="ll-aside"><h2>Lista de piezas <small></small></h2><ol class="ll-list"></ol>
      <div class="ll-detail"><div class="ref">Selecciona una pieza</div><h3>${esc((cfg.intro && cfg.intro.title) || cfg.title)}</h3><p>${esc((cfg.intro && cfg.intro.text) || '')}</p><div class="mat">Clic en una pieza para fijar su ficha</div></div>
    </aside>
  </div>
  <footer class="ll-foot">${cfg.portal ? `<a href="${esc(cfg.portal)}">← ${esc(cfg.portalText || 'Volver al portal LogiLab')}</a>` : ''}<span><b>LogiLab SENA</b> · Centro Industrial y de Energías Alternativas · Regional Guajira</span><span>By Carlos Barrios · Instructor</span></footer>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const canvas = $('canvas'), stage = $('.ll-stage'), tip = $('.ll-tip'), labelsEl = $('.ll-labels'), spot = $('.ll-spot'), leaders = $('.ll-leaders');

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  (function () { const pm = new T.PMREMGenerator(renderer), env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(20, 20, 20), new T.MeshBasicMaterial({ color: 0x0b1a2b, side: T.BackSide })));
    const panel = (w, h, c, x, y, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    panel(8, 3, 0xb8c4cc, 0, 8, 2); panel(4, 6, 0xcfe8ff, -9, 2, 0); panel(4, 6, 0x7fd8ff, 9, 2, -3); panel(6, 2, 0xffe6b0, 2, 3, 9);
    scene.environment = pm.fromScene(env, 0.03).texture; })();

  // Piezas
  const parts = [], pickables = [];
  (cfg.parts || []).forEach((def, idx) => {
    const g = new T.Group(); def.build(g, K); scene.add(g);
    let sw = def.sw;
    g.traverse(m => { if (m.isMesh) { if (!sw && m.material.color) sw = '#' + m.material.color.getHexString();
      m.castShadow = true; m.receiveShadow = true; m.material = m.material.clone(); m.material.color.convertSRGBToLinear();
      if (!m.material.emissive) m.material.emissive = new T.Color(0); else m.material.emissive.convertSRGBToLinear();
      m.userData.e0 = m.material.emissive.clone(); m.userData.ei0 = m.material.emissiveIntensity == null ? 1 : m.material.emissiveIntensity;
      m.userData.pid = parts.length; pickables.push(m); } });
    if (def.spread) g.children.forEach(c => { c.userData.x0 = c.position.x; });
    parts.push(Object.assign({}, def, { ref: def.ref || idx + 1, sw, group: g, base: g.position.clone(), ex: new T.Vector3(...(def.ex || [0, 0, 0])), mv: def.move ? new T.Vector3(...def.move) : null }));
  });

  // Encuadre automático
  const box = new T.Box3(); parts.forEach(p => box.expandByObject(p.group));
  const C = box.getCenter(new T.Vector3()), S = box.getSize(new T.Vector3()), R = Math.max(S.x, S.y, S.z) || 1;
  const camera = new T.PerspectiveCamera(36, 1, R * 0.02, R * 40);
  const HOME_TGT = cfg.camera && cfg.camera.target ? new T.Vector3(...cfg.camera.target) : new T.Vector3(C.x, C.y * 0.9, C.z);
  const HOME_POS = cfg.camera && cfg.camera.pos ? new T.Vector3(...cfg.camera.pos) : HOME_TGT.clone().add(new T.Vector3(0.62, 0.42, 0.68).normalize().multiplyScalar(R * 2.0));
  camera.position.copy(HOME_POS);
  const controls = new T.OrbitControls(camera, canvas); controls.target.copy(HOME_TGT); controls.enableDamping = true;
  controls.minDistance = R * 0.3; controls.maxDistance = R * 6; controls.maxPolarAngle = Math.PI * 0.495;

  scene.add(new T.HemisphereLight(0xbfe6ff, 0x0b1a2b, 0.45));
  const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(C.x + R * 1.1, R * 1.8, C.z + R * 0.9); key.target.position.copy(C); scene.add(key.target);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: R * 0.1, far: R * 6 }); key.shadow.bias = -0.0004; scene.add(key);
  const rim = new T.DirectionalLight(0x6fdcff, 0.9); rim.position.set(C.x - R * 1.2, R * 0.8, C.z - R * 1.2); scene.add(rim);

  // Piso holográfico
  (function () { const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    const gr = x.createRadialGradient(512, 512, 0, 512, 512, 512); gr.addColorStop(0, 'rgba(40,110,150,0.95)'); gr.addColorStop(0.5, 'rgba(18,58,88,0.75)'); gr.addColorStop(1, 'rgba(7,17,29,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i <= 32; i++) { const v = i * 32, major = i % 4 === 0; x.strokeStyle = major ? 'rgba(90,235,250,0.55)' : 'rgba(62,224,240,0.2)'; x.lineWidth = major ? 3 : 1.5;
      x.beginPath(); x.moveTo(v, 0); x.lineTo(v, 1024); x.stroke(); x.beginPath(); x.moveTo(0, v); x.lineTo(1024, v); x.stroke(); }
    x.globalCompositeOperation = 'destination-in'; const f = x.createRadialGradient(512, 512, 200, 512, 512, 505); f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = f; x.fillRect(0, 0, 1024, 1024);
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const size = R * 3.4;
    const fl = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(C.x, 0, C.z); fl.renderOrder = -1; scene.add(fl);
    const sh = new T.Mesh(new T.PlaneGeometry(size, size), new T.ShadowMaterial({ opacity: 0.5, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(C.x, R * 0.0005, C.z); sh.receiveShadow = true; scene.add(sh); })();

  // Lista, etiquetas
  const list = $('.ll-list'); $('.ll-aside h2 small').textContent = parts.length + ' ref.';
  parts.forEach((p, i) => {
    const li = document.createElement('li'); li.tabIndex = 0;
    li.innerHTML = `<span class="n">${pad(p.ref)}</span><span>${esc(p.name)}</span><span class="sw" style="background:${esc(p.sw)}"></span>`;
    li.addEventListener('mouseenter', () => setHover(i)); li.addEventListener('mouseleave', () => setHover(null));
    li.addEventListener('click', () => select(i)); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } });
    list.appendChild(li); p.li = li;
    const lb = document.createElement('div'); lb.className = 'll-card ll-lbl'; lb.innerHTML = `<span class="t">${esc(p.name)}</span>`; labelsEl.appendChild(lb); p.lbl = lb;
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); leaders.appendChild(ln); p.ln = ln;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '3'); dot.setAttribute('class', 'core'); leaders.appendChild(dot); p.dot = dot;
  });

  let hover = null, selected = null, hitLocal = null, hitPart = null;
  const HL = new T.Color(0x3ee0f0), BLACK = new T.Color(0);
  function paint() { parts.forEach((p, i) => { const on = i === hover || i === selected;
    p.group.traverse(m => { if (m.isMesh) { if (on) { m.material.emissive.copy(HL); m.material.emissiveIntensity = i === hover ? 0.42 : 0.28; } else { m.material.emissive.copy(m.userData.e0); m.material.emissiveIntensity = m.userData.ei0; } } });
    p.li.classList.toggle('on', on); }); }
  function setHover(i) { hover = i; paint(); }
  const detail = $('.ll-detail');
  function select(i) { selected = (selected === i) ? null : i; paint(); if (selected === null) return; const p = parts[i];
    detail.innerHTML = `<div class="ref">Ref. ${pad(p.ref)}</div><h3>${esc(p.name)}</h3><p>${esc(p.fn)}</p>${p.mat ? `<div class="mat">Material: ${esc(p.mat)}</div>` : ''}`;
    p.li.scrollIntoView({ block: 'nearest' }); }

  const ray = new T.Raycaster(), mouse = new T.Vector2();
  function pick(x, y) { const r = canvas.getBoundingClientRect(); mouse.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera); return ray.intersectObjects(pickables, false)[0] || null; }
  function showTip(h, cx, cy) { const id = h.object.userData.pid, p = parts[id], r = stage.getBoundingClientRect();
    hitPart = id; hitLocal = p.group.worldToLocal(h.point.clone());
    const first = String(p.fn || '').split('. ')[0].replace(/\.$/, '');
    tip.innerHTML = `<span class="r">REF. ${pad(p.ref)}</span><span class="t">${esc(p.name)}</span><span class="d">${esc(first)}.</span>`;
    let x = cx - r.left + 22, y = cy - r.top + 18; tip.classList.add('on');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > r.width - 8) x = cx - r.left - tw - 22; if (y + th > canvas.clientHeight - 8) y = cy - r.top - th - 18;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px'; }
  function hideTip() { tip.classList.remove('on'); hitPart = null; spot.style.display = 'none'; }
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || e.buttons) return; const h = pick(e.clientX, e.clientY);
    const id = h ? h.object.userData.pid : null; if (id !== hover) setHover(id);
    if (h) { showTip(h, e.clientX, e.clientY); canvas.style.cursor = 'pointer'; } else { hideTip(); canvas.style.cursor = ''; } });
  canvas.addEventListener('pointerleave', () => { setHover(null); hideTip(); });
  let down = null; canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; if (e.pointerType !== 'mouse') hideTip(); });
  canvas.addEventListener('pointerup', e => { if (!down) return; if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) { const h = pick(e.clientX, e.clientY);
    if (h) { select(h.object.userData.pid); if (e.pointerType !== 'mouse') { setHover(h.object.userData.pid); showTip(h, e.clientX, e.clientY); } }
    else if (e.pointerType !== 'mouse') { setHover(null); hideTip(); } } down = null; });

  // Controles
  const ex = $('#ll-explode'), exOut = ex.nextElementSibling, mIn = $('#ll-motion'), mOut = mIn && mIn.nextElementSibling;
  const modeTxt = $('.ll-modetxt'), btnEx = $('[data-a=explode]');
  let exT = 0, exV = 0, mV = 0, anim = null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmtMotion = t => { const v = mo.from + (mo.to - mo.from) * t; return (mo.decimals ? v.toFixed(mo.decimals) : Math.round(v)) + (mo.unit ? ' ' + mo.unit : ''); };
  function syncEx() { exOut.value = Math.round(exT * 100) + ' %'; btnEx.textContent = exT > 0.5 ? 'Armar' : 'Desarmar'; modeTxt.textContent = exT > 0.02 ? 'Modo: Vista explosionada' : 'Modo: Vista ensamblada'; }
  ex.addEventListener('input', () => { exT = ex.value / 100; anim = null; syncEx(); });
  if (mIn) { mOut.value = fmtMotion(0); mIn.addEventListener('input', () => { mOut.value = fmtMotion(mIn.value / 100); }); }
  btnEx.addEventListener('click', () => { anim = exT > 0.5 ? 0 : 1; if (reduce) { exT = anim; anim = null; } ex.value = Math.round(exT * 100); syncEx(); });
  const bL = $('[data-a=labels]'); bL.addEventListener('click', () => { const on = bL.getAttribute('aria-pressed') !== 'true'; bL.setAttribute('aria-pressed', on); stage.classList.toggle('labels-off', !on); });
  const bS = $('[data-a=spin]'); bS.addEventListener('click', () => { const on = bS.getAttribute('aria-pressed') !== 'true'; bS.setAttribute('aria-pressed', on); controls.autoRotate = on; controls.autoRotateSpeed = 1.1; });
  $('[data-a=reset]').addEventListener('click', () => { camera.position.copy(HOME_POS); controls.target.copy(HOME_TGT); exT = 0; ex.value = 0; anim = null; syncEx();
    if (mIn) { mIn.value = 0; mOut.value = fmtMotion(0); } selected = null; paint(); });

  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(canvas); resize();

  const tmp = new T.Vector3(), bb = new T.Box3();
  const toScreen = (v, w, h) => { v.project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h, v.z]; };
  function frame() { requestAnimationFrame(frame);
    if (anim !== null) { exT += (anim - exT) * 0.07; if (Math.abs(anim - exT) < 0.002) { exT = anim; anim = null; } ex.value = Math.round(exT * 100); syncEx(); }
    exV += (exT - exV) * (reduce ? 1 : 0.18);
    const mt = mIn ? mIn.value / 100 : 0; mV += (mt - mV) * (reduce ? 1 : 0.15);
    const e = exV * exV * (3 - 2 * exV);
    parts.forEach(p => { p.group.position.set(p.base.x + p.ex.x * e, p.base.y + p.ex.y * e, p.base.z + p.ex.z * e);
      if (p.mv) p.group.position.addScaledVector(p.mv, mV); if (p.motion) p.motion(p.group, mV, K);
      if (p.spread) p.group.children.forEach(c => { c.position.x = c.userData.x0 + Math.sign(c.userData.x0) * p.spread * e; }); });
    controls.update(); renderer.render(scene, camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (hitPart !== null) { const v = parts[hitPart].group.localToWorld(hitLocal.clone()); const [sx, sy] = toScreen(v, w, h); spot.style.display = ''; spot.setAttribute('transform', `translate(${sx},${sy})`); }
    if (!stage.classList.contains('labels-off')) { const cx = w / 2, cy = h * 0.45;
      parts.forEach(p => { bb.setFromObject(p.group); bb.getCenter(tmp); const [ax, ay, az] = toScreen(tmp, w, h);
        let dx = ax - cx, dy = ay - cy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const hw = (p.lbl.offsetWidth || 120) / 2 + 6; const lx = Math.min(w - hw, Math.max(hw, ax + dx * 80)), ly = Math.min(h - 20, Math.max(16, ay + dy * 55));
        p.lbl.hidden = az >= 1; p.lbl.style.left = lx + 'px'; p.lbl.style.top = ly + 'px';
        p.ln.setAttribute('x1', ax); p.ln.setAttribute('y1', ay); p.ln.setAttribute('x2', lx); p.ln.setAttribute('y2', ly);
        p.dot.setAttribute('cx', ax); p.dot.setAttribute('cy', ay); }); }
  }
  frame();
  return { scene, camera, parts, K };
}

// Convierte colores sRGB a lineales una sola vez por material (para escenas propias con K)
function linearize(root) {
  root.traverse(m => { if (!m.isMesh) return; (Array.isArray(m.material) ? m.material : [m.material]).forEach(mt => {
    if (!mt || mt.userData.lin) return; mt.userData.lin = true;
    if (mt.color) mt.color.convertSRGBToLinear(); if (mt.emissive) mt.emissive.convertSRGBToLinear(); }); });
  return root;
}
function safeMount(cfg) {
  if (!document.body) { document.addEventListener('DOMContentLoaded', () => mount(cfg)); return null; }
  return mount(cfg);
}
global.LogiLab3D = { mount: safeMount, kit: makeKit, linearize, version: '1.3' };
})(window);
