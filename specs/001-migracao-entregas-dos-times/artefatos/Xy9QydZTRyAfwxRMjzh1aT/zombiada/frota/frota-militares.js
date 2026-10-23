/* Grupo D · militares (frota-militares.js). Só usa a API de window.ZG (veja API.md).
   Verde-oliva fosco, estrela branca genérica, nenhum brasão ou insígnia real.
   Veículos: marrua (Maruá AM2), worker (Worqer 15.210 Militar), guarani (Guaraní 6x6), cascavel (Cascável EE-9),
   leopardo (Leopardo 1A5) e blackhawk (Falcão Negro HM-2).
   Funções locais deste arquivo (candidatas ao núcleo, veja o resumo do grupo D):
   - fosco(): troca a pintura brilhante de c.paint() por verde-oliva fosco em todas as malhas (ZG.car e ZG.shell não aceitam material)
   - estrela(): estrela branca de cinco pontas, plana, colada numa face
   - rodaMil(): roda militar com cravos em V e aro verde
   - casco(): casco blindado por perfil extrudado com afinamento (ZG.shell) e furos
   - bancoLateral(): banco de tropa virado para o corredor (ZG.seat só olha para +x/-x)
   - escotilha(): escotilha redonda com tampa articulada (aberta ou fechada)
   - periscopio(): bloco de visão com vidro blindado
   - lagartaCompleta(): ZG.tracks + saias laterais
   - basculante() e motorSemTrava(): cabine basculante (copiadas do grupo C, frota-pesados.js)
   - bayEspelhado(): compartimento do motor espelhado para motor traseiro (copiado do grupo C)
   - redeCamuflagem(), sacosAreia(), slat(): itens do estado "modificado" */
(function (ZG) {
  "use strict";
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM, G = ZG.geo, DS = THREE.DoubleSide;
  var GRP = "Militares";
  var OLIVA = "#4d5236", OLIVA2 = "#454a30";
  var BRANCO = CM("#e4e2d6", { roughness: 0.8 }), PRETO = CM("#1a1b18", { roughness: 0.85 });
  var ACO = CM("#3c4030", { metalness: 0.4, roughness: 0.6 }), LONA = CM("#55553c", { roughness: 0.98, side: DS }), LONA2 = CM("#4a4b34", { roughness: 0.98, side: DS });
  var RIMO = CM("#3f4430", { metalness: 0.25, roughness: 0.7 }), CANO = CM("#2b2d29", { metalness: 0.6, roughness: 0.45 });
  var BAG = CM("#76694b", { roughness: 0.97 }), REDE = CM("#3e4a2c", { roughness: 1, side: DS }), REDE2 = CM("#5a5638", { roughness: 1, side: DS });
  /* galão de reserva: areia escura fosca (nada de vermelho vivo na pintura militar) */
  var AREIA = "#6b6448";
  /* lona da capota: mais clara e menos saturada que a lataria, totalmente fosca */
  var LONA_CAP = CM("#646349", { roughness: 1, side: DS }), LONA_CAP2 = CM("#57563f", { roughness: 1, side: DS });
  /* forro interno claro com reflexo da luz de combate vermelha (o vão não fica preto) */
  var FORRO = CM("#78806f", { roughness: 0.9, emissive: new THREE.Color("#2c0805"), emissiveIntensity: 0.35 });
  var BANCO_TROPA = CM("#4a4f3c", { roughness: 0.9, emissive: new THREE.Color("#1e0604"), emissiveIntensity: 0.8 });
  var LUZ_VERMELHA = CM("#a01a12", { emissive: new THREE.Color("#ff2a14"), emissiveIntensity: 1.6 });
  var BAY_CLARO = CM("#5f645b", { roughness: 0.85, metalness: 0.15 });
  /* materiais dupla face sem acne de sombra (faixas escuras) */
  [LONA, LONA2, REDE, REDE2, LONA_CAP, LONA_CAP2].forEach(function (mt) { mt.shadowSide = THREE.BackSide; });

  /* ================= capotagem, rigidez e antenas (locais do grupo D) ================= */
  /* executa fn(c) a cada quadro do ZG.tick (entrada neutra em c.spin: o núcleo só soma rotação 0) */
  function porQuadro(c, fn) {
    var o = { rotation: {} };
    Object.defineProperty(o.rotation, "y", { get: function () { return 0; }, set: function () { fn(c); } });
    c.spin.push({ o: o, axis: "y", v: 0, hook: true });
  }
  /* aço blindado: cada amassado novo fica com só k da profundidade, sem ondular como massa.
     Vale para malhas em c.deform e para as peças rígidas que acompanham o amassado. */
  function blindagem(c, k) {
    porQuadro(c, function () {
      c.deform.forEach(function (msh) {
        var g = msh.geometry, pos = g.attributes.position, ud = g.userData;
        if (!ud.p0 || ud.p0.length !== pos.array.length || ud.milV === pos.version) return;
        if (!ud.milPrev) ud.milPrev = new Float32Array(ud.p0);
        var a = pos.array, pr = ud.milPrev;
        for (var i = 0; i < a.length; i++) { a[i] = pr[i] + (a[i] - pr[i]) * k; pr[i] = a[i]; }
        pos.needsUpdate = true;
        if (ud.crease) G.crease(g, 42); else g.computeVertexNormals();
        g.computeBoundingSphere(); g.computeBoundingBox(); ud.milV = pos.version;
      });
      c.g.children.forEach(function (o) {
        var u = o.userData; if (!u.pos0) return;
        if (!u.milPrev) u.milPrev = u.pos0.clone();
        if (o.position.distanceToSquared(u.milPrev) < 1e-10) return;
        o.position.sub(u.milPrev).multiplyScalar(k).add(u.milPrev); u.milPrev.copy(o.position);
      });
    });
  }
  /* peças que não amassam nem afundam no amassado (torre, canhão, mastro) */
  function rigido(c, objs) {
    objs.forEach(function (o) { var i = c.deform.indexOf(o); if (i >= 0) c.deform.splice(i, 1); o.userData.noFollow = true; });
  }
  /* antenas quebram no primeiro contato da capotagem (a haste some e saem pedaços) */
  function quebraAntenas(c) {
    (c.milAnt || []).forEach(function (w) {
      if (!w.parent) return;
      var p = c.toFx(w.position.clone());
      w.parent.remove(w);
      ZG.burst(c, "plastico", p, 3, { speed: 1.4 }); ZG.burst(c, "faisca", p, 6, { speed: 2 });
    });
  }
  /* assenta o veículo no chão pelo ponto mais baixo de TUDO que é visível (torre, mastro, trem), não só do casco */
  function assentar(c, tilt, soSobe) {
    if (tilt) c.g.rotation.z += tilt;
    c.root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert(), box = new THREE.Box3(), tmp = new THREE.Box3();
    c.g.traverse(function (ob) {
      if (!ob.isMesh) return;
      for (var q = ob; q && q !== c.g; q = q.parent) if (!q.visible || q.userData.decal || q.userData.ghost || q.userData.antena) return;
      if (!ob.geometry.boundingBox) ob.geometry.computeBoundingBox();
      tmp.copy(ob.geometry.boundingBox).applyMatrix4(ob.matrixWorld).applyMatrix4(inv); box.union(tmp);
    });
    if (!box.isEmpty() && (!soSobe || box.min.y < -0.005)) c.g.position.y -= box.min.y;
  }
  /* o: { tilt (rad, inclinação final), onStart(c, A), onRoll(c, A), onFlip(c) } */
  function capotagem(c, o) {
    o = o || {}; var done = false, ant = false, depois = 0;
    porQuadro(c, function () {
      /* nos 3 s seguintes o capô entreaberto e as peças soltas ainda se mexem: nada pode atravessar o chão */
      if (done && depois > 0) { depois--; if (depois % 3 === 0) assentar(c, 0, true); }
      var A = c.rollA;
      if (A) {
        if (!A.mil) { A.mil = true; c.milRollS = A.s; if (o.onStart) o.onStart(c, A); }
        if (o.onRoll) o.onRoll(c, A);
        if (!ant && A.last >= 1) { ant = true; quebraAntenas(c); }
      }
      if (c.flipped && !done) {
        done = true; if (!ant) { ant = true; quebraAntenas(c); }
        if (o.onFlip) o.onFlip(c);
        assentar(c, o.tilt || 0); depois = 90;
      }
    });
  }
  /* dano do estado "batido" dos blindados: mesmas zonas do padrão, sem mancha de sangue na blindagem */
  function danoBlindado(c) {
    var m = c.meta, mid = m.clear + (m.bodyH || 0.6) * 0.5;
    ZG.impact(c, new V3(m.front, mid, m.W * 0.15), new V3(-1, 0, 0), 1.0, { noBlood: true });
    ZG.impact(c, new V3((m.front + m.rear) * 0.5 + m.L * 0.12, mid + 0.1, -m.W / 2), new V3(0, 0, 1), 0.7, { noBlood: true });
  }
  /* aumenta tudo o que foi montado desde n0 em torno de cen (motor maior sem reescrever o compartimento do núcleo) */
  function escala(c, n0, cen, s) {
    c.g.children.slice(n0).forEach(function (ob) { ob.position.sub(cen).multiplyScalar(s).add(cen); ob.scale.multiplyScalar(s); });
  }
  function renomeiaCapo(c, nome) { c.parts.forEach(function (p) { if (p.kind === "capo") p.n = nome; }); }

  /* ================= utilidades ================= */
  function tinta(c, hex) { return CM(ZG.paintCol(hex, c.st), { roughness: c.st === "danificado" ? 0.92 : 0.82, metalness: 0.08, side: DS }); }
  /* troca o material brilhante de c.paint(hex) pelo fosco em tudo que já foi montado */
  var FOSCO_ACO = CM("#2e3128", { metalness: 0.45, roughness: 0.6 });
  function fosco(c, hex, o) {
    o = o || {};
    var bright = c.paint(hex), mate = tinta(c, hex), roofB = o.roof ? c.paint(o.roof) : null, roofM = o.roofMat || LONA;
    c.root.traverse(function (ob) {
      if (!ob.isMesh) return;
      if (ob.material === bright) ob.material = mate;
      else if (roofB && ob.material === roofB) ob.material = roofM;
      else if (o.dechrome !== false && ob.material === MT.chrome) ob.material = FOSCO_ACO;
    });
    return mate;
  }
  /* estrela de cinco pontas. face: "+z" | "-z" | "+y" | "+x" | "-x" */
  var starGeoCache = {};
  function estrela(c, x, y, z, r, face, o) {
    o = o || {};
    var key = r.toFixed(3);
    if (!starGeoCache[key]) {
      var s = new THREE.Shape();
      for (var i = 0; i < 10; i++) { var a = PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.4 : r; if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      var g = new THREE.ShapeGeometry(s); starGeoCache[key] = g;
    }
    var m = c.add(starGeoCache[key].clone(), o.mat || BRANCO, x, y, z, o.parent); m.castShadow = false;
    if (face === "+y") m.rotation.x = -PI / 2; else m.rotation.y = { "+z": 0, "-z": PI, "+x": PI / 2, "-x": -PI / 2 }[face] || 0;
    if (o.rotZ) m.rotateZ(o.rotZ);
    if (o.ring) { var rg = c.add(new THREE.RingGeometry(r * 1.12, r * 1.24, 32), o.mat || BRANCO, x, y, z, o.parent); rg.castShadow = false; rg.rotation.copy(m.rotation); m.userData.ring = rg; }
    return m;
  }
  /* roda militar: pneu de cravos em V e aro verde-oliva */
  function rodaMil(c, x, z, r, w, o) {
    o = o || {};
    return c.wheel(x, z, r, w, Object.assign({ lugs: true, chevron: true, rim: RIMO, spokes: 0, rimR: 0.55 }, o));
  }
  function jerry(c, x, y, z, col, rotY) {
    var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; g.userData.rigid = true; c.g.add(g);
    c.rb(0.34, 0.46, 0.17, 0.04, CM(col || "#3e4a2c", { roughness: 0.7 }), 0, 0, 0, { parent: g });
    c.rb(0.3, 0.012, 0.02, 0.004, PRETO, 0, 0.05, 0.088, { parent: g }); c.rb(0.3, 0.012, 0.02, 0.004, PRETO, 0, -0.05, 0.088, { parent: g });
    c.tube([[-0.1, 0.23, 0], [-0.05, 0.29, 0], [0.05, 0.29, 0], [0.1, 0.23, 0]], 0.015, CM(col || "#3e4a2c"), { parent: g, seg: 12, rs: 5 });
    c.cyl(0.025, 0.025, 0.05, MT.trim, 0.12, 0.25, 0, null, { parent: g });
    return g;
  }
  /* capota de lona sobre um teto (x0..x1, meia largura hw, topo y): pano abaulado que cede entre os arcos e arcos marcados */
  function capotaLona(c, x0, x1, y, hw, pitch) {
    var nxs = 32, nzs = 16, pos = [], idx = [], out = [], nb = Math.max(2, Math.round((x1 - x0) / pitch)), sp = (x1 - x0) / nb;
    function yAt(x, z) {
      var t = Math.min(1, Math.abs(z) / hw), ph = ((x - x0) / sp) % 1, bulge = 1 - t * t;
      return y + 0.045 * bulge - 0.014 * Math.sin(ph * PI) * bulge - (t > 0.9 ? (t - 0.9) * 0.9 : 0);
    }
    for (var i = 0; i <= nxs; i++) for (var j = 0; j <= nzs; j++) { var x = x0 + (x1 - x0) * i / nxs, z = (j / nzs * 2 - 1) * hw; pos.push(x, yAt(x, z), z); }
    for (i = 0; i < nxs; i++) for (j = 0; j < nzs; j++) { var a = i * (nzs + 1) + j, b = a + nzs + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    var sheet = c.add(g, LONA_CAP); c.deform.push(sheet); out.push(sheet);
    for (var k = 0; k <= nb; k++) {
      var bx = x0 + k * sp, pts = [[bx, y - 0.26, -(hw + 0.035)], [bx, y - 0.06, -(hw + 0.03)]];
      for (var q = -4; q <= 4; q++) { var zq = q / 4 * hw * 0.92; pts.push([bx, yAt(bx, zq) + 0.012, zq]); }
      pts.push([bx, y - 0.06, hw + 0.03], [bx, y - 0.26, hw + 0.035]);
      out.push(c.tube(pts, 0.02, LONA_CAP2, { seg: 40, rs: 6 }));
    }
    /* cordões de amarração na borda */
    [1, -1].forEach(function (sd) { out.push(c.rod(new V3(x0, y - 0.05, sd * (hw + 0.035)), new V3(x1, y - 0.05, sd * (hw + 0.035)), 0.01, LONA_CAP2, { seg: 5 })); });
    return out;
  }
  function sacosAreia(c, x0, x1, y, z, along, rows) {
    rows = rows || 2;
    for (var r = 0; r < rows; r++) {
      var off = r % 2 ? 0.2 : 0;
      for (var t = x0 + off; t <= x1 + 1e-6; t += 0.42) {
        var j = ZG.hash(t, r, z) - 0.5;
        if (along === "z") c.rb(0.32, 0.16, 0.42, 0.07, BAG, z, y + r * 0.14, t, { rot: [0, j * 0.2, 0] });
        else c.rb(0.42, 0.16, 0.32, 0.07, BAG, t, y + r * 0.14, z, { rot: [0, j * 0.2, 0] });
      }
    }
  }
  /* rede de camuflagem caída sobre uma caixa (x0..x1, largura w, altura y) */
  /* rede de camuflagem caída sobre uma caixa (x0..x1, largura w do que está embaixo, topo em y):
     fica 5 cm acima do topo e cai por FORA da largura; malha fina com normais suaves; tufos irregulares */
  var NET_MAT = CM("#ffffff", { vertexColors: true, roughness: 1, side: DS }); NET_MAT.shadowSide = THREE.BackSide;
  function redeCamuflagem(c, x0, x1, y, w, drop, prof) {
    prof = prof || function () { return y; };
    var nx = 28, nz = 14, pos = [], idx = [], col = [], cs = ["#3e4a2c", "#55543a", "#2f3626", "#4a5233"].map(function (h) { return new THREE.Color(h); });
    var hw = w / 2 + 0.06, span = hw + drop * 0.45;
    for (var i = 0; i <= nx; i++) for (var j = 0; j <= nz; j++) {
      var u = i / nx, v = j / nz, x = x0 + (x1 - x0) * u, zz = (v * 2 - 1) * span, az = Math.abs(zz), yy, zo;
      var wav = 0.025 * (1 + Math.sin(u * 11 + v * 7)) * 0.5 + 0.02 * ZG.hash(i, j, 5);
      if (az <= hw) { yy = Math.max(prof(zz), prof(Math.min(hw, az + 0.08) * Math.sign(zz || 1))) + 0.05 + wav * (1 - Math.pow(az / hw, 6)); zo = zz; }
      else { var t = (az - hw) / (span - hw); yy = prof(hw) + 0.05 - drop * t * (0.85 + 0.15 * Math.sin(u * 13)); zo = Math.sign(zz) * (hw + 0.04 * Math.sin(t * PI) + 0.03 * t); }
      /* borda da frente e de trás também caem um pouco */
      var ex = Math.min(u, 1 - u) * (x1 - x0); if (ex < 0.25) yy -= (0.25 - ex) * 0.5 * drop;
      pos.push(x, yy, zo);
      var h = ZG.hash(Math.floor(i / 2), Math.floor(j / 2), 3), cc = cs[Math.floor(h * 4) % 4], k2 = 0.85 + 0.3 * ZG.hash(i, j, 9); col.push(cc.r * k2, cc.g * k2, cc.b * k2);
    }
    for (i = 0; i < nx; i++) for (j = 0; j < nz; j++) { var a = i * (nz + 1) + j, b = a + nz + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    var m = c.add(g, NET_MAT); m.castShadow = true; m.receiveShadow = false; /* sem auto-sombra: nada de faixas de serrilhado */
    /* tufos de folhagem: grupos de 3 a 5 icosaedros deformados, irregulares */
    for (var k = 0; k < 14; k++) {
      var hx = x0 + 0.2 + (x1 - x0 - 0.4) * ZG.hash(k, 1, 7), hz = (ZG.hash(k, 2, 7) - 0.5) * w * 0.85, n = 3 + Math.floor(ZG.hash(k, 4, 7) * 3);
      for (var q = 0; q < n; q++) {
        var r = 0.07 + ZG.hash(k, q, 11) * 0.07, geo = new THREE.IcosahedronGeometry(r, 1), p = geo.attributes.position;
        for (var vi = 0; vi < p.count; vi++) { var f = 0.7 + 0.6 * ZG.hash(p.getX(vi) * 31 + k, p.getY(vi) * 17 + q, p.getZ(vi) * 13); p.setXYZ(vi, p.getX(vi) * f, p.getY(vi) * f * 0.8, p.getZ(vi) * f); }
        geo.computeVertexNormals();
        var ang = q / n * PI * 2 + k, tf = c.add(geo, (k + q) % 2 ? REDE : REDE2, hx + Math.cos(ang) * 0.1, prof(hz) + 0.1 + r * 0.5, hz + Math.sin(ang) * 0.1);
        tf.rotation.set(ZG.hash(k, q, 1) * 3, ZG.hash(k, q, 2) * 3, 0);
      }
    }
    return m;
  }
  /* grade anti-foguete (slat): barras horizontais afastadas da lateral */
  function slat(c, x0, x1, y0, y1, z, mat) {
    mat = mat || ACO; var s = Math.sign(z);
    for (var y = y0; y <= y1 + 1e-6; y += 0.11) c.rod(new V3(x0, y, z), new V3(x1, y, z), 0.012, mat, { seg: 5 });
    for (var x = x0; x <= x1 + 1e-6; x += 0.7) { c.rod(new V3(x, y0 - 0.03, z), new V3(x, y1 + 0.03, z), 0.022, mat, { seg: 6 }); c.rod(new V3(x, y0 + 0.05, z), new V3(x, y0 + 0.05, z - s * 0.2), 0.02, mat, { seg: 6 }); c.rod(new V3(x, y1 - 0.05, z), new V3(x, y1 - 0.05, z - s * 0.2), 0.02, mat, { seg: 6 }); }
  }
  /* metralhadora pesada genérica (.50) apontando para +x a partir de (x, y, z) */
  function metralhadora(c, x, y, z, o) {
    o = o || {}; var len = o.len || 1.6, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = o.yaw || 0; g.rotation.z = o.pitch || 0; g.userData.rigid = true; c.g.add(g);
    c.rb(0.5, 0.17, 0.16, 0.03, CANO, 0, 0, 0, { parent: g });
    c.cyl(0.055, 0.055, len * 0.55, CANO, 0.25 + len * 0.27, 0.02, 0, "x", { parent: g });
    c.cyl(0.026, 0.026, len * 0.5, CANO, 0.25 + len * 0.75, 0.02, 0, "x", { parent: g });
    c.cyl(0.04, 0.03, 0.12, CANO, 0.25 + len, 0.02, 0, "x", { parent: g });
    c.rb(0.2, 0.14, 0.12, 0.02, CM("#46482f", { roughness: 0.7 }), -0.05, -0.08, 0.15, { parent: g });
    [-1, 1].forEach(function (s) { c.rod(new V3(-0.28, 0, s * 0.06), new V3(-0.4, -0.02, s * 0.06), 0.015, CANO, { parent: g }); });
    return g;
  }
  /* escotilha redonda: anel e tampa articulada para trás (open em rad) */
  function escotilha(c, x, y, z, r, open, mat, o) {
    o = o || {};
    c.cyl(r + 0.05, r + 0.07, 0.07, mat, x, y + 0.02, z, null, { seg: 24 });
    c.cyl(r - 0.01, r - 0.01, 0.075, MT.dark, x, y + 0.025, z, null, { seg: 24 });
    var piv = new THREE.Group(); piv.position.set(x - r * (o.hingeX || 1), y + 0.06, z); piv.userData.rigid = true; c.g.add(piv);
    var lid = c.cyl(r + 0.02, r + 0.02, 0.05, mat, r, 0.0, 0, null, { seg: 24, parent: piv });
    c.rb(0.06, 0.04, r * 1.3, 0.015, ACO, r * 0.6, 0.04, 0, { parent: piv });
    piv.rotation.z = open || 0; if (o.yaw) { piv.rotation.order = "YXZ"; piv.rotation.y = o.yaw; }
    return piv;
  }
  /* bloco de visão (periscópio) com vidro blindado. face +x por padrão */
  function periscopio(c, x, y, z, w, label, o) {
    o = o || {}; var rot = o.rot || 0;
    var box = c.rb(0.14, 0.12, w + 0.06, 0.02, o.mat || ACO, x, y, z, { rot: [0, rot, 0] });
    var gl = c.rb(0.02, 0.07, w, 0.01, MT.armorGlass, x + Math.cos(rot) * 0.07, y, z - Math.sin(rot) * 0.07, { rot: [0, rot, 0] });
    if (label) ZG.asGlass(c, gl, label, "laminado"); return box;
  }
  /* banco de tropa encostado na parede, olhando para o centro (dir = +1 olha para +z) */
  function bancoLateral(c, x0, x1, fl, z, dir, o) {
    o = o || {}; var fab = o.mat || CM("#2f3226", { roughness: 0.9 }), h = o.h || 0.42, n = Math.max(1, Math.round((x0 - x1) / 0.55));
    c.rb(x0 - x1, 0.06, 0.42, 0.02, ACO, (x0 + x1) / 2, fl + h - 0.12, z + dir * 0.2);
    for (var i = 0; i < n; i++) {
      var x = x1 + (i + 0.5) * (x0 - x1) / n;
      c.rb(0.48, 0.09, 0.42, 0.035, fab, x, fl + h - 0.05, z + dir * 0.2);
      c.rb(0.46, 0.5, 0.08, 0.035, fab, x, fl + h + 0.28, z + dir * 0.02, { rot: [-dir * 0.08, 0, 0] });
      c.rb(0.2, 0.15, 0.07, 0.03, fab, x, fl + h + 0.66, z + dir * 0.03);
      c.rod(new V3(x, fl, z + dir * 0.36), new V3(x, fl + h - 0.12, z + dir * 0.36), 0.02, ACO, { seg: 6 });
      c.seatTops.push({ x: x, y: fl + h, z: z + dir * 0.2, w: 0.42, l: 0.48 });
    }
  }
  /* casco blindado: perfil lateral [x, y, raio] extrudado na largura W e afinado acima de belt (k) */
  function casco(c, o) {
    var T = { belt: o.belt, top: o.top, k: o.k || 0 };
    var m = ZG.shell(c, { items: o.items, bottomY: o.bottomY, arches: o.arches, W: o.W, mat: o.mat, col: o.col, T: T, holes: o.holes || [], archInner: o.archInner, sub: o.sub || 0.22, bev: o.bev == null ? 0.06 : o.bev });
    return { mesh: m, T: T, half: function (y) { return ZG.halfAt(o.W, T, y); } };
  }

  /* cabine basculante (adaptada do grupo C): as malhas recebem a inclinação na própria matriz */
  function motorSemTrava(c) {
    c.parts.forEach(function (p) {
      if (p.kind !== "motor") return;
      p.onHit = function (c2, pt, force) {
        ZG.addEmitter(c2, pt.pos.clone().add(new V3(0, 0.35, 0)), "preta");
        ZG.puddle(c2, "oleo", pt.pos.clone().setY(Math.max(0.2, c2.meta.clear || 0.3)), 0.6 + force * 0.3);
      };
    });
  }
  function basculante(c, objs, pivot, o) {
    o = o || {};
    var h = ZG.hinge(c, [], pivot, { len: -(o.len || 1.8), open: o.open || 0.9, sign: -1, zw: 0.7, label: o.label || "Cabine basculante" });
    var piv = h.piv, A = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z), B = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    var R = new THREE.Matrix4(), M = new THREE.Matrix4(), last = 0;
    function tm() { var a = piv.rotation.z; if (Math.abs(a) < 1e-5) return null; if (a !== last) { R.makeRotationZ(a); M.copy(A).multiply(R).multiply(B); last = a; } return M; }
    objs.forEach(function (ob) {
      if (ob === piv) return;
      ob.updateMatrix = function () { this.matrix.compose(this.position, this.quaternion, this.scale); var t = tm(); if (t) this.matrix.premultiply(t); this.matrixWorldNeedsUpdate = true; };
    });
    c.parts.forEach(function (p) { if (p.kind === "capo" && p.obj === piv) { p.onHit = function () {}; p.pos = new V3(pivot.x - 0.8, pivot.y + 1.0, 0); } });
    motorSemTrava(c);
    return h;
  }
  /* tampa articulada genérica que gira em torno de um eixo (x da dobradiça) sem trocar o pai das malhas */
  function tampa(c, objs, pivot, o) {
    o = o || {};
    var h = ZG.hinge(c, [], pivot, { len: o.len || 1, open: o.open || 1.0, sign: o.sign || 1, zw: o.zw || 0.6, label: o.label || "Tampa do motor" });
    var piv = h.piv, A = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z), B = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    var R = new THREE.Matrix4(), M = new THREE.Matrix4(), last = 0;
    function tm() { var a = piv.rotation.z; if (Math.abs(a) < 1e-5) return null; if (a !== last) { R.makeRotationZ(a); M.copy(A).multiply(R).multiply(B); last = a; } return M; }
    objs.forEach(function (ob) { ob.updateMatrix = function () { this.matrix.compose(this.position, this.quaternion, this.scale); var t = tm(); if (t) this.matrix.premultiply(t); this.matrixWorldNeedsUpdate = true; }; });
    c.parts.forEach(function (p) { if (p.kind === "capo" && p.obj === piv) p.pos = o.partPos || p.pos; });
    return h;
  }
  /* compartimento do motor espelhado (motor traseiro): engineBay girado 180° em torno do eixo vertical em xm */
  function bayEspelhado(c, o, xm) {
    var n0 = c.g.children.length, np = c.parts.length;
    ZG.engineBay(c, o);
    var q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), PI);
    c.g.children.slice(n0).forEach(function (ob) { ob.position.x = 2 * xm - ob.position.x; ob.position.z = -ob.position.z; ob.quaternion.premultiply(q); });
    c.parts.slice(np).forEach(function (p) { p.pos.x = 2 * xm - p.pos.x; p.pos.z = -p.pos.z; });
    var b = c.meta.bay; if (b) { var a = 2 * xm - b.x1, z = 2 * xm - b.x0; b.x0 = a; b.x1 = z; b.center.x = 2 * xm - b.center.x; }
  }
  function antena(c, x, y, z, h) {
    c.cyl(0.03, 0.035, 0.08, PRETO, x, y + 0.04, z);
    var w = c.rod(new V3(x, y + 0.08, z), new V3(x - 0.15, y + h, z), 0.006, PRETO, { r2: 0.003, seg: 5 });
    w.userData.antena = true; (c.milAnt = c.milAnt || []).push(w); return w;
  }

  /* ================================================================ */
  /* Maruá AM2 · Agrale Marruá AM2 (VTNE 1/2 t do Exército)
     Referência (ficha da Agrale/ECSB e Wikipédia, confirmada na web):
       comprimento 3,80 m (com estepe) · largura da carroceria 1,87 m (1,92 m com estribo) · altura 1,95 m com capota (1,40 m com para-brisa rebatido)
       entre-eixos 2,30 m · bitola 1,54 m · pneu 7.50-16 ou 235/85 R16 (≈ 0,81 m) · vão livre 0,27 m (diferencial), assoalho a ≈ 0,52 m
       balanço dianteiro ≈ 0,62 m (ângulo de entrada 64°) · balanço traseiro ≈ 0,88 m com estepe (saída 52°) · 1.960 kg em ordem de marcha · 100 L
     Traços de assinatura:
       frente: painel reto e vertical com grade preta de lâminas horizontais de ponta a ponta; faróis redondos nas pontas, dentro de molduras pretas;
               para-choque de aço reto com dois ganchos de reboque e guincho no meio; luzes de comboio em cima dos para-lamas
       lateral: duas portas só (jipe), caixa reta e baixa, capô comprido e plano, para-brisa quase vertical que rebate, caixas de roda recortadas
               com para-lamas planos, estribo entre as rodas
       traseira: lanternas verticais pequenas, estepe no meio da traseira e galão ao lado, tampa traseira baixa
       teto: capota de lona com arcos marcados do para-brisa até a traseira; estrela branca no capô */
  ZG.register({ k: "marrua", grp: GRP, n: "Maruá AM2", insp: "Agrale Marruá AM2", c: "Viatura leve 4x4", fuel: "diesel",
    d: "Jipe militar de duas portas, capota de lona e para-brisa que rebate. Sobe barranco, atravessa riacho de 60 cm e leva seis com equipamento.",
    mass: 1960, r: 85, seats: "2 + 4 combatentes", cap: "100 L + 20 L de reserva", eff: "9,5 km/L", auto: "1.000 km", vmax: 120, skill: "Direção 2 (4x4 com reduzida)", hood: true
  }, function (c) {
    /* origem no meio do entre-eixos; F = face do painel dianteiro, R = face traseira da caixa */
    var col = OLIVA, WB = 2.3, xf = WB / 2, xr = -WB / 2, F = 1.79, R = -1.6, W = 1.87, wr = 0.365, ww = 0.235, zt = 0.77;
    var s = { W: W, col: col, roofCol: "#5b5a40", bottomY: 0.52, noseY: 1.0, tailY: 1.08,
      lower: [[R, 0.56, 0.05], [R - 0.01, 1.17, 0.04], [0.5, 1.2, 0], [F - 0.06, 1.18, 0.05], [F, 1.06, 0.03], [F, 0.6, 0.04], [F - 0.06, 0.52, 0.04]],
      arches: [[xf, 0.4, 0.47], [xr, 0.4, 0.47]],
      gh: { rb: R + 0.04, rt: R + 0.06, ft: 0.34, fb: 0.42, belt: 1.2, roof: 1.8, Wg: 1.8, k: 0.03, pillars: [-0.6], r1: 0.08, r2: 0.05 },
      seams: [0.38, -0.6], handles: [-0.48], plateRearY: 0.8, tailLightY: 0.86,
      hl: { style: "round", w: 0.2, h: 0.2, y: 0.88, in: 0.07, yaw: 0, dx: 0.06 },
      grille: { style: "bars", w: 1.12, h: 0.3, y: 0.88, emblem: false },
      tl: { style: "vertical", w: 0.09, h: 0.18, y: 0.86, in: 0.05 },
      interior: { rows: 1, col: "#3a3b2e", trim: "#23241e" }, hood: { motor: "diesel" }, noAntenna: true, mirrorCol: "#22231d",
      wheels: [] };
    ZG.car(c, s);
    [xf, xr].forEach(function (x) { [1, -1].forEach(function (sd) { rodaMil(c, x, sd * zt, wr, ww, { label: (x > 0 ? "Pneu dianteiro " : "Pneu traseiro ") + (sd > 0 ? "direito" : "esquerdo") }); }); });
    var m = c.meta, paint = fosco(c, col, { roof: "#5b5a40", roofMat: LONA_CAP });
    /* molduras pretas quadradas em volta dos faróis redondos e o painel preto da grade de ponta a ponta (assinatura do Marruá) */
    /* a casca abaula até F + 0,05: o painel fica à frente dela, senão some dentro da lataria */
    c.rb(0.03, 0.36, W - 0.12, 0.03, PRETO, F + 0.057, 0.88, 0);
    var LAM = CM("#34362f", { metalness: 0.3, roughness: 0.55 });
    for (var gl = 0; gl < 6; gl++) c.rb(0.02, 0.022, 1.0, 0.008, LAM, F + 0.077, 0.775 + gl * 0.042, 0);
    [1, -1].forEach(function (sd) { var rg = c.add(new THREE.TorusGeometry(0.112, 0.022, 8, 28), PRETO, F + 0.075, 0.88, sd * (W / 2 - 0.07 - 0.1)); rg.rotation.y = PI / 2; });
    /* piscas âmbar abaixo dos faróis */
    [1, -1].forEach(function (sd) { c.rb(0.03, 0.05, 0.12, 0.015, MT.amber, F + 0.02, 0.68, sd * (W / 2 - 0.17)); });
    /* bancos de tropa traseiros: dois de cada lado, virados para o corredor */
    bancoLateral(c, -0.7, -1.52, s.bottomY + 0.1, 0.8, -1, { h: 0.42 });
    bancoLateral(c, -0.7, -1.52, s.bottomY + 0.1, -0.8, 1, { h: 0.42 });
    /* para-lamas planos sobre as rodas e estribo */
    var flares = [];
    [1, -1].forEach(function (sd) {
      [xf, xr].forEach(function (x) {
        flares.push(c.rb(1.0, 0.05, 0.14, 0.02, paint, x, 0.9, sd * (W / 2 + 0.04), { def: true }));
        [-1, 1].forEach(function (q) { flares.push(c.rb(0.05, 0.26, 0.14, 0.02, paint, x + q * 0.51, 0.77, sd * (W / 2 + 0.04), { rot: [0, 0, q * 0.5] })); });
      });
      c.rb(1.25, 0.04, 0.12, 0.01, ACO, 0.0, 0.5, sd * (W / 2 - 0.02));
      estrela(c, -0.12, 0.84, sd * (W / 2 + 0.009), 0.15, sd > 0 ? "+z" : "-z", { ring: true });
      c.text("EXÉRCITO", 0.56, 0.1, 1.2, 1.06, sd * (W / 2 + 0.009), sd > 0 ? "+z" : "-z", { fg: "#dcdace", size: 0.7 });
      /* ganchos de reboque */
      c.tube([[F + 0.1, 0.62, sd * 0.52], [F + 0.2, 0.6, sd * 0.52], [F + 0.2, 0.5, sd * 0.52], [F + 0.12, 0.48, sd * 0.52]], 0.024, ACO, { seg: 10, rs: 6 });
      /* luz de comboio (blackout) no para-lama */
      c.rb(0.08, 0.06, 0.1, 0.02, PRETO, F - 0.12, 1.22, sd * (W / 2 - 0.15));
      c.rb(0.01, 0.025, 0.06, 0.005, MT.amber, F - 0.08, 1.22, sd * (W / 2 - 0.15));
      /* travas laterais do capô */
      c.rb(0.06, 0.08, 0.02, 0.01, PRETO, 1.1, 1.13, sd * (W / 2 + 0.006));
    });
    if (c.hood) { var hp = c.hood.piv; estrela(c, 1.1 - hp.position.x, 1.215 - hp.position.y, 0, 0.19, "+y", { ring: true, parent: hp }); }
    /* moldura do para-brisa rebatível com dobradiças e tirantes */
    var gh = s.gh;
    [1, -1].forEach(function (sd) { c.rb(0.06, 0.08, 0.1, 0.02, ACO, gh.fb + 0.02, gh.belt + 0.03, sd * 0.86); c.rb(0.05, 0.05, 0.08, 0.015, ACO, gh.fb - 0.02, gh.belt + 0.03, sd * 0.6); });
    /* capota de lona: teto abaulado entre os arcos (flecha de 4 cm), arcos marcados por baixo da lona e cordões */
    c.milCapota = capotaLona(c, gh.rt + 0.04, gh.ft - 0.06, gh.roof + 0.045, ZG.halfAt(gh.Wg, m.T, gh.roof) - 0.02, 0.5);
    /* estepe no meio da traseira e galão à esquerda */
    /* estepe sem os cravos salientes: de frente eles viravam uma engrenagem */
    var sp = rodaMil(c, 0, 0, wr, ww, { noPart: true, lugs: false }); sp.rotation.y = PI / 2; sp.position.set(R - 0.15, 0.98, 0.18); c.wheels.pop();
    c.part("estepe", "Estepe", sp, new V3(R - 0.15, 0.98, 0.18), 0.5);
    var gal = jerry(c, R - 0.1, 0.98, -0.6, "#3e4a2c", PI / 2);
    c.rb(0.06, 0.1, 0.62, 0.02, ACO, R - 0.03, 0.98, 0.18);
    /* para-choque de aço reto com guincho */
    var pcF = c.rb(0.14, 0.18, W - 0.12, 0.03, ACO, F + 0.07, 0.6, 0, { def: true });
    var winch = c.cyl(0.075, 0.075, 0.36, PRETO, F + 0.1, 0.75, 0, "z");
    antena(c, R + 0.3, 1.2, -0.8, 1.9);
    /* zonas: jipe de duas portas, sem porta traseira; a lateral traseira vai do fim da porta até a traseira */
    var hw = W / 2, y0 = 0.4, y1 = 1.23;
    c.zone("porta_te", false); c.zone("porta_td", false);
    c.zone("porta_de", "Porta esquerda", [-0.62, gh.fb - 0.03, y0, y1, -hw - 0.25, -hw + 0.34], null, { type: "porta", side: -1, hinge: "frente", mirror: true, who: "o motorista" });
    c.zone("porta_dd", "Porta direita", [-0.62, gh.fb - 0.03, y0, y1, hw - 0.34, hw + 0.25], null, { type: "porta", side: 1, hinge: "frente", mirror: true, who: "o carona" });
    c.zone("lateral_te", "Lateral traseira esquerda", [R + 0.2, -0.62, y0, y1, -hw - 0.25, -hw + 0.34], null, { side: -1, fxKey: "lateral", who: "quem vai atrás à esquerda" });
    c.zone("lateral_td", "Lateral traseira direita", [R + 0.2, -0.62, y0, y1, hw - 0.34, hw + 0.25], null, { side: 1, fxKey: "lateral", who: "quem vai atrás à direita" });
    c.zone("teto", "Capota de lona e para-brisa", null, c.milCapota);
    c.zone("parachoque_d", "Para-choque e guincho", null, [pcF, winch]);
    c.zone("estepe", "Estepe e galão", [R - 0.42, R + 0.05, 0.5, 1.45, -0.85, 0.65], [sp, gal], { type: "peca", fxKey: "roda", dir: "frente" });
    c.zone("tampa", "Tampa traseira", [R - 0.15, R + 0.3, 0.6, 1.25, -hw + 0.12, hw - 0.12]);
    void flares;
    capotagem(c);
    m.armor = function (c2) { marruaMod(c2, s, F, R, W); };
  });
  function marruaMod(c, s, F, R, W) {
    var gh = s.gh, m = c.meta, q = m.quadF, paint = tinta(c, OLIVA);
    /* capota rebatida: some a lona (teto, laterais e vidros de plástico) e fica só o para-brisa com moldura */
    var hide = new Set(c.milCapota || []);
    c.g.children.forEach(function (o) {
      if (!o.isMesh) return;
      var g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      var ce = g.boundingSphere.center.clone().applyMatrix4(o.matrix);
      if (o.material === LONA_CAP || o.material === MT.headliner) hide.add(o);
      else if (g.type === "TubeGeometry" && o.material === MT.trim && ce.y > gh.belt && ce.x < gh.fb - 0.02) hide.add(o);
      else if (ce.y > gh.roof - 0.25 && ce.x > gh.rt - 0.1 && ce.x < gh.ft + 0.05 && Math.abs(ce.z) < 0.95 && !o.userData.glass && !o.userData.antena) hide.add(o);
    });
    c.glass.forEach(function (gm) { if (gm.userData.glass && gm.userData.glass.label !== "Para-brisa") hide.add(gm); });
    hide.forEach(function (o) { o.visible = false; var i = c.deform.indexOf(o); if (i >= 0) c.deform.splice(i, 1); });
    c.parts = c.parts.filter(function (p) { return !(p.obj && hide.has(p.obj)); });
    c.glass = c.glass.filter(function (gm) { return !hide.has(gm); });
    m.roof = null;
    if (q) {
      var e = 0.035;
      c.rod(new V3(q.t[0], q.t[1] + 0.02, -q.ht - e), new V3(q.t[0], q.t[1] + 0.02, q.ht + e), 0.03, paint);
      [1, -1].forEach(function (sd) { c.rod(new V3(q.b[0], q.b[1], sd * (q.hb + e)), new V3(q.t[0], q.t[1] + 0.02, sd * (q.ht + e)), 0.03, paint); });
    }
    /* lona dobrada e amarrada atrás do banco traseiro */
    c.cyl(0.14, 0.14, 1.62, LONA_CAP, gh.rb + 0.16, gh.belt + 0.12, 0, "z", { seg: 16 });
    [-0.5, 0, 0.5].forEach(function (z) { c.cyl(0.147, 0.147, 0.04, PRETO, gh.rb + 0.16, gh.belt + 0.12, z, "z", { seg: 16 }); });
    /* quebra-mato tubular */
    [1, -1].forEach(function (sd) { c.tube([[F + 0.08, 0.55, sd * 0.75], [F + 0.3, 0.6, sd * 0.75], [F + 0.32, 1.15, sd * 0.7], [F + 0.15, 1.3, sd * 0.6]], 0.04, ACO, { seg: 20 }); });
    [0.75, 1.0, 1.2].forEach(function (y) { c.rod(new V3(F + 0.31, y, -0.75), new V3(F + 0.31, y, 0.75), 0.03, ACO); });
    /* snorkel */
    c.tube([[F - 0.6, 1.0, W / 2 + 0.06], [gh.fb + 0.05, 1.1, W / 2 + 0.08], [gh.fb - 0.05, 1.9, W / 2 + 0.06], [gh.fb + 0.1, 2.05, W / 2]], 0.055, PRETO, { seg: 24, rs: 10 });
    c.rb(0.16, 0.14, 0.14, 0.04, PRETO, gh.fb + 0.14, 2.06, W / 2 - 0.02);
    /* santo-antônio com metralhadora no pedestal (agora a céu aberto) */
    [1, -1].forEach(function (sd) { c.rod(new V3(-0.6, 1.2, sd * 0.86), new V3(-0.6, 2.25, sd * 0.8), 0.035, ACO); });
    c.rod(new V3(-0.6, 2.25, -0.8), new V3(-0.6, 2.25, 0.8), 0.035, ACO);
    c.rod(new V3(-0.6, 1.25, 0), new V3(-0.6, 2.35, 0), 0.04, ACO);
    metralhadora(c, -0.55, 2.42, 0, { len: 1.4 });
    c.rb(0.04, 0.32, 0.5, 0.02, ACO, -0.32, 2.48, 0);
    /* bagageiro preso ao santo-antônio e a dois montantes atrás, coberto pela rede */
    c.rb(0.9, 0.04, 1.3, 0.01, ACO, -1.1, 1.95, 0);
    [1, -1].forEach(function (sd) { c.rod(new V3(-0.6, 2.0, sd * 0.62), new V3(R + 0.06, 1.95, sd * 0.62), 0.025, ACO); c.rod(new V3(R + 0.06, 1.2, sd * 0.62), new V3(R + 0.06, 1.95, sd * 0.62), 0.025, ACO); });
    c.rb(0.75, 0.3, 1.0, 0.06, CM("#4a4b3a", { roughness: 0.95 }), -1.1, 2.12, 0);
    redeCamuflagem(c, R + 0.02, -0.66, 2.27, 1.2, 0.32);
    /* galões nas laterais traseiras */
    [1, -1].forEach(function (sd) { jerry(c, -1.3, 1.0, sd * (W / 2 + 0.1), sd > 0 ? AREIA : "#3e4a2c", 0); });
    /* sacos de areia na frente do capô (a estrela fica livre) */
    sacosAreia(c, -0.62, 0.62, 1.27, 1.55, "z", 1);
    /* faróis de milha extras */
    [1, -1].forEach(function (sd) { c.cyl(0.09, 0.07, 0.12, PRETO, F + 0.3, 1.3, sd * 0.4, "x"); c.cyl(0.075, 0.075, 0.01, MT.head, F + 0.37, 1.3, sd * 0.4, "x"); });
  }

  /* ================================================================ */
  /* Worqer 15.210 Militar · Volkswagen Worker 15.210 4x4 do Exército (VOP 5 t, "VTNE 5 t"), cabine avançada basculante
     Referência (a VWCO não publica a ficha da versão militar; medidas de memória e por proporção de fotos, marcadas como estimadas):
       comprimento ≈ 7,40 m · largura ≈ 2,48 m (carroceria 2,46 m, sem retrovisores) · altura ≈ 3,35 m na lona (cabine ≈ 3,05 m)
       entre-eixos ≈ 4,10 m · bitola ≈ 1,95 m · pneu 14.00 R20 simples (≈ 1,24 m) · balanço dianteiro ≈ 1,35 m · traseiro ≈ 1,95 m
       vão livre ≈ 0,35 m (eixos), quadro a ≈ 0,98 m · motor MWM 6.10 TCA de 206 cv (confirmado na web) · carga 5 t (confirmado)
     Traços de assinatura:
       frente: cabine avançada alta e chata, para-brisa inteiriço quase vertical, faixa de lâminas horizontais pretas sob o para-brisa,
               faróis retangulares embutidos no para-choque de aço, guincho e ganchos no para-choque, quebra-sol com luzes âmbar
       lateral: porta com janela que desce na frente, degraus de acesso atrás da roda dianteira, retrovisores grandes em braço tubular,
                tanque de diesel e caixa de baterias entre os eixos, rodas simples com cravos em V atrás
       traseira: carroceria de guardas baixas com tampa baixada, lanternas redondas duplas, engate no para-choque
       teto: lona arredondada sobre cinco arcos, estrela branca na lona, antena de rádio atrás da cabine */
  function cabMil(c, o) {
    var f = o.f, W = o.W, len = o.len, ry = o.roof, belt = o.belt, bot = o.bot, fl = o.floor, col = o.col;
    var m = c.meta; m.col = col; m.kind = "truck";
    var ws0 = [f + 0.02, belt - 0.03], ws1 = [f - 0.13, ry - 0.2];
    var items = [[f - len, bot, 0.06], [f - len - 0.01, ry - 0.08, 0.16], [ws1[0] - 0.32, ry, 0.18], [ws1[0], ws1[1], 0.1], [ws0[0], ws0[1], 0.1], [f + 0.04, bot + 0.3, 0.1], [f, bot, 0.05]];
    var T = { belt: belt, top: ry + 0.03, k: 0.045 };
    function wsx(y) { return ws0[0] + (ws1[0] - ws0[0]) * (y - ws0[1]) / (ws1[1] - ws0[1]); }
    function l2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    var q = ZG.quadDef(l2(ws0, ws1, 0.05), l2(ws0, ws1, 0.93), W, T, "front", 0.05, { inset: 0.04, side: 0.11 });
    var yb = belt + 0.06, ty = ry - 0.27, xr = f - len * 0.62;
    var poly = [[xr, yb], [wsx(yb) - 0.2, yb], [wsx(ty) - 0.2, ty], [xr, ty]];
    ZG.shell(c, { items: items, bottomY: bot, arches: [[o.ax, o.wr, o.wr + 0.08]], W: W, col: col, T: T, holes: [ZG.holeSide(poly), ZG.holeQuad(q)], archInner: W / 2 - o.ww - 0.16 });
    ZG.glassQuad(c, q, "Para-brisa");
    ZG.sideWindows(c, [poly], W, T, function () { return "Janela da porta"; });
    Object.assign(m, { W: W, front: f + 0.1, clear: bot, belt: belt, top: ry + 0.03, bodyH: belt - bot, T: T, quadF: q, gh: { fb: f, belt: belt + 0.03, Wg: W }, cabRear: f - len });
    var zi = W / 2 - 0.13, fab = CM("#3c3e30", { roughness: 0.9 }), trim = CM("#25261f", { roughness: 0.75 }), xd = wsx(belt);
    c.rb(len - 0.28, 0.04, zi * 2, 0.015, MT.carpet, f - len / 2 - 0.04, fl, 0);
    c.rb(0.62, 0.22, 0.5, 0.09, trim, f - len * 0.5, fl + 0.1, 0);
    ZG.dashboard(c, { x: xd - 0.07, y: belt + 0.02, w: zi * 2, d: 0.48, h: Math.min(0.55, belt - fl - 0.08), drv: -zi * 0.52, mat: trim, top: fab, screen: false });
    ZG.steeringWheel(c, xd - 0.66, belt + 0.06, -zi * 0.52, { r: 0.23, tilt: 1.12, col: 0.5, mat: trim });
    var sx = Math.max(f - len + 0.62, xd - 1.08);
    ZG.seat(c, sx, fl, -zi * 0.52, { w: 0.5, mat: fab, h: 0.44, back: 0.64, lean: 0.18 });
    ZG.seat(c, sx, fl, zi * 0.42, { w: zi * 0.98, n: 2, mat: fab, h: 0.44, back: 0.6, lean: 0.18 });
    c.rod(new V3(sx + 0.55, fl, -0.05), new V3(sx + 0.5, fl + 0.48, -0.08), 0.014, ACO); c.sph(0.035, PRETO, sx + 0.5, fl + 0.5, -0.08);
    /* rádio militar no painel e fuzil preso atrás do banco */
    c.rb(0.25, 0.16, 0.34, 0.02, CM("#3b402d", { roughness: 0.7 }), xd - 0.35, belt + 0.12, 0.1);
    for (var k = 0; k < 3; k++) c.cyl(0.015, 0.015, 0.02, MT.gauge, xd - 0.47, belt + 0.14, 0.0 + k * 0.08, "x");
    c.rb(0.03, ry - fl - 0.12, zi * 2, 0.01, trim, f - len + 0.07, (ry + fl) / 2, 0);
    c.rb(len - 0.45, 0.02, zi * 1.8, 0.01, MT.headliner, f - len / 2 - 0.05, ry - 0.07, 0).castShadow = false;
    [1, -1].forEach(function (s) { c.rb(len * 0.55, belt - fl - 0.06, 0.03, 0.012, trim, f - len * 0.42, (belt + fl) / 2, s * (zi + 0.03)); });
    var stepX = o.ax - o.wr - 0.24;
    [1, -1].forEach(function (s) {
      var zs = s * (W / 2 + 0.003);
      c.rb(0.012, belt - bot + 0.55, 0.006, 0.003, MT.dark, xr - 0.06, (belt + bot) / 2 + 0.3, zs);
      c.rb(0.012, belt - bot + 0.35, 0.006, 0.003, MT.dark, f - 0.1, (belt + bot) / 2 + 0.15, zs);
      c.rb(0.16, 0.045, 0.03, 0.012, PRETO, xr + 0.2, belt - 0.12, s * (W / 2 + 0.012));
      [bot - 0.02, bot + 0.3].forEach(function (y, i) { c.rb(0.42, 0.04, 0.22, 0.01, ACO, stepX, y, s * (W / 2 - 0.1 - i * 0.05)); });
      c.rod(new V3(xr - 0.02, belt - 0.3, s * (W / 2 + 0.04)), new V3(xr - 0.02, belt + 0.45, s * (W / 2 + 0.04)), 0.016, PRETO);
      var mx = f - 0.2, mz = s * (W / 2 + 0.3);
      c.tube([[mx - 0.05, belt + 0.55, s * (W / 2 - 0.02)], [mx + 0.1, belt + 0.66, s * (W / 2 + 0.16)], [mx + 0.13, belt + 0.5, mz]], 0.018, PRETO, { seg: 16, rs: 6 });
      c.rb(0.07, 0.44, 0.2, 0.03, PRETO, mx + 0.13, belt + 0.3, mz);
      c.rb(0.01, 0.4, 0.17, 0.008, MT.steel, mx + 0.093, belt + 0.3, mz);
      estrela(c, f - len * 0.32, belt - 0.35, s * (W / 2 + 0.01), 0.17, s > 0 ? "+z" : "-z", { ring: true });
    });
    [-0.38, 0.38].forEach(function (z) { var y0 = belt + 0.05; c.rod(new V3(wsx(y0) + 0.06, y0, z - 0.25), new V3(wsx(y0 + 0.5) + 0.06, y0 + 0.5, z + 0.05), 0.011, MT.trim); });
    /* frente: grade preta larga de lâminas horizontais, faixa abaixo do para-brisa e quebra-sol */
    var fx = function (y) { return ZG.profX(items, y, true); };
    /* a casca abaula ≈ 5 cm à frente do perfil: painel, lâminas e faixa ficam à frente dela */
    c.rb(0.04, 0.62, 1.7, 0.04, PRETO, fx(1.5) + 0.065, 1.5, 0);
    for (var sl = 0; sl < 5; sl++) c.rb(0.03, 0.05, 1.6, 0.02, CM("#34362f", { metalness: 0.3, roughness: 0.55 }), fx(1.5) + 0.09, 1.27 + sl * 0.12, 0);
    c.rb(0.04, 0.13, W * 0.88, 0.03, PRETO, fx(belt - 0.14) + 0.075, belt - 0.14, 0);
    c.text("EXÉRCITO", 0.9, 0.12, fx(belt - 0.14) + 0.1, belt - 0.14, 0, "+x", { fg: "#dcdace", size: 0.75 });
    /* quebra-sol encostado no teto: aba grossa de cantos arredondados com dois suportes */
    c.rb(0.3, 0.09, W * 0.92, 0.04, c.paint(col), ws1[0] + 0.06, ry - 0.035, 0, { rot: [0, 0, -0.12], def: true });
    [-0.7, 0.7].forEach(function (z) { c.rb(0.16, 0.12, 0.05, 0.02, c.paint(col), ws1[0] - 0.04, ry - 0.07, z); });
    for (var k2 = -1; k2 <= 1; k2++) c.rb(0.05, 0.035, 0.08, 0.012, MT.amber, ws1[0] + 0.08, ry - 0.09, k2 * 0.35);
    /* fundo e parede traseira próprios: com a cabine basculada não aparece vão aberto */
    var zf = W / 2 - o.ww - 0.2;
    c.rb(len - 0.12, 0.05, zf * 2, 0.02, CM("#2e3127", { roughness: 0.9 }), f - len / 2, bot + 0.035, 0);
    c.rb(0.05, ry - bot - 0.2, W - 0.14, 0.03, c.paint(col), f - len + 0.035, (ry + bot) / 2 - 0.02, 0);
    return { items: items, q: q, wsx: wsx, xr: xr, T: T, fx: fx };
  }
  /* carroceria de carga com guardas, arcos e lona; a traseira fica aberta e mostra os bancos */
  function carroceriaLona(c, o) {
    var x0 = o.x0, x1 = o.x1, y0 = o.y0, W = o.W, sideH = o.sideH || 0.62, bowH = o.bowH || 1.55, L = x0 - x1, cx = (x0 + x1) / 2;
    var wood = tinta(c, OLIVA2), m = c.meta;
    var floor = c.rb(L, 0.1, W, 0.02, wood, cx, y0, 0, { def: true });
    c.rb(L - 0.1, 0.14, 0.2, 0.02, MT.trim, cx, y0 - 0.12, 0.45); c.rb(L - 0.1, 0.14, 0.2, 0.02, MT.trim, cx, y0 - 0.12, -0.45);
    for (var xs = x1 + 0.2; xs < x0; xs += 0.55) c.rb(0.08, 0.1, W - 0.05, 0.02, MT.trim, xs, y0 - 0.1, 0);
    var sides = [];
    [1, -1].forEach(function (s) {
      var sd = c.rb(L, sideH, 0.06, 0.02, wood, cx, y0 + sideH / 2 + 0.05, s * (W / 2 - 0.03), { def: true }); sides.push(sd);
      for (var x = x1 + 0.3; x < x0 - 0.1; x += 0.9) c.rb(0.06, sideH + 0.02, 0.03, 0.01, ACO, x, y0 + sideH / 2 + 0.05, s * (W / 2 + 0.005));
      [0.15, 0.45].forEach(function (t) { c.rb(L, 0.03, 0.015, 0.006, CM("#3a3c2e", { roughness: 0.9 }), cx, y0 + 0.05 + sideH * t * 2, s * (W / 2 + 0.002)); });
    });
    c.rb(0.06, sideH, W, 0.02, wood, x0 - 0.03, y0 + sideH / 2 + 0.05, 0, { def: true });
    /* tampa traseira baixada */
    var tg = c.rb(0.06, sideH * 0.7, W - 0.1, 0.02, wood, x1 - 0.02, y0 - sideH * 0.3, 0); tg.rotation.z = 0.08;
    /* lona: teto arredondado por loft ao longo de x, com arcos marcados */
    var top = y0 + sideH + bowH, yb = y0 + sideH + 0.05, nseg = 20, pos = [], idx = [];
    var hw = W / 2 + 0.02, nx = 12;
    for (var i = 0; i <= nx; i++) {
      var x = x1 + 0.02 + (L - 0.04) * i / nx;
      for (var j = 0; j <= nseg; j++) {
        var a = j / nseg * PI, zz = -Math.cos(a) * hw, ww = Math.sin(a);
        var yy = yb + (top - yb - 0.25) * Math.min(1, ww * 3) + 0.25 * Math.pow(ww, 3);
        if (j === 0 || j === nseg) yy = yb - 0.05;
        var sag = (i % 2 === 1) ? -0.035 * ww : 0;
        pos.push(x, yy + sag, zz * (1 - 0.06 * Math.pow(ww, 4)));
      }
    }
    for (i = 0; i < nx; i++) for (j = 0; j < nseg; j++) { var a0 = i * (nseg + 1) + j, b0 = a0 + nseg + 1; idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    var lona = c.add(g, LONA); c.deform.push(lona);
    /* parede dianteira da lona */
    var fs = new THREE.Shape(); fs.moveTo(-hw, yb - 0.05);
    for (j = 0; j <= nseg; j++) { var aa = j / nseg * PI, w2 = Math.sin(aa); fs.lineTo(-Math.cos(aa) * hw, j === 0 || j === nseg ? yb - 0.05 : yb + (top - yb - 0.25) * Math.min(1, w2 * 3) + 0.25 * Math.pow(w2, 3)); }
    var fg = new THREE.ShapeGeometry(fs); var fw = c.add(fg, LONA2, x0 - 0.02, 0, 0); fw.rotation.y = PI / 2;
    /* aba traseira enrolada no alto */
    c.cyl(0.09, 0.09, W * 0.86, LONA2, x1 + 0.02, top - 0.32, 0, "z");
    [-1, 1].forEach(function (s) { c.rod(new V3(x1 + 0.02, top - 0.3, s * W * 0.3), new V3(x1 + 0.02, top - 0.45, s * W * 0.3), 0.012, PRETO); });
    /* interior: assoalho, bancos laterais virados para o centro e arcos */
    bancoLateral(c, x0 - 0.2, x1 + 0.25, y0 + 0.05, W / 2 - 0.1, -1, { h: 0.45 });
    bancoLateral(c, x0 - 0.2, x1 + 0.25, y0 + 0.05, -(W / 2 - 0.1), 1, { h: 0.45 });
    for (var bx = x1 + 0.1; bx <= x0 - 0.05; bx += (L - 0.15) / 4) {
      var pts = []; for (j = 0; j <= 12; j++) { var a3 = j / 12 * PI, w3 = Math.sin(a3); pts.push([bx, yb + (top - yb - 0.25) * Math.min(1, w3 * 3) + 0.25 * Math.pow(w3, 3) - 0.04, -Math.cos(a3) * (hw - 0.04)]); }
      c.tube(pts, 0.02, ACO, { seg: 24, rs: 5 });
    }
    /* mochilas e caixa de munição no assoalho */
    c.rb(0.5, 0.3, 0.35, 0.03, CM("#3f4a2c", { roughness: 0.6 }), x0 - 0.6, y0 + 0.2, 0.1);
    c.rb(0.35, 0.4, 0.25, 0.08, CM("#5a5a3e", { roughness: 0.95 }), x0 - 1.2, y0 + 0.25, -0.2);
    c.part("carga", "Carroceria e lona", lona, new V3(cx, y0 + 1.0, 0), 1.8);
    m.roof = { x0: x1 + 0.3, x1: x0 - 0.3, w: W - 0.6, y: top }; m.top = top; m.bodyH = Math.max(m.bodyH || 0, 1.2);
    return { lona: lona, floor: floor, top: top };
  }
  ZG.register({ k: "worker", grp: GRP, n: "Worqer 15.210 Militar", insp: "Volkswagen Worker 15.210 4x4 militar", c: "Caminhão de tropa 4x4", fuel: "diesel",
    d: "Cabine avançada que bascula, tração 4x4 e carroceria com lona e dois bancos de madeira. Leva um pelotão inteiro ou cinco toneladas de suprimentos.",
    mass: 9800, r: 120, seats: "3 + 20 combatentes", cap: "275 L", eff: "3,6 km/L", auto: "950 km", vmax: 95, skill: "Direção pesada 2 (4x4)", hood: true
  }, function (c) {
    var f = 3.55, W = 2.36, len = 1.95, ax = 2.45, wr = 0.56, ww = 0.36, col = OLIVA, rax = -1.65;
    var n0 = c.g.children.length;
    var cab = cabMil(c, { f: f, W: W, len: len, roof: 3.05, belt: 1.92, bot: 0.98, floor: 1.4, ax: ax, wr: wr, ww: ww, col: col });
    var cabObjs = c.g.children.slice(n0);
    /* motor diesel de seis cilindros entre as longarinas, na altura do quadro, logo abaixo do piso da cabine */
    var nB = c.g.children.length, bc = new V3(f - len / 2 + 0.25, 1.0, 0);
    ZG.engineBay(c, { x0: f - len + 0.12, x1: f - 0.45, zw: 0.42, floor: 0.8, top: 1.5, motor: "diesel", col: "#3a3c32" });
    escala(c, nB, bc, 1.35);
    c.parts.forEach(function (p) { if (p.kind === "motor" || p.kind === "radiador") p.pos.sub(bc).multiplyScalar(1.35).add(bc); });
    /* cabine bascula até passar da vertical: o motor fica livre para quem olha pela frente e por cima */
    basculante(c, cabObjs, new V3(f - 0.02, 1.0, 0), { len: len, open: 1.68 });
    if (c.meta.bay) { c.meta.bay.center.set(bc.x - 0.25, 2.25, -0.3); c.meta.bay.zw = 0.58; }
    var m = c.meta;
    /* para-choque de aço, faróis retangulares e de comboio, guincho */
    var by = 0.82;
    m.bumperF = c.rb(0.26, 0.34, W + 0.06, 0.05, ACO, f + 0.12, by, 0, { def: true });
    c.part("parachoque", "Para-choque dianteiro", m.bumperF, new V3(f + 0.2, by, 0), 1.1);
    [1, -1].forEach(function (s) {
      c.rb(0.06, 0.27, 0.53, 0.03, PRETO, f + 0.235, by + 0.03, s * (W / 2 - 0.36));
      ZG.headlight(c, { style: "rect", x: f + 0.25, y: by + 0.03, z: s * (W / 2 - 0.36), w: 0.45, h: 0.2, d: 0.07, side: s });
      /* refletor prateado atrás da lente: o farol se lê como um retângulo inteiro, não dois pontos */
      c.rb(0.004, 0.17, 0.42, 0.002, CM("#aeb4b4", { metalness: 0.2, roughness: 0.35, emissive: new THREE.Color("#2a2c2a") }), f + 0.288, by + 0.03, s * (W / 2 - 0.36));
      c.rb(0.06, 0.07, 0.1, 0.02, PRETO, f + 0.27, by + 0.03, s * (W / 2 - 0.08));
      c.rb(0.01, 0.025, 0.06, 0.005, MT.amber, f + 0.305, by + 0.03, s * (W / 2 - 0.08));
      c.tube([[f + 0.25, by - 0.12, s * 0.45], [f + 0.38, by - 0.14, s * 0.45], [f + 0.38, by - 0.26, s * 0.45], [f + 0.28, by - 0.28, s * 0.45]], 0.03, PRETO, { seg: 10, rs: 6 });
      rodaMil(c, ax, s * (W / 2 - ww / 2 - 0.02), wr, ww, { label: "Pneu dianteiro " + (s > 0 ? "direito" : "esquerdo") });
    });
    c.cyl(0.1, 0.1, 0.5, PRETO, f + 0.3, by + 0.05, 0, "z");
    c.text("EB-34 1720", 0.5, 0.12, f + 0.26, by - 0.08, 0, "+x", { fg: "#e4e2d6", bg: "#24261d", size: 0.6 });
    /* chassi, eixo traseiro, rodas simples, tanque, baterias, estepe */
    [0.45, -0.45].forEach(function (z) { c.rb(f + 3.6, 0.26, 0.1, 0.02, MT.trim, (f - 3.85) / 2 + 0.1, 0.98, z); });
    [ax, rax].forEach(function (x) { c.cyl(0.09, 0.09, W - 0.5, MT.trim, x, wr, 0, "z"); c.sph(0.22, MT.trim, x, wr, 0, 1, 1, 0.9); });
    [1, -1].forEach(function (s) {
      rodaMil(c, rax, s * (W / 2 - ww / 2 - 0.02), wr, ww, { label: "Pneu traseiro " + (s > 0 ? "direito" : "esquerdo") });
      c.rb(1.3, 0.05, ww + 0.1, 0.02, ACO, rax, wr * 2 + 0.12, s * (W / 2 - ww / 2 - 0.02));
      [-1, 1].forEach(function (q) { c.rb(0.04, 0.35, ww + 0.1, 0.02, ACO, rax + q * 0.66, wr * 2 - 0.05, s * (W / 2 - ww / 2 - 0.02), { rot: [0, 0, -q * 0.4] }); });
      c.rb(0.02, 0.5, ww + 0.1, 0.01, MT.rubber, rax - 0.72, 0.6, s * (W / 2 - ww / 2));
      c.rb(1.9, 0.08, 0.04, 0.01, ACO, 0.4, 0.7, s * (W / 2 - 0.05));
    });
    var tank = c.rb(0.9, 0.5, 0.55, 0.18, tinta(c, OLIVA2), 0.65, 0.85, -(W / 2 - 0.36), { def: true });
    c.cyl(0.06, 0.06, 0.04, MT.trim, 0.9, 1.12, -(W / 2 - 0.3));
    c.part("tanque", "Tanque de diesel", tank, new V3(0.65, 0.85, -(W / 2 - 0.36)), 0.8);
    var bat = c.rb(0.6, 0.42, 0.45, 0.04, PRETO, 0.65, 0.85, W / 2 - 0.36);
    c.part("bateria", "Caixa de baterias", bat, new V3(0.65, 0.85, W / 2 - 0.36), 0.7);
    var sp = rodaMil(c, -0.4, 0, wr, ww, { noPart: true, y: 0.85 }); sp.rotation.x = PI / 2; sp.position.set(-0.45, 0.82, 0); c.wheels.pop();
    c.cyl(0.13, 0.13, 0.5, CM("#2f312a", { metalness: 0.5 }), 1.5, 0.75, 0.75, "x");
    c.tube([[1.25, 0.75, 0.75], [1.0, 0.85, 1.05], [1.0, 3.2, 1.05]], 0.05, CM("#2f312a", { metalness: 0.5 }), { seg: 16 });
    var rear = -3.52;
    var body = carroceriaLona(c, { x0: f - len - 0.15, x1: rear, y0: 1.32, W: 2.46, sideH: 0.6, bowH: 1.45 });
    /* zonas: a lona e os arcos formam o teto da carroceria; a cabine basculante ganha o teto e o quebra-sol */
    c.zone("lona", "Lona e arcos da carroceria", [rear - 0.1, f - len - 0.1, 1.95, body.top + 0.2, -1.4, 1.4], [body.lona], { type: "teto", fxKey: "teto", dir: "cima", who: "a tropa na carroceria" });
    c.zone("cab_teto", "Teto da cabine", [f - len - 0.1, f + 0.15, 2.75, 3.3, -W / 2 - 0.05, W / 2 + 0.05], null, { type: "teto", fxKey: "teto", dir: "cima", who: "o motorista" });
    /* para-choque traseiro, lanternas e engate */
    m.bumperR = c.rb(0.14, 0.18, W - 0.2, 0.03, ACO, rear + 0.08, 0.8, 0, { def: true });
    c.part("parachoque", "Para-choque traseiro", m.bumperR, new V3(rear, 0.8, 0), 1.0);
    [1, -1].forEach(function (s) { ZG.taillight(c, { style: "round2", x: rear + 0.02, y: 1.05, z: s * (W / 2 - 0.3), w: 0.26, h: 0.12, d: 0.06, side: s }); });
    c.cyl(0.05, 0.05, 0.2, ACO, rear - 0.05, 0.8, 0, "x"); c.text("EB-34 1720", 0.5, 0.12, rear - 0.005, 1.0, 0, "-x", { fg: "#e4e2d6", bg: "#24261d", size: 0.6 });
    c.milLonaStars = [1, -1].map(function (s) { return estrela(c, -1.0, 2.6, s * 1.255, 0.3, s > 0 ? "+z" : "-z", { ring: true, mat: CM("#d2d0c2", { roughness: 0.95 }) }); });
    antena(c, f - len + 0.1, 3.05, -0.9, 2.2);
    c.part("cabine", "Cabine", null, new V3(f - len / 2, 2.2, W / 2), 1.0);
    m.front = f + 0.3; m.rear = rear; m.L = m.front - rear; m.clear = 0.6; m.belt = 1.92; m.bodyH = 1.4;
    fosco(c, col);
    capotagem(c);
    /* batido: além do padrão, quina dianteira esquerda da cabine e guarda da carroceria bem amassadas */
    m.damage = function (c2) {
      ZG.defaultDamage(c2);
      ZG.impact(c2, new V3(f - 0.05, 2.15, -(W / 2 - 0.1)), new V3(0.55, -0.1, 0.83), 1.3);
      ZG.impact(c2, new V3(-1.6, 1.75, -1.23), new V3(0, 0, 1), 1.25, { noBlood: true });
      ZG.impact(c2, new V3(-2.9, 2.9, -1.2), new V3(0, -0.35, 0.94), 1.1, { noBlood: true });
    };
    m.armor = function (c2) { workerMod(c2, f, len, W, rear, body.top); };
  });
  function workerMod(c, f, len, W, rear, top) {
    /* chapas na porta e grade sobre o para-brisa, metralhadora no anel da cabine, sacos de areia na carroceria */
    var m = c.meta, q = m.quadF;
    if (q) { var off = 0.08; for (var t = -1; t <= 1.0001; t += 0.125) c.rod(new V3(q.b[0] + q.n[0] * off, q.b[1] + q.n[1] * off, t * q.hb), new V3(q.t[0] + q.n[0] * off, q.t[1] + q.n[1] * off, t * q.ht), 0.016, ACO); }
    [1, -1].forEach(function (s) {
      c.rb(1.1, 0.95, 0.05, 0.02, ZG.STEELM, f - len * 0.55, 1.95, s * (W / 2 + 0.05), { rot: [0, 0, (ZG.hash(s, 1, 2) - 0.5) * 0.06] });
      [-1, 1].forEach(function (u) { [-1, 1].forEach(function (v) { c.sph(0.02, MT.steel, f - len * 0.55 + u * 0.48, 1.95 + v * 0.42, s * (W / 2 + 0.08)); }); });
      slat(c, rear + 0.1, f - len - 0.3, 1.45, 1.95, s * (W / 2 + 0.25));
    });
    c.cyl(0.42, 0.42, 0.06, ACO, f - len * 0.55, 3.12, 0.35, null, { seg: 24, open: false });
    metralhadora(c, f - len * 0.55, 3.35, 0.35, { len: 1.5 });
    c.rb(0.04, 0.34, 0.55, 0.02, ACO, f - len * 0.55 + 0.25, 3.42, 0.35);
    sacosAreia(c, rear + 0.3, f - len - 0.5, 1.98, 1.05, "x", 1); sacosAreia(c, rear + 0.3, f - len - 0.5, 1.98, -1.05, "x", 1);
    /* rede sobre a lona, acompanhando o arredondado dela; as estrelas da lona ficam cobertas (escondidas) */
    var yb = 1.32 + 0.6 + 0.05, hwc = 2.46 / 2 + 0.02;
    var prof = function (z) { var t = Math.min(1, Math.abs(z) / hwc), sn = Math.sqrt(1 - t * t); return t >= 1 ? yb - 0.05 : yb + (top - yb - 0.25) * Math.min(1, sn * 3) + 0.25 * Math.pow(sn, 3); };
    redeCamuflagem(c, rear + 0.15, f - len - 0.2, top, 2.5, 0.75, prof);
    (c.milLonaStars || []).forEach(function (st) { st.visible = false; if (st.userData.ring) st.userData.ring.visible = false; });
    [0.6, 0.2, -0.2].forEach(function (z, i) { jerry(c, rear - 0.05, 1.35, z, i % 2 ? AREIA : "#3e4a2c", PI / 2); });
    [1, -1].forEach(function (s) { c.tube([[f + 0.25, 0.7, s * 0.9], [f + 0.5, 0.75, s * 0.9], [f + 0.5, 1.6, s * 0.85], [f + 0.25, 1.75, s * 0.8]], 0.05, ACO, { seg: 20 }); });
    [0.95, 1.25, 1.55].forEach(function (y) { c.rod(new V3(f + 0.5, y, -0.9), new V3(f + 0.5, y, 0.9), 0.035, ACO); });
  }

  /* compartimento do motor deslocado para um lado (motor dianteiro direito dos blindados) */
  function bayDeslocado(c, o, dz) {
    var n0 = c.g.children.length, np = c.parts.length;
    ZG.engineBay(c, o);
    c.g.children.slice(n0).forEach(function (ob) { ob.position.z += dz; });
    c.parts.slice(np).forEach(function (p) { p.pos.z += dz; });
    if (c.meta.bay) c.meta.bay.center.z += dz;
  }
  /* farol militar protegido: caixa, farol e grade de barras */
  function farolProtegido(c, x, y, z, s, o) {
    o = o || {};
    c.rb(0.16, 0.24, 0.32, 0.03, ACO, x - 0.05, y, z);
    var L = ZG.headlight(c, { style: o.style || "rect", x: x + 0.02, y: y, z: z, w: o.w || 0.26, h: o.h || 0.15, d: 0.06, side: s, noPart: o.noPart });
    for (var k = -1; k <= 1; k++) c.rod(new V3(x + 0.08, y - 0.12, z + k * 0.1), new V3(x + 0.08, y + 0.12, z + k * 0.1), 0.01, ACO, { seg: 5 });
    c.rod(new V3(x + 0.08, y + 0.12, z - 0.15), new V3(x + 0.08, y + 0.12, z + 0.15), 0.012, ACO, { seg: 5 });
    return L;
  }
  /* estação de armas remotamente controlada (genérica) */
  function estacaoArmas(c, x, y, z, o) {
    o = o || {}; var g = new THREE.Group(); g.position.set(x, y, z); g.userData.rigid = true; c.g.add(g);
    var mat = o.mat || ACO;
    c.cyl(0.42, 0.46, 0.12, mat, 0, 0.06, 0, null, { seg: 24, parent: g });
    c.rb(0.75, 0.32, 0.48, 0.06, mat, -0.05, 0.3, 0.05, { parent: g });
    c.rb(0.3, 0.26, 0.24, 0.04, mat, 0.08, 0.36, -0.42, { parent: g });
    c.rb(0.02, 0.1, 0.09, 0.01, MT.armorGlass, 0.235, 0.4, -0.47, { parent: g }); c.rb(0.02, 0.07, 0.06, 0.01, MT.glassDark, 0.235, 0.4, -0.37, { parent: g });
    c.cyl(0.05, 0.05, 0.8, CANO, 0.65, 0.32, 0.12, "x", { parent: g }); c.cyl(0.025, 0.025, 0.7, CANO, 1.35, 0.32, 0.12, "x", { parent: g });
    c.cyl(0.04, 0.032, 0.1, CANO, 1.72, 0.32, 0.12, "x", { parent: g });
    c.rb(0.25, 0.22, 0.12, 0.03, CM("#46482f", { roughness: 0.7 }), -0.1, 0.25, 0.36, { parent: g });
    [-1, 1].forEach(function (s) { for (var k = 0; k < 3; k++) c.cyl(0.04, 0.04, 0.18, CANO, 0.05 + k * 0.1, 0.55, s * 0.18, "x", { parent: g }).rotation.y = s * 0.3; });
    return g;
  }

  /* ================================================================ */
  /* Guaraní 6x6 · VBTP-MR Guarani (Iveco/Exército)
     Referência (Tanks Encyclopedia, GlobalSecurity e Exército, confirmada na web):
       comprimento 6,91 m · largura 2,70 m · altura 2,34 m no teto do casco (3,33 m com torre REMAX) · vão livre 0,45 m
       entre-eixos ≈ 1,80 m + 1,50 m (3,30 m do 1º ao 3º eixo, estimado por fotos) · bitola ≈ 2,26 m (estimada) · pneu 14.00 R20 (≈ 1,24 m)
       balanço dianteiro ≈ 1,45 m · traseiro ≈ 2,15 m (estimados) · 18,5 t · 3 + 8 · 600 km · 100 km/h · motor FPT Cursor 9 de 383 cv
     Traços de assinatura:
       frente: chapa superior quase deitada (15°) e proa inferior em V; quatro faróis protegidos na chapa superior; trim vane (quebra-ondas)
               deitada na proa; motorista à frente esquerda com escotilha e três blocos de visão
       lateral: seis rodas grandes com caixas de roda recortadas, parte de baixo vertical e de cima inclinada para dentro, caixas de estiva,
                escapamento e filtro NBC do lado direito
       traseira: rampa com porta de saída de emergência, lanternas protegidas nos cantos, duas hélices de água embaixo
       teto: grade do motor à direita, escotilhas de comandante e de tropa, estação de armas remota no meio e duas bases de antena atrás */
  ZG.register({ k: "guarani", grp: GRP, n: "Guaraní 6x6", insp: "VBTP-MR Guarani", c: "Blindado de transporte de tropa 6x6", fuel: "diesel",
    d: "Casco em cunha com laterais inclinadas, seis rodas e estação de armas no teto. Flutua, leva onze e aguenta tiro de fuzil por todos os lados.",
    mass: 18500, r: 140, seats: "3 + 8 combatentes", cap: "550 L", eff: "1,1 km/L", auto: "600 km", vmax: 100, skill: "Blindados 2", hood: true
  }, function (c) {
    var col = OLIVA, W = 2.7, F = 3.45, R = -3.45, roofY = 2.31, belt = 1.3, wr = 0.58, ww = 0.4;
    var axles = [2.0, 0.2, -1.3];
    /* perfil de chapa: teto, convés do motor pouco inclinado, glacis curto e bem inclinado, proa baixa e saia em V; traseira vertical com a rampa */
    var GX = F - 0.7, GY = 1.92;
    var items = [[R + 0.04, 0.6, 0.03], [R - 0.01, roofY - 0.04, 0.04], [1.15, roofY, 0.05], [GX, GY, 0.04], [F, 1.1, 0.03], [F - 0.45, 0.52, 0.04], [2.6, 0.46, 0.03]];
    var deckY = function (x) { return roofY - (x - 1.15) * (roofY - GY) / (GX - 1.15); };
    var glacisX = function (y) { return GX + (F - GX) * (GY - y) / (GY - 1.02); };
    var arches = axles.map(function (x) { return [x, wr, wr + 0.14]; });
    var hood0 = 1.6, hood1 = 2.75;
    var holes = [
      ZG.holeBox([hood0, 0.9, 0.08], [hood1, 2.5, 1.05], function (n) { return n.y > 0.3; }, "capo"),
      ZG.holeBox([R - 0.3, 0.68, -0.8], [R + 0.3, 1.98, 0.8], function (n) { return n.x < -0.5; })
    ];
    var H = casco(c, { items: items, bottomY: 0.46, arches: arches, W: W, col: col, belt: belt, top: roofY + 0.03, k: 0.28, holes: holes, archInner: W / 2 - ww - 0.1, sub: 0.18, bev: 0.025 });
    var m = c.meta; m.col = col; m.kind = "car"; m.bullet = true;
    Object.assign(m, { W: W, L: F - R, front: F, rear: R, clear: 0.46, belt: belt, top: roofY + 0.03, bodyH: belt - 0.5, roof: { x0: R + 0.3, x1: 1.0, w: H.half(roofY) * 1.7, y: roofY + 0.03 } });
    /* tampa do motor (lado direito do convés), dobradiça na borda de trás */
    var hood = ZG.makeHood(c, H.mesh.userData.cut.capo, { x0: hood0, col: col, open: 1.2 });
    if (hood) {
      var nB = c.g.children.length;
      bayDeslocado(c, { x0: hood0 + 0.05, x1: hood1 - 0.08, zw: 0.42, floor: 0.95, top: Math.max(1.45, hood.yMin - 0.04), motor: "diesel", axle: null, col: "#3a3c32" }, 0.58);
      var bcen = new V3((hood0 + hood1) / 2, 1.1, 0.58);
      escala(c, nB, bcen, 1.35);
      /* fundo e paredes do vão em cinza médio, para o motor aparecer */
      c.rb(hood1 - hood0 - 0.1, 0.02, 0.9, 0.01, BAY_CLARO, bcen.x, 0.97, 0.58);
      [0.12, 1.04].forEach(function (z) { c.rb(hood1 - hood0 - 0.1, 0.55, 0.02, 0.01, BAY_CLARO, bcen.x, 1.25, z); });
      if (c.meta.bay) { c.meta.bay.center.set(bcen.x + 0.1, 1.45, 0.58); c.meta.bay.zw = 0.78; }
      for (var gx = hood0 + 0.2; gx < hood1 - 0.2; gx += 0.12) c.rb(0.05, 0.03, 0.62, 0.01, ACO, gx - hood.piv.position.x, deckY(gx) + 0.035 - hood.piv.position.y, 0.58, { parent: hood.piv, rot: [0, 0, -Math.atan((roofY - GY) / (GX - 1.15))] });
      renomeiaCapo(c, "Tampa do motor");
    }
    /* rodas mais à mostra, caixas de roda maiores */
    axles.forEach(function (x, i) { [1, -1].forEach(function (s) { rodaMil(c, x, s * (W / 2 - ww / 2 - 0.02), wr, ww, { label: "Pneu " + (i + 1) + "º eixo " + (s > 0 ? "direito" : "esquerdo") }); c.cyl(0.07, 0.07, 0.08, ACO, x, wr, s * (W / 2 - 0.03), "z"); }); });
    /* interior: piso, forro claro, bancos de tropa (4 por lado), posto do motorista, luz de combate vermelha */
    var fl = 0.82, zi = 0.84;
    c.rb(4.3, 0.04, 1.7, 0.01, CM("#3b3f35", { roughness: 0.95 }), -1.2, fl, 0);
    [1, -1].forEach(function (s) { c.rb(3.3, roofY - fl - 0.12, 0.03, 0.01, FORRO, R + 0.1 + 1.65, (roofY + fl) / 2 - 0.02, s * (zi + 0.03)); });
    c.rb(4.3, 0.02, zi * 2, 0.01, FORRO, -1.2, roofY - 0.07, 0).castShadow = false;
    c.rb(0.03, roofY - fl - 0.1, zi * 2, 0.01, FORRO, -0.12, (roofY + fl) / 2, 0);
    bancoLateral(c, -0.45, -2.65, fl, zi, -1, { h: 0.42, mat: BANCO_TROPA });
    bancoLateral(c, -0.45, -2.65, fl, -zi, 1, { h: 0.42, mat: BANCO_TROPA });
    [-0.9, -2.2].forEach(function (x) { c.rb(0.3, 0.04, 0.1, 0.02, LUZ_VERMELHA, x, roofY - 0.1, 0).castShadow = false; });
    ZG.seat(c, 0.95, fl + 0.1, -0.62, { w: 0.5, h: 0.42, back: 0.62, lean: 0.12, mat: CM("#2f3226", { roughness: 0.9 }) });
    ZG.steeringWheel(c, 1.5, 1.42, -0.62, { r: 0.2, tilt: 0.9, col: 0.35 });
    c.rb(0.35, 0.3, 0.7, 0.04, CM("#25261f"), 1.85, 1.45, -0.6);
    ZG.seat(c, 0.15, fl, 0.0, { w: 0.5, h: 0.45, back: 0.62, lean: 0.12, mat: CM("#2f3226", { roughness: 0.9 }) });
    for (var r2 = 0; r2 < 3; r2++) c.rb(0.25, 0.32, 0.25, 0.03, CM("#3f4a2c", { roughness: 0.6 }), -0.7 - r2 * 0.6, roofY - 0.35, 0.68);
    /* rampa traseira fechada (dobradiça na base) com a porta de emergência aberta: a tropa e os bancos aparecem pela porta */
    var ramp = new THREE.Group(), RL = 1.36, rmat = tinta(c, col); ramp.position.set(R - 0.05, 0.62, 0); ramp.rotation.z = -PI / 2; ramp.userData.rigid = true; c.g.add(ramp);
    var dz0 = 0.02, dz1 = 0.64, dx0 = -0.14, dx1 = -1.2;
    c.rb(RL, 0.09, 0.8, 0.025, rmat, -RL / 2, -0.045, -0.38 + dz0 / 2, { parent: ramp });
    c.rb(RL, 0.09, 0.78 - dz1, 0.02, rmat, -RL / 2, -0.045, (dz1 + 0.78) / 2, { parent: ramp });
    c.rb(-dx0, 0.09, dz1 - dz0, 0.02, rmat, dx0 / 2, -0.045, (dz0 + dz1) / 2, { parent: ramp });
    c.rb(RL + dx1, 0.09, dz1 - dz0, 0.02, rmat, (dx1 - RL) / 2, -0.045, (dz0 + dz1) / 2, { parent: ramp });
    /* reforços e trincos da rampa por fora */
    [-0.6, -0.2].forEach(function (z) { c.rb(RL - 0.1, 0.03, 0.06, 0.01, ACO, -RL / 2, -0.1, z, { parent: ramp }); });
    [0.7].forEach(function (z) { c.rb(0.14, 0.04, 0.05, 0.01, ACO, -RL + 0.1, -0.1, z, { parent: ramp }); });
    /* porta com dobradiça do lado direito, aberta para fora */
    var door = new THREE.Group(); door.position.set(0, -0.09, dz1); door.rotation.x = -1.75; ramp.add(door);
    c.rb(dx0 - dx1 - 0.02, 0.07, dz1 - dz0 - 0.02, 0.02, rmat, (dx0 + dx1) / 2, 0.035, -(dz1 - dz0) / 2, { parent: door });
    c.rb(0.3, 0.02, 0.18, 0.01, MT.armorGlass, (dx0 + dx1) / 2 - 0.3, -0.005, -(dz1 - dz0) / 2, { parent: door });
    c.rb(0.06, 0.05, 0.12, 0.015, ACO, (dx0 + dx1) / 2, -0.01, -(dz1 - dz0) + 0.08, { parent: door });
    [dx0 - 0.12, dx1 + 0.12].forEach(function (x) { c.cyl(0.025, 0.025, 0.1, ACO, x, 0.0, 0, "x", { parent: ramp }); });
    /* soleira da porta e degrau por dentro */
    c.rb(0.25, 0.05, 0.62, 0.01, ACO, R + 0.15, 0.76, (dz0 + dz1) / 2);
    c.cyl(0.05, 0.05, 1.5, ACO, R - 0.04, 0.62, 0, "z");
    c.part("rampa", "Rampa traseira", ramp, new V3(R - 0.05, 1.2, 0), 0.9);
    /* teto: escotilhas, periscópios, estação de armas */
    escotilha(c, 1.0, roofY, -0.62, 0.3, 0, ACO);
    [-0.85, -0.62, -0.39].forEach(function (z, i) { periscopio(c, 1.32, deckY(1.32) + 0.06, z, 0.16, i === 1 ? "Periscópio do motorista" : null); });
    var est = estacaoArmas(c, 0.15, roofY + 0.02, 0.1); rigido(c, [est]);
    escotilha(c, -1.6, roofY, -0.4, 0.28, -1.6, ACO); escotilha(c, -1.6, roofY, 0.45, 0.28, 0, ACO);
    escotilha(c, -2.6, roofY, 0.0, 0.32, 0, ACO, { hingeX: 1 });
    [-0.6, 0.6].forEach(function (z) { periscopio(c, -0.7, roofY + 0.06, z, 0.14, z < 0 ? "Bloco de visão esquerdo" : "Bloco de visão direito", { rot: z < 0 ? PI / 2 : -PI / 2 }); });
    /* frente: faróis protegidos no glacis, trim vane deitada no glacis, ganchos */
    [1, -1].forEach(function (s) { farolProtegido(c, glacisX(1.5) + 0.03, 1.5, s * 1.0, s); farolProtegido(c, glacisX(1.5) + 0.03, 1.5, s * 0.66, s, { noPart: true }); c.rb(0.03, 0.1, 0.14, 0.01, PRETO, glacisX(1.5) + 0.06, 1.5, s * 0.33); });
    var tv = c.rb(0.05, 0.5, 2.1, 0.02, ACO, glacisX(1.5) + 0.045, 1.53, 0, { rot: [0, 0, Math.atan2(F - GX, GY - 1.02)] }); void tv;
    [1, -1].forEach(function (s) { c.tube([[F - 0.25, 0.7, s * 0.6], [F - 0.05, 0.68, s * 0.6], [F - 0.05, 0.55, s * 0.6], [F - 0.2, 0.52, s * 0.6]], 0.035, ACO, { seg: 10, rs: 6 }); });
    var bF = c.rb(0.1, 0.16, 2.2, 0.03, ACO, F - 0.06, 0.94, 0, { def: true }); m.bumperF = bF;
    c.part("parachoque", "Proteção frontal", bF, new V3(F, 0.94, 0), 1.0);
    /* traseira: lanternas protegidas, hélices de água, placa */
    [1, -1].forEach(function (s) {
      c.rb(0.12, 0.2, 0.26, 0.03, ACO, R - 0.06, 1.75, s * 1.02);
      ZG.taillight(c, { style: "round2", x: R - 0.1, y: 1.75, z: s * 1.02, w: 0.2, h: 0.09, d: 0.05, side: s });
      c.cyl(0.24, 0.24, 0.28, ACO, R + 0.1, 0.62, s * 1.0, "x", { open: true });
      c.cyl(0.05, 0.05, 0.3, CANO, R + 0.1, 0.62, s * 1.0, "x");
      c.part("helice", "Hélice de água " + (s > 0 ? "direita" : "esquerda"), null, new V3(R, 0.62, s * 1.0), 0.5);
    });
    c.text("EB 1290-301", 0.4, 0.1, R - 0.03, 1.42, 1.04, "-x", { fg: "#e4e2d6", bg: "#24261d", size: 0.6 });
    /* laterais: caixas de estiva, estrela, faixa, escapamento */
    [1, -1].forEach(function (s) {
      c.rb(1.1, 0.34, 0.12, 0.03, tinta(c, OLIVA2), -2.4, 1.72, s * (H.half(1.72) + 0.04), { rot: [-s * 0.37, 0, 0] });
      c.rb(0.9, 0.28, 0.1, 0.03, tinta(c, OLIVA2), -0.9, 1.7, s * (H.half(1.7) + 0.035), { rot: [-s * 0.37, 0, 0] });
      estrela(c, 1.25, 0.98, s * (W / 2 + 0.03), 0.2, s > 0 ? "+z" : "-z", { ring: true });
      c.rb(4.4, 0.06, 0.05, 0.02, ACO, -0.4, 1.42, s * (H.half(1.42) + 0.02));
      c.text("EXÉRCITO", 0.9, 0.14, -2.55, 1.0, s * (W / 2 + 0.03), s > 0 ? "+z" : "-z", { fg: "#dcdace", size: 0.7 });
    });
    c.rb(0.5, 0.12, 0.22, 0.04, CANO, 2.0, 1.62, H.half(1.62) - 0.02, { rot: [-0.37, 0, 0] });
    antena(c, -3.0, roofY, -0.92, 2.2); antena(c, -3.0, roofY, 0.92, 1.6);
    /* peças para dano localizado */
    c.part("tanque", "Tanque de diesel", null, new V3(-0.2, 0.75, -0.9), 0.9);
    c.part("tropa", "Compartimento de tropa", null, new V3(-1.6, roofY, 0), 1.3);
    c.part("estacao", "Estação de armas", null, new V3(0.15, roofY + 0.35, 0.1), 0.6);
    c.part("bateria", "Baterias", null, new V3(2.5, 1.0, -0.6), 0.6);
    c.part("casco", "Blindagem lateral", null, new V3(-1.0, 1.3, W / 2), 1.0, { onHit: function (c2, pt, f, dir, p) { ZG.burst(c2, "faisca", c2.toFx(p || pt.pos), 20, { speed: 3 }); } });
    /* zonas: a arma automática é o cano da estação remota; a rampa é a traseira que abre; periscópios no lugar do para-brisa */
    c.zone("arma", "Estação de armas remota", [-0.4, 2.1, roofY - 0.05, roofY + 0.75, -0.65, 0.75], [est], { type: "peca", fxKey: "arma", dir: "cima", anchor: [0.15, roofY + 0.05, 0.1] });
    c.zone("rampa", "Rampa e porta traseira", [R - 0.2, R + 0.25, 0.55, 2.05, -0.9, 0.9], [ramp], { type: "tampa", fxKey: "tampa", hinge: "baixo", dir: "frente", who: "a tropa" });
    c.zone("blind_t", "Blindagem traseira (cantos e lanternas)", [R - 0.25, R + 0.5, 0.4, roofY + 0.1, -W / 2 - 0.2, W / 2 + 0.2]);
    c.zone("vidros_f", "Blocos de visão do motorista");
    c.zone("vidros_t", "Blocos de visão da tropa");
    c.zone("torre", "Teto e escotilhas");
    c.zone("tampa_motor", "Grade e tampa do motor", [hood0 - 0.05, hood1 + 0.05, 1.7, roofY + 0.2, 0.05, 1.15], hood ? [hood.piv] : null, { type: "capo", fxKey: "capo", dir: "cima" });
    fosco(c, col);
    m.damage = danoBlindado;
    blindagem(c, 0.4);
    /* capotado: a estação de armas é arrancada e tomba para o lado, o casco assenta no teto */
    capotagem(c, { onFlip: function (c2) { est.rotation.x = (c2.milRollS || 1) * 1.35; est.position.y -= 0.12; } });
    m.armor = function (c2) { guaraniMod(c2, F, R, W, roofY, H); };
  });
  function guaraniMod(c, F, R, W, roofY, H) {
    [1, -1].forEach(function (s) { slat(c, R + 0.1, F - 1.1, 0.95, 1.8, s * (W / 2 + 0.3)); });
    redeCamuflagem(c, R + 0.2, -1.95, roofY + 0.06, 2 * H.half(roofY), 0.45);
    sacosAreia(c, -0.5, 0.6, roofY + 0.1, -0.85, "x", 2);
    c.rb(0.06, 0.5, 0.9, 0.02, ACO, 0.75, roofY + 0.55, 0.1);
    [0.6, 0.25].forEach(function (z, i) { jerry(c, -0.3, roofY + 0.25, z + 0.3, i ? AREIA : "#3e4a2c", 0); });
    var sp = rodaMil(c, 0, 0, 0.6, 0.4, { noPart: true }); sp.rotation.x = PI / 2; sp.position.set(-1.0, roofY + 0.25, 0.45); c.wheels.pop();
  }

  /* torre: planta [x, z] extrudada para cima (h), com laterais inclinadas (k = quanto o topo encolhe) */
  function torre(c, o) {
    var sh = new THREE.Shape(), pl = o.plan;
    pl.forEach(function (p, i) { if (i === 0) sh.moveTo(p[0], -p[1]); else sh.lineTo(p[0], -p[1]); });
    var bev = o.bev == null ? 0.05 : o.bev;
    var geo = new THREE.ExtrudeGeometry(sh, { depth: o.h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 6 });
    geo.rotateX(-PI / 2); geo.translate(0, bev, 0);
    geo = G.subdivide(geo, o.sub || 0.25);
    var p = geo.attributes.position, cx = o.cx || 0;
    for (var i = 0; i < p.count; i++) { var t = Math.max(0, Math.min(1, p.getY(i) / o.h)), k = 1 - (o.k || 0) * t; p.setX(i, cx + (p.getX(i) - cx) * (1 - (o.kx || 0) * t)); p.setZ(i, p.getZ(i) * k); }
    G.crease(geo, o.crease || 40);
    var m = c.add(geo, o.mat, o.x || 0, o.y, o.z || 0); c.deform.push(m);
    return m;
  }
  /* canhão: tubo ao longo de +x a partir de x0, com luva térmica (anéis), extrator de fumos e freio de boca opcionais */
  function canhao(c, x0, y, z, len, r, o) {
    o = o || {}; var mat = o.mat || tinta(c, OLIVA);
    var g = new THREE.Group(); g.position.set(x0, y, z); g.userData.rigid = true; c.g.add(g);
    c.cyl(r * 1.05, r * 1.15, len, mat, len / 2, 0, 0, "x", { parent: g, seg: 18 });
    if (o.sleeve) for (var k = 1; k < 5; k++) c.cyl(r * 1.22, r * 1.22, 0.05, CM("#30342a", { roughness: 0.8 }), len * k / 5.4, 0, 0, "x", { parent: g, seg: 18 });
    if (o.fume) c.cyl(r * 1.6, r * 1.6, 0.6, mat, len * (o.fume), 0, 0, "x", { parent: g, seg: 18 });
    if (o.fume) [0.3, -0.3].forEach(function (d) { c.cyl(r * 1.15, r * 1.6, 0.12, mat, len * o.fume + d, 0, 0, "x", { parent: g, seg: 18 }).rotation.z = d > 0 ? -PI / 2 : PI / 2; });
    if (o.brake) { c.cyl(r * 1.6, r * 1.6, 0.32, mat, len + 0.12, 0, 0, "x", { parent: g, seg: 16 }); [1, -1].forEach(function (s) { c.rb(0.08, r * 2.4, 0.03, 0.01, MT.dark, len + 0.1, 0, s * r * 1.62, { parent: g }); }); }
    c.cyl(r * 0.62, r * 0.62, 0.02, MT.dark, len + (o.brake ? 0.29 : 0.005), 0, 0, "x", { parent: g, seg: 14 });
    c.part("canhao", "Canhão", g, new V3(x0 + len * 0.6, y, z), 0.8);
    return g;
  }
  function lancaFumaca(c, x, y, z, s, n) {
    for (var i = 0; i < n; i++) { var t = c.cyl(0.045, 0.045, 0.22, CANO, x + (i % 2) * 0.1, y + Math.floor(i / 2) * 0.1, z, "x"); t.rotation.y = -s * 0.5; t.rotation.z = -PI / 2 + 0.4; }
  }

  /* ================================================================ */
  /* Cascável EE-9 · Engesa EE-9 Cascavel (M4/M7, torre ET-90 com canhão EC-90 de 90 mm)
     Referência (Wikipédia e Tanks Encyclopedia, confirmada na web):
       comprimento do casco 5,25 m · 6,29 m com o canhão · largura 2,59 m · altura 2,60 m no teto da torre · vão livre 0,375 a 0,50 m
       entre-eixos 3,05 m (eixo dianteiro ao centro do bogie Boomerang) · rodas do bogie ≈ 1,30 m entre si (estimado)
       bitola ≈ 2,27 m (estimada) · pneu 11.00-20 run-flat (≈ 1,08 m) · balanço dianteiro ≈ 1,0 m · traseiro ≈ 0,5 m · 12 a 13,4 t · 360 L · 750 km
     Traços de assinatura:
       frente: proa em cunha (em V visto de cima) com chapa superior bem inclinada; faróis e luzes de comboio nos cantos da proa com guarda;
               blocos de visão do motorista na borda da chapa superior
       lateral: três rodas com as duas de trás no balancim Boomerang, para-lamas planos com estiva sobre as rodas de trás,
                laterais de cima inclinadas para dentro
       traseira: chapa traseira inclinada com lanternas protegidas nos cantos, escapamento no alto à direita
       teto: torre ET-90 larga e baixa, de faces inclinadas, com mantelete saliente, canhão de 90 mm com freio de boca,
             lança-fumaças dos dois lados, escotilhas de comandante e atirador, cesto atrás e grade da tampa do motor na traseira */
  ZG.register({ k: "cascavel", grp: GRP, n: "Cascável EE-9", insp: "Engesa EE-9 Cascavel", c: "Blindado de reconhecimento 6x6", fuel: "diesel",
    d: "Proa em cunha, bogie traseiro de balancim e torre com canhão de 90 mm. Rápido no asfalto, abre caminho em barricada e a tripulação vê tudo pelos periscópios.",
    mass: 13400, r: 120, seats: "3", cap: "360 L", eff: "2,2 km/L", auto: "750 km", vmax: 100, skill: "Blindados 2", hood: true
  }, function (c) {
    var col = "#4a5034", W = 2.59, F = 2.62, R = -2.6, roofY = 1.78, belt = 1.14, wr = 0.5, ww = 0.32;
    var axles = [1.6, -0.8, -2.1];
    var items = [[R + 0.06, 0.62, 0.06], [R - 0.04, 1.48, 0.06], [R + 0.25, roofY, 0.08], [1.3, roofY, 0.1], [F - 0.04, 1.02, 0.06], [F, 0.9, 0.05], [2.05, 0.46, 0.06], [-1.4, 0.44, 0.04]];
    var arches = axles.map(function (x) { return [x, wr, wr + 0.09]; });
    var dx0 = -2.5, dx1 = -1.7;
    var H = casco(c, { items: items, bottomY: 0.44, arches: arches, W: W, col: col, belt: belt, top: roofY + 0.06, k: 0.24, holes: [ZG.holeTop(dx0, dx1, 0.62, roofY - 0.2, "capo")], archInner: W / 2 - ww - 0.1, sub: 0.18 });
    /* proa em cunha vista de cima: a frente do casco afina em V a partir do eixo dianteiro */
    (function () {
      var g = H.mesh.geometry, p = g.attributes.position, xs = 2.0, ks = 0.3;
      for (var i = 0; i < p.count; i++) { var x = p.getX(i); if (x > xs) p.setZ(i, p.getZ(i) * (1 - ks * Math.min(1, (x - xs) / (F + 0.05 - xs)))); }
      p.needsUpdate = true; G.crease(g, 42); g.computeBoundingSphere(); g.computeBoundingBox();
    })();
    var m = c.meta; m.col = col; m.kind = "car"; m.bullet = true;
    var tx = -0.25, ty = roofY + 0.04, tTop = ty + 0.06 + 0.72;
    /* a capotagem usa a altura total (com a torre) */
    Object.assign(m, { W: W, L: F - R, front: F, rear: R, clear: 0.44, belt: belt, top: tTop, bodyH: belt - 0.44, roof: { x0: tx - 1.1, x1: tx + 0.7, w: 1.5, y: tTop } });
    /* tampa do motor traseira: dobradiça na borda de trás, abre para trás passando da vertical (≈ 110°) */
    var hood = ZG.makeHood(c, H.mesh.userData.cut.capo, { col: col, open: 1.95 });
    if (hood) {
      var nB = c.g.children.length, bcen = new V3((dx0 + dx1) / 2, 1.1, 0);
      bayEspelhado(c, { x0: dx0 + 0.04, x1: dx1 - 0.04, zw: 0.58, floor: 1.0, top: roofY - 0.05, motor: "diesel", col: "#3a3c32" }, (dx0 + dx1) / 2);
      escala(c, nB, bcen, 1.4);
      c.rb(dx1 - dx0 - 0.08, 0.02, 1.25, 0.01, BAY_CLARO, bcen.x, 1.0, 0);
      [1, -1].forEach(function (sd) { c.rb(dx1 - dx0 - 0.08, 0.6, 0.02, 0.01, BAY_CLARO, bcen.x, 1.32, sd * 0.64); });
      /* a câmera do capô vem da frente direita e por cima: mira na metade de trás do vão, que a torre não tapa */
      if (c.meta.bay) { c.meta.bay.center.set(dx0 + 0.1, 1.5, 1.05); c.meta.bay.zw = 0.85; }
      for (var gx = dx0 + 0.12; gx < dx1 - 0.1; gx += 0.1) c.rb(0.04, 0.025, 1.0, 0.01, MT.dark, gx - hood.piv.position.x, roofY + 0.07 - hood.piv.position.y, 0, { parent: hood.piv });
      renomeiaCapo(c, "Tampa do motor");
    }
    /* rodas: eixo dianteiro e bogie traseiro com balancim */
    axles.forEach(function (x, i) { [1, -1].forEach(function (s) { rodaMil(c, x, s * (W / 2 - ww / 2), wr, ww, { label: "Pneu " + (i + 1) + "º eixo " + (s > 0 ? "direito" : "esquerdo") }); }); });
    [1, -1].forEach(function (s) {
      c.rb(1.6, 0.16, 0.12, 0.04, ACO, (axles[1] + axles[2]) / 2, wr, s * (W / 2 - ww - 0.1));
      c.cyl(0.12, 0.12, 0.2, ACO, (axles[1] + axles[2]) / 2, wr, s * (W / 2 - ww - 0.1), "z");
      /* para-lamas e caixas de estiva sobre as rodas */
      c.rb(1.0, 0.05, 0.32, 0.02, tinta(c, col), axles[0], 1.12, s * (W / 2 - 0.16), { def: true });
      c.rb(2.35, 0.05, 0.32, 0.02, tinta(c, col), (axles[1] + axles[2]) / 2, 1.12, s * (W / 2 - 0.16), { def: true });
      c.rb(1.2, 0.26, 0.28, 0.03, tinta(c, OLIVA2), -1.45, 1.28, s * (W / 2 - 0.17));
      /* rebaixos para galões na estiva do bogie */
      [-0.95, -1.95].forEach(function (x) { c.rb(0.3, 0.2, 0.02, 0.01, MT.dark, x, 1.28, s * (W / 2 - 0.025)); });
      estrela(c, 0.72, 0.86, s * (H.half(0.86) + 0.012), 0.17, s > 0 ? "+z" : "-z", { ring: true });
      c.text("EXÉRCITO", 0.62, 0.11, 0.05, 0.88, s * (H.half(0.88) + 0.012), s > 0 ? "+z" : "-z", { fg: "#dcdace", size: 0.7 });
      /* faróis protegidos no glacis e luz de comboio */
      farolProtegido(c, 2.6, 0.93, s * 0.72, s);
      c.rb(0.06, 0.05, 0.08, 0.015, MT.amber, 2.62, 1.09, s * 0.72);
      c.text("EB 3460-21", 0.42, 0.1, R - 0.015, 1.15, s * 0.55, "-x", { fg: "#e4e2d6", bg: "#24261d", size: 0.6 });
      c.rb(0.1, 0.16, 0.22, 0.03, ACO, R - 0.02, 1.32, s * 0.95);
      ZG.taillight(c, { style: "round2", x: R - 0.07, y: 1.32, z: s * 0.95, w: 0.18, h: 0.08, d: 0.05, side: s });
      c.tube([[F - 0.35, 0.7, s * 0.55], [F - 0.1, 0.72, s * 0.55], [F - 0.12, 0.58, s * 0.55]], 0.03, ACO, { seg: 10, rs: 6 });
    });
    var bF = c.rb(0.08, 0.12, 1.6, 0.03, ACO, F - 0.02, 0.9, 0, { def: true });
    c.part("blindagem", "Chapa da proa", bF, new V3(F, 0.9, 0), 1.0);
    /* motorista: escotilha aberta e periscópios no glacis */
    /* fechada: aberta em pé, a tampa virava um disco grande ao lado do canhão e mudava a silhueta */
    escotilha(c, 1.1, roofY, -0.55, 0.27, 0, ACO, { hingeX: -1 });
    [-0.75, -0.55, -0.35].forEach(function (z, i) { periscopio(c, 1.42, roofY - 0.02, z, 0.14, i === 1 ? "Periscópio do motorista" : null); });
    var fl = 0.72, fab = CM("#2f3226", { roughness: 0.9 });
    c.rb(3.0, 0.04, 1.6, 0.01, MT.carpet, 0.2, fl, 0);
    ZG.seat(c, 1.0, fl + 0.3, -0.55, { w: 0.46, h: 0.4, back: 0.5, lean: 0.25, mat: fab });
    ZG.steeringWheel(c, 1.5, 1.38, -0.55, { r: 0.18, tilt: 0.9, col: 0.3 });
    c.rb(0.3, 0.26, 0.6, 0.04, CM("#25261f"), 1.75, 1.35, -0.5);
    /* torre com canhão de 90 mm: tudo daqui até o fim da torre é rígido (não amassa nem afunda) */
    var nT = c.g.children.length;
    c.cyl(0.95, 0.98, 0.08, ACO, tx, ty + 0.02, 0, null, { seg: 32 });
    var tur = torre(c, { plan: [[1.0, 0], [0.75, 0.7], [0.15, 0.92], [-0.95, 0.85], [-1.25, 0.55], [-1.25, -0.55], [-0.95, -0.85], [0.15, -0.92], [0.75, -0.7]], h: 0.72, k: 0.2, kx: 0.1, x: tx, y: ty + 0.06, mat: tinta(c, col), bev: 0.035, sub: 0.2, crease: 14 });
    c.part("torre", "Torre", tur, new V3(tx, ty + 0.35, 0), 1.45);
    c.rb(0.42, 0.48, 0.62, 0.1, tinta(c, col), tx + 1.0, ty + 0.4, 0);
    canhao(c, tx + 1.18, ty + 0.42, 0, 2.55, 0.07, { brake: true });
    /* holofote do mantelete: carcaça cilíndrica com lente, aro e suporte */
    c.rb(0.08, 0.1, 0.08, 0.02, ACO, tx + 0.72, ty + 0.78, -0.45);
    c.cyl(0.085, 0.095, 0.2, ACO, tx + 0.8, ty + 0.9, -0.45, "x", { seg: 18 });
    c.cyl(0.098, 0.098, 0.025, PRETO, tx + 0.9, ty + 0.9, -0.45, "x", { seg: 18 });
    /* holofote apagado (lente fosca): aceso, virava um ponto branco solto acima da torre */
    c.cyl(0.075, 0.075, 0.012, CM("#8d9690", { metalness: 0.4, roughness: 0.25 }), tx + 0.912, ty + 0.9, -0.45, "x", { seg: 18 });
    escotilha(c, tx - 0.35, ty + 0.72, 0.42, 0.3, -1.7, ACO);
    escotilha(c, tx - 0.35, ty + 0.72, -0.42, 0.28, 0, ACO);
    [-0.6, -0.42, -0.24].forEach(function (z, i) { periscopio(c, tx + 0.45, ty + 0.76, z, 0.12, i === 1 ? "Periscópio do atirador" : null); });
    [1, -1].forEach(function (s) { lancaFumaca(c, tx + 0.3, ty + 0.42, s * 0.86, s, 2); });
    /* estiva baixa atrás da torre (não tapa o vão do motor) */
    c.rb(0.28, 0.2, 1.3, 0.05, LONA2, tx - 1.38, ty + 0.24, 0);
    c.part("carga", "Estiva da torre", null, new V3(tx - 1.45, ty + 0.3, 0), 0.9);
    c.part("traseira", "Chapa traseira", null, new V3(R, 1.1, 0), 1.2);
    for (var k = 0; k < 4; k++) c.rod(new V3(tx - 1.55, ty + 0.14, -0.6 + k * 0.4), new V3(tx - 1.55, ty + 0.4, -0.6 + k * 0.4), 0.015, ACO);
    c.rod(new V3(tx - 1.55, ty + 0.4, -0.65), new V3(tx - 1.55, ty + 0.4, 0.65), 0.015, ACO);
    /* comandante visível pela escotilha aberta: banco e culatra */
    ZG.seat(c, tx - 0.4, fl + 0.45, 0.42, { w: 0.42, h: 0.38, back: 0.45, lean: 0.1, mat: fab });
    ZG.seat(c, tx - 0.4, fl + 0.45, -0.42, { w: 0.42, h: 0.38, back: 0.45, lean: 0.1, mat: fab });
    c.rb(0.8, 0.3, 0.3, 0.05, CANO, tx + 0.1, ty + 0.1, 0);
    c.rb(1.6, 0.02, 1.2, 0.01, MT.headliner, tx - 0.2, ty + 0.66, 0).castShadow = false;
    rigido(c, c.g.children.slice(nT));
    antena(c, tx - 1.0, ty + 0.62, -0.7, 2.1);
    c.part("tanque", "Tanque de diesel", null, new V3(-0.6, 0.8, 0.9), 0.9);
    c.part("bateria", "Baterias", null, new V3(-1.0, 0.9, -0.9), 0.6);
    /* escapamento no alto da chapa traseira, à direita (EE-9 M4 com motor Detroit) */
    c.rb(0.5, 0.2, 0.22, 0.05, CANO, R + 0.28, roofY + 0.05, 0.86);
    c.cyl(0.06, 0.06, 0.2, MT.dark, R + 0.0, roofY + 0.07, 0.86, "x");
    /* zonas: nomes do Cascavel; a tampa do motor traseira é zona própria */
    c.zone("vidros_f", "Periscópios do motorista e do atirador");
    c.zone("arma", "Canhão de 90 mm");
    c.zone("torre", "Torre ET-90 e teto");
    c.zone("tampa_motor", "Tampa e grade do motor", [dx0 - 0.08, dx1 + 0.08, roofY - 0.3, roofY + 0.3, -0.7, 0.7], hood ? [hood.piv] : null, { type: "capo", fxKey: "capo", dir: "cima" });
    fosco(c, col);
    m.damage = danoBlindado;
    blindagem(c, 0.35);
    capotagem(c, { tilt: 0.05 });
    m.armor = function (c2) { cascavelMod(c2, F, R, W, roofY, tx); };
  });
  function cascavelMod(c, F, R, W, roofY, tx) {
    sacosAreia(c, -0.75, 0.75, 1.6, 1.85, "z", 2);
    redeCamuflagem(c, tx - 1.9, tx + 0.1, roofY + 0.72, 1.6, 0.5);
    metralhadora(c, tx - 0.25, roofY + 0.95, 0.42, { len: 1.3 });
    c.rb(0.04, 0.3, 0.45, 0.02, ACO, tx - 0.0, roofY + 1.0, 0.42);
    var sp = rodaMil(c, 0, 0, 0.53, 0.32, { noPart: true }); sp.rotation.y = PI / 2; sp.position.set(R - 0.2, 1.2, 0); c.wheels.pop();
    [0.85, 0.6].forEach(function (z, i) { jerry(c, R + 0.6, roofY + 0.25, z, i ? AREIA : "#3e4a2c", 0); jerry(c, R + 0.6, roofY + 0.25, -z, "#3e4a2c", 0); });
    [1, -1].forEach(function (s) { for (var x = -2.4; x < 1.6; x += 0.5) c.rb(0.45, 0.3, 0.05, 0.02, ZG.STEELM, x, 1.0, s * (W / 2 + 0.05), { rot: [s * 0.25, 0, (ZG.hash(x, s, 1) - 0.5) * 0.1] }); });
  }

  /* ================================================================ */
  /* Leopardo 1A5 · Leopard 1A5 BR (Krauss-Maffei, Exército Brasileiro)
     Referência (Wikipédia, Army Recognition e KNDS, confirmada na web; detalhes do trem de rolamento de memória):
       casco 7,09 m · 9,54 m com o canhão à frente · largura 3,37 m com saias (3,25 m sem) · altura 2,39 m no teto da torre (2,7 m no topo dos periscópios)
       vão livre 0,44 m · bitola (centro das lagartas) ≈ 2,70 m · lagarta de 0,55 m · sete rodas de apoio duplas de 0,70 m · quatro roletes de retorno
       roda motriz atrás, tensora na frente · 42,4 t · 4 tripulantes · 955 L · ≈ 160 L/100 km · 600 km · 65 km/h · MTU MB 838 de 830 cv
     Traços de assinatura:
       frente: glacis comprido e pouco inclinado com faróis em gaiola nos cantos e cabo de reboque, proa inferior em cunha;
               torre em cunha com a blindagem espaçada parafusada formando um "bico" dos dois lados do mantelete
       lateral: saias de aço com borracha embaixo cobrindo a metade de cima das rodas, sete rodas de apoio duplas, roda motriz alta atrás
       traseira: convés do motor comprido com grades, escapamentos nas laterais traseiras, lanternas em caixa nos cantos
       teto: caixa da mira EMES-18 à direita da frente da torre, periscópio PERI do comandante à direita, escotilha do municiador à esquerda,
             lança-fumaças em dois grupos de quatro, cesto de bagagem atrás da torre, canhão L7 de 105 mm com luva térmica e extrator de fumos */
  ZG.register({ k: "leopardo", grp: GRP, n: "Leopardo 1A5", insp: "Leopard 1A5 BR", c: "Carro de combate sobre lagartas", fuel: "diesel",
    d: "Quarenta toneladas sobre lagartas, torre em cunha e canhão de 105 mm. Passa por cima de carro, muro e horda. Bebe diesel como ninguém e é ouvido de longe.",
    mass: 42400, r: 320, seats: "4", cap: "955 L", eff: "0,6 km/L (≈ 160 L/100 km)", auto: "600 km", vmax: 65, skill: "Blindados 3 (lagartas)", hood: true
  }, function (c) {
    var col = "#465033", W = 3.25, F = 3.55, R = -3.54, roofY = 1.52, deckY = 1.48;
    var gl = function (x) { return roofY + (x - 1.6) * (1.18 - roofY) / (F - 0.05 - 1.6); };
    var m = c.meta; m.col = col; m.kind = "car"; m.bullet = true;
    /* casco inferior entre as lagartas */
    var low = c.rb(6.6, 0.62, 2.0, 0.08, tinta(c, col), -0.1, 0.78, 0, { def: true, sub: 0.3 });
    c.rb(0.55, 0.62, 2.0, 0.06, tinta(c, col), 3.1, 0.8, 0, { def: true, rot: [0, 0, -0.95] });
    /* casco superior (cobre as lagartas) */
    var items = [[R, 1.05, 0.04], [R - 0.02, deckY - 0.04, 0.05], [-1.2, deckY + 0.02, 0.06], [1.6, roofY, 0.08], [F - 0.05, 1.18, 0.06], [F - 0.12, 1.05, 0.03]];
    var ex0 = -3.4, ex1 = -2.2;
    var H = casco(c, { items: items, bottomY: 1.05, W: W - 0.12, col: col, belt: 1.3, top: roofY + 0.06, k: 0.03, holes: [ZG.holeTop(ex0, ex1, 1.12, 1.3, "capo")], sub: 0.22, bev: 0.05 });
    var tx = 0.0, ty = roofY + 0.02, tH = 0.77, tTop = ty + 0.08 + tH;
    /* a capotagem usa a altura total, com a torre */
    Object.assign(m, { W: W, L: F - R, front: F, rear: R, clear: 0.44, belt: 1.3, top: tTop, bodyH: 0.95, roof: { x0: -1.9, x1: 0.9, w: 2.3, y: tTop } });
    /* tampa do motor: dobradiça na borda de trás, abre ≈ 110° (passa da vertical e não tapa o vão) */
    var hood = ZG.makeHood(c, H.mesh.userData.cut.capo, { col: col, open: 1.95 });
    if (hood) {
      var nB = c.g.children.length, bcen = new V3((ex0 + ex1) / 2, 1.1, 0);
      bayEspelhado(c, { x0: ex0 + 0.06, x1: ex1 - 0.06, zw: 1.0, floor: 0.95, top: deckY - 0.05, motor: "diesel", col: "#3a3c32" }, (ex0 + ex1) / 2);
      escala(c, nB, bcen, 1.45);
      c.rb(ex1 - ex0 - 0.1, 0.02, 2.1, 0.01, BAY_CLARO, bcen.x, 0.95, 0);
      [1, -1].forEach(function (sd) { c.rb(ex1 - ex0 - 0.1, 0.55, 0.02, 0.01, BAY_CLARO, bcen.x, 1.25, sd * 1.08); });
      /* caixa de transmissão atrás do motor (MTU V10 + câmbio) */
      c.rb(0.42, 0.42, 1.5, 0.05, MT.block, ex0 + 0.2, 1.2, 0);
      /* câmera: mira o lado direito do vão, que passa ao lado da torre e do cesto */
      if (c.meta.bay) { c.meta.bay.center.set(-3.0, 1.45, 1.3); c.meta.bay.zw = 1.0; }
      for (var gx = ex0 + 0.15; gx < ex1 - 0.1; gx += 0.12) [-0.55, 0.55].forEach(function (z) { c.rb(0.05, 0.03, 0.95, 0.01, MT.dark, gx - hood.piv.position.x, deckY + 0.06 - hood.piv.position.y, z, { parent: hood.piv }); });
      renomeiaCapo(c, "Tampa do motor");
    }
    /* lagartas: 7 rodas de apoio duplas, roda motriz dentada atrás (menor e mais alta), roda tensora na frente, 4 roletes de retorno */
    var tz = W / 2 - 0.3;
    [1, -1].forEach(function (s) {
      lagartaLeo(c, { x0: R + 0.32, x1: F - 0.5, z: s * tz, w: 0.55, wheelMat: tinta(c, OLIVA2) });
      var sk = c.rb(5.9, 0.42, 0.04, 0.02, tinta(c, col), -0.2, 0.86, s * (W / 2 + 0.05), { def: true });
      for (var x = -3.0; x < 2.6; x += 0.86) c.rb(0.012, 0.42, 0.01, 0.004, MT.dark, x, 0.86, s * (W / 2 + 0.075));
      c.rb(5.9, 0.1, 0.025, 0.01, MT.rubber, -0.2, 0.61, s * (W / 2 + 0.05));
      c.rb(0.55, 0.42, 0.03, 0.01, MT.rubber, 2.95, 0.86, s * (W / 2 + 0.05));
      c.part("blindagem", "Saia " + (s > 0 ? "direita" : "esquerda"), sk, new V3(-0.2, 0.86, s * W / 2), 1.2);
      c.rb(0.5, 0.03, 0.6, 0.01, tinta(c, col), F - 0.25, 1.08, s * tz, { rot: [0, 0, -0.35] });
      c.rb(0.03, 0.5, 0.55, 0.01, MT.rubber, R + 0.02, 0.85, s * tz);
      estrela(c, 0.6, 1.3, s * (H.half(1.3) + 0.01), 0.17, s > 0 ? "+z" : "-z", { ring: true });
      c.text("EXÉRCITO", 1.0, 0.16, -1.5, 1.3, s * (H.half(1.3) + 0.01), s > 0 ? "+z" : "-z", { fg: "#dcdace", size: 0.7 });
      /* faróis no glacis com guarda, lanternas traseiras */
      farolProtegido(c, 2.95, gl(2.95) + 0.16, s * 1.3, s, { style: "round" });
      c.rb(0.1, 0.16, 0.08, 0.02, ACO, 2.9, gl(2.9) + 0.04, s * 1.3);
      c.rb(0.1, 0.18, 0.3, 0.03, ACO, R - 0.04, 1.35, s * 1.25);
      ZG.taillight(c, { style: "round2", x: R - 0.08, y: 1.35, z: s * 1.25, w: 0.2, h: 0.09, d: 0.05, side: s });
      c.tube([[F - 0.2, 0.95, s * 0.6], [F + 0.02, 0.92, s * 0.6], [F, 0.78, s * 0.6]], 0.04, ACO, { seg: 10, rs: 6 });
      /* cabo de reboque no glacis */
      c.tube([[2.4, gl(2.4) + 0.03, s * 0.25], [2.8, gl(2.8) + 0.03, s * 0.6], [3.1, gl(3.1) + 0.03, s * 0.95], [2.6, gl(2.6) + 0.03, s * 1.2], [1.6, gl(1.6) + 0.03, s * 1.25]], 0.025, CANO, { seg: 40, rs: 5 });
      /* escapamentos laterais na traseira */
      c.rb(0.8, 0.14, 0.04, 0.02, MT.dark, -2.6, 1.3, s * (H.half(1.3) + 0.005));
    });
    /* proa: sem para-choque (carro de combate não tem); a chapa do glacis é blindagem e só amassa */
    var bF = c.rb(0.1, 0.16, 2.0, 0.03, ACO, F - 0.08, 1.05, 0, { def: true });
    c.part("blindagem", "Chapa da proa", bF, new V3(F, 1.05, 0), 1.0);
    c.text("EB 6150-02", 0.5, 0.12, R - 0.025, 1.12, 0, "-x", { fg: "#e4e2d6", bg: "#24261d", size: 0.6 });
    /* elos de lagarta reserva no glacis */
    for (var k = 0; k < 4; k++) c.rb(0.13, 0.05, 0.55, 0.015, CM("#2b2c2a", { metalness: 0.5, roughness: 0.6 }), 2.45 + k * 0.15, gl(2.45 + k * 0.15) + 0.03, -0.95, { rot: [0, 0, -0.18] });
    /* motorista: escotilha e periscópios */
    escotilha(c, 2.05, roofY - 0.1, -0.78, 0.28, 0, ACO, { yaw: 0 });
    ZG.seat(c, 1.95, 0.62, -0.78, { w: 0.44, h: 0.34, back: 0.5, lean: 0.5, mat: CM("#2f3226", { roughness: 0.9 }) });
    [-0.95, -0.78, -0.61].forEach(function (z, i) { periscopio(c, 2.3, roofY - 0.08, z, 0.14, i === 1 ? "Periscópio do motorista" : null); });
    /* torre do 1A5: base mais alta e de laterais inclinadas, com a blindagem adicional espaçada em cunha na frente.
       Tudo da torre é rígido: não amassa nem afunda no capotamento */
    var nT = c.g.children.length, fab = CM("#2f3226", { roughness: 0.9 }), tpaint = tinta(c, col);
    c.cyl(1.15, 1.2, 0.1, ACO, tx + 0.1, ty + 0.03, 0, null, { seg: 32 });
    var tur = torre(c, { plan: [[1.2, 0.7], [0.95, 1.12], [-1.3, 1.22], [-2.05, 1.06], [-2.15, 0.6], [-2.15, -0.6], [-2.05, -1.06], [-1.3, -1.22], [0.95, -1.12], [1.2, -0.7]], h: tH, k: 0.12, kx: 0.03, x: tx, y: ty + 0.08, mat: tpaint, bev: 0.05, sub: 0.25, crease: 14 });
    c.part("torre", "Torre", tur, new V3(tx, ty + 0.45, 0), 1.7);
    /* placas em cunha (ponta para a frente), afastadas da torre por espaçadores, com o topo inclinado para dentro */
    [1, -1].forEach(function (s) {
      var x0p = 2.0, z0p = 0.34, x1p = 0.72, z1p = 1.36, len = Math.hypot(x0p - x1p, z1p - z0p), yaw = Math.atan2(z1p - z0p, x0p - x1p);
      c.rb(len, tH * 0.86, 0.11, 0.03, tpaint, tx + (x0p + x1p) / 2, ty + 0.1 + tH * 0.5, s * (z0p + z1p) / 2, { rot: [0, s * yaw, 0], taper: { sx: 0.97, sz: 0.6 } });
      [0.3, 0.7].forEach(function (t) { var px = x0p + (x1p - x0p) * t, pz = z0p + (z1p - z0p) * t; c.rb(0.1, 0.12, 0.22, 0.02, ACO, tx + px - 0.12, ty + 0.4, s * (pz - 0.12)); });
      c.rb(0.12, tH * 0.5, 0.03, 0.01, MT.dark, tx + x0p - 0.06, ty + 0.1 + tH * 0.5, s * (z0p - 0.03));
    });
    /* mantelete e canhão de 105 mm com luva térmica e extrator de fumos */
    c.rb(0.55, 0.5, 0.6, 0.06, tpaint, tx + 1.62, ty + 0.44, 0.05);
    canhao(c, tx + 1.85, ty + 0.46, 0.05, 4.15, 0.085, { sleeve: true, fume: 0.45 });
    /* EMES-18 à esquerda da frente, PERI do comandante, escotilhas */
    var ye = tTop + 0.1;
    c.rb(0.7, 0.36, 0.4, 0.05, tpaint, tx + 0.85, ye, 0.5);
    c.rb(0.02, 0.2, 0.28, 0.01, MT.armorGlass, tx + 1.21, ye + 0.02, 0.5);
    ZG.asGlass(c, c.rb(0.02, 0.16, 0.24, 0.01, MT.armorGlass, tx + 1.22, ye + 0.02, 0.5), "Mira EMES-18", "laminado");
    c.cyl(0.18, 0.2, 0.3, ACO, tx + 0.15, tTop + 0.1, 0.92); c.rb(0.25, 0.2, 0.3, 0.05, ACO, tx + 0.2, tTop + 0.32, 0.92); c.rb(0.02, 0.12, 0.2, 0.01, MT.armorGlass, tx + 0.33, tTop + 0.32, 0.92);
    escotilha(c, tx - 0.55, tTop - 0.02, 0.6, 0.34, -1.75, ACO);
    escotilha(c, tx - 0.55, tTop - 0.02, -0.6, 0.32, 0, ACO);
    [0.3, 0.55].forEach(function (z, i) { periscopio(c, tx - 0.12, tTop + 0.04, z, 0.12, i === 1 ? "Periscópio do comandante" : null, { rot: 0 }); });
    [1, -1].forEach(function (s) {
      lancaFumaca(c, tx + 0.45, ty + 0.55, s * 1.22, s, 4);
      for (var b = 0; b < 3; b++) c.rb(0.5, 0.25, 0.05, 0.02, tinta(c, OLIVA2), tx - 0.6 - b * 0.55, ty + 0.45, s * 1.24);
    });
    /* cesto de bagagem na traseira da torre */
    var bx = tx - 2.35;
    for (var bz = -1.0; bz <= 1.0; bz += 0.25) c.rod(new V3(bx, ty + 0.25, bz), new V3(bx, ty + 0.75, bz), 0.015, ACO, { seg: 5 });
    [0.25, 0.75].forEach(function (y) { c.tube([[tx - 2.05, ty + y, -1.08], [bx, ty + y, -1.0], [bx, ty + y, 1.0], [tx - 2.05, ty + y, 1.08]], 0.016, ACO, { seg: 16, rs: 5 }); });
    c.rb(0.25, 0.3, 1.6, 0.06, LONA2, bx + 0.12, ty + 0.4, 0);
    c.part("carga", "Cesto de bagagem", null, new V3(bx + 0.1, ty + 0.5, 0), 1.0);
    /* interior visível pela escotilha do comandante */
    ZG.seat(c, tx - 0.55, ty - 0.45, 0.6, { w: 0.42, h: 0.38, back: 0.45, lean: 0.1, mat: fab });
    ZG.seat(c, tx + 0.2, ty - 0.55, 0.62, { w: 0.4, h: 0.36, back: 0.42, lean: 0.1, mat: fab });
    ZG.seat(c, tx - 0.3, ty - 0.55, -0.62, { w: 0.4, h: 0.36, back: 0.42, lean: 0.1, mat: fab });
    c.rb(1.1, 0.35, 0.4, 0.05, CANO, tx + 0.6, ty + 0.35, 0.05);
    c.rb(2.2, 0.02, 1.6, 0.01, MT.headliner, tx - 0.3, tTop - 0.08, 0).castShadow = false;
    c.cyl(0.05, 0.05, 0.03, LUZ_VERMELHA, tx - 0.4, tTop - 0.1, 0.2);
    rigido(c, c.g.children.slice(nT));
    c.part("traseira", "Chapa traseira", null, new V3(R, 1.2, 0), 1.2);
    antena(c, tx - 1.6, tTop - 0.04, -0.85, 2.4); antena(c, tx - 1.6, tTop - 0.04, 0.85, 1.8);
    c.part("tanque", "Tanques de diesel", null, new V3(-1.2, 1.1, 1.1), 1.0);
    c.part("bateria", "Baterias", null, new V3(-0.5, 0.9, -1.0), 0.6);
    /* zonas: nomes do Leopard; tampa do motor e cesto da torre são zonas próprias */
    c.zone("arma", "Canhão de 105 mm");
    c.zone("torre", "Torre e blindagem espaçada");
    c.zone("vidros_f", "Periscópios do motorista e mira EMES-18");
    c.zone("vidros_t", "Periscópios do comandante");
    c.zone("tampa_motor", "Convés e grades do motor", [ex0 - 0.1, ex1 + 0.1, deckY - 0.3, deckY + 0.3, -1.3, 1.3], hood ? [hood.piv] : null, { type: "capo", fxKey: "capo", dir: "cima" });
    c.zone("cesto", "Cesto de bagagem", [tx - 2.55, tx - 2.0, ty + 0.1, ty + 0.85, -1.15, 1.15], null, { type: "peca", fxKey: "carenagem", dir: "frente" });
    void low;
    fosco(c, col);
    m.damage = danoBlindado;
    blindagem(c, 0.3);
    /* capotado: apoia na torre e inclina um pouco para a frente */
    capotagem(c, { tilt: 0.07 });
    m.armor = function (c2) { leopardoMod(c2, F, R, W, roofY, tx, ty, tTop); };
  });
  /* lagarta do Leopard: rodas de apoio duplas, motriz dentada atrás, tensora na frente, roletes de retorno */
  function lagartaLeo(c, o) {
    var x0 = o.x0, x1 = o.x1, z = o.z, w = o.w || 0.55, th = 0.06, n = 7, r = 0.35, mat = CM("#2b2c2a", { metalness: 0.5, roughness: 0.6 }), wm = o.wheelMat;
    var xs = x0 + 0.55, xe = x1 - 0.5, sp = (xe - xs) / (n - 1), rS = 0.26, yS = 0.8, rI = 0.27, yI = 0.66, rr = 0.075;
    function wheel(x, y, rad, opt) {
      var g = new THREE.Group(); g.position.set(x, y, z); c.g.add(g);
      var wmsh = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, w * 0.8, 24), wm); wmsh.rotation.x = PI / 2; wmsh.castShadow = true; g.add(wmsh);
      if (opt.tires) [-1, 1].forEach(function (q) { var t = new THREE.Mesh(new THREE.TorusGeometry(rad - 0.035, 0.035, 6, 24), MT.rubber); t.position.z = q * w * 0.22; g.add(t); });
      var hb = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.32, rad * 0.32, w * 0.86, 10), MT.steel); hb.rotation.x = PI / 2; g.add(hb);
      if (opt.teeth) for (var t2 = 0; t2 < 12; t2++) { var a = t2 / 12 * PI * 2, tg = new THREE.Mesh(G.rbox(0.07, 0.07, w * 0.5, 0.012), CANO); tg.position.set(Math.cos(a) * (rad + 0.02), Math.sin(a) * (rad + 0.02), 0); tg.rotation.z = a; g.add(tg); }
      if (opt.spokes) for (var k = 0; k < 6; k++) { var b = new THREE.Mesh(G.rbox(rad * 1.5, 0.05, 0.04, 0.01), wm); b.rotation.z = k / 6 * PI; b.position.z = (z > 0 ? 1 : -1) * w * 0.42; g.add(b); }
      c.spin.push({ o: g, axis: "z", v: 0, track: true }); return g;
    }
    for (var i = 0; i < n; i++) wheel(xs + i * sp, r + th, r, { tires: true });
    wheel(x0, yS, rS, { teeth: true });
    wheel(x1, yI, rI, { spokes: true, tires: true });
    var topY = function (x) { return yS + rS + th / 2 + (yI + rI - yS - rS) * (x - x0) / (x1 - x0); };
    for (var q = 0; q < 4; q++) { var xr = x0 + (x1 - x0) * (0.2 + q * 0.2); wheel(xr, topY(xr) - rr - th / 2 - 0.01, rr, {}); }
    var path = [], segs = 12;
    function arc(cx, cy, rad, a0, a1) { for (var s = 0; s <= segs; s++) { var a = a0 + (a1 - a0) * s / segs; path.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } }
    path.push([xs - 0.06, th / 2]); for (i = 1; i < n - 1; i++) path.push([xs + i * sp, th / 2]); path.push([xe + 0.06, th / 2]);
    arc(x1, yI, rI + th / 2, -PI / 2 + 0.75, PI / 2);
    for (q = 3; q >= 0; q--) { var xq = x0 + (x1 - x0) * (0.2 + q * 0.2); path.push([xq, topY(xq) - 0.012]); }
    arc(x0, yS, rS + th / 2, PI / 2, PI * 1.5 - 0.55);
    var pts = path.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var curve = new THREE.SplineCurve(pts.concat([pts[0]])), lenT = curve.getLength(), nl = Math.round(lenT / 0.15), links = [];
    for (var l = 0; l < nl; l++) {
      var t = l / nl, p = curve.getPointAt(t), tg = curve.getTangentAt(t), ang = Math.atan2(tg.y, tg.x);
      var lg = G.rbox(0.13, th, w, 0.015); lg.applyMatrix4(new THREE.Matrix4().makeRotationZ(ang).setPosition(p.x, p.y, 0)); links.push(lg);
      var gh2 = G.rbox(0.05, 0.05, 0.05, 0.01); gh2.applyMatrix4(new THREE.Matrix4().makeRotationZ(ang).setPosition(p.x - Math.sin(ang) * 0.04, p.y + Math.cos(ang) * 0.04, 0)); links.push(gh2);
    }
    var tm = c.add(G.merge(links), mat, 0, 0, z); tm.userData.noFollow = true;
    c.part("lagarta", "Lagarta " + (z > 0 ? "direita" : "esquerda"), tm, new V3((x0 + x1) / 2, 0.3, z), 1.4);
  }
  function leopardoMod(c, F, R, W, roofY, tx, ty, tTop) {
    /* lâmina de escavadeira, sacos de areia no glacis, rede sobre a torre, galões e metralhadora do comandante */
    c.rb(0.12, 0.75, W + 0.1, 0.04, ZG.STEELM, F + 0.45, 0.55, 0, { rot: [0, 0, 0.15] });
    c.rb(0.06, 0.12, W + 0.1, 0.02, MT.steel, F + 0.55, 0.18, 0);
    [1, -1].forEach(function (s) { c.rod(new V3(F - 0.1, 0.95, s * 1.0), new V3(F + 0.42, 0.6, s * 1.0), 0.06, CANO); });
    sacosAreia(c, -0.9, 0.9, 1.5, 2.45, "z", 2);
    redeCamuflagem(c, tx - 2.3, tx - 0.35, tTop, 2.3, 0.55);
    metralhadora(c, tx - 0.45, tTop + 0.35, 0.6, { len: 1.3 });
    c.rb(0.04, 0.32, 0.45, 0.02, ACO, tx - 0.2, tTop + 0.38, 0.6);
    for (var x = -3.2; x <= -2.0; x += 0.4) [1, -1].forEach(function (s) { jerry(c, x, roofY + 0.0, s * 1.38, s > 0 ? "#3e4a2c" : AREIA, 0); });
    for (var b = 0; b < 5; b++) c.cyl(0.09, 0.09, 1.6, CM("#5a4530", { roughness: 0.95 }), R - 0.15, 0.9 + b * 0.18, 0, "z");
    void ty;
  }

  /* ================================================================ */
  /* Falcão Negro HM-2 · Sikorsky UH-60L Black Hawk (HM-2 da Aviação do Exército)
     Referência (ficha do UH-60L confirmada na web; trem e estabilizador de memória):
       comprimento com rotores girando 19,76 m · fuselagem 15,26 m (do nariz à ponta do rotor de cauda) · altura 5,13 m (topo do rotor de cauda)
       largura da fuselagem 2,36 m · rotor principal de 16,36 m e 4 pás · rotor de cauda de 3,35 m inclinado 20° à direita
       bitola do trem principal ≈ 2,70 m · entre-eixos (trem principal à bequilha) ≈ 8,83 m · estabilizador ≈ 4,38 m de envergadura
       cubo do rotor a ≈ 3,7 m do nariz · vão livre ≈ 0,6 m · 5.224 kg vazio, 7.900 kg de decolagem · 1.360 L internos · 584 km · 296 km/h
     Traços de assinatura:
       frente: nariz curto e rombudo com para-brisa de dois painéis grandes, cortador de fio acima e abaixo, pitots dos dois lados
       lateral: cabine comprida com porta corrediça larga, janela do artilheiro logo atrás da porta do piloto, trem principal de braço arrastado
                com rodas grandes sob a cabine de pilotagem, cone de cauda comprido e baixo com bequilha
       traseira: pilone inclinado com o rotor de cauda do lado direito e estabilizador grande embaixo
       teto: dois turboeixos lado a lado em naceles com entrada de ar à frente e supressores de infravermelho virados para fora, rotor de 4 pás */
  function boxKeep(x0, x1, y0, y1, zw, zMin) { return { sdf: function (x, y, z) { var d = Math.max(x0 - x, x - x1, y0 - y, y - y1, Math.abs(z) - zw, (zMin || -1) - Math.abs(z)); return -d; } }; }
  function boxCut(x0, x1, y0, y1, zw, zMin) { return { sdf: function (x, y, z) { return Math.max(x0 - x, x - x1, y0 - y, y - y1, Math.abs(z) - zw, (zMin || -1) - Math.abs(z)); } }; }
  function rotorMil(c, x, y, z, n, len, chord, mat, o) {
    o = o || {};
    var g = new THREE.Group(); g.position.set(x, y, z); c.g.add(g);
    for (var i = 0; i < n; i++) {
      var piv = new THREE.Group(); piv.rotation[o.axis === "z" ? "z" : "y"] = i / n * PI * 2 + (o.phase || 0);
      var geo = G.rbox(len, o.th || 0.06, chord, 0.02); geo.translate(len / 2 + (o.hub || 0.3), 0, 0);
      if (o.droop) { var p = geo.attributes.position; for (var k = 0; k < p.count; k++) { var t = p.getX(k) / len; p.setY(k, p.getY(k) - o.droop * t * t); } geo.computeVertexNormals(); }
      var b = new THREE.Mesh(geo, mat); b.castShadow = true;
      if (o.axis === "z") b.rotation.x = PI / 2;
      piv.add(b);
      if (o.tip) { var tp = new THREE.Mesh(G.rbox(0.25, (o.th || 0.06) + 0.005, chord + 0.005, 0.01), o.tip); tp.position.set(len + (o.hub || 0.3) - 0.12, -(o.droop || 0), 0); if (o.axis === "z") tp.rotation.x = PI / 2; piv.add(tp); }
      g.add(piv);
    }
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(o.hubR || 0.32, o.hubR || 0.32, 0.22, 18), CANO); if (o.axis === "z") hub.rotation.x = PI / 2; g.add(hub);
    c.spin.push({ o: g, axis: o.axis === "z" ? "z" : "y", v: o.v || 3 });
    return g;
  }
  ZG.register({ k: "blackhawk", grp: GRP, n: "Falcão Negro HM-2", insp: "Sikorsky UH-60 Black Hawk", c: "Helicóptero de assalto e transporte", fuel: "qav",
    d: "Dois turboeixos, rotor de quatro pás e portas corrediças largas. Tira onze soldados de um telhado cercado e aguenta tiro de fuzil nas pás.",
    mass: 7700, r: 600, seats: "2 pilotos + 2 artilheiros + 11 soldados", cap: "1.360 L", eff: "≈ 600 L/h", auto: "590 km", vmax: 295, skill: "Pilotagem aérea 5 (bimotor)", hood: false
  }, function (c) {
    var col = "#55603f", paint = tinta(c, col), dark = tinta(c, "#363b2e");
    var st = [{ x: 3.58, w: 0.3, h: 0.36, y: 1.32 }, { x: 3.38, w: 1.3, h: 1.15, y: 1.45, p: 2.2 }, { x: 2.8, w: 1.95, h: 1.62, y: 1.56, p: 2.6 }, { x: 1.9, w: 2.25, h: 1.86, y: 1.62, p: 3 },
      { x: 0.6, w: 2.36, h: 1.9, y: 1.62, p: 3.3 }, { x: -2.4, w: 2.3, h: 1.86, y: 1.64, p: 3.3 }, { x: -3.4, w: 1.6, h: 1.36, y: 1.9, p: 2.6 }, { x: -4.6, w: 0.9, h: 0.86, y: 2.15, p: 2.2 },
      { x: -8.3, w: 0.5, h: 0.6, y: 2.32, p: 2 }, { x: -8.95, w: 0.4, h: 0.52, y: 2.38, p: 2 }, { x: -9.15, w: 0.06, h: 0.2, y: 2.42 }];
    var wsCut = boxCut(2.15, 3.25, 1.8, 2.7, 1.2), cockSide = boxCut(1.12, 2.08, 1.72, 2.38, 2, 0.8), gun = boxCut(0.3, 0.95, 1.78, 2.28, 2, 0.8), door = boxCut(-1.65, 0.12, 0.84, 2.26, 2, 0.8);
    var fus = c.add(G.subdivide(G.loft(st, 32, 2.4), 0.12), paint);
    ZG.cutMesh(fus, [wsCut, cockSide, gun, door], 30);
    c.deform.push(fus);
    /* vidros moldados na própria fuselagem (loft interno recortado) */
    function vidro(test, label, type) {
      var st2 = st.map(function (q) { return Object.assign({}, q, { w: q.w * 0.985, h: q.h * 0.985 }); });
      var g = new THREE.Mesh(G.subdivide(G.loft(st2, 32, 2.4), 0.1), MT.glass);
      ZG.cutMesh(g, [test], 30); c.g.add(g);
      return ZG.asGlass(c, g, label, type);
    }
    vidro(boxKeep(2.15, 3.25, 1.8, 2.7, 1.2), "Para-brisa", "laminado");
    vidro(boxKeep(1.12, 2.08, 1.72, 2.38, 2, 0.8), "Janelas das portas da cabine", "temperado");
    vidro(boxKeep(0.3, 0.95, 1.78, 2.28, 2, 0.8), "Janelas dos artilheiros", "temperado");
    /* molduras do para-brisa */
    c.rod(new V3(2.25, 2.55, 0), new V3(3.15, 1.85, 0), 0.025, PRETO);
    [1, -1].forEach(function (sd) { c.rod(new V3(2.15, 2.55, sd * 0.85), new V3(2.2, 1.8, sd * 1.05), 0.025, PRETO); });
    /* interior: cabine de pilotagem */
    var fl = 0.86, fab = CM("#2f3226", { roughness: 0.9 });
    c.rb(5.6, 0.04, 2.05, 0.01, MT.carpet, -0.4, fl, 0).castShadow = false;
    [0.5, -0.5].forEach(function (z) { ZG.seat(c, 1.55, fl, z, { w: 0.5, h: 0.42, back: 0.72, lean: 0.12, mat: fab }); c.rod(new V3(2.0, fl, z), new V3(1.95, fl + 0.55, z), 0.016, PRETO); c.sph(0.035, PRETO, 1.95, fl + 0.57, z); });
    c.rb(0.25, 0.45, 1.9, 0.05, CM("#232427"), 2.45, fl + 0.55, 0);
    c.rb(0.4, 0.05, 1.95, 0.02, CM("#1a1b1d"), 2.4, fl + 0.8, 0, { rot: [0, 0, 0.25] });
    [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].forEach(function (z) { c.rb(0.012, 0.14, 0.18, 0.01, MT.screen, 2.32, fl + 0.62, z); });
    c.rb(0.5, 0.3, 0.3, 0.04, CM("#232427"), 1.95, fl + 0.15, 0);
    /* cabine de tropa: três fileiras de bancos de lona (4 + 4 + 3 = 11 soldados), um lugar registrado por assento */
    [[-0.25, 4], [-1.15, 4], [-2.35, 3]].forEach(function (r) {
      var wB = r[1] === 4 ? 1.95 : 1.5;
      ZG.seat(c, r[0], fl, 0, { w: wB, n: r[1], h: 0.4, back: 0.55, lean: 0.08, dir: 1, mat: LONA_CAP, headrest: false });
      var st = c.seatTops.pop();
      for (var q = 0; q < r[1]; q++) c.seatTops.push({ x: st.x, y: st.y, z: (q - (r[1] - 1) / 2) * wB / r[1], w: wB / r[1] - 0.02, l: st.l });
    });
    [1, -1].forEach(function (sd) { ZG.seat(c, 0.6, fl, sd * 0.75, { w: 0.5, h: 0.4, back: 0.55, lean: 0.08, mat: fab, headrest: false }); });
    c.rb(4.6, 0.02, 1.9, 0.01, MT.headliner, -0.6, 2.45, 0).castShadow = false;
    /* luz interna fraca (branco esverdeado) e forro claro na antepara: a cabine aparece pela porta à noite */
    var luzCab = CM("#d8e2c8", { emissive: new THREE.Color("#a4b896"), emissiveIntensity: 0.9 });
    [-0.3, -1.6].forEach(function (x) { c.rb(0.5, 0.02, 0.08, 0.01, luzCab, x, 2.43, 0).castShadow = false; });
    c.rb(0.04, 1.5, 1.95, 0.01, CM("#6e7564", { roughness: 0.9, emissive: new THREE.Color("#1c2216"), emissiveIntensity: 1 }), -2.9, 1.6, 0);
    /* portas corrediças abertas, recolhidas para trás */
    [1, -1].forEach(function (sd) {
      var dz = sd * 1.2;
      c.rb(1.75, 1.38, 0.05, 0.08, paint, -2.45, 1.56, dz, { def: true });
      ZG.asGlass(c, c.rb(0.55, 0.45, 0.02, 0.06, MT.glass, -2.1, 1.95, dz + sd * 0.03), "Janela da porta " + (sd > 0 ? "direita" : "esquerda"), "temperado");
      c.rb(1.9, 0.05, 0.06, 0.02, ACO, -1.6, 2.28, sd * 1.19);
      c.rb(1.9, 0.05, 0.06, 0.02, ACO, -1.6, 0.86, sd * 1.15);
      estrela(c, -2.45, 1.4, dz + sd * 0.03, 0.22, sd > 0 ? "+z" : "-z", { ring: true });
      c.text("EXÉRCITO", 1.3, 0.22, -6.0, 2.25, sd * 0.34, sd > 0 ? "+z" : "-z", { fg: "#dcdace", size: 0.75 });
      c.text("EB 2008", 0.8, 0.2, -4.3, 2.1, sd * 0.48, sd > 0 ? "+z" : "-z", { fg: "#dcdace", size: 0.7 });
      /* degrau e alças */
      c.rb(0.4, 0.04, 0.2, 0.01, ACO, 1.5, 0.82, sd * 1.15);
    });
    /* trem de pouso: rodas principais e bequilha */
    [1, -1].forEach(function (sd) {
      var w = c.wheel(1.15, sd * 1.35, 0.33, 0.2, { rim: RIMO, spokes: 0, rimR: 0.55, label: "Roda do trem " + (sd > 0 ? "direita" : "esquerda") });
      c.rod(new V3(1.15, 0.33, sd * 1.28), new V3(1.0, 1.15, sd * 1.05), 0.06, ACO);
      c.rod(new V3(1.15, 0.33, sd * 1.28), new V3(0.4, 0.85, sd * 0.95), 0.045, ACO);
      c.rb(0.25, 0.2, 0.2, 0.04, ACO, 1.15, 0.36, sd * 1.22);
      void w;
    });
    var bequilha = [c.wheel(-7.7, 0, 0.2, 0.14, { rim: RIMO, spokes: 0, noPart: true, label: "Bequilha" }),
      c.rod(new V3(-7.7, 0.2, 0), new V3(-7.55, 2.0, 0), 0.05, ACO), c.rod(new V3(-7.7, 0.25, 0), new V3(-7.2, 2.05, 0), 0.035, ACO)];
    /* capota dos motores, entradas de ar, escapamentos com supressor de IR */
    c.rb(3.4, 0.5, 1.5, 0.22, paint, -0.8, 2.75, 0, { def: true });
    [1, -1].forEach(function (sd) {
      c.cyl(0.3, 0.27, 2.1, paint, -0.9, 2.82, sd * 0.78, "x", { seg: 20 });
      c.cyl(0.22, 0.22, 0.05, MT.dark, 0.16, 2.82, sd * 0.78, "x", { seg: 20 });
      c.cyl(0.24, 0.24, 0.08, ACO, 0.18, 2.82, sd * 0.78, "x", { seg: 20, open: true });
      var ex = c.cyl(0.2, 0.25, 0.7, dark, -2.15, 2.85, sd * 1.0, "x", { seg: 16 }); ex.rotation.y = sd * 0.5;
      c.cyl(0.17, 0.17, 0.02, MT.dark, -2.47, 2.85, sd * 1.18, "x").rotation.y = sd * 0.5;
    });
    c.cyl(0.12, 0.14, 0.55, ACO, 0.0, 3.25, 0);
    c.cyl(0.32, 0.28, 0.12, CANO, 0.0, 3.15, 0);
    /* rotor principal de 4 pás com pontas enflechadas */
    var mr = rotorMil(c, 0.0, 3.58, 0, 4, 7.78, 0.53, CM("#23251f", { roughness: 0.55 }), { hub: 0.4, droop: 0.32, tip: CM("#b9a640", { roughness: 0.5 }), v: 2.6, phase: PI / 4 });
    /* cauda: pilone inclinado, rotor de cauda à direita, estabilizador */
    var py = c.rb(1.0, 1.65, 0.22, 0.08, paint, -9.15, 3.1, 0, { taper: { sx: 0.6, shift: -0.4 }, def: true });
    void py;
    var trg = new THREE.Group(); trg.position.set(-9.6, 3.62, 0.3); trg.rotation.x = -0.35; c.g.add(trg);
    var tr = rotorMil(c, 0, 0, 0, 4, 1.555, 0.24, CM("#23251f", { roughness: 0.55 }), { axis: "z", hub: 0.12, hubR: 0.12, v: 14, th: 0.03 });
    c.g.remove(tr); trg.add(tr);
    /* estabilizador em duas metades (a de baixo dobra quando o helicóptero tomba de lado) */
    var stab = [1, -1].map(function (sd) { return c.rb(1.0, 0.06, 2.2, 0.03, paint, -9.05, 2.3, sd * 1.1, { def: true }); });
    var faixas = [1, -1].map(function (sd) { return c.rb(0.8, 0.012, 0.06, 0.004, MT.amber, -9.05, 2.34, sd * 2.1); });
    /* antenas, pitots, cortador de fio, luzes de navegação */
    [1, -1].forEach(function (sd) { c.rod(new V3(3.3, 1.75, sd * 0.35), new V3(3.95, 1.75, sd * 0.4), 0.015, ACO); });
    c.rb(0.6, 0.25, 0.04, 0.01, ACO, 2.9, 2.5, 0, { rot: [0, 0, -0.6] });
    c.rb(0.5, 0.2, 0.04, 0.01, ACO, 3.15, 0.9, 0, { rot: [0, 0, 0.5] });
    c.sph(0.05, CM("#1d7a3a", { emissive: new THREE.Color("#2fbf5a"), emissiveIntensity: 1.0 }), -0.3, 2.3, 1.2);
    c.sph(0.05, CM("#8a1a14", { emissive: new THREE.Color("#c0281c"), emissiveIntensity: 1.0 }), -0.3, 2.3, -1.2);
    c.cyl(0.1, 0.08, 0.15, ACO, 2.3, 0.62, 0.3); c.cyl(0.08, 0.08, 0.02, MT.head, 2.3, 0.54, 0.3);
    antena(c, -3.6, 2.5, 0, 0.9);
    c.part("rotor", "Rotor principal", mr, new V3(0, 3.58, 0), 2.2); c.part("rotorcauda", "Rotor de cauda", tr, new V3(-9.6, 3.62, 0.3), 1.2);
    c.part("motor", "Turboeixos", null, new V3(-0.9, 2.82, 0), 1.0); c.part("tanque", "Tanques de QAV", null, new V3(-2.2, 1.0, 0), 1.0);
    c.part("trem", "Trem de pouso", null, new V3(1.15, 0.3, 1.3), 1.0);
    c.part("fuselagem", "Cabine de tropa", null, new V3(-0.8, 1.6, 1.15), 1.2);
    c.part("fuselagem", "Cone de cauda", null, new V3(-5.5, 2.2, 0.3), 1.6);
    c.part("cabine", "Cabine de pilotagem", null, new V3(3.0, 1.8, 0), 1.0);
    c.part("aviônica", "Nariz / aviônica", null, new V3(3.45, 1.35, 0), 1.0);
    c.part("fuselagem", "Fuselagem traseira", null, new V3(-3.3, 1.5, 0), 1.2);
    c.part("fuselagem", "Cauda baixa e bequilha", null, new V3(-7.6, 1.5, 0), 1.2);
    c.parts.forEach(function (p) { if (p.n === "Para-brisa") { p.pos.set(3.0, 2.1, 0); p.reach = 1.0; } });
    c.part("cauda", "Pilone e estabilizador", null, new V3(-9.1, 2.8, 0), 1.6);
    Object.assign(c.meta, { kind: "heli", col: col, L: 13.25, W: 2.4, fusW: 2.36, front: 3.6, rear: -9.65, clear: 0.67, belt: 1.5, bodyH: 1.3, top: 3.7, fusTop: 2.57, roof: null });
    /* capotagem: o helicóptero tomba de lado (90°), como nos acidentes reais; as pás quebram no chão */
    function quebraPas(c2) {
      if (mr.userData.quebrado) return; mr.userData.quebrado = true;
      c2.spin = c2.spin.filter(function (sp) { return sp.o !== mr; });
      var sphi = Math.sin((c2.milRollS || 1) * PI / 2), hubH = 1.35;
      mr.children.forEach(function (piv, i) {
        if (!piv.isGroup) return;
        var a = mr.rotation.y + piv.rotation.y, dz = -Math.sin(a), d = dz * sphi, k;
        if (d > 0.05) k = Math.max(0.02, Math.min(0.4, (hubH / d - 0.4) / 7.6)); else k = 0.16 + 0.22 * ZG.hash(i, 3, 7);
        var b = piv.children[0]; b.scale.x = k; b.position.x = 0.4 * (1 - k);
        if (piv.children[1]) piv.remove(piv.children[1]);
        piv.rotation.z += (ZG.hash(i, 5, 1) - 0.5) * 0.35;
      });
      var hp = c2.toFx(new V3(0, 3.58, 0));
      ZG.burst(c2, "lata", hp, 12, { speed: 4, spread: 2, mat: CM("#23251f", { roughness: 0.55 }) });
      ZG.burst(c2, "faisca", hp, 26, { speed: 4, spread: 2 });
      var rp = c2.parts.find(function (p) { return p.kind === "rotor"; }); if (rp && !rp.done) { rp.done = true; c2.log.push(rp); }
    }
    capotagem(c, {
      onStart: function (c2, A) { A.target = PI / 2; },
      onRoll: function (c2, A) { if (A.last >= 1 && A.last < 3) A.last = 3; if (A.t / A.dur > 0.33) quebraPas(c2); },
      onFlip: function (c2) {
        quebraPas(c2);
        var sd = c2.milRollS || 1, half = stab[sd > 0 ? 0 : 1];
        half.scale.z = 0.35; half.position.z = sd * 0.42; half.rotation.x = sd * 0.5;
        ZG.burst(c2, "lata", c2.toFx(new V3(-9.05, 2.3, sd * 1.6)), 5, { speed: 2, mat: paint });
      }
    });
    /* zonas: a derivação automática põe a cabine de tropa dentro do cone; aqui cada trecho do Black Hawk tem a sua */
    var fz = 1.18 + 0.3;
    c.zone("nariz", "Nariz e para-brisa");
    c.zone("cabine", "Cabine de pilotagem e portas dos pilotos", [1.05, 2.45, 0.6, 2.7, -fz, fz], null, { dir: "esquerda", fxKey: "cabineaero", who: "os pilotos" });
    c.zone("cabine_tropa", "Cabine de tropa e portas corrediças", [-2.95, 1.05, 0.6, 2.6, -fz - 0.1, fz + 0.1], null, { dir: "esquerda", fxKey: "cabine", who: "os soldados", anyMesh: true });
    /* o núcleo dobra o cone (amassado e destruído) girando o que está atrás do vinco, mas pula as peças de outra zona:
       o pilone e o estabilizador (zona "pilone") giram aqui junto, senão ficam soltos no ar; arrancado leva a cauda inteira */
    var coneB = [-8.7, -2.95, 1.2, 2.9];
    c.zone("cone", "Cone de cauda", [coneB[0], coneB[1], coneB[2], coneB[3], -0.9, 0.9], null, { dir: "cima", fxKey: "cone", cutAll: true, anyMesh: true,
      onBand: function (c2, b) {
        var cauda = [py].concat(stab);
        if (b === 4) {
          /* a cauda some inteira: pilone, estabilizador, rotor, bequilha e a ponta do cone que fica fora da caixa */
          cauda.concat(faixas, bequilha, [trg]).forEach(function (o) { o.visible = false; });
          ZG.cutMesh(fus, [boxCut(-9.5, coneB[0] + 0.05, 0, 4.5, 2)], 30);
          return;
        }
        if (b < 2) return;
        var kx = coneB[0] + (coneB[1] - coneB[0]) * (b === 2 ? 0.55 : 0.62), ky = (coneB[2] + coneB[3]) / 2, ang = b === 2 ? 0.035 : 0.16;
        var q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), ang), cs = Math.cos(ang), sn = Math.sin(ang);
        cauda.forEach(function (o) { var dx = o.position.x - kx, dy = o.position.y - ky; o.position.x = kx + dx * cs - dy * sn; o.position.y = ky + dx * sn + dy * cs; o.quaternion.premultiply(q); });
      } });
    c.zone("pilone", "Pilone e estabilizador", [-9.8, -8.6, 1.9, 4.05, -2.4, 2.4], [py].concat(stab), { type: "peca", fxKey: "cauda", dir: "frente", anyMesh: true });
    c.zone("motor", "Turboeixos e transmissão", [-2.6, 0.4, 2.3, 3.35, -1.15, 1.15], null, { type: "interno", fxKey: "motor", sub: "motor", pos: new V3(-0.9, 2.82, 0) });
    c.meta.armor = function (c2) { blackhawkMod(c2, paint); };
  });
  function blackhawkMod(c, paint) {
    /* asas de armamento externo com tanques auxiliares, metralhadoras nas janelas dos artilheiros, lançadores de flare */
    var tankM = tinta(c, "#3a4030");
    [1, -1].forEach(function (sd) {
      c.rb(0.75, 0.08, 2.6, 0.03, paint, -0.6, 2.25, sd * 2.4, { rot: [sd * -0.12, 0, 0] });
      c.rod(new V3(-0.6, 1.2, sd * 1.1), new V3(-0.6, 2.15, sd * 3.2), 0.03, ACO);
      [1.9, 3.3].forEach(function (z) {
        c.cyl(0.32, 0.32, 2.2, tankM, -0.6, 1.85, sd * z, "x", { seg: 20 });
        c.sph(0.32, tankM, 0.5, 1.85, sd * z, 1.8, 1, 1); c.sph(0.32, tankM, -1.7, 1.85, sd * z, 1.5, 1, 1);
        c.rb(0.4, 0.15, 0.06, 0.02, ACO, -0.6, 2.1, sd * z);
      });
      metralhadora(c, 0.62, 1.95, sd * 1.25, { len: 1.0, yaw: -sd * 1.3 });
      c.rb(0.3, 0.2, 0.15, 0.03, ACO, -2.9, 1.0, sd * 0.95);
      c.rb(0.04, 0.6, 0.45, 0.01, ZG.STEELM, 1.6, 1.65, sd * 1.12);
    });
    c.part("tanque", "Tanques externos", null, new V3(-0.6, 1.85, 2.6), 1.2);
  }
})(window.ZG);
