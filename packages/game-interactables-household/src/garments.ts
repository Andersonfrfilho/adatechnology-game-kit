import type { Material } from '@adatechnology/game-props3d'
import type { Ctx } from './ctx'
import { mix, shade } from './util'

/**
 * Garments built from thin boxes, in a 2D garment frame: `u` along the width (0 = center), `v` along the height (0 = the hang line, negative
 * below it) and `n` along the thickness. Used for the clothes on the line and the ones in the wardrobe.
 */
export type GarmentKind = 'tshirt' | 'trousers' | 'towel' | 'dress' | 'socks' | 'shirt' | 'jacket'

export const GARMENT_KINDS: readonly GarmentKind[] = ['tshirt', 'trousers', 'towel', 'dress', 'socks', 'shirt', 'jacket']

/** One thin box of a garment. `tilt` turns it about its center in the garment plane (radians). */
export interface Piece {
  m: Material
  u: number
  v: number
  w: number
  h: number
  /** Thickness. */
  t: number
  color: number
  tilt?: number
  /** Offset along the thickness. */
  n?: number
  /** What the piece is, for tests and for the pegs: 'body', 'sleeve', 'leg', 'collar', 'trim', 'peg', 'hanger'... */
  role: string
}

export interface Garment {
  kind: GarmentKind
  pieces: Piece[]
  /** Overall width and height (m) of the cloth, from the hang line down. */
  width: number
  height: number
  /** Where pegs clip on (u), at the top edge. */
  pegs: number[]
}

/** Cloth thickness of the thin boxes. */
export const CLOTH = 0.012

const TOP = -0.015 // the cloth starts just under the hang line so the peg overlaps it

function piece(role: string, u: number, v: number, w: number, h: number, color: number, o: { t?: number; tilt?: number; n?: number; m?: Material } = {}): Piece {
  return { m: o.m ?? 'fabric', u, v, w, h, t: o.t ?? CLOTH, color, tilt: o.tilt, n: o.n, role }
}

/** A box from its top-left corner (u0, v0) to its bottom-right corner (u1, v1). */
function span(role: string, u0: number, v0: number, u1: number, v1: number, color: number, o: { t?: number; tilt?: number; n?: number; m?: Material } = {}): Piece {
  return piece(role, (u0 + u1) / 2, (v0 + v1) / 2, Math.abs(u1 - u0), Math.abs(v0 - v1), color, o)
}

/** Sleeve: a box from the shoulder point (u, v) going outwards and down at `angle` from the vertical, `len` long. */
function sleeve(side: 1 | -1, u: number, v: number, len: number, width: number, angle: number, color: number): Piece {
  const du = Math.sin(angle) * side
  const dv = -Math.cos(angle)
  // a hair thinner than the body, so the part that overlaps the body hides inside it
  return piece('sleeve', u + (du * len) / 2, v + (dv * len) / 2, width, len, color, { t: CLOTH - 0.001, tilt: side * angle })
}

function tshirt(col: number): Garment {
  const p: Piece[] = []
  const trim = shade(col, 0.82)
  const bw = 0.2 // half width of the body
  p.push(span('body', -bw, TOP - 0.07, bw, -0.6, col))
  // shoulders with the neck opening in the middle
  for (const s of [-1, 1] as const) p.push(span('shoulder', s * 0.045, TOP, s * (bw + 0.01), TOP - 0.07, col, { t: 0.014 }))
  p.push(span('inside', -0.045, TOP - 0.005, 0.045, TOP - 0.05, shade(col, 0.55), { n: -CLOTH }))
  p.push(span('collar', -0.052, TOP - 0.045, 0.052, TOP - 0.06, trim, { t: 0.015 }))
  for (const s of [-1, 1] as const) p.push(sleeve(s, s * (bw + 0.005), TOP - 0.04, 0.2, 0.115, 0.95, shade(col, 0.96)))
  p.push(span('trim', -bw, -0.585, bw, -0.6, trim, { t: 0.014 })) // hem
  p.push(span('pocket', 0.05, -0.2, 0.13, -0.27, shade(col, 0.9), { t: 0.016 }))
  return { kind: 'tshirt', pieces: p, width: 0.62, height: 0.6, pegs: [-0.16, 0.16] }
}

function shirt(col: number): Garment {
  const g = tshirt(col)
  // long sleeves hanging at the sides and a button strip
  g.kind = 'shirt'
  g.pieces = g.pieces.filter((q) => q.role !== 'sleeve' && q.role !== 'pocket')
  for (const s of [-1, 1] as const) g.pieces.push(sleeve(s, s * 0.205, TOP - 0.04, 0.5, 0.085, 0.16, shade(col, 0.96)))
  g.pieces.push(span('trim', -0.01, -0.07, 0.01, -0.6, shade(col, 0.78), { t: 0.016 }))
  g.width = 0.5
  return g
}

function jacket(col: number): Garment {
  const g = shirt(col)
  g.kind = 'jacket'
  const dark = shade(col, 0.75)
  g.pieces = g.pieces.filter((q) => q.role !== 'trim')
  g.pieces.push(span('trim', -0.205, -0.7, 0.205, -0.72, dark, { t: 0.017 }))
  g.pieces.push(span('body', -0.2, -0.6, 0.2, -0.7, col)) // longer than a shirt
  g.pieces.push(span('trim', -0.012, -0.07, 0.012, -0.72, dark, { t: 0.018 })) // zip
  for (const s of [-1, 1] as const) g.pieces.push(span('trim', s * 0.07, -0.34, s * 0.16, -0.4, dark, { t: 0.018 })) // pockets
  g.height = 0.72
  return g
}

function trousers(col: number): Garment {
  const p: Piece[] = []
  const dark = shade(col, 0.78)
  p.push(span('waist', -0.17, TOP, 0.17, TOP - 0.05, dark, { t: 0.015 }))
  p.push(span('crotch', -0.16, TOP - 0.05, 0.16, TOP - 0.2, col))
  for (const s of [-1, 1] as const) {
    // each leg tapers a little: a slightly tilted box
    p.push(piece('leg', s * 0.085, TOP - 0.2 - 0.27, 0.155, 0.54, s > 0 ? col : shade(col, 0.94), { tilt: s * 0.02 }))
    p.push(span('trim', s * 0.01 + s * 0.0, -0.74, s * 0.165, -0.76, dark, { t: 0.015 }))
  }
  p.push(span('seam', -0.004, TOP - 0.05, 0.004, TOP - 0.2, dark, { t: 0.016 })) // fly
  for (const s of [-1, 1] as const) p.push(span('trim', s * 0.09, TOP - 0.08, s * 0.15, TOP - 0.15, shade(col, 0.88), { t: 0.016 })) // pockets
  return { kind: 'trousers', pieces: p, width: 0.34, height: 0.76, pegs: [-0.14, 0.14] }
}

function towel(col: number): Garment {
  const p: Piece[] = []
  const stripe = mix(col, 0xffffff, 0.55)
  // folded over the line: a front layer and a shorter back layer
  p.push(span('body', -0.25, TOP, 0.25, -0.82, col, { t: 0.014, n: 0.009 }))
  p.push(span('body', -0.25, TOP, 0.25, -0.74, shade(col, 0.93), { t: 0.014, n: -0.009 }))
  p.push(span('trim', -0.25, -0.62, 0.25, -0.67, stripe, { t: 0.017, n: 0.009 }))
  p.push(span('trim', -0.25, -0.7, 0.25, -0.72, stripe, { t: 0.017, n: 0.009 }))
  for (let i = 0; i < 12; i++) p.push(span('fringe', -0.245 + i * 0.0417, -0.82, -0.215 + i * 0.0417, -0.86, shade(col, 1.04), { t: 0.01, n: 0.009 }))
  return { kind: 'towel', pieces: p, width: 0.5, height: 0.86, pegs: [-0.2, 0.2] }
}

function dress(col: number): Garment {
  const p: Piece[] = []
  const trim = shade(col, 0.8)
  for (const s of [-1, 1] as const) p.push(span('strap', s * 0.05, TOP, s * 0.075, TOP - 0.12, trim, { t: 0.01 }))
  p.push(span('body', -0.1, TOP - 0.1, 0.1, -0.34, col)) // bodice
  p.push(span('trim', -0.105, -0.34, 0.105, -0.37, trim, { t: 0.015 })) // belt
  // skirt: steps that widen towards the hem
  const steps = 11
  for (let i = 0; i < steps; i++) {
    const v0 = -0.37 - i * 0.06
    const half = 0.115 + i * 0.024
    p.push(span('skirt', -half, v0, half, v0 - 0.06, i % 2 ? shade(col, 0.97) : col))
  }
  p.push(span('trim', -0.38, -1.03, 0.38, -1.05, mix(col, 0xffffff, 0.45), { t: 0.014 }))
  return { kind: 'dress', pieces: p, width: 0.69, height: 1.05, pegs: [-0.063, 0.063] }
}

function socks(col: number): Garment {
  const p: Piece[] = []
  const toe = mix(col, 0xffffff, 0.55)
  for (const s of [-1, 1] as const) {
    const u = s * 0.075
    const c = s > 0 ? col : shade(col, 0.9)
    p.push(span('cuff', u - 0.037, TOP, u + 0.037, TOP - 0.035, toe, { t: 0.014 }))
    p.push(span('leg', u - 0.033, TOP - 0.035, u + 0.033, -0.17, c))
    // the foot turns outwards at the bottom
    p.push(span('foot', u - 0.033 * s, -0.17, u + 0.105 * s, -0.235, c))
    p.push(span('toe', u + 0.07 * s, -0.17, u + 0.105 * s, -0.235, toe, { t: 0.014 }))
    p.push(span('heel', u - 0.033 * s, -0.17, u - 0.001 * s, -0.235, shade(c, 0.8), { t: 0.014 }))
  }
  return { kind: 'socks', pieces: p, width: 0.36, height: 0.235, pegs: [-0.075, 0.075] }
}

const MAKERS: Record<GarmentKind, (col: number) => Garment> = { tshirt, trousers, towel, dress, socks, shirt, jacket }

/** Extent of the pieces: half width (largest |u| of any corner) and the lowest v, tilted boxes included. */
export function extentOf(pieces: readonly Piece[]): { half: number; bottom: number; top: number } {
  let half = 0
  let bottom = 0
  let top = -Infinity
  for (const p of pieces) {
    const c = Math.cos(p.tilt ?? 0)
    const s = Math.sin(p.tilt ?? 0)
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = (sx * p.w) / 2
        const y = (sy * p.h) / 2
        half = Math.max(half, Math.abs(p.u + x * c - y * s))
        const v = p.v + x * s + y * c
        bottom = Math.min(bottom, v)
        top = Math.max(top, v)
      }
    }
  }
  return { half, bottom, top }
}

/** The pieces of a garment of `kind` in `color` (pure geometry, no drawing). Width and height are measured from the pieces. */
export function garment(kind: GarmentKind, color: number): Garment {
  const g = MAKERS[kind](color)
  const e = extentOf(g.pieces)
  g.width = Math.round(e.half * 2 * 1000) / 1000
  g.height = Math.round(-e.bottom * 1000) / 1000
  return g
}

/** Clothes pegs at the top edge of a garment: two small clips, one on each side of the cloth. */
export function pegs(g: Garment, color: number): Piece[] {
  const out: Piece[] = []
  for (const u of g.pegs) {
    out.push({ m: 'plain', u, v: TOP / 2 - 0.012, w: 0.018, h: 0.065, t: 0.032, color, role: 'peg' })
    out.push({ m: 'plain', u, v: TOP / 2 + 0.017, w: 0.022, h: 0.012, t: 0.036, color: shade(color, 0.8), role: 'peg' })
  }
  return out
}

/** A wire hanger: the hook, a post and the triangle of the shoulders and the bar, in the garment frame (hang line at v = 0 = the rod). */
export function hanger(width: number): Piece[] {
  const col = 0xb9bcc0
  const half = Math.min(0.22, width / 2)
  const rise = 0.07
  const len = Math.hypot(half, rise)
  const ang = Math.atan2(rise, half)
  const out: Piece[] = [
    { m: 'metal', u: 0, v: -0.03, w: 0.005, h: 0.06, t: 0.005, color: col, role: 'hanger' },
    { m: 'metal', u: 0, v: 0.013, w: 0.026, h: 0.005, t: 0.005, color: col, role: 'hanger' },
  ]
  for (const s of [-1, 1] as const) {
    out.push({ m: 'metal', u: (s * half) / 2, v: -0.06 - rise / 2, w: len, h: 0.004, t: 0.004, color: col, tilt: s > 0 ? -ang : ang, role: 'hanger' })
  }
  out.push({ m: 'metal', u: 0, v: -0.06 - rise, w: half * 2, h: 0.004, t: 0.004, color: col, role: 'hanger' })
  return out
}

export interface GarmentFrame {
  /** World (object-local) position of the garment frame origin. */
  x: number
  y: number
  z: number
  /** Turn about +y. 0 = the garment faces +z. */
  yaw: number
  /** Scales widths and heights (not the cloth thickness). Default 1. */
  scale?: number
}

/** Draws pieces with the ctx: `tilt` is in the garment plane, then the whole garment is turned by `yaw`. */
export function drawPieces(c: Ctx, pieces: readonly Piece[], f: GarmentFrame): void {
  const cos = Math.cos(f.yaw)
  const sin = Math.sin(f.yaw)
  const k = f.scale ?? 1
  for (const p of pieces) {
    const n = p.n ?? 0
    const x = f.x + p.u * k * cos + n * sin
    const z = f.z - p.u * k * sin + n * cos
    c.box(p.m, x, f.y + p.v * k - (p.h * k) / 2, z, p.w * k, p.h * k, p.t, p.color, f.yaw, 0, p.tilt ?? 0)
  }
}
