import type { BuilderContext, BuilderMap } from '../types'

export function ceilingBuilders({ kit }: BuilderContext): Partial<BuilderMap> {
  const B: Partial<BuilderMap> = {}
  B.ceiling_light = (M, a) => { const K = kit(M, a), t = K.ceiling(), on = !!M.on;
    K.cyl('plain', 0, t - 0.05, 0, 0.2, 0.05, 0xece8e0); K.cyl('plain', 0, t - 0.07, 0, 0.15, 0.02, 0xd8d4c8); K.cyl(on ? 'emissive' : 'plain', 0, t - 0.078, 0, 0.12, 0.012, on ? 0xfff0c8 : 0xf4f0e6);
    if (on) K.light(0, t - 0.15, 0, 0xffe8b8, 6, 'ceiling_light'); };
  B.pendant = (M, a) => { const K = kit(M, a), t = K.ceiling(), { h } = K.dim('pendant'), ys = t - h, color = K.main(0x2a2a2a);
    K.box('plain', 0, ys + 0.1, 0, 0.012, h - 0.1, 0.012, 0x1a1a1a); K.cyl('plain', 0, t - 0.03, 0, 0.05, 0.03, 0xe8e4dc);
    K.cyl('plain', 0, ys, 0, 0.17, 0.14, color, 0, 0, 'sphere'); K.cyl('emissive', 0, ys - 0.035, 0, 0.045, 0.09, 0xffe0a0, 0, 0, 'sphere');
    if (M.light) K.light(0, ys - 0.1, 0, 0xffc880, 6, 'pendant'); };
  B.track_spot = (M, a) => { const K = kit(M, a), t = K.ceiling(), { w } = K.dim('track_spot'), on = !!M.on;
    K.box('metal', 0, t - 0.025, 0, w, 0.025, 0.035, 0x2a2a2a);
    for (let i = -1; i <= 1; i++) { const u = i * w / 3; K.box('metal', u, t - 0.1, 0, 0.02, 0.075, 0.02, 0x2a2a2a); K.cyl('metal', u, t - 0.16, 0.04, 0.035, 0.11, 0x222222, 2.6, 0); K.cyl(on ? 'emissive' : 'plain', u, t - 0.208, 0.069, 0.028, 0.006, on ? 0xfff0c8 : 0xe8e8e8, 2.6, 0); } };
  B.chandelier = (M, a) => { const K = kit(M, a), t = K.ceiling(), on = !!M.on, y = t - 0.5, gold = K.metal(0x8a7a5a);
    K.box('metal', 0, y, 0, 0.012, 0.5, 0.012, gold); K.cyl('metal', 0, y - 0.04, 0, 0.06, 0.08, gold); K.cyl('metal', 0, y - 0.06, 0, 0.14, 0.015, gold);
    for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3, cx = Math.cos(an), cz = Math.sin(an);
      K.box('metal', cx * 0.14, y - 0.06, cz * 0.14, 0.28, 0.012, 0.012, gold, -an); K.cyl('plain', cx * 0.28, y - 0.06, cz * 0.28, 0.02, 0.09, 0xf0e6c8); K.cyl(on ? 'emissive' : 'plain', cx * 0.28, y + 0.03, cz * 0.28, 0.012, 0.03, on ? 0xffd890 : 0xe6d8b0, 0, 0, 'sphere');
      K.box('glass', cx * 0.3, y - 0.2, cz * 0.3, 0.025, 0.14, 0.025, 0xffffff, -an); K.box('glass', cx * 0.14, y - 0.18, cz * 0.14, 0.02, 0.12, 0.02, 0xffffff); }
    K.box('glass', 0, y - 0.3, 0, 0.05, 0.2, 0.05, 0xffffff, 0.7);
    if (M.light) K.light(0, y - 0.1, 0, 0xffd8a0, 6, 'chandelier'); };
  return B
}
