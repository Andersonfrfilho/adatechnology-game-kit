import type { BuilderContext, BuilderMap } from '../types'
import type { PropType } from '../catalog'
import { hex, shade } from '../colors'
import type { Kit } from '../types'
import { drawTv, pick } from './shared'

export function wallBuilders({ kit, atlas }: BuilderContext): Partial<BuilderMap> {
  const B: Partial<BuilderMap> = {}
  B.wall_ac = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('wall_ac'), y = M.y || 2.15;
    K.box('plain', 0, y, 0, w, h, d, 0xf0f0ee); K.box('plain', 0, y + h - 0.02, d * 0.1, w - 0.04, 0.02, d * 0.8, 0xe6e6e2); // curved cover
    K.box('plain', 0, y + 0.02, d / 2 - 0.02, w - 0.1, 0.035, 0.04, 0x30343a); K.box('plain', 0, y - 0.005, d / 2 - 0.03, w - 0.12, 0.012, 0.07, 0xe6e6e2, 0, 0.45); // slot and flap
    K.box('plain', w / 2 - 0.1, y + h - 0.1, d / 2 + 0.001, 0.05, 0.02, 0.004, 0x2a3a30); K.box('plain', -w / 2 + 0.01, y + 0.02, 0.0, 0.01, h - 0.04, d - 0.02, 0xdcdcd8); };
  const frame = (K: Kit, id: PropType, def: number, large: boolean) => { const { w, d, h } = K.dim(id), y = K.M.y || def, fr = Math.min(w, h) * 0.07 + 0.008, margin = large ? 0.05 : 0.035, A = atlas('picture'), idx = K.M.art != null ? K.M.art % 7 : Math.floor(K.rnd() * 7);
    const cm = K.color('picture_accent', pick(K, [0x4a3324, 0x1c1c1c, 0xe8e2d4, 0x8a6a44])); K.box('wood', 0, y, 0, w, h, d, K.M.color != null ? hex(K.M.color) : cm);
    K.box('plain', 0, y + fr, d / 2 + 0.0005, w - 2 * fr, h - 2 * fr, 0.004, 0xf4f1e8); K.plane('atlas_picture', 0, y + h / 2, d / 2 + 0.005, w - 2 * fr - 2 * margin, h - 2 * fr - 2 * margin, 0xffffff, 0, 0, 0, A.uv(idx)); };
  B.picture_small = (M, a) => frame(kit(M, a), 'picture_small', 1.3, false);
  B.picture_large = (M, a) => frame(kit(M, a), 'picture_large', 1.2, true);
  B.mirror = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('mirror'), y = M.y || 0.9, A = atlas('picture'), cm = K.color('metal', 0x3a3a3c);
    K.box('metal', 0, y, 0, w, h, d, M.color != null ? hex(M.color) : cm); K.plane('atlas_picture', 0, y + h / 2, d / 2 + 0.003, w - 0.05, h - 0.05, 0xffffff, 0, 0, 0, A.mirror()); };
  B.curtain = (M, a) => { const K = kit(M, a), { w, h } = K.dim('curtain'), y = M.y != null && M.y > 0 ? M.y : 0.1, color = K.fabric(pick(K, [0xd8cdb4, 0x9fb0be, 0xc5a88c, 0xe0dcd0])), isOpen = M.open !== false, top = y + h;
    K.box('metal', 0, top, 0, w + 0.1, 0.025, 0.025, K.metal(0x5a5048)); for (const s of [-1, 1]) K.cyl('metal', s * (w / 2 + 0.07), top - 0.02, 0, 0.03, 0.07, 0x5a5048, 0, 0, 'sphere');
    const pw = isOpen ? Math.min(0.5, w * 0.3) : w / 2 + 0.03, n = Math.max(4, Math.round(pw / 0.08));
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) { const ux = isOpen ? s * (w / 2 + 0.03 - pw + (i + 0.5) * pw / n) : s * ((i + 0.5) * pw / n); K.box('fabric', ux, y, (i % 2 ? 0.025 : -0.01), pw / n * 1.15, h - 0.02, 0.02, i % 2 ? shade(color, 0.9) : color); }
    if (isOpen) for (const s of [-1, 1]) K.box('fabric', s * (w / 2 - pw * 0.25), y + h * 0.4, 0.04, pw * 0.5, 0.05, 0.02, shade(color, 0.7)); }; // tie-back
  B.blinds = (M, a) => { const K = kit(M, a), { w, h } = K.dim('blinds'), y = M.y || 1.0, retract = M.retracted != null ? M.retracted : 0.15, isWood = M.variant === 'wood', color = isWood ? K.wood(0x9a7a52) : K.color('wall_living', 0xe8e2d4), mat = isWood ? 'wood' : 'plain', yb = y + h * retract, n = Math.floor((y + h - yb) / 0.055);
    K.box('plain', 0, y + h - 0.05, 0, w, 0.05, 0.06, 0xdcd8d0); for (let i = 0; i < n; i++) K.box(mat, 0, y + h - 0.06 - (i + 1) * 0.055, 0.0, w - 0.05, 0.01, 0.035, color, 0, 0.3);
    for (const s of [-1, 1]) K.box('plain', s * (w / 2 - 0.05), yb, 0.02, 0.008, y + h - 0.05 - yb, 0.008, 0xb8b4ac); K.box('plain', 0, yb - 0.02, 0, w - 0.03, 0.025, 0.04, 0xdcd8d0); };
  B.flat_tv = (M, a) => { const K = kit(M, a), { w } = K.dim('flat_tv'); drawTv(K, 0, M.y != null && M.y > 0 ? M.y : 1.0, 0, w, false); };
  return B
}
