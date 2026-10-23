import type { FleetContext } from '../context'

/* Planes added after the first batch (group H). Uses only the kit API and the water/air helpers exposed as the shared EA
   (fuselage, airfoil, propeller, navigation lights, moulded glass, bake).
   Local helpers of this file (not in the core): pose3 (tail-down attitude), starDecal (generic star),
   pod (pod/rocket), hpoly (rounded window polygon), twinProp and frame3 (see comments). */
export function installPlanesExtra(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const shared = fx.shared
  const trl = fx.t
  const lbl = fx.label

  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial,
    _G = kit.geo,
    _DS = THREE.DoubleSide

  /* ================= local utilities (group H) ================= */
  /* conventional-gear aircraft attitude: finds the inclination TH at which the main wheel (Af, radius ra) and the tail wheel
     (Tf, radius rt), given in the flight frame, touch the ground together; returns P(x,y,z) that takes flight to ground */
  function pose3(Af: any, ra: any, Tf: any, rt: any) {
    let lo = 0,
      hi = 0.5,
      TH = 0
    function f(t: any) {
      const s = Math.sin(t),
        c = Math.cos(t)
      return Af[0] * s + Af[1] * c - ra - (Tf[0] * s + Tf[1] * c - rt)
    }
    for (let i = 0; i < 50; i++) {
      TH = (lo + hi) / 2
      if (f(TH) > 0) hi = TH
      else lo = TH
    }
    const s = Math.sin(TH),
      c = Math.cos(TH),
      Y0 = ra - (Af[0] * s + Af[1] * c)
    const P = function (x: any, y: any, z?: any) {
      return new V3(x * c - y * s, x * s + y * c + Y0, z || 0)
    }
    const M = new THREE.Matrix4().compose(new V3(0, Y0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, TH)), new V3(1, 1, 1))
    return { TH: TH, Y0: Y0, P: P, M: M }
  }
  /* generic five-point star (fictional insignia) on a disc, facing a face */
  function starDecal(c: any, x: any, y: any, z: any, r: any, face: any, o: any) {
    o = o || {}
    const sh = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const a = PI / 2 + (i * PI) / 5,
        rr = i % 2 ? r * 0.42 : r
      const px = Math.cos(a) * rr,
        py = Math.sin(a) * rr
      if (i) sh.lineTo(px, py)
      else sh.moveTo(px, py)
    }
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.userData.rigid = true
    ;(o.parent || c.vehicle).add(g)
    if (o.ring !== false) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 28), CM(o.bg || '#2f3a2c', { roughness: 0.8 }))
      g.add(d)
    }
    const s = new THREE.Mesh(new THREE.ShapeGeometry(sh), CM(o.fg || '#c9c6b2', { roughness: 0.8 }))
    s.position.z = 0.002
    g.add(s)
    if (face === '+y') g.rotation.x = -PI / 2
    else if (face === '-y') g.rotation.x = PI / 2
    else g.rotation.y = ({ '+z': 0, '-z': PI, '+x': PI / 2, '-x': -PI / 2 } as Record<string, number>)[face] || 0
    if (o.rot) g.rotation.z += o.rot
    g.children.forEach(function (m: any) {
      m.castShadow = false
    })
    return g
  }
  /* rounded polygon (window) in the x-y plane: rectangle [x0, x1, y0, y1] with corners of radius r */
  function rrect(x0: any, x1: any, y0: any, y1: any, r: any, n?: any) {
    n = n || 4
    const pts: any = [],
      cs = [
        [x1 - r, y1 - r, 0],
        [x0 + r, y1 - r, PI / 2],
        [x0 + r, y0 + r, PI],
        [x1 - r, y0 + r, 1.5 * PI],
      ]
    cs.forEach(function (q) {
      for (let i = 0; i <= n; i++) {
        const a = q[2] + ((i / n) * PI) / 2
        pts.push([q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r])
      }
    })
    return pts
  }
  /* sdf of several windows (union) to cut the skin at once */
  function polysSdf(EA: any, polys: any) {
    const fs = polys.map(function (p: any) {
      return EA.polySdf(p)
    })
    return function (x: any, y: any) {
      let d = 1e9
      fs.forEach(function (f: any) {
        d = Math.min(d, f(x, y))
      })
      return d
    }
  }
  /* skin, glass and cut-out with local subdivision (windows and strips smaller than the fuselage triangles):
     pre = coarse cut-out test done before, without subdividing, to limit the subdivided area */
  function cutSub(m: any, tests: any, sub: any, pre: any) {
    if (pre) kit.cutMesh(m, [pre], 40)
    kit.cutMesh(m, tests, 40, { sub: sub || 0.08 })
  }
  function scaleSt(st: any, k: any) {
    return st.map(function (s: any) {
      const cy = (s[1] + s[2]) / 2,
        hh = ((s[2] - s[1]) / 2) * k
      return [s[0], cy - hh, cy + hh, s[3] * k, s[4], s[5]]
    })
  }
  function fSkin(c: any, EA: any, st: any, keep: any, mat: any, o: any) {
    o = o || {}
    const m = c.add(EA.fuseGeo(scaleSt(st, o.k || 1.004), { smooth: o.smooth || 48, seg: o.seg || 30 }), mat, 0, 0, 0, o.parent)
    m.castShadow = false
    cutSub(m, [keep], o.sub || 0.06, o.pre)
    c.deform.push(m)
    return m
  }
  function fGlass(c: any, EA: any, st: any, keep: any, label: any, type: any, o: any) {
    o = o || {}
    const m = new THREE.Mesh(EA.fuseGeo(scaleSt(st, o.k || 0.988), { smooth: o.smooth || 48, seg: o.seg || 30 }), o.mat || MT.glass)
    ;(o.parent || c.vehicle).add(m)
    cutSub(m, [keep], o.sub || 0.07, o.pre)
    return kit.asGlass(c, m, label, type || 'tempered', o.pos ? { pos: o.pos } : {})
  }
  /* pod/tank elongated along x (rocket, wing tank, simple float) */
  function pod(c: any, EA: any, x0: any, x1: any, y: any, z: any, r: any, mat: any, o?: any) {
    o = o || {}
    const L = x0 - x1,
      st = [
        [x0, y - r * 0.05, y + r * 0.05, r * 0.1, 2],
        [x0 - L * 0.08, y - r * 0.7, y + r * 0.7, r * 1.4, 2],
        [x0 - L * 0.22, y - r, y + r, r * 2, 2],
        [x1 + L * 0.15, y - r, y + r, r * 2, 2],
        [x1 + L * 0.02, y - r * 0.8, y + r * 0.8, r * 1.6, 2],
        [x1, y - r * 0.55, y + r * 0.55, r * 1.1, 2],
      ]
    st.forEach(function (s) {
      s.push(z)
    })
    const m = c.add(EA.fuseGeo(st, { smooth: 18, seg: 18 }), mat, 0, 0, 0, o.parent)
    return m
  }

  /* fuselage half width (stations [x, low y, high y, width, exponent]) at height y, interpolating the stations in x */
  function halfW(ST: any, x: any, y: any) {
    for (let i = 0; i < ST.length - 1; i++) {
      const a = ST[i],
        b = ST[i + 1]
      if (x > a[0] || x < b[0]) continue
      const t = (a[0] - x) / (a[0] - b[0] || 1),
        L = function (k: any, d?: any) {
          return (a[k] == null ? d : a[k]) * (1 - t) + (b[k] == null ? d : b[k]) * t
        }
      const yb = L(1),
        yt = L(2),
        w = L(3),
        p = L(4, 2.4),
        cc = (yb + yt) / 2,
        hh = (yt - yb) / 2,
        d = Math.abs(y - cc) / hh
      return d >= 1 ? 0 : (w / 2) * Math.pow(1 - Math.pow(d, p), 1 / p)
    }
    return 0
  }
  /* floor or lining that fits inside the fuselage: runs of up to 1 m, each with the minimum width of the run minus the clearance */
  function liner(c: any, ST: any, x0: any, x1: any, y: any, mat: any, o?: any) {
    o = o || {}
    const n = Math.max(1, Math.ceil((x1 - x0) / 1.0)),
      dx = (x1 - x0) / n,
      out = []
    for (let i = 0; i < n; i++) {
      const a = x0 + i * dx
      let m = 9
      for (let k = 0; k <= 8; k++) m = Math.min(m, halfW(ST, a + (dx * k) / 8, y))
      const w = Math.min(o.maxW || 9, 2 * (m - (o.gap || 0.05)))
      if (w < 0.12) continue
      const r = c.roundBox(dx + 0.01, o.h || 0.02, w, 0.01, mat, a + dx / 2, y, 0, o.parent ? { parent: o.parent } : {})
      r.castShadow = false
      out.push(r)
    }
    return out
  }
  /* registration glued on the tapering flank: centre on the outside and a yaw that follows the taper */
  function sideText(c: any, ST: any, txt: any, w: any, h: any, x: any, y: any, s: any, o: any) {
    const a = halfW(ST, x + w / 2, y),
      b = halfW(ST, x - w / 2, y),
      m = c.text(txt, w, h, x, y, s * ((a + b) / 2 + 0.014), s > 0 ? '+z' : '-z', o)
    m.rotation.y += -s * Math.atan2(a - b, w)
    return m
  }

  /* helpers also used by the helicopters file (same group H) */
  shared.GH = {
    pose3: pose3,
    starDecal: starDecal,
    rrect: rrect,
    polysSdf: polysSdf,
    pod: pod,
    cutSub: cutSub,
    scaleSt: scaleSt,
    fSkin: fSkin,
    fGlass: fGlass,
    halfW: halfW,
    liner: liner,
    sideText: sideText,
  }

  /* ================= Light tail-dragger (J-3 Cub type) ================= */
  /* Reference · Piper J-3 Cub (J3C-65) - WebSearch (aerocorner, AOPA, Smithsonian NASM, museumofflight) and partly from memory
     Real measurements: length 6.83 m · span 10.74 m · height 2.03 m (three-point attitude) · wing chord 1.60 m (area 16.6 m2) ·
     main gear track about 1.83 m (from memory) · main tyres 8.00-4 about 0.50 m (from memory) · tail wheel about 0.15 m ·
     wheelbase (main wheel to tail wheel) about 5.0 m (from memory) · two-blade wooden propeller 1.83 m (72 in) · fuselage width about 0.71 m ·
     three-point angle about 10-11 degrees · front overhang (axle to propeller hub) about 1.3 m · Continental A-65 engine of 65 hp · 45 L tank in the nose.
     Signature traits:
     front: short blunt cowling with the heads of the 4 cylinders sticking out of the sides of the cowling, wooden propeller without a spinner,
     V main gear with a split axle and bungee shock absorber, straight high wing with V struts
     side: Cub yellow with the black lightning bolt (black stripe that starts at the nose and breaks in a zigzag), fuel gauge float
     (wire) coming out of the cowling ahead of the windshield, split right door (upper half lifts), small triangular window
     behind the wing, V struts meeting at the lower longeron, low tail (three-point) with a leaf-spring tail wheel
     rear: large rounded rudder, round-tipped elevator braced by wires, narrow tall fuselage
     top: rectangular wing with rounded tips, transparent skylight over the cabin, fabric ribs */
  fx.register(
    {
      key: 'tandem_trainer',
      group: 'air',
      name: trl('vehicles.tandem_trainer.name'),
      inspired: trl('vehicles.tandem_trainer.inspired'),
      category: trl('vehicles.tandem_trainer.category'),
      fuel: 'avgas',
      description: trl('vehicles.tandem_trainer.description'),
      mass: 553,
      noise: 250,
      seats: trl('vehicles.tandem_trainer.seats'),
      capacity: trl('vehicles.tandem_trainer.capacity'),
      efficiency: trl('vehicles.tandem_trainer.efficiency'),
      range: trl('vehicles.tandem_trainer.range'),
      maxSpeed: 140,
      skill: trl('vehicles.tandem_trainer.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        yel = '#f0bd22'
      const Q = pose3([1.62, -0.78], 0.25, [-3.24, -0.27], 0.075),
        P = Q.P,
        TH = Q.TH
      const grp = new THREE.Group()
      grp.position.set(0, Q.Y0, 0)
      grp.rotation.z = TH
      c.vehicle.add(grp)
      grp.updateMatrix()
      const PG = { parent: grp }
      const body = c.paint(yel),
        black = c.paint('#141414', { roughness: 0.5 }),
        dark = CM('#232427', { roughness: 0.6 })
      /* fuselage (flight frame, thrust axis at y = 0): blunt cowling, tall cabin under the wing, narrow tall cone */
      const ST = [
        [3.0, -0.17, 0.12, 0.26, 2.2],
        [2.94, -0.3, 0.24, 0.56, 2.6],
        [2.72, -0.37, 0.29, 0.68, 3.2],
        [2.3, -0.41, 0.32, 0.71, 3.6],
        [1.95, -0.44, 0.36, 0.71, 3.8],
        [1.4, -0.47, 0.72, 0.71, 3.8],
        [0.6, -0.47, 0.75, 0.71, 3.8],
        [-0.12, -0.45, 0.75, 0.7, 3.6],
        [-0.6, -0.41, 0.6, 0.64, 3.4],
        [-1.4, -0.32, 0.47, 0.52, 3.2],
        [-2.25, -0.21, 0.36, 0.38, 3],
        [-2.95, -0.1, 0.27, 0.22, 2.6],
        [-3.38, -0.04, 0.22, 0.08, 2.2],
        [-3.46, -0.01, 0.2, 0.02, 2],
      ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 32 }), body, 0, 0, 0, grp)
      const wsK = [1.38, 1.98, 0.3, 0.8, null, 0.37]
      const sideW = [
          [1.36, 0.06],
          [0.12, 0.06],
          [0.12, 0.72],
          [1.4, 0.72],
        ],
        quarter = [
          [-0.06, 0.12],
          [-0.62, 0.22],
          [-0.62, 0.5],
          [-0.06, 0.66],
        ]
      kit.cutMesh(
        fus,
        [
          EA.cutT(wsK, function (n: any) {
            return n.y > 0.12
          }),
          EA.sideCutP(sideW, 0.25),
          EA.sideCutP(quarter, 0.2),
        ],
        40,
      )
      c.deform.push(fus)
      /* black bolt: stripe that starts at the nose and breaks in a zigzag at windshield height */
      const bolt = function (x: any) {
        return x > 2.0
          ? 0.02
          : x > 1.72
            ? 0.02 - ((2.0 - x) / 0.28) * 0.22
            : x > 1.5
              ? -0.2 + ((1.72 - x) / 0.22) * 0.14
              : -0.06 - (1.5 - x) * 0.012
      }
      const boltW = function (x: any) {
        return x > 1.5 ? 0.065 : Math.max(0.035, 0.065 - (1.5 - x) * 0.007)
      }
      fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(boltW(x) - Math.abs(y - bolt(x)), x + 3.2, 2.93 - x, Math.abs(z) - 0.12)
        }),
        black,
        { parent: grp, sub: 0.05, pre: EA.keepT([-3.3, 3.0, -0.35, 0.2, 0.1]) },
      )
      /* split door on the right side (gap) and cowling seams */
      const doorR = EA.polySdf([
        [1.38, -0.4],
        [0.14, -0.4],
        [0.14, 0.72],
        [1.4, 0.72],
      ])
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.006 - Math.min(Math.abs(doorR(x, y)), x > 0.14 && x < 1.38 ? Math.abs(y - 0.06) : 9), z - 0.25)
        }),
        MT.dark,
        { parent: grp, k: 1.003 },
      )
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.006 - Math.abs(x - 2.28), y + 0.38)
        }),
        MT.dark,
        { parent: grp, k: 1.003 },
      )
      /* cylinder heads sticking out of the cowling (two on each side), with fins */
      ;[1, -1].forEach(function (s) {
        ;[2.58, 2.3].forEach(function (x, i) {
          const xx = x - (s > 0 ? 0.06 : 0) + i * 0.0
          const alu = CM('#a7acae', { metalness: 0.55, roughness: 0.4 })
          c.cylinder(0.07, 0.07, 0.2, alu, xx, -0.02, s * 0.4, 'z', { seg: 14, parent: grp })
          for (let k = 0; k < 6; k++) c.cylinder(0.092, 0.092, 0.01, alu, xx, -0.02, s * (0.35 + k * 0.025), 'z', { seg: 14, parent: grp })
          c.roundBox(0.07, 0.035, 0.06, 0.012, dark, xx, 0.08, s * 0.47, PG)
          c.cylinder(0.012, 0.012, 0.08, MT.trim, xx - 0.04, 0.03, s * 0.47, null, PG)
        })
        c.text('PP-ZCB', 1.0, 0.2, -1.75, 0.13, s * 0.25, s > 0 ? '+z' : '-z', { fg: '#151515', parent: grp })
      })
      /* nose: air intakes (nostrils), exhaust, oil cap, tank with a wire float ahead of the windshield */
      ;[1, -1].forEach(function (s) {
        c.sphere(0.07, MT.dark, 2.97, -0.12, s * 0.15, 0.4, 0.7, 1, PG)
      })
      c.cylinder(0.03, 0.035, 0.42, MT.steel, 2.55, -0.43, 0.08, 'x', PG)
      c.cylinder(0.035, 0.035, 0.04, MT.chrome, 2.1, 0.35, 0, null, PG)
      c.rod(new V3(2.06, 0.34, 0), new V3(2.06, 0.62, 0), 0.004, MT.steel, PG)
      c.roundBox(0.012, 0.012, 0.06, 0.004, MT.steel, 2.06, 0.62, 0, PG)
      /* interior: floor, two seats in tandem, two sticks, simple panel with 5 gauges, throttle on the left */
      const fl = -0.4,
        fab = CM('#3c3a35', { roughness: 0.9 })
      c.roundBox(2.0, 0.025, 0.6, 0.01, MT.carpet, 0.55, fl, 0, PG).castShadow = false
      kit.seat(c, 0.62, fl, 0, { w: 0.48, h: 0.3, back: 0.55, lean: 0.2, mat: fab, parent: grp, headrest: false })
      kit.seat(c, -0.22, fl + 0.04, 0, { w: 0.5, h: 0.3, back: 0.58, lean: 0.2, mat: fab, parent: grp, headrest: false })
      ;[1.12, 0.3].forEach(function (x) {
        c.rod(new V3(x, fl, 0), new V3(x - 0.05, fl + 0.5, 0), 0.012, MT.plastic, PG)
        c.sphere(0.025, MT.plastic, x - 0.055, fl + 0.52, 0, 1, 1.4, 1, PG)
      })
      c.roundBox(0.05, 0.22, 0.6, 0.02, CM('#2a2b2d', { roughness: 0.8 }), 1.75, 0.3, 0, PG)
      ;[-0.2, -0.08, 0.04, 0.16, -0.14].forEach(function (z, i) {
        c.cylinder(0.032, 0.032, 0.01, MT.gauge, 1.72, i < 4 ? 0.32 : 0.22, z, 'x', { seg: 14, parent: grp }).castShadow = false
      })
      c.roundBox(0.1, 0.03, 0.03, 0.01, MT.plastic, 1.1, 0.0, -0.32, PG)
      /* straight high wing with round tips (chord 1.60 m), dihedral 1 degree, skylight in the middle */
      const wingMat = c.paint(yel),
        wings = []
      function halfWing(s: any) {
        const dh = function (z: any) {
          return 0.8 + z * 0.017
        }
        const g = EA.foilGeo(
          [
            { p: [1.46, dh(0), 0], c: 1.6, t: 0.12, cam: 0.025, noCap: true },
            { p: [1.46, dh(2.6), s * 2.6], c: 1.6, t: 0.12, cam: 0.025 },
            { p: [1.46, dh(4.9), s * 4.9], c: 1.6, t: 0.12, cam: 0.025 },
            { p: [1.43, dh(5.18), s * 5.18], c: 1.5, t: 0.11, cam: 0.02 },
            { p: [1.36, dh(5.32), s * 5.32], c: 1.22, t: 0.09, cam: 0.015 },
            { p: [1.22, dh(5.37), s * 5.37], c: 0.82, t: 0.06, cam: 0.01 },
          ],
          { up: 'y', n: 14 },
        )
        const w = c.add(g, wingMat, 0, 0, 0, grp)
        c.deform.push(w)
        wings.push(w)
        if (s < 0)
          kit.cutMesh(
            w,
            [
              EA.cutT([0.55, 1.3, 0.85, 1.1, null, 0.32], function (n: any) {
                return n.y > 0.5
              }),
            ],
            30,
          )
        /* fabric ribs (discreet threads on the upper surface) and aileron hinge */
        for (let z = 0.6; z < 5.0; z += 0.36)
          c.roundBox(1.25, 0.006, 0.012, 0.003, CM('#d9a81e', { roughness: 0.5 }), 0.9, dh(z) + 0.097, s * z, PG).castShadow = false
        c.roundBox(0.012, 0.012, 2.4, 0.004, MT.dark, -0.06, dh(3.7) + 0.05, s * 3.7, PG).castShadow = false
        EA.navLight(
          c,
          1.0,
          dh(5.35),
          s * 5.4,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.right_navigation_light_green') : trl('labels.left_navigation_light_red'),
          { parent: grp, r: 0.035 },
        )
        /* V struts: from the lower longeron to the wing spars, and intermediate struts */
        const f0 = new V3(0.85, -0.44, s * 0.35),
          fa = new V3(1.18, dh(3.0) - 0.06, s * 3.0),
          fb = new V3(0.22, dh(3.0) - 0.04, s * 3.0)
        ;[fa, fb].forEach(function (q) {
          const st = c.rod(f0, q, 0.024, body, { parent: grp, seg: 10 })
          st.scale.x = 1.6
          c.deform.push(st)
        })
        const ma = f0.clone().lerp(fa, 0.55),
          mb = f0.clone().lerp(fb, 0.55)
        c.rod(ma, new V3(ma.x, dh(ma.z * s) - 0.05, ma.z), 0.01, MT.steel, PG)
        c.rod(mb, new V3(mb.x, dh(mb.z * s) - 0.04, mb.z), 0.01, MT.steel, PG)
        c.roundBox(0.1, 0.04, 0.06, 0.015, MT.steel, 0.85, -0.45, s * 0.35, PG)
        return w
      }
      halfWing(1)
      halfWing(-1)
      /* skylight (glass over the cabin, in the centre of the left/right wing) */
      const sky = c.roundBox(0.68, 0.012, 0.6, 0.006, MT.glass, 0.92, 0.94, 0, PG)
      sky.castShadow = false
      const lpP = P(1.46, 0.84, -2.2)
      EA.lamp(c, lpP.x, lpP.y, lpP.z, 0.055, trl('labels.landing_light_left_wing'))
      /* empennage: round-tipped elevator, fin and large rounded rudder, wire stays */
      const tailMat = c.paint(yel)
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-2.78, 0.1, 0], c: 0.78, t: 0.07 },
              { p: [-2.85, 0.1, s * 1.1], c: 0.74, t: 0.07 },
              { p: [-2.95, 0.1, s * 1.36], c: 0.6, t: 0.06 },
              { p: [-3.1, 0.1, s * 1.46], c: 0.32, t: 0.05 },
            ],
            { up: 'y', n: 10 },
          ),
          tailMat,
          0,
          0,
          0,
          grp,
        )
        c.deform.push(hs)
        c.rod(new V3(-3.1, 0.12, s * 0.75), new V3(-3.15, 0.75, 0), 0.004, MT.steel, PG)
        c.rod(new V3(-3.1, 0.1, s * 0.75), new V3(-3.0, -0.08, s * 0.08), 0.004, MT.steel, PG)
      })
      const fin = c.add(
        EA.foilGeo(
          [
            { p: [-2.85, 0.2, 0], c: 0.72, t: 0.08 },
            { p: [-2.98, 0.6, 0], c: 0.7, t: 0.08 },
            { p: [-3.1, 0.9, 0], c: 0.6, t: 0.07 },
            { p: [-3.24, 1.06, 0], c: 0.44, t: 0.06 },
            { p: [-3.38, 1.12, 0], c: 0.2, t: 0.05 },
          ],
          { up: 'z', n: 10 },
        ),
        tailMat,
        0,
        0,
        0,
        grp,
      )
      c.deform.push(fin)
      c.roundBox(0.012, 0.75, 0.05, 0.004, MT.dark, -3.23, 0.6, 0, { parent: grp, rot: [0, 0, 0.08] }).castShadow = false
      EA.navLight(c, -3.56, 0.3, 0, 'white', trl('labels.tail_light'), { parent: grp, r: 0.03 })
      /* 1.83 m two-blade wooden propeller (without a spinner) */
      const pr = EA.propeller(c, 3.06, 0.0, 0, {
        R: 0.915,
        blades: 2,
        chord: 0.13,
        spinner: false,
        mat: CM('#7a4e2a', { roughness: 0.45, metalness: 0.05 }),
        tip: '#e3c348',
        parent: grp,
      })
      c.cylinder(0.06, 0.07, 0.08, MT.steel, 3.02, 0, 0, 'x', PG)
      EA.bake(c, grp)
      /* moulded glass (in the ground frame, through the attitude matrix) */
      EA.fuseGlass(c, ST, EA.keepT(wsK), lbl('windshield'), 'laminated', { M: Q.M, pos: P(1.7, 0.55) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(c, ST, EA.sideKeepP(sideW, 0.25, s), s > 0 ? lbl('door_window_right') : lbl('left_side_window'), 'tempered', {
          M: Q.M,
          pos: P(0.8, 0.4, s * 0.35),
        })
        EA.fuseGlass(
          c,
          ST,
          EA.sideKeepP(quarter, 0.2, s),
          s > 0 ? lbl('right_small_rear_window') : lbl('left_small_rear_window'),
          'tempered',
          { M: Q.M, pos: P(-0.35, 0.4, s * 0.3) },
        )
      })
      kit.asGlass(c, sky, lbl('skylight'), 'tempered')
      ;[1, -1].forEach(function (s) {
        const d0 = P(0.62, 0.06, s * 0.355),
          d1 = P(0.62, 0.72, s * 0.355)
        c.rod(d0, d1, 0.012, c.paint(yel))
      })
      /* V main gear (ground frame): front and rear legs to the axle, split axle to the centre, bungees */
      const leg = CM('#e0b020', { roughness: 0.45, metalness: 0.2 }),
        A = P(1.62, -0.78),
        gearObjs = []
      ;[1, -1].forEach(function (s) {
        const ax = new V3(A.x, 0.25, s * 0.86),
          f1 = P(2.0, -0.45, s * 0.34),
          f2 = P(1.22, -0.47, s * 0.34),
          mid = P(1.6, -0.48, s * 0.06)
        gearObjs.push(c.rod(f1, ax, 0.024, leg), c.rod(f2, ax, 0.024, leg), c.rod(mid, ax, 0.02, MT.steel))
        c.cylinder(0.04, 0.04, 0.12, MT.dark, P(1.62, -0.5, s * 0.3).x, P(1.62, -0.5).y, s * 0.3, 'x')
        c.wheel(A.x, s * 0.915, 0.25, 0.16, { spokes: 0, rimR: 0.42, noPart: true, rim: CM('#d9d7d0', { metalness: 0.4 }) })
      })
      /* leaf-spring tail wheel, with a steering wheel */
      const t0 = P(-3.1, -0.05),
        t1 = P(-3.24, -0.27)
      c.rod(t0, new V3(t1.x, t1.y + 0.03, 0), 0.016, MT.steel)
      c.wheel(t1.x, 0.0001, 0.075, 0.05, { spokes: 0, noPart: true, rim: MT.steel })
      c.part('propeller', trl('labels.wooden_propeller'), pr, P(3.08, 0), 0.8)
      c.part('engine', trl('labels.continental_a_65_engine'), null, P(2.5, 0), 0.8)
      c.part('fuel_tank', trl('labels.nose_tank_45_l'), null, P(2.0, 0.1), 0.6)
      c.part('landing_gear', trl('labels.v_shaped_landing_gear'), null, new V3(A.x, 0.35, 0), 1.0)
      const F = P(3.1, 0).x,
        R = P(-3.6, 0.5).x
      Object.assign(c.meta, {
        kind: 'plane',
        length: F - R,
        width: 10.74,
        fuselageWidth: 0.71,
        front: F,
        rear: R,
        clearance: 0.55,
        belt: 1.3,
        bodyHeight: 1.2,
        top: 2.05,
        roof: null,
      })
      const bx = function (x0: any, x1: any) {
        return [P(x0, 0).x, P(x1, 0).x]
      }
      c.zone('cab', trl('labels.cabin_split_door_and_windows'), bx(-0.65, 1.38).concat([0.55, 2.0, -0.5, 0.5]), null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_pilot_and_the_passenger'),
        anyMesh: true,
      })
      c.zone('nose', trl('labels.hood_cylinders_and_propeller'), bx(1.38, 3.3).concat([0.45, 2.45, -0.55, 0.55]))
      c.zone('fuselage', trl('labels.rear_fuselage_fabric_covered'), bx(-2.75, -0.65).concat([0.3, 1.6, -0.4, 0.4]))
      c.zone('tail', trl('labels.rudder_elevator_and_tail_wheel'), bx(-3.8, -2.75).concat([-0.05, 1.7, -1.6, 1.6]))
      c.zone('fuel_tanks', trl('labels.nose_tank_45_l'), bx(1.75, 2.3).concat([1.1, 1.85, -0.36, 0.36]), null, {
        type: 'internal',
        fxKey: 'fuel_tank',
        sub: 'fuel_tank',
        pos: P(2.0, 0.1),
      })
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_light'))
      c.zone('headlight_left', trl('labels.landing_light'))
      c.meta.armor = function (c2: any) {
        /* modified bush plane: 0.8 m balloon tyres (tundra), cargo pod on the belly, cans on the back seat, wire cutter and spotlight */
        const tun = CM('#1b1b1a', { roughness: 0.95 })
        ;[1, -1].forEach(function (s) {
          c2.cylinder(0.4, 0.4, 0.3, tun, A.x, 0.4, s * 0.93, 'z', { seg: 26 })
          c2.cylinder(0.14, 0.14, 0.31, MT.steel, A.x, 0.4, s * 0.93, 'z')
        })
        const pd = pod(
          c2,
          shared.EA,
          P(1.4, -0.6).x,
          P(-1.2, -0.45).x,
          P(0.1, -0.66).y,
          0,
          0.17,
          CM('#5c6052', { roughness: 0.6, metalness: 0.2 }),
        )
        pd.rotation.z = 0
        c2.part('cargo', trl('labels.cargo_pod'), pd, new V3(0.4, 0.95, 0), 0.8)
        kit.jerryCan(c2, P(-0.22, -0.2).x, P(-0.22, -0.2).y, 0.0, '#8e2a20')
        const cw = P(1.95, 0.4),
          cw2 = P(1.35, 1.0)
        c2.rod(cw, cw2, 0.018, kit.steelMaterial)
        EA.lamp(c2, P(1.5, 0.8).x, P(1.5, 0.8).y, 2.6, 0.08, trl('labels.search_spotlight'))
      }
    },
  )
  /* ================= Twin turboprop commuter (EMB-110 type) ================= */
  /* Reference · Embraer EMB-110P1 Bandeirante - WebSearch/WebFetch (Wikipedia "Embraer EMB 110 Bandeirante", aerocorner, skybrary); gear from memory
     Real measurements: length 15.10 m · span 15.33 m · height 4.92 m · wing area 29.1 m2 · Hartzell three-blade propellers of 2.36 m ·
     main gear track about 4.94 m and wheelbase about 4.26 m (from memory) · tyres about 0.66 m (main) and 0.52 m (tail) (from memory) ·
     fuselage about 1.72 m wide and 1.85 m tall (from memory) · front overhang (nose wheel to nose) about 2.2 m · belly about 0.8 m off the ground.
     Signature traits:
     front: long tapered nose, two-piece V windshield, PT6 nacelles well ahead of the leading edge with three-blade propellers
     and an air intake on the nacelle chin, low wing with a pronounced dihedral
     side: long straight fuselage with a row of 8 square windows with rounded corners, large cargo door at the back left,
     PT6 exhausts coming out of the nacelle sides right behind the propeller, main gear retracting into the nacelle, blue stripe on the window line
     rear: tall swept fin with a long dorsal fin, elevator with strong dihedral (about 10 degrees) fixed to the tail cone
     top: straight trapezoid wing with straight tips, long nacelles that pass the trailing edge, shallow V elevator */
  fx.register(
    {
      key: 'regional_turboprop',
      group: 'air',
      name: trl('vehicles.regional_turboprop.name'),
      inspired: trl('vehicles.regional_turboprop.inspired'),
      category: trl('vehicles.regional_turboprop.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.regional_turboprop.description'),
      mass: 5900,
      noise: 650,
      seats: trl('vehicles.regional_turboprop.seats'),
      capacity: trl('vehicles.regional_turboprop.capacity'),
      efficiency: trl('vehicles.regional_turboprop.efficiency'),
      range: trl('vehicles.regional_turboprop.range'),
      maxSpeed: 430,
      skill: trl('vehicles.regional_turboprop.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        wcol = '#ecebe6',
        white = c.paint(wcol),
        blue = c.paint('#1d4f8c'),
        grey = c.paint('#8e959a'),
        blk = CM('#1c1d1f', { roughness: 0.6 })
      const ST = [
        [7.58, 1.5, 1.62, 0.08, 2],
        [7.35, 1.3, 1.82, 0.56, 2.2],
        [6.8, 1.04, 2.08, 1.08, 2.4],
        [6.1, 0.9, 2.34, 1.44, 2.6],
        [5.3, 0.82, 2.6, 1.66, 2.8],
        [4.5, 0.8, 2.66, 1.72, 3],
        [-2.6, 0.8, 2.66, 1.72, 3],
        [-3.6, 0.96, 2.64, 1.6, 2.8],
        [-5.0, 1.38, 2.6, 1.14, 2.5],
        [-6.5, 1.84, 2.55, 0.62, 2.3],
        [-7.35, 2.1, 2.5, 0.3, 2.2],
        [-7.52, 2.2, 2.46, 0.08, 2],
      ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 36 }), white)
      const wsK = [5.2, 6.3, 1.92, 2.75, null, 0.84],
        ckP = [
          [5.98, 2.0],
          [4.78, 2.02],
          [4.78, 2.42],
          [5.25, 2.56],
          [6.0, 2.3],
        ]
      const wins = []
      for (let i = 0; i < 8; i++) {
        const wx = 3.85 - i * 0.82
        wins.push(rrect(wx - 0.4, wx, 1.8, 2.24, 0.09))
      }
      const winF = polysSdf(EA, wins)
      const winCut = {
        sel: function (n: any) {
          return Math.abs(n.z) > 0.3
        },
        sdf: function (x: any, y: any, z: any) {
          return Math.max(winF(x, y), 0.5 - Math.abs(z))
        },
      }
      kit.cutMesh(
        fus,
        [
          EA.cutT(wsK, function (n: any) {
            return n.x > 0.2 && n.y > 0.05
          }),
          EA.sideCutP(ckP, 0.5),
        ],
        40,
      )
      kit.cutMesh(fus, [winCut], 40, { sub: 0.15 })
      c.deform.push(fus)
      /* stripes: wide blue on the window line with a thread, grey belly */
      const yc = function (x: any) {
        return x > -3.6 ? 1.68 : 1.68 + (-3.6 - x) * 0.13
      }
      fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.07 - Math.abs(y - yc(x)), x + 7.2, 7.1 - x, Math.abs(z) - 0.2)
        }),
        blue,
        { sub: 0.08, pre: EA.keepT([-7.3, 7.2, 1.45, 2.3, 0.15]) },
      )
      fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.024 - Math.abs(y - yc(x) - 0.64), x + 6.0, 6.0 - x, Math.abs(z) - 0.3)
        }),
        blue,
        { k: 1.005, sub: 0.06, pre: EA.keepT([-6.2, 6.2, 2.1, 2.5, 0.25]) },
      )
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(1.08 - y, x + 7.3)
        }),
        grey,
      )
      EA.fuseGlass(c, ST, EA.keepT(wsK), lbl('windshield'), 'laminated', { pos: new V3(5.8, 2.35, 0) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(
          c,
          ST,
          EA.sideKeepP(ckP, 0.5, s),
          s > 0 ? lbl('right_flight_deck_window') : lbl('left_flight_deck_window'),
          'tempered',
          { pos: new V3(5.4, 2.25, s * 0.8) },
        )
        fGlass(
          c,
          EA,
          ST,
          {
            sdf: function (x: any, y: any, z: any) {
              return -Math.max(winF(x, y), 0.5 - s * z)
            },
          },
          s > 0 ? lbl('right_cabin_windows') : lbl('left_cabin_windows'),
          'tempered',
          { pos: new V3(1.0, 2.0, s * 0.85), pre: EA.keepT([-2.8, 4.0, 1.7, 2.34, 0.4]) },
        )
        sideText(c, ST, 'PT-ZBN', 1.3, 0.28, -5.2, 2.08, s, { fg: '#1d4f8c' })
      })
      /* cargo and passenger door (rear left) and emergency hatch: gaps */
      const doorF = EA.polySdf(rrect(-3.55, -2.3, 0.96, 2.46, 0.12))
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.008 - Math.abs(doorF(x, y)), -z - 0.5)
        }),
        MT.dark,
        { k: 1.003 },
      )
      c.roundBox(0.16, 0.03, 0.03, 0.01, MT.chrome, -2.5, 1.7, -0.875)
      c.rod(new V3(6.32, 2.72, 0), new V3(5.22, 1.95, 0), 0.02, blk)
      /* interior: cockpit (2 seats, sticks, panel, pedestal) and 8 rows of single seats with an aisle */
      const fl = 0.98,
        fab = CM('#3d4552', { roughness: 0.9 })
      liner(c, ST, -4.6, 5.9, fl, MT.carpet, { h: 0.03 })
      ;[0.38, -0.38].forEach(function (z) {
        kit.seat(c, 4.95, fl, z, { w: 0.5, h: 0.38, back: 0.7, lean: 0.14, mat: CM('#2a2c30', { roughness: 0.8 }) })
        kit.yoke(c, 5.5, 1.75, z)
        EA.pedals(c, 5.95, fl, z)
      })
      EA.instPanel(c, 5.75, 1.88, 1.4, { gauges: 10, z0: -0.6, tilt: 0.25 })
      c.roundBox(0.5, 0.35, 0.22, 0.04, CM('#232427'), 5.35, fl + 0.4, 0)
      ;[-0.05, 0.05].forEach(function (z) {
        c.rod(new V3(5.4, fl + 0.58, z), new V3(5.3, fl + 0.7, z), 0.012, MT.chrome)
      })
      c.roundBox(0.04, 1.3, 1.3, 0.02, CM('#5d6066', { roughness: 0.9 }), 4.45, 1.72, 0, {}).castShadow = false
      for (let r = 0; r < 8; r++)
        [0.5, -0.5].forEach(function (z) {
          kit.seat(c, 3.62 - r * 0.82, fl, z, { w: 0.48, h: 0.38, back: 0.68, lean: 0.14, mat: fab })
        })
      liner(c, ST, -4.3, 4.5, 2.48, MT.headliner)
      /* low trapezoid wing with 7 degree dihedral, straight trailing edge */
      const wingMat = c.paint(wcol),
        dh = function (z: any) {
          return 0.98 + Math.max(0, Math.abs(z) - 0.8) * 0.122
        },
        nacs: any = { 1: [], '-1': [] },
        props: any = {},
        legs = []
      ;[1, -1].forEach(function (s) {
        const w = c.add(
          EA.foilGeo(
            [
              { p: [1.52, dh(0), 0], c: 2.38, t: 0.15, cam: 0.02 },
              { p: [1.52, dh(0.86), s * 0.86], c: 2.38, t: 0.15, cam: 0.02 },
              { p: [1.42, dh(2.47), s * 2.47], c: 2.25, t: 0.145, cam: 0.02 },
              { p: [0.98, dh(7.42), s * 7.42], c: 1.4, t: 0.12, cam: 0.02 },
              { p: [0.92, dh(7.66), s * 7.66], c: 1.25, t: 0.07, cam: 0.01 },
            ],
            { up: 'y', n: 14 },
          ),
          wingMat,
        )
        c.deform.push(w)
        c.roundBox(0.012, 0.012, 2.6, 0.004, MT.dark, -0.62, dh(4.0) + 0.12, s * 4.0, { rot: [s * 0.122, 0, 0] }).castShadow = false
        c.roundBox(0.012, 0.012, 2.2, 0.004, MT.dark, -0.32, dh(6.3) + 0.1, s * 6.3, { rot: [s * 0.122, 0, 0] }).castShadow = false
        EA.navLight(
          c,
          0.6,
          dh(7.66),
          s * 7.7,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.right_navigation_light_green') : trl('labels.left_navigation_light_red'),
        )
        /* PT6 nacelle: long, ahead of the leading edge, with a chin air intake and two side exhausts */
        const z0 = s * 2.47,
          NS = [
            [4.0, 1.36, 1.5, 0.16, 2],
            [3.86, 1.12, 1.68, 0.5, 2.2],
            [3.4, 1.0, 1.78, 0.62, 2.4],
            [2.4, 0.98, 1.8, 0.64, 2.6],
            [0.8, 0.98, 1.72, 0.62, 2.6],
            [-0.3, 1.06, 1.58, 0.5, 2.4],
            [-1.05, 1.22, 1.42, 0.16, 2],
          ]
        NS.forEach(function (q) {
          q.push(z0)
        })
        const nac = c.add(EA.fuseGeo(NS, { smooth: 30, seg: 24 }), white)
        c.deform.push(nac)
        nacs[s].push(nac)
        const nb = EA.fuseSkin(
          c,
          NS,
          EA.bandT(function (x: any, y: any) {
            return Math.min(0.05 - Math.abs(y - 1.58 + (x < 0 ? x * 0.03 : 0)), x + 0.9, 3.75 - x)
          }),
          blue,
        )
        nacs[s].push(nb)
        nacs[s].push(c.roundBox(0.3, 0.12, 0.34, 0.05, MT.dark, 3.72, 1.08, z0))
        ;[1, -1].forEach(function (q) {
          const ex = c.cylinder(0.085, 0.1, 0.32, MT.steel, 3.2, 1.46, z0 + q * 0.33, 'x', { seg: 14 })
          ex.rotation.y = -q * 0.55
          nacs[s].push(ex)
          const eo = c.cylinder(0.07, 0.07, 0.02, MT.dark, 3.07, 1.46, z0 + q * 0.42, 'x')
          eo.rotation.y = -q * 0.55
          nacs[s].push(eo)
        })
        props[s] = EA.propeller(c, 4.1, 1.43, z0, {
          R: 1.18,
          blades: 3,
          chord: 0.2,
          spinL: 0.42,
          spinR: 0.2,
          phase: s > 0 ? 0.2 : 0.9,
          v: s > 0 ? 7 : -7,
        })
        c.part('propeller', s > 0 ? trl('labels.right_propeller') : trl('labels.left_propeller'), props[s], new V3(4.2, 1.43, z0), 0.9)
        /* main gear retracting into the nacelle: leg, arm, open doors */
        legs.push(
          c.rod(new V3(1.12, 1.04, z0), new V3(1.02, 0.33, z0 + s * 0.06), 0.055, MT.chrome),
          c.rod(new V3(1.6, 1.02, z0), new V3(1.05, 0.5, z0), 0.03, MT.steel),
        )
        ;[1, -1].forEach(function (q) {
          legs.push(c.roundBox(1.05, 0.34, 0.02, 0.01, white, 1.25, 0.84, z0 + q * 0.27))
        })
        c.wheel(1.02, z0 + s * 0.06, 0.33, 0.2, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#c9ccce', { metalness: 0.5 }) })
      })
      EA.lamp(c, 1.52, dh(1.6) - 0.02, 1.6, 0.06, trl('labels.right_landing_light'))
      EA.lamp(c, 1.52, dh(1.6) - 0.02, -1.6, 0.06, trl('labels.left_landing_light'))
      /* nose wheel with a taxi light and doors */
      legs.push(
        c.rod(new V3(5.32, 0.92, 0), new V3(5.3, 0.26, 0), 0.04, MT.chrome),
        c.rod(new V3(5.65, 0.86, 0), new V3(5.32, 0.5, 0), 0.02, MT.steel),
      )
      ;[1, -1].forEach(function (q) {
        legs.push(c.roundBox(0.75, 0.3, 0.02, 0.01, white, 5.4, 0.72, q * 0.2))
      })
      c.wheel(5.3, 0.0001, 0.26, 0.16, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#c9ccce', { metalness: 0.5 }) })
      const tx = EA.lamp(c, 5.42, 0.82, 0.0001, 0.045, trl('labels.taxi_light'))
      void tx
      /* empennage: tall swept fin with a dorsal fin, elevator with strong dihedral */
      const tm = c.paint(wcol)
      const fin = c.add(
        EA.foilGeo(
          [
            { p: [-4.8, 2.48, 0], c: 2.75, t: 0.11 },
            { p: [-6.42, 4.84, 0], c: 1.12, t: 0.1 },
          ],
          { up: 'z', n: 10 },
        ),
        tm,
      )
      c.deform.push(fin)
      const dors = c.add(
        EA.foilGeo(
          [
            { p: [-2.95, 2.6, 0], c: 1.9, t: 0.04 },
            { p: [-4.82, 3.15, 0], c: 0.3, t: 0.06 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(dors)
      const finB = c.add(
        EA.foilGeo(
          [
            { p: [-4.79, 2.48, 0], c: 2.77, t: 0.115 },
            { p: [-6.41, 4.845, 0], c: 1.14, t: 0.105 },
          ],
          { up: 'z', n: 10 },
        ),
        c.paint('#1d4f8c'),
      )
      finB.castShadow = false
      kit.cutMesh(
        finB,
        [
          EA.bandT(function (x: any, y: any) {
            const yy = 3.3 + (x + 6.0) * 0.4
            return Math.min(0.16 - Math.abs(y - yy), 4.7 - y)
          }),
        ],
        40,
      )
      c.deform.push(finB)
      c.roundBox(0.012, 2.1, 0.03, 0.004, MT.dark, -6.85, 3.6, 0, { rot: [0, 0, -0.35] }).castShadow = false
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-5.95, 2.3, 0], c: 1.55, t: 0.1 },
              { p: [-6.62, 2.3 + 3.2 * 0.176, s * 3.2], c: 0.86, t: 0.09 },
            ],
            { up: 'y', n: 10 },
          ),
          tm,
        )
        c.deform.push(hs)
      })
      EA.navLight(c, -7.6, 2.32, 0, 'white', trl('labels.tail_light'), { r: 0.035 })
      EA.navLight(c, -6.95, 4.9, 0, 'red', trl('labels.anti_collision_light_fin'), { r: 0.045 })
      EA.navLight(c, 0.2, 0.77, 0, 'red', trl('labels.anti_collision_light_belly'), { r: 0.04 })
      /* antennas and pitots */
      c.rod(new V3(6.9, 1.7, 0.45), new V3(7.3, 1.7, 0.45), 0.012, MT.steel)
      c.rod(new V3(6.9, 1.7, -0.45), new V3(7.3, 1.7, -0.45), 0.012, MT.steel)
      c.roundBox(0.3, 0.18, 0.02, 0.01, blk, 1.5, 2.72, 0, { rot: [0, 0, -0.4] })
      c.roundBox(0.25, 0.15, 0.02, 0.01, blk, -1.5, 0.74, 0, { rot: [0, 0, 0.4] })
      c.part('engine', trl('labels.left_engine_pt6a_34'), null, new V3(2.8, 1.4, -2.47), 1.0)
      c.part('engine', trl('labels.right_engine_pt6a_34'), null, new V3(2.8, 1.4, 2.47), 1.0)
      c.part('fuel_tank', trl('labels.integral_wing_tanks'), null, new V3(0.4, 1.2, 4.0), 1.2)
      c.part('landing_gear', trl('labels.landing_gear'), null, new V3(1.02, 0.4, 2.5), 1.0)
      Object.assign(c.meta, {
        kind: 'plane',
        length: 15.1,
        width: 15.33,
        fuselageWidth: 1.72,
        front: 7.6,
        rear: -7.6,
        clearance: 0.8,
        belt: 1.75,
        bodyHeight: 1.86,
        top: 4.92,
        roof: null,
      })
      const fz = 1.0
      c.zone('nose', trl('labels.nose_and_flight_deck'), [4.7, 7.8, 0.75, 2.85, -fz, fz], [], {
        replace: true,
        dir: 'front',
        fxKey: 'nose',
        who: trl('who.the_pilots'),
      })
      c.zone('cab', trl('labels.passenger_cabin_and_windows'), [-2.2, 4.7, 0.75, 2.8, -fz, fz], null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_passengers'),
        anyMesh: true,
      })
      c.zone('cargo_door', trl('labels.cargo_door_left'), [-3.7, -2.2, 0.75, 2.6, -1.2, -0.4], null, {
        dir: 'left',
        fxKey: 'door',
        who: trl('who.whoever_is_at_the_back_of_the_cabin'),
      })
      c.zone('fuselage', trl('labels.tail_cone'), [-5.2, -2.2, 0.85, 2.8, -fz, fz])
      c.zone('tail', trl('labels.fin_and_elevator'), [-7.8, -5.2, 1.6, 5.1, -3.5, 3.5])
      ;[1, -1].forEach(function (s) {
        const sid = s > 0 ? 'right' : 'left',
          z0 = s * 2.47
        c.zone(
          'engine_' + sid,
          s > 0 ? trl('labels.right_engine_and_nacelle') : trl('labels.left_engine_and_nacelle'),
          [-1.7, 3.95, 0.9, 1.9, z0 - 0.45, z0 + 0.45],
          nacs[s],
          { side: s, dir: 'front', fxKey: 'engine', sub: 'engine', anyMesh: true, pos: new V3(2.8, 1.4, z0) },
        )
        c.zone(
          'propeller_' + sid,
          s > 0 ? trl('labels.right_propeller') : trl('labels.left_propeller'),
          [3.9, 4.6, 0.2, 2.65, z0 - 1.25, z0 + 1.25],
          [props[s]],
          { type: 'part', kindPart: 'propeller', side: s, dir: 'rear', fxKey: 'nose' },
        )
      })
      c.zone('landing_gear', null, null, legs)
      c.zone('headlight_center', trl('labels.landing_and_taxi_lights'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_light'))
      c.meta.armor = function (c2: any) {
        /* modified for rescue: wing-tip tanks, steel plates under the cockpit,
         grille on the windshield, search spotlight under the left wing and supply boxes tied in the aisle */
        const stl = kit.steelMaterial,
          tk = CM('#d8d6cf', { roughness: 0.5, metalness: 0.2 })
        ;[1, -1].forEach(function (s) {
          pod(c2, EA, 1.6, -0.9, dh(7.66), s * 7.85, 0.24, tk)
          c2.roundBox(1.1, 0.55, 0.02, 0.02, stl, 5.3, 1.25, s * 0.87)
        })
        for (let k = -0.7; k <= 0.71; k += 0.14) c2.rod(new V3(6.35, 1.95, k), new V3(5.2, 2.72, k * 0.85), 0.008, stl)
        c2.cylinder(0.12, 0.1, 0.2, MT.steel, 1.2, dh(4.5) - 0.25, -4.5, 'x')
        EA.lamp(c2, 1.32, dh(4.5) - 0.25, -4.5, 0.1, trl('labels.search_spotlight'))
        ;[2.6, 1.0, -0.6].forEach(function (x) {
          c2.roundBox(0.5, 0.35, 0.4, 0.03, CM('#3d3a2e'), x, fl + 0.2, 0)
        })
        c2.part('cargo', trl('labels.supplies_in_the_aisle'), null, new V3(1.0, 1.2, 0), 1.0)
      }
    },
  )

  /* ================= Amphibian utility plane (Caravan Amphibian type) ================= */
  /* Reference · Cessna 208 Caravan Amphibian (Wipline 8000 floats) - WebFetch (AOPA "Cessna Caravan Amphibian"), the rest from memory
     Real measurements: length 11.61 m (38 ft 1 in) · span 15.88 m · height 5.21 m (17 ft 1 in) · wing area 25.96 m2 ·
     McCauley three-blade propeller about 2.54 m (from memory) · floats about 8.2 m long, 0.82 m beam, track about 2.9 m (from memory) ·
     landing wheels on the floats: two at the bow (about 0.34 m) and two behind the step (about 0.5 m) · fuselage about 1.70 m wide (from memory) ·
     tank 1,257 L (332 gal) · PT6A-114A of 675 shp.
     Signature traits:
     front: long square PT6 nose with a mouth-shaped air intake under the spinner, exhaust on the right side, high wing with
     a single strut each side, huge floats with wheels at the bow
     side: tall square fuselage with large square windows, double cargo door at the back left, belly that rises to the tail,
     N struts of the floats, step on the bottom of the float, large fin with a dorsal fin
     rear: auxiliary fins under the elevator tips and a ventral fin (amphibian requirement), water rudders at the sterns
     top: straight wing in the middle and tapered at the tips, floats longer than half the fuselage with hatches and cleats */
  fx.register(
    {
      key: 'amphibian_turboprop',
      group: 'air',
      name: trl('vehicles.amphibian_turboprop.name'),
      inspired: trl('vehicles.amphibian_turboprop.inspired'),
      category: trl('vehicles.amphibian_turboprop.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.amphibian_turboprop.description'),
      mass: 3629,
      noise: 500,
      seats: trl('vehicles.amphibian_turboprop.seats'),
      capacity: trl('vehicles.amphibian_turboprop.capacity'),
      efficiency: trl('vehicles.amphibian_turboprop.efficiency'),
      range: trl('vehicles.amphibian_turboprop.range'),
      maxSpeed: 300,
      skill: trl('vehicles.amphibian_turboprop.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        wcol = '#eceae3',
        white = c.paint(wcol),
        navy = c.paint('#1e2f55'),
        gold = c.paint('#c99a2e'),
        blk = CM('#1c1d1f', { roughness: 0.6 })
      const ST = [
        [5.0, 2.26, 2.86, 0.62, 2.2],
        [4.75, 2.08, 3.0, 0.98, 2.6],
        [4.0, 2.0, 3.08, 1.22, 3],
        [3.0, 1.96, 3.18, 1.42, 3.2],
        [2.3, 1.95, 3.38, 1.62, 3.4],
        [1.6, 1.95, 3.6, 1.7, 3.6],
        [-2.4, 1.95, 3.62, 1.7, 3.6],
        [-3.3, 2.18, 3.55, 1.5, 3.2],
        [-4.6, 2.72, 3.42, 0.92, 2.8],
        [-5.75, 3.05, 3.38, 0.42, 2.4],
        [-6.05, 3.15, 3.35, 0.12, 2],
      ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 36 }), white)
      const wsK = [1.5, 2.5, 2.95, 3.66, null, 0.86],
        ckP = [
          [1.6, 2.75],
          [0.72, 2.75],
          [0.72, 3.42],
          [1.48, 3.48],
          [1.92, 3.18],
        ]
      const wins = [0.0, -0.78, -1.56, -2.34].map(function (x) {
          return rrect(x - 0.52, x, 2.74, 3.22, 0.1)
        }),
        winF = polysSdf(EA, wins)
      const winCut = {
        sel: function (n: any) {
          return Math.abs(n.z) > 0.3
        },
        sdf: function (x: any, y: any, z: any) {
          return Math.max(winF(x, y), 0.5 - Math.abs(z))
        },
      }
      kit.cutMesh(
        fus,
        [
          EA.cutT(wsK, function (n: any) {
            return n.x > 0.15 && n.y > 0.1
          }),
          EA.sideCutP(ckP, 0.5),
        ],
        40,
      )
      kit.cutMesh(fus, [winCut], 40, { sub: 0.1 })
      c.deform.push(fus)
      /* stripes: navy blue with a gold thread rising to the tail */
      const yc = function (x: any) {
        return x > -2.5 ? 2.42 : 2.42 + (-2.5 - x) * 0.3
      }
      fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.1 - Math.abs(y - yc(x)), x + 5.9, 4.95 - x, Math.abs(z) - 0.2)
        }),
        navy,
        { sub: 0.08, pre: EA.keepT([-6.0, 5.0, 2.2, 3.4, 0.15]) },
      )
      fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.02 - Math.abs(y - yc(x) - 0.15), x + 5.9, 4.6 - x, Math.abs(z) - 0.2)
        }),
        gold,
        { k: 1.005, sub: 0.05, pre: EA.keepT([-6.0, 4.7, 2.4, 3.5, 0.15]) },
      )
      EA.fuseGlass(c, ST, EA.keepT(wsK), lbl('windshield'), 'laminated', { pos: new V3(2.0, 3.3, 0) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(c, ST, EA.sideKeepP(ckP, 0.5, s), s > 0 ? lbl('co_pilot_door_window') : lbl('pilot_door_window'), 'tempered', {
          pos: new V3(1.2, 3.1, s * 0.84),
        })
        fGlass(
          c,
          EA,
          ST,
          {
            sdf: function (x: any, y: any, z: any) {
              return -Math.max(winF(x, y), 0.5 - s * z)
            },
          },
          s > 0 ? lbl('right_cabin_windows') : lbl('left_cabin_windows'),
          'tempered',
          { pos: new V3(-1.2, 3.0, s * 0.85), pre: EA.keepT([-3.0, 0.15, 2.6, 3.35, 0.4]) },
        )
        const df = EA.polySdf(
          ckP.map(function (q) {
            return [q[0] + (q[0] > 1.2 ? 0.06 : -0.06), q[1] + (q[1] > 3.0 ? 0.06 : -0.7)]
          }),
        )
        EA.fuseSkin(
          c,
          ST,
          EA.bandT(function (x: any, y: any, z: any) {
            return Math.min(0.007 - Math.abs(df(x, y)), s * z - 0.5)
          }),
          MT.dark,
          { k: 1.003 },
        )
        sideText(c, ST, 'PR-ZCA', 1.0, 0.22, -4.3, 3.25, s, { fg: '#1e2f55' })
      })
      const cgo = EA.polySdf(rrect(-3.3, -2.05, 2.05, 3.42, 0.1))
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(
            0.008 - Math.min(Math.abs(cgo(x, y)), x > -3.3 && x < -2.05 && y > 2.05 && y < 3.42 ? Math.abs(x + 2.7) : 9),
            -z - 0.5,
          )
        }),
        MT.dark,
        { k: 1.003 },
      )
      /* PT6 nose: mouth air intake, exhaust on the right, side outlets */
      c.roundBox(0.28, 0.22, 0.5, 0.08, MT.dark, 4.92, 2.22, 0)
      const ex = c.cylinder(0.12, 0.14, 0.45, MT.steel, 4.35, 2.62, 0.62, 'x', { seg: 16 })
      ex.rotation.y = -0.5
      c.cylinder(0.1, 0.1, 0.02, MT.dark, 4.18, 2.62, 0.72, 'x').rotation.y = -0.5
      ;[1, -1].forEach(function (s) {
        for (let k = 0; k < 4; k++) c.roundBox(0.04, 0.2, 0.02, 0.008, MT.dark, 3.4 - k * 0.09, 2.7, s * (0.66 + 0.004 * k))
      })
      const pr = EA.propeller(c, 5.06, 2.56, 0, { R: 1.27, blades: 3, chord: 0.22, spinL: 0.36, spinR: 0.21 })
      /* interior: 2 seats at the front, 3 rows (2 + 1) behind with the aisle on the right, panel with screens */
      const fl = 2.06,
        fab = CM('#4a4640', { roughness: 0.9 })
      liner(c, ST, -3.2, 2.0, fl, MT.carpet, { h: 0.03 })
      ;[0.38, -0.38].forEach(function (z) {
        kit.seat(c, 0.95, fl, z, { w: 0.5, h: 0.38, back: 0.7, lean: 0.14, mat: fab })
        kit.yoke(c, 1.5, 2.85, z)
        EA.pedals(c, 1.95, fl, z)
      })
      EA.instPanel(c, 1.78, 2.98, 1.42, {
        gauges: 6,
        z0: -0.6,
        tilt: 0.2,
        screens: [
          [0.0, -0.36, 0.16, 0.24],
          [0.0, 0.3, 0.16, 0.24],
        ],
      })
      c.roundBox(0.4, 0.3, 0.2, 0.04, CM('#232427'), 1.35, fl + 0.4, 0)
      ;[0.05, -0.75, -1.55].forEach(function (x) {
        kit.seat(c, x, fl, -0.35, { w: 0.9, n: 2, h: 0.38, back: 0.66, lean: 0.14, mat: fab })
        kit.seat(c, x, fl, 0.5, { w: 0.45, h: 0.38, back: 0.66, lean: 0.14, mat: fab })
      })
      liner(c, ST, -2.9, 1.9, 3.5, MT.headliner)
      /* high wing: straight in the centre, tapered at the tips, 3 degree dihedral, single strut each side */
      const wingMat = c.paint(wcol),
        dh = function (z: any) {
          return 3.72 + Math.abs(z) * 0.05
        },
        wingsM = []
      ;[1, -1].forEach(function (s) {
        const w = c.add(
          EA.foilGeo(
            [
              { p: [1.56, dh(0), 0], c: 1.98, t: 0.15, cam: 0.025, noCap: true },
              { p: [1.56, dh(3.6), s * 3.6], c: 1.98, t: 0.15, cam: 0.025 },
              { p: [1.38, dh(7.7), s * 7.7], c: 1.3, t: 0.12, cam: 0.02 },
              { p: [1.32, dh(7.94), s * 7.94], c: 1.1, t: 0.06, cam: 0.01 },
            ],
            { up: 'y', n: 14 },
          ),
          wingMat,
        )
        c.deform.push(w)
        wingsM.push(w)
        c.roundBox(0.012, 0.012, 3.2, 0.004, MT.dark, -0.3, dh(2.0) + 0.1, s * 2.0).castShadow = false
        c.roundBox(0.012, 0.012, 3.4, 0.004, MT.dark, -0.15, dh(5.8) + 0.1, s * 5.8).castShadow = false
        EA.navLight(
          c,
          0.9,
          dh(7.94),
          s * 7.98,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.right_navigation_light_green') : trl('labels.left_navigation_light_red'),
        )
        const st = c.rod(new V3(0.55, 2.0, s * 0.82), new V3(0.75, dh(4.4) - 0.1, s * 4.4), 0.045, white, { seg: 10 })
        st.scale.x = 1.9
        c.deform.push(st)
        c.roundBox(0.2, 0.08, 0.12, 0.03, MT.steel, 0.55, 2.0, s * 0.84)
      })
      EA.lamp(c, 1.56, dh(2.4) - 0.02, -2.4, 0.07, trl('labels.landing_light_left_wing'))
      EA.lamp(c, 1.56, dh(2.6) - 0.02, 2.6, 0.06, trl('labels.taxi_light_right_wing'))
      /* amphibian floats: V hull with a step, flat deck, hatches, cleats and water rudders */
      const flMat = c.paint('#d9dbd8', { metalness: 0.4, roughness: 0.4 }),
        floats: any = [],
        fstr: any = [],
        legs2: any = []
      ;[1, -1].forEach(function (s) {
        const z0 = s * 1.45,
          FS = [
            [4.85, 1.12, 1.22, 0.08, 2],
            [4.62, 0.9, 1.25, 0.46, 2.2],
            [3.9, 0.62, 1.26, 0.74, 2.6],
            [2.5, 0.44, 1.27, 0.84, 2.8],
            [0.6, 0.39, 1.27, 0.84, 2.8],
            [-0.3, 0.38, 1.27, 0.82, 2.8],
            [-0.36, 0.52, 1.27, 0.8, 2.8],
            [-1.7, 0.6, 1.25, 0.72, 2.6],
            [-3.4, 0.8, 1.21, 0.5, 2.4],
            [-4.3, 0.98, 1.19, 0.16, 2],
          ]
        FS.forEach(function (q) {
          q.push(z0)
        })
        const fm = c.add(EA.fuseGeo(FS, { smooth: 40, seg: 20 }), flMat)
        c.deform.push(fm)
        floats.push(fm)
        floats.push(
          EA.fuseSkin(
            c,
            FS,
            EA.bandT(function (x: any, y: any) {
              return Math.min(0.03 - Math.abs(y - 1.05), x + 4.1, 4.7 - x)
            }),
            navy,
          ),
        )
        ;[2.6, 0.9, -1.0, -2.6].forEach(function (x) {
          floats.push(c.cylinder(0.1, 0.1, 0.02, MT.steel, x, 1.265, z0))
        })
        ;[4.2, -3.6].forEach(function (x) {
          floats.push(c.roundBox(0.16, 0.03, 0.04, 0.012, MT.chrome, x, 1.26, z0 + s * 0.12))
        })
        floats.push(c.roundBox(0.2, 0.32, 0.02, 0.01, MT.steel, -4.35, 0.82, z0))
        /* N struts and stays */
        ;[
          [1.65, 1.35],
          [-0.95, -0.75],
        ].forEach(function (q) {
          const a = c.rod(new V3(q[0], 1.26, z0), new V3(q[1], 1.97, s * 0.62), 0.04, white, { seg: 10 })
          a.scale.x = 1.6
          fstr.push(a)
        })
        fstr.push(c.rod(new V3(1.65, 1.26, z0), new V3(-0.75, 1.97, s * 0.62), 0.025, white))
        /* wheels: bow (double nose gear) and main behind the step */
        legs2.push(c.rod(new V3(4.15, 0.86, z0), new V3(4.1, 0.17, z0), 0.03, MT.steel))
        c.wheel(4.1, z0, 0.17, 0.1, { spokes: 0, rimR: 0.5, noPart: true, rim: MT.steel })
        legs2.push(c.roundBox(0.6, 0.35, 0.05, 0.02, MT.steel, -0.65, 0.4, z0 + s * 0.3))
        c.wheel(-0.65, z0 + s * 0.06, 0.25, 0.16, { spokes: 0, rimR: 0.5, noPart: true, rim: MT.steel })
      })
      ;[1.65, -0.95].forEach(function (x) {
        fstr.push(c.rod(new V3(x, 1.26, 1.45), new V3(x, 1.26, -1.45), 0.012, MT.steel))
        fstr.push(c.rod(new V3(x, 1.26, 1.45), new V3(x + (x > 0 ? -2.6 : 2.6) * 0, 1.97, -0.62), 0.006, MT.steel))
      })
      /* empennage: fin with a dorsal fin, low elevator with auxiliary fins, ventral fin */
      const tm = c.paint(wcol)
      const fin = c.add(
        EA.foilGeo(
          [
            { p: [-4.35, 3.36, 0], c: 1.95, t: 0.11 },
            { p: [-5.45, 5.12, 0], c: 0.85, t: 0.1 },
          ],
          { up: 'z', n: 10 },
        ),
        tm,
      )
      c.deform.push(fin)
      const dors = c.add(
        EA.foilGeo(
          [
            { p: [-2.6, 3.58, 0], c: 1.8, t: 0.04 },
            { p: [-4.4, 4.05, 0], c: 0.3, t: 0.06 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(dors)
      const finB = c.add(
        EA.foilGeo(
          [
            { p: [-4.34, 3.36, 0], c: 1.97, t: 0.115 },
            { p: [-5.44, 5.125, 0], c: 0.87, t: 0.105 },
          ],
          { up: 'z', n: 10 },
        ),
        navy,
      )
      finB.castShadow = false
      kit.cutMesh(
        finB,
        [
          EA.bandT(function (x: any, y: any) {
            return Math.min(0.18 - Math.abs(y - 4.3 - (x + 5.0) * 0.2), 5.0 - y)
          }),
        ],
        40,
      )
      c.deform.push(finB)
      const ventralFin = c.add(
        EA.foilGeo(
          [
            { p: [-4.9, 2.95, 0], c: 1.0, t: 0.08 },
            { p: [-5.5, 2.45, 0], c: 0.55, t: 0.07 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(ventralFin)
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-4.8, 3.08, 0], c: 1.55, t: 0.1 },
              { p: [-5.15, 3.08, s * 3.1], c: 1.0, t: 0.09 },
            ],
            { up: 'y', n: 10 },
          ),
          tm,
        )
        c.deform.push(hs)
        const af = c.add(
          EA.foilGeo(
            [
              { p: [-4.95, 3.05, s * 2.35], c: 0.9, t: 0.07 },
              { p: [-5.2, 2.6, s * 2.35], c: 0.6, t: 0.06 },
            ],
            { up: 'z', n: 6 },
          ),
          tm,
        )
        c.deform.push(af)
      })
      EA.navLight(c, -6.1, 3.25, 0, 'white', trl('labels.tail_light'), { r: 0.035 })
      EA.navLight(c, -6.0, 5.14, 0, 'red', trl('labels.anti_collision_light'), { r: 0.045 })
      c.roundBox(0.3, 0.15, 0.02, 0.01, blk, -0.8, 3.68, 0, { rot: [0, 0, -0.4] })
      c.part('propeller', trl('labels.three_blade_propeller'), pr, new V3(5.15, 2.56, 0), 1.0)
      c.part('engine', trl('labels.pt6a_114a_turbine'), null, new V3(4.0, 2.55, 0), 1.0)
      c.part('fuel_tank', trl('labels.wing_tanks'), null, new V3(0.6, 3.75, 3.0), 1.2)
      c.part('hull', trl('labels.floats'), floats[0], new V3(0.5, 0.8, 1.45), 1.4)
      Object.assign(c.meta, {
        kind: 'plane',
        length: 11.61,
        width: 15.88,
        fuselageWidth: 1.7,
        front: 5.4,
        rear: -6.31,
        clearance: 1.2,
        belt: 2.75,
        bodyHeight: 1.67,
        top: 5.21,
        roof: null,
      })
      c.zone('nose', trl('labels.nose_turbine_and_propeller'), [3.0, 5.5, 1.8, 3.4, -0.95, 0.95], null, { dir: 'front', fxKey: 'nose' })
      c.zone('cab', trl('labels.cabin_doors_and_windows'), [-2.2, 3.0, 1.8, 3.75, -0.98, 0.98], null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_pilot_and_the_passengers'),
        anyMesh: true,
      })
      c.zone('cargo_door', trl('labels.double_cargo_door_left'), [-3.45, -1.95, 1.9, 3.55, -1.2, -0.4], null, {
        dir: 'left',
        fxKey: 'door',
        who: trl('who.whoever_is_at_the_back_of_the_cabin'),
      })
      c.zone('fuselage', trl('labels.tail_cone'), [-4.4, -2.2, 2.0, 3.7, -0.95, 0.95])
      c.zone('tail', trl('labels.fin_elevator_and_strakes'), [-6.4, -4.4, 2.3, 5.3, -3.3, 3.3])
      c.zone('floats', trl('labels.floats_and_struts'), [-4.5, 5.0, 0.3, 2.0, -2.0, 2.0], floats.concat(fstr), {
        type: 'part',
        fxKey: 'hull',
        dir: 'up',
        anchor: [0.4, 1.97, 0],
        fx: [
          trl('effects.none'),
          trl('effects.scratches_on_the_bottom_still_seals'),
          trl('effects.dented_one_compartment_takes_on_water_listing'),
          trl('effects.cracked_sinks_on_one_side_cannot_take_off_from_w'),
          trl('effects.float_torn_off_lands_on_a_runway_only'),
        ],
      })
      c.zone('landing_gear', trl('labels.float_wheels'), null, legs2)
      c.zone('headlight_left', trl('labels.landing_light_left_wing'))
      c.zone('headlight_right', trl('labels.taxi_light_right_wing'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_light'))
      c.meta.armor = function (c2: any) {
        /* modified riverine: jet-fuel drums on the float deck, mesh guardrail on the rear windows,
         spotlight on the strut, aluminium canoe tied on the left float and wire cutter on the windshield */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          ;[2.4, -2.2].forEach(function (x) {
            c2.cylinder(0.26, 0.26, 0.6, CM('#3e5a34', { roughness: 0.6 }), x, 1.56, s * 1.45)
          })
          for (let x = -2.85; x < 0.05; x += 0.13) c2.rod(new V3(x, 2.72, s * 0.88), new V3(x, 3.24, s * 0.88), 0.008, stl)
        })
        const cn = c2.add(
          EA.fuseGeo(
            [
              [1.6, 1.32, 1.4, 0.05, 2, -1.45],
              [1.2, 1.28, 1.6, 0.5, 2.4, -1.45],
              [-1.6, 1.28, 1.6, 0.55, 2.4, -1.45],
              [-2.0, 1.34, 1.6, 0.1, 2, -1.45],
            ],
            { smooth: 16, seg: 14 },
          ),
          CM('#9aa1a6', { metalness: 0.6, roughness: 0.4 }),
        )
        c2.cylinder(0.11, 0.09, 0.2, MT.steel, 0.9, 2.6, 2.3, 'x')
        EA.lamp(c2, 1.02, 2.6, 2.3, 0.09, trl('labels.search_spotlight'))
        c2.rod(new V3(1.9, 2.95, 0), new V3(2.3, 3.75, 0), 0.02, stl)
        c2.part('cargo', trl('labels.canoe_and_jet_a_1_drums'), cn, new V3(0, 1.45, -1.45), 1.0)
      }
    },
  )

  /* ================= Light business jet (Phenom 100 type) ================= */
  /* Reference · Embraer Phenom 100 (EMB-500) - WebFetch (dimensions.com "Embraer Phenom 100"), the rest from memory
     Real measurements: length 12.82 m · span 12.30 m · height 4.35 m · fuselage about 1.66 m wide and 1.80 m tall (from memory) ·
     main gear track about 2.8 m and wheelbase about 5.2 m (from memory) · tyres about 0.56 m (main) and 0.42 m (nose) (from memory) ·
     belly about 0.55 m off the ground · PW617F-E engines of 1,695 lbf in rear nacelles · tank 1,272 kg (about 1,590 L).
     Signature traits:
     front: long low nose ending in a point, four-piece wraparound windshield with a black frame, round engine air inlets
     showing on the sides of the tail cone, low wing with dihedral and raised tips
     side: four large oval cabin windows, airstair door at the front left, curved grey-silver stripe rising to the tail,
     short nacelles on pylons right below the fin
     rear: T-tail with a well-swept fin and the elevator at the top, two ventral fins under the tail cone, conical exhaust nozzles
     top: wing with slight sweep on the leading edge, large root fairing, short T elevator */
  fx.register(
    {
      key: 'light_jet',
      group: 'air',
      name: trl('vehicles.light_jet.name'),
      inspired: trl('vehicles.light_jet.inspired'),
      category: trl('vehicles.light_jet.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.light_jet.description'),
      mass: 4750,
      noise: 900,
      seats: trl('vehicles.light_jet.seats'),
      capacity: trl('vehicles.light_jet.capacity'),
      efficiency: trl('vehicles.light_jet.efficiency'),
      range: trl('vehicles.light_jet.range'),
      maxSpeed: 722,
      skill: trl('vehicles.light_jet.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        wcol = '#efeeea',
        white = c.paint(wcol),
        silver = c.paint('#7d868e', { metalness: 0.45, roughness: 0.35 }),
        navy = c.paint('#23324f'),
        blk = CM('#15161a', { roughness: 0.5 })
      const ST = [
        [6.3, 1.13, 1.2, 0.06, 2],
        [6.0, 0.92, 1.44, 0.6, 2.1],
        [5.3, 0.74, 1.8, 1.1, 2.2],
        [4.6, 0.65, 2.1, 1.42, 2.2],
        [3.8, 0.6, 2.33, 1.6, 2.2],
        [2.8, 0.58, 2.4, 1.66, 2.2],
        [-1.8, 0.6, 2.4, 1.66, 2.2],
        [-3.0, 0.8, 2.36, 1.5, 2.2],
        [-4.4, 1.25, 2.3, 1.05, 2.2],
        [-5.6, 1.72, 2.24, 0.52, 2.1],
        [-6.12, 1.92, 2.2, 0.12, 2],
      ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 36 }), white)
      const wsK = [3.85, 5.0, 1.72, 2.45, null, 0.8],
        ckP = [
          [3.95, 1.78],
          [3.35, 1.8],
          [3.35, 2.12],
          [3.82, 2.2],
        ]
      const wins = [2.55, 1.72, 0.89, 0.06].map(function (x, i) {
          return rrect(x - (i === 3 ? 0.38 : 0.5), x, i === 3 ? 1.62 : 1.56, i === 3 ? 1.94 : 1.98, i === 3 ? 0.15 : 0.19, 5)
        }),
        winF = polysSdf(EA, wins)
      const winCut = {
        sel: function (n: any) {
          return Math.abs(n.z) > 0.3
        },
        sdf: function (x: any, y: any, z: any) {
          return Math.max(winF(x, y), 0.5 - Math.abs(z))
        },
      }
      kit.cutMesh(
        fus,
        [
          EA.cutT(wsK, function (n: any) {
            return n.x > 0.12 && n.y > 0.05
          }),
          EA.sideCutP(ckP, 0.5),
        ],
        40,
      )
      kit.cutMesh(fus, [winCut], 40, { sub: 0.1 })
      c.deform.push(fus)
      /* curved grey-silver stripe (from the belly to the top of the tail) with a blue thread */
      const sw = function (x: any) {
        return x > 3.0 ? 1.0 : 1.0 + Math.pow((3.0 - x) / 9.0, 1.6) * 1.35
      }
      fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, _z: any) {
          return Math.min(sw(x) - y, x + 6.0, 5.6 - x)
        }),
        silver,
        {
          sub: 0.09,
          pre: {
            sdf: function (x: any, y: any) {
              return sw(x) + 0.2 - y
            },
          },
        },
      )
      fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.03 - Math.abs(y - sw(x) - 0.09), x + 5.9, 5.3 - x)
        }),
        navy,
        { k: 1.005, sub: 0.05, pre: EA.keepT([-6.0, 5.4, 0.9, 2.5]) },
      )
      EA.fuseGlass(c, ST, EA.keepT(wsK), lbl('windshield'), 'laminated', { pos: new V3(4.4, 2.1, 0) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(
          c,
          ST,
          EA.sideKeepP(ckP, 0.5, s),
          s > 0 ? lbl('right_flight_deck_side_window') : lbl('left_flight_deck_side_window'),
          'tempered',
          { pos: new V3(3.6, 2.0, s * 0.78) },
        )
        fGlass(
          c,
          EA,
          ST,
          {
            sdf: function (x: any, y: any, z: any) {
              return -Math.max(winF(x, y), 0.5 - s * z)
            },
          },
          s > 0 ? lbl('right_cabin_windows') : lbl('left_cabin_windows'),
          'tempered',
          { pos: new V3(1.3, 1.8, s * 0.82), pre: EA.keepT([-0.45, 2.7, 1.45, 2.1, 0.4]) },
        )
      })
      /* airstair door (front, left) and black windshield frame */
      const dF = EA.polySdf(
        rrect(3.25, 2.6, 0.72, 2.2, 0.1).map(function (q: any) {
          return [Math.min(q[0], 3.25), q[1]]
        }),
      )
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.008 - Math.abs(EA.polySdf(rrect(2.62, 3.25, 0.72, 2.22, 0.12))(x, y)), -z - 0.5)
        }),
        MT.dark,
        { k: 1.003 },
      )
      void dF
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.035 - Math.abs(x - 3.88 - (y - 1.75) * 0.5), y - 1.7, 2.42 - y)
        }),
        blk,
        { k: 1.004 },
      )
      c.rod(new V3(5.0, 1.74, 0), new V3(4.05, 2.4, 0), 0.02, blk)
      /* interior: cockpit with three screens, club cabin (4 seats facing each other) and a side seat */
      const fl = 0.8,
        fab = CM('#c9bda6', { roughness: 0.75 })
      liner(c, ST, -2.0, 4.0, fl, MT.carpet, { h: 0.03 })
      ;[0.36, -0.36].forEach(function (z) {
        kit.seat(c, 3.55, fl, z, { w: 0.48, h: 0.36, back: 0.66, lean: 0.14, mat: CM('#2a2c30') })
        kit.yoke(c, 4.05, 1.55, z)
      })
      EA.instPanel(c, 4.3, 1.68, 1.35, {
        gauges: 2,
        z0: -0.05,
        tilt: 0.25,
        screens: [
          [0.02, -0.45, 0.2, 0.3],
          [0.02, 0.0, 0.2, 0.32],
          [0.02, 0.45, 0.2, 0.3],
        ],
      })
      ;[
        [2.25, 1],
        [1.05, -1],
      ].forEach(function (q) {
        ;[0.42, -0.42].forEach(function (z) {
          kit.seat(c, q[0], fl, z, { w: 0.5, h: 0.4, back: 0.66, lean: 0.12, dir: q[1], mat: fab })
        })
      })
      c.roundBox(0.5, 0.05, 0.6, 0.02, MT.wood, 1.65, fl + 0.6, 0.42)
      c.roundBox(0.5, 0.05, 0.6, 0.02, MT.wood, 1.65, fl + 0.6, -0.42)
      kit.seat(c, 0.1, fl, -0.5, { w: 0.5, h: 0.4, back: 0.6, lean: 0.12, face: '+z', mat: fab })
      liner(c, ST, -1.75, 3.75, 2.25, MT.headliner)
      /* low wing with slight sweep, dihedral and raised tips */
      const wingMat = c.paint(wcol),
        dh = function (z: any) {
          return 0.82 + Math.max(0, Math.abs(z) - 0.8) * 0.085
        },
        legs = []
      ;[1, -1].forEach(function (s) {
        const w = c.add(
          EA.foilGeo(
            [
              { p: [1.0, dh(0), 0], c: 2.45, t: 0.14, cam: 0.02 },
              { p: [0.95, dh(0.85), s * 0.85], c: 2.42, t: 0.14, cam: 0.02 },
              { p: [0.55, dh(2.4), s * 2.4], c: 1.9, t: 0.13, cam: 0.02 },
              { p: [-0.32, dh(5.75), s * 5.75], c: 1.08, t: 0.11, cam: 0.02 },
              { p: [-0.42, dh(6.0) + 0.05, s * 6.0], c: 0.92, t: 0.08, cam: 0.01 },
              { p: [-0.52, dh(6.1) + 0.22, s * 6.15], c: 0.62, t: 0.06 },
            ],
            { up: 'y', n: 14 },
          ),
          wingMat,
        )
        c.deform.push(w)
        /* large root fairing */
        const rf = c.roundBox(3.4, 0.36, 0.5, 0.17, white, 0.0, 0.76, s * 0.7, { taper: { sx: 0.7, sz: 0.8, shift: 0.3 }, def: true })
        void rf
        c.roundBox(0.012, 0.012, 1.8, 0.004, MT.dark, -0.95, dh(4.4) + 0.08, s * 4.4).castShadow = false
        EA.navLight(
          c,
          -0.35,
          dh(6.0) + 0.1,
          s * 6.12,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.right_navigation_light_green') : trl('labels.left_navigation_light_red'),
          { r: 0.035 },
        )
        /* trailing-arm main gear at the wing root */
        legs.push(
          c.rod(new V3(-0.2, 0.78, s * 1.42), new V3(-0.45, 0.28, s * 1.42), 0.05, MT.chrome),
          c.roundBox(0.7, 0.22, 0.02, 0.01, white, -0.25, 0.62, s * 1.18),
        )
        c.wheel(-0.45, s * 1.42, 0.28, 0.17, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#c9ccce', { metalness: 0.5 }) })
      })
      EA.lamp(c, 1.5, 0.72, 0.62, 0.055, trl('labels.right_landing_light'))
      EA.lamp(c, 1.5, 0.72, -0.62, 0.055, trl('labels.left_landing_light'))
      legs.push(
        c.rod(new V3(4.95, 0.68, 0), new V3(4.9, 0.21, 0), 0.04, MT.chrome),
        c.roundBox(0.6, 0.22, 0.02, 0.01, white, 5.0, 0.56, 0.16),
        c.roundBox(0.6, 0.22, 0.02, 0.01, white, 5.0, 0.56, -0.16),
      )
      c.wheel(4.9, 0.0001, 0.21, 0.13, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#c9ccce', { metalness: 0.5 }) })
      EA.lamp(c, 5.02, 0.62, 0.0001, 0.04, trl('labels.taxi_light'))
      /* engines on the tail: pylon, nacelle, intake with a dark fan, exhaust cone */
      const engs: any = { 1: [], '-1': [] }
      ;[1, -1].forEach(function (s) {
        const z0 = s * 1.32,
          y0 = 2.0,
          NS = [
            [-2.2, y0 - 0.33, y0 + 0.33, 0.66, 2],
            [-2.6, y0 - 0.37, y0 + 0.37, 0.74, 2],
            [-3.8, y0 - 0.36, y0 + 0.36, 0.72, 2],
            [-4.5, y0 - 0.27, y0 + 0.27, 0.54, 2],
            [-4.65, y0 - 0.22, y0 + 0.22, 0.44, 2],
          ]
        NS.forEach(function (q) {
          q.push(z0)
        })
        const n = c.add(EA.fuseGeo(NS, { smooth: 20, seg: 24 }), white)
        c.deform.push(n)
        engs[s].push(n)
        engs[s].push(
          c.cylinder(0.29, 0.29, 0.03, MT.dark, -2.21, y0, z0, 'x', { seg: 24 }),
          c.cylinder(0.1, 0.02, 0.18, MT.steel, -2.13, y0, z0, 'x', { seg: 16 }),
        )
        engs[s].push(c.add(new THREE.TorusGeometry(0.3, 0.035, 8, 28), MT.chrome, -2.2, y0, z0))
        engs[s][engs[s].length - 1].rotation.y = PI / 2
        engs[s].push(c.cylinder(0.18, 0.08, 0.3, MT.steel, -4.75, y0, z0, 'x', { seg: 18 }))
        engs[s].push(
          c.roundBox(1.5, 0.12, Math.abs(z0) - 0.5, 0.05, white, -3.5, 1.98, s * (0.5 + (Math.abs(z0) - 0.5) / 2), { def: true }),
        )
        engs[s].push(c.roundBox(1.1, 0.07, 0.02, 0.02, navy, -3.4, y0 + 0.12, z0 + s * 0.37))
        /* registration on the outside of the nacelle (the tail cone is hidden behind the wing and the nacelle) */
        engs[s].push(c.text('PR-FNM', 0.78, 0.15, -3.35, y0 - 0.06, z0 + s * 0.378, s > 0 ? '+z' : '-z', { fg: '#23324f' }))
      })
      /* T-tail: swept fin, elevator at the top with a bullet, ventral fins */
      const tm = c.paint(wcol)
      const fin = c.add(
        EA.foilGeo(
          [
            { p: [-3.9, 2.25, 0], c: 2.2, t: 0.11 },
            { p: [-5.35, 4.18, 0], c: 1.15, t: 0.1 },
          ],
          { up: 'z', n: 10 },
        ),
        tm,
      )
      c.deform.push(fin)
      const finB = c.add(
        EA.foilGeo(
          [
            { p: [-3.89, 2.25, 0], c: 2.22, t: 0.115 },
            { p: [-5.34, 4.185, 0], c: 1.17, t: 0.105 },
          ],
          { up: 'z', n: 10 },
        ),
        silver,
      )
      finB.castShadow = false
      kit.cutMesh(
        finB,
        [
          EA.bandT(function (x: any, y: any) {
            return Math.min(y - 2.4 - (x + 6.0) * -0.9, 4.0 - y)
          }),
        ],
        40,
        { sub: 0.06 },
      )
      c.deform.push(finB)
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-5.3, 4.2, 0], c: 1.18, t: 0.1 },
              { p: [-5.9, 4.24, s * 2.55], c: 0.62, t: 0.09 },
            ],
            { up: 'y', n: 10 },
          ),
          tm,
        )
        c.deform.push(hs)
        const vs = c.add(
          EA.foilGeo(
            [
              { p: [-5.0, 1.62, s * 0.18], c: 0.8, t: 0.06 },
              { p: [-5.3, 1.32, s * 0.42], c: 0.5, t: 0.05 },
            ],
            { up: 'z', n: 6 },
          ),
          tm,
        )
        c.deform.push(vs)
      })
      c.sphere(0.11, tm, -5.75, 4.24, 0, 4.2, 0.9, 0.9)
      EA.navLight(c, -6.18, 2.06, 0, 'white', trl('labels.tail_light'), { r: 0.03 })
      EA.navLight(c, -6.15, 4.3, 0, 'red', trl('labels.anti_collision_light_tail'), { r: 0.035 })
      EA.navLight(c, 0.4, 0.56, 0, 'red', trl('labels.anti_collision_light_belly'), { r: 0.035 })
      c.rod(new V3(5.6, 1.35, 0.42), new V3(6.0, 1.35, 0.42), 0.01, MT.steel)
      c.rod(new V3(5.6, 1.35, -0.42), new V3(6.0, 1.35, -0.42), 0.01, MT.steel)
      c.part('engine', trl('labels.left_engine_pw617f'), engs[-1][0], new V3(-3.4, 2.0, -1.32), 0.9)
      c.part('engine', trl('labels.right_engine_pw617f'), engs[1][0], new V3(-3.4, 2.0, 1.32), 0.9)
      c.part('fuel_tank', trl('labels.wing_tanks'), null, new V3(0.2, 0.9, 3.0), 1.2)
      c.part('landing_gear', trl('labels.landing_gear'), null, new V3(-0.45, 0.35, 1.42), 1.0)
      Object.assign(c.meta, {
        kind: 'plane',
        length: 12.82,
        width: 12.3,
        fuselageWidth: 1.66,
        front: 6.32,
        rear: -6.52,
        clearance: 0.58,
        belt: 1.55,
        bodyHeight: 1.82,
        top: 4.35,
        roof: null,
      })
      const fz = 0.95
      c.zone('nose', trl('labels.nose_avionics_and_windshield'), [4.0, 6.5, 0.55, 2.5, -fz, fz], null, {
        dir: 'front',
        fxKey: 'nose',
        who: trl('who.the_pilots'),
      })
      c.zone('cab', trl('labels.cabin_airstair_door_and_windows'), [-1.9, 4.0, 0.55, 2.5, -fz, fz], null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_passengers'),
        anyMesh: true,
      })
      c.zone('fuselage', trl('labels.tail_cone'), [-4.6, -1.9, 0.6, 2.45, -0.9, 0.9])
      c.zone('tail', trl('labels.t_tail'), [-6.6, -3.8, 2.1, 4.5, -2.8, 2.8])
      ;[1, -1].forEach(function (s) {
        const sid = s > 0 ? 'right' : 'left'
        c.zone(
          'engine_' + sid,
          s > 0 ? trl('labels.right_engine_nacelle_and_pylon') : trl('labels.left_engine_nacelle_and_pylon'),
          [-4.95, -2.05, 1.55, 2.45, s > 0 ? 0.5 : -1.8, s > 0 ? 1.8 : -0.5],
          engs[s],
          {
            type: 'part',
            side: s,
            dir: s > 0 ? 'right' : 'left',
            fxKey: 'engine',
            sub: 'engine',
            pos: new V3(-3.4, 2.0, s * 1.32),
            anchor: [-3.5, 2.0, s * 0.5],
          },
        )
      })
      c.zone('landing_gear', null, null, legs)
      c.zone('headlight_center', trl('labels.landing_and_taxi_lights'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_light'))
      c.meta.armor = function (c2: any) {
        /* modified for evacuation: steel plates inside the cockpit, thin grille on the windshield, debris deflectors on the
         nose wheel (dirt strip), ferry tank in the aisle and medicine boxes on the seats */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          c2.roundBox(0.9, 0.45, 0.02, 0.02, stl, 3.6, 1.2, s * 0.74)
        })
        for (let k = -0.6; k <= 0.61; k += 0.12) c2.rod(new V3(5.0, 1.74, k), new V3(3.9, 2.42, k * 0.85), 0.006, stl)
        c2.roundBox(0.5, 0.06, 0.62, 0.02, stl, 4.95, 0.3, 0, { rot: [0, 0, 0.5] })
        c2.cylinder(0.32, 0.32, 1.6, CM('#8e2a20', { roughness: 0.6 }), 0.0, fl + 0.35, 0, 'x')
        c2.text('QAV', 0.4, 0.14, 0.0, fl + 0.68, 0, '+y', { fg: '#f2e6c8' })
        ;[2.25, 1.05].forEach(function (x) {
          c2.roundBox(0.35, 0.25, 0.3, 0.03, CM('#e8e4dc'), x, fl + 0.55, 0.42)
          c2.text('+', 0.18, 0.18, x, fl + 0.68, 0.42, '+y', { fg: '#c0281c' })
        })
        c2.part('cargo', trl('labels.ferry_tank'), null, new V3(0, 1.1, 0), 0.9)
      }
    },
  )

  /* ================= Turboprop attack trainer (Super Tucano type) ================= */
  /* Reference · Embraer EMB-314 / A-29 Super Tucano - WebSearch (migflug, aerocorner, The Defense Post); gear and tail from memory
     Real measurements: length 11.38 m · span 11.14 m · height 3.97 m · wing area 19.4 m2 · Hartzell five-blade propeller of 2.38 m ·
     main gear track about 3.2 m and wheelbase about 3.9 m (from memory) · tyres about 0.6 m (main) and 0.4 m (nose) (from memory) ·
     fuselage about 0.98 m wide (from memory) · PT6A-68C of 1,600 shp · 695 L internal · two .50 machine guns in the wings.
     Signature traits:
     front: five-blade propeller with a pointed spinner, long narrow nose with a mouth-shaped air intake under the spinner,
     two exhausts on each side of the nose, low wing with dihedral, .50 barrels coming out of the leading edge
     side: long bubble canopy with two stepped seats (the rear one higher) and an arch between them, back that drops to the tail,
     five hardpoints (two under each wing and one on the belly), green camouflage in two shades on top and light grey below
     rear: tall fin with a dorsal fin and a ventral fin, low straight elevator, thin tail cone
     top: trapezoid wing with straight tips, canopy from end to end of the cockpit, anti-slip strip at the wing root */
  fx.register(
    {
      key: 'light_attack_turboprop',
      group: 'military',
      name: trl('vehicles.light_attack_turboprop.name'),
      inspired: trl('vehicles.light_attack_turboprop.inspired'),
      category: trl('vehicles.light_attack_turboprop.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.light_attack_turboprop.description'),
      mass: 5400,
      noise: 800,
      seats: trl('vehicles.light_attack_turboprop.seats'),
      capacity: trl('vehicles.light_attack_turboprop.capacity'),
      efficiency: trl('vehicles.light_attack_turboprop.efficiency'),
      range: trl('vehicles.light_attack_turboprop.range'),
      maxSpeed: 590,
      skill: trl('vehicles.light_attack_turboprop.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        blk = CM('#1a1b1d', { roughness: 0.6 })
      c.meta.matte = true
      /* per-vertex camouflage: two shades of green in patches on top, light grey below (real colours in the white material) */
      const cA = new THREE.Color('#323f2b'),
        cB = new THREE.Color('#5f6d45'),
        cC = new THREE.Color('#7f8466'),
        cL = new THREE.Color('#a3abad')
      function camo(x: any, z: any, y: any, under: any) {
        if (under) return cL
        const n = Math.sin(x * 1.35 + z * 0.9) + Math.sin(x * 0.55 - z * 1.7 + 1.3) + 0.6 * Math.sin(y * 2.2 + x * 0.3)
        return n > 0.9 ? cC : n > -0.1 ? cB : cA
      }
      const camoM = c.paint('#ffffff')
      camoM.vertexColors = true
      const ST = [
        [5.18, 1.44, 1.58, 0.12, 2],
        [5.02, 1.12, 1.84, 0.62, 2.2],
        [4.55, 0.98, 1.92, 0.86, 2.4],
        [3.6, 0.96, 1.96, 0.92, 2.5],
        [2.6, 0.93, 2.04, 0.96, 2.5],
        [1.0, 0.9, 2.1, 0.98, 2.6],
        [-0.6, 0.92, 2.08, 0.94, 2.6],
        [-1.8, 1.06, 2.02, 0.82, 2.4],
        [-3.4, 1.36, 1.96, 0.55, 2.2],
        [-4.9, 1.58, 1.95, 0.3, 2.1],
        [-5.5, 1.68, 1.94, 0.1, 2],
      ]
      const fus = c.add(
        EA.fuseGeo(ST, {
          seg: 36,
          col: function (x: any, y: any, z: any) {
            return camo(x, z, y, y < 1.32 + (x < -1.5 ? (-1.5 - x) * 0.12 : 0))
          },
        }),
        camoM,
      )
      const ckCut = [-1.0, 2.62, 1.86, 2.4, null, 0.42]
      kit.cutMesh(
        fus,
        [
          EA.cutT(ckCut, function (n: any) {
            return n.y > 0.35
          }),
        ],
        40,
      )
      c.deform.push(fus)
      /* nose: mouth air intake under the spinner, two exhausts on each side, anti-slip */
      c.roundBox(0.3, 0.2, 0.42, 0.08, MT.dark, 4.98, 1.12, 0)
      ;[1, -1].forEach(function (s) {
        ;[4.28, 4.02].forEach(function (x, i) {
          const e = c.cylinder(0.07, 0.085, 0.28, MT.steel, x, 1.5 - i * 0.04, s * 0.47, 'x', { seg: 14 })
          e.rotation.y = -s * 0.6
          c.cylinder(0.06, 0.06, 0.02, MT.dark, x - 0.13, 1.5 - i * 0.04, s * 0.55, 'x').rotation.y = -s * 0.6
        })
        sideText(c, ST, '5901', 0.62, 0.22, -2.6, 1.55, s, { fg: '#d2cfbb' })
        starDecal(c, -1.2, 1.55, s * 0.445, 0.2, s > 0 ? '+z' : '-z', { bg: '#3a4430', fg: '#b8b9a4' })
      })
      /* bubble canopy (moulded glass), windshield and middle arches, rail */
      /* stepped canopy: the rear half (instructor/operator) sits about 20 cm higher than the front */
      const CN = [
        [2.7, 1.98, 2.02, 0.42, 2],
        [2.35, 1.97, 2.42, 0.8, 2.2],
        [1.6, 1.97, 2.62, 0.86, 2.2],
        [1.0, 1.97, 2.7, 0.86, 2.2],
        [0.45, 1.97, 2.86, 0.86, 2.2],
        [-0.25, 1.97, 2.82, 0.8, 2.2],
        [-0.85, 1.97, 2.5, 0.56, 2.1],
        [-1.25, 1.97, 2.1, 0.18, 2],
      ]
      const can = new THREE.Mesh(EA.fuseGeo(CN, { smooth: 30, seg: 28 }), MT.glass)
      c.vehicle.add(can)
      kit.cutMesh(
        can,
        [
          {
            sdf: function (x: any, y: any) {
              return y - 1.99
            },
          },
        ],
        30,
      )
      const canG = kit.asGlass(c, can, lbl('canopy'), 'laminated', { pos: new V3(1.0, 2.5, 0) })
      void canG
      c.tube(
        [
          [2.42, 2.0, -0.41],
          [2.36, 2.3, -0.33],
          [2.3, 2.45, 0],
          [2.36, 2.3, 0.33],
          [2.42, 2.0, 0.41],
        ],
        0.025,
        blk,
        { seg: 20 },
      )
      c.tube(
        [
          [0.74, 2.0, -0.44],
          [0.74, 2.52, -0.34],
          [0.74, 2.79, 0],
          [0.74, 2.52, 0.34],
          [0.74, 2.0, 0.44],
        ],
        0.03,
        blk,
        { seg: 20 },
      )
      ;[1, -1].forEach(function (s) {
        c.roundBox(3.7, 0.04, 0.03, 0.012, blk, 0.7, 1.99, s * 0.44)
      })
      c.roundBox(0.02, 0.32, 0.6, 0.02, MT.glass, 0.95, 2.22, 0).castShadow = false
      /* interior: two stepped ejection seats, sticks, panels with two screens and a HUD at the front */
      const fab = CM('#2e3328', { roughness: 0.85 })
      c.roundBox(3.4, 0.03, 0.8, 0.01, MT.carpet, 0.8, 1.2, 0).castShadow = false
      ;[
        [1.55, 1.24],
        [0.2, 1.46],
      ].forEach(function (q, i) {
        kit.seat(c, q[0], q[1], 0, { w: 0.5, h: 0.32, back: 0.85, lean: 0.24, mat: fab, headrest: false })
        c.roundBox(0.14, 0.3, 0.44, 0.04, CM('#202224'), q[0] - 0.42, q[1] + 1.05, 0, { rot: [0, 0, 0.24] })
        c.rod(new V3(q[0] - 0.38, q[1] + 1.25, -0.06), new V3(q[0] - 0.3, q[1] + 1.4, 0.06), 0.012, MT.yellow)
        c.rod(new V3(q[0] + 0.35, q[1], 0), new V3(q[0] + 0.32, q[1] + 0.45, 0), 0.016, blk)
        c.sphere(0.03, blk, q[0] + 0.31, q[1] + 0.48, 0, 1, 1.5, 1)
        const px = q[0] + 0.75
        c.roundBox(0.16, 0.3, 0.6, 0.04, CM('#232427'), px, q[1] + 0.65, 0, { rot: [0, 0, 0.2] })
        ;[-0.15, 0.15].forEach(function (z) {
          c.roundBox(0.012, 0.16, 0.18, 0.008, MT.screen, px - 0.09, q[1] + 0.68, z, { rot: [0, 0, 0.2] }).castShadow = false
        })
        if (i === 0) {
          c.roundBox(
            0.03,
            0.16,
            0.16,
            0.008,
            CM('#3fbf6a', { transparent: true, opacity: 0.35, emissive: new THREE.Color('#2a8a4a'), emissiveIntensity: 0.6 }),
            px + 0.02,
            q[1] + 0.95,
            0,
            { rot: [0, 0, -0.3] },
          ).castShadow = false
        }
      })
      /* low trapezoid wing with 5.5 degree dihedral, camouflaged on top */
      const dh = function (z: any) {
          return 1.02 + Math.max(0, Math.abs(z) - 0.48) * 0.096
        },
        legs = [],
        pyl = []
      const wingM = c.paint('#ffffff')
      wingM.vertexColors = true
      ;[1, -1].forEach(function (s) {
        const g = EA.foilGeo(
          [
            { p: [1.52, dh(0), 0], c: 2.35, t: 0.15, cam: 0.02 },
            { p: [1.5, dh(0.48), s * 0.48], c: 2.32, t: 0.15, cam: 0.02 },
            { p: [0.78, dh(5.4), s * 5.4], c: 1.2, t: 0.12, cam: 0.02 },
            { p: [0.74, dh(5.57), s * 5.57], c: 1.1, t: 0.07, cam: 0.01 },
          ],
          { up: 'y', n: 14 },
        )
        EA.colorize(g, function (x: any, y: any, z: any) {
          return camo(x, z, y, y < dh(z) - 0.005)
        })
        const w = c.add(g, wingM)
        c.deform.push(w)
        c.roundBox(0.012, 0.012, 2.3, 0.004, MT.dark, -0.42, dh(2.2) + 0.1, s * 2.2, { rot: [s * 0.096, 0, 0] }).castShadow = false
        c.roundBox(1.6, 0.004, 0.5, 0.002, CM('#2b2d2a', { roughness: 1 }), 0.2, dh(0.75) + 0.16, s * 0.75).castShadow = false
        starDecal(c, 0.1, dh(4.2) + 0.115, s * 4.2, 0.26, '+y', { bg: '#3a4430', fg: '#b8b9a4' })
        EA.navLight(
          c,
          0.3,
          dh(5.57),
          s * 5.6,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.right_navigation_light_green') : trl('labels.left_navigation_light_red'),
          { r: 0.035 },
        )
        /* .50 machine gun in the wing: barrel coming out of the leading edge */
        c.cylinder(0.022, 0.022, 0.5, MT.steel, 1.55, dh(1.5) - 0.06, s * 1.5, 'x', { seg: 10 })
        c.cylinder(0.03, 0.03, 0.06, MT.dark, 1.8, dh(1.5) - 0.06, s * 1.5, 'x', { seg: 10 })
        /* pylons: inner with a tank/rocket, outer with a rocket pod */
        ;[
          [2.45, 'tanque'],
          [3.6, 'foguete'],
        ].forEach(function (q: any) {
          const z = s * q[0],
            y = dh(q[0]) - 0.14
          pyl.push(c.roundBox(0.8, 0.14, 0.06, 0.03, CM('#5d6555', { roughness: 0.7 }), 0.55, y, z))
          if (q[1] === 'foguete') {
            const rp = pod(c, EA, 1.25, -0.45, y - 0.25, z, 0.19, CM('#353b30', { roughness: 0.75 }))
            pyl.push(rp)
            pyl.push(c.cylinder(0.17, 0.17, 0.02, MT.dark, 1.26, y - 0.25, z, 'x', { seg: 19 }))
          } else {
            const tk = pod(c, EA, 1.55, -0.95, y - 0.28, z, 0.24, CM('#5b6458', { roughness: 0.7 }))
            pyl.push(tk)
          }
        })
        /* main gear retracting into the wing */
        legs.push(
          c.rod(new V3(0.1, dh(1.6) - 0.1, s * 1.6), new V3(0.0, 0.3, s * 1.6), 0.05, MT.chrome),
          c.roundBox(0.75, 0.04, 0.42, 0.01, CM('#a3abad'), 0.05, dh(1.2) - 0.12, s * 1.15, { rot: [s * 1.3, 0, 0] }),
        )
        c.wheel(0.0, s * 1.6, 0.3, 0.18, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#8a8f8c', { metalness: 0.5 }) })
      })
      /* belly pylon and nose wheel */
      pyl.push(c.roundBox(0.9, 0.12, 0.08, 0.03, CM('#5d6555'), 0.6, 0.86, 0))
      legs.push(
        c.rod(new V3(3.95, 0.98, 0), new V3(3.95, 0.2, 0), 0.04, MT.chrome),
        c.roundBox(0.6, 0.3, 0.02, 0.01, CM('#a3abad'), 4.0, 0.82, 0.16),
        c.roundBox(0.6, 0.3, 0.02, 0.01, CM('#a3abad'), 4.0, 0.82, -0.16),
      )
      c.wheel(3.95, 0.0001, 0.2, 0.12, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#8a8f8c', { metalness: 0.5 }) })
      EA.lamp(c, 4.1, 0.86, 0.0001, 0.045, trl('labels.landing_and_taxi_light'))
      /* empennage: tall fin with dorsal and ventral fins, low elevator */
      const tailM = c.paint('#ffffff')
      tailM.vertexColors = true
      function ctail(geo: any, top: any) {
        EA.colorize(geo, function (x: any, y: any, z: any) {
          return camo(x, z, y, top ? false : y < 1.7)
        })
        return geo
      }
      const fin = c.add(
        ctail(
          EA.foilGeo(
            [
              { p: [-3.55, 1.92, 0], c: 2.2, t: 0.11 },
              { p: [-4.92, 3.94, 0], c: 0.9, t: 0.1 },
            ],
            { up: 'z', n: 10 },
          ),
          true,
        ),
        tailM,
      )
      c.deform.push(fin)
      const dors = c.add(
        ctail(
          EA.foilGeo(
            [
              { p: [-1.6, 2.02, 0], c: 2.0, t: 0.04 },
              { p: [-3.6, 2.5, 0], c: 0.3, t: 0.06 },
            ],
            { up: 'z', n: 8 },
          ),
          true,
        ),
        tailM,
      )
      c.deform.push(dors)
      const ventralFin = c.add(
        EA.foilGeo(
          [
            { p: [-4.2, 1.42, 0], c: 1.2, t: 0.07 },
            { p: [-4.85, 1.1, 0], c: 0.6, t: 0.06 },
          ],
          { up: 'z', n: 6 },
        ),
        CM('#a3abad', { roughness: 0.8 }),
      )
      c.deform.push(ventralFin)
      ;[1, -1].forEach(function (s) {
        const g = EA.foilGeo(
          [
            { p: [-4.3, 1.72, 0], c: 1.3, t: 0.1 },
            { p: [-4.72, 1.76, s * 2.2], c: 0.75, t: 0.09 },
          ],
          { up: 'y', n: 10 },
        )
        EA.colorize(g, function (x: any, y: any, z: any) {
          return camo(x, z, y, y < 1.72 + Math.abs(z) * 0.018)
        })
        const hs = c.add(g, tailM)
        c.deform.push(hs)
      })
      c.roundBox(0.012, 1.7, 0.03, 0.004, MT.dark, -5.25, 2.9, 0, { rot: [0, 0, -0.55] }).castShadow = false
      EA.navLight(c, -5.55, 1.82, 0, 'white', trl('labels.tail_light'), { r: 0.03 })
      EA.navLight(c, -5.1, 3.96, 0, 'red', trl('labels.anti_collision_light'), { r: 0.035 })
      /* five-blade propeller with a pointed spinner */
      const pr = EA.propeller(c, 5.22, 1.51, 0, {
        R: 1.19,
        blades: 5,
        chord: 0.17,
        spinL: 0.42,
        spinR: 0.2,
        spinCol: '#3f4b37',
        tip: '#d8c43a',
      })
      c.part('propeller', trl('labels.five_blade_propeller'), pr, new V3(5.3, 1.51, 0), 1.0)
      c.part('engine', trl('labels.pt6a_68c_turbine'), null, new V3(4.3, 1.45, 0), 1.0)
      c.part('fuel_tank', trl('labels.wing_tanks'), null, new V3(0.6, 1.15, 2.0), 1.2)
      c.part('landing_gear', trl('labels.landing_gear'), null, new V3(0.0, 0.4, 1.6), 1.0)
      c.part('weapon', trl('labels.n_50_machine_guns_in_the_wings'), null, new V3(1.5, 1.0, 1.5), 0.8)
      Object.assign(c.meta, {
        kind: 'plane',
        length: 11.38,
        width: 11.14,
        fuselageWidth: 0.98,
        front: 5.62,
        rear: -5.8,
        clearance: 0.9,
        belt: 1.75,
        bodyHeight: 1.2,
        top: 3.97,
        roof: null,
      })
      c.zone('nose', trl('labels.nose_turbine_and_propeller'), [2.65, 5.8, 0.8, 2.15, -0.7, 0.7], null, { dir: 'front', fxKey: 'nose' })
      c.zone('cab', trl('labels.tandem_cockpit'), [-1.0, 2.65, 0.85, 2.3, -0.62, 0.62], null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_pilot_and_the_operator'),
        anyMesh: true,
      })
      c.zone('canopy', trl('labels.canopy'), [-1.3, 2.75, 1.96, 2.95, -0.5, 0.5], null, {
        type: 'roof',
        fxKey: 'windshield',
        dir: 'up',
        alsoGlass: true,
        who: trl('who.the_pilot'),
      })
      c.zone('fuselage', trl('labels.tail_cone'), [-3.6, -1.0, 0.9, 2.2, -0.6, 0.6])
      c.zone('tail', trl('labels.fin_elevator_and_strakes'), [-5.95, -3.6, 0.95, 4.1, -2.4, 2.4])
      c.zone('weapons', trl('labels.pylons_rockets_and_external_tanks'), [-1.1, 1.7, 0.25, 1.0, -4.0, 4.0], pyl, {
        type: 'part',
        fxKey: 'weapon',
        dir: 'up',
        anchor: [0.3, 1.0, 0],
        fx: [
          trl('effects.none'),
          trl('effects.scratched_pod_still_fires'),
          trl('effects.bent_pylon_aim_misaligned'),
          trl('effects.hanging_pod_drags_and_may_fall'),
          trl('effects.loads_torn_off_no_rockets_or_extra_tank'),
        ],
      })
      c.zone('landing_gear', null, null, legs)
      c.zone('headlight_center', trl('labels.landing_and_taxi_light'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_light'))
      c.meta.armor = function (c2: any) {
        /* modified: machine-gun pod on the belly, fragmentation bombs on the inner pylons in place of the tanks,
         steel plates on the cabin sides and a spotlight on the outer left pylon */
        const stl = kit.steelMaterial,
          gp = CM('#3a4232', { roughness: 0.7 })
        pod(c2, EA, 1.6, -0.7, 0.62, 0, 0.17, gp)
        c2.cylinder(0.025, 0.025, 0.5, MT.steel, 1.75, 0.6, 0, 'x')
        ;[1, -1].forEach(function (s) {
          const y = dh(2.45) - 0.42
          pod(c2, EA, 1.4, -0.4, y, s * 2.45, 0.15, CM('#5a5f4a', { roughness: 0.6 }))
          ;[0, 1, 2, 3].forEach(function (k) {
            const a = (k * PI) / 2
            c2.roundBox(0.25, 0.01, 0.12, 0.004, gp, -0.38, y + Math.cos(a) * 0.12, s * 2.45 + Math.sin(a) * 0.12, { rot: [a, 0, 0] })
          })
          c2.roundBox(1.6, 0.3, 0.02, 0.02, stl, 1.2, 1.7, s * 0.48)
        })
        EA.lamp(c2, 1.32, dh(3.6) - 0.66, -3.6, 0.09, trl('labels.search_spotlight'))
        c2.part('weapon', trl('labels.machine_gun_and_bomb_pod'), null, new V3(0.5, 0.6, 0), 1.0)
      }
    },
  )
}
