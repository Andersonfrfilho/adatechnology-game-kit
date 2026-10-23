/* Grupo B · SUVs, picapes, bigfoot e vans. Só usa a API de window.ZG (veja API.md).
   Medidas em metros, próximas das fichas reais (comprimento, entre-eixos, balanços, largura, altura, rodas).
   Funções locais deste arquivo (pedidos ao núcleo no fim do resumo do grupo B):
   - esculpir(): arredonda a carroceria extrudada (recolhe a saia, ombro na linha de cintura, cantos em planta)
     e faz as peças rígidas acompanharem;
   - cacamba(): recorta a caçamba no casco do ZG.car e põe assoalho, revestimento e caixas de roda;
   - paralama(): moldura de caixa de roda em plástico preto que acompanha o arco;
   - teto(), colunaB(), colunaC(), cintura(): teto que cai para trás, colunas pretas, vigia pequeno e linha de cintura subindo;
   - farolVivo(): recua a caixa maciça das lanternas e faróis para projetores e LEDs aparecerem pela lente;
   - placaParaFora(), soleira(), trincaParabrisa(): placa traseira na pele, peitoril interno escuro e para-brisa trincado na batida de frente. */
(function (ZG) {
  "use strict";
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM, clamp = ZG.clamp, smooth = ZG.smooth;
  var CLAD = CM("#1a1b1d", { roughness: 0.82 }), LINER = CM("#1c1d1f", { roughness: 0.92 }), RIMDARK = CM("#2a2d30", { metalness: 0.6, roughness: 0.4 });
  var RIMSIL = CM("#b9bec2", { metalness: 0.75, roughness: 0.3 }), RIMGUN = CM("#55595d", { metalness: 0.7, roughness: 0.35 });

  /* ================= utilidades locais ================= */
  /* Eixos e balanços reais. O perfil (lower) fica dF/dR para dentro da medida real: a pele tem 5 cm de chanfro e
     para-choques e lanternas saem um pouco do perfil. dF/dR foram acertados medindo o modelo pronto (tests/grupoB/dims.js). */
  function axles(WB, oF, L, dF, dR) {
    var xf = WB / 2, oR = L - WB - oF; dF = dF == null ? 0.08 : dF; dR = dR == null ? 0.1 : dR;
    return { xf: xf, xr: -xf, F: xf + oF - dF, R: -xf - oR + dR, oF: oF, oR: oR };
  }
  /* Bitola real: o núcleo põe a face de fora do pneu 3 cm para fora da lataria; leva cada roda para z = ±bitola/2. */
  function bitola(c, tF, tR) {
    c.wheels.forEach(function (w) {
      var s = w.position.z >= 0 ? 1 : -1, t = w.position.x > 0 ? tF : (tR || tF), dz = s * t / 2 - w.position.z;
      w.position.z += dz; c.parts.forEach(function (p) { if (p.obj === w) p.pos.z += dz; });
    });
  }
  /* Tira um vidro do ZG.car que fica escondido sob uma coluna pintada (sem zona fantasma nem cacos de um vidro que não se vê). */
  function semVidro(c, label) {
    c.glass.slice().forEach(function (g) {
      var G = g.userData.glass; if (!G || !G.label || G.label.indexOf(label) !== 0) return;
      c.glass.splice(c.glass.indexOf(g), 1); if (g.parent) g.parent.remove(g);
      for (var i = c.parts.length - 1; i >= 0; i--) if (c.parts[i].obj === g) c.parts.splice(i, 1);
    });
  }

  /* Arredonda a carroceria. Deforma por vértice o casco inferior, o capô, os para-choques e as peças compridas coladas na lateral;
     as demais peças abaixo da cintura acompanham como corpo rígido. o: { low (malha do casco), tuck, sh, peak, pf, pr, Rf, Rr, bowF, bowR, Rb, top, extra:[malhas] } */
  function esculpir(c, o) {
    var m = c.meta, W = m.W, by = o.bottom != null ? o.bottom : m.clear, top = o.top != null ? o.top : m.belt;
    var Wg = (m.gh && m.gh.Wg) || W, front = m.front, rear = m.rear;
    var tuck = o.tuck == null ? 0.045 : o.tuck, peak = o.peak || 0.45;
    var B = o.sh != null ? o.sh : clamp(1 - (Wg + 0.06) / W, 0, 0.06);
    var Rf = o.Rf || 0.55, Rr = o.Rr || 0.42, pf = o.pf == null ? 0.08 : o.pf, pr = o.pr == null ? 0.05 : o.pr;
    var bowF = o.bowF == null ? 0.07 : o.bowF, bowR = o.bowR == null ? 0.04 : o.bowR, Rb = o.Rb || 0.35, hw = W / 2;
    var crown = o.crown == null ? 0.045 : o.crown, xc = o.crownX != null ? o.crownX : (m.gh ? m.gh.fb : front - 1), y0 = by + 0.55 * (top - by);
    function sc(y) { var t = clamp((y - by) / (top - by), 0, 1); return t < peak ? 1 - tuck * Math.pow(1 - t / peak, 2) : 1 - B * Math.pow((t - peak) / (1 - peak), 2); }
    function F(v) {
      var a = smooth((v.x - (front - Rf)) / Rf), b = smooth((rear + Rr - v.x) / Rr), zz = clamp(v.z / hw, -1, 1) * clamp(v.z / hw, -1, 1);
      var bf = smooth((v.x - (front - Rb)) / Rb), br = smooth((rear + Rb - v.x) / Rb);
      var cr = crown * (1 - zz) * smooth((v.y - y0) / (top - y0)) * smooth((v.x - xc) / 0.3);
      v.x += -bowF * zz * bf + bowR * zz * br;
      v.z *= sc(Math.min(v.y, top)) * (1 - pf * a * a - pr * b * b);
      v.y += cr;
    }
    c.root.updateMatrixWorld(true);
    var gInv = new THREE.Matrix4().copy(c.g.matrixWorld).invert(), rel = new THREE.Matrix4(), inv = new THREE.Matrix4(), v = new V3();
    function warp(msh) {
      rel.multiplyMatrices(gInv, msh.matrixWorld); inv.copy(rel).invert();
      var g = msh.geometry, p = g.attributes.position;
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(rel); F(v); v.applyMatrix4(inv); p.setXYZ(i, v.x, v.y, v.z); }
      p.needsUpdate = true;
      if (!g.index && g.userData.crease) ZG.geo.crease(g, 42);
      g.computeBoundingSphere(); g.computeBoundingBox();
    }
    var skip = new Set(c.glass.concat(c.wheels)), warpSet = new Set([o.low].concat(o.extra || []));
    if (o.skip) o.skip.forEach(function (x) { skip.add(x); });
    if (m.bumperF) warpSet.add(m.bumperF); if (m.bumperR) warpSet.add(m.bumperR);
    if (c.hood && c.hood.piv) { skip.add(c.hood.piv); c.hood.piv.children.forEach(function (h) { if (h.isMesh) warpSet.add(h); }); }
    c.deform.forEach(function (d) { if (d !== o.low && !warpSet.has(d) && d.parent === c.g) { d.geometry.computeBoundingBox(); if (d.geometry.boundingBox.min.y > top - 0.2) skip.add(d); } });
    warpSet.forEach(function (msh) { if (msh && msh.parent) warp(msh); });
    var bb = new THREE.Box3(), cen = new V3(), sz = new V3();
    c.g.children.slice().forEach(function (ob) {
      if (skip.has(ob) || warpSet.has(ob)) return;
      if (ob.isMesh) {
        var g = ob.geometry; if (!g.boundingBox) g.computeBoundingBox();
        bb.copy(g.boundingBox).applyMatrix4(ob.matrix); bb.getCenter(cen); bb.getSize(sz);
        if (cen.y > top + 0.02) return;
        if (Math.abs(cen.z) > hw * 0.55 && (sz.x > 0.3 || sz.y > 0.3)) { warp(ob); return; }
      } else if (ob.isGroup) { cen.copy(ob.position); if (cen.y > top + 0.02) return; } else return;
      v.copy(cen); F(v); ob.position.add(v.sub(cen));
    });
    c.parts.forEach(function (pt) { if (pt.pos.y < top + 0.02) F(pt.pos); });
    return F;
  }

  /* Moldura de caixa de roda (plástico preto) nos dois lados. a = [x, y, r] do arco. */
  function paralama(c, arches, W, by, o) {
    o = o || {};
    var wd = o.w || 0.075, dp = o.d || 0.045, mat = o.mat || CLAD, out = [];
    arches.forEach(function (a) {
      /* a moldura cobre também o chanfro da pele na borda do arco (senão aparece um anel claro entre pneu e moldura) */
      var a0 = Math.asin(clamp((by - a[1]) / a[2], -1, 1)) - 0.02, r0 = a[2] - (o.inner == null ? 0.055 : o.inner), r1 = a[2] + wd;
      var sh = new THREE.Shape();
      if (o.trap) {
        /* caixa de roda trapezoidal (Jeep): borda de fora com topo reto e lados inclinados, borda de dentro redonda */
        var yb0 = Math.sin(a0) * r1, xb0 = Math.cos(a0) * r1, top = r1 * 0.93, xt = r1 * 0.52;
        sh.moveTo(xb0, yb0); sh.lineTo(r1 * 0.9, r1 * 0.5); sh.lineTo(xt, top); sh.lineTo(-xt, top); sh.lineTo(-r1 * 0.9, r1 * 0.5); sh.lineTo(-xb0, yb0);
        sh.absarc(0, 0, r0, PI - a0, a0, true);
      } else { sh.absarc(0, 0, r1, a0, PI - a0, false); sh.absarc(0, 0, r0, PI - a0, a0, true); }
      [1, -1].forEach(function (s) {
        var geo = new THREE.ExtrudeGeometry(sh, { depth: dp, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 28 });
        geo.translate(0, 0, s > 0 ? -0.02 : -dp + 0.02);
        out.push(c.add(geo, mat, a[0], a[1], s * (W / 2 - 0.004)));
      });
    });
    return out;
  }
  /* Saia lateral entre as caixas de roda (plástico preto). */
  function saia(c, x0, x1, y, h, W, mat) {
    var out = [];
    /* subdividida: esculpir() curva a lateral, e uma caixa só com vértices nas pontas afundaria na pele no meio */
    [1, -1].forEach(function (s) { out.push(c.rb(x1 - x0, h, 0.05, 0.02, mat || CLAD, (x0 + x1) / 2, y, s * (W / 2 + 0.006), { sub: 0.2 })); });
    return out;
  }
  /* Recorta a caçamba no casco e reveste. o: { low, x0 (traseira interna), x1 (frente interna), floor, top, W, arches } */
  function cacamba(c, o) {
    var W = o.W, hw = W / 2 - 0.075, L = o.x1 - o.x0, cx = (o.x0 + o.x1) / 2, h = o.top - o.floor;
    ZG.cutMesh(o.low, [ZG.holeTop(o.x0, o.x1, hw + 0.005, o.floor + 0.05)]);
    var fl = c.rb(L, 0.035, 2 * hw, 0.01, LINER, cx, o.floor, 0);
    for (var k = 0; k < 7; k++) c.rb(L - 0.04, 0.018, 0.04, 0.008, LINER, cx, o.floor + 0.025, -hw * 0.8 + k * hw * 1.6 / 6);
    [1, -1].forEach(function (s) { c.rb(L, h, 0.025, 0.01, LINER, cx, o.floor + h / 2, s * (hw + 0.012)); });
    c.rb(0.025, h, 2 * hw, 0.01, LINER, o.x0 + 0.012, o.floor + h / 2, 0);
    c.rb(0.03, h + 0.05, 2 * hw + 0.02, 0.01, c.paint(c.meta.col), o.x1 - 0.015, o.floor + (h + 0.05) / 2, 0);
    (o.arches || []).forEach(function (a) {
      if (a[0] < o.x0 - 0.3 || a[0] > o.x1 + 0.3) return;
      var tt = a[1] + a[2] + 0.04 - o.floor; if (tt <= 0.02) return;
      var lx0 = Math.max(o.x0 + 0.03, a[0] - a[2]), lx1 = Math.min(o.x1 - 0.03, a[0] + a[2]);
      [1, -1].forEach(function (s) { c.rb(lx1 - lx0, tt, 0.24, 0.05, LINER, (lx0 + lx1) / 2, o.floor + tt / 2, s * (hw - 0.12)); });
    });
    for (var t = 0; t < 4; t++) [1, -1].forEach(function (s) { c.cyl(0.018, 0.018, 0.03, MT.steel, o.x0 + 0.1 + t * (L - 0.2) / 3, o.top - 0.04, s * (hw - 0.005), "z"); });
    c.meta.bed = { x0: o.x0 + 0.05, x1: o.x1 - 0.05, y: o.floor };
    c.part("carga", "Caçamba", fl, new V3(cx, o.floor + 0.2, 0), 1.0);
  }
  /* x da pele (frente, +x) ou da traseira (-x) no ponto (y, z), medido por raio na malha já esculpida.
     fX() vem do perfil antes de esculpir() e erra alguns cm onde o canto do nariz é arredondado. */
  function peleX(c, msh, y, z, tras) {
    c.root.updateMatrixWorld(true);
    var o = c.g.localToWorld(new V3(tras ? -9 : 9, y, z || 0)), d = new V3(tras ? 1 : -1, 0, 0).transformDirection(c.g.matrixWorld);
    var hit = new THREE.Raycaster(o, d, 0, 20).intersectObject(msh, false)[0];
    return hit ? c.g.worldToLocal(hit.point.clone()).x : null;
  }
  function grade(c, s, style, w, h, y, o) { var x = ZG.profX(s.lower, y, true); return ZG.grille(c, Object.assign({ style: style, x: x + 0.03, y: y, w: w, h: h, col: s.col, emblem: false }, o || {})); }
  function neblina(c, s, y, z, r) {
    var x = ZG.profX(s.lower, s.bottomY + 0.14, true) + 0.09;
    [1, -1].forEach(function (sd) {
      c.rb(0.04, r * 2.6, r * 3.2, 0.015, MT.housing, x, y, sd * z);
      ZG.headlight(c, { style: "round", x: x + 0.01, y: y, z: sd * z, w: r * 2, h: r * 2, d: 0.05, side: sd, label: "Farol de neblina " + (sd > 0 ? "direito" : "esquerdo"), reach: 0.5 });
    });
  }
  function barrasTeto(c, z, h, r) {
    var m = c.meta; h = h || 0.07;
    [z, -z].forEach(function (zz) {
      c.rod(new V3(m.roof.x0 - 0.02, m.top + h, zz), new V3(m.roof.x1 + 0.02, m.top + h, zz), r || 0.022, MT.trim);
      [m.roof.x0, m.roof.x1].forEach(function (x) { c.rb(0.1, h + 0.02, 0.05, 0.02, MT.trim, x, m.top + h / 2, zz); });
    });
  }
  /* Antena barbatana de tubarão no fim do teto */
  function barbatana(c, x, col) {
    var m = c.meta, g = c.rb(0.16, 0.06, 0.05, 0.025, col ? c.paint(col) : GLOSS, x, m.top + 0.02, 0, { taper: { sx: 0.35, shift: -0.05 } });
    return g;
  }
  function estribo(c, x0, x1, y, W, dz) {
    dz = dz == null ? 0.04 : dz;
    [1, -1].forEach(function (s) {
      c.rb(x1 - x0, 0.04, 0.16, 0.015, MT.alu, (x0 + x1) / 2, y, s * (W / 2 + dz));
      [x0 + 0.25, (x0 + x1) / 2, x1 - 0.25].forEach(function (x) { c.rb(0.05, 0.1, 0.14, 0.01, MT.trim, x, y + 0.05, s * (W / 2 - 0.02)); });
    });
  }
  function snorkel(c, x, yb, yt, z, xb) {
    var s = Math.sign(z);
    c.tube([[x, yb, z], [x - 0.05, yb + 0.3, z + s * 0.02], [xb, yt - 0.1, z - s * 0.06], [xb - 0.02, yt, z - s * 0.08]], 0.045, MT.trim, { seg: 30, rs: 10 });
    c.rb(0.16, 0.12, 0.12, 0.04, MT.trim, xb + 0.04, yt + 0.04, z - s * 0.08);
  }
  function guincho(c, x, y) { c.cyl(0.08, 0.08, 0.5, MT.trim, x, y, 0, "z"); c.cyl(0.07, 0.07, 0.3, CM("#7a1d17"), x, y, 0, "z"); c.rb(0.12, 0.1, 0.1, 0.02, MT.steel, x + 0.08, y, 0); c.part("guincho", "Guincho", null, new V3(x, y, 0), 0.5); }
  function barraLed(c, x, y, w) {
    c.rb(0.1, 0.1, w, 0.03, MT.housing, x, y, 0);
    var L = ZG.lightBar(c, x + 0.04, y, -w / 2 + 0.04, w / 2 - 0.04, 0.05, 1);
    [-w / 2 + 0.1, w / 2 - 0.1].forEach(function (z) { c.rod(new V3(x - 0.05, y - 0.05, z), new V3(x - 0.15, y - 0.13, z), 0.015, MT.trim); });
    return L;
  }
  /* Gaiola na caçamba (modificado das picapes) */
  function gaiolaCacamba(c) {
    var m = c.meta, b = m.bed; if (!b) return;
    var hw = m.W / 2 - 0.1, yt = m.top + 0.15;
    [b.x0 + 0.05, (b.x0 + b.x1) / 2, b.x1 - 0.05].forEach(function (x) { c.tube([[x, m.belt, -hw], [x, yt - 0.05, -hw + 0.05], [x, yt, 0], [x, yt - 0.05, hw - 0.05], [x, m.belt, hw]], 0.03, ZG.STEELM, { seg: 24, rs: 8 }); });
    [-hw * 0.6, 0, hw * 0.6].forEach(function (z) { c.rod(new V3(b.x0 + 0.05, yt - (z ? 0.03 : 0), z), new V3(b.x1 - 0.05, yt - (z ? 0.03 : 0), z), 0.018, ZG.STEELM); });
    for (var x = b.x0 + 0.1; x < b.x1; x += 0.16) [1, -1].forEach(function (s) { c.rod(new V3(x, m.belt, s * hw), new V3(x, yt - 0.1, s * (hw - 0.05)), 0.008, ZG.STEELM, { seg: 5 }); });
    var hx = b.x1 - 0.1;
    c.cyl(0.12, 0.09, 0.2, MT.steel, hx, yt + 0.12, 0, "x"); c.cyl(0.1, 0.1, 0.02, MT.head, hx + 0.1, yt + 0.12, 0, "x"); c.rod(new V3(hx, yt, 0), new V3(hx, yt + 0.06, 0), 0.03, MT.trim);
  }

  /* ---- rodada 2: estufa com caráter (teto caindo, coluna C preta, linha de cintura subindo), frisos e dano ---- */
  var BV = 0.05; /* o casco extrudado tem chanfro de 5 cm: a pele fica 5 cm para fora do perfil */
  var GLOSS = CM("#0b0c0e", { roughness: 0.16, metalness: 0.55 }), SILL = CM("#141517", { roughness: 0.8 });
  function fX(s, y) { return ZG.profX(s.lower, y, true) + BV; }
  function rX(s, y) { return ZG.profX(s.lower, y, false) - BV; }
  /* Placa traseira e textos na tampa: o núcleo põe a placa 2,5 cm para dentro do chanfro. Leva até a pele. */
  function placaParaFora(c) {
    var m = c.meta;
    c.g.children.forEach(function (o) { if (o.isMesh && o.geometry.type === "PlaneGeometry" && Math.abs(o.rotation.y + PI / 2) < 0.01 && o.position.x < m.rear + 0.2 && o.material.map && o.material.map.image && o.material.map.image.width === 400) o.position.x = Math.min(o.position.x, m.rear - BV * 0.5) - BV * 0.62; });
  }
  /* Friso escuro no peitoril interno das portas (sem ele o topo da lataria aparece pelo para-brisa como uma faixa na cor do carro). */
  function soleira(c) {
    var gh = c.meta.gh; if (!gh || !gh.Wg || gh.rb == null) return;
    var x0 = gh.rb + 0.1, x1 = gh.fb - 0.05;
    [1, -1].forEach(function (s) { c.rb(x1 - x0, 0.035, 0.12, 0.012, SILL, (x0 + x1) / 2, gh.belt + 0.05, s * (gh.Wg / 2 - 0.06)).castShadow = false; });
  }
  /* Painel fino colado na lateral da estufa (segue o afinamento T). poly em [x, y]; mat; o.off distância da pele */
  function aplique(c, poly, mat, o) {
    o = o || {};
    var m = c.meta, Wg = m.gh.Wg, T = m.T, off = o.off || 0.017, out = [];
    (o.sides || [1, -1]).forEach(function (s) {
      var shp = ZG.geo.pathShape(poly.map(function (p) { return [p[0], p[1], p[2] || 0]; }));
      var geo = new THREE.ExtrudeGeometry(shp, { depth: 0.007, bevelEnabled: false, curveSegments: 6 });
      geo.translate(0, 0, s > 0 ? Wg / 2 + off : -Wg / 2 - off - 0.007); ZG.geo.tumble(geo, T); geo.computeVertexNormals();
      var me = c.add(geo, mat); me.castShadow = false; c.deform.push(me); out.push(me);
    });
    return out;
  }
  /* Geometria da estufa: linhas de base/topo e bordas do vidro lateral (como autoWindows do núcleo) */
  function estufa(c) {
    var gh = c.meta.gh, b = gh.belt, r = gh.roof;
    var lx = function (x0, x1, y) { return x0 + (x1 - x0) * (y - b) / (r - b); };
    return { b: b, yb: b + 0.06, yt: r - 0.075, top: r + 0.02, back: function (y) { return lx(gh.rb, gh.rt, y); }, win: function (y) { return lx(gh.rb, gh.rt, y) + 0.0975; } };
  }
  /* Coluna C (ou D) larga em preto, com um vigia triangular pequeno. xp = coluna que separa o vigia; vig = [xv (ponta de trás no topo), yv (ponta de baixo na coluna)] */
  function colunaC(c, xp, vig, mat) {
    var E = estufa(c), yt = E.top - 0.03, b = E.b + 0.012, poly;
    if (vig) poly = [[xp + 0.06, b], [xp + 0.06, yt], [xp - 0.065, yt], [xp - 0.065, vig[1]], [vig[0], E.yt - 0.005], [vig[0], yt], [E.back(yt) + 0.035, yt], [E.back(b) + 0.035, b]];
    else poly = [[xp + 0.06, b], [xp + 0.06, yt], [E.back(yt) + 0.035, yt], [E.back(b) + 0.035, b]];
    var out = aplique(c, poly, mat || GLOSS);
    if (vig) [1, -1].forEach(function (s) {
      var z = function (y) { return s * (ZG.halfAt(c.meta.gh.Wg, c.meta.T, y) + 0.022); };
      c.tube([[xp - 0.065, vig[1], z(vig[1])], [vig[0], E.yt - 0.005, z(E.yt)]], 0.006, MT.chrome, { seg: 8, rs: 5 });
    });
    return out;
  }
  /* Coluna C larga na cor da carroceria (sem vigia): xb/xt = borda da frente embaixo e em cima (inclinada como a porta real). */
  function pilarPintado(c, xb, xt, col, o) {
    o = o || {};
    var E = estufa(c), yt = E.top - 0.025, b = E.b + 0.005;
    var out = aplique(c, [[xb, b], [xt, yt], [E.back(yt) + 0.03, yt], [E.back(b) + 0.03, b]], o.mat || c.paint(col), { off: 0.016 });
    [1, -1].forEach(function (s) {
      var z = function (y) { return s * (ZG.halfAt(c.meta.gh.Wg, c.meta.T, y) + 0.024); };
      c.tube([[xb + 0.004, E.yb, z(E.yb)], [xt + 0.004, E.yt, z(E.yt)]], 0.008, o.edge || GLOSS, { seg: 6, rs: 5 });
    });
    return out;
  }
  /* Coluna B preta (friso da janela). */
  function colunaB(c, x, mat) { var E = estufa(c); return aplique(c, [[x - 0.065, E.b + 0.03], [x + 0.065, E.b + 0.03], [x + 0.065, E.top - 0.03], [x - 0.065, E.top - 0.03]], mat || GLOSS); }
  /* Linha de cintura que sobe para trás: painel na cor do carro cobre a base dos vidros de x0 (sobe 0) até a traseira (sobe dy). */
  function cintura(c, x0, dy, col) {
    var E = estufa(c), xr = E.back(E.yb + dy) + 0.03, y0 = E.b - 0.02;
    var out = aplique(c, [[x0, y0], [x0, E.yb - 0.008], [xr, E.yb + dy], [xr, y0]], c.paint(col), { off: 0.016 });
    [1, -1].forEach(function (s) {
      var z = function (y) { return s * (ZG.halfAt(c.meta.gh.Wg, c.meta.T, y) + 0.024); };
      c.tube([[x0, E.yb - 0.008, z(E.yb)], [xr + 0.03, E.yb + dy, z(E.yb + dy)]], 0.007, MT.trim, { seg: 10, rs: 5 });
    });
    return out;
  }
  /* Teto que cai para trás: abaixa tudo acima da cintura em drop (m) de x0 até x1, proporcional à altura acima da cintura. */
  function teto(c, drop, x0, x1) {
    var m = c.meta, b = m.gh.belt, h = m.top - b;
    function dy(x, y) { var t = clamp((y - b) / h, 0, 1); return t <= 0 ? 0 : drop * smooth((x0 - x) / (x0 - x1)) * t; }
    c.root.updateMatrixWorld(true);
    var gInv = new THREE.Matrix4().copy(c.g.matrixWorld).invert(), rel = new THREE.Matrix4(), inv = new THREE.Matrix4(), v = new V3(), done = new Set();
    c.g.traverse(function (ob) {
      if (!ob.isMesh || done.has(ob.geometry)) return; done.add(ob.geometry);
      rel.multiplyMatrices(gInv, ob.matrixWorld); inv.copy(rel).invert();
      var g = ob.geometry, p = g.attributes.position, ch = false;
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(rel); if (v.y <= b + 1e-4 || v.x > x0) continue; var d = dy(v.x, v.y); if (d <= 0) continue; v.y -= d; v.applyMatrix4(inv); p.setXYZ(i, v.x, v.y, v.z); ch = true; }
      if (!ch) return;
      p.needsUpdate = true; if (!g.index && g.userData.crease) ZG.geo.crease(g, 42);
      g.computeBoundingSphere(); g.computeBoundingBox();
    });
    c.glass.forEach(function (gm) { var G = gm.userData.glass; if (G && G.outline) G.outline.forEach(function (q) { q.y -= dy(q.x, q.y); }); });
    c.parts.forEach(function (pt) { pt.pos.y -= dy(pt.pos.x, pt.pos.y); });
  }
  /* Batida de frente do estado danificado: além do padrão, a cabeça de quem bate trinca o para-brisa (laminado, em teia). */
  function trincaParabrisa(c, f) {
    var q = c.meta.quadF, g = c.glass.find(function (x) { return x.userData.glass && x.userData.glass.label === "Para-brisa"; });
    if (!q || !g) return;
    var pt = c.parts.find(function (p) { return p.obj === g; }); if (!pt || pt.done) return;
    var v = 0.35, p = new V3(q.b[0] + (q.t[0] - q.b[0]) * v, q.b[1] + (q.t[1] - q.b[1]) * v, 0.18);
    pt.done = true; ZG.applyPart(c, pt, f, new V3(-q.n[0], -q.n[1], 0), p); c.log.push(pt);
  }
  function danoB(c) { ZG.defaultDamage(c); trincaParabrisa(c, 0.95); }
  /* Embrulha o efeito padrão de uma peça (para limitar pendurado do para-choque, entreaberto do capô...) */
  function apos(pt, fn) { if (!pt) return; pt.onHit = function (c, p0, f, dir, p) { var keep = p0.onHit; p0.onHit = null; ZG.applyPart(c, p0, f, dir, p); p0.onHit = keep; fn(c, p0, f, dir, p); }; }
  /* Refletor cromado atrás da lente: farol aceso lê como farol, não como caixa cinza fosca (apaga quando o farol quebra). */
  function farolVivo(c) {
    c.lights.forEach(function (L) {
      if (!L.g || L.g.userData.viv) return; L.g.userData.viv = true;
      /* a caixa (housing) do núcleo é maciça e esconde projetores e LEDs: recua a frente dela 4 cm para o miolo aparecer pela lente */
      var front = null;
      L.g.children.slice().forEach(function (h) {
        if (!h.isMesh || h.material !== MT.housing || h.geometry.type !== "BoxGeometry" || Math.abs(h.position.x) > 1e-3) return;
        h.geometry.computeBoundingBox(); var bb = h.geometry.boundingBox, d = bb.max.x - bb.min.x; if (d < 0.06) return;
        var k = (d - 0.042) / d; h.scale.x = k; h.position.x = bb.min.x * (1 - k);
        if (L.kind === "farol" && bb.max.z - bb.min.z >= 0.12) {
          var r = c.rb(0.006, (bb.max.y - bb.min.y) * 0.78, (bb.max.z - bb.min.z) * 0.9, 0.003, MT.reflector, bb.max.x - 0.036, h.position.y, h.position.z, { parent: L.g });
          r.castShadow = false; L.inner.push(r);
        }
      });
    });
  }
  /* Forro do teto (e painel de luz do salão): o núcleo não o põe na zona do teto, e com o teto arrancado ficava uma placa
     clara solta sobre a cabine. Some com o teto no arrancado, junto com o que fica
     montado em cima do teto (extra: giroflex, faróis de teto), que senão ficaria flutuando. */
  function forroTeto(c, extra) {
    var m = c.meta, yb = (m.gh ? m.gh.belt : m.belt) + 0.25, bb = new THREE.Box3(), sz = new V3(), ce = new V3(), gl = new Set(c.glass), list = [];
    var cols = [m.col, m.roofCol].filter(Boolean).map(function (h) { return new THREE.Color(h).getHex(); });
    c.g.children.forEach(function (o) {
      if (!o.isMesh || gl.has(o) || o.geometry.type !== "BoxGeometry" || o.material === MT.trim || o.material === MT.chrome || o.material.transparent) return;
      if (o.material.color && cols.indexOf(o.material.color.getHex()) >= 0) return;
      o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrix); bb.getSize(sz); bb.getCenter(ce);
      if (sz.x > 0.5 && sz.z > 0.6 && sz.y < 0.08 && ce.y > yb) list.push(o);
    });
    extra = extra || [];
    /* não passa a ser peça do teto (os decalques de ferrugem iriam para o forro e ficariam no ar): só some junto */
    if (list.length || extra.length) c.zone("teto", null, null, null, { onBand: function (c, b) { if (b >= 4) list.concat(extra).forEach(function (o) { o.visible = false; }); } });
  }
  function acabamento(c, extra) { placaParaFora(c); soleira(c); farolVivo(c); forroTeto(c, extra); if (!c.meta.damage) c.meta.damage = danoB; }

  /* ================= SUVs ================= */
  function suvBuild(c, s, o) {
    o = o || {};
    var n0 = c.deform.length;
    ZG.car(c, s);
    var low = c.deform[n0], m = c.meta, extra = [];
    if (o.flares !== false) extra = extra.concat(paralama(c, s.arches, s.W, s.bottomY, o.flare));
    if (o.skirt !== false) { var a = s.arches; extra = extra.concat(saia(c, a[1][0] + a[1][2] + 0.04, a[0][0] - a[0][2] - 0.04, s.bottomY + 0.1, 0.16, s.W)); }
    if (o.pre) o.pre(c, m, extra);
    var F = esculpir(c, Object.assign({ low: low, extra: extra }, o.sculpt || {}));
    if (o.post) o.post(c, m, F, low);
    if (o.roof) teto(c, o.roof[0], o.roof[1], o.roof[2]);
    acabamento(c);
    return low;
  }
  function suvArmor(xSn) {
    return function (c) {
      var m = c.meta;
      ZG.applyArmor(c);
      if (m.gh) snorkel(c, m.gh.fb + 0.25, m.clear + 0.45, m.top - 0.05, m.W / 2 + 0.03, m.gh.ft + 0.1 + (xSn || 0));
      guincho(c, m.front + 0.12, m.clear + 0.2);
      if (m.roof) barraLed(c, m.roof.x1 - 0.05, m.top + 0.2, Math.min(1.2, m.roof.w));
    };
  }

  /* T-Crux · VW T-Cross (2019-2024, Brasil)
     Referência (fichacompleta.com.br, Highline 2022): comprimento 4,199 m · largura 1,760 m · altura 1,570 m · entre-eixos 2,651 m ·
       bitola 1,524 m (diant.) / 1,509 m (tras.) · pneu 205/55 R17 (0,657 m) · balanço dianteiro ≈ 0,84 m e traseiro ≈ 0,71 m (de memória) ·
       altura do solo 0,191 m · 1292 kg · tanque 52 L · 11,8 km/L (G) e 8,2 km/L (E) na cidade.
     Traços de assinatura:
       frente   · faróis finos em LED na altura do capô, ligados por uma faixa preta brilhante com friso cromado embaixo;
                · para-choque com grade inferior larga em colmeia e faróis de neblina nas pontas;
       lateral  · caixa alta e reta, capô alto quase plano, moldura preta nas caixas de roda e saia preta;
                · coluna B preta e coluna C larga na cor do carro, com a borda da porta traseira inclinada para a frente;
                · teto quase reto com barras finas; tampa traseira quase vertical;
       traseira · faixa vermelha escura refletiva ligando as lanternas horizontais de ponta a ponta, nome no meio;
                · para-choque preto alto com protetor prateado;
       teto     · barras longitudinais finas; para-brisa curto e vidro traseiro pequeno. */
  ZG.register({ k: "suvc", grp: "SUVs", n: "T-Crux", insp: "Volkswagen T-Cross", c: "SUV compacto", fuel: "flex",
    d: "SUV compacto de cidade: alto o bastante para pular meio-fio, curto para manobrar entre carros abandonados. Turbo flex bebe o que achar.",
    mass: 1290, r: 60, seats: "5", cap: "52 L", eff: "11,8 km/L (G) · 8,2 km/L (E)", auto: "610 km", vmax: 190, skill: "Direção 1", hood: true
  }, function (c) {
    var A = axles(2.651, 0.84, 4.199, 0.07, 0.145), col = "#b8b3a6", R = A.R, F = A.F;
    var s = { W: 1.72, col: col, bottomY: 0.3, noseY: 0.86, tailY: 0.98,
      lower: [[R, 0.33, 0.08], [R - 0.03, 0.62, 0.12], [R + 0.04, 0.99, 0.08], [0.95, 1.0, 0], [1.55, 0.955, 0.3], [F - 0.045, 0.89, 0.1], [F, 0.6, 0.14], [F - 0.04, 0.32, 0.08]],
      arches: [[A.xf, 0.33, 0.375], [A.xr, 0.33, 0.375]],
      gh: { rb: R + 0.06, rt: R + 0.27, ft: 0.13, fb: 0.97, belt: 1.0, roof: 1.475, Wg: 1.62, k: 0.14, pillars: [-0.12, -0.98], r1: 0.1, r2: 0.2 },
      seams: [0.99, -0.13, -0.99], handles: [0.42, -0.6], plateRearY: 0.75, noAntenna: true,
      hl: { style: "slim", w: 0.36, h: 0.1, y: 0.835, in: 0.04, yaw: 0.25, dx: 0.03, mat: MT.led }, grille: false,
      tl: { style: "wrap", w: 0.3, h: 0.095, y: 0.92, wrap: 0.16 },
      interior: { rows: 2, col: "#2b2c30", trim: "#18191b" }, hood: { motor: "gasolina" },
      wheels: [[A.xf, 0.3285, 0.205, { rim: RIMGUN, spokes: 10 }], [A.xr, 0.3285, 0.205, { rim: RIMGUN, spokes: 10 }]] };
    suvBuild(c, s, { roof: [0.025, -0.3, R + 0.27], flare: { w: 0.06, d: 0.035 }, pre: function (c, m) {
      /* faixa preta brilhante entre os faróis, friso cromado de ponta a ponta embaixo dela */
      c.rb(0.05, 0.095, 1.0, 0.02, GLOSS, fX(s, 0.835) - 0.02, 0.835, 0);
      c.rb(0.03, 0.014, 1.36, 0.006, MT.chrome, fX(s, 0.79) - 0.004, 0.79, 0);
      /* para-choque: grade inferior em colmeia, larga, numa moldura preta; nichos dos faróis de neblina */
      c.rb(0.05, 0.22, 1.1, 0.05, MT.trim, fX(s, 0.52) - 0.025, 0.52, 0);
      grade(c, s, "mesh", 0.98, 0.16, 0.53, { x: fX(s, 0.53) - 0.01 });
      [1, -1].forEach(function (sd) { c.rb(0.04, 0.1, 0.18, 0.03, GLOSS, fX(s, 0.43) - 0.01, 0.43, sd * 0.66, { rot: [sd * -0.25, 0, 0] }); });
      neblina(c, s, 0.43, 0.66, 0.03);
      /* traseira: faixa escura refletiva ligando as lanternas, com o nome em prata */
      c.rb(0.03, 0.085, 1.08, 0.012, CM("#3a1412", { roughness: 0.12, metalness: 0.6 }), rX(s, 0.92) + 0.002, 0.92, 0);
      c.text("T-CRUX", 0.24, 0.045, rX(s, 0.92) - 0.016, 0.92, 0, "-x", { fg: "#d7d9db", size: 0.7 });
      /* para-choque traseiro preto alto com protetor prateado */
      c.rb(0.1, 0.16, s.W * 0.95, 0.05, MT.trim, rX(s, 0.52) + 0.02, 0.5, 0, { def: true });
      c.rb(0.04, 0.045, 0.8, 0.015, MT.alu, rX(s, 0.4) - 0.07, 0.37, 0);
      barrasTeto(c, 0.64, 0.035, 0.015);
      barbatana(c, R + 0.42);
    }, post: function (c, m) {
      colunaB(c, -0.12);
      semVidro(c, "Vidro lateral traseiro");
      pilarPintado(c, -1.0, -0.9, col);
      bitola(c, 1.524, 1.509);
    } });
    c.meta.armor = suvArmor();
  });

  /* Corola Crux Híbrido · Toyota Corolla Cross Hybrid (2021+, Brasil)
     Referência (fichacompleta.com.br, Altis Premium Hybrid 2022): comprimento 4,460 m · largura 1,825 m · altura 1,620 m ·
       entre-eixos 2,640 m · bitola 1,559 m / 1,571 m · pneu 225/50 R18 (0,682 m) · balanço dianteiro ≈ 0,93 m e traseiro ≈ 0,89 m (de memória) ·
       altura do solo 0,161 m · 1450 kg · tanque 36 L · 17 km/L (G) e 11,8 km/L (E) na cidade · 170 km/h.
     Traços de assinatura:
       frente   · faróis angulosos em cunha ligados por grade superior fina com friso cromado;
                · grade inferior trapezoidal enorme em preto brilhante com colmeia, ladeada por "presas" verticais pretas;
       lateral  · molduras pretas largas nas caixas de roda, coluna B preta, vigia triangular atrás da porta traseira e coluna D na cor do carro;
                · linha de cintura que sobe para trás e teto que cai suave; adesivo HÍBRIDO azul no paralama;
       traseira · lanternas horizontais que invadem a tampa, ligadas por friso; para-choque com saia preta;
       teto     · barras longitudinais; teto afinando na traseira. */
  ZG.register({ k: "hibrido", grp: "SUVs", n: "Corola Crux Híbrido", insp: "Toyota Corolla Cross Hybrid", c: "SUV híbrido flex", fuel: "hibrido",
    d: "Anda no modo elétrico em silêncio pela cidade e liga o motor flex na estrada. Bateria híbrida batida pode pegar fogo.",
    mass: 1455, r: 20, seats: "5", cap: "36 L + bateria de 1,3 kWh", eff: "17,0 km/L (G) · 11,8 km/L (E)", auto: "610 km", vmax: 170, skill: "Eletricidade 1 (bateria híbrida)", hood: true
  }, function (c) {
    var A = axles(2.64, 0.93, 4.46, 0.07, 0.1), col = "#7d8389", R = A.R;
    var s = { W: 1.785, col: col, bottomY: 0.32, noseY: 0.88, tailY: 1.04, noAntenna: true,
      lower: [[A.R, 0.36, 0.08], [A.R - 0.03, 0.64, 0.14], [A.R + 0.11, 1.04, 0.14], [0.98, 1.05, 0], [1.62, 0.98, 0.32], [A.F - 0.05, 0.88, 0.12], [A.F, 0.6, 0.16], [A.F - 0.05, 0.35, 0.08]],
      arches: [[A.xf, 0.341, 0.395], [A.xr, 0.341, 0.395]],
      gh: { rb: A.R + 0.12, rt: A.R + 0.6, ft: 0.12, fb: 1.02, belt: 1.03, roof: 1.525, Wg: 1.7, k: 0.15, pillars: [-0.18, -1.12], r1: 0.22, r2: 0.22 },
      seams: [1.05, -0.19, -1.11], handles: [0.42, -0.66], plateRearY: 0.74,
      hl: { style: "wedge", w: 0.46, h: 0.11, y: 0.855, in: 0.025, yaw: 0.3, dx: 0.03, mat: MT.led }, grille: false,
      tl: { style: "wrap", w: 0.36, h: 0.085, y: 0.975, in: 0.03, wrap: 0.2 },
      interior: { rows: 2, col: "#3a3c40", trim: "#1b1c1f" }, hood: { motor: "gasolina" },
      wheels: [[A.xf, 0.341, 0.225, { rim: RIMDARK, spokes: 5 }], [A.xr, 0.341, 0.225, { rim: RIMDARK, spokes: 5 }]] };
    suvBuild(c, s, { roof: [0.06, -0.25, A.R + 0.6], flare: { w: 0.085, d: 0.04 }, pre: function (c, m) {
      /* grade superior fina entre os faróis */
      c.rb(0.05, 0.05, 0.86, 0.018, GLOSS, fX(s, 0.84) - 0.015, 0.84, 0);
      c.rb(0.03, 0.012, 0.8, 0.005, MT.chrome, fX(s, 0.815), 0.815, 0);
      /* grade inferior trapezoidal larga em preto brilhante (mais larga embaixo) com colmeia */
      c.rb(0.06, 0.3, 1.36, 0.05, GLOSS, fX(s, 0.5) - 0.02, 0.5, 0, { taper: { sz: 0.74 } });
      grade(c, s, "mesh", 0.98, 0.2, 0.5, { x: fX(s, 0.5) + 0.0 });
      [1, -1].forEach(function (sd) { c.rb(0.04, 0.16, 0.12, 0.03, GLOSS, fX(s, 0.5) - 0.0, 0.48, sd * 0.76, { rot: [sd * 0.35, 0, 0] }); });
      [1, -1].forEach(function (sd) { c.text("HÍBRIDO", 0.42, 0.09, 1.2, 0.86, sd * (s.W / 2 + 0.012), sd > 0 ? "+z" : "-z", { fg: "#6fb3e6", size: 0.62 }); });
      c.rb(0.1, 0.12, s.W * 0.94, 0.05, MT.trim, rX(s, 0.56) + 0.02, 0.56, 0, { def: true });
      /* friso cromado ligando as lanternas na tampa */
      c.rb(0.025, 0.03, 0.86, 0.01, MT.chrome, rX(s, 0.975) - 0.004, 0.975, 0);
      barrasTeto(c, 0.66, 0.04, 0.016);
      barbatana(c, R + 0.62);
    }, post: function (c, m) {
      colunaB(c, -0.18);
      cintura(c, -0.3, 0.06, col);
      colunaC(c, -1.12, [-1.4, 1.22], c.paint(col));
      bitola(c, 1.559, 1.571);
      var b = m.bay; if (!b) return;
      b.motor = "hibrido";
      var ix = b.x0 + 0.24, iy = b.top - 0.08, L = b.x1 - b.x0;
      c.rb(0.24, 0.09, 0.32, 0.03, CM("#9aa1a6", { metalness: 0.7, roughness: 0.35 }), ix, iy, b.zw * 0.45);
      c.text("ALTA TENSÃO", 0.22, 0.05, ix, iy + 0.047, b.zw * 0.45, "+y", { fg: "#121212", bg: "#f0a01e", w: 512, h: 128, size: 0.55 });
      /* cabos laranja de alta tensão por cima do motor, grossos, até a parede corta-fogo e descendo para a bateria */
      [-0.05, 0.05].forEach(function (dz) {
        c.tube([[ix + 0.1, iy, b.zw * 0.45 + dz], [b.x0 + L * 0.42, b.top - 0.03, b.zw * 0.15 + dz], [b.x0 + L * 0.3, b.top - 0.04, -b.zw * 0.35 + dz], [b.x0 + 0.06, b.top - 0.1, -b.zw * 0.5 + dz], [b.x0 + 0.03, b.floor + 0.05, -b.zw * 0.5 + dz]], 0.02, MT.hv, { seg: 30, rs: 8 });
      });
      c.rb(0.7, 0.18, 1.1, 0.03, CM("#4a4f55", { metalness: 0.5, roughness: 0.5 }), -1.05, m.clear + 0.1, 0);
      c.part("bateria", "Bateria híbrida", null, new V3(-1.05, m.clear + 0.2, 0), 0.9);
      c.zone("bateria", "Bateria híbrida (alta tensão)", [-1.42, -0.68, m.clear - 0.08, m.clear + 0.3, -0.58, 0.58], null, { fxKey: "bateria", sub: "bateria", pos: new V3(-1.05, m.clear + 0.15, 0) });
    } });
    c.meta.armor = suvArmor();
  });

  /* Compas Longitude · Jeep Compass (2ª geração, Brasil 2022+)
     Referência (de memória; tanque e consumo confirmados em moparinsiders.com): comprimento 4,404 m · largura 1,819 m · altura 1,629 m ·
       entre-eixos 2,636 m · bitola ≈ 1,57 m · pneu 225/55 R18 (0,705 m) · balanço dianteiro ≈ 0,88 m e traseiro ≈ 0,89 m ·
       altura do solo ≈ 0,21 m · 1735 kg (diesel 4x4) · tanque 60 L · 10,3 km/L na cidade e 13,5 km/L na estrada.
     Traços de assinatura:
       frente   · grade de sete fendas verticais com moldura cromada em cada fenda, entre faróis finos de LED;
                · tomada inferior larga e faróis de neblina em nichos pretos;
       lateral  · caixas de roda TRAPEZOIDAIS com moldura preta (marca da Jeep), teto flutuante preto;
                · friso cromado na linha de cintura que sobe pela coluna D até o teto;
       traseira · lanternas que dobram a quina, com o "X" desenhado por dentro; friso cromado; para-choque preto;
       teto     · teto e colunas pretos, barras longitudinais.
     Revisão: as sete fendas ficavam 3 cm dentro da lataria (invisíveis); agora são medidas na pele por raio (peleX). */
  ZG.register({ k: "compas", grp: "SUVs", n: "Compas Longitude", insp: "Jeep Compass", c: "SUV médio 4x4 diesel", fuel: "diesel",
    d: "Grade de sete fendas, teto preto e tração 4x4 com diesel. Confortável na estrada e firme na terra.",
    mass: 1735, r: 70, seats: "5", cap: "60 L", eff: "10,3 km/L (cidade) · 13,5 km/L (estrada)", auto: "800 km", vmax: 190, skill: "Direção 1 · tração 4x4", hood: true
  }, function (c) {
    var A = axles(2.636, 0.88, 4.404, 0.07, 0.12), col = "#6b1f24", R = A.R, F = A.F;
    var s = { W: 1.77, col: col, roofCol: "#101112", bottomY: 0.34, noseY: 0.93, tailY: 1.04, noAntenna: true,
      lower: [[R, 0.36, 0.08], [R - 0.03, 0.66, 0.14], [R + 0.07, 1.04, 0.1], [0.98, 1.05, 0], [1.6, 1.0, 0.3], [F - 0.04, 0.94, 0.1], [F, 0.62, 0.15], [F - 0.05, 0.35, 0.08]],
      arches: [[A.xf, 0.3525, 0.405], [A.xr, 0.3525, 0.405]],
      gh: { rb: R + 0.1, rt: R + 0.5, ft: 0.15, fb: 1.0, belt: 1.05, roof: 1.535, Wg: 1.69, k: 0.14, pillars: [-0.16, -1.12], r1: 0.16, r2: 0.2 },
      seams: [1.03, -0.17, -1.11], handles: [0.43, -0.64], plateRearY: 0.78,
      hl: { style: "slim", w: 0.3, h: 0.09, y: 0.86, in: 0.07, yaw: 0.3, dx: 0.03, mat: MT.led }, grille: false,
      tl: { style: "wrap", w: 0.34, h: 0.1, y: 0.975, wrap: 0.2 },
      interior: { rows: 2, col: "#2c2a28", trim: "#19191a" }, hood: { motor: "diesel" },
      wheels: [[A.xf, 0.3525, 0.225, { rim: RIMSIL, spokes: 10 }], [A.xr, 0.3525, 0.225, { rim: RIMSIL, spokes: 10 }]] };
    suvBuild(c, s, { roof: [0.04, -0.2, R + 0.5], flare: { w: 0.075, d: 0.04, trap: true }, pre: function (c, m) {
      ZG.emblem(c, fX(s, 0.97) - 0.03, 0.975, 0, 0.032);
      /* tomada inferior larga e faróis de neblina em nichos */
      c.rb(0.05, 0.16, 1.2, 0.04, MT.trim, fX(s, 0.52) - 0.02, 0.52, 0);
      grade(c, s, "mesh", 1.04, 0.12, 0.52, { x: fX(s, 0.52) - 0.0 });
      neblina(c, s, 0.5, 0.72, 0.033);
      var tx = rX(s, 0.975);
      [1, -1].forEach(function (sd) { c.rb(0.02, 0.012, 0.16, 0.004, MT.tail, tx - 0.05, 0.975, sd * 0.7, { rot: [0.6, 0, 0] }); c.rb(0.02, 0.012, 0.16, 0.004, MT.tail, tx - 0.05, 0.975, sd * 0.7, { rot: [-0.6, 0, 0] }); });
      c.rb(0.025, 0.035, 0.9, 0.01, MT.chrome, tx + 0.0, 0.88, 0);
      c.rb(0.1, 0.13, s.W * 0.95, 0.05, MT.trim, rX(s, 0.56) + 0.02, 0.55, 0, { def: true });
      [1, -1].forEach(function (sd) { c.text("4x4", 0.18, 0.08, -1.9, 0.62, sd * (s.W / 2 + 0.012), sd > 0 ? "+z" : "-z", { fg: "#d0d0d0", size: 0.7 }); });
      barrasTeto(c, 0.64, 0.04, 0.016);
      barbatana(c, R + 0.55);
    }, post: function (c, m, F, low) {
      /* grade de sete fendas entre os faróis (assinatura da Jeep): cada fenda tem moldura cromada e fundo escuro.
         Medida na pele já esculpida: o nariz é arredondado em cima e a fórmula do perfil deixava as fendas 3 cm para dentro da lataria. */
      var gy = 0.83, gh = 0.18, gw = 0.84, xT = peleX(c, low, gy + gh / 2, 0), xB = peleX(c, low, gy - gh / 2, 0), tilt = Math.atan2(xB - xT, gh);
      c.rb(0.03, gh + 0.03, gw + 0.04, 0.012, GLOSS, peleX(c, low, gy, 0) - 0.008, gy, 0, { rot: [0, 0, tilt] });
      for (var i = 0; i < 7; i++) {
        var z = -gw * 0.43 + i * gw * 0.86 / 6, px = peleX(c, low, gy, z);
        c.rb(0.04, gh * 0.92, gw * 0.094, 0.018, MT.chrome, px + 0.002, gy, z, { rot: [0, 0, tilt] });
        c.rb(0.03, gh * 0.78, gw * 0.058, 0.01, MT.housing, px + 0.012, gy, z, { rot: [0, 0, tilt] });
      }
      /* teto flutuante: colunas e moldura da estufa em preto; vigia pequeno; friso cromado na cintura que sobe pela coluna D até o teto */
      cintura(c, -0.35, 0.035, col);
      colunaC(c, -1.12, [-1.36, 1.25]);
      var E = estufa(c), hz = function (y) { return ZG.halfAt(m.gh.Wg, m.T, y) + 0.03; };
      [1, -1].forEach(function (sd) {
        c.tube([[m.gh.fb - 0.08, E.yb - 0.03, sd * hz(E.yb)], [-0.35, E.yb - 0.03, sd * hz(E.yb)], [-1.45, E.yb + 0.01, sd * hz(E.yb)],
          [E.back(E.yb + 0.15) + 0.05, E.yb + 0.15, sd * hz(E.yb + 0.15)], [E.back(E.top - 0.05) + 0.06, E.top - 0.05, sd * hz(E.top - 0.05)]], 0.009, MT.chrome, { seg: 40, rs: 5 });
      });
      bitola(c, 1.57, 1.57);
    } });
    c.meta.armor = suvArmor();
  });

  /* Hylux SW-4 · Toyota SW4 (2021+, Brasil)
     Referência (fichacompleta.com.br, SRX 2.8 2023): comprimento 4,795 m · largura 1,855 m · altura 1,835 m · entre-eixos 2,745 m ·
       bitola ≈ 1,54 m / 1,55 m (de memória) · pneu 265/60 R18 (0,775 m) · balanço dianteiro ≈ 0,88 m e traseiro ≈ 1,17 m (de memória) ·
       altura do solo 0,279 m · 2175 kg · tanque 80 L · 9,8 km/L na cidade e 11,2 km/L na estrada · 180 km/h · 7 lugares.
     Traços de assinatura:
       frente   · grade trapezoidal grande com moldura cromada e barras horizontais, ligada aos faróis finos por barra cromada no capô;
                · para-choque com nichos verticais dos faróis de neblina e protetor prateado embaixo;
       lateral  · caixa alta de chassi de picape, estribos, alargadores nos paralamas;
                · linha de cintura que sobe para trás e vigia que dá um "chute" para cima atrás da porta traseira; coluna D na cor do carro;
       traseira · tampa quase vertical, lanternas horizontais ligadas por barra cromada larga sobre a placa; estepe sob o assoalho;
       teto     · teto reto e comprido com barras altas.
     Revisão: grade própria em trapézio que alarga para baixo, com lâminas (o estilo "big" parecia radiador de caminhão); faróis maiores. */
  ZG.register({ k: "suv", grp: "SUVs", n: "Hylux SW-4", insp: "Toyota SW4", art: "na", c: "SUV 4x4 de 7 lugares", fuel: "diesel",
    d: "Alta, pesada e com chassi de picape. Sete lugares, reduzida e diesel: leva a família inteira para fora da cidade.",
    mass: 2175, r: 75, seats: "7", cap: "80 L", eff: "9,8 km/L (cidade) · 11,2 km/L (estrada)", auto: "800 km", vmax: 180, skill: "Direção 2 (4x4 com reduzida)", hood: true
  }, function (c) {
    var A = axles(2.745, 0.88, 4.795, 0.1, 0.075), col = "#3b4639", R = A.R;
    var s = { W: 1.79, col: col, bottomY: 0.44, noseY: 1.08, tailY: 1.2, noAntenna: true,
      lower: [[A.R, 0.47, 0.08], [A.R - 0.03, 0.8, 0.12], [A.R + 0.05, 1.22, 0.1], [1.0, 1.23, 0], [1.62, 1.16, 0.3], [A.F - 0.06, 1.08, 0.12], [A.F, 0.74, 0.16], [A.F - 0.06, 0.46, 0.08]],
      arches: [[A.xf, 0.3875, 0.45], [A.xr, 0.3875, 0.45]],
      gh: { rb: A.R + 0.07, rt: A.R + 0.28, ft: 0.28, fb: 1.03, belt: 1.22, roof: 1.715, Wg: 1.7, k: 0.11, pillars: [-0.2, -1.38], r1: 0.14, r2: 0.2 },
      seams: [1.06, -0.21, -1.37], handles: [0.44, -0.72], plateRearY: 0.95, tailLightY: 1.12,
      hl: { style: "wedge", w: 0.48, h: 0.15, y: 1.0, in: 0.03, yaw: 0.3, dx: 0.03, mat: MT.led }, grille: false,
      tl: { style: "wrap", w: 0.28, h: 0.13, y: 1.12, wrap: 0.22 },
      interior: { rows: 3, col: "#3a3029", trim: "#1d1b19" }, hood: { motor: "diesel" },
      wheels: [[A.xf, 0.3875, 0.265, { rim: RIMSIL, spokes: 6 }], [A.xr, 0.3875, 0.265, { rim: RIMSIL, spokes: 6 }]] };
    suvBuild(c, s, { flare: { w: 0.08, d: 0.035 }, roof: [0.03, -0.3, A.R + 0.28], pre: function (c, m) {
      /* grade trapezoidal cromada grande, do capô até o para-choque, mais larga embaixo, com lâminas horizontais,
         ligada aos faróis por uma barra cromada (não é a caixa reta de caminhão do estilo "big") */
      var gx = fX(s, 0.82) - 0.012, gy = 0.82, gh = 0.46, gw = 1.08, tz = 0.8;
      c.rb(0.05, gh, gw, 0.04, MT.chrome, gx, gy, 0, { taper: { sz: tz } });
      c.rb(0.056, gh - 0.1, gw - 0.16, 0.02, GLOSS, gx + 0.002, gy, 0, { taper: { sz: tz - 0.02 } });
      [0.13, 0.045, -0.04, -0.125].forEach(function (dy) { var k = (dy + gh / 2 - 0.05) / (gh - 0.1); c.rb(0.06, 0.022, (gw - 0.2) * (1 + (tz - 1) * k), 0.008, MT.chrome, gx + 0.004, gy + dy, 0); });
      c.rb(0.04, 0.04, 1.32, 0.015, MT.chrome, fX(s, 1.04) - 0.03, 1.04, 0);
      ZG.emblem(c, fX(s, 0.9) + 0.03, 0.9, 0, 0.06);
      neblina(c, s, 0.62, 0.74, 0.04);
      c.rb(0.06, 0.06, 0.9, 0.02, MT.alu, fX(s, 0.5) + 0.07, 0.5, 0);
      var tx = rX(s, 1.12);
      c.rb(0.03, 0.05, 0.86, 0.012, MT.chrome, tx + 0.005, 1.12, 0);
      c.rb(0.03, 0.04, 0.12, 0.012, MT.chrome, rX(s, 0.86), 0.86, 0);
      estribo(c, A.xr + 0.5, A.xf - 0.5, 0.42, s.W, -0.035);
      barrasTeto(c, 0.66, 0.06, 0.018);
      barbatana(c, R + 0.5);
    }, post: function (c, m) {
      /* linha de cintura que sobe 8 cm para trás e vigia traseiro com "chute" para cima; coluna D na cor do carro */
      colunaB(c, -0.2);
      cintura(c, -0.3, 0.08, col);
      colunaC(c, -1.38, [-2.0, 1.44], c.paint(col));
      bitola(c, 1.54, 1.55);
      var sp = c.wheel(A.R + 0.45, 0, 0.36, 0.25, { noPart: true, y: 0.3 }); sp.rotation.x = PI / 2; sp.position.set(A.R + 0.45, 0.3, 0); c.wheels.pop();
      c.part("estepe", "Estepe", sp, new V3(A.R + 0.45, 0.3, 0), 0.5);
    }, sculpt: { tuck: 0.04 } });
    c.meta.armor = suvArmor();
  });

  /* ================= picapes ================= */
  function picapeBuild(c, s, o) {
    var n0 = c.deform.length;
    ZG.car(c, s);
    var low = c.deform[n0], m = c.meta, extra = [];
    cacamba(c, { low: low, x0: m.rear + 0.06, x1: o.bedFront, floor: o.floor, top: s.gh.belt, W: s.W, arches: s.arches });
    if (o.flares !== false) extra = extra.concat(paralama(c, s.arches, s.W, s.bottomY, o.flare));
    if (o.pre) o.pre(c, m, extra);
    var F = esculpir(c, Object.assign({ low: low, extra: extra, pr: 0.03, bowR: 0.02 }, o.sculpt || {}));
    var tx = rX(s, o.floor + 0.25);
    c.rb(0.012, 0.014, s.W * 0.86, 0.004, MT.dark, tx + 0.002, o.floor + 0.02, 0);
    if (o.handle !== false) c.rb(0.03, 0.05, 0.22, 0.012, MT.trim, tx - 0.008, s.gh.belt - 0.1, 0);
    if (o.post) o.post(c, m, F);
    acabamento(c);
    zonasPicape(c);
    return low;
  }
  function santoAntonio(c, x, yb, yt, z, mat) {
    var ms = [];
    [z, -z].forEach(function (zz) { ms.push(c.rod(new V3(x, yb, zz), new V3(x, yt - 0.06, zz * 0.95), 0.032, mat), c.rod(new V3(x, yb + 0.12, zz), new V3(x - 0.42, yb, zz), 0.026, mat)); });
    ms.push(c.tube([[x, yt - 0.08, -z * 0.95], [x, yt, -z * 0.7], [x, yt, z * 0.7], [x, yt - 0.08, z * 0.95]], 0.032, mat, { seg: 24 }));
    c.part("santoantonio", "Santo-antônio", null, new V3(x, yt - 0.1, 0), 0.6);
    /* zona própria: entorta, pende e some como peça solta */
    c.zone("santoantonio", "Santo-antônio", [x - 0.5, x + 0.08, yb - 0.05, yt + 0.06, -z - 0.08, z + 0.08], ms, { type: "peca", fx: ["Nenhum", "Só estético", "Arco torto: não segura carga amarrada", "Arco solto pendurado: corta quem pular na caçamba", "Sem santo-antônio"], dir: "cima", w: 0.3 });
    return ms;
  }
  /* Zonas de picape: as laterais de trás são a caçamba */
  function zonasPicape(c) {
    c.zone("lateral_te", "Lateral da caçamba esquerda", null, null, { fxKey: "cacamba" });
    c.zone("lateral_td", "Lateral da caçamba direita", null, null, { fxKey: "cacamba" });
    c.zone("cacamba", "Tampa e assoalho da caçamba");
  }
  function picapeArmor(c) { ZG.applyArmor(c); gaiolaCacamba(c); var m = c.meta; if (m.gh) snorkel(c, m.gh.fb + 0.25, m.clear + 0.45, m.top - 0.05, m.W / 2 + 0.03, m.gh.ft + 0.1); }

  /* Estrada Cabine Dupla · Fiat Strada (2020+, cabine dupla)
     Referência (garagem360.com.br, Ranch/Freedom 2024; comprimento da cabine dupla de memória): comprimento 4,474 m · largura 1,732 m ·
       altura 1,601 m · entre-eixos 2,737 m · bitola ≈ 1,49 m (de memória) · pneu 205/60 R16 (0,652 m) · balanço dianteiro ≈ 0,80 m e
       traseiro ≈ 0,94 m · altura do solo ≈ 0,185 m · 1135 a 1253 kg · tanque 55 L · 12,5 km/L (G) e 8,9 km/L (E) na cidade.
     Traços de assinatura:
       frente   · faróis finos e horizontais com filete de LED, unidos por uma barra preta com o nome no meio;
                · capô curto e caído; grade inferior larga em colmeia; faróis de neblina redondos nas pontas;
       lateral  · cabine dupla curta com porta traseira estreita, caçamba curta e baixa, santo-antônio preto;
                · molduras pretas finas nas caixas de roda; linha de cintura reta;
       traseira · lanternas verticais estreitas nas quinas, tampa com o nome em relevo e maçaneta preta no alto;
       teto     · teto curto, para-brisa bem inclinado. */
  ZG.register({ k: "strada", grp: "Picapes e bigfoot", n: "Estrada Cabine Dupla", insp: "Fiat Strada", art: "na", c: "Picape compacta", fuel: "flex",
    d: "A picape mais vendida do país: leve, econômica e com caçamba para 650 kg. Não tem 4x4, mas acha peça em qualquer cidade.",
    mass: 1135, r: 60, seats: "5", cap: "55 L", eff: "12,5 km/L (G) · 8,9 km/L (E)", auto: "690 km", vmax: 171, skill: "Direção 1", hood: true
  }, function (c) {
    var A = axles(2.737, 0.8, 4.474, 0.07, 0.07), col = "#a4321f";
    /* capô curto e caído, frente baixa com faróis finos ligados por barra preta, grade fina em colmeia; caçamba curta e baixa */
    var s = { W: 1.715, col: col, bottomY: 0.33, noseY: 0.78, tailY: 0.98,
      lower: [[A.R, 0.35, 0.06], [A.R - 0.02, 0.98, 0.06], [1.08, 1.0, 0], [1.62, 0.9, 0.3], [A.F - 0.09, 0.78, 0.12], [A.F, 0.55, 0.15], [A.F - 0.05, 0.33, 0.08]],
      arches: [[A.xf, 0.326, 0.38], [A.xr, 0.326, 0.38]],
      gh: { rb: -0.96, rt: -0.9, ft: 0.32, fb: 1.1, belt: 1.0, roof: 1.545, Wg: 1.6, k: 0.14, pillars: [-0.03], r1: 0.1, r2: 0.2 },
      seams: [1.04, -0.04, -0.97], handles: [0.42, -0.5], plateRearY: 0.77, tailLightY: 0.82,
      hl: { style: "slim", w: 0.36, h: 0.075, y: 0.725, in: 0.045, yaw: 0.28, dx: 0.03, mat: MT.led }, grille: false,
      tl: { style: "vertical", w: 0.09, h: 0.3, y: 0.82, in: 0.0 },
      interior: { rows: 2, col: "#2c2d30", trim: "#1a1b1d" }, hood: { motor: "gasolina" },
      wheels: [[A.xf, 0.326, 0.205, { rim: RIMGUN, spokes: 5 }], [A.xr, 0.326, 0.205, { rim: RIMGUN, spokes: 5 }]] };
    picapeBuild(c, s, { bedFront: -1.02, floor: 0.62, flare: { w: 0.05, d: 0.03 }, pre: function (c, m) {
      c.rb(0.05, 0.07, 0.96, 0.02, GLOSS, fX(s, 0.725) - 0.015, 0.725, 0);
      ZG.emblem(c, fX(s, 0.725) + 0.012, 0.725, 0, 0.032);
      c.rb(0.04, 0.15, 0.86, 0.03, MT.trim, fX(s, 0.6) - 0.02, 0.6, 0);
      grade(c, s, "mesh", 0.8, 0.11, 0.6, { x: fX(s, 0.6) - 0.005 });
      neblina(c, s, 0.46, 0.64, 0.03);
      santoAntonio(c, -1.08, 1.0, 1.32, 0.72, MT.trim);
    }, post: function (c, m) {
      var tx = rX(s, 0.9);
      c.text("ESTRADA", 0.34, 0.06, tx - 0.008, 0.9, 0.42, "-x", { fg: "#d7d9db", size: 0.7 });
      bitola(c, 1.49, 1.5);
    } });
    c.meta.armor = picapeArmor;
  });

  /* Touro Ultra · Fiat Toro (2022+, diesel 4x4)
     Referência (fichacompleta.com.br, Freedom 2.0 diesel 2022): comprimento 4,945 m · largura 1,845 m · altura 1,735 m · entre-eixos 2,990 m ·
       bitola 1,547 m / 1,575 m · pneu 225/65 R17 (0,724 m) · balanço dianteiro ≈ 0,94 m e traseiro ≈ 1,02 m (de memória) ·
       altura do solo 0,234 m · 1906 kg · tanque 60 L · 10,1 km/L na cidade e 12,6 km/L na estrada · 193 km/h · caçamba 937 L.
     Traços de assinatura:
       frente   · farol dividido em dois andares: DRL fino em LED na linha do capô e farol principal escuro, recuado, no para-choque;
                · grade fina entre os DRLs com friso cromado e grade inferior larga em colmeia;
       lateral  · frente de SUV inclinada, cabine alta, caçamba integrada à carroceria (sem degrau), molduras pretas nas rodas;
       traseira · tampa BIPARTIDA que abre como porta (divisão vertical no meio, duas maçanetas), lanternas horizontais que dobram a quina;
       teto     · para-brisa bem inclinado e teto curto.
     Revisão: traseira da cabine inclinada (rt -0,9), coluna B preta e DRL mais visível. */
  ZG.register({ k: "touro", grp: "Picapes e bigfoot", n: "Touro Ultra", insp: "Fiat Toro", art: "na", c: "Picape média 4x4 diesel", fuel: "diesel",
    d: "Picape com jeito de SUV: farol dividido em dois andares, tampa traseira que abre como porta e diesel 4x4.",
    mass: 1906, r: 70, seats: "5", cap: "60 L", eff: "10,1 km/L (cidade) · 12,6 km/L (estrada)", auto: "610 a 750 km", vmax: 193, skill: "Direção 1 · tração 4x4", hood: true
  }, function (c) {
    var A = axles(2.99, 0.94, 4.945, 0.07, 0.08), col = "#d6d4ce";
    /* frente de SUV inclinada; farol em dois andares: DRL fino e branco na linha do capô, farol principal escuro recuado no para-choque; tampa bipartida */
    var s = { W: 1.82, col: col, bottomY: 0.4, noseY: 0.98, tailY: 1.12,
      lower: [[A.R, 0.43, 0.08], [A.R - 0.03, 1.12, 0.08], [1.1, 1.13, 0], [1.75, 1.05, 0.34], [A.F - 0.1, 0.98, 0.12], [A.F - 0.02, 0.78, 0.12], [A.F, 0.6, 0.14], [A.F - 0.05, 0.42, 0.08]],
      arches: [[A.xf, 0.362, 0.42], [A.xr, 0.362, 0.42]],
      gh: { rb: -1.08, rt: -0.9, ft: 0.34, fb: 1.14, belt: 1.13, roof: 1.68, Wg: 1.72, k: 0.13, pillars: [-0.06], r1: 0.1, r2: 0.24 },
      seams: [1.16, -0.07, -1.09], handles: [0.5, -0.56], plateRearY: 0.86, tailLightY: 1.0,
      hl: { style: "slim", w: 0.5, h: 0.05, y: 0.95, in: 0.02, yaw: 0.3, dx: 0.03, mat: MT.led }, grille: false,
      tl: { style: "wrap", w: 0.36, h: 0.09, y: 1.0, wrap: 0.16 },
      interior: { rows: 2, col: "#4a3a2e", trim: "#1d1b19" }, hood: { motor: "diesel" },
      wheels: [[A.xf, 0.362, 0.225, { rim: RIMDARK, spokes: 6 }], [A.xr, 0.362, 0.225, { rim: RIMDARK, spokes: 6 }]] };
    picapeBuild(c, s, { bedFront: -1.14, floor: 0.72, handle: false, flare: { w: 0.065, d: 0.035 }, pre: function (c, m) {
      /* nichos escuros no para-choque com o farol principal recuado */
      [1, -1].forEach(function (sd) {
        var hx = fX(s, 0.72), z = sd * (s.W / 2 - 0.27);
        c.rb(0.05, 0.19, 0.4, 0.05, GLOSS, hx - 0.02, 0.72, z, { rot: [0, sd * 0.2, 0] });
        ZG.headlight(c, { style: "rect", x: hx - 0.005, y: 0.72, z: z, w: 0.3, h: 0.11, side: sd, yaw: 0.2, lens: CM("#9fb0b8", { roughness: 0.03, transparent: true, opacity: 0.25, depthWrite: false }), label: "Farol principal " + (sd > 0 ? "direito" : "esquerdo") });
      });
      /* grade entre os DRLs (fina, cor do carro com friso) e grade inferior larga em colmeia */
      c.rb(0.05, 0.09, 0.82, 0.03, GLOSS, fX(s, 0.9) - 0.02, 0.9, 0);
      c.rb(0.03, 0.016, 0.9, 0.006, MT.chrome, fX(s, 0.945) - 0.012, 0.945, 0);
      ZG.emblem(c, fX(s, 0.9) + 0.01, 0.9, 0, 0.04);
      c.rb(0.05, 0.2, 0.86, 0.04, MT.trim, fX(s, 0.56) - 0.02, 0.56, 0);
      grade(c, s, "mesh", 0.78, 0.16, 0.56, { x: fX(s, 0.56) - 0.005 });
      [1, -1].forEach(function (sd) { c.text("4x4", 0.18, 0.08, -0.5, 0.6, sd * (s.W / 2 + 0.012), sd > 0 ? "+z" : "-z", { fg: "#2a2a2a", size: 0.7 }); });
    }, post: function (c, m) {
      /* tampa traseira que abre como porta: divisão vertical marcada e duas maçanetas */
      colunaB(c, -0.06);
      var tx = rX(s, 0.9);
      c.rb(0.02, 0.46, 0.018, 0.005, MT.dark, tx + 0.006, 0.93, 0);
      [1, -1].forEach(function (sd) { c.rb(0.03, 0.04, 0.12, 0.012, MT.chrome, tx - 0.008, 1.02, sd * 0.1); });
      c.rb(0.03, 0.035, 0.5, 0.012, CM("#3a3c3e", { metalness: 0.6, roughness: 0.3 }), tx - 0.006, 0.76, 0);
      bitola(c, 1.547, 1.575);
    } });
    c.meta.armor = picapeArmor;
  });

  /* Hylux Cabine Dupla · Toyota Hilux (8ª geração, 2021+)
     Referência (fichacompleta.com.br, SRX 2.8 CD 2023; medidas, solo, pneu, massa, tanque e consumo reconferidos na revisão): comprimento 5,325 m · largura 1,855 m · altura 1,815 m · entre-eixos 3,085 m ·
       bitola ≈ 1,535 m / 1,55 m (de memória) · pneu 265/60 R18 (0,775 m) · balanço dianteiro ≈ 0,93 m e traseiro ≈ 1,31 m (de memória) ·
       altura do solo 0,286 m · 2090 kg · tanque 80 L · 10,1 km/L na cidade e 11,3 km/L na estrada · 180 km/h · caçamba 1000 L.
     Traços de assinatura:
       frente   · grade trapezoidal escura e alta com moldura cromada grossa que desce até o para-choque, barra cromada ligando os faróis finos;
                · nichos verticais pretos dos faróis de neblina nas pontas do para-choque;
       lateral  · capô longo e reto, cabine dupla com porta traseira larga, caçamba separada (fresta entre cabine e caçamba), estribos;
                · alargadores nas caixas de roda, pneus que enchem os arcos;
       traseira · lanternas verticais altas nas quinas, tampa com o nome em relevo, para-choque cromado com degrau;
       teto     · teto reto e curto; santo-antônio cromado sobre a caçamba.
     Revisão: a grade passou a alargar para baixo (antes era mais larga em cima) e a placa dianteira foi para a frente da moldura. */
  ZG.register({ k: "picape", grp: "Picapes e bigfoot", n: "Hylux Cabine Dupla", insp: "Toyota Hilux", art: "na", c: "Picape média 4x4 diesel", fuel: "diesel",
    d: "A favorita dos sobreviventes: chassi forte, reduzida, santo-antônio e caçamba para uma tonelada.",
    mass: 2090, r: 75, seats: "5", cap: "80 L", eff: "10,1 km/L (cidade) · 11,3 km/L (estrada)", auto: "800 km", vmax: 180, skill: "Direção 2 (4x4 com reduzida)", hood: true
  }, function (c) {
    var A = axles(3.085, 0.93, 5.325, 0.07, 0.17), col = "#9a9283";
    /* capô longo e reto, frente alta e vertical, grade trapezoidal escura com moldura cromada grossa até o para-choque; pneus all-terrain enchendo os arcos */
    var s = { W: 1.795, col: col, bottomY: 0.46, noseY: 1.07, tailY: 1.18,
      lower: [[A.R, 0.5, 0.06], [A.R - 0.02, 1.2, 0.06], [1.05, 1.21, 0], [1.7, 1.14, 0.3], [A.F - 0.05, 1.07, 0.12], [A.F, 0.72, 0.16], [A.F - 0.06, 0.48, 0.08]],
      arches: [[A.xf, 0.3875, 0.45], [A.xr, 0.3875, 0.45]],
      gh: { rb: -1.12, rt: -1.06, ft: 0.36, fb: 1.1, belt: 1.2, roof: 1.755, Wg: 1.72, k: 0.1, pillars: [-0.06], r1: 0.08, r2: 0.18 },
      seams: [1.12, -0.07, -1.13], handles: [0.5, -0.58], plateRearY: 0.98, tailLightY: 0.99,
      hl: { style: "wedge", w: 0.4, h: 0.15, y: 1.0, in: 0.075, yaw: 0.3, dx: 0.045, mat: MT.led }, grille: false,
      tl: { style: "vertical", w: 0.1, h: 0.38, y: 0.99, in: 0.0 },
      interior: { rows: 2, col: "#2e2a26", trim: "#1b1a19" }, hood: { motor: "diesel" },
      wheels: [[A.xf, 0.3875, 0.265, { rim: RIMSIL, spokes: 6 }], [A.xr, 0.3875, 0.265, { rim: RIMSIL, spokes: 6 }]] };
    picapeBuild(c, s, { bedFront: -1.2, floor: 0.8, flare: { w: 0.09, d: 0.035 }, pre: function (c, m) {
      /* boca trapezoidal que alarga para baixo até os cantos do para-choque (Hilux 2021) */
      var gx = fX(s, 0.8) - 0.012, gy = 0.8, gw = 1.14, gh = 0.52;
      var fr = c.rb(0.05, gh, gw, 0.04, MT.chrome, gx, gy, 0, { taper: { sz: 0.84 } });
      c.rb(0.056, gh - 0.12, gw - 0.16, 0.02, GLOSS, gx + 0.002, gy - 0.01, 0, { taper: { sz: 0.82 } });
      [0.12, -0.02, -0.14].forEach(function (dy) { c.rb(0.06, 0.03, (gw - 0.22) * (1 - (dy + 0.2) * 0.4), 0.01, MT.housing, gx + 0.004, gy + dy, 0); });
      c.rb(0.04, 0.05, 1.3, 0.02, MT.chrome, fX(s, 1.04) - 0.03, 1.04, 0);
      ZG.emblem(c, gx + 0.035, gy + 0.06, 0, 0.06);
      [1, -1].forEach(function (sd) { c.rb(0.05, 0.22, 0.12, 0.02, GLOSS, fX(s, 0.6) + 0.0, 0.62, sd * 0.78); });
      neblina(c, s, 0.6, 0.78, 0.038);
      santoAntonio(c, -1.27, 1.2, 1.56, 0.78, MT.chrome);
      /* fresta entre a cabine e a caçamba (chassi de longarina) */
      [1, -1].forEach(function (sd) { c.rb(0.022, s.gh.belt - 0.5, 0.01, 0.004, MT.dark, -1.205, (s.gh.belt + 0.5) / 2 + 0.02, sd * (s.W / 2 + 0.003)); });
      estribo(c, A.xr + 0.52, A.xf - 0.52, 0.44, s.W, -0.035);
      [1, -1].forEach(function (sd) { c.text("4x4", 0.2, 0.09, -2.4, 0.95, sd * (s.W / 2 + 0.012), sd > 0 ? "+z" : "-z", { fg: "#222", size: 0.7 }); });
    }, post: function (c, m) {
      /* para-choque traseiro cromado com degrau (cromo claro: a cena não tem mapa de ambiente) */
      /* placa dianteira na frente da moldura da grade (senão a borda cromada corta a placa ao meio) */
      var gfx = fX(s, 0.8) + 0.04;
      c.g.children.forEach(function (o) { if (o.isMesh && o.geometry.type === "PlaneGeometry" && Math.abs(o.rotation.y - PI / 2) < 0.01 && o.position.x > 1.5 && o.material.map && o.material.map.image && o.material.map.image.width === 400) o.position.x = Math.max(o.position.x, gfx); });
      var bx = rX(s, 0.6);
      c.rb(0.16, 0.2, s.W + 0.02, 0.06, CM("#c3c7ca", { metalness: 0.55, roughness: 0.28 }), bx - 0.04, 0.58, 0, { def: true });

      c.rb(0.12, 0.03, 0.5, 0.01, CM("#1b1c1d", { roughness: 0.9 }), bx - 0.06, 0.695, 0);
      c.text("HYLUX", 0.34, 0.07, rX(s, 1.08) - 0.008, 1.08, 0, "-x", { fg: "#2a2a2a", size: 0.75 });
      bitola(c, 1.535, 1.55);
    } });
    c.meta.armor = picapeArmor;
  });

  /* Bigfut · monster truck Bigfoot (Bigfoot moderno de competição, carroceria de Ford F-250 1979)
     Referência (en.wikipedia.org/wiki/Bigfoot_(truck) para os pneus de 66"; o resto de memória, regulamento de monster truck):
       pneu 66" = 1,68 m (largura ≈ 0,9 m) · largura total ≈ 3,7 m (12,5 pés, nos pneus) · altura ≈ 3,4 m · comprimento ≈ 5,5 m ·
       entre-eixos ≈ 3,1 m · bitola ≈ 2,8 m · carroceria de fibra ≈ 5,3 m × 2,0 m · ≈ 5400 kg · V8 de bloco grande com blower, metanol.
     Traços de assinatura:
       frente   · cara de picape Ford 1979: grade de barras com faróis redondos, para-choque cromado reto, quatro faróis no teto;
       lateral  · carroceria azul com faixa branca e o nome grande na lateral, alta acima de pneus de trator;
                · suspensão de quatro barras vermelha com amortecedores e molas amarelas à mostra, escapamentos cromados saindo do paralama;
       traseira · caçamba aberta, lanternas verticais, chassi tubular e diferenciais à mostra;
       teto     · blower cromado saindo do capô, gaiola tubular vermelha dentro da cabine. */
  ZG.register({ k: "bigfoot", grp: "Picapes e bigfoot", n: "Bigfut", insp: "monster truck Bigfoot", art: "no", c: "Monster truck", fuel: "etanol",
    d: "Carroceria de picape antiga em cima de pneus de 1,68 m. Passa por cima de carros, muros e hordas. O V8 com blower acorda a cidade inteira.",
    mass: 5400, r: 220, seats: "1", cap: "120 L", eff: "0,7 km/L", auto: "80 km", vmax: 110, skill: "Direção 3 (monster truck)", hood: true
  }, function (c) {
    var col = "#1f4fa3", W = 2.0, xa = 1.55, wr = 0.836, tr = 0.79, wz = 1.38, ww = 0.9; /* wr = altura do cubo; tr = raio do pneu (as garras somam 4,6 cm) */
    var s = { W: W, col: col, bottomY: 1.55, noseY: 2.22, tailY: 2.25,
      lower: [[-2.7, 1.58, 0.05], [-2.72, 2.25, 0.05], [0.95, 2.26, 0], [1.2, 2.24, 0.12], [2.45, 2.22, 0.08], [2.5, 1.9, 0.08], [2.47, 1.57, 0.05]],
      arches: [[xa, wr, 0.95], [-xa, wr, 0.95]],
      gh: { rb: -0.36, rt: -0.32, ft: 0.62, fb: 0.98, belt: 2.25, roof: 2.86, Wg: 1.86, k: 0.06, pillars: [], r1: 0.06, r2: 0.1 },
      seams: [0.92, -0.33], handles: [-0.1], plateRearY: 1.85, tailLightY: 2.06, noAntenna: true,
      hl: { style: "round", w: 0.2, h: 0.2, y: 2.03, in: 0.12, yaw: 0 }, grille: { style: "bars", w: 1.0, h: 0.3, y: 2.0 },
      tl: { style: "vertical", w: 0.12, h: 0.28, y: 2.06, in: 0.0 },
      interior: { rows: 1, col: "#202224", trim: "#141516", front: "bench" }, hood: { motor: "v8" }, wheels: [] };
    var n0 = c.deform.length;
    ZG.car(c, s);
    var low = c.deform[n0], m = c.meta;
    cacamba(c, { low: low, x0: m.rear + 0.06, x1: -0.42, floor: 1.78, top: 2.25, W: W, arches: [] });
    c.rb(0.08, 0.08, W + 0.1, 0.03, MT.chrome, m.front + 0.06, 1.72, 0);
    var stripe = c.paint("#e9e7e1");
    var ex = [];
    [1, -1].forEach(function (sd) { ex.push(c.rb(4.6, 0.08, 0.01, 0.004, stripe, -0.15, 2.17, sd * (W / 2 + 0.006), { sub: 0.15 })); });
    esculpir(c, { low: low, extra: ex, tuck: 0.02, sh: 0.03, pf: 0.03, bowF: 0.03, pr: 0.02, bowR: 0.01 });
    [1, -1].forEach(function (sd) { c.text("BIGFUT", 1.1, 0.26, -1.55, 1.93, sd * (W / 2 + 0.014), sd > 0 ? "+z" : "-z", { fg: "#f2f0ea", size: 0.8 }); });
    /* chassi tubular, eixos rígidos, quatro barras e amortecedores */
    var frame = CM("#d8d4c8", { metalness: 0.4, roughness: 0.45 }), red = CM("#b3261e", { metalness: 0.3, roughness: 0.45 }), rim = CM("#d9dbdc", { metalness: 0.85, roughness: 0.25 });
    [0.48, -0.48].forEach(function (z) { c.rod(new V3(-2.55, 1.32, z), new V3(2.35, 1.32, z), 0.06, frame); c.rod(new V3(-2.2, 1.32, z), new V3(-2.2, 1.55, z), 0.04, frame); c.rod(new V3(2.0, 1.32, z), new V3(2.0, 1.55, z), 0.04, frame); });
    [-2.2, -0.9, 0.4, 2.0].forEach(function (x) { c.rod(new V3(x, 1.32, -0.48), new V3(x, 1.32, 0.48), 0.045, frame); });
    [xa, -xa].forEach(function (x) {
      var sg = x > 0 ? 1 : -1;
      c.rod(new V3(x, wr, -wz + 0.3), new V3(x, wr, wz - 0.3), 0.085, MT.steel);
      c.sph(0.26, MT.steel, x, wr, 0.12, 1, 1, 0.85);
      c.cyl(0.11, 0.11, 0.3, MT.steel, x - sg * 0.3, wr, 0.12, "x");
      [0.45, -0.45].forEach(function (z) {
        c.rod(new V3(x, wr - 0.12, z), new V3(x - sg * 1.05, 1.28, z * 1.05), 0.04, red);
        c.rod(new V3(x, wr + 0.14, z * 0.6), new V3(x - sg * 0.95, 1.36, z * 0.4), 0.035, red);
      });
      [1, -1].forEach(function (zs) {
        [-0.22, 0.22].forEach(function (dx) {
          var b = new V3(x + dx, wr + 0.08, zs * 0.78), t = new V3(x + dx * 2.6, 1.52, zs * 0.66);
          c.rod(b, b.clone().lerp(t, 0.55), 0.055, MT.chrome); c.rod(b.clone().lerp(t, 0.45), t, 0.04, red);
          for (var k = 0; k < 7; k++) { var q = b.clone().lerp(t, 0.12 + k * 0.1), tr = c.add(new THREE.TorusGeometry(0.075, 0.012, 6, 16), CM("#e0b81c", { roughness: 0.4 }), q.x, q.y, q.z); tr.quaternion.setFromUnitVectors(new V3(0, 0, 1), t.clone().sub(b).normalize()); }
        });
        c.rb(0.6, 0.08, 0.3, 0.02, frame, x, 1.5, zs * 0.66);
        c.part("suspensao", "Suspensão " + (x > 0 ? "dianteira " : "traseira ") + (zs > 0 ? "direita" : "esquerda"), null, new V3(x, 1.1, zs * 0.78), 0.6);
        var wg = c.wheel(x, zs * wz, tr, ww, { y: wr, lugs: true, chevron: true, rim: rim, rimR: 0.5, spokes: 8, label: "Pneu " + (x > 0 ? "dianteiro " : "traseiro ") + (zs > 0 ? "direito" : "esquerdo") });
        /* aro de disco cheio com beadlock cromado aparafusado, rente ao flanco do pneu */
        var rr = tr * 0.5, fz = zs * (ww / 2 - 0.05);
        var disc = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.97, rr * 0.97, 0.03, 32), CM("#2b2e31", { metalness: 0.6, roughness: 0.35 })); disc.rotation.x = PI / 2; disc.position.z = fz; wg.add(disc);
        var bead = new THREE.Mesh(new THREE.TorusGeometry(rr * 0.98, 0.04, 10, 40), rim); bead.position.z = fz + zs * 0.02; wg.add(bead);
        for (var bn = 0; bn < 16; bn++) { var ba = bn / 16 * PI * 2, bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6), MT.chrome); bolt.rotation.x = PI / 2; bolt.position.set(Math.cos(ba) * rr * 0.98, Math.sin(ba) * rr * 0.98, fz + zs * 0.055); wg.add(bolt); }
        for (var sk = 0; sk < 6; sk++) { var sa = sk / 6 * PI * 2, hole = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.13, rr * 0.13, 0.034, 14), MT.hole); hole.rotation.x = PI / 2; hole.position.set(Math.cos(sa) * rr * 0.58, Math.sin(sa) * rr * 0.58, fz + zs * 0.002); wg.add(hole); }
        var hub = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.3, rr * 0.34, 0.08, 20), rim); hub.rotation.x = PI / 2; hub.position.z = fz + zs * 0.03; wg.add(hub);
      });
    });
    /* escapamentos laterais saindo dos paralamas, gaiola dentro da cabine e faróis de teto */
    [1, -1].forEach(function (sd) {
      for (var k = 0; k < 4; k++) c.tube([[1.75 - k * 0.12, 1.9, sd * 0.55], [1.7 - k * 0.12, 1.8, sd * 0.95], [1.55 - k * 0.12, 2.0, sd * 1.06], [1.45 - k * 0.12, 2.4, sd * 1.08]], 0.035, MT.chrome, { seg: 20, rs: 8 });
      c.rod(new V3(0.85, 2.3, sd * 0.82), new V3(0.6, 2.8, sd * 0.78), 0.035, red);
      c.rod(new V3(-0.25, 2.3, sd * 0.82), new V3(-0.25, 2.8, sd * 0.78), 0.035, red);
      c.rod(new V3(0.6, 2.8, sd * 0.78), new V3(-0.25, 2.8, sd * 0.78), 0.035, red);
    });
    c.rod(new V3(0.6, 2.8, -0.78), new V3(0.6, 2.8, 0.78), 0.035, red); c.rod(new V3(-0.25, 2.8, -0.78), new V3(-0.25, 2.8, 0.78), 0.035, red);
    c.rod(new V3(-0.25, 2.3, -0.8), new V3(-0.25, 2.8, 0.78), 0.03, red);
    var noTeto = [c.rb(0.16, 0.05, 1.3, 0.02, MT.trim, 0.42, m.top + 0.08, 0)];
    [-0.48, -0.16, 0.16, 0.48].forEach(function (z) { noTeto.push(ZG.headlight(c, { style: "round", x: 0.5, y: m.top + 0.2, z: z, w: 0.17, h: 0.17, d: 0.1, side: z > 0 ? 1 : -1, label: "Farol de teto", reach: 0.4 }).g); });
    /* suporte dos faróis de teto: é o ponto mais alto, entra na caixa da capotagem (a cabine não afunda no chão) */
    var hoop = c.tube([[0.62, m.top - 0.02, -0.66], [0.62, m.top + 0.33, -0.62], [0.62, m.top + 0.33, 0.62], [0.62, m.top - 0.02, 0.66]], 0.028, MT.steel, { seg: 24, rs: 8 });
    c.deform.push(hoop); noTeto.push(hoop);
    /* zonas de batida na altura e na largura reais da carroceria (as rodas ficam bem para fora) */
    var top0 = m.top;
    m.W = W; m.bodyH = 0.95; m.roof.w = 1.5; m.top = top0 + 0.33;
    acabamento(c, noTeto);
    zonasPicape(c);
    /* faróis: os dois da grade numa zona por lado e os quatro do teto numa zona própria */
    var fGrade = c.lights.filter(function (L) { return L.kind === "farol" && L.g && L.g.position.x > 2; }), fTeto = c.lights.filter(function (L) { return L.kind === "farol" && L.g && L.g.position.y > top0; });
    c.zone("farol_d", false); c.zone("farol_e", false); c.zone("farol_c", false);
    [1, -1].forEach(function (sd) {
      var L = fGrade.filter(function (q) { return Math.sign(q.g.position.z) === sd; });
      c.zone("farol_grade_" + (sd > 0 ? "d" : "e"), "Farol " + (sd > 0 ? "direito" : "esquerdo"), [2.3, 2.62, 1.85, 2.2, sd > 0 ? 0.4 : -0.95, sd > 0 ? 0.95 : -0.4], L, { type: "luz", fxKey: "farol", side: sd });
    });
    c.zone("farois_teto", "Faróis de teto", [0.32, 0.68, top0 + 0.05, top0 + 0.45, -0.7, 0.7], fTeto, { type: "luz", fxKey: "farol", dir: "cima" });
    var bpt = c.parts.find(function (p) { return p.obj === m.bumperF; }), bptR = c.parts.find(function (p) { return p.obj === m.bumperR; });
    [bpt, bptR].forEach(function (pt) { apos(pt, function (c, p0) { var o = p0.obj; if (o && o.userData.hung && o.parent && o.parent !== c.g) { o.parent.rotation.x = clamp(o.parent.rotation.x, -0.22, 0.22); o.parent.rotation.y = clamp(o.parent.rotation.y, -0.08, 0.08); } }); });
    c.parts.filter(function (p) { return p.kind === "motor" || p.kind === "capo"; }).forEach(function (pt) { apos(pt, function (c) { if (c.hood) c.hood.latch = Math.min(c.hood.latch, 0.05); }); });
    m.armor = function (c) {
      var mm = c.meta, tKeep = mm.top; mm.top = top0; ZG.applyArmor(c); mm.top = tKeep;
      var spk = CM("#8a8e8a", { metalness: 0.7, roughness: 0.35 });
      [xa, -xa].forEach(function (x) { [1, -1].forEach(function (zs) { var sp = c.add(new THREE.ConeGeometry(0.07, 0.35, 12), spk, x, wr, zs * (wz + ww / 2 + 0.17)); sp.rotation.x = zs * PI / 2; }); });
      c.rb(0.14, 0.7, 2.6, 0.05, ZG.STEELM, mm.front + 0.55, 1.2, 0, { rot: [0, 0, 0.35] });
      for (var i = 0; i < 6; i++) { var cn = c.add(new THREE.ConeGeometry(0.05, 0.4, 10), spk, mm.front + 0.78, 1.05 + (i % 2) * 0.3, -1.1 + i * 0.44); cn.rotation.z = -PI / 2; }
    };
  });

  /* ================= vans ================= */
  /* Sprinta Furgão · Mercedes-Benz Sprinter furgão longo teto alto (3ª geração, 2019+)
     Referência (fichacompleta.com.br, Sprinter Furgão 315 Longo TA 2024): comprimento 5,932 m · largura 2,020 m · altura 2,620 m ·
       entre-eixos 3,665 m · bitola ≈ 1,72 m (de memória) · pneu 225/75 R16 (0,744 m) · balanço dianteiro ≈ 0,98 m e traseiro ≈ 1,29 m ·
       altura do solo ≈ 0,18 m (de memória) · 2283 kg · tanque 71 L · 10,3 km/L na cidade e 11,8 km/L na estrada · 155 km/h.
     Traços de assinatura:
       frente   · faróis grandes que sobem pelo paralama até perto do para-brisa; grade de três barras cromadas com emblema grande;
                · para-choque preto alto de ponta a ponta com tomada central e faróis de neblina;
       lateral  · teto alto reto, capô curto inclinado, porta corrediça à direita com trilho aparente, friso preto de proteção;
       traseira · duas portas com divisão central, lanternas verticais altas nas quinas, terceira luz de freio no alto;
       teto     · teto liso e comprido.
     Ducatto Resgate · Fiat Ducato ambulância (Maxicargo L2H2)
     Referência (de memória): comprimento 5,413 m · largura 2,050 m · altura 2,524 m (sem o giroflex) · entre-eixos 3,450 m ·
       bitola ≈ 1,81 m / 1,79 m · pneu 215/70 R15 (0,682 m) · balanço dianteiro ≈ 0,95 m e traseiro ≈ 1,01 m · altura do solo ≈ 0,17 m ·
       tanque 90 L · 2950 kg equipada.
     Traços de assinatura:
       frente   · para-choque preto enorme que sobe até os faróis, com tomada larga e faróis de neblina redondos;
                · faróis altos no canto do capô curto, grade pequena entre eles; "AMBULÂNCIA" espelhado no capô;
       lateral  · faixa vermelha e amarela de ponta a ponta, estrela da vida azul, janelas do salão, giroflex na frente do teto;
       traseira · portas com janelas, lanternas verticais, luzes vermelhas e âmbar no alto das quinas. */
  function van(c, P) {
    var W = P.W, T = { belt: P.belt, top: P.roof + 0.02, k: 0.055 }, col = P.col, amb = !!P.amb;
    var A = axles(P.WB, P.oF, P.L, P.dF, P.dR), F = A.F, R = A.R;
    var items = [[R, 0.44, 0.06], [R - 0.02, P.roof - 0.04, 0.16], [P.capX, P.roof, 0.3], [P.wt[0], P.wt[1], 0.14], [P.wb[0], P.wb[1], 0.18], [F - 0.14, P.nose, 0.24], [F, P.nose - 0.32, 0.16], [F - 0.03, 0.42, 0.06]];
    c.meta.col = col;
    var q = ZG.quadDef(P.wb, P.wt, W, T, "front", 0.05, { inset: 0.12 });
    var lin = function (y) { return P.wb[0] + (P.wt[0] - P.wb[0]) * (y - P.wb[1]) / (P.wt[1] - P.wb[1]); };
    var yb = P.belt + 0.06, yt = P.wt[1] - 0.12;
    var cab = [[P.cabBack, yb], [lin(yb) - 0.14, yb], [lin(yt) - 0.14, yt], [P.cabBack, yt]];
    var holes = [ZG.holeSide(cab), ZG.holeQuad(q), ZG.holeTop(P.wb[0] + 0.1, F - 0.2, W / 2 - 0.15, 0.8, "capo")];
    var winS = (P.rearSide || []).slice(), winR = P.rearWin;
    winS.forEach(function (w) { holes.push(ZG.holeSide(w.p, { side: w.side })); });
    if (winR) holes.push(ZG.holeBox([R - 0.2, winR.y0, -winR.z1], [R + 0.2, winR.y1, winR.z1], function (n, ce) { return n.x < -0.6 && Math.abs(ce.z) > winR.z0; }));
    var n0 = c.deform.length;
    var shellM = ZG.shell(c, { items: items, bottomY: 0.42, arches: [[A.xf, P.wr, P.wr + 0.08], [A.xr, P.wr, P.wr + 0.08]], W: W, col: col, T: T, archInner: W / 2 - 0.42, holes: holes });
    ZG.glassQuad(c, q, "Para-brisa");
    ZG.sideWindows(c, [cab], W, T, function () { return "Janela da cabine"; });
    winS.forEach(function (w, i) { ZG.sideWindows(c, [w.p], W, T, function () { return w.label; }, { sides: [w.side] }); });
    if (winR) [1, -1].forEach(function (sd) {
      var g = c.rb(0.012, winR.y1 - winR.y0, winR.z1 - winR.z0, 0.02, MT.glass, R - 0.012, (winR.y0 + winR.y1) / 2, sd * (winR.z0 + winR.z1) / 2);
      ZG.asGlass(c, g, "Vidro da porta traseira " + (sd > 0 ? "direita" : "esquerda"), "temperado");
    });
    var m = c.meta;
    Object.assign(m, { L: P.L, W: W, front: F, rear: R, clear: 0.42, belt: P.belt, top: P.roof + 0.02, bodyH: P.belt - 0.42, T: T, quadF: q,
      gh: { fb: P.wb[0], ft: P.wt[0], rb: R + 0.02, rt: R + 0.02, belt: P.belt + 0.02, roof: P.roof, Wg: W, pillars: [P.cabBack] }, roof: { x0: R + 0.3, x1: P.capX - 0.1, w: 1.6, y: P.roof + 0.02 } });
    var fl = 0.62;
    ZG.interior(c, { x0: P.wb[0], ft: P.wt[0], roof: P.wt[1] + 0.15, belt: P.belt + 0.08, floor: fl, zIn: W / 2 - 0.13, rows: 1, col: amb ? "#3a4a5c" : "#2f3033", xRear: P.cabBack - 0.12, xFront: P.cabBack + 0.42, seatH: 0.42, front: "bench" });
    c.rb(0.04, P.roof - fl - 0.06, W - 0.16, 0.01, CM(amb ? "#c9ccd0" : "#3a3b3d", { roughness: 0.8 }), P.cabBack - 0.16, (P.roof + fl) / 2, 0);
    var hood = ZG.makeHood(c, shellM.userData.cut.capo, { x0: P.wb[0] + 0.1, col: col });
    if (hood) hood.open = 1.25;
    if (hood) ZG.engineBay(c, { x0: P.wb[0] + 0.12, x1: F - 0.2, zw: W / 2 - 0.17, floor: 0.52, top: hood.yMin - 0.035, motor: "diesel", col: col, axle: A.xf });
    var low = [[R, 0.44, 0.06], [R - 0.02, P.roof - 0.04, 0.16], [P.wb[0], P.wb[1], 0], [F - 0.14, P.nose, 0.24], [F, P.nose - 0.32, 0.16], [F - 0.03, 0.42, 0.06]];
    ZG.carDetails(c, { lower: low, bottomY: 0.42, noseY: P.nose, tailY: 1.2, W: W, col: col, hl: P.hl, tl: P.tl, grille: P.grille, seams: P.seams, handles: P.handles,
      wheels: [[A.xf, P.wr, 0.24, { rim: P.rim }], [A.xr, P.wr, 0.24, { rim: P.rim }]], plateRearY: 0.72, noAntenna: true });
    /* traseira: duas portas com divisão central, maçaneta, dobradiças, terceira luz de freio, para-choque preto com degrau */
    var rx = R - BV;
    c.rb(0.016, P.roof - 0.7, 0.018, 0.004, MT.dark, rx + 0.004, (P.roof + 0.58) / 2 - 0.02, 0);
    c.rb(0.014, 0.014, W - 0.24, 0.004, MT.dark, rx + 0.004, P.roof - 0.1, 0);
    c.rb(0.03, 0.05, 0.18, 0.012, MT.chrome, rx - 0.01, 1.22, 0.11); c.rb(0.03, 0.09, 0.05, 0.012, MT.trim, rx - 0.012, 1.22, 0.24);
    [1, -1].forEach(function (sd) { [1.8, 1.0].forEach(function (y) { c.rb(0.035, 0.13, 0.06, 0.012, MT.trim, rx - 0.012, y, sd * (W / 2 - 0.1)); }); });
    var brk = c.rb(0.03, 0.045, 0.42, 0.012, MT.tail, rx - 0.008, P.roof - 0.05, 0); brk.castShadow = false;
    c.rb(0.03, 0.06, 0.46, 0.015, MT.housing, rx - 0.0, P.roof - 0.05, 0);
    c.rb(0.2, 0.05, 0.9, 0.015, CM("#2a2c2e", { roughness: 0.9 }), rx - 0.1, 0.69, 0, { def: true });
    c.rb(0.08, 0.2, W - 0.1, 0.03, MT.trim, rx - 0.02, 0.58, 0, { def: true });
    /* trilho da porta corrediça em relevo */
    c.rb(P.slide[1] - P.slide[0] + 0.25, 0.04, 0.03, 0.012, MT.trim, (P.slide[0] + P.slide[1]) / 2 - 0.05, P.roof - 0.42, W / 2 + 0.012);
    c.rb(P.slide[1] - P.slide[0], 0.012, 0.006, 0.003, MT.dark, (P.slide[0] + P.slide[1]) / 2, P.roof - 0.5, W / 2 + 0.003);
    [P.slide[0], P.slide[1]].forEach(function (x) { c.rb(0.012, P.roof - 0.95, 0.006, 0.003, MT.dark, x, (P.roof - 0.5 + 0.45) / 2, W / 2 + 0.003); });
    c.rb(0.04, 0.12, 0.03, 0.012, MT.trim, P.slide[1] - 0.12, 1.3, W / 2 + 0.012);
    var ext = [];
    [1, -1].forEach(function (sd) { ext.push(c.rb(A.xf - A.xr - 2 * P.wr - 0.3, 0.12, 0.03, 0.012, MT.trim, (A.xf + A.xr) / 2, 0.62, sd * (W / 2 + 0.008), { sub: 0.2 })); });
    m.vanLow = low;
    bitola(c, P.track, P.track);
    if (P.extra) P.extra(c, m, A, ext);
    esculpir(c, { low: c.deform[n0], extra: ext, sh: 0, tuck: 0.035, peak: 0.55, top: P.belt, pf: 0.09, Rf: 0.6, bowF: 0.1, Rb: 0.45, pr: 0.02, bowR: 0.01 });
    placaParaFora(c); farolVivo(c); m.damage = danoB;
    /* zonas de furgão: a lateral do baú vai até o teto alto, porta corrediça à direita, duas portas atrás */
    var hw = W / 2, yS = 0.3, yT = P.roof - 0.25;
    var lado = function (x0, x1, sd) { return sd < 0 ? [x0, x1, yS, yT, -hw - 0.25, -hw + 0.34] : [x0, x1, yS, yT, hw - 0.34, hw + 0.25]; };
    c.zone("porta_td", "Porta corrediça direita", lado(P.slide[0], P.slide[1], 1), null, { type: "porta", hinge: "tras", side: 1, fxKey: "porta", who: "quem vai no salão" });
    c.zone("lateral_td", "Lateral do baú direita", lado(R + 0.22, P.slide[0], 1), null, { side: 1, fxKey: "lateral", who: "a carga" });
    c.zone("porta_te", "Lateral do baú esquerda", lado(R + 0.22, P.cabBack, -1), null, { type: "painel", side: -1, fxKey: "lateral", who: "a carga" });
    c.zone("lateral_te", false);
    c.zone("teto", "Teto alto", [R - 0.06, P.capX + 0.3, yT, P.roof + 0.2, -hw - 0.05, hw + 0.05]);
    forroTeto(c, m.noTeto);
    /* as portas de trás abrem para os lados: no destruído amassam e rasgam no lugar (não basculam como tampa de hatch) */
    c.zone("tampa", "Portas traseiras", [R - 0.15, R + 0.35, 0.5, P.roof - 0.1, -hw + 0.08, hw - 0.08], null, { type: "painel", fxKey: "tampa", dir: "frente" });
    c.g.children.forEach(function (o) { if (o.isMesh && o.geometry.type === "PlaneGeometry" && o.material.map && o.material.map.image && o.material.map.image.width === 400 && o.position.x < 0) o.position.y = 0.84; });
    return { A: A, m: m };
  }

  ZG.register({ k: "van", grp: "Vans", n: "Sprinta Furgão", insp: "Mercedes-Benz Sprinter", art: "na", c: "Furgão de carga teto alto", fuel: "diesel",
    d: "Teto alto, porta lateral corrediça e 1,9 tonelada de carga. Sem tração para lama, mas cabe um acampamento inteiro no baú.",
    mass: 2283, r: 75, seats: "3", cap: "71 L", eff: "10,3 km/L (cidade) · 11,8 km/L (estrada)", auto: "730 km", vmax: 155, skill: "Direção 2 (veículo grande)", hood: true
  }, function (c) {
    var r = van(c, { W: 1.99, L: 5.932, WB: 3.665, oF: 0.98, dF: 0.09, dR: 0.25, wr: 0.372, track: 1.72, col: "#b9bab6", belt: 1.36, roof: 2.58, nose: 1.06, capX: 0.62,
      wb: [1.9, 1.28], wt: [1.0, 2.14], cabBack: 0.36, slide: [-0.9, 0.42], rim: MT.steel,
      hl: { style: "wedge", w: 0.52, h: 0.3, y: 1.02, in: 0.0, yaw: 0.6, dx: 0.04, mat: MT.led }, tl: { style: "vertical", w: 0.17, h: 0.62, y: 1.18, in: 0.0 },
      grille: { style: "truck", w: 0.84, h: 0.28, y: 0.86 }, seams: [1.62, 0.44], handles: [0.6],
      extra: function (c, m, A) {
        var fx = ZG.profX(m.vanLow, 0.86, true);
        ZG.emblem(c, fx + 0.1, 0.86, 0, 0.1);
        /* para-choque preto alto de ponta a ponta, tomada central em colmeia e faróis de neblina */
        var bfx = ZG.profX(m.vanLow, 0.56, true);
        c.rb(0.14, 0.3, 1.99, 0.06, MT.trim, bfx + 0.005, 0.58, 0, { def: true });
        ZG.grille(c, { style: "mesh", x: bfx + 0.07, y: 0.6, w: 0.9, h: 0.12, col: "#222", emblem: false });
        [1, -1].forEach(function (sd) { ZG.headlight(c, { style: "round", x: bfx + 0.07, y: 0.6, z: sd * 0.78, w: 0.07, h: 0.07, d: 0.05, side: sd, label: "Farol de neblina " + (sd > 0 ? "direito" : "esquerdo"), reach: 0.5 }); });
        c.rb(0.3, 0.06, 0.06, 0.02, MT.trim, 0.0, 0.3, 0.7);
        /* carga no baú: prateleiras e caixas (aparece pela janela da cabine e pela divisória) */
        var cx0 = m.rear + 0.2;
        [1, -1].forEach(function (sd) { c.rb(2.6, 0.03, 0.4, 0.01, MT.steel, cx0 + 1.4, 1.4, sd * 0.75); c.rb(2.6, 0.03, 0.4, 0.01, MT.steel, cx0 + 1.4, 1.9, sd * 0.75); });
        [[cx0 + 0.4, 0.82, 0.3, "#8a6a44"], [cx0 + 0.9, 0.82, -0.3, "#7a5c3a"], [cx0 + 0.6, 1.18, -0.3, "#8a6a44"], [cx0 + 1.6, 0.82, 0.0, "#6d5232"]].forEach(function (b) { c.rb(0.5, 0.4, 0.5, 0.02, CM(b[3], { roughness: 0.9 }), b[0], b[1], b[2]); });
        c.part("carga", "Baú de carga", null, new V3(m.rear + 1.4, 1.2, 0), 1.3);
      } });
    c.meta.armor = function (c) {
      var m = c.meta; ZG.applyArmor(c);
      var y = m.top + 0.16;
      for (var i = 0; i < 6; i++) c.rb(0.42, 0.16, 0.3, 0.07, CM("#7a6a48", { roughness: 1 }), m.rear + 0.7 + (i % 3) * 0.45, y + 0.1 + (i < 3 ? 0 : 0.15), 0.5);
      [0.25, -0.25].forEach(function (z) { c.rod(new V3(m.rear - 0.04, 0.5, z), new V3(m.rear - 0.04, y + 0.3, z), 0.02, ZG.STEELM); });
      for (var k = 0; k < 9; k++) c.rod(new V3(m.rear - 0.04, 0.6 + k * 0.27, -0.25), new V3(m.rear - 0.04, 0.6 + k * 0.27, 0.25), 0.012, ZG.STEELM);
    };
  });

  ZG.register({ k: "ambulancia", grp: "Vans", n: "Ducatto Resgate", insp: "Fiat Ducato ambulância", art: "na", c: "Ambulância de resgate", fuel: "diesel",
    d: "Furgão com maca, cilindro de oxigênio e armário de remédios. Ótimo para levar feridos; a sirene atrai zumbis de longe.",
    mass: 2950, r: 80, seats: "3 na cabine + 2 atrás + 1 maca", cap: "90 L", eff: "8,6 km/L", auto: "770 km", vmax: 150, skill: "Direção 2 · Primeiros socorros 1 (maca e kit)", hood: true
  }, function (c) {
    var W = 2.01, red = "#b3261e";
    var r = van(c, { W: W, L: 5.413, WB: 3.45, oF: 0.95, dF: 0.08, dR: 0.25, wr: 0.341, track: 1.80, col: "#e4e2dc", amb: true, belt: 1.34, roof: 2.45, nose: 1.12, capX: 0.55,
      wb: [1.72, 1.32], wt: [0.95, 2.05], cabBack: 0.3, slide: [-0.75, 0.38], rim: MT.steel,
      hl: { style: "wedge", w: 0.42, h: 0.17, y: 1.07, in: 0.01, yaw: 0.55, dx: 0.02, mat: MT.led }, tl: { style: "vertical", w: 0.17, h: 0.46, y: 0.95, in: 0.0 },
      grille: { style: "mesh", w: 0.94, h: 0.09, y: 0.95 }, seams: [1.5, 0.39], handles: [0.55],
      rearSide: [{ side: 1, p: [[-0.68, 1.5], [0.3, 1.5], [0.3, 2.0], [-0.68, 2.0]], label: "Janela da porta corrediça" }, { side: -1, p: [[-1.3, 1.5], [-0.45, 1.5], [-0.45, 2.0], [-1.3, 2.0]], label: "Janela do salão" }],
      rearWin: { y0: 1.55, y1: 2.05, z0: 0.12, z1: 0.82 },
      extra: function (c, m, A, ext) {
        var fx = ZG.profX([[m.rear, 0.44], [m.rear, 2.4], [1.72, 1.32], [m.front - 0.14, 1.12], [m.front, 0.8], [m.front - 0.03, 0.42]], 0.98, true);
        /* frente própria do Ducato: para-choque inferior preto alto com tomada larga e faróis de neblina */
        var bfx = ZG.profX(m.vanLow, 0.56, true);
        c.rb(0.14, 0.4, W + 0.02, 0.06, MT.trim, bfx + 0.005, 0.63, 0, { def: true });
        c.rb(0.03, 0.12, 1.1, 0.03, MT.housing, bfx + 0.08, 0.76, 0);
        [1, -1].forEach(function (sd) { ZG.headlight(c, { style: "round", x: bfx + 0.075, y: 0.64, z: sd * 0.82, w: 0.07, h: 0.07, d: 0.05, side: sd, label: "Farol de neblina " + (sd > 0 ? "direito" : "esquerdo"), reach: 0.5 }); });
        ZG.emblem(c, fx + 0.07, 0.95, 0, 0.045);
        var rd = c.paint(red), yl = c.paint("#e0b81c"), blu = c.paint("#1d4f9a");
        [1, -1].forEach(function (sd) {
          ext.push(c.rb(m.front - m.rear - 0.45, 0.16, 0.01, 0.005, rd, (m.front + m.rear) / 2 - 0.1, 1.1, sd * (W / 2 + 0.006), { sub: 0.15 }));
          ext.push(c.rb(m.front - m.rear - 0.45, 0.05, 0.01, 0.004, yl, (m.front + m.rear) / 2 - 0.1, 0.98, sd * (W / 2 + 0.006), { sub: 0.15 }));
          var zz = sd * (ZG.halfAt(W, m.T, 1.75) + 0.012), zt = sd * (ZG.halfAt(W, m.T, 2.22) + 0.012);
          c.text("RESGATE", 1.2, 0.3, sd > 0 ? -1.5 : -0.85, 2.22, zt, sd > 0 ? "+z" : "-z", { fg: red });
          [0, PI / 3, -PI / 3].forEach(function (a) { c.rb(0.09, 0.36, 0.01, 0.01, blu, -2.25, 1.75, zz, { rot: [0, 0, a] }); });
        });
        /* AMBULÂNCIA espelhado no capô, no plano do capô, para ser lido no retrovisor de quem vai à frente */
        if (c.hood) {
          var hp = c.hood.piv, hg = hp.children[0].geometry.attributes.position;
          /* altura do capô no ponto; sem vértice por perto, procura numa janela maior (nunca devolve o -9 de "não achei") */
          var topAt = function (lx, z) { z = z || 0; for (var tol = 0.07; tol < 0.6; tol *= 1.8) { var y = -9; for (var i = 0; i < hg.count; i++) if (Math.abs(hg.getZ(i) - z) < tol && Math.abs(hg.getX(i) - lx) < tol * 0.7) y = Math.max(y, hg.getY(i)); if (y > -9) return y; } return 0; };
          var lc = (c.hood.x1 - c.hood.x0) * 0.42, ya = topAt(lc - 0.15), yb2 = topAt(lc + 0.15), th = Math.atan2(ya - yb2, 0.3), yc = (ya + yb2) / 2;
          var tm = c.text("AMBULÂNCIA", 1.45, 0.24, lc + 0.008 * Math.sin(th), topAt(lc, 0) + 0.008 * Math.cos(th), 0, "+x", { fg: red, bg: "#f4f3ef", size: 0.78, parent: hp });
          var pg = new THREE.PlaneGeometry(1.45, 0.24, 24, 1), pa = pg.attributes.position, y0 = topAt(lc, 0);
          for (var iv = 0; iv < pa.count; iv++) pa.setZ(iv, (topAt(lc, pa.getX(iv)) - y0) * Math.cos(th) + 0.004);
          pa.needsUpdate = true; pg.computeVertexNormals(); tm.geometry.dispose(); tm.geometry = pg;
          tm.quaternion.setFromAxisAngle(new V3(0, 0, 1), PI / 2 - th).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), PI / 2)); tm.scale.x = -1;
        }
        c.text("RESGATE", 0.8, 0.18, m.rear - 0.012, 2.22, 0, "-x", { fg: red });
        c.rb(0.03, 0.12, 1.9, 0.01, rd, m.rear - 0.008, 1.1, 0);
        /* giroflex dianteiro e luzes traseiras */
        var giro = [c.rb(0.3, 0.08, 1.5, 0.03, MT.trim, 0.6, m.top + 0.04, 0)];
        [-0.5, -0.17, 0.17, 0.5].forEach(function (z, i) { giro.push(c.rb(0.24, 0.1, 0.3, 0.04, i % 2 ? MT.tail : CM("#f2f2f2", { emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.6 }), 0.6, m.top + 0.13, z)); });
        giro.push(c.rb(0.26, 0.12, 1.56, 0.04, CM("#e8e8e8", { transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.05 }), 0.6, m.top + 0.13, 0));
        c.part("sirene", "Giroflex e sirene", null, new V3(0.6, m.top + 0.12, 0), 0.6);
        c.zone("giroflex", "Giroflex e sirene", [0.4, 0.8, m.top - 0.02, m.top + 0.25, -0.85, 0.85], giro, { type: "peca", dir: "cima", w: 0.4,
          fx: ["Nenhum", "Lente riscada, ainda pisca", "Metade das luzes apagada; a sirene falha", "Sirene muda e giroflex pendurado", "Sem giroflex: a ambulância fica silenciosa (não atrai horda)"] });
        [1, -1].forEach(function (sd) { c.rb(0.1, 0.14, 0.2, 0.04, MT.tail, m.rear + 0.06, m.top + 0.02, sd * 0.78); c.rb(0.08, 0.1, 0.14, 0.03, MT.amber, m.rear + 0.06, m.top - 0.18, sd * 0.85); });
        /* salão: maca, banco lateral, armários, oxigênio e monitor */
        var fl = 0.62, sx = m.rear + 0.25;
        c.rb(2.6, 0.03, W - 0.2, 0.01, CM("#5c6b78", { roughness: 0.8 }), sx + 1.3, fl, 0);
        c.rb(1.9, 0.06, 0.56, 0.02, MT.chrome, sx + 1.2, fl + 0.38, 0.32);
        [0.25, 1.95].forEach(function (dx) { [0.1, 0.54].forEach(function (dz) { c.rod(new V3(sx + dx, fl, dz), new V3(sx + dx, fl + 0.36, dz), 0.015, MT.chrome); }); });
        var maca = c.rb(1.86, 0.1, 0.52, 0.04, CM("#e36b1a", { roughness: 0.7 }), sx + 1.2, fl + 0.46, 0.32);
        c.rb(0.4, 0.12, 0.48, 0.05, CM("#e36b1a", { roughness: 0.7 }), sx + 1.95, fl + 0.56, 0.32, { rot: [0, 0, 0.35] });
        c.part("maca", "Maca", maca, new V3(sx + 1.2, fl + 0.46, 0.32), 0.7);
        c.rb(1.5, 0.1, 0.42, 0.03, CM("#3a4a5c", { roughness: 0.85 }), sx + 1.2, fl + 0.45, -0.68);
        c.rb(1.5, 0.5, 0.08, 0.03, CM("#3a4a5c", { roughness: 0.85 }), sx + 1.2, fl + 0.78, -0.89);
        c.rb(1.0, 0.5, 0.36, 0.02, CM("#d8dadc", { roughness: 0.5 }), sx + 0.6, 1.95, -0.78);
        for (var d = 0; d < 2; d++) c.rb(0.44, 0.44, 0.012, 0.004, CM("#8fb3c9", { transparent: true, opacity: 0.4, depthWrite: false }), sx + 0.36 + d * 0.48, 1.95, -0.59);
        c.cyl(0.09, 0.09, 0.9, CM("#2f7a3e", { roughness: 0.4 }), sx + 2.35, fl + 0.5, -0.75); c.cyl(0.03, 0.04, 0.08, MT.chrome, sx + 2.35, fl + 0.99, -0.75);
        c.part("tanque", "Cilindro de oxigênio", null, new V3(sx + 2.35, fl + 0.5, -0.75), 0.5);
        c.rb(0.04, 0.26, 0.34, 0.02, MT.screen, 0.1, 1.7, 0.5);
        var luz = c.rb(2.3, 0.02, W - 0.3, 0.01, CM("#efefe8", { emissive: new THREE.Color("#7c7f86"), emissiveIntensity: 0.25 }), sx + 1.2, m.top - 0.06, 0); luz.castShadow = false;
        m.noTeto = giro;
      } });
    c.meta.armor = function (c) {
      var m = c.meta; ZG.applyArmor(c);
      for (var z = -0.7; z <= 0.71; z += 0.14) c.rod(new V3(0.38, m.top + 0.05, z), new V3(0.95, m.top + 0.05, z), 0.012, ZG.STEELM);
      [0.38, 0.95].forEach(function (x) { c.tube([[x, m.top - 0.02, -0.78], [x, m.top + 0.3, -0.7], [x, m.top + 0.3, 0.7], [x, m.top - 0.02, 0.78]], 0.022, ZG.STEELM, { seg: 20 }); });
      c.rod(new V3(0.38, m.top + 0.3, 0), new V3(0.95, m.top + 0.3, 0), 0.02, ZG.STEELM);
      for (var y = 1.5; y < 2.1; y += 0.12) c.rod(new V3(m.rear - 0.05, y, -0.85), new V3(m.rear - 0.05, y, 0.85), 0.012, ZG.STEELM);
    };
  });
})(window.ZG);
