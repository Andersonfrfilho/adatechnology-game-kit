import type { Material } from 'three'

import { type PropertiesReader, programKeysOf } from '../program-key'

/** Materials kept alive and never disposed, one per program family: what keeps a program linked once its users are gone. */
export interface MaterialAnchors {
  /**
   * Keeps `material` if any of its program keys has no anchor yet; returns true when it was kept (the caller must then not dispose it).
   * A material whose keys are all covered returns false and may be disposed. A material never drawn is not kept.
   */
  offer(material: Material): boolean
  readonly size: number
  /** Where program keys are read from. Until bound (or when three has no readable keys) every offered material is kept. */
  bind(renderer: PropertiesReader): void
}

export function createMaterialAnchors(renderer?: PropertiesReader): MaterialAnchors {
  const anchors = new Set<Material>()
  let reader = renderer

  function coveredKeys(): Set<string> {
    const covered = new Set<string>()
    if (reader === undefined) return covered
    for (const anchor of anchors) for (const key of programKeysOf(reader, anchor) ?? []) covered.add(key)
    return covered
  }

  return {
    get size() {
      return anchors.size
    },
    bind(next) {
      reader = next
    },
    offer(material) {
      if (anchors.has(material)) return true
      const keys = reader === undefined ? undefined : programKeysOf(reader, material)
      if (keys === undefined) {
        anchors.add(material)
        return true
      }
      if (keys.length === 0) return false
      const covered = coveredKeys()
      if (keys.every((key) => covered.has(key))) return false
      anchors.add(material)
      return true
    },
  }
}
