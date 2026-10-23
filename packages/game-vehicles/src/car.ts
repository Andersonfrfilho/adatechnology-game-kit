/** The generic car builder: shell, glasshouse, lights, wheels, interior and engine bay in one call. */
import type { Kit } from './types'

export function installCar(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, MATERIALS } = I

  /* ================= generic car ================= */
  /* spec of kit.car(c, spec). Lengths in metres; +x is the front of the vehicle.
       W              body width
       col, roofCol   paint colour (and optional roof colour)
       bottomY        height of the lower edge of the body; noseY / tailY: height at which the front / rear ends are measured
       lower          side profile of the lower body: [[x, y, cornerRadius], ...] from rear to front
       arches         wheel arches: [[x, wheelCentreY, radius], ...]
       gh             glasshouse (the greenhouse): { rb, rt: x of the rear base / top, ft, fb: x of the front top / base, belt: beltline height,
                      roof: roof height, Wg: glasshouse width, k: corner softness, pillars: [x, ...], r1, r2 }
       seams, handles optional panel seams and door handles
       hl, tl         headlights / taillights: { style, w, h, y, in, yaw }
       grille         { style, w, h, y } or false
       interior       { rows, col, trim } or false
       hood           { motor, front } | true | false   (engine bay under an opening hood)
       wheels         [[x, radius, width, options], ...]
       bodyBumper, mirrorCol, noAntenna, plateRearY   misc. options */
  kit.car = function (c: any, s: any) {
    const W = s.W
    const gh = s.gh
    const bev = 0.05
    const T = { belt: gh.belt, top: gh.roof + bev, k: gh.k }
    const m = c.meta
    m.color = s.col
    m.kind = m.kind || 'car'
    const front = I.profX(s.lower, s.noseY, true)
    const rear = I.profX(s.lower, s.tailY, false)
    const intr = s.interior === false ? null : Object.assign({ rows: 2 }, s.interior || {})
    const hoodO = s.hood ? Object.assign({ motor: 'gasoline' }, s.hood === true ? {} : s.hood) : null
    let tireW = 0.2
    ;(s.wheels || []).forEach(function (w: any) {
      tireW = Math.max(tireW, w[2])
    })
    const low = []
    if (intr) low.push(kit.holeTop(gh.rb + 0.05, gh.fb - 0.03, gh.Wg / 2 - 0.05, gh.belt - 0.3))
    const hx0 = gh.fb + 0.08
    const hx1 = front - (hoodO && hoodO.front != null ? hoodO.front : 0.2)
    const zH = W / 2 - 0.13
    if (hoodO) low.push(kit.holeTop(hx0, hx1, zH, s.bottomY + 0.2, 'hood'))
    ;(s.holes || []).forEach(function (h: any) {
      low.push(h)
    })
    const lowMesh = I.shell(c, {
      items: s.lower,
      bottomY: s.bottomY,
      arches: s.arches,
      W: W,
      col: s.col,
      holes: low,
      archInner: intr || hoodO ? W / 2 - tireW - 0.16 : null,
    })
    const ghItems = [
      [gh.rb, gh.belt - 0.1, 0],
      [gh.rt, gh.roof, gh.r1 || 0.12],
      [gh.ft, gh.roof, gh.r2 || 0.2],
      [gh.fb, gh.belt - 0.1, 0],
    ]
    const polys = I.autoWindows(gh)
    const qf = kit.quadDef([gh.fb, gh.belt], [gh.ft, gh.roof], gh.Wg, T, 'front', bev)
    const qr = kit.quadDef([gh.rb, gh.belt], [gh.rt, gh.roof], gh.Wg, T, 'rear', bev)
    const gHoles = []
    if (intr) {
      polys.forEach(function (p: any) {
        gHoles.push(kit.holeSide(p))
      })
      gHoles.push(
        kit.holeQuad(qf),
        kit.holeQuad(qr),
        kit.holeWhere(function (n: any, ce: any) {
          return n.y < -0.7 && ce.y < gh.belt + 0.02
        }),
      )
    }
    I.shell(c, { items: ghItems, W: gh.Wg, col: s.roofCol || s.col, T: T, holes: gHoles, sub: intr ? 0.12 : 0.2 })
    kit.sideWindows(
      c,
      polys,
      gh.Wg,
      T,
      function (i: any, n: any) {
        return { key: i === 0 && n > 2 ? 'quarter_glass' : i === n - 1 ? 'window_front' : 'window_rear' }
      },
      { see: !!intr },
    )
    kit.glassQuad(c, qf, { key: 'windshield' }, { see: !!intr })
    kit.glassQuad(c, qr, { key: 'rear_window' }, { see: !!intr, mat: intr ? MATERIALS.rearTint : MATERIALS.glassDark })
    m.length = front - rear
    m.width = W
    m.front = front
    m.rear = rear
    m.clearance = s.bottomY
    m.belt = gh.belt
    m.top = gh.roof + bev
    m.bodyHeight = gh.belt - s.bottomY
    m.roof = { x0: gh.rt + 0.1, x1: gh.ft - 0.1, w: I.halfAt(gh.Wg, T, gh.roof) * 1.7, y: gh.roof + bev }
    m.glasshouse = gh
    m.tumble = T
    m.frontQuad = qf
    if (intr)
      kit.interior(
        c,
        Object.assign(
          {
            x0: gh.fb,
            ft: gh.ft,
            rb: gh.rb,
            rt: gh.rt,
            roof: gh.roof,
            belt: gh.belt,
            floor: s.bottomY + 0.1,
            zIn: gh.Wg / 2 - 0.09,
            zRoof: I.halfAt(gh.Wg, T, gh.roof) - 0.12,
            xRear: gh.rb + 0.06,
          },
          intr,
        ),
      )
    if (hoodO) {
      let fa = -1e9
      ;(s.arches || []).forEach(function (a: any) {
        fa = Math.max(fa, a[0])
      })
      const bxv8 = hx0 + (hx1 - hx0) * 0.45
      const hood = kit.makeHood(c, lowMesh.userData.cut.hood, {
        x0: hx0,
        col: s.col,
        hole: hoodO.motor === 'v8' ? kit.holeBox([bxv8 - 0.2, -9, -0.16], [bxv8 + 0.24, 9, 0.16]) : null,
      })
      if (hood)
        kit.engineBay(c, {
          x0: hx0 + 0.02,
          x1: hx1,
          zw: zH - 0.02,
          floor: s.bottomY + 0.12,
          top: hood.yMin - 0.035,
          motor: hoodO.motor,
          axle: fa,
          col: s.col,
        })
    }
    kit.carDetails(c, s)
    m.arches = s.arches || null
    if (s.bed) m.bed = s.bed
    if (s.under !== false)
      kit.underbody(c, {
        W: W,
        bottomY: s.bottomY,
        wheels: s.wheels || [],
        motor: hoodO ? hoodO.motor : s.motor || 'gasoline',
        spare: s.spareUnder,
      })
    if (s.warp) I.applyWarp(c, typeof s.warp === 'function' ? s.warp : I.makeWarp(s.warp))
  }
  /* Underbody visible when rolled over: axles, arms, oil pan, differential (rear-wheel drive), exhaust with muffler, tank, spare wheel.
     o: { W, bottomY, wheels: [[x, r, w]..], motor, spare (true = spare wheel under the rear) } */
  kit.underbody = function (c: any, o: any) {
    const m = c.meta
    const W = o.W
    const by = o.bottomY
    const ws = o.wheels
      .map(function (w: any) {
        return w
      })
      .sort(function (a: any, b: any) {
        return b[0] - a[0]
      })
    if (ws.length < 2) return
    const fx = ws[0][0]
    const rx = ws[ws.length - 1][0]
    const rr = ws[ws.length - 1][1]
    const tw = ws[0][2]
    const zW = W / 2 - tw - 0.04
    const yU = Math.max(0.12, by - 0.035)
    const ug = new THREE.Group()
    ug.userData.rigid = true
    c.vehicle.add(ug)
    m.underbodyGroup = ug
    const DK = makeMaterial('#1a1b1c', { roughness: 0.75, metalness: 0.3 })
    const ST = MATERIALS.steel
    function box(w: any, h: any, d: any, mat: any, x: any, y: any, z: any) {
      return c.roundBox(w, h, d, Math.min(0.02, h * 0.4), mat, x, y, z, { parent: ug })
    }
    function rod(a: any, b: any, r: any, mat: any) {
      return c.rod(a, b, r, mat, { parent: ug, seg: 8 })
    }
    const diesel = o.motor === 'diesel' || o.motor === 'v8' || o.motor === 'v8_na'
    const ev = o.motor === 'electric'
    /* front axle: half shafts and wishbones */
    ;[1, -1].forEach(function (sd) {
      rod(new V3(fx, ws[0][1], sd * 0.12), new V3(fx, ws[0][1], sd * zW), 0.028, ST)
      rod(new V3(fx - 0.25, yU + 0.02, sd * 0.3), new V3(fx, ws[0][1] - 0.1, sd * zW), 0.022, DK)
      rod(new V3(rx + 0.35, yU + 0.02, sd * 0.25), new V3(rx, rr - 0.08, sd * zW), 0.026, DK)
    })
    if (diesel) {
      rod(new V3(rx, rr, -zW), new V3(rx, rr, zW), 0.045, ST)
      c.sphere(0.13, ST, rx, rr, 0, 1, 0.85, 1, { parent: ug })
      rod(new V3(rx + 0.1, rr, 0), new V3(fx - 0.6, yU + 0.04, 0), 0.035, ST)
    } else box(0.09, 0.08, zW * 2, DK, rx + 0.08, Math.max(yU, rr - 0.12), 0)
    if (!ev) {
      box(Math.min(0.5, (fx - rx) * 0.2), 0.1, 0.38, DK, fx - 0.25, yU + 0.01, -0.05)
      const tz = W * 0.3
      const mx = rx - 0.15
      const ty = Math.max(0.14, by - 0.06)
      c.tube(
        [
          [fx - 0.35, yU, 0.12],
          [fx - 0.9, ty, 0.14],
          [(fx + rx) / 2, ty, 0.16],
          [rx + 0.5, ty, tz * 0.5],
          [mx + 0.3, ty, tz * 0.8],
        ],
        0.03,
        ST,
        { parent: ug, seg: 30, rs: 6 },
      )
      c.cylinder(0.1, 0.1, 0.42, ST, mx, ty + 0.02, tz, 'x', { parent: ug })
      box(0.24, 0.06, 0.2, DK, (fx + rx) / 2 + 0.1, ty, 0.16)
      box(0.55, 0.18, W * 0.5, makeMaterial('#232527', { roughness: 0.7 }), rx + 0.62, Math.max(0.16, by - 0.02), -W * 0.1)
    } else {
      box(
        (fx - rx) * 0.72,
        0.1,
        W - 0.4,
        makeMaterial('#2a2e31', { roughness: 0.6, metalness: 0.4 }),
        (fx + rx) / 2,
        Math.max(0.14, by - 0.03),
        0,
      )
      for (let k = 0; k < 6; k++) box(0.03, 0.02, W - 0.45, ST, rx + 0.4 + (k * (fx - rx - 0.8)) / 5, Math.max(0.14, by - 0.03) - 0.06, 0)
    }
    if (o.spare && m.rear < rx - 0.7) {
      c.cylinder(0.32, 0.32, 0.2, MATERIALS.rubber, rx - 0.55, Math.max(0.2, by - 0.05), 0, null, { parent: ug })
      c.cylinder(0.2, 0.2, 0.21, ST, rx - 0.55, Math.max(0.2, by - 0.05), 0, null, { parent: ug })
    }
    ug.traverse(function (x: any) {
      x.castShadow = false
    })
    return ug
  }
  kit.carDetails = function (c: any, s: any) {
    const m = c.meta
    const W = m.width
    const by = s.bottomY
    const it = s.lower
    const bumperY = by + 0.14
    const bf = I.profX(it, bumperY, true)
    const br = I.profX(it, bumperY, false)
    const bumper = s.bodyBumper ? c.paint(s.col) : MATERIALS.trim
    m.frontBumper = c.roundBox(0.24, 0.22, W + 0.03, 0.09, bumper, bf - 0.04, bumperY, 0, { def: true })
    c.part('bumper', { key: 'bumper_front' }, m.frontBumper, new V3(bf, bumperY, 0), 1.1)
    m.rearBumper = c.roundBox(0.24, 0.22, W + 0.03, 0.09, bumper, br + 0.04, bumperY, 0, { def: true })
    c.part('bumper', { key: 'bumper_rear' }, m.rearBumper, new V3(br, bumperY, 0), 1.1)
    const hl = Object.assign(
      { style: s.headMat === MATERIALS.led ? 'slim' : 'rect', w: s.headW || 0.34, h: s.headH || 0.12, in: 0.06, yaw: 0.16 },
      s.hl || {},
    )
    const hy = hl.y || s.headY || s.noseY - 0.06
    const hx = I.profX(it, hy, true)
    const hz = W / 2 - hl.in - hl.w / 2
    ;[1, -1].forEach(function (sd) {
      kit.headlight(c, {
        style: hl.style,
        x: hx + 0.02 + (hl.dx || 0),
        y: hy,
        z: sd * hz,
        w: hl.w,
        h: hl.h,
        side: sd,
        yaw: hl.yaw,
        mat: hl.mat,
      })
    })
    if (hl.style === 'ledbar') kit.lightBar(c, hx + 0.03, hy + hl.h * 0.3, -hz + hl.w / 2, hz - hl.w / 2, 0.018, 1)
    if (s.grille !== false && !s.noGrille) {
      const gr = Object.assign({ style: 'bars', w: W * 0.44, h: Math.max(0.08, hy - bumperY - 0.12) }, s.grille || {})
      const gy = gr.y || (bumperY + hy) / 2 + 0.02
      const gx = I.profX(it, gy, true)
      kit.grille(c, { style: gr.style, x: gx + 0.025, y: gy, w: gr.w, h: gr.h, col: s.col, emblem: gr.emblem })
    } else kit.emblem(c, I.profX(it, hy + 0.02, true) + 0.055, hy + 0.02, 0, 0.04)
    const tl = Object.assign({ style: 'wrap', w: s.tailW || 0.3, h: s.tailH || 0.14, in: 0.05 }, s.tl || {})
    const ty = tl.y || s.tailLightY || s.tailY - 0.05
    const tx = I.profX(it, ty, false)
    const tz = W / 2 - tl.in - tl.w / 2
    ;[1, -1].forEach(function (sd) {
      kit.taillight(c, { style: tl.style, x: tx - 0.02, y: ty, z: sd * tz, w: tl.w, h: tl.h, side: sd, wrap: tl.wrap })
    })
    if (tl.style === 'bar') kit.lightBar(c, tx - 0.03, ty + tl.h * 0.15, -tz + tl.w / 2, tz - tl.w / 2, Math.min(0.04, tl.h * 0.4), -1)
    ;[1, -1].forEach(function (sd) {
      if (m.glasshouse && m.glasshouse.Wg) {
        const mx = m.glasshouse.fb - 0.12
        const my = m.glasshouse.belt + 0.1
        const mz = sd * (I.halfAt(m.glasshouse.Wg, m.tumble, my) + 0.13)
        c.roundBox(0.13, 0.11, 0.07, 0.035, c.paint(s.mirrorCol || s.col), mx, my, mz)
        c.roundBox(0.02, 0.08, 0.05, 0.01, MATERIALS.chrome, mx - 0.07, my, mz)
        c.rod(new V3(mx + 0.02, my - 0.02, mz - sd * 0.04), new V3(mx + 0.04, my - 0.05, sd * (W / 2 - 0.02)), 0.015, MATERIALS.trim)
      }
      ;(s.seams || []).forEach(function (x: any) {
        c.roundBox(0.012, m.belt - by - 0.14, 0.006, 0.003, MATERIALS.dark, x, (m.belt + by) / 2 + 0.04, sd * (W / 2 + 0.002))
      })
      ;(s.handles || []).forEach(function (x: any) {
        c.roundBox(0.13, 0.035, 0.025, 0.012, MATERIALS.chrome, x, m.belt - 0.12, sd * (W / 2 + 0.01))
      })
      if (s.arches && s.arches.length > 1) {
        const x0 = Math.min(s.arches[0][0], s.arches[1][0]) + s.arches[0][2]
        const x1 = Math.max(s.arches[0][0], s.arches[1][0]) - s.arches[0][2]
        c.roundBox(x1 - x0, 0.07, 0.03, 0.012, MATERIALS.trim, (x0 + x1) / 2, by + 0.06, sd * (W / 2 + 0.008))
      }
    })
    c.plate(bf + 0.085, bumperY + 0.01, 0, '+x')
    const pry = s.plateRearY || by + 0.42
    c.plate(I.profX(it, pry, false) - 0.025, pry, 0, '-x')
    if (m.glasshouse && m.glasshouse.Wg) {
      const wy = m.glasshouse.belt + 0.07
      const wx = m.glasshouse.fb - 0.05
      ;[-0.25, 0.25].forEach(function (z) {
        c.rod(new V3(wx + 0.03, wy, z - 0.02), new V3(wx - 0.18, wy + 0.17, z - 0.3), 0.01, MATERIALS.trim)
      })
    }
    c.cylinder(0.035, 0.035, 0.22, MATERIALS.steel, br - 0.05, by + 0.04, W * 0.3, 'x')
    m.exhaust = new V3(br - 0.17, by + 0.04, W * 0.3)
    if (!s.noAntenna && m.roof) c.rod(new V3(m.roof.x0 + 0.1, m.top, 0), new V3(m.roof.x0 - 0.05, m.top + 0.22, 0), 0.008, MATERIALS.trim)
    /* s.track (or w[3].track): track width from tyre centre to tyre centre; without it the tyre touches the body edge */
    ;(s.wheels || []).forEach(function (w: any) {
      const tk = (w[3] && w[3].track) || s.track
      ;[1, -1].forEach(function (sd) {
        c.wheel(w[0], sd * (tk ? tk / 2 : W / 2 - w[2] / 2 + 0.03), w[1], w[2], w[3] || {})
      })
    })
    if (
      !c.parts.some(function (p: any) {
        return p.kind === 'engine'
      })
    )
      c.part('engine', { key: 'engine' }, null, new V3(m.front - 0.6, by + 0.45, 0), 1.0)
    if (
      !c.parts.some(function (p: any) {
        return p.kind === 'radiator'
      }) &&
      !s.noRadiator
    )
      c.part('radiator', { key: 'radiator' }, null, new V3(m.front - 0.15, by + 0.35, 0), 0.9)
    c.part('fuel_tank', s.tankLabel || { key: 'fuel_tank' }, null, new V3(m.rear + 0.75, by + 0.15, -W * 0.22), 1.0)
  }
  /* Fender flare: an arched strip over the wheel arch, on both sides.
     x, y: wheel centre; r: arch radius; z: half width where it attaches; o: { w (strip width), t (thickness), mat, a0 (start angle), sides } */
  kit.archFlare = function (c: any, x: any, y: any, r: any, z: any, o: any) {
    o = o || {}
    const w = o.w || 0.07
    const t = o.t || 0.03
    const mat = o.mat || MATERIALS.trim
    const a0 = o.a0 == null ? 0.12 : o.a0
    const out: any = []
    ;(o.sides || [1, -1]).forEach(function (sd: any) {
      const shp = new THREE.Shape()
      const N = 24
      for (let i = 0; i <= N; i++) {
        const a = a0 + ((PI - 2 * a0) * i) / N
        shp[i ? 'lineTo' : 'moveTo'](Math.cos(a) * (r + w), Math.sin(a) * (r + w))
      }
      for (let j = N; j >= 0; j--) {
        const b = a0 + ((PI - 2 * a0) * j) / N
        shp.lineTo(Math.cos(b) * r, Math.sin(b) * r)
      }
      const g = new THREE.ExtrudeGeometry(shp, {
        depth: t,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2,
        curveSegments: 4,
      })
      g.translate(0, 0, sd > 0 ? 0 : -t)
      const m = c.add(g, mat, x, y, sd * z)
      out.push(m)
    })
    return out
  }

  Object.assign(I, {})
}
