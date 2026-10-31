import type { Fog, FogBase, FogExp2, Scene } from 'three'

import type { ThreeLib } from './three-lib'

/** Both exact in half precision (multiples of 32 under 65 504), so the neutral fog survives a `mediump` fragment shader. */
export const NEUTRAL_FOG_NEAR = 6.0e4
export const NEUTRAL_FOG_FAR = 6.4e4

export interface FogOptions {
  /** `clear()` leaves a neutral linear Fog instead of `null`: the fog presence and type never change, so no program recompiles. */
  readonly stable?: boolean
  /** Colour of the neutral fog. Default 0x000000. */
  readonly color?: number
}

export interface FogController {
  useLinear(color: number, near: number, far: number): Fog
  useExp2(color: number, density: number): FogExp2
  /** Back to no fog: the original fog (or `null`); when `stable`, the host's own linear fog or the neutral one, never `null`. */
  clear(): void
}

function isLinearFog(fog: FogBase | null): fog is Fog {
  return (fog as Partial<Fog> | null)?.isFog === true
}

function isExp2Fog(fog: FogBase | null): fog is FogExp2 {
  return (fog as Partial<FogExp2> | null)?.isFogExp2 === true
}

export function isNeutralFog(fog: unknown): boolean {
  const candidate = fog as Partial<Fog> | null | undefined
  return candidate?.isFog === true && candidate.near === NEUTRAL_FOG_NEAR && candidate.far === NEUTRAL_FOG_FAR
}

/** Writes into the scene's existing fog object when its type matches, as the weather layer does, so nothing is reallocated per change. */
export function createFog(THREE: Pick<ThreeLib, 'Fog' | 'FogExp2'>, scene: Scene, options: FogOptions = {}): FogController {
  const original = scene.fog
  const hostLinear = isLinearFog(original) ? { color: original.color.getHex(), near: original.near, far: original.far } : undefined
  const resting = hostLinear ?? { color: options.color ?? 0, near: NEUTRAL_FOG_NEAR, far: NEUTRAL_FOG_FAR }
  return {
    useLinear(color, near, far) {
      const current = scene.fog
      if (isLinearFog(current)) {
        current.color.set(color)
        current.near = near
        current.far = far
        return current
      }
      const fog = new THREE.Fog(color, near, far)
      scene.fog = fog
      return fog
    },
    useExp2(color, density) {
      const current = scene.fog
      if (isExp2Fog(current)) {
        current.color.set(color)
        current.density = density
        return current
      }
      const fog = new THREE.FogExp2(color, density)
      scene.fog = fog
      return fog
    },
    clear() {
      if (options.stable !== true) {
        scene.fog = original
        return
      }
      const current = scene.fog
      if (isLinearFog(current)) {
        current.color.set(resting.color)
        current.near = resting.near
        current.far = resting.far
        return
      }
      scene.fog = new THREE.Fog(resting.color, resting.near, resting.far)
    },
  }
}
