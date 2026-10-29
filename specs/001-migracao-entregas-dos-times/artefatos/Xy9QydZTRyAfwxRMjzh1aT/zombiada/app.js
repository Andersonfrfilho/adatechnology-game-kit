/* ZombiAdA · Garagem v5 · aplicação (usa window.ZG = VehicleSDK + zombiada/plugin.js): cenário, visor, painel, folha de contato, combustíveis e window.__garage */
(function () {
  "use strict";
  var ZG = window.ZG, V3 = THREE.Vector3, PI = Math.PI, FLEET = ZG.FLEET, FUELS = ZG.FUELS, hash = ZG.hash, clamp = ZG.clamp, FM = ZG.FM;
  var FX_ERR = [];

  /* ================= cenário ================= */
  var NIGHT = new THREE.Color(0x0b1018);
  function makeStage(scene) {
    scene.background = NIGHT; scene.fog = new THREE.FogExp2(NIGHT, 0.03);
    scene.add(new THREE.HemisphereLight(0x3a4c6a, 0x0b0b0c, 0.8));
    var moon = new THREE.DirectionalLight(0x8aa6d6, 0.6); moon.position.set(7, 12, 6); moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048); var sc = moon.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 45; moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.035; scene.add(moon);
    var spot = new THREE.SpotLight(0xffd9a8, 2.4, 26, 0.62, 0.55, 1.4); spot.position.set(-3.4, 6.2, -4.6); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0008; spot.shadow.normalBias = 0.035; scene.add(spot); scene.add(spot.target);
    var rim = new THREE.PointLight(0x6fa3c7, 1.2, 16, 2); rim.position.set(6, 3, 5); scene.add(rim);
    var fill = new THREE.PointLight(0xffa25a, 0.9, 14, 2); fill.position.set(-6, 2.2, 5); scene.add(fill);
    function add(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = true; (parent || scene).add(m); return m; }
    var land = new THREE.Group(); scene.add(land);
    var gg = new THREE.CircleGeometry(34, 60), gp = gg.attributes.position;
    for (var i = 0; i < gp.count; i++) { var x = gp.getX(i), y = gp.getY(i); if (Math.hypot(x, y) > 7) gp.setZ(i, (hash(Math.round(x), Math.round(y), 2) - 0.5) * 0.4); }
    gg.computeVertexNormals();
    add(gg, FM("#191c1b"), 0, -0.03, 0, land).rotation.x = -PI / 2;
    add(new THREE.BoxGeometry(70, 0.04, 9), FM("#14171a", { roughness: 0.85 }), 0, -0.01, 0, land).castShadow = false;
    for (var dx = -34; dx < 34; dx += 3.2) add(new THREE.BoxGeometry(1.4, 0.045, 0.12), FM("#6b5e34"), dx, 0.0, 0, land).castShadow = false;
    [4.6, -4.6].forEach(function (z) { add(new THREE.BoxGeometry(70, 0.16, 0.22), FM("#3e423e"), 0, 0.08, z, land); for (var t = -34; t < 34; t += 1.2) add(new THREE.BoxGeometry(1.15, 0.14, 2.4), FM(hash(t, z, 1) > 0.5 ? "#2b2e2a" : "#272a27"), t, 0.07, z + Math.sign(z) * 1.3, land).castShadow = false; });
    add(new THREE.CylinderGeometry(0.08, 0.11, 6.2, 6), FM("#2d302d"), -3.4, 3.1, -5.0, land);
    add(new THREE.BoxGeometry(0.08, 0.08, 0.9), FM("#2d302d"), -3.4, 6.15, -4.6, land);
    add(new THREE.BoxGeometry(0.42, 0.12, 0.26), FM("#ffd9a8", { emissive: new THREE.Color("#ffc27a"), emissiveIntensity: 1.3 }), -3.4, 6.06, -4.2, land);
    add(new THREE.CircleGeometry(1.6, 9), FM("#1b2329", { roughness: 0.12, metalness: 0.1 }), 3.6, 0.03, -2.8, land).rotation.x = -PI / 2;
    [[6.2, 3.6], [-7.5, -3.4], [8.4, -3.6]].forEach(function (p) { add(new THREE.ConeGeometry(0.2, 0.55, 6), FM("#a5501c"), p[0], 0.28, p[1], land); });
    for (var r = 0; r < 16; r++) { var a = hash(r, 1, 3) * PI * 2, d = 8 + hash(r, 2, 5) * 10; add(new THREE.DodecahedronGeometry(0.12 + hash(r, 4, 4) * 0.25, 0), FM("#2e302c"), Math.cos(a) * d, 0.08, Math.sin(a) * d, land); }
    var water = new THREE.Group(); scene.add(water); water.visible = false;
    var wg = new THREE.PlaneGeometry(90, 90, 70, 70); wg.rotateX(-PI / 2);
    var wm = add(wg, FM("#0f2a30", { roughness: 0.25, metalness: 0.35 }), 0, 0, 0, water); wm.castShadow = false;
    var pier = new THREE.Group(); pier.position.set(0, 0, -4.4); water.add(pier);
    for (var px = -8; px <= 8; px += 0.5) add(new THREE.BoxGeometry(0.45, 0.08, 2.0), FM(hash(px, 1, 1) > 0.5 ? "#4a3a29" : "#3f3224"), px, 0.55, 0, pier);
    for (var pp = -8; pp <= 8; pp += 2) [-0.9, 0.9].forEach(function (zz) { add(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6), FM("#33281d"), pp, -0.3, zz, pier); });
    return { land: land, water: water, waveMesh: wm };
  }
  function animateWater(stg, t) {
    var p = stg.waveMesh.geometry.attributes.position;
    for (var i = 0; i < p.count; i++) { var x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 0.6 + t * 1.1) * 0.06 + Math.cos(z * 0.5 + t * 0.8) * 0.05); }
    p.needsUpdate = true; stg.waveMesh.geometry.computeVertexNormals();
  }
  function isWater(v) { return !!ZG.WATER_GROUPS[v.grp]; }

  /* ================= visor ================= */
  var viewerEl = document.getElementById("viewer"), canvas = document.getElementById("view");
  var renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); } catch (e) { renderer = null; }
  if (!renderer) { var nm = document.createElement("div"); nm.className = "nogl"; nm.textContent = "Este navegador não conseguiu abrir o visor 3D (WebGL desligado ou indisponível)."; viewerEl.appendChild(nm); }
  var scene = new THREE.Scene(), stage = makeStage(scene);
  var camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 160);
  if (renderer) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }

  var startK = FLEET.findIndex(function (v) { return v.k === "hatch"; });
  var current = startK >= 0 ? startK : 0, state = "intacto", holder = null, ctxs = [];
  /* zonas de dano: zs = { h: { id: saúde }, flags, sc } do veículo aberto; sel = zona selecionada */
  var zs = null, sel = null, selHelper = null;
  function cloneZs(q) { return q ? { h: Object.assign({}, q.h), flags: Object.assign({}, q.flags || {}), sc: q.sc || null } : null; }
  var orbit = { theta: 0.72, phi: 1.14, dist: 10, target: new V3(0, 0.8, 0), auto: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, goal: null, home: null };

  function label(text) {
    var cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
    var x = cv.getContext("2d"); x.fillStyle = "rgba(14,18,22,.88)"; x.fillRect(0, 8, 256, 48); x.fillStyle = "#e0a548"; x.fillRect(0, 8, 6, 48);
    x.font = "600 26px 'Saira Condensed', 'Arial Narrow', sans-serif"; x.fillStyle = "#d9dcd3"; x.textBaseline = "middle"; x.fillText(text.toUpperCase(), 18, 33);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false })); s.scale.set(1.6, 0.4, 1); return s;
  }
  function show(keepCam) {
    if (holder) { scene.remove(holder); ctxs.forEach(ZG.dispose); }
    holder = new THREE.Group(); ctxs = [];
    var v = FLEET[current]; stage.water.visible = isWater(v); stage.land.visible = !isWater(v);
    if (state === "tres") {
      var names = ["Modificado", "Batido", "Intacto"];
      var cs = ["modificado", "danificado", "intacto"].map(function (s) { return ZG.build(v.k, s); });
      var size = new THREE.Box3().setFromObject(cs[2].g).getSize(new V3());
      var horiz = size.z > size.x * 0.9, gap = (horiz ? size.x : size.z) + 1.6;
      cs.forEach(function (c, i) {
        if (horiz) c.root.position.x = (i - 1) * gap; else c.root.position.z = (i - 1) * gap; holder.add(c.root);
        var lb = label(names[i]); lb.position.set(0, size.y + 0.6, 0); c.root.add(lb); ctxs.push(c);
      });
    } else {
      var c = ZG.build(v.k, state, zs); holder.add(c.root); ctxs.push(c);
      var sc0 = zs && zs.sc; zs = cloneZs(c.zs); if (sc0) zs.sc = sc0; else if (state === "danificado" && !zs.sc) zs.sc = "frontal";
      if (sel && !c.zones.some(function (z) { return z.id === sel; })) sel = null;
    }
    scene.add(holder);
    if (!keepCam) {
      var sz = new THREE.Box3().setFromObject(holder).getSize(new V3());
      orbit.target.set(0, Math.max(0.45, sz.y * 0.4), 0);
      orbit.dist = Math.max(sz.x, sz.z * 1.05) * 1.1 + 2.8; orbit.minD = Math.min(1.6, orbit.dist * 0.3); orbit.maxD = orbit.dist * 2.2;
      orbit.goal = null; orbit.home = null;
    }
    renderInfo(); renderLog(); syncHoodBtn(); markSel();
    if (!keepCam) setHud(state === "tres" ? "Três estados lado a lado" : "Arraste para girar · clique no veículo para bater");
  }
  function placeCamera(cam, o) {
    cam.position.set(o.target.x + o.dist * Math.sin(o.phi) * Math.cos(o.theta), o.target.y + o.dist * Math.cos(o.phi), o.target.z + o.dist * Math.sin(o.phi) * Math.sin(o.theta));
    cam.lookAt(o.target);
  }
  function resize() { if (!renderer) return; var w = viewerEl.clientWidth, h = viewerEl.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(viewerEl); else window.addEventListener("resize", resize);

  var last = performance.now(), clock = 0, waterTick = 0;
  function advance(dt) {
    clock += dt;
    if (orbit.auto && !orbit.goal) orbit.theta += dt * 0.15;
    if (orbit.goal) {
      var g = orbit.goal, k = Math.min(1, dt * 3.5);
      orbit.theta += (g.theta - orbit.theta) * k; orbit.phi += (g.phi - orbit.phi) * k; orbit.dist += (g.dist - orbit.dist) * k; orbit.target.lerp(g.target, k);
      if (g.release && Math.abs(g.dist - orbit.dist) < 0.02 && Math.abs(g.theta - orbit.theta) < 0.01 && Math.abs(g.phi - orbit.phi) < 0.01 && orbit.target.distanceTo(g.target) < 0.01) orbit.goal = null;
    }
    ctxs.forEach(function (c) { ZG.tick(c, dt); });
    /* câmera acompanha a capotagem e recua um pouco para o veículo caber no quadro */
    var c0 = ctxs[0];
    if (c0 && state !== "tres" && (c0.rollA || (c0.flipped && c0.rollPulled)) && !orbit.goal) {
      var kz = Math.min(1, dt * 3); orbit.target.z += (c0.g.position.z - orbit.target.z) * kz;
      if (!c0.rollPulled) { c0.rollPulled = orbit.dist; } orbit.dist += (c0.rollPulled * 1.18 - orbit.dist) * kz;
    }
    if (stage.water.visible) { waterTick += dt; if (waterTick > 0.05) { animateWater(stage, clock); waterTick = 0; } }
  }
  function render() { placeCamera(camera, orbit); if (renderer) renderer.render(scene, camera); }
  var paused = false;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (paused) { requestAnimationFrame(loop); return; }
    try { advance(dt); render(); } catch (e) { FX_ERR.push(String(e && e.message || e)); throw e; }
    requestAnimationFrame(loop);
  }

  var drag = null, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", function (e) {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) { orbit.auto = false; if (orbit.goal) { orbit.goal = null; } }
    orbit.theta += (e.clientX - drag.x) * 0.008; orbit.phi = clamp(orbit.phi - (e.clientY - drag.y) * 0.006, 0.2, 1.52);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  canvas.addEventListener("pointerup", function (e) { if (drag && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) clickHit(e.clientX, e.clientY); drag = null; });
  canvas.addEventListener("pointercancel", function () { drag = null; });
  function clickHit(cx, cy) {
    if (!holder || state === "tres") { setHud("Escolha um estado único para bater"); return null; }
    var c = ctxs[0]; if (c.rollA || (c.boom && c.boom.phase !== "queimado")) return null;
    var r = canvas.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    placeCamera(camera, orbit); camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObject(c.g, true).filter(function (h) { return h.object.visible && h.object.isMesh && h.face; });
    if (!hits.length) { setHud("Clique em cima do veículo para bater ali"); return null; }
    var h = hits[0], inv = new THREE.Matrix4().copy(c.g.matrixWorld).invert(), p = h.point.clone().applyMatrix4(inv);
    var n = h.face.normal.clone().transformDirection(h.object.matrixWorld), q = new THREE.Quaternion(); c.g.getWorldQuaternion(q); n.applyQuaternion(q.invert()).normalize();
    return hitAt(p, n.negate(), force(), h.object);
  }
  /* batida num ponto: desconta saúde das zonas, seleciona a zona atingida e reconstrói se alguma trocou de faixa */
  function hitAt(p, dir, f, obj) {
    var c = ctxs[0]; if (!c || state === "tres") return [];
    var res = ZG.zoneDamageAt(c, p, dir, f, obj), nz = cloneZs(c.zs), changed = false, names = [];
    res.list.forEach(function (e) { var old = nz.h[e.id] == null ? 100 : nz.h[e.id], nw = Math.max(0, old - e.dmg); nz.h[e.id] = nw; if (ZG.bandOf(old) !== ZG.bandOf(nw)) changed = true; names.push(e.n); });
    nz.sc = null; zs = nz; sel = res.main || sel;
    if (changed) show(true); else { applyData(c, nz); renderLog(); markSel(); }
    c = ctxs[0];
    var pf = c.toFx(p), df = c.dirFx(dir.clone().negate());
    ZG.burst(c, "faisca", pf, Math.round(8 + f * 16), { dir: df, speed: 2.5 + f * 2, spread: 1.4, jitter: 0.05 });
    if (f > 0.6) ZG.burst(c, "plastico", pf, 2, { dir: df, speed: 1.2 });
    var z = c.zones.find(function (q) { return q.id === res.main; });
    setHud(z ? "Batida em " + z.n + ": " + ZG.BANDS[ZG.bandOf(z.h)].n + " " + z.h + "%" + (names.length > 1 ? " (também " + names.filter(function (n2) { return n2 !== z.n; }).slice(0, 3).join(", ") + ")" : "") : "Batida");
    return names;
  }
  /* muda só os números (sem reconstruir): mesma faixa, ou depois de capotar/explodir */
  function applyData(c, nz) { c.zs = cloneZs(nz); c.zones.forEach(function (z) { if (nz.h[z.id] != null) { z.h = nz.h[z.id]; z.b = ZG.bandOf(z.h); } }); if (c === ctxs[0]) renderInfo(); }
  function setZoneH(id, h) {
    var c = ctxs[0]; if (!c || state === "tres") return null;
    var z = c.zones.find(function (q) { return q.id === id; }); if (!z) throw new Error("Zona desconhecida: " + id);
    h = Math.round(clamp(+h, 0, 100)); var nz = cloneZs(c.zs), old = nz.h[id] == null ? 100 : nz.h[id]; nz.h[id] = h; nz.sc = null; zs = nz; sel = id;
    var rebuilt = ZG.bandOf(old) !== ZG.bandOf(h);
    if (rebuilt) show(true); else { applyData(c, nz); renderLog(); markSel(); }
    var z2 = ctxs[0].zones.find(function (q) { return q.id === id; });
    setHud(z2.n + ": " + ZG.BANDS[ZG.bandOf(h)].n + " " + h + "%");
    return { id: id, saude: h, faixa: ZG.BANDS[ZG.bandOf(h)].n, reconstruido: rebuilt };
  }
  function runScenario(name) {
    var c = ctxs[0]; if (!c || state === "tres") { state = "intacto"; show(); c = ctxs[0]; }
    var nz = ZG.zoneScenario(c, name); if (hoodIsOpen()) setHood(false);
    if (nz.sc === "frontal" && state !== "modificado") state = "danificado"; else if (state === "danificado") state = "intacto";
    zs = nz; sel = null; show(true);
    /* a capotagem do cenário roda de uma vez: a câmera recentraliza no veículo deitado */
    var c1 = ctxs[0];
    if (c1 && c1.flipped && !orbit.goal) { orbit.target.z = c1.g.position.z; if (!c1.rollPulled) { c1.rollPulled = orbit.dist; orbit.dist = clamp(orbit.dist * 1.18, orbit.minD, orbit.maxD); } }
    var S =ZG.SCENARIOS.find(function (q) { return q.id === nz.sc; });
    setHud("Cenário: " + (S ? S.n : name));
    return { cenario: S ? S.n : name, zonas: Object.keys(nz.h).filter(function (k) { return nz.h[k] < 100; }).length, geral: ZG.zoneOverall(ctxs[0]) };
  }
  function setHud(t) { document.getElementById("hud").textContent = t; }
  function zoom(f) { orbit.dist = clamp(orbit.dist * f, orbit.minD, orbit.maxD); }
  canvas.addEventListener("wheel", function (e) { e.preventDefault(); zoom(e.deltaY > 0 ? 1.08 : 0.92); }, { passive: false });
  document.getElementById("zin").addEventListener("click", function () { zoom(0.85); });
  document.getElementById("zout").addEventListener("click", function () { zoom(1.18); });

  var forca = document.getElementById("forca"), forcaOut = document.getElementById("forcaOut");
  function force() { return parseFloat(forca.value); }
  function syncForce() { forcaOut.textContent = Math.round(force() * 65) + " km/h"; }
  forca.addEventListener("input", syncForce); syncForce();

  /* ---- capô ---- */
  var hoodBtn = document.getElementById("z-capo");
  function hoodIsOpen() { var c = ctxs[0]; return !!(c && c.hood && c.hood.target > 0.5); }
  function syncHoodBtn() {
    var v = FLEET[current], c = ctxs[0], ok = !!(v.hood && c && c.hood && state !== "tres");
    hoodBtn.disabled = !ok; hoodBtn.textContent = hoodIsOpen() ? "Fechar capô" : "Abrir capô";
    hoodBtn.title = ok ? "" : (state === "tres" ? "Escolha um estado único" : "Este veículo não tem capô que abre");
  }
  function setHood(open) {
    var c = ctxs[0]; if (!c || !c.hood || state === "tres" || c.flipped || c.rollA || c.boom) return false;
    ZG.setHood(c, open);
    if (open) {
      if (!orbit.home) orbit.home = { theta: orbit.theta, phi: orbit.phi, dist: orbit.dist, target: orbit.target.clone() };
      var b = c.meta.bay, cen = b ? b.center.clone() : new V3(c.hood.x1, c.hood.y, 0);
      c.root.updateMatrixWorld(true); cen.applyMatrix4(c.g.matrixWorld);
      var span = b ? Math.max(b.x1 - b.x0, b.zw * 2) : 1.2;
      /* enquadramento: meta.bay.view { theta, phi, dist } manda; motor atrás do centro (x0 < 0) é visto por trás */
      var vw = (b && b.view) || {}, rearBay = b ? (b.x0 + b.x1) / 2 < Math.min(0, ((c.meta.front || 1) + (c.meta.rear || -1)) / 2) : c.hood.x1 < 0;
      orbit.auto = false; orbit.goal = { theta: vw.theta != null ? vw.theta : (rearBay ? PI - 0.7 : 0.7), phi: vw.phi != null ? vw.phi : 0.8, dist: vw.dist || Math.max(3.2, span * 3.1), target: cen };
      var MOT = { gasolina: "motor a gasolina", diesel: b && b.turbo === false ? "motor diesel aspirado" : "motor diesel com turbo e intercooler", eletrico: "inversor, cabos de alta tensão e porta-malas dianteiro", v8: "V8 com blower", v8n: "motor V8 aspirado", hibrido: "motor flex e inversor híbrido" };
      var lab = (b && b.label) || c.hood.label || (b ? MOT[b.motor] || "motor" : "");
      setHud(lab ? "Capô aberto: " + lab : "Capô aberto");
    } else {
      if (orbit.home) { orbit.goal = Object.assign({ release: true }, orbit.home); orbit.home = null; }
      setHud("Capô fechado");
    }
    syncHoodBtn(); return true;
  }
  hoodBtn.addEventListener("click", function () { setHood(!hoodIsOpen()); });
  document.getElementById("z-wipe").addEventListener("click", function () {
    var c = ctxs[0]; if (!c || state === "tres") { setHud("Escolha um estado único"); return; }
    var n = ZG.wipe(c, "limpador"); setHud(n ? "Limpador: sangue fresco removido do vidro" : "Limpador: nada fresco para limpar (sangue seco não sai)");
  });
  /* ---- explosão ---- */
  var boomBtn = document.getElementById("z-boom");
  function explode() {
    var c = ctxs[0]; if (!c || state === "tres") { setHud("Escolha um estado único para explodir"); return false; }
    if (c.exploded || c.boom) { setHud("Já está em chamas: conserte para montar de novo"); return false; }
    if (hoodIsOpen()) setHood(false);
    var big = !!c.meta.bigBoom, fuse = ZG.explode(c);
    setHud("Motor pegando fogo: fumaça preta e explosão em " + fuse.toFixed(1).replace(".", ",") + " s" + (big ? " (tanque de 15 mil litros: afaste-se)" : ""));
    if (big) { orbit.auto = false; orbit.goal = { theta: orbit.theta, phi: 1.2, dist: 62, target: new V3(c.g.position.x, 6, c.g.position.z), release: true }; }
    /* espera a explosão acontecer de verdade (aba em segundo plano ou simulação pausada atrasam o pavio) */
    setTimeout(function wait() { if (ctxs[0] !== c) return; if (!c.exploded) { setTimeout(wait, 400); return; } { setHud(big ? "Explosão do tanque: raio letal 12 m, ferimentos até 30 m, cogumelo de 16 m" : "Explosão: capô, portas e uma roda voaram. Sobrou a carcaça queimada."); mergeScenario(c, "queimado"); } }, fuse * 1000 + 300);
    return true;
  }
  boomBtn.addEventListener("click", explode);
  /* depois de capotar ou explodir, as zonas recebem o dano do cenário equivalente (só os números; o visual já está na tela) */
  function mergeScenario(c, name) {
    if (ctxs[0] !== c) return; var sc = ZG.zoneScenario(c, name), nz = cloneZs(c.zs);
    Object.keys(sc.h).forEach(function (k) { nz.h[k] = Math.min(nz.h[k] == null ? 100 : nz.h[k], sc.h[k]); });
    Object.assign(nz.flags, sc.flags); nz.flags.frontBlood = nz.flags.frontBlood || false; nz.sc = null; zs = nz; applyData(c, nz); renderLog(); markSel();
  }
  document.querySelectorAll(".zones button[data-z]").forEach(function (b) {
    b.addEventListener("click", function () {
      var z = b.dataset.z;
      if (z === "fix") { if (state === "danificado") state = "intacto"; zs = null; show(true); setHud("Consertado"); return; }
      if (state === "tres") { state = "intacto"; show(); }
      var c = ctxs[0]; if (!c) return;
      if (c.rollA || c.boom && !c.exploded) { setHud("Espere a animação terminar"); return; }
      if (z === "capotado") {
        if (c.flipped) { setHud("Já está capotado: conserte para desvirar"); return; }
        if (hoodIsOpen()) setHood(false); ZG.roll(c, 1); setHud(FLEET[current].grp === "Aquáticos" ? "Virando: o barco emborca e afunda em parte" : "Capotando: lateral, quina do teto e teto batem no chão");
        setTimeout(function wr() { if (ctxs[0] !== c) return; if (!c.flipped) { setTimeout(wr, 300); return; } mergeScenario(c, "capotado"); }, 1900); return;
      }
      var zp = ZG.zonePoint(c, z); hitAt(zp.p, zp.dir, force());
    });
  });

  /* ================= painel ================= */
  var STATE_TXT = {
    intacto: { t: "Intacto", items: function () { return ["Como é achado nos melhores casos: garagens fechadas, hangares e marinas.", "Clique em qualquer parte para simular uma batida naquele ponto. Os vidros deixam ver o interior."]; } },
    danificado: { t: "Batido", items: function () { return ["Cenário Batida frontal: para-choque, faróis e radiador destruídos, capô e paralamas amassados, para-brisa trincado.", "Cada zona tem saúde de 0 a 100. Mude a faixa de qualquer zona no mapa de danos abaixo."]; } },
    modificado: { t: "Modificado", items: function (v) {
      if (v.grp === "Aquáticos") return ["Gaiola de barras sobre o convés: zumbi na água não sobe a bordo.", "Galões extras e holofote de busca."];
      if (v.grp === "Aéreos") return ["Tanques extras sob as asas ou no esqui: mais 40% de autonomia.", "Holofote de busca para pouso noturno."];
      if (v.grp === "Motos") return ["Caixotes, alforjes e galão extra.", "Protetor de motor contra quedas."];
      return [v.k === "forte" ? "Vidros de fábrica à prova de mordida: dispensa grades." : "Grades soldadas em todas as janelas e no para-brisa: o vidro não quebra por mordida, mas a visão cai.", "Aríete com pontas: dano de atropelo +60%.", "Chapas de sucata rebitadas nas laterais.", "Bagageiro com galões e estepe. Cerca de +" + Math.round(Math.max(150, (v.mass || 1000) * 0.16)) + " kg."];
    } },
    tres: { t: "Os três estados", items: function () { return ["Intacto, batido e modificado lado a lado, com o mesmo modelo base."]; } }
  };
  function inspTxt(v) { return v.insp ? "Inspirado " + (v.art || "no") + " " + v.insp : ""; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function renderInfo() {
    var v = FLEET[current], s = STATE_TXT[state], fu = FUELS[v.fuel] || FUELS.nenhum;
    document.getElementById("vcls").textContent = v.grp + " · " + (v.c || "");
    document.getElementById("vname").textContent = v.n;
    document.getElementById("vinsp").textContent = inspTxt(v);
    document.getElementById("vdesc").textContent = v.d || "";
    var vf = document.getElementById("vfuel"); vf.innerHTML = "";
    vf.appendChild(el("span", "pill", fu.n)); vf.appendChild(el("small", null, fu.fx));
    var sb = document.getElementById("statebox"); sb.innerHTML = "";
    /* com zonas danificadas sobre o intacto (cenário, batida ou ajuste manual), a aba Intacto não fica marcada */
    var c0 = ctxs[0], fl = zs && zs.flags || {}, hurt = state === "intacto" && !!c0 && !!zs && (Object.keys(zs.h || {}).some(function (k) { return zs.h[k] < 100; }) || fl.flipped || fl.burnt || fl.abandoned || fl.horde);
    var tabSt = hurt ? null : state;
    if (hurt) {
      var SC = ZG.SCENARIOS.find(function (q) { return q.id === zs.sc; }), O = ZG.zoneOverall(c0);
      sb.appendChild(el("h3", null, SC ? "Cenário: " + SC.n : "Dano por zona"));
      var ul2 = el("ul"); ["Saúde geral " + O.h + "% · " + O.n + ". Veja o mapa de danos e a lista abaixo.", "Toque em Intacto ou em Consertar para voltar ao veículo inteiro."].forEach(function (t) { ul2.appendChild(el("li", null, t)); }); sb.appendChild(ul2);
    } else {
      sb.appendChild(el("h3", null, s.t));
      var ul = el("ul"); s.items(v).forEach(function (t) { ul.appendChild(el("li", null, t)); }); sb.appendChild(ul);
    }
    var sp = document.getElementById("specs"); sp.innerHTML = "";
    [["Inspirado em", v.insp || "—"], ["Combustível", fu.n.split(" (")[0]], ["Eficiência", v.eff || "—"], ["Lugares", String(v.seats == null ? "—" : v.seats)], [v.fuel === "eletrico" ? "Bateria" : "Tanque / bateria", v.cap || "—"], ["Autonomia", v.auto || "—"], ["Velocidade máx.", v.vmax ? v.vmax + " km/h" : "—"], ["Massa", v.mass ? v.mass.toLocaleString("pt-BR") + " kg" : "—"], ["Barulho", v.r ? "ouvido a " + v.r + " m" : "—"], ["Habilidade", v.skill || "—"]].forEach(function (p) {
      var d = el("div", null, p[0]); d.appendChild(el("b", null, p[1])); sp.appendChild(d);
    });
    document.querySelectorAll(".card").forEach(function (cd) { cd.setAttribute("aria-pressed", cd.dataset.k === v.k ? "true" : "false"); });
    document.querySelectorAll(".seg button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.st === tabSt ? "true" : "false"); });
    document.getElementById("z-capotado").textContent = isWater(v) ? "Virar" : (v.grp === "Motos" ? "Tombar" : "Capotar");
  }
  /* ================= mapa de danos ================= */
  /* mapa de danos: widgets genéricos do SDK (VehicleSDK.ui) */
  function zLabel(z) { return ZG.ui.zoneLabel(z); }
  function renderMap(c) { ZG.ui.damageMap(document.getElementById("dmgMap"), c, { selected: sel, onSelect: function (id) { selectZone(id, true); } }); }
  function selectZone(id, face) { sel = id; renderLog(); markSel(); var c = ctxs[0], z = c && c.zones.find(function (q) { return q.id === id; }); if (z) { setHud(zLabel(z)); if (face) faceZone(c, z); } }
  /* escolhida no mapa ou na lista: a câmera gira para o lado da zona (sem mudar zoom nem alvo) */
  function faceZone(c, z) {
    if (!c || state === "tres" || c.rollA) return; var d = z.dir;
    if (z.internal || (Math.abs(d.y) > 0.7 && !z.side)) { if (!z.internal) { orbit.auto = false; orbit.goal = { theta: orbit.theta, phi: 0.75, dist: orbit.dist, target: orbit.target.clone(), release: true }; } return; }
    var flip = c.flipped ? -1 : 1, th = Math.atan2(-d.z * flip, -d.x) + (z.side ? -z.side * 0.45 : 0.45);
    while (th - orbit.theta > PI) th -= 2 * PI; while (th - orbit.theta < -PI) th += 2 * PI;
    orbit.auto = false; orbit.goal = { theta: th, phi: clamp(orbit.phi, 0.9, 1.25), dist: orbit.dist, target: orbit.target.clone(), release: true };
  }
  /* contorno da zona selecionada no 3D */
  function markSel() {
    if (selHelper && selHelper.parent) { selHelper.parent.remove(selHelper); selHelper.geometry.dispose(); }
    selHelper = null; var c = ctxs[0]; if (!c || state === "tres" || !sel) return;
    var z = c.zones.find(function (q) { return q.id === sel; }); if (!z) return; var B = z.box;
    var geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(B.x1 - B.x0, B.y1 - B.y0, B.z1 - B.z0));
    selHelper = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xe0a548, transparent: true, opacity: 0.85, depthTest: false, fog: false }));
    selHelper.position.set((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2); selHelper.renderOrder = 20; selHelper.userData.ghost = true; selHelper.userData.decal = true; selHelper.raycast = function () {};
    c.g.add(selHelper);
  }
  function renderLog() {
    var c = ctxs[0], one = c && state !== "tres";
    var dm = document.getElementById("dmg"); dm.classList.toggle("off", !one);
    var ov = document.getElementById("dmgAll"), bar = document.getElementById("dmgBar");
    if (!one) { document.getElementById("dmgMap").innerHTML = '<p class="muted">Escolha um estado único (Intacto, Batido ou Modificado) para ver o mapa de danos.</p>'; ov.textContent = ""; bar.style.width = "0"; document.getElementById("where").innerHTML = ""; renderSel(null); syncScen(); return; }
    var O = ZG.zoneOverall(c); ov.textContent = "Saúde geral " + O.h + "% · " + O.n; bar.style.width = O.h + "%"; bar.style.background = ZG.BANDS[O.b].col;
    renderMap(c);
    var z = sel ? c.zones.find(function (q) { return q.id === sel; }) : null; renderSel(z);
    var ul = document.getElementById("where"); ul.innerHTML = "";
    var bad = c.zones.filter(function (q) { return q.h < 76; }).sort(function (a, b) { return a.h - b.h || a.n.localeCompare(b.n); });
    if (!bad.length) ul.appendChild(el("li", "empty", "Nada estragado: todas as zonas acima de 75%."));
    bad.forEach(function (q) {
      var B = ZG.BANDS[ZG.bandOf(q.h)], li = el("li"), bt = el("button"); bt.type = "button"; bt.dataset.id = q.id; bt.style.setProperty("--dot", B.col);
      bt.appendChild(el("b", null, q.n)); bt.appendChild(document.createTextNode(" · " + B.n + " " + q.h + "% · " + ZG.zoneEffect(q)));
      if (q.id === sel) bt.setAttribute("aria-current", "true");
      bt.addEventListener("click", function () { selectZone(q.id, true); }); li.appendChild(bt); ul.appendChild(li);
    });
    syncScen();
  }
  function renderSel(z) {
    var box = document.getElementById("zsel"), name = document.getElementById("zName"), band = document.getElementById("zBand"), rg = document.getElementById("zHealth"), out = document.getElementById("zHealthOut"), fx = document.getElementById("zFx");
    box.classList.toggle("empty", !z);
    document.querySelectorAll("#bands button").forEach(function (b) { b.disabled = !z; b.setAttribute("aria-pressed", z && +b.dataset.b === ZG.bandOf(z.h) ? "true" : "false"); });
    rg.disabled = !z;
    if (!z) { name.textContent = "Toque numa zona do mapa ou no veículo"; band.textContent = ""; rg.value = 100; out.textContent = "—"; fx.textContent = ""; return; }
    var B = ZG.BANDS[ZG.bandOf(z.h)]; name.textContent = z.n; band.textContent = B.n; band.style.color = B.col;
    rg.value = z.h; out.textContent = z.h + "%"; fx.textContent = "Efeito no jogo: " + ZG.zoneEffect(z);
  }
  function syncScen() { var sc = zs && zs.sc; document.querySelectorAll("#scen button").forEach(function (b) { b.setAttribute("aria-pressed", sc && b.dataset.sc === sc && state !== "tres" ? "true" : "false"); }); }
  (function () {
    ZG.ui.bandButtons(document.getElementById("bands"), function (h) { if (sel) setZoneH(sel, h); });
    ZG.ui.legend(document.getElementById("dmgLegend"));
    var rg = document.getElementById("zHealth"), out = document.getElementById("zHealthOut");
    rg.addEventListener("input", function () { out.textContent = rg.value + "% · " + ZG.BANDS[ZG.bandOf(+rg.value)].n; });
    rg.addEventListener("change", function () { if (sel) setZoneH(sel, +rg.value); });
    ZG.ui.scenarioButtons(document.getElementById("scen"), runScenario);
  })();

  /* ================= folha de contato ================= */
  var sheet = document.getElementById("sheet"), imgs = {};
  ZG.GROUPS.concat(FLEET.map(function (v) { return v.grp; }).filter(function (g, i, a) { return ZG.GROUPS.indexOf(g) < 0 && a.indexOf(g) === i; })).forEach(function (grp) {
    var list = FLEET.filter(function (v) { return v.grp === grp; }); if (!list.length) return;
    sheet.appendChild(el("div", "cat", grp + " · " + list.length));
    var grid = el("div", "grid"); sheet.appendChild(grid);
    list.forEach(function (v) {
      var b = el("button", "card"); b.type = "button"; b.id = "card-" + v.k; b.dataset.k = v.k;
      var im = el("img", "ph"); im.alt = v.n + ", " + inspTxt(v).toLowerCase(); im.width = 320; im.height = 200;
      var sp = el("span"); sp.appendChild(el("strong", null, v.n)); sp.appendChild(el("em", null, inspTxt(v).replace(/^Inspirado/, "inspirado"))); sp.appendChild(el("small", null, (FUELS[v.fuel] || FUELS.nenhum).n.split(" (")[0]));
      b.appendChild(im); b.appendChild(sp); grid.appendChild(b); imgs[v.k] = im;
      b.addEventListener("click", function () { current = FLEET.indexOf(v); zs = null; sel = null; show(); viewerEl.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
    });
  });
  document.getElementById("countTxt").textContent = FLEET.length + " veículos";
  var thumbR = null, thumbScene = null, thumbStage = null, thumbCam = null, thumbJob = 0, thumbsDone = false;
  /* cache das miniaturas: em memória por estado e no localStorage do navegador
     (chave inclui THUMB_VER e a lista da frota; mude THUMB_VER quando um modelo mudar) */
  var THUMB_VER = "v4-final-1", thumbMem = {};
  var thumbSig = THUMB_VER + ":" + (function (t) { var h = 0; for (var j = 0; j < t.length; j++) h = (h * 31 + t.charCodeAt(j)) | 0; return h; })(FLEET.map(function (v) { return v.k + v.n; }).join("|"));
  function thumbKey(st) { return "zg-miniaturas:" + st; }
  function thumbLoad(st) {
    if (/semcache/.test(location.hash)) return {};
    try { var o = JSON.parse(localStorage.getItem(thumbKey(st)) || "null"); return o && o.sig === thumbSig && o.img ? o.img : {}; } catch (e) { return {}; }
  }
  function thumbSave(st, img) {
    if (/semcache/.test(location.hash)) return;
    try { localStorage.setItem(thumbKey(st), JSON.stringify({ sig: thumbSig, img: img })); } catch (e) { /* cota cheia ou bloqueado: segue sem cache */ }
  }
  function renderThumbs(st) {
    if (!renderer) return;
    if (!thumbR) {
      try { thumbR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); thumbR.setSize(320, 200); thumbR.shadowMap.enabled = true; thumbScene = new THREE.Scene(); thumbStage = makeStage(thumbScene); thumbCam = new THREE.PerspectiveCamera(32, 1.6, 0.1, 160); }
      catch (e) { return; }
    }
    var job = ++thumbJob, i = 0, tst = st === "tres" ? "intacto" : st; thumbsDone = false;
    document.getElementById("sheetnote").textContent = "Todos os veículos no estado " + STATE_TXT[tst].t.toLowerCase() + ", agrupados por tipo. Clique em um para abrir no visor.";
    var mem = thumbMem[tst] || (thumbMem[tst] = {}), store = thumbLoad(tst);
    (function next() {
      if (job !== thumbJob) return;
      while (i < FLEET.length && (mem[FLEET[i].k] || store[FLEET[i].k])) { /* miniatura já feita: memória ou cache do navegador */
        var kk = FLEET[i].k; mem[kk] = mem[kk] || store[kk]; imgs[kk].src = mem[kk]; i++;
      }
      if (i >= FLEET.length) { thumbsDone = true; thumbSave(tst, mem); return; }
      var v = FLEET[i], c = ZG.build(v.k, tst);
      thumbStage.water.visible = isWater(v); thumbStage.land.visible = !isWater(v);
      if (isWater(v)) animateWater(thumbStage, 1.0);
      thumbScene.add(c.root);
      var sz = new THREE.Box3().setFromObject(c.g).getSize(new V3());
      placeCamera(thumbCam, { theta: 0.78, phi: 1.12, dist: Math.max(sz.x, sz.z) * 1.25 + 2.4, target: new V3(0, Math.max(0.4, sz.y * 0.4), 0) });
      thumbR.render(thumbScene, thumbCam);
      imgs[v.k].src = mem[v.k] = thumbR.domElement.toDataURL("image/jpeg", 0.82);
      thumbScene.remove(c.root); ZG.dispose(c);
      i++; setTimeout(next, 10);
    })();
  }
  document.querySelectorAll(".seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      var prev = state === "tres" ? "intacto" : state; state = b.dataset.st; zs = null; sel = null; show();
      var now = state === "tres" ? "intacto" : state; if (now !== prev) renderThumbs(state);
    });
  });

  /* ================= combustíveis ================= */
  var tb = document.querySelector("#fuelTable tbody");
  ["gasolina", "etanol", "flex", "diesel", "eletrico", "hibrido", "avgas", "qav"].forEach(function (k) {
    var f = FUELS[k], users = FLEET.filter(function (v) { return v.fuel === k; }).map(function (v) { return v.n; }).join(", ") || "—";
    var tr = el("tr");
    [[f.n, true], [users], [f.onde], [f.rend], [f.val], [f.fx]].forEach(function (cc) { var td = el("td"); if (cc[1]) td.appendChild(el("b", null, cc[0])); else td.textContent = cc[0]; tr.appendChild(td); });
    tb.appendChild(tr);
  });

  /* ================= API de teste para revisores ================= */
  function info() {
    var c = ctxs[0], v = FLEET[current];
    return { k: v.k, n: v.n, grp: v.grp, estado: state, hood: !!(c && c.hood), capoAberto: hoodIsOpen(), capoAngulo: c && c.hood ? +c.hood.ang.toFixed(3) : null, capotado: !!(c && c.flipped), rolando: !!(c && c.rollA),
      explodido: !!(c && c.exploded), saude: c ? ZG.zoneOverall(c).h : null, zonasErr: c && c.zoneErr ? c.zoneErr.slice() : [], motor: c && c.engineHealth != null ? +c.engineHealth.toFixed(2) : null, particulas: c ? c.ps.length : 0, emissores: c ? c.emit.map(function (e) { return e.kind; }) : [], fluidos: c ? c.fluids.map(function (f) { return f.kind; }) : [], pecas: c ? c.log.map(function (p) { return p.n; }) : [],
      vidros: c ? c.glass.length : 0, vidrosQuebrados: c ? c.glass.filter(function (g) { return g.userData.glass && (g.userData.glass.broken || g.userData.glass.hits); }).length : 0, meta: c ? { L: c.meta.L, W: c.meta.W, top: c.meta.top, kind: c.meta.kind } : null };
  }
  /* com o laço pausado (testes), assenta os cacos e pedaços antes da próxima captura */
  function settleShot() { for (var i = 0; i < 75; i++) advance(1 / 30); render(); }
  window.__garage = {
    /* abre o veículo k no estado st (intacto|danificado|modificado|tres) */
    pick: function (k, st) { var i = FLEET.findIndex(function (v) { return v.k === k; }); if (i < 0) throw new Error("Veículo desconhecido: " + k); current = i; state = st || "intacto"; zs = null; sel = null; show(); return info(); },
    /* batida por lado: frente|traseira|esquerda|direita desconta saúde das zonas; capotado anima a capotagem */
    zone: function (z, f) { if (state === "tres") { state = "intacto"; show(); } var c = ctxs[0]; if (z === "capotado") { ZG.roll(c, 1); setTimeout(function wr() { if (ctxs[0] !== c) return; if (!c.flipped) { setTimeout(wr, 300); return; } mergeScenario(c, "capotado"); }, 1900); return []; } var zp = ZG.zonePoint(c, z); return hitAt(zp.p, zp.dir, f || 0.9); },
    /* batida num ponto (coordenadas do veículo) com direção para dentro: desconta saúde da zona atingida */
    hit: function (x, y, z, dx, dy, dz, f) { return hitAt(new V3(x, y, z), new V3(dx, dy, dz).normalize(), f || 0.9); },
    /* batida física antiga (amassa no ponto, sem zonas) */
    impact: function (x, y, z, dx, dy, dz, f) { var h = ZG.impact(ctxs[0], new V3(x, y, z), new V3(dx, dy, dz), f || 0.9); return h.map(function (p) { return p.n; }); },
    /* zonas de dano do veículo aberto: id, nome, tipo, lado, saúde, faixa e efeito no jogo */
    zones: function () { var c = ctxs[0]; return c ? c.zones.map(function (z) { return { id: z.id, n: z.n, tipo: z.type, lado: z.side < 0 ? "esquerdo" : z.side > 0 ? "direito" : "centro", saude: z.h, faixa: ZG.BANDS[ZG.bandOf(z.h)].n, efeito: ZG.zoneEffect(z), interna: !!z.internal }; }) : []; },
    /* define a saúde (0..100) de uma zona; reconstrói o veículo se a faixa mudou */
    setZone: function (id, h) { var r = setZoneH(id, h); if (paused && r && r.reconstruido) settleShot(); return r; },
    /* aplica um cenário pronto: frontal|lateral|capotado|abandonado|horda|queimado (ou o nome por extenso) */
    scenario: function (name) { var r = runScenario(name); if (paused) settleShot(); return r; },
    selectZone: function (id) { selectZone(id); return sel; },
    damage: function () { var c = ctxs[0]; return c ? ZG.zoneOverall(c) : null; },
    zoneState: function () { return cloneZs(zs); },
    /* simula um clique do mouse em coordenadas de tela (px relativos ao canvas, 0..1 se frac) */
    click: function (fx, fy) { var r = canvas.getBoundingClientRect(); return clickHit(r.left + fx * r.width, r.top + fy * r.height); },
    cam: function (t, p, d, tx, ty, tz) { orbit.auto = false; orbit.goal = null; orbit.theta = t; orbit.phi = p; if (d) orbit.dist = d; if (tx != null) orbit.target.set(tx, ty, tz); render(); },
    auto: function (on) { orbit.auto = !!on; },
    /* congela o laço de animação (testes em navegador sem GPU); step() e cam() continuam desenhando */
    pause: function (on) { paused = on !== false; },
    hood: function (open) { var ok = setHood(open == null ? true : !!open); return ok; },
    explode: function () { return explode(); },
    blast: function (dmg) { var c = ctxs[0]; return c ? ZG.blastDamage(c, dmg) : null; },
    roll: function (s) { var c = ctxs[0]; if (!c) return false; if (hoodIsOpen()) setHood(false); return ZG.roll(c, s || 1); },
    fix: function () { if (state === "danificado") state = "intacto"; zs = null; show(true); return info(); },
    wipe: function (mode) { return ZG.wipe(ctxs[0], mode || "limpador"); },
    /* avança a simulação em passos fixos (útil em navegador sem GPU) e redesenha */
    step: function (sec) { var n = Math.round((sec || 1) * 30); for (var i = 0; i < n; i++) advance(1 / 30); render(); return info(); },
    list: function () { return FLEET.map(function (v) { return { k: v.k, n: v.n, grp: v.grp, insp: v.insp, fuel: v.fuel, hood: !!v.hood }; }); },
    info: info,
    parts: function () { var c = ctxs[0]; return c ? c.parts.map(function (p) { return { kind: p.kind, n: p.n, done: !!p.done, pos: [+p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2)] }; }) : []; },
    thumbsDone: function () { return thumbsDone; },
    errors: function () { var c = ctxs[0]; return FX_ERR.concat(c && c.zoneErr ? c.zoneErr : []); },
    ctx: function () { return ctxs[0]; },
    /* para revisores: números do veículo aberto (malhas, triângulos, vidros, peças, bancos, caixa, NaN) */
    audit: function () {
      var c = ctxs[0]; if (!c) return null; var meshes = 0, tris = 0, nan = 0;
      c.g.traverse(function (o) { if (!o.isMesh) return; meshes++; var g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3; var a = g.attributes.position.array; for (var i = 0; i < a.length; i++) if (a[i] !== a[i]) { nan++; break; } });
      c.root.updateMatrixWorld(true); var bb = new THREE.Box3().setFromObject(c.g);
      return { k: FLEET[current].k, state: state, meshes: meshes, tris: Math.round(tris), glass: c.glass.length, parts: c.parts.length, seats: c.seatTops.length, lights: c.lights.length, hood: !!c.hood, bay: c.meta.bay ? c.meta.bay.motor : null, nanMeshes: nan,
        box: [bb.min.toArray().map(function (v) { return +v.toFixed(2); }), bb.max.toArray().map(function (v) { return +v.toFixed(2); })], particles: c.ps ? c.ps.length : 0 };
    },
    /* para revisores: percorre a frota inteira e devolve audit() de cada veículo nos estados pedidos */
    auditAll: function (states) { var out = [], self = this; (states || ["intacto"]).forEach(function (st) { FLEET.forEach(function (v) { self.pick(v.k, st); out.push(self.audit()); }); }); return out; }
  };
  show(); resize(); if (!/semminiaturas/.test(location.hash)) renderThumbs(state); else thumbsDone = true; requestAnimationFrame(loop);
})();
