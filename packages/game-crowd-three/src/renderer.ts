import { variantDecay, variantSeed } from '@adatechnology/game-characters'
import type { Civilian, Crowd, CrowdType } from '@adatechnology/game-crowd'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { KIT_ACCESSORIES, createSegmentClipUniforms, LOD_BAKE, LOD_SEGMENTS, accessoryPlacement, bakeBody, bakeImpostorAtlas, buildInstancedBody, buildKitAccessory, createBlobShadowBatch, createBodyBatch, createImpostorBatch, createVariantBatches } from '@adatechnology/game-characters-three'
import type { BakeBuilders, BakeSpec, BakedBody, BlobShadowBatch, BodyBatch, BodyVariant, ImpostorAtlas, ImpostorBatch, KitAccessory, SegmentClipUniforms, Three } from '@adatechnology/game-characters-three'
import type * as THREE_NS from 'three'

import { IMPOSTOR_LEVEL, createCrowdInstances } from './instances'
import type { CrowdFrame, CrowdInstance, CrowdInstances, CrowdPoseMap, CrowdRenderNumbers } from './instances'
import type { CrowdVarietyNumbers } from './variety/look'

/** Variety on the instanced path (T4b.7, D11 and D12): identity for every body, accessories, real shadows only near and blobs beyond. Absent, the renderer is the game's. */
export type CrowdRendererVariety = {
  readonly numbers?: Partial<CrowdVarietyNumbers>
  /** The accessory batches, drawn by the kit's builders (default `KIT_ACCESSORIES`); `false` for none. */
  readonly accessories?: readonly KitAccessory[] | false
  /** Instances an accessory batch holds at the near and the middle level (default 480 and 1400). */
  readonly accessoryCapacity?: readonly [number, number]
  /** Only the nearest level casts a real shadow (default true). */
  readonly nearShadows?: boolean
  /** One dark disc under each body beyond the nearest level (default true). */
  readonly blobShadows?: boolean
  /** Walk the bodies of the near and middle levels from the clip texture (12 bones, 24 texels, nearest filtered; step 3 of the ladder). Default off: the shader's own walk. */
  readonly segmentClips?: boolean
  /** The far tier (default on, from 90 m): one atlas for every type, one draw call; `false` keeps the far mesh to the cull distance. */
  readonly impostor?: false | { readonly from?: number; readonly capacity?: number; readonly light?: { readonly r: number; readonly g: number; readonly b: number } }
}

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
  readonly variety?: CrowdRendererVariety
}

export type CrowdRenderer = {
  /** Holds every batch; add it to the scene. */
  readonly group: THREE_NS.Group
  readonly instances: CrowdInstances
  /** Bakes every type's variants now (otherwise a type is baked the first time one of its bodies is drawn). */
  bake(): void
  /**
   * Bakes and makes every batch the frame would make on demand (the bodies on the ground, the blob shadows, the impostors, the accessories of the near and middle levels), so that a host that compiles
   * its scene (`ProgramWarmup`) links the body, accessory, blob and impostor programs and their depth and distance materials before play, and no batch is made during it.
   */
  prepare(): void
  /** Draws the frame: the agents, the bodies on the ground and the civilians. */
  update(dt: number, frame: CrowdFrame): void
  /** Agents drawn at each level of detail in the last frame (G `lodCounts`). */
  readonly lodCounts: readonly [number, number, number]
  /** Agents drawn as impostors in the last frame. */
  readonly impostorCount: number
  /** Batches with something to draw. */
  readonly drawCalls: number
  readonly bakeMs: number
  readonly variants: readonly BodyVariant[]
  dispose(): void
}

const ACCESSORY_CAPACITY = [480, 1400] as const
const BLOB_CAPACITY = 4000
const IMPOSTOR_FROM = 90
const IMPOSTOR_CAPACITY = 4000
const NEAR_SHADOWS = [true, false, false] as const

const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now())

/**
 * The crowd drawn on the instanced path: every type's variants baked at the three levels of detail (G 67079 `ZVAR`, the variants and seeds of
 * `game-characters`), a few draw calls for thousands of agents, the bodies on the ground and the civilians. The instances are `createCrowdInstances`
 * (the port of `hordeRender` and `npcRender`); the batches are `game-characters-three`'s.
 */
export function createCrowdRenderer(three: Three, options: CrowdRendererOptions): CrowdRenderer {
  const { crowd } = options
  const group = markKitOrigin(new three.Group(), { owner: 'game-crowd-three', kind: 'person' })
  group.name = 'crowd'
  const time = { value: 0 }
  const eyes = crowd.pack.types.map((type) => type.eye ?? null)
  const variety = options.variety
  const accessoryKinds = variety ? (variety.accessories === false ? [] : (variety.accessories ?? KIT_ACCESSORIES)) : []
  const accessoryCapacity = variety?.accessoryCapacity ?? ACCESSORY_CAPACITY
  const nearShadows = variety ? (variety.nearShadows ?? true) : false
  const impostorOptions = variety && variety.impostor !== false ? (variety.impostor ?? {}) : null
  const instances = createCrowdInstances({
    eyes,
    ...(options.numbers ? { numbers: options.numbers } : {}),
    ...(options.poses ? { poses: options.poses } : {}),
    ...(variety ? { variety: { ...(variety.numbers ? { numbers: variety.numbers } : {}), ...(impostorOptions ? { impostorFrom: impostorOptions.from ?? IMPOSTOR_FROM } : {}), ...(variety.segmentClips ? { segmentClips: true } : {}) } } : {}),
  })
  const N = instances.numbers
  const variants: BodyVariant[] = []
  const batches: (readonly BodyBatch[])[] = []
  let plain: BodyBatch | null = null
  const people = new Map<string, BodyBatch>()
  const accessoryBatches = new Map<string, BodyBatch>()
  const accessoryGeometry = new Map<string, THREE_NS.BufferGeometry>()
  const placements = new Map<string, readonly [number, number, number, number]>()
  let blobs: BlobShadowBatch | null = null
  let atlas: ImpostorAtlas | null = null
  let impostors: ImpostorBatch | null = null
  let impostorCount = 0
  const clipUniforms: SegmentClipUniforms | null = variety?.segmentClips ? createSegmentClipUniforms(three) : null
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
    batch.push({ a: instance.a, b: instance.b, c: instance.c, color: shirt, ...(instance.eye !== null ? { eye: eyeOf(instance.eye) } : {}), y: instance.y, ...(instance.d ? { d: instance.d } : {}) })
  }
  const pushAccessories = (variant: number, level: number, instance: CrowdInstance): void => {
    const bits = instance.accessories ?? 0
    if (!bits || level > 1) return
    shirt.setHex(instance.color).multiplyScalar(instance.shade)
    for (const accessory of accessoryKinds) {
      if (!(bits & accessory.bit)) continue
      accessoryBatch(accessory, level).push({ a: instance.a, b: instance.b, c: instance.c, color: shirt, y: instance.y, ...(instance.d ? { d: instance.d } : {}), acc: placementOf(variant, level, accessory) })
    }
  }

  const accessoryBatch = (accessory: KitAccessory, level: number): BodyBatch => {
    const key = `${accessory.id}|${level}`
    const made = accessoryBatches.get(key)
    if (made) return made
    let geometry = accessoryGeometry.get(accessory.id)
    if (!geometry) accessoryGeometry.set(accessory.id, (geometry = buildKitAccessory(three, accessory)))
    const batch = createBodyBatch(three, geometry, { max: accessoryCapacity[level] ?? ACCESSORY_CAPACITY[1], castShadow: level === 0, time, accessory: true, ...(clipUniforms ? { segmentClips: clipUniforms } : {}) })
    accessoryBatches.set(key, batch)
    group.add(batch.mesh)
    return batch
  }
  const placementOf = (variant: number, level: number, accessory: KitAccessory): readonly [number, number, number, number] => {
    const key = `${variant}|${level}|${accessory.attach}`
    let placed = placements.get(key)
    if (!placed) placements.set(key, (placed = accessoryPlacement(variants[variant]!.geometries[level]!, accessory.attach)))
    return placed
  }
  /** The atlas holds one silhouette per type, from the far mesh of its first variant: every type is baked the first time a body is drawn as an impostor. */
  const ensureImpostors = (): ImpostorBatch => {
    if (impostors) return impostors
    bake()
    const bodies = crowd.pack.types.map((_, c) => {
      const variant = variants[crowd.variantsOf[c]![0]!]!
      return { geometry: variant.geometries[2]! }
    })
    atlas = bakeImpostorAtlas(three, bodies)
    impostors = createImpostorBatch(three, atlas, { max: impostorOptions?.capacity ?? IMPOSTOR_CAPACITY, ...(impostorOptions?.light ? { light: impostorOptions.light } : {}) })
    group.add(impostors.mesh)
    return impostors
  }
  const pushImpostor = (instance: CrowdInstance): void => {
    shirt.setHex(instance.color).multiplyScalar(instance.shade)
    ensureImpostors().push({ a: instance.a, scale: [instance.b[0], instance.b[1]], silhouette: instance.type ?? 0, y: instance.y, c: instance.c, color: shirt, ...(instance.d ? { d: instance.d } : {}) })
    impostorCount++
  }
  const ensureBlobs = (): BlobShadowBatch => {
    if (!blobs) {
      blobs = createBlobShadowBatch(three, { max: BLOB_CAPACITY })
      group.add(blobs.mesh)
    }
    return blobs
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
      batches[g] = createVariantBatches(three, variant, time, variety ? { identity: true, ...(clipUniforms ? { segmentClips: clipUniforms } : {}), ...(nearShadows ? { castsShadow: NEAR_SHADOWS } : {}) } : {})
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

  const all = (): BodyBatch[] => [...batches.flatMap((set) => set ?? []), ...(plain ? [plain] : []), ...people.values(), ...accessoryBatches.values()]

  return {
    group,
    instances,
    bake,
    prepare() {
      bake()
      ensurePlain()
      if (!variety) return
      if (variety.blobShadows ?? true) ensureBlobs()
      if (impostorOptions) ensureImpostors()
      for (const accessory of accessoryKinds) for (const level of [0, 1]) accessoryBatch(accessory, level)
    },
    update(dt, frame) {
      bakeSeen()
      time.value += dt
      for (const batch of all()) batch.begin()
      blobs?.begin()
      impostors?.begin()
      impostorCount = 0
      const drawBlobs = variety ? (variety.blobShadows ?? true) : false
      instances.agents(crowd.store, variants, frame, (v, l, instance) => {
        if (l === IMPOSTOR_LEVEL) pushImpostor(instance)
        else push(batches[v]?.[l], instance)
        if (!variety) return
        pushAccessories(v, l, instance)
        if (drawBlobs && l > 0) ensureBlobs().push(instance.a[0], instance.y, instance.a[1], instance.b[0] * (variants[v]?.s ?? 1))
      })
      if (options.drawCorpses?.() !== false) instances.corpses(crowd.corpses.entries, variants, frame, crowd.numbers.corpseSeconds, (v, l, instance) => push(batches[v]?.[l], instance), (instance) => push(ensurePlain(), instance))
      // as the game counts them: the variant batches after the bodies on the ground went in
      for (let l = 0; l < 3; l++) lodCounts[l] = batches.reduce((sum, set) => sum + (set?.[l]?.count ?? 0), 0)
      const list = options.civilians?.list()
      if (list) instances.civilians(list, options.civilians?.color ?? ((n) => n.spec.color ?? 0x808080), (n, instance) => push(personBatch(n), instance))
      for (const batch of all()) batch.end()
      blobs?.end()
      impostors?.end()
    },
    get impostorCount() {
      return impostorCount
    },
    get lodCounts() {
      return lodCounts
    },
    get drawCalls() {
      return all().filter((batch) => batch.count > 0).length + (blobs && blobs.count > 0 ? 1 : 0) + (impostors && impostors.count > 0 ? 1 : 0)
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
      accessoryBatches.clear()
      accessoryGeometry.clear()
      placements.clear()
      blobs?.mesh.geometry.dispose()
      if (blobs) group.remove(blobs.mesh)
      blobs = null
      impostors?.mesh.geometry.dispose()
      if (impostors) group.remove(impostors.mesh)
      atlas?.dispose()
      clipUniforms?.uClips.value.dispose()
      impostors = null
      atlas = null
    },
  }
}
