const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** A seed for one thing of the site, from the site's seed and the id of the thing: the same site always gives the same house to the same lot (FNV-1a). */
export function seedOf(base: number, id: string): number {
  let hash = (FNV_OFFSET ^ base) >>> 0
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), FNV_PRIME) >>> 0
  return hash % 1_000_000
}
