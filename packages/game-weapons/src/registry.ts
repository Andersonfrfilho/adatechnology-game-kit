import { nominalFuse } from './fuse'
import type { ExplosiveDef, WeaponDef } from './types'

/** A throwable that names an explosive takes its energy, noise, lethal radius, fuse (the nominal one, when it is sampled per throw) and fire from it, so changing the explosive changes the throwable. */
export const resolveThrowables = (weapons: Map<string, WeaponDef>, explosives: ReadonlyMap<string, ExplosiveDef>): void => {
  for (const [id, def] of weapons) {
    if (def.action.kind !== 'throwable' || def.action.explosive === undefined) continue
    const explosive = explosives.get(def.action.explosive)
    if (!explosive) continue
    const radius = explosive.lethalRadius > 0 ? explosive.lethalRadius : def.action.radius
    const fire = explosive.fire ? { ...explosive.fire } : def.action.fire
    weapons.set(id, { ...def, action: { ...def.action, energy: explosive.energy, noise: explosive.noise, radius, fuse: nominalFuse(explosive) ?? def.action.fuse, ...(fire ? { fire } : {}) } })
  }
}
