/** Truck cab and chassis builders. */
import type { Kit } from './types'

export function installTrucks(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._
  const { makeMaterial, MATERIALS } = I

  /* ================= trucks ================= */
  /* Forward cab. o: { f (front x), W, col, len (2.05), roofY (2.92), belt (1.75), floor (1.25), wheelR (0.52), wheelW (0.32), int:{col,trim}, hl, grille, sleeper } */
  kit.truckCab = function (c: any, o: any) {
    const f = o.f
    const W = o.W
    const col = o.col
    const len = o.len || 2.05
    const ry = o.roofY || 2.92
    const belt = o.belt || 1.75
    const fl = o.floor || 1.25
    const wr = o.wheelR || 0.52
    const ww = o.wheelW || 0.32
    const T = { belt: belt, top: ry + 0.03, k: 0.04 }
    const items = [
      [f - len, 0.95, 0.05],
      [f - len - 0.01, ry - 0.07, 0.15],
      [f - 0.25, ry, 0.2],
      [f - 0.04, ry - 0.32, 0.12],
      [f + 0.03, 1.05, 0.1],
      [f, 0.88, 0.05],
    ]
    const m = c.meta
    m.color = col
    m.kind = m.kind || 'truck'
    const ax = f - 0.85
    const q = kit.quadDef([f + 0.01, belt + 0.03], [f - 0.06, ry - 0.26], W, T, 'front', 0.05, { inset: 0.04, side: 0.12 })
    const poly = [
      [f - len * 0.66, belt + 0.05],
      [f - 0.18, belt + 0.05],
      [f - 0.22, ry - 0.3],
      [f - len * 0.66, ry - 0.3],
    ]
    const holes = [kit.holeSide(poly), kit.holeQuad(q)]
    I.shell(c, {
      items: items,
      bottomY: 0.88,
      arches: [[ax, wr, wr + 0.08]],
      W: W,
      col: col,
      T: T,
      holes: holes,
      archInner: W / 2 - ww - 0.2,
    })
    kit.glassQuad(c, q, { key: 'windshield' })
    kit.sideWindows(c, [poly], W, T, function () {
      return { key: 'cab_window' }
    })
    Object.assign(m, {
      width: W,
      front: f + 0.03,
      clearance: 0.88,
      belt: belt,
      top: ry + 0.03,
      bodyHeight: 1.0,
      tumble: T,
      glasshouse: { fb: f, belt: belt + 0.03, Wg: W },
      cabRear: f - len,
    })
    const ic = o.int || {}
    const fab = makeMaterial(ic.col || '#3a3b3d', { roughness: 0.88 })
    const trim = makeMaterial(ic.trim || '#202124', { roughness: 0.7 })
    const zi = W / 2 - 0.1
    c.roundBox(len - 0.2, 0.04, zi * 2, 0.015, MATERIALS.carpet, f - len / 2 - 0.05, fl, 0)
    kit.dashboard(c, { x: f - 0.12, y: belt + 0.02, w: zi * 2, d: 0.45, h: belt - fl - 0.05, drv: -0.55, mat: trim, top: fab })
    kit.steeringWheel(c, f - 0.7, belt + 0.08, -0.55, { r: 0.24, tilt: 1.05, col: 0.5, mat: trim })
    const sx = f - 1.2
    kit.seat(c, sx, fl, -0.55, { w: 0.52, mat: fab, h: 0.45, back: 0.62 })
    kit.seat(c, sx, fl, 0.45, { w: 0.86, n: 2, mat: fab, h: 0.45, back: 0.6 })
    c.roundBox(0.03, ry - fl - 0.1, zi * 2, 0.01, trim, f - len + 0.08, (ry + fl) / 2, 0)
    c.roundBox(len - 0.4, 0.02, zi * 2 * 0.95, 0.01, MATERIALS.headliner, f - len / 2, ry - 0.06, 0).castShadow = false
    const rim = makeMaterial('#c8c4b8', { metalness: 0.4 })
    ;[1, -1].forEach(function (s) {
      c.roundBox(0.012, 1.5, 0.006, 0.003, MATERIALS.dark, f - len * 0.68, belt, s * (W / 2 + 0.002))
      c.roundBox(0.012, 1.5, 0.006, 0.003, MATERIALS.dark, f - 0.15, belt, s * (W / 2 + 0.002))
      c.roundBox(0.14, 0.04, 0.03, 0.012, MATERIALS.chrome, f - len * 0.6, belt - 0.1, s * (W / 2 + 0.012))
      c.roundBox(0.5, 0.05, 0.25, 0.02, MATERIALS.steel, f - 1.62, 0.62, s * (W / 2 - 0.1))
      c.roundBox(0.5, 0.05, 0.25, 0.02, MATERIALS.steel, f - 1.62, 0.32, s * (W / 2 - 0.1))
      c.tube(
        [
          [f - 0.2, 2.4, s * (W / 2)],
          [f + 0.1, 2.5, s * (W / 2 + 0.25)],
          [f + 0.1, 2.0, s * (W / 2 + 0.32)],
        ],
        0.02,
        MATERIALS.trim,
      )
      c.roundBox(0.06, 0.45, 0.22, 0.03, MATERIALS.trim, f + 0.1, 2.1, s * (W / 2 + 0.33))
      c.roundBox(0.01, 0.4, 0.18, 0.01, MATERIALS.chrome, f + 0.065, 2.1, s * (W / 2 + 0.33))
      kit.headlight(c, Object.assign({ style: 'truck', x: f + 0.1, y: 0.74, z: s * (W / 2 - 0.32), w: 0.38, h: 0.18, side: s }, o.hl || {}))
      c.wheel(ax, s * (W / 2 - 0.2), wr, ww, { rim: rim, spokes: 8 })
    })
    kit.grille(c, Object.assign({ style: 'truck', x: f + 0.05, y: 1.35, w: W * 0.66, h: 0.56, col: col }, o.grille || {}))
    m.frontBumper = c.roundBox(0.22, 0.32, W + 0.04, 0.06, MATERIALS.trim, f + 0.06, 0.72, 0, { def: true })
    c.part('bumper', { key: 'bumper_front' }, m.frontBumper, new V3(f + 0.1, 0.72, 0), 1.1)
    c.plate(f + 0.175, 0.56, 0, '+x')
    c.part('engine', { key: 'engine' }, null, new V3(f - 1.0, 0.95, 0), 1.0)
    c.part('radiator', { key: 'radiator' }, null, new V3(f - 0.1, 1.2, 0), 0.9)
    if (o.visor !== false) c.roundBox(0.9, 0.3, W * 0.92, 0.12, c.paint(col), f - 1.2, ry + 0.16, 0, { taper: { sx: 0.6, shift: -0.25 } })
    return m
  }
  /* Chassis, rear axles, tank and fenders. o: { f, L, W, axles:[x..], dual, tank ('left'|'right'|false), wheelR, wheelW } */
  kit.truckChassis = function (c: any, o: any) {
    const f = o.f
    const L = o.L
    const W = o.W
    const rear = f - L
    const m = c.meta
    const rim = makeMaterial('#c8c4b8', { metalness: 0.4 })
    const wr = o.wheelR || 0.52
    const ww = o.wheelW || 0.32
    ;[0.42, -0.42].forEach(function (z) {
      c.roundBox(L - 0.3, 0.25, 0.12, 0.03, MATERIALS.trim, (f + rear) / 2 - 0.1, 0.68, z)
    })
    const axles = o.axles || [rear + 1.9, rear + 0.85]
    axles.forEach(function (x: any) {
      ;[1, -1].forEach(function (s) {
        c.wheel(x, s * (W / 2 - 0.2), wr, ww, { rim: rim, spokes: 8 })
        if (o.dual !== false) c.wheel(x, s * (W / 2 - 0.55), wr, ww - 0.02, { rim: rim, spokes: 8, noPart: true })
      })
    })
    const ts = o.tank === 'right' ? 1 : -1
    if (o.tank !== false) {
      c.cylinder(0.3, 0.3, 1.1, MATERIALS.chrome, f - 2.8, 0.55, ts * (W / 2 - 0.35), 'x', { seg: 24 })
      c.cylinder(0.08, 0.08, 0.04, MATERIALS.trim, f - 2.6, 0.86, ts * (W / 2 - 0.35))
      c.part('fuel_tank', { key: 'diesel_tank' }, null, new V3(f - 2.8, 0.55, ts * (W / 2 - 0.35)), 0.8)
    }
    c.roundBox(0.6, 0.45, 0.5, 0.04, MATERIALS.trim, f - 2.8, 0.55, -ts * (W / 2 - 0.35))
    ;[1, -1].forEach(function (s) {
      c.roundBox(0.02, 0.5, 0.55, 0.01, MATERIALS.rubber, rear + 0.35, 0.45, s * (W / 2 - 0.35))
    })
    c.roundBox(0.1, 0.12, W * 0.9, 0.03, MATERIALS.steel, rear + 0.05, 0.5, 0)
    c.plate(rear - 0.01, 0.7, 0, '-x')
    ;[1, -1].forEach(function (s) {
      kit.taillight(c, { style: 'vertical', x: rear + 0.06, y: 0.66, z: s * (W / 2 - 0.25), w: 0.12, h: 0.24, side: s })
    })
    m.rear = rear
    m.length = L
  }

  Object.assign(I, {})
}
