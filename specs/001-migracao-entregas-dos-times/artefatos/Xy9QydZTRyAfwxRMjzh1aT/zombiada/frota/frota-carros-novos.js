/* frota-carros-novos.js: veículos novos da v4 (grupo G: carros). Só usa a API de window.ZG (veja API.md).
   Unno Mille, Gól G5, HB-21, Pólo, Cívico, Opalla Comodoro e Mustangue GT.
   Construtor local carro(): cópia do construtor do grupo A (frota-motos-carros.js), porque ele fica fechado no arquivo de lá.
   Mudança local: limpadores deitados sobre o para-brisa e opção de limpador único (s.wiper = 1).
   Funções locais novas (não existem no núcleo): hoodHit/onHood (peças presas ao capô), gutter (calha de chuva). */
(function (ZG) {
  "use strict";
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM, G = ZG.geo, profX = ZG.profX, halfAt = ZG.halfAt, clamp = ZG.clamp, smooth = ZG.smooth;

  /* ================= utilidades locais ================= */
  var GLOSS = CM("#07080a", { roughness: 0.18, metalness: 0.5 });
  var ALLOY = CM("#b9bec2", { metalness: 0.75, roughness: 0.3 });
  var ALLOYD = CM("#3a3e42", { metalness: 0.6, roughness: 0.35 });
  var EVRIM = CM("#c9ced1", { metalness: 0.6, roughness: 0.35 });
  var HUBCAP = CM("#9ea4a8", { metalness: 0.55, roughness: 0.38 });
  var RUBBER = CM("#131313", { roughness: 0.9 });
  var ENG = CM("#9a9ea2", { metalness: 0.65, roughness: 0.38 });
  var ENGD = CM("#2c2e31", { metalness: 0.45, roughness: 0.5 });
  var FIN = CM("#7c8084", { metalness: 0.6, roughness: 0.45 });
  var EXH = CM("#b5b9bc", { metalness: 0.9, roughness: 0.25 });
  var HEAT = CM("#2a2b2d", { metalness: 0.5, roughness: 0.45 });

  /* deformação suave aplicada depois de montar: arredonda frente e traseira em planta e dá curvatura à lateral */
  function mkWarp(o) {
    function sec(y) {
      if (y >= o.belt) return o.kt;
      if (y >= o.ys) { var a = (y - o.ys) / (o.belt - o.ys); return o.kt * a * a; }
      var b = clamp((o.ys - y) / (o.ys - o.yb), 0, 1.25); return o.kb * b * b;
    }
    var f = function (x, y, z) {
      var tF = smooth((x - (o.xF - o.Lf)) / o.Lf), tR = smooth(((o.xR + o.Lr) - x) / o.Lr), u = Math.min(1.15, Math.abs(z) / o.hw), u2 = u * u;
      var dropF = o.dropF ? o.dropF * tF * u2 * smooth((y - o.dropY) / 0.25) : 0;
      /* o.zx(x, y): fator extra de largura por posição (cintura das portas mais estreita que a anca, por exemplo) */
      return [x - o.bowF * tF * u2 + o.bowR * tR * u2, y - dropF, z * (1 - sec(y)) * (1 - o.pinF * tF * tF) * (1 - o.pinR * tR * tR) * (o.zx ? o.zx(x, y) : 1)];
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
      if (g.userData.crease) G.crease(g, 42); else g.computeVertexNormals();
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

  /* loft de superelipse em x (seções no plano y-z) ou em y (seções no plano x-z).
     eixo x: estações [x, topo, base, largura, p, zc]; eixo y: estações [y, xFrente, xTras, largura, p, zc] */
  /* reamostra estações com Catmull-Rom (cada parâmetro), para cascas grandes e lisas */
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
  /* meia largura da casca de loft na altura y, na posição x (para frisos e peças coladas na lateral) */
  function loftHalf(st, x, y) {
    for (var i = 0; i < st.length - 1; i++) {
      var a = st[i], b = st[i + 1]; if ((a[0] - x) * (b[0] - x) > 0) continue;
      var t = (x - a[0]) / ((b[0] - a[0]) || 1), top = a[1] + (b[1] - a[1]) * t, bot = a[2] + (b[2] - a[2]) * t, w = a[3] + (b[3] - a[3]) * t, pp = (a[4] || 2.4) + ((b[4] || 2.4) - (a[4] || 2.4)) * t;
      var h = (y - (top + bot) / 2) / ((top - bot) / 2); if (Math.abs(h) >= 1) return 0;
      return w / 2 * Math.pow(1 - Math.pow(Math.abs(h), pp), 1 / pp);
    }
    return 0;
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
    g = G.crease(g.toNonIndexed(), o.crease || 60);
    return g;
  }
  function body(c, st, mat, o) {
    o = o || {};
    var m = c.add(sloft(st, o), mat, 0, 0, 0, o.parent);
    if (o.def !== false) c.deform.push(m);
    return m;
  }
  /* arco de para-lama: casca curva sobre a roda. cx, cy centro da roda; r raio interno; a0..a1 ângulos (0 = frente); w largura; t altura da bossa */
  function fenderGeo(cx, cy, r, a0, a1, w, t, zc, o) {
    o = o || {};
    var na = o.na || 22, nu = 10, pos = [], idx = [], rf = o.rf || function () { return r; };
    for (var i = 0; i <= na; i++) {
      var a = a0 + (a1 - a0) * i / na, R = rf(a), ca = Math.cos(a), sa = Math.sin(a);
      for (var j = 0; j <= nu; j++) {
        var u = j / nu * 2 - 1, bulge = t * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), o.p || 3)), 1 / (o.p || 3)), rr = R + bulge;
        pos.push(cx + ca * rr, cy + sa * rr, zc + u * w / 2);
      }
    }
    for (var i2 = 0; i2 < na; i2++) for (var j2 = 0; j2 < nu; j2++) { var A = i2 * (nu + 1) + j2, B = A + nu + 1; idx.push(A, B, A + 1, A + 1, B, B + 1); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    return G.crease(g.toNonIndexed(), 70);
  }
  function lamp(c, o) { var L = ZG.headlight(c, o); if (o.roll) L.g.rotation.x = o.roll; if (o.pitch) L.g.rotation.z = o.pitch; return L; }

  /* janelas laterais com o teto inclinado (roofR na traseira, crown no meio) */
  function roofAt(gh, x) {
    var rR = gh.roofR || gh.roof, t = clamp((x - gh.rt) / (gh.ft - gh.rt), 0, 1);
    return rR + (gh.roof - rR) * t + (gh.crown || 0) * 4 * t * (1 - t);
  }
  function windows(gh) {
    var inn = 0.07, rise = gh.rise || 0;
    function ybAt(x) { return gh.belt + 0.035 + rise * clamp((gh.fb - x) / (gh.fb - gh.rb), 0, 1); }
    function lx(x0, x1, y, top) { return x0 + (x1 - x0) * (y - gh.belt) / (top - gh.belt); }
    function rearX(y) { return lx(gh.rb, gh.rt, y, gh.roofR || gh.roof) + inn * 1.3; }
    function frontX(y) { return lx(gh.fb, gh.ft, y, gh.roof) - inn * 1.3; }
    function topY(x) { return roofAt(gh, x) - 0.068; }
    var ps = gh.pillars.slice().sort(function (a, b) { return a - b; }), bounds = [-1e9];
    ps.forEach(function (p) { bounds.push(p - 0.06, p + 0.06); }); bounds.push(1e9);
    var polys = [];
    for (var i = 0; i < bounds.length; i += 2) {
      var xa = bounds[i], xb = bounds[i + 1];
      var L = function (y) { return Math.max(xa, rearX(y)); }, R = function (y) { return Math.min(xb, frontX(y)); };
      var ybl = ybAt(xa > -1e8 ? xa : gh.rb), ybr = ybAt(xb < 1e8 ? xb : gh.fb);
      for (var q = 0; q < 3; q++) { ybl = ybAt(L(ybl)); ybr = ybAt(R(ybr)); }
      var yl = topY(L(ybl)), yr = topY(R(ybr));
      for (var k = 0; k < 4; k++) { yl = topY(L(yl)); yr = topY(R(yr)); }
      if (R(ybr) - L(ybl) > 0.15 && R(yr) - L(yl) > 0.05) polys.push([[L(ybl), ybl], [R(ybr), ybr], [R(yr), yr], [L(yl), yl]]);
    }
    return polys;
  }

  /* ================= carro (cópia ajustada de ZG.car) ================= */
  /* Detalhes de frente e traseira (faróis, lanternas, para-choques, grades, placas, tampas) são "pele" amostrada no casco:
     raios contra a carroceria antes do warp dão o ponto e a normal de cada vértice, então tudo fica rente à lataria
     (embutido) e acompanha o arredondamento em planta e o amassado. */
  var SURFM = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  var LH = CM("#0c0d0f", { roughness: 0.3, metalness: 0.35 });            /* moldura preta brilhante dos faróis */
  var REFL = CM("#c3c9ce", { metalness: 0.92, roughness: 0.16 });         /* refletor cromado */
  var REFLD = CM("#3a4047", { metalness: 0.85, roughness: 0.2 });         /* refletor escurecido */
  var DRL = CM("#f2f7ff", { emissive: "#d6e8ff", emissiveIntensity: 1.7, roughness: 0.2 });
  var TAILHI = CM("#e2301f", { emissive: "#e8200f", emissiveIntensity: 1.35, roughness: 0.25 });
  var TAILD = CM("#5a0d0a", { emissive: "#5a0805", emissiveIntensity: 0.55, roughness: 0.22, metalness: 0.2 });
  var SMOKE = CM("#1a0b0b", { roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.5, depthWrite: false });
  var REFLR = CM("#9a1d14", { emissive: "#5a0805", emissiveIntensity: 0.5, roughness: 0.3 });
  var UNDER = CM("#101112", { roughness: 0.96 });
  var UNDER2 = CM("#26282b", { roughness: 0.75, metalness: 0.35 });
  var PLASTIC = CM("#141516", { roughness: 0.82 });
  var RECESS = CM("#0b0c0d", { roughness: 0.9 });
  var PLATEL = CM("#f4f1e4", { emissive: "#f0ead0", emissiveIntensity: 1.0, roughness: 0.3 });
  /* texturas de grade (padrão repetido) */
  function patTex(kind) {
    var cv = document.createElement("canvas"); cv.width = cv.height = 64; var x = cv.getContext("2d"), i, j;
    x.fillStyle = "#060607"; x.fillRect(0, 0, 64, 64);
    if (kind === "mesh") {
      x.strokeStyle = "#4a4e52"; x.lineWidth = 5;
      for (j = -1; j < 3; j++) for (i = -1; i < 3; i++) {
        var cx = i * 32 + (j % 2 ? 16 : 0), cy = j * 28 + 14; x.beginPath();
        for (var k = 0; k <= 6; k++) { var a = PI / 6 + k * PI / 3; x.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); }
        x.stroke();
      }
    } else if (kind === "diamond") {
      x.strokeStyle = "#3f4347"; x.lineWidth = 6;
      for (i = -64; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 64, 0); x.stroke(); }
    } else if (kind === "bars") {
      var gr = x.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, "#c8ccd0"); gr.addColorStop(0.5, "#6c7176"); gr.addColorStop(1, "#2a2d30");
      x.fillStyle = gr; x.fillRect(0, 4, 64, 14); x.fillRect(0, 36, 64, 14);
    } else if (kind === "barsd") {
      x.fillStyle = "#2b2e32"; x.fillRect(0, 6, 64, 12); x.fillRect(0, 38, 64, 12);
      x.fillStyle = "#4a4f55"; x.fillRect(0, 6, 64, 3); x.fillRect(0, 38, 64, 3);
    } else if (kind === "slots") {
      x.fillStyle = "#26292c"; for (i = 0; i < 64; i += 16) x.fillRect(i, 0, 6, 64);
    }
    var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  var GRM = {};
  function grilleMat(kind) { if (!GRM[kind]) GRM[kind] = new THREE.MeshStandardMaterial({ map: patTex(kind), roughness: kind === "bars" ? 0.3 : 0.7, metalness: kind === "bars" ? 0.6 : 0.25 }); return GRM[kind]; }

  /* amostrador da superfície do casco (coordenadas de c.g, antes do warp) */
  function mkSurf(mesh, W) {
    var geo = mesh.geometry, pos = geo.attributes.position, ix = geo.index, n = ix ? ix.count : pos.count;
    geo.computeBoundingBox(); var bb = geo.boundingBox.clone();
    /* triângulos em baldes por faixa de y (raios horizontais) e de x (raios verticais): busca rápida sem Raycaster */
    var T = [], BY = {}, BX = {}, Q = 0.02;
    for (var i = 0; i < n; i += 3) {
      var a = new V3().fromBufferAttribute(pos, ix ? ix.getX(i) : i), b = new V3().fromBufferAttribute(pos, ix ? ix.getX(i + 1) : i + 1), d = new V3().fromBufferAttribute(pos, ix ? ix.getX(i + 2) : i + 2), k = T.length;
      T.push([a, b, d]);
      var y0 = Math.floor(Math.min(a.y, b.y, d.y) / Q), y1 = Math.floor(Math.max(a.y, b.y, d.y) / Q), x0 = Math.floor(Math.min(a.x, b.x, d.x) / Q), x1 = Math.floor(Math.max(a.x, b.x, d.x) / Q), q;
      for (q = y0; q <= y1; q++) (BY[q] || (BY[q] = [])).push(k);
      for (q = x0; q <= x1; q++) (BX[q] || (BX[q] = [])).push(k);
    }
    var ray = new THREE.Ray(), tmp = new V3(), e1 = new V3(), e2 = new V3(), cache = {};
    var S = { bb: bb, hw: W / 2 };
    S.hit = function (o, dd) {
      var d = dd.clone().normalize(); ray.set(o, d);
      var list = Math.abs(d.y) < 0.5 ? BY[Math.floor(o.y / Q)] : BX[Math.floor(o.x / Q)];
      if (!list) return null;
      var best = 1e9, bt = null;
      for (var k = 0; k < list.length; k++) {
        var t = T[list[k]]; if (!ray.intersectTriangle(t[0], t[1], t[2], false, tmp)) continue;
        var dist = tmp.distanceTo(o); if (dist < best) { best = dist; bt = t; }
      }
      if (!bt) return null;
      var nn = e1.subVectors(bt[1], bt[0]).clone().cross(e2.subVectors(bt[2], bt[0])).normalize(); if (nn.dot(d) > 0) nn.negate();
      return { p: o.clone().addScaledVector(d, best), n: nn };
    };
    S.endX = function (E, y) {
      var k = E + ":" + y.toFixed(3); if (cache[k] != null) return cache[k];
      var h = S.hit(new V3(E * 10, y, 0), new V3(-E, 0, 0), E > 0 ? "F" : "R");
      return (cache[k] = h ? h.p.x : (E > 0 ? bb.max.x : bb.min.x));
    };
    return S;
  }
  /* grade de amostras numa ponta (E = +1 frente, -1 traseira). sd = +1/-1 lado; sd = 0 largura toda (de um lado ao outro).
     Caminho: ao longo da face (z0..z1), dobra a quina (raio R) e segue "wrap" metros pela lateral. */
  function sgrid(S, E, sd, o) {
    var R = 0.07, hw = S.hw, full = !sd, z0 = full ? 0 : (o.z0 || 0), z1 = Math.max(z0 + 0.01, o.z1 != null ? o.z1 : hw - R), wrap = o.wrap || 0;
    var L1 = z1 - z0, L2 = wrap > 0 ? R * PI / 2 : 0, tot = L1 + L2 + wrap, which = E > 0 ? "F" : "R";
    var nu = o.nu || Math.max(6, Math.ceil(tot * (full ? 2 : 1) / (o.du || 0.022))), nv = o.nv || Math.max(2, Math.ceil((o.y1 - o.y0) / (o.dv || 0.025)));
    var P = [], N = [];
    for (var i = 0; i <= nu; i++) {
      var s = full ? (i / nu * 2 - 1) * tot : i / nu * tot, side = full ? (s < 0 ? -1 : 1) : sd; s = Math.abs(s);
      P.push([]); N.push([]);
      for (var j = 0; j <= nv; j++) {
        var y = o.y0 + (o.y1 - o.y0) * j / nv, ex = S.endX(E, y), O, D;
        if (s <= L1 || wrap <= 0) { O = new V3(ex + E, y, side * (z0 + Math.min(s, L1))); D = new V3(-E, 0, 0); }
        else if (s <= L1 + L2) { var th = (s - L1) / R, cen = new V3(ex - E * R, y, side * (hw - R)), dir = new V3(E * Math.cos(th), 0, side * Math.sin(th)); O = cen.clone().add(dir); D = dir.clone().negate(); }
        else { var t = s - L1 - L2; O = new V3(ex - E * (R + t), y, side * (hw + 1)); D = new V3(0, 0, -side); }
        var h = S.hit(O, D, which) || { p: O.clone().add(D), n: D.clone().negate() };
        P[i].push(h.p); N[i].push(h.n);
      }
    }
    var G = { P: P, N: N, nu: nu, nv: nv, y0: o.y0, y1: o.y1, len: tot * (full ? 2 : 1), E: E, sd: sd };
    G.at = function (u, y) {
      var fi = clamp(u, 0, 1) * nu, fj = clamp((y - o.y0) / (o.y1 - o.y0), 0, 1) * nv, i0 = Math.min(nu - 1, Math.floor(fi)), j0 = Math.min(nv - 1, Math.floor(fj)), a = fi - i0, b = fj - j0;
      function L(M) { return M[i0][j0].clone().multiplyScalar((1 - a) * (1 - b)).addScaledVector(M[i0 + 1][j0], a * (1 - b)).addScaledVector(M[i0][j0 + 1], (1 - a) * b).addScaledVector(M[i0 + 1][j0 + 1], a * b); }
      return { p: L(P), n: L(N).normalize() };
    };
    /* u do ponto com z dado (só na face) */
    G.uz = function (z) { var s = Math.abs(z) - z0; return full ? (Math.sign(z || 1) * s / tot + 1) / 2 : s / tot; };
    G.zu = function (u) { return full ? (2 * u - 1) * tot : z0 + u * tot; };
    return G;
  }
  function fnv(v) { return typeof v === "function" ? v : function () { return v; }; }
  /* camada de pele sobre a grade: região u0..u1, yb(u)..yt(u), afastada "off" da lataria; "thick" dá espessura (borda visível) */
  function skin(c, G, mat, o) {
    var u0 = o.u0 || 0, u1 = o.u1 == null ? 1 : o.u1, yb = fnv(o.yb), yt = fnv(o.yt), off = o.off == null ? 0.005 : o.off;
    var nu = o.nu || Math.max(3, Math.round((u1 - u0) * G.nu)), nv = o.nv || 3, layers = o.thick ? [off, off - o.thick] : [off];
    var su = o.tile ? (u1 - u0) * G.len / o.tile : 1, sv0 = o.tile ? 1 / o.tile : 1;
    var grids = layers.map(function (of) {
      var Q = [];
      for (var i = 0; i <= nu; i++) {
        var u = u0 + (u1 - u0) * i / nu, b = yb(u), t = yt(u), row = [];
        for (var j = 0; j <= nv; j++) { var y = b + (t - b) * j / nv, s = G.at(u, y); row.push({ p: s.p.addScaledVector(s.n, of), n: s.n, uv: [i / nu * su, o.tile ? (y - G.y0) * sv0 : j / nv] }); }
        Q.push(row);
      }
      return Q;
    });
    var pos = [], uv = [], A = grids[0];
    var mi = Math.floor(nu / 2), mj = Math.floor(nv / 2), t0 = new V3().subVectors(A[mi + 1][mj].p, A[mi][mj].p), t1 = new V3().subVectors(A[mi][mj + 1].p, A[mi][mj].p), flip = t0.cross(t1).dot(A[mi][mj].n) < 0;
    function tri(a, b, d, rev) { var l = (flip !== !!rev) ? [a, d, b] : [a, b, d]; l.forEach(function (q) { pos.push(q.p.x, q.p.y, q.p.z); uv.push(q.uv[0], q.uv[1]); }); }
    grids.forEach(function (Q, li) {
      for (var i = 0; i < nu; i++) for (var j = 0; j < nv; j++) { tri(Q[i][j], Q[i + 1][j], Q[i + 1][j + 1], li > 0); tri(Q[i][j], Q[i + 1][j + 1], Q[i][j + 1], li > 0); }
    });
    if (grids.length > 1) {
      var F = grids[0], B = grids[1], edge = [];
      for (var i2 = 0; i2 < nu; i2++) edge.push([[i2, 0], [i2 + 1, 0]]);
      for (var j2 = 0; j2 < nv; j2++) edge.push([[nu, j2], [nu, j2 + 1]]);
      for (var i3 = nu; i3 > 0; i3--) edge.push([[i3, nv], [i3 - 1, nv]]);
      for (var j3 = nv; j3 > 0; j3--) edge.push([[0, j3], [0, j3 - 1]]);
      edge.forEach(function (e) { var a = F[e[0][0]][e[0][1]], b = F[e[1][0]][e[1][1]], a2 = B[e[0][0]][e[0][1]], b2 = B[e[1][0]][e[1][1]]; tri(a, a2, b2, false); tri(a, b2, b, false); });
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    G0.crease(geo, o.crease || 50); geo.userData.crease = true;
    geo.computeBoundingBox(); var cen = geo.boundingBox.getCenter(new V3()); geo.translate(-cen.x, -cen.y, -cen.z);
    var m = c.add(geo, mat, cen.x, cen.y, cen.z); m.castShadow = !!o.shadow; if (o.order) m.renderOrder = o.order;
    if (o.def !== false) c.deform.push(m);
    return m;
  }
  var G0 = G;
  /* contorno (tubo) de uma região da grade */
  function outline(c, Gd, o, r, mat, off) {
    var u0 = o.u0 || 0, u1 = o.u1 == null ? 1 : o.u1, yb = fnv(o.yb), yt = fnv(o.yt), pts = [], n = 16, k;
    function P(u, y) { var s = Gd.at(u, y); return s.p.addScaledVector(s.n, off || 0.006); }
    for (k = 0; k < n; k++) { var ua = u0 + (u1 - u0) * k / n; pts.push(P(ua, yb(ua))); }
    for (k = 0; k < 3; k++) pts.push(P(u1, yb(u1) + (yt(u1) - yb(u1)) * k / 3));
    for (k = n; k > 0; k--) { var ub = u0 + (u1 - u0) * k / n; pts.push(P(ub, yt(ub))); }
    for (k = 3; k > 0; k--) pts.push(P(u0, yb(u0) + (yt(u0) - yb(u0)) * k / 3));
    if (o.open) { pts = pts.slice(o.open[0], o.open[1]); }
    var t = c.tube(pts, r, mat, { closed: !o.open, seg: pts.length * 4, rs: 5 }); t.castShadow = false; return t;
  }
  /* linha (tubo) ao longo de pontos amostrados: lista de {u, y} numa grade */
  function lineOn(c, Gd, list, r, mat, off) {
    var pts = list.map(function (q) { var s = Gd.at(q[0], q[1]); return s.p.addScaledVector(s.n, off || 0.003); });
    var t = c.tube(pts, r, mat, { seg: pts.length * 6, rs: 4 }); t.castShadow = false; c.deform.push(t); return t;
  }
  /* malha pequena encostada na superfície, com o eixo (y para cilindros) ao longo da normal */
  function onSurf(m, s, off, axis) { m.position.copy(s.p).addScaledVector(s.n, off || 0); m.quaternion.setFromUnitVectors(axis || new V3(0, 1, 0), s.n); m.rotation.order = "XYZ"; return m; }
  function regLight(c, kind, label, inner, lens, pos) {
    var L = { g: null, inner: inner, lens: lens, kind: kind, tint: kind === "farol" ? "clear" : "red", broken: false };
    c.lights.push(L); var pt = c.part(kind, label, inner[0], pos, 0.8); pt.light = L; return L;
  }
  function shapeRange(sh) { var lo = 1e9, hi = -1e9; for (var u = 0; u <= 1.0001; u += 0.05) { var r = sh(u); lo = Math.min(lo, r[0]); hi = Math.max(hi, r[1]); } return [lo, hi]; }
  /* kit de detalhes de ponta, ligado a um carro */
  function mkKit(c, S, I) {
    var K = { S: S, I: I };
    K.grid = function (E, sd, o) { return sgrid(S, E, sd, o); };
    K.skin = function (Gd, mat, o) { return skin(c, Gd, mat, o); };
    /* farol: o = { z0, wrap, shape(u) -> [yb, yt], proj: [[u, dy, r]], drl: [{u0,u1,yb,yt}], amber: [...], refl, pad } */
    K.head = function (sd, o) {
      var sh = o.shape, rg = shapeRange(sh), pad = o.pad == null ? 0.012 : o.pad;
      var Gd = sgrid(S, 1, sd, { z0: o.z0, wrap: o.wrap, z1: o.z1, y0: rg[0] - pad - 0.01, y1: rg[1] + pad + 0.01, du: 0.018, dv: 0.012 });
      var pu = pad / Gd.len, inner = [], lens = [];
      var yb = function (u) { return sh(u)[0]; }, yt = function (u) { return sh(u)[1]; };
      skin(c, Gd, o.bezel || LH, { yb: function (u) { return yb(u) - pad; }, yt: function (u) { return yt(u) + pad; }, off: 0.003, nv: 4 });
      skin(c, Gd, o.refl || REFL, { u0: pu, u1: 1 - pu, yb: yb, yt: yt, off: 0.006, nv: 4 });
      (o.proj || []).forEach(function (q) {
        var r = sh(q[0]), y = (r[0] + r[1]) / 2 + (q[1] || 0), s = Gd.at(q[0], y), rad = q[2] || Math.min(0.034, (r[1] - r[0]) * 0.4);
        var cup = onSurf(c.cyl(rad * 1.35, rad * 1.2, 0.012, LH, 0, 0, 0), s, 0.008); cup.castShadow = false;
        var ring = onSurf(c.add(new THREE.TorusGeometry(rad * 1.05, 0.004, 6, 22), MT.chrome), s, 0.012, new V3(0, 0, 1)); ring.castShadow = false;
        var b = onSurf(c.sph(rad, MT.head, 0, 0, 0, 1, 0.55, 1), s, 0.01); b.castShadow = false; inner.push(b);
      });
      (o.drl || []).forEach(function (d) { inner.push(skin(c, Gd, d.mat || DRL, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.0095, nv: 2 })); });
      (o.amber || []).forEach(function (d) { inner.push(skin(c, Gd, MT.amber, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.009, nv: 2 })); });
      var ln = skin(c, Gd, MT.lens, { yb: function (u) { return yb(u) - pad * 0.4; }, yt: function (u) { return yt(u) + pad * 0.4; }, off: 0.015, nv: 4, order: 3 }); lens.push(ln);
      if (!inner.length) inner.push(ln);
      var cs = Gd.at(0.5, (rg[0] + rg[1]) / 2).p;
      regLight(c, "farol", o.label || ("Farol " + (sd > 0 ? "direito" : "esquerdo")), inner, lens, cs);
      return Gd;
    };
    /* lanterna: o = { z0, wrap, shape(u), main (material da área), hi: [...], rev: [...], amber: [...] } */
    K.tail = function (sd, o) {
      var sh = o.shape, rg = shapeRange(sh), pad = o.pad == null ? 0.01 : o.pad;
      var Gd = sgrid(S, -1, sd, { z0: o.z0, z1: o.z1, wrap: o.wrap, y0: rg[0] - pad - 0.01, y1: rg[1] + pad + 0.01, du: 0.018, dv: 0.012 });
      var pu = pad / Gd.len, inner = [], lens = [], yb = function (u) { return sh(u)[0]; }, yt = function (u) { return sh(u)[1]; };
      skin(c, Gd, LH, { yb: function (u) { return yb(u) - pad; }, yt: function (u) { return yt(u) + pad; }, off: 0.003, nv: 4 });
      inner.push(skin(c, Gd, o.main || TAILD, { u0: pu, u1: 1 - pu, yb: yb, yt: yt, off: 0.006, nv: 4 }));
      (o.hi || []).forEach(function (d) { inner.push(skin(c, Gd, d.mat || TAILHI, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.009, nv: 2 })); });
      (o.rev || []).forEach(function (d) { inner.push(skin(c, Gd, MT.rev, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.0085, nv: 2 })); });
      (o.amber || []).forEach(function (d) { inner.push(skin(c, Gd, MT.amber, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.0085, nv: 2 })); });
      lens.push(skin(c, Gd, o.lens || MT.lensRed, { yb: function (u) { return yb(u) - pad * 0.4; }, yt: function (u) { return yt(u) + pad * 0.4; }, off: 0.013, nv: 4, order: 3 }));
      regLight(c, "lanterna", o.label || ("Lanterna " + (sd > 0 ? "direita" : "esquerda")), inner, lens, Gd.at(0.4, (rg[0] + rg[1]) / 2).p);
      return Gd;
    };
    /* para-choque: casca grossa na cor (ou preta) que cobre a ponta e dobra as quinas até perto da caixa de roda */
    K.bumper = function (E, o) {
      var Gd = sgrid(S, E, 0, { wrap: o.wrap, y0: o.y0, y1: o.y1, du: 0.03, dv: 0.03 });
      var m = skin(c, Gd, o.mat, { yb: o.yb || o.y0, yt: o.yt || o.y1, off: o.off || 0.016, thick: 0.04, nv: Math.max(4, Gd.nv), shadow: true });
      var tl = []; for (var k = 0; k <= 40; k++) tl.push([0.004 + 0.992 * k / 40, o.y1 + 0.004]);
      lineOn(c, Gd, tl, 0.0045, MT.dark, 0.004);
      c.part("parachoque", E > 0 ? "Para-choque dianteiro" : "Para-choque traseiro", m, new V3(S.endX(E, (o.y0 + o.y1) / 2), (o.y0 + o.y1) / 2, 0), 1.1);
      m.userData.grid = Gd; return m;
    };
    /* placa Mercosul em rebaixo (com luz de placa atrás) */
    K.plate = function (E, y, o) {
      o = o || {};
      var Gd = sgrid(S, E, 0, { z1: 0.32, y0: y - 0.12, y1: y + 0.12, du: 0.03, dv: 0.03 }), off = o.off || 0.004, s = Gd.at(0.5, y);
      var rc = skin(c, Gd, RECESS, { u0: Gd.uz(-0.235), u1: Gd.uz(0.235), yb: y - 0.083, yt: y + 0.083, off: off, nv: 2 });
      rc.geometry.computeBoundingBox(); var ext = E > 0 ? rc.position.x + rc.geometry.boundingBox.max.x : rc.position.x + rc.geometry.boundingBox.min.x;
      /* a placa (plano de 4 vértices) fica fora do warp: deformada, ela recuava inteira para dentro do rebaixo e o rebaixo furava a placa */
      var pl = c.plate(ext + E * 0.004, s.p.y, 0, E > 0 ? "+x" : "-x"); pl.userData.noWarp = true;
      if (E < 0) { var lt = skin(c, Gd, PLATEL, { u0: Gd.uz(-0.06), u1: Gd.uz(0.06), yb: y + 0.071, yt: y + 0.08, off: off + 0.004, nv: 1 }); lt.castShadow = false; }
      return pl;
    };
    /* linha de abertura de tampa: lista de pontos {y, z} na face traseira ou {x, z, top:true} no topo do porta-malas */
    K.lid = function (pts0) {
      /* pontos intermediários a cada 4 cm: a linha segue a lataria em trechos retos (sem barriga da spline atravessando placa ou tampa) */
      var pts = [];
      pts0.forEach(function (q, i) {
        var n = pts0[i + 1]; pts.push(q); if (!n || !!n.top !== !!q.top) return;
        var d = q.top ? Math.hypot(n.x - q.x, n.z - q.z) : Math.hypot(n.y - q.y, n.z - q.z), k = Math.floor(d / 0.04);
        for (var j = 1; j < k; j++) { var t = j / k; pts.push(q.top ? { top: true, x: q.x + (n.x - q.x) * t, z: q.z + (n.z - q.z) * t } : { y: q.y + (n.y - q.y) * t, z: q.z + (n.z - q.z) * t }); }
      });
      var P = pts.map(function (q) {
        var h = q.top ? S.hit(new V3(q.x, 3, q.z), new V3(0, -1, 0), "R") : S.hit(new V3(S.endX(-1, q.y) - 1, q.y, q.z), new V3(1, 0, 0), "R");
        return h ? h.p.addScaledVector(h.n, 0.003) : null;
      }).filter(Boolean);
      var t = c.tube(P, 0.0038, MT.dark, { seg: P.length * 8, rs: 4 }); t.castShadow = false; c.deform.push(t); return t;
    };
    /* refletor vermelho no para-choque traseiro */
    K.reflector = function (sd, z0, y, w) {
      var Gd = sgrid(S, -1, sd, { z0: z0, z1: z0 + (w || 0.12), y0: y - 0.03, y1: y + 0.03, du: 0.03, dv: 0.03 });
      return skin(c, Gd, REFLR, { yb: y - 0.016, yt: y + 0.016, off: 0.03, nv: 1 });
    };
    /* grade sobre a lataria (região u0..u1 numa grade de largura toda) */
    K.grille = function (E, o) {
      var Gd = sgrid(S, E, 0, { z1: o.z1, y0: o.y0, y1: o.y1, du: 0.03, dv: 0.03 });
      var m = skin(c, Gd, grilleMat(o.tex || "mesh"), { u0: o.u0, u1: o.u1, yb: o.yb || o.y0, yt: o.yt || o.y1, off: o.off || 0.006, tile: o.tile || 0.07, nv: 3 });
      if (o.frame) outline(c, Gd, { u0: o.u0, u1: o.u1, yb: o.yb || o.y0, yt: o.yt || o.y1 }, o.frameR || 0.008, o.frame, (o.off || 0.006) + 0.002);
      m.userData.grid = Gd; return m;
    };
    return K;
  }

  function carro(c, s) {
    var W = s.W, gh = s.gh, bev = 0.05, T = { belt: gh.belt, top: gh.roof + bev, k: gh.k }, m = c.meta;
    m.col = s.col; m.kind = "car";
    var front = profX(s.lower, s.noseY, true), rear = profX(s.lower, s.tailY, false);
    var intr = s.interior === false ? null : Object.assign({ rows: 2 }, s.interior || {});
    var hoodO = s.hood ? Object.assign({ motor: "gasolina" }, s.hood === true ? {} : s.hood) : null;
    var tireW = 0.2; (s.wheels || []).forEach(function (w) { tireW = Math.max(tireW, w[2]); });
    var low = [];
    if (intr) low.push(ZG.holeTop(gh.rb + 0.05, gh.fb - 0.03, gh.Wg / 2 - 0.05, gh.belt - 0.3));
    var hx0 = gh.fb + 0.08, hx1 = front - (hoodO && hoodO.front != null ? hoodO.front : 0.2), zH = W / 2 - 0.13;
    if (hoodO) low.push(ZG.holeTop(hx0, hx1, zH, s.bottomY + 0.2, "capo"));
    var lowMesh = ZG.shell(c, { items: s.lower, bottomY: s.bottomY, arches: s.arches, W: W, col: s.col, holes: low, archInner: (intr || hoodO) ? W / 2 - tireW - 0.16 : null });
    var roofR = gh.roofR || gh.roof, crown = gh.crown || 0;
    var ghItems = [[gh.rb, gh.belt - 0.1, 0], [gh.rt, roofR, gh.r1 || 0.12]];
    if (crown || roofR !== gh.roof) ghItems.push([(gh.rt + gh.ft) / 2, (gh.roof + roofR) / 2 + crown, 0.6]);
    ghItems.push([gh.ft, gh.roof, gh.r2 || 0.2], [gh.fb, gh.belt - 0.1, 0]);
    var polys = windows(gh);
    if (s.dropRear) polys = polys.slice(1);
    /* gh.polys(polys): o modelo troca ou acrescenta janelas laterais (coluna C inclinada, vidro de coluna em fastback) */
    if (gh.polys) polys = gh.polys(polys);
    /* gh.qrSide / gh.qfSide: margem lateral do vidro traseiro / para-brisa (coluna mais larga vista de trás) */
    var qf = ZG.quadDef([gh.fb, gh.belt], [gh.ft, gh.roof], gh.Wg, T, "front", bev, { side: gh.qfSide }), qr = ZG.quadDef([gh.rb, gh.belt], [gh.rt, roofR], gh.Wg, T, "rear", bev, { side: gh.qrSide });
    var gHoles = [];
    if (intr) { polys.forEach(function (p) { gHoles.push(ZG.holeSide(p)); }); gHoles.push(ZG.holeQuad(qf), ZG.holeQuad(qr), ZG.holeWhere(function (n, ce) { return n.y < -0.7 && ce.y < gh.belt + 0.02; })); }
    /* teto em cor própria: não enferruja no batido (só fica fosco e sujo) */
    var roofMat = s.roofCol ? CM(c.st === "danificado" ? new THREE.Color(s.roofCol).multiplyScalar(0.82) : s.roofCol, { roughness: c.st === "danificado" ? 0.78 : 0.4, metalness: 0.3, side: THREE.DoubleSide }) : null;
    ZG.shell(c, { items: ghItems, W: gh.Wg, col: s.col, mat: roofMat, T: T, holes: gHoles, sub: intr ? 0.12 : 0.2 });
    ZG.sideWindows(c, polys, gh.Wg, T, function (i, n) { return i === 0 && n > 2 ? "Vidro lateral traseiro" : (i === n - 1 ? "Janela dianteira" : "Janela traseira"); }, { see: !!intr });
    ZG.glassQuad(c, qf, "Para-brisa", { see: !!intr });
    ZG.glassQuad(c, qr, "Vidro traseiro", { see: !!intr, mat: intr ? MT.tint : MT.glassDark });
    m.L = front - rear + 0.1; m.W = W; m.front = front + 0.05; m.rear = rear - 0.05; m.clear = s.bottomY; m.belt = gh.belt; m.top = gh.roof + bev; m.bodyH = gh.belt - s.bottomY;
    m.roof = { x0: gh.rt + 0.12, x1: gh.ft - 0.12, w: halfAt(gh.Wg, T, gh.roof) * 1.6, y: Math.max(gh.roof, roofR + crown) + bev + (s.rails ? (typeof s.rails === "number" ? s.rails : 0.1) - 0.03 : 0) };
    m.top = Math.max(gh.roof, roofR + crown) + bev;
    m.gh = gh; m.T = T; m.quadF = qf;
    /* tampão do porta-malas (hatch): cobre a borda recortada do casco vista pelo vidro traseiro */
    if (intr && s.shelf) { var sx0 = gh.rb + 0.03, sx1 = gh.rb + s.shelf; c.rb(sx1 - sx0, 0.014, gh.Wg - 0.24, 0.006, CM("#1b1c1e", { roughness: 0.92 }), (sx0 + sx1) / 2, gh.belt - 0.02, 0).castShadow = false; }
    if (intr) ZG.interior(c, Object.assign({ x0: gh.fb, ft: gh.ft, rb: gh.rb, rt: gh.rt, roof: Math.min(gh.roof, roofR), belt: gh.belt, floor: s.bottomY + 0.1, zIn: gh.Wg / 2 - 0.09, zRoof: halfAt(gh.Wg, T, gh.roof) - 0.12, xRear: gh.rb + 0.06 }, intr));
    if (hoodO) {
      var fa = -1e9; (s.arches || []).forEach(function (a) { fa = Math.max(fa, a[0]); });
      var hood = ZG.makeHood(c, lowMesh.userData.cut.capo, { x0: hx0, col: s.col });
      if (hood) ZG.engineBay(c, { x0: hx0 + 0.02, x1: hx1, zw: zH - 0.02, floor: s.bottomY + 0.12, top: hood.yMin - 0.035, motor: hoodO.motor, axle: fa, col: s.col });
    }
    var wo = Object.assign({ xF: front + 0.05, xR: rear - 0.05, hw: W / 2, Lf: 0.55, Lr: 0.45, bowF: 0.16, bowR: 0.12, pinF: 0.05, pinR: 0.04, yb: s.bottomY, ys: (s.bottomY + gh.belt) / 2 + 0.06, belt: gh.belt, kb: 0.06, kt: 0.035 }, s.warp || {});
    var Wf = mkWarp(wo);
    var S = mkSurf(lowMesh, W);
    detalhes(c, s, Wf, S);
    applyWarp(c, Wf);
    return m;
  }

  function detalhes(c, s, Wf, S) {
    var m = c.meta, W = s.W, hw = W / 2, by = s.bottomY, it = s.lower, gh = s.gh, T = m.T;
    var fx = function (y) { return profX(it, y, true); }, rx = function (y) { return profX(it, y, false); };
    var I = { fx: fx, rx: rx, W: W, hw: hw, by: by, gh: gh, T: T, Wf: Wf, S: S };
    I.fxB = S.endX(1, by + 0.2); I.rxB = S.endX(-1, by + 0.2);
    var K = mkKit(c, S, I); I.K = K;
    var paint = c.paint(s.col), bcol = s.bumperCol ? c.paint(s.bumperCol) : paint;
    /* frente e traseira de cada modelo */
    var fa = s.arches[0], ra = s.arches[1];
    var wrapF = Math.max(0.1, S.endX(1, by + 0.25) - 0.07 - (fa[0] + fa[2] + 0.06)), wrapR = Math.max(0.1, (ra[0] - ra[2] - 0.06) - S.endX(-1, by + 0.25) - 0.07);
    I.wrapF = wrapF; I.wrapR = wrapR;
    var bF = Object.assign({ y0: by + 0.01, y1: by + 0.3, mat: bcol }, s.bumperF || {}), bR = Object.assign({ y0: by + 0.01, y1: by + 0.32, mat: bcol }, s.bumperR || {});
    m.bumperF = K.bumper(1, { y0: bF.y0, y1: bF.y1, wrap: Math.min(wrapF, bF.wrap || 9), mat: bF.mat });
    m.bumperR = K.bumper(-1, { y0: bR.y0, y1: bR.y1, wrap: Math.min(wrapR, bR.wrap || 9), mat: bR.mat });
    I.bF = bF; I.bR = bR;
    /* saia preta do para-choque traseiro (difusor) e lábio dianteiro */
    var skG = K.grid(-1, 0, { wrap: Math.min(wrapR, 0.22), y0: by - 0.005, y1: by + 0.1, du: 0.03, dv: 0.03 });
    K.skin(skG, PLASTIC, { yb: by - 0.005, yt: by + (s.skirtH || 0.085), off: 0.03, thick: 0.03, nv: 3, shadow: true });
    for (var f = -2; f <= 2; f++) { var sf = skG.at(0.5 + f * 0.06, by + 0.035); c.rb(0.05, 0.05, 0.012, 0.004, PLASTIC, sf.p.x + 0.035 * sf.n.x, sf.p.y, sf.p.z + 0.035 * sf.n.z); }
    var lpG = K.grid(1, 0, { wrap: Math.min(wrapF, 0.18), y0: by - 0.005, y1: by + 0.06, du: 0.03, dv: 0.03 });
    K.skin(lpG, PLASTIC, { yb: by - 0.005, yt: by + 0.045, off: 0.03, thick: 0.03, nv: 2 });
    if (s.front) s.front(c, K, I);
    if (s.rear) s.rear(c, K, I);
    /* placas */
    K.plate(1, s.plateF || (bF.y0 + bF.y1) / 2, { off: 0.03 });
    K.plate(-1, s.plateR || (bR.y0 + bR.y1) / 2 + 0.03, { off: s.plateROnBumper === false ? 0.004 : 0.018 });
    /* colunas, retrovisores, frisos, maçanetas, saias */
    var tang = Math.atan(gh.Wg / 2 * gh.k / (T.top - T.belt));
    [1, -1].forEach(function (sd) {
      (s.blackPillars || []).forEach(function (px) {
        var ry = roofAt(gh, px), yc = (gh.belt + ry) / 2 + 0.005, hh = ry - gh.belt - 0.1;
        c.rb(0.118, hh, 0.003, 0.0015, GLOSS, px, yc, sd * (halfAt(gh.Wg, T, yc) + 0.004), { rot: [-sd * tang, 0, 0] }).castShadow = false;
      });
      var mx = gh.fb - 0.22, my = gh.belt + 0.09, mz0 = halfAt(gh.Wg, T, my), mcol = s.mirrorCol ? CM(s.mirrorCol, { roughness: 0.4, metalness: 0.3 }) : paint;
      c.rb(0.16, 0.05, 0.08, 0.02, MT.trim, mx + 0.03, my - 0.04, sd * (mz0 + 0.03));
      c.rb(0.12, 0.12, 0.2, 0.05, mcol, mx, my + 0.02, sd * (mz0 + 0.14), { taper: { sx: 0.8, shift: -0.01 } });
      c.rb(0.02, 0.09, 0.16, 0.02, MT.chrome, mx - 0.065, my + 0.02, sd * (mz0 + 0.14));
      if (s.mirrorBlink !== false) c.rb(0.02, 0.012, 0.12, 0.005, MT.amber, mx + 0.03, my - 0.025, sd * (mz0 + 0.17));
      /* fresta de porta: x (da soleira à cintura) ou [x, y0, y1] (porta traseira que contorna a caixa de roda: não pode cruzar o vão da roda) */
      (s.seams || []).forEach(function (q) {
        var x = q.length ? q[0] : q, y0 = q.length ? q[1] : by + 0.09, y1 = q.length ? q[2] : gh.belt - 0.03;
        c.rb(0.008, y1 - y0, 0.006, 0.003, MT.dark, x, (y0 + y1) / 2, sd * (hw + 0.001));
      });
      (s.handles || []).forEach(function (x) { c.rb(0.15, 0.03, 0.02, 0.012, s.handleCol ? CM(s.handleCol, { metalness: 0.6, roughness: 0.3 }) : MT.chrome, x, gh.belt - 0.09, sd * (hw + 0.004)); });
      if (s.arches && s.arches.length > 1) {
        var x0 = s.arches[1][0] + s.arches[1][2] + 0.02, x1 = s.arches[0][0] - s.arches[0][2] - 0.02;
        c.rb(x1 - x0, 0.08, 0.035, 0.015, MT.trim, (x0 + x1) / 2, by + 0.05, sd * (hw - 0.008));
        if (s.clad) s.arches.forEach(function (a) {
          var a0 = Math.asin(clamp((by - a[1]) / a[2], -1, 1)), tor = c.add(new THREE.TorusGeometry(a[2] + 0.02, 0.035, 6, 26, PI - 2 * a0), MT.trim, a[0], a[1], sd * (hw - 0.01));
          tor.rotation.z = a0; tor.scale.z = 0.8;
        });
      }
      if (s.chromeBelt) c.rb(gh.fb - gh.rb - 0.3, 0.012, 0.008, 0.004, MT.chrome, (gh.fb + gh.rb) / 2 - 0.05, gh.belt + 0.035, sd * (halfAt(gh.Wg, T, gh.belt + 0.035) + 0.004));
    });
    /* grade de ventilação preta na base do para-brisa (cobre a borda recortada entre o capô e o vidro) */
    var cwh = S.hit(new V3(gh.fb + 0.03, 3, 0), new V3(0, -1, 0)), cwy = cwh ? cwh.p.y : gh.belt;
    c.rb(0.15, 0.02, gh.Wg - 0.06, 0.008, PLASTIC, gh.fb + 0.02, cwy + 0.004, 0).castShadow = false;
    /* limpadores, antena */
    var wy = gh.belt + 0.06, wx = gh.fb - 0.03;
    /* limpadores deitados sobre o para-brisa (seguem a inclinação do vidro); s.wiper = 1 é o limpador único central */
    var wd = new V3(gh.ft - gh.fb, gh.roof - gh.belt, 0).normalize(), wn = new V3(wd.y, -wd.x, 0);
    /* faixa preta serigrafada na base do para-brisa (esconde a borda recortada da estufa atrás do vidro) */
    var fr = new V3(gh.fb, gh.belt, 0).addScaledVector(wd, 0.065).addScaledVector(wn, 0.047), frw = 2 * (halfAt(gh.Wg, T, gh.belt + 0.05) - 0.07);
    c.rb(0.14, 0.006, frw, 0.003, PLASTIC, fr.x, fr.y, 0, { rot: [0, 0, Math.atan2(wd.y, wd.x)] }).castShadow = false;
    (s.wiper === 1 ? [[0.12, 0.66, -0.5]] : [[-0.3, 0.42, -0.36], [0.2, 0.42, -0.36]]).forEach(function (q) {
      var p0 = new V3(gh.fb, gh.belt, q[0]).addScaledVector(wd, 0.07).addScaledVector(wn, 0.035), p1 = p0.clone().addScaledVector(wd, q[1] * 0.42); p1.z += q[2];
      c.rod(p0, p1, 0.009, MT.trim);
      c.cyl(0.018, 0.018, 0.03, MT.trim, p0.x, p0.y, p0.z);
    });
    if (s.fin !== false) c.sph(0.1, s.roofCol ? c.paint(s.roofCol) : GLOSS, gh.rt + 0.2, roofAt(gh, gh.rt + 0.2) + 0.045, 0, 1.0, 0.45, 0.28, { tl: PI / 2 });
    if (s.spoiler) c.rb(0.2, 0.04, gh.Wg * 0.78, 0.02, s.roofCol ? c.paint(s.roofCol) : paint, gh.rt - 0.02, roofAt(gh, gh.rt) + 0.01, 0, { rot: [0, 0, -0.12] });
    if (s.rails) [1, -1].forEach(function (sd) {
      var z = sd * (halfAt(gh.Wg, T, gh.roof) - 0.1), x0 = gh.rt + 0.08, x1 = gh.ft - 0.08, rh = typeof s.rails === "number" ? s.rails : 0.1;
      var rl = c.rod(new V3(x0, roofAt(gh, x0) + rh, z), new V3(x1, roofAt(gh, x1) + rh, z), 0.018, MT.trim); c.deform.push(rl); (m.rails = m.rails || []).push(rl);
      [x0 + 0.04, x1 - 0.04].forEach(function (x) { m.rails.push(c.rb(0.1, rh - 0.03, 0.04, 0.015, MT.trim, x, roofAt(gh, x) + rh / 2 + 0.015, z, { def: true })); });
    });
    /* rodas (fora do warp; acompanham a curvatura da lateral) */
    (s.wheels || []).forEach(function (w, wi) {
      /* s.track = [bitola dianteira, traseira] (centro do pneu); sem ela, o pneu encosta na lateral */
      var zw = s.track ? s.track[wi] / 2 : hw * (1 - Wf.sec(w[1])) - w[2] / 2 + 0.02;
      [1, -1].forEach(function (sd) { c.wheel(w[0], sd * zw, w[1], w[2], w[3] || {}); });
    });
    underbody(c, s, I);
    if (s.extra) s.extra(c, I);
    if (!c.parts.some(function (p) { return p.kind === "motor"; })) c.part("motor", "Motor", null, new V3(m.front - 0.6, by + 0.45, 0), 1.0);
    if (!c.parts.some(function (p) { return p.kind === "radiador"; }) && !s.noRadiator) c.part("radiador", "Radiador", null, new V3(m.front - 0.15, by + 0.35, 0), 0.9);
    c.part("tanque", s.tankLabel || "Tanque de combustível", null, new V3(m.rear + 0.8, by + 0.15, -W * 0.22), 1.0);
    return I;
  }
  /* assoalho visto ao capotar: chapa preta fosca, escapamento, tanque, eixos e braços de suspensão */
  function underbody(c, s, I) {
    var by = I.by, fa = s.arches[0], ra = s.arches[1], m = c.meta, x0 = I.rxB + 0.12, x1 = I.fxB - 0.12, zi = I.hw - 0.3, y = by - 0.008;
    c.rb(x1 - x0, 0.016, zi * 2, 0.006, UNDER, (x0 + x1) / 2, y, 0).castShadow = false;
    [1, -1].forEach(function (sd) { c.rb(fa[0] - ra[0] - 0.8, 0.05, 0.06, 0.015, UNDER2, (fa[0] + ra[0]) / 2, y - 0.02, sd * (zi - 0.06)); });
    c.rb(fa[0] - ra[0] - 0.9, 0.08, 0.2, 0.03, UNDER, (fa[0] + ra[0]) / 2, y - 0.025, 0);
    if (s.hood && !(s.hood.motor === "eletrico")) {
      c.rb(0.42, 0.08, 0.36, 0.03, UNDER2, fa[0] + 0.12, y - 0.04, 0);
      var ex = s.exhaust !== false;
      if (ex) {
        c.tube([[fa[0] - 0.05, y - 0.03, 0.12], [fa[0] - 0.5, y - 0.05, 0.1], [ra[0] + 0.6, y - 0.05, 0.1], [ra[0] - 0.1, y - 0.06, 0.28], [I.rxB + 0.08, y - 0.03, 0.38]], 0.025, EXH, { seg: 50 });
        c.cyl(0.075, 0.075, 0.36, EXH, (fa[0] + ra[0]) / 2, y - 0.07, 0.1, "x");
        c.rb(0.42, 0.13, 0.3, 0.05, EXH, ra[0] - 0.35, y - 0.06, 0.32);
        c.cyl(0.032, 0.03, 0.16, EXH, I.rxB - 0.0, by + 0.04, 0.42, "x");
      }
    }
    c.rb(0.5, 0.18, 0.62, 0.05, CM("#1c1e20", { roughness: 0.7 }), ra[0] + 0.55, y - 0.07, -0.2);
    c.rod(new V3(ra[0], ra[1], -I.hw + 0.32), new V3(ra[0], ra[1], I.hw - 0.32), 0.04, UNDER2);
    [1, -1].forEach(function (sd) {
      c.rod(new V3(ra[0], ra[1], sd * (I.hw - 0.36)), new V3(ra[0] + 0.42, by - 0.01, sd * (I.hw - 0.42)), 0.03, UNDER2);
      c.rod(new V3(fa[0], fa[1], sd * (I.hw - 0.32)), new V3(fa[0], fa[1] + 0.02, sd * 0.12), 0.02, MT.steel);
      c.rod(new V3(fa[0] - 0.04, fa[1] - 0.06, sd * (I.hw - 0.3)), new V3(fa[0] + 0.25, by - 0.02, sd * 0.3), 0.025, UNDER2);
      c.rod(new V3(fa[0] - 0.04, fa[1] - 0.06, sd * (I.hw - 0.3)), new V3(fa[0] - 0.3, by - 0.02, sd * 0.3), 0.022, UNDER2);
    });
  }
  function wheelOpts(kind) {
    if (kind === "alloy") return { rim: ALLOY, spokes: 5, rimR: 0.62 };
    if (kind === "alloy2") return { rim: ALLOYD, spokeMat: ALLOY, spokes: 10, rimR: 0.64 };
    if (kind === "hubcap") return { rim: HUBCAP, spokes: 0, rimR: 0.6 };
    if (kind === "steel") return { rim: CM("#2b2d30", { metalness: 0.4, roughness: 0.5 }), spokes: 0, rimR: 0.58 };
    if (kind === "steelg") return { rim: CM("#8e9398", { metalness: 0.55, roughness: 0.4 }), spokes: 8, rimR: 0.6, spokeMat: CM("#6e7378", { metalness: 0.5, roughness: 0.45 }) };
    if (kind === "aero") return { rim: EVRIM, spokeMat: ALLOYD, spokes: 12, rimR: 0.64 };
    return {};
  }
  /* blindagem do modificado: a padrão do núcleo e um extra por modelo */
  function armorPlus(fn) { return function (c, Z) { Z.applyArmor(c); fn(c, Z); }; }
  function roofLamp(c, x, y, z) { c.cyl(0.07, 0.055, 0.1, MT.steel, x, y, z, "x"); c.cyl(0.06, 0.06, 0.012, MT.head, x + 0.055, y, z, "x"); }
  function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  /* grade na lateral (u ao longo de x, de x0 até x1) */
  function sideGrid(S, sd, o) {
    var nu = Math.max(4, Math.ceil(Math.abs(o.x1 - o.x0) / 0.04)), nv = Math.max(2, Math.ceil((o.y1 - o.y0) / 0.03)), P = [], N = [];
    for (var i = 0; i <= nu; i++) {
      P.push([]); N.push([]);
      for (var j = 0; j <= nv; j++) {
        var x = o.x0 + (o.x1 - o.x0) * i / nu, y = o.y0 + (o.y1 - o.y0) * j / nv, O = new V3(x, y, sd * (S.hw + 1)), D = new V3(0, 0, -sd);
        var h = S.hit(O, D, "M") || { p: new V3(x, y, sd * S.hw), n: new V3(0, 0, sd) }; P[i].push(h.p); N[i].push(h.n);
      }
    }
    var G = { P: P, N: N, nu: nu, nv: nv, y0: o.y0, y1: o.y1, len: Math.abs(o.x1 - o.x0) };
    G.at = function (u, y) {
      var fi = clamp(u, 0, 1) * nu, fj = clamp((y - o.y0) / (o.y1 - o.y0), 0, 1) * nv, i0 = Math.min(nu - 1, Math.floor(fi)), j0 = Math.min(nv - 1, Math.floor(fj)), a = fi - i0, b = fj - j0;
      function L(M) { return M[i0][j0].clone().multiplyScalar((1 - a) * (1 - b)).addScaledVector(M[i0 + 1][j0], a * (1 - b)).addScaledVector(M[i0][j0 + 1], (1 - a) * b).addScaledVector(M[i0 + 1][j0 + 1], a * b); }
      return { p: L(P), n: L(N).normalize() };
    };
    G.ux = function (x) { return (x - o.x0) / (o.x1 - o.x0); };
    return G;
  }
  /* luz de neblina redonda (decorativa) na superfície */
  function fogLamp(c, s, r) {
    onSurf(c.cyl(r * 1.4, r * 1.4, 0.014, LH, 0, 0, 0), s, 0.006).castShadow = false;
    onSurf(c.cyl(r, r, 0.012, REFL, 0, 0, 0), s, 0.012).castShadow = false;
    onSurf(c.sph(r * 0.45, MT.head, 0, 0, 0, 1, 0.5, 1), s, 0.016).castShadow = false;
  }

  /* vinco de lataria (linha de caráter): degrau fino na cor do carro que segue a lateral por pontos [x, y], com um filete de sombra embaixo */
  function crease(c, I, sd, pts, o) {
    o = o || {};
    var x0 = pts[0][0], x1 = pts[pts.length - 1][0], lo = 9, hi = -9;
    pts.forEach(function (q) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); });
    var h = o.h || 0.03, Gd = sideGrid(I.S, sd, { x0: x0, x1: x1, y0: lo - h - 0.03, y1: hi + 0.03 });
    function yAt(u) {
      var x = x0 + (x1 - x0) * u;
      for (var i = 0; i < pts.length - 1; i++) { var a = pts[i], b = pts[i + 1]; if ((x - a[0]) * (x - b[0]) <= 0) { var t = (x - a[0]) / ((b[0] - a[0]) || 1); return a[1] + (b[1] - a[1]) * sm(t) ; } }
      return pts[pts.length - 1][1];
    }
    I.K.skin(Gd, o.mat || c.paint(o.col), { yb: function (u) { return yAt(u) - h; }, yt: yAt, off: o.off || 0.006, thick: 0.009, nv: 2, u0: o.u0 || 0.01, u1: o.u1 || 0.99 });
    var l = []; for (var k = 0; k <= 30; k++) { var u = (o.u0 || 0.01) + k / 30 * ((o.u1 || 0.99) - (o.u0 || 0.01)); l.push([u, yAt(u) - h - 0.001]); }
    lineOn(c, Gd, l, 0.003, o.shade || SHADE, 0.003);
    return Gd;
  }
  var SHADE = CM("#000000", { roughness: 1, transparent: true, opacity: 0.45, depthWrite: false });
  /* friso cromado da linha das janelas (DLO): segue a base dos vidros e pode subir na coluna C (pts [x, y] na lateral do vidro) */
  function dloChrome(c, I, sd, pts, r) {
    var gh = I.gh, T = I.T, P = pts.map(function (q) { return [q[0], q[1], sd * (halfAt(gh.Wg, T, q[1]) + 0.012)]; });
    var t = c.tube(P, r || 0.007, MT.chrome, { seg: P.length * 10, rs: 5 }); t.castShadow = false; c.deform.push(t); return t;
  }

  /* ================= utilidades do grupo G ================= */
  var CHROMEH = CM("#c9cdd0", { metalness: 0.85, roughness: 0.25 });
  /* cromo claro para peças grandes e planas viradas para a câmera (sem mapa de ambiente o cromo metálico fica preto) */
  var CHROMEB = CM("#d4d8db", { metalness: 0.5, roughness: 0.24 });
  var VINYL = "#2e2622";
  /* lente acesa canelada dos faróis antigos (frisos verticais de vidro) */
  var LENSLIT = (function () {
    var cv = document.createElement("canvas"); cv.width = 64; cv.height = 16; var x = cv.getContext("2d");
    for (var i = 0; i < 64; i++) { var t = 0.5 + 0.5 * Math.cos(i / 64 * PI * 2 * 8); x.fillStyle = "rgb(" + Math.round(170 + 70 * t) + "," + Math.round(166 + 66 * t) + "," + Math.round(150 + 60 * t) + ")"; x.fillRect(i, 0, 1, 16); }
    var tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 1);
    return new THREE.MeshStandardMaterial({ color: "#ffffff", map: tx, emissive: new THREE.Color("#e8dcb8"), emissiveMap: tx, emissiveIntensity: 0.75, roughness: 0.25, metalness: 0.2 });
  })();
  /* refletor claro para faróis de lâmpada (o cromo puro, sem mapa de ambiente, renderiza quase preto) */
  var REFLB = CM("#d3d7da", { metalness: 0.35, roughness: 0.28 });
  /* troca a janela da porta traseira (e acrescenta a de coluna) mantendo a dianteira automática */
  function dlo(list) { return function (def) { return list.concat([def[def.length - 1]]); }; }
  /* estufa que afina em planta para trás (colunas C convergindo): fator de largura acima da cintura */
  function cabTaper(belt, top, x0, L, a) { return function (x, y) { return 1 - a * sm((y - belt) / (top - belt)) * sm((x0 - x) / L); }; }
  function hubChrome() { return { rim: CHROMEB, spokes: 0, rimR: 0.62 }; }
  /* superfície do capô (ponto e normal) por raio vertical, para peças coladas nele (respiros) */
  function hoodHit(c, x, z) {
    if (!c.hood) return null;
    c.root.updateMatrixWorld(true);
    var top = c.hood.piv.children[0], rc = new THREE.Raycaster(), inv = new THREE.Matrix4().copy(c.g.matrixWorld).invert();
    rc.set(new V3(x, 4, z).applyMatrix4(c.g.matrixWorld), new V3(0, -1, 0));
    var h = rc.intersectObject(top, false)[0]; if (!h) return null;
    var p = h.point.clone().applyMatrix4(inv), n = h.face.normal.clone().transformDirection(top.matrixWorld).transformDirection(inv);
    if (n.y < 0) n.negate();
    return { p: p, n: n };
  }
  /* peça presa no capô (abre junto): converte de c.g para o pivô */
  function onHood(c, m) {
    var piv = c.hood.piv; c.g.remove(m); m.position.sub(piv.position); piv.add(m); c.deform.push(m); return m;
  }
  /* calha de teto (borracha preta) dos carros antigos */
  function gutter(c, gh, T, mat) {
    [1, -1].forEach(function (sd) {
      var pts = [], z = function (y) { return sd * (halfAt(gh.Wg, T, y) - 0.004); };
      for (var x = gh.ft - 0.04; x >= gh.rt + 0.04; x -= 0.08) { var y = roofAt(gh, x) + 0.012; pts.push([x, y, z(y)]); }
      var t = c.tube(pts, 0.009, mat || MT.trim, { seg: pts.length * 4, rs: 4 }); t.castShadow = false; c.deform.push(t);
    });
  }

  /* ================= Unno Mille (Fiat Uno Mille) ================= */
  /* Referência: Fiat Uno Mille Economy Way 1.0 Fire 2011 (fichacompleta.com.br)
     Medidas reais: comprimento 3,693 · largura 1,548 · altura 1,489 (Way, com barras; ≈ 1,445 sem barras) · entre-eixos 2,361
       · bitola 1,337 / 1,357 · pneu 175/70 R13 (Ø 0,575) · vão livre 0,190 · balanços ≈ 0,70 / 0,63 (de memória).
     Traços de assinatura:
       frente: faróis retangulares retos, rentes à lataria, com pisca âmbar no canto de fora; grade preta baixa e larga entre os faróis
         com frisos horizontais e emblema; para-choque preto de plástico com fenda de ar.
       lateral: caixote: cintura baixa e reta, vidros grandes e verticais, coluna B preta, janelinha fixa atrás da porta traseira,
         molduras pretas nas caixas de roda e na soleira (Way), friso preto de proteção nas portas.
       traseira: tampa quase vertical com vidro grande; lanternas verticais altas nas quinas, em faixas (vermelha, âmbar e ré);
         placa na tampa.
       teto: teto reto e comprido, calhas de chuva, limpador único no para-brisa; escada de alumínio no rack (o "Uno com escada"). */
  ZG.register({ k: "uno", grp: "Carros", n: "Unno Mille", insp: "Fiat Uno Mille", c: "Hatch popular quadrado", fuel: "flex",
    d: "O quadradinho que sobreviveu a tudo. Leve, alto do chão e com peça em qualquer ferro-velho. Este veio com a escada do eletricista no teto: serve para subir em muro e telhado.",
    mass: 820, r: 62, seats: "5", cap: "50 L", eff: "12,8 km/L (G) · 9,0 km/L (E)", auto: "640 km", vmax: 153, skill: "Mecânica 1 (peça em qualquer ferro-velho)", hood: true
  }, function (c) {
    var hex = "#e2ddd0";
    carro(c, {
      W: 1.548, col: hex, track: [1.337, 1.357], bottomY: 0.21, noseY: 0.7, tailY: 0.84, wiper: 1, fin: false, mirrorBlink: false,
      lower: [[-1.71, 0.24, 0.04], [-1.735, 0.5, 0.08], [-1.72, 0.88, 0.05], [-1.685, 0.93, 0.02], [0.7, 0.915, 0], [1.12, 0.855, 0.2], [1.76, 0.775, 0.06], [1.795, 0.62, 0.07], [1.78, 0.24, 0.04]],
      arches: [[1.17, 0.29, 0.33], [-1.191, 0.29, 0.33]],
      gh: { rb: -1.68, rt: -1.6, ft: 0.14, fb: 0.72, belt: 0.92, roof: 1.39, roofR: 1.385, crown: 0.006, rise: 0.0, Wg: 1.46, k: 0.1, pillars: [-0.42, -1.3], r1: 0.07, r2: 0.1 },
      seams: [0.69, -0.42, [-1.3, 0.62, 0.89]], handles: [0.12, -0.86], handleCol: "#1b1c1e", blackPillars: [-0.42], clad: true, rails: 0.07,
      bumperF: { y1: 0.5, mat: CM("#232426", { roughness: 0.75 }) }, bumperR: { y1: 0.52, mat: CM("#232426", { roughness: 0.75 }) }, skirtH: 0.05,
      plateF: 0.38, plateR: 0.72, plateROnBumper: false, mirrorCol: "#1b1c1e",
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          K.head(sd, { z0: 0.3, wrap: 0.03, shape: function () { return [0.625, 0.745]; }, proj: [], refl: REFL, drl: [{ mat: LENSLIT, u0: 0.03, u1: 0.83, yb: 0.635, yt: 0.735 }],
            amber: [{ u0: 0.84, u1: 0.99, yb: 0.632, yt: 0.738 }] });
        });
        K.grille(1, { z1: 0.3, y0: 0.6, y1: 0.76, u0: 0.02, u1: 0.98, yb: 0.635, yt: 0.735, tex: "barsd", tile: 0.045, frame: MT.trim, frameR: 0.007 });
        var e = K.grid(1, 0, { z1: 0.2, y0: 0.64, y1: 0.74, du: 0.03, dv: 0.03 }).at(0.5, 0.69); ZG.emblem(c, e.p.x + 0.02, 0.69, 0, 0.032);
        var lw = K.grid(1, 0, { z1: 0.5, y0: 0.28, y1: 0.42, du: 0.03, dv: 0.03 });
        K.skin(lw, grilleMat("slots"), { u0: lw.uz(-0.42), u1: lw.uz(0.42), yb: 0.31, yt: 0.37, off: 0.021, tile: 0.05, nv: 2 });
        /* frisos do para-choque preto */
        var bg = c.meta.bumperF.userData.grid; lineOn(c, bg, [[0.03, 0.44], [0.5, 0.44], [0.97, 0.44]], 0.006, MT.dark, 0.018);
      },
      rear: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          K.tail(sd, { z0: I.hw - 0.22, wrap: 0.035, shape: function () { return [0.6, 0.905]; },
            hi: [{ u0: 0.05, u1: 0.95, yb: 0.79, yt: 0.89 }], amber: [{ u0: 0.05, u1: 0.95, yb: 0.705, yt: 0.775 }],
            rev: [{ u0: 0.05, u1: 0.95, yb: 0.62, yt: 0.69 }] });
          K.reflector(sd, I.hw - 0.26, 0.4, 0.12);
        });
        K.lid([{ y: 0.95, z: -0.52 }, { y: 0.6, z: -0.52 }, { y: 0.56, z: -0.49 }, { y: 0.56, z: 0.49 }, { y: 0.6, z: 0.52 }, { y: 0.95, z: 0.52 }]);
        c.rb(0.03, 0.05, 0.16, 0.012, MT.trim, I.S.endX(-1, 0.84) - 0.01, 0.84, 0.0);
      },
      interior: { rows: 2, col: "#4a4c52", trim: "#26272a" }, hood: { motor: "gasolina" },
      wheels: [[1.17, 0.2875, 0.175, wheelOpts("hubcap")], [-1.191, 0.2875, 0.175, wheelOpts("hubcap")]],
      warp: { bowF: 0.07, bowR: 0.04, Lf: 0.4, Lr: 0.3, pinF: 0.02, pinR: 0.01, kt: 0.02, kb: 0.04 },
      extra: function (c, I) {
        var gh = I.gh;
        gutter(c, gh, I.T);
        [1, -1].forEach(function (sd) {
          /* friso preto de proteção nas portas */
          var Gs = sideGrid(I.S, sd, { x0: 0.95, x1: -1.62, y0: 0.5, y1: 0.6 });
          I.K.skin(Gs, CM("#1d1e20", { roughness: 0.7 }), { yb: 0.53, yt: 0.575, off: 0.008, thick: 0.012, nv: 1, u0: 0.01, u1: 0.99 });
        });
        /* antena de mastro na frente do teto */
        var an = c.rod(new V3(gh.ft - 0.12, roofAt(gh, gh.ft - 0.12) + 0.04, -0.55), new V3(gh.ft - 0.42, roofAt(gh, gh.ft - 0.12) + 0.5, -0.55), 0.004, MT.trim); c.deform.push(an);
        I.antenna = an;
      }
    });
    /* escada de alumínio presa nas barras: pertence ao teto (amassa e some com ele) */
    var m = c.meta, ry = m.roof.y + 0.03, esc = [];
    [1, -1].forEach(function (sd) { esc.push(c.rb(1.9, 0.045, 0.035, 0.008, MT.alu, -0.75, ry, sd * 0.2, { def: true })); });
    for (var x = -1.62; x <= 0.14; x += 0.29) esc.push(c.rb(0.035, 0.03, 0.4, 0.01, MT.alu, x, ry, 0, { def: true }));
    [-1.45, 0.0].forEach(function (x) { esc.push(c.rb(0.05, 0.04, 0.5, 0.01, CM("#a8321d", { roughness: 0.8 }), x, ry + 0.035, 0)); });
    c.zone("teto", null, null, esc.concat(m.rails || []));
    m.top = ry + 0.04; m.roof.y = ry + 0.04;
    m.armor = armorPlus(function (c) { ZG.jerry(c, -0.9, m.roof.y + 0.2, 0.35, "#8e2a20"); ZG.jerry(c, -0.9, m.roof.y + 0.2, -0.35, "#2f5b2a"); });
  });

  /* ================= Gól G5 (Volkswagen Gol G5) ================= */
  /* Referência: Volkswagen Gol G5 2009–2012 (autoo.com.br, Power 1.6 2010; fichacompleta.com.br)
     Medidas reais: comprimento 3,899 · largura 1,656 · altura 1,464 · entre-eixos 2,465 · bitola ≈ 1,43 / 1,42 (de memória)
       · pneu 175/70 R14 na versão 1.0 (Ø 0,601; 195/55 R15 no Power) · vão livre 0,163 · balanços ≈ 0,78 / 0,66 (de memória).
     Traços de assinatura:
       frente: faróis grandes em trapézio, com o canto de dentro alto e a base subindo para fora; grade superior estreita com dois frisos
         e o emblema redondo no meio; para-choque com tomada inferior larga e faróis de neblina redondos.
       lateral: cintura subindo de leve para trás, coluna C larga sem vidro, vinco reto na altura das maçanetas, porta traseira curta.
       traseira: lanternas horizontais em cunha, que dobram a quina e entram na tampa; placa na tampa num rebaixo; aerofólio no teto.
       teto: teto que cai na traseira, antena no alto do para-brisa. */
  ZG.register({ k: "gol", grp: "Carros", n: "Gól G5", insp: "Volkswagen Gol G5", c: "Hatch compacto", fuel: "flex",
    d: "O carro mais vendido de uma década inteira. Mecânica conhecida, suspensão firme e porta-malas pequeno. Fácil de achar parado em qualquer rua.",
    mass: 935, r: 60, seats: "5", cap: "55 L", eff: "12,9 km/L (G) · 8,9 km/L (E)", auto: "700 km", vmax: 168, skill: "—", hood: true
  }, function (c) {
    var hex = "#a7acb1";
    carro(c, {
      W: 1.656, col: hex, shelf: 0.42, bottomY: 0.22, noseY: 0.72, tailY: 0.86, fin: false,
      lower: [[-1.818, 0.25, 0.05], [-1.858, 0.5, 0.12], [-1.838, 0.86, 0.1], [-1.768, 0.99, 0.05], [0.56, 0.97, 0], [1.06, 0.9, 0.35], [1.84, 0.78, 0.13], [1.91, 0.57, 0.13], [1.88, 0.25, 0.05]],
      arches: [[1.2, 0.3, 0.34], [-1.265, 0.3, 0.34]],
      gh: { rb: -1.79, rt: -1.45, ft: -0.08, fb: 0.68, belt: 0.96, roof: 1.415, roofR: 1.31, crown: 0.035, rise: 0.07, Wg: 1.52, k: 0.2, pillars: [-0.5, -1.2], r1: 0.16, r2: 0.22, qrSide: 0.15,
        /* porta traseira com a borda de trás inclinada como a coluna C larga */
        polys: dlo([[[-1.36, 1.065], [-0.56, 1.035], [-0.56, 1.345], [-1.08, 1.305]]]) }, dropRear: true,
      seams: [0.64, -0.5, [-1.27, 0.67, 0.93]], handles: [0.12, -0.86], blackPillars: [-0.5],
      bumperF: { y1: 0.6 }, bumperR: { y1: 0.58 },
      plateF: 0.43, plateR: 0.74, plateROnBumper: false, spoiler: true,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.635 + 0.065 * sm(u); }, yt = function (u) { return 0.785 - 0.012 * u; };
          K.head(sd, { z0: 0.34, wrap: 0.13, shape: function (u) { return [yb(u), yt(u)]; }, refl: REFLB, proj: [[0.26, 0.004, 0.04], [0.55, 0.008, 0.033]],
            amber: [{ u0: 0.78, u1: 0.98, yb: function (u) { return yb(u) + 0.006; }, yt: function (u) { return yb(u) + 0.03; } }] });
        });
        K.grille(1, { z1: 0.35, y0: 0.64, y1: 0.79, u0: 0.02, u1: 0.98, yb: 0.665, yt: 0.765, tex: "barsd", tile: 0.05, frame: MT.trim, frameR: 0.006 });
        var bar = K.grid(1, 0, { z1: 0.36, y0: 0.68, y1: 0.75, du: 0.03, dv: 0.025 });
        lineOn(c, bar, [[0.02, 0.718], [0.5, 0.718], [0.98, 0.718]], 0.007, MT.chrome, 0.012);
        var e = bar.at(0.5, 0.716); ZG.emblem(c, e.p.x + 0.02, 0.716, 0, 0.045);
        var lw = K.grid(1, 0, { z1: 0.62, y0: 0.27, y1: 0.5, du: 0.03, dv: 0.03 }), zt = 0.48, zb = 0.4, y0 = 0.3, y1 = 0.47;
        function yB(u) { var z = Math.abs(lw.zu(u)); return z <= zb ? y0 : y0 + (y1 - y0) * (z - zb) / (zt - zb) * 0.6; }
        K.skin(lw, grilleMat("mesh"), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.06, nv: 3 });
        outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.006, LH, 0.022);
        [1, -1].forEach(function (sd) {
          var Gc = K.grid(1, sd, { z0: 0.52, wrap: 0.05, y0: 0.3, y1: 0.48, du: 0.02, dv: 0.02 });
          K.skin(Gc, LH, { yb: 0.33, yt: 0.45, off: 0.021, nv: 3 });
          var s2 = Gc.at(0.4, 0.39); s2.p.addScaledVector(s2.n, 0.018); fogLamp(c, s2, 0.036);
        });
      },
      rear: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.78 + 0.05 * u; }, yt = function (u) { return 0.97 - 0.035 * u; };
          K.tail(sd, { z0: 0.45, wrap: 0.19, shape: function (u) { return [yb(u), yt(u)]; },
            hi: [{ u0: 0.06, u1: 0.96, yb: function (u) { return yt(u) - 0.035; }, yt: function (u) { return yt(u) - 0.012; } }],
            amber: [{ u0: 0.06, u1: 0.3, yb: function (u) { return yb(u) + 0.045; }, yt: function (u) { return yb(u) + 0.075; } }],
            rev: [{ u0: 0.06, u1: 0.3, yb: function (u) { return yb(u) + 0.01; }, yt: function (u) { return yb(u) + 0.04; } }] });
          K.reflector(sd, I.hw - 0.26, 0.4, 0.1);
        });
        K.lid([{ y: 1.0, z: -0.445 }, { y: 0.64, z: -0.445 }, { y: 0.6, z: -0.41 }, { y: 0.6, z: 0.41 }, { y: 0.64, z: 0.445 }, { y: 1.0, z: 0.445 }]);
        var cb = K.grid(-1, 0, { z1: 0.42, y0: 0.82, y1: 0.9, du: 0.03, dv: 0.03 });
        lineOn(c, cb, [[0.02, 0.86], [0.5, 0.86], [0.98, 0.86]], 0.005, MT.dark, 0.004);
        ZG.emblem(c, I.S.endX(-1, 0.9) - 0.012, 0.9, 0, 0.04).rotation.y = PI;
      },
      interior: { rows: 2, col: "#34363b" }, hood: { motor: "gasolina" },
      wheels: [[1.2, 0.3, 0.175, wheelOpts("alloy")], [-1.265, 0.3, 0.175, wheelOpts("alloy")]],
      warp: { bowF: 0.15, bowR: 0.14, Lf: 0.5, Lr: 0.48, kt: 0.05, zx: cabTaper(0.96, 1.36, -0.3, 1.4, 0.07) },
      extra: function (c, I) {
        var gh = I.gh;
        [1, -1].forEach(function (sd) {
          crease(c, I, sd, [[1.75, 0.8], [0.6, 0.82], [-0.6, 0.835], [-1.82, 0.85]], { col: hex, h: 0.024 });
          crease(c, I, sd, [[0.9, 0.46], [-0.95, 0.47]], { col: hex, h: 0.02 });
        });
        var an = c.rod(new V3(gh.ft - 0.1, roofAt(gh, gh.ft - 0.1) + 0.04, 0), new V3(gh.ft - 0.4, roofAt(gh, gh.ft - 0.1) + 0.42, 0), 0.004, MT.trim); c.deform.push(an);
      }
    });
    c.meta.armor = armorPlus(function (c) {
      var m = c.meta, fx = m.front + 0.05;
      [0.45, -0.45].forEach(function (z) { c.tube([[fx - 0.15, 0.32, z], [fx, 0.36, z], [fx + 0.02, 0.68, z], [fx - 0.08, 0.76, z]], 0.03, ZG.STEELM); });
      c.rod(new V3(fx + 0.01, 0.55, -0.55), new V3(fx + 0.01, 0.55, 0.55), 0.03, ZG.STEELM);
      var t = c.add(new THREE.TorusGeometry(0.22, 0.08, 10, 22), MT.rubber, -0.9, m.roof.y + 0.11, 0); t.rotation.x = PI / 2;
    });
  });

  /* ================= HB-21 (Hyundai HB20) ================= */
  /* Referência: Hyundai HB20 2023+ (reestilização; fichacompleta.com.br, Comfort 1.0 2023)
     Medidas reais: comprimento 4,015 · largura 1,720 · altura 1,470 · entre-eixos 2,530 · bitola ≈ 1,50 / 1,51 (de memória)
       · pneu 185/60 R15 (Ø 0,603) · vão livre 0,160 · balanços ≈ 0,80 / 0,68 (de memória).
     Traços de assinatura:
       frente: grade enorme que ocupa a frente inteira, de ponta a ponta, em padrão geométrico; faróis finos no alto dos cantos,
         colados no capô; luzes diurnas verticais nos cantos do para-choque.
       lateral: vinco de ombro forte subindo para a lanterna; linha das janelas subindo atrás e "quebrando" na coluna C;
         coluna B preta; caixas de roda marcadas.
       traseira: lanternas finas ligadas por uma faixa preta com filete vermelho de ponta a ponta na tampa; placa no para-choque;
         aerofólio no teto.
       teto: teto caindo para trás, antena barbatana. */
  ZG.register({ k: "hb21", grp: "Carros", n: "HB-21", insp: "Hyundai HB20", c: "Hatch compacto", fuel: "flex",
    d: "Hatch moderno de frota de aplicativo. Econômico, confortável e cheio de eletrônica que ninguém mais sabe consertar.",
    mass: 993, r: 58, seats: "5", cap: "50 L", eff: "13,9 km/L (G) · 9,9 km/L (E)", auto: "690 km", vmax: 161, skill: "—", hood: true
  }, function (c) {
    var hex = "#c9c2b2";
    carro(c, {
      W: 1.72, col: hex, shelf: 0.42, bottomY: 0.23, noseY: 0.74, tailY: 0.9,
      lower: [[-1.9, 0.26, 0.05], [-1.94, 0.52, 0.13], [-1.92, 0.86, 0.1], [-1.84, 1.01, 0.06], [0.66, 0.98, 0], [1.2, 0.9, 0.4], [1.87, 0.79, 0.15], [1.94, 0.56, 0.15], [1.91, 0.26, 0.05]],
      arches: [[1.21, 0.302, 0.345], [-1.32, 0.302, 0.345]],
      gh: { rb: -1.84, rt: -1.42, ft: -0.1, fb: 0.68, belt: 0.98, roof: 1.42, roofR: 1.33, crown: 0.03, rise: 0.09, Wg: 1.6, k: 0.22, pillars: [-0.47, -1.24], r1: 0.16, r2: 0.25, qrSide: 0.16,
        /* linha das janelas que sobe e "quebra" para cima na coluna C (assinatura do HB20) */
        polys: dlo([[[-1.42, 1.165], [-1.22, 1.07], [-0.53, 1.04], [-0.53, 1.35], [-1.12, 1.31]]]) }, dropRear: true,
      seams: [0.64, -0.47, [-1.3, 0.67, 0.95]], handles: [0.2, -0.76], blackPillars: [-0.47],
      bumperF: { y1: 0.42 }, bumperR: { y1: 0.62 },
      plateF: 0.33, plateR: 0.48, spoiler: true,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.735 + 0.01 * u; }, yt = function (u) { return 0.785 + 0.004 * u; };
          K.head(sd, { z0: 0.36, wrap: 0.16, shape: function (u) { return [yb(u), yt(u)]; }, proj: [[0.38, 0.0, 0.019], [0.56, 0.0, 0.019]], pad: 0.008,
            drl: [{ u0: 0.04, u1: 0.97, yb: function (u) { return yt(u) - 0.012; }, yt: function (u) { return yt(u) - 0.004; } }] });
          /* luz diurna vertical no canto do para-choque */
          var Gc = K.grid(1, sd, { z0: 0.6, wrap: 0.07, y0: 0.32, y1: 0.66, du: 0.02, dv: 0.02 });
          K.skin(Gc, LH, { u0: 0.15, u1: 0.75, yb: 0.36, yt: 0.62, off: 0.024, nv: 3 });
          K.skin(Gc, DRL, { u0: 0.3, u1: 0.4, yb: 0.39, yt: 0.6, off: 0.027, nv: 2 });
        });
        /* grade enorme de ponta a ponta (padrão geométrico) */
        var g = K.grid(1, 0, { z1: 0.62, y0: 0.4, y1: 0.73, du: 0.03, dv: 0.03 });
        function yT(u) { var z = Math.abs(g.zu(u)); return 0.715 - 0.03 * sm((z - 0.3) / 0.3); }
        K.skin(g, grilleMat("diamond"), { u0: g.uz(-0.6), u1: g.uz(0.6), yb: 0.44, yt: yT, off: 0.022, tile: 0.055, nv: 4 });
        outline(c, g, { u0: g.uz(-0.6), u1: g.uz(0.6), yb: 0.44, yt: yT }, 0.007, MT.chrome, 0.024);
        var e = g.at(0.5, 0.66); ZG.emblem(c, e.p.x + 0.03, 0.66, 0, 0.04);
      },
      rear: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.85 + 0.01 * u; }, yt = function (u) { return 0.925 - 0.008 * u; };
          K.tail(sd, { z0: 0.48, wrap: 0.17, shape: function (u) { return [yb(u), yt(u)]; },
            hi: [{ u0: 0.04, u1: 0.97, yb: function (u) { return yt(u) - 0.022; }, yt: function (u) { return yt(u) - 0.01; } }],
            rev: [{ u0: 0.08, u1: 0.3, yb: function (u) { return yb(u) + 0.008; }, yt: function (u) { return yb(u) + 0.03; } }] });
          K.reflector(sd, I.hw - 0.26, 0.4, 0.1);
        });
        /* faixa preta com filete vermelho ligando as lanternas */
        var bg = K.grid(-1, 0, { z1: 0.5, y0: 0.84, y1: 0.93, du: 0.02, dv: 0.02 });
        K.skin(bg, LH, { yb: 0.86, yt: 0.915, off: 0.003, nv: 2 });
        var bar = K.skin(bg, TAILHI, { yb: 0.894, yt: 0.904, off: 0.008, nv: 1 }), bl = K.skin(bg, MT.lensRed, { yb: 0.89, yt: 0.908, off: 0.012, nv: 1, order: 3 });
        regLight(c, "lanterna", "Faixa de lanterna", [bar], [bl], bg.at(0.5, 0.9).p);
        K.lid([{ y: 1.0, z: -0.47 }, { y: 0.66, z: -0.47 }, { y: 0.63, z: -0.44 }, { y: 0.63, z: 0.44 }, { y: 0.66, z: 0.47 }, { y: 1.0, z: 0.47 }]);
        ZG.emblem(c, I.S.endX(-1, 0.8) - 0.012, 0.8, 0, 0.035).rotation.y = PI;
      },
      interior: { rows: 2, col: "#2a2b2f" }, hood: { motor: "gasolina" },
      wheels: [[1.21, 0.302, 0.185, wheelOpts("alloy2")], [-1.32, 0.302, 0.185, wheelOpts("alloy2")]],
      warp: { bowF: 0.19, bowR: 0.15, Lf: 0.6, Lr: 0.5, kt: 0.05, zx: cabTaper(0.98, 1.38, -0.3, 1.4, 0.07) },
      extra: function (c, I) {
        [1, -1].forEach(function (sd) {
          crease(c, I, sd, [[1.8, 0.79], [0.7, 0.82], [-0.6, 0.86], [-1.88, 0.91]], { col: hex, h: 0.03 });
          crease(c, I, sd, [[0.95, 0.5], [-0.2, 0.51], [-0.95, 0.56]], { col: hex, h: 0.02 });
        });
      }
    });
    c.meta.armor = armorPlus(function (c) { var r = c.meta.roof; roofLamp(c, r.x1, r.y + 0.2, 0.32); roofLamp(c, r.x1, r.y + 0.2, -0.32); });
  });

  /* ================= Pólo (Volkswagen Polo) ================= */
  /* Referência: Volkswagen Polo 1.0 TSI 2023 (Brasil, reestilização; fichacompleta.com.br)
     Medidas reais: comprimento 4,074 · largura 1,751 · altura 1,471 · entre-eixos 2,566 · bitola 1,524 / 1,506
       · pneu 185/65 R15 (Ø 0,621) · vão livre 0,149 · balanços ≈ 0,81 / 0,70 (de memória).
     Traços de assinatura:
       frente: faróis finos e retos ligados por um filete de LED que atravessa a grade estreita; emblema no meio do filete;
         grade inferior larga em colmeia com entradas laterais.
       lateral: vinco "tornado" afiado e reto do farol à lanterna, passando pelas maçanetas; coluna C muito larga;
         linha das janelas quase reta; vinco baixo nas portas.
       traseira: lanternas horizontais divididas entre a lataria e a tampa; emblema grande no meio (abre a tampa); placa na tampa.
       teto: teto reto, aerofólio curto, barbatana. */
  ZG.register({ k: "polo", grp: "Carros", n: "Pólo", insp: "Volkswagen Polo", c: "Hatch compacto", fuel: "flex",
    d: "Motor turbo pequeno e bem firme na estrada. Rápido para fugir, econômico para viajar, mas a eletrônica sofre com a falta de oficina.",
    mass: 1112, r: 58, seats: "5", cap: "52 L", eff: "15,0 km/L (G) · 10,4 km/L (E)", auto: "780 km", vmax: 197, skill: "—", hood: true
  }, function (c) {
    var hex = "#8c2b2b";
    carro(c, {
      W: 1.751, col: hex, shelf: 0.42, bottomY: 0.22, noseY: 0.74, tailY: 0.9,
      lower: [[-1.913, 0.26, 0.05], [-1.953, 0.52, 0.13], [-1.933, 0.88, 0.1], [-1.863, 1.0, 0.05], [0.7, 0.99, 0], [1.25, 0.92, 0.4], [1.92, 0.8, 0.15], [1.99, 0.58, 0.15], [1.96, 0.26, 0.05]],
      arches: [[1.25, 0.31, 0.35], [-1.316, 0.31, 0.35]],
      gh: { rb: -1.86, rt: -1.5, ft: -0.12, fb: 0.72, belt: 0.99, roof: 1.42, roofR: 1.37, crown: 0.025, rise: 0.03, Wg: 1.6, k: 0.21, pillars: [-0.48, -1.28], r1: 0.15, r2: 0.25, qrSide: 0.17,
        /* linha das janelas quase reta e coluna C larga, com a borda de trás da porta inclinada */
        polys: dlo([[[-1.42, 1.04], [-0.54, 1.03], [-0.54, 1.335], [-1.12, 1.32]]]) }, dropRear: true,
      seams: [0.68, -0.48, [-1.34, 0.68, 0.96]], handles: [0.22, -0.78], blackPillars: [-0.48],
      bumperF: { y1: 0.58 }, bumperR: { y1: 0.6 },
      plateF: 0.42, plateR: 0.73, plateROnBumper: false, spoiler: true,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.665 + 0.012 * u; }, yt = function (u) { return 0.745 + 0.018 * u; };
          K.head(sd, { z0: 0.34, wrap: 0.18, shape: function (u) { return [yb(u), yt(u)]; }, proj: [[0.36, -0.006, 0.026], [0.6, -0.006, 0.026]],
            drl: [{ u0: 0.03, u1: 0.97, yb: function (u) { return yt(u) - 0.016; }, yt: function (u) { return yt(u) - 0.006; } }] });
        });
        K.grille(1, { z1: 0.35, y0: 0.64, y1: 0.76, u0: 0.02, u1: 0.98, yb: 0.665, yt: 0.735, tex: "barsd", tile: 0.045, frame: GLOSS, frameR: 0.005 });
        /* filete de LED atravessando a grade e ligando os faróis */
        var bar = K.grid(1, 0, { z1: 0.36, y0: 0.72, y1: 0.76, du: 0.02, dv: 0.02 });
        var led = K.skin(bar, DRL, { yb: 0.738, yt: 0.745, off: 0.012, nv: 1 });
        var e = bar.at(0.5, 0.735); ZG.emblem(c, e.p.x + 0.025, 0.71, 0, 0.045);
        var lw = K.grid(1, 0, { z1: 0.66, y0: 0.28, y1: 0.52, du: 0.03, dv: 0.03 }), zt = 0.46, zb = 0.38, y0 = 0.31, y1 = 0.49;
        function yB(u) { var z = Math.abs(lw.zu(u)); return z <= zb ? y0 : y0 + (y1 - y0) * (z - zb) / (zt - zb) * 0.5; }
        K.skin(lw, grilleMat("mesh"), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.05, nv: 3 });
        outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.006, LH, 0.022);
        [1, -1].forEach(function (sd) {
          var Gc = K.grid(1, sd, { z0: 0.54, wrap: 0.08, y0: 0.3, y1: 0.52, du: 0.02, dv: 0.02 });
          K.skin(Gc, grilleMat("mesh"), { u0: 0.08, u1: 0.8, yb: 0.34, yt: function (u) { return 0.49 - 0.06 * u; }, off: 0.021, tile: 0.05, nv: 3 });
          outline(c, Gc, { u0: 0.08, u1: 0.8, yb: 0.34, yt: function (u) { return 0.49 - 0.06 * u; } }, 0.005, LH, 0.022);
        });
      },
      rear: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.84 + 0.015 * u; }, yt = function (u) { return 0.955 - 0.012 * u; };
          K.tail(sd, { z0: 0.36, wrap: 0.2, shape: function (u) { return [yb(u), yt(u)]; },
            hi: [{ u0: 0.05, u1: 0.96, yb: function (u) { return yt(u) - 0.03; }, yt: function (u) { return yt(u) - 0.016; } }, { u0: 0.05, u1: 0.96, yb: function (u) { return yb(u) + 0.014; }, yt: function (u) { return yb(u) + 0.026; } }],
            rev: [{ u0: 0.08, u1: 0.28, yb: function (u) { return yb(u) + 0.03; }, yt: function (u) { return yb(u) + 0.06; } }] });
          K.reflector(sd, I.hw - 0.26, 0.42, 0.1);
        });
        K.lid([{ y: 1.0, z: -0.47 }, { y: 0.88, z: -0.47 }, { y: 0.88, z: -0.36 }, { y: 0.64, z: -0.36 }, { y: 0.6, z: -0.33 }, { y: 0.6, z: 0.33 }, { y: 0.64, z: 0.36 }, { y: 0.88, z: 0.36 }, { y: 0.88, z: 0.47 }, { y: 1.0, z: 0.47 }]);
        ZG.emblem(c, I.S.endX(-1, 0.88) - 0.012, 0.88, 0, 0.055).rotation.y = PI;
      },
      interior: { rows: 2, col: "#26272b", trim: "#1a1b1e" }, hood: { motor: "gasolina" },
      wheels: [[1.25, 0.31, 0.185, wheelOpts("alloy")], [-1.316, 0.31, 0.185, wheelOpts("alloy")]],
      warp: { bowF: 0.18, bowR: 0.15, Lf: 0.6, Lr: 0.5, kt: 0.05, zx: cabTaper(0.99, 1.4, -0.3, 1.45, 0.07) },
      extra: function (c, I) {
        [1, -1].forEach(function (sd) {
          /* vinco "tornado": reto e afiado, alto */
          crease(c, I, sd, [[1.85, 0.83], [0.4, 0.84], [-1.0, 0.85], [-1.95, 0.86]], { col: hex, h: 0.03 });
          crease(c, I, sd, [[0.95, 0.48], [-0.95, 0.48]], { col: hex, h: 0.018 });
        });
      }
    });
    c.meta.armor = armorPlus(function (c) {
      var r = c.meta.roof, y = r.y + 0.1;
      [r.x0 + 0.1, r.x1 - 0.1].forEach(function (x) { c.rb(0.05, 0.04, r.w * 1.1, 0.01, ZG.STEELM, x, y, 0); });
      [1, -1].forEach(function (sd) { c.rb(r.x1 - r.x0, 0.12, 0.03, 0.01, ZG.STEELM, (r.x0 + r.x1) / 2, y + 0.06, sd * r.w * 0.55); });
      c.rb(0.6, 0.25, 0.4, 0.04, CM("#4b5130", { roughness: 0.9 }), (r.x0 + r.x1) / 2, y + 0.15, 0);
    });
  });

  /* ================= Cívico (Honda Civic G10) ================= */
  /* Referência: Honda Civic sedã G10 2017–2021 (autoo.com.br, EXL 2.0 2017)
     Medidas reais: comprimento 4,637 · largura 1,799 · altura 1,433 · entre-eixos 2,700 · bitola ≈ 1,547 / 1,563 (de memória)
       · pneu 215/50 R17 (Ø 0,647) · vão livre ≈ 0,135 (de memória) · balanços ≈ 0,93 / 1,01 (de memória).
     Traços de assinatura:
       frente: barra cromada grossa ("asa") por cima da grade, entrando nos faróis; faróis afilados com sobrancelha de LED;
         grade inferior trapezoidal enorme e molduras pretas em "C" nos cantos.
       lateral: perfil fastback: teto em arco longo que desce direto até a tampa curta; vidrinho na coluna C; vinco baixo forte que
         sobe das portas para a lanterna; cintura alta.
       traseira: lanternas em bumerangue ("C") finas que entram na tampa e descem pela lateral; tampa curta com lábio de aerofólio.
       teto: teto baixo e longo, barbatana. */
  ZG.register({ k: "civico", grp: "Carros", n: "Cívico", insp: "Honda Civic G10", c: "Sedã médio fastback", fuel: "flex",
    d: "Sedã baixo e largo, de motor que gira alto. Corre muito na estrada, mas raspa o para-choque em qualquer lombada ou monte de entulho.",
    mass: 1291, r: 62, seats: "5", cap: "56 L", eff: "12,1 km/L (G) · 8,5 km/L (E)", auto: "680 km", vmax: 200, skill: "—", hood: true
  }, function (c) {
    var hex = "#5a5f66";
    carro(c, {
      W: 1.799, col: hex, bottomY: 0.2, noseY: 0.68, tailY: 0.92,
      lower: [[-2.257, 0.24, 0.06], [-2.297, 0.52, 0.14], [-2.277, 0.86, 0.1], [-2.167, 0.975, 0.08], [-1.98, 0.97, 0.03], [0.8, 0.95, 0], [1.46, 0.86, 0.45], [2.124, 0.72, 0.15], [2.214, 0.5, 0.15], [2.174, 0.24, 0.06]],
      arches: [[1.35, 0.3235, 0.365], [-1.35, 0.3235, 0.365]],
      gh: { rb: -1.96, rt: -0.95, ft: -0.14, fb: 0.82, belt: 0.97, roof: 1.38, roofR: 1.34, crown: 0.03, rise: 0.04, Wg: 1.62, k: 0.22, pillars: [-0.45, -1.12], r1: 0.4, r2: 0.3, qrSide: 0.2,
        /* fastback de 4 portas: vidro da porta traseira e o vidrinho de coluna que corre por baixo do caimento do teto */
        polys: dlo([[[-1.6, 1.035], [-1.1, 1.025], [-1.08, 1.235]], [[-1.03, 1.02], [-0.51, 1.01], [-0.51, 1.31], [-0.95, 1.285]]]) },
      seams: [0.78, -0.45, [-1.06, 0.57, 0.94]], handles: [0.3, -0.72], blackPillars: [-0.45], mirrorCol: hex,
      bumperF: { y1: 0.54 }, bumperR: { y1: 0.6 },
      plateF: 0.4, plateR: 0.79, plateROnBumper: false,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.6 + 0.07 * sm(u * 1.2); }, yt = function (u) { return 0.69 + 0.045 * sm(u); };
          K.head(sd, { z0: 0.38, wrap: 0.26, shape: function (u) { return [yb(u), yt(u)]; }, proj: [[0.28, 0.0, 0.022], [0.4, 0.0, 0.022], [0.52, 0.0, 0.022]],
            drl: [{ u0: 0.05, u1: 0.95, yb: function (u) { return yt(u) - 0.014; }, yt: function (u) { return yt(u) - 0.004; } }],
            amber: [{ u0: 0.66, u1: 0.95, yb: function (u) { return yb(u) + 0.004; }, yt: function (u) { return yb(u) + 0.016; } }] });
        });
        /* grade superior preta e a "asa" cromada por cima dela */
        K.grille(1, { z1: 0.4, y0: 0.56, y1: 0.7, u0: 0.04, u1: 0.96, yb: 0.585, yt: 0.665, tex: "mesh", tile: 0.045, frame: GLOSS, frameR: 0.005 });
        var wg = K.grid(1, 0, { z1: 0.46, y0: 0.64, y1: 0.72, du: 0.02, dv: 0.02 });
        K.skin(wg, CHROMEB, { u0: 0.01, u1: 0.99, yb: function (u) { var z = Math.abs(wg.zu(u)); return 0.66 + 0.014 * sm((z - 0.3) / 0.12); }, yt: function (u) { var z = Math.abs(wg.zu(u)); return 0.705 + 0.008 * sm((z - 0.3) / 0.12); }, off: 0.018, thick: 0.014, nv: 2 });
        var e = wg.at(0.5, 0.63); ZG.emblem(c, e.p.x + 0.03, 0.625, 0, 0.042);
        var lw = K.grid(1, 0, { z1: 0.62, y0: 0.24, y1: 0.5, du: 0.03, dv: 0.03 }), zt = 0.54, zb = 0.42, y0 = 0.27, y1 = 0.47;
        function yB(u) { var z = Math.abs(lw.zu(u)); return z <= zb ? y0 : y0 + (y1 - y0) * (z - zb) / (zt - zb) * 0.7; }
        K.skin(lw, grilleMat("mesh"), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.05, nv: 3 });
        outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.007, LH, 0.022);
        [1, -1].forEach(function (sd) {
          /* moldura em "C" no canto com o farol de neblina */
          var Gc = K.grid(1, sd, { z0: 0.6, wrap: 0.1, y0: 0.26, y1: 0.54, du: 0.02, dv: 0.02 });
          K.skin(Gc, LH, { u0: 0.05, u1: 0.95, yb: 0.29, yt: function (u) { return 0.5 - 0.05 * u; }, off: 0.021, nv: 3 });
          var s2 = Gc.at(0.38, 0.36); s2.p.addScaledVector(s2.n, 0.018); fogLamp(c, s2, 0.03);
        });
      },
      rear: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          /* bumerangue: fino na tampa, alto na quina, descendo pela lateral */
          var yb = function (u) { return 0.885 - 0.13 * sm((u - 0.35) / 0.55); }, yt = function (u) { return 0.925 - 0.01 * u; };
          K.tail(sd, { z0: 0.24, wrap: 0.24, shape: function (u) { return [yb(u), yt(u)]; },
            hi: [{ u0: 0.02, u1: 0.97, yb: function (u) { return yt(u) - 0.016; }, yt: function (u) { return yt(u) - 0.006; } }, { u0: 0.86, u1: 0.95, yb: function (u) { return yb(u) + 0.006; }, yt: function (u) { return yt(u) - 0.006; } }],
            rev: [{ u0: 0.5, u1: 0.66, yb: function (u) { return yb(u) + 0.01; }, yt: function (u) { return yb(u) + 0.05; } }] });
          K.reflector(sd, I.hw - 0.26, 0.38, 0.12);
        });
        K.lid([{ y: 0.94, z: -0.5 }, { y: 0.7, z: -0.5 }, { y: 0.66, z: -0.47 }, { y: 0.66, z: 0.47 }, { y: 0.7, z: 0.5 }, { y: 0.94, z: 0.5 },
          { top: true, x: -2.187, z: 0.6 }, { top: true, x: -2.047, z: 0.66 }, { top: true, x: -1.877, z: 0.64 }, { top: true, x: -1.847, z: 0.42 }, { top: true, x: -1.847, z: -0.42 }, { top: true, x: -1.877, z: -0.64 }, { top: true, x: -2.047, z: -0.66 }, { top: true, x: -2.187, z: -0.6 }, { y: 0.94, z: -0.5 }]);
        var cb = K.grid(-1, 0, { z1: 0.3, y0: 0.84, y1: 0.9, du: 0.03, dv: 0.03 });
        lineOn(c, cb, [[0.02, 0.87], [0.5, 0.87], [0.98, 0.87]], 0.007, MT.chrome, 0.006);
        ZG.emblem(c, I.S.endX(-1, 0.87) - 0.016, 0.87, 0, 0.035).rotation.y = PI;
      },
      interior: { rows: 2, col: "#1e1f22", trim: "#15161a" }, hood: { motor: "gasolina" },
      wheels: [[1.35, 0.3235, 0.215, wheelOpts("alloy2")], [-1.35, 0.3235, 0.215, wheelOpts("alloy2")]],
      warp: { bowF: 0.21, bowR: 0.13, Lf: 0.65, zx: cabTaper(0.97, 1.36, -0.5, 1.3, 0.06) },
      extra: function (c, I) {
        [1, -1].forEach(function (sd) {
          crease(c, I, sd, [[1.95, 0.79], [0.6, 0.84], [-1.0, 0.87], [-2.2, 0.9]], { col: hex, h: 0.024 });
          crease(c, I, sd, [[0.95, 0.42], [0.0, 0.45], [-0.9, 0.58], [-1.5, 0.7]], { col: hex, h: 0.03 });
        });
        /* lábio de aerofólio na ponta da tampa */
        var lip = I.K.grid(-1, 0, { z1: 0.62, y0: 0.9, y1: 1.0, du: 0.03, dv: 0.02 });
        c.meta.lip = I.K.skin(lip, c.paint(hex), { u0: 0.08, u1: 0.92, yb: 0.935, yt: 0.975, off: 0.012, thick: 0.02, nv: 2 });
      }
    });
    /* o lábio do aerofólio é da tampa do porta-malas (amassa, pende e some com ela) */
    c.zone("tampa", "Tampa do porta-malas", null, [c.meta.lip]);
    c.meta.armor = armorPlus(function (c) {
      var g = c.meta.gh;
      for (var z = -0.6; z <= 0.61; z += 0.15) c.rod(new V3(g.fb + 0.02, g.belt + 0.04, z), new V3(g.ft + 0.05, g.roof - 0.04, z * 0.92), 0.012, ZG.STEELM);
    });
  });

  /* ================= Opalla Comodoro (Chevrolet Opala Comodoro) ================= */
  /* Referência: Chevrolet Opala Comodoro sedã 4 portas 1985–1987 (fichacompleta.com.br, Diplomata 4.1 1988, mesma carroceria;
       carzin.com.br, Comodoro 1985)
     Medidas reais: comprimento 4,844 (para-choques de 1985 em diante; ≈ 4,80 em algumas fichas) · largura 1,766 · altura 1,408
       · entre-eixos 2,667 · bitola 1,432 / 1,410 · pneu 195/70 R14 (Ø 0,629) · vão livre 0,130 · balanços ≈ 0,98 / 1,20 (de memória).
     Traços de assinatura:
       frente: frente reta e larga; um farol retangular grande de cada lado; grade cromada de frisos horizontais ocupando todo o vão
         entre os faróis; piscas âmbar que dobram a quina; para-choque de lâmina cromada com faixa de borracha.
       lateral: sedã de três volumes, capô longo e reto, porta-malas comprido; cintura reta e baixa com friso cromado;
         calhas de chuva cromadas; teto de vinil escuro (Comodoro); friso lateral de borracha; calotas cromadas.
       traseira: lanternas retangulares largas e baixas no painel traseiro, com a placa entre elas; tampa do porta-malas reta;
         para-choque cromado.
       teto: teto reto e alto, vidro traseiro bem inclinado, coluna C larga. */
  ZG.register({ k: "opala", grp: "Carros", n: "Opalla Comodoro", insp: "Chevrolet Opala Comodoro", art: "no", c: "Sedã clássico (seis cilindros)", fuel: "gasolina",
    d: "Seis cilindros em linha, tração traseira e lataria grossa de chapa antiga. Bebe muito, mas aguenta pancada e empurra carro parado da rua.",
    mass: 1330, r: 78, seats: "5 (6 apertados)", cap: "84 L", eff: "7,6 km/L", auto: "640 km", vmax: 170, skill: "Mecânica 1 (motor simples, carburador)", hood: true
  }, function (c) {
    var hex = "#5e1a1c";
    carro(c, {
      W: 1.766, col: hex, track: [1.432, 1.41], roofCol: VINYL, bottomY: 0.24, noseY: 0.7, tailY: 0.78, fin: false, mirrorBlink: false, mirrorCol: "#c4c8cb",
      lower: [[-2.467, 0.28, 0.04], [-2.502, 0.5, 0.06], [-2.497, 0.84, 0.05], [-2.457, 0.895, 0.03], [-1.62, 0.905, 0], [0.62, 0.9, 0], [1.25, 0.86, 0.25], [2.16, 0.815, 0.05], [2.2, 0.7, 0.05], [2.18, 0.28, 0.04]],
      arches: [[1.3, 0.3145, 0.355], [-1.367, 0.3145, 0.355]],
      gh: { rb: -1.6, rt: -1.18, ft: 0.06, fb: 0.68, belt: 0.91, roof: 1.355, roofR: 1.355, crown: 0.005, rise: 0.0, Wg: 1.62, k: 0.14, pillars: [-0.52, -1.26], r1: 0.08, r2: 0.09 },
      seams: [0.64, -0.52, [-1.28, 0.68, 0.88]], handles: [0.24, -0.9], handleCol: "#c4c8cb", chromeBelt: true,
      bumperF: { y0: 0.3, y1: 0.47, mat: CHROMEB }, bumperR: { y0: 0.3, y1: 0.48, mat: CHROMEB }, skirtH: 0.05,
      plateF: 0.38, plateR: 0.66, plateROnBumper: false,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          /* farol retangular grande e o pisca âmbar que dobra a quina */
          K.head(sd, { z0: 0.42, z1: 0.7, wrap: 0, shape: function () { return [0.59, 0.745]; }, proj: [], drl: [{ mat: LENSLIT, u0: 0.04, u1: 0.96, yb: 0.6, yt: 0.735 }], bezel: CHROMEH, pad: 0.014 });
          K.head(sd, { z0: 0.725, wrap: 0.12, shape: function () { return [0.6, 0.735]; }, label: "Pisca " + (sd > 0 ? "direito" : "esquerdo"), pad: 0.008, bezel: CHROMEH,
            amber: [{ u0: 0.02, u1: 0.98, yb: 0.605, yt: 0.73 }] });
        });
        K.grille(1, { z1: 0.42, y0: 0.56, y1: 0.78, u0: 0.01, u1: 0.99, yb: 0.585, yt: 0.755, tex: "bars", tile: 0.03, frame: CHROMEB, frameR: 0.009 });
        var e = K.grid(1, 0, { z1: 0.1, y0: 0.64, y1: 0.72, du: 0.03, dv: 0.03 }).at(0.5, 0.67); ZG.emblem(c, e.p.x + 0.025, 0.67, 0, 0.045);
        /* faixa de borracha no para-choque cromado */
        var bg = c.meta.bumperF.userData.grid; c.deform.push(K.skin(bg, MT.rubber, { u0: 0.02, u1: 0.98, yb: 0.37, yt: 0.405, off: 0.02, nv: 1 }));
      },
      rear: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          K.tail(sd, { z0: 0.27, wrap: 0.08, shape: function () { return [0.57, 0.765]; }, pad: 0.012,
            hi: [{ u0: 0.36, u1: 0.98, yb: 0.6, yt: 0.74 }], amber: [{ u0: 0.18, u1: 0.34, yb: 0.6, yt: 0.74 }],
            rev: [{ u0: 0.03, u1: 0.16, yb: 0.6, yt: 0.74 }] });
        });
        var pn = K.grid(-1, 0, { z1: 0.28, y0: 0.56, y1: 0.78, du: 0.03, dv: 0.03 });
        K.skin(pn, CHROMEH, { yb: 0.565, yt: 0.58, off: 0.006, nv: 1 }); K.skin(pn, CHROMEH, { yb: 0.755, yt: 0.77, off: 0.006, nv: 1 });
        var bg = c.meta.bumperR.userData.grid; c.deform.push(K.skin(bg, MT.rubber, { u0: 0.02, u1: 0.98, yb: 0.37, yt: 0.405, off: 0.02, nv: 1 }));
        K.lid([{ top: true, x: -2.447, z: -0.66 }, { top: true, x: -2.447, z: 0.66 }, { top: true, x: -1.68, z: 0.66 }, { top: true, x: -1.68, z: -0.66 }, { top: true, x: -2.447, z: -0.66 }]);
      },
      interior: { rows: 2, col: "#6a4a36", trim: "#3a2a20" }, hood: { motor: "gasolina", front: 0.08 },
      wheels: [[1.3, 0.3145, 0.195, hubChrome()], [-1.367, 0.3145, 0.195, hubChrome()]],
      warp: { bowF: 0.05, bowR: 0.04, Lf: 0.35, Lr: 0.3, pinF: 0.02, pinR: 0.02, kt: 0.02, kb: 0.04 },
      extra: function (c, I) {
        gutter(c, I.gh, I.T, CHROMEH);
        [1, -1].forEach(function (sd) {
          /* friso de borracha com filete cromado na lateral */
          var Gs = sideGrid(I.S, sd, { x0: 2.1, x1: -2.4, y0: 0.5, y1: 0.6 });
          I.K.skin(Gs, MT.rubber, { yb: 0.535, yt: 0.565, off: 0.008, thick: 0.012, nv: 1, u0: 0.01, u1: 0.99 });
          I.K.skin(Gs, CHROMEH, { yb: 0.546, yt: 0.554, off: 0.0105, nv: 1, u0: 0.012, u1: 0.988 });
          /* emblema "seis cilindros" no para-lama dianteiro */
          c.text("4100", 0.14, 0.04, 1.75, 0.66, sd * (I.hw + 0.004), sd > 0 ? "+z" : "-z", { fg: "#d6d8da", bg: "rgba(0,0,0,0)", size: 0.8 });
        });
        /* enfeite de capô */
        I.hoodOrn = true;
      }
    });
    c.meta.armor = armorPlus(function (c) {
      var m = c.meta, fx = m.front + 0.06;
      c.rb(0.06, 0.38, 1.7, 0.02, ZG.STEELM, fx, 0.42, 0, { rot: [0, 0, -0.25] });
      [0.6, 0, -0.6].forEach(function (z) { c.rod(new V3(fx - 0.25, 0.4, z), new V3(fx, 0.45, z), 0.03, ZG.STEELM); });
    });
  });

  /* ================= Mustangue GT (Ford Mustang GT) ================= */
  /* Referência: Ford Mustang GT S650 2024+ (en.wikipedia.org; autotijd.be)
     Medidas reais: comprimento 4,810 · largura 1,915 (sem retrovisores) · altura 1,394 · entre-eixos 2,719 · bitola 1,585 / 1,642
       · pneus 255/40 R19 (Ø 0,687) na frente e 275/40 R19 (Ø 0,703) atrás · vão livre ≈ 0,13 (de memória)
       · balanços ≈ 0,92 / 1,17 (de memória).
     Traços de assinatura:
       frente: capô longo com dois respiros; grade grande em trapézio de colmeia, quase da altura da frente; faróis finos e angulosos
         nos cantos com as três barras verticais de LED (tri-bar); lábio dianteiro preto.
       lateral: fastback de 2 portas: teto em arco que desce até a tampa curta; porta muito comprida; vidro traseiro lateral
         triangular; ombro largo (anca) sobre a roda traseira e cintura das portas mais estreita (vista de cima).
       traseira: três barras verticais de lanterna em cada lado, num painel preto; quatro ponteiras de escape; difusor preto;
         aerofólio curto na tampa.
       teto: teto baixo e largo, vidro traseiro muito deitado. */
  ZG.register({ k: "mustang", grp: "Carros", n: "Mustangue GT", insp: "Ford Mustang GT", c: "Cupê esportivo V8", fuel: "gasolina",
    d: "V8 de cinco litros e tração traseira. O mais rápido da garagem em reta, mas o ronco acorda a horda de quarteirões inteiros e o tanque some rápido.",
    mass: 1800, r: 120, seats: "4 (2 + 2 apertados)", cap: "61 L", eff: "7,2 km/L", auto: "440 km", vmax: 250, skill: "Direção 2 (tração traseira, traseira solta)", hood: true
  }, function (c) {
    var hex = "#2f5bb0";
    carro(c, {
      W: 1.915, col: hex, track: [1.585, 1.642], bottomY: 0.2, noseY: 0.7, tailY: 0.86, fin: false,
      lower: [[-2.44, 0.27, 0.06], [-2.48, 0.52, 0.12], [-2.46, 0.82, 0.1], [-2.36, 0.93, 0.08], [-1.95, 0.93, 0.03], [0.48, 0.925, 0], [1.25, 0.87, 0.45], [2.17, 0.8, 0.04], [2.215, 0.72, 0.05], [2.19, 0.5, 0.12], [2.15, 0.27, 0.06]],
      arches: [[1.35, 0.3435, 0.385], [-1.369, 0.3515, 0.39]],
      gh: { rb: -1.93, rt: -1.0, ft: -0.32, fb: 0.5, belt: 0.93, roof: 1.344, roofR: 1.27, crown: 0.035, rise: 0.06, Wg: 1.66, k: 0.26, pillars: [-0.82], r1: 0.4, r2: 0.3, qrSide: 0.21 },
      seams: [0.64, -0.82], handles: [-0.55], blackPillars: [],
      bumperF: { y0: 0.21, y1: 0.6, wrap: 0.22 }, bumperR: { y1: 0.56, wrap: 0.3 },
      plateF: 0.3, plateR: 0.46, exhaust: true,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          /* farol anguloso: base subindo para fora, três barras verticais de LED do lado de dentro (tri-bar) */
          var yb = function (u) { return 0.605 + 0.06 * sm(u * 1.1); }, yt = function (u) { return 0.762 - 0.004 * u; };
          K.head(sd, { z0: 0.4, wrap: 0.2, shape: function (u) { return [yb(u), yt(u)]; }, proj: [[0.5, 0.004, 0.024], [0.64, 0.008, 0.022]], pad: 0.01,
            drl: [0.06, 0.13, 0.2].map(function (u) { return { u0: u, u1: u + 0.028, yb: function (v) { return yb(v) + 0.008; }, yt: function (v) { return yt(v) - 0.008; } }; }),
            amber: [{ u0: 0.8, u1: 0.96, yb: function (u) { return yb(u) + 0.004; }, yt: function (u) { return yb(u) + 0.018; } }] });
          /* "presas": tomadas pretas verticais nos cantos do para-choque */
          var Gc = K.grid(1, sd, { z0: 0.64, wrap: 0.08, y0: 0.26, y1: 0.54, du: 0.02, dv: 0.02 });
          var fy = function (u) { return 0.5 - 0.1 * u; };
          K.skin(Gc, grilleMat("mesh"), { u0: 0.06, u1: 0.9, yb: 0.29, yt: fy, off: 0.021, tile: 0.045, nv: 3 });
          outline(c, Gc, { u0: 0.06, u1: 0.9, yb: 0.29, yt: fy }, 0.007, LH, 0.022);
        });
        /* grade grande em trapézio invertido (larga em cima, logo abaixo dos faróis) com moldura preta grossa */
        var g = K.grid(1, 0, { z1: 0.66, y0: 0.27, y1: 0.61, du: 0.03, dv: 0.03 }), zt = 0.6, zb = 0.43, yB0 = 0.3, yT = 0.585;
        var gyb = function (u) { var z = Math.abs(g.zu(u)); return z <= zb ? yB0 : yB0 + (yT - 0.02 - yB0) * clamp((z - zb) / (zt - zb), 0, 1); };
        K.skin(g, grilleMat("mesh"), { u0: g.uz(-zt), u1: g.uz(zt), yb: gyb, yt: yT, off: 0.022, tile: 0.05, nv: 6 });
        outline(c, g, { u0: g.uz(-zt), u1: g.uz(zt), yb: gyb, yt: yT }, 0.012, LH, 0.024);
        var e = g.at(0.5, 0.45); ZG.emblem(c, e.p.x + 0.03, 0.45, 0, 0.05);
        /* lábio preto */
        var lp = K.grid(1, 0, { wrap: 0.25, y0: 0.19, y1: 0.27, du: 0.03, dv: 0.02 });
        K.skin(lp, PLASTIC, { yb: 0.2, yt: 0.24, off: 0.04, thick: 0.03, nv: 2 });
      },
      rear: function (c, K, I) {
        /* painel preto entre as lanternas e as três barras verticais de cada lado */
        var pn = K.grid(-1, 0, { z1: 0.86, y0: 0.74, y1: 0.92, du: 0.02, dv: 0.02 });
        K.skin(pn, GLOSS, { yb: 0.765, yt: 0.9, off: 0.004, nv: 2 });
        [1, -1].forEach(function (sd) {
          K.tail(sd, { z0: 0.42, wrap: 0.1, shape: function () { return [0.77, 0.895]; }, pad: 0.006, main: CM("#160707", { roughness: 0.3 }),
            hi: [0.12, 0.38, 0.64].map(function (u) { return { u0: u, u1: u + 0.14, yb: 0.785, yt: 0.88 }; }) });
        });
        K.lid([{ y: 0.93, z: -0.6 }, { y: 0.7, z: -0.6 }, { y: 0.66, z: -0.56 }, { y: 0.66, z: 0.56 }, { y: 0.7, z: 0.6 }, { y: 0.93, z: 0.6 }]);
        /* difusor e quatro ponteiras */
        var dg = K.grid(-1, 0, { z1: 0.7, y0: 0.18, y1: 0.32, du: 0.03, dv: 0.02 });
        K.skin(dg, PLASTIC, { yb: 0.2, yt: 0.3, off: 0.035, thick: 0.03, nv: 2 });
        [0.62, 0.48, -0.48, -0.62].forEach(function (z) { var s = dg.at(dg.uz(z), 0.25); c.cyl(0.045, 0.045, 0.1, EXH, s.p.x - 0.02, 0.25, z, "x"); c.cyl(0.036, 0.036, 0.102, MT.dark, s.p.x - 0.02, 0.25, z, "x"); });
        /* aerofólio curto */
        var lip = K.grid(-1, 0, { z1: 0.7, y0: 0.88, y1: 0.97, du: 0.03, dv: 0.02 });
        K.skin(lip, GLOSS, { u0: 0.05, u1: 0.95, yb: 0.925, yt: 0.955, off: 0.016, thick: 0.02, nv: 2 });
      },
      interior: { rows: 2, col: "#1c1d20", trim: "#121316" }, hood: { motor: "v8n" },
      wheels: [[1.35, 0.3435, 0.255, { rim: ALLOYD, spokeMat: ALLOY, spokes: 10, rimR: 0.72 }], [-1.369, 0.3515, 0.275, { rim: ALLOYD, spokeMat: ALLOY, spokes: 10, rimR: 0.71 }]],
      /* cintura de vespa: portas 3,5 cm mais estreitas que as ancas sobre as rodas (vista de cima e de trás) */
      warp: { bowF: 0.2, bowR: 0.14, Lf: 0.65, kb: 0.05, kt: 0.06, zx: (function () { var ct = cabTaper(0.93, 1.32, -0.5, 1.3, 0.06); return function (x, y) { return (1 - 0.035 * sm((x + 1.0) / 0.45) * sm((0.95 - x) / 0.4)) * ct(x, y); }; })() },
      extra: function (c, I) {
        [1, -1].forEach(function (sd) {
          /* anca sobre a roda traseira e vinco da porta */
          crease(c, I, sd, [[1.9, 0.77], [0.6, 0.79], [-0.5, 0.8], [-0.9, 0.86], [-2.3, 0.89]], { col: hex, h: 0.05 });
          crease(c, I, sd, [[0.5, 0.5], [-0.55, 0.55], [-0.85, 0.66]], { col: hex, h: 0.028 });
        });
      }
    });
    /* bossa central ("power dome") e respiros do capô: abrem junto com ele */
    if (c.hood) { var hd = hoodHit(c, 1.25, 0); if (hd) onHood(c, onSurf(c.sph(0.5, c.paint(hex), 0, 0, 0, 1, 1, 1), hd, -0.008)).scale.set(1.3, 0.06, 0.38); }
    if (c.hood) [0.32, -0.32].forEach(function (z) {
      var s = hoodHit(c, 1.25, z); if (!s) return;
      var v = onSurf(c.rb(0.28, 0.035, 0.12, 0.012, GLOSS, 0, 0, 0), s, 0.006); onHood(c, v);
    });
    /* duas portas: as zonas de porta cobrem a porta comprida e somem as traseiras */
    c.zone("porta_de", "Porta esquerda", [-0.84, 0.66, 0.15, 1.0, -1.1, -0.6], null, { type: "porta", hinge: "frente" });
    c.zone("porta_dd", "Porta direita", [-0.84, 0.66, 0.15, 1.0, 0.6, 1.1], null, { type: "porta", hinge: "frente" });
    c.zone("porta_te", false); c.zone("porta_td", false);
    /* no cupê, a janela de trás é o vidro lateral fixo da coluna */
    c.zone("janela_traseira_esquerda", "Vidro lateral traseiro esquerdo"); c.zone("janela_traseira_direita", "Vidro lateral traseiro direito");
    c.meta.armor = armorPlus(function (c) {
      var r = c.meta.roof; roofLamp(c, r.x1, r.y + 0.18, 0.35); roofLamp(c, r.x1, r.y + 0.18, -0.35);
    });
  });
})(window.ZG);
