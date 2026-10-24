/** FNV-1a 32 over `round(value · 1e4)` of every element: the hash the Chrome captures wrote into the fixtures. */
export const fnvOfArray = (array: ArrayLike<number>): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < array.length; index++) hash = Math.imul(hash ^ (Math.round((array[index] as number) * 1e4) | 0), 0x01000193) >>> 0
  return hash.toString(16).padStart(8, '0')
}
