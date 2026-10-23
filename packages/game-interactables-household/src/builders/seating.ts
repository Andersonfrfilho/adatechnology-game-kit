import type { Vec3 } from '@adatechnology/game-interactables'
import type { Ctx } from '../ctx'
import { mix, round3, shade } from '../util'

const FACE = 0 // facing +z (away from the backrest at -z): the engine adds PI, so seat.ry 0 gives view yaw PI, which looks toward +z

/** Sofa or armchair: legs, frame, arms with rounded tops, seat cushions, back cushions, piping. */
function sofaLike(c: Ctx, n: number, lie: boolean): void {
  const { hw, hd, h } = c
  const fab = c.fabric(0x6b7078)
  const dark = shade(fab, 0.8)
  const light = mix(fab, 0xffffff, 0.08)
  const armW = Math.min(0.2, c.w * 0.2)
  const legH = 0.12
  const seatY = 0.44
  const baseTop = 0.28
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b('wood', sx * (hw - 0.07) - 0.025, 0, sz * (hd - 0.07) - 0.025, sx * (hw - 0.07) + 0.025, legH, sz * (hd - 0.07) + 0.025, 0x3a2a1e)
  c.b('fabric', -hw, legH, -hd, hw, baseTop, hd, dark) // base frame
  c.b('fabric', -hw + armW, baseTop - 0.01, hd - 0.02, hw - armW, baseTop + 0.02, hd, shade(fab, 0.7)) // front rail
  // back: a tall slab with a rounded top
  const bt = 0.2
  c.b('fabric', -hw, baseTop, -hd, hw, h - 0.07 - bt / 2, -hd + bt, fab)
  c.rod('fabric', 'x', 0, h - 0.07 - bt / 2, -hd + bt / 2, bt / 2, c.w, fab)
  // arms
  const armTop = 0.62
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -hw : hw - armW
    c.b('fabric', x0, baseTop, -hd + bt, x0 + armW, armTop - armW / 2, hd, fab)
    c.rod('fabric', 'z', x0 + armW / 2, armTop - armW / 2, (-hd + bt + hd) / 2, armW / 2, hd - (-hd + bt), fab)
    c.b('fabric', s < 0 ? x0 + armW - 0.012 : x0, baseTop + 0.02, -hd + bt, s < 0 ? x0 + armW : x0 + 0.012, armTop - armW / 2, hd - 0.02, light) // inner face, lighter
  }
  // seat + back cushions
  const ix0 = -hw + armW
  const ix1 = hw - armW
  const cw = (ix1 - ix0) / n
  const sz0 = -hd + bt
  const sz1 = hd - 0.02
  const seats: Array<{ id: string; pose: 'sit' | 'lie'; pos: Vec3; ry: number; exit: Vec3 }> = []
  for (let i = 0; i < n; i++) {
    const x0 = ix0 + i * cw + 0.004
    const x1 = ix0 + (i + 1) * cw - 0.004
    const col = i % 2 === 0 ? light : fab
    c.b('fabric', x0, baseTop + 0.02, sz0 + 0.02, x1, seatY, sz1, col)
    c.b('fabric', x0 + 0.01, seatY, sz0 + 0.03, x1 - 0.01, seatY + 0.025, sz1 - 0.01, mix(col, 0xffffff, 0.06)) // crowned top
    c.b('fabric', x0, baseTop + 0.02, sz1 - 0.006, x1, seatY + 0.02, sz1, shade(col, 0.75)) // piping
    // back cushion, leaning back
    c.b('fabric', x0 + 0.005, seatY + 0.02, sz0 + 0.02, x1 - 0.005, h - 0.12, sz0 + 0.19, col, 0, -0.18)
    const cx = (x0 + x1) / 2
    seats.push({ id: `seat_${i + 1}`, pose: 'sit', pos: [round3(cx), round3(seatY + 0.03), round3(sz0 + (sz1 - sz0) * 0.55)], ry: FACE, exit: [round3(cx), 0, round3(hd + 0.55)] })
  }
  for (const s of seats) c.add('seats', { ...s, eye: 0.62 })
  if (lie) {
    c.add('seats', { id: 'lie', pose: 'lie', pos: [0, round3(seatY + 0.06), round3(sz0 + (sz1 - sz0) * 0.5)], ry: Math.PI / 2, exit: [0, 0, round3(hd + 0.55)] })
  }
  for (const s of c.spec.seats ?? []) c.interact(`sit_${s.id}`, [s.pos[0], round3(s.pos[1] + 0.25), round3(s.pos[2] + 0.3)], { do: 'sit', seat: s.id }, s.pose === 'lie' ? 'prompt.lie' : 'prompt.sit', 1.6)
}

export function sofa(c: Ctx): void {
  sofaLike(c, Math.max(2, Math.round(c.w / 0.7)), true)
}
export function armchair(c: Ctx): void {
  sofaLike(c, 1, false)
}

export function diningChair(c: Ctx): void {
  const { hw, hd, h } = c
  const wood = c.wood(0x9a7048)
  const cush = c.fabric(0x8a3a3a)
  const seatY = 0.45
  const lt = 0.035
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b('wood', sx * (hw - lt / 2 - 0.01) - lt / 2, 0, sz * (hd - lt / 2 - 0.01) - lt / 2, sx * (hw - lt / 2 - 0.01) + lt / 2, sz < 0 ? h : seatY - 0.03, sz * (hd - lt / 2 - 0.01) + lt / 2, shade(wood, sz < 0 ? 0.9 : 1)) // back legs rise into the back posts
  // rails under the seat
  c.b('wood', -hw + 0.01, seatY - 0.09, -hd + 0.01, hw - 0.01, seatY - 0.04, -hd + 0.04, shade(wood, 0.85))
  c.b('wood', -hw + 0.01, seatY - 0.09, hd - 0.04, hw - 0.01, seatY - 0.04, hd - 0.01, shade(wood, 0.85))
  c.b('wood', -hw + 0.01, seatY - 0.09, -hd + 0.04, -hw + 0.04, seatY - 0.04, hd - 0.04, shade(wood, 0.85))
  c.b('wood', hw - 0.04, seatY - 0.09, -hd + 0.04, hw - 0.01, seatY - 0.04, hd - 0.04, shade(wood, 0.85))
  c.b('wood', -hw, seatY - 0.03, -hd, hw, seatY, hd, wood) // seat board
  c.b('fabric', -hw + 0.02, seatY, -hd + 0.05, hw - 0.02, seatY + 0.04, hd - 0.02, cush) // cushion
  c.b('fabric', -hw + 0.03, seatY + 0.04, -hd + 0.06, hw - 0.03, seatY + 0.045, hd - 0.03, mix(cush, 0xffffff, 0.1))
  // back: top rail and slats
  c.b('wood', -hw + 0.01, h - 0.1, -hd + 0.01, hw - 0.01, h - 0.03, -hd + 0.04, wood)
  for (let i = 0; i < 3; i++) c.b('wood', -hw + 0.07 + i * ((c.w - 0.14) / 3), seatY + 0.06, -hd + 0.015, -hw + 0.07 + i * ((c.w - 0.14) / 3) + 0.04, h - 0.1, -hd + 0.035, shade(wood, 1.05))
  c.add('seats', { id: 'seat', pose: 'sit', pos: [0, round3(seatY + 0.05), 0.02], ry: FACE, exit: [0, 0, round3(hd + 0.45)] })
  c.interact('sit', [0, seatY + 0.3, 0.1], { do: 'sit', seat: 'seat' }, 'prompt.sit', 1.5)
}

function bedBuild(c: Ctx, double: boolean): void {
  const { hw, hd, h } = c
  const wood = c.wood(0x7a5a3a)
  const sheet = c.fabric(double ? 0x4a6a8a : 0x6a8a6a)
  const frameTop = 0.3
  const matTop = 0.54
  // legs, side rails, headboard (tall) and footboard (low)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b('wood', sx * (hw - 0.04) - 0.035, 0, sz * (hd - 0.04) - 0.035, sx * (hw - 0.04) + 0.035, 0.16, sz * (hd - 0.04) + 0.035, shade(wood, 0.8))
  c.b('wood', -hw, 0.14, -hd, -hw + 0.05, frameTop, hd, wood)
  c.b('wood', hw - 0.05, 0.14, -hd, hw, frameTop, hd, wood)
  c.b('wood', -hw, 0.14, hd - 0.05, hw, 0.44, hd, shade(wood, 1.05)) // footboard
  c.b('wood', -hw, 0.14, -hd, hw, h, -hd + 0.06, shade(wood, 0.92)) // headboard
  c.b('wood', -hw + 0.06, h - 0.08, -hd + 0.06, hw - 0.06, h - 0.02, -hd + 0.07, shade(wood, 1.12)) // panel detail
  c.b('wood', -hw + 0.06, 0.5, -hd + 0.06, hw - 0.06, h - 0.1, -hd + 0.068, shade(wood, 0.84))
  // slats + mattress
  c.b('wood', -hw + 0.05, frameTop - 0.04, -hd + 0.06, hw - 0.05, frameTop, hd - 0.05, shade(wood, 0.7))
  c.b('fabric', -hw + 0.055, frameTop, -hd + 0.065, hw - 0.055, matTop, hd - 0.055, 0xeeeae0) // mattress
  c.b('fabric', -hw + 0.052, frameTop + 0.02, -hd + 0.062, hw - 0.052, frameTop + 0.026, hd - 0.052, 0xd8d4c8) // piping line
  // duvet over the lower 70%, hanging a little over the sides
  c.b('fabric', -hw + 0.04, matTop - 0.01, -hd + 0.65, hw - 0.04, matTop + 0.06, hd - 0.035, sheet)
  c.b('fabric', -hw + 0.04, matTop + 0.06, -hd + 0.65, hw - 0.04, matTop + 0.066, -hd + 0.75, mix(sheet, 0xffffff, 0.4)) // folded edge
  for (let i = 0; i < 4; i++) c.b('fabric', -hw + 0.05, matTop + 0.062, -hd + 0.9 + i * 0.28, hw - 0.05, matTop + 0.067, -hd + 0.93 + i * 0.28, mix(sheet, 0xffffff, 0.18))
  // pillows
  const np = double ? 2 : 1
  const pw = (c.w - 0.14) / np
  const seats: string[] = []
  for (let i = 0; i < np; i++) {
    const cx = -hw + 0.07 + (i + 0.5) * pw
    c.b('fabric', cx - pw / 2 + 0.03, matTop, -hd + 0.09, cx + pw / 2 - 0.03, matTop + 0.13, -hd + 0.5, 0xf6f4ee, 0, 0.08)
    const id = double ? `lie_${i + 1}` : 'lie'
    seats.push(id)
    const sx = double ? (i === 0 ? -1 : 1) : 0
    c.add('seats', { id, pose: 'lie', pos: [round3(cx), round3(matTop + 0.06), round3(-hd + 0.95)], ry: FACE, eye: 0.2, exit: [round3(sx * (hw + 0.5) || hw + 0.5), 0, round3(-hd + 1.1)] })
  }
  for (const id of seats) {
    const s = c.spec.seats!.find((x) => x.id === id)!
    c.interact(`lie_${id}`, [s.pos[0], round3(matTop + 0.3), s.pos[2]], { do: 'sit', seat: id }, 'prompt.lie', 1.8)
  }
}

export function bedDouble(c: Ctx): void {
  bedBuild(c, true)
}
export function bedSingle(c: Ctx): void {
  bedBuild(c, false)
}

export function bench(c: Ctx): void {
  const { hw, hd, h } = c
  const wood = c.wood(0x9a7048)
  const iron = c.metal(0x2e3034)
  const seatY = 0.45
  // cast-iron side frames: legs, seat rail, arm and back post
  for (const sx of [-1, 1]) {
    const x = sx * (hw - 0.06)
    c.b('metal', x - 0.025, 0, -hd + 0.05, x + 0.025, seatY - 0.03, -hd + 0.09, iron)
    c.b('metal', x - 0.025, 0, hd - 0.09, x + 0.025, seatY - 0.03, hd - 0.05, iron)
    c.b('metal', x - 0.025, seatY - 0.05, -hd + 0.04, x + 0.025, seatY - 0.02, hd - 0.04, iron)
    c.b('metal', x - 0.025, seatY - 0.02, -hd + 0.04, x + 0.025, h, -hd + 0.08, iron) // back post
    c.b('metal', x - 0.03, 0.62, -hd + 0.04, x + 0.03, 0.655, hd - 0.12, iron) // armrest
    c.b('metal', x - 0.025, seatY - 0.02, hd - 0.12, x + 0.025, 0.62, hd - 0.09, iron)
  }
  // slats
  for (let i = 0; i < 5; i++) c.b('wood', -hw + 0.03, seatY - 0.02, -hd + 0.09 + i * ((c.d - 0.18) / 5), hw - 0.03, seatY + 0.015, -hd + 0.09 + i * ((c.d - 0.18) / 5) + (c.d - 0.18) / 5 - 0.012, i % 2 ? wood : shade(wood, 1.06))
  for (let i = 0; i < 3; i++) c.b('wood', -hw + 0.03, 0.55 + i * 0.1, -hd + 0.025, hw - 0.03, 0.55 + i * 0.1 + 0.075, -hd + 0.05, i % 2 ? wood : shade(wood, 1.06))
  const n = Math.max(2, Math.round(c.w / 0.55))
  const step = (c.w - 0.2) / n
  for (let i = 0; i < n; i++) {
    const x = round3(-hw + 0.1 + (i + 0.5) * step)
    c.add('seats', { id: `seat_${i + 1}`, pose: 'sit', pos: [x, round3(seatY + 0.03), 0.02], ry: FACE, exit: [x, 0, round3(hd + 0.5)] })
    c.interact(`sit_${i + 1}`, [x, seatY + 0.3, 0.1], { do: 'sit', seat: `seat_${i + 1}` }, 'prompt.sit', 1.5)
  }
}
