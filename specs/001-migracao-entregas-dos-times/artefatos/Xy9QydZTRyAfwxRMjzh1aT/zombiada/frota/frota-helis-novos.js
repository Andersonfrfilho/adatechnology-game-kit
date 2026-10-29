/* frota-helis-novos.js: helicópteros novos da v4 (grupo H). Só usa a API de window.ZG (veja API.md), os utilitários de
   frota-agua-ar.js expostos em ZG.EA e os do grupo H expostos em ZG.GH (frota-avioes-novos.js, carregado antes).
   Funções locais deste arquivo (não estão no núcleo): skids (esquis com tubos transversais), fenestron (rotor de cauda carenado),
   xRotor (rotor de cauda em X do Mi-35M), gunTurret (torre de canhão de nariz), rocketPod (casulo de foguetes). */
(function (ZG) {
  "use strict";
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM, G = ZG.geo;
  var GH = ZG.GH;

  /* ================= utilitários locais ================= */
  /* esquis: dois tubos com ponta dobrada para cima e tubos transversais em arco até a barriga; devolve as malhas */
  function skids(c, o) {
    var mat = o.mat || MT.steel, z = o.z, y = o.y || 0.07, out = [];
    [1, -1].forEach(function (s) {
      out.push(c.tube([[o.x0, y + 0.02, s * z], [o.x0 + 0.1, y, s * z], [o.x1 - 0.15, y, s * z], [o.x1 + 0.05, y + 0.07, s * z], [o.x1 + 0.16, y + 0.2, s * z]], o.r || 0.04, mat, { seg: 40 }));
      (o.shoes || []).forEach(function (x) { out.push(c.rb(0.16, 0.03, 0.06, 0.01, MT.trim, x, y - 0.03, s * z)); });
      if (o.step) out.push(c.rb(o.step[1], 0.03, 0.2, 0.01, MT.steel, o.step[0], y + 0.28, s * (z - 0.12)), c.rod(new V3(o.step[0], y, s * z), new V3(o.step[0], y + 0.28, s * (z - 0.12)), 0.018, MT.steel));
    });
    o.cross.forEach(function (q) {
      var x = q[0], top = q[1], zi = q[2];
      out.push(c.tube([[x, y, -z], [x + (q[3] || 0), (y + top) * 0.55, -(z + zi) / 2 - 0.08], [x + (q[3] || 0) * 1.4, top, -zi], [x + (q[3] || 0) * 1.4, top + 0.03, 0], [x + (q[3] || 0) * 1.4, top, zi], [x + (q[3] || 0), (y + top) * 0.55, (z + zi) / 2 + 0.08], [x, y, z]], o.r2 || 0.035, mat, { seg: 40 }));
    });
    return out;
  }
  /* cone de cauda por estações ao longo de x: [x, y centro, raio vertical, raio lateral] */
  function boom(c, EA, pts, mat) {
    var st = pts.map(function (q) { return [q[0], q[1] - q[2], q[1] + q[2], q[3] * 2, 2]; });
    var m = c.add(EA.fuseGeo(st, { smooth: 24, seg: 22 }), mat); c.deform.push(m); return m;
  }
  /* fenestron: carenagem anelar na deriva com ventilador de n pás girando em z e estator */
  function fenestron(c, x, y, R, w, n, mat, bladeMat) {
    var ring = c.add(new THREE.TorusGeometry(R + 0.06, 0.07, 10, 36), mat, x, y, 0); ring.scale.z = w / 0.14; c.deform.push(ring);
    var duct = c.cyl(R + 0.01, R + 0.01, w, MT.dark, x, y, 0, "z", { seg: 36, open: true }); duct.material = CM("#141516", { roughness: 0.8, side: THREE.DoubleSide });
    var g = new THREE.Group(); g.position.set(x, y, -w * 0.15); c.g.add(g);
    for (var i = 0; i < n; i++) { var p = new THREE.Group(); p.rotation.z = i / n * PI * 2; g.add(p); var b = new THREE.Mesh(G.rbox(0.07, R - 0.1, 0.012, 0.005), bladeMat); b.position.y = (R - 0.1) / 2 + 0.08; b.rotation.y = 0.35; p.add(b); }
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 14), MT.steel); hub.rotation.x = PI / 2; g.add(hub);
    for (var k = 0; k < 8; k++) { var a = k / 8 * PI * 2 + 0.2; c.rod(new V3(x + Math.cos(a) * 0.1, y + Math.sin(a) * 0.1, w * 0.2), new V3(x + Math.cos(a) * R, y + Math.sin(a) * R, w * 0.25), 0.012, MT.trim); }
    c.spin.push({ o: g, axis: "z", v: 22 });
    return { ring: ring, fan: g, duct: duct };
  }
  /* rotor de cauda em X (dois rotores bipá defasados ~ 38°), girando em z */
  function xRotor(c, x, y, z, R, ch, mat, tip) {
    var g = new THREE.Group(); g.position.set(x, y, z); c.g.add(g);
    [0, 0.66, PI, PI + 0.66].forEach(function (a, i) {
      var p = new THREE.Group(); p.rotation.z = a; p.position.z = i % 2 ? 0.1 : 0; g.add(p);
      var b = new THREE.Mesh(G.rbox(ch, R - 0.15, 0.03, 0.01), mat); b.position.y = (R - 0.15) / 2 + 0.15; b.rotation.y = 0.25; b.castShadow = true; p.add(b);
      if (tip) { var t = new THREE.Mesh(G.rbox(ch * 1.02, 0.2, 0.032, 0.008), tip); t.position.y = R - 0.1; p.add(t); }
    });
    var hb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16), MT.steel); hb.rotation.x = PI / 2; hb.position.z = 0.05; g.add(hb);
    c.spin.push({ o: g, axis: "z", v: 11 });
    return g;
  }
  /* casulo de 20 foguetes (B-8 genérico): corpo com bico e boca escura de tubos */
  function rocketPod(c, EA, x, y, z, L, r, mat) {
    var m = GH.pod(c, EA, x + L / 2, x - L / 2, y, z, r, mat);
    var face = c.cyl(r * 0.95, r * 0.95, 0.02, MT.dark, x + L / 2 - L * 0.02, y, z, "x", { seg: 20 });
    for (var i = 0; i < 6; i++) { var a = i / 6 * PI * 2; c.cyl(0.03, 0.03, 0.03, CM("#2a2a28"), x + L / 2 - L * 0.01, y + Math.cos(a) * r * 0.55, z + Math.sin(a) * r * 0.55, "x", { seg: 8 }); }
    return [m, face];
  }

  /* ================= Robinsom R22 ================= */
  /* Referência · Robinson R22 Beta II — WebFetch (Sloane Helicopters: comprimento 8,8 m, altura 2,7 m, rotor 7,7 m), resto de memória
     Medidas reais: comprimento total com rotores 8,76 m · rotor principal 7,67 m (2 pás) · rotor de cauda 1,07 m · altura 2,67 m (topo do cubo) ·
     largura da cabine 1,12 m · bitola dos esquis 1,93 m (de memória) · comprimento dos esquis ≈ 2,1 m · fuselagem (nariz à cauda) ≈ 6,3 m ·
     motor Lycoming O-360 de 4 cilindros (131 hp reduzidos) · tanques de 72 L + 40 L.
     Traços de assinatura:
       frente: bolha de para-brisa redonda e pequena dividida por uma tira, manche em T no meio da cabine (um cabo para dois pilotos),
               dois faróis de pouso no nariz, mastro alto e fino com cubo basculante e pratos expostos
       lateral: girino minúsculo: cabine de dois lugares com uma porta por lado, motor quase todo exposto atrás da cabine sob a carenagem
                do mastro (cilindros, ventoinha e escapamento à vista), cone de cauda fininho, esquis curtos
       traseira: deriva superior e inferior com proteção de cauda em tubo, estabilizador pequeno, rotor de cauda bipá à esquerda
       teto: rotor bipá comprido em relação à cabine, cabine em gota, cone de cauda reto */
  ZG.register({ k: "r22", grp: "Aéreos", n: "Robinsom R22", insp: "Robinson R22 Beta II", c: "Helicóptero leve de 2 lugares a pistão", fuel: "avgas",
    d: "O helicóptero de escola. Leve, barato e nervoso no comando. Pousa em qualquer laje, mas leva só duas pessoas e quase nenhuma carga.",
    mass: 622, r: 350, seats: "2", cap: "112 L (72 L + 40 L)", eff: "≈ 30 L/h", auto: "390 km", vmax: 190, skill: "Pilotagem aérea 4", hood: false
  }, function (c) {
    var EA = ZG.EA, col = "#1f4f8a", blue = c.paint(col), white = c.paint("#e9e7e0"), blk = CM("#1c1d1f", { roughness: 0.6 });
    var ST = [[1.6, 0.84, 0.92, 0.06, 2], [1.5, 0.64, 1.22, 0.66, 2.2], [1.24, 0.53, 1.48, 0.98, 2.4], [0.8, 0.49, 1.68, 1.1, 2.6], [0.25, 0.49, 1.74, 1.12, 2.8],
      [-0.3, 0.52, 1.72, 1.06, 2.8], [-0.55, 0.62, 1.64, 0.86, 2.6], [-0.7, 0.8, 1.56, 0.52, 2.3], [-0.78, 0.98, 1.5, 0.22, 2]];
    var wsT = { sdf: function (x, y) { return Math.min(x - 0.62 - 0.22 * (y - 0.8), y - 0.75); } };
    var dP = [[0.6, 1.0], [-0.22, 1.02], [-0.22, 1.66], [0.6, 1.7]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 32 }), blue);
    ZG.cutMesh(fus, [{ sdf: function (x, y) { return -wsT.sdf(x, y); } }, EA.sideCutP(dP, 0.32)], 40);
    c.deform.push(fus);
    /* barriga branca com filete preto, fora da bolha */
    var bl = function () { return 0.86; };
    GH.fSkin(c, EA, ST, EA.bandT(function (x, y) { return Math.min(bl(x) - y, -wsT.sdf(x, y)); }), white, { sub: 0.05, pre: EA.keepT([-0.9, 1.7, 0.4, 0.95]) });
    GH.fSkin(c, EA, ST, EA.bandT(function (x, y) { return Math.min(0.016 - Math.abs(y - bl(x) - 0.04), -wsT.sdf(x, y) - 0.02); }), blk, { k: 1.005, sub: 0.04, pre: EA.keepT([-0.9, 1.7, 0.85, 0.95]) });
    EA.fuseGlass(c, ST, { sdf: wsT.sdf }, "Bolha do para-brisa", "laminado", { pos: new V3(1.2, 1.3, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(dP, 0.32, s), "Janela da porta " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(0.2, 1.35, s * 0.55) });
      var df = EA.polySdf([[0.64, 0.6], [-0.26, 0.58], [-0.26, 1.7], [0.64, 1.74]]);
      GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.006 - Math.abs(df(x, y)), s * z - 0.32); }), MT.dark, { k: 1.003, sub: 0.04, pre: EA.keepT([-0.4, 0.8, 0.5, 1.8, 0.3]) });
      c.rb(0.08, 0.02, 0.03, 0.01, MT.chrome, -0.12, 1.0, s * 0.55);
      c.text("PR-ZRR", 0.6, 0.13, -2.4, 1.39, s * 0.095, s > 0 ? "+z" : "-z", { fg: "#f2efe6" });
    });
    c.tube([[0.7, 1.72, 0], [1.05, 1.6, 0], [1.33, 1.38, 0], [1.52, 1.12, 0], [1.58, 0.88, 0]], 0.016, blk, { seg: 30 });
    /* interior: 2 bancos, manche em T central, coletivo à esquerda, pedais, console baixo entre os bancos */
    var fl = 0.6, fab = CM("#2f3136", { roughness: 0.9 });
    GH.liner(c, ST, -0.3, 1.0, fl, MT.carpet, { h: 0.03, maxW: 0.98 });
    [0.26, -0.26].forEach(function (z) { ZG.seat(c, 0.05, fl, z, { w: 0.44, h: 0.34, back: 0.6, lean: 0.12, mat: fab }); EA.pedals(c, 1.15, fl, z); });
    c.rb(0.35, 0.5, 0.24, 0.05, CM("#232427"), 0.95, fl + 0.28, 0, { rot: [0, 0, 0.35] });
    [-0.06, 0.06].forEach(function (z) { c.cyl(0.035, 0.035, 0.01, MT.gauge, 1.04, fl + 0.55, z, "x", { seg: 14 }).rotation.set(0, 0, -PI / 2 + 0.6); });
    c.rod(new V3(0.6, fl, 0), new V3(0.5, fl + 0.55, 0), 0.02, blk); c.rod(new V3(0.5, fl + 0.55, -0.26), new V3(0.5, fl + 0.55, 0.26), 0.014, blk);
    [0.26, -0.26].forEach(function (z) { c.rb(0.05, 0.05, 0.05, 0.02, blk, 0.48, fl + 0.57, z); });
    EA.collective(c, 0.2, fl, -0.48);
    GH.liner(c, ST, -0.4, 0.7, 1.68, MT.headliner, { maxW: 1.0 });
    /* carenagem do mastro, mastro fino, pratos e cubo basculante */
    var cow = c.rb(1.15, 0.5, 0.56, 0.17, blue, -0.42, 1.9, 0, { taper: { sx: 0.32, sz: 0.4, shift: 0.42 }, def: true });
    c.cyl(0.055, 0.065, 0.6, MT.steel, 0, 2.3, 0);
    c.cyl(0.15, 0.13, 0.05, MT.steel, 0, 2.08, 0); c.cyl(0.12, 0.11, 0.04, MT.chrome, 0, 2.15, 0);
    [0, 1].forEach(function (i) { var a = i * PI; c.rod(new V3(Math.cos(a) * 0.12, 2.15, Math.sin(a) * 0.12), new V3(Math.cos(a + 0.3) * 0.14, 2.52, Math.sin(a + 0.3) * 0.14), 0.01, MT.steel); });
    var mr = EA.mainRotor(c, 0, 2.62, 0, { blades: 2, R: 3.835, chord: 0.18, droop: 0.08, hub: 0.2, v: 3.6, tipCol: "#e6e4dd", phase: 0.3 });
    c.rb(0.22, 0.1, 0.1, 0.035, MT.steel, 0, 2.66, 0);
    /* motor exposto: bloco, cilindros opostos, ventoinha em caracol, escapamento e silencioso, treliça */
    var eng = CM("#5a5d60", { roughness: 0.5, metalness: 0.45 }), engObjs = [];
    engObjs.push(c.rb(0.42, 0.28, 0.36, 0.06, eng, -1.05, 1.1, 0));
    [1, -1].forEach(function (s) { [-0.95, -1.15].forEach(function (x) { engObjs.push(c.cyl(0.07, 0.07, 0.18, eng, x, 1.08, s * 0.27, "z", { seg: 12 })); for (var k = 0; k < 3; k++) engObjs.push(c.cyl(0.085, 0.085, 0.01, eng, x, 1.08, s * (0.22 + k * 0.05), "z", { seg: 12 })); }); });
    engObjs.push(c.cyl(0.24, 0.24, 0.14, CM("#2d2f31", { roughness: 0.6 }), -0.82, 1.18, 0, "x", { seg: 22 }));
    engObjs.push(c.tube([[-1.2, 0.98, 0.18], [-1.3, 0.85, 0.2], [-1.55, 0.86, 0.15]], 0.025, MT.steel, { seg: 12 }), c.cyl(0.06, 0.06, 0.3, MT.steel, -1.65, 0.86, 0.15, "x"));
    [[-0.78, 0.7, 0.3], [-0.78, 0.7, -0.3], [-0.78, 1.6, 0.2], [-0.78, 1.6, -0.2]].forEach(function (q) { engObjs.push(c.rod(new V3(q[0], q[1], q[2]), new V3(-1.35, 1.32, q[2] * 0.3), 0.014, MT.steel)); });
    /* cone de cauda fino, derivas superior e inferior, estabilizador, rotor de cauda à esquerda */
    var bm = boom(c, EA, [[-1.15, 1.32, 0.11, 0.11], [-2.5, 1.37, 0.085, 0.085], [-4.25, 1.44, 0.05, 0.05], [-4.42, 1.45, 0.035, 0.035]], blue);
    var tm = c.paint(col);
    [1, -1].forEach(function (s) { var hs = c.add(EA.foilGeo([{ p: [-3.9, 1.44, 0], c: 0.3, t: 0.1 }, { p: [-3.95, 1.44, s * 0.42], c: 0.22, t: 0.09 }], { up: "y", n: 8 }), tm); c.deform.push(hs); });
    var fu = c.add(EA.foilGeo([{ p: [-4.12, 1.47, 0], c: 0.4, t: 0.11 }, { p: [-4.42, 1.98, 0], c: 0.24, t: 0.09 }], { up: "z", n: 8 }), tm); c.deform.push(fu);
    var fd = c.add(EA.foilGeo([{ p: [-4.18, 1.42, 0], c: 0.32, t: 0.11 }, { p: [-4.35, 0.98, 0], c: 0.22, t: 0.09 }], { up: "z", n: 8 }), tm); c.deform.push(fd);
    c.tube([[-4.2, 1.0, 0], [-4.3, 0.92, 0], [-4.48, 0.95, 0]], 0.014, MT.steel, { seg: 10 });
    c.cyl(0.05, 0.05, 0.12, MT.steel, -4.38, 1.5, -0.06, "z");
    var tr = EA.tailRotor(c, -4.38, 1.5, -0.14, { blades: 2, R: 0.535, chord: 0.09, mat: CM("#e6e4dd", { roughness: 0.5 }), tipCol: "#a9241e" });
    /* esquis curtos */
    var sk = skids(c, { x0: -0.95, x1: 1.05, z: 0.965, cross: [[0.55, 0.5, 0.46, 0.05], [-0.62, 0.54, 0.48, -0.03]], shoes: [-0.5, 0.5] });
    /* luzes: dois faróis de pouso no nariz, navegação no estabilizador, anticolisão no cone e branca na cauda */
    EA.lamp(c, 1.52, 0.72, 0.1, 0.045, "Farol de pouso direito"); EA.lamp(c, 1.52, 0.72, -0.1, 0.045, "Farol de pouso esquerdo");
    EA.navLight(c, -3.96, 1.44, 0.44, "verde", "Luz de navegação direita (verde)", { r: 0.028 });
    EA.navLight(c, -3.96, 1.44, -0.44, "vermelha", "Luz de navegação esquerda (vermelha)", { r: 0.028 });
    EA.navLight(c, -4.46, 1.96, 0, "branca", "Luz de cauda", { r: 0.025 });
    EA.navLight(c, -1.3, 1.45, 0, "vermelha", "Farol anticolisão", { r: 0.035 });
    c.part("rotor", "Rotor principal", mr, new V3(0, 2.62, 0), 1.3); c.part("rotorcauda", "Rotor de cauda", tr, new V3(-4.38, 1.5, -0.14), 0.7);
    c.part("motor", "Motor Lycoming O-360 (exposto)", null, new V3(-1.05, 1.1, 0), 0.7); c.part("tanque", "Tanques (principal e auxiliar)", null, new V3(-0.55, 1.7, 0), 0.7); c.part("trem", "Esquis", null, new V3(0, 0.1, 0.965), 0.9);
    Object.assign(c.meta, { kind: "heli", L: 8.76, W: 2.0, fusW: 1.12, front: 1.62, rear: -4.95, clear: 0.48, belt: 1.0, bodyH: 1.25, top: 2.67, fusTop: 1.74, roof: null });
    c.zone("nariz", "Bolha do para-brisa e nariz", [0.62, 1.8, 0.4, 1.85, -0.65, 0.65]);
    c.zone("cabine", "Cabine e portas", [-0.8, 0.62, 0.4, 1.85, -0.7, 0.7], null, { dir: "esquerda", fxKey: "cabine", who: "o piloto e o aluno", anyMesh: true });
    c.zone("motor", "Motor exposto e transmissão", [-1.75, -0.6, 0.6, 2.15, -0.45, 0.45], engObjs.concat([cow]), { type: "peca", fxKey: "motor", sub: "motor", dir: "esquerda", pos: new V3(-1.05, 1.1, 0), anchor: [-0.75, 1.3, 0] });
    c.zone("cone", "Cone de cauda", [-3.85, -1.1, 1.15, 1.6, -0.25, 0.25], [bm], { dir: "cima", fxKey: "cone", cutAll: true, anyMesh: true });
    c.zone("empenagem", "Derivas e estabilizador", [-4.55, -3.85, 0.85, 2.05, -0.5, 0.5], null, { type: "peca", fxKey: "cauda", dir: "frente", anyMesh: true });
    c.zone("esquis", null, null, sk);
    c.zone("farol_c", "Faróis de pouso"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)"); c.zone("lanterna_c", "Luzes de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado de vigia: flutuadores de emergência nos esquis, holofote sob o nariz, galão no esqui e grade na bolha */
      var f2 = CM("#d8d4c8", { roughness: 0.7 });
      [1, -1].forEach(function (s) { c2.cyl(0.11, 0.11, 1.7, f2, 0.05, 0.17, s * 0.965, "x", { seg: 16 }); c2.sph(0.11, f2, 0.9, 0.17, s * 0.965, 1.6, 1, 1); c2.sph(0.11, f2, -0.8, 0.17, s * 0.965, 1.2, 1, 1); });
      c2.cyl(0.09, 0.07, 0.14, MT.steel, 1.35, 0.52, 0, "x"); EA.lamp(c2, 1.44, 0.52, 0.0001, 0.07, "Holofote de busca");
      ZG.jerry(c2, -0.2, 0.42, 0.97, "#8e2a20");
      for (var k = -0.36; k <= 0.37; k += 0.12) c2.rod(new V3(0.72, 1.68, k), new V3(1.56, 0.86, k * 0.3), 0.006, ZG.STEELM);
      c2.part("carga", "Galão no esqui", null, new V3(-0.2, 0.45, 0.97), 0.5);
    };
  });

  /* ================= Bel 206 Jato ================= */
  /* Referência · Bell 206B-3 JetRanger III — WebFetch (Golden Age Air Museum: comprimento 39 ft 8 in, altura 9 ft 4 in, rotor 33 ft 4 in), resto de memória
     Medidas reais: comprimento total com rotores 12,09 m · fuselagem ≈ 9,5 m (de memória) · rotor principal 10,16 m (2 pás) · rotor de cauda 1,65 m ·
     altura 2,84 m · largura da cabine ≈ 1,28 m · bitola dos esquis ≈ 1,92 m (de memória) · turbina Allison 250-C20J · tanque 344 L.
     Traços de assinatura:
       frente: para-brisa de duas peças com coluna central e janelas de queixo embaixo, nariz curto e arredondado, esquis altos com degrau
       lateral: cabine de cinco lugares com porta dianteira grande e porta traseira com janela recortada, capota do motor em "casinha" sobre
                o teto com grelhas laterais e escapamento curvo virado para cima e para trás, cone de cauda comprido e afinando
       traseira: estabilizador horizontal no meio do cone com plaquinhas verticais nas pontas, deriva superior e inferior com patim de cauda,
                 rotor de cauda bipá à esquerda
       teto: rotor bipá de pá larga com cubo basculante, capota estreita e comprida, cone de cauda fino */
  ZG.register({ k: "jetranger", grp: "Aéreos", n: "Bel 206 Jato", insp: "Bell 206B-3 JetRanger III", c: "Helicóptero leve a turbina, 5 lugares", fuel: "qav",
    d: "Turbina pequena, cinco lugares e fama de indestrutível. Táxi aéreo, reportagem e polícia: tem um em cada heliponto de cidade grande.",
    mass: 1451, r: 450, seats: "1 piloto + 4", cap: "344 L", eff: "≈ 100 L/h", auto: "690 km", vmax: 225, skill: "Pilotagem aérea 4", hood: false
  }, function (c) {
    var EA = ZG.EA, wcol = "#eeece6", white = c.paint(wcol), mar = c.paint("#7a1e22"), gold = c.paint("#c49a3a"), blk = CM("#1c1d1f", { roughness: 0.6 });
    var ST = [[2.62, 0.95, 1.06, 0.08, 2], [2.48, 0.7, 1.45, 0.86, 2.2], [2.14, 0.6, 1.82, 1.18, 2.4], [1.55, 0.58, 2.02, 1.27, 2.6], [0.5, 0.58, 2.06, 1.28, 2.8],
      [-0.6, 0.6, 2.05, 1.24, 2.8], [-1.25, 0.74, 2.0, 1.02, 2.6], [-1.65, 1.02, 1.96, 0.64, 2.3], [-1.85, 1.3, 1.9, 0.3, 2]];
    var wsF = function (x, y, z) { return Math.min(x - 1.3 - 0.4 * (y - 1.2), y - 1.12, 0.46 - Math.abs(z || 0) + (x - 1.62) * 1.6); };
    var chin = function (x, y) { return Math.min(x - 1.95, 1.05 - y, y - 0.72); };
    var fdP = [[1.5, 1.02], [0.72, 1.02], [0.72, 1.92], [1.25, 1.96], [1.56, 1.6]], rdP = [[0.58, 1.12], [-0.38, 1.18], [-0.38, 1.86], [0.05, 1.93], [0.58, 1.9]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 32 }), white);
    ZG.cutMesh(fus, [{ sdf: function (x, y, z) { return -wsF(x, y, z); } }, { sel: function (n) { return n.x > 0.2; }, sdf: function (x, y, z) { return -Math.min(chin(x, y), Math.abs(z) - 0.05); } }, EA.sideCutP(fdP, 0.45), EA.sideCutP(rdP, 0.45)], 40);
    c.deform.push(fus);
    /* faixas: vinho larga com filete dourado, da cabine ao cone */
    var yc = function (x) { return x > -1.0 ? 1.0 : 1.0 + (-1.0 - x) * 0.1; };
    GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.08 - Math.abs(y - yc(x)), -wsF(x, y, z) - 0.02, -chin(x, y) - 0.02); }), mar, { sub: 0.06, pre: EA.keepT([-1.9, 2.6, 0.85, 1.15]) });
    GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.016 - Math.abs(y - yc(x) - 0.12), -wsF(x, y, z) - 0.02); }), gold, { k: 1.005, sub: 0.04, pre: EA.keepT([-1.9, 2.6, 1.05, 1.2]) });
    EA.fuseGlass(c, ST, { sdf: wsF }, "Para-brisa", "laminado", { pos: new V3(2.1, 1.6, 0) });
    EA.fuseGlass(c, ST, { sdf: function (x, y, z) { return Math.min(chin(x, y), Math.abs(z) - 0.05); } }, "Janelas de queixo", "temperado", { pos: new V3(2.3, 0.88, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(fdP, 0.45, s), "Janela da porta dianteira " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(1.1, 1.55, s * 0.62) });
      EA.fuseGlass(c, ST, EA.sideKeepP(rdP, 0.45, s), "Janela da porta traseira " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(0.1, 1.55, s * 0.62) });
      var df = EA.polySdf([[1.72, 0.66], [0.66, 0.64], [0.66, 1.95], [1.32, 2.0], [1.76, 1.55]]), dr = EA.polySdf([[0.6, 0.64], [-0.4, 0.66], [-0.4, 1.95], [0.6, 1.95]]);
      GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.006 - Math.min(Math.abs(df(x, y)), Math.abs(dr(x, y))), s * z - 0.45); }), MT.dark, { k: 1.003, sub: 0.04, pre: EA.keepT([-0.5, 1.85, 0.55, 2.05, 0.4]) });
      c.rb(0.1, 0.02, 0.03, 0.01, MT.chrome, 0.78, 1.15, s * 0.64); c.rb(0.1, 0.02, 0.03, 0.01, MT.chrome, -0.28, 1.15, s * 0.63);
      c.text("PT-HJR", 0.85, 0.18, -3.4, 1.62, s * 0.165, s > 0 ? "+z" : "-z", { fg: "#7a1e22" });
    });
    c.rod(new V3(1.78, 2.03, 0), new V3(2.42, 1.14, 0), 0.02, blk);
    /* interior: 2 bancos na frente, banco de 3 atrás, painel em cobertura, cíclico, coletivo e pedais */
    var fl = 0.68, fab = CM("#4b4339", { roughness: 0.9 });
    GH.liner(c, ST, -0.6, 1.8, fl, MT.carpet, { h: 0.03, maxW: 1.15 });
    [0.3, -0.3].forEach(function (z) { ZG.seat(c, 1.05, fl, z, { w: 0.48, h: 0.36, back: 0.64, lean: 0.12, mat: fab }); EA.cyclic(c, 1.4, fl, z); EA.pedals(c, 2.1, fl, z); });
    EA.collective(c, 1.1, fl, -0.55);
    ZG.seat(c, -0.3, fl + 0.04, 0, { w: 1.14, n: 3, h: 0.38, back: 0.62, lean: 0.1, mat: fab });
    EA.instPanel(c, 1.92, 1.42, 0.95, { gauges: 8, z0: -0.33, tilt: 0.35 });
    GH.liner(c, ST, -0.5, 1.4, 1.98, MT.headliner, { maxW: 1.15 });
    /* capota em "casinha": transmissão e turbina, grelhas laterais, escapamento curvo para cima */
    var cw = c.add(EA.fuseGeo([[0.75, 1.98, 2.1, 0.36, 2.2], [0.45, 1.98, 2.36, 0.68, 2.6], [-0.6, 1.98, 2.46, 0.74, 3], [-1.75, 1.95, 2.42, 0.7, 3], [-2.35, 1.82, 2.18, 0.46, 2.4], [-2.55, 1.75, 2.0, 0.2, 2]], { smooth: 24 }), white); c.deform.push(cw);
    [1, -1].forEach(function (s) { for (var k = 0; k < 6; k++) c.rb(0.035, 0.22, 0.02, 0.008, MT.dark, -0.55 - k * 0.075, 2.22, s * 0.372); c.rb(0.5, 0.28, 0.012, 0.01, CM("#2a2b2d"), -1.3, 2.2, s * 0.352); });
    var ex = c.tube([[-1.75, 2.42, 0], [-1.95, 2.55, 0], [-2.12, 2.6, 0]], 0.1, CM("#4d4f51", { metalness: 0.5, roughness: 0.4 }), { seg: 12, rs: 14 });
    c.cyl(0.09, 0.09, 0.02, MT.dark, -2.14, 2.6, 0, "x");
    c.cyl(0.07, 0.08, 0.42, MT.steel, 0, 2.6, 0);
    c.cyl(0.18, 0.15, 0.06, MT.steel, 0, 2.48, 0); c.cyl(0.14, 0.12, 0.05, MT.chrome, 0, 2.55, 0);
    [0, 1].forEach(function (i) { var a = i * PI + 0.3; c.rod(new V3(Math.cos(a) * 0.14, 2.55, Math.sin(a) * 0.14), new V3(Math.cos(a) * 0.2, 2.74, Math.sin(a) * 0.2), 0.012, MT.steel); });
    var mr = EA.mainRotor(c, 0, 2.78, 0, { blades: 2, R: 5.08, chord: 0.33, droop: 0.1, hub: 0.32, v: 3.2, mat: CM("#2a2c30", { roughness: 0.5 }), tipCol: "#e6e4dd", phase: 0.25 });
    c.rb(0.5, 0.12, 0.16, 0.05, MT.steel, 0, 2.8, 0);
    /* cone de cauda comprido, estabilizador com plaquinhas, derivas, patim e rotor de cauda à esquerda */
    var bm = boom(c, EA, [[-1.75, 1.62, 0.3, 0.3], [-2.4, 1.64, 0.2, 0.2], [-4.5, 1.7, 0.13, 0.13], [-6.2, 1.76, 0.085, 0.085], [-6.45, 1.77, 0.07, 0.07]], white);
    GH.fSkin(c, EA, [[-1.75, 1.32, 1.92, 0.6, 2], [-2.4, 1.44, 1.84, 0.4, 2], [-4.5, 1.57, 1.83, 0.26, 2], [-6.2, 1.675, 1.845, 0.17, 2], [-6.45, 1.7, 1.84, 0.14, 2]], EA.bandT(function (x, y) { return Math.min(0.05 - Math.abs(y - 1.7 - (x + 2) * -0.01), x + 6.2); }), mar, { k: 1.01, sub: 0.05, smooth: 24, seg: 22 });
    var tm = c.paint(wcol);
    [1, -1].forEach(function (s) {
      var hs = c.add(EA.foilGeo([{ p: [-4.05, 1.68, 0], c: 0.42, t: 0.12, cam: -0.04 }, { p: [-4.1, 1.68, s * 0.99], c: 0.38, t: 0.11, cam: -0.04 }], { up: "y", n: 8 }), tm); c.deform.push(hs);
      var ep = c.add(EA.foilGeo([{ p: [-4.08, 1.58, s * 1.0], c: 0.36, t: 0.07 }, { p: [-4.18, 1.86, s * 1.0], c: 0.26, t: 0.07 }], { up: "z", n: 6 }), mar); c.deform.push(ep);
    });
    var fu = c.add(EA.foilGeo([{ p: [-6.0, 1.82, 0], c: 0.72, t: 0.12 }, { p: [-6.55, 2.62, 0], c: 0.42, t: 0.1 }], { up: "z", n: 8 }), mar); c.deform.push(fu);
    var fd = c.add(EA.foilGeo([{ p: [-6.1, 1.72, 0], c: 0.55, t: 0.12 }, { p: [-6.35, 1.2, 0], c: 0.35, t: 0.1 }], { up: "z", n: 8 }), mar); c.deform.push(fd);
    c.tube([[-6.35, 1.22, 0], [-6.55, 1.12, 0], [-6.78, 1.18, 0]], 0.018, MT.steel, { seg: 10 });
    c.cyl(0.07, 0.07, 0.16, MT.steel, -6.25, 1.82, -0.1, "z");
    var tr = EA.tailRotor(c, -6.25, 1.82, -0.2, { blades: 2, R: 0.825, chord: 0.13, mat: CM("#e6e4dd", { roughness: 0.5 }), tipCol: "#7a1e22" });
    /* esquis altos com degrau */
    var sk = skids(c, { x0: -1.15, x1: 1.65, z: 0.96, cross: [[1.05, 0.6, 0.6, 0.05], [-0.65, 0.62, 0.6, -0.03]], shoes: [-0.7, 1.0], step: [0.4, 0.35] });
    /* luzes */
    EA.lamp(c, 2.5, 0.68, 0.12, 0.05, "Farol de pouso direito", { yaw: 0.05 }); EA.lamp(c, 2.5, 0.68, -0.12, 0.05, "Farol de pouso esquerdo", { yaw: 0.05 });
    EA.navLight(c, -4.1, 1.68, 1.03, "verde", "Luz de navegação direita (verde)", { r: 0.03 });
    EA.navLight(c, -4.1, 1.68, -1.03, "vermelha", "Luz de navegação esquerda (vermelha)", { r: 0.03 });
    EA.navLight(c, -6.62, 2.6, 0, "branca", "Luz de cauda", { r: 0.025 });
    EA.navLight(c, -1.9, 2.25, 0, "vermelha", "Farol anticolisão", { r: 0.04 });
    c.part("rotor", "Rotor principal", mr, new V3(0, 2.78, 0), 1.6); c.part("rotorcauda", "Rotor de cauda", tr, new V3(-6.25, 1.82, -0.2), 0.9);
    c.part("motor", "Turbina Allison 250", ex, new V3(-1.4, 2.25, 0), 0.9); c.part("tanque", "Tanque de QAV (sob o banco traseiro)", null, new V3(-0.6, 0.9, 0), 0.8); c.part("trem", "Esquis", null, new V3(0, 0.1, 0.96), 1.0);
    Object.assign(c.meta, { kind: "heli", L: 12.09, W: 2.2, fusW: 1.28, front: 2.64, rear: -7.08, clear: 0.58, belt: 1.15, bodyH: 1.48, top: 2.84, fusTop: 2.06, roof: null });
    c.zone("nariz", "Para-brisa, janelas de queixo e nariz", [1.65, 2.8, 0.5, 2.15, -0.75, 0.75]);
    c.zone("cabine", "Cabine e portas", [-1.1, 1.65, 0.5, 2.15, -0.8, 0.8], null, { dir: "esquerda", fxKey: "cabine", who: "os ocupantes", anyMesh: true });
    c.zone("motor", "Turbina, capota e transmissão", [-2.6, 1.0, 1.95, 2.7, -0.5, 0.5], null, { type: "interno", fxKey: "motor", sub: "motor", pos: new V3(-1.4, 2.25, 0) });
    c.zone("cone", "Cone de cauda", [-5.9, -1.75, 1.3, 2.0, -1.15, 1.15], [bm], { dir: "cima", fxKey: "cone", cutAll: true, anyMesh: true });
    c.zone("empenagem", "Derivas e patim", [-6.9, -5.9, 1.0, 2.75, -0.4, 0.4], null, { type: "peca", fxKey: "cauda", dir: "frente", anyMesh: true });
    c.zone("esquis", null, null, sk);
    c.zone("farol_c", "Faróis de pouso"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)"); c.zone("lanterna_c", "Luzes de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado de reportagem que virou patrulha: câmera giroestabilizada no nariz, holofote, alto-falante,
         flutuadores de emergência e corta-fio acima e abaixo da cabine */
      var stl = ZG.STEELM, f2 = CM("#d8d4c8", { roughness: 0.7 });
      c2.sph(0.17, CM("#2b2c2e", { roughness: 0.4 }), 2.3, 0.5, -0.22); c2.cyl(0.07, 0.07, 0.02, MT.glassDark, 2.46, 0.5, -0.22, "x");
      c2.cyl(0.12, 0.1, 0.2, MT.steel, 1.9, 0.45, 0.4, "x"); EA.lamp(c2, 2.02, 0.45, 0.4, 0.1, "Holofote de busca");
      c2.cyl(0.08, 0.14, 0.2, CM("#3a3c3e"), 1.4, 0.45, -0.55, "x");
      [1, -1].forEach(function (s) { c2.cyl(0.12, 0.12, 2.1, f2, 0.25, 0.18, s * 0.96, "x", { seg: 16 }); c2.sph(0.12, f2, 1.3, 0.18, s * 0.96, 1.6, 1, 1); });
      c2.rb(0.5, 0.25, 0.03, 0.01, stl, 2.15, 2.0, 0, { rot: [0, 0, -0.6] }); c2.rb(0.45, 0.2, 0.03, 0.01, stl, 2.45, 0.55, 0, { rot: [0, 0, 0.6] });
      c2.part("camera", "Câmera giroestabilizada", null, new V3(2.3, 0.5, -0.22), 0.4);
    };
  });

  /* ================= H-145 Águia ================= */
  /* Referência · Airbus H145 (D3, versão policial) — WebFetch (airbus.com "H145 technical information": comprimento 13,54 m com rotores, rotor 10,8 m),
     resto de memória
     Medidas reais: comprimento total com rotores 13,54 m · rotor principal 10,8 m (5 pás, sem articulação) · altura ≈ 3,95 m (de memória) ·
     fuselagem ≈ 11,6 m e largura da cabine ≈ 1,73 m (de memória) · fenestron de ≈ 1,0 m · bitola dos esquis ≈ 2,4 m (de memória) ·
     dois Arriel 2E · tanque de 723 kg (≈ 905 L).
     Traços de assinatura:
       frente: para-brisa enorme e alto com janelas de queixo, nariz curto e rombudo, bola do imageador térmico sob o nariz, esquis altos
       lateral: cabine comprida e alta com porta corrediça grande, portas de concha atrás da cabine (a cauda sai do alto da fuselagem),
                capota dos dois motores longa sobre o teto com dois escapamentos, holofote e guincho no lado direito
       traseira: fenestron (rotor de cauda carenado na deriva), estabilizador com plaquinhas inclinadas nas pontas, portas traseiras em concha
       teto: rotor de cinco pás, capota larga dos motores, cone de cauda fino e alto */
  ZG.register({ k: "h145", grp: "Aéreos", n: "H-145 Águia", insp: "Airbus H145 policial", c: "Helicóptero bimotor policial, 2 + 6 lugares", fuel: "qav",
    d: "O helicóptero da polícia. Dois motores, câmera térmica, holofote e guincho: acha gente presa no telhado de noite e ainda desce corda.",
    mass: 3800, r: 600, seats: "2 pilotos + 6 tripulantes", cap: "≈ 905 L", eff: "≈ 270 L/h", auto: "650 km", vmax: 268, skill: "Pilotagem aérea 5 (bimotor)", hood: false
  }, function (c) {
    var EA = ZG.EA, navyC = "#1b2c52", navy = c.paint(navyC), white = c.paint("#ecebe6"), yel = c.paint("#d7b23a"), blk = CM("#1c1d1f", { roughness: 0.6 });
    var ST = [[3.36, 1.0, 1.12, 0.08, 2], [3.22, 0.76, 1.56, 0.96, 2.4], [2.85, 0.63, 2.0, 1.46, 2.8], [2.2, 0.58, 2.3, 1.68, 3.2], [1.2, 0.58, 2.38, 1.73, 3.4],
      [-1.6, 0.58, 2.38, 1.73, 3.4], [-2.55, 0.62, 2.35, 1.7, 3.4], [-2.95, 0.72, 2.32, 1.56, 3.2], [-3.12, 0.95, 2.3, 1.1, 2.6], [-3.2, 1.3, 2.28, 0.4, 2]];
    var wsF = function (x, y, z) { return Math.min(x - 1.85 - 0.42 * (y - 1.2), y - 1.22, 0.62 - Math.abs(z || 0) + (x - 2.2) * 1.4); };
    var chin = function (x, y) { return Math.min(x - 2.75, 1.15 - y, y - 0.78); };
    var fdP = [[1.95, 1.3], [1.15, 1.3], [1.15, 2.2], [1.7, 2.24], [2.0, 1.75]], sdP = [[0.95, 1.35], [-0.95, 1.35], [-0.95, 2.12], [0.95, 2.12]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 36 }), white);
    ZG.cutMesh(fus, [{ sdf: function (x, y, z) { return -wsF(x, y, z); } }, { sel: function (n) { return n.x > 0.2; }, sdf: function (x, y, z) { return -Math.min(chin(x, y), Math.abs(z) - 0.06); } }, EA.sideCutP(fdP, 0.6), EA.sideCutP(sdP, 0.6)], 40);
    c.deform.push(fus);
    /* metade de baixo azul com faixa quadriculada amarela e azul (genérica) */
    GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(1.22 - y, -wsF(x, y, z) - 0.02, -chin(x, y) - 0.02); }), navy, { sub: 0.08, pre: EA.keepT([-3.3, 3.4, 0.5, 1.3]) });
    GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { var ch = (Math.floor((x + 9) / 0.14) + Math.floor((y + 9) / 0.07)) % 2; return Math.min(0.07 - Math.abs(y - 1.3), ch ? 1 : -1, -wsF(x, y, z) - 0.02, x + 3.0, 2.1 - x); }), yel, { k: 1.005, sub: 0.035, pre: EA.keepT([-3.1, 2.2, 1.2, 1.4, 0.5]) });
    EA.fuseGlass(c, ST, { sdf: wsF }, "Para-brisa", "laminado", { pos: new V3(2.8, 1.9, 0) });
    EA.fuseGlass(c, ST, { sdf: function (x, y, z) { return Math.min(chin(x, y), Math.abs(z) - 0.06); } }, "Janelas de queixo", "temperado", { pos: new V3(3.05, 0.95, 0) });
    [1, -1].forEach(function (s) {
      EA.fuseGlass(c, ST, EA.sideKeepP(fdP, 0.6, s), "Janela da porta do " + (s > 0 ? "copiloto" : "piloto"), "temperado", { pos: new V3(1.7, 1.8, s * 0.86) });
      GH.fGlass(c, EA, ST, EA.sideKeepP(sdP, 0.6, s), "Janela da porta corrediça " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(0.0, 1.8, s * 0.86), sub: 0.12, pre: EA.keepT([-1.1, 1.1, 1.2, 2.3, 0.5]) });
      var df = EA.polySdf([[2.05, 0.68], [1.1, 0.66], [1.1, 2.26], [1.75, 2.3], [2.06, 1.78]]), dr = EA.polySdf([[1.0, 0.66], [-1.05, 0.66], [-1.05, 2.25], [1.0, 2.25]]);
      GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.007 - Math.min(Math.abs(df(x, y)), Math.abs(dr(x, y))), s * z - 0.6); }), MT.dark, { k: 1.003, sub: 0.05, pre: EA.keepT([-1.2, 2.4, 0.55, 2.35, 0.55]) });
      c.rb(1.9, 0.04, 0.04, 0.015, MT.steel, -0.1, 2.3, s * 0.87);
      c.text("POLÍCIA", 1.5, 0.3, -1.95, 1.75, s * 0.866, s > 0 ? "+z" : "-z", { fg: "#1b2c52" });
      c.text("ÁGUIA 7", 0.9, 0.2, -4.2, 2.2, s * 0.14, s > 0 ? "+z" : "-z", { fg: "#f2efe6" });
    });
    /* portas traseiras em concha (fresta vertical) e coluna do para-brisa */
    GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.007 - Math.abs(z), x + 3.25, -2.8 - x, 2.2 - y); }), MT.dark, { k: 1.003, sub: 0.04, pre: EA.keepT([-3.3, -2.7, 0.6, 2.3]) });
    c.tube([[2.55, 2.32, 0], [2.95, 1.98, 0], [3.2, 1.55, 0], [3.3, 1.2, 0]], 0.022, blk, { seg: 20 });
    /* interior: 2 bancos de piloto, painel com 4 telas, bancos de tripulação virados para os lados, operador do imageador */
    var fl = 0.7, fab = CM("#2c3540", { roughness: 0.9 });
    GH.liner(c, ST, -2.9, 2.5, fl, MT.carpet, { h: 0.03, maxW: 1.5 });
    [0.42, -0.42].forEach(function (z) { ZG.seat(c, 1.55, fl, z, { w: 0.5, h: 0.4, back: 0.7, lean: 0.12, mat: fab }); EA.cyclic(c, 1.95, fl, z); EA.pedals(c, 2.75, fl, z); });
    EA.collective(c, 1.6, fl, -0.72); EA.collective(c, 1.6, fl, 0.12);
    EA.instPanel(c, 2.5, 1.62, 1.3, { gauges: 2, z0: -0.05, tilt: 0.3, screens: [[0.05, -0.48, 0.18, 0.24], [0.05, -0.18, 0.18, 0.24], [0.05, 0.18, 0.18, 0.24], [0.05, 0.48, 0.18, 0.24]] });
    [[0.3, "-z"], [-0.4, "-z"], [0.3, "+z"], [-0.4, "+z"]].forEach(function (q) { ZG.seat(c, q[0], fl, q[1] === "-z" ? 0.55 : -0.55, { w: 0.48, h: 0.4, back: 0.6, lean: 0.1, face: q[1], mat: fab }); });
    ZG.seat(c, -1.6, fl, 0.3, { w: 0.5, h: 0.4, back: 0.62, lean: 0.1, dir: 1, mat: fab }); ZG.seat(c, -1.6, fl, -0.3, { w: 0.5, h: 0.4, back: 0.62, lean: 0.1, dir: 1, mat: fab });
    c.rb(0.3, 0.25, 0.3, 0.03, MT.plastic, -1.0, fl + 0.6, -0.3); c.rb(0.02, 0.2, 0.28, 0.01, MT.screen, -0.85, fl + 0.75, -0.3).castShadow = false;
    GH.liner(c, ST, -2.5, 2.1, 2.28, MT.headliner, { maxW: 1.5 });
    /* capota dos motores, dois escapamentos, mastro e cabeça de 5 pás */
    var cw = c.add(EA.fuseGeo([[1.6, 2.3, 2.42, 0.6, 2.4], [1.1, 2.3, 2.8, 1.25, 2.8], [-1.0, 2.3, 2.95, 1.4, 3.2], [-2.6, 2.3, 2.9, 1.32, 3], [-3.2, 2.32, 2.7, 0.8, 2.4], [-3.5, 2.34, 2.5, 0.3, 2]], { smooth: 28 }), white); c.deform.push(cw);
    GH.fSkin(c, EA, [[1.6, 2.3, 2.42, 0.6, 2.4], [1.1, 2.3, 2.8, 1.25, 2.8], [-1.0, 2.3, 2.95, 1.4, 3.2], [-2.6, 2.3, 2.9, 1.32, 3], [-3.2, 2.32, 2.7, 0.8, 2.4], [-3.5, 2.34, 2.5, 0.3, 2]], EA.bandT(function (x, y) { return Math.min(0.04 - Math.abs(y - 2.5), x + 3.0, 1.3 - x); }), navy, { k: 1.01, sub: 0.05, smooth: 28 });
    [1, -1].forEach(function (s) {
      for (var k = 0; k < 6; k++) c.rb(0.04, 0.22, 0.02, 0.008, MT.dark, 0.3 - k * 0.09, 2.62, s * 0.7);
      var e = c.cyl(0.13, 0.15, 0.4, MT.steel, -2.75, 2.75, s * 0.42, "x", { seg: 16 }); e.rotation.y = -s * 0.35; e.rotation.x = s * 0.3;
      c.cyl(0.11, 0.11, 0.02, MT.dark, -2.95, 2.8, s * 0.5, "x").rotation.y = -s * 0.35;
    });
    c.cyl(0.11, 0.13, 0.55, MT.steel, 0, 3.2, 0);
    c.cyl(0.32, 0.26, 0.12, MT.steel, 0, 3.55, 0, null, { seg: 5 });
    var mr = EA.mainRotor(c, 0, 3.66, 0, { blades: 5, R: 5.4, chord: 0.3, droop: 0.14, hub: 0.32, hubR: 0.2, cap: true, v: 2.8, mat: CM("#2a2c30", { roughness: 0.5 }), phase: 0.1 });
    c.cyl(0.16, 0.12, 0.2, MT.steel, 0, 3.82, 0);
    /* cone de cauda saindo do alto, estabilizador com plaquinhas inclinadas, fenestron e deriva */
    var bm = boom(c, EA, [[-2.8, 2.0, 0.32, 0.38], [-3.5, 2.06, 0.24, 0.26], [-5.6, 2.12, 0.17, 0.17], [-6.6, 2.15, 0.15, 0.13]], navy);
    var tm = c.paint(navyC);
    [1, -1].forEach(function (s) {
      var hs = c.add(EA.foilGeo([{ p: [-5.75, 2.1, 0], c: 0.62, t: 0.12, cam: -0.03 }, { p: [-5.85, 2.1, s * 1.05], c: 0.52, t: 0.11, cam: -0.03 }], { up: "y", n: 8 }), tm); c.deform.push(hs);
      var ep = c.add(EA.foilGeo([{ p: [-5.82, 1.85, s * 1.02], c: 0.5, t: 0.07 }, { p: [-5.98, 2.38, s * 1.14], c: 0.36, t: 0.07 }], { up: "z", n: 6 }), tm); c.deform.push(ep);
    });
    var finS = [[-6.45, 2.0, 2.3, 0.22, 2], [-6.7, 1.45, 2.85, 0.3, 2.4], [-7.4, 1.3, 2.95, 0.32, 2.6], [-7.95, 1.42, 3.05, 0.26, 2.4], [-8.14, 1.6, 3.1, 0.1, 2]];
    var fin = c.add(EA.fuseGeo(finS, { smooth: 20, seg: 18 }), tm); c.deform.push(fin);
    var fan = fenestron(c, -7.3, 2.12, 0.5, 0.32, 10, CM("#2a2c30", { roughness: 0.6 }), CM("#3a3c40", { roughness: 0.5 }));
    ZG.cutMesh(fin, [{ sdf: function (x, y, z) { return Math.hypot(x + 7.3, y - 2.12) - 0.56; } }], 40, { sub: 0.06 });
    var topFin = c.add(EA.foilGeo([{ p: [-7.35, 2.95, 0], c: 0.75, t: 0.1 }, { p: [-7.75, 3.4, 0], c: 0.4, t: 0.09 }], { up: "z", n: 8 }), tm); c.deform.push(topFin);
    /* esquis altos com degrau */
    var sk = skids(c, { x0: -1.6, x1: 2.0, z: 1.2, cross: [[1.4, 0.62, 0.78, 0.05], [-1.0, 0.62, 0.78, -0.03]], shoes: [-1.1, 1.5], step: [0.6, 0.5] });
    /* equipamento policial: imageador térmico, holofote, guincho, alto-falante, luzes azuis e vermelhas */
    var flir = c.sph(0.2, CM("#2b2c2e", { roughness: 0.4 }), 3.0, 0.48, 0); c.cyl(0.08, 0.08, 0.02, MT.glassDark, 3.18, 0.46, 0.06, "x");
    c.cyl(0.05, 0.05, 0.15, MT.steel, 3.0, 0.66, 0);
    c.cyl(0.14, 0.12, 0.22, MT.steel, 2.35, 0.45, 0.62, "x"); var hl = EA.lamp(c, 2.48, 0.45, 0.62, 0.12, "Holofote de busca"); void hl;
    c.rb(0.14, 0.1, 0.8, 0.04, MT.steel, 0.3, 2.45, 0.9); c.rod(new V3(0.3, 2.45, 1.28), new V3(0.3, 2.25, 1.28), 0.035, MT.steel);
    c.cyl(0.12, 0.12, 0.32, CM("#d8d4c8"), 0.3, 2.1, 1.28); c.rod(new V3(0.3, 1.93, 1.28), new V3(0.3, 1.45, 1.28), 0.006, MT.steel); c.sph(0.04, MT.yellow, 0.3, 1.43, 1.28);
    c.cyl(0.08, 0.14, 0.2, CM("#3a3c3e"), 1.9, 0.45, -0.62, "x");
    EA.navLight(c, -1.0, 2.42, 0.72, "azul", "Giroflex azul", { r: 0.05 }); EA.navLight(c, -1.0, 2.42, -0.72, "vermelha", "Giroflex vermelho", { r: 0.05 });
    EA.lamp(c, 3.18, 0.86, -0.25, 0.06, "Farol de pouso");
    EA.navLight(c, -5.85, 2.1, 1.08, "verde", "Luz de navegação direita (verde)", { r: 0.035 });
    EA.navLight(c, -5.85, 2.1, -1.08, "vermelha", "Luz de navegação esquerda (vermelha)", { r: 0.035 });
    EA.navLight(c, -8.16, 2.5, 0, "branca", "Luz de cauda", { r: 0.03 });
    EA.navLight(c, -3.3, 2.45, 0, "vermelha", "Farol anticolisão", { r: 0.05 });
    c.part("rotor", "Rotor principal (5 pás)", mr, new V3(0, 3.66, 0), 1.8); c.part("rotorcauda", "Fenestron", fan.fan, new V3(-7.3, 2.12, 0), 0.9);
    c.part("motor", "Turbinas Arriel 2E", null, new V3(-1.0, 2.6, 0), 1.0); c.part("tanque", "Tanques sob o piso", null, new V3(-0.5, 0.65, 0), 1.0); c.part("trem", "Esquis", null, new V3(0, 0.1, 1.2), 1.0);
    c.part("guincho", "Guincho de resgate", null, new V3(0.3, 2.2, 1.28), 0.6); c.part("camera", "Imageador térmico", flir, new V3(3.0, 0.48, 0), 0.4);
    Object.assign(c.meta, { kind: "heli", L: 13.54, W: 2.5, fusW: 1.73, front: 3.38, rear: -8.16, clear: 0.58, belt: 1.3, bodyH: 1.8, top: 3.95, fusTop: 2.38, roof: null });
    c.zone("nariz", "Para-brisa, queixo e imageador", [2.2, 3.6, 0.25, 2.45, -1.0, 1.0], [flir]);
    c.zone("cabine", "Cabine e portas corrediças", [-2.6, 2.2, 0.5, 2.45, -1.05, 1.05], null, { dir: "esquerda", fxKey: "cabine", who: "os policiais", anyMesh: true });
    c.zone("portas_t", "Portas traseiras em concha", [-3.4, -2.6, 0.55, 2.35, -1.0, 1.0], null, { type: "tampa", dir: "frente", hinge: "cima", fxKey: "tampa", who: "quem está no fundo da cabine" });
    c.zone("motor", "Turbinas e transmissão", [-3.6, 1.7, 2.25, 3.1, -0.75, 0.75], null, { type: "interno", fxKey: "motor", sub: "motor", pos: new V3(-1.0, 2.6, 0) });
    c.zone("cone", "Cone de cauda", [-6.3, -3.3, 1.75, 2.45, -1.2, 1.2], [bm], { dir: "cima", fxKey: "cone", cutAll: true, anyMesh: true });
    c.zone("rotor_cauda", false);
    c.zone("fenestron", "Fenestron e deriva", [-8.3, -6.3, 1.2, 3.5, -0.4, 0.4], [fan.fan, fan.ring, fan.duct, fin, topFin], { type: "peca", fxKey: "rotorcauda", kindPart: "rotorcauda", dir: "frente", anyMesh: true });
    c.zone("guincho", "Guincho de resgate", [0.0, 0.6, 1.35, 2.55, 0.75, 1.45], null, { type: "peca", fxKey: "carenagem", dir: "esquerda", fx: ["Nenhum", "Cabo desfiado", "Guincho emperra no meio", "Cabo partido, gancho caído", "Guincho arrancado: sem resgate"] });
    c.zone("esquis", null, null, sk);
    c.zone("farol_c", "Farol de pouso"); c.zone("farol_d", "Holofote de busca"); c.zone("lanterna_d", "Luz de navegação direita e giroflex azul"); c.zone("lanterna_e", "Luz de navegação esquerda e giroflex vermelho"); c.zone("lanterna_c", "Luzes de cauda e anticolisão");
    c.meta.armor = function (c2) {
      /* modificado de operação: chapas de aço no piso e nas portas dos pilotos, metralhadora de porta na esquerda, cordas de rapel
         e cesto de resgate pendurado no guincho */
      var stl = ZG.STEELM;
      [1, -1].forEach(function (s) { c2.rb(1.0, 0.5, 0.02, 0.02, stl, 1.65, 1.0, s * 0.88); });
      GH.liner(c2, ST, -2.5, 2.1, 0.74, stl, { h: 0.03, maxW: 1.5 });
      c2.rod(new V3(-0.3, 1.0, -0.88), new V3(-0.3, 1.6, -1.05), 0.03, stl); c2.cyl(0.03, 0.03, 1.0, MT.trim, -0.1, 1.65, -1.08, "x"); c2.rb(0.28, 0.13, 0.1, 0.02, MT.trim, -0.45, 1.62, -1.08);
      [-0.5, 0.5].forEach(function (x) { c2.rod(new V3(x, 2.3, 0.9), new V3(x + 0.05, 0.3, 1.1), 0.012, CM("#2f5f2a", { roughness: 0.9 })); });
      c2.rb(0.7, 0.25, 0.45, 0.04, CM("#c84a1e", { roughness: 0.8 }), 0.3, 1.1, 1.3);
      c2.part("arma", "Metralhadora de porta", null, new V3(-0.1, 1.65, -1.08), 0.6);
    };
  });

  /* ================= Sabre AH-2 ================= */
  /* Referência · Mil Mi-35M (AH-2 Sabre da FAB) — WebFetch (airforce-technology: comprimento 21,6 m com rotores, altura 6,5 m,
     envergadura 6,5 m; rhc.ru: massas, motores, armas), rotores e trem de memória
     Medidas reais: comprimento total com rotores 21,6 m · fuselagem ≈ 17,5 m (de memória) · rotor principal ≈ 17,2 m (5 pás) ·
     rotor de cauda em X ≈ 3,9 m · altura 6,5 m (até o topo do rotor de cauda) · envergadura das asas curtas 6,5 m ·
     trem fixo triciclo: bitola ≈ 3,0 m e entre-eixos ≈ 4,4 m (de memória) · dois VK-2500 de 2.200 hp · canhão duplo de 23 mm no nariz.
     Traços de assinatura:
       frente: duas bolhas de cabine em tandem e em degrau ("olhos de inseto"): artilheiro embaixo na frente e piloto atrás mais alto,
               torre do canhão duplo sob o nariz, bola de sensores, tomadas de ar dos motores com filtros redondos
       lateral: fuselagem comprida e alta com cabine de tropa no meio (portas em concha de cima e de baixo), asas curtas com anédro
                e casulos de foguetes, escapamentos com supressores virados para fora, trem fixo, cone de cauda longo
       traseira: deriva inclinada com rotor de cauda em X do lado esquerdo, estabilizador horizontal no cone
       teto: rotor de cinco pás muito largo, dois motores lado a lado sobre a cabine, asas curtas com lançadores nas pontas */
  ZG.register({ k: "sabre", grp: "Militares", n: "Sabre AH-2", insp: "Mil Mi-35M (AH-2 Sabre da FAB)", c: "Helicóptero de ataque e transporte", fuel: "qav",
    d: "Tanque voador: blindado, armado com canhão duplo e foguetes, e ainda leva oito soldados no meio. Barulhento e sedento, mas abre caminho em qualquer horda.",
    mass: 11500, r: 900, seats: "2 tripulantes + 8 soldados", cap: "≈ 2.100 L internos", eff: "≈ 700 L/h", auto: "460 km", vmax: 300, skill: "Pilotagem aérea 5 (ataque) e armamento", hood: false
  }, function (c) {
    var EA = ZG.EA, blk = CM("#1a1b1d", { roughness: 0.6 });
    c.meta.matte = true;
    var cA = new THREE.Color("#3a4430"), cB = new THREE.Color("#66603f"), cC = new THREE.Color("#55613f"), cL = new THREE.Color("#8d958c");
    function camo(x, y, z, under) { if (under) return cL; var n = Math.sin(x * 0.55 + z * 0.8) + Math.sin(x * 0.3 - y * 1.1 + 1.3) + 0.6 * Math.sin(z * 1.7 - x * 0.2); return n > 0.8 ? cB : n > -0.3 ? cC : cA; }
    var paintV = c.paint("#ffffff"); paintV.vertexColors = true;
    var col = function (x, y, z) { return camo(x, y, z, y < 1.05); };
    /* fuselagem: nariz com duas cabines em degrau, cabine de tropa, afinando para o cone */
    var ST = [[6.05, 1.35, 1.6, 0.12, 2], [5.85, 1.05, 1.9, 0.72, 2.2], [5.3, 0.88, 2.15, 1.05, 2.4], [4.4, 0.8, 2.35, 1.2, 2.6], [3.4, 0.76, 2.75, 1.4, 2.8], [2.5, 0.74, 3.0, 1.7, 3],
      [-1.0, 0.74, 3.05, 1.72, 3], [-2.4, 0.86, 3.0, 1.5, 2.8], [-3.6, 1.3, 2.95, 1.0, 2.6], [-5.5, 1.85, 2.92, 0.62, 2.4], [-8.4, 2.25, 3.0, 0.42, 2.2], [-9.4, 2.4, 3.06, 0.34, 2]];
    var fus = c.add(EA.fuseGeo(ST, { seg: 36, col: col }), paintV);
    var gunK = [4.3, 5.65, 1.7, 2.8, null, 0.6], pilK = [2.75, 4.2, 2.3, 3.4, null, 0.7];
    var tdP = [[1.7, 1.5], [0.2, 1.5], [0.2, 2.1], [1.7, 2.1]];
    ZG.cutMesh(fus, [EA.cutT(gunK, function (n) { return n.y > 0.2; }), EA.cutT(pilK, function (n) { return n.y > 0.3; })], 40);
    c.deform.push(fus);
    /* bolhas das cabines em tandem (vidro moldado) com armação */
    function bubble(st, label, pos) { var m = new THREE.Mesh(EA.fuseGeo(st, { smooth: 26, seg: 28 }), MT.armorGlass); c.g.add(m); ZG.cutMesh(m, [{ sdf: function (x, y) { return y - st[0][1] - 0.04; } }], 30); return ZG.asGlass(c, m, label, "laminado", { pos: pos }); }
    bubble([[5.7, 1.78, 1.82, 0.3, 2], [5.45, 1.78, 2.38, 0.9, 2.4], [5.0, 1.78, 2.62, 1.0, 2.6], [4.5, 1.78, 2.64, 0.98, 2.6], [4.25, 1.78, 2.5, 0.8, 2.4], [4.1, 1.78, 2.2, 0.4, 2]], "Bolha do artilheiro", new V3(5.0, 2.3, 0));
    bubble([[4.3, 2.4, 2.45, 0.5, 2], [4.05, 2.4, 3.05, 1.06, 2.4], [3.6, 2.4, 3.3, 1.14, 2.6], [3.0, 2.4, 3.3, 1.12, 2.6], [2.7, 2.4, 3.1, 0.9, 2.4], [2.55, 2.4, 2.9, 0.4, 2]], "Bolha do piloto", new V3(3.5, 3.0, 0));
    [[5.45, 2.38, 0.45], [4.6, 2.64, 0.49], [4.05, 3.05, 0.53], [3.3, 3.3, 0.57]].forEach(function (q) { c.tube([[q[0], q[1] - 0.6, -q[2]], [q[0], q[1], 0], [q[0], q[1] - 0.6, q[2]]], 0.022, blk, { seg: 14 }); });
    c.rb(1.3, 0.025, 0.025, 0.01, blk, 3.4, 3.3, 0); c.rb(1.1, 0.025, 0.025, 0.01, blk, 4.9, 2.64, 0);
    /* janelas e portas da cabine de tropa (concha de cima e de baixo) */
    [1, -1].forEach(function (s) {
      GH.fGlass(c, EA, ST, EA.sideKeepP(tdP, 0.5, s), "Janelas da cabine de tropa " + (s > 0 ? "direita" : "esquerda"), "temperado", { pos: new V3(1.0, 1.8, s * 0.85), sub: 0.1, pre: EA.keepT([0.0, 1.9, 1.3, 2.3, 0.5]), mat: MT.armorGlass });
      var dF = EA.polySdf([[1.9, 0.9], [0.0, 0.9], [0.0, 2.35], [1.9, 2.35]]);
      GH.fSkin(c, EA, ST, EA.bandT(function (x, y, z) { return Math.min(0.008 - Math.min(Math.abs(dF(x, y)), x > 0 && x < 1.9 ? Math.abs(y - 1.35) : 9), s * z - 0.5); }), MT.dark, { k: 1.003, sub: 0.05, pre: EA.keepT([-0.2, 2.1, 0.8, 2.45, 0.5]) });
      for (var k = 0; k < 3; k++) c.rb(0.03, 0.62, 0.012, 0.01, blk, 0.5 + k * 0.5, 1.8, s * 0.86);
      c.text("FAB 8960", 1.2, 0.24, -5.3, 2.4, s * 0.33, s > 0 ? "+z" : "-z", { fg: "#1e2219" });
      GH.starDecal(c, -2.7, 2.0, s * 0.72, 0.28, s > 0 ? "+z" : "-z", { bg: "#3a4430", fg: "#a9ab94" });
    });
    ZG.cutMesh(fus, [EA.sideCutP(tdP, 0.5)], 40, { sub: 0.12 });
    EA.colorize(fus.geometry, col);  /* a subdivisão descarta a cor por vértice: pinta de novo */
    /* interior: artilheiro (frente) e piloto (atrás e mais alto), cabine de tropa com 8 bancos laterais */
    var fab = CM("#2e3328", { roughness: 0.85 });
    ZG.seat(c, 4.75, 1.55, 0, { w: 0.5, h: 0.32, back: 0.7, lean: 0.15, mat: fab }); c.rb(0.2, 0.3, 0.6, 0.04, CM("#232427"), 5.35, 1.98, 0, { rot: [0, 0, 0.3] }); c.rb(0.2, 0.2, 0.15, 0.03, MT.plastic, 5.25, 2.15, 0);
    ZG.seat(c, 3.2, 2.12, 0, { w: 0.5, h: 0.32, back: 0.72, lean: 0.15, mat: fab }); EA.instPanel(c, 3.85, 2.62, 0.8, { gauges: 6, z0: -0.25, tilt: 0.3, screens: [[0.05, 0.2, 0.14, 0.18]] }); EA.cyclic(c, 3.55, 2.12, 0); EA.collective(c, 3.3, 2.12, -0.38);
    GH.liner(c, ST, -0.3, 2.1, 0.95, MT.carpet, { h: 0.03, maxW: 1.4 });
    [0.3, 1.0, 1.7].forEach(function (x, i) { if (i < 3) { ZG.seat(c, x, 0.95, 0.5, { w: 0.5, h: 0.4, back: 0.55, lean: 0.06, face: "-z", mat: fab, headrest: false }); ZG.seat(c, x, 0.95, -0.5, { w: 0.5, h: 0.4, back: 0.55, lean: 0.06, face: "+z", mat: fab, headrest: false }); } });
    ZG.seat(c, -0.35, 0.95, 0.5, { w: 0.5, h: 0.4, back: 0.55, lean: 0.06, face: "-z", mat: fab, headrest: false }); ZG.seat(c, -0.35, 0.95, -0.5, { w: 0.5, h: 0.4, back: 0.55, lean: 0.06, face: "+z", mat: fab, headrest: false });
    GH.liner(c, ST, -0.4, 2.0, 2.75, MT.headliner, { maxW: 1.4 });
    /* motores lado a lado com filtros redondos à frente e supressores de IR virados para fora */
    var engM = c.paint("#ffffff"), engs = []; engM.vertexColors = true;
    [1, -1].forEach(function (s) {
      var z0 = s * 0.55, NS = [[2.75, 3.3, 3.4, 0.2, 2], [2.6, 3.04, 3.66, 0.66, 2.2], [1.8, 2.98, 3.72, 0.72, 2.4], [-1.2, 2.98, 3.72, 0.72, 2.4], [-1.8, 3.0, 3.66, 0.64, 2.2], [-2.1, 3.1, 3.52, 0.4, 2]];
      NS.forEach(function (q) { q.push(z0); });
      var n = c.add(EA.fuseGeo(NS, { smooth: 20, seg: 22, col: col }), engM); c.deform.push(n); engs.push(n);
      engs.push(c.cyl(0.4, 0.4, 0.22, CM("#5a5e52", { roughness: 0.7 }), 2.85, 3.35, z0, "x", { seg: 24 }), c.cyl(0.33, 0.33, 0.02, MT.dark, 2.97, 3.35, z0, "x", { seg: 24 }));
      var ex = c.rb(1.0, 0.45, 0.4, 0.12, CM("#3a3c36", { roughness: 0.7 }), -1.75, 3.25, s * 0.95, { rot: [0, s * 0.45, 0] }); engs.push(ex);
      engs.push(c.cyl(0.16, 0.16, 0.02, MT.dark, -2.2, 3.25, s * 1.2, "x"));
    });
    c.rb(3.4, 0.5, 0.5, 0.15, paintV, 0.3, 3.4, 0);
    c.cyl(0.22, 0.26, 0.5, MT.steel, 0, 3.95, 0); c.cyl(0.42, 0.36, 0.2, MT.steel, 0, 4.25, 0, null, { seg: 5 });
    var mr = EA.mainRotor(c, 0, 4.4, 0, { blades: 5, R: 8.6, chord: 0.58, droop: 0.32, hub: 0.55, hubR: 0.35, cap: true, v: 2.4, mat: CM("#2a2e26", { roughness: 0.55 }), phase: 0.2 });
    /* cone de cauda, estabilizador, deriva inclinada e rotor de cauda em X à esquerda */
    var tailM = c.paint("#ffffff"); tailM.vertexColors = true;
    var fin = c.add(EA.colorize(EA.foilGeo([{ p: [-9.3, 2.85, 0], c: 1.9, t: 0.12 }, { p: [-10.6, 5.1, 0.0], c: 1.05, t: 0.1 }], { up: "z", n: 10 }), function (x, y, z) { return camo(x, y, z, false); }), tailM); c.deform.push(fin);
    [1, -1].forEach(function (s) { var hs = c.add(EA.colorize(EA.foilGeo([{ p: [-8.3, 2.75, 0], c: 1.0, t: 0.1 }, { p: [-8.5, 2.75, s * 1.85], c: 0.7, t: 0.09 }], { up: "y", n: 8 }), function (x, y, z) { return camo(x, y, z, y < 2.75); }), tailM); c.deform.push(hs); });
    c.cyl(0.13, 0.13, 0.4, MT.steel, -10.85, 4.55, -0.25, "z");
    var tr = xRotor(c, -10.85, 4.55, -0.5, 1.95, 0.27, CM("#2a2e26", { roughness: 0.55 }), CM("#c9b23e"));
    c.rod(new V3(-9.4, 2.5, 0), new V3(-9.9, 1.6, 0), 0.04, MT.steel); c.rb(0.3, 0.05, 0.08, 0.02, MT.steel, -9.95, 1.57, 0);
    /* asas curtas com anédro, pilones com casulos de foguetes e lançadores de mísseis nas pontas */
    var wingM = c.paint("#ffffff"), wps = { 1: [], "-1": [] }; wingM.vertexColors = true;
    [1, -1].forEach(function (s) {
      var dh = function (z) { return 2.05 - Math.max(0, Math.abs(z) - 0.8) * 0.21; };
      var w = c.add(EA.colorize(EA.foilGeo([{ p: [0.55, dh(0.7), s * 0.7], c: 1.9, t: 0.13 }, { p: [0.4, dh(3.1), s * 3.1], c: 1.5, t: 0.11 }, { p: [0.38, dh(3.25), s * 3.25], c: 1.45, t: 0.06 }], { up: "y", n: 12 }), function (x, y, z) { return camo(x, y, z, y < dh(z)); }), wingM);
      c.deform.push(w); wps[s].push(w);
      [1.6, 2.5].forEach(function (zz) {
        var y = dh(zz) - 0.25; wps[s].push(c.rb(0.9, 0.22, 0.08, 0.03, CM("#3c4234"), -0.2, y + 0.08, s * zz));
        rocketPod(c, EA, -0.2, y - 0.25, s * zz, 2.0, 0.26, CM("#353b30", { roughness: 0.8 })).forEach(function (m) { wps[s].push(m); });
      });
      wps[s].push(c.rb(0.3, 1.0, 0.08, 0.03, CM("#3c4234"), 0.0, dh(3.25) - 0.3, s * 3.3));
      [0.18, -0.18].forEach(function (dy) { wps[s].push(c.cyl(0.08, 0.08, 1.8, CM("#5b6050", { roughness: 0.7 }), 0.1, dh(3.25) - 0.3 + dy, s * 3.42, "x", { seg: 12 })); });
      EA.navLight(c, -0.5, dh(3.25), s * 3.3, s > 0 ? "verde" : "vermelha", "Luz de navegação " + (s > 0 ? "direita (verde)" : "esquerda (vermelha)"), { r: 0.04 });
    });
    /* nariz: torre do canhão duplo de 23 mm, bola de sensores, sondas */
    var gun = new THREE.Group(); gun.position.set(5.35, 0.9, 0); gun.userData.rigid = true; c.g.add(gun);
    c.sph(0.3, CM("#3c4234", { roughness: 0.7 }), 0, 0, 0, 1.2, 0.8, 1, { parent: gun });
    [0.07, -0.07].forEach(function (z) { c.cyl(0.04, 0.035, 1.1, MT.steel, 0.65, -0.05, z, "x", { seg: 10, parent: gun }); c.cyl(0.055, 0.055, 0.1, MT.dark, 1.2, -0.05, z, "x", { seg: 10, parent: gun }); });
    var sens = c.sph(0.24, CM("#2b2c2e", { roughness: 0.4 }), 5.55, 1.15, 0.42); c.cyl(0.09, 0.09, 0.02, MT.glassDark, 5.77, 1.15, 0.45, "x");
    c.rod(new V3(5.9, 1.55, -0.3), new V3(6.7, 1.55, -0.3), 0.02, MT.steel);
    /* trem fixo triciclo: bequilha dupla e principais com amortecedor inclinado */
    var legs = [];
    legs.push(c.rod(new V3(4.15, 0.9, 0), new V3(4.12, 0.3, 0), 0.06, MT.steel));
    c.wheel(4.12, 0.2, 0.3, 0.16, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#4a4e44") }); c.wheel(4.12, -0.2, 0.3, 0.16, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#4a4e44") });
    [1, -1].forEach(function (s) {
      legs.push(c.rod(new V3(-0.25, 1.15, s * 0.85), new V3(-0.28, 0.42, s * 1.48), 0.07, MT.steel), c.rod(new V3(-0.9, 0.85, s * 0.8), new V3(-0.28, 0.42, s * 1.45), 0.05, MT.steel), c.rod(new V3(0.4, 0.85, s * 0.8), new V3(-0.28, 0.42, s * 1.45), 0.05, MT.steel));
      c.wheel(-0.28, s * 1.52, 0.42, 0.26, { spokes: 0, rimR: 0.5, noPart: true, rim: CM("#4a4e44") });
    });
    /* luzes: faróis de pouso no queixo, anticolisão e navegação */
    EA.lamp(c, 3.9, 0.78, 0.35, 0.09, "Farol de pouso direito"); EA.lamp(c, 3.9, 0.78, -0.35, 0.09, "Farol de pouso esquerdo");
    EA.navLight(c, -10.75, 5.05, 0, "branca", "Luz de cauda", { r: 0.035 });
    EA.navLight(c, -2.6, 3.05, 0, "vermelha", "Farol anticolisão", { r: 0.06 });
    c.part("rotor", "Rotor principal (5 pás)", mr, new V3(0, 4.4, 0), 2.6); c.part("rotorcauda", "Rotor de cauda em X", tr, new V3(-10.85, 4.55, -0.5), 1.6);
    c.part("motor", "Motores VK-2500", engs[0], new V3(0.3, 3.35, 0), 1.2); c.part("tanque", "Tanques de QAV", null, new V3(-1.5, 1.5, 0), 1.2);
    c.part("trem", "Trem de pouso fixo", null, new V3(-0.28, 0.4, 1.5), 1.0); c.part("arma", "Canhão duplo de 23 mm", gun, new V3(5.4, 0.9, 0), 0.7);
    Object.assign(c.meta, { kind: "heli", L: 21.6, W: 6.5, fusW: 1.72, front: 6.08, rear: -12.8, clear: 0.74, belt: 1.8, bodyH: 2.3, top: 6.5, fusTop: 3.05, roof: null, armored: true, bullet: true });
    var fz = 1.1;
    c.zone("nariz", "Nariz, cabine do artilheiro e canhão", [4.2, 7.0, 0.5, 2.8, -fz, fz], [gun, sens], { dir: "frente", fxKey: "cabineaero", who: "o artilheiro" });
    c.zone("cabine", "Cabine do piloto", [2.5, 4.2, 0.7, 3.4, -fz, fz], null, { dir: "esquerda", fxKey: "cabineaero", who: "o piloto" });
    c.zone("cabine_tropa", "Cabine de tropa e portas em concha", [-1.0, 2.5, 0.65, 3.0, -fz, fz], null, { dir: "esquerda", fxKey: "cabine", who: "os soldados", anyMesh: true });
    c.zone("motor", "Motores, filtros e supressores", [-2.6, 3.1, 2.9, 3.85, -1.5, 1.5], engs, { type: "peca", fxKey: "motor", sub: "motor", dir: "cima", pos: new V3(0.3, 3.35, 0), anchor: [0.3, 3.0, 0] });
    c.zone("cone", "Cone de cauda", [-9.2, -1.0, 1.0, 3.2, -1.0, 1.0], null, { dir: "cima", fxKey: "cone", cutAll: true, anyMesh: true });
    c.zone("empenagem", "Deriva e estabilizador", [-11.6, -8.0, 1.4, 5.3, -2.1, 2.1], null, { type: "peca", fxKey: "cauda", dir: "frente", anyMesh: true });
    [1, -1].forEach(function (s) {
      var sid = s > 0 ? "d" : "e";
      c.zone("asa_" + sid, "Asa " + (s > 0 ? "direita" : "esquerda") + " e foguetes", [-1.4, 1.6, 0.9, 2.4, s > 0 ? 0.8 : -3.7, s > 0 ? 3.7 : -0.8], wps[s], { type: "peca", side: s, fxKey: "arma", dir: "cima", anchor: [0.5, 2.05, s * 0.8] });
    });
    c.zone("esquis", "Trem de pouso fixo", [-1.1, 4.7, 0, 1.25, -1.9, 1.9], legs);
    c.zone("farol_c", "Faróis de pouso"); c.zone("lanterna_c", "Luz de cauda e anticolisão"); c.zone("lanterna_d", "Luz de navegação direita (verde)"); c.zone("lanterna_e", "Luz de navegação esquerda (vermelha)");
    c.meta.armor = function (c2) {
      /* modificado contra a horda: lâmina de arado sob o nariz para pousar no meio deles, chapas extras nas portas da tropa,
         metralhadoras de porta e casulos de canhão no lugar dos foguetes internos, guarda de arame no rotor de cauda */
      var stl = ZG.STEELM;
      c2.rb(0.12, 0.4, 2.0, 0.04, stl, 5.9, 0.5, 0, { rot: [0, 0, 0.5] }); [0.8, -0.8].forEach(function (z) { c2.rod(new V3(5.9, 0.5, z), new V3(5.0, 0.95, z * 0.6), 0.04, stl); });
      [1, -1].forEach(function (s) { c2.rb(1.9, 1.4, 0.03, 0.02, stl, 0.95, 1.6, s * 0.9); c2.cyl(0.03, 0.03, 1.0, MT.trim, 1.1, 2.0, s * 1.0, "x"); c2.rb(0.3, 0.15, 0.12, 0.02, MT.trim, 0.7, 1.98, s * 1.0); });
      c2.tube([[-9.6, 4.55, -0.75], [-10.85, 6.4, -0.75], [-12.2, 4.55, -0.75], [-10.85, 2.75, -0.75], [-9.6, 4.55, -0.75]], 0.02, stl, { seg: 40 });
      c2.part("arma", "Metralhadoras de porta", null, new V3(1.1, 2.0, 1.0), 0.7);
    };
  });
})(window.ZG);
