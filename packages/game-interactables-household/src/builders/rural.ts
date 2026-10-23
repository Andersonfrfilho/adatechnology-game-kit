import type { Vec3 } from '@adatechnology/game-interactables'
import type { Ctx } from '../ctx'
import { HANDLE } from '../parts'
import { mix, round3, shade } from '../util'
import { bricks } from './outdoor'

/** Irregular stone masonry between two corners: courses of blocks of random width, a mortar core behind them. Deterministic per seed. */
export function stones(c: Ctx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, mortar = 0x9c968a): void {
  c.b('plain', x0 + 0.01, y0, z0 + 0.01, x1 - 0.01, y1, z1 - 0.01, mortar)
  const ch = 0.11
  const n = Math.max(1, Math.round((y1 - y0) / ch))
  const h = (y1 - y0) / n
  for (let i = 0; i < n; i++) {
    const ya = y0 + i * h + 0.004
    const yb = y0 + (i + 1) * h - 0.004
    // front and back faces
    for (const [za, zb] of [
      [z1 - 0.012, z1],
      [z0, z0 + 0.012],
    ]) {
      let x = x0
      while (x < x1 - 0.02) {
        const w = Math.min(x1 - x, 0.12 + c.rnd() * 0.16)
        c.b('plain', x + 0.004, ya, za, x + w - 0.004, yb - c.rnd() * 0.01, zb, shade(color, 0.82 + c.rnd() * 0.32))
        x += w
      }
    }
    // side faces
    for (const [xa, xb] of [
      [x0, x0 + 0.012],
      [x1 - 0.012, x1],
    ]) {
      let z = z0 + 0.012
      while (z < z1 - 0.03) {
        const d = Math.min(z1 - 0.012 - z, 0.12 + c.rnd() * 0.16)
        c.b('plain', xa, ya, z + 0.004, xb, yb - c.rnd() * 0.01, z + d - 0.004, shade(color, 0.82 + c.rnd() * 0.32))
        z += d
      }
    }
  }
}

const IRON = 0x2b2b2e

// ---------------------------------------------------------------------------------------------------------------------------------
// Wood stove
// ---------------------------------------------------------------------------------------------------------------------------------

export function woodStove(c: Ctx): void {
  const { hw, hd } = c
  const iron = c.metal(IRON)
  const x0 = -hw + 0.03
  const x1 = hw - 0.03
  const zb = -hd + 0.03 // back plane
  const zf = hd - 0.05 // front plane (the door and its handle stay inside the footprint)
  const t = 0.02
  const flueTop = Math.min(c.M.flueHeight ?? c.h, c.y0 + c.h)
  const fx = 0
  const fz = zb + 0.15
  const top = 0.72
  // legs and ash tray
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.cyl('metal', sx * (hw - 0.07), 0, sz * (hd - 0.09), 0.022, 0.2, shade(iron, 0.9), 'cyl6')
  c.b('metal', x0, 0.2, zb, x1, 0.25, zf, shade(iron, 1.15))
  // firebox: back, sides, top plate; front frame leaves the door opening
  const by0 = 0.25
  c.b('metal', x0, by0, zb, x1, top, zb + t, shade(iron, 0.85))
  c.b('metal', x0, by0, zb + t, x0 + t, top, zf, iron)
  c.b('metal', x1 - t, by0, zb + t, x1, top, zf, iron)
  c.b('metal', x0 - 0.005, top, zb, x1 + 0.005, top + 0.03, zf + 0.005, shade(iron, 1.2)) // top plate, a little proud
  const ox0 = x0 + 0.1
  const ox1 = x1 - 0.1
  const oy0 = by0 + 0.08
  const oy1 = top - 0.1
  c.b('metal', x0 + t, by0, zf - 0.03, ox0, top, zf, iron)
  c.b('metal', ox1, by0, zf - 0.03, x1 - t, top, zf, iron)
  c.b('metal', ox0, by0, zf - 0.03, ox1, oy0, zf, iron)
  c.b('metal', ox0, oy1, zf - 0.03, ox1, top, zf, iron)
  // inner liner: firebrick (never black), ember bed, grate
  const brick = 0x8a6a56
  c.b('plain', x0 + t, by0 + 0.005, zb + t, x1 - t, by0 + 0.03, zf - 0.03, mix(brick, 0x000000, 0.25)) // floor
  c.b('plain', x0 + t, by0 + 0.03, zb + t, x1 - t, top - 0.005, zb + t + 0.015, brick) // back
  c.b('plain', x0 + t, by0 + 0.03, zb + t + 0.015, x0 + t + 0.015, top - 0.005, zf - 0.03, mix(brick, 0xffffff, 0.08))
  c.b('plain', x1 - t - 0.015, by0 + 0.03, zb + t + 0.015, x1 - t, top - 0.005, zf - 0.03, mix(brick, 0xffffff, 0.08))
  c.b('plain', x0 + t, top - 0.02, zb + t + 0.015, x1 - t, top - 0.005, zf - 0.03, mix(brick, 0x000000, 0.2)) // baffle
  c.b('plain', x0 + t + 0.03, by0 + 0.03, zb + t + 0.03, x1 - t - 0.03, by0 + 0.06, zf - 0.08, 0x5a4a42) // ash bed
  for (let i = 0; i < 5; i++) c.b('metal', x0 + t + 0.03, by0 + 0.06, zb + t + 0.04 + i * 0.06, x1 - t - 0.03, by0 + 0.07, zb + t + 0.05 + i * 0.06, shade(iron, 1.4)) // grate bars
  // cooking top: two rings and a lid plate, pot spot at the front, flue collar at the back
  const potX = 0
  const potZ = zf - 0.12
  c.cyl('metal', potX, top + 0.03, potZ, 0.12, 0.006, shade(iron, 1.5), 'cyl')
  c.cyl('metal', potX, top + 0.036, potZ, 0.085, 0.004, shade(iron, 1.15), 'cyl')
  // flue: collar, pipe with bands, ceiling thimble at the top
  c.cyl('metal', fx, top + 0.03, fz, 0.085, 0.07, iron, 'cyl')
  const pipeBase = top + 0.1
  c.cyl('metal', fx, pipeBase, fz, 0.07, flueTop - pipeBase, shade(iron, 1.1), 'cyl')
  for (let y = pipeBase + 0.25; y < flueTop - 0.12; y += 0.45) c.cyl('metal', fx, y, fz, 0.076, 0.03, shade(iron, 1.5), 'cyl')
  c.cyl('metal', fx, flueTop - 0.05, fz, 0.1, 0.03, shade(iron, 0.9), 'cyl') // thimble ring
  c.cyl('metal', fx, flueTop - 0.002, fz, 0.052, 0.002, 0x4a403a, 'cyl') // dark opening, a hair above the pipe end
  // damper handle on the pipe
  c.b('metal', fx + 0.07, pipeBase + 0.2, fz - 0.008, fx + 0.17, pipeBase + 0.212, fz + 0.008, shade(iron, 1.6))
  // firebox door, hinged on the front edge (left side by default)
  const side = c.M.hinge ?? 'left'
  const dx0 = ox0 + 0.006
  const dx1 = ox1 - 0.006
  const dy0 = oy0 + 0.006
  const dy1 = oy1 - 0.006
  const dt = 0.03
  const px = side === 'left' ? dx0 : dx1
  const sign = side === 'left' ? -1 : 1
  const hx = side === 'left' ? dx1 - 0.03 : dx0 + 0.03
  c.part(
    'firebox_door',
    [px, (dy0 + dy1) / 2, zf],
    { kind: 'hinge', axis: [0, 1, 0], angle: sign * 1.7 },
    () => {
      c.b('metal', dx0, dy0, zf, dx1, dy1, zf + dt, iron)
      c.b('metal', dx0 + 0.025, dy0 + 0.025, zf + dt, dx1 - 0.025, dy1 - 0.025, zf + dt + 0.004, shade(iron, 1.5)) // bezel
      c.plane('glass', (dx0 + dx1) / 2, (dy0 + dy1) / 2, zf + dt + 0.0065, dx1 - dx0 - 0.07, dy1 - dy0 - 0.07, 0x5a3a2a)
      c.b('metal', hx - 0.008, (dy0 + dy1) / 2 - 0.05, zf + dt, hx + 0.008, (dy0 + dy1) / 2 + 0.05, zf + dt + 0.03, 0xb4b8bc) // handle
    },
    { label: 'prompt.firebox_door', at: [(dx0 + dx1) / 2, (dy0 + dy1) / 2, zf + dt + HANDLE] },
  )
  // pot spot on the cooking ring
  const pot = 0.24
  c.container({
    id: 'pot_spot', from: [potX - pot / 2, top + 0.03, potZ - pot / 2], to: [potX + pot / 2, top + 0.4, potZ + pot / 2],
    slots: [{ pos: [round3(potX), round3(top + 0.03), round3(potZ)], max: [pot, 0.3, pot] }],
  })
  // fuel, burner, effects
  c.add('fuels', { id: 'wood', kind: 'wood', capacity: 8, level: 8 })
  const bed: Vec3 = [0, round3(by0 + 0.12), round3((zb + zf) / 2)]
  c.add('burners', { id: 'fire', pos: bed, fuel: 'wood', rate: 0.0005, needsIgnition: true })
  c.add('emitters', { id: 'fire_flame', kind: 'fire', pos: bed, dir: [0, 1, 0], source: 'fire', size: 0.22 })
  c.add('emitters', { id: 'fire_smoke', kind: 'smoke', pos: [fx, round3(flueTop + 0.02), round3(fz)], dir: [0, 1, 0], source: 'fire', size: 0.3 })
  c.interact('ignite_fire', [0, round3((oy0 + oy1) / 2), round3(zf + dt + 0.05)], { do: 'ignite', burner: 'fire' }, 'prompt.wood_stove_ignite', 1.4)
  c.interact('toggle_fire', [round3(hx), round3(oy1 + 0.04), round3(zf + dt + 0.05)], { do: 'toggle_burner', burner: 'fire' }, 'prompt.wood_stove', 1.4)
  c.spec.colliders = []
  c.collider('body', x0, 0, zb, x1, top + 0.03, zf + 0.0)
  c.collider('flue', fx - 0.07, top + 0.03, fz - 0.07, fx + 0.07, flueTop, fz + 0.07)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Fireplace
// ---------------------------------------------------------------------------------------------------------------------------------

export function fireplace(c: Ctx): void {
  const { hw, hd } = c
  const stone = c.M.variant === 'stone'
  const mat = stone ? 0x8d8982 : 0xa24f3a
  const masonry = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => (stone ? stones(c, x0, y0, z0, x1, y1, z1, mat) : bricks(c, x0, y0, z0, x1, y1, z1, mat))
  const chimneyTop = Math.min(c.M.chimneyHeight ?? c.h, c.y0 + c.h)
  const sd = Math.min(0.55, c.d - 0.3) // depth of the surround, against the back wall
  const zw = -hd // wall plane
  const zs = zw + sd // front of the surround
  const hearthY = 0.1
  const ow = Math.min(0.42, hw - 0.3) // half width of the opening
  const openTop = 0.92
  const lintel = 0.12
  const mantelY = openTop + lintel
  // hearth slab in front of the opening, spans the footprint
  c.b('plain', -hw, 0, zw + 0.1, hw, hearthY, hd, 0xb9b3a6)
  c.b('plain', -hw + 0.02, hearthY, zs + 0.02, hw - 0.02, hearthY + 0.004, hd - 0.02, 0xa8a296) // inset tile
  // piers
  masonry(-hw, hearthY, zw, -ow, mantelY, zs)
  masonry(ow, hearthY, zw, hw, mantelY, zs)
  // firebox: back wall and lining in dark brick, floor, smoke shelf under the lintel
  const lin = 0x6f4c3c
  c.b('plain', -ow, hearthY, zw, ow, openTop, zw + 0.1, shade(lin, 0.9)) // back wall of the firebox
  c.b('plain', -ow, hearthY, zw + 0.1, -ow + 0.04, openTop, zs, lin) // inner side faces
  c.b('plain', ow - 0.04, hearthY, zw + 0.1, ow, openTop, zs, lin)
  c.b('plain', -ow + 0.04, hearthY, zw + 0.1, ow - 0.04, hearthY + 0.03, zs, shade(lin, 0.75)) // firebox floor, raised
  c.b('plain', -ow, openTop - 0.02, zw + 0.1, ow, openTop, zs, shade(lin, 0.8))
  // steel lintel and the masonry above it
  c.b('metal', -ow - 0.02, openTop, zs - 0.03, ow + 0.02, openTop + 0.04, zs + 0.005, 0x3a3c40)
  masonry(-ow, openTop, zw, ow, mantelY, zs - 0.03)
  // mantel
  c.b('wood', -hw, mantelY, zw, hw, mantelY + 0.07, zs + 0.07, c.wood(0x6a4a30))
  c.b('wood', -hw + 0.02, mantelY + 0.07, zs + 0.0, hw - 0.02, mantelY + 0.075, zs + 0.07, shade(c.wood(0x6a4a30), 1.15))
  // chimney breast narrowing into the stack
  const bw = hw - 0.18
  const stackHalf = Math.min(0.3, hw - 0.4)
  const breastTop = mantelY + 0.7
  masonry(-bw, mantelY + 0.07, zw, bw, breastTop, zw + 0.45)
  masonry(-stackHalf, breastTop, zw, stackHalf, chimneyTop - 0.08, zw + 0.4)
  c.b('plain', -stackHalf - 0.04, chimneyTop - 0.08, zw, stackHalf + 0.04, chimneyTop - 0.04, zw + 0.44, 0xcfc9bc) // cap slab
  c.b('plain', -0.13, chimneyTop - 0.04, zw + 0.07, 0.13, chimneyTop, zw + 0.33, 0x9a948a) // flue liner
  c.b('plain', -0.1, chimneyTop - 0.002, zw + 0.1, 0.1, chimneyTop, zw + 0.3, 0x4a403a) // dark flue opening
  // grate with andirons and logs
  const fz = zw + 0.1 + (sd - 0.1) * 0.5
  const gy = hearthY + 0.03
  for (const s of [-1, 1]) {
    c.b('metal', s * 0.27 - 0.02, gy, fz - 0.17, s * 0.27 + 0.02, gy + 0.2, fz - 0.15, IRON)
    c.b('metal', s * 0.27 - 0.02, gy, fz + 0.15, s * 0.27 + 0.02, gy + 0.2, fz + 0.17, IRON)
    c.b('metal', s * 0.27 - 0.02, gy + 0.08, fz - 0.17, s * 0.27 + 0.02, gy + 0.1, fz + 0.17, IRON)
  }
  for (let i = 0; i < 5; i++) c.b('metal', -0.28, gy + 0.08, fz - 0.14 + i * 0.07, 0.28, gy + 0.095, fz - 0.128 + i * 0.07, shade(IRON, 1.3))
  const log = 0x5a3e2a
  c.rod('wood', 'x', 0, gy + 0.17, fz - 0.09, 0.06, 0.56, log)
  c.rod('wood', 'x', 0.02, gy + 0.17, fz + 0.09, 0.055, 0.5, shade(log, 1.1))
  c.rod('wood', 'x', -0.02, gy + 0.29, fz, 0.05, 0.5, shade(log, 0.9))
  // fuel, burner, effects
  c.add('fuels', { id: 'wood', kind: 'wood', capacity: 12, level: 12 })
  const bed: Vec3 = [0, round3(gy + 0.2), round3(fz)]
  c.add('burners', { id: 'fire', pos: bed, fuel: 'wood', rate: 0.0007, needsIgnition: true })
  c.add('emitters', { id: 'fire_flame', kind: 'fire', pos: bed, dir: [0, 1, 0], source: 'fire', size: 0.4 })
  c.add('emitters', { id: 'fire_smoke', kind: 'smoke', pos: [0, round3(chimneyTop + 0.02), round3(zw + 0.2)], dir: [0, 1, 0], source: 'fire', size: 0.35 })
  c.interact('ignite_fire', [0, round3(gy + 0.2), round3(zs + 0.1)], { do: 'ignite', burner: 'fire' }, 'prompt.fireplace_ignite', 1.8)
  c.interact('toggle_fire', [0.3, round3(gy + 0.35), round3(zs + 0.1)], { do: 'toggle_burner', burner: 'fire' }, 'prompt.fireplace', 1.8)
  if (stone) c.spec.destruction = { material: 'stone', joint: 'mortar' }
  c.spec.colliders = []
  c.collider('surround', -hw, 0, zw, hw, chimneyTop, zs + 0.07)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Outhouse
// ---------------------------------------------------------------------------------------------------------------------------------

/** Vertical boards between two x positions, with a thin relief strip per board. */
function boards(c: Ctx, x0: number, x1: number, y0: number, y1: number, z: number, t: number, color: number, front: 1 | -1 = 1): void {
  const n = Math.max(1, Math.round((x1 - x0) / 0.1))
  const bw = (x1 - x0) / n
  for (let i = 0; i < n; i++) {
    const col = shade(color, 0.88 + c.rnd() * 0.2)
    c.b('wood', x0 + i * bw + 0.002, y0, z, x0 + (i + 1) * bw - 0.002, y1, z + t, col)
    c.b('wood', x0 + i * bw + bw / 2 - 0.004, y0, front === 1 ? z + t : z - 0.003, x0 + i * bw + bw / 2 + 0.004, y1, front === 1 ? z + t + 0.003 : z, shade(col, 0.82))
  }
}

export function outhouse(c: Ctx): void {
  const { hw, hd, h } = c
  const wood = c.wood(0x8a6a48)
  const t = 0.03
  const bx = hw - 0.05 // half width of the booth
  const bz0 = -hd + 0.05 // back
  const bz1 = hd - 0.05 // front plane
  const wallTop = Math.min(2.04, h - 0.25)
  const doorW = Math.min(0.7, 2 * bx - 0.3)
  const dx0 = -doorW / 2
  const dx1 = doorW / 2
  const doorTop = 1.76
  // floor (inside the walls), back wall, side walls (side boards run along z)
  c.b('wood', -bx, 0, bz0, bx, 0.05, bz1, shade(wood, 0.7))
  boards(c, -bx, bx, 0.05, wallTop, bz0, t, wood, -1)
  for (const s of [-1, 1]) {
    const n = Math.max(1, Math.round((bz1 - bz0 - t) / 0.1))
    const bd = (bz1 - bz0 - t) / n
    for (let i = 0; i < n; i++) {
      const col = shade(wood, 0.88 + c.rnd() * 0.2)
      const xa = s < 0 ? -bx : bx - t
      c.b('wood', xa, 0.05, bz0 + t + i * bd + 0.002, xa + t, wallTop, bz0 + t + (i + 1) * bd - 0.002, col)
    }
  }
  // front: two jambs and a header around the door
  boards(c, -bx, dx0, 0.05, wallTop, bz1 - t, t, wood)
  boards(c, dx1, bx, 0.05, wallTop, bz1 - t, t, wood)
  boards(c, dx0, dx1, doorTop, wallTop, bz1 - t, t, wood)
  // roof: a slab sloping to the back, with tar paper and a ridge batten
  const roofY = wallTop + 0.07
  c.b('wood', -hw, roofY, -hd, hw, roofY + 0.04, hd, shade(wood, 0.8), 0, -0.08)
  c.b('plain', -hw + 0.01, roofY + 0.04, -hd + 0.02, hw - 0.01, roofY + 0.05, hd - 0.02, 0x3d3f43, 0, -0.08)
  // bench with a hole, the pit visible inside, a toilet paper roll on the wall
  const seatY = 0.46
  const sz0 = bz0 + t
  const sz1 = sz0 + 0.46
  const sx = bx - t
  c.b('wood', -sx, 0.05, sz1 - 0.025, sx, seatY - 0.03, sz1, shade(wood, 1.05)) // front panel
  c.b('wood', -sx, 0.05, sz0, -sx + 0.025, seatY - 0.03, sz1, shade(wood, 0.95))
  c.b('wood', sx - 0.025, 0.05, sz0, sx, seatY - 0.03, sz1, shade(wood, 0.95))
  c.b('plain', -sx + 0.025, 0.05, sz0, sx - 0.025, 0.07, sz1 - 0.025, 0x3b2f27) // pit floor
  const hc = (sz0 + sz1) / 2
  const hr = 0.14
  c.b('wood', -sx, seatY - 0.03, sz0, sx, seatY, hc - hr, shade(wood, 1.12))
  c.b('wood', -sx, seatY - 0.03, hc + hr, sx, seatY, sz1, shade(wood, 1.12))
  c.b('wood', -sx, seatY - 0.03, hc - hr, -hr, seatY, hc + hr, shade(wood, 1.12))
  c.b('wood', hr, seatY - 0.03, hc - hr, sx, seatY, hc + hr, shade(wood, 1.12))
  c.rod('plain', 'x', sx - 0.03, 0.85, bz0 + 0.3, 0.012, 0.03, 0xf2efe6) // paper roll on the right wall...
  c.b('metal', sx - 0.01, 0.82, bz0 + 0.3 - 0.0, sx, 0.88, bz0 + 0.31, 0x8a8e92)
  // seat lid hinged at the back of the hole
  const lz = hc + hr
  c.part(
    'seat_lid',
    [0, seatY, hc - hr - 0.01],
    { kind: 'hinge', axis: [1, 0, 0], angle: -1.65 },
    () => {
      c.b('wood', -hr - 0.03, seatY, hc - hr - 0.01, hr + 0.03, seatY + 0.025, lz + 0.03, shade(wood, 0.78))
      c.b('wood', -0.03, seatY + 0.025, lz - 0.05, 0.03, seatY + 0.045, lz + 0.01, shade(wood, 0.6)) // grip
    },
    { label: 'prompt.outhouse_lid', at: [0, seatY + 0.05, hc] },
  )
  // door with the crescent cut, hinged on the front edge
  const side = c.M.hinge ?? 'left'
  const zf = bz1
  const pz = zf - 0.004
  const dt = 0.03
  const dy0 = 0.06
  const cy = 1.5
  const R = 0.1
  const r2 = 0.085
  const ox = 0.045
  const oy = 0.02
  const solidRanges = (x: number): Array<[number, number]> => {
    const gaps: Array<[number, number]> = []
    if (Math.abs(x) < R) {
      const a = Math.sqrt(R * R - x * x)
      const lo = cy - a
      const hi = cy + a
      const ix = x - ox
      if (Math.abs(ix) < r2) {
        const b = Math.sqrt(r2 * r2 - ix * ix)
        const il = cy + oy - b
        const ih = cy + oy + b
        gaps.push([lo, Math.min(hi, Math.max(lo, il))])
        gaps.push([Math.max(lo, Math.min(hi, ih)), hi])
      } else gaps.push([lo, hi])
    }
    const out: Array<[number, number]> = []
    let cur = dy0
    for (const [g0, g1] of gaps.filter((g) => g[1] - g[0] > 0.001).sort((a, b) => a[0] - b[0])) {
      if (g0 > cur) out.push([cur, g0])
      cur = Math.max(cur, g1)
    }
    if (cur < doorTop - 0.01) out.push([cur, doorTop - 0.01])
    return out
  }
  c.part(
    'door',
    [side === 'left' ? dx0 : dx1, 0.9, pz],
    { kind: 'hinge', axis: [0, 1, 0], angle: (side === 'left' ? -1 : 1) * 1.7 },
    () => {
      const planks = 6
      const pw = (dx1 - dx0 - 0.004) / planks
      for (let p = 0; p < planks; p++) {
        const a = dx0 + 0.002 + p * pw
        const b = a + pw - 0.003
        const col = shade(wood, 0.85 + c.rnd() * 0.25)
        const crescent = b > -R - 0.01 && a < R + 0.01
        if (!crescent) {
          c.b('wood', a, dy0, pz - dt, b, doorTop - 0.01, pz, col)
          continue
        }
        const cols = Math.max(1, Math.round((b - a) / 0.02))
        const cw = (b - a) / cols
        for (let k = 0; k < cols; k++) {
          const xa = a + k * cw
          for (const [ya, yb] of solidRanges(xa + cw / 2)) c.b('wood', xa, ya, pz - dt, xa + cw, yb, pz, col)
        }
      }
      // battens on the inside, hinge straps and a wooden latch on the outside
      for (const y of [0.3, 1.25]) c.b('wood', dx0 + 0.01, y, pz - dt - 0.025, dx1 - 0.01, y + 0.1, pz - dt, shade(wood, 0.7))
      const hxn = side === 'left' ? dx0 : dx1
      for (const y of [0.35, 1.35]) c.b('metal', Math.min(hxn, hxn + (side === 'left' ? 0.28 : -0.28)), y, pz, Math.max(hxn, hxn + (side === 'left' ? 0.28 : -0.28)), y + 0.05, pz + 0.008, IRON)
      const lx = side === 'left' ? dx1 - 0.08 : dx0 + 0.08
      c.b('wood', lx - 0.1, 0.95, pz, lx + 0.1, 0.99, pz + 0.025, shade(wood, 0.65))
    },
    { label: 'prompt.outhouse_door', at: [0, 0.95, pz + 0.04] },
  )
  c.add('seats', { id: 'seat', pose: 'sit', pos: [0, round3(seatY + 0.02), round3(hc + 0.02)], ry: 0, exit: [0, 0, round3(hd + 0.5)] })
  c.interact('sit', [0, 0.8, round3(hc + 0.3)], { do: 'sit', seat: 'seat' }, 'prompt.sit', 1.3)
  // walls block, the booth is hollow; the door collider follows the door and turns off when it is open
  c.spec.colliders = []
  c.collider('wall_back', -bx, 0, bz0, bx, wallTop, bz0 + t)
  c.collider('wall_left', -bx, 0, bz0 + t, -bx + t, wallTop, bz1 - t)
  c.collider('wall_right', bx - t, 0, bz0 + t, bx, wallTop, bz1 - t)
  c.collider('front_left', -bx, 0, bz1 - t, dx0, wallTop, bz1)
  c.collider('front_right', dx1, 0, bz1 - t, bx, wallTop, bz1)
  c.collider('bench', -sx, 0, sz0, sx, seatY, sz1)
  c.add('colliders', { id: 'door', center: [0, round3(doorTop / 2), round3(pz - dt / 2)], half: [round3(doorW / 2), round3(doorTop / 2), round3(dt / 2)], part: 'door', offWhenOpen: true })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Well
// ---------------------------------------------------------------------------------------------------------------------------------

export function well(c: Ctx): void {
  const { hd } = c
  const stoneCol = c.main(0x8d8982)
  const wood = c.wood(0x7a5a3a)
  const rim = 0.9
  const rIn = 0.38
  const rMid = 0.465
  const n = 12
  // stone ring: two courses of 12 blocks, the upper one offset by half a block, a real opening in the middle
  const bwid = 2 * rMid * Math.tan(Math.PI / n) + 0.012
  for (let course = 0; course < 2; course++) {
    for (let i = 0; i < n; i++) {
      const a = ((i + course * 0.5) / n) * Math.PI * 2
      const px = Math.sin(a) * rMid
      const pz = Math.cos(a) * rMid
      c.box('plain', px, course * 0.45 + 0.004, pz, bwid, 0.442, 0.17, shade(stoneCol, 0.85 + c.rnd() * 0.3), Math.atan2(px, pz))
    }
  }
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.25) / n) * Math.PI * 2
    const px = Math.sin(a) * 0.47
    const pz = Math.cos(a) * 0.47
    c.box('plain', px, rim, pz, bwid + 0.03, 0.05, 0.25, shade(stoneCol, 1.05 + c.rnd() * 0.12), Math.atan2(px, pz)) // coping slabs
  }
  // shaft: dark wall floor and the water surface well below the rim
  c.cyl('plain', 0, 0, 0, rIn + 0.01, 0.1, 0x4a4742, 'cyl')
  c.cyl('water', 0, 0.1, 0, rIn, 0.01, 0x3a6a86, 'cyl')
  // frame: two posts, cross beam, gabled roof
  for (const s of [-1, 1]) c.b('wood', s * 0.62 - 0.05, 0, -0.05, s * 0.62 + 0.05, 1.9, 0.05, wood)
  c.b('wood', -0.68, 1.8, -0.06, 0.68, 1.9, 0.06, shade(wood, 0.9))
  for (const s of [-1, 1]) {
    c.box('wood', 0, 1.99, s * 0.33, 1.46, 0.04, 0.8, shade(wood, 0.85), 0, s * 0.5)
    c.box('plain', 0, 2.02, s * 0.33, 1.44, 0.01, 0.78, 0x56463a, 0, s * 0.5)
  }
  c.b('wood', -0.69, 2.05, -0.03, 0.69, 2.12, 0.03, shade(wood, 0.7)) // ridge board
  // trough in front, hollow with water in it, and the chute that pours into it
  const tz0 = 0.58
  const tz1 = hd - 0.02
  c.b('wood', -0.3, 0, tz0, 0.3, 0.05, tz1, shade(wood, 0.8))
  c.b('wood', -0.3, 0.05, tz0, 0.3, 0.3, tz0 + 0.04, shade(wood, 0.9))
  c.b('wood', -0.3, 0.05, tz1 - 0.04, 0.3, 0.3, tz1, shade(wood, 0.9))
  c.b('wood', -0.3, 0.05, tz0 + 0.04, -0.26, 0.3, tz1 - 0.04, shade(wood, 1.0))
  c.b('wood', 0.26, 0.05, tz0 + 0.04, 0.3, 0.3, tz1 - 0.04, shade(wood, 1.0))
  c.b('water', -0.26, 0.05, tz0 + 0.04, 0.26, 0.2, tz1 - 0.04, 0x3a6a86)
  c.box('wood', 0, 0.99, 0.4, 0.16, 0.02, 0.56, shade(wood, 1.1), 0, 0.29)
  for (const s of [-1, 1]) c.box('wood', s * 0.08, 1.0, 0.4, 0.015, 0.04, 0.56, shade(wood, 0.8), 0, 0.29)
  // crank, bucket and rope move together
  const spindleY = 1.45
  c.part(
    'crank',
    [0, spindleY, 0],
    { kind: 'knob', axis: [1, 0, 0], angle: 6.2 },
    () => {
      c.rod('wood', 'x', 0, spindleY, 0, 0.045, 1.24, shade(wood, 1.1))
      c.b('wood', 0.62, spindleY - 0.01, -0.025, 0.69, spindleY + 0.01, 0.025, shade(wood, 0.9)) // arm
      c.b('wood', 0.66, spindleY - 0.01, -0.025, 0.69, spindleY + 0.2, 0.025, shade(wood, 0.9))
      c.rod('wood', 'x', 0.70, spindleY + 0.2, 0, 0.022, 0.08, shade(wood, 0.7)) // knob
    },
    { label: 'prompt.well_crank', at: false, noSweep: true, group: 'draw' },
  )
  const bucketY = 0.4
  const bucketH = 0.26
  const lift = 0.5
  c.part(
    'bucket',
    [0, bucketY, 0],
    { kind: 'slide', axis: [0, 1, 0], distance: lift },
    () => {
      c.cyl('wood', 0, bucketY, 0, 0.13, bucketH, shade(wood, 0.9), 'cyl')
      c.cyl('water', 0, bucketY + bucketH - 0.04, 0, 0.115, 0.005, 0x3a6a86, 'cyl')
      for (const y of [bucketY + 0.04, bucketY + bucketH - 0.06]) c.cyl('metal', 0, y, 0, 0.134, 0.02, IRON, 'cyl')
      c.b('metal', -0.135, bucketY + bucketH, -0.006, -0.125, bucketY + bucketH + 0.17, 0.006, IRON) // bail
      c.b('metal', 0.125, bucketY + bucketH, -0.006, 0.135, bucketY + bucketH + 0.17, 0.006, IRON)
      c.b('metal', -0.135, bucketY + bucketH + 0.16, -0.006, 0.135, bucketY + bucketH + 0.17, 0.006, IRON)
    },
    { noSweep: true, group: 'draw' },
  )
  const ropeTop = spindleY - 0.02
  const ropeBottom = bucketY + bucketH + 0.17
  c.part(
    'rope',
    [0, ropeTop, 0.0],
    { kind: 'scale', axis: [0, 1, 0], scale: 0.08 },
    () => c.cyl('fabric', 0, ropeBottom, 0.0, 0.008, ropeTop - ropeBottom, 0xb09a6a, 'cyl6'),
    { noSweep: true, group: 'draw' },
  )
  // water network: a big tank of its own, a hose fixture that flows while the bucket is up
  c.add('tanks', { id: 'well_water', capacity: 20000, level: 20000 })
  const outlet: Vec3 = [0, 0.9, round3(0.66)]
  c.add('fixtures', { id: 'water', kind: 'hose', outlet, dir: [0, -1, 0.05], flow: 15, part: 'bucket', tank: 'well_water' })
  c.add('emitters', { id: 'water_stream', kind: 'water', pos: outlet, dir: [0, -1, 0.05], source: 'water', size: 0.05, reach: 0.6 })
  c.interact('use_water', [0.7, spindleY + 0.2, 0], { do: 'toggle_fixture', fixture: 'water' }, 'prompt.well', 1.6)
  c.interact('use_water_bucket', [0, 0.95, 0.35], { do: 'toggle_fixture', fixture: 'water' }, 'prompt.well', 1.6)
  c.spec.colliders = []
  c.collider('ring', -0.55, 0, -0.55, 0.55, rim + 0.05, 0.55)
  c.collider('post_l', -0.67, 0, -0.07, -0.57, 1.9, 0.07)
  c.collider('post_r', 0.57, 0, -0.07, 0.67, 1.9, 0.07)
  c.collider('trough', -0.3, 0, tz0, 0.3, 0.3, tz1)
}
