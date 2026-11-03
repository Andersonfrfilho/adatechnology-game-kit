import * as THREE from 'three'
import type * as THREE_NS from 'three'
import { itemModels } from '@adatechnology/game-items-three'
import { createArsenal } from '@adatechnology/game-weapons'
import { BODY_ACTIONS, buildProp, buildWeaponModelById, hasWeaponModel, weaponProp, worldExplosiveItem, WORLD_EXPLOSIVE_IDS } from '@adatechnology/game-weapons-three'

import type { View } from './project'

export interface ThumbnailSubject {
  /** Weapon id, or explosive id for what stands in the world. */
  readonly id: string
  readonly view: View
  readonly build: () => THREE_NS.Object3D
}

/**
 * Everything that gets a thumbnail: each weapon of the arsenal that is not a body action (its gallery model, or the simple prop the counters show when the gallery drew
 * none) and each explosive that stands in the world. Sorted by id so the order never depends on the registry.
 */
export function thumbnailSubjects(): ThumbnailSubject[] {
  const arsenal = createArsenal({ locale: 'en' })
  const weapons = [...arsenal.weapons.values()]
    .filter((def) => !BODY_ACTIONS.has(def.id))
    .map((def): ThumbnailSubject =>
      hasWeaponModel(def.id)
        ? { id: def.id, view: 'side', build: () => (buildWeaponModelById(THREE, def.id) as NonNullable<ReturnType<typeof buildWeaponModelById>>).root }
        : { id: def.id, view: 'top', build: () => buildProp(THREE, weaponProp(def)) },
    )
  const explosives = WORLD_EXPLOSIVE_IDS.flatMap((id) => {
    const def = arsenal.explosives.get(id)
    const item = def ? worldExplosiveItem(def, id, { items: itemModels }) : undefined
    return item ? [{ id, view: 'side' as const, build: () => item.build(THREE) as THREE_NS.Object3D }] : []
  })
  return [...weapons, ...explosives].sort((a, b) => (a.id < b.id ? -1 : 1))
}

export { THREE }
