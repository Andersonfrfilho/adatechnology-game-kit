import { shade } from '../colors'
import type { Kit } from '../types'

export const GREENS = [0x3f7a3a, 0x2f6a30, 0x4f8a42, 0x5a9448]
/** i-th shade of green (from the `plant` palette role or the defaults), alternating darker. */
export const green = (K: Kit, i: number): number => {
  const v = K.color('plant', GREENS[i % GREENS.length])
  return i % 2 ? shade(v, 0.85) : v
}
export const pick = <T>(K: Kit, L: T[]): T => L[Math.floor(K.rnd() * L.length) % L.length]

// flat TV: panel, screen, back box and either a stand (two feet) or a wall bracket; returns the panel height
export const drawTv = (K: Kit, x: number, y: number, z: number, w: number, stand: boolean): number => { const h = w * 0.5625, yb = stand ? y + 0.07 : y;
  K.box('plain', x, yb, z, w, h, 0.035, 0x101112); K.box('metal', x, yb + 0.015, z + 0.0175, w - 0.03, h - 0.03, 0.004, 0x0a0c10); K.box('plain', x, yb + h * 0.2, z - 0.035, w * 0.5, h * 0.55, 0.04, 0x1a1a1a);
  if (stand) { for (const s of [-1, 1]) K.box('metal', x + s * w * 0.33, y, z, 0.1, 0.07, 0.22, 0x1a1a1a); } else K.box('metal', x, yb + h * 0.35, z - 0.065, w * 0.3, 0.03, 0.03, 0x2a2a2a); return h; };
