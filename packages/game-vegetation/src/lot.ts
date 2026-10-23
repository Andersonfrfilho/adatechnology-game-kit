import type { Condition, GenerateOptions, Lod, MeshData, Placement, PlantSpec, Season } from './types'
import { generate } from './generate'
import { MeshBuilder } from './geometry/builder'
import { hashMix, toSeed } from './rng'

export interface LotColliderData {
  x: number
  z: number
  r: number
  h: number
  damage?: 'thorns'
}

export interface Lot {
  meshes: { wood?: MeshData; foliage?: MeshData; flowers?: MeshData }
  /** trunks only; foliage, flowers and grass never collide */
  colliders: LotColliderData[]
  triangleCount: number
  plantCount: number
}

export interface BuildLotOptions {
  seed?: number | string
  /** 'game' uses LOD1 for every plant; 'high' uses `lod` (default 0) */
  quality: 'high' | 'game'
  lod?: Lod
  condition?: Condition
  season?: Season
}

/**
 * Merge every plant of an area into at most 3 meshes (wood + spines, foliage, flowers + fruit), with every vertex
 * already transformed by its placement (x, z, ry, scale). Engine agnostic.
 */
export function buildLot(placements: Placement[], resolveSpec: (id: string) => PlantSpec, opts: BuildLotOptions): Lot {
  const lod: Lod = opts.quality === 'game' ? 1 : (opts.lod ?? 0)
  const base = toSeed(opts.seed)
  const wood = new MeshBuilder()
  const foliage = new MeshBuilder()
  const flowers = new MeshBuilder()
  const colliders: LotColliderData[] = []
  const cache = new Map<string, PlantSpec>()
  for (const p of placements) {
    let spec = cache.get(p.species)
    if (!spec) {
      spec = resolveSpec(p.species)
      cache.set(p.species, spec)
    }
    const go: GenerateOptions = { seed: hashMix(base, p.seed), lod, condition: opts.condition, season: opts.season }
    const plant = generate(spec, go)
    const { parts } = plant
    if (parts.wood) wood.appendMesh(parts.wood, p.x, 0, p.z, p.ry, p.scale)
    if (parts.spines) wood.appendMesh(parts.spines, p.x, 0, p.z, p.ry, p.scale)
    if (parts.foliage) foliage.appendMesh(parts.foliage, p.x, 0, p.z, p.ry, p.scale)
    if (parts.flowers) flowers.appendMesh(parts.flowers, p.x, 0, p.z, p.ry, p.scale)
    if (parts.fruit) flowers.appendMesh(parts.fruit, p.x, 0, p.z, p.ry, p.scale)
    if (plant.collider) {
      const c: LotColliderData = { x: p.x, z: p.z, r: plant.collider.radius * p.scale, h: plant.collider.height * p.scale }
      if (plant.thorny) c.damage = 'thorns'
      colliders.push(c)
    }
  }
  const meshes: Lot['meshes'] = {
    wood: wood.build('wood', 'wood'),
    foliage: foliage.build('foliage', 'foliage'),
    flowers: flowers.build('flowers', 'foliage'),
  }
  for (const k of Object.keys(meshes) as (keyof Lot['meshes'])[]) if (!meshes[k]) delete meshes[k]
  const triangleCount = (meshes.wood?.triangleCount ?? 0) + (meshes.foliage?.triangleCount ?? 0) + (meshes.flowers?.triangleCount ?? 0)
  return { meshes, colliders, triangleCount, plantCount: placements.length }
}
