import { rng } from './colors'
import type { AtlasMap, AtlasName, DocumentLike, FloorAtlas, FloorKind, PictureAtlas, Uv, WaterAtlas } from './types'

type Ctx = CanvasRenderingContext2D
type Rand = () => number

const makeCanvas = (doc: DocumentLike, w: number, h: number): HTMLCanvasElement => {
  const c = doc.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// draws f() nine times (offsets of +-n) inside the clipped cell, so the pattern tiles without a seam
function seamless(g: Ctx, x0: number, y0: number, n: number, f: () => void) {
  g.save()
  g.beginPath()
  g.rect(x0, y0, n, n)
  g.clip()
  for (let dy = -n; dy <= n; dy += n)
    for (let dx = -n; dx <= n; dx += n) {
      g.save()
      g.translate(x0 + dx, y0 + dy)
      f()
      g.restore()
    }
  g.restore()
}
const noise = (g: Ctx, x0: number, y0: number, n: number, r: Rand, a: number) => {
  for (let i = 0; i < (n * n) / 6; i++) {
    const v = r() < 0.5 ? 0 : 255
    g.fillStyle = `rgba(${v},${v},${v},${r() * a})`
    g.fillRect(x0 + r() * n, y0 + r() * n, 1 + r() * 2, 1 + r() * 2)
  }
}

/** Floor kinds that live in the floor atlas: atlas cells and the world size (meters) one cell covers. */
export const FLOORS: Record<FloorKind, { cells: number[]; size: number }> = {
  lawn: { cells: [0, 1], size: 2.0 },
  tile_floor: { cells: [2], size: 1.0 },
  concrete: { cells: [3], size: 2.0 },
  deck_floor: { cells: [4], size: 1.2 },
  dirt: { cells: [5], size: 2.0 },
  pool_tile: { cells: [6], size: 1.0 },
  paving: { cells: [7], size: 1.0 },
}
const PICTURE_CELLS = 8 // 0-3 abstract, 4-6 landscapes, 7 mirror

function floorAtlas(doc: DocumentLike): FloorAtlas {
  const N = 256, cv = makeCanvas(doc, N * 4, N * 2), g = cv.getContext('2d')!, P = (c: number): [number, number] => [(c % 4) * N, Math.floor(c / 4) * N];
  const cell = (c: number, seed: number, f: (g: Ctx, x0: number, y0: number, r: Rand) => void) => { const [x0, y0] = P(c), r = rng(seed); f(g, x0, y0, r); };
  for (const [c, seed] of [[0, 11], [1, 12]] as Array<[number, number]>) cell(c, seed, (g, x0, y0, r) => { // lawn: base + blades + dry patches
    g.fillStyle = c ? '#648f3a' : '#5b8a37'; g.fillRect(x0, y0, N, N);
    seamless(g, x0, y0, N, () => { for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '160,170,60' : '40,80,30'},${0.12 + r() * 0.12})`; g.beginPath(); g.arc(r() * N, r() * N, 8 + r() * 22, 0, 6.3); g.fill(); }
      for (let i = 0; i < 520; i++) { r(); /* the original drew a blade height here and never used it; the call keeps the random sequence identical */ g.strokeStyle = `hsl(${85 + r() * 30},${40 + r() * 25}%,${22 + r() * 24}%)`; g.lineWidth = 1; const x = r() * N, y = r() * N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y - 4 - r() * 9); g.stroke(); } }); });
  cell(2, 21, (g, x0, y0, r) => { // beige 4x4 ceramic tiles with grout
    const q = N / 4; g.fillStyle = '#8c877b'; g.fillRect(x0, y0, N, N);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const v = 204 + (r() - 0.5) * 16; g.fillStyle = `rgb(${v},${v - 6},${v - 18})`; g.fillRect(x0 + i * q + 2, y0 + j * q + 2, q - 4, q - 4); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0 + i * q + 3, y0 + j * q + 3, q - 8, 3); }
    for (let k = 0; k < 14; k++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40); const x = x0 + r() * N, y = y0 + r() * N; g.save(); g.beginPath(); g.rect(x0, y0, N, N); g.clip(); g.translate(x, y); gr.addColorStop(0, 'rgba(90,80,60,.10)'); gr.addColorStop(1, 'rgba(90,80,60,0)'); g.fillStyle = gr; g.fillRect(-40, -40, 80, 80); g.restore(); } });
  cell(3, 31, (g, x0, y0, r) => { // concrete: slab, expansion joint, crack, stain
    g.fillStyle = '#a7a7a0'; g.fillRect(x0, y0, N, N);
    for (let k = 0; k < 18; k++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 50); g.save(); g.beginPath(); g.rect(x0, y0, N, N); g.clip(); g.translate(x0 + r() * N, y0 + r() * N); gr.addColorStop(0, `rgba(${r() < 0.5 ? '70,70,60' : '200,200,190'},.12)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-50, -50, 100, 100); g.restore(); }
    noise(g, x0, y0, N, r, 0.25); g.fillStyle = 'rgba(40,40,36,.55)'; g.fillRect(x0, y0 + N / 2 - 1, N, 2); g.fillRect(x0 + N / 2 - 1, y0, 2, N); g.fillRect(x0, y0, N, 1); g.fillRect(x0, y0, 1, N);
    g.strokeStyle = 'rgba(50,50,46,.5)'; g.lineWidth = 1; let x = x0 + 30 + r() * 60, y = y0 + 8; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (r() - 0.5) * 16; y += 12 + r() * 8; g.lineTo(x, y); } g.stroke(); });
  cell(4, 41, (g, x0, y0, r) => { // deck: 12 boards in staggered rows
    const th = N / 12; g.fillStyle = '#2a1c10'; g.fillRect(x0, y0, N, N);
    for (let j = 0; j < 12; j++) { const cut = r() * N; for (const [a, b] of [[0, cut], [cut, N]]) { const v = 150 + (r() - 0.5) * 36; g.fillStyle = `rgb(${v},${v * 0.68 | 0},${v * 0.42 | 0})`; g.fillRect(x0 + a + 1, y0 + j * th + 1, b - a - 2, th - 2);
      g.strokeStyle = 'rgba(50,28,12,.3)'; for (let s = 0; s < 3; s++) { const y = y0 + j * th + 3 + r() * (th - 6); g.beginPath(); g.moveTo(x0 + a, y); g.lineTo(x0 + b, y + (r() - 0.5) * 2); g.stroke(); }
      g.fillStyle = 'rgba(30,20,10,.7)'; g.fillRect(x0 + a + 4, y0 + j * th + th / 2, 2, 2); g.fillRect(x0 + b - 6, y0 + j * th + th / 2, 2, 2); } } });
  cell(5, 51, (g, x0, y0, r) => { // packed dirt
    g.fillStyle = '#7b5538'; g.fillRect(x0, y0, N, N);
    seamless(g, x0, y0, N, () => { for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,38,24' : '150,112,80'},${0.12 + r() * 0.15})`; g.beginPath(); g.arc(r() * N, r() * N, 6 + r() * 20, 0, 6.3); g.fill(); }
      for (let k = 0; k < 90; k++) { const v = 90 + r() * 90; g.fillStyle = `rgb(${v},${v * 0.85 | 0},${v * 0.7 | 0})`; g.fillRect(r() * N, r() * N, 1 + r() * 3, 1 + r() * 3); } }); });
  cell(6, 61, (g, x0, y0, r) => { // 8x8 pool tiles
    const q = N / 8; g.fillStyle = '#d4e8ee'; g.fillRect(x0, y0, N, N);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const v = (r() - 0.5) * 24; g.fillStyle = `rgb(${50 + v},${150 + v},${190 + v})`; g.fillRect(x0 + i * q + 1, y0 + j * q + 1, q - 2, q - 2); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x0 + i * q + 2, y0 + j * q + 2, q - 6, 2); } });
  cell(7, 71, (g, x0, y0, r) => { // reddish interlocking paving (small bricks)
    const bw = N / 4, bh = N / 8; g.fillStyle = '#7a7268'; g.fillRect(x0, y0, N, N);
    for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) { const off = (j % 2) * bw / 2, v = 150 + (r() - 0.5) * 30; g.fillStyle = `rgb(${v + 20},${v * 0.55 | 0},${v * 0.42 | 0})`; g.fillRect(x0 + ((i * bw + off) % N + N) % N + 1, y0 + j * bh + 1, bw - 2, bh - 2); }
    noise(g, x0, y0, N, r, 0.2); });
  const cells = {} as Record<FloorKind, Uv[]>; for (const k of Object.keys(FLOORS) as FloorKind[]) cells[k] = FLOORS[k].cells.map(c => ({ u0: (c % 4) / 4, u1: (c % 4 + 1) / 4, v0: 1 - (Math.floor(c / 4) + 1) / 2, v1: 1 - Math.floor(c / 4) / 2 }));
  const e = 1.5 / (N * 4), ev = 1.5 / (N * 2); // inset of one and a half pixels: no bleeding from the neighbouring cell
  return { canvas: cv, cells, size: (k: FloorKind) => FLOORS[k].size, uv(k: FloorKind, v = 0) { const L = cells[k]; const c = L[v % L.length]; return { u0: c.u0 + e, u1: c.u1 - e, v0: c.v0 + ev, v1: c.v1 - ev }; }, variants: (k: FloorKind) => FLOORS[k].cells.length };
}

function pictureAtlas(doc: DocumentLike, names: string[]): PictureAtlas {
  const N = 256, cv = makeCanvas(doc, N * 4, N * 2), g = cv.getContext('2d')!;
  const cell = (c: number, seed: number, f: (r: Rand) => void) => { const x0 = (c % 4) * N, y0 = Math.floor(c / 4) * N, r = rng(seed); g.save(); g.beginPath(); g.rect(x0, y0, N, N); g.clip(); g.translate(x0, y0); f(r); g.restore(); };
  cell(0, 101, r => { g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, N, N); g.fillStyle = '#c0613c'; g.beginPath(); g.arc(90 + r() * 30, 110, 60, 0, 6.3); g.fill(); g.fillStyle = '#2f7f84'; g.fillRect(120, 40 + r() * 30, 90, 150); g.fillStyle = '#d9a43a'; g.beginPath(); g.arc(150, 200, 70, Math.PI, 0); g.fill(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 230); g.lineTo(236, 30); g.stroke(); });
  cell(1, 102, r => { g.fillStyle = '#1f3a5f'; g.fillRect(0, 0, N, N); for (let i = 0; i < 7; i++) { g.fillStyle = ['#f08a3c', '#f4e4c1', '#d94f4f', '#7fb5a5'][i % 4]; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(r() * N, r() * N, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, 6.3); g.fill(); } g.globalAlpha = 1; g.strokeStyle = '#f4e4c1'; g.lineWidth = 4; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0, 50 + i * 70); g.bezierCurveTo(80, 10 + i * 70, 170, 120 + i * 40, N, 60 + i * 60); g.stroke(); } });
  cell(2, 103, r => { const cs = ['#e9e1cf', '#c8553d', '#2e5e7e', '#e4b23e', '#4b4b4b']; let x = 0; while (x < N) { const w = 30 + r() * 60; g.fillStyle = cs[(r() * cs.length) | 0]; g.fillRect(x, 0, w, N); x += w; } g.fillStyle = '#e9e1cf'; g.fillRect(40, 60, 176, 136); g.fillStyle = cs[1]; g.fillRect(70, 90, 60, 76); g.fillStyle = cs[2]; g.fillRect(140, 90, 50, 36); });
  cell(3, 104, r => { g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, N, N); g.fillStyle = '#1a1a1a'; g.fillRect(40, 190, 176, 8); g.fillStyle = '#b8352e'; g.beginPath(); g.arc(128, 100, 52, 0, 6.3); g.fill(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(40, 30 + i * 8 + r() * 4); g.lineTo(216, 30 + i * 8); g.stroke(); } });
  cell(4, 105, r => { const gr = g.createLinearGradient(0, 0, 0, N * 0.7); gr.addColorStop(0, '#5a4a8a'); gr.addColorStop(0.5, '#e8805a'); gr.addColorStop(1, '#f7d27a'); g.fillStyle = gr; g.fillRect(0, 0, N, N); g.fillStyle = '#fff3c0'; g.beginPath(); g.arc(150, 150, 36, 0, 6.3); g.fill();
    ([['#7a5a6a', 150], ['#4a4a5e', 175], ['#2a3a3a', 205]] as Array<[string, number]>).forEach(([c, y], k) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, N); g.lineTo(0, y); for (let x = 0; x <= N; x += 32) g.lineTo(x, y - 10 + r() * 24 - k * 3); g.lineTo(N, N); g.fill(); }); });
  cell(5, 106, r => { const gr = g.createLinearGradient(0, 0, 0, N); gr.addColorStop(0, '#9fc8e8'); gr.addColorStop(0.55, '#e8f0f4'); gr.addColorStop(0.56, '#3d7a9a'); gr.addColorStop(1, '#22506a'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
    g.fillStyle = '#5a6a78'; g.beginPath(); g.moveTo(0, 140); for (let x = 0; x <= N; x += 28) g.lineTo(x, 70 + r() * 50); g.lineTo(N, 140); g.fill(); g.fillStyle = '#3a5a4a'; g.beginPath(); g.moveTo(150, 140); g.quadraticCurveTo(200, 60, 230, 140); g.fill(); });
  cell(6, 107, () => { const gr = g.createLinearGradient(0, 0, 0, N); gr.addColorStop(0, '#f6e0a8'); gr.addColorStop(0.5, '#fbeed0'); gr.addColorStop(0.5, '#4bb0c4'); gr.addColorStop(0.72, '#2e8aa8'); gr.addColorStop(0.72, '#ecd8a2'); gr.addColorStop(1, '#d9bd7e'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
    g.strokeStyle = '#4a3a22'; g.lineWidth = 5; g.beginPath(); g.moveTo(60, 255); g.quadraticCurveTo(70, 160, 100, 70); g.stroke(); g.fillStyle = '#2f6a3a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(100, 70); g.quadraticCurveTo(100 + Math.cos(i) * 40, 40 + Math.sin(i * 2) * 20, 100 + Math.cos(i * 1.1) * 60, 80 + i * 6); g.quadraticCurveTo(100 + Math.cos(i) * 30, 70, 100, 70); g.fill(); } });
  cell(7, 108, () => { const gr = g.createLinearGradient(0, 0, N, N); gr.addColorStop(0, '#e4e9eb'); gr.addColorStop(0.5, '#c4ccd0'); gr.addColorStop(1, '#a8b2b8'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(30, 0); g.lineTo(90, 0); g.lineTo(0, 120); g.lineTo(0, 60); g.fill(); g.beginPath(); g.moveTo(150, 0); g.lineTo(175, 0); g.lineTo(0, 256); g.lineTo(0, 232); g.fill();
    const v = g.createRadialGradient(128, 128, 90, 128, 128, 190); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = v; g.fillRect(0, 0, N, N); });
  const uvc = (c: number): Uv => ({ u0: (c % 4) / 4 + 1.5 / (N * 4), u1: (c % 4 + 1) / 4 - 1.5 / (N * 4), v0: 1 - (Math.floor(c / 4) + 1) / 2 + 1.5 / (N * 2), v1: 1 - Math.floor(c / 4) / 2 - 1.5 / (N * 2) });
  return { canvas: cv, n: PICTURE_CELLS - 1, uv: c => uvc(c), mirror: () => uvc(7), names };
}

// light/dark ripple that tiles; the host scrolls texture.offset for the shimmer
function waterAtlas(doc: DocumentLike): WaterAtlas {
  const N = 128, cv = makeCanvas(doc, N, N), g = cv.getContext('2d')!, r = rng(901);
  g.fillStyle = '#e6f2f8'; g.fillRect(0, 0, N, N);
  seamless(g, 0, 0, N, () => { for (let i = 0; i < 26; i++) { const x = r() * N, y = r() * N, w = 14 + r() * 26; g.strokeStyle = r() < 0.55 ? 'rgba(255,255,255,.9)' : 'rgba(110,170,200,.5)'; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 5 - r() * 4, x + w, y); g.stroke(); } });
  return { canvas: cv };
}

/** Lazily builds and caches the procedural canvas atlases (one canvas per atlas; the host makes one texture per canvas). */
export function createAtlasProvider(doc: DocumentLike | null, pictureNames: string[]) {
  const cache: { [K in AtlasName]?: AtlasMap[AtlasName] } = {}
  return function atlas<K extends AtlasName>(name: K): AtlasMap[K] {
    if (!doc) throw new Error('game-props3d: a document is needed to build the atlases (pass options.document)')
    const made = cache[name]
    if (made) return made as AtlasMap[K]
    const build = { floor: () => floorAtlas(doc), picture: () => pictureAtlas(doc, pictureNames), water: () => waterAtlas(doc) }[name]
    return (cache[name] = build()) as AtlasMap[K]
  }
}
