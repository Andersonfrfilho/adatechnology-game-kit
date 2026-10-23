import type { Vec3 } from '@adatechnology/game-interactables'
import type { Ctx } from '../ctx'
import { HANDLE, hingedDoor } from '../parts'
import { drawPieces, garment, pegs, type GarmentKind } from '../garments'
import { mix, round3, shade } from '../util'

/** Brick courses between two corners: alternating relief so mortar lines read from afar. */
function bricks(c: Ctx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, mortar = 0xcfc7b8): void {
  const ch = 0.075
  c.b('plain', x0 + 0.007, y0, z0 + 0.007, x1 - 0.007, y1, z1 - 0.007, mortar) // mortar core, recessed behind the brick faces
  const n = Math.max(1, Math.round((y1 - y0) / ch))
  const h = (y1 - y0) / n
  for (let i = 0; i < n; i++) {
    const inset = i % 2 ? 0.003 : 0
    const col = shade(color, 0.94 + ((i * 7) % 5) * 0.025)
    const ya = y0 + i * h + 0.003
    const yb = y0 + (i + 1) * h - 0.003
    c.b('plain', x0 + inset, ya, z0 + inset, x1 - inset, yb, z1 - inset, col)
  }
}

export function bbq(c: Ctx): void {
  const { hw, hd, h } = c
  const brick = c.main(0xa5533a)
  const zf = hd - HANDLE
  const gx0 = -hw
  const gx1 = hw - 0.5 // grill section ends here
  const cx0 = gx1 + 0.002 // counter section
  const cx1 = hw
  const baseH = 0.62
  const bedY = baseH + 0.02
  // grill base: solid brick with an ash door recess
  bricks(c, gx0, 0, -hd, gx1, baseH, zf, brick)
  c.b('metal', -0.35, 0.12, zf - 0.002, -0.05, 0.3, zf + 0.006, 0x2a2a2c)
  c.b('metal', -0.32, 0.15, zf + 0.006, -0.08, 0.27, zf + 0.009, 0x3a3a3e)
  c.b('metal', -0.23, 0.2, zf + 0.009, -0.17, 0.22, zf + 0.02, 0xb4b8bc)
  // top slab of the base, a bit proud
  c.b('plain', gx0 - 0.01, baseH, -hd - 0.0, gx1 + 0.01, baseH + 0.02, zf + 0.01, 0xd8d2c4)
  // fire chamber: back and side walls
  const wt = 0.12
  const topChamber = 1.05
  bricks(c, gx0, baseH + 0.02, -hd, gx1, topChamber, -hd + wt, brick)
  bricks(c, gx0, baseH + 0.02, -hd + wt, gx0 + wt, topChamber, zf - 0.04, brick)
  bricks(c, gx1 - wt, baseH + 0.02, -hd + wt, gx1, topChamber, zf - 0.04, brick)
  // charcoal bed: steel tray with lumps
  const ix0 = gx0 + wt
  const ix1 = gx1 - wt
  const iz0 = -hd + wt
  const iz1 = zf - 0.06
  c.b('metal', ix0, bedY, iz0, ix1, bedY + 0.03, iz1, 0x3a3c40)
  c.b('metal', ix0, bedY + 0.03, iz0, ix1, bedY + 0.05, iz0 + 0.015, 0x4a4c50)
  for (let i = 0; i < 18; i++) {
    const px = ix0 + 0.05 + c.rnd() * (ix1 - ix0 - 0.14)
    const pz = iz0 + 0.05 + c.rnd() * (iz1 - iz0 - 0.14)
    const s = 0.04 + c.rnd() * 0.04
    c.b('plain', px, bedY + 0.03, pz, px + s, bedY + 0.03 + s * 0.8, pz + s, c.rnd() < 0.3 ? 0x555555 : 0x1c1c1e, c.rnd() * 3, 0, 0)
  }
  // grill grate on side brackets
  const gy = 0.88
  for (const s of [-1, 1]) c.b('metal', s < 0 ? ix0 : ix1 - 0.015, gy - 0.02, iz0, s < 0 ? ix0 + 0.015 : ix1, gy, iz1, 0x2a2c30)
  const bars = Math.round((iz1 - iz0) / 0.035)
  for (let i = 0; i <= bars; i++) c.b('metal', ix0 + 0.015, gy, iz0 + (i * (iz1 - iz0 - 0.006)) / bars, ix1 - 0.015, gy + 0.008, iz0 + (i * (iz1 - iz0 - 0.006)) / bars + 0.006, 0x3a3c40)
  for (const x of [ix0 + 0.03, ix1 - 0.045, (ix0 + ix1) / 2]) c.b('metal', x, gy - 0.008, iz0, x + 0.015, gy, iz1, 0x2a2c30)
  // hood: stepped brick tapering to the chimney stack at the back
  const hood = [
    { y0: topChamber, y1: topChamber + 0.12, x0: gx0, x1: gx1, z1: zf },
    { y0: topChamber + 0.12, y1: topChamber + 0.24, x0: gx0 + 0.05, x1: gx1 - 0.05, z1: zf - 0.1 },
    { y0: topChamber + 0.24, y1: topChamber + 0.36, x0: gx0 + 0.12, x1: gx1 - 0.12, z1: zf - 0.2 },
  ]
  for (const s of hood) bricks(c, s.x0, s.y0, -hd, s.x1, s.y1, s.z1, brick)
  c.b('metal', gx0 - 0.005, topChamber - 0.03, zf - 0.04, gx1 + 0.005, topChamber, zf + 0.005, 0x4a4c50) // steel lintel at the opening
  const sx0 = (gx0 + gx1) / 2 - 0.16
  const sx1 = (gx0 + gx1) / 2 + 0.16
  const stackTop = h - 0.1
  bricks(c, sx0, topChamber + 0.36, -hd, sx1, stackTop, -hd + 0.32, brick)
  c.b('plain', sx0 - 0.02, stackTop, -hd - 0.0, sx1 + 0.02, stackTop + 0.03, -hd + 0.34, 0xd8d2c4) // cap slab
  c.cyl('metal', (sx0 + sx1) / 2, stackTop + 0.03, -hd + 0.16, 0.085, h - stackTop - 0.03, 0x6a6e72, 'cyl') // clay-lined flue pipe
  c.cyl('metal', (sx0 + sx1) / 2, stackTop + 0.03, -hd + 0.16, 0.06, h - stackTop - 0.028, 0x1c1c1e, 'cyl') // dark flue opening
  // counter section: brick shell + steel door + stone top
  const topC = 0.9
  bricks(c, cx0, 0, -hd, cx1, topC - 0.04, -hd + 0.1, brick)
  bricks(c, cx0, 0, -hd + 0.1, cx0 + 0.08, topC - 0.04, zf, brick)
  bricks(c, cx1 - 0.08, 0, -hd + 0.1, cx1, topC - 0.04, zf, brick)
  c.b('plain', cx0 + 0.08, 0, -hd + 0.1, cx1 - 0.08, 0.05, zf - 0.025, mix(brick, 0x000000, 0.3)) // cavity floor
  bricks(c, cx0 + 0.08, topC - 0.12, -hd + 0.1, cx1 - 0.08, topC - 0.04, zf, brick)
  c.b('plain', cx0 - 0.0, topC - 0.04, -hd - 0.0, cx1, topC, zf + 0.02, 0x8a8a88)
  c.b('plain', cx0, topC - 0.012, zf + 0.02, cx1, topC, zf + 0.022, 0x6a6a68)
  // cavity lining
  const lx0 = cx0 + 0.08
  const lx1 = cx1 - 0.08
  const lz0 = -hd + 0.1
  const lz1 = zf - 0.025
  c.b('plain', lx0, 0.05, lz0, lx1, topC - 0.12, lz0 + 0.004, 0xd8d4c8)
  c.b('plain', lx0, 0.05, lz0 + 0.004, lx0 + 0.004, topC - 0.12, lz1, 0xc8c4b8)
  c.b('plain', lx1 - 0.004, 0.05, lz0 + 0.004, lx1, topC - 0.12, lz1, 0xc8c4b8)
  c.b('plain', lx0, 0.4, lz0, lx1, 0.416, lz1, 0xc8c4b8) // shelf
  hingedDoor(c, {
    id: 'counter_door', x0: lx0 + 0.002, x1: lx1 - 0.002, y0: 0.052, y1: topC - 0.122, zf, t: 0.025, side: 'left', color: 0x4a4e52, inner: 0x9a9ea2, style: 'flat', handle: 'bar_v', handleLen: 0.2, angle: 1.7, label: 'prompt.door',
  })
  const zc = (lz0 + lz1) / 2
  const slots = [
    ...c.row(lx0 + 0.01, lx1 - 0.01, 0.05, zc, 1, [0.36, 0.34, 0.42]),
    ...c.row(lx0 + 0.01, lx1 - 0.01, 0.416, zc, 2, [0.17, topC - 0.12 - 0.416 - 0.02, 0.4]),
  ]
  c.container({ id: 'counter', access: 'counter_door', from: [lx0, 0.05, lz0], to: [lx1, topC - 0.12, lz1], slots, loot: 'bbq_counter' })
  // fuel, burner, effects
  c.add('fuels', { id: 'charcoal', kind: 'charcoal', capacity: 4, level: 4 })
  const bed: Vec3 = [round3((ix0 + ix1) / 2), round3(bedY + 0.05), round3((iz0 + iz1) / 2)]
  c.add('burners', { id: 'coal', pos: bed, fuel: 'charcoal', rate: 0.0004, needsIgnition: true })
  c.add('emitters', { id: 'coal_fire', kind: 'fire', pos: bed, dir: [0, 1, 0], source: 'coal', size: 0.45 })
  c.add('emitters', { id: 'coal_smoke', kind: 'smoke', pos: [round3((sx0 + sx1) / 2), h + 0.02, round3(-hd + 0.16)], dir: [0, 1, 0], source: 'coal', size: 0.35 })
  c.interact('ignite_coal', [bed[0], bed[1] + 0.2, zf], { do: 'ignite', burner: 'coal' }, 'prompt.bbq_ignite', 1.6)
  c.interact('toggle_coal', [bed[0] + 0.25, bed[1] + 0.2, zf], { do: 'toggle_burner', burner: 'coal' }, 'prompt.bbq', 1.6)
  c.add('damage', { target: 'self', kind: 'masonry', hp: 400 })
}

// ---------------------------------------------------------------------------------------------------------------------------------

const LINE_KINDS: GarmentKind[] = ['tshirt', 'trousers', 'towel', 'dress', 'socks', 'tshirt', 'trousers']
const PEG_COLORS = [0xe8e0c8, 0xd24a3a, 0x3a6ab0, 0xe0c030, 0x4aa06a]

export function clothesline(c: Ctx): void {
  const { hw, h } = c
  const iron = c.metal(0x4a4e52)
  const A = 0.6 // length of the T arm
  const top = h - 0.04
  const lift = 0.001
  const xs = [-(hw - 0.15), hw - 0.15]
  for (const x of xs) {
    // base plate 1 mm above the floor so it never shares a plane with it
    c.b('metal', x - 0.1, lift, -0.1, x + 0.1, lift + 0.01, 0.1, shade(iron, 0.8))
    c.b('metal', x - 0.04, lift + 0.01, -0.04, x + 0.04, lift + 0.03, 0.04, iron)
    c.cyl('metal', x, lift + 0.03, 0, 0.028, top - lift - 0.03, iron, 'cyl')
    // T arm along z, with short braces down to the post
    c.b('metal', x - 0.02, top, -A / 2, x + 0.02, top + 0.04, A / 2, iron)
    for (const s of [-1, 1]) c.b('metal', x - 0.008, top - 0.16, s * 0.1 - 0.008, x + 0.008, top, s * 0.1 + 0.008, iron)
    // eyelets at the tips and at the center, where the wires attach
    for (const z of [-A / 2, 0, A / 2]) {
      const zi = z < 0 ? z + 0.009 : z > 0 ? z - 0.009 : z
      c.b('metal', x - 0.009, top + 0.04, zi - 0.009, x + 0.009, top + 0.058, zi + 0.009, shade(iron, 1.3))
    }
  }
  const yTip = top + 0.04
  const sag = 0.05
  const wires = [-A / 2, 0, A / 2]
  const clothHues = [0xd24a3a, 0x3a6ab0, 0xe8d8a8, 0x4aa06a, 0xe0c030, 0xb04a9a, 0xf0f0f0, 0x6a7a8a]
  wires.forEach((z, wi) => {
    const x0 = xs[0]
    const x1 = xs[1]
    const line: Vec3[] = []
    const n = 8
    for (let i = 0; i <= n; i++) {
      const t = i / n
      line.push([round3(x0 + (x1 - x0) * t), round3(yTip - sag * 4 * t * (1 - t)), z])
    }
    line[0] = [x0, yTip, z]
    line[n] = [x1, yTip, z]
    c.add('wires', { id: `wire_${wi + 1}`, kind: 'cable', radius: 0.0025, points: line })
    // clothes: garments of different widths side by side, hung by pegs on the wire
    const sagAt = (x: number) => yTip - sag * 4 * ((x - x0) / (x1 - x0)) * (1 - (x - x0) / (x1 - x0))
    let cursor = x0 + 0.28
    let i = 0
    while (i < 12) {
      const kind = LINE_KINDS[Math.floor(c.rnd() * LINE_KINDS.length)]
      const col = clothHues[Math.floor(c.rnd() * clothHues.length)]
      const g = garment(kind, col)
      const peg = PEG_COLORS[Math.floor(c.rnd() * PEG_COLORS.length)]
      const px = round3(cursor + g.width / 2)
      if (px + g.width / 2 > x1 - 0.25) break
      cursor += g.width + 0.06 + c.rnd() * 0.08
      i++
      const py = round3(sagAt(px))
      const id = `cloth_${wi + 1}_${i}`
      const cw = g.width
      const ch = g.height
      c.part(
        id, [px, py, z], { kind: 'hinge', axis: [1, 0, 0], angle: 0.5 },
        () => drawPieces(c, [...g.pieces, ...pegs(g, peg)], { x: px, y: py, z, yaw: 0 }),
        { noSweep: true },
      )
      c.add('soft', { id, kind: 'cloth', anchor: [px, py, z], size: [cw, ch, 0.03], stiffness: 24, damping: 3, maxAngle: 0.7, wind: 1 })
    }
  })
  // only the poles block
  c.spec.colliders = []
  xs.forEach((x, i) => c.collider(`pole_${i + 1}`, x - 0.04, 0, -0.04, x + 0.04, top, 0.04))
}
