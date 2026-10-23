import { clamp } from './geometry'
import { STREAM } from './legacy-seeds'
import { PALETTE_STYLES, ROOM_COLORS, STATE_PLUGINS, resolveStyleId } from './registry'
import { createRng } from './rng'
import type { Rng } from './rng'
import type { Hsl } from './types'

export const HIGH_SATURATION = 0.4
export const MIN_WALL_FLOOR_CONTRAST = 20
export const MIN_FABRIC_FLOOR_CONTRAST = 15

const SCHEMES = ['analogous', 'complementary', 'split_complementary', 'triad'] as const
const HARMONY_OFFSETS: Record<string, [number, number]> = { analogous: [-30, 30], complementary: [180, 165], split_complementary: [150, 210], triad: [120, 240] }

/** Roles the contrast rules rely on. A palette recipe must produce them. */
export const ROLE_FABRIC_MAIN = 'fabric_main'
export const ROLE_FABRIC_ACCENT = 'fabric_accent'
export const ROLE_FLOOR_REFERENCE = 'floor_living'

/** Tools handed to a style recipe. `jit` and `rng` draw from the style's seeded stream: draw order is part of the contract. */
export interface PaletteDraw {
  rng: Rng
  base: [string, number, number, number]
  H0: number
  H1: number
  H2: number
  jit(v: number, a: number): number
  hsl(h: number, s: number, l: number): Hsl
}
export interface PaletteEarly {
  /** Accent mode: true saturates walls, false puts accents on objects. */
  wallMode: boolean
  /** Maximum wall saturation. */
  sMax: number
  /** Facade, wall, gate, roof, ceiling... in insertion order. */
  roles: Record<string, Hsl>
  /** General floor `[h, s, l]` for room types that do not define their own. */
  generalFloor: [number, number, number]
}
export interface PaletteStyleDef {
  /** Legacy stream suffix; defaults to the style id. */
  seedKey?: string
  /** Facade colour table `[labelKey, h, s, l]`. */
  facadeColors: [string, number, number, number][]
  /** Draws up to the room colours (before the room loop). */
  early(d: PaletteDraw): PaletteEarly
  /** Draws the object roles (wood, fabrics, metal, ground colours) after the room loop. */
  late(d: PaletteDraw, e: PaletteEarly): Record<string, Hsl>
}

export interface PaletteContext extends PaletteDraw {
  style: string
  sMax: number
  wallMode: boolean
  generalFloor: [number, number, number]
}

export const hslToInt = (h: number, s: number, l: number): number => {
  h = ((h % 360) + 360) % 360
  s = clamp(s, 0, 1)
  l = clamp(l, 0, 1)
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255)
}
export const intToHsl = (n: number): Hsl => {
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  const d = mx - mn
  let h = 0
  let s = 0
  if (d > 1e-9) {
    s = d / (1 - Math.abs(2 * l - 1))
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return { h, s, l }
}
/** CIE L* lightness of a packed RGB colour. */
export const lstar = (n: number): number => {
  const linear = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const Y = 0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255)
  return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : (Y * 24389) / 27
}
export const hexString = (n: number): string => '#' + (n >>> 0).toString(16).padStart(6, '0')

export interface PaletteOptions {
  seed?: number | string
  style?: string
  state?: string
}
export type Palette = { meta: { seed: number | string; style: string; state: string; scheme: string; base: string; accentMode: 'wall' | 'object' } } & Record<string, number | object>

/** Seeded colour-harmony palette: a facade base colour, a harmony scheme, role colours and contrast rules. */
export function palette(o?: PaletteOptions): Palette {
  const opt = o || {}
  let style = resolveStyleId(opt.style || 'budget')
  if (!PALETTE_STYLES[style]) style = PALETTE_STYLES.mid ? 'mid' : Object.keys(PALETTE_STYLES)[0]
  const def = PALETTE_STYLES[style]
  const state = opt.state || 'normal'
  const seed = opt.seed == null ? 1 : opt.seed
  const rng = createRng(seed, STREAM.palettePrefix + (def.seedKey ?? style))
  const table = def.facadeColors
  const base = table[Math.floor(rng() * table.length)]
  const scheme = SCHEMES[Math.floor(rng() * 4)]
  const offsets = HARMONY_OFFSETS[scheme]
  const jit = (v: number, a: number) => v + (rng() - 0.5) * a
  const hsl = (h: number, s: number, l: number): Hsl => ({ h: ((h % 360) + 360) % 360, s: clamp(s, 0, 1), l: clamp(l, 0, 1) })
  const H0 = base[1]
  const H1 = H0 + offsets[0]
  const H2 = H0 + offsets[1]
  const draw: PaletteDraw = { rng, base, H0, H1, H2, jit, hsl }
  const early = def.early(draw)
  const { wallMode, sMax } = early
  const R: Record<string, Hsl> = Object.assign({}, early.roles)
  const ctx: PaletteContext = Object.assign({ style, sMax, wallMode, generalFloor: early.generalFloor }, draw)
  for (const c of ROOM_COLORS) {
    const [wh, wl] = c.wall(ctx)
    R['wall_' + c.type] = hsl(wh, c.neutral ? Math.min(0.16, sMax) : clamp(jit(sMax * 0.75, sMax * 0.5), 0.03, sMax), jit(wl, 0.03))
    const pi = c.floor || early.generalFloor
    R['floor_' + c.type] = hsl(pi[0], Math.min(pi[1], wallMode ? 0.18 : 0.3), jit(pi[2], 0.04))
  }
  Object.assign(R, def.late(draw, early))
  // state hook (e.g. dirt: desaturate and darken)
  STATE_PLUGINS[state]?.adjustPalette?.(R)
  // anti-clash rules: floor never saturated if the wall is; minimum lightness separation
  const adjust = (color: Hsl, ref: Hsl, min: number, preferredDir?: number) => {
    for (let i = 0; i < 60; i++) {
      if (Math.abs(lstar(hslToInt(color.h, color.s, color.l)) - lstar(hslToInt(ref.h, ref.s, ref.l))) >= min) return
      const refL = lstar(hslToInt(ref.h, ref.s, ref.l))
      let dir = preferredDir || (refL > 50 ? -1 : 1)
      if ((dir < 0 && color.l <= 0.06) || (dir > 0 && color.l >= 0.94)) dir = -dir
      color.l = clamp(color.l + dir * 0.015, 0.04, 0.96)
    }
  }
  const types = ROOM_COLORS.map((c) => c.type)
  for (const c of types) {
    const w = R['wall_' + c]
    const p = R['floor_' + c]
    if (w.s > 0.3) p.s = Math.min(p.s, 0.2)
    if (p.s > HIGH_SATURATION) p.s = HIGH_SATURATION - 0.05
    adjust(p, w, MIN_WALL_FLOOR_CONTRAST + 2, lstar(hslToInt(w.h, w.s, w.l)) > 50 ? -1 : 1)
  }
  const floorRef = R[ROLE_FLOOR_REFERENCE] || R['floor_' + types[0]]
  const fabric = R[ROLE_FABRIC_MAIN]
  adjust(fabric, floorRef, MIN_FABRIC_FLOOR_CONTRAST + 3)
  adjust(R[ROLE_FABRIC_ACCENT], floorRef, MIN_FABRIC_FLOOR_CONTRAST + 3)
  for (const c of types) {
    const p = R['floor_' + c]
    if (Math.abs(lstar(hslToInt(fabric.h, fabric.s, fabric.l)) - lstar(hslToInt(p.h, p.s, p.l))) < MIN_FABRIC_FLOOR_CONTRAST)
      adjust(p, fabric, MIN_FABRIC_FLOOR_CONTRAST + 2, lstar(hslToInt(fabric.h, fabric.s, fabric.l)) > 50 ? -1 : 1)
  }
  const out: Record<string, unknown> = { meta: { seed, style, state, scheme, base: base[0], accentMode: wallMode ? 'wall' : 'object' } }
  for (const k of Object.keys(R)) out[k] = hslToInt(R[k].h, R[k].s, R[k].l)
  // final contrast after rounding: fabric against every floor; search lightness for floor (then wall) satisfying both rules
  const num = (k: string) => out[k] as number
  const pairOk = (w: number, p: number) => Math.abs(lstar(w) - lstar(p)) >= MIN_WALL_FLOOR_CONTRAST + 1 && Math.abs(lstar(num(ROLE_FABRIC_MAIN)) - lstar(p)) >= MIN_FABRIC_FLOOR_CONTRAST + 1
  const search = (color: number, ok: (n: number) => boolean) => {
    const h = intToHsl(color)
    let bestValue: number | null = null
    let md = 9
    for (let l = 0.02; l <= 0.98; l += 0.005) {
      const n = hslToInt(h.h, h.s, l)
      if (ok(n) && Math.abs(l - h.l) < md) {
        md = Math.abs(l - h.l)
        bestValue = n
      }
    }
    return bestValue
  }
  for (const c of types) {
    if (pairOk(num('wall_' + c), num('floor_' + c))) continue
    const n = search(num('floor_' + c), (p) => pairOk(num('wall_' + c), p))
    if (n != null) {
      out['floor_' + c] = n
      continue
    }
    // no solution with the floor alone: move the wall
    const w = search(num('wall_' + c), (w2) => pairOk(w2, num('floor_' + c)))
    if (w != null) out['wall_' + c] = w
  }
  return out as Palette
}
