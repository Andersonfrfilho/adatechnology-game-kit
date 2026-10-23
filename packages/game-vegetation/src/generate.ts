import type { Condition, GenerateOptions, Lod, PlantMesh, PlantSpec, Season } from './types'
import { Rng, toSeed } from './rng'
import { MeshBuilder } from './geometry/builder'
import type { ArchResult, Ctx } from './ctx'
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
  const ctx: Ctx = {
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
  const res = gen(spec, ctx)
  const parts: PlantMesh['parts'] = {
    wood: ctx.wood.build('wood', 'wood'),
    foliage: ctx.foliage.build('foliage', res.foliageMaterial ?? 'foliage'),
    flowers: ctx.flowers.build('flowers', 'foliage'),
    fruit: ctx.fruit.build('fruit', 'foliage'),
    spines: ctx.spines.build('spines', 'cactus'),
  }
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
  const collider = res.collider ? { kind: 'cylinder' as const, radius: res.collider.radius * scale, height: res.collider.height * scale } : null
  return {
    parts,
    bounds: { radius, height },
    collider,
    bendable: res.bendable,
    thorny: !!res.thorny,
    seed,
    species: opts.species ?? spec.archetype,
    lod,
    triangleCount: tris,
  }
}
