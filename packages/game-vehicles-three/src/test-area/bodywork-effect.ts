import type { Vec3 } from '@adatechnology/game-contracts'

/** The fields of a vehicle's destruction event the module turns into effect requests. */
export interface VehicleEffectEvent {
  readonly type: string
  readonly part?: string
  readonly point?: Vec3
  readonly worldPoint?: Vec3
  /** `hole`: the panel's normal at the hit, world. */
  readonly worldNormal?: Vec3
  /** `hole`: the round's path, world. */
  readonly direction?: Vec3
  /** `hole`: the hole the round made. */
  readonly hole?: { readonly diameter: number }
}

/** The values `impact_bodywork` (`game-vfx`) reads, from a `hole` event: the hole's size, the round's path and the car's paint. */
export function bodyworkValues(event: VehicleEffectEvent, paint: number | undefined): Record<string, number> {
  const direction = event.direction
  return {
    ...(event.hole ? { bore: event.hole.diameter } : {}),
    ...(paint !== undefined ? { paint } : {}),
    ...(direction ? { dx: direction[0], dy: direction[1], dz: direction[2] } : {}),
  }
}

/** A hole this wide or wider, metres, is a heavy round's (a 12 ga slug, a .50): the heavier recording. */
const HEAVY_BORE = 0.012
/** Of a round into the thin sheet: the level of a 9 mm hole, and the most and the least any round plays at. */
const PISTOL_BORE = 0.009
const PISTOL_LEVEL = 0.6
const LOUDEST = 1
const QUIETEST = 0.35

/** The sound of a round into the body's thin sheet, by the hole it made: louder and heavier the bigger the round; a pellet that only dented it is a light tick. */
export function skinHitSound(bore: number | undefined, ids: { readonly skinHit: string; readonly skinHitHeavy: string }): { readonly sound: string; readonly volume: number } {
  const size = bore ?? 0
  const volume = Math.min(LOUDEST, Math.max(QUIETEST, PISTOL_LEVEL * (size > 0 ? size / PISTOL_BORE : 0.6)))
  return { sound: size >= HEAVY_BORE ? ids.skinHitHeavy : ids.skinHit, volume }
}
