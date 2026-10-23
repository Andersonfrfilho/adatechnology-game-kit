/** Hoods, engine bays and hinge helpers. */
import type { Kit } from './types'

export function installHood(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, MATERIALS, crease, cutGeometry } = I

  /* ================= hood and engine bay ================= */
  /* Hood made from the skin cut out of the hull (shell holes with a tag). o: { x0 (hinge), col, open (rad), hole (extra hole, e.g. blower) } */
  kit.makeHood = function (c: any, geo: any, o: any) {
    o = o || {}
    if (!geo || !geo.attributes.position.count) return null
    if (o.hole) geo = cutGeometry(geo, [o.hole]).geo
    geo.computeBoundingBox()
    const bb = geo.boundingBox.clone()
    const p = geo.attributes.position
    const hx = o.x0 != null ? o.x0 : bb.min.x
    let hy = -1e9
    for (let i = 0; i < p.count; i++) if (p.getX(i) < bb.min.x + 0.08) hy = Math.max(hy, p.getY(i))
    const cx = (bb.min.x + bb.max.x) / 2
    const sx = 1 - 0.022 / Math.max(0.3, bb.max.x - bb.min.x)
    const sz = 1 - 0.022 / Math.max(0.3, bb.max.z - bb.min.z)
    for (let i = 0; i < p.count; i++) {
      p.setX(i, cx + (p.getX(i) - cx) * sx)
      p.setZ(i, p.getZ(i) * sz)
      p.setY(i, p.getY(i) + 0.008)
    }
    geo.translate(-hx, -hy, 0)
    const under = geo.clone()
    under.translate(0, -0.022, 0)
    crease(under, 42)
    crease(geo, 42)
    const piv = new THREE.Group()
    piv.position.set(hx, hy, 0)
    c.vehicle.add(piv)
    const top = new THREE.Mesh(geo, c.paint(o.col || c.meta.color || '#6a6a6a'))
    top.castShadow = true
    top.receiveShadow = true
    piv.add(top)
    const bot = new THREE.Mesh(under, MATERIALS.hoodLiner)
    piv.add(bot)
    c.deform.push(top, bot)
    c.hood = {
      piv: piv,
      ang: 0,
      target: 0,
      open: o.open || 1.05,
      latch: 0,
      x0: hx,
      x1: bb.max.x,
      y: hy,
      yMin: bb.min.y,
      zw: bb.max.z,
      label: o.label,
      noLatch: !!o.noLatch,
    }
    c.part('hood', { key: 'hood' }, piv, new V3((hx + bb.max.x) / 2, hy, 0), 0.9)
    return c.hood
  }
  /* Turns any set of meshes into a hinged hood (tractor, truck). pivot in c.vehicle; axis "z" (front rises). */
  kit.hinge = function (c: any, objs: any, pivot: any, o: any) {
    o = o || {}
    const piv = new THREE.Group()
    piv.position.copy(pivot)
    c.vehicle.add(piv)
    objs.forEach(function (m: any) {
      if (m.parent) m.parent.remove(m)
      m.position.sub(pivot)
      piv.add(m)
    })
    c.hood = {
      piv: piv,
      ang: 0,
      target: 0,
      open: o.open || 1.0,
      latch: 0,
      x0: pivot.x,
      x1: pivot.x + (o.len || 1),
      y: pivot.y,
      yMin: pivot.y,
      zw: o.zw || 0.5,
      sign: o.sign || 1,
      label: o.bayLabel,
      noLatch: !!o.noLatch,
    }
    c.part('hood', o.label || { key: 'hood' }, piv, pivot.clone().add(new V3((o.len || 1) / 2, 0, 0)), 0.9)
    return c.hood
  }
  /* Engine bay. o: { x0 (firewall), x1 (front), zw (half width), floor, top (free height under the hood), motor: gasoline|diesel|electric|v8 (with blower)|v8_na (naturally aspirated V8), axle (axle x, strut towers), col, frunk } */
  kit.engineBay = function (c: any, o: any) {
    const x0 = o.x0
    const x1 = o.x1
    const zw = o.zw
    const fl = o.floor
    const top = Math.max(o.top, fl + 0.22)
    const mot = o.motor || 'gasoline'
    const L = x1 - x0
    const H = top - fl
    const cx = (x0 + x1) / 2
    const paint = c.paint(o.col || c.meta.color || '#666')
    const out: any = {}
    c.roundBox(L, 0.03, 2 * zw, 0.01, MATERIALS.bay, cx, fl, 0)
    c.roundBox(0.03, H + 0.04, 2 * zw, 0.01, MATERIALS.bay, x0 + 0.015, fl + H / 2, 0)
    ;[1, -1].forEach(function (s) {
      c.roundBox(L, H * 0.75, 0.03, 0.01, MATERIALS.bay, cx, fl + H * 0.37, s * zw)
    })
    const rx = x1 - 0.06
    const rh = H * 0.82
    const rad = c.roundBox(0.05, rh, zw * 1.5, 0.012, MATERIALS.radiator, rx, fl + rh / 2 + 0.02, 0)
    for (let f = 0; f < 6; f++) c.roundBox(0.054, 0.006, zw * 1.46, 0.002, MATERIALS.steel, rx, fl + 0.06 + (f * (rh - 0.06)) / 6, 0)
    c.roundBox(0.07, 0.04, zw * 1.5, 0.015, MATERIALS.plastic, rx, fl + rh + 0.03, 0)
    out.rad = new V3(rx, fl + rh / 2, 0)
    const fanR = Math.min(rh * 0.42, zw * 0.45)
    const fg = new THREE.Group()
    fg.position.set(rx - 0.06, fl + rh / 2 + 0.02, 0)
    c.vehicle.add(fg)
    c.add(new THREE.TorusGeometry(fanR, 0.012, 6, 24), MATERIALS.plastic, 0, 0, 0, fg).rotation.y = PI / 2
    for (let b = 0; b < 7; b++) {
      const bl = c.roundBox(
        0.012,
        fanR * 0.85,
        0.06,
        0.006,
        MATERIALS.plastic,
        0,
        Math.cos((b / 7) * PI * 2) * fanR * 0.45,
        Math.sin((b / 7) * PI * 2) * fanR * 0.45,
        { parent: fg },
      )
      bl.rotation.x = (-b / 7) * PI * 2
      bl.rotation.y = 0.35
    }
    c.cylinder(fanR * 0.2, fanR * 0.2, 0.05, MATERIALS.steel, 0, 0, 0, 'x', { parent: fg })
    if (o.axle != null && o.axle > x0 && o.axle < x1)
      [1, -1].forEach(function (s) {
        c.cylinder(0.09, 0.12, H * 0.7, paint, o.axle, fl + H * 0.35, s * (zw - 0.12), null, { seg: 16 })
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * PI * 2
          c.cylinder(0.012, 0.012, 0.02, MATERIALS.steel, o.axle + Math.cos(a) * 0.055, fl + H * 0.7 + 0.01, s * (zw - 0.12) + Math.sin(a) * 0.055)
        }
      })
    function reservoir(x: any, y: any, z: any, w: any, h: any, d: any, shell: any, liq: any, cap: any) {
      c.roundBox(w, h, d, 0.02, shell, x, y, z).castShadow = false
      if (liq) c.roundBox(w * 0.85, h * 0.55, d * 0.85, 0.015, liq, x, y - h * 0.18, z)
      c.cylinder(0.026, 0.026, 0.025, cap, x, y + h / 2 + 0.012, z)
    }
    function battery(x: any, y: any, z: any, sc?: any) {
      sc = sc || 1
      c.roundBox(0.2 * sc, 0.15 * sc, 0.15 * sc, 0.015, makeMaterial('#1a1b1c', { roughness: 0.5 }), x, y, z)
      c.roundBox(0.2 * sc, 0.012, 0.15 * sc, 0.005, makeMaterial('#2e3a6a', { roughness: 0.5 }), x, y + 0.04 * sc, z)
      c.cylinder(0.016, 0.018, 0.03, MATERIALS.postRed, x + 0.06 * sc, y + 0.09 * sc, z + 0.045 * sc)
      c.cylinder(0.016, 0.018, 0.03, MATERIALS.postBlack, x + 0.06 * sc, y + 0.09 * sc, z - 0.045 * sc)
      c.tube(
        [
          [x + 0.06 * sc, y + 0.1 * sc, z + 0.045 * sc],
          [x + 0.1, y + 0.13, z + 0.1],
          [x + 0.2, y + 0.05, z + 0.12],
        ],
        0.01,
        MATERIALS.postRed,
        { seg: 12, rs: 5 },
      )
      return new V3(x, y, z)
    }
    const uy = Math.min(top - 0.03, fl + H * 0.75)
    reservoir(x0 + 0.12, uy - 0.04, -zw * 0.55, 0.07, 0.06, 0.07, MATERIALS.coolant, makeMaterial('#c9b26a', { roughness: 0.3 }), MATERIALS.yellow)
    reservoir(x1 - 0.2, fl + H * 0.45, zw * 0.72, 0.12, 0.13, 0.1, MATERIALS.washer, makeMaterial('#3f8fc0', { roughness: 0.3 }), MATERIALS.capBlue)
    c.roundBox(0.12, 0.07, 0.13, 0.015, MATERIALS.plastic, x0 + 0.18, uy - 0.02, -zw * 0.78)
    c.roundBox(0.12, 0.006, 0.13, 0.003, MATERIALS.dark, x0 + 0.18, uy + 0.017, -zw * 0.78)
    if (mot === 'electric') {
      const fx0 = x0 + L * 0.4
      const fx1 = x1 - 0.14
      const fw = zw * 1.5
      const fh = H * 0.65
      const fy = fl + 0.02
      c.roundBox(fx1 - fx0, 0.02, fw, 0.01, MATERIALS.carpet, (fx0 + fx1) / 2, fy + 0.02, 0)
      ;[
        [fx0, 0],
        [fx1, 0],
      ].forEach(function (p) {
        c.roundBox(0.025, fh, fw, 0.01, MATERIALS.plastic, p[0], fy + fh / 2, 0)
      })
      ;[1, -1].forEach(function (s) {
        c.roundBox(fx1 - fx0, fh, 0.025, 0.01, MATERIALS.plastic, (fx0 + fx1) / 2, fy + fh / 2, (s * fw) / 2)
      })
      const ix = x0 + L * 0.2
      const iy = fl + H * 0.35
      c.roundBox(L * 0.24, H * 0.42, zw * 0.9, 0.03, makeMaterial('#9aa1a6', { metalness: 0.7, roughness: 0.35 }), ix, iy, zw * 0.1)
      for (let fin = 0; fin < 5; fin++)
        c.roundBox(
          L * 0.22,
          0.03,
          0.012,
          0.004,
          makeMaterial('#b8bec2', { metalness: 0.7, roughness: 0.3 }),
          ix,
          iy + H * 0.21 + 0.012,
          zw * 0.1 - zw * 0.36 + fin * zw * 0.18,
        )
      c.text(kit.t('texts.high_voltage'), L * 0.2, 0.05, ix, iy + H * 0.215 + 0.008, zw * 0.1, '+y', {
        fg: '#121212',
        bg: '#f0a01e',
        w: 512,
        h: 128,
        size: 0.55,
      })
      ;[-0.12, 0.12].forEach(function (dz) {
        c.tube(
          [
            [ix - L * 0.1, iy - H * 0.1, zw * 0.1 + dz],
            [ix - L * 0.14, fl + 0.06, zw * 0.1 + dz * 1.5],
            [x0 + 0.04, fl + 0.03, dz * 2],
          ],
          0.022,
          MATERIALS.hv,
          { seg: 16, rs: 6 },
        )
      })
      c.tube(
        [
          [ix + L * 0.12, iy, zw * 0.5],
          [fx0 - 0.03, iy + 0.02, zw * 0.7],
          [rx - 0.1, fl + rh * 0.8, zw * 0.6],
        ],
        0.016,
        MATERIALS.hose,
        { seg: 16, rs: 6 },
      )
      battery(x0 + 0.14, fl + H * 0.25, -zw * 0.55, 0.65)
      reservoir(x0 + 0.13, fl + H * 0.62, zw * 0.72, 0.1, 0.1, 0.08, MATERIALS.coolant, MATERIALS.coolantLiq, MATERIALS.postBlack)
      out.motor = new V3(ix, iy, 0)
      out.inverter = new V3(ix, iy, 0)
      out.frunk = new V3((fx0 + fx1) / 2, fy, 0)
    } else if (mot === 'v8' || mot === 'v8_na') {
      const bx = cx - L * 0.05
      const by = fl + H * 0.3
      const bl = L * 0.55
      c.roundBox(bl, H * 0.45, zw * 0.7, 0.04, makeMaterial('#2f5a8a', { metalness: 0.5, roughness: 0.4 }), bx, by, 0)
      ;[1, -1].forEach(function (s) {
        c.roundBox(bl * 0.9, 0.07, zw * 0.32, 0.03, MATERIALS.chrome, bx, by + H * 0.25, s * zw * 0.3, { rot: [s * 0.5, 0, 0] })
        for (let h2 = 0; h2 < 4; h2++)
          c.tube(
            [
              [bx - bl * 0.35 + h2 * bl * 0.23, by, s * zw * 0.38],
              [bx - bl * 0.35 + h2 * bl * 0.23, by - 0.08, s * zw * 0.7],
              [bx - bl * 0.3, fl + 0.05, s * zw * 0.85],
            ],
            0.02,
            MATERIALS.chrome,
            { seg: 12, rs: 6 },
          )
      })
      let bly = top - 0.02
      if (mot === 'v8') {
        c.roundBox(bl * 0.75, 0.22, zw * 0.42, 0.04, MATERIALS.chrome, bx, bly, 0)
        for (let rb2 = 0; rb2 < 6; rb2++) c.roundBox(bl * 0.75, 0.012, 0.012, 0.004, MATERIALS.steel, bx, bly + 0.03, -zw * 0.18 + rb2 * zw * 0.072)
        c.roundBox(0.2, 0.16, 0.24, 0.03, MATERIALS.chrome, bx + 0.02, bly + 0.19, 0)
        ;[-0.06, 0.06].forEach(function (dz) {
          c.roundBox(0.07, 0.1, 0.09, 0.02, MATERIALS.dark, bx + 0.09, bly + 0.2, dz)
        })
      } else {
        /* modern naturally aspirated V8: low intake manifold with plastic cover, throttle body and duct to the air filter box */
        bly = Math.min(top - 0.06, by + H * 0.42)
        c.roundBox(bl * 0.62, 0.09, zw * 0.4, 0.035, MATERIALS.cover, bx, bly, 0)
        c.roundBox(bl * 0.5, 0.012, zw * 0.3, 0.005, MATERIALS.plastic, bx, bly + 0.05, 0)
        c.cylinder(0.055, 0.055, 0.06, MATERIALS.steel, bx + bl * 0.36, bly, 0, 'x')
        c.tube(
          [
            [bx + bl * 0.39, bly, 0],
            [bx + bl * 0.5, bly + 0.02, zw * 0.25],
            [x0 + L * 0.82, fl + H * 0.55, zw * 0.55],
          ],
          0.045,
          MATERIALS.hose,
          { seg: 14, rs: 8 },
        )
        c.roundBox(0.26, 0.14, 0.22, 0.03, MATERIALS.plastic, x0 + L * 0.82, fl + H * 0.5, zw * 0.62)
      }
      c.cylinder(0.07, 0.07, 0.04, MATERIALS.steel, bx + bl * 0.4, by + H * 0.2, 0, 'x')
      c.tube(
        [
          [bx + bl * 0.42, by + H * 0.2 + 0.07, 0],
          [bx + bl * 0.42, bly + 0.06, 0],
        ],
        0.012,
        MATERIALS.hose,
        { seg: 4, rs: 5 },
      )
      battery(x0 + 0.16, fl + 0.1, zw * 0.62)
      out.motor = new V3(bx, by, 0)
      if (mot === 'v8') out.blower = new V3(bx, bly, 0)
    } else {
      const ex = x0 + L * 0.48
      const bh = H * 0.5
      const bz = zw * 0.95
      const ey = fl + 0.04 + bh / 2
      const eb = Math.min(0.42, L * 0.36)
      c.roundBox(eb, bh, bz, 0.03, MATERIALS.block, ex, ey, -zw * 0.1)
      const cover = mot === 'diesel' ? makeMaterial('#2b2d30', { metalness: 0.3, roughness: 0.4 }) : MATERIALS.cover
      c.roundBox(eb * 0.82, 0.07, bz * 0.92, 0.03, cover, ex, ey + bh / 2 + 0.03, -zw * 0.1)
      for (let rib = 0; rib < 4; rib++)
        c.roundBox(eb * 0.7, 0.012, 0.014, 0.004, MATERIALS.steel, ex, ey + bh / 2 + 0.07, -zw * 0.1 - bz * 0.36 + rib * bz * 0.24)
      c.cylinder(0.03, 0.03, 0.028, MATERIALS.yellow, ex - eb * 0.2, ey + bh / 2 + 0.08, -zw * 0.1 + bz * 0.28)
      const plx = ex + eb / 2 + 0.07
      const ply = ey + bh * 0.1
      c.roundBox(0.07, bh * 0.4, bz * 0.7, 0.02, MATERIALS.block, plx, ply, -zw * 0.1)
      for (let rn = 0; rn < 4; rn++) {
        const rz = -zw * 0.1 - bz * 0.3 + rn * bz * 0.2
        c.tube(
          [
            [ex + eb * 0.3, ey + bh / 2 + 0.02, rz],
            [plx - 0.02, ey + bh / 2 + 0.03, rz],
            [plx, ply + bh * 0.15, rz],
          ],
          0.018,
          MATERIALS.block,
          { seg: 10, rs: 6 },
        )
      }
      const afx = x1 - L * 0.32
      const afy = Math.min(top - 0.07, fl + H * 0.7)
      c.roundBox(0.22, 0.1, 0.26, 0.03, MATERIALS.plastic, afx, afy, zw * 0.5)
      c.roundBox(0.22, 0.012, 0.26, 0.004, MATERIALS.dark, afx, afy + 0.01, zw * 0.5)
      c.tube(
        [
          [afx - 0.11, afy, zw * 0.4],
          [plx + 0.02, afy, zw * 0.15],
          [plx, ply + bh * 0.2, -zw * 0.1 + bz * 0.35],
        ],
        0.04,
        MATERIALS.hose,
        { seg: 16, rs: 8 },
      )
      out.batt = battery(x0 + L * 0.2, fl + 0.1, zw * 0.62)
      reservoir(x0 + L * 0.22, fl + H * 0.6, -zw * 0.65, 0.12, 0.12, 0.1, MATERIALS.coolant, MATERIALS.coolantLiq, MATERIALS.postBlack)
      c.tube(
        [
          [rx - 0.03, fl + rh * 0.85, -zw * 0.3],
          [ex + eb * 0.6, ey + bh * 0.3, -zw * 0.4],
          [ex + eb / 2, ey + bh * 0.2, -zw * 0.3],
        ],
        0.025,
        MATERIALS.hose,
        { seg: 14, rs: 6 },
      )
      c.tube(
        [
          [rx - 0.03, fl + 0.06, zw * 0.2],
          [ex + eb * 0.7, fl + 0.05, 0],
          [ex + eb / 2, ey - bh * 0.3, -zw * 0.2],
        ],
        0.025,
        MATERIALS.hose,
        { seg: 14, rs: 6 },
      )
      if (mot === 'diesel' && o.turbo !== false) {
        const tx = ex - eb * 0.1
        const ty = ey + bh * 0.1
        const tz = zw * 0.35
        const snail = c.add(new THREE.TorusGeometry(0.06, 0.035, 10, 20), makeMaterial('#8a8478', { metalness: 0.7, roughness: 0.5 }), tx, ty, tz)
        snail.rotation.x = PI / 2
        c.cylinder(0.045, 0.05, 0.08, makeMaterial('#7b756b', { metalness: 0.7, roughness: 0.5 }), tx, ty + 0.05, tz)
        const icx = ex + eb * 0.1
        const icy = ey + bh / 2 + 0.13
        c.roundBox(0.22, 0.05, bz * 0.6, 0.015, makeMaterial('#a7adb1', { metalness: 0.7, roughness: 0.35 }), icx, Math.min(icy, top - 0.04), -zw * 0.05)
        c.tube(
          [
            [tx, ty + 0.09, tz],
            [tx + 0.05, Math.min(icy, top - 0.04), tz],
            [icx - 0.08, Math.min(icy, top - 0.04), zw * 0.15],
          ],
          0.025,
          MATERIALS.steel,
          { seg: 10, rs: 6 },
        )
        out.turbo = new V3(tx, ty, tz)
      }
      out.motor = new V3(ex, ey, -zw * 0.1)
    }
    c.part('engine', { key: mot === 'electric' ? 'engine_electric' : 'engine' }, null, out.motor, 1.0)
    c.part('radiator', { key: 'radiator' }, rad, out.rad, 0.9)
    c.meta.bay = {
      x0: x0,
      x1: x1,
      zw: zw,
      floor: fl,
      top: top,
      motor: mot,
      center: new V3(cx, fl + H * 0.5, 0),
      label: o.label,
      turbo: o.turbo,
      view: o.view,
    }
    return out
  }

  Object.assign(I, {})
}
