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
  /** grass tufts left out to meet the triangle budget */
  thinnedCount: number
  /** plants kept at LOD0, LOD1 and LOD2 */
  lodCounts: [number, number, number]
  /** condition the lot was built with (default 'healthy') */
  condition?: Condition
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
   * Soft triangle cap for the whole lot. When the plants exceed it: some grass tufts are left out first, then small
   * plants, then shrubs / hedges, and only then trees and palms are switched to LOD2 (smallest first) until the lot fits. Default: 20000 in 'game' quality, unlimited in 'high' quality.
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
  const entries: { p: Placement; plant: PlantMesh; go: GenerateOptions; spec: PlantSpec; dropped?: boolean }[] = []
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
  let thinned = 0
  if (total > budget) {
    const kindOf = (e: (typeof entries)[number]): number => {
      const a = e.spec.archetype
      if (a === 'grass_tuft' && e.plant.bounds.height * e.p.scale < 1) return 0
      if (a === 'broadleaf_tree' || a === 'conifer' || a === 'dead_tree' || a === 'palm' || a === 'banana') return 3
      return e.plant.bounds.height * e.p.scale <= smallMax ? 1 : 2
    }
    const cost = (e: (typeof entries)[number]): number => e.plant.triangleCount
    // 1) thin out grass tufts and weeds (a deterministic share, in hash order): they are tiny
    const grass = entries.filter((e) => kindOf(e) === 0).sort((a, b) => hashMix(a.p.seed, 7) - hashMix(b.p.seed, 7))
    const keepMin = Math.ceil(grass.length * 0.2)
    for (let i = 0; i < grass.length - keepMin && total > budget; i++) {
      total -= cost(grass[i])
      grass[i].dropped = true
      thinned++
    }
    // 2..4) small plants, then shrubs / hedges / the rest, then trees and palms: drop to LOD2, smallest first
    for (const kind of [1, 2, 3]) {
      const group = entries.filter((e) => !e.dropped && kindOf(e) === kind && e.plant.lod < 2).sort((a, b) => a.plant.bounds.height * a.p.scale - b.plant.bounds.height * b.p.scale)
      for (const e of group) {
        if (total <= budget) break
        const cheap = generate(e.spec, { ...e.go, lod: 2 })
        total += cheap.triangleCount - e.plant.triangleCount
        e.plant = cheap
      }
    }
  }
  const lodCounts: [number, number, number] = [0, 0, 0]
  for (const { p, plant, dropped } of entries) {
    if (dropped) continue
    lodCounts[plant.lod]++
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
  return { meshes, colliders, triangleCount, plantCount: placements.length, thinnedCount: thinned, lodCounts, condition: opts.condition ?? 'healthy' }
}
