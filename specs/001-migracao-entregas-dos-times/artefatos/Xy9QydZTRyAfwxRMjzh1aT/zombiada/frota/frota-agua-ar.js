/* Água e ar · barcos, aviões e helicópteros (v4: refeitos com medidas reais).
   Só usa a API de window.ZG (veja API.md). As funções de casco, asa, fuselagem, hélice, rotor e luzes de navegação
   ficam aqui (não no núcleo) e são expostas em ZG.EA para frota-barcos-novos.js. */
(function (ZG) {
  "use strict";
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM, paintCol = ZG.paintCol, G = ZG.geo, DS = THREE.DoubleSide, clamp = ZG.clamp;

  /* ================= utilitários locais (grupo E) ================= */
  /* cor por vértice numa geometria pronta: fn(x, y, z) -> THREE.Color */
  function colorize(geo, fn) {
    var p = geo.attributes.position, col = new Float32Array(p.count * 3);
    for (var i = 0; i < p.count; i++) { var cc = fn(p.getX(i), p.getY(i), p.getZ(i)); col[3 * i] = cc.r; col[3 * i + 1] = cc.g; col[3 * i + 2] = cc.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); return geo;
  }
  function mix(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  /* interpola tabela [[t, v], ...] (t crescente) com suavização */
  function tab(T) { return function (t) { if (t <= T[0][0]) return T[0][1]; for (var i = 1; i < T.length; i++) if (t <= T[i][0]) { var k = (t - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); k = k * k * (3 - 2 * k); return mix(T[i - 1][1], T[i][1], k); } return T[T.length - 1][1]; }; }
  function tabL(T) { return function (t) { if (t <= T[0][0]) return T[0][1]; for (var i = 1; i < T.length; i++) if (t <= T[i][0]) { var k = (t - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); return mix(T[i - 1][1], T[i][1], k); } return T[T.length - 1][1]; }; }

  /* ---- casco de barco por seções ----
     o: { x0 (popa), L, n, m1 (pontos quilha->quina), m2 (quina->borda), keel(t), chine(t)->[z,y], sheer(t)->[z,y], q (curva do fundo: 1 = V reto),
          fl (curva do costado: <1 abre para fora em cima), col(x,y,z) }   t = 0 na popa, 1 na roda de proa */
  function boatHull(o) {
    var n = o.n || 40, m1 = o.m1 || 6, m2 = o.m2 || 6, q = o.q || 1, fl = o.fl || 1, pos = [], col = [], idx = [];
    function sec(t) {
      var ky = o.keel(t), ch = o.chine(t), sh = o.sheer(t), pts = [];
      for (var i = 0; i <= m1; i++) { var s = i / m1; pts.push([ch[0] * s, ky + (ch[1] - ky) * Math.pow(s, q)]); }
      for (var j = 1; j <= m2; j++) { var s2 = j / m2; pts.push([ch[0] + (sh[0] - ch[0]) * Math.pow(s2, fl), ch[1] + (sh[1] - ch[1]) * s2]); }
      return pts;
    }
    var ring = 2 * (m1 + m2) + 1;
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = o.x0 + t * o.L, P = sec(t), row = [];
      for (var k = P.length - 1; k >= 1; k--) row.push([-P[k][0], P[k][1]]);
      P.forEach(function (p) { row.push(p); });
      row.forEach(function (p) { pos.push(x, p[1], p[0]); if (o.col) { var cc = o.col(x, p[1], p[0]); col.push(cc.r, cc.g, cc.b); } });
    }
    for (var a = 0; a < n; a++) for (var k2 = 0; k2 < ring - 1; k2++) { var p0 = a * ring + k2, p1 = p0 + ring; idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1); }
    /* espelho de popa */
    var ci = pos.length / 3, sh0 = o.sheer(0), ky0 = o.keel(0);
    pos.push(o.x0, (sh0[1] + ky0) / 2, 0); if (o.col) { var c0 = o.col(o.x0, (sh0[1] + ky0) / 2, 0); col.push(c0.r, c0.g, c0.b); }
    for (var r = 0; r < ring - 1; r++) idx.push(ci, r + 1, r);
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    if (o.col) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g = G.crease(g, o.crease || 38);
    var H = { geo: g, o: o, sec: sec,
      t: function (x) { return clamp((x - o.x0) / o.L, 0, 1); },
      /* meia-boca do casco na altura y (por dentro, para pisos e conveses não vazarem) */
      half: function (x, y) {
        var t = H.t(x), P = sec(t);
        if (y <= P[0][1]) return 0;
        for (var i = 1; i < P.length; i++) if (y <= P[i][1]) { var k = (y - P[i - 1][1]) / Math.max(1e-6, P[i][1] - P[i - 1][1]); return mix(P[i - 1][0], P[i][0], k); }
        return P[P.length - 1][0];
      },
      sheerAt: function (x) { var s = o.sheer(H.t(x)); return { z: s[0], y: s[1] }; }
    };
    return H;
  }
  /* convés (ou piso) que acompanha o casco: de x0 a x1, altura y(x) (padrão: borda), coroa no meio, recuo da borda */
  function deckGeo(H, x0, x1, o) {
    o = o || {}; var n = o.n || 24, m = o.m || 10, pos = [], idx = [], strips = o.inner ? [-1, 1] : [0];
    strips.forEach(function (sd) {
      var base = pos.length / 3;
      for (var i = 0; i <= n; i++) {
        var x = x0 + (x1 - x0) * i / n, y = o.y ? o.y(x) : H.sheerAt(x).y, hw = Math.max(0.002, (o.y ? H.half(x, y) : H.sheerAt(x).z) - (o.inset || 0)), zin = o.inner ? Math.max(0, Math.min(hw - 0.01, o.inner(x))) : 0;
        for (var j = 0; j <= m; j++) {
          var u = j / m, z = sd === 0 ? (u * 2 - 1) * hw : sd * (zin + (hw - zin) * u);
          var cr = (o.crown || 0) * (1 - Math.pow(z / hw, 2));
          pos.push(x, y + cr + (o.lift || 0), z);
        }
      }
      for (var a2 = 0; a2 < n; a2++) for (var k = 0; k < m; k++) { var p0 = base + a2 * (m + 1) + k, p1 = p0 + m + 1; if (sd < 0) idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1); else idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
    });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    return G.crease(g, 40);
  }
  /* friso ao longo da borda (ou de outra altura relativa) */
  function sheerTube(c, H, x0, x1, r, mat, o) {
    o = o || {}; var pts = [], n = o.n || 30;
    [1, -1].forEach(function (s) {
      pts = [];
      for (var i = 0; i <= n; i++) { var x = x0 + (x1 - x0) * i / n, sh = H.sheerAt(x), y = sh.y + (o.dy || 0), z = (o.dy ? H.half(x, y) : sh.z) + (o.dz || 0); pts.push([x, y, s * z]); }
      if (o.closeBow) pts.push([x1 + 0.02, H.sheerAt(x1).y + (o.dy || 0), 0]);
      c.tube(pts, r, mat, { seg: o.seg || 80, rs: o.rs || 8 });
    });
  }

  /* ---- aerofólio (asa, empenagem, pá) ----
     sts: [{ p: [x, y, z] do bordo de ataque, c: corda, t: espessura relativa, cam: arqueamento }] ao longo da envergadura.
     o.up: "y" (asa, espessura em y) ou "z" (deriva, espessura em z). Corda sempre para -x. */
  function foilGeo(sts, o) {
    o = o || {}; var n = o.n || 12, up = o.up || "y", pos = [], idx = [], ring, cnt = 0;
    function prof(st) {
      var out = [], cam = st.cam || 0;
      for (var i = n; i >= 0; i--) { var u = (1 - Math.cos(i / n * PI)) / 2; out.push([u, 1]); }
      for (var j = 1; j < n; j++) { var u2 = (1 - Math.cos(j / n * PI)) / 2; out.push([u2, -1]); }
      return out.map(function (q) {
        var u = q[0], yt = 5 * st.t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1036 * u * u * u * u), cm = cam * 4 * u * (1 - u);
        var off = (q[1] * yt + cm) * st.c, x = st.p[0] - u * st.c;
        return up === "y" ? [x, st.p[1] + off, st.p[2]] : [x, st.p[1], st.p[2] + off];
      });
    }
    sts.forEach(function (st) { var P = prof(st); ring = P.length; P.forEach(function (p) { pos.push(p[0], p[1], p[2]); }); });
    for (var a = 0; a < sts.length - 1; a++) for (var k = 0; k < ring; k++) { var k1 = (k + 1) % ring, p0 = a * ring + k, p1 = (a + 1) * ring + k, q0 = a * ring + k1, q1 = (a + 1) * ring + k1; idx.push(p0, q0, p1, q0, q1, p1); }
    [0, sts.length - 1].forEach(function (si, e) {
      if (sts[si].noCap) return;
      var ci = pos.length / 3, st = sts[si]; pos.push(st.p[0] - st.c * 0.35, st.p[1], st.p[2]);
      for (var k = 0; k < ring; k++) { var a0 = si * ring + k, a1 = si * ring + (k + 1) % ring; if (e === 0) idx.push(ci, a1, a0); else idx.push(ci, a0, a1); }
    });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); void cnt;
    return G.crease(g, o.crease || 55);
  }
  /* fuselagem: estações [x, yBaixo, yCima, largura, expoente, zCentro] suavizadas; col(x,y,z) opcional */
  function fuseGeo(st, o) { o = o || {}; var g = G.sloft(st, { smooth: o.smooth || 48, seg: o.seg || 30, p: o.p || 2.4, crease: o.crease || 70 }); if (o.col) colorize(g, o.col); return g; }
  /* casca interna de vidro: mesma fuselagem um pouco menor, recortada para ficar só a janela */
  function fuseGlass(c, st, keep, label, type, o) {
    o = o || {}; var k = o.k || 0.988;
    var st2 = st.map(function (s) { var cy = (s[1] + s[2]) / 2, hh = (s[2] - s[1]) / 2 * k; return [s[0], cy - hh, cy + hh, s[3] * k, s[4], s[5]]; });
    var m = new THREE.Mesh(fuseGeo(st2, { smooth: o.smooth || 48, seg: o.seg || 30 }), o.mat || MT.glass); c.g.add(m);
    ZG.cutMesh(m, [keep], 40);
    if (o.M) m.geometry.applyMatrix4(o.M);
    return ZG.asGlass(c, m, label, type || "laminado", o.pos ? { pos: o.pos } : {});
  }
  /* faixa de pintura: casca 0,4% maior recortada (borda nítida) */
  function fuseSkin(c, st, keep, mat, o) {
    o = o || {}; var k = o.k || 1.004;
    var st2 = st.map(function (s) { var cy = (s[1] + s[2]) / 2, hh = (s[2] - s[1]) / 2 * k; return [s[0], cy - hh, cy + hh, s[3] * k, s[4], s[5]]; });
    var m = c.add(fuseGeo(st2, { smooth: o.smooth || 48, seg: o.seg || 30 }), mat, 0, 0, 0, o.parent); m.castShadow = false;
    ZG.cutMesh(m, [keep], 40); c.deform.push(m); return m;
  }
  function bandT(f) { return { sdf: f }; }
  /* testes de recorte: dentro da caixa (cut) / fora da caixa (keep); zMin limita a só um lado */
  function inBox(b) { return function (x, y, z) { return Math.max(b[0] - x, x - b[1], b[2] - y, y - b[3], (b[4] == null ? -9 : b[4]) - Math.abs(z), Math.abs(z) - (b[5] == null ? 9 : b[5])); }; }
  function cutT(b, sel) { return { sel: sel || null, sdf: inBox(b) }; }
  function keepT(b, sel) { var f = inBox(b); return { sel: sel || null, sdf: function (x, y, z) { return -f(x, y, z); } }; }
  /* janela por polígono no plano x-y (lado), recorte só em faces laterais */
  function polySdf(poly) {
    return function (x, y) {
      var inside = false, d = 1e9;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var a = poly[i], b = poly[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
        var vx = b[0] - a[0], vy = b[1] - a[1], wx = x - a[0], wy = y - a[1], t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
        d = Math.min(d, Math.hypot(wx - vx * t, wy - vy * t));
      }
      return inside ? -d : d;
    };
  }
  function sideCutP(poly, zMin) { var f = polySdf(poly); return { sel: function (n) { return Math.abs(n.z) > 0.3; }, sdf: function (x, y, z) { return Math.max(f(x, y), (zMin || 0) - Math.abs(z)); } }; }
  function sideKeepP(poly, zMin, side) { var f = polySdf(poly); return { sdf: function (x, y, z) { return -Math.max(f(x, y), (zMin || 0) - (side ? side * z : Math.abs(z))); } }; }

  /* ---- hélice: pás torcidas e afiladas, cubo e spinner. Grupo externo rígido (inclinação), interno gira em x ---- */
  function propeller(c, x, y, z, o) {
    o = o || {}; var R = o.R || 0.95, nb = o.blades || 2, mat = o.mat || CM("#232426", { roughness: 0.5, metalness: 0.3 }), tip = o.tip === false ? null : CM(o.tip || "#d8d8d2", { roughness: 0.5 });
    var outer = new THREE.Group(); outer.position.set(x, y, z); if (o.pitch) outer.rotation.z = o.pitch; outer.userData.rigid = true; (o.parent || c.g).add(outer);
    var g = new THREE.Group(); outer.add(g);
    for (var i = 0; i < nb; i++) {
      var piv = new THREE.Group(); piv.rotation.x = i / nb * PI * 2 + (o.phase || 0.4); g.add(piv);
      var bl = G.rbox(0.035, R - 0.08, o.chord || 0.15, 0.012); bl.translate(0, (R - 0.08) / 2 + 0.08, 0);
      var p = bl.attributes.position;
      for (var k = 0; k < p.count; k++) {
        var yy = p.getY(k), t = yy / R, ch = 1 - 0.45 * t - (t > 0.85 ? (t - 0.85) * 2.5 : 0), tw = (o.tw0 || 0.75) - 0.5 * t, zz = p.getZ(k) * ch, xx = p.getX(k);
        p.setXYZ(k, xx * Math.cos(tw) - zz * Math.sin(tw), yy, xx * Math.sin(tw) + zz * Math.cos(tw));
      }
      bl.computeVertexNormals();
      var b = new THREE.Mesh(bl, mat); b.castShadow = true; piv.add(b);
      if (tip) { var tp = new THREE.Mesh(G.rbox(0.04, 0.1, (o.chord || 0.15) * 0.55, 0.012), tip); tp.position.y = R - 0.06; tp.rotation.y = -((o.tw0 || 0.75) - 0.5); piv.add(tp); }
    }
    if (o.spinner !== false) {
      var sl = o.spinL || 0.36, sr = o.spinR || 0.15, sp = new THREE.Mesh(new THREE.SphereGeometry(sr, 20, 12, 0, PI * 2, 0, PI / 2), CM(o.spinCol || "#d9d7d0", { metalness: 0.35, roughness: 0.35 }));
      sp.rotation.z = -PI / 2; sp.scale.set(1, sl / sr, 1); g.add(sp);
      var bp = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr, 0.06, 20), CM(o.spinCol || "#d9d7d0", { metalness: 0.35, roughness: 0.35 })); bp.rotation.z = PI / 2; bp.position.x = -0.03; g.add(bp);
    }
    c.spin.push({ o: g, axis: "x", v: o.v == null ? 7 : o.v });
    return g;
  }
  /* rotor principal: pás com perfil fino e ponta, cubo, pratos e hastes; o.axis "y" (padrão) */
  function mainRotor(c, x, y, z, o) {
    o = o || {}; var nb = o.blades || 2, R = o.R || 5, ch = o.chord || 0.27, mat = o.mat || CM("#1e2023", { roughness: 0.5 }), hub = o.hub || 0.25;
    var g = new THREE.Group(); g.position.set(x, y, z); c.g.add(g);
    for (var i = 0; i < nb; i++) {
      var piv = new THREE.Group(); piv.rotation.y = i / nb * PI * 2 + (o.phase || 0.3); g.add(piv);
      var L = R - hub, geo = foilGeo([{ p: [ch / 3, 0, hub], c: ch, t: 0.12 }, { p: [ch / 3, -(o.droop || 0) * 0.3, hub + L * 0.5], c: ch, t: 0.12 }, { p: [ch / 3, -(o.droop || 0), R], c: ch, t: 0.1 }], { up: "y", n: 6 });
      geo.rotateY(PI / 2); /* envergadura ao longo de +x */
      var b = new THREE.Mesh(geo, mat); b.castShadow = true; piv.add(b);
      if (o.tipCol) { var tp = new THREE.Mesh(G.rbox(0.25, ch * 0.105, ch * 0.96, 0.008), CM(o.tipCol, { roughness: 0.5 })); tp.position.set(R - 0.14, -(o.droop || 0) * 0.97, ch / 6); piv.add(tp); }
      var grip = new THREE.Mesh(G.rbox(hub + 0.2, 0.08, 0.1, 0.03), MT.steel); grip.position.x = (hub + 0.2) / 2; piv.add(grip);
    }
    var hb = new THREE.Mesh(new THREE.CylinderGeometry(o.hubR || 0.13, o.hubR || 0.13, 0.16, 16), MT.steel); g.add(hb);
    if (o.cap) { var cp = new THREE.Mesh(new THREE.SphereGeometry(o.hubR || 0.13, 14, 8, 0, PI * 2, 0, PI / 2), MT.steel); cp.position.y = 0.08; g.add(cp); }
    c.spin.push({ o: g, axis: "y", v: o.v || 3.2 });
    return g;
  }
  /* rotor de cauda: grupo no ponto, gira em z (pás no plano x-y), lado +1/-1 só para a posição do cubo */
  function tailRotorE(c, x, y, z, o) {
    o = o || {}; var nb = o.blades || 2, R = o.R || 0.73, ch = o.chord || 0.12, mat = o.mat || CM("#e6e4dd", { roughness: 0.5 });
    var g = new THREE.Group(); g.position.set(x, y, z); c.g.add(g);
    for (var i = 0; i < nb; i++) {
      var p = new THREE.Group(); p.rotation.z = i / nb * PI * 2 + (o.phase || 0.6); g.add(p);
      var b = new THREE.Mesh(G.rbox(ch, R - 0.06, 0.018, 0.008), mat); b.position.y = (R - 0.06) / 2 + 0.06; b.rotation.y = 0.2; b.castShadow = true; p.add(b);
      if (o.tipCol) { var t = new THREE.Mesh(G.rbox(ch * 1.03, 0.12, 0.02, 0.006), CM(o.tipCol)); t.position.y = R - 0.06; p.add(t); }
    }
    var hb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), MT.steel); hb.rotation.x = PI / 2; g.add(hb);
    c.spin.push({ o: g, axis: "z", v: o.v || 12 });
    return g;
  }
  /* luz de navegação/posição: lente sobre lâmpada emissiva, quebra como lanterna */
  var NAV = {
    vermelha: CM("#9a1c14", { emissive: new THREE.Color("#e0281c"), emissiveIntensity: 1.3, roughness: 0.3 }),
    verde: CM("#1d7a3a", { emissive: new THREE.Color("#2fe06a"), emissiveIntensity: 1.2, roughness: 0.3 }),
    branca: CM("#f2f0e8", { emissive: new THREE.Color("#fff6dc"), emissiveIntensity: 1.4, roughness: 0.3 }),
    ambar: CM("#c8781e", { emissive: new THREE.Color("#ffa030"), emissiveIntensity: 1.2, roughness: 0.3 }),
    azul: CM("#1d4f9a", { emissive: new THREE.Color("#3a7cff"), emissiveIntensity: 1.4, roughness: 0.3 })
  };
  var HALO = { vermelha: "#ff3a2a", verde: "#3aff7a", branca: "#fff1d0", ambar: "#ffb040", azul: "#4a8cff" };
  function navLight(c, x, y, z, cor, label, o) {
    o = o || {}; var r = o.r || 0.045, g = new THREE.Group(); g.position.set(x, y, z); g.userData.rigid = true; (o.parent || c.g).add(g);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.2, r * 0.8, 12), MT.housing); base.position.y = -r * 0.4; if (o.rot) base.rotation.set(o.rot[0], o.rot[1], o.rot[2]); g.add(base);
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), NAV[cor] || NAV.branca); g.add(bulb);
    var lens = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), cor === "vermelha" ? MT.lensRed : cor === "ambar" ? MT.lensAmber : MT.lens); lens.renderOrder = 3; g.add(lens);
    var L = { g: g, inner: [bulb], lens: [lens], kind: o.front ? "farol" : "lanterna", tint: cor === "vermelha" ? "red" : "clear", broken: false };
    if (o.halo !== false) L.halo = [ZG.halo(g, 0, 0, 0, o.hs || 0.35, HALO[cor] || "#ffffff", 0.5)];
    c.lights.push(L);
    var pt = c.part(o.front ? "farol" : "lanterna", label, g, new V3(x, y, z), o.reach || 0.5); pt.light = L;
    return L;
  }
  /* farol de pouso/holofote redondo, apontando para +x (ou rotY) */
  function lamp(c, x, y, z, r, label, o) {
    o = o || {};
    return ZG.headlight(c, { style: "round", x: x, y: y, z: z, w: r * 2, h: r * 2, d: o.d || 0.08, side: z >= 0 ? 1 : -1, yaw: o.yaw || 0, label: label, reach: o.reach || 0.6 });
  }
  /* Achata um grupo montado à parte (ex.: avião inclinado de cauda baixa) para filhos diretos de c.g,
     preservando a pose (o núcleo amassa, dobra e acha peças só nos filhos diretos de c.g). */
  function bake(c, grp) {
    grp.updateMatrix(); var M = grp.matrix;
    grp.children.slice().forEach(function (o) {
      o.updateMatrix(); var m = new THREE.Matrix4().multiplyMatrices(M, o.matrix);
      grp.remove(o); m.decompose(o.position, o.quaternion, o.scale);
      /* malha: a rotação vai para os vértices (caixa envolvente justa para as zonas e o assentamento); a posição fica */
      if (o.isMesh && o.geometry) { o.geometry.applyMatrix4(new THREE.Matrix4().compose(new V3(), o.quaternion, o.scale)); o.geometry.computeBoundingBox(); o.quaternion.identity(); o.scale.set(1, 1, 1); }
      c.g.add(o);
    });
    if (grp.parent) grp.parent.remove(grp);
  }
  /* painel de avião/helicóptero: tampo escuro, relógios redondos e telas */
  function instPanel(c, x, y, w, o) {
    o = o || {}; var h = o.h || 0.26, tilt = o.tilt || 0.15;
    c.rb(0.16, h, w, 0.04, CM("#232427", { roughness: 0.8 }), x, y, 0, { rot: [0, 0, tilt] });
    c.rb(0.26, 0.04, w + 0.04, 0.015, CM("#18191b", { roughness: 0.9 }), x + 0.06, y + h / 2 + 0.01, 0);
    var nG = o.gauges || 6, nx = Math.ceil(nG / 2);
    for (var i = 0; i < nG; i++) {
      var col = i % nx, row = (i / nx) | 0, zz = (o.z0 == null ? -w * 0.32 : o.z0) + col * 0.095, yy = y + 0.05 - row * 0.1;
      var gg = c.cyl(0.038, 0.038, 0.012, MT.gauge, x - 0.085, yy, zz, "x", { seg: 16 }); gg.castShadow = false;
    }
    (o.screens || []).forEach(function (s) { var sc = c.rb(0.012, s[2], s[3], 0.008, MT.screen, x - 0.085, y + s[0], s[1]); sc.castShadow = false; });
  }
  /* manche de helicóptero (cíclico) e coletivo */
  function cyclic(c, x, fl, z) { c.rod(new V3(x, fl, z), new V3(x - 0.04, fl + 0.55, z), 0.014, MT.plastic); c.rb(0.04, 0.12, 0.04, 0.015, MT.plastic, x - 0.05, fl + 0.6, z); }
  function collective(c, x, fl, z) { c.rod(new V3(x - 0.35, fl + 0.18, z), new V3(x + 0.05, fl + 0.32, z), 0.016, MT.plastic); c.cyl(0.022, 0.022, 0.1, MT.plastic, x + 0.07, fl + 0.33, z, "x"); }
  function pedals(c, x, fl, z) { [-0.09, 0.09].forEach(function (d) { c.rb(0.05, 0.14, 0.08, 0.015, MT.steel, x, fl + 0.1, z + d, { rot: [0, 0, 0.5] }); }); }

  /* motor de popa: grupo rígido preso no espelho (x = espelho, y = topo do espelho). k = escala (1 ≈ 40 hp, 1,7 ≈ 250 hp) */
  function outboard(c, x, y, z, o) {
    o = o || {}; var k = o.k || 1, col = CM(o.col || "#16181b", { roughness: 0.35, metalness: 0.25 }), low = CM(o.low || "#202224", { roughness: 0.4, metalness: 0.3 }), shaft = o.shaft || (k > 1.3 ? 0.66 : 0.52);
    var g = new THREE.Group(); g.position.set(x, y, z); g.userData.rigid = true; c.g.add(g);
    var P = { parent: g };
    c.rb(0.1, 0.16, 0.18 * k, 0.03, MT.steel, -0.02, -0.04, 0, P);
    var cw = c.rb(0.44 * k, 0.42 * k, 0.32 * k, 0.12 * k, col, -0.2 * k - 0.05, 0.16 * k, 0, Object.assign({ taper: { sx: 0.82, sz: 0.85, shift: -0.03 * k } }, P));
    c.rb(0.42 * k, 0.07 * k, 0.33 * k, 0.03 * k, CM(o.band || "#2a2c30", { roughness: 0.5 }), -0.2 * k - 0.05, -0.02 * k, 0, P);
    c.rb(0.17 * k, shaft, 0.11 * k, 0.04 * k, low, -0.16 * k, -shaft / 2 - 0.02, 0, P);
    c.rb(0.36 * k, 0.018, 0.2 * k, 0.008, low, -0.17 * k, -shaft - 0.01, 0, P);
    c.cyl(0.055 * k, 0.05 * k, 0.32 * k, low, -0.2 * k, -shaft - 0.09 * k, 0, "x", P);
    c.rb(0.16 * k, 0.12 * k, 0.025, 0.01, low, -0.18 * k, -shaft - 0.17 * k, 0, P);
    var pr = propeller(c, -0.38 * k, -shaft - 0.09 * k, 0, { R: 0.17 * k, blades: 3, chord: 0.11 * k, spinner: false, tip: false, mat: CM("#3a3c3f", { metalness: 0.6, roughness: 0.35 }), parent: g, v: 0, tw0: 0.9 });
    if (o.tiller) { c.rod(new V3(-0.05, 0.12 * k, 0), new V3(0.45, 0.2 * k, 0.05), 0.022, MT.plastic, P); c.cyl(0.03, 0.03, 0.14, MT.rubber, 0.47, 0.2 * k, 0.05, "x", P); }
    if (o.label) c.text(o.label, 0.26 * k, 0.07 * k, -0.2 * k - 0.05, 0.2 * k, 0.165 * k, "+z", { fg: o.lc || "#d8d8d8", parent: g });
    if (o.label) c.text(o.label, 0.26 * k, 0.07 * k, -0.2 * k - 0.05, 0.2 * k, -0.165 * k, "-z", { fg: o.lc || "#d8d8d8", parent: g });
    g.userData.cowl = cw; g.userData.prop = pr;
    return g;
  }
  /* cunho de amarração e luz de navegação de proa (bicolor) */
  function cleat(c, x, y, z, r) { r = r || 1; c.rb(0.16 * r, 0.03, 0.04, 0.012, MT.chrome, x, y + 0.04, z); c.rb(0.04, 0.04, 0.03, 0.01, MT.chrome, x, y + 0.02, z); }
  /* pele pintada sobre uma malha pronta (faixa de casco): cópia um pouco inflada em z, recortada pelo teste keep */
  function skinOf(c, mesh, keep, mat, o) {
    o = o || {}; var g = mesh.geometry.clone(), p = g.attributes.position, sz = o.sz || 1.006, dy = o.dy || 0;
    for (var i = 0; i < p.count; i++) { p.setZ(i, p.getZ(i) * sz); p.setY(i, p.getY(i) + dy * Math.sign(p.getY(i))); }
    if (g.attributes.color) g.deleteAttribute("color");
    var m = c.add(g, mat, mesh.position.x, mesh.position.y, mesh.position.z); m.castShadow = false;
    ZG.cutMesh(m, [keep], 40, o.sub ? { sub: o.sub } : undefined); c.deform.push(m); return m;
  }
  /* para-brisa envolvente: pontos em planta [x, z] (base), altura h, recuo do topo, em y0; vidro temperado com moldura */
  function wrapShield(c, pts, y0, h, rake, label, o) {
    o = o || {}; var pos = [], idx = [], n = pts.length;
    pts.forEach(function (q) { pos.push(q[0], y0, q[1], q[0] - rake, y0 + h, q[1] * (o.pinch || 0.97)); });
    for (var i = 0; i < n - 1; i++) { var a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    var m = c.add(g, o.mat || MT.glass); var top = pts.map(function (q) { return [q[0] - rake, y0 + h, q[1] * (o.pinch || 0.97)]; });
    if (o.frame !== false) c.tube(top, 0.014, o.frameMat || MT.chrome, { seg: 40, rs: 6 });
    return ZG.asGlass(c, m, label, o.type || "temperado", o.pos ? { pos: o.pos } : {});
  }
  /* guarda-mancebo / balaústre de inox: tubo por pontos com pés a cada passo */
  function rail(c, pts, h, r, every) {
    var top = pts.map(function (p) { return [p[0], p[1] + h, p[2]]; }); c.tube(top, r || 0.016, MT.chrome, { seg: 60, rs: 6 });
    pts.forEach(function (p, i) { if (i % (every || 2) === 0) c.rod(new V3(p[0], p[1], p[2]), new V3(p[0], p[1] + h, p[2]), (r || 0.016) * 0.75, MT.chrome, { seg: 6 }); });
  }
  /* tubo de raio variável por pontos (bote inflável, defensa): rf(u) dá o raio em u = 0..1 */
  function sweepGeo(pts, rf, o) {
    o = o || {}; var n = o.n || 80, rs = o.rs || 16, curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new V3(p[0], p[1], p[2]); }), false, "centripetal");
    var pos = [], idx = [], up = new V3(0, 1, 0), T = new V3(), N = new V3(), B = new V3(), P = new V3();
    for (var i = 0; i <= n; i++) {
      var u = i / n; curve.getPointAt(u, P); curve.getTangentAt(u, T);
      B.crossVectors(T, up); if (B.lengthSq() < 1e-6) B.set(0, 0, 1); B.normalize(); N.crossVectors(B, T).normalize();
      var r = rf(u);
      for (var j = 0; j <= rs; j++) { var a = j / rs * PI * 2, cs = Math.cos(a), sn = Math.sin(a); pos.push(P.x + (N.x * cs + B.x * sn) * r, P.y + (N.y * cs + B.y * sn) * r, P.z + (N.z * cs + B.z * sn) * r); }
    }
    for (var a2 = 0; a2 < n; a2++) for (var k = 0; k < rs; k++) { var p0 = a2 * (rs + 1) + k, p1 = p0 + rs + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
    [0, n].forEach(function (ii, e) { curve.getPointAt(ii / n, P); var ci = pos.length / 3; pos.push(P.x, P.y, P.z); for (var k = 0; k < rs; k++) { var a0 = ii * (rs + 1) + k; if (e === 0) idx.push(ci, a0, a0 + 1); else idx.push(ci, a0 + 1, a0); } });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* nome pintado no costado: plano girado na tangente do casco e afastado o bastante para as pontas não entrarem na curva da proa (revisor) */
  function hullText(c, H, txt, w, h, x, y, s, o) {
    o = o || {}; var d = 0.05, m = (H.half(x + d, y) - H.half(x - d, y)) / (2 * d), z0 = H.half(x, y), off = o.off || 0.012;
    for (var i = -4; i <= 4; i++) { var xi = x + i / 8 * w, dy = [-h / 2, 0, h / 2]; dy.forEach(function (e) { var g = H.half(xi, y + e) - (z0 + m * (xi - x)); if (g + 0.008 > off) off = g + 0.008; }); }
    var t = c.text(txt, w, h, x, y, s * (z0 + off), s > 0 ? "+z" : "-z", o); t.rotation.y += s > 0 ? -Math.atan(m) : Math.atan(m); return t;
  }
  ZG.EA = { colorize: colorize, tab: tab, tabL: tabL, mix: mix, sstep: sstep, boatHull: boatHull, deckGeo: deckGeo, sheerTube: sheerTube, foilGeo: foilGeo, fuseGeo: fuseGeo, fuseGlass: fuseGlass, fuseSkin: fuseSkin, bandT: bandT,
    cutT: cutT, keepT: keepT, sideCutP: sideCutP, sideKeepP: sideKeepP, polySdf: polySdf, propeller: propeller, mainRotor: mainRotor, tailRotor: tailRotorE, navLight: navLight, lamp: lamp, bake: bake,
    instPanel: instPanel, sweepGeo: sweepGeo, skinOf: skinOf, wrapShield: wrapShield, rail: rail, outboard: outboard, hullText: hullText, cleat: cleat, cyclic: cyclic, collective: collective, pedals: pedals, NAV: NAV };

  /* ================= barcos ================= */
  /* Referência · Levefort Marajó (barco de alumínio com motor de popa) — medidas de memória (a ficha do fabricante não apareceu na busca)
     Medidas reais: comprimento 5,00 m · boca 1,60 m · pontal 0,58 m · calado ≈ 0,15 m · borda livre ≈ 0,42 m · chapa de alumínio de 2 mm ·
     3 bancos transversais · motor de popa de 15 a 40 hp com rabeta curta e cana de leme.
     Traços de assinatura:
       frente: proa em V fino que sobe pouco, pequeno convés de proa com cunho, friso de alumínio grosso na borda
       lateral: borda quase reta, costado de chapa lisa com linhas de rebite, fundo semichato, espelho de popa reto e baixo com motor de cana
       traseira: espelho largo e reto com reforço central, motor preto com rabeta, tanque vermelho portátil no fundo
       teto: casco aberto com três bancos de alumínio, cavernas no fundo, proa afilada a partir de 60% do comprimento */
  ZG.register({ k: "voadeira", grp: "Aquáticos", n: "Levfort Marajó", insp: "Levefort Marajó", art: "na", c: "Barco de alumínio com motor de popa", fuel: "gasolina",
    d: "Barco de alumínio de fundo semichato, o táxi dos rios. Leve, rápido e barulhento.",
    mass: 150, r: 90, seats: "5", cap: "25 L (tanque portátil)", eff: "≈ 9 L/h (30 hp)", auto: "≈ 70 km", vmax: 50, skill: "Náutica 1", hood: false
  }, function (c) {
    var EA = ZG.EA, tb = EA.tab, alu = CM("#9aa1a6", { metalness: 0.65, roughness: 0.38, side: DS }), aluD = CM("#7d8489", { metalness: 0.6, roughness: 0.45, side: DS });
    var L = 5.0, x0 = -2.5;
    var H = EA.boatHull({ x0: x0, L: L, n: 40, m1: 5, m2: 6, q: 1.2, fl: 0.9,
      keel: tb([[0, -0.15], [0.55, -0.16], [0.85, -0.02], [1, 0.36]]),
      chine: function (t) { return [tb([[0, 0.62], [0.55, 0.62], [0.9, 0.3], [1, 0.0]])(t), tb([[0, -0.1], [0.55, -0.1], [0.85, 0.06], [1, 0.38]])(t)]; },
      sheer: function (t) { return [tb([[0, 0.755], [0.6, 0.772], [0.88, 0.49], [1, 0.0]])(t), tb([[0, 0.42], [0.7, 0.43], [1, 0.52]])(t)]; },
      col: null });
    var hull = c.add(H.geo, c.paint("#9aa1a6", { metalness: 0.65, roughness: 0.38 })); c.deform.push(hull);
    /* friso de borda, quinas, linhas de rebite e cavernas */
    EA.sheerTube(c, H, x0 + 0.02, 2.46, 0.028, aluD, { closeBow: true });
    for (var x = -2.2; x < 1.4; x += 0.45) { var hw = H.half(x, -0.06); c.rb(0.035, 0.035, hw * 2 - 0.05, 0.01, aluD, x, -0.08, 0); }
    [1, -1].forEach(function (s) {
      var pts = []; for (var i = 0; i <= 16; i++) { var xx = x0 + 0.1 + i / 16 * 3.9; pts.push([xx, 0.2, s * (H.half(xx, 0.2) + 0.004)]); }
      c.tube(pts, 0.006, aluD, { seg: 40, rs: 4 });
      EA.hullText(c, H, "MARAJÓ", 0.8, 0.14, 0.9, 0.3, s, { fg: "#1e2a33" });
    });
    /* piso de compensado, bancos de alumínio (seção em L), convés de proa */
    var fy = -0.07, flr = c.add(EA.deckGeo(H, -2.35, 1.5, { y: function () { return fy; }, inset: 0.03, n: 16, m: 6 }), CM("#5c4a35", { roughness: 0.9, side: DS })); flr.castShadow = false;
    [-1.55, -0.15, 1.05].forEach(function (x) { var hw = H.half(x, 0.3) - 0.01; c.rb(0.3, 0.035, hw * 2, 0.01, alu, x, 0.3, 0); c.rb(0.03, 0.34, H.half(x, -0.02) * 2 - 0.04, 0.01, alu, x - 0.14, 0.13, 0); c.seatTops.push({ x: x, y: 0.32, z: 0, w: hw * 2 - 0.1, l: 0.3 }); });
    var bd = c.add(EA.deckGeo(H, 1.75, 2.48, { n: 8, m: 8, crown: 0.02, lift: -0.005 }), alu); c.deform.push(bd);
    EA.cleat(c, 2.15, 0.48, 0, 0.8);
    /* espelho reforçado, motor de popa 30 hp com cana, tanque portátil, remo */
    c.rb(0.06, 0.5, 0.42, 0.02, aluD, x0 + 0.05, 0.18, 0);
    var mot = EA.outboard(c, x0, 0.44, 0, { k: 0.85, tiller: true, label: "30 HP" });
    var tank = c.rb(0.48, 0.24, 0.3, 0.06, CM("#a3241c", { roughness: 0.5 }), -2.05, 0.06, -0.38);
    c.rod(new V3(-2.0, 0.18, -0.38), new V3(-2.3, 0.4, -0.1), 0.01, CM("#1b1b1b"));
    c.rb(1.8, 0.03, 0.1, 0.01, MT.wood, -0.6, 0.0, 0.5, { rot: [0.3, 0, 0] }); c.rb(0.35, 0.03, 0.14, 0.02, MT.wood, 0.45, 0.0, 0.5, { rot: [0.3, 0, 0] });
    /* lanterna branca de popa (mastro removível) e bicolor de proa */
    c.rod(new V3(-2.35, 0.42, 0.6), new V3(-2.35, 1.1, 0.6), 0.012, MT.chrome); EA.navLight(c, -2.35, 1.13, 0.6, "branca", "Luz de popa (mastro)", { r: 0.035 });
    EA.navLight(c, 2.3, 0.53, 0.06, "verde", "Luz de proa boreste (verde)", { r: 0.03 }); EA.navLight(c, 2.3, 0.53, -0.06, "vermelha", "Luz de proa bombordo (vermelha)", { r: 0.03 });
    c.part("casco", "Casco", hull, new V3(0, -0.05, 0), 1.6); c.part("popa", "Motor de popa", mot, new V3(-2.75, 0.4, 0), 0.9); c.part("tanque", "Tanque portátil", tank, new V3(-2.05, 0.06, -0.38), 0.6);
    Object.assign(c.meta, { kind: "boat", L: L, W: 1.6, front: 2.5, rear: -2.95, clear: -0.16, belt: 0.43, bodyH: 0.6, top: 0.6, roof: null });
    c.zone("conves", "Bancos, piso e convés de proa");
    c.zone("lanterna_c", "Luzes de navegação de proa"); c.zone("lanterna_d", "Luz de popa");
    c.meta.armor = function (c2) {
      /* modificado: chapas de aço rebitadas no costado, gaiola de arame na frente do piloto, galões e holofote no banco da proa */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { for (var x2 = -2.1; x2 < 1.3; x2 += 0.7) c2.rb(0.66, 0.3, 0.015, 0.01, stl, x2 + 0.33, 0.6, s * (H.half(x2 + 0.33, 0.42) + 0.01)); });
      for (var z = -0.6; z <= 0.61; z += 0.15) c2.rod(new V3(-1.3, 0.32, z), new V3(-1.25, 1.05, z * 0.9), 0.008, stl);
      c2.rod(new V3(-1.27, 1.05, -0.55), new V3(-1.27, 1.05, 0.55), 0.015, stl);
      [0.25, -0.05, -0.35].forEach(function (z, i) { ZG.jerry(c2, -0.7, 0.04, z, i % 2 ? "#3e5a34" : "#8e2a20"); });
      c2.cyl(0.1, 0.08, 0.16, MT.steel, 1.25, 0.42, 0, "x"); EA.lamp(c2, 1.33, 0.42, 0.0001, 0.07, "Holofote");
    };
  });

  /* Referência · Fibrafort Focker 240/242 GTO (WebSearch: itboat "Focker 242 GTO Outboard"; a 240 é a geração anterior do mesmo casco)
     Medidas reais: comprimento 7,26 m · boca 2,59 m · calado 0,40 m · tanque 140 L · até 10 pessoas · um motor de popa de 200 a 250 hp ·
     V de 21° no espelho · borda livre ≈ 0,8 m na popa e ≈ 1,0 m na proa (de memória).
     Traços de assinatura:
       frente: proa aberta (bowrider) com estofados em U, guarda-mancebo de inox curto, luz bicolor na roda de proa, V fundo
       lateral: tosado que sobe para a proa, faixa gráfica escura em cunha, friso preto, para-brisa envolvente baixo e inclinado
       traseira: espelho com motor de popa grande preto, plataformas de banho dos dois lados, escada de inox, mastro de luz branca
       teto: dois consoles (piloto à direita, passageiro à esquerda) com passagem central no para-brisa, sofá em L na popa */
  ZG.register({ k: "lancha", grp: "Aquáticos", n: "Foker 240", insp: "Focker 240", art: "na", c: "Lancha de 24 pés com proa aberta", fuel: "gasolina",
    d: "Casco em V fundo e um motor de popa de 250 hp. Rota de fuga pela represa com a família inteira.",
    mass: 1490, r: 110, seats: "10", cap: "140 L", eff: "≈ 50 L/h (cruzeiro)", auto: "≈ 110 km", vmax: 85, skill: "Náutica 2", hood: false
  }, function (c) {
    var EA = ZG.EA, tb = EA.tab, L = 7.26, x0 = -3.63;
    var white = c.paint("#ecebe5", { roughness: 0.3, metalness: 0.1 }), navy = c.paint("#1f2f4a", { roughness: 0.3, metalness: 0.1 }), vinyl = CM("#e3ddd0", { roughness: 0.65 }), vinylD = CM("#3c4a5c", { roughness: 0.65 }), teak = CM("#8a6a45", { roughness: 0.8 });
    var H = EA.boatHull({ x0: x0, L: L, n: 44, m1: 6, m2: 6, q: 0.85, fl: 0.75,
      keel: tb([[0, -0.4], [0.5, -0.42], [0.8, -0.3], [0.95, 0.22], [1, 0.95]]),
      chine: function (t) { return [tb([[0, 1.05], [0.55, 1.1], [0.85, 0.72], [1, 0.0]])(t), tb([[0, -0.02], [0.6, 0.0], [0.9, 0.38], [1, 0.95]])(t)]; },
      sheer: function (t) { return [tb([[0, 1.27], [0.55, 1.29], [0.8, 1.06], [0.95, 0.45], [1, 0.0]])(t), tb([[0, 0.78], [0.6, 0.83], [1, 1.03]])(t)]; } });
    var hull = c.add(H.geo, white); c.deform.push(hull);
    /* fundo com tinta antiincrustante, faixa gráfica em cunha e filete */
    EA.skinOf(c, hull, EA.bandT(function (x, y) { return 0.02 - y; }), c.paint("#2a3340", { roughness: 0.5 }), { sz: 1.004, dy: 0.003 });
    /* revisor: cunha refeita como curva lisa (filete fino na popa que engrossa até a amura e termina em ponta arredondada), recortada em malha subdividida */
    EA.skinOf(c, hull, EA.bandT(function (x, y, z) { var yc = 0.34 + (x + 3.6) * 0.055 - EA.sstep(0.6, 2.3, x) * 0.05, hw = 0.018 + 0.11 * EA.sstep(-1.6, 1.3, x), tip = (2.3 - x) * 0.35; return Math.min(Math.min(hw, tip) - Math.abs(y - yc), x + 3.55, Math.abs(z) - 0.3); }), navy, { sz: 1.006, sub: 0.05 });
    EA.sheerTube(c, H, x0 + 0.01, 3.6, 0.035, CM("#141516", { roughness: 0.6 }), { closeBow: true });
    /* borda (capa) e conveses laterais, convés de proa com paiol de âncora */
    var side = c.add(EA.deckGeo(H, x0 + 0.05, 2.6, { inner: function (x) { return H.sheerAt(x).z - 0.2; }, n: 30, m: 3 }), white); c.deform.push(side);
    var bow = c.add(EA.deckGeo(H, 2.6, 3.62, { n: 10, m: 8, crown: 0.03 }), white); c.deform.push(bow);
    c.rb(0.4, 0.02, 0.35, 0.01, CM("#cfcfc8"), 3.0, H.sheerAt(3.0).y + 0.03, 0); EA.cleat(c, 3.3, H.sheerAt(3.3).y, 0, 0.8);
    /* piso do cockpit (antiderrapante), estofados da proa em U, sofá em L na popa */
    var fy = 0.22, flr = c.add(EA.deckGeo(H, -3.5, 2.75, { y: function () { return fy; }, inset: 0.02, n: 24, m: 8 }), CM("#d6d2c6", { roughness: 0.85, side: DS })); flr.castShadow = false;
    [1, -1].forEach(function (s) {
      for (var x = 1.55; x < 2.65; x += 0.3) { var hw = H.half(x, 0.5) - 0.08; c.rb(0.3, 0.2, 0.42, 0.06, vinyl, x, 0.45, s * (hw - 0.2), { rot: [0, s * 0.15, 0] }); }
      c.rb(0.9, 0.35, 0.12, 0.05, vinyl, 2.05, 0.68, s * (Math.min(H.half(1.6, 0.5), H.half(2.5, 0.5)) - 0.08)); /* revisor: encosto pela meia-boca mais estreita da base, para não furar o costado na proa */
      c.rb(2.3, 0.22, 0.5, 0.07, vinyl, -2.3, 0.45, s * 0.75); c.rb(2.3, 0.4, 0.12, 0.05, vinyl, -2.3, 0.72, s * (H.half(-2.3, 0.7) - 0.08));
    });
    c.rb(0.5, 0.22, 1.5, 0.07, vinyl, -3.35, 0.45, 0); c.rb(0.12, 0.42, 2.1, 0.05, vinyl, -3.52, 0.74, 0);
    c.seatTops.push({ x: -2.3, y: 0.57, z: 0.75, w: 0.5, l: 2.2 }, { x: -2.3, y: 0.57, z: -0.75, w: 0.5, l: 2.2 }, { x: 2.0, y: 0.57, z: 0, w: 1.2, l: 0.9 });
    /* consoles: piloto à direita com painel, volante e manete; passageiro à esquerda com porta-luvas */
    var cy = 0.22;
    c.rb(0.85, 0.72, 0.78, 0.12, white, 0.75, cy + 0.36, 0.72); c.rb(0.85, 0.72, 0.72, 0.12, white, 0.75, cy + 0.36, -0.74);
    c.rb(0.42, 0.04, 0.7, 0.015, CM("#18191b", { roughness: 0.7 }), 0.95, cy + 0.74, 0.72, { rot: [0, 0, -0.35] });
    [0.55, 0.72, 0.89].forEach(function (z, i) { c.cyl(0.045, 0.045, 0.012, MT.gauge, 0.93 + (i === 1 ? 0.05 : 0), cy + 0.79, z, null, { seg: 16 }).rotation.set(0, 0, 1.22); });
    c.rb(0.012, 0.13, 0.2, 0.01, MT.screen, 0.86, cy + 0.83, 0.72, { rot: [0, 0, -0.35] });
    var wh = c.add(new THREE.TorusGeometry(0.17, 0.02, 8, 26), MT.chrome, 0.55, cy + 0.82, 0.62); wh.rotation.set(0, PI / 2, -0.55);
    c.rod(new V3(0.62, cy + 0.72, 0.62), new V3(0.55, cy + 0.82, 0.62), 0.02, MT.chrome);
    c.rod(new V3(0.55, cy + 0.7, 0.98), new V3(0.42, cy + 0.88, 1.0), 0.015, MT.chrome); c.sph(0.035, MT.plastic, 0.42, cy + 0.9, 1.0);
    ZG.seat(c, -0.1, cy, 0.72, { w: 0.55, h: 0.42, back: 0.48, lean: 0.12, mat: vinyl, headrest: false });
    ZG.seat(c, -0.1, cy, -0.74, { w: 0.55, h: 0.42, back: 0.48, lean: 0.12, mat: vinyl, headrest: false });
    /* para-brisa envolvente com passagem central */
    [1, -1].forEach(function (s) {
      var pts = []; for (var i = 0; i <= 8; i++) { var u = i / 8, z = s * (0.32 + u * 0.85), x = 1.2 - u * u * 0.45; pts.push([x, z]); }
      EA.wrapShield(c, pts, cy + 0.72, 0.36, 0.22, "Para-brisa " + (s > 0 ? "direito" : "esquerdo"), { pos: new V3(1.05, cy + 0.9, s * 0.7) });
    });
    /* guarda-mancebo de proa, escada e plataformas de banho */
    [1, -1].forEach(function (s) {
      var pts = []; for (var i = 0; i <= 6; i++) { var x = 2.5 + i * 0.17, sh = H.sheerAt(x); pts.push([x, sh.y + 0.02, s * (sh.z - 0.08)]); }
      EA.rail(c, pts, 0.3, 0.015, 2);
      c.rb(0.55, 0.06, 0.55, 0.02, teak, x0 - 0.27, 0.27, s * 0.78);
      EA.navLight(c, 3.5, 1.06, s * 0.05, s > 0 ? "verde" : "vermelha", "Luz de proa " + (s > 0 ? "boreste (verde)" : "bombordo (vermelha)"), { r: 0.03 });
      EA.hullText(c, H, "FOKER 240", 0.9, 0.16, -1.6, 0.6, s, { fg: "#1f2f4a" });
    });
    [0, 1, 2].forEach(function (k) { c.rb(0.03, 0.02, 0.3, 0.01, MT.chrome, x0 - 0.42, 0.1 - k * 0.15, -0.78); });
    c.rod(new V3(x0 - 0.42, 0.28, -0.92), new V3(x0 - 0.42, -0.25, -0.92), 0.012, MT.chrome); c.rod(new V3(x0 - 0.42, 0.28, -0.64), new V3(x0 - 0.42, -0.25, -0.64), 0.012, MT.chrome);
    c.rod(new V3(-3.4, 0.82, 1.15), new V3(-3.4, 1.65, 1.15), 0.015, MT.chrome); EA.navLight(c, -3.4, 1.68, 1.15, "branca", "Luz de alcançado (mastro)", { r: 0.035 });
    /* motor de popa 250 hp */
    var mot = EA.outboard(c, x0, 0.8, 0, { k: 1.7, label: "250", col: "#121315" });
    c.part("casco", "Casco", hull, new V3(0.5, -0.2, 0), 1.8); c.part("popa", "Motor de popa", mot, new V3(-4.1, 0.9, 0), 1.0); c.part("tanque", "Tanque (140 L)", null, new V3(-1.2, 0.05, 0), 0.8);
    Object.assign(c.meta, { kind: "boat", L: L, W: 2.59, front: 3.63, rear: -4.5, clear: -0.42, belt: 0.82, bodyH: 1.2, top: 1.35, roof: null });
    c.zone("conves", "Cockpit, consoles e estofados", null, null, { alsoGlass: true });
    c.zone("lanterna_c", "Luzes de navegação de proa"); c.zone("lanterna_d", "Luz de alcançado");
    c.meta.armor = function (c2) {
      /* modificado: chapas de aço na borda, grade sobre o para-brisa, galões no sofá, holofote no console e arco de proteção */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { for (var x2 = -3.3; x2 < 2.4; x2 += 0.75) { var sh = H.sheerAt(x2 + 0.35); c2.rb(0.72, 0.42, 0.015, 0.01, stl, x2 + 0.35, sh.y + 0.18, s * (sh.z + 0.01)); } });
      for (var z = -1.1; z <= 1.11; z += 0.14) c2.rod(new V3(1.25, 0.95, z), new V3(0.95, 1.4, z * 0.95), 0.008, stl);
      [[-2.3, 0.75], [-2.3, -0.75], [-2.0, 0.75]].forEach(function (q, i) { ZG.jerry(c2, q[0], 0.78, q[1], i % 2 ? "#3e5a34" : "#8e2a20"); });
      c2.tube([[-1.4, 0.82, -1.25], [-1.4, 1.9, -1.0], [-1.4, 2.0, 0], [-1.4, 1.9, 1.0], [-1.4, 0.82, 1.25]], 0.035, stl, { seg: 30 });
      EA.lamp(c2, -1.3, 2.0, 0.0001, 0.08, "Holofote no arco");
    };
  });

  /* Referência · traineira / barco de pesca artesanal de madeira do litoral brasileiro (genérico, medidas de memória)
     Medidas reais: comprimento 11,0 m · boca 3,6 m · calado 1,2 m (com quilha e talão) · pontal 1,9 m · borda livre ≈ 0,95 m a meio-navio,
     ≈ 1,9 m na proa · casaria de 2,0 x 2,2 m à ré · motor de centro diesel de 90 a 120 hp · porão de peixe a meio-navio.
     Traços de assinatura:
       frente: roda de proa alta e lançada, tosado forte que sobe para a proa, nome pintado na amura, âncora no escovém
       lateral: casco de tábuas pintado em três cores (azul, filete branco, vermelho no fundo), pneus de defensa pendurados,
                casaria de madeira à ré com janelas pequenas, mastro de vante com pau de carga, chaminé atrás da casaria
       traseira: popa de painel estreita com leme externo, luz branca, bandeirola no mastro da casaria
       teto: convés aberto a vante com escotilha do porão, guincho de tambor, rede amontoada e caixas de peixe */
  ZG.register({ k: "pesqueiro", grp: "Aquáticos", n: "Traineira Esperança", insp: "barco de pesca artesanal", art: "em um", c: "Traineira de madeira", fuel: "diesel",
    d: "Casco de madeira com casaria a ré e pneus de defensa. Dá para morar nele, longe da margem.",
    mass: 12000, r: 80, seats: "10", cap: "1.200 L", eff: "≈ 14 L/h", auto: "≈ 900 km", vmax: 18, skill: "Náutica 2", hood: false
  }, function (c) {
    var EA = ZG.EA, tb = EA.tab, L = 11.0, x0 = -5.5;
    var blue = c.paint("#2f5e86", { roughness: 0.7, metalness: 0.05 }), wht = c.paint("#e6e3da", { roughness: 0.7, metalness: 0.05 }), redP = c.paint("#7a2219", { roughness: 0.8, metalness: 0.05 }), wood = CM("#6b4a2e", { roughness: 0.85 }), deckW = CM("#8a6e4c", { roughness: 0.9, side: DS });
    var H = EA.boatHull({ x0: x0, L: L, n: 48, m1: 7, m2: 6, q: 0.45, fl: 0.9,
      keel: tb([[0, -0.95], [0.12, -1.0], [0.75, -1.0], [0.92, -0.4], [1, 1.6]]),
      chine: function (t) { return [tb([[0, 1.15], [0.2, 1.55], [0.6, 1.62], [0.85, 1.05], [1, 0.0]])(t), tb([[0, -0.15], [0.25, -0.45], [0.7, -0.45], [0.9, 0.3], [1, 1.6]])(t)]; },
      sheer: function (t) { return [tb([[0, 1.3], [0.2, 1.72], [0.55, 1.8], [0.85, 1.3], [0.97, 0.35], [1, 0.0]])(t), tb([[0, 1.3], [0.45, 0.98], [0.75, 1.15], [1, 1.95]])(t)]; } });
    var hull = c.add(H.geo, blue); c.deform.push(hull);
    EA.skinOf(c, hull, EA.bandT(function (x, y) { return 0.05 - y; }), redP, { sz: 1.004, dy: 0.004 });
    EA.skinOf(c, hull, EA.bandT(function (x, y) { var sy = H.sheerAt(x).y; return 0.07 - Math.abs(y - (sy - 0.18)); }), wht, { sz: 1.006 });
    /* tábuas: linhas finas ao longo do costado */
    [1, -1].forEach(function (s) {
      [0.25, 0.5, 0.75].forEach(function (yy) { var pts = []; for (var i = 0; i <= 20; i++) { var x = x0 + 0.2 + i / 20 * 9.9, y = yy * H.sheerAt(x).y - (1 - yy) * 0.3; pts.push([x, y, s * (H.half(x, y) + 0.004)]); } c.tube(pts, 0.006, CM("#22476a"), { seg: 60, rs: 4 }); });
      EA.hullText(c, H, "ESPERANÇA", 1.7, 0.3, 2.4, H.sheerAt(2.4).y - 0.42, s, { fg: "#f2efe6" });
      /* pneus de defensa */
      [-3.6, -1.2, 1.2].forEach(function (x) { var y = H.sheerAt(x).y - 0.45, tr = c.add(new THREE.TorusGeometry(0.28, 0.1, 10, 22), MT.rubber, x, y, s * (H.half(x, y) + 0.1)); tr.rotation.y = PI / 2; c.rod(new V3(x, y + 0.28, s * (H.half(x, y) + 0.08)), new V3(x, H.sheerAt(x).y, s * H.sheerAt(x).z), 0.01, CM("#9b8a62")); });
    });
    /* borda falsa: capa de madeira, convés de tábuas, escotilha do porão, guincho, rede, caixas */
    EA.sheerTube(c, H, x0 + 0.02, 5.45, 0.07, wood, { closeBow: true });
    var dk = function (x) { return H.sheerAt(x).y - 0.55; };
    var deck = c.add(EA.deckGeo(H, x0 + 0.1, 5.1, { y: dk, inset: 0.05, n: 40, m: 10 }), deckW); deck.castShadow = false;
    for (var x = x0 + 0.4; x < 4.8; x += 0.18) { var hw = H.half(x, dk(x)) - 0.06; if (hw > 0.1) c.rb(0.012, 0.004, hw * 2, 0.002, CM("#5c4630"), x, dk(x) + 0.004, 0).castShadow = false; }
    c.rb(1.4, 0.25, 1.4, 0.05, wood, 0.6, dk(0.6) + 0.12, 0); c.rb(1.2, 0.05, 1.2, 0.02, CM("#4a3a28"), 0.6, dk(0.6) + 0.27, 0);
    c.cyl(0.25, 0.25, 0.8, CM("#5a5e60", { metalness: 0.4 }), -0.6, dk(-0.6) + 0.45, 0, "z"); c.rb(0.4, 0.4, 0.15, 0.05, CM("#3a3c3e"), -0.6, dk(-0.6) + 0.25, 0.5);
    c.sph(0.6, CM("#2f4a2c", { roughness: 1 }), 2.4, dk(2.4) + 0.2, 0.5, 1.6, 0.45, 1.1); c.sph(0.45, CM("#3d5b37", { roughness: 1 }), 3.2, dk(3.2) + 0.18, -0.4, 1.3, 0.45, 1.0);
    [[1.6, -1.0], [1.6, -0.55], [1.95, -1.0]].forEach(function (q) { c.rb(0.42, 0.24, 0.32, 0.03, CM("#3f6fa0", { roughness: 0.6 }), q[0], dk(q[0]) + 0.12, q[1]); });
    /* casaria de madeira a ré, oca, com janelas recortadas, porta, telhado e interior */
    var hx = -2.7, hy0 = dk(hx), hh = 1.9, hw2 = 1.1, cas = c.rb(2.0, hh, hw2 * 2, 0.08, wht, hx, hy0 + hh / 2, 0, { def: true });
    var cutF = { sel: function (n) { return n.x > 0.5; }, sdf: function (x, y, z) { return Math.max(0.15 - y, y - 0.62, Math.abs(z) - 0.85, Math.max(0.05 - Math.abs(z - 0.3), 0.05 - Math.abs(z + 0.3))); } };
    ZG.cutMesh(cas, [EA.sideCutP([[-0.85, 0.2], [-0.25, 0.2], [-0.25, 0.6], [-0.85, 0.6]], 0.5), EA.sideCutP([[0.15, 0.2], [0.75, 0.2], [0.75, 0.6], [0.15, 0.6]], 0.5), cutF,
      { sel: function (n, ce) { return Math.abs(n.x) > 0.5 && ce.x < 0; }, sdf: function (x, y, z) { return Math.max(-0.88 - y, y - 0.68, Math.abs(z - 0.3) - 0.35); } }]);
    var fw = c.rb(0.016, 0.47, 1.7, 0.01, MT.glass, hx + 1.0, hy0 + hh / 2 + 0.385, 0); ZG.asGlass(c, fw, "Janelas de vante da casaria", "temperado");
    [-0.3, 0.3].forEach(function (z) { c.rb(0.03, 0.5, 0.1, 0.01, wht, hx + 1.0, hy0 + hh / 2 + 0.385, z); });
    [1, -1].forEach(function (s) {
      [-0.55, 0.45].forEach(function (dx) { var gp = c.rb(0.6, 0.4, 0.016, 0.03, MT.glass, hx + dx, hy0 + hh / 2 + 0.4, s * (hw2 - 0.04)); ZG.asGlass(c, gp, "Janela " + (dx < 0 ? "de ré " : "de vante ") + (s > 0 ? "boreste" : "bombordo"), "temperado"); });
      /* luzes de navegação em caixas na casaria */
      c.rb(0.25, 0.18, 0.06, 0.02, CM("#151617"), hx + 0.7, hy0 + hh - 0.25, s * (hw2 + 0.04));
      EA.navLight(c, hx + 0.7, hy0 + hh - 0.25, s * (hw2 + 0.08), s > 0 ? "verde" : "vermelha", "Luz de bordo " + (s > 0 ? "boreste (verde)" : "bombordo (vermelha)"), { r: 0.045 });
    });
    c.rb(2.4, 0.1, 2.5, 0.04, blue, hx, hy0 + hh + 0.05, 0);
    var door = c.rb(0.05, 1.5, 0.66, 0.02, CM("#5a3e26"), hx - 1.3, hy0 + 0.8, 0.68, { rot: [0, 1.3, 0] }); void door;
    /* interior: timão de madeira, painel, bússola, rádio, banco e beliche */
    var inner = CM("#b9a888", { roughness: 0.9 });
    c.rb(0.4, 0.95, 1.9, 0.03, wood, hx + 0.75, hy0 + 0.48, 0); c.rb(0.42, 0.03, 1.9, 0.01, CM("#2a2b2c"), hx + 0.75, hy0 + 0.97, 0);
    [-0.45, 0.45].forEach(function (z) { c.cyl(0.05, 0.05, 0.012, MT.gauge, hx + 0.66, hy0 + 1.0, z, null, { seg: 16 }); });
    c.sph(0.07, CM("#c9b26a", { metalness: 0.5, roughness: 0.3 }), hx + 0.7, hy0 + 1.05, 0, 1, 0.6, 1); c.rb(0.2, 0.12, 0.25, 0.02, MT.plastic, hx + 0.75, hy0 + 1.6, -0.6);
    var whl = new THREE.Group(); whl.position.set(hx + 0.5, hy0 + 1.15, 0); whl.userData.rigid = true; c.g.add(whl);
    var rim = c.add(new THREE.TorusGeometry(0.26, 0.022, 8, 28), MT.wood, 0, 0, 0, whl); rim.rotation.y = PI / 2;
    for (var sp = 0; sp < 8; sp++) { var a8 = sp / 8 * PI * 2; c.rod(new V3(0, 0, 0), new V3(0, Math.cos(a8) * 0.36, Math.sin(a8) * 0.36), 0.014, MT.wood, { parent: whl }); }
    c.cyl(0.05, 0.05, 0.14, MT.wood, 0.06, 0, 0, "x", { parent: whl });
    ZG.seat(c, hx - 0.05, hy0, 0, { w: 0.5, h: 0.55, back: 0.45, mat: inner, headrest: false });
    c.rb(1.8, 0.12, 0.65, 0.04, CM("#7c5a3b"), hx - 0.2, hy0 + 0.5, -0.72); c.rb(1.7, 0.08, 0.55, 0.04, CM("#6b7c8f", { roughness: 1 }), hx - 0.2, hy0 + 0.6, -0.72);
    c.rb(1.9, 0.02, 2.1, 0.01, inner, hx, hy0 + hh - 0.06, 0).castShadow = false;
    /* chaminé, mastro da casaria com luz de topo, mastro de vante com pau de carga, âncora, leme */
    c.cyl(0.1, 0.1, 1.2, MT.trim, hx - 0.75, hy0 + hh + 0.6, 0.65); c.cyl(0.13, 0.1, 0.1, MT.trim, hx - 0.75, hy0 + hh + 1.22, 0.65);
    c.rod(new V3(hx + 0.4, hy0 + hh + 0.1, 0), new V3(hx + 0.4, hy0 + hh + 1.6, 0), 0.04, wood); EA.navLight(c, hx + 0.4, hy0 + hh + 1.65, 0, "branca", "Luz de mastro", { r: 0.05 });
    c.rb(0.02, 0.25, 0.4, 0.01, CM("#c8a02a"), hx + 0.4, hy0 + hh + 1.35, 0.22);
    var mx = 2.2; c.rod(new V3(mx, dk(mx), 0), new V3(mx, dk(mx) + 4.2, 0), 0.07, wood); c.rod(new V3(mx, dk(mx) + 3.6, -0.8), new V3(mx, dk(mx) + 3.6, 0.8), 0.04, wood);
    c.rod(new V3(mx, dk(mx) + 1.4, 0), new V3(-0.4, dk(-0.4) + 2.3, 0), 0.05, wood); c.rod(new V3(mx, dk(mx) + 4.0, 0), new V3(-0.4, dk(-0.4) + 2.3, 0), 0.008, CM("#9b8a62"));
    c.rod(new V3(-0.4, dk(-0.4) + 2.3, 0), new V3(-0.4, dk(-0.4) + 0.6, 0), 0.006, CM("#9b8a62")); c.sph(0.07, MT.head, mx, dk(mx) + 4.25, 0);
    /* âncora no escovém de boreste */
    var ax = 4.4, ay = H.sheerAt(ax).y - 0.3, az = H.half(ax, ay) + 0.04, anc = CM("#2e3032", { metalness: 0.5, roughness: 0.5 });
    c.rod(new V3(ax, ay + 0.2, az), new V3(ax, ay - 0.25, az), 0.025, anc); c.tube([[ax - 0.2, ay - 0.12, az], [ax, ay - 0.27, az], [ax + 0.2, ay - 0.12, az]], 0.022, anc, { seg: 12 }); c.rod(new V3(ax - 0.12, ay + 0.15, az), new V3(ax + 0.12, ay + 0.15, az), 0.018, anc);
    c.rb(0.5, 1.1, 0.06, 0.02, wood, x0 - 0.2, -0.45, 0); c.cyl(0.03, 0.03, 1.6, MT.steel, x0 - 0.02, 0.0, 0);
    EA.navLight(c, x0 + 0.05, H.sheerAt(x0).y + 0.15, 0, "branca", "Luz de popa", { r: 0.045 });
    c.part("casco", "Casco", hull, new V3(0, -0.5, 0), 2.4); c.part("motor", "Motor de centro (diesel)", null, new V3(-2.7, 0.0, 0), 1.2); c.part("tanque", "Tanque de diesel", null, new V3(-3.6, 0.1, 0.8), 1.0);
    Object.assign(c.meta, { kind: "boat", L: L, W: 3.6, front: 5.5, rear: -5.75, clear: -1.0, belt: 1.0, bodyH: 2.0, top: 2.75, roof: { x0: hx - 1.0, x1: hx + 1.0, w: 2.2, y: hy0 + hh + 0.1 } });
    c.zone("conves", "Convés, casaria e mastros", null, null, { alsoGlass: true });
    c.zone("vidros_t", "Janelas de vante da casaria"); c.zone("vidros_e", "Janelas de bombordo"); c.zone("vidros_d", "Janelas de boreste");
    c.zone("lanterna_d", "Luz de bordo de boreste"); c.zone("lanterna_e", "Luz de bordo de bombordo"); c.zone("lanterna_c", "Luzes de mastro e de popa");
    c.meta.armor = function (c2) {
      /* modificado: chapas de aço soldadas na casaria, grade nas janelas, arame farpado na borda e tambores extras de diesel */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { c2.rb(2.0, 0.9, 0.02, 0.02, stl, hx, hy0 + 0.6, s * (hw2 + 0.02)); for (var x2 = hx - 0.9; x2 <= hx + 0.9; x2 += 0.12) c2.rod(new V3(x2, hy0 + 1.15, s * (hw2 + 0.04)), new V3(x2, hy0 + 1.7, s * (hw2 + 0.04)), 0.008, stl); });
      for (var z = -0.85; z <= 0.86; z += 0.12) c2.rod(new V3(hx + 1.03, hy0 + 1.15, z), new V3(hx + 1.03, hy0 + 1.65, z), 0.008, stl);
      [1, -1].forEach(function (s) { var pts = []; for (var i = 0; i <= 30; i++) { var x2 = x0 + 0.3 + i / 30 * 9.5, sh = H.sheerAt(x2); pts.push([x2, sh.y + 0.18 + 0.03 * Math.sin(i * 2.1), s * (sh.z - 0.03)]); } c2.tube(pts, 0.012, stl, { seg: 120, rs: 4 }); for (var k = 0; k <= 30; k += 3) c2.rod(new V3(pts[k][0], H.sheerAt(pts[k][0]).y, pts[k][2]), new V3(pts[k][0], pts[k][1], pts[k][2]), 0.015, stl); });
      [[-4.3, 0.9], [-4.3, -0.9], [-4.8, 0.0]].forEach(function (q) { c2.cyl(0.29, 0.29, 0.88, CM("#3e5a34", { roughness: 0.6 }), q[0], dk(q[0]) + 0.44, q[1]); });
    };
  });

  /* ================= aviões ================= */
  /* Referência · Cessna 172S Skyhawk (WebSearch: planeandpilotmag; medidas do POH, parte de memória)
     Medidas reais: comprimento 8,28 m · envergadura 11,00 m · altura 2,72 m (topo da deriva) · entre-eixos (bequilha-principal) 1,65 m ·
     bitola do trem principal 2,54 m · pneus 0,44 m (principal 6.00-6) e 0,38 m (bequilha 5.00-5) · hélice 1,93 m (2 pás) ·
     corda da asa 1,63 m na raiz e 1,12 m na ponta · profundor 3,45 m · cabine 1,12 m de largura externa · barriga a ~0,62 m do chão.
     Traços de assinatura:
       frente: capô curto com duas tomadas de ar redondas dos lados do spinner, hélice bipá, asa alta reta com montantes em V invertido
       lateral: asa alta sobre a cabine, montante único por lado do trem à asa, janela traseira "Omni-Vision" que desce atrás da asa,
                deriva enflechada com barbatana dorsal comprida, trem triciclo fixo com pernas de aço em arco e carenagens de roda
       traseira: profundor reto baixo, cone de cauda afinando, montantes formando V até a asa
       teto: asa retangular por dentro e afilada por fora, tanques com bocal no extradorso, profundor afilado com corte para o leme */
  ZG.register({ k: "monomotor", grp: "Aéreos", n: "Sesna 172", insp: "Cessna 172 Skyhawk", c: "Monomotor de asa alta, 4 lugares", fuel: "avgas",
    d: "Avião de aeroclube. Asa alta, trem fixo e quatro lugares. Precisa de pista livre de zumbis e de gasolina de aviação.",
    mass: 1157, r: 300, seats: "4", cap: "212 L (201 L utilizáveis)", eff: "36 L/h", auto: "1.185 km", vmax: 302, skill: "Pilotagem aérea 3", hood: false
  }, function (c) {
    var EA = ZG.EA, white = "#ecebe6";
    var paintW = c.paint(white);
    var ST = [[2.30, 0.98, 1.46, 0.70, 2.4], [2.15, 0.88, 1.55, 0.92, 2.6], [1.85, 0.80, 1.61, 1.02, 2.8], [1.45, 0.72, 1.65, 1.08, 3], [1.25, 0.68, 1.70, 1.11, 3],
      [0.95, 0.64, 1.90, 1.12, 3.2], [0.62, 0.62, 2.03, 1.12, 3.2], [0.0, 0.62, 2.04, 1.12, 3.2], [-0.95, 0.66, 2.03, 1.08, 3], [-1.4, 0.72, 1.93, 1.0, 2.8],
      [-2.0, 0.84, 1.77, 0.86, 2.6], [-3.0, 1.02, 1.63, 0.62, 2.4], [-4.2, 1.20, 1.56, 0.38, 2.2], [-5.2, 1.30, 1.52, 0.2, 2.2], [-5.62, 1.35, 1.50, 0.06, 2]];
    function yc(x) { return 1.12 + 0.3 * EA.sstep(1.6, -5.0, x); }
    var fus = c.add(EA.fuseGeo(ST), paintW);
    /* faixas: azul larga que sobe do capô à cauda e filete dourado acima */
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.055 - Math.abs(y - yc(x)), x - (-5.3), 2.2 - x, Math.abs(z) - 0.03); }), c.paint("#1f3d6e"));
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.01 - Math.abs(y - yc(x) - 0.085), x - (-5.3), 2.2 - x, Math.abs(z) - 0.03); }), c.paint("#b8862e"), { k: 1.005 });
    var wsK = [0.66, 1.29, 1.69, 2.2, null, 0.52], drP = [[1.2, 1.71], [0.12, 1.71], [0.12, 1.99], [0.64, 1.99]], rsP = [[0.0, 1.71], [-0.86, 1.73], [-0.86, 1.96], [0.0, 1.99]], rwK = [-1.72, -0.98, 1.83, 2.1, null, 0.42];
    ZG.cutMesh(fus, [EA.cutT(wsK, function (n) { return n.x > 0.15 && n.y > 0.1; }), EA.sideCutP(drP, 0.3), EA.sideCutP(rsP, 0.3), EA.cutT(rwK, function (n) { return n.y > 0.25; })], 40);
    c.deform.push(fus);
    EA.fuseGlass(c, ST, EA.keepT(wsK), "Para-brisa", "laminado", { pos: new V3(1.0, 1.85, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(drP, 0.3, s), "Janela da porta " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(0.6, 1.85, s * 0.56) });
      EA.fuseGlass(c, ST, EA.sideKeepP(rsP, 0.3, s), "Janela traseira " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(-0.45, 1.85, s * 0.55) });
    });
    EA.fuseGlass(c, ST, EA.keepT(rwK), "Vidro traseiro Omni-Vision", "laminado", { pos: new V3(-1.35, 1.95, 0) });
    /* molduras: coluna central do para-brisa, colunas da porta, costuras da porta e do capô */
    c.rod(new V3(1.27, 1.70, 0), new V3(0.66, 2.03, 0), 0.016, MT.trim);
    /* frestas das portas e do capô: filetes escuros na própria pele */
    var doorF = EA.polySdf([[1.24, 0.86], [0.1, 0.82], [0.1, 1.70], [0.12, 2.0], [0.64, 2.0], [1.24, 1.70]]);
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.007 - Math.abs(doorF(x, y)), Math.abs(z) - 0.3); }), MT.dark, { k: 1.003 });
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.006 - Math.abs(x - 1.47), y - 0.75); }), MT.dark, { k: 1.003 });
    [1, -1].forEach(function (s) {
      c.rb(0.12, 0.025, 0.035, 0.01, MT.chrome, 0.95, 1.36, s * 0.57);
      /* tomadas de ar do capô e escapamento */
      c.cyl(0.085, 0.085, 0.05, MT.dark, 2.29, 1.27, s * 0.23, "x", { seg: 18 });
      c.add(new THREE.TorusGeometry(0.085, 0.014, 6, 20), paintW, 2.31, 1.27, s * 0.23).rotation.y = PI / 2;
      c.text("PT-ZDA", 0.95, 0.22, -3.05, 1.36, s * 0.317, s > 0 ? "+z" : "-z", { fg: "#1f3d6e" });
    });
    c.cyl(0.03, 0.035, 0.22, MT.steel, 1.62, 0.78, 0.18, null, { seg: 10 }).rotation.z = -0.4;
    c.rb(0.5, 0.04, 0.3, 0.02, MT.dark, 2.05, 0.86, 0, { rot: [0, 0, 0.2] });
    /* interior: piso, 4 bancos, painel, manches, pedais, alavanca de potência, forro */
    var fl = 0.74, fab = CM("#4a463f", { roughness: 0.9 });
    c.rb(2.2, 0.03, 0.98, 0.01, MT.carpet, 0.2, fl, 0).castShadow = false;
    [0.26, -0.26].forEach(function (z) { ZG.seat(c, 0.38, fl, z, { w: 0.44, h: 0.34, back: 0.62, lean: 0.18, mat: fab }); EA.pedals(c, 1.18, fl, z); ZG.yoke(c, 0.98, 1.47, z); });
    ZG.seat(c, -0.52, fl, 0, { w: 0.96, n: 2, h: 0.34, back: 0.58, lean: 0.2, mat: fab });
    EA.instPanel(c, 1.1, 1.52, 1.0, { gauges: 6, z0: -0.38, screens: [[0.0, 0.12, 0.14, 0.22]] });
    c.rb(0.1, 0.1, 0.1, 0.02, MT.plastic, 1.0, 1.32, 0); c.cyl(0.018, 0.018, 0.1, MT.chrome, 0.93, 1.34, 0.02, "x"); c.sph(0.02, MT.plastic, 0.88, 1.34, 0.02);
    c.rb(1.6, 0.02, 1.0, 0.01, MT.headliner, -0.2, 2.0, 0).castShadow = false;
    c.rb(0.04, 0.14, 0.04, 0.01, MT.plastic, 0.9, 1.93, 0);
    /* asa alta: duas semiasas (zona por lado), retangular por dentro e afilada por fora, diedro 1,7° */
    var wingMat = c.paint(white);
    function semiAsa(s) {
      var dh = function (z) { return 2.135 + Math.max(0, z - 0.56) * 0.03; };
      var g = EA.foilGeo([{ p: [0.66, dh(0), 0], c: 1.63, t: 0.12, cam: 0.02 }, { p: [0.66, dh(2.6), s * 2.6], c: 1.63, t: 0.12, cam: 0.02 }, { p: [0.62, dh(5.2), s * 5.2], c: 1.14, t: 0.11, cam: 0.02 }, { p: [0.58, dh(5.5) + 0.02, s * 5.5], c: 0.98, t: 0.06, cam: 0.01 }], { up: "y", n: 14 });
      var w = c.add(g, wingMat); c.deform.push(w);
      /* ailerons e flapes: linhas de articulação, bocal do tanque, luz de navegação na ponta */
      [[0.62, 2.55, -0.65], [2.65, 5.0, -0.62]].forEach(function (q) { c.rb(0.012, 0.012, q[1] - q[0], 0.004, MT.dark, q[2], dh((q[0] + q[1]) / 2) + 0.075, s * (q[0] + q[1]) / 2).castShadow = false; });
      c.cyl(0.04, 0.04, 0.02, MT.steel, 0.35, dh(1.4) + 0.105, s * 1.4);
      EA.navLight(c, 0.36, dh(5.5) + 0.02, s * 5.53, s > 0 ? "verde" : "vermelha", "Luz de navegação " + (s > 0 ? "direita (verde)" : "esquerda (vermelha)"));
      /* montante da asa (perfilado) */
      var st = c.rod(new V3(0.12, 0.86, s * 0.55), new V3(0.3, 2.1, s * 2.55), 0.034, paintW); st.scale.x = 1.8;
      c.rb(0.16, 0.06, 0.08, 0.02, MT.steel, 0.12, 0.86, s * 0.56);
      return w;
    }
    semiAsa(1); semiAsa(-1);
    EA.lamp(c, 0.66, 2.12, -2.85, 0.06, "Farol de pouso (asa esquerda)");
    EA.lamp(c, 0.66, 2.12, -3.05, 0.05, "Farol de táxi (asa esquerda)");
    c.rod(new V3(0.3, 2.0, -3.6), new V3(0.75, 2.0, -3.6), 0.008, MT.steel);
    /* empenagem: profundor afilado, deriva enflechada com barbatana dorsal */
    var tailMat = c.paint(white);
    [1, -1].forEach(function (s) { var hs = c.add(EA.foilGeo([{ p: [-4.6, 1.42, 0], c: 1.2, t: 0.09 }, { p: [-4.95, 1.42, s * 1.72], c: 0.86, t: 0.08 }], { up: "y", n: 10 }), tailMat); c.deform.push(hs); });
    var fin = c.add(EA.foilGeo([{ p: [-4.25, 1.46, 0], c: 1.58, t: 0.09 }, { p: [-5.1, 2.64, 0], c: 0.74, t: 0.08 }], { up: "z", n: 10 }), tailMat); c.deform.push(fin);
    var dors = c.add(EA.foilGeo([{ p: [-2.85, 1.6, 0], c: 1.45, t: 0.04 }, { p: [-4.25, 1.98, 0], c: 0.3, t: 0.05 }], { up: "z", n: 8 }), tailMat); c.deform.push(dors);
    var finB = c.add(EA.foilGeo([{ p: [-4.24, 1.46, 0], c: 1.6, t: 0.1 }, { p: [-5.09, 2.645, 0], c: 0.76, t: 0.095 }], { up: "z", n: 10 }), c.paint("#1f3d6e")); finB.castShadow = false;
    ZG.cutMesh(finB, [EA.bandT(function (x, y) { var yy = 2.0 + (x + 5.0) * 0.55; return Math.min(0.13 - Math.abs(y - yy), 2.6 - y); })], 40); c.deform.push(finB);
    EA.navLight(c, -5.81, 1.58, 0, "branca", "Luz de cauda");
    EA.navLight(c, -5.2, 2.66, 0, "vermelha", "Farol anticolisão", { r: 0.04 });
    /* trem triciclo: pernas de mola em arco, carenagens de roda, bequilha com amortecedor */
    var pant = c.paint(white);
    [1, -1].forEach(function (s) {
      c.tube([[0.06, 0.66, s * 0.5], [0.05, 0.52, s * 0.82], [0.03, 0.34, s * 1.12], [0.02, 0.24, s * 1.22]], 0.032, MT.steel, { seg: 20 });
      c.wheel(0.02, s * 1.27, 0.22, 0.15, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#d9d7d0", { metalness: 0.4 }) });
      c.sph(0.26, pant, 0.0, 0.25, s * 1.27, 1.85, 1.05, 0.48, { tl: PI * 0.6, ws: 24, hs: 12 });
      c.rb(0.22, 0.03, 0.1, 0.01, MT.steel, 0.3, 0.55, s * 0.95);
    });
    c.rod(new V3(1.72, 0.92, 0), new V3(1.72, 0.25, 0), 0.04, MT.chrome); c.cyl(0.055, 0.055, 0.22, MT.steel, 1.72, 0.78, 0);
    c.wheel(1.72, 0.0001, 0.19, 0.13, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#d9d7d0", { metalness: 0.4 }) });
    c.sph(0.22, pant, 1.72, 0.22, 0, 1.75, 1.05, 0.42, { tl: PI * 0.6, ws: 24, hs: 12 });
    /* hélice bipá de 1,93 m e spinner */
    var pr = EA.propeller(c, 2.3, 1.22, 0, { R: 0.965, blades: 2, chord: 0.16, spinL: 0.2, spinR: 0.17 });
    /* antenas e pitot */
    c.rod(new V3(-0.4, 2.04, 0), new V3(-0.7, 2.35, 0), 0.008, MT.trim); 
    c.rod(new V3(0.4, 2.0, -1.9), new V3(0.75, 2.0, -1.9), 0.01, MT.steel);
    c.part("helice", "Hélice", pr, new V3(2.38, 1.22, 0), 0.9); c.part("motor", "Motor Lycoming (4 cilindros)", null, new V3(1.9, 1.2, 0), 0.9);
    c.part("tanque", "Tanques nas asas", null, new V3(0.2, 2.13, 1.6), 1.0); c.part("trem", "Trem de pouso", null, new V3(0.02, 0.4, 0), 1.2);
    Object.assign(c.meta, { kind: "plane", L: 8.28, W: 11.0, fusW: 1.12, front: 2.5, rear: -5.86, clear: 0.62, belt: 1.66, bodyH: 1.42, top: 2.7, roof: null });
    /* zonas: a cabine leva para-brisa e janelas; o nariz pega capô, tomadas e spinner */
    c.zone("cabine", "Cabine, portas e janelas", [-1.75, 1.3, 0.6, 2.12, -0.75, 0.75], null, { dir: "esquerda", fxKey: "cabineaero", who: "o piloto e os passageiros", anyMesh: true });
    c.zone("nariz", "Capô do motor e hélice", [1.3, 2.75, 0.7, 1.75, -0.7, 0.7], null, { onBand: function (c2, b) { if (b >= 4) pr.visible = false; } });  /* revisor: no arrancado a hélice sai inteira (o recorte do núcleo deixava pontas de pá soltas no ar) */
    c.zone("fuselagem", "Cone de cauda", [-4.2, -1.75, 0.8, 2.05, -0.6, 0.6]);
    c.zone("cauda", "Empenagem (deriva e profundor)", [-6.0, -4.2, 1.2, 2.8, -1.9, 1.9]);
    c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)");
    c.zone("lanterna_c", "Luz de cauda e anticolisão"); c.zone("farol_e", "Faróis de pouso e táxi");
    c.meta.armor = function (c2) {
      /* modificado de sobrevivência: casulo de carga ventral, holofote na asa, galões amarrados no banco de trás e grade no para-brisa */
      var pod = CM("#7d8278", { roughness: 0.6, metalness: 0.2 });
      var cp = c2.add(EA.fuseGeo([[1.2, 0.5, 0.64, 0.2, 2.2], [0.9, 0.42, 0.66, 0.5, 2.6], [-0.9, 0.42, 0.68, 0.58, 2.6], [-1.9, 0.56, 0.74, 0.3, 2.4], [-2.3, 0.66, 0.78, 0.06, 2]], { smooth: 20 }), pod);
      void cp;
      EA.lamp(c2, 0.72, 2.0, 3.2, 0.09, "Holofote de busca");
      [0.16, -0.16].forEach(function (z) { ZG.jerry(c2, -0.5, 1.32, z, "#8e2a20"); });
      for (var k = -0.4; k <= 0.41; k += 0.1) c2.rod(new V3(1.33, 1.72, k), new V3(0.7, 2.06, k * 0.9), 0.008, ZG.STEELM);
      c2.part("carga", "Casulo de carga", cp, new V3(-0.3, 0.55, 0), 0.9);
    };
  });

  /* Referência · Embraer EMB-202/203 Ipanema (WebSearch: Wikipedia "Embraer EMB 202 Ipanema"; o resto de memória)
     Medidas reais: comprimento 7,43 m (cauda erguida) · envergadura 11,69 m · altura 2,20 m (cauda no chão) · área da asa 19,94 m²
     (corda constante ≈ 1,71 m) · bitola do trem principal ≈ 2,2 m e pneus ≈ 0,66 m (de memória) · bequilha de 0,26 m ·
     hélice ≈ 2,1 m · atitude de cauda baixa ≈ 11° · tremonha de 950 L à frente da cabine · motor Lycoming IO-540 de 300 hp.
     Traços de assinatura:
       frente: capô quadrado com escapamentos laterais, cabine alta e estreita atrás da tremonha, asa baixa reta com diedro
       lateral: nariz empinado (trem convencional com bequilha), cabine envidraçada em degrau acima da fuselagem, de laterais retas e teto quase plano (revisor: seção mais quadrada), corta-fio no
                para-brisa e cabo defletor da cabine até a deriva, barra de pulverização sob o bordo de fuga, bomba de cata-vento sob a barriga
       traseira: deriva alta e reta com leme grande, profundor reto, barra de bicos de ponta a ponta
       teto: asa retangular sem afilamento, tampa amarela da tremonha à frente do para-brisa, fuselagem que afina depois da cabine */
  ZG.register({ k: "agricola", grp: "Aéreos", n: "Ipanemá EMB-203", insp: "Embraer Ipanema", c: "Monomotor agrícola a etanol", fuel: "etanol",
    d: "Avião de lavoura movido a etanol. Pousa em pista de terra e a barra de pulverização pode espalhar isca ou fogo.",
    mass: 1800, r: 300, seats: "1", cap: "264 L", eff: "≈ 75 L/h de etanol", auto: "940 km", vmax: 230, skill: "Pilotagem aérea 3", hood: false
  }, function (c) {
    var EA = ZG.EA, TH = 0.19, X0 = 0.3, Y0 = 1.0, cs = Math.cos(TH), sn = Math.sin(TH);
    function P(x, y, z) { return new V3(x * cs - y * sn + X0, x * sn + y * cs + Y0, z || 0); }
    var grp = new THREE.Group(); grp.position.set(X0, Y0, 0); grp.rotation.z = TH; c.g.add(grp); grp.updateMatrix();
    var yel = c.paint("#d9aa22"), grn = c.paint("#2f6b3a"), dark = CM("#232427", { roughness: 0.6 });
    /* fuselagem no referencial de voo (eixo em y = 0) */
    var ST = [[3.22, -0.28, 0.28, 0.58, 2.4], [3.0, -0.4, 0.38, 0.86, 2.8], [2.5, -0.46, 0.44, 0.98, 3.2], [2.0, -0.5, 0.56, 1.0, 3.4], [1.2, -0.54, 0.62, 1.02, 3.4],
      [0.45, -0.54, 0.66, 1.0, 3.2], [0.1, -0.52, 1.07, 0.98, 4.4], [-0.5, -0.48, 1.17, 0.94, 5], [-1.1, -0.42, 1.06, 0.86, 3.8], [-1.7, -0.33, 0.66, 0.74, 2.4],
      [-2.6, -0.15, 0.5, 0.48, 2.3], [-3.4, 0.0, 0.44, 0.24, 2.2], [-3.82, 0.1, 0.4, 0.07, 2]];
    var fus = c.add(EA.fuseGeo(ST), yel, 0, 0, 0, grp);
    var wsK = [0.02, 0.5, 0.64, 1.2, null, 0.44], swP = [[0.12, 0.62], [-1.0, 0.6], [-1.0, 1.0], [-0.55, 1.12], [0.04, 1.04]];
    ZG.cutMesh(fus, [EA.cutT(wsK, function (n) { return n.x > 0.2 && n.y > 0.05; }), EA.sideCutP(swP, 0.3)], 40);
    c.deform.push(fus);
    /* metade de baixo verde com filete, faixa verde no meio */
    EA.fuseSkin(c, ST, EA.bandT(function (x, y) { return Math.min(-0.12 - y, x + 3.7); }), grn, { parent: grp });
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.03 - Math.abs(y - 0.12 - (x < -1.5 ? (x + 1.5) * -0.08 : 0)), x + 3.6, 3.05 - x, Math.abs(z) - 0.05); }), grn, { parent: grp, k: 1.005 });
    /* cabine: piso, banco, manche, painel */
    var fl = -0.36;
    c.rb(1.3, 0.03, 0.8, 0.01, MT.carpet, -0.4, fl, 0, { parent: grp }).castShadow = false;
    ZG.seat(c, -0.55, fl, 0, { w: 0.5, h: 0.32, back: 0.66, lean: 0.12, mat: CM("#3a3530", { roughness: 0.9 }), parent: grp });
    c.rod(new V3(0.0, fl, 0), new V3(-0.06, fl + 0.55, 0), 0.016, MT.plastic, { parent: grp }); c.rb(0.04, 0.13, 0.05, 0.015, MT.plastic, -0.07, fl + 0.6, 0, { parent: grp });
    c.rb(0.16, 0.3, 0.8, 0.04, CM("#232427"), 0.36, 0.5, 0, { parent: grp, rot: [0, 0, 0.2] });
    [-0.24, -0.12, 0.0, 0.12, 0.24].forEach(function (z, i) { c.cyl(0.036, 0.036, 0.012, MT.gauge, 0.27, 0.55 - (i % 2) * 0.09, z, "x", { seg: 16, parent: grp }).castShadow = false; });
    /* armação da cabine (gaiola) e montantes do para-brisa */
    [1, -1].forEach(function (s) { c.rod(new V3(0.44, 0.66, s * 0.445), new V3(0.05, 1.05, s * 0.395), 0.014, dark, { parent: grp }); c.rod(new V3(-0.45, 0.62, s * 0.468), new V3(-0.45, 1.12, s * 0.43), 0.012, dark, { parent: grp }); });
    c.rod(new V3(0.48, 0.66, 0), new V3(0.07, 1.06, 0), 0.016, dark, { parent: grp });
    /* tremonha: tampa amarela com fechos, à frente do para-brisa */
    c.cyl(0.26, 0.26, 0.05, CM("#e8c33a", { roughness: 0.5 }), 1.1, 0.64, 0, null, { seg: 24, parent: grp });
    c.rb(0.08, 0.03, 0.3, 0.01, MT.steel, 1.1, 0.68, 0, { parent: grp });
    c.rb(0.4, 0.05, 0.14, 0.02, CM("#cfd3d6", { transparent: true, opacity: 0.5 }), 1.6, 0.58, 0.32, { parent: grp });
    /* capô: escapamentos, tomada de ar inferior */
    [1, -1].forEach(function (s) { c.cyl(0.04, 0.05, 0.3, MT.steel, 2.45, -0.3, s * 0.5, "x", { parent: grp }).rotation.y = -s * 0.25; c.text("PT-ZAG", 0.9, 0.22, -2.3, 0.2, s * 0.25, s > 0 ? "+z" : "-z", { fg: "#1f3f25", parent: grp }); c.text("ETANOL", 0.5, 0.11, 2.4, 0.2, s * 0.495, s > 0 ? "+z" : "-z", { fg: "#1f3f25", parent: grp }); });
    c.rb(0.3, 0.12, 0.45, 0.04, MT.dark, 3.0, -0.4, 0, { parent: grp });
    /* asa baixa reta de corda constante com diedro, pontas com luz de navegação */
    var wingM = c.paint("#d9aa22");
    [1, -1].forEach(function (s) {
      var dh = function (z) { return -0.4 + Math.max(0, z - 0.5) * 0.1; };
      var w = c.add(EA.foilGeo([{ p: [1.18, dh(0), 0], c: 1.71, t: 0.15, cam: 0.02 }, { p: [1.18, dh(5.6), s * 5.6], c: 1.71, t: 0.14, cam: 0.02 }, { p: [1.12, dh(5.84) + 0.02, s * 5.84], c: 1.55, t: 0.07, cam: 0.01 }], { up: "y", n: 14 }), wingM, 0, 0, 0, grp);
      c.deform.push(w);
      c.rb(0.012, 0.012, 4.6, 0.004, MT.dark, -0.2, dh(3.3) + 0.11, s * 3.3, { parent: grp }).castShadow = false;
      EA.navLight(c, 0.4, dh(5.84) + 0.02, s * 5.87, s > 0 ? "verde" : "vermelha", "Luz de navegação " + (s > 0 ? "direita (verde)" : "esquerda (vermelha)"), { parent: grp });
      /* barra de pulverização sob o bordo de fuga, com bicos */
      c.rod(new V3(-0.62, dh(5.3) - 0.2, s * 5.3), new V3(-0.62, dh(0.6) - 0.2, s * 0.6), 0.022, MT.steel, { parent: grp });
      for (var z = 0.8; z <= 5.2; z += 0.4) { c.cyl(0.018, 0.01, 0.07, MT.steel, -0.62, dh(z) - 0.25, s * z, null, { parent: grp }); c.rod(new V3(-0.62, dh(z) - 0.2, s * z), new V3(-0.5, dh(z) - 0.08, s * z), 0.008, MT.steel, { parent: grp }); }
    });
    /* empenagem: profundor reto com montante, deriva alta */
    var tm = c.paint("#d9aa22");
    [1, -1].forEach(function (s) { var hs = c.add(EA.foilGeo([{ p: [-2.95, 0.36, 0], c: 0.95, t: 0.09 }, { p: [-3.05, 0.36, s * 1.8], c: 0.8, t: 0.08 }], { up: "y", n: 10 }), tm, 0, 0, 0, grp); c.deform.push(hs); c.rod(new V3(-3.3, 0.36, s * 0.9), new V3(-3.2, 0.05, s * 0.1), 0.012, MT.steel, { parent: grp }); });
    var fin = c.add(EA.foilGeo([{ p: [-2.65, 0.42, 0], c: 1.25, t: 0.1 }, { p: [-3.25, 1.85, 0], c: 0.72, t: 0.09 }], { up: "z", n: 10 }), tm, 0, 0, 0, grp); c.deform.push(fin);
    var finB = c.add(EA.foilGeo([{ p: [-2.64, 0.42, 0], c: 1.27, t: 0.11 }, { p: [-3.24, 1.85, 0], c: 0.74, t: 0.1 }], { up: "z", n: 10 }), grn, 0, 0, 0, grp); finB.castShadow = false;
    ZG.cutMesh(finB, [EA.bandT(function (x, y) { return y - 1.45; })], 40); c.deform.push(finB);
    EA.navLight(c, -3.95, 0.5, 0, "branca", "Luz de cauda", { parent: grp });
    EA.navLight(c, -3.4, 1.88, 0, "vermelha", "Farol anticolisão", { parent: grp, r: 0.04 });
    /* corta-fio no para-brisa e cabo defletor até a deriva */
    c.rod(new V3(0.5, 0.66, 0), new V3(0.15, 1.35, 0), 0.02, MT.steel, { parent: grp });
    c.rod(new V3(0.15, 1.35, 0), new V3(-0.4, 1.17, 0), 0.012, MT.steel, { parent: grp });
    c.rod(new V3(-0.6, 1.17, 0), new V3(-3.25, 1.85, 0), 0.007, MT.steel, { parent: grp });
    /* hélice tripá de 2,1 m */
    var pr = EA.propeller(c, 3.28, 0, 0, { R: 1.05, blades: 3, chord: 0.17, spinL: 0.26, spinR: 0.16, parent: grp, spinCol: "#c9c6bd" });
    /* bomba de cata-vento sob a barriga */
    c.cyl(0.07, 0.07, 0.35, MT.steel, 0.9, -0.72, 0, "x", { parent: grp }); c.rod(new V3(0.9, -0.55, 0), new V3(0.9, -0.68, 0), 0.02, MT.steel, { parent: grp });
    var pump = EA.propeller(c, 1.1, -0.72, 0, { R: 0.22, blades: 2, chord: 0.06, spinL: 0.08, spinR: 0.06, parent: grp, tip: false, v: 12 });
    void pump;
    EA.bake(c, grp);
    var M = new THREE.Matrix4().compose(new V3(X0, Y0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, TH)), new V3(1, 1, 1));
    EA.fuseGlass(c, ST, EA.keepT(wsK), "Para-brisa", "laminado", { M: M, pos: P(0.25, 0.85) });
    [1, -1].forEach(function (s) { EA.fuseGlass(c, ST, EA.sideKeepP(swP, 0.3, s), "Janela da cabine " + (s > 0 ? "direita" : "esquerda"), "temperado", { M: M, pos: P(-0.45, 0.85, s * 0.47) }); });
    /* trem convencional (referencial do chão): pernas de mola, rodas grandes, bequilha */
    var leg = CM("#3a3c3e", { roughness: 0.5, metalness: 0.3 });
    [1, -1].forEach(function (s) {
      var top = P(1.3, -0.5, s * 0.42);
      c.tube([[top.x, top.y, top.z], [1.55, 0.6, s * 0.75], [1.5, 0.34, s * 1.02]], 0.045, leg, { seg: 16 });
      c.wheel(1.5, s * 1.1, 0.33, 0.21, { rim: leg, spokes: 0, rimR: 0.45, noPart: true });
    });
    var tw = P(-3.45, 0.04);
    c.rod(new V3(tw.x, tw.y, 0), new V3(tw.x - 0.08, 0.13, 0), 0.025, leg);
    c.wheel(tw.x - 0.1, 0.0001, 0.13, 0.08, { rim: leg, spokes: 0, noPart: true });
    /* farol de pouso no bordo de ataque esquerdo */
    var lp = P(1.2, -0.38, -2.4); EA.lamp(c, lp.x, lp.y, lp.z, 0.065, "Farol de pouso");
    c.part("helice", "Hélice", pr, P(3.35, 0), 0.9); c.part("motor", "Motor IO-540 a etanol", null, P(2.6, 0), 0.9);
    c.part("tanque", "Tanques nas asas", null, P(0.4, -0.4, 1.8), 1.0); c.part("carga", "Tremonha (950 L)", null, P(1.2, 0.2), 0.9);
    c.part("trem", "Trem de pouso", null, new V3(1.5, 0.45, 0), 1.2);
    var F = P(3.5, 0).x, R = P(-3.9, 0.3).x;
    Object.assign(c.meta, { kind: "plane", L: F - R, W: 11.74, fusW: 1.02, front: F, rear: R, clear: 0.72, belt: 1.5, bodyH: 1.2, top: 2.2, roof: null });
    c.zone("cabine", "Cabine envidraçada", [P(-1.1, 0).x, P(0.5, 0).x, 1.2, 2.25, -0.6, 0.6], null, { dir: "esquerda", fxKey: "cabineaero", who: "o piloto", anyMesh: true });
    c.zone("nariz", "Capô, tremonha e hélice", [P(0.5, 0).x, F + 0.2, 0.9, 2.5, -0.62, 0.62], null, { onBand: function (c2, b) { if (b >= 4) pr.visible = false; } });  /* revisor: no arrancado a hélice sai inteira (o recorte do núcleo deixava pontas de pá soltas no ar) */
    c.zone("fuselagem", "Fuselagem traseira", [P(-2.6, 0).x, P(-1.1, 0).x, 0.5, 1.9, -0.55, 0.55]);
    c.zone("cauda", "Empenagem e bequilha", [R - 0.2, P(-2.6, 0).x, 0.0, 2.3, -1.95, 1.95]);
    c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)");
    c.zone("lanterna_c", "Luz de cauda e anticolisão"); c.zone("farol_e", "Farol de pouso");
    c.zone("barra", "Barra de pulverização", [P(-0.75, 0).x - 0.3, P(-0.5, 0).x + 0.3, 0.6, 1.4, -5.6, 5.6], null, { type: "peca", fxKey: "carenagem", dir: "cima", fx: ["Nenhum", "Bicos entortados, jato torto", "Barra solta de um lado, pulveriza no chão", "Barra arrastando, vazamento de calda", "Barra arrancada: sem pulverização"] });
    c.meta.armor = function (c2) {
      /* modificado: tremonha vira tanque de calda incendiária, bicos maiores, chapa de aço sob a cabine e galões presos ao lado */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { var a = P(0.4, -0.2, s * 0.5), b = P(-1.0, -0.15, s * 0.47); c2.rb(Math.abs(a.x - b.x), 0.5, 0.02, 0.02, stl, (a.x + b.x) / 2, (a.y + b.y) / 2, s * 0.515, { rot: [0, 0, TH] }); ZG.jerry(c2, P(-1.4, 0.1).x, P(-1.4, 0.1).y, s * 0.42, "#8e2a20"); });
      [1, -1].forEach(function (s) { for (var z = 1.2; z <= 5.0; z += 1.2) { var q = P(-0.62, -0.62 + (z - 0.5) * 0.1, s * z); c2.cyl(0.05, 0.03, 0.14, CM("#b8401c"), q.x, q.y, q.z); } });
      var t = P(1.1, 0.7); c2.cyl(0.28, 0.28, 0.12, CM("#8e2a20", { roughness: 0.5 }), t.x, t.y, 0); c2.text("INFLAMÁVEL", 0.5, 0.1, t.x, t.y + 0.07, 0, "+y", { fg: "#f2e6c8" });
    };
  });

  /* ================= helicópteros ================= */
  /* esquis: dois tubos com ponta dobrada para cima e dois tubos transversais em arco até a barriga */
  function skidGear(c, o) {
    var mat = o.mat || MT.steel, z = o.z, y = o.y || 0.045;
    [1, -1].forEach(function (s) {
      c.tube([[o.x0, y + 0.02, s * z], [o.x0 + 0.1, y, s * z], [o.x1 - 0.15, y, s * z], [o.x1 + 0.05, y + 0.07, s * z], [o.x1 + 0.16, y + 0.2, s * z]], o.r || 0.04, mat, { seg: 40 });
      (o.shoes || []).forEach(function (x) { c.rb(0.16, 0.03, 0.06, 0.01, MT.trim, x, y - 0.03, s * z); });
    });
    o.cross.forEach(function (q) {
      var x = q[0], top = q[1], zi = q[2];
      c.tube([[x, y, -z], [x + (q[3] || 0), (y + top) * 0.55, -(z + zi) / 2 - 0.08], [x + (q[3] || 0) * 1.4, top, -zi], [x + (q[3] || 0) * 1.4, top + 0.03, 0], [x + (q[3] || 0) * 1.4, top, zi], [x + (q[3] || 0), (y + top) * 0.55, (z + zi) / 2 + 0.08], [x, y, z]], o.r2 || 0.035, mat, { seg: 40 });
    });
  }
  /* Referência · Robinson R44 Raven II (WebSearch: Wikipedia "Robinson R44", aerocorner; esqui e cabine em parte de memória)
     Medidas reais: comprimento total com rotores 11,66 m · rotor principal 10,06 m (2 pás) · rotor de cauda 1,47 m · altura 3,28 m (topo do cubo) ·
     largura da cabine 1,28 m · bitola dos esquis ≈ 2,18 m (de memória) · comprimento dos esquis ≈ 2,5 m · cubo do rotor de cauda ≈ 5,9 m atrás do mastro.
     Traços de assinatura:
       frente: bolha de para-brisa grande dividida por uma tira central, dois faróis de pouso no queixo, mastro alto com cubo basculante exposto
       lateral: perfil de girino (cabine redonda que afina para um cone de cauda fino e reto), carenagem triangular do mastro, quatro portas
                com janelas, compartimento do motor com venezianas atrás da cabine, esquis com tubo dianteiro em arco
       traseira: rotor de cauda bipá do lado esquerdo, deriva superior inclinada e deriva inferior com patim de proteção, estabilizador horizontal
       teto: rotor bipá longo, cabine em gota, cone de cauda fino */
  ZG.register({ k: "heli", grp: "Aéreos", n: "Robinsom R44", insp: "Robinson R44", c: "Helicóptero leve a pistão", fuel: "avgas",
    d: "Quatro lugares, rotor bipá e motor a pistão. Leve o bastante para pousar em telhado de prédio.",
    mass: 1134, r: 400, seats: "4", cap: "185 L", eff: "≈ 57 L/h", auto: "560 km", vmax: 240, skill: "Pilotagem aérea 4", hood: false
  }, function (c) {
    var EA = ZG.EA, red = c.paint("#a9241e"), white = c.paint("#e9e7e0"), blk = CM("#1c1d1f", { roughness: 0.6 });
    var ST = [[1.96, 0.96, 1.06, 0.06, 2], [1.85, 0.76, 1.4, 0.76, 2.2], [1.55, 0.65, 1.7, 1.14, 2.4], [1.0, 0.6, 1.92, 1.27, 2.6], [0.3, 0.6, 1.99, 1.3, 2.8],
      [-0.5, 0.62, 1.97, 1.26, 2.8], [-1.0, 0.72, 1.92, 1.08, 2.6], [-1.35, 0.95, 1.88, 0.78, 2.4], [-1.75, 1.22, 1.84, 0.48, 2.2], [-2.05, 1.44, 1.8, 0.3, 2]];
    var wsT = { sel: null, sdf: function (x, y) { return Math.min(x - 0.8 - 0.2 * (y - 0.9), y - 0.86); } };
    var fdP = [[0.74, 1.12], [0.02, 1.12], [0.02, 1.86], [0.74, 1.9]], rdP = [[-0.08, 1.15], [-0.88, 1.2], [-0.88, 1.8], [-0.08, 1.86]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 32 }), red);
    ZG.cutMesh(fus, [{ sdf: function (x, y) { return -wsT.sdf(x, y); } }, EA.sideCutP(fdP, 0.35), EA.sideCutP(rdP, 0.35)], 40);
    c.deform.push(fus);
    /* barriga branca com filete preto (fora da bolha) */
    var wsS = wsT.sdf, bl = function (x) { return 1.0 + (x < -1.0 ? (-1.0 - x) * 0.4 : 0); };
    EA.fuseSkin(c, ST, EA.bandT(function (x, y) { return Math.min(bl(x) - y, -wsS(x, y)); }), white);
    EA.fuseSkin(c, ST, EA.bandT(function (x, y) { return Math.min(0.018 - Math.abs(y - bl(x) - 0.05), -wsS(x, y) - 0.02); }), blk, { k: 1.005 });
    EA.fuseGlass(c, ST, { sdf: wsT.sdf }, "Bolha do para-brisa", "laminado", { pos: new V3(1.4, 1.5, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(fdP, 0.35, s), "Janela da porta dianteira " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(0.4, 1.5, s * 0.64) });
      EA.fuseGlass(c, ST, EA.sideKeepP(rdP, 0.35, s), "Janela da porta traseira " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(-0.5, 1.5, s * 0.63) });
      /* frestas das portas e maçanetas */
      var df = EA.polySdf([[0.78, 0.72], [0.0, 0.68], [0.0, 1.9], [0.78, 1.93]]), dr = EA.polySdf([[-0.06, 0.68], [-0.92, 0.75], [-0.92, 1.84], [-0.06, 1.9]]);
      EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.006 - Math.min(Math.abs(df(x, y)), Math.abs(dr(x, y))), s * z - 0.35); }), MT.dark, { k: 1.003 });
      c.rb(0.1, 0.022, 0.03, 0.01, MT.chrome, 0.1, 1.08, s * 0.645); c.rb(0.1, 0.022, 0.03, 0.01, MT.chrome, -0.8, 1.1, s * 0.63);
      /* venezianas do compartimento do motor */
      for (var k = 0; k < 6; k++) c.rb(0.05, 0.3, 0.02, 0.01, blk, -1.25 - k * 0.08, 1.45, s * (0.42 - k * 0.035));
    });
    /* tira central da bolha */
    c.tube([[0.95, 1.93, 0], [1.3, 1.83, 0], [1.6, 1.62, 0], [1.82, 1.38, 0], [1.93, 1.12, 0], [1.94, 0.98, 0]], 0.02, blk, { seg: 30 });
    /* interior: piso, 4 bancos, console central alto, cíclico em T, coletivo, pedais */
    var fl = 0.72, fab = CM("#3b3a38", { roughness: 0.9 });
    c.rb(1.9, 0.03, 1.16, 0.01, MT.carpet, 0.2, fl, 0).castShadow = false;
    [0.3, -0.3].forEach(function (z) { ZG.seat(c, 0.35, fl, z, { w: 0.48, h: 0.36, back: 0.62, lean: 0.14, mat: fab }); EA.pedals(c, 1.35, fl, z); });
    ZG.seat(c, -0.55, fl + 0.06, 0, { w: 1.06, n: 2, h: 0.36, back: 0.6, lean: 0.12, mat: fab });
    c.rb(0.42, 0.62, 0.3, 0.06, CM("#232427"), 1.15, fl + 0.32, 0, { rot: [0, 0, 0.35] });
    c.rb(0.06, 0.3, 0.3, 0.02, CM("#1a1b1d"), 1.25, fl + 0.65, 0, { rot: [0, 0, 0.6] });
    [-0.07, 0.07].forEach(function (z) { c.cyl(0.04, 0.04, 0.01, MT.gauge, 1.21, fl + 0.68, z, "x", { seg: 14 }).rotation.set(0, 0, -PI / 2 + 0.6); });
    c.rb(0.03, 0.08, 0.2, 0.01, MT.screen, 1.11, fl + 0.5, 0, { rot: [0, 0, 0.35] });
    c.rod(new V3(0.82, fl, 0), new V3(0.72, fl + 0.6, 0), 0.02, blk); c.rod(new V3(0.72, fl + 0.6, -0.3), new V3(0.72, fl + 0.6, 0.3), 0.015, blk);
    [0.3, -0.3].forEach(function (z) { c.rb(0.06, 0.06, 0.05, 0.02, blk, 0.7, fl + 0.62, z); });
    EA.collective(c, 0.45, fl, -0.12); EA.collective(c, 0.45, fl, 0.48);
    c.rb(1.6, 0.02, 1.15, 0.01, MT.headliner, 0.0, 1.95, 0).castShadow = false;
    /* carenagem do mastro, transmissão, mastro e cubo basculante */
    c.rb(1.3, 0.62, 0.62, 0.2, red, -0.65, 2.18, 0, { taper: { sx: 0.35, sz: 0.55, shift: 0.3 }, def: true });
    c.cyl(0.07, 0.08, 0.7, MT.steel, 0, 2.78, 0);
    c.cyl(0.19, 0.16, 0.06, MT.steel, 0, 2.55, 0); c.cyl(0.15, 0.13, 0.05, MT.chrome, 0, 2.63, 0);
    [0, 1].forEach(function (i) { var a = i * PI; c.rod(new V3(Math.cos(a) * 0.15, 2.62, Math.sin(a) * 0.15), new V3(Math.cos(a + 0.3) * 0.18, 2.98, Math.sin(a + 0.3) * 0.18), 0.012, MT.steel); });
    var mr = EA.mainRotor(c, 0, 3.15, 0, { blades: 2, R: 5.03, chord: 0.254, droop: 0.12, hub: 0.25, v: 3.4, tipCol: "#e6e4dd", phase: 0.35 });
    c.rb(0.28, 0.12, 0.12, 0.04, MT.steel, 0, 3.19, 0);
    /* compartimento do motor (baixo) e escapamento */
    c.rb(0.75, 0.5, 0.7, 0.12, CM("#4a4c4e", { roughness: 0.6, metalness: 0.3 }), -1.35, 1.12, 0);
    c.cyl(0.04, 0.05, 0.5, MT.steel, -1.65, 0.98, 0.22, "x").rotation.y = -0.3;
    /* cone de cauda fino e reto, um pouco inclinado para cima */
    var bx0 = -1.9, bx1 = -6.05, by0 = 1.63, by1 = 1.78, bl = Math.hypot(bx1 - bx0, by1 - by0);
    var boom = c.add(new THREE.CylinderGeometry(0.075, 0.17, bl, 20, 8), red, (bx0 + bx1) / 2, (by0 + by1) / 2, 0); boom.rotation.z = PI / 2 + Math.atan2(by1 - by0, bx0 - bx1); c.deform.push(boom);
    c.rod(new V3(-2.0, 1.66, 0), new V3(-5.6, 1.77, 0), 0.006, blk, { seg: 5 });
    /* empenagem: estabilizador horizontal, deriva superior inclinada, deriva inferior com patim */
    var tm = c.paint("#a9241e");
    [1, -1].forEach(function (s) { var hs = c.add(EA.foilGeo([{ p: [-5.25, 1.76, 0], c: 0.45, t: 0.1 }, { p: [-5.32, 1.76, s * 0.62], c: 0.34, t: 0.09 }], { up: "y", n: 8 }), tm); c.deform.push(hs); });
    var fu = c.add(EA.foilGeo([{ p: [-5.65, 1.8, 0], c: 0.6, t: 0.11 }, { p: [-6.1, 2.42, 0], c: 0.36, t: 0.09 }], { up: "z", n: 8 }), tm); c.deform.push(fu);
    var fd = c.add(EA.foilGeo([{ p: [-5.7, 1.74, 0], c: 0.5, t: 0.11 }, { p: [-5.95, 1.1, 0], c: 0.32, t: 0.09 }], { up: "z", n: 8 }), tm); c.deform.push(fd);
    c.tube([[-5.98, 1.12, 0], [-6.12, 1.0, 0], [-6.3, 1.02, 0]], 0.02, MT.steel, { seg: 10 });
    c.cyl(0.07, 0.07, 0.14, MT.steel, -5.92, 1.85, -0.1, "z");
    var tr = EA.tailRotor(c, -5.92, 1.85, -0.2, { blades: 2, R: 0.735, chord: 0.12, mat: CM("#e6e4dd", { roughness: 0.5 }), tipCol: "#a9241e" });
    /* esquis */
    skidGear(c, { x0: -1.25, x1: 1.15, z: 1.09, cross: [[0.62, 0.62, 0.55, 0.06], [-0.78, 0.66, 0.6, -0.04]], shoes: [-0.6, 0.6] });
    /* luzes: dois faróis de pouso no queixo, navegação no estabilizador, anticolisão no cone e branca na cauda */
    EA.lamp(c, 1.86, 0.86, 0.13, 0.055, "Farol de pouso direito", { yaw: 0.05 }); EA.lamp(c, 1.86, 0.86, -0.13, 0.055, "Farol de pouso esquerdo", { yaw: 0.05 });
    EA.navLight(c, -5.33, 1.76, 0.64, "verde", "Luz de navegação direita (verde)", { r: 0.035 });
    EA.navLight(c, -5.33, 1.76, -0.64, "vermelha", "Luz de navegação esquerda (vermelha)", { r: 0.035 });
    EA.navLight(c, -6.2, 2.4, 0, "branca", "Luz de cauda", { r: 0.03 });
    EA.navLight(c, -1.55, 1.9, 0, "vermelha", "Farol anticolisão", { r: 0.045 });
    [1, -1].forEach(function (s) { c.text("PT-HZB", 0.75, 0.16, -3.3, 1.71, s * 0.135, s > 0 ? "+z" : "-z", { fg: "#f2efe6" }); });
    c.rod(new V3(1.55, 1.72, 0.3), new V3(1.95, 1.62, 0.3), 0.01, MT.steel);
    c.part("rotor", "Rotor principal", mr, new V3(0, 3.15, 0), 1.6); c.part("rotorcauda", "Rotor de cauda", tr, new V3(-5.92, 1.85, -0.2), 1.0);
    c.part("motor", "Motor Lycoming O-540", null, new V3(-1.35, 1.2, 0), 0.9); c.part("tanque", "Tanques (principal e auxiliar)", null, new V3(-0.9, 1.7, 0), 0.9); c.part("trem", "Esquis", null, new V3(0, 0.1, 1.09), 1.0);
    Object.assign(c.meta, { kind: "heli", L: 8.4, W: 2.26, fusW: 1.3, front: 1.97, rear: -6.35, clear: 0.6, belt: 1.15, bodyH: 1.4, top: 3.28, fusTop: 1.99, roof: null });
    c.zone("nariz", "Bolha do para-brisa e nariz", [0.8, 2.2, 0.55, 2.05, -0.75, 0.75]);
    c.zone("cabine", "Cabine e portas", [-1.0, 0.8, 0.55, 2.05, -0.8, 0.8], null, { dir: "esquerda", fxKey: "cabine", who: "os ocupantes", anyMesh: true });
    c.zone("cone", "Cone de cauda", [-5.2, -1.85, 1.35, 2.0, -0.35, 0.35], null, { dir: "cima", fxKey: "cone", cutAll: true, anyMesh: true });
    c.zone("empenagem", "Derivas e estabilizador", [-6.45, -5.2, 0.95, 2.55, -0.75, 0.75], null, { type: "peca", fxKey: "cauda", dir: "frente", anyMesh: true });
    c.zone("motor", "Motor e transmissão", [-1.8, -0.2, 0.85, 2.55, -0.45, 0.45], null, { type: "interno", fxKey: "motor", sub: "motor", pos: new V3(-1.35, 1.2, 0) });
    c.zone("farol_c", "Faróis de pouso"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)"); c.zone("lanterna_c", "Luzes de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado: flutuadores de emergência nos esquis, holofote sob o nariz, cesto de carga lateral e grade na bolha */
      var fl2 = CM("#d8d4c8", { roughness: 0.7 });
      [1, -1].forEach(function (s) { c2.cyl(0.13, 0.13, 2.0, fl2, -0.05, 0.2, s * 1.09, "x", { seg: 18 }); c2.sph(0.13, fl2, 0.95, 0.2, s * 1.09, 1.8, 1, 1); c2.sph(0.13, fl2, -1.05, 0.2, s * 1.09, 1.3, 1, 1); });
      c2.cyl(0.11, 0.08, 0.16, MT.steel, 1.55, 0.6, 0, "x"); EA.lamp(c2, 1.64, 0.6, 0.0001, 0.08, "Holofote de busca");
      c2.rb(1.0, 0.25, 0.32, 0.03, CM("#3d3a2e"), -0.3, 0.55, 0.85); ZG.jerry(c2, -0.5, 0.8, 0.85, "#8e2a20"); ZG.jerry(c2, -0.1, 0.8, 0.85, "#3e5a34");
      for (var k = -0.45; k <= 0.46; k += 0.15) c2.rod(new V3(1.05, 1.93, k), new V3(1.92, 1.02, k * 0.3), 0.007, ZG.STEELM);
      c2.part("carga", "Cesto de carga", null, new V3(-0.3, 0.6, 0.85), 0.7);
    };
  });

  /* Referência · Helibras/Airbus AS350 B2 Esquilo (WebSearch: flugzeuginfo e airvectors, dados do AS350/AS550; esqui e cabine de memória)
     Medidas reais: comprimento com rotores girando 12,94 m · fuselagem (com rotor de cauda) 10,93 m · rotor principal 10,69 m (3 pás) ·
     rotor de cauda 1,86 m · altura 3,14 m (topo da cabeça do rotor) · largura da cabine ≈ 1,80 m · bitola dos esquis ≈ 2,3 m (de memória).
     Traços de assinatura:
       frente: para-brisa grande em duas peças com janelas de queixo, nariz arredondado curto, cabeça do rotor "Starflex" de 3 braços
       lateral: cabine comprida e alta com portas dianteiras e traseiras, capota do motor em degrau atrás do rotor com escapamento virado para trás,
                cone de cauda fino saindo do alto da fuselagem, esquis longos com degraus
       traseira: estabilizador horizontal com placas verticais nas pontas, deriva grande em cima e deriva ventral com patim, rotor de cauda à esquerda
       teto: três pás largas, capota do motor estreita e comprida, guincho de resgate no lado direito */
  ZG.register({ k: "resgate", grp: "Aéreos", n: "Esquillo AS350", insp: "Helibras AS350 Esquilo", c: "Helicóptero a turbina, 6 lugares", fuel: "qav",
    d: "Turbina, rotor de três pás, holofote e guincho de resgate. Tira gente de telhado cercado.",
    mass: 2250, r: 450, seats: "6 (piloto + 5)", cap: "540 L", eff: "≈ 180 L/h", auto: "650 km", vmax: 287, skill: "Pilotagem aérea 4", hood: false
  }, function (c) {
    var EA = ZG.EA, org = c.paint("#d0531e"), white = c.paint("#e8e6df"), blk = CM("#1c1d1f", { roughness: 0.6 });
    var ST = [[3.34, 1.0, 1.12, 0.1, 2], [3.2, 0.82, 1.48, 0.95, 2.2], [2.9, 0.72, 1.88, 1.42, 2.4], [2.4, 0.68, 2.16, 1.7, 2.6], [1.6, 0.66, 2.28, 1.8, 2.8],
      [0.5, 0.66, 2.3, 1.82, 3], [-0.6, 0.68, 2.3, 1.78, 3], [-1.4, 0.84, 2.26, 1.5, 2.8], [-2.0, 1.18, 2.22, 1.0, 2.4], [-2.55, 1.5, 2.18, 0.58, 2.2]];
    var wsF = function (x, y) { return Math.min(x - 1.7 - 0.28 * (y - 0.9), y - 0.86); };
    var fdP = [[1.62, 1.18], [0.6, 1.18], [0.6, 2.12], [1.3, 2.16], [1.62, 1.7]], rdP = [[0.48, 1.22], [-0.7, 1.24], [-0.7, 2.08], [0.48, 2.12]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 32 }), white);
    ZG.cutMesh(fus, [{ sdf: function (x, y) { return -wsF(x, y); } }, EA.sideCutP(fdP, 0.5), EA.sideCutP(rdP, 0.5)], 40);
    c.deform.push(fus);
    EA.fuseSkin(c, ST, EA.bandT(function (x, y) { return Math.min(1.14 - y, -wsF(x, y)); }), org);
    EA.fuseSkin(c, ST, EA.bandT(function (x, y) { return Math.min(0.022 - Math.abs(y - 1.1), -wsF(x, y) - 0.02); }), CM("#1c3b6b"), { k: 1.005 });
    EA.fuseGlass(c, ST, { sdf: wsF }, "Para-brisa", "laminado", { pos: new V3(2.6, 1.6, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(fdP, 0.5, s), "Janela da porta dianteira " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(1.1, 1.7, s * 0.9) });
      EA.fuseGlass(c, ST, EA.sideKeepP(rdP, 0.5, s), "Janela da porta traseira " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(-0.1, 1.7, s * 0.9) });
      var df = EA.polySdf([[1.7, 0.75], [0.56, 0.72], [0.56, 2.18], [1.33, 2.22], [1.72, 1.72]]), dr = EA.polySdf([[0.52, 0.72], [-0.74, 0.74], [-0.74, 2.14], [0.52, 2.18]]);
      EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.007 - Math.min(Math.abs(df(x, y)), Math.abs(dr(x, y))), s * z - 0.5); }), MT.dark, { k: 1.003 });
      c.text("RESGATE", 1.0, 0.22, -1.25, 1.02, s * 0.79, s > 0 ? "+z" : "-z", { fg: "#f4f2ea" });
      /* degraus nos esquis */
      c.rb(0.3, 0.03, 0.18, 0.01, MT.steel, 1.0, 0.42, s * 1.02);
    });
    /* tira central e janelas de queixo */
    c.tube([[2.3, 2.2, 0], [2.75, 1.98, 0], [3.1, 1.62, 0], [3.28, 1.25, 0], [3.32, 1.0, 0]], 0.022, blk, { seg: 30 });
    [1, -1].forEach(function (s) { c.tube([[1.9, 0.98, s * 0.86], [2.6, 0.95, s * 0.66], [3.1, 1.05, s * 0.4]], 0.016, blk, { seg: 16 }); });
    /* interior: 2 bancos na frente, banco de 4 atrás, painel com console, cíclico, coletivo, pedais */
    var fl = 0.78, fab = CM("#2f3a46", { roughness: 0.9 });
    c.rb(3.0, 0.03, 1.6, 0.01, MT.carpet, 0.6, fl, 0).castShadow = false;
    [0.42, -0.42].forEach(function (z) { ZG.seat(c, 1.25, fl, z, { w: 0.5, h: 0.38, back: 0.66, lean: 0.12, mat: fab }); EA.cyclic(c, 1.6, fl, z); EA.pedals(c, 2.5, fl, z); });
    EA.collective(c, 1.3, fl, -0.72); EA.collective(c, 1.3, fl, 0.12);
    ZG.seat(c, -0.35, fl + 0.04, 0, { w: 1.56, n: 4, h: 0.38, back: 0.62, lean: 0.1, mat: fab });
    EA.instPanel(c, 2.25, 1.55, 1.2, { gauges: 8, z0: -0.45, tilt: 0.3, screens: [[0.05, 0.25, 0.14, 0.2]] });
    c.rb(0.5, 0.45, 0.32, 0.06, CM("#232427"), 2.05, fl + 0.24, 0);
    c.rb(2.3, 0.02, 1.4, 0.01, MT.headliner, 0.45, 2.24, 0).castShadow = false;
    /* capota do motor e da transmissão, entrada de ar, escapamento, mastro e cabeça Starflex */
    var cow = c.add(EA.fuseGeo([[0.95, 2.2, 2.3, 0.5, 2.4], [0.55, 2.2, 2.6, 1.0, 2.6], [-0.6, 2.2, 2.74, 1.12, 2.8], [-1.9, 2.2, 2.72, 1.04, 2.8], [-2.45, 2.24, 2.64, 0.66, 2.4], [-2.72, 2.34, 2.56, 0.3, 2.2]], { smooth: 24 }), white); c.deform.push(cow);
    [1, -1].forEach(function (s) { c.rb(0.5, 0.2, 0.03, 0.03, blk, -0.15, 2.5, s * 0.54); for (var k = 0; k < 5; k++) c.rb(0.03, 0.22, 0.02, 0.008, MT.steel, -1.35 - k * 0.09, 2.5, s * 0.545); });
    c.cyl(0.19, 0.24, 0.6, MT.trim, -2.45, 2.6, 0.18, "x").rotation.y = 0.12;
    c.cyl(0.17, 0.17, 0.02, MT.dark, -2.76, 2.6, 0.22, "x").rotation.y = 0.12;
    c.cyl(0.09, 0.11, 0.38, MT.steel, 0, 2.86, 0);
    c.cyl(0.3, 0.26, 0.08, MT.steel, 0, 3.05, 0, null, { seg: 3 });
    var mr = EA.mainRotor(c, 0, 3.08, 0, { blades: 3, R: 5.345, chord: 0.35, droop: 0.15, hub: 0.32, hubR: 0.16, cap: true, v: 2.9, mat: CM("#2a2c30", { roughness: 0.5 }), phase: 0.2 });
    /* cone de cauda fino */
    var bx0 = -2.45, bx1 = -6.65, by0 = 1.86, by1 = 2.02, bl = Math.hypot(bx1 - bx0, by1 - by0);
    var boom = c.add(new THREE.CylinderGeometry(0.1, 0.3, bl, 22, 8), white, (bx0 + bx1) / 2, (by0 + by1) / 2, 0); boom.rotation.z = PI / 2 + Math.atan2(by1 - by0, bx0 - bx1); c.deform.push(boom);
    c.rod(new V3(-2.5, 1.95, 0), new V3(-6.1, 2.06, 0), 0.006, blk, { seg: 5 });
    /* empenagem: estabilizador com placas, deriva alta, deriva ventral com patim */
    var tm = c.paint("#d0531e");
    [1, -1].forEach(function (s) {
      var hs = c.add(EA.foilGeo([{ p: [-5.3, 1.98, 0], c: 0.6, t: 0.11 }, { p: [-5.38, 1.98, s * 1.0], c: 0.52, t: 0.1 }], { up: "y", n: 8 }), tm); c.deform.push(hs);
      var ep = c.add(EA.foilGeo([{ p: [-5.3, 1.75, s * 1.02], c: 0.55, t: 0.08 }, { p: [-5.42, 2.3, s * 1.02], c: 0.42, t: 0.08 }], { up: "z", n: 6 }), tm); c.deform.push(ep);
    });
    var fu = c.add(EA.foilGeo([{ p: [-6.15, 2.05, 0], c: 0.95, t: 0.12 }, { p: [-6.8, 3.12, 0], c: 0.5, t: 0.1 }], { up: "z", n: 8 }), tm); c.deform.push(fu);
    var fd = c.add(EA.foilGeo([{ p: [-6.3, 1.97, 0], c: 0.62, t: 0.12 }, { p: [-6.55, 1.38, 0], c: 0.4, t: 0.1 }], { up: "z", n: 8 }), tm); c.deform.push(fd);
    c.tube([[-6.6, 1.4, 0], [-6.78, 1.3, 0], [-6.98, 1.34, 0]], 0.022, MT.steel, { seg: 10 });
    c.cyl(0.09, 0.09, 0.18, MT.steel, -6.68, 2.25, -0.12, "z");
    var tr = EA.tailRotor(c, -6.68, 2.25, -0.24, { blades: 2, R: 0.93, chord: 0.18, mat: CM("#2a2c30", { roughness: 0.5 }), tipCol: "#e8e6df" });
    /* esquis longos */
    skidGear(c, { x0: -1.55, x1: 1.9, z: 1.15, cross: [[1.25, 0.66, 0.75, 0.05], [-0.85, 0.7, 0.7, -0.03]], shoes: [-1.0, 1.4] });
    /* guincho de resgate no lado direito, holofote sob o nariz, luzes */
    c.rb(0.12, 0.08, 0.7, 0.03, MT.steel, 0.55, 2.38, 0.75); c.rod(new V3(0.55, 2.38, 1.08), new V3(0.55, 2.2, 1.08), 0.03, MT.steel);
    c.cyl(0.11, 0.11, 0.3, CM("#d8d4c8"), 0.55, 2.08, 1.08); c.rod(new V3(0.55, 1.92, 1.08), new V3(0.55, 1.5, 1.08), 0.006, MT.steel); c.sph(0.04, MT.yellow, 0.55, 1.48, 1.08);
    c.cyl(0.13, 0.1, 0.16, MT.steel, 2.6, 0.62, 0, "x"); EA.lamp(c, 2.7, 0.62, 0.0001, 0.1, "Holofote de busca");
    EA.lamp(c, 3.12, 0.92, -0.18, 0.06, "Farol de pouso");
    EA.navLight(c, -5.38, 1.98, 1.06, "verde", "Luz de navegação direita (verde)", { r: 0.035 });
    EA.navLight(c, -5.38, 1.98, -1.06, "vermelha", "Luz de navegação esquerda (vermelha)", { r: 0.035 });
    EA.navLight(c, -6.98, 3.05, 0, "branca", "Luz de cauda", { r: 0.03 });
    EA.navLight(c, -2.9, 2.08, 0, "vermelha", "Farol anticolisão", { r: 0.05 });
    [1, -1].forEach(function (s) { c.text("PR-ESQ", 0.9, 0.2, -4.3, 1.98, s * 0.2, s > 0 ? "+z" : "-z", { fg: "#2a2c30" }); });
    c.part("rotor", "Rotor principal", mr, new V3(0, 3.08, 0), 1.6); c.part("rotorcauda", "Rotor de cauda", tr, new V3(-6.68, 2.25, -0.24), 1.0);
    c.part("motor", "Turbina Arriel", null, new V3(-1.3, 2.5, 0), 1.0); c.part("tanque", "Tanque de QAV", null, new V3(-1.2, 1.2, 0), 1.0); c.part("trem", "Esquis", null, new V3(0, 0.1, 1.15), 1.0);
    c.part("guincho", "Guincho de resgate", null, new V3(0.55, 2.2, 1.08), 0.6);
    Object.assign(c.meta, { kind: "heli", L: 10.35, W: 2.38, fusW: 1.82, front: 3.36, rear: -7.0, clear: 0.66, belt: 1.25, bodyH: 1.65, top: 3.15, fusTop: 2.3, roof: null });
    c.zone("nariz", "Para-brisa e nariz", [1.7, 3.6, 0.6, 2.4, -1.0, 1.0]);
    c.zone("cabine", "Cabine e portas", [-0.8, 1.7, 0.6, 2.35, -1.05, 1.05], null, { dir: "esquerda", fxKey: "cabine", who: "os ocupantes", anyMesh: true });
    c.zone("cone", "Cone de cauda", [-5.25, -2.5, 1.5, 2.3, -0.45, 0.45], null, { dir: "cima", fxKey: "cone", cutAll: true, anyMesh: true });
    c.zone("empenagem", "Derivas e estabilizador", [-7.1, -5.25, 1.2, 3.1, -1.2, 1.2], null, { type: "peca", fxKey: "cauda", dir: "frente", anyMesh: true });
    c.zone("motor", "Turbina e transmissão", [-2.9, 0.8, 2.15, 2.85, -0.6, 0.6], null, { type: "interno", fxKey: "motor", sub: "motor", pos: new V3(-1.3, 2.5, 0) });
    c.zone("guincho", "Guincho de resgate", [0.3, 0.8, 1.4, 2.5, 0.6, 1.25], null, { type: "peca", fxKey: "carenagem", dir: "esquerda", fx: ["Nenhum", "Cabo desfiado", "Guincho emperra no meio", "Cabo partido, gancho caído", "Guincho arrancado: sem resgate"] });
    c.zone("farol_c", "Farol de pouso e holofote"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)"); c.zone("lanterna_c", "Luzes de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado: chapas de aço no piso e nas portas dos pilotos, metralhadora de porta à esquerda, cesto de suprimentos no esqui */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { c2.rb(0.95, 0.5, 0.02, 0.02, stl, 1.1, 0.98, s * 0.92); });
      c2.rb(2.8, 0.03, 1.5, 0.01, stl, 0.5, 0.64, 0);
      c2.rod(new V3(0.0, 1.0, -0.92), new V3(0.0, 1.5, -1.05), 0.03, stl); c2.cyl(0.03, 0.03, 0.9, MT.trim, 0.2, 1.55, -1.08, "x"); c2.rb(0.25, 0.12, 0.1, 0.02, MT.trim, -0.15, 1.52, -1.08);
      c2.rb(0.9, 0.3, 0.4, 0.03, CM("#3d3a2e"), -0.2, 0.35, 1.15); ZG.jerry(c2, -0.4, 0.66, 1.15, "#8e2a20");
      c2.part("arma", "Metralhadora de porta", null, new V3(0.2, 1.55, -1.08), 0.6);
    };
  });
})(window.ZG);
