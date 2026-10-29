/* VehicleSDK · núcleo genérico de veículos 3D (three.js r128)
   Expõe window.VehicleSDK. Nada de conteúdo de jogo aqui: textos de efeito, cenários, fluidos extras, combustíveis e frota
   entram por VehicleSDK.configure / VehicleSDK.plugin (veja sdk/README.md).
   Eixos: +x frente, +y cima, +z lado DIREITO do veículo (motorista à esquerda, z negativo). Chão em y = 0. Unidades em metros. */
(function () {
  "use strict";
  var V3 = THREE.Vector3, PI = Math.PI;
  var ZG = window.VehicleSDK = { THREE: THREE, V3: V3, PI: PI, version: "5.0" };

  /* ================= dados ================= */
  /* Registros preenchidos pelo plugin do jogo (configure({fuels, groups, waterGroups})). */
  ZG.FUELS = {};
  ZG.GROUPS = [];
  ZG.WATER_GROUPS = {};
  /* Configuração viva. Tudo que é conteúdo de jogo entra aqui por configure()/plugin(). */
  ZG.config = {
    defaultGroup: "Veículos",          /* grupo usado quando register() não recebe spec.grp */
    plate: "ABC1D23",                  /* texto padrão de c.plate(...) */
    impactStain: null,                 /* chave de fluido (ZG.fluidTypes) deixada por batidas fortes; null = nenhuma mancha */
    defaultSplat: "mancha",            /* fluido usado por ZG.splat quando o chamador não indica um */
    texts: { who: "quem está desse lado", noEffect: "" }
  };
  ZG.FLEET = [];
  ZG.BUILD = {};
  ZG.register = function (spec, build) {
    if (!spec || !spec.k || typeof build !== "function") throw new Error("ZG.register: spec.k e função de construção são obrigatórios");
    var i = ZG.FLEET.findIndex(function (v) { return v.k === spec.k; });
    spec.build = build; if (!spec.grp) spec.grp = ZG.config.defaultGroup;
    if (i >= 0) ZG.FLEET[i] = spec; else ZG.FLEET.push(spec);
    ZG.BUILD[spec.k] = build;
    return spec;
  };
  ZG.find = function (k) { return ZG.FLEET.find(function (v) { return v.k === k; }) || null; };

  /* ================= utilitários ================= */
  function hash(a, b, c) { var h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return h - Math.floor(h); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function strHash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  ZG.hash = hash; ZG.clamp = clamp; ZG.smooth = smooth;

  /* ================= materiais ================= */
  var RUST = new THREE.Color("#5e3220");   /* ZG.configure({palette:{rust}}) muda o tom de ferrugem da pintura envelhecida */
  var cache = {};
  /* mapa de ambiente de estúdio (cubo de canvas): sem ele, todo material muito metálico (cromo, refletor, alumínio) sai quase preto.
     Céu cinza-azulado, faixa clara no horizonte e chão escuro. Entra sozinho em todo material com metalness >= 0,6. */
  var envTex = null;
  function studioEnv() {
    if (envTex) return envTex;
    var faces = [], S = 64;
    for (var f = 0; f < 6; f++) {
      var cv = document.createElement("canvas"); cv.width = cv.height = S; var x = cv.getContext("2d");
      if (f === 2) { x.fillStyle = "#7d8a99"; x.fillRect(0, 0, S, S); x.fillStyle = "rgba(235,240,245,0.55)"; x.fillRect(S * 0.3, S * 0.3, S * 0.4, S * 0.4); }
      else if (f === 3) { x.fillStyle = "#16181a"; x.fillRect(0, 0, S, S); }
      else {
        var gr = x.createLinearGradient(0, 0, 0, S);
        gr.addColorStop(0, "#7a8796"); gr.addColorStop(0.42, "#b9c2cb"); gr.addColorStop(0.5, "#e6eaee"); gr.addColorStop(0.56, "#5b6066"); gr.addColorStop(1, "#1a1c1e");
        x.fillStyle = gr; x.fillRect(0, 0, S, S);
        if (f === 0 || f === 4) { x.fillStyle = "rgba(255,255,255,0.35)"; x.fillRect(S * 0.15, S * 0.12, S * 0.25, S * 0.22); }
      }
      faces.push(cv);
    }
    envTex = new THREE.CubeTexture(faces); envTex.needsUpdate = true; return envTex;
  }
  ZG.studioEnv = studioEnv;
  function CM(color, o) {
    o = o || {};
    var c = color instanceof THREE.Color ? color : new THREE.Color(color);
    var key = "s" + c.getHexString() + JSON.stringify(o, function (k, v) { return v && v.isColor ? "#" + v.getHexString() : (v && v.isTexture ? v.uuid : v); });
    if (!cache[key]) {
      var o2 = Object.assign({}, o); delete o2.noEnv;
      var mt = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0, flatShading: false }, o2));
      if (!o.envMap && o.noEnv !== true && mt.metalness >= 0.6) { mt.envMap = studioEnv(); if (o.envMapIntensity == null) mt.envMapIntensity = 0.55 + (mt.metalness - 0.6) * 1.6; }
      cache[key] = mt;
    }
    return cache[key];
  }
  function FM(color, o) { return CM(color, Object.assign({ flatShading: true, roughness: 0.92 }, o || {})); }
  var DS = THREE.DoubleSide;
  function E(hex) { return new THREE.Color(hex); }
  var MT = {
    trim: CM("#17191b", { roughness: 0.7 }),
    rubber: CM("#111111", { roughness: 0.95, side: DS }),
    chrome: CM("#b8bcbf", { metalness: 0.9, roughness: 0.28 }),
    steel: CM("#6c7175", { metalness: 0.7, roughness: 0.45 }),
    glass: CM("#2a3c44", { roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.4, depthWrite: false, side: DS }),
    tint: CM("#121a1e", { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.62, depthWrite: false, side: DS }),
    /* vidro traseiro: mais escuro, para o interior não parecer uma caçamba aberta vista de trás */
    rearTint: CM("#0c1114", { roughness: 0.04, metalness: 0.45, transparent: true, opacity: 0.84, depthWrite: false, side: DS }),
    glassDark: CM("#0c1317", { roughness: 0.06, metalness: 0.75, side: DS }),
    armorGlass: CM("#1d302d", { roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.6, depthWrite: false, side: DS }),
    glassEdge: CM("#a9bcc1", { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: DS }),
    lens: CM("#eef3f5", { roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false }),
    lensRed: CM("#c0281c", { roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.42, depthWrite: false }),
    lensAmber: CM("#d88a2a", { roughness: 0.04, transparent: true, opacity: 0.4, depthWrite: false }),
    housing: CM("#111214", { roughness: 0.45, metalness: 0.2 }),
    reflector: CM("#dfe3e6", { metalness: 0.9, roughness: 0.12, side: DS }),
    reflectorLit: CM("#e8e2cc", { metalness: 0.6, roughness: 0.18, emissive: E("#cfc19a"), emissiveIntensity: 1.6, side: DS }),
    hole: CM("#040506", { roughness: 1, side: DS }),
    dark: CM("#0a0b0c", { roughness: 1, side: DS }),
    head: CM("#efe6c9", { emissive: E("#f0dcaa"), emissiveIntensity: 1.7, roughness: 0.2 }),
    led: CM("#e6f2ff", { emissive: E("#cfe6ff"), emissiveIntensity: 1.6, roughness: 0.2 }),
    tail: CM("#8a1a14", { emissive: E("#7a0d08"), emissiveIntensity: 0.8, roughness: 0.25 }),
    amber: CM("#c8781e", { emissive: E("#b0600c"), emissiveIntensity: 0.8, roughness: 0.3 }),
    rev: CM("#cfcfc8", { emissive: E("#5a5a55"), emissiveIntensity: 0.35, roughness: 0.3 }),
    blue: CM("#1d4f9a", { emissive: E("#2f6fe0"), emissiveIntensity: 1.2, roughness: 0.3 }),
    green: CM("#1d7a3a", { emissive: E("#2fbf5a"), emissiveIntensity: 1.0, roughness: 0.3 }),
    broken: CM("#1b1b1a", { roughness: 0.6 }),
    bulbBroken: CM("#232220", { roughness: 0.7, metalness: 0.2 }),
    wood: CM("#6b4a2e", { roughness: 0.9 }),
    leather: CM("#4a2f20", { roughness: 0.7 }),
    seat: CM("#1e1f22", { roughness: 0.85 }),
    alu: CM("#8e959a", { metalness: 0.6, roughness: 0.42, side: DS }),
    carpet: CM("#141517", { roughness: 1 }),
    plastic: CM("#1f2023", { roughness: 0.75 }),
    headliner: CM("#6f6c66", { roughness: 0.95, side: DS }),
    gauge: CM("#0d1512", { emissive: E("#4fbf8a"), emissiveIntensity: 0.35, roughness: 0.4 }),
    screen: CM("#0b1220", { emissive: E("#3d6cb0"), emissiveIntensity: 0.4, roughness: 0.2 }),
    bay: CM("#2c3033", { roughness: 0.8, metalness: 0.2, emissive: E("#0c0e10"), emissiveIntensity: 1, side: DS }),
    hoodLiner: CM("#1c1d1e", { roughness: 0.95, side: DS }),
    block: CM("#a3abb0", { metalness: 0.55, roughness: 0.38, emissive: E("#1a1d1f"), emissiveIntensity: 1 }),
    cover: CM("#3c4044", { metalness: 0.4, roughness: 0.35, emissive: E("#101213"), emissiveIntensity: 1 }),
    radiator: CM("#3a3f42", { metalness: 0.5, roughness: 0.55 }),
    yellow: CM("#e0b81c", { roughness: 0.4 }),
    capBlue: CM("#2a63c4", { roughness: 0.4 }),
    postRed: CM("#b3261e", { roughness: 0.4 }),
    postBlack: CM("#0c0c0c", { roughness: 0.4 }),
    coolant: CM("#e85fa3", { roughness: 0.15, transparent: true, opacity: 0.5, depthWrite: false }),
    coolantLiq: CM("#d0307a", { roughness: 0.3, emissive: E("#3a0a1e"), emissiveIntensity: 0.4 }),
    washer: CM("#9fd2ea", { roughness: 0.15, transparent: true, opacity: 0.5, depthWrite: false }),
    hv: CM("#e4670f", { roughness: 0.5 }),
    hose: CM("#121212", { roughness: 0.8 })
  };
  ZG.CM = CM; ZG.FM = FM; ZG.MT = MT;

  function paintCol(hex, st) { var c = new THREE.Color(hex); if (st === "danificado") { c.lerp(RUST, 0.22); c.multiplyScalar(0.9); } return c; }
  ZG.paintCol = paintCol;

  var texCache = {};
  function textTex(text, o) {
    o = o || {};
    var key = text + JSON.stringify(o);
    if (texCache[key]) return texCache[key];
    var w = o.w || 512, h = o.h || 128, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    var x = cv.getContext("2d");
    if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, w, h); }
    if (o.band) { x.fillStyle = o.band; x.fillRect(0, 0, w, h * 0.24); x.fillStyle = "#fff"; x.font = "600 " + Math.round(h * 0.15) + "px 'IBM Plex Sans', Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("BRASIL", w / 2, h * 0.125); }
    x.fillStyle = o.fg || "#111"; x.textAlign = "center"; x.textBaseline = "middle";
    /* ajusta a fonte até o texto caber na largura (nunca corta) */
    var fs = Math.round(h * (o.size || 0.6)), fam = (o.weight || "700") + " ", ff = "px " + (o.font || "'Saira Condensed', 'Arial Narrow', sans-serif");
    x.font = fam + fs + ff;
    while (fs > 6 && x.measureText(text).width > w * 0.94) { fs -= 1; x.font = fam + fs + ff; }
    x.fillText(text, w / 2, o.band ? h * 0.62 : h / 2 + 2);
    var t = new THREE.CanvasTexture(cv); texCache[key] = t; return t;
  }
  ZG.textTex = textTex;

  /* ================= geometria ================= */
  function rboxGeo(w, h, d, r) {
    r = Math.max(0.002, Math.min(r, w * 0.45, h * 0.45, d * 0.45));
    var nb = 3, n = 2 * nb + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
    var p = g.attributes.position, nr = g.attributes.normal, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    function map(v, hi) { var i = Math.round((v + 0.5) * n); return i <= nb ? -hi - r * (nb - i) / nb : hi + r * (i - nb - 1) / nb; }
    var q = new V3(), c = new V3(), dir = new V3();
    for (var i = 0; i < p.count; i++) {
      q.set(map(p.getX(i), hx), map(p.getY(i), hy), map(p.getZ(i), hz));
      c.set(clamp(q.x, -hx, hx), clamp(q.y, -hy, hy), clamp(q.z, -hz, hz));
      dir.subVectors(q, c);
      if (dir.lengthSq() > 1e-12) { dir.normalize(); q.copy(c).addScaledVector(dir, r); nr.setXYZ(i, dir.x, dir.y, dir.z); }
      p.setXYZ(i, q.x, q.y, q.z);
    }
    return g;
  }
  function taper(geo, t) {
    geo.computeBoundingBox();
    var bb = geo.boundingBox, h = bb.max.y - bb.min.y, p = geo.attributes.position, sx = t.sx == null ? 1 : t.sx, sz = t.sz == null ? 1 : t.sz, sh = t.shift || 0;
    for (var i = 0; i < p.count; i++) {
      var k = (p.getY(i) - bb.min.y) / h;
      p.setX(i, p.getX(i) * (1 + (sx - 1) * k) + sh * k);
      p.setZ(i, p.getZ(i) * (1 + (sz - 1) * k));
    }
    p.needsUpdate = true; geo.computeVertexNormals();
  }
  function subdivide(geo, maxLen) {
    var src = geo.index ? geo.toNonIndexed() : geo, a = src.attributes.position.array, out = [];
    function d(p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
    function m(p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]; }
    function tri(A, B, C, depth) {
      var ab = d(A, B), bc = d(B, C), ca = d(C, A), mx = Math.max(ab, bc, ca);
      if (mx <= maxLen || depth > 12) { out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]); return; }
      if (mx === ab) { var D = m(A, B); tri(A, D, C, depth + 1); tri(D, B, C, depth + 1); }
      else if (mx === bc) { var E2 = m(B, C); tri(A, B, E2, depth + 1); tri(A, E2, C, depth + 1); }
      else { var F = m(C, A); tri(A, B, F, depth + 1); tri(F, B, C, depth + 1); }
    }
    for (var i = 0; i < a.length; i += 9) tri([a[i], a[i + 1], a[i + 2]], [a[i + 3], a[i + 4], a[i + 5]], [a[i + 6], a[i + 7], a[i + 8]], 0);
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3)); g.userData.crease = true; return g;
  }
  function crease(geo, deg) {
    if (geo.index) { var ni = geo.toNonIndexed(); Object.keys(ni.attributes).forEach(function (k) { geo.setAttribute(k, ni.attributes[k]); }); geo.setIndex(null); }
    var p = geo.attributes.position, n = p.count, FN = [], map = {}, A = new V3(), B = new V3(), C = new V3(), e1 = new V3(), e2 = new V3();
    function key(i) { return Math.round(p.getX(i) * 2000) + "," + Math.round(p.getY(i) * 2000) + "," + Math.round(p.getZ(i) * 2000); }
    var keys = new Array(n);
    for (var f = 0; f < n / 3; f++) {
      A.fromBufferAttribute(p, 3 * f); B.fromBufferAttribute(p, 3 * f + 1); C.fromBufferAttribute(p, 3 * f + 2);
      var nn = new V3().crossVectors(e1.subVectors(C, B), e2.subVectors(A, B)); if (nn.lengthSq() > 1e-20) nn.normalize(); FN.push(nn);
      for (var k = 0; k < 3; k++) { var kk = key(3 * f + k); keys[3 * f + k] = kk; (map[kk] || (map[kk] = [])).push(f); }
    }
    var cs = Math.cos(deg * PI / 180), out = new Float32Array(n * 3), s = new V3();
    for (var i = 0; i < n; i++) {
      var fi = (i / 3) | 0, list = map[keys[i]]; s.set(0, 0, 0);
      for (var j = 0; j < list.length; j++) { var g = FN[list[j]]; if (g.dot(FN[fi]) >= cs) s.add(g); }
      if (s.lengthSq() < 1e-20) s.copy(FN[fi]); s.normalize(); out[3 * i] = s.x; out[3 * i + 1] = s.y; out[3 * i + 2] = s.z;
    }
    geo.setAttribute("normal", new THREE.BufferAttribute(out, 3)); geo.userData.crease = true; return geo;
  }
  function pathShape(items) {
    var s = new THREE.Shape(), n = items.length;
    function sp(it) { return it.arc ? [it.arc[0] + it.arc[2] * Math.cos(it.arc[3]), it.arc[1] + it.arc[2] * Math.sin(it.arc[3])] : [it[0], it[1]]; }
    function ep(it) { return it.arc ? [it.arc[0] + it.arc[2] * Math.cos(it.arc[4]), it.arc[1] + it.arc[2] * Math.sin(it.arc[4])] : [it[0], it[1]]; }
    var ins = [], outs = [];
    for (var i = 0; i < n; i++) {
      var it = items[i];
      if (it.arc) { ins.push(sp(it)); outs.push(ep(it)); continue; }
      var r = it[2] || 0, pv = ep(items[(i - 1 + n) % n]), nx = sp(items[(i + 1) % n]);
      var dp = Math.hypot(pv[0] - it[0], pv[1] - it[1]) || 1, dn = Math.hypot(nx[0] - it[0], nx[1] - it[1]) || 1;
      var rp = Math.min(r, dp * 0.45), rn = Math.min(r, dn * 0.45);
      ins.push([it[0] + (pv[0] - it[0]) / dp * rp, it[1] + (pv[1] - it[1]) / dp * rp]);
      outs.push([it[0] + (nx[0] - it[0]) / dn * rn, it[1] + (nx[1] - it[1]) / dn * rn]);
    }
    s.moveTo(outs[0][0], outs[0][1]);
    for (var j = 1; j <= n; j++) {
      var idx = j % n, it2 = items[idx];
      s.lineTo(ins[idx][0], ins[idx][1]);
      if (it2.arc) s.absarc(it2.arc[0], it2.arc[1], it2.arc[2], it2.arc[3], it2.arc[4], !!it2.arc[5]);
      else if ((it2[2] || 0) > 0) s.quadraticCurveTo(it2[0], it2[1], outs[idx][0], outs[idx][1]);
    }
    return s;
  }
  function tumble(geo, T) {
    if (!T) return;
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) { var t = clamp((p.getY(i) - T.belt) / (T.top - T.belt), 0, 1); p.setZ(i, p.getZ(i) * (1 - T.k * t)); }
    p.needsUpdate = true;
  }
  function loftGeo(st, seg, pw, colorFn) {
    seg = seg || 22; pw = pw || 2;
    var pos = [], col = [], idx = [], ring = seg + 1;
    st.forEach(function (s) {
      for (var j = 0; j <= seg; j++) {
        var a = j / seg * PI * 2, c = Math.cos(a), sn = Math.sin(a);
        var e = 2 / (s.p || pw), yy = s.y + s.h / 2 * Math.sign(sn) * Math.pow(Math.abs(sn), e), zz = s.w / 2 * Math.sign(c) * Math.pow(Math.abs(c), e);
        pos.push(s.x, yy, zz);
        if (colorFn) { var cc = colorFn(s.x, yy, zz, s); col.push(cc.r, cc.g, cc.b); }
      }
    });
    for (var i = 0; i < st.length - 1; i++) for (var k = 0; k < seg; k++) { var a0 = i * ring + k, b0 = a0 + ring; idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
    [0, st.length - 1].forEach(function (si, e) {
      var s = st[si]; if (s.w < 0.01) return;
      var ci = pos.length / 3; pos.push(s.x, s.y, 0); if (colorFn) { var cc = colorFn(s.x, s.y, 0, s); col.push(cc.r, cc.g, cc.b); }
      for (var k = 0; k < seg; k++) { var a = si * ring + k; if (e === 0) idx.push(ci, a + 1, a); else idx.push(ci, a, a + 1); }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    if (colorFn) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function hullGeo(o, colorFn) {
    var n = o.n || 18, m = 14, pos = [], col = [], idx = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = -o.L / 2 + t * o.L, b = o.beam(t), ky = o.keel(t), sy = o.sheer(t);
      for (var j = 0; j <= m; j++) {
        var v = j / m * 2 - 1, z = b * v, y = ky + (sy - ky) * Math.pow(Math.abs(v), o.p || 2);
        pos.push(x, y, z); if (colorFn) { var c = colorFn(x, y, z); col.push(c.r, c.g, c.b); }
      }
    }
    for (var a = 0; a < n; a++) for (var k = 0; k < m; k++) { var p0 = a * (m + 1) + k, p1 = p0 + m + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
    var ci = pos.length / 3, x0 = -o.L / 2, sy0 = o.sheer(0);
    pos.push(x0, sy0, 0); if (colorFn) { var c0 = colorFn(x0, sy0, 0); col.push(c0.r, c0.g, c0.b); }
    for (var q = 0; q < m; q++) idx.push(ci, q, q + 1);
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    if (colorFn) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  /* Recorta triângulos: cada teste { sel(normal, centro) -> bool, sdf(x,y,z) -> número (negativo = remover), tag }.
     Triângulos que cruzam a borda são cortados na linha sdf = 0. Peças removidas com tag voltam em .cut[tag]. */
  function cutGeo(geo, tests) {
    var src = geo.index ? geo.toNonIndexed() : geo;
    var names = ["position"].concat(["color", "uv"].filter(function (n) { return !!src.attributes[n]; }));
    var sizes = names.map(function (n) { return src.attributes[n].itemSize; }), arrs = names.map(function (n) { return src.attributes[n].array; });
    var nv = src.attributes.position.count, tris = [];
    for (var f = 0; f < nv; f += 3) {
      var t = [];
      for (var k = 0; k < 3; k++) { var v = []; for (var a = 0; a < names.length; a++) for (var q = 0; q < sizes[a]; q++) v.push(arrs[a][(f + k) * sizes[a] + q]); t.push(v); }
      tris.push(t);
    }
    var cut = {}, n = new V3(), e1 = new V3(), e2 = new V3(), ce = new V3();
    function lerp(P, Q, k) { var o = new Array(P.length); for (var i = 0; i < P.length; i++) o[i] = P[i] + (Q[i] - P[i]) * k; return o; }
    function clip(t, d, s) { var out = []; for (var i = 0; i < 3; i++) { var j = (i + 1) % 3, di = s * d[i], dj = s * d[j]; if (di >= 0) out.push(t[i]); if ((di >= 0) !== (dj >= 0)) out.push(lerp(t[i], t[j], di / (di - dj))); } return out; }
    function fan(poly, arr) { for (var i = 1; i < poly.length - 1; i++) arr.push([poly[0], poly[i], poly[i + 1]]); }
    tests.forEach(function (T) {
      var next = [], rem = T.tag ? (cut[T.tag] = cut[T.tag] || []) : null;
      tris.forEach(function (t) {
        var A = t[0], B = t[1], C = t[2];
        e1.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]); e2.set(C[0] - A[0], C[1] - A[1], C[2] - A[2]); n.crossVectors(e1, e2);
        var len = n.length(); if (len < 1e-12) { next.push(t); return; } n.multiplyScalar(1 / len);
        ce.set((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3);
        if (T.sel && !T.sel(n, ce)) { next.push(t); return; }
        var d = [T.sdf(A[0], A[1], A[2]), T.sdf(B[0], B[1], B[2]), T.sdf(C[0], C[1], C[2])];
        var ins = (d[0] < 0 ? 1 : 0) + (d[1] < 0 ? 1 : 0) + (d[2] < 0 ? 1 : 0);
        if (ins === 0) next.push(t);
        else if (ins === 3) { if (rem) rem.push(t); }
        else { fan(clip(t, d, 1), next); if (rem) fan(clip(t, d, -1), rem); }
      });
      tris = next;
    });
    function build(list) {
      var g = new THREE.BufferGeometry(), off = 0;
      names.forEach(function (nm, a) {
        var arr = new Float32Array(list.length * 3 * sizes[a]), w = 0;
        list.forEach(function (t) { for (var k = 0; k < 3; k++) for (var q = 0; q < sizes[a]; q++) arr[w++] = t[k][off + q]; });
        g.setAttribute(nm, new THREE.BufferAttribute(arr, sizes[a])); off += sizes[a];
      });
      g.userData.crease = true; return g;
    }
    var out = { geo: build(tris), cut: {} };
    Object.keys(cut).forEach(function (k) { out.cut[k] = crease(build(cut[k]), 42); });
    return out;
  }
  /* Junta geometrias (já transformadas) numa só, para peças repetidas como elos de esteira e colmeia. */
  function mergeGeos(list) {
    var pos = [], nor = [];
    list.forEach(function (g) {
      var n = g.index ? g.toNonIndexed() : g; if (!n.attributes.normal) n.computeVertexNormals();
      var pa = n.attributes.position.array, na = n.attributes.normal.array;
      for (var i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
    });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return g;
  }
  /* UV normalizado 0..1 projetando nos dois eixos de maior extensão (ou nos eixos dados, ex. "xy"). */
  function uvProject(geo, axes) {
    geo.computeBoundingBox(); var bb = geo.boundingBox, sz = new V3().subVectors(bb.max, bb.min);
    var ax = axes ? [axes.charCodeAt(0) - 120, axes.charCodeAt(1) - 120] : [0, 1, 2].sort(function (a, b) { return sz.getComponent(b) - sz.getComponent(a); }).slice(0, 2).sort();
    var p = geo.attributes.position, uv = new Float32Array(p.count * 2), v = new V3();
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      uv[2 * i] = (v.getComponent(ax[0]) - bb.min.getComponent(ax[0])) / (sz.getComponent(ax[0]) || 1);
      uv[2 * i + 1] = (v.getComponent(ax[1]) - bb.min.getComponent(ax[1])) / (sz.getComponent(ax[1]) || 1);
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return sz.getComponent(ax[0]) / (sz.getComponent(ax[1]) || 1);
  }
  ZG.geo = { rbox: rboxGeo, taper: taper, subdivide: subdivide, crease: crease, pathShape: pathShape, tumble: tumble, loft: loftGeo, hull: hullGeo, cut: cutGeo, merge: mergeGeos, uvProject: uvProject };

  /* Furos prontos para shell({ holes }) e ZG.geo.cut */
  ZG.holeTop = function (x0, x1, z, yMin, tag) {
    return { tag: tag, sel: function (n, ce) { return n.y > 0.3 && ce.y > yMin; }, sdf: function (x, y, zz) { return Math.max(x0 - x, x - x1, Math.abs(zz) - z); } };
  };
  ZG.holeSide = function (poly, o) {
    o = o || {};
    var area = 0; for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    var sg = area > 0 ? 1 : -1, E2 = poly.map(function (a, i) { var b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [a[0], a[1], sg * dy / L, -sg * dx / L]; });
    var sh = o.shrink || 0, zMin = o.zMin || 0;
    return { tag: o.tag, sel: function (n, ce) { return Math.abs(n.z) > 0.5 && Math.abs(ce.z) >= zMin && (o.side == null || Math.sign(ce.z) === o.side); },
      sdf: function (x, y) { var d = -1e9; for (var i = 0; i < E2.length; i++) { var e = E2[i]; d = Math.max(d, (x - e[0]) * e[2] + (y - e[1]) * e[3]); } return d + sh; } };
  };
  ZG.holeQuad = function (q, margin) {
    margin = margin || 0;
    return { sel: function (n) { return n.x * q.n[0] + n.y * q.n[1] > 0.55; }, sdf: function (x, y, z) {
      var rx = x - q.pb[0], ry = y - q.pb[1], s = rx * q.u[0] + ry * q.u[1], dn = rx * q.n[0] + ry * q.n[1];
      var s0 = q.ins, s1 = q.L - q.ins * 1.3, k = clamp((s - s0) / (s1 - s0), 0, 1), hw = q.hb + (q.ht - q.hb) * k - margin;
      return Math.max(s0 + margin - s, s - s1 + margin, Math.abs(z) - hw, Math.abs(dn - q.bev) - 0.08);
    } };
  };
  ZG.holeBox = function (min, max, sel, tag) {
    return { tag: tag, sel: sel || null, sdf: function (x, y, z) { return Math.max(min[0] - x, x - max[0], min[1] - y, y - max[1], min[2] - z, z - max[2]); } };
  };
  ZG.holeWhere = function (sel, tag) { return { tag: tag, sel: sel, sdf: function () { return -1; } }; };

  /* ================= contexto de construção ================= */
  function Ctx(st, seed) {
    this.root = new THREE.Group(); this.g = new THREE.Group(); this.fx = new THREE.Group();
    this.root.add(this.g); this.root.add(this.fx);
    this.st = st; this.glass = []; this.quads = []; this.deform = []; this.wheels = []; this.parts = []; this.spin = []; this.lights = [];
    this.fluids = []; this.meta = {}; this.log = []; this.paints = new Set(); this.zoneDefs = []; this.ps = []; this.emit = []; this.seatTops = []; this.hood = null; this.rollA = null;
    this.flipped = false; this.time = 0; this.rand = rng(seed || 7);
  }
  ZG.Ctx = Ctx;
  var P = Ctx.prototype;
  P.add = function (geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; (parent || this.g).add(m); return m; };
  /* pintura; meta.matte (ou o.matte) dá acabamento fosco a tudo, inclusive peças criadas depois (dano, capô) */
  P.paint = function (hex, o) {
    o = Object.assign({}, o || {}); var matte = o.matte != null ? o.matte : this.meta.matte; delete o.matte;
    var base = matte ? { roughness: this.st === "danificado" ? 0.92 : 0.82, metalness: 0.08, side: DS } : { roughness: this.st === "danificado" ? 0.75 : 0.42, metalness: 0.3, side: DS };
    var pm = CM(paintCol(hex, this.st), Object.assign(base, o)); this.paints.add(pm); return pm;
  };
  P.rb = function (w, h, d, r, mat, x, y, z, o) {
    o = o || {};
    var geo = rboxGeo(w, h, d, r); if (o.taper) taper(geo, o.taper);
    if (o.sub) geo = crease(subdivide(geo, o.sub), 40);
    else if (o.def) geo = crease(geo.toNonIndexed(), 50);
    var m = this.add(geo, mat, x, y, z, o.parent);
    if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    if (o.def) this.deform.push(m);
    return m;
  };
  P.cyl = function (r1, r2, h, mat, x, y, z, axis, o) {
    o = o || {};
    var m = this.add(new THREE.CylinderGeometry(r1, r2, h, o.seg || 20, 1, !!o.open), mat, x, y, z, o.parent);
    if (axis === "x") m.rotation.z = -PI / 2; else if (axis === "z") m.rotation.x = PI / 2;
    return m;
  };
  P.sph = function (r, mat, x, y, z, sx, sy, sz, o) {
    o = o || {};
    var m = this.add(new THREE.SphereGeometry(r, o.ws || 18, o.hs || 12, 0, PI * 2, 0, o.tl || PI), mat, x, y, z, o.parent);
    m.scale.set(sx || 1, sy || 1, sz || 1); return m;
  };
  P.rod = function (a, b, r, mat, o) {
    o = o || {};
    var len = a.distanceTo(b), m = this.add(new THREE.CylinderGeometry(r, o.r2 == null ? r : o.r2, len, o.seg || 10), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, o.parent);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3().subVectors(b, a).normalize()); return m;
  };
  P.tube = function (pts, r, mat, o) {
    o = o || {};
    var curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return p.isVector3 ? p.clone() : new V3(p[0], p[1], p[2] || 0); }), !!o.closed);
    return this.add(new THREE.TubeGeometry(curve, o.seg || 40, r, o.rs || 8, !!o.closed), mat, 0, 0, 0, o.parent);
  };
  P.text = function (txt, w, h, x, y, z, face, o) {
    o = o || {};
    var mat = new THREE.MeshStandardMaterial({ map: textTex(txt, o), transparent: !o.bg, roughness: 0.6, alphaTest: o.bg ? 0 : 0.3 });
    if (o.glow) { mat.emissive = new THREE.Color(o.glow); mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.6; }
    var m = this.add(new THREE.PlaneGeometry(w, h), mat, x, y, z, o.parent); m.castShadow = false;
    if (face === "+y" || face === "-y") m.rotation.x = face === "+y" ? -PI / 2 : PI / 2;
    else m.rotation.y = { "+z": 0, "-z": PI, "+x": PI / 2, "-x": -PI / 2 }[face] || 0;
    return m;
  };
  P.plate = function (x, y, z, face, txt) {
    /* a placa é rígida: a deformação suave da carroceria (warp, esculpir) não a entorta; o amassado a leva como corpo rígido */
    var pl = this.text(txt || ZG.config.plate, 0.4, 0.13, x, y, z, face, { w: 400, h: 130, bg: "#f2f2ee", band: "#1f4fa3", fg: "#151515", size: 0.5, font: "'IBM Plex Mono', monospace", weight: "500" });
    pl.userData.noWarp = true; pl.userData.plate = true; return pl;
  };
  P.part = function (kind, label, obj, pos, reach, o) {
    var pt = Object.assign({ kind: kind, n: label, obj: obj, pos: pos.clone ? pos.clone() : new V3(pos[0], pos[1], pos[2]), reach: reach || 1 }, o || {});
    this.parts.push(pt); return pt;
  };
  P.wheel = function (x, z, r, w, o) {
    o = o || {};
    var s = z >= 0 ? 1 : -1, g = new THREE.Group(); g.position.set(x, o.y == null ? r : o.y, z); this.g.add(g);
    var rr = r * (o.rimR || 0.6);
    var prof = [[rr, -w / 2 + 0.01], [r - 0.06, -w / 2], [r - 0.015, -w / 2 + 0.035], [r, -w / 2 + 0.08], [r, w / 2 - 0.08], [r - 0.015, w / 2 - 0.035], [r - 0.06, w / 2], [rr, w / 2 - 0.01]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var tire = new THREE.Mesh(crease(new THREE.LatheGeometry(prof, 30).toNonIndexed(), 55), MT.rubber);
    tire.rotation.x = PI / 2; tire.castShadow = true; g.add(tire);
    if (o.lugs) {
      var nl = Math.round(r * 30), lugs = [];
      for (var i = 0; i < nl; i++) {
        var a = i / nl * PI * 2;
        [-1, 1].forEach(function (sd) {
          var lk = clamp(r / 0.55, 0.45, 1), lg = rboxGeo((0.07 + r * 0.04) * lk, (0.05 + r * 0.03) * lk, w * 0.42, 0.015 * lk), M = new THREE.Matrix4().compose(new V3(Math.cos(a) * (r + 0.01 * clamp(r / 0.55, 0.45, 1)), Math.sin(a) * (r + 0.01 * clamp(r / 0.55, 0.45, 1)), sd * w * 0.24), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sd * (o.chevron ? 0.45 : 0), a)), new V3(1, 1, 1));
          lg.applyMatrix4(M); lugs.push(lg);
        });
      }
      var lm = new THREE.Mesh(mergeGeos(lugs), MT.rubber); lm.castShadow = true; g.add(lm);
    }
    var rimMat = o.rim || MT.steel;
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w * 0.78, 24), rimMat); rim.rotation.x = PI / 2; g.add(rim);
    var dish = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.92, rr * 0.7, 0.05, 24), rimMat); dish.rotation.x = PI / 2; dish.position.z = s * w * 0.36; g.add(dish);
    var ns = o.spokes == null ? 5 : o.spokes;
    for (var k = 0; k < ns; k++) {
      var sp = new THREE.Mesh(rboxGeo(rr * 0.85, rr * 0.2, 0.04, 0.015), o.spokeMat || rimMat), a2 = k / ns * PI * 2;
      sp.position.set(Math.cos(a2) * rr * 0.45, Math.sin(a2) * rr * 0.45, s * (w * 0.4)); sp.rotation.z = a2; g.add(sp);
    }
    var cap = new THREE.Mesh(new THREE.SphereGeometry(rr * 0.22, 14, 8), MT.chrome); cap.scale.z = 0.5; cap.position.z = s * w * 0.42; g.add(cap);
    for (var n = 0; n < 5; n++) { var nut = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6), MT.chrome), an = n / 5 * PI * 2 + 0.3; nut.rotation.x = PI / 2; nut.position.set(Math.cos(an) * rr * 0.33, Math.sin(an) * rr * 0.33, s * w * 0.43); g.add(nut); }
    g.userData.r = r; this.wheels.push(g);
    if (!o.noPart) this.part("roda", o.label || ((x >= 0 ? "Pneu dianteiro " : "Pneu traseiro ") + (s > 0 ? "direito" : "esquerdo")), g, new V3(x, r, z + s * w * 0.4), 0.9);
    return g;
  };
  /* ponto em coordenadas de c.g -> coordenadas do grupo de partículas (mundo do veículo, chão y = 0) */
  P.toFx = function (p) { this.g.updateMatrix(); return p.clone().applyMatrix4(this.g.matrix); };
  P.dirFx = function (d) { return d.clone().applyQuaternion(this.g.quaternion); };

  /* ================= carrocerias ================= */
  function halfAt(Wg, T, y) { return Wg / 2 * (T ? 1 - T.k * clamp((y - T.belt) / (T.top - T.belt), 0, 1) : 1); }
  ZG.halfAt = halfAt;
  function shell(c, o) {
    var items = o.items.slice();
    if (o.arches) o.arches.slice().sort(function (a, b) { return b[0] - a[0]; }).forEach(function (a) {
      var a0 = Math.asin(clamp((o.bottomY - a[1]) / a[2], -1, 1)); items.push({ arc: [a[0], a[1], a[2], a0, PI - a0, false] });
    });
    var bev = o.bev == null ? 0.05 : o.bev;
    var geo = new THREE.ExtrudeGeometry(pathShape(items), { depth: Math.max(0.01, o.W - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 14, steps: 1 });
    geo.translate(0, 0, -(o.W - 2 * bev) / 2);
    geo = subdivide(geo, o.sub || 0.2); tumble(geo, o.T);
    var tests = (o.holes || []).slice(), cut = {};
    if (o.arches && o.archInner != null) o.arches.forEach(function (a) {
      var zk = o.archInner;
      tests.push({ sel: function (n, ce) { var dx = a[0] - ce.x, dy = a[1] - ce.y, d = Math.hypot(dx, dy) || 1; return d < a[2] + 0.08 && (n.x * dx + n.y * dy) / d > 0.4; }, sdf: function (x, y, z) { return Math.abs(z) - zk; } });
    });
    if (tests.length) { var r = cutGeo(geo, tests); geo = r.geo; cut = r.cut; }
    crease(geo, 42);
    var m = c.add(geo, o.mat || c.paint(o.col)); c.deform.push(m); m.userData.cut = cut;
    if (o.arches) o.arches.forEach(function (a) {
      var a0 = Math.asin(clamp((o.bottomY - a[1]) / a[2], -1, 1)), rr = a[2] - 0.01;
      if (o.archInner == null) {
        var wl = c.add(new THREE.CylinderGeometry(rr, rr, o.W - 0.12, 20, 1, true, a0 + PI / 2, PI - 2 * a0), MT.dark, a[0], a[1], 0);
        wl.rotation.x = PI / 2; wl.castShadow = false;
      } else [1, -1].forEach(function (s) {
        var len = (o.W / 2 - 0.06) - o.archInner;
        var w2 = c.add(new THREE.CylinderGeometry(rr, rr, len, 20, 1, true, a0 + PI / 2, PI - 2 * a0), MT.dark, a[0], a[1], s * (o.archInner + len / 2));
        w2.rotation.x = PI / 2; w2.castShadow = false;
        var cap = c.add(new THREE.CircleGeometry(rr, 20, a0, PI - 2 * a0), MT.dark, a[0], a[1], s * o.archInner); cap.castShadow = false;
      });
    });
    return m;
  }
  ZG.shell = shell;
  function autoWindows(gh) {
    var inn = 0.075, yb = gh.belt + 0.06, yt = gh.roof - 0.075;
    function lx(x0, x1, y) { return x0 + (x1 - x0) * (y - gh.belt) / (gh.roof - gh.belt); }
    function rearX(y) { return lx(gh.rb, gh.rt, y) + inn * 1.3; }
    function frontX(y) { return lx(gh.fb, gh.ft, y) - inn * 1.3; }
    var ps = gh.pillars.slice().sort(function (a, b) { return a - b; }), bounds = [-1e9];
    ps.forEach(function (p) { bounds.push(p - 0.06, p + 0.06); }); bounds.push(1e9);
    var polys = [];
    for (var i = 0; i < bounds.length; i += 2) {
      (function (xa, xb) {
        var L = function (y) { return Math.max(xa, rearX(y)); }, R = function (y) { return Math.min(xb, frontX(y)); };
        if (R(yb) - L(yb) > 0.15 && R(yt) - L(yt) > 0.05) polys.push([[L(yb), yb], [R(yb), yb], [R(yt), yt], [L(yt), yt]]);
      })(bounds[i], bounds[i + 1]);
    }
    return polys;
  }
  ZG.autoWindows = autoWindows;
  function profX(items, y, front) {
    var best = front ? -1e9 : 1e9;
    for (var i = 0; i < items.length; i++) {
      var a = items[i], b = items[(i + 1) % items.length]; if (a.arc || b.arc) continue;
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { var x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); best = front ? Math.max(best, x) : Math.min(best, x); }
    }
    return best;
  }
  ZG.profX = profX;
  /* Superfície real da lataria por raio. A casca de ZG.shell/ZG.car abaula de 2 a 8 cm além do perfil (bevel, tumble, esculpir),
     então peça, placa ou texto posto em profX() pode ficar enterrado. Use isto para assentar peças na pele já pronta.
     ZG.surfaceAt(c, origem, direção, { all, max }) -> { p, n, obj } em coordenadas de c.g, ou null.
     Por padrão só a pintura e as malhas que amassam contam; all: true aceita qualquer malha visível. */
  var _sr = new THREE.Raycaster();
  ZG.surfaceAt = function (c, org, dir, o) {
    o = o || {}; c.root.updateMatrixWorld(true);
    var Mw = c.g.matrixWorld, inv = new THREE.Matrix4().copy(Mw).invert(), dset = new Set(c.deform), cands = [];
    c.g.traverse(function (q) { if (!q.isMesh || !q.visible || q.userData.glass || q.userData.decal || q.isSprite) return; if (o.all || dset.has(q) || (c.paints && c.paints.has(q.material))) cands.push(q); });
    var d = (dir.isVector3 ? dir.clone() : new V3(dir[0], dir[1], dir[2])).normalize(), p0 = org.isVector3 ? org.clone() : new V3(org[0], org[1], org[2]);
    _sr.set(p0.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw)); _sr.near = 0; _sr.far = o.max || 20;
    var h = _sr.intersectObjects(cands, false)[0]; if (!h) return null;
    var n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv) : d.clone().negate();
    if (n.dot(d) > 0) n.negate();
    return { p: h.point.clone().applyMatrix4(inv), n: n, obj: h.object };
  };
  /* x da pele na frente (front = true) ou na traseira, na altura y e no lado z; cai no profX(items) se o raio não achar nada */
  ZG.surfaceX = function (c, y, z, front, items) {
    var m = c.meta, sg = front === false ? -1 : 1, x0 = sg > 0 ? (m.front || 3) + 2 : (m.rear || -3) - 2;
    var h = ZG.surfaceAt(c, new V3(x0, y, z || 0), new V3(-sg, 0, 0));
    return h ? h.p.x : (items ? profX(items, y, front !== false) : null);
  };

  /* ================= vidros ================= */
  ZG.addGlass = function (c, geo, label, type, o) {
    o = o || {};
    if (!geo.attributes.uv || o.reuv) o.aspect = uvProject(geo, o.uvAxes);
    var m = c.add(geo, o.mat || MT.glass); m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2;
    m.userData.glass = { type: type || "temperado", label: label, outline: o.outline || null, side: o.side, Wg: o.Wg, T: o.T, zpos: o.zpos, aspect: o.aspect || 1, hits: 0, broken: false };
    c.glass.push(m); c.deform.push(m);
    var pos = o.pos; if (!pos) { geo.computeBoundingBox(); pos = geo.boundingBox.getCenter(new V3()).add(m.position); }
    c.part("vidro", label, m, pos, o.reach || 0.9);
    return m;
  };
  /* registra uma malha pronta (rb, esfera...) como vidro; tipo "laminado" trinca, "temperado" estilhaça */
  ZG.asGlass = function (c, mesh, label, type, o) {
    o = o || {};
    var i = c.deform.indexOf(mesh); if (i >= 0) c.deform.splice(i, 1);
    mesh.parent && mesh.parent.remove(mesh);
    var geo = mesh.geometry; geo.applyMatrix4(new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale));
    if (o.reuv !== false) o.reuv = true;
    return ZG.addGlass(c, geo, label, type, Object.assign({ mat: mesh.material }, o));
  };
  ZG.sideWindows = function (c, polys, Wg, T, label, o) {
    o = o || {};
    (o.sides || [1, -1]).forEach(function (s) {
      polys.forEach(function (poly, i) {
        var shp = pathShape(poly.map(function (p) { return [p[0], p[1], 0.035]; }));
        var geo = new THREE.ExtrudeGeometry(shp, { depth: 0.008, bevelEnabled: false, curveSegments: 4 });
        var zpos = s > 0 ? Wg / 2 + 0.004 : -Wg / 2 - 0.012;
        geo.translate(0, 0, zpos); tumble(geo, T); geo.computeVertexNormals();
        var asp = uvProject(geo, "xy");
        var cx = 0, cy = 0; poly.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= poly.length; cy /= poly.length;
        var lab = (label ? label(i, polys.length) : "Janela") + (s > 0 ? " direita" : " esquerda");
        ZG.addGlass(c, geo, lab, o.type || "temperado", { mat: o.mat || (o.see === false ? MT.glassDark : MT.glass), pos: new V3(cx, cy, s * halfAt(Wg, T, cy)), outline: shp.getSpacedPoints(56), side: s, Wg: Wg, T: T, zpos: zpos, aspect: asp });
        var pts = shp.getSpacedPoints(36).map(function (p) { return [p.x, p.y, s * (halfAt(Wg, T, p.y) + 0.005)]; }); pts.pop();
        var seal = c.tube(pts, 0.011, MT.trim, { closed: true, seg: 72, rs: 5 }); seal.castShadow = false;
      });
    });
  };
  /* Recorta uma malha pronta (coordenadas locais da malha) e recalcula as normais. */
  ZG.cutMesh = function (mesh, tests, deg, o) {
    /* o.sub: subdivide antes (arestas maiores que o.sub, em m) para janelas dentro de faces grandes; descarta cor/uv */
    var src = o && o.sub ? subdivide(mesh.geometry, o.sub) : mesh.geometry;
    var r = cutGeo(src, tests); crease(r.geo, deg || 42);
    mesh.geometry.dispose(); mesh.geometry = r.geo; return r.cut;
  };
  ZG.quadDef = function (pb, pt, Wg, T, which, bev, o) {
    o = o || {}; bev = bev == null ? 0.05 : bev;
    var dx = pt[0] - pb[0], dy = pt[1] - pb[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    var nx = which === "front" ? uy : -uy, ny = which === "front" ? -ux : ux;
    var ins = o.inset || 0.09, off = bev + 0.006, sd = o.side || 0.1;
    var b = [pb[0] + ux * ins + nx * off, pb[1] + uy * ins + ny * off], t = [pt[0] - ux * ins * 1.3 + nx * off, pt[1] - uy * ins * 1.3 + ny * off];
    var hb = halfAt(Wg, T, b[1]) - sd, ht = halfAt(Wg, T, t[1]) - sd;
    return { pb: pb, pt: pt, L: L, u: [ux, uy], n: [nx, ny], ins: ins, b: b, t: t, hb: hb, ht: ht, which: which, bev: bev, Wg: Wg, T: T };
  };
  ZG.glassQuad = function (c, q, label, o) {
    o = o || {};
    var NX = 10, NY = 8, pos = [], uv = [], idx = [];
    for (var j = 0; j <= NY; j++) for (var i = 0; i <= NX; i++) {
      var u = i / NX, v = j / NY, x = q.b[0] + (q.t[0] - q.b[0]) * v, y = q.b[1] + (q.t[1] - q.b[1]) * v, hw = q.hb + (q.ht - q.hb) * v;
      pos.push(x, y, -hw + 2 * hw * u); uv.push(u, v);
    }
    for (var jj = 0; jj < NY; jj++) for (var ii = 0; ii < NX; ii++) {
      var a = jj * (NX + 1) + ii, b = a + 1, cc = a + NX + 2, d = a + NX + 1;
      if (q.which === "front") idx.push(a, b, cc, a, cc, d); else idx.push(a, cc, b, a, d, cc);
    }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    var m = ZG.addGlass(c, g, label, o.type || "laminado", { mat: o.mat || (o.see === false ? MT.glassDark : MT.glass), pos: new V3((q.b[0] + q.t[0]) / 2, (q.b[1] + q.t[1]) / 2, 0), aspect: (q.hb + q.ht) / (q.L - q.ins * 2.3), reach: 1.0 });
    var B0 = new V3(q.b[0], q.b[1], -q.hb), B1 = new V3(q.b[0], q.b[1], q.hb), T0 = new V3(q.t[0], q.t[1], -q.ht), T1 = new V3(q.t[0], q.t[1], q.ht);
    [[B0, B1], [B1, T1], [T1, T0], [T0, B0]].forEach(function (e) { c.rod(e[0], e[1], 0.012, MT.trim, { seg: 6 }).castShadow = false; });
    c.quads.push(q);
    return m;
  };

  /* ================= faróis, lanternas, grades ================= */
  function lampGroup(c, x, y, z, rotY) { var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; g.userData.rigid = true; c.g.add(g); return g; }
  function gm(g, geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = false; g.add(m); return m; }
  function wedgeY(geo, w, s, k) { var p = geo.attributes.position; for (var i = 0; i < p.count; i++) { var t = clamp(p.getZ(i) * s / w + 0.5, 0, 1); p.setY(i, p.getY(i) * (1 - k * t) + (k * t) * 0.0); } p.needsUpdate = true; geo.computeVertexNormals(); return geo; }
  /* halo aditivo do farol/lanterna (sprite sem raycast) */
  var haloTex = null;
  function glowTex() {
    if (haloTex) return haloTex;
    var cv = document.createElement("canvas"); cv.width = cv.height = 64; var x = cv.getContext("2d");
    var gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,255,255,0.55)"); gr.addColorStop(0.5, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); haloTex = new THREE.CanvasTexture(cv); return haloTex;
  }
  var haloMats = {};
  function halo(parent, x, y, z, size, hex, op) {
    var key = hex + op; if (!haloMats[key]) haloMats[key] = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(hex), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: op });
    var sp = new THREE.Sprite(haloMats[key]); sp.position.set(x, y, z); sp.scale.set(size, size, 1); sp.raycast = function () {}; sp.userData.decal = true; sp.userData.halo = true; sp.renderOrder = 4; parent.add(sp); return sp;
  }
  ZG.halo = halo;
  function lampKit(g, d, inner, lens, lensMat, refl) {
    refl = refl || MT.reflector;
    return {
      housing: function (w, h, y, z, geoFn) { var geo = rboxGeo(d, h, w, Math.min(0.03, h * 0.4)); if (geoFn) geoFn(geo); return gm(g, geo, MT.housing, 0, y || 0, z || 0); },
      lens: function (w, h, y, z, geoFn) { var geo = rboxGeo(0.03, h + 0.006, w + 0.006, Math.min(0.025, h * 0.4)); if (geoFn) geoFn(geo); var L = gm(g, geo, lensMat, d / 2 - 0.004, y || 0, z || 0); L.renderOrder = 3; lens.push(L); return L; },
      glow: function (geo, mat, x, y, z) { var m = gm(g, geo, mat, x, y, z); inner.push(m); return m; },
      proj: function (y, z, r, mat) {
        var bz = gm(g, new THREE.CylinderGeometry(r * 1.3, r * 1.45, 0.03, 18), refl, d / 2 - 0.03, y, z); bz.rotation.z = -PI / 2; if (refl !== MT.reflector) inner.push(bz);
        var e = gm(g, new THREE.SphereGeometry(r, 14, 10), mat, d / 2 - 0.022, y, z); e.scale.x = 0.55; inner.push(e); return e;
      }
    };
  }
  /* Farol. o: { style: round|dround|rect|slim|split|wedge|ledbar|truck, x, y, z, w, h, d, side (+1 direito / -1 esquerdo), yaw, mat, label } */
  ZG.headlight = function (c, o) {
    var st = o.style || "rect", w = o.w || 0.32, h = o.h || 0.12, d = o.d || 0.09, s = o.side || (o.z >= 0 ? 1 : -1);
    var g = lampGroup(c, o.x, o.y, o.z, -s * (o.yaw || 0)), inner = [], lens = [], B = o.mat || MT.head, K = lampKit(g, d, inner, lens, o.lens || MT.lens, MT.reflectorLit);
    if (st === "round" || st === "dround") {
      var nR = st === "dround" ? 2 : 1, r = Math.min(h / 2, w / (2 * nR)) * 0.95;
      for (var i = 0; i < nR; i++) {
        var pz = nR === 1 ? 0 : (i ? 1 : -1) * w / 4;
        var back = gm(g, new THREE.CylinderGeometry(r * 1.06, r * 1.06, d * 0.8, 22), MT.housing, 0, 0, pz); back.rotation.z = PI / 2;
        var ring = gm(g, new THREE.TorusGeometry(r * 1.02, 0.013, 8, 30), MT.chrome, d / 2 - 0.006, 0, pz); ring.rotation.y = PI / 2;
        var bowl = gm(g, new THREE.SphereGeometry(r * 0.96, 18, 10, 0, PI * 2, 0, PI / 2), MT.reflectorLit, d / 2 - 0.012, 0, pz); bowl.rotation.z = PI / 2; bowl.scale.y = 0.55; inner.push(bowl);
        K.glow(new THREE.SphereGeometry(r * 0.24, 12, 8), B, d / 2 - r * 0.3, 0, pz);
        var ln = gm(g, new THREE.SphereGeometry(r, 18, 10, 0, PI * 2, 0, PI / 2), o.lens || MT.lens, d / 2 - 0.008, 0, pz); ln.rotation.z = -PI / 2; ln.scale.y = 0.3; ln.renderOrder = 3; lens.push(ln);
      }
    } else if (st === "rect" || st === "truck") {
      K.housing(w, h);
      var pr = Math.min(h * 0.3, w * 0.14);
      K.proj(0, -w * 0.2, pr, B); K.proj(0, st === "truck" ? w * 0.08 : w * 0.18, pr, B);
      if (st === "truck") K.glow(rboxGeo(0.02, h * 0.8, w * 0.2, 0.01), MT.amber, d / 2 - 0.02, 0, s * w * 0.38);
      else K.glow(rboxGeo(0.012, h * 0.2, w * 0.16, 0.006), MT.amber, d / 2 - 0.016, -h * 0.34, s * w * 0.4);
      K.lens(w, h);
    } else if (st === "slim" || st === "ledbar") {
      K.housing(w, h);
      K.glow(rboxGeo(0.012, Math.max(0.012, h * 0.18), w * 0.92, 0.005), MT.led, d / 2 - 0.014, h * 0.3, 0);
      K.proj(-h * 0.08, -s * w * 0.22, h * 0.26, B); K.proj(-h * 0.08, s * w * 0.06, h * 0.22, B);
      K.lens(w, h);
    } else if (st === "split") {
      var hu = h * 0.26, hl = h * 0.62;
      K.housing(w, hu, h / 2 - hu / 2); K.glow(rboxGeo(0.012, hu * 0.45, w * 0.92, 0.005), MT.led, d / 2 - 0.014, h / 2 - hu / 2, 0); K.lens(w, hu, h / 2 - hu / 2);
      K.housing(w * 0.8, hl, -h / 2 + hl / 2, -s * w * 0.08); K.proj(-h / 2 + hl / 2, -s * w * 0.25, hl * 0.3, B); K.proj(-h / 2 + hl / 2, s * w * 0.05, hl * 0.3, B); K.lens(w * 0.8, hl, -h / 2 + hl / 2, -s * w * 0.08);
    } else if (st === "wedge") {
      var wf = function (geo) { wedgeY(geo, w, s, 0.45); };
      K.housing(w, h, 0, 0, wf);
      K.proj(h * 0.05, -s * w * 0.24, h * 0.25, B); K.proj(h * 0.05, s * w * 0.0, h * 0.2, B);
      K.glow(rboxGeo(0.012, 0.014, w * 0.72, 0.005), MT.led, d / 2 - 0.014, -h * 0.32, -s * w * 0.1);
      K.glow(rboxGeo(0.012, h * 0.42, 0.014, 0.005), MT.led, d / 2 - 0.014, -h * 0.14, s * w * 0.26);
      K.lens(w, h, 0, 0, wf);
    }
    var L = { g: g, inner: inner, lens: lens, kind: "farol", tint: "clear", broken: false };
    if (o.halo !== false) L.halo = [halo(g, d / 2 + 0.03, 0, 0, Math.max(w, h) * 1.9 + 0.12, "#ffe7b8", 0.55)];
    c.lights.push(L);
    if (!o.noPart) { var pt = c.part("farol", o.label || ("Farol " + (s > 0 ? "direito" : "esquerdo")), g, new V3(o.x, o.y, o.z), o.reach || 0.8); pt.light = L; }
    return L;
  };
  /* Lanterna traseira. o: { style: wrap|bar|vertical|L|round2, x, y, z, w, h, d, side, wrap (comprimento da dobra) } */
  ZG.taillight = function (c, o) {
    var st = o.style || "wrap", w = o.w || 0.3, h = o.h || 0.14, d = o.d || 0.08, s = o.side || (o.z >= 0 ? 1 : -1), ls = -s;
    var g = lampGroup(c, o.x, o.y, o.z, PI), inner = [], lens = [], K = lampKit(g, d, inner, lens, MT.lensRed);
    if (st === "round2") {
      [-1, 1].forEach(function (q) {
        var r = Math.min(h / 2, w / 4) * 0.92, pz = q * w / 4;
        var back = gm(g, new THREE.CylinderGeometry(r * 1.08, r * 1.08, d * 0.7, 20), MT.housing, 0, 0, pz); back.rotation.z = PI / 2;
        var e = gm(g, new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.012, 20), q * ls > 0 ? MT.tail : MT.tail, d / 2 - 0.02, 0, pz); e.rotation.z = PI / 2; inner.push(e);
        var ring = gm(g, new THREE.TorusGeometry(r, 0.01, 6, 24), MT.chrome, d / 2 - 0.004, 0, pz); ring.rotation.y = PI / 2;
        var ln = gm(g, new THREE.SphereGeometry(r, 16, 8, 0, PI * 2, 0, PI / 2), MT.lensRed, d / 2 - 0.01, 0, pz); ln.rotation.z = -PI / 2; ln.scale.y = 0.25; ln.renderOrder = 3; lens.push(ln);
      });
    } else if (st === "vertical") {
      K.housing(w, h);
      K.glow(rboxGeo(0.012, h * 0.55, w * 0.8, 0.006), MT.tail, d / 2 - 0.016, h * 0.18, 0);
      K.glow(rboxGeo(0.012, h * 0.16, w * 0.8, 0.006), MT.amber, d / 2 - 0.016, -h * 0.22, 0);
      K.glow(rboxGeo(0.012, h * 0.12, w * 0.8, 0.006), MT.rev, d / 2 - 0.016, -h * 0.4, 0);
      K.lens(w, h);
    } else if (st === "L") {
      var th = h * 0.42;
      K.housing(w, th, h / 2 - th / 2); K.glow(rboxGeo(0.012, th * 0.6, w * 0.9, 0.006), MT.tail, d / 2 - 0.016, h / 2 - th / 2, 0); K.lens(w, th, h / 2 - th / 2);
      K.housing(w * 0.3, h - th, -th / 2, ls * w * 0.35); K.glow(rboxGeo(0.012, (h - th) * 0.7, w * 0.22, 0.006), MT.tail, d / 2 - 0.016, -th / 2, ls * w * 0.35); K.lens(w * 0.3, h - th, -th / 2, ls * w * 0.35);
      K.glow(rboxGeo(0.012, th * 0.4, w * 0.25, 0.006), MT.rev, d / 2 - 0.016, -h * 0.25, -ls * w * 0.1);
    } else {
      K.housing(w, h);
      K.glow(rboxGeo(0.012, h * 0.42, w * 0.88, 0.006), MT.tail, d / 2 - 0.016, h * 0.18, 0);
      K.glow(rboxGeo(0.012, h * 0.22, w * 0.3, 0.006), MT.rev, d / 2 - 0.016, -h * 0.22, -ls * w * 0.25);
      K.glow(rboxGeo(0.012, h * 0.22, w * 0.3, 0.006), MT.amber, d / 2 - 0.016, -h * 0.22, ls * w * 0.2);
      K.lens(w, h);
      if (st === "wrap") {
        var wl = o.wrap || 0.2;
        var side = gm(g, rboxGeo(wl, h * 0.9, 0.04, 0.015), MT.housing, d / 2 - wl / 2, 0, ls * (w / 2 - 0.01));
        var sg = gm(g, rboxGeo(wl * 0.85, h * 0.5, 0.012, 0.005), MT.tail, d / 2 - wl / 2, h * 0.12, ls * (w / 2 + 0.008)); inner.push(sg);
        var sl = gm(g, rboxGeo(wl, h * 0.9 + 0.006, 0.014, 0.006), MT.lensRed, d / 2 - wl / 2, 0, ls * (w / 2 + 0.016)); sl.renderOrder = 3; lens.push(sl);
        side.castShadow = false;
      }
    }
    var L = { g: g, inner: inner, lens: lens, kind: "lanterna", tint: "red", broken: false };
    if (o.halo !== false) L.halo = [halo(g, d / 2 + 0.03, 0, 0, Math.max(w, h) * 1.5 + 0.08, "#ff2a1a", 0.4)];
    c.lights.push(L);
    if (!o.noPart) { var pt = c.part("lanterna", o.label || ("Lanterna " + (s > 0 ? "direita" : "esquerda")), g, new V3(o.x, o.y, o.z), o.reach || 0.8); pt.light = L; }
    return L;
  };
  /* barra de luz de ponta a ponta (ledbar na frente, bar atrás). face: +1 frente, -1 traseira */
  ZG.lightBar = function (c, x, y, z0, z1, h, face, mat) {
    var len = Math.abs(z1 - z0), zc = (z0 + z1) / 2, f = face || 1;
    var hs = c.rb(0.04, h + 0.012, len, 0.008, MT.housing, x, y, zc); hs.castShadow = false;
    var gl = c.rb(0.014, h, len, 0.006, mat || (f > 0 ? MT.led : MT.tail), x + f * 0.016, y, zc); gl.castShadow = false;
    var ln = c.rb(0.012, h + 0.014, len + 0.006, 0.006, f > 0 ? MT.lens : MT.lensRed, x + f * 0.026, y, zc); ln.castShadow = false; ln.renderOrder = 3;
    var L = { g: null, inner: [gl], lens: [ln], kind: f > 0 ? "farol" : "lanterna", tint: f > 0 ? "clear" : "red", broken: false };
    c.lights.push(L); var pt = c.part(f > 0 ? "farol" : "lanterna", f > 0 ? "Barra de LED" : "Barra de lanterna", gl, new V3(x, y, zc), 0.6); pt.light = L;
    return L;
  };
  /* Emblema genérico (círculo cromado com barra), nunca logotipo real */
  ZG.emblem = function (c, x, y, z, r, parent) {
    r = r || 0.045;
    var g = new THREE.Group(); g.position.set(x, y, z); g.userData.rigid = true; (parent || c.g).add(g);
    var d1 = gm(g, new THREE.CylinderGeometry(r, r, 0.012, 24), MT.chrome); d1.rotation.z = PI / 2;
    var d2 = gm(g, new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.014, 24), MT.trim); d2.rotation.z = PI / 2;
    gm(g, rboxGeo(0.016, r * 0.32, r * 1.4, 0.005), MT.chrome);
    gm(g, rboxGeo(0.016, r * 1.0, r * 0.22, 0.005), MT.chrome, 0, 0, r * 0.25).rotation.x = 0.5;
    return g;
  };
  /* Grade. o: { style: bars|mesh|big|seven|closed|truck, x, y, z, w, h, col, emblem } */
  ZG.grille = function (c, o) {
    var st = o.style || "bars", w = o.w || 0.6, h = o.h || 0.16, g = lampGroup(c, o.x, o.y, o.z || 0, 0), i;
    var paint = c.paint(o.col || c.meta.col || "#6a6a6a");
    if (st === "bars") {
      gm(g, rboxGeo(0.05, h, w, Math.min(0.03, h * 0.3)), MT.trim);
      var nb = Math.max(2, Math.round(h / 0.05));
      for (i = 0; i < nb; i++) gm(g, rboxGeo(0.02, 0.016, w * 0.92, 0.006), MT.chrome, 0.03, -h / 2 + (i + 0.5) * h / nb, 0);
    } else if (st === "mesh") {
      gm(g, rboxGeo(0.05, h, w, Math.min(0.03, h * 0.3)), MT.housing);
      var cell = 0.026, list = [], rows = Math.floor(h * 0.85 / (cell * 1.6)), cols = Math.floor(w * 0.9 / (cell * 1.8));
      for (var rI = 0; rI < rows; rI++) for (var cI = 0; cI < cols; cI++) {
        var hg = new THREE.CylinderGeometry(cell, cell, 0.02, 6); hg.rotateZ(PI / 2); hg.rotateX(PI / 6);
        hg.translate(0.026, -h * 0.42 + (rI + 0.5) * h * 0.85 / rows, -w * 0.45 + (cI + 0.5 + (rI % 2) * 0.5 - 0.25) * w * 0.9 / cols); list.push(hg);
      }
      if (list.length) gm(g, mergeGeos(list), MT.trim);
      gm(g, rboxGeo(0.022, 0.014, w, 0.006), MT.chrome, 0.03, h / 2 - 0.008, 0);
    } else if (st === "big") {
      var fr = rboxGeo(0.06, h, w, 0.03); taper(fr, { sz: 1.12 }); gm(g, fr, MT.chrome);
      gm(g, rboxGeo(0.064, h * 0.82, w * 0.9, 0.02), MT.housing, 0.002, 0, 0);
      var nb2 = Math.max(3, Math.round(h / 0.06));
      for (i = 0; i < nb2; i++) gm(g, rboxGeo(0.02, 0.02, w * (0.84 + 0.1 * i / nb2), 0.006), MT.chrome, 0.036, -h * 0.38 + i * h * 0.76 / (nb2 - 1), 0);
    } else if (st === "seven") {
      gm(g, rboxGeo(0.04, h, w, Math.min(0.03, h * 0.3)), paint);
      for (i = 0; i < 7; i++) gm(g, rboxGeo(0.03, h * 0.72, w * 0.07, 0.01), MT.housing, 0.008, 0, -w * 0.42 + i * w * 0.14);
    } else if (st === "closed") {
      gm(g, rboxGeo(0.03, h, w, Math.min(0.03, h * 0.4)), paint);
      gm(g, rboxGeo(0.012, 0.012, w * 0.9, 0.005), MT.chrome, 0.018, -h * 0.25, 0);
    } else if (st === "truck") {
      gm(g, rboxGeo(0.06, h + 0.04, w + 0.04, 0.03), MT.chrome);
      gm(g, rboxGeo(0.064, h, w, 0.02), MT.housing, 0.004, 0, 0);
      var nb3 = Math.max(4, Math.round(h / 0.1));
      for (i = 0; i < nb3; i++) gm(g, rboxGeo(0.024, 0.03, w * 0.94, 0.008), MT.chrome, 0.04, -h / 2 + (i + 0.5) * h / nb3, 0);
    }
    g.children.forEach(function (m) { m.castShadow = true; });
    if (o.emblem !== false) ZG.emblem(c, 0.05, st === "closed" ? h * 0.12 : 0, 0, Math.min(0.05, h * 0.3), g);
    return g;
  };

  /* ================= interior ================= */
  /* Banco. x = centro do assento, fl = altura do piso, z = centro lateral. o: { w, h (altura do assento), len, back, lean, n (lugares no banco inteiriço), dir (+1 olha para a frente), mat, headrest } */
  ZG.seat = function (c, x, fl, z, o) {
    o = o || {};
    if (o.face === "+z" || o.face === "-z") {
      /* banco virado para o lado (tropa, ambulância): monta olhando para +x num grupo e gira */
      var gp = new THREE.Group(); gp.position.set(x, 0, z); gp.rotation.y = o.face === "+z" ? -PI / 2 : PI / 2; gp.userData.rigid = true; c.g.add(gp);
      var n0 = c.seatTops.length; ZG.seat(c, 0, fl, 0, Object.assign({}, o, { face: null, parent: gp, dir: 1 }));
      var st = c.seatTops[n0]; if (st) { st.x = x; st.z = z; var t = st.w; st.w = st.l; st.l = t; }
      return gp;
    }
    var PR = o.parent;
    var w = o.w || 0.5, h = o.h || 0.28, mat = o.mat || MT.seat, dir = o.dir || 1, n = o.n || 1, back = o.back || 0.6, lean = o.lean == null ? 0.22 : o.lean, cl = o.len || 0.48;
    c.rb(cl * 0.7, Math.max(0.04, h - 0.1), w * 0.85, 0.03, MT.plastic, x, fl + Math.max(0.04, h - 0.1) / 2, z, { parent: PR });
    c.rb(cl, 0.12, w, 0.05, mat, x, fl + h - 0.05, z, { rot: [0, 0, dir * 0.06], parent: PR });
    var bx = x - dir * (cl / 2 - 0.03), pw = w / n, sl = Math.sin(lean), cs = Math.cos(lean);
    for (var j = 0; j < n; j++) {
      var zz = z + (j - (n - 1) / 2) * pw;
      c.rb(0.12, back, pw - (n > 1 ? 0.02 : 0), 0.05, mat, bx - dir * sl * back / 2, fl + h + cs * back / 2 - 0.03, zz, { rot: [0, 0, dir * lean], parent: PR });
      if (o.headrest !== false) {
        var hx = bx - dir * sl * (back + 0.1), hy = fl + h + cs * (back + 0.1) - 0.03, hw = Math.min(0.26, pw * 0.62);
        c.rb(0.09, 0.15, hw, 0.04, mat, hx, hy, zz, { rot: [0, 0, dir * lean], parent: PR });
        [-1, 1].forEach(function (q) { c.rod(new V3(hx, hy - 0.06, zz + q * hw * 0.25), new V3(bx - dir * sl * back, fl + h + cs * back - 0.06, zz + q * hw * 0.25), 0.006, MT.chrome, { seg: 5, parent: PR }); });
      }
    }
    c.seatTops.push({ x: x, y: fl + h + 0.01, z: z, w: w, l: cl });
  };
  /* Volante de 3 raios com coluna. o: { r, tilt (rad), col (comprimento da coluna), mat } */
  ZG.steeringWheel = function (c, x, y, z, o) {
    o = o || {};
    var r = o.r || 0.18, mat = o.mat || MT.plastic, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = -(o.tilt == null ? 0.42 : o.tilt); g.userData.rigid = true; c.g.add(g);
    var rim = c.add(new THREE.TorusGeometry(r, 0.018, 8, 30), mat, 0, 0, 0, g); rim.rotation.y = PI / 2;
    var hub = c.cyl(r * 0.3, r * 0.3, 0.06, mat, 0.015, 0, 0, "x", { parent: g });
    c.cyl(r * 0.12, r * 0.12, 0.01, MT.chrome, -0.018, 0, 0, "x", { parent: g });
    [[0, 0, r], [0, 0, -r], [0, -r, 0]].forEach(function (p) { c.rod(new V3(0.005, 0, 0), new V3(p[0], p[1] * 0.95, p[2] * 0.95), 0.016, mat, { parent: g, seg: 6 }); });
    c.rod(new V3(0.03, 0, 0), new V3(o.col || 0.34, 0, 0), 0.032, mat, { parent: g, seg: 10 });
    return g;
  };
  /* Manche de avião. */
  ZG.yoke = function (c, x, y, z, o) {
    o = o || {}; var mat = o.mat || MT.plastic;
    c.rod(new V3(x + 0.25, y, z), new V3(x, y, z), 0.018, MT.chrome);
    c.rb(0.04, 0.05, 0.3, 0.02, mat, x, y, z);
    [-1, 1].forEach(function (s) { c.rb(0.04, 0.14, 0.04, 0.018, mat, x - 0.01, y + 0.05, z + s * 0.14); });
  };
  /* Painel: corpo, quadro de instrumentos que brilha fraco, central multimídia, saídas de ar, porta-luvas.
     o: { x (borda dianteira, junto ao para-brisa), y (topo), w, d, h, drv (z do motorista ou null), mat, screen, gauges } */
  ZG.dashboard = function (c, o) {
    var d = o.d || 0.5, h = o.h || 0.36, x = o.x, y = o.y, w = o.w, mat = o.mat || MT.plastic, xb = x - d;
    c.rb(d, h, w, 0.06, mat, x - d / 2, y - h / 2, 0);
    c.rb(d * 0.85, 0.025, w - 0.04, 0.01, o.top || mat, x - d / 2 - 0.02, y + 0.005, 0);
    if (o.drv != null) {
      c.rb(0.14, 0.09, 0.4, 0.04, mat, xb + 0.06, y + 0.03, o.drv);
      [-0.09, 0.09].forEach(function (dz) {
        c.cyl(0.055, 0.055, 0.012, MT.gauge, xb + 0.002, y - 0.005, o.drv + dz, "x", { seg: 18 });
        c.cyl(0.06, 0.06, 0.008, MT.chrome, xb + 0.006, y - 0.005, o.drv + dz, "x", { seg: 18, open: true });
        c.rb(0.004, 0.045, 0.006, 0.002, MT.amber, xb - 0.006, y + 0.008, o.drv + dz, { rot: [0.9, 0, 0] });
      });
    }
    if (o.screen !== false) { var sc = c.rb(0.016, 0.13, Math.min(0.24, w * 0.18), 0.012, MT.screen, xb + 0.12, y + 0.07, 0, { rot: [0, 0, -0.2] }); sc.castShadow = false; }
    var vz = [-w * 0.4, -0.08, 0.08, w * 0.4];
    vz.forEach(function (z) { c.rb(0.016, 0.05, 0.11, 0.01, MT.chrome, xb - 0.002, y - 0.09, z); c.rb(0.016, 0.038, 0.095, 0.008, MT.dark, xb - 0.006, y - 0.09, z); });
    if (o.drv != null) c.rb(0.006, 0.12, w * 0.3, 0.004, MT.dark, xb - 0.003, y - 0.2, -Math.sign(o.drv || -1) * w * 0.25);
  };
  function consoleBox(c, x, fl, h, mat) {
    c.rb(0.62, h, 0.2, 0.04, mat, x, fl + h / 2, 0);
    c.rod(new V3(x + 0.18, fl + h, 0), new V3(x + 0.13, fl + h + 0.13, 0), 0.011, MT.chrome, { seg: 6 });
    c.sph(0.03, MT.plastic, x + 0.13, fl + h + 0.14, 0);
    c.rb(0.1, 0.03, 0.1, 0.02, MT.dark, x + 0.18, fl + h + 0.01, 0);
    c.rod(new V3(x - 0.06, fl + h, 0.0), new V3(x - 0.26, fl + h + 0.08, 0), 0.016, MT.plastic, { seg: 8 });
  }
  /* Interior completo de carro. Medidas em c.g:
     o: { x0 (base do para-brisa), ft (topo do para-brisa), rb/rt (base/topo do vidro traseiro), roof, belt, floor, zIn (meia largura interna),
          zRoof, rows (1..3), col (tecido), trim (plástico), drive (-1 = motorista à esquerda), front ('bench' para banco inteiriço de 3), xFront, xRear, noConsole } */
  ZG.interior = function (c, o) {
    var fab = CM(o.col || "#2c2d30", { roughness: 0.88 }), trim = CM(o.trim || "#1b1c1f", { roughness: 0.7 });
    var x0 = o.x0, fl = o.floor, belt = o.belt, zi = o.zIn, rows = o.rows || 2, drv = o.drive || -1;
    var zs = o.zSeat || Math.min(zi * 0.5, 0.42), xf = o.xFront != null ? o.xFront : x0 - 1.0, seatH = o.seatH || Math.min(0.3, (belt - fl) * 0.5);
    var xr = o.xRear != null ? o.xRear : (o.rb != null ? o.rb + 0.08 : xf - rows * 0.9);
    c.rb(Math.max(0.2, x0 - 0.1 - xr), 0.04, zi * 2, 0.015, MT.carpet, (x0 - 0.1 + xr) / 2, fl, 0);
    c.meta.cabin = { x0: xr - 0.1, x1: x0 + 0.1, y0: fl - 0.05, y1: (o.roof != null ? o.roof : belt + 0.5) + 0.05, z: zi + 0.045 };
    ZG.dashboard(c, { x: x0 - 0.07, y: belt + 0.04, w: zi * 2, d: 0.5, h: Math.min(0.42, belt + 0.04 - fl - 0.1), drv: drv * zs, mat: trim, top: fab });
    ZG.steeringWheel(c, x0 - 0.68, belt - 0.02, drv * zs, { mat: trim });
    var roof = o.roof != null ? o.roof : belt + 0.5;
    function lim(y) { if (o.rb == null) return -1e9; var t = clamp((y - belt) / (roof - belt), 0, 1); return o.rb + t * ((o.rt != null ? o.rt : o.rb) - o.rb) + 0.1; }
    var x = xf;
    for (var r = 0; r < rows; r++) {
      var back = r === 0 ? 0.6 : 0.56, lean = r === 0 ? 0.22 : 0.15, it;
      if (r > 0) for (it = 0; it < 30; it++) { var ty = fl + seatH + back + 0.1, tx = x - 0.21 - Math.sin(lean) * (back + 0.1) - 0.05; if (tx >= lim(ty)) break; if (back > 0.44) back -= 0.02; else x += 0.02; }
      if (r === 0) {
        if (o.front === "bench") { var wb = zi * 2 - 0.62; ZG.seat(c, x, fl, drv * zs, { w: 0.5, mat: fab, back: back, lean: lean, h: seatH }); ZG.seat(c, x, fl, -drv * (zi - wb / 2 - 0.03), { w: wb, n: 2, mat: fab, back: back, lean: lean, h: seatH }); }
        else {
          [-1, 1].forEach(function (s) { ZG.seat(c, x, fl, s * zs, { w: Math.min(0.52, zi - zs + 0.22), mat: fab, back: back, lean: lean, h: seatH }); });
          if (!o.noConsole) consoleBox(c, x + 0.16, fl, Math.min(0.26, seatH), trim);
        }
      } else ZG.seat(c, x, fl, 0, { w: zi * 2 - 0.1, n: r === 2 ? 2 : 3, mat: fab, back: back, lean: lean, h: seatH * 0.95 });
      [-1, 1].forEach(function (s) {
        c.rb(0.8, belt - fl - 0.08, 0.035, 0.015, trim, x + 0.12, (belt + fl) / 2 + 0.02, s * (zi + 0.02));
        c.rb(0.3, 0.05, 0.07, 0.02, fab, x + 0.16, fl + seatH + 0.16, s * (zi - 0.015));
        c.rb(0.08, 0.025, 0.02, 0.008, MT.chrome, x + 0.36, belt - 0.11, s * (zi - 0.005));
      });
      x -= r === 0 ? 0.88 : 0.8;
    }
    if (o.ft != null) {
      var hx1 = o.ft - 0.04, hx0 = (o.rt != null ? o.rt : xr) + 0.04, zr = o.zRoof || zi * 0.9;
      if (hx1 > hx0) c.rb(hx1 - hx0, 0.02, zr * 2, 0.01, MT.headliner, (hx0 + hx1) / 2, roof - 0.012, 0).castShadow = false;
      c.rod(new V3(o.ft - 0.1, roof - 0.02, 0), new V3(o.ft - 0.12, roof - 0.08, 0), 0.008, MT.plastic, { seg: 5 });
      c.rb(0.03, 0.06, 0.22, 0.02, MT.plastic, o.ft - 0.12, roof - 0.11, 0);
      [-1, 1].forEach(function (s) { c.rb(0.02, 0.15, 0.34, 0.01, MT.headliner, o.ft - 0.14, roof - 0.07, s * zs, { rot: [0, 0, 0.35] }); });
    }
  };
  /* Fileiras de ônibus com corredor central e balaústres.
     o: { x0 (fileira da frente), x1 (última), pitch, floor, zIn, aisle, col, seatH, ceil, poles, rails, mat (balaústre) } */
  ZG.busRows = function (c, o) {
    var fab = CM(o.col || "#3b4a5a", { roughness: 0.85 }), pitch = o.pitch || 0.78, aisle = o.aisle || 0.48, zi = o.zIn, pw = zi - aisle / 2, n = 0;
    var pm = o.mat || MT.chrome, ceil = o.ceil || o.floor + 2.0;
    for (var x = o.x0; x >= o.x1 - 1e-6; x -= pitch) {
      [-1, 1].forEach(function (s) { ZG.seat(c, x, o.floor, s * (aisle / 2 + pw / 2), { w: pw, n: 2, mat: fab, back: 0.52, lean: 0.12, h: o.seatH || 0.42, len: 0.42, headrest: false }); });
      if (o.poles !== false && n % 2 === 0) [-1, 1].forEach(function (s) { c.rod(new V3(x - 0.3, o.floor, s * aisle / 2), new V3(x - 0.3, ceil, s * aisle / 2), 0.016, pm, { seg: 8 }); });
      n++;
    }
    if (o.rails !== false) [-1, 1].forEach(function (s) { c.rod(new V3(o.x0 + 0.2, ceil - 0.12, s * (aisle / 2 + 0.05)), new V3(o.x1 - 0.4, ceil - 0.12, s * (aisle / 2 + 0.05)), 0.014, pm, { seg: 8 }); });
    c.rb(o.x0 - o.x1 + 1.0, 0.03, zi * 2, 0.01, MT.carpet, (o.x0 + o.x1) / 2, o.floor, 0);
    return n;
  };

  /* ================= capô e compartimento do motor ================= */
  /* Capô feito com a pele recortada do casco (shell holes com tag). o: { x0 (dobradiça), col, open (rad), hole (furo extra, ex. blower) } */
  ZG.makeHood = function (c, geo, o) {
    o = o || {};
    if (!geo || !geo.attributes.position.count) return null;
    if (o.hole) geo = cutGeo(geo, [o.hole]).geo;
    geo.computeBoundingBox(); var bb = geo.boundingBox.clone(), p = geo.attributes.position;
    var hx = o.x0 != null ? o.x0 : bb.min.x, hy = -1e9;
    for (var i = 0; i < p.count; i++) if (p.getX(i) < bb.min.x + 0.08) hy = Math.max(hy, p.getY(i));
    var cx = (bb.min.x + bb.max.x) / 2, sx = 1 - 0.022 / Math.max(0.3, bb.max.x - bb.min.x), sz = 1 - 0.022 / Math.max(0.3, bb.max.z - bb.min.z);
    for (i = 0; i < p.count; i++) { p.setX(i, cx + (p.getX(i) - cx) * sx); p.setZ(i, p.getZ(i) * sz); p.setY(i, p.getY(i) + 0.008); }
    geo.translate(-hx, -hy, 0);
    var under = geo.clone(); under.translate(0, -0.022, 0); crease(under, 42); crease(geo, 42);
    var piv = new THREE.Group(); piv.position.set(hx, hy, 0); c.g.add(piv);
    var top = new THREE.Mesh(geo, c.paint(o.col || c.meta.col || "#6a6a6a")); top.castShadow = true; top.receiveShadow = true; piv.add(top);
    var bot = new THREE.Mesh(under, MT.hoodLiner); piv.add(bot);
    c.deform.push(top, bot);
    c.hood = { piv: piv, ang: 0, target: 0, open: o.open || 1.05, latch: 0, x0: hx, x1: bb.max.x, y: hy, yMin: bb.min.y, zw: bb.max.z, label: o.label, noLatch: !!o.noLatch };
    c.part("capo", "Capô", piv, new V3((hx + bb.max.x) / 2, hy, 0), 0.9);
    return c.hood;
  };
  /* Torna qualquer conjunto de malhas um capô articulado (trator, caminhão). pivot em c.g; axis "z" (frente sobe). */
  ZG.hinge = function (c, objs, pivot, o) {
    o = o || {};
    var piv = new THREE.Group(); piv.position.copy(pivot); c.g.add(piv);
    objs.forEach(function (m) { if (m.parent) m.parent.remove(m); m.position.sub(pivot); piv.add(m); });
    c.hood = { piv: piv, ang: 0, target: 0, open: o.open || 1.0, latch: 0, x0: pivot.x, x1: pivot.x + (o.len || 1), y: pivot.y, yMin: pivot.y, zw: o.zw || 0.5, sign: o.sign || 1, label: o.bayLabel, noLatch: !!o.noLatch };
    c.part("capo", o.label || "Capô", piv, pivot.clone().add(new V3((o.len || 1) / 2, 0, 0)), 0.9);
    return c.hood;
  };
  /* Compartimento do motor. o: { x0 (parede corta-fogo), x1 (frente), zw (meia largura), floor, top (altura livre sob o capô), motor: gasolina|diesel|eletrico|v8 (com blower)|v8n (V8 aspirado), axle (x do eixo, torres), col, frunk } */
  ZG.engineBay = function (c, o) {
    var x0 = o.x0, x1 = o.x1, zw = o.zw, fl = o.floor, top = Math.max(o.top, fl + 0.22), mot = o.motor || "gasolina";
    var L = x1 - x0, H = top - fl, cx = (x0 + x1) / 2, paint = c.paint(o.col || c.meta.col || "#666"), out = {};
    c.rb(L, 0.03, 2 * zw, 0.01, MT.bay, cx, fl, 0);
    c.rb(0.03, H + 0.04, 2 * zw, 0.01, MT.bay, x0 + 0.015, fl + H / 2, 0);
    [1, -1].forEach(function (s) { c.rb(L, H * 0.75, 0.03, 0.01, MT.bay, cx, fl + H * 0.37, s * zw); });
    var rx = x1 - 0.06, rh = H * 0.82;
    var rad = c.rb(0.05, rh, zw * 1.5, 0.012, MT.radiator, rx, fl + rh / 2 + 0.02, 0);
    for (var f = 0; f < 6; f++) c.rb(0.054, 0.006, zw * 1.46, 0.002, MT.steel, rx, fl + 0.06 + f * (rh - 0.06) / 6, 0);
    c.rb(0.07, 0.04, zw * 1.5, 0.015, MT.plastic, rx, fl + rh + 0.03, 0);
    out.rad = new V3(rx, fl + rh / 2, 0);
    var fanR = Math.min(rh * 0.42, zw * 0.45), fg = new THREE.Group(); fg.position.set(rx - 0.06, fl + rh / 2 + 0.02, 0); c.g.add(fg);
    c.add(new THREE.TorusGeometry(fanR, 0.012, 6, 24), MT.plastic, 0, 0, 0, fg).rotation.y = PI / 2;
    for (var b = 0; b < 7; b++) { var bl = c.rb(0.012, fanR * 0.85, 0.06, 0.006, MT.plastic, 0, Math.cos(b / 7 * PI * 2) * fanR * 0.45, Math.sin(b / 7 * PI * 2) * fanR * 0.45, { parent: fg }); bl.rotation.x = -b / 7 * PI * 2; bl.rotation.y = 0.35; }
    c.cyl(fanR * 0.2, fanR * 0.2, 0.05, MT.steel, 0, 0, 0, "x", { parent: fg });
    if (o.axle != null && o.axle > x0 && o.axle < x1) [1, -1].forEach(function (s) {
      c.cyl(0.09, 0.12, H * 0.7, paint, o.axle, fl + H * 0.35, s * (zw - 0.12), null, { seg: 16 });
      for (var k = 0; k < 3; k++) { var a = k / 3 * PI * 2; c.cyl(0.012, 0.012, 0.02, MT.steel, o.axle + Math.cos(a) * 0.055, fl + H * 0.7 + 0.01, s * (zw - 0.12) + Math.sin(a) * 0.055); }
    });
    function reservoir(x, y, z, w, h, d, shell, liq, cap) {
      c.rb(w, h, d, 0.02, shell, x, y, z).castShadow = false;
      if (liq) c.rb(w * 0.85, h * 0.55, d * 0.85, 0.015, liq, x, y - h * 0.18, z);
      c.cyl(0.026, 0.026, 0.025, cap, x, y + h / 2 + 0.012, z);
    }
    function battery(x, y, z, sc) {
      sc = sc || 1;
      c.rb(0.2 * sc, 0.15 * sc, 0.15 * sc, 0.015, CM("#1a1b1c", { roughness: 0.5 }), x, y, z);
      c.rb(0.2 * sc, 0.012, 0.15 * sc, 0.005, CM("#2e3a6a", { roughness: 0.5 }), x, y + 0.04 * sc, z);
      c.cyl(0.016, 0.018, 0.03, MT.postRed, x + 0.06 * sc, y + 0.09 * sc, z + 0.045 * sc); c.cyl(0.016, 0.018, 0.03, MT.postBlack, x + 0.06 * sc, y + 0.09 * sc, z - 0.045 * sc);
      c.tube([[x + 0.06 * sc, y + 0.1 * sc, z + 0.045 * sc], [x + 0.1, y + 0.13, z + 0.1], [x + 0.2, y + 0.05, z + 0.12]], 0.01, MT.postRed, { seg: 12, rs: 5 });
      return new V3(x, y, z);
    }
    var uy = Math.min(top - 0.03, fl + H * 0.75);
    reservoir(x0 + 0.12, uy - 0.04, -zw * 0.55, 0.07, 0.06, 0.07, MT.coolant, CM("#c9b26a", { roughness: 0.3 }), MT.yellow);
    reservoir(x1 - 0.2, fl + H * 0.45, zw * 0.72, 0.12, 0.13, 0.1, MT.washer, CM("#3f8fc0", { roughness: 0.3 }), MT.capBlue);
    c.rb(0.12, 0.07, 0.13, 0.015, MT.plastic, x0 + 0.18, uy - 0.02, -zw * 0.78);
    c.rb(0.12, 0.006, 0.13, 0.003, MT.dark, x0 + 0.18, uy + 0.017, -zw * 0.78);
    if (mot === "eletrico") {
      var fx0 = x0 + L * 0.4, fx1 = x1 - 0.14, fw = zw * 1.5, fh = H * 0.65, fy = fl + 0.02;
      c.rb(fx1 - fx0, 0.02, fw, 0.01, MT.carpet, (fx0 + fx1) / 2, fy + 0.02, 0);
      [[fx0, 0], [fx1, 0]].forEach(function (p) { c.rb(0.025, fh, fw, 0.01, MT.plastic, p[0], fy + fh / 2, 0); });
      [1, -1].forEach(function (s) { c.rb(fx1 - fx0, fh, 0.025, 0.01, MT.plastic, (fx0 + fx1) / 2, fy + fh / 2, s * fw / 2); });
      var ix = x0 + L * 0.2, iy = fl + H * 0.35;
      c.rb(L * 0.24, H * 0.42, zw * 0.9, 0.03, CM("#9aa1a6", { metalness: 0.7, roughness: 0.35 }), ix, iy, zw * 0.1);
      for (var fin = 0; fin < 5; fin++) c.rb(L * 0.22, 0.03, 0.012, 0.004, CM("#b8bec2", { metalness: 0.7, roughness: 0.3 }), ix, iy + H * 0.21 + 0.012, zw * 0.1 - zw * 0.36 + fin * zw * 0.18);
      c.text("ALTA TENSÃO", L * 0.2, 0.05, ix, iy + H * 0.215 + 0.008, zw * 0.1, "+y", { fg: "#121212", bg: "#f0a01e", w: 512, h: 128, size: 0.55 });
      [-0.12, 0.12].forEach(function (dz) { c.tube([[ix - L * 0.1, iy - H * 0.1, zw * 0.1 + dz], [ix - L * 0.14, fl + 0.06, zw * 0.1 + dz * 1.5], [x0 + 0.04, fl + 0.03, dz * 2]], 0.022, MT.hv, { seg: 16, rs: 6 }); });
      c.tube([[ix + L * 0.12, iy, zw * 0.5], [fx0 - 0.03, iy + 0.02, zw * 0.7], [rx - 0.1, fl + rh * 0.8, zw * 0.6]], 0.016, MT.hose, { seg: 16, rs: 6 });
      battery(x0 + 0.14, fl + H * 0.25, -zw * 0.55, 0.65);
      reservoir(x0 + 0.13, fl + H * 0.62, zw * 0.72, 0.1, 0.1, 0.08, MT.coolant, MT.coolantLiq, MT.postBlack);
      out.motor = new V3(ix, iy, 0); out.inverter = new V3(ix, iy, 0); out.frunk = new V3((fx0 + fx1) / 2, fy, 0);
    } else if (mot === "v8" || mot === "v8n") {
      var bx = cx - L * 0.05, by = fl + H * 0.3, bl = L * 0.55;
      c.rb(bl, H * 0.45, zw * 0.7, 0.04, CM("#2f5a8a", { metalness: 0.5, roughness: 0.4 }), bx, by, 0);
      [1, -1].forEach(function (s) { c.rb(bl * 0.9, 0.07, zw * 0.32, 0.03, MT.chrome, bx, by + H * 0.25, s * zw * 0.3, { rot: [s * 0.5, 0, 0] }); for (var h2 = 0; h2 < 4; h2++) c.tube([[bx - bl * 0.35 + h2 * bl * 0.23, by, s * zw * 0.38], [bx - bl * 0.35 + h2 * bl * 0.23, by - 0.08, s * zw * 0.7], [bx - bl * 0.3, fl + 0.05, s * zw * 0.85]], 0.02, MT.chrome, { seg: 12, rs: 6 }); });
      var bly = top - 0.02;
      if (mot === "v8") {
        c.rb(bl * 0.75, 0.22, zw * 0.42, 0.04, MT.chrome, bx, bly, 0);
        for (var rb2 = 0; rb2 < 6; rb2++) c.rb(bl * 0.75, 0.012, 0.012, 0.004, MT.steel, bx, bly + 0.03, -zw * 0.18 + rb2 * zw * 0.072);
        c.rb(0.2, 0.16, 0.24, 0.03, MT.chrome, bx + 0.02, bly + 0.19, 0);
        [-0.06, 0.06].forEach(function (dz) { c.rb(0.07, 0.1, 0.09, 0.02, MT.dark, bx + 0.09, bly + 0.2, dz); });
      } else {
        /* V8 aspirado moderno: coletor de admissão baixo com tampa plástica, corpo de borboleta e duto até a caixa do filtro */
        bly = Math.min(top - 0.06, by + H * 0.42);
        c.rb(bl * 0.62, 0.09, zw * 0.4, 0.035, MT.cover, bx, bly, 0);
        c.rb(bl * 0.5, 0.012, zw * 0.3, 0.005, MT.plastic, bx, bly + 0.05, 0);
        c.cyl(0.055, 0.055, 0.06, MT.steel, bx + bl * 0.36, bly, 0, "x");
        c.tube([[bx + bl * 0.39, bly, 0], [bx + bl * 0.5, bly + 0.02, zw * 0.25], [x0 + L * 0.82, fl + H * 0.55, zw * 0.55]], 0.045, MT.hose, { seg: 14, rs: 8 });
        c.rb(0.26, 0.14, 0.22, 0.03, MT.plastic, x0 + L * 0.82, fl + H * 0.5, zw * 0.62);
      }
      c.cyl(0.07, 0.07, 0.04, MT.steel, bx + bl * 0.4, by + H * 0.2, 0, "x");
      c.tube([[bx + bl * 0.42, by + H * 0.2 + 0.07, 0], [bx + bl * 0.42, bly + 0.06, 0]], 0.012, MT.hose, { seg: 4, rs: 5 });
      battery(x0 + 0.16, fl + 0.1, zw * 0.62);
      out.motor = new V3(bx, by, 0); if (mot === "v8") out.blower = new V3(bx, bly, 0);
    } else {
      var ex = x0 + L * 0.48, bh = H * 0.5, bz = zw * 0.95, ey = fl + 0.04 + bh / 2, eb = Math.min(0.42, L * 0.36);
      c.rb(eb, bh, bz, 0.03, MT.block, ex, ey, -zw * 0.1);
      var cover = mot === "diesel" ? CM("#2b2d30", { metalness: 0.3, roughness: 0.4 }) : MT.cover;
      c.rb(eb * 0.82, 0.07, bz * 0.92, 0.03, cover, ex, ey + bh / 2 + 0.03, -zw * 0.1);
      for (var rib = 0; rib < 4; rib++) c.rb(eb * 0.7, 0.012, 0.014, 0.004, MT.steel, ex, ey + bh / 2 + 0.07, -zw * 0.1 - bz * 0.36 + rib * bz * 0.24);
      c.cyl(0.03, 0.03, 0.028, MT.yellow, ex - eb * 0.2, ey + bh / 2 + 0.08, -zw * 0.1 + bz * 0.28);
      var plx = ex + eb / 2 + 0.07, ply = ey + bh * 0.1;
      c.rb(0.07, bh * 0.4, bz * 0.7, 0.02, MT.block, plx, ply, -zw * 0.1);
      for (var rn = 0; rn < 4; rn++) { var rz = -zw * 0.1 - bz * 0.3 + rn * bz * 0.2; c.tube([[ex + eb * 0.3, ey + bh / 2 + 0.02, rz], [plx - 0.02, ey + bh / 2 + 0.03, rz], [plx, ply + bh * 0.15, rz]], 0.018, MT.block, { seg: 10, rs: 6 }); }
      var afx = x1 - L * 0.32, afy = Math.min(top - 0.07, fl + H * 0.7);
      c.rb(0.22, 0.1, 0.26, 0.03, MT.plastic, afx, afy, zw * 0.5);
      c.rb(0.22, 0.012, 0.26, 0.004, MT.dark, afx, afy + 0.01, zw * 0.5);
      c.tube([[afx - 0.11, afy, zw * 0.4], [plx + 0.02, afy, zw * 0.15], [plx, ply + bh * 0.2, -zw * 0.1 + bz * 0.35]], 0.04, MT.hose, { seg: 16, rs: 8 });
      out.batt = battery(x0 + L * 0.2, fl + 0.1, zw * 0.62);
      reservoir(x0 + L * 0.22, fl + H * 0.6, -zw * 0.65, 0.12, 0.12, 0.1, MT.coolant, MT.coolantLiq, MT.postBlack);
      c.tube([[rx - 0.03, fl + rh * 0.85, -zw * 0.3], [ex + eb * 0.6, ey + bh * 0.3, -zw * 0.4], [ex + eb / 2, ey + bh * 0.2, -zw * 0.3]], 0.025, MT.hose, { seg: 14, rs: 6 });
      c.tube([[rx - 0.03, fl + 0.06, zw * 0.2], [ex + eb * 0.7, fl + 0.05, 0], [ex + eb / 2, ey - bh * 0.3, -zw * 0.2]], 0.025, MT.hose, { seg: 14, rs: 6 });
      if (mot === "diesel" && o.turbo !== false) {
        var tx = ex - eb * 0.1, ty = ey + bh * 0.1, tz = zw * 0.35;
        var snail = c.add(new THREE.TorusGeometry(0.06, 0.035, 10, 20), CM("#8a8478", { metalness: 0.7, roughness: 0.5 }), tx, ty, tz); snail.rotation.x = PI / 2;
        c.cyl(0.045, 0.05, 0.08, CM("#7b756b", { metalness: 0.7, roughness: 0.5 }), tx, ty + 0.05, tz);
        var icx = ex + eb * 0.1, icy = ey + bh / 2 + 0.13;
        c.rb(0.22, 0.05, bz * 0.6, 0.015, CM("#a7adb1", { metalness: 0.7, roughness: 0.35 }), icx, Math.min(icy, top - 0.04), -zw * 0.05);
        c.tube([[tx, ty + 0.09, tz], [tx + 0.05, Math.min(icy, top - 0.04), tz], [icx - 0.08, Math.min(icy, top - 0.04), zw * 0.15]], 0.025, MT.steel, { seg: 10, rs: 6 });
        out.turbo = new V3(tx, ty, tz);
      }
      out.motor = new V3(ex, ey, -zw * 0.1);
    }
    c.part("motor", mot === "eletrico" ? "Motor elétrico e inversor" : "Motor", null, out.motor, 1.0);
    c.part("radiador", "Radiador", rad, out.rad, 0.9);
    c.meta.bay = { x0: x0, x1: x1, zw: zw, floor: fl, top: top, motor: mot, center: new V3(cx, fl + H * 0.5, 0), label: o.label, turbo: o.turbo, view: o.view };
    return out;
  };

  /* ================= arredondamento global (warp), loft reamostrado (portados do grupo A) ================= */
  /* mkWarp(o) cria f(x, y, z) -> [x, y, z] que arredonda frente/traseira em planta e curva a lateral.
     o: { xF, xR, Lf, Lr, hw, bowF, bowR, pinF, pinR, belt, ys, yb, kt, kb, dropF, dropY }. applyWarp(c, f) deforma tudo o que já foi montado. */
  function mkWarp(o) {
    function sec(y) {
      if (y >= o.belt) return o.kt;
      if (y >= o.ys) { var a = (y - o.ys) / (o.belt - o.ys); return o.kt * a * a; }
      var b = clamp((o.ys - y) / (o.ys - o.yb), 0, 1.25); return o.kb * b * b;
    }
    var f = function (x, y, z) {
      var tF = smooth((x - (o.xF - o.Lf)) / o.Lf), tR = smooth(((o.xR + o.Lr) - x) / o.Lr), u = Math.min(1.15, Math.abs(z) / o.hw), u2 = u * u;
      var dropF = o.dropF ? o.dropF * tF * u2 * smooth((y - o.dropY) / 0.25) : 0;
      return [x - o.bowF * tF * u2 + o.bowR * tR * u2, y - dropF, z * (1 - sec(y)) * (1 - o.pinF * tF * tF) * (1 - o.pinR * tR * tR)];
    };
    f.sec = sec; return f;
  }
  function applyWarp(c, Wf) {
    c.root.updateMatrixWorld(true);
    var gInv = new THREE.Matrix4().copy(c.g.matrixWorld).invert(), rel = new THREE.Matrix4(), irel = new THREE.Matrix4(), v = new V3();
    var use = new Map(); c.root.traverse(function (o) { if (o.isMesh) use.set(o.geometry, (use.get(o.geometry) || 0) + 1); });
    var skip = new Set(c.wheels), dset = new Set(c.deform), yAx = new V3(0, 1, 0);
    function warpMesh(msh) {
      var g = msh.geometry; if (use.get(g) > 1 || !g.attributes.position) return false;
      rel.multiplyMatrices(gInv, msh.matrixWorld); irel.copy(rel).invert();
      var p = g.attributes.position;
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(rel); var r = Wf(v.x, v.y, v.z); v.set(r[0], r[1], r[2]).applyMatrix4(irel); p.setXYZ(i, v.x, v.y, v.z); }
      p.needsUpdate = true;
      if (g.userData.crease) crease(g, 42); else g.computeVertexNormals();
      g.computeBoundingSphere(); g.computeBoundingBox();
      return true;
    }
    function rigid(o) {
      var p = o.position, r = Wf(p.x, p.y, p.z), a = Wf(p.x, p.y, p.z - 0.03), b = Wf(p.x, p.y, p.z + 0.03), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
      p.set(r[0], r[1], r[2]);
      if (Math.abs(yaw) > 1e-4) o.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(yAx, yaw));
    }
    c.glass.forEach(function (gm) {
      var GD = gm.userData.glass; if (!GD || !GD.outline || GD.zpos == null) return;
      var cx = 0, cy = 0; GD.outline.forEach(function (p) { cx += p.x; cy += p.y; }); cx /= GD.outline.length; cy /= GD.outline.length;
      var f = Wf(cx, cy, GD.zpos)[2] / GD.zpos;
      GD.outline = GD.outline.map(function (p) { var r = Wf(p.x, p.y, GD.zpos); return new THREE.Vector2(r[0], r[1]); });
      GD.zpos *= f; GD.Wg *= f;
    });
    c.g.children.slice().forEach(function (o) {
      if (skip.has(o) || o.userData.noWarp) return;
      if (o.isMesh) { if (!warpMesh(o)) rigid(o); return; }
      var defs = []; o.traverse(function (x) { if (x !== o && x.isMesh && dset.has(x)) defs.push(x); });
      if (defs.length) defs.forEach(warpMesh); else rigid(o);
    });
  }

  function resample(st, n) {
    var out = [], L = st.length;
    function P(i) { return st[Math.max(0, Math.min(L - 1, i))]; }
    for (var k = 0; k <= n; k++) {
      var u = k / n * (L - 1), i = Math.min(L - 2, Math.floor(u)), t = u - i, a = P(i - 1), b = P(i), c2 = P(i + 1), d = P(i + 2), row = [];
      for (var j = 0; j < b.length; j++) {
        var p0 = a[j] == null ? b[j] : a[j], p1 = b[j], p2 = c2[j], p3 = d[j] == null ? c2[j] : d[j];
        p0 = p0 || 0; p1 = p1 || 0; p2 = p2 || 0; p3 = p3 || 0;
        row.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t));
      }
      out.push(row);
    }
    return out;
  }
  function sloft(st, o) {
    o = o || {};
    if (o.smooth) st = resample(st, o.smooth);
    var seg = o.seg || 24, pos = [], idx = [], ring = seg + 1, axisY = o.axis === "y";
    st.forEach(function (s) {
      var a0 = s[1], b0 = s[2], cc = (a0 + b0) / 2, hh = Math.abs(a0 - b0) / 2, w = s[3] / 2, e = 2 / (s[4] || o.p || 2.4), zc = s[5] || 0;
      for (var j = 0; j <= seg; j++) {
        var a = j / seg * PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        var u = cc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), e), z = zc + w * Math.sign(cs) * Math.pow(Math.abs(cs), e);
        if (axisY) pos.push(u, s[0], z); else pos.push(s[0], u, z);
      }
    });
    for (var i = 0; i < st.length - 1; i++) for (var k = 0; k < seg; k++) { var A = i * ring + k, B = A + ring; if (axisY) idx.push(A, B, A + 1, A + 1, B, B + 1); else idx.push(A, A + 1, B, A + 1, B + 1, B); }
    [0, st.length - 1].forEach(function (si, e) {
      var s = st[si]; if (s[3] < 0.004) return;
      var ci = pos.length / 3, cc = (s[1] + s[2]) / 2;
      if (axisY) pos.push(cc, s[0], s[5] || 0); else pos.push(s[0], cc, s[5] || 0);
      for (var k = 0; k < seg; k++) { var a = si * ring + k, flip = (e === 0) !== axisY; if (flip) idx.push(ci, a + 1, a); else idx.push(ci, a, a + 1); }
    });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g = crease(g.toNonIndexed(), o.crease || 60);
    return g;
  }
  ZG.mkWarp = mkWarp; ZG.applyWarp = applyWarp; ZG.geo.resample = resample; ZG.geo.sloft = sloft;

  /* ================= carro genérico ================= */
  /* spec: { W, col, roofCol, bottomY, noseY, tailY, lower:[[x,y,raio]..], arches:[[x,y,r]..],
            gh:{rb,rt,ft,fb,belt,roof,Wg,k,pillars,r1,r2}, seams, handles,
            hl:{style,w,h,y,in,yaw}, tl:{style,w,h,y,in}, grille:{style,w,h,y}|false,
            interior:{rows,col,trim}|false, hood:{motor,front}|true|false, wheels:[[x,r,w,opts]..], bodyBumper, mirrorCol, noAntenna, plateRearY } */
  ZG.car = function (c, s) {
    var W = s.W, gh = s.gh, bev = 0.05, T = { belt: gh.belt, top: gh.roof + bev, k: gh.k }, m = c.meta;
    m.col = s.col; m.kind = m.kind || "car";
    var front = profX(s.lower, s.noseY, true), rear = profX(s.lower, s.tailY, false);
    var intr = s.interior === false ? null : Object.assign({ rows: 2 }, s.interior || {});
    var hoodO = s.hood ? Object.assign({ motor: "gasolina" }, s.hood === true ? {} : s.hood) : null;
    var tireW = 0.2; (s.wheels || []).forEach(function (w) { tireW = Math.max(tireW, w[2]); });
    var low = [];
    if (intr) low.push(ZG.holeTop(gh.rb + 0.05, gh.fb - 0.03, gh.Wg / 2 - 0.05, gh.belt - 0.3));
    var hx0 = gh.fb + 0.08, hx1 = front - (hoodO && hoodO.front != null ? hoodO.front : 0.2), zH = W / 2 - 0.13;
    if (hoodO) low.push(ZG.holeTop(hx0, hx1, zH, s.bottomY + 0.2, "capo"));
    (s.holes || []).forEach(function (h) { low.push(h); });
    var lowMesh = shell(c, { items: s.lower, bottomY: s.bottomY, arches: s.arches, W: W, col: s.col, holes: low, archInner: (intr || hoodO) ? W / 2 - tireW - 0.16 : null });
    var ghItems = [[gh.rb, gh.belt - 0.1, 0], [gh.rt, gh.roof, gh.r1 || 0.12], [gh.ft, gh.roof, gh.r2 || 0.2], [gh.fb, gh.belt - 0.1, 0]];
    var polys = autoWindows(gh);
    var qf = ZG.quadDef([gh.fb, gh.belt], [gh.ft, gh.roof], gh.Wg, T, "front", bev), qr = ZG.quadDef([gh.rb, gh.belt], [gh.rt, gh.roof], gh.Wg, T, "rear", bev);
    var gHoles = [];
    if (intr) { polys.forEach(function (p) { gHoles.push(ZG.holeSide(p)); }); gHoles.push(ZG.holeQuad(qf), ZG.holeQuad(qr), ZG.holeWhere(function (n, ce) { return n.y < -0.7 && ce.y < gh.belt + 0.02; })); }
    shell(c, { items: ghItems, W: gh.Wg, col: s.roofCol || s.col, T: T, holes: gHoles, sub: intr ? 0.12 : 0.2 });
    ZG.sideWindows(c, polys, gh.Wg, T, function (i, n) { return i === 0 && n > 2 ? "Vidro lateral traseiro" : (i === n - 1 ? "Janela dianteira" : "Janela traseira"); }, { see: !!intr });
    ZG.glassQuad(c, qf, "Para-brisa", { see: !!intr });
    ZG.glassQuad(c, qr, "Vidro traseiro", { see: !!intr, mat: intr ? MT.rearTint : MT.glassDark });
    m.L = front - rear; m.W = W; m.front = front; m.rear = rear; m.clear = s.bottomY; m.belt = gh.belt; m.top = gh.roof + bev; m.bodyH = gh.belt - s.bottomY;
    m.roof = { x0: gh.rt + 0.1, x1: gh.ft - 0.1, w: halfAt(gh.Wg, T, gh.roof) * 1.7, y: gh.roof + bev };
    m.gh = gh; m.T = T; m.quadF = qf;
    if (intr) ZG.interior(c, Object.assign({ x0: gh.fb, ft: gh.ft, rb: gh.rb, rt: gh.rt, roof: gh.roof, belt: gh.belt, floor: s.bottomY + 0.1, zIn: gh.Wg / 2 - 0.09, zRoof: halfAt(gh.Wg, T, gh.roof) - 0.12, xRear: gh.rb + 0.06 }, intr));
    if (hoodO) {
      var fa = -1e9; (s.arches || []).forEach(function (a) { fa = Math.max(fa, a[0]); });
      var bxv8 = hx0 + (hx1 - hx0) * 0.45;
      var hood = ZG.makeHood(c, lowMesh.userData.cut.capo, { x0: hx0, col: s.col, hole: hoodO.motor === "v8" ? ZG.holeBox([bxv8 - 0.2, -9, -0.16], [bxv8 + 0.24, 9, 0.16]) : null });
      if (hood) ZG.engineBay(c, { x0: hx0 + 0.02, x1: hx1, zw: zH - 0.02, floor: s.bottomY + 0.12, top: hood.yMin - 0.035, motor: hoodO.motor, axle: fa, col: s.col });
    }
    ZG.carDetails(c, s);
    m.arches = s.arches || null; if (s.bed) m.bed = s.bed;
    if (s.under !== false) ZG.underbody(c, { W: W, bottomY: s.bottomY, wheels: s.wheels || [], motor: hoodO ? hoodO.motor : (s.motor || "gasolina"), spare: s.spareUnder });
    if (s.warp) applyWarp(c, typeof s.warp === "function" ? s.warp : mkWarp(s.warp));
  };
  /* Assoalho visível ao capotar: eixos, braços, cárter, diferencial (tração traseira), escapamento com silencioso, tanque, estepe.
     o: { W, bottomY, wheels: [[x, r, w]..], motor, spare (true = estepe sob a traseira) } */
  ZG.underbody = function (c, o) {
    var m = c.meta, W = o.W, by = o.bottomY, ws = o.wheels.map(function (w) { return w; }).sort(function (a, b) { return b[0] - a[0]; });
    if (ws.length < 2) return;
    var fx = ws[0][0], rx = ws[ws.length - 1][0], rr = ws[ws.length - 1][1], tw = ws[0][2], zW = W / 2 - tw - 0.04, yU = Math.max(0.12, by - 0.035);
    var ug = new THREE.Group(); ug.userData.rigid = true; c.g.add(ug); m.underG = ug;
    var DK = CM("#1a1b1c", { roughness: 0.75, metalness: 0.3 }), ST = MT.steel;
    function box(w, h, d, mat, x, y, z) { return c.rb(w, h, d, Math.min(0.02, h * 0.4), mat, x, y, z, { parent: ug }); }
    function rod(a, b, r, mat) { return c.rod(a, b, r, mat, { parent: ug, seg: 8 }); }
    var diesel = o.motor === "diesel" || o.motor === "v8" || o.motor === "v8n", ev = o.motor === "eletrico";
    /* eixo dianteiro: semieixos e bandejas */
    [1, -1].forEach(function (sd) {
      rod(new V3(fx, ws[0][1], sd * 0.12), new V3(fx, ws[0][1], sd * zW), 0.028, ST);
      rod(new V3(fx - 0.25, yU + 0.02, sd * 0.3), new V3(fx, ws[0][1] - 0.1, sd * zW), 0.022, DK);
      rod(new V3(rx + 0.35, yU + 0.02, sd * 0.25), new V3(rx, rr - 0.08, sd * zW), 0.026, DK);
    });
    if (diesel) { rod(new V3(rx, rr, -zW), new V3(rx, rr, zW), 0.045, ST); c.sph(0.13, ST, rx, rr, 0, 1, 0.85, 1, { parent: ug }); rod(new V3(rx + 0.1, rr, 0), new V3(fx - 0.6, yU + 0.04, 0), 0.035, ST); }
    else box(0.09, 0.08, zW * 2, DK, rx + 0.08, Math.max(yU, rr - 0.12), 0);
    if (!ev) {
      box(Math.min(0.5, (fx - rx) * 0.2), 0.1, 0.38, DK, fx - 0.25, yU + 0.01, -0.05);
      var tz = W * 0.3, mx = rx - 0.15, ty = Math.max(0.14, by - 0.06);
      c.tube([[fx - 0.35, yU, 0.12], [fx - 0.9, ty, 0.14], [(fx + rx) / 2, ty, 0.16], [rx + 0.5, ty, tz * 0.5], [mx + 0.3, ty, tz * 0.8]], 0.03, ST, { parent: ug, seg: 30, rs: 6 });
      c.cyl(0.1, 0.1, 0.42, ST, mx, ty + 0.02, tz, "x", { parent: ug });
      box(0.24, 0.06, 0.2, DK, (fx + rx) / 2 + 0.1, ty, 0.16);
      box(0.55, 0.18, W * 0.5, CM("#232527", { roughness: 0.7 }), rx + 0.62, Math.max(0.16, by - 0.02), -W * 0.1);
    } else {
      box((fx - rx) * 0.72, 0.1, W - 0.4, CM("#2a2e31", { roughness: 0.6, metalness: 0.4 }), (fx + rx) / 2, Math.max(0.14, by - 0.03), 0);
      for (var k = 0; k < 6; k++) box(0.03, 0.02, W - 0.45, ST, rx + 0.4 + k * (fx - rx - 0.8) / 5, Math.max(0.14, by - 0.03) - 0.06, 0);
    }
    if (o.spare && m.rear < rx - 0.7) { var sp = c.cyl(0.32, 0.32, 0.2, MT.rubber, rx - 0.55, Math.max(0.2, by - 0.05), 0, null, { parent: ug }); c.cyl(0.2, 0.2, 0.21, ST, rx - 0.55, Math.max(0.2, by - 0.05), 0, null, { parent: ug }); }
    ug.traverse(function (x) { x.castShadow = false; });
    return ug;
  };
  ZG.carDetails = function (c, s) {
    var m = c.meta, W = m.W, by = s.bottomY, it = s.lower;
    var bumperY = by + 0.14, bf = profX(it, bumperY, true), br = profX(it, bumperY, false);
    var bumper = s.bodyBumper ? c.paint(s.col) : MT.trim;
    m.bumperF = c.rb(0.24, 0.22, W + 0.03, 0.09, bumper, bf - 0.04, bumperY, 0, { def: true });
    c.part("parachoque", "Para-choque dianteiro", m.bumperF, new V3(bf, bumperY, 0), 1.1);
    m.bumperR = c.rb(0.24, 0.22, W + 0.03, 0.09, bumper, br + 0.04, bumperY, 0, { def: true });
    c.part("parachoque", "Para-choque traseiro", m.bumperR, new V3(br, bumperY, 0), 1.1);
    var hl = Object.assign({ style: s.headMat === MT.led ? "slim" : "rect", w: s.headW || 0.34, h: s.headH || 0.12, in: 0.06, yaw: 0.16 }, s.hl || {});
    var hy = hl.y || s.headY || (s.noseY - 0.06), hx = profX(it, hy, true), hz = W / 2 - hl.in - hl.w / 2;
    [1, -1].forEach(function (sd) { ZG.headlight(c, { style: hl.style, x: hx + 0.02 + (hl.dx || 0), y: hy, z: sd * hz, w: hl.w, h: hl.h, side: sd, yaw: hl.yaw, mat: hl.mat }); });
    if (hl.style === "ledbar") ZG.lightBar(c, hx + 0.03, hy + hl.h * 0.3, -hz + hl.w / 2, hz - hl.w / 2, 0.018, 1);
    if (s.grille !== false && !s.noGrille) {
      var gr = Object.assign({ style: "bars", w: W * 0.44, h: Math.max(0.08, hy - bumperY - 0.12) }, s.grille || {});
      var gy = gr.y || (bumperY + hy) / 2 + 0.02, gx = profX(it, gy, true);
      ZG.grille(c, { style: gr.style, x: gx + 0.025, y: gy, w: gr.w, h: gr.h, col: s.col, emblem: gr.emblem });
    } else ZG.emblem(c, profX(it, hy + 0.02, true) + 0.055, hy + 0.02, 0, 0.04);
    var tl = Object.assign({ style: "wrap", w: s.tailW || 0.3, h: s.tailH || 0.14, in: 0.05 }, s.tl || {});
    var ty = tl.y || s.tailLightY || (s.tailY - 0.05), tx = profX(it, ty, false), tz = W / 2 - tl.in - tl.w / 2;
    [1, -1].forEach(function (sd) { ZG.taillight(c, { style: tl.style, x: tx - 0.02, y: ty, z: sd * tz, w: tl.w, h: tl.h, side: sd, wrap: tl.wrap }); });
    if (tl.style === "bar") ZG.lightBar(c, tx - 0.03, ty + tl.h * 0.15, -tz + tl.w / 2, tz - tl.w / 2, Math.min(0.04, tl.h * 0.4), -1);
    [1, -1].forEach(function (sd) {
      if (m.gh && m.gh.Wg) {
        var mx = m.gh.fb - 0.12, my = m.gh.belt + 0.1, mz = sd * (halfAt(m.gh.Wg, m.T, my) + 0.13);
        c.rb(0.13, 0.11, 0.07, 0.035, c.paint(s.mirrorCol || s.col), mx, my, mz);
        c.rb(0.02, 0.08, 0.05, 0.01, MT.chrome, mx - 0.07, my, mz);
        c.rod(new V3(mx + 0.02, my - 0.02, mz - sd * 0.04), new V3(mx + 0.04, my - 0.05, sd * (W / 2 - 0.02)), 0.015, MT.trim);
      }
      (s.seams || []).forEach(function (x) { c.rb(0.012, m.belt - by - 0.14, 0.006, 0.003, MT.dark, x, (m.belt + by) / 2 + 0.04, sd * (W / 2 + 0.002)); });
      (s.handles || []).forEach(function (x) { c.rb(0.13, 0.035, 0.025, 0.012, MT.chrome, x, m.belt - 0.12, sd * (W / 2 + 0.01)); });
      if (s.arches && s.arches.length > 1) {
        var x0 = Math.min(s.arches[0][0], s.arches[1][0]) + s.arches[0][2], x1 = Math.max(s.arches[0][0], s.arches[1][0]) - s.arches[0][2];
        c.rb(x1 - x0, 0.07, 0.03, 0.012, MT.trim, (x0 + x1) / 2, by + 0.06, sd * (W / 2 + 0.008));
      }
    });
    c.plate(bf + 0.085, bumperY + 0.01, 0, "+x");
    var pry = s.plateRearY || by + 0.42; c.plate(profX(it, pry, false) - 0.025, pry, 0, "-x");
    if (m.gh && m.gh.Wg) {
      var wy = m.gh.belt + 0.07, wx = m.gh.fb - 0.05;
      [-0.25, 0.25].forEach(function (z) { c.rod(new V3(wx + 0.03, wy, z - 0.02), new V3(wx - 0.18, wy + 0.17, z - 0.3), 0.01, MT.trim); });
    }
    c.cyl(0.035, 0.035, 0.22, MT.steel, br - 0.05, by + 0.04, W * 0.3, "x"); m.exhaust = new V3(br - 0.17, by + 0.04, W * 0.3);
    if (!s.noAntenna && m.roof) c.rod(new V3(m.roof.x0 + 0.1, m.top, 0), new V3(m.roof.x0 - 0.05, m.top + 0.22, 0), 0.008, MT.trim);
    /* s.track (ou w[3].track): bitola de centro a centro dos pneus; sem ela, o pneu encosta na borda da carroceria */
    (s.wheels || []).forEach(function (w) { var tk = (w[3] && w[3].track) || s.track; [1, -1].forEach(function (sd) { c.wheel(w[0], sd * (tk ? tk / 2 : W / 2 - w[2] / 2 + 0.03), w[1], w[2], w[3] || {}); }); });
    if (!c.parts.some(function (p) { return p.kind === "motor"; })) c.part("motor", "Motor", null, new V3(m.front - 0.6, by + 0.45, 0), 1.0);
    if (!c.parts.some(function (p) { return p.kind === "radiador"; }) && !s.noRadiator) c.part("radiador", "Radiador", null, new V3(m.front - 0.15, by + 0.35, 0), 0.9);
    c.part("tanque", s.tankLabel || "Tanque de combustível", null, new V3(m.rear + 0.75, by + 0.15, -W * 0.22), 1.0);
  };

  /* Alargador de para-lama (fender flare): faixa em arco sobre a caixa de roda, nos dois lados.
     x, y: centro da roda; r: raio do arco; z: meia largura onde cola; o: { w (largura da faixa), t (espessura), mat, a0 (ângulo inicial), sides } */
  ZG.archFlare = function (c, x, y, r, z, o) {
    o = o || {}; var w = o.w || 0.07, t = o.t || 0.03, mat = o.mat || MT.trim, a0 = o.a0 == null ? 0.12 : o.a0, out = [];
    (o.sides || [1, -1]).forEach(function (sd) {
      var shp = new THREE.Shape(), N = 24;
      for (var i = 0; i <= N; i++) { var a = a0 + (PI - 2 * a0) * i / N; shp[i ? "lineTo" : "moveTo"](Math.cos(a) * (r + w), Math.sin(a) * (r + w)); }
      for (var j = N; j >= 0; j--) { var b = a0 + (PI - 2 * a0) * j / N; shp.lineTo(Math.cos(b) * r, Math.sin(b) * r); }
      var g = new THREE.ExtrudeGeometry(shp, { depth: t, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 4 });
      g.translate(0, 0, sd > 0 ? 0 : -t);
      var m = c.add(g, mat, x, y, sd * z); out.push(m);
    });
    return out;
  };

  /* ================= caminhões ================= */
  /* Cabine avançada. o: { f (x da frente), W, col, len (2.05), roofY (2.92), belt (1.75), floor (1.25), wheelR (0.52), wheelW (0.32), int:{col,trim}, hl, grille, sleeper } */
  ZG.truckCab = function (c, o) {
    var f = o.f, W = o.W, col = o.col, len = o.len || 2.05, ry = o.roofY || 2.92, belt = o.belt || 1.75, fl = o.floor || 1.25, wr = o.wheelR || 0.52, ww = o.wheelW || 0.32;
    var T = { belt: belt, top: ry + 0.03, k: 0.04 };
    var items = [[f - len, 0.95, 0.05], [f - len - 0.01, ry - 0.07, 0.15], [f - 0.25, ry, 0.2], [f - 0.04, ry - 0.32, 0.12], [f + 0.03, 1.05, 0.1], [f, 0.88, 0.05]];
    var m = c.meta; m.col = col; m.kind = m.kind || "truck";
    var ax = f - 0.85;
    var q = ZG.quadDef([f + 0.01, belt + 0.03], [f - 0.06, ry - 0.26], W, T, "front", 0.05, { inset: 0.04, side: 0.12 });
    var poly = [[f - len * 0.66, belt + 0.05], [f - 0.18, belt + 0.05], [f - 0.22, ry - 0.3], [f - len * 0.66, ry - 0.3]];
    var holes = [ZG.holeSide(poly), ZG.holeQuad(q)];
    shell(c, { items: items, bottomY: 0.88, arches: [[ax, wr, wr + 0.08]], W: W, col: col, T: T, holes: holes, archInner: W / 2 - ww - 0.2 });
    ZG.glassQuad(c, q, "Para-brisa");
    ZG.sideWindows(c, [poly], W, T, function () { return "Janela da cabine"; });
    Object.assign(m, { W: W, front: f + 0.03, clear: 0.88, belt: belt, top: ry + 0.03, bodyH: 1.0, T: T, gh: { fb: f, belt: belt + 0.03, Wg: W }, cabRear: f - len });
    var ic = o.int || {}, fab = CM(ic.col || "#3a3b3d", { roughness: 0.88 }), trim = CM(ic.trim || "#202124", { roughness: 0.7 }), zi = W / 2 - 0.1;
    c.rb(len - 0.2, 0.04, zi * 2, 0.015, MT.carpet, f - len / 2 - 0.05, fl, 0);
    ZG.dashboard(c, { x: f - 0.12, y: belt + 0.02, w: zi * 2, d: 0.45, h: belt - fl - 0.05, drv: -0.55, mat: trim, top: fab });
    ZG.steeringWheel(c, f - 0.7, belt + 0.08, -0.55, { r: 0.24, tilt: 1.05, col: 0.5, mat: trim });
    var sx = f - 1.2;
    ZG.seat(c, sx, fl, -0.55, { w: 0.52, mat: fab, h: 0.45, back: 0.62 });
    ZG.seat(c, sx, fl, 0.45, { w: 0.86, n: 2, mat: fab, h: 0.45, back: 0.6 });
    c.rb(0.03, ry - fl - 0.1, zi * 2, 0.01, trim, f - len + 0.08, (ry + fl) / 2, 0);
    c.rb(len - 0.4, 0.02, zi * 2 * 0.95, 0.01, MT.headliner, f - len / 2, ry - 0.06, 0).castShadow = false;
    var rim = CM("#c8c4b8", { metalness: 0.4 });
    [1, -1].forEach(function (s) {
      c.rb(0.012, 1.5, 0.006, 0.003, MT.dark, f - len * 0.68, belt, s * (W / 2 + 0.002)); c.rb(0.012, 1.5, 0.006, 0.003, MT.dark, f - 0.15, belt, s * (W / 2 + 0.002));
      c.rb(0.14, 0.04, 0.03, 0.012, MT.chrome, f - len * 0.6, belt - 0.1, s * (W / 2 + 0.012));
      c.rb(0.5, 0.05, 0.25, 0.02, MT.steel, f - 1.62, 0.62, s * (W / 2 - 0.1)); c.rb(0.5, 0.05, 0.25, 0.02, MT.steel, f - 1.62, 0.32, s * (W / 2 - 0.1));
      c.tube([[f - 0.2, 2.4, s * (W / 2)], [f + 0.1, 2.5, s * (W / 2 + 0.25)], [f + 0.1, 2.0, s * (W / 2 + 0.32)]], 0.02, MT.trim);
      c.rb(0.06, 0.45, 0.22, 0.03, MT.trim, f + 0.1, 2.1, s * (W / 2 + 0.33)); c.rb(0.01, 0.4, 0.18, 0.01, MT.chrome, f + 0.065, 2.1, s * (W / 2 + 0.33));
      ZG.headlight(c, Object.assign({ style: "truck", x: f + 0.1, y: 0.74, z: s * (W / 2 - 0.32), w: 0.38, h: 0.18, side: s }, o.hl || {}));
      c.wheel(ax, s * (W / 2 - 0.2), wr, ww, { rim: rim, spokes: 8 });
    });
    ZG.grille(c, Object.assign({ style: "truck", x: f + 0.05, y: 1.35, w: W * 0.66, h: 0.56, col: col }, o.grille || {}));
    m.bumperF = c.rb(0.22, 0.32, W + 0.04, 0.06, MT.trim, f + 0.06, 0.72, 0, { def: true });
    c.part("parachoque", "Para-choque dianteiro", m.bumperF, new V3(f + 0.1, 0.72, 0), 1.1);
    c.plate(f + 0.175, 0.56, 0, "+x");
    c.part("motor", "Motor", null, new V3(f - 1.0, 0.95, 0), 1.0);
    c.part("radiador", "Radiador", null, new V3(f - 0.1, 1.2, 0), 0.9);
    if (o.visor !== false) c.rb(0.9, 0.3, W * 0.92, 0.12, c.paint(col), f - 1.2, ry + 0.16, 0, { taper: { sx: 0.6, shift: -0.25 } });
    return m;
  };
  /* Chassi, eixos traseiros, tanque e para-lamas. o: { f, L, W, axles:[x..], dual, tank ('esquerda'|'direita'|false), wheelR, wheelW } */
  ZG.truckChassis = function (c, o) {
    var f = o.f, L = o.L, W = o.W, rear = f - L, m = c.meta, rim = CM("#c8c4b8", { metalness: 0.4 }), wr = o.wheelR || 0.52, ww = o.wheelW || 0.32;
    [0.42, -0.42].forEach(function (z) { c.rb(L - 0.3, 0.25, 0.12, 0.03, MT.trim, (f + rear) / 2 - 0.1, 0.68, z); });
    var axles = o.axles || [rear + 1.9, rear + 0.85];
    axles.forEach(function (x) { [1, -1].forEach(function (s) { c.wheel(x, s * (W / 2 - 0.2), wr, ww, { rim: rim, spokes: 8 }); if (o.dual !== false) c.wheel(x, s * (W / 2 - 0.55), wr, ww - 0.02, { rim: rim, spokes: 8, noPart: true }); }); });
    var ts = o.tank === "direita" ? 1 : -1;
    if (o.tank !== false) {
      c.cyl(0.3, 0.3, 1.1, MT.chrome, f - 2.8, 0.55, ts * (W / 2 - 0.35), "x", { seg: 24 });
      c.cyl(0.08, 0.08, 0.04, MT.trim, f - 2.6, 0.86, ts * (W / 2 - 0.35));
      c.part("tanque", "Tanque de diesel", null, new V3(f - 2.8, 0.55, ts * (W / 2 - 0.35)), 0.8);
    }
    c.rb(0.6, 0.45, 0.5, 0.04, MT.trim, f - 2.8, 0.55, -ts * (W / 2 - 0.35));
    [1, -1].forEach(function (s) { c.rb(0.02, 0.5, 0.55, 0.01, MT.rubber, rear + 0.35, 0.45, s * (W / 2 - 0.35)); });
    c.rb(0.1, 0.12, W * 0.9, 0.03, MT.steel, rear + 0.05, 0.5, 0);
    c.plate(rear - 0.01, 0.7, 0, "-x");
    [1, -1].forEach(function (s) { ZG.taillight(c, { style: "vertical", x: rear + 0.06, y: 0.66, z: s * (W / 2 - 0.25), w: 0.12, h: 0.24, side: s }); });
    m.rear = rear; m.L = L;
  };

  /* ================= rodas especiais ================= */
  /* Roda raiada de moto/bicicleta. o: { spokes, knobby, disc, cast (liga de 5 raios), z, label } */
  ZG.spokedWheel = function (c, x, r, tireR, o) {
    o = o || {};
    var g = new THREE.Group(); g.position.set(x, r, o.z || 0); c.g.add(g);
    var t = new THREE.Mesh(new THREE.TorusGeometry(r - tireR, tireR, 12, 40), MT.rubber); t.castShadow = true; g.add(t);
    if (o.knobby) { var kn = []; for (var i = 0; i < 30; i++) { var a = i / 30 * PI * 2, k = rboxGeo(0.04, 0.03, tireR * 1.6, 0.01); k.applyMatrix4(new THREE.Matrix4().makeRotationZ(a).setPosition(Math.cos(a) * r, Math.sin(a) * r, 0)); kn.push(k); } g.add(new THREE.Mesh(mergeGeos(kn), MT.rubber)); }
    var rim = new THREE.Mesh(new THREE.TorusGeometry(r - tireR * 2 - 0.005, 0.012, 6, 40), o.cast ? MT.trim : MT.chrome); g.add(rim);
    var sl = r - tireR * 2;
    if (o.cast) { for (var j = 0; j < 5; j++) { var sp = new THREE.Mesh(rboxGeo(sl, 0.03, 0.025, 0.01), MT.trim), a3 = j / 5 * PI * 2; sp.position.set(Math.cos(a3) * sl / 2, Math.sin(a3) * sl / 2, 0); sp.rotation.z = a3; g.add(sp); } }
    else { var ns = o.spokes || 28, list = []; for (var jj = 0; jj < ns; jj++) { var a2 = jj / ns * PI * 2, cg = new THREE.CylinderGeometry(0.0025, 0.0025, sl, 4); cg.applyMatrix4(new THREE.Matrix4().makeRotationZ(a2 - PI / 2).setPosition(Math.cos(a2) * sl / 2, Math.sin(a2) * sl / 2, (jj % 2 ? 1 : -1) * 0.012)); list.push(cg); } g.add(new THREE.Mesh(mergeGeos(list), MT.chrome)); }
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), MT.steel); hub.rotation.x = PI / 2; g.add(hub);
    if (o.disc) { var dsk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.008, 24), MT.steel); dsk.rotation.x = PI / 2; dsk.position.z = 0.06; g.add(dsk); }
    g.userData.r = r; c.wheels.push(g);
    c.part("roda", o.label || (x > 0 ? "Pneu dianteiro" : "Pneu traseiro"), g, new V3(x, r, o.z || 0), 0.8);
    return g;
  };
  /* Lagarta simples (tanque). o: { x0 (roda motriz, atrás), x1 (roda guia, frente), z, w, r (rodas de apoio), n, top, mat } */
  ZG.tracks = function (c, o) {
    var x0 = o.x0, x1 = o.x1, z = o.z, w = o.w || 0.55, r = o.r || 0.33, n = o.n || 6, top = o.top || 1.0, th = 0.06, mat = o.mat || CM("#2b2c2a", { metalness: 0.5, roughness: 0.6 });
    var wheelMat = o.wheelMat || CM("#3f4a36", { roughness: 0.7 });
    var rs = (top - th) / 2 - 0.02, rsY = top - rs - th;
    var sp = (x1 - x0 - 2 * rs) / Math.max(1, n - 1) * 0.92, firstX = x0 + rs + 0.1;
    var gs = [];
    function road(x, y, rr) {
      var g = new THREE.Group(); g.position.set(x, y, z); c.g.add(g);
      var wm = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w * 0.8, 22), wheelMat); wm.rotation.x = PI / 2; wm.castShadow = true; g.add(wm);
      var rb2 = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.03, 0.03, 6, 22), MT.rubber); g.add(rb2);
      var hb = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.3, rr * 0.3, w * 0.84, 10), MT.steel); hb.rotation.x = PI / 2; g.add(hb);
      gs.push(g); c.spin.push({ o: g, axis: "z", v: 0, track: true }); return g;
    }
    for (var i = 0; i < n; i++) road(firstX + i * sp, r + th, r);
    var spr = road(x0, rsY, rs), idl = road(x1, rsY, rs);
    for (var k = 0; k < 3; k++) road(x0 + (x1 - x0) * (0.25 + k * 0.25), top - th - 0.07, 0.07);
    var path = [], segs = 40;
    function arc(cx, cy, rr, a0, a1) { for (var s = 0; s <= segs / 4; s++) { var a = a0 + (a1 - a0) * s / (segs / 4); path.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } }
    path.push([firstX - 0.05, th / 2]); path.push([firstX + (n - 1) * sp + 0.05, th / 2]);
    arc(x1, rsY, rs + th / 2, -PI / 2 + 0.6, PI / 2);
    arc(x0, rsY, rs + th / 2, PI / 2, PI * 1.5 - 0.6);
    var pts = path.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var curve = new THREE.SplineCurve(pts.concat([pts[0]])), lenT = curve.getLength(), nl = Math.round(lenT / 0.15), links = [];
    for (var l = 0; l < nl; l++) {
      var t = l / nl, p = curve.getPointAt(t), tg = curve.getTangentAt(t), ang = Math.atan2(tg.y, tg.x);
      var lg = rboxGeo(0.13, th, w, 0.015); lg.applyMatrix4(new THREE.Matrix4().makeRotationZ(ang).setPosition(p.x, p.y, 0)); links.push(lg);
      var gh2 = rboxGeo(0.05, 0.05, 0.05, 0.01); gh2.applyMatrix4(new THREE.Matrix4().makeRotationZ(ang).setPosition(p.x - Math.sin(ang) * 0.04, p.y + Math.cos(ang) * 0.04, 0)); links.push(gh2);
    }
    var tm = c.add(mergeGeos(links), mat, 0, 0, z); tm.userData.noFollow = true;
    c.part("lagarta", "Lagarta " + (z > 0 ? "direita" : "esquerda"), tm, new V3((x0 + x1) / 2, 0.3, z), 1.4);
    return { mesh: tm, wheels: gs, sprocket: spr, idler: idl };
  };

  /* ================= partículas ================= */
  var LIMIT = 400;
  var PG = {
    faisca: new THREE.BoxGeometry(0.012, 0.012, 0.1),
    caco: new THREE.TetrahedronGeometry(0.028, 0),
    cubo: new THREE.BoxGeometry(0.014, 0.014, 0.014),
    lente: new THREE.TetrahedronGeometry(0.022, 0),
    lata: new THREE.BoxGeometry(0.07, 0.008, 0.05),
    plastico: new THREE.BoxGeometry(0.06, 0.014, 0.04),
    agua: new THREE.SphereGeometry(0.03, 6, 4),
    gota: new THREE.SphereGeometry(0.012, 6, 4)
  };
  var PM = {
    faisca: new THREE.MeshBasicMaterial({ color: 0xffc46a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    caco: CM("#cfe3e8", { roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.8 }),
    cubo: CM("#d6e8ec", { roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.85 }),
    lenteclear: CM("#f2f6f7", { roughness: 0.05, transparent: true, opacity: 0.7 }),
    lentered: CM("#c0281c", { roughness: 0.05, transparent: true, opacity: 0.8 }),
    plastico: CM("#18191b", { roughness: 0.7 }),
    agua: new THREE.MeshBasicMaterial({ color: 0xbfd8e0, transparent: true, opacity: 0.7, depthWrite: false }),
    gota: CM("#0b0908", { roughness: 0.05, metalness: 0.7 })
  };
  /* ---- fumaça, fogo e poeira: puffs em sprite com textura de ruído; crescem, vão com o vento e se dissolvem por ruído ---- */
  function vnoise(seed) {
    var N = 16, g = []; for (var i = 0; i < N * N; i++) g.push(hash(i % N, (i / N) | 0, seed));
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      function G(a, b) { return g[((a % N) + N) % N + (((b % N) + N) % N) * N]; }
      var a = G(xi, yi) + (G(xi + 1, yi) - G(xi, yi)) * sx, b = G(xi, yi + 1) + (G(xi + 1, yi + 1) - G(xi, yi + 1)) * sx; return a + (b - a) * sy;
    };
  }
  function puffTex(seed, fire) {
    var S = 96, cv = document.createElement("canvas"); cv.width = cv.height = S; var x = cv.getContext("2d"), img = x.createImageData(S, S), nz = vnoise(seed);
    for (var j = 0; j < S; j++) for (var i = 0; i < S; i++) {
      var u = i / S * 2 - 1, v = j / S * 2 - 1, r = Math.hypot(u, v);
      var f = nz(i / 12, j / 12) * 0.5 + nz(i / 6 + 7, j / 6 + 3) * 0.3 + nz(i / 3 + 11, j / 3 + 5) * 0.2;
      var edge = 1 - smooth((r - 0.25 - f * 0.35) / 0.45), a = clamp(edge * (0.55 + f * 0.6), 0, 1), k = (j * S + i) * 4;
      if (fire) { var hot = clamp(1 - r * 1.3 + f * 0.3, 0, 1); img.data[k] = 255; img.data[k + 1] = Math.round(90 + 165 * hot); img.data[k + 2] = Math.round(30 + 170 * hot * hot * hot); }
      else { var sh = Math.round(150 + 105 * clamp(f * 1.1 - v * 0.25, 0, 1)); img.data[k] = img.data[k + 1] = img.data[k + 2] = sh; }
      img.data[k + 3] = Math.round(a * 255);
    }
    x.putImageData(img, 0, 0); var t = new THREE.CanvasTexture(cv); return t;
  }
  var PUFF = null, FIRE = null;
  function puffMat(fire, col, op) {
    if (!PUFF) { PUFF = [1, 2, 3, 4].map(function (k) { return puffTex(k * 13, false); }); FIRE = [5, 6, 7].map(function (k) { return puffTex(k * 17, true); }); }
    var list = fire ? FIRE : PUFF, mat = new THREE.SpriteMaterial({ map: list[Math.floor(Math.random() * list.length)], color: new THREE.Color(col), transparent: true, depthWrite: false, opacity: op, blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending });
    var dis = { value: 0 }; mat.userData.dis = dis;
    mat.onBeforeCompile = function (sh) { sh.uniforms.uDis = dis; sh.fragmentShader = "uniform float uDis;\n" + sh.fragmentShader.replace("#include <alphatest_fragment>", "diffuseColor.a *= smoothstep(uDis, uDis + 0.2, texelColor.a); if (diffuseColor.a < 0.003) discard;"); };
    return mat;
  }
  var SPRITE = { fumaca: 1, fogo: 1, poeira: 1 };
  var PUFFCOL = { fumacabranca: ["#9aa1a7", 0.42], fumacapreta: ["#1b1b1c", 0.62], fumacacinza: ["#55595c", 0.5], fumacavapor: ["#b6bcc1", 0.3], poeira: ["#6e6658", 0.34], fogo: ["#ffffff", 0.9] };
  var WIND = new V3(-0.45, 0, 0.16);
  var LIFE = { faisca: 0.6, poeira: 1.6, fumaca: 2.8, fogo: 0.7, agua: 1.2, gota: 1.0 };
  var TRANSIENT = { faisca: 1, poeira: 1, fumaca: 1, fogo: 1, agua: 1, gota: 1 };
  function killP(c, i) { var P = c.ps[i]; c.fx.remove(P.m); if (P.own) P.m.material.dispose(); c.ps.splice(i, 1); }
  /* Partícula no grupo irmão c.fx (coordenadas do mundo do veículo). tipo: faisca|caco|cubo|lente|lata|plastico|poeira|fumaca|fogo|agua|gota */
  ZG.spawn = function (c, type, pos, vel, o) {
    o = o || {};
    if (c.ps.length >= LIMIT) {
      var idx = c.ps.findIndex(function (q) { return TRANSIENT[q.type]; });
      killP(c, idx >= 0 ? idx : 0);
    }
    var m, own = false, op = 1;
    if (SPRITE[type]) {
      var pc = PUFFCOL[type + (o.variant || "")] || PUFFCOL[type] || PUFFCOL.fumacabranca, opv = o.op != null ? o.op : pc[1];
      m = new THREE.Sprite(puffMat(type === "fogo", o.col || pc[0], opv)); m.raycast = function () {}; own = true; op = opv; if (o.nofog) m.material.fog = false;
      m.material.rotation = c.rand() * PI * 2; m.scale.setScalar(0.01);
    } else {
      var mat = o.mat || PM[type + (o.variant || "")] || PM[type];
      m = new THREE.Mesh(PG[type], mat); m.castShadow = false; m.receiveShadow = false; op = mat.opacity;
      if (o.s) m.scale.setScalar(o.s);
      m.rotation.set(c.rand() * 6, c.rand() * 6, c.rand() * 6);
    }
    m.position.copy(pos); c.fx.add(m);
    var P = { m: m, v: vel.clone(), type: type, age: 0, life: o.life || LIFE[type] || 99, rest: false, w: new V3(c.rand() - 0.5, c.rand() - 0.5, c.rand() - 0.5).multiplyScalar(14), s0: o.s || 1, op: op, own: own, r: o.r || 0.01, spin: (c.rand() - 0.5) * 1.2, ph: c.rand() * 6.28, grow: o.grow || 1 };
    c.ps.push(P); return P;
  };
  var _q = new THREE.Quaternion(), _z = new V3(0, 0, 1), _t = new V3();
  function tickParticles(c, dt) {
    for (var i = c.ps.length - 1; i >= 0; i--) {
      var P = c.ps[i]; if (P.rest) continue;
      P.age += dt; var m = P.m, t = P.age / P.life;
      if (t >= 1 && TRANSIENT[P.type]) { killP(c, i); continue; }
      if (P.type === "faisca") {
        P.v.y -= 9.8 * dt; m.position.addScaledVector(P.v, dt);
        if (m.position.y < 0.005) { m.position.y = 0.005; P.v.y *= -0.35; P.v.x *= 0.6; P.v.z *= 0.6; }
        var sp = P.v.length(); if (sp > 0.01) { m.quaternion.setFromUnitVectors(_z, _t.copy(P.v).divideScalar(sp)); m.scale.set(1, 1, clamp(sp * 0.25, 0.3, 1.6) * (1 - t)); }
      } else if (P.type === "fumaca" || P.type === "poeira") {
        /* empuxo que some, arrasto até a velocidade do vento, turbulência suave */
        var k = Math.min(1, dt * (P.type === "poeira" ? 2.5 : 0.9));
        P.v.x += (WIND.x - P.v.x) * k; P.v.z += (WIND.z - P.v.z) * k;
        P.v.y = P.type === "poeira" ? P.v.y * Math.max(0, 1 - 2.5 * dt) : P.v.y * Math.max(0, 1 - 0.7 * dt) + 0.08 * dt;
        m.position.addScaledVector(P.v, dt);
        m.position.x += Math.sin(P.age * 1.7 + P.ph) * 0.08 * dt; m.position.z += Math.cos(P.age * 1.3 + P.ph) * 0.08 * dt;
        var gs = P.s0 * P.grow * (0.18 + 1.5 * (1 - Math.exp(-P.age * 1.1)) + P.age * 0.12);
        m.scale.set(gs, gs, 1); m.material.rotation += P.spin * dt;
        m.material.opacity = P.op * Math.min(1, P.age / 0.3);
        m.material.userData.dis.value = Math.pow(t, 1.3) * 0.95;
      } else if (P.type === "fogo") {
        P.v.x += (WIND.x * 0.6 - P.v.x) * Math.min(1, dt * 1.5); P.v.z += (WIND.z * 0.6 - P.v.z) * Math.min(1, dt * 1.5);
        m.position.addScaledVector(P.v, dt);
        var fs = P.s0 * (0.35 + 0.5 * Math.sin(Math.min(1, t * 1.4) * PI * 0.5)) * (1 - t * 0.55) * (0.9 + 0.2 * Math.sin(P.age * 25 + P.ph));
        m.scale.set(fs * 0.85, fs * 1.25, 1); m.material.rotation += P.spin * dt * 2;
        m.material.color.setHSL(0.11 - t * 0.09, 1, 0.62 - t * 0.3);
        m.material.userData.dis.value = Math.pow(t, 1.1) * 0.9;
      } else if (P.type === "agua") {
        P.v.y -= 9.8 * dt; m.position.addScaledVector(P.v, dt);
        if (m.position.y < -0.05) killP(c, i);
      } else if (P.type === "gota") {
        P.v.y -= 9.8 * dt; m.position.addScaledVector(P.v, dt);
        if (m.position.y < 0.012) killP(c, i);
      } else {
        P.v.y -= 9.8 * dt; m.position.addScaledVector(P.v, dt);
        m.rotation.x += P.w.x * dt; m.rotation.y += P.w.y * dt; m.rotation.z += P.w.z * dt;
        var floor = P.floor != null ? P.floor : 0.006;
        if (m.position.y < floor) {
          m.position.y = floor;
          if (Math.abs(P.v.y) < 1.1) { P.rest = true; m.rotation.x = (c.rand() - 0.5) * 0.3; m.rotation.z = (c.rand() - 0.5) * 0.3; }
          else { P.v.y *= -0.32; P.v.x *= 0.5; P.v.z *= 0.5; P.w.multiplyScalar(0.5); }
        }
      }
    }
  }
  function burst(c, type, pFx, n, o) {
    o = o || {}; var d = o.dir || new V3(0, 1, 0), spd = o.speed || 2, spread = o.spread == null ? 1 : o.spread;
    for (var i = 0; i < n; i++) {
      var v = new V3(c.rand() - 0.5, c.rand() * 0.8, c.rand() - 0.5).multiplyScalar(spread * spd).addScaledVector(d, spd * (0.5 + c.rand()));
      ZG.spawn(c, type, pFx.clone().add(new V3((c.rand() - 0.5) * (o.jitter || 0.08), (c.rand() - 0.5) * (o.jitter || 0.08), (c.rand() - 0.5) * (o.jitter || 0.08))), v, o);
    }
  }
  ZG.burst = burst;
  /* Emissor contínuo. p em c.g (ou no mundo do veículo com o.world). kind: branca|preta|fogo|escape (escape segue c.engineHealth) */
  ZG.addEmitter = function (c, p, kind, o) {
    o = o || {};
    if (c.emit.some(function (e) { return e.kind === kind && e.p.distanceTo(p) < 0.3; })) return null;
    var e = { p: p.clone(), kind: kind, world: !!o.world, rate: o.rate || (kind === "fogo" ? 14 : kind === "escape" ? 7 : 6), acc: 0, s: o.s || 1, dir: o.dir || null, gap: 0 };
    c.emit.push(e); return e;
  };
  /* cor e opacidade da fumaça do escapamento pela condição do motor: 100% quase invisível, 60% cinza, 30% cinza-escura, 10% preta com falhas */
  function exhaustLook(h) {
    if (h >= 0.85) return ["#a7adb2", 0.05];
    if (h >= 0.45) return ["#7b8084", 0.2 + (0.85 - h) * 0.3];
    if (h >= 0.2) return ["#3f4245", 0.42];
    return ["#141414", 0.66];
  }
  ZG.exhaustLook = exhaustLook;
  function tickEmit(c, dt) {
    c.emit.forEach(function (e) {
      if (e.kind === "escape") {
        var h = c.engineHealth == null ? 1 : c.engineHealth; if (h <= 0 || c.flipped || c.rollA) return;
        if (h < 0.2) { e.gap -= dt; if (e.gap < -0.5 && c.rand() < dt * 1.5) e.gap = 0.25 + c.rand() * 0.35; if (e.gap > 0) return; }
      }
      e.acc += e.rate * dt;
      while (e.acc >= 1) {
        e.acc -= 1;
        var p = e.world ? e.p.clone() : c.toFx(e.p);
        if (e.kind !== "escape") { p.x += (c.rand() - 0.5) * 0.15; p.z += (c.rand() - 0.5) * 0.15; }
        if (e.kind === "fogo") {
          ZG.spawn(c, "fogo", p, new V3((c.rand() - 0.5) * 0.3, 1.1 + c.rand() * 0.8, (c.rand() - 0.5) * 0.3), { s: (0.45 + c.rand() * 0.45) * e.s, life: 0.55 + c.rand() * 0.35 });
          if (c.rand() < 0.45) ZG.spawn(c, "fumaca", p.clone().add(new V3(0, 0.7 * e.s, 0)), new V3(0, 1.0, 0), { variant: "preta", s: 0.9 * e.s, life: 3.2 });
          if (c.rand() < 0.15) ZG.spawn(c, "faisca", p.clone().add(new V3(0, 0.2, 0)), new V3((c.rand() - 0.5) * 0.6, 1.6 + c.rand(), (c.rand() - 0.5) * 0.6), { life: 0.9 });
        } else if (e.kind === "escape") {
          var lk = exhaustLook(c.engineHealth == null ? 1 : c.engineHealth), d = e.dir ? c.dirFx(e.dir) : c.dirFx(new V3(-1, 0, 0));
          ZG.spawn(c, "fumaca", p, d.multiplyScalar(1.1 + c.rand() * 0.4).add(new V3(0, 0.15, 0)), { col: lk[0], op: lk[1], s: 0.35 + c.rand() * 0.15, life: 1.4 + c.rand() * 0.5 });
        } else {
          var preta = e.kind === "preta";
          ZG.spawn(c, "fumaca", p, new V3((c.rand() - 0.5) * 0.2, preta ? 0.9 + c.rand() * 0.3 : 1.1 + c.rand() * 0.3, (c.rand() - 0.5) * 0.2), { variant: preta ? "preta" : "vapor", s: (preta ? 0.75 : 0.6) * e.s * (0.8 + c.rand() * 0.4), life: preta ? 3.2 : 2.0 });
        }
      }
    });
  }

  /* ================= fluidos ================= */
  /* Tipos de fluido de mancha (splat). Um jogo registra os seus com ZG.defineFluid(chave, def) ou configure({fluids}).
     def: { fresh, dry (cores hex), dryTime (s até secar), roughFresh, roughDry, metalFresh, metalDry, wipeable (limpador/chuva tiram o fresco) }
     Tipos sem "fresh" (def.update(c, f, dt, i) → true remove) viram fluidos totalmente personalizados do plugin. */
  ZG.fluidTypes = {};
  ZG.defineFluid = function (key, def) {
    var d = Object.assign({ dryTime: 600, roughFresh: 0.12, roughDry: 0.92, metalFresh: 0.15, metalDry: 0, wipeable: false }, def || {});
    d.key = key; d.freshC = new THREE.Color(d.fresh || "#444444"); d.dryC = new THREE.Color(d.dry || d.fresh || "#222222");
    ZG.fluidTypes[key] = d; return d;
  };
  ZG.defineFluid("mancha", { fresh: "#4a4a44", dry: "#26241f", wipeable: false });
  var _fr = new THREE.Raycaster();
  /* Respingo de líquido: mancha plana colada à superfície, contorno irregular, gotas satélite e um fio que escorre,
     afina e termina num bulbo. O fio para quando acaba o volume. Fresco brilhante, seca fosco no tempo do tipo de fluido.
     o: { fluid (chave de ZG.fluidTypes; padrão ZG.config.defaultSplat), glass, obj (malha onde colar; o fio acompanha a curva dela) } */
  ZG.splat = function (c, p, n, r, o) {
    o = o || {}; n = n.clone().normalize();
    var fdef = ZG.fluidTypes[o.fluid || ZG.config.defaultSplat] || ZG.fluidTypes.mancha;
    var mat = new THREE.MeshStandardMaterial({ color: fdef.freshC.clone(), roughness: fdef.roughFresh, metalness: fdef.metalFresh, side: DS, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    var grp = new THREE.Group(); grp.position.copy(p); c.g.add(grp);
    var g = new V3(0, -1, 0).addScaledVector(n, n.y); if (g.lengthSq() < 1e-4) g.set(1, 0, 0); g.normalize();
    var side = new V3().crossVectors(g, n).normalize(), M = new THREE.Matrix4().makeBasis(g, n, side);
    grp.quaternion.setFromRotationMatrix(M);
    var rnd = c.rand, nz = vnoise(Math.floor(rnd() * 1000));
    function blobShape(cx, cz, rr, k, ph) {
      var sh = new THREE.Shape(), N = 28;
      for (var i = 0; i <= N; i++) {
        var a = i / N * PI * 2, q = rr * (0.72 + 0.42 * nz(Math.cos(a) * k + ph, Math.sin(a) * k + ph) + 0.12 * Math.max(0, Math.cos(a)));
        var x = cx + Math.cos(a) * q, y = cz + Math.sin(a) * q; if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
      }
      return sh;
    }
    var shapes = [blobShape(0, 0, r, 2.2, rnd() * 9)];
    var nsat = 4 + Math.floor(rnd() * 4);
    for (var i = 0; i < nsat; i++) { var a = rnd() * PI * 2, d = r * (1.15 + rnd() * 1.1); shapes.push(blobShape(Math.cos(a) * d, Math.sin(a) * d, r * (0.07 + rnd() * 0.12), 3, rnd() * 9)); }
    var bg = new THREE.ShapeGeometry(shapes, 2); bg.rotateX(PI / 2);
    var blob = new THREE.Mesh(bg, mat); blob.castShadow = false; blob.receiveShadow = true; blob.position.y = 0.004; grp.add(blob);
    /* caminho do fio: amostras ao longo da descida, coladas na superfície por raio contra a malha de origem */
    var Lmax = r * (2.2 + rnd() * 2.2), NS = 10, off = [];
    c.root.updateMatrixWorld(true);
    for (var k = 0; k <= NS; k++) {
      var xl = r * 0.55 + Lmax * k / NS, h = 0.004;
      if (o.obj && o.obj.isMesh && k > 0) {
        var lp = p.clone().addScaledVector(g, xl), wo = lp.clone().addScaledVector(n, 0.2).applyMatrix4(c.g.matrixWorld), wd = n.clone().negate().transformDirection(c.g.matrixWorld);
        _fr.set(wo, wd); _fr.far = 0.45; var hit = _fr.intersectObject(o.obj, false)[0];
        if (hit) { var hl = hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(c.g.matrixWorld).invert()); h = hl.sub(p).dot(n) + 0.004; if (h < -0.15) h = off[k - 1]; }
        else h = off[k - 1];
      }
      off.push(h);
    }
    var drip = new THREE.Mesh(new THREE.BufferGeometry(), mat); drip.castShadow = false; grp.add(drip);
    var f = { kind: fdef.key, def: fdef, grp: grp, mat: mat, drip: drip, r: r, t: 0, onGlass: !!o.glass, Lmax: Lmax, off: off, len: -1, w0: r * (0.26 + rnd() * 0.1) };
    buildDrip(f, 0.02);
    c.fluids.push(f); return f;
  };
  function buildDrip(f, L) {
    var pos = [], NS = 12, r = f.r, x0 = r * 0.55;
    function hAt(x) { var u = clamp((x - x0) / f.Lmax, 0, 1) * (f.off.length - 1), i = Math.min(f.off.length - 2, Math.floor(u)), t = u - i; return f.off[i] + (f.off[i + 1] - f.off[i]) * t; }
    var prev = null;
    for (var k = 0; k <= NS; k++) {
      var t = k / NS, x = x0 - r * 0.25 + (L + r * 0.25) * t, hw = f.w0 * (1 - 0.72 * Math.pow(t, 0.7)) * (1 + 0.08 * Math.sin(t * 9 + r * 50)), y = hAt(x) + 0.0005, cur = [[x, y, -hw], [x, y, hw]];
      if (prev) pos.push(prev[0][0], prev[0][1], prev[0][2], prev[1][0], prev[1][1], prev[1][2], cur[0][0], cur[0][1], cur[0][2], prev[1][0], prev[1][1], prev[1][2], cur[1][0], cur[1][1], cur[1][2], cur[0][0], cur[0][1], cur[0][2]);
      prev = cur;
    }
    var bx = x0 + L + r * 0.02, by = hAt(bx) + 0.0008, rb = f.w0 * 0.62 * Math.min(1, 0.4 + L / (f.Lmax * 0.5));
    for (var q = 0; q < 14; q++) { var a0 = q / 14 * PI * 2, a1 = (q + 1) / 14 * PI * 2; pos.push(bx, by, 0, bx + Math.cos(a1) * rb * 1.2, by, Math.sin(a1) * rb, bx + Math.cos(a0) * rb * 1.2, by, Math.sin(a0) * rb); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    f.drip.geometry.dispose(); f.drip.geometry = g; f.len = L;
  }

  /* Poças no chão: contorno irregular por ruído, lóbulos que avançam para o lado mais baixo e param.
     oleo: centro preto espelhado, arco-íris só numa borda fina com matiz variando ao longo dela, nunca seca, gota que incha e faz coroa.
     diesel: como óleo, mais claro e lento, não pega fogo. gasolina: quase transparente, escurece o asfalto ~45%, ar tremendo, evapora pela borda em 60 s. */
  var DOWNHILL = new V3(-0.55, 0, 0.83).normalize(), PN = 72;
  function puddleGeo(withColor) {
    var g = new THREE.BufferGeometry(), pos = new Float32Array((PN + 1) * 3), nor = new Float32Array((PN + 1) * 3), idx = [];
    for (var i = 0; i <= PN; i++) nor[3 * i + 1] = 1;
    for (var k = 0; k < PN; k++) idx.push(0, 1 + (k + 1) % PN, 1 + k);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  }
  function rimGeo() {
    var g = new THREE.BufferGeometry(), pos = new Float32Array(PN * 2 * 3), col = new Float32Array(PN * 2 * 3), idx = [];
    for (var k = 0; k < PN; k++) { var a = 2 * k, b = 2 * k + 1, c2 = 2 * ((k + 1) % PN), d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setIndex(idx); return g;
  }
  function puddle(c, kind, pLocal, maxR) {
    var q = c.toFx(pLocal), oily = kind === "oleo" || kind === "diesel";
    var mat = kind === "oleo" ? new THREE.MeshStandardMaterial({ color: 0x050404, roughness: 0.04, metalness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
      : kind === "diesel" ? new THREE.MeshStandardMaterial({ color: 0x15110a, roughness: 0.06, metalness: 0.6, transparent: true, opacity: 0.9, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.03, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false });
    var m = new THREE.Mesh(puddleGeo(), mat); m.position.set(q.x, kind === "oleo" ? 0.013 : 0.016, q.z); m.receiveShadow = true; m.castShadow = false; m.raycast = function () {}; c.fx.add(m);
    var rnd = c.rand, lobes = [], nl = 5 + Math.floor(rnd() * 3), down = Math.atan2(DOWNHILL.z, DOWNHILL.x);
    for (var i = 0; i < nl; i++) {
      var a = i < 2 ? down + (rnd() - 0.5) * 0.9 : rnd() * PI * 2, dh = Math.max(0, Math.cos(a - down));
      lobes.push({ a: a, w: 0.22 + rnd() * 0.3, amp: (0.1 + rnd() * 0.16) * (1 + 1.1 * dh), stop: 0.35 + rnd() * 0.65 });
    }
    var f = { kind: kind, m: m, t: 0, max: maxR, x0: q.x, z0: q.z, lobes: lobes, nz: vnoise(Math.floor(rnd() * 999)), ph: rnd() * 10 };
    if (oily) {
      var rim = new THREE.Mesh(rimGeo(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: kind === "oleo" ? 0.55 : 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      rim.position.set(q.x, m.position.y + 0.002, q.z); rim.raycast = function () {}; c.fx.add(rim); f.rim = rim;
    }
    if (kind === "oleo") {
      var drop = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), PM.gota); drop.raycast = function () {}; c.fx.add(drop); f.drop = drop; f.dy0 = Math.max(0.15, q.y - 0.1);
      drop.position.set(q.x, f.dy0, q.z);
      var crown = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.7, 1, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0, side: DS, depthWrite: false }));
      crown.position.set(q.x, 0.02, q.z); crown.visible = false; crown.raycast = function () {}; c.fx.add(crown); f.crown = crown; f.phase = 0;
    } else if (kind === "gasolina") {
      var haze = new THREE.Mesh(puddleGeo(), new THREE.MeshBasicMaterial({ color: 0x9fb2be, transparent: true, opacity: 0.035, depthWrite: false, side: DS }));
      haze.position.set(q.x, 0.22, q.z); haze.raycast = function () {}; c.fx.add(haze); f.haze = haze;
    }
    f.R = new Float32Array(PN);
    shapePuddle(f);
    c.fluids.push(f); return f;
  }
  ZG.puddle = puddle;
  function shapePuddle(f) {
    var t = f.t, g, evap = 1;
    if (f.kind === "gasolina") { g = f.max * (1 - Math.exp(-f.t * 1.4)); }
    else if (f.kind === "diesel") g = f.max * Math.min(1, Math.sqrt(f.t / 70));
    else g = f.max * Math.min(1, Math.sqrt(f.t / 40));
    var grow = f.kind === "gasolina" ? clamp(t / 6, 0, 1) : clamp(t / (f.kind === "diesel" ? 90 : 60), 0, 1);
    var pos = f.m.geometry.attributes.position;
    for (var k = 0; k < PN; k++) {
      var a = k / PN * PI * 2, rr = 0.68 + 0.22 * f.nz(Math.cos(a) * 2.3 + f.ph, Math.sin(a) * 2.3 + f.ph) + 0.08 * f.nz(Math.cos(a) * 6 + 3, Math.sin(a) * 6 + 3);
      f.lobes.forEach(function (L) { var d = Math.atan2(Math.sin(a - L.a), Math.cos(a - L.a)) / L.w; rr += L.amp * Math.exp(-d * d) * Math.min(1, grow / L.stop); });
      if (f.kind === "gasolina" && t > 6) {
        /* evapora pela borda: cada trecho recua no seu ritmo, a poça some em 60 s */
        var e = clamp((t - 6) / 54, 0, 1); evap = clamp(1 - e * (0.75 + 0.5 * f.nz(Math.cos(a) * 3 + 9, Math.sin(a) * 3 + 9)) - e * e * 0.4, 0, 1);
        rr *= evap;
      }
      f.R[k] = g * rr; pos.setXYZ(k + 1, Math.cos(a) * f.R[k], 0, Math.sin(a) * f.R[k]);
    }
    pos.needsUpdate = true; f.m.geometry.computeBoundingSphere();
    if (f.haze) { var hp = f.haze.geometry.attributes.position; for (var j = 0; j < PN; j++) { var aa = j / PN * PI * 2, w = f.R[j] * (1 + 0.08 * Math.sin(t * 11 + j)); hp.setXYZ(j + 1, Math.cos(aa) * w, 0.03 * Math.sin(t * 9 + j * 0.7), Math.sin(aa) * w); } hp.needsUpdate = true; f.haze.geometry.computeBoundingSphere(); }
    if (f.rim) {
      var rp = f.rim.geometry.attributes.position, rc = f.rim.geometry.attributes.color, col = new THREE.Color();
      for (var q = 0; q < PN; q++) {
        var an = q / PN * PI * 2, R = f.R[q], band = Math.min(0.085, R * 0.16);
        rp.setXYZ(2 * q, Math.cos(an) * (R - band), 0, Math.sin(an) * (R - band)); rp.setXYZ(2 * q + 1, Math.cos(an) * (R + 0.004), 0, Math.sin(an) * (R + 0.004));
        col.setHSL((an / PI + f.nz(Math.cos(an) * 4, Math.sin(an) * 4) * 0.8 + t * 0.01) % 1, 0.8, f.kind === "oleo" ? 0.5 : 0.36);
        rc.setXYZ(2 * q, 0, 0, 0); rc.setXYZ(2 * q + 1, col.r, col.g, col.b);
      }
      rp.needsUpdate = true; rc.needsUpdate = true; f.rim.geometry.computeBoundingSphere();
    }
    return evap;
  }
  function updateFluids(c, dt) {
    for (var i = c.fluids.length - 1; i >= 0; i--) {
      var f = c.fluids[i]; f.t += dt;
      if (f.kind === "gasolina") {
        shapePuddle(f);
        f.m.material.opacity = 0.45 * (f.t > 50 ? Math.max(0, (60 - f.t) / 10) : 1);
        if (f.t > 60) { c.fx.remove(f.m); c.fx.remove(f.haze); f.m.geometry.dispose(); f.haze.geometry.dispose(); c.fluids.splice(i, 1); }
      } else if (f.kind === "oleo" || f.kind === "diesel") {
        if (f.t < 95 || (f.rimT = (f.rimT || 0) + dt) > 0.25) { f.rimT = 0; shapePuddle(f); }
        if (f.drop) {
          /* gota incha (0,9 s), solta, cai e faz coroa ao bater na poça */
          f.phase += dt; var fall = Math.sqrt(2 * Math.max(0.05, f.dy0 - 0.015) / 9.8), cyc = 0.9 + fall + 0.5, ph = f.phase % cyc;
          if (ph < 0.9) { var sw = 0.35 + 0.75 * ph / 0.9; f.drop.visible = true; f.drop.position.y = f.dy0 - 0.01 * sw; f.drop.scale.set(sw, sw * (1 + 0.5 * ph / 0.9), sw); f.splashed = false; }
          else if (ph < 0.9 + fall) { var tf = ph - 0.9; f.drop.position.y = f.dy0 - 0.5 * 9.8 * tf * tf; f.drop.scale.set(0.85, 1.5, 0.85); }
          else {
            f.drop.visible = false;
            if (!f.splashed) { f.splashed = true; f.crownT = 0; for (var s = 0; s < 6; s++) { var a = s / 6 * PI * 2 + c.rand(); ZG.spawn(c, "gota", new V3(f.x0 + Math.cos(a) * 0.02, 0.02, f.z0 + Math.sin(a) * 0.02), new V3(Math.cos(a) * 0.5, 0.9 + c.rand() * 0.4, Math.sin(a) * 0.5), { s: 0.5 + c.rand() * 0.4 }); } }
          }
          if (f.crownT != null) {
            f.crownT += dt; var ct = f.crownT / 0.3;
            if (ct < 1) { f.crown.visible = true; f.crown.scale.set(0.015 + 0.05 * ct, 0.03 * Math.sin(ct * PI), 0.015 + 0.05 * ct); f.crown.position.y = 0.015 + f.crown.scale.y / 2; f.crown.material.opacity = 0.9 * (1 - ct); }
            else { f.crown.visible = false; f.crownT = null; }
          }
        }
      } else if (f.def && f.def.update) {
        if (f.def.update(c, f, dt, i) === true) { c.fluids.splice(i, 1); }
      } else if (f.def) {
        var dry = Math.min(1, f.t / f.def.dryTime);
        f.mat.color.copy(f.def.freshC).lerp(f.def.dryC, dry); f.mat.roughness = f.def.roughFresh + dry * (f.def.roughDry - f.def.roughFresh); f.mat.metalness = f.def.metalFresh + (f.def.metalDry - f.def.metalFresh) * dry;
        var L = f.Lmax * (1 - Math.exp(-f.t / 5)); if (L - f.len > 0.004) buildDrip(f, L);
      }
    }
  }
  ZG.updateFluids = updateFluids;
  /* Limpador (só no vidro) e chuva limpam só a mancha fresca (menos da metade seca) dos tipos com wipeable. */
  ZG.wipe = function (c, mode) {
    var n = 0;
    for (var i = c.fluids.length - 1; i >= 0; i--) {
      var f = c.fluids[i]; if (!f.def || !f.def.wipeable) continue;
      if (f.t / f.def.dryTime < 0.5 && (mode === "chuva" || f.onGlass)) { f.grp.parent && f.grp.parent.remove(f.grp); c.fluids.splice(i, 1); n++; }
    }
    return n;
  };

  /* ================= vidros: trinca e estilhaço ================= */
  function glassUV(msh, pLocal) {
    var pos = msh.geometry.attributes.position, uv = msh.geometry.attributes.uv; if (!uv) return [0.5, 0.5];
    var inv = new THREE.Matrix4().copy(msh.matrix).invert(), q = pLocal.clone().applyMatrix4(inv), best = 1e9, bi = 0, v = new V3();
    for (var i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); var d = v.distanceToSquared(q); if (d < best) { best = d; bi = i; } }
    return [uv.getX(bi), uv.getY(bi)];
  }
  /* Teia de trinca: linhas grossas e opacas no centro, afinando para fora, com contorno escuro para ler de longe. */
  function drawWeb(x, cx, cy, s, ax, rnd) {
    var n = 16 + Math.floor(rnd() * 8), spokes = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * PI * 2 + (rnd() - 0.5) * 0.35, L = (70 + rnd() * 95) * s, pts = [[cx, cy]];
      for (var k = 1; k <= 6; k++) { var aa = a + (rnd() - 0.5) * 0.28, rr = L * k / 6; pts.push([cx + Math.cos(aa) * rr / ax, cy + Math.sin(aa) * rr]); }
      spokes.push(pts);
    }
    x.lineCap = "round"; x.lineJoin = "round";
    function seg(p, q, wd, col) { x.strokeStyle = col; x.lineWidth = wd; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); }
    [["rgba(8,12,14,0.55)", 2.2], ["rgba(244,248,250,0.97)", 0]].forEach(function (pass) {
      spokes.forEach(function (pts) { for (var k = 1; k < pts.length; k++) { var t = k / pts.length; seg(pts[k - 1], pts[k], Math.max(0.8, 4.2 * (1 - t) + 0.6) + pass[1], pass[0]); } });
      for (var r = 1; r <= 4; r++) {
        x.lineWidth = Math.max(0.8, 2.6 - r * 0.45) + pass[1] * 0.6; x.strokeStyle = pass[0]; x.beginPath();
        spokes.forEach(function (sp, j) { var p = sp[Math.min(r, sp.length - 1)], q = spokes[(j + 1) % spokes.length][Math.min(r, sp.length - 1)]; if (rnd() < 0.8) { x.moveTo(p[0], p[1]); x.quadraticCurveTo((p[0] + q[0]) / 2 + (rnd() - 0.5) * 6, (p[1] + q[1]) / 2 + (rnd() - 0.5) * 6, q[0], q[1]); } });
        x.stroke();
      }
    });
    var gr = x.createRadialGradient(cx, cy, 0, cx, cy, 26 * s); gr.addColorStop(0, "rgba(248,250,252,1)"); gr.addColorStop(0.45, "rgba(236,242,244,0.75)"); gr.addColorStop(1, "rgba(236,242,244,0)");
    x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, 26 * s, 0, PI * 2); x.fill();
  }
  function crackGlass(c, msh, p, force, sc) {
    var G = msh.userData.glass;
    if (!G.cv) {
      G.cv = document.createElement("canvas"); G.cv.width = G.cv.height = 256;
      var x0 = G.cv.getContext("2d"); x0.fillStyle = "rgba(48,66,72,0.5)"; x0.fillRect(0, 0, 256, 256);
      G.tex = new THREE.CanvasTexture(G.cv);
      msh.material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: G.tex, emissive: 0x6a7276, emissiveMap: G.tex, transparent: true, roughness: 0.25, metalness: 0.1, side: DS, depthWrite: false });
    }
    var uv = glassUV(msh, p), x = G.cv.getContext("2d");
    drawWeb(x, uv[0] * 256, (1 - uv[1]) * 256, sc != null ? sc : 0.6 + force * 0.5, Math.max(0.4, G.aspect || 1), c.rand);
    G.tex.needsUpdate = true; G.hits++;
  }
  /* borda irregular presa na moldura para vidro sem contorno (recortado da casca): fica só a faixa perto das bordas abertas */
  function glassRim(geo, rnd) {
    var src = geo.index ? geo.toNonIndexed() : geo, p = src.attributes.position, cnt = {}, E = [];
    function key(i) { return Math.round(p.getX(i) * 1000) + "," + Math.round(p.getY(i) * 1000) + "," + Math.round(p.getZ(i) * 1000); }
    for (var f = 0; f < p.count; f += 3) for (var k = 0; k < 3; k++) {
      var a = f + k, b = f + (k + 1) % 3, ka = key(a), kb = key(b), e = ka < kb ? ka + "|" + kb : kb + "|" + ka;
      if (!cnt[e]) cnt[e] = { n: 0, a: a, b: b }; cnt[e].n++;
    }
    Object.keys(cnt).forEach(function (e) { var q = cnt[e]; if (q.n === 1) E.push([new V3().fromBufferAttribute(p, q.a), new V3().fromBufferAttribute(p, q.b)]); });
    if (E.length < 3 || E.length > 900) return null;
    var nz = vnoise(Math.floor(rnd() * 999)), ab = new V3(), ap = new V3(), q2 = new V3();
    function dist(x, y, z) {
      var best = 1e9; q2.set(x, y, z);
      for (var i = 0; i < E.length; i++) { var A = E[i][0], B = E[i][1]; ab.subVectors(B, A); ap.subVectors(q2, A); var t = clamp(ap.dot(ab) / (ab.lengthSq() || 1), 0, 1); ap.addScaledVector(ab, -t); var d = ap.lengthSq(); if (d < best) best = d; }
      return Math.sqrt(best);
    }
    var sub = subdivide(src, 0.03);
    var r = cutGeo(sub, [{ sdf: function (x, y, z) { return 0.02 + 0.07 * nz(x * 9 + z * 5, y * 9 + z * 3) * nz(x * 23, y * 23 + z * 17) - dist(x, y, z); } }]);
    if (!r.geo.attributes.position.count) return null;
    return crease(r.geo, 60);
  }
  function shatterGlass(c, msh, force, dir) {
    var G = msh.userData.glass; if (G.broken) return; G.broken = true;
    var cubesAt = [];
    if (G.outline && G.T !== undefined) {
      var out = G.outline, cx = 0, cy = 0; out.forEach(function (p) { cx += p.x; cy += p.y; }); cx /= out.length; cy /= out.length;
      var shp = new THREE.Shape(out.map(function (p) { return new THREE.Vector2(p.x, p.y); })), hole = new THREE.Path();
      out.forEach(function (p, i) {
        var dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(d * 0.45, 0.025 + c.rand() * (i % 3 === 0 ? 0.11 : 0.05));
        var q = [p.x + dx / d * k, p.y + dy / d * k]; if (i === 0) hole.moveTo(q[0], q[1]); else hole.lineTo(q[0], q[1]);
      });
      shp.holes.push(hole);
      var geo = new THREE.ShapeGeometry(shp); geo.translate(0, 0, G.zpos + 0.004); tumble(geo, G.T); geo.computeVertexNormals();
      msh.geometry.dispose(); msh.geometry = geo; msh.material = MT.glassEdge;
      var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9; out.forEach(function (p) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); });
      for (var i = 0; i < 46; i++) { var x = minx + (maxx - minx) * (0.1 + c.rand() * 0.8), y = miny + (maxy - miny) * (0.1 + c.rand() * 0.8); cubesAt.push(new V3(x, y, G.side * halfAt(G.Wg, G.T, y))); }
    } else {
      msh.geometry.computeBoundingBox(); var bb = msh.geometry.boundingBox.clone().applyMatrix4(msh.matrix);
      var rim = glassRim(msh.geometry, c.rand);
      if (rim) { msh.geometry.dispose(); msh.geometry = rim; msh.material = MT.glassEdge; } else msh.visible = false;
      for (var j = 0; j < 36; j++) cubesAt.push(new V3(bb.min.x + (bb.max.x - bb.min.x) * c.rand(), bb.min.y + (bb.max.y - bb.min.y) * c.rand(), bb.min.z + (bb.max.z - bb.min.z) * c.rand()));
    }
    var seatGeo = [], d = dir.clone().normalize();
    cubesAt.forEach(function (p, i) {
      if (i % 3 === 0 && c.seatTops.length && !c.rollA && !c.flipped) {
        var best = null, bd = 1e9; c.seatTops.forEach(function (s) { var dd = Math.hypot(s.x - p.x, s.z - p.z); if (dd < bd) { bd = dd; best = s; } });
        if (best && bd < 1.6) { var g = new THREE.BoxGeometry(0.014, 0.014, 0.014); g.rotateY(c.rand() * 3); g.translate(best.x + (c.rand() - 0.5) * best.l * 0.8, best.y + 0.007, best.z + (c.rand() - 0.5) * best.w * 0.8); seatGeo.push(g); return; }
      }
      var v = d.clone().multiplyScalar(0.4 + force * c.rand() * 1.4).add(new V3((c.rand() - 0.5) * 0.8, c.rand() * 0.6, (c.rand() - 0.5) * 0.8));
      ZG.spawn(c, "cubo", c.toFx(p), c.dirFx(v));
    });
    if (seatGeo.length) { var sm = new THREE.Mesh(mergeGeos(seatGeo), PM.cubo); sm.castShadow = false; c.g.add(sm); }
  }
  function hitGlass(c, msh, p, dir, force) {
    var G = msh && msh.userData.glass; if (!G || G.broken) return;
    if (G.type === "laminado") {
      crackGlass(c, msh, p, force);
      burst(c, "caco", c.toFx(p), 4 + Math.round(force * 4), { dir: c.dirFx(dir.clone().negate()), speed: 1.2 });
    } else shatterGlass(c, msh, force, dir);
  }
  ZG.hitGlass = hitGlass;
  function breakLight(c, L, dir) {
    if (!L || L.broken) return; L.broken = true;
    L.lens.forEach(function (m) { m.visible = false; });
    L.inner.forEach(function (m) { m.material = MT.bulbBroken; });
    (L.halo || []).forEach(function (h) { h.visible = false; });
    var p = L.g ? L.g.position.clone() : (L.inner[0] ? L.inner[0].position.clone() : new V3());
    burst(c, "lente", c.toFx(p), 10, { dir: c.dirFx(dir.clone().negate()), speed: 1.4, variant: L.tint === "red" ? "red" : "clear" });
    burst(c, "plastico", c.toFx(p), 2, { dir: c.dirFx(dir.clone().negate()), speed: 1.0 });
  }
  ZG.breakLight = breakLight;

  /* ================= batida ================= */
  /* Campo de amassado: queda suave (smoothstep), ondulação de baixa frequência (≤ 0,015), nunca atravessa o plano central. */
  function dentField(v, H) {
    var d = v.distanceTo(H.p); if (d >= H.R) return 0;
    var t = 1 - d / H.R, f = t * t * (3 - 2 * t);
    var a = H.depth * f + 0.015 * f * Math.sin(v.x * 2.1 + v.z * 1.7 + H.ph) * Math.cos(v.y * 1.9);
    var lim = -((v.x - H.C.x) * H.dir.x + (v.y - H.C.y) * H.dir.y + (v.z - H.C.z) * H.dir.z) - 0.03;
    return Math.max(0, Math.min(a, lim));
  }
  /* Para-choque solta do lado da batida e fica pendurado pelo outro lado (não voa): a peça real gira em torno da ponta presa,
     sem trocar a geometria, e o ângulo é limitado para a ponta solta encostar no chão sem atravessar (e não virar poste em veículo alto). */
  function hangBumper(c, o, p) {
    if (!o || o.userData.hung || !o.parent || c.meta.noBumper) return; o.userData.hung = true;
    var di = c.deform.indexOf(o); if (di >= 0) c.deform.splice(di, 1);
    o.updateMatrix(); o.geometry.computeBoundingBox();
    var bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrix), wz = (bb.max.z - bb.min.z) * 0.97, hh = (bb.max.y - bb.min.y) / 2;
    if (wz < 0.2) return;
    var att = p.z >= (bb.min.z + bb.max.z) / 2 ? -1 : 1, par = o.parent, sx = o.position.x >= 0 ? 1 : -1, zc = (bb.min.z + bb.max.z) / 2;
    var piv = new THREE.Group(); piv.position.set(o.position.x, o.position.y, zc + att * wz / 2); par.add(piv); par.remove(o); piv.add(o);
    o.position.set(0, 0, o.position.z - piv.position.z); piv.userData.rigid = true; piv.userData.noFollow = true;
    var drop = Math.max(0.0, piv.position.y - hh - 0.01), th = Math.min(Math.asin(Math.min(0.98, drop / wz)), 0.42);
    piv.rotation.x = -att * th; piv.rotation.y = -0.1 * sx * att;
  }
  /* combustível do tanque atingido: rótulo da peça manda ("diesel"), senão a ficha do veículo */
  function tankFuel(c, pt) {
    var lb = (pt.n || "").toLowerCase(), fu = c.spec && c.spec.fuel;
    if (/diesel/.test(lb)) return "diesel";
    if (/gasolina|etanol|álcool|combust/.test(lb) && fu !== "diesel") return "gasolina";
    return fu === "diesel" ? "diesel" : (fu === "eletrico" || fu === "nenhum" ? null : "gasolina");
  }
  function hurtEngine(c, h) { c.engineHealth = Math.min(c.engineHealth == null ? 1 : c.engineHealth, h); }
  ZG.hurtEngine = hurtEngine;
  function igniteFuel(c, pd) {
    if (!pd || pd.kind !== "gasolina" || pd.fire) return; pd.fire = true;
    for (var k = 0; k < 3; k++) { var a = k / 3 * PI * 2 + c.rand(), r = pd.max * 0.35 * c.rand(); ZG.addEmitter(c, new V3(pd.x0 + Math.cos(a) * r, 0.05, pd.z0 + Math.sin(a) * r), "fogo", { world: true, rate: 9, s: 1.2 }); }
    burst(c, "faisca", new V3(pd.x0, 0.1, pd.z0), 14, { speed: 2.5 });
  }
  ZG.igniteFuel = igniteFuel;
  function applyPart(c, pt, force, dir, p) {
    var k = pt.kind, o = pt.obj, m = c.meta;
    if (pt.onHit) return pt.onHit(c, pt, force, dir, p);
    if (k === "farol" || k === "lanterna") breakLight(c, pt.light, dir);
    else if (k === "vidro") hitGlass(c, o, p, dir, force);
    else if (k === "roda") { if (o && !o.userData.flat) { o.userData.flat = true; o.scale.y = 0.74; o.position.y -= o.userData.r * 0.24; o.rotation.y += (hash(o.position.x, 1, 1) - 0.5) * 0.25; } }
    else if (k === "parachoque") { if (o && force > 0.6) hangBumper(c, o, p); }
    else if (k === "radiador") { ZG.addEmitter(c, pt.pos.clone().add(new V3(-0.1, 0.25, 0)), "branca"); hurtEngine(c, 0.6); }
    else if (k === "motor") {
      ZG.addEmitter(c, pt.pos.clone().add(new V3(0, 0.3, 0)), "preta"); hurtEngine(c, force > 1.1 ? 0.1 : 0.3);
      if (c.hood && force > 0.5 && !c.hood.noLatch) { c.hood.latch = Math.max(c.hood.latch, 0.15); }
      if (m.kind !== "boat" && m.kind !== "plane" && m.kind !== "heli") puddle(c, "oleo", pt.pos.clone().setY(Math.max(0.2, m.clear || 0.3)), 0.55 + force * 0.25);
    }
    else if (k === "capo") { if (c.hood && force > 0.4 && !c.hood.noLatch) c.hood.latch = Math.max(c.hood.latch, 0.15); }
    else if (k === "tanque") {
      var fu = tankFuel(c, pt);
      if (m.kind !== "boat" && fu) { var pd = puddle(c, fu, pt.pos, (fu === "diesel" ? 1.0 : 0.9) + force * 0.7); if (fu === "gasolina" && force >= 1.0) igniteFuel(c, pd); }
      if (fu === "gasolina" && force >= 1.0) ZG.blastDamage(c, force * 180);
    }
    else if (k === "bateria") { ZG.addEmitter(c, pt.pos.clone().add(new V3(0, 0.15, 0)), "fogo"); ZG.addEmitter(c, pt.pos.clone().add(new V3(0, 0.7, 0)), "preta", { rate: 3 }); }
    else if (k === "casco") { c.sunk = Math.max((c.sunk || 0) - 0.3 * force, -(m.belt || 0.5) * 0.45); c.g.rotation.x += 0.06 * force; burst(c, "agua", c.toFx(p).setY(0.05), 20, { speed: 2.5 }); }
    else if (k === "blindagem") { burst(c, "faisca", c.toFx(p), 18, { dir: c.dirFx(dir.clone().negate()), speed: 3.5, spread: 1.5 }); }
    else if (k === "popa") { if (o) { o.rotation.z = 0.5; o.position.y -= 0.1; } }
    else if (k === "helice" || k === "rotor" || k === "rotorcauda") { if (o) { o.children.forEach(function (ch, i) { if (ch.type === "Group") { ch.rotation.z += -0.15 - hash(i, 1, 1) * 0.25; ch.rotation.x += (i % 2 ? 0.2 : -0.2); } }); c.spin = c.spin.filter(function (s) { return s.o !== o; }); } }
    else if (k === "trem") { c.g.rotation.x += (m.kind === "plane" ? 0.2 : 0.13) * (pt.pos.z < 0 ? -1 : 1); c.g.position.y -= 0.12; }
  }
  ZG.applyPart = applyPart;
  var SCRATCH = CM("#9da3a6", { metalness: 0.85, roughness: 0.35 }), SOOT = CM("#141312", { roughness: 1, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  function markDecal(o) { o.traverse(function (x) { x.userData.decal = true; }); }
  var _ray = new THREE.Raycaster();
  function findSurface(c, p, dir) {
    c.root.updateMatrixWorld(true);
    var Mw = c.g.matrixWorld, o = p.clone().addScaledVector(dir, -1.2).applyMatrix4(Mw), d = dir.clone().transformDirection(Mw);
    _ray.set(o, d); _ray.far = 1.2 + 0.45;
    var hits = _ray.intersectObject(c.g, true);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], ob = h.object, vis = true;
      for (var q = ob; q && q !== c.g; q = q.parent) if (!q.visible) { vis = false; break; }
      if (!vis || ob.userData.decal || ob.userData.ghost || !h.face) continue;
      var inv = new THREE.Matrix4().copy(Mw).invert(), lp = h.point.clone().applyMatrix4(inv);
      var n = h.face.normal.clone().transformDirection(ob.matrixWorld).transformDirection(inv);
      if (n.dot(dir) > 0) n.negate();
      return { p: lp, n: n, obj: ob };
    }
    return null;
  }
  function scratches(c, p, dir, force) {
    var d = dir.clone().normalize(), t1 = new V3().crossVectors(d, Math.abs(d.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0)).normalize(), t2 = new V3().crossVectors(d, t1);
    var q = new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), t1), n = 3 + Math.round(force * 3);
    for (var i = 0; i < n; i++) {
      var a = hash(p.x * 7 + i, p.y * 5, p.z * 3) - 0.5, b = hash(i, p.x * 3, p.z * 7) - 0.5, len = 0.22 + force * 0.3 * hash(i, 9, p.y);
      var m = c.add(new THREE.BoxGeometry(len, 0.01, 0.005), SCRATCH, 0, 0, 0); m.castShadow = false; m.userData.decal = true;
      m.position.copy(p).addScaledVector(t1, a * 0.5).addScaledVector(t2, b * 0.35).addScaledVector(d, -0.008);
      m.quaternion.copy(q); m.rotation.z += (a - b) * 0.25;
    }
    var sr = 0.12 + force * 0.1, ss = new THREE.Shape(), nzs = vnoise(Math.floor(hash(p.x, p.y, p.z) * 997));
    for (var k = 0; k <= 20; k++) { var an = k / 20 * PI * 2, rr = sr * (0.6 + 0.6 * nzs(Math.cos(an) * 2 + 5, Math.sin(an) * 2 + 5)); ss[k ? "lineTo" : "moveTo"](Math.cos(an) * rr * 1.3, Math.sin(an) * rr); }
    var soot = c.add(new THREE.ShapeGeometry(ss), SOOT, 0, 0, 0); soot.castShadow = false; soot.userData.decal = true;
    soot.position.copy(p).addScaledVector(d, -0.005); soot.lookAt(soot.position.clone().sub(d));
  }
  /* Batida no ponto p (coordenadas de c.g), direção dir (para dentro do veículo), força 0,3..1,4. Devolve as peças atingidas. */
  function impact(c, p, dir, force, opts) {
    opts = opts || {};
    dir = dir.clone().normalize();
    var m = c.meta, air = m.kind === "plane" || m.kind === "heli";
    var Wref = air ? (m.fusW || 1.3) : (m.W || 1.7), R0 = (0.55 + 0.45 * force) * (air ? 1.25 : 1);
    /* profundidade: até 18% da largura, nunca mais que 0,3 m nem que 35% do raio do amassado; meta.stiff (0..1) endurece a blindagem */
    var maxD = Math.min(0.18 * Wref, 0.26, R0 * 0.32, opts.maxDepth || 9) * (1 - 0.85 * clamp(m.stiff || 0, 0, 1));
    var H = { p: p, dir: dir, R: R0, depth: Math.min(maxD, (0.04 + 0.15 * force) * (1 - 0.85 * clamp(m.stiff || 0, 0, 1))), ph: hash(p.x, p.y, p.z) * 6,
      C: new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clear || 0.3) + (m.bodyH || 0.6) * 0.5, 0) };
    c.root.updateMatrixWorld(true);
    var gInv = new THREE.Matrix4().copy(c.g.matrixWorld).invert(), rel = new THREE.Matrix4(), irel = new THREE.Matrix4(), v = new V3(), v0 = new V3(), w = new V3(), sc = new V3();
    var cab = m.cabin && !c.flipped && !c.rollA ? m.cabin : null;
    c.deform.forEach(function (msh) {
      if (!msh.parent || !msh.visible) return;
      rel.multiplyMatrices(gInv, msh.matrixWorld);
      var g = msh.geometry, pos = g.attributes.position, changed = false;
      if (!g.boundingSphere) g.computeBoundingSphere();
      sc.setFromMatrixScale(rel); v.copy(g.boundingSphere.center).applyMatrix4(rel);
      if (v.distanceTo(p) > H.R + g.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z)) return;
      irel.copy(rel).invert();
      if (!g.userData.p0) g.userData.p0 = new Float32Array(pos.array);
      var p0 = g.userData.p0;
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(rel);
        var a = dentField(v, H); if (a <= 0) continue;
        v.addScaledVector(dir, a);
        v0.set(p0[3 * i], p0[3 * i + 1], p0[3 * i + 2]).applyMatrix4(rel);
        w.subVectors(v, v0); if (w.length() > maxD) v.copy(v0).add(w.setLength(maxD));
        /* a lataria não entra no habitáculo: para na face externa do forro (meta.cabin) */
        if (cab && v0.x > cab.x0 && v0.x < cab.x1 && v0.y > cab.y0 && v0.y < cab.y1 && Math.abs(v0.z) >= cab.z && Math.abs(v.z) < cab.z) v.z = (v0.z > 0 ? 1 : -1) * cab.z;
        v.applyMatrix4(irel); pos.setXYZ(i, v.x, v.y, v.z); changed = true;
      }
      if (changed) { pos.needsUpdate = true; if (g.userData.crease) crease(g, 42); else g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); }
    });
    var dset = new Set(c.deform), box = new THREE.Box3();
    c.g.children.forEach(function (o) {
      if (dset.has(o) || o.userData.noFollow) return;
      if (!(o.isMesh || (o.isGroup && o.userData.rigid))) return;
      if (!o.userData.c0) {
        if (o.isMesh) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); o.userData.c0 = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrix); if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); o.userData.bb0 = o.geometry.boundingBox.clone().applyMatrix4(o.matrix); }
        else { box.setFromObject(o); box.applyMatrix4(gInv); o.userData.c0 = box.getCenter(new V3()); o.userData.bb0 = box.clone(); }
        o.userData.pos0 = o.position.clone();
      }
      var sh = new V3().subVectors(o.position, o.userData.pos0), cen = o.userData.c0.clone().add(sh), bb0 = o.userData.bb0;
      /* painel fino na direção da batida (forro de porta, friso, placa): segue o amassado pelo ponto mais perto da batida, para não ficar para fora da lataria */
      if (bb0) { var ext = new V3().subVectors(bb0.max, bb0.min); if (Math.abs(ext.x * dir.x) + Math.abs(ext.y * dir.y) + Math.abs(ext.z * dir.z) < 0.1) { var bq = bb0.clone().translate(sh); cen = bq.clampPoint(p, new V3()); } }
      var a = dentField(cen, H); if (a <= 0) return;
      o.position.addScaledVector(dir, a);
      w.subVectors(o.position, o.userData.pos0); if (w.length() > maxD) o.position.copy(o.userData.pos0).add(w.setLength(maxD));
    });
    var hit = [];
    c.parts.forEach(function (pt) {
      if (pt.done) return;
      if (pt.pos.distanceTo(p) < H.R * pt.reach + 0.1) { pt.done = true; applyPart(c, pt, force, dir, p); hit.push(pt); }
    });
    var pf = c.toFx(p), df = c.dirFx(dir.clone().negate());
    if (!opts.noFx) {
      if (m.kind === "boat" && p.y < (m.belt || 0.5)) burst(c, "agua", pf.clone().setY(Math.max(0.05, pf.y)), 18, { dir: df, speed: 2.2 });
      else burst(c, "faisca", pf, Math.round(8 + force * 16), { dir: df, speed: 2.5 + force * 2, spread: 1.4, jitter: 0.05 });
      if (force > 0.6) {
        burst(c, "lata", pf, Math.round(force * 5), { dir: df, speed: 1.4, mat: CM(paintCol(m.col || "#777", c.st), { roughness: 0.5, metalness: 0.3, side: DS }) });
        burst(c, "plastico", pf, 2, { dir: df, speed: 1.2 });
      }
    }
    /* mancha (config.impactStain) e riscos só onde existe lataria (bicicleta e moto são vazadas) */
    var surf = findSurface(c, p, dir);
    if (surf) {
      if (ZG.config.impactStain && !opts.noStain && force > 0.45 && !air && m.kind !== "boat") {
        var sp = surf.p.clone().addScaledVector(surf.n, 0.002);
        markDecal(ZG.splat(c, sp, surf.n, 0.08 + force * 0.04, { fluid: ZG.config.impactStain, obj: surf.obj, glass: !!(surf.obj && surf.obj.userData.glass) }).grp);
      }
      scratches(c, surf.p, surf.n.clone().negate(), force);
    }
    hit.forEach(function (pt) { c.log.push(pt); });
    return hit;
  }
  ZG.impact = impact;
  /* Texto de efeito por tipo de peça (relatório de batida). Vazio no SDK; o plugin do jogo preenche (configure({partFx})). */
  ZG.FX = {};
  /* raio em coordenadas de c.g contra as malhas visíveis do veículo (sem decalques); devolve o primeiro ponto */
  var _pr = new THREE.Raycaster();
  function probe(c, o, d, far) {
    c.root.updateMatrixWorld(true);
    var Mw = c.g.matrixWorld, inv = new THREE.Matrix4().copy(Mw).invert();
    _pr.set(o.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw)); _pr.far = far || 10;
    var hits = _pr.intersectObject(c.g, true);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], ob = h.object, ok = !!h.face;
      for (var q = ob; ok && q && q !== c.g; q = q.parent) if (!q.visible || q.userData.decal || q.userData.ghost) ok = false;
      if (ok) return { p: h.point.clone().applyMatrix4(inv), obj: ob };
    }
    return null;
  }
  ZG.probe = probe;
  function zoneImpact(c, zone, force) {
    var m = c.meta, mid = m.clear + (m.bodyH || 0.6) * 0.5, p, dir, land = m.kind !== "plane" && m.kind !== "heli" && m.kind !== "boat";
    if (zone === "capotado") { ZG.roll(c, 1); return []; }
    if (zone === "frente") { p = new V3(m.front, mid, m.W * 0.15); dir = new V3(-1, 0, 0); }
    else if (zone === "traseira") { p = new V3(m.rear, mid, -m.W * 0.15); dir = new V3(1, 0, 0); }
    else if (zone === "esquerda") { p = new V3((m.front + m.rear) * 0.5 + m.L * 0.12, mid + 0.1, -m.W / 2); dir = new V3(0, 0, 1); }
    else { p = new V3((m.front + m.rear) * 0.5 - m.L * 0.1, mid + 0.1, m.W / 2); dir = new V3(0, 0, -1); }
    if (m.kind === "plane" && (zone === "esquerda" || zone === "direita")) { p.set(0.2, m.top - 0.1, (zone === "esquerda" ? -1 : 1) * 4.2); dir.set(0, -0.6, 0); }
    if ((m.kind === "plane" || m.kind === "heli") && (zone === "esquerda" || zone === "direita") && m.fusW) { if (m.kind === "heli") p.z = (zone === "esquerda" ? -1 : 1) * m.fusW / 2; }
    if (m.kind === "boat" && (zone === "esquerda" || zone === "direita")) p.y = m.belt - 0.2;
    if (land && (zone === "esquerda" || zone === "direita") && !m.zoneFixed) {
      /* altura pela carroceria real: ônibus e caminhão miram entre a cintura e o teto (janelas); os demais, no meio da lateral.
         Testa várias alturas e fica com a primeira que encontra lataria do lado de fora. */
      var sd = zone === "esquerda" ? -1 : 1, tall = m.kind === "bus" || m.kind === "truck" || (m.belt > 1.5 && m.top - m.belt > 0.9);
      var yPref = tall ? m.belt + (m.top - m.belt) * 0.3 : mid + 0.1, ys = [];
      for (var y = Math.max(0.12, m.clear * 0.6); y < m.top - 0.04; y += 0.07) ys.push(y);
      ys.sort(function (a, b) { return Math.abs(a - yPref) - Math.abs(b - yPref); });
      for (var k = 0; k < ys.length; k++) {
        var h = probe(c, new V3(p.x, ys[k], sd * (m.W / 2 + 3)), new V3(0, 0, -sd), 3 + m.W * 0.45);
        if (h && Math.abs(h.p.z) > m.W * 0.22 && !(h.obj.parent && h.obj.parent.userData.r && c.wheels.indexOf(h.obj.parent) >= 0)) { p = h.p; break; }
      }
    }
    var hit = impact(c, p, dir, force);
    if (zone === "frente" && force > 0.7 && land) {
      /* batida forte de frente trinca o para-brisa a partir da base (o corpo bate no vidro) */
      var ws = c.parts.find(function (pt) { return pt.kind === "vidro" && !pt.done && /para-brisa/i.test(pt.n) && pt.obj && pt.obj.userData.glass && pt.obj.userData.glass.type === "laminado"; });
      if (ws) {
        var g = ws.obj; g.geometry.computeBoundingBox(); var bb = g.geometry.boundingBox.clone().applyMatrix4(g.matrix);
        var pb = new V3(bb.max.x - (bb.max.x - bb.min.x) * 0.25, bb.min.y + (bb.max.y - bb.min.y) * 0.28, (bb.min.z + bb.max.z) / 2 + (bb.max.z - bb.min.z) * 0.18);
        ws.done = true; hitGlass(c, g, pb, new V3(-1, -0.2, 0), force * 0.9); hit.push(ws); c.log.push(ws);
      }
    }
    return hit;
  }
  ZG.zoneImpact = zoneImpact;

  /* ================= capotagem ================= */
  /* Rola o veículo de lado em torno do eixo longitudinal (x). s = +1 cai para a direita, -1 para a esquerda.
     O apoio vem da forma real: casca convexa (y, z) de todas as malhas visíveis (menos decalques, partículas e hastes finas),
     mais meta.rollRest [[y, z]...] e meta.rollTop se declarados. O ponto de contato fica parado no chão enquanto o veículo gira. */
  function rollMeshes(c) {
    var list = [], thin = [];
    c.root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(c.g.matrixWorld).invert();
    c.g.traverse(function (ob) {
      if (!ob.isMesh || !ob.geometry || !ob.geometry.attributes.position) return;
      for (var q = ob; q && q !== c.g; q = q.parent) if (!q.visible || q.userData.decal || q.userData.ghost) return;
      var M = new THREE.Matrix4().multiplyMatrices(inv, ob.matrixWorld);
      if (!ob.geometry.boundingBox) ob.geometry.computeBoundingBox();
      var sz = ob.geometry.boundingBox.getSize(new V3()), sc = new V3().setFromMatrixScale(M), d = [sz.x * sc.x, sz.y * sc.y, sz.z * sc.z].sort(function (a, b) { return a - b; });
      if (ob.userData.antena || (d[1] < 0.045 && d[2] > 0.2)) { thin.push({ o: ob, M: M }); return; }
      list.push({ o: ob, M: M });
    });
    return { list: list, thin: thin };
  }
  function hull2(pts) {
    pts.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
    function cr(o, a, b) { return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]); }
    var lo = [], up = [];
    pts.forEach(function (p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    for (var i = pts.length - 1; i >= 0; i--) { var p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  ZG.roll = function (c, s) {
    if (c.rollA || c.flipped) return false;
    s = s || 1; var m = c.meta, bike = m.kind === "bike";
    var R = rollMeshes(c), pts = [], v = new V3(), yc = 0, zc = 0, n = 0;
    R.list.forEach(function (e) {
      var pos = e.o.geometry.attributes.position, st = Math.max(1, Math.floor(pos.count / 600));
      for (var i = 0; i < pos.count; i += st) { v.fromBufferAttribute(pos, i).applyMatrix4(e.M); pts.push([v.y, v.z]); yc += v.y; zc += v.z; n++; }
    });
    (m.rollRest || []).forEach(function (q) { pts.push([q[0], q[1]]); });
    if (m.rollTop) [-1, 1].forEach(function (k) { pts.push([m.rollTop, k * m.W * 0.3]); });
    if (pts.length < 3) pts = [[0, -m.W / 2], [0, m.W / 2], [m.top, m.W / 2], [m.top, -m.W / 2]];
    var S = hull2(pts);
    c.rollA = { t: 0, dur: bike ? 0.9 : (m.kind === "bus" || m.kind === "truck" ? 2.0 : 1.6), s: s, S: S, last: -1, cz: c.g.position.z, target: bike ? PI / 2 : PI, x: ((m.front || 1) + (m.rear || -1)) / 2, L: m.L || 2, bounce: 0,
      cen: [n ? yc / n : m.top / 2, n ? zc / n : 0], hitAt: null, hits: 0, thin: R.thin, y0: c.g.position.y };
    if (c.hood) c.hood.target = 0;
    return true;
  };
  function rollContact(c, A, q) {
    var m = c.meta, list = [], dy = A.cen[0] - q[0], dz = A.cen[1] - q[1], dl = Math.hypot(dy, dz) || 1;
    var dir = new V3(0, dy / dl, dz / dl), f = 0.75, bike = m.kind === "bike";
    (bike ? [0] : [-0.28, 0, 0.28]).forEach(function (k) { list.push([new V3(A.x + k * A.L, q[0], q[1]), dir]); });
    /* deitado de lado: a faixa das janelas também encosta */
    if (!bike && Math.abs(dir.z) > 0.75 && m.top - m.belt > 0.25 && A.hits < 3) {
      var sd = -Math.sign(dir.z), yw = m.belt + (m.top - m.belt) * 0.45;
      [-0.25, 0.2].forEach(function (k) { var h = probe(c, new V3(A.x + k * A.L, yw, sd * (m.W / 2 + 2)), new V3(0, 0, -sd), 2 + m.W); if (h) list.push([h.p, new V3(0, 0, -sd)]); });
    }
    list.forEach(function (e) {
      impact(c, e[0], e[1], f, { noStain: true, maxDepth: 0.1 });
      var pf = c.toFx(e[0]); pf.y = Math.max(0.03, pf.y);
      burst(c, "poeira", pf.clone().setY(0.1), 4, { speed: 0.9, spread: 2.2, jitter: 0.4, s: 1.2 });
      burst(c, "faisca", pf, 14, { speed: 3, spread: 1.6 });
      burst(c, "caco", pf, 4, { speed: 1.5 });
    });
    A.hits++; A.bounce = A.hits === 1 ? 0.06 : 0.1;
    if (m.kind === "boat") burst(c, "agua", c.toFx(list[0][0]).setY(0.05), 30, { speed: 3 });
  }
  /* menor y (no referencial de c.root) de todas as malhas de apoio, vértice a vértice */
  function exactMinY(c, list) {
    c.root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert(), M = new THREE.Matrix4(), v = new V3(), mn = 1e9;
    list.forEach(function (e) {
      var ob = e.o; if (!ob.parent || !shown(c, ob)) return;
      M.multiplyMatrices(inv, ob.matrixWorld); var pos = ob.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); if (v.y < mn) mn = v.y; }
    });
    return mn;
  }
  function finishRoll(c) {
    var A = c.rollA, m = c.meta; c.rollA = null; c.flipped = true;
    c.g.rotation.x = A.s * A.target;
    if (A.hits < 2 && m.kind !== "bike") { var cs = Math.cos(c.g.rotation.x), sn = Math.sin(c.g.rotation.x), best = null, by = 1e9; A.S.forEach(function (q) { var y = q[0] * cs - q[1] * sn; if (y < by) { by = y; best = q; } }); if (best) rollContact(c, A, best); }
    /* assenta pelo ponto mais baixo real (o teto amassado e as peças rígidas contam) */
    var R = rollMeshes(c), mn = exactMinY(c, R.list);
    if (mn < 1e8) c.g.position.y -= mn;
    /* hastes finas (antenas, varetas) que atravessariam o chão quebram e soltam pedaços */
    c.root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert();
    R.thin.forEach(function (e) {
      var ob = e.o, bb = new THREE.Box3().setFromObject(ob).applyMatrix4(inv);
      if (bb.min.y < -0.01 && ob.parent) { var pf = bb.getCenter(new V3()); pf.y = Math.max(0.05, pf.y); ob.visible = false; burst(c, "plastico", pf, 3, { speed: 1.2 }); burst(c, "faisca", pf, 5, { speed: 2 }); }
    });
    /* helicóptero de cabeça para baixo: as pás que atravessariam o chão quebram e viram pedaços */
    if (m.kind === "heli") c.parts.forEach(function (p) {
      if ((p.kind !== "rotor" && p.kind !== "rotorcauda") || !p.obj) return;
      var main = p.kind === "rotor";
      p.obj.traverse(function (o) {
        if (!o.isMesh || !o.visible) return;
        var bb = new THREE.Box3().setFromObject(o).applyMatrix4(inv); if (!main && bb.min.y >= -0.01) return;
        var pf = bb.getCenter(new V3()); pf.y = Math.max(0.05, Math.min(pf.y, 0.4)); o.visible = false;
        burst(c, "lata", pf, 3, { speed: 1.4, mat: o.material && !Array.isArray(o.material) ? o.material : MT.trim }); burst(c, "faisca", pf, 6, { speed: 2.2 }); burst(c, "poeira", pf.clone().setY(0.1), 2, { speed: 0.8, s: 1.1 });
      });
      c.spin = c.spin.filter(function (sp) { return sp.o !== p.obj; });
    });
    if (m.kind === "heli") { var mn2 = exactMinY(c, R.list); if (mn2 < 1e8 && Math.abs(mn2) > 0.005) c.g.position.y -= mn2; }
    if (m.kind === "boat") { c.g.position.y -= 0.45; c.sunk = c.g.position.y; }
    c.wheels.forEach(function (w, i) { c.spin.push({ o: w, axis: "z", v: 2.2 + hash(i, 2, 3) * 2, decay: 0.12 }); });
    var mot = c.parts.find(function (p) { return p.kind === "motor"; });
    if (mot && m.kind !== "boat") ZG.addEmitter(c, mot.pos.clone().add(new V3(0, -0.3, 0)), "preta", { rate: 4 });
  }
  function tickRoll(c, dt) {
    var A = c.rollA; A.t += dt; var p = Math.min(1, A.t / A.dur);
    var e = p * p * (3 - 2 * p), phi = A.s * A.target * e, cs = Math.cos(phi), sn = Math.sin(phi), minY = 1e9, idx = 0;
    A.S.forEach(function (q, i) { var y = q[0] * cs - q[1] * sn; if (y < minY - 1e-6) { minY = y; idx = i; } });
    var q = A.S[idx], zi = q[0] * sn + q[1] * cs;
    if (idx !== A.last) {
      if (A.last < 0) A.cz = c.g.position.z + zi;
      else { var pq = A.S[A.last]; A.cz += zi - (pq[0] * sn + pq[1] * cs); }
      A.last = idx;
      if (A.t > 0.15 && (!A.hitAt || Math.hypot(q[0] - A.hitAt[0], q[1] - A.hitAt[1]) > 0.35)) { A.hitAt = q; c.g.rotation.x = phi; c.g.position.y = -minY; c.g.position.z = A.cz - zi; rollContact(c, A, q); }
    }
    A.bounce = Math.max(0, A.bounce - dt * 0.5);
    c.g.rotation.x = phi;
    c.g.position.y = -minY + Math.sin(Math.min(1, A.bounce / 0.1) * PI) * A.bounce * 0.6;
    c.g.position.z = A.cz - zi;
    if (p >= 1) finishRoll(c);
  }
  ZG.rollContact = rollContact;

  /* ================= explosão ================= */
  /* Cadeia: o motor pega fogo com fumaça preta (3 a 8 s), o veículo pula ~1,5 m, capô, portas, porta-malas e uma roda voam com rastro de fogo,
     os vidros estouram em cacos e sobra a carcaça queimada com fogo baixo. Dano de explosão no tanque: > 200 incêndio, > 400 explode em 0,6 s.
     O caminhão-tanque (meta.bigBoom) faz a explosão de tanque de posto: raio letal 12 m, ferimento 30 m, cogumelo de 16 m. */
  var BURNT = ["#1d1a17", "#26211c", "#171514", "#2e2620"].map(function (h, i) { return CM(h, { roughness: 1, metalness: i === 3 ? 0.35 : 0.15 }); });
  var BURNT_RUB = CM("#0b0b0b", { roughness: 1 });
  function boomMat(hex, op, add) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: op, depthWrite: false, side: DS, fog: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }); }
  function enginePos(c) {
    var mot = c.parts.find(function (p) { return p.kind === "motor"; }); if (mot) return mot.pos.clone();
    var m = c.meta; return new V3(m.front - 0.6, (m.clear || 0.3) + 0.3, 0);
  }
  ZG.explode = function (c, o) {
    o = o || {};
    if (c.boom || c.exploded) return false;
    var fuse = o.now ? 0 : (o.delay != null ? o.delay : 3 + c.rand() * 5);
    c.boom = { phase: "fogo", t: 0, T: fuse };
    if (fuse > 0) { var ep = enginePos(c); ZG.addEmitter(c, ep.clone().add(new V3(0, 0.25, 0)), "fogo", { rate: 10, s: 0.9 }); ZG.addEmitter(c, ep.clone().add(new V3(0, 0.6, 0)), "preta", { rate: 6, s: 1.2 }); hurtEngine(c, 0.1); }
    if (c.hood) c.hood.target = 0;
    return fuse;
  };
  /* dano de explosão no tanque (soma). Devolve "incendio", "explosao" ou null */
  ZG.blastDamage = function (c, amount) {
    c.tankDmg = (c.tankDmg || 0) + amount;
    if (c.tankDmg > 400 && !c.exploded && (!c.boom || c.boom.phase === "fogo")) { c.boom = { phase: "fogo", t: 0, T: 0.6 }; return "explosao"; }
    if (c.tankDmg > 200 && !c.tankFire) {
      c.tankFire = true; var tk = c.parts.find(function (p) { return p.kind === "tanque"; }), tp = tk ? tk.pos.clone() : enginePos(c);
      ZG.addEmitter(c, tp.clone().setY(Math.max(0.15, tp.y)), "fogo", { rate: 12, s: 1.1 }); ZG.addEmitter(c, tp.clone().setY(tp.y + 0.8), "preta", { rate: 5, s: 1.4 });
      return "incendio";
    }
    return null;
  };
  function fling(c, obj, v, w) {
    if (!obj || !obj.parent) return null;
    c.root.updateMatrixWorld(true);
    var bb = new THREE.Box3().setFromObject(obj); if (bb.isEmpty()) return null;
    var cen = bb.getCenter(new V3()), holder = new THREE.Group(); c.root.worldToLocal(cen); holder.position.copy(cen); c.fx.add(holder); c.fx.updateMatrixWorld(true);
    holder.attach(obj);
    var sz = bb.getSize(new V3()), piece = { o: holder, v: v, w: w, r: Math.max(0.08, Math.min(sz.x, sz.y, sz.z) * 0.5 + 0.02), landed: false, trail: 2.2 };
    c.flying = c.flying || []; c.flying.push(piece);
    obj.traverse(function (x) { x.userData.noFollow = true; });
    var di = c.deform.indexOf(obj); if (di >= 0) c.deform.splice(di, 1);
    return piece;
  }
  function burnAll(c) {
    var i = 0;
    c.g.traverse(function (o) {
      if (o.isSprite) { o.visible = false; return; }
      if (!o.isMesh || o.userData.decal) return;
      var mt = o.material; if (!mt || Array.isArray(mt)) return;
      if (mt === MT.rubber) { o.material = BURNT_RUB; return; }
      if (mt.transparent && mt.opacity < 0.7) { if (!o.userData.glass) o.visible = false; return; }
      o.material = BURNT[(i++) % BURNT.length];
    });
    c.lights.forEach(function (L) { L.broken = true; L.lens.forEach(function (m) { m.visible = false; }); (L.halo || []).forEach(function (h) { h.visible = false; }); });
  }
  function bigBoomFx(c) {
    var g = new THREE.Group(); c.fx.add(g); c.bigFx = { g: g, t: 0, rings: [], col: [] };
    [[12, "#d8322a", "Raio letal 12 m"], [30, "#e0a548", "Ferimentos até 30 m"]].forEach(function (r) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(r[0] - 0.25, r[0], 96), boomMat(r[1], 0.85)); ring.rotation.x = -PI / 2; ring.position.y = 0.06; ring.renderOrder = 5; g.add(ring);
      var fill = new THREE.Mesh(new THREE.CircleGeometry(r[0], 96), boomMat(r[1], 0.07)); fill.rotation.x = -PI / 2; fill.position.y = 0.05; g.add(fill);
      var lb = new THREE.Mesh(new THREE.PlaneGeometry(r[0] * 0.45, r[0] * 0.08), new THREE.MeshBasicMaterial({ map: textTex(r[2], { w: 1024, h: 160, fg: r[1], size: 0.62 }), transparent: true, depthWrite: false, fog: false }));
      lb.rotation.x = -PI / 2; lb.position.set(0, 0.08, r[0] + r[0] * 0.06); g.add(lb);
      c.bigFx.rings.push(ring, fill, lb);
    });
  }
  function detonate(c) {
    var m = c.meta, B = c.boom, ep = enginePos(c), cen = c.toFx(new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clear || 0.3) + (m.bodyH || 0.6) * 0.5, 0)), big = !!m.bigBoom;
    B.phase = "voo"; B.t = 0; B.vy = Math.sqrt(2 * 9.8 * (big ? 1.0 : 1.5)); B.y0 = c.g.position.y; B.rx = (c.rand() - 0.5) * 0.5; B.rz = (c.rand() - 0.5) * 0.35;
    c.exploded = true; c.engineHealth = 0; c.emit = c.emit.filter(function (e) { return e.kind !== "escape"; });
    /* clarão, bola de fogo, fumaça, onda no chão */
    var fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); fl.raycast = function () {}; fl.position.copy(cen); fl.scale.setScalar(0.1); c.fx.add(fl); B.flash = fl;
    var sw = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), boomMat("#ffcf8a", 0.6, true)); sw.rotation.x = -PI / 2; sw.position.set(cen.x, 0.07, cen.z); c.fx.add(sw); B.shock = sw;
    var k = big ? 1.8 : 1;
    for (var i = 0; i < (big ? 70 : 46); i++) { var d = new V3(c.rand() - 0.5, c.rand() * 0.9, c.rand() - 0.5).normalize(); ZG.spawn(c, "fogo", cen.clone().addScaledVector(d, 0.3), d.multiplyScalar((2.5 + c.rand() * 4) * k), { s: (1.0 + c.rand() * 1.4) * k, life: 0.8 + c.rand() * 0.7 }); }
    for (var j = 0; j < (big ? 30 : 18); j++) { var d2 = new V3(c.rand() - 0.5, 0.4 + c.rand(), c.rand() - 0.5).normalize(); ZG.spawn(c, "fumaca", cen.clone().addScaledVector(d2, 0.6), d2.multiplyScalar(1.5 + c.rand() * 2), { variant: "preta", s: (1.4 + c.rand()) * k, life: 4 + c.rand() * 2 }); }
    burst(c, "faisca", cen, 40, { speed: 7, spread: 1.6 });
    burst(c, "lata", cen, 14, { speed: 5, spread: 1.5, mat: CM(paintCol(m.col || "#777", c.st), { roughness: 0.5, metalness: 0.3, side: DS }) });
    burst(c, "plastico", cen, 8, { speed: 4 });
    /* vidros estouram em cacos */
    c.glass.slice().forEach(function (gm2) { var G = gm2.userData.glass; if (!G || G.broken || !gm2.visible || !gm2.parent) return; if (G.type === "laminado") { G.type = "temperado"; } shatterGlass(c, gm2, 1.4, new V3(0, 1, 0)); });
    /* peças que voam com rastro de fogo */
    function rv(a, b) { return a + c.rand() * (b - a); }
    if (c.hood) { fling(c, c.hood.piv, new V3(rv(1, 3), rv(6, 8.5), rv(-1.5, 1.5)), new V3(rv(-4, 4), rv(-2, 2), rv(3, 7))); c.hood = null; }
    var W = m.W || 1.6, gh = m.gh;
    if (m.kind === "car" && gh) {
      [1, -1].forEach(function (sd) {
        var dh = Math.max(0.35, (m.belt || 1) - (m.clear || 0.3) - 0.08), dx = gh.fb - 0.55;
        var door = c.rb(0.95, dh, 0.045, 0.03, c.paint(m.col || "#777"), dx, (m.clear || 0.3) + dh / 2 + 0.04, sd * (W / 2 + 0.01));
        var hole = c.rb(0.9, dh * 0.95, 0.02, 0.02, MT.dark, dx, (m.clear || 0.3) + dh / 2 + 0.04, sd * (W / 2 - 0.01)); hole.userData.noFollow = true;
        fling(c, door, c.dirFx(new V3(rv(-1, 1), rv(3.5, 6), sd * rv(4, 6.5))), new V3(rv(-5, 5), rv(-4, 4), rv(-5, 5)));
      });
    }
    if (m.bumperR && m.bumperR.parent) fling(c, m.bumperR.parent.isGroup && m.bumperR.parent !== c.g ? m.bumperR.parent : m.bumperR, c.dirFx(new V3(rv(-5, -3), rv(4, 6), rv(-1, 1))), new V3(rv(-3, 3), rv(-6, 6), rv(-3, 3)));
    if (c.wheels.length) { var wi = Math.floor(c.rand() * c.wheels.length), wh = c.wheels[wi]; c.wheels.splice(wi, 1); c.parts.forEach(function (p) { if (p.obj === wh) p.done = true; }); fling(c, wh, c.dirFx(new V3(rv(-2, 2), rv(5, 7.5), (wh.position.z >= 0 ? 1 : -1) * rv(3, 5))), new V3(rv(-8, 8), rv(-3, 3), rv(-8, 8))); }
    burnAll(c);
    /* fogo baixo que fica na carcaça */
    c.emit = c.emit.filter(function (e) { return e.kind === "escape" ? false : true; });
    c.emit.forEach(function (e) { if (e.kind === "fogo") e.rate = Math.min(e.rate, 7); });
    ZG.addEmitter(c, ep.clone().add(new V3(0, 0.15, 0)), "fogo", { rate: 8, s: 0.8 });
    ZG.addEmitter(c, new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clear || 0.3) + 0.35, 0), "fogo", { rate: 6, s: 0.7 });
    ZG.addEmitter(c, ep.clone().add(new V3(0, 0.9, 0)), "preta", { rate: 4, s: 1.4 });
    c.parts.forEach(function (p) { if (p.kind === "vidro" || p.kind === "farol" || p.kind === "lanterna" || p.kind === "capo") p.done = true; });
    c.log.push({ kind: "explosao", n: big ? "Explosão do tanque" : "Explosão" });
    if (big) bigBoomFx(c);
  }
  function tickBoom(c, dt) {
    var B = c.boom; B.t += dt;
    if (B.phase === "fogo") { if (B.t >= B.T) detonate(c); return; }
    if (B.phase === "voo") {
      B.vy -= 9.8 * dt; c.g.position.y += B.vy * dt; c.g.rotation.x += B.rx * dt * (B.vy > 0 ? 1 : -1); c.g.rotation.z += B.rz * dt * (B.vy > 0 ? 1 : -1);
      if (c.g.position.y <= B.y0 && B.vy < 0) { c.g.position.y = B.y0; if (B.vy < -2.5) { B.vy *= -0.18; burst(c, "poeira", c.toFx(new V3(0, 0.1, 0)).setY(0.1), 10, { speed: 1.5, spread: 2.5, jitter: 1.0, s: 1.6 }); } else { B.phase = "queimado"; c.g.rotation.x *= 0.3; c.g.rotation.z *= 0.3; } }
    }
    if (B.flash) { var ft = B.t / 0.6; if (ft < 1) { var sc = (c.meta.bigBoom ? 22 : 9) * Math.sin(Math.min(1, ft * 4) * PI * 0.5); B.flash.scale.set(sc, sc, 1); B.flash.material.opacity = 1 - ft; } else { c.fx.remove(B.flash); B.flash.material.dispose(); B.flash = null; } }
    if (B.shock) { var st = B.t / 0.7; if (st < 1) { var r = (c.meta.bigBoom ? 18 : 7) * st + 0.5; B.shock.scale.set(r, r, 1); B.shock.material.opacity = 0.6 * (1 - st); } else { c.fx.remove(B.shock); B.shock.geometry.dispose(); B.shock = null; } }
  }
  function tickFlying(c, dt) {
    (c.flying || []).forEach(function (P) {
      if (P.landed) { if (P.trail > 0) { P.trail -= dt; if (c.rand() < dt * 8) ZG.spawn(c, "fogo", P.o.position.clone(), new V3(0, 0.8, 0), { s: 0.35, life: 0.5 }); } return; }
      P.v.y -= 9.8 * dt; P.o.position.addScaledVector(P.v, dt);
      P.o.rotation.x += P.w.x * dt; P.o.rotation.y += P.w.y * dt; P.o.rotation.z += P.w.z * dt;
      if (P.trail > 0 && c.rand() < dt * 30) { ZG.spawn(c, "fogo", P.o.position.clone(), P.v.clone().multiplyScalar(-0.1), { s: 0.45 + c.rand() * 0.3, life: 0.45 }); if (c.rand() < 0.4) ZG.spawn(c, "fumaca", P.o.position.clone(), new V3(0, 0.6, 0), { variant: "preta", s: 0.5, life: 2 }); }
      if (P.o.position.y < P.r) {
        P.o.position.y = P.r;
        if (P.v.y < -2) { P.v.y *= -0.3; P.v.x *= 0.5; P.v.z *= 0.5; P.w.multiplyScalar(0.5); burst(c, "faisca", P.o.position.clone().setY(0.05), 8, { speed: 2 }); }
        else { P.landed = true; P.o.rotation.x = Math.round(P.o.rotation.x / (PI / 2)) * (PI / 2) * 0 + P.o.rotation.x * 0.2; P.o.rotation.z *= 0.2; }
      }
    });
    if (c.bigFx) {
      var F = c.bigFx; F.t += dt;
      /* cogumelo: coluna que sobe e chapéu que abre a ~16 m */
      if (F.t < 4.5) {
        var cen = c.toFx(new V3(((c.meta.front || 1) + (c.meta.rear || -1)) / 2, 1.5, 0));
        if (c.rand() < dt * 40) ZG.spawn(c, "fogo", cen.clone().add(new V3((c.rand() - 0.5) * 1.5, c.rand() * 2, (c.rand() - 0.5) * 1.5)), new V3((c.rand() - 0.5), 7 + c.rand() * 3, (c.rand() - 0.5)), { s: 2.6 + c.rand() * 1.5, life: 1.8, nofog: true });
        if (c.rand() < dt * 18) ZG.spawn(c, "fumaca", cen.clone().add(new V3(0, 2, 0)), new V3((c.rand() - 0.5) * 0.6, 8 + c.rand() * 2, (c.rand() - 0.5) * 0.6), { variant: "cinza", s: 2.6, life: 2.0, grow: 1.6, nofog: true });
        if (F.t > 1.0 && c.rand() < dt * 30) { var a = c.rand() * PI * 2; ZG.spawn(c, "fumaca", cen.clone().add(new V3(Math.cos(a) * 2, 14.5 + c.rand() * 2, Math.sin(a) * 2)), new V3(Math.cos(a) * 3.2, 0.6, Math.sin(a) * 3.2), { variant: "cinza", s: 3.6, life: 5, grow: 2.2, nofog: true }); }
        if (F.t > 0.8 && c.rand() < dt * 10) { var a2 = c.rand() * PI * 2; ZG.spawn(c, "fogo", cen.clone().add(new V3(Math.cos(a2) * 1.5, 15 + c.rand(), Math.sin(a2) * 1.5)), new V3(Math.cos(a2) * 2.5, 0.4, Math.sin(a2) * 2.5), { s: 3.8, life: 1.3, nofog: true }); }
      }
      var fade = F.t < 6 ? 1 : Math.max(0, 1 - (F.t - 6) / 2);
      F.rings.forEach(function (r, i) { r.material.opacity = (i % 3 === 1 ? 0.07 : 0.85) * fade * Math.min(1, F.t * 3); });
      if (fade <= 0) { c.fx.remove(F.g); c.bigFx = null; }
    }
  }

  /* ================= laço por quadro ================= */
  ZG.tick = function (c, dt) {
    c.time += dt;
    if (c.rollA) tickRoll(c, dt);
    if (c.boom) tickBoom(c, dt);
    if (c.flying || c.bigFx) tickFlying(c, dt);
    if (c.hood) { var h = c.hood, tg = Math.max(h.target, h.latch); h.ang += (tg - h.ang) * Math.min(1, dt * 4.5); h.piv.rotation.z = h.ang * (h.sign || 1); }
    c.spin.forEach(function (s) { s.o.rotation[s.axis] += dt * s.v; if (s.decay) s.v *= Math.max(0, 1 - s.decay * dt); });
    tickEmit(c, dt); tickParticles(c, dt); updateFluids(c, dt);
    if (c.meta.kind === "boat" && !c.flipped && !c.rollA) { c.g.position.y = (c.sunk || 0) + Math.sin(c.time * 1.3) * 0.04; c.g.rotation.z = Math.sin(c.time * 0.9) * 0.02; }
  };
  ZG.settle = function (c, sec) { var n = Math.round(sec * 30); for (var i = 0; i < n; i++) ZG.tick(c, 1 / 30); };
  ZG.setHood = function (c, open) { if (!c.hood) return false; c.hood.target = open ? c.hood.open : 0; return true; };

  /* ================= modificado ================= */
  var STEELM = CM("#4e534f", { metalness: 0.55, roughness: 0.5 });
  var PLATECOLS = ["#4f5450", "#5b605b", "#454a47", "#56584f", "#4b4d4a"].map(function (h) { return CM(h, { metalness: 0.5, roughness: 0.55 }); });
  ZG.STEELM = STEELM;
  function jerry(c, x, y, z, col) {
    c.rb(0.34, 0.44, 0.16, 0.04, CM(col, { roughness: 0.5 }), x, y, z);
    c.tube([[x - 0.1, y + 0.22, z], [x - 0.05, y + 0.28, z], [x + 0.05, y + 0.28, z], [x + 0.1, y + 0.22, z]], 0.015, CM(col)); c.cyl(0.025, 0.025, 0.05, MT.trim, x + 0.12, y + 0.24, z);
  }
  ZG.jerry = jerry;
  function applyArmor(c) {
    var m = c.meta, k = m.kind;
    if (k === "bike") {
      /* caixa apoiada no bagageiro (meta.rack = altura) e galão em cima da caixa */
      var ry = m.rack || (m.belt || 0.8) - 0.05, bxx = (m.rear || -0.9) + 0.3, bh = m.L < 1.9 ? 0.26 : 0.32;
      c.rb(m.L < 1.9 ? 0.36 : 0.42, bh, 0.32, 0.03, m.L < 1.9 ? MT.wood : CM("#3d3a2e"), bxx, ry + bh / 2, 0);
      jerry(c, bxx, ry + bh + 0.22, 0, "#8e2a20");
      if (m.L >= 1.9) [1, -1].forEach(function (s2) { c.tube([[0.38, 0.9, s2 * 0.18], [0.45, 0.6, s2 * 0.32], [0.1, 0.3, s2 * 0.3]], 0.02, MT.steel); });
      return;
    }
    if (k === "boat") {
      var bx = m.front - 1.5, x0 = m.rear + 1.2, yt = m.top + 0.5;
      for (var z = -0.6; z <= 0.61; z += 0.2) c.rod(new V3(x0, yt, z), new V3(bx, yt, z), 0.012, STEELM);
      [x0, bx].forEach(function (x) { [-0.65, 0.65].forEach(function (zz) { c.rod(new V3(x, m.belt, zz), new V3(x, yt, zz), 0.03, STEELM); }); });
      [0.5, 0.2, -0.1].forEach(function (zz, i) { jerry(c, m.rear + 1.3, m.belt + 0.1, zz, i % 2 ? "#3e5a34" : "#8e2a20"); });
      c.cyl(0.14, 0.1, 0.2, MT.steel, bx, yt + 0.12, 0, "x"); c.cyl(0.11, 0.11, 0.02, MT.head, bx + 0.1, yt + 0.12, 0, "x");
      return;
    }
    if (k === "plane" || k === "heli") {
      var wz = k === "plane" ? 2.6 : 1.05, wy = k === "plane" ? (m.top - 0.25) : 0.55, pod = CM("#5c6158", { metalness: 0.4, roughness: 0.5 });
      [1, -1].forEach(function (s) { c.cyl(0.18, 0.18, 1.3, pod, 0.2, wy - 0.25, s * wz, "x"); c.sph(0.18, pod, 0.85, wy - 0.25, s * wz, 1.6, 1, 1); c.sph(0.18, pod, -0.45, wy - 0.25, s * wz, 1.3, 1, 1); c.rod(new V3(0.2, wy - 0.1, s * wz), new V3(0.2, wy, s * wz), 0.02, MT.steel); });
      c.cyl(0.16, 0.12, 0.22, MT.steel, m.front - 0.6, 0.85, 0.3, "x"); c.cyl(0.13, 0.13, 0.02, MT.head, m.front - 0.48, 0.85, 0.3, "x");
      return;
    }
    if (!m.bullet) {
      c.glass.slice().forEach(function (gm2) {
        if (!gm2.parent) return;
        var b = new THREE.Box3().setFromObject(gm2), dx = b.max.x - b.min.x, dz = b.max.z - b.min.z, h = (b.max.y - b.min.y) * 0.96, yc = (b.max.y + b.min.y) / 2;
        if (gm2.userData.ghost) {
          for (var xx = b.min.x; xx <= b.max.x; xx += 0.15) [b.min.z - 0.03, b.max.z + 0.03].forEach(function (zz) { c.rod(new V3(xx, b.min.y, zz), new V3(xx, b.max.y, zz), 0.014, STEELM); });
        } else if (dz < 0.25 && dx > 0.2) {
          var z0 = b.max.z > 0 ? b.max.z + 0.035 : b.min.z - 0.035;
          for (var x = b.min.x + 0.06; x < b.max.x - 0.03; x += 0.12) c.rod(new V3(x, yc - h / 2, z0), new V3(x, yc + h / 2, z0), 0.014, STEELM);
          [yc - h / 2, yc + h / 2].forEach(function (y) { c.rod(new V3(b.min.x, y, z0), new V3(b.max.x, y, z0), 0.02, STEELM); });
        }
      });
      c.quads.forEach(function (q) {
        var off = 0.06, bx2 = q.b[0] + q.n[0] * off, by2 = q.b[1] + q.n[1] * off, tx = q.t[0] + q.n[0] * off, ty = q.t[1] + q.n[1] * off;
        for (var f = -1; f <= 1.0001; f += 0.14) c.rod(new V3(bx2, by2, f * q.hb), new V3(tx, ty, f * q.ht), 0.014, STEELM);
        c.rod(new V3(bx2, by2, -q.hb), new V3(bx2, by2, q.hb), 0.02, STEELM); c.rod(new V3(tx, ty, -q.ht), new V3(tx, ty, q.ht), 0.02, STEELM);
      });
    }
    /* aríete: lâmina quase vertical rente ao para-choque, presa por braços até a longarina */
    var ph = clamp(Math.min(m.bodyH, 0.9) * 0.8, 0.32, 0.7), yb = Math.max(0.1, m.clear * 0.55), fy = yb + ph / 2, fx = m.front + 0.11;
    c.rb(0.07, ph, m.W * 1.02, 0.03, STEELM, fx, fy, 0, { rot: [0, 0, -0.1] });
    [-0.3, 0.3].forEach(function (zf) {
      c.rod(new V3(m.front - 0.35, yb + 0.05, m.W * zf), new V3(fx - 0.03, yb + 0.05, m.W * zf), 0.035, MT.trim);
      c.rod(new V3(m.front - 0.25, yb + 0.05, m.W * zf), new V3(fx - 0.03, fy + ph * 0.25, m.W * zf), 0.025, MT.trim);
    });
    for (var bar = 0; bar < 3; bar++) c.rod(new V3(fx + 0.045, yb + ph * (0.2 + bar * 0.3), -m.W * 0.5), new V3(fx + 0.045, yb + ph * (0.2 + bar * 0.3), m.W * 0.5), 0.02, STEELM);
    var n = Math.max(4, Math.round(m.W / 0.32)), spk = CM("#8a8e8a", { metalness: 0.7, roughness: 0.35 });
    for (var i = 0; i < n; i++) { var sp = c.add(new THREE.ConeGeometry(0.035, 0.26, 10), spk, fx + 0.17, yb + ph * (i % 2 ? 0.35 : 0.65), -m.W * 0.44 + (i + 0.5) * (m.W * 0.88 / n)); sp.rotation.z = -PI / 2; }
    /* chapas laterais: entre os para-choques, recortadas sobre as rodas, coladas na curva da lateral */
    if (k !== "tractor") {
      var x0 = m.rear + 0.15, x1 = m.front - 0.15, brk = [x0, x1], wl = [];
      c.wheels.forEach(function (w) { if (!w.parent) return; var r = w.userData.r || 0.33; wl.push([w.position.x - r - 0.07, w.position.x + r + 0.07, w.position.y + r + 0.05]); });
      wl.forEach(function (w) { if (w[0] > x0 && w[0] < x1) brk.push(w[0]); if (w[1] > x0 && w[1] < x1) brk.push(w[1]); });
      brk.sort(function (a, b) { return a - b; });
      var yTop = Math.min(m.belt - 0.06, m.clear + 0.15 + Math.min(m.bodyH, 1.0) * 0.75), pieces = [];
      for (var b = 0; b < brk.length - 1; b++) {
        var a0 = brk[b], a1 = brk[b + 1], mid = (a0 + a1) / 2, bot = m.clear + 0.1;
        wl.forEach(function (w) { if (mid > w[0] && mid < w[1]) bot = Math.max(bot, w[2]); });
        if (yTop - bot < 0.14 || a1 - a0 < 0.12) continue;
        var np = Math.max(1, Math.round((a1 - a0) / 1.0));
        for (var q = 0; q < np; q++) pieces.push([a0 + (a1 - a0) * q / np, a0 + (a1 - a0) * (q + 1) / np, bot]);
      }
      [1, -1].forEach(function (s2) {
        pieces.forEach(function (pc, j) {
          var pl = pc[1] - pc[0] - 0.03, px = (pc[0] + pc[1]) / 2, plH = yTop - pc[2], py = pc[2] + plH / 2;
          function zAt(x) { var h = probe(c, new V3(x, py, s2 * (m.W / 2 + 2)), new V3(0, 0, -s2), 2 + m.W * 0.4); return h && Math.abs(h.p.z) > m.W * 0.3 ? h.p.z : s2 * m.W / 2; }
          var za = zAt(px - pl * 0.4), zb = zAt(px + pl * 0.4), pz = (zAt(px) + (za + zb) / 2) / 2 + s2 * 0.035, yaw = -Math.atan2(zb - za, pl * 0.8);
          var pm = c.rb(pl, plH, 0.035, 0.012, PLATECOLS[(j * 2 + (s2 > 0 ? 0 : 1)) % PLATECOLS.length], px, py, pz, { rot: [(hash(j, s2, 2) - 0.5) * 0.04, yaw, (hash(j, s2, 1) - 0.5) * 0.06] });
          [-1, 1].forEach(function (u) { [-1, 1].forEach(function (v) { c.sph(0.016, MT.steel, px + u * pl * 0.42 * Math.cos(yaw), py + v * plH * 0.38, pz + s2 * 0.02 - u * Math.sin(yaw) * pl * 0.42); }); });
          pm.userData.armorPlate = true;
        });
      });
    }
    if (m.roof) {
      var r = m.roof, ry = (r.y || m.top) + 0.12, rl = r.x1 - r.x0, rw = r.w;
      c.tube([[r.x0, ry, -rw / 2], [r.x1, ry, -rw / 2], [r.x1, ry, rw / 2], [r.x0, ry, rw / 2], [r.x0, ry, -rw / 2]], 0.022, MT.trim, { seg: 40 });
      [r.x0 + 0.05, r.x1 - 0.05].forEach(function (x) { [-rw / 2, rw / 2].forEach(function (zz) { c.rod(new V3(x, ry - 0.12, zz), new V3(x, ry, zz), 0.02, MT.trim); }); });
      for (var xs = r.x0 + 0.2; xs < r.x1; xs += 0.3) c.rod(new V3(xs, ry, -rw / 2), new V3(xs, ry, rw / 2), 0.012, MT.trim);
      var cans = Math.max(1, Math.min(4, Math.floor(rl / 0.45)));
      for (var q = 0; q < cans; q++) jerry(c, r.x0 + 0.25 + q * 0.4, ry + 0.24, -rw * 0.28, q % 2 ? "#3e5a34" : "#8e2a20");
      if (rl > 1.0 && rw > 0.9) { var sp2 = c.wheel(r.x1 - 0.45, 0.001, 0.32, 0.2, { noPart: true }); sp2.rotation.x = PI / 2; sp2.position.set(r.x1 - 0.45, ry + 0.11, rw * 0.2); c.wheels.pop(); }
    }
    if (m.bed) { jerry(c, m.bed.x0 + 0.3, m.bed.y + 0.23, 0.6, "#8e2a20"); jerry(c, m.bed.x0 + 0.3, m.bed.y + 0.23, 0.4, "#8e2a20"); c.rb(0.8, 0.45, 0.6, 0.05, CM("#4a4b3c"), m.bed.x0 + 0.9, m.bed.y + 0.23, -0.4); c.rb(0.5, 0.3, 0.4, 0.04, MT.wood, m.bed.x0 + 0.8, m.bed.y + 0.15, 0.3); }
  }
  ZG.applyArmor = applyArmor;

  /* ================= zonas de dano (v4) ================= */
  /* Cada veículo tem zonas nomeadas com saúde de 0 a 100. O núcleo deriva as zonas da meta (autoZones) e o construtor refina
     com c.zone(id, rótulo, caixa, peças, opções). A faixa (intacto, arranhado, amassado, destruído, arrancado) decide o visual,
     que é determinístico: a mesma zona na mesma faixa produz sempre o mesmo resultado. Ao trocar de faixa, o app reconstrói o
     veículo (ZG.build(k, estado, zs)) e applyZones reaplica todas as zonas. O dano fica dentro da caixa da zona: o campo de
     amassado é mascarado pela caixa e cada peça com dono (roda, farol, vidro, capô, retrovisor) só obedece à própria zona. */
  var BANDS = [
    { id: "intacto", n: "Intacto", min: 76, h: 100, col: "#6f8f63" },
    { id: "arranhado", n: "Arranhado", min: 51, h: 63, col: "#d8b440" },
    { id: "amassado", n: "Amassado", min: 26, h: 38, col: "#e07c2c" },
    { id: "destruido", n: "Destruído", min: 1, h: 13, col: "#c8392e" },
    { id: "arrancado", n: "Arrancado", min: 0, h: 0, col: "#6e7377" }
  ];
  function bandOf(h) { h = Math.round(clamp(h == null ? 100 : h, 0, 100)); for (var i = 0; i < BANDS.length; i++) if (h >= BANDS[i].min) return i; return 4; }
  ZG.BANDS = BANDS; ZG.bandOf = bandOf;
  var ZW = { porta: 1, painel: 1, teto: 1.2, tampa: 0.8, capo: 1, parachoque: 0.6, vidro: 0.4, luz: 0.3, roda: 0.8, interno: 1.5, peca: 1 };
  /* efeito por chave, nas cinco faixas; {quem} vira o ocupante daquele lado. O texto vem do plugin do jogo. */
  var FXZ = {};   /* chave → 5 textos (um por faixa); preenchido por configure({zoneFx}) */
  ZG.ZONE_FX = FXZ;
  function zoneFx(z, b) { var t = (z.fx || FXZ[z.fxKey] || FXZ[z.type] || FXZ.painel || [])[b] || ZG.config.texts.noEffect || ""; return t.replace(/\{quem\}/g, z.who || ZG.config.texts.who); }
  ZG.zoneEffect = function (z, h) { return zoneFx(z, bandOf(h == null ? z.h : h)); };

  /* caixa: [x0, x1, y0, y1, z0, z1], { x0, x1, y0, y1, z0, z1 } ou THREE.Box3 (coordenadas de c.g) */
  function nbox(b) {
    if (!b) return null;
    if (Array.isArray(b)) return { x0: Math.min(b[0], b[1]), x1: Math.max(b[0], b[1]), y0: Math.min(b[2], b[3]), y1: Math.max(b[2], b[3]), z0: Math.min(b[4], b[5]), z1: Math.max(b[4], b[5]) };
    if (b.isBox3) return { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z };
    return { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1 };
  }
  ZG.zoneBox = nbox;
  function bLo(B, a) { return a === 0 ? B.x0 : a === 1 ? B.y0 : B.z0; }
  function bHi(B, a) { return a === 0 ? B.x1 : a === 1 ? B.y1 : B.z1; }
  function inB(B, x, y, z, e) { e = e || 0; return x >= B.x0 - e && x <= B.x1 + e && y >= B.y0 - e && y <= B.y1 + e && z >= B.z0 - e && z <= B.z1 + e; }
  function bCen(B) { return new V3((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2); }
  function bVol(B) { return Math.max(1e-4, B.x1 - B.x0) * Math.max(1e-4, B.y1 - B.y0) * Math.max(1e-4, B.z1 - B.z0); }
  function bDist(B, p) { var dx = Math.max(B.x0 - p.x, 0, p.x - B.x1), dy = Math.max(B.y0 - p.y, 0, p.y - B.y1), dz = Math.max(B.z0 - p.z, 0, p.z - B.z1); return Math.hypot(dx, dy, dz); }
  function bInter(B, b3) { return b3.max.x >= B.x0 && b3.min.x <= B.x1 && b3.max.y >= B.y0 && b3.min.y <= B.y1 && b3.max.z >= B.z0 && b3.min.z <= B.z1; }
  function gInvOf(c) { c.root.updateMatrixWorld(true); return new THREE.Matrix4().copy(c.g.matrixWorld).invert(); }
  /* caixa de um objeto nas coordenadas de c.g */
  function gBox(c, o, inv) {
    inv = inv || gInvOf(c);
    var bb = new THREE.Box3(), tmp = new THREE.Box3(), M = new THREE.Matrix4();
    o.traverse(function (x) {
      if (!x.isMesh || !x.geometry || !x.geometry.attributes.position || x.userData.decal) return;
      if (!x.geometry.boundingBox) x.geometry.computeBoundingBox();
      tmp.copy(x.geometry.boundingBox).applyMatrix4(M.multiplyMatrices(inv, x.matrixWorld)); bb.union(tmp);
    });
    return bb;
  }
  ZG.gBox = gBox;
  function slug(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }

  /* ---- declaração pelo construtor ---- */
  P.zone = function (id, label, box, parts, o) {
    var d = Object.assign({ id: id }, o || {});
    if (label === false) d.remove = true; else if (label) d.n = label;
    if (box) d.box = nbox(box);
    if (parts) d.objs = Array.isArray(parts) ? parts.slice() : [parts];
    (this.zoneDefs || (this.zoneDefs = [])).push(d);
    return d;
  };

  function wheelInfo(c) {
    var ws = c.wheels.filter(function (w) { return w.parent; });
    if (!ws.length) return null;
    var xf = -1e9, xr = 1e9, rf = 0.3, rr = 0.3;
    ws.forEach(function (w) { var r = w.userData.r || 0.3; if (w.position.x > xf) { xf = w.position.x; rf = r; } if (w.position.x < xr) { xr = w.position.x; rr = r; } });
    return { list: ws, xf: xf, xr: xr, rf: rf, rr: rr };
  }
  function partsOf(c, kind) { return c.parts.filter(function (p) { return p.kind === kind; }); }
  function lightCenter(c, L, inv) { if (L.g) return gBox(c, L.g, inv).getCenter(new V3()); var bb = new THREE.Box3(); L.lens.concat(L.inner).forEach(function (m) { bb.union(gBox(c, m, inv)); }); return bb.isEmpty() ? new V3() : bb.getCenter(new V3()); }
  function lightBoxOf(c, L, inv) { if (L.g) return gBox(c, L.g, inv); var bb = new THREE.Box3(); L.lens.concat(L.inner).forEach(function (m) { bb.union(gBox(c, m, inv)); }); return bb; }
  function sideTxt(s) { return s < 0 ? "esquerda" : "direita"; }
  function sideTxtM(s) { return s < 0 ? "esquerdo" : "direito"; }

  /* ---- derivação automática por tipo de veículo ---- */
  function autoZones(c) {
    var m = c.meta, Z = [], inv = gInvOf(c), kind = m.kind || "car";
    var F = m.front, R = m.rear, L = m.L || (F - R), W = m.W || 1.7, cl = m.clear == null ? 0.3 : m.clear, belt = m.belt || cl + 0.6, top = m.top || belt + 0.5, hw = W / 2;
    var WH = wheelInfo(c);
    function add(id, n, type, box, o) { var z = Object.assign({ id: id, n: n, type: type, box: nbox(box) }, o || {}); Z.push(z); return z; }
    var fam = kind;
    if (kind === "quad") fam = "bike";
    if (kind === "bus" || kind === "truck" || kind === "tractor") fam = "heavy";
    if (kind === "car" && (m.bullet || m.armored || partsOf(c, "lagarta").length)) fam = "mil";
    var glassDone = false, lightsDone = false, wheelsDone = false;

    /* vidros, faróis e rodas em comum */
    function glassZones(grouped) {
      glassDone = true;
      var gl = c.glass.filter(function (g) { return g.parent && g.userData.glass && !g.userData.ghost; }); if (!gl.length) return;
      var info = gl.map(function (g) { var pt = c.parts.find(function (p) { return p.obj === g; }), bb = gBox(c, g, inv); return { g: g, n: (pt && pt.n) || g.userData.glass.label || "Vidro", bb: bb, cen: bb.getCenter(new V3()) }; });
      if (!grouped && gl.length <= 10) {
        var used = {};
        info.forEach(function (q) {
          var n = q.n; if (!/esquerd|direit/i.test(n) && Math.abs(q.cen.z) > W * 0.2) n += q.cen.z < 0 ? " esquerdo" : " direito";
          var id = slug(n); if (!/^vidro|^janela|^para_brisa/.test(id)) id = "vidro_" + id; if (used[id]) id += "_" + (++used[id]); else used[id] = 1;
          var front = /para-brisa/i.test(n), rearG = /traseir/i.test(n) && Math.abs(q.cen.z) < W * 0.2;
          var who = front ? "quem vai na frente" : rearG ? "quem vai atrás" : (q.cen.x > (m.gh && m.gh.pillars && m.gh.pillars.length ? Math.max.apply(null, m.gh.pillars) : (F + R) / 2) ? (q.cen.z < 0 ? "o motorista" : "o carona") : "quem vai atrás " + (q.cen.z < 0 ? "à esquerda" : "à direita"));
          add(id, n, "vidro", q.bb.clone().expandByScalar(0.04), { glass: [q.g], fxKey: front ? "parabrisa" : "vidro", who: who, tags: front ? ["parabrisa"] : [] });
        });
        return;
      }
      var groups = { f: [], e: [], d: [], t: [] };
      info.forEach(function (q) { var k = /para-brisa/i.test(q.n) || (Math.abs(q.cen.z) < W * 0.25 && q.cen.x > (F + R) / 2) ? "f" : Math.abs(q.cen.z) < W * 0.25 ? "t" : q.cen.z < 0 ? "e" : "d"; groups[k].push(q); });
      [["f", "Para-brisa", "parabrisa", "quem vai na frente"], ["e", "Vidros do lado esquerdo", "vidro", "quem está do lado esquerdo"], ["d", "Vidros do lado direito", "vidro", "quem está do lado direito"], ["t", "Vidro traseiro", "vidro", "quem vai atrás"]].forEach(function (G) {
        var L2 = groups[G[0]]; if (!L2.length) return; var bb = new THREE.Box3(); L2.forEach(function (q) { bb.union(q.bb); });
        add("vidros_" + G[0], G[1], "vidro", bb.expandByScalar(0.04), { glass: L2.map(function (q) { return q.g; }), fxKey: G[2], who: G[3], tags: G[0] === "f" ? ["parabrisa"] : [] });
      });
    }
    function lightZones() {
      lightsDone = true;
      var G = {};
      c.lights.forEach(function (Lt) {
        var cen = lightCenter(c, Lt, inv), k = Lt.kind === "lanterna" ? "lanterna" : "farol", s = Math.abs(cen.z) < W * 0.12 ? "c" : cen.z < 0 ? "e" : "d";
        var key = k + "_" + s; (G[key] || (G[key] = [])).push(Lt);
      });
      Object.keys(G).forEach(function (key) {
        var p = key.split("_");
        var n = p[1] === "c" ? (p[0] === "farol" ? "Barra de luz dianteira" : (fam === "bike" ? "Lanterna" : "Barra de lanterna")) : (p[0] === "farol" ? "Farol " : "Lanterna ") + (p[0] === "farol" ? sideTxtM(p[1] === "e" ? -1 : 1) : sideTxt(p[1] === "e" ? -1 : 1));
        if (fam === "bike" && p[0] === "farol") return;  /* o farol da moto fica na carenagem */
        /* luzes do mesmo lado muito afastadas (farol de teto, lanterna de baú) viram zonas separadas, para a caixa não cobrir meio veículo */
        var cl2 = [], split = fam === "car" || fam === "heavy" || fam === "mil";
        G[key].forEach(function (Lt) { if (!split) { if (!cl2.length) cl2.push({ L: [], bb: new THREE.Box3() }); cl2[0].L.push(Lt); cl2[0].bb.union(lightBoxOf(c, Lt, inv)); return; } var lb = lightBoxOf(c, Lt, inv), q = cl2.find(function (k2) { return k2.bb.distanceToPoint(lb.getCenter(new V3())) < 0.7; }); if (q) { q.L.push(Lt); q.bb.union(lb); } else cl2.push({ L: [Lt], bb: lb.clone() }); });
        cl2.sort(function (a2, b2) { return (p[0] === "farol" ? -1 : 1) * (a2.bb.max.x - b2.bb.max.x) || (a2.bb.min.y - b2.bb.min.y); });
        cl2.forEach(function (q, i) { add(i ? key + "_" + (i + 1) : key, i ? n + " (" + (i + 1) + ")" : n, "luz", q.bb.expandByScalar(0.03), { lights: q.L, fxKey: p[0] }); });
      });
    }
    function wheelZones(byAxle) {
      wheelsDone = true; if (!WH) return;
      var ws = WH.list;
      if (byAxle || ws.length > 6) {
        var ax = []; ws.slice().sort(function (a, b) { return b.position.x - a.position.x; }).forEach(function (w) { var a = ax.find(function (q) { return Math.abs(q.x - w.position.x) < 0.75; }); if (a) a.w.push(w); else ax.push({ x: w.position.x, w: [w] }); });
        ax.forEach(function (a, i) {
          var bb = new THREE.Box3(); a.w.forEach(function (w) { bb.union(gBox(c, w, inv)); });
          var n = ax.length === 1 ? "Rodas" : i === 0 ? "Rodas do eixo dianteiro" : i === ax.length - 1 ? "Rodas do eixo traseiro" : "Rodas do eixo " + (i + 1);
          add("rodas_eixo" + (i + 1), n, "roda", bb.expandByScalar(0.04), { wheels: a.w, fxKey: "eixo" });
        });
        return;
      }
      var used = {};
      ws.forEach(function (w) {
        var fr = ws.length <= 2 ? (w.position.x >= (WH.xf + WH.xr) / 2 ? "dianteira" : "traseira") : (w.position.x >= (WH.xf + WH.xr) / 2 ? "dianteira" : "traseira");
        var s = Math.abs(w.position.z) < 0.08 ? "" : (w.position.z < 0 ? " esquerda" : " direita"), n = "Roda " + fr + s, id = "roda_" + slug(fr + s);
        if (used[id]) { id += "_" + (++used[id]); n += " " + used[id]; } else used[id] = 1;
        add(id, n, "roda", gBox(c, w, inv).expandByScalar(0.04), { wheels: [w], who: s ? "" : "" });
      });
    }
    function internal(kind2, n, fxKey, sz) {
      var ps = partsOf(c, kind2); if (!ps.length) return null;
      var p = ps[0].pos, s = sz || [0.42, 0.3, 0.4];
      return add(kind2 === "bateria" ? "bateria" : kind2, n, "interno", [p.x - s[0], p.x + s[0], p.y - s[1], p.y + s[1], p.z - s[2], p.z + s[2]], { fxKey: fxKey || kind2, pos: p.clone(), sub: kind2 });
    }

    if (fam === "car") {
      var gh = m.gh && m.gh.fb != null ? m.gh : null, sb = 0.34, out = 0.25;
      var fb = gh ? gh.fb : F - 0.3 * L, rb = gh && gh.rb != null ? gh.rb : R + 0.2 * L;
      var xr = WH ? WH.xr : R + 0.25 * L, rr = WH ? WH.rr : 0.3;
      var doorF = fb - 0.03, pil = gh && gh.pillars ? gh.pillars.slice().sort(function (a, b) { return b - a; }) : [];
      var B = pil.length && pil[0] < doorF - 0.45 && pil[0] > rb + 0.2 ? pil[0] : Math.max(rb + 0.1, doorF - 1.1);
      var rearDoor = pil.length > 0 && pil[0] < doorF - 0.45 && (B - Math.max(rb, xr)) > 0.5;
      var C = rearDoor ? Math.max(pil[1] != null && pil[1] < B - 0.4 ? pil[1] : rb, xr + rr * 0.2) : B;
      var y0s = Math.max(0.03, cl - 0.12), y1s = belt + 0.03;
      var sideB = function (x0, x1, s, y0, y1) { return s < 0 ? [x0, x1, y0 == null ? y0s : y0, y1 == null ? y1s : y1, -hw - out, -hw + sb] : [x0, x1, y0 == null ? y0s : y0, y1 == null ? y1s : y1, hw - sb, hw + out]; };
      var bF = m.bumperF && m.bumperF.parent ? m.bumperF : null, bR = m.bumperR && m.bumperR.parent ? m.bumperR : null;
      partsOf(c, "parachoque").forEach(function (p) { if (!p.obj || !p.obj.parent) return; if (p.pos.x > (F + R) / 2) bF = bF || p.obj; else bR = bR || p.obj; });
      add("parachoque_d", "Para-choque dianteiro", bF ? "parachoque" : "painel", [F - 0.3, F + 0.25, -0.02, cl + 0.36, -hw - 0.2, hw + 0.2], { objs: bF ? [bF] : [], dir: [-1, 0, 0], fxKey: "parachoque", tags: ["frente"] });
      if (c.hood && c.hood.piv && c.hood.x1 > (F + R) / 2) {
        var hb = gBox(c, c.hood.piv, inv);
        add("capo", "Capô", "capo", [hb.min.x - 0.02, hb.max.x + 0.03, hb.min.y - 0.08, hb.max.y + 0.15, hb.min.z - 0.02, hb.max.z + 0.02], { objs: [c.hood.piv], dir: [0, -1, 0] });
      } else add("capo", "Capô", "painel", [fb + 0.02, F - 0.22, (cl + belt) / 2, belt + 0.2, -hw + 0.12, hw - 0.12], { dir: [0, -1, 0], fxKey: "capo" });
      [-1, 1].forEach(function (s) {
        var e = s < 0 ? "e" : "d", lado = sideTxtM(s), lada = sideTxt(s);
        if (F - 0.22 - doorF > 0.2) add("paralama_d" + e, "Paralama dianteiro " + lado, "painel", sideB(doorF, F - 0.22, s), { side: s, fxKey: "paralama" });
        add("porta_d" + e, rearDoor || pil.length ? "Porta dianteira " + lada : "Porta " + lada, "porta", sideB(B, doorF, s, null, y1s), { side: s, hinge: "frente", mirror: true, who: s < 0 ? "o motorista" : "o carona" });
        if (rearDoor) add("porta_t" + e, "Porta traseira " + lada, "porta", sideB(C, B, s), { side: s, hinge: "frente", who: "quem vai atrás " + (s < 0 ? "à esquerda" : "à direita") });
        if (C - (R + 0.22) > 0.22) add("lateral_t" + e, "Lateral traseira " + lada, "painel", sideB(R + 0.22, C, s), { side: s, fxKey: "lateral", who: m.bed ? "a carga" : "quem vai atrás" });
      });
      if (gh && gh.roof) add("teto", "Colunas e teto", "teto", [Math.min(rb, gh.rt) - 0.06, Math.max(fb, gh.ft) + 0.06, belt + 0.1, top + 0.15, -hw - 0.05, hw + 0.05], { dir: [0, -1, 0], alsoGlass: true });
      else add("teto", "Colunas e teto", "teto", [R + 0.25 * L, F - 0.35 * L, belt + 0.1, top + 0.15, -hw - 0.05, hw + 0.05], { dir: [0, -1, 0], alsoGlass: true });
      if (m.bed) {
        var bx0 = Math.min(m.bed.x0, m.bed.x1), bx1 = Math.max(m.bed.x0, m.bed.x1);
        add("cacamba", "Caçamba", "tampa", [R - 0.15, bx1 + 0.04, cl - 0.05, belt + 0.2, -hw + sb - 0.02, hw - sb + 0.02], { dir: [1, 0, 0], fxKey: "cacamba", hinge: "baixo", tags: ["traseira"] });
      } else {
        var tx1 = Math.max(R + 0.35, Math.min(rb + 0.12, R + 1.1));
        add("tampa", rb - R > 0.7 ? "Tampa do porta-malas" : "Tampa traseira", "tampa", [R - 0.15, tx1, cl + 0.3, belt + 0.22, -hw + 0.12, hw - 0.12], { dir: [1, 0, 0], hinge: "cima", tags: ["traseira"] });
      }
      add("parachoque_t", "Para-choque traseiro", bR ? "parachoque" : "painel", [R - 0.25, R + 0.3, -0.02, cl + 0.36, -hw - 0.2, hw + 0.2], { objs: bR ? [bR] : [], dir: [1, 0, 0], fxKey: "parachoque", tags: ["traseira"] });
      add("assoalho", "Assoalho e suspensão", "interno", [R, F, -0.05, cl + 0.06, -hw, hw], { fxKey: "assoalho", sub: "assoalho" });
      glassZones(false); lightZones(); wheelZones(false);
      internal("motor", c.meta.bay && c.meta.bay.motor === "eletrico" ? "Motor elétrico" : "Motor", "motor");
      internal("radiador", "Radiador", "radiador", [0.2, 0.25, 0.45]);
      internal("tanque", "Tanque de combustível", "tanque", [0.35, 0.18, 0.4]);
      internal("bateria", "Bateria", "bateria", [0.35, 0.2, 0.4]);
    } else if (fam === "bike") {
      var xf = WH ? WH.xf : F - 0.3, xrb = WH ? WH.xr : R + 0.3, rf2 = WH ? WH.rf : 0.3, wb = xf - xrb, bici = c.spec && c.spec.fuel === "nenhum", wq = Math.max(0.36, hw + 0.05);
      var tb = top;
      if (kind === "quad") {
        add("carenagem", "Carenagem e farol", "peca", [xf - 0.25, F + 0.12, rf2 * 1.2, tb - 0.08, -wq, wq], { fxKey: "carenagem", dir: [-1, 0, 0] });
        add("guidao", "Guidão e manetes", "peca", [xf - 0.75, xf - 0.25, belt + 0.05, tb + 0.12, -wq, wq], { fxKey: "guidao", dir: [0, -1, 0] });
        add("tanque_moto", "Tanque", "peca", [xrb + wb * 0.45, xf - 0.75, belt - 0.15, belt + 0.25, -0.25, 0.25], { fxKey: "tanque", dir: [0, -1, 0] });
        add("banco", "Banco e bagageiro", "peca", [R - 0.12, xrb + wb * 0.45, belt - 0.2, tb + 0.12, -wq, wq], { fxKey: "banco", dir: [0, -1, 0] });
      } else if (bici) {
        add("guidao", "Guidão", "peca", [xf - 0.45, xf + 0.15, tb - 0.22, tb + 0.12, -0.4, 0.4], { fxKey: "guidao", dir: [0, -1, 0] });
        add("quadro", "Quadro", "peca", [xrb + rf2 * 0.6, xf - rf2 * 0.3, rf2 * 0.6, tb - 0.22, -0.12, 0.12], { fxKey: "quadro", dir: [0, 0, 1] });
        add("banco", "Banco e bagageiro", "peca", [R - 0.1, xrb + rf2 * 0.6, rf2 * 1.4, tb + 0.12, -0.3, 0.3], { fxKey: "banco", dir: [0, -1, 0] });
      } else {
        add("carenagem", "Carenagem e farol", "peca", [xf - 0.3, F + 0.12, rf2 * 1.5, tb - 0.2, -0.38, 0.38], { fxKey: "carenagem", dir: [-1, 0, 0] });
        add("guidao", "Guidão e manetes", "peca", [xf - 0.6, xf + 0.05, tb - 0.2, tb + 0.15, -0.55, 0.55], { fxKey: "guidao", dir: [0, -1, 0] });
        add("tanque_moto", "Tanque", "peca", [xrb + wb * 0.52, xf - 0.28, belt - 0.12, tb - 0.2, -0.3, 0.3], { fxKey: "tanque", dir: [0, -1, 0] });
        add("banco", "Banco e rabeta", "peca", [R - 0.12, xrb + wb * 0.52, belt - 0.2, tb - 0.15, -0.3, 0.3], { fxKey: "banco", dir: [0, -1, 0] });
      }
      if (!bici) {
        var ex = m.exhaust, es = ex && ex.z < 0 ? -1 : 1;
        add("motor", "Motor", "peca", [xrb + wb * 0.3, xf - wb * 0.22, 0.12, belt - 0.12, -0.24, 0.24], { fxKey: "motor", dir: [0, 0, 1], sub: "motor" });
        add("escapamento", "Escapamento", "peca", es > 0 ? [R - 0.25, xrb + wb * 0.45, 0.08, belt - 0.12, 0.1, 0.5] : [R - 0.25, xrb + wb * 0.45, 0.08, belt - 0.12, -0.5, -0.1], { fxKey: "escape", dir: [0, 0, -es], side: es });
      }
      glassZones(true); lightZones(); wheelZones(false);
    } else if (fam === "heavy") {
      var bus = kind === "bus", tractor = kind === "tractor", sbH = 0.42;
      var cabL = m.cabL || (bus ? 2.0 : tractor ? 0 : 2.3);
      if (tractor) {
        var xc = (WH ? WH.xr : R + 0.6) + 0.35;
        add("frente", "Grade e frente", "painel", [F - 0.4, F + 0.25, 0.1, belt + 0.3, -hw * 0.6, hw * 0.6], { dir: [-1, 0, 0], tags: ["frente"] });
        add("capo_trator", "Capô do motor", c.hood && c.hood.piv ? "capo" : "painel", [xc + 0.3, F - 0.4, belt - 0.25, belt + 0.45, -hw * 0.45, hw * 0.45], { dir: [0, -1, 0], fxKey: "capo", objs: c.hood && c.hood.piv ? [c.hood.piv] : [] });
        [-1, 1].forEach(function (s) { add("paralama_t" + (s < 0 ? "e" : "d"), "Paralama traseiro " + sideTxtM(s), "painel", s < 0 ? [R - 0.1, xc + 0.5, 0.6, top - 0.6, -hw - 0.2, -hw + 0.55] : [R - 0.1, xc + 0.5, 0.6, top - 0.6, hw - 0.55, hw + 0.2], { side: s, fxKey: "paralama" }); });
        /* posto do operador: banco, volante e plataforma (não o toldo, que é a zona do arco) */
        var stp = c.seatTops[0], sy = stp ? stp.y : belt + 0.2;
        add("posto", "Posto do operador", "peca", [R - 0.1, xc + 0.5, sy - 0.45, sy + 0.75, -hw * 0.45, hw * 0.45], { dir: [0, -1, 0], fxKey: "cabine", who: "o tratorista", noFlap: true });
      } else {
        var cx0 = F - cabL;
        add("cab_frente", bus ? "Frente do ônibus" : "Cabine (frente)", "painel", [F - 0.45, F + 0.25, Math.max(0.05, cl - 0.1), top + 0.1, -hw - 0.1, hw + 0.1], { dir: [-1, 0, 0], fxKey: "cabine", who: "o motorista", tags: ["frente"] });
        [-1, 1].forEach(function (s) {
          var e = s < 0 ? "e" : "d";
          add("cab_" + e, (bus ? "Frente, lado " : "Cabine, lado ") + sideTxtM(s), "painel", s < 0 ? [cx0, F - 0.45, Math.max(0.05, cl - 0.1), top + 0.1, -hw - 0.25, -hw + sbH] : [cx0, F - 0.45, Math.max(0.05, cl - 0.1), top + 0.1, hw - sbH, hw + 0.25], { side: s, fxKey: "cabine", who: s < 0 ? "o motorista" : (bus ? "a porta de embarque" : "o ajudante") });
        });
        var big = bus ? "Salão" : (m.bigBoom || /tanque/i.test(c.spec && c.spec.n || "") ? "Tanque" : (m.bodyLabel || (/militar|worker/i.test(c.k || "") ? "Carroceria" : "Baú")));
        [-1, 1].forEach(function (s) {
          add("corpo_" + (s < 0 ? "e" : "d"), big + " (lado " + sideTxtM(s) + ")", "painel", s < 0 ? [R + 0.4, cx0, Math.max(0.05, cl - 0.1), top + 0.15, -hw - 0.25, -hw + sbH] : [R + 0.4, cx0, Math.max(0.05, cl - 0.1), top + 0.15, hw - sbH, hw + 0.25], { side: s, fxKey: "lateral", who: bus ? "quem está sentado desse lado" : "a carga" });
        });
        add("corpo_t", big + " (traseira)", "painel", [R - 0.25, R + 0.4, Math.max(0.05, cl - 0.1), top + 0.15, -hw - 0.1, hw + 0.1], { dir: [1, 0, 0], fxKey: bus ? "lateral" : "tampa", who: bus ? "quem vai no fundo" : "a carga", tags: ["traseira"] });
      }
      add("chassi", "Chassi", "interno", [R, F, -0.05, cl + 0.12, -hw, hw], { fxKey: "chassi", sub: "assoalho" });
      glassZones(true); lightZones(); wheelZones(true);
      internal("motor", "Motor", "motor", [0.6, 0.45, 0.5]);
      internal("tanque", bus ? "Tanque de diesel" : "Tanque de combustível", "tanque", [0.4, 0.3, 0.35]);
    } else if (fam === "mil") {
      var sbm = 0.45;
      var lag = partsOf(c, "lagarta");
      var hb2 = (m.hullTop || belt) + 0.12;
      add("blind_frente", "Blindagem frontal", "painel", [F - 0.65, F + 0.3, Math.max(0.05, cl - 0.15), hb2, -hw - 0.2, hw + 0.2], { dir: [-1, 0, 0], fxKey: "blindagem", tags: ["frente"] });
      [-1, 1].forEach(function (s) { add("blind_" + (s < 0 ? "e" : "d"), "Blindagem lateral " + sideTxt(s), "painel", s < 0 ? [R + 0.45, F - 0.65, Math.max(0.05, cl - 0.15), hb2, -hw - 0.3, -hw + sbm] : [R + 0.45, F - 0.65, Math.max(0.05, cl - 0.15), hb2, hw - sbm, hw + 0.3], { side: s, fxKey: "blindagem", who: "a tripulação desse lado" }); });
      add("blind_t", "Blindagem traseira", "painel", [R - 0.3, R + 0.45, Math.max(0.05, cl - 0.15), hb2, -hw - 0.2, hw + 0.2], { dir: [1, 0, 0], fxKey: "blindagem", tags: ["traseira"] });
      /* arma: a malha mais comprida em x acima da cintura (cano) */
      var gun = null, gl2 = 0;
      c.g.traverse(function (o) {
        if (!o.isMesh || o.userData.decal) return; var bb = gBox(c, o, inv), sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
        if (bb.min.y > belt - 0.1 && sx > 0.7 && sx > 5 * Math.max(sy, sz) && sx > gl2) { gl2 = sx; gun = { o: o, bb: bb }; }
      });
      if (gun) add("arma", gl2 > 2 ? "Canhão" : "Arma", "peca", gun.bb.clone().expandByScalar(0.08), { objs: [gun.o], fxKey: "arma", dir: [0, -1, 0], anchor: [gun.bb.min.x, (gun.bb.min.y + gun.bb.max.y) / 2, (gun.bb.min.z + gun.bb.max.z) / 2] });
      add("torre", "Teto e torre", "teto", [R + 0.35, F - 0.3, hb2, top + 0.25, -hw + 0.12, hw - 0.12], { dir: [0, -1, 0], fxKey: "torre", alsoGlass: true });
      if (lag.length) lag.forEach(function (p) {
        var s = p.pos.z < 0 ? -1 : 1, bb = gBox(c, p.obj, inv), ws2 = c.wheels.filter(function (w) { return Math.sign(w.position.z) === s; });
        var objs = [p.obj]; c.spin.forEach(function (sp) { if (sp.track && Math.sign(sp.o.position.z) === s) objs.push(sp.o); });
        add("lagarta_" + (s < 0 ? "e" : "d"), "Lagarta " + sideTxt(s), "peca", bb.expandByScalar(0.05), { objs: objs, wheels: ws2, fxKey: "lagarta", side: s, lagarta: p.obj, dir: [0, 0, -s] });
      });
      else if (WH) [-1, 1].forEach(function (s) {
        var ws3 = WH.list.filter(function (w) { return Math.sign(w.position.z) === s; }); if (!ws3.length) return;
        var bb = new THREE.Box3(); ws3.forEach(function (w) { bb.union(gBox(c, w, inv)); });
        add("rodas_" + (s < 0 ? "e" : "d"), "Rodas do lado " + sideTxtM(s), "roda", bb.expandByScalar(0.04), { wheels: ws3, fxKey: "eixo", side: s });
      });
      wheelsDone = true;
      glassZones(true); lightZones();
      internal("motor", "Motor", "motor", [0.6, 0.4, 0.55]);
    } else if (fam === "boat") {
      var bowL = 0.28 * L, sternL = 0.2 * L;
      add("proa", "Proa", "painel", [F - bowL, F + 0.3, cl - 0.4, belt + 0.25, -hw - 0.3, hw + 0.3], { dir: [-1, 0, 0], fxKey: "casco", tags: ["frente"], anyMesh: true });
      [-1, 1].forEach(function (s) { add("costado_" + (s < 0 ? "e" : "d"), s < 0 ? "Costado de bombordo" : "Costado de boreste", "painel", s < 0 ? [R + sternL, F - bowL, cl - 0.4, belt + 0.06, -hw - 0.35, -hw + 0.4] : [R + sternL, F - bowL, cl - 0.4, belt + 0.06, hw - 0.4, hw + 0.35], { side: s, fxKey: "casco", who: "quem está desse bordo", anyMesh: true }); });
      add("popa", "Popa", "painel", [R - 0.25, R + sternL, cl - 0.4, belt + 0.35, -hw - 0.3, hw + 0.3], { dir: [1, 0, 0], fxKey: "casco", tags: ["traseira"], anyMesh: true });
      add("conves", "Convés e cabine", "teto", [R + sternL, F - bowL, belt + 0.06, top + 0.4, -hw + 0.4, hw - 0.4], { dir: [0, -1, 0], fxKey: "conves", alsoGlass: true });
      var pp = partsOf(c, "popa")[0];
      if (pp && pp.obj) { var pb = gBox(c, pp.obj, inv); add("motor", "Motor de popa", "peca", pb.expandByScalar(0.05), { objs: [pp.obj], fxKey: "motor", dir: [1, 0, 0], sub: "motor", pos: pp.pos.clone() }); }
      else internal("motor", "Motor", "motor", [0.5, 0.35, 0.45]);
      internal("tanque", "Tanque de combustível", "tanque", [0.35, 0.25, 0.35]);
      glassZones(true); lightZones(); wheelZones(false);
    } else if (fam === "plane") {
      var fw = (m.fusW || 1.2) / 2, span = W / 2;
      var wingBB = new THREE.Box3(), tailX = R + Math.min(2.0, 0.28 * L);
      c.g.traverse(function (o) { if (!o.isMesh || o.userData.decal) return; var bb = gBox(c, o, inv); if (Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z)) > Math.max(2.0, span * 0.45) && bb.min.x > tailX) wingBB.union(bb); });
      if (wingBB.isEmpty()) wingBB.set(new V3(F - 3.0, belt, -span), new V3(F - 1.5, top, span));
      var hp = partsOf(c, "helice")[0];
      add("nariz", hp ? "Nariz e hélice" : "Nariz e motor", "painel", [F - 1.25, F + 0.6, cl - 0.8, top + 0.2, -fw - 0.5, fw + 0.5], { dir: [-1, 0, 0], fxKey: "nariz", objs: hp && hp.obj ? [hp.obj] : [], tags: ["frente"], anyMesh: true });
      add("cabine", "Cabine e vidros", "painel", [wingBB.min.x - 0.4, F - 1.25, belt - 0.4, top + 0.15, -fw - 0.12, fw + 0.12], { dir: [0, 0, 1], fxKey: "cabineaero", who: "o piloto", anyMesh: true });
      [-1, 1].forEach(function (s) { add("asa_" + (s < 0 ? "e" : "d"), "Asa " + sideTxt(s), "painel", s < 0 ? [wingBB.min.x - 0.15, wingBB.max.x + 0.15, wingBB.min.y - 0.25, wingBB.max.y + 0.25, -span - 0.3, -fw - 0.18] : [wingBB.min.x - 0.15, wingBB.max.x + 0.15, wingBB.min.y - 0.25, wingBB.max.y + 0.25, fw + 0.18, span + 0.3], { side: s, dir: [0, -1, 0], fxKey: "asa", cutAll: true, anyMesh: true }); });
      add("fuselagem", "Fuselagem traseira", "painel", [tailX, wingBB.min.x - 0.4, cl - 0.2, top, -fw - 0.12, fw + 0.12], { dir: [0, 0, 1], fxKey: "painel", anyMesh: true });
      add("cauda", "Cauda", "painel", [R - 0.4, tailX, 0, top + 0.6, -span * 0.5, span * 0.5], { dir: [0, -1, 0], fxKey: "cauda", cutAll: true, anyMesh: true, tags: ["traseira"] });
      var gear = c.wheels.filter(function (w) { return w.parent; });
      if (gear.length) {
        /* pernas e carenagens das rodas (peças baixas perto de cada roda) pertencem ao trem: dobram e somem junto */
        var gb = new THREE.Box3(), gobj = [];
        gear.forEach(function (w) { gb.union(gBox(c, w, inv)); });
        c.g.children.forEach(function (o) {
          if (!o.isMesh || o.userData.decal || o.userData.glass || c.wheels.indexOf(o) >= 0) return;
          var bb = gBox(c, o, inv), cen = bb.getCenter(new V3()), sz = bb.getSize(new V3());
          if (bb.isEmpty() || cen.y > cl * 0.85 || bb.max.y > cl + 0.45 || Math.max(sz.x, sz.y, sz.z) > 1.6) return;
          if (!gear.some(function (w) { return Math.abs(w.position.x - cen.x) < 0.7 && Math.abs(w.position.z - cen.z) < 0.9; })) return;
          gobj.push(o); gb.union(bb);
        });
        add("trem", "Trem de pouso", "roda", gb.expandByScalar(0.06), { wheels: gear, objs: gobj, fxKey: "trem" });
      }
      add("tanques", "Tanques (nas asas)", "interno", [wingBB.min.x, wingBB.max.x, wingBB.min.y - 0.1, wingBB.max.y + 0.1, -span * 0.55, span * 0.55], { fxKey: "tanque", sub: "tanque", pos: new V3((wingBB.min.x + wingBB.max.x) / 2, wingBB.min.y, -span * 0.35) });
      glassZones(true); glassDone = true; lightZones(); wheelsDone = true;
      Z = Z.filter(function (z) { return z.type !== "vidro"; });  /* os vidros do avião ficam na cabine */
    } else if (fam === "heli") {
      var fw2 = (m.fusW || 1.3) / 2, ft2 = m.fusTop || Math.min(top - 0.5, belt + 1.0), rp = partsOf(c, "rotor")[0], rt = partsOf(c, "rotorcauda")[0];
      add("nariz", "Nariz e bolha", "painel", [F - 1.05, F + 0.3, cl - 0.25, ft2 + 0.1, -fw2 - 0.2, fw2 + 0.2], { dir: [-1, 0, 0], fxKey: "cabineaero", who: "o piloto", tags: ["frente"], anyMesh: true });
      add("cabine", "Cabine", "painel", [F - Math.min(3.2, 0.36 * L), F - 1.05, cl - 0.25, ft2 + 0.1, -fw2 - 0.25, fw2 + 0.25], { dir: [0, 0, 1], fxKey: "cabine", who: "os passageiros", anyMesh: true });
      add("cone", "Cone de cauda", "painel", [R + 1.0, F - Math.min(3.2, 0.36 * L), cl, ft2 + 0.6, -fw2 - 0.3, fw2 + 0.3], { dir: [0, -1, 0], fxKey: "cone", cutAll: true, anyMesh: true, tags: ["traseira"] });
      if (rp && rp.obj) add("rotor", "Rotor principal", "peca", gBox(c, rp.obj, inv).expandByScalar(0.05), { objs: [rp.obj], fxKey: "rotor", dir: [0, -1, 0], kindPart: "rotor" });
      if (rt && rt.obj) add("rotor_cauda", "Rotor de cauda", "peca", gBox(c, rt.obj, inv).expandByScalar(0.05), { objs: [rt.obj], fxKey: "rotorcauda", dir: [0, 0, 1], kindPart: "rotorcauda" });
      var tremP = partsOf(c, "trem"), gear2 = c.wheels.filter(function (w) { return w.parent; });
      add("esquis", gear2.length ? "Trem de pouso" : "Esquis", gear2.length ? "roda" : "peca", [R + 1.0, F, -0.05, cl + 0.05, -W / 2 - 0.2, W / 2 + 0.2], { wheels: gear2, fxKey: gear2.length ? "trem" : "esqui", dir: [0, 1, 0], peca: true });
      void tremP;
      add("motor", "Motor e transmissão", "interno", [F - Math.min(3.4, 0.4 * L), F - 1.4, ft2 - 0.35, ft2 + 0.5, -fw2, fw2], { fxKey: "motor", sub: "motor" });
      glassZones(true); lightZones(); wheelsDone = true;
      Z = Z.filter(function (z) { return z.type !== "vidro"; });  /* vidros vão para o nariz e a cabine */
    } else {
      /* genérico: quatro lados e cima */
      add("frente", "Frente", "painel", [F - 0.4, F + 0.3, 0, top, -hw - 0.2, hw + 0.2], { dir: [-1, 0, 0], tags: ["frente"] });
      [-1, 1].forEach(function (s) { add("lado_" + (s < 0 ? "e" : "d"), "Lado " + sideTxtM(s), "painel", s < 0 ? [R + 0.4, F - 0.4, 0, top, -hw - 0.3, -hw + 0.4] : [R + 0.4, F - 0.4, 0, top, hw - 0.4, hw + 0.3], { side: s }); });
      add("traseira", "Traseira", "painel", [R - 0.3, R + 0.4, 0, top, -hw - 0.2, hw + 0.2], { dir: [1, 0, 0], tags: ["traseira"] });
      add("topo", "Teto", "teto", [R + 0.4, F - 0.4, top - 0.4, top + 0.2, -hw + 0.4, hw - 0.4], { dir: [0, -1, 0] });
    }
    if (!glassDone) glassZones(true);
    if (!lightsDone) lightZones();
    if (!wheelsDone) wheelZones(false);
    return Z;
  }

  /* ---- finalização: direção, lado, peças com dono, mapa ---- */
  function parseDir(d) {
    if (!d) return null; if (d.isVector3) return d.clone().normalize(); if (Array.isArray(d)) return new V3(d[0], d[1], d[2]).normalize();
    return { esquerda: new V3(0, 0, 1), direita: new V3(0, 0, -1), frente: new V3(-1, 0, 0), tras: new V3(1, 0, 0), "trás": new V3(1, 0, 0), cima: new V3(0, -1, 0), baixo: new V3(0, 1, 0) }[d] || null;
  }
  function resolveObjs(c, list, z) {
    var out = [];
    (list || []).forEach(function (o) {
      if (!o) return;
      if (typeof o === "string") {
        c.parts.forEach(function (p) { if ((p.n === o || p.kind === o) && p.obj) { if (p.light) z.lights.push(p.light); else out.push(p.obj); } });
        c.glass.forEach(function (g) { if (g.userData.glass && g.userData.glass.label === o) z.glass.push(g); });
        return;
      }
      if (o.lens && o.inner) { z.lights.push(o); return; }
      if (o.isObject3D) { if (o.userData.glass) z.glass.push(o); else if (c.wheels.indexOf(o) >= 0) z.wheels.push(o); else out.push(o); }
    });
    return out;
  }
  function deriveZones(c) {
    var m = c.meta, list = [], byId = {};
    (m.zones === false ? [] : autoZones(c)).forEach(function (z) { byId[z.id] = z; list.push(z); });
    (c.zoneDefs || []).forEach(function (d) {
      var z = byId[d.id];
      if (d.remove) {
        if (z) { list.splice(list.indexOf(z), 1); delete byId[d.id]; }
        /* remover farol_d também remove os grupos extras do mesmo lado (farol_d_2...) */
        list.slice().forEach(function (q) { if (q.id.indexOf(d.id + "_") === 0 && /^\d+$/.test(q.id.slice(d.id.length + 1))) { list.splice(list.indexOf(q), 1); delete byId[q.id]; } });
        return;
      }
      if (z) { var o0 = z.objs || []; Object.assign(z, d); z.objs = d.objs ? (d.replace ? d.objs : o0.concat(d.objs)) : o0; }
      else { z = Object.assign({ type: "painel" }, d); byId[d.id] = z; list.push(z); }
    });
    var inv = gInvOf(c), F = m.front, R = m.rear, W = m.W || 1.7, owner = new Map();
    /* zona criada (ou refinada como peça/roda) só com peças, sem caixa: a caixa vem das próprias peças */
    (c.zoneDefs || []).forEach(function (d) {
      var z = byId[d.id]; if (!z || d.remove || d.box || !d.objs || !d.objs.length) return;
      if (z.box && !d.fit && !(z.type === "peca" || z.type === "roda")) return;
      var tmp = { lights: [], glass: [], wheels: [] }, os = resolveObjs(c, d.objs, tmp), bb = new THREE.Box3();
      os.concat(tmp.glass, tmp.wheels).forEach(function (o) { bb.union(gBox(c, o, inv)); });
      tmp.lights.forEach(function (Lt) { bb.union(lightBoxOf(c, Lt, inv)); });
      if (z.box && z.type === "roda") (z.wheels || []).forEach(function (w) { bb.union(gBox(c, w, inv)); });
      if (bb.isEmpty()) return; bb.expandByScalar(0.05);
      if (z.box && z.type === "peca" && !d.fit) { var B0 = z.box; bb.union(new THREE.Box3(new V3(B0.x0, B0.y0, B0.z0), new V3(B0.x1, B0.y1, B0.z1))); }
      z.box = nbox(bb);
    });
    list = list.filter(function (z) { return z.box && z.n; });
    list.forEach(function (z) {
      z.glass = (z.glass || []).slice(); z.lights = (z.lights || []).slice(); z.wheels = (z.wheels || []).slice(); z.tags = z.tags || [];
      z.own = resolveObjs(c, z.objs, z);
      if (z.plastic == null && (c.meta.kind === "bike" || c.meta.kind === "quad") && (z.fxKey === "carenagem" || z.fxKey === "banco")) z.plastic = true;
      if (z.plastic) z.noFlap = true;
      var cen = bCen(z.box);
      if (z.side == null) z.side = cen.z < -W * 0.2 ? -1 : cen.z > W * 0.2 ? 1 : 0;
      z.dir = parseDir(z.dir) || (z.side ? new V3(0, 0, -z.side) : cen.x > F - 0.2 * (F - R) ? new V3(-1, 0, 0) : cen.x < R + 0.2 * (F - R) ? new V3(1, 0, 0) : new V3(0, -1, 0));
      z.w = z.w || ZW[z.type] || 1; z.internal = z.type === "interno"; z.h = 100;
      if (z.side < 0 && z.tags.indexOf("esquerda") < 0) z.tags.push("esquerda"); if (z.side > 0 && z.tags.indexOf("direita") < 0) z.tags.push("direita");
      z.own.forEach(function (o) { owner.set(o, z); });
      z.glass.forEach(function (o) { if (!owner.has(o)) owner.set(o, z); });
      z.wheels.forEach(function (o) { owner.set(o, z); });
      z.lights.forEach(function (Lt) { if (Lt.g) owner.set(Lt.g, z); Lt.lens.concat(Lt.inner).forEach(function (o) { owner.set(o, z); }); });
    });
    /* vidros sem zona própria vão para a zona de painel que os contém (cabine de avião, nariz de helicóptero) */
    c.glass.forEach(function (g) {
      if (owner.has(g) || !g.parent || !g.userData.glass || g.userData.ghost) return; var cg = gBox(c, g, inv).getCenter(new V3()), best = null;
      list.forEach(function (z) { if (z.internal || z.type === "roda" || z.type === "luz") return; if (inB(z.box, cg.x, cg.y, cg.z, 0.05) && (!best || bVol(z.box) < bVol(best.box))) best = z; });
      if (best) { best.glass.push(g); owner.set(g, best); }
    });
    /* peças soltas (filhos de c.g) entram na menor zona "peca" que as contém */
    var pecas = list.filter(function (z) { return z.type === "peca"; });
    if (pecas.length) c.g.children.forEach(function (o) {
      if (owner.has(o) || o.userData.decal || o.isSprite || o.userData.glass || c.wheels.indexOf(o) >= 0) return;
      var bb = gBox(c, o, inv); if (bb.isEmpty()) return; var cen = bb.getCenter(new V3()), sz = bb.getSize(new V3()), best = null;
      pecas.forEach(function (z) {
        var B = z.box; if (!inB(B, cen.x, cen.y, cen.z, 0.02)) return;
        if (sz.x > (B.x1 - B.x0) * 1.6 + 0.1 || sz.y > (B.y1 - B.y0) * 1.6 + 0.1 || sz.z > (B.z1 - B.z0) * 1.6 + 0.1) return;
        if (!best || bVol(B) < bVol(best.box)) best = z;
      });
      if (best) { best.own.push(o); owner.set(o, best); c.lights.forEach(function (Lt) { if (Lt.g === o && best.lights.indexOf(Lt) < 0) best.lights.push(Lt); }); }
    });
    /* retrovisores: peças pequenas fora da largura da carroceria, na altura da cintura, junto da porta dianteira */
    list.forEach(function (z) {
      if (!z.mirror) return; z.mirrors = [];
      var B = z.box, belt = m.belt || 1;
      c.g.children.forEach(function (o) {
        if (owner.has(o) || !o.isMesh || o.userData.decal) return;
        var bb = gBox(c, o, inv), cen = bb.getCenter(new V3()), sz = bb.getSize(new V3());
        if (Math.max(sz.x, sz.y, sz.z) > 0.6) return;
        if (Math.sign(cen.z) !== z.side || Math.abs(cen.z) < W / 2 + 0.015 || cen.y < belt - 0.15 || cen.y > belt + 0.4 || cen.x < B.x1 - 0.55 || cen.x > B.x1 + 0.25) return;
        z.mirrors.push(o); owner.set(o, z);
      });
      /* a carcaça e o espelho ficam junto do braço já achado (o miolo pode ficar dentro da largura da carroceria) */
      if (z.mirrors.length) {
        var mb = new THREE.Box3(); z.mirrors.forEach(function (o) { mb.union(gBox(c, o, inv)); }); mb.expandByScalar(0.05);
        c.g.children.forEach(function (o) {
          if (owner.has(o) || !o.isMesh || o.userData.decal || o.userData.glass) return;
          var bb = gBox(c, o, inv), sz = bb.getSize(new V3()); if (Math.max(sz.x, sz.y, sz.z) > 0.3 || !mb.intersectsBox(bb)) return;
          z.mirrors.push(o); owner.set(o, z);
        });
      }
    });
    list.forEach(function (z) {
      var B = z.box;
      z.map = z.map || [Math.max(B.x0, R - 0.3), Math.min(B.x1, F + 0.3), Math.max(B.z0, -W / 2 - 0.35), Math.min(B.z1, W / 2 + 0.35)];
    });
    carMap(c, list);
    c.zOwner = owner;
    return list;
  }
  /* mapa visto de cima mais legível para carro: porta na borda, vidro lateral para dentro, teto no meio */
  function carMap(c, list) {
    var m = c.meta, W = m.W || 1.7, hw = W / 2, gh = m.gh;
    if ((m.kind || "car") !== "car" || !gh || gh.fb == null) return;
    list.forEach(function (z) {
      if (z.mapSet) return; var B = z.box, s = z.side;
      if (z.type === "porta" || /^paralama|^lateral/.test(z.id)) z.map = [B.x0, B.x1, s < 0 ? -hw : hw - 0.16, s < 0 ? -hw + 0.16 : hw];
      else if (z.type === "vidro" && s) z.map = [B.x0, B.x1, s < 0 ? -hw + 0.17 : hw - 0.3, s < 0 ? -hw + 0.3 : hw - 0.17];
      else if (z.id === "teto") z.map = [Math.min(gh.rt, gh.rb + 0.3), Math.max(gh.ft, gh.fb - 0.3), -hw + 0.31, hw - 0.31];
      else if (z.type === "vidro" && z.tags.indexOf("parabrisa") >= 0) z.map = [Math.max(gh.ft, gh.fb - 0.3), gh.fb + 0.02, -hw + 0.31, hw - 0.31];
      else if (z.type === "vidro") z.map = [B.x0 - 0.02, Math.min(gh.rt, gh.rb + 0.3), -hw + 0.31, hw - 0.31];
      else if (z.id === "capo" || z.id === "tampa" || z.id === "cacamba") z.map = [Math.max(B.x0, z.id === "capo" ? gh.fb : -1e9), Math.min(B.x1, z.id === "capo" ? 1e9 : gh.rb), -hw + 0.17, hw - 0.17];
      else if (z.type === "parachoque" || /^parachoque/.test(z.id)) z.map = [z.id === "parachoque_d" ? m.front - 0.2 : m.rear - 0.02, z.id === "parachoque_d" ? m.front + 0.02 : m.rear + 0.2, -hw, hw];
      else if (z.type === "roda") { var w = z.wheels[0], r = (w && w.userData.r) || 0.3; if (w) z.map = [w.position.x - r * 0.85, w.position.x + r * 0.85, w.position.z < 0 ? -hw - 0.2 : hw - 0.02, w.position.z < 0 ? -hw + 0.02 : hw + 0.2]; }
      else if (z.type === "luz") z.map = [Math.max(B.x0, m.rear - 0.02), Math.min(B.x1, m.front + 0.02), Math.max(B.z0, -hw), Math.min(B.z1, hw)];
    });
  }
  function zonesOf(c) { if (!c.zones) c.zones = deriveZones(c); return c.zones; }
  ZG.zonesOf = zonesOf;
  function ownerOf(c, o) { var own = c.zOwner; if (!own) return null; for (var q = o; q && q !== c.g; q = q.parent) if (own.has(q)) return own.get(q); return null; }
  ZG.zoneOwner = ownerOf;

  /* ---- materiais de dano ---- */
  function dmat(hex, o) { return CM(hex, Object.assign({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3, side: DS }, o || {})); }
  var DM = {
    /* sem mapa de ambiente, metal com metalness alto fica preto e o lascado parece furo de bala: metal claro e pouco metálico */
    fine: dmat("#b9bec0", { metalness: 0.3, roughness: 0.45 }),
    deep: dmat("#d6dadc", { metalness: 0.35, roughness: 0.35 }),
    primer: dmat("#8a8d8b", { roughness: 0.95 }),
    metal: dmat("#c3c7ca", { metalness: 0.35, roughness: 0.38 }),
    rust: dmat("#6b3a1e", { roughness: 1 }),
    rust2: dmat("#46220f", { roughness: 1 }),
    hole: dmat("#0a0a0b", { roughness: 1 }),
    edge: dmat("#c9cdd0", { metalness: 0.45, roughness: 0.3 }),
    seam: dmat("#060607", { roughness: 1 }),
    soot: CM("#14110f", { roughness: 1, transparent: true, opacity: 0.62, depthWrite: false, side: DS, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }),
    scrape: CM("#1b1a19", { roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
  };
  ZG.DMG_MAT = DM;
  var _zq = new THREE.Quaternion(), _zq2 = new THREE.Quaternion(), _zz = new V3(0, 0, 1);
  function orientDecal(m, p, n, ang) { _zq.setFromUnitVectors(_zz, n); _zq2.setFromAxisAngle(n, ang || 0); m.quaternion.copy(_zq2.multiply(_zq)); m.position.copy(p).addScaledVector(n, 0.004); }
  function decalMesh(c, geo, mat, p, n, ang, obj) {
    var m = c.add(geo, mat, 0, 0, 0); m.castShadow = false; m.receiveShadow = false; m.userData.decal = true; m.raycast = function () {}; orientDecal(m, p, n, ang);
    if (obj && obj.parent && obj.parent !== c.g) { c.root.updateMatrixWorld(true); obj.parent.attach(m); }
    return m;
  }
  function blobGeo(r, rnd, jag, ell) {
    var s = new THREE.Shape(), nz = vnoise(Math.floor(rnd() * 997)), N = 18, e = ell || 1;
    for (var k = 0; k <= N; k++) { var a = k / N * PI * 2, rr = r * (0.55 + 0.6 * nz(Math.cos(a) * 1.7 + 3, Math.sin(a) * 1.7 + 3)) * (jag && k % 2 ? 0.7 : 1); s[k ? "lineTo" : "moveTo"](Math.cos(a) * rr * e, Math.sin(a) * rr); }
    return new THREE.ShapeGeometry(s);
  }
  /* metal rasgado: buraco escuro com borda viva de dentes metálicos que se dobram para fora */
  function tearDecal(c, p, n, r, rnd, obj) {
    var N = 13, pts = [];
    for (var k = 0; k < N; k++) { var a = k / N * PI * 2 + (rnd() - 0.5) * 0.3, rr = r * (k % 2 ? 0.42 + rnd() * 0.25 : 0.8 + rnd() * 0.35); pts.push([Math.cos(a) * rr * 1.25, Math.sin(a) * rr]); }
    var s = new THREE.Shape(); pts.forEach(function (q, i) { s[i ? "lineTo" : "moveTo"](q[0] * 0.86, q[1] * 0.86); });
    var hole = decalMesh(c, new THREE.ShapeGeometry(s), DM.hole, p, n, rnd() * 6);
    var hp = hole.parent;
    var pos = [];
    pts.forEach(function (q, i) {
      var q2 = pts[(i + 1) % N], ox = q[0] * 1.12, oy = q[1] * 1.12;
      pos.push(q[0] * 0.86, q[1] * 0.86, 0, q2[0] * 0.86, q2[1] * 0.86, 0, ox, oy, 0.025 + rnd() * 0.03);
    });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    var e = c.add(g, DM.edge, 0, 0, 0); e.castShadow = false; e.userData.decal = true; e.raycast = function () {}; e.quaternion.copy(hole.quaternion); e.position.copy(hole.position);
    if (obj && obj.parent && obj.parent !== c.g) { c.root.updateMatrixWorld(true); obj.parent.attach(hole); obj.parent.attach(e); }
    void hp; return hole;
  }

  /* ---- superfície dentro da caixa: raios de fora para dentro ---- */
  var _zr = new THREE.Raycaster();
  function zoneCands(c, z, inv, glassToo) {
    var out = [];
    c.g.traverse(function (o) {
      if (!o.isMesh || o.userData.decal || o.userData.ghost || !o.geometry || o.isSprite) return;
      for (var q = o; q && q !== c.g; q = q.parent) if (!q.visible) return;
      if (o.userData.glass && !glassToo) return;
      var ow = ownerOf(c, o); if (ow && ow !== z) return;
      if (!skinOK(c, z, o, ow)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (bInter(z.box, gBox(c, o, inv))) out.push(o);
    });
    return out;
  }
  /* decalques só na lataria: casca, pintura, peças da própria zona (ou qualquer malha com anyMesh/peca) */
  var _dsetC = new WeakMap();
  function skinOK(c, z, o, ow) {
    if (ow === z || z.anyMesh || z.type === "peca" || z.type === "roda") return true;
    if (c.paints && c.paints.has(o.material)) return true;
    var ds = _dsetC.get(c.deform); if (!ds) { ds = new Set(c.deform); _dsetC.set(c.deform, ds); }
    return ds.has(o) || c.deform.indexOf(o) >= 0;
  }
  function axisOf(d) { var a = Math.abs(d.x) >= Math.abs(d.y) && Math.abs(d.x) >= Math.abs(d.z) ? 0 : Math.abs(d.y) >= Math.abs(d.z) ? 1 : 2; return a; }
  function zoneSurf(c, z, n, rnd, cands, o) {
    o = o || {};
    var out = [], B = z.box, d = z.dir, a = axisOf(d), ax = [0, 1, 2].filter(function (k) { return k !== a; }), Mw = c.g.matrixWorld, inv = gInvOf(c);
    var sg = d.getComponent(a) > 0 ? 1 : -1, outer = sg > 0 ? bLo(B, a) - 0.6 : bHi(B, a) + 0.6, u0 = o.u0 == null ? 0.1 : o.u0, u1 = o.u1 == null ? 0.9 : o.u1;
    for (var t = 0; t < n * 4 && out.length < n; t++) {
      var org = new V3(); org.setComponent(a, outer);
      ax.forEach(function (k) { org.setComponent(k, bLo(B, k) + (bHi(B, k) - bLo(B, k)) * (u0 + (u1 - u0) * rnd())); });
      _zr.set(org.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw)); _zr.far = 0.6 + (bHi(B, a) - bLo(B, a)) + 0.05;
      var hits = _zr.intersectObjects(cands, false);
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i]; if (!h.face) continue;
        var lp = h.point.clone().applyMatrix4(inv); if (!inB(B, lp.x, lp.y, lp.z, 0.02)) break;
        var nn = h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv); if (nn.dot(d) > 0) nn.negate();
        out.push({ p: lp, n: nn, obj: h.object }); break;
      }
    }
    return out;
  }
  /* risco que acompanha a superfície: pontos ao longo do traço são projetados na lataria e o traço para onde a lataria acaba
     (nada de palito reto saindo da curva da carroceria) */
  var _rt = new THREE.Raycaster();
  function scratchPath(c, s, len, ang, cands, B) {
    var n = s.n.clone().normalize(), t = Math.abs(n.y) < 0.9 ? new V3().crossVectors(new V3(0, 1, 0), n) : new V3().crossVectors(new V3(1, 0, 0), n);
    t.normalize().applyAxisAngle(n, ang || 0);
    if (!cands || !cands.length) return null;
    var Mw = c.g.matrixWorld, inv = gInvOf(c), M = Math.max(3, Math.round(len / 0.04)), pts = [];
    function at(k) {
      var q = s.p.clone().addScaledVector(t, len * 0.5 * k / M);
      _rt.set(q.clone().addScaledVector(n, 0.08).applyMatrix4(Mw), n.clone().negate().transformDirection(Mw)); _rt.far = 0.2;
      var h = _rt.intersectObjects(cands, false).find(function (x) { return x.face; }); if (!h) return null;
      var lp = h.point.clone().applyMatrix4(inv); if (B && !inB(B, lp.x, lp.y, lp.z, 0.02)) return null;
      var nn = h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv); if (nn.dot(n) < 0) nn.negate();
      if (nn.dot(n) < 0.55) return null;
      return { p: lp, n: nn };
    }
    var c0 = at(0); if (!c0) return null; pts.push(c0);
    for (var k = 1; k <= M; k++) { var a = at(k); if (!a) break; pts.push(a); }
    for (k = -1; k >= -M; k--) { var b = at(k); if (!b) break; pts.unshift(b); }
    return pts.length >= 3 ? pts : null;
  }
  function ribbonGeo(pts, wd, lift) {
    var pos = [], idx = [], N = pts.length, tg = new V3(), sd = new V3();
    pts.forEach(function (q, i) {
      var a = pts[Math.max(0, i - 1)].p, b = pts[Math.min(N - 1, i + 1)].p; tg.subVectors(b, a).normalize();
      var e = Math.min(i, N - 1 - i) / Math.max(1, (N - 1) / 2), w = wd * 0.5 * (0.25 + 0.75 * Math.min(1, e * 2.2));
      sd.crossVectors(q.n, tg).normalize().multiplyScalar(w);
      var base = q.p.clone().addScaledVector(q.n, lift);
      pos.push(base.x + sd.x, base.y + sd.y, base.z + sd.z, base.x - sd.x, base.y - sd.y, base.z - sd.z);
      if (i) { var j = (i - 1) * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function scratchDecal(c, s, len, wd, mat, ang, cands, B, pts) {
    pts = pts || scratchPath(c, s, len, ang, cands, B);
    if (!pts) return null;
    var m = c.add(ribbonGeo(pts, wd, mat === DM.deep ? 0.0038 : 0.003), mat, 0, 0, 0); m.castShadow = false; m.receiveShadow = false; m.userData.decal = true; m.raycast = function () {};
    if (s.obj && s.obj.parent && s.obj.parent !== c.g) { c.root.updateMatrixWorld(true); s.obj.parent.attach(m); }
    return m;
  }
  /* riscos, tinta lascada (primer cinza e metal), ferrugem e metal rasgado */
  function zoneDecals(c, z, spec, cands) {
    var R = c.rand, need = (spec.fine || 0) + (spec.deep || 0) + (spec.chip || 0) + (spec.rust || 0) + (spec.tear || 0) + (spec.ding || 0) + (spec.soot || 0) + (spec.crater || 0);
    if (!need) return [];
    var S = zoneSurf(c, z, need + 2, R, cands);
    var k = 0, ang0 = R() * PI;
    function nx() { return S.length ? S[(k++) % S.length] : null; }
    var s, i;
    for (i = 0; i < (spec.fine || 0); i++) if ((s = nx())) scratchDecal(c, s, 0.12 + R() * 0.18, 0.0035, DM.fine, ang0 + (R() - 0.5) * 0.4, cands, z.box);
    for (i = 0; i < (spec.deep || 0); i++) if ((s = nx())) { var L2 = 0.18 + R() * 0.26, an = ang0 + (R() - 0.5) * 0.5, pth = scratchPath(c, s, L2, an, cands, z.box); if (pth) { scratchDecal(c, s, L2, 0.014, DM.primer, an, cands, z.box, pth); scratchDecal(c, s, L2, 0.005, DM.deep, an, cands, z.box, pth.slice(1, -1).length >= 3 ? pth.slice(1, -1) : pth); } }
    for (i = 0; i < (spec.chip || 0); i++) if ((s = nx())) { var r = 0.025 + R() * 0.035; decalMesh(c, blobGeo(r, R), DM.primer, s.p, s.n, R() * 6, s.obj); var mm = decalMesh(c, blobGeo(r * 0.55, R), DM.metal, s.p.clone().addScaledVector(s.n, 0.0008), s.n, R() * 6, s.obj); void mm; }
    for (i = 0; i < (spec.rust || 0); i++) if ((s = nx())) { var rr2 = 0.05 + R() * 0.08; decalMesh(c, blobGeo(rr2, R, false, 1.4), DM.rust, s.p, s.n, R() * 6, s.obj); decalMesh(c, blobGeo(rr2 * 0.5, R), DM.rust2, s.p.clone().addScaledVector(s.n, 0.0008), s.n, R() * 6, s.obj); }
    /* fuligem (queimado de impacto) e cratera de impacto (anel de metal com miolo escuro): blindagem e casco */
    for (i = 0; i < (spec.soot || 0); i++) if ((s = nx())) decalMesh(c, blobGeo(0.14 + R() * 0.12, R, false, 1.5), DM.soot, s.p, s.n, R() * 6, s.obj);
    for (i = 0; i < (spec.crater || 0); i++) if ((s = nx())) { var rc = 0.035 + R() * 0.035; decalMesh(c, blobGeo(rc * 1.5, R, true), DM.metal, s.p, s.n, R() * 6, s.obj); decalMesh(c, blobGeo(rc * 0.8, R), DM.hole, s.p.clone().addScaledVector(s.n, 0.0008), s.n, R() * 6, s.obj); }
    var tears = [];
    for (i = 0; i < (spec.tear || 0); i++) if ((s = nx())) tears.push(tearDecal(c, s.p, s.n, 0.07 + R() * 0.06, R, s.obj));
    return S;
  }

  /* ---- amassado mascarado pela caixa (segue o painel) ---- */
  function sm(t) { return smooth(t); }
  function subdivIn(geo, rel, B, maxLen) {
    var a = geo.attributes.position.array, out = [], v = new V3(), e = 0.15;
    function d(p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
    function mid(p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]; }
    function tri(A, Bv, C, depth) {
      var ab = d(A, Bv), bc = d(Bv, C), ca = d(C, A), mx = Math.max(ab, bc, ca);
      if (mx <= maxLen || depth > 9) { out.push(A[0], A[1], A[2], Bv[0], Bv[1], Bv[2], C[0], C[1], C[2]); return; }
      if (mx === ab) { var D = mid(A, Bv); tri(A, D, C, depth + 1); tri(D, Bv, C, depth + 1); }
      else if (mx === bc) { var E2 = mid(Bv, C); tri(A, Bv, E2, depth + 1); tri(A, E2, C, depth + 1); }
      else { var F2 = mid(C, A); tri(A, Bv, F2, depth + 1); tri(F2, Bv, C, depth + 1); }
    }
    for (var i = 0; i < a.length; i += 9) {
      var A = [a[i], a[i + 1], a[i + 2]], Bv = [a[i + 3], a[i + 4], a[i + 5]], C = [a[i + 6], a[i + 7], a[i + 8]];
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      [A, Bv, C].forEach(function (p) { v.set(p[0], p[1], p[2]).applyMatrix4(rel); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); });
      if (x1 < B.x0 - e || x0 > B.x1 + e || y1 < B.y0 - e || y0 > B.y1 + e || z1 < B.z0 - e || z0 > B.z1 + e) out.push(A[0], A[1], A[2], Bv[0], Bv[1], Bv[2], C[0], C[1], C[2]);
      else tri(A, Bv, C, 0);
    }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3)); g.userData.crease = true; g.userData.p0 = null; return g;
  }
  /* malhas que esta zona pode amassar: casca (c.deform), pintura, as próprias peças e, com anyMesh, qualquer malha */
  function dentTargets(c, z, inv) {
    var dset = new Set(c.deform), out = [];
    c.g.traverse(function (o) {
      if (!o.isMesh || o.userData.decal || o.userData.ghost || !o.geometry || !o.geometry.attributes.position) return;
      for (var q = o; q && q !== c.g; q = q.parent) if (!q.visible) return;
      var ow = ownerOf(c, o), isG = !!o.userData.glass;
      if (isG && !(z.alsoGlass || ow === z)) return;
      if (ow && ow !== z && !(isG && z.alsoGlass)) return;
      var ok = dset.has(o) || (c.paints && c.paints.has(o.material)) || ow === z || z.anyMesh;
      if (!ok) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (!bInter(z.box, gBox(c, o, inv))) return;
      out.push({ o: o, deform: dset.has(o) });
    });
    return out;
  }
  /* dents: [{ u, v (centro, coordenadas tangentes absolutas), ru, rv (raios em m), depth }], crease: { v, w, depth } */
  function zoneDent(c, z, dents, dirty, opt) {
    opt = opt || {};
    var B = z.box, d = z.dir, a = axisOf(d), ax = [0, 1, 2].filter(function (k) { return k !== a; }), sg = d.getComponent(a) > 0 ? 1 : -1;
    var outer = sg > 0 ? bLo(B, a) : bHi(B, a), depthA = bHi(B, a) - bLo(B, a), m = c.meta;
    var hu = (bHi(B, ax[0]) - bLo(B, ax[0])) / 2, hv = (bHi(B, ax[1]) - bLo(B, ax[1])) / 2, cu = bLo(B, ax[0]) + hu, cv = bLo(B, ax[1]) + hv;
    var C = new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clear || 0.3) + (m.bodyH || 0.6) * 0.5, 0);
    var edge = opt.edge || 0.28;
    function field(p) {
      if (!inB(B, p.x, p.y, p.z, 0)) return 0;
      var u = p.getComponent(ax[0]), v = p.getComponent(ax[1]), su = (u - cu) / hu, sv = (v - cv) / hv;
      var mask = sm((1 - Math.abs(su)) / edge) * sm((1 - Math.abs(sv)) / edge);
      var tin = Math.abs(p.getComponent(a) - outer) / Math.max(0.05, depthA), md = 1 - sm((tin - 0.5) / 0.5);
      var amt = 0;
      dents.forEach(function (D) {
        var r = Math.hypot((u - D.u) / D.ru, (v - D.v) / D.rv); if (r < 1) amt = Math.max(amt, D.depth * sm(1 - r) * (1 + 0.12 * Math.sin(u * 9.1 + v * 5.3 + D.ph)));
      });
      if (opt.crease) { var cr = opt.crease, t = 1 - Math.abs(v - cr.v) / cr.w; if (t > 0) amt = Math.max(amt, cr.depth * sm(t) * sm((1 - Math.abs(su)) / 0.45)); }
      amt *= mask * md;
      var lim = -((p.x - C.x) * d.x + (p.y - C.y) * d.y + (p.z - C.z) * d.z) - 0.05;
      return Math.max(0, Math.min(amt, lim));
    }
    var inv = gInvOf(c), T = opt.targets || dentTargets(c, z, inv), rel = new THREE.Matrix4(), irel = new THREE.Matrix4(), v = new V3();
    T.forEach(function (t) {
      var msh = t.o, g = msh.geometry;
      rel.multiplyMatrices(inv, msh.matrixWorld);
      if (!t.deform && !msh.userData.zCloned) { g = msh.geometry = g.clone(); msh.userData.zCloned = true; }
      var nonIdx = !g.index, onlyPos = Object.keys(g.attributes).every(function (k) { return k === "position" || k === "normal"; });
      if (t.deform && nonIdx && onlyPos && !msh.userData.glass && !opt.noSub) { var ng = subdivIn(g, rel, B, opt.sub || 0.075); g.dispose(); g = msh.geometry = ng; ng.computeBoundingSphere(); ng.computeBoundingBox(); dirty.add(msh); }
      irel.copy(rel).invert();
      var pos = g.attributes.position, changed = false;
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(rel);
        var f = field(v); if (f <= 1e-5) continue;
        v.addScaledVector(d, f); if (opt.extra) opt.extra(v, f);
        v.applyMatrix4(irel); pos.setXYZ(i, v.x, v.y, v.z); changed = true;
      }
      if (opt.extraAll) { for (var j = 0; j < pos.count; j++) { v.fromBufferAttribute(pos, j).applyMatrix4(rel); if (opt.extraAll(v)) { v.applyMatrix4(irel); pos.setXYZ(j, v.x, v.y, v.z); changed = true; } } }
      if (changed) { pos.needsUpdate = true; g.computeBoundingSphere(); g.computeBoundingBox(); dirty.add(msh); }
    });
    /* peças rígidas (frisos, maçanetas, forro, placa) acompanham o campo no centro delas */
    var dset = new Set(c.deform), moved = [];
    c.g.children.forEach(function (o) {
      if (dset.has(o) || o.userData.noFollow || o.userData.decal || o.isSprite || o.userData.glass) return;
      if (!(o.isMesh || (o.isGroup && o.userData.rigid))) return;
      var ow = ownerOf(c, o); if (ow && ow !== z) return;
      if (T.some(function (t) { return t.o === o; })) return;
      var bb = gBox(c, o, inv); if (bb.isEmpty()) return; var sz = bb.getSize(new V3()); if (Math.max(sz.x, sz.y, sz.z) > 1.4) return;
      var cen = bb.getCenter(new V3()), f = field(cen); if (f <= 1e-4) return;
      o.position.addScaledVector(d, f); moved.push(o);
    });
    return { field: field, moved: moved, ax: ax, a: a, cu: cu, cv: cv, hu: hu, hv: hv, outer: outer };
  }
  /* corta a pele dentro de um retângulo da zona; devolve a peça recortada (ou null). rect: [u0, u1, v0, v1] absolutos */
  function cutPanel(c, z, rect, keep, dirty, o) {
    o = o || {};
    var B = z.box, d = z.dir, a = axisOf(d), ax = [0, 1, 2].filter(function (k) { return k !== a; }), inv = gInvOf(c), outN = d.clone().negate();
    var T = dentTargets(c, z, inv).filter(function (t) { return !t.o.userData.glass && (t.deform || z.cutAll || z.anyMesh || (c.paints && c.paints.has(t.o.material))); });
    var pieces = [], rel = new THREE.Matrix4(), v = new V3(), nv = new V3(), nm = new THREE.Matrix3();
    T.forEach(function (t) {
      var msh = t.o, g = msh.geometry; if (!g.attributes.position.count) return;
      rel.multiplyMatrices(inv, msh.matrixWorld); nm.getNormalMatrix(rel);
      var bb = gBox(c, msh, inv), whole = bb.min.x >= B.x0 - 0.02 && bb.max.x <= B.x1 + 0.02 && bb.min.y >= B.y0 - 0.02 && bb.max.y <= B.y1 + 0.02 && bb.min.z >= B.z0 - 0.02 && bb.max.z <= B.z1 + 0.02;
      if (whole && !t.deform) { pieces.push({ mesh: msh, whole: true }); return; }
      var test = { tag: "peca",
        sel: o.anyN || z.cutAll ? null : function (n) { nv.copy(n).applyMatrix3(nm).normalize(); return nv.dot(outN) > 0.3; },
        sdf: function (x, y, zz) {
          v.set(x, y, zz).applyMatrix4(rel); var q = -1e9;
          q = Math.max(q, rect[0] - v.getComponent(ax[0]), v.getComponent(ax[0]) - rect[1], rect[2] - v.getComponent(ax[1]), v.getComponent(ax[1]) - rect[3]);
          q = Math.max(q, bLo(B, a) - v.getComponent(a), v.getComponent(a) - bHi(B, a));
          return q;
        } };
      var r = cutGeo(g, [test]), cg = r.cut.peca;
      if (!cg || !cg.attributes.position.count) return;
      g.dispose(); msh.geometry = r.geo; r.geo.computeBoundingSphere(); r.geo.computeBoundingBox(); dirty.add(msh);
      if (!keep) { cg.dispose(); pieces.push({ cut: true }); return; }
      var pm = new THREE.Mesh(cg, msh.material); pm.castShadow = true; pm.receiveShadow = true;
      rel.decompose(pm.position, pm.quaternion, pm.scale); c.g.add(pm); pm.updateMatrixWorld(true);
      pieces.push({ mesh: pm, cut: true });
    });
    return pieces;
  }
  /* agrupa malhas num pivô (em coordenadas de c.g) mantendo a posição no mundo */
  function pivotOf(c, objs, at) {
    var piv = new THREE.Group(); piv.position.copy(at); piv.userData.rigid = true; piv.userData.noFollow = true; c.g.add(piv); c.root.updateMatrixWorld(true);
    objs.forEach(function (o) { if (o && o.parent) { piv.attach(o); o.traverse(function (x) { x.userData.noFollow = true; }); var di = c.deform.indexOf(o); if (di >= 0) c.deform.splice(di, 1); } });
    return piv;
  }
  function hideObj(c, o) { if (!o) return; o.visible = false; c.parts.forEach(function (p) { if (p.obj === o) p.done = true; }); }

  /* ---- vidros ---- */
  function glassPt(c, g, rnd) { g.geometry.computeBoundingBox(); var bb = g.geometry.boundingBox.clone().applyMatrix4(g.matrix), s = bb.getSize(new V3()); return new V3(bb.min.x + s.x * (0.3 + rnd() * 0.4), bb.min.y + s.y * (0.3 + rnd() * 0.4), bb.min.z + s.z * (0.3 + rnd() * 0.4)); }
  function glassIn(c, g) { var p = glassPt(c, g, function () { return 0.5; }), m = c.meta; return new V3(((m.front + m.rear) / 2) - p.x, 0, -p.z).normalize(); }
  function glassBand(c, z, g, b) {
    var G = g.userData.glass; if (!G || !g.parent) return; var R = c.rand, bullet = c.meta.bullet;
    if (b === 1) crackGlass(c, g, glassPt(c, g, R), 0.2, 0.26);
    else if (b === 2) crackGlass(c, g, glassPt(c, g, R), 1.0);
    else if (b === 3) {
      if (G.type === "laminado" || bullet) { for (var i = 0; i < 3; i++) crackGlass(c, g, glassPt(c, g, R), 1.2); burst(c, "caco", c.toFx(glassPt(c, g, R)), 10, { speed: 1.2 }); }
      else shatterGlass(c, g, 1.0, glassIn(c, g));
    } else if (b === 4) {
      if (!G.broken && G.type !== "laminado" && !bullet) shatterGlass(c, g, 1.0, glassIn(c, g));
      else burst(c, "caco", c.toFx(glassPt(c, g, R)), 14, { speed: 1.4 });
      G.broken = true; g.visible = false;
    }
  }
  /* ---- faróis e lanternas ---- */
  var crackLensCache = new Map(), crackTexC = null;
  function crackTex() {
    if (crackTexC) return crackTexC;
    var cv = document.createElement("canvas"); cv.width = cv.height = 128; var x = cv.getContext("2d"), r = rng(77);
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, 128, 128);
    for (var pass = 0; pass < 2; pass++) {
      x.strokeStyle = pass ? "rgba(255,255,255,1)" : "rgba(30,30,30,0.9)"; x.lineWidth = pass ? 1 : 2.4;
      var rr = rng(77); for (var i = 0; i < 9; i++) { var a = i / 9 * PI * 2 + rr() * 0.4, px = 60, py = 66; x.beginPath(); x.moveTo(px, py); for (var k = 1; k < 5; k++) { a += (rr() - 0.5) * 0.5; px += Math.cos(a) * 14; py += Math.sin(a) * 14; x.lineTo(px, py); } x.stroke(); }
    }
    void r; crackTexC = new THREE.CanvasTexture(cv); return crackTexC;
  }
  function crackLens(mat) {
    if (crackLensCache.has(mat)) return crackLensCache.get(mat);
    var m2 = mat.clone(); m2.map = crackTex(); m2.needsUpdate = true; crackLensCache.set(mat, m2); return m2;
  }
  function lightBand(c, z, Lt, b) {
    if (!Lt || Lt.broken === "gone") return;
    var dir = new V3(Lt.kind === "lanterna" ? 1 : -1, 0, 0);
    if (b === 1) { Lt.lens.forEach(function (m) { if (m.material && !Array.isArray(m.material)) m.material = crackLens(m.material); }); (Lt.halo || []).forEach(function (h) { h.material = h.material.clone(); h.material.opacity *= 0.55; }); }
    else if (b >= 2) {
      breakLight(c, Lt, dir);
      if (b === 3 && Lt.g) { Lt.g.rotation.x += (c.rand() - 0.5) * 0.5; Lt.g.rotation.z += -0.25; Lt.g.position.y -= 0.035; Lt.g.position.addScaledVector(dir, -0.02); Lt.g.userData.noFollow = true; }
      if (b === 4) { if (Lt.g) Lt.g.visible = false; else Lt.lens.concat(Lt.inner).forEach(function (m) { m.visible = false; }); Lt.broken = "gone"; }
    }
  }
  /* ---- rodas: murcho achata a parte de baixo do pneu; sem pneu, roda no aro ---- */
  function tireMeshes(w) { var out = []; w.traverse(function (o) { if (o.isMesh && o.material === MT.rubber) out.push(o); }); return out; }
  function flattenTire(w, k) {
    var r = w.userData.r || 0.3, yb = -r * (1 - k), v = new V3(), M = new THREE.Matrix4(), Mi = new THREE.Matrix4();
    tireMeshes(w).forEach(function (t) {
      if (!t.userData.zCloned) { t.geometry = t.geometry.clone(); t.userData.zCloned = true; }
      t.updateMatrix(); M.copy(t.matrix); Mi.copy(M).invert();
      var p = t.geometry.attributes.position;
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(M); if (v.y < yb) { var e = (yb - v.y) / Math.max(0.01, r * k); v.y = yb; v.z *= 1 + 0.25 * Math.min(1, e); v.applyMatrix4(Mi); p.setXYZ(i, v.x, v.y, v.z); } }
      p.needsUpdate = true; t.geometry.computeVertexNormals(); t.geometry.computeBoundingSphere();
    });
  }
  function wheelBand(c, z, w, b) {
    if (!w || !w.parent) return; var r = w.userData.r || 0.3, s = w.position.z >= 0 ? 1 : -1, R = c.rand;
    if (b === 1) {
      for (var i = 0; i < 3; i++) { var a = R() * PI * 2, sc = new THREE.Mesh(new THREE.BoxGeometry(r * 0.35, 0.006, 0.002), DM.deep); sc.position.set(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, s * (r * 0.5 + 0.02)); sc.rotation.z = a + PI / 2; sc.userData.decal = true; w.add(sc); }
    } else if (b === 2) { flattenTire(w, 0.13); c.zDrop.push({ x: w.position.x, z: w.position.z, d: r * 0.13 }); }
    else if (b === 3) { flattenTire(w, 0.24); w.rotation.y += (R() - 0.5) * 0.25; w.rotation.x += s * 0.1; c.zDrop.push({ x: w.position.x, z: w.position.z, d: r * 0.24 }); }
    else if (b === 4) {
      var rr = 0; w.traverse(function (o) { if (!o.isMesh || o.material === MT.rubber) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); var cc = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrix); rr = Math.max(rr, Math.hypot(cc.x, cc.y) + o.geometry.boundingSphere.radius * 0.7); });
      rr = clamp(rr || r * 0.62, r * 0.4, r * 0.85);
      tireMeshes(w).forEach(function (t) { t.visible = false; });
      c.zDrop.push({ x: w.position.x, z: w.position.z, d: r - rr });
      var gp = c.toFx(new V3(w.position.x, 0.02, w.position.z));
      burst(c, "faisca", gp, 14, { speed: 2.4, spread: 1.6 });
      var mk = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.06), DM.scrape); mk.rotation.x = -PI / 2; mk.position.set(gp.x - 0.8, 0.006, gp.z); mk.userData.decal = true; mk.raycast = function () {}; c.fx.add(mk);
    }
  }
  /* ---- trem de pouso de avião: amassado murcha, destruído quebra a perna da frente (nariz no chão), arrancado = pouso de barriga ---- */
  function gearBand(c, z, b) {
    var R = c.rand, ws = z.wheels.filter(function (w) { return w.parent; }), objs = z.own.filter(function (o) { return o.parent; });
    if (!ws.length) return;
    if (b <= 2) { ws.forEach(function (w) { wheelBand(c, z, w, b); }); return; }
    if (b === 3) {
      var xmax = Math.max.apply(null, ws.map(function (w) { return w.position.x; })), front = ws.filter(function (w) { return w.position.x > xmax - 0.3; });
      ws.forEach(function (w) { if (front.indexOf(w) < 0) wheelBand(c, z, w, 2); });
      front.forEach(function (w) {
        var r = w.userData.r || 0.3, near = objs.filter(function (o) { var p = o.position; var bb = gBox(c, o, gInvOf(c)), cen = bb.getCenter(new V3()); void p; return Math.abs(cen.x - w.position.x) < 0.5 && Math.abs(cen.z - w.position.z) < 0.5; });
        var inv = gInvOf(c), top = new V3(w.position.x, w.position.y + r, w.position.z);
        near.forEach(function (o) { var bb = gBox(c, o, inv); top.y = Math.max(top.y, bb.max.y); });
        w.userData.gpos = w.position.clone();
        var piv = pivotOf(c, [w].concat(near), top); piv.rotation.z = 0.75 + R() * 0.25; piv.rotation.x = (R() - 0.5) * 0.3;
        c.zDrop.push({ x: w.position.x, z: w.position.z, d: r * 1.25 });
        burst(c, "faisca", c.toFx(new V3(w.position.x, 0.03, w.position.z)), 10, { speed: 2, spread: 1.4 });
      });
      return;
    }
    /* arrancado: o trem some e o avião assenta de barriga, um pouco de nariz */
    ws.concat(objs).forEach(function (o) { hideObj(c, o); });
    /* hélice parada na horizontal (bateu no chão e o motor morreu) */
    partsOf(c, "helice").forEach(function (hp) {
      var o = hp.obj; if (!o || !o.parent) return; c.spin = c.spin.filter(function (q) { return q.o !== o; });
      var best = 0, by = -1e9; for (var k = 0; k < 12; k++) { o.rotation.x = k / 12 * PI; c.root.updateMatrixWorld(true); var y0 = gBox(c, o, gInvOf(c)).min.y; if (y0 > by + 1e-4) { by = y0; best = o.rotation.x; } }
      o.rotation.x = best; hurtEngine(c, 0.3);
    });
    c.root.updateMatrixWorld(true);
    var inv2 = gInvOf(c), lo = 1e9, xs = 0;
    c.g.traverse(function (o) {
      if (!o.isMesh || o.userData.decal || o.isSprite || !o.geometry || !o.geometry.attributes.position) return;
      for (var q = o; q && q !== c.g; q = q.parent) if (!q.visible) return;
      var bb = gBox(c, o, inv2); if (bb.min.y < lo) { lo = bb.min.y; xs = (bb.min.x + bb.max.x) / 2; }
    });
    if (lo < 1e8 && lo > 0.02) c.g.position.y -= lo - 0.01;
    var m = c.meta, gp = c.toFx(new V3(xs, 0.02, 0));
    burst(c, "faisca", gp, 18, { speed: 2.6, spread: 1.8 });
    var mk = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(4, (m.L || 6) * 0.5), 0.5), DM.scrape); mk.rotation.x = -PI / 2; mk.position.set(gp.x - 1.2, 0.006, gp.z); mk.userData.decal = true; mk.raycast = function () {}; c.fx.add(mk);
  }
  /* ---- zonas internas: motor, radiador, tanque, bateria, assoalho ---- */
  function internalBand(c, z, b) {
    var m = c.meta, p = z.pos ? z.pos.clone() : bCen(z.box), sub = z.sub || z.id, land = ["boat", "plane", "heli"].indexOf(m.kind) < 0;
    if (b === 0) return;
    if (sub === "motor") {
      if (b === 1) hurtEngine(c, 0.8);
      if (b === 2) { hurtEngine(c, 0.55); ZG.addEmitter(c, p.clone().add(new V3(0, 0.3, 0)), "branca", { rate: 2, s: 0.7 }); }
      if (b >= 3) { hurtEngine(c, b === 4 ? 0.05 : 0.25); ZG.addEmitter(c, p.clone().add(new V3(0, 0.3, 0)), "preta", { rate: b === 4 ? 6 : 4 }); if (land) puddle(c, "oleo", p.clone().setY(Math.max(0.2, m.clear || 0.3)), b === 4 ? 0.9 : 0.6); }
      if (b === 4) ZG.addEmitter(c, p.clone().add(new V3(0, 0.15, 0)), "fogo", { rate: 7, s: 0.7 });
      if (b >= 2 && c.hood && !c.hood.noLatch && c.hood.x1 > 0 === p.x > 0) c.hood.latch = Math.max(c.hood.latch, 0.08);
    } else if (sub === "radiador") {
      if (b === 2) ZG.addEmitter(c, p.clone().add(new V3(-0.1, 0.25, 0)), "branca", { rate: 2.5, s: 0.7 });
      if (b >= 3) { ZG.addEmitter(c, p.clone().add(new V3(-0.1, 0.25, 0)), "branca", { rate: b === 4 ? 8 : 5 }); hurtEngine(c, b === 4 ? 0.35 : 0.6); }
    } else if (sub === "tanque") {
      var fu = tankFuel(c, { n: z.n });
      if (fu && land && b >= 2) { var pd = puddle(c, fu, p.clone(), b === 2 ? 0.35 : b === 3 ? 0.95 : 1.4); if (b === 4 && fu === "gasolina") igniteFuel(c, pd); }
      if (b === 4 && !land) ZG.addEmitter(c, p.clone(), "preta", { rate: 3 });
    } else if (sub === "bateria") {
      if (b >= 3) ZG.addEmitter(c, p.clone().add(new V3(0, 0.6, 0)), "preta", { rate: 3 });
      if (b === 4) ZG.addEmitter(c, p.clone().add(new V3(0, 0.15, 0)), "fogo", { rate: 8, s: 0.8 });
    } else if (sub === "assoalho") {
      var ug = m.underG;
      if (b >= 2 && ug) { ug.rotation.z += b === 2 ? 0.012 : 0.03; ug.position.y -= b === 2 ? 0.015 : 0.05; }
      if (b === 4 && ug) { ug.position.y -= 0.06; burst(c, "faisca", c.toFx(new V3(m.rear + 0.6, 0.05, 0)), 12, { speed: 2 }); }
      if (b >= 3 && land) puddle(c, "oleo", new V3(((m.front || 1) + (m.rear || -1)) / 2 + 0.6, 0.2, 0), 0.4);
    }
  }
  /* ---- capô ---- */
  function hoodBand(c, z, b, dirty) {
    var H = c.hood && z.own.indexOf(c.hood.piv) >= 0 ? c.hood : null;
    if (!H) return panelBand(c, z, b, dirty);
    var R = c.rand, inv = gInvOf(c), cands = zoneCands(c, z, inv);
    if (b === 0) { if (z.h < 92) zoneDecals(c, z, { fine: 2 }, cands); return; }  /* intacto (76 a 99): só riscos finos, sem amassar nem destravar */
    if (b === 1) { zoneDecals(c, z, { deep: 3, chip: 3, fine: 2 }, cands); return; }
    if (b === 4) { H.piv.visible = false; c.parts.forEach(function (p) { if (p.kind === "capo") p.done = true; }); c.hood = null; return; }
    var B = z.box, len = B.x1 - B.x0, wz = B.z1 - B.z0;
    var dep = b === 2 ? 0.05 + R() * 0.03 : 0.1 + R() * 0.05;
    zoneDent(c, z, [{ u: B.x0 + len * (0.55 + R() * 0.2), v: (R() - 0.5) * wz * 0.3, ru: len * 0.38, rv: wz * 0.32, depth: dep, ph: R() * 6 }], dirty, { crease: { v: (R() - 0.5) * wz * 0.2, w: 0.08, depth: dep * 0.6 }, noSub: false });
    H.latch = Math.max(H.latch, b === 2 ? 0.15 : 0.28);
    if (b === 3) {
      /* dobrado para cima: a metade da frente sobe em volta de uma linha de vinco */
      var xf = H.x0 + (H.x1 - H.x0) * (0.5 + R() * 0.1), k = 0.55 + R() * 0.2, v = new V3();
      H.piv.children.forEach(function (msh) {
        if (!msh.isMesh) return; msh.updateMatrix(); var M = msh.matrix, Mi = new THREE.Matrix4().copy(M).invert(), p = msh.geometry.attributes.position;
        for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(M); var gx = v.x + H.x0; if (gx > xf) { var t = gx - xf; v.y += t * k * (1 + 0.15 * Math.sin(v.z * 7)); v.x -= t * (1 - Math.cos(Math.atan(k))) * 0.5; } v.applyMatrix4(Mi); p.setXYZ(i, v.x, v.y, v.z); }
        p.needsUpdate = true; msh.geometry.computeBoundingSphere(); dirty.add(msh);
      });
      zoneDecals(c, z, { deep: 3, chip: 2, rust: 2, tear: 1 }, zoneCands(c, z, gInvOf(c)));
    } else zoneDecals(c, z, { deep: 3, chip: 3 }, zoneCands(c, z, gInvOf(c)));
  }
  /* ---- para-choque ---- */
  function bumperBand(c, z, b, dirty) {
    var o = z.own[0]; if (!o || !o.parent) return panelBand(c, z, b, dirty);
    var R = c.rand, inv = gInvOf(c), cands = zoneCands(c, z, inv), bb = gBox(c, o, inv), cen = bb.getCenter(new V3()), sx = cen.x > 0 ? 1 : -1;
    if (b === 0) { if (z.h < 92) zoneDecals(c, z, { fine: 2 }, cands); return; }  /* intacto (76 a 99): o para-choque fica no lugar */
    if (b === 1) { zoneDecals(c, z, { deep: 3, chip: 2 }, cands); return; }
    if (b === 4) { hideObj(c, o); return; }
    zoneDecals(c, z, { deep: 3, chip: 2, rust: b === 3 ? 2 : 0 }, cands);
    var sideHit = R() < 0.5 ? -1 : 1, p = new V3(cen.x, cen.y, sideHit * (bb.max.z - bb.min.z) / 2);
    if (b === 2) { hangBumper(c, o, p); return; }
    /* destruído: caiu e ficou no chão na frente (ou atrás) do veículo, meio torto */
    var di = c.deform.indexOf(o); if (di >= 0) c.deform.splice(di, 1);
    if (o.parent !== c.g) { c.root.updateMatrixWorld(true); c.g.attach(o); }
    var hh = (bb.max.y - bb.min.y) / 2;
    o.position.x += sx * (0.35 + R() * 0.2); o.position.y += (hh + 0.004) - bb.min.y - hh; o.rotation.y += (R() - 0.5) * 0.5; o.rotation.x += (R() - 0.5) * 0.12;
    o.userData.noFollow = true; c.parts.forEach(function (q) { if (q.obj === o) q.done = true; });
  }
  /* ---- peças soltas (moto, rotor, arma, esqui) ---- */
  function pecaBand(c, z, b, dirty) {
    var objs = z.own.filter(function (o) { return o.parent; });
    if (!objs.length) return panelBand(c, z, b, dirty);
    var R = c.rand, inv = gInvOf(c), cands = zoneCands(c, z, inv);
    if (b >= 1 && b <= 3) zoneDecals(c, z, { deep: b + 1, chip: z.plastic ? 0 : b, rust: b === 3 && !z.plastic && !z.noFlap ? 2 : 0 }, cands);
    if (z.lagarta) {
      var tk = z.lagarta;
      if (b === 2) { tk.position.y -= 0.025; }
      if (b === 3) { tk.position.addScaledVector(z.dir, -0.12); tk.position.y -= 0.05; tk.rotation.x += z.side * 0.05; }
      if (b === 4) hideObj(c, tk);
      return;
    }
    if (z.kindPart && b >= 2 && b <= 3) { objs.forEach(function (o) { o.children.forEach(function (ch, i) { if (ch.type === "Group" || ch.isMesh) { ch.rotation.z += (-0.12 - hash(i, 1, 1) * 0.2) * (b - 1); ch.rotation.x += (i % 2 ? 0.15 : -0.15) * (b - 1); } }); }); c.spin = c.spin.filter(function (s) { return objs.indexOf(s.o) < 0; }); return; }
    if (b === 4) { objs.forEach(function (o) { hideObj(c, o); }); c.spin = c.spin.filter(function (s) { return objs.indexOf(s.o) < 0; }); return; }
    if (b < 2) return;
    var m = c.meta, B = z.box, C = new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clear || 0.3) + 0.3, 0);
    var at = z.anchor ? new V3(z.anchor[0], z.anchor[1], z.anchor[2]) : new V3(clamp(C.x, B.x0, B.x1), clamp(C.y, B.y0, B.y1), clamp(C.z, B.z0, B.z1));
    var outv = bCen(B).sub(at); outv.y = 0; if (outv.lengthSq() < 1e-4) outv.set(1, 0, 0); outv.normalize();
    var axis = new V3().crossVectors(new V3(0, 1, 0), outv).normalize(), th = b === 2 ? 0.08 + R() * 0.05 : 0.3 + R() * 0.15;
    var piv = pivotOf(c, objs, at); piv.quaternion.setFromAxisAngle(axis, th); piv.position.y -= b === 3 ? 0.03 : 0.01;
    c.spin = c.spin.filter(function (s) { return objs.indexOf(s.o) < 0; });
  }
  /* cone de cauda entortado: tudo atrás do vinco (cone, deriva, rotor de cauda) gira para baixo em volta do vinco.
     Malhas que cruzam o vinco dobram por vértice; peças inteiras atrás dele giram como corpo rígido. */
  function bendAft(c, z, kx, ky, ang, dirty) {
    var inv = gInvOf(c), q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), ang), K = new V3(kx, ky, 0), v = new V3(), rel = new THREE.Matrix4(), irel = new THREE.Matrix4(), blend = 0.25;
    function rot(p, k) { var a2 = ang * k, cs = Math.cos(a2), sn = Math.sin(a2), dx = p.x - kx, dy = p.y - ky; p.x = kx + dx * cs - dy * sn; p.y = ky + dx * sn + dy * cs; }
    var rigid = [], verts = [];
    c.g.children.forEach(function (o) {
      if (o.userData.decal || o.isSprite || !o.visible) return; var ow = ownerOf(c, o); if (ow && ow !== z && ow.id !== "rotor_cauda" && bCen(ow.box).x > kx) return;
      var bb = gBox(c, o, inv); if (bb.isEmpty() || bb.min.x >= kx) return;
      if (bb.max.x < kx - 0.02 || !o.isMesh) { if (bb.max.x < kx + 0.3) rigid.push(o); }
      else verts.push(o);
    });
    rigid.forEach(function (o) { var p = o.position.clone(); rot(p, 1); o.position.copy(p); o.quaternion.premultiply(q); });
    verts.forEach(function (msh) {
      if (!msh.geometry || !msh.geometry.attributes.position) return;
      if (!msh.userData.zCloned && c.deform.indexOf(msh) < 0) { msh.geometry = msh.geometry.clone(); msh.userData.zCloned = true; }
      msh.updateMatrixWorld(true); rel.multiplyMatrices(inv, msh.matrixWorld); irel.copy(rel).invert();
      var pos = msh.geometry.attributes.position, ch = false;
      for (var i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(rel); if (v.x >= kx) continue; rot(v, sm((kx - v.x) / blend)); v.applyMatrix4(irel); pos.setXYZ(i, v.x, v.y, v.z); ch = true; }
      if (ch) { pos.needsUpdate = true; dirty.add(msh); }
    });
    void K;
  }
  /* ---- painel de lataria (porta, paralama, lateral, teto, tampa, blindagem, casco, asa) ---- */
  function panelBand(c, z, b, dirty) {
    var R = c.rand, inv = gInvOf(c), B = z.box, d = z.dir, a = axisOf(d), ax = [0, 1, 2].filter(function (k) { return k !== a; });
    var u0 = bLo(B, ax[0]), u1 = bHi(B, ax[0]), v0 = bLo(B, ax[1]), v1 = bHi(B, ax[1]), lu = u1 - u0, lv = v1 - v0, depA = bHi(B, a) - bLo(B, a);
    var stiff = clamp(c.meta.stiff || 0, 0, 1) * (z.fxKey === "blindagem" ? 1 : 0.6);
    var dk = 1 - 0.7 * stiff;
    if (b === 0) { if (z.h < 92) zoneDecals(c, z, { fine: 2 }, zoneCands(c, z, inv)); return; }
    if (b === 4) {
      var mg = Math.min(0.05, lu * 0.08, lv * 0.08), rect = [u0 + mg, u1 - mg, v0 + mg, v1 - mg];
      if (z.type === "porta" || z.type === "tampa") rect = [u0 + 0.03, u1 - 0.03, v0 + Math.min(0.08, lv * 0.1), v1 - 0.02];
      var pcs = cutPanel(c, z, rect, false, dirty);
      pcs.forEach(function (q) { if (q.whole) hideObj(c, q.mesh); });
      followersIn(c, z, inv).forEach(function (o) { hideObj(c, o); });
      /* peças com dono (hélice, pilone, sirene) somem inteiras: recortar só a pele deixava pedaços boiando */
      z.own.forEach(function (o) { if (o.parent && c.wheels.indexOf(o) < 0 && !o.userData.glass) hideObj(c, o); });
      c.spin = c.spin.filter(function (sp) { return shown(c, sp.o); });
      if (z.type === "teto") roofOff(c, z, inv);
      if (z.fxKey === "cone" && c.meta.kind === "heli") tailOff(c, z, inv);
      (z.mirrors || []).forEach(function (o) { hideObj(c, o); });
      if (z.type === "porta") windowsOver(c, z, inv).forEach(function (g) { glassBand(c, z, g, 4); });
      zoneDecals(c, z, { rust: 3, deep: 2 }, zoneCands(c, z, gInvOf(c)));
      return;
    }
    var dents = [], opt = {};
    if (b === 1) {
      for (var i = 0; i < 3; i++) dents.push({ u: u0 + lu * (0.2 + R() * 0.6), v: v0 + lv * (0.25 + R() * 0.5), ru: 0.06 + R() * 0.04, rv: 0.06 + R() * 0.04, depth: (0.012 + R() * 0.016) * dk, ph: R() * 6 });
      zoneDent(c, z, dents, dirty, { edge: 0.15 });
      zoneDecals(c, z, { deep: 4, chip: 3, fine: 2 }, zoneCands(c, z, inv));
      return;
    }
    /* amassado segue o painel: elipse alongada no eixo maior, com vinco ao longo dele */
    var longU = lu >= lv, D0 = b === 2 ? 0.06 + R() * 0.06 : 0.15 + R() * 0.15;
    var maxD = Math.max(0.03, Math.min(D0, depA * 0.55, 0.3)) * dk;
    var uc = u0 + lu * (0.4 + R() * 0.2), vc = v0 + lv * (0.4 + R() * 0.2);
    dents.push({ u: uc, v: vc, ru: lu * (longU ? 0.48 : 0.38), rv: lv * (longU ? 0.38 : 0.48), depth: maxD, ph: R() * 6 });
    if (b === 3) dents.push({ u: u0 + lu * (0.2 + R() * 0.6), v: v0 + lv * (0.25 + R() * 0.5), ru: lu * 0.3, rv: lv * 0.3, depth: maxD * 0.8, ph: R() * 6 });
    opt.crease = longU ? null : null;
    if (longU) opt.crease = { v: vc + (R() - 0.5) * lv * 0.15, w: Math.min(0.09, lv * 0.2), depth: maxD * 0.55 };
    if (b === 3) opt.extra = function (p, f) { p.addScaledVector(d, 0.012 * Math.sin(p.getComponent(ax[0]) * 17) * Math.min(1, f / 0.05)); };
    /* porta amassada: a borda de trás da porta fica para fora (fresta desalinhada) */
    if (z.type === "porta" && b >= 2) {
      var hingeHi = z.hinge !== "tras", xe = hingeHi ? B.x0 : B.x1, sideOut = d.clone().negate();
      opt.extraAll = function (p) { if (!inB(B, p.x, p.y, p.z, 0)) return false; var t = 1 - Math.abs(p.x - xe) / 0.12; if (t <= 0) return false; var tin = Math.abs(p.getComponent(a) - (d.getComponent(a) > 0 ? B.z0 : B.z1)); if (tin > 0.2) return false; p.addScaledVector(sideOut, 0.014 * sm(t) * sm((p.y - B.y0) / 0.1) * sm((B.y1 - p.y) / 0.1)); return true; };
    }
    zoneDent(c, z, dents, dirty, opt);
    if (z.fxKey === "cone" && c.meta.kind === "heli") { var kxx = B.x0 + (B.x1 - B.x0) * (b === 2 ? 0.55 : 0.62), kyy = (B.y0 + B.y1) / 2; bendAft(c, z, kxx, kyy, b === 2 ? 0.035 : 0.16, dirty); }
    if (z.mirrors && z.mirrors.length) mirrorHang(c, z, b === 2 ? 0.95 : 1.3);
    if (b === 3) {
      if (z.type === "porta") doorHang(c, z, dirty, inv);
      else if (z.type === "tampa") lidHang(c, z, dirty);
      else if (z.type !== "teto" && !z.noFlap) flapHang(c, z, dirty);
      if (z.type === "porta") windowsOver(c, z, gInvOf(c)).forEach(function (g) { glassBand(c, z, g, 3); });
    }
    var cands = zoneCands(c, z, gInvOf(c));
    /* blindagem quase não amassa e casco de fibra trinca: a faixa aparece pelas marcas (crateras, fuligem, lascas) */
    if (z.fxKey === "blindagem") zoneDecals(c, z, b === 2 ? { crater: 5, soot: 2 } : { crater: 8, soot: 4, tear: 1 }, cands);
    else if (z.fxKey === "casco") zoneDecals(c, z, b === 2 ? { deep: 5, chip: 6 } : { deep: 4, chip: 4, soot: 2, tear: 2 }, cands);
    if (b === 2) zoneDecals(c, z, { deep: 4, chip: 3 }, cands);
    else zoneDecals(c, z, { deep: 4, chip: z.plastic ? 0 : 2, rust: z.plastic ? 0 : 3, tear: z.plastic || z.noFlap || z.type === "porta" || z.type === "tampa" ? 0 : 1 }, cands);
    if (z.type === "porta" && b === 2) doorGap(c, z, b, cands);
  }
  /* teto arrancado: o forro do teto e o que fica preso em cima (giroflex, barra de luz, bagageiro, faróis de teto) saem junto */
  function roofOff(c, z, inv) {
    var B = z.box, top = c.meta.top || B.y1;
    c.g.traverse(function (o) {
      if (!o.isMesh || !o.visible || o.userData.decal || o.userData.glass) return;
      if (o.material === MT.headliner) { var hb = gBox(c, o, inv), hc = hb.getCenter(new V3()); if (inB(B, hc.x, hc.y, hc.z, 0.12)) hideObj(c, o); }
    });
    c.g.children.forEach(function (o) {
      if (!o.visible || o.userData.decal || o.isSprite || o.userData.glass || c.deform.indexOf(o) >= 0 || c.wheels.indexOf(o) >= 0) return;
      var ow = ownerOf(c, o); if (ow && ow !== z) return;
      var bb = gBox(c, o, inv); if (bb.isEmpty()) return; var cen = bb.getCenter(new V3());
      var sz = bb.getSize(new V3()); if (Math.max(sz.x, sz.z) > 2.2) return;
      if ((bb.min.y > top - 0.1 || bb.min.y > B.y0 + (B.y1 - B.y0) * 0.5 - 0.1) && cen.x > B.x0 - 0.1 && cen.x < B.x1 + 0.1 && Math.abs(cen.z) < Math.max(Math.abs(B.z0), Math.abs(B.z1)) + 0.1) hideObj(c, o);
    });
  }
  /* cone de cauda arrancado: tudo atrás do começo do cone (pilone, deriva, rotor de cauda, bequilha) some, de qualquer zona */
  function tailOff(c, z, inv) {
    var kx = z.box.x1 - (z.box.x1 - z.box.x0) * 0.15;
    c.g.children.forEach(function (o) {
      if (!o.visible || o.userData.decal || o.isSprite) return;
      var bb = gBox(c, o, inv); if (bb.isEmpty()) return;
      if (bb.max.x < kx + 0.05) hideObj(c, o);
    });
    c.spin = c.spin.filter(function (sp) { return shown(c, sp.o); });
  }
  function shown(c, o) { for (var q = o; q && q !== c.g; q = q.parent) if (q.visible === false) return false; return !!o; }
  function followersIn(c, z, inv) {
    var dset = new Set(c.deform), out = [];
    c.g.children.forEach(function (o) {
      if (dset.has(o) || o.userData.decal || o.isSprite || o.userData.glass || !o.visible) return;
      if (!(o.isMesh || (o.isGroup && o.userData.rigid))) return;
      var ow = ownerOf(c, o); if (ow && ow !== z) return; if (c.wheels.indexOf(o) >= 0) return;
      var bb = gBox(c, o, inv); if (bb.isEmpty()) return; var cen = bb.getCenter(new V3()), sz = bb.getSize(new V3());
      if (!inB(z.box, cen.x, cen.y, cen.z, 0) || Math.max(sz.x, sz.y, sz.z) > 1.4) return;
      if (sz.getComponent(axisOf(z.dir)) > 0.09) return;  /* só peças finas na direção da lataria (forro, friso, maçaneta, placa) */
      out.push(o);
    });
    return out;
  }
  function windowsOver(c, z, inv) {
    return c.glass.filter(function (g) {
      if (!g.parent || !g.visible) return false; var cen = gBox(c, g, inv).getCenter(new V3());
      return Math.sign(cen.z) === z.side && Math.abs(cen.z) > (c.meta.W || 1.7) * 0.25 && cen.x > z.box.x0 + 0.05 && cen.x < z.box.x1 - 0.05 && cen.y > z.box.y1 - 0.15;
    });
  }
  function doorGap(c, z, b, cands) {
    var B = z.box, xe = z.hinge === "tras" ? B.x1 : B.x0, inv = gInvOf(c), d = z.dir, Mw = c.g.matrixWorld;
    var pts = [];
    for (var k = 0; k < 6; k++) {
      var y = B.y0 + 0.08 + (B.y1 - B.y0 - 0.16) * k / 5, org = new V3(xe + 0.006, y, z.side < 0 ? B.z0 - 0.5 : B.z1 + 0.5);
      _zr.set(org.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw)); _zr.far = 0.5 + (B.z1 - B.z0);
      var h = _zr.intersectObjects(cands, false)[0]; if (h) pts.push(h.point.clone().applyMatrix4(inv).addScaledVector(d, -0.004));
    }
    if (pts.length < 3) return;
    var seam = c.tube(pts, b === 2 ? 0.0045 : 0.006, DM.seam, { seg: 24, rs: 4 }); seam.castShadow = false; seam.userData.decal = true;
  }
  function mirrorHang(c, z, ang) {
    var objs = z.mirrors.filter(function (o) { return o.parent; }); if (!objs.length) return; var inv = gInvOf(c), bb = new THREE.Box3();
    objs.forEach(function (o) { bb.union(gBox(c, o, inv)); });
    var at = new V3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, z.side < 0 ? bb.max.z : bb.min.z);
    var piv = pivotOf(c, objs, at); piv.rotation.x = z.side * -ang; piv.rotation.y = z.side * 0.25;
  }
  /* porta pendurada numa dobradiça: a pele da porta vira peça, gira para fora na dobradiça da frente e cai atrás */
  function doorHang(c, z, dirty, inv) {
    var B = z.box, rect = [B.x0 + 0.03, B.x1 - 0.03, B.y0 + Math.min(0.08, (B.y1 - B.y0) * 0.1), B.y1 - 0.02];
    var pcs = cutPanel(c, z, rect, true, dirty).filter(function (q) { return q.mesh; }); if (!pcs.length) return;
    var objs = pcs.map(function (q) { return q.mesh; }).concat(followersIn(c, z, inv));
    var hx = z.hinge === "tras" ? B.x0 + 0.03 : B.x1 - 0.03, bb = new THREE.Box3(); objs.forEach(function (o) { bb.union(gBox(c, o, gInvOf(c))); });
    var at = new V3(hx, (bb.min.y + bb.max.y) / 2, z.side < 0 ? bb.min.z : bb.max.z);
    var yaw = pivotOf(c, [], at), tilt = new THREE.Group(); yaw.add(tilt); c.root.updateMatrixWorld(true);
    objs.forEach(function (o) { tilt.attach(o); o.traverse(function (x) { x.userData.noFollow = true; }); });
    var dx = Math.abs(hx - (z.hinge === "tras" ? B.x1 : B.x0)), sgn = z.hinge === "tras" ? -1 : 1;
    yaw.rotation.y = z.side * sgn * (0.42 + c.rand() * 0.15);
    tilt.rotation.z = sgn * Math.min(0.22, Math.asin(clamp((bb.min.y - 0.03) / Math.max(0.3, dx), 0, 0.9)));
    c.parts.forEach(function (p) { if (p.kind === "porta") p.done = true; });
  }
  /* tampa pendurada: abre pela dobradiça de cima (ou cai pela de baixo, na caçamba) */
  function lidHang(c, z, dirty) {
    var B = z.box, rect = [B.y0 + 0.05, B.y1 - 0.03, B.z0 + 0.05, B.z1 - 0.05], d = z.dir, a = axisOf(d);
    if (a !== 0) return flapHang(c, z, dirty);
    var pcs = cutPanel(c, z, rect, true, dirty).filter(function (q) { return q.mesh; }); if (!pcs.length) return;
    var bb = new THREE.Box3(), inv = gInvOf(c); pcs.forEach(function (q) { bb.union(gBox(c, q.mesh, inv)); });
    var top = z.hinge !== "baixo", sx = d.x > 0 ? -1 : 1;
    var at = new V3(sx < 0 ? bb.min.x : bb.max.x, top ? bb.max.y : bb.min.y, 0);
    var piv = pivotOf(c, pcs.map(function (q) { return q.mesh; }), at);
    piv.rotation.z = (top ? 1 : -1) * sx * (top ? 0.55 : 1.2); piv.rotation.x = (c.rand() - 0.5) * 0.12;
  }
  /* aba de metal rasgada e dobrada para fora num canto do painel */
  function flapHang(c, z, dirty) {
    var R = c.rand, B = z.box, d = z.dir, a = axisOf(d), ax = [0, 1, 2].filter(function (k) { return k !== a; });
    var u0 = bLo(B, ax[0]), u1 = bHi(B, ax[0]), v0 = bLo(B, ax[1]), v1 = bHi(B, ax[1]), lu = u1 - u0, lv = v1 - v0;
    var ks = clamp((c.meta.L || 4.2) / 4.2, 0.45, 1), fu = Math.min(0.45 * ks, lu * 0.32), fv = Math.min(0.35 * ks, lv * 0.4), cu = u0 + lu * (0.3 + R() * 0.4), cv = v0 + lv * (0.3 + R() * 0.4);
    var rect = [cu - fu / 2, cu + fu / 2, cv - fv / 2, cv + fv / 2];
    var pcs = cutPanel(c, z, rect, true, dirty).filter(function (q) { return q.mesh && q.cut; }); if (!pcs.length) return;
    var at = new V3(); at.setComponent(a, d.getComponent(a) > 0 ? bLo(B, a) : bHi(B, a)); at.setComponent(ax[0], rect[0]); at.setComponent(ax[1], (rect[2] + rect[3]) / 2);
    var inv = gInvOf(c), bb = new THREE.Box3(); pcs.forEach(function (q) { bb.union(gBox(c, q.mesh, inv)); }); at.setComponent(a, bb.getCenter(new V3()).getComponent(a));
    var piv = pivotOf(c, pcs.map(function (q) { return q.mesh; }), at), axisV = new V3(); axisV.setComponent(ax[1], 1);
    var outv = d.clone().negate(), tangent = new V3(); tangent.setComponent(ax[0], 1);
    var sgn = new V3().crossVectors(axisV, tangent).dot(outv) > 0 ? 1 : -1;
    piv.quaternion.setFromAxisAngle(axisV, sgn * (0.6 + R() * 0.3));
  }

  /* ---- aplicação de todas as zonas ---- */
  function fadePaint(c) {
    var cache2 = new Map();
    c.g.traverse(function (o) {
      if (!o.isMesh || !c.paints || !c.paints.has(o.material)) return;
      var nm2 = cache2.get(o.material);
      if (!nm2) { nm2 = o.material.clone(); var hsl = {}; nm2.color.getHSL(hsl); nm2.color.setHSL(hsl.h, hsl.s * 0.45, Math.min(0.75, hsl.l * 0.9 + 0.08)); nm2.color.lerp(RUST, 0.12); nm2.roughness = 0.96; nm2.metalness = 0.05; cache2.set(o.material, nm2); }
      o.material = nm2;
    });
  }
  function abandonFx(c) {
    fadePaint(c); hurtEngine(c, 0.45);
    var inv = gInvOf(c);
    (c.zones || []).forEach(function (z) { if (z.internal || ["painel", "porta", "teto", "tampa", "capo", "parachoque"].indexOf(z.type) < 0) return; c.rand = rng(strHash(c.k + "|ferrugem|" + z.id)); zoneDecals(c, z, { rust: 3 }, zoneCands(c, z, inv)); });
  }
  function burntFx(c) {
    burnAll(c); var m = c.meta, ep = enginePos(c); hurtEngine(c, 0);
    ZG.addEmitter(c, ep.clone().add(new V3(0, 0.15, 0)), "fogo", { rate: 5, s: 0.6 });
    ZG.addEmitter(c, new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clear || 0.3) + 0.35, 0), "fogo", { rate: 4, s: 0.55 });
    ZG.addEmitter(c, ep.clone().add(new V3(0, 0.9, 0)), "preta", { rate: 3, s: 1.3 });
    c.emit = c.emit.filter(function (e) { return e.kind !== "escape"; }); c.burnt = true;
  }
  function settleDrops(c) {
    var D = c.zDrop; if (!D || !D.length || ["boat", "plane", "heli"].indexOf(c.meta.kind) >= 0 && c.meta.kind !== "plane") return;
    var WH = wheelInfo(c); if (!WH) return;
    var P = function (w) { return w.userData.gpos || w.position; };  /* roda que foi para dentro de um pivô (trem quebrado) guarda a posição original */
    var xs = WH.list.map(function (w) { return P(w).x; }), zs2 = WH.list.map(function (w) { return P(w).z; });
    var dAt = function (w) { var q = D.filter(function (e) { return Math.abs(e.x - P(w).x) < 0.01 && Math.abs(e.z - P(w).z) < 0.01; }); return q.length ? Math.max.apply(null, q.map(function (e) { return e.d; })) : 0; };
    var xc = xs.reduce(function (s, v) { return s + v; }, 0) / xs.length, zc = zs2.reduce(function (s, v) { return s + v; }, 0) / zs2.length;
    var sxx = 0, sxz = 0, szz = 0, sxd = 0, szd = 0, sd = 0;
    WH.list.forEach(function (w) { var x = P(w).x - xc, z2 = P(w).z - zc, d = -dAt(w); sxx += x * x; sxz += x * z2; szz += z2 * z2; sxd += x * d; szd += z2 * d; sd += d; });
    var det = sxx * szz - sxz * sxz, A = 0, Bz = 0;
    if (Math.abs(det) > 1e-6) { A = (sxd * szz - szd * sxz) / det; Bz = (szd * sxx - sxd * sxz) / det; } else if (sxx > 1e-6) A = sxd / sxx;
    var t = sd / WH.list.length;
    /* Δy(x, z) = A·x + Bz·z + (t − A·xc − Bz·zc): rotation.z dá A·x e rotation.x dá −sen(b)·z */
    c.g.rotation.z += Math.atan(A); c.g.rotation.x += -Math.asin(clamp(Bz, -0.5, 0.5)); c.g.position.y += t - A * xc - Bz * zc;
  }
  ZG.applyZones = function (c, zs) {
    var Zs = zonesOf(c); zs = zs || {}; var H = zs.h || {}, FL = zs.flags || {};
    c.zs = { h: {}, flags: Object.assign({}, FL) };
    Zs.forEach(function (z) { z.h = H[z.id] == null ? 100 : clamp(Math.round(H[z.id]), 0, 100); z.b = bandOf(z.h); c.zs.h[z.id] = z.h; });
    var R0 = c.rand, dirty = new Set(), any = false; c.zDrop = []; c.zoneErr = c.zoneErr || [];
    Zs.forEach(function (z) {
      if (z.h >= 100) return; any = true;
      c.rand = rng(strHash(c.k + "|" + z.id + "|" + z.b));
      try {
        var b = z.b;
        if (z.type === "roda" && z.fxKey === "trem" && c.meta.kind === "plane") gearBand(c, z, b);
        else if (z.type === "roda") z.wheels.forEach(function (w) { wheelBand(c, z, w, b); });
        else if (z.type === "vidro") z.glass.forEach(function (g) { glassBand(c, z, g, b); });
        else if (z.type === "luz") z.lights.forEach(function (Lt) { lightBand(c, z, Lt, b); });
        else if (z.type === "interno") internalBand(c, z, b);
        else if (z.type === "capo") hoodBand(c, z, b, dirty);
        else if (z.type === "parachoque") bumperBand(c, z, b, dirty);
        else if (z.type === "peca") pecaBand(c, z, b, dirty);
        else panelBand(c, z, b, dirty);
        if (z.type !== "vidro") z.glass.forEach(function (g) { if (b === 1 && g !== z.glass[0]) return; glassBand(c, z, g, b === 4 ? 4 : b); });
        if (z.type !== "luz") z.lights.forEach(function (Lt) { lightBand(c, z, Lt, b); });
        if (z.type !== "roda" && !z.lagarta) z.wheels.forEach(function (w) { wheelBand(c, z, w, b); });
        if (z.sub && z.type !== "interno" && b >= 2) internalBand(c, Object.assign({}, z, { pos: z.pos || bCen(z.box) }), Math.min(b, 3));
        if (typeof z.onBand === "function") z.onBand(c, b, z, ZG);
      } catch (e) { c.zoneErr.push(z.id + ": " + (e && e.message)); }
    });
    dirty.forEach(function (msh) { var g = msh.geometry; if (g.userData.crease || !g.index) crease(g, 42); else g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); });
    try { settleDrops(c); } catch (e) { c.zoneErr.push("assentamento: " + e.message); }
    c.rand = rng(strHash(c.k + "|cenario"));
    var flagList = Object.keys(FL).filter(function (k) { return FL[k] && ZG.flagFx[k]; }).sort(function (x, y) { return ZG.flagFx[x].order - ZG.flagFx[y].order; });
    flagList.forEach(function (k) { ZG.flagFx[k].apply(c, FL, ZG); });
    if (any || FL.flipped || flagList.some(function (k) { return ZG.flagFx[k].settle; })) { c.rand = rng(strHash(c.k + "|assenta")); ZG.settle(c, 2.5); }
    if (FL.flipped && !c.flipped) { c.rand = rng(strHash(c.k + "|capota")); if (c.hood) { c.hood.target = 0; } if (ZG.roll(c, 1)) { for (var i = 0; i < 150 && !c.flipped; i++) ZG.tick(c, 1 / 30); ZG.settle(c, 1.5); } }
    if (any) updateFluids(c, 20);
    c.rand = R0;
    return c.zs;
  };

  /* ---- cenários prontos: registrados pelo plugin do jogo ----
     ZG.scenario({ id, n, init?(X), zone(z, X) }) registra um cenário. Em zone(), X.set(z, saúde) grava a saúde da zona e X.flags recebe
     marcas (flipped, burnt, abandoned ou as de ZG.flagFx). X traz: c, meta, F, R, L, W, cl, top, r (aleatório determinístico), cen (centro da
     zona atual), isPB (zona de para-brisa), BODY (tipos de lataria), clamp. Devolve { h, flags, sc }. */
  ZG.SCENARIOS = [];
  ZG.scenario = function (def) {
    if (!def || !def.id || typeof def.zone !== "function") throw new Error("VehicleSDK.scenario: id e zone(z, X) são obrigatórios");
    var i = ZG.SCENARIOS.findIndex(function (s) { return s.id === def.id; });
    if (i >= 0) ZG.SCENARIOS[i] = def; else ZG.SCENARIOS.push(def);
    return def;
  };
  /* efeitos visuais de marcas de cenário: ZG.flagFx[nome] = { order, settle, apply(c, flags, ZG) } */
  ZG.flagFx = {};
  ZG.flagFx.abandoned = { order: 20, settle: true, apply: abandonFx };   /* envelhecimento genérico: pintura desbotada, ferrugem */
  ZG.flagFx.burnt = { order: 40, settle: true, apply: burntFx };        /* fogo e fuligem */
  var BODY = { painel: 1, porta: 1, teto: 1, tampa: 1, capo: 1, parachoque: 1 };
  ZG.zoneScenario = function (c, name) {
    var Zs = zonesOf(c), m = c.meta, F = m.front, R = m.rear, L = m.L || (F - R), W = m.W || 1.7, cl = m.clear || 0.3, top = m.top || 1.5;
    var S = ZG.SCENARIOS.find(function (s) { return s.id === name || s.n === name; });
    var sc = S ? S.id : name, h = {}, flags = {};
    var r = rng(strHash((c.k || "") + "|" + sc));
    function set(z, v) { h[z.id] = clamp(Math.round(v), 0, 100); }
    var X = { c: c, meta: m, F: F, R: R, L: L, W: W, cl: cl, top: top, r: r, set: set, flags: flags, h: h, BODY: BODY, clamp: clamp, cen: null, isPB: false };
    if (S) {
      if (S.init) S.init(X);
      Zs.forEach(function (z) { X.cen = bCen(z.box); X.isPB = z.tags.indexOf("parabrisa") >= 0; S.zone(z, X); });
    }
    return { h: h, flags: flags, sc: sc };
  };
  /* saúde geral (média ponderada) */
  ZG.zoneOverall = function (c) {
    var Zs = zonesOf(c), s = 0, w = 0; Zs.forEach(function (z) { s += z.h * z.w; w += z.w; });
    var h = w ? Math.round(s / w) : 100;
    /* piso pela pior zona estrutural: uma zona destruída ou arrancada não deixa o veículo "Intacto" na média */
    var st = Zs.filter(function (z) { return !z.internal && z.type !== "vidro" && z.type !== "luz"; }).map(function (z) { return z.h; }).sort(function (a, b) { return a - b; });
    if (st.length) { var w3 = st.slice(0, 3), m3 = w3.reduce(function (a, b) { return a + b; }, 0) / w3.length; h = Math.min(h, Math.round(st[0] + 30), Math.round(m3 + 22)); }
    var gl = Zs.filter(function (z) { return z.type === "vidro" || z.type === "luz"; }).map(function (z) { return z.h; });
    if (gl.length) h = Math.min(h, Math.round(Math.min.apply(null, gl) + 55));
    return { h: h, b: bandOf(h), n: BANDS[bandOf(h)].n };
  };
  /* zona do ponto p (coordenadas de c.g), com a malha atingida opcional */
  ZG.zoneAt = function (c, p, obj) {
    var Zs = zonesOf(c), own = obj ? ownerOf(c, obj) : null; if (own) return own;
    var best = null;
    Zs.forEach(function (z) { if (z.internal) return; if (inB(z.box, p.x, p.y, p.z, 0.03) && (!best || bVol(z.box) < bVol(best.box))) best = z; });
    if (best) return best;
    var bd = 1e9; Zs.forEach(function (z) { if (z.internal) return; var d = bDist(z.box, p); if (d < bd) { bd = d; best = z; } });
    return best;
  };
  /* batida no ponto: desconta saúde das zonas perto do ponto, conforme a força (0,3..1,4) */
  ZG.zoneDamageAt = function (c, p, dir, force, obj) {
    var Zs = zonesOf(c), main = ZG.zoneAt(c, p, obj), Rr = 0.35 + 0.35 * force, out = [];
    Zs.forEach(function (z) {
      var d = z === main ? 0 : bDist(z.box, p), dmg = 0;
      if (z === main) dmg = force * 36;
      else if (z.internal) { if (d < Rr * 0.6) dmg = force * 22 * (1 - d / (Rr * 0.6)); }
      else if (d < Rr) dmg = force * 26 * Math.pow(1 - d / Rr, 1.3);
      if (dmg >= 1) out.push({ id: z.id, n: z.n, dmg: Math.round(dmg) });
    });
    return { main: main ? main.id : null, list: out };
  };
  /* ponto e direção das batidas por lado (botões Frente, Traseira, Lado esquerdo e Lado direito) */
  ZG.zonePoint = function (c, zone) {
    var m = c.meta, mid = m.clear + (m.bodyH || 0.6) * 0.5, p, dir;
    if (zone === "frente") { p = new V3(m.front, mid, m.W * 0.15); dir = new V3(-1, 0, 0); }
    else if (zone === "traseira") { p = new V3(m.rear, mid, -m.W * 0.15); dir = new V3(1, 0, 0); }
    else { var sd = zone === "esquerda" ? -1 : 1; p = new V3((m.front + m.rear) * 0.5 + m.L * (sd < 0 ? 0.12 : -0.1), mid + 0.1, sd * m.W / 2); dir = new V3(0, 0, -sd);
      var h = probe(c, new V3(p.x, p.y, sd * (m.W / 2 + 3)), dir, 3 + m.W); if (h) p = h.p; }
    return { p: p, dir: dir };
  };

  /* ================= extensão: configure, plugin, ganchos ================= */
  var HOOKS = {};
  /* ZG.on(evento, fn) / ZG.hook(evento, ...args). Eventos: "defaultDamage"(c) depois do dano padrão de um carro. */
  ZG.on = function (ev, fn) { (HOOKS[ev] = HOOKS[ev] || []).push(fn); return ZG; };
  ZG.hook = function (ev) { var a = Array.prototype.slice.call(arguments, 1); (HOOKS[ev] || []).forEach(function (fn) { fn.apply(ZG, a); }); };
  /* configure({
       bands:     [{ n, col, min?, h? } × 5]    nomes/cores das 5 faixas (mescla por índice)
       zoneFx:    { chave: [5 textos] }         efeito por tipo/fxKey de zona e faixa; {quem} = ocupante
       partFx:    { tipoDePeca: "texto" }       ZG.FX
       scenarios: [{ id, n, init?, zone(z, X) }]
       flags:     { nome: { order, settle, apply(c, flags, ZG) } }
       fluids:    { chave: def de ZG.defineFluid }
       fuels:     { chave: {...livre} }, groups: ["..."], waterGroups: { "Grupo": true }
       palette:   { rust: "#hex" }
       texts:     { who, noEffect, plate, ui: {...} }
       impactStain, defaultSplat, defaultGroup, damagedScenario
     } */
  ZG.configure = function (o) {
    o = o || {};
    if (o.bands) o.bands.forEach(function (b, i) { if (BANDS[i] && b) Object.assign(BANDS[i], b); });
    if (o.zoneFx) Object.keys(o.zoneFx).forEach(function (k) { FXZ[k] = o.zoneFx[k]; });
    if (o.partFx) Object.assign(ZG.FX, o.partFx);
    if (o.scenarios) o.scenarios.forEach(ZG.scenario);
    if (o.flags) Object.keys(o.flags).forEach(function (k) { ZG.flagFx[k] = Object.assign({ order: 50, settle: true }, o.flags[k]); });
    if (o.fluids) Object.keys(o.fluids).forEach(function (k) { ZG.defineFluid(k, o.fluids[k]); });
    if (o.fuels) Object.assign(ZG.FUELS, o.fuels);
    if (o.groups) o.groups.forEach(function (g) { if (ZG.GROUPS.indexOf(g) < 0) ZG.GROUPS.push(g); });
    if (o.waterGroups) Object.assign(ZG.WATER_GROUPS, o.waterGroups);
    if (o.palette && o.palette.rust) RUST.set(o.palette.rust);
    if (o.texts) { var t = o.texts; if (t.who != null) ZG.config.texts.who = t.who; if (t.noEffect != null) ZG.config.texts.noEffect = t.noEffect; if (t.plate != null) ZG.config.plate = t.plate; if (t.ui) ZG.config.texts.ui = Object.assign(ZG.config.texts.ui || {}, t.ui); }
    ["impactStain", "defaultSplat", "defaultGroup", "damagedScenario"].forEach(function (k) { if (o[k] !== undefined) ZG.config[k] = o[k]; });
    return ZG;
  };
  /* plugin({ name, configure: {...}, install(ZG) }) : aplica configure e roda install. */
  ZG.plugins = [];
  ZG.plugin = function (p) {
    if (!p) return ZG;
    if (p.configure) ZG.configure(p.configure);
    if (typeof p.install === "function") p.install(ZG);
    ZG.plugins.push(p.name || "(sem nome)");
    return ZG;
  };
  /* Ajudantes internos para plugins que criam efeitos de cenário próprios (marcas em ZG.flagFx). */
  ZG.internals = { rng: rng, strHash: strHash, zonesOf: zonesOf, gInvOf: gInvOf, hideObj: hideObj, markDecal: markDecal, rayCaster: _zr, boxCenter: bCen, wheelInfo: wheelInfo };

  /* ================= montagem ================= */
  function defaultDamage(c) {
    var kd = c.meta.kind;
    if (kd === "plane") { zoneImpact(c, "frente", 1.2); zoneImpact(c, "esquerda", 1.1); impact(c, new V3(0.05, 0.45, 1.25), new V3(0, 1, 0), 1.0, { noStain: true }); }
    else if (kd === "heli") { zoneImpact(c, "frente", 1.1); impact(c, new V3(0, 0.12, -0.95), new V3(0, 0, 1), 0.9, { noStain: true }); impact(c, new V3(c.meta.rear + 0.3, 2.0, 0), new V3(0.4, 0, 1), 1.0, { noStain: true }); impact(c, new V3(-0.6, 2.4, 0.3), new V3(0, -1, 0), 1.0, { noStain: true }); }
    else if (kd === "boat") { zoneImpact(c, "frente", 1.1); zoneImpact(c, "esquerda", 1.0); }
    else {
      zoneImpact(c, "frente", 1.0); zoneImpact(c, "esquerda", 0.7);
      ZG.hook("defaultDamage", c);
    }
  }
  ZG.defaultDamage = defaultDamage;
  /* Constrói o veículo k no estado st ("intacto" | "danificado" | "modificado"). Devolve o contexto; adicione c.root à cena.
     zs (opcional) = { h: { idDaZona: saúde 0..100 }, flags: { flipped, burnt, abandoned, ...marcas do plugin } } aplica as zonas de dano.
     Sem zs, "danificado" usa o cenário de id "frontal" se o plugin o registrou (ZG.config.damagedScenario). */
  ZG.build = function (k, st, zs) {
    var spec = ZG.find(k); if (!spec) throw new Error("Veículo desconhecido: " + k);
    st = st || "intacto";
    var c = new Ctx(st, strHash(k + st)); c.spec = spec; c.k = k;
    spec.build(c, ZG);
    var m = c.meta; m.kind = m.kind || "car";
    if (m.L == null || m.W == null || m.front == null) {
      var bb = new THREE.Box3().setFromObject(c.g), sz = bb.getSize(new V3());
      if (m.L == null) m.L = sz.x; if (m.W == null) m.W = sz.z; if (m.front == null) m.front = bb.max.x; if (m.rear == null) m.rear = bb.min.x;
      if (m.top == null) m.top = bb.max.y; if (m.clear == null) m.clear = Math.max(0.1, bb.min.y + 0.2); if (m.bodyH == null) m.bodyH = sz.y * 0.5; if (m.belt == null) m.belt = m.clear + m.bodyH;
    }
    if (c.engineHealth == null) c.engineHealth = 1;
    if (["eletrico", "nenhum"].indexOf(spec.fuel) < 0 && ["boat", "plane", "heli"].indexOf(m.kind) < 0 && m.exhaust !== false) {
      var ex = m.exhaust || new V3(m.rear + 0.05, Math.max(0.2, (m.clear || 0.3) * 0.7), (m.W || 1.6) * 0.3);
      ZG.addEmitter(c, ex, "escape", { dir: m.exhaustDir || new V3(-1, 0, 0) });
    }
    try { zonesOf(c); } catch (e) { c.zones = []; (c.zoneErr = c.zoneErr || []).push("zonas: " + (e && e.message)); }
    if (st === "modificado") { if (m.armor) m.armor(c, ZG); else applyArmor(c); }
    if (zs == null && st === "danificado" && ZG.config.damagedScenario) zs = ZG.zoneScenario(c, ZG.config.damagedScenario);
    if (zs) ZG.applyZones(c, zs); else { c.zs = { h: {}, flags: {} }; c.zones.forEach(function (z) { c.zs.h[z.id] = 100; }); }
    c.g.traverse(function (o) { if (o.isMesh && !(o.material && o.material.transparent)) o.receiveShadow = true; });
    return c;
  };
  ZG.dispose = function (c) { c.root.traverse(function (o) { if (o.isSprite) { if (o.material && o.material.userData.dis) o.material.dispose(); return; } if (o.geometry && !Object.values(PG).includes(o.geometry)) o.geometry.dispose(); }); };
})();
