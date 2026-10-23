import type { Condition, GenerateOptions, Lod, PartKind, PlantMesh, PlantPiece, PlantSpec, Season, Vec3 } from './types'
import { materialKeyForPart, type MaterialKey } from './destruction'
import { Rng, toSeed } from './rng'
import { MeshBuilder } from './geometry/builder'
import type { ArchResult, Ctx, PieceMeta } from './ctx'
import { generateBroadleafTree } from './archetypes/broadleaf-tree'
import { generateDeadTree } from './archetypes/dead-tree'
import { generateFlowerPlant } from './archetypes/flower-plant'
import { generateGrassTuft } from './archetypes/grass-tuft'
import { generateFern } from './archetypes/fern'
import { generateRosette } from './archetypes/rosette'
import { generateColumnarCactus } from './archetypes/cactus-columnar'
import { generatePaddleCactus } from './archetypes/cactus-paddle'
import { generateGlobeCactus } from './archetypes/cactus-globe'
import { generatePalm } from './archetypes/palm'
import { generateBanana } from './archetypes/banana'
import { generateShrub } from './archetypes/shrub'
import { generateConifer } from './archetypes/conifer'
import { generateVine } from './archetypes/vine'
import { generatePotted } from './archetypes/potted'

type Gen = (spec: any, ctx: Ctx) => ArchResult

/** Registry of archetype generators. Filled in by each archetype module through `GENERATORS`. */
export const GENERATORS: Record<string, Gen> = {
  broadleaf_tree: generateBroadleafTree,
  dead_tree: generateDeadTree,
  flower_plant: generateFlowerPlant,
  grass_tuft: generateGrassTuft,
  fern: generateFern,
  rosette: generateRosette,
  columnar_cactus: generateColumnarCactus,
  paddle_cactus: generatePaddleCactus,
  globe_cactus: generateGlobeCactus,
  palm: generatePalm,
  banana: generateBanana,
  shrub: generateShrub,
  conifer: generateConifer,
  vine: generateVine,
  potted: generatePotted,
}

export function archetypes(): string[] {
  return Object.keys(GENERATORS)
}

/** Build a plant. Deterministic: same spec + seed + lod + condition + season => identical arrays. */
export function generate(spec: PlantSpec, opts: GenerateOptions = {}): PlantMesh {
  const gen = GENERATORS[spec.archetype]
  if (!gen) throw new Error(`game-vegetation: unknown archetype "${(spec as { archetype: string }).archetype}"`)
  const seed = toSeed(opts.seed)
  const lod: Lod = opts.lod ?? 0
  const condition: Condition = opts.condition ?? 'healthy'
  const season: Season = opts.season ?? 'spring'
  const scale = opts.scale ?? 1
  const pieceMeta = new Map<string, PieceMeta>()
  const treeLike = spec.archetype === 'broadleaf_tree' || spec.archetype === 'dead_tree' || spec.archetype === 'palm' || spec.archetype === 'conifer' || spec.archetype === 'banana'
  const rootId = treeLike ? 'trunk' : 'stem'
  const ctx: Ctx = {
    pieceMeta,
    piece(id, kind, parent, pivot) {
      if (!pieceMeta.has(id)) pieceMeta.set(id, { kind, parent, pivot })
      ctx.wood.tag = id
      ctx.foliage.tag = id
      ctx.flowers.tag = id
      ctx.spines.tag = id
    },
    rng: new Rng(seed),
    lod,
    condition,
    season,
    wood: new MeshBuilder(),
    foliage: new MeshBuilder(),
    flowers: new MeshBuilder(),
    fruit: new MeshBuilder(),
    spines: new MeshBuilder(),
    pick: (a, b, c) => (lod === 0 ? a : lod === 1 ? b : c),
  }
  ctx.piece(rootId, treeLike ? 'trunk' : 'stem')
  ctx.fruit.tag = 'fruit'
  if (!pieceMeta.has('fruit')) pieceMeta.set('fruit', { kind: 'fruit', parent: undefined })
  const res = gen(spec, ctx)
  const parts: PlantMesh['parts'] = {
    wood: ctx.wood.build('wood', 'wood'),
    foliage: ctx.foliage.build('foliage', res.foliageMaterial ?? 'foliage'),
    flowers: ctx.flowers.build('flowers', 'foliage'),
    fruit: ctx.fruit.build('fruit', 'foliage'),
    spines: ctx.spines.build('spines', 'cactus'),
  }
  const builders = { wood: ctx.wood, foliage: ctx.foliage, flowers: ctx.flowers, fruit: ctx.fruit, spines: ctx.spines }
  let radius = 0
  let height = 0
  let tris = 0
  for (const key of Object.keys(parts) as (keyof typeof parts)[]) {
    const m = parts[key]
    if (!m) {
      delete parts[key]
      continue
    }
    tris += m.triangleCount
    const pos = m.positions
    for (let i = 0; i < pos.length; i += 3) {
      if (scale !== 1) {
        pos[i] *= scale
        pos[i + 1] *= scale
        pos[i + 2] *= scale
      }
      if (pos[i + 1] < 0) pos[i + 1] = 0
      const r = Math.hypot(pos[i], pos[i + 2])
      if (r > radius) radius = r
      if (pos[i + 1] > height) height = pos[i + 1]
    }
  }
  const pieces = buildPieces(parts, builders, pieceMeta, rootId, condition, scale)
  const collider = res.collider ? { kind: 'cylinder' as const, radius: res.collider.radius * scale, height: res.collider.height * scale } : null
  return {
    parts,
    pieces,
    bounds: { radius, height },
    collider,
    bendable: res.bendable,
    thorny: !!res.thorny,
    seed,
    species: opts.species ?? spec.archetype,
    lod,
    triangleCount: tris,
    condition,
  }
}

const PART_ORDER: PartKind[] = ['wood', 'foliage', 'flowers', 'fruit', 'spines']

/** Turn the builders' tag ranges into pieces with ids, materials, pivots and bounds (positions already scaled). */
function buildPieces(parts: PlantMesh['parts'], builders: Record<PartKind, MeshBuilder>, meta: Map<string, PieceMeta>, rootId: string, condition: Condition, scale: number): PlantPiece[] {
  const primary = new Map<string, PartKind>()
  for (const part of PART_ORDER) {
    if (!parts[part]) continue
    for (const r of builders[part].ranges) if (!primary.has(r.tag || rootId)) primary.set(r.tag || rootId, part)
  }
  if (parts.fruit && builders.fruit.ranges.some((r) => r.tag === 'fruit')) primary.set('fruit', 'fruit')
  const idOf = (tag: string, part: PartKind): string => (primary.get(tag) === part ? tag : `${tag}:${part}`)
  const out: PlantPiece[] = []
  for (const part of PART_ORDER) {
    const mesh = parts[part]
    if (!mesh) continue
    for (const r of builders[part].ranges) {
      const tag = r.tag || rootId
      const m = meta.get(tag) ?? { kind: 'stem' as const }
      const min: Vec3 = [Infinity, Infinity, Infinity]
      const max: Vec3 = [-Infinity, -Infinity, -Infinity]
      for (let i = r.indexStart; i < r.indexStart + r.indexCount; i++) {
        const v = mesh.indices[i] * 3
        for (let a = 0; a < 3; a++) {
          const c = mesh.positions[v + a]
          if (c < min[a]) min[a] = c
          if (c > max[a]) max[a] = c
        }
      }
      let pivot: Vec3
      if (m.pivot) pivot = [m.pivot[0] * scale, Math.max(0, m.pivot[1] * scale), m.pivot[2] * scale]
      else if (m.kind === 'crown' || m.kind === 'fruit') pivot = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
      else pivot = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2]
      if (m.kind === 'trunk' || m.kind === 'stem' || m.kind === 'pot' || m.kind === 'soil') pivot = [0, min[1], 0]
      let material: MaterialKey = materialKeyForPart(part, mesh.material, condition)
      if (m.kind === 'pot') material = 'pot'
      else if (m.kind === 'soil') material = 'soil'
      const parentId = m.parent !== undefined && primary.has(m.parent) ? idOf(m.parent, primary.get(m.parent)!) : undefined
      out.push({
        id: idOf(tag, part),
        kind: m.kind,
        material,
        ...(parentId === undefined ? {} : { parent: parentId }),
        part,
        indexStart: r.indexStart,
        indexCount: r.indexCount,
        pivot,
        bounds: { min, max },
      })
    }
  }
  return out
}
