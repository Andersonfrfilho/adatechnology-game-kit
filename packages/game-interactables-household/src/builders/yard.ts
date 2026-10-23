import type { Ctx } from '../ctx'
import { HANDLE, dropDoor } from '../parts'
import { hex, mix, round3, shade } from '../util'

/** Hollow bin body: floor, four walls, a lighter liner inside. Returns the inner free box. */
function binBody(c: Ctx, o: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; t: number; color: number; inner: number }): { ix0: number; ix1: number; iz0: number; iz1: number; iy0: number; iy1: number } {
  const { x0, x1, z0, z1, y0, y1, t } = o
  c.b('plain', x0, y0, z0, x1, y0 + t, z1, shade(o.color, 0.8))
  c.b('plain', x0, y0 + t, z0, x1, y1, z0 + t, shade(o.color, 0.92))
  c.b('plain', x0, y0 + t, z1 - t, x1, y1, z1, o.color)
  c.b('plain', x0, y0 + t, z0 + t, x0 + t, y1, z1 - t, shade(o.color, 0.96))
  c.b('plain', x1 - t, y0 + t, z0 + t, x1, y1, z1 - t, shade(o.color, 0.96))
  const l = 0.003
  c.b('plain', x0 + t, y0 + t, z0 + t, x1 - t, y0 + t + l, z1 - t, shade(o.inner, 0.8))
  c.b('plain', x0 + t, y0 + t + l, z0 + t, x1 - t, y1 - 0.002, z0 + t + l, o.inner)
  c.b('plain', x0 + t, y0 + t + l, z1 - t - l, x1 - t, y1 - 0.002, z1 - t, o.inner)
  c.b('plain', x0 + t, y0 + t + l, z0 + t + l, x0 + t + l, y1 - 0.002, z1 - t - l, mix(o.inner, o.color, 0.1))
  c.b('plain', x1 - t - l, y0 + t + l, z0 + t + l, x1 - t, y1 - 0.002, z1 - t - l, mix(o.inner, o.color, 0.1))
  return { ix0: x0 + t + l, ix1: x1 - t - l, iz0: z0 + t + l, iz1: z1 - t - l, iy0: y0 + t + l, iy1: y1 }
}

/** Four strips around an opening (a rim, not a plate). */
function frame(c: Ctx, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, t: number, color: number): void {
  c.b('plain', x0, y0, z0, x1, y1, z0 + t, color)
  c.b('plain', x0, y0, z1 - t, x1, y1, z1, color)
  c.b('plain', x0, y0, z0 + t, x0 + t, y1, z1 - t, color)
  c.b('plain', x1 - t, y0, z0 + t, x1, y1, z1 - t, color)
}

function trashSlots(c: Ctx, b: { ix0: number; ix1: number; iz0: number; iz1: number; iy0: number }, cols: number, rows: number, hMax: number): import('@adatechnology/game-interactables').SlotSpec[] {
  const out: import('@adatechnology/game-interactables').SlotSpec[] = []
  const sx = (b.ix1 - b.ix0) / cols
  const sz = (b.iz1 - b.iz0) / rows
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      out.push({ pos: [round3(b.ix0 + (i + 0.5) * sx), round3(b.iy0), round3(b.iz0 + (j + 0.5) * sz)], max: [round3(sx - 0.01), hMax, round3(sz - 0.01)] })
    }
  }
  return out
}

export function trashBin(c: Ctx): void {
  const { hw, hd, h } = c
  const col = c.main(0x3f6e4c)
  const rim = h - 0.04
  const b = binBody(c, { x0: -hw, x1: hw, z0: -hd, z1: hd, y0: 0, y1: rim, t: 0.02, color: col, inner: 0xa9b0b4 })
  frame(c, -hw - 0.006, -hd - 0.006, hw + 0.006, hd + 0.006, rim - 0.03, rim, 0.026, shade(col, 1.12)) // rim band, proud by 6 mm
  c.b('plain', -hw + 0.04, 0.0, -hd + 0.04, hw - 0.04, 0.012, hd - 0.04, 0x1e2022) // base ring
  // lid hinged at the back
  const hy = h - 0.04
  c.part(
    'lid', [0, hy, -hd + 0.06], { kind: 'hinge', axis: [1, 0, 0], angle: -1.5 },
    () => {
      c.b('plain', -hw - 0.006, hy, -hd + 0.0, hw + 0.006, hy + 0.025, hd + 0.0, shade(col, 1.05))
      c.b('plain', -hw + 0.03, hy + 0.025, -hd + 0.03, hw - 0.03, hy + 0.036, hd - 0.03, shade(col, 1.18))
      c.b('plain', -0.07, hy + 0.036, hd - 0.1, 0.07, hy + 0.054, hd - 0.07, shade(col, 0.7)) // grip
    },
    { label: 'prompt.bin_lid', at: [0, hy + 0.05, hd - 0.05], radius: 1.6 },
  )
  c.b('plain', -0.05, hy - 0.01, -hd - 0.004, 0.05, hy + 0.03, -hd + 0.03, 0x1e2022) // hinge block
  const slots = [...trashSlots(c, b, 2, 2, 0.28), ...trashSlots(c, { ...b, iy0: b.iy0 + 0.22 }, 2, 1, 0.2)]
  c.container({ id: 'bin', access: 'lid', from: [b.ix0, b.iy0, b.iz0], to: [b.ix1, rim, b.iz1], slots, loot: 'trash' })
  c.add('damage', { target: 'self', kind: 'plastic', hp: 40 })
}

export function wheelieBin(c: Ctx): void {
  const { hw, hd, h } = c
  const col = c.main(0x2f5a8a)
  const rim = h - 0.08
  const t = 0.025
  const b = binBody(c, { x0: -hw + 0.03, x1: hw - 0.03, z0: -hd + 0.05, z1: hd, y0: 0.08, y1: rim, t, color: col, inner: 0x7e8a92 })
  // slightly wider upper band (rim lip) and ribs on the front
  frame(c, -hw, -hd + 0.03, hw, hd, rim - 0.06, rim, 0.05, shade(col, 1.1))
  for (let i = 0; i < 3; i++) c.b('plain', -hw + 0.1 + i * ((c.w - 0.2) / 2.0) - 0.01, 0.2, hd - 0.003, -hw + 0.1 + i * ((c.w - 0.2) / 2.0) + 0.01, rim - 0.1, hd, shade(col, 0.85))
  // wheels on a rear axle, grab bar
  c.rod('metal', 'x', 0, 0.1, -hd + 0.1, 0.012, c.w - 0.04, 0x8a8e92)
  for (const s of [-1, 1]) {
    c.rod('plain', 'x', s * (hw - 0.03), 0.1, -hd + 0.1, 0.1, 0.05, 0x1c1c1e)
    c.rod('plain', 'x', s * (hw - 0.03), 0.1, -hd + 0.1, 0.05, 0.056, 0x8a8e92)
  }
  c.b('plain', -hw + 0.06, rim - 0.05, -hd + 0.0, hw - 0.06, rim - 0.01, -hd + 0.05, shade(col, 0.7))
  c.b('plain', -0.1, 0.05, hd - 0.1, 0.1, 0.1, hd, 0x1c1c1e) // front feet
  const hy = rim
  c.part(
    'lid', [0, hy, -hd + 0.06], { kind: 'hinge', axis: [1, 0, 0], angle: -1.5 },
    () => {
      c.b('plain', -hw, hy, -hd + 0.05, hw, hy + 0.03, hd, shade(col, 1.04))
      c.b('plain', -hw + 0.04, hy + 0.03, -hd + 0.09, hw - 0.04, hy + 0.045, hd - 0.04, shade(col, 1.2))
      c.b('plain', -hw, hy - 0.04, -hd + 0.05, -hw + 0.02, hy, hd, shade(col, 0.9)) // lid skirt
      c.b('plain', hw - 0.02, hy - 0.04, -hd + 0.05, hw, hy, hd, shade(col, 0.9))
      c.b('plain', -hw, hy - 0.04, hd - 0.02, hw, hy, hd, shade(col, 0.9))
    },
    { label: 'prompt.bin_lid', at: [0, hy + 0.05, hd - 0.1], radius: 1.8 },
  )
  const slots = [...trashSlots(c, b, 2, 3, 0.4), ...trashSlots(c, { ...b, iy0: b.iy0 + 0.3 }, 2, 2, 0.3)]
  c.container({ id: 'bin', access: 'lid', from: [b.ix0, b.iy0, b.iz0], to: [b.ix1, rim, b.iz1], slots, loot: 'trash' })
  c.add('damage', { target: 'self', kind: 'plastic', hp: 60 })
}

export function mailbox(c: Ctx): void {
  const { hd } = c
  const style = c.region.mailbox.style
  const col = c.M.color != null ? hex(c.M.color) : hex(c.region.mailbox.color)
  const postCol = style === 'post' ? 0x8a6a46 : 0x6a6e72
  const by = 1.0 // bottom of the box
  const bh = 0.24
  const bw = Math.min(c.w, 0.3) - (style === 'post' ? 0.04 : 0)
  const zf = hd - HANDLE - 0.01
  // post and foot
  c.b(style === 'post' ? 'wood' : 'metal', -0.035, 0.001, -0.035 - hd + 0.18, 0.035, by, 0.035 - hd + 0.18, postCol)
  c.b('plain', -0.1, 0.0, -hd + 0.08, 0.1, 0.06, -hd + 0.28, 0x8a8a84)
  c.b(style === 'post' ? 'wood' : 'metal', -0.035, by - 0.06, -hd + 0.18 - 0.035, 0.035, by, hd - 0.1, shade(postCol, 0.9)) // support arm under the box
  // box: floor, sides, back, roof; open at the front for the flap
  const t = 0.012
  const x0 = -bw / 2
  const x1 = bw / 2
  const z0 = -hd + 0.02
  c.b('metal', x0, by, z0, x1, by + t, zf, shade(col, 0.85))
  c.b('metal', x0, by + t, z0, x0 + t, by + bh, zf, col)
  c.b('metal', x1 - t, by + t, z0, x1, by + bh, zf, col)
  c.b('metal', x0 + t, by + t, z0, x1 - t, by + bh, z0 + t, shade(col, 0.9))
  const lin = 0xdadcdc
  c.b('plain', x0 + t, by + t, z0 + t, x1 - t, by + t + 0.003, zf, lin)
  c.b('plain', x0 + t, by + t + 0.003, z0 + t, x0 + t + 0.003, by + bh - 0.01, zf, lin)
  c.b('plain', x1 - t - 0.003, by + t + 0.003, z0 + t, x1 - t, by + bh - 0.01, zf, lin)
  if (style === 'post') {
    // arched roof (half cylinder look: full cylinder along z, lower half hidden by the box)
    c.rod('metal', 'z', 0, by + bh - bw / 2, (z0 + zf) / 2, bw / 2, zf - z0, col, 'cyl')
    c.b('metal', x0, by + t, z0, x1, by + bh - bw / 2, zf, col) // keeps the lower half solid
  } else {
    c.b('metal', x0 - 0.01, by + bh, z0 - 0.005, x1 + 0.01, by + bh + 0.02, zf + 0.01, shade(col, 1.1)) // flat roof with overhang
    c.b('plain', -0.06, by + bh * 0.5, zf, 0.06, by + bh * 0.5 + 0.045, zf + 0.002, 0xf2f0e6) // address plate
  }
  // front flap, hinged at the bottom
  dropDoor(c, {
    id: 'flap', x0: x0 + 0.002, x1: x1 - 0.002, y0: by + t, y1: by + bh, zf: zf + 0.01, t: 0.012, color: shade(col, 1.08), inner: lin, angle: 1.55, handle: 'knob',
    label: 'prompt.mailbox_flap',
  })
  if (style === 'post') {
    const fx = x1 + 0.004
    c.part('flag', [fx, by + 0.12, z0 + 0.1], { kind: 'hinge', axis: [0, 0, 1], angle: 1.5 }, () => {
      c.b('metal', fx, by + 0.12, z0 + 0.1 - 0.005, fx + 0.006, by + 0.12 + 0.01, z0 + 0.1 + 0.005, 0x8a8a8a)
      c.b('metal', fx, by + 0.02, z0 + 0.09, fx + 0.006, by + 0.12, z0 + 0.11, 0xc8402a)
      c.b('metal', fx, by + 0.02, z0 + 0.11, fx + 0.006, by + 0.07, z0 + 0.17, 0xc8402a)
    }, { label: 'prompt.mailbox_flag', at: [fx, by + 0.1, z0 + 0.12] })
  }
  // letters: two columns along z, second layer on top
  const iw = x1 - x0 - 2 * t
  const zl = (z0 + t + zf) / 2
  const dz = (zf - z0 - t) / 2
  const fy = by + t + 0.003
  const slots: import('@adatechnology/game-interactables').SlotSpec[] = []
  for (const layer of [0, 1]) for (const k of [-1, 1]) slots.push({ pos: [0, round3(fy + layer * 0.03), round3(zl + (k * dz) / 2)], max: [round3(iw - 0.01), 0.03, round3(dz - 0.005)] })
  const cont = c.container({ id: 'letters', access: 'flap', from: [x0 + t, fy, z0 + t], to: [x1 - t, by + bh - 0.02, zf], slots, loot: 'mailbox' })
  if (!c.M.contents?.letters) {
    const kinds = ['bill', 'letter', 'flyer', 'postcard']
    cont.contents = slots.map((_, i) => {
      if (i > 2 || c.rnd() < 0.35) return null
      const k = kinds[Math.floor(c.rnd() * kinds.length)]
      return { type: k, qty: 1, data: { text: `letter.${k}_${1 + Math.floor(c.rnd() * 3)}` } }
    })
  }
  slots.forEach((s, i) => c.interact(`read_${i + 1}`, [0, round3(by + bh / 2), round3(zf + 0.02)], { do: 'read', container: 'letters', slot: i }, 'prompt.letter', 1.4))
  c.spec.colliders = []
  c.collider('post', -0.05, 0, -hd + 0.14, 0.05, by + bh, -hd + 0.22)
  c.add('damage', { target: 'self', kind: 'metal', hp: 50 })
}

export function dogHouse(c: Ctx): void {
  const { hw, hd, h } = c
  const paint = c.main(0xa84a34)
  const trim = 0xe8dcc0
  const inner = 0xd8bc8a
  const floorCol = 0xc9a574
  const bw = c.w - 0.12 // body width
  const x0 = -bw / 2
  const x1 = bw / 2
  const z0 = -hd + 0.04
  const z1 = hd - 0.22
  const y0 = 0.06
  const wallH = 0.58
  const t = 0.03
  // base: feet and floor board, lighter inside
  for (const sx of [-1, 1]) for (const sz of [0, 1]) c.b('wood', sx < 0 ? x0 : x1 - 0.06, 0, sz ? z1 - 0.06 : z0, sx < 0 ? x0 + 0.06 : x1, y0, sz ? z1 : z0 + 0.06, 0x5a4028)
  c.b('wood', x0 - 0.01, y0 - 0.02, z0 - 0.01, x1 + 0.01, y0, z1 + 0.01, 0x7a5a3a)
  c.b('wood', x0 + t, y0, z0 + t, x1 - t, y0 + 0.012, z1 - t, floorCol) // interior floor
  for (let i = 1; i < 6; i++) c.b('wood', x0 + t, y0 + 0.012, z0 + t + i * ((z1 - z0 - 2 * t) / 6) - 0.002, x1 - t, y0 + 0.0125, z0 + t + i * ((z1 - z0 - 2 * t) / 6) + 0.002, shade(floorCol, 0.85))
  // walls: back, left, right
  c.b('wood', x0, y0, z0, x1, y0 + wallH, z0 + t, paint)
  c.b('wood', x0, y0, z0 + t, x0 + t, y0 + wallH, z1, shade(paint, 0.96))
  c.b('wood', x1 - t, y0, z0 + t, x1, y0 + wallH, z1, shade(paint, 0.96))
  // front wall with a real opening (gap) and a lintel above it
  const ow = 0.36
  const oh = 0.46
  c.b('wood', x0 + t, y0, z1 - t, -ow / 2, y0 + wallH, z1, paint)
  c.b('wood', ow / 2, y0, z1 - t, x1 - t, y0 + wallH, z1, paint)
  c.b('wood', -ow / 2, y0 + oh, z1 - t, ow / 2, y0 + wallH, z1, paint)
  c.b('wood', x0, y0, z1 - t, x0 + t, y0 + wallH, z1, shade(paint, 0.96))
  c.b('wood', x1 - t, y0, z1 - t, x1, y0 + wallH, z1, shade(paint, 0.96))
  // trim around the opening
  c.b('wood', -ow / 2 - 0.025, y0, z1, -ow / 2, y0 + oh + 0.025, z1 + 0.012, trim)
  c.b('wood', ow / 2, y0, z1, ow / 2 + 0.025, y0 + oh + 0.025, z1 + 0.012, trim)
  c.b('wood', -ow / 2 - 0.025, y0 + oh, z1, ow / 2 + 0.025, y0 + oh + 0.025, z1 + 0.012, trim)
  // inner liner: lighter faces on every inner wall so the inside never reads black
  const l = 0.004
  c.b('plain', x0 + t, y0 + 0.012, z0 + t, x1 - t, y0 + wallH, z0 + t + l, inner)
  c.b('plain', x0 + t, y0 + 0.012, z0 + t + l, x0 + t + l, y0 + wallH, z1 - t, mix(inner, paint, 0.1))
  c.b('plain', x1 - t - l, y0 + 0.012, z0 + t + l, x1 - t, y0 + wallH, z1 - t, mix(inner, paint, 0.1))
  c.b('plain', x0 + t + l, y0 + 0.012, z1 - t - l, -ow / 2, y0 + wallH, z1 - t, shade(inner, 0.95))
  c.b('plain', ow / 2, y0 + 0.012, z1 - t - l, x1 - t - l, y0 + wallH, z1 - t, shade(inner, 0.95))
  c.b('plain', -ow / 2, y0 + oh - l, z1 - t - l, ow / 2, y0 + wallH, z1 - t, shade(inner, 0.95))
  // gable infill (front and back) up to the ridge
  const rise = h - 0.02 - (y0 + wallH)
  const steps = 5
  for (let i = 0; i < steps; i++) {
    const f = 1 - (i + 0.5) / steps
    const gx = (bw / 2) * f
    const yy = y0 + wallH + (i * rise) / steps
    c.b('wood', -gx, yy, z1 - t, gx, yy + rise / steps + 0.002, z1, shade(paint, 0.98))
    c.b('wood', -gx, yy, z0, gx, yy + rise / steps + 0.002, z0 + t, shade(paint, 0.98))
  }
  // roof: two slabs meeting at the ridge with a small overhang
  const half = Math.min(hw - 0.015, bw / 2 + 0.05)
  const run = half
  const L = Math.hypot(run, rise)
  const ang = Math.atan2(rise, run)
  const roofT = 0.03
  const rz0 = z0 - 0.04
  const rz1 = z1 + 0.06
  for (const s of [-1, 1]) {
    const cx = (s * run) / 2
    const cy = y0 + wallH + rise / 2 + roofT / 2
    c.box('wood', cx, cy - roofT / 2, (rz0 + rz1) / 2, L, roofT, rz1 - rz0, 0x5a4a3a, 0, 0, -s * ang)
    for (let i = 1; i < 5; i++) c.box('wood', cx, cy - roofT / 2 + 0.017, rz0 + i * ((rz1 - rz0) / 5), L - 0.02, 0.004, 0.006, shade(0x5a4a3a, 0.8), 0, 0, -s * ang)
  }
  c.b('wood', -0.03, y0 + wallH + rise - 0.005, rz0, 0.03, y0 + wallH + rise + 0.03, rz1, shade(0x5a4a3a, 0.7)) // ridge cap
  // cushion + optional bowl
  c.b('fabric', x0 + t + 0.03, y0 + 0.012, z0 + t + 0.03, x1 - t - 0.03, y0 + 0.07, z1 - t - 0.2, c.accent(0x4a6a9a))
  c.b('fabric', x0 + t + 0.05, y0 + 0.07, z0 + t + 0.05, x1 - t - 0.05, y0 + 0.075, z1 - t - 0.22, mix(c.accent(0x4a6a9a), 0xffffff, 0.15))
  if (c.M.variant !== 'no_bowl') {
    const bx = x1 - 0.1
    const bz = z1 + 0.11
    c.cyl('metal', bx, 0, bz, 0.085, 0.045, 0xb4b8bc, 'cyl')
    c.cyl('plain', bx, 0.04, bz, 0.07, 0.006, 0x7a5a30, 'cyl')
  }
}
