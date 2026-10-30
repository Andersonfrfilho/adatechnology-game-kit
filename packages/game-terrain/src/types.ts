import type { GroundLayout, Hit } from '@adatechnology/game-contracts'

export type { GroundLayout, GroundZone } from '@adatechnology/game-contracts'

/** The blows that remove ground. Fire and heat char it instead (`TerrainMaterial.fire`). */
export type TerrainBlow = 'ballistic' | 'blunt' | 'slash' | 'explosive'

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

export type TerrainDebrisKind = 'clods' | 'chips' | 'shards' | 'splinters' | 'dust'

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

export const TERRAIN_PATTERNS = ['plain', 'grass', 'soil', 'sand', 'asphalt', 'concrete', 'tile', 'planks', 'stone'] as const
export type TerrainPattern = (typeof TERRAIN_PATTERNS)[number]

/** One layer of a column, from the top down. */
export interface TerrainStratum {
  /** A `TerrainMaterial.id`. */
  readonly material: string
  /** Metres. */
  readonly thickness: number
  /** Bars inside the layer: exposed at `cover`, they make the digging `resistance` times harder. */
  readonly reinforcement?: { readonly material: string; readonly cover: number; readonly spacing: number; readonly resistance: number }
}

/** What a column of ground is made of. The strata end at the digging limit: under them nothing is removed. */
export interface TerrainProfile {
  readonly id: string
  readonly strata: readonly TerrainStratum[]
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
  /** Left a fine mark (`true`) or dug the height field (`false`). */
  readonly fine: boolean
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
  strike(blow: TerrainBlow, spec: { x: number; z: number; energy: number; direction?: readonly number[]; contactRadius?: number }): TerrainBlowResult
  /** A flame over a disc for `seconds`. */
  burn(spec: { x: number; z: number; radius: number; temperature: number; seconds: number }): void
  /** Applies a world hit (`Hit` of the destruction contract); null when it does nothing to the ground. */
  applyHit(hit: Hit): TerrainBlowResult | null
  /** Follow the ground changing: `region` is the disc it changed in. What rests there has lost its support and must look again. Returns the unsubscribe function. */
  onDeform(listener: (region: TerrainRegion) => void): () => void
  /** Moves the pieces, the sliding ground and the fire. */
  update(dt: number): void
  /** Takes up to the budget's chunks that changed since the last call. */
  drainDirtyChunks(max?: number): TerrainChunk[]
  chunk(index: number): TerrainChunk
  marks(): readonly TerrainMark[]
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
  readonly marks: readonly TerrainMark[]
}
