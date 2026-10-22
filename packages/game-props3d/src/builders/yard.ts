import type { BuilderContext, BuilderMap } from '../types'
import { hex, shade } from '../colors'
import { green, pick } from './shared'

export function yardBuilders({ kit, cover }: BuilderContext): Partial<BuilderMap> {
  const B: Partial<BuilderMap> = {}
  B.ac_condenser = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('ac_condenser'), y = M.y != null && M.y > 0 ? M.y : 0.5;
    for (const s of [-1, 1]) { K.box('metal', s * w * 0.32, y - 0.06, -d / 2 - 0.2, 0.04, 0.04, 0.3, 0x6a6a6a); K.box('metal', s * w * 0.32, y - 0.5 + 0.06, -d / 2 - 0.2 - 0.0, 0.035, 0.46, 0.035, 0x6a6a6a, 0, 0.0); }
    K.box('plain', 0, y, 0, w, h, d, 0xe8e8e4); K.box('plain', 0, y + h - 0.02, 0, w + 0.02, 0.025, d + 0.02, 0xd8d8d4);
    K.cyl('metal', -w * 0.12, y + h / 2, d / 2 + 0.004, 0.2, 0.012, 0x2a2a2e, Math.PI / 2, 0); K.cyl('metal', -w * 0.12, y + h / 2, d / 2 + 0.012, 0.085, 0.02, 0x4a4a4e, Math.PI / 2, 0);
    for (let i = 0; i < 4; i++) K.box('metal', -w * 0.12, y + h / 2 - 0.2, d / 2 + 0.018, 0.4, 0.008, 0.008, 0x8a8a8a, 0, 0, i * 0.785);
    for (let i = 0; i < 3; i++) K.cyl('metal', -w * 0.12, y + h / 2, d / 2 + 0.02, 0.07 + i * 0.043, 0.006, 0x7a7a7e, Math.PI / 2, 0);
    for (let i = 0; i < 6; i++) K.box('plain', w * 0.33, y + 0.06 + i * 0.075, d / 2 + 0.003, 0.14, 0.03, 0.006, 0xc4c4c0);
    K.cyl('metal', w / 2 - 0.05, y + 0.1, -d / 2 - 0.08, 0.012, 0.18, 0xb8733c, Math.PI / 2, 0); K.box('plain', w / 2 - 0.05, y + 0.06, -d / 2 - 0.02, 0.05, 0.12, 0.05, 0xe0e0dc); };
  B.pool = (M, a) => { const K = kit(M, a), { w, d } = K.dim('pool'), t = 0.32, bo = K.color('exterior_floor', 0xe8e4da);
    K.box('plain', 0, 0, -d / 2 - t / 2, w + 2 * t, 0.1, t, bo); K.box('plain', 0, 0, d / 2 + t / 2, w + 2 * t, 0.1, t, bo); for (const s of [-1, 1]) K.box('plain', s * (w / 2 + t / 2), 0, 0, t, 0.1, d, bo);
    cover(a, M, 'pool_tile', { w, d, y: 0.035, size: 1.0 });
    K.plane('water', 0, 0.075, 0, w, d, 0x8fd4ee, 0, -Math.PI / 2, 0);
    for (let i = 0; i < 3; i++) K.box('plain', w / 2 - 0.35 + i * 0.0, 0.035 + i * 0.01, d / 2 - 0.2 - i * 0.28, 0.7 - i * 0.05, 0.03, 0.26, 0xdfeef2);
    for (const s of [-1, 1]) { K.box('metal', -w / 4 + s * 0.2, 0.0, d / 2 + t * 0.6, 0.03, 0.85, 0.03, 0xc8ccd0); K.box('metal', -w / 4 + s * 0.2, 0.85, d / 2 + t * 0.6 - 0.1, 0.03, 0.03, 0.22, 0xc8ccd0); K.box('metal', -w / 4 + s * 0.2, 0.0, d / 2 - 0.25, 0.03, 0.88, 0.03, 0xc8ccd0, 0, 0.0); }
    for (let i = 0; i < 3; i++) K.box('metal', -w / 4, 0.02, d / 2 - 0.08 - i * 0.07, 0.4, 0.015, 0.05, 0xc8ccd0); };
  B.deck = (M, a) => { const K = kit(M, a), { w, d } = K.dim('deck'), h = 0.2, wood = K.wood(0x6a4a30);
    K.box('wood', 0, 0, 0, w - 0.05, h, d - 0.05, shade(wood, 0.7)); cover(a, M, 'deck_floor', { w, d, y: h + 0.012, size: 1.2, color: M.color });
    for (const [x, z, ww, dd] of [[0, -d / 2, w, 0.05], [0, d / 2, w, 0.05], [-w / 2, 0, 0.05, d], [w / 2, 0, 0.05, d]]) K.box('wood', x, 0, z, ww, h + 0.02, dd, wood);
    K.box('wood', 0, 0, d / 2 + 0.17, 1.4, 0.1, 0.34, wood); K.box('wood', 0, 0.1, d / 2 + 0.17, 1.4, 0.012, 0.34, shade(wood, 1.2)); };
  B.sun_lounger = (M, a) => { const K = kit(M, a), { w } = K.dim('sun_lounger'), fr = K.metal(0xe8e8e4), al = 0.95, cu = K.fabric(0x3a6a9a), stripe = K.accent(0xf0ece0);
    for (const s of [-1, 1]) { K.box('metal', s * (w / 2 - 0.03), 0.17, -0.3, 0.035, 0.035, 1.35, fr); K.box('metal', s * (w / 2 - 0.03), 0.0, 0.95, 0.035, 0.2, 0.035, fr); K.box('metal', s * (w / 2 - 0.03), 0.0, -0.3, 0.035, 0.2, 0.035, fr); K.cyl('plain', s * (w / 2 - 0.03), 0.07, -0.3, 0.07, 0.03, 0x2a2a2a, 0, Math.PI / 2); }
    K.box('fabric', 0, 0.21, 0.35, w - 0.1, 0.06, 1.3, cu); K.ramp('fabric', 0, 0.2, -0.3, w - 0.1, 0.06, 0.8, cu, al);
    for (let i = 0; i < 4; i++) { K.box('fabric', 0, 0.265, 0.0 + i * 0.3, w - 0.098, 0.004, 0.08, stripe); } K.ramp('metal', w / 2 - 0.03, 0.18, -0.3, 0.03, 0.03, 0.5, fr, al - 0.3); K.ramp('metal', -w / 2 + 0.03, 0.18, -0.3, 0.03, 0.03, 0.5, fr, al - 0.3); };
  B.garden_bed = (M, a) => { const K = kit(M, a), { w, d } = K.dim('garden_bed'), wood = K.wood(0x9a7048), hb = 0.3;
    for (const s of [-1, 1]) { K.box('wood', 0, 0, s * (d / 2 - 0.015), w, hb, 0.03, wood); K.box('wood', s * (w / 2 - 0.015), 0, 0, 0.03, hb, d - 0.06, shade(wood, 0.9)); }
    K.box('plain', 0, 0.02, 0, w - 0.06, hb - 0.05, d - 0.06, 0x3a2a1e);
    const lin = d > 0.8 ? 3 : 2, n = Math.max(3, Math.round(w / 0.4));
    for (let r = 0; r < lin; r++) for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n, z = (r - (lin - 1) / 2) * 0.3;
      if (r === 0) { for (let j = 0; j < 6; j++) K.leaf(x, hb - 0.02, z, 0.11, 0.14, green(K, j) , j * 1.05, 0.9); }
      else if (r === 1) { K.box('wood', x, hb - 0.03, z, 0.015, 0.75, 0.015, 0x8a7048); K.cyl('plant', x, hb + 0.05, z, 0.1, 0.28, green(K, i), 0, 0, 'sphere'); K.cyl('plain', x + 0.05, hb + 0.18, z + 0.07, 0.03, 0.06, 0xc83030, 0, 0, 'sphere'); K.cyl('plain', x - 0.06, hb + 0.3, z + 0.05, 0.03, 0.06, 0xd04030, 0, 0, 'sphere'); }
      else { K.cyl('plant', x, hb - 0.02, z, 0.1, 0.17, 0x8ab05a, 0, 0, 'sphere'); for (let j = 0; j < 5; j++) K.leaf(x, hb, z, 0.14, 0.2, green(K, j + 1), j * 1.3, 1.0); } } };
  B.fruit_tree = (M, a) => { const K = kit(M, a), { w, h } = K.dim('fruit_tree'), fruit = M.fruit || pick(K, [0xe8801c, 0xe8a030, 0xb8c050, 0xc83030, 0xd8d040]), tr = K.wood(0x6a4a30);
    K.cyl('wood', 0, 0, 0, 0.13, h * 0.5, tr); K.box('wood', 0.2, h * 0.35, 0, 0.08, 0.6, 0.08, tr, 0, 0, -0.7); K.box('wood', -0.2, h * 0.35, 0.05, 0.08, 0.55, 0.08, tr, 0, 0, 0.7);
    const bl = [[0, h * 0.72, 0, 1.0], [0.55, h * 0.62, 0.2, 0.7], [-0.55, h * 0.64, -0.1, 0.72], [0.1, h * 0.6, -0.55, 0.65], [0.1, h * 0.9, 0.1, 0.6]];
    bl.forEach(([x, y, z, r], i) => K.cyl('plant', x * w / 2.4, y - r * 0.4, z * w / 2.4, r * w / 2.4, r * 1.5 * w / 2.4, green(K, i), 0, 0, 'sphere'));
    for (let i = 0; i < 16; i++) { const b = bl[i % 4], an = K.rnd() * 6.28, el = K.rnd() * 0.9, r = b[3] * w / 2.4 * 0.95; K.cyl('plain', b[0] * w / 2.4 + Math.cos(an) * r * Math.cos(el), b[1] * 1.0 - b[3] * 0.4 + Math.sin(el) * r * 0.5, b[2] * w / 2.4 + Math.sin(an) * r * Math.cos(el), 0.055, 0.11, fruit, 0, 0, 'sphere'); } };
  B.palm_tree = (M, a) => { const K = kit(M, a), { h } = K.dim('palm_tree'), tr = K.wood(0x8a7a5a), lean = 0.35, n = 9, sh = h * 0.78 / n; let x = 0, y = 0;
    for (let i = 0; i < n; i++) { const r = 0.14 - i * 0.006; K.cyl('wood', x, y, 0, r, sh, i % 2 ? tr : shade(tr, 0.82)); y += sh; x += lean * (2 * i + 1) / (n * n) * 1.2; }
    const top = y;
    for (let i = 0; i < 10; i++) { const an = i * 0.628 + K.rnd() * 0.2, t1 = 0.7 + K.rnd() * 0.4, L = 1.5, w = 0.5; K.leaf(x, top, 0, w, L, green(K, i), an, t1);
      const ex = x + Math.sin(t1) * Math.sin(an) * L, ey = top + Math.cos(t1) * L, ez = Math.sin(t1) * Math.cos(an) * L; K.leaf(ex, ey, ez, w * 0.7, 0.9, green(K, i + 1), an, t1 + 1.0); }
    for (let i = 0; i < 3; i++) K.cyl('wood', x + Math.cos(i * 2.1) * 0.14, top - 0.2, Math.sin(i * 2.1) * 0.14, 0.09, 0.2, 0x6a5a3a, 0, 0, 'sphere'); };
  B.pergola = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('pergola'), wood = M.variant === 'dark' ? shade(K.wood(0x6a4a30), 0.8) : K.color('exterior_floor', 0xe8e2d4), pc = M.color != null ? hex(M.color) : wood;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('wood', sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), 0.14, h, 0.14, pc);
    for (const sz of [-1, 1]) K.box('wood', 0, h - 0.04, sz * (d / 2 - 0.1), w + 0.2, 0.16, 0.08, pc); const n = Math.round(w / 0.4);
    for (let i = 0; i <= n; i++) K.box('wood', -w / 2 - 0.1 + i * (w + 0.2) / n, h + 0.12, 0, 0.06, 0.08, d + 0.3, shade(pc, 0.92));
    for (let i = 0; i < 9; i++) K.leaf(-w / 2 + 0.1 + (i % 2) * 0.06, 0.2 + i * 0.25, -d / 2 + 0.1, 0.2, 0.28, green(K, i), i * 1.7, 0.7); for (let i = 0; i < 7; i++) K.leaf(-w / 2 + 0.2 + i * 0.35, h + 0.2, -d / 4 + K.rnd() * 0.3, 0.22, 0.3, green(K, i), i * 2.0, 1.3); };
  B.slide = (M, a) => { const K = kit(M, a), { d, h } = K.dim('slide'), py = h * 0.8, pz = -d / 2 + 0.55, az = K.accent(0xe8c030), vm = K.main(0xc8403a), az2 = 0x3a6ab0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('metal', sx * 0.3, 0, pz + sz * 0.3, 0.05, py, 0.05, az2);
    K.box('plain', 0, py, pz, 0.74, 0.05, 0.74, vm); for (const s of [-1, 1]) { K.box('plain', s * 0.35, py + 0.05, pz, 0.04, 0.42, 0.74, az); }
    K.box('plain', 0, py + 0.05, pz - 0.35, 0.74, 0.42, 0.04, az); const run = d / 2 - pz - 0.4, al = Math.atan2(py - 0.1, run);
    K.ramp('plain', 0, py, pz + 0.37, 0.5, 0.04, Math.hypot(run, py - 0.1) + 0.1, 0xd8d0c0, -al + 0.0 + 0); for (const s of [-1, 1]) K.ramp('plain', s * 0.27, py + 0.03, pz + 0.37, 0.04, 0.12, Math.hypot(run, py - 0.1) + 0.1, az, -al);
    for (const s of [-1, 1]) K.box('metal', s * 0.28, 0, pz - 0.45, 0.04, py + 0.1, 0.04, az2, 0, -0.1 + 0); for (let i = 0; i < 5; i++) K.box('metal', 0, 0.2 + i * (py - 0.2) / 5, pz - 0.46, 0.56, 0.03, 0.03, 0xc8ccd0); K.box('plain', 0, py + 0.4, pz, 0.8, 0.04, 0.8, vm); };
  B.swing = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('swing'), mt = K.color('metal', 0x3a6ab0), L = Math.hypot(h, d / 2), an = Math.atan2(d / 2, h);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('metal', sx * w / 2, h / 2 - L / 2 + 0.0, sz * d / 4, 0.07, L, 0.07, mt, 0, -sz * an, 0);
    K.box('metal', 0, h - 0.04, 0, w + 0.1, 0.1, 0.1, shade(mt, 0.85)); const cs = [K.accent(0xc8403a), 0x2a2a2a];
    for (let i = 0; i < 2; i++) { const x = (i - 0.5) * w * 0.45, sy = 0.5, sw = 0.46; for (const s of [-1, 1]) K.box('metal', x + s * (sw / 2 - 0.02), sy, 0, 0.012, h - 0.05 - sy, 0.012, 0xa0a4a8); K.box('plain', x, sy - 0.04, 0, sw, 0.045, 0.17, cs[i]); } };
  B.bbq_simple = (M, a) => { const K = kit(M, a), { w, d } = K.dim('bbq_simple'), br = K.color('exterior_floor', 0xb25a40), hb = 0.78;
    K.box('plain', 0, 0, 0, w, 0.45, d, br); for (const [x, z, ww, dd] of [[0, -d / 2 + 0.06, w, 0.12], [0, d / 2 - 0.06, w, 0.12], [-w / 2 + 0.06, 0, 0.12, d - 0.2], [w / 2 - 0.06, 0, 0.12, d - 0.2]]) K.box('plain', x, 0.45, z, ww, hb - 0.45, dd, br);
    K.box('plain', 0, 0.45, 0, w - 0.22, 0.04, d - 0.22, 0x2a2624); for (let i = 0; i < 10; i++) K.box('plain', (K.rnd() - 0.5) * (w - 0.3), 0.49, (K.rnd() - 0.5) * (d - 0.3), 0.08, 0.02, 0.07, i % 3 ? 0xc84a1a : 0x3a2a24, K.rnd() * 3);
    for (let i = 0; i < 7; i++) K.box('metal', -w / 2 + 0.16 + i * (w - 0.32) / 6, hb + 0.01, 0, 0.012, 0.012, d - 0.1, 0x5a5a5e); K.box('metal', 0, hb + 0.01, -d / 2 + 0.2, w - 0.1, 0.012, 0.02, 0x5a5a5e);
    for (let i = 0; i < 3; i++) { const z = (i - 1) * 0.15; K.cyl('metal', 0, hb + 0.05, z, 0.006, w + 0.12, 0xb0b4b8, 0, Math.PI / 2); for (let j = 0; j < 3; j++) K.cyl('plain', -w * 0.25 + j * w * 0.22, hb + 0.05, z, 0.035, 0.07, [0x8a3a2a, 0xa8483a, 0xd8b090][j], 0, Math.PI / 2); }
    for (let i = 0; i < 4; i++) K.cyl('wood', w / 2 + 0.2, 0.05 + (i > 2 ? 0.1 : 0), -0.1 + (i % 3) * 0.1, 0.04, 0.3, 0x8a6a44, 0, Math.PI / 2); };
  B.garage_car = (M, a) => { const K = kit(M, a), { w, d } = K.dim('garage_car'), c = K.main(pick(K, [0xa8aaac, 0xe8e8e6, 0x2a3a5a, 0xa83a34, 0x222426])), zf = d / 2;
    K.box('plain', 0, 0.26, 0, w, 0.5, d, c); K.box('plain', 0, 0.5, zf - 0.7, w - 0.04, 0.1, 1.4, shade(c, 1.04), 0, 0.04); K.box('plain', 0, 0.76, -zf + 0.3, w - 0.04, 0.1, 0.6, c);
    const cz = -0.35; for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('plain', sx * (w / 2 - 0.1), 0.76, cz + sz * 0.8, 0.07, 0.5, 0.07, shade(c, 0.9)); K.box('plain', 0, 1.26, cz, w - 0.1, 0.05, 1.75, shade(c, 1.04));
    K.box('glass', 0, 0.76, cz, w - 0.06, 0.5, 1.6, 0xffffff); K.box('glass', 0, 0.76, cz + 0.8, w - 0.12, 0.5, 0.04, 0xffffff, 0, 0.5); for (const s of [-1, 1]) { K.box('plain', s * 0.4, 0.55, cz + 0.4, 0.4, 0.3, 0.4, 0x2a2a2e); K.box('plain', s * 0.4, 0.55, cz - 0.45, 0.4, 0.3, 0.4, 0x2a2a2e); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { K.cyl('plain', sx * (w / 2 - 0.1), 0.3, sz * 1.3, 0.3, 0.2, 0x1a1a1a, 0, Math.PI / 2); K.cyl('metal', sx * (w / 2 - 0.0), 0.3, sz * 1.3, 0.17, 0.02, 0xb8bcc0, 0, Math.PI / 2); }
    for (const s of [-1, 1]) { K.box('plain', s * 0.62, 0.5, zf - 0.02, 0.32, 0.12, 0.05, 0xf4f0d8); K.box('plain', s * 0.62, 0.52, -zf + 0.02, 0.3, 0.1, 0.05, 0xb02a24); K.box('plain', s * (w / 2 + 0.03), 0.9, cz + 0.55, 0.1, 0.1, 0.14, shade(c, 0.9)); }
    K.box('plain', 0, 0.2, zf - 0.01, w, 0.16, 0.06, 0x2a2a2a); K.box('plain', 0, 0.2, -zf + 0.01, w, 0.16, 0.06, 0x2a2a2a); K.box('plain', 0, 0.32, zf + 0.02, 0.5, 0.16, 0.02, 0x1c1c1c); K.box('plain', 0, 0.28, -zf - 0.015, 0.4, 0.12, 0.01, 0xf0e8c0); };
  B.gourmet_counter = (M, a) => { const K = kit(M, a), { w, d } = K.dim('gourmet_counter'), br = K.color('exterior_floor', 0xa8553c), zc = -d / 2 + 0.35, xa = -w / 2 + 0.8, xb = xa + 0.8 + 0.72, xc = xb + 0.72 + 0.65, wood = K.wood(0x8a5a38), gr = 0x4a4844, cab = K.color('wall_kitchen', 0xe8e4dc);
    K.box('plain', xa, 0, zc, 1.6, 0.85, 0.7, br); for (let i = 1; i < 4; i++) K.box('plain', xa, i * 0.2, zc + 0.351, 1.6, 0.012, 0.004, shade(br, 0.7)); K.box('plain', xa, 0.12, zc + 0.352, 0.7, 0.4, 0.004, 0x1a1612);
    for (const [x, z, ww, dd] of [[xa, zc - 0.25, 1.6, 0.2], [xa, zc + 0.3, 1.6, 0.1], [xa - 0.75, zc, 0.1, 0.7], [xa + 0.75, zc, 0.1, 0.7]]) K.box('plain', x, 0.85, z, ww, 0.12, dd, br);
    K.box('plain', xa, 0.85, zc + 0.02, 1.4, 0.025, 0.4, 0x2a2624); for (let i = 0; i < 8; i++) K.box('metal', xa - 0.62 + i * 0.18, 0.97, zc + 0.02, 0.012, 0.012, 0.4, 0x5a5a5e); for (let i = 0; i < 6; i++) K.box('plain', xa + (K.rnd() - 0.5) * 1.2, 0.88, zc + (K.rnd() - 0.5) * 0.3, 0.1, 0.02, 0.08, i % 2 ? 0xc84a1a : 0x3a2a24, K.rnd() * 3);
    K.box('plain', xa, 1.5, zc - 0.07, 1.5, 0.4, 0.56, br); K.box('plain', xa, 1.5, zc + 0.215, 1.5, 0.4, 0.01, 0x1a1612); K.box('plain', xa, 1.9, zc - 0.12, 0.62, 1.0, 0.46, br); K.box('plain', xa, 2.9, zc - 0.12, 0.76, 0.08, 0.6, shade(br, 0.8)); K.box('plain', xa, 2.98, zc - 0.12, 0.5, 0.06, 0.4, shade(br, 0.75));
    K.box('plain', xb, 0, zc, 1.44, 0.85, 0.7, cab); for (let i = 0; i < 3; i++) K.box('wood', xb - 0.48 + i * 0.48, 0.08, zc + 0.355, 0.44, 0.7, 0.012, wood); K.box('plain', (xb + xc) / 2, 0.85, zc, 0.72 * 2 + 0.65 + 0.04, 0.04, 0.74, gr);
    K.box('metal', xb, 0.89, zc, 0.5, 0.01, 0.38, 0xb0b4b8); K.box('metal', xb, 0.895, zc, 0.44, 0.006, 0.32, 0x70767a); K.cyl('metal', xb, 0.89, zc - 0.28, 0.014, 0.3, 0xb8bcc0); K.box('metal', xb, 1.17, zc - 0.2, 0.02, 0.02, 0.11, 0xb8bcc0);
    K.box('plain', xc, 0, zc, 1.3, 0.85, 0.7, cab); for (let i = 0; i < 2; i++) K.box('wood', xc - 0.32 + i * 0.64, 0.08, zc + 0.355, 0.6, 0.7, 0.012, wood);
    K.cyl('plain', xc, 0.89, zc, 0.1, 0.05, 0xf0f0ea); K.cyl('plain', xc + 0.4, 0.89, zc, 0.04, 0.26, 0x2a6a3a);
    const tz = 0.55, tl = Math.min(2.6, w * 0.65); K.box('wood', 0, 0.74, tz, tl, 0.05, 0.85, wood); for (const s of [-1, 1]) { K.box('wood', s * (tl / 2 - 0.2), 0, tz, 0.08, 0.74, 0.7, shade(wood, 0.8)); K.box('wood', s * (tl / 2 - 0.2), 0.3, tz - 0.001, 0.0 + 0.6, 0.04, 0.05, shade(wood, 0.75)); }
    for (const s of [-1, 1]) { K.box('wood', 0, 0.42, tz + s * 0.72, tl - 0.2, 0.04, 0.3, shade(wood, 1.1)); for (const sx of [-1, 1]) K.box('wood', sx * (tl / 2 - 0.4), 0, tz + s * 0.72, 0.06, 0.42, 0.26, shade(wood, 0.8)); }
    K.cyl('plain', 0.3, 0.79, tz, 0.15, 0.08, 0xd8d0c0); K.cyl('plain', -0.5, 0.79, tz + 0.1, 0.035, 0.26, 0x2a6a3a); for (let i = 0; i < 3; i++) K.cyl('plain', -0.9 + i * 0.2, 0.79, tz - 0.2, 0.035, 0.1, 0xe8e4d8); };
  B.sauna = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('sauna'), t = 0.08, wood = K.wood(0xc08a54), shade1 = shade(wood, 0.88), dw = 0.7, dx = w / 2 - 0.55;
    K.box('wood', 0, 0, 0, w, 0.05, d, shade(wood, 0.75)); K.box('wood', 0, 0.05, -d / 2 + t / 2, w, h - 0.11, t, wood); for (const s of [-1, 1]) K.box('wood', s * (w / 2 - t / 2), 0.05, 0, t, h - 0.11, d - 2 * t * 0 , wood);
    K.box('wood', 0, h - 0.06, 0, w + 0.12, 0.06, d + 0.12, shade(wood, 0.75));
    const lx0 = -w / 2, lx1 = dx - dw / 2; K.box('wood', (lx0 + lx1) / 2, 0.05, d / 2 - t / 2, lx1 - lx0, h - 0.11, t, wood); K.box('wood', (dx + dw / 2 + w / 2) / 2, 0.05, d / 2 - t / 2, w / 2 - (dx + dw / 2), h - 0.11, t, wood); K.box('wood', dx, 1.85, d / 2 - t / 2, dw, h - 0.11 - 1.8, t, wood);
    for (let i = 0; i < 12; i++) { const x = lx0 + 0.1 + i * (lx1 - lx0) / 12; K.box('wood', x, 0.05, d / 2 + 0.003, 0.012, h - 0.11, 0.005, shade(wood, 0.6)); }
    K.box('wood', dx - dw / 2 - 0.025, 0.05, d / 2 - 0.02, 0.05, 1.82, 0.06, shade1); K.box('wood', dx + dw / 2 + 0.025, 0.05, d / 2 - 0.02, 0.05, 1.82, 0.06, shade1); K.box('glass', dx, 0.06, d / 2 - 0.02, dw, 1.75, 0.02, 0xffffff); K.box('metal', dx - dw / 2 + 0.08, 0.7, d / 2 + 0.03, 0.02, 0.5, 0.03, 0xc8ccd0);
    K.box('wood', 0, 0.85, -d / 2 + t + 0.25, w - 2 * t, 0.05, 0.5, shade(wood, 1.1)); K.box('wood', 0, 0.45, -d / 2 + t + 0.65, w - 2 * t, 0.05, 0.4, shade(wood, 1.1)); K.box('wood', 0, 0.05, -d / 2 + t + 0.1, w - 2 * t, 0.8, 0.04, shade(wood, 0.8));
    K.cyl('metal', -w / 2 + 0.3, 0.05, d / 2 - 0.4, 0.14, 0.55, 0x2a2a2e); for (let i = 0; i < 5; i++) K.cyl('plain', -w / 2 + 0.3 + Math.cos(i * 1.3) * 0.06, 0.6, d / 2 - 0.4 + Math.sin(i * 1.3) * 0.06, 0.04, 0.07, 0x6a6a6a, 0, 0, 'sphere');
    K.box('plain', 0, h - 0.2, -d / 2 + t + 0.02, 0.4, 0.06, 0.04, 0xfff0c8); K.box('emissive', 0, h - 0.19, -d / 2 + t + 0.045, 0.34, 0.01, 0.006, 0xffe0a0); };
  B.soaking_tub = (M, a) => { const K = kit(M, a), { w } = K.dim('soaking_tub'), r = Math.min(0.62, w * 0.48), wood = K.wood(0xa8784a);
    K.cyl('wood', 0, 0, 0, r, 0.78, wood, 0, 0, 'cyl'); K.cyl('wood', 0, 0.76, 0, r + 0.025, 0.04, shade(wood, 1.15)); for (const y of [0.15, 0.5]) K.cyl('metal', 0, y, 0, r + 0.012, 0.03, 0x2a2a2e);
    K.cyl('water', 0, 0.74, 0, r - 0.04, 0.01, 0x9ad4e8); for (let i = 0; i < 8; i++) K.box('wood', Math.cos(i * 0.785) * (r + 0.001), 0.02, Math.sin(i * 0.785) * (r + 0.001), 0.012, 0.74, 0.12, shade(wood, 0.7), -i * 0.785 + 0);
    K.box('wood', 0, 0, r + 0.4, 0.5, 0.3, 0.34, shade(wood, 0.9)); K.cyl('wood', 0.2, 0.3, r + 0.4, 0.1, 0.14, shade(wood, 1.1)); K.box('wood', -0.1, 0.34, r + 0.4, 0.3, 0.02, 0.025, shade(wood, 1.1), 0.5); K.box('fabric', -0.1, 0.3, r + 0.42, 0.26, 0.03, 0.2, K.accent(0xf0ece0)); };
  return B
}
