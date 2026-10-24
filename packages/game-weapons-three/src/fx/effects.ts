import type * as THREE_NS from 'three'
import type { EffectSink, Vec3 } from '@adatechnology/game-contracts'

/** Flash size by case: shells flash biggest, rimfire smallest (the page's `flashK`). */
export const FLASH_BY_CASE = { shell: 1.6, big: 2.6, tiny: 0.5, pistol: 0.8, rifle: 1.2 } as const

/** The ids of the recipes of `@adatechnology/game-vfx` the weapon in the hands asks the host's effect sink for (`VIEWMODEL_EFFECTS`). */
export const VIEWMODEL_EFFECT_IDS = { flash: 'viewmodel_muzzle_flash', smoke: 'weapon_smoke_puff', backblast: 'launcher_backblast', flameJet: 'flame_jet' } as const

export interface Effects {
  /** The muzzle flash at `position` pointing along the barrel of `orientation` (x), with six puffs of smoke. */
  muzzleFlash(position: THREE_NS.Vector3, orientation: THREE_NS.Quaternion, size: number): void
  /** A puff that rises, grows and fades: the gallery's `smoke(position, velocity, size, life, opacity)`, with `size` its radius. */
  smoke(position: THREE_NS.Vector3, velocity: THREE_NS.Vector3, size: number, life: number, opacity: number): void
  /** A rocket leaving the tube: smoke and fire thrown back from `rear`, away from `forward`. */
  backblast(rear: THREE_NS.Vector3, forward: THREE_NS.Vector3): void
  /** One frame of a flamethrower's jet from `muzzle` along `forward`: fire thrown ahead and, half the frames, smoke. */
  flameJet(muzzle: THREE_NS.Vector3, forward: THREE_NS.Vector3, dt: number, scale: number): void
}

const vec = (vector: THREE_NS.Vector3): Vec3 => [vector.x, vector.y, vector.z]

/**
 * The gallery's first-person effects (the muzzle flash, the puffs of smoke, the backblast and the flame jet) played through the host's effect sink, as recipes of the Workshop
 * (`game-vfx`) with the gallery's numbers: no mesh and no particle of this package. A host without a sink shows none of them. Each play draws one seed from the viewmodel's
 * stream, so the scatter repeats with the viewmodel's seed.
 */
export function createEffects(THREE: typeof THREE_NS, sink: EffectSink | undefined, random: () => number): Effects {
  const seed = (): number => 1 + Math.floor(random() * 0x7ffffffe)
  return {
    muzzleFlash(position, orientation, size) {
      const barrel = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation)
      sink?.play({ effect: VIEWMODEL_EFFECT_IDS.flash, point: vec(position), direction: vec(barrel), seed: seed(), values: { size } })
    },
    smoke(position, velocity, size, life, opacity) {
      sink?.play({ effect: VIEWMODEL_EFFECT_IDS.smoke, point: vec(position), seed: seed(), values: { vx: velocity.x, vy: velocity.y, vz: velocity.z, radius: size, life, opacity } })
    },
    backblast(rear, forward) {
      sink?.play({ effect: VIEWMODEL_EFFECT_IDS.backblast, point: vec(rear), direction: vec(forward), seed: seed() })
    },
    flameJet(muzzle, forward, dt, scale) {
      sink?.play({ effect: VIEWMODEL_EFFECT_IDS.flameJet, point: vec(muzzle), direction: vec(forward), seed: seed(), values: { dt, scale } })
    },
  }
}
