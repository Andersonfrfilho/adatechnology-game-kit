import type { GroundLayout, GroundLoss, Hit } from '@adatechnology/game-contracts'

export type { GroundLayout, GroundZone } from '@adatechnology/game-contracts'

/** The blows that remove ground. Fire and heat char it instead (`TerrainMaterial.fire`). */
export type TerrainBlow = 'ballistic' | 'blunt' | 'slash' | 'explosive'

/** A blow at (x, z): `energy` in joules, `direction` where it travels, `contactRadius` of a blunt tool, `caliber` (mm) of a round, which shapes its crater. */
export type TerrainStrike = { x: number; z: number; energy: number; direction?: readonly number[]; contactRadius?: number; caliber?: number }

/** What one kind of blow does to a material. */
export interface TerrainBlowResponse {
  /** Joules it takes to remove one cubic metre. */
  readonly specificEnergy: number
  /** Depth over radius of the bowl it leaves: a soft ground craters deep, a hard one spalls wide and shallow. */
  readonly aspect: number
  /** A blow under this many joules leaves nothing (a punch on a slab). */
  readonly thresholdJoules?: number
  /** The bowl is never narrower: a tile comes off as a piece, not as the size of the bullet. */
  readonly minRadius?: number
}

export type TerrainDebrisKind = 'clods' | 'chips' | 'shards' | 'splinters' | 'dust' | 'blocks'

/** How a material of the destruction catalogue behaves as ground. `id` is the catalogue's. */
export interface TerrainMaterial {
  readonly id: string
  readonly hits: Partial<Record<TerrainBlow, TerrainBlowResponse>>
  readonly debris: TerrainDebrisKind
  /** Share of what a blow removes that piles up on the rim; the rest is thrown. Rigid materials have none. */
  readonly rimShare?: number
  /** Steepest slope in degrees it holds; loose ground slides until it is back to it. */
  readonly reposeDegrees?: number
  readonly fire?: TerrainFireResponse
  /** Linear rgb, 0..1, of the material where it is exposed. */
  readonly color: readonly [number, number, number]
  /** Surface pattern a renderer draws while the stratum is intact (`TERRAIN_PATTERNS`). */
  readonly pattern?: TerrainPattern
  /** A rigid surface cracks around a hard blow instead of only losing a bowl: lines that run out from the point (concrete, asphalt, tile, stone). */
  readonly crack?: TerrainCrackResponse
  /** A rigid layer a contact charge breaks right through once it has enough for the whole thickness (the scabbing of a slab): `explosive` only. */
  readonly breach?: TerrainBreachResponse
  /** What a foot does on it. */
  readonly footing?: TerrainFooting
  /** Liquid (of the fluids catalogue) a blow on it throws up. */
  readonly splash?: string
  /** Its pieces do not join the ground where they land: they stay as loose stones. */
  readonly scatters?: boolean
  /** Its pieces leave a splat on whatever they land on. */
  readonly splats?: boolean
  /** A brittle crust: each blow runs cracks this many bowl radii around it. */
  readonly cracks?: number
  /** Laid in separate pieces on a bed: a blow loosens whole pieces instead of digging a bowl. */
  readonly units?: TerrainUnits
}

export interface TerrainCrackResponse {
  /** Metres the longest line runs for a blow of 1 MJ; it grows with the cube root of the energy. */
  readonly reach: number
  /** Metres wide the lines open at the point for 1 MJ, also by the cube root, never under a hairline. */
  readonly width: number
  /** A blow under this many joules leaves no crack (a punch on a slab). */
  readonly thresholdJoules: number
}

export interface TerrainBreachResponse {
  /** Joules over the cube of the layer's thickness (J/m³) that break the whole layer through: for reinforced concrete about 1 kg of TNT for 12 cm. */
  readonly joulesPerCubedThickness: number
  /** Radius of the breach over the thickness at that energy; it grows with the cube root of the excess. */
  readonly radiusOverThickness: number
}

export interface TerrainFooting {
  /** Metres the foot goes in. */
  readonly sink: number
  /** What is left of the walking speed, 0..1. */
  readonly drag: number
  /** Keeps the print of what presses it. */
  readonly prints?: boolean
}

export interface TerrainUnits {
  /** Metres along x, in rows that shift every other one. Multiples of the cell keep the hole sharp. */
  readonly length: number
  /** Metres along z. */
  readonly width: number
  /** Joules a piece takes, added blow by blow, before it comes off its bed. */
  readonly looseJoules: number
}

export interface TerrainFireResponse {
  /** How black it gets, 0..1: concrete only soots, wood and turf char through. */
  readonly maxScorch: number
  /** Scorch gained per second in a flame. */
  readonly scorchPerSecond: number
  /** Metres per second the flame eats away (wood char). */
  readonly burnsAway?: number
  /** Catches and carries the fire to the next cells on its own. */
  readonly flammable?: boolean
}

export const TERRAIN_PATTERNS = ['plain', 'grass', 'soil', 'sand', 'asphalt', 'concrete', 'tile', 'planks', 'stone', 'mud', 'gravel', 'clay', 'snow', 'cobble', 'paver', 'rock'] as const
export type TerrainPattern = (typeof TERRAIN_PATTERNS)[number]

/** One layer of a column, from the top down. */
export interface TerrainStratum {
  /** A `TerrainMaterial.id`. */
  readonly material: string
  /** Metres. */
  readonly thickness: number
  /** Bars inside the layer: exposed at `cover`, they make the digging `resistance` times harder. */
  readonly reinforcement?: {
    readonly material: string
    readonly cover: number
    readonly spacing: number
    readonly resistance: number
    /** Joules on one spot of bare bars before they give way (default `DEFAULT_BAR_YIELD_JOULES`). */
    readonly yieldJoules?: number
    /** Metres across one bar (default `DEFAULT_BAR_DIAMETER`): with `yieldPa` it says what weight bare bars hold. */
    readonly diameter?: number
    /** Pascals at which the steel yields (default `DEFAULT_BAR_YIELD_PA`). */
    readonly yieldPa?: number
  }
}

/** Weight standing still on the ground: a body, a fridge, a car. */
export interface TerrainLoad {
  readonly x: number
  readonly z: number
  /** Metres: half the side of the footprint it stands on. */
  readonly radius: number
  readonly newtons: number
}

/** What a column of ground is made of. The strata end at the digging limit: under them nothing is removed. */
export interface TerrainProfile {
  readonly id: string
  readonly strata: readonly TerrainStratum[]
  /** A slab with nothing under it: where its bars give way the floor opens, and the ground is this many metres further down (the floor below). Without it the ground under the slab holds it up. */
  readonly drop?: number
  /** How the untouched top layer is drawn when it is not its material's way: bare rock is stone, but not laid as paving. Dug, the material's own shows. */
  readonly surfacePattern?: TerrainPattern
  /** Water standing over the column: the strata are its bed. */
  readonly water?: TerrainWater
}

export interface TerrainWater {
  /** A liquid of the fluids catalogue. */
  readonly liquid: string
  /** Metres from the surface to the bed. */
  readonly depth: number
  /** What is left of the walking speed, 0..1. */
  readonly drag: number
  /** Share of a blow that reaches the bed. */
  readonly blowShare: Partial<Record<TerrainBlow, number>>
}

export interface TerrainBudget {
  /** Side in metres of the squares that hold a limited number of marks. */
  readonly markAreaSize: number
  readonly maxMarksPerArea: number
  readonly maxMarks: number
  /** Chunks a renderer redraws per frame; the rest wait. */
  readonly maxDirtyChunksPerFrame: number
  readonly maxDebris: number
  /** Thrown pieces of one blow. */
  readonly maxDebrisPerBlow: number
  /** Cells checked for sliding per frame. */
  readonly maxSlideCellsPerFrame: number
  /** Cells on fire at once. */
  readonly maxBurningCells: number
  /** Stars of cracks kept; past it the oldest goes. */
  readonly maxCracks: number
  /** Cracks, prints, ruts, splats and ripples at once; past it the oldest goes. */
  readonly maxDecals: number
}

export interface TerrainOptions {
  /** World rectangle `[x0, z0, x1, z1]` in metres. */
  readonly bounds: readonly [number, number, number, number]
  /** Metres per cell (default 0.1). */
  readonly cellSize?: number
  /** Cells per side of a chunk (default 32). */
  readonly chunkCells?: number
  /** Which profile is where. */
  readonly layout?: GroundLayout
  /** Extra or overriding profiles, by id. */
  readonly profiles?: readonly TerrainProfile[]
  /** Extra or overriding materials, by id. */
  readonly materials?: readonly TerrainMaterial[]
  readonly budget?: Partial<TerrainBudget>
  /** Height of the untouched ground (default flat at 0). */
  readonly baseHeight?: (x: number, z: number) => number
  /** Metres per second squared. */
  readonly gravity?: number
  readonly seed?: number
  /**
   * Ground taken away from under the surface: a crater (`crater`), a slab that gave way into the void under it (`slab`), sand that slid off a slope
   * (`slide`). The host hands it to what stands there (`DestructionWorld.groundLoss`), so foundations over it settle or lose their support.
   */
  readonly onGroundLoss?: (loss: GroundLoss) => void
}

/** What is missing under a disc of the ground (`Terrain.voidUnder`). */
export interface TerrainVoid {
  /** Metres under the untouched surface at the deepest vertex. */
  readonly depth: number
  /** Metres under the untouched surface, averaged over the disc. */
  readonly mean: number
  /** 0..1, the share of the disc's vertices that are void (dug at least `VOID_MIN_DEPTH`). */
  readonly fraction: number
}

/** A fine mark: a bullet pock or a chip, smaller than a cell. It grows with the blows on it until it is dug into the height field. */
export interface TerrainMark {
  readonly id: number
  x: number
  z: number
  radius: number
  depth: number
  /** The material the mark shows at the bottom. */
  material: string
  blow: TerrainBlow
  /** Blows and marks merged into this one. */
  count: number
  /** Order of creation: the oldest is the one recycled. */
  born: number
}

export type TerrainDecalKind = 'crack' | 'print' | 'rut' | 'splat' | 'ripple'

/** A mark with no depth of its own: drawn over the surface, it changes nothing that stands there. */
export interface TerrainDecal {
  readonly id: number
  readonly kind: TerrainDecalKind
  readonly x: number
  readonly z: number
  readonly radius: number
  /** Radians around y. */
  readonly angle: number
  /** The material whose colour it takes. */
  readonly material: string
  /** Seconds it has been there; a ripple fades with it. */
  age: number
}

export interface TerrainDebris {
  readonly id: number
  readonly material: string
  readonly kind: TerrainDebrisKind
  readonly radius: number
  readonly position: [number, number, number]
  readonly velocity: [number, number, number]
  readonly spin: [number, number, number]
  atRest: boolean
  bounces: number
  /** Order of creation: the oldest is the one recycled. */
  readonly born: number
}

/** A star of cracks on a rigid surface. The lines themselves come from `crackLines`, drawn from the seed, so a snapshot keeps only this. */
export interface TerrainCrack {
  readonly id: number
  readonly x: number
  readonly z: number
  /** Metres the longest line runs. */
  reach: number
  /** Metres wide the lines are at the point. */
  width: number
  rays: number
  readonly seed: number
  readonly material: string
  /** Order of creation: the oldest is the one recycled. */
  readonly born: number
}

/** What a blow did. */
export interface TerrainBlowResult {
  readonly point: readonly [number, number, number]
  /** Bowl radius in metres; 0 when the blow left nothing. */
  readonly radius: number
  /** Metres removed at the point. */
  readonly depth: number
  /** Metres under the untouched surface the point is now. */
  readonly totalDepth: number
  /** Materials removed, top first, with the cubic metres of each. */
  readonly removed: readonly { readonly material: string; readonly volume: number }[]
  /** Material now exposed at the point. */
  readonly exposed: string
  /** The column has no more to give here: the slab's bottom, the end of the rock. */
  readonly atLimit: boolean
  /** Reinforcement is showing at the point. */
  readonly rebarExposed: boolean
  /** The bars gave way here and the slab opened (`TerrainProfile.drop`). */
  readonly collapsed: boolean
  /** Left a fine mark (`true`) or dug the height field (`false`). */
  readonly fine: boolean
  /** The cracks it opened or lengthened around the point, if the surface is rigid. */
  readonly crack?: TerrainCrack
  /** A contact charge broke the rigid layer right through (`TerrainMaterial.breach`). */
  readonly breached?: boolean
  /** The water the blow crossed: `level` is where the splash goes up. */
  readonly water?: { readonly liquid: string; readonly level: number }
}

/** The water standing at a point. */
export interface TerrainWaterHere {
  readonly liquid: string
  readonly level: number
  readonly depth: number
}

export interface TerrainRegion {
  readonly x: number
  readonly z: number
  readonly radius: number
}

export interface TerrainColumn {
  readonly profile: string
  readonly material: string
  readonly stratum: number
  /** Metres under the untouched surface. */
  readonly depth: number
  /** Metres that can still be dug here. */
  readonly remaining: number
  readonly scorch: number
  readonly loose: number
}

export interface TerrainStats {
  readonly marks: number
  readonly debris: number
  readonly debrisMoving: number
  readonly dirtyChunks: number
  readonly burning: number
}

export interface TerrainChunk {
  readonly index: number
  /** First column and row of the chunk's vertices. */
  readonly column: number
  readonly row: number
  readonly cells: number
  /** True while nothing touched it and it has one profile: one flat quad draws it. */
  readonly pristine: boolean
}

export interface Terrain {
  readonly bounds: readonly [number, number, number, number]
  readonly cellSize: number
  readonly columns: number
  readonly rows: number
  /** Vertices per row. */
  readonly stride: number
  readonly chunkCells: number
  readonly chunksX: number
  readonly chunksZ: number
  readonly budget: TerrainBudget
  /** Per vertex: metres removed under the untouched surface. */
  readonly dug: Float32Array
  /** Per vertex: metres of loose ground heaped on top. */
  readonly loose: Float32Array
  /** Per vertex: 0..1, how burnt. */
  readonly scorch: Float32Array
  /** Per vertex: how far the bare bars have given, 0 straight, 1 or more gone. */
  readonly barBend: Float32Array
  /** Per vertex: index in `profileList`. */
  readonly profileIndex: Uint8Array
  readonly profileList: readonly TerrainProfile[]
  material(id: string): TerrainMaterial
  layout(): GroundLayout
  setLayout(layout: GroundLayout): void
  /** Height at (x, z) as things stand on it. */
  heightAt(x: number, z: number): number
  /** Height of vertex (column, row). */
  vertexHeight(column: number, row: number): number
  /** Material exposed at a vertex. */
  vertexMaterial(column: number, row: number): TerrainMaterial
  columnAt(x: number, z: number): TerrainColumn
  contains(x: number, z: number): boolean
  /** First point of the ground along a ray, or null. */
  raycast(origin: readonly number[], direction: readonly number[], maxDistance: number): { point: [number, number, number]; distance: number; normal: [number, number, number] } | null
  /** A blow at (x, z). `energy` in joules, `direction` where it travels (it throws the pieces back along it). */
  strike(blow: TerrainBlow, spec: TerrainStrike): TerrainBlowResult
  /** A flame over a disc for `seconds`. */
  burn(spec: { x: number; z: number; radius: number; temperature: number; seconds: number }): void
  /** Applies a world hit (`Hit` of the destruction contract); null when it does nothing to the ground. */
  applyHit(hit: Hit): TerrainBlowResult | null
  /** What stands still on the ground now. Where it stands over bare bars they sag under it, and past what they hold they give way; a slab over a void then opens. True when it opened. */
  bear(loads: readonly TerrainLoad[]): boolean
  /** How much ground is missing under the disc (x, z, radius), measured from the untouched surface. */
  voidUnder(x: number, z: number, radius: number): TerrainVoid
  /** Height a foot stands at: the ground less what it sinks in. */
  footAt(x: number, z: number): number
  /** What is left of the walking speed here, 0..1. */
  walkFactorAt(x: number, z: number): number
  /** The water standing here, or null. */
  waterAt(x: number, z: number): TerrainWaterHere | null
  /** A foot or a wheel on the ground: it leaves its print where the ground keeps one, a ripple in water. False where it leaves nothing. */
  press(spec: { x: number; z: number; radius: number; angle?: number; kind?: 'print' | 'rut' }): boolean
  /** Rings on the water at (x, z). */
  ripple(x: number, z: number, radius: number): void
  decals(): readonly TerrainDecal[]
  /** Goes up when the decals change. */
  readonly decalsVersion: number
  /** Follow the ground changing: `region` is the disc it changed in. What rests there has lost its support and must look again. Returns the unsubscribe function. */
  onDeform(listener: (region: TerrainRegion) => void): () => void
  /** Moves the pieces, the sliding ground and the fire. */
  update(dt: number): void
  /** Chunks waiting to be redrawn; every chunk at once means the floor was just laid anew (a layout, a reset). */
  readonly dirtyChunkCount: number
  /** Takes up to the budget's chunks that changed since the last call. */
  drainDirtyChunks(max?: number): TerrainChunk[]
  chunk(index: number): TerrainChunk
  marks(): readonly TerrainMark[]
  cracks(): readonly TerrainCrack[]
  /** Changes whenever a crack is added or grows, so a renderer redraws only then. */
  readonly cracksVersion: number
  debris(): readonly TerrainDebris[]
  /** Cells on fire now, as world points. */
  burningPoints(): readonly (readonly [number, number])[]
  /** Goes up when the marks change. */
  readonly marksVersion: number
  stats(): TerrainStats
  /** Back to the untouched ground. */
  reset(): void
  serialize(): TerrainSnapshot
  load(snapshot: TerrainSnapshot): void
}

export interface TerrainSnapshot {
  readonly layout: GroundLayout
  readonly dug: readonly (readonly [number, number])[]
  readonly loose: readonly (readonly [number, number])[]
  readonly scorch: readonly (readonly [number, number])[]
  readonly barBend?: readonly (readonly [number, number])[]
  readonly marks: readonly TerrainMark[]
  readonly cracks?: readonly TerrainCrack[]
  readonly decals?: readonly TerrainDecal[]
}
