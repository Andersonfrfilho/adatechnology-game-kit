import type { PieceGeometry, Collider, Condition, DamageMaterial, Lod, PieceKind, Season, Vec3 } from './types'
import type { Rng } from './rng'
import type { MeshBuilder } from './geometry/builder'

/** Everything an archetype generator needs. Generators write into the part builders. */
export interface Ctx {
  rng: Rng
  lod: Lod
  condition: Condition
  season: Season
  wood: MeshBuilder
  foliage: MeshBuilder
  flowers: MeshBuilder
  fruit: MeshBuilder
  spines: MeshBuilder
  /** piece metadata by tag, filled by `piece()` */
  pieceMeta: Map<string, PieceMeta>
  /**
   * Start (or resume) the separable piece `id`: geometry emitted into wood, foliage, flowers and spines from now on belongs to it.
   * Fruit always goes to the 'fruit' piece. Pieces need not be emitted contiguously; builders group them when building.
   */
  piece(id: string, kind: PieceKind, parent?: string, pivot?: Vec3): void
  /**
   * Run `draw` as one separable fruit piece (`fruitN`, kind 'fruit'): everything it emits (the fruit itself and its wood stalk) belongs to it.
   * The parent (nearest branch / crown / pad / trunk) and the pivot are worked out by `generate()` afterwards.
   */
  /** attach explicit geometry (unscaled) to the piece `id`, overriding what `generate()` derives from the tubes (pads) */
  pieceGeom(id: string, geom: PieceGeometry): void
  fruitItem(draw: () => void): void
  /** pick a value by lod: lod0, lod1, lod2 */
  pick<T>(a: T, b: T, c: T): T
}

export interface PieceMeta {
  kind: PieceKind
  geom?: PieceGeometry
  parent?: string
  pivot?: Vec3
}

export interface ArchResult {
  collider: Collider
  /** foliage / grass / flowers bend away from actors */
  bendable: boolean
  /** collider hurts (cacti) */
  thorny?: boolean
  /** damage material of the foliage part (cacti: 'cactus') */
  foliageMaterial?: DamageMaterial
}
