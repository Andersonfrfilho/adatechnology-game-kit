export type Trig = 'sin' | 'cos'
export type Point = readonly [number, number]
export type Rect = readonly [number, number, number, number]

/** One term of a rolling surface. `product`: `fx(kx·px) · fy(ky·py) · amplitude`. `diagonal`: `sin(kx·px + ky·py) · amplitude`. */
export type Wave =
  | { kind: 'product'; x: readonly [Trig, number]; y: readonly [Trig, number]; amplitude: number }
  | { kind: 'diagonal'; kx: number; ky: number; amplitude: number }

/** A factor of a mask: a smoothstep along one axis. With `fullUntil`, everything before that value counts as 1. */
export type Ramp = { axis: 'x' | 'y'; from: number; to: number; fullUntil?: number }

/** A region that adds relief: `mask · (level + waves)`. The mask is the product of its ramps. */
export type TerrainLayer = { id: string; mask: readonly Ramp[]; level: number; waves: readonly Wave[] }

/** Levels a rectangle (a city) towards `level`, from `margin` outside it to the inside, by a smoothstep of the distance to its nearest edge. */
export type Flatten = { id: string; rect: Rect; margin: number; edge: readonly [number, number]; level: number }

/** The bed of a river: a fixed height, or `below` the surrounding ground but never lower than `floor`. */
export type RiverBed = { fixed: number } | { below: number; floor: number }
/** A river as a polyline; the ground eases from the bed to the land between the two distances of `width`. */
export type River = { id: string; points: readonly Point[]; width: readonly [number, number]; bed: RiverBed }
/** A lake as an ellipse; the ground eases from `level` to the land between the two fractions of `edge` and is untouched past `reach`. */
export type Lake = { id: string; center: Point; radius: Point; level: number; edge: readonly [number, number]; reach: number }

/** Where trees grow: the strongest of the masked zones and a patchy noise. */
export type ForestOptions = {
  zones: readonly { mask: readonly Ramp[] }[]
  patch?: { waves: readonly Wave[]; edge: readonly [number, number]; weight: number }
}

/** What colours a vertex, tried in this order; the first rule that matches wins. */
export type ColorRule =
  | { kind: 'below'; height: number; color: number }
  | { kind: 'above'; height: number; color: number }
  | { kind: 'ellipse'; center: Point; radius: Point; color: number }
  | { kind: 'rects'; rects: readonly Rect[]; margin: number; color: number }
  | { kind: 'forest'; above: number; color: number }

/** Map coordinates (the ground plan) to world metres: `world = map · scale + origin`. The mesh is a square of `size` metres with `segments` cells a side. */
export type WorldFrame = { size: number; scale: number; origin: number; segments: number }

/** Everything that makes a terrain; the numbers of a place live in the game, not here. */
export type TerrainOptions = {
  world: WorldFrame
  base: { level: number; waves: readonly Wave[] }
  layers: readonly TerrainLayer[]
  flatten: readonly Flatten[]
  rivers: readonly River[]
  lakes: readonly Lake[]
  forest: ForestOptions
  colors: readonly ColorRule[]
  /** Colours of the open ground, picked by a hash of the map cell. */
  fields: { colors: readonly number[]; cell: Point }
  /** The water plane under the whole terrain. */
  water: { level: number; color: number; roughness: number; metalness: number }
  /** Shape of the last touch: changes the height after every layer, river and lake. */
  custom?: (px: number, py: number, height: number) => number
}

/** The ground as numbers a drawer turns into a mesh: a grid of `segments + 1` vertices a side, rows along z. */
export type TerrainGrid = {
  segments: number
  size: number
  /** x and z of each vertex in world metres. */
  x: Float32Array
  z: Float32Array
  heights: Float32Array
  /** Colour of each vertex as 0xRRGGBB. */
  colors: Uint32Array
}
