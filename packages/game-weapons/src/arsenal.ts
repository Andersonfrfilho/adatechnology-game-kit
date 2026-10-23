import calibersJson from './data/calibers.json'
import weaponsJson from './data/weapons.json'
import { resolveStrings } from './locale'
import type { Arsenal, ArsenalOptions, CaliberDef, CaliberId, WeaponCategory, WeaponDef, WeaponId, WeaponState } from './types'
import { muzzleEnergy, WeaponRuntime } from './weapon'

export const CALIBERS = calibersJson as unknown as CaliberDef[]
export const WEAPONS = weaponsJson as unknown as WeaponDef[]

/** A reasonable starting kit for a test room or a sandbox. */
export const DEFAULT_LOADOUT: WeaponId[] = [
  'hand', 'pistol_9mm', 'revolver_357', 'shotgun_pump_12', 'rifle_5_56', 'rifle_bolt_308', 'hammer', 'axe', 'crowbar', 'lighter', 'flamethrower',
  'cutting_torch', 'molotov', 'frag_grenade', 'screwdriver', 'wrench', 'pry_bar', 'hacksaw', 'extinguisher',
]

export { muzzleEnergy }

/** Create an arsenal: the built-in calibres and weapons merged (by id) with the ones in `options`. */
export const createArsenal = (options: ArsenalOptions = {}): Arsenal => {
  const calibers = new Map<CaliberId, CaliberDef>()
  for (const c of [...CALIBERS, ...(options.calibers ?? [])]) calibers.set(c.id, c)
  const weapons = new Map<WeaponId, WeaponDef>()
  for (const w of [...WEAPONS, ...(options.weapons ?? [])]) weapons.set(w.id, w)
  const strings = resolveStrings(options.locale)
  const baseSeed = options.seed ?? 1
  let counter = 0

  const create = (id: WeaponId, opts: { seed?: number; reserve?: number } = {}): WeaponState => {
    const def = weapons.get(id)
    if (!def) throw new Error(`game-weapons: unknown weapon "${id}"`)
    let caliber: CaliberDef | null = null
    if (def.action.kind === 'firearm') {
      caliber = calibers.get(def.action.caliber) ?? null
      if (!caliber) throw new Error(`game-weapons: weapon "${id}" uses unknown calibre "${def.action.caliber}"`)
    }
    counter += 1
    const seed = opts.seed ?? (baseSeed + Math.imul(counter, 0x9e3779b1)) >>> 0
    return new WeaponRuntime({ def, caliber, seed, reserve: opts.reserve })
  }

  return {
    calibers,
    weapons,
    create,
    muzzleEnergy(caliber, barrel = 1) {
      const c = calibers.get(caliber)
      if (!c) throw new Error(`game-weapons: unknown calibre "${caliber}"`)
      return muzzleEnergy(c, barrel)
    },
    name(id) {
      const w = weapons.get(id)
      if (w) return strings.weapons[id] ?? w.name ?? id
      return strings.modes[id] ?? strings.categories[id] ?? calibers.get(id)?.label ?? id
    },
    list(category?: WeaponCategory) {
      const all = [...weapons.values()]
      return category ? all.filter((w) => w.category === category) : all
    },
  }
}
