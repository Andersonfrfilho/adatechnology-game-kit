/* frota-barcos-novos.js: veículos novos da v4 (grupo "Aquáticos"). Só usa a API de window.ZG (veja API.md).
   Os utilitários de casco, convés, luz de navegação, motor de popa e tubo variável vêm de ZG.EA (frota-agua-ar.js, carregado antes).
   Funções locais deste arquivo (não estão no núcleo): sailGeo (vela triangular com barriga), ropeAlong (cabo de vida com barriga entre argolas). */
(function (ZG) {
  "use strict";
  if (!ZG || !ZG.EA) return;
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM, G = ZG.geo, DS = THREE.DoubleSide, EA = ZG.EA, tb = EA.tab;

  /* vela triangular: amura T, testa (topo) Hd, punho da escota C, barriga cam (fração da corda) para +z */
  function sailGeo(T, Hd, C, cam, o) {
    o = o || {}; var nu = o.nu || 10, nv = o.nv || 16, pos = [], idx = [], roach = o.roach || 0;
    for (var j = 0; j <= nv; j++) {
      var v = j / nv;
      for (var i = 0; i <= nu; i++) {
        var u = i / nu, bx = T[0] + (C[0] - T[0]) * u, by = T[1] + (C[1] - T[1]) * u, bz = T[2] + (C[2] - T[2]) * u;
        var x = bx + (Hd[0] - bx) * v, y = by + (Hd[1] - by) * v, z = bz + (Hd[2] - bz) * v;
        var chord = Math.hypot(C[0] - T[0], C[1] - T[1]) * (1 - v);
        x -= roach * u * Math.sin(v * PI) * (u > 0.7 ? 1 : u / 0.7);
        z += cam * chord * 4 * u * (1 - u) * (0.6 + 0.4 * (1 - v));
        pos.push(x, y, z);
      }
    }
    for (var a = 0; a < nv; a++) for (var b = 0; b < nu; b++) { var p0 = a * (nu + 1) + b, p1 = p0 + nu + 1; idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* cabo de vida: passa pelas argolas pts e cai um pouco entre elas */
  function ropeAlong(c, pts, sag, r, mat) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) { var a = pts[i], b = pts[i + 1]; for (var k = 0; k < 4; k++) { var t = k / 4; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * Math.sin(t * PI), a[2] + (b[2] - a[2]) * t]); } }
    out.push(pts[pts.length - 1]); return c.tube(out, r, mat, { seg: out.length * 3, rs: 5 });
  }

  /* ================= jetski ================= */
  /* Referência · Sea-Doo Spark 3-up (WebSearch: ficha BRP "Spark 3-up": 305 x 118 x 107 cm, peso seco ≈ 199 kg, tanque 30 L, Rotax 900 ACE 60/90 hp)
     Medidas reais: comprimento 3,05 m · largura 1,18 m · altura 1,07 m (do fundo ao guidão) · calado ≈ 0,25 m (de memória) · 3 lugares ·
     velocidade ≈ 80 km/h com 90 hp · consumo ≈ 10–17 L/h (de memória).
     Traços de assinatura:
       frente: bico curto e arredondado subindo do V, capô colorido largo, guidão estreito sem carenagem, olhal de proa
       lateral: casco baixo e curto, banco longo de 3 lugares em degrau, poços de pé abertos dos lados do banco, quina de casco reta
       traseira: plataforma de embarque curta e rasa no nível da borda (revisor: poços de pé mais rasos, borda mais larga, pedestal recolhido sob o banco), bocal da turbina com balde de ré (iBR) preto embaixo, degrau de embarque
       teto: corpo em gota, capô largo na frente, banco estreito no meio com poços dos dois lados */
  ZG.register({ k: "jetski", grp: "Aquáticos", n: "Si-Dú Spark", insp: "Sea-Doo Spark", art: "no", c: "Moto aquática de 3 lugares", fuel: "gasolina",
    d: "Pequeno, leve e nervoso, com turbina em vez de hélice. Pula marola e foge por canal raso.",
    mass: 199, r: 85, seats: "3", cap: "30 L", eff: "≈ 10 L/h (cruzeiro) · 17 L/h (máx.)", auto: "≈ 2,5 h · ≈ 100 km", vmax: 80, skill: "Náutica 1", hood: false
  }, function (c) {
    var L = 2.98, x0 = -1.48;
    var white = c.paint("#eceae4", { roughness: 0.35 }), blue = c.paint("#1b86c9", { roughness: 0.3, metalness: 0.05 }), grey = CM("#3d4146", { roughness: 0.7 }), mat = CM("#2b2d30", { roughness: 0.95 }), blk = CM("#151618", { roughness: 0.45 });
    var H = EA.boatHull({ x0: x0, L: L, n: 36, m1: 5, m2: 5, q: 0.9, fl: 0.8,
      keel: tb([[0, -0.21], [0.5, -0.25], [0.8, -0.16], [0.95, 0.08], [1, 0.32]]),
      chine: function (t) { return [tb([[0, 0.43], [0.55, 0.48], [0.85, 0.34], [1, 0.0]])(t), tb([[0, -0.09], [0.6, -0.1], [0.9, 0.06], [1, 0.32]])(t)]; },
      sheer: function (t) { return [tb([[0, 0.53], [0.45, 0.565], [0.8, 0.45], [0.97, 0.12], [1, 0.0]])(t), tb([[0, 0.27], [0.6, 0.3], [0.85, 0.34], [1, 0.4]])(t)]; } });
    var hull = c.add(H.geo, white); c.deform.push(hull);
    /* quina e friso preto */
    EA.skinOf(c, hull, EA.bandT(function (x, y) { return -0.05 - y; }), c.paint("#c9ccce", { roughness: 0.45 }), { sz: 1.004, dy: 0.002 });
    EA.sheerTube(c, H, x0 + 0.02, 1.46, 0.022, blk, { closeBow: true });
    /* borda (amurada) em volta dos poços de pé, plataforma de embarque e piso dos poços */
    var gun = c.add(EA.deckGeo(H, x0 + 0.02, 0.4, { inner: function (x) { return H.sheerAt(x).z - 0.14; }, n: 20, m: 3 }), blue); c.deform.push(gun);
    var plat = c.add(EA.deckGeo(H, x0 + 0.01, -1.12, { y: function () { return 0.245; }, inset: 0.02, n: 4, m: 8 }), grey); plat.castShadow = false;
    var flr = c.add(EA.deckGeo(H, -1.12, 0.4, { y: function () { return 0.17; }, inset: 0.03, n: 14, m: 8 }), mat); flr.castShadow = false;
    /* pedestal do banco (branco), capô (azul) e banco (preto com friso azul) */
    var ped = c.add(EA.fuseGeo([[-1.05, 0.08, 0.34, 0.4, 4], [-0.9, 0.08, 0.41, 0.48, 4], [0.05, 0.08, 0.45, 0.52, 4], [0.3, 0.08, 0.5, 0.56, 4]].reverse(), { smooth: 16, seg: 24 }), white); c.deform.push(ped);
    var hdST = [[0.26, 0.08, 0.55, 0.92, 3], [0.48, 0.08, 0.66, 1.02, 3], [0.8, 0.1, 0.63, 0.92, 3], [1.1, 0.14, 0.53, 0.72, 3], [1.33, 0.22, 0.45, 0.3, 3], [1.47, 0.32, 0.41, 0.04, 3]].reverse();
    var hood = c.add(EA.fuseGeo(hdST, { smooth: 30, seg: 30 }), blue); c.deform.push(hood);
    EA.fuseSkin(c, hdST, EA.bandT(function (x, y) { return Math.min(0.26 - y, x - 0.35); }), white, { k: 1.006 });
    var stST = [[-1.07, 0.3, 0.57, 0.5, 2.6], [-0.85, 0.3, 0.64, 0.56, 2.6], [-0.25, 0.32, 0.66, 0.58, 2.6], [0.12, 0.35, 0.71, 0.56, 2.6], [0.33, 0.42, 0.73, 0.42, 2.6], [0.4, 0.5, 0.7, 0.12, 2.6]].reverse();
    var seat = c.add(EA.fuseGeo(stST, { smooth: 30, seg: 28 }), CM("#24272a", { roughness: 0.75 })); c.deform.push(seat);
    EA.fuseSkin(c, stST, EA.bandT(function (x, y) { var yc = 0.45 + (x + 1.0) * 0.05; return 0.018 - Math.abs(y - yc); }), CM("#1b86c9", { roughness: 0.6 }), { k: 1.01 });
    c.seatTops.push({ x: -0.75, y: 0.64, z: 0, w: 0.45, l: 0.4 }, { x: -0.35, y: 0.66, z: 0, w: 0.45, l: 0.4 }, { x: 0.05, y: 0.7, z: 0, w: 0.45, l: 0.4 });
    /* guidão: coluna, barra, manoplas, acelerador (direita), alavanca do iBR (esquerda) e painel digital */
    var bar = new THREE.Group(); bar.userData.rigid = true; c.g.add(bar); var P = { parent: bar };
    c.rb(0.2, 0.16, 0.26, 0.05, blk, 0.47, 0.66, 0, P);
    c.rod(new V3(0.48, 0.66, 0), new V3(0.42, 0.8, 0), 0.03, blk, P);
    c.tube([[0.36, 0.83, -0.37], [0.42, 0.82, -0.18], [0.43, 0.81, 0], [0.42, 0.82, 0.18], [0.36, 0.83, 0.37]], 0.014, MT.chrome, { seg: 20, rs: 6 });
    [1, -1].forEach(function (s) { c.cyl(0.024, 0.024, 0.13, MT.rubber, 0.365, 0.83, s * 0.33, "z", P); });
    c.rb(0.05, 0.015, 0.07, 0.006, blk, 0.39, 0.81, 0.24, P); c.rb(0.06, 0.012, 0.06, 0.005, blk, 0.39, 0.81, -0.24, P);
    c.rb(0.012, 0.06, 0.12, 0.008, MT.screen, 0.5, 0.75, 0, { rot: [0, 0, 0.5], parent: bar });
    c.part("guidao", "Guidão e painel", bar, new V3(0.44, 0.8, 0), 0.4);
    /* turbina: bocal, balde de ré (iBR), entrada de água, degrau de embarque, olhal de proa, marca */
    var pump = new THREE.Group(); pump.userData.rigid = true; c.g.add(pump); var PP = { parent: pump };
    c.cyl(0.075, 0.09, 0.22, blk, -1.4, -0.08, 0, "x", PP); c.cyl(0.05, 0.065, 0.06, MT.steel, -1.52, -0.08, 0, "x", PP);
    c.rb(0.08, 0.2, 0.24, 0.03, blk, -1.54, -0.02, 0, Object.assign({ rot: [0, 0, -0.35] }, PP));
    c.rb(0.06, 0.04, 0.42, 0.015, grey, -1.5, 0.18, 0, PP);
    c.rb(0.5, 0.02, 0.28, 0.01, CM("#2a2c2e"), -0.6, -0.245, 0);
    c.cyl(0.02, 0.02, 0.05, MT.chrome, 1.43, 0.3, 0, "x");
    [1, -1].forEach(function (s) {
      EA.hullText(c, H, "SI-DÚ SPARK", 0.86, 0.1, -0.3, 0.13, s, { fg: "#1b86c9" });
      c.rb(0.25, 0.04, 0.05, 0.015, grey, -1.25, -0.08, s * 0.4);
    });
    /* kit de luz noturna: bicolor no bico e branca alta na plataforma */
    EA.navLight(c, 1.27, 0.47, 0.05, "verde", "Luz bicolor (verde)", { r: 0.022, hs: 0.2 }); EA.navLight(c, 1.27, 0.47, -0.05, "vermelha", "Luz bicolor (vermelha)", { r: 0.022, hs: 0.2 });
    c.rod(new V3(-1.35, 0.2, -0.38), new V3(-1.35, 0.95, -0.38), 0.008, MT.chrome); EA.navLight(c, -1.35, 0.97, -0.38, "branca", "Luz de alcançado (haste)", { r: 0.025, hs: 0.25 });
    c.part("casco", "Casco", hull, new V3(0, -0.1, 0), 1.0); c.part("popa", "Turbina e iBR", pump, new V3(-1.55, -0.05, 0), 0.5);
    c.part("motor", "Motor Rotax 900 ACE (sob o banco)", null, new V3(-0.35, 0.15, 0), 0.6); c.part("tanque", "Tanque (30 L)", null, new V3(0.75, 0.2, 0), 0.5);
    Object.assign(c.meta, { kind: "boat", L: 3.05, W: 1.18, front: 1.5, rear: -1.6, clear: -0.25, belt: 0.3, bodyH: 0.6, top: 0.83, roof: null });
    c.zone("conves", "Banco, guidão e capô");
    c.zone("lanterna_c", "Luz bicolor do bico"); c.zone("lanterna_e", "Luz de alcançado"); c.zone("motor", "Motor Rotax (sob o banco)"); c.zone("popa", "Popa e turbina");
    c.meta.armor = function (c2) {
      /* modificado: prancha de resgate (sled) atrás, chapa de aço no bico, holofote no guidão e galão na plataforma */
      var stl = ZG.STEELM, sled = CM("#e8b51c", { roughness: 0.5 });
      c2.rb(1.1, 0.07, 1.0, 0.04, sled, -2.2, 0.08, 0); c2.rb(0.05, 0.12, 1.0, 0.03, sled, -2.75, 0.13, 0);
      [-0.35, 0, 0.35].forEach(function (z) { c2.rb(0.9, 0.03, 0.03, 0.01, CM("#1b1c1e"), -2.2, 0.13, z); });
      c2.rod(new V3(-1.66, 0.2, 0.3), new V3(-1.7, 0.12, 0.42), 0.015, stl); c2.rod(new V3(-1.66, 0.2, -0.3), new V3(-1.7, 0.12, -0.42), 0.015, stl);
      c2.rb(0.5, 0.2, 0.75, 0.02, stl, 1.15, 0.42, 0, { rot: [0, 0, -0.55] });
      ZG.jerry(c2, -1.3, 0.42, 0.18, "#8e2a20");
      EA.lamp(c2, 0.5, 0.88, 0.0001, 0.06, "Holofote no guidão");
    };
  });

  /* ================= veleiro ================= */
  /* Referência · veleiro de oceano de 26 pés, plano tipo Delta 26 (WebSearch: ficha de um 26 pés com quilha de bolbo — "Deltania 26":
     LOA 25,98 pés = 7,92 m · boca 9,38 pés = 2,86 m · calado 4,72 pés = 1,44 m · deslocamento 4.630 lb ≈ 2.100 kg)
     Mastro ≈ 9,5 m acima do convés, altura total ≈ 10,4 m acima d'água, retranca ≈ 3,1 m, armação fracionada 7/8, motor diesel de 10 hp de centro
     com rabeta fixa — mastro, retranca e motor de memória.
     Traços de assinatura:
       frente: proa lançada fina, púlpito de inox com luz bicolor, estai de proa até o topo de 7/8, genoa grande
       lateral: casco branco com friso azul e linha d'água, cabine baixa com janelas longas inclinadas, cockpit aberto à ré, mastro alto no teto da cabine
       traseira: espelho de popa largo e quase vertical com nome, leme de cana, balaústre (pushpit) com luz branca, escada de banho, estai de popa
       teto: casco em gota larga atrás, cabine estreita no meio, cockpit em U com catracas, gaiúta no convés de proa
     Embaixo: quilha de aleta (ferro fundido) com bulbo e leme suspenso; hélice de duas pás na frente do leme. */
  ZG.register({ k: "veleiro", grp: "Aquáticos", n: "Veleiro Delta 26", insp: "veleiro de oceano de 26 pés", art: "em um", c: "Veleiro de oceano de 26 pés (vela e motor diesel auxiliar)", fuel: "diesel",
    d: "Vela de dia, motor de 10 hp quando o vento some. Lento, mas cruza até o horizonte sem posto de gasolina.",
    mass: 2100, r: 30, seats: "6 (4 pernoites)", cap: "40 L diesel · 80 L água", eff: "≈ 1,5 L/h no motor · zero na vela", auto: "≈ 250 km no motor · ilimitada na vela", vmax: 13, skill: "Náutica 3 (vela)", hood: false
  }, function (c) {
    var L = 7.92, x0 = -3.96;
    var white = c.paint("#f2f1eb", { roughness: 0.3, metalness: 0.05 }), navy = CM("#1d3b6b", { roughness: 0.35 }), nonskid = CM("#d9d6cb", { roughness: 0.9 }), teak = CM("#9a7348", { roughness: 0.8 }), alu = CM("#b9bec2", { metalness: 0.7, roughness: 0.3 }), sailM = CM("#f4f2ea", { roughness: 0.85, side: DS }), wire = CM("#8f969b", { metalness: 0.8, roughness: 0.3 });
    var H = EA.boatHull({ x0: x0, L: L, n: 48, m1: 6, m2: 6, q: 1.5, fl: 0.7,
      keel: tb([[0, 0.05], [0.15, -0.3], [0.45, -0.5], [0.75, -0.4], [0.9, -0.08], [1, 1.05]]),
      chine: function (t) { return [tb([[0, 1.0], [0.4, 1.3], [0.75, 1.15], [0.95, 0.4], [1, 0.0]])(t), tb([[0, 0.28], [0.5, 0.05], [0.85, 0.3], [1, 1.05]])(t)]; },
      sheer: function (t) { return [tb([[0, 1.22], [0.45, 1.43], [0.8, 1.2], [0.95, 0.5], [1, 0.0]])(t), tb([[0, 0.95], [0.4, 0.88], [1, 1.2]])(t)]; } });
    var hull = c.add(H.geo, white); c.deform.push(hull);
    EA.skinOf(c, hull, EA.bandT(function (x, y) { return 0.0 - y; }), c.paint("#7b2220", { roughness: 0.6 }), { sz: 1.004, dy: 0.003 });
    EA.skinOf(c, hull, EA.bandT(function (x, y) { return 0.035 - Math.abs(y - 0.07); }), navy, { sz: 1.005 });
    EA.skinOf(c, hull, EA.bandT(function (x, y) { var sy = H.sheerAt(x).y; return Math.min(0.04 - Math.abs(y - (sy - 0.13)), x + 3.9, 3.7 - x); }), navy, { sz: 1.006 });
    EA.sheerTube(c, H, x0 + 0.01, 3.94, 0.025, CM("#e9e7df", { roughness: 0.5 }), { closeBow: true });
    /* convés: inteiro na proa, faixas laterais em volta do cockpit; piso do cockpit, bancos e braçolas */
    var fd = c.add(EA.deckGeo(H, -1.05, 3.95, { n: 30, m: 10, crown: 0.04 }), nonskid); c.deform.push(fd);
    var sd = c.add(EA.deckGeo(H, x0 + 0.02, -1.05, { inner: function (x) { return H.sheerAt(x).z - 0.3; }, n: 14, m: 3 }), nonskid); c.deform.push(sd);
    var cs = c.add(EA.deckGeo(H, x0 + 0.05, -1.05, { y: function () { return 0.48; }, inset: 0.02, n: 12, m: 8 }), teak); cs.castShadow = false;
    [1, -1].forEach(function (s) {
      c.rb(2.6, 0.06, 0.42, 0.02, teak, -2.45, 0.86, s * 0.82); c.rb(2.6, 0.38, 0.06, 0.02, white, -2.45, 0.67, s * 0.6);
      c.rb(2.8, 0.22, 0.05, 0.02, white, -2.4, 1.02, s * (H.sheerAt(-2.4).z - 0.32));
      c.cyl(0.06, 0.07, 0.11, MT.chrome, -1.6, 1.15, s * 1.06); c.cyl(0.035, 0.035, 0.02, MT.chrome, -1.6, 1.21, s * 1.06);
    });
    c.rb(0.3, 0.38, 1.2, 0.03, white, -3.75, 0.67, 0);
    c.seatTops.push({ x: -2.6, y: 0.9, z: 0.82, w: 0.42, l: 2.4 }, { x: -2.6, y: 0.9, z: -0.82, w: 0.42, l: 2.4 });
    /* cabine (casaria baixa), janelas longas, gaiúta de entrada com degraus, escotilha de proa */
    var trST = [[-1.1, 0.8, 1.56, 2.0, 6], [0.4, 0.8, 1.56, 2.0, 6], [1.4, 0.85, 1.48, 1.7, 6], [2.15, 0.92, 1.3, 1.05, 6]].reverse();
    var trunk = c.add(EA.fuseGeo(trST, { smooth: 18, seg: 32, p: 6 }), white); c.deform.push(trunk);
    EA.fuseSkin(c, trST, EA.bandT(function (x, y) { return y - 1.53; }), nonskid, { k: 1.004 });
    var winP = EA.polySdf([[-0.75, 1.2], [1.3, 1.22], [1.75, 1.32], [1.55, 1.42], [-0.75, 1.43]]);
    [1, -1].forEach(function (s) {
      var gw = EA.skinOf(c, trunk, EA.bandT(function (x, y, z) { return -Math.max(winP(x, y), 0.5 - s * z); }), MT.glassDark, { sz: 1.012 });
      c.deform.splice(c.deform.indexOf(gw), 1);
      ZG.asGlass(c, gw, "Janelas da cabine " + (s > 0 ? "boreste" : "bombordo"), "temperado");
    });
    c.rb(0.04, 0.5, 0.62, 0.01, CM("#1a1b1c"), -1.1, 1.2, 0); c.rb(0.05, 0.36, 0.56, 0.01, teak, -1.12, 1.12, 0);
    c.rb(0.65, 0.07, 0.72, 0.03, white, -0.7, 1.6, 0); c.rb(0.6, 0.06, 0.06, 0.02, white, -0.7, 1.58, 0.38); c.rb(0.6, 0.06, 0.06, 0.02, white, -0.7, 1.58, -0.38);
    c.rb(0.5, 0.05, 0.5, 0.02, CM("#5d6c78", { roughness: 0.3, metalness: 0.2 }), 2.75, 1.13, 0);
    /* cockpit: cana do leme, bússola, painel do motor, catracas da cabine, trilho da escota */
    c.rod(new V3(-3.55, 0.85, 0), new V3(-2.3, 1.02, 0), 0.03, teak); c.cyl(0.05, 0.05, 0.12, MT.steel, -3.55, 0.8, 0);
    c.cyl(0.08, 0.08, 0.06, CM("#111214"), -1.13, 1.38, 0.45, "x"); c.sph(0.06, MT.lens, -1.16, 1.4, 0.45, 0.6, 0.8, 1);
    c.rb(0.03, 0.18, 0.26, 0.01, MT.screen, -1.13, 1.38, -0.45);
    [1, -1].forEach(function (s) { c.cyl(0.045, 0.05, 0.09, MT.chrome, -0.85, 1.6, s * 0.75); });
    c.rb(0.06, 0.04, 1.4, 0.01, MT.steel, -1.9, 0.89, 0);
    /* quilha de aleta com bulbo, leme suspenso, hélice e escapamento do diesel */
    var keel = c.add(EA.foilGeo([{ p: [0.75, -0.3, 0], c: 1.15, t: 0.12 }, { p: [0.47, -1.36, 0], c: 0.76, t: 0.12 }], { up: "z", n: 10 }), CM("#2d2f31", { roughness: 0.6, metalness: 0.3 }));
    c.sph(0.11, CM("#2d2f31", { roughness: 0.6, metalness: 0.3 }), 0.08, -1.33, 0, 4.4, 1, 1.4);
    c.add(EA.foilGeo([{ p: [-3.2, -0.02, 0], c: 0.46, t: 0.1 }, { p: [-3.28, -1.05, 0], c: 0.33, t: 0.1 }], { up: "z", n: 8 }), CM("#7b2220", { roughness: 0.6 }));
    c.rod(new V3(-2.0, -0.3, 0), new V3(-2.45, -0.38, 0), 0.02, MT.steel); c.rb(0.25, 0.08, 0.04, 0.02, CM("#7b2220"), -2.05, -0.36, 0);
    var prop = EA.propeller(c, -2.5, -0.385, 0, { R: 0.17, blades: 2, chord: 0.08, spinner: false, tip: false, mat: CM("#b88a3c", { metalness: 0.7, roughness: 0.3 }), v: 0, tw0: 0.9 });
    c.cyl(0.03, 0.03, 0.06, MT.steel, -3.96, 0.32, 0.65, "x");
    /* mastro, cruzetas, retranca, velas e cabos fixos */
    var rig = new THREE.Group(); rig.userData.rigid = true; c.g.add(rig); var R = { parent: rig };
    var mx = 1.3, mTop = 10.4;
    c.cyl(0.07, 0.085, mTop - 1.56, alu, mx, (mTop + 1.56) / 2, 0, null, R);
    c.rod(new V3(mx, 5.7, -0.85), new V3(mx, 5.7, 0.85), 0.02, alu, R);
    c.cyl(0.055, 0.055, 3.25, alu, mx - 1.62, 2.12, 0, "x", R);
    var main = c.add(sailGeo([mx - 0.06, 2.2, 0], [mx - 0.06, mTop - 0.2, 0], [mx - 3.2, 2.2, 0.05], 0.06, { roach: 0.25 }), sailM, 0, 0, 0, rig);
    var jib = c.add(sailGeo([3.72, 1.32, 0], [mx + 0.08, 8.85, 0], [0.55, 1.75, 0.2], 0.08), sailM, 0, 0, 0, rig);
    main.castShadow = jib.castShadow = true;
    c.text("D26", 0.8, 0.5, mx - 1.2, 7.3, 0.03, "+z", { fg: "#1d3b6b", parent: rig }); c.text("D26", 0.8, 0.5, mx - 1.2, 7.3, -0.03, "-z", { fg: "#1d3b6b", parent: rig });
    function wireTo(a, b) { c.rod(new V3(a[0], a[1], a[2]), new V3(b[0], b[1], b[2]), 0.006, wire, R); }
    wireTo([mx + 0.06, 8.85, 0], [3.85, 1.28, 0]); wireTo([mx - 0.05, mTop, 0], [-3.9, 1.0, 0]);
    [1, -1].forEach(function (s) { wireTo([mx, 8.85, 0], [mx, 5.7, s * 0.85]); wireTo([mx, 5.7, s * 0.85], [mx - 0.1, 1.0, s * 1.33]); wireTo([mx, 5.7, s * 0.08], [mx + 0.45, 1.05, s * 1.25]); wireTo([mx, 5.7, s * 0.08], [mx - 0.6, 1.0, s * 1.3]); });
    c.rod(new V3(mx - 2.4, 2.1, 0), new V3(-1.9, 0.92, 0), 0.008, CM("#e4e0d0"), R);
    /* púlpito, balaústre de popa, candeeiros com cabos de vida, escada de banho, âncora */
    var pul = []; for (var i = 0; i <= 6; i++) { var a = i / 6 * PI; pul.push([3.25 + Math.sin(a) * 0.55, 1.18, Math.cos(a) * 0.45]); } EA.rail(c, pul, 0.6, 0.016, 3);
    var pp = []; for (var j = 0; j <= 6; j++) { var b = j / 6 * PI; pp.push([-3.85 + Math.sin(b) * 0.1, 0.96, Math.cos(b) * 1.05]); } EA.rail(c, pp, 0.62, 0.016, 2);
    [1, -1].forEach(function (s) {
      var st = []; for (var x = -3.2; x <= 2.81; x += 1.0) { var sh = H.sheerAt(x); st.push([x, sh.y, s * (sh.z - 0.05)]); }
      st.forEach(function (p) { c.rod(new V3(p[0], p[1], p[2]), new V3(p[0], p[1] + 0.6, p[2]), 0.012, MT.chrome, { seg: 6 }); });
      ropeAlong(c, st.map(function (p) { return [p[0], p[1] + 0.6, p[2]]; }), 0.03, 0.005, wire); ropeAlong(c, st.map(function (p) { return [p[0], p[1] + 0.32, p[2]]; }), 0.02, 0.005, wire);
      EA.navLight(c, 3.42, 1.8, s * 0.06, s > 0 ? "verde" : "vermelha", "Luz bicolor do púlpito " + (s > 0 ? "(verde)" : "(vermelha)"), { r: 0.03 });
    });
    [0, 1, 2].forEach(function (k) { c.rb(0.03, 0.02, 0.32, 0.01, MT.chrome, -4.0, 0.7 - k * 0.22, -0.55); });
    c.rb(0.2, 0.08, 0.1, 0.02, MT.steel, 3.93, 1.15, 0); c.rb(0.06, 0.22, 0.14, 0.02, MT.steel, 4.02, 1.02, 0);
    c.text("DELTA 26", 1.1, 0.2, -3.97, 0.62, 0.15, "-x", { fg: "#1d3b6b" });
    [1, -1].forEach(function (s) { EA.hullText(c, H, "DELTA 26", 0.9, 0.16, 2.3, 0.8, s, { fg: "#1d3b6b" }); });
    EA.navLight(c, -3.95, 1.62, 0, "branca", "Luz de alcançado (popa)", { r: 0.03 });
    EA.navLight(c, mx + 0.1, 5.2, 0, "branca", "Luz de mastro (motor)", { r: 0.035, parent: rig });
    EA.navLight(c, mx, mTop + 0.05, 0, "branca", "Luz de fundeio (topo)", { r: 0.03, parent: rig });
    c.part("casco", "Casco", hull, new V3(0, -0.2, 0), 2.0); c.part("quilha", "Quilha de bulbo", keel, new V3(0.3, -0.9, 0), 0.8);
    c.part("motor", "Motor diesel 10 hp (sob a escada)", null, new V3(-1.4, 0.35, 0), 0.8); c.part("tanque", "Tanque de diesel (40 L)", null, new V3(-2.8, 0.45, 0.6), 0.6);
    c.part("helice", "Hélice", prop, new V3(-2.5, -0.38, 0), 0.4); c.part("mastro", "Mastro e velas", rig, new V3(mx, 3.0, 0), 1.0);
    Object.assign(c.meta, { kind: "boat", L: L, W: 2.86, front: 3.96, rear: -3.96, clear: -1.44, belt: 0.95, bodyH: 1.6, top: mTop, roof: { x0: -1.1, x1: 2.0, w: 1.9, y: 1.56 } });
    c.zone("conves", "Convés, cabine e cockpit", null, null, { alsoGlass: true }); c.zone("motor", "Motor diesel de centro");
    c.zone("lanterna_c", "Luzes de navegação e de mastro"); c.zone("vidros_e", "Janelas da cabine (bombordo)"); c.zone("vidros_d", "Janelas da cabine (boreste)");
    c.zone("mastro", "Mastro, retranca e velas", [mx - 3.4, 4.0, 1.6, mTop + 0.2, -0.95, 0.95], [rig], { type: "peca", anchor: [mx, 1.6, 0], dir: "cima", fx: ["Nenhum", "Vela rasgada, cabo solto batendo", "Cruzeta torta, mastro balançando", "Mastro trincado, vela no convés", "Mastro quebrado: só no motor"] });
    c.meta.armor = function (c2) {
      /* modificado: velas recolhidas por vela de tempestade, chapas de aço nas janelas da cabine, galões amarrados no convés e holofote no púlpito */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { c2.rb(2.1, 0.3, 0.02, 0.01, stl, 0.45, 1.33, s * 0.985, { rot: [-s * 0.05, 0, 0] }); for (var x2 = -0.6; x2 < 1.3; x2 += 0.35) c2.rb(0.12, 0.03, 0.025, 0.005, CM("#151515"), x2, 1.36, s * 1.0); });
      [[-0.2, 1.08], [0.15, 1.08], [-0.2, -1.08]].forEach(function (q, i) { ZG.jerry(c2, q[0] + 2.4, 1.3, q[1] * 0.7, i % 2 ? "#3e5a34" : "#8e2a20"); });
      c2.rb(0.4, 0.4, 0.02, 0.01, stl, -3.85, 1.25, 0);
      EA.lamp(c2, 3.7, 1.95, 0.0001, 0.07, "Holofote no púlpito");
    };
  });

  /* ================= bote ================= */
  /* Referência · Zodiac FC 470 (bote inflável militar e de resgate) — de memória (a ficha não apareceu na busca)
     Medidas reais: comprimento 4,70 m · boca 1,90 m · diâmetro das boias 0,49 m · 6 compartimentos · casco ≈ 120 kg · até 10 pessoas ·
     motor de popa até 60 hp (usual 40 hp) · assoalho de alumínio · quilha inflável.
     Traços de assinatura:
       frente: boias em U subindo na proa, alça de proa, argola de reboque, cabo de vida em volta
       lateral: boia grossa laranja do comprimento todo, faixa de atrito cinza embaixo, cones de popa passando do espelho, "RESGATE" nas boias
       traseira: dois cones de boia além do espelho de madeira, motor de popa de cana no meio, tanque vermelho no piso
       teto: forma de U com boias grossas, assoalho cinza, banco transversal, maca e remos */
  ZG.register({ k: "bote", grp: "Aquáticos", n: "Zodiaque de resgate", insp: "bote inflável Zodiac FC 470", art: "no", c: "Bote inflável de resgate com motor de popa", fuel: "gasolina",
    d: "Boias de borracha que não afundam nem com furo em um gomo. Entra na enchente e sai com gente pendurada no cabo.",
    mass: 230, r: 75, seats: "10", cap: "25 L (tanque portátil)", eff: "≈ 14 L/h (40 hp)", auto: "≈ 90 km", vmax: 55, skill: "Náutica 1", hood: false
  }, function (c) {
    var orange = c.paint("#e2581f", { roughness: 0.6 }), grey = CM("#4a4f53", { roughness: 0.75, side: DS }), flo = CM("#8c9296", { roughness: 0.8, metalness: 0.3 }), rope = CM("#d9d4c2", { roughness: 0.9 });
    /* casco rígido baixo (quilha inflável e fundo) por dentro das boias */
    var H = EA.boatHull({ x0: -1.95, L: 3.95, n: 24, m1: 4, m2: 3, q: 0.9, fl: 1,
      keel: tb([[0, -0.17], [0.6, -0.2], [0.85, -0.1], [1, 0.25]]),
      chine: function (t) { return [tb([[0, 0.5], [0.6, 0.5], [0.88, 0.3], [1, 0.0]])(t), tb([[0, -0.06], [0.6, -0.06], [0.9, 0.08], [1, 0.25]])(t)]; },
      sheer: function (t) { return [tb([[0, 0.6], [0.6, 0.62], [0.88, 0.4], [1, 0.0]])(t), tb([[0, 0.14], [0.7, 0.15], [1, 0.32]])(t)]; } });
    var hull = c.add(H.geo, grey); c.deform.push(hull);
    /* boias: tubo de raio variável em U, cones de popa afinando, faixa de atrito e cabo de vida */
    var zc = 0.705, yc = 0.22;
    var half = [[-2.37, yc + 0.01, zc - 0.02], [-2.05, yc, zc], [-1.2, yc, zc], [0.2, yc, zc], [1.0, yc + 0.02, zc - 0.03], [1.55, yc + 0.07, zc - 0.17], [1.9, yc + 0.15, zc - 0.4], [2.09, yc + 0.2, 0]];
    var path = half.concat(half.slice(0, -1).reverse().map(function (p) { return [p[0], p[1], -p[2]]; }));
    function rf(u) { var e = Math.min(u, 1 - u); return 0.245 * (e < 0.035 ? 0.62 + 0.38 * EA.sstep(0, 0.035, e) : 1); }
    var tube = c.add(EA.sweepGeo(path, rf, { n: 140, rs: 20 }), orange); c.deform.push(tube);
    var strake = c.add(EA.sweepGeo(path.map(function (p) { var s = Math.sign(p[2]) || 0; return [p[0], p[1] - 0.17, p[2] + s * 0.08 * (Math.abs(p[2]) / zc)]; }), function (u) { return rf(u) * 0.36; }, { n: 140, rs: 10 }), grey);
    c.deform.push(strake);
    var rings = []; [1, -1].forEach(function (s) { for (var x = -1.9; x <= 1.31; x += 0.64) rings.push([x, yc + 0.17, s * (zc + 0.17)]); });
    var rs = rings.filter(function (p) { return p[2] > 0; }), rp = rings.filter(function (p) { return p[2] < 0; }).reverse();
    var loop = rs.concat([[1.85, yc + 0.32, 0.22], [2.15, yc + 0.32, 0], [1.85, yc + 0.32, -0.22]]).concat(rp);
    ropeAlong(c, loop, 0.05, 0.011, rope);
    loop.forEach(function (p) { c.rb(0.06, 0.05, 0.02, 0.01, MT.steel, p[0], p[1] - 0.02, p[2]); });
    [1, -1].forEach(function (s) {
      c.text("RESGATE", 1.3, 0.2, 0.0, yc + 0.02, s * (zc + 0.248), s > 0 ? "+z" : "-z", { fg: "#ffffff" });
      [-2.32, 1.95].forEach(function (x) { c.rb(0.04, 0.08, 0.04, 0.01, MT.plastic, x, yc + 0.2, s * 0.68); });
      c.rb(0.14, 0.05, 0.05, 0.02, CM("#1b1b1b"), -0.6, yc + 0.24, s * zc); c.rb(0.14, 0.05, 0.05, 0.02, CM("#1b1b1b"), 0.9, yc + 0.24, s * zc);
    });
    c.cyl(0.04, 0.04, 0.03, MT.steel, 2.2, yc + 0.1, 0, "x"); c.tube([[1.92, yc + 0.42, -0.12], [1.98, yc + 0.5, 0], [1.92, yc + 0.42, 0.12]], 0.014, CM("#1b1b1b"), { seg: 10, rs: 5 });
    /* assoalho de alumínio, espelho de madeira, banco transversal e equipamento de resgate */
    var flr = c.add(EA.deckGeo(H, -1.88, 1.45, { y: function () { return 0.02; }, inset: 0.02, n: 16, m: 8 }), flo); flr.castShadow = false;
    for (var xx = -1.5; xx < 1.4; xx += 0.6) c.rb(0.015, 0.006, H.half(xx, 0.02) * 2 - 0.08, 0.002, CM("#5d6266"), xx, 0.025, 0);
    c.rb(0.07, 0.62, 1.1, 0.02, CM("#3a3d40", { roughness: 0.6 }), -1.95, 0.22, 0); c.rb(0.07, 0.08, 1.2, 0.02, CM("#5c4a35"), -1.95, 0.54, 0);
    c.rb(0.32, 0.05, 1.42, 0.02, grey, -0.25, yc + 0.18, 0); c.rb(0.25, 0.1, 0.25, 0.03, CM("#2c3033"), -0.25, yc + 0.08, 0);
    c.seatTops.push({ x: -0.25, y: yc + 0.21, z: 0, w: 1.2, l: 0.3 }, { x: 0.6, y: yc + 0.25, z: zc, w: 0.3, l: 0.9 }, { x: 0.6, y: yc + 0.25, z: -zc, w: 0.3, l: 0.9 }, { x: -1.1, y: yc + 0.25, z: zc, w: 0.3, l: 0.8 }, { x: -1.1, y: yc + 0.25, z: -zc, w: 0.3, l: 0.8 });
    var tank = c.rb(0.48, 0.24, 0.3, 0.06, CM("#a3241c", { roughness: 0.5 }), -1.55, 0.15, 0.2);
    c.rod(new V3(-1.6, 0.27, 0.2), new V3(-1.9, 0.5, 0.05), 0.01, CM("#1b1b1b"));
    c.rb(1.8, 0.05, 0.45, 0.02, CM("#e8b51c", { roughness: 0.5 }), 0.55, 0.06, -0.12);
    [-0.25, 0.25].forEach(function (z) { c.rb(1.6, 0.025, 0.04, 0.01, CM("#1b1c1e"), 0.55, 0.09, -0.12 + z * 0.6); });
    c.rb(1.6, 0.03, 0.1, 0.01, MT.wood, 0.3, 0.05, 0.38, { rot: [0.2, 0, 0] }); c.rb(1.6, 0.03, 0.1, 0.01, MT.wood, 0.3, 0.06, 0.28, { rot: [0.2, 0, 0] });
    c.rb(0.36, 0.24, 0.26, 0.03, CM("#ffffff", { roughness: 0.5 }), 1.25, 0.14, 0.15); c.rb(0.1, 0.03, 0.02, 0.005, CM("#d01c1c"), 1.25, 0.2, 0.282); c.rb(0.03, 0.1, 0.02, 0.005, CM("#d01c1c"), 1.25, 0.2, 0.282);
    var buoy = c.add(new THREE.TorusGeometry(0.24, 0.06, 10, 24), CM("#f0f0ea", { roughness: 0.6 }), 1.1, 0.1, -0.2); buoy.rotation.x = PI / 2;
    /* motor de popa 40 hp de cana; luzes: bicolor na proa, branca circular no mastro de popa, giroflex azul de resgate */
    var mot = EA.outboard(c, -1.99, 0.55, 0, { k: 1.0, tiller: true, label: "40", col: "#1d1f22" });
    EA.navLight(c, 1.98, yc + 0.48, 0.06, "verde", "Luz de proa (verde)", { r: 0.025, hs: 0.25 }); EA.navLight(c, 1.98, yc + 0.48, -0.06, "vermelha", "Luz de proa (vermelha)", { r: 0.025, hs: 0.25 });
    c.rod(new V3(1.98, yc + 0.25, 0), new V3(1.98, yc + 0.45, 0), 0.01, MT.chrome);
    c.rod(new V3(-1.92, 0.55, -0.45), new V3(-1.92, 1.25, -0.45), 0.014, MT.chrome); EA.navLight(c, -1.92, 1.28, -0.45, "branca", "Luz circular de popa", { r: 0.03 });
    EA.navLight(c, -1.92, 1.12, -0.45, "azul", "Giroflex azul de resgate", { r: 0.035, hs: 0.45 });
    c.part("casco", "Boias e casco", tube, new V3(0, 0.2, 0), 1.4); c.part("popa", "Motor de popa", mot, new V3(-2.3, 0.5, 0), 0.8); c.part("tanque", "Tanque portátil", tank, new V3(-1.55, 0.15, 0.2), 0.5);
    Object.assign(c.meta, { kind: "boat", L: 4.7, W: 1.9, front: 2.33, rear: -2.6, clear: -0.2, belt: 0.45, bodyH: 0.6, top: 1.3, roof: null });
    c.zone("conves", "Assoalho, banco e equipamento de resgate");
    c.zone("lanterna_c", "Luzes de proa"); c.zone("lanterna_e", "Luz de popa e giroflex");
    c.meta.armor = function (c2) {
      /* modificado: chapas de alumínio grosso protegendo as boias da proa, holofote em mastro, galões e grade no motor */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { [0.3, 0.95].forEach(function (x2) { c2.rb(0.6, 0.38, 0.02, 0.02, stl, x2, yc + 0.03, s * (zc + 0.26)); }); c2.rb(0.5, 0.36, 0.02, 0.02, stl, 1.65, yc + 0.08, s * 0.66, { rot: [0, s * 0.6, 0] }); });
      c2.rod(new V3(1.3, 0.04, 0), new V3(1.3, 1.25, 0), 0.025, stl); EA.lamp(c2, 1.38, 1.28, 0.0001, 0.08, "Holofote de busca");
      ZG.jerry(c2, -1.15, 0.24, -0.25, "#3e5a34"); ZG.jerry(c2, -1.15, 0.24, -0.45, "#8e2a20");
      c2.tube([[-2.0, 0.55, -0.35], [-2.65, 0.5, -0.3], [-2.65, 0.5, 0.3], [-2.0, 0.55, 0.35]], 0.016, stl, { seg: 16, rs: 6 });
    };
  });

  /* ================= patrulha ================= */
  /* Referência · lancha de patrulha fluvial de 40 pés, base LPR-40 (WebSearch: ficha da LPR-40 — 12,7 m · boca 2,8 m · calado 0,7 m ·
     ≈ 14 t carregada · 2 motores diesel Caterpillar C9 com jato d'água · 29 nós · 4 tripulantes · metralhadora .50 (12,7 mm) e 7,62 mm · radar).
     Marcas genéricas: "PATRULHA" e número de casco fictício, sem insígnia real.
     Traços de assinatura:
       frente: proa em V fundo alta e fina, reparo de .50 com escudo no castelo, para-brisa inclinado de três painéis, defensa preta grossa
       lateral: casco cinza naval com linha preta d'água, casaria baixa e larga no meio, mastro com radar e antenas, defensa em D na borda
       traseira: popa reta com dois bocais de jato d'água e baldes de ré, plataforma de abordagem, metralhadoras 7,62 nas bordas de ré
       teto: convés liso cinza escuro, casaria quase da boca toda, tampas de motor no convés de ré, balsa salva-vidas em casulo */
  ZG.register({ k: "patrulha", grp: "Aquáticos", n: "Lancha Patrulha", insp: "lancha de patrulha fluvial LPR-40", art: "na", c: "Lancha de patrulha fluvial armada", fuel: "diesel",
    d: "Casco de alumínio, dois jatos d'água e metralhadora na proa. Entra em rio raso e sai de ré sem leme.",
    mass: 14000, r: 160, seats: "4 tripulantes + 8", cap: "≈ 1.600 L", eff: "≈ 120 L/h (cruzeiro de 20 nós)", auto: "≈ 450 km", vmax: 54, skill: "Náutica 3", hood: false
  }, function (c) {
    var L = 12.42, x0 = -6.05;
    var hullC = c.paint("#66727a", { roughness: 0.5, metalness: 0.25 }), deckC = CM("#4b545a", { roughness: 0.9 }), cabC = c.paint("#76828a", { roughness: 0.5, metalness: 0.2 }), blk = CM("#151617", { roughness: 0.6 }), gunM = CM("#202224", { metalness: 0.5, roughness: 0.4 });
    var H = EA.boatHull({ x0: x0, L: L, n: 50, m1: 6, m2: 6, q: 0.9, fl: 0.85,
      keel: tb([[0, -0.55], [0.5, -0.7], [0.8, -0.5], [0.95, 0.4], [1, 1.5]]),
      chine: function (t) { return [tb([[0, 1.25], [0.55, 1.28], [0.85, 0.98], [0.97, 0.3], [1, 0.0]])(t), tb([[0, -0.05], [0.6, 0.0], [0.9, 0.55], [1, 1.5]])(t)]; },
      sheer: function (t) { return [tb([[0, 1.31], [0.55, 1.33], [0.85, 1.16], [0.97, 0.45], [1, 0.0]])(t), tb([[0, 1.12], [0.6, 1.2], [1, 1.78]])(t)]; } });
    var hull = c.add(H.geo, hullC); c.deform.push(hull);
    EA.skinOf(c, hull, EA.bandT(function (x, y) { return Math.min(0.06 - y, x - x0 - 0.04); }), CM("#1d2023", { roughness: 0.6 }), { sz: 1.004, dy: 0.003 });
    EA.sheerTube(c, H, x0 + 0.02, 6.2, 0.07, blk, { dy: -0.1, dz: 0.02 });
    var deck = c.add(EA.deckGeo(H, x0 + 0.02, 6.32, { n: 40, m: 10, crown: 0.05 }), deckC); c.deform.push(deck);
    var dk = function (x) { return H.sheerAt(x).y + 0.04; };
    /* casaria com para-brisa inclinado, janelas recortadas, porta de ré, teto com aba */
    var hx = 0.9, hy0 = dk(hx), hh = 1.85, cab = c.rb(3.4, hh, 2.3, 0.1, cabC, hx, hy0 + hh / 2, 0, { def: true, taper: { sx: 0.88, sz: 0.92, shift: -0.2 } });
    var cutF = { sel: function (n) { return n.x > 0.5; }, sdf: function (x, y, z) { return Math.max(0.2 - y, y - 0.75, Math.abs(z) - 0.98, 0.04 - Math.abs(z - 0.33), 0.04 - Math.abs(z + 0.33)); } };
    var cutD = { sel: function (n, ce) { return n.x < -0.5 && ce.x < 0; }, sdf: function (x, y, z) { return Math.max(-0.88 - y, y - 0.6, Math.abs(z + 0.35) - 0.33); } };
    ZG.cutMesh(cab, [EA.sideCutP([[-1.3, 0.2], [-0.15, 0.2], [-0.15, 0.7], [-1.3, 0.7]], 0.5), EA.sideCutP([[-0.05, 0.2], [1.0, 0.2], [0.85, 0.7], [-0.05, 0.7]], 0.5), cutF, cutD], 42, { sub: 0.15 });
    var kF = (0.475 + hh / 2) / hh, fx = hx + 1.7 * (1 - 0.12 * kF) - 0.2 * kF - 0.02, fzw = 1.15 * (1 - 0.08 * kF);
    var fw = c.rb(0.016, 0.6, fzw * 2 - 0.12, 0.01, MT.glass, fx, hy0 + hh / 2 + 0.475, 0, { rot: [0, 0, 0.214] }); ZG.asGlass(c, fw, "Para-brisa da casaria", "laminado");
    [1, -1].forEach(function (s) {
      var kS = (0.45 + hh / 2) / hh, sz = 1.15 * (1 - 0.08 * kS) - 0.02;
      var gs = c.rb(2.3, 0.52, 0.014, 0.01, MT.glass, hx - 0.15 - 0.15, hy0 + hh / 2 + 0.45, s * sz, { rot: [-s * 0.05, 0, 0] }); ZG.asGlass(c, gs, "Janelas " + (s > 0 ? "de boreste" : "de bombordo"), "laminado");
      EA.navLight(c, hx + 1.2, hy0 + hh - 0.2, s * 1.12, s > 0 ? "verde" : "vermelha", "Luz de bordo " + (s > 0 ? "boreste (verde)" : "bombordo (vermelha)"), { r: 0.045 });
      c.rb(0.3, 0.2, 0.05, 0.02, blk, hx + 1.2, hy0 + hh - 0.2, s * 1.08);
      EA.hullText(c, H, "PATRULHA", 2.0, 0.3, 0.4, 0.75, s, { fg: "#f2f2f2" });
      EA.hullText(c, H, "LP-07", 0.8, 0.3, 2.4, 0.85, s, { fg: "#f2f2f2" });
    });
    var door = c.rb(0.05, 1.48, 0.64, 0.02, cabC, hx - 1.72, hy0 + 0.76, -0.35); void door;
    var roof = c.rb(3.6, 0.08, 2.5, 0.03, cabC, hx + 0.05, hy0 + hh + 0.03, 0);
    c.rb(0.5, 0.05, 2.3, 0.02, cabC, hx + 1.55, hy0 + hh + 0.02, 0, { rot: [0, 0, -0.12] });
    /* interior: console de comando com telas, timão, manetes, bancos amortecidos e banco de ré */
    var ih = hy0 + 0.02;
    c.rb(3.2, 0.02, 2.1, 0.01, CM("#2e3236", { roughness: 0.95 }), hx, ih, 0).castShadow = false;
    c.rb(0.5, 0.95, 2.0, 0.04, CM("#2d3034"), hx + 1.1, ih + 0.48, 0); c.rb(0.5, 0.03, 2.0, 0.01, CM("#191a1c"), hx + 1.1, ih + 0.96, 0);
    [-0.55, 0, 0.55].forEach(function (z) { c.rb(0.03, 0.26, 0.42, 0.01, MT.screen, hx + 0.92, ih + 1.1, z, { rot: [0, 0, 0.3] }); });
    var whl = c.add(new THREE.TorusGeometry(0.2, 0.022, 8, 26), CM("#191a1c"), hx + 0.72, ih + 1.02, 0.45); whl.rotation.set(0, PI / 2, -0.4);
    c.rod(new V3(hx + 0.86, ih + 0.92, 0.45), new V3(hx + 0.72, ih + 1.02, 0.45), 0.02, MT.chrome);
    [0.0, 0.1].forEach(function (z) { c.rod(new V3(hx + 0.88, ih + 0.97, z - 0.05), new V3(hx + 0.78, ih + 1.12, z - 0.05), 0.012, MT.chrome); c.sph(0.025, MT.plastic, hx + 0.78, ih + 1.12, z - 0.05); });
    ZG.seat(c, hx + 0.05, ih, 0.45, { w: 0.52, h: 0.62, back: 0.6, lean: 0.12, mat: CM("#25282b", { roughness: 0.8 }) });
    ZG.seat(c, hx + 0.05, ih, -0.45, { w: 0.52, h: 0.62, back: 0.6, lean: 0.12, mat: CM("#25282b", { roughness: 0.8 }) });
    c.rb(0.45, 0.42, 1.9, 0.04, CM("#25282b", { roughness: 0.8 }), hx - 1.35, ih + 0.21, 0.1); c.seatTops.push({ x: hx - 1.35, y: ih + 0.44, z: 0.1, w: 1.8, l: 0.4 });
    c.rb(3.0, 0.02, 2.0, 0.01, CM("#3a3f44", { roughness: 0.9 }), hx, hy0 + hh - 0.06, 0).castShadow = false;
    /* mastro com radar, antenas, holofote e giroflex azuis */
    var mast = new THREE.Group(); mast.userData.rigid = true; c.g.add(mast); var M = { parent: mast }, ry = hy0 + hh + 0.07;
    c.rod(new V3(hx - 0.6, ry, 0.7), new V3(hx - 0.35, ry + 1.0, 0), 0.04, CM("#c9cdd0"), M); c.rod(new V3(hx - 0.6, ry, -0.7), new V3(hx - 0.35, ry + 1.0, 0), 0.04, CM("#c9cdd0"), M);
    c.rod(new V3(hx - 0.35, ry + 1.0, 0), new V3(hx - 0.35, ry + 1.45, 0), 0.035, CM("#c9cdd0"), M);
    c.cyl(0.07, 0.09, 0.16, CM("#e8e8e4"), hx - 0.35, ry + 1.1, 0, null, M);
    var scan = c.rb(0.16, 0.1, 1.2, 0.03, CM("#e8e8e4", { roughness: 0.4 }), hx - 0.35, ry + 1.23, 0, M);
    c.spin.push({ o: scan, axis: "y", v: 2.5 });
    EA.navLight(c, hx - 0.35, ry + 1.5, 0, "branca", "Luz de mastro", { r: 0.045, parent: mast });
    [0.9, -0.9].forEach(function (z) { c.rod(new V3(hx - 1.2, ry, z), new V3(hx - 1.2, ry + 2.3, z * 0.9), 0.012, blk, M); });
    [1, -1].forEach(function (s) { EA.navLight(c, hx + 1.4, ry + 0.07, s * 0.95, "azul", "Giroflex azul " + (s > 0 ? "boreste" : "bombordo"), { r: 0.05, hs: 0.5 }); });
    EA.lamp(c, hx + 1.55, ry + 0.2, 0.0001, 0.1, "Holofote de busca");
    c.cyl(0.25, 0.25, 1.1, CM("#eceae2", { roughness: 0.5 }), hx - 1.25, ry + 0.27, 0, "z");
    /* armas: .50 no castelo com escudo, 7,62 nas bordas de ré */
    var g50 = new THREE.Group(); g50.userData.rigid = true; c.g.add(g50); var GP = { parent: g50 }, gx = 4.2, gy = dk(4.2);
    c.cyl(0.12, 0.16, 0.7, gunM, gx, gy + 0.35, 0, null, GP);
    c.rb(0.06, 0.65, 0.9, 0.03, gunM, gx + 0.35, gy + 0.98, 0, Object.assign({ rot: [0, 0, -0.08] }, GP));
    c.rb(0.75, 0.2, 0.16, 0.03, gunM, gx + 0.05, gy + 0.85, 0, GP); c.cyl(0.035, 0.035, 0.9, gunM, gx + 0.85, gy + 0.88, 0, "x", GP);
    c.cyl(0.05, 0.05, 0.25, gunM, gx + 1.25, gy + 0.88, 0, "x", GP); c.rb(0.2, 0.15, 0.12, 0.02, CM("#4e5a3a"), gx - 0.05, gy + 0.78, -0.16, GP);
    [-0.12, 0.12].forEach(function (z) { c.rod(new V3(gx - 0.35, gy + 0.85, z), new V3(gx - 0.5, gy + 0.85, z * 1.6), 0.015, gunM, GP); });
    var g76 = new THREE.Group(); g76.userData.rigid = true; c.g.add(g76); var GQ = { parent: g76 };
    [1, -1].forEach(function (s) {
      var px = -4.3, py = dk(px), pz = s * (H.sheerAt(px).z - 0.2);
      c.rod(new V3(px, py, pz), new V3(px, py + 0.95, pz), 0.04, gunM, GQ);
      c.rb(0.6, 0.12, 0.1, 0.02, gunM, px + 0.05, py + 1.0, pz, Object.assign({ rot: [0, -s * 0.3, 0] }, GQ));
      c.rod(new V3(px, py + 1.0, pz), new V3(px + 0.62, py + 1.02, pz + s * 0.2), 0.018, gunM, GQ);
    });
    /* borda: balaústre baixo, cabeços, tampas dos motores, popa com jatos d'água, plataforma, âncora */
    [1, -1].forEach(function (s) {
      var pts = []; for (var x = -5.85; x <= 5.4; x += 0.82) { var sh = H.sheerAt(x); pts.push([x, sh.y + 0.03, s * (sh.z - 0.06)]); }
      EA.rail(c, pts.filter(function (p) { return p[0] < hx - 1.8 || p[0] > hx + 1.9; }), 0.62, 0.02, 1);
      [-5.4, 2.9].forEach(function (x) { c.cyl(0.06, 0.07, 0.18, MT.steel, x, dk(x) + 0.09, s * (H.sheerAt(x).z - 0.25)); });
    });
    [0.55, -0.55].forEach(function (z) { c.rb(1.6, 0.03, 0.9, 0.02, CM("#555e64", { roughness: 0.8 }), -3.4, dk(-3.4) + 0.01, z); });
    var jets = new THREE.Group(); jets.userData.rigid = true; c.g.add(jets); var JP = { parent: jets };
    [0.55, -0.55].forEach(function (z) {
      c.cyl(0.2, 0.24, 0.3, CM("#8e9498", { metalness: 0.6, roughness: 0.35 }), x0 - 0.12, -0.1, z, "x", JP);
      c.rb(0.16, 0.42, 0.42, 0.06, CM("#7d8387", { metalness: 0.6, roughness: 0.4 }), x0 - 0.32, -0.05, z, Object.assign({ rot: [0, 0, 0.35] }, JP));
      c.cyl(0.07, 0.07, 0.1, blk, x0 - 0.02, 0.55, z * 1.6, "x");
    });
    c.rb(0.3, 0.06, 2.2, 0.02, CM("#4b545a", { roughness: 0.9 }), x0 - 0.16, 0.35, 0);
    c.rb(0.25, 0.1, 0.12, 0.02, MT.steel, 6.25, 1.6, 0); c.rb(0.06, 0.35, 0.22, 0.03, blk, 6.34, 1.45, 0);
    EA.navLight(c, x0 + 0.1, dk(x0) + 0.75, 0.0, "branca", "Luz de alcançado (popa)", { r: 0.04 });
    c.rod(new V3(x0 + 0.1, dk(x0), 0), new V3(x0 + 0.1, dk(x0) + 0.72, 0), 0.02, MT.steel);
    c.part("casco", "Casco de alumínio", hull, new V3(1, -0.2, 0), 2.6); c.part("popa", "Jatos d'água", jets, new V3(x0 - 0.3, -0.1, 0), 0.8);
    c.part("motor", "Motores diesel (2 x C9)", null, new V3(-3.4, 0.4, 0), 1.2); c.part("tanque", "Tanques de diesel", null, new V3(-1.6, 0.0, 0), 1.0);
    c.part("arma", "Metralhadora .50 da proa", g50, new V3(gx, gy + 0.8, 0), 0.6); c.part("arma", "Metralhadoras 7,62 de ré", g76, new V3(-4.3, dk(-4.3) + 1.0, 0), 1.2);
    Object.assign(c.meta, { kind: "boat", L: 12.7, W: 2.8, front: 6.4, rear: -6.4, clear: -0.7, belt: 1.25, bodyH: 2.6, top: ry + 1.5, roof: { x0: hx - 1.7, x1: hx + 1.7, w: 2.3, y: hy0 + hh + 0.07 } });
    c.zone("conves", "Convés e casaria", null, null, { alsoGlass: true }); c.zone("motor", "Motores diesel e jatos d'água"); c.zone("tanque", "Tanques de diesel");
    c.zone("lanterna_d", "Luz de bordo de boreste"); c.zone("lanterna_e", "Luz de bordo de bombordo"); c.zone("lanterna_c", "Luzes de mastro, popa e giroflex"); c.zone("farol_c", "Holofote de busca");
    c.zone("vidros_f", "Para-brisa da casaria"); c.zone("vidros_e", "Janelas de bombordo"); c.zone("vidros_d", "Janelas de boreste");
    /* revisor: uma zona por reparo (a caixa única cobria o barco inteiro no mapa) */
    c.zone("arma_proa", "Metralhadora .50 da proa", [gx - 0.7, gx + 1.5, gy - 0.05, gy + 1.45, -0.75, 0.75], [g50], { type: "peca", fxKey: "arma", dir: "frente" });
    c.zone("armas_popa", "Metralhadoras 7,62 de ré", [-4.95, -3.55, dk(-4.3) - 0.05, dk(-4.3) + 1.25, -1.5, 1.5], [g76], { type: "peca", fxKey: "arma", dir: "tras" });
    c.zone("radar", "Mastro, radar e antenas", [hx - 1.5, hx + 1.8, ry - 0.05, ry + 2.4, -1.2, 1.2], [mast], { type: "peca", dir: "cima", fx: ["Nenhum", "Antena entortada, rádio chiando", "Radar parado, tela congelada", "Mastro torto, radar pendurado", "Mastro arrancado: sem radar nem rádio"] });
    c.meta.armor = function (c2) {
      /* modificado: chapas balísticas extras com fresta de visão no para-brisa, grade antirrojão na casaria, sacos de areia na proa e escudo nas 7,62 */
      var stl = ZG.STEELM;
      c2.rb(0.05, 0.42, 2.0, 0.02, stl, fx + 0.03, hy0 + hh / 2 + 0.38, 0, { rot: [0, 0, 0.214] });
      [1, -1].forEach(function (s) {
        for (var x2 = hx - 1.6; x2 <= hx + 1.45; x2 += 0.22) c2.rod(new V3(x2, hy0 + 0.25, s * 1.32), new V3(x2 - 0.05, hy0 + hh - 0.1, s * 1.25), 0.014, stl);
        c2.rod(new V3(hx - 1.6, hy0 + hh - 0.1, s * 1.25), new V3(hx + 1.45, hy0 + hh - 0.1, s * 1.25), 0.02, stl);
        c2.rb(0.45, 0.4, 0.04, 0.02, stl, -4.0, dk(-4.0) + 0.95, s * (H.sheerAt(-4.0).z + 0.05));
      });
      for (var k = 0; k < 5; k++) c2.rb(0.5, 0.18, 0.3, 0.08, CM("#9a8a62", { roughness: 1 }), 4.85, dk(4.85) + 0.1 + (k > 2 ? 0.17 : 0), (k % 3 - 1) * 0.32);
    };
  });
})(window.ZG);
