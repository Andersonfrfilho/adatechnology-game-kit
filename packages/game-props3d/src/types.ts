import type { PropType } from './catalog'
import type { PropsLocale } from './locale'

/** `0xRRGGBB` or `'#rrggbb'`. */
export type Color = number | string

/** Semantic material keys. The host maps each one to a real material. */
export type Material = 'plain' | 'metal' | 'wood' | 'glass' | 'fabric' | 'plant' | 'water' | 'emissive' | 'atlas_picture' | 'atlas_floor'

/** Shape of a `cylinder` primitive: 12-sided (default), 6-sided, cone, or ellipsoid. */
export type CylinderShape = 'cyl' | 'cyl6' | 'cone' | 'sphere'

/** Cell of an atlas texture: `u0,v0` is the lower-left corner. */
export interface Uv {
  u0: number
  v0: number
  u1: number
  v1: number
}

export type PropGroup = 'ceiling' | 'wall' | 'plants' | 'furniture' | 'floor' | 'yard' | 'house_state'

/** Static facts about a prop type. */
export interface TypeDef<I extends string = PropType> {
  id: I
  /** Indoor furniture (true) or item of the lot (false). */
  interior: boolean
  /** Default footprint width (x), depth (z) and height (y), in meters. */
  w: number
  d: number
  h: number
  /** Default mounting height (split, pictures, TV, table plants, boards...). */
  y: number
  /** false = no collision (wall, ceiling, floor and decals): the host skips collision for them. */
  solid: boolean
  group: PropGroup
}

/** `TypeDef` plus the localized display name. */
export interface TypeInfo extends TypeDef {
  name: string
}

/** Colour roles of the house palette (`PropItem.palette`). Unknown roles are allowed. */
export interface Palette {
  wood?: Color
  fabric_main?: Color
  fabric_accent?: Color
  metal?: Color
  picture_accent?: Color
  wall_living?: Color
  wall_kitchen?: Color
  wall_bedroom?: Color
  exterior_floor?: Color
  plant?: Color
  [role: string]: Color | undefined
}

/**
 * The item a builder draws. Front = local +z, origin at the center of the footprint on the floor, `w` (x), `d` (z), `h` (y), in meters.
 * Without `w/d/h` the defaults of the type are used. `x`, `z`, `ry` are read by the host's api, not by the builders.
 */
export interface PropItem {
  x?: number
  z?: number
  ry?: number
  w?: number
  d?: number
  h?: number
  /** Mounting height (split, pictures, TV, table plants, boards...). */
  y?: number
  /** Ceiling height, default 2.9. */
  ceiling?: number
  /** Main colour of the item. */
  color?: Color
  /** House palette: `color` wins, then the palette role, then a sensible default. */
  palette?: Palette
  /** Seed of the details draw (number or string); defaults to a hash of the position. */
  seed?: number | string
  /** Variant: `'wood'` (blinds), `'dark'` (pergola), `'x'` (window boards). */
  variant?: string
  /** Polygon `[[x, z], ...]` (local coordinates) for floors. */
  poly?: Array<[number, number]>
  /** Lamp is on (ceiling light, track spot, chandelier). */
  on?: boolean
  /** Also emit a real light (pendant, chandelier). */
  light?: boolean
  /** Lit (lantern, candles); default true. */
  lit?: boolean
  /** Curtain open; default true. */
  open?: boolean
  /** Fraction of the blinds that is retracted, default 0.15. */
  retracted?: number
  /** Picture art index 0..6. */
  art?: number
  /** Colour of the fruit. */
  fruit?: Color
  /** Opening angle of the door (radians), default 1.2. */
  angle?: number
  /** Blood drag marks; default true. */
  drag?: boolean
}

/**
 * The api the host implements. Builders only describe primitives through it.
 * Coordinates are local to the item (the host applies `M.x`, `M.z`, `M.ry`). Colors are `0xRRGGBB`.
 */
export interface PropsApi {
  /** Box with its **base** at `y`, rotated around its own center (order YXZ: `ry` last). */
  box(M: PropItem, material: Material, x: number, y: number, z: number, w: number, h: number, d: number, color: number, ry: number, rx: number, rz: number): void
  /** Vertical cylinder with its base at `y` (if `rx`/`rz` are not 0, `y` is the center). `shape` defaults to `'cyl'`. */
  cylinder(M: PropItem, material: Material, x: number, y: number, z: number, r: number, h: number, color: number, rx: number, rz: number, shape?: CylinderShape): void
  /** Diamond-shaped leaf, base at (x, y, z), tip toward +y; `ry` turns it, `rx` leans it forward; double-sided. */
  leaf(M: PropItem, x: number, y: number, z: number, w: number, h: number, color: number, ry: number, rx: number): void
  /** `w` x `h` quad centered at `y`, normal +z (use `rx = -PI/2` to lay it flat); `uv` is the atlas cell. */
  plane(M: PropItem, material: Material, x: number, y: number, z: number, w: number, h: number, color: number, ry: number, rx: number, rz: number, uv?: Uv): void
  /** A real light (optional; at most one per room). Without it, `emit('light', data)` is called instead. */
  light?(M: PropItem, x: number, y: number, z: number, color: number, range: number, kind: string): void
}

export type Builder = (M: PropItem, api: PropsApi) => void
export type BuilderMap = Record<PropType, Builder>

/** Data passed to `emit('light', ...)` when the api has no `light`. */
export interface LightEvent {
  M: PropItem
  x: number
  y: number
  z: number
  color: number
  range: number
  kind: string
}
export type EmitFn = (event: 'light', data: LightEvent) => void

/** What the builders need from a `document`. */
export type DocumentLike = Pick<Document, 'createElement'>

export type FloorKind = 'lawn' | 'tile_floor' | 'concrete' | 'deck_floor' | 'dirt' | 'pool_tile' | 'paving'

export interface FloorAtlas {
  canvas: HTMLCanvasElement
  cells: Record<FloorKind, Uv[]>
  /** World size (meters) one cell covers. */
  size(kind: FloorKind): number
  uv(kind: FloorKind, variant?: number): Uv
  variants(kind: FloorKind): number
}
export interface PictureAtlas {
  canvas: HTMLCanvasElement
  /** Number of art cells (not counting the mirror). */
  n: number
  uv(index: number): Uv
  mirror(): Uv
  names: string[]
}
export interface WaterAtlas {
  canvas: HTMLCanvasElement
}
export type AtlasMap = { floor: FloorAtlas; picture: PictureAtlas; water: WaterAtlas }
export type AtlasName = keyof AtlasMap

export interface CoverOptions {
  w?: number
  d?: number
  y?: number
  size?: number
  color?: Color
  poly?: Array<[number, number]>
}

export interface Props3dOptions {
  /** Called with `('light', data)` when the api has no `light`. */
  emit?: EmitFn
  /** Where the atlas canvases are created; defaults to the global `document`. */
  document?: DocumentLike
  locale?: PropsLocale | (string & {})
}

export interface Props3d {
  /** One builder per prop type: `builders[type](M, api)` draws an item. */
  builders: BuilderMap
  /** Type metadata with localized names. */
  types: TypeInfo[]
  /** Ids of the builders. */
  names: PropType[]
  /** Procedural canvases, built lazily and cached: `'picture'`, `'floor'`, `'water'`. */
  atlas<K extends AtlasName>(name: K): AtlasMap[K]
  /** Covers the item's rectangle (or a polygon) with floor tiles from the atlas via `api.plane('atlas_floor')`. */
  cover(api: PropsApi, M: PropItem, kind: FloorKind, options?: CoverOptions): void
  materials: readonly Material[]
}

/** The helpers builders use; internal but exported for custom builders. */
export interface Kit {
  M: PropItem
  api: PropsApi
  rnd: () => number
  box(material: Material, x: number, y: number, z: number, w: number, h: number, d: number, color: Color, ry?: number, rx?: number, rz?: number): void
  cyl(material: Material, x: number, y: number, z: number, r: number, h: number, color: Color, rx?: number, rz?: number, shape?: CylinderShape): void
  leaf(x: number, y: number, z: number, w: number, h: number, color: Color, ry?: number, rx?: number): void
  plane(material: Material, x: number, y: number, z: number, w: number, h: number, color: Color, ry?: number, rx?: number, rz?: number, uv?: Uv): void
  light(x: number, y: number, z: number, color: Color, range: number, kind: string): void
  /** Palette role (`M.palette`) or the default. */
  color(role: string, fallback: Color): number
  /** Main colour: `M.color` or the default. */
  main(fallback: Color): number
  /** Fabric: `M.color`, else the `fabric_main` role, else the default. */
  fabric(fallback: Color): number
  accent(fallback: Color): number
  wood(fallback: Color): number
  metal(fallback: Color): number
  dim(id: PropType): { w: number; d: number; h: number }
  ceiling(): number
  /** Long tilted box: starts at (x, y, z) and follows u = (0, sin a, -cos a) for L meters. */
  ramp(material: Material, x: number, y: number, z: number, w: number, t: number, L: number, color: Color, alpha: number): void
}

export interface BuilderContext {
  kit(M: PropItem, api: PropsApi): Kit
  atlas<K extends AtlasName>(name: K): AtlasMap[K]
  cover(api: PropsApi, M: PropItem, kind: FloorKind, options?: CoverOptions): void
}

/** A primitive as captured by `createRecorder`. */
export type Primitive =
  | { kind: 'box'; M: PropItem; material: Material; x: number; y: number; z: number; w: number; h: number; d: number; color: number; ry: number; rx: number; rz: number }
  | { kind: 'cylinder'; M: PropItem; material: Material; x: number; y: number; z: number; r: number; h: number; color: number; rx: number; rz: number; shape?: CylinderShape }
  | { kind: 'leaf'; M: PropItem; x: number; y: number; z: number; w: number; h: number; color: number; ry: number; rx: number }
  | { kind: 'plane'; M: PropItem; material: Material; x: number; y: number; z: number; w: number; h: number; color: number; ry: number; rx: number; rz: number; uv?: Uv }
  | { kind: 'light'; M: PropItem; x: number; y: number; z: number; color: number; range: number; lightKind: string }
