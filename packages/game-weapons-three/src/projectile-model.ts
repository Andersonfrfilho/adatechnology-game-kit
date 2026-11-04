import { markKitOrigin } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'

import { buildWeaponModelById } from './models'
import { buildExplosiveModel } from './models/explosives'
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
 * the disposable tubes), long axis +x, and the explosives of the gallery (the M67, the molotov, the pipe bomb, the dynamite, the C4, the Claymore, the flashbang), centred, axis +y.
 * Answers `null` where the gallery has no model (the 40 mm grenade of a launcher), and a host keeps its primitive for it.
 */
export function projectileModel(THREE: typeof THREE_NS, query: ProjectileQuery): ProjectileModel | null {
  if (query.kind !== 'rocket') return explosiveProjectile(THREE, query)
  const launcher = buildWeaponModelById(THREE, query.weapon)
  if (!launcher || launcher.parts.family !== 'rocket') return null
  const round = launcher.parts.makeRound ? launcher.parts.makeRound() : buildFlyingRocket(modelKit(THREE), launcher.parts.launcherType)
  return { model: round, axis: [1, 0, 0] }
}

// a thrown or set down explosive the gallery drew: its model centred on its middle (it tumbles about it in flight), standing axis +y
function explosiveProjectile(THREE: typeof THREE_NS, query: ProjectileQuery): ProjectileModel | null {
  const model = query.explosive === undefined ? undefined : buildExplosiveModel(THREE, query.explosive)
  if (!model) return null
  const centre = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3())
  const holder = markKitOrigin(new THREE.Group(), { owner: 'game-weapons-three', kind: 'explosive', id: model.name })
  holder.name = model.name
  model.position.sub(centre)
  holder.add(model)
  return { model: holder, axis: [0, 1, 0] }
}
