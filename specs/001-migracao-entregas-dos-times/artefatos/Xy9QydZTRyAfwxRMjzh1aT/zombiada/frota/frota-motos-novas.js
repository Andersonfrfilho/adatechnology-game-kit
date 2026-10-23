/* frota-motos-novas.js: motos novas da v4 (grupo F). Só usa a API de window.ZG (veja API.md).
   Bis 125, Fazê 250, Ninjá 400, Fat Boi 114 e Titã 160 Cargo.
   As peças comuns de moto (loft de superelipse, garfo, guidão, piscas, placa) são cópias locais das de frota-motos-carros.js,
   porque lá elas ficam dentro do fechamento do arquivo. Funções locais novas: fatWheel (roda de disco fechado com pneu largo),
   moreSpokes (raios extras numa roda de liga do núcleo), drumHub (cubo de freio a tambor), grab (peças criadas num trecho). */
(function (ZG) {
  "use strict";
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM, G = ZG.geo;

  /* ================= materiais locais ================= */
  var RUBBER = CM("#131313", { roughness: 0.9 });
  var ENG = CM("#9a9ea2", { metalness: 0.65, roughness: 0.38 });
  var ENGD = CM("#2c2e31", { metalness: 0.45, roughness: 0.5 });
  var FIN = CM("#7c8084", { metalness: 0.6, roughness: 0.45 });
  var EXH = CM("#b5b9bc", { metalness: 0.9, roughness: 0.25 });
  var HEAT = CM("#2a2b2d", { metalness: 0.5, roughness: 0.45 });
  var BLK = CM("#151618", { roughness: 0.55 });
  var SATIN = CM("#3b3e42", { roughness: 0.5, metalness: 0.3 });
  var SEAT = CM("#1b1c1e", { roughness: 0.8 });
  var DRL = CM("#f2f7ff", { emissive: "#d6e8ff", emissiveIntensity: 1.7, roughness: 0.2 });
  var REDLED = CM("#e2301f", { emissive: "#e8200f", emissiveIntensity: 1.35, roughness: 0.25 });
  var SMOKEG = CM("#2a3036", { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });

  /* ================= geometria local (cópia de frota-motos-carros.js) ================= */
  /* loft de superelipse. eixo x: estações [x, topo, base, largura, p, zc]; eixo y: [y, xFrente, xTras, largura, p, zc] */
  function sloft(st, o) {
    o = o || {};
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
    return G.crease(g.toNonIndexed(), o.crease || 60);
  }
  function body(c, st, mat, o) {
    o = o || {};
    var m = c.add(sloft(st, o), mat, 0, 0, 0, o.parent);
    if (o.def !== false) c.deform.push(m);
    return m;
  }
  /* meia largura do loft (eixo x) na posição x e altura y: para colar textos e frisos na lateral */
  function loftHalf(st, x, y) {
    for (var i = 0; i < st.length - 1; i++) {
      var a = st[i], b = st[i + 1]; if ((a[0] - x) * (b[0] - x) > 0) continue;
      var t = (x - a[0]) / ((b[0] - a[0]) || 1), top = a[1] + (b[1] - a[1]) * t, bot = a[2] + (b[2] - a[2]) * t, w = a[3] + (b[3] - a[3]) * t, pp = (a[4] || 2.4) + ((b[4] || 2.4) - (a[4] || 2.4)) * t;
      var h = (y - (top + bot) / 2) / ((top - bot) / 2); if (Math.abs(h) >= 1) return 0;
      return w / 2 * Math.pow(1 - Math.pow(Math.abs(h), pp), 1 / pp);
    }
    return 0;
  }
  /* meia largura de um loft no eixo y na altura y e posição x (estações [y, xFrente, xTras, largura, p]) */
  function yHalf(st, y, x) {
    for (var i = 0; i < st.length - 1; i++) {
      var a = st[i], b = st[i + 1]; if ((a[0] - y) * (b[0] - y) > 0) continue;
      var t = (y - a[0]) / ((b[0] - a[0]) || 1), f = a[1] + (b[1] - a[1]) * t, r = a[2] + (b[2] - a[2]) * t, w = a[3] + (b[3] - a[3]) * t, pp = (a[4] || 2.4) + ((b[4] || 2.4) - (a[4] || 2.4)) * t;
      var h = (x - (f + r) / 2) / (Math.abs(f - r) / 2); if (Math.abs(h) >= 1) return 0;
      return w / 2 * Math.pow(1 - Math.pow(Math.abs(h), pp), 1 / pp);
    }
    return 0;
  }
  /* arco de para-lama sobre a roda. cx, cy centro; r raio interno; a0..a1 ângulos (0 = frente); w largura; t bossa */
  function fenderGeo(cx, cy, r, a0, a1, w, t, zc, o) {
    o = o || {};
    var na = o.na || 22, nu = 10, pos = [], idx = [];
    for (var i = 0; i <= na; i++) {
      var a = a0 + (a1 - a0) * i / na, ca = Math.cos(a), sa = Math.sin(a);
      for (var j = 0; j <= nu; j++) {
        var u = j / nu * 2 - 1, bulge = t * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), o.p || 3)), 1 / (o.p || 3)), rr = r + bulge - (o.drop ? o.drop * Math.pow(Math.abs(u), 4) : 0);
        pos.push(cx + ca * rr, cy + sa * rr, zc + u * w / 2);
      }
    }
    for (var i2 = 0; i2 < na; i2++) for (var j2 = 0; j2 < nu; j2++) { var A = i2 * (nu + 1) + j2, B = A + nu + 1; idx.push(A, B, A + 1, A + 1, B, B + 1); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    return G.crease(g.toNonIndexed(), 70);
  }
  function fender(c, cx, cy, r, a0, a1, w, t, mat, o) { var f = c.add(fenderGeo(cx, cy, r, a0, a1, w, t, 0, o), mat, 0, 0, 0); c.deform.push(f); return f; }
  function lamp(c, o) { var L = ZG.headlight(c, o); if (o.roll) L.g.rotation.x = o.roll; if (o.pitch) L.g.rotation.z = o.pitch; return L; }
  function drlOn(L, w, h, y, d, z) { var m = new THREE.Mesh(G.rbox(0.01, h, w, Math.min(0.005, h * 0.4)), DRL); m.position.set((d || 0.06) / 2 + 0.004, y || 0, z || 0); m.castShadow = false; L.g.add(m); L.inner.push(m); return m; }
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
        var mz = s * (half - 0.14), stalk = new V3(x - back + 0.02, y + rise + (o.stalk || 0.2), mz + s * (o.mOut || 0.06));
        c.rod(new V3(x - back + 0.01, y + rise + 0.02, mz), stalk, 0.006, MT.trim, { seg: 6 });
        c.rb(0.03, o.mH || 0.07, o.mW || 0.12, 0.025, MT.trim, stalk.x, stalk.y + 0.02, stalk.z + s * 0.02, { def: true });
        c.rb(0.006, (o.mH || 0.07) - 0.015, (o.mW || 0.12) - 0.02, 0.01, MT.chrome, stalk.x - 0.017, stalk.y + 0.02, stalk.z + s * 0.02);
      }
      if (o.guards) c.deform.push(c.tube([[x - back + 0.02, y + rise, s * (half - 0.2)], [x + 0.08, y + rise + 0.01, s * (half - 0.08)], [x - back + 0.02, y + rise - 0.01, s * (half + 0.01)]], 0.02, o.guards, { seg: 16 }));
    });
    return c.g.children.slice(n0);
  }
  function blinker(c, x, y, z, front, o) {
    o = o || {};
    if (o.flush) { var f = c.rb(0.03, 0.025, 0.05, 0.01, MT.amber, x, y, z, { rot: [0, 0, 0] }); f.castShadow = false; return f; }
    c.rod(new V3(x, y, z * 0.55), new V3(x, y, z), 0.008, MT.trim, { seg: 6 });
    var b = c.sph(o.r || 0.026, MT.amber, x + (front ? 0.012 : -0.012), y, z, 1.5, 0.9, 0.9); b.castShadow = false; return b;
  }
  function plateMoto(c, x, y, txt) {
    c.rb(0.02, 0.15, 0.2, 0.008, MT.trim, x + 0.012, y, 0);
    c.text(txt || "ZMB4D", 0.2, 0.135, x, y, 0, "-x", { w: 300, h: 220, bg: "#f2f2ee", band: "#1f4fa3", fg: "#151515", size: 0.42, font: "'IBM Plex Mono', monospace" });
  }
  /* motor monocilíndrico arrefecido a ar (cárter, tampas laterais, cilindro aletado inclinado, cabeçote) */
  function singleEngine(c, o) {
    var x = o.x, y = o.y, tilt = o.tilt || 0.3, fin = o.fin || FIN, k = o.k || 1, eng = o.mat || ENG, n = o.fins || 7;
    c.rb(0.38 * k, 0.26 * k, 0.24, 0.07, eng, x - 0.02, y, 0, { def: true });
    c.sph(0.11 * k, eng, x - 0.04, y - 0.01, 0.12, 1.1, 1.0, 0.36);
    c.sph(0.1 * k, o.cover || ENGD, x - 0.08, y, -0.12, 1.0, 1.0, 0.36);
    var cx = x + 0.1 * k, cy = y + 0.13 * k, len = 0.22 * k;
    for (var f = 0; f < n; f++) {
      var t = f / (n - 1), px = cx + Math.sin(tilt) * t * len, py = cy + Math.cos(tilt) * t * len;
      c.rb((0.2 - t * 0.02) * k, 0.014, (0.22 - t * 0.02), 0.006, fin, px, py, 0, { rot: [0, 0, -tilt] });
    }
    c.rb(0.12 * k, 0.2 * k, 0.12, 0.03, eng, cx + Math.sin(tilt) * len / 2, cy + Math.cos(tilt) * len / 2, 0, { rot: [0, 0, -tilt] });
    c.rb(0.16 * k, 0.06, 0.18, 0.025, eng, cx + Math.sin(tilt) * (len + 0.04), cy + Math.cos(tilt) * (len + 0.04), 0, { rot: [0, 0, -tilt] });
    return { exh: new V3(cx + Math.sin(tilt) * len * 0.9 + 0.06, cy + Math.cos(tilt) * len * 0.45, 0.06) };
  }
  function bendSet(list, piv, axis, ang) {
    var q = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), ang);
    list.forEach(function (m) { if (!m.parent) return; m.position.sub(piv).applyQuaternion(q).add(piv); m.quaternion.premultiply(q); });
  }
  function jerryFlat(c, x, y, z, col) {
    c.rb(0.4, 0.15, 0.28, 0.04, CM(col, { roughness: 0.5 }), x, y, z, { def: true });
    c.cyl(0.022, 0.022, 0.05, MT.trim, x + 0.18, y + 0.06, z + 0.1);
    [-0.1, 0.1].forEach(function (dx) { c.rb(0.03, 0.155, 0.29, 0.005, CM("#1b1c1e"), x + dx, y + 0.002, z); });
  }
  function roofLamp(c, x, y, z) { c.cyl(0.07, 0.055, 0.1, MT.steel, x, y, z, "x"); c.cyl(0.06, 0.06, 0.012, MT.head, x + 0.055, y, z, "x"); }
  function bikeMeta(c, o) { Object.assign(c.meta, { kind: "bike", clear: 0.25, bodyH: 0.6, belt: 0.88 }, o); }
  /* malhas criadas desde a marca n0 (sem rodas, faróis, lanternas nem vidros, que já têm zona própria) */
  function grab(c, n0) {
    var Ls = new Set(); (c.lights || []).forEach(function (L) { if (L.g) Ls.add(L.g); });
    return c.g.children.slice(n0).filter(function (o) { return c.wheels.indexOf(o) < 0 && !Ls.has(o) && !o.userData.glass; });
  }
  /* raios extras numa roda de liga do núcleo (spokedWheel cast tem 5): n raios a partir do ângulo a0 */
  function moreSpokes(g, n, a0, mat, thick) {
    var r = g.userData.r, tire = g.children[0].geometry.parameters.tube, sl = r - tire * 2;
    for (var j = 0; j < n; j++) { var a = a0 + j / n * PI * 2, sp = new THREE.Mesh(G.rbox(sl, thick || 0.022, 0.022, 0.008), mat || MT.trim); sp.position.set(Math.cos(a) * sl / 2, Math.sin(a) * sl / 2, 0); sp.rotation.z = a; g.add(sp); }
  }
  /* cubo de freio a tambor (moto de trabalho) */
  function drumHub(g, r, side) { var d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 20), ENG); d.rotation.x = PI / 2; d.position.z = (side || 1) * 0.02; g.add(d); var lev = new THREE.Mesh(G.rbox(0.09, 0.015, 0.01, 0.004), BLK); lev.position.set(-r * 0.6, r * 0.6, (side || 1) * 0.06); lev.rotation.z = 0.7; g.add(lev); }

  /* roda de disco fechado (Lakester) com pneu largo de perfil baixo, feita por torno. Registra como roda do núcleo. */
  function fatWheel(c, x, r, w, rimR, o) {
    o = o || {};
    var g = new THREE.Group(); g.position.set(x, r, 0); c.g.add(g);
    var hw = w / 2, rr = Math.min(0.045, (r - rimR) * 0.55), P = [];
    P.push(new THREE.Vector2(rimR, -hw * 0.86));
    for (var i = 0; i <= 8; i++) { var a = -PI / 2 + i / 8 * PI / 2; P.push(new THREE.Vector2(r - rr + Math.cos(a) * rr, -hw + rr + Math.sin(a) * rr)); }
    for (var j = 0; j <= 8; j++) { var b = j / 8 * PI / 2; P.push(new THREE.Vector2(r - rr + Math.cos(b) * rr, hw - rr + Math.sin(b) * rr)); }
    P.push(new THREE.Vector2(rimR, hw * 0.86));
    var tg = new THREE.LatheGeometry(P, 48); tg.rotateX(PI / 2);
    var tire = new THREE.Mesh(tg, MT.rubber); tire.castShadow = true; g.add(tire);
    /* banda de rodagem: sulcos rasos */
    var gr = []; for (var k = 0; k < 40; k++) { var aa = k / 40 * PI * 2, gg = G.rbox(0.006, 0.012, w * 0.6, 0.002); gg.applyMatrix4(new THREE.Matrix4().makeRotationZ(aa).setPosition(Math.cos(aa) * (r - 0.0035), Math.sin(aa) * (r - 0.0035), 0)); gr.push(gg); }
    tire.add(new THREE.Mesh(G.merge(gr), CM("#0b0b0b", { roughness: 1 })));  /* filho do pneu: some junto quando o pneu é arrancado */
    /* aro e disco fechado levemente côncavo, com o padrão de fendas rasas e o cubo */
    var rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.014, 8, 48), MT.chrome); g.add(rim);
    var rim2 = rim.clone(); g.add(rim2); rim.position.z = hw * 0.82; rim2.position.z = -hw * 0.82;
    var discMat = o.disc || CM("#c3c7ca", { metalness: 0.55, roughness: 0.32 });
    [1, -1].forEach(function (s) {
      var dg = new THREE.CylinderGeometry(rimR, rimR * 0.4, 0.02, 40); dg.rotateX(s * PI / 2);
      var d = new THREE.Mesh(dg, discMat); d.position.z = s * hw * 0.72; g.add(d);
      for (var q = 0; q < 12; q++) {
        var a2 = q / 12 * PI * 2, sl = new THREE.Mesh(G.rbox(rimR * 0.42, 0.016, 0.006, 0.005), o.slot || CM("#1c1e21", { metalness: 0.5, roughness: 0.4 }));
        sl.position.set(Math.cos(a2) * rimR * 0.62, Math.sin(a2) * rimR * 0.62, s * (hw * 0.72 + 0.006)); sl.rotation.z = a2; g.add(sl);
      }
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), CM("#202225", { metalness: 0.5, roughness: 0.4 })); hub.rotation.x = PI / 2; hub.position.z = s * (hw * 0.72 + 0.012); g.add(hub);
    });
    if (o.disc2) { var dsk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.008, 28), MT.steel); dsk.rotation.x = PI / 2; dsk.position.z = -(hw * 0.72 + 0.03); g.add(dsk); }
    g.userData.r = r; c.wheels.push(g);
    c.part("roda", o.label || (x > 0 ? "Pneu dianteiro" : "Pneu traseiro"), g, new V3(x, r, 0), 0.9);
    return g;
  }

  /* zonas: as automáticas de moto já existem; aqui só entregamos as peças certas a cada uma */
  function zoneParts(c, map) {
    Object.keys(map).forEach(function (id) { if (map[id] && map[id].length) c.zone(id, null, null, map[id]); });
    c.zone("lanterna_c", "Lanterna");  /* o automático chama a lanterna central de "Barra de lanterna", que não cabe numa moto */
  }

  /* ================= Bis 125 (Honda Biz 125) ================= */
  /* Referência: Honda Biz 125 2018+ (ficha Honda, via motoragora.com.br, conferida em 2026)
     Medidas reais: comprimento 1,894 · largura 0,714 · altura 1,085 · entre-eixos 1,264 · altura do banco 0,753 · vão livre 0,131
       · pneus 60/100-17 (Ø 0,552) e 80/100-14 (Ø 0,516) · balanços ≈ 0,30 / 0,33 (de memória) · bitola: uma trilha só.
     Traços de assinatura:
       frente: farol trapezoidal largo no alto do escudo frontal (não no guidão), piscas embutidos nas pontas do escudo;
         guidão com capa plástica e painel no meio.
       lateral: quadro "underbone" sem tanque entre as pernas (passagem baixa para os pés); escudo de pernas largo;
         motor deitado sob o assoalho com o cilindro apontando para a frente; roda dianteira aro 17 e traseira menor, aro 14;
         carenagem traseira alta e longa sob o banco (porta-objetos); escapamento baixo à direita com protetor.
       traseira: lanterna horizontal na ponta da carenagem, alça de garupa, placa baixa no para-lama.
       de cima: escudo largo na frente, cintura fina na passagem dos pés, banco largo atrás. */
  ZG.register({ k: "bis", grp: "Motos", n: "Bis 125", insp: "Honda Biz 125", art: "na", c: "Cub 125 cc (motoneta)", fuel: "flex",
    d: "A motoneta de passagem baixa: sobe-se nela de saia, cabe capacete sob o banco e roda quase 50 km com um litro. Rodas pequenas e pouca proteção na horda.",
    mass: 104, r: 55, seats: "2", cap: "5,1 L", eff: "50 km/L (G) · 35 km/L (E)", auto: "255 km", vmax: 95, skill: "Pilotagem 1", hood: false
  }, function (c) {
    var hex = "#b3151b", col = c.paint(hex), wht = c.paint("#ecebe6"), blk = BLK;
    var XF = 0.632, XR = -0.632, RF = 0.276, RR = 0.258;
    var fw = ZG.spokedWheel(c, XF, RF, 0.03, { cast: true, disc: true, label: "Pneu dianteiro" });
    var rw = ZG.spokedWheel(c, XR, RR, 0.04, { cast: true, label: "Pneu traseiro" });
    drumHub(rw, 0.07, -1);
    var Z = { carenagem: [], guidao: [], tanque_moto: [], banco: [], motor: [], escapamento: [] }, n0;
    /* motor deitado sob o assoalho: cárter, cilindro aletado apontado para a frente, tampa do variador à esquerda */
    n0 = c.g.children.length;
    c.rb(0.3, 0.2, 0.24, 0.06, ENG, -0.06, 0.29, 0, { def: true });
    c.sph(0.09, ENGD, -0.08, 0.29, -0.12, 1.1, 1.0, 0.4);
    c.sph(0.08, ENG, -0.04, 0.29, 0.12, 1.0, 1.0, 0.36);
    for (var f = 0; f < 6; f++) c.rb(0.014, 0.15 - f * 0.006, 0.17 - f * 0.006, 0.005, FIN, 0.12 + f * 0.028, 0.29 + f * 0.008, 0, { rot: [0, 0, -0.12] });
    c.rb(0.2, 0.1, 0.11, 0.03, ENG, 0.17, 0.3, 0, { rot: [0, 0, -0.12] });
    c.rb(0.07, 0.12, 0.13, 0.025, ENG, 0.29, 0.33, 0, { rot: [0, 0, -0.12] });
    c.rb(0.16, 0.035, 0.03, 0.01, BLK, 0.0, 0.17, -0.14);
    Z.motor = grab(c, n0);
    /* quadro "underbone": espinha que desce do pescoço até o motor e sobe para o banco */
    c.tube([[0.43, 0.88, 0], [0.33, 0.62, 0], [0.22, 0.42, 0], [0.0, 0.38, 0], [-0.22, 0.48, 0], [-0.5, 0.64, 0], [-0.86, 0.68, 0]], 0.022, blk, { seg: 40 });
    c.cyl(0.03, 0.03, 0.14, blk, 0.44, 0.88, 0).rotation.z = -0.3;
    /* garfo e para-lama dianteiro pintado */
    fork(c, [0.45, 0.86], [XF, RF], 0.07, 0.017, MT.chrome, SATIN, { split: 0.45 });
    var fendF = fender(c, XF, RF, RF + 0.025, 0.12, 2.15, 0.1, 0.018, col);
    /* escudo frontal (com o farol no alto) e escudo de pernas atrás dele */
    n0 = c.g.children.length;
    var SH = [[0.34, 0.43, 0.31, 0.3, 2.6], [0.44, 0.47, 0.33, 0.48, 3], [0.58, 0.5, 0.36, 0.52, 3], [0.72, 0.53, 0.39, 0.48, 2.8], [0.86, 0.565, 0.42, 0.42, 2.6], [0.95, 0.56, 0.43, 0.32, 2.4], [1.0, 0.53, 0.44, 0.18, 2.2]];
    body(c, SH, col, { axis: "y" });
    body(c, [[0.34, 0.36, 0.29, 0.28, 2.6], [0.46, 0.38, 0.31, 0.46, 3], [0.6, 0.41, 0.34, 0.5, 3], [0.74, 0.43, 0.37, 0.46, 2.8], [0.88, 0.45, 0.39, 0.38, 2.6], [0.96, 0.45, 0.41, 0.24, 2.2]], blk, { axis: "y" });
    /* moldura preta do farol e friso central do escudo */
    body(c, [[0.83, 0.57, 0.5, 0.3, 3], [0.94, 0.565, 0.5, 0.3, 3]], blk, { axis: "y", def: false });
    c.rb(0.02, 0.3, 0.05, 0.01, wht, 0.52, 0.6, 0, { rot: [0, 0, 0.25] });
    [1, -1].forEach(function (s) { blinker(c, 0.53, 0.86, s * 0.185, true, { flush: true }); });
    Z.carenagem = grab(c, n0).concat([fendF]);
    var HL = lamp(c, { style: "wedge", x: 0.565, y: 0.885, z: 0, w: 0.24, h: 0.085, d: 0.06, side: 1, label: "Farol", pitch: -0.1 });
    drlOn(HL, 0.2, 0.01, 0.034, 0.06);
    /* túnel central baixo (passagem dos pés) */
    body(c, [[0.36, 0.47, 0.33, 0.12, 2.4], [0.2, 0.45, 0.33, 0.16, 2.4], [0.02, 0.47, 0.33, 0.2, 2.4], [-0.12, 0.54, 0.36, 0.26, 2.4]], col);
    /* carenagem traseira longa com o porta-objetos (o tanque fica sob o banco) */
    n0 = c.g.children.length;
    var RB = [[-0.04, 0.66, 0.46, 0.16, 2.2], [-0.1, 0.7, 0.42, 0.26, 2.4], [-0.18, 0.73, 0.4, 0.31, 2.6], [-0.42, 0.74, 0.44, 0.32, 2.6], [-0.66, 0.74, 0.52, 0.27, 2.6], [-0.84, 0.735, 0.58, 0.18, 2.4], [-0.94, 0.72, 0.62, 0.08, 2.2]];
    body(c, RB, col);
    [1, -1].forEach(function (s) {
      var x = -0.3, y = 0.6, hz = loftHalf(RB, x, y) + 0.004;
      c.text("BIS 125", 0.2, 0.05, x, y, s * hz, s > 0 ? "+z" : "-z", { fg: "#f2f0ea", size: 0.85 });
      body(c, [[-0.1, 0.52, 0.44, 0.02, 2, s * 0.12], [-0.3, 0.5, 0.45, 0.03, 2, s * 0.16], [-0.6, 0.56, 0.52, 0.02, 2, s * 0.13]], wht, { p: 2 });
    });
    Z.tanque_moto = grab(c, n0);
    n0 = c.g.children.length;
    body(c, [[0.0, 0.755, 0.705, 0.18], [-0.12, 0.76, 0.71, 0.28], [-0.45, 0.765, 0.715, 0.3], [-0.66, 0.77, 0.72, 0.24], [-0.73, 0.765, 0.725, 0.12]], SEAT, { p: 3 });
    c.tube([[-0.58, 0.775, -0.14], [-0.86, 0.77, -0.1], [-0.92, 0.765, 0], [-0.86, 0.77, 0.1], [-0.58, 0.775, 0.14]], 0.014, BLK, { seg: 24 });
    /* rabeta: para-lama traseiro com a placa */
    body(c, [[-0.82, 0.62, 0.55, 0.14], [-0.92, 0.58, 0.47, 0.13], [-0.96, 0.53, 0.42, 0.1]], blk);
    plateMoto(c, -0.962, 0.47);
    [1, -1].forEach(function (s) { c.rb(0.03, 0.025, 0.04, 0.01, MT.amber, -0.935, 0.675, s * 0.1); });
    Z.banco = grab(c, n0);
    ZG.taillight(c, { style: "bar", x: -0.94, y: 0.68, z: 0, w: 0.13, h: 0.05, d: 0.05, side: 1, label: "Lanterna" });
    /* balança, protetor de corrente, amortecedores, pedaleiras, cavalete */
    [1, -1].forEach(function (s) {
      c.rod(new V3(-0.12, 0.3, s * 0.08), new V3(XR, RR, s * 0.08), 0.02, blk);
      c.rod(new V3(XR + 0.06, RR + 0.03, s * 0.11), new V3(-0.5, 0.64, s * 0.12), 0.013, MT.chrome);
      c.rod(new V3(XR + 0.08, RR + 0.07, s * 0.11), new V3(-0.52, 0.56, s * 0.12), 0.024, CM("#2a2b2e", { roughness: 0.5 }));
      c.rb(0.11, 0.02, 0.05, 0.01, RUBBER, 0.08, 0.24, s * 0.17);
      c.rb(0.08, 0.02, 0.04, 0.01, RUBBER, -0.35, 0.32, s * 0.15);
    });
    c.rb(0.5, 0.07, 0.03, 0.02, blk, -0.36, 0.28, -0.11, { rot: [0, 0, 0.05] });
    c.rod(new V3(-0.05, 0.22, -0.12), new V3(-0.14, 0.04, -0.22), 0.011, blk);
    /* cavalete central recolhido (o ponto mais baixo) */
    c.rb(0.16, 0.02, 0.2, 0.008, blk, -0.08, 0.142, 0); [1, -1].forEach(function (s) { c.rod(new V3(-0.02, 0.2, s * 0.1), new V3(-0.12, 0.145, s * 0.1), 0.01, blk); });
    /* escapamento baixo à direita, com protetor */
    n0 = c.g.children.length;
    c.tube([[0.3, 0.3, 0.04], [0.32, 0.2, 0.08], [0.1, 0.15, 0.12], [-0.25, 0.2, 0.15], [-0.36, 0.26, 0.15]], 0.017, EXH, { seg: 30 });
    c.cyl(0.05, 0.04, 0.38, EXH, -0.56, 0.3, 0.15).rotation.z = -PI / 2 + 0.12;
    c.rb(0.28, 0.07, 0.025, 0.025, HEAT, -0.52, 0.31, 0.2, { rot: [0, 0, 0.12] });
    Z.escapamento = grab(c, n0);
    /* capa do guidão com o painel; guidão de manopla curta; retrovisores */
    n0 = c.g.children.length;
    body(c, [[0.32, 1.035, 0.97, 0.16, 2.4], [0.38, 1.065, 0.95, 0.46, 2.6], [0.49, 1.055, 0.95, 0.46, 2.6], [0.55, 1.02, 0.96, 0.2, 2.2]], col);
    c.rb(0.12, 0.012, 0.18, 0.01, CM("#121518", { roughness: 0.25, metalness: 0.3 }), 0.41, 1.066, 0, { rot: [0, 0, 0.25] });
    c.rb(0.06, 0.014, 0.08, 0.006, MT.gauge, 0.41, 1.07, 0, { rot: [0, 0, 0.25] });
    handlebar(c, 0.44, 1.0, 0.345, { rise: 0.01, back: 0.05, stalk: 0.16 });
    Z.guidao = grab(c, n0);
    zoneParts(c, Z);
    c.part("motor", "Motor (sob o assoalho)", null, new V3(0.0, 0.3, 0), 0.7); c.part("tanque", "Tanque (sob o banco)", null, new V3(-0.4, 0.62, 0), 0.6);
    c.part("carenagem", "Escudo frontal", null, new V3(0.5, 0.7, 0), 0.6);
    bikeMeta(c, { L: 1.9, W: 0.72, front: 0.935, rear: -0.97, clear: 0.13, bodyH: 0.6, top: 1.085, belt: 0.74, col: hex, rack: 0.78, exhaust: new V3(-0.76, 0.32, 0.15) });
    /* modificado: mata-cachorro tubular, cesta de arame na frente, caixote com galão na alça de garupa */
    c.meta.armor = function (c, Zg) {
      [1, -1].forEach(function (s) { c.tube([[0.36, 0.84, s * 0.14], [0.52, 0.62, s * 0.3], [0.44, 0.3, s * 0.3], [0.2, 0.24, s * 0.2]], 0.017, Zg.STEELM, { seg: 20 }); });
      c.rb(0.24, 0.16, 0.3, 0.02, CM("#3c3a34", { metalness: 0.4 }), 0.62, 1.0, 0, { def: true });
      for (var i = 0; i < 5; i++) c.rod(new V3(0.5 + i * 0.06, 0.92, -0.15), new V3(0.5 + i * 0.06, 0.92, 0.15), 0.004, MT.steel);
      c.rb(0.36, 0.22, 0.3, 0.02, MT.wood, -0.75, 0.9, 0, { def: true });
      ZG.jerry(c, -0.75, 0.95, 0.0, "#8e2a20");
      c.rod(new V3(0.32, 0.96, -0.3), new V3(0.7, 1.4, -0.3), 0.008, MT.trim);
    };
  });

  /* ================= Fazê 250 (Yamaha FZ25 Fazer 250) ================= */
  /* Referência: Yamaha FZ25 Fazer 250 2018+ (ficha Yamaha, via magodoscarros.com.br, conferida em 2026)
     Medidas reais: comprimento 2,040 · largura 0,760 · altura 1,070 (sem retrovisor) · entre-eixos 1,370 · altura do banco 0,790
       · vão livre 0,160 · pneus 100/80-17 (Ø 0,592) e 140/70-17 (Ø 0,628) · balanços ≈ 0,35 / 0,32 (de memória).
     Traços de assinatura:
       frente: farol de LED bi-partido numa carenagem curta e angulosa, com o filete de posição em cima; viseira fumê;
         piscas em hastes; para-lama dianteiro curto pintado; guidão tubular largo.
       lateral: tanque musculoso com aletas angulares grandes que descem à frente e cobrem o radiador de óleo;
         motor monocilíndrico prata e preto arrefecido a ar; escapamento curto e gordo com protetor subindo para trás;
         banco em dois níveis; balança em caixa; rodas de liga de 10 raios finos; monoamortecedor.
       traseira: rabeta alta e pontuda com lanterna de LED, alças de garupa separadas, suporte de placa longo com os piscas.
       de cima: tanque largo na altura dos joelhos afinando no banco; guidão reto e largo. */
  ZG.register({ k: "faze", grp: "Motos", n: "Fazê 250", insp: "Yamaha FZ25 Fazer 250", art: "na", c: "Naked 250 cc", fuel: "flex",
    d: "Naked de 250 cc com farol de LED e tanque musculoso. Mais fôlego que as 160 para fugir na estrada, sem perder o jeito de moto de cidade.",
    mass: 153, r: 75, seats: "2", cap: "14 L", eff: "30 km/L (G) · 21 km/L (E)", auto: "420 km", vmax: 135, skill: "Pilotagem 1", hood: false
  }, function (c) {
    var hex = "#1d3f8f", col = c.paint(hex), dark = c.paint("#2a2d33"), blk = BLK;
    var XF = 0.685, XR = -0.685, RF = 0.296, RR = 0.314;
    var fw = ZG.spokedWheel(c, XF, RF, 0.05, { cast: true, disc: true, label: "Pneu dianteiro" });
    var rw = ZG.spokedWheel(c, XR, RR, 0.068, { cast: true, label: "Pneu traseiro" });
    [fw, rw].forEach(function (g) { moreSpokes(g, 5, 0.18); });
    var dsk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.008, 24), MT.steel); dsk.rotation.x = PI / 2; dsk.position.z = -0.07; rw.add(dsk);
    var Z = { carenagem: [], guidao: [], tanque_moto: [], banco: [], motor: [], escapamento: [] }, n0;
    /* quadro diamante preto */
    c.tube([[0.38, 0.98, 0], [0.27, 0.7, 0], [0.16, 0.36, 0]], 0.022, blk, { seg: 20 });
    c.tube([[0.38, 0.98, 0], [0.12, 0.86, 0], [-0.14, 0.76, 0], [-0.2, 0.52, 0], [-0.16, 0.36, 0]], 0.022, blk, { seg: 40 });
    c.tube([[-0.14, 0.76, 0], [-0.5, 0.8, 0], [-0.9, 0.86, 0]], 0.018, blk, { seg: 20 });
    c.cyl(0.035, 0.035, 0.17, blk, 0.39, 0.96, 0).rotation.z = -0.42;
    n0 = c.g.children.length;
    var eng = singleEngine(c, { x: 0.08, y: 0.44, tilt: 0.26, k: 1.08, cover: CM("#202226", { metalness: 0.4, roughness: 0.45 }) });
    c.rb(0.04, 0.16, 0.24, 0.012, CM("#1d1f22", { metalness: 0.4, roughness: 0.5 }), 0.36, 0.62, 0, { rot: [0, 0, -0.35] });
    c.rb(0.4, 0.035, 0.24, 0.015, CM("#22242a", { roughness: 0.6 }), 0.1, 0.25, 0, { rot: [0, 0, 0.1] });
    Z.motor = grab(c, n0);
    /* tanque musculoso e aletas angulares (que descem à frente cobrindo o radiador de óleo) */
    n0 = c.g.children.length;
    var TK = [[0.42, 0.98, 0.82, 0.18, 2.2], [0.32, 1.035, 0.77, 0.36, 2.4], [0.14, 1.03, 0.75, 0.39, 2.4], [0.0, 0.97, 0.76, 0.32, 2.4], [-0.08, 0.91, 0.79, 0.2, 2.2]];
    body(c, TK, col);
    [1, -1].forEach(function (s) {
      body(c, [[0.58, 0.66, 0.6, 0.02, 3, s * 0.14], [0.5, 0.9, 0.56, 0.04, 3.4, s * 0.19], [0.36, 1.0, 0.6, 0.05, 3.4, s * 0.215], [0.2, 0.99, 0.68, 0.05, 3.2, s * 0.21], [0.08, 0.92, 0.8, 0.02, 2.4, s * 0.17]], dark, { p: 3 });
      body(c, [[0.54, 0.7, 0.66, 0.015, 3, s * 0.165], [0.44, 0.88, 0.7, 0.025, 3, s * 0.225], [0.3, 0.96, 0.84, 0.025, 3, s * 0.24], [0.2, 0.98, 0.9, 0.015, 3, s * 0.235]], col, { p: 3 });
      c.text("FAZÊ", 0.16, 0.05, 0.22, 0.93, s * 0.205, s > 0 ? "+z" : "-z", { fg: "#e9ecf2", size: 0.85 });
    });
    c.cyl(0.035, 0.035, 0.012, MT.chrome, 0.24, 1.035, 0);
    Z.tanque_moto = grab(c, n0);
    /* banco em dois níveis, rabeta alta e pontuda, alças separadas, suporte de placa longo */
    n0 = c.g.children.length;
    body(c, [[0.0, 0.83, 0.77, 0.2], [-0.12, 0.8, 0.75, 0.3], [-0.38, 0.8, 0.75, 0.27], [-0.46, 0.84, 0.78, 0.2]], SEAT, { p: 3 });
    body(c, [[-0.47, 0.885, 0.82, 0.2], [-0.62, 0.895, 0.83, 0.19], [-0.76, 0.9, 0.84, 0.14], [-0.82, 0.895, 0.85, 0.06]], SEAT, { p: 3 });
    var TL = [[-0.1, 0.78, 0.6, 0.24, 2.6], [-0.45, 0.83, 0.66, 0.25, 2.6], [-0.8, 0.88, 0.77, 0.17, 2.4], [-0.98, 0.905, 0.85, 0.06, 2.2]];
    body(c, TL, dark);
    [1, -1].forEach(function (s) {
      body(c, [[-0.2, 0.8, 0.7, 0.02, 2, s * 0.125], [-0.5, 0.835, 0.73, 0.02, 2, s * 0.126], [-0.8, 0.88, 0.8, 0.015, 2, s * 0.088]], col, { p: 2 });
      c.tube([[-0.52, 0.9, s * 0.13], [-0.66, 0.9, s * 0.135], [-0.82, 0.9, s * 0.1]], 0.014, CM("#2f3237", { metalness: 0.5, roughness: 0.4 }), { seg: 12 });
    });
    body(c, [[-0.86, 0.82, 0.76, 0.1], [-0.96, 0.74, 0.68, 0.1], [-1.0, 0.64, 0.58, 0.09]], blk);
    plateMoto(c, -1.005, 0.55);
    [1, -1].forEach(function (s) { blinker(c, -0.96, 0.7, s * 0.13, false); });
    Z.banco = grab(c, n0);
    var tl = ZG.taillight(c, { style: "bar", x: -0.975, y: 0.875, z: 0, w: 0.1, h: 0.04, d: 0.04, side: 1, label: "Lanterna" });
    /* balança em caixa, monoamortecedor, corrente, pedaleiras */
    [1, -1].forEach(function (s) {
      c.rb(0.62, 0.07, 0.035, 0.015, CM("#25272b", { metalness: 0.5, roughness: 0.45 }), -0.39, 0.37, s * 0.1, { rot: [0, 0, 0.09] });
      c.rb(0.12, 0.022, 0.05, 0.01, RUBBER, 0.0, 0.33, s * 0.2);
      c.rb(0.08, 0.02, 0.045, 0.01, RUBBER, -0.36, 0.44, s * 0.17);
      c.rod(new V3(-0.3, 0.42, s * 0.13), new V3(-0.44, 0.48, s * 0.17), 0.012, CM("#2f3237", { metalness: 0.5 }));
    });
    c.rod(new V3(-0.24, 0.44, 0), new V3(-0.12, 0.74, 0), 0.03, CM("#c8a419", { roughness: 0.45 }));
    c.rb(0.56, 0.05, 0.025, 0.015, blk, -0.38, 0.4, -0.14, { rot: [0, 0, 0.1] });
    c.rod(new V3(-0.03, 0.3, -0.14), new V3(-0.14, 0.06, -0.25), 0.012, blk);
    /* escapamento: coletor por baixo e silencioso curto e gordo à direita, com protetor */
    n0 = c.g.children.length;
    c.tube([[eng.exh.x, eng.exh.y, 0.06], [eng.exh.x + 0.06, eng.exh.y - 0.14, 0.1], [0.14, 0.185, 0.04], [-0.12, 0.22, 0.12], [-0.3, 0.38, 0.17]], 0.022, EXH, { seg: 40 });
    var mf = c.cyl(0.075, 0.065, 0.34, CM("#2c2f33", { metalness: 0.7, roughness: 0.35 }), -0.47, 0.45, 0.18); mf.rotation.z = -PI / 2 + 0.28;
    c.cyl(0.04, 0.04, 0.04, EXH, -0.645, 0.5, 0.18).rotation.z = -PI / 2 + 0.28;
    c.rb(0.26, 0.09, 0.03, 0.03, CM("#8d9296", { metalness: 0.7, roughness: 0.35 }), -0.47, 0.47, 0.245, { rot: [0, 0, 0.28] });
    Z.escapamento = grab(c, n0);
    /* garfo, para-lama, carenagem angulosa do farol com viseira fumê, guidão tubular */
    fork(c, [0.38, 0.98], [XF, RF], 0.085, 0.019, MT.chrome, CM("#2b2d31", { metalness: 0.5, roughness: 0.4 }), { split: 0.45 });
    n0 = c.g.children.length;
    var fendF = fender(c, XF, RF, RF + 0.03, 0.55, 2.3, 0.12, 0.02, col);
    body(c, [[0.42, 1.05, 0.82, 0.26, 2.6], [0.52, 1.03, 0.83, 0.28, 2.6], [0.59, 0.99, 0.85, 0.22, 2.4], [0.62, 0.95, 0.87, 0.1, 2.2]], col);
    [1, -1].forEach(function (s) { body(c, [[0.44, 0.97, 0.82, 0.02, 2, s * 0.135], [0.56, 0.95, 0.84, 0.02, 2, s * 0.13], [0.6, 0.92, 0.86, 0.015, 2, s * 0.1]], dark, { p: 2 }); });
    c.rb(0.015, 0.1, 0.2, 0.02, SMOKEG, 0.55, 1.035, 0, { rot: [0, 0, 0.55] });
    c.rb(0.07, 0.03, 0.16, 0.01, CM("#121518", { roughness: 0.25, metalness: 0.3 }), 0.44, 1.07, 0, { rot: [0, 0, 0.5] });
    c.rb(0.04, 0.032, 0.1, 0.006, MT.gauge, 0.45, 1.075, 0, { rot: [0, 0, 0.5] });
    [1, -1].forEach(function (s) { blinker(c, 0.5, 0.92, s * 0.16, true); });
    Z.carenagem = grab(c, n0);
    var HL = lamp(c, { style: "wedge", x: 0.615, y: 0.905, z: 0, w: 0.17, h: 0.075, d: 0.06, side: 1, label: "Farol", pitch: -0.08 });
    drlOn(HL, 0.15, 0.008, 0.036, 0.06);
    n0 = c.g.children.length;
    handlebar(c, 0.34, 1.02, 0.37, { rise: 0.035, back: 0.07, stalk: 0.19 });
    Z.guidao = grab(c, n0);
    zoneParts(c, Z);
    c.part("motor", "Motor 250", null, new V3(0.08, 0.47, 0), 0.8); c.part("tanque", "Tanque de 14 L", null, new V3(0.18, 0.92, 0), 0.7);
    bikeMeta(c, { L: 2.04, W: 0.76, front: 1.02, rear: -1.015, clear: 0.16, bodyH: 0.66, top: 1.07, belt: 0.86, col: hex, rack: 0.9, exhaust: new V3(-0.66, 0.5, 0.18) });
    /* modificado: protetor de motor e de tanque, caixas laterais, galão na garupa, farol auxiliar */
    c.meta.armor = function (c, Zg) {
      [1, -1].forEach(function (s) {
        c.tube([[0.36, 0.9, s * 0.13], [0.46, 0.62, s * 0.28], [0.3, 0.3, s * 0.27], [0.0, 0.26, s * 0.2]], 0.019, Zg.STEELM, { seg: 20 });
        c.rb(0.42, 0.3, 0.16, 0.04, CM("#3d3a2e"), -0.68, 0.7, s * 0.3, { def: true });
        c.rod(new V3(-0.45, 0.82, s * 0.13), new V3(-0.5, 0.72, s * 0.22), 0.012, Zg.STEELM);
        roofLamp(c, 0.5, 0.82, s * 0.24);
      });
      c.rb(0.44, 0.06, 0.3, 0.02, Zg.STEELM, 0.06, 0.24, 0);
      jerryFlat(c, -0.68, 0.98, 0, "#3e5a34");
    };
  });

  /* ================= Ninjá 400 (Kawasaki Ninja 400) ================= */
  /* Referência: Kawasaki Ninja 400 ABS 2018+ (ficha Kawasaki EUA, kawasaki.com, conferida em 2026)
     Medidas reais: comprimento 1,990 · largura 0,710 · altura 1,120 · entre-eixos 1,370 · altura do banco 0,785 · vão livre 0,140
       · pneus 110/70-17 (Ø 0,586) e 150/70-17 (Ø 0,642) · cáster 24,7° · balanços ≈ 0,32 / 0,30 (de memória).
     Traços de assinatura:
       frente: dois faróis de LED estreitos e inclinados ("olhos") numa carenagem pontuda; tomada de ar central entre eles;
         para-brisa curto fumê; retrovisores presos na carenagem.
       lateral: carenagem integral em duas camadas, verde na parte alta e preta em baixo, com a saída de ar e o nome;
         quadro treliçado preto aparecendo sob o tanque; semi-guidões baixos; escapamento curto preto à direita subindo;
         banco dividido com a garupa mais alta; rabeta fina e alta.
       traseira: lanterna de LED em dois arcos na ponta da rabeta, suporte de placa curto com piscas.
       de cima: corpo em flecha, carenagem larga na frente afinando até a rabeta. */
  ZG.register({ k: "ninja", grp: "Motos", n: "Ninjá 400", insp: "Kawasaki Ninja 400", art: "na", c: "Esportiva 400 cc", fuel: "gasolina",
    d: "Esportiva bicilíndrica leve: passa dos 180 km/h na estrada vazia. Posição de corrida e carenagem de plástico, que racha na primeira queda.",
    mass: 168, r: 85, seats: "2", cap: "14 L", eff: "25 km/L", auto: "350 km", vmax: 190, skill: "Pilotagem 2", hood: false
  }, function (c) {
    var hex = "#6cbf1f", col = c.paint(hex), blkp = c.paint("#141517"), wht = c.paint("#eef0ec"), blk = BLK;
    var XF = 0.685, XR = -0.685, RF = 0.293, RR = 0.321;
    var fw = ZG.spokedWheel(c, XF, RF, 0.055, { cast: true, disc: true, label: "Pneu dianteiro" });
    var rw = ZG.spokedWheel(c, XR, RR, 0.075, { cast: true, label: "Pneu traseiro" });
    [fw, rw].forEach(function (g) { moreSpokes(g, 5, 0.22); });
    var Z = { carenagem: [], guidao: [], tanque_moto: [], banco: [], motor: [], escapamento: [] }, n0;
    /* motor bicilíndrico (aparece pouco, sob a carenagem) e radiador atrás da roda */
    n0 = c.g.children.length;
    c.rb(0.42, 0.26, 0.3, 0.07, ENGD, 0.1, 0.38, 0, { def: true });
    c.rb(0.2, 0.26, 0.28, 0.05, ENGD, 0.26, 0.58, 0, { rot: [0, 0, -0.5] });
    c.sph(0.1, CM("#5d6166", { metalness: 0.6, roughness: 0.4 }), 0.02, 0.38, -0.15, 1.1, 1, 0.35);
    c.rb(0.05, 0.3, 0.34, 0.012, CM("#121315", { roughness: 0.6 }), 0.45, 0.62, 0, { rot: [0, 0, -0.32] });
    Z.motor = grab(c, n0);
    /* quadro treliçado preto, visível sob o tanque e atrás da carenagem */
    [1, -1].forEach(function (s) {
      var z = s * 0.13;
      c.tube([[0.42, 0.9, s * 0.06], [0.16, 0.78, z], [-0.12, 0.66, z], [-0.18, 0.46, z]], 0.014, blk, { seg: 20 });
      c.tube([[0.42, 0.84, s * 0.06], [0.2, 0.62, z], [-0.12, 0.66, z]], 0.012, blk, { seg: 12 });
      c.rod(new V3(0.16, 0.78, z), new V3(0.2, 0.62, z), 0.011, blk);
      c.rod(new V3(-0.02, 0.73, z), new V3(0.02, 0.6, z), 0.011, blk);
    });
    c.cyl(0.035, 0.035, 0.16, blk, 0.42, 0.9, 0).rotation.z = -0.43;
    /* carenagem: bico pontudo (verde), flancos em duas camadas (verde em cima, preto embaixo) e quilha */
    n0 = c.g.children.length;
    /* bico em fatias horizontais (loft no eixo y): de frente vira uma ponta de flecha (estreito no queixo, largo nos olhos),
       de lado a ponta fica baixa, na altura da tomada de ar, e a crista sobe até a base do para-brisa; de cima é pontudo */
    var NOSE = [[0.56, 0.8, 0.56, 0.1, 1.9], [0.62, 0.89, 0.52, 0.17, 1.8], [0.69, 0.955, 0.49, 0.25, 1.7], [0.76, 0.99, 0.47, 0.33, 1.65],
      [0.82, 0.965, 0.47, 0.4, 1.65], [0.88, 0.89, 0.48, 0.44, 1.7], [0.94, 0.78, 0.5, 0.44, 1.8], [0.985, 0.68, 0.52, 0.4, 1.9], [1.0, 0.64, 0.53, 0.32, 2]];
    body(c, NOSE, col, { axis: "y", seg: 32 });
    var SIDE = [[0.74, 0.84, 0.6, 0.38, 2.6], [0.56, 0.85, 0.44, 0.44, 2.8], [0.34, 0.81, 0.42, 0.44, 2.8], [0.16, 0.74, 0.44, 0.4, 2.6], [0.04, 0.66, 0.48, 0.28, 2.4]];
    body(c, SIDE, col);
    body(c, [[0.7, 0.62, 0.32, 0.36, 2.6], [0.5, 0.6, 0.24, 0.42, 2.8], [0.26, 0.54, 0.22, 0.42, 2.8], [0.06, 0.5, 0.24, 0.34, 2.6], [-0.06, 0.46, 0.28, 0.2, 2.2]], blkp);
    [1, -1].forEach(function (s) {
      /* segunda camada: aba preta com a saída de ar e o nome */
      body(c, [[0.66, 0.78, 0.6, 0.02, 2, s * 0.205], [0.5, 0.76, 0.54, 0.03, 2, s * 0.225], [0.34, 0.72, 0.52, 0.03, 2, s * 0.225], [0.22, 0.66, 0.56, 0.02, 2, s * 0.21]], blkp, { p: 2 });
      for (var i = 0; i < 3; i++) c.rb(0.16, 0.012, 0.01, 0.004, CM("#2c2e31"), 0.44, 0.6 + i * 0.035, s * 0.243, { rot: [0, 0, -0.3] });
      c.text("NINJÁ 400", 0.24, 0.055, 0.44, 0.8, s * (loftHalf(SIDE, 0.44, 0.8) + 0.003), s > 0 ? "+z" : "-z", { fg: "#151515", size: 0.85 });
      /* filete branco que corre na crista do bico, colado à superfície */
      var fp = []; for (var q = 0; q <= 8; q++) { var fx = 0.88 - q * 0.04, fy = 0.875 + q * 0.006; fp.push([fx, fy, s * (yHalf(NOSE, fy, fx) + 0.002)]); }
      c.tube(fp, 0.006, wht, { seg: 24 });
      /* retrovisores presos na carenagem */
      c.rod(new V3(0.62, 0.95, s * 0.19), new V3(0.6, 1.0, s * 0.28), 0.008, blk);
      c.rb(0.06, 0.06, 0.11, 0.025, blkp, 0.59, 1.01, s * 0.295, { def: true });
      c.rb(0.006, 0.045, 0.09, 0.01, MT.chrome, 0.555, 1.01, s * 0.295);
      blinker(c, 0.6, 0.98, s * 0.31, true, { flush: true });
    });
    /* tomada de ar central e para-brisa curto fumê */
    c.rb(0.05, 0.035, 0.07, 0.012, CM("#0b0c0d", { roughness: 0.9 }), 0.965, 0.79, 0, { rot: [0, 0, 0.35] });
    var ws = c.rb(0.012, 0.3, 0.3, 0.06, SMOKEG, 0.64, 1.02, 0, { rot: [0, 0, 0.62], taper: { sz: 0.55 } }); ws.castShadow = false; ws.renderOrder = 2;
    var fendF = fender(c, XF, RF, RF + 0.025, 0.25, 2.05, 0.12, 0.02, blkp);
    Z.carenagem = grab(c, n0).concat([fendF]);
    /* dois faróis de LED estreitos e inclinados para fora e para cima */
    [1, -1].forEach(function (s) {
      var L = lamp(c, { style: "slim", x: 0.862, y: 0.87, z: s * 0.115, w: 0.15, h: 0.032, d: 0.04, side: s, yaw: 0.65, roll: s * 0.25, label: "Farol " + (s > 0 ? "direito" : "esquerdo") });
      drlOn(L, 0.14, 0.006, 0.013, 0.05);
    });
    /* tanque preto brilhante */
    n0 = c.g.children.length;
    body(c, [[0.46, 0.97, 0.8, 0.28, 2.4], [0.3, 0.98, 0.76, 0.36, 3], [0.12, 0.965, 0.74, 0.37, 3], [-0.02, 0.915, 0.77, 0.31, 2.6], [-0.1, 0.86, 0.8, 0.18, 2.2]], blkp, { crease: 40 });
    c.cyl(0.04, 0.04, 0.012, MT.chrome, 0.26, 0.98, 0);
    Z.tanque_moto = grab(c, n0);
    /* banco dividido, rabeta alta e fina, suporte de placa curto */
    n0 = c.g.children.length;
    body(c, [[-0.02, 0.82, 0.76, 0.22], [-0.12, 0.79, 0.74, 0.3], [-0.36, 0.79, 0.74, 0.27], [-0.44, 0.82, 0.77, 0.2]], SEAT, { p: 3 });
    body(c, [[-0.46, 0.875, 0.82, 0.17], [-0.66, 0.895, 0.84, 0.15], [-0.76, 0.89, 0.85, 0.07]], SEAT, { p: 3 });
    var TLc = [[-0.08, 0.77, 0.58, 0.26, 2.6], [-0.45, 0.84, 0.66, 0.26, 2.6], [-0.8, 0.9, 0.78, 0.16, 2.4], [-0.99, 0.925, 0.86, 0.05, 2.2]];
    body(c, TLc, col);
    body(c, [[-0.86, 0.8, 0.74, 0.12], [-0.97, 0.72, 0.66, 0.1], [-1.0, 0.66, 0.6, 0.09]], blk);
    plateMoto(c, -1.0, 0.57);
    [1, -1].forEach(function (s) { blinker(c, -0.96, 0.71, s * 0.12, false); });
    Z.banco = grab(c, n0);
    ZG.taillight(c, { style: "bar", x: -0.965, y: 0.885, z: 0, w: 0.09, h: 0.035, d: 0.04, side: 1, label: "Lanterna" });
    [1, -1].forEach(function (s) { var a = c.rb(0.006, 0.01, 0.07, 0.003, REDLED, -0.985, 0.875, s * 0.03, { rot: [s * 0.5, 0, 0] }); a.castShadow = false; });
    /* balança, amortecedor, pedaleiras, corrente */
    [1, -1].forEach(function (s) {
      c.rb(0.6, 0.07, 0.035, 0.015, CM("#1e2023", { metalness: 0.5, roughness: 0.45 }), -0.4, 0.37, s * 0.105, { rot: [0, 0, 0.08] });
      c.rb(0.11, 0.022, 0.05, 0.01, RUBBER, -0.08, 0.38, s * 0.2);
      c.rod(new V3(-0.06, 0.4, s * 0.15), new V3(-0.16, 0.5, s * 0.17), 0.012, CM("#3a3d42", { metalness: 0.6 }));
    });
    c.rb(0.56, 0.05, 0.025, 0.015, blk, -0.4, 0.4, -0.14, { rot: [0, 0, 0.08] });
    c.rod(new V3(-0.06, 0.3, -0.14), new V3(-0.16, 0.06, -0.24), 0.012, blk);
    /* escapamento curto preto subindo à direita, ponteira prata */
    n0 = c.g.children.length;
    c.tube([[0.48, 0.42, 0.06], [0.42, 0.22, 0.08], [0.1, 0.17, 0.1], [-0.18, 0.26, 0.16], [-0.26, 0.32, 0.17]], 0.022, EXH, { seg: 40 });
    c.rb(0.24, 0.08, 0.16, 0.03, CM("#2a2c30", { metalness: 0.6, roughness: 0.4 }), 0.0, 0.18, 0.02);
    var mf = c.cyl(0.07, 0.06, 0.36, CM("#1c1e21", { metalness: 0.6, roughness: 0.35 }), -0.42, 0.42, 0.18); mf.rotation.z = -PI / 2 + 0.42;
    c.cyl(0.045, 0.045, 0.04, EXH, -0.59, 0.5, 0.18).rotation.z = -PI / 2 + 0.42;
    Z.escapamento = grab(c, n0);
    fork(c, [0.4, 0.91], [XF, RF], 0.085, 0.02, MT.chrome, CM("#26282b", { metalness: 0.5, roughness: 0.4 }), { split: 0.4 });
    /* semi-guidões baixos (sem retrovisor: eles ficam na carenagem) e painel */
    n0 = c.g.children.length;
    handlebar(c, 0.38, 0.9, 0.31, { rise: 0.0, back: 0.05, mirrors: false });
    c.rb(0.08, 0.1, 0.2, 0.02, blk, 0.5, 0.95, 0, { rot: [0, 0, 0.7] }); c.rb(0.012, 0.075, 0.16, 0.006, MT.gauge, 0.47, 0.975, 0, { rot: [0, 0, 0.7] });
    Z.guidao = grab(c, n0);
    zoneParts(c, Z);
    c.part("motor", "Motor bicilíndrico", null, new V3(0.15, 0.45, 0), 0.8); c.part("tanque", "Tanque de 14 L", null, new V3(0.15, 0.92, 0), 0.7);
    c.part("carenagem", "Carenagem", null, new V3(0.7, 0.75, 0), 0.7);
    bikeMeta(c, { L: 1.99, W: 0.71, front: 0.99, rear: -1.01, clear: 0.14, bodyH: 0.66, top: 1.12, belt: 0.84, col: hex, rack: 0.9, exhaust: new V3(-0.6, 0.5, 0.18) });
    /* modificado: grade de chapa sobre os faróis, protetores laterais (sliders) e tela no para-brisa, bolsa de tanque e galão na garupa */
    c.meta.armor = function (c, Zg) {
      c.rb(0.04, 0.12, 0.3, 0.01, Zg.STEELM, 0.97, 0.8, 0, { rot: [0, 0, -0.5] });
      for (var i = -3; i <= 3; i++) c.rod(new V3(0.66, 0.92, i * 0.035), new V3(0.58, 1.08, i * 0.035), 0.004, MT.steel);
      [1, -1].forEach(function (s) { c.cyl(0.03, 0.03, 0.1, CM("#101010"), 0.3, 0.62, s * 0.3, "z"); c.rb(0.5, 0.08, 0.02, 0.01, Zg.STEELM, 0.4, 0.42, s * 0.24); });
      c.rb(0.26, 0.12, 0.28, 0.05, CM("#2a2b2d", { roughness: 0.85 }), 0.18, 1.1, 0, { def: true });
      jerryFlat(c, -0.62, 0.98, 0, "#8e2a20");
    };
  });

  /* ================= Fat Boi 114 (Harley-Davidson Fat Boy 114) ================= */
  /* Referência: Harley-Davidson Softail Fat Boy 114 2018+ (ficha de motorcycle.com, conferida em 2026)
     Medidas reais: comprimento 2,370 · largura 0,985 (guidão) · altura 1,095 · entre-eixos 1,665 · altura do banco 0,675
       · vão livre 0,115 · pneus 160/60 R18 (Ø 0,649, largura 0,16) e 240/40 R18 (Ø 0,649, largura 0,24) · cáster 30°
       · balanços ≈ 0,35 / 0,36 (de memória).
     Traços de assinatura:
       frente: farol redondo grande de LED com anel de luz numa nacela; garfo grosso com coberturas largas; pneu dianteiro gordo;
         guidão largo e reto, alto nas pontas; para-lama dianteiro curto.
       lateral: rodas de disco fechado (sem raios) com fendas rasas; motor V2 de 114 pol³ com cilindros aletados pretos
         e tampas cromadas; filtro de ar redondo à direita; tanque gota com o console cromado e o mostrador em cima;
         banco baixo em dois níveis; plataformas (floorboards); escapamento duplo empilhado à direita, com ponta cortada.
       traseira: pneu de 240 mm sob um para-lama largo e arredondado, lanterna no fim do para-lama, piscas baixos.
       de cima: guidão largo, tanque largo, pneus gordos, cilindros saindo pouco para os lados. */
  ZG.register({ k: "fatboi", grp: "Motos", n: "Fat Boi 114", insp: "Harley-Davidson Fat Boy 114", art: "na", c: "Custom V2 1868 cc", fuel: "gasolina",
    d: "Custom pesada de rodas fechadas e motor V2 de 1,9 litro. O ronco chama zumbi de longe, mas o torque arrasta qualquer obstáculo.",
    mass: 317, r: 110, seats: "2", cap: "18,9 L", eff: "18 km/L", auto: "340 km", vmax: 180, skill: "Pilotagem 2", hood: false
  }, function (c) {
    var hex = "#3b4652", col = c.paint(hex), blk = BLK, CH = CM("#c4c8cb", { metalness: 0.6, roughness: 0.28 }), gloss = CM("#0c0d0f", { roughness: 0.25, metalness: 0.5 });
    var XF = 0.8325, XR = -0.8325, R = 0.3245;
    fatWheel(c, XF, R, 0.16, 0.235, { label: "Pneu dianteiro", disc2: true });
    fatWheel(c, XR, R, 0.24, 0.235, { label: "Pneu traseiro" });
    var Z = { carenagem: [], guidao: [], tanque_moto: [], banco: [], motor: [], escapamento: [] }, n0;
    /* quadro softail preto: pescoço, espinha, berço sob o motor, balança triangulada */
    var HD = [0.49, 0.915];
    c.cyl(0.042, 0.042, 0.2, blk, HD[0] - 0.02, HD[1] - 0.02, 0).rotation.z = -0.52;
    [1, -1].forEach(function (s) {
      var z = s * 0.1;
      c.tube([[HD[0] - 0.04, HD[1] - 0.08, s * 0.04], [0.38, 0.5, z], [0.32, 0.15, z], [-0.1, 0.135, z], [-0.28, 0.3, z]], 0.02, blk, { seg: 30 });
      c.tube([[-0.28, 0.3, z], [-0.32, 0.6, z * 0.9], [-0.42, 0.66, z * 1.1]], 0.02, blk, { seg: 12 });
      c.rod(new V3(-0.26, 0.3, s * 0.15), new V3(XR, R, s * 0.15), 0.026, blk);
      c.rod(new V3(-0.4, 0.5, s * 0.15), new V3(XR + 0.02, R + 0.02, s * 0.15), 0.018, blk);
      c.rod(new V3(-0.26, 0.3, s * 0.15), new V3(-0.4, 0.5, s * 0.15), 0.018, blk);
    });
    c.tube([[HD[0] - 0.04, HD[1] - 0.02, 0], [0.2, 0.74, 0], [-0.2, 0.66, 0], [-0.42, 0.68, 0]], 0.028, blk, { seg: 30 });
    /* motor V2: cárter, dois cilindros aletados pretos em V de 45°, cabeçotes e tampas cromadas, filtro redondo à direita */
    n0 = c.g.children.length;
    c.rb(0.44, 0.24, 0.26, 0.08, CM("#24262a", { metalness: 0.5, roughness: 0.4 }), 0.1, 0.3, 0, { def: true });
    c.rb(0.3, 0.03, 0.22, 0.01, blk, 0.08, 0.13, 0);
    [[0.2, 0.43, 0.39], [-0.01, 0.43, -0.39]].forEach(function (cy) {
      var bx = cy[0], by = cy[1], tl = cy[2], len = 0.22;
      for (var f = 0; f < 9; f++) {
        var t = f / 8, px = bx + Math.sin(tl) * t * len, py = by + Math.cos(tl) * t * len;
        c.rb(0.17 - t * 0.01, 0.012, 0.15, 0.006, gloss, px, py, 0, { rot: [0, 0, -tl] });
        c.rb(0.172 - t * 0.01, 0.003, 0.152, 0.002, ENG, px, py + 0.007, 0, { rot: [0, 0, -tl] });
      }
      c.rb(0.12, len, 0.11, 0.03, gloss, bx + Math.sin(tl) * len / 2, by + Math.cos(tl) * len / 2, 0, { rot: [0, 0, -tl] });
      c.rb(0.19, 0.06, 0.17, 0.03, CH, bx + Math.sin(tl) * (len + 0.03), by + Math.cos(tl) * (len + 0.03), 0, { rot: [0, 0, -tl] });
    });
    c.cyl(0.12, 0.12, 0.07, CH, 0.2, 0.56, 0.17, "z");
    c.cyl(0.1, 0.1, 0.012, CM("#9ea3a7", { metalness: 0.55, roughness: 0.35 }), 0.2, 0.56, 0.21, "z");
    c.text("114", 0.1, 0.04, 0.2, 0.56, 0.217, "+z", { fg: "#1b1c1f", size: 0.85 });
    /* tampa da primária (esquerda), correia (direita) */
    c.sph(0.17, CH, -0.06, 0.32, -0.17, 1.35, 0.85, 0.28);
    c.cyl(0.07, 0.07, 0.02, CH, -0.02, 0.3, -0.215, "z");
    c.rb(0.86, 0.035, 0.02, 0.015, CM("#1a1a1a", { roughness: 0.8 }), -0.43, 0.32, 0.15, { rot: [0, 0, 0.0] });
    Z.motor = grab(c, n0);
    /* garfo grosso com coberturas largas, nacela e farol redondo grande com anel de luz */
    fork(c, [HD[0], HD[1]], [XF, R], 0.115, 0.024, CH, CH, { split: 0.5, lowK: 1.25 });
    n0 = c.g.children.length;
    [1, -1].forEach(function (s) { c.rod(new V3(HD[0] + 0.01, HD[1] - 0.02, s * 0.115), new V3(0.65, 0.6, s * 0.115), 0.048, col, { seg: 16 }); });
    c.sph(0.13, col, 0.6, 0.85, 0, 1.15, 0.9, 1.0);
    var fendF = fender(c, XF, R, R + 0.03, 0.55, 1.95, 0.2, 0.025, col);
    [1, -1].forEach(function (s) { blinker(c, 0.62, 0.95, s * 0.2, true, { r: 0.024 }); });
    Z.carenagem = grab(c, n0).concat([fendF]);
    var HL = lamp(c, { style: "round", x: 0.72, y: 0.84, z: 0, w: 0.19, h: 0.19, d: 0.1, side: 1, label: "Farol" });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.007, 6, 32), DRL); ring.rotation.y = PI / 2; ring.position.set(0.052, 0, 0); ring.castShadow = false; HL.g.add(ring); HL.inner.push(ring);
    /* tanque gota com console cromado e mostrador */
    n0 = c.g.children.length;
    var TK = [[0.46, 0.89, 0.76, 0.18, 2.2], [0.36, 0.95, 0.72, 0.38, 2.4], [0.16, 0.965, 0.71, 0.44, 2.4], [-0.04, 0.93, 0.72, 0.4, 2.4], [-0.16, 0.86, 0.74, 0.26, 2.2], [-0.2, 0.82, 0.76, 0.1, 2]];
    body(c, TK, col);
    body(c, [[0.36, 0.955, 0.94, 0.1, 3], [0.2, 0.975, 0.955, 0.12, 3], [-0.04, 0.945, 0.92, 0.1, 3], [-0.12, 0.915, 0.89, 0.06, 3]], CH, { def: false });
    c.cyl(0.05, 0.05, 0.012, CH, 0.22, 0.982, 0); var g = c.cyl(0.042, 0.042, 0.004, MT.gauge, 0.22, 0.989, 0); g.castShadow = false;
    c.cyl(0.03, 0.03, 0.01, CH, 0.36, 0.955, 0.1);
    [1, -1].forEach(function (s) { c.text("FAT BOI", 0.18, 0.04, 0.16, 0.84, s * (loftHalf(TK, 0.16, 0.84) + 0.003), s > 0 ? "+z" : "-z", { fg: "#e3e5e6", size: 0.85 }); });
    Z.tanque_moto = grab(c, n0);
    /* banco baixo em dois níveis, para-lama traseiro largo, lanterna, placa, piscas */
    n0 = c.g.children.length;
    body(c, [[-0.16, 0.78, 0.66, 0.24], [-0.26, 0.7, 0.63, 0.36], [-0.46, 0.68, 0.63, 0.38], [-0.58, 0.72, 0.66, 0.3], [-0.74, 0.77, 0.7, 0.26], [-0.84, 0.77, 0.72, 0.14]], SEAT, { p: 3 });
    var fendR = fender(c, XR, R, R + 0.035, 0.42, 2.78, 0.3, 0.03, col, { drop: 0.03 });
    c.cyl(0.035, 0.035, 0.03, CH, -1.165, 0.53, 0, "x");
    plateMoto(c, -1.18, 0.4);
    [1, -1].forEach(function (s) { blinker(c, -1.06, 0.48, s * 0.2, false, { r: 0.022 }); });
    /* plataformas (floorboards) e pedaleiras da garupa */
    [1, -1].forEach(function (s) {
      c.rb(0.3, 0.025, 0.13, 0.012, RUBBER, 0.42, 0.24, s * 0.31);
      c.rb(0.31, 0.01, 0.135, 0.004, CH, 0.42, 0.226, s * 0.31);
      c.rod(new V3(0.3, 0.22, s * 0.12), new V3(0.4, 0.23, s * 0.26), 0.014, CH);
      c.rb(0.1, 0.022, 0.05, 0.01, RUBBER, -0.52, 0.36, s * 0.24);
    });
    Z.banco = grab(c, n0).concat([fendR]);
    ZG.taillight(c, { style: "round2", x: -1.16, y: 0.55, z: 0, w: 0.1, h: 0.045, d: 0.04, side: 1, label: "Lanterna" });
    /* escapamento: dois coletores cromados que descem à direita e dois silenciosos curtos empilhados com ponta cortada */
    n0 = c.g.children.length;
    c.tube([[0.33, 0.6, 0.06], [0.42, 0.5, 0.16], [0.38, 0.3, 0.2], [0.1, 0.24, 0.22], [-0.3, 0.28, 0.24]], 0.024, CH, { seg: 40 });
    c.tube([[-0.06, 0.62, 0.06], [-0.04, 0.5, 0.2], [-0.12, 0.38, 0.24], [-0.3, 0.38, 0.25]], 0.024, CH, { seg: 30 });
    [0.29, 0.4].forEach(function (y, i) {
      var mf = c.cyl(0.05, 0.05, 0.6, CH, -0.62, y + i * 0.02, 0.25); mf.rotation.z = -PI / 2 + 0.06;
      c.rb(0.06, 0.1, 0.1, 0.01, CM("#0d0d0e", { roughness: 0.8 }), -0.925, y + i * 0.02 - 0.015, 0.25, { rot: [0, 0, 0.6] });
    });
    c.rb(0.3, 0.09, 0.02, 0.03, CH, -0.18, 0.33, 0.27);
    Z.escapamento = grab(c, n0);
    /* guidão largo e reto, com risers e retrovisores */
    n0 = c.g.children.length;
    c.rod(new V3(0.47, 0.95, -0.05), new V3(0.45, 1.0, -0.05), 0.016, CH); c.rod(new V3(0.47, 0.95, 0.05), new V3(0.45, 1.0, 0.05), 0.016, CH);
    handlebar(c, 0.44, 1.0, 0.475, { rise: 0.02, back: 0.12, mat: CH, r: 0.016, stalk: 0.035, mW: 0.11, mH: 0.06, mOut: 0.03 });
    Z.guidao = grab(c, n0);
    c.rod(new V3(-0.08, 0.2, -0.16), new V3(-0.2, 0.04, -0.3), 0.013, blk);
    zoneParts(c, Z);
    c.part("motor", "Motor V2 114", null, new V3(0.1, 0.45, 0), 0.9); c.part("tanque", "Tanque de 18,9 L", null, new V3(0.15, 0.85, 0), 0.8);
    bikeMeta(c, { L: 2.37, W: 0.985, front: 1.19, rear: -1.19, clear: 0.12, bodyH: 0.7, top: 1.095, belt: 0.82, col: hex, rack: 0.8, exhaust: new V3(-0.93, 0.33, 0.25) });
    /* zona própria: o para-lama traseiro e a lanterna pertencem ao banco e rabeta (o automático já pega); nada a remover */
    /* modificado: alforjes de couro, encosto (sissy bar) com galão, chapa de para-choque no garfo, galões nas plataformas */
    c.meta.armor = function (c, Zg) {
      var lea = CM("#3a2618", { roughness: 0.85 });
      [1, -1].forEach(function (s) {
        c.rb(0.42, 0.3, 0.16, 0.06, lea, -0.85, 0.58, s * 0.27, { def: true });
        c.rb(0.43, 0.06, 0.17, 0.02, CM("#2a1b10"), -0.85, 0.72, s * 0.27);
        c.rod(new V3(-0.9, 0.6, s * 0.17), new V3(-0.95, 1.12, s * 0.13), 0.014, CH);
        c.tube([[0.62, 0.6, s * 0.2], [0.78, 0.66, s * 0.32], [0.62, 0.35, s * 0.34], [0.38, 0.22, s * 0.32]], 0.022, Zg.STEELM, { seg: 20 });
      });
      c.tube([[-0.95, 1.12, -0.13], [-0.97, 1.18, 0], [-0.95, 1.12, 0.13]], 0.014, CH, { seg: 12 });
      ZG.jerry(c, -0.86, 0.95, 0, "#8e2a20");
      c.rb(0.04, 0.22, 0.34, 0.01, Zg.STEELM, 0.86, 0.55, 0, { rot: [0, 0, -0.3] });
    };
  });

  /* ================= Titã 160 Cargo (Honda CG 160 Cargo, com baú de entrega) ================= */
  /* Referência: Honda CG 160 Cargo 2016+ (ficha Honda, via motoragora.com.br, conferida em 2026)
     Medidas reais: comprimento 2,038 · largura 0,754 · altura 1,087 (sem o baú) · entre-eixos 1,315 · altura do banco 0,790
       · vão livre 0,170 · pneus 80/100-18 (Ø 0,617) e 90/90-18 (Ø 0,619) · balanços ≈ 0,34 / 0,38 (de memória)
       · baú de fibra de entrega ≈ 0,46 x 0,44 x 0,42 (de memória, padrão de motofrete).
     Traços de assinatura:
       frente: farol trapezoidal multirrefletor na carenagem curta; piscas em hastes; para-lama curto; protetor de pernas tubular.
       lateral: branca de fábrica; tanque alto com aletas pretas; banco só para o piloto, curto; bagageiro de aço grande e plano
         no lugar da garupa; rodas raiadas com freio a tambor nas duas; motor monocilíndrico prata; escapamento cromado baixo;
         protetor de corrente; "CARGO" na tampa lateral.
       traseira: baú quadrado de fibra sobre o bagageiro, lanterna da CG sob ele, placa e piscas.
       de cima: tanque largo, banco curto, bagageiro retangular largo atrás com o baú. */
  ZG.register({ k: "cargo", grp: "Motos", n: "Titã 160 Cargo", insp: "Honda CG 160 Cargo", art: "na", c: "Moto de entrega 160 cc", fuel: "flex",
    d: "A moto de motoboy: banco só do piloto, bagageiro de aço e baú de entrega. O baú leva remédio, comida e munição pela cidade tomada.",
    mass: 131, r: 70, seats: "1 (sem garupa)", cap: "16,1 L + baú de 90 L (20 kg)", eff: "38 km/L (G) · 27 km/L (E)", auto: "610 km", vmax: 110, skill: "Pilotagem 1", hood: false
  }, function (c) {
    var hex = "#eceae3", col = c.paint(hex), blk = BLK, gray = CM("#4a4c4f", { metalness: 0.4, roughness: 0.45 });
    var XF = 0.6575, XR = -0.6575, RF = 0.3085, RR = 0.3095;
    var fw = ZG.spokedWheel(c, XF, RF, 0.042, { spokes: 36, label: "Pneu dianteiro" });
    var rw = ZG.spokedWheel(c, XR, RR, 0.047, { spokes: 36, label: "Pneu traseiro" });
    drumHub(fw, 0.075, 1); drumHub(rw, 0.085, -1);
    var Z = { carenagem: [], guidao: [], tanque_moto: [], banco: [], motor: [], escapamento: [] }, n0;
    c.tube([[0.36, 0.93, 0], [0.25, 0.66, 0], [0.12, 0.34, 0], [-0.16, 0.26, 0], [-0.2, 0.5, 0], [-0.14, 0.7, 0]], 0.02, blk, { seg: 40 });
    c.tube([[0.36, 0.93, 0], [0.1, 0.8, 0], [-0.14, 0.72, 0], [-0.5, 0.74, 0], [-0.86, 0.78, 0]], 0.019, blk, { seg: 40 });
    c.cyl(0.035, 0.035, 0.16, blk, 0.37, 0.91, 0).rotation.z = -0.42;
    n0 = c.g.children.length;
    var eng = singleEngine(c, { x: 0.02, y: 0.42, tilt: 0.32 });
    Z.motor = grab(c, n0);
    /* tanque branco com aletas pretas */
    n0 = c.g.children.length;
    var TK = [[0.38, 0.93, 0.77, 0.14, 2.2], [0.3, 0.965, 0.71, 0.3, 2.4], [0.14, 0.96, 0.69, 0.34, 2.4], [0.0, 0.92, 0.7, 0.3, 2.4], [-0.08, 0.86, 0.73, 0.2, 2.2], [-0.11, 0.83, 0.77, 0.08, 2]];
    body(c, TK, col);
    [1, -1].forEach(function (s) {
      body(c, [[0.4, 0.88, 0.78, 0.03, 2, s * 0.13], [0.3, 0.87, 0.6, 0.04, 2, s * 0.17], [0.18, 0.81, 0.58, 0.03, 2, s * 0.17], [0.12, 0.75, 0.64, 0.02, 2, s * 0.15]], blk, { p: 2 });
      c.text("TITÃ 160", 0.2, 0.05, 0.17, 0.9, s * (loftHalf(TK, 0.17, 0.9) + 0.003), s > 0 ? "+z" : "-z", { fg: "#a4241d", size: 0.8 });
    });
    c.cyl(0.032, 0.032, 0.012, MT.chrome, 0.24, 0.968, 0);
    Z.tanque_moto = grab(c, n0);
    /* banco curto só do piloto, tampas laterais com "CARGO", bagageiro de aço grande e o baú */
    n0 = c.g.children.length;
    body(c, [[-0.04, 0.83, 0.75, 0.16], [-0.14, 0.8, 0.73, 0.27], [-0.4, 0.805, 0.74, 0.27], [-0.48, 0.83, 0.76, 0.18]], SEAT, { p: 3 });
    body(c, [[-0.06, 0.76, 0.58, 0.22, 2.6], [-0.3, 0.77, 0.6, 0.24, 2.6], [-0.6, 0.8, 0.68, 0.2, 2.6], [-0.82, 0.8, 0.74, 0.12, 2.4], [-0.9, 0.79, 0.76, 0.05]], col);
    c.rb(0.22, 0.16, 0.18, 0.04, blk, -0.24, 0.6, 0);
    [1, -1].forEach(function (s) {
      body(c, [[-0.06, 0.73, 0.6, 0.02, 2, s * 0.12], [-0.16, 0.74, 0.54, 0.035, 2.2, s * 0.13], [-0.34, 0.75, 0.56, 0.035, 2.2, s * 0.13], [-0.46, 0.76, 0.64, 0.02, 2, s * 0.12]], blk, { p: 2.2 });
      c.text("CARGO", 0.12, 0.045, -0.26, 0.66, s * 0.152, s > 0 ? "+z" : "-z", { fg: "#e8e6df", size: 0.9 });
    });
    var RY = 0.855;
    c.rb(0.5, 0.022, 0.36, 0.008, blk, -0.72, RY, 0, { def: true });
    for (var i = 0; i < 6; i++) c.rb(0.012, 0.012, 0.34, 0.004, CM("#26272a", { metalness: 0.4 }), -0.5 - i * 0.09, RY + 0.015, 0);
    [1, -1].forEach(function (s) {
      c.tube([[-0.46, RY, s * 0.18], [-0.97, RY, s * 0.18], [-0.97, RY, -s * 0.0]], 0.014, blk, { seg: 10 });
      c.rod(new V3(-0.5, 0.78, s * 0.12), new V3(-0.52, RY, s * 0.17), 0.013, blk);
      c.rod(new V3(-0.85, 0.66, s * 0.11), new V3(-0.9, RY, s * 0.17), 0.013, blk);
    });
    var nB = c.g.children.length;  /* tudo do baú (caixa, tampa, trinco, letreiros, refletivo) vai para a zona dele */
    var bau = c.rb(0.46, 0.42, 0.44, 0.03, CM("#b3201b", { roughness: 0.55 }), -0.74, RY + 0.22, 0, { def: true });
    var tampa = c.rb(0.47, 0.035, 0.45, 0.015, CM("#8c1915", { roughness: 0.6 }), -0.74, RY + 0.43, 0);
    c.rb(0.03, 0.06, 0.08, 0.008, MT.steel, -0.505, RY + 0.36, 0);
    [1, -1].forEach(function (s) {
      c.text("ENTREGA", 0.36, 0.08, -0.74, RY + 0.26, s * 0.222, s > 0 ? "+z" : "-z", { fg: "#f3f1ea", size: 0.85 });
      c.text("RÁPIDA", 0.3, 0.07, -0.74, RY + 0.17, s * 0.222, s > 0 ? "+z" : "-z", { fg: "#f2c21a", size: 0.85 });
    });
    c.text("ENTREGA", 0.3, 0.07, -0.972, RY + 0.24, 0, "-x", { fg: "#f3f1ea", size: 0.85 });
    var refl = c.rb(0.006, 0.03, 0.3, 0.004, CM("#d7d9d2", { emissive: "#404040", roughness: 0.3 }), -0.972, RY + 0.12, 0); refl.castShadow = false;
    var bauParts = c.g.children.slice(nB);
    plateMoto(c, -1.0, 0.6);
    c.add(fenderGeo(XR, RR, 0.36, 1.2, 2.9, 0.14, 0.025, 0), blk, 0, 0, 0);
    [1, -1].forEach(function (s) { blinker(c, -0.88, 0.76, s * 0.15, false); });
    Z.banco = grab(c, n0).filter(function (m) { return bauParts.indexOf(m) < 0; });
    ZG.taillight(c, { style: "vertical", x: -0.9, y: 0.775, z: 0, w: 0.12, h: 0.07, d: 0.06, side: 1, label: "Lanterna" });
    /* zona própria do baú: amassa, a tampa solta e cai; arrancado perde a carga */
    c.zone("bau", "Baú de entrega", [-1.0, -0.48, RY - 0.02, RY + 0.48, -0.26, 0.26], bauParts,
      { type: "peca", dir: [1, 0, 0], w: 0.6, anchor: [-0.5, RY, 0], noFlap: true, fx: ["Nenhum", "Só estético, fibra riscada", "baú rachado: a tampa não trava", "baú solto: a carga cai na rua", "baú arrancado: carga perdida"] });
    /* balança, amortecedores, corrente com protetor, pedaleiras, protetor de pernas */
    [1, -1].forEach(function (s) {
      c.rod(new V3(-0.18, 0.4, s * 0.1), new V3(XR, RR, s * 0.1), 0.022, blk);
      c.rod(new V3(-0.6, 0.34, s * 0.13), new V3(-0.5, 0.76, s * 0.13), 0.014, MT.chrome);
      c.rod(new V3(-0.59, 0.38, s * 0.13), new V3(-0.52, 0.66, s * 0.13), 0.026, CM("#2a2b2e", { roughness: 0.5 }));
      c.rb(0.12, 0.022, 0.05, 0.01, RUBBER, 0.0, 0.32, s * 0.2);
      c.tube([[0.32, 0.86, s * 0.07], [0.42, 0.66, s * 0.2], [0.36, 0.38, s * 0.22], [0.16, 0.3, s * 0.14]], 0.016, blk, { seg: 20 });
    });
    c.rb(0.5, 0.06, 0.03, 0.02, blk, -0.42, 0.38, -0.12, { rot: [0, 0, 0.15] });
    c.rod(new V3(-0.06, 0.3, -0.14), new V3(-0.16, 0.06, -0.26), 0.012, blk);
    n0 = c.g.children.length;
    c.tube([[eng.exh.x, eng.exh.y, 0.06], [eng.exh.x + 0.05, eng.exh.y - 0.1, 0.12], [0.08, 0.26, 0.16], [-0.3, 0.32, 0.18], [-0.48, 0.4, 0.18]], 0.022, EXH, { seg: 40 });
    c.cyl(0.055, 0.045, 0.42, EXH, -0.66, 0.46, 0.18).rotation.z = -PI / 2 + 0.22;
    c.rb(0.32, 0.07, 0.03, 0.03, HEAT, -0.62, 0.48, 0.23, { rot: [0, 0, 0.22] });
    Z.escapamento = grab(c, n0);
    fork(c, [0.38, 0.95], [XF, RF], 0.085, 0.017, MT.chrome, gray);
    n0 = c.g.children.length;
    var fendF = fender(c, XF, RF, 0.345, 0.2, 2.2, 0.12, 0.02, col);
    body(c, [[0.4, 1.01, 0.8, 0.22, 2.6], [0.47, 1.0, 0.8, 0.26, 2.6], [0.53, 0.98, 0.82, 0.24, 2.6], [0.565, 0.94, 0.84, 0.12, 2.2]], col);
    c.rb(0.1, 0.07, 0.18, 0.02, blk, 0.36, 1.04, 0, { rot: [0, 0, 0.4] }); c.rb(0.02, 0.05, 0.15, 0.01, MT.gauge, 0.39, 1.06, 0, { rot: [0, 0, 0.4] });
    [1, -1].forEach(function (s) { blinker(c, 0.48, 0.9, s * 0.17, true); });
    Z.carenagem = grab(c, n0);
    lamp(c, { style: "rect", x: 0.57, y: 0.91, z: 0, w: 0.2, h: 0.11, d: 0.08, side: 1, label: "Farol" });
    n0 = c.g.children.length;
    handlebar(c, 0.36, 1.02, 0.36, { rise: 0.03, back: 0.06, mat: MT.chrome, stalk: 0.19 });
    Z.guidao = grab(c, n0);
    zoneParts(c, Z);
    c.part("motor", "Motor", null, new V3(0.02, 0.45, 0), 0.8); c.part("tanque", "Tanque", null, new V3(0.15, 0.84, 0), 0.7);
    c.part("carga", "Baú de entrega", bau, new V3(-0.74, RY + 0.22, 0), 0.6);
    bikeMeta(c, { L: 2.04, W: 0.754, front: 1.0, rear: -1.012, clear: 0.17, bodyH: 0.62, top: 1.087, belt: 0.84, col: hex, rack: RY + 0.45, exhaust: new V3(-0.87, 0.5, 0.18) });
    /* modificado: baú blindado com chapa e grade, galões laterais, protetor de motor */
    c.meta.armor = function (c, Zg) {
      c.rb(0.48, 0.44, 0.012, 0.004, Zg.STEELM, -0.74, RY + 0.22, 0.228); c.rb(0.48, 0.44, 0.012, 0.004, Zg.STEELM, -0.74, RY + 0.22, -0.228);
      for (var i = 0; i < 4; i++) c.rod(new V3(-0.96 + i * 0.15, RY + 0.47, -0.22), new V3(-0.96 + i * 0.15, RY + 0.47, 0.22), 0.008, MT.steel);
      [1, -1].forEach(function (s) { ZG.jerry(c, -0.45, 0.6, s * 0.3, s > 0 ? "#8e2a20" : "#3e5a34"); });
      c.rb(0.42, 0.06, 0.3, 0.02, Zg.STEELM, 0.05, 0.25, 0);
      roofLamp(c, 0.6, 1.05, 0.13); roofLamp(c, 0.6, 1.05, -0.13);
    };
  });
})(window.ZG);
