import type { BuilderContext, BuilderMap } from '../types'
import { shade } from '../colors'
import type { Kit } from '../types'
import { green } from './shared'

export function plantBuilders({ kit }: BuilderContext): Partial<BuilderMap> {
  const B: Partial<BuilderMap> = {}
  const foliage = (K: Kit, x: number, y: number, z: number, n: number, w: number, h0: number, h1: number, tilt0: number, tilt1: number, twist = 2.4) => { for (let i = 0; i < n; i++) { const an = i * twist + K.rnd() * 0.5, t = tilt0 + (tilt1 - tilt0) * K.rnd(); K.leaf(x + Math.cos(an) * 0.03, y, z + Math.sin(an) * 0.03, w * (0.8 + K.rnd() * 0.4), h0 + (h1 - h0) * K.rnd(), green(K, i), an, t); } };
  B.floor_plant = (M, a) => { const K = kit(M, a), { w } = K.dim('floor_plant'), r = Math.min(0.24, w * 0.4), pot = K.main(0xb5603c);
    K.cyl('plain', 0, 0, 0, r, 0.38, pot); K.cyl('plain', 0, 0.34, 0, r * 1.07, 0.05, shade(pot, 0.92)); K.cyl('plain', 0, 0.385, 0, r * 0.92, 0.012, 0x3a2a1e);
    foliage(K, 0, 0.39, 0, 11, 0.2, 0.5, 0.85, 0.2, 0.85); };
  B.table_plant = (M, a) => { const K = kit(M, a), y = M.y || 0, pot = K.main(0xf0eee8);
    K.cyl('plain', 0, y, 0, 0.05, 0.08, pot); K.cyl('plain', 0, y + 0.08, 0, 0.045, 0.008, 0x3a2a1e); foliage(K, 0, y + 0.085, 0, 7, 0.07, 0.1, 0.2, 0.2, 0.9); };
  B.hanging_plant = (M, a) => { const K = kit(M, a), t = K.ceiling(), h = K.dim('hanging_plant').h, yp = t - h, pot = K.main(0xf0eee8), rope = K.accent(0xd8ccb0);
    K.box('metal', 0, t - 0.025, 0, 0.03, 0.025, 0.03, 0x8a8a8a); for (let i = 0; i < 3; i++) { const an = i * 2.09; K.box('fabric', Math.cos(an) * 0.08, yp + 0.12, Math.sin(an) * 0.08, 0.01, t - yp - 0.15, 0.01, rope); }
    K.cyl('plain', 0, yp, 0, 0.1, 0.14, pot); K.cyl('plain', 0, yp + 0.135, 0, 0.09, 0.01, 0x3a2a1e);
    for (let i = 0; i < 11; i++) { const an = i * 2.4, up = i < 3; K.leaf(Math.cos(an) * 0.06, yp + 0.14, Math.sin(an) * 0.06, 0.09, up ? 0.22 : 0.4 + K.rnd() * 0.3, green(K, i), an, up ? 0.5 : 2.3 + K.rnd() * 0.3); } };
  return B
}
