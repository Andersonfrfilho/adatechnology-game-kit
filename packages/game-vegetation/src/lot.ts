import type { Condition, GenerateOptions, Lod, MeshData, PartKind, PieceKind, Placement, PlantMesh, PlantSpec, Season } from './types'
import type { MaterialKey } from './destruction'
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

/** One separable piece of a plant inside the merged lot meshes. */
export interface LotPiece {
  id: string
  kind: PieceKind
  parent?: string
  /** the plant part the piece comes from */
  part: PartKind
  /** which merged mesh holds it (spines go to 'wood', fruit to 'flowers') */
  mesh: 'wood' | 'foliage' | 'flowers'
  /** triangle index range in `lot.meshes[mesh].indices` (a multiple of 3) */
  indexStart: number
  indexCount: number
  /** key of the destruction material table (see MaterialIds) */
  material: MaterialKey
}
export interface LotPlantPieces {
  /** index into the `placements` array given to buildLot */
  plantIndex: number
  species: string
  x: number
  z: number
  ry: number
  scale: number
  lod: Lod
  pieces: LotPiece[]
  /** what is needed to regenerate the same plant as a separable object (see extractPlant) */
  spec: PlantSpec
  generateOptions: GenerateOptions
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
  /** one entry per plant that made it into the meshes (thinned grass is absent), see extractPlant / hideLotPlant */
  pieceTable: LotPlantPieces[]
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
  const kept: { plantIndex: number; e: (typeof entries)[number] }[] = []
  for (let pi = 0; pi < entries.length; pi++) {
    const e = entries[pi]
    const { p, plant, dropped } = e
    if (dropped) continue
    kept.push({ plantIndex: pi, e })
    lodCounts[plant.lod]++
    const { parts } = plant
    // every triangle is tagged "<plantIndex>|<piece id>" so the merged builders report the piece ranges
    const tagsOf = (part: PartKind): ((t: number) => string) | undefined => {
      const mesh = parts[part]
      if (!mesh) return undefined
      const tags = new Array<string>(mesh.triangleCount).fill('')
      for (const pc of plant.pieces) {
        if (pc.part !== part) continue
        for (let t = pc.indexStart / 3; t < (pc.indexStart + pc.indexCount) / 3; t++) tags[t] = `${pi}|${pc.id}`
      }
      return (t) => tags[t]
    }
    if (parts.wood) wood.appendMesh(parts.wood, p.x, 0, p.z, p.ry, p.scale, tagsOf('wood'))
    if (parts.spines) wood.appendMesh(parts.spines, p.x, 0, p.z, p.ry, p.scale, tagsOf('spines'))
    if (parts.foliage) foliage.appendMesh(parts.foliage, p.x, 0, p.z, p.ry, p.scale, tagsOf('foliage'))
    if (parts.flowers) flowers.appendMesh(parts.flowers, p.x, 0, p.z, p.ry, p.scale, tagsOf('flowers'))
    if (parts.fruit) flowers.appendMesh(parts.fruit, p.x, 0, p.z, p.ry, p.scale, tagsOf('fruit'))
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
  const rangeOf = new Map<string, { mesh: 'wood' | 'foliage' | 'flowers'; indexStart: number; indexCount: number }>()
  for (const [mesh, b] of [['wood', wood], ['foliage', foliage], ['flowers', flowers]] as const) {
    for (const r of b.ranges) if (r.tag) rangeOf.set(r.tag, { mesh, indexStart: r.indexStart, indexCount: r.indexCount })
  }
  const pieceTable: LotPlantPieces[] = kept.map(({ plantIndex, e }) => ({
    plantIndex,
    species: e.p.species,
    x: e.p.x,
    z: e.p.z,
    ry: e.p.ry,
    scale: e.p.scale,
    lod: e.plant.lod,
    spec: e.spec,
    generateOptions: { ...e.go, lod: e.plant.lod },
    pieces: e.plant.pieces.map((pc) => {
      const r = rangeOf.get(`${plantIndex}|${pc.id}`)!
      return { id: pc.id, kind: pc.kind, ...(pc.parent === undefined ? {} : { parent: pc.parent }), part: pc.part, mesh: r.mesh, indexStart: r.indexStart, indexCount: r.indexCount, material: pc.material }
    }),
  }))
  const triangleCount = (meshes.wood?.triangleCount ?? 0) + (meshes.foliage?.triangleCount ?? 0) + (meshes.flowers?.triangleCount ?? 0)
  return { meshes, colliders, triangleCount, plantCount: placements.length, thinnedCount: thinned, lodCounts, condition: opts.condition ?? 'healthy', pieceTable }
}

export interface ExtractedPlant {
  /** the plant regenerated with the exact options used in the lot (same LOD, same seed): identical geometry, plus its pieces */
  plant: PlantMesh
  /** where the plant stood in the lot: build the separable object with position (x, 0, z), rotation.y = ry and scale */
  placement: { species: string; x: number; z: number; ry: number; scale: number }
  /** the index ranges the plant occupies in the merged meshes */
  ranges: LotPiece[]
}

function entryOf(lot: Lot, plantIndex: number): LotPlantPieces {
  const e = lot.pieceTable.find((t) => t.plantIndex === plantIndex)
  if (!e) throw new Error(`game-vegetation: plant ${plantIndex} is not in the lot (thinned out or out of range)`)
  return e
}

/**
 * Get a plant of the lot back as a stand-alone `PlantMesh` (with `pieces`) plus its placement, to spawn a separable version
 * (`createPlantObject(THREE, plant, mats, { separable: true })`) when the merged plant gets hit. Does not touch the lot.
 */
export function extractPlant(lot: Lot, plantIndex: number): ExtractedPlant {
  const e = entryOf(lot, plantIndex)
  return {
    plant: generate(e.spec, { ...e.generateOptions, species: e.species }),
    placement: { species: e.species, x: e.x, z: e.z, ry: e.ry, scale: e.scale },
    ranges: e.pieces,
  }
}

/**
 * Make a plant of the lot invisible by zeroing its index ranges in the merged meshes (degenerate triangles). Idempotent.
 * The indices array is shared with the three BufferGeometry, so set `geometry.index.needsUpdate = true` afterwards
 * (`removeLotPlant` in game-vegetation/three does that). Returns the ranges that were cleared.
 */
export function hideLotPlant(lot: Lot, plantIndex: number): LotPiece[] {
  const e = entryOf(lot, plantIndex)
  for (const r of e.pieces) {
    const m = lot.meshes[r.mesh]
    if (m) m.indices.fill(0, r.indexStart, r.indexStart + r.indexCount)
  }
  return e.pieces
}
