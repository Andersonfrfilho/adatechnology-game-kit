import type * as THREE_NS from 'three'
import { markShared } from '@adatechnology/game-shapes-three'

import type { ModelKit } from './kit'

// triangulating an outline (an extrusion with arcs, splines or holes) is the slow part of a model: each one is built once per kit and shared by every model that uses it
const shared = new WeakMap<ModelKit, Map<string, THREE_NS.BufferGeometry>>()

/** The geometry `key` names for this kit, built by `build` the first time and marked shared (released with the kit, never with a model). */
export function sharedGeometry(kit: ModelKit, key: string, build: () => THREE_NS.BufferGeometry): THREE_NS.BufferGeometry {
  const cache = shared.get(kit) ?? new Map<string, THREE_NS.BufferGeometry>()
  shared.set(kit, cache)
  let geometry = cache.get(key)
  if (!geometry) {
    geometry = build()
    markShared(geometry)
    cache.set(key, geometry)
  }
  return geometry
}
