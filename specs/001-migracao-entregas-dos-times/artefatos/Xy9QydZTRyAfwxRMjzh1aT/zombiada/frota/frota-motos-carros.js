/* Grupo A · motos e carros. Só usa a API de window.ZG (veja API.md).
   Carros: construtor local carro(), uma cópia de ZG.car com para-choques integrados, colunas pretas, recortes de cada modelo
   e um "arredondamento em planta" (warp) aplicado a todo o veículo no fim, para o nariz e a traseira não ficarem de caixote.
   Motos: corpos feitos com loft de superelipse (sloft), que amassam no dano localizado. */
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
  var REARTINT = CM("#0c1114", { roughness: 0.04, metalness: 0.45, transparent: true, opacity: 0.84, depthWrite: false, side: THREE.DoubleSide });
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
      /* placa rígida: o plano de 4 vértices, se entortado pelo warp, ficava atrás do rebaixo no meio (meia-lua preta sobre a placa) */
      var pl = c.plate(ext + E * 0.006, s.p.y, 0, E > 0 ? "+x" : "-x"); pl.userData.noWarp = true;
      if (E < 0) { var lt = skin(c, Gd, PLATEL, { u0: Gd.uz(-0.06), u1: Gd.uz(0.06), yb: y + 0.071, yt: y + 0.08, off: off + 0.004, nv: 1 }); lt.castShadow = false; }
      return pl;
    };
    /* linha de abertura de tampa: lista de pontos {y, z} na face traseira ou {x, z, top:true} no topo do porta-malas */
    K.lid = function (pts) {
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
    var qf = ZG.quadDef([gh.fb, gh.belt], [gh.ft, gh.roof], gh.Wg, T, "front", bev), qr = ZG.quadDef([gh.rb, gh.belt], [gh.rt, roofR], gh.Wg, T, "rear", bev);
    var gHoles = [];
    if (intr) { polys.forEach(function (p) { gHoles.push(ZG.holeSide(p)); }); gHoles.push(ZG.holeQuad(qf), ZG.holeQuad(qr), ZG.holeWhere(function (n, ce) { return n.y < -0.7 && ce.y < gh.belt + 0.02; })); }
    /* teto em cor própria: não enferruja no batido (só fica fosco e sujo) */
    var roofMat = s.roofCol ? CM(c.st === "danificado" ? new THREE.Color(s.roofCol).multiplyScalar(0.82) : s.roofCol, { roughness: c.st === "danificado" ? 0.78 : 0.4, metalness: 0.3, side: THREE.DoubleSide }) : null;
    ZG.shell(c, { items: ghItems, W: gh.Wg, col: s.col, mat: roofMat, T: T, holes: gHoles, sub: intr ? 0.12 : 0.2 });
    ZG.sideWindows(c, polys, gh.Wg, T, function (i, n) { return i === 0 && n > 2 ? "Vidro lateral traseiro" : (i === n - 1 ? "Janela dianteira" : "Janela traseira"); }, { see: !!intr });
    ZG.glassQuad(c, qf, "Para-brisa", { see: !!intr });
    /* vidro traseiro escuro (à noite reflete e quase não mostra os bancos; antes parecia caçamba aberta vista de trás) */
    ZG.glassQuad(c, qr, "Vidro traseiro", { see: !!intr, mat: intr ? REARTINT : MT.glassDark });
    m.L = front - rear + 0.1; m.W = W; m.front = front + 0.05; m.rear = rear - 0.05; m.clear = s.bottomY; m.belt = gh.belt; m.top = gh.roof + bev; m.bodyH = gh.belt - s.bottomY;
    m.roof = { x0: gh.rt + 0.12, x1: gh.ft - 0.12, w: halfAt(gh.Wg, T, gh.roof) * 1.6, y: Math.max(gh.roof, roofR + crown) + bev + (s.rails ? (typeof s.rails === "number" ? s.rails : 0.1) - 0.03 : 0) };
    m.top = Math.max(gh.roof, roofR + crown) + bev;
    m.gh = gh; m.T = T; m.quadF = qf;
    if (intr) ZG.interior(c, Object.assign({ x0: gh.fb, ft: gh.ft, rb: gh.rb, rt: gh.rt, roof: Math.min(gh.roof, roofR), belt: gh.belt, floor: s.bottomY + 0.1, zIn: gh.Wg / 2 - 0.09, zRoof: halfAt(gh.Wg, T, gh.roof) - 0.12, xRear: gh.rb + 0.06 }, intr));
    if (hoodO) {
      var fa = -1e9; (s.arches || []).forEach(function (a) { fa = Math.max(fa, a[0]); });
      var hood = ZG.makeHood(c, lowMesh.userData.cut.capo, { x0: hx0, col: s.col });
      if (hood) ZG.engineBay(c, { x0: hx0 + 0.02, x1: hx1, zw: zH - 0.02, floor: s.bottomY + 0.12, top: hood.yMin - 0.035, motor: hoodO.motor, axle: fa, col: s.col });
    }
    var wo = Object.assign({ xF: front + 0.05, xR: rear - 0.05, hw: W / 2, Lf: 0.55, Lr: 0.45, bowF: 0.16, bowR: 0.12, pinF: 0.05, pinR: 0.04, yb: s.bottomY, ys: (s.bottomY + gh.belt) / 2 + 0.06, belt: gh.belt, kb: 0.06, kt: 0.05 }, s.warp || {});
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
      (s.seams || []).forEach(function (x) { c.rb(0.008, gh.belt - by - 0.12, 0.006, 0.003, MT.dark, x, (gh.belt + by) / 2 + 0.03, sd * (hw + 0.001)); });
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
    /* limpadores, antena */
    var wy = gh.belt + 0.06, wx = gh.fb - 0.03;
    [-0.3, 0.2].forEach(function (z) { c.rod(new V3(wx + 0.02, wy, z + 0.02), new V3(wx - 0.13, wy + 0.13, z - 0.36), 0.009, MT.trim); });
    if (s.fin !== false) c.sph(0.1, s.roofCol ? c.paint(s.roofCol) : GLOSS, gh.rt + 0.2, roofAt(gh, gh.rt + 0.2) + 0.045, 0, 1.0, 0.45, 0.28, { tl: PI / 2 });
    if (s.spoiler) c.rb(0.27, 0.05, gh.Wg * 0.84, 0.022, s.roofCol ? c.paint(s.roofCol) : paint, gh.rt - 0.06, roofAt(gh, gh.rt) + 0.005, 0, { rot: [0, 0, -0.16] });
    if (s.rails) [1, -1].forEach(function (sd) {
      var z = sd * (halfAt(gh.Wg, T, gh.roof) - 0.1), x0 = gh.rt + 0.08, x1 = gh.ft - 0.08, rh = typeof s.rails === "number" ? s.rails : 0.1;
      var rl = c.rod(new V3(x0, roofAt(gh, x0) + rh, z), new V3(x1, roofAt(gh, x1) + rh, z), 0.018, MT.trim); c.deform.push(rl); (m.rails = m.rails || []).push(rl);
      [x0 + 0.04, x1 - 0.04].forEach(function (x) { m.rails.push(c.rb(0.1, rh - 0.03, 0.04, 0.015, MT.trim, x, roofAt(gh, x) + rh / 2 + 0.015, z, { def: true })); });
    });
    /* rodas (fora do warp; acompanham a curvatura da lateral) */
    (s.wheels || []).forEach(function (w) {
      var zw = hw * (1 - Wf.sec(w[1])) - w[2] / 2 + 0.02;
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

  /* ================= Ônyx (Chevrolet Onix) ================= */
  /* frente do Ônyx: farol fino ligado à barra cromada, grade superior estreita, grade inferior em trapézio e neblina */
  function onyxFront(c, K, I) {
    [1, -1].forEach(function (sd) {
      var yb = function (u) { return 0.66 + 0.02 * u; }, yt = function (u) { return 0.735 + 0.028 * u; };
      K.head(sd, { z0: 0.37, wrap: 0.14, shape: function (u) { return [yb(u), yt(u)]; }, proj: [[0.36, -0.004, 0.025], [0.6, -0.004, 0.027]],
        drl: [{ u0: 0.04, u1: 0.97, yb: function (u) { return yt(u) - 0.015; }, yt: function (u) { return yt(u) - 0.005; } }],
        amber: [{ u0: 0.82, u1: 0.98, yb: function (u) { return yb(u) + 0.005; }, yt: function (u) { return yb(u) + 0.02; } }] });
    });
    var g = K.grille(1, { z1: 0.36, y0: 0.62, y1: 0.73, u0: 0.02, u1: 0.98, yb: 0.635, yt: 0.705, tex: "mesh", tile: 0.06, frame: MT.trim, frameR: 0.006 });
    var bar = K.grid(1, 0, { z1: 0.4, y0: 0.69, y1: 0.74, du: 0.03, dv: 0.025 });
    lineOn(c, bar, [[0.02, 0.712], [0.25, 0.716], [0.5, 0.717], [0.75, 0.716], [0.98, 0.712]], 0.0085, MT.chrome, 0.012);
    var e = bar.at(0.5, 0.716); ZG.emblem(c, e.p.x + 0.02, 0.716, 0, 0.04);
    var bg = c.meta.bumperF.userData.grid, lw = K.grid(1, 0, { z1: 0.64, y0: 0.3, y1: 0.54, du: 0.03, dv: 0.03 });
    var zt = 0.54, zb = 0.42, y0 = 0.33, y1 = 0.51;
    function yB(u) { var z = Math.abs(lw.zu(u)); return z <= zb ? y0 : y0 + (y1 - y0) * (z - zb) / (zt - zb); }
    K.skin(lw, grilleMat("mesh"), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.06, nv: 3 });
    outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.007, LH, 0.022);
    [1, -1].forEach(function (sd) {
      var Gc = K.grid(1, sd, { z0: 0.58, wrap: 0.04, y0: 0.32, y1: 0.5, du: 0.02, dv: 0.02 });
      K.skin(Gc, LH, { yb: 0.34, yt: 0.47, off: 0.021, nv: 3 });
      var s2 = Gc.at(0.42, 0.405); s2.p.addScaledVector(s2.n, 0.018); fogLamp(c, s2, 0.034);
    });
  }
  /* Referência (hatch): Chevrolet Onix 2020+ (fichacompleta.com.br, LT 1.0 Turbo 2024)
       comprimento 4,163 · largura 1,730 · altura 1,476 · entre-eixos 2,551 · bitola 1,506 / 1,510 · pneu 185/65 R15 (Ø 0,622)
       · balanços ≈ 0,84 / 0,77 (de memória) · vão livre 0,128 (ficha; ≈ 0,15 na soleira).
     Referência (sedã, Onix Plus): comprimento 4,474 · largura 1,730 · altura 1,474 · entre-eixos 2,600 · bitola 1,506 / 1,510
       · pneu 195/55 R16 (Ø 0,621) · balanços ≈ 0,84 / 1,03 (de memória) · vão livre 0,127.
     Traços de assinatura:
       frente: farol fino de LED ligado por friso cromado à grade superior estreita; grade inferior trapezoidal grande em colmeia;
         neblina nos cantos em molduras pretas.
       lateral: vinco de ombro do farol até a lanterna, passando pelas maçanetas; vinco baixo nas portas subindo para a roda traseira;
         linha das janelas subindo para trás com friso cromado que "quebra" para cima na coluna C (gota); coluna B preta.
       traseira: lanternas horizontais que invadem a tampa; tampa com aerofólio no teto (hatch) ou tampa curta com friso cromado (sedã).
       teto: teto que cai para trás, antena "barbatana". */
  function onyxSides(sedan) {
    return function (c, I) {
      var gh = I.gh, col = c.meta.col;
      function yb(x) { return gh.belt + 0.035 + (gh.rise || 0) * clamp((gh.fb - x) / (gh.fb - gh.rb), 0, 1); }
      [1, -1].forEach(function (sd) {
        crease(c, I, sd, [[1.62, 0.79], [0.9, 0.84], [-0.4, 0.88], [sedan ? -2.2 : -1.9, sedan ? 0.89 : 0.9]], { col: col, h: 0.028 });
        crease(c, I, sd, [[0.8, 0.5], [-0.3, 0.52], [-0.95, 0.58]], { col: col, h: 0.022 });
        var P = []; for (var x = gh.fb - 0.06; x >= gh.rb + (sedan ? 0.32 : 0.36); x -= 0.1) P.push([x, yb(x) - 0.008]);
        var xe = gh.rb + (sedan ? 0.28 : 0.3), ye = yb(xe) - 0.008; P.push([xe, ye], [xe - 0.03, ye + 0.05], [xe - 0.04, ye + (sedan ? 0.1 : 0.12)]);
        dloChrome(c, I, sd, P, 0.009);
      });
    };
  }
  function ONYX(col, sedan) {
    var lower = sedan
      ? [[-2.36, 0.27, 0.06], [-2.41, 0.55, 0.14], [-2.39, 0.9, 0.12], [-2.27, 1.02, 0.14], [-1.82, 1.02, 0.04], [0.68, 1.0, 0], [1.27, 0.93, 0.4], [1.88, 0.8, 0.16], [1.98, 0.58, 0.16], [1.94, 0.27, 0.06]]
      : [[-2.03, 0.27, 0.06], [-2.08, 0.52, 0.14], [-2.06, 0.86, 0.12], [-1.97, 1.03, 0.06], [0.66, 1.0, 0], [1.25, 0.93, 0.4], [1.86, 0.8, 0.16], [1.97, 0.58, 0.16], [1.93, 0.27, 0.06]];
    return {
      W: 1.73, col: col, bottomY: 0.26, noseY: 0.74, tailY: sedan ? 0.95 : 0.86, lower: lower,
      arches: [[1.18, 0.315, 0.355], [-1.4, 0.315, 0.355]],
      gh: sedan ? { rb: -1.8, rt: -1.1, ft: -0.08, fb: 0.72, belt: 1.0, roof: 1.43, roofR: 1.37, crown: 0.025, rise: 0.04, Wg: 1.6, k: 0.2, pillars: [-0.5, -1.3], r1: 0.3, r2: 0.25 }
        : { rb: -1.95, rt: -1.4, ft: -0.08, fb: 0.72, belt: 1.0, roof: 1.43, roofR: 1.32, crown: 0.035, rise: 0.09, Wg: 1.6, k: 0.2, pillars: [-0.5, -1.22], r1: 0.12, r2: 0.25 },
      seams: [0.62, -0.5, sedan ? -1.36 : -1.32], handles: [0.22, -0.72], blackPillars: [-0.5],
      bumperF: { y1: 0.56 }, bumperR: { y1: sedan ? 0.6 : 0.57 },
      plateF: 0.44, plateR: sedan ? 0.79 : 0.72, plateROnBumper: false,
      front: onyxFront,
      rear: function (c, K, I) {
        var y0 = sedan ? 0.86 : 0.84, y1 = sedan ? 0.97 : 0.96;
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return y0 + 0.03 * u; }, yt = function (u) { return y1 - 0.008 * u; };
          K.tail(sd, { z0: sedan ? 0.41 : 0.37, wrap: 0.17, shape: function (u) { return [yb(u), yt(u)]; },
            hi: [{ u0: 0.08, u1: 0.97, yb: function (u) { return yt(u) - 0.024; }, yt: function (u) { return yt(u) - 0.011; } }, { u0: 0.3, u1: 0.34, yb: yb, yt: yt }],
            rev: [{ u0: 0.03, u1: 0.24, yb: function (u) { return yb(u) + 0.008; }, yt: function (u) { return yb(u) + 0.045; } }] });
          K.reflector(sd, I.hw - 0.24, 0.42, 0.1);
        });
        if (sedan) {
          K.lid([{ y: 0.95, z: -0.39 }, { y: 0.66, z: -0.39 }, { y: 0.62, z: -0.36 }, { y: 0.62, z: 0.36 }, { y: 0.66, z: 0.39 }, { y: 0.95, z: 0.39 },
            { top: true, x: -2.3, z: 0.56 }, { top: true, x: -2.15, z: 0.62 }, { top: true, x: -1.9, z: 0.6 }, { top: true, x: -1.87, z: 0.4 }, { top: true, x: -1.87, z: -0.4 }, { top: true, x: -1.9, z: -0.6 }, { top: true, x: -2.15, z: -0.62 }, { top: true, x: -2.3, z: -0.56 }, { y: 0.95, z: -0.39 }]);
          var cb = K.grid(-1, 0, { z1: 0.4, y0: 0.86, y1: 0.92, du: 0.03, dv: 0.03 });
          lineOn(c, cb, [[0.02, 0.89], [0.5, 0.89], [0.98, 0.89]], 0.007, MT.chrome, 0.006);
        } else {
          K.lid([{ y: 1.0, z: -0.385 }, { y: 0.64, z: -0.385 }, { y: 0.6, z: -0.35 }, { y: 0.6, z: 0.35 }, { y: 0.64, z: 0.385 }, { y: 1.0, z: 0.385 }]);
        }
        var ey = sedan ? 0.9 : 0.85; ZG.emblem(c, I.S.endX(-1, ey) - 0.012, ey, 0, 0.04).rotation.y = PI;
      },
      spoiler: !sedan, interior: { rows: 2, col: "#2b2c30" }, hood: { motor: "gasolina" },
      wheels: [[1.18, 0.31, 0.2, wheelOpts("alloy")], [-1.4, 0.31, 0.2, wheelOpts("alloy")]],
      warp: { bowF: 0.17, bowR: sedan ? 0.1 : 0.13 },
      extra: onyxSides(sedan)
    };
  }
  ZG.register({ k: "hatch", grp: "Carros", n: "Ônyx", insp: "Chevrolet Onix", c: "Hatch compacto", fuel: "flex",
    d: "O carro mais comum da cidade. Econômico, ágil e frágil. Peça de reposição em qualquer garagem.",
    mass: 1034, r: 60, seats: "5", cap: "44 L", eff: "13,9 km/L (G) · 9,8 km/L (E)", auto: "610 km", vmax: 170, skill: "—", hood: true
  }, function (c) {
    carro(c, ONYX("#9a2424"));
    c.meta.armor = armorPlus(function (c) { var r = c.meta.roof; roofLamp(c, r.x1 + 0.05, r.y + 0.2, 0.35); roofLamp(c, r.x1 + 0.05, r.y + 0.2, -0.35); });
  });

  ZG.register({ k: "taxi", grp: "Carros", n: "Ônyx Plus Táxi", insp: "Chevrolet Onix Plus", c: "Sedã compacto (táxi)", fuel: "flex",
    d: "Sedã branco com luminoso no teto e rádio da cooperativa. Porta-malas grande para mantimentos.",
    mass: 1100, r: 60, seats: "5", cap: "44 L", eff: "13,4 km/L (G) · 9,4 km/L (E)", auto: "590 km", vmax: 175, skill: "—", hood: true
  }, function (c) {
    var s = ONYX("#dedcd5", true); s.handleCol = "#d0cfc9";
    s.wheels = [[1.18, 0.31, 0.2, wheelOpts("hubcap")], [-1.4, 0.31, 0.2, wheelOpts("hubcap")]];
    carro(c, s);
    var m = c.meta, lit = c.st === "danificado" ? 0.05 : 0.75, ly = m.top + 0.1;
    /* luminoso entra no cálculo de repouso ao capotar (amassa junto) */
    var lum = [c.rb(0.52, 0.17, 0.26, 0.06, CM("#e8d36a", { emissive: new THREE.Color("#7a6410"), emissiveIntensity: lit }), -0.55, ly, 0, { def: true }),
      c.rb(0.56, 0.03, 0.3, 0.012, MT.trim, -0.55, m.top + 0.01, 0, { def: true }),
      c.text("TÁXI", 0.24, 0.1, -0.55 + 0.262, ly, 0, "+x", { fg: "#1a1a1a" }), c.text("TÁXI", 0.24, 0.1, -0.55 - 0.262, ly, 0, "-x", { fg: "#1a1a1a" })];
    [1, -1].forEach(function (s2) {
      var z = s2 * (m.W / 2 + 0.008), f = s2 > 0 ? "+z" : "-z";
      c.text("TÁXI", 0.46, 0.14, 0.15, 0.72, z, f, { fg: "#2c5f8a" });
      c.text("COOPERATIVA 24H · 3333-1000", 1.5, 0.075, -0.9, 0.72, z, f, { fg: "#2c5f8a", size: 0.78, w: 1280, h: 64 });
      c.rb(3.4, 0.05, 0.01, 0.005, CM("#2c5f8a"), -0.25, 0.58, s2 * (m.W / 2 + 0.003));
    });
    /* antena curta de rádio, inclinada para trás */
    var ant = c.rod(new V3(-1.45, m.top - 0.03, 0.3), new V3(-1.62, m.top + 0.2, 0.3), 0.005, MT.trim, { r2: 0.003 }); c.deform.push(ant);
    /* o luminoso e a antena são do teto: apagam a partir de amassado e somem quando o teto é arrancado */
    c.zone("teto", null, null, lum.concat([ant]), { onBand: function (c2, b) { if (b >= 2) lum[0].material = CM("#6b6135", { roughness: 0.6 }); } });
    m.top = ly + 0.085; m.roof.y = Math.max(m.roof.y, ly + 0.085);
    m.armor = armorPlus(function (c) { c.rb(0.5, 0.06, 0.5, 0.02, MT.wood, -1.95, 1.08, 0); ZG.jerry(c, -2.0, 1.33, 0.2, "#8e2a20"); });
  });

  /* ================= Kwyd (Renault Kwid) ================= */
  /* Referência: Renault Kwid Zen 1.0 2024 (fichacompleta.com.br)
     Medidas reais: comprimento 3,680 · largura 1,579 · altura 1,479 (com barras) · entre-eixos 2,423 · bitola ≈ 1,385 / 1,394 (de memória)
       · pneu 165/70 R14 (Ø 0,587) · vão livre 0,185 · balanços ≈ 0,69 / 0,57 (de memória).
     Traços de assinatura:
       frente: luz diurna de LED fina no alto, junto do capô, e o farol principal embaixo numa moldura preta (farol dividido);
         grade com moldura cromada entre as luzes diurnas; para-choque preto alto com tomada inferior.
       lateral: corpo alto e curto de "SUV de bolso"; molduras pretas nas caixas de roda e na soleira; barras de teto;
         rodas aro 14 com calotas; coluna C larga sem vidro.
       traseira: lanternas verticais em "C" na quina; tampa quase vertical; para-choque preto com refletores.
       teto: teto reto e alto, curto atrás. */
  ZG.register({ k: "popular", grp: "Carros", n: "Kwyd", insp: "Renault Kwid", c: "Hatch de entrada", fuel: "flex",
    d: "Leve, alto do chão e barato de manter. Cabe em qualquer beco, mas a lataria fina amassa fácil.",
    mass: 790, r: 55, seats: "5", cap: "38 L", eff: "15,3 km/L (G) · 10,8 km/L (E)", auto: "580 km", vmax: 156, skill: "—", hood: true
  }, function (c) {
    carro(c, {
      W: 1.58, col: "#c25a1c", bottomY: 0.3, noseY: 0.86, tailY: 0.9,
      lower: [[-1.86, 0.31, 0.06], [-1.9, 0.55, 0.12], [-1.88, 0.88, 0.1], [-1.83, 1.0, 0.05], [0.52, 1.0, 0], [1.03, 0.96, 0.35], [1.55, 0.88, 0.16], [1.635, 0.62, 0.16], [1.595, 0.31, 0.06]],
      arches: [[1.0, 0.3, 0.35], [-1.42, 0.3, 0.35]],
      gh: { rb: -1.85, rt: -1.57, ft: -0.08, fb: 0.56, belt: 1.0, roof: 1.41, roofR: 1.38, crown: 0.02, Wg: 1.5, k: 0.17, pillars: [-0.58, -1.38], r1: 0.14, r2: 0.22 },
      dropRear: true, seams: [0.48, -0.58, -1.36], handles: [0.08, -0.8], blackPillars: [-0.58], clad: true, rails: 0.075,
      bumperF: { y1: 0.6 }, bumperR: { y1: 0.6 }, bumperCol: "#2a2b2d", skirtH: 0.06,
      plateF: 0.45, plateR: 0.74, plateROnBumper: false,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          /* farol principal embaixo, em moldura preta, e a luz diurna fina em cima, junto do capô (assinatura do modelo) */
          K.head(sd, { z0: 0.42, wrap: 0.1, shape: function (u) { return [0.645 + 0.01 * u, 0.745 + 0.012 * u]; }, proj: [[0.35, 0, 0.032], [0.68, 0, 0.03]],
            amber: [{ u0: 0.86, u1: 0.99, yb: 0.66, yt: 0.7 }] });
          K.head(sd, { z0: 0.3, wrap: 0.12, shape: function (u) { return [0.815 + 0.012 * u, 0.84 + 0.012 * u]; }, pad: 0.008, label: "Luz diurna " + (sd > 0 ? "direita" : "esquerda"),
            drl: [{ u0: 0.03, u1: 0.97, yb: function (u) { return 0.82 + 0.012 * u; }, yt: function (u) { return 0.835 + 0.012 * u; } }] });
        });
        K.grille(1, { z1: 0.4, y0: 0.6, y1: 0.82, u0: 0.03, u1: 0.97, yb: 0.63, yt: 0.79, tex: "mesh", tile: 0.06, frame: MT.chrome, frameR: 0.008 });
        var e = K.grid(1, 0, { z1: 0.1, y0: 0.74, y1: 0.8, du: 0.03, dv: 0.03 }).at(0.5, 0.78); ZG.emblem(c, e.p.x + 0.02, 0.775, 0, 0.045);
        var lw = K.grid(1, 0, { z1: 0.5, y0: 0.33, y1: 0.52, du: 0.03, dv: 0.03 });
        K.skin(lw, grilleMat("mesh"), { u0: lw.uz(-0.42), u1: lw.uz(0.42), yb: 0.35, yt: 0.43, off: 0.021, tile: 0.06, nv: 2 });
        [1, -1].forEach(function (sd) { var s1 = K.grid(1, sd, { z0: 0.5, z1: 0.62, y0: 0.4, y1: 0.5, du: 0.02, dv: 0.02 }).at(0.5, 0.45); c.rb(0.03, 0.04, 0.16, 0.015, MT.chrome, s1.p.x + 0.03, 0.45, sd * 0.56); });
      },
      rear: function (c, K, I) {
        var z0 = I.hw - 0.07 - 0.11;
        [1, -1].forEach(function (sd) {
          /* lanterna vertical em "C", embutida na quina */
          var yb = function () { return 0.66; }, yt = function () { return 0.98; };
          K.tail(sd, { z0: z0, wrap: 0.09, shape: function (u) { return [yb(u), yt(u)]; },
            hi: [{ u0: 0.18, u1: 0.95, yb: 0.945, yt: 0.962 }, { u0: 0.18, u1: 0.95, yb: 0.678, yt: 0.695 }, { u0: 0.18, u1: 0.27, yb: 0.678, yt: 0.962 }],
            rev: [{ u0: 0.35, u1: 0.62, yb: 0.74, yt: 0.8 }], amber: [{ u0: 0.35, u1: 0.62, yb: 0.82, yt: 0.86 }] });
          K.reflector(sd, I.hw - 0.24, 0.45, 0.1);
        });
        K.lid([{ y: 0.99, z: -0.6 }, { y: 0.66, z: -0.6 }, { y: 0.62, z: -0.56 }, { y: 0.62, z: 0.56 }, { y: 0.66, z: 0.6 }, { y: 0.99, z: 0.6 }]);
        ZG.emblem(c, I.S.endX(-1, 0.86) - 0.012, 0.86, 0, 0.04).rotation.y = PI;
      },
      interior: { rows: 2, col: "#3a3c40", trim: "#232427" }, hood: { motor: "gasolina" },
      wheels: [[1.0, 0.293, 0.17, wheelOpts("hubcap")], [-1.42, 0.293, 0.17, wheelOpts("hubcap")]],
      warp: { bowF: 0.15, bowR: 0.16, Lf: 0.5, Lr: 0.45, pinR: 0.07 },
      extra: function (c, I) {
        [1, -1].forEach(function (sd) { c.rb(0.05, 0.16, 0.1, 0.03, MT.trim, -1.12, 1.17, sd * 0.69); });
      }
    });
    /* barras de teto pertencem ao teto (amassam e somem com ele) */
    c.zone("teto", null, null, c.meta.rails || []);
    c.meta.armor = armorPlus(function (c) { ZG.jerry(c, -1.98, 0.7, 0.45, "#8e2a20"); c.rb(0.1, 0.5, 0.5, 0.03, ZG.STEELM, -2.0, 0.72, -0.2); });
  });

  /* ================= Dolfin (BYD Dolphin) ================= */
  /* Referência: BYD Dolphin 2023+ (versão global; km77.com e garagem360.com.br)
     Medidas reais: comprimento 4,290 · largura 1,770 · altura 1,570 · entre-eixos 2,700 · bitola ≈ 1,530 / 1,530 (de memória)
       · pneu 205/55 R16 (Ø 0,632) · balanços ≈ 0,86 / 0,73 (de memória) · vão livre ≈ 0,12.
     Traços de assinatura:
       frente: frente fechada (elétrico) com faróis de ponta interna erguida em direção ao capô, como "barbatanas", e DRL contínua
         na borda de cima; tomada inferior larga e fina com friso; entradas verticais nos cantos.
       lateral: "onda" em relevo que nasce na porta traseira e sobe até a lanterna; teto escuro em contraste; coluna B preta;
         rodas aerodinâmicas; porta de carga na lateral traseira esquerda.
       traseira: barra de lanterna de ponta a ponta ligando as lanternas; tampa alta e quase vertical.
       teto: teto longo e reto, alto (hatch de 1,57 m). */
  ZG.register({ k: "eletrico", grp: "Carros", n: "Dolfin", insp: "BYD Dolphin", c: "Hatch elétrico", fuel: "eletrico",
    d: "Silencioso o bastante para passar por uma horda dormindo. Precisa de energia para recarregar; bateria batida pega fogo.",
    mass: 1405, r: 15, seats: "5", cap: "44,9 kWh", eff: "6,5 km/kWh", auto: "291 km", vmax: 150, skill: "Eletricidade 1 (recarga improvisada)", hood: true
  }, function (c) {
    var hex = "#4d8f93";
    carro(c, {
      W: 1.77, col: hex, roofCol: "#2b2f34", bottomY: 0.3, noseY: 0.8, tailY: 0.9,
      lower: [[-2.06, 0.31, 0.06], [-2.11, 0.55, 0.14], [-2.09, 0.8, 0.1], [-2.01, 0.97, 0.08], [-1.92, 1.06, 0.05], [0.8, 1.03, 0], [1.42, 0.96, 0.45], [1.99, 0.84, 0.2], [2.08, 0.6, 0.18], [2.03, 0.31, 0.06]],
      arches: [[1.3, 0.32, 0.365], [-1.4, 0.32, 0.365]],
      gh: { rb: -1.9, rt: -1.42, ft: 0.0, fb: 0.86, belt: 1.03, roof: 1.52, roofR: 1.42, crown: 0.035, rise: 0.06, Wg: 1.64, k: 0.21, pillars: [-0.44, -1.26], r1: 0.14, r2: 0.28 },
      seams: [0.76, -0.44, -1.36], handles: [0.3, -0.7], handleCol: "#c9ced1", blackPillars: [-0.44],
      bumperF: { y1: 0.6 }, bumperR: { y1: 0.58 },
      plateF: 0.45, plateR: 0.72, plateROnBumper: false,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          /* farol com a ponta interna subindo em direção ao capô; DRL contínua pela borda de cima */
          var yb = function (u) { return 0.685 + 0.01 * u; }, yt = function (u) { return 0.765 + 0.06 * (1 - sm(u / 0.32)); };
          K.head(sd, { z0: 0.26, wrap: 0.2, shape: function (u) { return [yb(u), yt(u)]; }, proj: [[0.52, -0.012, 0.026], [0.74, -0.012, 0.027]],
            drl: [{ u0: 0.015, u1: 0.98, yb: function (u) { return yt(u) - 0.016; }, yt: function (u) { return yt(u) - 0.005; } }] });
        });
        var e = K.grid(1, 0, { z1: 0.1, y0: 0.62, y1: 0.7, du: 0.03, dv: 0.03 }).at(0.5, 0.66); ZG.emblem(c, e.p.x + 0.02, 0.66, 0, 0.045);
        var lw = K.grid(1, 0, { z1: 0.6, y0: 0.34, y1: 0.5, du: 0.03, dv: 0.03 });
        K.skin(lw, grilleMat("slots"), { u0: lw.uz(-0.54), u1: lw.uz(0.54), yb: 0.37, yt: 0.44, off: 0.021, tile: 0.05, nv: 2 });
        outline(c, lw, { u0: lw.uz(-0.54), u1: lw.uz(0.54), yb: 0.37, yt: 0.44 }, 0.005, MT.chrome, 0.022);
        [1, -1].forEach(function (sd) { var Gv = K.grid(1, sd, { z0: 0.62, wrap: 0.06, y0: 0.32, y1: 0.56, du: 0.02, dv: 0.02 }); K.skin(Gv, LH, { u0: 0.1, u1: 0.9, yb: 0.34, yt: function (u) { return 0.5 + 0.03 * u; }, off: 0.021, nv: 3 }); });
      },
      rear: function (c, K, I) {
        var z0 = 0.47;
        [1, -1].forEach(function (sd) {
          K.tail(sd, { z0: z0, wrap: 0.16, shape: function (u) { return [0.835 + 0.02 * u, 0.955 - 0.01 * u]; },
            hi: [{ u0: 0.0, u1: 0.96, yb: 0.877, yt: 0.903 }, { u0: 0.55, u1: 0.95, yb: 0.84, yt: 0.855 }],
            rev: [{ u0: 0.04, u1: 0.3, yb: 0.85, yt: 0.872 }] });
          K.reflector(sd, I.hw - 0.24, 0.42, 0.1);
        });
        /* barra de lanterna contínua de ponta a ponta (acesa) */
        var bg = K.grid(-1, 0, { z1: z0 + 0.02, y0: 0.86, y1: 0.92, du: 0.02, dv: 0.02 });
        K.skin(bg, LH, { yb: 0.869, yt: 0.911, off: 0.003, nv: 2 });
        var bar = K.skin(bg, TAILHI, { yb: 0.877, yt: 0.903, off: 0.009, nv: 2 }), bl = K.skin(bg, MT.lensRed, { yb: 0.872, yt: 0.908, off: 0.013, nv: 2, order: 3 });
        regLight(c, "lanterna", "Barra de lanterna", [bar], [bl], bg.at(0.5, 0.89).p);
        K.lid([{ y: 0.99, z: -0.44 }, { y: 0.63, z: -0.44 }, { y: 0.6, z: -0.41 }, { y: 0.6, z: 0.41 }, { y: 0.63, z: 0.44 }, { y: 0.99, z: 0.44 }]);
        ZG.emblem(c, I.S.endX(-1, 0.8) - 0.012, 0.8, 0, 0.035).rotation.y = PI;
      },
      interior: { rows: 2, col: "#6d747b", trim: "#2a2d31" }, hood: { motor: "eletrico" }, exhaust: false, noRadiator: true,
      wheels: [[1.3, 0.32, 0.21, wheelOpts("aero")], [-1.4, 0.32, 0.21, wheelOpts("aero")]], tankLabel: "Bateria de tração",
      warp: { bowF: 0.2, bowR: 0.12, Lf: 0.6 },
      extra: function (c, I) {
        [1, -1].forEach(function (sd) {
          /* a "onda" lateral: faixa em relevo que nasce na porta traseira e sobe até a lanterna */
          var Gw = sideGrid(I.S, sd, { x0: 0.2, x1: -1.98, y0: 0.5, y1: 0.98 });
          var yc = function (u) { return 0.6 + 0.3 * sm((u - 0.25) / 0.75) + 0.02 * u; };
          K0(I).skin(Gw, c.paint(hex), { yb: function (u) { return yc(u) - 0.02 - 0.012 * (1 - u); }, yt: function (u) { return yc(u) + 0.006; }, off: 0.008, thick: 0.014, nv: 2, u0: 0.02, u1: 0.99 });
          lineOn(c, Gw, (function () { var l = []; for (var k = 0; k <= 16; k++) { var u = 0.04 + k / 16 * 0.94; l.push([u, yc(u) - 0.028 - 0.012 * (1 - u)]); } return l; })(), 0.004, MT.chrome, 0.004);
          c.text("ELÉTRICO", 0.42, 0.09, -1.66, 0.56, sd * (I.hw + 0.006), sd > 0 ? "+z" : "-z", { fg: "#d6eef0", size: 0.62 });
        });
        c.rb(0.12, 0.13, 0.012, 0.02, c.paint(hex), -1.85, 0.72, -(I.hw + 0.004));
        c.cyl(0.03, 0.03, 0.01, MT.blue, -1.85, 0.72, -(I.hw + 0.012), "z");
      }
    });
    c.parts = c.parts.filter(function (p) { return p.kind !== "radiador" && p.kind !== "tanque"; });
    c.part("bateria", "Bateria de tração", null, new V3(-0.3, 0.3, 0), 1.2);
    c.meta.armor = armorPlus(function (c) {
      var r = c.meta.roof, y = r.y + 0.2;
      c.rb(r.x1 - r.x0 - 0.1, 0.03, r.w * 0.9, 0.01, CM("#16233a", { metalness: 0.6, roughness: 0.25 }), (r.x0 + r.x1) / 2, y, 0);
      for (var x = r.x0 + 0.2; x < r.x1 - 0.1; x += 0.25) c.rb(0.01, 0.034, r.w * 0.9, 0.003, MT.alu, x, y, 0);
      c.tube([[r.x0, y, 0.4], [r.x0 - 0.2, y - 0.4, 0.75], [-1.85, 0.72, -0.9]], 0.012, MT.hv);
    });
  });
  function K0(I) { return I.K; }

  /* ================= Corola (Toyota Corolla) ================= */
  /* Referência: Toyota Corolla G12 2020+ (fichacompleta.com.br, Altis 2024)
     Medidas reais: comprimento 4,630 · largura 1,780 · altura 1,455 · entre-eixos 2,700 · bitola 1,531 / 1,544
       · pneu 215/50 R17 (Ø 0,647) · vão livre 0,148 · balanços ≈ 0,93 / 1,00 (de memória).
     Traços de assinatura:
       frente: faróis finos em cunha com DRL em "L", grade superior estreita ligando os faróis; grade inferior trapezoidal enorme
         em diamante; molduras em "C" nos cantos com LED vertical.
       lateral: perfil quase fastback com teto caindo cedo; vinco baixo forte nas portas subindo para a traseira; friso cromado na
         linha das janelas; tampa do porta-malas curta.
       traseira: lanternas largas que invadem a tampa com friso cromado entre elas; para-choque com refletores.
       teto: teto curto, para-brisa e vidro traseiro muito inclinados. */
  ZG.register({ k: "seda", grp: "Carros", n: "Corola", insp: "Toyota Corolla", c: "Sedã médio", fuel: "flex",
    d: "Equilíbrio entre conforto, porta-malas e velocidade. Confiável até o fim do mundo.",
    mass: 1380, r: 60, seats: "5", cap: "50 L", eff: "11,8 km/L (G) · 8,2 km/L (E)", auto: "590 km", vmax: 195, skill: "—", hood: true
  }, function (c) {
    carro(c, {
      W: 1.78, col: "#8b939a", bottomY: 0.26, noseY: 0.7, tailY: 0.9,
      lower: [[-2.29, 0.27, 0.06], [-2.34, 0.55, 0.14], [-2.32, 0.85, 0.12], [-2.23, 0.96, 0.1], [-1.84, 0.99, 0.04], [0.74, 0.98, 0], [1.42, 0.9, 0.45], [2.08, 0.74, 0.16], [2.18, 0.52, 0.16], [2.14, 0.27, 0.06]],
      arches: [[1.3, 0.325, 0.365], [-1.4, 0.325, 0.365]],
      gh: { rb: -1.8, rt: -1.12, ft: -0.12, fb: 0.78, belt: 0.98, roof: 1.405, roofR: 1.35, crown: 0.025, rise: 0.03, Wg: 1.62, k: 0.21, pillars: [-0.48, -1.28], r1: 0.32, r2: 0.28 },
      seams: [0.7, -0.48, -1.34], handles: [0.24, -0.74], blackPillars: [-0.48], chromeBelt: true,
      bumperF: { y1: 0.55 }, bumperR: { y1: 0.58 },
      plateF: 0.42, plateR: 0.74, plateROnBumper: false,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          /* farol em cunha: ponta interna fina, abre para fora; DRL em L */
          var yb = function (u) { return 0.664 - 0.046 * sm(u * 1.4); }, yt = function (u) { return 0.692 + 0.032 * sm(u * 1.5); };
          K.head(sd, { z0: 0.3, wrap: 0.22, shape: function (u) { return [yb(u), yt(u)]; }, proj: [[0.48, 0.006, 0.025], [0.7, 0.006, 0.027]],
            drl: [{ u0: 0.22, u1: 0.96, yb: function (u) { return yb(u) + 0.004; }, yt: function (u) { return yb(u) + 0.015; } }, { u0: 0.86, u1: 0.9, yb: function (u) { return yb(u) + 0.004; }, yt: function (u) { return yt(u) - 0.008; } }] });
        });
        K.grille(1, { z1: 0.3, y0: 0.63, y1: 0.71, u0: 0.02, u1: 0.98, yb: 0.655, yt: 0.69, tex: "barsd", tile: 0.05, frame: MT.chrome, frameR: 0.005 });
        var e = K.grid(1, 0, { z1: 0.1, y0: 0.64, y1: 0.7, du: 0.03, dv: 0.03 }).at(0.5, 0.672); ZG.emblem(c, e.p.x + 0.022, 0.672, 0, 0.042);
        /* grade inferior grande em trapézio */
        var lw = K.grid(1, 0, { z1: 0.72, y0: 0.29, y1: 0.54, du: 0.03, dv: 0.03 }), zt = 0.66, zb = 0.5, y0 = 0.31, y1 = 0.52;
        function yB(u) { var z = Math.abs(lw.zu(u)); return z <= zb ? y0 : y0 + (y1 - y0) * (z - zb) / (zt - zb); }
        K.skin(lw, grilleMat("diamond"), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.05, nv: 3 });
        outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.009, LH, 0.022);
        [1, -1].forEach(function (sd) {
          var Gc = K.grid(1, sd, { z0: 0.68, wrap: 0.05, y0: 0.3, y1: 0.54, du: 0.02, dv: 0.02 });
          K.skin(Gc, LH, { u0: 0.05, u1: 0.95, yb: 0.33, yt: function (u) { return 0.5 - 0.04 * u; }, off: 0.021, nv: 3 });
          K.skin(Gc, DRL, { u0: 0.15, u1: 0.25, yb: 0.36, yt: 0.47, off: 0.024, nv: 2 });
        });
      },
      rear: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.82 + 0.02 * u; }, yt = function (u) { return 0.945 - 0.012 * u; };
          K.tail(sd, { z0: 0.43, wrap: 0.22, shape: function (u) { return [yb(u), yt(u)]; },
            hi: [{ u0: 0.12, u1: 0.96, yb: function (u) { return yt(u) - 0.022; }, yt: function (u) { return yt(u) - 0.01; } }, { u0: 0.12, u1: 0.17, yb: function (u) { return yb(u) + 0.01; }, yt: function (u) { return yt(u) - 0.01; } }],
            rev: [{ u0: 0.22, u1: 0.45, yb: function (u) { return yb(u) + 0.01; }, yt: function (u) { return yb(u) + 0.045; } }] });
          K.reflector(sd, I.hw - 0.24, 0.42, 0.12);
        });
        var cb = K.grid(-1, 0, { z1: 0.43, y0: 0.84, y1: 0.92, du: 0.03, dv: 0.03 });
        lineOn(c, cb, [[0.01, 0.885], [0.5, 0.885], [0.99, 0.885]], 0.012, MT.chrome, 0.008);
        K.lid([{ y: 0.94, z: -0.41 }, { y: 0.64, z: -0.41 }, { y: 0.6, z: -0.38 }, { y: 0.6, z: 0.38 }, { y: 0.64, z: 0.41 }, { y: 0.94, z: 0.41 },
          { top: true, x: -2.23, z: 0.58 }, { top: true, x: -2.09, z: 0.64 }, { top: true, x: -1.88, z: 0.62 }, { top: true, x: -1.86, z: 0.4 }, { top: true, x: -1.86, z: -0.4 }, { top: true, x: -1.88, z: -0.62 }, { top: true, x: -2.09, z: -0.64 }, { top: true, x: -2.23, z: -0.58 }, { y: 0.94, z: -0.41 }]);
      },
      interior: { rows: 2, col: "#2a2b2e" }, hood: { motor: "gasolina" },
      wheels: [[1.3, 0.323, 0.21, wheelOpts("alloy2")], [-1.4, 0.323, 0.21, wheelOpts("alloy2")]],
      warp: { bowF: 0.2, bowR: 0.12, Lf: 0.6 },
      extra: function (c, I) {
        [1, -1].forEach(function (sd) {
          crease(c, I, sd, [[1.75, 0.8], [0.4, 0.86], [-1.0, 0.89], [-2.15, 0.9]], { col: "#8b939a", h: 0.026 });
          crease(c, I, sd, [[1.0, 0.47], [0.0, 0.5], [-0.9, 0.6], [-1.2, 0.66]], { col: "#8b939a", h: 0.035 });
        });
      }
    });
    c.meta.armor = armorPlus(function (c) { roofLamp(c, c.meta.roof.x1, c.meta.roof.y + 0.2, 0.3); });
  });

  /* ================= Cruzi Patrulha (Chevrolet Cruze da PM) ================= */
  /* Referência: Chevrolet Cruze Sedan 2017+ (fichacompleta.com.br, LT 1.4 Turbo 2019)
     Medidas reais: comprimento 4,665 · largura 1,807 · altura 1,484 · entre-eixos 2,700 · bitola ≈ 1,544 / 1,565 (de memória)
       · pneu 205/60 R16 da frota policial (Ø 0,652; 215/50 R17 no LT) · vão livre ≈ 0,15 · balanços ≈ 0,94 / 1,03 (de memória).
     Traços de assinatura:
       frente: faróis afilados para trás com DRL embaixo; grade dupla separada por barra na cor com o emblema (fenda fina em cima,
         grade maior embaixo); tomada inferior larga.
       lateral: vinco de ombro do farol à lanterna; vinco baixo nas portas; teto em arco caindo num vidro traseiro bem inclinado;
         coluna C grossa; tampa do porta-malas curta e alta.
       traseira: lanternas horizontais que invadem a tampa; para-choque com refletores.
       viatura: giroflex em barra no teto, para-choque de impulsão, grade separando o banco de trás, rádio, portas na cor
         da corporação com "POLÍCIA MILITAR" (ou branca com faixas azul e amarela na PRF). */
  /* mesmo construtor para a PM e a PRF (prf = true: portas brancas, faixas azul e amarela, "POLÍCIA RODOVIÁRIA FEDERAL" e "191") */
  function patrulha(c, prf) {
    var white = "#e9e8e2", door = prf ? white : "#30363f", blueP = "#1f3f8f", yellowP = "#f2c21a", fone = prf ? "191" : "190";
    carro(c, {
      W: 1.8, col: white, bottomY: 0.27, noseY: 0.74, tailY: 0.92,
      lower: [[-2.34, 0.28, 0.06], [-2.39, 0.56, 0.14], [-2.37, 0.9, 0.12], [-2.26, 1.03, 0.14], [-1.88, 1.03, 0.04], [0.76, 1.0, 0], [1.42, 0.93, 0.45], [2.1, 0.78, 0.16], [2.2, 0.55, 0.16], [2.16, 0.28, 0.06]],
      arches: [[1.3, 0.325, 0.365], [-1.4, 0.325, 0.365]],
      gh: { rb: -1.86, rt: -1.08, ft: -0.06, fb: 0.8, belt: 1.0, roof: 1.43, roofR: 1.38, crown: 0.025, rise: 0.03, Wg: 1.64, k: 0.21, pillars: [-0.46, -1.3], r1: 0.32, r2: 0.28 },
      seams: [0.72, -0.46, -1.36], handles: [0.26, -0.72], blackPillars: [-0.46],
      bumperF: { y1: 0.56 }, bumperR: { y1: 0.6 },
      plateF: 0.42, plateR: 0.78, plateROnBumper: false,
      front: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.665 + 0.012 * u; }, yt = function (u) { return 0.752 + 0.024 * u; };
          K.head(sd, { z0: 0.38, wrap: 0.18, shape: function (u) { return [yb(u), yt(u)]; }, proj: [[0.3, -0.004, 0.03], [0.58, -0.004, 0.03]],
            drl: [{ u0: 0.08, u1: 0.96, yb: function (u) { return yb(u) + 0.005; }, yt: function (u) { return yb(u) + 0.016; } }],
            amber: [{ u0: 0.82, u1: 0.98, yb: function (u) { return yt(u) - 0.03; }, yt: function (u) { return yt(u) - 0.008; } }] });
        });
        /* grade dupla: fenda de cima, barra na cor com emblema, grade de baixo maior */
        K.grille(1, { z1: 0.38, y0: 0.7, y1: 0.78, u0: 0.03, u1: 0.97, yb: 0.722, yt: 0.758, tex: "barsd", tile: 0.05, frame: MT.chrome, frameR: 0.005 });
        K.grille(1, { z1: 0.4, y0: 0.56, y1: 0.7, u0: 0.04, u1: 0.96, yb: 0.585, yt: 0.692, tex: "mesh", tile: 0.06, frame: MT.chrome, frameR: 0.006 });
        var e = K.grid(1, 0, { z1: 0.1, y0: 0.68, y1: 0.73, du: 0.03, dv: 0.025 }).at(0.5, 0.706); ZG.emblem(c, e.p.x + 0.02, 0.706, 0, 0.04);
        var lw = K.grid(1, 0, { z1: 0.6, y0: 0.31, y1: 0.5, du: 0.03, dv: 0.03 });
        K.skin(lw, grilleMat("mesh"), { u0: lw.uz(-0.48), u1: lw.uz(0.48), yb: 0.34, yt: 0.46, off: 0.021, tile: 0.06, nv: 2 });
        outline(c, lw, { u0: lw.uz(-0.48), u1: lw.uz(0.48), yb: 0.34, yt: 0.46 }, 0.006, LH, 0.022);
      },
      rear: function (c, K, I) {
        [1, -1].forEach(function (sd) {
          var yb = function (u) { return 0.835 + 0.02 * u; }, yt = function (u) { return 0.955 - 0.01 * u; };
          K.tail(sd, { z0: 0.43, wrap: 0.2, shape: function (u) { return [yb(u), yt(u)]; },
            hi: [{ u0: 0.1, u1: 0.96, yb: function (u) { return yt(u) - 0.024; }, yt: function (u) { return yt(u) - 0.011; } }, { u0: 0.86, u1: 0.92, yb: function (u) { return yb(u) + 0.01; }, yt: function (u) { return yt(u) - 0.011; } }],
            rev: [{ u0: 0.08, u1: 0.3, yb: function (u) { return yb(u) + 0.01; }, yt: function (u) { return yb(u) + 0.045; } }] });
          K.reflector(sd, I.hw - 0.24, 0.44, 0.12);
        });
        K.lid([{ y: 0.95, z: -0.41 }, { y: 0.66, z: -0.41 }, { y: 0.62, z: -0.38 }, { y: 0.62, z: 0.38 }, { y: 0.66, z: 0.41 }, { y: 0.95, z: 0.41 },
          { top: true, x: -2.28, z: 0.58 }, { top: true, x: -2.15, z: 0.64 }, { top: true, x: -1.94, z: 0.62 }, { top: true, x: -1.92, z: 0.4 }, { top: true, x: -1.92, z: -0.4 }, { top: true, x: -1.94, z: -0.62 }, { top: true, x: -2.15, z: -0.64 }, { top: true, x: -2.28, z: -0.58 }, { y: 0.95, z: -0.41 }]);
        c.text(fone, 0.22, 0.08, I.S.endX(-1, 0.9) - 0.016, 0.9, 0, "-x", { fg: "#1d3f8a" });
      },
      interior: { rows: 2, col: "#1f2023" }, hood: { motor: "gasolina" },
      wheels: [[1.3, 0.32, 0.21, wheelOpts("steelg")], [-1.4, 0.32, 0.21, wheelOpts("steelg")]],
      warp: { bowF: 0.19, bowR: 0.12, Lf: 0.6 },
      extra: function (c, I) {
        var S = I.S, K = I.K, dm = c.paint(door);
        [1, -1].forEach(function (sd) { crease(c, I, sd, [[1.8, 0.8], [0.6, 0.83], [-1.0, 0.87], [-2.2, 0.9]], { col: white, h: 0.026, u0: 0.01, u1: 0.99 }); });
        [1, -1].forEach(function (sd) {
          /* portas em cinza-escuro com "POLÍCIA MILITAR", faixa vermelha na cintura e "190" no para-lama traseiro */
          var Gd = sideGrid(S, sd, { x0: 0.715, x1: -1.355, y0: I.by + 0.1, y1: I.gh.belt - 0.01 });
          if (!prf) K.skin(Gd, dm, { yb: I.by + 0.14, yt: I.gh.belt - 0.035, off: 0.004, nv: 6, u0: 0.003, u1: 0.997 });
          var Gs = sideGrid(S, sd, { x0: 2.0, x1: -2.25, y0: 0.82, y1: 0.9 });
          K.skin(Gs, CM(prf ? blueP : "#b3201a", { roughness: 0.45, metalness: 0.2 }), { yb: 0.845, yt: 0.875, off: 0.007, nv: 1, u0: 0.01, u1: 0.99 });
          if (prf) { /* faixa azul larga e filete amarelo logo abaixo da cintura */
            var Gs2 = sideGrid(S, sd, { x0: 2.0, x1: -2.25, y0: 0.74, y1: 0.84 });
            K.skin(Gs2, CM(blueP, { roughness: 0.45, metalness: 0.2 }), { yb: 0.775, yt: 0.83, off: 0.007, nv: 1, u0: 0.01, u1: 0.99 });
            K.skin(Gs2, CM(yellowP, { roughness: 0.45, metalness: 0.2 }), { yb: 0.746, yt: 0.77, off: 0.007, nv: 1, u0: 0.01, u1: 0.99 });
          }
          var f = sd > 0 ? "+z" : "-z", pt = Gd.at(Gd.ux ? 0.5 : 0.5, 0.62).p;
          if (prf) c.text("POLÍCIA RODOVIÁRIA FEDERAL", 1.9, 0.13, -0.32, 0.6, sd * (Math.abs(pt.z) + 0.012), f, { fg: blueP, w: 1024, h: 70, size: 0.86 });
          else c.text("POLÍCIA MILITAR", 1.5, 0.15, -0.32, 0.64, sd * (Math.abs(pt.z) + 0.012), f, { fg: "#f4f2ea", w: 1024, h: 102, size: 0.78 });
          var q = S.hit(new V3(-1.95, 0.66, sd * (I.hw + 1)), new V3(0, 0, -sd), "M");
          c.text(fone, 0.34, 0.15, -1.95, prf ? 0.6 : 0.66, sd * ((q ? Math.abs(q.p.z) : I.hw) + 0.012), f, { fg: "#1d3f8a", size: 0.8 });
          c.rb(0.06, 0.1, 0.06, 0.02, MT.chrome, I.gh.fb - 0.12, I.gh.belt + 0.04, sd * 0.86);
        });
        var top = I.gh.roof + 0.05;
        /* giroflex (amassa junto e conta para o repouso ao capotar) */
        var gir = [c.rb(0.32, 0.06, 1.24, 0.03, MT.trim, -0.42, top + 0.03, 0, { def: true }),
          c.rb(0.26, 0.09, 0.56, 0.04, MT.tail, -0.42, top + 0.1, 0.32, { taper: { sx: 0.8, sz: 0.94 }, def: true }),
          c.rb(0.26, 0.09, 0.56, 0.04, MT.blue, -0.42, top + 0.1, -0.32, { taper: { sx: 0.8, sz: 0.94 }, def: true }),
          c.rb(0.2, 0.06, 0.04, 0.02, MT.head, -0.42 + 0.06, top + 0.1, 0)];
        /* giroflex é do teto: apaga a partir de amassado (lente quebrada) e some com o teto arrancado */
        c.zone("teto", null, null, gir, { onBand: function (c2, b) { if (b >= 2) { gir[1].material = CM("#4a1512", { roughness: 0.5 }); gir[2].material = CM("#15214a", { roughness: 0.5 }); gir[3].material = MT.trim; } } });
        c.meta.top = top + 0.15; c.meta.roof.y = Math.max(c.meta.roof.y, top + 0.15);
        /* para-choque de impulsão (push bar) */
        var fx = I.fxB + 0.12, push = [];
        [0.42, -0.42].forEach(function (z) { push.push(c.tube([[fx - 0.12, 0.34, z], [fx, 0.38, z], [fx + 0.02, 0.7, z], [fx - 0.07, 0.8, z]], 0.028, MT.trim)); });
        push.push(c.rod(new V3(fx + 0.01, 0.52, -0.5), new V3(fx + 0.01, 0.52, 0.5), 0.028, MT.trim));
        push.push(c.rod(new V3(fx + 0.02, 0.68, -0.45), new V3(fx + 0.02, 0.68, 0.45), 0.024, MT.trim));
        push.push(c.rb(0.04, 0.12, 0.7, 0.02, RUBBER, fx + 0.03, 0.6, 0));
        /* o para-choque de impulsão é do para-choque dianteiro (entorta, pende e cai com ele) e alarga a caixa da zona */
        c.zone("parachoque_d", "Para-choque e quebra-mato", [fx - 0.55, fx + 0.3, -0.02, 0.86, -I.hw - 0.2, I.hw + 0.2], push);
        /* grade que separa o banco de trás */
        for (var z = -0.7; z <= 0.71; z += 0.1) c.rod(new V3(-0.6, 0.66, z), new V3(-0.6, 1.33, z), 0.007, MT.steel);
        c.rod(new V3(-0.6, 1.0, -0.72), new V3(-0.6, 1.0, 0.72), 0.012, MT.steel);
        c.cyl(0.08, 0.06, 0.1, MT.trim, I.gh.fb - 0.35, I.gh.belt + 0.08, -0.86, "x"); c.cyl(0.065, 0.065, 0.01, MT.head, I.gh.fb - 0.3, I.gh.belt + 0.08, -0.86, "x");
      }
    });
    c.meta.armor = armorPlus(function (c) { roofLamp(c, c.meta.roof.x1, c.meta.roof.y + 0.22, 0.4); roofLamp(c, c.meta.roof.x1, c.meta.roof.y + 0.22, -0.4); });
  }
  ZG.register({ k: "viatura", grp: "Carros", n: "Cruzi Patrulha", insp: "Chevrolet Cruze da PM", c: "Sedã policial", fuel: "flex",
    d: "Motor turbo, giroflex, sirene e grade separando o banco de trás. Rádio e armário de armas vazios. A sirene atrai a horda num raio de 250 m.",
    mass: 1400, r: 70, seats: "4 + 1 detido", cap: "52 L", eff: "11,5 km/L (G) · 8,1 km/L (E)", auto: "600 km", vmax: 205, skill: "—", hood: true
  }, function (c) { patrulha(c, false); });
  ZG.register({ k: "viatura-prf", grp: "Carros", n: "Cruzi Rodoviária", insp: "Chevrolet Cruze da PRF", c: "Sedã policial rodoviário", fuel: "flex",
    d: "A mesma viatura com a pintura da polícia rodoviária: branca com faixas azul e amarela. Achada parada em postos de fiscalização à beira da estrada. A sirene atrai a horda num raio de 250 m.",
    mass: 1400, r: 70, seats: "4 + 1 detido", cap: "52 L", eff: "11,5 km/L (G) · 8,1 km/L (E)", auto: "600 km", vmax: 205, skill: "—", hood: true
  }, function (c) { patrulha(c, true); });

  /* ================= motos: peças comuns ================= */
  function fork(c, top, axle, zg, r, up, low, o) {
    o = o || {};
    [1, -1].forEach(function (s) {
      var a = new V3(top[0], top[1], s * zg), b = new V3(axle[0], axle[1], s * zg), mid = a.clone().lerp(b, o.split || 0.5);
      c.rod(a, mid, r, up, { seg: 12 });
      c.rod(mid.clone().lerp(a, 0.06), b, r * (o.lowK || 1.35), low, { seg: 12 });
      if (o.gaiter) c.rod(mid.clone().lerp(a, 0.25), mid.clone().lerp(b, 0.1), r * 1.6, RUBBER, { seg: 10 });
    });
    c.rb(0.1, 0.035, zg * 2 + 0.08, 0.012, o.clamp || MT.trim, top[0] - 0.01, top[1] - 0.02, 0, { rot: [0, 0, Math.atan2(axle[0] - top[0], top[1] - axle[1])] });
  }
  function handlebar(c, x, y, half, o) {
    o = o || {};
    var mat = o.mat || MT.trim, rise = o.rise || 0.03, back = o.back || 0.06, n0 = c.g.children.length;
    c.deform.push(c.tube([[x - back, y + rise, -half], [x - back * 0.3, y + rise * 0.6, -half * 0.55], [x, y, 0], [x - back * 0.3, y + rise * 0.6, half * 0.55], [x - back, y + rise, half]], o.r || 0.012, mat, { seg: 30 }));
    [1, -1].forEach(function (s) {
      c.deform.push(c.cyl(0.019, 0.019, 0.13, RUBBER, x - back, y + rise, s * (half - 0.05), "z"));
      c.rb(0.13, 0.012, 0.02, 0.005, MT.steel, x - back + 0.05, y + rise - 0.01, s * (half - 0.1), { rot: [0, s * 0.35, 0] });
      c.rb(0.05, 0.045, 0.06, 0.012, MT.trim, x - back + 0.01, y + rise, s * (half - 0.17));
      if (o.mirrors !== false) {
        var mz = s * (half - 0.14), stalk = new V3(x - back + 0.02, y + rise + (o.stalk || 0.2), mz + s * 0.06);
        c.rod(new V3(x - back + 0.01, y + rise + 0.02, mz), stalk, 0.006, MT.trim, { seg: 6 });
        c.rb(0.03, 0.07, 0.12, 0.025, MT.trim, stalk.x, stalk.y + 0.02, stalk.z + s * 0.02, { def: true });
        c.rb(0.006, 0.055, 0.1, 0.01, MT.chrome, stalk.x - 0.017, stalk.y + 0.02, stalk.z + s * 0.02);
      }
      if (o.guards) c.deform.push(c.tube([[x - back + 0.02, y + rise, s * (half - 0.2)], [x + 0.08, y + rise + 0.01, s * (half - 0.08)], [x - back + 0.02, y + rise - 0.01, s * (half + 0.01)]], 0.02, o.guards, { seg: 16 }));
    });
    return c.g.children.slice(n0);
  }
  function blinker(c, x, y, z, front) {
    c.rod(new V3(x, y, z * 0.55), new V3(x, y, z), 0.008, MT.trim, { seg: 6 });
    var b = c.sph(0.026, MT.amber, x + (front ? 0.012 : -0.012), y, z, 1.5, 0.9, 0.9); b.castShadow = false;
  }
  function plateMoto(c, x, y) {
    c.rb(0.02, 0.15, 0.2, 0.008, MT.trim, x + 0.012, y, 0);
    c.text("ZMB4D", 0.2, 0.135, x, y, 0, "-x", { w: 300, h: 220, bg: "#f2f2ee", band: "#1f4fa3", fg: "#151515", size: 0.42, font: "'IBM Plex Mono', monospace" });
  }
  function singleEngine(c, o) {
    var x = o.x, y = o.y, tilt = o.tilt || 0.3, fin = o.fin || FIN;
    c.rb(0.38, 0.26, 0.24, 0.07, ENG, x - 0.02, y, 0, { def: true });
    c.sph(0.11, ENG, x - 0.04, y - 0.01, 0.12, 1.1, 1.0, 0.36);
    c.sph(0.1, ENGD, x - 0.08, y + 0.0, -0.12, 1.0, 1.0, 0.36);
    var cx = x + 0.1, cy = y + 0.13;
    for (var f = 0; f < 7; f++) {
      var t = f / 6, px = cx + Math.sin(tilt) * t * 0.22, py = cy + Math.cos(tilt) * t * 0.22;
      c.rb(0.2 - t * 0.02, 0.014, 0.22 - t * 0.02, 0.006, fin, px, py, 0, { rot: [0, 0, -tilt] });
    }
    c.rb(0.12, 0.2, 0.12, 0.03, ENG, cx + Math.sin(tilt) * 0.11, cy + Math.cos(tilt) * 0.11, 0, { rot: [0, 0, -tilt] });
    c.rb(0.16, 0.06, 0.18, 0.025, ENG, cx + Math.sin(tilt) * 0.26, cy + Math.cos(tilt) * 0.26, 0, { rot: [0, 0, -tilt] });
    return { exh: new V3(cx + Math.sin(tilt) * 0.2 + 0.06, cy + Math.cos(tilt) * 0.1, 0.06) };
  }
  /* filete de LED aceso sobre a lente de um farol do núcleo (entra como peça interna: apaga se o farol quebra) */
  function drlOn(L, w, h, y, d) { var m = new THREE.Mesh(G.rbox(0.01, h, w, Math.min(0.005, h * 0.4)), DRL); m.position.set((d || 0.06) / 2 + 0.004, y || 0, 0); m.castShadow = false; L.g.add(m); L.inner.push(m); return m; }
  /* gira um conjunto de malhas filhas de c.g em torno de um ponto (guidão torto, para-lama solto) */
  function bendSet(list, piv, axis, ang) {
    var q = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), ang);
    list.forEach(function (m) { if (!m.parent) return; m.position.sub(piv).applyQuaternion(q).add(piv); m.quaternion.premultiply(q); });
  }
  /* galão deitado (preso com cintas) */
  function jerryFlat(c, x, y, z, col) {
    c.rb(0.4, 0.15, 0.28, 0.04, CM(col, { roughness: 0.5 }), x, y, z, { def: true });
    c.cyl(0.022, 0.022, 0.05, MT.trim, x + 0.18, y + 0.06, z + 0.1);
    [-0.1, 0.1].forEach(function (dx) { c.rb(0.03, 0.155, 0.29, 0.005, CM("#1b1c1e"), x + dx, y + 0.002, z); });
  }
  function bikeMeta(c, o) { Object.assign(c.meta, { kind: "bike", clear: 0.25, bodyH: 0.6, belt: 0.88 }, o); }

  /* ================= Monarca Barra Circular (Monark) ================= */
  /* Referência: Monark Barra Circular aro 26 (monark.com.br: aro 26, 19,5 a 20 kg; medidas de memória)
     Medidas reais: comprimento ≈ 1,82 · largura do guidão ≈ 0,62 · altura no guidão ≈ 1,05 · entre-eixos ≈ 1,10 · pneu 26 x 1.1/2 (Ø ≈ 0,68)
       · altura do selim ≈ 0,92 · movimento central a ≈ 0,29 do chão.
     Traços de assinatura:
       frente: farol redondo cromado no garfo; guidão de passeio largo, curvado para trás, com manoplas de borracha.
       lateral: a "barra circular": dois tubos paralelos que descem em arco da caixa de direção até o movimento central;
         quadro de aço pintado com a barra superior reta; para-lamas cromados; capa de corrente; selim de molas.
       traseira: bagageiro cromado de varetas sobre a roda; refletor vermelho; contra-pedal (sem câmbio).
       de cima: quadro fino, guidão largo em "C" para trás. */
  ZG.register({ k: "bicicleta", grp: "Motos", n: "Monarca Barra Circular", insp: "Monark Barra Circular", art: "na", c: "Bicicleta", fuel: "nenhum",
    d: "A clássica bicicleta de barra dupla curva, de aço, com bagageiro. Silenciosa, sem combustível e totalmente exposta.",
    mass: 18, r: 5, seats: "1 (+1 no bagageiro)", cap: "—", eff: "—", auto: "Fôlego do ciclista", vmax: 25, skill: "—", hood: false
  }, function (c) {
    var col = CM(ZG.paintCol("#6d1f1c", c.st), { roughness: 0.4, metalness: 0.35 }), r = 0.34, tr = 0.022;
    ZG.spokedWheel(c, -0.53, r, tr, { spokes: 36 }); ZG.spokedWheel(c, 0.56, r, tr, { spokes: 36 });
    var BB = [-0.02, 0.3], SC = [-0.2, 0.84], HT = [0.38, 0.88], HB = [0.41, 0.72];
    c.tube([[BB[0], BB[1], 0], [SC[0], SC[1], 0]], 0.018, col, { seg: 8 });
    c.tube([[SC[0], SC[1] - 0.04, 0], [0.08, 0.85, 0], [HT[0], HT[1] - 0.02, 0]], 0.017, col);
    /* barra dupla circular: dois tubos paralelos num arco único da caixa de direção até o movimento central */
    [0.024, -0.024].forEach(function (z) {
      var P0 = [HT[0] - 0.01, HT[1] - 0.05], C = [0.0, 0.76], P1 = [BB[0] + 0.06, BB[1] + 0.05], pts = [];
      for (var k = 0; k <= 8; k++) { var t = k / 8, a = (1 - t) * (1 - t), b2 = 2 * (1 - t) * t, d = t * t; pts.push([a * P0[0] + b2 * C[0] + d * P1[0], a * P0[1] + b2 * C[1] + d * P1[1], z]); }
      c.tube(pts, 0.014, col, { seg: 48 });
    });
    c.tube([[HB[0], HB[1], 0], [BB[0], BB[1], 0]], 0.018, col, { seg: 8 });
    c.cyl(0.024, 0.024, 0.2, col, 0.395, 0.8, 0).rotation.z = -0.3;
    [1, -1].forEach(function (s) {
      c.tube([[BB[0], BB[1], s * 0.03], [-0.53, r, s * 0.06]], 0.011, col, { seg: 6 });
      c.tube([[SC[0], SC[1] - 0.04, s * 0.02], [-0.53, r, s * 0.06]], 0.011, col, { seg: 6 });
      c.tube([[HB[0], HB[1], s * 0.04], [0.5, 0.48, s * 0.05], [0.56, r, s * 0.05]], 0.012, MT.chrome, { seg: 10 });
    });
    c.tube([[SC[0], SC[1], 0], [-0.21, 0.92, 0]], 0.012, MT.chrome, { seg: 4 });
    body(c, [[-0.06, 0.965, 0.93, 0.05], [-0.14, 0.975, 0.92, 0.12], [-0.26, 0.985, 0.92, 0.22], [-0.33, 0.98, 0.93, 0.2]], MT.leather, { p: 2.2 });
    [0.06, -0.06].forEach(function (z) { var sp = c.add(new THREE.TorusGeometry(0.02, 0.006, 6, 12), MT.chrome, -0.3, 0.9, z); sp.rotation.x = PI / 2; });
    c.tube([[0.38, 0.88, 0], [0.37, 1.0, 0]], 0.012, MT.chrome, { seg: 4 });
    c.deform.push(c.tube([[0.2, 1.0, -0.3], [0.33, 1.04, -0.16], [0.37, 1.01, 0], [0.33, 1.04, 0.16], [0.2, 1.0, 0.3]], 0.011, MT.chrome));
    [0.3, -0.3].forEach(function (z) { c.deform.push(c.cyl(0.018, 0.018, 0.1, MT.seat, 0.2, 1.0, z, "z")); });
    c.add(new THREE.TorusGeometry(0.1, 0.008, 6, 30), MT.steel, BB[0], BB[1], 0.07);
    c.rb(0.36, 0.1, 0.012, 0.03, col, BB[0] - 0.24, BB[1] + 0.03, 0.09, { rot: [0, 0, 0.06] });
    c.rb(0.16, 0.025, 0.012, 0.006, MT.steel, BB[0] + 0.07, BB[1] - 0.04, 0.08, { rot: [0, 0, -0.5] }); c.rb(0.16, 0.025, 0.012, 0.006, MT.steel, BB[0] - 0.07, BB[1] + 0.04, -0.08, { rot: [0, 0, -0.5] });
    c.rb(0.1, 0.02, 0.08, 0.008, MT.trim, BB[0] + 0.14, BB[1] - 0.08, 0.11); c.rb(0.1, 0.02, 0.08, 0.008, MT.trim, BB[0] - 0.14, BB[1] + 0.08, -0.11);
    [-0.53, 0.56].forEach(function (wx) { var fd = c.add(fenderGeo(wx, r, r + 0.02, wx < 0 ? 0.25 : 0.05, wx < 0 ? 2.6 : 2.2, 0.06, 0.02, 0), MT.chrome, 0, 0, 0); c.deform.push(fd); });
    c.rb(0.36, 0.015, 0.14, 0.006, MT.chrome, -0.62, 0.74, 0);
    for (var b = 0; b < 4; b++) c.rb(0.34, 0.01, 0.01, 0.004, MT.chrome, -0.62, 0.745, -0.06 + b * 0.04);
    [0.06, -0.06].forEach(function (z) { c.tube([[-0.45, 0.74, z], [-0.53, r, z]], 0.008, MT.chrome, { seg: 4 }); });
    c.cyl(0.03, 0.03, 0.03, MT.chrome, 0.32, 1.04, 0.14, "z");
    ZG.headlight(c, { style: "round", x: 0.47, y: 0.9, z: 0, w: 0.08, h: 0.08, d: 0.06, side: 1, label: "Farol" });
    ZG.taillight(c, { style: "round2", x: -0.8, y: 0.72, z: 0, w: 0.09, h: 0.045, side: 1, label: "Refletor traseiro" });
    bikeMeta(c, { L: 1.75, W: 0.62, front: 0.92, rear: -0.88, clear: 0.3, top: 1.05, belt: 0.8, col: "#6d1f1c", rack: 0.75 });
    /* modificado: caixote amarrado no bagageiro (apoiado), galãozinho dentro, cesta na frente */
    c.meta.armor = function (c, Z) {
      var ry = 0.755;
      c.rb(0.34, 0.22, 0.28, 0.02, MT.wood, -0.62, ry + 0.115, 0, { def: true });
      for (var k = 0; k < 3; k++) c.rb(0.35, 0.012, 0.285, 0.004, CM("#4a3420"), -0.62, ry + 0.04 + k * 0.07, 0);
      c.rb(0.16, 0.2, 0.1, 0.02, CM("#8e2a20", { roughness: 0.5 }), -0.66, ry + 0.2, 0.04);
      c.cyl(0.015, 0.015, 0.04, MT.trim, -0.6, ry + 0.31, 0.04);
      [-0.7, -0.54].forEach(function (x) { c.rb(0.02, 0.235, 0.29, 0.004, CM("#1b1c1e"), x, ry + 0.115, 0); });
      c.rb(0.22, 0.16, 0.3, 0.02, CM("#4a3d2a"), 0.5, 0.86, 0); c.rod(new V3(0.39, 0.86, 0), new V3(0.42, 0.98, 0), 0.008, MT.steel);
    };
  });

  /* ================= PXC 160 (Honda PCX 160) ================= */
  /* Referência: Honda PCX 160 2023+ (ficha Honda, via motoragora.com.br)
     Medidas reais: comprimento 1,935 · largura 0,742 · altura 1,108 (sem retrovisor) · entre-eixos 1,313 · altura do banco 0,764
       · vão livre 0,134 · pneus 110/70-14 (Ø 0,510) e 130/70-13 (Ø 0,512) · balanços ≈ 0,36 / 0,26 (de memória).
     Traços de assinatura:
       frente: escudo alto e estreito com o farol de LED em "V" (duas lentes finas que sobem para fora); bico com o pisca no centro;
         carenagem do guidão fechada com painel digital e para-brisa curto.
       lateral: túnel central alto entre os pés (o tanque fica nele), plataformas para os pés dos lados; banco longo em dois níveis;
         carenagem traseira longa e afilada; motor-balança à esquerda, escapamento grande com protetor à direita; rodas de liga pequenas.
       traseira: rabeta pontuda com lanterna de LED em "X" fina, alça de garupa integrada, placa baixa.
       de cima: corpo em gota, banco largo atrás, escudo estreito na frente. */
  ZG.register({ k: "scooter", grp: "Motos", n: "PXC 160", insp: "Honda PCX 160", c: "Scooter 160 cc", fuel: "gasolina",
    d: "Câmbio automático, assoalho plano e baú sob o banco. Fácil de pilotar no meio do engarrafamento abandonado; rodas pequenas sofrem na terra.",
    mass: 132, r: 50, seats: "2", cap: "8,1 L", eff: "40 km/L", auto: "320 km", vmax: 115, skill: "Pilotagem 1", hood: false
  }, function (c) {
    var hex = "#2f4d73", col = c.paint(hex), blk = CM("#151618", { roughness: 0.55 }), satin = CM("#3b3e42", { roughness: 0.5, metalness: 0.3 });
    var fr = 0.255;
    ZG.spokedWheel(c, 0.66, fr, 0.055, { cast: true, disc: true, label: "Pneu dianteiro" });
    ZG.spokedWheel(c, -0.65, fr, 0.065, { cast: true, label: "Pneu traseiro" });
    /* carenagem frontal: escudo de pernas que sobe até o bico do farol em V */
    body(c, [[0.34, 0.38, 0.2, 0.34, 2.6], [0.46, 0.47, 0.22, 0.4, 2.6], [0.58, 0.64, 0.26, 0.46, 2.6], [0.7, 0.76, 0.3, 0.46, 2.6], [0.82, 0.81, 0.36, 0.4, 2.5], [0.94, 0.74, 0.42, 0.32, 2.4], [1.03, 0.62, 0.48, 0.2, 2.2], [1.06, 0.56, 0.52, 0.08, 2]], col, { axis: "y" });
    body(c, [[0.36, 0.3, 0.17, 0.3, 2.6], [0.6, 0.34, 0.2, 0.38, 2.6], [0.84, 0.38, 0.28, 0.36, 2.6], [0.98, 0.42, 0.34, 0.26, 2.4]], satin, { axis: "y" });
    /* assoalho: plataformas dos pés dos lados e o túnel central alto (o tanque fica dentro dele) */
    c.rb(0.56, 0.06, 0.38, 0.03, blk, 0.0, 0.37, 0, { def: true });
    body(c, [[0.36, 0.5, 0.4, 0.16, 2.6], [0.24, 0.56, 0.4, 0.2, 2.8], [0.04, 0.6, 0.4, 0.21, 2.8], [-0.12, 0.66, 0.4, 0.2, 2.6]], col);
    c.rb(0.3, 0.012, 0.06, 0.004, satin, 0.12, 0.6, 0.0);
    c.rb(0.54, 0.012, 0.34, 0.005, CM("#2a2b2d", { roughness: 0.95 }), 0.0, 0.405, 0);
    /* carenagem traseira e banco */
    body(c, [[0.2, 0.57, 0.42, 0.2, 2.6], [0.04, 0.695, 0.36, 0.34, 2.8], [-0.3, 0.735, 0.36, 0.38, 2.8], [-0.62, 0.765, 0.46, 0.34, 2.6], [-0.84, 0.785, 0.6, 0.24, 2.4], [-0.95, 0.765, 0.68, 0.1, 2]], col);
    body(c, [[0.14, 0.765, 0.685, 0.14], [0.02, 0.765, 0.675, 0.3], [-0.28, 0.765, 0.685, 0.34], [-0.42, 0.815, 0.705, 0.32], [-0.74, 0.835, 0.725, 0.28], [-0.86, 0.825, 0.745, 0.16]], CM("#1b1c1e", { roughness: 0.75 }), { p: 3 });
    c.tube([[-0.62, 0.795, -0.18], [-0.86, 0.805, -0.13], [-0.92, 0.815, 0], [-0.86, 0.805, 0.13], [-0.62, 0.795, 0.18]], 0.016, satin, { seg: 24 });
    ZG.taillight(c, { style: "bar", x: -0.945, y: 0.74, z: 0, w: 0.22, h: 0.05, d: 0.05, side: 1, label: "Lanterna" });
    c.rb(0.2, 0.05, 0.12, 0.02, blk, -0.885, 0.61, 0, { rot: [0, 0, 0.7] });
    plateMoto(c, -0.955, 0.53);
    [1, -1].forEach(function (s) { blinker(c, -0.91, 0.71, s * 0.14, false); blinker(c, 0.74, 0.78, s * 0.22, true); });
    /* motor-balança (lado esquerdo) e escapamento (direito) */
    c.rb(0.62, 0.17, 0.12, 0.05, satin, -0.38, 0.3, -0.13, { def: true });
    c.rb(0.42, 0.13, 0.03, 0.04, ENG, -0.4, 0.3, -0.2);
    c.rb(0.28, 0.24, 0.24, 0.06, ENGD, -0.06, 0.32, 0.0);
    c.cyl(0.07, 0.06, 0.42, EXH, -0.62, 0.36, 0.17, "x"); c.rb(0.36, 0.1, 0.04, 0.03, HEAT, -0.62, 0.38, 0.22);
    c.tube([[-0.05, 0.22, 0.05], [-0.25, 0.2, 0.15], [-0.42, 0.33, 0.17]], 0.022, EXH);
    [1, -1].forEach(function (s) { c.rod(new V3(-0.62, 0.36, s * 0.14), new V3(-0.5, 0.72, s * 0.15), 0.02, MT.chrome); c.rod(new V3(-0.6, 0.44, s * 0.14), new V3(-0.53, 0.62, s * 0.15), 0.032, CM("#a32620", { roughness: 0.5 })); });
    /* garfo, para-lama, guidão, painel */
    fork(c, [0.56, 0.92], [0.66, fr], 0.08, 0.02, MT.trim, satin);
    c.add(fenderGeo(0.66, fr, fr + 0.03, 0.15, 2.0, 0.12, 0.022, 0), col, 0, 0, 0);
    /* carenagem do guidão fechada: cobre o guidão inteiro, só as manoplas ficam de fora */
    body(c, [[0.37, 1.05, 0.95, 0.2, 2.6], [0.44, 1.075, 0.92, 0.5, 3.0], [0.53, 1.07, 0.9, 0.54, 3.0], [0.63, 1.02, 0.88, 0.42, 2.8], [0.72, 0.95, 0.9, 0.16]], col);
    /* painel digital escuro com o mostrador aceso só no meio */
    c.rb(0.16, 0.02, 0.2, 0.01, CM("#121518", { roughness: 0.25, metalness: 0.3 }), 0.44, 1.08, 0, { rot: [0, 0, 0.35] });
    c.rb(0.08, 0.022, 0.1, 0.006, MT.gauge, 0.445, 1.082, 0, { rot: [0, 0, 0.35] });
    handlebar(c, 0.5, 1.03, 0.36, { rise: 0.0, back: 0.04, stalk: 0.14 });
    /* farol em V no escudo: duas lentes com refletor, projetor e LED aceso nas bordas; friso preto central no escudo */
    [1, -1].forEach(function (sd) {
      var L = lamp(c, { style: "slim", x: 0.875, y: 0.75, z: sd * 0.085, w: 0.2, h: 0.065, d: 0.06, side: sd, yaw: 0.28, roll: sd * 0.42, label: "Farol " + (sd > 0 ? "direito" : "esquerdo") });
      drlOn(L, 0.19, 0.014, 0.022, 0.06); drlOn(L, 0.16, 0.008, -0.026, 0.06);
    });
    body(c, [[0.62, 0.7, 0.3, 0.05, 2.2], [0.78, 0.74, 0.34, 0.06, 2.2], [0.92, 0.68, 0.42, 0.055, 2.2], [1.0, 0.6, 0.47, 0.04, 2.0]], blk, { axis: "y", def: false });
    c.rb(0.02, 0.018, 0.05, 0.006, MT.amber, 0.962, 0.565, 0);
    c.rod(new V3(0.0, 0.26, -0.12), new V3(-0.1, 0.06, -0.24), 0.012, MT.trim);
    c.part("motor", "Motor e transmissão", null, new V3(-0.3, 0.32, -0.1), 0.8); c.part("tanque", "Tanque (sob o assoalho)", null, new V3(0.05, 0.3, 0), 0.6);
    c.part("carenagem", "Carenagem frontal", null, new V3(0.85, 0.55, 0), 0.6);
    bikeMeta(c, { L: 1.94, W: 0.74, front: 1.08, rear: -1.06, clear: 0.14, bodyH: 0.62, top: 1.11, belt: 0.8, col: hex });
    c.meta.armor = function (c) {
      c.rb(0.42, 0.38, 0.42, 0.04, CM("#a8241c", { roughness: 0.6 }), -0.7, 1.05, 0);
      c.text("ENTREGAS", 0.36, 0.08, -0.7, 1.07, 0.215, "+z", { fg: "#f2efe6" }); c.text("ENTREGAS", 0.36, 0.08, -0.7, 1.07, -0.215, "-z", { fg: "#f2efe6" });
      c.rb(0.46, 0.03, 0.3, 0.01, ZG.STEELM, -0.7, 0.85, 0);
      [1, -1].forEach(function (s) { c.tube([[0.7, 0.9, s * 0.2], [0.85, 0.55, s * 0.28], [0.55, 0.32, s * 0.26], [0.2, 0.3, s * 0.22]], 0.018, ZG.STEELM); });
      c.rod(new V3(0.6, 1.08, -0.3), new V3(0.95, 1.5, -0.3), 0.008, MT.trim);
      ZG.jerry(c, 0.15, 0.6, 0, "#8e2a20");
    };
  });

  /* ================= Titã 160 (Honda CG 160 Titan) ================= */
  /* Referência: Honda CG 160 Titan 2016+ (ficha Honda, via motoragora.com.br)
     Medidas reais: comprimento 2,032 · largura 0,745 · altura 1,087 (sem retrovisor) · entre-eixos 1,315 · altura do banco 0,790
       · vão livre 0,170 · pneus 80/100-18 (Ø 0,617) e 90/90-18 (Ø 0,619) · balanços ≈ 0,35 / 0,37 (de memória).
     Traços de assinatura:
       frente: farol trapezoidal multirrefletor numa carenagem curta pintada; piscas em hastes; para-lama dianteiro curto pintado.
       lateral: tanque alto com aletas laterais pretas e o nome; tampa lateral preta sob o banco com "160"; motor monocilíndrico
         prata com aletas inclinadas; escapamento cromado baixo com protetor preto subindo para trás; rodas de liga com disco na frente.
       traseira: rabeta fina que sobe, lanterna embutida na ponta, alça de garupa de alumínio, placa com piscas.
       de cima: tanque largo que afina no banco; banco longo e reto até a rabeta. */
  ZG.register({ k: "moto", grp: "Motos", n: "Titã 160", insp: "Honda CG 160 Titan", art: "na", c: "Moto urbana 160 cc", fuel: "flex",
    d: "A moto mais vendida do país: passa entre carros parados e se conserta com qualquer peça. Uma queda no meio da horda pode ser fatal.",
    mass: 122, r: 70, seats: "2", cap: "16,1 L", eff: "40 km/L (G) · 28 km/L (E)", auto: "640 km", vmax: 115, skill: "Pilotagem 1", hood: false
  }, function (c) {
    var hex = "#a4241d", col = c.paint(hex), blk = CM("#17181a", { roughness: 0.55 }), gray = CM("#4a4c4f", { metalness: 0.4, roughness: 0.45 });
    ZG.spokedWheel(c, 0.66, 0.31, 0.045, { cast: true, disc: true, label: "Pneu dianteiro" });
    ZG.spokedWheel(c, -0.66, 0.31, 0.05, { cast: true, label: "Pneu traseiro" });
    /* quadro */
    c.tube([[0.36, 0.93, 0], [0.25, 0.66, 0], [0.12, 0.34, 0], [-0.16, 0.26, 0], [-0.2, 0.5, 0], [-0.14, 0.7, 0]], 0.02, blk, { seg: 40 });
    c.tube([[0.36, 0.93, 0], [0.1, 0.8, 0], [-0.14, 0.72, 0], [-0.5, 0.74, 0], [-0.86, 0.78, 0]], 0.019, blk, { seg: 40 });
    c.cyl(0.035, 0.035, 0.16, blk, 0.37, 0.91, 0).rotation.z = -0.42;
    var eng = singleEngine(c, { x: 0.02, y: 0.42, tilt: 0.32 });
    /* tanque e aletas */
    body(c, [[0.38, 0.93, 0.77, 0.14, 2.2], [0.3, 0.965, 0.71, 0.3, 2.4], [0.14, 0.96, 0.69, 0.34, 2.4], [0.0, 0.92, 0.7, 0.3, 2.4], [-0.08, 0.86, 0.73, 0.2, 2.2], [-0.11, 0.83, 0.77, 0.08, 2]], col);
    [1, -1].forEach(function (s) {
      body(c, [[0.4, 0.88, 0.78, 0.03, 2, s * 0.13], [0.3, 0.87, 0.6, 0.04, 2, s * 0.17], [0.18, 0.81, 0.58, 0.03, 2, s * 0.17], [0.12, 0.75, 0.64, 0.02, 2, s * 0.15]], blk, { p: 2 });
      c.text("TITÃ 160", 0.2, 0.05, 0.16, 0.87, s * 0.176, s > 0 ? "+z" : "-z", { fg: "#f0eee8", size: 0.8 });
    });
    /* banco, rabeta, para-lamas */
    body(c, [[-0.04, 0.84, 0.75, 0.16], [-0.14, 0.82, 0.73, 0.27], [-0.4, 0.83, 0.74, 0.27], [-0.62, 0.86, 0.77, 0.24], [-0.7, 0.86, 0.79, 0.12]], CM("#1c1c1e", { roughness: 0.8 }), { p: 3 });
    body(c, [[-0.06, 0.76, 0.58, 0.22, 2.6], [-0.3, 0.77, 0.6, 0.24, 2.6], [-0.6, 0.81, 0.68, 0.22, 2.6], [-0.82, 0.82, 0.74, 0.14, 2.4], [-0.9, 0.81, 0.77, 0.06]], col);
    c.tube([[-0.45, 0.82, -0.14], [-0.8, 0.85, -0.11], [-0.86, 0.86, 0], [-0.8, 0.85, 0.11], [-0.45, 0.82, 0.14]], 0.014, CM("#b8bdc1", { metalness: 0.7, roughness: 0.3 }), { seg: 24 });
    c.add(fenderGeo(-0.66, 0.31, 0.36, 1.2, 2.9, 0.14, 0.025, 0), blk, 0, 0, 0);
    c.add(fenderGeo(0.66, 0.31, 0.345, 0.2, 2.2, 0.12, 0.02, 0), col, 0, 0, 0);
    ZG.taillight(c, { style: "vertical", x: -0.9, y: 0.775, z: 0, w: 0.12, h: 0.07, d: 0.06, side: 1, label: "Lanterna" });
    plateMoto(c, -1.0, 0.6);
    /* balança, amortecedores, corrente, pedaleiras */
    [1, -1].forEach(function (s) {
      c.rod(new V3(-0.18, 0.4, s * 0.1), new V3(-0.66, 0.31, s * 0.1), 0.022, blk);
      c.rod(new V3(-0.6, 0.34, s * 0.13), new V3(-0.5, 0.76, s * 0.13), 0.014, MT.chrome);
      c.tube((function () { var p = []; for (var i = 0; i <= 40; i++) { var t = i / 40, a = t * PI * 2 * 8; p.push([-0.58 + 0.06 * t + Math.cos(a) * 0.004, 0.42 + t * 0.26, s * 0.13 + Math.sin(a) * 0.024]); } return p; })(), 0.006, CM("#b02a22", { roughness: 0.4 }), { seg: 200, rs: 4 });
      c.rb(0.12, 0.022, 0.05, 0.01, RUBBER, 0.0, 0.32, s * 0.2);
      c.rb(0.08, 0.02, 0.045, 0.01, RUBBER, -0.4, 0.46, s * 0.17);
    });
    c.rb(0.5, 0.06, 0.03, 0.02, blk, -0.42, 0.38, -0.12, { rot: [0, 0, 0.15] });
    /* tampas laterais pretas sob o banco, com "160", e a caixa do filtro de ar entre elas */
    c.rb(0.22, 0.16, 0.18, 0.04, blk, -0.24, 0.6, 0);
    [1, -1].forEach(function (s) {
      body(c, [[-0.06, 0.73, 0.6, 0.02, 2, s * 0.12], [-0.16, 0.74, 0.54, 0.035, 2.2, s * 0.13], [-0.34, 0.75, 0.56, 0.035, 2.2, s * 0.13], [-0.46, 0.76, 0.64, 0.02, 2, s * 0.12]], blk, { p: 2.2 });
      c.text("160", 0.1, 0.05, -0.26, 0.66, s * 0.152, s > 0 ? "+z" : "-z", { fg: "#e8e6df", size: 0.9 });
    });
    /* escapamento */
    c.tube([[eng.exh.x, eng.exh.y, 0.06], [eng.exh.x + 0.05, eng.exh.y - 0.1, 0.12], [0.08, 0.26, 0.16], [-0.3, 0.32, 0.18], [-0.48, 0.4, 0.18]], 0.022, EXH, { seg: 40 });
    c.cyl(0.055, 0.045, 0.42, EXH, -0.66, 0.46, 0.18).rotation.z = -PI / 2 + 0.22;
    c.rb(0.32, 0.07, 0.03, 0.03, HEAT, -0.62, 0.48, 0.23, { rot: [0, 0, 0.22] });
    /* garfo, farol, guidão */
    fork(c, [0.38, 0.95], [0.66, 0.31], 0.085, 0.017, MT.chrome, gray);
    body(c, [[0.4, 1.01, 0.8, 0.22, 2.6], [0.47, 1.0, 0.8, 0.26, 2.6], [0.53, 0.98, 0.82, 0.24, 2.6], [0.565, 0.94, 0.84, 0.12, 2.2]], col);
    lamp(c, { style: "rect", x: 0.57, y: 0.91, z: 0, w: 0.2, h: 0.11, d: 0.08, side: 1, label: "Farol" });
    c.rb(0.1, 0.07, 0.18, 0.02, blk, 0.36, 1.04, 0, { rot: [0, 0, 0.4] }); c.rb(0.02, 0.05, 0.15, 0.01, MT.gauge, 0.39, 1.06, 0, { rot: [0, 0, 0.4] });
    handlebar(c, 0.36, 1.03, 0.37, { rise: 0.04, back: 0.06, mat: MT.chrome, stalk: 0.19 });
    [1, -1].forEach(function (s) { blinker(c, 0.48, 0.9, s * 0.17, true); blinker(c, -0.86, 0.77, s * 0.15, false); });
    c.rod(new V3(-0.06, 0.3, -0.14), new V3(-0.16, 0.06, -0.26), 0.012, blk);
    c.part("motor", "Motor", null, new V3(0.02, 0.45, 0), 0.8); c.part("tanque", "Tanque", null, new V3(0.15, 0.84, 0), 0.7);
    bikeMeta(c, { L: 2.04, W: 0.75, front: 1.0, rear: -1.04, clear: 0.17, bodyH: 0.62, top: 1.09, belt: 0.84, col: hex, rack: 0.85 });
    /* modificado: bagageiro de chapa sobre a rabeta com o galão em cima, caixas laterais presas no suporte, protetor de motor */
    c.meta.armor = function (c, Z) {
      var ry = 0.88;
      c.rb(0.46, 0.025, 0.3, 0.008, Z.STEELM, -0.66, ry, 0, { def: true });
      [1, -1].forEach(function (s) {
        c.rod(new V3(-0.45, 0.8, s * 0.13), new V3(-0.48, ry, s * 0.14), 0.012, Z.STEELM);
        c.tube([[-0.42, ry, s * 0.15], [-0.42, 0.56, s * 0.24], [-0.9, 0.56, s * 0.24], [-0.9, ry, s * 0.15]], 0.012, Z.STEELM, { seg: 20 });
        c.rb(0.44, 0.32, 0.17, 0.05, CM("#3d3a2e"), -0.66, 0.68, s * 0.33, { def: true });
        c.rb(0.45, 0.04, 0.175, 0.015, CM("#25241e"), -0.66, 0.84, s * 0.33);
        c.tube([[0.38, 0.86, s * 0.16], [0.45, 0.6, s * 0.3], [0.1, 0.3, s * 0.28]], 0.02, MT.steel);
      });
      jerryFlat(c, -0.68, ry + 0.09, 0, "#8e2a20");
      c.rb(0.42, 0.06, 0.3, 0.02, Z.STEELM, 0.05, 0.25, 0);
    };
  });

  /* ================= Brós 160 (Honda NXR 160 Bros) ================= */
  /* Referência: Honda NXR 160 Bros 2015+ (ficha Honda, via motoragora.com.br)
     Medidas reais: comprimento 2,067 · largura 0,810 · altura 1,151 (sem retrovisor) · entre-eixos 1,356 · altura do banco 0,836
       · vão livre 0,247 · pneus 90/90-19 (Ø 0,645) e 110/90-17 (Ø 0,630) · balanços ≈ 0,33 / 0,38 (de memória).
     Traços de assinatura:
       frente: farol retangular numa máscara alta com viseira fumê; para-lama dianteiro alto, branco, preso abaixo da mesa;
         garfo longo com sanfonas; protetores de mão.
       lateral: tanque com aletas grandes brancas e o nome; banco longo e reto; rabeta fina com bagageiro tubular;
         rodas raiadas com pneus de cravo; protetor de cárter; escapamento subindo para a rabeta com protetor.
       traseira: lanterna pequena sob o bagageiro, para-lama traseiro preto com a placa, piscas em hastes.
       de cima: tanque estreito e longo, banco fino, bagageiro retangular atrás. */
  ZG.register({ k: "trail", grp: "Motos", n: "Brós 160", insp: "Honda NXR 160 Bros", art: "na", c: "Moto trail 160 cc", fuel: "flex",
    d: "Suspensão longa e pneus de cravo: sobe barranco, atravessa lama e foge da horda por trilha onde carro não passa.",
    mass: 125, r: 70, seats: "2", cap: "12 L", eff: "38 km/L (G) · 26 km/L (E)", auto: "450 km", vmax: 115, skill: "Pilotagem 1", hood: false
  }, function (c) {
    var hex = "#b8261d", col = c.paint(hex), wht = c.paint("#e7e5df"), blk = CM("#17181a", { roughness: 0.55 }), gray = CM("#3c3f43", { metalness: 0.4, roughness: 0.45 });
    ZG.spokedWheel(c, 0.72, 0.322, 0.05, { spokes: 32, knobby: true, disc: true, label: "Pneu dianteiro" });
    ZG.spokedWheel(c, -0.66, 0.315, 0.06, { spokes: 32, knobby: true, label: "Pneu traseiro" });
    c.tube([[0.4, 1.0, 0], [0.28, 0.72, 0], [0.14, 0.4, 0], [-0.16, 0.32, 0], [-0.2, 0.56, 0], [-0.14, 0.78, 0]], 0.021, blk, { seg: 40 });
    c.tube([[0.4, 1.0, 0], [0.12, 0.86, 0], [-0.14, 0.78, 0], [-0.55, 0.8, 0], [-0.9, 0.83, 0]], 0.019, blk, { seg: 40 });
    c.cyl(0.035, 0.035, 0.18, blk, 0.41, 0.97, 0).rotation.z = -0.38;
    var eng = singleEngine(c, { x: 0.04, y: 0.48, tilt: 0.28 });
    c.rb(0.42, 0.03, 0.26, 0.015, CM("#5a5e62", { metalness: 0.6, roughness: 0.4 }), 0.06, 0.3, 0, { rot: [0, 0, 0.12] });
    /* tanque e aletas grandes */
    body(c, [[0.44, 0.99, 0.83, 0.14, 2.2], [0.34, 1.03, 0.75, 0.3, 2.4], [0.18, 1.01, 0.73, 0.33, 2.4], [0.02, 0.95, 0.75, 0.27, 2.4], [-0.07, 0.89, 0.8, 0.14, 2.2]], col);
    [1, -1].forEach(function (s) {
      body(c, [[0.46, 0.99, 0.85, 0.03, 2, s * 0.15], [0.34, 0.98, 0.67, 0.05, 2, s * 0.19], [0.16, 0.92, 0.65, 0.05, 2, s * 0.19], [0.04, 0.85, 0.73, 0.03, 2, s * 0.16]], wht, { p: 2 });
      c.text("BRÓS", 0.22, 0.07, 0.24, 0.85, s * 0.218, s > 0 ? "+z" : "-z", { fg: "#b8261d", size: 0.85 });
      body(c, [[-0.1, 0.8, 0.6, 0.03, 2, s * 0.13], [-0.4, 0.82, 0.65, 0.04, 2, s * 0.13], [-0.7, 0.85, 0.77, 0.03, 2, s * 0.1]], wht, { p: 2 });
    });
    body(c, [[0.04, 0.89, 0.8, 0.14], [-0.08, 0.86, 0.77, 0.26], [-0.42, 0.85, 0.76, 0.26], [-0.74, 0.86, 0.78, 0.2], [-0.82, 0.85, 0.8, 0.1]], CM("#1c1c1e", { roughness: 0.8 }), { p: 3 });
    body(c, [[-0.06, 0.78, 0.58, 0.22, 2.6], [-0.4, 0.8, 0.63, 0.24, 2.6], [-0.82, 0.83, 0.75, 0.16, 2.4], [-0.95, 0.82, 0.79, 0.06]], col);
    for (var i = 0; i < 4; i++) c.rod(new V3(-0.58 - i * 0.09, 0.87, -0.12), new V3(-0.6 - i * 0.1, 0.87, 0.12), 0.008, blk);
    c.tube([[-0.5, 0.87, -0.13], [-0.9, 0.87, -0.1], [-0.92, 0.87, 0.1], [-0.5, 0.87, 0.13]], 0.012, blk, { seg: 20 });
    ZG.taillight(c, { style: "vertical", x: -0.95, y: 0.78, z: 0, w: 0.1, h: 0.06, d: 0.05, side: 1, label: "Lanterna" });
    body(c, [[-0.9, 0.77, 0.73, 0.12], [-0.98, 0.68, 0.65, 0.12], [-1.02, 0.6, 0.57, 0.1]], blk);
    plateMoto(c, -1.03, 0.53);
    /* para-lama dianteiro alto, carenagem do farol */
    var fendF = body(c, [[0.36, 0.84, 0.8, 0.08], [0.48, 0.87, 0.81, 0.17], [0.7, 0.85, 0.79, 0.17], [0.92, 0.8, 0.75, 0.15], [1.06, 0.72, 0.69, 0.1]], wht, { p: 2.2 });
    fork(c, [0.42, 1.02], [0.72, 0.322], 0.085, 0.019, MT.chrome, gray, { gaiter: true, split: 0.42 });
    body(c, [[0.44, 1.13, 0.85, 0.24, 2.6], [0.55, 1.11, 0.87, 0.24, 2.6], [0.6, 1.05, 0.91, 0.16, 2.4]], col);
    c.rb(0.02, 0.14, 0.18, 0.02, MT.glassDark, 0.5, 1.17, 0, { rot: [0, 0, 0.35] });
    lamp(c, { style: "rect", x: 0.58, y: 0.99, z: 0, w: 0.16, h: 0.11, d: 0.07, side: 1, label: "Farol" });
    var bars = handlebar(c, 0.38, 1.1, 0.4, { rise: 0.05, back: 0.07, guards: blk, stalk: 0.19 });
    [1, -1].forEach(function (s) {
      blinker(c, 0.52, 0.95, s * 0.16, true); blinker(c, -0.92, 0.76, s * 0.15, false);
      c.rod(new V3(-0.18, 0.44, s * 0.1), new V3(-0.66, 0.315, s * 0.1), 0.024, gray);
      c.rb(0.12, 0.024, 0.06, 0.01, MT.steel, 0.0, 0.36, s * 0.21);
    });
    c.rod(new V3(-0.24, 0.48, 0), new V3(-0.1, 0.77, 0), 0.03, CM("#c83a1e", { roughness: 0.45 }));
    c.tube([[eng.exh.x, eng.exh.y, 0.06], [eng.exh.x + 0.06, eng.exh.y - 0.12, 0.14], [0.02, 0.32, 0.17], [-0.3, 0.44, 0.17], [-0.48, 0.62, 0.16]], 0.022, EXH, { seg: 40 });
    c.cyl(0.05, 0.045, 0.4, EXH, -0.66, 0.7, 0.16).rotation.z = -PI / 2 + 0.38;
    c.rb(0.34, 0.08, 0.03, 0.03, HEAT, -0.62, 0.7, 0.21, { rot: [0, 0, 0.38] });
    c.rod(new V3(-0.04, 0.32, -0.14), new V3(-0.16, 0.06, -0.26), 0.012, blk);
    c.part("motor", "Motor", null, new V3(0.04, 0.5, 0), 0.8); c.part("tanque", "Tanque", null, new V3(0.18, 0.91, 0), 0.7);
    bikeMeta(c, { L: 2.08, W: 0.82, front: 1.06, rear: -1.04, clear: 0.25, bodyH: 0.66, top: 1.17, belt: 0.88, col: hex, rack: 0.87 });
    /* batida: além do amassado padrão, o guidão entorta e o para-lama dianteiro solta de um lado e cai */
    c.meta.damage = function (c, Z) {
      Z.defaultDamage(c);
      bendSet(bars, new V3(0.4, 1.05, 0), new V3(-0.35, 1, 0), 0.32);
      bendSet(bars, new V3(0.4, 1.05, 0), new V3(1, 0, 0), -0.12);
      bendSet([fendF], new V3(0.4, 0.84, 0), new V3(0.15, 0, 1), -0.32);
      fendF.position.z -= 0.04;
    };
    c.meta.armor = function (c) {
      [1, -1].forEach(function (s) { ZG.jerry(c, -0.55, 0.62, s * 0.3, s > 0 ? "#8e2a20" : "#3e5a34"); c.rod(new V3(-0.3, 0.8, s * 0.14), new V3(-0.8, 0.8, s * 0.34), 0.012, ZG.STEELM); });
      c.rb(0.44, 0.24, 0.3, 0.05, CM("#3d3a2e"), -0.8, 1.0, 0);
      c.rod(new V3(0.5, 0.82, -0.12), new V3(-0.2, 1.0, -0.24), 0.01, MT.wood);
      c.rb(0.5, 0.06, 0.32, 0.02, ZG.STEELM, 0.04, 0.27, 0);
      roofLamp(c, 0.62, 1.12, 0.12); roofLamp(c, 0.62, 1.12, -0.12);
    };
  });

  /* ================= GZ 1250 Aventura (BMW R 1250 GS Adventure) ================= */
  /* Referência: BMW R 1250 GS Adventure 2019+ (motorcycle.com)
     Medidas reais: comprimento 2,270 · largura 0,980 (protetores de mão) · altura 1,460 (para-brisa baixo, sem retrovisor)
       · entre-eixos 1,504 · altura do banco 0,890 a 0,910 · vão livre ≈ 0,22 (de memória) · pneus 120/70 R19 (Ø 0,651)
       e 170/60 R17 (Ø 0,636) · balanços ≈ 0,38 / 0,39 (de memória).
     Traços de assinatura:
       frente: farol redondo de LED com DRL assimétrico; "bico" alto sob a carenagem; para-brisa alto e inclinado;
         cilindros boxer saindo para os lados com protetores tubulares; protetores de mão.
       lateral: tanque de 30 L enorme com "ombros" largos e o nome; banco em dois níveis; telelever e garfo dourado;
         balança monobraço com cardã à esquerda; escapamento alto à direita.
       traseira: malas de alumínio quadradas dos dois lados, bagageiro de alumínio, lanterna fina, para-lama com placa.
       de cima: tanque largo como uma pera, cilindros salientes nos dois lados, malas mais largas que tudo. */
  /* mesmo construtor para a civil e a da PRF (prf = true: branca, carenagem azul, faixas azul e amarela nas malas) */
  function bigtrail(c, prf) {
    var hex = prf ? "#eceae4" : "#cfccc2", col = c.paint(hex), dark = c.paint(prf ? "#1f3f8f" : "#33373c"), blk = CM("#141517", { roughness: 0.55 }), alu = CM("#a9afb3", { metalness: 0.7, roughness: 0.35 });
    var rimGold = CM("#b88a2a", { metalness: 0.8, roughness: 0.3 }), aluBox = CM("#c3c8cb", { metalness: 0.35, roughness: 0.42 });
    var fw = ZG.spokedWheel(c, 0.78, 0.325, 0.06, { spokes: 40, knobby: true, disc: true, label: "Pneu dianteiro" });
    var rw = ZG.spokedWheel(c, -0.72, 0.318, 0.08, { spokes: 40, knobby: true, label: "Pneu traseiro" });
    [fw, rw].forEach(function (g) { g.children.forEach(function (ch) { if (ch.geometry && ch.geometry.type === "TorusGeometry" && ch.material === MT.chrome) ch.material = rimGold; }); });
    /* motor boxer: cárter, cilindros que saem para os lados, câmbio */
    c.rb(0.42, 0.3, 0.3, 0.08, ENG, 0.2, 0.5, 0, { def: true });
    c.rb(0.3, 0.26, 0.28, 0.06, ENGD, -0.08, 0.5, 0);
    [1, -1].forEach(function (s) {
      c.cyl(0.085, 0.085, 0.2, ENG, 0.34, 0.5, s * 0.24, "z");
      c.rb(0.2, 0.17, 0.12, 0.04, ENG, 0.36, 0.52, s * 0.38, { def: true });
      c.rb(0.18, 0.12, 0.06, 0.03, CM("#1a1b1d", { metalness: 0.3, roughness: 0.4 }), 0.37, 0.56, s * 0.45);
      c.text("1250", 0.12, 0.04, 0.37, 0.56, s * 0.481, s > 0 ? "+z" : "-z", { fg: "#c9ced1", size: 0.8 });
      c.tube([[0.46, 0.46, s * 0.36], [0.5, 0.34, s * 0.3], [0.3, 0.24, s * 0.14], [0.0, 0.26, 0.08]], 0.025, EXH, { seg: 30 });
      /* protetor de cilindro */
      c.tube([[0.5, 0.92, s * 0.2], [0.6, 0.66, s * 0.44], [0.52, 0.34, s * 0.5], [0.22, 0.32, s * 0.5], [0.12, 0.6, s * 0.44], [0.2, 0.86, s * 0.22]], 0.017, blk, { seg: 40 });
      c.rb(0.07, 0.2, 0.14, 0.02, blk, 0.52, 0.8, s * 0.23);
    });
    c.rb(0.55, 0.035, 0.36, 0.015, alu, 0.18, 0.27, 0, { rot: [0, 0, 0.1] });
    /* quadro */
    c.tube([[0.5, 1.12, 0], [0.32, 0.86, 0], [0.0, 0.84, 0], [-0.5, 0.88, 0], [-0.98, 0.92, 0]], 0.022, blk, { seg: 40 });
    /* tanque de 30 L, bico e para-brisa */
    body(c, [[0.66, 1.17, 0.98, 0.3, 3.0], [0.54, 1.23, 0.86, 0.56, 3.4], [0.32, 1.23, 0.8, 0.62, 3.4], [0.12, 1.17, 0.82, 0.54, 3.2], [-0.04, 1.09, 0.86, 0.38, 2.8], [-0.12, 1.02, 0.92, 0.16, 2.2]], col);
    [1, -1].forEach(function (s) {
      body(c, [[0.5, 1.02, 0.84, 0.03, 2, s * 0.27], [0.36, 1.04, 0.76, 0.04, 2, s * 0.3], [0.2, 1.0, 0.78, 0.03, 2, s * 0.28]], dark, { p: 2 });
      c.text("GZ 1250", 0.26, 0.06, 0.2, 1.06, s * 0.296, s > 0 ? "+z" : "-z", { fg: "#2a4f8f", size: 0.85 });
    });
    body(c, [[0.62, 1.0, 0.88, 0.16], [0.8, 0.97, 0.82, 0.25], [1.0, 0.88, 0.75, 0.21], [1.17, 0.77, 0.7, 0.08]], c.paint("#2a4f8f"), { p: 2.8 });
    [1, -1].forEach(function (s) { c.rb(0.42, 0.018, 0.012, 0.005, c.paint("#b8261d"), 0.88, 0.9, s * 0.08, { rot: [0, 0, -0.38] }); });
    fork(c, [0.54, 1.14], [0.78, 0.325], 0.11, 0.025, MT.chrome, blk, { split: 0.45 });
    c.add(fenderGeo(0.78, 0.325, 0.37, 0.4, 2.1, 0.16, 0.02, 0), blk, 0, 0, 0);
    body(c, [[0.62, 1.32, 0.98, 0.3, 2.6], [0.72, 1.28, 1.0, 0.3, 2.6], [0.78, 1.2, 1.02, 0.22, 2.4]], dark);
    /* farol fechado: concha preta, refletor, lente e DRL assimétrico (meia-lua do lado direito, filete do esquerdo) */
    c.cyl(0.125, 0.115, 0.08, blk, 0.73, 1.11, 0, "x");
    var hlB = lamp(c, { style: "round", x: 0.77, y: 1.11, z: 0, w: 0.2, h: 0.2, d: 0.08, side: 1, label: "Farol" });
    var arc = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.009, 6, 24, PI * 0.95), DRL); arc.rotation.y = PI / 2; arc.rotation.x = -PI / 2 - 0.1; arc.position.set(0.042, 0, 0); arc.castShadow = false; hlB.g.add(arc); hlB.inner.push(arc);
    var fil = new THREE.Mesh(G.rbox(0.008, 0.11, 0.012, 0.004), DRL); fil.position.set(0.042, 0.0, -0.085); fil.castShadow = false; hlB.g.add(fil); hlB.inner.push(fil);
    var ws = c.rb(0.012, 0.36, 0.38, 0.05, CM("#c9d6dc", { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), 0.7, 1.33, 0, { rot: [0, 0, 0.42], taper: { sz: 0.8 } }); ws.castShadow = false; ws.renderOrder = 2;
    c.rb(0.1, 0.06, 0.24, 0.02, MT.gauge, 0.56, 1.32, 0, { rot: [0, 0, 0.6] });
    handlebar(c, 0.5, 1.26, 0.46, { rise: 0.04, back: 0.08, guards: blk, stalk: 0.18 });
    /* banco em dois níveis, rabeta, bagageiro */
    body(c, [[0.04, 0.96, 0.86, 0.2], [-0.08, 0.91, 0.82, 0.38], [-0.36, 0.9, 0.82, 0.38], [-0.44, 0.97, 0.87, 0.32], [-0.76, 0.98, 0.89, 0.3], [-0.84, 0.96, 0.91, 0.18]], CM("#1d1d1f", { roughness: 0.8 }), { p: 3 });
    body(c, [[-0.1, 0.9, 0.64, 0.34, 2.6], [-0.5, 0.93, 0.72, 0.34, 2.6], [-0.86, 0.97, 0.86, 0.24, 2.4], [-0.98, 0.96, 0.9, 0.1]], dark);
    c.rb(0.3, 0.025, 0.3, 0.01, alu, -0.92, 1.0, 0);
    ZG.taillight(c, { style: "bar", x: -1.0, y: 0.9, z: 0, w: 0.16, h: 0.05, d: 0.05, side: 1, label: "Lanterna" });
    body(c, [[-0.96, 0.86, 0.82, 0.14], [-1.05, 0.78, 0.74, 0.14], [-1.1, 0.68, 0.65, 0.1]], blk);
    plateMoto(c, -1.11, 0.6);
    /* balança monobraço com cardã (esquerda), escapamento (direita), malas */
    c.rb(0.62, 0.1, 0.07, 0.035, alu, -0.42, 0.4, -0.13, { rot: [0, 0, 0.18], def: true });
    c.sph(0.09, alu, -0.72, 0.318, -0.13, 1, 1, 0.7);
    c.rod(new V3(-0.3, 0.42, 0.08), new V3(-0.2, 0.86, 0.08), 0.03, CM("#b6862a", { metalness: 0.6, roughness: 0.4 }));
    c.cyl(0.075, 0.065, 0.46, EXH, -0.52, 0.56, 0.24).rotation.z = -PI / 2 + 0.2;
    c.cyl(0.04, 0.04, 0.05, HEAT, -0.76, 0.6, 0.24).rotation.z = -PI / 2 + 0.2;
    c.tube([[0.0, 0.26, 0.08], [-0.15, 0.3, 0.2], [-0.3, 0.5, 0.24]], 0.03, EXH, { seg: 20 });
    [1, -1].forEach(function (s) {
      var z = s * (s > 0 ? 0.44 : 0.4);
      var box = c.rb(0.5, 0.38, 0.2, 0.03, aluBox, -0.7, 0.8, z, { def: true }), mala = [box, c.rb(0.52, 0.04, 0.21, 0.015, blk, -0.7, 0.98, z)];
      [-0.88, -0.52].forEach(function (x) { mala.push(c.rb(0.04, 0.06, 0.03, 0.01, blk, x, 0.95, z + s * 0.1)); });
      c.tube([[-0.42, 0.62, s * 0.3], [-0.95, 0.62, s * 0.3], [-0.95, 0.98, s * 0.3]], 0.012, blk, { seg: 12 });
      c.part("carga", "Mala " + (s > 0 ? "direita" : "esquerda"), box, new V3(-0.7, 0.8, z), 0.6);
      /* cada mala de alumínio é uma zona própria: amassa, a tampa solta e ela cai (leva a carga junto) */
      c.zone(s > 0 ? "mala_d" : "mala_e", "Mala " + (s > 0 ? "direita" : "esquerda"), [-0.98, -0.42, 0.58, 1.03, s > 0 ? z - 0.12 : z - 0.14, s > 0 ? z + 0.14 : z + 0.12], mala,
        { type: "peca", side: s, dir: [0, 0, -s], w: 0.6, fx: ["Nenhum", "Só estético, alumínio riscado", "mala amassada: a tampa emperra", "tampa solta: a carga cai na estrada", "mala arrancada: carga perdida"] });
      blinker(c, 0.66, 1.0, s * 0.17, true); blinker(c, -0.98, 0.86, s * 0.14, false);
      c.rb(0.12, 0.024, 0.07, 0.01, MT.steel, 0.02, 0.4, s * 0.22);
    });
    c.part("motor", "Motor boxer", null, new V3(0.25, 0.5, 0), 0.9); c.part("tanque", "Tanque de 30 L", null, new V3(0.3, 1.05, 0), 0.8);
    bikeMeta(c, { L: 2.29, W: 1.04, front: 1.18, rear: -1.11, clear: 0.24, bodyH: 0.7, top: 1.5, belt: 0.98, col: hex, rack: 1.0 });
    c.meta.armor = function (c) {
      c.rb(0.42, 0.32, 0.42, 0.04, alu, -0.92, 1.17, 0, { def: true });
      c.rb(0.43, 0.04, 0.43, 0.015, blk, -0.92, 1.32, 0);
      jerryFlat(c, -0.92, 1.415, 0, "#8e2a20");
      [1, -1].forEach(function (s) { roofLamp(c, 0.62, 0.62, s * 0.5); });
      for (var i = -2; i <= 2; i++) c.rod(new V3(0.82, 1.0, i * 0.04), new V3(0.82, 1.22, i * 0.04), 0.004, MT.steel);
      c.rod(new V3(-0.2, 1.16, 0.26), new V3(0.4, 1.0, 0.36), 0.012, MT.wood);
      [1, -1].forEach(function (s) { c.tube([[0.66, 1.0, s * 0.22], [0.82, 0.62, s * 0.5], [0.6, 0.28, s * 0.54]], 0.02, ZG.STEELM); });
    };
    if (prf) {
      /* malas com faixas azul e amarela e "PRF"; sirene e luzes azul/vermelha no protetor */
      [1, -1].forEach(function (s) {
        var z = s * (s > 0 ? 0.44 : 0.4) + s * 0.101, f = s > 0 ? "+z" : "-z";
        c.rb(0.5, 0.05, 0.006, 0.002, c.paint("#1f3f8f"), -0.7, 0.86, z);
        c.rb(0.5, 0.018, 0.006, 0.002, c.paint("#f2c21a"), -0.7, 0.825, z);
        c.text("PRF", 0.2, 0.08, -0.7, 0.73, z + s * 0.002, f, { fg: "#1f3f8f", size: 0.85 });
        c.text("POLÍCIA RODOVIÁRIA FEDERAL", 0.3, 0.035, 0.24, 1.0, s * 0.3, f, { fg: "#f4f2ea", w: 1024, h: 120, size: 0.8 });
        c.rb(0.05, 0.05, 0.04, 0.012, s > 0 ? MT.blue : MT.tail, 0.62, 0.95, s * 0.3, { def: true });
      });
      c.cyl(0.04, 0.045, 0.06, MT.trim, 0.66, 0.66, 0.36, "x");
    }
  }
  ZG.register({ k: "bigtrail", grp: "Motos", n: "GZ 1250 Aventura", insp: "BMW R 1250 GS Adventure", art: "na", c: "Big trail 1250 cc", fuel: "gasolina",
    d: "Motor boxer, tanque de 30 litros e malas de alumínio. Atravessa o país sem parar em posto, mas pesa muito para levantar sozinho.",
    mass: 268, r: 85, seats: "2", cap: "30 L", eff: "20 km/L", auto: "600 km", vmax: 220, skill: "Pilotagem 2", hood: false
  }, function (c) { bigtrail(c, false); });
  ZG.register({ k: "moto-prf", grp: "Motos", n: "GZ 1250 Rodoviária", insp: "BMW R 1250 GS da PRF", art: "na", c: "Big trail policial", fuel: "gasolina",
    d: "A big trail da polícia rodoviária: branca e azul, malas com faixas, sirene e luzes no protetor do motor. Feita para rodar centenas de quilômetros por dia na rodovia.",
    mass: 275, r: 85, seats: "2", cap: "30 L", eff: "20 km/L", auto: "600 km", vmax: 220, skill: "Pilotagem 2", hood: false
  }, function (c) { bigtrail(c, true); });

  /* ================= Grizzli 700 (Yamaha Grizzly 700) ================= */
  /* Referência: Yamaha Grizzly 700 EPS 2016+ (ficha estadual de veículos WA, em polegadas)
     Medidas reais: comprimento 2,070 · largura 1,252 · altura 1,229 · entre-eixos 1,250 · altura do banco 0,917 · vão livre 0,287
       · pneus 26x8-12 e 26x10-12 (Ø 0,660) · bitola ≈ 0,97 / 0,94 (de memória) · balanços ≈ 0,41 / 0,41.
     Traços de assinatura:
       frente: par de faróis em cunha na carenagem dianteira com grade preta no meio; farol extra num casulo sobre o guidão;
         protetor tubular preto na frente.
       lateral: para-lamas grandes e bojudos cobrindo as quatro rodas; plataformas para os pés com grelha; banco alto e curto;
         pneus de cravo grandes em aros de liga escuros.
       traseira: bagageiro tubular grande, lanterna central, escapamento à direita.
       de cima: dois bagageiros (frente e trás) quase do tamanho do veículo, banco estreito no meio. */
  ZG.register({ k: "quadri", grp: "Motos", n: "Grizzli 700", insp: "Yamaha Grizzly 700", c: "Quadriciclo 4x4", fuel: "gasolina",
    d: "Tração 4x4 e bagageiros na frente e atrás. Bom em fazenda e mato; instável em alta velocidade e sem nenhuma proteção.",
    mass: 296, r: 65, seats: "1 (+1 improvisado)", cap: "18 L", eff: "13 km/L", auto: "230 km", vmax: 100, skill: "Pilotagem 1", hood: false
  }, function (c) {
    var hex = "#3f5a35", col = c.paint(hex), blk = CM("#17181a", { roughness: 0.6 }), rim = CM("#2b2d2f", { metalness: 0.5, roughness: 0.4 });
    [[0.62, 0.5, 0.21], [0.62, -0.5, 0.21], [-0.63, 0.49, 0.25], [-0.63, -0.49, 0.25]].forEach(function (p) { c.wheel(p[0], p[1], 0.33, p[2], { lugs: true, chevron: true, rim: rim, spokes: 6, rimR: 0.55 }); });
    /* chassi e motor */
    c.rb(1.25, 0.12, 0.42, 0.04, blk, 0, 0.32, 0);
    c.rb(0.4, 0.3, 0.34, 0.07, ENG, -0.05, 0.48, 0, { def: true });
    c.rb(0.18, 0.18, 0.2, 0.04, FIN, 0.12, 0.66, 0, { rot: [0, 0, -0.3] });
    /* para-lamas dianteiros e traseiros (cascas sobre as rodas) e corpo central */
    [1, -1].forEach(function (s) {
      [[0.62, 0.21, 0.15, 2.3], [-0.63, 0.25, 0.9, 3.0]].forEach(function (w) {
        var fd = c.add(fenderGeo(w[0], 0.33, 0.41, w[2], w[3], 0.28, 0.014, s * 0.49, { na: 36, p: 4 }), col, 0, 0, 0); c.deform.push(fd); fd.castShadow = false;
      });
      c.rb(0.6, 0.04, 0.24, 0.015, blk, 0.0, 0.46, s * 0.4, { def: true });
      for (var t = 0; t < 4; t++) c.rb(0.03, 0.012, 0.22, 0.004, MT.steel, -0.2 + t * 0.14, 0.485, s * 0.4);
    });
    body(c, [[1.0, 0.7, 0.52, 0.42, 2.6], [0.92, 0.8, 0.5, 0.52, 2.8], [0.62, 0.84, 0.52, 0.56, 2.8], [0.32, 0.83, 0.52, 0.48, 2.6], [0.2, 0.8, 0.56, 0.34, 2.4]], col, { seg: 40, smooth: 14, crease: 80 }).castShadow = false;
    body(c, [[0.36, 0.92, 0.7, 0.3, 2.4], [0.2, 0.94, 0.72, 0.34, 2.4], [0.04, 0.92, 0.74, 0.3, 2.4]], col, { seg: 36, crease: 80 });
    body(c, [[-0.2, 0.84, 0.56, 0.4, 2.6], [-0.5, 0.86, 0.54, 0.58, 2.8], [-0.86, 0.84, 0.54, 0.54, 2.8], [-1.0, 0.76, 0.56, 0.34, 2.4]], col, { seg: 40, smooth: 14, crease: 80 }).castShadow = false;
    body(c, [[0.06, 0.97, 0.88, 0.26], [-0.1, 0.99, 0.86, 0.36], [-0.5, 0.99, 0.86, 0.36], [-0.66, 0.96, 0.88, 0.28]], CM("#1d1d1f", { roughness: 0.8 }), { p: 3 });
    /* bagageiros */
    [[0.66, 0.9, 0.74, 0.86], [-0.66, 0.9, 0.62, 0.8]].forEach(function (r) {
      var x0 = r[0] - r[2] / 2, x1 = r[0] + r[2] / 2, z = r[3] / 2, y = r[1];
      [[x0, -z, x1, -z], [x1, -z, x1, z], [x1, z, x0, z], [x0, z, x0, -z]].forEach(function (q) { c.deform.push(c.rod(new V3(q[0], y, q[1]), new V3(q[2], y, q[3]), 0.018, blk)); });
      [[x0, -z], [x1, -z], [x1, z], [x0, z]].forEach(function (q) { c.sph(0.018, blk, q[0], y, q[1]); });
      for (var k = -2; k <= 2; k++) c.rod(new V3(x0, y + 0.004, k * z * 0.4), new V3(x1, y + 0.004, k * z * 0.4), 0.01, blk);
      [x0 + 0.05, x1 - 0.05].forEach(function (x) { [-z, z].forEach(function (zz) { c.rod(new V3(x, y, zz), new V3(x, y - 0.1, zz * 0.9), 0.014, blk); }); });
    });
    /* para-choque, faróis, guidão */
    c.tube([[0.9, 0.34, -0.28], [1.03, 0.38, -0.22], [1.05, 0.52, -0.2], [1.05, 0.52, 0.2], [1.03, 0.38, 0.22], [0.9, 0.34, 0.28]], 0.026, blk, { seg: 40 });
    c.rb(0.06, 0.1, 0.3, 0.02, blk, 1.03, 0.44, 0);
    /* frente: grade central preta entre dois faróis em cunha maiores, acesos */
    var gq = c.rb(0.03, 0.12, 0.15, 0.012, grilleMat("mesh"), 1.025, 0.62, 0); gq.castShadow = false;
    c.rb(0.04, 0.14, 0.17, 0.015, LH, 1.01, 0.62, 0);
    [1, -1].forEach(function (s) { var L = lamp(c, { style: "wedge", x: 1.005, y: 0.655, z: s * 0.165, w: 0.16, h: 0.085, d: 0.07, side: s, yaw: 0.35 }); drlOn(L, 0.14, 0.014, -0.028, 0.07); });
    c.rod(new V3(0.32, 0.86, 0), new V3(0.25, 1.16, 0), 0.03, blk);
    body(c, [[0.17, 1.22, 1.11, 0.2], [0.3, 1.23, 1.1, 0.25], [0.39, 1.2, 1.11, 0.17]], col);
    lamp(c, { style: "rect", x: 0.39, y: 1.165, z: 0, w: 0.13, h: 0.05, d: 0.05, side: 1, label: "Farol do guidão" });
    handlebar(c, 0.23, 1.17, 0.4, { rise: 0.04, back: 0.05, mirrors: false });
    ZG.taillight(c, { style: "vertical", x: -1.02, y: 0.72, z: 0, w: 0.16, h: 0.06, d: 0.05, side: 1, label: "Lanterna" });
    c.cyl(0.05, 0.05, 0.22, EXH, -0.92, 0.5, 0.22, "x");
    c.part("motor", "Motor", null, new V3(-0.05, 0.5, 0), 0.8); c.part("tanque", "Tanque", null, new V3(0.2, 0.86, 0), 0.6);
    Object.assign(c.meta, { kind: "quad", L: 2.09, W: 1.25, front: 1.06, rear: -1.02, clear: 0.28, bodyH: 0.56, top: 1.23, belt: 0.86, col: hex, roof: { x0: -0.9, x1: -0.42, w: 0.6, y: 0.92 }, rack: 0.92 });
    c.meta.armor = function (c, Z) {
      [1, -1].forEach(function (s) { Z.jerry(c, -0.72, 1.12, s * 0.2, s > 0 ? "#8e2a20" : "#3e5a34"); });
      c.rb(0.5, 0.3, 0.6, 0.05, CM("#4a4b3c"), 0.66, 1.06, 0);
      c.tube([[1.06, 0.52, -0.3], [1.2, 0.5, -0.35], [1.22, 0.3, -0.35], [1.22, 0.3, 0.35], [1.2, 0.5, 0.35], [1.06, 0.52, 0.3]], 0.03, Z.STEELM, { seg: 40 });
      for (var i = 0; i < 5; i++) { var sp = c.add(new THREE.ConeGeometry(0.03, 0.2, 8), Z.STEELM, 1.3, 0.42, -0.3 + i * 0.15); sp.rotation.z = -PI / 2; }
      roofLamp(c, 0.4, 1.32, 0.12); roofLamp(c, 0.4, 1.32, -0.12);
    };
  });

  /* ================= Fusquinha 1300 (Volkswagen Fusca) ================= */
  /* Referência: Volkswagen Fusca 1300 1975 (fichacompleta.com.br)
     Medidas reais: comprimento 4,026 (≈ 4,06 com as garras) · largura 1,540 · altura 1,500 · entre-eixos 2,400 · bitola 1,305 / 1,288
       · pneu 5.60-15 (Ø 0,665) · vão livre 0,152 · balanços ≈ 0,75 / 0,88 (de memória).
     Traços de assinatura:
       frente: capô curto e caído (porta-malas) com o emblema redondo; faróis redondos em cápsulas no alto dos para-lamas;
         piscas pequenos em cima dos para-lamas; para-choque de lâmina cromada com garras.
       lateral: teto em arco único do para-brisa até a grelha do motor; para-lamas separados e bojudos; estribo de borracha
         ligando os para-lamas; duas janelas com borracha e friso; porta com maçaneta de botão; calotas cromadas.
       traseira: tampa do motor vertical com grelhas; lanternas "fafá" nos para-lamas; escapamento com duas ponteiras.
       teto: casca estreita e alta no meio, para-lamas bem para fora nas quatro rodas. */
  /* Corpo em loft (arredondado de verdade), para-lamas separados, janelas recortadas no casco que viram vidro,
     motor a ar atrás e capô dianteiro que abre o porta-malas (estepe, tanque e macaco). */
  ZG.register({ k: "fusca", grp: "Carros", n: "Fusquinha 1300", insp: "Volkswagen Fusca", c: "Sedã clássico (motor traseiro)", fuel: "gasolina",
    d: "Motor a ar atrás, sem radiador para furar. Mecânica simples: qualquer um conserta com chave e arame. Barulhento e lento, mas não morre.",
    mass: 780, r: 75, seats: "5 (apertados)", cap: "40 L", eff: "11 km/L", auto: "440 km", vmax: 120, skill: "Mecânica 1 (motor a ar, conserto fácil)", hood: true
  }, function (c) {
    var hex = "#6f93b3", col = c.paint(hex), m = c.meta;
    /* capô curto e caído (nariz encurtado ~16%), cabine alta: o teto é um arco contínuo do para-brisa até a grelha do motor */
    var st = [[1.81, 0.6, 0.36, 0.66, 2.2], [1.71, 0.69, 0.32, 0.98, 2.4], [1.49, 0.8, 0.3, 1.12, 2.6], [1.16, 0.9, 0.3, 1.2, 2.8], [0.82, 0.99, 0.3, 1.28, 2.8],
      [0.6, 1.31, 0.3, 1.32, 2.5], [0.32, 1.45, 0.3, 1.34, 2.4], [0.0, 1.5, 0.3, 1.34, 2.4], [-0.4, 1.475, 0.3, 1.33, 2.4], [-0.8, 1.36, 0.3, 1.29, 2.5],
      [-1.12, 1.15, 0.3, 1.23, 2.6], [-1.45, 0.92, 0.3, 1.13, 2.5], [-1.84, 0.66, 0.32, 0.94, 2.3], [-2.03, 0.5, 0.36, 0.62, 2.0]];
    var stS = resample(st, 110), shellM = c.add(sloft(stS, { seg: 76, crease: 50 }), col);
    var winD = [[-0.36, 1.0], [0.54, 1.0], [0.4, 1.28], [-0.36, 1.355]], winT = [[-0.98, 1.0], [-0.46, 1.0], [-0.46, 1.345], [-0.72, 1.3], [-0.92, 1.18]];
    var holes = [];
    [1, -1].forEach(function (sd) { holes.push(ZG.holeSide(winD, { side: sd, tag: "jd" + sd }), ZG.holeSide(winT, { side: sd, tag: "jt" + sd })); });
    holes.push({ tag: "pb", sel: function (n, ce) { return n.x > 0.3 && ce.y > 0.98; }, sdf: function (x, y, z) { return Math.max(Math.abs(z) - 0.5, 1.02 - y, y - 1.3); } });
    holes.push({ tag: "tr", sel: function (n, ce) { return n.x < -0.3 && ce.y > 1.0; }, sdf: function (x, y, z) { return Math.max(Math.abs(z) - 0.36, 1.1 - y, y - 1.31); } });
    holes.push({ tag: "capo", sel: function (n, ce) { return n.y > 0.3 && ce.x > 0.9 && ce.y > 0.6; }, sdf: function (x, y, z) { var t = clamp((x - 1.17) / 0.5, 0, 1); return Math.max(0.94 - x, x - 1.69, Math.abs(z) - (0.44 - 0.16 * t * t)); } });
    var cut = ZG.cutMesh(shellM, holes, 50); c.deform.push(shellM);
    function glassFrom(geo, label, type) { if (!geo || !geo.attributes.position.count) return null; return ZG.addGlass(c, geo, label, type, { mat: MT.glass }); }
    glassFrom(cut.pb, "Para-brisa", "laminado"); glassFrom(cut.tr, "Vidro traseiro", "laminado");
    [1, -1].forEach(function (sd) { var lb = sd > 0 ? " direita" : " esquerda"; glassFrom(cut["jd" + sd], "Janela dianteira" + lb, "temperado"); glassFrom(cut["jt" + sd], "Vidro lateral traseiro" + lb, "temperado"); });
    /* borracha preta e friso cromado contornando cada janela (esconde o recorte) */
    [1, -1].forEach(function (sd) {
      [winD, winT].forEach(function (poly) {
        var pts = []; for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; for (var k = 0; k < 8; k++) { var t = k / 8; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
        var rub = c.tube(pts.map(function (p) { return [p[0], p[1], sd * (loftHalf(stS, p[0], p[1]) + 0.002)]; }), 0.016, RUBBER, { closed: true, seg: 120, rs: 6 }); rub.castShadow = false; c.deform.push(rub);
        var tb = c.tube(pts.map(function (p) { return [p[0], p[1], sd * (loftHalf(stS, p[0], p[1]) + 0.012)]; }), 0.005, MT.chrome, { closed: true, seg: 120, rs: 4 }); tb.castShadow = false;
      });
    });
    /* para-lamas */
    var rfF = function (a) { return 0.42 + 0.2 * smooth((Math.cos(a) - 0.25) / 0.75); }, rfR = function (a) { return 0.43 + 0.2 * smooth((-Math.cos(a) - 0.2) / 0.8); };
    [1, -1].forEach(function (sd) {
      var ff = c.add(fenderGeo(1.15, 0.333, 0.42, 0.02, 3.0, 0.24, 0.06, sd * 0.645, { rf: rfF, na: 30 }), col); c.deform.push(ff);
      var fr = c.add(fenderGeo(-1.25, 0.333, 0.43, 0.15, 3.12, 0.25, 0.06, sd * 0.645, { rf: rfR, na: 30 }), col); c.deform.push(fr);
      /* estribo */
      c.rb(1.6, 0.04, 0.12, 0.015, RUBBER, -0.05, 0.33, sd * 0.68);
      c.rb(1.6, 0.012, 0.012, 0.004, MT.chrome, -0.05, 0.345, sd * 0.74);
      /* faróis em cápsulas sobre o para-lama, piscas e lanternas "fafá" */
      c.cyl(0.105, 0.095, 0.18, col, 1.47, 0.78, sd * 0.6, "x");
      lamp(c, { style: "round", x: 1.57, y: 0.78, z: sd * 0.6, w: 0.17, h: 0.17, d: 0.06, side: sd });
      c.sph(0.03, MT.amber, 1.32, 0.85, sd * 0.61, 1.8, 0.8, 0.8);
      /* lanterna "fafá" sobre a rampa traseira do para-lama, apontada para trás (antes ficava escondida dentro do para-lama) */
      c.cyl(0.075, 0.068, 0.2, col, -1.77, 0.79, sd * 0.635, "x");
      ZG.taillight(c, { style: "vertical", x: -1.875, y: 0.79, z: sd * 0.635, w: 0.1, h: 0.16, d: 0.05, side: sd });
      /* frisos, maçaneta, retrovisor, dobradiças */
      c.rb(0.008, 0.6, 0.006, 0.003, MT.dark, 0.62, 0.66, sd * 0.665, { rot: [0, 0, 0.1] });
      c.rb(0.008, 0.62, 0.006, 0.003, MT.dark, -0.38, 0.65, sd * 0.665);
      c.rb(0.12, 0.025, 0.03, 0.01, MT.chrome, -0.28, 0.9, sd * 0.675);
      c.rod(new V3(0.42, 0.98, sd * 0.66), new V3(0.4, 1.06, sd * 0.74), 0.008, MT.chrome);
      c.cyl(0.05, 0.05, 0.02, MT.chrome, 0.4, 1.08, sd * 0.75, "x");
      c.rb(1.0, 0.012, 0.008, 0.004, MT.chrome, 0.1, 0.62, sd * 0.668);
    });
    /* rodas com calota cromada */
    [[1.15, 0.6525], [-1.25, 0.644]].forEach(function (w) {
      [1, -1].forEach(function (sd) {
        var g = c.wheel(w[0], sd * w[1], 0.333, 0.142, { rim: col, spokes: 0, rimR: 0.6 });
        var cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 10), MT.chrome); cap.scale.z = 0.3; cap.position.z = sd * 0.075; g.add(cap);
      });
    });
    /* para-choques de lâmina cromada com garras */
    function blade(x0, x1, y, lab, fwd) {
      var pts = [[x0, y, -0.74], [x1 - fwd * 0.02, y, -0.58], [x1, y, 0], [x1 - fwd * 0.02, y, 0.58], [x0, y, 0.74]];
      var t = c.tube(pts, 0.035, MT.chrome, { seg: 40, rs: 10 }); t.scale.y = 1.9; t.position.y = -y * 0.9;
      c.deform.push(t);
      [-0.36, 0.36].forEach(function (z) { c.rod(new V3(x1 - fwd * 0.02, y - 0.06, z), new V3(x1 - fwd * 0.04, y + 0.16, z), 0.02, MT.chrome); c.rod(new V3(x1 - fwd * 0.12, y, z), new V3(x1 - fwd * 0.01, y, z), 0.018, MT.steel); });
      c.part("parachoque", lab, t, new V3(x1, y, 0), 1.1);
      return t;
    }
    m.bumperF = blade(1.7, 1.88, 0.42, "Para-choque dianteiro", 1);
    m.bumperR = blade(-1.92, -2.12, 0.42, "Para-choque traseiro", -1);
    c.plate(1.845, 0.55, 0, "+x"); c.plate(-1.98, 0.62, 0, "-x");
    c.rb(0.06, 0.03, 0.14, 0.01, MT.chrome, -1.96, 0.71, 0);
    /* capô dianteiro (porta-malas): pele recortada articulada perto do para-brisa */
    var hood = ZG.makeHood(c, cut.capo, { x0: 0.95, col: hex, open: 1.15, label: "porta-malas dianteiro com estepe, tanque e macaco (o motor a ar fica atrás)" });
    ZG.emblem(c, 1.76, 0.665, 0, 0.05).rotation.z = -0.5;
    if (hood) c.rb(0.1, 0.03, 0.05, 0.012, MT.chrome, 1.64, 0.735, 0, { parent: hood.piv }).position.set(1.64 - hood.x0, 0.735 - hood.y, 0);
    var bf = 0.42;
    c.rb(0.74, 0.03, 0.76, 0.02, MT.bay, 1.33, bf, 0);
    var spare = c.add(new THREE.TorusGeometry(0.22, 0.065, 10, 24), MT.rubber, 1.42, 0.52, 0); spare.rotation.set(PI / 2 - 0.35, 0, 0); spare.rotation.order = "ZXY"; spare.rotation.z = 0;
    var sr = c.cyl(0.155, 0.155, 0.05, col, 1.42, 0.52, 0); sr.rotation.set(0, 0, -0.35);
    c.rb(0.36, 0.2, 0.62, 0.05, CM("#55595c", { metalness: 0.5, roughness: 0.5 }), 1.12, 0.62, 0);
    c.cyl(0.04, 0.04, 0.05, MT.trim, 1.18, 0.74, 0.22);
    c.rb(0.36, 0.05, 0.08, 0.02, CM("#7a2a1d", { roughness: 0.6 }), 1.24, 0.47, -0.28, { rot: [0, 0.3, 0] });
    c.part("tanque", "Tanque de combustível (na frente)", null, new V3(1.12, 0.6, 0), 0.9);
    /* traseira: tampa do motor com grelhas, motor a ar e escapamento visíveis por baixo */
    var lidC = function (x) { var t = clamp((x + 1.5) / -0.36, 0, 1); return 0.86 + (0.64 - 0.86) * t; };
    /* grelhas da tampa do motor em dois grupos (as lâminas longas atravessavam a curva da tampa e apareciam picotadas) */
    function loftTop(x, z) {
      for (var q = 0; q < stS.length - 1; q++) {
        var A = stS[q], B = stS[q + 1]; if ((A[0] - x) * (B[0] - x) > 0) continue;
        var t = (x - A[0]) / ((B[0] - A[0]) || 1), tp = A[1] + (B[1] - A[1]) * t, bt = A[2] + (B[2] - A[2]) * t, w = (A[3] + (B[3] - A[3]) * t) / 2, pp = (A[4] || 2.4) + ((B[4] || 2.4) - (A[4] || 2.4)) * t;
        var hh = (tp - bt) / 2; return (tp + bt) / 2 + hh * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / w, pp)), 1 / pp);
      }
      return 0;
    }
    for (var i = 0; i < 5; i++) {
      var lx = -1.52 - i * 0.045;
      [-0.1, 0.1].forEach(function (zz) {
        var ly = loftTop(lx, zz), sl = Math.atan2(loftTop(lx + 0.02, zz) - loftTop(lx - 0.02, zz), 0.04);
        c.rb(0.03, 0.012, 0.13, 0.005, MT.dark, lx, ly + 0.002, zz, { rot: [0, 0, sl] });
      });
    }
    c.tube([[-1.18, 1.0, -0.42], [-1.5, 0.87, -0.46], [-1.86, 0.66, -0.4], [-1.9, 0.6, 0], [-1.86, 0.66, 0.4], [-1.5, 0.87, 0.46], [-1.18, 1.0, 0.42]], 0.006, MT.dark, { seg: 60, rs: 4 });
    c.rb(0.04, 0.02, 0.1, 0.008, MT.chrome, -1.89, 0.62, 0);
    c.rb(0.42, 0.18, 0.8, 0.05, CM("#202224", { roughness: 0.6 }), -1.6, 0.42, 0);
    /* motor a ar visível por baixo: cárter, cabeçotes aletados dos dois lados, polia e silencioso transversal */
    c.rb(0.36, 0.16, 0.36, 0.05, ENG, -1.62, 0.34, 0);
    [1, -1].forEach(function (sd) {
      c.rb(0.3, 0.14, 0.12, 0.03, ENG, -1.6, 0.36, sd * 0.3);
      for (var f = 0; f < 5; f++) c.rb(0.012, 0.17, 0.15, 0.004, FIN, -1.72 + f * 0.055, 0.36, sd * 0.3);
    });
    c.cyl(0.07, 0.07, 0.04, EXH, -1.86, 0.44, 0, "x");
    c.cyl(0.06, 0.06, 0.82, EXH, -1.86, 0.31, 0, "z");
    [0.3, -0.3].forEach(function (z) { c.cyl(0.025, 0.025, 0.2, EXH, -1.98, 0.3, z, "x"); });
    c.part("motor", "Motor a ar (traseiro)", null, new V3(-1.6, 0.55, 0), 1.0);
    /* interior simples dos anos 70 */
    var fab = CM("#4b3a2e", { roughness: 0.85 }), fl = 0.36;
    c.rb(1.7, 0.03, 0.62, 0.01, MT.carpet, -0.15, fl, 0).castShadow = false;
    c.rb(0.2, 0.24, 1.14, 0.04, col, 0.66, 0.92, 0);
    c.rb(0.16, 0.05, 1.12, 0.02, CM("#1b1c1e"), 0.6, 1.03, 0);
    c.cyl(0.075, 0.075, 0.02, MT.gauge, 0.555, 0.95, -0.32, "x"); c.cyl(0.08, 0.08, 0.012, MT.chrome, 0.56, 0.95, -0.32, "x", { open: true });
    c.rb(0.02, 0.06, 0.2, 0.01, MT.chrome, 0.56, 0.9, 0.04);
    ZG.steeringWheel(c, 0.38, 0.92, -0.32, { r: 0.2, tilt: 0.55, col: 0.4 });
    c.rod(new V3(0.12, fl, 0), new V3(0.02, fl + 0.42, 0), 0.01, MT.chrome); c.sph(0.025, MT.plastic, 0.02, fl + 0.44, 0);
    [-1, 1].forEach(function (sd) { ZG.seat(c, -0.02, fl, sd * 0.27, { w: 0.44, mat: fab, back: 0.58, lean: 0.2, h: 0.28, headrest: false }); });
    ZG.seat(c, -0.66, fl, 0, { w: 0.94, n: 3, mat: fab, back: 0.44, lean: 0.14, h: 0.26, len: 0.42, headrest: false });
    /* forro das portas em fatias que seguem a curva interna da casca (nunca atravessa a lataria) */
    [1, -1].forEach(function (sd) {
      for (var yk = 0.56; yk < 0.95; yk += 0.075) { var zf = Math.min(loftHalf(stS, -0.3, yk - 0.04), loftHalf(stS, 0.5, yk - 0.04)) - 0.045; c.rb(0.86, 0.078, 0.026, 0.01, fab, 0.1, yk, sd * zf); }
      c.rb(0.07, 0.025, 0.02, 0.008, MT.chrome, -0.25, 0.86, sd * (loftHalf(stS, -0.25, 0.83) - 0.065));
    });
    c.rb(0.03, 0.06, 0.2, 0.02, MT.plastic, 0.54, 1.28, 0);
    [-0.3, 0.18].forEach(function (z) { c.rod(new V3(0.8, 1.02, z), new V3(0.66, 1.2, z - 0.32), 0.009, MT.trim); });
    /* zonas: o capô da frente é o porta-malas (tanque e estepe), a tampa de trás é a do motor a ar; duas portas */
    c.zone("capo", "Capô do porta-malas (frente)");
    c.zone("tampa", "Tampa do motor (traseira)", null, null, { fx: ["Nenhum", "Só estético, barulho de raspagem", "tampa emperra, motor a ar esquenta", "tampa pendurada: motor exposto, zumbi puxa os cabos", "sem tampa: motor a ar exposto a golpes"] });
    c.zone("porta_de", "Porta esquerda", [-0.42, 0.66, 0.18, 1.06, -0.95, -0.42]); c.zone("porta_dd", "Porta direita", [-0.42, 0.66, 0.18, 1.06, 0.42, 0.95]);
    Object.assign(m, { kind: "car", col: hex, L: 4.05, W: 1.54, front: 1.88, rear: -2.12, clear: 0.3, belt: 0.98, top: 1.5, bodyH: 0.68,
      roof: { x0: -0.5, x1: 0.3, w: 0.86, y: 1.5 }, quadF: { b: [0.8, 1.02], t: [0.6, 1.31], n: [0.86, 0.51] } });
    m.armor = function (c, Z) {
      Z.applyArmor(c);
      for (var z = -0.45; z <= 0.46; z += 0.15) c.rod(new V3(0.86, 1.04, z), new V3(0.64, 1.33, z), 0.014, Z.STEELM);
      c.rod(new V3(0.86, 1.04, -0.5), new V3(0.86, 1.04, 0.5), 0.02, Z.STEELM);
      for (var z2 = -0.32; z2 <= 0.33; z2 += 0.16) c.rod(new V3(-0.88, 1.34, z2), new V3(-1.18, 1.11, z2), 0.014, Z.STEELM);
    };
  });
})(window.ZG);
