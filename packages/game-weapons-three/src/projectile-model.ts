import type * as THREE_NS from 'three'

import { buildWeaponModelById } from './models'
import { modelKit } from './models/kit'
import { buildFlyingRocket } from './models/launcher-rounds'

/** What a host asks for a thrown or set down explosive: the weapon in the hand, the explosive it carries and how it is used (`rocket`, `grenade`, `molotov`, `charge`). */
export interface ProjectileQuery {
  readonly weapon: string
  readonly explosive?: string | undefined
  readonly kind: string
}

/** The model of a projectile and the axis along its length. */
export interface ProjectileModel {
  readonly model: THREE_NS.Object3D
  readonly axis: [number, number, number]
}

/**
 * The model of what a weapon throws or fires, drawn by the same code as the weapon itself: the round of a rocket launcher (the RPG-7's PG-7V, the Carl Gustaf's 84 mm round, the rocket of
 * the disposable tubes), long axis +x. Answers `null` where the gallery has no model: the throwables (grenades, molotovs, dynamite, C4, the Claymore) and the grenade launchers are
 * still the plain props of `weaponProp`, and a host keeps its primitive for them.
 */
export function projectileModel(THREE: typeof THREE_NS, query: ProjectileQuery): ProjectileModel | null {
  if (query.kind !== 'rocket') return null
  const launcher = buildWeaponModelById(THREE, query.weapon)
  if (!launcher || launcher.parts.family !== 'rocket') return null
  const round = launcher.parts.makeRound ? launcher.parts.makeRound() : buildFlyingRocket(modelKit(THREE), launcher.parts.launcherType)
  return { model: round, axis: [1, 0, 0] }
}
