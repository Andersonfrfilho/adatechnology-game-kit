/* Grupo C · caminhões, ônibus, carro-forte e trator. Só usa a API de window.ZG (veja API.md).
   Funções locais deste arquivo:
   - cabOver: cabine avançada com perfil, para-brisa, janela da porta, interior e frente por modelo (delivery, constellation, atego)
   - tiltCab: cabine basculante (o botão "Abrir capô" inclina a cabine para a frente e mostra o diesel embaixo)
   - chassis: longarinas, eixos traseiros com rodado duplo, para-lamas, tanque, baterias, protetores laterais e para-choque traseiro
   - boxBody: baú de carga (ou baú blindado do carro-forte)
   - mirrorBay: compartimento do motor espelhado para motor traseiro (ônibus urbano) */
(function (ZG) {
  "use strict";
  var V3 = ZG.V3, PI = Math.PI, MT = ZG.MT, CM = ZG.CM;
  var GRP = "Caminhões e ônibus";
  var RIM_W = CM("#d9d6cc", { metalness: 0.35, roughness: 0.45 }), RIM_S = CM("#9ea3a6", { metalness: 0.6, roughness: 0.35 });
  var BUMPER_D = CM("#33363a", { roughness: 0.65 }), PLAST = CM("#202226", { roughness: 0.7 }), ALU = CM("#b9bec2", { metalness: 0.75, roughness: 0.3 });
  var REFL_R = CM("#b3261e", { roughness: 0.4, emissive: new THREE.Color("#2a0402"), emissiveIntensity: 0.3 }), REFL_W = CM("#e8e8e2", { roughness: 0.4 });

  function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function armorPlus(fn) { return function (c, Z) { Z.applyArmor(c); fn(c, Z); }; }
  function roofLamp(c, x, y, z) { c.cyl(0.08, 0.065, 0.12, MT.steel, x, y, z, "x"); c.cyl(0.07, 0.07, 0.012, MT.head, x + 0.065, y, z, "x"); }
  function sandbags(c, x0, x1, y, z, along) {
    var bag = CM("#6e6248", { roughness: 0.95 });
    if (along === "z") { for (var zz = x0; zz <= x1 + 1e-6; zz += 0.42) { c.rb(0.3, 0.16, 0.4, 0.07, bag, z, y, zz); c.rb(0.3, 0.16, 0.4, 0.07, bag, z, y + 0.15, zz + 0.2 > x1 ? zz : zz + 0.2); } }
    else { for (var xx = x0; xx <= x1 + 1e-6; xx += 0.42) { c.rb(0.4, 0.16, 0.3, 0.07, bag, xx, y, z); c.rb(0.4, 0.16, 0.3, 0.07, bag, xx + 0.2 > x1 ? xx : xx + 0.2, y + 0.15, z); } }
  }
  /* roda de caminhão: disco de aço com furos de ventilação */
  function truckWheel(c, x, z, r, w, o) {
    o = o || {};
    var g = c.wheel(x, z, r, w, { rim: o.rim || RIM_W, spokes: 0, rimR: 0.56, noPart: o.noPart, label: o.label });
    var s = z >= 0 ? 1 : -1, rr = r * 0.56;
    if (!o.inner) for (var k = 0; k < 8; k++) { var a = k / 8 * PI * 2; c.cyl(rr * 0.13, rr * 0.13, 0.012, MT.dark, Math.cos(a) * rr * 0.62, Math.sin(a) * rr * 0.62, s * w * 0.405, "z", { parent: g, seg: 10 }); }
    if (!o.inner) for (var n = 0; n < 10; n++) { var b = n / 10 * PI * 2; c.cyl(0.016, 0.016, 0.04, MT.chrome, Math.cos(b) * rr * 0.36, Math.sin(b) * rr * 0.36, s * w * 0.43, "z", { parent: g, seg: 6 }); }
    return g;
  }
  /* bateria de motor: o núcleo trava o capô entreaberto quando o motor é atingido; na cabine basculante isso
     levantaria a cabine inteira, então o efeito é refeito sem a trava */
  function motorNoLatch(c) {
    c.parts.forEach(function (p) {
      if (p.kind !== "motor") return;
      p.onHit = function (c2, pt, force) {
        ZG.addEmitter(c2, pt.pos.clone().add(new V3(0, 0.35, 0)), "preta");
        ZG.puddle(c2, "oleo", pt.pos.clone().setY(Math.max(0.2, c2.meta.clear || 0.3)), 0.6 + force * 0.3);
      };
    });
  }

  /* cromado claro: a cena não tem mapa de ambiente, então o metal puro sai preto; um emissivo baixo imita o reflexo */
  var CHR = CM("#e2e6e9", { metalness: 0.55, roughness: 0.2, emissive: new THREE.Color("#3a4046"), emissiveIntensity: 1 });
  var RUSTY = CM("#7a5a44", { roughness: 0.75, metalness: 0.35 });

  /* tanque de diesel: vaza uma poça oleosa que não pega fogo (diesel quase não inflama numa batida) */
  function dieselLeak(c, pt) {
    pt.onHit = function (c2, p2, force) { ZG.puddle(c2, "oleo", p2.pos.clone().setY(Math.max(0.2, c2.meta.clear || 0.3)), 0.7 + force * 0.5); };
  }

  /* luz de serviço no vão do motor: acende conforme o capô (ou a cabine) abre */
  function bayLight(c, x, y, z, dist, k) {
    var L = new THREE.PointLight(0xfff0d2, 0, dist || 1.6, 2); L.position.set(x, y, z); c.g.add(L);
    c.rb(0.1, 0.035, 0.05, 0.012, CM("#f6efdc", { emissive: new THREE.Color("#f0dcae"), emissiveIntensity: 0.9 }), x, y + 0.04, z);
    L.updateMatrix = function () {
      THREE.Object3D.prototype.updateMatrix.call(this);
      var h = c.hood, t = h ? Math.max(0, Math.min(1, h.ang / ((h.open || 1) * 0.6))) : 1; this.intensity = (k || 1.3) * t;
    };
    return L;
  }

  /* motor diesel em linha, eixo ao longo de x. o: { x (centro), y (base do cárter), z, L, w, h, n (cilindros), dir (+1 = frente para +x), exh (+1 escape em z+), col, fan } */
  function dieselEngine(c, o) {
    var n = o.n || 4, L = o.L, w = o.w, h = o.h, x = o.x, y0 = o.y, z = o.z || 0, d = o.dir || 1, es = o.exh || 1;
    var em = CM(o.col || "#7d8489", { roughness: 0.46, metalness: 0.3 }), dk = CM("#45494c", { roughness: 0.55, metalness: 0.3 }), cv = CM(o.cover || "#33373a", { roughness: 0.32, metalness: 0.45 });
    var ph = h * 0.2, bh = h * 0.5, hh = h * 0.16, vh = h * 0.14;
    var yB = y0 + ph + bh / 2, yH = y0 + ph + bh + hh / 2, yV = y0 + ph + bh + hh + vh / 2, top = y0 + h, pitch = L * 0.9 / n;
    c.rb(L * 0.86, ph, w * 0.78, 0.03, dk, x - d * L * 0.03, y0 + ph / 2, z);
    c.rb(L, bh, w, 0.04, em, x, yB, z);
    c.rb(L * 0.96, hh, w * 0.92, 0.03, em, x, yH, z);
    c.rb(L * 0.9, vh, w * 0.64, 0.04, cv, x, yV, z);
    for (var r = 0; r < 3; r++) c.rb(L * 0.8, 0.012, 0.014, 0.004, CHR, x, top + 0.004, z - w * 0.2 + r * w * 0.2);
    c.cyl(0.038, 0.038, 0.035, MT.yellow, x + d * L * 0.3, top + 0.016, z + w * 0.14);
    var inj = [];
    for (var i = 0; i < n; i++) {
      var cx = x - L * 0.45 + (i + 0.5) * pitch;
      [1, -1].forEach(function (s) { c.rb(pitch * 0.55, bh * 0.82, 0.03, 0.012, em, cx, yB, z + s * (w / 2 + 0.008)); });
      /* escape: um tubo por cilindro até o coletor */
      c.rb(pitch * 0.42, hh * 0.8, 0.09, 0.025, RUSTY, cx, yH, z + es * (w / 2 + 0.035));
      /* injetor */
      var ij = new V3(cx, top + 0.02, z - es * w * 0.38); c.cyl(0.016, 0.016, 0.07, MT.steel, ij.x, ij.y - 0.02, ij.z, null, { seg: 8 }); inj.push(ij);
    }
    c.rb(L * 0.92, 0.08, 0.09, 0.035, RUSTY, x, yH - 0.03, z + es * (w / 2 + 0.1));
    /* admissão em alumínio acima do escape */
    c.rb(L * 0.82, 0.07, 0.08, 0.025, ALU, x, yH + hh * 0.55, z + es * (w / 2 + 0.02));
    /* bomba injetora com as linhas de alta pressão até cada injetor */
    var px = x + d * L * 0.12, py = yB + bh * 0.05, pz = z - es * (w / 2 + 0.09);
    c.rb(L * 0.4, bh * 0.6, 0.13, 0.025, CM("#5b6064", { metalness: 0.5, roughness: 0.4 }), px, py, pz);
    c.rb(L * 0.36, 0.03, 0.1, 0.01, MT.dark, px, py + bh * 0.31, pz);
    inj.forEach(function (ij, k) {
      var sx = px - L * 0.15 + k * L * 0.3 / Math.max(1, n - 1);
      c.tube([[sx, py + bh * 0.32, pz], [sx + (ij.x - sx) * 0.5, top - 0.02, pz + es * 0.03], [ij.x, ij.y + 0.02, ij.z]], 0.006, MT.steel, { seg: 10, rs: 4 });
    });
    /* filtro de diesel (branco) e filtro de óleo (azul) */
    var fz = z - es * (w / 2 + 0.13);
    c.cyl(0.055, 0.055, 0.16, CM("#dcd8cc", { roughness: 0.5 }), x - d * L * 0.32, yH - 0.02, fz);
    c.cyl(0.07, 0.07, 0.03, MT.steel, x - d * L * 0.32, yH + 0.07, fz);
    c.cyl(0.05, 0.05, 0.14, CM("#2a5aa8", { roughness: 0.45 }), x - d * L * 0.05, yB - bh * 0.15, z + es * (w / 2 + 0.07), "z");
    /* vareta de óleo de alça amarela */
    c.rod(new V3(x + d * L * 0.05, yB, z - es * (w / 2 + 0.02)), new V3(x + d * L * 0.05, top + 0.05, z - es * (w / 2 + 0.03)), 0.006, MT.steel);
    c.add(new THREE.TorusGeometry(0.022, 0.007, 6, 14), MT.yellow, x + d * L * 0.05, top + 0.07, z - es * (w / 2 + 0.03));
    /* frente: tampa da distribuição, polias, alternador e correia */
    var fx = x + d * (L / 2 + 0.02), px2 = fx + d * 0.035;
    c.rb(0.04, bh + hh, w * 0.86, 0.03, em, fx, yB + hh / 2, z);
    var crank = new V3(px2, y0 + ph + 0.07, z), fan = new V3(px2, yH - 0.02, z), alt = new V3(px2, yB + bh * 0.3, z - es * (w / 2 + 0.06));
    c.cyl(0.085, 0.085, 0.04, MT.steel, crank.x, crank.y, crank.z, "x");
    c.cyl(0.07, 0.07, 0.04, MT.steel, fan.x, fan.y, fan.z, "x");
    c.cyl(0.035, 0.035, 0.045, MT.steel, alt.x, alt.y, alt.z, "x");
    c.cyl(0.075, 0.075, 0.17, CM("#9aa0a4", { metalness: 0.55, roughness: 0.35 }), alt.x - d * 0.12, alt.y, alt.z, "x");
    var bx = px2 + d * 0.005, bz = -es;
    c.tube([[bx, crank.y - 0.09, crank.z], [bx, crank.y, crank.z + bz * 0.09], [bx, alt.y - 0.03, alt.z + bz * 0.035], [bx, alt.y + 0.035, alt.z], [bx, fan.y + 0.072, fan.z], [bx, fan.y, fan.z - bz * 0.075], [bx, crank.y, crank.z - bz * 0.09]], 0.011, MT.rubber, { closed: true, seg: 48, rs: 5 });
    if (o.fan !== false) {
      var fg = new THREE.Group(); fg.position.set(px2 + d * 0.07, fan.y, fan.z); fg.userData.rigid = true; c.g.add(fg);
      var fr = o.fanR || Math.min(0.2, h * 0.4);
      for (var b = 0; b < 6; b++) { var bl = c.rb(0.012, fr * 0.85, 0.08, 0.006, MT.plastic, 0, Math.cos(b / 6 * PI * 2) * fr * 0.45, Math.sin(b / 6 * PI * 2) * fr * 0.45, { parent: fg }); bl.rotation.x = -b / 6 * PI * 2; bl.rotation.y = 0.35; }
      c.cyl(fr * 0.18, fr * 0.18, 0.05, MT.steel, 0, 0, 0, "x", { parent: fg });
    }
    /* volante do motor atrás */
    c.cyl(h * 0.38, h * 0.38, 0.08, dk, x - d * (L / 2 + 0.04), yB, z, "x", { seg: 24 });
    return { top: top, motor: new V3(x, yB, z), exh: new V3(x - d * L * 0.46, yH - 0.03, z + es * (w / 2 + 0.1)), front: fx, fan: fan };
  }

  /* vão do motor dos pesados. o: { x0, x1, zw, floor, top, eng (opções do dieselEngine), rad: { x, y, h, w, z, side } | false, walls, light: [x, y, z, dist], res: [x, y, z] } */
  function heavyBay(c, o) {
    if (o.walls) {
      c.rb(o.x1 - o.x0, 0.03, 2 * o.zw, 0.01, MT.bay, (o.x0 + o.x1) / 2, o.floor, 0);
      [1, -1].forEach(function (s) { c.rb(o.x1 - o.x0, (o.top - o.floor) * 0.7, 0.03, 0.01, MT.bay, (o.x0 + o.x1) / 2, o.floor + (o.top - o.floor) * 0.35, s * o.zw); });
    }
    var e = dieselEngine(c, o.eng), radPos = null, rad = null;
    if (o.rad) {
      var R = o.rad, side = !!R.side, rz = R.z || 0;
      rad = side ? c.rb(R.w, R.h, 0.06, 0.012, MT.radiator, R.x, R.y, rz) : c.rb(0.06, R.h, R.w, 0.012, MT.radiator, R.x, R.y, rz);
      for (var f = 0; f < 6; f++) { var fy = R.y - R.h / 2 + (f + 0.5) * R.h / 6; if (side) c.rb(R.w * 0.96, 0.006, 0.066, 0.002, MT.steel, R.x, fy, rz); else c.rb(0.066, 0.006, R.w * 0.96, 0.002, MT.steel, R.x, fy, rz); }
      if (side) c.rb(R.w, 0.05, 0.08, 0.015, MT.plastic, R.x, R.y + R.h / 2 + 0.02, rz); else c.rb(0.08, 0.05, R.w, 0.015, MT.plastic, R.x, R.y + R.h / 2 + 0.02, rz);
      radPos = new V3(R.x, R.y, rz);
      /* mangueiras superior e inferior até o motor */
      var hz = side ? rz - Math.sign(rz) * 0.05 : rz, hx = side ? R.x : R.x - Math.sign(R.x - e.motor.x) * 0.05;
      c.tube([[hx, R.y + R.h * 0.38, hz + (side ? 0 : R.w * 0.3)], [(hx + e.front) / 2, e.top - 0.06, (hz + e.fan.z) / 2], [e.front, e.top - 0.12, e.fan.z]], 0.026, MT.hose, { seg: 16, rs: 6 });
      c.tube([[hx, R.y - R.h * 0.38, hz - (side ? 0 : R.w * 0.3)], [(hx + e.front) / 2, R.y - R.h * 0.45, (hz + e.fan.z) / 2], [e.front, e.motor.y - 0.05, e.fan.z]], 0.026, MT.hose, { seg: 16, rs: 6 });
    }
    /* reservatórios: arrefecimento rosa e limpador com tampa azul */
    if (o.res) {
      var rp = o.res;
      c.rb(0.16, 0.14, 0.12, 0.02, MT.coolant, rp[0], rp[1], rp[2]).castShadow = false;
      c.rb(0.13, 0.08, 0.1, 0.015, MT.coolantLiq, rp[0], rp[1] - 0.025, rp[2]);
      c.cyl(0.026, 0.026, 0.025, MT.postBlack, rp[0], rp[1] + 0.082, rp[2]);
      if (o.res2) { var r2 = o.res2; c.rb(0.12, 0.13, 0.1, 0.02, MT.washer, r2[0], r2[1], r2[2]).castShadow = false; c.rb(0.1, 0.07, 0.08, 0.015, CM("#3f8fc0", { roughness: 0.3 }), r2[0], r2[1] - 0.025, r2[2]); c.cyl(0.026, 0.026, 0.025, MT.capBlue, r2[0], r2[1] + 0.077, r2[2]); }
    }
    if (o.light) bayLight(c, o.light[0], o.light[1], o.light[2], o.light[3], o.light[4]);
    c.part("motor", "Motor", null, e.motor, 1.0);
    if (rad) c.part("radiador", "Radiador", rad, radPos, 0.9);
    c.meta.bay = { x0: o.x0, x1: o.x1, zw: o.zw, floor: o.floor, top: o.top, motor: "diesel", center: new V3((o.x0 + o.x1) / 2, (o.floor + o.top) / 2, 0) };
    return e;
  }

  /* limita a profundidade do amassado numa região (frente plana de cabine): o núcleo aceita até 18% da largura,
     o que numa chapa plana vira cratera. A peça "lataria" é rearmada a cada batida e suaviza o deslocamento acima do joelho. */
  function dentCap(c, objs, cap, label, pos, reach) {
    var set = new Set(objs), knee = cap * 0.6, v = new V3(), dv = new V3();
    function soft(l) { return l <= knee ? l : knee + (cap - knee) * Math.tanh((l - knee) / (cap - knee)); }
    function limit() {
      c.deform.forEach(function (msh) {
        if (!set.has(msh)) return;
        var g = msh.geometry, p0 = g.userData.p0; if (!p0) return;
        var pos = g.attributes.position, ch = false;
        for (var i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i); dv.set(v.x - p0[3 * i], v.y - p0[3 * i + 1], v.z - p0[3 * i + 2]);
          var l = dv.length(); if (l <= knee) continue;
          dv.setLength(soft(l)); pos.setXYZ(i, p0[3 * i] + dv.x, p0[3 * i + 1] + dv.y, p0[3 * i + 2] + dv.z); ch = true;
        }
        if (ch) { pos.needsUpdate = true; if (g.userData.crease) ZG.geo.crease(g, 42); else g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); }
      });
      objs.forEach(function (o) {
        if (c.deform.indexOf(o) >= 0 || !o.userData.pos0 || o.parent !== c.g) return;
        dv.subVectors(o.position, o.userData.pos0); var l = dv.length(); if (l > knee) o.position.copy(o.userData.pos0).add(dv.setLength(soft(l)));
      });
    }
    c.part("lataria", label, null, pos, reach, { onHit: function (c2, pt) {
      limit(); pt.done = false;
      /* o núcleo põe a peça no relatório depois desta chamada: tira a entrada anterior para não repetir */
      for (var i = c2.log.length - 1; i >= 0; i--) if (c2.log[i] === pt) c2.log.splice(i, 1);
    } });
  }
  /* a traseira de ZG.shell fica alguns centímetros atrás do último ponto do perfil (cantos arredondados e subdivisão):
     placas e textos planos que o carDetails põe atrás ficariam escondidos dentro da casca; empurra para fora */
  function rearOut(c, n0, rr, gap) {
    c.g.children.slice(n0).forEach(function (o) { if (o.isMesh && o.geometry.type === "PlaneGeometry" && o.position.x < rr + 0.06) o.position.x = Math.min(o.position.x, rr - gap); });
  }
  /* esconde a malha quando o veículo está capotado (antenas finas quebram e não atravessam o chão) */
  function hideWhenFlipped(c, msh) {
    msh.updateMatrix = function () { THREE.Object3D.prototype.updateMatrix.call(this); this.visible = !c.flipped; };
  }

  /* ================= cabine basculante ================= */
  /* objs: malhas da cabine (filhos diretos de c.g). A cabine gira em volta de um eixo transversal na frente, embaixo.
     Em vez de mudar o pai das malhas (o que tiraria delas o acompanhamento rígido do amassado), cada uma recebe a
     inclinação na própria matriz: o amassado e o raio de clique continuam valendo. */
  function tiltCab(c, objs, pivot, o) {
    o = o || {};
    var h = ZG.hinge(c, [], pivot, { len: -(o.len || 1.8), open: o.open || 0.9, sign: -1, zw: 0.7, label: "Cabine basculante" });
    var piv = h.piv, A = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z), B = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    var R = new THREE.Matrix4(), M = new THREE.Matrix4(), last = 0;
    function tm() { var a = piv.rotation.z; if (Math.abs(a) < 1e-5) return null; if (a !== last) { R.makeRotationZ(a); M.copy(A).multiply(R).multiply(B); last = a; } return M; }
    objs.forEach(function (ob) {
      if (ob === piv) return;
      ob.updateMatrix = function () { this.matrix.compose(this.position, this.quaternion, this.scale); var t = tm(); if (t) this.matrix.premultiply(t); this.matrixWorldNeedsUpdate = true; };
    });
    c.parts.forEach(function (p) { if (p.kind === "capo" && p.obj === piv) { p.onHit = function () {}; p.pos = new V3(pivot.x - 0.8, pivot.y + 1.0, 0); } });
    motorNoLatch(c);
    /* enquadramento da câmera do app (usa meta.bay): mais longe e um pouco acima, para a cabine inclinada não tapar o motor */
    var b = c.meta.bay; if (b) { b.zw = Math.max(b.zw, o.camSpan || 1.1); b.center.y += 0.25; b.center.x -= 0.3; b.view = { theta: 1.95, phi: 0.78, dist: 5.6 }; }
    return h;
  }

  /* ================= cabine avançada ================= */
  /* o: { model: delivery|constellation|atego, f (frente), W, len, roof, belt, bot (base da cabine), floor, ax (eixo dianteiro), wr, ww, col, int, glass, sideCol } */
  function cabOver(c, o) {
    var f = o.f, W = o.W, len = o.len, ry = o.roof, belt = o.belt, bot = o.bot, fl = o.floor, md = o.model, col = o.col, paint = c.paint(col);
    var m = c.meta; m.col = col; m.kind = "truck";
    var dl = md === "delivery", cs = md === "constellation";
    var ws0 = [f + 0.02, belt - 0.03], ws1 = [f - (dl ? 0.24 : cs ? 0.12 : 0.15), ry - (dl ? 0.24 : 0.2)];
    var rr = dl ? 0.34 : cs ? 0.16 : 0.22;
    var items = [[f - len, bot, 0.06], [f - len - 0.01, ry - 0.08, 0.16], [ws1[0] - 0.32, ry, rr], [ws1[0], ws1[1], 0.1], [ws0[0], ws0[1], 0.1], [f + 0.04, bot + 0.3, 0.1], [f, bot, 0.05]];
    var T = { belt: belt, top: ry + 0.03, k: dl ? 0.07 : 0.045 };
    function wsx(y) { return ws0[0] + (ws1[0] - ws0[0]) * (y - ws0[1]) / (ws1[1] - ws0[1]); }
    var q = ZG.quadDef(lerp2(ws0, ws1, 0.05), lerp2(ws0, ws1, 0.93), W, T, "front", 0.05, { inset: 0.04, side: 0.11 });
    var yb = belt + 0.06, ty = ry - 0.27, xr = f - len * (dl ? 0.66 : 0.62), dip = dl ? 0.2 : md === "atego" ? 0.12 : 0.02;
    var poly = [[xr, yb], [wsx(yb - dip) - 0.2, yb - dip], [wsx(ty) - 0.2, ty], [xr, ty]];
    ZG.shell(c, { items: items, bottomY: bot, arches: [[o.ax, o.wr, o.wr + 0.08]], W: W, col: col, T: T, holes: [ZG.holeSide(poly), ZG.holeQuad(q)], archInner: W / 2 - o.ww - 0.16 });
    var gmat = o.glass || null;
    ZG.glassQuad(c, q, o.glassLabel || "Para-brisa", gmat ? { mat: gmat } : {});
    ZG.sideWindows(c, [poly], W, T, function () { return "Janela da porta"; }, gmat ? { mat: gmat, type: o.glassType || "temperado" } : {});
    Object.assign(m, { W: W, front: f + 0.1, clear: bot, belt: belt, top: ry + 0.03, bodyH: belt - bot, T: T, quadF: q, gh: { fb: f, belt: belt + 0.03, Wg: W }, cabRear: f - len });
    /* interior */
    var zi = W / 2 - 0.13, fab = CM(o.int || "#3a3b3d", { roughness: 0.88 }), trim = CM(o.trim || "#222326", { roughness: 0.7 }), xd = wsx(belt);
    c.rb(len - 0.28, 0.04, zi * 2, 0.015, MT.carpet, f - len / 2 - 0.04, fl, 0);
    c.rb(0.62, 0.22, 0.5, 0.09, trim, f - len * 0.5, fl + 0.1, 0);
    ZG.dashboard(c, { x: xd - 0.07, y: belt + 0.02, w: zi * 2, d: 0.48, h: Math.min(0.55, belt - fl - 0.08), drv: -zi * 0.52, mat: trim, top: fab });
    ZG.steeringWheel(c, xd - 0.66, belt + 0.06, -zi * 0.52, { r: 0.22, tilt: 1.12, col: 0.5, mat: trim });
    var sx = Math.max(f - len + 0.62, xd - 1.08);
    ZG.seat(c, sx, fl, -zi * 0.52, { w: 0.5, mat: fab, h: 0.44, back: 0.64, lean: 0.18 });
    ZG.seat(c, sx, fl, zi * 0.42, { w: zi * 0.98, n: 2, mat: fab, h: 0.44, back: 0.6, lean: 0.18 });
    c.rod(new V3(sx + 0.55, fl, -0.05), new V3(sx + 0.5, fl + 0.48, -0.08), 0.014, MT.chrome); c.sph(0.035, MT.plastic, sx + 0.5, fl + 0.5, -0.08);
    c.rb(0.03, ry - fl - 0.12, zi * 2, 0.01, trim, f - len + 0.07, (ry + fl) / 2, 0);
    c.rb(len - 0.45, 0.02, zi * 1.8, 0.01, MT.headliner, f - len / 2 - 0.05, ry - 0.07, 0).castShadow = false;
    [1, -1].forEach(function (s) {
      c.rb(len * 0.55, belt - fl - 0.06, 0.03, 0.012, trim, f - len * 0.42, (belt + fl) / 2, s * (zi + 0.03));
      c.rb(0.03, 0.12, 0.3, 0.01, MT.headliner, xd - 0.42, ry - 0.2, s * zi * 0.5, { rot: [0, 0, 0.4] });
    });
    /* portas, maçanetas, degraus, pisca lateral */
    var stepX = o.ax - o.wr - 0.24;
    [1, -1].forEach(function (s) {
      var zs = s * (W / 2 + 0.003);
      c.rb(0.012, belt - bot + 0.55, 0.006, 0.003, MT.dark, xr - 0.06, (belt + bot) / 2 + 0.3, zs);
      c.rb(0.012, belt - bot + 0.35, 0.006, 0.003, MT.dark, f - 0.1, (belt + bot) / 2 + 0.15, zs);
      c.rb(0.16, 0.045, 0.03, 0.012, dl ? MT.trim : MT.chrome, xr + 0.2, belt - 0.12, s * (W / 2 + 0.012));
      c.rb(0.1, 0.05, 0.02, 0.01, MT.amber, f - 0.18, bot + 0.55, s * (W / 2 + 0.006));
      [bot - 0.02, bot + 0.3].forEach(function (y, i) { c.rb(0.42, 0.04, 0.22, 0.01, MT.steel, stepX, y, s * (W / 2 - 0.1 - i * 0.05)); });
      c.rod(new V3(xr - 0.02, belt - 0.3, s * (W / 2 + 0.04)), new V3(xr - 0.02, belt + 0.45, s * (W / 2 + 0.04)), 0.016, MT.trim);
      /* retrovisores: principal e grande-angular */
      var mx = f - 0.2, mz = s * (W / 2 + 0.3);
      c.tube([[mx - 0.05, belt + 0.55, s * (W / 2 - 0.02)], [mx + 0.1, belt + 0.66, s * (W / 2 + 0.16)], [mx + 0.13, belt + 0.5, mz]], 0.018, MT.trim, { seg: 16, rs: 6 });
      c.rb(0.07, 0.44, 0.2, 0.03, MT.trim, mx + 0.13, belt + 0.3, mz);
      c.rb(0.01, 0.4, 0.17, 0.008, MT.chrome, mx + 0.093, belt + 0.3, mz);
      c.rb(0.07, 0.17, 0.19, 0.03, MT.trim, mx + 0.13, belt - 0.03, mz);
      c.rod(new V3(mx + 0.13, belt + 0.07, mz), new V3(mx + 0.13, belt + 0.08, mz), 0.012, MT.trim);
    });
    /* limpadores */
    [-0.38, 0.38].forEach(function (z) { var y0 = belt + 0.05; c.rod(new V3(wsx(y0) + 0.06, y0, z - 0.25), new V3(wsx(y0 + 0.5) + 0.06, y0 + 0.5, z + 0.05), 0.011, MT.trim); });
    /* frente por modelo */
    var fx = function (y) { return ZG.profX(items, y, true); };
    if (dl) {
      /* faixa preta larga que une faróis e grade (a casca abaúla ~6 cm à frente do perfil na frente da cabine) */
      c.rb(0.03, 0.34, W * 0.9, 0.03, PLAST, fx(1.16) + 0.055, 1.16, 0);
      ZG.grille(c, { style: "bars", x: fx(1.16) + 0.075, y: 1.16, w: 0.92, h: 0.28, col: col, emblem: false });
      /* friso cromado no alto da grade, de farol a farol, com o emblema redondo no meio da faixa preta */
      c.rb(0.03, 0.035, 0.96, 0.012, CHR, fx(1.3) + 0.08, 1.3, 0);
      ZG.emblem(c, fx(1.2) + 0.1, 1.2, 0, 0.1);
      [1, -1].forEach(function (s) { c.rb(0.04, 0.27, 0.52, 0.05, CHR, fx(1.16) + 0.035, 1.16, s * (W / 2 - 0.28), { rot: [0, -s * 0.28, 0] }); ZG.headlight(c, { style: "wedge", x: fx(1.16) + 0.05, y: 1.16, z: s * (W / 2 - 0.28), w: 0.46, h: 0.21, d: 0.1, side: s, yaw: 0.28 }); });
    } else if (cs) {
      c.rb(0.04, 0.12, W * 0.88, 0.03, PLAST, fx(belt - 0.12) + 0.01, belt - 0.12, 0);
      ZG.grille(c, { style: "truck", x: fx(1.5) + 0.02, y: 1.5, w: 1.6, h: 0.56, col: col, emblem: false });
      ZG.emblem(c, fx(1.5) + 0.09, 1.5, 0, 0.12);
      [1, -1].forEach(function (s) { c.rb(0.04, 0.62, 0.3, 0.04, PLAST, fx(1.5) + 0.045, 1.5, s * (W / 2 - 0.2)); for (var k = 0; k < 4; k++) c.rb(0.02, 0.025, 0.24, 0.008, MT.trim, fx(1.5) + 0.07, 1.3 + k * 0.13, s * (W / 2 - 0.2)); });
      /* quebra-sol externo com luzes de gabarito */
      c.rb(0.42, 0.06, W * 0.94, 0.03, paint, ws1[0] + 0.08, ry - 0.02, 0, { rot: [0, 0, -0.18] });
      for (var k2 = -2; k2 <= 2; k2++) c.rb(0.05, 0.035, 0.08, 0.012, MT.amber, ws1[0] + 0.28, ry - 0.07, k2 * 0.3);
      c.cyl(0.035, 0.06, 0.4, MT.chrome, f - len * 0.5, ry + 0.07, -0.5, "x"); c.cyl(0.035, 0.06, 0.32, MT.chrome, f - len * 0.5, ry + 0.07, -0.62, "x");
    } else {
      /* grade preta saliente (a casca abaúla ~2 cm à frente do perfil), três frisos cromados e estrela genérica grande */
      c.rb(0.04, 0.56, 1.38, 0.04, PLAST, fx(1.42) + 0.05, 1.42, 0);
      for (var sl = 0; sl < 3; sl++) c.rb(0.03, 0.06, 1.28, 0.025, CHR, fx(1.42) + 0.08, 1.27 + sl * 0.15, 0);
      ZG.emblem(c, fx(1.42) + 0.1, 1.42, 0, 0.14);
      c.rb(0.04, 0.1, W * 0.8, 0.03, PLAST, fx(belt - 0.1) + 0.01, belt - 0.1, 0);
    }
    return { items: items, q: q, wsx: wsx, xr: xr, T: T, fx: fx };
  }

  /* para-choque dianteiro, faróis baixos e rodas dianteiras (não basculam) */
  function cabFront(c, o, cab) {
    var f = o.f, W = o.W, md = o.model, by = o.bumperY, bh = o.bumperH, bx = f + 0.1;
    var m = c.meta;
    m.bumperF = c.rb(0.26, bh, W + 0.04, 0.07, md === "constellation" ? CM("#8c9093", { metalness: 0.45, roughness: 0.45 }) : BUMPER_D, bx, by, 0, { def: true });
    c.part("parachoque", "Para-choque dianteiro", m.bumperF, new V3(bx + 0.1, by, 0), 1.1);
    if (md === "delivery") {
      [1, -1].forEach(function (s) { ZG.headlight(c, { style: "round", x: bx + 0.12, y: by - 0.03, z: s * (W / 2 - 0.28), w: 0.11, h: 0.11, d: 0.05, side: s, noPart: true }); });
      c.rb(0.3, 0.035, 0.6, 0.01, MT.steel, bx + 0.02, by + bh / 2 + 0.005, 0);
    } else {
      [1, -1].forEach(function (s) {
        ZG.headlight(c, { style: md === "constellation" ? "truck" : "rect", x: bx + 0.11, y: by + 0.02, z: s * (W / 2 - 0.33), w: 0.42, h: 0.2, d: 0.08, side: s, yaw: md === "atego" ? 0.12 : 0 });
        ZG.headlight(c, { style: "round", x: bx + 0.12, y: by - bh * 0.32, z: s * (W / 2 - 0.68), w: 0.1, h: 0.1, d: 0.05, side: s, noPart: true });
        c.rb(0.03, 0.12, 0.42, 0.02, MT.dark, bx + 0.125, by - bh * 0.3, s * 0.35);
      });
    }
    c.rb(0.06, 0.06, 0.12, 0.02, MT.steel, bx + 0.13, by - bh * 0.35, 0);
    c.plate(bx + 0.135, by + (md === "delivery" ? -0.02 : -bh * 0.05), 0, "+x");
    [1, -1].forEach(function (s) { truckWheel(c, o.ax, s * (W / 2 - o.ww / 2 - 0.05), o.wr, o.ww, { label: "Pneu dianteiro " + (s > 0 ? "direito" : "esquerdo") }); });
  }

  /* ================= chassi ================= */
  /* o: { f, rear, W, railY, axles:[x..], wr, ww, tankX, tankSide (-1 esquerda), guards: [x0, x1] , bar: true, mud: true, lightsY } */
  function chassis(c, o) {
    var f = o.f, rear = o.rear, W = o.W, ry = o.railY, wr = o.wr, ww = o.ww, m = c.meta;
    [0.43, -0.43].forEach(function (z) { c.rb(f - rear - 0.1, 0.24, 0.09, 0.02, MT.trim, (f + rear) / 2, ry, z); });
    for (var x = rear + 0.3; x < f - 0.3; x += 1.3) c.rb(0.1, 0.18, 0.78, 0.02, MT.trim, x, ry, 0);
    o.axles.forEach(function (ax, i) {
      c.cyl(0.08, 0.08, W - 0.5, MT.trim, ax, wr, 0, "z");
      if (!o.tag || i === 0) c.sph(0.2, MT.trim, ax, wr, 0, 1, 1, 0.9);
      [1, -1].forEach(function (s) {
        var zo = s * (W / 2 - ww / 2 - 0.04), zi = zo - s * (ww + 0.03);
        truckWheel(c, ax, zo, wr, ww, { label: "Pneu traseiro " + (i + 1) + " " + (s > 0 ? "direito" : "esquerdo") });
        if (!(o.tag && i > 0 && o.single)) truckWheel(c, ax, zi, wr, ww - 0.02, { noPart: true, inner: true });
        c.rb(0.08, 0.32, 0.06, 0.02, MT.steel, ax, ry - 0.2, s * 0.43);
        c.rb(1.1, 0.06, 0.1, 0.02, MT.steel, ax, ry - 0.08, s * 0.43);
      });
    });
    /* para-lamas sobre o rodado traseiro */
    var axs = o.axles.slice().sort(function (a, b) { return a - b; }), a0 = axs[0] - wr - 0.12, a1 = axs[axs.length - 1] + wr + 0.12;
    [1, -1].forEach(function (s) {
      /* para-lama do rodado duplo: borda de fora rente à lateral (não passa da largura do veículo) */
      var zc = s * (W / 2 - ww - 0.05), fw = ww * 2 + 0.1;
      if (o.mud !== false) {
        c.rb(a1 - a0, 0.04, fw, 0.015, MT.trim, (a0 + a1) / 2, wr * 2 + 0.1, zc);
        [a0, a1].forEach(function (xx, j) { c.rb(0.04, wr * 0.9, fw, 0.015, MT.trim, xx, wr * 1.55 + 0.05, zc, { rot: [0, 0, (j ? -1 : 1) * 0.35] }); });
        c.rb(0.02, 0.5, fw - 0.06, 0.01, MT.rubber, a0 - 0.08, 0.42, zc);
      }
    });
    /* tanque de diesel, Arla 32 e baterias */
    var ts = o.tankSide || -1, tz = ts * (W / 2 - 0.36);
    var tank = c.rb(0.95, 0.52, 0.56, 0.18, ALU, o.tankX, ry - 0.2, tz, { def: true });
    c.cyl(0.06, 0.06, 0.04, MT.trim, o.tankX + 0.25, ry + 0.08, tz + ts * 0.1);
    [-0.3, 0.3].forEach(function (dx) { c.rb(0.05, 0.56, 0.6, 0.01, MT.trim, o.tankX + dx, ry - 0.2, tz); });
    c.part("tanque", "Tanque de diesel", tank, new V3(o.tankX, ry - 0.2, tz), 0.8);
    if (o.arla) { c.rb(0.32, 0.4, 0.4, 0.1, CM("#d8dadb", { roughness: 0.5 }), o.tankX - 0.75, ry - 0.2, tz); c.cyl(0.05, 0.05, 0.04, CM("#2a63c4"), o.tankX - 0.75, ry + 0.02, tz); }
    var bat = c.rb(0.6, 0.42, 0.42, 0.04, MT.trim, o.tankX, ry - 0.16, -tz);
    c.rb(0.62, 0.03, 0.44, 0.01, MT.steel, o.tankX, ry + 0.06, -tz);
    c.part("bateria", "Caixa de baterias", bat, new V3(o.tankX, ry - 0.16, -tz), 0.7);
    [1, -1].forEach(function (s) { c.cyl(0.12, 0.12, 0.6, MT.steel, o.tankX - 0.9, ry - 0.24, s * 0.62, "x"); });
    c.cyl(0.15, 0.15, 0.55, CM("#3b3d40", { metalness: 0.5 }), o.tankX + 0.05, ry - 0.3, 0, "x");
    c.tube([[o.tankX - 0.25, ry - 0.3, 0], [axs[0] + wr + 0.3, ry - 0.32, 0.25], [axs[0] + wr + 0.1, ry - 0.3, W / 2 - 0.2]], 0.04, CM("#3b3d40", { metalness: 0.5 }), { seg: 16, rs: 8 });
    /* protetores laterais (obrigatórios em caminhão) */
    if (o.guards) [1, -1].forEach(function (s) {
      [0.48, 0.78].forEach(function (y) { c.rb(o.guards[1] - o.guards[0], 0.08, 0.03, 0.01, CM("#9a9d9f", { metalness: 0.5 }), (o.guards[0] + o.guards[1]) / 2, y, s * (W / 2 - 0.04)); });
      for (var gx = o.guards[0] + 0.1; gx < o.guards[1]; gx += 1.0) c.rb(0.06, 0.4, 0.04, 0.01, MT.trim, gx, 0.63, s * (W / 2 - 0.07));
    });
    /* para-choque traseiro com faixa refletiva */
    if (o.bar !== false) {
      var bar = c.rb(0.14, 0.16, W - 0.12, 0.03, MT.trim, rear + 0.08, 0.52, 0, { def: true });
      for (var k = 0; k < 8; k++) c.rb(0.012, 0.1, (W - 0.2) / 8 - 0.01, 0.004, k % 2 ? REFL_W : REFL_R, rear + 0.008, 0.52, -(W - 0.2) / 2 + (k + 0.5) * (W - 0.2) / 8);
      [1, -1].forEach(function (s) { c.rb(0.06, 0.32, 0.06, 0.01, MT.trim, rear + 0.12, ry - 0.2, s * 0.43); });
      m.bumperR = bar; c.part("parachoque", "Para-choque traseiro", bar, new V3(rear, 0.52, 0), 1.0);
    }
    var ly = o.lightsY || ry - 0.05;
    [1, -1].forEach(function (s) {
      c.rb(0.06, 0.2, 0.62, 0.02, MT.trim, rear + 0.1, ly, s * (W / 2 - 0.4));
      ZG.taillight(c, { style: "vertical", x: rear + 0.05, y: ly, z: s * (W / 2 - 0.4), w: 0.5, h: 0.17, d: 0.06, side: s });
      c.rb(0.02, 0.45, ww * 2 + 0.05, 0.01, MT.rubber, rear + 0.32, 0.38, s * (W / 2 - ww - 0.02));
    });
    c.plate(rear + 0.02, ly - 0.28, 0, "-x");
    m.rear = rear; m.L = (m.front || f) - rear;
  }

  /* ================= baú ================= */
  /* o: { x0 (frente), x1 (traseira), y0, y1, W, col, armored, label } */
  function boxBody(c, o) {
    var x0 = o.x0, x1 = o.x1, y0 = o.y0, y1 = o.y1, W = o.W, L = x0 - x1, H = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var body = c.rb(L, H, W, o.armored ? 0.1 : 0.05, c.paint(o.col), cx, cy, 0, { def: true, sub: 0.3 });
    /* frisos de alumínio: metal baixo e cor clara, porque a cena não tem mapa de ambiente e metal puro sai preto */
    var rib = o.armored ? CM("#4a535a", { metalness: 0.35, roughness: 0.5 }) : CM("#c4c7c3", { metalness: 0.25, roughness: 0.42 });
    var doorM = o.armored ? c.paint(o.col) : CM("#d9dbd6", { metalness: 0.15, roughness: 0.45 });
    /* subchassi */
    c.rb(L - 0.1, 0.12, 0.2, 0.02, MT.trim, cx, y0 - 0.07, 0.43); c.rb(L - 0.1, 0.12, 0.2, 0.02, MT.trim, cx, y0 - 0.07, -0.43);
    for (var xs = x1 + 0.2; xs < x0; xs += 0.6) c.rb(0.08, 0.1, W - 0.1, 0.02, MT.trim, xs, y0 - 0.05, 0);
    [1, -1].forEach(function (s) {
      var zs = s * (W / 2 + 0.012);
      if (!o.armored) for (var x = x1 + 0.35; x < x0 - 0.2; x += 0.6) c.rb(0.055, H - 0.12, 0.025, 0.01, rib, x, cy, zs);
      c.rb(L + 0.02, 0.09, 0.04, 0.015, rib, cx, y0 + 0.04, s * (W / 2 + 0.018));
      c.rb(L + 0.02, 0.07, 0.04, 0.015, rib, cx, y1 - 0.035, s * (W / 2 + 0.018));
      [x0 - 0.15, cx, x1 + 0.2].forEach(function (xx) { c.rb(0.07, 0.06, 0.02, 0.01, MT.amber, xx, y0 + 0.16, s * (W / 2 + 0.03)); });
      [x0 - 0.1, x1 + 0.1].forEach(function (xx) { c.rb(0.06, 0.05, 0.02, 0.01, xx > cx ? MT.amber : MT.tail, xx, y1 - 0.12, s * (W / 2 + 0.03)); });
    });
    /* traseira: duas folhas, barras de travamento, dobradiças */
    var rx = x1 - 0.01;
    if (o.armored) {
      /* cofre: porta blindada única (dobradiças à esquerda, trava e visor ficam com o construtor), com fresta escura em volta */
      var dzc = -0.05, dw = 1.8, dh = H - 0.36, dy = cy - 0.06;
      c.rb(0.035, dh, dw, 0.03, doorM, rx - 0.012, dy, dzc);
      [[0, dh / 2 + 0.012, dw + 0.04, 0.018], [0, -dh / 2 - 0.012, dw + 0.04, 0.018]].forEach(function (e) { c.rb(0.02, e[3], e[2], 0.004, MT.dark, rx - 0.003, dy + e[1], dzc); });
      [1, -1].forEach(function (s) { c.rb(0.02, dh + 0.04, 0.018, 0.004, MT.dark, rx - 0.003, dy, dzc + s * (dw / 2 + 0.012)); });
      for (var rv = 0; rv < 6; rv++) [1, -1].forEach(function (s) { c.sph(0.016, MT.steel, rx - 0.03, dy - dh / 2 + 0.12 + rv * (dh - 0.24) / 5, dzc + s * (dw / 2 - 0.07)); });
      var m0 = c.meta; m0.roof = { x0: x1 + 0.25, x1: x0 - 0.25, w: W - 0.4, y: y1 }; m0.top = y1; m0.bodyH = Math.max(m0.bodyH || 0, H * 0.8);
      c.part("carga", o.label || "Baú de carga", body, new V3(cx, cy, 0), 1.8);
      return body;
    }
    c.rb(0.03, H - 0.1, W - 0.08, 0.02, doorM, rx - 0.005, cy, 0);
    c.rb(0.04, H - 0.14, 0.01, 0.004, MT.dark, rx - 0.02, cy, 0);
    [-0.82, -0.35, 0.35, 0.82].forEach(function (z) {
      c.rod(new V3(rx - 0.05, y0 + 0.06, z * W / 2.4), new V3(rx - 0.05, y1 - 0.06, z * W / 2.4), 0.022, MT.steel);
      c.rb(0.05, 0.06, 0.13, 0.01, MT.steel, rx - 0.07, cy - 0.15, z * W / 2.4 + 0.06);
    });
    [1, -1].forEach(function (s) { [0.18, 0.5, 0.82].forEach(function (t) { c.rb(0.04, 0.1, 0.16, 0.01, MT.steel, rx - 0.03, y0 + H * t, s * (W / 2 - 0.08)); }); });
    c.rb(0.06, 0.1, W - 0.1, 0.02, rib, rx - 0.02, y1 - 0.05, 0);
    [1, -1].forEach(function (s) { c.rb(0.03, 0.05, 0.08, 0.01, MT.tail, rx - 0.02, y1 - 0.06, s * 0.35); });
    var m = c.meta; m.roof = { x0: x1 + 0.25, x1: x0 - 0.25, w: W - 0.4, y: y1 }; m.top = y1; m.bodyH = Math.max(m.bodyH || 0, H * 0.8);
    c.part("carga", o.label || "Baú de carga", body, new V3(cx, cy, 0), 1.8);
    return body;
  }

  /* compartimento do motor espelhado (motor traseiro): constrói com engineBay e gira 180° em torno de um eixo vertical em xm */
  function mirrorBay(c, o, xm) {
    var n0 = c.g.children.length, np = c.parts.length;
    ZG.engineBay(c, o);
    var q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), PI);
    c.g.children.slice(n0).forEach(function (ob) { ob.position.x = 2 * xm - ob.position.x; ob.position.z = -ob.position.z; ob.quaternion.premultiply(q); });
    c.parts.slice(np).forEach(function (p) { p.pos.x = 2 * xm - p.pos.x; p.pos.z = -p.pos.z; });
    var b = c.meta.bay; if (b) { var a = 2 * xm - b.x1, z = 2 * xm - b.x0; b.x0 = a; b.x1 = z; b.center.x = 2 * xm - b.center.x; }
  }

  /* ================================================================ */
  /* Delivéri 11.180 Baú (Volkswagen Delivery 11.180, geração 2017+)
     Referência (ficha VW 11.180 cabine-chassi e baú típico de 5,5 m; web + memória):
       comprimento 7,60 m (entre-eixos 4,30; balanço dianteiro 1,19; traseiro 2,10) · largura da cabine 2,20 m, do baú 2,42 m
       altura da cabine 2,45 m, do baú 3,38 m · bitola dianteira 1,88 m · pneu 215/75 R17,5 (Ø 0,77 m) · vão livre 0,22 m (eixo)
     Traços de assinatura:
       frente: faróis grandes em cunha nas quinas, subindo para fora, em moldura preta; grade preta de barras horizontais entre eles;
               emblema redondo no alto da frente; para-choque preto com faróis de neblina redondos e degrau central
       lateral: cabine curta e estreita, mais estreita no teto; janela da porta com o canto da frente rebaixado; degrau duplo
               atrás da roda; retrovisor em braço tubular com espelho grande-angular embaixo
       traseira: baú de alumínio com duas folhas, quatro barras de travamento e para-choque com faixa refletiva
       teto: cabine sem defletor, baú liso ultrapassando a cabine para cima */
  ZG.register({ k: "bau", grp: GRP, n: "Delivéri 11.180 Baú", insp: "Volkswagen Delivery 11.180", c: "Caminhão leve com baú", fuel: "diesel",
    d: "Cabine avançada estreita, faróis em cunha e baú de 5,5 m. Atravessa horda média sem parar e guarda suprimentos trancados. A cabine bascula para mostrar o diesel de 4 cilindros.",
    mass: 4300, r: 105, seats: "3", cap: "150 L", eff: "5,5 km/L", auto: "820 km", vmax: 110, skill: "Direção pesada 1", hood: true
  }, function (c) {
    var f = 3.6, W = 2.2, len = 1.72, ax = 2.65, wr = 0.385, ww = 0.22, col = "#e9eae6";
    var cabO = { model: "delivery", f: f, W: W, len: len, roof: 2.45, belt: 1.56, bot: 0.66, floor: 1.1, ax: ax, wr: wr, ww: ww, col: col, int: "#4a4c50", bumperY: 0.58, bumperH: 0.3 };
    c.meta.cabL = len + 0.15;
    var n0 = c.g.children.length, cab = cabOver(c, cabO), cabObjs = c.g.children.slice(n0);
    c.rb(0.03, 0.06, W * 0.6, 0.01, CM("#1f4fa3"), cab.fx(0.9) + 0.02, 0.92, 0);
    cabFront(c, cabO, cab);
    ZG.engineBay(c, { x0: f - len + 0.12, x1: f - 0.45, zw: 0.4, floor: 0.4, top: 1.06, motor: "diesel", col: "#3a3c3e" });
    tiltCab(c, cabObjs, new V3(f - 0.02, 0.9, 0), { len: len, open: 1.15 });
    chassis(c, { f: f - 0.1, rear: -3.75, W: 2.3, railY: 0.74, axles: [-1.65], wr: wr, ww: ww, tankX: 0.6, tankSide: -1, guards: [-1.1, 2.0], lightsY: 0.62 });
    var box = boxBody(c, { x0: f - len - 0.1, x1: -3.72, y0: 0.98, y1: 3.38, W: 2.42, col: "#f1f1ec" });
    [1, -1].forEach(function (s) {
      c.rb(4.6, 0.32, 0.01, 0.01, CM("#1f4fa3", { roughness: 0.5 }), -1.0, 1.35, s * 1.217);
      c.rb(4.6, 0.06, 0.01, 0.01, CM("#e0a21c", { roughness: 0.5 }), -1.0, 1.56, s * 1.217);
      c.text("ENTREGAS JÁ", 2.4, 0.42, -0.7, 2.4, s * 1.242, s > 0 ? "+z" : "-z", { fg: "#1f4fa3" });
    });
    var m = c.meta; m.front = f + 0.24; m.L = m.front - m.rear; m.top = 3.38; m.belt = 1.56; m.bodyH = 1.6; m.clear = 0.42;
    m.armor = armorPlus(function (c) {
      var r = c.meta.roof, y = r.y + 0.06;
      for (var x = r.x0; x <= r.x1; x += 0.6) [1, -1].forEach(function (s) { c.rod(new V3(x, y, s * 1.12), new V3(x, y + 0.7, s * 1.12), 0.02, ZG.STEELM); });
      [1, -1].forEach(function (s) { c.rod(new V3(r.x0, y + 0.7, s * 1.12), new V3(r.x1, y + 0.7, s * 1.12), 0.025, ZG.STEELM); });
      sandbags(c, -0.9, 0.9, y + 0.1, r.x1 - 0.2, "z");
      roofLamp(c, r.x1, y + 0.45, 0.6); roofLamp(c, r.x1, y + 0.45, -0.6);
      for (var k = 0; k < 9; k++) c.rod(new V3(-3.86, 0.6 + k * 0.32, 0.95), new V3(-3.86, 0.6 + k * 0.32, 0.55), 0.016, ZG.STEELM);
      [0.55, 0.95].forEach(function (z) { c.rod(new V3(-3.86, 0.6, z), new V3(-3.86, 3.5, z), 0.022, ZG.STEELM); });
    });
    void box;
  });

  /* Constelação 24.280 Tanque (Volkswagen Constellation 24.280 6x2, tanque de combustível)
     Referência (folheto VW Constellation 24.280, entre-eixos 4.800; web):
       comprimento 9,81 m (balanço dianteiro 1,51; entre-eixos 1º-2º 4,80, 1º-3º 6,02; balanço traseiro 2,27)
       largura 2,51 m sem retrovisores · altura da cabine 2,87 m · bitola 2,11 m (diant.) e 1,85 m (tras.)
       pneu 275/80 R22,5 (Ø 1,01 m) · vão livre ≈ 0,25 m · tanque de diesel 275 L · tanque de carga ≈ 20 m³
     Traços de assinatura:
       frente: grade preta alta e quase quadrada com barras horizontais e emblema redondo no centro; faróis retangulares
               duplos dentro do para-choque de aço cinza; quebra-sol externo com cinco luzes âmbar; para-brisa plano e alto
       lateral: cabine curta e alta, porta com janela de canto baixo, degraus atrás da roda, dois retrovisores grandes
       traseira: tanque elíptico com escada, placas de risco 33/1203 e para-choque com faixa refletiva
       teto: bocas de visita em linha com passarela e guarda-corpo; buzinas a ar no teto da cabine */
  ZG.register({ k: "tanque", grp: GRP, n: "Constelação 24.280 Tanque", insp: "Volkswagen Constellation 24.280", c: "Caminhão-tanque 6x2", fuel: "diesel",
    d: "Cabine alta com grade preta e tanque elíptico de 20 mil litros de gasolina. Um tiro no tanque e a rua explode. A cabine bascula para mostrar o diesel de 6 cilindros.",
    mass: 10800, r: 115, seats: "2", cap: "275 L (+20.000 L de carga)", eff: "2,9 km/L", auto: "790 km", vmax: 100, skill: "Direção pesada 2", hood: true
  }, function (c) {
    var f = 4.6, W = 2.5, len = 2.05, ax = 3.3, wr = 0.506, ww = 0.3, col = "#a3231b";
    c.meta.cabL = len + 0.15;
    var cabO = { model: "constellation", f: f, W: W, len: len, roof: 2.87, belt: 1.9, bot: 0.84, floor: 1.38, ax: ax, wr: wr, ww: ww, col: col, int: "#3b3632", bumperY: 0.96, bumperH: 0.44 };
    var n0 = c.g.children.length, cab = cabOver(c, cabO), cabObjs = c.g.children.slice(n0);
    cabFront(c, cabO, cab);
    ZG.engineBay(c, { x0: f - len + 0.1, x1: f - 0.45, zw: 0.42, floor: 0.5, top: 1.36, motor: "diesel", col: "#3a3c3e" });
    tiltCab(c, cabObjs, new V3(f - 0.02, 1.15, 0), { len: len, open: 1.15 });
    var rear = -5.0;
    chassis(c, { f: f - 0.1, rear: rear, W: W, railY: 0.98, axles: [ax - 4.8, ax - 6.024], tag: true, wr: wr, ww: ww, tankX: 1.35, tankSide: -1, arla: true, guards: [-0.85, 2.62], lightsY: 0.82 });
    /* tanque elíptico */
    var tx = -1.25, len2 = 6.2, ty = 2.08, sy = 0.82, sz = 1.16;
    function hz(y) { var d = (y - ty) / sy; return sz * Math.sqrt(Math.max(0, 1 - d * d)); }
    var TM = CM(ZG.paintCol("#c3c8cb", c.st), { metalness: 0.45, roughness: 0.3, emissive: new THREE.Color("#262a2d"), emissiveIntensity: 1 });
    var tk = c.add(new THREE.CylinderGeometry(1, 1, len2, 40, 26), TM, tx, ty, 0); tk.rotation.z = PI / 2; tk.scale.set(sy, 1, sz); c.deform.push(tk);
    [tx - len2 / 2, tx + len2 / 2].forEach(function (x, i) { var cap = c.sph(1, TM, x, ty, 0, 0.28, sy, sz, { ws: 32, hs: 18 }); if (!i) cap.rotation.y = PI; c.deform.push(cap); });
    [-2.5, -1.25, 0, 1.25, 2.5].forEach(function (dx) { var b = c.add(new THREE.TorusGeometry(1.0, 0.025, 8, 48), CM("#8d9294", { metalness: 0.6 }), tx + dx, ty, 0); b.rotation.y = PI / 2; b.scale.set(sz + 0.01, sy + 0.01, 1); });
    for (var sx = -1; sx <= 1; sx += 2) c.rb(len2 - 0.4, 0.2, 0.25, 0.04, MT.trim, tx, ty - sy - 0.02, sx * 0.43);
    /* bocas de visita, passarela e guarda-corpo rebatível */
    [-2.3, -1.15, 0, 1.15, 2.3].forEach(function (dx) { c.cyl(0.26, 0.28, 0.14, ALU, tx + dx, ty + sy + 0.02, 0); c.cyl(0.21, 0.21, 0.05, MT.chrome, tx + dx, ty + sy + 0.11, 0); c.cyl(0.05, 0.05, 0.08, MT.steel, tx + dx + 0.12, ty + sy + 0.16, 0.1); });
    c.rb(len2 - 0.3, 0.035, 0.42, 0.01, CM("#5d6164", { metalness: 0.55 }), tx, ty + sy + 0.06, 0.62);
    for (var x = tx - len2 / 2 + 0.2; x <= tx + len2 / 2 - 0.15; x += 0.62) [0.4, -0.4].forEach(function (z) { c.rod(new V3(x, ty + sy, z), new V3(x, ty + sy + 0.34, z * 1.05), 0.014, MT.steel); });
    [0.42, -0.42].forEach(function (z) { c.rod(new V3(tx - len2 / 2 + 0.2, ty + sy + 0.34, z * 1.05), new V3(tx + len2 / 2 - 0.15, ty + sy + 0.34, z * 1.05), 0.018, MT.steel); });
    /* escada traseira, armário de válvulas e porta-mangotes */
    var lx = tx - len2 / 2 - 0.36;
    [0.24, -0.24].forEach(function (z) { c.rod(new V3(lx, 0.95, z), new V3(lx + 0.12, ty + sy + 0.35, z), 0.022, MT.steel); });
    for (var y = 1.15; y < ty + sy; y += 0.3) c.rod(new V3(lx + 0.03 + (y - 0.95) * 0.04, y, -0.24), new V3(lx + 0.03 + (y - 0.95) * 0.04, y, 0.24), 0.013, MT.steel);
    c.rb(0.75, 0.55, 1.6, 0.04, ALU, -0.3, 0.95, 0);
    for (var v = 0; v < 4; v++) c.cyl(0.05, 0.05, 0.12, CM("#c9a227", { metalness: 0.4 }), -0.6 + v * 0.2, 0.62, 0.6);
    [1, -1].forEach(function (s) {
      c.cyl(0.12, 0.12, 2.3, ALU, 0.25, 1.36, s * 1.0, "x"); c.cyl(0.1, 0.1, 0.02, MT.dark, -0.91, 1.36, s * 1.0, "x");
      c.rb(0.42, 0.32, 0.012, 0.01, CM("#d9771c"), tx + 1.6, ty - 0.25, s * (hz(ty - 0.1) + 0.006));
      c.text("33", 0.36, 0.13, tx + 1.6, ty - 0.18, s * (hz(ty - 0.1) + 0.014), s > 0 ? "+z" : "-z", { fg: "#111", size: 0.85 });
      c.text("1203", 0.36, 0.13, tx + 1.6, ty - 0.32, s * (hz(ty - 0.1) + 0.014), s > 0 ? "+z" : "-z", { fg: "#111", size: 0.85 });
      var dia = c.rb(0.3, 0.3, 0.012, 0.01, CM("#c3271c"), tx + 2.15, ty - 0.25, s * (hz(ty - 0.05) + 0.006)); dia.rotation.z = PI / 4;
      c.text("3", 0.18, 0.18, tx + 2.15, ty - 0.27, s * (hz(ty - 0.05) + 0.014), s > 0 ? "+z" : "-z", { fg: "#fff", size: 0.9 });
      c.text("INFLAMÁVEL", 1.12, 0.3, tx - 0.625, ty + 0.12, s * (sz + 0.012), s > 0 ? "+z" : "-z", { fg: "#b3261e" });
      for (var k = 0; k < 11; k++) c.rb(0.25, 0.05, 0.01, 0.005, k % 2 ? REFL_W : REFL_R, tx - 2.8 + k * 0.55, ty - sy * 0.72, s * (hz(ty - sy * 0.62) + 0.006));
      c.rb(0.42, 0.42, 0.25, 0.04, CM("#b3261e"), 2.2, 1.0, s * (W / 2 - 0.15));
    });
    c.rb(0.012, 0.32, 0.42, 0.01, CM("#d9771c"), tx - len2 / 2 - 0.29, ty - 0.2, 0);
    c.text("33", 0.36, 0.13, tx - len2 / 2 - 0.3, ty - 0.13, 0, "-x", { fg: "#111", size: 0.85 }); c.text("1203", 0.36, 0.13, tx - len2 / 2 - 0.3, ty - 0.27, 0, "-x", { fg: "#111", size: 0.85 });
    var m = c.meta; m.roof = null; m.top = ty + sy + 0.4; m.bodyH = 1.3; m.clear = 0.5; m.front = f + 0.24; m.L = m.front - rear;
    c.part("tanque", "Tanque de carga (20.000 L)", tk, new V3(tx, ty, 0), 2.2, { onHit: function (c2, pt, force) {
      var pd = ZG.puddle(c2, "gasolina", new V3(tx, 1.0, 0), 1.8 + force); if (force >= 0.9) { ZG.igniteFuel(c2, pd); ZG.blastDamage(c2, force * 230); }
    } });
    m.bigBoom = true;
    m.armor = armorPlus(function (c) {
      /* posto móvel: grade sobre as válvulas, carretel de mangueira e farol de busca */
      for (var z = -1.0; z <= 1.01; z += 0.2) c.rod(new V3(-0.85, 1.28, z), new V3(0.05, 1.28, z), 0.014, ZG.STEELM);
      c.cyl(0.4, 0.4, 0.35, CM("#b3261e"), lx - 0.1, 1.45, 0.6, "z"); c.cyl(0.25, 0.25, 0.4, MT.rubber, lx - 0.1, 1.45, 0.6, "z");
      roofLamp(c, f - 0.3, 3.1, 0.5); roofLamp(c, f - 0.3, 3.1, -0.5); c.rb(0.5, 0.06, 1.3, 0.02, ZG.STEELM, f - 0.4, 2.98, 0);
    });
  });

  /* ON Escolar (Volksbus ORE 2 · Caminho da Escola)
     Referência (especificação técnica FNDE do ORE 2 e chassi VW 15.190 OD; web + memória):
       comprimento 9,30 m (limite 9,0 m + 5%) · largura 2,50 m (máx. 2,60) · altura 3,20 m (máx. 3,80)
       entre-eixos 4,60 m · balanço dianteiro 1,55 m (máx. 1,60) · traseiro 3,15 m (≤ 71% do entre-eixos)
       bitola 2,05 m · pneu 275/80 R22,5 (Ø 1,01 m), traseiro duplo · vão livre 0,25 m · 44 alunos ou 31 adultos sentados
     Traços de assinatura:
       frente: amarelo inteiro com letreiro preto "ESCOLAR" acima do para-brisa; para-brisa grande dividido ao meio;
               faróis redondos duplos nas quinas; grade de barras embaixo; tampa do motor dianteiro na frente
       lateral: porta de folha dupla logo atrás da roda dianteira (a até 25 cm da caixa de roda); faixa preta sob as janelas;
               janelas largas e altas com cantos retos; "ESCOLAR" na saia; motor dianteiro e balanço traseiro longo
       traseira: vidro de saída de emergência alto, "ESCOLAR" grande, lanternas redondas duplas e para-choque preto
       teto: duas escotilhas de emergência; retrovisores em braço curvo saindo do teto */
  ZG.register({ k: "onibus", grp: GRP, n: "ON Escolar", insp: "Volksbus ORE 2 (Caminho da Escola)", c: "Ônibus escolar rural", fuel: "diesel",
    d: "O ônibus amarelo das escolas do interior: alto, robusto e com motor dianteiro. Porta dupla atrás da roda, 44 alunos sentados e nenhuma discrição. A tampa da frente abre para o motor.",
    mass: 9200, r: 100, seats: "44 alunos (ou 31 adultos) + motorista", cap: "210 L", eff: "3,8 km/L", auto: "800 km", vmax: 90, skill: "Direção pesada 1", hood: true
  }, function (c) {
    var W = 2.5, f = 4.5, rr = -4.5, L = f - rr, T = { belt: 1.45, top: 3.18, k: 0.035 }, col = "#e3b11f";
    var ax1 = 3.1, ax2 = ax1 - 4.6, wr = 0.506, ar = 0.62;
    var items = [[rr, 0.5, 0.1], [rr - 0.03, 2.98, 0.22], [f - 0.3, 3.16, 0.3], [f + 0.02, 2.84, 0.16], [f + 0.06, 1.25, 0.12], [f + 0.08, 0.55, 0.12], [f, 0.48, 0.06]];
    c.meta.col = col; c.meta.kind = "bus";
    var ws0 = [f + 0.06, 1.25], ws1 = [f + 0.02, 2.84];
    var q = ZG.quadDef(lerp2(ws0, ws1, 0.04), lerp2(ws0, ws1, 0.8), W, T, "front", 0.05, { inset: 0.05, side: 0.12 });
    function win(x0, x1) { return [[x0, 1.68], [x1, 1.68], [x1, 2.62], [x0, 2.62]]; }
    /* porta de folha dupla atrás da roda dianteira; janelas largas */
    var dx1 = ax1 - ar - 0.21, dx0 = dx1 - 1.02;
    var door = [[dx0, 0.62], [dx1, 0.62], [dx1, 2.62], [dx0, 2.62]];
    var winR = [], winL = [];
    for (var i = 0; i < 5; i++) winR.push(win(-4.25 + i * 1.08, -4.25 + i * 1.08 + 0.96));
    winR.push(win(dx1 + 0.12, ax1 + 0.5)); winR.push(win(ax1 + 0.6, f - 0.2));
    for (var j = 0; j < 7; j++) winL.push(win(-4.25 + j * 1.1, -4.25 + j * 1.1 + 0.98));
    var drvW = [[3.53, 1.68], [f - 0.2, 1.68], [f - 0.2, 2.62], [3.53, 2.62]];
    var hatch = ZG.holeBox([f - 0.3, 0.8, -0.6], [f + 0.4, 1.2, 0.6], function (n) { return n.x > 0.6; }, "tampa");
    var holes = [ZG.holeQuad(q), ZG.holeSide(door, { side: 1 }), ZG.holeSide(drvW, { side: -1 }), hatch, ZG.holeBox([rr - 0.3, 1.95, -0.9], [rr + 0.3, 2.62, 0.9], function (n) { return n.x < -0.6; })]
      .concat(winR.map(function (p) { return ZG.holeSide(p, { side: 1 }); }), winL.map(function (p) { return ZG.holeSide(p, { side: -1 }); }));
    var body = ZG.shell(c, { items: items, bottomY: 0.48, arches: [[ax1, wr, ar], [ax2, wr, ar]], W: W, col: col, T: T, sub: 0.3, holes: holes, archInner: W / 2 - 0.55 });
    ZG.glassQuad(c, q, "Para-brisa");
    c.rb(0.06, 1.24, 0.06, 0.02, MT.trim, (q.b[0] + q.t[0]) / 2 + 0.03, (q.b[1] + q.t[1]) / 2, 0);
    ZG.sideWindows(c, winR, W, T, function (i) { return "Janela " + (i + 1); }, { sides: [1] });
    ZG.sideWindows(c, winL, W, T, function (i) { return "Janela " + (i + 1); }, { sides: [-1] });
    ZG.sideWindows(c, [door], W, T, function () { return "Porta de entrada"; }, { sides: [1] });
    ZG.sideWindows(c, [drvW], W, T, function () { return "Janela do motorista"; }, { sides: [-1] });
    var rg = c.rb(0.02, 0.6, 1.72, 0.04, MT.glass, rr - 0.035, 2.27, 0); ZG.asGlass(c, rg, "Vidro traseiro (saída de emergência)", "temperado");
    /* folhas da porta: divisão central, base escura e balaústres */
    var dxc = (dx0 + dx1) / 2, dz = W / 2 + 0.02;
    c.rb(0.04, 1.96, 0.02, 0.01, MT.trim, dxc, 1.62, dz);
    c.rb(dx1 - dx0 - 0.06, 0.34, 0.015, 0.01, CM("#2a2c2e"), dxc, 0.8, dz);
    [dx0 + 0.1, dx1 - 0.1].forEach(function (hx) { c.rod(new V3(hx, 1.1, dz + 0.03), new V3(hx, 2.2, dz + 0.03), 0.014, MT.chrome); });
    [1, -1].forEach(function (s) {
      var zs = function (y) { return s * (ZG.halfAt(W, T, y) + 0.004); };
      var segs = s > 0 ? [[rr + 0.1, dx0 - 0.03], [dx1 + 0.03, f - 0.1]] : [[rr + 0.1, f - 0.1]];
      segs.forEach(function (sg) {
        var cx = (sg[0] + sg[1]) / 2, ln = sg[1] - sg[0];
        c.rb(ln, 0.24, 0.01, 0.005, CM("#151515", { roughness: 0.6 }), cx, 1.42, zs(1.42));
        c.rb(ln, 0.05, 0.01, 0.005, MT.trim, cx, 0.78, zs(0.78));
      });
      c.text("ESCOLAR", 2.1, 0.36, 0.18, 1.16, s * (W / 2 + 0.008), s > 0 ? "+z" : "-z", { fg: "#121212" });
      [ax1, ax2].forEach(function (ax) { c.rb(0.02, 0.5, 0.42, 0.01, MT.rubber, ax - 0.75, 0.32, s * (W / 2 - 0.3)); });
      [-3.6, -0.4, 0.6].forEach(function (x) { c.rb(0.06, 0.05, 0.015, 0.01, MT.amber, x, 0.95, s * (W / 2 + 0.01)); });
    });
    /* letreiro e faixa preta frontal, traseira */
    c.rb(0.04, 0.26, 1.7, 0.02, MT.dark, f + 0.0, 2.98, 0); c.text("ESCOLAR", 1.5, 0.22, f + 0.025, 2.98, 0, "+x", { fg: "#f2b632", bg: "#0b0b0b", glow: "#e0a020" });
    /* a traseira da casca fica ~6 cm atrás de rr (cantos arredondados): textos e faixa vão por fora dela */
    c.text("ESCOLAR", 1.6, 0.34, rr - 0.08, 1.62, 0, "-x", { fg: "#121212" });
    c.rb(0.03, 0.1, W - 0.2, 0.02, CM("#151515"), rr - 0.07, 1.36, 0);
    /* interior: motorista sobre o motor dianteiro, fileiras a partir da porta, balaústre da entrada */
    var fl = 1.02, zi = W / 2 - 0.1;
    ZG.busRows(c, { x0: dx0 - 0.15, x1: -4.15, pitch: 0.64, floor: fl, zIn: zi, aisle: 0.46, col: "#355a7a", ceil: 2.95, seatH: 0.4 });
    ZG.dashboard(c, { x: f - 0.05, y: 1.42, w: zi * 2, d: 0.42, h: 0.4, drv: -0.7, mat: CM("#202124"), top: CM("#2a2b2e") });
    ZG.steeringWheel(c, f - 0.6, 1.48, -0.7, { r: 0.25, tilt: 1.1, col: 0.45 });
    ZG.seat(c, f - 1.05, fl, -0.7, { w: 0.5, mat: CM("#2c2d30", { roughness: 0.85 }), h: 0.45 });
    c.rb(0.9, 0.38, 0.5, 0.08, CM("#2a2b2d"), f - 0.6, fl + 0.19, -0.05);
    c.rod(new V3(dx0 - 0.05, fl, zi - 0.35), new V3(dx0 - 0.05, 2.95, zi - 0.35), 0.02, MT.chrome);
    c.rb(L - 0.5, 0.02, zi * 2, 0.01, MT.headliner, 0, 2.98, 0).castShadow = false;
    var m = c.meta;
    Object.assign(m, { L: L + 0.15, W: W, front: f + 0.12, rear: rr - 0.03, clear: 0.48, belt: 1.45, top: 3.18, bodyH: 1.0, T: T, quadF: q, roof: { x0: -4.0, x1: 3.7, w: 2.0, y: 3.16 }, cabL: 1.6 });
    ZG.engineBay(c, { x0: f - 1.35, x1: f + 0.02, zw: 0.56, floor: 0.5, top: 0.98, motor: "diesel", col: "#3a3c3e", view: { theta: 0.25, phi: 1.12, dist: 4.4 } });
    var nD = c.g.children.length;
    ZG.carDetails(c, { lower: items, bottomY: 0.48, noseY: 0.95, tailY: 1.0, W: W, col: col, hl: { style: "dround", w: 0.46, h: 0.21, y: 0.92, in: 0.1, yaw: 0 }, tl: { style: "round2", w: 0.34, h: 0.16, y: 1.05 },
      grille: { style: "bars", w: 0.95, h: 0.3, y: 1.0, emblem: true }, wheels: [[ax1, wr, 0.32, { rim: RIM_W, spokes: 0, rimR: 0.56, track: 2.05 }], [ax2, wr, 0.32, { rim: RIM_W, spokes: 0, rimR: 0.56 }]], plateRearY: 0.78, noAntenna: true });
    [1, -1].forEach(function (s) { truckWheel(c, ax2, s * (W / 2 - 0.55), wr, 0.3, { noPart: true, inner: true }); });
    rearOut(c, nD, rr, 0.08);
    /* tampa frontal articulada no alto: abre para o radiador e o motor dianteiro */
    var lid = new THREE.Mesh(ZG.geo.crease(body.userData.cut.tampa, 42), c.paint(col)); lid.castShadow = true; c.g.add(lid); c.deform.push(lid);
    var lidObjs = [lid];
    c.g.children.slice(nD).forEach(function (o) { var p = o.position; if (o !== lid && p.x > f - 0.05 && Math.abs(p.z) < 0.62 && p.y > 0.8 && p.y < 1.22) lidObjs.push(o); });
    ZG.hinge(c, lidObjs, new V3(f + 0.1, 1.2, 0), { len: 0.4, open: 1.25, zw: 0.7, label: "Tampa do motor" });
    m.gh = { fb: f, belt: 1.45, Wg: W };
    [-0.45, 0.55].forEach(function (z) { c.rod(new V3(f + 0.1, 1.32, z - 0.3), new V3(f + 0.09, 2.0, z + 0.05), 0.012, MT.trim); });
    [1, -1].forEach(function (s) { c.tube([[f - 0.3, 3.0, s * 1.12], [f + 0.25, 2.9, s * 1.2], [f + 0.35, 2.35, s * 1.34]], 0.025, MT.trim); c.rb(0.06, 0.42, 0.24, 0.03, MT.trim, f + 0.35, 2.17, s * 1.36); c.rb(0.01, 0.38, 0.2, 0.01, MT.chrome, f + 0.32, 2.17, s * 1.36); });
    var hatches = [-2.3, 0.8].map(function (x) { return c.rb(0.7, 0.08, 0.6, 0.03, CM("#c9c4b4"), x, 3.17, 0); });
    /* zonas: a porta de embarque é zona própria (as folhas emperram e quebram), as escotilhas pertencem ao teto do salão */
    c.zone("porta_embarque", "Porta de embarque", [dx0 - 0.05, dx1 + 0.05, 0.55, 2.7, W / 2 - 0.3, W / 2 + 0.25], null, { type: "painel", side: 1, fxKey: "porta", who: "quem está entrando" });
    c.zone("teto_salao", "Teto e escotilhas", [-4.4, 4.2, 2.85, 3.4, -W / 2 + 0.42, W / 2 - 0.42], hatches, { type: "teto", fxKey: "teto", who: "quem está sentado" });
    m.armor = armorPlus(function (c) { sandbags(c, -0.8, 0.8, 3.3, 3.4, "z"); roofLamp(c, 3.8, 3.45, 0.7); roofLamp(c, 3.8, 3.45, -0.7); });
  });

  /* Marcopólo Torino (Marcopolo Torino G7, piso baixo, motor traseiro)
     Referência (Torino G7 sobre chassi de motor traseiro tipo O-500U; de memória, conferido com notícias de lançamento):
       comprimento 12,30 m · largura 2,50 m · altura 3,20 m sem o ar-condicionado (3,45 m com ele)
       entre-eixos 6,40 m · balanço dianteiro 2,65 m · traseiro 3,25 m · bitola 2,10 m · pneu 275/80 R22,5 (Ø 1,01 m)
       vão livre 0,30 m · piso baixo até o eixo traseiro, degrau para o salão sobre o motor
     Traços de assinatura:
       frente: para-brisa enorme quase vertical, que desce até a altura dos faróis; letreiro de LED âmbar integrado no alto;
               faróis compridos e finos em moldura preta nas quinas inferiores; frente inferior preta com a grade estreita
       lateral: duas portas largas de folha dupla à direita (dianteira e central); janelas grandes com faixa preta acima;
               saia pintada com filete laranja; teto com caixa de ar-condicionado na metade da frente
       traseira: vidro traseiro alto, lanternas verticais compridas, tampa do motor com grelhas horizontais e número da linha
       teto: ar-condicionado com aletas; retrovisores em braço curvo tipo "orelha de coelho" saindo do teto */
  ZG.register({ k: "urbano", grp: GRP, n: "Marcopólo Torino", insp: "Marcopolo Torino", c: "Ônibus urbano de piso baixo", fuel: "diesel",
    d: "O ônibus de linha das capitais: para-brisa gigante, letreiro de LED e duas portas largas. Piso baixo, catraca e motor traseiro com tampa que abre.",
    mass: 11800, r: 105, seats: "37 sentados + 43 em pé", cap: "275 L", eff: "2,3 km/L", auto: "630 km", vmax: 90, skill: "Direção pesada 1", hood: true
  }, function (c) {
    var W = 2.5, f = 6.0, rr = -6.0, L = f - rr, T = { belt: 1.3, top: 3.18, k: 0.03 }, col = "#ecece6", band = "#1f6f8b", acc = "#e07a1f";
    var items = [[rr, 0.34, 0.1], [rr - 0.02, 2.95, 0.2], [rr + 0.3, 3.15, 0.25], [f - 0.35, 3.15, 0.3], [f + 0.02, 2.82, 0.15], [f + 0.1, 0.8, 0.18], [f + 0.06, 0.34, 0.08]];
    var m = c.meta; m.col = col; m.kind = "bus";
    var ws0 = [f + 0.1, 0.8], ws1 = [f + 0.02, 2.82];
    var q = ZG.quadDef(lerp2(ws0, ws1, 0.1), lerp2(ws0, ws1, 0.84), W, T, "front", 0.05, { inset: 0.04, side: 0.09 });
    var ax1 = 3.55, ax2 = -2.85, wr = 0.5;
    var dF = [[f - 1.15, 0.38], [f - 0.2, 0.38], [f - 0.2, 2.7], [f - 1.15, 2.7]], dM = [[0.55, 0.38], [1.85, 0.38], [1.85, 2.7], [0.55, 2.7]];
    var drv = [[f - 1.2, 1.3], [f - 0.25, 1.3], [f - 0.25, 2.66], [f - 1.2, 2.66]];
    function strip(x0, x1, pitch) { var out = []; for (var x = x0; x < x1 - 0.3; x += pitch) out.push([[x, 1.32], [Math.min(x + pitch - 0.1, x1), 1.32], [Math.min(x + pitch - 0.1, x1), 2.66], [x, 2.66]]); return out; }
    var winR = strip(-5.6, 0.45, 1.5).concat(strip(1.95, f - 1.25, 1.4)), winL = strip(-5.6, f - 1.3, 1.5);
    var hatch = ZG.holeBox([rr - 0.3, 0.64, -0.95], [rr + 0.3, 1.4, 0.95], function (n) { return n.x < -0.6; }, "tampa");
    var holes = [ZG.holeQuad(q), hatch, ZG.holeSide(dF, { side: 1 }), ZG.holeSide(dM, { side: 1 }), ZG.holeSide(drv, { side: -1 }), ZG.holeBox([rr - 0.3, 2.0, -0.85], [rr + 0.3, 2.75, 0.85], function (n) { return n.x < -0.6; })]
      .concat(winR.map(function (p) { return ZG.holeSide(p, { side: 1 }); }), winL.map(function (p) { return ZG.holeSide(p, { side: -1 }); }));
    var body = ZG.shell(c, { items: items, bottomY: 0.34, arches: [[ax1, wr, 0.6], [ax2, wr, 0.6]], W: W, col: col, T: T, sub: 0.32, holes: holes, archInner: W / 2 - 0.58 });
    ZG.glassQuad(c, q, "Para-brisa");
    ZG.sideWindows(c, winR, W, T, function (i) { return "Janela " + (i + 1); }, { sides: [1] });
    ZG.sideWindows(c, winL, W, T, function (i) { return "Janela " + (i + 1); }, { sides: [-1] });
    ZG.sideWindows(c, [dF], W, T, function () { return "Porta dianteira"; }, { sides: [1] });
    ZG.sideWindows(c, [dM], W, T, function () { return "Porta central"; }, { sides: [1] });
    ZG.sideWindows(c, [drv], W, T, function () { return "Janela do motorista"; }, { sides: [-1] });
    var rg = c.rb(0.02, 0.68, 1.64, 0.04, MT.tint, rr - 0.03, 2.37, 0); ZG.asGlass(c, rg, "Vidro traseiro", "temperado");
    /* portas: folhas com divisão central e base escura; pintura: faixa da saia, filete laranja, faixa preta das janelas */
    [dF, dM].forEach(function (d) {
      var xc = (d[0][0] + d[1][0]) / 2, zz = W / 2 + 0.02;
      c.rb(0.04, 2.3, 0.02, 0.01, MT.trim, xc, 1.54, zz);
      c.rb(d[1][0] - d[0][0] - 0.06, 0.6, 0.015, 0.01, CM("#2a2c2e"), xc, 0.72, zz);
      [d[0][0] + 0.12, d[1][0] - 0.12].forEach(function (hx) { c.rod(new V3(hx, 1.1, zz + 0.03), new V3(hx, 2.1, zz + 0.03), 0.014, MT.chrome); });
    });
    [1, -1].forEach(function (s) {
      var zs = function (y) { return s * (ZG.halfAt(W, T, y) + 0.004); };
      var segs = s > 0 ? [[rr + 0.1, 0.5], [1.9, f - 1.2]] : [[rr + 0.1, f - 0.1]];
      segs.forEach(function (sg) { var cx = (sg[0] + sg[1]) / 2, ln = sg[1] - sg[0]; c.rb(ln, 0.52, 0.012, 0.01, c.paint(band), cx, 0.7, zs(0.7)); c.rb(ln, 0.06, 0.012, 0.005, c.paint(acc), cx, 1.02, zs(1.02)); });
      var sg2 = s > 0 ? [[rr + 0.05, 0.5], [1.9, f - 1.18]] : [[rr + 0.05, f - 1.22]];
      sg2.forEach(function (sg) { c.rb(sg[1] - sg[0], 0.1, 0.012, 0.005, CM("#111214", { roughness: 0.4 }), (sg[0] + sg[1]) / 2, 2.75, zs(2.75)); });
      c.text("LINHA 207", 1.2, 0.2, s > 0 ? 3.0 : -3.4, 2.93, zs(2.93) + s * 0.003, s > 0 ? "+z" : "-z", { fg: "#ffb02e", bg: "#0b0b0b", glow: "#e09020" });
      [ax1, ax2].forEach(function (ax) { c.rb(0.02, 0.38, 0.4, 0.01, MT.rubber, ax - 0.68, 0.28, s * (W / 2 - 0.3)); });
      c.rb(0.06, 0.05, 0.015, 0.01, MT.amber, -1.5, 0.55, zs(0.55)); c.rb(0.06, 0.05, 0.015, 0.01, MT.amber, 2.5, 0.55, zs(0.55));
    });
    /* letreiro frontal de LED, frente preta e faróis */
    var fx = function (y) { return ZG.profX(items, y, true); };
    /* letreiro de LED logo acima do para-brisa, na mesma faixa de vidro escuro */
    c.rb(0.04, 0.3, 1.8, 0.03, MT.dark, fx(2.67) + 0.06, 2.67, 0);
    c.text("207  CENTRO", 1.5, 0.22, fx(2.67) + 0.084, 2.67, 0, "+x", { fg: "#ffb02e", bg: "#060606", glow: "#e09020" });
    c.rb(0.05, 0.42, W - 0.12, 0.08, CM("#16181a", { roughness: 0.5 }), fx(0.6) + 0.0, 0.6, 0);
    var mt = c.paint(band); c.rb(0.03, 0.06, W - 0.4, 0.02, mt, fx(0.86) + 0.02, 0.86, 0);
    /* interior: piso baixo até o eixo traseiro, degrau para o salão de trás sobre o motor */
    var fl = 0.45, zi = W / 2 - 0.1, pole = CM("#e0a21c", { roughness: 0.4, metalness: 0.2 });
    ZG.busRows(c, { x0: 3.3, x1: 2.3, pitch: 0.75, floor: fl, zIn: zi, aisle: 0.55, col: "#3e4a8a", ceil: 2.95, seatH: 0.44, mat: pole });
    ZG.busRows(c, { x0: 0.0, x1: -1.6, pitch: 0.75, floor: fl, zIn: zi, aisle: 0.55, col: "#3e4a8a", ceil: 2.95, seatH: 0.44, mat: pole });
    ZG.busRows(c, { x0: -3.2, x1: -5.3, pitch: 0.72, floor: 0.92, zIn: zi, aisle: 0.5, col: "#3e4a8a", ceil: 2.95, seatH: 0.42, mat: pole });
    c.rb(0.25, 0.47, zi * 2, 0.02, MT.carpet, -2.45, 0.68, 0);
    c.rb(L - 0.5, 0.02, zi * 2, 0.01, MT.headliner, 0, 3.0, 0).castShadow = false;
    [1.0, 1.5, -2.2].forEach(function (x) { c.rod(new V3(x, fl, 0), new V3(x, 2.95, 0), 0.018, pole); });
    ZG.dashboard(c, { x: fx(1.3) - 0.08, y: 1.3, w: 1.2, d: 0.5, h: 0.5, drv: -0.68, mat: CM("#1d1e20"), top: CM("#2a2b2e") });
    ZG.steeringWheel(c, f - 0.62, 1.38, -0.68, { r: 0.25, tilt: 1.15, col: 0.4 });
    ZG.seat(c, f - 1.15, 0.6, -0.68, { w: 0.5, mat: CM("#2c2d30", { roughness: 0.85 }), h: 0.46 });
    /* catraca e cobrador */
    c.rb(0.4, 0.95, 0.32, 0.05, CM("#9aa0a4", { metalness: 0.5 }), 3.95, fl + 0.48, -0.55);
    [0, 2.09, 4.19].forEach(function (a) { c.rod(new V3(3.95, fl + 0.9, -0.37), new V3(3.95 + Math.cos(a) * 0.32, fl + 0.9 + Math.sin(a) * 0.32 * 0.4, -0.37 + Math.abs(Math.sin(a)) * 0.2), 0.02, MT.chrome); });
    ZG.seat(c, 3.95, fl + 0.15, -0.95, { w: 0.42, mat: CM("#3e4a8a", { roughness: 0.85 }), h: 0.45, back: 0.5, dir: 1 });
    Object.assign(m, { L: L + 0.12, W: W, front: f + 0.12, rear: rr - 0.02, clear: 0.34, belt: 1.3, top: 3.18, bodyH: 1.0, T: T, quadF: q,
      roof: { x0: -5.6, x1: 1.0, w: 2.0, y: 3.17 } });
    mirrorBay(c, { x0: rr + 0.0, x1: rr + 1.35, zw: 0.85, floor: 0.4, top: 0.86, motor: "diesel", col: "#3a3c3e", view: { theta: PI - 0.3, phi: 1.12, dist: 4.6 } }, rr + 0.67);
    var nD0 = c.g.children.length;
    ZG.carDetails(c, { lower: items, bottomY: 0.34, noseY: 0.92, tailY: 1.6, W: W, col: col, hl: { style: "split", w: 0.5, h: 0.22, y: 0.85, in: 0.1, yaw: 0.12 }, tl: { style: "vertical", w: 0.22, h: 0.5, y: 1.62, in: 0.04 },
      grille: { style: "mesh", w: 0.9, h: 0.18, y: 0.55, emblem: true }, wheels: [[ax1, wr, 0.3, { rim: RIM_S, spokes: 0, rimR: 0.56, track: 2.10 }], [ax2, wr, 0.3, { rim: RIM_S, spokes: 0, rimR: 0.56 }]], plateRearY: 1.55, noAntenna: true, noRadiator: true });
    [1, -1].forEach(function (s) { truckWheel(c, ax2, s * (W / 2 - 0.52), wr, 0.28, { noPart: true, inner: true }); });
    rearOut(c, nD0, rr, 0.08);
    /* ar-condicionado no teto */
    var ac = [c.rb(3.0, 0.26, 1.9, 0.12, c.paint(col), 3.3, 3.25, 0)]; for (var k = 0; k < 6; k++) ac.push(c.rb(0.3, 0.02, 1.5, 0.01, MT.trim, 2.1 + k * 0.48, 3.39, 0));
    /* zonas: o ar-condicionado é peça que entorta e sai; as duas portas de embarque têm zona própria */
    c.zone("ar_cond", "Ar-condicionado do teto", [1.7, 4.9, 3.1, 3.45, -1.0, 1.0], ac, { type: "peca", fxKey: "teto", w: 0.5, anchor: [3.3, 3.12, 0] });
    [[dF, "porta_dianteira", "Porta dianteira"], [dM, "porta_central", "Porta central"]].forEach(function (P) {
      var d = P[0]; c.zone(P[1], P[2], [d[0][0] - 0.05, d[1][0] + 0.05, 0.3, 2.78, W / 2 - 0.3, W / 2 + 0.25], null, { type: "painel", side: 1, fxKey: "porta", who: "quem está entrando" });
    });
    [1, -1].forEach(function (s) { c.tube([[f - 0.25, 3.05, s * 1.1], [f + 0.4, 3.0, s * 1.22], [f + 0.55, 2.55, s * 1.32]], 0.025, MT.trim); c.rb(0.06, 0.45, 0.24, 0.03, MT.trim, f + 0.55, 2.35, s * 1.34); c.rb(0.01, 0.4, 0.2, 0.01, MT.chrome, f + 0.52, 2.35, s * 1.34); });
    [-0.5, 0.5].forEach(function (z) { c.rod(new V3(fx(1.0) + 0.05, 1.0, z - 0.3), new V3(fx(1.6) + 0.04, 1.75, z + 0.1), 0.012, MT.trim); });
    /* tampa traseira do motor (dobradiça no alto) e motor diesel atrás */
    var lid = new THREE.Mesh(ZG.geo.crease(body.userData.cut.tampa, 42), c.paint(col)); lid.castShadow = true; c.g.add(lid); c.deform.push(lid);
    var lidObjs = [lid];
    for (var g = 0; g < 5; g++) lidObjs.push(c.rb(0.03, 0.045, 1.5, 0.015, MT.trim, rr - 0.075, 0.74 + g * 0.1, 0));
    lidObjs.push(c.text("207", 0.5, 0.2, rr - 0.09, 1.28, 0, "-x", { fg: "#ffb02e", bg: "#060606", glow: "#e09020" }));
    ZG.hinge(c, lidObjs, new V3(rr - 0.03, 1.42, 0), { len: -0.4, open: 1.2, sign: -1, zw: 0.8, label: "Tampa do motor" });
    m.gh = { fb: f, belt: 1.3, Wg: W };
    c.parts.forEach(function (p) { if (p.kind === "radiador") p.pos.set(rr + 0.3, 0.7, 0); });
    m.armor = armorPlus(function (c) { sandbags(c, -1.6, 0.6, 3.3, -0.5, "x"); roofLamp(c, f - 0.2, 3.38, 0.7); roofLamp(c, f - 0.2, 3.38, -0.7); });
  });

  /* Atego Forte (Mercedes-Benz Atego 1719 com carroceria blindada de transporte de valores)
     Referência (Atego 1719 entre-eixos 4,17 m e carrocerias de carro-forte nacionais; web + memória):
       comprimento 7,60 m · largura da cabine 2,30 m, do cofre 2,40 m · altura da cabine 2,90 m, do cofre 3,10 m
       entre-eixos 4,20 m · balanço dianteiro 1,49 m · traseiro 1,95 m · bitola 1,95 m · pneu 275/80 R22,5 (Ø 1,01 m)
       vão livre 0,26 m · blindagem nível III-A no cofre e na cabine
     Traços de assinatura:
       frente: grade com três frisos cromados horizontais e estrela genérica grande no centro; faróis retangulares nas
               pontas do para-choque, levemente voltados para fora; frente alta e plana com vincos laterais
       lateral: cabine com janela de canto baixo; cofre liso de aço rebitado com seteiras redondas, visor blindado,
               faixa amarela de "VALORES"; sem frisos de baú
       traseira: porta blindada única com visor, dobradiças pesadas e trava cromada
       teto: escotilha redonda, barra de luzes âmbar e antenas de rádio */
  ZG.register({ k: "forte", grp: GRP, n: "Atego Forte", insp: "Mercedes-Benz Atego (carro-forte)", c: "Carro-forte blindado", fuel: "diesel",
    d: "Cabine avançada blindada e cofre de aço com seteiras. Vidros à prova de tiro e de mordida. Pesado e beberrão, mas ninguém entra. A cabine bascula para o diesel.",
    mass: 11500, r: 90, seats: "4 (motorista + 3 vigilantes)", cap: "210 L", eff: "3,6 km/L", auto: "750 km", vmax: 100, skill: "Direção pesada 1", hood: true
  }, function (c) {
    var f = 3.75, W = 2.32, len = 1.85, ax = 2.5, wr = 0.506, ww = 0.28, col = "#56616b";
    c.meta.bullet = true; c.meta.cabL = len + 0.15; c.meta.bodyLabel = "Cofre";
    var cabO = { model: "atego", f: f, W: W, len: len, roof: 2.9, belt: 1.86, bot: 0.74, floor: 1.3, ax: ax, wr: wr, ww: ww, col: col, int: "#2c2e2a", glass: MT.armorGlass, glassType: "laminado", glassLabel: "Para-brisa blindado", bumperY: 0.88, bumperH: 0.4 };
    var n0 = c.g.children.length, cab = cabOver(c, cabO), cabObjs = c.g.children.slice(n0);
    cabFront(c, cabO, cab);
    ZG.engineBay(c, { x0: f - len + 0.1, x1: f - 0.45, zw: 0.42, floor: 0.45, top: 1.24, motor: "diesel", col: "#3a3c3e" });
    tiltCab(c, cabObjs, new V3(f - 0.02, 1.05, 0), { len: len, open: 1.15 });
    var rear = -3.65;
    chassis(c, { f: f - 0.1, rear: rear, W: W, railY: 0.86, axles: [-1.7], wr: wr, ww: ww, tankX: 0.75, tankSide: -1, mud: true, lightsY: 0.72 });
    var bx0 = f - len - 0.06;
    boxBody(c, { x0: bx0, x1: rear + 0.05, y0: 1.1, y1: 3.08, W: 2.4, col: "#5d6a74", armored: true, label: "Cofre blindado" });
    var plate = CM("#3f474e", { metalness: 0.55, roughness: 0.45 });
    [1, -1].forEach(function (s) {
      var zs = s * (1.2 + 0.012);
      [-2.6, -1.5, -0.4, 0.7].forEach(function (x) { c.cyl(0.13, 0.13, 0.03, plate, x, 2.1, zs, "z", { seg: 20 }); c.cyl(0.04, 0.04, 0.04, MT.dark, x, 2.1, zs + s * 0.006, "z", { seg: 12 }); });
      var vg = c.rb(0.32, 0.2, 0.03, 0.03, MT.armorGlass, 1.3, 2.45, zs); ZG.asGlass(c, vg, "Visor blindado " + (s > 0 ? "direito" : "esquerdo"), "laminado");
      c.rb(0.4, 0.28, 0.02, 0.03, plate, 1.3, 2.45, zs - s * 0.004);
      for (var x = rear + 0.2; x < bx0; x += 0.3) { c.sph(0.018, MT.steel, x, 1.2, zs); c.sph(0.018, MT.steel, x, 2.98, zs); }
      c.rb(5.3, 0.36, 0.01, 0.01, CM("#e0b81c", { roughness: 0.5 }), -1.0, 1.55, zs + s * 0.002);
      c.text("VALORES", 1.6, 0.3, -1.0, 1.55, zs + s * 0.012, s > 0 ? "+z" : "-z", { fg: "#121212" });
      c.rb(0.5, 0.05, 0.25, 0.01, MT.steel, rear + 0.6, 0.62, s * 1.05);
    });
    /* porta traseira blindada com visor e dobradiças pesadas */
    var rx = rear + 0.04;
    var rgs = c.rb(0.03, 0.18, 0.28, 0.03, MT.armorGlass, rx - 0.03, 2.5, 0.45); ZG.asGlass(c, rgs, "Visor traseiro", "laminado");
    [1.4, 2.6].forEach(function (y) { c.rb(0.08, 0.22, 0.14, 0.03, MT.steel, rx - 0.04, y, -0.99); });
    c.rb(0.07, 0.4, 0.06, 0.02, MT.chrome, rx - 0.05, 2.0, 0.55);
    /* teto: escotilha, sirene, barra de luzes âmbar e antenas */
    c.cyl(0.36, 0.38, 0.1, plate, -1.3, 3.13, 0); c.cyl(0.3, 0.3, 0.05, MT.steel, -1.3, 3.2, 0);
    c.rb(0.2, 0.08, 1.3, 0.03, MT.trim, bx0 - 0.25, 3.13, 0); [-0.45, 0, 0.45].forEach(function (z) { c.rb(0.14, 0.08, 0.3, 0.03, MT.amber, bx0 - 0.25, 3.2, z); });
    c.rod(new V3(-2.5, 3.08, 0.6), new V3(-2.5, 3.6, 0.6), 0.008, MT.trim); c.rod(new V3(-2.8, 3.08, -0.6), new V3(-2.8, 3.4, -0.6), 0.01, MT.trim);
    var m = c.meta; m.front = f + 0.24; m.L = m.front - rear; m.top = 3.08; m.belt = 1.86; m.bodyH = 1.4; m.clear = 0.45;
    m.armor = armorPlus(function (c) {
      /* torre de vigia no teto com escudo e holofote */
      c.cyl(0.42, 0.42, 0.35, ZG.STEELM, -1.3, 3.35, 0, null, { seg: 20, open: true });
      c.rb(0.06, 0.45, 0.8, 0.03, ZG.STEELM, -0.85, 3.5, 0, { rot: [0, 0, -0.2] });
      roofLamp(c, -0.75, 3.9, 0);
      for (var x = -3.2; x <= 1.4; x += 0.4) [1, -1].forEach(function (s) { var sp = c.add(new THREE.ConeGeometry(0.035, 0.25, 8), MT.steel, x, 1.25, s * 1.33); sp.rotation.x = s * PI / 2; });
    });
  });

  /* Massei 275 (Massey Ferguson 275)
     Referência (tractordata e ritchiespecs, MF 275 com Perkins de 4 cilindros; web):
       comprimento 3,70 m com contrapesos · largura 1,99 m · altura 2,65 m no toldo, 1,72 m no volante, 1,57 m no capô
       entre-eixos 2,07 m · bitola traseira 1,52 m, dianteira 1,48 m · pneu traseiro 18.4-30 (Ø 1,58 m), dianteiro 7.50-16 (Ø 0,80 m)
       vão livre 0,40 m · massa 2.770 a 3.000 kg em ordem de marcha · tanque 68 a 80 L
     Traços de assinatura:
       frente: grade preta de frisos dentro de moldura vermelha, faróis retangulares nas quinas de cima da grade, filete
               branco no alto; suporte de contrapesos em placas na ponta
       lateral: capô vermelho comprido e reto com filete branco e "275"; chassi e motor cinza aparentes; escapamento
               vertical à direita e pré-filtro de ar à esquerda saindo do capô; rodões traseiros com garras em V
       traseira: para-lamas largos de topo plano com lanternas; engate de três pontos, barra de tração e tomada de força
       teto: arco de proteção com toldo claro sobre o banco */
  ZG.register({ k: "trator", grp: "Agrícola", n: "Massei 275", insp: "Massey Ferguson 275", c: "Trator agrícola", fuel: "diesel",
    d: "O trator vermelho de toda fazenda: capô comprido, rodões traseiros e arco de proteção com toldo. Lento, mas não atola nunca e empurra carros parados. O capô abre para mostrar o diesel de quatro cilindros.",
    mass: 3100, r: 90, seats: "1", cap: "68 L", eff: "5,5 L/h", auto: "12 h de uso", vmax: 28, skill: "—", hood: true
  }, function (c) {
    var col = "#b3251d", gray = CM("#3d3f42", { roughness: 0.55, metalness: 0.3 }), dgray = CM("#2b2c2e", { roughness: 0.6, metalness: 0.3 }), paint = c.paint(col);
    var rimY = CM("#9c9b95", { metalness: 0.35, roughness: 0.5 }), m = c.meta;
    m.col = col; m.kind = "tractor";
    var rx = -0.95, fxA = 1.12, rR = 0.79, fR = 0.4, rz = 0.75, FX = -0.24;
    /* rodas: traseiras 18.4-30 com garras em V, dianteiras 7.50-16 com friso */
    [1, -1].forEach(function (s) {
      var rw = c.wheel(rx, s * rz, rR, 0.46, { lugs: true, chevron: true, rim: rimY, spokes: 0, rimR: 0.6, label: "Pneu traseiro " + (s > 0 ? "direito" : "esquerdo") });
      /* aro de disco com oito furos ovais e cubo escuro, como no rodado original */
      for (var hk = 0; hk < 8; hk++) { var ha = hk / 8 * PI * 2; c.cyl(0.05, 0.05, 0.012, MT.dark, Math.cos(ha) * rR * 0.36, Math.sin(ha) * rR * 0.36, s * 0.46 * 0.392, "z", { parent: rw, seg: 12 }); }
      c.wheel(fxA, s * 0.74, fR, 0.2, { rim: rimY, spokes: 0, rimR: 0.55, label: "Pneu dianteiro " + (s > 0 ? "direito" : "esquerdo") });
      for (var r = 0; r < 3; r++) { var rg = c.add(new THREE.TorusGeometry(fR - 0.004, 0.012, 6, 30), MT.rubber, fxA, fR, s * 0.74 + (r - 1) * 0.055); rg.castShadow = false; }
    });
    /* eixo dianteiro oscilante, bloco do motor e transmissão (chassi monobloco cinza) */
    c.rb(0.16, 0.14, 1.5, 0.04, gray, fxA, fR + 0.02, 0);
    c.rb(0.25, 0.2, 0.25, 0.05, gray, fxA, fR + 0.14, 0);
    c.rb(1.6, 0.46, 0.5, 0.08, gray, 0.35, 0.82, 0);
    c.rb(1.0, 0.6, 0.62, 0.1, dgray, -0.75, 0.8, 0);
    c.rb(0.5, 0.36, 1.25, 0.08, dgray, rx, rR, 0);
    for (var b = 0; b < 4; b++) c.cyl(0.05, 0.05, 0.06, MT.steel, -0.1 + b * 0.3, 0.86, 0.27);
    /* contrapesos frontais */
    c.rb(0.12, 0.28, 0.66, 0.03, gray, 1.92 + FX, 0.62, 0);
    for (var w = 0; w < 8; w++) c.rb(0.12, 0.3, 0.075, 0.025, dgray, 2.03 + FX, 0.62, -0.315 + w * 0.09);
    c.rb(0.06, 0.06, 0.8, 0.02, MT.steel, 2.1 + FX, 0.62, 0);
    /* capô comprido com laterais vazadas */
    var hx0 = 0.02, hx1 = 1.84 + FX, hy = 1.48;
    [1, -1].forEach(function (s) {
      c.rb(hx1 - hx0, 0.38, 0.035, 0.02, paint, (hx0 + hx1) / 2, 1.22, s * 0.36, { def: true });
      for (var j = 0; j < 5; j++) c.rb(0.22, 0.025, 0.012, 0.008, MT.dark, 0.75 + j * 0.16, 1.24, s * 0.38);
      c.rb(1.0, 0.03, 0.02, 0.01, CM("#e9e6dd"), 0.55, 1.36, s * 0.38);
      c.text("275", 0.3, 0.14, 0.32, 1.2, s * 0.384, s > 0 ? "+z" : "-z", { fg: "#f2efe6" });
    });
    /* grade frontal e faróis */
    var grl = c.rb(0.07, 0.62, 0.76, 0.04, paint, 1.88 + FX, 1.16, 0, { def: true });
    c.rb(0.03, 0.46, 0.56, 0.02, MT.housing, 1.915 + FX, 1.12, 0);
    for (var k = 0; k < 7; k++) c.rb(0.02, 0.022, 0.54, 0.006, MT.chrome, 1.93 + FX, 0.92 + k * 0.066, 0);
    c.rb(0.02, 0.06, 0.4, 0.01, CM("#e9e6dd"), 1.93 + FX, 1.42, 0);
    [1, -1].forEach(function (s) { c.rb(0.1, 0.16, 0.12, 0.03, paint, 1.84 + FX, 1.38, s * 0.32); ZG.headlight(c, { style: "rect", x: 1.9 + FX, y: 1.38, z: s * 0.32, w: 0.12, h: 0.12, d: 0.06, side: s }); });
    var hood = c.rb(hx1 - hx0, 0.12, 0.8, 0.06, paint, (hx0 + hx1) / 2, hy, 0, { taper: { sz: 0.94 }, def: true, sub: 0.15 });
    var hoodObjs = [hood, c.rb(hx1 - hx0 - 0.1, 0.012, 0.06, 0.005, CM("#e9e6dd"), (hx0 + hx1) / 2, hy + 0.062, 0)];
    ZG.hinge(c, hoodObjs, new V3(hx0, hy - 0.04, 0), { len: hx1 - hx0, open: 1.0, zw: 0.38 });
    ZG.engineBay(c, { x0: hx0 + 0.04, x1: hx1 - 0.04, zw: 0.32, floor: 0.98, top: hy - 0.08, motor: "diesel", col: col, turbo: false, label: "motor diesel de 4 cilindros, aspirado" });
    /* escapamento vertical (direita) e pré-filtro de ar (esquerda) saindo do capô */
    c.cyl(0.05, 0.06, 1.0, MT.trim, 1.3, 1.95, 0.24); c.cyl(0.07, 0.05, 0.1, MT.trim, 1.3, 2.47, 0.24); c.rb(0.16, 0.012, 0.16, 0.005, MT.trim, 1.3, 2.53, 0.24, { rot: [0, 0, 0.5] });
    c.cyl(0.05, 0.05, 0.5, dgray, 1.3, 1.75, -0.24); c.cyl(0.1, 0.1, 0.24, CM("#2a2c2e", { roughness: 0.3 }), 1.3, 2.1, -0.24); c.cyl(0.11, 0.11, 0.03, MT.trim, 1.3, 2.23, -0.24);
    /* painel, volante, plataforma, banco, alavancas */
    var nPosto = c.g.children.length;
    c.rb(0.22, 0.5, 0.6, 0.06, paint, -0.03, 1.42, 0, { def: true });
    c.rb(0.03, 0.2, 0.36, 0.02, MT.trim, -0.15, 1.58, 0); c.cyl(0.05, 0.05, 0.012, MT.gauge, -0.165, 1.6, -0.1, "x"); c.cyl(0.05, 0.05, 0.012, MT.gauge, -0.165, 1.6, 0.1, "x");
    ZG.steeringWheel(c, -0.38, 1.66, 0, { r: 0.2, tilt: 1.0, col: 0.42, mat: MT.trim });
    c.rb(1.0, 0.05, 0.94, 0.02, CM("#5c5f62", { metalness: 0.5 }), -0.7, 1.12, 0);
    ZG.seat(c, -1.0, 1.35, 0, { w: 0.5, h: 0.16, back: 0.44, lean: 0.12, mat: MT.seat, headrest: false });
    c.rb(0.3, 0.2, 0.3, 0.04, dgray, -1.0, 1.28, 0);
    [[0.25, 1], [0.38, -1]].forEach(function (p) { c.rod(new V3(-0.75, 1.15, p[1] * p[0]), new V3(-0.6, 1.7, p[1] * (p[0] + 0.05)), 0.015, MT.trim); c.sph(0.035, MT.postRed, -0.6, 1.72, p[1] * (p[0] + 0.05)); });
    /* posto do operador: banco, volante, painel e alavancas (sem a plataforma); o arco e o toldo têm zona própria */
    var posto = c.g.children.slice(nPosto).filter(function (o) { return !(o.isMesh && o.position.y < 1.16 && Math.abs(o.position.x + 0.7) < 0.01); });
    /* para-lamas traseiros com topo plano, lanternas e faróis de trabalho */
    [1, -1].forEach(function (s) {
      var fen = c.add(new THREE.CylinderGeometry(rR + 0.1, rR + 0.1, 0.5, 30, 2, true, PI / 2 - 0.1, PI + 0.2), paint, rx, rR, s * rz); fen.rotation.x = PI / 2; c.deform.push(fen);
      c.rb(1.0, 0.04, 0.52, 0.02, paint, rx + 0.05, rR * 2 + 0.12, s * rz, { def: true });
      c.rb(1.0, 0.36, 0.04, 0.02, paint, rx + 0.05, 1.3, s * (rz - 0.27), { def: true });
      ZG.taillight(c, { style: "vertical", x: rx - 0.55, y: rR * 2 - 0.05, z: s * (rz + 0.08), w: 0.1, h: 0.14, d: 0.05, side: s });
      /* farol de trabalho no para-lama: peça simples, para a zona dos faróis ficar só na grade */
      c.rb(0.07, 0.11, 0.13, 0.025, MT.trim, rx + 0.47, rR * 2 + 0.22, s * (rz + 0.13));
      c.rb(0.012, 0.085, 0.105, 0.01, MT.head, rx + 0.508, rR * 2 + 0.22, s * (rz + 0.13));
    });
    /* arco de proteção (EPCC) com toldo */
    var rops = [];
    [1, -1].forEach(function (s) {
      rops.push(c.rod(new V3(-1.32, 1.1, s * 0.62), new V3(-1.32, 2.62, s * 0.6), 0.045, MT.trim));
      rops.push(c.rod(new V3(-1.32, 1.6, s * 0.6), new V3(-1.32, 1.6, s * 0.32), 0.03, MT.trim));
    });
    rops.push(c.rod(new V3(-1.32, 2.62, -0.6), new V3(-1.32, 2.62, 0.6), 0.045, MT.trim));
    var can = c.rb(1.15, 0.06, 1.35, 0.03, CM("#e3dfd3", { roughness: 0.7 }), -0.88, 2.66, 0); rops.push(can);
    rops.push(c.rod(new V3(-0.32, 2.64, -0.6), new V3(-0.32, 2.64, 0.6), 0.02, MT.trim));
    [1, -1].forEach(function (s) { rops.push(c.rod(new V3(-1.32, 2.6, s * 0.6), new V3(-0.32, 2.62, s * 0.6), 0.02, MT.trim)); });
    /* engate de três pontos, barra de tração e TDP */
    [1, -1].forEach(function (s) { c.rod(new V3(-1.3, 0.72, s * 0.32), new V3(-1.95, 0.5, s * 0.42), 0.035, dgray); c.rod(new V3(-1.35, 1.0, s * 0.3), new V3(-1.55, 0.7, s * 0.35), 0.02, MT.steel); c.sph(0.05, MT.steel, -1.95, 0.5, s * 0.42); });
    c.rod(new V3(-1.3, 1.15, 0), new V3(-1.9, 0.98, 0), 0.03, dgray);
    c.rb(0.7, 0.06, 0.16, 0.02, dgray, -1.55, 0.42, 0); c.cyl(0.035, 0.035, 0.25, MT.steel, -1.4, 0.62, 0, "x"); c.rb(0.2, 0.12, 0.22, 0.03, CM("#c9a227"), -1.38, 0.68, 0);
    Object.assign(m, { L: 3.75, W: 2.0, front: 1.88, rear: -1.87, clear: 0.42, belt: 1.45, top: 2.7, bodyH: 0.9, roof: { x0: -1.4, x1: -0.35, w: 1.3, y: 2.7 } });
    var ghost = c.rb(1.0, 1.25, 1.2, 0.05, MT.hole, -0.85, 2.0, 0); ghost.visible = false; ghost.userData.ghost = true; c.glass.push(ghost);
    c.part("tanque", "Tanque de diesel", null, new V3(-0.1, 1.45, 0), 0.7);
    void can; void grl;
    /* zonas: o arco de proteção com o toldo é peça que entorta e sai; escapamento vertical à parte */
    c.zone("posto", "Posto do operador", [-1.45, -0.05, 1.05, 2.0, -0.46, 0.46], posto, { type: "peca", dir: [0, -1, 0], fxKey: "cabine", who: "o tratorista", anchor: [-0.7, 1.15, 0] });
    c.zone("arco", "Arco de proteção e toldo", [-1.45, -0.2, 1.55, 2.78, -0.75, 0.75], rops, { type: "peca", fxKey: "cabine", who: "o tratorista", anchor: [-1.32, 1.6, 0], w: 0.6 });
    m.armor = function (c) {
      var S = ZG.STEELM;
      /* lâmina frontal (tipo pá) em braços, gaiola de tela ao redor do operador, galões nos para-lamas */
      c.rb(0.1, 0.72, 2.2, 0.04, S, 2.55, 0.5, 0, { rot: [0, 0, -0.25] });
      c.rb(0.06, 0.06, 2.24, 0.02, MT.steel, 2.66, 0.16, 0);
      [1, -1].forEach(function (s) { c.rod(new V3(1.2, 0.72, s * 0.45), new V3(2.5, 0.55, s * 0.6), 0.05, S); c.rod(new V3(1.7, 1.0, s * 0.42), new V3(2.45, 0.7, s * 0.55), 0.035, MT.steel); });
      [1, -1].forEach(function (s) { for (var x = -1.3; x <= -0.32; x += 0.14) c.rod(new V3(x, 1.65, s * 0.62), new V3(x, 2.6, s * 0.62), 0.012, S); c.rod(new V3(-1.32, 1.65, s * 0.62), new V3(-0.32, 1.65, s * 0.62), 0.02, S); c.rod(new V3(-0.32, 1.65, s * 0.62), new V3(-0.32, 2.62, s * 0.6), 0.025, S); });
      for (var y = 1.7; y < 2.6; y += 0.14) c.rod(new V3(-1.36, y, -0.6), new V3(-1.36, y, 0.6), 0.012, S);
      ZG.jerry(c, -0.75, 1.82, 0.85, "#8e2a20"); ZG.jerry(c, -1.15, 1.82, -0.85, "#3e5a34");
      roofLamp(c, -0.3, 2.78, 0.4); roofLamp(c, -0.3, 2.78, -0.4);
    };
  });
})(window.ZG);
