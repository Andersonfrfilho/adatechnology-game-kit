import type { Condition, GenerateOptions, Lod, PartKind, PieceKind, PlantMesh, PlantPiece, PlantSpec, Season, Vec3 } from './types'
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
  let fruitCount = 0
  const ctx: Ctx = {
    pieceMeta,
    piece(id, kind, parent, pivot) {
      if (!pieceMeta.has(id)) pieceMeta.set(id, { kind, parent, pivot })
      ctx.wood.tag = id
      ctx.foliage.tag = id
      ctx.flowers.tag = id
      ctx.spines.tag = id
    },
    fruitItem(draw) {
      const id = `fruit${fruitCount++}`
      pieceMeta.set(id, { kind: 'fruit', parent: undefined })
      const saved = [ctx.wood.tag, ctx.foliage.tag, ctx.flowers.tag, ctx.spines.tag, ctx.fruit.tag]
      ctx.wood.tag = id
      ctx.foliage.tag = id
      ctx.flowers.tag = id
      ctx.spines.tag = id
      ctx.fruit.tag = id
      draw()
      ;[ctx.wood.tag, ctx.foliage.tag, ctx.flowers.tag, ctx.spines.tag, ctx.fruit.tag] = saved
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
  if (fruitCount > MAX_FRUIT_PIECES) clusterFruit(ctx, fruitCount)
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

/** A plant has at most this many fruit pieces; more fruit is grouped into small clusters by proximity. */
export const MAX_FRUIT_PIECES = 24

/** Group the fruit pieces `fruit0..n-1` into MAX_FRUIT_PIECES clusters (farthest-point seeds, nearest seed wins) and relabel their triangles. */
function clusterFruit(ctx: Ctx, n: number): void {
  const builders = [ctx.wood, ctx.foliage, ctx.flowers, ctx.fruit, ctx.spines]
  const sum = new Map<string, [number, number, number, number]>()
  for (const b of builders) {
    for (let t = 0; t < b.triTag.length; t++) {
      const tg = b.triTag[t]
      if (!/^fruit\d+$/.test(tg)) continue
      const s = sum.get(tg) ?? [0, 0, 0, 0]
      for (let k = 0; k < 3; k++) {
        const v = b.idx[t * 3 + k] * 3
        s[0] += b.pos[v]
        s[1] += b.pos[v + 1]
        s[2] += b.pos[v + 2]
        s[3]++
      }
      sum.set(tg, s)
    }
  }
  const centers: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const s = sum.get(`fruit${i}`) ?? [0, 0, 0, 1]
    centers.push([s[0] / s[3], s[1] / s[3], s[2] / s[3]])
  }
  const d2 = (a: Vec3, b: Vec3): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  const seeds = [0]
  const near = centers.map((c) => d2(c, centers[0]))
  while (seeds.length < MAX_FRUIT_PIECES) {
    let best = 0
    for (let i = 1; i < n; i++) if (near[i] > near[best]) best = i
    seeds.push(best)
    for (let i = 0; i < n; i++) near[i] = Math.min(near[i], d2(centers[i], centers[best]))
  }
  const cluster = centers.map((c) => {
    let bi = 0
    let bd = Infinity
    for (let k = 0; k < seeds.length; k++) {
      const d = d2(c, centers[seeds[k]])
      if (d < bd) {
        bd = d
        bi = k
      }
    }
    return bi
  })
  for (const b of builders) {
    for (let t = 0; t < b.triTag.length; t++) {
      const m = /^fruit(\d+)$/.exec(b.triTag[t])
      if (m) b.triTag[t] = `fruit${cluster[Number(m[1])]}`
    }
  }
  for (let i = 0; i < n; i++) ctx.pieceMeta.delete(`fruit${i}`)
  for (let k = 0; k < MAX_FRUIT_PIECES; k++) ctx.pieceMeta.set(`fruit${k}`, { kind: 'fruit', parent: undefined })
}

const PART_ORDER: PartKind[] = ['wood', 'foliage', 'flowers', 'fruit', 'spines']

/** Turn the builders' tag ranges into pieces with ids, materials, pivots and bounds (positions already scaled). */
function buildPieces(parts: PlantMesh['parts'], builders: Record<PartKind, MeshBuilder>, meta: Map<string, PieceMeta>, rootId: string, condition: Condition, scale: number): PlantPiece[] {
  const primary = new Map<string, PartKind>()
  for (const part of PART_ORDER) {
    if (!parts[part]) continue
    for (const r of builders[part].ranges) if (!primary.has(r.tag || rootId)) primary.set(r.tag || rootId, part)
  }
  if (parts.fruit) for (const r of builders.fruit.ranges) if (meta.get(r.tag || rootId)?.kind === 'fruit') primary.set(r.tag, 'fruit')
  // bounds of every tag over all its parts, to hang each fruit on the nearest non-fruit piece
  const tagBox = new Map<string, { min: Vec3; max: Vec3 }>()
  for (const part of PART_ORDER) {
    const mesh = parts[part]
    if (!mesh) continue
    for (const r of builders[part].ranges) {
      const tag = r.tag || rootId
      let box = tagBox.get(tag)
      if (!box) tagBox.set(tag, (box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }))
      for (let i = r.indexStart; i < r.indexStart + r.indexCount; i++) {
        const v = mesh.indices[i] * 3
        for (let a = 0; a < 3; a++) {
          const c = mesh.positions[v + a]
          if (c < box.min[a]) box.min[a] = c
          if (c > box.max[a]) box.max[a] = c
        }
      }
    }
  }
  const fruitHang = new Map<string, { parent?: string; pivot: Vec3 }>()
  const PRIORITY: Partial<Record<PieceKind, number>> = { branch: 0, pad: 0, arm: 0, stem: 1, trunk: 1, crown: 2 }
  for (const [tag, box] of tagBox) {
    if (meta.get(tag)?.kind !== 'fruit') continue
    const cx = (box.min[0] + box.max[0]) / 2
    const cy = (box.min[1] + box.max[1]) / 2
    const cz = (box.min[2] + box.max[2]) / 2
    let parent: string | undefined
    let pbox: { min: Vec3; max: Vec3 } | undefined
    let bd = Infinity
    let bp = 9
    for (const [ptag, pb] of tagBox) {
      const pk = meta.get(ptag)?.kind
      if (pk === undefined || PRIORITY[pk] === undefined) continue
      let d = 0
      const p = [cx, cy, cz]
      for (let a = 0; a < 3; a++) {
        const o = p[a] < pb.min[a] ? pb.min[a] - p[a] : p[a] > pb.max[a] ? p[a] - pb.max[a] : 0
        d += o * o
      }
      const pr = PRIORITY[pk]!
      if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && pr < bp)) {
        bd = d
        bp = pr
        parent = ptag
        pbox = pb
      }
    }
    // pivot: the point of the fruit's bounds nearest to the middle of what it hangs from (a stalk top, a trunk / pad side)
    const pc = pbox ? [(pbox.min[0] + pbox.max[0]) / 2, (pbox.min[1] + pbox.max[1]) / 2, (pbox.min[2] + pbox.max[2]) / 2] : [cx, box.max[1], cz]
    const pivot: Vec3 = [Math.min(box.max[0], Math.max(box.min[0], pc[0])), Math.min(box.max[1], Math.max(box.min[1], pc[1])), Math.min(box.max[2], Math.max(box.min[2], pc[2]))]
    fruitHang.set(tag, { parent, pivot })
  }
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
      const hang = fruitHang.get(tag)
      if (hang) pivot = hang.pivot
      else if (m.pivot) pivot = [m.pivot[0] * scale, Math.max(0, m.pivot[1] * scale), m.pivot[2] * scale]
      else if (m.kind === 'crown' || m.kind === 'fruit') pivot = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
      else pivot = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2]
      if (m.kind === 'trunk' || m.kind === 'stem' || m.kind === 'pot' || m.kind === 'soil') pivot = [0, min[1], 0]
      let material: MaterialKey = materialKeyForPart(part, mesh.material, condition)
      if (m.kind === 'pot') material = 'pot'
      else if (m.kind === 'soil') material = 'soil'
      const parentTag = hang ? hang.parent : m.parent
      const parentId = parentTag !== undefined && primary.has(parentTag) ? idOf(parentTag, primary.get(parentTag)!) : undefined
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
