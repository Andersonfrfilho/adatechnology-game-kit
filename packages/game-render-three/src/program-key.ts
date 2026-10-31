import type { Material } from 'three'

/** What `programKeysOf` reads of a renderer: `properties` is internal to three r160 and may be absent in another version. */
export type PropertiesReader = { readonly properties?: { get(object: object): unknown } }

/**
 * Every program cache key three linked for `material` (one per state it was drawn in: fog type, shadow, light counts). Reads three's
 * internal `properties.get(material).programs` Map (r160). `[]` for a material never drawn; `undefined` when this three does not have
 * that internal, which sends the pools to their conservative mode.
 */
export function programKeysOf(renderer: PropertiesReader, material: Material): readonly string[] | undefined {
  const properties = renderer.properties
  if (typeof properties?.get !== 'function') return undefined
  const programs = (properties.get(material) as { programs?: unknown } | undefined)?.programs
  if (programs === undefined) return []
  if (!(programs instanceof Map)) return undefined
  return [...programs.keys()].map(String)
}
