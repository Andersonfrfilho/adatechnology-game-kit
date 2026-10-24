import { variantDecay, variantSeed } from '@adatechnology/game-characters'
import type { Civilian, Crowd, CrowdType } from '@adatechnology/game-crowd'
import { LOD_BAKE, LOD_SEGMENTS, bakeBody, buildInstancedBody, createBodyBatch, createVariantBatches } from '@adatechnology/game-characters-three'
import type { BakeBuilders, BakeSpec, BakedBody, BodyBatch, BodyVariant, Three } from '@adatechnology/game-characters-three'
import type * as THREE_NS from 'three'

import { createCrowdInstances } from './instances'
import type { CrowdFrame, CrowdInstance, CrowdInstances, CrowdPoseMap, CrowdRenderNumbers } from './instances'

export type CrowdRendererOptions = {
  readonly crowd: Crowd
  /** The rich builders the bodies are baked from (`game-characters-three`: the Bestiário builder, optionally the survivors'). */
  readonly builders: BakeBuilders
  /** The name the rich builder knows a crowd type by (default its id). */
  readonly typeName?: (type: CrowdType, index: number) => string
  /** The civilians to draw and the body each one is baked from (G 68469 `PB`: a human spec or a portrait). Without it no civilian is drawn. */
  readonly civilians?: { readonly list: () => readonly Civilian[]; readonly body: (civilian: Civilian) => BakeSpec; readonly color?: (civilian: Civilian) => number }
  /** The plain body for bodies on the ground that were not agents (default the instanced body at the middle level, G `BODY_LOD[1]`). */
  readonly plainBody?: THREE_NS.BufferGeometry
  /** Whether the bodies on the ground are drawn this frame (default always). */
  readonly drawCorpses?: () => boolean
  readonly numbers?: Partial<CrowdRenderNumbers>
  readonly poses?: Partial<CrowdPoseMap>
}

export type CrowdRenderer = {
  /** Holds every batch; add it to the scene. */
  readonly group: THREE_NS.Group
  readonly instances: CrowdInstances
  /** Bakes every type's variants now (otherwise a type is baked the first time one of its bodies is drawn). */
  bake(): void
  /** Draws the frame: the agents, the bodies on the ground and the civilians. */
  update(dt: number, frame: CrowdFrame): void
  /** Agents drawn at each level of detail in the last frame (G `lodCounts`). */
  readonly lodCounts: readonly [number, number, number]
  /** Batches with something to draw. */
  readonly drawCalls: number
  readonly bakeMs: number
  readonly variants: readonly BodyVariant[]
  dispose(): void
}

const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now())

/**
 * The crowd drawn on the instanced path: every type's variants baked at the three levels of detail (G 67079 `ZVAR`, the variants and seeds of
 * `game-characters`), a few draw calls for thousands of agents, the bodies on the ground and the civilians. The instances are `createCrowdInstances`
 * (the port of `hordeRender` and `npcRender`); the batches are `game-characters-three`'s.
 */
export function createCrowdRenderer(three: Three, options: CrowdRendererOptions): CrowdRenderer {
  const { crowd } = options
  const group = new three.Group()
  group.name = 'crowd'
  const time = { value: 0 }
  const eyes = crowd.pack.types.map((type) => type.eye ?? null)
  const instances = createCrowdInstances({ eyes, ...(options.numbers ? { numbers: options.numbers } : {}), ...(options.poses ? { poses: options.poses } : {}) })
  const N = instances.numbers
  const variants: BodyVariant[] = []
  const batches: (readonly BodyBatch[])[] = []
  let plain: BodyBatch | null = null
  const people = new Map<string, BodyBatch>()
  let bakeMs = 0
  const lodCounts: [number, number, number] = [0, 0, 0]
  const shirt = new three.Color()
  const eyeColors = new Map<number, THREE_NS.Color>()
  const eyeOf = (hex: number): THREE_NS.Color => {
    let color = eyeColors.get(hex)
    if (!color) eyeColors.set(hex, (color = new three.Color(hex)))
    return color
  }
  const push = (batch: BodyBatch | undefined, instance: CrowdInstance): void => {
    if (!batch) return
    shirt.setHex(instance.color).multiplyScalar(instance.shade)
    batch.push({ a: instance.a, b: instance.b, c: instance.c, color: shirt, ...(instance.eye !== null ? { eye: eyeOf(instance.eye) } : {}), y: instance.y })
  }

  // the type of each global variant (G `ZVAR_OF` turned around), so a body is baked the first time one of its type is drawn
  const typeOfVariant: number[] = []
  crowd.variantsOf.forEach((list, c) => list.forEach((g) => (typeOfVariant[g] = c)))
  const baked = new Set<number>()
  const ensurePlain = (): BodyBatch => {
    if (!plain) {
      plain = createBodyBatch(three, options.plainBody ?? buildInstancedBody(three, { segments: LOD_SEGMENTS[1] }), { max: crowd.numbers.corpsesMax, castShadow: false, time })
      group.add(plain.mesh)
    }
    return plain
  }
  /** Bakes the variants of type `c` (G 67079: decay 1, 2, 1, 2 and the seed `7000 + c·101 + v·13`, at 1, 0.5 and 0.28 of detail). */
  const bakeType = (c: number): void => {
    if (baked.has(c)) return
    baked.add(c)
    const type = crowd.pack.types[c]!
    const name = options.typeName?.(type, c) ?? type.id
    const started = now()
    crowd.variantsOf[c]!.forEach((g, v) => {
      const decay = variantDecay(v)
      const seed = variantSeed(c, v)
      const bodies: BakedBody[] = LOD_BAKE.map((lod) => bakeBody(three, options.builders, { type: name, decay, seed }, lod))
      const variant: BodyVariant = { typeId: type.id, variant: v, seed, decay, s: bodies[0]!.s, bulk: bodies[0]!.bulk, verts: bodies.map((body) => body.verts), geometries: bodies.map((body) => body.geo) }
      variants[g] = variant
      batches[g] = createVariantBatches(three, variant, time)
      for (const batch of batches[g]!) group.add(batch.mesh)
    })
    bakeMs += now() - started
  }
  const bake = (): void => crowd.pack.types.forEach((_, c) => bakeType(c))
  const bakeSeen = (): void => {
    const Z = crowd.store
    for (let i = 0; i < Z.n; i++) if (!baked.has(Z.type[i]!)) bakeType(Z.type[i]!)
    for (const { data } of crowd.corpses.entries) if (data.variant >= 0 && !baked.has(typeOfVariant[data.variant]!)) bakeType(typeOfVariant[data.variant]!)
  }

  const personBatch = (civilian: Civilian): BodyBatch | undefined => {
    const made = people.get(civilian.id)
    if (made) return made
    const spec = options.civilians?.body(civilian)
    if (!spec) return undefined
    const batch = createBodyBatch(three, bakeBody(three, options.builders, spec, N.civilianBake).geo, { max: N.civilianBatch, time })
    people.set(civilian.id, batch)
    group.add(batch.mesh)
    return batch
  }

  const all = (): BodyBatch[] => [...batches.flatMap((set) => set ?? []), ...(plain ? [plain] : []), ...people.values()]

  return {
    group,
    instances,
    bake,
    update(dt, frame) {
      bakeSeen()
      time.value += dt
      for (const batch of all()) batch.begin()
      instances.agents(crowd.store, variants, frame, (v, l, instance) => push(batches[v]?.[l], instance))
      if (options.drawCorpses?.() !== false) instances.corpses(crowd.corpses.entries, variants, frame, crowd.numbers.corpseSeconds, (v, l, instance) => push(batches[v]?.[l], instance), (instance) => push(ensurePlain(), instance))
      // as the game counts them: the variant batches after the bodies on the ground went in
      for (let l = 0; l < 3; l++) lodCounts[l] = batches.reduce((sum, set) => sum + (set?.[l]?.count ?? 0), 0)
      const list = options.civilians?.list()
      if (list) instances.civilians(list, options.civilians?.color ?? ((n) => n.spec.color ?? 0x808080), (n, instance) => push(personBatch(n), instance))
      for (const batch of all()) batch.end()
    },
    get lodCounts() {
      return lodCounts
    },
    get drawCalls() {
      return all().filter((batch) => batch.count > 0).length
    },
    get bakeMs() {
      return bakeMs
    },
    get variants() {
      return variants
    },
    dispose() {
      for (const batch of all()) {
        batch.mesh.geometry.dispose()
        group.remove(batch.mesh)
      }
      variants.length = 0
      batches.length = 0
      baked.clear()
      plain = null
      people.clear()
    },
  }
}
