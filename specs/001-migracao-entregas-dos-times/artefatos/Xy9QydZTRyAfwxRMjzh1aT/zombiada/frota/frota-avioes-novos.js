/* frota-avioes-novos.js: aviões novos da v4 (grupo H). Só usa a API de window.ZG (veja API.md) e os utilitários
   de frota-agua-ar.js expostos em ZG.EA (fuselagem, aerofólio, hélice, luzes de navegação, vidro moldado, bake).
   Funções locais deste arquivo (não estão no núcleo): pose3 (atitude de cauda baixa), starDecal (estrela genérica),
   pod (casulo/foguete), hpoly (polígono de janela arredondado), twinProp e frame3 (ver comentários). */
(function (ZG) {
  "use strict";
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM, G = ZG.geo, DS = THREE.DoubleSide;

  /* ================= utilitários locais (grupo H) ================= */
  /* atitude de avião de trem convencional: acha a inclinação TH em que a roda principal (Af, raio ra) e a bequilha
     (Tf, raio rt), dadas no referencial de voo, tocam o chão juntas; devolve P(x,y,z) que leva do voo para o chão */
  function pose3(Af, ra, Tf, rt) {
    var lo = 0, hi = 0.5, TH = 0;
    function f(t) { var s = Math.sin(t), c = Math.cos(t); return (Af[0] * s + Af[1] * c - ra) - (Tf[0] * s + Tf[1] * c - rt); }
    for (var i = 0; i < 50; i++) { TH = (lo + hi) / 2; if (f(TH) > 0) hi = TH; else lo = TH; }
    var s = Math.sin(TH), c = Math.cos(TH), Y0 = ra - (Af[0] * s + Af[1] * c);
    var P = function (x, y, z) { return new V3(x * c - y * s, x * s + y * c + Y0, z || 0); };
    var M = new THREE.Matrix4().compose(new V3(0, Y0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, TH)), new V3(1, 1, 1));
    return { TH: TH, Y0: Y0, P: P, M: M };
  }
  /* estrela genérica de cinco pontas (insígnia fictícia) num disco, voltada para face */
  function starDecal(c, x, y, z, r, face, o) {
    o = o || {}; var sh = new THREE.Shape();
    for (var i = 0; i < 10; i++) { var a = PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.42 : r; var px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (i) sh.lineTo(px, py); else sh.moveTo(px, py); }
    var g = new THREE.Group(); g.position.set(x, y, z); g.userData.rigid = true; (o.parent || c.g).add(g);
    if (o.ring !== false) { var d = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 28), CM(o.bg || "#2f3a2c", { roughness: 0.8 })); g.add(d); }
    var s = new THREE.Mesh(new THREE.ShapeGeometry(sh), CM(o.fg || "#c9c6b2", { roughness: 0.8 })); s.position.z = 0.002; g.add(s);
    if (face === "+y") g.rotation.x = -PI / 2; else if (face === "-y") g.rotation.x = PI / 2; else g.rotation.y = { "+z": 0, "-z": PI, "+x": PI / 2, "-x": -PI / 2 }[face] || 0;
    if (o.rot) g.rotation.z += o.rot;
    g.children.forEach(function (m) { m.castShadow = false; });
    return g;
  }
  /* polígono arredondado (janela) no plano x-y: retângulo [x0, x1, y0, y1] com cantos de raio r */
  function rrect(x0, x1, y0, y1, r, n) {
    n = n || 4; var pts = [], cs = [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, PI / 2], [x0 + r, y0 + r, PI], [x1 - r, y0 + r, 1.5 * PI]];
    cs.forEach(function (q) { for (var i = 0; i <= n; i++) { var a = q[2] + i / n * PI / 2; pts.push([q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r]); } });
    return pts;
  }
  /* sdf de várias janelas (união) para recortar a pele de uma vez */
  function polysSdf(EA, polys) { var fs = polys.map(function (p) { return EA.polySdf(p); }); return function (x, y) { var d = 1e9; fs.forEach(function (f) { d = Math.min(d, f(x, y)); }); return d; }; }
  /* pele, vidro e recorte com subdivisão local (janelas e faixas menores que os triângulos da fuselagem):
     pre = teste de recorte grosso feito antes, sem subdividir, para limitar a área subdividida */
  function cutSub(m, tests, sub, pre) { if (pre) ZG.cutMesh(m, [pre], 40); ZG.cutMesh(m, tests, 40, { sub: sub || 0.08 }); }
  function scaleSt(st, k) { return st.map(function (s) { var cy = (s[1] + s[2]) / 2, hh = (s[2] - s[1]) / 2 * k; return [s[0], cy - hh, cy + hh, s[3] * k, s[4], s[5]]; }); }
  function fSkin(c, EA, st, keep, mat, o) {
    o = o || {}; var m = c.add(EA.fuseGeo(scaleSt(st, o.k || 1.004), { smooth: o.smooth || 48, seg: o.seg || 30 }), mat, 0, 0, 0, o.parent); m.castShadow = false;
    cutSub(m, [keep], o.sub || 0.06, o.pre); c.deform.push(m); return m;
  }
  function fGlass(c, EA, st, keep, label, type, o) {
    o = o || {}; var m = new THREE.Mesh(EA.fuseGeo(scaleSt(st, o.k || 0.988), { smooth: o.smooth || 48, seg: o.seg || 30 }), o.mat || MT.glass); (o.parent || c.g).add(m);
    cutSub(m, [keep], o.sub || 0.07, o.pre);
    return ZG.asGlass(c, m, label, type || "temperado", o.pos ? { pos: o.pos } : {});
  }
  /* casulo/tanque alongado ao longo de x (foguete, tanque subalar, flutuador simples) */
  function pod(c, EA, x0, x1, y, z, r, mat, o) {
    o = o || {}; var L = x0 - x1, st = [[x0, y - r * 0.05, y + r * 0.05, r * 0.1, 2], [x0 - L * 0.08, y - r * 0.7, y + r * 0.7, r * 1.4, 2], [x0 - L * 0.22, y - r, y + r, r * 2, 2], [x1 + L * 0.15, y - r, y + r, r * 2, 2], [x1 + L * 0.02, y - r * 0.8, y + r * 0.8, r * 1.6, 2], [x1, y - r * 0.55, y + r * 0.55, r * 1.1, 2]];
    st.forEach(function (s) { s.push(z); });
    var m = c.add(EA.fuseGeo(st, { smooth: 18, seg: 18 }), mat, 0, 0, 0, o.parent); return m;
  }

  /* meia largura da fuselagem (estações [x, y baixo, y alto, largura, expoente]) na altura y, interpolando as estações em x */
  function halfW(ST, x, y) {
    for (var i = 0; i < ST.length - 1; i++) {
      var a = ST[i], b = ST[i + 1]; if (x > a[0] || x < b[0]) continue;
      var t = (a[0] - x) / (a[0] - b[0] || 1), L = function (k, d) { return (a[k] == null ? d : a[k]) * (1 - t) + (b[k] == null ? d : b[k]) * t; };
      var yb = L(1), yt = L(2), w = L(3), p = L(4, 2.4), cc = (yb + yt) / 2, hh = (yt - yb) / 2, d = Math.abs(y - cc) / hh;
      return d >= 1 ? 0 : w / 2 * Math.pow(1 - Math.pow(d, p), 1 / p);
    }
    return 0;
  }
  /* piso ou forro que cabe por dentro da fuselagem: trechos de até 1 m, cada um com a largura mínima do trecho menos a folga */
  function liner(c, ST, x0, x1, y, mat, o) {
    o = o || {}; var n = Math.max(1, Math.ceil((x1 - x0) / 1.0)), dx = (x1 - x0) / n, out = [];
    for (var i = 0; i < n; i++) {
      var a = x0 + i * dx, m = 9; for (var k = 0; k <= 8; k++) m = Math.min(m, halfW(ST, a + dx * k / 8, y));
      var w = Math.min(o.maxW || 9, 2 * (m - (o.gap || 0.05))); if (w < 0.12) continue;
      var r = c.rb(dx + 0.01, o.h || 0.02, w, 0.01, mat, a + dx / 2, y, 0, o.parent ? { parent: o.parent } : {}); r.castShadow = false; out.push(r);
    }
    return out;
  }
  /* matrícula colada no costado que afina: centro no lado de fora e guinada que acompanha o afinamento */
  function sideText(c, ST, txt, w, h, x, y, s, o) {
    var a = halfW(ST, x + w / 2, y), b = halfW(ST, x - w / 2, y), m = c.text(txt, w, h, x, y, s * ((a + b) / 2 + 0.014), s > 0 ? "+z" : "-z", o);
    m.rotation.y += -s * Math.atan2(a - b, w); return m;
  }

  /* utilitários também usados por frota-helis-novos.js (mesmo grupo H) */
  ZG.GH = { pose3: pose3, starDecal: starDecal, rrect: rrect, polysSdf: polysSdf, pod: pod, cutSub: cutSub, scaleSt: scaleSt, fSkin: fSkin, fGlass: fGlass, halfW: halfW, liner: liner, sideText: sideText };

  /* ================= Paipa Cub ================= */
  /* Referência · Piper J-3 Cub (J3C-65) — WebSearch (aerocorner, AOPA, Smithsonian NASM, museumofflight) e parte de memória
     Medidas reais: comprimento 6,83 m · envergadura 10,74 m · altura 2,03 m (atitude de três pontos) · corda da asa 1,60 m (área 16,6 m²) ·
     bitola do trem principal ≈ 1,83 m (de memória) · pneus principais 8.00-4 ≈ 0,50 m (de memória) · bequilha ≈ 0,15 m ·
     entre-eixos (roda principal-bequilha) ≈ 5,0 m (de memória) · hélice de madeira bipá 1,83 m (72") · largura da fuselagem ≈ 0,71 m ·
     ângulo de três pontos ≈ 10–11° · balanço dianteiro (eixo até o cubo da hélice) ≈ 1,3 m · motor Continental A-65 de 65 hp · tanque de 45 L no nariz.
     Traços de assinatura:
       frente: capô curto e rombudo com as cabeças dos 4 cilindros saindo pelos lados do capô, hélice de madeira sem spinner,
               trem principal em V com eixo bipartido e amortecedor de elástico, asa alta reta com montantes em V
       lateral: amarelo Cub com o raio preto (faixa preta que nasce no nariz e quebra em zigue-zague), boia do marcador de combustível
                (arame) saindo do capô à frente do para-brisa, porta da direita bipartida (metade de cima levanta), janelinha triangular
                atrás da asa, montantes em V que se encontram na longarina de baixo, cauda baixa (três pontos) com bequilha de feixe de mola
       traseira: leme grande e arredondado, profundor de pontas redondas estaiado por arames, fuselagem estreita e alta
       teto: asa retangular de pontas arredondadas, claraboia transparente sobre a cabine, nervuras do entelado */
  ZG.register({ k: "paipa", grp: "Aéreos", n: "Paipa Cub", insp: "Piper J-3 Cub", c: "Monomotor de treinamento, asa alta, 2 lugares em tandem", fuel: "avgas",
    d: "O amarelinho de aeroclube. Pousa em pasto, estrada de terra e clareira, e decola em 150 m. Pouco combustível e quase nenhuma proteção.",
    mass: 553, r: 250, seats: "2 (em tandem)", cap: "45 L", eff: "≈ 15 L/h", auto: "350 km", vmax: 140, skill: "Pilotagem aérea 2", hood: false
  }, function (c) {
    var EA = ZG.EA, yel = "#f0bd22";
    var Q = pose3([1.62, -0.78], 0.25, [-3.24, -0.27], 0.075), P = Q.P, TH = Q.TH;
    var grp = new THREE.Group(); grp.position.set(0, Q.Y0, 0); grp.rotation.z = TH; c.g.add(grp); grp.updateMatrix();
    var PG = { parent: grp };
    var body = c.paint(yel), black = c.paint("#141414", { roughness: 0.5 }), dark = CM("#232427", { roughness: 0.6 });
    /* fuselagem (referencial de voo, eixo de tração em y = 0): capô rombudo, cabine alta sob a asa, cone estreito e alto */
    var ST = [[3.0, -0.17, 0.12, 0.26, 2.2], [2.94, -0.3, 0.24, 0.56, 2.6], [2.72, -0.37, 0.29, 0.68, 3.2], [2.3, -0.41, 0.32, 0.71, 3.6], [1.95, -0.44, 0.36, 0.71, 3.8],
      [1.4, -0.47, 0.72, 0.71, 3.8], [0.6, -0.47, 0.75, 0.71, 3.8], [-0.12, -0.45, 0.75, 0.7, 3.6], [-0.6, -0.41, 0.6, 0.64, 3.4], [-1.4, -0.32, 0.47, 0.52, 3.2],
      [-2.25, -0.21, 0.36, 0.38, 3], [-2.95, -0.1, 0.27, 0.22, 2.6], [-3.38, -0.04, 0.22, 0.08, 2.2], [-3.46, -0.01, 0.2, 0.02, 2]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 32 }), body, 0, 0, 0, grp);
    var wsK = [1.38, 1.98, 0.3, 0.8, null, 0.37];
    var sideW = [[1.36, 0.06], [0.12, 0.06], [0.12, 0.72], [1.4, 0.72]], quarter = [[-0.06, 0.12], [-0.62, 0.22], [-0.62, 0.5], [-0.06, 0.66]];
    ZG.cutMesh(fus, [EA.cutT(wsK, function (n) { return n.y > 0.12; }), EA.sideCutP(sideW, 0.25), EA.sideCutP(quarter, 0.2)], 40);
    c.deform.push(fus);
    /* raio preto: faixa que nasce no nariz e quebra em zigue-zague na altura do para-brisa */
    var bolt = function (x) { return x > 2.0 ? 0.02 : x > 1.72 ? 0.02 - (2.0 - x) / 0.28 * 0.22 : x > 1.5 ? -0.2 + (1.72 - x) / 0.22 * 0.14 : -0.06 - (1.5 - x) * 0.012; };
    var boltW = function (x) { return x > 1.5 ? 0.065 : Math.max(0.035, 0.065 - (1.5 - x) * 0.007); };
    fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(boltW(x) - Math.abs(y - bolt(x)), x + 3.2, 2.93 - x, Math.abs(z) - 0.12); }), black, { parent: grp, sub: 0.05, pre: EA.keepT([-3.3, 3.0, -0.35, 0.2, 0.1]) });
    /* porta bipartida do lado direito (fresta) e costuras do capô */
    var doorR = EA.polySdf([[1.38, -0.4], [0.14, -0.4], [0.14, 0.72], [1.4, 0.72]]);
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.006 - Math.min(Math.abs(doorR(x, y)), x > 0.14 && x < 1.38 ? Math.abs(y - 0.06) : 9), z - 0.25); }), MT.dark, { parent: grp, k: 1.003 });
    EA.fuseSkin(c, ST, EA.bandT(function (x, y) { return Math.min(0.006 - Math.abs(x - 2.28), y + 0.38); }), MT.dark, { parent: grp, k: 1.003 });
    /* cabeças dos cilindros saindo do capô (dois de cada lado), com aletas */
    [1, -1].forEach(function (s) {
      [2.58, 2.3].forEach(function (x, i) {
        var xx = x - (s > 0 ? 0.06 : 0) + i * 0.0;
        var alu = CM("#a7acae", { metalness: 0.55, roughness: 0.4 });
        c.cyl(0.07, 0.07, 0.2, alu, xx, -0.02, s * 0.4, "z", { seg: 14, parent: grp });
        for (var k = 0; k < 6; k++) c.cyl(0.092, 0.092, 0.01, alu, xx, -0.02, s * (0.35 + k * 0.025), "z", { seg: 14, parent: grp });
        c.rb(0.07, 0.035, 0.06, 0.012, dark, xx, 0.08, s * 0.47, PG); c.cyl(0.012, 0.012, 0.08, MT.trim, xx - 0.04, 0.03, s * 0.47, null, PG);
      });
      c.text("PP-ZCB", 1.0, 0.2, -1.75, 0.13, s * 0.25, s > 0 ? "+z" : "-z", { fg: "#151515", parent: grp });
    });
    /* nariz: entradas de ar (narinas), escapamento, tampa de óleo, tanque com boia de arame à frente do para-brisa */
    [1, -1].forEach(function (s) { c.sph(0.07, MT.dark, 2.97, -0.12, s * 0.15, 0.4, 0.7, 1, PG); });
    c.cyl(0.03, 0.035, 0.42, MT.steel, 2.55, -0.43, 0.08, "x", PG);
    c.cyl(0.035, 0.035, 0.04, MT.chrome, 2.1, 0.35, 0, null, PG);
    c.rod(new V3(2.06, 0.34, 0), new V3(2.06, 0.62, 0), 0.004, MT.steel, PG); c.rb(0.012, 0.012, 0.06, 0.004, MT.steel, 2.06, 0.62, 0, PG);
    /* interior: piso, dois bancos em tandem, dois manches, painel simples com 5 relógios, manete na esquerda */
    var fl = -0.4, fab = CM("#3c3a35", { roughness: 0.9 });
    c.rb(2.0, 0.025, 0.6, 0.01, MT.carpet, 0.55, fl, 0, PG).castShadow = false;
    ZG.seat(c, 0.62, fl, 0, { w: 0.48, h: 0.3, back: 0.55, lean: 0.2, mat: fab, parent: grp, headrest: false });
    ZG.seat(c, -0.22, fl + 0.04, 0, { w: 0.5, h: 0.3, back: 0.58, lean: 0.2, mat: fab, parent: grp, headrest: false });
    [1.12, 0.3].forEach(function (x) { c.rod(new V3(x, fl, 0), new V3(x - 0.05, fl + 0.5, 0), 0.012, MT.plastic, PG); c.sph(0.025, MT.plastic, x - 0.055, fl + 0.52, 0, 1, 1.4, 1, PG); });
    c.rb(0.05, 0.22, 0.6, 0.02, CM("#2a2b2d", { roughness: 0.8 }), 1.75, 0.3, 0, PG);
    [-0.2, -0.08, 0.04, 0.16, -0.14].forEach(function (z, i) { c.cyl(0.032, 0.032, 0.01, MT.gauge, 1.72, i < 4 ? 0.32 : 0.22, z, "x", { seg: 14, parent: grp }).castShadow = false; });
    c.rb(0.1, 0.03, 0.03, 0.01, MT.plastic, 1.1, 0.0, -0.32, PG);
    /* asa alta reta de pontas redondas (corda 1,60 m), diedro 1°, claraboia no meio */
    var wingMat = c.paint(yel), wings = [];
    function semiAsa(s) {
      var dh = function (z) { return 0.8 + z * 0.017; };
      var g = EA.foilGeo([{ p: [1.46, dh(0), 0], c: 1.6, t: 0.12, cam: 0.025, noCap: true }, { p: [1.46, dh(2.6), s * 2.6], c: 1.6, t: 0.12, cam: 0.025 }, { p: [1.46, dh(4.9), s * 4.9], c: 1.6, t: 0.12, cam: 0.025 },
        { p: [1.43, dh(5.18), s * 5.18], c: 1.5, t: 0.11, cam: 0.02 }, { p: [1.36, dh(5.32), s * 5.32], c: 1.22, t: 0.09, cam: 0.015 }, { p: [1.22, dh(5.37), s * 5.37], c: 0.82, t: 0.06, cam: 0.01 }], { up: "y", n: 14 });
      var w = c.add(g, wingMat, 0, 0, 0, grp); c.deform.push(w); wings.push(w);
      if (s < 0) ZG.cutMesh(w, [EA.cutT([0.55, 1.3, 0.85, 1.1, null, 0.32], function (n) { return n.y > 0.5; })], 30);
      /* nervuras do entelado (filetes discretos no extradorso) e articulação do aileron */
      for (var z = 0.6; z < 5.0; z += 0.36) c.rb(1.25, 0.006, 0.012, 0.003, CM("#d9a81e", { roughness: 0.5 }), 0.9, dh(z) + 0.097, s * z, PG).castShadow = false;
      c.rb(0.012, 0.012, 2.4, 0.004, MT.dark, -0.06, dh(3.7) + 0.05, s * 3.7, PG).castShadow = false;
      EA.navLight(c, 1.0, dh(5.35), s * 5.4, s > 0 ? "verde" : "vermelha", "Luz de navegação " + (s > 0 ? "direita (verde)" : "esquerda (vermelha)"), { parent: grp, r: 0.035 });
      /* montantes em V: da longarina de baixo até as longarinas da asa, e montantes intermediários */
      var f0 = new V3(0.85, -0.44, s * 0.35), fa = new V3(1.18, dh(3.0) - 0.06, s * 3.0), fb = new V3(0.22, dh(3.0) - 0.04, s * 3.0);
      [fa, fb].forEach(function (q) { var st = c.rod(f0, q, 0.024, body, { parent: grp, seg: 10 }); st.scale.x = 1.6; c.deform.push(st); });
      var ma = f0.clone().lerp(fa, 0.55), mb = f0.clone().lerp(fb, 0.55);
      c.rod(ma, new V3(ma.x, dh(ma.z * s) - 0.05, ma.z), 0.01, MT.steel, PG); c.rod(mb, new V3(mb.x, dh(mb.z * s) - 0.04, mb.z), 0.01, MT.steel, PG);
      c.rb(0.1, 0.04, 0.06, 0.015, MT.steel, 0.85, -0.45, s * 0.35, PG);
      return w;
    }
    semiAsa(1); semiAsa(-1);
    /* claraboia (vidro sobre a cabine, no centro da asa esquerda/direita) */
    var sky = c.rb(0.68, 0.012, 0.6, 0.006, MT.glass, 0.92, 0.94, 0, PG); sky.castShadow = false;
    var lpP = P(1.46, 0.84, -2.2); EA.lamp(c, lpP.x, lpP.y, lpP.z, 0.055, "Farol de pouso (asa esquerda)");
    /* empenagem: profundor de pontas redondas, deriva e leme grande arredondado, estais de arame */
    var tailMat = c.paint(yel);
    [1, -1].forEach(function (s) {
      var hs = c.add(EA.foilGeo([{ p: [-2.78, 0.1, 0], c: 0.78, t: 0.07 }, { p: [-2.85, 0.1, s * 1.1], c: 0.74, t: 0.07 }, { p: [-2.95, 0.1, s * 1.36], c: 0.6, t: 0.06 }, { p: [-3.1, 0.1, s * 1.46], c: 0.32, t: 0.05 }], { up: "y", n: 10 }), tailMat, 0, 0, 0, grp); c.deform.push(hs);
      c.rod(new V3(-3.1, 0.12, s * 0.75), new V3(-3.15, 0.75, 0), 0.004, MT.steel, PG); c.rod(new V3(-3.1, 0.1, s * 0.75), new V3(-3.0, -0.08, s * 0.08), 0.004, MT.steel, PG);
    });
    var fin = c.add(EA.foilGeo([{ p: [-2.85, 0.2, 0], c: 0.72, t: 0.08 }, { p: [-2.98, 0.6, 0], c: 0.7, t: 0.08 }, { p: [-3.1, 0.9, 0], c: 0.6, t: 0.07 }, { p: [-3.24, 1.06, 0], c: 0.44, t: 0.06 }, { p: [-3.38, 1.12, 0], c: 0.2, t: 0.05 }], { up: "z", n: 10 }), tailMat, 0, 0, 0, grp); c.deform.push(fin);
    c.rb(0.012, 0.75, 0.05, 0.004, MT.dark, -3.23, 0.6, 0, { parent: grp, rot: [0, 0, 0.08] }).castShadow = false;
    EA.navLight(c, -3.56, 0.3, 0, "branca", "Luz de cauda", { parent: grp, r: 0.03 });
    /* hélice de madeira bipá de 1,83 m (sem spinner) */
    var pr = EA.propeller(c, 3.06, 0.0, 0, { R: 0.915, blades: 2, chord: 0.13, spinner: false, mat: CM("#7a4e2a", { roughness: 0.45, metalness: 0.05 }), tip: "#e3c348", parent: grp });
    c.cyl(0.06, 0.07, 0.08, MT.steel, 3.02, 0, 0, "x", PG);
    EA.bake(c, grp);
    /* vidros moldados (no referencial do chão, pela matriz da atitude) */
    EA.fuseGlass(c, ST, EA.keepT(wsK), "Para-brisa", "laminado", { M: Q.M, pos: P(1.7, 0.55) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(sideW, 0.25, s), s > 0 ? "Janela da porta (direita)" : "Janela lateral esquerda", "temperado", { M: Q.M, pos: P(0.8, 0.4, s * 0.35) });
      EA.fuseGlass(c, ST, EA.sideKeepP(quarter, 0.2, s), "Janelinha traseira " + (s > 0 ? "direita" : "esquerda"), "temperado", { M: Q.M, pos: P(-0.35, 0.4, s * 0.3) });
    });
    ZG.asGlass(c, sky, "Claraboia", "temperado");
    [1, -1].forEach(function (s) { var d0 = P(0.62, 0.06, s * 0.355), d1 = P(0.62, 0.72, s * 0.355); c.rod(d0, d1, 0.012, c.paint(yel)); });
    /* trem principal em V (referencial do chão): pernas dianteira e traseira até o eixo, eixo bipartido até o centro, elásticos */
    var leg = CM("#e0b020", { roughness: 0.45, metalness: 0.2 }), A = P(1.62, -0.78), gearObjs = [];
    [1, -1].forEach(function (s) {
      var ax = new V3(A.x, 0.25, s * 0.86), f1 = P(2.0, -0.45, s * 0.34), f2 = P(1.22, -0.47, s * 0.34), mid = P(1.6, -0.48, s * 0.06);
      gearObjs.push(c.rod(f1, ax, 0.024, leg), c.rod(f2, ax, 0.024, leg), c.rod(mid, ax, 0.02, MT.steel));
      c.cyl(0.04, 0.04, 0.12, MT.dark, P(1.62, -0.5, s * 0.3).x, P(1.62, -0.5).y, s * 0.3, "x");
      c.wheel(A.x, s * 0.915, 0.25, 0.16, { spokes: 0, rimR: 0.42, noPart: true, rim: CM("#d9d7d0", { metalness: 0.4 }) });
    });
    /* bequilha em feixe de mola, com volante de direção */
    var t0 = P(-3.1, -0.05), t1 = P(-3.24, -0.27);
    c.rod(t0, new V3(t1.x, t1.y + 0.03, 0), 0.016, MT.steel);
    c.wheel(t1.x, 0.0001, 0.075, 0.05, { spokes: 0, noPart: true, rim: MT.steel });
    c.part("helice", "Hélice de madeira", pr, P(3.08, 0), 0.8); c.part("motor", "Motor Continental A-65", null, P(2.5, 0), 0.8);
    c.part("tanque", "Tanque no nariz (45 L)", null, P(2.0, 0.1), 0.6); c.part("trem", "Trem de pouso em V", null, new V3(A.x, 0.35, 0), 1.0);
    var F = P(3.1, 0).x, R = P(-3.6, 0.5).x;
    Object.assign(c.meta, { kind: "plane", L: F - R, W: 10.74, fusW: 0.71, front: F, rear: R, clear: 0.55, belt: 1.3, bodyH: 1.2, top: 2.05, roof: null });
    var bx = function (x0, x1) { return [P(x0, 0).x, P(x1, 0).x]; };
    c.zone("cabine", "Cabine, porta bipartida e janelas", bx(-0.65, 1.38).concat([0.55, 2.0, -0.5, 0.5]), null, { dir: "esquerda", fxKey: "cabineaero", who: "o piloto e o passageiro", anyMesh: true });
    c.zone("nariz", "Capô, cilindros e hélice", bx(1.38, 3.3).concat([0.45, 2.45, -0.55, 0.55]));
    c.zone("fuselagem", "Fuselagem traseira (entelada)", bx(-2.75, -0.65).concat([0.3, 1.6, -0.4, 0.4]));
    c.zone("cauda", "Leme, profundor e bequilha", bx(-3.8, -2.75).concat([-0.05, 1.7, -1.6, 1.6]));
    c.zone("tanques", "Tanque no nariz (45 L)", bx(1.75, 2.3).concat([1.1, 1.85, -0.36, 0.36]), null, { type: "interno", fxKey: "tanque", sub: "tanque", pos: P(2.0, 0.1) });
    c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)");
    c.zone("lanterna_c", "Luz de cauda"); c.zone("farol_e", "Farol de pouso");
    c.meta.armor = function (c2) {
      /* modificado de mato: pneus balão de 0,8 m (tundra), casulo de carga na barriga, galões no banco de trás, corta-fio e holofote */
      var tun = CM("#1b1b1a", { roughness: 0.95 });
      [1, -1].forEach(function (s) { c2.cyl(0.4, 0.4, 0.3, tun, A.x, 0.4, s * 0.93, "z", { seg: 26 }); c2.cyl(0.14, 0.14, 0.31, MT.steel, A.x, 0.4, s * 0.93, "z"); });
      var pd = pod(c2, ZG.EA, P(1.4, -0.6).x, P(-1.2, -0.45).x, P(0.1, -0.66).y, 0, 0.17, CM("#5c6052", { roughness: 0.6, metalness: 0.2 }));
      pd.rotation.z = 0; c2.part("carga", "Casulo de carga", pd, new V3(0.4, 0.95, 0), 0.8);
      ZG.jerry(c2, P(-0.22, -0.2).x, P(-0.22, -0.2).y, 0.0, "#8e2a20");
      var cw = P(1.95, 0.4), cw2 = P(1.35, 1.0); c2.rod(cw, cw2, 0.018, ZG.STEELM);
      EA.lamp(c2, P(1.5, 0.8).x, P(1.5, 0.8).y, 2.6, 0.08, "Holofote de busca");
    };
  });
  /* ================= Bandeirantte EMB-110 ================= */
  /* Referência · Embraer EMB-110P1 Bandeirante — WebSearch/WebFetch (Wikipedia "Embraer EMB 110 Bandeirante", aerocorner, skybrary); trem de memória
     Medidas reais: comprimento 15,10 m · envergadura 15,33 m · altura 4,92 m · área da asa 29,1 m² · hélices Hartzell tripá de 2,36 m ·
     bitola do trem principal ≈ 4,94 m e entre-eixos ≈ 4,26 m (de memória) · pneus ≈ 0,66 m (principal) e 0,52 m (bequilha) (de memória) ·
     fuselagem ≈ 1,72 m de largura e 1,85 m de altura (de memória) · balanço dianteiro (bequilha ao nariz) ≈ 2,2 m · barriga a ≈ 0,8 m do chão.
     Traços de assinatura:
       frente: nariz comprido e afilado, para-brisa de duas peças em V, naceles dos PT6 bem à frente do bordo de ataque com hélices tripá
               e tomada de ar no queixo da nacele, asa baixa com diedro bem marcado
       lateral: fuselagem comprida e reta com fileira de 8 janelas quadradas de cantos arredondados, porta de carga grande atrás à esquerda,
                escapamentos dos PT6 saindo pelos lados da nacele logo atrás da hélice, trem principal recolhendo na nacele, faixa azul na linha das janelas
       traseira: deriva alta e enflechada com barbatana dorsal longa, profundor com diedro forte (≈ 10°) preso no cone de cauda
       teto: asa reta trapezoidal com pontas retas, naceles longas que passam do bordo de fuga, profundor em V raso */
  ZG.register({ k: "bandeirante", grp: "Aéreos", n: "Bandeirantte EMB-110", insp: "Embraer EMB-110 Bandeirante", c: "Bimotor turboélice regional, 2 + 16 lugares", fuel: "qav",
    d: "O avião que ligou o interior do Brasil. Pousa em pista de terra curta, leva dezesseis pessoas e carga, e tem dois motores: perde um e ainda volta.",
    mass: 5900, r: 650, seats: "2 pilotos + 16 passageiros", cap: "1.720 L", eff: "≈ 300 L/h (dois motores)", auto: "1.960 km", vmax: 430, skill: "Pilotagem aérea 4 (bimotor)", hood: false
  }, function (c) {
    var EA = ZG.EA, wcol = "#ecebe6", white = c.paint(wcol), blue = c.paint("#1d4f8c"), grey = c.paint("#8e959a"), blk = CM("#1c1d1f", { roughness: 0.6 });
    var ST = [[7.58, 1.5, 1.62, 0.08, 2], [7.35, 1.3, 1.82, 0.56, 2.2], [6.8, 1.04, 2.08, 1.08, 2.4], [6.1, 0.9, 2.34, 1.44, 2.6], [5.3, 0.82, 2.6, 1.66, 2.8], [4.5, 0.8, 2.66, 1.72, 3],
      [-2.6, 0.8, 2.66, 1.72, 3], [-3.6, 0.96, 2.64, 1.6, 2.8], [-5.0, 1.38, 2.6, 1.14, 2.5], [-6.5, 1.84, 2.55, 0.62, 2.3], [-7.35, 2.1, 2.5, 0.3, 2.2], [-7.52, 2.2, 2.46, 0.08, 2]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 36 }), white);
    var wsK = [5.2, 6.3, 1.92, 2.75, null, 0.84], ckP = [[5.98, 2.0], [4.78, 2.02], [4.78, 2.42], [5.25, 2.56], [6.0, 2.3]];
    var wins = []; for (var i = 0; i < 8; i++) { var wx = 3.85 - i * 0.82; wins.push(rrect(wx - 0.4, wx, 1.8, 2.24, 0.09)); }
    var winF = polysSdf(EA, wins);
    var winCut = { sel: function (n) { return Math.abs(n.z) > 0.3; }, sdf: function (x, y, z) { return Math.max(winF(x, y), 0.5 - Math.abs(z)); } };
    ZG.cutMesh(fus, [EA.cutT(wsK, function (n) { return n.x > 0.2 && n.y > 0.05; }), EA.sideCutP(ckP, 0.5)], 40);
    ZG.cutMesh(fus, [winCut], 40, { sub: 0.15 });
    c.deform.push(fus);
    /* faixas: azul larga na linha das janelas com filete, barriga cinza */
    var yc = function (x) { return x > -3.6 ? 1.68 : 1.68 + (-3.6 - x) * 0.13; };
    fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.07 - Math.abs(y - yc(x)), x + 7.2, 7.1 - x, Math.abs(z) - 0.2); }), blue, { sub: 0.08, pre: EA.keepT([-7.3, 7.2, 1.45, 2.3, 0.15]) });
    fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.024 - Math.abs(y - yc(x) - 0.64), x + 6.0, 6.0 - x, Math.abs(z) - 0.3); }), blue, { k: 1.005, sub: 0.06, pre: EA.keepT([-6.2, 6.2, 2.1, 2.5, 0.25]) });
    EA.fuseSkin(c, ST, EA.bandT(function (x, y) { return Math.min(1.08 - y, x + 7.3); }), grey);
    EA.fuseGlass(c, ST, EA.keepT(wsK), "Para-brisa", "laminado", { pos: new V3(5.8, 2.35, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(ckP, 0.5, s), "Janela da cabine de pilotagem " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(5.4, 2.25, s * 0.8) });
      fGlass(c, EA, ST, { sdf: function (x, y, z) { return -Math.max(winF(x, y), 0.5 - s * z); } }, "Janelas da cabine " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(1.0, 2.0, s * 0.85), pre: EA.keepT([-2.8, 4.0, 1.7, 2.34, 0.4]) });
      sideText(c, ST, "PT-ZBN", 1.3, 0.28, -5.2, 2.08, s, { fg: "#1d4f8c" });
    });
    /* porta de carga e de passageiros (traseira esquerda) e alçapão de emergência: frestas */
    var doorF = EA.polySdf(rrect(-3.55, -2.3, 0.96, 2.46, 0.12));
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.008 - Math.abs(doorF(x, y)), -z - 0.5); }), MT.dark, { k: 1.003 });
    c.rb(0.16, 0.03, 0.03, 0.01, MT.chrome, -2.5, 1.7, -0.875);
    c.rod(new V3(6.32, 2.72, 0), new V3(5.22, 1.95, 0), 0.02, blk);
    /* interior: cabine de pilotagem (2 bancos, manches, painel, pedestal) e 8 fileiras de bancos individuais com corredor */
    var fl = 0.98, fab = CM("#3d4552", { roughness: 0.9 });
    liner(c, ST, -4.6, 5.9, fl, MT.carpet, { h: 0.03 });
    [0.38, -0.38].forEach(function (z) { ZG.seat(c, 4.95, fl, z, { w: 0.5, h: 0.38, back: 0.7, lean: 0.14, mat: CM("#2a2c30", { roughness: 0.8 }) }); ZG.yoke(c, 5.5, 1.75, z); EA.pedals(c, 5.95, fl, z); });
    EA.instPanel(c, 5.75, 1.88, 1.4, { gauges: 10, z0: -0.6, tilt: 0.25 });
    c.rb(0.5, 0.35, 0.22, 0.04, CM("#232427"), 5.35, fl + 0.4, 0); [-0.05, 0.05].forEach(function (z) { c.rod(new V3(5.4, fl + 0.58, z), new V3(5.3, fl + 0.7, z), 0.012, MT.chrome); });
    c.rb(0.04, 1.3, 1.3, 0.02, CM("#5d6066", { roughness: 0.9 }), 4.45, 1.72, 0, {}).castShadow = false;
    for (var r = 0; r < 8; r++) [0.5, -0.5].forEach(function (z) { ZG.seat(c, 3.62 - r * 0.82, fl, z, { w: 0.48, h: 0.38, back: 0.68, lean: 0.14, mat: fab }); });
    liner(c, ST, -4.3, 4.5, 2.48, MT.headliner);
    /* asa baixa trapezoidal com diedro de 7°, bordo de fuga reto */
    var wingMat = c.paint(wcol), dh = function (z) { return 0.98 + Math.max(0, Math.abs(z) - 0.8) * 0.122; }, nacs = { 1: [], "-1": [] }, props = {}, legs = [];
    [1, -1].forEach(function (s) {
      var w = c.add(EA.foilGeo([{ p: [1.52, dh(0), 0], c: 2.38, t: 0.15, cam: 0.02 }, { p: [1.52, dh(0.86), s * 0.86], c: 2.38, t: 0.15, cam: 0.02 }, { p: [1.42, dh(2.47), s * 2.47], c: 2.25, t: 0.145, cam: 0.02 },
        { p: [0.98, dh(7.42), s * 7.42], c: 1.4, t: 0.12, cam: 0.02 }, { p: [0.92, dh(7.66), s * 7.66], c: 1.25, t: 0.07, cam: 0.01 }], { up: "y", n: 14 }), wingMat);
      c.deform.push(w);
      c.rb(0.012, 0.012, 2.6, 0.004, MT.dark, -0.62, dh(4.0) + 0.12, s * 4.0, { rot: [s * 0.122, 0, 0] }).castShadow = false;
      c.rb(0.012, 0.012, 2.2, 0.004, MT.dark, -0.32, dh(6.3) + 0.1, s * 6.3, { rot: [s * 0.122, 0, 0] }).castShadow = false;
      EA.navLight(c, 0.6, dh(7.66), s * 7.7, s > 0 ? "verde" : "vermelha", "Luz de navegação " + (s > 0 ? "direita (verde)" : "esquerda (vermelha)"));
      /* nacele do PT6: longa, à frente do bordo de ataque, com tomada de ar no queixo e dois escapamentos laterais */
      var z0 = s * 2.47, NS = [[4.0, 1.36, 1.5, 0.16, 2], [3.86, 1.12, 1.68, 0.5, 2.2], [3.4, 1.0, 1.78, 0.62, 2.4], [2.4, 0.98, 1.8, 0.64, 2.6], [0.8, 0.98, 1.72, 0.62, 2.6], [-0.3, 1.06, 1.58, 0.5, 2.4], [-1.05, 1.22, 1.42, 0.16, 2]];
      NS.forEach(function (q) { q.push(z0); });
      var nac = c.add(EA.fuseGeo(NS, { smooth: 30, seg: 24 }), white); c.deform.push(nac); nacs[s].push(nac);
      var nb = EA.fuseSkin(c, NS, EA.bandT(function (x, y) { return Math.min(0.05 - Math.abs(y - 1.58 + (x < 0 ? x * 0.03 : 0)), x + 0.9, 3.75 - x); }), blue); nacs[s].push(nb);
      nacs[s].push(c.rb(0.3, 0.12, 0.34, 0.05, MT.dark, 3.72, 1.08, z0));
      [1, -1].forEach(function (q) { var ex = c.cyl(0.085, 0.1, 0.32, MT.steel, 3.2, 1.46, z0 + q * 0.33, "x", { seg: 14 }); ex.rotation.y = -q * 0.55; nacs[s].push(ex); var eo = c.cyl(0.07, 0.07, 0.02, MT.dark, 3.07, 1.46, z0 + q * 0.42, "x"); eo.rotation.y = -q * 0.55; nacs[s].push(eo); });
      props[s] = EA.propeller(c, 4.1, 1.43, z0, { R: 1.18, blades: 3, chord: 0.2, spinL: 0.42, spinR: 0.2, phase: s > 0 ? 0.2 : 0.9, v: s > 0 ? 7 : -7 });
      c.part("helice", "Hélice " + (s > 0 ? "direita" : "esquerda"), props[s], new V3(4.2, 1.43, z0), 0.9);
      /* trem principal recolhendo na nacele: perna, braço, portas abertas */
      legs.push(c.rod(new V3(1.12, 1.04, z0), new V3(1.02, 0.33, z0 + s * 0.06), 0.055, MT.chrome), c.rod(new V3(1.6, 1.02, z0), new V3(1.05, 0.5, z0), 0.03, MT.steel));
      [1, -1].forEach(function (q) { legs.push(c.rb(1.05, 0.34, 0.02, 0.01, white, 1.25, 0.84, z0 + q * 0.27)); });
      c.wheel(1.02, z0 + s * 0.06, 0.33, 0.2, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#c9ccce", { metalness: 0.5 }) });
    });
    EA.lamp(c, 1.52, dh(1.6) - 0.02, 1.6, 0.06, "Farol de pouso direito"); EA.lamp(c, 1.52, dh(1.6) - 0.02, -1.6, 0.06, "Farol de pouso esquerdo");
    /* bequilha com farol de táxi e portas */
    legs.push(c.rod(new V3(5.32, 0.92, 0), new V3(5.3, 0.26, 0), 0.04, MT.chrome), c.rod(new V3(5.65, 0.86, 0), new V3(5.32, 0.5, 0), 0.02, MT.steel));
    [1, -1].forEach(function (q) { legs.push(c.rb(0.75, 0.3, 0.02, 0.01, white, 5.4, 0.72, q * 0.2)); });
    c.wheel(5.3, 0.0001, 0.26, 0.16, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#c9ccce", { metalness: 0.5 }) });
    var tx = EA.lamp(c, 5.42, 0.82, 0.0001, 0.045, "Farol de táxi"); void tx;
    /* empenagem: deriva alta enflechada com barbatana dorsal, profundor com diedro forte */
    var tm = c.paint(wcol);
    var fin = c.add(EA.foilGeo([{ p: [-4.8, 2.48, 0], c: 2.75, t: 0.11 }, { p: [-6.42, 4.84, 0], c: 1.12, t: 0.1 }], { up: "z", n: 10 }), tm); c.deform.push(fin);
    var dors = c.add(EA.foilGeo([{ p: [-2.95, 2.6, 0], c: 1.9, t: 0.04 }, { p: [-4.82, 3.15, 0], c: 0.3, t: 0.06 }], { up: "z", n: 8 }), tm); c.deform.push(dors);
    var finB = c.add(EA.foilGeo([{ p: [-4.79, 2.48, 0], c: 2.77, t: 0.115 }, { p: [-6.41, 4.845, 0], c: 1.14, t: 0.105 }], { up: "z", n: 10 }), c.paint("#1d4f8c")); finB.castShadow = false;
    ZG.cutMesh(finB, [EA.bandT(function (x, y) { var yy = 3.3 + (x + 6.0) * 0.4; return Math.min(0.16 - Math.abs(y - yy), 4.7 - y); })], 40); c.deform.push(finB);
    c.rb(0.012, 2.1, 0.03, 0.004, MT.dark, -6.85, 3.6, 0, { rot: [0, 0, -0.35] }).castShadow = false;
    [1, -1].forEach(function (s) {
      var hs = c.add(EA.foilGeo([{ p: [-5.95, 2.3, 0], c: 1.55, t: 0.1 }, { p: [-6.62, 2.3 + 3.2 * 0.176, s * 3.2], c: 0.86, t: 0.09 }], { up: "y", n: 10 }), tm); c.deform.push(hs);
    });
    EA.navLight(c, -7.6, 2.32, 0, "branca", "Luz de cauda", { r: 0.035 });
    EA.navLight(c, -6.95, 4.9, 0, "vermelha", "Farol anticolisão (deriva)", { r: 0.045 });
    EA.navLight(c, 0.2, 0.77, 0, "vermelha", "Farol anticolisão (barriga)", { r: 0.04 });
    /* antenas e pitots */
    c.rod(new V3(6.9, 1.7, 0.45), new V3(7.3, 1.7, 0.45), 0.012, MT.steel); c.rod(new V3(6.9, 1.7, -0.45), new V3(7.3, 1.7, -0.45), 0.012, MT.steel);
    c.rb(0.3, 0.18, 0.02, 0.01, blk, 1.5, 2.72, 0, { rot: [0, 0, -0.4] }); c.rb(0.25, 0.15, 0.02, 0.01, blk, -1.5, 0.74, 0, { rot: [0, 0, 0.4] });
    c.part("motor", "Motor esquerdo (PT6A-34)", null, new V3(2.8, 1.4, -2.47), 1.0); c.part("motor", "Motor direito (PT6A-34)", null, new V3(2.8, 1.4, 2.47), 1.0);
    c.part("tanque", "Tanques integrais nas asas", null, new V3(0.4, 1.2, 4.0), 1.2); c.part("trem", "Trem de pouso", null, new V3(1.02, 0.4, 2.5), 1.0);
    Object.assign(c.meta, { kind: "plane", L: 15.1, W: 15.33, fusW: 1.72, front: 7.6, rear: -7.6, clear: 0.8, belt: 1.75, bodyH: 1.86, top: 4.92, roof: null });
    var fz = 1.0;
    c.zone("nariz", "Nariz e cabine de pilotagem", [4.7, 7.8, 0.75, 2.85, -fz, fz], [], { replace: true, dir: "frente", fxKey: "nariz", who: "os pilotos" });
    c.zone("cabine", "Cabine de passageiros e janelas", [-2.2, 4.7, 0.75, 2.8, -fz, fz], null, { dir: "esquerda", fxKey: "cabineaero", who: "os passageiros", anyMesh: true });
    c.zone("porta_carga", "Porta de carga (esquerda)", [-3.7, -2.2, 0.75, 2.6, -1.2, -0.4], null, { dir: "esquerda", fxKey: "porta", who: "quem está no fundo da cabine" });
    c.zone("fuselagem", "Cone de cauda", [-5.2, -2.2, 0.85, 2.8, -fz, fz]);
    c.zone("cauda", "Deriva e profundor", [-7.8, -5.2, 1.6, 5.1, -3.5, 3.5]);
    [1, -1].forEach(function (s) {
      var sid = s > 0 ? "d" : "e", z0 = s * 2.47;
      c.zone("motor_" + sid, "Motor " + (s > 0 ? "direito" : "esquerdo") + " e nacele", [-1.7, 3.95, 0.9, 1.9, z0 - 0.45, z0 + 0.45], nacs[s], { side: s, dir: "frente", fxKey: "motor", sub: "motor", anyMesh: true, pos: new V3(2.8, 1.4, z0) });
      c.zone("helice_" + sid, "Hélice " + (s > 0 ? "direita" : "esquerda"), [3.9, 4.6, 0.2, 2.65, z0 - 1.25, z0 + 1.25], [props[s]], { type: "peca", kindPart: "helice", side: s, dir: "tras", fxKey: "nariz" });
    });
    c.zone("trem", null, null, legs);
    c.zone("farol_c", "Faróis de pouso e táxi"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)"); c.zone("lanterna_c", "Luz de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado para resgate em zona de horda: tanques na ponta da asa, chapas de aço sob a cabine de pilotagem,
         grade no para-brisa, holofote de busca sob a asa esquerda e caixas de suprimento amarradas no corredor */
      var stl = ZG.STEELM, tk = CM("#d8d6cf", { roughness: 0.5, metalness: 0.2 });
      [1, -1].forEach(function (s) { pod(c2, EA, 1.6, -0.9, dh(7.66), s * 7.85, 0.24, tk); c2.rb(1.1, 0.55, 0.02, 0.02, stl, 5.3, 1.25, s * 0.87); });
      for (var k = -0.7; k <= 0.71; k += 0.14) c2.rod(new V3(6.35, 1.95, k), new V3(5.2, 2.72, k * 0.85), 0.008, stl);
      c2.cyl(0.12, 0.1, 0.2, MT.steel, 1.2, dh(4.5) - 0.25, -4.5, "x"); EA.lamp(c2, 1.32, dh(4.5) - 0.25, -4.5, 0.1, "Holofote de busca");
      [2.6, 1.0, -0.6].forEach(function (x) { c2.rb(0.5, 0.35, 0.4, 0.03, CM("#3d3a2e"), x, fl + 0.2, 0); });
      c2.part("carga", "Suprimentos no corredor", null, new V3(1.0, 1.2, 0), 1.0);
    };
  });

  /* ================= Caravana Anfíbio ================= */
  /* Referência · Cessna 208 Caravan Amphibian (flutuadores Wipline 8000) — WebFetch (AOPA "Cessna Caravan Amphibian"), resto de memória
     Medidas reais: comprimento 11,61 m (38 ft 1 in) · envergadura 15,88 m · altura 5,21 m (17 ft 1 in) · área da asa 25,96 m² ·
     hélice McCauley tripá ≈ 2,54 m (de memória) · flutuadores ≈ 8,2 m de comprimento, 0,82 m de boca, bitola ≈ 2,9 m (de memória) ·
     rodas de pouso nos flutuadores: duas no bico (≈ 0,34 m) e duas atrás do degrau (≈ 0,5 m) · fuselagem ≈ 1,70 m de largura (de memória) ·
     tanque 1.257 L (332 gal) · PT6A-114A de 675 shp.
     Traços de assinatura:
       frente: nariz comprido e quadrado do PT6 com tomada de ar em boca sob o spinner, escapamento do lado direito, asa alta com
               montante único por lado, flutuadores enormes com rodas no bico
       lateral: fuselagem alta e quadrada com janelas quadradas grandes, porta de carga dupla atrás à esquerda, barriga que sobe até a cauda,
                montantes em N dos flutuadores, degrau no fundo do flutuador, deriva grande com barbatana dorsal
       traseira: barbatanas auxiliares sob as pontas do profundor e barbatana ventral (exigência do anfíbio), lemes d'água nas popas
       teto: asa reta no meio e afilada nas pontas, flutuadores mais compridos que meia fuselagem com escotilhas e cunhos */
  ZG.register({ k: "caravana", grp: "Aéreos", n: "Caravana Anfíbio", insp: "Cessna 208 Caravan anfíbio (flutuadores Wipline)", c: "Monomotor turboélice anfíbio, 10 lugares", fuel: "qav",
    d: "Pousa em rio, represa e pista. Na Amazônia vira ônibus, ambulância e caminhão. Os flutuadores aguentam o tranco, mas atolar na margem é um risco.",
    mass: 3629, r: 500, seats: "1 piloto + 9 passageiros", cap: "1.257 L", eff: "≈ 200 L/h", auto: "1.500 km", vmax: 300, skill: "Pilotagem aérea 4 (hidroavião)", hood: false
  }, function (c) {
    var EA = ZG.EA, wcol = "#eceae3", white = c.paint(wcol), navy = c.paint("#1e2f55"), gold = c.paint("#c99a2e"), blk = CM("#1c1d1f", { roughness: 0.6 });
    var ST = [[5.0, 2.26, 2.86, 0.62, 2.2], [4.75, 2.08, 3.0, 0.98, 2.6], [4.0, 2.0, 3.08, 1.22, 3], [3.0, 1.96, 3.18, 1.42, 3.2], [2.3, 1.95, 3.38, 1.62, 3.4], [1.6, 1.95, 3.6, 1.7, 3.6],
      [-2.4, 1.95, 3.62, 1.7, 3.6], [-3.3, 2.18, 3.55, 1.5, 3.2], [-4.6, 2.72, 3.42, 0.92, 2.8], [-5.75, 3.05, 3.38, 0.42, 2.4], [-6.05, 3.15, 3.35, 0.12, 2]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 36 }), white);
    var wsK = [1.5, 2.5, 2.95, 3.66, null, 0.86], ckP = [[1.6, 2.75], [0.72, 2.75], [0.72, 3.42], [1.48, 3.48], [1.92, 3.18]];
    var wins = [0.0, -0.78, -1.56, -2.34].map(function (x) { return rrect(x - 0.52, x, 2.74, 3.22, 0.1); }), winF = polysSdf(EA, wins);
    var winCut = { sel: function (n) { return Math.abs(n.z) > 0.3; }, sdf: function (x, y, z) { return Math.max(winF(x, y), 0.5 - Math.abs(z)); } };
    ZG.cutMesh(fus, [EA.cutT(wsK, function (n) { return n.x > 0.15 && n.y > 0.1; }), EA.sideCutP(ckP, 0.5)], 40);
    ZG.cutMesh(fus, [winCut], 40, { sub: 0.1 });
    c.deform.push(fus);
    /* faixas: azul-marinho com filete dourado subindo para a cauda */
    var yc = function (x) { return x > -2.5 ? 2.42 : 2.42 + (-2.5 - x) * 0.3; };
    fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.1 - Math.abs(y - yc(x)), x + 5.9, 4.95 - x, Math.abs(z) - 0.2); }), navy, { sub: 0.08, pre: EA.keepT([-6.0, 5.0, 2.2, 3.4, 0.15]) });
    fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.02 - Math.abs(y - yc(x) - 0.15), x + 5.9, 4.6 - x, Math.abs(z) - 0.2); }), gold, { k: 1.005, sub: 0.05, pre: EA.keepT([-6.0, 4.7, 2.4, 3.5, 0.15]) });
    EA.fuseGlass(c, ST, EA.keepT(wsK), "Para-brisa", "laminado", { pos: new V3(2.0, 3.3, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(ckP, 0.5, s), "Janela da porta do " + (s > 0 ? "copiloto" : "piloto"), "temperado", { pos: new V3(1.2, 3.1, s * 0.84) });
      fGlass(c, EA, ST, { sdf: function (x, y, z) { return -Math.max(winF(x, y), 0.5 - s * z); } }, "Janelas da cabine " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(-1.2, 3.0, s * 0.85), pre: EA.keepT([-3.0, 0.15, 2.6, 3.35, 0.4]) });
      var df = EA.polySdf(ckP.map(function (q) { return [q[0] + (q[0] > 1.2 ? 0.06 : -0.06), q[1] + (q[1] > 3.0 ? 0.06 : -0.7)]; }));
      EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.007 - Math.abs(df(x, y)), s * z - 0.5); }), MT.dark, { k: 1.003 });
      sideText(c, ST, "PR-ZCA", 1.0, 0.22, -4.3, 3.25, s, { fg: "#1e2f55" });
    });
    var cgo = EA.polySdf(rrect(-3.3, -2.05, 2.05, 3.42, 0.1));
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.008 - Math.min(Math.abs(cgo(x, y)), x > -3.3 && x < -2.05 && y > 2.05 && y < 3.42 ? Math.abs(x + 2.7) : 9), -z - 0.5); }), MT.dark, { k: 1.003 });
    /* nariz do PT6: tomada de ar em boca, escapamento à direita, saídas laterais */
    c.rb(0.28, 0.22, 0.5, 0.08, MT.dark, 4.92, 2.22, 0);
    var ex = c.cyl(0.12, 0.14, 0.45, MT.steel, 4.35, 2.62, 0.62, "x", { seg: 16 }); ex.rotation.y = -0.5; c.cyl(0.1, 0.1, 0.02, MT.dark, 4.18, 2.62, 0.72, "x").rotation.y = -0.5;
    [1, -1].forEach(function (s) { for (var k = 0; k < 4; k++) c.rb(0.04, 0.2, 0.02, 0.008, MT.dark, 3.4 - k * 0.09, 2.7, s * (0.66 + 0.004 * k)); });
    var pr = EA.propeller(c, 5.06, 2.56, 0, { R: 1.27, blades: 3, chord: 0.22, spinL: 0.36, spinR: 0.21 });
    /* interior: 2 bancos na frente, 3 fileiras (2 + 1) atrás com o corredor à direita, painel com telas */
    var fl = 2.06, fab = CM("#4a4640", { roughness: 0.9 });
    liner(c, ST, -3.2, 2.0, fl, MT.carpet, { h: 0.03 });
    [0.38, -0.38].forEach(function (z) { ZG.seat(c, 0.95, fl, z, { w: 0.5, h: 0.38, back: 0.7, lean: 0.14, mat: fab }); ZG.yoke(c, 1.5, 2.85, z); EA.pedals(c, 1.95, fl, z); });
    EA.instPanel(c, 1.78, 2.98, 1.42, { gauges: 6, z0: -0.6, tilt: 0.2, screens: [[0.0, -0.36, 0.16, 0.24], [0.0, 0.3, 0.16, 0.24]] });
    c.rb(0.4, 0.3, 0.2, 0.04, CM("#232427"), 1.35, fl + 0.4, 0);
    [0.05, -0.75, -1.55].forEach(function (x) { ZG.seat(c, x, fl, -0.35, { w: 0.9, n: 2, h: 0.38, back: 0.66, lean: 0.14, mat: fab }); ZG.seat(c, x, fl, 0.5, { w: 0.45, h: 0.38, back: 0.66, lean: 0.14, mat: fab }); });
    liner(c, ST, -2.9, 1.9, 3.5, MT.headliner);
    /* asa alta: reta no centro, afilada nas pontas, diedro de 3°, montante único por lado */
    var wingMat = c.paint(wcol), dh = function (z) { return 3.72 + Math.abs(z) * 0.05; }, wingsM = [];
    [1, -1].forEach(function (s) {
      var w = c.add(EA.foilGeo([{ p: [1.56, dh(0), 0], c: 1.98, t: 0.15, cam: 0.025, noCap: true }, { p: [1.56, dh(3.6), s * 3.6], c: 1.98, t: 0.15, cam: 0.025 }, { p: [1.38, dh(7.7), s * 7.7], c: 1.3, t: 0.12, cam: 0.02 }, { p: [1.32, dh(7.94), s * 7.94], c: 1.1, t: 0.06, cam: 0.01 }], { up: "y", n: 14 }), wingMat);
      c.deform.push(w); wingsM.push(w);
      c.rb(0.012, 0.012, 3.2, 0.004, MT.dark, -0.3, dh(2.0) + 0.1, s * 2.0).castShadow = false;
      c.rb(0.012, 0.012, 3.4, 0.004, MT.dark, -0.15, dh(5.8) + 0.1, s * 5.8).castShadow = false;
      EA.navLight(c, 0.9, dh(7.94), s * 7.98, s > 0 ? "verde" : "vermelha", "Luz de navegação " + (s > 0 ? "direita (verde)" : "esquerda (vermelha)"));
      var st = c.rod(new V3(0.55, 2.0, s * 0.82), new V3(0.75, dh(4.4) - 0.1, s * 4.4), 0.045, white, { seg: 10 }); st.scale.x = 1.9; c.deform.push(st);
      c.rb(0.2, 0.08, 0.12, 0.03, MT.steel, 0.55, 2.0, s * 0.84);
    });
    EA.lamp(c, 1.56, dh(2.4) - 0.02, -2.4, 0.07, "Farol de pouso (asa esquerda)"); EA.lamp(c, 1.56, dh(2.6) - 0.02, 2.6, 0.06, "Farol de táxi (asa direita)");
    /* flutuadores anfíbios: casco em V com degrau, convés plano, escotilhas, cunhos e lemes d'água */
    var flMat = c.paint("#d9dbd8", { metalness: 0.4, roughness: 0.4 }), floats = [], fstr = [], legs2 = [];
    [1, -1].forEach(function (s) {
      var z0 = s * 1.45, FS = [[4.85, 1.12, 1.22, 0.08, 2], [4.62, 0.9, 1.25, 0.46, 2.2], [3.9, 0.62, 1.26, 0.74, 2.6], [2.5, 0.44, 1.27, 0.84, 2.8], [0.6, 0.39, 1.27, 0.84, 2.8], [-0.3, 0.38, 1.27, 0.82, 2.8],
        [-0.36, 0.52, 1.27, 0.8, 2.8], [-1.7, 0.6, 1.25, 0.72, 2.6], [-3.4, 0.8, 1.21, 0.5, 2.4], [-4.3, 0.98, 1.19, 0.16, 2]];
      FS.forEach(function (q) { q.push(z0); });
      var fm = c.add(EA.fuseGeo(FS, { smooth: 40, seg: 20 }), flMat); c.deform.push(fm); floats.push(fm);
      floats.push(EA.fuseSkin(c, FS, EA.bandT(function (x, y) { return Math.min(0.03 - Math.abs(y - 1.05), x + 4.1, 4.7 - x); }), navy));
      [2.6, 0.9, -1.0, -2.6].forEach(function (x) { floats.push(c.cyl(0.1, 0.1, 0.02, MT.steel, x, 1.265, z0)); });
      [4.2, -3.6].forEach(function (x) { floats.push(c.rb(0.16, 0.03, 0.04, 0.012, MT.chrome, x, 1.26, z0 + s * 0.12)); });
      floats.push(c.rb(0.2, 0.32, 0.02, 0.01, MT.steel, -4.35, 0.82, z0));
      /* montantes em N e estais */
      [[1.65, 1.35], [-0.95, -0.75]].forEach(function (q) { var a = c.rod(new V3(q[0], 1.26, z0), new V3(q[1], 1.97, s * 0.62), 0.04, white, { seg: 10 }); a.scale.x = 1.6; fstr.push(a); });
      fstr.push(c.rod(new V3(1.65, 1.26, z0), new V3(-0.75, 1.97, s * 0.62), 0.025, white));
      /* rodas: bico (bequilha dupla) e principal atrás do degrau */
      legs2.push(c.rod(new V3(4.15, 0.86, z0), new V3(4.1, 0.17, z0), 0.03, MT.steel));
      c.wheel(4.1, z0, 0.17, 0.1, { spokes: 0, rimR: 0.5, noPart: true, rim: MT.steel });
      legs2.push(c.rb(0.6, 0.35, 0.05, 0.02, MT.steel, -0.65, 0.4, z0 + s * 0.3));
      c.wheel(-0.65, z0 + s * 0.06, 0.25, 0.16, { spokes: 0, rimR: 0.5, noPart: true, rim: MT.steel });
    });
    [1.65, -0.95].forEach(function (x) { fstr.push(c.rod(new V3(x, 1.26, 1.45), new V3(x, 1.26, -1.45), 0.012, MT.steel)); fstr.push(c.rod(new V3(x, 1.26, 1.45), new V3(x + (x > 0 ? -2.6 : 2.6) * 0, 1.97, -0.62), 0.006, MT.steel)); });
    /* empenagem: deriva com barbatana dorsal, profundor baixo com barbatanas auxiliares, barbatana ventral */
    var tm = c.paint(wcol);
    var fin = c.add(EA.foilGeo([{ p: [-4.35, 3.36, 0], c: 1.95, t: 0.11 }, { p: [-5.45, 5.12, 0], c: 0.85, t: 0.1 }], { up: "z", n: 10 }), tm); c.deform.push(fin);
    var dors = c.add(EA.foilGeo([{ p: [-2.6, 3.58, 0], c: 1.8, t: 0.04 }, { p: [-4.4, 4.05, 0], c: 0.3, t: 0.06 }], { up: "z", n: 8 }), tm); c.deform.push(dors);
    var finB = c.add(EA.foilGeo([{ p: [-4.34, 3.36, 0], c: 1.97, t: 0.115 }, { p: [-5.44, 5.125, 0], c: 0.87, t: 0.105 }], { up: "z", n: 10 }), navy); finB.castShadow = false;
    ZG.cutMesh(finB, [EA.bandT(function (x, y) { return Math.min(0.18 - Math.abs(y - 4.3 - (x + 5.0) * 0.2), 5.0 - y); })], 40); c.deform.push(finB);
    var ven = c.add(EA.foilGeo([{ p: [-4.9, 2.95, 0], c: 1.0, t: 0.08 }, { p: [-5.5, 2.45, 0], c: 0.55, t: 0.07 }], { up: "z", n: 8 }), tm); c.deform.push(ven);
    [1, -1].forEach(function (s) {
      var hs = c.add(EA.foilGeo([{ p: [-4.8, 3.08, 0], c: 1.55, t: 0.1 }, { p: [-5.15, 3.08, s * 3.1], c: 1.0, t: 0.09 }], { up: "y", n: 10 }), tm); c.deform.push(hs);
      var af = c.add(EA.foilGeo([{ p: [-4.95, 3.05, s * 2.35], c: 0.9, t: 0.07 }, { p: [-5.2, 2.6, s * 2.35], c: 0.6, t: 0.06 }], { up: "z", n: 6 }), tm); c.deform.push(af);
    });
    EA.navLight(c, -6.1, 3.25, 0, "branca", "Luz de cauda", { r: 0.035 });
    EA.navLight(c, -6.0, 5.14, 0, "vermelha", "Farol anticolisão", { r: 0.045 });
    c.rb(0.3, 0.15, 0.02, 0.01, blk, -0.8, 3.68, 0, { rot: [0, 0, -0.4] });
    c.part("helice", "Hélice tripá", pr, new V3(5.15, 2.56, 0), 1.0); c.part("motor", "Turbina PT6A-114A", null, new V3(4.0, 2.55, 0), 1.0);
    c.part("tanque", "Tanques nas asas", null, new V3(0.6, 3.75, 3.0), 1.2); c.part("casco", "Flutuadores", floats[0], new V3(0.5, 0.8, 1.45), 1.4);
    Object.assign(c.meta, { kind: "plane", L: 11.61, W: 15.88, fusW: 1.7, front: 5.4, rear: -6.31, clear: 1.2, belt: 2.75, bodyH: 1.67, top: 5.21, roof: null });
    c.zone("nariz", "Nariz, turbina e hélice", [3.0, 5.5, 1.8, 3.4, -0.95, 0.95], null, { dir: "frente", fxKey: "nariz" });
    c.zone("cabine", "Cabine, portas e janelas", [-2.2, 3.0, 1.8, 3.75, -0.98, 0.98], null, { dir: "esquerda", fxKey: "cabineaero", who: "o piloto e os passageiros", anyMesh: true });
    c.zone("porta_carga", "Porta de carga dupla (esquerda)", [-3.45, -1.95, 1.9, 3.55, -1.2, -0.4], null, { dir: "esquerda", fxKey: "porta", who: "quem está no fundo da cabine" });
    c.zone("fuselagem", "Cone de cauda", [-4.4, -2.2, 2.0, 3.7, -0.95, 0.95]);
    c.zone("cauda", "Deriva, profundor e barbatanas", [-6.4, -4.4, 2.3, 5.3, -3.3, 3.3]);
    c.zone("flutuadores", "Flutuadores e montantes", [-4.5, 5.0, 0.3, 2.0, -2.0, 2.0], floats.concat(fstr), { type: "peca", fxKey: "casco", dir: "cima", anchor: [0.4, 1.97, 0], fx: ["Nenhum", "Riscos no fundo, ainda veda", "Amassado: um compartimento faz água, adernado", "Rachado: afunda de um lado, não decola da água", "Flutuador arrancado: só pousa em pista"] });
    c.zone("trem", "Rodas dos flutuadores", null, legs2);
    c.zone("farol_e", "Farol de pouso (asa esquerda)"); c.zone("farol_d", "Farol de táxi (asa direita)"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)"); c.zone("lanterna_c", "Luz de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado de ribeirinho: tambores de QAV no convés dos flutuadores, guarda-corpo de tela nas janelas de trás,
         holofote no montante, canoa de alumínio amarrada no flutuador esquerdo e corta-fio no para-brisa */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { [2.4, -2.2].forEach(function (x) { c2.cyl(0.26, 0.26, 0.6, CM("#3e5a34", { roughness: 0.6 }), x, 1.56, s * 1.45); }); for (var x = -2.85; x < 0.05; x += 0.13) c2.rod(new V3(x, 2.72, s * 0.88), new V3(x, 3.24, s * 0.88), 0.008, stl); });
      var cn = c2.add(EA.fuseGeo([[1.6, 1.32, 1.4, 0.05, 2, -1.45], [1.2, 1.28, 1.6, 0.5, 2.4, -1.45], [-1.6, 1.28, 1.6, 0.55, 2.4, -1.45], [-2.0, 1.34, 1.6, 0.1, 2, -1.45]], { smooth: 16, seg: 14 }), CM("#9aa1a6", { metalness: 0.6, roughness: 0.4 }));
      c2.cyl(0.11, 0.09, 0.2, MT.steel, 0.9, 2.6, 2.3, "x"); EA.lamp(c2, 1.02, 2.6, 2.3, 0.09, "Holofote de busca");
      c2.rod(new V3(1.9, 2.95, 0), new V3(2.3, 3.75, 0), 0.02, stl);
      c2.part("carga", "Canoa e tambores de QAV", cn, new V3(0, 1.45, -1.45), 1.0);
    };
  });

  /* ================= Fenom 100 ================= */
  /* Referência · Embraer Phenom 100 (EMB-500) — WebFetch (dimensions.com "Embraer Phenom 100"), resto de memória
     Medidas reais: comprimento 12,82 m · envergadura 12,30 m · altura 4,35 m · fuselagem ≈ 1,66 m de largura e 1,80 m de altura (de memória) ·
     bitola do trem principal ≈ 2,8 m e entre-eixos ≈ 5,2 m (de memória) · pneus ≈ 0,56 m (principal) e 0,42 m (bequilha) (de memória) ·
     barriga a ≈ 0,55 m do chão · motores PW617F-E de 1.695 lbf em naceles na traseira · tanque 1.272 kg (≈ 1.590 L).
     Traços de assinatura:
       frente: nariz longo e baixo que termina em ponta, para-brisa envolvente de quatro peças com moldura preta, entradas de ar redondas
               dos motores aparecendo dos lados do cone de cauda, asa baixa com diedro e pontas levantadas
       lateral: quatro janelas grandes e ovaladas na cabine, porta-escada à frente na esquerda, faixa cinza-prata em curva subindo para a cauda,
                naceles curtas em pilones logo abaixo da deriva
       traseira: cauda em T com deriva bem enflechada e profundor no topo, duas barbatanas ventrais sob o cone de cauda, bocais de escape cônicos
       teto: asa com leve enflechamento no bordo de ataque, carenagem da raiz grande, profundor em T curto */
  ZG.register({ k: "fenom", grp: "Aéreos", n: "Fenom 100", insp: "Embraer Phenom 100", c: "Jato executivo leve, 2 + 4 lugares", fuel: "qav",
    d: "Jatinho de empresário. Rápido, alto e pressurizado: tira gente de uma cidade perdida em uma hora, se houver pista de asfalto inteira.",
    mass: 4750, r: 900, seats: "2 pilotos + 4 passageiros (até 6)", cap: "1.590 L", eff: "≈ 380 L/h", auto: "2.180 km", vmax: 722, skill: "Pilotagem aérea 5 (jato)", hood: false
  }, function (c) {
    var EA = ZG.EA, wcol = "#efeeea", white = c.paint(wcol), silver = c.paint("#7d868e", { metalness: 0.45, roughness: 0.35 }), navy = c.paint("#23324f"), blk = CM("#15161a", { roughness: 0.5 });
    var ST = [[6.3, 1.13, 1.2, 0.06, 2], [6.0, 0.92, 1.44, 0.6, 2.1], [5.3, 0.74, 1.8, 1.1, 2.2], [4.6, 0.65, 2.1, 1.42, 2.2], [3.8, 0.6, 2.33, 1.6, 2.2], [2.8, 0.58, 2.4, 1.66, 2.2],
      [-1.8, 0.6, 2.4, 1.66, 2.2], [-3.0, 0.8, 2.36, 1.5, 2.2], [-4.4, 1.25, 2.3, 1.05, 2.2], [-5.6, 1.72, 2.24, 0.52, 2.1], [-6.12, 1.92, 2.2, 0.12, 2]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 36 }), white);
    var wsK = [3.85, 5.0, 1.72, 2.45, null, 0.8], ckP = [[3.95, 1.78], [3.35, 1.8], [3.35, 2.12], [3.82, 2.2]];
    var wins = [2.55, 1.72, 0.89, 0.06].map(function (x, i) { return rrect(x - (i === 3 ? 0.38 : 0.5), x, i === 3 ? 1.62 : 1.56, i === 3 ? 1.94 : 1.98, i === 3 ? 0.15 : 0.19, 5); }), winF = polysSdf(EA, wins);
    var winCut = { sel: function (n) { return Math.abs(n.z) > 0.3; }, sdf: function (x, y, z) { return Math.max(winF(x, y), 0.5 - Math.abs(z)); } };
    ZG.cutMesh(fus, [EA.cutT(wsK, function (n) { return n.x > 0.12 && n.y > 0.05; }), EA.sideCutP(ckP, 0.5)], 40);
    ZG.cutMesh(fus, [winCut], 40, { sub: 0.1 });
    c.deform.push(fus);
    /* faixa cinza-prata em curva (da barriga para o alto da cauda) com filete azul */
    var sw = function (x) { return x > 3.0 ? 1.0 : 1.0 + Math.pow((3.0 - x) / 9.0, 1.6) * 1.35; };
    fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(sw(x) - y, x + 6.0, 5.6 - x); }), silver, { sub: 0.09, pre: { sdf: function (x, y) { return sw(x) + 0.2 - y; } } });
    fSkin(c, EA, ST, EA.bandT(function (x, y) { return Math.min(0.03 - Math.abs(y - sw(x) - 0.09), x + 5.9, 5.3 - x); }), navy, { k: 1.005, sub: 0.05, pre: EA.keepT([-6.0, 5.4, 0.9, 2.5]) });
    EA.fuseGlass(c, ST, EA.keepT(wsK), "Para-brisa", "laminado", { pos: new V3(4.4, 2.1, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(ckP, 0.5, s), "Janela lateral da cabine de pilotagem " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(3.6, 2.0, s * 0.78) });
      fGlass(c, EA, ST, { sdf: function (x, y, z) { return -Math.max(winF(x, y), 0.5 - s * z); } }, "Janelas da cabine " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(1.3, 1.8, s * 0.82), pre: EA.keepT([-0.45, 2.7, 1.45, 2.1, 0.4]) });
    });
    /* porta-escada (à frente, esquerda) e moldura preta do para-brisa */
    var dF = EA.polySdf(rrect(3.25, 2.6, 0.72, 2.2, 0.1).map(function (q) { return [Math.min(q[0], 3.25), q[1]]; }));
    EA.fuseSkin(c, ST, EA.bandT(function (x, y, z) { return Math.min(0.008 - Math.abs(EA.polySdf(rrect(2.62, 3.25, 0.72, 2.22, 0.12))(x, y)), -z - 0.5); }), MT.dark, { k: 1.003 }); void dF;
    EA.fuseSkin(c, ST, EA.bandT(function (x, y) { return Math.min(0.035 - Math.abs(x - 3.88 - (y - 1.75) * 0.5), y - 1.7, 2.42 - y); }), blk, { k: 1.004 });
    c.rod(new V3(5.0, 1.74, 0), new V3(4.05, 2.4, 0), 0.02, blk);
    /* interior: cabine de pilotagem com três telas, cabine em clube (4 lugares frente a frente) e banco lateral */
    var fl = 0.8, fab = CM("#c9bda6", { roughness: 0.75 });
    liner(c, ST, -2.0, 4.0, fl, MT.carpet, { h: 0.03 });
    [0.36, -0.36].forEach(function (z) { ZG.seat(c, 3.55, fl, z, { w: 0.48, h: 0.36, back: 0.66, lean: 0.14, mat: CM("#2a2c30") }); ZG.yoke(c, 4.05, 1.55, z); });
    EA.instPanel(c, 4.3, 1.68, 1.35, { gauges: 2, z0: -0.05, tilt: 0.25, screens: [[0.02, -0.45, 0.2, 0.3], [0.02, 0.0, 0.2, 0.32], [0.02, 0.45, 0.2, 0.3]] });
    [[2.25, 1], [1.05, -1]].forEach(function (q) { [0.42, -0.42].forEach(function (z) { ZG.seat(c, q[0], fl, z, { w: 0.5, h: 0.4, back: 0.66, lean: 0.12, dir: q[1], mat: fab }); }); });
    c.rb(0.5, 0.05, 0.6, 0.02, MT.wood, 1.65, fl + 0.6, 0.42); c.rb(0.5, 0.05, 0.6, 0.02, MT.wood, 1.65, fl + 0.6, -0.42);
    ZG.seat(c, 0.1, fl, -0.5, { w: 0.5, h: 0.4, back: 0.6, lean: 0.12, face: "+z", mat: fab });
    liner(c, ST, -1.75, 3.75, 2.25, MT.headliner);
    /* asa baixa com leve enflechamento, diedro e pontas levantadas */
    var wingMat = c.paint(wcol), dh = function (z) { return 0.82 + Math.max(0, Math.abs(z) - 0.8) * 0.085; }, legs = [];
    [1, -1].forEach(function (s) {
      var w = c.add(EA.foilGeo([{ p: [1.0, dh(0), 0], c: 2.45, t: 0.14, cam: 0.02 }, { p: [0.95, dh(0.85), s * 0.85], c: 2.42, t: 0.14, cam: 0.02 }, { p: [0.55, dh(2.4), s * 2.4], c: 1.9, t: 0.13, cam: 0.02 },
        { p: [-0.32, dh(5.75), s * 5.75], c: 1.08, t: 0.11, cam: 0.02 }, { p: [-0.42, dh(6.0) + 0.05, s * 6.0], c: 0.92, t: 0.08, cam: 0.01 }, { p: [-0.52, dh(6.1) + 0.22, s * 6.15], c: 0.62, t: 0.06 }], { up: "y", n: 14 }), wingMat);
      c.deform.push(w);
      /* carenagem grande da raiz */
      var rf = c.rb(3.4, 0.36, 0.5, 0.17, white, 0.0, 0.76, s * 0.7, { taper: { sx: 0.7, sz: 0.8, shift: 0.3 }, def: true }); void rf;
      c.rb(0.012, 0.012, 1.8, 0.004, MT.dark, -0.95, dh(4.4) + 0.08, s * 4.4).castShadow = false;
      EA.navLight(c, -0.35, dh(6.0) + 0.1, s * 6.12, s > 0 ? "verde" : "vermelha", "Luz de navegação " + (s > 0 ? "direita (verde)" : "esquerda (vermelha)"), { r: 0.035 });
      /* trem principal de braço arrastado na raiz da asa */
      legs.push(c.rod(new V3(-0.2, 0.78, s * 1.42), new V3(-0.45, 0.28, s * 1.42), 0.05, MT.chrome), c.rb(0.7, 0.22, 0.02, 0.01, white, -0.25, 0.62, s * 1.18));
      c.wheel(-0.45, s * 1.42, 0.28, 0.17, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#c9ccce", { metalness: 0.5 }) });
    });
    EA.lamp(c, 1.5, 0.72, 0.62, 0.055, "Farol de pouso direito"); EA.lamp(c, 1.5, 0.72, -0.62, 0.055, "Farol de pouso esquerdo");
    legs.push(c.rod(new V3(4.95, 0.68, 0), new V3(4.9, 0.21, 0), 0.04, MT.chrome), c.rb(0.6, 0.22, 0.02, 0.01, white, 5.0, 0.56, 0.16), c.rb(0.6, 0.22, 0.02, 0.01, white, 5.0, 0.56, -0.16));
    c.wheel(4.9, 0.0001, 0.21, 0.13, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#c9ccce", { metalness: 0.5 }) });
    EA.lamp(c, 5.02, 0.62, 0.0001, 0.04, "Farol de táxi");
    /* motores na cauda: pilone, nacele, entrada com fan escuro, cone de escape */
    var engs = { 1: [], "-1": [] };
    [1, -1].forEach(function (s) {
      var z0 = s * 1.32, y0 = 2.0, NS = [[-2.2, y0 - 0.33, y0 + 0.33, 0.66, 2], [-2.6, y0 - 0.37, y0 + 0.37, 0.74, 2], [-3.8, y0 - 0.36, y0 + 0.36, 0.72, 2], [-4.5, y0 - 0.27, y0 + 0.27, 0.54, 2], [-4.65, y0 - 0.22, y0 + 0.22, 0.44, 2]];
      NS.forEach(function (q) { q.push(z0); });
      var n = c.add(EA.fuseGeo(NS, { smooth: 20, seg: 24 }), white); c.deform.push(n); engs[s].push(n);
      engs[s].push(c.cyl(0.29, 0.29, 0.03, MT.dark, -2.21, y0, z0, "x", { seg: 24 }), c.cyl(0.1, 0.02, 0.18, MT.steel, -2.13, y0, z0, "x", { seg: 16 }));
      engs[s].push(c.add(new THREE.TorusGeometry(0.3, 0.035, 8, 28), MT.chrome, -2.2, y0, z0)); engs[s][engs[s].length - 1].rotation.y = PI / 2;
      engs[s].push(c.cyl(0.18, 0.08, 0.3, MT.steel, -4.75, y0, z0, "x", { seg: 18 }));
      engs[s].push(c.rb(1.5, 0.12, Math.abs(z0) - 0.5, 0.05, white, -3.5, 1.98, s * (0.5 + (Math.abs(z0) - 0.5) / 2), { def: true }));
      engs[s].push(c.rb(1.1, 0.07, 0.02, 0.02, navy, -3.4, y0 + 0.12, z0 + s * 0.37));
      /* matrícula no lado de fora da nacele (o cone de cauda fica escondido atrás da asa e da nacele) */
      engs[s].push(c.text("PR-FNM", 0.78, 0.15, -3.35, y0 - 0.06, z0 + s * 0.378, s > 0 ? "+z" : "-z", { fg: "#23324f" }));
    });
    /* cauda em T: deriva enflechada, profundor no topo com bala, barbatanas ventrais */
    var tm = c.paint(wcol);
    var fin = c.add(EA.foilGeo([{ p: [-3.9, 2.25, 0], c: 2.2, t: 0.11 }, { p: [-5.35, 4.18, 0], c: 1.15, t: 0.1 }], { up: "z", n: 10 }), tm); c.deform.push(fin);
    var finB = c.add(EA.foilGeo([{ p: [-3.89, 2.25, 0], c: 2.22, t: 0.115 }, { p: [-5.34, 4.185, 0], c: 1.17, t: 0.105 }], { up: "z", n: 10 }), silver); finB.castShadow = false;
    ZG.cutMesh(finB, [EA.bandT(function (x, y) { return Math.min(y - 2.4 - (x + 6.0) * -0.9, 4.0 - y); })], 40, { sub: 0.06 }); c.deform.push(finB);
    [1, -1].forEach(function (s) {
      var hs = c.add(EA.foilGeo([{ p: [-5.3, 4.2, 0], c: 1.18, t: 0.1 }, { p: [-5.9, 4.24, s * 2.55], c: 0.62, t: 0.09 }], { up: "y", n: 10 }), tm); c.deform.push(hs);
      var vs = c.add(EA.foilGeo([{ p: [-5.0, 1.62, s * 0.18], c: 0.8, t: 0.06 }, { p: [-5.3, 1.32, s * 0.42], c: 0.5, t: 0.05 }], { up: "z", n: 6 }), tm); c.deform.push(vs);
    });
    c.sph(0.11, tm, -5.75, 4.24, 0, 4.2, 0.9, 0.9);
    EA.navLight(c, -6.18, 2.06, 0, "branca", "Luz de cauda", { r: 0.03 });
    EA.navLight(c, -6.15, 4.3, 0, "vermelha", "Farol anticolisão (cauda)", { r: 0.035 });
    EA.navLight(c, 0.4, 0.56, 0, "vermelha", "Farol anticolisão (barriga)", { r: 0.035 });
    c.rod(new V3(5.6, 1.35, 0.42), new V3(6.0, 1.35, 0.42), 0.01, MT.steel); c.rod(new V3(5.6, 1.35, -0.42), new V3(6.0, 1.35, -0.42), 0.01, MT.steel);
    c.part("motor", "Motor esquerdo (PW617F)", engs[-1][0], new V3(-3.4, 2.0, -1.32), 0.9); c.part("motor", "Motor direito (PW617F)", engs[1][0], new V3(-3.4, 2.0, 1.32), 0.9);
    c.part("tanque", "Tanques nas asas", null, new V3(0.2, 0.9, 3.0), 1.2); c.part("trem", "Trem de pouso", null, new V3(-0.45, 0.35, 1.42), 1.0);
    Object.assign(c.meta, { kind: "plane", L: 12.82, W: 12.3, fusW: 1.66, front: 6.32, rear: -6.52, clear: 0.58, belt: 1.55, bodyH: 1.82, top: 4.35, roof: null });
    var fz = 0.95;
    c.zone("nariz", "Nariz (aviônica) e para-brisa", [4.0, 6.5, 0.55, 2.5, -fz, fz], null, { dir: "frente", fxKey: "nariz", who: "os pilotos" });
    c.zone("cabine", "Cabine, porta-escada e janelas", [-1.9, 4.0, 0.55, 2.5, -fz, fz], null, { dir: "esquerda", fxKey: "cabineaero", who: "os passageiros", anyMesh: true });
    c.zone("fuselagem", "Cone de cauda", [-4.6, -1.9, 0.6, 2.45, -0.9, 0.9]);
    c.zone("cauda", "Cauda em T", [-6.6, -3.8, 2.1, 4.5, -2.8, 2.8]);
    [1, -1].forEach(function (s) {
      var sid = s > 0 ? "d" : "e";
      c.zone("motor_" + sid, "Motor " + (s > 0 ? "direito" : "esquerdo") + " (nacele e pilone)", [-4.95, -2.05, 1.55, 2.45, s > 0 ? 0.5 : -1.8, s > 0 ? 1.8 : -0.5], engs[s], { type: "peca", side: s, dir: s > 0 ? "direita" : "esquerda", fxKey: "motor", sub: "motor", pos: new V3(-3.4, 2.0, s * 1.32), anchor: [-3.5, 2.0, s * 0.5] });
    });
    c.zone("trem", null, null, legs);
    c.zone("farol_c", "Faróis de pouso e táxi"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)"); c.zone("lanterna_c", "Luz de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado de fuga: chapas de aço por dentro da cabine de pilotagem, grade fina no para-brisa, defletores de detritos na
         bequilha (pista de terra), tanque de traslado no corredor e caixas de remédio nas poltronas */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { c2.rb(0.9, 0.45, 0.02, 0.02, stl, 3.6, 1.2, s * 0.74); });
      for (var k = -0.6; k <= 0.61; k += 0.12) c2.rod(new V3(5.0, 1.74, k), new V3(3.9, 2.42, k * 0.85), 0.006, stl);
      c2.rb(0.5, 0.06, 0.62, 0.02, stl, 4.95, 0.3, 0, { rot: [0, 0, 0.5] });
      c2.cyl(0.32, 0.32, 1.6, CM("#8e2a20", { roughness: 0.6 }), 0.0, fl + 0.35, 0, "x"); c2.text("QAV", 0.4, 0.14, 0.0, fl + 0.68, 0, "+y", { fg: "#f2e6c8" });
      [2.25, 1.05].forEach(function (x) { c2.rb(0.35, 0.25, 0.3, 0.03, CM("#e8e4dc"), x, fl + 0.55, 0.42); c2.text("+", 0.18, 0.18, x, fl + 0.68, 0.42, "+y", { fg: "#c0281c" }); });
      c2.part("carga", "Tanque de traslado", null, new V3(0, 1.1, 0), 0.9);
    };
  });

  /* ================= Super Tucanno ================= */
  /* Referência · Embraer EMB-314 / A-29 Super Tucano — WebSearch (migflug, aerocorner, The Defense Post); trem e cauda de memória
     Medidas reais: comprimento 11,38 m · envergadura 11,14 m · altura 3,97 m · área da asa 19,4 m² · hélice Hartzell pentapá de 2,38 m ·
     bitola do trem principal ≈ 3,2 m e entre-eixos ≈ 3,9 m (de memória) · pneus ≈ 0,6 m (principal) e 0,4 m (bequilha) (de memória) ·
     fuselagem ≈ 0,98 m de largura (de memória) · PT6A-68C de 1.600 shp · 695 L internos · duas metralhadoras .50 nas asas.
     Traços de assinatura:
       frente: hélice de cinco pás com spinner pontudo, nariz comprido e estreito com tomada de ar em boca sob o spinner,
               dois escapamentos de cada lado do nariz, asa baixa com diedro, canos das .50 saindo do bordo de ataque
       lateral: canopi em bolha comprida com dois lugares em degrau (o de trás mais alto) e arco entre eles, dorso que desce para a cauda,
                cinco pontos de carga (dois sob cada asa e um na barriga), camuflagem verde em duas tonalidades por cima e cinza-claro por baixo
       traseira: deriva alta com barbatana dorsal e barbatana ventral, profundor reto baixo, cone de cauda fino
       teto: asa trapezoidal de pontas retas, canopi de ponta a ponta da cabine, faixa antiderrapante na raiz da asa */
  ZG.register({ k: "tucano", grp: "Militares", n: "Super Tucanno", insp: "Embraer EMB-314 Super Tucano (A-29)", c: "Turboélice de ataque leve, 2 lugares em tandem", fuel: "qav",
    d: "Turboélice de ataque leve e treinamento avançado. Voa baixo e devagar o bastante para ver a horda, com duas .50 nas asas e foguetes nos pilones.",
    mass: 5400, r: 800, seats: "2 (piloto e operador em tandem)", cap: "695 L internos (+ tanques externos)", eff: "≈ 260 L/h", auto: "1.330 km", vmax: 590, skill: "Pilotagem aérea 5 (caça) e armamento", hood: false
  }, function (c) {
    var EA = ZG.EA, blk = CM("#1a1b1d", { roughness: 0.6 });
    c.meta.matte = true;
    /* camuflagem por vértice: duas tonalidades de verde em manchas por cima, cinza-claro por baixo (cores reais no material branco) */
    var cA = new THREE.Color("#323f2b"), cB = new THREE.Color("#5f6d45"), cC = new THREE.Color("#7f8466"), cL = new THREE.Color("#a3abad");
    function camo(x, z, y, under) { if (under) return cL; var n = Math.sin(x * 1.35 + z * 0.9) + Math.sin(x * 0.55 - z * 1.7 + 1.3) + 0.6 * Math.sin(y * 2.2 + x * 0.3); return n > 0.9 ? cC : n > -0.1 ? cB : cA; }
    var camoM = c.paint("#ffffff"); camoM.vertexColors = true;
    var ST = [[5.18, 1.44, 1.58, 0.12, 2], [5.02, 1.12, 1.84, 0.62, 2.2], [4.55, 0.98, 1.92, 0.86, 2.4], [3.6, 0.96, 1.96, 0.92, 2.5], [2.6, 0.93, 2.04, 0.96, 2.5], [1.0, 0.9, 2.1, 0.98, 2.6],
      [-0.6, 0.92, 2.08, 0.94, 2.6], [-1.8, 1.06, 2.02, 0.82, 2.4], [-3.4, 1.36, 1.96, 0.55, 2.2], [-4.9, 1.58, 1.95, 0.3, 2.1], [-5.5, 1.68, 1.94, 0.1, 2]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 36, col: function (x, y, z) { return camo(x, z, y, y < 1.32 + (x < -1.5 ? (-1.5 - x) * 0.12 : 0)); } }), camoM);
    var ckCut = [-1.0, 2.62, 1.86, 2.4, null, 0.42];
    ZG.cutMesh(fus, [EA.cutT(ckCut, function (n) { return n.y > 0.35; })], 40);
    c.deform.push(fus);
    /* nariz: tomada de ar em boca sob o spinner, dois escapamentos de cada lado, antiderrapante */
    c.rb(0.3, 0.2, 0.42, 0.08, MT.dark, 4.98, 1.12, 0);
    [1, -1].forEach(function (s) {
      [4.28, 4.02].forEach(function (x, i) { var e = c.cyl(0.07, 0.085, 0.28, MT.steel, x, 1.5 - i * 0.04, s * 0.47, "x", { seg: 14 }); e.rotation.y = -s * 0.6; c.cyl(0.06, 0.06, 0.02, MT.dark, x - 0.13, 1.5 - i * 0.04, s * 0.55, "x").rotation.y = -s * 0.6; });
      sideText(c, ST, "5901", 0.62, 0.22, -2.6, 1.55, s, { fg: "#d2cfbb" });
      starDecal(c, -1.2, 1.55, s * 0.445, 0.2, s > 0 ? "+z" : "-z", { bg: "#3a4430", fg: "#b8b9a4" });
    });
    /* canopi em bolha (vidro moldado), arcos do para-brisa e do meio, trilho */
    /* canopi em degrau: a metade de trás (instrutor/operador) fica ~20 cm mais alta que a da frente */
    var CN = [[2.7, 1.98, 2.02, 0.42, 2], [2.35, 1.97, 2.42, 0.8, 2.2], [1.6, 1.97, 2.62, 0.86, 2.2], [1.0, 1.97, 2.7, 0.86, 2.2], [0.45, 1.97, 2.86, 0.86, 2.2], [-0.25, 1.97, 2.82, 0.8, 2.2], [-0.85, 1.97, 2.5, 0.56, 2.1], [-1.25, 1.97, 2.1, 0.18, 2]];
    var can = new THREE.Mesh(EA.fuseGeo(CN, { smooth: 30, seg: 28 }), MT.glass); c.g.add(can);
    ZG.cutMesh(can, [{ sdf: function (x, y) { return y - 1.99; } }], 30);
    var canG = ZG.asGlass(c, can, "Canopi", "laminado", { pos: new V3(1.0, 2.5, 0) }); void canG;
    c.tube([[2.42, 2.0, -0.41], [2.36, 2.3, -0.33], [2.3, 2.45, 0], [2.36, 2.3, 0.33], [2.42, 2.0, 0.41]], 0.025, blk, { seg: 20 });
    c.tube([[0.74, 2.0, -0.44], [0.74, 2.52, -0.34], [0.74, 2.79, 0], [0.74, 2.52, 0.34], [0.74, 2.0, 0.44]], 0.03, blk, { seg: 20 });
    [1, -1].forEach(function (s) { c.rb(3.7, 0.04, 0.03, 0.012, blk, 0.7, 1.99, s * 0.44); });
    c.rb(0.02, 0.32, 0.6, 0.02, MT.glass, 0.95, 2.22, 0).castShadow = false;
    /* interior: dois assentos ejetáveis em degrau, manches, painéis com duas telas e HUD na frente */
    var fab = CM("#2e3328", { roughness: 0.85 });
    c.rb(3.4, 0.03, 0.8, 0.01, MT.carpet, 0.8, 1.2, 0).castShadow = false;
    [[1.55, 1.24], [0.2, 1.46]].forEach(function (q, i) {
      ZG.seat(c, q[0], q[1], 0, { w: 0.5, h: 0.32, back: 0.85, lean: 0.24, mat: fab, headrest: false });
      c.rb(0.14, 0.3, 0.44, 0.04, CM("#202224"), q[0] - 0.42, q[1] + 1.05, 0, { rot: [0, 0, 0.24] });
      c.rod(new V3(q[0] - 0.38, q[1] + 1.25, -0.06), new V3(q[0] - 0.3, q[1] + 1.4, 0.06), 0.012, MT.yellow);
      c.rod(new V3(q[0] + 0.35, q[1], 0), new V3(q[0] + 0.32, q[1] + 0.45, 0), 0.016, blk); c.sph(0.03, blk, q[0] + 0.31, q[1] + 0.48, 0, 1, 1.5, 1);
      var px = q[0] + 0.75; c.rb(0.16, 0.3, 0.6, 0.04, CM("#232427"), px, q[1] + 0.65, 0, { rot: [0, 0, 0.2] });
      [-0.15, 0.15].forEach(function (z) { c.rb(0.012, 0.16, 0.18, 0.008, MT.screen, px - 0.09, q[1] + 0.68, z, { rot: [0, 0, 0.2] }).castShadow = false; });
      if (i === 0) { c.rb(0.03, 0.16, 0.16, 0.008, CM("#3fbf6a", { transparent: true, opacity: 0.35, emissive: new THREE.Color("#2a8a4a"), emissiveIntensity: 0.6 }), px + 0.02, q[1] + 0.95, 0, { rot: [0, 0, -0.3] }).castShadow = false; }
    });
    /* asa baixa trapezoidal com diedro de 5,5°, camuflada por cima */
    var dh = function (z) { return 1.02 + Math.max(0, Math.abs(z) - 0.48) * 0.096; }, legs = [], pyl = [];
    var wingM = c.paint("#ffffff"); wingM.vertexColors = true;
    [1, -1].forEach(function (s) {
      var g = EA.foilGeo([{ p: [1.52, dh(0), 0], c: 2.35, t: 0.15, cam: 0.02 }, { p: [1.5, dh(0.48), s * 0.48], c: 2.32, t: 0.15, cam: 0.02 }, { p: [0.78, dh(5.4), s * 5.4], c: 1.2, t: 0.12, cam: 0.02 }, { p: [0.74, dh(5.57), s * 5.57], c: 1.1, t: 0.07, cam: 0.01 }], { up: "y", n: 14 });
      EA.colorize(g, function (x, y, z) { return camo(x, z, y, y < dh(z) - 0.005); });
      var w = c.add(g, wingM); c.deform.push(w);
      c.rb(0.012, 0.012, 2.3, 0.004, MT.dark, -0.42, dh(2.2) + 0.1, s * 2.2, { rot: [s * 0.096, 0, 0] }).castShadow = false;
      c.rb(1.6, 0.004, 0.5, 0.002, CM("#2b2d2a", { roughness: 1 }), 0.2, dh(0.75) + 0.16, s * 0.75).castShadow = false;
      starDecal(c, 0.1, dh(4.2) + 0.115, s * 4.2, 0.26, "+y", { bg: "#3a4430", fg: "#b8b9a4" });
      EA.navLight(c, 0.3, dh(5.57), s * 5.6, s > 0 ? "verde" : "vermelha", "Luz de navegação " + (s > 0 ? "direita (verde)" : "esquerda (vermelha)"), { r: 0.035 });
      /* metralhadora .50 na asa: cano saindo do bordo de ataque */
      c.cyl(0.022, 0.022, 0.5, MT.steel, 1.55, dh(1.5) - 0.06, s * 1.5, "x", { seg: 10 }); c.cyl(0.03, 0.03, 0.06, MT.dark, 1.8, dh(1.5) - 0.06, s * 1.5, "x", { seg: 10 });
      /* pilones: interno com tanque/foguete, externo com casulo de foguetes */
      [[2.45, "tanque"], [3.6, "foguete"]].forEach(function (q) {
        var z = s * q[0], y = dh(q[0]) - 0.14;
        pyl.push(c.rb(0.8, 0.14, 0.06, 0.03, CM("#5d6555", { roughness: 0.7 }), 0.55, y, z));
        if (q[1] === "foguete") { var rp = pod(c, EA, 1.25, -0.45, y - 0.25, z, 0.19, CM("#353b30", { roughness: 0.75 })); pyl.push(rp); pyl.push(c.cyl(0.17, 0.17, 0.02, MT.dark, 1.26, y - 0.25, z, "x", { seg: 19 })); }
        else { var tk = pod(c, EA, 1.55, -0.95, y - 0.28, z, 0.24, CM("#5b6458", { roughness: 0.7 })); pyl.push(tk); }
      });
      /* trem principal recolhendo para dentro da asa */
      legs.push(c.rod(new V3(0.1, dh(1.6) - 0.1, s * 1.6), new V3(0.0, 0.3, s * 1.6), 0.05, MT.chrome), c.rb(0.75, 0.04, 0.42, 0.01, CM("#a3abad"), 0.05, dh(1.2) - 0.12, s * 1.15, { rot: [s * 1.3, 0, 0] }));
      c.wheel(0.0, s * 1.6, 0.3, 0.18, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#8a8f8c", { metalness: 0.5 }) });
    });
    /* pilone da barriga e bequilha */
    pyl.push(c.rb(0.9, 0.12, 0.08, 0.03, CM("#5d6555"), 0.6, 0.86, 0));
    legs.push(c.rod(new V3(3.95, 0.98, 0), new V3(3.95, 0.2, 0), 0.04, MT.chrome), c.rb(0.6, 0.3, 0.02, 0.01, CM("#a3abad"), 4.0, 0.82, 0.16), c.rb(0.6, 0.3, 0.02, 0.01, CM("#a3abad"), 4.0, 0.82, -0.16));
    c.wheel(3.95, 0.0001, 0.2, 0.12, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#8a8f8c", { metalness: 0.5 }) });
    EA.lamp(c, 4.1, 0.86, 0.0001, 0.045, "Farol de pouso e táxi");
    /* empenagem: deriva alta com barbatana dorsal e ventral, profundor baixo */
    var tailM = c.paint("#ffffff"); tailM.vertexColors = true;
    function ctail(geo, top) { EA.colorize(geo, function (x, y, z) { return camo(x, z, y, top ? false : y < 1.7); }); return geo; }
    var fin = c.add(ctail(EA.foilGeo([{ p: [-3.55, 1.92, 0], c: 2.2, t: 0.11 }, { p: [-4.92, 3.94, 0], c: 0.9, t: 0.1 }], { up: "z", n: 10 }), true), tailM); c.deform.push(fin);
    var dors = c.add(ctail(EA.foilGeo([{ p: [-1.6, 2.02, 0], c: 2.0, t: 0.04 }, { p: [-3.6, 2.5, 0], c: 0.3, t: 0.06 }], { up: "z", n: 8 }), true), tailM); c.deform.push(dors);
    var ven = c.add(EA.foilGeo([{ p: [-4.2, 1.42, 0], c: 1.2, t: 0.07 }, { p: [-4.85, 1.1, 0], c: 0.6, t: 0.06 }], { up: "z", n: 6 }), CM("#a3abad", { roughness: 0.8 })); c.deform.push(ven);
    [1, -1].forEach(function (s) {
      var g = EA.foilGeo([{ p: [-4.3, 1.72, 0], c: 1.3, t: 0.1 }, { p: [-4.72, 1.76, s * 2.2], c: 0.75, t: 0.09 }], { up: "y", n: 10 });
      EA.colorize(g, function (x, y, z) { return camo(x, z, y, y < 1.72 + Math.abs(z) * 0.018); }); var hs = c.add(g, tailM); c.deform.push(hs);
    });
    c.rb(0.012, 1.7, 0.03, 0.004, MT.dark, -5.25, 2.9, 0, { rot: [0, 0, -0.55] }).castShadow = false;
    EA.navLight(c, -5.55, 1.82, 0, "branca", "Luz de cauda", { r: 0.03 });
    EA.navLight(c, -5.1, 3.96, 0, "vermelha", "Farol anticolisão", { r: 0.035 });
    /* hélice de cinco pás com spinner pontudo */
    var pr = EA.propeller(c, 5.22, 1.51, 0, { R: 1.19, blades: 5, chord: 0.17, spinL: 0.42, spinR: 0.2, spinCol: "#3f4b37", tip: "#d8c43a" });
    c.part("helice", "Hélice de cinco pás", pr, new V3(5.3, 1.51, 0), 1.0); c.part("motor", "Turbina PT6A-68C", null, new V3(4.3, 1.45, 0), 1.0);
    c.part("tanque", "Tanques nas asas", null, new V3(0.6, 1.15, 2.0), 1.2); c.part("trem", "Trem de pouso", null, new V3(0.0, 0.4, 1.6), 1.0);
    c.part("arma", "Metralhadoras .50 nas asas", null, new V3(1.5, 1.0, 1.5), 0.8);
    Object.assign(c.meta, { kind: "plane", L: 11.38, W: 11.14, fusW: 0.98, front: 5.62, rear: -5.8, clear: 0.9, belt: 1.75, bodyH: 1.2, top: 3.97, roof: null });
    c.zone("nariz", "Nariz, turbina e hélice", [2.65, 5.8, 0.8, 2.15, -0.7, 0.7], null, { dir: "frente", fxKey: "nariz" });
    c.zone("cabine", "Cabine em tandem", [-1.0, 2.65, 0.85, 2.3, -0.62, 0.62], null, { dir: "esquerda", fxKey: "cabineaero", who: "o piloto e o operador", anyMesh: true });
    c.zone("canopi", "Canopi", [-1.3, 2.75, 1.96, 2.95, -0.5, 0.5], null, { type: "teto", fxKey: "parabrisa", dir: "cima", alsoGlass: true, who: "o piloto" });
    c.zone("fuselagem", "Cone de cauda", [-3.6, -1.0, 0.9, 2.2, -0.6, 0.6]);
    c.zone("cauda", "Deriva, profundor e barbatanas", [-5.95, -3.6, 0.95, 4.1, -2.4, 2.4]);
    c.zone("armas", "Pilones, foguetes e tanques externos", [-1.1, 1.7, 0.25, 1.0, -4.0, 4.0], pyl, { type: "peca", fxKey: "arma", dir: "cima", anchor: [0.3, 1.0, 0], fx: ["Nenhum", "Casulo riscado, ainda dispara", "Pilone torto: mira desalinhada", "Casulo pendurado: arrasta e pode cair", "Cargas arrancadas: sem foguetes nem tanque extra"] });
    c.zone("trem", null, null, legs);
    c.zone("farol_c", "Farol de pouso e táxi"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)"); c.zone("lanterna_c", "Luz de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado contra a horda: casulo de metralhadora na barriga, bombas de fragmentação nos pilones internos no lugar dos tanques,
         chapas de aço nas laterais da cabine e holofote no pilone externo esquerdo */
      var stl = ZG.STEELM, gp = CM("#3a4232", { roughness: 0.7 });
      pod(c2, EA, 1.6, -0.7, 0.62, 0, 0.17, gp); c2.cyl(0.025, 0.025, 0.5, MT.steel, 1.75, 0.6, 0, "x");
      [1, -1].forEach(function (s) { var y = dh(2.45) - 0.42; pod(c2, EA, 1.4, -0.4, y, s * 2.45, 0.15, CM("#5a5f4a", { roughness: 0.6 })); [0, 1, 2, 3].forEach(function (k) { var a = k * PI / 2; c2.rb(0.25, 0.01, 0.12, 0.004, gp, -0.38, y + Math.cos(a) * 0.12, s * 2.45 + Math.sin(a) * 0.12, { rot: [a, 0, 0] }); }); c2.rb(1.6, 0.3, 0.02, 0.02, stl, 1.2, 1.7, s * 0.48); });
      EA.lamp(c2, 1.32, dh(3.6) - 0.66, -3.6, 0.09, "Holofote de busca");
      c2.part("arma", "Casulo de metralhadora e bombas", null, new V3(0.5, 0.6, 0), 1.0);
    };
  });
})(window.ZG);
