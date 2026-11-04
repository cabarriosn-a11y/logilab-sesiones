// LogiLab Notas · Cloudflare Worker
// By Carlos Barrios · Instructor
//
// Rutas públicas (las usan las actividades LogiLab):
//   POST /api/verificar  {documento, actividad}            -> {ok, nombre}
//   POST /api/entregar   {documento, actividad, contenido, puntaje?}
// Rutas privadas (Cloudflare Access + verificación JWT aquí mismo):
//   GET  /admin                     dashboard
//   /admin/api/*                    API del dashboard
//
// Variables (Settings → Variables) — NINGUNA va en GitHub:
//   ADMIN_EMAIL        correo único con acceso (texto)
//   ACCESS_TEAM        subdominio de Zero Trust, ej. "logilab" (de logilab.cloudflareaccess.com)
//   ACCESS_AUD         "Application Audience (AUD) Tag" de la app de Access  (secreto)
//   IP_SALT            texto aleatorio largo para anonimizar IPs             (secreto)
//   ALLOWED_ORIGINS    orígenes permitidos separados por coma
//   TURNSTILE_SECRET   opcional, activa anti-bots en entregas                (secreto)
// Binding D1: DB

const DASHBOARD_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"robots\" content=\"noindex,nofollow\">\n<title>LogiLab Notas</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap\" rel=\"stylesheet\">\n<style>\n:root{\n  --sena:#39A900; --sena-d:#2B7F00; --sena-l:#EAF6E1;\n  --bg:#F5F6F2; --card:#FFFFFF; --ink:#1B2118; --mut:#667062; --line:#E1E4DC;\n  --ok:#2E9E3F; --warn:#D99A00; --bad:#D2452E; --info:#2563EB; --pend:#94A08F;\n  --ok-bg:#E3F4E6; --warn-bg:#FDF2D6; --bad-bg:#FBE4DF; --info-bg:#E2EBFD;\n}\n@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){\n  --bg:#12150F; --card:#1B2017; --ink:#E9EDE5; --mut:#9AA494; --line:#2D3428; --sena-l:#1F2E16;\n  --ok-bg:#183020; --warn-bg:#352B10; --bad-bg:#3A1C17; --info-bg:#172440;}}\n:root[data-theme=\"dark\"]{--bg:#12150F; --card:#1B2017; --ink:#E9EDE5; --mut:#9AA494; --line:#2D3428; --sena-l:#1F2E16;\n  --ok-bg:#183020; --warn-bg:#352B10; --bad-bg:#3A1C17; --info-bg:#172440;}\n*{box-sizing:border-box}\nbody{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 \"Work Sans\",system-ui,sans-serif}\nbutton,select,input,textarea{font:inherit;color:inherit}\nheader{background:var(--sena);color:#fff;padding:12px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;position:sticky;top:0;z-index:5}\nheader h1{font-size:18px;margin:0;font-weight:700;letter-spacing:.2px}\nheader h1 small{font-weight:500;opacity:.85;margin-left:6px}\nheader select{background:#fff;color:#1B2118;border:0;border-radius:8px;padding:7px 10px;min-width:240px;max-width:100%}\nheader .sp{flex:1}\nheader .lock{font-size:12px;background:rgba(0,0,0,.18);padding:4px 10px;border-radius:99px}\nmain{max-width:1280px;margin:0 auto;padding:20px 16px 40px}\n.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:4px 0 18px;overflow-x:auto}\n.tabs button{background:none;border:0;padding:10px 14px;cursor:pointer;color:var(--mut);font-weight:600;border-bottom:3px solid transparent;white-space:nowrap}\n.tabs button.on{color:var(--sena-d);border-color:var(--sena)}\n@media (prefers-color-scheme:dark){.tabs button.on{color:var(--sena)}}\n.grid{display:grid;gap:14px}\n.k4{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}\n.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}\n.kpi .n{font-size:30px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}\n.kpi .l{color:var(--mut);font-size:13px}\nh2{font-size:16px;margin:0 0 12px}\nh3{font-size:14px;margin:0 0 8px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.5px}\n.gcard{cursor:pointer;transition:border-color .15s}\n.gcard:hover{border-color:var(--sena)}\n.badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;letter-spacing:.3px}\n.b-sena{background:var(--sena-l);color:var(--sena-d)} .b-u{background:var(--info-bg);color:var(--info)}\n.b-ok{background:var(--ok-bg);color:var(--ok)} .b-warn{background:var(--warn-bg);color:var(--warn)} .b-bad{background:var(--bad-bg);color:var(--bad)} .b-pend{background:var(--line);color:var(--mut)}\n.bar{height:8px;background:var(--line);border-radius:99px;overflow:hidden;display:flex}\n.bar i{display:block;height:100%}\n.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}\n.two{grid-template-columns:1fr 1fr} @media(max-width:800px){.two{grid-template-columns:1fr}}\n.tbl-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);max-height:72vh}\ntable{border-collapse:separate;border-spacing:0;width:100%;font-size:13.5px}\nth,td{padding:7px 9px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}\nthead th{position:sticky;top:0;background:var(--card);z-index:2;font-size:12px;color:var(--mut);vertical-align:bottom}\nthead th.act{writing-mode:vertical-rl;transform:rotate(180deg);height:150px;text-align:left;padding:8px 6px;max-width:34px;white-space:normal;line-height:1.15}\ntd.n0,th.n0{position:sticky;left:0;background:var(--card);z-index:1;min-width:220px}\nthead th.n0{z-index:3}\ntd.c{text-align:center;cursor:pointer;min-width:44px;font-family:\"JetBrains Mono\",monospace;font-weight:500;position:relative}\ntd.c:hover{outline:2px solid var(--sena);outline-offset:-2px}\n.v-ok{background:var(--ok-bg);color:var(--ok)} .v-bad{background:var(--bad-bg);color:var(--bad)} .v-mid{background:var(--warn-bg);color:var(--warn)}\n.dot{position:absolute;top:3px;right:3px;width:8px;height:8px;border-radius:50%;background:var(--info)}\ntr.inact td{opacity:.45}\n.sem{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}\n.btn{background:var(--sena);color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer}\n.btn:hover{background:var(--sena-d)}\n.btn.sec{background:transparent;color:var(--ink);border:1px solid var(--line)}\n.btn.sm{padding:4px 10px;font-size:13px}\ninput,select,textarea{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:7px 10px}\ntextarea{width:100%;min-height:160px;font-family:\"JetBrains Mono\",monospace;font-size:12.5px}\nlabel{font-size:13px;color:var(--mut);display:flex;flex-direction:column;gap:4px}\n.form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;align-items:end}\ncode{font-family:\"JetBrains Mono\",monospace;font-size:12.5px;background:var(--sena-l);padding:1px 6px;border-radius:5px}\n.mut{color:var(--mut)} .small{font-size:12.5px}\n.list li{padding:6px 0;border-bottom:1px dashed var(--line);display:flex;justify-content:space-between;gap:10px}\n.list{list-style:none;margin:0;padding:0}\ndialog{border:1px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);max-width:min(760px,94vw);width:100%;padding:0}\ndialog::backdrop{background:rgba(0,0,0,.45)}\ndialog .hd{padding:14px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}\ndialog .bd{padding:16px 18px;max-height:65vh;overflow:auto}\npre{white-space:pre-wrap;word-break:break-word;font-family:\"JetBrains Mono\",monospace;font-size:12.5px;background:var(--bg);padding:12px;border-radius:8px}\n.toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 18px;border-radius:10px;font-weight:600;opacity:0;transition:opacity .2s;pointer-events:none;z-index:50}\n.toast.on{opacity:1}\n.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--mut)}\n.filters{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;align-items:center}\nfooter{text-align:center;color:var(--mut);font-size:12.5px;padding:24px 16px}\n.empty{padding:40px;text-align:center;color:var(--mut)}\n</style>\n</head>\n<body>\n<header>\n  <h1>LogiLab Notas <small>Panel del docente</small></h1>\n  <select id=\"selGrupo\" aria-label=\"Grupo\"></select>\n  <span class=\"sp\"></span>\n  <span class=\"lock\">🔒 Solo tú · Cloudflare Access</span>\n</header>\n<main id=\"app\"><div class=\"empty\">Cargando…</div></main>\n<footer>LogiLab SENA · By Carlos Barrios · Instructor</footer>\n<dialog id=\"dlg\"><div class=\"hd\"><strong id=\"dlgT\"></strong><button class=\"btn sec sm\" onclick=\"dlg.close()\">Cerrar</button></div><div class=\"bd\" id=\"dlgB\"></div></dialog>\n<div class=\"toast\" id=\"toast\"></div>\n<script>\nconst API='/admin/api/';\nconst S={grupos:[],g:null,tab:'tablero',filtro:'',soloActivos:true,catFiltro:''};\nconst $=s=>document.querySelector(s);\nconst esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nconst hoy=new Date(Date.now()-5*3600e3).toISOString().slice(0,10);\nfunction toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2200)}\nasync function api(ruta,met='GET',body){\n  const r=await fetch(API+ruta,{method:met,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});\n  const j=await r.json().catch(()=>({ok:false,error:'Respuesta inválida ('+r.status+')'}));\n  if(!j.ok) throw new Error(j.error||'Error');\n  return j;\n}\n\n// ─────────── cálculo ───────────\nfunction idx(g){\n  const cal={},ent={};\n  g.calificaciones.forEach(c=>cal[c.actividad_id+'|'+c.estudiante_id]=c);\n  g.entregas.forEach(e=>ent[e.actividad_id+'|'+e.estudiante_id]=e);\n  g._cal=cal; g._ent=ent;\n  const conNota=new Set(g.calificaciones.map(c=>c.actividad_id));\n  g._evaluables=g.actividades.filter(a=>conNota.has(a.id)||(a.fecha&&a.fecha<=hoy));\n  g._activo=e=>!e.estado||/FORMACION/i.test(e.estado);\n  g.estudiantes.forEach(e=>e._r=resumen(g,e));\n}\nfunction aprueba(a,v){ if(v==null) return null; if(a.tipo==='AD') return v==='A'; if(a.tipo==='ASIS') return v==='SI'; return Number(v)>=3 }\nfunction resumen(g,e){\n  let ok=0,mal=0,pend=0,porCal=0;\n  for(const a of g._evaluables){\n    const c=g._cal[a.id+'|'+e.id], en=g._ent[a.id+'|'+e.id];\n    const r=aprueba(a,c?.valor);\n    if(r===true) ok++; else if(r===false) mal++; else { pend++; if(en) porCal++; }\n  }\n  const tot=g._evaluables.length, pct=tot?ok/tot:null;\n  let nota=null;\n  if(g.grupo.institucion==='UNIGUAJIRA'){\n    nota=0;\n    for(const cat of g.categorias){\n      let s=0; g.actividades.filter(a=>a.categoria_id===cat.id&&a.tipo==='NUM').forEach(a=>{const c=g._cal[a.id+'|'+e.id]; if(c) s+=Number(c.valor)*(a.peso/100)});\n      nota+=s*(cat.peso/100);\n    }\n    nota=Math.round(nota*100)/100;\n  }\n  const sem=pct==null?'pend':pct>=.8?'ok':pct>=.6?'warn':'bad';\n  return {ok,mal,pend,porCal,tot,pct,sem,nota};\n}\nconst semColor={ok:'var(--ok)',warn:'var(--warn)',bad:'var(--bad)',pend:'var(--pend)'};\nconst semTxt={ok:'Al día',warn:'Atención',bad:'En riesgo',pend:'Sin datos'};\n\n// ─────────── vistas ───────────\nasync function cargarGrupos(){\n  const j=await api('grupos'); S.grupos=j.grupos;\n  $('#selGrupo').innerHTML='<option value=\"\">— Todos los grupos —</option>'+S.grupos.map(g=>`<option value=\"${g.id}\">${g.institucion==='SENA'?'Ficha ':''}${esc(g.codigo)} · ${esc(g.nombre)}</option>`).join('');\n}\nfunction vistaInicio(){\n  S.g=null; $('#selGrupo').value='';\n  const tot=S.grupos.reduce((a,g)=>a+g.n_est,0), pc=S.grupos.reduce((a,g)=>a+g.por_calificar,0);\n  $('#app').innerHTML=`\n  <div class=\"grid k4\" style=\"margin-bottom:18px\">\n    <div class=\"card kpi\"><div class=\"n\">${S.grupos.length}</div><div class=\"l\">Grupos y fichas</div></div>\n    <div class=\"card kpi\"><div class=\"n\">${tot}</div><div class=\"l\">Estudiantes y aprendices</div></div>\n    <div class=\"card kpi\"><div class=\"n\" style=\"color:${pc?'var(--info)':'inherit'}\">${pc}</div><div class=\"l\">Entregas por calificar</div></div>\n  </div>\n  <div class=\"grid k4\">${S.grupos.map(g=>`\n    <div class=\"card gcard\" onclick=\"abrir(${g.id})\">\n      <div class=\"row\" style=\"justify-content:space-between\"><span class=\"badge ${g.institucion==='SENA'?'b-sena':'b-u'}\">${g.institucion==='SENA'?'SENA · FICHA':'UNIGUAJIRA'}</span>${g.por_calificar?`<span class=\"badge\" style=\"background:var(--info-bg);color:var(--info)\">${g.por_calificar} por calificar</span>`:''}</div>\n      <div style=\"font-size:20px;font-weight:700;margin-top:8px\">${esc(g.codigo)}</div>\n      <div>${esc(g.nombre)}</div>\n      <div class=\"mut small\" style=\"margin-top:6px\">${g.n_est} estudiantes · ${g.n_act} actividades</div>\n    </div>`).join('')}\n    <div class=\"card gcard\" onclick=\"vistaImportar()\" style=\"border-style:dashed;display:flex;align-items:center;justify-content:center;min-height:130px;color:var(--mut);font-weight:600\">＋ Agregar ficha o grupo</div>\n  </div>`;\n}\nasync function abrir(id,tab){\n  const j=await api('grupo/'+id); S.g=j; idx(S.g); if(tab) S.tab=tab;\n  $('#selGrupo').value=String(id); render();\n}\nfunction render(){\n  const g=S.g, esU=g.grupo.institucion==='UNIGUAJIRA';\n  const tabs=[['tablero','Tablero'],['planilla','Planilla de notas'],['actividades','Actividades'],['config',esU?'Cortes':'Competencias']];\n  $('#app').innerHTML=`\n   <div class=\"row\" style=\"justify-content:space-between\">\n     <div><span class=\"badge ${esU?'b-u':'b-sena'}\">${esU?'UNIGUAJIRA':'SENA · FICHA'}</span>\n       <div style=\"font-size:22px;font-weight:700\">${esc(g.grupo.codigo)} · ${esc(g.grupo.nombre)}</div></div>\n     <div class=\"row\"><button class=\"btn sec sm\" onclick=\"exportar()\">⬇ Exportar CSV</button><button class=\"btn sec sm\" onclick=\"abrir(${g.grupo.id})\">↻ Actualizar</button></div>\n   </div>\n   <div class=\"tabs\">${tabs.map(([k,t])=>`<button class=\"${S.tab===k?'on':''}\" onclick=\"S.tab='${k}';render()\">${t}</button>`).join('')}</div>\n   <div id=\"vista\"></div>`;\n  ({tablero:vTablero,planilla:vPlanilla,actividades:vActividades,config:vConfig})[S.tab]();\n}\nfunction vTablero(){\n  const g=S.g, act=g.estudiantes.filter(g._activo), esU=g.grupo.institucion==='UNIGUAJIRA';\n  const cnt={ok:0,warn:0,bad:0,pend:0}; act.forEach(e=>cnt[e._r.sem]++);\n  const porCal=g.estudiantes.reduce((a,e)=>a+e._r.porCal,0);\n  const prom=act.length&&g._evaluables.length?act.reduce((a,e)=>a+(e._r.pct||0),0)/act.length:0;\n  const riesgo=act.filter(e=>e._r.sem==='bad'||e._r.sem==='warn').sort((a,b)=>(a._r.pct??1)-(b._r.pct??1));\n  const porAct=g._evaluables.map(a=>{let ok=0,mal=0,ent=0;act.forEach(e=>{const r=aprueba(a,g._cal[a.id+'|'+e.id]?.valor);if(r===true)ok++;else if(r===false)mal++;else if(g._ent[a.id+'|'+e.id])ent++});return{a,ok,mal,ent,sin:act.length-ok-mal-ent}});\n  const pendEnt=[]; g.entregas.forEach(en=>{if(!g._cal[en.actividad_id+'|'+en.estudiante_id]) pendEnt.push(en)});\n  const nomE=id=>{const e=g.estudiantes.find(x=>x.id===id);return e?e.nombres.split(' ')[0]+' '+e.apellidos.split(' ')[0]:'?'};\n  const nomA=id=>g.actividades.find(x=>x.id===id)?.nombre||'?';\n  $('#vista').innerHTML=`\n  <div class=\"grid k4\" style=\"margin-bottom:14px\">\n    <div class=\"card kpi\"><div class=\"n\">${act.length}<span class=\"mut\" style=\"font-size:15px;font-weight:500\"> / ${g.estudiantes.length}</span></div><div class=\"l\">${esU?'Estudiantes':'Aprendices en formación'}</div></div>\n    <div class=\"card kpi\"><div class=\"n\">${Math.round(prom*100)}%</div><div class=\"l\">Cumplimiento promedio</div></div>\n    <div class=\"card kpi\"><div class=\"n\" style=\"color:var(--bad)\">${cnt.bad}</div><div class=\"l\">En riesgo (&lt; 60 %)</div></div>\n    <div class=\"card kpi\"><div class=\"n\" style=\"color:var(--info)\">${porCal}</div><div class=\"l\">Entregas por calificar</div></div>\n  </div>\n  <div class=\"grid two\">\n    <div class=\"card\"><h2>Semáforo del grupo</h2>\n      <div class=\"bar\" style=\"height:16px;margin-bottom:10px\">${['ok','warn','bad','pend'].map(k=>`<i style=\"width:${act.length?cnt[k]/act.length*100:0}%;background:${semColor[k]}\"></i>`).join('')}</div>\n      <div class=\"legend\">${['ok','warn','bad','pend'].map(k=>`<span><span class=\"sem\" style=\"background:${semColor[k]}\"></span>${semTxt[k]}: <b>${cnt[k]}</b></span>`).join('')}</div>\n      <p class=\"mut small\" style=\"margin:10px 0 0\">Al día ≥ 80 % de actividades aprobadas · Atención 60–79 % · En riesgo &lt; 60 %. Cuenta solo actividades con fecha cumplida o con alguna nota.</p>\n    </div>\n    <div class=\"card\"><h2>Necesitan seguimiento</h2>\n      ${riesgo.length?`<ul class=\"list\">${riesgo.slice(0,10).map(e=>`<li><span><span class=\"sem\" style=\"background:${semColor[e._r.sem]}\"></span>${esc(e.nombres)} ${esc(e.apellidos)}</span><span class=\"mut small\">${e._r.ok}/${e._r.tot} · faltan ${e._r.pend}</span></li>`).join('')}</ul>`:'<p class=\"mut\">Nadie en riesgo por ahora. 👏</p>'}\n    </div>\n  </div>\n  <div class=\"card\" style=\"margin-top:14px\"><h2>Avance por actividad</h2>\n    ${porAct.length?porAct.map(x=>`<div style=\"margin:10px 0\">\n      <div class=\"row\" style=\"justify-content:space-between\"><span>${esc(x.a.nombre)} ${x.a.abierta?'<span class=\"badge b-ok\">abierta</span>':''}</span><span class=\"mut small\">${x.ok} aprobados · ${x.mal} no aprobados · ${x.ent} por calificar · ${x.sin} sin entregar</span></div>\n      <div class=\"bar\">${[[x.ok,'var(--ok)'],[x.mal,'var(--bad)'],[x.ent,'var(--info)'],[x.sin,'var(--line)']].map(([n,c])=>`<i style=\"width:${act.length?n/act.length*100:0}%;background:${c}\"></i>`).join('')}</div></div>`).join(''):'<p class=\"mut\">Aún no hay actividades evaluables.</p>'}\n  </div>\n  <div class=\"card\" style=\"margin-top:14px\"><h2>Últimas entregas sin calificar</h2>\n    ${pendEnt.length?`<ul class=\"list\">${pendEnt.sort((a,b)=>b.ultima.localeCompare(a.ultima)).slice(0,15).map(en=>`<li><span>${esc(nomE(en.estudiante_id))} — ${esc(nomA(en.actividad_id))}</span><span><span class=\"mut small\">${esc(en.ultima)} UTC</span> <button class=\"btn sec sm\" onclick=\"verEntrega(${en.ultima_id},${en.actividad_id},${en.estudiante_id})\">Ver y calificar</button></span></li>`).join('')}</ul>`:'<p class=\"mut\">Todo calificado.</p>'}\n  </div>`;\n}\nfunction claseValor(a,v){const r=aprueba(a,v); if(r===true) return 'v-ok'; if(r===false) return a.tipo==='NUM'&&Number(v)>=2.5?'v-mid':'v-bad'; return ''}\nfunction vPlanilla(){\n  const g=S.g, esU=g.grupo.institucion==='UNIGUAJIRA';\n  let acts=g.actividades; if(S.catFiltro) acts=acts.filter(a=>String(a.categoria_id)===S.catFiltro);\n  let est=g.estudiantes; if(S.soloActivos) est=est.filter(g._activo);\n  if(S.filtro){const f=S.filtro.toLowerCase(); est=est.filter(e=>(e.nombres+' '+e.apellidos+' '+e.documento).toLowerCase().includes(f))}\n  $('#vista').innerHTML=`\n  <div class=\"filters\">\n    <input placeholder=\"Buscar nombre o documento\" value=\"${esc(S.filtro)}\" oninput=\"S.filtro=this.value;vPlanilla();this.focus();this.setSelectionRange(this.value.length,this.value.length)\" style=\"min-width:240px\">\n    <select onchange=\"S.catFiltro=this.value;vPlanilla()\"><option value=\"\">${esU?'Todos los cortes':'Todas las competencias'}</option>${g.categorias.map(c=>`<option value=\"${c.id}\" ${S.catFiltro==c.id?'selected':''}>${esc(c.nombre)}</option>`).join('')}</select>\n    <label style=\"flex-direction:row;align-items:center;gap:6px\"><input type=\"checkbox\" ${S.soloActivos?'checked':''} onchange=\"S.soloActivos=this.checked;vPlanilla()\"> Solo en formación</label>\n    <span class=\"legend\"><span><span class=\"sem\" style=\"background:var(--info)\"></span>Entregó por LogiLab</span><span>Clic en una celda para calificar</span></span>\n  </div>\n  <div class=\"tbl-wrap\"><table>\n   <thead><tr><th class=\"n0\">Estudiante</th><th>Estado</th>${acts.map(a=>`<th class=\"act\" title=\"${esc(a.codigo)}\">${esc(a.nombre)}</th>`).join('')}<th>Avance</th>${esU?'<th>Acumulada</th>':''}</tr></thead>\n   <tbody>${est.map(e=>`<tr class=\"${g._activo(e)?'':'inact'}\">\n     <td class=\"n0\"><span class=\"sem\" style=\"background:${semColor[e._r.sem]}\"></span><b>${esc(e.apellidos)}</b> ${esc(e.nombres)}<div class=\"mut small\">${esc(e.tipo_doc||'')} ${esc(e.documento)}</div></td>\n     <td class=\"small mut\">${esc(e.estado||'')}</td>\n     ${acts.map(a=>{const c=g._cal[a.id+'|'+e.id],en=g._ent[a.id+'|'+e.id];return `<td class=\"c ${claseValor(a,c?.valor)}\" onclick=\"editar(${a.id},${e.id})\" title=\"${en?'Entregas: '+en.n:''}\">${c?esc(c.valor):'·'}${en&&!c?'<span class=\"dot\"></span>':''}</td>`}).join('')}\n     <td><div class=\"bar\" style=\"width:90px\"><i style=\"width:${(e._r.pct||0)*100}%;background:${semColor[e._r.sem]}\"></i></div><span class=\"small mut\">${e._r.ok}/${e._r.tot}</span></td>\n     ${esU?`<td><b>${e._r.nota.toFixed(2)}</b></td>`:''}\n   </tr>`).join('')}</tbody></table></div>`;\n}\nfunction editar(aid,eid){\n  const g=S.g,a=g.actividades.find(x=>x.id===aid),e=g.estudiantes.find(x=>x.id===eid),c=g._cal[aid+'|'+eid],en=g._ent[aid+'|'+eid];\n  const ops=a.tipo==='AD'?[['A','A · Aprobado'],['D','D · Deficiente']]:a.tipo==='ASIS'?[['SI','Asistió'],['NO','No asistió']]:null;\n  $('#dlgT').textContent=`${e.nombres} ${e.apellidos}`;\n  $('#dlgB').innerHTML=`<p><b>${esc(a.nombre)}</b> <span class=\"mut small\">(${a.tipo==='AD'?'Juicio A/D':a.tipo==='ASIS'?'Asistencia':'Nota 0 – 5'})</span></p>\n   ${en?`<p><span class=\"badge\" style=\"background:var(--info-bg);color:var(--info)\">${en.n} entrega(s) por LogiLab</span> ${en.puntaje!=null?`<span class=\"mut small\">Puntaje automático: ${en.puntaje}</span>`:''} <button class=\"btn sec sm\" onclick=\"verEntrega(${en.ultima_id},${aid},${eid})\">Ver contenido</button></p>`:''}\n   <div class=\"row\" style=\"margin:10px 0\">${ops?ops.map(([v,t])=>`<button class=\"btn ${c?.valor===v?'':'sec'}\" onclick=\"guardar(${aid},${eid},'${v}')\">${t}</button>`).join(''):`<input id=\"nNum\" type=\"number\" min=\"0\" max=\"5\" step=\"0.1\" value=\"${c?esc(c.valor):''}\" style=\"width:110px\"><button class=\"btn\" onclick=\"guardar(${aid},${eid},document.getElementById('nNum').value)\">Guardar</button>`}\n   ${c?`<button class=\"btn sec\" onclick=\"guardar(${aid},${eid},'')\">Borrar nota</button>`:''}</div>\n   <label>Observación (opcional)<input id=\"nObs\" value=\"${esc(c?.observacion||'')}\" maxlength=\"500\"></label>`;\n  dlg.showModal();\n}\nasync function guardar(aid,eid,v){\n  try{\n    const obs=document.getElementById('nObs')?.value||null;\n    await api('nota','PUT',{actividad_id:aid,estudiante_id:eid,valor:v,observacion:obs});\n    const k=aid+'|'+eid;\n    if(v==='') S.g.calificaciones=S.g.calificaciones.filter(c=>c.actividad_id+'|'+c.estudiante_id!==k);\n    else { const c=S.g._cal[k]; if(c){c.valor=String(v).toUpperCase();c.observacion=obs} else S.g.calificaciones.push({actividad_id:aid,estudiante_id:eid,valor:String(v).toUpperCase(),observacion:obs}) }\n    idx(S.g); dlg.close(); render(); toast('Nota guardada ✓');\n  }catch(e){toast('⚠ '+e.message)}\n}\nasync function verEntrega(id,aid,eid){\n  try{\n    const {entrega:x}=await api('entrega/'+id);\n    let cont=x.contenido; try{cont=JSON.stringify(JSON.parse(cont),null,2)}catch{}\n    $('#dlgT').textContent=`Entrega LL-${x.id} · ${x.nombres} ${x.apellidos}`;\n    $('#dlgB').innerHTML=`<p><b>${esc(x.actividad)}</b><br><span class=\"mut small\">${esc(x.creado)} UTC · desde ${esc(x.origen||'—')}${x.puntaje_auto!=null?' · puntaje automático '+x.puntaje_auto:''}</span></p>\n      <pre>${esc(cont||'(sin contenido)')}</pre>\n      <button class=\"btn\" onclick=\"editar(${aid},${eid})\">Calificar →</button>`;\n    if(!dlg.open) dlg.showModal();\n  }catch(e){toast('⚠ '+e.message)}\n}\nfunction vActividades(){\n  const g=S.g, esU=g.grupo.institucion==='UNIGUAJIRA';\n  const base=(g.grupo.institucion==='SENA'?'F':'U')+g.grupo.codigo.replace(/[^A-Z0-9]/gi,'').toUpperCase()+'-';\n  $('#vista').innerHTML=`\n  <div class=\"card\" style=\"margin-bottom:14px\"><h2>Nueva actividad</h2>\n    <div class=\"form\">\n      <label>Nombre<input id=\"aN\" placeholder=\"Taller de Excel 2\"></label>\n      <label>Código para LogiLab<input id=\"aC\" value=\"${base}\" style=\"text-transform:uppercase\"></label>\n      <label>${esU?'Corte':'Competencia'}<select id=\"aK\">${g.categorias.map(c=>`<option value=\"${c.id}\">${esc(c.nombre)}</option>`).join('')}</select></label>\n      <label>Tipo<select id=\"aT\"><option value=\"${esU?'NUM':'AD'}\">${esU?'Nota 0 – 5':'Juicio A / D'}</option><option value=\"${esU?'AD':'NUM'}\">${esU?'Juicio A / D':'Nota 0 – 5'}</option><option value=\"ASIS\">Asistencia</option></select></label>\n      ${esU?'<label>% dentro del corte<input id=\"aP\" type=\"number\" min=\"0\" max=\"100\" value=\"0\"></label>':''}\n      <label>Fecha<input id=\"aF\" type=\"date\"></label>\n      <label style=\"flex-direction:row;align-items:center;gap:6px\"><input id=\"aA\" type=\"checkbox\" checked> Recibe entregas</label>\n      <button class=\"btn\" onclick=\"crearAct()\">Crear</button>\n    </div></div>\n  <div class=\"tbl-wrap\"><table><thead><tr><th>Actividad</th><th>Código LogiLab</th><th>${esU?'Corte':'Competencia'}</th><th>Tipo</th>${esU?'<th>%</th>':''}<th>Fecha</th><th>Entregas</th><th></th></tr></thead>\n  <tbody>${g.actividades.map(a=>`<tr><td>${esc(a.nombre)}</td><td><code>${esc(a.codigo)}</code> <button class=\"btn sec sm\" onclick=\"copiar('${esc(a.codigo)}')\">Copiar</button></td>\n    <td><select onchange=\"patchAct(${a.id},{categoria_id:Number(this.value)})\">${g.categorias.map(c=>`<option value=\"${c.id}\" ${c.id===a.categoria_id?'selected':''}>${esc(c.nombre)}</option>`).join('')}</select></td>\n    <td>${a.tipo}</td>${esU?`<td><input type=\"number\" value=\"${a.peso}\" style=\"width:70px\" onchange=\"patchAct(${a.id},{peso:Number(this.value)})\"></td>`:''}\n    <td><input type=\"date\" value=\"${a.fecha||''}\" onchange=\"patchAct(${a.id},{fecha:this.value})\"></td>\n    <td>${a.abierta?'<span class=\"badge b-ok\">abierta</span>':'<span class=\"badge b-pend\">cerrada</span>'}</td>\n    <td><button class=\"btn sec sm\" onclick=\"patchAct(${a.id},{abierta:${a.abierta?0:1}})\">${a.abierta?'Cerrar':'Abrir'}</button></td></tr>`).join('')}</tbody></table></div>\n  <p class=\"mut small\">En la actividad HTML de LogiLab usa: <code>LogiLabEntregas.enviar({ actividad: 'CÓDIGO', contenido: {...}, puntaje: 85 })</code></p>`;\n}\nasync function crearAct(){\n  const v=id=>document.getElementById(id);\n  try{\n    await api('actividad','POST',{grupo_id:S.g.grupo.id,nombre:v('aN').value.trim(),codigo:v('aC').value.trim(),categoria_id:Number(v('aK').value),tipo:v('aT').value,peso:v('aP')?Number(v('aP').value):0,fecha:v('aF').value||null,abierta:v('aA').checked});\n    toast('Actividad creada ✓'); abrir(S.g.grupo.id);\n  }catch(e){toast('⚠ '+e.message)}\n}\nasync function patchAct(id,cambios){try{await api('actividad/'+id,'PATCH',cambios);toast('Guardado ✓');abrir(S.g.grupo.id)}catch(e){toast('⚠ '+e.message)}}\nfunction vConfig(){\n  const g=S.g, esU=g.grupo.institucion==='UNIGUAJIRA';\n  const suma=g.categorias.reduce((a,c)=>a+c.peso,0);\n  $('#vista').innerHTML=`<div class=\"card\"><h2>${esU?'Cortes y porcentajes':'Competencias de la ficha'}</h2>\n   ${esU&&suma!==100?`<p class=\"badge b-warn\">Los cortes suman ${suma} %, deberían sumar 100 %</p>`:''}\n   <ul class=\"list\">${g.categorias.map(c=>`<li><input value=\"${esc(c.nombre)}\" style=\"flex:1\" onchange=\"patchCat(${c.id},{nombre:this.value})\">${esU?`<span><input type=\"number\" value=\"${c.peso}\" style=\"width:80px\" onchange=\"patchCat(${c.id},{peso:Number(this.value)})\"> %</span>`:''}</li>`).join('')}</ul>\n   <div class=\"form\" style=\"margin-top:12px\"><label>${esU?'Nuevo corte':'Nueva competencia (código y nombre)'}<input id=\"cN\" placeholder=\"${esU?'Corte 4':'220201501 · Ciencias naturales'}\"></label>${esU?'<label>%<input id=\"cP\" type=\"number\" value=\"0\"></label>':''}<button class=\"btn\" onclick=\"crearCat()\">Agregar</button></div></div>`;\n}\nasync function crearCat(){try{await api('categoria','POST',{grupo_id:S.g.grupo.id,nombre:document.getElementById('cN').value,peso:Number(document.getElementById('cP')?.value||0),orden:S.g.categorias.length+1});abrir(S.g.grupo.id)}catch(e){toast('⚠ '+e.message)}}\nasync function patchCat(id,c){try{await api('categoria/'+id,'PATCH',c);toast('Guardado ✓');abrir(S.g.grupo.id)}catch(e){toast('⚠ '+e.message)}}\nfunction vistaImportar(){\n  S.g=null;\n  $('#app').innerHTML=`<div class=\"card\" style=\"max-width:820px;margin:0 auto\"><h2>Agregar ficha o grupo</h2>\n   <div class=\"form\"><label>Institución<select id=\"iI\"><option value=\"SENA\">SENA</option><option value=\"UNIGUAJIRA\">Uniguajira</option></select></label>\n   <label>Ficha / código del grupo<input id=\"iC\" placeholder=\"3410084 o 732235-A1\"></label>\n   <label>Nombre<input id=\"iN\" placeholder=\"Gestión Documental\"></label><label>Periodo<input id=\"iP\" placeholder=\"2026-2\"></label></div>\n   <p class=\"mut small\" style=\"margin-top:14px\">Pega desde Excel las columnas <b>Tipo doc · Documento · Nombres · Apellidos · Estado</b> (el reporte de Sofía Plus sirve tal cual: copia desde la fila de encabezados). No pegues celulares ni correos: no se guardan.</p>\n   <textarea id=\"iT\" placeholder=\"CC\t1119393303\tANGEL GABRIEL\tGOMEZ PALACIO\tEN FORMACION\"></textarea>\n   <div class=\"row\" style=\"margin-top:10px\"><button class=\"btn\" onclick=\"importar()\">Importar</button><span id=\"iR\" class=\"mut small\"></span></div></div>`;\n}\nasync function importar(){\n  const v=id=>document.getElementById(id).value;\n  const filas=v('iT').split(/\\r?\\n/).map(l=>l.split('\\t').map(s=>s.trim())).filter(f=>f.length>=3&&/\\d{5,}/.test(f[1]||''));\n  // Detecta reporte Sofía Plus: TipoDoc, Doc, Nombre, Apellidos, Celular, Correo, Estado\n  const est=filas.map(f=>f.length>=7?{tipo_doc:f[0],documento:f[1],nombres:f[2],apellidos:f[3],estado:f[6]}:{tipo_doc:f[0],documento:f[1],nombres:f[2],apellidos:f[3]||'',estado:f[4]||null});\n  try{const r=await api('importar','POST',{grupo:{institucion:v('iI'),codigo:v('iC'),nombre:v('iN'),periodo:v('iP')},estudiantes:est});\n    toast(r.importados+' importados ✓'); await cargarGrupos(); abrir(r.grupo_id,'tablero');\n  }catch(e){document.getElementById('iR').textContent='⚠ '+e.message}\n}\nfunction copiar(t){navigator.clipboard?.writeText(t).then(()=>toast('Copiado: '+t))}\nfunction exportar(){\n  const g=S.g, esU=g.grupo.institucion==='UNIGUAJIRA';\n  const head=['Tipo doc','Documento','Apellidos','Nombres','Estado',...g.actividades.map(a=>a.nombre),'Aprobadas','Evaluables',esU?'Acumulada':'Semáforo'];\n  const filas=g.estudiantes.map(e=>[e.tipo_doc,e.documento,e.apellidos,e.nombres,e.estado,...g.actividades.map(a=>g._cal[a.id+'|'+e.id]?.valor||''),e._r.ok,e._r.tot,esU?e._r.nota:semTxt[e._r.sem]]);\n  const csv='﻿'+[head,...filas].map(r=>r.map(x=>{x=String(x??'');return /[;\"\\n]/.test(x)?'\"'+x.replace(/\"/g,'\"\"')+'\"':x}).join(';')).join('\\r\\n');\n  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`notas_${g.grupo.codigo}_${hoy}.csv`;a.click();\n}\n$('#selGrupo').onchange=e=>e.target.value?abrir(Number(e.target.value),'tablero'):vistaInicio();\nconst dlg=document.getElementById('dlg');\n(async()=>{try{await cargarGrupos(); S.grupos.length===1?abrir(S.grupos[0].id,'tablero'):vistaInicio()}catch(e){$('#app').innerHTML='<div class=\"empty\">⚠ '+esc(e.message)+'</div>'}})();\n</script>\n</body>\n</html>\n";

const MAX_CONTENIDO = 64 * 1024;
const LIM_VERIFICAR = 30;  // por IP cada 10 min
const LIM_ENTREGAR = 15;   // por IP cada 10 min

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p.startsWith('/api/')) return await publica(req, env, p);
      if (p === '/admin' || p === '/admin/' || p.startsWith('/admin/')) {
        const quien = await verificarAdmin(req, env);
        if (!quien) return new Response('Acceso denegado', { status: 403, headers: seg() });
        if (p === '/admin' || p === '/admin/') {
          return new Response(DASHBOARD_HTML, { headers: { ...seg(), 'content-type': 'text/html; charset=utf-8',
            'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'" } });
        }
        if (p.startsWith('/admin/api/')) return await admin(req, env, p.slice('/admin/api/'.length), url, quien);
      }
      if (p === '/') return new Response('LogiLab Notas · OK', { headers: seg() });
      return new Response('No encontrado', { status: 404, headers: seg() });
    } catch (e) {
      console.error(e);
      return json({ ok: false, error: 'Error interno' }, 500);
    }
  }
};

// ───────────────────────── utilidades ─────────────────────────
function seg() {
  return { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'cache-control': 'no-store' };
}
function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { ...seg(), 'content-type': 'application/json; charset=utf-8', ...extra } });
}
function cors(req, env) {
  const origin = req.headers.get('origin') || '';
  const permitidos = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && permitidos.includes(origin)) {
    return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' };
  }
  return {};
}
async function sha256(txt) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const limpiaDoc = d => String(d || '').replace(/\D/g, '').slice(0, 15);
const limpiaCod = c => String(c || '').trim().toUpperCase().slice(0, 60);

async function limitar(env, ipHash, tipo, max) {
  const r = await env.DB.prepare("SELECT COUNT(*) n FROM intentos WHERE ip_hash=? AND tipo=? AND creado > datetime('now','-10 minutes')")
    .bind(ipHash, tipo).first();
  if (r.n >= max) return false;
  await env.DB.prepare('INSERT INTO intentos(ip_hash,tipo) VALUES (?,?)').bind(ipHash, tipo).run();
  // limpieza ocasional
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM intentos WHERE creado < datetime('now','-1 day')").run();
  return true;
}

// ───────────────────────── rutas públicas ─────────────────────────
async function publica(req, env, p) {
  const h = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405, h);
  if (!h['access-control-allow-origin'] && req.headers.get('origin')) return json({ ok: false, error: 'Origen no permitido' }, 403);

  let body;
  try {
    const txt = await req.text();
    if (txt.length > MAX_CONTENIDO + 4096) return json({ ok: false, error: 'Entrega demasiado grande' }, 413, h);
    body = JSON.parse(txt);
  } catch { return json({ ok: false, error: 'JSON inválido' }, 400, h); }

  const ip = req.headers.get('cf-connecting-ip') || '0';
  const ipHash = (await sha256(ip + '|' + (env.IP_SALT || ''))).slice(0, 32);
  const documento = limpiaDoc(body.documento);
  const codigo = limpiaCod(body.actividad);
  if (!documento || !codigo) return json({ ok: false, error: 'Falta documento o actividad' }, 400, h);

  const tipo = p === '/api/verificar' ? 'ver' : p === '/api/entregar' ? 'ent' : null;
  if (!tipo) return json({ ok: false, error: 'No encontrado' }, 404, h);
  if (!(await limitar(env, ipHash, tipo, tipo === 'ver' ? LIM_VERIFICAR : LIM_ENTREGAR)))
    return json({ ok: false, error: 'Demasiados intentos. Espera 10 minutos.' }, 429, h);

  // La actividad define el grupo; el aprendiz debe pertenecer a ESE grupo.
  const fila = await env.DB.prepare(
    `SELECT a.id act_id, a.abierta, a.nombre act_nombre, e.id est_id, e.nombres
       FROM actividades a JOIN grupos g ON g.id=a.grupo_id AND g.activo=1
       JOIN estudiantes e ON e.grupo_id=a.grupo_id AND e.documento=?
      WHERE a.codigo=?`).bind(documento, codigo).first();
  // Mismo mensaje para "no existe" y "no pertenece": no revela quién está en qué grupo.
  if (!fila) return json({ ok: false, error: 'Documento o actividad no válidos' }, 404, h);
  if (!fila.abierta) return json({ ok: false, error: 'Esta actividad ya no recibe entregas' }, 403, h);

  const primerNombre = String(fila.nombres).split(' ')[0];
  if (tipo === 'ver') return json({ ok: true, nombre: primerNombre, actividad: fila.act_nombre }, 200, h);

  if (env.TURNSTILE_SECRET) {
    const fd = new FormData();
    fd.append('secret', env.TURNSTILE_SECRET); fd.append('response', String(body.turnstile || '')); fd.append('remoteip', ip);
    const tv = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: fd })).json();
    if (!tv.success) return json({ ok: false, error: 'Verificación anti-bots fallida' }, 403, h);
  }

  let contenido = body.contenido == null ? null : JSON.stringify(body.contenido);
  if (contenido && contenido.length > MAX_CONTENIDO) return json({ ok: false, error: 'Entrega demasiado grande (máx 64 KB)' }, 413, h);
  const puntaje = Number.isFinite(Number(body.puntaje)) && body.puntaje !== null && body.puntaje !== '' ? Math.max(0, Math.min(100, Number(body.puntaje))) : null;
  const origen = String(req.headers.get('origin') || '').slice(0, 100);

  const r = await env.DB.prepare('INSERT INTO entregas(actividad_id,estudiante_id,contenido,puntaje_auto,origen,ip_hash) VALUES (?,?,?,?,?,?) RETURNING id, creado')
    .bind(fila.act_id, fila.est_id, contenido, puntaje, origen, ipHash).first();
  return json({ ok: true, nombre: primerNombre, recibo: 'LL-' + r.id, fecha: r.creado }, 200, h);
}

// ───────────────────────── verificación de Access ─────────────────────────
let CERTS = { t: 0, keys: [] };
function b64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function verificarAdmin(req, env) {
  if (env.DEV_BYPASS === '1' && new URL(req.url).hostname === 'localhost') return env.ADMIN_EMAIL || 'dev@local';
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD || !env.ADMIN_EMAIL) return null; // falla cerrado
  const token = req.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  let head, pay;
  try {
    head = JSON.parse(new TextDecoder().decode(b64url(partes[0])));
    pay = JSON.parse(new TextDecoder().decode(b64url(partes[1])));
  } catch { return null; }
  if (head.alg !== 'RS256') return null;
  const iss = `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
  if (Date.now() - CERTS.t > 3600_000 || !CERTS.keys.some(k => k.kid === head.kid)) {
    const r = await fetch(iss + '/cdn-cgi/access/certs');
    CERTS = { t: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = CERTS.keys.find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(partes[2]), new TextEncoder().encode(partes[0] + '.' + partes[1]));
  if (!ok) return null;
  const ahora = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(pay.aud) ? pay.aud : [pay.aud];
  if (pay.iss !== iss || !aud.includes(env.ACCESS_AUD) || !(pay.exp > ahora)) return null;
  if (String(pay.email || '').toLowerCase() !== String(env.ADMIN_EMAIL).toLowerCase()) return null;
  return pay.email;
}

// ───────────────────────── API privada ─────────────────────────
async function admin(req, env, ruta, url) {
  const m = req.method;
  const DB = env.DB;
  // Protección CSRF: solo aceptar escrituras con content-type JSON y mismo origen
  if (m !== 'GET') {
    const o = req.headers.get('origin');
    if (o && o !== url.origin) return json({ ok: false, error: 'Origen inválido' }, 403);
    if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ ok: false, error: 'Se requiere JSON' }, 415);
  }
  const body = m === 'GET' ? null : await req.json().catch(() => ({}));
  const seg2 = ruta.split('/');

  if (m === 'GET' && ruta === 'grupos') {
    const { results } = await DB.prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM estudiantes e WHERE e.grupo_id=g.id) n_est,
              (SELECT COUNT(*) FROM actividades a WHERE a.grupo_id=g.id) n_act,
              (SELECT COUNT(*) FROM entregas en JOIN actividades a ON a.id=en.actividad_id WHERE a.grupo_id=g.id
                 AND NOT EXISTS (SELECT 1 FROM calificaciones c WHERE c.actividad_id=en.actividad_id AND c.estudiante_id=en.estudiante_id)) por_calificar
         FROM grupos g ORDER BY g.activo DESC, g.institucion, g.codigo`).all();
    return json({ ok: true, grupos: results });
  }

  if (m === 'GET' && seg2[0] === 'grupo' && seg2[1]) {
    const id = Number(seg2[1]);
    const g = await DB.prepare('SELECT * FROM grupos WHERE id=?').bind(id).first();
    if (!g) return json({ ok: false, error: 'Grupo no existe' }, 404);
    const [cat, act, est, cal, ent] = await DB.batch([
      DB.prepare('SELECT * FROM categorias WHERE grupo_id=? ORDER BY orden, id').bind(id),
      DB.prepare("SELECT * FROM actividades WHERE grupo_id=? ORDER BY COALESCE(fecha,'9999'), id").bind(id),
      DB.prepare('SELECT id,tipo_doc,documento,nombres,apellidos,estado FROM estudiantes WHERE grupo_id=? ORDER BY apellidos, nombres').bind(id),
      DB.prepare('SELECT c.* FROM calificaciones c JOIN actividades a ON a.id=c.actividad_id WHERE a.grupo_id=?').bind(id),
      DB.prepare(`SELECT en.actividad_id, en.estudiante_id, COUNT(*) n, MAX(en.id) ultima_id, MAX(en.creado) ultima, MAX(en.puntaje_auto) puntaje
                    FROM entregas en JOIN actividades a ON a.id=en.actividad_id WHERE a.grupo_id=? GROUP BY 1,2`).bind(id)
    ]);
    return json({ ok: true, grupo: g, categorias: cat.results, actividades: act.results, estudiantes: est.results,
      calificaciones: cal.results, entregas: ent.results });
  }

  if (m === 'GET' && seg2[0] === 'entrega' && seg2[1]) {
    const r = await DB.prepare(`SELECT en.id, en.creado, en.contenido, en.puntaje_auto, en.origen, a.nombre actividad, e.nombres, e.apellidos
       FROM entregas en JOIN actividades a ON a.id=en.actividad_id JOIN estudiantes e ON e.id=en.estudiante_id WHERE en.id=?`).bind(Number(seg2[1])).first();
    return r ? json({ ok: true, entrega: r }) : json({ ok: false, error: 'No existe' }, 404);
  }

  if (m === 'PUT' && ruta === 'nota') {
    const a = Number(body.actividad_id), e = Number(body.estudiante_id);
    const v = String(body.valor ?? '').trim().toUpperCase().replace(',', '.');
    const act = await DB.prepare('SELECT a.tipo FROM actividades a JOIN estudiantes e ON e.grupo_id=a.grupo_id WHERE a.id=? AND e.id=?').bind(a, e).first();
    if (!act) return json({ ok: false, error: 'Actividad/estudiante no coinciden' }, 400);
    if (v === '') { await DB.prepare('DELETE FROM calificaciones WHERE actividad_id=? AND estudiante_id=?').bind(a, e).run(); return json({ ok: true }); }
    const valido = act.tipo === 'AD' ? ['A', 'D'].includes(v) : act.tipo === 'ASIS' ? ['SI', 'NO'].includes(v) : /^\d(\.\d{1,2})?$/.test(v) && Number(v) <= 5;
    if (!valido) return json({ ok: false, error: 'Valor no válido para el tipo ' + act.tipo }, 400);
    await DB.prepare(`INSERT INTO calificaciones(actividad_id,estudiante_id,valor,observacion) VALUES (?,?,?,?)
       ON CONFLICT(actividad_id,estudiante_id) DO UPDATE SET valor=excluded.valor, observacion=COALESCE(excluded.observacion,observacion), actualizado=datetime('now')`)
      .bind(a, e, v, body.observacion ? String(body.observacion).slice(0, 500) : null).run();
    return json({ ok: true });
  }

  if (m === 'POST' && ruta === 'categoria') {
    const r = await DB.prepare('INSERT INTO categorias(grupo_id,nombre,peso,orden) VALUES (?,?,?,?) RETURNING id')
      .bind(Number(body.grupo_id), String(body.nombre).slice(0, 120), Number(body.peso) || 0, Number(body.orden) || 0).first();
    return json({ ok: true, id: r.id });
  }
  if (m === 'PATCH' && seg2[0] === 'categoria' && seg2[1]) {
    await DB.prepare('UPDATE categorias SET nombre=COALESCE(?,nombre), peso=COALESCE(?,peso), orden=COALESCE(?,orden) WHERE id=?')
      .bind(body.nombre ?? null, body.peso ?? null, body.orden ?? null, Number(seg2[1])).run();
    return json({ ok: true });
  }

  if (m === 'POST' && ruta === 'actividad') {
    if (!['AD', 'NUM', 'ASIS'].includes(body.tipo)) return json({ ok: false, error: 'Tipo inválido' }, 400);
    const codigo = limpiaCod(body.codigo);
    if (!/^[A-Z0-9-]{3,60}$/.test(codigo)) return json({ ok: false, error: 'Código: solo letras, números y guiones' }, 400);
    try {
      const r = await DB.prepare('INSERT INTO actividades(grupo_id,categoria_id,codigo,nombre,tipo,peso,fecha,abierta) VALUES (?,?,?,?,?,?,?,?) RETURNING id')
        .bind(Number(body.grupo_id), body.categoria_id ? Number(body.categoria_id) : null, codigo, String(body.nombre).slice(0, 160),
          body.tipo, Number(body.peso) || 0, body.fecha || null, body.abierta ? 1 : 0).first();
      return json({ ok: true, id: r.id, codigo });
    } catch { return json({ ok: false, error: 'Ese código ya existe' }, 409); }
  }
  if (m === 'PATCH' && seg2[0] === 'actividad' && seg2[1]) {
    await DB.prepare(`UPDATE actividades SET nombre=COALESCE(?,nombre), categoria_id=COALESCE(?,categoria_id), peso=COALESCE(?,peso),
        fecha=COALESCE(?,fecha), abierta=COALESCE(?,abierta) WHERE id=?`)
      .bind(body.nombre ?? null, body.categoria_id ?? null, body.peso ?? null, body.fecha ?? null,
        body.abierta == null ? null : (body.abierta ? 1 : 0), Number(seg2[1])).run();
    return json({ ok: true });
  }

  // Crear grupo + estudiantes (lista pegada desde Excel)
  if (m === 'POST' && ruta === 'importar') {
    const g = body.grupo || {};
    if (!['SENA', 'UNIGUAJIRA'].includes(g.institucion) || !g.codigo || !g.nombre) return json({ ok: false, error: 'Datos del grupo incompletos' }, 400);
    let grupo = await DB.prepare('SELECT id FROM grupos WHERE codigo=?').bind(String(g.codigo).trim()).first();
    if (!grupo) {
      grupo = await DB.prepare('INSERT INTO grupos(institucion,codigo,nombre,periodo) VALUES (?,?,?,?) RETURNING id')
        .bind(g.institucion, String(g.codigo).trim(), String(g.nombre).trim(), g.periodo || null).first();
      if (g.institucion === 'UNIGUAJIRA') {
        await DB.batch([['Corte 1', 30, 1], ['Corte 2', 35, 2], ['Corte 3', 35, 3]].map(([n, p, o]) =>
          DB.prepare('INSERT INTO categorias(grupo_id,nombre,peso,orden) VALUES (?,?,?,?)').bind(grupo.id, n, p, o)));
      }
    }
    const lista = (body.estudiantes || []).slice(0, 200).map(x => ({ ...x, documento: limpiaDoc(x.documento) })).filter(x => x.documento && x.nombres);
    if (lista.length) await DB.batch(lista.map(x => DB.prepare(
      `INSERT INTO estudiantes(grupo_id,tipo_doc,documento,nombres,apellidos,estado) VALUES (?,?,?,?,?,?)
       ON CONFLICT(grupo_id,documento) DO UPDATE SET nombres=excluded.nombres, apellidos=excluded.apellidos, estado=excluded.estado`)
      .bind(grupo.id, x.tipo_doc || null, x.documento, String(x.nombres).trim().toUpperCase(), String(x.apellidos || '').trim().toUpperCase(), x.estado || null)));
    return json({ ok: true, grupo_id: grupo.id, importados: lista.length });
  }

  if (m === 'PATCH' && seg2[0] === 'estudiante' && seg2[1]) {
    await DB.prepare('UPDATE estudiantes SET estado=? WHERE id=?').bind(String(body.estado || '').slice(0, 40), Number(seg2[1])).run();
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Ruta no encontrada' }, 404);
}
