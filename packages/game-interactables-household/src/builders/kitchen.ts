import type { Vec3 } from '@adatechnology/game-interactables'
import type { Ctx } from '../ctx'
import { HANDLE, dropDoor, hingedDoor, shell } from '../parts'
import { mix, round3, shade } from '../util'

const STEEL = 0xb4b8bc
const CHROME = 0xd2d6da

/**
 * Kitchen / bathroom tap: base, stem, curved spout toward +z and a lever part. Returns the outlet position.
 * `y` is the counter top the tap stands on.
 */
function tap(c: Ctx, x: number, y: number, z: number, id: string, partId: string): Vec3 {
  c.cyl('metal', x, y, z, 0.03, 0.02, STEEL, 'cyl')
  c.cyl('metal', x, y + 0.02, z, 0.017, 0.2, CHROME, 'cyl')
  c.cyl('metal', x, y + 0.2, z, 0.021, 0.02, STEEL, 'cyl')
  c.b('metal', x - 0.015, y + 0.205, z, x + 0.015, y + 0.235, z + 0.015, CHROME)
  c.b('metal', x - 0.014, y + 0.205, z + 0.015, x + 0.014, y + 0.235, z + 0.19, CHROME)
  c.cyl('metal', x, y + 0.185, z + 0.18, 0.016, 0.03, STEEL, 'cyl')
  // lever on the side of the stem
  c.part(
    partId,
    [x, y + 0.12, z],
    { kind: 'knob', axis: [0, 1, 0], angle: 0.9 },
    () => {
      c.b('metal', x - 0.015, y + 0.115, z - 0.015, x + 0.015, y + 0.125, z + 0.015, STEEL)
      c.b('metal', x + 0.01, y + 0.118, z - 0.008, x + 0.08, y + 0.134, z + 0.008, CHROME)
    },
    { label: 'prompt.tap', at: false, noSweep: true },
  )
  const outlet: Vec3 = [round3(x), round3(y + 0.185), round3(z + 0.18)]
  c.add('fixtures', { id, kind: 'tap', outlet, dir: [0, -1, 0], flow: 7, part: partId, tank: 'auto' })
  c.add('emitters', { id: `${id}_water`, kind: 'water', pos: outlet, dir: [0, -1, 0], source: id, size: 0.02, reach: 0.3 })
  c.interact(`use_${id}`, [round3(x + 0.05), round3(y + 0.126), round3(z)], { do: 'toggle_fixture', fixture: id }, 'prompt.tap', 1.3)
  return outlet
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Stove
// ---------------------------------------------------------------------------------------------------------------------------------

export function stove(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.main(0xe6e8ea)
  const zf = hd - HANDLE
  const dt = 0.04
  const zb = zf - dt - 0.003
  const top = h - 0.05
  // body: side panels, back, plinth, cooktop plate
  c.b('plain', -hw, 0.04, -hd, -hw + 0.02, top, zf, body)
  c.b('plain', hw - 0.02, 0.04, -hd, hw, top, zf, body)
  c.b('plain', -hw + 0.02, 0.04, -hd, hw - 0.02, top, -hd + 0.015, shade(body, 0.85))
  c.b('plain', -hw + 0.01, 0, -hd + 0.02, hw - 0.01, 0.04, zf - 0.03, 0x2c2e30)
  c.b('metal', -hw, top, -hd, hw, h - 0.025, zf + 0.004, 0x9ea3a8) // stainless cooktop plate
  c.b('metal', -hw + 0.006, h - 0.025, -hd + 0.006, hw - 0.006, h - 0.02, zf - 0.002, 0xb4b8bc)
  // oven cavity (dark liner so the open door shows depth)
  const ox0 = -hw + 0.04
  const ox1 = hw - 0.04
  const oy0 = 0.1
  const oy1 = 0.7
  c.b('plain', ox0, oy0, -hd + 0.03, ox1, oy0 + 0.01, zb, 0x55575a)
  c.b('plain', ox0, oy1 - 0.01, -hd + 0.03, ox1, oy1, zb, 0x55575a)
  c.b('plain', ox0, oy0 + 0.01, -hd + 0.03, ox0 + 0.01, oy1 - 0.01, zb, 0x68696c)
  c.b('plain', ox1 - 0.01, oy0 + 0.01, -hd + 0.03, ox1, oy1 - 0.01, zb, 0x68696c)
  c.b('plain', ox0 + 0.01, oy0 + 0.01, -hd + 0.03, ox1 - 0.01, oy1 - 0.01, -hd + 0.04, 0x6e6f72)
  for (const y of [0.28, 0.46]) c.b('metal', ox0 + 0.01, y, -hd + 0.04, ox1 - 0.01, y + 0.006, zb - 0.03, 0x9a9ea2) // racks
  // front panel strip above the oven door
  c.b('plain', -hw + 0.02, oy1 + 0.003, zb, hw - 0.02, top, zf, body)
  c.b('plain', -hw + 0.02, oy1 + 0.003, zf - 0.004, hw - 0.02, oy1 + 0.012, zf, shade(body, 0.8))
  // oven door hinged at the bottom
  dropDoor(c, {
    id: 'oven_door', x0: -hw + 0.012, x1: hw - 0.012, y0: 0.045, y1: oy1 - 0.004, zf, t: dt, color: shade(body, 0.95), inner: 0x8a8c90, angle: 1.5, handle: 'bar_h', handleLen: 0.4, label: 'prompt.oven_door',
    extra: () => {
      // window: dark glass framed by a raised bezel
      c.b('plain', -hw + 0.07, 0.15, zf - 0.002, hw - 0.07, 0.56, zf + 0.002, shade(body, 0.8))
      c.plane('glass', 0, 0.355, zf + 0.0025, c.w - 0.2, 0.36, 0x1c1e22)
    },
  })
  // burners + knobs
  const bx = [-0.14, 0.14]
  const bz = [-hd * 0.35, hd * 0.25]
  const topY = h - 0.02
  let n = 0
  const knobXs = [-0.2, -0.1, 0.0, 0.1, 0.2].map((v) => v * (c.w / 0.6))
  const rate = 0.00006
  for (const z of bz) {
    for (const x of bx) {
      n++
      const bid = `burner_${n}`
      const big = n === 1 || n === 4
      const r = big ? 0.062 : 0.048
      c.cyl('metal', x, topY, z, r + 0.012, 0.006, 0x1c1c1e, 'cyl')
      c.cyl('metal', x, topY + 0.006, z, r * 0.62, 0.012, 0x2e2e32, 'cyl')
      c.cyl('metal', x, topY + 0.015, z, r * 0.4, 0.006, 0x8a8c90, 'cyl')
      // grate over every burner: two crossing bars and a rim
      for (const s of [-1, 1]) {
        c.b('metal', x - r - 0.03, topY + 0.02, z + s * r - 0.006, x + r + 0.03, topY + 0.032, z + s * r + 0.006, 0x222224)
        c.b('metal', x + s * r - 0.006, topY + 0.02, z - r - 0.03, x + s * r + 0.006, topY + 0.032, z + r + 0.03, 0x222224)
      }
      const knobId = `knob_${n}`
      const kx = knobXs[n - 1]
      c.part(knobId, [kx, 0.81, zf], { kind: 'knob', axis: [0, 0, 1], angle: -2.0 }, () => knob(c, kx, 0.81, zf), { label: 'prompt.stove_knob', at: false, noSweep: true, radius: 0.9 })
      c.add('burners', { id: bid, pos: [x, round3(topY + 0.02), z], part: knobId, fuel: 'auto', rate })
      c.add('emitters', { id: `${bid}_flame`, kind: 'flame', pos: [x, round3(topY + 0.02), z], dir: [0, 1, 0], source: bid, size: r })
      c.interact(`use_${bid}`, [kx, 0.81, zf + HANDLE], { do: 'toggle_burner', burner: bid }, 'prompt.stove_burner', 0.9)
    }
  }
  // oven knob (fifth)
  const ok = knobXs[4]
  c.part('knob_oven', [ok, 0.81, zf], { kind: 'knob', axis: [0, 0, 1], angle: -2.0 }, () => knob(c, ok, 0.81, zf), { label: 'prompt.stove_knob', at: false, noSweep: true, radius: 0.9 })
  c.add('burners', { id: 'oven', pos: [0, 0.13, -0.05], part: 'knob_oven', fuel: 'auto', rate: rate * 2 })
  c.add('emitters', { id: 'oven_flame', kind: 'flame', pos: [0, 0.13, -0.05], dir: [0, 1, 0], source: 'oven', size: 0.1 })
  c.interact('use_oven', [ok, 0.81, zf + HANDLE], { do: 'toggle_burner', burner: 'oven' }, 'prompt.stove_oven', 0.9)
  // gas hose from the inlet at the back to the connection point behind the stove
  c.add('wires', {
    id: 'gas_hose', kind: 'cable', radius: 0.008,
    points: [[round3(hw - 0.08), 0.18, -hd], [round3(hw - 0.08), 0.12, round3(-hd - 0.12)], [round3(hw - 0.1), 0.06, round3(-hd - 0.3)], [round3(hw - 0.2), 0.03, round3(-hd - 0.5)]],
  })
  c.add('damage', { target: 'oven_door', kind: 'glass', hp: 30 })
}

/** Stove knob drawn at (x, y) on the front face z = zf; part frame handled by the caller. */
function knob(c: Ctx, x: number, y: number, zf: number): void {
  c.rod('plain', 'z', x, y, zf + 0.008, 0.009, 0.016, 0x2a2a2c, 'cyl6')
  c.rod('plain', 'z', x, y, zf + 0.0205, 0.0195, 0.013, 0x1e1e20)
  c.rod('plain', 'z', x, y, zf + 0.0275, 0.0145, 0.003, 0x3c3c40)
  c.b('plain', x - 0.0025, y + 0.002, zf + 0.027, x + 0.0025, y + 0.0185, zf + 0.029, 0xe8e8e8) // pointer
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Gas bottle
// ---------------------------------------------------------------------------------------------------------------------------------

export function gasBottle(c: Ctx): void {
  const g = c.region.gas
  const R = Math.min(g.diameter, c.w, c.d) / 2
  const H = Math.min(g.height, c.h)
  const col = Number.parseInt(g.color.replace('#', ''), 16)
  c.cyl('metal', 0, 0, 0, R * 0.9, 0.03, 0x4a4c50, 'cyl') // foot ring
  c.cyl('metal', 0, 0.025, 0, R * 0.98, 0.02, shade(col, 0.8), 'sphere')
  c.cyl('metal', 0, 0.035, 0, R, H - 0.035 - 0.17, col, 'cyl')
  c.cyl('metal', 0, 0.035 + (H - 0.205) * 0.55, 0, R + 0.002, 0.05, 0xf0ece0, 'cyl') // label band
  c.cyl('metal', 0, H - 0.29, 0, R, 0.24, col, 'sphere') // shoulder
  // protective guard: four posts and a top ring
  const gr = 0.085
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.b('metal', sx * gr - 0.008, H - 0.16, sz * gr - 0.008, sx * gr + 0.008, H - 0.03, sz * gr + 0.008, shade(col, 0.7))
  c.b('metal', -gr - 0.008, H - 0.034, -gr - 0.008, gr + 0.008, H - 0.022, -gr + 0.008, shade(col, 0.7))
  c.b('metal', -gr - 0.008, H - 0.034, gr - 0.008, gr + 0.008, H - 0.022, gr + 0.008, shade(col, 0.7))
  c.b('metal', -gr - 0.008, H - 0.034, -gr + 0.008, -gr + 0.008, H - 0.022, gr - 0.008, shade(col, 0.7))
  c.b('metal', gr - 0.008, H - 0.034, -gr + 0.008, gr + 0.008, H - 0.022, gr - 0.008, shade(col, 0.7))
  // neck + valve
  c.cyl('metal', 0, H - 0.17, 0, 0.032, 0.1, 0xc8a24a, 'cyl')
  c.cyl('metal', 0, H - 0.075, 0, 0.022, 0.03, 0x9c7c32, 'cyl6')
  c.b('metal', 0.02, H - 0.1, -0.012, 0.075, H - 0.07, 0.012, 0xb08a34) // outlet spigot toward +x
  c.part(
    'valve',
    [0, H - 0.045, 0],
    { kind: 'knob', axis: [0, 1, 0], angle: 1.6 },
    () => {
      c.cyl('metal', 0, H - 0.045, 0, 0.01, 0.025, 0x8a6a2a, 'cyl6')
      c.b('metal', -0.04, H - 0.022, -0.009, 0.04, H - 0.012, 0.009, 0xd8d8dc)
      c.b('metal', -0.009, H - 0.022, -0.04, 0.009, H - 0.012, 0.04, 0xd8d8dc)
    },
    { label: 'prompt.gas_valve', at: false, noSweep: true, radius: 1.0 },
  )
  c.add('fuels', { id: 'gas', kind: 'gas', capacity: g.capacityKg, level: g.capacityKg, valve: 'valve' })
  c.add('damage', { target: 'gas', kind: 'gas', hp: 40 })
  c.interact('use_gas', [0, H, 0], { do: 'toggle_fuel', fuel: 'gas' }, 'prompt.gas_valve', 1.0)
  c.spec.colliders = []
  c.collider('body', -R, 0, -R, R, H, R)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Sinks
// ---------------------------------------------------------------------------------------------------------------------------------

interface SinkOptions {
  /** Cabinet height (counter top). */
  top: number
  /** Basin x range and z range at the top. */
  bx0: number
  bx1: number
  bz0: number
  bz1: number
  depth: number
  counter: number
  steel: boolean
}

function counterWithBasin(c: Ctx, o: SinkOptions): void {
  const { hw, hd } = c
  const y0 = o.top - 0.04
  const zf = hd - HANDLE + 0.02
  const col = o.counter
  c.b('wood', -hw, y0, -hd, o.bx0, o.top, zf, col)
  c.b('wood', o.bx1, y0, -hd, hw, o.top, zf, col)
  c.b('wood', o.bx0, y0, -hd, o.bx1, o.top, o.bz0, col)
  c.b('wood', o.bx0, y0, o.bz1, o.bx1, o.top, zf, col)
  const wall = o.steel ? 0xc4c8cc : 0xf4f6f6
  const floor = o.steel ? 0xaeb2b6 : 0xe6e9ea
  const mat = o.steel ? 'metal' : 'plain'
  const yb = o.top - o.depth
  c.b(mat, o.bx0 - 0.01, yb, o.bz0 - 0.01, o.bx1 + 0.01, yb + 0.01, o.bz1 + 0.01, floor)
  c.b(mat, o.bx0 - 0.01, yb + 0.01, o.bz0 - 0.01, o.bx0, o.top - 0.001, o.bz1 + 0.01, wall)
  c.b(mat, o.bx1, yb + 0.01, o.bz0 - 0.01, o.bx1 + 0.01, o.top - 0.001, o.bz1 + 0.01, wall)
  c.b(mat, o.bx0, yb + 0.01, o.bz0 - 0.01, o.bx1, o.top - 0.001, o.bz0, shade(wall, 0.95))
  c.b(mat, o.bx0, yb + 0.01, o.bz1, o.bx1, o.top - 0.001, o.bz1 + 0.01, shade(wall, 1.03))
  c.cyl('metal', (o.bx0 + o.bx1) / 2, yb + 0.01, (o.bz0 + o.bz1) / 2, 0.035, 0.004, 0x6a6e72, 'cyl')
  // rim
  c.b(mat, o.bx0 - 0.02, o.top, o.bz0 - 0.02, o.bx1 + 0.02, o.top + 0.004, o.bz0, wall)
  c.b(mat, o.bx0 - 0.02, o.top, o.bz1, o.bx1 + 0.02, o.top + 0.004, o.bz1 + 0.02, wall)
  c.b(mat, o.bx0 - 0.02, o.top, o.bz0, o.bx0, o.top + 0.004, o.bz1, wall)
  c.b(mat, o.bx1, o.top, o.bz0, o.bx1 + 0.02, o.top + 0.004, o.bz1, wall)
}

/** Drain pipe from the basin down to a trap and back to the wall. `z` is where the drain leaves the basin. */
function pipes(c: Ctx, x: number, top: number, z: number): void {
  const wall = -c.hd + 0.03
  c.cyl('metal', x, 0.2, z, 0.02, top - 0.2 - 0.12, 0xc8ccd0, 'cyl6')
  c.rod('plain', 'x', x + 0.06, 0.2, z, 0.02, 0.14, 0xe8e8e8, 'cyl6')
  c.cyl('plain', x + 0.13, 0.08, z, 0.02, 0.14, 0xe8e8e8, 'cyl6')
  c.rod('plain', 'z', x + 0.13, 0.09, (z + wall) / 2, 0.02, z - wall, 0xe8e8e8, 'cyl6')
}

export function sinkKitchen(c: Ctx): void {
  const { hw, hd } = c
  const body = c.wood(0xcdb690)
  const front = c.main(0xe4dccb)
  const lining = mix(body, 0xffffff, 0.55)
  const top = 0.9
  const zf = hd - HANDLE
  const t = 0.02
  const zr = zf - t - 0.003
  const sh = shell(c, { x0: -hw, x1: hw, y0: 0.1, y1: top - 0.04, z0: -hd, z1: zr, color: body, inner: lining, t: 0.018, noTop: true })
  c.b('wood', -hw + 0.01, 0, -hd + 0.03, hw - 0.01, 0.1, zr - 0.04, 0x3a3836)
  const bx0 = -hw * 0.62
  const bx1 = -hw * 0.05
  const bz0 = -hd * 0.65
  const bz1 = hd * 0.45
  counterWithBasin(c, { top, bx0, bx1, bz0, bz1, depth: 0.2, counter: 0x7c7a78, steel: true })
  // drainboard grooves on the right
  for (let i = 0; i < 7; i++) c.b('metal', bx1 + 0.06, top, bz0 + 0.04 + i * 0.07, hw - 0.06, top + 0.004, bz0 + 0.052 + i * 0.07, 0x9a9ea2)
  tap(c, (bx0 + bx1) / 2, top, -hd + 0.07, 'tap', 'tap_handle')
  pipes(c, (bx0 + bx1) / 2, top, -hd + 0.17)
  // doors
  const mid = 0.0015
  hingedDoor(c, { id: 'door_1', x0: -hw + 0.003, x1: -mid, y0: 0.103, y1: top - 0.043, zf, t, side: 'left', color: front, inner: lining, handle: 'bar_v', handleLen: 0.22, label: 'prompt.door' })
  hingedDoor(c, { id: 'door_2', x0: mid, x1: hw - 0.003, y0: 0.103, y1: top - 0.043, zf, t, side: 'right', color: front, inner: lining, handle: 'bar_v', handleLen: 0.22, label: 'prompt.door' })
  const sx0 = 0.05
  const sx1 = sh.ix1 - 0.01
  c.container({
    id: 'under_sink', access: 'door_2', from: [sx0, sh.iy0, sh.iz0], to: [sx1, sh.iy1, sh.iz1],
    slots: c.row(sx0, sx1, sh.iy0, (sh.iz0 + sh.iz1) / 2, 1, [0.5, 0.45, 0.45]), loot: 'under_sink',
  })
}

export function sinkBathroom(c: Ctx): void {
  const { hw, hd } = c
  const body = c.main(0xeceff0)
  const lining = 0xf6f8f8
  const top = 0.8
  const zf = hd - HANDLE
  const t = 0.02
  const zr = zf - t - 0.003
  const sh = shell(c, { x0: -hw, x1: hw, y0: 0.08, y1: top - 0.04, z0: -hd, z1: zr, color: body, inner: lining, t: 0.016, noTop: true, material: 'plain' })
  c.b('plain', -hw + 0.01, 0, -hd + 0.03, hw - 0.01, 0.08, zr - 0.04, 0x3a3836)
  counterWithBasin(c, { top, bx0: -hw * 0.6, bx1: hw * 0.6, bz0: -hd * 0.5, bz1: hd * 0.55, depth: 0.14, counter: 0xe9e4da, steel: false })
  c.b('plain', -hw, top, -hd, hw, top + 0.08, -hd + 0.015, 0xe9e4da) // backsplash lip
  tap(c, 0, top, -hd + 0.07, 'tap', 'tap_handle')
  pipes(c, 0, top, -hd + 0.17)
  hingedDoor(c, { id: 'door', x0: -hw + 0.003, x1: hw - 0.003, y0: 0.083, y1: top - 0.043, zf, t, side: c.M.hinge ?? 'left', color: body, inner: lining, style: 'flat', handle: 'knob', label: 'prompt.door' })
  c.container({
    id: 'under_sink', access: 'door', from: [sh.ix0, sh.iy0, sh.iz0], to: [sh.ix1, sh.iy1, sh.iz1],
    slots: c.row(sh.ix0 + 0.15, sh.ix1 - 0.01, sh.iy0, (sh.iz0 + sh.iz1) / 2, 1, [0.3, 0.4, 0.3]), loot: 'under_sink',
  })
}

export function utilitySink(c: Ctx): void {
  const { hw, hd } = c
  const tubTop = 0.88
  const wall = 0xcfd1d0
  const bw = c.w - 0.04
  // legs and a frame
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b('metal', sx * (hw - 0.04) - 0.02, 0, sz * (hd - 0.04) - 0.02, sx * (hw - 0.04) + 0.02, tubTop - 0.3, sz * (hd - 0.04) + 0.02, 0x6a6e72)
  c.b('metal', -hw, tubTop - 0.34, -hd, hw, tubTop - 0.3, hd, 0x6a6e72)
  // deep tub: bottom, four walls, lighter inside
  const x0 = -bw / 2
  const x1 = bw / 2
  const z0 = -hd + 0.02
  const z1 = hd - 0.02 - 0.0
  c.b('plain', x0, tubTop - 0.3, z0, x1, tubTop - 0.28, z1, wall)
  c.b('plain', x0, tubTop - 0.28, z0, x0 + 0.03, tubTop, z1, shade(wall, 0.92))
  c.b('plain', x1 - 0.03, tubTop - 0.28, z0, x1, tubTop, z1, shade(wall, 0.92))
  c.b('plain', x0 + 0.03, tubTop - 0.28, z0, x1 - 0.03, tubTop + 0.08, z0 + 0.03, shade(wall, 0.88))
  c.b('plain', x0 + 0.03, tubTop - 0.28, z1 - 0.03, x1 - 0.03, tubTop, z1, shade(wall, 0.95))
  c.b('plain', x0 + 0.03, tubTop - 0.278, z0 + 0.03, x1 - 0.03, tubTop - 0.276, z1 - 0.03, 0xeceeee) // inner floor
  c.cyl('metal', 0, tubTop - 0.276, 0, 0.035, 0.004, 0x6a6e72, 'cyl')
  // washboard at the front, slanted
  c.b('plain', x0 + 0.04, tubTop - 0.27, z1 - 0.2, x0 + 0.04 + (x1 - x0) * 0.4, tubTop - 0.1, z1 - 0.06, 0xdadddc, 0, 0.5)
  tap(c, 0, tubTop + 0.08, -hd + 0.08, 'tap', 'tap_handle')
  c.add('fixtures', { id: 'basin', kind: 'utility_sink', outlet: [0, round3(tubTop - 0.1), 0], dir: [0, -1, 0], flow: 12, tank: 'auto' })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Shower, toilet
// ---------------------------------------------------------------------------------------------------------------------------------

export function shower(c: Ctx): void {
  const { hw, hd, h } = c
  const tile = c.main(0xe6e9ea)
  // tray with a raised rim and a slightly lower drain area
  c.b('plain', -hw, 0.001, -hd, hw, 0.07, hd, 0xf1f3f3)
  c.b('plain', -hw + 0.06, 0.07, -hd + 0.06, hw - 0.06, 0.072, hd - 0.06, 0xdfe3e4)
  c.cyl('metal', 0, 0.072, 0, 0.05, 0.004, STEEL, 'cyl')
  for (let i = 0; i < 4; i++) c.b('plain', -0.04, 0.076, -0.03 + i * 0.02, 0.04, 0.078, -0.022 + i * 0.02, 0x6a6e72)
  // tiled walls (back and left) with a darker grout line pattern
  c.b('plain', -hw, 0.07, -hd, hw, h, -hd + 0.03, tile)
  c.b('plain', -hw, 0.07, -hd + 0.03, -hw + 0.03, h, hd - 0.05, tile)
  for (let y = 0.4; y < h - 0.2; y += 0.3) {
    c.b('plain', -hw + 0.03, y, -hd + 0.03, hw, y + 0.006, -hd + 0.033, 0xc2c6c8)
    c.b('plain', -hw + 0.03, y, -hd + 0.033, -hw + 0.033, y + 0.006, hd - 0.05, 0xc2c6c8)
  }
  c.b('plain', -hw + 0.03, 1.0, -hd + 0.033, hw, 1.12, -hd + 0.036, 0x8aa6b4) // accent strip
  // aluminum frame: top rail and posts
  const f = 0.02
  c.b('metal', -hw + 0.03, h - f, hd - 0.05, hw, h, hd, 0xc4c8cc)
  c.b('metal', hw - f, 0.07, -hd + 0.03, hw, h, hd, 0xc4c8cc)
  c.b('metal', -hw + 0.03, h - f, -hd + 0.03, hw, h, -hd + 0.03 + 0.001, 0xc4c8cc)
  // shower head on an arm, valve on the back wall
  const hy = 1.95
  c.b('metal', -0.015, hy, -hd + 0.03, 0.015, hy + 0.02, -hd + 0.2, CHROME)
  c.cyl('metal', 0, hy - 0.02, -hd + 0.2, 0.075, 0.03, 0xe8eaec, 'cyl')
  c.cyl('metal', 0, hy - 0.026, -hd + 0.2, 0.06, 0.006, 0x9a9ea2, 'cyl')
  c.part('valve', [0.25, 1.1, -hd + 0.03], { kind: 'knob', axis: [0, 0, 1], angle: 1.7 }, () => {
    c.rod('metal', 'z', 0.25, 1.1, -hd + 0.04, 0.03, 0.02, STEEL)
    c.b('metal', 0.25 - 0.005, 1.1 - 0.035, -hd + 0.05, 0.25 + 0.005, 1.1 + 0.035, -hd + 0.06, CHROME)
  }, { label: 'prompt.shower', at: false, noSweep: true, radius: 1.3 })
  const outlet: Vec3 = [0, hy - 0.03, round3(-hd + 0.2)]
  c.add('fixtures', { id: 'shower', kind: 'shower', outlet, dir: [0, -1, 0.15], flow: 9, part: 'valve', tank: 'auto', heater: 'heater' })
  c.add('devices', { id: 'heater', kind: 'heater', watts: 5500, circuit: c.M.circuit ?? 'shower' })
  c.add('emitters', { id: 'shower_water', kind: 'water', pos: outlet, dir: [0, -1, 0.15], source: 'shower', size: 0.35 })
  c.add('emitters', { id: 'shower_steam', kind: 'steam', pos: [0, 1.4, 0], dir: [0, 1, 0], source: 'shower', size: 0.8 })
  c.interact('use_shower', [0.25, 1.1, -hd + 0.08], { do: 'toggle_fixture', fixture: 'shower' }, 'prompt.shower', 1.3)
  // glass: fixed panel at the front-left, side panel on the right, sliding door in front of it (soft, never colliders)
  const gl = 0xbfdbe6
  const zFixed = hd - 0.015
  const zSlide = hd - 0.04
  const gh = h - 0.1
  const gy = 0.075
  c.b('glass', -hw + 0.03, gy, zFixed - 0.004, 0.02, gy + gh, zFixed + 0.004, gl)
  c.b('glass', hw - 0.032, gy, -hd + 0.03, hw - 0.024, gy + gh, hd - 0.05, gl)
  const dw = (hw - 0.03) * 0.55 + 0.02
  const dx1 = hw - 0.03
  c.part(
    'glass_door', [dx1 - dw / 2, gy, zSlide], { kind: 'slide', axis: [-1, 0, 0], distance: round3(dw - 0.06) },
    () => {
      c.b('glass', dx1 - dw, gy, zSlide - 0.004, dx1, gy + gh, zSlide + 0.004, gl)
      c.b('metal', dx1 - dw, gy, zSlide - 0.008, dx1, gy + 0.015, zSlide + 0.008, 0xc4c8cc)
      c.b('metal', dx1 - dw, gy + gh - 0.015, zSlide - 0.008, dx1, gy + gh, zSlide + 0.008, 0xc4c8cc)
      c.b('metal', dx1 - dw, gy + gh * 0.45, zSlide + 0.004, dx1 - dw + 0.02, gy + gh * 0.45 + 0.3, zSlide + 0.024, 0xc4c8cc) // grip
    },
    { label: 'prompt.glass_door', at: [dx1 - dw / 2, 1.0, zSlide + 0.03] },
  )
  c.add('soft', { id: 'glass_door', kind: 'panel', anchor: [round3(dx1 - dw / 2), round3(gy + gh), zSlide], size: [round3(dw), round3(gh), 0.01], stiffness: 18, damping: 6, maxAngle: 0.35, wind: 0, part: 'glass_door' })
  c.add('soft', { id: 'glass_fixed', kind: 'panel', anchor: [round3((-hw + 0.03 + 0.02) / 2), round3(gy + gh), zFixed], size: [round3(hw + 0.02 - 0.03), round3(gh), 0.01], stiffness: 18, damping: 6, maxAngle: 0.2, wind: 0 })
  c.add('damage', { target: 'glass_door', kind: 'glass', hp: 25 })
  // only the tiled walls block
  c.spec.colliders = []
  c.collider('wall_back', -hw, 0, -hd, hw, h, -hd + 0.03)
  c.collider('wall_left', -hw, 0, -hd + 0.03, -hw + 0.03, h, hd - 0.05)
}

export function toilet(c: Ctx): void {
  const { hd } = c
  const w = c.main(0xf4f5f4)
  const sh = shade(w, 0.94)
  // pedestal and bowl
  c.cyl('plain', 0, 0, -0.02, 0.13, 0.28, sh, 'cyl')
  c.cyl('plain', 0, 0.2, 0.02, 0.19, 0.2, w, 'sphere') // bowl body (ellipsoid)
  c.b('plain', -0.17, 0.36, -0.2, 0.17, 0.4, -0.02, w)
  c.cyl('plain', 0, 0.36, 0.12, 0.19, 0.04, w, 'cyl')
  c.cyl('plain', 0, 0.395, 0.12, 0.14, 0.005, 0xdfe8ec, 'cyl') // water in the bowl
  // cistern
  const ty = 0.42
  const th = 0.8 - ty - 0.025
  c.b('plain', -0.19, ty, -hd, 0.19, ty + th, -hd + 0.2, w)
  c.b('plain', -0.195, ty + th, -hd - 0.0, 0.195, ty + th + 0.025, -hd + 0.205, sh) // lid
  c.b('plain', -0.185, ty + 0.01, -hd + 0.2, 0.185, ty + 0.03, -hd + 0.215, sh)
  // seat ring
  const seatY = 0.4
  c.cyl('plain', 0, seatY, 0.12, 0.2, 0.025, 0xeef0f0, 'cyl')
  c.cyl('plain', 0, seatY + 0.025, 0.12, 0.13, 0.002, 0xdfe8ec, 'cyl')
  c.b('plain', -0.17, seatY, -0.07, 0.17, seatY + 0.025, 0.0, 0xeef0f0)
  // lid, hinged at the back of the seat
  c.part(
    'lid', [0, seatY + 0.025, -0.06], { kind: 'hinge', axis: [1, 0, 0], angle: -1.65 },
    () => {
      c.cyl('plain', 0, seatY + 0.027, 0.12, 0.2, 0.012, w, 'cyl')
      c.b('plain', -0.17, seatY + 0.027, -0.07, 0.17, seatY + 0.039, 0.0, w)
      c.cyl('plain', 0, seatY + 0.039, 0.12, 0.17, 0.003, shade(w, 1.02), 'cyl')
    },
    { label: 'prompt.toilet_lid', at: [0, seatY + 0.05, 0.14] },
  )
  // flush button on the cistern lid
  c.part(
    'flush_button', [0, ty + th + 0.025, -hd + 0.1], { kind: 'slide', axis: [0, -1, 0], distance: 0.012 },
    () => {
      c.cyl('metal', 0, ty + th + 0.025, -hd + 0.1, 0.04, 0.012, 0xd2d6da, 'cyl')
      c.cyl('metal', 0, ty + th + 0.037, -hd + 0.1, 0.03, 0.002, 0xe6eaee, 'cyl')
    },
    { label: 'prompt.flush', at: false, noSweep: true },
  )
  c.add('fixtures', { id: 'flush', kind: 'flush', outlet: [0, 0.36, 0.12], dir: [0, -1, 0], volume: 6, part: 'flush_button', tank: 'auto' })
  c.add('emitters', { id: 'flush_water', kind: 'water', pos: [0, 0.38, 0.12], dir: [0, -1, 0], source: 'flush', size: 0.2, reach: 0.12 })
  c.interact('use_flush', [0, ty + th + 0.05, -hd + 0.1], { do: 'toggle_fixture', fixture: 'flush' }, 'prompt.flush')
  c.add('damage', { target: 'self', kind: 'plastic', hp: 60 })
}
