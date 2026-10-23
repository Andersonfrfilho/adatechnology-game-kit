import type { Motion, Vec3 } from '@adatechnology/game-interactables'
import { Ctx, MAX_OPEN } from './ctx'
import { mix, round3, shade } from './util'

/** How far handles stick out of a front face. Footprints leave this room at the front. */
export const HANDLE = 0.03

export type HandleKind = 'bar_v' | 'bar_h' | 'knob' | 'none'

/** Handle on a front face at z = zf. `x, y` is the center of the handle (bar) or the knob position. */
export function handle(c: Ctx, kind: HandleKind, x: number, y: number, zf: number, len: number, color: number): void {
  if (kind === 'none') return
  const dark = shade(color, 0.7)
  if (kind === 'knob') {
    c.rod('plain', 'z', x, y, zf + 0.007, 0.007, 0.014, dark, 'cyl6')
    c.rod('metal', 'z', x, y, zf + 0.0205, 0.016, 0.013, color)
    c.rod('metal', 'z', x, y, zf + 0.0275, 0.009, 0.003, shade(color, 1.15), 'cyl6')
    return
  }
  const vertical = kind === 'bar_v'
  const gx = vertical ? 0.014 : len
  const gy = vertical ? len : 0.014
  // standoffs at both ends, then the grip bar
  for (const s of [-1, 1]) {
    const ox = vertical ? 0 : s * (len / 2 - 0.025)
    const oy = vertical ? s * (len / 2 - 0.025) : 0
    c.b('metal', x + ox - 0.006, y + oy - 0.006, zf, x + ox + 0.006, y + oy + 0.006, zf + 0.02, dark)
  }
  c.b('metal', x - gx / 2, y - gy / 2, zf + 0.018, x + gx / 2, y + gy / 2, zf + HANDLE, color)
  c.b('metal', x - gx / 2 + (vertical ? 0.003 : 0), y - gy / 2 + (vertical ? 0 : 0.003), zf + HANDLE, x + gx / 2 - (vertical ? 0.003 : 0), y + gy / 2 - (vertical ? 0 : 0.003), zf + HANDLE + 0.0005, shade(color, 1.2))
}

export interface DoorOptions {
  id: string
  x0: number
  x1: number
  y0: number
  y1: number
  /** Z of the outer face of the door. */
  zf: number
  t?: number
  /** Side of the hinge. */
  side: 'left' | 'right'
  color: number
  /** Inner lining colour (lighter than the outside). */
  inner?: number
  style?: 'shaker' | 'flat' | 'rim'
  handle?: HandleKind
  handleLen?: number
  angle?: number
  label?: string
  /** Extra things drawn inside the part (shelves on the door, mirror...). Coordinates are object-local. */
  extra?: () => void
  at?: Vec3 | false
}

/** Hinged door whose hinge sits on the front edge. Opens outward (+z). Returns the part id. */
export function hingedDoor(c: Ctx, o: DoorOptions): string {
  const t = o.t ?? 0.02
  const style = o.style ?? 'shaker'
  const angle = Math.min(MAX_OPEN, o.angle ?? 1.7)
  const px = o.side === 'left' ? o.x0 : o.x1
  const sign = o.side === 'left' ? -1 : 1
  const motion: Motion = { kind: 'hinge', axis: [0, 1, 0], angle: sign * angle }
  const handleX = o.side === 'left' ? o.x1 - 0.05 : o.x0 + 0.05
  const hl = o.handleLen ?? Math.min(0.3, (o.y1 - o.y0) * 0.35)
  const mat = style === 'flat' ? 'plain' : 'wood'
  c.part(
    o.id,
    [px, (o.y0 + o.y1) / 2, o.zf - t / 2],
    motion,
    () => {
      const zIn = o.zf - t
      if (style === 'shaker') {
        c.b(mat, o.x0, o.y0, zIn, o.x1, o.y1, o.zf - 0.005, o.color)
        const m = Math.min(0.055, (o.x1 - o.x0) / 4, (o.y1 - o.y0) / 4)
        c.b(mat, o.x0 + m, o.y0 + m, o.zf - 0.005, o.x1 - m, o.y1 - m, o.zf - 0.001, shade(o.color, 0.93))
        c.b(mat, o.x0 + m + 0.012, o.y0 + m + 0.012, o.zf - 0.001, o.x1 - m - 0.012, o.y1 - m - 0.012, o.zf, mix(o.color, 0xffffff, 0.08))
      } else if (style === 'rim') {
        c.b(mat, o.x0, o.y0, zIn, o.x1, o.y1, o.zf - 0.003, o.color)
        const r = 0.012
        c.b(mat, o.x0, o.y0, o.zf - 0.003, o.x1, o.y0 + r, o.zf, shade(o.color, 1.06))
        c.b(mat, o.x0, o.y1 - r, o.zf - 0.003, o.x1, o.y1, o.zf, shade(o.color, 1.06))
        c.b(mat, o.x0, o.y0 + r, o.zf - 0.003, o.x0 + r, o.y1 - r, o.zf, shade(o.color, 1.06))
        c.b(mat, o.x1 - r, o.y0 + r, o.zf - 0.003, o.x1, o.y1 - r, o.zf, shade(o.color, 1.06))
      } else {
        c.b(mat, o.x0, o.y0, zIn, o.x1, o.y1, o.zf, o.color)
        c.b(mat, o.x0 + 0.006, o.y0 + 0.006, o.zf - 0.002, o.x1 - 0.006, o.y1 - 0.006, o.zf, shade(o.color, 1.04))
      }
      // inner lining, lighter, with a thin gasket frame around it
      const inner = o.inner ?? mix(o.color, 0xffffff, 0.55)
      c.b('plain', o.x0 + 0.014, o.y0 + 0.014, zIn - 0.004, o.x1 - 0.014, o.y1 - 0.014, zIn, inner)
      c.b('plain', o.x0 + 0.006, o.y0 + 0.006, zIn - 0.002, o.x1 - 0.006, o.y0 + 0.014, zIn, 0x3a3a3c)
      c.b('plain', o.x0 + 0.006, o.y1 - 0.014, zIn - 0.002, o.x1 - 0.006, o.y1 - 0.006, zIn, 0x3a3a3c)
      c.b('plain', o.x0 + 0.006, o.y0 + 0.014, zIn - 0.002, o.x0 + 0.014, o.y1 - 0.014, zIn, 0x3a3a3c)
      c.b('plain', o.x1 - 0.014, o.y0 + 0.014, zIn - 0.002, o.x1 - 0.006, o.y1 - 0.014, zIn, 0x3a3a3c)
      if (o.handle && o.handle !== 'none') {
        const hy = o.handle === 'bar_h' ? (o.y0 + o.y1) / 2 : (o.y0 + o.y1) / 2
        const hx = o.handle === 'bar_h' ? (o.x0 + o.x1) / 2 : handleX
        handle(c, o.handle, hx, o.handle === 'knob' ? o.y0 + (o.y1 - o.y0) * 0.5 : hy, o.zf, hl, o.color > 0xd0d0d0 ? 0x9aa0a6 : 0xb8bcc0)
      }
      o.extra?.()
    },
    { label: o.label ?? 'prompt.door', at: o.at },
  )
  return o.id
}

export interface DrawerOptions {
  id: string
  x0: number
  x1: number
  y0: number
  y1: number
  /** Z of the outer face of the front panel. */
  zf: number
  /** Z of the back of the carcass interior. */
  zb: number
  color: number
  inner?: number
  handle?: HandleKind
  handleLen?: number
  label?: string
}

export interface DrawerInfo {
  /** Y of the drawer floor top: slots start here. */
  floor: number
  /** Inner free height above the floor. */
  free: number
  /** Inner x range and z range (closed pose). */
  ix0: number
  ix1: number
  iz0: number
  iz1: number
  /** Slide distance. */
  dist: number
}

/** Real open-top drawer: bottom, two sides, back and front panel. Slides 0.75 x its depth. */
export function drawer(c: Ctx, o: DrawerOptions): DrawerInfo {
  const ft = 0.02
  const th = 0.012
  const bx0 = o.x0 + 0.012
  const bx1 = o.x1 - 0.012
  const zBack = o.zb + 0.004
  const zFront = o.zf - ft
  const yb = o.y0 + 0.02
  const yt = o.y1 - 0.024
  const depth = zFront - zBack
  const dist = round3(0.75 * depth)
  const inner = o.inner ?? mix(o.color, 0xffffff, 0.5)
  const hl = o.handleLen ?? Math.min(0.2, (o.x1 - o.x0) * 0.4)
  c.part(
    o.id,
    [(o.x0 + o.x1) / 2, o.y0, o.zf],
    { kind: 'slide', axis: [0, 0, 1], distance: dist },
    () => {
      // front panel with a raised center
      c.b('wood', o.x0, o.y0, o.zf - ft, o.x1, o.y1, o.zf - 0.005, o.color)
      const m = Math.min(0.04, (o.y1 - o.y0) / 4)
      c.b('wood', o.x0 + m, o.y0 + m, o.zf - 0.005, o.x1 - m, o.y1 - m, o.zf - 0.001, shade(o.color, 0.94))
      c.b('wood', o.x0 + m + 0.01, o.y0 + m + 0.01, o.zf - 0.001, o.x1 - m - 0.01, o.y1 - m - 0.01, o.zf, mix(o.color, 0xffffff, 0.08))
      // box: bottom, sides, back
      c.b('wood', bx0, yb, zBack, bx1, yb + 0.008, zFront, shade(o.color, 0.85))
      c.b('wood', bx0, yb, zBack, bx0 + th, yt, zFront, shade(o.color, 0.88))
      c.b('wood', bx1 - th, yb, zBack, bx1, yt, zFront, shade(o.color, 0.88))
      c.b('wood', bx0 + th, yb, zBack, bx1 - th, yt, zBack + th, shade(o.color, 0.82))
      // lighter lining on the inner faces
      c.b('plain', bx0 + th, yb + 0.008, zBack + th, bx1 - th, yb + 0.011, zFront, inner)
      c.b('plain', bx0 + th, yb + 0.011, zBack + th, bx0 + th + 0.003, yt - 0.002, zFront, mix(inner, o.color, 0.2))
      c.b('plain', bx1 - th - 0.003, yb + 0.011, zBack + th, bx1 - th, yt - 0.002, zFront, mix(inner, o.color, 0.2))
      c.b('plain', bx0 + th + 0.003, yb + 0.011, zBack + th, bx1 - th - 0.003, yt - 0.002, zBack + th + 0.003, mix(inner, o.color, 0.1))
      handle(c, o.handle ?? 'bar_h', (o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, o.zf, hl, o.color > 0xd0d0d0 ? 0x9aa0a6 : 0xb8bcc0)
    },
    { label: o.label ?? 'prompt.drawer', at: [(o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, o.zf + HANDLE] },
  )
  return { floor: round3(yb + 0.011), free: round3(yt - yb - 0.014), ix0: bx0 + th, ix1: bx1 - th, iz0: zBack + th, iz1: zFront, dist }
}

export interface ShellOptions {
  x0: number
  x1: number
  y0: number
  y1: number
  /** Back and front planes of the carcass. */
  z0: number
  z1: number
  color: number
  /** Lining colour. */
  inner: number
  /** Side / back / top / bottom panel thickness. */
  t?: number
  tTop?: number
  tBottom?: number
  tBack?: number
  /** Skip the top (open shelf units) or the bottom. */
  noTop?: boolean
  noBottom?: boolean
  material?: 'wood' | 'plain' | 'metal'
}

export interface ShellInfo {
  /** Inner free box. */
  ix0: number
  ix1: number
  iy0: number
  iy1: number
  iz0: number
  iz1: number
}

/** Carcass of five outer panels with five lighter inner faces. The front (z1) stays open. */
export function shell(c: Ctx, o: ShellOptions): ShellInfo {
  const t = o.t ?? 0.018
  const tt = o.noTop ? 0 : (o.tTop ?? t)
  const tb = o.noBottom ? 0 : (o.tBottom ?? t)
  const tk = o.tBack ?? 0.012
  const m = o.material ?? 'wood'
  const dark = shade(o.color, 0.9)
  // outer panels
  c.b(m, o.x0, o.y0, o.z0, o.x1, o.y1, o.z0 + tk, shade(o.color, 0.82))
  c.b(m, o.x0, o.y0, o.z0 + tk, o.x0 + t, o.y1, o.z1, o.color)
  c.b(m, o.x1 - t, o.y0, o.z0 + tk, o.x1, o.y1, o.z1, o.color)
  if (!o.noTop) c.b(m, o.x0 + t, o.y1 - tt, o.z0 + tk, o.x1 - t, o.y1, o.z1, dark)
  if (!o.noBottom) c.b(m, o.x0 + t, o.y0, o.z0 + tk, o.x1 - t, o.y0 + tb, o.z1, dark)
  // inner lining faces
  const l = 0.003
  const ix0 = o.x0 + t
  const ix1 = o.x1 - t
  const iy0 = o.y0 + tb
  const iy1 = o.y1 - tt
  const iz0 = o.z0 + tk
  c.b('plain', ix0 + l, iy0 + l, iz0, ix1 - l, iy1 - l, iz0 + l, o.inner)
  c.b('plain', ix0, iy0, iz0 + l, ix0 + l, iy1, o.z1, mix(o.inner, o.color, 0.12))
  c.b('plain', ix1 - l, iy0, iz0 + l, ix1, iy1, o.z1, mix(o.inner, o.color, 0.12))
  if (!o.noTop) c.b('plain', ix0 + l, iy1 - l, iz0 + l, ix1 - l, iy1, o.z1, mix(o.inner, 0xffffff, 0.2))
  if (!o.noBottom) c.b('plain', ix0 + l, iy0, iz0 + l, ix1 - l, iy0 + l, o.z1, mix(o.inner, o.color, 0.2))
  return { ix0, ix1, iy0: iy0 + (o.noBottom ? 0 : l), iy1: iy1 - (o.noTop ? 0 : l), iz0: iz0 + l, iz1: o.z1 }
}

/** Horizontal shelf board across [x0, x1] x [z0, z1] with its top at y. */
export function shelf(c: Ctx, x0: number, x1: number, y: number, z0: number, z1: number, color: number, t = 0.016, glass = false): void {
  if (glass) {
    c.b('glass', x0, y - 0.006, z0, x1, y, z1, 0xcfe6ea)
    c.b('plain', x0, y - 0.008, z1 - 0.012, x1, y + 0.012, z1, 0xe4eef0)
  } else {
    c.b('wood', x0, y - t, z0, x1, y, z1, color)
    c.b('wood', x0, y - t, z1 - 0.003, x1, y, z1, shade(color, 1.12))
  }
}

/** Door hinged at its bottom edge (oven, freezer flap, mailbox flap). Opens outward (+z). */
export function dropDoor(
  c: Ctx,
  o: { id: string; x0: number; x1: number; y0: number; y1: number; zf: number; t?: number; color: number; inner?: number; angle?: number; handle?: HandleKind; handleLen?: number; label?: string; extra?: () => void },
): void {
  const t = o.t ?? 0.03
  const angle = Math.min(MAX_OPEN, o.angle ?? 1.5)
  const zIn = o.zf - t
  c.part(
    o.id,
    [(o.x0 + o.x1) / 2, o.y0, o.zf - t / 2],
    { kind: 'hinge', axis: [1, 0, 0], angle },
    () => {
      c.b('plain', o.x0, o.y0, zIn, o.x1, o.y1, o.zf - 0.004, o.color)
      c.b('plain', o.x0 + 0.01, o.y0 + 0.01, o.zf - 0.004, o.x1 - 0.01, o.y1 - 0.01, o.zf, shade(o.color, 1.06))
      c.b('plain', o.x0 + 0.012, o.y0 + 0.012, zIn - 0.004, o.x1 - 0.012, o.y1 - 0.012, zIn, o.inner ?? mix(o.color, 0xffffff, 0.5))
      handle(c, o.handle ?? 'bar_h', (o.x0 + o.x1) / 2, o.y1 - 0.05, o.zf, o.handleLen ?? (o.x1 - o.x0) * 0.7, 0xb4b8bc)
      o.extra?.()
    },
    { label: o.label ?? 'prompt.door', at: [(o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, o.zf + HANDLE] },
  )
}

/** Electric device that plugs into the nearest free socket: device spec plus a short cord stub for the host to extend. */
export function plugged(
  c: Ctx,
  id: string,
  kind: 'lamp' | 'appliance' | 'screen' | 'pump' | 'heater',
  watts: number,
  plug: Vec3,
  o: { on?: boolean; part?: string; channels?: number; fixture?: string } = {},
): void {
  const dev: import('@adatechnology/game-interactables').DeviceSpec = { id, kind, watts, socket: 'auto', plug }
  if (o.on) dev.on = true
  if (o.part) dev.part = o.part
  if (o.channels) dev.channels = o.channels
  if (o.fixture) dev.fixture = o.fixture
  c.add('devices', dev)
  const floor = c.y0 + 0.01
  c.add('wires', {
    id: `${id}_cord`,
    kind: 'cord',
    radius: 0.004,
    points: [plug, [plug[0], Math.max(floor, plug[1] - 0.08), plug[2] - 0.04], [plug[0] + 0.05, floor, plug[2] - 0.2]],
  })
}
