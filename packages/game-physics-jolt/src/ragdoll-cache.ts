import type JoltNS from 'jolt-physics/wasm-compat'

import type { ShapeDesc } from '@adatechnology/game-physics'

import type { JoltWorldHost } from './world-host'

/** The most shapes (and skeletons) held for ragdolls: a kit's bodies come in a few sizes, a caller with a new size every time must not fill the heap; the least recently used goes. */
const RAGDOLL_SHAPES_MAX = 64

/** What a ragdoll's shared pieces are held in: the shapes by their exact dimensions and the skeletons by their parent list; both let go of at `dispose`. */
export interface RagdollCache {
  readonly shapes: Map<string, JoltNS.Shape>
  readonly skeletons: Map<string, { readonly skeleton: JoltNS.Skeleton; readonly holder: JoltNS.RagdollSettings }>
}

export const createRagdollCache = (): RagdollCache => ({ shapes: new Map(), skeletons: new Map() })

export const shapeKey = (shape: ShapeDesc): string | null => {
  switch (shape.kind) {
    case 'capsule':
    case 'cylinder':
      return `${shape.kind}:${shape.halfHeight},${shape.radius}`
    case 'sphere':
      return `sphere:${shape.radius}`
    case 'box':
      return `box:${shape.half[0]},${shape.half[1]},${shape.half[2]}`
    default:
      return null
  }
}

/** The shape of a ragdoll part, with a reference for the caller to let go of: the same made shape for the same dimensions (a body of any pose takes it). */
export const ragdollShape = (w: JoltWorldHost, desc: ShapeDesc): JoltNS.Shape => {
  const key = shapeKey(desc)
  if (key === null) return w.makeShape(desc)
  const held = w.ragdollCache.shapes.get(key)
  if (held) {
    w.ragdollCache.shapes.delete(key)
    w.ragdollCache.shapes.set(key, held)
    held.AddRef()
    return held
  }
  if (w.ragdollCache.shapes.size >= RAGDOLL_SHAPES_MAX) {
    const [oldest, shape] = w.ragdollCache.shapes.entries().next().value as [string, JoltNS.Shape]
    shape.Release()
    w.ragdollCache.shapes.delete(oldest)
  }
  const made = w.makeShape(desc)
  w.ragdollCache.shapes.set(key, made)
  made.AddRef()
  return made
}

/** The skeleton of a ragdoll with these parents (the settings keep it by reference, so ragdolls of one kit share it). */
export const ragdollSkeleton = (w: JoltWorldHost, parents: readonly number[]): JoltNS.Skeleton => {
  const key = parents.join(',')
  const held = w.ragdollCache.skeletons.get(key)
  if (held) {
    w.ragdollCache.skeletons.delete(key)
    w.ragdollCache.skeletons.set(key, held)
    return held.skeleton
  }
  if (w.ragdollCache.skeletons.size >= RAGDOLL_SHAPES_MAX) {
    const [oldest, { holder: oldHolder }] = w.ragdollCache.skeletons.entries().next().value as [string, { holder: JoltNS.RagdollSettings }]
    w.J.destroy(oldHolder)
    w.ragdollCache.skeletons.delete(oldest)
  }
  const J = w.J
  const skeleton = new J.Skeleton()
  parents.forEach((parent, i) => {
    const name = new J.JPHString(`part${i}`, `part${i}`.length)
    skeleton.AddJoint(name, parent)
    J.destroy(name)
  })
  // a settings object that does nothing but hold the cache's reference: a ragdoll's settings let go of theirs when it is removed, and the last one would free the skeleton
  const holder = new J.RagdollSettings()
  holder.mSkeleton = skeleton
  w.ragdollCache.skeletons.set(key, { skeleton, holder })
  return skeleton
}

export const releaseRagdollCache = (w: JoltWorldHost): void => {
  for (const shape of w.ragdollCache.shapes.values()) shape.Release()
  for (const { holder } of w.ragdollCache.skeletons.values()) w.J.destroy(holder)
  w.ragdollCache.shapes.clear()
  w.ragdollCache.skeletons.clear()
}
