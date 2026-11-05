import type { Terrain } from './types'

const STRIDE = 0.72
const FOOT_LENGTH = 0.15
const FOOT_APART = 0.11

export interface Footprints {
  /** Call as the walker moves; it leaves a print each stride, left and right in turn. */
  update(x: number, z: number): void
  reset(): void
}

/** The trail of something walking: whoever moves on the ground reports where it is, and the ground keeps the prints it can keep. */
export function createFootprints(terrain: Terrain, options: { readonly stride?: number; readonly footLength?: number } = {}): Footprints {
  const stride = options.stride ?? STRIDE
  const footLength = options.footLength ?? FOOT_LENGTH
  let lastX: number | null = null
  let lastZ = 0
  let side = 1
  return {
    update(x, z) {
      if (lastX === null) {
        lastX = x
        lastZ = z
        return
      }
      const dx = x - lastX
      const dz = z - lastZ
      const walked = Math.hypot(dx, dz)
      if (walked < stride) return
      lastX = x
      lastZ = z
      // a jump of many strides is a teleport, not a walk
      if (walked > stride * 3) return
      const angle = Math.atan2(dx, dz)
      side = -side
      terrain.press({ x: x + (Math.cos(angle) * FOOT_APART * side), z: z - (Math.sin(angle) * FOOT_APART * side), radius: footLength, angle })
    },
    reset() {
      lastX = null
    },
  }
}
