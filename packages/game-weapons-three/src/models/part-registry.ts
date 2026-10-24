import type * as THREE_NS from 'three'
import type { ModelParts } from './types'

const SINGLE_PARTS = ['slide', 'bolt', 'boltHandle', 'mag', 'trigger', 'hammer', 'lever', 'pump', 'belt', 'cover', 'crane', 'cylinder', 'barrels', 'safety', 'muzzle', 'eject', 'loadPort', 'topLoad', 'rear', 'round', 'gauge'] as const

/** The parts of a model by the id the clips use: `slide`, `mag`, `trigger`..., `breech_0`, `chamber_3`. */
export function partRegistry(parts: ModelParts): Map<string, THREE_NS.Object3D> {
  const registry = new Map<string, THREE_NS.Object3D>()
  for (const key of SINGLE_PARTS) {
    const part = parts[key]
    if (part) registry.set(key, part)
  }
  parts.breech?.forEach((part, index) => registry.set(`breech_${index}`, part))
  parts.chambers?.forEach((part, index) => registry.set(`chamber_${index}`, part))
  return registry
}
