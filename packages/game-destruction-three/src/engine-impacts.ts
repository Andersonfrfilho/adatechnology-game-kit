import type { DestructionWorld, Hit } from '@adatechnology/game-destruction'
import { createImpactReader } from '@adatechnology/game-physics'
import type { BodyId, PhysicsLoop } from '@adatechnology/game-physics'

import type { EngineStatics } from './engine-statics'

export interface EngineImpactsOptions {
  /** Blows under this impulse (N s) do nothing. Default 30. */
  readonly minImpulse?: number
  /** Most fixed parts hit in a frame, in the order the engine met them. Default 32. */
  readonly hitsMax?: number
  /** Blows closing slower than this (m/s) do nothing: a pile settling or resting on a part presses with impulse but does not hit. Default 1.5. */
  readonly minApproach?: number
  /** The radius (m) of the blunt contact. Default 0.1. */
  readonly contactRadius?: number
  /** Bodies whose blows hit nothing: the debris left of a part that broke (`rubble`), which breaks nothing of the world. Default none. */
  readonly harmless?: (body: BodyId) => boolean
}

const DEFAULT_MIN_IMPULSE = 30
const DEFAULT_HITS_MAX = 32
const DEFAULT_MIN_APPROACH = 1.5
const DEFAULT_CONTACT_RADIUS = 0.1

/**
 * What hits a fixed part of the drawn world is a `blunt` hit of the destruction world: in the frame's contact rows, the strongest blow on each fixed body becomes
 * `hitPart(object, part, ...)` with the energy the blow gave it, about `impulse x approach / 2` (the work of a blow with no bounce), along the way the other body was going. A flying
 * piece into a wall, a slab onto a crate: the cascade of a blast takes the next wall by itself. Nothing is made per row; one `Hit` is made per part hit. Returns the way to stop it.
 */
export const createEngineImpacts = (loop: PhysicsLoop, statics: EngineStatics, destruction: DestructionWorld, options: EngineImpactsOptions = {}): (() => void) => {
  const hitsMax = options.hitsMax ?? DEFAULT_HITS_MAX
  const radius = options.contactRadius ?? DEFAULT_CONTACT_RADIUS
  const minApproach = options.minApproach ?? DEFAULT_MIN_APPROACH
  return createImpactReader(loop, {
    minImpulse: options.minImpulse ?? DEFAULT_MIN_IMPULSE,
    bodiesMax: hitsMax,
    accepts: (body: BodyId) => statics.ownerOf.has(body),
    onImpact: (impact) => {
      if (impact.approach < minApproach) return
      // debris is no object of the world: what is left of a column that crumbled does not crack the roof it was holding up
      if (options.harmless?.(impact.other)) return
      const object = statics.ownerOf.get(impact.body)
      const part = statics.partOf.get(impact.body)
      if (object === undefined || part === undefined || destruction.part(object, part) === null) return
      const hit: Hit = {
        type: 'blunt',
        point: [impact.point[0], impact.point[1], impact.point[2]],
        direction: [-impact.normal[0], -impact.normal[1], -impact.normal[2]],
        energy: 0.5 * impact.impulse * impact.approach,
        radius,
        part,
        source: 'engine',
      }
      destruction.hitPart(object, part, hit)
    },
  })
}
