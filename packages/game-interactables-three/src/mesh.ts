import { markKitOrigin } from '@adatechnology/game-contracts'
import { LIGHT_PRIORITY } from '@adatechnology/game-render-three'
import type { LightBudget, SourceHandle } from '@adatechnology/game-render-three'
import type { ObjectSpec } from '@adatechnology/game-interactables'
import { createShapeRecorder } from '@adatechnology/game-props3d'
import { colorChannels, generate } from '@adatechnology/game-shapes'
import type { ShapeBatch, ShapePoint } from '@adatechnology/game-shapes'
import type { HouseholdApi, MaterialKey, Quality, ThreeLib, ThreeNS } from './types'
import { MATERIAL_KEYS } from './types'
import { mergeParts } from './merge'
import { rememberRest } from './pose'

export type MaterialMap = Partial<Record<MaterialKey, ThreeNS.Material>>

export interface MeshApiOptions {
  /** Materials per key. Missing keys get a default (vertex-colored) material. */
  materials?: MaterialMap
  /** `high`: smoother cylinders and spheres, standard materials. `game`: fewer segments, Lambert materials. Default `high`. */
  quality?: Quality
  /** Cast and receive shadows on the merged meshes. Default true. */
  shadows?: boolean
  /** Make `plane` primitives double sided (applies to the default materials only). Default false. */
  doubleSidedPlanes?: boolean
  /**
   * Cut draw calls: `finish(spec)` merges the parts of one `PartSpec.group` that share a motion (blind slats) and the `cloth` soft
   * volumes (clothes on a line) into one mesh per material (see `mergeParts`). Needs the spec in `finish`. Default: on in `game` quality.
   */
  mergeParts?: boolean
  /** Idle flutter of merged cloth. Default 0.04. */
  swayAmplitude?: number
  /**
   * Material of one draw: called per mesh with its material key and the part id (`null` for the static body). Return the material the
   * host wants there (a per-room light mask, a flickering emissive...); the default is `materials[key]`. Merged groups (blind slats,
   * clothes) keep what you return, including its `onBeforeCompile`, `customProgramCacheKey`, `defines` and `userData`.
   */
  materialFor?: (key: MaterialKey, partId: string | null) => ThreeNS.Material | undefined
  /**
   * The host's light budget: each `api.light` becomes a source of it (it competes for a slot by distance, and following its bulb) instead of a `PointLight` of its own, so lamps coming and going
   * never change the lit materials' program key. Without it the lamps are real lights (deprecated, removed in the next major).
   */
  lights?: LightBudget
}

export interface MeshResult {
  /** Root group: static meshes (one per material) plus one child group per part (merged parts share one group, see `mergeParts`). */
  group: ThreeNS.Group
  /** Part groups by id. Origin at the pivot, rotated by the part's `ry`; `userData.rest` holds the rest pose. A merged part maps to the shared group (`userData.merged`). */
  parts: Record<string, ThreeNS.Group>
  /** Real lights requested by the builders (already children of their group). Empty with `MeshApiOptions.lights`. */
  lights: ThreeNS.Light[]
  /** With `MeshApiOptions.lights`: the lamps as sources of the budget (`remove()` one when its lamp breaks or the object goes). Empty without it. */
  sources: SourceHandle[]
}

export interface FinishOptions {
  /** Same as `MeshApiOptions.materialFor`; wins over it for this call. */
  materialFor?: MeshApiOptions['materialFor']
}

export interface MeshApi {
  api: HouseholdApi
  /** Builds the groups from everything drawn so far. Call once; the api is spent afterwards. Pass the spec the pack returned to allow `mergeParts`. */
  finish(spec?: ObjectSpec, finishOptions?: FinishOptions): MeshResult
  /** Materials in use (defaults merged with the given ones). */
  materials: Record<MaterialKey, ThreeNS.Material>
}

/** Default materials: vertex colors everywhere (in `game` quality plain, metal, wood and fabric are one shared Lambert material), glass and water transparent, emissive unlit. */
export function createDefaultMaterials(THREE: ThreeLib, quality: Quality = 'high'): Record<MaterialKey, ThreeNS.Material> {
  // three warns about every parameter that is present but undefined: only pass the ones that are set
  const defined = <T extends object>(o: T): T => {
    const out = {} as T
    for (const k of Object.keys(o) as Array<keyof T>) if (o[k] !== undefined) out[k] = o[k]
    return out
  }
  const std = (p: ThreeNS.MeshStandardMaterialParameters): ThreeNS.Material =>
    quality === 'game'
      ? new THREE.MeshLambertMaterial(defined({ vertexColors: true, transparent: p.transparent, opacity: p.opacity, depthWrite: p.depthWrite, side: p.side }))
      : new THREE.MeshStandardMaterial(defined({ vertexColors: true, roughness: 0.85, metalness: 0, ...p }))
  // Lambert has no roughness or metalness: in `game` quality the opaque default materials are one and the same instance, so the
  // mesh api (which merges per material instance) draws plain, metal, wood and fabric together
  const solid = quality === 'game' ? std({}) : null
  return {
    plain: solid ?? std({}),
    metal: solid ?? std({ roughness: 0.35, metalness: 0.7 }),
    wood: solid ?? std({ roughness: 0.8 }),
    glass: std({ roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    fabric: solid ?? std({ roughness: 1 }),
    plant: std({ roughness: 0.9, side: THREE.DoubleSide }),
    water: std({ roughness: 0.1, transparent: true, opacity: 0.7, depthWrite: false }),
    emissive: new THREE.MeshBasicMaterial({ vertexColors: true }),
    atlas_picture: std({ roughness: 0.9 }),
    atlas_floor: std({ roughness: 1 }),
  }
}

/** The channels three stores for a hex here: linear (three r152+ with colour management on) or the raw sRGB numbers (off, or an older three). */
const colorSpaces = new WeakMap<object, 'linear' | 'srgb'>()
function colorSpaceOf(THREE: ThreeLib): 'linear' | 'srgb' {
  const known = colorSpaces.get(THREE.Color)
  if (known) return known
  const space = detectColorSpace(THREE)
  colorSpaces.set(THREE.Color, space)
  return space
}
function detectColorSpace(THREE: ThreeLib): 'linear' | 'srgb' {
  const color = new THREE.Color()
  for (let c = 0; c < 256; c++) {
    color.setHex(c * 0x010101)
    if (color.r !== colorChannels(c * 0x010101, 'linear')[0]) {
      if (color.r !== c / 255) throw new Error('createMeshApi: this three.js stores colours in a space game-shapes does not know')
      return 'srgb'
    }
  }
  return 'linear'
}

/**
 * Mesh api for content packs. Every primitive is baked (vertex colors) into one `BufferGeometry` per material and per target
 * (the root, or a part), so the draw calls are the number of materials in use plus the same again for each part.
 *
 * The builders draw into a `game-shapes` schema (`createShapeRecorder` of game-props3d: unit templates, the item frame, parts and lights) and
 * `generate` bakes it; the bytes are the ones this api made with its own templates before (tests/exact-golden.test.ts).
 */
export function createMeshApi(THREE: ThreeLib, options: MeshApiOptions = {}): MeshApi {
  const quality: Quality = options.quality ?? 'high'
  const shadows = options.shadows !== false
  const materials = { ...createDefaultMaterials(THREE, quality), ...stripUndefined(options.materials) } as Record<MaterialKey, ThreeNS.Material>
  if (options.doubleSidedPlanes) for (const k of MATERIAL_KEYS) materials[k].side = THREE.DoubleSide
  let finished = false

  const recorder = quality === 'high' ? createShapeRecorder({ cylinderSegments: 12, sphereSegments: [12, 8] }) : createShapeRecorder({ cylinderSegments: 8, sphereSegments: [8, 6] })

  /** Keys that share a material instance share the geometry too: the first key stands for all of them. */
  const materialAlias: Record<string, string> = {}
  for (const k of MATERIAL_KEYS) {
    const first = MATERIAL_KEYS.find((o) => materials[o] === materials[k]) ?? k
    if (first !== k) materialAlias[k] = first
  }

  const lightsOut: ThreeNS.Light[] = []
  const sourcesOut: SourceHandle[] = []

  const build = (batches: readonly ShapeBatch[], points: readonly ShapePoint[], id: string | null, into: ThreeNS.Group, materialFor: MeshApiOptions['materialFor']): void => {
    for (const batch of batches) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(batch.positions, 3))
      g.setAttribute('normal', new THREE.BufferAttribute(batch.normals, 3))
      g.setAttribute('color', new THREE.BufferAttribute(batch.colors as Float32Array, 3))
      g.setAttribute('uv', new THREE.BufferAttribute(batch.uvs, 2))
      g.setIndex(new THREE.BufferAttribute(batch.indices as Uint16Array | Uint32Array, 1))
      g.computeBoundingSphere()
      g.computeBoundingBox()
      const key = batch.material as MaterialKey
      const mesh = new THREE.Mesh(g, materialFor?.(key, id) ?? materials[key])
      mesh.name = id === null ? `static:${key}` : `part:${id}`
      if (id !== null) mesh.userData.part = id
      mesh.userData.material = key
      mesh.castShadow = shadows
      mesh.receiveShadow = shadows
      into.add(mesh)
    }
    for (const point of points) {
      const l = point.data as { color: number; range: number }
      if (options.lights) {
        const bulb = new THREE.Object3D()
        bulb.name = 'lamp'
        bulb.position.set(point.position[0], point.position[1], point.position[2])
        into.add(bulb)
        sourcesOut.push(options.lights.addSource({ owner: 'interactables.lamp', priority: LIGHT_PRIORITY.lamp, color: l.color, intensity: 1, distance: l.range, position: [0, 0, 0], follow: bulb }))
        continue
      }
      // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
      const light = new THREE.PointLight(l.color, 1, l.range)
      light.position.set(point.position[0], point.position[1], point.position[2])
      into.add(light)
      lightsOut.push(light)
    }
  }

  return {
    api: recorder.api,
    materials,
    finish(spec, finishOptions) {
      const materialFor = finishOptions?.materialFor ?? options.materialFor
      if (finished) throw new Error('createMeshApi: finish() was already called')
      finished = true
      const buffers = generate(recorder.schema(), {
        colors: colorSpaceOf(THREE),
        materials: MATERIAL_KEYS,
        fallbackMaterial: 'plain',
        materialAlias,
        validate: false,
        key: false,
      })
      const batches = buffers.levels[0]?.batches ?? []
      const of = (id: string | null): { batches: ShapeBatch[]; points: ShapePoint[] } => ({ batches: batches.filter((b) => b.part === id), points: buffers.points.filter((p) => p.part === id) })
      const group = markKitOrigin(new THREE.Group(), { owner: 'game-interactables-three', kind: 'furniture', ...(spec ? { id: spec.type } : {}) })
      group.name = 'interactable'
      const parts: Record<string, ThreeNS.Group> = {}
      const body = of(null)
      build(body.batches, body.points, null, group, materialFor)
      for (const part of recorder.parts) {
        const g = new THREE.Group()
        g.name = `part:${part.id}`
        g.userData.part = part.id
        g.position.set(part.pivot[0], part.pivot[1], part.pivot[2])
        g.rotation.y = part.ry
        g.updateMatrix()
        const drawn = of(part.id)
        build(drawn.batches, drawn.points, part.id, g, materialFor)
        rememberRest(g)
        group.add(g)
        parts[part.id] = g
      }
      if (spec && (options.mergeParts ?? quality === 'game')) mergeParts(THREE, group, parts, spec, { swayAmplitude: options.swayAmplitude })
      if (spec) tagDestruction(group, parts, spec)
      return { group, parts, lights: lightsOut, sources: sourcesOut }
    },
  }
}

/**
 * Copies the spec's destruction tags onto the objects: `userData.destructionMaterial` (SDK material id) and, on part groups,
 * `userData.destructionPart` (the part id, the key @adatechnology/game-destruction-three binds by), `userData.destructionPiece` and
 * `userData.destructionJoint`. Static meshes get the object default; the meshes of a part get the part's tags.
 * Parts merged into a shared group (blind slats) carry the tags of the first part of the group.
 */
function tagDestruction(group: ThreeNS.Group, parts: Record<string, ThreeNS.Group>, spec: ObjectSpec): void {
  const body = spec.destruction
  const partGroups = new Set<ThreeNS.Object3D>(Object.values(parts))
  if (body) {
    for (const child of group.children) {
      if (!partGroups.has(child) && (child as ThreeNS.Mesh).isMesh) child.userData.destructionMaterial = body.material
    }
  }
  const done = new Set<ThreeNS.Object3D>()
  for (const ps of spec.parts ?? []) {
    const g = parts[ps.id]
    const d = ps.destruction
    if (!g || !d || done.has(g)) continue
    done.add(g)
    for (const o of [g, ...g.children]) {
      if (o !== g && !(o as ThreeNS.Mesh).isMesh) continue
      o.userData.destructionMaterial = d.material
      o.userData.destructionPart = ps.id
      if (d.piece) o.userData.destructionPiece = d.piece
      if (d.joint) o.userData.destructionJoint = d.joint
    }
  }
}

function stripUndefined<T extends object>(o: T | undefined): Partial<T> {
  const out: Partial<T> = {}
  if (o) for (const k of Object.keys(o) as Array<keyof T>) if (o[k] !== undefined) out[k] = o[k]
  return out
}
