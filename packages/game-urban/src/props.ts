import type { UrbanBuilder } from './scene'

/** Colours of the props; a game replaces the ones it wants. */
export type PropColors = {
  tent: number
  trunk: number
  pines: readonly number[]
  crowns: readonly number[]
  sandbags: number
  fence: number
  wire: number
  label: { background: string; foreground: string }
  watchtower: { leg: number; cabin: number; deck: number }
}

export const DEFAULT_PROP_COLORS: PropColors = {
  tent: 0x4f5638,
  trunk: 0x3a2a1c,
  pines: [0x1f3324, 0x24382a, 0x1b2d20],
  crowns: [0x34452a, 0x3d4a2c, 0x2f3d26],
  sandbags: 0x8a7a5a,
  fence: 0x6a6c6e,
  wire: 0x2a2a2a,
  label: { background: 'rgba(16,18,22,.9)', foreground: '#e8dfcf' },
  watchtower: { leg: 0x4a3a2a, cabin: 0x4f5638, deck: 0x3a3a2a },
}

const LABEL_FONT = '700 44px "Arial Narrow", Arial, sans-serif'
const LABEL_CANVAS = { width: 1024, height: 200 }
const SANDBAG_LENGTH = 0.56

const colors = (c?: Partial<PropColors>): PropColors => ({ ...DEFAULT_PROP_COLORS, ...c })

/** Fence along a line: posts every 3 m and three wires. */
export function drawFence(b: UrbanBuilder, x0: number, z0: number, x1: number, z1: number, height: number, color?: number): void {
  b.fence(x0, z0, x1, z1, height, color)
}

/** Tent: a triangular prism `w` wide, 0.7 w high and `d` long, turned by `ry`. */
export function drawTent(b: UrbanBuilder, x: number, z: number, ry: number, w: number, d: number, color?: number, c?: Partial<PropColors>): void {
  b.prism(x, 0, z, w, w * 0.7, d, color ?? colors(c).tent, -1, ry)
}

/** Pine: a trunk and two cones of one of the greens (one draw from the random). */
export function drawPine(b: UrbanBuilder, x: number, z: number, scale = 1, y = 0, c?: Partial<PropColors>): void {
  const palette = colors(c)
  b.cylinder(x, y, z, 0.12 * scale, 0.16 * scale, 1 * scale, palette.trunk)
  const green = b.pick(palette.pines)
  b.cone(x, y + 0.8 * scale, z, 1.1 * scale, 2.2 * scale, green)
  b.cone(x, y + 2.1 * scale, z, 0.8 * scale, 1.8 * scale, green)
}

/** Tree: a trunk and a rough ball of leaves of one of the greens (one draw from the random). */
export function drawTree(b: UrbanBuilder, x: number, z: number, scale = 1, c?: Partial<PropColors>): void {
  const palette = colors(c)
  b.cylinder(x, 0, z, 0.12 * scale, 0.18 * scale, 1.8 * scale, palette.trunk)
  b.crown(x, 2.6 * scale, z, 1.3 * scale, b.pick(palette.crowns))
}

/** Shipping container (2.44 x 2.6 x 6.06 m) with five ribs on one end. */
export function drawContainer(b: UrbanBuilder, x: number, y: number, z: number, ry: number, color: number): void {
  const group = b.group(x, y, z, ry)
  b.box(0, 0, 0, 2.44, 2.6, 6.06, color, { parent: group, style: { roughness: 0.7, metalness: 0.3 } })
  for (let k = -2; k <= 2; k++) b.box(k * 0.5, 0, 3.04, 0.06, 2.6, 0.04, 0x1a1a1a, { parent: group })
}

/** Watch tower: four legs, a cabin, a roof deck and two posts; with a searchlight whose beam circles the ground. */
export function drawWatchtower(b: UrbanBuilder, x: number, z: number, searchlight = false, c?: Partial<PropColors>): void {
  const palette = colors(c).watchtower
  for (const a of [-1, 1]) for (const d of [-1, 1]) b.box(x + a * 1.2, 0, z + d * 1.2, 0.25, 7, 0.25, palette.leg)
  b.box(x, 7, z, 3.2, 1.2, 3.2, palette.cabin)
  b.box(x, 8.2, z, 3.6, 0.15, 3.6, palette.deck)
  for (const side of [-1.5, 1.5]) b.box(x + side, 8.2, z, 0.15, 1.6, 0.15, palette.deck)
  if (searchlight) b.spot({ x, y: 9, z, color: 0xe6eeff, intensity: 2.4, distance: 70, decay: 1.2, angle: 0.35, penumbra: 0.5, target: { x: x + 20, y: 0, z: z + 20 }, sweep: { speed: 0.5, radius: 25 } })
}

/** Rows of sandbags along `x` or `z`, each row shifted half a bag. Instances, no parts. */
export function drawSandbags(b: UrbanBuilder, x: number, z: number, length: number, along: 'x' | 'z', rows = 3, c?: Partial<PropColors>): void {
  const color = colors(c).sandbags
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < length / SANDBAG_LENGTH; i++) {
      const u = -length / 2 + 0.28 + i * SANDBAG_LENGTH + (r % 2) * 0.28
      b.item(along === 'x' ? x + u : x, r * 0.21, along === 'x' ? z : z + u, along === 'x' ? 0.55 : 0.32, 0.22, along === 'x' ? 0.32 : 0.55, color)
    }
  }
}

/** A big strip of text on the ground level (name of a street, caption of a cell): two lines on a 22 x 4.4 m board at 2.4 m. */
export function drawStripLabel(b: UrbanBuilder, x: number, z: number, title: string, subtitle: string, c?: Partial<PropColors>): void {
  const { background, foreground } = colors(c).label
  b.label([title, subtitle], x, 2.4, z, 22, 4.4, 0, { background, foreground, font: LABEL_FONT, canvas: LABEL_CANVAS })
}

/** Wires between poles: a polyline at one height. */
export function drawWires(b: UrbanBuilder, points: readonly (readonly [number, number])[], y: number, color?: number, c?: Partial<PropColors>): void {
  b.line(points.map(([px, pz]) => [px, y, pz] as [number, number, number]), color ?? colors(c).wire)
}
