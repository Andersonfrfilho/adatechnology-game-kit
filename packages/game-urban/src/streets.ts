import type { UrbanBuilder } from './scene'

/** Look of the road surface and its centre line; the defaults are the Galeria's. */
export type RoadStyle = {
  color: number
  /** Painted dashes along the centre line. */
  dash: { color: number; every: number; first: number; length: number; width: number; height: number; y: number }
}

export type WalkStyle = { color: number; height: number; castShadow: boolean }

export const DEFAULT_ROAD_STYLE: RoadStyle = { color: 0x222428, dash: { color: 0x8f7f4f, every: 5, first: 2, length: 1.8, width: 0.16, height: 0.01, y: 0.025 } }
export const DEFAULT_WALK_STYLE: WalkStyle = { color: 0x3a3b3c, height: 0.15, castShadow: false }
const ROAD_LEVEL = 0.02
const DEFAULT_GROUND_COLOR = 0x15181a
const DEFAULT_GROUND_SIZE = 600

export type StreetOptions = { road?: Partial<RoadStyle> & { dash?: Partial<RoadStyle['dash']> }; walk?: Partial<WalkStyle> }

const roadStyle = (o?: StreetOptions): RoadStyle => ({ ...DEFAULT_ROAD_STYLE, ...o?.road, dash: { ...DEFAULT_ROAD_STYLE.dash, ...o?.road?.dash } })
const walkStyle = (o?: StreetOptions): WalkStyle => ({ ...DEFAULT_WALK_STYLE, ...o?.walk })

/** Road centred on (x, z), `w` wide and `l` long along `x` or `z`, with a dash every 5 m starting 2 m from its start. */
export function drawRoad(b: UrbanBuilder, x: number, z: number, w: number, l: number, along: 'x' | 'z', options?: StreetOptions): void {
  const style = roadStyle(options)
  const alongX = along === 'x'
  b.plane(x, ROAD_LEVEL, z, alongX ? l : w, alongX ? w : l, style.color)
  const { dash } = style
  for (let u = -l / 2 + dash.first; u < l / 2; u += dash.every) {
    b.item(alongX ? x + u : x, dash.y, alongX ? z : z + u, alongX ? dash.length : dash.width, dash.height, alongX ? dash.width : dash.length, dash.color)
  }
}

/** Sidewalk slab centred on (x, z). */
export function drawWalk(b: UrbanBuilder, x: number, z: number, w: number, d: number, options?: StreetOptions): void {
  const style = walkStyle(options)
  b.box(x, 0, z, w, style.height, d, style.color, { style: { castShadow: style.castShadow } })
}

/** The big plane under the scene. */
export function drawGround(b: UrbanBuilder, color = DEFAULT_GROUND_COLOR, size = DEFAULT_GROUND_SIZE): void {
  b.plane(0, 0, 0, size, size, color)
}

/**
 * A grid of `2n + 1` roads each way, `block` apart and `width` wide, with a sidewalk slab on every one of the `2n x 2n` blocks.
 * Roads first (z then x for each line), then the walks, as the page.
 */
export function drawStreetGrid(b: UrbanBuilder, block: number, count: number, width: number, options?: StreetOptions): void {
  for (let k = -count; k <= count; k++) {
    drawRoad(b, k * block, 0, width, block * 2 * count + width, 'z', options)
    drawRoad(b, 0, k * block, width, block * 2 * count + width, 'x', options)
  }
  for (let i = -count; i < count; i++) for (let j = -count; j < count; j++) drawWalk(b, i * block + block / 2, j * block + block / 2, block - width, block - width, options)
}
