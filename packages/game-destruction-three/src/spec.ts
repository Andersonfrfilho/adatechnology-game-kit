import type * as THREE_NS from 'three'
import { guessMaterial, inferJoints } from '@adatechnology/game-destruction'
import type { JointKind, JointSpec, MaterialId, PartSpec } from '@adatechnology/game-destruction'
import type { Mesh, Object3D, SpecFromObjectOptions, SpecFromObjectResult, ThreeNamespace } from './types'

interface Entry {
  key: string
  meshes: Mesh[]
  box: THREE_NS.Box3
  material: MaterialId
  explicitId: string | null
  fill?: number
  hollow: boolean
  tags?: string[]
  /** Part id wished by the host (`userData.destructionPart`). */
  fixedId: boolean
  name: string
  /** `parent` / `kind` of an object-valued `destructionPart`: the part is attached to `parent` by a joint of that kind. */
  parent?: string
  jointKind?: JointKind
}

/** What `userData.destructionPart` says: a string (the part id) or an object `{ id, material?, parent?, kind? }`. */
export interface PartHint {
  id: string
  material?: string
  parent?: string
  kind?: string
}

/** Read `userData.destructionPart` (string or object with an `id`); null when it names no part. */
export function partHintOf(value: unknown): PartHint | null {
  if (typeof value === 'string') return value ? { id: value } : null
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || !v.id) return null
  const str = (x: unknown): string | undefined => (typeof x === 'string' && x ? x : undefined)
  return { id: v.id, material: str(v.material), parent: str(v.parent), kind: str(v.kind) }
}

const METAL = /steel|iron|metal|alumin|copper|brass|bronze|tin|titan|chrome|zinc|lead/i

function sanitizeId(name: string): string {
  let id = name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (id && /^[0-9]/.test(id)) id = `p_${id}`
  return id
}

function isMesh(o: Object3D): o is Mesh {
  return (o as Mesh).isMesh === true
}

function sizeOf(box: THREE_NS.Box3): [number, number, number] {
  return [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z]
}

/**
 * Build a `DestructibleSpec` from a three.js object: one part per mesh (meshes sharing `userData.destructionPart` become one part), each an
 * axis-aligned box in the root's space (rotation omitted), with the material taken from `options.materialOf`, `userData.destructionMaterial`
 * or a guess from the names. Tiny meshes are merged into the part they overlap most; joints are inferred from touching parts.
 *
 * Meshes that are invisible or have `userData.destructionIgnore` (or sit under such an object) are skipped. The result also tells which meshes
 * became which part, ready to be passed to `bind`.
 */
export function specFromObject3D(THREE: ThreeNamespace, root: Object3D, options: SpecFromObjectOptions = {}): SpecFromObjectResult {
  const fallback = options.fallback ?? 'plastic'
  const minSize = options.minSize ?? 0.015
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()

  // 1. collect meshes -> entries (grouped by an explicit part name)
  const entries: Entry[] = []
  const byKey = new Map<string, Entry>()
  const visit = (o: Object3D): void => {
    if (!o.visible || o.userData?.destructionIgnore) return
    if (isMesh(o) && o.geometry) {
      const geom = o.geometry
      if (!geom.boundingBox) geom.computeBoundingBox()
      if (geom.boundingBox && !geom.boundingBox.isEmpty()) {
        const box = geom.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        const matName = mats[0]?.name ?? ''
        const ud = o.userData ?? {}
        const hint = partHintOf(ud.destructionPart)
        const material =
          options.materialOf?.(o) ??
          (typeof ud.destructionMaterial === 'string' ? (ud.destructionMaterial as string) : undefined) ??
          hint?.material ??
          guessMaterial(`${o.name} ${matName} ${typeof ud.material === 'string' ? ud.material : ''}`) ??
          fallback
        const explicit = hint?.id ?? null
        const hollow = ud.hollow === true || /hollow/i.test(o.name)
        const fill = options.fillOf?.(o, material)
        const tags = Array.isArray(ud.destructionTags) ? (ud.destructionTags as string[]) : undefined
        const existing = explicit ? byKey.get(explicit) : undefined
        if (existing) {
          const before = sizeOf(existing.box)
          const bv = before[0] * before[1] * before[2]
          const ns = sizeOf(box)
          existing.box.union(box)
          existing.meshes.push(o)
          if (ns[0] * ns[1] * ns[2] > bv) existing.material = material
          existing.hollow = existing.hollow || hollow
          if (fill !== undefined) existing.fill = fill
        } else {
          const e: Entry = { key: explicit ?? `m${entries.length}`, meshes: [o], box, material, explicitId: explicit, fill, hollow, tags, fixedId: !!explicit, name: o.name, parent: hint?.parent, jointKind: hint?.kind as JointKind | undefined }
          entries.push(e)
          if (explicit) byKey.set(explicit, e)
        }
      }
    }
    for (const c of o.children) visit(c)
  }
  visit(root)

  // 2. merge tiny meshes into the touching part they overlap most
  const eps = 0.005
  const overlapVolume = (a: THREE_NS.Box3, b: THREE_NS.Box3): number => {
    const x = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) + eps
    const y = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) + eps
    const z = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) + eps
    return x > 0 && y > 0 && z > 0 ? x * y * z : 0
  }
  const largest = (e: Entry) => Math.max(...sizeOf(e.box))
  const kept: Entry[] = []
  const tiny: Entry[] = []
  for (const e of entries) (!e.fixedId && largest(e) < minSize ? tiny : kept).push(e)
  for (const t of tiny) {
    let best: Entry | null = null
    let bestV = 0
    for (const k of kept) {
      const v = overlapVolume(t.box, k.box)
      if (v > bestV) {
        bestV = v
        best = k
      }
    }
    if (!best) {
      // not touching anything: join the nearest part within a small distance
      let bd = 0.05
      for (const k of kept) {
        const d = k.box.distanceToPoint(t.box.getCenter(new THREE.Vector3()))
        if (d < bd) {
          bd = d
          best = k
        }
      }
    }
    if (best) {
      best.meshes.push(...t.meshes) // the box stays: a tiny mesh sits inside or on the surface of its part
    } else {
      kept.push(t) // isolated crumb: keep it as its own part
    }
  }

  // 3. ids, parts
  const used = new Set<string>()
  const parts: PartSpec[] = []
  const meshesOf: Record<string, Object3D[]> = {}
  let counter = 0
  for (const e of kept) {
    counter++
    let base = (e.explicitId ? sanitizeId(e.explicitId) : '') || sanitizeId(e.name) || `part_${counter}`
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}_${n}`
    used.add(id)
    base = id
    const size = sizeOf(e.box)
    const center = e.box.getCenter(new THREE.Vector3())
    const part: PartSpec = {
      id,
      material: e.material,
      shape: { kind: 'box', size: [Math.max(size[0], 0.002), Math.max(size[1], 0.002), Math.max(size[2], 0.002)] },
      position: [center.x, center.y, center.z],
    }
    const minSide = Math.min(...size)
    if (e.fill !== undefined) part.fill = e.fill
    else if (e.hollow) part.fill = 0.05
    if (minSide < 0.01 && METAL.test(e.material)) {
      part.fill = e.fill ?? 1
      part.thickness = Math.max(minSide, 0.0005)
    }
    if (e.tags) part.tags = [...e.tags]
    const ao = options.anchorBelow ?? -1
    if (ao >= 0 && e.box.min.y <= ao) part.anchored = true
    parts.push(part)
    meshesOf[id] = e.meshes
  }

  const spec: SpecFromObjectResult['spec'] = { parts }
  if (options.name !== undefined) spec.name = options.name
  else if (root.name) spec.name = root.name
  if (options.tags) spec.tags = [...options.tags]
  spec.joints = options.joints === false ? [] : inferJoints(parts)
  // explicit attachments from `destructionPart: { parent, kind }` win over the inferred joint between the same two parts
  if (options.joints !== false) {
    const finalId = new Map<Entry, string>()
    kept.forEach((e, i) => finalId.set(e, parts[i].id))
    const idOf = new Map<string, string>()
    for (const e of kept) if (e.explicitId) idOf.set(e.explicitId, finalId.get(e)!)
    const joints: JointSpec[] = spec.joints
    for (const e of kept) {
      if (!e.parent) continue
      const id = finalId.get(e)!
      const parent = idOf.get(e.parent) ?? (used.has(sanitizeId(e.parent)) ? sanitizeId(e.parent) : null)
      if (!parent || parent === id) continue
      const at = joints.findIndex((j) => (j.a === parent && j.b === id) || (j.a === id && j.b === parent))
      const kind = e.jointKind ?? (at >= 0 ? joints[at].kind : 'resting')
      const joint: JointSpec = { id: `${parent}~${id}`, a: parent, b: id, kind }
      if (at >= 0) joints[at] = joint
      else joints.push(joint)
    }
  }
  return { spec, parts: meshesOf }
}
