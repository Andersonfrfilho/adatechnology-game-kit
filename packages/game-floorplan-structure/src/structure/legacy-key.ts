/** The string hash of the floor plan engine (`engine.hashString`), copied so that this package never imports the engine at run time. */
export function hashLegacyKey(key: string): number {
  let hash = 1779033703 ^ key.length
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
  return (hash ^ (hash >>> 16)) >>> 0
}
