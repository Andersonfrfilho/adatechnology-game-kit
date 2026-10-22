import { seedOf, shade } from '../colors'
import type { BuilderContext, BuilderMap, Material, PropItem, PropsApi } from '../types'

export function houseStateBuilders({ kit }: BuilderContext): Partial<BuilderMap> {
  const B: Partial<BuilderMap> = {}
  B.window_boards = (M, a) => { const K = kit(M, a), { w, h, d } = K.dim('window_boards'), y = M.y || 1.0, x = M.variant ? M.variant === 'x' : (seedOf(M) & 1) === 0, cs = [0x7a5634, 0x6b4a2a, 0x8a6a44, 0x5e4228], z = d / 2;
    if (x) { const L = Math.hypot(w, h) + 0.15, an = Math.atan2(h, w); for (const s of [-1, 1]) K.box('wood', 0, y + h / 2 - 0.075, z + (s > 0 ? 0 : 0.03), L, 0.15, 0.03, cs[s > 0 ? 0 : 1], 0, 0, s * an + (K.rnd() - 0.5) * 0.05); K.box('wood', 0, y + h * 0.3, z + 0.06, w + 0.3, 0.15, 0.03, cs[2], 0, 0, (K.rnd() - 0.5) * 0.06); for (const [nx, ny] of [[-w / 2, y], [w / 2, y], [-w / 2, y + h], [w / 2, y + h], [0, y + h / 2]]) K.cyl('metal', nx, ny, z + 0.09, 0.012, 0.02, 0x5a5a5e, Math.PI / 2, 0); }
    else { const n = Math.ceil(h / 0.17); for (let i = 0; i < n; i++) { const yy = y + i * (h - 0.15) / (n - 1 || 1), ww = w + 0.2 + K.rnd() * 0.15; K.box('wood', (K.rnd() - 0.5) * 0.1, yy, z + (i % 2) * 0.03, ww, 0.15, 0.03, cs[i % 4], 0, 0, (K.rnd() - 0.5) * 0.05); for (const s of [-1, 1]) K.cyl('metal', s * (w / 2 + 0.02), yy + 0.075, z + (i % 2) * 0.03 + 0.016, 0.01, 0.015, 0x5a5a5e, Math.PI / 2, 0); } } };
  B.barricade = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('barricade'), wood = K.wood(0x6a4a34), z0 = -d / 2;
    K.box('wood', -w * 0.22, 0, z0 + 0.3, w * 0.5, h * 0.8, 0.45, wood, 0.06, -0.12); K.box('plain', -w * 0.22, h * 0.3, z0 + 0.54, 0.3, 0.012, 0.01, 0x9a9a9a);
    K.box('fabric', w * 0.2, 0, z0 + 0.4, w * 0.5, h * 0.95, 0.18, K.fabric(0xc8c0b0), -0.08, -0.28); K.box('fabric', w * 0.2, 0, z0 + 0.4, w * 0.5 - 0.1, h * 0.9, 0.19, K.accent(0x5a7a9a), -0.08, -0.28);
    K.box('plain', w * 0.38, 0, z0 + 0.35, 0.5, 0.4, 0.4, 0xb89a6a, 0.2); K.box('plain', w * 0.4, 0.4, z0 + 0.33, 0.45, 0.35, 0.38, 0xa8885a, -0.3);
    for (let i = 0; i < 4; i++) { K.box('wood', 0, 0.45 + i * 0.3, z0 + 0.62, w + 0.3, 0.14, 0.04, [0x7a5634, 0x8a6a44, 0x6b4a2a, 0x7a5a38][i], 0, 0, (i % 2 ? 1 : -1) * (0.06 + K.rnd() * 0.08)); for (const s of [-1, 1]) K.cyl('metal', s * w * 0.4, 0.45 + i * 0.3, z0 + 0.65, 0.012, 0.02, 0x5a5a5e, Math.PI / 2, 0); }
    K.box('wood', -w * 0.4, 0.0, z0 + 0.9, 0.4, 0.04, 0.4, wood, 0.3, 0, 0.4); K.box('wood', -w * 0.45, 0.0, z0 + 0.7, 0.04, 0.5, 0.04, wood, 0, 0.9, 0.2); };
  B.sandbags = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('sandbags'), cs = [K.fabric(0xb8a678), 0xa89868, 0xc4b284], bw = 0.46, bh = 0.17, nl = Math.max(1, Math.min(4, Math.round(h / bh)));
    for (let l = 0; l < nl; l++) { const nb = Math.max(1, Math.floor((w - l * 0.18) / bw)); for (let i = 0; i < nb; i++) { const x = -nb * bw / 2 + (i + 0.5) * bw + (l % 2) * 0.12; K.box('fabric', x, l * bh * 0.95, (K.rnd() - 0.5) * 0.04, bw * 0.97, bh, Math.min(d, 0.3), cs[(i + l) % 3], (K.rnd() - 0.5) * 0.08, 0, (K.rnd() - 0.5) * 0.04); K.box('fabric', x + bw * 0.46, l * bh * 0.95 + 0.04, 0, 0.03, 0.09, 0.2, shade(cs[(i + l) % 3], 0.8)); } } };
  B.barbed_wire = (M, a) => { const K = kit(M, a), { w } = K.dim('barbed_wire'), np = Math.max(2, Math.round(w / 2) + 1), wire = 0x8a8c90;
    for (let i = 0; i < np; i++) { const x = -w / 2 + i * w / (np - 1); K.box('wood', x, 0, 0, 0.07, 0.6, 0.07, 0x5a4a3a); }
    for (const y of [0.25, 0.4, 0.55]) { K.box('metal', 0, y, 0.04, w, 0.008, 0.008, wire); const nb = Math.floor(w / 0.16); for (let i = 0; i < nb; i++) { const x = -w / 2 + (i + 0.5) * w / nb; K.box('metal', x, y - 0.012, 0.04, 0.05, 0.006, 0.006, wire, 0, 0, 0.8); K.box('metal', x, y - 0.012, 0.04, 0.05, 0.006, 0.006, wire, 0, 0, -0.8); } } };
  B.razor_wire = (M, a) => { const K = kit(M, a), { w } = K.dim('razor_wire'), r = 0.28, wire = 0x9a9ca0, nr = Math.max(3, Math.round(w / 0.22)), ns = 8, sl = 2 * Math.PI * r / ns * 1.05, y0 = M.y || 0;
    for (let i = 0; i < nr; i++) { const x = -w / 2 + (i + 0.5) * w / nr, lean = (i % 2 ? 0.1 : -0.1); for (let s = 0; s < ns; s++) { const th = (s + 0.5) / ns * Math.PI * 2; K.box('metal', x + Math.sin(th) * lean * 0.3, y0 + r + Math.sin(th) * r - 0.006, Math.cos(th) * r, 0.01, 0.012, sl, wire, 0, -(th + Math.PI / 2), lean); } }
    for (const s of [-1, 1]) K.box('metal', s * w / 2, y0, 0, 0.03, 0.12, 0.03, 0x5a5a5e); };
  B.water_bottle_crates = (M, a) => { const K = kit(M, a), { w, d } = K.dim('water_bottle_crates'), pw = 0.4, pd = 0.28, ph = 0.27, nx = Math.max(1, Math.floor(w / pw)), nz = Math.max(1, Math.floor(d / pd)), nl = 2;
    K.box('wood', 0, 0, 0, nx * pw, 0.05, nz * pd, 0x8a6a44);
    for (let l = 0; l < nl; l++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = -nx * pw / 2 + (i + 0.5) * pw, z = -nz * pd / 2 + (j + 0.5) * pd, y = 0.05 + l * ph; K.box('plain', x, y, z, pw - 0.01, ph, pd - 0.01, 0xdceaf4); K.box('plain', x, y + 0.08, z, pw - 0.005, 0.08, pd - 0.005, K.accent(0x2a6aa8)); if (l === nl - 1) for (let u = 0; u < 3; u++) for (let v = 0; v < 2; v++) K.cyl('plain', x - 0.11 + u * 0.11, y + ph, z - 0.06 + v * 0.12, 0.028, 0.02, 0x2a6aa8); } };
  B.canned_food = (M, a) => { const K = kit(M, a), y = M.y || 0, cs = [0xc8a030, 0xb03a2a, 0x4a7a3a, 0xd8d0b0, 0x8a3a2a], rw = [4, 3, 2];
    rw.forEach((n, r) => { for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.072, c = cs[(i + r * 2) % cs.length]; K.cyl('plain', x, y + r * 0.1, 0, 0.033, 0.1, c); K.cyl('plain', x, y + r * 0.1 + 0.02, 0, 0.0345, 0.055, 0xe8e4d8); K.cyl('metal', x, y + r * 0.1 + 0.1, 0, 0.031, 0.004, 0xb8bcc0); } });
    K.cyl('plain', 0.3, y + 0.033, 0.1, 0.033, 0.1, 0xc8a030, 0, Math.PI / 2); K.cyl('plain', -0.32, y + 0.033, 0.12, 0.033, 0.1, 0xb03a2a, 0, 1.2); };
  B.water_jug = (M, a) => { const K = kit(M, a), y = M.y || 0, az = K.accent(0x5aa0d8);
    K.cyl('plain', 0, y, 0, 0.13, 0.32, az); K.cyl('plain', 0, y + 0.32, 0, 0.1, 0.05, az); K.cyl('plain', 0, y + 0.37, 0, 0.05, 0.08, az); K.cyl('plain', 0, y + 0.45, 0, 0.055, 0.035, 0x2a5a9a); K.cyl('plain', 0, y + 0.12, 0, 0.1325, 0.1, 0xf4f4f0); K.box('plain', 0.14, y + 0.22, 0, 0.04, 0.12, 0.05, shade(az, 0.85)); };
  B.floor_mattress = (M, a) => { const K = kit(M, a), { w, d } = K.dim('floor_mattress'), h = 0.17, c = K.fabric(0xc8c0b0), ac = K.accent(0x6a4a3a);
    K.box('fabric', 0, 0, 0, w, h, d, c); for (let i = 0; i < 4; i++) K.box('fabric', -w / 2 + (i + 0.5) * w / 4, h, 0, w / 8, 0.003, d - 0.04, shade(c, 0.86)); K.box('fabric', 0, h, -d / 2 + 0.28, w * 0.7, 0.1, 0.38, 0xf0ece0, 0.05);
    K.box('fabric', 0.03, h, 0.3, w * 0.95, 0.05, d * 0.55, ac, 0.05); K.box('fabric', 0.15, h + 0.05, 0.0, w * 0.5, 0.05, 0.4, shade(ac, 1.2), 0.3); K.box('fabric', -0.2, h + 0.05, 0.5, w * 0.3, 0.06, 0.3, shade(ac, 0.8), -0.4); };
  B.lantern = (M, a) => { const K = kit(M, a), y = M.y || 0;
    K.cyl('metal', 0, y, 0, 0.07, 0.03, 0x2a4a2a); K.cyl('emissive', 0, y + 0.03, 0, 0.055, 0.18, 0xffd890); for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('metal', sx * 0.05, y + 0.03, sz * 0.05, 0.01, 0.18, 0.01, 0x2a2a2a);
    K.cyl('metal', 0, y + 0.21, 0, 0.075, 0.025, 0x2a4a2a); K.box('metal', 0, y + 0.235, 0, 0.1, 0.012, 0.012, 0x2a2a2a); for (const s of [-1, 1]) K.box('metal', s * 0.05, y + 0.235, 0, 0.01, 0.045, 0.01, 0x2a2a2a);
    if (M.lit !== false) K.light(0, y + 0.15, 0, 0xffc880, 7, 'lantern'); };
  B.candles = (M, a) => { const K = kit(M, a), y = M.y || 0;
    K.cyl('plain', 0, y, 0, 0.09, 0.012, 0xf0f0ea); [[0, 0, 0.16], [0.06, 0.03, 0.1], [-0.05, 0.04, 0.12], [0.02, -0.06, 0.07]].forEach(([x, z, h], i) => { K.cyl('plain', x, y + 0.012, z, 0.017, h, 0xf0e6c8); K.cyl('emissive', x, y + 0.012 + h, z, 0.008, 0.03, i % 2 ? 0xffc060 : 0xffd890, 0, 0, 'sphere'); });
    K.cyl('plain', 0.02, y + 0.012, 0.0, 0.05, 0.008, 0xf0e6c8); if (M.lit !== false) K.light(0, y + 0.22, 0, 0xffb060, 5, 'candles'); };
  B.open_suitcases = (M, a) => { const K = kit(M, a), cs = [K.main(0xb03a34), 0x2a3a5a], rs = [0xc8c0a8, 0x4a6a8a, 0xe0dcd0, 0xa8483a];
    const suitcase = (x: number, z: number, ww: number, dd: number, c: number, ry: number, al: number) => { const lx = x, hz = z - dd / 2;
      K.box('plain', lx, 0, z, ww, 0.16, dd, c, ry); K.box('fabric', lx, 0.12, z, ww - 0.06, 0.05, dd - 0.06, 0xd8d0c0, ry);
      for (let i = 0; i < 5; i++) K.box('fabric', lx + (K.rnd() - 0.5) * (ww - 0.2), 0.16, z + (K.rnd() - 0.5) * (dd - 0.2), 0.14 + K.rnd() * 0.1, 0.04 + K.rnd() * 0.04, 0.12 + K.rnd() * 0.1, rs[i % 4], K.rnd() * 3);
      K.ramp('plain', lx, 0.16, hz, ww, 0.07, dd, c, al); K.box('metal', lx + ww * 0.3, 0.1, z + dd / 2, 0.04, 0.03, 0.01, 0xc0c0c0); };
    suitcase(-0.4, 0, 0.75, 0.5, cs[0], 0.15, 1.35); suitcase(0.45, 0.1, 0.6, 0.42, cs[1], -0.3, 1.2); };
  B.clothes_on_floor = (M, a) => { const K = kit(M, a), { w, d } = K.dim('clothes_on_floor'), cs = [0xc8c0a8, 0x4a6a8a, 0xa8483a, 0xe0dcd0, 0x6a8a5a, 0x2a2a30, K.accent(0xc89a4a)];
    for (let i = 0; i < 9; i++) { const x = (K.rnd() - 0.5) * (w - 0.3), z = (K.rnd() - 0.5) * (d - 0.3), r = K.rnd() * 6, c = cs[i % cs.length], y = 0.012 + i * 0.003;
      if (i % 3 === 0) { K.box('fabric', x, y, z, 0.3, 0.012, 0.36, c, r); for (const s of [-1, 1]) K.box('fabric', x + Math.cos(r) * s * 0.2, y, z - Math.sin(r) * s * 0.2, 0.2, 0.012, 0.09, shade(c, 0.9), r + s * 0.5); }
      else if (i % 3 === 1) { for (const s of [-1, 1]) K.box('fabric', x + s * 0.06, y, z, 0.13, 0.014, 0.5, 0x3a4a6a, r + s * 0.15); } else K.box('fabric', x, y, z, 0.14, 0.01, 0.07, c, r); }
    const sx = (K.rnd() - 0.5) * (w - 0.4), sz = (K.rnd() - 0.5) * (d - 0.4); K.box('plain', sx, 0.012, sz, 0.09, 0.07, 0.27, 0x2a2a2a, 0.4); K.box('plain', sx + 0.15, 0.012, sz + 0.05, 0.09, 0.07, 0.27, 0x2a2a2a, 0.9); };
  B.fallen_chair = (M, a) => { // wooden chair knocked over on its side: the parts are axis-aligned boxes, rotated 90 degrees around z
    const g = Math.PI / 2, dy = 0.23, api = { box: (Mm: PropItem, mat: Material, x: number, y: number, z: number, w: number, h: number, d: number, color: number, ry: number, rx: number, rz?: number) => { const cy = y + h / 2; a.box(Mm, mat, -cy + 0.0, dy + x - h / 2 + 0.0 - 0.0, z, w, h, d, color, ry, rx, g + (rz || 0)); } };
    const K = kit(M, api as unknown as PropsApi), c = K.main(0x6a4a30); // center (x, y, z) becomes (-cy, x): the api y is the base, so h/2 is subtracted
    K.box('wood', 0, 0.44, 0, 0.42, 0.04, 0.42, c); for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('wood', sx * 0.18, 0, sz * 0.18, 0.035, 0.44, 0.035, shade(c, 0.85));
    K.box('wood', 0, 0.48, -0.19, 0.42, 0.45, 0.03, c); };
  B.blood_stains = (M, a) => { const K = kit(M, a), { w, d } = K.dim('blood_stains');
    for (let k = 0; k < 7; k++) K.cyl('plain', (K.rnd() - 0.5) * w * 0.3, 0.012 + k * 0.0004, (K.rnd() - 0.5) * d * 0.3, 0.12 + K.rnd() * 0.18, 0.003, k < 2 ? 0x3a0806 : 0x5a100c);
    for (let k = 0; k < 8; k++) { const an = K.rnd() * 6.28, r = 0.3 + K.rnd() * Math.min(w, d) * 0.4; K.cyl('plain', Math.cos(an) * r, 0.013 + k * 0.0002, Math.sin(an) * r, 0.02 + K.rnd() * 0.05, 0.003, 0x4a0a08); }
    if (M.drag !== false) for (let k = 1; k < 6; k++) K.box('plain', 0.3 + k * 0.1, 0.012, 0.15 + k * 0.17, 0.16 - k * 0.015, 0.003, 0.2, 0x4a0c0a, 0.5); };
  B.open_door = (M, a) => { const K = kit(M, a), { w, d, h } = K.dim('open_door'), wood = K.wood(0x6a4a2c), angle = M.angle != null ? M.angle : 1.2, L = w - 0.06, hx = -w / 2 + 0.03;
    K.box('wood', -w / 2 - 0.03, 0, 0, 0.06, h + 0.06, d, shade(wood, 0.8)); K.box('wood', w / 2 + 0.03, 0, 0, 0.06, h + 0.06, d, shade(wood, 0.8)); K.box('wood', 0, h, 0, w + 0.12, 0.06, d, shade(wood, 0.8));
    K.box('wood', hx + Math.cos(angle) * L / 2, 0.0, Math.sin(angle) * L / 2, L, h - 0.02, 0.04, wood, -angle); K.cyl('metal', hx + Math.cos(angle) * (L - 0.08), 1.0, Math.sin(angle) * (L - 0.08) + 0.04, 0.025, 0.06, 0xc8b070, Math.PI / 2, 0);
    for (const y of [0.2, 1.0, 1.8]) K.box('metal', hx, y, 0.0, 0.02, 0.1, 0.02, 0x8a8a8a); };
  return B
}
