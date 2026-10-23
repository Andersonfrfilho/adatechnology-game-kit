import type { FleetContext } from '../context'

/* Helicopters added after the first batch (group H). Uses only the kit API, the helpers of the water/air file exposed as the shared EA, and those of group H
   exposed as the shared GH (planes file, installed before this one).
   Local helpers of this file (not in the core): skids (skids with cross tubes), fenestron (shrouded tail rotor),
   xRotor (X tail rotor of the Mi-35M type), gunTurret (nose cannon turret), rocketPod (rocket pod). */
export function installHelicoptersExtra(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const shared = fx.shared
  const trl = fx.t
  const lbl = fx.label

  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial,
    G = kit.geo
  const GH = shared.GH

  /* ================= local utilities ================= */
  /* skids: two tubes with an upturned tip and cross tubes arching up to the belly; returns the meshes */
  function skids(c: any, o: any) {
    const mat = o.mat || MT.steel,
      z = o.z,
      y = o.y || 0.07,
      out: any = []
    ;[1, -1].forEach(function (s) {
      out.push(
        c.tube(
          [
            [o.x0, y + 0.02, s * z],
            [o.x0 + 0.1, y, s * z],
            [o.x1 - 0.15, y, s * z],
            [o.x1 + 0.05, y + 0.07, s * z],
            [o.x1 + 0.16, y + 0.2, s * z],
          ],
          o.r || 0.04,
          mat,
          { seg: 40 },
        ),
      )
      ;(o.shoes || []).forEach(function (x: any) {
        out.push(c.roundBox(0.16, 0.03, 0.06, 0.01, MT.trim, x, y - 0.03, s * z))
      })
      if (o.step)
        out.push(
          c.roundBox(o.step[1], 0.03, 0.2, 0.01, MT.steel, o.step[0], y + 0.28, s * (z - 0.12)),
          c.rod(new V3(o.step[0], y, s * z), new V3(o.step[0], y + 0.28, s * (z - 0.12)), 0.018, MT.steel),
        )
    })
    o.cross.forEach(function (q: any) {
      const x = q[0],
        top = q[1],
        zi = q[2]
      out.push(
        c.tube(
          [
            [x, y, -z],
            [x + (q[3] || 0), (y + top) * 0.55, -(z + zi) / 2 - 0.08],
            [x + (q[3] || 0) * 1.4, top, -zi],
            [x + (q[3] || 0) * 1.4, top + 0.03, 0],
            [x + (q[3] || 0) * 1.4, top, zi],
            [x + (q[3] || 0), (y + top) * 0.55, (z + zi) / 2 + 0.08],
            [x, y, z],
          ],
          o.r2 || 0.035,
          mat,
          { seg: 40 },
        ),
      )
    })
    return out
  }
  /* tail cone by stations along x: [x, centre y, vertical radius, lateral radius] */
  function boom(c: any, EA: any, pts: any, mat: any) {
    const st = pts.map(function (q: any) {
      return [q[0], q[1] - q[2], q[1] + q[2], q[3] * 2, 2]
    })
    const m = c.add(EA.fuseGeo(st, { smooth: 24, seg: 22 }), mat)
    c.deform.push(m)
    return m
  }
  /* fenestron: annular fairing in the fin with an n-blade fan turning in z and a stator */
  function fenestron(c: any, x: any, y: any, R: any, w: any, n: any, mat: any, bladeMat: any) {
    const ring = c.add(new THREE.TorusGeometry(R + 0.06, 0.07, 10, 36), mat, x, y, 0)
    ring.scale.z = w / 0.14
    c.deform.push(ring)
    const duct = c.cylinder(R + 0.01, R + 0.01, w, MT.dark, x, y, 0, 'z', { seg: 36, open: true })
    duct.material = CM('#141516', { roughness: 0.8, side: THREE.DoubleSide })
    const g = new THREE.Group()
    g.position.set(x, y, -w * 0.15)
    c.vehicle.add(g)
    for (let i = 0; i < n; i++) {
      const p = new THREE.Group()
      p.rotation.z = (i / n) * PI * 2
      g.add(p)
      const b = new THREE.Mesh(G.roundedBox(0.07, R - 0.1, 0.012, 0.005), bladeMat)
      b.position.y = (R - 0.1) / 2 + 0.08
      b.rotation.y = 0.35
      p.add(b)
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 14), MT.steel)
    hub.rotation.x = PI / 2
    g.add(hub)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * PI * 2 + 0.2
      c.rod(
        new V3(x + Math.cos(a) * 0.1, y + Math.sin(a) * 0.1, w * 0.2),
        new V3(x + Math.cos(a) * R, y + Math.sin(a) * R, w * 0.25),
        0.012,
        MT.trim,
      )
    }
    c.spin.push({ o: g, axis: 'z', v: 22 })
    return { ring: ring, fan: g, duct: duct }
  }
  /* X tail rotor (two two-blade rotors offset by about 38 degrees), turning in z */
  function xRotor(c: any, x: any, y: any, z: any, R: any, ch: any, mat: any, tip: any) {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    c.vehicle.add(g)
    ;[0, 0.66, PI, PI + 0.66].forEach(function (a, i) {
      const p = new THREE.Group()
      p.rotation.z = a
      p.position.z = i % 2 ? 0.1 : 0
      g.add(p)
      const b = new THREE.Mesh(G.roundedBox(ch, R - 0.15, 0.03, 0.01), mat)
      b.position.y = (R - 0.15) / 2 + 0.15
      b.rotation.y = 0.25
      b.castShadow = true
      p.add(b)
      if (tip) {
        const t = new THREE.Mesh(G.roundedBox(ch * 1.02, 0.2, 0.032, 0.008), tip)
        t.position.y = R - 0.1
        p.add(t)
      }
    })
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16), MT.steel)
    hb.rotation.x = PI / 2
    hb.position.z = 0.05
    g.add(hb)
    c.spin.push({ o: g, axis: 'z', v: 11 })
    return g
  }
  /* 20-rocket pod (generic B-8 type): body with a nose and a dark mouth of tubes */
  function rocketPod(c: any, EA: any, x: any, y: any, z: any, L: any, r: any, mat: any) {
    const m = GH.pod(c, EA, x + L / 2, x - L / 2, y, z, r, mat)
    const face = c.cylinder(r * 0.95, r * 0.95, 0.02, MT.dark, x + L / 2 - L * 0.02, y, z, 'x', { seg: 20 })
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2
      c.cylinder(0.03, 0.03, 0.03, CM('#2a2a28'), x + L / 2 - L * 0.01, y + Math.cos(a) * r * 0.55, z + Math.sin(a) * r * 0.55, 'x', {
        seg: 8,
      })
    }
    return [m, face]
  }

  /* ================= Light trainer helicopter (R22 type) ================= */
  /* Reference · Robinson R22 Beta II - WebFetch (Sloane Helicopters: length 8.8 m, height 2.7 m, rotor 7.7 m), the rest from memory
     Real measurements: overall length with rotors 8.76 m · main rotor 7.67 m (2 blades) · tail rotor 1.07 m · height 2.67 m (top of the hub) ·
     cabin width 1.12 m · skid track 1.93 m (from memory) · skid length about 2.1 m · fuselage (nose to tail) about 6.3 m ·
     Lycoming O-360 4-cylinder engine (131 hp derated) · tanks 72 L + 40 L.
     Signature traits:
     front: small round windshield bubble split by a strip, T cyclic in the middle of the cabin (one stick for two pilots),
     two landing lights on the nose, tall thin mast with a teetering hub and exposed plates
     side: tiny tadpole: two-seat cabin with one door per side, engine almost fully exposed behind the cabin under the mast fairing
     (cylinders, fan and exhaust in view), thin tail cone, short skids
     rear: upper and lower fin with a tube tail guard, small stabilizer, two-blade tail rotor on the left
     top: long two-blade rotor relative to the cabin, teardrop cabin, straight tail cone */
  fx.register(
    {
      key: 'trainer_helicopter',
      group: 'air',
      name: trl('vehicles.trainer_helicopter.name'),
      inspired: trl('vehicles.trainer_helicopter.inspired'),
      category: trl('vehicles.trainer_helicopter.category'),
      fuel: 'avgas',
      description: trl('vehicles.trainer_helicopter.description'),
      mass: 622,
      noise: 350,
      seats: trl('vehicles.trainer_helicopter.seats'),
      capacity: trl('vehicles.trainer_helicopter.capacity'),
      efficiency: trl('vehicles.trainer_helicopter.efficiency'),
      range: trl('vehicles.trainer_helicopter.range'),
      maxSpeed: 190,
      skill: trl('vehicles.trainer_helicopter.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        col = '#1f4f8a',
        blue = c.paint(col),
        white = c.paint('#e9e7e0'),
        blk = CM('#1c1d1f', { roughness: 0.6 })
      const ST = [
        [1.6, 0.84, 0.92, 0.06, 2],
        [1.5, 0.64, 1.22, 0.66, 2.2],
        [1.24, 0.53, 1.48, 0.98, 2.4],
        [0.8, 0.49, 1.68, 1.1, 2.6],
        [0.25, 0.49, 1.74, 1.12, 2.8],
        [-0.3, 0.52, 1.72, 1.06, 2.8],
        [-0.55, 0.62, 1.64, 0.86, 2.6],
        [-0.7, 0.8, 1.56, 0.52, 2.3],
        [-0.78, 0.98, 1.5, 0.22, 2],
      ]
      const wsT = {
        sdf: function (x: any, y: any) {
          return Math.min(x - 0.62 - 0.22 * (y - 0.8), y - 0.75)
        },
      }
      const dP = [
        [0.6, 1.0],
        [-0.22, 1.02],
        [-0.22, 1.66],
        [0.6, 1.7],
      ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 32 }), blue)
      kit.cutMesh(
        fus,
        [
          {
            sdf: function (x: any, y: any) {
              return -wsT.sdf(x, y)
            },
          },
          EA.sideCutP(dP, 0.32),
        ],
        40,
      )
      c.deform.push(fus)
      /* white belly with a black thread, outside the bubble */
      const bl = function (..._rest: any[]) {
        return 0.86
      }
      GH.fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(bl(x) - y, -wsT.sdf(x, y))
        }),
        white,
        { sub: 0.05, pre: EA.keepT([-0.9, 1.7, 0.4, 0.95]) },
      )
      GH.fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.016 - Math.abs(y - bl(x) - 0.04), -wsT.sdf(x, y) - 0.02)
        }),
        blk,
        { k: 1.005, sub: 0.04, pre: EA.keepT([-0.9, 1.7, 0.85, 0.95]) },
      )
      EA.fuseGlass(c, ST, { sdf: wsT.sdf }, lbl('windshield_bubble'), 'laminated', { pos: new V3(1.2, 1.3, 0) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(c, ST, EA.sideKeepP(dP, 0.32, s), s > 0 ? lbl('right_door_window') : lbl('left_door_window'), 'tempered', {
          pos: new V3(0.2, 1.35, s * 0.55),
        })
        const df = EA.polySdf([
          [0.64, 0.6],
          [-0.26, 0.58],
          [-0.26, 1.7],
          [0.64, 1.74],
        ])
        GH.fSkin(
          c,
          EA,
          ST,
          EA.bandT(function (x: any, y: any, z: any) {
            return Math.min(0.006 - Math.abs(df(x, y)), s * z - 0.32)
          }),
          MT.dark,
          { k: 1.003, sub: 0.04, pre: EA.keepT([-0.4, 0.8, 0.5, 1.8, 0.3]) },
        )
        c.roundBox(0.08, 0.02, 0.03, 0.01, MT.chrome, -0.12, 1.0, s * 0.55)
        c.text('PR-ZRR', 0.6, 0.13, -2.4, 1.39, s * 0.095, s > 0 ? '+z' : '-z', { fg: '#f2efe6' })
      })
      c.tube(
        [
          [0.7, 1.72, 0],
          [1.05, 1.6, 0],
          [1.33, 1.38, 0],
          [1.52, 1.12, 0],
          [1.58, 0.88, 0],
        ],
        0.016,
        blk,
        { seg: 30 },
      )
      /* interior: 2 seats, central T cyclic, collective on the left, pedals, low console between the seats */
      const fl = 0.6,
        fab = CM('#2f3136', { roughness: 0.9 })
      GH.liner(c, ST, -0.3, 1.0, fl, MT.carpet, { h: 0.03, maxW: 0.98 })
      ;[0.26, -0.26].forEach(function (z) {
        kit.seat(c, 0.05, fl, z, { w: 0.44, h: 0.34, back: 0.6, lean: 0.12, mat: fab })
        EA.pedals(c, 1.15, fl, z)
      })
      c.roundBox(0.35, 0.5, 0.24, 0.05, CM('#232427'), 0.95, fl + 0.28, 0, { rot: [0, 0, 0.35] })
      ;[-0.06, 0.06].forEach(function (z) {
        c.cylinder(0.035, 0.035, 0.01, MT.gauge, 1.04, fl + 0.55, z, 'x', { seg: 14 }).rotation.set(0, 0, -PI / 2 + 0.6)
      })
      c.rod(new V3(0.6, fl, 0), new V3(0.5, fl + 0.55, 0), 0.02, blk)
      c.rod(new V3(0.5, fl + 0.55, -0.26), new V3(0.5, fl + 0.55, 0.26), 0.014, blk)
      ;[0.26, -0.26].forEach(function (z) {
        c.roundBox(0.05, 0.05, 0.05, 0.02, blk, 0.48, fl + 0.57, z)
      })
      EA.collective(c, 0.2, fl, -0.48)
      GH.liner(c, ST, -0.4, 0.7, 1.68, MT.headliner, { maxW: 1.0 })
      /* mast fairing, thin mast, plates and teetering hub */
      const cow = c.roundBox(1.15, 0.5, 0.56, 0.17, blue, -0.42, 1.9, 0, { taper: { sx: 0.32, sz: 0.4, shift: 0.42 }, def: true })
      c.cylinder(0.055, 0.065, 0.6, MT.steel, 0, 2.3, 0)
      c.cylinder(0.15, 0.13, 0.05, MT.steel, 0, 2.08, 0)
      c.cylinder(0.12, 0.11, 0.04, MT.chrome, 0, 2.15, 0)
      ;[0, 1].forEach(function (i) {
        const a = i * PI
        c.rod(
          new V3(Math.cos(a) * 0.12, 2.15, Math.sin(a) * 0.12),
          new V3(Math.cos(a + 0.3) * 0.14, 2.52, Math.sin(a + 0.3) * 0.14),
          0.01,
          MT.steel,
        )
      })
      const mr = EA.mainRotor(c, 0, 2.62, 0, {
        blades: 2,
        R: 3.835,
        chord: 0.18,
        droop: 0.08,
        hub: 0.2,
        v: 3.6,
        tipCol: '#e6e4dd',
        phase: 0.3,
      })
      c.roundBox(0.22, 0.1, 0.1, 0.035, MT.steel, 0, 2.66, 0)
      /* exposed engine: block, opposed cylinders, snail fan, exhaust and muffler, truss */
      const eng = CM('#5a5d60', { roughness: 0.5, metalness: 0.45 }),
        engObjs = []
      engObjs.push(c.roundBox(0.42, 0.28, 0.36, 0.06, eng, -1.05, 1.1, 0))
      ;[1, -1].forEach(function (s) {
        ;[-0.95, -1.15].forEach(function (x) {
          engObjs.push(c.cylinder(0.07, 0.07, 0.18, eng, x, 1.08, s * 0.27, 'z', { seg: 12 }))
          for (let k = 0; k < 3; k++) engObjs.push(c.cylinder(0.085, 0.085, 0.01, eng, x, 1.08, s * (0.22 + k * 0.05), 'z', { seg: 12 }))
        })
      })
      engObjs.push(c.cylinder(0.24, 0.24, 0.14, CM('#2d2f31', { roughness: 0.6 }), -0.82, 1.18, 0, 'x', { seg: 22 }))
      engObjs.push(
        c.tube(
          [
            [-1.2, 0.98, 0.18],
            [-1.3, 0.85, 0.2],
            [-1.55, 0.86, 0.15],
          ],
          0.025,
          MT.steel,
          { seg: 12 },
        ),
        c.cylinder(0.06, 0.06, 0.3, MT.steel, -1.65, 0.86, 0.15, 'x'),
      )
      ;[
        [-0.78, 0.7, 0.3],
        [-0.78, 0.7, -0.3],
        [-0.78, 1.6, 0.2],
        [-0.78, 1.6, -0.2],
      ].forEach(function (q) {
        engObjs.push(c.rod(new V3(q[0], q[1], q[2]), new V3(-1.35, 1.32, q[2] * 0.3), 0.014, MT.steel))
      })
      /* thin tail cone, upper and lower fins, stabilizer, tail rotor on the left */
      const bm = boom(
        c,
        EA,
        [
          [-1.15, 1.32, 0.11, 0.11],
          [-2.5, 1.37, 0.085, 0.085],
          [-4.25, 1.44, 0.05, 0.05],
          [-4.42, 1.45, 0.035, 0.035],
        ],
        blue,
      )
      const tm = c.paint(col)
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-3.9, 1.44, 0], c: 0.3, t: 0.1 },
              { p: [-3.95, 1.44, s * 0.42], c: 0.22, t: 0.09 },
            ],
            { up: 'y', n: 8 },
          ),
          tm,
        )
        c.deform.push(hs)
      })
      const fu = c.add(
        EA.foilGeo(
          [
            { p: [-4.12, 1.47, 0], c: 0.4, t: 0.11 },
            { p: [-4.42, 1.98, 0], c: 0.24, t: 0.09 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(fu)
      const fd = c.add(
        EA.foilGeo(
          [
            { p: [-4.18, 1.42, 0], c: 0.32, t: 0.11 },
            { p: [-4.35, 0.98, 0], c: 0.22, t: 0.09 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(fd)
      c.tube(
        [
          [-4.2, 1.0, 0],
          [-4.3, 0.92, 0],
          [-4.48, 0.95, 0],
        ],
        0.014,
        MT.steel,
        { seg: 10 },
      )
      c.cylinder(0.05, 0.05, 0.12, MT.steel, -4.38, 1.5, -0.06, 'z')
      const tr = EA.tailRotor(c, -4.38, 1.5, -0.14, {
        blades: 2,
        R: 0.535,
        chord: 0.09,
        mat: CM('#e6e4dd', { roughness: 0.5 }),
        tipCol: '#a9241e',
      })
      /* short skids */
      const sk = skids(c, {
        x0: -0.95,
        x1: 1.05,
        z: 0.965,
        cross: [
          [0.55, 0.5, 0.46, 0.05],
          [-0.62, 0.54, 0.48, -0.03],
        ],
        shoes: [-0.5, 0.5],
      })
      /* lights: two landing lights on the nose, navigation on the stabilizer, anti-collision on the cone and white on the tail */
      EA.lamp(c, 1.52, 0.72, 0.1, 0.045, trl('labels.right_landing_light'))
      EA.lamp(c, 1.52, 0.72, -0.1, 0.045, trl('labels.left_landing_light'))
      EA.navLight(c, -3.96, 1.44, 0.44, 'green', trl('labels.right_navigation_light_green'), { r: 0.028 })
      EA.navLight(c, -3.96, 1.44, -0.44, 'red', trl('labels.left_navigation_light_red'), { r: 0.028 })
      EA.navLight(c, -4.46, 1.96, 0, 'white', trl('labels.tail_light'), { r: 0.025 })
      EA.navLight(c, -1.3, 1.45, 0, 'red', trl('labels.anti_collision_light'), { r: 0.035 })
      c.part('rotor', trl('labels.main_rotor'), mr, new V3(0, 2.62, 0), 1.3)
      c.part('tail_rotor', trl('labels.tail_rotor'), tr, new V3(-4.38, 1.5, -0.14), 0.7)
      c.part('engine', trl('labels.lycoming_o_360_engine_exposed'), null, new V3(-1.05, 1.1, 0), 0.7)
      c.part('fuel_tank', trl('labels.tanks_main_and_auxiliary'), null, new V3(-0.55, 1.7, 0), 0.7)
      c.part('landing_gear', trl('labels.skids'), null, new V3(0, 0.1, 0.965), 0.9)
      Object.assign(c.meta, {
        kind: 'heli',
        length: 8.76,
        width: 2.0,
        fuselageWidth: 1.12,
        front: 1.62,
        rear: -4.95,
        clearance: 0.48,
        belt: 1.0,
        bodyHeight: 1.25,
        top: 2.67,
        fuselageTop: 1.74,
        roof: null,
      })
      c.zone('nose', trl('labels.windshield_bubble_and_nose'), [0.62, 1.8, 0.4, 1.85, -0.65, 0.65])
      c.zone('cab', trl('labels.cabin_and_doors'), [-0.8, 0.62, 0.4, 1.85, -0.7, 0.7], null, {
        dir: 'left',
        fxKey: 'cab',
        who: trl('who.the_pilot_and_the_student'),
        anyMesh: true,
      })
      c.zone('engine', trl('labels.exposed_engine_and_transmission'), [-1.75, -0.6, 0.6, 2.15, -0.45, 0.45], engObjs.concat([cow]), {
        type: 'part',
        fxKey: 'engine',
        sub: 'engine',
        dir: 'left',
        pos: new V3(-1.05, 1.1, 0),
        anchor: [-0.75, 1.3, 0],
      })
      c.zone('tail_cone', trl('labels.tail_cone'), [-3.85, -1.1, 1.15, 1.6, -0.25, 0.25], [bm], {
        dir: 'up',
        fxKey: 'tail_cone',
        cutAll: true,
        anyMesh: true,
      })
      c.zone('empennage', trl('labels.fins_and_stabilizer'), [-4.55, -3.85, 0.85, 2.05, -0.5, 0.5], null, {
        type: 'part',
        fxKey: 'tail',
        dir: 'front',
        anyMesh: true,
      })
      c.zone('skids', null, null, sk)
      c.zone('headlight_center', trl('labels.landing_lights'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_lights'))
      c.meta.armor = function (c2: any) {
        /* modified lookout: emergency floats on the skids, spotlight under the nose, jerry can on the skid and a grille on the bubble */
        const f2 = CM('#d8d4c8', { roughness: 0.7 })
        ;[1, -1].forEach(function (s) {
          c2.cylinder(0.11, 0.11, 1.7, f2, 0.05, 0.17, s * 0.965, 'x', { seg: 16 })
          c2.sphere(0.11, f2, 0.9, 0.17, s * 0.965, 1.6, 1, 1)
          c2.sphere(0.11, f2, -0.8, 0.17, s * 0.965, 1.2, 1, 1)
        })
        c2.cylinder(0.09, 0.07, 0.14, MT.steel, 1.35, 0.52, 0, 'x')
        EA.lamp(c2, 1.44, 0.52, 0.0001, 0.07, trl('labels.search_spotlight'))
        kit.jerryCan(c2, -0.2, 0.42, 0.97, '#8e2a20')
        for (let k = -0.36; k <= 0.37; k += 0.12) c2.rod(new V3(0.72, 1.68, k), new V3(1.56, 0.86, k * 0.3), 0.006, kit.steelMaterial)
        c2.part('cargo', trl('labels.jerry_can_on_the_skid'), null, new V3(-0.2, 0.45, 0.97), 0.5)
      }
    },
  )

  /* ================= Light turbine helicopter (206 type) ================= */
  /* Reference · Bell 206B-3 JetRanger III - WebFetch (Golden Age Air Museum: length 39 ft 8 in, height 9 ft 4 in, rotor 33 ft 4 in), the rest from memory
     Real measurements: overall length with rotors 12.09 m · fuselage about 9.5 m (from memory) · main rotor 10.16 m (2 blades) · tail rotor 1.65 m ·
     height 2.84 m · cabin width about 1.28 m · skid track about 1.92 m (from memory) · Allison 250-C20J turbine · tank 344 L.
     Signature traits:
     front: two-piece windshield with a central pillar and chin windows below, short rounded nose, tall skids with a step
     side: five-seat cabin with a large front door and a rear door with a cut-out window, "little house" engine cowling on
     the roof with side grilles and a curved exhaust pointing up and back, long tapering tail cone
     rear: horizontal stabilizer mid-cone with vertical end plates, upper and lower fin with a tail skid,
     two-blade tail rotor on the left
     top: wide-blade two-blade rotor with a teetering hub, long narrow cowling, thin tail cone */
  fx.register(
    {
      key: 'turbine_helicopter',
      group: 'air',
      name: trl('vehicles.turbine_helicopter.name'),
      inspired: trl('vehicles.turbine_helicopter.inspired'),
      category: trl('vehicles.turbine_helicopter.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.turbine_helicopter.description'),
      mass: 1451,
      noise: 450,
      seats: trl('vehicles.turbine_helicopter.seats'),
      capacity: trl('vehicles.turbine_helicopter.capacity'),
      efficiency: trl('vehicles.turbine_helicopter.efficiency'),
      range: trl('vehicles.turbine_helicopter.range'),
      maxSpeed: 225,
      skill: trl('vehicles.turbine_helicopter.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        wcol = '#eeece6',
        white = c.paint(wcol),
        mar = c.paint('#7a1e22'),
        gold = c.paint('#c49a3a'),
        blk = CM('#1c1d1f', { roughness: 0.6 })
      const ST = [
        [2.62, 0.95, 1.06, 0.08, 2],
        [2.48, 0.7, 1.45, 0.86, 2.2],
        [2.14, 0.6, 1.82, 1.18, 2.4],
        [1.55, 0.58, 2.02, 1.27, 2.6],
        [0.5, 0.58, 2.06, 1.28, 2.8],
        [-0.6, 0.6, 2.05, 1.24, 2.8],
        [-1.25, 0.74, 2.0, 1.02, 2.6],
        [-1.65, 1.02, 1.96, 0.64, 2.3],
        [-1.85, 1.3, 1.9, 0.3, 2],
      ]
      const wsF = function (x: any, y: any, z: any) {
        return Math.min(x - 1.3 - 0.4 * (y - 1.2), y - 1.12, 0.46 - Math.abs(z || 0) + (x - 1.62) * 1.6)
      }
      const chin = function (x: any, y: any) {
        return Math.min(x - 1.95, 1.05 - y, y - 0.72)
      }
      const fdP = [
          [1.5, 1.02],
          [0.72, 1.02],
          [0.72, 1.92],
          [1.25, 1.96],
          [1.56, 1.6],
        ],
        rdP = [
          [0.58, 1.12],
          [-0.38, 1.18],
          [-0.38, 1.86],
          [0.05, 1.93],
          [0.58, 1.9],
        ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 32 }), white)
      kit.cutMesh(
        fus,
        [
          {
            sdf: function (x: any, y: any, z: any) {
              return -wsF(x, y, z)
            },
          },
          {
            sel: function (n: any) {
              return n.x > 0.2
            },
            sdf: function (x: any, y: any, z: any) {
              return -Math.min(chin(x, y), Math.abs(z) - 0.05)
            },
          },
          EA.sideCutP(fdP, 0.45),
          EA.sideCutP(rdP, 0.45),
        ],
        40,
      )
      c.deform.push(fus)
      /* stripes: wide burgundy with a gold thread, from the cabin to the cone */
      const yc = function (x: any) {
        return x > -1.0 ? 1.0 : 1.0 + (-1.0 - x) * 0.1
      }
      GH.fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.08 - Math.abs(y - yc(x)), -wsF(x, y, z) - 0.02, -chin(x, y) - 0.02)
        }),
        mar,
        { sub: 0.06, pre: EA.keepT([-1.9, 2.6, 0.85, 1.15]) },
      )
      GH.fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.016 - Math.abs(y - yc(x) - 0.12), -wsF(x, y, z) - 0.02)
        }),
        gold,
        { k: 1.005, sub: 0.04, pre: EA.keepT([-1.9, 2.6, 1.05, 1.2]) },
      )
      EA.fuseGlass(c, ST, { sdf: wsF }, lbl('windshield'), 'laminated', { pos: new V3(2.1, 1.6, 0) })
      EA.fuseGlass(
        c,
        ST,
        {
          sdf: function (x: any, y: any, z: any) {
            return Math.min(chin(x, y), Math.abs(z) - 0.05)
          },
        },
        lbl('chin_windows'),
        'tempered',
        { pos: new V3(2.3, 0.88, 0) },
      )
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(
          c,
          ST,
          EA.sideKeepP(fdP, 0.45, s),
          s > 0 ? lbl('front_right_door_window') : lbl('front_left_door_window'),
          'tempered',
          { pos: new V3(1.1, 1.55, s * 0.62) },
        )
        EA.fuseGlass(c, ST, EA.sideKeepP(rdP, 0.45, s), s > 0 ? lbl('rear_right_door_window') : lbl('rear_left_door_window'), 'tempered', {
          pos: new V3(0.1, 1.55, s * 0.62),
        })
        const df = EA.polySdf([
            [1.72, 0.66],
            [0.66, 0.64],
            [0.66, 1.95],
            [1.32, 2.0],
            [1.76, 1.55],
          ]),
          dr = EA.polySdf([
            [0.6, 0.64],
            [-0.4, 0.66],
            [-0.4, 1.95],
            [0.6, 1.95],
          ])
        GH.fSkin(
          c,
          EA,
          ST,
          EA.bandT(function (x: any, y: any, z: any) {
            return Math.min(0.006 - Math.min(Math.abs(df(x, y)), Math.abs(dr(x, y))), s * z - 0.45)
          }),
          MT.dark,
          { k: 1.003, sub: 0.04, pre: EA.keepT([-0.5, 1.85, 0.55, 2.05, 0.4]) },
        )
        c.roundBox(0.1, 0.02, 0.03, 0.01, MT.chrome, 0.78, 1.15, s * 0.64)
        c.roundBox(0.1, 0.02, 0.03, 0.01, MT.chrome, -0.28, 1.15, s * 0.63)
        c.text('PT-HJR', 0.85, 0.18, -3.4, 1.62, s * 0.165, s > 0 ? '+z' : '-z', { fg: '#7a1e22' })
      })
      c.rod(new V3(1.78, 2.03, 0), new V3(2.42, 1.14, 0), 0.02, blk)
      /* interior: 2 seats at the front, 3-seat bench behind, canopy-mounted panel, cyclic, collective and pedals */
      const fl = 0.68,
        fab = CM('#4b4339', { roughness: 0.9 })
      GH.liner(c, ST, -0.6, 1.8, fl, MT.carpet, { h: 0.03, maxW: 1.15 })
      ;[0.3, -0.3].forEach(function (z) {
        kit.seat(c, 1.05, fl, z, { w: 0.48, h: 0.36, back: 0.64, lean: 0.12, mat: fab })
        EA.cyclic(c, 1.4, fl, z)
        EA.pedals(c, 2.1, fl, z)
      })
      EA.collective(c, 1.1, fl, -0.55)
      kit.seat(c, -0.3, fl + 0.04, 0, { w: 1.14, n: 3, h: 0.38, back: 0.62, lean: 0.1, mat: fab })
      EA.instPanel(c, 1.92, 1.42, 0.95, { gauges: 8, z0: -0.33, tilt: 0.35 })
      GH.liner(c, ST, -0.5, 1.4, 1.98, MT.headliner, { maxW: 1.15 })
      /* "little house" cowling: transmission and turbine, side grilles, exhaust curved upward */
      const cw = c.add(
        EA.fuseGeo(
          [
            [0.75, 1.98, 2.1, 0.36, 2.2],
            [0.45, 1.98, 2.36, 0.68, 2.6],
            [-0.6, 1.98, 2.46, 0.74, 3],
            [-1.75, 1.95, 2.42, 0.7, 3],
            [-2.35, 1.82, 2.18, 0.46, 2.4],
            [-2.55, 1.75, 2.0, 0.2, 2],
          ],
          { smooth: 24 },
        ),
        white,
      )
      c.deform.push(cw)
      ;[1, -1].forEach(function (s) {
        for (let k = 0; k < 6; k++) c.roundBox(0.035, 0.22, 0.02, 0.008, MT.dark, -0.55 - k * 0.075, 2.22, s * 0.372)
        c.roundBox(0.5, 0.28, 0.012, 0.01, CM('#2a2b2d'), -1.3, 2.2, s * 0.352)
      })
      const ex = c.tube(
        [
          [-1.75, 2.42, 0],
          [-1.95, 2.55, 0],
          [-2.12, 2.6, 0],
        ],
        0.1,
        CM('#4d4f51', { metalness: 0.5, roughness: 0.4 }),
        { seg: 12, rs: 14 },
      )
      c.cylinder(0.09, 0.09, 0.02, MT.dark, -2.14, 2.6, 0, 'x')
      c.cylinder(0.07, 0.08, 0.42, MT.steel, 0, 2.6, 0)
      c.cylinder(0.18, 0.15, 0.06, MT.steel, 0, 2.48, 0)
      c.cylinder(0.14, 0.12, 0.05, MT.chrome, 0, 2.55, 0)
      ;[0, 1].forEach(function (i) {
        const a = i * PI + 0.3
        c.rod(new V3(Math.cos(a) * 0.14, 2.55, Math.sin(a) * 0.14), new V3(Math.cos(a) * 0.2, 2.74, Math.sin(a) * 0.2), 0.012, MT.steel)
      })
      const mr = EA.mainRotor(c, 0, 2.78, 0, {
        blades: 2,
        R: 5.08,
        chord: 0.33,
        droop: 0.1,
        hub: 0.32,
        v: 3.2,
        mat: CM('#2a2c30', { roughness: 0.5 }),
        tipCol: '#e6e4dd',
        phase: 0.25,
      })
      c.roundBox(0.5, 0.12, 0.16, 0.05, MT.steel, 0, 2.8, 0)
      /* long tail cone, stabilizer with end plates, fins, skid and tail rotor on the left */
      const bm = boom(
        c,
        EA,
        [
          [-1.75, 1.62, 0.3, 0.3],
          [-2.4, 1.64, 0.2, 0.2],
          [-4.5, 1.7, 0.13, 0.13],
          [-6.2, 1.76, 0.085, 0.085],
          [-6.45, 1.77, 0.07, 0.07],
        ],
        white,
      )
      GH.fSkin(
        c,
        EA,
        [
          [-1.75, 1.32, 1.92, 0.6, 2],
          [-2.4, 1.44, 1.84, 0.4, 2],
          [-4.5, 1.57, 1.83, 0.26, 2],
          [-6.2, 1.675, 1.845, 0.17, 2],
          [-6.45, 1.7, 1.84, 0.14, 2],
        ],
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.05 - Math.abs(y - 1.7 - (x + 2) * -0.01), x + 6.2)
        }),
        mar,
        { k: 1.01, sub: 0.05, smooth: 24, seg: 22 },
      )
      const tm = c.paint(wcol)
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-4.05, 1.68, 0], c: 0.42, t: 0.12, cam: -0.04 },
              { p: [-4.1, 1.68, s * 0.99], c: 0.38, t: 0.11, cam: -0.04 },
            ],
            { up: 'y', n: 8 },
          ),
          tm,
        )
        c.deform.push(hs)
        const ep = c.add(
          EA.foilGeo(
            [
              { p: [-4.08, 1.58, s * 1.0], c: 0.36, t: 0.07 },
              { p: [-4.18, 1.86, s * 1.0], c: 0.26, t: 0.07 },
            ],
            { up: 'z', n: 6 },
          ),
          mar,
        )
        c.deform.push(ep)
      })
      const fu = c.add(
        EA.foilGeo(
          [
            { p: [-6.0, 1.82, 0], c: 0.72, t: 0.12 },
            { p: [-6.55, 2.62, 0], c: 0.42, t: 0.1 },
          ],
          { up: 'z', n: 8 },
        ),
        mar,
      )
      c.deform.push(fu)
      const fd = c.add(
        EA.foilGeo(
          [
            { p: [-6.1, 1.72, 0], c: 0.55, t: 0.12 },
            { p: [-6.35, 1.2, 0], c: 0.35, t: 0.1 },
          ],
          { up: 'z', n: 8 },
        ),
        mar,
      )
      c.deform.push(fd)
      c.tube(
        [
          [-6.35, 1.22, 0],
          [-6.55, 1.12, 0],
          [-6.78, 1.18, 0],
        ],
        0.018,
        MT.steel,
        { seg: 10 },
      )
      c.cylinder(0.07, 0.07, 0.16, MT.steel, -6.25, 1.82, -0.1, 'z')
      const tr = EA.tailRotor(c, -6.25, 1.82, -0.2, {
        blades: 2,
        R: 0.825,
        chord: 0.13,
        mat: CM('#e6e4dd', { roughness: 0.5 }),
        tipCol: '#7a1e22',
      })
      /* tall skids with a step */
      const sk = skids(c, {
        x0: -1.15,
        x1: 1.65,
        z: 0.96,
        cross: [
          [1.05, 0.6, 0.6, 0.05],
          [-0.65, 0.62, 0.6, -0.03],
        ],
        shoes: [-0.7, 1.0],
        step: [0.4, 0.35],
      })
      /* lights */
      EA.lamp(c, 2.5, 0.68, 0.12, 0.05, trl('labels.right_landing_light'), { yaw: 0.05 })
      EA.lamp(c, 2.5, 0.68, -0.12, 0.05, trl('labels.left_landing_light'), { yaw: 0.05 })
      EA.navLight(c, -4.1, 1.68, 1.03, 'green', trl('labels.right_navigation_light_green'), { r: 0.03 })
      EA.navLight(c, -4.1, 1.68, -1.03, 'red', trl('labels.left_navigation_light_red'), { r: 0.03 })
      EA.navLight(c, -6.62, 2.6, 0, 'white', trl('labels.tail_light'), { r: 0.025 })
      EA.navLight(c, -1.9, 2.25, 0, 'red', trl('labels.anti_collision_light'), { r: 0.04 })
      c.part('rotor', trl('labels.main_rotor'), mr, new V3(0, 2.78, 0), 1.6)
      c.part('tail_rotor', trl('labels.tail_rotor'), tr, new V3(-6.25, 1.82, -0.2), 0.9)
      c.part('engine', trl('labels.allison_250_turbine'), ex, new V3(-1.4, 2.25, 0), 0.9)
      c.part('fuel_tank', trl('labels.jet_a_1_tank_under_the_rear_seat'), null, new V3(-0.6, 0.9, 0), 0.8)
      c.part('landing_gear', trl('labels.skids'), null, new V3(0, 0.1, 0.96), 1.0)
      Object.assign(c.meta, {
        kind: 'heli',
        length: 12.09,
        width: 2.2,
        fuselageWidth: 1.28,
        front: 2.64,
        rear: -7.08,
        clearance: 0.58,
        belt: 1.15,
        bodyHeight: 1.48,
        top: 2.84,
        fuselageTop: 2.06,
        roof: null,
      })
      c.zone('nose', trl('labels.windshield_chin_windows_and_nose'), [1.65, 2.8, 0.5, 2.15, -0.75, 0.75])
      c.zone('cab', trl('labels.cabin_and_doors'), [-1.1, 1.65, 0.5, 2.15, -0.8, 0.8], null, {
        dir: 'left',
        fxKey: 'cab',
        who: trl('who.the_occupants'),
        anyMesh: true,
      })
      c.zone('engine', trl('labels.turbine_cowling_and_transmission'), [-2.6, 1.0, 1.95, 2.7, -0.5, 0.5], null, {
        type: 'internal',
        fxKey: 'engine',
        sub: 'engine',
        pos: new V3(-1.4, 2.25, 0),
      })
      c.zone('tail_cone', trl('labels.tail_cone'), [-5.9, -1.75, 1.3, 2.0, -1.15, 1.15], [bm], {
        dir: 'up',
        fxKey: 'tail_cone',
        cutAll: true,
        anyMesh: true,
      })
      c.zone('empennage', trl('labels.fins_and_skid'), [-6.9, -5.9, 1.0, 2.75, -0.4, 0.4], null, {
        type: 'part',
        fxKey: 'tail',
        dir: 'front',
        anyMesh: true,
      })
      c.zone('skids', null, null, sk)
      c.zone('headlight_center', trl('labels.landing_lights'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_lights'))
      c.meta.armor = function (c2: any) {
        /* modified news helicopter turned patrol: gyro-stabilized camera on the nose, spotlight, loudspeaker,
         emergency floats and wire cutters above and below the cabin */
        const stl = kit.steelMaterial,
          f2 = CM('#d8d4c8', { roughness: 0.7 })
        c2.sphere(0.17, CM('#2b2c2e', { roughness: 0.4 }), 2.3, 0.5, -0.22)
        c2.cylinder(0.07, 0.07, 0.02, MT.glassDark, 2.46, 0.5, -0.22, 'x')
        c2.cylinder(0.12, 0.1, 0.2, MT.steel, 1.9, 0.45, 0.4, 'x')
        EA.lamp(c2, 2.02, 0.45, 0.4, 0.1, trl('labels.search_spotlight'))
        c2.cylinder(0.08, 0.14, 0.2, CM('#3a3c3e'), 1.4, 0.45, -0.55, 'x')
        ;[1, -1].forEach(function (s) {
          c2.cylinder(0.12, 0.12, 2.1, f2, 0.25, 0.18, s * 0.96, 'x', { seg: 16 })
          c2.sphere(0.12, f2, 1.3, 0.18, s * 0.96, 1.6, 1, 1)
        })
        c2.roundBox(0.5, 0.25, 0.03, 0.01, stl, 2.15, 2.0, 0, { rot: [0, 0, -0.6] })
        c2.roundBox(0.45, 0.2, 0.03, 0.01, stl, 2.45, 0.55, 0, { rot: [0, 0, 0.6] })
        c2.part('camera', trl('labels.gyro_stabilized_camera'), null, new V3(2.3, 0.5, -0.22), 0.4)
      }
    },
  )

  /* ================= Police helicopter (H145 type) ================= */
  /* Reference · Airbus H145 (D3, police version) - WebFetch (airbus.com "H145 technical information": length 13.54 m with rotors, rotor 10.8 m),
     the rest from memory
     Real measurements: overall length with rotors 13.54 m · main rotor 10.8 m (5 blades, hingeless) · height about 3.95 m (from memory) ·
     fuselage about 11.6 m and cabin width about 1.73 m (from memory) · fenestron about 1.0 m · skid track about 2.4 m (from memory) ·
     two Arriel 2E engines · tank 723 kg (about 905 L).
     Signature traits:
     front: huge tall windshield with chin windows, short blunt nose, thermal imager ball under the nose, tall skids
     side: long tall cabin with a large sliding door, clamshell doors behind the cabin (the tail leaves from the top of the fuselage),
     long twin-engine cowling over the roof with two exhausts, spotlight and hoist on the right side
     rear: fenestron (shrouded tail rotor in the fin), stabilizer with inclined end plates, clamshell rear doors
     top: five-blade rotor, wide engine cowling, thin tall tail cone */
  fx.register(
    {
      key: 'police_helicopter',
      group: 'air',
      name: trl('vehicles.police_helicopter.name'),
      inspired: trl('vehicles.police_helicopter.inspired'),
      category: trl('vehicles.police_helicopter.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.police_helicopter.description'),
      mass: 3800,
      noise: 600,
      seats: trl('vehicles.police_helicopter.seats'),
      capacity: trl('vehicles.police_helicopter.capacity'),
      efficiency: trl('vehicles.police_helicopter.efficiency'),
      range: trl('vehicles.police_helicopter.range'),
      maxSpeed: 268,
      skill: trl('vehicles.police_helicopter.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        navyC = '#1b2c52',
        navy = c.paint(navyC),
        white = c.paint('#ecebe6'),
        yel = c.paint('#d7b23a'),
        blk = CM('#1c1d1f', { roughness: 0.6 })
      const ST = [
        [3.36, 1.0, 1.12, 0.08, 2],
        [3.22, 0.76, 1.56, 0.96, 2.4],
        [2.85, 0.63, 2.0, 1.46, 2.8],
        [2.2, 0.58, 2.3, 1.68, 3.2],
        [1.2, 0.58, 2.38, 1.73, 3.4],
        [-1.6, 0.58, 2.38, 1.73, 3.4],
        [-2.55, 0.62, 2.35, 1.7, 3.4],
        [-2.95, 0.72, 2.32, 1.56, 3.2],
        [-3.12, 0.95, 2.3, 1.1, 2.6],
        [-3.2, 1.3, 2.28, 0.4, 2],
      ]
      const wsF = function (x: any, y: any, z: any) {
        return Math.min(x - 1.85 - 0.42 * (y - 1.2), y - 1.22, 0.62 - Math.abs(z || 0) + (x - 2.2) * 1.4)
      }
      const chin = function (x: any, y: any) {
        return Math.min(x - 2.75, 1.15 - y, y - 0.78)
      }
      const fdP = [
          [1.95, 1.3],
          [1.15, 1.3],
          [1.15, 2.2],
          [1.7, 2.24],
          [2.0, 1.75],
        ],
        sdP = [
          [0.95, 1.35],
          [-0.95, 1.35],
          [-0.95, 2.12],
          [0.95, 2.12],
        ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 36 }), white)
      kit.cutMesh(
        fus,
        [
          {
            sdf: function (x: any, y: any, z: any) {
              return -wsF(x, y, z)
            },
          },
          {
            sel: function (n: any) {
              return n.x > 0.2
            },
            sdf: function (x: any, y: any, z: any) {
              return -Math.min(chin(x, y), Math.abs(z) - 0.06)
            },
          },
          EA.sideCutP(fdP, 0.6),
          EA.sideCutP(sdP, 0.6),
        ],
        40,
      )
      c.deform.push(fus)
      /* blue lower half with a yellow and blue checkered band (generic) */
      GH.fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(1.22 - y, -wsF(x, y, z) - 0.02, -chin(x, y) - 0.02)
        }),
        navy,
        { sub: 0.08, pre: EA.keepT([-3.3, 3.4, 0.5, 1.3]) },
      )
      GH.fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          const ch = (Math.floor((x + 9) / 0.14) + Math.floor((y + 9) / 0.07)) % 2
          return Math.min(0.07 - Math.abs(y - 1.3), ch ? 1 : -1, -wsF(x, y, z) - 0.02, x + 3.0, 2.1 - x)
        }),
        yel,
        { k: 1.005, sub: 0.035, pre: EA.keepT([-3.1, 2.2, 1.2, 1.4, 0.5]) },
      )
      EA.fuseGlass(c, ST, { sdf: wsF }, lbl('windshield'), 'laminated', { pos: new V3(2.8, 1.9, 0) })
      EA.fuseGlass(
        c,
        ST,
        {
          sdf: function (x: any, y: any, z: any) {
            return Math.min(chin(x, y), Math.abs(z) - 0.06)
          },
        },
        lbl('chin_windows'),
        'tempered',
        { pos: new V3(3.05, 0.95, 0) },
      )
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(c, ST, EA.sideKeepP(fdP, 0.6, s), s > 0 ? lbl('co_pilot_door_window') : lbl('pilot_door_window'), 'tempered', {
          pos: new V3(1.7, 1.8, s * 0.86),
        })
        GH.fGlass(
          c,
          EA,
          ST,
          EA.sideKeepP(sdP, 0.6, s),
          s > 0 ? lbl('right_sliding_door_window') : lbl('left_sliding_door_window'),
          'tempered',
          { pos: new V3(0.0, 1.8, s * 0.86), sub: 0.12, pre: EA.keepT([-1.1, 1.1, 1.2, 2.3, 0.5]) },
        )
        const df = EA.polySdf([
            [2.05, 0.68],
            [1.1, 0.66],
            [1.1, 2.26],
            [1.75, 2.3],
            [2.06, 1.78],
          ]),
          dr = EA.polySdf([
            [1.0, 0.66],
            [-1.05, 0.66],
            [-1.05, 2.25],
            [1.0, 2.25],
          ])
        GH.fSkin(
          c,
          EA,
          ST,
          EA.bandT(function (x: any, y: any, z: any) {
            return Math.min(0.007 - Math.min(Math.abs(df(x, y)), Math.abs(dr(x, y))), s * z - 0.6)
          }),
          MT.dark,
          { k: 1.003, sub: 0.05, pre: EA.keepT([-1.2, 2.4, 0.55, 2.35, 0.55]) },
        )
        c.roundBox(1.9, 0.04, 0.04, 0.015, MT.steel, -0.1, 2.3, s * 0.87)
        c.text(trl('texts.police'), 1.5, 0.3, -1.95, 1.75, s * 0.866, s > 0 ? '+z' : '-z', { fg: '#1b2c52' })
        c.text(trl('texts.eagle_7'), 0.9, 0.2, -4.2, 2.2, s * 0.14, s > 0 ? '+z' : '-z', { fg: '#f2efe6' })
      })
      /* clamshell rear doors (vertical gap) and windshield pillar */
      GH.fSkin(
        c,
        EA,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.007 - Math.abs(z), x + 3.25, -2.8 - x, 2.2 - y)
        }),
        MT.dark,
        { k: 1.003, sub: 0.04, pre: EA.keepT([-3.3, -2.7, 0.6, 2.3]) },
      )
      c.tube(
        [
          [2.55, 2.32, 0],
          [2.95, 1.98, 0],
          [3.2, 1.55, 0],
          [3.3, 1.2, 0],
        ],
        0.022,
        blk,
        { seg: 20 },
      )
      /* interior: 2 pilot seats, panel with 4 screens, crew seats facing sideways, imager operator */
      const fl = 0.7,
        fab = CM('#2c3540', { roughness: 0.9 })
      GH.liner(c, ST, -2.9, 2.5, fl, MT.carpet, { h: 0.03, maxW: 1.5 })
      ;[0.42, -0.42].forEach(function (z) {
        kit.seat(c, 1.55, fl, z, { w: 0.5, h: 0.4, back: 0.7, lean: 0.12, mat: fab })
        EA.cyclic(c, 1.95, fl, z)
        EA.pedals(c, 2.75, fl, z)
      })
      EA.collective(c, 1.6, fl, -0.72)
      EA.collective(c, 1.6, fl, 0.12)
      EA.instPanel(c, 2.5, 1.62, 1.3, {
        gauges: 2,
        z0: -0.05,
        tilt: 0.3,
        screens: [
          [0.05, -0.48, 0.18, 0.24],
          [0.05, -0.18, 0.18, 0.24],
          [0.05, 0.18, 0.18, 0.24],
          [0.05, 0.48, 0.18, 0.24],
        ],
      })
      ;[
        [0.3, '-z'],
        [-0.4, '-z'],
        [0.3, '+z'],
        [-0.4, '+z'],
      ].forEach(function (q) {
        kit.seat(c, q[0], fl, q[1] === '-z' ? 0.55 : -0.55, { w: 0.48, h: 0.4, back: 0.6, lean: 0.1, face: q[1], mat: fab })
      })
      kit.seat(c, -1.6, fl, 0.3, { w: 0.5, h: 0.4, back: 0.62, lean: 0.1, dir: 1, mat: fab })
      kit.seat(c, -1.6, fl, -0.3, { w: 0.5, h: 0.4, back: 0.62, lean: 0.1, dir: 1, mat: fab })
      c.roundBox(0.3, 0.25, 0.3, 0.03, MT.plastic, -1.0, fl + 0.6, -0.3)
      c.roundBox(0.02, 0.2, 0.28, 0.01, MT.screen, -0.85, fl + 0.75, -0.3).castShadow = false
      GH.liner(c, ST, -2.5, 2.1, 2.28, MT.headliner, { maxW: 1.5 })
      /* engine cowling, two exhausts, mast and 5-blade head */
      const cw = c.add(
        EA.fuseGeo(
          [
            [1.6, 2.3, 2.42, 0.6, 2.4],
            [1.1, 2.3, 2.8, 1.25, 2.8],
            [-1.0, 2.3, 2.95, 1.4, 3.2],
            [-2.6, 2.3, 2.9, 1.32, 3],
            [-3.2, 2.32, 2.7, 0.8, 2.4],
            [-3.5, 2.34, 2.5, 0.3, 2],
          ],
          { smooth: 28 },
        ),
        white,
      )
      c.deform.push(cw)
      GH.fSkin(
        c,
        EA,
        [
          [1.6, 2.3, 2.42, 0.6, 2.4],
          [1.1, 2.3, 2.8, 1.25, 2.8],
          [-1.0, 2.3, 2.95, 1.4, 3.2],
          [-2.6, 2.3, 2.9, 1.32, 3],
          [-3.2, 2.32, 2.7, 0.8, 2.4],
          [-3.5, 2.34, 2.5, 0.3, 2],
        ],
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.04 - Math.abs(y - 2.5), x + 3.0, 1.3 - x)
        }),
        navy,
        { k: 1.01, sub: 0.05, smooth: 28 },
      )
      ;[1, -1].forEach(function (s) {
        for (let k = 0; k < 6; k++) c.roundBox(0.04, 0.22, 0.02, 0.008, MT.dark, 0.3 - k * 0.09, 2.62, s * 0.7)
        const e = c.cylinder(0.13, 0.15, 0.4, MT.steel, -2.75, 2.75, s * 0.42, 'x', { seg: 16 })
        e.rotation.y = -s * 0.35
        e.rotation.x = s * 0.3
        c.cylinder(0.11, 0.11, 0.02, MT.dark, -2.95, 2.8, s * 0.5, 'x').rotation.y = -s * 0.35
      })
      c.cylinder(0.11, 0.13, 0.55, MT.steel, 0, 3.2, 0)
      c.cylinder(0.32, 0.26, 0.12, MT.steel, 0, 3.55, 0, null, { seg: 5 })
      const mr = EA.mainRotor(c, 0, 3.66, 0, {
        blades: 5,
        R: 5.4,
        chord: 0.3,
        droop: 0.14,
        hub: 0.32,
        hubR: 0.2,
        cap: true,
        v: 2.8,
        mat: CM('#2a2c30', { roughness: 0.5 }),
        phase: 0.1,
      })
      c.cylinder(0.16, 0.12, 0.2, MT.steel, 0, 3.82, 0)
      /* tail cone leaving from the top, stabilizer with inclined end plates, fenestron and fin */
      const bm = boom(
        c,
        EA,
        [
          [-2.8, 2.0, 0.32, 0.38],
          [-3.5, 2.06, 0.24, 0.26],
          [-5.6, 2.12, 0.17, 0.17],
          [-6.6, 2.15, 0.15, 0.13],
        ],
        navy,
      )
      const tm = c.paint(navyC)
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-5.75, 2.1, 0], c: 0.62, t: 0.12, cam: -0.03 },
              { p: [-5.85, 2.1, s * 1.05], c: 0.52, t: 0.11, cam: -0.03 },
            ],
            { up: 'y', n: 8 },
          ),
          tm,
        )
        c.deform.push(hs)
        const ep = c.add(
          EA.foilGeo(
            [
              { p: [-5.82, 1.85, s * 1.02], c: 0.5, t: 0.07 },
              { p: [-5.98, 2.38, s * 1.14], c: 0.36, t: 0.07 },
            ],
            { up: 'z', n: 6 },
          ),
          tm,
        )
        c.deform.push(ep)
      })
      const finS = [
        [-6.45, 2.0, 2.3, 0.22, 2],
        [-6.7, 1.45, 2.85, 0.3, 2.4],
        [-7.4, 1.3, 2.95, 0.32, 2.6],
        [-7.95, 1.42, 3.05, 0.26, 2.4],
        [-8.14, 1.6, 3.1, 0.1, 2],
      ]
      const fin = c.add(EA.fuseGeo(finS, { smooth: 20, seg: 18 }), tm)
      c.deform.push(fin)
      const fan = fenestron(c, -7.3, 2.12, 0.5, 0.32, 10, CM('#2a2c30', { roughness: 0.6 }), CM('#3a3c40', { roughness: 0.5 }))
      kit.cutMesh(
        fin,
        [
          {
            sdf: function (x: any, y: any, _z: any) {
              return Math.hypot(x + 7.3, y - 2.12) - 0.56
            },
          },
        ],
        40,
        { sub: 0.06 },
      )
      const topFin = c.add(
        EA.foilGeo(
          [
            { p: [-7.35, 2.95, 0], c: 0.75, t: 0.1 },
            { p: [-7.75, 3.4, 0], c: 0.4, t: 0.09 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(topFin)
      /* tall skids with a step */
      const sk = skids(c, {
        x0: -1.6,
        x1: 2.0,
        z: 1.2,
        cross: [
          [1.4, 0.62, 0.78, 0.05],
          [-1.0, 0.62, 0.78, -0.03],
        ],
        shoes: [-1.1, 1.5],
        step: [0.6, 0.5],
      })
      /* police equipment: thermal imager, spotlight, hoist, loudspeaker, blue and red lights */
      const flir = c.sphere(0.2, CM('#2b2c2e', { roughness: 0.4 }), 3.0, 0.48, 0)
      c.cylinder(0.08, 0.08, 0.02, MT.glassDark, 3.18, 0.46, 0.06, 'x')
      c.cylinder(0.05, 0.05, 0.15, MT.steel, 3.0, 0.66, 0)
      c.cylinder(0.14, 0.12, 0.22, MT.steel, 2.35, 0.45, 0.62, 'x')
      const hl = EA.lamp(c, 2.48, 0.45, 0.62, 0.12, trl('labels.search_spotlight'))
      void hl
      c.roundBox(0.14, 0.1, 0.8, 0.04, MT.steel, 0.3, 2.45, 0.9)
      c.rod(new V3(0.3, 2.45, 1.28), new V3(0.3, 2.25, 1.28), 0.035, MT.steel)
      c.cylinder(0.12, 0.12, 0.32, CM('#d8d4c8'), 0.3, 2.1, 1.28)
      c.rod(new V3(0.3, 1.93, 1.28), new V3(0.3, 1.45, 1.28), 0.006, MT.steel)
      c.sphere(0.04, MT.yellow, 0.3, 1.43, 1.28)
      c.cylinder(0.08, 0.14, 0.2, CM('#3a3c3e'), 1.9, 0.45, -0.62, 'x')
      EA.navLight(c, -1.0, 2.42, 0.72, 'blue', trl('labels.blue_beacon'), { r: 0.05 })
      EA.navLight(c, -1.0, 2.42, -0.72, 'red', trl('labels.red_beacon'), { r: 0.05 })
      EA.lamp(c, 3.18, 0.86, -0.25, 0.06, trl('labels.landing_light'))
      EA.navLight(c, -5.85, 2.1, 1.08, 'green', trl('labels.right_navigation_light_green'), { r: 0.035 })
      EA.navLight(c, -5.85, 2.1, -1.08, 'red', trl('labels.left_navigation_light_red'), { r: 0.035 })
      EA.navLight(c, -8.16, 2.5, 0, 'white', trl('labels.tail_light'), { r: 0.03 })
      EA.navLight(c, -3.3, 2.45, 0, 'red', trl('labels.anti_collision_light'), { r: 0.05 })
      c.part('rotor', trl('labels.main_rotor_5_blades'), mr, new V3(0, 3.66, 0), 1.8)
      c.part('tail_rotor', trl('labels.fenestron'), fan.fan, new V3(-7.3, 2.12, 0), 0.9)
      c.part('engine', trl('labels.arriel_2e_turbines'), null, new V3(-1.0, 2.6, 0), 1.0)
      c.part('fuel_tank', trl('labels.tanks_under_the_floor'), null, new V3(-0.5, 0.65, 0), 1.0)
      c.part('landing_gear', trl('labels.skids'), null, new V3(0, 0.1, 1.2), 1.0)
      c.part('winch', trl('labels.rescue_winch'), null, new V3(0.3, 2.2, 1.28), 0.6)
      c.part('camera', trl('labels.thermal_imager'), flir, new V3(3.0, 0.48, 0), 0.4)
      Object.assign(c.meta, {
        kind: 'heli',
        length: 13.54,
        width: 2.5,
        fuselageWidth: 1.73,
        front: 3.38,
        rear: -8.16,
        clearance: 0.58,
        belt: 1.3,
        bodyHeight: 1.8,
        top: 3.95,
        fuselageTop: 2.38,
        roof: null,
      })
      c.zone('nose', trl('labels.windshield_chin_and_imager'), [2.2, 3.6, 0.25, 2.45, -1.0, 1.0], [flir])
      c.zone('cab', trl('labels.cabin_and_sliding_doors'), [-2.6, 2.2, 0.5, 2.45, -1.05, 1.05], null, {
        dir: 'left',
        fxKey: 'cab',
        who: trl('who.the_police_officers'),
        anyMesh: true,
      })
      c.zone('rear_doors', trl('labels.clamshell_rear_doors'), [-3.4, -2.6, 0.55, 2.35, -1.0, 1.0], null, {
        type: 'lid',
        dir: 'front',
        hinge: 'up',
        fxKey: 'lid',
        who: trl('who.whoever_is_at_the_back_of_the_cabin'),
      })
      c.zone('engine', trl('labels.turbines_and_transmission'), [-3.6, 1.7, 2.25, 3.1, -0.75, 0.75], null, {
        type: 'internal',
        fxKey: 'engine',
        sub: 'engine',
        pos: new V3(-1.0, 2.6, 0),
      })
      c.zone('tail_cone', trl('labels.tail_cone'), [-6.3, -3.3, 1.75, 2.45, -1.2, 1.2], [bm], {
        dir: 'up',
        fxKey: 'tail_cone',
        cutAll: true,
        anyMesh: true,
      })
      c.zone('tail_rotor', false)
      c.zone('fenestron', trl('labels.fenestron_and_fin'), [-8.3, -6.3, 1.2, 3.5, -0.4, 0.4], [fan.fan, fan.ring, fan.duct, fin, topFin], {
        type: 'part',
        fxKey: 'tail_rotor',
        kindPart: 'tail_rotor',
        dir: 'front',
        anyMesh: true,
      })
      c.zone('winch', trl('labels.rescue_winch'), [0.0, 0.6, 1.35, 2.55, 0.75, 1.45], null, {
        type: 'part',
        fxKey: 'fairing',
        dir: 'left',
        fx: [
          trl('effects.none'),
          trl('effects.frayed_cable'),
          trl('effects.winch_jams_halfway'),
          trl('effects.cable_snapped_hook_dropped'),
          trl('effects.winch_torn_off_no_rescue'),
        ],
      })
      c.zone('skids', null, null, sk)
      c.zone('headlight_center', trl('labels.landing_light'))
      c.zone('headlight_right', trl('labels.search_spotlight'))
      c.zone('taillight_right', trl('labels.right_navigation_light_and_blue_beacon'))
      c.zone('taillight_left', trl('labels.left_navigation_light_and_red_beacon'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_lights'))
      c.meta.armor = function (c2: any) {
        /* modified for operations: steel plates on the floor and the pilot doors, left door machine gun, rappel ropes
         and a rescue basket hanging from the hoist */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          c2.roundBox(1.0, 0.5, 0.02, 0.02, stl, 1.65, 1.0, s * 0.88)
        })
        GH.liner(c2, ST, -2.5, 2.1, 0.74, stl, { h: 0.03, maxW: 1.5 })
        c2.rod(new V3(-0.3, 1.0, -0.88), new V3(-0.3, 1.6, -1.05), 0.03, stl)
        c2.cylinder(0.03, 0.03, 1.0, MT.trim, -0.1, 1.65, -1.08, 'x')
        c2.roundBox(0.28, 0.13, 0.1, 0.02, MT.trim, -0.45, 1.62, -1.08)
        ;[-0.5, 0.5].forEach(function (x) {
          c2.rod(new V3(x, 2.3, 0.9), new V3(x + 0.05, 0.3, 1.1), 0.012, CM('#2f5f2a', { roughness: 0.9 }))
        })
        c2.roundBox(0.7, 0.25, 0.45, 0.04, CM('#c84a1e', { roughness: 0.8 }), 0.3, 1.1, 1.3)
        c2.part('weapon', trl('labels.door_machine_gun'), null, new V3(-0.1, 1.65, -1.08), 0.6)
      }
    },
  )

  /* ================= Attack helicopter (Mi-35M type) ================= */
  /* Reference · Mil Mi-35M (AH-2 Sabre of the FAB) - WebFetch (airforce-technology: length 21.6 m with rotors, height 6.5 m,
     span 6.5 m; rhc.ru: masses, engines, weapons), rotors and landing gear from memory
     Real measurements: overall length with rotors 21.6 m · fuselage about 17.5 m (from memory) · main rotor about 17.2 m (5 blades) ·
     X tail rotor about 3.9 m · height 6.5 m (to the top of the tail rotor) · short-wing span 6.5 m ·
     fixed tricycle gear: track about 3.0 m and wheelbase about 4.4 m (from memory) · two VK-2500 of 2,200 hp · twin 23 mm nose cannon.
     Signature traits:
     front: two tandem stepped cockpit bubbles ("insect eyes"): gunner low at the front and pilot behind and higher,
     twin-cannon turret under the nose, sensor ball, engine air intakes with round filters
     side: long tall fuselage with a troop cabin in the middle (clamshell doors, upper and lower), short anhedral wings
     with rocket pods, exhausts with suppressors turned outward, fixed gear, long tail cone
     rear: inclined fin with an X tail rotor on the left side, horizontal stabilizer on the cone
     top: very wide five-blade rotor, two engines side by side over the cabin, short wings with launchers at the tips */
  fx.register(
    {
      key: 'attack_helicopter',
      group: 'military',
      name: trl('vehicles.attack_helicopter.name'),
      inspired: trl('vehicles.attack_helicopter.inspired'),
      category: trl('vehicles.attack_helicopter.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.attack_helicopter.description'),
      mass: 11500,
      noise: 900,
      seats: trl('vehicles.attack_helicopter.seats'),
      capacity: trl('vehicles.attack_helicopter.capacity'),
      efficiency: trl('vehicles.attack_helicopter.efficiency'),
      range: trl('vehicles.attack_helicopter.range'),
      maxSpeed: 300,
      skill: trl('vehicles.attack_helicopter.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        blk = CM('#1a1b1d', { roughness: 0.6 })
      c.meta.matte = true
      const cA = new THREE.Color('#3a4430'),
        cB = new THREE.Color('#66603f'),
        cC = new THREE.Color('#55613f'),
        cL = new THREE.Color('#8d958c')
      function camo(x: any, y: any, z: any, under: any) {
        if (under) return cL
        const n = Math.sin(x * 0.55 + z * 0.8) + Math.sin(x * 0.3 - y * 1.1 + 1.3) + 0.6 * Math.sin(z * 1.7 - x * 0.2)
        return n > 0.8 ? cB : n > -0.3 ? cC : cA
      }
      const paintV = c.paint('#ffffff')
      paintV.vertexColors = true
      const col = function (x: any, y: any, z: any) {
        return camo(x, y, z, y < 1.05)
      }
      /* fuselage: nose with two stepped cockpits, troop cabin, tapering to the cone */
      const ST = [
        [6.05, 1.35, 1.6, 0.12, 2],
        [5.85, 1.05, 1.9, 0.72, 2.2],
        [5.3, 0.88, 2.15, 1.05, 2.4],
        [4.4, 0.8, 2.35, 1.2, 2.6],
        [3.4, 0.76, 2.75, 1.4, 2.8],
        [2.5, 0.74, 3.0, 1.7, 3],
        [-1.0, 0.74, 3.05, 1.72, 3],
        [-2.4, 0.86, 3.0, 1.5, 2.8],
        [-3.6, 1.3, 2.95, 1.0, 2.6],
        [-5.5, 1.85, 2.92, 0.62, 2.4],
        [-8.4, 2.25, 3.0, 0.42, 2.2],
        [-9.4, 2.4, 3.06, 0.34, 2],
      ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 36, col: col }), paintV)
      const gunK = [4.3, 5.65, 1.7, 2.8, null, 0.6],
        pilK = [2.75, 4.2, 2.3, 3.4, null, 0.7]
      const tdP = [
        [1.7, 1.5],
        [0.2, 1.5],
        [0.2, 2.1],
        [1.7, 2.1],
      ]
      kit.cutMesh(
        fus,
        [
          EA.cutT(gunK, function (n: any) {
            return n.y > 0.2
          }),
          EA.cutT(pilK, function (n: any) {
            return n.y > 0.3
          }),
        ],
        40,
      )
      c.deform.push(fus)
      /* tandem cockpit bubbles (moulded glass) with a frame */
      function bubble(st: any, label: any, pos: any) {
        const m = new THREE.Mesh(EA.fuseGeo(st, { smooth: 26, seg: 28 }), MT.armorGlass)
        c.vehicle.add(m)
        kit.cutMesh(
          m,
          [
            {
              sdf: function (x: any, y: any) {
                return y - st[0][1] - 0.04
              },
            },
          ],
          30,
        )
        return kit.asGlass(c, m, label, 'laminated', { pos: pos })
      }
      bubble(
        [
          [5.7, 1.78, 1.82, 0.3, 2],
          [5.45, 1.78, 2.38, 0.9, 2.4],
          [5.0, 1.78, 2.62, 1.0, 2.6],
          [4.5, 1.78, 2.64, 0.98, 2.6],
          [4.25, 1.78, 2.5, 0.8, 2.4],
          [4.1, 1.78, 2.2, 0.4, 2],
        ],
        lbl('gunner_bubble'),
        new V3(5.0, 2.3, 0),
      )
      bubble(
        [
          [4.3, 2.4, 2.45, 0.5, 2],
          [4.05, 2.4, 3.05, 1.06, 2.4],
          [3.6, 2.4, 3.3, 1.14, 2.6],
          [3.0, 2.4, 3.3, 1.12, 2.6],
          [2.7, 2.4, 3.1, 0.9, 2.4],
          [2.55, 2.4, 2.9, 0.4, 2],
        ],
        lbl('pilot_bubble'),
        new V3(3.5, 3.0, 0),
      )
      ;[
        [5.45, 2.38, 0.45],
        [4.6, 2.64, 0.49],
        [4.05, 3.05, 0.53],
        [3.3, 3.3, 0.57],
      ].forEach(function (q) {
        c.tube(
          [
            [q[0], q[1] - 0.6, -q[2]],
            [q[0], q[1], 0],
            [q[0], q[1] - 0.6, q[2]],
          ],
          0.022,
          blk,
          { seg: 14 },
        )
      })
      c.roundBox(1.3, 0.025, 0.025, 0.01, blk, 3.4, 3.3, 0)
      c.roundBox(1.1, 0.025, 0.025, 0.01, blk, 4.9, 2.64, 0)
      /* troop cabin windows and doors (upper and lower clamshell) */
      ;[1, -1].forEach(function (s) {
        GH.fGlass(
          c,
          EA,
          ST,
          EA.sideKeepP(tdP, 0.5, s),
          s > 0 ? lbl('right_troop_cabin_windows') : lbl('left_troop_cabin_windows'),
          'tempered',
          { pos: new V3(1.0, 1.8, s * 0.85), sub: 0.1, pre: EA.keepT([0.0, 1.9, 1.3, 2.3, 0.5]), mat: MT.armorGlass },
        )
        const dF = EA.polySdf([
          [1.9, 0.9],
          [0.0, 0.9],
          [0.0, 2.35],
          [1.9, 2.35],
        ])
        GH.fSkin(
          c,
          EA,
          ST,
          EA.bandT(function (x: any, y: any, z: any) {
            return Math.min(0.008 - Math.min(Math.abs(dF(x, y)), x > 0 && x < 1.9 ? Math.abs(y - 1.35) : 9), s * z - 0.5)
          }),
          MT.dark,
          { k: 1.003, sub: 0.05, pre: EA.keepT([-0.2, 2.1, 0.8, 2.45, 0.5]) },
        )
        for (let k = 0; k < 3; k++) c.roundBox(0.03, 0.62, 0.012, 0.01, blk, 0.5 + k * 0.5, 1.8, s * 0.86)
        c.text(trl('texts.fab_8960'), 1.2, 0.24, -5.3, 2.4, s * 0.33, s > 0 ? '+z' : '-z', { fg: '#1e2219' })
        GH.starDecal(c, -2.7, 2.0, s * 0.72, 0.28, s > 0 ? '+z' : '-z', { bg: '#3a4430', fg: '#a9ab94' })
      })
      kit.cutMesh(fus, [EA.sideCutP(tdP, 0.5)], 40, { sub: 0.12 })
      EA.colorize(fus.geometry, col) /* subdivision drops the per-vertex colour: paint again */
      /* interior: gunner (front) and pilot (behind and higher), troop cabin with 8 side seats */
      const fab = CM('#2e3328', { roughness: 0.85 })
      kit.seat(c, 4.75, 1.55, 0, { w: 0.5, h: 0.32, back: 0.7, lean: 0.15, mat: fab })
      c.roundBox(0.2, 0.3, 0.6, 0.04, CM('#232427'), 5.35, 1.98, 0, { rot: [0, 0, 0.3] })
      c.roundBox(0.2, 0.2, 0.15, 0.03, MT.plastic, 5.25, 2.15, 0)
      kit.seat(c, 3.2, 2.12, 0, { w: 0.5, h: 0.32, back: 0.72, lean: 0.15, mat: fab })
      EA.instPanel(c, 3.85, 2.62, 0.8, { gauges: 6, z0: -0.25, tilt: 0.3, screens: [[0.05, 0.2, 0.14, 0.18]] })
      EA.cyclic(c, 3.55, 2.12, 0)
      EA.collective(c, 3.3, 2.12, -0.38)
      GH.liner(c, ST, -0.3, 2.1, 0.95, MT.carpet, { h: 0.03, maxW: 1.4 })
      ;[0.3, 1.0, 1.7].forEach(function (x, i) {
        if (i < 3) {
          kit.seat(c, x, 0.95, 0.5, { w: 0.5, h: 0.4, back: 0.55, lean: 0.06, face: '-z', mat: fab, headrest: false })
          kit.seat(c, x, 0.95, -0.5, { w: 0.5, h: 0.4, back: 0.55, lean: 0.06, face: '+z', mat: fab, headrest: false })
        }
      })
      kit.seat(c, -0.35, 0.95, 0.5, { w: 0.5, h: 0.4, back: 0.55, lean: 0.06, face: '-z', mat: fab, headrest: false })
      kit.seat(c, -0.35, 0.95, -0.5, { w: 0.5, h: 0.4, back: 0.55, lean: 0.06, face: '+z', mat: fab, headrest: false })
      GH.liner(c, ST, -0.4, 2.0, 2.75, MT.headliner, { maxW: 1.4 })
      /* side-by-side engines with round filters at the front and IR suppressors turned outward */
      const engM = c.paint('#ffffff'),
        engs: any = []
      engM.vertexColors = true
      ;[1, -1].forEach(function (s) {
        const z0 = s * 0.55,
          NS = [
            [2.75, 3.3, 3.4, 0.2, 2],
            [2.6, 3.04, 3.66, 0.66, 2.2],
            [1.8, 2.98, 3.72, 0.72, 2.4],
            [-1.2, 2.98, 3.72, 0.72, 2.4],
            [-1.8, 3.0, 3.66, 0.64, 2.2],
            [-2.1, 3.1, 3.52, 0.4, 2],
          ]
        NS.forEach(function (q) {
          q.push(z0)
        })
        const n = c.add(EA.fuseGeo(NS, { smooth: 20, seg: 22, col: col }), engM)
        c.deform.push(n)
        engs.push(n)
        engs.push(
          c.cylinder(0.4, 0.4, 0.22, CM('#5a5e52', { roughness: 0.7 }), 2.85, 3.35, z0, 'x', { seg: 24 }),
          c.cylinder(0.33, 0.33, 0.02, MT.dark, 2.97, 3.35, z0, 'x', { seg: 24 }),
        )
        const ex = c.roundBox(1.0, 0.45, 0.4, 0.12, CM('#3a3c36', { roughness: 0.7 }), -1.75, 3.25, s * 0.95, { rot: [0, s * 0.45, 0] })
        engs.push(ex)
        engs.push(c.cylinder(0.16, 0.16, 0.02, MT.dark, -2.2, 3.25, s * 1.2, 'x'))
      })
      c.roundBox(3.4, 0.5, 0.5, 0.15, paintV, 0.3, 3.4, 0)
      c.cylinder(0.22, 0.26, 0.5, MT.steel, 0, 3.95, 0)
      c.cylinder(0.42, 0.36, 0.2, MT.steel, 0, 4.25, 0, null, { seg: 5 })
      const mr = EA.mainRotor(c, 0, 4.4, 0, {
        blades: 5,
        R: 8.6,
        chord: 0.58,
        droop: 0.32,
        hub: 0.55,
        hubR: 0.35,
        cap: true,
        v: 2.4,
        mat: CM('#2a2e26', { roughness: 0.55 }),
        phase: 0.2,
      })
      /* tail cone, stabilizer, inclined fin and X tail rotor on the left */
      const tailM = c.paint('#ffffff')
      tailM.vertexColors = true
      const fin = c.add(
        EA.colorize(
          EA.foilGeo(
            [
              { p: [-9.3, 2.85, 0], c: 1.9, t: 0.12 },
              { p: [-10.6, 5.1, 0.0], c: 1.05, t: 0.1 },
            ],
            { up: 'z', n: 10 },
          ),
          function (x: any, y: any, z: any) {
            return camo(x, y, z, false)
          },
        ),
        tailM,
      )
      c.deform.push(fin)
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.colorize(
            EA.foilGeo(
              [
                { p: [-8.3, 2.75, 0], c: 1.0, t: 0.1 },
                { p: [-8.5, 2.75, s * 1.85], c: 0.7, t: 0.09 },
              ],
              { up: 'y', n: 8 },
            ),
            function (x: any, y: any, z: any) {
              return camo(x, y, z, y < 2.75)
            },
          ),
          tailM,
        )
        c.deform.push(hs)
      })
      c.cylinder(0.13, 0.13, 0.4, MT.steel, -10.85, 4.55, -0.25, 'z')
      const tr = xRotor(c, -10.85, 4.55, -0.5, 1.95, 0.27, CM('#2a2e26', { roughness: 0.55 }), CM('#c9b23e'))
      c.rod(new V3(-9.4, 2.5, 0), new V3(-9.9, 1.6, 0), 0.04, MT.steel)
      c.roundBox(0.3, 0.05, 0.08, 0.02, MT.steel, -9.95, 1.57, 0)
      /* short wings with anhedral, pylons with rocket pods and missile launchers at the tips */
      const wingM = c.paint('#ffffff'),
        wps: any = { 1: [], '-1': [] }
      wingM.vertexColors = true
      ;[1, -1].forEach(function (s) {
        const dh = function (z: any) {
          return 2.05 - Math.max(0, Math.abs(z) - 0.8) * 0.21
        }
        const w = c.add(
          EA.colorize(
            EA.foilGeo(
              [
                { p: [0.55, dh(0.7), s * 0.7], c: 1.9, t: 0.13 },
                { p: [0.4, dh(3.1), s * 3.1], c: 1.5, t: 0.11 },
                { p: [0.38, dh(3.25), s * 3.25], c: 1.45, t: 0.06 },
              ],
              { up: 'y', n: 12 },
            ),
            function (x: any, y: any, z: any) {
              return camo(x, y, z, y < dh(z))
            },
          ),
          wingM,
        )
        c.deform.push(w)
        wps[s].push(w)
        ;[1.6, 2.5].forEach(function (zz) {
          const y = dh(zz) - 0.25
          wps[s].push(c.roundBox(0.9, 0.22, 0.08, 0.03, CM('#3c4234'), -0.2, y + 0.08, s * zz))
          rocketPod(c, EA, -0.2, y - 0.25, s * zz, 2.0, 0.26, CM('#353b30', { roughness: 0.8 })).forEach(function (m) {
            wps[s].push(m)
          })
        })
        wps[s].push(c.roundBox(0.3, 1.0, 0.08, 0.03, CM('#3c4234'), 0.0, dh(3.25) - 0.3, s * 3.3))
        ;[0.18, -0.18].forEach(function (dy) {
          wps[s].push(c.cylinder(0.08, 0.08, 1.8, CM('#5b6050', { roughness: 0.7 }), 0.1, dh(3.25) - 0.3 + dy, s * 3.42, 'x', { seg: 12 }))
        })
        EA.navLight(
          c,
          -0.5,
          dh(3.25),
          s * 3.3,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.right_navigation_light_green') : trl('labels.left_navigation_light_red'),
          { r: 0.04 },
        )
      })
      /* nose: twin 23 mm cannon turret, sensor ball, probes */
      const gun = new THREE.Group()
      gun.position.set(5.35, 0.9, 0)
      gun.userData.rigid = true
      c.vehicle.add(gun)
      c.sphere(0.3, CM('#3c4234', { roughness: 0.7 }), 0, 0, 0, 1.2, 0.8, 1, { parent: gun })
      ;[0.07, -0.07].forEach(function (z) {
        c.cylinder(0.04, 0.035, 1.1, MT.steel, 0.65, -0.05, z, 'x', { seg: 10, parent: gun })
        c.cylinder(0.055, 0.055, 0.1, MT.dark, 1.2, -0.05, z, 'x', { seg: 10, parent: gun })
      })
      const sens = c.sphere(0.24, CM('#2b2c2e', { roughness: 0.4 }), 5.55, 1.15, 0.42)
      c.cylinder(0.09, 0.09, 0.02, MT.glassDark, 5.77, 1.15, 0.45, 'x')
      c.rod(new V3(5.9, 1.55, -0.3), new V3(6.7, 1.55, -0.3), 0.02, MT.steel)
      /* fixed tricycle gear: double nose strut and main legs with an inclined damper */
      const legs = []
      legs.push(c.rod(new V3(4.15, 0.9, 0), new V3(4.12, 0.3, 0), 0.06, MT.steel))
      c.wheel(4.12, 0.2, 0.3, 0.16, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#4a4e44') })
      c.wheel(4.12, -0.2, 0.3, 0.16, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#4a4e44') })
      ;[1, -1].forEach(function (s) {
        legs.push(
          c.rod(new V3(-0.25, 1.15, s * 0.85), new V3(-0.28, 0.42, s * 1.48), 0.07, MT.steel),
          c.rod(new V3(-0.9, 0.85, s * 0.8), new V3(-0.28, 0.42, s * 1.45), 0.05, MT.steel),
          c.rod(new V3(0.4, 0.85, s * 0.8), new V3(-0.28, 0.42, s * 1.45), 0.05, MT.steel),
        )
        c.wheel(-0.28, s * 1.52, 0.42, 0.26, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#4a4e44') })
      })
      /* lights: landing lights on the chin, anti-collision and navigation */
      EA.lamp(c, 3.9, 0.78, 0.35, 0.09, trl('labels.right_landing_light'))
      EA.lamp(c, 3.9, 0.78, -0.35, 0.09, trl('labels.left_landing_light'))
      EA.navLight(c, -10.75, 5.05, 0, 'white', trl('labels.tail_light'), { r: 0.035 })
      EA.navLight(c, -2.6, 3.05, 0, 'red', trl('labels.anti_collision_light'), { r: 0.06 })
      c.part('rotor', trl('labels.main_rotor_5_blades'), mr, new V3(0, 4.4, 0), 2.6)
      c.part('tail_rotor', trl('labels.x_tail_rotor'), tr, new V3(-10.85, 4.55, -0.5), 1.6)
      c.part('engine', trl('labels.vk_2500_engines'), engs[0], new V3(0.3, 3.35, 0), 1.2)
      c.part('fuel_tank', trl('labels.jet_a_1_tanks'), null, new V3(-1.5, 1.5, 0), 1.2)
      c.part('landing_gear', trl('labels.fixed_landing_gear'), null, new V3(-0.28, 0.4, 1.5), 1.0)
      c.part('weapon', trl('labels.n_23_mm_twin_cannon'), gun, new V3(5.4, 0.9, 0), 0.7)
      Object.assign(c.meta, {
        kind: 'heli',
        length: 21.6,
        width: 6.5,
        fuselageWidth: 1.72,
        front: 6.08,
        rear: -12.8,
        clearance: 0.74,
        belt: 1.8,
        bodyHeight: 2.3,
        top: 6.5,
        fuselageTop: 3.05,
        roof: null,
        armored: true,
        bullet: true,
      })
      const fz = 1.1
      c.zone('nose', trl('labels.nose_gunner_cabin_and_cannon'), [4.2, 7.0, 0.5, 2.8, -fz, fz], [gun, sens], {
        dir: 'front',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_gunner'),
      })
      c.zone('cab', trl('labels.pilot_cabin'), [2.5, 4.2, 0.7, 3.4, -fz, fz], null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_pilot'),
      })
      c.zone('troop_cabin', trl('labels.troop_cabin_and_clamshell_doors'), [-1.0, 2.5, 0.65, 3.0, -fz, fz], null, {
        dir: 'left',
        fxKey: 'cab',
        who: trl('who.the_soldiers'),
        anyMesh: true,
      })
      c.zone('engine', trl('labels.engines_filters_and_suppressors'), [-2.6, 3.1, 2.9, 3.85, -1.5, 1.5], engs, {
        type: 'part',
        fxKey: 'engine',
        sub: 'engine',
        dir: 'up',
        pos: new V3(0.3, 3.35, 0),
        anchor: [0.3, 3.0, 0],
      })
      c.zone('tail_cone', trl('labels.tail_cone'), [-9.2, -1.0, 1.0, 3.2, -1.0, 1.0], null, {
        dir: 'up',
        fxKey: 'tail_cone',
        cutAll: true,
        anyMesh: true,
      })
      c.zone('empennage', trl('labels.fin_and_stabilizer'), [-11.6, -8.0, 1.4, 5.3, -2.1, 2.1], null, {
        type: 'part',
        fxKey: 'tail',
        dir: 'front',
        anyMesh: true,
      })
      ;[1, -1].forEach(function (s) {
        const sid = s > 0 ? 'right' : 'left'
        c.zone(
          'wing_' + sid,
          s > 0 ? trl('labels.right_wing_and_rockets') : trl('labels.left_wing_and_rockets'),
          [-1.4, 1.6, 0.9, 2.4, s > 0 ? 0.8 : -3.7, s > 0 ? 3.7 : -0.8],
          wps[s],
          { type: 'part', side: s, fxKey: 'weapon', dir: 'up', anchor: [0.5, 2.05, s * 0.8] },
        )
      })
      c.zone('skids', trl('labels.fixed_landing_gear'), [-1.1, 4.7, 0, 1.25, -1.9, 1.9], legs)
      c.zone('headlight_center', trl('labels.landing_lights'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_light'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.meta.armor = function (c2: any) {
        /* modified: plough blade under the nose, extra plates on the troop doors,
         door machine guns and cannon pods in place of the inner rockets, wire guard on the tail rotor */
        const stl = kit.steelMaterial
        c2.roundBox(0.12, 0.4, 2.0, 0.04, stl, 5.9, 0.5, 0, { rot: [0, 0, 0.5] })
        ;[0.8, -0.8].forEach(function (z) {
          c2.rod(new V3(5.9, 0.5, z), new V3(5.0, 0.95, z * 0.6), 0.04, stl)
        })
        ;[1, -1].forEach(function (s) {
          c2.roundBox(1.9, 1.4, 0.03, 0.02, stl, 0.95, 1.6, s * 0.9)
          c2.cylinder(0.03, 0.03, 1.0, MT.trim, 1.1, 2.0, s * 1.0, 'x')
          c2.roundBox(0.3, 0.15, 0.12, 0.02, MT.trim, 0.7, 1.98, s * 1.0)
        })
        c2.tube(
          [
            [-9.6, 4.55, -0.75],
            [-10.85, 6.4, -0.75],
            [-12.2, 4.55, -0.75],
            [-10.85, 2.75, -0.75],
            [-9.6, 4.55, -0.75],
          ],
          0.02,
          stl,
          { seg: 40 },
        )
        c2.part('weapon', trl('labels.door_machine_guns'), null, new V3(1.1, 2.0, 1.0), 0.7)
      }
    },
  )
}
