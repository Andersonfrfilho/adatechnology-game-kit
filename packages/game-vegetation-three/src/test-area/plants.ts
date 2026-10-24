import type { AnimationClipSpec, DestructibleSpec, JointSpec, PartSpec, TestableItem } from '@adatechnology/game-contracts'
import type { Condition, PlantMesh, PlantSpec } from '@adatechnology/game-vegetation'

import type { MaterialsLike, SpeciesSdk, VegetationSdk } from './types'

/** The seed of every plant of the area (the Viveiro's module fixes it, so the plants are the same in every run). */
export const PLANT_SEED = 3

export type PlantDefKind = 'tree' | 'shrub' | 'hedge' | 'flower' | 'cactus' | 'pot' | 'tuft'

/** One item of the area: a species of the pack (or a variant of it) and how it is built. */
export type PlantDef = {
  readonly id: string
  /** The species the plant is generated from (default: `id`). */
  readonly base?: string
  readonly kind: PlantDefKind
  readonly sway: boolean
  /** Fields of the species spec replaced for this item. */
  readonly over?: Readonly<Record<string, number>>
  /** The name, `[pt-BR, en]`, when the species name does not fit the variant. */
  readonly name?: readonly [string, string]
  readonly condition?: Condition
  /** Plants side by side (a hedge is 4 sections joined by their stems). */
  readonly segments?: number
  readonly movable?: boolean
}

/** The 18 items of the Viveiro's module, in its order. */
export const PLANT_DEFS: readonly PlantDef[] = [
  { id: 'mango_tree', kind: 'tree', sway: true },
  // young mango trees (same species, thin trunk): the 15 and 30 cm trunks on which the SDK documents the number of axe swings
  { id: 'mango_young_15', base: 'mango_tree', kind: 'tree', sway: true, over: { height: 1.7, trunkRadius: 0.1, crownRadius: 1.0 }, name: ['Mangueira jovem (tronco de 15 cm)', 'Young mango tree (15 cm trunk)'] },
  { id: 'mango_young_30', base: 'mango_tree', kind: 'tree', sway: true, over: { height: 1.7, trunkRadius: 0.17, crownRadius: 1.2 }, name: ['Mangueira jovem (tronco de 30 cm)', 'Young mango tree (30 cm trunk)'] },
  { id: 'yellow_ipe', kind: 'tree', sway: true },
  { id: 'coconut_palm', kind: 'tree', sway: true },
  { id: 'banana_with_bunch', kind: 'tree', sway: true },
  { id: 'araucaria', kind: 'tree', sway: true },
  { id: 'dead_tree', kind: 'tree', sway: true, condition: 'dead' },
  { id: 'hibiscus_shrub', kind: 'shrub', sway: true },
  { id: 'boxwood_hedge', kind: 'hedge', sway: true, segments: 4 },
  { id: 'rose_bush_red', kind: 'shrub', sway: true },
  { id: 'sunflower', kind: 'flower', sway: true },
  { id: 'mandacaru', kind: 'cactus', sway: false },
  { id: 'prickly_pear', kind: 'cactus', sway: false },
  { id: 'crown_cactus', kind: 'cactus', sway: false },
  { id: 'potted_fern', kind: 'pot', sway: true, movable: true },
  { id: 'potted_cactus', kind: 'pot', sway: false, movable: true },
  { id: 'lawn_tuft', kind: 'tuft', sway: true },
]

/** The id of a mesh or a joint: lower case, runs of other characters turned into one `_` (`crown:flowers` becomes `crown_flowers`). */
export const sanitize = (s: string): string => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

/** What `buildObject` records in `userData.veg` of each piece mesh. */
export type PieceMeta = {
  id: string
  piece: string
  kind: string
  sub: string | null
  base: string
  parent: string | null
  seg: number
  materialKey: string
  radius?: number
  length?: number
  axis?: [number, number, number]
  /** Where the plant of this section stands along x in the object (sections of a hedge are side by side). */
  dx: number
}

type Three = any
type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** Fraction of the volume of the shape that is solid, by destruction material (what the spec reports as `fill`). */
const FILL: Record<string, number> = { green_wood: 0.5, wood_soft: 0.5, foliage: 0.035, flowers: 0.03, flesh_fruit: 0.8, ceramic: 0.2, soil: 0.7, cactus: 0.5 }
/** Radians of sway, by kind of piece. */
const SWAY_AMPLITUDE: Record<string, number> = { trunk: 0.004, branch: 0.012, crown: 0.03, fruit: 0.04, stem: 0.025, arm: 0, pad: 0, pot: 0, soil: 0 }

export function createPlants(sdk: VegetationSdk, species: SpeciesSdk, materials: (THREE: Three) => MaterialsLike, seed = PLANT_SEED) {
  const defs = new Map(PLANT_DEFS.map((def) => [def.id, def]))
  const specFor = (def: PlantDef): PlantSpec => {
    const spec = species.toSpec(def.base ?? def.id)
    return def.over ? ({ ...spec, ...def.over } as PlantSpec) : spec
  }
  const cache = new Map<string, PlantMesh>()
  const plantFor = (def: PlantDef, segment: number): PlantMesh => {
    const key = `${def.id}:${segment}`
    let plant = cache.get(key)
    if (!plant) {
      plant = sdk.generate(specFor(def), { seed: seed + segment * 7, ...(def.condition ? { condition: def.condition } : {}) })
      cache.set(key, plant)
    }
    return plant
  }

  // ---- the 3D object ----------------------------------------------------------------------------------------------------------------------
  function buildObject(THREE: Three, def: PlantDef): any {
    const root = new THREE.Group()
    root.name = def.id
    const segments = def.segments ?? 1
    let spacing = 0
    for (let s = 0; s < segments; s++) {
      const plant = plantFor(def, s)
      const object: any = sdk.createPlantObject(THREE, plant, materials(THREE), { separable: true })
      const prefix = segments > 1 ? `s${s}_` : ''
      const children = object.children.slice()
      if (s === 0 && segments > 1) {
        const g0 = children[0].geometry
        g0.computeBoundingBox()
        spacing = (g0.boundingBox.max.x - g0.boundingBox.min.x) * 0.9
      }
      for (const mesh of children) {
        const piece = mesh.userData.destructionPart
        const bits = String(piece.id).split(':')
        const id = prefix + sanitize(piece.id)
        mesh.name = id
        const dx = (s - (segments - 1) / 2) * spacing
        const meta: PieceMeta = {
          id,
          piece: piece.id,
          kind: piece.kind,
          sub: bits[1] ?? null,
          base: prefix + sanitize(bits[0] as string),
          parent: piece.parent ? prefix + sanitize(piece.parent) : null,
          seg: s,
          materialKey: piece.materialKey,
          radius: piece.radius,
          length: piece.length,
          axis: piece.axis,
          dx,
        }
        mesh.userData.veg = meta
        mesh.position.x += dx
        mesh.castShadow = true
        root.add(mesh)
      }
      if (s === 0) {
        root.userData.collider = plant.collider || null
        root.userData.thorny = !!plant.thorny
      }
    }
    root.userData.speciesId = def.id
    root.userData.separable = true
    root.userData.segments = segments
    return root
  }

  // ---- the destruction spec -----------------------------------------------------------------------------------------------------------------
  function buildSpec(root: any, def: PlantDef): DestructibleSpec {
    const meshes: any[] = root.children.filter((c: any) => c.isMesh && c.userData.veg)
    const byId: Record<string, any> = {}
    for (const m of meshes) byId[(m.userData.veg as PieceMeta).id] = m
    const parts: Mutable<PartSpec>[] = []
    for (const m of meshes) {
      const v = m.userData.veg as PieceMeta
      const g = m.geometry
      if (!g.boundingBox) g.computeBoundingBox()
      const b = g.boundingBox
      const mn = [b.min.x + m.position.x, b.min.y + m.position.y, b.min.z + m.position.z]
      const mx = [b.max.x + m.position.x, b.max.y + m.position.y, b.max.z + m.position.z]
      const size: [number, number, number] = [Math.max(mx[0]! - mn[0]!, 0.02), Math.max(mx[1]! - mn[1]!, 0.02), Math.max(mx[2]! - mn[2]!, 0.02)]
      const c: [number, number, number] = [(mn[0]! + mx[0]!) / 2, (mn[1]! + mx[1]!) / 2, (mn[2]! + mx[2]!) / 2]
      const material = m.userData.destructionMaterial as string
      const round = v.kind === 'trunk' || v.kind === 'pot'
      let shape: PartSpec['shape'] = round ? { kind: 'cylinder', radius: Math.max(size[0], size[2]) / 2, height: size[1] } : { kind: 'box', size }
      // wood pieces: the real thickness of the SDK (2 x radius by the length along the axis) instead of the bounding box, which overstates leaning trunks, flared bases and curved pieces
      let rotation: [number, number, number] | null = null
      if (!v.sub && (v.radius ?? 0) > 0 && (v.length ?? 0) > 0 && (v.kind === 'trunk' || v.kind === 'branch' || v.kind === 'arm' || v.kind === 'stem')) {
        const rr = Math.max(v.radius as number, 0.01)
        const ll = Math.max(v.length as number, 0.02)
        shape = v.kind === 'trunk' ? { kind: 'cylinder', radius: rr, height: ll } : { kind: 'box', size: [rr * 2, ll, rr * 2] }
        if (v.axis) {
          // the y axis of the shape along the axis of the piece (Euler XYZ: x = atan2(az, ay), z = -asin(ax))
          const ax = v.axis
          const tilt = Math.hypot(ax[0], ax[2])
          if (tilt > 0.02 && ax[1] > -0.99) rotation = [Math.atan2(ax[2], ax[1]), 0, -Math.asin(Math.max(-1, Math.min(1, ax[0])))]
        }
      }
      const tags: string[] = []
      const p: Mutable<PartSpec> = { id: v.id, material, shape, position: c, tags }
      if (rotation) p.rotation = rotation
      p.fill = v.sub === 'spines' ? 0.02 : v.sub === 'flowers' ? 0.01 : v.kind === 'trunk' ? 0.8 : v.kind === 'branch' ? 0.1 : v.kind === 'arm' ? 0.12 : v.kind === 'pad' ? 0.3 : (FILL[material] ?? 0.5)
      if (v.kind === 'fruit' || v.sub === 'wood') p.mass = 15
      if (v.kind === 'trunk') {
        p.grain = 'y'
        tags.push('trunk')
      }
      if (v.kind === 'branch') tags.push('branch')
      if (material === 'foliage' || v.sub === 'foliage') tags.push('leaf')
      if (v.sub === 'flowers') tags.push('flower')
      if (v.sub === 'spines') tags.push('thorns')
      if (v.kind === 'fruit') tags.push('fruit')
      if (v.kind === 'arm') tags.push('arm')
      if (v.kind === 'pad') tags.push('pad')
      if (v.kind === 'pot') {
        // explicit hp: a terracotta pot breaks in 1 to 3 shots of 9 mm
        p.mass = 2.4
        p.hp = 25
        tags.push('pot')
      }
      if (v.kind === 'soil') {
        p.mass = 3.2
        tags.push('soil')
      }
      if (def.kind === 'pot' && v.kind === 'stem' && !v.sub) p.mass = 0.4
      if (def.kind === 'pot' && v.sub) p.mass = 0.05
      // the root piece is fixed to the ground (a loose pot anchors nothing)
      const isRoot = !v.parent && !v.sub && (v.kind === 'trunk' || v.kind === 'pad' || (v.kind === 'stem' && def.kind !== 'pot'))
      if (isRoot && !def.movable) p.anchored = true
      parts.push(p)
    }

    const joints: JointSpec[] = []
    const seen = new Set<string>()
    const add = (a: string | null, b: string, kind: JointSpec['kind'], extra?: Partial<JointSpec>): void => {
      if (!a || !b || a === b || !byId[a] || !byId[b]) return
      const id = `${a}~${b}`
      if (seen.has(id)) return
      seen.add(id)
      joints.push({ id, a, b, kind, ...extra })
    }
    const firstOf = (seg: number, kind: string): string | null => {
      for (const m of meshes) {
        const v = m.userData.veg as PieceMeta
        if (v.seg === seg && v.kind === kind && !v.sub) return v.id
      }
      return null
    }
    for (const m of meshes) {
      const v = m.userData.veg as PieceMeta
      if (v.sub) {
        add(v.base, v.id, 'tie')
        continue
      }
      if (v.kind === 'soil') {
        add(v.parent, v.id, 'resting')
        continue
      }
      if (v.parent) {
        add(v.parent, v.id, 'stem', v.kind === 'arm' ? { strength: 60 } : undefined)
        continue
      }
      if (v.kind === 'fruit') {
        add(firstOf(v.seg, 'crown') || firstOf(v.seg, 'pad') || firstOf(v.seg, 'stem') || firstOf(v.seg, 'trunk'), v.id, 'stem')
        continue
      }
      if (def.kind === 'pot' && v.kind === 'stem') add(firstOf(v.seg, 'soil'), v.id, 'tie')
    }
    // hedge: neighbouring sections held by their stems
    const segments = def.segments ?? 1
    if (segments > 1) for (let s = 0; s + 1 < segments; s++) add(`s${s}_stem`, `s${s + 1}_stem`, 'stem')
    return { name: def.id, parts, joints, tags: ['plant'] }
  }

  // ---- the wind -----------------------------------------------------------------------------------------------------------------------------
  function swayClip(def: PlantDef): AnimationClipSpec {
    const plant = plantFor(def, 0)
    const segments = def.segments ?? 1
    const keys: { t: number; parts: Record<string, { rotation: [number, number, number] }> }[] = []
    const N = 8
    const D = 4
    for (let k = 0; k <= N; k++) {
      const ph = (k / N) * Math.PI * 2
      const parts: Record<string, { rotation: [number, number, number] }> = {}
      for (let s = 0; s < segments; s++) {
        const prefix = segments > 1 ? `s${s}_` : ''
        for (const pc of plant.pieces) {
          const a = SWAY_AMPLITUDE[pc.kind] || 0
          if (!a) continue
          if (pc.kind === 'stem' && /(^|:)wood$/.test(pc.id)) continue
          if (def.kind === 'pot' && pc.kind === 'stem' && pc.id.indexOf(':') < 0 && def.id === 'potted_cactus') continue
          const f = pc.id.indexOf(':flowers') > 0 ? 1.6 : 1
          parts[prefix + sanitize(pc.id)] = { rotation: [Math.sin(ph + s) * a * f * 0.6, 0, Math.sin(ph * 1 + 0.7 + s) * a * f] }
        }
      }
      keys.push({ t: (k / N) * D, parts: k === 0 || k === N ? {} : parts })
    }
    return { id: 'sway', duration: D, keys, events: [{ t: 0.2, type: 'sound', data: { key: 'leaves_rustle' } }] } as AnimationClipSpec
  }

  // ---- the items ----------------------------------------------------------------------------------------------------------------------------
  function items(locale: string, defsToUse: readonly PlantDef[] = PLANT_DEFS): TestableItem[] {
    const loc = String(locale || 'pt-BR').toLowerCase().indexOf('en') === 0 ? 'en' : 'pt-BR'
    return defsToUse.map((def) => {
      const item: Mutable<TestableItem> = {
        id: def.id,
        name: def.name ? (def.name[loc === 'en' ? 1 : 0] as string) : species.name(def.base ?? def.id, loc),
        build: (THREE: unknown) => buildObject(THREE, def),
        spec: (root: unknown) => {
          const spec = buildSpec(root, def)
          ;(root as { userData: Record<string, unknown> }).userData.vegSpec = spec
          return spec
        },
        movable: !!def.movable,
      }
      if (def.sway) item.animations = [swayClip(def)]
      return item
    })
  }

  return { defs, specFor, plantFor, buildObject, buildSpec, swayClip, items }
}

export type Plants = ReturnType<typeof createPlants>
