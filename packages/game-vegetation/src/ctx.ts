import type { Collider, Condition, DamageMaterial, Lod, Season } from './types'
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
  /** pick a value by lod: lod0, lod1, lod2 */
  pick<T>(a: T, b: T, c: T): T
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
