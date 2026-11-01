import type { Material } from 'three'

import type { PropertiesReader } from '../program-key'
import { type MaterialAnchors, createMaterialAnchors } from './anchors'
import { markPooled, pooledKey, roundedNumber } from './pooled'

export interface MaterialPool {
  /**
   * The material for `key`, built once. Shared: callers must not change it. Per-instance variety goes into instance attributes, not
   * into new materials.
   */
  acquire<TMaterial extends Material>(key: string, build: () => TMaterial): TMaterial
  release(material: Material): void
  /** Declares a variant that must never be disposed (its program stays linked). Effects register theirs at load. */
  register<TMaterial extends Material>(key: string, build: () => TMaterial): TMaterial
  /**
   * A material the caller owns and changes per frame (a puff's opacity): not shared. On `release` the first one of its program family is
   * handed to the anchors, so disposing the others never frees the program.
   */
  own<TMaterial extends Material>(build: () => TMaterial): TMaterial
  /** The materials declared with `register`: the ones that must never be disposed and whose programs the warmup draws once. */
  registeredMaterials?(): readonly Material[]
  /** Disposes unregistered materials with no use, oldest first, keeping at most `keep` idle ones; a family's anchor is kept alive. */
  trim(keep?: number): number
  stats(): { readonly entries: number; readonly registered: number; readonly inUse: number; readonly families: number }
  /**
   * The end of the pool: disposes every material it made, in use or not, registered or anchored (the guarantee that a program stays linked
   * holds while the pool lives, not after it). The anchors object itself is not touched, and the pool is empty and usable again afterwards.
   */
  dispose(): void
}

export type MaterialPoolOptions = { readonly anchors?: MaterialAnchors; readonly renderer?: PropertiesReader }

type Entry = { material: Material; uses: number; registered: boolean; idleSince: number; disposeForPool(): void }

const DEFAULT_KEY_STEP = 1e-3

/** Key from the material class and every parameter that changes its look, sorted, numbers rounded. */
export function materialKey(type: string, params: Readonly<Record<string, unknown>>): string {
  const parts = Object.keys(params)
    .sort()
    .map((name) => {
      const value = params[name]
      return `${name}=${typeof value === 'number' ? roundedNumber(value, DEFAULT_KEY_STEP) : JSON.stringify(value)}`
    })
  return [type, ...parts].join('|')
}

export function createMaterialPool(options: MaterialPoolOptions = {}): MaterialPool {
  const anchors = options.anchors ?? createMaterialAnchors()
  if (options.renderer !== undefined) anchors.bind(options.renderer)
  const entries = new Map<string, Entry>()
  const owned = new Map<Material, () => void>()
  let clock = 0

  function createEntry(key: string, material: Material, registered: boolean): Entry {
    const entry: Entry = { material, uses: 0, registered, idleSince: 0, ...markPooled(material, key, 'material') }
    entries.set(key, entry)
    return entry
  }

  /** Disposes the material unless it is the anchor of a program family. */
  function retire(material: Material, disposeForPool: () => void): boolean {
    if (anchors.offer(material)) return false
    disposeForPool()
    return true
  }

  return {
    acquire(key, build) {
      const entry = entries.get(key) ?? createEntry(key, build(), false)
      entry.uses++
      return entry.material as ReturnType<typeof build>
    },
    register(key, build) {
      const entry = entries.get(key) ?? createEntry(key, build(), true)
      entry.registered = true
      return entry.material as ReturnType<typeof build>
    },
    own(build) {
      const material = build()
      owned.set(material, markPooled(material, 'own', 'material').disposeForPool)
      return material
    },
    release(material) {
      const disposeOwned = owned.get(material)
      if (disposeOwned !== undefined) {
        owned.delete(material)
        retire(material, disposeOwned)
        return
      }
      const key = pooledKey(material)
      const entry = key === undefined ? undefined : entries.get(key)
      if (entry === undefined || entry.uses === 0) return
      entry.uses--
      if (entry.uses === 0) entry.idleSince = ++clock
    },
    trim(keep = 0) {
      const idle = [...entries].filter(([, entry]) => entry.uses === 0 && !entry.registered).sort((a, b) => a[1].idleSince - b[1].idleSince)
      let disposed = 0
      for (const [key, entry] of idle.slice(0, Math.max(0, idle.length - keep))) {
        entries.delete(key)
        if (retire(entry.material, entry.disposeForPool)) disposed++
      }
      return disposed
    },
    registeredMaterials() {
      return [...entries.values()].filter((entry) => entry.registered).map((entry) => entry.material)
    },
    stats() {
      const all = [...entries.values()]
      return {
        entries: all.length,
        registered: all.filter((entry) => entry.registered).length,
        inUse: all.filter((entry) => entry.uses > 0).length,
        families: anchors.size,
      }
    },
    dispose() {
      for (const entry of entries.values()) entry.disposeForPool()
      for (const disposeOwned of owned.values()) disposeOwned()
      entries.clear()
      owned.clear()
    },
  }
}
