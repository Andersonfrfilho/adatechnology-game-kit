import type { FleetContext } from '../context'

/* Motorcycles added after the first batch (group F). Uses only the kit API.
   Scooter, naked, sport, cruiser and cargo motorcycle (parody names).
   The common motorcycle parts (superellipse loft, fork, handlebar, indicators, plate) are local copies of those in the first motorcycles-and-cars file,
   because there they live inside the file closure. New local helpers: fatWheel (closed-disc wheel with a wide tyre),
   moreSpokes (extra spokes on a core alloy wheel), drumHub (drum brake hub), grab (parts created in a stretch). */
export function installMotorcyclesExtra(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const trl = fx.t

  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial,
    G = kit.geo

  /* ================= local materials ================= */
  const RUBBER = CM('#131313', { roughness: 0.9 })
  const ENG = CM('#9a9ea2', { metalness: 0.65, roughness: 0.38 })
  const ENGD = CM('#2c2e31', { metalness: 0.45, roughness: 0.5 })
  const FIN = CM('#7c8084', { metalness: 0.6, roughness: 0.45 })
  const EXH = CM('#b5b9bc', { metalness: 0.9, roughness: 0.25 })
  const HEAT = CM('#2a2b2d', { metalness: 0.5, roughness: 0.45 })
  const BLK = CM('#151618', { roughness: 0.55 })
  const SATIN = CM('#3b3e42', { roughness: 0.5, metalness: 0.3 })
  const SEAT = CM('#1b1c1e', { roughness: 0.8 })
  const DRL = CM('#f2f7ff', { emissive: '#d6e8ff', emissiveIntensity: 1.7, roughness: 0.2 })
  const REDLED = CM('#e2301f', { emissive: '#e8200f', emissiveIntensity: 1.35, roughness: 0.25 })
  const SMOKEG = CM('#2a3036', {
    roughness: 0.05,
    metalness: 0.2,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  /* ================= local geometry (copy of the first motorcycles-and-cars file) ================= */
  /* superellipse loft. x axis: stations [x, top, base, width, p, zc]; y axis: [y, xFront, xRear, width, p, zc] */
  function sloft(st: any, o: any) {
    o = o || {}
    if (kit.lod.on) o = Object.assign({}, o, { seg: Math.max(kit.lod.minLoftSegments, Math.round((o.seg || 24) * kit.lod.loftSegmentFraction)) })
    const seg = o.seg || 24,
      pos: any = [],
      idx = [],
      ring = seg + 1,
      axisY = o.axis === 'y'
    st.forEach(function (s: any) {
      const a0 = s[1],
        b0 = s[2],
        cc = (a0 + b0) / 2,
        hh = Math.abs(a0 - b0) / 2,
        w = s[3] / 2,
        e = 2 / (s[4] || o.p || 2.4),
        zc = s[5] || 0
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * PI * 2,
          cs = Math.cos(a),
          sn = Math.sin(a)
        const u = cc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), e),
          z = zc + w * Math.sign(cs) * Math.pow(Math.abs(cs), e)
        if (axisY) pos.push(u, s[0], z)
        else pos.push(s[0], u, z)
      }
    })
    for (let i = 0; i < st.length - 1; i++)
      for (let k = 0; k < seg; k++) {
        const A = i * ring + k,
          B = A + ring
        if (axisY) idx.push(A, B, A + 1, A + 1, B, B + 1)
        else idx.push(A, A + 1, B, A + 1, B + 1, B)
      }
    ;[0, st.length - 1].forEach(function (si, e) {
      const s = st[si]
      if (s[3] < 0.004) return
      const ci = pos.length / 3,
        cc = (s[1] + s[2]) / 2
      if (axisY) pos.push(cc, s[0], s[5] || 0)
      else pos.push(s[0], cc, s[5] || 0)
      for (let k = 0; k < seg; k++) {
        const a = si * ring + k,
          flip = (e === 0) !== axisY
        if (flip) idx.push(ci, a + 1, a)
        else idx.push(ci, a, a + 1)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    return G.crease(g.toNonIndexed(), o.crease || 60)
  }
  function body(c: any, st: any, mat: any, o?: any) {
    o = o || {}
    const m = c.add(sloft(st, o), mat, 0, 0, 0, o.parent)
    if (o.def !== false) c.deform.push(m)
    return m
  }
  /* half width of the loft (x axis) at position x and height y: to glue texts and trim to the side */
  function loftHalf(st: any, x: any, y: any) {
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i],
        b = st[i + 1]
      if ((a[0] - x) * (b[0] - x) > 0) continue
      const t = (x - a[0]) / (b[0] - a[0] || 1),
        top = a[1] + (b[1] - a[1]) * t,
        bot = a[2] + (b[2] - a[2]) * t,
        w = a[3] + (b[3] - a[3]) * t,
        pp = (a[4] || 2.4) + ((b[4] || 2.4) - (a[4] || 2.4)) * t
      const h = (y - (top + bot) / 2) / ((top - bot) / 2)
      if (Math.abs(h) >= 1) return 0
      return (w / 2) * Math.pow(1 - Math.pow(Math.abs(h), pp), 1 / pp)
    }
    return 0
  }
  /* half width of a loft on the y axis at height y and position x (stations [y, xFront, xRear, width, p]) */
  function yHalf(st: any, y: any, x: any) {
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i],
        b = st[i + 1]
      if ((a[0] - y) * (b[0] - y) > 0) continue
      const t = (y - a[0]) / (b[0] - a[0] || 1),
        f = a[1] + (b[1] - a[1]) * t,
        r = a[2] + (b[2] - a[2]) * t,
        w = a[3] + (b[3] - a[3]) * t,
        pp = (a[4] || 2.4) + ((b[4] || 2.4) - (a[4] || 2.4)) * t
      const h = (x - (f + r) / 2) / (Math.abs(f - r) / 2)
      if (Math.abs(h) >= 1) return 0
      return (w / 2) * Math.pow(1 - Math.pow(Math.abs(h), pp), 1 / pp)
    }
    return 0
  }
  /* fender arch over the wheel. cx, cy centre; r inner radius; a0..a1 angles (0 = front); w width; t bulge */
  function fenderGeo(cx: any, cy: any, r: any, a0: any, a1: any, w: any, t: any, zc: any, o?: any) {
    o = o || {}
    const na = kit.lod.on ? 10 : o.na || 22,
      nu = kit.lod.on ? 5 : 10,
      pos = [],
      idx = []
    for (let i = 0; i <= na; i++) {
      const a = a0 + ((a1 - a0) * i) / na,
        ca = Math.cos(a),
        sa = Math.sin(a)
      for (let j = 0; j <= nu; j++) {
        const u = (j / nu) * 2 - 1,
          bulge = t * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), o.p || 3)), 1 / (o.p || 3)),
          rr = r + bulge - (o.drop ? o.drop * Math.pow(Math.abs(u), 4) : 0)
        pos.push(cx + ca * rr, cy + sa * rr, zc + (u * w) / 2)
      }
    }
    for (let i2 = 0; i2 < na; i2++)
      for (let j2 = 0; j2 < nu; j2++) {
        const A = i2 * (nu + 1) + j2,
          B = A + nu + 1
        idx.push(A, B, A + 1, A + 1, B, B + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    return G.crease(g.toNonIndexed(), 70)
  }
  function fender(c: any, cx: any, cy: any, r: any, a0: any, a1: any, w: any, t: any, mat: any, o?: any) {
    const f = c.add(fenderGeo(cx, cy, r, a0, a1, w, t, 0, o), mat, 0, 0, 0)
    c.deform.push(f)
    return f
  }
  function lamp(c: any, o: any) {
    const L = kit.headlight(c, o)
    if (o.roll) L.group.rotation.x = o.roll
    if (o.pitch) L.group.rotation.z = o.pitch
    return L
  }
  function drlOn(L: any, w: any, h: any, y: any, d: any, z?: any) {
    const m = new THREE.Mesh(G.roundedBox(0.01, h, w, Math.min(0.005, h * 0.4)), DRL)
    m.position.set((d || 0.06) / 2 + 0.004, y || 0, z || 0)
    m.castShadow = false
    L.group.add(m)
    L.inner.push(m)
    return m
  }
  function fork(c: any, top: any, axle: any, zg: any, r: any, up: any, low: any, o?: any) {
    o = o || {}
    ;[1, -1].forEach(function (s) {
      const a = new V3(top[0], top[1], s * zg),
        b = new V3(axle[0], axle[1], s * zg),
        mid = a.clone().lerp(b, o.split || 0.5)
      c.rod(a, mid, r, up, { seg: 12 })
      c.rod(mid.clone().lerp(a, 0.06), b, r * (o.lowK || 1.35), low, { seg: 12 })
      if (o.gaiter) c.rod(mid.clone().lerp(a, 0.25), mid.clone().lerp(b, 0.1), r * 1.6, RUBBER, { seg: 10 })
    })
    c.roundBox(0.1, 0.035, zg * 2 + 0.08, 0.012, o.clamp || MT.trim, top[0] - 0.01, top[1] - 0.02, 0, {
      rot: [0, 0, Math.atan2(axle[0] - top[0], top[1] - axle[1])],
    })
  }
  function handlebar(c: any, x: any, y: any, half: any, o: any) {
    o = o || {}
    const mat = o.mat || MT.trim,
      rise = o.rise || 0.03,
      back = o.back || 0.06,
      n0 = c.vehicle.children.length
    c.deform.push(
      c.tube(
        [
          [x - back, y + rise, -half],
          [x - back * 0.3, y + rise * 0.6, -half * 0.55],
          [x, y, 0],
          [x - back * 0.3, y + rise * 0.6, half * 0.55],
          [x - back, y + rise, half],
        ],
        o.r || 0.012,
        mat,
        { seg: 30 },
      ),
    )
    ;[1, -1].forEach(function (s) {
      c.deform.push(c.cylinder(0.019, 0.019, 0.13, RUBBER, x - back, y + rise, s * (half - 0.05), 'z'))
      c.roundBox(0.13, 0.012, 0.02, 0.005, MT.steel, x - back + 0.05, y + rise - 0.01, s * (half - 0.1), { rot: [0, s * 0.35, 0] })
      c.roundBox(0.05, 0.045, 0.06, 0.012, MT.trim, x - back + 0.01, y + rise, s * (half - 0.17))
      if (o.mirrors !== false) {
        const mz = s * (half - 0.14),
          stalk = new V3(x - back + 0.02, y + rise + (o.stalk || 0.2), mz + s * (o.mOut || 0.06))
        c.rod(new V3(x - back + 0.01, y + rise + 0.02, mz), stalk, 0.006, MT.trim, { seg: 6 })
        c.roundBox(0.03, o.mH || 0.07, o.mW || 0.12, 0.025, MT.trim, stalk.x, stalk.y + 0.02, stalk.z + s * 0.02, { def: true })
        c.roundBox(
          0.006,
          (o.mH || 0.07) - 0.015,
          (o.mW || 0.12) - 0.02,
          0.01,
          MT.chrome,
          stalk.x - 0.017,
          stalk.y + 0.02,
          stalk.z + s * 0.02,
        )
      }
      if (o.guards)
        c.deform.push(
          c.tube(
            [
              [x - back + 0.02, y + rise, s * (half - 0.2)],
              [x + 0.08, y + rise + 0.01, s * (half - 0.08)],
              [x - back + 0.02, y + rise - 0.01, s * (half + 0.01)],
            ],
            0.02,
            o.guards,
            { seg: 16 },
          ),
        )
    })
    return c.vehicle.children.slice(n0)
  }
  function blinker(c: any, x: any, y: any, z: any, front: any, o?: any) {
    o = o || {}
    if (o.flush) {
      const f = c.roundBox(0.03, 0.025, 0.05, 0.01, MT.amber, x, y, z, { rot: [0, 0, 0] })
      f.castShadow = false
      return f
    }
    c.rod(new V3(x, y, z * 0.55), new V3(x, y, z), 0.008, MT.trim, { seg: 6 })
    const b = c.sphere(o.r || 0.026, MT.amber, x + (front ? 0.012 : -0.012), y, z, 1.5, 0.9, 0.9)
    b.castShadow = false
    return b
  }
  function plateMoto(c: any, x: any, y: any, txt?: any) {
    c.roundBox(0.02, 0.15, 0.2, 0.008, MT.trim, x + 0.012, y, 0)
    c.text(txt || kit.config.plate.slice(0, 5), 0.2, 0.135, x, y, 0, '-x', {
      w: 300,
      h: 220,
      bg: '#f2f2ee',
      band: '#1f4fa3',
      fg: '#151515',
      size: 0.42,
      font: "'IBM Plex Mono', monospace",
    })
  }
  /* air-cooled single-cylinder engine (crankcase, side covers, inclined finned cylinder, head) */
  function singleEngine(c: any, o: any) {
    const x = o.x,
      y = o.y,
      tilt = o.tilt || 0.3,
      fin = o.fin || FIN,
      k = o.k || 1,
      eng = o.mat || ENG,
      n = o.fins || 7
    c.roundBox(0.38 * k, 0.26 * k, 0.24, 0.07, eng, x - 0.02, y, 0, { def: true })
    c.sphere(0.11 * k, eng, x - 0.04, y - 0.01, 0.12, 1.1, 1.0, 0.36)
    c.sphere(0.1 * k, o.cover || ENGD, x - 0.08, y, -0.12, 1.0, 1.0, 0.36)
    const cx = x + 0.1 * k,
      cy = y + 0.13 * k,
      len = 0.22 * k
    for (let f = 0; f < n; f++) {
      const t = f / (n - 1),
        px = cx + Math.sin(tilt) * t * len,
        py = cy + Math.cos(tilt) * t * len
      c.roundBox((0.2 - t * 0.02) * k, 0.014, 0.22 - t * 0.02, 0.006, fin, px, py, 0, { rot: [0, 0, -tilt] })
    }
    c.roundBox(0.12 * k, 0.2 * k, 0.12, 0.03, eng, cx + (Math.sin(tilt) * len) / 2, cy + (Math.cos(tilt) * len) / 2, 0, {
      rot: [0, 0, -tilt],
    })
    c.roundBox(0.16 * k, 0.06, 0.18, 0.025, eng, cx + Math.sin(tilt) * (len + 0.04), cy + Math.cos(tilt) * (len + 0.04), 0, {
      rot: [0, 0, -tilt],
    })
    return { exh: new V3(cx + Math.sin(tilt) * len * 0.9 + 0.06, cy + Math.cos(tilt) * len * 0.45, 0.06) }
  }
  function jerryFlat(c: any, x: any, y: any, z: any, col: any) {
    c.roundBox(0.4, 0.15, 0.28, 0.04, CM(col, { roughness: 0.5 }), x, y, z, { def: true })
    c.cylinder(0.022, 0.022, 0.05, MT.trim, x + 0.18, y + 0.06, z + 0.1)
    ;[-0.1, 0.1].forEach(function (dx) {
      c.roundBox(0.03, 0.155, 0.29, 0.005, CM('#1b1c1e'), x + dx, y + 0.002, z)
    })
  }
  function roofLamp(c: any, x: any, y: any, z: any) {
    c.cylinder(0.07, 0.055, 0.1, MT.steel, x, y, z, 'x')
    c.cylinder(0.06, 0.06, 0.012, MT.head, x + 0.055, y, z, 'x')
  }
  function bikeMeta(c: any, o: any) {
    Object.assign(c.meta, { kind: 'bike', clearance: 0.25, bodyHeight: 0.6, belt: 0.88 }, o)
  }
  /* meshes created since mark n0 (without wheels, headlights, taillights or glass, which already have their own zone) */
  function grab(c: any, n0: any) {
    const Ls = new Set()
    ;(c.lights || []).forEach(function (L: any) {
      if (L.group) Ls.add(L.group)
    })
    return c.vehicle.children.slice(n0).filter(function (o: any) {
      return c.wheels.indexOf(o) < 0 && !Ls.has(o) && !o.userData.glass
    })
  }
  /* extra spokes on a core alloy wheel (spokedWheel cast has 5): n spokes from angle a0 */
  function moreSpokes(g: any, n: any, a0: any, mat?: any, thick?: any) {
    const r = g.userData.r,
      tire = g.children[0].geometry.parameters.tube,
      sl = r - tire * 2
    for (let j = 0; j < n; j++) {
      const a = a0 + (j / n) * PI * 2,
        sp = new THREE.Mesh(G.roundedBox(sl, thick || 0.022, 0.022, 0.008), mat || MT.trim)
      sp.position.set((Math.cos(a) * sl) / 2, (Math.sin(a) * sl) / 2, 0)
      sp.rotation.z = a
      g.add(sp)
    }
  }
  /* drum brake hub (work motorcycle) */
  function drumHub(g: any, r: any, side: any) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 20), ENG)
    d.rotation.x = PI / 2
    d.position.z = (side || 1) * 0.02
    g.add(d)
    const lev = new THREE.Mesh(G.roundedBox(0.09, 0.015, 0.01, 0.004), BLK)
    lev.position.set(-r * 0.6, r * 0.6, (side || 1) * 0.06)
    lev.rotation.z = 0.7
    g.add(lev)
  }

  /* closed-disc wheel (Lakester) with a wide low-profile tyre, made by lathe. Registers as a core wheel. */
  function fatWheel(c: any, x: any, r: any, w: any, rimR: any, o: any) {
    o = o || {}
    const g = new THREE.Group()
    g.position.set(x, r, 0)
    c.vehicle.add(g)
    const hw = w / 2,
      rr = Math.min(0.045, (r - rimR) * 0.55),
      P = []
    P.push(new THREE.Vector2(rimR, -hw * 0.86))
    for (let i = 0; i <= 8; i++) {
      const a = -PI / 2 + ((i / 8) * PI) / 2
      P.push(new THREE.Vector2(r - rr + Math.cos(a) * rr, -hw + rr + Math.sin(a) * rr))
    }
    for (let j = 0; j <= 8; j++) {
      const b = ((j / 8) * PI) / 2
      P.push(new THREE.Vector2(r - rr + Math.cos(b) * rr, hw - rr + Math.sin(b) * rr))
    }
    P.push(new THREE.Vector2(rimR, hw * 0.86))
    const tg = new THREE.LatheGeometry(P, 48)
    tg.rotateX(PI / 2)
    const tire = new THREE.Mesh(tg, MT.rubber)
    tire.castShadow = true
    g.add(tire)
    /* tread: shallow grooves */
    const gr = []
    for (let k = 0; k < 40; k++) {
      const aa = (k / 40) * PI * 2,
        gg = G.roundedBox(0.006, 0.012, w * 0.6, 0.002)
      gg.applyMatrix4(new THREE.Matrix4().makeRotationZ(aa).setPosition(Math.cos(aa) * (r - 0.0035), Math.sin(aa) * (r - 0.0035), 0))
      gr.push(gg)
    }
    tire.add(
      new THREE.Mesh(G.merge(gr), CM('#0b0b0b', { roughness: 1 })),
    ) /* tyre child: goes away along with the tyre when it is torn off */
    /* rim and slightly concave closed disc, with the shallow slot pattern and the hub */
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.014, 8, 48), MT.chrome)
    g.add(rim)
    const rim2 = rim.clone()
    g.add(rim2)
    rim.position.z = hw * 0.82
    rim2.position.z = -hw * 0.82
    const discMat = o.disc || CM('#c3c7ca', { metalness: 0.55, roughness: 0.32 })
    ;[1, -1].forEach(function (s) {
      const dg = new THREE.CylinderGeometry(rimR, rimR * 0.4, 0.02, 40)
      dg.rotateX((s * PI) / 2)
      const d = new THREE.Mesh(dg, discMat)
      d.position.z = s * hw * 0.72
      g.add(d)
      for (let q = 0; q < 12; q++) {
        const a2 = (q / 12) * PI * 2,
          sl = new THREE.Mesh(G.roundedBox(rimR * 0.42, 0.016, 0.006, 0.005), o.slot || CM('#1c1e21', { metalness: 0.5, roughness: 0.4 }))
        sl.position.set(Math.cos(a2) * rimR * 0.62, Math.sin(a2) * rimR * 0.62, s * (hw * 0.72 + 0.006))
        sl.rotation.z = a2
        g.add(sl)
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), CM('#202225', { metalness: 0.5, roughness: 0.4 }))
      hub.rotation.x = PI / 2
      hub.position.z = s * (hw * 0.72 + 0.012)
      g.add(hub)
    })
    if (o.disc2) {
      const dsk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.008, 28), MT.steel)
      dsk.rotation.x = PI / 2
      dsk.position.z = -(hw * 0.72 + 0.03)
      g.add(dsk)
    }
    g.userData.r = r
    c.wheels.push(g)
    c.part('wheel', o.label || (x > 0 ? trl('labels.front_tire') : trl('labels.rear_tire')), g, new V3(x, r, 0), 0.9)
    return g
  }

  /* zones: the automatic motorcycle ones already exist; here we only hand the right parts to each */
  function zoneParts(c: any, map: any) {
    Object.keys(map).forEach(function (id) {
      if (map[id] && map[id].length) c.zone(id, null, null, map[id])
    })
    c.zone(
      'taillight_center',
      trl('labels.taillight'),
    ) /* the automatic one calls the central taillight "Light bar", which does not fit a motorcycle */
  }

  /* ================= Scooter (Biz 125 type) ================= */
  /* Reference: Honda Biz 125 2018+ (Honda sheet, via motoragora.com.br, checked in 2026)
     Real measurements: length 1.894 · width 0.714 · height 1.085 · wheelbase 1.264 · seat height 0.753 · clearance 0.131
     · tyres 60/100-17 (diameter 0.552) and 80/100-14 (diameter 0.516) · overhangs about 0.30 / 0.33 (from memory) · track: a single line.
     Signature traits:
     front: wide trapezoid headlight high on the front shield (not on the handlebar), indicators recessed in the shield ends;
     handlebar with a plastic cover and a panel in the middle.
     side: "underbone" frame with no tank between the legs (low step-through for the feet); wide leg shield;
     engine lying under the floor with the cylinder pointing forward; 17-inch front wheel and smaller 14-inch rear;
     tall long rear fairing under the seat (storage); low exhaust on the right with a guard.
     rear: horizontal taillight at the tip of the fairing, grab handle, low plate on the fender.
     from above: wide shield at the front, thin waist at the footwell, wide seat behind. */
  fx.register(
    {
      key: 'step_through_scooter',
      group: 'motorcycles',
      name: trl('vehicles.step_through_scooter.name'),
      inspired: trl('vehicles.step_through_scooter.inspired'),
      article: trl('vehicles.step_through_scooter.article'),
      category: trl('vehicles.step_through_scooter.category'),
      fuel: 'flex',
      description: trl('vehicles.step_through_scooter.description'),
      mass: 104,
      noise: 55,
      seats: trl('vehicles.step_through_scooter.seats'),
      capacity: trl('vehicles.step_through_scooter.capacity'),
      efficiency: trl('vehicles.step_through_scooter.efficiency'),
      range: trl('vehicles.step_through_scooter.range'),
      maxSpeed: 95,
      skill: trl('vehicles.step_through_scooter.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#b3151b',
        col = c.paint(hex),
        wht = c.paint('#ecebe6'),
        blk = BLK
      const XF = 0.632,
        XR = -0.632,
        RF = 0.276,
        RR = 0.258
      kit.spokedWheel(c, XF, RF, 0.03, { cast: true, disc: true, label: trl('labels.front_tire') })
      const rw = kit.spokedWheel(c, XR, RR, 0.04, { cast: true, label: trl('labels.rear_tire') })
      drumHub(rw, 0.07, -1)
      const Z = { fairing: [], handlebar: [], fuel_tank: [], seat: [], engine: [], exhaust: [] }
      let n0
      /* engine lying under the floor: crankcase, finned cylinder pointing forward, variator cover on the left */
      n0 = c.vehicle.children.length
      c.roundBox(0.3, 0.2, 0.24, 0.06, ENG, -0.06, 0.29, 0, { def: true })
      c.sphere(0.09, ENGD, -0.08, 0.29, -0.12, 1.1, 1.0, 0.4)
      c.sphere(0.08, ENG, -0.04, 0.29, 0.12, 1.0, 1.0, 0.36)
      for (let f = 0; f < 6; f++)
        c.roundBox(0.014, 0.15 - f * 0.006, 0.17 - f * 0.006, 0.005, FIN, 0.12 + f * 0.028, 0.29 + f * 0.008, 0, { rot: [0, 0, -0.12] })
      c.roundBox(0.2, 0.1, 0.11, 0.03, ENG, 0.17, 0.3, 0, { rot: [0, 0, -0.12] })
      c.roundBox(0.07, 0.12, 0.13, 0.025, ENG, 0.29, 0.33, 0, { rot: [0, 0, -0.12] })
      c.roundBox(0.16, 0.035, 0.03, 0.01, BLK, 0.0, 0.17, -0.14)
      Z.engine = grab(c, n0)
      /* "underbone" frame: spine that goes down from the neck to the engine and up to the seat */
      c.tube(
        [
          [0.43, 0.88, 0],
          [0.33, 0.62, 0],
          [0.22, 0.42, 0],
          [0.0, 0.38, 0],
          [-0.22, 0.48, 0],
          [-0.5, 0.64, 0],
          [-0.86, 0.68, 0],
        ],
        0.022,
        blk,
        { seg: 40 },
      )
      c.cylinder(0.03, 0.03, 0.14, blk, 0.44, 0.88, 0).rotation.z = -0.3
      /* fork and painted front fender */
      fork(c, [0.45, 0.86], [XF, RF], 0.07, 0.017, MT.chrome, SATIN, { split: 0.45 })
      const fendF = fender(c, XF, RF, RF + 0.025, 0.12, 2.15, 0.1, 0.018, col)
      /* front shield (with the headlight at the top) and the leg shield behind it */
      n0 = c.vehicle.children.length
      const SH = [
        [0.34, 0.43, 0.31, 0.3, 2.6],
        [0.44, 0.47, 0.33, 0.48, 3],
        [0.58, 0.5, 0.36, 0.52, 3],
        [0.72, 0.53, 0.39, 0.48, 2.8],
        [0.86, 0.565, 0.42, 0.42, 2.6],
        [0.95, 0.56, 0.43, 0.32, 2.4],
        [1.0, 0.53, 0.44, 0.18, 2.2],
      ]
      body(c, SH, col, { axis: 'y' })
      body(
        c,
        [
          [0.34, 0.36, 0.29, 0.28, 2.6],
          [0.46, 0.38, 0.31, 0.46, 3],
          [0.6, 0.41, 0.34, 0.5, 3],
          [0.74, 0.43, 0.37, 0.46, 2.8],
          [0.88, 0.45, 0.39, 0.38, 2.6],
          [0.96, 0.45, 0.41, 0.24, 2.2],
        ],
        blk,
        { axis: 'y' },
      )
      /* black headlight frame and central trim of the shield */
      body(
        c,
        [
          [0.83, 0.57, 0.5, 0.3, 3],
          [0.94, 0.565, 0.5, 0.3, 3],
        ],
        blk,
        { axis: 'y', def: false },
      )
      c.roundBox(0.02, 0.3, 0.05, 0.01, wht, 0.52, 0.6, 0, { rot: [0, 0, 0.25] })
      ;[1, -1].forEach(function (s) {
        blinker(c, 0.53, 0.86, s * 0.185, true, { flush: true })
      })
      Z.fairing = grab(c, n0).concat([fendF])
      const HL = lamp(c, {
        style: 'wedge',
        x: 0.565,
        y: 0.885,
        z: 0,
        w: 0.24,
        h: 0.085,
        d: 0.06,
        side: 1,
        label: trl('labels.headlight'),
        pitch: -0.1,
      })
      drlOn(HL, 0.2, 0.01, 0.034, 0.06)
      /* low central tunnel (footwell) */
      body(
        c,
        [
          [0.36, 0.47, 0.33, 0.12, 2.4],
          [0.2, 0.45, 0.33, 0.16, 2.4],
          [0.02, 0.47, 0.33, 0.2, 2.4],
          [-0.12, 0.54, 0.36, 0.26, 2.4],
        ],
        col,
      )
      /* long rear fairing with the storage (the tank sits under the seat) */
      n0 = c.vehicle.children.length
      const RB = [
        [-0.04, 0.66, 0.46, 0.16, 2.2],
        [-0.1, 0.7, 0.42, 0.26, 2.4],
        [-0.18, 0.73, 0.4, 0.31, 2.6],
        [-0.42, 0.74, 0.44, 0.32, 2.6],
        [-0.66, 0.74, 0.52, 0.27, 2.6],
        [-0.84, 0.735, 0.58, 0.18, 2.4],
        [-0.94, 0.72, 0.62, 0.08, 2.2],
      ]
      body(c, RB, col)
      ;[1, -1].forEach(function (s) {
        const x = -0.3,
          y = 0.6,
          hz = loftHalf(RB, x, y) + 0.004
        c.text(trl('texts.bis_125'), 0.2, 0.05, x, y, s * hz, s > 0 ? '+z' : '-z', { fg: '#f2f0ea', size: 0.85 })
        body(
          c,
          [
            [-0.1, 0.52, 0.44, 0.02, 2, s * 0.12],
            [-0.3, 0.5, 0.45, 0.03, 2, s * 0.16],
            [-0.6, 0.56, 0.52, 0.02, 2, s * 0.13],
          ],
          wht,
          { p: 2 },
        )
      })
      Z.fuel_tank = grab(c, n0)
      n0 = c.vehicle.children.length
      body(
        c,
        [
          [0.0, 0.755, 0.705, 0.18],
          [-0.12, 0.76, 0.71, 0.28],
          [-0.45, 0.765, 0.715, 0.3],
          [-0.66, 0.77, 0.72, 0.24],
          [-0.73, 0.765, 0.725, 0.12],
        ],
        SEAT,
        { p: 3 },
      )
      c.tube(
        [
          [-0.58, 0.775, -0.14],
          [-0.86, 0.77, -0.1],
          [-0.92, 0.765, 0],
          [-0.86, 0.77, 0.1],
          [-0.58, 0.775, 0.14],
        ],
        0.014,
        BLK,
        { seg: 24 },
      )
      /* tail: rear fender with the plate */
      body(
        c,
        [
          [-0.82, 0.62, 0.55, 0.14],
          [-0.92, 0.58, 0.47, 0.13],
          [-0.96, 0.53, 0.42, 0.1],
        ],
        blk,
      )
      plateMoto(c, -0.962, 0.47)
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.03, 0.025, 0.04, 0.01, MT.amber, -0.935, 0.675, s * 0.1)
      })
      Z.seat = grab(c, n0)
      kit.taillight(c, { style: 'bar', x: -0.94, y: 0.68, z: 0, w: 0.13, h: 0.05, d: 0.05, side: 1, label: trl('labels.taillight') })
      /* swingarm, chain guard, shock absorbers, footpegs, stand */
      ;[1, -1].forEach(function (s) {
        c.rod(new V3(-0.12, 0.3, s * 0.08), new V3(XR, RR, s * 0.08), 0.02, blk)
        c.rod(new V3(XR + 0.06, RR + 0.03, s * 0.11), new V3(-0.5, 0.64, s * 0.12), 0.013, MT.chrome)
        c.rod(new V3(XR + 0.08, RR + 0.07, s * 0.11), new V3(-0.52, 0.56, s * 0.12), 0.024, CM('#2a2b2e', { roughness: 0.5 }))
        c.roundBox(0.11, 0.02, 0.05, 0.01, RUBBER, 0.08, 0.24, s * 0.17)
        c.roundBox(0.08, 0.02, 0.04, 0.01, RUBBER, -0.35, 0.32, s * 0.15)
      })
      c.roundBox(0.5, 0.07, 0.03, 0.02, blk, -0.36, 0.28, -0.11, { rot: [0, 0, 0.05] })
      c.rod(new V3(-0.05, 0.22, -0.12), new V3(-0.14, 0.04, -0.22), 0.011, blk)
      /* centre stand folded (the lowest point) */
      c.roundBox(0.16, 0.02, 0.2, 0.008, blk, -0.08, 0.142, 0)
      ;[1, -1].forEach(function (s) {
        c.rod(new V3(-0.02, 0.2, s * 0.1), new V3(-0.12, 0.145, s * 0.1), 0.01, blk)
      })
      /* low exhaust on the right, with a guard */
      n0 = c.vehicle.children.length
      c.tube(
        [
          [0.3, 0.3, 0.04],
          [0.32, 0.2, 0.08],
          [0.1, 0.15, 0.12],
          [-0.25, 0.2, 0.15],
          [-0.36, 0.26, 0.15],
        ],
        0.017,
        EXH,
        { seg: 30 },
      )
      c.cylinder(0.05, 0.04, 0.38, EXH, -0.56, 0.3, 0.15).rotation.z = -PI / 2 + 0.12
      c.roundBox(0.28, 0.07, 0.025, 0.025, HEAT, -0.52, 0.31, 0.2, { rot: [0, 0, 0.12] })
      Z.exhaust = grab(c, n0)
      /* handlebar cover with the panel; short-grip handlebar; mirrors */
      n0 = c.vehicle.children.length
      body(
        c,
        [
          [0.32, 1.035, 0.97, 0.16, 2.4],
          [0.38, 1.065, 0.95, 0.46, 2.6],
          [0.49, 1.055, 0.95, 0.46, 2.6],
          [0.55, 1.02, 0.96, 0.2, 2.2],
        ],
        col,
      )
      c.roundBox(0.12, 0.012, 0.18, 0.01, CM('#121518', { roughness: 0.25, metalness: 0.3 }), 0.41, 1.066, 0, { rot: [0, 0, 0.25] })
      c.roundBox(0.06, 0.014, 0.08, 0.006, MT.gauge, 0.41, 1.07, 0, { rot: [0, 0, 0.25] })
      handlebar(c, 0.44, 1.0, 0.345, { rise: 0.01, back: 0.05, stalk: 0.16 })
      Z.handlebar = grab(c, n0)
      zoneParts(c, Z)
      c.part('engine', trl('labels.engine_under_the_floor'), null, new V3(0.0, 0.3, 0), 0.7)
      c.part('fuel_tank', trl('labels.tank_under_the_seat'), null, new V3(-0.4, 0.62, 0), 0.6)
      c.part('fairing', trl('labels.front_shield'), null, new V3(0.5, 0.7, 0), 0.6)
      bikeMeta(c, {
        length: 1.9,
        width: 0.72,
        front: 0.935,
        rear: -0.97,
        clearance: 0.13,
        bodyHeight: 0.6,
        top: 1.085,
        belt: 0.74,
        color: hex,
        rack: 0.78,
        exhaust: new V3(-0.76, 0.32, 0.15),
      })
      /* modified: tubular crash bar, wire basket at the front, crate with a can on the grab handle */
      c.meta.armor = function (c: any, Zg: any) {
        ;[1, -1].forEach(function (s) {
          c.tube(
            [
              [0.36, 0.84, s * 0.14],
              [0.52, 0.62, s * 0.3],
              [0.44, 0.3, s * 0.3],
              [0.2, 0.24, s * 0.2],
            ],
            0.017,
            Zg.steelMaterial,
            { seg: 20 },
          )
        })
        c.roundBox(0.24, 0.16, 0.3, 0.02, CM('#3c3a34', { metalness: 0.4 }), 0.62, 1.0, 0, { def: true })
        for (let i = 0; i < 5; i++) c.rod(new V3(0.5 + i * 0.06, 0.92, -0.15), new V3(0.5 + i * 0.06, 0.92, 0.15), 0.004, MT.steel)
        c.roundBox(0.36, 0.22, 0.3, 0.02, MT.wood, -0.75, 0.9, 0, { def: true })
        kit.jerryCan(c, -0.75, 0.95, 0.0, '#8e2a20')
        c.rod(new V3(0.32, 0.96, -0.3), new V3(0.7, 1.4, -0.3), 0.008, MT.trim)
      }
    },
  )

  /* ================= Naked motorcycle (FZ25 Fazer 250 type) ================= */
  /* Reference: Yamaha FZ25 Fazer 250 2018+ (Yamaha sheet, via magodoscarros.com.br, checked in 2026)
     Real measurements: length 2.040 · width 0.760 · height 1.070 (without mirror) · wheelbase 1.370 · seat height 0.790
     · clearance 0.160 · tyres 100/80-17 (diameter 0.592) and 140/70-17 (diameter 0.628) · overhangs about 0.35 / 0.32 (from memory).
     Signature traits:
     front: split LED headlight in a short angular fairing, with the position thread at the top; smoked visor;
     indicators on stalks; short painted front fender; wide tubular handlebar.
     side: muscular tank with large angular fins that drop forward and cover the oil cooler;
     silver and black air-cooled single-cylinder engine; short fat exhaust with a guard rising to the rear;
     two-level seat; box swingarm; alloy wheels with 10 thin spokes; monoshock.
     rear: tall pointed tail with an LED taillight, separate grab handles, long plate bracket with the indicators.
     from above: wide tank at knee height tapering into the seat; straight wide handlebar. */
  fx.register(
    {
      key: 'naked_bike',
      group: 'motorcycles',
      name: trl('vehicles.naked_bike.name'),
      inspired: trl('vehicles.naked_bike.inspired'),
      article: trl('vehicles.naked_bike.article'),
      category: trl('vehicles.naked_bike.category'),
      fuel: 'flex',
      description: trl('vehicles.naked_bike.description'),
      mass: 153,
      noise: 75,
      seats: trl('vehicles.naked_bike.seats'),
      capacity: trl('vehicles.naked_bike.capacity'),
      efficiency: trl('vehicles.naked_bike.efficiency'),
      range: trl('vehicles.naked_bike.range'),
      maxSpeed: 135,
      skill: trl('vehicles.naked_bike.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#1d3f8f',
        col = c.paint(hex),
        dark = c.paint('#2a2d33'),
        blk = BLK
      const XF = 0.685,
        XR = -0.685,
        RF = 0.296,
        RR = 0.314
      const fw = kit.spokedWheel(c, XF, RF, 0.05, { cast: true, disc: true, label: trl('labels.front_tire') })
      const rw = kit.spokedWheel(c, XR, RR, 0.068, { cast: true, label: trl('labels.rear_tire') })
      ;[fw, rw].forEach(function (g) {
        moreSpokes(g, 5, 0.18)
      })
      const dsk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.008, 24), MT.steel)
      dsk.rotation.x = PI / 2
      dsk.position.z = -0.07
      rw.add(dsk)
      const Z = { fairing: [], handlebar: [], fuel_tank: [], seat: [], engine: [], exhaust: [] }
      let n0
      /* black diamond frame */
      c.tube(
        [
          [0.38, 0.98, 0],
          [0.27, 0.7, 0],
          [0.16, 0.36, 0],
        ],
        0.022,
        blk,
        { seg: 20 },
      )
      c.tube(
        [
          [0.38, 0.98, 0],
          [0.12, 0.86, 0],
          [-0.14, 0.76, 0],
          [-0.2, 0.52, 0],
          [-0.16, 0.36, 0],
        ],
        0.022,
        blk,
        { seg: 40 },
      )
      c.tube(
        [
          [-0.14, 0.76, 0],
          [-0.5, 0.8, 0],
          [-0.9, 0.86, 0],
        ],
        0.018,
        blk,
        { seg: 20 },
      )
      c.cylinder(0.035, 0.035, 0.17, blk, 0.39, 0.96, 0).rotation.z = -0.42
      n0 = c.vehicle.children.length
      const eng = singleEngine(c, { x: 0.08, y: 0.44, tilt: 0.26, k: 1.08, cover: CM('#202226', { metalness: 0.4, roughness: 0.45 }) })
      c.roundBox(0.04, 0.16, 0.24, 0.012, CM('#1d1f22', { metalness: 0.4, roughness: 0.5 }), 0.36, 0.62, 0, { rot: [0, 0, -0.35] })
      c.roundBox(0.4, 0.035, 0.24, 0.015, CM('#22242a', { roughness: 0.6 }), 0.1, 0.25, 0, { rot: [0, 0, 0.1] })
      Z.engine = grab(c, n0)
      /* muscular tank and angular fins (dropping forward and covering the oil cooler) */
      n0 = c.vehicle.children.length
      const TK = [
        [0.42, 0.98, 0.82, 0.18, 2.2],
        [0.32, 1.035, 0.77, 0.36, 2.4],
        [0.14, 1.03, 0.75, 0.39, 2.4],
        [0.0, 0.97, 0.76, 0.32, 2.4],
        [-0.08, 0.91, 0.79, 0.2, 2.2],
      ]
      body(c, TK, col)
      ;[1, -1].forEach(function (s) {
        body(
          c,
          [
            [0.58, 0.66, 0.6, 0.02, 3, s * 0.14],
            [0.5, 0.9, 0.56, 0.04, 3.4, s * 0.19],
            [0.36, 1.0, 0.6, 0.05, 3.4, s * 0.215],
            [0.2, 0.99, 0.68, 0.05, 3.2, s * 0.21],
            [0.08, 0.92, 0.8, 0.02, 2.4, s * 0.17],
          ],
          dark,
          { p: 3 },
        )
        body(
          c,
          [
            [0.54, 0.7, 0.66, 0.015, 3, s * 0.165],
            [0.44, 0.88, 0.7, 0.025, 3, s * 0.225],
            [0.3, 0.96, 0.84, 0.025, 3, s * 0.24],
            [0.2, 0.98, 0.9, 0.015, 3, s * 0.235],
          ],
          col,
          { p: 3 },
        )
        c.text(trl('texts.faz'), 0.16, 0.05, 0.22, 0.93, s * 0.205, s > 0 ? '+z' : '-z', { fg: '#e9ecf2', size: 0.85 })
      })
      c.cylinder(0.035, 0.035, 0.012, MT.chrome, 0.24, 1.035, 0)
      Z.fuel_tank = grab(c, n0)
      /* two-level seat, tall pointed tail, separate handles, long plate bracket */
      n0 = c.vehicle.children.length
      body(
        c,
        [
          [0.0, 0.83, 0.77, 0.2],
          [-0.12, 0.8, 0.75, 0.3],
          [-0.38, 0.8, 0.75, 0.27],
          [-0.46, 0.84, 0.78, 0.2],
        ],
        SEAT,
        { p: 3 },
      )
      body(
        c,
        [
          [-0.47, 0.885, 0.82, 0.2],
          [-0.62, 0.895, 0.83, 0.19],
          [-0.76, 0.9, 0.84, 0.14],
          [-0.82, 0.895, 0.85, 0.06],
        ],
        SEAT,
        { p: 3 },
      )
      const TL = [
        [-0.1, 0.78, 0.6, 0.24, 2.6],
        [-0.45, 0.83, 0.66, 0.25, 2.6],
        [-0.8, 0.88, 0.77, 0.17, 2.4],
        [-0.98, 0.905, 0.85, 0.06, 2.2],
      ]
      body(c, TL, dark)
      ;[1, -1].forEach(function (s) {
        body(
          c,
          [
            [-0.2, 0.8, 0.7, 0.02, 2, s * 0.125],
            [-0.5, 0.835, 0.73, 0.02, 2, s * 0.126],
            [-0.8, 0.88, 0.8, 0.015, 2, s * 0.088],
          ],
          col,
          { p: 2 },
        )
        c.tube(
          [
            [-0.52, 0.9, s * 0.13],
            [-0.66, 0.9, s * 0.135],
            [-0.82, 0.9, s * 0.1],
          ],
          0.014,
          CM('#2f3237', { metalness: 0.5, roughness: 0.4 }),
          { seg: 12 },
        )
      })
      body(
        c,
        [
          [-0.86, 0.82, 0.76, 0.1],
          [-0.96, 0.74, 0.68, 0.1],
          [-1.0, 0.64, 0.58, 0.09],
        ],
        blk,
      )
      plateMoto(c, -1.005, 0.55)
      ;[1, -1].forEach(function (s) {
        blinker(c, -0.96, 0.7, s * 0.13, false)
      })
      Z.seat = grab(c, n0)
      kit.taillight(c, { style: 'bar', x: -0.975, y: 0.875, z: 0, w: 0.1, h: 0.04, d: 0.04, side: 1, label: trl('labels.taillight') })
      /* box swingarm, monoshock, chain, footpegs */
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.62, 0.07, 0.035, 0.015, CM('#25272b', { metalness: 0.5, roughness: 0.45 }), -0.39, 0.37, s * 0.1, {
          rot: [0, 0, 0.09],
        })
        c.roundBox(0.12, 0.022, 0.05, 0.01, RUBBER, 0.0, 0.33, s * 0.2)
        c.roundBox(0.08, 0.02, 0.045, 0.01, RUBBER, -0.36, 0.44, s * 0.17)
        c.rod(new V3(-0.3, 0.42, s * 0.13), new V3(-0.44, 0.48, s * 0.17), 0.012, CM('#2f3237', { metalness: 0.5 }))
      })
      c.rod(new V3(-0.24, 0.44, 0), new V3(-0.12, 0.74, 0), 0.03, CM('#c8a419', { roughness: 0.45 }))
      c.roundBox(0.56, 0.05, 0.025, 0.015, blk, -0.38, 0.4, -0.14, { rot: [0, 0, 0.1] })
      c.rod(new V3(-0.03, 0.3, -0.14), new V3(-0.14, 0.06, -0.25), 0.012, blk)
      /* exhaust: header underneath and short fat muffler on the right, with a guard */
      n0 = c.vehicle.children.length
      c.tube(
        [
          [eng.exh.x, eng.exh.y, 0.06],
          [eng.exh.x + 0.06, eng.exh.y - 0.14, 0.1],
          [0.14, 0.185, 0.04],
          [-0.12, 0.22, 0.12],
          [-0.3, 0.38, 0.17],
        ],
        0.022,
        EXH,
        { seg: 40 },
      )
      const mf = c.cylinder(0.075, 0.065, 0.34, CM('#2c2f33', { metalness: 0.7, roughness: 0.35 }), -0.47, 0.45, 0.18)
      mf.rotation.z = -PI / 2 + 0.28
      c.cylinder(0.04, 0.04, 0.04, EXH, -0.645, 0.5, 0.18).rotation.z = -PI / 2 + 0.28
      c.roundBox(0.26, 0.09, 0.03, 0.03, CM('#8d9296', { metalness: 0.7, roughness: 0.35 }), -0.47, 0.47, 0.245, { rot: [0, 0, 0.28] })
      Z.exhaust = grab(c, n0)
      /* fork, fender, angular headlight fairing with a smoked visor, tubular handlebar */
      fork(c, [0.38, 0.98], [XF, RF], 0.085, 0.019, MT.chrome, CM('#2b2d31', { metalness: 0.5, roughness: 0.4 }), { split: 0.45 })
      n0 = c.vehicle.children.length
      fender(c, XF, RF, RF + 0.03, 0.55, 2.3, 0.12, 0.02, col)
      body(
        c,
        [
          [0.42, 1.05, 0.82, 0.26, 2.6],
          [0.52, 1.03, 0.83, 0.28, 2.6],
          [0.59, 0.99, 0.85, 0.22, 2.4],
          [0.62, 0.95, 0.87, 0.1, 2.2],
        ],
        col,
      )
      ;[1, -1].forEach(function (s) {
        body(
          c,
          [
            [0.44, 0.97, 0.82, 0.02, 2, s * 0.135],
            [0.56, 0.95, 0.84, 0.02, 2, s * 0.13],
            [0.6, 0.92, 0.86, 0.015, 2, s * 0.1],
          ],
          dark,
          { p: 2 },
        )
      })
      c.roundBox(0.015, 0.1, 0.2, 0.02, SMOKEG, 0.55, 1.035, 0, { rot: [0, 0, 0.55] })
      c.roundBox(0.07, 0.03, 0.16, 0.01, CM('#121518', { roughness: 0.25, metalness: 0.3 }), 0.44, 1.07, 0, { rot: [0, 0, 0.5] })
      c.roundBox(0.04, 0.032, 0.1, 0.006, MT.gauge, 0.45, 1.075, 0, { rot: [0, 0, 0.5] })
      ;[1, -1].forEach(function (s) {
        blinker(c, 0.5, 0.92, s * 0.16, true)
      })
      Z.fairing = grab(c, n0)
      const HL = lamp(c, {
        style: 'wedge',
        x: 0.615,
        y: 0.905,
        z: 0,
        w: 0.17,
        h: 0.075,
        d: 0.06,
        side: 1,
        label: trl('labels.headlight'),
        pitch: -0.08,
      })
      drlOn(HL, 0.15, 0.008, 0.036, 0.06)
      n0 = c.vehicle.children.length
      handlebar(c, 0.34, 1.02, 0.37, { rise: 0.035, back: 0.07, stalk: 0.19 })
      Z.handlebar = grab(c, n0)
      zoneParts(c, Z)
      c.part('engine', trl('labels.n_250_engine'), null, new V3(0.08, 0.47, 0), 0.8)
      c.part('fuel_tank', trl('labels.n_14_l_tank'), null, new V3(0.18, 0.92, 0), 0.7)
      bikeMeta(c, {
        length: 2.04,
        width: 0.76,
        front: 1.02,
        rear: -1.015,
        clearance: 0.16,
        bodyHeight: 0.66,
        top: 1.07,
        belt: 0.86,
        color: hex,
        rack: 0.9,
        exhaust: new V3(-0.66, 0.5, 0.18),
      })
      /* modified: engine and tank guard, side cases, can on the pillion, auxiliary light */
      c.meta.armor = function (c: any, Zg: any) {
        ;[1, -1].forEach(function (s) {
          c.tube(
            [
              [0.36, 0.9, s * 0.13],
              [0.46, 0.62, s * 0.28],
              [0.3, 0.3, s * 0.27],
              [0.0, 0.26, s * 0.2],
            ],
            0.019,
            Zg.steelMaterial,
            { seg: 20 },
          )
          c.roundBox(0.42, 0.3, 0.16, 0.04, CM('#3d3a2e'), -0.68, 0.7, s * 0.3, { def: true })
          c.rod(new V3(-0.45, 0.82, s * 0.13), new V3(-0.5, 0.72, s * 0.22), 0.012, Zg.steelMaterial)
          roofLamp(c, 0.5, 0.82, s * 0.24)
        })
        c.roundBox(0.44, 0.06, 0.3, 0.02, Zg.steelMaterial, 0.06, 0.24, 0)
        jerryFlat(c, -0.68, 0.98, 0, '#3e5a34')
      }
    },
  )

  /* ================= Sport motorcycle (Ninja 400 type) ================= */
  /* Reference: Kawasaki Ninja 400 ABS 2018+ (Kawasaki USA sheet, kawasaki.com, checked in 2026)
     Real measurements: length 1.990 · width 0.710 · height 1.120 · wheelbase 1.370 · seat height 0.785 · clearance 0.140
     · tyres 110/70-17 (diameter 0.586) and 150/70-17 (diameter 0.642) · caster 24.7 degrees · overhangs about 0.32 / 0.30 (from memory).
     Signature traits:
     front: two narrow inclined LED headlights ("eyes") in a pointed fairing; central air intake between them;
     short smoked windshield; mirrors fixed to the fairing.
     side: full fairing in two layers, green on the upper part and black below, with the air outlet and the name;
     black trellis frame showing under the tank; low clip-on bars; short black exhaust on the right rising;
     split seat with a higher pillion; thin tall tail.
     rear: LED taillight in two arcs at the tip of the tail, short plate bracket with indicators.
     from above: arrow-shaped body, wide fairing at the front tapering to the tail. */
  fx.register(
    {
      key: 'sport_bike',
      group: 'motorcycles',
      name: trl('vehicles.sport_bike.name'),
      inspired: trl('vehicles.sport_bike.inspired'),
      article: trl('vehicles.sport_bike.article'),
      category: trl('vehicles.sport_bike.category'),
      fuel: 'gasoline',
      description: trl('vehicles.sport_bike.description'),
      mass: 168,
      noise: 85,
      seats: trl('vehicles.sport_bike.seats'),
      capacity: trl('vehicles.sport_bike.capacity'),
      efficiency: trl('vehicles.sport_bike.efficiency'),
      range: trl('vehicles.sport_bike.range'),
      maxSpeed: 190,
      skill: trl('vehicles.sport_bike.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#6cbf1f',
        col = c.paint(hex),
        blkp = c.paint('#141517'),
        wht = c.paint('#eef0ec'),
        blk = BLK
      const XF = 0.685,
        XR = -0.685,
        RF = 0.293,
        RR = 0.321
      const fw = kit.spokedWheel(c, XF, RF, 0.055, { cast: true, disc: true, label: trl('labels.front_tire') })
      const rw = kit.spokedWheel(c, XR, RR, 0.075, { cast: true, label: trl('labels.rear_tire') })
      ;[fw, rw].forEach(function (g) {
        moreSpokes(g, 5, 0.22)
      })
      const Z = { fairing: [], handlebar: [], fuel_tank: [], seat: [], engine: [], exhaust: [] }
      let n0
      /* twin-cylinder engine (barely shows, under the fairing) and radiator behind the wheel */
      n0 = c.vehicle.children.length
      c.roundBox(0.42, 0.26, 0.3, 0.07, ENGD, 0.1, 0.38, 0, { def: true })
      c.roundBox(0.2, 0.26, 0.28, 0.05, ENGD, 0.26, 0.58, 0, { rot: [0, 0, -0.5] })
      c.sphere(0.1, CM('#5d6166', { metalness: 0.6, roughness: 0.4 }), 0.02, 0.38, -0.15, 1.1, 1, 0.35)
      c.roundBox(0.05, 0.3, 0.34, 0.012, CM('#121315', { roughness: 0.6 }), 0.45, 0.62, 0, { rot: [0, 0, -0.32] })
      Z.engine = grab(c, n0)
      /* black trellis frame, visible under the tank and behind the fairing */
      ;[1, -1].forEach(function (s) {
        const z = s * 0.13
        c.tube(
          [
            [0.42, 0.9, s * 0.06],
            [0.16, 0.78, z],
            [-0.12, 0.66, z],
            [-0.18, 0.46, z],
          ],
          0.014,
          blk,
          { seg: 20 },
        )
        c.tube(
          [
            [0.42, 0.84, s * 0.06],
            [0.2, 0.62, z],
            [-0.12, 0.66, z],
          ],
          0.012,
          blk,
          { seg: 12 },
        )
        c.rod(new V3(0.16, 0.78, z), new V3(0.2, 0.62, z), 0.011, blk)
        c.rod(new V3(-0.02, 0.73, z), new V3(0.02, 0.6, z), 0.011, blk)
      })
      c.cylinder(0.035, 0.035, 0.16, blk, 0.42, 0.9, 0).rotation.z = -0.43
      /* fairing: pointed nose (green), two-layer flanks (green on top, black below) and belly pan */
      n0 = c.vehicle.children.length
      /* nose in horizontal slices (loft on the y axis): from the front it becomes an arrowhead (narrow at the chin, wide at the eyes),
       from the side the tip stays low, at air-intake height, and the crest rises to the base of the windshield; from above it is pointed */
      const NOSE = [
        [0.56, 0.8, 0.56, 0.1, 1.9],
        [0.62, 0.89, 0.52, 0.17, 1.8],
        [0.69, 0.955, 0.49, 0.25, 1.7],
        [0.76, 0.99, 0.47, 0.33, 1.65],
        [0.82, 0.965, 0.47, 0.4, 1.65],
        [0.88, 0.89, 0.48, 0.44, 1.7],
        [0.94, 0.78, 0.5, 0.44, 1.8],
        [0.985, 0.68, 0.52, 0.4, 1.9],
        [1.0, 0.64, 0.53, 0.32, 2],
      ]
      body(c, NOSE, col, { axis: 'y', seg: 32 })
      const SIDE = [
        [0.74, 0.84, 0.6, 0.38, 2.6],
        [0.56, 0.85, 0.44, 0.44, 2.8],
        [0.34, 0.81, 0.42, 0.44, 2.8],
        [0.16, 0.74, 0.44, 0.4, 2.6],
        [0.04, 0.66, 0.48, 0.28, 2.4],
      ]
      body(c, SIDE, col)
      body(
        c,
        [
          [0.7, 0.62, 0.32, 0.36, 2.6],
          [0.5, 0.6, 0.24, 0.42, 2.8],
          [0.26, 0.54, 0.22, 0.42, 2.8],
          [0.06, 0.5, 0.24, 0.34, 2.6],
          [-0.06, 0.46, 0.28, 0.2, 2.2],
        ],
        blkp,
      )
      ;[1, -1].forEach(function (s) {
        /* second layer: black flap with the air outlet and the name */
        body(
          c,
          [
            [0.66, 0.78, 0.6, 0.02, 2, s * 0.205],
            [0.5, 0.76, 0.54, 0.03, 2, s * 0.225],
            [0.34, 0.72, 0.52, 0.03, 2, s * 0.225],
            [0.22, 0.66, 0.56, 0.02, 2, s * 0.21],
          ],
          blkp,
          { p: 2 },
        )
        for (let i = 0; i < 3; i++)
          c.roundBox(0.16, 0.012, 0.01, 0.004, CM('#2c2e31'), 0.44, 0.6 + i * 0.035, s * 0.243, { rot: [0, 0, -0.3] })
        c.text(trl('texts.ninj_400'), 0.24, 0.055, 0.44, 0.8, s * (loftHalf(SIDE, 0.44, 0.8) + 0.003), s > 0 ? '+z' : '-z', {
          fg: '#151515',
          size: 0.85,
        })
        /* white thread running along the crest of the nose, glued to the surface */
        const fp = []
        for (let q = 0; q <= 8; q++) {
          const fx = 0.88 - q * 0.04,
            fy = 0.875 + q * 0.006
          fp.push([fx, fy, s * (yHalf(NOSE, fy, fx) + 0.002)])
        }
        c.tube(fp, 0.006, wht, { seg: 24 })
        /* mirrors fixed to the fairing */
        c.rod(new V3(0.62, 0.95, s * 0.19), new V3(0.6, 1.0, s * 0.28), 0.008, blk)
        c.roundBox(0.06, 0.06, 0.11, 0.025, blkp, 0.59, 1.01, s * 0.295, { def: true })
        c.roundBox(0.006, 0.045, 0.09, 0.01, MT.chrome, 0.555, 1.01, s * 0.295)
        blinker(c, 0.6, 0.98, s * 0.31, true, { flush: true })
      })
      /* central air intake and short smoked windshield */
      c.roundBox(0.05, 0.035, 0.07, 0.012, CM('#0b0c0d', { roughness: 0.9 }), 0.965, 0.79, 0, { rot: [0, 0, 0.35] })
      const ws = c.roundBox(0.012, 0.3, 0.3, 0.06, SMOKEG, 0.64, 1.02, 0, { rot: [0, 0, 0.62], taper: { sz: 0.55 } })
      ws.castShadow = false
      ws.renderOrder = 2
      const fendF = fender(c, XF, RF, RF + 0.025, 0.25, 2.05, 0.12, 0.02, blkp)
      Z.fairing = grab(c, n0).concat([fendF])
      /* two narrow LED headlights inclined outward and upward */
      ;[1, -1].forEach(function (s) {
        const L = lamp(c, {
          style: 'slim',
          x: 0.862,
          y: 0.87,
          z: s * 0.115,
          w: 0.15,
          h: 0.032,
          d: 0.04,
          side: s,
          yaw: 0.65,
          roll: s * 0.25,
          label: s > 0 ? trl('labels.right_headlight') : trl('labels.left_headlight'),
        })
        drlOn(L, 0.14, 0.006, 0.013, 0.05)
      })
      /* glossy black tank */
      n0 = c.vehicle.children.length
      body(
        c,
        [
          [0.46, 0.97, 0.8, 0.28, 2.4],
          [0.3, 0.98, 0.76, 0.36, 3],
          [0.12, 0.965, 0.74, 0.37, 3],
          [-0.02, 0.915, 0.77, 0.31, 2.6],
          [-0.1, 0.86, 0.8, 0.18, 2.2],
        ],
        blkp,
        { crease: 40 },
      )
      c.cylinder(0.04, 0.04, 0.012, MT.chrome, 0.26, 0.98, 0)
      Z.fuel_tank = grab(c, n0)
      /* split seat, tall thin tail, short plate bracket */
      n0 = c.vehicle.children.length
      body(
        c,
        [
          [-0.02, 0.82, 0.76, 0.22],
          [-0.12, 0.79, 0.74, 0.3],
          [-0.36, 0.79, 0.74, 0.27],
          [-0.44, 0.82, 0.77, 0.2],
        ],
        SEAT,
        { p: 3 },
      )
      body(
        c,
        [
          [-0.46, 0.875, 0.82, 0.17],
          [-0.66, 0.895, 0.84, 0.15],
          [-0.76, 0.89, 0.85, 0.07],
        ],
        SEAT,
        { p: 3 },
      )
      const TLc = [
        [-0.08, 0.77, 0.58, 0.26, 2.6],
        [-0.45, 0.84, 0.66, 0.26, 2.6],
        [-0.8, 0.9, 0.78, 0.16, 2.4],
        [-0.99, 0.925, 0.86, 0.05, 2.2],
      ]
      body(c, TLc, col)
      body(
        c,
        [
          [-0.86, 0.8, 0.74, 0.12],
          [-0.97, 0.72, 0.66, 0.1],
          [-1.0, 0.66, 0.6, 0.09],
        ],
        blk,
      )
      plateMoto(c, -1.0, 0.57)
      ;[1, -1].forEach(function (s) {
        blinker(c, -0.96, 0.71, s * 0.12, false)
      })
      Z.seat = grab(c, n0)
      kit.taillight(c, { style: 'bar', x: -0.965, y: 0.885, z: 0, w: 0.09, h: 0.035, d: 0.04, side: 1, label: trl('labels.taillight') })
      ;[1, -1].forEach(function (s) {
        const a = c.roundBox(0.006, 0.01, 0.07, 0.003, REDLED, -0.985, 0.875, s * 0.03, { rot: [s * 0.5, 0, 0] })
        a.castShadow = false
      })
      /* swingarm, shock absorber, footpegs, chain */
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.6, 0.07, 0.035, 0.015, CM('#1e2023', { metalness: 0.5, roughness: 0.45 }), -0.4, 0.37, s * 0.105, {
          rot: [0, 0, 0.08],
        })
        c.roundBox(0.11, 0.022, 0.05, 0.01, RUBBER, -0.08, 0.38, s * 0.2)
        c.rod(new V3(-0.06, 0.4, s * 0.15), new V3(-0.16, 0.5, s * 0.17), 0.012, CM('#3a3d42', { metalness: 0.6 }))
      })
      c.roundBox(0.56, 0.05, 0.025, 0.015, blk, -0.4, 0.4, -0.14, { rot: [0, 0, 0.08] })
      c.rod(new V3(-0.06, 0.3, -0.14), new V3(-0.16, 0.06, -0.24), 0.012, blk)
      /* short black exhaust rising on the right, silver tip */
      n0 = c.vehicle.children.length
      c.tube(
        [
          [0.48, 0.42, 0.06],
          [0.42, 0.22, 0.08],
          [0.1, 0.17, 0.1],
          [-0.18, 0.26, 0.16],
          [-0.26, 0.32, 0.17],
        ],
        0.022,
        EXH,
        { seg: 40 },
      )
      c.roundBox(0.24, 0.08, 0.16, 0.03, CM('#2a2c30', { metalness: 0.6, roughness: 0.4 }), 0.0, 0.18, 0.02)
      const mf = c.cylinder(0.07, 0.06, 0.36, CM('#1c1e21', { metalness: 0.6, roughness: 0.35 }), -0.42, 0.42, 0.18)
      mf.rotation.z = -PI / 2 + 0.42
      c.cylinder(0.045, 0.045, 0.04, EXH, -0.59, 0.5, 0.18).rotation.z = -PI / 2 + 0.42
      Z.exhaust = grab(c, n0)
      fork(c, [0.4, 0.91], [XF, RF], 0.085, 0.02, MT.chrome, CM('#26282b', { metalness: 0.5, roughness: 0.4 }), { split: 0.4 })
      /* low clip-on bars (no mirror: they are on the fairing) and panel */
      n0 = c.vehicle.children.length
      handlebar(c, 0.38, 0.9, 0.31, { rise: 0.0, back: 0.05, mirrors: false })
      c.roundBox(0.08, 0.1, 0.2, 0.02, blk, 0.5, 0.95, 0, { rot: [0, 0, 0.7] })
      c.roundBox(0.012, 0.075, 0.16, 0.006, MT.gauge, 0.47, 0.975, 0, { rot: [0, 0, 0.7] })
      Z.handlebar = grab(c, n0)
      zoneParts(c, Z)
      c.part('engine', trl('labels.twin_cylinder_engine'), null, new V3(0.15, 0.45, 0), 0.8)
      c.part('fuel_tank', trl('labels.n_14_l_tank'), null, new V3(0.15, 0.92, 0), 0.7)
      c.part('fairing', trl('labels.fairing'), null, new V3(0.7, 0.75, 0), 0.7)
      bikeMeta(c, {
        length: 1.99,
        width: 0.71,
        front: 0.99,
        rear: -1.01,
        clearance: 0.14,
        bodyHeight: 0.66,
        top: 1.12,
        belt: 0.84,
        color: hex,
        rack: 0.9,
        exhaust: new V3(-0.6, 0.5, 0.18),
      })
      /* modified: sheet grille over the headlights, side sliders and a screen over the windshield, tank bag and can on the pillion */
      c.meta.armor = function (c: any, Zg: any) {
        c.roundBox(0.04, 0.12, 0.3, 0.01, Zg.steelMaterial, 0.97, 0.8, 0, { rot: [0, 0, -0.5] })
        for (let i = -3; i <= 3; i++) c.rod(new V3(0.66, 0.92, i * 0.035), new V3(0.58, 1.08, i * 0.035), 0.004, MT.steel)
        ;[1, -1].forEach(function (s) {
          c.cylinder(0.03, 0.03, 0.1, CM('#101010'), 0.3, 0.62, s * 0.3, 'z')
          c.roundBox(0.5, 0.08, 0.02, 0.01, Zg.steelMaterial, 0.4, 0.42, s * 0.24)
        })
        c.roundBox(0.26, 0.12, 0.28, 0.05, CM('#2a2b2d', { roughness: 0.85 }), 0.18, 1.1, 0, { def: true })
        jerryFlat(c, -0.62, 0.98, 0, '#8e2a20')
      }
    },
  )

  /* ================= Cruiser motorcycle (Fat Boy 114 type) ================= */
  /* Reference: Harley-Davidson Softail Fat Boy 114 2018+ (motorcycle.com sheet, checked in 2026)
     Real measurements: length 2.370 · width 0.985 (handlebar) · height 1.095 · wheelbase 1.665 · seat height 0.675
     · clearance 0.115 · tyres 160/60 R18 (diameter 0.649, width 0.16) and 240/40 R18 (diameter 0.649, width 0.24) · caster 30 degrees
     · overhangs about 0.35 / 0.36 (from memory).
     Signature traits:
     front: large round LED headlight with a light ring in a nacelle; thick fork with wide covers; fat front tyre;
     wide straight handlebar, high at the ends; short front fender.
     side: closed-disc wheels (no spokes) with shallow slots; 114 cu in V2 engine with black finned cylinders
     and chrome covers; round air filter on the right; teardrop tank with the chrome console and the display on top;
     low two-level seat; floorboards; stacked dual exhaust on the right, with a cut tip.
     rear: 240 mm tyre under a wide rounded fender, taillight at the end of the fender, low indicators.
     from above: wide handlebar, wide tank, fat tyres, cylinders sticking out little to the sides. */
  fx.register(
    {
      key: 'cruiser',
      group: 'motorcycles',
      name: trl('vehicles.cruiser.name'),
      inspired: trl('vehicles.cruiser.inspired'),
      article: trl('vehicles.cruiser.article'),
      category: trl('vehicles.cruiser.category'),
      fuel: 'gasoline',
      description: trl('vehicles.cruiser.description'),
      mass: 317,
      noise: 110,
      seats: trl('vehicles.cruiser.seats'),
      capacity: trl('vehicles.cruiser.capacity'),
      efficiency: trl('vehicles.cruiser.efficiency'),
      range: trl('vehicles.cruiser.range'),
      maxSpeed: 180,
      skill: trl('vehicles.cruiser.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#3b4652',
        col = c.paint(hex),
        blk = BLK,
        CH = CM('#c4c8cb', { metalness: 0.6, roughness: 0.28 }),
        gloss = CM('#0c0d0f', { roughness: 0.25, metalness: 0.5 })
      const XF = 0.8325,
        XR = -0.8325,
        R = 0.3245
      fatWheel(c, XF, R, 0.16, 0.235, { label: trl('labels.front_tire'), disc2: true })
      fatWheel(c, XR, R, 0.24, 0.235, { label: trl('labels.rear_tire') })
      const Z = { fairing: [], handlebar: [], fuel_tank: [], seat: [], engine: [], exhaust: [] }
      let n0
      /* black softail frame: neck, spine, cradle under the engine, triangulated swingarm */
      const HD = [0.49, 0.915]
      c.cylinder(0.042, 0.042, 0.2, blk, HD[0] - 0.02, HD[1] - 0.02, 0).rotation.z = -0.52
      ;[1, -1].forEach(function (s) {
        const z = s * 0.1
        c.tube(
          [
            [HD[0] - 0.04, HD[1] - 0.08, s * 0.04],
            [0.38, 0.5, z],
            [0.32, 0.15, z],
            [-0.1, 0.135, z],
            [-0.28, 0.3, z],
          ],
          0.02,
          blk,
          { seg: 30 },
        )
        c.tube(
          [
            [-0.28, 0.3, z],
            [-0.32, 0.6, z * 0.9],
            [-0.42, 0.66, z * 1.1],
          ],
          0.02,
          blk,
          { seg: 12 },
        )
        c.rod(new V3(-0.26, 0.3, s * 0.15), new V3(XR, R, s * 0.15), 0.026, blk)
        c.rod(new V3(-0.4, 0.5, s * 0.15), new V3(XR + 0.02, R + 0.02, s * 0.15), 0.018, blk)
        c.rod(new V3(-0.26, 0.3, s * 0.15), new V3(-0.4, 0.5, s * 0.15), 0.018, blk)
      })
      c.tube(
        [
          [HD[0] - 0.04, HD[1] - 0.02, 0],
          [0.2, 0.74, 0],
          [-0.2, 0.66, 0],
          [-0.42, 0.68, 0],
        ],
        0.028,
        blk,
        { seg: 30 },
      )
      /* V2 engine: crankcase, two black finned cylinders in a 45 degree V, chrome heads and covers, round filter on the right */
      n0 = c.vehicle.children.length
      c.roundBox(0.44, 0.24, 0.26, 0.08, CM('#24262a', { metalness: 0.5, roughness: 0.4 }), 0.1, 0.3, 0, { def: true })
      c.roundBox(0.3, 0.03, 0.22, 0.01, blk, 0.08, 0.13, 0)
      ;[
        [0.2, 0.43, 0.39],
        [-0.01, 0.43, -0.39],
      ].forEach(function (cy) {
        const bx = cy[0],
          by = cy[1],
          tl = cy[2],
          len = 0.22
        for (let f = 0; f < 9; f++) {
          const t = f / 8,
            px = bx + Math.sin(tl) * t * len,
            py = by + Math.cos(tl) * t * len
          c.roundBox(0.17 - t * 0.01, 0.012, 0.15, 0.006, gloss, px, py, 0, { rot: [0, 0, -tl] })
          c.roundBox(0.172 - t * 0.01, 0.003, 0.152, 0.002, ENG, px, py + 0.007, 0, { rot: [0, 0, -tl] })
        }
        c.roundBox(0.12, len, 0.11, 0.03, gloss, bx + (Math.sin(tl) * len) / 2, by + (Math.cos(tl) * len) / 2, 0, { rot: [0, 0, -tl] })
        c.roundBox(0.19, 0.06, 0.17, 0.03, CH, bx + Math.sin(tl) * (len + 0.03), by + Math.cos(tl) * (len + 0.03), 0, { rot: [0, 0, -tl] })
      })
      c.cylinder(0.12, 0.12, 0.07, CH, 0.2, 0.56, 0.17, 'z')
      c.cylinder(0.1, 0.1, 0.012, CM('#9ea3a7', { metalness: 0.55, roughness: 0.35 }), 0.2, 0.56, 0.21, 'z')
      c.text('114', 0.1, 0.04, 0.2, 0.56, 0.217, '+z', { fg: '#1b1c1f', size: 0.85 })
      /* primary cover (left), belt (right) */
      c.sphere(0.17, CH, -0.06, 0.32, -0.17, 1.35, 0.85, 0.28)
      c.cylinder(0.07, 0.07, 0.02, CH, -0.02, 0.3, -0.215, 'z')
      c.roundBox(0.86, 0.035, 0.02, 0.015, CM('#1a1a1a', { roughness: 0.8 }), -0.43, 0.32, 0.15, { rot: [0, 0, 0.0] })
      Z.engine = grab(c, n0)
      /* thick fork with wide covers, nacelle and large round headlight with a light ring */
      fork(c, [HD[0], HD[1]], [XF, R], 0.115, 0.024, CH, CH, { split: 0.5, lowK: 1.25 })
      n0 = c.vehicle.children.length
      ;[1, -1].forEach(function (s) {
        c.rod(new V3(HD[0] + 0.01, HD[1] - 0.02, s * 0.115), new V3(0.65, 0.6, s * 0.115), 0.048, col, { seg: 16 })
      })
      c.sphere(0.13, col, 0.6, 0.85, 0, 1.15, 0.9, 1.0)
      const fendF = fender(c, XF, R, R + 0.03, 0.55, 1.95, 0.2, 0.025, col)
      ;[1, -1].forEach(function (s) {
        blinker(c, 0.62, 0.95, s * 0.2, true, { r: 0.024 })
      })
      Z.fairing = grab(c, n0).concat([fendF])
      const HL = lamp(c, { style: 'round', x: 0.72, y: 0.84, z: 0, w: 0.19, h: 0.19, d: 0.1, side: 1, label: trl('labels.headlight') })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.007, 6, 32), DRL)
      ring.rotation.y = PI / 2
      ring.position.set(0.052, 0, 0)
      ring.castShadow = false
      HL.group.add(ring)
      HL.inner.push(ring)
      /* teardrop tank with chrome console and display */
      n0 = c.vehicle.children.length
      const TK = [
        [0.46, 0.89, 0.76, 0.18, 2.2],
        [0.36, 0.95, 0.72, 0.38, 2.4],
        [0.16, 0.965, 0.71, 0.44, 2.4],
        [-0.04, 0.93, 0.72, 0.4, 2.4],
        [-0.16, 0.86, 0.74, 0.26, 2.2],
        [-0.2, 0.82, 0.76, 0.1, 2],
      ]
      body(c, TK, col)
      body(
        c,
        [
          [0.36, 0.955, 0.94, 0.1, 3],
          [0.2, 0.975, 0.955, 0.12, 3],
          [-0.04, 0.945, 0.92, 0.1, 3],
          [-0.12, 0.915, 0.89, 0.06, 3],
        ],
        CH,
        { def: false },
      )
      c.cylinder(0.05, 0.05, 0.012, CH, 0.22, 0.982, 0)
      const g = c.cylinder(0.042, 0.042, 0.004, MT.gauge, 0.22, 0.989, 0)
      g.castShadow = false
      c.cylinder(0.03, 0.03, 0.01, CH, 0.36, 0.955, 0.1)
      ;[1, -1].forEach(function (s) {
        c.text(trl('texts.fat_boi'), 0.18, 0.04, 0.16, 0.84, s * (loftHalf(TK, 0.16, 0.84) + 0.003), s > 0 ? '+z' : '-z', {
          fg: '#e3e5e6',
          size: 0.85,
        })
      })
      Z.fuel_tank = grab(c, n0)
      /* low two-level seat, wide rear fender, taillight, plate, indicators */
      n0 = c.vehicle.children.length
      body(
        c,
        [
          [-0.16, 0.78, 0.66, 0.24],
          [-0.26, 0.7, 0.63, 0.36],
          [-0.46, 0.68, 0.63, 0.38],
          [-0.58, 0.72, 0.66, 0.3],
          [-0.74, 0.77, 0.7, 0.26],
          [-0.84, 0.77, 0.72, 0.14],
        ],
        SEAT,
        { p: 3 },
      )
      const fendR = fender(c, XR, R, R + 0.035, 0.42, 2.78, 0.3, 0.03, col, { drop: 0.03 })
      c.cylinder(0.035, 0.035, 0.03, CH, -1.165, 0.53, 0, 'x')
      plateMoto(c, -1.18, 0.4)
      ;[1, -1].forEach(function (s) {
        blinker(c, -1.06, 0.48, s * 0.2, false, { r: 0.022 })
      })
      /* floorboards and pillion footpegs */
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.3, 0.025, 0.13, 0.012, RUBBER, 0.42, 0.24, s * 0.31)
        c.roundBox(0.31, 0.01, 0.135, 0.004, CH, 0.42, 0.226, s * 0.31)
        c.rod(new V3(0.3, 0.22, s * 0.12), new V3(0.4, 0.23, s * 0.26), 0.014, CH)
        c.roundBox(0.1, 0.022, 0.05, 0.01, RUBBER, -0.52, 0.36, s * 0.24)
      })
      Z.seat = grab(c, n0).concat([fendR])
      kit.taillight(c, { style: 'round2', x: -1.16, y: 0.55, z: 0, w: 0.1, h: 0.045, d: 0.04, side: 1, label: trl('labels.taillight') })
      /* exhaust: two chrome headers going down on the right and two short stacked mufflers with a cut tip */
      n0 = c.vehicle.children.length
      c.tube(
        [
          [0.33, 0.6, 0.06],
          [0.42, 0.5, 0.16],
          [0.38, 0.3, 0.2],
          [0.1, 0.24, 0.22],
          [-0.3, 0.28, 0.24],
        ],
        0.024,
        CH,
        { seg: 40 },
      )
      c.tube(
        [
          [-0.06, 0.62, 0.06],
          [-0.04, 0.5, 0.2],
          [-0.12, 0.38, 0.24],
          [-0.3, 0.38, 0.25],
        ],
        0.024,
        CH,
        { seg: 30 },
      )
      ;[0.29, 0.4].forEach(function (y, i) {
        const mf = c.cylinder(0.05, 0.05, 0.6, CH, -0.62, y + i * 0.02, 0.25)
        mf.rotation.z = -PI / 2 + 0.06
        c.roundBox(0.06, 0.1, 0.1, 0.01, CM('#0d0d0e', { roughness: 0.8 }), -0.925, y + i * 0.02 - 0.015, 0.25, { rot: [0, 0, 0.6] })
      })
      c.roundBox(0.3, 0.09, 0.02, 0.03, CH, -0.18, 0.33, 0.27)
      Z.exhaust = grab(c, n0)
      /* wide straight handlebar, with risers and mirrors */
      n0 = c.vehicle.children.length
      c.rod(new V3(0.47, 0.95, -0.05), new V3(0.45, 1.0, -0.05), 0.016, CH)
      c.rod(new V3(0.47, 0.95, 0.05), new V3(0.45, 1.0, 0.05), 0.016, CH)
      handlebar(c, 0.44, 1.0, 0.475, { rise: 0.02, back: 0.12, mat: CH, r: 0.016, stalk: 0.035, mW: 0.11, mH: 0.06, mOut: 0.03 })
      Z.handlebar = grab(c, n0)
      c.rod(new V3(-0.08, 0.2, -0.16), new V3(-0.2, 0.04, -0.3), 0.013, blk)
      zoneParts(c, Z)
      c.part('engine', trl('labels.v2_114_engine'), null, new V3(0.1, 0.45, 0), 0.9)
      c.part('fuel_tank', trl('labels.n_18_9_l_tank'), null, new V3(0.15, 0.85, 0), 0.8)
      bikeMeta(c, {
        length: 2.37,
        width: 0.985,
        front: 1.19,
        rear: -1.19,
        clearance: 0.12,
        bodyHeight: 0.7,
        top: 1.095,
        belt: 0.82,
        color: hex,
        rack: 0.8,
        exhaust: new V3(-0.93, 0.33, 0.25),
      })
      /* own zone: the rear fender and taillight belong to the seat and tail (the automatic one already takes them); nothing to remove */
      /* modified: leather saddlebags, backrest (sissy bar) with a can, bumper plate on the fork, cans on the floorboards */
      c.meta.armor = function (c: any, Zg: any) {
        const lea = CM('#3a2618', { roughness: 0.85 })
        ;[1, -1].forEach(function (s) {
          c.roundBox(0.42, 0.3, 0.16, 0.06, lea, -0.85, 0.58, s * 0.27, { def: true })
          c.roundBox(0.43, 0.06, 0.17, 0.02, CM('#2a1b10'), -0.85, 0.72, s * 0.27)
          c.rod(new V3(-0.9, 0.6, s * 0.17), new V3(-0.95, 1.12, s * 0.13), 0.014, CH)
          c.tube(
            [
              [0.62, 0.6, s * 0.2],
              [0.78, 0.66, s * 0.32],
              [0.62, 0.35, s * 0.34],
              [0.38, 0.22, s * 0.32],
            ],
            0.022,
            Zg.steelMaterial,
            { seg: 20 },
          )
        })
        c.tube(
          [
            [-0.95, 1.12, -0.13],
            [-0.97, 1.18, 0],
            [-0.95, 1.12, 0.13],
          ],
          0.014,
          CH,
          { seg: 12 },
        )
        kit.jerryCan(c, -0.86, 0.95, 0, '#8e2a20')
        c.roundBox(0.04, 0.22, 0.34, 0.01, Zg.steelMaterial, 0.86, 0.55, 0, { rot: [0, 0, -0.3] })
      }
    },
  )

  /* ================= Delivery motorcycle (CG 160 Cargo type, with a delivery box) ================= */
  /* Reference: Honda CG 160 Cargo 2016+ (Honda sheet, via motoragora.com.br, checked in 2026)
     Real measurements: length 2.038 · width 0.754 · height 1.087 (without the box) · wheelbase 1.315 · seat height 0.790
     · clearance 0.170 · tyres 80/100-18 (diameter 0.617) and 90/90-18 (diameter 0.619) · overhangs about 0.34 / 0.38 (from memory)
     · fibre delivery box about 0.46 x 0.44 x 0.42 (from memory, courier standard).
     Signature traits:
     front: multi-reflector trapezoid headlight in the short fairing; indicators on stalks; short fender; tubular leg guard.
     side: white from the factory; tall tank with black fins; short rider-only seat; large flat steel rack
     in place of the pillion; spoked wheels with drum brakes on both; silver single-cylinder engine; low chrome exhaust;
     chain guard; "CARGO" on the side cover.
     rear: square fibre box over the rack, the CG taillight under it, plate and indicators.
     from above: wide tank, short seat, wide rectangular rack behind with the box. */
  fx.register(
    {
      key: 'delivery_bike',
      group: 'motorcycles',
      name: trl('vehicles.delivery_bike.name'),
      inspired: trl('vehicles.delivery_bike.inspired'),
      article: trl('vehicles.delivery_bike.article'),
      category: trl('vehicles.delivery_bike.category'),
      fuel: 'flex',
      description: trl('vehicles.delivery_bike.description'),
      mass: 131,
      noise: 70,
      seats: trl('vehicles.delivery_bike.seats'),
      capacity: trl('vehicles.delivery_bike.capacity'),
      efficiency: trl('vehicles.delivery_bike.efficiency'),
      range: trl('vehicles.delivery_bike.range'),
      maxSpeed: 110,
      skill: trl('vehicles.delivery_bike.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#eceae3',
        col = c.paint(hex),
        blk = BLK,
        gray = CM('#4a4c4f', { metalness: 0.4, roughness: 0.45 })
      const XF = 0.6575,
        XR = -0.6575,
        RF = 0.3085,
        RR = 0.3095
      const fw = kit.spokedWheel(c, XF, RF, 0.042, { spokes: 36, label: trl('labels.front_tire') })
      const rw = kit.spokedWheel(c, XR, RR, 0.047, { spokes: 36, label: trl('labels.rear_tire') })
      drumHub(fw, 0.075, 1)
      drumHub(rw, 0.085, -1)
      const Z = { fairing: [], handlebar: [], fuel_tank: [], seat: [], engine: [], exhaust: [] }
      let n0
      c.tube(
        [
          [0.36, 0.93, 0],
          [0.25, 0.66, 0],
          [0.12, 0.34, 0],
          [-0.16, 0.26, 0],
          [-0.2, 0.5, 0],
          [-0.14, 0.7, 0],
        ],
        0.02,
        blk,
        { seg: 40 },
      )
      c.tube(
        [
          [0.36, 0.93, 0],
          [0.1, 0.8, 0],
          [-0.14, 0.72, 0],
          [-0.5, 0.74, 0],
          [-0.86, 0.78, 0],
        ],
        0.019,
        blk,
        { seg: 40 },
      )
      c.cylinder(0.035, 0.035, 0.16, blk, 0.37, 0.91, 0).rotation.z = -0.42
      n0 = c.vehicle.children.length
      const eng = singleEngine(c, { x: 0.02, y: 0.42, tilt: 0.32 })
      Z.engine = grab(c, n0)
      /* white tank with black fins */
      n0 = c.vehicle.children.length
      const TK = [
        [0.38, 0.93, 0.77, 0.14, 2.2],
        [0.3, 0.965, 0.71, 0.3, 2.4],
        [0.14, 0.96, 0.69, 0.34, 2.4],
        [0.0, 0.92, 0.7, 0.3, 2.4],
        [-0.08, 0.86, 0.73, 0.2, 2.2],
        [-0.11, 0.83, 0.77, 0.08, 2],
      ]
      body(c, TK, col)
      ;[1, -1].forEach(function (s) {
        body(
          c,
          [
            [0.4, 0.88, 0.78, 0.03, 2, s * 0.13],
            [0.3, 0.87, 0.6, 0.04, 2, s * 0.17],
            [0.18, 0.81, 0.58, 0.03, 2, s * 0.17],
            [0.12, 0.75, 0.64, 0.02, 2, s * 0.15],
          ],
          blk,
          { p: 2 },
        )
        c.text(trl('texts.titan_160'), 0.2, 0.05, 0.17, 0.9, s * (loftHalf(TK, 0.17, 0.9) + 0.003), s > 0 ? '+z' : '-z', {
          fg: '#a4241d',
          size: 0.8,
        })
      })
      c.cylinder(0.032, 0.032, 0.012, MT.chrome, 0.24, 0.968, 0)
      Z.fuel_tank = grab(c, n0)
      /* short rider-only seat, side covers with "CARGO", large steel rack and the box */
      n0 = c.vehicle.children.length
      body(
        c,
        [
          [-0.04, 0.83, 0.75, 0.16],
          [-0.14, 0.8, 0.73, 0.27],
          [-0.4, 0.805, 0.74, 0.27],
          [-0.48, 0.83, 0.76, 0.18],
        ],
        SEAT,
        { p: 3 },
      )
      body(
        c,
        [
          [-0.06, 0.76, 0.58, 0.22, 2.6],
          [-0.3, 0.77, 0.6, 0.24, 2.6],
          [-0.6, 0.8, 0.68, 0.2, 2.6],
          [-0.82, 0.8, 0.74, 0.12, 2.4],
          [-0.9, 0.79, 0.76, 0.05],
        ],
        col,
      )
      c.roundBox(0.22, 0.16, 0.18, 0.04, blk, -0.24, 0.6, 0)
      ;[1, -1].forEach(function (s) {
        body(
          c,
          [
            [-0.06, 0.73, 0.6, 0.02, 2, s * 0.12],
            [-0.16, 0.74, 0.54, 0.035, 2.2, s * 0.13],
            [-0.34, 0.75, 0.56, 0.035, 2.2, s * 0.13],
            [-0.46, 0.76, 0.64, 0.02, 2, s * 0.12],
          ],
          blk,
          { p: 2.2 },
        )
        c.text('CARGO', 0.12, 0.045, -0.26, 0.66, s * 0.152, s > 0 ? '+z' : '-z', { fg: '#e8e6df', size: 0.9 })
      })
      const RY = 0.855
      c.roundBox(0.5, 0.022, 0.36, 0.008, blk, -0.72, RY, 0, { def: true })
      for (let i = 0; i < 6; i++) c.roundBox(0.012, 0.012, 0.34, 0.004, CM('#26272a', { metalness: 0.4 }), -0.5 - i * 0.09, RY + 0.015, 0)
      ;[1, -1].forEach(function (s) {
        c.tube(
          [
            [-0.46, RY, s * 0.18],
            [-0.97, RY, s * 0.18],
            [-0.97, RY, -s * 0.0],
          ],
          0.014,
          blk,
          { seg: 10 },
        )
        c.rod(new V3(-0.5, 0.78, s * 0.12), new V3(-0.52, RY, s * 0.17), 0.013, blk)
        c.rod(new V3(-0.85, 0.66, s * 0.11), new V3(-0.9, RY, s * 0.17), 0.013, blk)
      })
      const nB = c.vehicle.children.length /* everything on the box (case, lid, latch, lettering, reflective) goes to its zone */
      const cargoBox = c.roundBox(0.46, 0.42, 0.44, 0.03, CM('#b3201b', { roughness: 0.55 }), -0.74, RY + 0.22, 0, { def: true })
      c.roundBox(0.47, 0.035, 0.45, 0.015, CM('#8c1915', { roughness: 0.6 }), -0.74, RY + 0.43, 0)
      c.roundBox(0.03, 0.06, 0.08, 0.008, MT.steel, -0.505, RY + 0.36, 0)
      ;[1, -1].forEach(function (s) {
        c.text('ENTREGA', 0.36, 0.08, -0.74, RY + 0.26, s * 0.222, s > 0 ? '+z' : '-z', { fg: '#f3f1ea', size: 0.85 })
        c.text(trl('texts.fast'), 0.3, 0.07, -0.74, RY + 0.17, s * 0.222, s > 0 ? '+z' : '-z', { fg: '#f2c21a', size: 0.85 })
      })
      c.text('ENTREGA', 0.3, 0.07, -0.972, RY + 0.24, 0, '-x', { fg: '#f3f1ea', size: 0.85 })
      const refl = c.roundBox(0.006, 0.03, 0.3, 0.004, CM('#d7d9d2', { emissive: '#404040', roughness: 0.3 }), -0.972, RY + 0.12, 0)
      refl.castShadow = false
      const cargoBoxParts = c.vehicle.children.slice(nB)
      plateMoto(c, -1.0, 0.6)
      c.add(fenderGeo(XR, RR, 0.36, 1.2, 2.9, 0.14, 0.025, 0), blk, 0, 0, 0)
      ;[1, -1].forEach(function (s) {
        blinker(c, -0.88, 0.76, s * 0.15, false)
      })
      Z.seat = grab(c, n0).filter(function (m: any) {
        return cargoBoxParts.indexOf(m) < 0
      })
      kit.taillight(c, { style: 'vertical', x: -0.9, y: 0.775, z: 0, w: 0.12, h: 0.07, d: 0.06, side: 1, label: trl('labels.taillight') })
      /* the box's own zone: it dents, the lid comes loose and falls; torn off loses the cargo */
      c.zone('box', trl('labels.delivery_box'), [-1.0, -0.48, RY - 0.02, RY + 0.48, -0.26, 0.26], cargoBoxParts, {
        type: 'part',
        dir: [1, 0, 0],
        weight: 0.6,
        anchor: [-0.5, RY, 0],
        noFlap: true,
        fx: [
          trl('effects.none'),
          trl('effects.cosmetic_only_scratched_fibreglass'),
          trl('effects.cracked_box_the_lid_will_not_latch'),
          trl('effects.loose_box_the_cargo_falls_in_the_street'),
          trl('effects.box_torn_off_cargo_lost'),
        ],
      })
      /* swingarm, shock absorbers, chain with guard, footpegs, leg guard */
      ;[1, -1].forEach(function (s) {
        c.rod(new V3(-0.18, 0.4, s * 0.1), new V3(XR, RR, s * 0.1), 0.022, blk)
        c.rod(new V3(-0.6, 0.34, s * 0.13), new V3(-0.5, 0.76, s * 0.13), 0.014, MT.chrome)
        c.rod(new V3(-0.59, 0.38, s * 0.13), new V3(-0.52, 0.66, s * 0.13), 0.026, CM('#2a2b2e', { roughness: 0.5 }))
        c.roundBox(0.12, 0.022, 0.05, 0.01, RUBBER, 0.0, 0.32, s * 0.2)
        c.tube(
          [
            [0.32, 0.86, s * 0.07],
            [0.42, 0.66, s * 0.2],
            [0.36, 0.38, s * 0.22],
            [0.16, 0.3, s * 0.14],
          ],
          0.016,
          blk,
          { seg: 20 },
        )
      })
      c.roundBox(0.5, 0.06, 0.03, 0.02, blk, -0.42, 0.38, -0.12, { rot: [0, 0, 0.15] })
      c.rod(new V3(-0.06, 0.3, -0.14), new V3(-0.16, 0.06, -0.26), 0.012, blk)
      n0 = c.vehicle.children.length
      c.tube(
        [
          [eng.exh.x, eng.exh.y, 0.06],
          [eng.exh.x + 0.05, eng.exh.y - 0.1, 0.12],
          [0.08, 0.26, 0.16],
          [-0.3, 0.32, 0.18],
          [-0.48, 0.4, 0.18],
        ],
        0.022,
        EXH,
        { seg: 40 },
      )
      c.cylinder(0.055, 0.045, 0.42, EXH, -0.66, 0.46, 0.18).rotation.z = -PI / 2 + 0.22
      c.roundBox(0.32, 0.07, 0.03, 0.03, HEAT, -0.62, 0.48, 0.23, { rot: [0, 0, 0.22] })
      Z.exhaust = grab(c, n0)
      fork(c, [0.38, 0.95], [XF, RF], 0.085, 0.017, MT.chrome, gray)
      n0 = c.vehicle.children.length
      fender(c, XF, RF, 0.345, 0.2, 2.2, 0.12, 0.02, col)
      body(
        c,
        [
          [0.4, 1.01, 0.8, 0.22, 2.6],
          [0.47, 1.0, 0.8, 0.26, 2.6],
          [0.53, 0.98, 0.82, 0.24, 2.6],
          [0.565, 0.94, 0.84, 0.12, 2.2],
        ],
        col,
      )
      c.roundBox(0.1, 0.07, 0.18, 0.02, blk, 0.36, 1.04, 0, { rot: [0, 0, 0.4] })
      c.roundBox(0.02, 0.05, 0.15, 0.01, MT.gauge, 0.39, 1.06, 0, { rot: [0, 0, 0.4] })
      ;[1, -1].forEach(function (s) {
        blinker(c, 0.48, 0.9, s * 0.17, true)
      })
      Z.fairing = grab(c, n0)
      lamp(c, { style: 'rect', x: 0.57, y: 0.91, z: 0, w: 0.2, h: 0.11, d: 0.08, side: 1, label: trl('labels.headlight') })
      n0 = c.vehicle.children.length
      handlebar(c, 0.36, 1.02, 0.36, { rise: 0.03, back: 0.06, mat: MT.chrome, stalk: 0.19 })
      Z.handlebar = grab(c, n0)
      zoneParts(c, Z)
      c.part('engine', trl('labels.engine'), null, new V3(0.02, 0.45, 0), 0.8)
      c.part('fuel_tank', trl('labels.tank'), null, new V3(0.15, 0.84, 0), 0.7)
      c.part('cargo', trl('labels.delivery_box'), cargoBox, new V3(-0.74, RY + 0.22, 0), 0.6)
      bikeMeta(c, {
        length: 2.04,
        width: 0.754,
        front: 1.0,
        rear: -1.012,
        clearance: 0.17,
        bodyHeight: 0.62,
        top: 1.087,
        belt: 0.84,
        color: hex,
        rack: RY + 0.45,
        exhaust: new V3(-0.87, 0.5, 0.18),
      })
      /* modified: armoured box with plate and grille, side cans, engine guard */
      c.meta.armor = function (c: any, Zg: any) {
        c.roundBox(0.48, 0.44, 0.012, 0.004, Zg.steelMaterial, -0.74, RY + 0.22, 0.228)
        c.roundBox(0.48, 0.44, 0.012, 0.004, Zg.steelMaterial, -0.74, RY + 0.22, -0.228)
        for (let i = 0; i < 4; i++)
          c.rod(new V3(-0.96 + i * 0.15, RY + 0.47, -0.22), new V3(-0.96 + i * 0.15, RY + 0.47, 0.22), 0.008, MT.steel)
        ;[1, -1].forEach(function (s) {
          kit.jerryCan(c, -0.45, 0.6, s * 0.3, s > 0 ? '#8e2a20' : '#3e5a34')
        })
        c.roundBox(0.42, 0.06, 0.3, 0.02, Zg.steelMaterial, 0.05, 0.25, 0)
        roofLamp(c, 0.6, 1.05, 0.13)
        roofLamp(c, 0.6, 1.05, -0.13)
      }
    },
  )
}
