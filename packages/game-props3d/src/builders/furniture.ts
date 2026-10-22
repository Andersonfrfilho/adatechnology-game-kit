import type { BuilderContext, BuilderMap } from '../types'
import { shade } from '../colors'
import { drawTv, pick } from './shared'

export function furnitureBuilders({ kit, atlas }: BuilderContext): Partial<BuilderMap> {
  const B: Partial<BuilderMap> = {}
  B.breakfast_bar = (M, a) => { const K = kit(M, a), { w, d } = K.dim('breakfast_bar'), zb = -d / 2, cd = 0.65, body = K.color('wall_kitchen', 0xf0eee8), wood = K.wood(0xa07a50), paving = 0xf4f4f0;
    K.box('plain', 0, 0, zb + cd / 2 - 0.03, w - 0.06, 0.08, cd - 0.08, 0x2a2a2a); K.box('plain', 0, 0.08, zb + cd / 2, w, 0.8, cd, body);
    for (let i = 0; i < 4; i++) { K.box('wood', -w / 2 + (i + 0.5) * w / 4, 0.12, zb - 0.004, w / 4 - 0.025, 0.72, 0.012, wood); K.box('metal', -w / 2 + (i + 0.5) * w / 4 + (i % 2 ? -0.12 : 0.12), 0.75, zb - 0.012, 0.012, 0.14, 0.016, 0x9a9a9a); }
    K.box('plain', 0, 0.88, zb + (cd + 0.32) / 2, w + 0.04, 0.04, cd + 0.32, paving);
    for (const s of [-1, 1]) K.box('metal', s * (w / 2 - 0.05), 0, zb + cd + 0.24, 0.05, 0.88, 0.05, 0x2a2a2a);
    K.box('metal', -w * 0.22, 0.915, zb + cd / 2, 0.52, 0.006, 0.38, 0xb0b4b8); K.box('metal', -w * 0.22, 0.92, zb + cd / 2, 0.46, 0.004, 0.32, 0x70767a); K.cyl('metal', -w * 0.22, 0.92, zb + 0.1, 0.014, 0.26, 0xb8bcc0); K.box('metal', -w * 0.22, 1.16, zb + 0.15, 0.02, 0.02, 0.1, 0xb8bcc0);
    K.cyl('plain', w * 0.25, 0.92, zb + cd / 2 + 0.2, 0.13, 0.05, 0xf0f0ea); for (let i = 0; i < 3; i++) K.cyl('plain', w * 0.25 + (i - 1) * 0.07, 0.97, zb + cd / 2 + 0.2 + (i % 2) * 0.03, 0.045, 0.09, [0xe8801c, 0xc83030, 0xd8c040][i], 0, 0, 'sphere');
    const stool = K.accent(0x8a5a38); for (let i = 0; i < 3; i++) { const x = (i - 1) * w * 0.3, z = zb + cd + 0.5;
      K.cyl('plain', x, 0.62, z, 0.17, 0.05, stool); K.cyl('metal', x, 0.04, z, 0.02, 0.58, 0x2a2a2a); K.cyl('metal', x, 0, z, 0.17, 0.02, 0x2a2a2a); K.cyl('metal', x, 0.25, z, 0.14, 0.012, 0x2a2a2a); } };
  B.sofa_l = (M, a) => { const K = kit(M, a), { w, d } = K.dim('sofa_l'), c = K.fabric(pick(K, [0x6e7078, 0x8a7a68, 0x45586a])), cd = shade(c, 0.82), zb = -d / 2, pf = 0.95, ac = K.accent(0xc89a4a), cw = 0.95;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('wood', sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), 0.05, 0.08, 0.05, K.wood(0x2a1d14));
    K.box('fabric', -(cw / 2), 0.08, zb + pf / 2, w - cw, 0.26, pf, cd); K.box('fabric', w / 2 - cw / 2, 0.08, 0, cw, 0.26, d, cd);
    K.box('fabric', 0, 0.08, zb + 0.11, w, 0.72, 0.22, cd); K.box('fabric', -w / 2 + 0.09, 0.08, zb + pf / 2, 0.18, 0.55, pf, cd);
    const nm = 2, mw = (w - cw - 0.18) / nm; for (let i = 0; i < nm; i++) K.box('fabric', -w / 2 + 0.18 + (i + 0.5) * mw, 0.34, zb + 0.12 + 0.39, mw - 0.02, 0.16, 0.78, c);
    K.box('fabric', w / 2 - cw / 2, 0.34, 0.035, cw - 0.04, 0.16, d - 0.2, c);
    for (let i = 0; i < 4; i++) K.box('fabric', -w / 2 + 0.18 + (i + 0.5) * (w - 0.2) / 4, 0.42, zb + 0.28, (w - 0.2) / 4 - 0.03, 0.4, 0.14, c, 0, 0.15);
    K.box('fabric', -w * 0.3, 0.5, zb + 0.5, 0.4, 0.38, 0.12, ac, 0.3, 0.3); K.box('fabric', w * 0.32, 0.5, zb + 0.5, 0.38, 0.36, 0.12, shade(ac, 0.8), -0.3, 0.3); };
  B.double_bed_modern = (M, a) => { const K = kit(M, a), { w, d } = K.dim('double_bed_modern'), wood = K.wood(0x6a4c34), edr = K.fabric(0x8a8d92), accent = K.accent(0xc89a4a);
    K.box('wood', 0, 0.05, 0.02, w + 0.06, 0.2, d + 0.02, shade(wood, 0.85)); K.box('fabric', 0, 0.25, 0.05, w - 0.04, 0.24, d - 0.1, 0xf2f0ea);
    K.box('fabric', 0, 0.47, 0.35, w, 0.06, d * 0.64, edr); K.box('fabric', 0, 0.5, -0.05, w * 0.98, 0.05, 0.3, shade(edr, 1.12)); K.box('fabric', 0, 0.52, d / 2 - 0.4, w * 0.9, 0.03, 0.3, accent);
    for (const s of [-1, 1]) K.box('fabric', s * w * 0.24, 0.49, -d / 2 + 0.3, w * 0.4, 0.13, 0.36, 0xf4f2ec, s * 0.06);
    K.box('fabric', 0, 0.55, -d / 2 + 0.5, 0.4, 0.16, 0.12, accent, 0, 0.5);
    const hw = w + 0.5, n = Math.round(hw / 0.11); K.box('wood', 0, 0.2, -d / 2 - 0.05, hw, 1.0, 0.04, shade(wood, 0.7)); for (let i = 0; i < n; i++) K.box('wood', -hw / 2 + (i + 0.5) * hw / n, 0.25, -d / 2 - 0.02, hw / n - 0.025, 0.95, 0.04, i % 2 ? wood : shade(wood, 1.12));
    for (const s of [-1, 1]) { K.box('wood', s * (w / 2 + 0.3), 0.35, -d / 2 + 0.22, 0.4, 0.16, 0.36, shade(wood, 1.05)); K.cyl('plain', s * (w / 2 + 0.3), 0.51, -d / 2 + 0.2, 0.06, 0.03, 0xe8e4dc); K.cyl('plain', s * (w / 2 + 0.3), 0.54, -d / 2 + 0.2, 0.012, 0.18, 0xe8e4dc); K.cyl('plain', s * (w / 2 + 0.3), 0.72, -d / 2 + 0.2, 0.09, 0.12, 0xf0e6c8); } };
  B.home_office = (M, a) => { const K = kit(M, a), { w, d } = K.dim('home_office'), wood = K.wood(0xd2b48c), zb = -d / 2;
    K.box('wood', 0, 0.72, 0, w, 0.035, d, wood); for (const s of [-1, 1]) K.box('metal', s * (w / 2 - 0.04), 0, 0, 0.035, 0.72, d - 0.1, 0x222226); K.box('metal', 0, 0.3, zb + 0.05, w - 0.1, 0.03, 0.02, 0x222226);
    K.box('plain', w / 2 - 0.25, 0.28, 0, 0.4, 0.44, d - 0.08, 0xe8e4dc); for (let i = 0; i < 2; i++) { K.box('plain', w / 2 - 0.25, 0.3 + i * 0.2, d / 2 - 0.04, 0.37, 0.18, 0.01, 0xf2eee6); K.box('metal', w / 2 - 0.25, 0.39 + i * 0.2, d / 2 - 0.03, 0.12, 0.012, 0.012, 0x9a9a9a); }
    K.box('metal', 0, 0.755, zb + 0.2, 0.22, 0.012, 0.16, 0x1a1a1a); K.box('metal', 0, 0.76, zb + 0.14, 0.04, 0.2, 0.025, 0x1a1a1a); K.box('plain', 0, 0.88, zb + 0.15, 0.62, 0.36, 0.035, 0x101112); K.box('metal', 0, 0.895, zb + 0.1685, 0.6, 0.33, 0.004, 0x0a0c10);
    K.box('plain', 0, 0.755, zb + 0.43, 0.42, 0.014, 0.14, 0x1a1a1c); K.box('plain', 0.34, 0.755, zb + 0.43, 0.06, 0.025, 0.1, 0x1a1a1c, 0.2);
    K.cyl('metal', -w * 0.4, 0.755, zb + 0.2, 0.07, 0.015, 0x2a2a2a); K.box('metal', -w * 0.4, 0.77, zb + 0.2, 0.012, 0.3, 0.012, 0x2a2a2a, 0, 0.3); K.cyl('plain', -w * 0.4, 1.02, zb + 0.28, 0.06, 0.05, K.main(0xd8d4c8), 0.7, 0);
    K.box('fabric', -0.5, 0.755, 0.05, 0.2, 0.02, 0.28, K.accent(0x2e5e7e), 0.2); K.cyl('plain', -0.3, 0.755, 0.12, 0.04, 0.09, 0xd8d0c0);
    const zc = d / 2 + 0.3, cc = K.fabric(0x2a2a2e); K.box('plain', 0, 0.44, zc, 0.48, 0.07, 0.46, cc); K.box('plain', 0, 0.52, zc + 0.22, 0.44, 0.52, 0.07, cc, 0, 0.12); K.cyl('metal', 0, 0.06, zc, 0.025, 0.38, 0x2a2a2a);
    for (let i = 0; i < 5; i++) { const an = i * 1.2566, x = Math.cos(an) * 0.17, z = zc + Math.sin(an) * 0.17; K.box('metal', Math.cos(an) * 0.085, 0.06, zc + Math.sin(an) * 0.085, 0.18, 0.025, 0.03, 0x2a2a2a, -an); K.cyl('plain', x, 0, z, 0.03, 0.05, 0x1a1a1a); } };
  B.closet = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('closet'), wood = K.color('wall_bedroom', 0xe6e0d4), mw = K.wood(0xb89468), dv = -w * 0.1;
    K.box('plain', 0, 0, -d / 2 + 0.01, w, h, 0.02, shade(wood, 0.95)); for (const s of [-1, 1]) K.box('plain', s * (w / 2 - 0.015), 0, 0, 0.03, h, d, wood); K.box('plain', 0, h - 0.03, 0, w, 0.03, d, wood); K.box('plain', 0, 0.06, 0, w - 0.06, 0.02, d - 0.02, wood); K.box('plain', 0, 0, 0.0, w - 0.04, 0.06, d - 0.06, 0x2a2a2a); K.box('plain', dv, 0.06, 0, 0.025, h - 0.09, d - 0.02, wood);
    const rod = h * 0.76; K.cyl('metal', (-w / 2 + dv) / 2, rod, 0, 0.012, dv + w / 2 - 0.06, 0xb0b4b8, 0, Math.PI / 2); K.box('plain', (-w / 2 + dv) / 2, rod + 0.05, 0, dv + w / 2 - 0.05, 0.02, d - 0.04, wood);
    const nc = 9, L0 = -w / 2 + 0.06, L1 = dv - 0.05, cs = [0x2a2a30, 0xc8c0a8, 0x4a6a8a, 0xa8483a, 0xe0dcd0, 0x6a8a5a, 0x3a3a3a, 0x8a7a68, 0xd8b8a0];
    for (let i = 0; i < nc; i++) { const gh = 0.6 + K.rnd() * 0.5; K.box('fabric', L0 + (i + 0.5) * (L1 - L0) / nc, rod - gh - 0.02, 0, 0.045, gh, 0.4, i % 3 === 0 ? K.accent(cs[i]) : cs[i]); K.box('metal', L0 + (i + 0.5) * (L1 - L0) / nc, rod - 0.04, 0, 0.004, 0.04, 0.2, 0xb0b4b8); }
    const sx = (dv + w / 2) / 2 + dv / 2 + 0.0, rx0 = dv + 0.015, rw = w / 2 - 0.015 - rx0, rc = rx0 + rw / 2;
    for (let i = 0; i < 5; i++) { const y = 0.5 + i * 0.35; K.box('plain', rc, y, 0, rw, 0.022, d - 0.02, wood); if (i < 4) for (let j = 0; j < 3; j++) { const sh = 0.04 + K.rnd() * 0.12; K.box('fabric', rc - rw * 0.3 + j * rw * 0.3, y + 0.022, 0.0, 0.26, sh, 0.32, cs[(i * 3 + j) % cs.length]); } }
    for (let i = 0; i < 2; i++) { K.box('wood', rc, 0.08 + i * 0.2, d / 2 - 0.01, rw - 0.03, 0.18, 0.02, mw); K.box('metal', rc, 0.2 + i * 0.2, d / 2 + 0.005, 0.2, 0.012, 0.014, 0xb0b4b8); } void sx; };
  B.vanity = (M, a) => { const K = kit(M, a), { w, d } = K.dim('vanity'), zb = -d / 2, br = 0xf4f4f0;
    K.cyl('plain', 0, 0, zb + 0.12, 0.08, 0.7, br); K.cyl('plain', 0, 0, zb + 0.12, 0.1, 0.03, br); K.box('plain', 0, 0.74, 0, w, 0.12, d, br); K.box('plain', 0, 0.865, 0.02, w - 0.1, 0.012, d - 0.1, 0xd4d8da); K.cyl('metal', 0, 0.87, 0.05, 0.02, 0.01, 0x70767a);
    K.cyl('metal', 0, 0.87, zb + 0.05, 0.014, 0.1, 0xb8bcc0); K.box('metal', 0, 0.96, zb + 0.09, 0.02, 0.014, 0.09, 0xb8bcc0); K.box('metal', w * 0.3, 0.87, zb + 0.06, 0.04, 0.06, 0.04, 0x2a7a8a);
    K.box('plain', 0, 1.1, zb + 0.012, 0.52, 0.72, 0.024, K.color('metal', 0xe4e0d8)); K.plane('atlas_picture', 0, 1.46, zb + 0.026, 0.46, 0.66, 0xffffff, 0, 0, 0, atlas('picture').mirror());
    K.box('metal', -w / 2 - 0.02, 0.95, zb + 0.06, 0.03, 0.03, 0.03, 0xb0b4b8); K.box('metal', -w / 2 - 0.02, 0.95, zb + 0.06, 0.28, 0.014, 0.014, 0xb0b4b8); K.box('fabric', -w / 2 - 0.02, 0.62, zb + 0.065, 0.26, 0.34, 0.02, K.accent(0x2e6e7e)); };
  B.tv_stand = (M, a) => { const K = kit(M, a), { w, d } = K.dim('tv_stand'), wood = K.wood(0xc8a070), br = K.color('fabric_main', 0xf0ede6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('metal', sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.06), 0.035, 0.16, 0.035, 0x1a1a1a);
    K.box('wood', 0, 0.16, 0, w, 0.32, d, wood); K.box('plain', 0, 0.48, 0, w + 0.02, 0.025, d + 0.02, br);
    for (let i = 0; i < 2; i++) K.box('plain', -w / 2 + (i + 0.5) * 0.375 * w, 0.18, d / 2 + 0.004, 0.375 * w - 0.02, 0.28, 0.01, shade(br, 0.97)); // two doors on the left
    K.box('plain', w / 4 + w / 8, 0.19, 0, w / 4 - 0.04, 0.2, d - 0.04, 0x1c1c20); K.box('plain', w / 4 + w / 8, 0.22, 0.05, 0.28, 0.06, 0.2, 0x2a2a30); K.box('fabric', w / 4 + w / 8 + 0.03, 0.29, 0.0, 0.2, 0.05, 0.14, K.accent(0x8a4a3a)); // open niche: console and books
    const th = drawTv(K, 0, 0.5, 0, Math.min(1.3, w * 0.78), true); K.box('plain', 0, 0.5, d / 2 - 0.06, Math.min(1.0, w * 0.55), 0.06, 0.06, 0x16161a); void th; };
  return B
}
