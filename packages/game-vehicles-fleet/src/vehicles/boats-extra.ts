import type { FleetContext } from '../context'

/* Boats group of the fleet ("water" group). Uses only the kit API.
   The hull, deck, navigation light, outboard motor and variable tube helpers come from the shared water/air helpers (installed before this file).
   Local helpers of this file (not in the core): sailGeo (triangular sail with a belly), ropeAlong (lifeline sagging between stanchions). */
export function installBoatsExtra(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const shared = fx.shared
  const trl = fx.t
  const lbl = fx.label

  if (!kit || !shared.EA) return
  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial,
    _G = kit.geo,
    DS = THREE.DoubleSide,
    EA = shared.EA,
    tb = EA.tab

  /* triangular sail: tack T, head (top) Hd, sheet clew C, belly cam (fraction of the chord) towards +z */
  function sailGeo(T: any, Hd: any, C: any, cam: any, o?: any) {
    o = o || {}
    const nu = o.nu || 10,
      nv = o.nv || 16,
      pos = [],
      idx = [],
      roach = o.roach || 0
    for (let j = 0; j <= nv; j++) {
      const v = j / nv
      for (let i = 0; i <= nu; i++) {
        const u = i / nu,
          bx = T[0] + (C[0] - T[0]) * u,
          by = T[1] + (C[1] - T[1]) * u,
          bz = T[2] + (C[2] - T[2]) * u
        let x = bx + (Hd[0] - bx) * v
        const y = by + (Hd[1] - by) * v
        let z = bz + (Hd[2] - bz) * v
        const chord = Math.hypot(C[0] - T[0], C[1] - T[1]) * (1 - v)
        x -= roach * u * Math.sin(v * PI) * (u > 0.7 ? 1 : u / 0.7)
        z += cam * chord * 4 * u * (1 - u) * (0.6 + 0.4 * (1 - v))
        pos.push(x, y, z)
      }
    }
    for (let a = 0; a < nv; a++)
      for (let b = 0; b < nu; b++) {
        const p0 = a * (nu + 1) + b,
          p1 = p0 + nu + 1
        idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  /* lifeline: runs through the stanchion rings pts and sags a little between them */
  function ropeAlong(c: any, pts: any, sag: any, r: any, mat: any) {
    const out = []
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1]
      for (let k = 0; k < 4; k++) {
        const t = k / 4
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * Math.sin(t * PI), a[2] + (b[2] - a[2]) * t])
      }
    }
    out.push(pts[pts.length - 1])
    return c.tube(out, r, mat, { seg: out.length * 3, rs: 5 })
  }

  /* ================= jet ski ================= */
  /* Reference · Sea-Doo Spark 3-up (WebSearch: BRP "Spark 3-up" sheet: 305 x 118 x 107 cm, dry weight about 199 kg, 30 L tank, Rotax 900 ACE 60/90 hp)
     Real measurements: length 3.05 m · width 1.18 m · height 1.07 m (bottom to handlebar) · draft about 0.25 m (from memory) · 3 seats ·
     speed about 80 km/h with 90 hp · consumption about 10-17 L/h (from memory).
     Signature traits:
     front: short rounded nose rising from the V, wide coloured hood, narrow handlebar without fairing, bow eye
     side: low short hull, long stepped 3-seat saddle, open footwells beside the seat, straight hull chine
     rear: short shallow boarding platform level with the gunwale (reviewer: shallower footwells, wider rim, pedestal tucked under the seat), turbine nozzle with a black reverse bucket (iBR) below, boarding step
     top: teardrop body, wide hood at the front, narrow seat in the middle with footwells on both sides */
  fx.register(
    {
      key: 'jet_ski',
      group: 'water',
      name: trl('vehicles.jet_ski.name'),
      inspired: trl('vehicles.jet_ski.inspired'),
      article: trl('vehicles.jet_ski.article'),
      category: trl('vehicles.jet_ski.category'),
      fuel: 'gasoline',
      description: trl('vehicles.jet_ski.description'),
      mass: 199,
      noise: 85,
      seats: trl('vehicles.jet_ski.seats'),
      capacity: trl('vehicles.jet_ski.capacity'),
      efficiency: trl('vehicles.jet_ski.efficiency'),
      range: trl('vehicles.jet_ski.range'),
      maxSpeed: 80,
      skill: trl('vehicles.jet_ski.skill'),
      hood: false,
    },
    function (c) {
      const L = 2.98,
        x0 = -1.48
      const white = c.paint('#eceae4', { roughness: 0.35 }),
        blue = c.paint('#1b86c9', { roughness: 0.3, metalness: 0.05 }),
        grey = CM('#3d4146', { roughness: 0.7 }),
        mat = CM('#2b2d30', { roughness: 0.95 }),
        blk = CM('#151618', { roughness: 0.45 })
      const H = EA.boatHull({
        x0: x0,
        L: L,
        n: 36,
        m1: 5,
        m2: 5,
        q: 0.9,
        fl: 0.8,
        keel: tb([
          [0, -0.21],
          [0.5, -0.25],
          [0.8, -0.16],
          [0.95, 0.08],
          [1, 0.32],
        ]),
        chine: function (t: any) {
          return [
            tb([
              [0, 0.43],
              [0.55, 0.48],
              [0.85, 0.34],
              [1, 0.0],
            ])(t),
            tb([
              [0, -0.09],
              [0.6, -0.1],
              [0.9, 0.06],
              [1, 0.32],
            ])(t),
          ]
        },
        sheer: function (t: any) {
          return [
            tb([
              [0, 0.53],
              [0.45, 0.565],
              [0.8, 0.45],
              [0.97, 0.12],
              [1, 0.0],
            ])(t),
            tb([
              [0, 0.27],
              [0.6, 0.3],
              [0.85, 0.34],
              [1, 0.4],
            ])(t),
          ]
        },
      })
      const hull = c.add(H.geo, white)
      c.deform.push(hull)
      /* chine and black trim strip */
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any) {
          return -0.05 - y
        }),
        c.paint('#c9ccce', { roughness: 0.45 }),
        { sz: 1.004, dy: 0.002 },
      )
      EA.sheerTube(c, H, x0 + 0.02, 1.46, 0.022, blk, { closeBow: true })
      /* rim (gunwale) around the footwells, boarding platform and footwell floors */
      const gun = c.add(
        EA.deckGeo(H, x0 + 0.02, 0.4, {
          inner: function (x: any) {
            return H.sheerAt(x).z - 0.14
          },
          n: 20,
          m: 3,
        }),
        blue,
      )
      c.deform.push(gun)
      const plat = c.add(
        EA.deckGeo(H, x0 + 0.01, -1.12, {
          y: function () {
            return 0.245
          },
          inset: 0.02,
          n: 4,
          m: 8,
        }),
        grey,
      )
      plat.castShadow = false
      const flr = c.add(
        EA.deckGeo(H, -1.12, 0.4, {
          y: function () {
            return 0.17
          },
          inset: 0.03,
          n: 14,
          m: 8,
        }),
        mat,
      )
      flr.castShadow = false
      /* seat pedestal (white), hood (blue) and seat (black with a blue trim strip) */
      const ped = c.add(
        EA.fuseGeo(
          [
            [-1.05, 0.08, 0.34, 0.4, 4],
            [-0.9, 0.08, 0.41, 0.48, 4],
            [0.05, 0.08, 0.45, 0.52, 4],
            [0.3, 0.08, 0.5, 0.56, 4],
          ].reverse(),
          { smooth: 16, seg: 24 },
        ),
        white,
      )
      c.deform.push(ped)
      const hdST = [
        [0.26, 0.08, 0.55, 0.92, 3],
        [0.48, 0.08, 0.66, 1.02, 3],
        [0.8, 0.1, 0.63, 0.92, 3],
        [1.1, 0.14, 0.53, 0.72, 3],
        [1.33, 0.22, 0.45, 0.3, 3],
        [1.47, 0.32, 0.41, 0.04, 3],
      ].reverse()
      const hood = c.add(EA.fuseGeo(hdST, { smooth: 30, seg: 30 }), blue)
      c.deform.push(hood)
      EA.fuseSkin(
        c,
        hdST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.26 - y, x - 0.35)
        }),
        white,
        { k: 1.006 },
      )
      const stST = [
        [-1.07, 0.3, 0.57, 0.5, 2.6],
        [-0.85, 0.3, 0.64, 0.56, 2.6],
        [-0.25, 0.32, 0.66, 0.58, 2.6],
        [0.12, 0.35, 0.71, 0.56, 2.6],
        [0.33, 0.42, 0.73, 0.42, 2.6],
        [0.4, 0.5, 0.7, 0.12, 2.6],
      ].reverse()
      const seat = c.add(EA.fuseGeo(stST, { smooth: 30, seg: 28 }), CM('#24272a', { roughness: 0.75 }))
      c.deform.push(seat)
      EA.fuseSkin(
        c,
        stST,
        EA.bandT(function (x: any, y: any) {
          const yc = 0.45 + (x + 1.0) * 0.05
          return 0.018 - Math.abs(y - yc)
        }),
        CM('#1b86c9', { roughness: 0.6 }),
        { k: 1.01 },
      )
      c.seatTops.push(
        { x: -0.75, y: 0.64, z: 0, w: 0.45, l: 0.4 },
        { x: -0.35, y: 0.66, z: 0, w: 0.45, l: 0.4 },
        { x: 0.05, y: 0.7, z: 0, w: 0.45, l: 0.4 },
      )
      /* handlebar: column, bar, grips, throttle (right), iBR lever (left) and digital panel */
      const bar = new THREE.Group()
      bar.userData.rigid = true
      c.vehicle.add(bar)
      const P = { parent: bar }
      c.roundBox(0.2, 0.16, 0.26, 0.05, blk, 0.47, 0.66, 0, P)
      c.rod(new V3(0.48, 0.66, 0), new V3(0.42, 0.8, 0), 0.03, blk, P)
      c.tube(
        [
          [0.36, 0.83, -0.37],
          [0.42, 0.82, -0.18],
          [0.43, 0.81, 0],
          [0.42, 0.82, 0.18],
          [0.36, 0.83, 0.37],
        ],
        0.014,
        MT.chrome,
        { seg: 20, rs: 6 },
      )
      ;[1, -1].forEach(function (s) {
        c.cylinder(0.024, 0.024, 0.13, MT.rubber, 0.365, 0.83, s * 0.33, 'z', P)
      })
      c.roundBox(0.05, 0.015, 0.07, 0.006, blk, 0.39, 0.81, 0.24, P)
      c.roundBox(0.06, 0.012, 0.06, 0.005, blk, 0.39, 0.81, -0.24, P)
      c.roundBox(0.012, 0.06, 0.12, 0.008, MT.screen, 0.5, 0.75, 0, { rot: [0, 0, 0.5], parent: bar })
      c.part('handlebar', trl('labels.handlebar_and_dashboard'), bar, new V3(0.44, 0.8, 0), 0.4)
      /* turbine: nozzle, reverse bucket (iBR), water intake, boarding step, bow eye, badge */
      const pump = new THREE.Group()
      pump.userData.rigid = true
      c.vehicle.add(pump)
      const PP = { parent: pump }
      c.cylinder(0.075, 0.09, 0.22, blk, -1.4, -0.08, 0, 'x', PP)
      c.cylinder(0.05, 0.065, 0.06, MT.steel, -1.52, -0.08, 0, 'x', PP)
      c.roundBox(0.08, 0.2, 0.24, 0.03, blk, -1.54, -0.02, 0, Object.assign({ rot: [0, 0, -0.35] }, PP))
      c.roundBox(0.06, 0.04, 0.42, 0.015, grey, -1.5, 0.18, 0, PP)
      c.roundBox(0.5, 0.02, 0.28, 0.01, CM('#2a2c2e'), -0.6, -0.245, 0)
      c.cylinder(0.02, 0.02, 0.05, MT.chrome, 1.43, 0.3, 0, 'x')
      ;[1, -1].forEach(function (s) {
        EA.hullText(c, H, trl('texts.si_d_spark'), 0.86, 0.1, -0.3, 0.13, s, { fg: '#1b86c9' })
        c.roundBox(0.25, 0.04, 0.05, 0.015, grey, -1.25, -0.08, s * 0.4)
      })
      /* night light kit: two-colour at the nose and a high white one on the platform */
      EA.navLight(c, 1.27, 0.47, 0.05, 'green', trl('labels.bicolor_light_green'), { r: 0.022, hs: 0.2 })
      EA.navLight(c, 1.27, 0.47, -0.05, 'red', trl('labels.bicolor_light_red'), { r: 0.022, hs: 0.2 })
      c.rod(new V3(-1.35, 0.2, -0.38), new V3(-1.35, 0.95, -0.38), 0.008, MT.chrome)
      EA.navLight(c, -1.35, 0.97, -0.38, 'white', trl('labels.overtaking_light_pole'), { r: 0.025, hs: 0.25 })
      c.part('hull', trl('labels.hull'), hull, new V3(0, -0.1, 0), 1.0)
      c.part('stern', trl('labels.turbine_and_ibr'), pump, new V3(-1.55, -0.05, 0), 0.5)
      c.part('engine', trl('labels.rotax_900_ace_engine_under_the_seat'), null, new V3(-0.35, 0.15, 0), 0.6)
      c.part('fuel_tank', trl('labels.tank_30_l'), null, new V3(0.75, 0.2, 0), 0.5)
      Object.assign(c.meta, {
        kind: 'boat',
        length: 3.05,
        width: 1.18,
        front: 1.5,
        rear: -1.6,
        clearance: -0.25,
        belt: 0.3,
        bodyHeight: 0.6,
        top: 0.83,
        roof: null,
      })
      c.zone('deck', trl('labels.seat_handlebar_and_hood'))
      c.zone('taillight_center', trl('labels.bicolor_bow_light'))
      c.zone('taillight_left', trl('labels.overtaking_light'))
      c.zone('engine', trl('labels.rotax_engine_under_the_seat'))
      c.zone('stern', trl('labels.stern_and_turbine'))
      c.meta.armor = function (c2: any) {
        /* modified: rescue sled behind, steel plate on the nose, handlebar spotlight and a jerry can on the platform */
        const stl = kit.steelMaterial,
          sled = CM('#e8b51c', { roughness: 0.5 })
        c2.roundBox(1.1, 0.07, 1.0, 0.04, sled, -2.2, 0.08, 0)
        c2.roundBox(0.05, 0.12, 1.0, 0.03, sled, -2.75, 0.13, 0)
        ;[-0.35, 0, 0.35].forEach(function (z) {
          c2.roundBox(0.9, 0.03, 0.03, 0.01, CM('#1b1c1e'), -2.2, 0.13, z)
        })
        c2.rod(new V3(-1.66, 0.2, 0.3), new V3(-1.7, 0.12, 0.42), 0.015, stl)
        c2.rod(new V3(-1.66, 0.2, -0.3), new V3(-1.7, 0.12, -0.42), 0.015, stl)
        c2.roundBox(0.5, 0.2, 0.75, 0.02, stl, 1.15, 0.42, 0, { rot: [0, 0, -0.55] })
        kit.jerryCan(c2, -1.3, 0.42, 0.18, '#8e2a20')
        EA.lamp(c2, 0.5, 0.88, 0.0001, 0.06, trl('labels.handlebar_spotlight'))
      }
    },
  )

  /* ================= sailboat ================= */
  /* Reference · 26 ft ocean sailboat, Delta 26 type design (WebSearch: sheet of a 26 ft bulb-keel boat, "Deltania 26":
     LOA 25.98 ft = 7.92 m · beam 9.38 ft = 2.86 m · draft 4.72 ft = 1.44 m · displacement 4,630 lb = about 2,100 kg)
     Mast about 9.5 m above the deck, total height about 10.4 m above the water, boom about 3.1 m, 7/8 fractional rig, 10 hp diesel inboard
     with a fixed shaft: mast, boom and engine from memory.
     Signature traits:
     front: fine raked bow, stainless pulpit with a two-colour light, forestay up to the 7/8 point, large genoa
     side: white hull with a blue stripe and waterline, low cabin with long sloped windows, open cockpit aft, tall mast on the cabin roof
     rear: wide, almost vertical transom with the name, tiller rudder, pushpit with a white light, bathing ladder, backstay
     top: hull teardrop wide aft, narrow cabin in the middle, U-shaped cockpit with winches, hatch on the foredeck
     Underneath: fin keel (cast iron) with a bulb and a skeg-hung rudder; two-blade propeller ahead of the rudder. */
  fx.register(
    {
      key: 'sailboat',
      group: 'water',
      name: trl('vehicles.sailboat.name'),
      inspired: trl('vehicles.sailboat.inspired'),
      article: trl('vehicles.sailboat.article'),
      category: trl('vehicles.sailboat.category'),
      fuel: 'diesel',
      description: trl('vehicles.sailboat.description'),
      mass: 2100,
      noise: 30,
      seats: trl('vehicles.sailboat.seats'),
      capacity: trl('vehicles.sailboat.capacity'),
      efficiency: trl('vehicles.sailboat.efficiency'),
      range: trl('vehicles.sailboat.range'),
      maxSpeed: 13,
      skill: trl('vehicles.sailboat.skill'),
      hood: false,
    },
    function (c) {
      const L = 7.92,
        x0 = -3.96
      const white = c.paint('#f2f1eb', { roughness: 0.3, metalness: 0.05 }),
        navy = CM('#1d3b6b', { roughness: 0.35 }),
        nonskid = CM('#d9d6cb', { roughness: 0.9 }),
        teak = CM('#9a7348', { roughness: 0.8 }),
        alu = CM('#b9bec2', { metalness: 0.7, roughness: 0.3 }),
        sailM = CM('#f4f2ea', { roughness: 0.85, side: DS }),
        wire = CM('#8f969b', { metalness: 0.8, roughness: 0.3 })
      const H = EA.boatHull({
        x0: x0,
        L: L,
        n: 48,
        m1: 6,
        m2: 6,
        q: 1.5,
        fl: 0.7,
        keel: tb([
          [0, 0.05],
          [0.15, -0.3],
          [0.45, -0.5],
          [0.75, -0.4],
          [0.9, -0.08],
          [1, 1.05],
        ]),
        chine: function (t: any) {
          return [
            tb([
              [0, 1.0],
              [0.4, 1.3],
              [0.75, 1.15],
              [0.95, 0.4],
              [1, 0.0],
            ])(t),
            tb([
              [0, 0.28],
              [0.5, 0.05],
              [0.85, 0.3],
              [1, 1.05],
            ])(t),
          ]
        },
        sheer: function (t: any) {
          return [
            tb([
              [0, 1.22],
              [0.45, 1.43],
              [0.8, 1.2],
              [0.95, 0.5],
              [1, 0.0],
            ])(t),
            tb([
              [0, 0.95],
              [0.4, 0.88],
              [1, 1.2],
            ])(t),
          ]
        },
      })
      const hull = c.add(H.geo, white)
      c.deform.push(hull)
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any) {
          return 0.0 - y
        }),
        c.paint('#7b2220', { roughness: 0.6 }),
        { sz: 1.004, dy: 0.003 },
      )
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any) {
          return 0.035 - Math.abs(y - 0.07)
        }),
        navy,
        { sz: 1.005 },
      )
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any) {
          const sy = H.sheerAt(x).y
          return Math.min(0.04 - Math.abs(y - (sy - 0.13)), x + 3.9, 3.7 - x)
        }),
        navy,
        { sz: 1.006 },
      )
      EA.sheerTube(c, H, x0 + 0.01, 3.94, 0.025, CM('#e9e7df', { roughness: 0.5 }), { closeBow: true })
      /* deck: whole at the bow, side strips around the cockpit; cockpit floor, benches and coamings */
      const fd = c.add(EA.deckGeo(H, -1.05, 3.95, { n: 30, m: 10, crown: 0.04 }), nonskid)
      c.deform.push(fd)
      const sd = c.add(
        EA.deckGeo(H, x0 + 0.02, -1.05, {
          inner: function (x: any) {
            return H.sheerAt(x).z - 0.3
          },
          n: 14,
          m: 3,
        }),
        nonskid,
      )
      c.deform.push(sd)
      const cs = c.add(
        EA.deckGeo(H, x0 + 0.05, -1.05, {
          y: function () {
            return 0.48
          },
          inset: 0.02,
          n: 12,
          m: 8,
        }),
        teak,
      )
      cs.castShadow = false
      ;[1, -1].forEach(function (s) {
        c.roundBox(2.6, 0.06, 0.42, 0.02, teak, -2.45, 0.86, s * 0.82)
        c.roundBox(2.6, 0.38, 0.06, 0.02, white, -2.45, 0.67, s * 0.6)
        c.roundBox(2.8, 0.22, 0.05, 0.02, white, -2.4, 1.02, s * (H.sheerAt(-2.4).z - 0.32))
        c.cylinder(0.06, 0.07, 0.11, MT.chrome, -1.6, 1.15, s * 1.06)
        c.cylinder(0.035, 0.035, 0.02, MT.chrome, -1.6, 1.21, s * 1.06)
      })
      c.roundBox(0.3, 0.38, 1.2, 0.03, white, -3.75, 0.67, 0)
      c.seatTops.push({ x: -2.6, y: 0.9, z: 0.82, w: 0.42, l: 2.4 }, { x: -2.6, y: 0.9, z: -0.82, w: 0.42, l: 2.4 })
      /* cabin (low housing), long windows, companionway with steps, foredeck hatch */
      const trST = [
        [-1.1, 0.8, 1.56, 2.0, 6],
        [0.4, 0.8, 1.56, 2.0, 6],
        [1.4, 0.85, 1.48, 1.7, 6],
        [2.15, 0.92, 1.3, 1.05, 6],
      ].reverse()
      const trunk = c.add(EA.fuseGeo(trST, { smooth: 18, seg: 32, p: 6 }), white)
      c.deform.push(trunk)
      EA.fuseSkin(
        c,
        trST,
        EA.bandT(function (x: any, y: any) {
          return y - 1.53
        }),
        nonskid,
        { k: 1.004 },
      )
      const winP = EA.polySdf([
        [-0.75, 1.2],
        [1.3, 1.22],
        [1.75, 1.32],
        [1.55, 1.42],
        [-0.75, 1.43],
      ])
      ;[1, -1].forEach(function (s) {
        const gw = EA.skinOf(
          c,
          trunk,
          EA.bandT(function (x: any, y: any, z: any) {
            return -Math.max(winP(x, y), 0.5 - s * z)
          }),
          MT.glassDark,
          { sz: 1.012 },
        )
        c.deform.splice(c.deform.indexOf(gw), 1)
        kit.asGlass(c, gw, s > 0 ? lbl('cabin_windows_starboard') : lbl('cabin_windows_port'), 'tempered')
      })
      c.roundBox(0.04, 0.5, 0.62, 0.01, CM('#1a1b1c'), -1.1, 1.2, 0)
      c.roundBox(0.05, 0.36, 0.56, 0.01, teak, -1.12, 1.12, 0)
      c.roundBox(0.65, 0.07, 0.72, 0.03, white, -0.7, 1.6, 0)
      c.roundBox(0.6, 0.06, 0.06, 0.02, white, -0.7, 1.58, 0.38)
      c.roundBox(0.6, 0.06, 0.06, 0.02, white, -0.7, 1.58, -0.38)
      c.roundBox(0.5, 0.05, 0.5, 0.02, CM('#5d6c78', { roughness: 0.3, metalness: 0.2 }), 2.75, 1.13, 0)
      /* cockpit: tiller, compass, engine panel, cabin winches, sheet track */
      c.rod(new V3(-3.55, 0.85, 0), new V3(-2.3, 1.02, 0), 0.03, teak)
      c.cylinder(0.05, 0.05, 0.12, MT.steel, -3.55, 0.8, 0)
      c.cylinder(0.08, 0.08, 0.06, CM('#111214'), -1.13, 1.38, 0.45, 'x')
      c.sphere(0.06, MT.lens, -1.16, 1.4, 0.45, 0.6, 0.8, 1)
      c.roundBox(0.03, 0.18, 0.26, 0.01, MT.screen, -1.13, 1.38, -0.45)
      ;[1, -1].forEach(function (s) {
        c.cylinder(0.045, 0.05, 0.09, MT.chrome, -0.85, 1.6, s * 0.75)
      })
      c.roundBox(0.06, 0.04, 1.4, 0.01, MT.steel, -1.9, 0.89, 0)
      /* fin keel with a bulb, hung rudder, propeller and diesel exhaust */
      const keel = c.add(
        EA.foilGeo(
          [
            { p: [0.75, -0.3, 0], c: 1.15, t: 0.12 },
            { p: [0.47, -1.36, 0], c: 0.76, t: 0.12 },
          ],
          { up: 'z', n: 10 },
        ),
        CM('#2d2f31', { roughness: 0.6, metalness: 0.3 }),
      )
      c.sphere(0.11, CM('#2d2f31', { roughness: 0.6, metalness: 0.3 }), 0.08, -1.33, 0, 4.4, 1, 1.4)
      c.add(
        EA.foilGeo(
          [
            { p: [-3.2, -0.02, 0], c: 0.46, t: 0.1 },
            { p: [-3.28, -1.05, 0], c: 0.33, t: 0.1 },
          ],
          { up: 'z', n: 8 },
        ),
        CM('#7b2220', { roughness: 0.6 }),
      )
      c.rod(new V3(-2.0, -0.3, 0), new V3(-2.45, -0.38, 0), 0.02, MT.steel)
      c.roundBox(0.25, 0.08, 0.04, 0.02, CM('#7b2220'), -2.05, -0.36, 0)
      const prop = EA.propeller(c, -2.5, -0.385, 0, {
        R: 0.17,
        blades: 2,
        chord: 0.08,
        spinner: false,
        tip: false,
        mat: CM('#b88a3c', { metalness: 0.7, roughness: 0.3 }),
        v: 0,
        tw0: 0.9,
      })
      c.cylinder(0.03, 0.03, 0.06, MT.steel, -3.96, 0.32, 0.65, 'x')
      /* mast, spreaders, boom, sails and standing rigging */
      const rig = new THREE.Group()
      rig.userData.rigid = true
      c.vehicle.add(rig)
      const R = { parent: rig }
      const mx = 1.3,
        mTop = 10.4
      c.cylinder(0.07, 0.085, mTop - 1.56, alu, mx, (mTop + 1.56) / 2, 0, null, R)
      c.rod(new V3(mx, 5.7, -0.85), new V3(mx, 5.7, 0.85), 0.02, alu, R)
      c.cylinder(0.055, 0.055, 3.25, alu, mx - 1.62, 2.12, 0, 'x', R)
      const main = c.add(
        sailGeo([mx - 0.06, 2.2, 0], [mx - 0.06, mTop - 0.2, 0], [mx - 3.2, 2.2, 0.05], 0.06, { roach: 0.25 }),
        sailM,
        0,
        0,
        0,
        rig,
      )
      const jib = c.add(sailGeo([3.72, 1.32, 0], [mx + 0.08, 8.85, 0], [0.55, 1.75, 0.2], 0.08), sailM, 0, 0, 0, rig)
      main.castShadow = jib.castShadow = true
      c.text('D26', 0.8, 0.5, mx - 1.2, 7.3, 0.03, '+z', { fg: '#1d3b6b', parent: rig })
      c.text('D26', 0.8, 0.5, mx - 1.2, 7.3, -0.03, '-z', { fg: '#1d3b6b', parent: rig })
      function wireTo(a: any, b: any) {
        c.rod(new V3(a[0], a[1], a[2]), new V3(b[0], b[1], b[2]), 0.006, wire, R)
      }
      wireTo([mx + 0.06, 8.85, 0], [3.85, 1.28, 0])
      wireTo([mx - 0.05, mTop, 0], [-3.9, 1.0, 0])
      ;[1, -1].forEach(function (s) {
        wireTo([mx, 8.85, 0], [mx, 5.7, s * 0.85])
        wireTo([mx, 5.7, s * 0.85], [mx - 0.1, 1.0, s * 1.33])
        wireTo([mx, 5.7, s * 0.08], [mx + 0.45, 1.05, s * 1.25])
        wireTo([mx, 5.7, s * 0.08], [mx - 0.6, 1.0, s * 1.3])
      })
      c.rod(new V3(mx - 2.4, 2.1, 0), new V3(-1.9, 0.92, 0), 0.008, CM('#e4e0d0'), R)
      /* pulpit, pushpit, stanchions with lifelines, bathing ladder, anchor */
      const pul = []
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * PI
        pul.push([3.25 + Math.sin(a) * 0.55, 1.18, Math.cos(a) * 0.45])
      }
      EA.rail(c, pul, 0.6, 0.016, 3)
      const pp = []
      for (let j = 0; j <= 6; j++) {
        const b = (j / 6) * PI
        pp.push([-3.85 + Math.sin(b) * 0.1, 0.96, Math.cos(b) * 1.05])
      }
      EA.rail(c, pp, 0.62, 0.016, 2)
      ;[1, -1].forEach(function (s) {
        const st = []
        for (let x = -3.2; x <= 2.81; x += 1.0) {
          const sh = H.sheerAt(x)
          st.push([x, sh.y, s * (sh.z - 0.05)])
        }
        st.forEach(function (p) {
          c.rod(new V3(p[0], p[1], p[2]), new V3(p[0], p[1] + 0.6, p[2]), 0.012, MT.chrome, { seg: 6 })
        })
        ropeAlong(
          c,
          st.map(function (p) {
            return [p[0], p[1] + 0.6, p[2]]
          }),
          0.03,
          0.005,
          wire,
        )
        ropeAlong(
          c,
          st.map(function (p) {
            return [p[0], p[1] + 0.32, p[2]]
          }),
          0.02,
          0.005,
          wire,
        )
        EA.navLight(
          c,
          3.42,
          1.8,
          s * 0.06,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.bicolor_pulpit_light_green') : trl('labels.bicolor_pulpit_light_red'),
          { r: 0.03 },
        )
      })
      ;[0, 1, 2].forEach(function (k) {
        c.roundBox(0.03, 0.02, 0.32, 0.01, MT.chrome, -4.0, 0.7 - k * 0.22, -0.55)
      })
      c.roundBox(0.2, 0.08, 0.1, 0.02, MT.steel, 3.93, 1.15, 0)
      c.roundBox(0.06, 0.22, 0.14, 0.02, MT.steel, 4.02, 1.02, 0)
      c.text(trl('texts.delta_26'), 1.1, 0.2, -3.97, 0.62, 0.15, '-x', { fg: '#1d3b6b' })
      ;[1, -1].forEach(function (s) {
        EA.hullText(c, H, trl('texts.delta_26'), 0.9, 0.16, 2.3, 0.8, s, { fg: '#1d3b6b' })
      })
      EA.navLight(c, -3.95, 1.62, 0, 'white', trl('labels.overtaking_light_aft'), { r: 0.03 })
      EA.navLight(c, mx + 0.1, 5.2, 0, 'white', trl('labels.masthead_light_motoring'), { r: 0.035, parent: rig })
      EA.navLight(c, mx, mTop + 0.05, 0, 'white', trl('labels.anchor_light_top'), { r: 0.03, parent: rig })
      c.part('hull', trl('labels.hull'), hull, new V3(0, -0.2, 0), 2.0)
      c.part('keel', trl('labels.bulb_keel'), keel, new V3(0.3, -0.9, 0), 0.8)
      c.part('engine', trl('labels.n_10_hp_diesel_engine_under_the_companionway'), null, new V3(-1.4, 0.35, 0), 0.8)
      c.part('fuel_tank', trl('labels.diesel_tank_40_l'), null, new V3(-2.8, 0.45, 0.6), 0.6)
      c.part('propeller', trl('labels.propeller'), prop, new V3(-2.5, -0.38, 0), 0.4)
      c.part('mast', trl('labels.mast_and_sails'), rig, new V3(mx, 3.0, 0), 1.0)
      Object.assign(c.meta, {
        kind: 'boat',
        length: L,
        width: 2.86,
        front: 3.96,
        rear: -3.96,
        clearance: -1.44,
        belt: 0.95,
        bodyHeight: 1.6,
        top: mTop,
        roof: { x0: -1.1, x1: 2.0, w: 1.9, y: 1.56 },
      })
      c.zone('deck', trl('labels.deck_cabin_and_cockpit'), null, null, { alsoGlass: true })
      c.zone('engine', trl('labels.centre_diesel_engine'))
      c.zone('taillight_center', trl('labels.navigation_and_masthead_lights'))
      c.zone('glass_left', trl('labels.cabin_windows_port_side'))
      c.zone('glass_right', trl('labels.cabin_windows_starboard_side'))
      c.zone('mast', trl('labels.mast_boom_and_sails'), [mx - 3.4, 4.0, 1.6, mTop + 0.2, -0.95, 0.95], [rig], {
        type: 'part',
        anchor: [mx, 1.6, 0],
        dir: 'up',
        fx: [
          trl('effects.none'),
          trl('effects.torn_sail_loose_line_banging'),
          trl('effects.bent_spreader_swaying_mast'),
          trl('effects.cracked_mast_sail_on_the_deck'),
          trl('effects.broken_mast_engine_only'),
        ],
      })
      c.meta.armor = function (c2: any) {
        /* modified: sails furled under a storm sail, steel plates on the cabin windows, jerry cans lashed on deck and a spotlight on the pulpit */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          c2.roundBox(2.1, 0.3, 0.02, 0.01, stl, 0.45, 1.33, s * 0.985, { rot: [-s * 0.05, 0, 0] })
          for (let x2 = -0.6; x2 < 1.3; x2 += 0.35) c2.roundBox(0.12, 0.03, 0.025, 0.005, CM('#151515'), x2, 1.36, s * 1.0)
        })
        ;[
          [-0.2, 1.08],
          [0.15, 1.08],
          [-0.2, -1.08],
        ].forEach(function (q, i) {
          kit.jerryCan(c2, q[0] + 2.4, 1.3, q[1] * 0.7, i % 2 ? '#3e5a34' : '#8e2a20')
        })
        c2.roundBox(0.4, 0.4, 0.02, 0.01, stl, -3.85, 1.25, 0)
        EA.lamp(c2, 3.7, 1.95, 0.0001, 0.07, trl('labels.pulpit_spotlight'))
      }
    },
  )

  /* ================= dinghy ================= */
  /* Reference · Zodiac FC 470 (military and rescue inflatable boat) - from memory (the sheet did not show up in the search)
     Real measurements: length 4.70 m · beam 1.90 m · tube diameter 0.49 m · 6 compartments · hull about 120 kg · up to 10 people ·
     outboard up to 60 hp (usually 40 hp) · aluminium floor · inflatable keel.
     Signature traits:
     front: U-shaped tubes rising at the bow, bow handle, towing ring, lifeline all around
     side: thick orange tube along the whole length, grey chafe strip below, stern cones past the transom, "RESCUE" on the tubes
     rear: two tube cones beyond the wooden transom, tiller outboard in the middle, red tank on the floor
     top: U shape with thick tubes, grey floor, cross thwart, stretcher and oars */
  fx.register(
    {
      key: 'rescue_dinghy',
      group: 'water',
      name: trl('vehicles.rescue_dinghy.name'),
      inspired: trl('vehicles.rescue_dinghy.inspired'),
      article: trl('vehicles.rescue_dinghy.article'),
      category: trl('vehicles.rescue_dinghy.category'),
      fuel: 'gasoline',
      description: trl('vehicles.rescue_dinghy.description'),
      mass: 230,
      noise: 75,
      seats: trl('vehicles.rescue_dinghy.seats'),
      capacity: trl('vehicles.rescue_dinghy.capacity'),
      efficiency: trl('vehicles.rescue_dinghy.efficiency'),
      range: trl('vehicles.rescue_dinghy.range'),
      maxSpeed: 55,
      skill: trl('vehicles.rescue_dinghy.skill'),
      hood: false,
    },
    function (c) {
      const orange = c.paint('#e2581f', { roughness: 0.6 }),
        grey = CM('#4a4f53', { roughness: 0.75, side: DS }),
        flo = CM('#8c9296', { roughness: 0.8, metalness: 0.3 }),
        rope = CM('#d9d4c2', { roughness: 0.9 })
      /* low rigid hull (inflatable keel and bottom) inside the tubes */
      const H = EA.boatHull({
        x0: -1.95,
        L: 3.95,
        n: 24,
        m1: 4,
        m2: 3,
        q: 0.9,
        fl: 1,
        keel: tb([
          [0, -0.17],
          [0.6, -0.2],
          [0.85, -0.1],
          [1, 0.25],
        ]),
        chine: function (t: any) {
          return [
            tb([
              [0, 0.5],
              [0.6, 0.5],
              [0.88, 0.3],
              [1, 0.0],
            ])(t),
            tb([
              [0, -0.06],
              [0.6, -0.06],
              [0.9, 0.08],
              [1, 0.25],
            ])(t),
          ]
        },
        sheer: function (t: any) {
          return [
            tb([
              [0, 0.6],
              [0.6, 0.62],
              [0.88, 0.4],
              [1, 0.0],
            ])(t),
            tb([
              [0, 0.14],
              [0.7, 0.15],
              [1, 0.32],
            ])(t),
          ]
        },
      })
      const hull = c.add(H.geo, grey)
      c.deform.push(hull)
      /* tubes: variable-radius tube in a U, tapering stern cones, chafe strip and lifeline */
      const zc = 0.705,
        yc = 0.22
      const half = [
        [-2.37, yc + 0.01, zc - 0.02],
        [-2.05, yc, zc],
        [-1.2, yc, zc],
        [0.2, yc, zc],
        [1.0, yc + 0.02, zc - 0.03],
        [1.55, yc + 0.07, zc - 0.17],
        [1.9, yc + 0.15, zc - 0.4],
        [2.09, yc + 0.2, 0],
      ]
      const path = half.concat(
        half
          .slice(0, -1)
          .reverse()
          .map(function (p) {
            return [p[0], p[1], -p[2]]
          }),
      )
      function rf(u: any) {
        const e = Math.min(u, 1 - u)
        return 0.245 * (e < 0.035 ? 0.62 + 0.38 * EA.sstep(0, 0.035, e) : 1)
      }
      const tube = c.add(EA.sweepGeo(path, rf, { n: 140, rs: 20 }), orange)
      c.deform.push(tube)
      const strake = c.add(
        EA.sweepGeo(
          path.map(function (p) {
            const s = Math.sign(p[2]) || 0
            return [p[0], p[1] - 0.17, p[2] + s * 0.08 * (Math.abs(p[2]) / zc)]
          }),
          function (u: any) {
            return rf(u) * 0.36
          },
          { n: 140, rs: 10 },
        ),
        grey,
      )
      c.deform.push(strake)
      const rings: any = []
      ;[1, -1].forEach(function (s) {
        for (let x = -1.9; x <= 1.31; x += 0.64) rings.push([x, yc + 0.17, s * (zc + 0.17)])
      })
      const rs = rings.filter(function (p: any) {
          return p[2] > 0
        }),
        rp = rings
          .filter(function (p: any) {
            return p[2] < 0
          })
          .reverse()
      const loop = rs
        .concat([
          [1.85, yc + 0.32, 0.22],
          [2.15, yc + 0.32, 0],
          [1.85, yc + 0.32, -0.22],
        ])
        .concat(rp)
      ropeAlong(c, loop, 0.05, 0.011, rope)
      loop.forEach(function (p: any) {
        c.roundBox(0.06, 0.05, 0.02, 0.01, MT.steel, p[0], p[1] - 0.02, p[2])
      })
      ;[1, -1].forEach(function (s) {
        c.text('RESGATE', 1.3, 0.2, 0.0, yc + 0.02, s * (zc + 0.248), s > 0 ? '+z' : '-z', { fg: '#ffffff' })
        ;[-2.32, 1.95].forEach(function (x) {
          c.roundBox(0.04, 0.08, 0.04, 0.01, MT.plastic, x, yc + 0.2, s * 0.68)
        })
        c.roundBox(0.14, 0.05, 0.05, 0.02, CM('#1b1b1b'), -0.6, yc + 0.24, s * zc)
        c.roundBox(0.14, 0.05, 0.05, 0.02, CM('#1b1b1b'), 0.9, yc + 0.24, s * zc)
      })
      c.cylinder(0.04, 0.04, 0.03, MT.steel, 2.2, yc + 0.1, 0, 'x')
      c.tube(
        [
          [1.92, yc + 0.42, -0.12],
          [1.98, yc + 0.5, 0],
          [1.92, yc + 0.42, 0.12],
        ],
        0.014,
        CM('#1b1b1b'),
        { seg: 10, rs: 5 },
      )
      /* aluminium floor, wooden transom, cross thwart and rescue gear */
      const flr = c.add(
        EA.deckGeo(H, -1.88, 1.45, {
          y: function () {
            return 0.02
          },
          inset: 0.02,
          n: 16,
          m: 8,
        }),
        flo,
      )
      flr.castShadow = false
      for (let xx = -1.5; xx < 1.4; xx += 0.6) c.roundBox(0.015, 0.006, H.half(xx, 0.02) * 2 - 0.08, 0.002, CM('#5d6266'), xx, 0.025, 0)
      c.roundBox(0.07, 0.62, 1.1, 0.02, CM('#3a3d40', { roughness: 0.6 }), -1.95, 0.22, 0)
      c.roundBox(0.07, 0.08, 1.2, 0.02, CM('#5c4a35'), -1.95, 0.54, 0)
      c.roundBox(0.32, 0.05, 1.42, 0.02, grey, -0.25, yc + 0.18, 0)
      c.roundBox(0.25, 0.1, 0.25, 0.03, CM('#2c3033'), -0.25, yc + 0.08, 0)
      c.seatTops.push(
        { x: -0.25, y: yc + 0.21, z: 0, w: 1.2, l: 0.3 },
        { x: 0.6, y: yc + 0.25, z: zc, w: 0.3, l: 0.9 },
        { x: 0.6, y: yc + 0.25, z: -zc, w: 0.3, l: 0.9 },
        { x: -1.1, y: yc + 0.25, z: zc, w: 0.3, l: 0.8 },
        { x: -1.1, y: yc + 0.25, z: -zc, w: 0.3, l: 0.8 },
      )
      const tank = c.roundBox(0.48, 0.24, 0.3, 0.06, CM('#a3241c', { roughness: 0.5 }), -1.55, 0.15, 0.2)
      c.rod(new V3(-1.6, 0.27, 0.2), new V3(-1.9, 0.5, 0.05), 0.01, CM('#1b1b1b'))
      c.roundBox(1.8, 0.05, 0.45, 0.02, CM('#e8b51c', { roughness: 0.5 }), 0.55, 0.06, -0.12)
      ;[-0.25, 0.25].forEach(function (z) {
        c.roundBox(1.6, 0.025, 0.04, 0.01, CM('#1b1c1e'), 0.55, 0.09, -0.12 + z * 0.6)
      })
      c.roundBox(1.6, 0.03, 0.1, 0.01, MT.wood, 0.3, 0.05, 0.38, { rot: [0.2, 0, 0] })
      c.roundBox(1.6, 0.03, 0.1, 0.01, MT.wood, 0.3, 0.06, 0.28, { rot: [0.2, 0, 0] })
      c.roundBox(0.36, 0.24, 0.26, 0.03, CM('#ffffff', { roughness: 0.5 }), 1.25, 0.14, 0.15)
      c.roundBox(0.1, 0.03, 0.02, 0.005, CM('#d01c1c'), 1.25, 0.2, 0.282)
      c.roundBox(0.03, 0.1, 0.02, 0.005, CM('#d01c1c'), 1.25, 0.2, 0.282)
      const buoy = c.add(new THREE.TorusGeometry(0.24, 0.06, 10, 24), CM('#f0f0ea', { roughness: 0.6 }), 1.1, 0.1, -0.2)
      buoy.rotation.x = PI / 2
      /* 40 hp tiller outboard; lights: two-colour at the bow, white all-round on the stern pole, blue rescue beacon */
      const motor = EA.outboard(c, -1.99, 0.55, 0, { k: 1.0, tiller: true, label: '40', col: '#1d1f22' })
      EA.navLight(c, 1.98, yc + 0.48, 0.06, 'green', trl('labels.bow_light_green'), { r: 0.025, hs: 0.25 })
      EA.navLight(c, 1.98, yc + 0.48, -0.06, 'red', trl('labels.bow_light_red'), { r: 0.025, hs: 0.25 })
      c.rod(new V3(1.98, yc + 0.25, 0), new V3(1.98, yc + 0.45, 0), 0.01, MT.chrome)
      c.rod(new V3(-1.92, 0.55, -0.45), new V3(-1.92, 1.25, -0.45), 0.014, MT.chrome)
      EA.navLight(c, -1.92, 1.28, -0.45, 'white', trl('labels.circular_stern_light'), { r: 0.03 })
      EA.navLight(c, -1.92, 1.12, -0.45, 'blue', trl('labels.blue_rescue_beacon'), { r: 0.035, hs: 0.45 })
      c.part('hull', trl('labels.floats_and_hull'), tube, new V3(0, 0.2, 0), 1.4)
      c.part('stern', trl('labels.outboard_motor'), motor, new V3(-2.3, 0.5, 0), 0.8)
      c.part('fuel_tank', trl('labels.portable_tank'), tank, new V3(-1.55, 0.15, 0.2), 0.5)
      Object.assign(c.meta, {
        kind: 'boat',
        length: 4.7,
        width: 1.9,
        front: 2.33,
        rear: -2.6,
        clearance: -0.2,
        belt: 0.45,
        bodyHeight: 0.6,
        top: 1.3,
        roof: null,
      })
      c.zone('deck', trl('labels.floor_seat_and_rescue_equipment'))
      c.zone('taillight_center', trl('labels.bow_lights'))
      c.zone('taillight_left', trl('labels.stern_light_and_beacon'))
      c.meta.armor = function (c2: any) {
        /* modified: thick aluminium plates protecting the bow tubes, spotlight on a pole, jerry cans and a grille on the engine */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          ;[0.3, 0.95].forEach(function (x2) {
            c2.roundBox(0.6, 0.38, 0.02, 0.02, stl, x2, yc + 0.03, s * (zc + 0.26))
          })
          c2.roundBox(0.5, 0.36, 0.02, 0.02, stl, 1.65, yc + 0.08, s * 0.66, { rot: [0, s * 0.6, 0] })
        })
        c2.rod(new V3(1.3, 0.04, 0), new V3(1.3, 1.25, 0), 0.025, stl)
        EA.lamp(c2, 1.38, 1.28, 0.0001, 0.08, trl('labels.search_spotlight'))
        kit.jerryCan(c2, -1.15, 0.24, -0.25, '#3e5a34')
        kit.jerryCan(c2, -1.15, 0.24, -0.45, '#8e2a20')
        c2.tube(
          [
            [-2.0, 0.55, -0.35],
            [-2.65, 0.5, -0.3],
            [-2.65, 0.5, 0.3],
            [-2.0, 0.55, 0.35],
          ],
          0.016,
          stl,
          { seg: 16, rs: 6 },
        )
      }
    },
  )

  /* ================= patrol boat ================= */
  /* Reference · 40 ft river patrol boat, LPR-40 base (WebSearch: LPR-40 sheet - 12.7 m · beam 2.8 m · draft 0.7 m ·
     about 14 t loaded · 2 Caterpillar C9 diesel engines with water jets · 29 knots · 4 crew · .50 (12.7 mm) and 7.62 mm machine guns · radar).
     Generic marks: "PATROL" and a fictional hull number, no real insignia.
     Signature traits:
     front: deep-V bow, high and fine, .50 mount with a shield on the forecastle, sloped three-panel windshield, thick black fender
     side: naval grey hull with a black waterline, low wide house amidships, mast with radar and antennas, D fender on the rim
     rear: straight stern with two water-jet nozzles and reverse buckets, boarding platform, 7.62 machine guns on the aft rims
     top: smooth dark grey deck, house almost the full beam, engine hatches on the aft deck, cocoon life raft */
  fx.register(
    {
      key: 'patrol_boat',
      group: 'water',
      name: trl('vehicles.patrol_boat.name'),
      inspired: trl('vehicles.patrol_boat.inspired'),
      article: trl('vehicles.patrol_boat.article'),
      category: trl('vehicles.patrol_boat.category'),
      fuel: 'diesel',
      description: trl('vehicles.patrol_boat.description'),
      mass: 14000,
      noise: 160,
      seats: trl('vehicles.patrol_boat.seats'),
      capacity: trl('vehicles.patrol_boat.capacity'),
      efficiency: trl('vehicles.patrol_boat.efficiency'),
      range: trl('vehicles.patrol_boat.range'),
      maxSpeed: 54,
      skill: trl('vehicles.patrol_boat.skill'),
      hood: false,
    },
    function (c) {
      const L = 12.42,
        x0 = -6.05
      const hullC = c.paint('#66727a', { roughness: 0.5, metalness: 0.25 }),
        deckC = CM('#4b545a', { roughness: 0.9 }),
        cabC = c.paint('#76828a', { roughness: 0.5, metalness: 0.2 }),
        blk = CM('#151617', { roughness: 0.6 }),
        gunM = CM('#202224', { metalness: 0.5, roughness: 0.4 })
      const H = EA.boatHull({
        x0: x0,
        L: L,
        n: 50,
        m1: 6,
        m2: 6,
        q: 0.9,
        fl: 0.85,
        keel: tb([
          [0, -0.55],
          [0.5, -0.7],
          [0.8, -0.5],
          [0.95, 0.4],
          [1, 1.5],
        ]),
        chine: function (t: any) {
          return [
            tb([
              [0, 1.25],
              [0.55, 1.28],
              [0.85, 0.98],
              [0.97, 0.3],
              [1, 0.0],
            ])(t),
            tb([
              [0, -0.05],
              [0.6, 0.0],
              [0.9, 0.55],
              [1, 1.5],
            ])(t),
          ]
        },
        sheer: function (t: any) {
          return [
            tb([
              [0, 1.31],
              [0.55, 1.33],
              [0.85, 1.16],
              [0.97, 0.45],
              [1, 0.0],
            ])(t),
            tb([
              [0, 1.12],
              [0.6, 1.2],
              [1, 1.78],
            ])(t),
          ]
        },
      })
      const hull = c.add(H.geo, hullC)
      c.deform.push(hull)
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.06 - y, x - x0 - 0.04)
        }),
        CM('#1d2023', { roughness: 0.6 }),
        { sz: 1.004, dy: 0.003 },
      )
      EA.sheerTube(c, H, x0 + 0.02, 6.2, 0.07, blk, { dy: -0.1, dz: 0.02 })
      const deck = c.add(EA.deckGeo(H, x0 + 0.02, 6.32, { n: 40, m: 10, crown: 0.05 }), deckC)
      c.deform.push(deck)
      const dk = function (x: any) {
        return H.sheerAt(x).y + 0.04
      }
      /* house with a sloped windshield, cut-out windows, aft door, roof with an overhang */
      const hx = 0.9,
        hy0 = dk(hx),
        hh = 1.85,
        cab = c.roundBox(3.4, hh, 2.3, 0.1, cabC, hx, hy0 + hh / 2, 0, { def: true, taper: { sx: 0.88, sz: 0.92, shift: -0.2 } })
      const cutF = {
        sel: function (n: any) {
          return n.x > 0.5
        },
        sdf: function (x: any, y: any, z: any) {
          return Math.max(0.2 - y, y - 0.75, Math.abs(z) - 0.98, 0.04 - Math.abs(z - 0.33), 0.04 - Math.abs(z + 0.33))
        },
      }
      const cutD = {
        sel: function (n: any, ce: any) {
          return n.x < -0.5 && ce.x < 0
        },
        sdf: function (x: any, y: any, z: any) {
          return Math.max(-0.88 - y, y - 0.6, Math.abs(z + 0.35) - 0.33)
        },
      }
      kit.cutMesh(
        cab,
        [
          EA.sideCutP(
            [
              [-1.3, 0.2],
              [-0.15, 0.2],
              [-0.15, 0.7],
              [-1.3, 0.7],
            ],
            0.5,
          ),
          EA.sideCutP(
            [
              [-0.05, 0.2],
              [1.0, 0.2],
              [0.85, 0.7],
              [-0.05, 0.7],
            ],
            0.5,
          ),
          cutF,
          cutD,
        ],
        42,
        { sub: 0.15 },
      )
      const kF = (0.475 + hh / 2) / hh,
        fx = hx + 1.7 * (1 - 0.12 * kF) - 0.2 * kF - 0.02,
        fzw = 1.15 * (1 - 0.08 * kF)
      const fw = c.roundBox(0.016, 0.6, fzw * 2 - 0.12, 0.01, MT.glass, fx, hy0 + hh / 2 + 0.475, 0, { rot: [0, 0, 0.214] })
      kit.asGlass(c, fw, lbl('wheelhouse_windshield'), 'laminated')
      ;[1, -1].forEach(function (s) {
        const kS = (0.45 + hh / 2) / hh,
          sz = 1.15 * (1 - 0.08 * kS) - 0.02
        const gs = c.roundBox(2.3, 0.52, 0.014, 0.01, MT.glass, hx - 0.15 - 0.15, hy0 + hh / 2 + 0.45, s * sz, { rot: [-s * 0.05, 0, 0] })
        kit.asGlass(c, gs, s > 0 ? lbl('starboard_windows') : lbl('port_windows'), 'laminated')
        EA.navLight(
          c,
          hx + 1.2,
          hy0 + hh - 0.2,
          s * 1.12,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.starboard_side_light_green') : trl('labels.port_side_light_red'),
          { r: 0.045 },
        )
        c.roundBox(0.3, 0.2, 0.05, 0.02, blk, hx + 1.2, hy0 + hh - 0.2, s * 1.08)
        EA.hullText(c, H, 'PATRULHA', 2.0, 0.3, 0.4, 0.75, s, { fg: '#f2f2f2' })
        EA.hullText(c, H, 'LP-07', 0.8, 0.3, 2.4, 0.85, s, { fg: '#f2f2f2' })
      })
      const door = c.roundBox(0.05, 1.48, 0.64, 0.02, cabC, hx - 1.72, hy0 + 0.76, -0.35)
      void door
      c.roundBox(3.6, 0.08, 2.5, 0.03, cabC, hx + 0.05, hy0 + hh + 0.03, 0)
      c.roundBox(0.5, 0.05, 2.3, 0.02, cabC, hx + 1.55, hy0 + hh + 0.02, 0, { rot: [0, 0, -0.12] })
      /* interior: command console with screens, wheel, throttles, suspension seats and an aft bench */
      const ih = hy0 + 0.02
      c.roundBox(3.2, 0.02, 2.1, 0.01, CM('#2e3236', { roughness: 0.95 }), hx, ih, 0).castShadow = false
      c.roundBox(0.5, 0.95, 2.0, 0.04, CM('#2d3034'), hx + 1.1, ih + 0.48, 0)
      c.roundBox(0.5, 0.03, 2.0, 0.01, CM('#191a1c'), hx + 1.1, ih + 0.96, 0)
      ;[-0.55, 0, 0.55].forEach(function (z) {
        c.roundBox(0.03, 0.26, 0.42, 0.01, MT.screen, hx + 0.92, ih + 1.1, z, { rot: [0, 0, 0.3] })
      })
      const whl = c.add(new THREE.TorusGeometry(0.2, 0.022, 8, 26), CM('#191a1c'), hx + 0.72, ih + 1.02, 0.45)
      whl.rotation.set(0, PI / 2, -0.4)
      c.rod(new V3(hx + 0.86, ih + 0.92, 0.45), new V3(hx + 0.72, ih + 1.02, 0.45), 0.02, MT.chrome)
      ;[0.0, 0.1].forEach(function (z) {
        c.rod(new V3(hx + 0.88, ih + 0.97, z - 0.05), new V3(hx + 0.78, ih + 1.12, z - 0.05), 0.012, MT.chrome)
        c.sphere(0.025, MT.plastic, hx + 0.78, ih + 1.12, z - 0.05)
      })
      kit.seat(c, hx + 0.05, ih, 0.45, { w: 0.52, h: 0.62, back: 0.6, lean: 0.12, mat: CM('#25282b', { roughness: 0.8 }) })
      kit.seat(c, hx + 0.05, ih, -0.45, { w: 0.52, h: 0.62, back: 0.6, lean: 0.12, mat: CM('#25282b', { roughness: 0.8 }) })
      c.roundBox(0.45, 0.42, 1.9, 0.04, CM('#25282b', { roughness: 0.8 }), hx - 1.35, ih + 0.21, 0.1)
      c.seatTops.push({ x: hx - 1.35, y: ih + 0.44, z: 0.1, w: 1.8, l: 0.4 })
      c.roundBox(3.0, 0.02, 2.0, 0.01, CM('#3a3f44', { roughness: 0.9 }), hx, hy0 + hh - 0.06, 0).castShadow = false
      /* mast with radar, antennas, spotlight and blue beacons */
      const mast = new THREE.Group()
      mast.userData.rigid = true
      c.vehicle.add(mast)
      const M = { parent: mast },
        ry = hy0 + hh + 0.07
      c.rod(new V3(hx - 0.6, ry, 0.7), new V3(hx - 0.35, ry + 1.0, 0), 0.04, CM('#c9cdd0'), M)
      c.rod(new V3(hx - 0.6, ry, -0.7), new V3(hx - 0.35, ry + 1.0, 0), 0.04, CM('#c9cdd0'), M)
      c.rod(new V3(hx - 0.35, ry + 1.0, 0), new V3(hx - 0.35, ry + 1.45, 0), 0.035, CM('#c9cdd0'), M)
      c.cylinder(0.07, 0.09, 0.16, CM('#e8e8e4'), hx - 0.35, ry + 1.1, 0, null, M)
      const scan = c.roundBox(0.16, 0.1, 1.2, 0.03, CM('#e8e8e4', { roughness: 0.4 }), hx - 0.35, ry + 1.23, 0, M)
      c.spin.push({ o: scan, axis: 'y', v: 2.5 })
      EA.navLight(c, hx - 0.35, ry + 1.5, 0, 'white', trl('labels.masthead_light'), { r: 0.045, parent: mast })
      ;[0.9, -0.9].forEach(function (z) {
        c.rod(new V3(hx - 1.2, ry, z), new V3(hx - 1.2, ry + 2.3, z * 0.9), 0.012, blk, M)
      })
      ;[1, -1].forEach(function (s) {
        EA.navLight(
          c,
          hx + 1.4,
          ry + 0.07,
          s * 0.95,
          'blue',
          s > 0 ? trl('labels.starboard_blue_beacon') : trl('labels.port_blue_beacon'),
          { r: 0.05, hs: 0.5 },
        )
      })
      EA.lamp(c, hx + 1.55, ry + 0.2, 0.0001, 0.1, trl('labels.search_spotlight'))
      c.cylinder(0.25, 0.25, 1.1, CM('#eceae2', { roughness: 0.5 }), hx - 1.25, ry + 0.27, 0, 'z')
      /* weapons: .50 on the forecastle with a shield, 7.62 on the aft rims */
      const g50 = new THREE.Group()
      g50.userData.rigid = true
      c.vehicle.add(g50)
      const GP = { parent: g50 },
        gx = 4.2,
        gy = dk(4.2)
      c.cylinder(0.12, 0.16, 0.7, gunM, gx, gy + 0.35, 0, null, GP)
      c.roundBox(0.06, 0.65, 0.9, 0.03, gunM, gx + 0.35, gy + 0.98, 0, Object.assign({ rot: [0, 0, -0.08] }, GP))
      c.roundBox(0.75, 0.2, 0.16, 0.03, gunM, gx + 0.05, gy + 0.85, 0, GP)
      c.cylinder(0.035, 0.035, 0.9, gunM, gx + 0.85, gy + 0.88, 0, 'x', GP)
      c.cylinder(0.05, 0.05, 0.25, gunM, gx + 1.25, gy + 0.88, 0, 'x', GP)
      c.roundBox(0.2, 0.15, 0.12, 0.02, CM('#4e5a3a'), gx - 0.05, gy + 0.78, -0.16, GP)
      ;[-0.12, 0.12].forEach(function (z) {
        c.rod(new V3(gx - 0.35, gy + 0.85, z), new V3(gx - 0.5, gy + 0.85, z * 1.6), 0.015, gunM, GP)
      })
      const g76 = new THREE.Group()
      g76.userData.rigid = true
      c.vehicle.add(g76)
      const GQ = { parent: g76 }
      ;[1, -1].forEach(function (s) {
        const px = -4.3,
          py = dk(px),
          pz = s * (H.sheerAt(px).z - 0.2)
        c.rod(new V3(px, py, pz), new V3(px, py + 0.95, pz), 0.04, gunM, GQ)
        c.roundBox(0.6, 0.12, 0.1, 0.02, gunM, px + 0.05, py + 1.0, pz, Object.assign({ rot: [0, -s * 0.3, 0] }, GQ))
        c.rod(new V3(px, py + 1.0, pz), new V3(px + 0.62, py + 1.02, pz + s * 0.2), 0.018, gunM, GQ)
      })
      /* rim: low pushpit, bollards, engine hatches, stern with water jets, platform, anchor */
      ;[1, -1].forEach(function (s) {
        const pts = []
        for (let x = -5.85; x <= 5.4; x += 0.82) {
          const sh = H.sheerAt(x)
          pts.push([x, sh.y + 0.03, s * (sh.z - 0.06)])
        }
        EA.rail(
          c,
          pts.filter(function (p) {
            return p[0] < hx - 1.8 || p[0] > hx + 1.9
          }),
          0.62,
          0.02,
          1,
        )
        ;[-5.4, 2.9].forEach(function (x) {
          c.cylinder(0.06, 0.07, 0.18, MT.steel, x, dk(x) + 0.09, s * (H.sheerAt(x).z - 0.25))
        })
      })
      ;[0.55, -0.55].forEach(function (z) {
        c.roundBox(1.6, 0.03, 0.9, 0.02, CM('#555e64', { roughness: 0.8 }), -3.4, dk(-3.4) + 0.01, z)
      })
      const jets = new THREE.Group()
      jets.userData.rigid = true
      c.vehicle.add(jets)
      const JP = { parent: jets }
      ;[0.55, -0.55].forEach(function (z) {
        c.cylinder(0.2, 0.24, 0.3, CM('#8e9498', { metalness: 0.6, roughness: 0.35 }), x0 - 0.12, -0.1, z, 'x', JP)
        c.roundBox(
          0.16,
          0.42,
          0.42,
          0.06,
          CM('#7d8387', { metalness: 0.6, roughness: 0.4 }),
          x0 - 0.32,
          -0.05,
          z,
          Object.assign({ rot: [0, 0, 0.35] }, JP),
        )
        c.cylinder(0.07, 0.07, 0.1, blk, x0 - 0.02, 0.55, z * 1.6, 'x')
      })
      c.roundBox(0.3, 0.06, 2.2, 0.02, CM('#4b545a', { roughness: 0.9 }), x0 - 0.16, 0.35, 0)
      c.roundBox(0.25, 0.1, 0.12, 0.02, MT.steel, 6.25, 1.6, 0)
      c.roundBox(0.06, 0.35, 0.22, 0.03, blk, 6.34, 1.45, 0)
      EA.navLight(c, x0 + 0.1, dk(x0) + 0.75, 0.0, 'white', trl('labels.overtaking_light_aft'), { r: 0.04 })
      c.rod(new V3(x0 + 0.1, dk(x0), 0), new V3(x0 + 0.1, dk(x0) + 0.72, 0), 0.02, MT.steel)
      c.part('hull', trl('labels.aluminium_hull'), hull, new V3(1, -0.2, 0), 2.6)
      c.part('stern', trl('labels.water_jets'), jets, new V3(x0 - 0.3, -0.1, 0), 0.8)
      c.part('engine', trl('labels.diesel_engines_2_x_c9'), null, new V3(-3.4, 0.4, 0), 1.2)
      c.part('fuel_tank', trl('labels.diesel_tanks'), null, new V3(-1.6, 0.0, 0), 1.0)
      c.part('weapon', trl('labels.bow_50_machine_gun'), g50, new V3(gx, gy + 0.8, 0), 0.6)
      c.part('weapon', trl('labels.stern_7_62_machine_guns'), g76, new V3(-4.3, dk(-4.3) + 1.0, 0), 1.2)
      Object.assign(c.meta, {
        kind: 'boat',
        length: 12.7,
        width: 2.8,
        front: 6.4,
        rear: -6.4,
        clearance: -0.7,
        belt: 1.25,
        bodyHeight: 2.6,
        top: ry + 1.5,
        roof: { x0: hx - 1.7, x1: hx + 1.7, w: 2.3, y: hy0 + hh + 0.07 },
      })
      c.zone('deck', trl('labels.deck_and_deckhouse'), null, null, { alsoGlass: true })
      c.zone('engine', trl('labels.diesel_engines_and_water_jets'))
      c.zone('fuel_tank', trl('labels.diesel_tanks'))
      c.zone('taillight_right', trl('labels.starboard_side_light'))
      c.zone('taillight_left', trl('labels.port_side_light'))
      c.zone('taillight_center', trl('labels.masthead_stern_and_beacon_lights'))
      c.zone('headlight_center', trl('labels.search_spotlight'))
      c.zone('glass_front', trl('labels.wheelhouse_windshield'))
      c.zone('glass_left', trl('labels.port_windows'))
      c.zone('glass_right', trl('labels.starboard_windows'))
      /* reviewer: one zone per mount (the single box covered the whole boat on the map) */
      c.zone('bow_weapon', trl('labels.bow_50_machine_gun'), [gx - 0.7, gx + 1.5, gy - 0.05, gy + 1.45, -0.75, 0.75], [g50], {
        type: 'part',
        fxKey: 'weapon',
        dir: 'front',
      })
      c.zone('stern_weapons', trl('labels.stern_7_62_machine_guns'), [-4.95, -3.55, dk(-4.3) - 0.05, dk(-4.3) + 1.25, -1.5, 1.5], [g76], {
        type: 'part',
        fxKey: 'weapon',
        dir: 'rear',
      })
      c.zone('radar', trl('labels.mast_radar_and_antennas'), [hx - 1.5, hx + 1.8, ry - 0.05, ry + 2.4, -1.2, 1.2], [mast], {
        type: 'part',
        dir: 'up',
        fx: [
          trl('effects.none'),
          trl('effects.bent_antenna_hissing_radio'),
          trl('effects.radar_stopped_frozen_screen'),
          trl('effects.bent_mast_radar_hanging'),
          trl('effects.mast_torn_off_no_radar_or_radio'),
        ],
      })
      c.meta.armor = function (c2: any) {
        /* modified: extra ballistic plates with a vision slit on the windshield, anti-RPG grille on the house, sandbags on the bow and a shield on the 7.62s */
        const stl = kit.steelMaterial
        c2.roundBox(0.05, 0.42, 2.0, 0.02, stl, fx + 0.03, hy0 + hh / 2 + 0.38, 0, { rot: [0, 0, 0.214] })
        ;[1, -1].forEach(function (s) {
          for (let x2 = hx - 1.6; x2 <= hx + 1.45; x2 += 0.22)
            c2.rod(new V3(x2, hy0 + 0.25, s * 1.32), new V3(x2 - 0.05, hy0 + hh - 0.1, s * 1.25), 0.014, stl)
          c2.rod(new V3(hx - 1.6, hy0 + hh - 0.1, s * 1.25), new V3(hx + 1.45, hy0 + hh - 0.1, s * 1.25), 0.02, stl)
          c2.roundBox(0.45, 0.4, 0.04, 0.02, stl, -4.0, dk(-4.0) + 0.95, s * (H.sheerAt(-4.0).z + 0.05))
        })
        for (let k = 0; k < 5; k++)
          c2.roundBox(
            0.5,
            0.18,
            0.3,
            0.08,
            CM('#9a8a62', { roughness: 1 }),
            4.85,
            dk(4.85) + 0.1 + (k > 2 ? 0.17 : 0),
            ((k % 3) - 1) * 0.32,
          )
      }
    },
  )
}
