/** Cabin interior: seats, steering wheel, dashboard and bus rows. */
import type { Kit } from './types'
import { clamp } from './util'

export function installInterior(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, MATERIALS } = I

  /* ================= interior ================= */
  /* Seat. x = seat centre, fl = floor height, z = lateral centre. o: { w, h (seat height), len, back, lean, n (places on a bench seat), dir (+1 faces forward), mat, headrest } */
  kit.seat = function (c: any, x: any, fl: any, z: any, o: any) {
    o = o || {}
    if (o.face === '+z' || o.face === '-z') {
      /* seat facing sideways (troop, ambulance): built facing +x in a group and rotated */
      const gp = new THREE.Group()
      gp.position.set(x, 0, z)
      gp.rotation.y = o.face === '+z' ? -PI / 2 : PI / 2
      gp.userData.rigid = true
      c.vehicle.add(gp)
      const n0 = c.seatTops.length
      kit.seat(c, 0, fl, 0, Object.assign({}, o, { face: null, parent: gp, dir: 1 }))
      const st = c.seatTops[n0]
      if (st) {
        st.x = x
        st.z = z
        const t = st.w
        st.w = st.l
        st.l = t
      }
      return gp
    }
    const PR = o.parent
    const w = o.w || 0.5
    const h = o.h || 0.28
    const mat = o.mat || MATERIALS.seat
    const dir = o.dir || 1
    const n = o.n || 1
    const back = o.back || 0.6
    const lean = o.lean == null ? 0.22 : o.lean
    const cl = o.len || 0.48
    c.roundBox(cl * 0.7, Math.max(0.04, h - 0.1), w * 0.85, 0.03, MATERIALS.plastic, x, fl + Math.max(0.04, h - 0.1) / 2, z, { parent: PR })
    c.roundBox(cl, 0.12, w, 0.05, mat, x, fl + h - 0.05, z, { rot: [0, 0, dir * 0.06], parent: PR })
    const bx = x - dir * (cl / 2 - 0.03)
    const pw = w / n
    const sl = Math.sin(lean)
    const cs = Math.cos(lean)
    for (let j = 0; j < n; j++) {
      const zz = z + (j - (n - 1) / 2) * pw
      c.roundBox(0.12, back, pw - (n > 1 ? 0.02 : 0), 0.05, mat, bx - (dir * sl * back) / 2, fl + h + (cs * back) / 2 - 0.03, zz, {
        rot: [0, 0, dir * lean],
        parent: PR,
      })
      if (o.headrest !== false) {
        const hx = bx - dir * sl * (back + 0.1)
        const hy = fl + h + cs * (back + 0.1) - 0.03
        const hw = Math.min(0.26, pw * 0.62)
        c.roundBox(0.09, 0.15, hw, 0.04, mat, hx, hy, zz, { rot: [0, 0, dir * lean], parent: PR })
        ;[-1, 1].forEach(function (q) {
          c.rod(
            new V3(hx, hy - 0.06, zz + q * hw * 0.25),
            new V3(bx - dir * sl * back, fl + h + cs * back - 0.06, zz + q * hw * 0.25),
            0.006,
            MATERIALS.chrome,
            { seg: 5, parent: PR },
          )
        })
      }
    }
    c.seatTops.push({ x: x, y: fl + h + 0.01, z: z, w: w, l: cl })
  }
  /* 3-spoke steering wheel with column. o: { r, tilt (rad), col (column length), mat } */
  kit.steeringWheel = function (c: any, x: any, y: any, z: any, o: any) {
    o = o || {}
    const r = o.r || 0.18
    const mat = o.mat || MATERIALS.plastic
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.z = -(o.tilt == null ? 0.42 : o.tilt)
    g.userData.rigid = true
    c.vehicle.add(g)
    const rim = c.add(new THREE.TorusGeometry(r, 0.018, 8, 30), mat, 0, 0, 0, g)
    rim.rotation.y = PI / 2
    c.cylinder(r * 0.3, r * 0.3, 0.06, mat, 0.015, 0, 0, 'x', { parent: g })
    c.cylinder(r * 0.12, r * 0.12, 0.01, MATERIALS.chrome, -0.018, 0, 0, 'x', { parent: g })
    ;[
      [0, 0, r],
      [0, 0, -r],
      [0, -r, 0],
    ].forEach(function (p) {
      c.rod(new V3(0.005, 0, 0), new V3(p[0], p[1] * 0.95, p[2] * 0.95), 0.016, mat, { parent: g, seg: 6 })
    })
    c.rod(new V3(0.03, 0, 0), new V3(o.col || 0.34, 0, 0), 0.032, mat, { parent: g, seg: 10 })
    return g
  }
  /* Aircraft control yoke. */
  kit.yoke = function (c: any, x: any, y: any, z: any, o: any) {
    o = o || {}
    const mat = o.mat || MATERIALS.plastic
    c.rod(new V3(x + 0.25, y, z), new V3(x, y, z), 0.018, MATERIALS.chrome)
    c.roundBox(0.04, 0.05, 0.3, 0.02, mat, x, y, z)
    ;[-1, 1].forEach(function (s) {
      c.roundBox(0.04, 0.14, 0.04, 0.018, mat, x - 0.01, y + 0.05, z + s * 0.14)
    })
  }
  /* Dashboard: body, faintly glowing instrument cluster, central infotainment, air vents, glove box.
     o: { x (front edge, next to the windshield), y (top), w, d, h, drv (driver z or null), mat, screen, gauges } */
  kit.dashboard = function (c: any, o: any) {
    const d = o.d || 0.5
    const h = o.h || 0.36
    const x = o.x
    const y = o.y
    const w = o.w
    const mat = o.mat || MATERIALS.plastic
    const xb = x - d
    c.roundBox(d, h, w, 0.06, mat, x - d / 2, y - h / 2, 0)
    c.roundBox(d * 0.85, 0.025, w - 0.04, 0.01, o.top || mat, x - d / 2 - 0.02, y + 0.005, 0)
    if (o.drv != null) {
      c.roundBox(0.14, 0.09, 0.4, 0.04, mat, xb + 0.06, y + 0.03, o.drv)
      ;[-0.09, 0.09].forEach(function (dz) {
        c.cylinder(0.055, 0.055, 0.012, MATERIALS.gauge, xb + 0.002, y - 0.005, o.drv + dz, 'x', { seg: 18 })
        c.cylinder(0.06, 0.06, 0.008, MATERIALS.chrome, xb + 0.006, y - 0.005, o.drv + dz, 'x', { seg: 18, open: true })
        c.roundBox(0.004, 0.045, 0.006, 0.002, MATERIALS.amber, xb - 0.006, y + 0.008, o.drv + dz, { rot: [0.9, 0, 0] })
      })
    }
    if (o.screen !== false) {
      const sc = c.roundBox(0.016, 0.13, Math.min(0.24, w * 0.18), 0.012, MATERIALS.screen, xb + 0.12, y + 0.07, 0, { rot: [0, 0, -0.2] })
      sc.castShadow = false
    }
    const vz = [-w * 0.4, -0.08, 0.08, w * 0.4]
    vz.forEach(function (z) {
      c.roundBox(0.016, 0.05, 0.11, 0.01, MATERIALS.chrome, xb - 0.002, y - 0.09, z)
      c.roundBox(0.016, 0.038, 0.095, 0.008, MATERIALS.dark, xb - 0.006, y - 0.09, z)
    })
    if (o.drv != null) c.roundBox(0.006, 0.12, w * 0.3, 0.004, MATERIALS.dark, xb - 0.003, y - 0.2, -Math.sign(o.drv || -1) * w * 0.25)
  }
  function consoleBox(c: any, x: any, fl: any, h: any, mat: any) {
    c.roundBox(0.62, h, 0.2, 0.04, mat, x, fl + h / 2, 0)
    c.rod(new V3(x + 0.18, fl + h, 0), new V3(x + 0.13, fl + h + 0.13, 0), 0.011, MATERIALS.chrome, { seg: 6 })
    c.sphere(0.03, MATERIALS.plastic, x + 0.13, fl + h + 0.14, 0)
    c.roundBox(0.1, 0.03, 0.1, 0.02, MATERIALS.dark, x + 0.18, fl + h + 0.01, 0)
    c.rod(new V3(x - 0.06, fl + h, 0.0), new V3(x - 0.26, fl + h + 0.08, 0), 0.016, MATERIALS.plastic, { seg: 8 })
  }
  /* Complete car interior. Measures in c.vehicle:
     o: { x0 (windshield base), ft (windshield top), rb/rt (rear glass base/top), roof, belt, floor, zIn (inner half width),
     zRoof, rows (1..3), col (fabric), trim (plastic), drive (-1 = driver on the left), front ('bench' for a 3-seat bench), xFront, xRear, noConsole } */
  kit.interior = function (c: any, o: any) {
    const fab = makeMaterial(o.col || '#2c2d30', { roughness: 0.88 })
    const trim = makeMaterial(o.trim || '#1b1c1f', { roughness: 0.7 })
    const x0 = o.x0
    const fl = o.floor
    const belt = o.belt
    const zi = o.zIn
    const rows = o.rows || 2
    const drv = o.drive || -1
    const zs = o.zSeat || Math.min(zi * 0.5, 0.42)
    const xf = o.xFront != null ? o.xFront : x0 - 1.0
    const seatH = o.seatH || Math.min(0.3, (belt - fl) * 0.5)
    const xr = o.xRear != null ? o.xRear : o.rb != null ? o.rb + 0.08 : xf - rows * 0.9
    c.roundBox(Math.max(0.2, x0 - 0.1 - xr), 0.04, zi * 2, 0.015, MATERIALS.carpet, (x0 - 0.1 + xr) / 2, fl, 0)
    c.meta.cabin = { x0: xr - 0.1, x1: x0 + 0.1, y0: fl - 0.05, y1: (o.roof != null ? o.roof : belt + 0.5) + 0.05, z: zi + 0.045 }
    kit.dashboard(c, {
      x: x0 - 0.07,
      y: belt + 0.04,
      w: zi * 2,
      d: 0.5,
      h: Math.min(0.42, belt + 0.04 - fl - 0.1),
      drv: drv * zs,
      mat: trim,
      top: fab,
    })
    kit.steeringWheel(c, x0 - 0.68, belt - 0.02, drv * zs, { mat: trim })
    const roof = o.roof != null ? o.roof : belt + 0.5
    function lim(y: any) {
      if (o.rb == null) return -1e9
      const t = clamp((y - belt) / (roof - belt), 0, 1)
      return o.rb + t * ((o.rt != null ? o.rt : o.rb) - o.rb) + 0.1
    }
    let x = xf
    for (let r = 0; r < rows; r++) {
      let back = r === 0 ? 0.6 : 0.56
      const lean = r === 0 ? 0.22 : 0.15
      let it
      if (r > 0)
        for (it = 0; it < 30; it++) {
          const ty = fl + seatH + back + 0.1
          const tx = x - 0.21 - Math.sin(lean) * (back + 0.1) - 0.05
          if (tx >= lim(ty)) break
          if (back > 0.44) back -= 0.02
          else x += 0.02
        }
      if (r === 0) {
        if (o.front === 'bench') {
          const wb = zi * 2 - 0.62
          kit.seat(c, x, fl, drv * zs, { w: 0.5, mat: fab, back: back, lean: lean, h: seatH })
          kit.seat(c, x, fl, -drv * (zi - wb / 2 - 0.03), { w: wb, n: 2, mat: fab, back: back, lean: lean, h: seatH })
        } else {
          ;[-1, 1].forEach(function (s) {
            kit.seat(c, x, fl, s * zs, { w: Math.min(0.52, zi - zs + 0.22), mat: fab, back: back, lean: lean, h: seatH })
          })
          if (!o.noConsole) consoleBox(c, x + 0.16, fl, Math.min(0.26, seatH), trim)
        }
      } else kit.seat(c, x, fl, 0, { w: zi * 2 - 0.1, n: r === 2 ? 2 : 3, mat: fab, back: back, lean: lean, h: seatH * 0.95 })
      ;[-1, 1].forEach(function (s) {
        c.roundBox(0.8, belt - fl - 0.08, 0.035, 0.015, trim, x + 0.12, (belt + fl) / 2 + 0.02, s * (zi + 0.02))
        c.roundBox(0.3, 0.05, 0.07, 0.02, fab, x + 0.16, fl + seatH + 0.16, s * (zi - 0.015))
        c.roundBox(0.08, 0.025, 0.02, 0.008, MATERIALS.chrome, x + 0.36, belt - 0.11, s * (zi - 0.005))
      })
      x -= r === 0 ? 0.88 : 0.8
    }
    if (o.ft != null) {
      const hx1 = o.ft - 0.04
      const hx0 = (o.rt != null ? o.rt : xr) + 0.04
      const zr = o.zRoof || zi * 0.9
      if (hx1 > hx0) c.roundBox(hx1 - hx0, 0.02, zr * 2, 0.01, MATERIALS.headliner, (hx0 + hx1) / 2, roof - 0.012, 0).castShadow = false
      c.rod(new V3(o.ft - 0.1, roof - 0.02, 0), new V3(o.ft - 0.12, roof - 0.08, 0), 0.008, MATERIALS.plastic, { seg: 5 })
      c.roundBox(0.03, 0.06, 0.22, 0.02, MATERIALS.plastic, o.ft - 0.12, roof - 0.11, 0)
      ;[-1, 1].forEach(function (s) {
        c.roundBox(0.02, 0.15, 0.34, 0.01, MATERIALS.headliner, o.ft - 0.14, roof - 0.07, s * zs, { rot: [0, 0, 0.35] })
      })
    }
  }
  /* Bus rows with a central aisle and grab poles.
     o: { x0 (front row), x1 (last), pitch, floor, zIn, aisle, col, seatH, ceil, poles, rails, mat (pole) } */
  kit.busRows = function (c: any, o: any) {
    const fab = makeMaterial(o.col || '#3b4a5a', { roughness: 0.85 })
    const pitch = o.pitch || 0.78
    const aisle = o.aisle || 0.48
    const zi = o.zIn
    const pw = zi - aisle / 2
    let n = 0
    const pm = o.mat || MATERIALS.chrome
    const ceil = o.ceil || o.floor + 2.0
    for (let x = o.x0; x >= o.x1 - 1e-6; x -= pitch) {
      ;[-1, 1].forEach(function (s) {
        kit.seat(c, x, o.floor, s * (aisle / 2 + pw / 2), {
          w: pw,
          n: 2,
          mat: fab,
          back: 0.52,
          lean: 0.12,
          h: o.seatH || 0.42,
          len: 0.42,
          headrest: false,
        })
      })
      if (o.poles !== false && n % 2 === 0)
        [-1, 1].forEach(function (s) {
          c.rod(new V3(x - 0.3, o.floor, (s * aisle) / 2), new V3(x - 0.3, ceil, (s * aisle) / 2), 0.016, pm, { seg: 8 })
        })
      n++
    }
    if (o.rails !== false)
      [-1, 1].forEach(function (s) {
        c.rod(new V3(o.x0 + 0.2, ceil - 0.12, s * (aisle / 2 + 0.05)), new V3(o.x1 - 0.4, ceil - 0.12, s * (aisle / 2 + 0.05)), 0.014, pm, {
          seg: 8,
        })
      })
    c.roundBox(o.x0 - o.x1 + 1.0, 0.03, zi * 2, 0.01, MATERIALS.carpet, (o.x0 + o.x1) / 2, o.floor, 0)
    return n
  }

  Object.assign(I, { consoleBox })
}
