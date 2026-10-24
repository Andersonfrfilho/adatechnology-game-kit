import type { AreaCap } from './types'

/** The game's cap (G68194-68202): from the 7th explosion within 40 m in 4 s, the extra ones are made at 0.3. */
export const AREA_CAP_GAME: AreaCap = { radius: 40, window: 4, count: 6, excessScale: 0.3 }

export interface AreaCapTracker {
  /** Registers an explosion at (`x`, `z`) at `time` seconds and answers the scale it gets: 1, or the cap's `excessScale` when `count` or more are already recent in the area. */
  register(time: number, x: number, z: number): number
  clear(): void
}

interface Recent {
  time: number
  x: number
  z: number
}

export function createAreaCap(cap: AreaCap): AreaCapTracker {
  const recent: Recent[] = []
  const spare: Recent[] = []
  const radiusSquared = cap.radius * cap.radius
  return {
    register(time, x, z) {
      let kept = 0
      for (const entry of recent) {
        if (time - entry.time < cap.window) recent[kept++] = entry
        else spare.push(entry)
      }
      recent.length = kept
      let near = 0
      for (const entry of recent) if ((entry.x - x) ** 2 + (entry.z - z) ** 2 < radiusSquared) near++
      const entry = spare.pop() ?? { time: 0, x: 0, z: 0 }
      entry.time = time
      entry.x = x
      entry.z = z
      recent.push(entry)
      return near >= cap.count ? cap.excessScale : 1
    },
    clear() {
      for (const entry of recent) spare.push(entry)
      recent.length = 0
    },
  }
}
