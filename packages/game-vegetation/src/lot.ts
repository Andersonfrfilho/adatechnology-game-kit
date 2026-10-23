import type { Condition, GenerateOptions, Lod, MeshData, Placement, PlantMesh, PlantSpec, Season } from './types'
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
  /**
   * LOD used for small plants (grass tufts, small flowers, ferns...) so a yard full of them stays cheap.
   * Default: 2 in 'game' quality, `lod` (0 unless set) in 'high' quality. Set it equal to the main LOD to disable.
   */
  smallPlantsLod?: Lod
  /** plants not taller than this (meters, after placement scale) count as small (default 0.7) */
  smallPlantMaxHeight?: number
  /**
   * Soft triangle cap for the whole lot. When the plants exceed it, the smallest ones are switched to LOD2 (smallest
   * first, trees last) until the lot fits. Default: 20000 in 'game' quality, unlimited in 'high' quality.
   */
  triangleBudget?: number
}

/**
 * Merge every plant of an area into at most 3 meshes (wood + spines, foliage, flowers + fruit), with every vertex
 * already transformed by its placement (x, z, ry, scale). Engine agnostic.
 */
export function buildLot(placements: Placement[], resolveSpec: (id: string) => PlantSpec, opts: BuildLotOptions): Lot {
  const lod: Lod = opts.quality === 'game' ? 1 : (opts.lod ?? 0)
  const smallLod: Lod = opts.smallPlantsLod ?? (opts.quality === 'game' ? 2 : lod)
  const smallMax = opts.smallPlantMaxHeight ?? 0.8
  const budget = opts.triangleBudget ?? (opts.quality === 'game' ? 20000 : Infinity)
  const base = toSeed(opts.seed)
  const wood = new MeshBuilder()
  const foliage = new MeshBuilder()
  const flowers = new MeshBuilder()
  const colliders: LotColliderData[] = []
  const cache = new Map<string, PlantSpec>()
  const entries: { p: Placement; plant: PlantMesh; go: GenerateOptions; spec: PlantSpec }[] = []
  let total = 0
  for (const p of placements) {
    let spec = cache.get(p.species)
    if (!spec) {
      spec = resolveSpec(p.species)
      cache.set(p.species, spec)
    }
    const go: GenerateOptions = { seed: hashMix(base, p.seed), lod, condition: opts.condition, season: opts.season }
    let plant: PlantMesh | undefined
    if (smallLod !== lod) {
      // small plants (judged by the cheap version) use the cheap LOD
      const cheap = generate(spec, { ...go, lod: smallLod })
      if (cheap.bounds.height * p.scale <= smallMax) plant = cheap
    }
    plant ??= generate(spec, go)
    total += plant.triangleCount
    entries.push({ p, plant, go, spec })
  }
  if (total > budget) {
    // over budget: drop the smallest plants still above LOD2 to LOD2 until the lot fits
    const order = entries.map((e, i) => i).filter((i) => entries[i].plant.lod < 2).sort((a, b) => entries[a].plant.bounds.height * entries[a].p.scale - entries[b].plant.bounds.height * entries[b].p.scale)
    for (const i of order) {
      if (total <= budget) break
      const e = entries[i]
      const cheap = generate(e.spec, { ...e.go, lod: 2 })
      total += cheap.triangleCount - e.plant.triangleCount
      e.plant = cheap
    }
  }
  for (const { p, plant } of entries) {
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
