import type { HeightRegion } from '@adatechnology/game-physics'

/** The smallest rectangle of samples of a height field (`size` a side, x fastest) that holds every one that differs between two versions of it; null when none differs. */
export const changedHeights = (before: Float32Array, after: Float32Array, size: number): HeightRegion | null => {
  let minX = size
  let maxX = -1
  let minZ = size
  let maxZ = -1
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (before[z * size + x] === after[z * size + x]) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
  }
  return maxX < 0 ? null : { x: minX, z: minZ, sizeX: maxX - minX + 1, sizeZ: maxZ - minZ + 1 }
}
