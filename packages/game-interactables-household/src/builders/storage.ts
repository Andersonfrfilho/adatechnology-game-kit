import type { Vec3 } from '@adatechnology/game-interactables'
import type { Ctx } from '../ctx'
import { HANDLE, drawer, dropDoor, hingedDoor, plugged, shelf, shell } from '../parts'
import { drawPieces, garment, hanger, type GarmentKind } from '../garments'
import { mix, shade } from '../util'

type Side = 'left' | 'right'
const sideOf = (c: Ctx, fallback: Side): Side => c.M.hinge ?? fallback

/** Thin ledge tray on the inside of a door, with a front lip. Drawn inside a part. */
function doorLedge(c: Ctx, x0: number, x1: number, y: number, zIn: number, depth: number, color: number): void {
  c.b('plain', x0, y, zIn - depth, x1, y + 0.008, zIn, color)
  c.b('plain', x0, y, zIn - depth, x1, y + 0.05, zIn - depth + 0.008, mix(color, 0xffffff, 0.3))
  c.b('plain', x0, y, zIn - depth, x0 + 0.008, y + 0.05, zIn, mix(color, 0xffffff, 0.3))
  c.b('plain', x1 - 0.008, y, zIn - depth, x1, y + 0.05, zIn, mix(color, 0xffffff, 0.3))
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Fridge
// ---------------------------------------------------------------------------------------------------------------------------------

export function fridge(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.main(c.M.variant === 'steel' ? 0xb7bcc1 : 0xe9ecee)
  const lining = 0xf2f6f6
  const zf = hd - HANDLE
  const dt = 0.05
  const zdi = zf - dt // inner face of the doors
  const zb = zdi - 0.003 // front plane of the carcass
  const fh = 0.5 // freezer compartment height
  const sh = shell(c, { x0: -hw, x1: hw, y0: 0.05, y1: h, z0: -hd, z1: zb, color: body, inner: lining, t: 0.04, tTop: 0.03, tBottom: 0.05, tBack: 0.03, material: 'plain' })
  // plinth / feet
  c.b('plain', -hw + 0.03, 0, -hd + 0.03, hw - 0.03, 0.05, zb - 0.04, 0x2c2e30)
  // divider between the compartments
  const yd = h - fh - 0.04
  c.b('plain', sh.ix0, yd, sh.iz0, sh.ix1, yd + 0.04, zb, shade(body, 0.92))
  c.b('plain', sh.ix0 + 0.003, yd - 0.003, sh.iz0 + 0.003, sh.ix1 - 0.003, yd, zb, lining)
  c.b('plain', sh.ix0 + 0.003, yd + 0.04, sh.iz0 + 0.003, sh.ix1 - 0.003, yd + 0.043, zb, lining)
  const fy0 = sh.iy0
  // glass shelves in the fridge compartment, leaving room for the door trays
  const sz1 = zdi - 0.105
  const levels = [fy0, fy0 + 0.28, fy0 + 0.56, fy0 + 0.84]
  for (const y of levels.slice(1)) {
    shelf(c, sh.ix0 + 0.004, sh.ix1 - 0.004, y, sh.iz0 + 0.01, sz1, 0xcfe6ea, 0.016, true)
    for (const s of [-1, 1]) c.b('plain', s < 0 ? sh.ix0 : sh.ix1 - 0.012, y - 0.03, sh.iz0 + 0.01, s < 0 ? sh.ix0 + 0.012 : sh.ix1, y - 0.006, sz1 - 0.02, 0xe4eef0)
  }
  // a crisper bin on the floor, left side (static decoration, low)
  const slotsF = levels.flatMap((y) => c.row(sh.ix0 + 0.02, sh.ix1 - 0.02, y + (y === fy0 ? 0.003 : 0), (sh.iz0 + 0.03 + sz1) / 2, 2, [0.3, 0.26, 0.3]))
  // freezer racks
  const zy = yd + 0.043
  const rack = [zy, zy + 0.25]
  c.b('metal', sh.ix0 + 0.01, rack[1] - 0.01, sh.iz0 + 0.02, sh.ix1 - 0.01, rack[1], zb - 0.06, 0xaeb4b8)
  for (let i = 0; i < 9; i++) c.b('metal', sh.ix0 + 0.01 + (i * (sh.ix1 - sh.ix0 - 0.02 - 0.006)) / 8, rack[1], sh.iz0 + 0.02, sh.ix0 + 0.016 + (i * (sh.ix1 - sh.ix0 - 0.02 - 0.006)) / 8, rack[1] + 0.004, zb - 0.06, 0xaeb4b8)
  const slotsZ = rack.flatMap((y) => c.row(sh.ix0 + 0.02, sh.ix1 - 0.02, y + (y === zy ? 0 : 0.004), (sh.iz0 + zb - 0.06) / 2 - 0.02, 2, [0.3, 0.21, 0.3]))

  // doors
  const side = sideOf(c, 'left')
  const dx0 = -hw + 0.003
  const dx1 = hw - 0.003
  const trayX0 = dx0 + 0.04
  const trayX1 = dx1 - 0.04
  const trayYs = [fy0 + 0.1, fy0 + 0.4, fy0 + 0.7]
  hingedDoor(c, {
    id: 'door_fridge', x0: dx0, x1: dx1, y0: 0.055, y1: yd + 0.02 - 0.002, zf, t: dt, side, color: body, inner: lining, style: 'flat',
    handle: 'bar_v', handleLen: 0.42, angle: 1.7, label: 'prompt.fridge_door',
    extra: () => {
      for (const y of trayYs) doorLedge(c, trayX0, trayX1, y, zdi, 0.09, 0xe4eef0)
    },
  })
  hingedDoor(c, {
    id: 'door_freezer', x0: dx0, x1: dx1, y0: yd + 0.02 + 0.002, y1: h - 0.004, zf, t: dt, side, color: body, inner: lining, style: 'flat',
    handle: 'bar_v', handleLen: 0.26, angle: 1.7, label: 'prompt.freezer_door',
    extra: () => doorLedge(c, trayX0, trayX1, yd + 0.2, zdi, 0.07, 0xe4eef0),
  })
  // door tray slots (they follow the fridge door)
  const doorSlots = trayYs.flatMap((y) => c.row(trayX0 + 0.01, trayX1 - 0.01, y + 0.008, zdi - 0.05, 2, [0.14, 0.3, 0.08], 'door_fridge'))
  c.container({ id: 'fridge', access: 'door_fridge', from: [sh.ix0, fy0, sh.iz0], to: [sh.ix1, yd, zdi], slots: [...slotsF, ...doorSlots], loot: 'fridge' })
  c.container({ id: 'freezer', access: 'door_freezer', from: [sh.ix0, zy, sh.iz0], to: [sh.ix1, h - 0.03, zdi], slots: slotsZ, loot: 'freezer' })
  plugged(c, 'compressor', 'appliance', 150, [hw * 0.4, 0.15, -hd], { on: c.M.on ?? true })
}

export function fridgeCompact(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.main(0xdfe3e6)
  const lining = 0xf2f6f6
  const zf = hd - HANDLE
  const dt = 0.04
  const zdi = zf - dt
  const zb = zdi - 0.003
  const sh = shell(c, { x0: -hw, x1: hw, y0: 0.04, y1: h, z0: -hd, z1: zb, color: body, inner: lining, t: 0.035, tTop: 0.03, tBottom: 0.04, tBack: 0.025, material: 'plain' })
  c.b('plain', -hw + 0.03, 0, -hd + 0.03, hw - 0.03, 0.04, zb - 0.04, 0x2c2e30)
  const fz = 0.2 // freezer compartment height
  const yd = h - fz - 0.03
  c.b('plain', sh.ix0, yd, sh.iz0, sh.ix1, yd + 0.03, zb, shade(body, 0.92))
  c.b('plain', sh.ix0 + 0.003, yd - 0.003, sh.iz0 + 0.003, sh.ix1 - 0.003, yd, zb, lining)
  const fy0 = sh.iy0
  const sz1 = zdi - 0.1
  const mid = fy0 + (yd - fy0) / 2
  shelf(c, sh.ix0 + 0.004, sh.ix1 - 0.004, mid, sh.iz0 + 0.01, sz1, 0xcfe6ea, 0.016, true)
  const zc = (sh.iz0 + 0.03 + sz1) / 2
  const side = sideOf(c, 'right')
  const trayY = fy0 + 0.12
  const dx0 = -hw + 0.003
  const dx1 = hw - 0.003
  hingedDoor(c, {
    id: 'door_fridge', x0: dx0, x1: dx1, y0: 0.045, y1: yd + 0.015 - 0.002, zf, t: dt, side, color: body, inner: lining, style: 'flat',
    handle: 'bar_v', handleLen: 0.3, angle: 1.7, label: 'prompt.fridge_door',
    extra: () => doorLedge(c, dx0 + 0.04, dx1 - 0.04, trayY, zdi, 0.08, 0xe4eef0),
  })
  dropDoor(c, { id: 'door_freezer', x0: dx0, x1: dx1, y0: yd + 0.015 + 0.002, y1: h - 0.004, zf, t: dt, color: shade(body, 0.97), inner: lining, angle: 1.45, handle: 'bar_h', handleLen: 0.16, label: 'prompt.freezer_door' })
  const slots = [
    ...c.row(sh.ix0 + 0.02, sh.ix1 - 0.02, fy0, zc, 1, [0.4, 0.2, 0.3]),
    ...c.row(sh.ix0 + 0.02, sh.ix1 - 0.02, mid, zc, 1, [0.4, yd - mid - 0.02, 0.3]),
    ...c.row(dx0 + 0.05, dx1 - 0.05, trayY + 0.008, zdi - 0.045, 1, [0.12, 0.26, 0.07], 'door_fridge'),
  ]
  c.container({ id: 'fridge', access: 'door_fridge', from: [sh.ix0, fy0, sh.iz0], to: [sh.ix1, yd, zdi], slots, loot: 'fridge' })
  c.container({ id: 'freezer', access: 'door_freezer', from: [sh.ix0, yd + 0.03, sh.iz0], to: [sh.ix1, h - 0.03, zdi], slots: c.row(sh.ix0 + 0.02, sh.ix1 - 0.02, yd + 0.033, zc, 1, [0.3, 0.14, 0.3]), loot: 'freezer' })
  plugged(c, 'compressor', 'appliance', 90, [hw * 0.4, 0.12, -hd], { on: c.M.on ?? true })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Kitchen cabinets
// ---------------------------------------------------------------------------------------------------------------------------------

/** Row of doors across [x0, x1]; one door below 0.6 m, else two with a 3 mm gap. Returns the door ids. */
function doorsAcross(c: Ctx, o: { x0: number; x1: number; y0: number; y1: number; zf: number; t: number; color: number; inner: number; handle: 'bar_v' | 'knob'; side: Side; prefix?: string; labelId?: string; mirror?: boolean }): string[] {
  const pre = o.prefix ?? 'door'
  const n = o.x1 - o.x0 >= 0.6 ? 2 : 1
  const ids: string[] = []
  const gap = 0.003
  const w = (o.x1 - o.x0 - gap * (n - 1)) / n
  for (let i = 0; i < n; i++) {
    const x0 = o.x0 + i * (w + gap)
    const side: Side = n === 1 ? o.side : i === 0 ? 'left' : 'right'
    const id = `${pre}_${i + 1}`
    hingedDoor(c, { id, x0, x1: x0 + w, y0: o.y0, y1: o.y1, zf: o.zf, t: o.t, side, color: o.color, inner: o.inner, handle: o.handle, handleLen: 0.2, label: 'prompt.door' })
    ids.push(id)
  }
  return ids
}

export function kitchenCabinetBase(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.wood(0xcdb690)
  const front = c.main(0xe4dccb)
  const lining = mix(body, 0xffffff, 0.55)
  const zf = hd - HANDLE
  const t = 0.02
  const zr = zf - t - 0.003
  const top = h - 0.04
  const sh = shell(c, { x0: -hw, x1: hw, y0: 0.1, y1: top, z0: -hd, z1: zr, color: body, inner: lining, t: 0.018, tTop: 0.018, tBottom: 0.018 })
  c.b('wood', -hw + 0.01, 0, -hd + 0.03, hw - 0.01, 0.1, zr - 0.04, 0x3a3836) // plinth
  // worktop with a front overhang and a dark edge strip
  c.b('wood', -hw, top, -hd, hw, h, zf + 0.02, 0x7c7a78)
  c.b('plain', -hw, top, zf + 0.02, hw, h - 0.012, zf + 0.022, 0x5a5856)
  const dh = 0.15
  const yDr = top - dh - 0.003
  const info = drawer(c, { id: 'drawer', x0: -hw + 0.003, x1: hw - 0.003, y0: yDr, y1: top - 0.003, zf, zb: sh.iz0, color: front, handle: 'bar_h', handleLen: 0.18 })
  const midY = (0.1 + yDr) / 2
  const shelfY = midY
  shelf(c, sh.ix0, sh.ix1, shelfY, sh.iz0, sh.iz1 - 0.02, body)
  const zc = (sh.iz0 + sh.iz1 - 0.02) / 2
  const n = c.w >= 0.6 ? 2 : 1
  const ids = doorsAcross(c, { x0: -hw + 0.003, x1: hw - 0.003, y0: 0.103, y1: yDr - 0.003, zf, t, color: front, inner: lining, handle: 'bar_v', side: sideOf(c, 'left') })
  const slots = [
    ...c.row(sh.ix0 + 0.01, sh.ix1 - 0.01, sh.iy0, zc, n, [0.37, shelfY - 0.016 - sh.iy0 - 0.005, 0.45]),
    ...c.row(sh.ix0 + 0.01, sh.ix1 - 0.01, shelfY, zc, n, [0.37, yDr - shelfY - 0.01, 0.45]),
  ]
  c.container({ id: 'cupboard', access: ids[0], from: [sh.ix0, sh.iy0, sh.iz0], to: [sh.ix1, yDr, sh.iz1], slots, loot: 'kitchen_cabinet' })
  c.container({
    id: 'drawer', access: 'drawer', from: [info.ix0, info.floor, info.iz0], to: [info.ix1, info.floor + info.free, info.iz1],
    slots: c.row(info.ix0 + 0.01, info.ix1 - 0.01, info.floor, (info.iz0 + info.iz1) / 2, 2, [0.3, info.free - 0.01, 0.3], 'drawer'), loot: 'kitchen_drawer',
  })
}

export function kitchenCabinetWall(c: Ctx): void {
  const { hw, hd, h, y0 } = c
  const body = c.wood(0xcdb690)
  const front = c.main(0xe4dccb)
  const lining = mix(body, 0xffffff, 0.55)
  const zf = hd - HANDLE
  const t = 0.02
  const zr = zf - t - 0.003
  const y1 = y0 + h
  const sh = shell(c, { x0: -hw, x1: hw, y0, y1, z0: -hd, z1: zr, color: body, inner: lining, t: 0.018 })
  const shelfY = y0 + h / 2
  shelf(c, sh.ix0, sh.ix1, shelfY, sh.iz0, sh.iz1 - 0.02, body)
  const n = c.w >= 0.6 ? 2 : 1
  const ids = doorsAcross(c, { x0: -hw + 0.003, x1: hw - 0.003, y0: y0 + 0.003, y1: y1 - 0.003, zf, t, color: front, inner: lining, handle: 'knob', side: sideOf(c, 'left') })
  const zc = (sh.iz0 + sh.iz1 - 0.02) / 2
  const dmax = sh.iz1 - 0.02 - sh.iz0 - 0.02
  const slots = [
    ...c.row(sh.ix0 + 0.01, sh.ix1 - 0.01, sh.iy0, zc, n, [0.37, shelfY - 0.016 - sh.iy0 - 0.005, dmax]),
    ...c.row(sh.ix0 + 0.01, sh.ix1 - 0.01, shelfY, zc, n, [0.37, sh.iy1 - shelfY - 0.005, dmax]),
  ]
  c.container({ id: 'cupboard', access: ids[0], from: [sh.ix0, sh.iy0, sh.iz0], to: [sh.ix1, sh.iy1, sh.iz1], slots, loot: 'kitchen_cabinet' })
}

export function pantry(c: Ctx): void {
  const { hw, hd, h } = c
  const garage = c.M.variant === 'garage'
  const body = garage ? c.main(0x7d8a93) : c.wood(0xcdb690)
  const front = c.main(garage ? 0x7d8a93 : 0xe4dccb)
  const lining = mix(body, 0xffffff, 0.55)
  const zf = hd - HANDLE
  const t = 0.02
  const zr = garage ? hd : zf - t - 0.003
  const sh = shell(c, { x0: -hw, x1: hw, y0: 0.08, y1: h, z0: -hd, z1: zr, color: body, inner: lining, t: 0.018, material: garage ? 'metal' : 'wood' })
  c.b('wood', -hw + 0.01, 0, -hd + 0.03, hw - 0.01, 0.08, zr - 0.04, 0x3a3836)
  const ys = [0.45, 0.8, 1.15, 1.5, 1.85].filter((y) => y < h - 0.2)
  for (const y of ys) shelf(c, sh.ix0, sh.ix1, y, sh.iz0, sh.iz1 - (garage ? 0.02 : 0.025), body)
  const dmax = sh.iz1 - 0.03 - sh.iz0 - 0.05
  const zc = (sh.iz0 + sh.iz1 - 0.03) / 2
  const levels = [sh.iy0, ...ys]
  const slots = levels.flatMap((y, i) => c.row(sh.ix0 + 0.01, sh.ix1 - 0.01, y, zc, 3, [0.24, (i < levels.length - 1 ? levels[i + 1] - y : sh.iy1 - y) - 0.025, dmax]))
  if (garage) {
    c.container({ id: 'shelves', from: [sh.ix0, sh.iy0, sh.iz0], to: [sh.ix1, sh.iy1, sh.iz1], slots, loot: 'garage_shelf' })
    return
  }
  const ids = doorsAcross(c, { x0: -hw + 0.003, x1: hw - 0.003, y0: 0.083, y1: h - 0.003, zf, t, color: front, inner: lining, handle: 'knob', side: sideOf(c, 'left') })
  c.container({ id: 'shelves', access: ids[0], from: [sh.ix0, sh.iy0, sh.iz0], to: [sh.ix1, sh.iy1, sh.iz1], slots, loot: 'pantry' })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Bedroom
// ---------------------------------------------------------------------------------------------------------------------------------

export function wardrobe(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.wood(0xb69870)
  const front = c.main(0xd9c7a6)
  const lining = mix(body, 0xffffff, 0.55)
  const zf = hd - HANDLE
  const t = 0.02
  const zr = zf - t - 0.003
  const n = c.w >= 1.4 ? 3 : 2
  const sh = shell(c, { x0: -hw, x1: hw, y0: 0.1, y1: h, z0: -hd, z1: zr, color: body, inner: lining, t: 0.02, tBack: 0.012 })
  c.b('wood', -hw + 0.01, 0, -hd + 0.03, hw - 0.01, 0.1, zr - 0.04, 0x3a3836)
  const yBoard = 0.372
  c.b('wood', sh.ix0, yBoard, sh.iz0, sh.ix1, yBoard + 0.018, sh.iz1, shade(body, 0.95)) // floor of the hanging space
  c.b('plain', sh.ix0, yBoard + 0.018, sh.iz0, sh.ix1, yBoard + 0.021, sh.iz1, lining)
  const gap = 0.003
  const dw = (c.w - 0.006 - gap * (n - 1)) / n
  const dx = (i: number) => -hw + 0.003 + i * (dw + gap)
  const xs = dx(n - 1) - gap / 2 // start of the shelf section
  // vertical divider
  c.b('wood', xs - 0.009, yBoard + 0.018, sh.iz0, xs + 0.009, sh.iy1, sh.iz1 - 0.02, shade(body, 0.95))
  // hanging rod with clothes
  const rodY = Math.min(1.82, h - 0.28)
  const zc = (sh.iz0 + sh.iz1) / 2 - 0.02
  c.rod('metal', 'x', (sh.ix0 + xs - 0.009) / 2, rodY, zc, 0.0125, xs - 0.009 - sh.ix0, 0xb4b8bc)
  for (const x of [sh.ix0 + 0.01, xs - 0.02]) c.b('metal', x - 0.01, rodY - 0.03, zc - 0.03, x + 0.01, rodY + 0.03, zc + 0.03, 0x8c9096)
  const span = xs - 0.009 - sh.ix0 - 0.1
  const count = Math.max(4, Math.floor(span / 0.07))
  const palette = [0x3a5a8a, 0xa84a3a, 0x4a7a4a, 0xd8d0c0, 0x2a2a30, 0x8a6a9a, 0xc8a040]
  const kinds: GarmentKind[] = ['shirt', 'tshirt', 'jacket', 'dress', 'trousers']
  const start = Math.floor(c.rnd() * kinds.length)
  const avail = sh.iz1 - sh.iz0 - 0.07 // depth the garments may use, door side and back wall left free
  for (let i = 0; i < count; i++) {
    const x = sh.ix0 + 0.06 + (i + 0.5) * (span / count)
    const g = garment(kinds[(start + i) % kinds.length], palette[Math.floor(c.rnd() * palette.length)])
    const scale = Math.min(1, avail / g.width)
    // garments hang on wire hangers, edge on to the doors, each a little turned
    const yaw = Math.PI / 2 + (c.rnd() - 0.5) * 0.22
    drawPieces(c, hanger(g.width), { x, y: rodY, z: zc, yaw, scale })
    drawPieces(c, g.pieces, { x, y: rodY - 0.09 * scale, z: zc, yaw, scale })
  }
  // shelves in the last door's section
  const sy = [0.7, 1.05, 1.4, 1.75].filter((y) => y < h - 0.2)
  for (const y of sy) shelf(c, xs + 0.009, sh.ix1, y, sh.iz0, sh.iz1 - 0.02, body)
  const levels = [yBoard + 0.021, ...sy]
  const cols = sh.ix1 - (xs + 0.02) >= 0.3 ? 2 : 1 // a narrow shelf section holds one column, not two slivers
  const shelfSlots = levels
    .flatMap((y, i) => {
      const room = (i < levels.length - 1 ? levels[i + 1] - y : sh.iy1 - y) - 0.035
      return room >= 0.06 ? c.row(xs + 0.02, sh.ix1 - 0.01, y, (sh.iz0 + sh.iz1 - 0.02) / 2, cols, [0.24, room, 0.45]) : []
    })
  // drawers under the doors
  const side = sideOf(c, 'left')
  const y1 = h - 0.005
  const mirrorIdx = 1
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const x0 = dx(i)
    const x1 = x0 + dw
    const id = `door_${i + 1}`
    const sideI: Side = n === 3 ? (i === 0 ? 'left' : i === 2 ? 'right' : side) : i === 0 ? 'left' : 'right'
    ids.push(id)
    hingedDoor(c, {
      id, x0, x1, y0: yBoard + 0.021 + 0.004, y1, zf, t, side: sideI, color: front, inner: lining, handle: 'bar_v', handleLen: 0.35, label: 'prompt.door',
      extra:
        i === mirrorIdx
          ? () => {
              const mw = dw - 0.12
              const mh = 1.5
              const cy = (yBoard + 0.021 + y1) / 2 + 0.05
              const cx = (x0 + x1) / 2
              const f = 0.003
              c.plane('glass', cx, cy, zf + 0.004, mw, mh, 0xd6e4ea)
              c.b('metal', cx - mw / 2 - f, cy - mh / 2 - f, zf, cx + mw / 2 + f, cy - mh / 2, zf + f, 0xb4b8bc)
              c.b('metal', cx - mw / 2 - f, cy + mh / 2, zf, cx + mw / 2 + f, cy + mh / 2 + f, zf + f, 0xb4b8bc)
              c.b('metal', cx - mw / 2 - f, cy - mh / 2, zf, cx - mw / 2, cy + mh / 2, zf + f, 0xb4b8bc)
              c.b('metal', cx + mw / 2, cy - mh / 2, zf, cx + mw / 2 + f, cy + mh / 2, zf + f, 0xb4b8bc)
              c.add('mirrors', { id: 'mirror', center: [cx, cy, zf + 0.004], normal: [0, 0, 1], w: mw, h: mh, part: id })
            }
          : undefined,
    })
  }
  c.container({ id: 'shelves', access: ids[n - 1], from: [xs + 0.009, yBoard + 0.021, sh.iz0], to: [sh.ix1, sh.iy1, sh.iz1], slots: shelfSlots, loot: 'wardrobe' })
  for (let i = 0; i < n; i++) {
    const id = `drawer_${i + 1}`
    const info = drawer(c, { id, x0: dx(i), x1: dx(i) + dw, y0: 0.103, y1: yBoard - 0.003, zf, zb: sh.iz0, color: front, handle: 'bar_h', handleLen: 0.16 })
    c.container({
      id, access: id, from: [info.ix0, info.floor, info.iz0], to: [info.ix1, info.floor + info.free, info.iz1],
      slots: c.row(info.ix0 + 0.01, info.ix1 - 0.01, info.floor, (info.iz0 + info.iz1) / 2, 1, [0.4, info.free - 0.01, 0.4], id), loot: 'dresser',
    })
  }
}

export function dresser(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.wood(0xa88660)
  const front = c.main(0xc8a97c)
  const lining = mix(body, 0xffffff, 0.55)
  const zf = hd - HANDLE
  const top = h - 0.04
  const legH = 0.1
  const sh = shell(c, { x0: -hw, x1: hw, y0: legH, y1: top, z0: -hd, z1: zf, color: body, inner: lining, t: 0.02, tBack: 0.012 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b('wood', sx * (hw - 0.05) - 0.025, 0, sz * (hd - 0.06) - 0.025, sx * (hw - 0.05) + 0.025, legH, sz * (hd - 0.06) + 0.025, shade(body, 0.7))
  c.b('wood', -hw - 0.005, top, -hd, hw + 0.005, h, zf + 0.015, shade(body, 1.1))
  const n = 4
  const gap = 0.003
  const dh = (top - legH - gap * (n + 1)) / n
  for (let i = 0; i < n; i++) {
    const y0 = legH + gap + i * (dh + gap)
    const id = `drawer_${n - i}`
    const info = drawer(c, { id, x0: -hw + 0.003, x1: hw - 0.003, y0, y1: y0 + dh, zf, zb: sh.iz0, color: front, handle: 'bar_h', handleLen: 0.2 })
    c.container({
      id, access: id, from: [info.ix0, info.floor, info.iz0], to: [info.ix1, info.floor + info.free, info.iz1],
      slots: c.row(info.ix0 + 0.01, info.ix1 - 0.01, info.floor, (info.iz0 + info.iz1) / 2, 3, [0.3, info.free - 0.01, 0.4], id), loot: 'dresser',
    })
  }
}

export function nightstand(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.wood(0xa88660)
  const front = c.main(0xc8a97c)
  const lining = mix(body, 0xffffff, 0.55)
  const zf = hd - HANDLE
  const top = h - 0.03
  const legH = 0.08
  const t = 0.02
  const sh = shell(c, { x0: -hw, x1: hw, y0: legH, y1: top, z0: -hd, z1: zf - t - 0.003, color: body, inner: lining, t: 0.018, tBack: 0.012 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b('wood', sx * (hw - 0.04) - 0.02, 0, sz * (hd - 0.04) - 0.02, sx * (hw - 0.04) + 0.02, legH, sz * (hd - 0.04) + 0.02, shade(body, 0.7))
  c.b('wood', -hw - 0.005, top, -hd, hw + 0.005, h, zf + 0.015, shade(body, 1.1))
  const dh = 0.14
  const yDr = top - dh - 0.003
  const info = drawer(c, { id: 'drawer', x0: -hw + 0.003, x1: hw - 0.003, y0: yDr, y1: top - 0.003, zf, zb: sh.iz0, color: front, handle: 'knob' })
  hingedDoor(c, { id: 'door', x0: -hw + 0.003, x1: hw - 0.003, y0: legH + 0.003, y1: yDr - 0.003, zf, t, side: sideOf(c, 'left'), color: front, inner: lining, handle: 'knob', label: 'prompt.door' })
  c.container({
    id: 'drawer', access: 'drawer', from: [info.ix0, info.floor, info.iz0], to: [info.ix1, info.floor + info.free, info.iz1],
    slots: c.row(info.ix0 + 0.01, info.ix1 - 0.01, info.floor, (info.iz0 + info.iz1) / 2, 2, [0.18, info.free - 0.01, 0.3], 'drawer'), loot: 'nightstand',
  })
  c.container({
    id: 'cupboard', access: 'door', from: [sh.ix0, sh.iy0, sh.iz0], to: [sh.ix1, yDr, sh.iz1],
    slots: c.row(sh.ix0 + 0.01, sh.ix1 - 0.01, sh.iy0, (sh.iz0 + sh.iz1) / 2, 1, [0.3, yDr - sh.iy0 - 0.02, 0.3]), loot: 'nightstand',
  })
}

export function bathroomCabinet(c: Ctx): void {
  const { hw, hd, h, y0 } = c
  const body = c.main(0xeceff0)
  const lining = 0xf6f8f8
  const zf = hd - HANDLE
  const t = 0.018
  const y1 = y0 + h
  const sh = shell(c, { x0: -hw, x1: hw, y0, y1, z0: -hd, z1: zf - t - 0.003, color: body, inner: lining, t: 0.015, tBack: 0.01, material: 'plain' })
  const shelfYs = [y0 + h / 3, y0 + (2 * h) / 3]
  for (const y of shelfYs) shelf(c, sh.ix0, sh.ix1, y, sh.iz0, sh.iz1 - 0.01, 0xcfe6ea, 0.016, true)
  const levels = [sh.iy0, ...shelfYs]
  const zc = (sh.iz0 + sh.iz1) / 2
  const slots = levels.flatMap((y, i) => c.row(sh.ix0 + 0.01, sh.ix1 - 0.01, y, zc, 4, [0.12, (i < levels.length - 1 ? levels[i + 1] - y : sh.iy1 - y) - 0.025, sh.iz1 - sh.iz0 - 0.03]))
  const dx0 = -hw + 0.003
  const dx1 = hw - 0.003
  const mw = dx1 - dx0 - 0.08
  const mh = h - 0.1
  const cy = y0 + h / 2
  hingedDoor(c, {
    id: 'door', x0: dx0, x1: dx1, y0: y0 + 0.003, y1: y1 - 0.003, zf, t, side: sideOf(c, 'right'), color: body, inner: lining, style: 'flat', handle: 'knob', label: 'prompt.door',
    extra: () => {
      const f = 0.003
      const cx = (dx0 + dx1) / 2
      c.plane('glass', cx, cy, zf + 0.004, mw, mh, 0xd6e4ea)
      c.b('metal', cx - mw / 2 - f, cy - mh / 2 - f, zf, cx + mw / 2 + f, cy - mh / 2, zf + f, 0xb4b8bc)
      c.b('metal', cx - mw / 2 - f, cy + mh / 2, zf, cx + mw / 2 + f, cy + mh / 2 + f, zf + f, 0xb4b8bc)
      c.b('metal', cx - mw / 2 - f, cy - mh / 2, zf, cx - mw / 2, cy + mh / 2, zf + f, 0xb4b8bc)
      c.b('metal', cx + mw / 2, cy - mh / 2, zf, cx + mw / 2 + f, cy + mh / 2, zf + f, 0xb4b8bc)
      c.add('mirrors', { id: 'mirror', center: [cx, cy, zf + 0.004], normal: [0, 0, 1], w: mw, h: mh, part: 'door' })
    },
  })
  c.container({ id: 'cabinet', access: 'door', from: [sh.ix0, sh.iy0, sh.iz0], to: [sh.ix1, sh.iy1, sh.iz1], slots, loot: 'bathroom_cabinet' })
  c.add('damage', { target: 'door', kind: 'glass', hp: 20 })
}

export type { Vec3 }
