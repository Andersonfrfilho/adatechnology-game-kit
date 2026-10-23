import type { FleetContext } from '../context'

/* Heavy group: trucks, buses, armoured truck and tractor. Uses only the kit API.
   Local helpers of this file:
   - cabOver: cab-over cab with profile, windshield, door window, interior and a front per model (delivery, constellation, atego)
   - tiltCab: tilting cab (the "Open hood" button tilts the cab forward and shows the diesel underneath)
   - chassis: rails, dual-wheel rear axles, fenders, tank, batteries, side guards and rear bumper
   - boxBody: cargo box (or the armoured box of the cash truck)
   - mirrorBay: mirrored engine bay for a rear engine (city bus) */
export function installHeavy(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const trl = fx.t
  const lbl = fx.label

  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial
  const GRP = 'heavy'
  const RIM_W = CM('#d9d6cc', { metalness: 0.35, roughness: 0.45 }),
    RIM_S = CM('#9ea3a6', { metalness: 0.6, roughness: 0.35 })
  const BUMPER_DARK = CM('#33363a', { roughness: 0.65 }),
    PLAST = CM('#202226', { roughness: 0.7 }),
    ALU = CM('#b9bec2', { metalness: 0.75, roughness: 0.3 })
  const REFL_R = CM('#b3261e', { roughness: 0.4, emissive: new THREE.Color('#2a0402'), emissiveIntensity: 0.3 }),
    REFL_W = CM('#e8e8e2', { roughness: 0.4 })

  function lerp2(a: any, b: any, t: any) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }
  function armorPlus(fn: any) {
    return function (c: any, Z: any) {
      Z.applyArmor(c)
      fn(c, Z)
    }
  }
  function roofLamp(c: any, x: any, y: any, z: any) {
    c.cylinder(0.08, 0.065, 0.12, MT.steel, x, y, z, 'x')
    c.cylinder(0.07, 0.07, 0.012, MT.head, x + 0.065, y, z, 'x')
  }
  function sandbags(c: any, x0: any, x1: any, y: any, z: any, along: any) {
    const bag = CM('#6e6248', { roughness: 0.95 })
    if (along === 'z') {
      for (let zz = x0; zz <= x1 + 1e-6; zz += 0.42) {
        c.roundBox(0.3, 0.16, 0.4, 0.07, bag, z, y, zz)
        c.roundBox(0.3, 0.16, 0.4, 0.07, bag, z, y + 0.15, zz + 0.2 > x1 ? zz : zz + 0.2)
      }
    } else {
      for (let xx = x0; xx <= x1 + 1e-6; xx += 0.42) {
        c.roundBox(0.4, 0.16, 0.3, 0.07, bag, xx, y, z)
        c.roundBox(0.4, 0.16, 0.3, 0.07, bag, xx + 0.2 > x1 ? xx : xx + 0.2, y + 0.15, z)
      }
    }
  }
  /* truck wheel: steel disc with ventilation holes */
  function truckWheel(c: any, x: any, z: any, r: any, w: any, o: any) {
    o = o || {}
    const g = c.wheel(x, z, r, w, { rim: o.rim || RIM_W, spokes: 0, rimR: 0.56, noPart: o.noPart, label: o.label })
    const s = z >= 0 ? 1 : -1,
      rr = r * 0.56
    if (!o.inner)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * PI * 2
        c.cylinder(rr * 0.13, rr * 0.13, 0.012, MT.dark, Math.cos(a) * rr * 0.62, Math.sin(a) * rr * 0.62, s * w * 0.405, 'z', {
          parent: g,
          seg: 10,
        })
      }
    if (!o.inner)
      for (let n = 0; n < 10; n++) {
        const b = (n / 10) * PI * 2
        c.cylinder(0.016, 0.016, 0.04, MT.chrome, Math.cos(b) * rr * 0.36, Math.sin(b) * rr * 0.36, s * w * 0.43, 'z', {
          parent: g,
          seg: 6,
        })
      }
    return g
  }
  /* engine battery: the core locks the hood half-open when the engine is hit; on the tilting cab that
     would lift the whole cab, so the effect is redone without the lock */
  function engineNoLatch(c: any) {
    c.parts.forEach(function (p: any) {
      if (p.kind !== 'engine') return
      p.onHit = function (c2: any, pt: any, force: any) {
        kit.addEmitter(c2, pt.pos.clone().add(new V3(0, 0.35, 0)), 'black')
        kit.puddle(c2, 'oil', pt.pos.clone().setY(Math.max(0.2, c2.meta.clearance || 0.3)), 0.6 + force * 0.3)
      }
    })
  }

  /* light chrome: the scene has no environment map, so pure metal comes out black; a low emissive imitates the reflection */
  const CHR = CM('#e2e6e9', { metalness: 0.55, roughness: 0.2, emissive: new THREE.Color('#3a4046'), emissiveIntensity: 1 })
  /* the rear of the shell sits a few centimetres behind the last profile point (rounded corners and subdivision):
     plates and flat texts that carDetails puts behind would be hidden inside the shell; push outward */
  function rearOut(c: any, n0: any, rr: any, gap: any) {
    c.vehicle.children.slice(n0).forEach(function (o: any) {
      if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.position.x < rr + 0.06) o.position.x = Math.min(o.position.x, rr - gap)
    })
  }

  /* ================= tilting cab ================= */
  /* objs: cab meshes (direct children of c.g). The cab rotates around a transverse axis at the front, bottom.
     Instead of re-parenting the meshes (which would take away their rigid dent following), each one gets the
     tilt in its own matrix: the dent and the click ray keep working. */
  function tiltCab(c: any, objs: any, pivot: any, o: any) {
    o = o || {}
    const h = kit.hinge(c, [], pivot, { len: -(o.len || 1.8), open: o.open || 0.9, sign: -1, zw: 0.7, label: trl('labels.tilting_cab') })
    const piv = h.piv,
      A = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z),
      B = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z)
    const R = new THREE.Matrix4(),
      M = new THREE.Matrix4()
    let last = 0
    function tm() {
      const a = piv.rotation.z
      if (Math.abs(a) < 1e-5) return null
      if (a !== last) {
        R.makeRotationZ(a)
        M.copy(A).multiply(R).multiply(B)
        last = a
      }
      return M
    }
    objs.forEach(function (ob: any) {
      if (ob === piv) return
      ob.updateMatrix = function () {
        this.matrix.compose(this.position, this.quaternion, this.scale)
        const t = tm()
        if (t) this.matrix.premultiply(t)
        this.matrixWorldNeedsUpdate = true
      }
    })
    c.parts.forEach(function (p: any) {
      if (p.kind === 'hood' && p.obj === piv) {
        p.onHit = function () {}
        p.pos = new V3(pivot.x - 0.8, pivot.y + 1.0, 0)
      }
    })
    engineNoLatch(c)
    /* app camera framing (uses meta.bay): farther and a bit above, so the tilted cab does not cover the engine */
    const b = c.meta.bay
    if (b) {
      b.zw = Math.max(b.zw, o.camSpan || 1.1)
      b.center.y += 0.25
      b.center.x -= 0.3
      b.view = { theta: 1.95, phi: 0.78, dist: 5.6 }
    }
    return h
  }

  /* ================= cab-over cab ================= */
  /* o: { model: delivery|constellation|atego, f (front), W, len, roof, belt, bot (cab base), floor, ax (front axle), wr, ww, col, int, glass, sideCol } */
  function cabOver(c: any, o: any) {
    const f = o.f,
      W = o.W,
      len = o.len,
      ry = o.roof,
      belt = o.belt,
      bot = o.bot,
      fl = o.floor,
      md = o.model,
      col = o.col,
      paint = c.paint(col)
    const m = c.meta
    m.color = col
    m.kind = 'truck'
    const dl = md === 'delivery',
      cs = md === 'constellation'
    const ws0 = [f + 0.02, belt - 0.03],
      ws1 = [f - (dl ? 0.24 : cs ? 0.12 : 0.15), ry - (dl ? 0.24 : 0.2)]
    const rr = dl ? 0.34 : cs ? 0.16 : 0.22
    const items = [
      [f - len, bot, 0.06],
      [f - len - 0.01, ry - 0.08, 0.16],
      [ws1[0] - 0.32, ry, rr],
      [ws1[0], ws1[1], 0.1],
      [ws0[0], ws0[1], 0.1],
      [f + 0.04, bot + 0.3, 0.1],
      [f, bot, 0.05],
    ]
    const T = { belt: belt, top: ry + 0.03, k: dl ? 0.07 : 0.045 }
    function wsx(y: any) {
      return ws0[0] + ((ws1[0] - ws0[0]) * (y - ws0[1])) / (ws1[1] - ws0[1])
    }
    const q = kit.quadDef(lerp2(ws0, ws1, 0.05), lerp2(ws0, ws1, 0.93), W, T, 'front', 0.05, { inset: 0.04, side: 0.11 })
    const yb = belt + 0.06,
      ty = ry - 0.27,
      xr = f - len * (dl ? 0.66 : 0.62),
      dip = dl ? 0.2 : md === 'atego' ? 0.12 : 0.02
    const poly = [
      [xr, yb],
      [wsx(yb - dip) - 0.2, yb - dip],
      [wsx(ty) - 0.2, ty],
      [xr, ty],
    ]
    kit.shell(c, {
      items: items,
      bottomY: bot,
      arches: [[o.ax, o.wr, o.wr + 0.08]],
      W: W,
      col: col,
      T: T,
      holes: [kit.holeSide(poly), kit.holeQuad(q)],
      archInner: W / 2 - o.ww - 0.16,
    })
    const gmat = o.glass || null
    kit.glassQuad(c, q, o.glassLabel || lbl('windshield'), gmat ? { mat: gmat } : {})
    kit.sideWindows(
      c,
      [poly],
      W,
      T,
      function () {
        return lbl('door_window')
      },
      gmat ? { mat: gmat, type: o.glassType || 'tempered' } : {},
    )
    Object.assign(m, {
      width: W,
      front: f + 0.1,
      clearance: bot,
      belt: belt,
      top: ry + 0.03,
      bodyHeight: belt - bot,
      tumble: T,
      frontQuad: q,
      glasshouse: { fb: f, belt: belt + 0.03, Wg: W },
      cabRear: f - len,
    })
    /* interior */
    const zi = W / 2 - 0.13,
      fab = CM(o.int || '#3a3b3d', { roughness: 0.88 }),
      trim = CM(o.trim || '#222326', { roughness: 0.7 }),
      xd = wsx(belt)
    c.roundBox(len - 0.28, 0.04, zi * 2, 0.015, MT.carpet, f - len / 2 - 0.04, fl, 0)
    c.roundBox(0.62, 0.22, 0.5, 0.09, trim, f - len * 0.5, fl + 0.1, 0)
    kit.dashboard(c, {
      x: xd - 0.07,
      y: belt + 0.02,
      w: zi * 2,
      d: 0.48,
      h: Math.min(0.55, belt - fl - 0.08),
      drv: -zi * 0.52,
      mat: trim,
      top: fab,
    })
    kit.steeringWheel(c, xd - 0.66, belt + 0.06, -zi * 0.52, { r: 0.22, tilt: 1.12, col: 0.5, mat: trim })
    const sx = Math.max(f - len + 0.62, xd - 1.08)
    kit.seat(c, sx, fl, -zi * 0.52, { w: 0.5, mat: fab, h: 0.44, back: 0.64, lean: 0.18 })
    kit.seat(c, sx, fl, zi * 0.42, { w: zi * 0.98, n: 2, mat: fab, h: 0.44, back: 0.6, lean: 0.18 })
    c.rod(new V3(sx + 0.55, fl, -0.05), new V3(sx + 0.5, fl + 0.48, -0.08), 0.014, MT.chrome)
    c.sphere(0.035, MT.plastic, sx + 0.5, fl + 0.5, -0.08)
    c.roundBox(0.03, ry - fl - 0.12, zi * 2, 0.01, trim, f - len + 0.07, (ry + fl) / 2, 0)
    c.roundBox(len - 0.45, 0.02, zi * 1.8, 0.01, MT.headliner, f - len / 2 - 0.05, ry - 0.07, 0).castShadow = false
    ;[1, -1].forEach(function (s) {
      c.roundBox(len * 0.55, belt - fl - 0.06, 0.03, 0.012, trim, f - len * 0.42, (belt + fl) / 2, s * (zi + 0.03))
      c.roundBox(0.03, 0.12, 0.3, 0.01, MT.headliner, xd - 0.42, ry - 0.2, s * zi * 0.5, { rot: [0, 0, 0.4] })
    })
    /* doors, handles, steps, side indicator */
    const stepX = o.ax - o.wr - 0.24
    ;[1, -1].forEach(function (s) {
      const zs = s * (W / 2 + 0.003)
      c.roundBox(0.012, belt - bot + 0.55, 0.006, 0.003, MT.dark, xr - 0.06, (belt + bot) / 2 + 0.3, zs)
      c.roundBox(0.012, belt - bot + 0.35, 0.006, 0.003, MT.dark, f - 0.1, (belt + bot) / 2 + 0.15, zs)
      c.roundBox(0.16, 0.045, 0.03, 0.012, dl ? MT.trim : MT.chrome, xr + 0.2, belt - 0.12, s * (W / 2 + 0.012))
      c.roundBox(0.1, 0.05, 0.02, 0.01, MT.amber, f - 0.18, bot + 0.55, s * (W / 2 + 0.006))
      ;[bot - 0.02, bot + 0.3].forEach(function (y, i) {
        c.roundBox(0.42, 0.04, 0.22, 0.01, MT.steel, stepX, y, s * (W / 2 - 0.1 - i * 0.05))
      })
      c.rod(new V3(xr - 0.02, belt - 0.3, s * (W / 2 + 0.04)), new V3(xr - 0.02, belt + 0.45, s * (W / 2 + 0.04)), 0.016, MT.trim)
      /* mirrors: main and wide-angle */
      const mx = f - 0.2,
        mz = s * (W / 2 + 0.3)
      c.tube(
        [
          [mx - 0.05, belt + 0.55, s * (W / 2 - 0.02)],
          [mx + 0.1, belt + 0.66, s * (W / 2 + 0.16)],
          [mx + 0.13, belt + 0.5, mz],
        ],
        0.018,
        MT.trim,
        { seg: 16, rs: 6 },
      )
      c.roundBox(0.07, 0.44, 0.2, 0.03, MT.trim, mx + 0.13, belt + 0.3, mz)
      c.roundBox(0.01, 0.4, 0.17, 0.008, MT.chrome, mx + 0.093, belt + 0.3, mz)
      c.roundBox(0.07, 0.17, 0.19, 0.03, MT.trim, mx + 0.13, belt - 0.03, mz)
      c.rod(new V3(mx + 0.13, belt + 0.07, mz), new V3(mx + 0.13, belt + 0.08, mz), 0.012, MT.trim)
    })
    /* wipers */
    ;[-0.38, 0.38].forEach(function (z) {
      const y0 = belt + 0.05
      c.rod(new V3(wsx(y0) + 0.06, y0, z - 0.25), new V3(wsx(y0 + 0.5) + 0.06, y0 + 0.5, z + 0.05), 0.011, MT.trim)
    })
    /* front per model */
    const fx = function (y: any) {
      return kit.profX(items, y, true)
    }
    if (dl) {
      /* wide black band joining headlights and grille (the shell bulges about 6 cm ahead of the profile at the cab front) */
      c.roundBox(0.03, 0.34, W * 0.9, 0.03, PLAST, fx(1.16) + 0.055, 1.16, 0)
      kit.grille(c, { style: 'bars', x: fx(1.16) + 0.075, y: 1.16, w: 0.92, h: 0.28, col: col, emblem: false })
      /* chrome trim at the top of the grille, from headlight to headlight, with the round badge in the middle of the black band */
      c.roundBox(0.03, 0.035, 0.96, 0.012, CHR, fx(1.3) + 0.08, 1.3, 0)
      kit.emblem(c, fx(1.2) + 0.1, 1.2, 0, 0.1)
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.04, 0.27, 0.52, 0.05, CHR, fx(1.16) + 0.035, 1.16, s * (W / 2 - 0.28), { rot: [0, -s * 0.28, 0] })
        kit.headlight(c, {
          style: 'wedge',
          x: fx(1.16) + 0.05,
          y: 1.16,
          z: s * (W / 2 - 0.28),
          w: 0.46,
          h: 0.21,
          d: 0.1,
          side: s,
          yaw: 0.28,
        })
      })
    } else if (cs) {
      c.roundBox(0.04, 0.12, W * 0.88, 0.03, PLAST, fx(belt - 0.12) + 0.01, belt - 0.12, 0)
      kit.grille(c, { style: 'truck', x: fx(1.5) + 0.02, y: 1.5, w: 1.6, h: 0.56, col: col, emblem: false })
      kit.emblem(c, fx(1.5) + 0.09, 1.5, 0, 0.12)
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.04, 0.62, 0.3, 0.04, PLAST, fx(1.5) + 0.045, 1.5, s * (W / 2 - 0.2))
        for (let k = 0; k < 4; k++) c.roundBox(0.02, 0.025, 0.24, 0.008, MT.trim, fx(1.5) + 0.07, 1.3 + k * 0.13, s * (W / 2 - 0.2))
      })
      /* external sun visor with marker lights */
      c.roundBox(0.42, 0.06, W * 0.94, 0.03, paint, ws1[0] + 0.08, ry - 0.02, 0, { rot: [0, 0, -0.18] })
      for (let k2 = -2; k2 <= 2; k2++) c.roundBox(0.05, 0.035, 0.08, 0.012, MT.amber, ws1[0] + 0.28, ry - 0.07, k2 * 0.3)
      c.cylinder(0.035, 0.06, 0.4, MT.chrome, f - len * 0.5, ry + 0.07, -0.5, 'x')
      c.cylinder(0.035, 0.06, 0.32, MT.chrome, f - len * 0.5, ry + 0.07, -0.62, 'x')
    } else {
      /* protruding black grille (the shell bulges about 2 cm ahead of the profile), three chrome bars and a large generic star */
      c.roundBox(0.04, 0.56, 1.38, 0.04, PLAST, fx(1.42) + 0.05, 1.42, 0)
      for (let sl = 0; sl < 3; sl++) c.roundBox(0.03, 0.06, 1.28, 0.025, CHR, fx(1.42) + 0.08, 1.27 + sl * 0.15, 0)
      kit.emblem(c, fx(1.42) + 0.1, 1.42, 0, 0.14)
      c.roundBox(0.04, 0.1, W * 0.8, 0.03, PLAST, fx(belt - 0.1) + 0.01, belt - 0.1, 0)
    }
    return { items: items, q: q, wsx: wsx, xr: xr, T: T, fx: fx }
  }

  /* front bumper, low headlights and front wheels (they do not tilt) */
  function cabFront(c: any, o: any, _cab: any) {
    const f = o.f,
      W = o.W,
      md = o.model,
      by = o.bumperY,
      bh = o.bumperH,
      bx = f + 0.1
    const m = c.meta
    m.frontBumper = c.roundBox(
      0.26,
      bh,
      W + 0.04,
      0.07,
      md === 'constellation' ? CM('#8c9093', { metalness: 0.45, roughness: 0.45 }) : BUMPER_DARK,
      bx,
      by,
      0,
      { def: true },
    )
    c.part('bumper', trl('labels.front_bumper'), m.frontBumper, new V3(bx + 0.1, by, 0), 1.1)
    if (md === 'delivery') {
      ;[1, -1].forEach(function (s) {
        kit.headlight(c, {
          style: 'round',
          x: bx + 0.12,
          y: by - 0.03,
          z: s * (W / 2 - 0.28),
          w: 0.11,
          h: 0.11,
          d: 0.05,
          side: s,
          noPart: true,
        })
      })
      c.roundBox(0.3, 0.035, 0.6, 0.01, MT.steel, bx + 0.02, by + bh / 2 + 0.005, 0)
    } else {
      ;[1, -1].forEach(function (s) {
        kit.headlight(c, {
          style: md === 'constellation' ? 'truck' : 'rect',
          x: bx + 0.11,
          y: by + 0.02,
          z: s * (W / 2 - 0.33),
          w: 0.42,
          h: 0.2,
          d: 0.08,
          side: s,
          yaw: md === 'atego' ? 0.12 : 0,
        })
        kit.headlight(c, {
          style: 'round',
          x: bx + 0.12,
          y: by - bh * 0.32,
          z: s * (W / 2 - 0.68),
          w: 0.1,
          h: 0.1,
          d: 0.05,
          side: s,
          noPart: true,
        })
        c.roundBox(0.03, 0.12, 0.42, 0.02, MT.dark, bx + 0.125, by - bh * 0.3, s * 0.35)
      })
    }
    c.roundBox(0.06, 0.06, 0.12, 0.02, MT.steel, bx + 0.13, by - bh * 0.35, 0)
    c.plate(bx + 0.135, by + (md === 'delivery' ? -0.02 : -bh * 0.05), 0, '+x')
    ;[1, -1].forEach(function (s) {
      truckWheel(c, o.ax, s * (W / 2 - o.ww / 2 - 0.05), o.wr, o.ww, {
        label: s > 0 ? trl('labels.front_right_tire') : trl('labels.front_left_tire'),
      })
    })
  }

  /* ================= chassis ================= */
  /* o: { f, rear, W, railY, axles:[x..], wr, ww, tankX, tankSide (-1 left), guards: [x0, x1] , bar: true, mud: true, lightsY } */
  function chassis(c: any, o: any) {
    const f = o.f,
      rear = o.rear,
      W = o.W,
      ry = o.railY,
      wr = o.wr,
      ww = o.ww,
      m = c.meta
    ;[0.43, -0.43].forEach(function (z) {
      c.roundBox(f - rear - 0.1, 0.24, 0.09, 0.02, MT.trim, (f + rear) / 2, ry, z)
    })
    for (let x = rear + 0.3; x < f - 0.3; x += 1.3) c.roundBox(0.1, 0.18, 0.78, 0.02, MT.trim, x, ry, 0)
    o.axles.forEach(function (ax: any, i: any) {
      c.cylinder(0.08, 0.08, W - 0.5, MT.trim, ax, wr, 0, 'z')
      if (!o.tag || i === 0) c.sphere(0.2, MT.trim, ax, wr, 0, 1, 1, 0.9)
      ;[1, -1].forEach(function (s) {
        const zo = s * (W / 2 - ww / 2 - 0.04),
          zi = zo - s * (ww + 0.03)
        truckWheel(c, ax, zo, wr, ww, {
          label: s > 0 ? trl('labels.rear_tire_n_right', { n: i + 1 }) : trl('labels.rear_tire_n_left', { n: i + 1 }),
        })
        if (!(o.tag && i > 0 && o.single)) truckWheel(c, ax, zi, wr, ww - 0.02, { noPart: true, inner: true })
        c.roundBox(0.08, 0.32, 0.06, 0.02, MT.steel, ax, ry - 0.2, s * 0.43)
        c.roundBox(1.1, 0.06, 0.1, 0.02, MT.steel, ax, ry - 0.08, s * 0.43)
      })
    })
    /* fenders over the rear wheel set */
    const axs = o.axles.slice().sort(function (a: any, b: any) {
        return a - b
      }),
      a0 = axs[0] - wr - 0.12,
      a1 = axs[axs.length - 1] + wr + 0.12
    ;[1, -1].forEach(function (s) {
      /* dual-wheel fender: outer edge flush with the side (does not exceed the vehicle width) */
      const zc = s * (W / 2 - ww - 0.05),
        fw = ww * 2 + 0.1
      if (o.mud !== false) {
        c.roundBox(a1 - a0, 0.04, fw, 0.015, MT.trim, (a0 + a1) / 2, wr * 2 + 0.1, zc)
        ;[a0, a1].forEach(function (xx, j) {
          c.roundBox(0.04, wr * 0.9, fw, 0.015, MT.trim, xx, wr * 1.55 + 0.05, zc, { rot: [0, 0, (j ? -1 : 1) * 0.35] })
        })
        c.roundBox(0.02, 0.5, fw - 0.06, 0.01, MT.rubber, a0 - 0.08, 0.42, zc)
      }
    })
    /* diesel tank, urea (Arla 32) tank and batteries */
    const ts = o.tankSide || -1,
      tz = ts * (W / 2 - 0.36)
    const tank = c.roundBox(0.95, 0.52, 0.56, 0.18, ALU, o.tankX, ry - 0.2, tz, { def: true })
    c.cylinder(0.06, 0.06, 0.04, MT.trim, o.tankX + 0.25, ry + 0.08, tz + ts * 0.1)
    ;[-0.3, 0.3].forEach(function (dx) {
      c.roundBox(0.05, 0.56, 0.6, 0.01, MT.trim, o.tankX + dx, ry - 0.2, tz)
    })
    c.part('fuel_tank', trl('labels.diesel_tank'), tank, new V3(o.tankX, ry - 0.2, tz), 0.8)
    if (o.adblue) {
      c.roundBox(0.32, 0.4, 0.4, 0.1, CM('#d8dadb', { roughness: 0.5 }), o.tankX - 0.75, ry - 0.2, tz)
      c.cylinder(0.05, 0.05, 0.04, CM('#2a63c4'), o.tankX - 0.75, ry + 0.02, tz)
    }
    const bat = c.roundBox(0.6, 0.42, 0.42, 0.04, MT.trim, o.tankX, ry - 0.16, -tz)
    c.roundBox(0.62, 0.03, 0.44, 0.01, MT.steel, o.tankX, ry + 0.06, -tz)
    c.part('battery', trl('labels.battery_box'), bat, new V3(o.tankX, ry - 0.16, -tz), 0.7)
    ;[1, -1].forEach(function (s) {
      c.cylinder(0.12, 0.12, 0.6, MT.steel, o.tankX - 0.9, ry - 0.24, s * 0.62, 'x')
    })
    c.cylinder(0.15, 0.15, 0.55, CM('#3b3d40', { metalness: 0.5 }), o.tankX + 0.05, ry - 0.3, 0, 'x')
    c.tube(
      [
        [o.tankX - 0.25, ry - 0.3, 0],
        [axs[0] + wr + 0.3, ry - 0.32, 0.25],
        [axs[0] + wr + 0.1, ry - 0.3, W / 2 - 0.2],
      ],
      0.04,
      CM('#3b3d40', { metalness: 0.5 }),
      { seg: 16, rs: 8 },
    )
    /* side guards (mandatory on a truck) */
    if (o.guards)
      [1, -1].forEach(function (s) {
        ;[0.48, 0.78].forEach(function (y) {
          c.roundBox(
            o.guards[1] - o.guards[0],
            0.08,
            0.03,
            0.01,
            CM('#9a9d9f', { metalness: 0.5 }),
            (o.guards[0] + o.guards[1]) / 2,
            y,
            s * (W / 2 - 0.04),
          )
        })
        for (let gx = o.guards[0] + 0.1; gx < o.guards[1]; gx += 1.0)
          c.roundBox(0.06, 0.4, 0.04, 0.01, MT.trim, gx, 0.63, s * (W / 2 - 0.07))
      })
    /* rear bumper with a reflective strip */
    if (o.bar !== false) {
      const bar = c.roundBox(0.14, 0.16, W - 0.12, 0.03, MT.trim, rear + 0.08, 0.52, 0, { def: true })
      for (let k = 0; k < 8; k++)
        c.roundBox(
          0.012,
          0.1,
          (W - 0.2) / 8 - 0.01,
          0.004,
          k % 2 ? REFL_W : REFL_R,
          rear + 0.008,
          0.52,
          -(W - 0.2) / 2 + ((k + 0.5) * (W - 0.2)) / 8,
        )
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.06, 0.32, 0.06, 0.01, MT.trim, rear + 0.12, ry - 0.2, s * 0.43)
      })
      m.rearBumper = bar
      c.part('bumper', trl('labels.rear_bumper'), bar, new V3(rear, 0.52, 0), 1.0)
    }
    const ly = o.lightsY || ry - 0.05
    ;[1, -1].forEach(function (s) {
      c.roundBox(0.06, 0.2, 0.62, 0.02, MT.trim, rear + 0.1, ly, s * (W / 2 - 0.4))
      kit.taillight(c, { style: 'vertical', x: rear + 0.05, y: ly, z: s * (W / 2 - 0.4), w: 0.5, h: 0.17, d: 0.06, side: s })
      c.roundBox(0.02, 0.45, ww * 2 + 0.05, 0.01, MT.rubber, rear + 0.32, 0.38, s * (W / 2 - ww - 0.02))
    })
    c.plate(rear + 0.02, ly - 0.28, 0, '-x')
    m.rear = rear
    m.length = (m.front || f) - rear
  }

  /* ================= box body ================= */
  /* o: { x0 (front), x1 (rear), y0, y1, W, col, armored, label } */
  function boxBody(c: any, o: any) {
    const x0 = o.x0,
      x1 = o.x1,
      y0 = o.y0,
      y1 = o.y1,
      W = o.W,
      L = x0 - x1,
      H = y1 - y0,
      cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2
    const body = c.roundBox(L, H, W, o.armored ? 0.1 : 0.05, c.paint(o.col), cx, cy, 0, { def: true, sub: 0.3 })
    /* aluminium trim: low-metal and light colour, because the scene has no environment map and pure metal comes out black */
    const rib = o.armored ? CM('#4a535a', { metalness: 0.35, roughness: 0.5 }) : CM('#c4c7c3', { metalness: 0.25, roughness: 0.42 })
    const doorM = o.armored ? c.paint(o.col) : CM('#d9dbd6', { metalness: 0.15, roughness: 0.45 })
    /* subframe */
    c.roundBox(L - 0.1, 0.12, 0.2, 0.02, MT.trim, cx, y0 - 0.07, 0.43)
    c.roundBox(L - 0.1, 0.12, 0.2, 0.02, MT.trim, cx, y0 - 0.07, -0.43)
    for (let xs = x1 + 0.2; xs < x0; xs += 0.6) c.roundBox(0.08, 0.1, W - 0.1, 0.02, MT.trim, xs, y0 - 0.05, 0)
    ;[1, -1].forEach(function (s) {
      const zs = s * (W / 2 + 0.012)
      if (!o.armored) for (let x = x1 + 0.35; x < x0 - 0.2; x += 0.6) c.roundBox(0.055, H - 0.12, 0.025, 0.01, rib, x, cy, zs)
      c.roundBox(L + 0.02, 0.09, 0.04, 0.015, rib, cx, y0 + 0.04, s * (W / 2 + 0.018))
      c.roundBox(L + 0.02, 0.07, 0.04, 0.015, rib, cx, y1 - 0.035, s * (W / 2 + 0.018))
      ;[x0 - 0.15, cx, x1 + 0.2].forEach(function (xx) {
        c.roundBox(0.07, 0.06, 0.02, 0.01, MT.amber, xx, y0 + 0.16, s * (W / 2 + 0.03))
      })
      ;[x0 - 0.1, x1 + 0.1].forEach(function (xx) {
        c.roundBox(0.06, 0.05, 0.02, 0.01, xx > cx ? MT.amber : MT.tail, xx, y1 - 0.12, s * (W / 2 + 0.03))
      })
    })
    /* rear: two leaves, locking bars, hinges */
    const rx = x1 - 0.01
    if (o.armored) {
      /* vault: single armoured door (hinges on the left, lock and viewer stay with the builder), with a dark gap around it */
      const dzc = -0.05,
        dw = 1.8,
        dh = H - 0.36,
        dy = cy - 0.06
      c.roundBox(0.035, dh, dw, 0.03, doorM, rx - 0.012, dy, dzc)
      ;[
        [0, dh / 2 + 0.012, dw + 0.04, 0.018],
        [0, -dh / 2 - 0.012, dw + 0.04, 0.018],
      ].forEach(function (e) {
        c.roundBox(0.02, e[3], e[2], 0.004, MT.dark, rx - 0.003, dy + e[1], dzc)
      })
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.02, dh + 0.04, 0.018, 0.004, MT.dark, rx - 0.003, dy, dzc + s * (dw / 2 + 0.012))
      })
      for (let rv = 0; rv < 6; rv++)
        [1, -1].forEach(function (s) {
          c.sphere(0.016, MT.steel, rx - 0.03, dy - dh / 2 + 0.12 + (rv * (dh - 0.24)) / 5, dzc + s * (dw / 2 - 0.07))
        })
      const m0 = c.meta
      m0.roof = { x0: x1 + 0.25, x1: x0 - 0.25, w: W - 0.4, y: y1 }
      m0.top = y1
      m0.bodyHeight = Math.max(m0.bodyHeight || 0, H * 0.8)
      c.part('cargo', o.label || trl('labels.cargo_box'), body, new V3(cx, cy, 0), 1.8)
      return body
    }
    c.roundBox(0.03, H - 0.1, W - 0.08, 0.02, doorM, rx - 0.005, cy, 0)
    c.roundBox(0.04, H - 0.14, 0.01, 0.004, MT.dark, rx - 0.02, cy, 0)
    ;[-0.82, -0.35, 0.35, 0.82].forEach(function (z) {
      c.rod(new V3(rx - 0.05, y0 + 0.06, (z * W) / 2.4), new V3(rx - 0.05, y1 - 0.06, (z * W) / 2.4), 0.022, MT.steel)
      c.roundBox(0.05, 0.06, 0.13, 0.01, MT.steel, rx - 0.07, cy - 0.15, (z * W) / 2.4 + 0.06)
    })
    ;[1, -1].forEach(function (s) {
      ;[0.18, 0.5, 0.82].forEach(function (t) {
        c.roundBox(0.04, 0.1, 0.16, 0.01, MT.steel, rx - 0.03, y0 + H * t, s * (W / 2 - 0.08))
      })
    })
    c.roundBox(0.06, 0.1, W - 0.1, 0.02, rib, rx - 0.02, y1 - 0.05, 0)
    ;[1, -1].forEach(function (s) {
      c.roundBox(0.03, 0.05, 0.08, 0.01, MT.tail, rx - 0.02, y1 - 0.06, s * 0.35)
    })
    const m = c.meta
    m.roof = { x0: x1 + 0.25, x1: x0 - 0.25, w: W - 0.4, y: y1 }
    m.top = y1
    m.bodyHeight = Math.max(m.bodyHeight || 0, H * 0.8)
    c.part('cargo', o.label || trl('labels.cargo_box'), body, new V3(cx, cy, 0), 1.8)
    return body
  }

  /* mirrored engine bay (rear engine): built with engineBay and rotated 180 degrees around a vertical axis at xm */
  function mirrorBay(c: any, o: any, xm: any) {
    const n0 = c.vehicle.children.length,
      np = c.parts.length
    kit.engineBay(c, o)
    const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), PI)
    c.vehicle.children.slice(n0).forEach(function (ob: any) {
      ob.position.x = 2 * xm - ob.position.x
      ob.position.z = -ob.position.z
      ob.quaternion.premultiply(q)
    })
    c.parts.slice(np).forEach(function (p: any) {
      p.pos.x = 2 * xm - p.pos.x
      p.pos.z = -p.pos.z
    })
    const b = c.meta.bay
    if (b) {
      const a = 2 * xm - b.x1,
        z = 2 * xm - b.x0
      b.x0 = a
      b.x1 = z
      b.center.x = 2 * xm - b.center.x
    }
  }

  /* ================================================================ */
  /* Delivery box truck (Volkswagen Delivery 11.180 type, 2017+ generation)
     Reference (VW 11.180 cab-chassis sheet and a typical 5.5 m box; web + memory):
     length 7.60 m (wheelbase 4.30; front overhang 1.19; rear 2.10) · cab width 2.20 m, box 2.42 m
     cab height 2.45 m, box 3.38 m · front track 1.88 m · tyre 215/75 R17.5 (diameter 0.77 m) · clearance 0.22 m (axle)
     Signature traits:
     front: large wedge headlights on the corners, rising outward, in a black frame; black grille of horizontal bars between them;
     round badge at the top of the front; black bumper with round fog lights and a central step
     side: short narrow cab, narrower at the roof; door window with a lowered front corner; double step
     behind the wheel; tubular-arm mirror with a wide-angle mirror below
     rear: aluminium box with two leaves, four locking bars and a bumper with a reflective strip
     top: cab without a deflector, smooth box rising above the cab */
  fx.register(
    {
      key: 'box_truck',
      group: GRP,
      name: trl('vehicles.box_truck.name'),
      inspired: trl('vehicles.box_truck.inspired'),
      category: trl('vehicles.box_truck.category'),
      fuel: 'diesel',
      description: trl('vehicles.box_truck.description'),
      mass: 4300,
      noise: 105,
      seats: trl('vehicles.box_truck.seats'),
      capacity: trl('vehicles.box_truck.capacity'),
      efficiency: trl('vehicles.box_truck.efficiency'),
      range: trl('vehicles.box_truck.range'),
      maxSpeed: 110,
      skill: trl('vehicles.box_truck.skill'),
      hood: true,
    },
    function (c) {
      const f = 3.6,
        W = 2.2,
        len = 1.72,
        ax = 2.65,
        wr = 0.385,
        ww = 0.22,
        col = '#e9eae6'
      const cabO = {
        model: 'delivery',
        f: f,
        W: W,
        len: len,
        roof: 2.45,
        belt: 1.56,
        bot: 0.66,
        floor: 1.1,
        ax: ax,
        wr: wr,
        ww: ww,
        col: col,
        int: '#4a4c50',
        bumperY: 0.58,
        bumperH: 0.3,
      }
      c.meta.cabLength = len + 0.15
      const n0 = c.vehicle.children.length,
        cab = cabOver(c, cabO),
        cabObjs = c.vehicle.children.slice(n0)
      c.roundBox(0.03, 0.06, W * 0.6, 0.01, CM('#1f4fa3'), cab.fx(0.9) + 0.02, 0.92, 0)
      cabFront(c, cabO, cab)
      kit.engineBay(c, { x0: f - len + 0.12, x1: f - 0.45, zw: 0.4, floor: 0.4, top: 1.06, motor: 'diesel', col: '#3a3c3e' })
      tiltCab(c, cabObjs, new V3(f - 0.02, 0.9, 0), { len: len, open: 1.15 })
      chassis(c, {
        f: f - 0.1,
        rear: -3.75,
        W: 2.3,
        railY: 0.74,
        axles: [-1.65],
        wr: wr,
        ww: ww,
        tankX: 0.6,
        tankSide: -1,
        guards: [-1.1, 2.0],
        lightsY: 0.62,
      })
      const box = boxBody(c, { x0: f - len - 0.1, x1: -3.72, y0: 0.98, y1: 3.38, W: 2.42, col: '#f1f1ec' })
      ;[1, -1].forEach(function (s) {
        c.roundBox(4.6, 0.32, 0.01, 0.01, CM('#1f4fa3', { roughness: 0.5 }), -1.0, 1.35, s * 1.217)
        c.roundBox(4.6, 0.06, 0.01, 0.01, CM('#e0a21c', { roughness: 0.5 }), -1.0, 1.56, s * 1.217)
        c.text(trl('texts.deliveries_now'), 2.4, 0.42, -0.7, 2.4, s * 1.242, s > 0 ? '+z' : '-z', { fg: '#1f4fa3' })
      })
      const m = c.meta
      m.front = f + 0.24
      m.length = m.front - m.rear
      m.top = 3.38
      m.belt = 1.56
      m.bodyHeight = 1.6
      m.clearance = 0.42
      m.armor = armorPlus(function (c: any) {
        const r = c.meta.roof,
          y = r.y + 0.06
        for (let x = r.x0; x <= r.x1; x += 0.6)
          [1, -1].forEach(function (s) {
            c.rod(new V3(x, y, s * 1.12), new V3(x, y + 0.7, s * 1.12), 0.02, kit.steelMaterial)
          })
        ;[1, -1].forEach(function (s) {
          c.rod(new V3(r.x0, y + 0.7, s * 1.12), new V3(r.x1, y + 0.7, s * 1.12), 0.025, kit.steelMaterial)
        })
        sandbags(c, -0.9, 0.9, y + 0.1, r.x1 - 0.2, 'z')
        roofLamp(c, r.x1, y + 0.45, 0.6)
        roofLamp(c, r.x1, y + 0.45, -0.6)
        for (let k = 0; k < 9; k++)
          c.rod(new V3(-3.86, 0.6 + k * 0.32, 0.95), new V3(-3.86, 0.6 + k * 0.32, 0.55), 0.016, kit.steelMaterial)
        ;[0.55, 0.95].forEach(function (z) {
          c.rod(new V3(-3.86, 0.6, z), new V3(-3.86, 3.5, z), 0.022, kit.steelMaterial)
        })
      })
      void box
    },
  )

  /* Fuel tanker truck (Volkswagen Constellation 24.280 6x2 type, fuel tank)
     Reference (VW Constellation 24.280 brochure, wheelbase 4,800; web):
     length 9.81 m (front overhang 1.51; wheelbase 1st-2nd 4.80, 1st-3rd 6.02; rear overhang 2.27)
     width 2.51 m without mirrors · cab height 2.87 m · track 2.11 m (front) and 1.85 m (rear)
     tyre 275/80 R22.5 (diameter 1.01 m) · clearance about 0.25 m · diesel tank 275 L · cargo tank about 20 m3
     Signature traits:
     front: tall, almost square black grille with horizontal bars and a round badge in the centre; double rectangular headlights
     inside the grey steel bumper; external sun visor with five amber lights; flat tall windshield
     side: short tall cab, door with a low corner window, steps behind the wheel, two large mirrors
     rear: elliptical tank with a ladder, hazard plates 33/1203 and a bumper with a reflective strip
     top: manholes in a line with a walkway and guardrail; air horns on the cab roof */
  fx.register(
    {
      key: 'tanker_truck',
      group: GRP,
      name: trl('vehicles.tanker_truck.name'),
      inspired: trl('vehicles.tanker_truck.inspired'),
      category: trl('vehicles.tanker_truck.category'),
      fuel: 'diesel',
      description: trl('vehicles.tanker_truck.description'),
      mass: 10800,
      noise: 115,
      seats: trl('vehicles.tanker_truck.seats'),
      capacity: trl('vehicles.tanker_truck.capacity'),
      efficiency: trl('vehicles.tanker_truck.efficiency'),
      range: trl('vehicles.tanker_truck.range'),
      maxSpeed: 100,
      skill: trl('vehicles.tanker_truck.skill'),
      hood: true,
    },
    function (c) {
      const f = 4.6,
        W = 2.5,
        len = 2.05,
        ax = 3.3,
        wr = 0.506,
        ww = 0.3,
        col = '#a3231b'
      c.meta.cabLength = len + 0.15
      const cabO = {
        model: 'constellation',
        f: f,
        W: W,
        len: len,
        roof: 2.87,
        belt: 1.9,
        bot: 0.84,
        floor: 1.38,
        ax: ax,
        wr: wr,
        ww: ww,
        col: col,
        int: '#3b3632',
        bumperY: 0.96,
        bumperH: 0.44,
      }
      const n0 = c.vehicle.children.length,
        cab = cabOver(c, cabO),
        cabObjs = c.vehicle.children.slice(n0)
      cabFront(c, cabO, cab)
      kit.engineBay(c, { x0: f - len + 0.1, x1: f - 0.45, zw: 0.42, floor: 0.5, top: 1.36, motor: 'diesel', col: '#3a3c3e' })
      tiltCab(c, cabObjs, new V3(f - 0.02, 1.15, 0), { len: len, open: 1.15 })
      const rear = -5.0
      chassis(c, {
        f: f - 0.1,
        rear: rear,
        W: W,
        railY: 0.98,
        axles: [ax - 4.8, ax - 6.024],
        tag: true,
        wr: wr,
        ww: ww,
        tankX: 1.35,
        tankSide: -1,
        adblue: true,
        guards: [-0.85, 2.62],
        lightsY: 0.82,
      })
      /* elliptical tank */
      const tx = -1.25,
        len2 = 6.2,
        ty = 2.08,
        sy = 0.82,
        sz = 1.16
      function hz(y: any) {
        const d = (y - ty) / sy
        return sz * Math.sqrt(Math.max(0, 1 - d * d))
      }
      const TM = CM(kit.paintColor('#c3c8cb', c.state), {
        metalness: 0.45,
        roughness: 0.3,
        emissive: new THREE.Color('#262a2d'),
        emissiveIntensity: 1,
      })
      const tk = c.add(new THREE.CylinderGeometry(1, 1, len2, 40, 26), TM, tx, ty, 0)
      tk.rotation.z = PI / 2
      tk.scale.set(sy, 1, sz)
      c.deform.push(tk)
      ;[tx - len2 / 2, tx + len2 / 2].forEach(function (x, i) {
        const cap = c.sphere(1, TM, x, ty, 0, 0.28, sy, sz, { ws: 32, hs: 18 })
        if (!i) cap.rotation.y = PI
        c.deform.push(cap)
      })
      ;[-2.5, -1.25, 0, 1.25, 2.5].forEach(function (dx) {
        const b = c.add(new THREE.TorusGeometry(1.0, 0.025, 8, 48), CM('#8d9294', { metalness: 0.6 }), tx + dx, ty, 0)
        b.rotation.y = PI / 2
        b.scale.set(sz + 0.01, sy + 0.01, 1)
      })
      for (let sx = -1; sx <= 1; sx += 2) c.roundBox(len2 - 0.4, 0.2, 0.25, 0.04, MT.trim, tx, ty - sy - 0.02, sx * 0.43)
      /* manholes, walkway and folding guardrail */
      ;[-2.3, -1.15, 0, 1.15, 2.3].forEach(function (dx) {
        c.cylinder(0.26, 0.28, 0.14, ALU, tx + dx, ty + sy + 0.02, 0)
        c.cylinder(0.21, 0.21, 0.05, MT.chrome, tx + dx, ty + sy + 0.11, 0)
        c.cylinder(0.05, 0.05, 0.08, MT.steel, tx + dx + 0.12, ty + sy + 0.16, 0.1)
      })
      c.roundBox(len2 - 0.3, 0.035, 0.42, 0.01, CM('#5d6164', { metalness: 0.55 }), tx, ty + sy + 0.06, 0.62)
      for (let x = tx - len2 / 2 + 0.2; x <= tx + len2 / 2 - 0.15; x += 0.62)
        [0.4, -0.4].forEach(function (z) {
          c.rod(new V3(x, ty + sy, z), new V3(x, ty + sy + 0.34, z * 1.05), 0.014, MT.steel)
        })
      ;[0.42, -0.42].forEach(function (z) {
        c.rod(
          new V3(tx - len2 / 2 + 0.2, ty + sy + 0.34, z * 1.05),
          new V3(tx + len2 / 2 - 0.15, ty + sy + 0.34, z * 1.05),
          0.018,
          MT.steel,
        )
      })
      /* rear ladder, valve cabinet and hose rack */
      const lx = tx - len2 / 2 - 0.36
      ;[0.24, -0.24].forEach(function (z) {
        c.rod(new V3(lx, 0.95, z), new V3(lx + 0.12, ty + sy + 0.35, z), 0.022, MT.steel)
      })
      for (let y = 1.15; y < ty + sy; y += 0.3)
        c.rod(new V3(lx + 0.03 + (y - 0.95) * 0.04, y, -0.24), new V3(lx + 0.03 + (y - 0.95) * 0.04, y, 0.24), 0.013, MT.steel)
      c.roundBox(0.75, 0.55, 1.6, 0.04, ALU, -0.3, 0.95, 0)
      for (let v = 0; v < 4; v++) c.cylinder(0.05, 0.05, 0.12, CM('#c9a227', { metalness: 0.4 }), -0.6 + v * 0.2, 0.62, 0.6)
      ;[1, -1].forEach(function (s) {
        c.cylinder(0.12, 0.12, 2.3, ALU, 0.25, 1.36, s * 1.0, 'x')
        c.cylinder(0.1, 0.1, 0.02, MT.dark, -0.91, 1.36, s * 1.0, 'x')
        c.roundBox(0.42, 0.32, 0.012, 0.01, CM('#d9771c'), tx + 1.6, ty - 0.25, s * (hz(ty - 0.1) + 0.006))
        c.text('33', 0.36, 0.13, tx + 1.6, ty - 0.18, s * (hz(ty - 0.1) + 0.014), s > 0 ? '+z' : '-z', { fg: '#111', size: 0.85 })
        c.text('1203', 0.36, 0.13, tx + 1.6, ty - 0.32, s * (hz(ty - 0.1) + 0.014), s > 0 ? '+z' : '-z', { fg: '#111', size: 0.85 })
        const dia = c.roundBox(0.3, 0.3, 0.012, 0.01, CM('#c3271c'), tx + 2.15, ty - 0.25, s * (hz(ty - 0.05) + 0.006))
        dia.rotation.z = PI / 4
        c.text('3', 0.18, 0.18, tx + 2.15, ty - 0.27, s * (hz(ty - 0.05) + 0.014), s > 0 ? '+z' : '-z', { fg: '#fff', size: 0.9 })
        c.text(trl('texts.flammable'), 1.12, 0.3, tx - 0.625, ty + 0.12, s * (sz + 0.012), s > 0 ? '+z' : '-z', { fg: '#b3261e' })
        for (let k = 0; k < 11; k++)
          c.roundBox(
            0.25,
            0.05,
            0.01,
            0.005,
            k % 2 ? REFL_W : REFL_R,
            tx - 2.8 + k * 0.55,
            ty - sy * 0.72,
            s * (hz(ty - sy * 0.62) + 0.006),
          )
        c.roundBox(0.42, 0.42, 0.25, 0.04, CM('#b3261e'), 2.2, 1.0, s * (W / 2 - 0.15))
      })
      c.roundBox(0.012, 0.32, 0.42, 0.01, CM('#d9771c'), tx - len2 / 2 - 0.29, ty - 0.2, 0)
      c.text('33', 0.36, 0.13, tx - len2 / 2 - 0.3, ty - 0.13, 0, '-x', { fg: '#111', size: 0.85 })
      c.text('1203', 0.36, 0.13, tx - len2 / 2 - 0.3, ty - 0.27, 0, '-x', { fg: '#111', size: 0.85 })
      const m = c.meta
      m.roof = null
      m.top = ty + sy + 0.4
      m.bodyHeight = 1.3
      m.clearance = 0.5
      m.front = f + 0.24
      m.length = m.front - rear
      c.part('fuel_tank', trl('labels.cargo_tank_20_000_l'), tk, new V3(tx, ty, 0), 2.2, {
        onHit: function (c2: any, pt: any, force: any) {
          const pd = kit.puddle(c2, 'gasoline', new V3(tx, 1.0, 0), 1.8 + force)
          if (force >= 0.9) {
            kit.igniteFuel(c2, pd)
            kit.blastDamage(c2, force * 230)
          }
        },
      })
      m.bigBlast = true
      m.armor = armorPlus(function (c: any) {
        /* mobile station: grille over the valves, hose reel and search light */
        for (let z = -1.0; z <= 1.01; z += 0.2) c.rod(new V3(-0.85, 1.28, z), new V3(0.05, 1.28, z), 0.014, kit.steelMaterial)
        c.cylinder(0.4, 0.4, 0.35, CM('#b3261e'), lx - 0.1, 1.45, 0.6, 'z')
        c.cylinder(0.25, 0.25, 0.4, MT.rubber, lx - 0.1, 1.45, 0.6, 'z')
        roofLamp(c, f - 0.3, 3.1, 0.5)
        roofLamp(c, f - 0.3, 3.1, -0.5)
        c.roundBox(0.5, 0.06, 1.3, 0.02, kit.steelMaterial, f - 0.4, 2.98, 0)
      })
    },
  )

  /* School bus (Volksbus ORE 2 · Caminho da Escola type)
     Reference (FNDE technical specification of the ORE 2 and the VW 15.190 OD chassis; web + memory):
     length 9.30 m (limit 9.0 m + 5%) · width 2.50 m (max 2.60) · height 3.20 m (max 3.80)
     wheelbase 4.60 m · front overhang 1.55 m (max 1.60) · rear 3.15 m (up to 71% of the wheelbase)
     track 2.05 m · tyre 275/80 R22.5 (diameter 1.01 m), dual rear · clearance 0.25 m · 44 seated students or 31 adults
     Signature traits:
     front: all yellow with a black "SCHOOL" sign above the windshield; large windshield split in the middle;
     double round headlights on the corners; barred grille below; front engine cover at the front
     side: double-leaf door right behind the front wheel (within 25 cm of the wheel arch); black band under the windows;
     wide tall windows with square corners; "SCHOOL" on the skirt; front engine and long rear overhang
     rear: tall emergency-exit glass, large "SCHOOL", double round taillights and a black bumper
     top: two emergency hatches; curved-arm mirrors coming out of the roof */
  fx.register(
    {
      key: 'school_bus',
      group: GRP,
      name: trl('vehicles.school_bus.name'),
      inspired: trl('vehicles.school_bus.inspired'),
      category: trl('vehicles.school_bus.category'),
      fuel: 'diesel',
      description: trl('vehicles.school_bus.description'),
      mass: 9200,
      noise: 100,
      seats: trl('vehicles.school_bus.seats'),
      capacity: trl('vehicles.school_bus.capacity'),
      efficiency: trl('vehicles.school_bus.efficiency'),
      range: trl('vehicles.school_bus.range'),
      maxSpeed: 90,
      skill: trl('vehicles.school_bus.skill'),
      hood: true,
    },
    function (c) {
      const W = 2.5,
        f = 4.5,
        rr = -4.5,
        L = f - rr,
        T = { belt: 1.45, top: 3.18, k: 0.035 },
        col = '#e3b11f'
      const ax1 = 3.1,
        ax2 = ax1 - 4.6,
        wr = 0.506,
        ar = 0.62
      const items = [
        [rr, 0.5, 0.1],
        [rr - 0.03, 2.98, 0.22],
        [f - 0.3, 3.16, 0.3],
        [f + 0.02, 2.84, 0.16],
        [f + 0.06, 1.25, 0.12],
        [f + 0.08, 0.55, 0.12],
        [f, 0.48, 0.06],
      ]
      c.meta.color = col
      c.meta.kind = 'bus'
      const ws0 = [f + 0.06, 1.25],
        ws1 = [f + 0.02, 2.84]
      const q = kit.quadDef(lerp2(ws0, ws1, 0.04), lerp2(ws0, ws1, 0.8), W, T, 'front', 0.05, { inset: 0.05, side: 0.12 })
      function win(x0: any, x1: any) {
        return [
          [x0, 1.68],
          [x1, 1.68],
          [x1, 2.62],
          [x0, 2.62],
        ]
      }
      /* double-leaf door behind the front wheel; wide windows */
      const dx1 = ax1 - ar - 0.21,
        dx0 = dx1 - 1.02
      const door = [
        [dx0, 0.62],
        [dx1, 0.62],
        [dx1, 2.62],
        [dx0, 2.62],
      ]
      const winR = [],
        winL = []
      for (let i = 0; i < 5; i++) winR.push(win(-4.25 + i * 1.08, -4.25 + i * 1.08 + 0.96))
      winR.push(win(dx1 + 0.12, ax1 + 0.5))
      winR.push(win(ax1 + 0.6, f - 0.2))
      for (let j = 0; j < 7; j++) winL.push(win(-4.25 + j * 1.1, -4.25 + j * 1.1 + 0.98))
      const drvW = [
        [3.53, 1.68],
        [f - 0.2, 1.68],
        [f - 0.2, 2.62],
        [3.53, 2.62],
      ]
      const hatch = kit.holeBox(
        [f - 0.3, 0.8, -0.6],
        [f + 0.4, 1.2, 0.6],
        function (n: any) {
          return n.x > 0.6
        },
        'lid',
      )
      const holes = [
        kit.holeQuad(q),
        kit.holeSide(door, { side: 1 }),
        kit.holeSide(drvW, { side: -1 }),
        hatch,
        kit.holeBox([rr - 0.3, 1.95, -0.9], [rr + 0.3, 2.62, 0.9], function (n: any) {
          return n.x < -0.6
        }),
      ].concat(
        winR.map(function (p) {
          return kit.holeSide(p, { side: 1 })
        }),
        winL.map(function (p) {
          return kit.holeSide(p, { side: -1 })
        }),
      )
      const body = kit.shell(c, {
        items: items,
        bottomY: 0.48,
        arches: [
          [ax1, wr, ar],
          [ax2, wr, ar],
        ],
        W: W,
        col: col,
        T: T,
        sub: 0.3,
        holes: holes,
        archInner: W / 2 - 0.55,
      })
      kit.glassQuad(c, q, lbl('windshield'))
      c.roundBox(0.06, 1.24, 0.06, 0.02, MT.trim, (q.b[0] + q.t[0]) / 2 + 0.03, (q.b[1] + q.t[1]) / 2, 0)
      kit.sideWindows(
        c,
        winR,
        W,
        T,
        function (i: any) {
          return lbl('window_' + (i + 1))
        },
        { sides: [1] },
      )
      kit.sideWindows(
        c,
        winL,
        W,
        T,
        function (i: any) {
          return lbl('window_' + (i + 1))
        },
        { sides: [-1] },
      )
      kit.sideWindows(
        c,
        [door],
        W,
        T,
        function () {
          return trl('labels.entrance_door')
        },
        { sides: [1] },
      )
      kit.sideWindows(
        c,
        [drvW],
        W,
        T,
        function () {
          return lbl('driver_window')
        },
        { sides: [-1] },
      )
      const rg = c.roundBox(0.02, 0.6, 1.72, 0.04, MT.glass, rr - 0.035, 2.27, 0)
      kit.asGlass(c, rg, lbl('rear_window_emergency_exit'), 'tempered')
      /* door leaves: central split, dark base and balusters */
      const dxc = (dx0 + dx1) / 2,
        dz = W / 2 + 0.02
      c.roundBox(0.04, 1.96, 0.02, 0.01, MT.trim, dxc, 1.62, dz)
      c.roundBox(dx1 - dx0 - 0.06, 0.34, 0.015, 0.01, CM('#2a2c2e'), dxc, 0.8, dz)
      ;[dx0 + 0.1, dx1 - 0.1].forEach(function (hx) {
        c.rod(new V3(hx, 1.1, dz + 0.03), new V3(hx, 2.2, dz + 0.03), 0.014, MT.chrome)
      })
      ;[1, -1].forEach(function (s) {
        const zs = function (y: any) {
          return s * (kit.halfAt(W, T, y) + 0.004)
        }
        const segs =
          s > 0
            ? [
                [rr + 0.1, dx0 - 0.03],
                [dx1 + 0.03, f - 0.1],
              ]
            : [[rr + 0.1, f - 0.1]]
        segs.forEach(function (sg) {
          const cx = (sg[0] + sg[1]) / 2,
            ln = sg[1] - sg[0]
          c.roundBox(ln, 0.24, 0.01, 0.005, CM('#151515', { roughness: 0.6 }), cx, 1.42, zs(1.42))
          c.roundBox(ln, 0.05, 0.01, 0.005, MT.trim, cx, 0.78, zs(0.78))
        })
        c.text('ESCOLAR', 2.1, 0.36, 0.18, 1.16, s * (W / 2 + 0.008), s > 0 ? '+z' : '-z', { fg: '#121212' })
        ;[ax1, ax2].forEach(function (ax) {
          c.roundBox(0.02, 0.5, 0.42, 0.01, MT.rubber, ax - 0.75, 0.32, s * (W / 2 - 0.3))
        })
        ;[-3.6, -0.4, 0.6].forEach(function (x) {
          c.roundBox(0.06, 0.05, 0.015, 0.01, MT.amber, x, 0.95, s * (W / 2 + 0.01))
        })
      })
      /* sign and black front band, rear */
      c.roundBox(0.04, 0.26, 1.7, 0.02, MT.dark, f + 0.0, 2.98, 0)
      c.text('ESCOLAR', 1.5, 0.22, f + 0.025, 2.98, 0, '+x', { fg: '#f2b632', bg: '#0b0b0b', glow: '#e0a020' })
      /* the rear of the shell sits about 6 cm behind rr (rounded corners): texts and band go outside it */
      c.text('ESCOLAR', 1.6, 0.34, rr - 0.08, 1.62, 0, '-x', { fg: '#121212' })
      c.roundBox(0.03, 0.1, W - 0.2, 0.02, CM('#151515'), rr - 0.07, 1.36, 0)
      /* interior: driver over the front engine, rows starting at the door, entrance handrail */
      const fl = 1.02,
        zi = W / 2 - 0.1
      kit.busRows(c, { x0: dx0 - 0.15, x1: -4.15, pitch: 0.64, floor: fl, zIn: zi, aisle: 0.46, col: '#355a7a', ceil: 2.95, seatH: 0.4 })
      kit.dashboard(c, { x: f - 0.05, y: 1.42, w: zi * 2, d: 0.42, h: 0.4, drv: -0.7, mat: CM('#202124'), top: CM('#2a2b2e') })
      kit.steeringWheel(c, f - 0.6, 1.48, -0.7, { r: 0.25, tilt: 1.1, col: 0.45 })
      kit.seat(c, f - 1.05, fl, -0.7, { w: 0.5, mat: CM('#2c2d30', { roughness: 0.85 }), h: 0.45 })
      c.roundBox(0.9, 0.38, 0.5, 0.08, CM('#2a2b2d'), f - 0.6, fl + 0.19, -0.05)
      c.rod(new V3(dx0 - 0.05, fl, zi - 0.35), new V3(dx0 - 0.05, 2.95, zi - 0.35), 0.02, MT.chrome)
      c.roundBox(L - 0.5, 0.02, zi * 2, 0.01, MT.headliner, 0, 2.98, 0).castShadow = false
      const m = c.meta
      Object.assign(m, {
        length: L + 0.15,
        width: W,
        front: f + 0.12,
        rear: rr - 0.03,
        clearance: 0.48,
        belt: 1.45,
        top: 3.18,
        bodyHeight: 1.0,
        tumble: T,
        frontQuad: q,
        roof: { x0: -4.0, x1: 3.7, w: 2.0, y: 3.16 },
        cabLength: 1.6,
      })
      kit.engineBay(c, {
        x0: f - 1.35,
        x1: f + 0.02,
        zw: 0.56,
        floor: 0.5,
        top: 0.98,
        motor: 'diesel',
        col: '#3a3c3e',
        view: { theta: 0.25, phi: 1.12, dist: 4.4 },
      })
      const nD = c.vehicle.children.length
      kit.carDetails(c, {
        lower: items,
        bottomY: 0.48,
        noseY: 0.95,
        tailY: 1.0,
        W: W,
        col: col,
        hl: { style: 'dround', w: 0.46, h: 0.21, y: 0.92, in: 0.1, yaw: 0 },
        tl: { style: 'round2', w: 0.34, h: 0.16, y: 1.05 },
        grille: { style: 'bars', w: 0.95, h: 0.3, y: 1.0, emblem: true },
        wheels: [
          [ax1, wr, 0.32, { rim: RIM_W, spokes: 0, rimR: 0.56, track: 2.05 }],
          [ax2, wr, 0.32, { rim: RIM_W, spokes: 0, rimR: 0.56 }],
        ],
        plateRearY: 0.78,
        noAntenna: true,
      })
      ;[1, -1].forEach(function (s) {
        truckWheel(c, ax2, s * (W / 2 - 0.55), wr, 0.3, { noPart: true, inner: true })
      })
      rearOut(c, nD, rr, 0.08)
      /* front cover hinged at the top: opens to the radiator and the front engine */
      const lid = new THREE.Mesh(kit.geo.crease(body.userData.cut.lid, 42), c.paint(col))
      lid.castShadow = true
      c.vehicle.add(lid)
      c.deform.push(lid)
      const lidObjs = [lid]
      c.vehicle.children.slice(nD).forEach(function (o: any) {
        const p = o.position
        if (o !== lid && p.x > f - 0.05 && Math.abs(p.z) < 0.62 && p.y > 0.8 && p.y < 1.22) lidObjs.push(o)
      })
      kit.hinge(c, lidObjs, new V3(f + 0.1, 1.2, 0), { len: 0.4, open: 1.25, zw: 0.7, label: trl('labels.engine_cover') })
      m.glasshouse = { fb: f, belt: 1.45, Wg: W }
      ;[-0.45, 0.55].forEach(function (z) {
        c.rod(new V3(f + 0.1, 1.32, z - 0.3), new V3(f + 0.09, 2.0, z + 0.05), 0.012, MT.trim)
      })
      ;[1, -1].forEach(function (s) {
        c.tube(
          [
            [f - 0.3, 3.0, s * 1.12],
            [f + 0.25, 2.9, s * 1.2],
            [f + 0.35, 2.35, s * 1.34],
          ],
          0.025,
          MT.trim,
        )
        c.roundBox(0.06, 0.42, 0.24, 0.03, MT.trim, f + 0.35, 2.17, s * 1.36)
        c.roundBox(0.01, 0.38, 0.2, 0.01, MT.chrome, f + 0.32, 2.17, s * 1.36)
      })
      const hatches = [-2.3, 0.8].map(function (x) {
        return c.roundBox(0.7, 0.08, 0.6, 0.03, CM('#c9c4b4'), x, 3.17, 0)
      })
      /* zones: the boarding door is its own zone (the leaves jam and break), the hatches belong to the saloon roof */
      c.zone('boarding_door', trl('labels.boarding_door'), [dx0 - 0.05, dx1 + 0.05, 0.55, 2.7, W / 2 - 0.3, W / 2 + 0.25], null, {
        type: 'panel',
        side: 1,
        fxKey: 'door',
        who: trl('who.whoever_is_boarding'),
      })
      c.zone('saloon_roof', trl('labels.roof_and_hatches'), [-4.4, 4.2, 2.85, 3.4, -W / 2 + 0.42, W / 2 - 0.42], hatches, {
        type: 'roof',
        fxKey: 'roof',
        who: trl('who.whoever_is_seated'),
      })
      m.armor = armorPlus(function (c: any) {
        sandbags(c, -0.8, 0.8, 3.3, 3.4, 'z')
        roofLamp(c, 3.8, 3.45, 0.7)
        roofLamp(c, 3.8, 3.45, -0.7)
      })
    },
  )

  /* Low-floor city bus (Marcopolo Torino G7 type, low floor, rear engine)
     Reference (Torino G7 on a rear-engine chassis of the O-500U type; from memory, checked against launch news):
     length 12.30 m · width 2.50 m · height 3.20 m without air conditioning (3.45 m with it)
     wheelbase 6.40 m · front overhang 2.65 m · rear 3.25 m · track 2.10 m · tyre 275/80 R22.5 (diameter 1.01 m)
     clearance 0.30 m · low floor up to the rear axle, a step up to the saloon over the engine
     Signature traits:
     front: huge almost vertical windshield that goes down to headlight height; integrated amber LED destination sign at the top;
     long thin headlights in a black frame on the lower corners; black lower front with a narrow grille
     side: two wide double-leaf doors on the right (front and middle); large windows with a black band above;
     painted skirt with an orange thread; roof with an air-conditioning box on the front half
     rear: tall rear glass, long vertical taillights, engine cover with horizontal grilles and the line number
     top: air conditioning with fins; curved-arm "rabbit ear" mirrors coming out of the roof */
  fx.register(
    {
      key: 'city_bus',
      group: GRP,
      name: trl('vehicles.city_bus.name'),
      inspired: trl('vehicles.city_bus.inspired'),
      category: trl('vehicles.city_bus.category'),
      fuel: 'diesel',
      description: trl('vehicles.city_bus.description'),
      mass: 11800,
      noise: 105,
      seats: trl('vehicles.city_bus.seats'),
      capacity: trl('vehicles.city_bus.capacity'),
      efficiency: trl('vehicles.city_bus.efficiency'),
      range: trl('vehicles.city_bus.range'),
      maxSpeed: 90,
      skill: trl('vehicles.city_bus.skill'),
      hood: true,
    },
    function (c) {
      const W = 2.5,
        f = 6.0,
        rr = -6.0,
        L = f - rr,
        T = { belt: 1.3, top: 3.18, k: 0.03 },
        col = '#ecece6',
        band = '#1f6f8b',
        acc = '#e07a1f'
      const items = [
        [rr, 0.34, 0.1],
        [rr - 0.02, 2.95, 0.2],
        [rr + 0.3, 3.15, 0.25],
        [f - 0.35, 3.15, 0.3],
        [f + 0.02, 2.82, 0.15],
        [f + 0.1, 0.8, 0.18],
        [f + 0.06, 0.34, 0.08],
      ]
      const m = c.meta
      m.color = col
      m.kind = 'bus'
      const ws0 = [f + 0.1, 0.8],
        ws1 = [f + 0.02, 2.82]
      const q = kit.quadDef(lerp2(ws0, ws1, 0.1), lerp2(ws0, ws1, 0.84), W, T, 'front', 0.05, { inset: 0.04, side: 0.09 })
      const ax1 = 3.55,
        ax2 = -2.85,
        wr = 0.5
      const dF = [
          [f - 1.15, 0.38],
          [f - 0.2, 0.38],
          [f - 0.2, 2.7],
          [f - 1.15, 2.7],
        ],
        dM = [
          [0.55, 0.38],
          [1.85, 0.38],
          [1.85, 2.7],
          [0.55, 2.7],
        ]
      const drv = [
        [f - 1.2, 1.3],
        [f - 0.25, 1.3],
        [f - 0.25, 2.66],
        [f - 1.2, 2.66],
      ]
      function strip(x0: any, x1: any, pitch: any) {
        const out = []
        for (let x = x0; x < x1 - 0.3; x += pitch)
          out.push([
            [x, 1.32],
            [Math.min(x + pitch - 0.1, x1), 1.32],
            [Math.min(x + pitch - 0.1, x1), 2.66],
            [x, 2.66],
          ])
        return out
      }
      const winR = strip(-5.6, 0.45, 1.5).concat(strip(1.95, f - 1.25, 1.4)),
        winL = strip(-5.6, f - 1.3, 1.5)
      const hatch = kit.holeBox(
        [rr - 0.3, 0.64, -0.95],
        [rr + 0.3, 1.4, 0.95],
        function (n: any) {
          return n.x < -0.6
        },
        'lid',
      )
      const holes = [
        kit.holeQuad(q),
        hatch,
        kit.holeSide(dF, { side: 1 }),
        kit.holeSide(dM, { side: 1 }),
        kit.holeSide(drv, { side: -1 }),
        kit.holeBox([rr - 0.3, 2.0, -0.85], [rr + 0.3, 2.75, 0.85], function (n: any) {
          return n.x < -0.6
        }),
      ].concat(
        winR.map(function (p) {
          return kit.holeSide(p, { side: 1 })
        }),
        winL.map(function (p) {
          return kit.holeSide(p, { side: -1 })
        }),
      )
      const body = kit.shell(c, {
        items: items,
        bottomY: 0.34,
        arches: [
          [ax1, wr, 0.6],
          [ax2, wr, 0.6],
        ],
        W: W,
        col: col,
        T: T,
        sub: 0.32,
        holes: holes,
        archInner: W / 2 - 0.58,
      })
      kit.glassQuad(c, q, lbl('windshield'))
      kit.sideWindows(
        c,
        winR,
        W,
        T,
        function (i: any) {
          return lbl('window_' + (i + 1))
        },
        { sides: [1] },
      )
      kit.sideWindows(
        c,
        winL,
        W,
        T,
        function (i: any) {
          return lbl('window_' + (i + 1))
        },
        { sides: [-1] },
      )
      kit.sideWindows(
        c,
        [dF],
        W,
        T,
        function () {
          return trl('labels.front_door')
        },
        { sides: [1] },
      )
      kit.sideWindows(
        c,
        [dM],
        W,
        T,
        function () {
          return trl('labels.middle_door')
        },
        { sides: [1] },
      )
      kit.sideWindows(
        c,
        [drv],
        W,
        T,
        function () {
          return lbl('driver_window')
        },
        { sides: [-1] },
      )
      const rg = c.roundBox(0.02, 0.68, 1.64, 0.04, MT.tint, rr - 0.03, 2.37, 0)
      kit.asGlass(c, rg, lbl('rear_window'), 'tempered')
      /* doors: leaves with a central split and dark base; paint: skirt band, orange thread, black window band */
      ;[dF, dM].forEach(function (d) {
        const xc = (d[0][0] + d[1][0]) / 2,
          zz = W / 2 + 0.02
        c.roundBox(0.04, 2.3, 0.02, 0.01, MT.trim, xc, 1.54, zz)
        c.roundBox(d[1][0] - d[0][0] - 0.06, 0.6, 0.015, 0.01, CM('#2a2c2e'), xc, 0.72, zz)
        ;[d[0][0] + 0.12, d[1][0] - 0.12].forEach(function (hx) {
          c.rod(new V3(hx, 1.1, zz + 0.03), new V3(hx, 2.1, zz + 0.03), 0.014, MT.chrome)
        })
      })
      ;[1, -1].forEach(function (s) {
        const zs = function (y: any) {
          return s * (kit.halfAt(W, T, y) + 0.004)
        }
        const segs =
          s > 0
            ? [
                [rr + 0.1, 0.5],
                [1.9, f - 1.2],
              ]
            : [[rr + 0.1, f - 0.1]]
        segs.forEach(function (sg) {
          const cx = (sg[0] + sg[1]) / 2,
            ln = sg[1] - sg[0]
          c.roundBox(ln, 0.52, 0.012, 0.01, c.paint(band), cx, 0.7, zs(0.7))
          c.roundBox(ln, 0.06, 0.012, 0.005, c.paint(acc), cx, 1.02, zs(1.02))
        })
        const sg2 =
          s > 0
            ? [
                [rr + 0.05, 0.5],
                [1.9, f - 1.18],
              ]
            : [[rr + 0.05, f - 1.22]]
        sg2.forEach(function (sg) {
          c.roundBox(sg[1] - sg[0], 0.1, 0.012, 0.005, CM('#111214', { roughness: 0.4 }), (sg[0] + sg[1]) / 2, 2.75, zs(2.75))
        })
        c.text(trl('texts.line_207'), 1.2, 0.2, s > 0 ? 3.0 : -3.4, 2.93, zs(2.93) + s * 0.003, s > 0 ? '+z' : '-z', {
          fg: '#ffb02e',
          bg: '#0b0b0b',
          glow: '#e09020',
        })
        ;[ax1, ax2].forEach(function (ax) {
          c.roundBox(0.02, 0.38, 0.4, 0.01, MT.rubber, ax - 0.68, 0.28, s * (W / 2 - 0.3))
        })
        c.roundBox(0.06, 0.05, 0.015, 0.01, MT.amber, -1.5, 0.55, zs(0.55))
        c.roundBox(0.06, 0.05, 0.015, 0.01, MT.amber, 2.5, 0.55, zs(0.55))
      })
      /* front LED destination sign, black front and headlights */
      const fx = function (y: any) {
        return kit.profX(items, y, true)
      }
      /* LED destination sign right above the windshield, on the same dark glass band */
      c.roundBox(0.04, 0.3, 1.8, 0.03, MT.dark, fx(2.67) + 0.06, 2.67, 0)
      c.text(trl('texts.n_207_downtown'), 1.5, 0.22, fx(2.67) + 0.084, 2.67, 0, '+x', { fg: '#ffb02e', bg: '#060606', glow: '#e09020' })
      c.roundBox(0.05, 0.42, W - 0.12, 0.08, CM('#16181a', { roughness: 0.5 }), fx(0.6) + 0.0, 0.6, 0)
      const mt = c.paint(band)
      c.roundBox(0.03, 0.06, W - 0.4, 0.02, mt, fx(0.86) + 0.02, 0.86, 0)
      /* interior: low floor up to the rear axle, a step up to the rear saloon over the engine */
      const fl = 0.45,
        zi = W / 2 - 0.1,
        pole = CM('#e0a21c', { roughness: 0.4, metalness: 0.2 })
      kit.busRows(c, { x0: 3.3, x1: 2.3, pitch: 0.75, floor: fl, zIn: zi, aisle: 0.55, col: '#3e4a8a', ceil: 2.95, seatH: 0.44, mat: pole })
      kit.busRows(c, {
        x0: 0.0,
        x1: -1.6,
        pitch: 0.75,
        floor: fl,
        zIn: zi,
        aisle: 0.55,
        col: '#3e4a8a',
        ceil: 2.95,
        seatH: 0.44,
        mat: pole,
      })
      kit.busRows(c, {
        x0: -3.2,
        x1: -5.3,
        pitch: 0.72,
        floor: 0.92,
        zIn: zi,
        aisle: 0.5,
        col: '#3e4a8a',
        ceil: 2.95,
        seatH: 0.42,
        mat: pole,
      })
      c.roundBox(0.25, 0.47, zi * 2, 0.02, MT.carpet, -2.45, 0.68, 0)
      c.roundBox(L - 0.5, 0.02, zi * 2, 0.01, MT.headliner, 0, 3.0, 0).castShadow = false
      ;[1.0, 1.5, -2.2].forEach(function (x) {
        c.rod(new V3(x, fl, 0), new V3(x, 2.95, 0), 0.018, pole)
      })
      kit.dashboard(c, { x: fx(1.3) - 0.08, y: 1.3, w: 1.2, d: 0.5, h: 0.5, drv: -0.68, mat: CM('#1d1e20'), top: CM('#2a2b2e') })
      kit.steeringWheel(c, f - 0.62, 1.38, -0.68, { r: 0.25, tilt: 1.15, col: 0.4 })
      kit.seat(c, f - 1.15, 0.6, -0.68, { w: 0.5, mat: CM('#2c2d30', { roughness: 0.85 }), h: 0.46 })
      /* turnstile and fare collector */
      c.roundBox(0.4, 0.95, 0.32, 0.05, CM('#9aa0a4', { metalness: 0.5 }), 3.95, fl + 0.48, -0.55)
      ;[0, 2.09, 4.19].forEach(function (a) {
        c.rod(
          new V3(3.95, fl + 0.9, -0.37),
          new V3(3.95 + Math.cos(a) * 0.32, fl + 0.9 + Math.sin(a) * 0.32 * 0.4, -0.37 + Math.abs(Math.sin(a)) * 0.2),
          0.02,
          MT.chrome,
        )
      })
      kit.seat(c, 3.95, fl + 0.15, -0.95, { w: 0.42, mat: CM('#3e4a8a', { roughness: 0.85 }), h: 0.45, back: 0.5, dir: 1 })
      Object.assign(m, {
        length: L + 0.12,
        width: W,
        front: f + 0.12,
        rear: rr - 0.02,
        clearance: 0.34,
        belt: 1.3,
        top: 3.18,
        bodyHeight: 1.0,
        tumble: T,
        frontQuad: q,
        roof: { x0: -5.6, x1: 1.0, w: 2.0, y: 3.17 },
      })
      mirrorBay(
        c,
        {
          x0: rr + 0.0,
          x1: rr + 1.35,
          zw: 0.85,
          floor: 0.4,
          top: 0.86,
          motor: 'diesel',
          col: '#3a3c3e',
          view: { theta: PI - 0.3, phi: 1.12, dist: 4.6 },
        },
        rr + 0.67,
      )
      const nD0 = c.vehicle.children.length
      kit.carDetails(c, {
        lower: items,
        bottomY: 0.34,
        noseY: 0.92,
        tailY: 1.6,
        W: W,
        col: col,
        hl: { style: 'split', w: 0.5, h: 0.22, y: 0.85, in: 0.1, yaw: 0.12 },
        tl: { style: 'vertical', w: 0.22, h: 0.5, y: 1.62, in: 0.04 },
        grille: { style: 'mesh', w: 0.9, h: 0.18, y: 0.55, emblem: true },
        wheels: [
          [ax1, wr, 0.3, { rim: RIM_S, spokes: 0, rimR: 0.56, track: 2.1 }],
          [ax2, wr, 0.3, { rim: RIM_S, spokes: 0, rimR: 0.56 }],
        ],
        plateRearY: 1.55,
        noAntenna: true,
        noRadiator: true,
      })
      ;[1, -1].forEach(function (s) {
        truckWheel(c, ax2, s * (W / 2 - 0.52), wr, 0.28, { noPart: true, inner: true })
      })
      rearOut(c, nD0, rr, 0.08)
      /* roof air conditioning */
      const ac = [c.roundBox(3.0, 0.26, 1.9, 0.12, c.paint(col), 3.3, 3.25, 0)]
      for (let k = 0; k < 6; k++) ac.push(c.roundBox(0.3, 0.02, 1.5, 0.01, MT.trim, 2.1 + k * 0.48, 3.39, 0))
      /* zones: the air conditioning is a part that bends and comes off; the two boarding doors have their own zone */
      c.zone('air_conditioner', trl('labels.roof_air_conditioner'), [1.7, 4.9, 3.1, 3.45, -1.0, 1.0], ac, {
        type: 'part',
        fxKey: 'roof',
        weight: 0.5,
        anchor: [3.3, 3.12, 0],
      })
      ;[
        [dF, 'front_door', trl('labels.front_door'), 'porta_dianteira'],
        [dM, 'middle_door', trl('labels.middle_door'), 'porta_central'],
      ].forEach(function (P) {
        const d: any = P[0]
        c.zone(P[1], P[2], [d[0][0] - 0.05, d[1][0] + 0.05, 0.3, 2.78, W / 2 - 0.3, W / 2 + 0.25], null, {
          type: 'panel',
          side: 1,
          fxKey: 'door',
          who: trl('who.whoever_is_boarding'),
        })
      })
      ;[1, -1].forEach(function (s) {
        c.tube(
          [
            [f - 0.25, 3.05, s * 1.1],
            [f + 0.4, 3.0, s * 1.22],
            [f + 0.55, 2.55, s * 1.32],
          ],
          0.025,
          MT.trim,
        )
        c.roundBox(0.06, 0.45, 0.24, 0.03, MT.trim, f + 0.55, 2.35, s * 1.34)
        c.roundBox(0.01, 0.4, 0.2, 0.01, MT.chrome, f + 0.52, 2.35, s * 1.34)
      })
      ;[-0.5, 0.5].forEach(function (z) {
        c.rod(new V3(fx(1.0) + 0.05, 1.0, z - 0.3), new V3(fx(1.6) + 0.04, 1.75, z + 0.1), 0.012, MT.trim)
      })
      /* rear engine cover (hinge at the top) and diesel engine behind */
      const lid = new THREE.Mesh(kit.geo.crease(body.userData.cut.lid, 42), c.paint(col))
      lid.castShadow = true
      c.vehicle.add(lid)
      c.deform.push(lid)
      const lidObjs = [lid]
      for (let g = 0; g < 5; g++) lidObjs.push(c.roundBox(0.03, 0.045, 1.5, 0.015, MT.trim, rr - 0.075, 0.74 + g * 0.1, 0))
      lidObjs.push(c.text('207', 0.5, 0.2, rr - 0.09, 1.28, 0, '-x', { fg: '#ffb02e', bg: '#060606', glow: '#e09020' }))
      kit.hinge(c, lidObjs, new V3(rr - 0.03, 1.42, 0), { len: -0.4, open: 1.2, sign: -1, zw: 0.8, label: trl('labels.engine_cover') })
      m.glasshouse = { fb: f, belt: 1.3, Wg: W }
      c.parts.forEach(function (p: any) {
        if (p.kind === 'radiator') p.pos.set(rr + 0.3, 0.7, 0)
      })
      m.armor = armorPlus(function (c: any) {
        sandbags(c, -1.6, 0.6, 3.3, -0.5, 'x')
        roofLamp(c, f - 0.2, 3.38, 0.7)
        roofLamp(c, f - 0.2, 3.38, -0.7)
      })
    },
  )

  /* Armoured cash truck (Mercedes-Benz Atego 1719 type with an armoured cash-in-transit body)
     Reference (Atego 1719 wheelbase 4.17 m and national cash-truck bodies; web + memory):
     length 7.60 m · cab width 2.30 m, vault 2.40 m · cab height 2.90 m, vault 3.10 m
     wheelbase 4.20 m · front overhang 1.49 m · rear 1.95 m · track 1.95 m · tyre 275/80 R22.5 (diameter 1.01 m)
     clearance 0.26 m · level III-A armour on the vault and the cab
     Signature traits:
     front: grille with three horizontal chrome bars and a large generic star in the centre; rectangular headlights at the
     bumper ends, slightly turned outward; tall flat front with side creases
     side: cab with a low corner window; smooth riveted steel vault with round gun ports, armoured viewer,
     yellow "VALUABLES" band; no box trim
     rear: single armoured door with a viewer, heavy hinges and a chrome lock
     top: round hatch, amber light bar and radio antennas */
  fx.register(
    {
      key: 'armored_truck',
      group: GRP,
      name: trl('vehicles.armored_truck.name'),
      inspired: trl('vehicles.armored_truck.inspired'),
      category: trl('vehicles.armored_truck.category'),
      fuel: 'diesel',
      description: trl('vehicles.armored_truck.description'),
      mass: 11500,
      noise: 90,
      seats: trl('vehicles.armored_truck.seats'),
      capacity: trl('vehicles.armored_truck.capacity'),
      efficiency: trl('vehicles.armored_truck.efficiency'),
      range: trl('vehicles.armored_truck.range'),
      maxSpeed: 100,
      skill: trl('vehicles.armored_truck.skill'),
      hood: true,
    },
    function (c) {
      const f = 3.75,
        W = 2.32,
        len = 1.85,
        ax = 2.5,
        wr = 0.506,
        ww = 0.28,
        col = '#56616b'
      c.meta.bullet = true
      c.meta.cabLength = len + 0.15
      c.meta.bodyLabel = trl('labels.vault')
      const cabO = {
        model: 'atego',
        f: f,
        W: W,
        len: len,
        roof: 2.9,
        belt: 1.86,
        bot: 0.74,
        floor: 1.3,
        ax: ax,
        wr: wr,
        ww: ww,
        col: col,
        int: '#2c2e2a',
        glass: MT.armorGlass,
        glassType: 'laminated',
        glassLabel: lbl('armored_windshield'),
        bumperY: 0.88,
        bumperH: 0.4,
      }
      const n0 = c.vehicle.children.length,
        cab = cabOver(c, cabO),
        cabObjs = c.vehicle.children.slice(n0)
      cabFront(c, cabO, cab)
      kit.engineBay(c, { x0: f - len + 0.1, x1: f - 0.45, zw: 0.42, floor: 0.45, top: 1.24, motor: 'diesel', col: '#3a3c3e' })
      tiltCab(c, cabObjs, new V3(f - 0.02, 1.05, 0), { len: len, open: 1.15 })
      const rear = -3.65
      chassis(c, {
        f: f - 0.1,
        rear: rear,
        W: W,
        railY: 0.86,
        axles: [-1.7],
        wr: wr,
        ww: ww,
        tankX: 0.75,
        tankSide: -1,
        mud: true,
        lightsY: 0.72,
      })
      const bx0 = f - len - 0.06
      boxBody(c, { x0: bx0, x1: rear + 0.05, y0: 1.1, y1: 3.08, W: 2.4, col: '#5d6a74', armored: true, label: trl('labels.armored_vault') })
      const plate = CM('#3f474e', { metalness: 0.55, roughness: 0.45 })
      ;[1, -1].forEach(function (s) {
        const zs = s * (1.2 + 0.012)
        ;[-2.6, -1.5, -0.4, 0.7].forEach(function (x) {
          c.cylinder(0.13, 0.13, 0.03, plate, x, 2.1, zs, 'z', { seg: 20 })
          c.cylinder(0.04, 0.04, 0.04, MT.dark, x, 2.1, zs + s * 0.006, 'z', { seg: 12 })
        })
        const vg = c.roundBox(0.32, 0.2, 0.03, 0.03, MT.armorGlass, 1.3, 2.45, zs)
        kit.asGlass(c, vg, s > 0 ? lbl('right_armored_viewport') : lbl('left_armored_viewport'), 'laminated')
        c.roundBox(0.4, 0.28, 0.02, 0.03, plate, 1.3, 2.45, zs - s * 0.004)
        for (let x = rear + 0.2; x < bx0; x += 0.3) {
          c.sphere(0.018, MT.steel, x, 1.2, zs)
          c.sphere(0.018, MT.steel, x, 2.98, zs)
        }
        c.roundBox(5.3, 0.36, 0.01, 0.01, CM('#e0b81c', { roughness: 0.5 }), -1.0, 1.55, zs + s * 0.002)
        c.text('VALORES', 1.6, 0.3, -1.0, 1.55, zs + s * 0.012, s > 0 ? '+z' : '-z', { fg: '#121212' })
        c.roundBox(0.5, 0.05, 0.25, 0.01, MT.steel, rear + 0.6, 0.62, s * 1.05)
      })
      /* armoured rear door with a viewer and heavy hinges */
      const rx = rear + 0.04
      const rgs = c.roundBox(0.03, 0.18, 0.28, 0.03, MT.armorGlass, rx - 0.03, 2.5, 0.45)
      kit.asGlass(c, rgs, lbl('rear_viewport'), 'laminated')
      ;[1.4, 2.6].forEach(function (y) {
        c.roundBox(0.08, 0.22, 0.14, 0.03, MT.steel, rx - 0.04, y, -0.99)
      })
      c.roundBox(0.07, 0.4, 0.06, 0.02, MT.chrome, rx - 0.05, 2.0, 0.55)
      /* roof: hatch, siren, amber light bar and antennas */
      c.cylinder(0.36, 0.38, 0.1, plate, -1.3, 3.13, 0)
      c.cylinder(0.3, 0.3, 0.05, MT.steel, -1.3, 3.2, 0)
      c.roundBox(0.2, 0.08, 1.3, 0.03, MT.trim, bx0 - 0.25, 3.13, 0)
      ;[-0.45, 0, 0.45].forEach(function (z) {
        c.roundBox(0.14, 0.08, 0.3, 0.03, MT.amber, bx0 - 0.25, 3.2, z)
      })
      c.rod(new V3(-2.5, 3.08, 0.6), new V3(-2.5, 3.6, 0.6), 0.008, MT.trim)
      c.rod(new V3(-2.8, 3.08, -0.6), new V3(-2.8, 3.4, -0.6), 0.01, MT.trim)
      const m = c.meta
      m.front = f + 0.24
      m.length = m.front - rear
      m.top = 3.08
      m.belt = 1.86
      m.bodyHeight = 1.4
      m.clearance = 0.45
      m.armor = armorPlus(function (c: any) {
        /* roof watchtower with a shield and a spotlight */
        c.cylinder(0.42, 0.42, 0.35, kit.steelMaterial, -1.3, 3.35, 0, null, { seg: 20, open: true })
        c.roundBox(0.06, 0.45, 0.8, 0.03, kit.steelMaterial, -0.85, 3.5, 0, { rot: [0, 0, -0.2] })
        roofLamp(c, -0.75, 3.9, 0)
        for (let x = -3.2; x <= 1.4; x += 0.4)
          [1, -1].forEach(function (s) {
            const sp = c.add(new THREE.ConeGeometry(0.035, 0.25, 8), MT.steel, x, 1.25, s * 1.33)
            sp.rotation.x = (s * PI) / 2
          })
      })
    },
  )

  /* Farm tractor (Massey Ferguson 275 type)
     Reference (tractordata and ritchiespecs, MF 275 with a 4-cylinder Perkins; web):
     length 3.70 m with weights · width 1.99 m · height 2.65 m at the canopy, 1.72 m at the wheel, 1.57 m at the hood
     wheelbase 2.07 m · rear track 1.52 m, front 1.48 m · rear tyre 18.4-30 (diameter 1.58 m), front 7.50-16 (diameter 0.80 m)
     clearance 0.40 m · mass 2,770 to 3,000 kg in running order · tank 68 to 80 L
     Signature traits:
     front: black grille of bars inside a red frame, rectangular headlights on the upper corners of the grille, white
     thread at the top; plate weight bracket at the tip
     side: long straight red hood with a white thread and "275"; grey chassis and engine in view; vertical exhaust
     on the right and air pre-cleaner on the left coming out of the hood; rear wheels with V lugs
     rear: wide flat-topped fenders with lights; three-point hitch, drawbar and power take-off
     top: protective arch with a light canopy over the seat */
  fx.register(
    {
      key: 'tractor',
      group: 'agricultural',
      name: trl('vehicles.tractor.name'),
      inspired: trl('vehicles.tractor.inspired'),
      category: trl('vehicles.tractor.category'),
      fuel: 'diesel',
      description: trl('vehicles.tractor.description'),
      mass: 3100,
      noise: 90,
      seats: trl('vehicles.tractor.seats'),
      capacity: trl('vehicles.tractor.capacity'),
      efficiency: trl('vehicles.tractor.efficiency'),
      range: trl('vehicles.tractor.range'),
      maxSpeed: 28,
      skill: trl('vehicles.tractor.skill'),
      hood: true,
    },
    function (c) {
      const col = '#b3251d',
        gray = CM('#3d3f42', { roughness: 0.55, metalness: 0.3 }),
        dgray = CM('#2b2c2e', { roughness: 0.6, metalness: 0.3 }),
        paint = c.paint(col)
      const rimY = CM('#9c9b95', { metalness: 0.35, roughness: 0.5 }),
        m = c.meta
      m.color = col
      m.kind = 'tractor'
      const rx = -0.95,
        fxA = 1.12,
        rR = 0.79,
        fR = 0.4,
        rz = 0.75,
        FX = -0.24
      /* wheels: rear 18.4-30 with V lugs, front 7.50-16 with a rib */
      ;[1, -1].forEach(function (s) {
        const rw = c.wheel(rx, s * rz, rR, 0.46, {
          lugs: true,
          chevron: true,
          rim: rimY,
          spokes: 0,
          rimR: 0.6,
          label: s > 0 ? trl('labels.rear_right_tire') : trl('labels.rear_left_tire'),
        })
        /* disc rim with eight oval holes and a dark hub, like the original wheel set */
        for (let hk = 0; hk < 8; hk++) {
          const ha = (hk / 8) * PI * 2
          c.cylinder(0.05, 0.05, 0.012, MT.dark, Math.cos(ha) * rR * 0.36, Math.sin(ha) * rR * 0.36, s * 0.46 * 0.392, 'z', {
            parent: rw,
            seg: 12,
          })
        }
        c.wheel(fxA, s * 0.74, fR, 0.2, {
          rim: rimY,
          spokes: 0,
          rimR: 0.55,
          label: s > 0 ? trl('labels.front_right_tire') : trl('labels.front_left_tire'),
        })
        for (let r = 0; r < 3; r++) {
          const rg = c.add(new THREE.TorusGeometry(fR - 0.004, 0.012, 6, 30), MT.rubber, fxA, fR, s * 0.74 + (r - 1) * 0.055)
          rg.castShadow = false
        }
      })
      /* oscillating front axle, engine block and transmission (grey monocoque chassis) */
      c.roundBox(0.16, 0.14, 1.5, 0.04, gray, fxA, fR + 0.02, 0)
      c.roundBox(0.25, 0.2, 0.25, 0.05, gray, fxA, fR + 0.14, 0)
      c.roundBox(1.6, 0.46, 0.5, 0.08, gray, 0.35, 0.82, 0)
      c.roundBox(1.0, 0.6, 0.62, 0.1, dgray, -0.75, 0.8, 0)
      c.roundBox(0.5, 0.36, 1.25, 0.08, dgray, rx, rR, 0)
      for (let b = 0; b < 4; b++) c.cylinder(0.05, 0.05, 0.06, MT.steel, -0.1 + b * 0.3, 0.86, 0.27)
      /* front weights */
      c.roundBox(0.12, 0.28, 0.66, 0.03, gray, 1.92 + FX, 0.62, 0)
      for (let w = 0; w < 8; w++) c.roundBox(0.12, 0.3, 0.075, 0.025, dgray, 2.03 + FX, 0.62, -0.315 + w * 0.09)
      c.roundBox(0.06, 0.06, 0.8, 0.02, MT.steel, 2.1 + FX, 0.62, 0)
      /* long hood with open sides */
      const hx0 = 0.02,
        hx1 = 1.84 + FX,
        hy = 1.48
      ;[1, -1].forEach(function (s) {
        c.roundBox(hx1 - hx0, 0.38, 0.035, 0.02, paint, (hx0 + hx1) / 2, 1.22, s * 0.36, { def: true })
        for (let j = 0; j < 5; j++) c.roundBox(0.22, 0.025, 0.012, 0.008, MT.dark, 0.75 + j * 0.16, 1.24, s * 0.38)
        c.roundBox(1.0, 0.03, 0.02, 0.01, CM('#e9e6dd'), 0.55, 1.36, s * 0.38)
        c.text('275', 0.3, 0.14, 0.32, 1.2, s * 0.384, s > 0 ? '+z' : '-z', { fg: '#f2efe6' })
      })
      /* front grille and headlights */
      const grl = c.roundBox(0.07, 0.62, 0.76, 0.04, paint, 1.88 + FX, 1.16, 0, { def: true })
      c.roundBox(0.03, 0.46, 0.56, 0.02, MT.housing, 1.915 + FX, 1.12, 0)
      for (let k = 0; k < 7; k++) c.roundBox(0.02, 0.022, 0.54, 0.006, MT.chrome, 1.93 + FX, 0.92 + k * 0.066, 0)
      c.roundBox(0.02, 0.06, 0.4, 0.01, CM('#e9e6dd'), 1.93 + FX, 1.42, 0)
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.1, 0.16, 0.12, 0.03, paint, 1.84 + FX, 1.38, s * 0.32)
        kit.headlight(c, { style: 'rect', x: 1.9 + FX, y: 1.38, z: s * 0.32, w: 0.12, h: 0.12, d: 0.06, side: s })
      })
      const hood = c.roundBox(hx1 - hx0, 0.12, 0.8, 0.06, paint, (hx0 + hx1) / 2, hy, 0, { taper: { sz: 0.94 }, def: true, sub: 0.15 })
      const hoodObjs = [hood, c.roundBox(hx1 - hx0 - 0.1, 0.012, 0.06, 0.005, CM('#e9e6dd'), (hx0 + hx1) / 2, hy + 0.062, 0)]
      kit.hinge(c, hoodObjs, new V3(hx0, hy - 0.04, 0), { len: hx1 - hx0, open: 1.0, zw: 0.38 })
      kit.engineBay(c, {
        x0: hx0 + 0.04,
        x1: hx1 - 0.04,
        zw: 0.32,
        floor: 0.98,
        top: hy - 0.08,
        motor: 'diesel',
        col: col,
        turbo: false,
        label: trl('labels.naturally_aspirated_4_cylinder_diesel_engine'),
      })
      /* vertical exhaust (right) and air pre-cleaner (left) coming out of the hood */
      c.cylinder(0.05, 0.06, 1.0, MT.trim, 1.3, 1.95, 0.24)
      c.cylinder(0.07, 0.05, 0.1, MT.trim, 1.3, 2.47, 0.24)
      c.roundBox(0.16, 0.012, 0.16, 0.005, MT.trim, 1.3, 2.53, 0.24, { rot: [0, 0, 0.5] })
      c.cylinder(0.05, 0.05, 0.5, dgray, 1.3, 1.75, -0.24)
      c.cylinder(0.1, 0.1, 0.24, CM('#2a2c2e', { roughness: 0.3 }), 1.3, 2.1, -0.24)
      c.cylinder(0.11, 0.11, 0.03, MT.trim, 1.3, 2.23, -0.24)
      /* dashboard, wheel, platform, seat, levers */
      const stationCount = c.vehicle.children.length
      c.roundBox(0.22, 0.5, 0.6, 0.06, paint, -0.03, 1.42, 0, { def: true })
      c.roundBox(0.03, 0.2, 0.36, 0.02, MT.trim, -0.15, 1.58, 0)
      c.cylinder(0.05, 0.05, 0.012, MT.gauge, -0.165, 1.6, -0.1, 'x')
      c.cylinder(0.05, 0.05, 0.012, MT.gauge, -0.165, 1.6, 0.1, 'x')
      kit.steeringWheel(c, -0.38, 1.66, 0, { r: 0.2, tilt: 1.0, col: 0.42, mat: MT.trim })
      c.roundBox(1.0, 0.05, 0.94, 0.02, CM('#5c5f62', { metalness: 0.5 }), -0.7, 1.12, 0)
      kit.seat(c, -1.0, 1.35, 0, { w: 0.5, h: 0.16, back: 0.44, lean: 0.12, mat: MT.seat, headrest: false })
      c.roundBox(0.3, 0.2, 0.3, 0.04, dgray, -1.0, 1.28, 0)
      ;[
        [0.25, 1],
        [0.38, -1],
      ].forEach(function (p) {
        c.rod(new V3(-0.75, 1.15, p[1] * p[0]), new V3(-0.6, 1.7, p[1] * (p[0] + 0.05)), 0.015, MT.trim)
        c.sphere(0.035, MT.postRed, -0.6, 1.72, p[1] * (p[0] + 0.05))
      })
      /* operator station: seat, wheel, dashboard and levers (without the platform); the arch and canopy have their own zone */
      const stationParts = c.vehicle.children.slice(stationCount).filter(function (o: any) {
        return !(o.isMesh && o.position.y < 1.16 && Math.abs(o.position.x + 0.7) < 0.01)
      })
      /* rear fenders with a flat top, lights and work lights */
      ;[1, -1].forEach(function (s) {
        const fen = c.add(new THREE.CylinderGeometry(rR + 0.1, rR + 0.1, 0.5, 30, 2, true, PI / 2 - 0.1, PI + 0.2), paint, rx, rR, s * rz)
        fen.rotation.x = PI / 2
        c.deform.push(fen)
        c.roundBox(1.0, 0.04, 0.52, 0.02, paint, rx + 0.05, rR * 2 + 0.12, s * rz, { def: true })
        c.roundBox(1.0, 0.36, 0.04, 0.02, paint, rx + 0.05, 1.3, s * (rz - 0.27), { def: true })
        kit.taillight(c, { style: 'vertical', x: rx - 0.55, y: rR * 2 - 0.05, z: s * (rz + 0.08), w: 0.1, h: 0.14, d: 0.05, side: s })
        /* fender work light: a simple part, so the headlight zone stays only on the grille */
        c.roundBox(0.07, 0.11, 0.13, 0.025, MT.trim, rx + 0.47, rR * 2 + 0.22, s * (rz + 0.13))
        c.roundBox(0.012, 0.085, 0.105, 0.01, MT.head, rx + 0.508, rR * 2 + 0.22, s * (rz + 0.13))
      })
      /* protective arch (ROPS) with a canopy */
      const rops = []
      ;[1, -1].forEach(function (s) {
        rops.push(c.rod(new V3(-1.32, 1.1, s * 0.62), new V3(-1.32, 2.62, s * 0.6), 0.045, MT.trim))
        rops.push(c.rod(new V3(-1.32, 1.6, s * 0.6), new V3(-1.32, 1.6, s * 0.32), 0.03, MT.trim))
      })
      rops.push(c.rod(new V3(-1.32, 2.62, -0.6), new V3(-1.32, 2.62, 0.6), 0.045, MT.trim))
      const can = c.roundBox(1.15, 0.06, 1.35, 0.03, CM('#e3dfd3', { roughness: 0.7 }), -0.88, 2.66, 0)
      rops.push(can)
      rops.push(c.rod(new V3(-0.32, 2.64, -0.6), new V3(-0.32, 2.64, 0.6), 0.02, MT.trim))
      ;[1, -1].forEach(function (s) {
        rops.push(c.rod(new V3(-1.32, 2.6, s * 0.6), new V3(-0.32, 2.62, s * 0.6), 0.02, MT.trim))
      })
      /* three-point hitch, drawbar and PTO */
      ;[1, -1].forEach(function (s) {
        c.rod(new V3(-1.3, 0.72, s * 0.32), new V3(-1.95, 0.5, s * 0.42), 0.035, dgray)
        c.rod(new V3(-1.35, 1.0, s * 0.3), new V3(-1.55, 0.7, s * 0.35), 0.02, MT.steel)
        c.sphere(0.05, MT.steel, -1.95, 0.5, s * 0.42)
      })
      c.rod(new V3(-1.3, 1.15, 0), new V3(-1.9, 0.98, 0), 0.03, dgray)
      c.roundBox(0.7, 0.06, 0.16, 0.02, dgray, -1.55, 0.42, 0)
      c.cylinder(0.035, 0.035, 0.25, MT.steel, -1.4, 0.62, 0, 'x')
      c.roundBox(0.2, 0.12, 0.22, 0.03, CM('#c9a227'), -1.38, 0.68, 0)
      Object.assign(m, {
        length: 3.75,
        width: 2.0,
        front: 1.88,
        rear: -1.87,
        clearance: 0.42,
        belt: 1.45,
        top: 2.7,
        bodyHeight: 0.9,
        roof: { x0: -1.4, x1: -0.35, w: 1.3, y: 2.7 },
      })
      const ghost = c.roundBox(1.0, 1.25, 1.2, 0.05, MT.hole, -0.85, 2.0, 0)
      ghost.visible = false
      ghost.userData.ghost = true
      c.glass.push(ghost)
      c.part('fuel_tank', trl('labels.diesel_tank'), null, new V3(-0.1, 1.45, 0), 0.7)
      void can
      void grl
      /* zones: the protective arch with the canopy is a part that bends and comes off; the vertical exhaust is separate */
      c.zone('operator_station', trl('labels.operator_station'), [-1.45, -0.05, 1.05, 2.0, -0.46, 0.46], stationParts, {
        type: 'part',
        dir: [0, -1, 0],
        fxKey: 'cab',
        who: trl('who.the_tractor_driver'),
        anchor: [-0.7, 1.15, 0],
      })
      c.zone('arch', trl('labels.roll_bar_and_awning'), [-1.45, -0.2, 1.55, 2.78, -0.75, 0.75], rops, {
        type: 'part',
        fxKey: 'cab',
        who: trl('who.the_tractor_driver'),
        anchor: [-1.32, 1.6, 0],
        weight: 0.6,
      })
      m.armor = function (c: any) {
        const S = kit.steelMaterial
        /* front blade (plough type) on arms, wire cage around the operator, jerry cans on the fenders */
        c.roundBox(0.1, 0.72, 2.2, 0.04, S, 2.55, 0.5, 0, { rot: [0, 0, -0.25] })
        c.roundBox(0.06, 0.06, 2.24, 0.02, MT.steel, 2.66, 0.16, 0)
        ;[1, -1].forEach(function (s) {
          c.rod(new V3(1.2, 0.72, s * 0.45), new V3(2.5, 0.55, s * 0.6), 0.05, S)
          c.rod(new V3(1.7, 1.0, s * 0.42), new V3(2.45, 0.7, s * 0.55), 0.035, MT.steel)
        })
        ;[1, -1].forEach(function (s) {
          for (let x = -1.3; x <= -0.32; x += 0.14) c.rod(new V3(x, 1.65, s * 0.62), new V3(x, 2.6, s * 0.62), 0.012, S)
          c.rod(new V3(-1.32, 1.65, s * 0.62), new V3(-0.32, 1.65, s * 0.62), 0.02, S)
          c.rod(new V3(-0.32, 1.65, s * 0.62), new V3(-0.32, 2.62, s * 0.6), 0.025, S)
        })
        for (let y = 1.7; y < 2.6; y += 0.14) c.rod(new V3(-1.36, y, -0.6), new V3(-1.36, y, 0.6), 0.012, S)
        kit.jerryCan(c, -0.75, 1.82, 0.85, '#8e2a20')
        kit.jerryCan(c, -1.15, 1.82, -0.85, '#3e5a34')
        roofLamp(c, -0.3, 2.78, 0.4)
        roofLamp(c, -0.3, 2.78, -0.4)
      }
    },
  )
}
