import type { MaterialKey } from './destruction'
/** Condition of a plant (generic: drought, neglect). Genre packs decide which to use. */
export type Condition = 'healthy' | 'dry' | 'dead' | 'overgrown'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Lod = 0 | 1 | 2
export type Vec3 = [number, number, number]

/** Which kind of surface a mesh part is made of (a host maps it to its own damage / sound / material tables). */
export type DamageMaterial = 'wood' | 'foliage' | 'cactus'
export type PartKind = 'wood' | 'foliage' | 'flowers' | 'fruit' | 'spines'

export interface MeshData {
  /** xyz, meters, origin at the plant base center, +y up */
  positions: Float32Array
  normals: Float32Array
  /** rgb 0..1, linear, already shaded (AO at base / inside, lighter tips) */
  colors: Float32Array
  /** 1 float per vertex, 0..1: how much this vertex moves with wind (0 at ground / trunk base, ~1 at leaf tips) */
  sway: Float32Array
  indices: Uint32Array
  triangleCount: number
  /** which part this is */
  kind: PartKind
  /** damage material tag for the host */
  material: DamageMaterial
}

/** Kind of a separable piece (see `PlantMesh.pieces`). */
export type PieceKind = 'trunk' | 'branch' | 'crown' | 'pot' | 'soil' | 'fruit' | 'pad' | 'arm' | 'stem'

/**
 * A separable piece of a plant: a contiguous triangle range of one part's MeshData. A logical piece that spans several
 * parts (e.g. a crown with leaves and flowers) is one entry per part; the entries after the first get the id `<id>:<part>`.
 */
export interface PlantPiece {
  /** unique within the plant */
  id: string
  kind: PieceKind
  /** key into the destruction material table (see MaterialIds), e.g. 'wood', 'woodDry', 'foliage', 'ceramic' is key 'pot' */
  material: MaterialKey
  /** id of the piece this one hangs from (a crown hangs from its branch, a branch from the trunk) */
  parent?: string
  /** the MeshData the range belongs to */
  part: PartKind
  /** first index in `parts[part].indices` (a multiple of 3) */
  indexStart: number
  /** number of indices (3 per triangle) */
  indexCount: number
  /** point the piece rotates about when it falls (plant space, meters): where it is attached, or its center */
  pivot: Vec3
  bounds: { min: Vec3; max: Vec3 }
  /** wood pieces (trunk, branch, stem, arm, pad): the radius of the body of the piece, away from the root flare and the tip, in meters */
  radius?: number
  /** wood pieces: the length of the centreline, in meters */
  length?: number
  /** wood pieces: unit vector from the first to the last point of the centreline */
  axis?: Vec3
  /** wood pieces: the first point of the centreline (plant space), the end the piece hangs from */
  base?: Vec3
}

/** The straight-tube fit of a wood piece (what a chopping or sawing rule needs: how thick, how long, which way). */
export interface PieceGeometry {
  radius: number
  length: number
  axis: Vec3
  base: Vec3
}

export interface PlantParts {
  wood?: MeshData
  foliage?: MeshData
  flowers?: MeshData
  fruit?: MeshData
  spines?: MeshData
}

export type Collider = { kind: 'cylinder'; radius: number; height: number } | null

export interface PlantMesh {
  parts: PlantParts
  /** separable pieces; together they cover every triangle of every part exactly once */
  pieces: PlantPiece[]
  bounds: { radius: number; height: number }
  /** only trunk / stem / cactus body collides; foliage never blocks the player */
  collider: Collider
  /** foliage / grass / flowers should bend away from actors (shader uniform), not block */
  bendable: boolean
  /** true when the collider hurts (cacti) */
  thorny: boolean
  seed: number
  species: string
  lod: Lod
  triangleCount: number
  /** condition the plant was generated with (decides dry wood vs green wood in the destruction material mapping) */
  condition?: Condition
}

export interface GenerateOptions {
  seed?: number | string
  lod?: Lod
  condition?: Condition
  /** default 'spring' (blooming trees such as ipe show their flowers; pass 'summer' for green) */
  season?: Season
  /** uniform scale applied to the finished mesh (default 1) */
  scale?: number
  /** species id recorded in `PlantMesh.species` (default: the archetype) */
  species?: string
}

/** Colors in specs are 0xRRGGBB integers (sRGB). */
export type Color = number

export interface FruitSpec {
  colors: Color[]
  count: number
  radius?: number
  /** fruit sits on the trunk and big branches (jabuticaba) instead of hanging from the crown */
  onTrunk?: boolean
}
export interface BloomSpec {
  colors: Color[]
  /** seasons in which the bloom is visible (default spring, summer) */
  seasons?: Season[]
  /** the crown turns into flowers instead of leaves while blooming (ipe, flamboyant) */
  replacesLeaves?: boolean
  /** 0..1 share of the crown covered (default 0.85) */
  density?: number
}

export type CrownShape = 'round' | 'spreading' | 'columnar' | 'weeping'
/**
 * Foliage composition of a broadleaf tree (the branch skeleton follows it):
 * `dome` wide dense dome lower than wide (mango), `lumpy` irregular spreading clumps with visible branches (oak),
 * `cloud` a few big rounded clumps with gaps (fruit trees), `sphere` clipped lollipop (street ficus),
 * `umbrella` wide flat layered crown (flamboyant), `willow` arching branches with long hanging curtains,
 * `sparse_high` thin high irregular crown on a tall bare trunk (eucalyptus).
 */
export type CrownStyle = 'dome' | 'lumpy' | 'cloud' | 'sphere' | 'umbrella' | 'willow' | 'sparse_high'

export interface BroadleafTreeSpec {
  archetype: 'broadleaf_tree'
  height?: number
  trunkRadius?: number
  crownRadius?: number
  crownShape?: CrownShape
  branchLevels?: number
  leafColor?: Color[]
  barkColor?: Color
  fruit?: FruitSpec
  bloom?: BloomSpec
  deciduous?: boolean
  /** share of the height that is bare trunk (default depends on crown shape) */
  trunkFraction?: number
  /** 0..1 crown density (default 1) */
  density?: number
  /** small elongated leaves (eucalyptus, willow) */
  leafShape?: 'clump' | 'sparse'
  /** clipped, perfectly round crown (street ficus) */
  clipped?: boolean
  /** foliage composition, see CrownStyle (default: legacy merged clumps) */
  crownStyle?: CrownStyle
  /** clump size multiplier for crownStyle (default 1) */
  clumpSize?: number
}
export interface DeadTreeSpec {
  archetype: 'dead_tree'
  height?: number
  trunkRadius?: number
  crownRadius?: number
  barkColor?: Color
  branchLevels?: number
}
export interface PalmSpec {
  archetype: 'palm'
  variant?: 'coconut' | 'royal' | 'fan' | 'areca' | 'date'
  height?: number
  trunkRadius?: number
  frondCount?: number
  frondLength?: number
  leafColor?: Color
  trunkColor?: Color
  lean?: number
  /** number of stems for clumping palms (areca) */
  stems?: number
  fruit?: { color: Color; count: number; radius?: number }
}
export interface BananaSpec {
  archetype: 'banana'
  height?: number
  leafCount?: number
  leafColor?: Color
  torn?: number
  bunch?: boolean
  bud?: boolean
}
export interface ConiferSpec {
  archetype: 'conifer'
  height?: number
  radius?: number
  tiers?: number
  shape?: 'cone' | 'candelabra'
  leafColor?: Color
  barkColor?: Color
  trunkRadius?: number
}
export interface ShrubFlowers {
  colors: Color[]
  count?: number
  style?: 'dots' | 'clusters' | 'hibiscus' | 'bell'
  size?: number
}
export interface ShrubSpec {
  archetype: 'shrub'
  height?: number
  radius?: number
  density?: number
  shape?: 'round' | 'hedge' | 'loose'
  /** hedge length (along x) */
  length?: number
  width?: number
  leafColor?: Color[]
  stemColor?: Color
  flowers?: ShrubFlowers
  /** leaf color of new growth, mixed on the clump tops (croton: yellow / red / green) */
  variegation?: Color[]
  leafSize?: number
}
export type FlowerType = 'daisy' | 'rose' | 'tulip' | 'sunflower' | 'hibiscus' | 'cluster' | 'lily' | 'bird_of_paradise' | 'pompom' | 'hydrangea'
export interface FlowerPlantSpec {
  archetype: 'flower_plant'
  flowerType?: FlowerType
  stemCount?: number
  height?: number
  petalColors?: Color[]
  centerColor?: Color
  leafColor?: Color
  /** bushy low plant with many leaves (rose bush, periwinkle) */
  bushy?: boolean
  flowerSize?: number
  /** low spreading mat (periwinkle) */
  spreading?: boolean
}
export interface GrassTuftSpec {
  archetype: 'grass_tuft'
  count?: number
  height?: number
  color?: Color
  seedHeads?: boolean
  /** papyrus style: bare stems topped by umbrellas of thin rays */
  umbrellaHeads?: boolean
  seedColor?: Color
  radius?: number
}
export interface FernSpec {
  archetype: 'fern'
  frondCount?: number
  frondLength?: number
  color?: Color
}
export interface RosetteSpec {
  archetype: 'rosette'
  form?: 'agave' | 'sword' | 'aloe' | 'echeveria'
  leafCount?: number
  height?: number
  color?: Color
  edgeColor?: Color
  /** flower stalk (aloe) */
  bloom?: { color: Color }
}
export interface ColumnarCactusSpec {
  archetype: 'columnar_cactus'
  height?: number
  radius?: number
  ribs?: number
  arms?: number | [number, number]
  armStyle?: 'candelabra' | 'saguaro' | 'sprawl'
  color?: Color
  spineColor?: Color
  flowers?: { color: Color; count?: number }
}
export interface PaddleCactusSpec {
  archetype: 'paddle_cactus'
  height?: number
  padSize?: number
  generations?: number
  color?: Color
  fruit?: { color: Color; count: number }
  flowers?: { color: Color; count: number }
}
export interface GlobeCactusSpec {
  archetype: 'globe_cactus'
  radius?: number
  height?: number
  ribs?: number
  color?: Color
  spineColor?: Color
  cephalium?: { color: Color }
  flowers?: { color: Color; count?: number }
}
export interface VineSpec {
  archetype: 'vine'
  /** polyline in meters (host provides), or a wall rectangle in the xy plane facing +z */
  host?: { path: Vec3[] } | { wall: { width: number; height: number } }
  leafColor?: Color
  stemColor?: Color
  flowers?: { colors: Color[]; style?: 'bract' | 'passion'; count?: number }
  leafSize?: number
  /** leaf density multiplier */
  density?: number
}
export interface PotSpec {
  shape?: 'terracotta' | 'cylinder' | 'square' | 'cachepot'
  radius?: number
  height?: number
  color?: Color
}
export interface PottedSpec {
  archetype: 'potted'
  pot?: PotSpec
  plant: PlantSpec
}

export type PlantSpec =
  | BroadleafTreeSpec
  | DeadTreeSpec
  | PalmSpec
  | BananaSpec
  | ConiferSpec
  | ShrubSpec
  | FlowerPlantSpec
  | GrassTuftSpec
  | FernSpec
  | RosetteSpec
  | ColumnarCactusSpec
  | PaddleCactusSpec
  | GlobeCactusSpec
  | VineSpec
  | PottedSpec

export type Archetype = PlantSpec['archetype']

export interface Placement {
  species: string
  x: number
  z: number
  ry: number
  scale: number
  seed: number
}
