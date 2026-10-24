import attachmentsJson from './data/attachments.json'
import archetypesJson from './data/archetypes.json'
import calibersJson from './data/calibers.json'
import explosivesJson from './data/explosives.json'
import explosiveWeaponsJson from './data/explosive-weapons.json'
import firearmsJson from './data/firearms.json'
import launchersJson from './data/launchers.json'
import { canFit as canFitAttachment } from './attachments'
import { checkArsenal, findDuplicateIds } from './check-arsenal'
import { resolveStrings } from './locale'
import { deepMerge } from './merge'
import { applyPatches, mergeById, removeIds, resolveThrowables } from './registry'
import { DEFAULT_RULES } from './rules'
import type { AttachmentDef, FittedAttachment, MountKind, WeaponSnapshot } from './attachment-types'
import type { Arsenal, ArsenalOptions, CaliberDef, CaliberId, ExplosiveDef, WeaponCategory, WeaponDef, WeaponId, WeaponState } from './types'
import { createExplosiveBody } from './explosive-body'
import { muzzleEnergy, WeaponRuntime } from './weapon'

export const CALIBERS = calibersJson as unknown as CaliberDef[]
export const ATTACHMENTS = attachmentsJson as unknown as AttachmentDef[]
export const EXPLOSIVES = explosivesJson as unknown as ExplosiveDef[]
/** The generic weapons: handling numbers (spread, bloom, range, recoil) by type, which the real models point to through `archetype`. */
const ARCHETYPES = archetypesJson as unknown as WeaponDef[]
export const ARCHETYPE_IDS: readonly WeaponId[] = ARCHETYPES.map((def) => def.id)
export const WEAPONS: WeaponDef[] = [...ARCHETYPES, ...(firearmsJson as unknown as WeaponDef[]), ...(launchersJson as unknown as WeaponDef[]), ...(explosiveWeaponsJson as unknown as WeaponDef[])]

/** A reasonable starting kit for a test room or a sandbox. */
export const DEFAULT_LOADOUT: WeaponId[] = [
  'hand', 'kick', 'shove', 'pistol_9mm', 'revolver_357', 'shotgun_pump_12', 'rifle_5_56', 'rifle_bolt_308', 'hammer', 'axe', 'machete', 'utility_knife', 'crowbar', 'lighter', 'flamethrower',
  'cutting_torch', 'molotov', 'frag_grenade', 'screwdriver', 'wrench', 'pry_bar', 'hacksaw', 'extinguisher',
]

export { muzzleEnergy, checkArsenal }

const explosiveOf = (def: WeaponDef, explosives: ReadonlyMap<string, ExplosiveDef>): ExplosiveDef | null => {
  const id = def.action.kind === 'launcher' ? def.action.projectile : def.action.kind === 'throwable' ? def.action.explosive : undefined
  return id === undefined ? null : explosives.get(id) ?? null
}

const energyOf = (def: WeaponDef, calibers: ReadonlyMap<CaliberId, CaliberDef>, explosives: ReadonlyMap<string, ExplosiveDef>): number => {
  const action = def.action
  if (action.kind === 'firearm') {
    const caliber = calibers.get(action.caliber)
    const speed = action.muzzleSpeed ?? (caliber?.muzzleSpeed ?? 0) * (action.barrel ?? 1)
    return 0.5 * ((caliber?.bulletGrams ?? 0) / 1000) * speed * speed
  }
  if (action.kind === 'launcher') return explosives.get(action.projectile)?.energy ?? 0
  return action.kind === 'throwable' || action.kind === 'melee' ? action.energy : 0
}

/**
 * Create an arsenal. Order: the shipped entries, then `calibers`/`weapons`/`explosives` (added or replaced by id), then `patch`, then `remove`, then `include`;
 * a throwable that names an explosive follows that explosive. Every inconsistency found is reported in one error.
 */
export const createArsenal = (options: ArsenalOptions = {}): Arsenal => {
  const calibers = mergeById(CALIBERS, options.calibers)
  const explosives = mergeById(EXPLOSIVES, options.explosives)
  const weapons = mergeById(WEAPONS, options.weapons)
  const attachments = mergeById(ATTACHMENTS, options.attachments)
  applyPatches(calibers, options.patch?.calibers)
  applyPatches(explosives, options.patch?.explosives)
  applyPatches(attachments, options.patch?.attachments)
  resolveThrowables(weapons, explosives)
  applyPatches(weapons, options.patch?.weapons)
  removeIds(calibers, options.remove?.calibers)
  removeIds(explosives, options.remove?.explosives)
  removeIds(attachments, options.remove?.attachments)
  removeIds(weapons, options.remove?.weapons)
  if (options.include) for (const [id, def] of weapons) if (!options.include(def)) weapons.delete(id)

  const rules = deepMerge(DEFAULT_RULES, options.rules)
  const problems = [
    ...findDuplicateIds('calibre', options.calibers),
    ...findDuplicateIds('weapon', options.weapons),
    ...findDuplicateIds('explosive', options.explosives),
    ...findDuplicateIds('attachment', options.attachments),
    ...checkArsenal({ weapons, calibers, explosives, attachments, rules }),
  ]
  if (problems.length > 0) throw new Error(`game-weapons: the arsenal is not consistent:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)

  const strings = resolveStrings(options.locale, options.strings)
  const baseSeed = options.seed ?? 1
  let counter = 0

  const create = (id: WeaponId, opts: { seed?: number; reserve?: number; condition?: string; ammoQuality?: string; snapshot?: WeaponSnapshot } = {}): WeaponState => {
    const def = weapons.get(id)
    if (!def) throw new Error(`game-weapons: unknown weapon "${id}"`)
    const caliber = def.action.kind === 'firearm' ? calibers.get(def.action.caliber) ?? null : null
    counter += 1
    const seed = opts.seed ?? (baseSeed + Math.imul(counter, 0x9e3779b1)) >>> 0
    const explosive = explosiveOf(def, explosives)
    return new WeaponRuntime({ def, caliber, seed, reserve: opts.reserve, rules, explosive, condition: opts.condition, ammoQuality: opts.ammoQuality, attachments, isCompatible: options.isCompatible, snapshot: opts.snapshot })
  }

  return {
    calibers,
    weapons,
    explosives,
    attachments,
    rules,
    create,
    canFit(weapon, attachment, opts = {}) {
      const def = weapons.get(weapon)
      if (!def) throw new Error(`game-weapons: unknown weapon "${weapon}"`)
      const part = attachments.get(attachment)
      if (!part) throw new Error(`game-weapons: unknown attachment "${attachment}"`)
      const caliber = def.action.kind === 'firearm' ? calibers.get(def.action.caliber) ?? null : null
      const fitted: readonly FittedAttachment[] = opts.fitted ?? def.fitted ?? []
      return canFitAttachment(def, part, fitted, { caliber, catalogue: attachments, isCompatible: options.isCompatible }, opts.mount as MountKind | undefined)
    },
    restore(snapshot, opts = {}) {
      return create(snapshot.id, { seed: opts.seed, reserve: snapshot.reserve, condition: snapshot.condition, ammoQuality: snapshot.ammoQuality, snapshot })
    },
    muzzleEnergy(caliber, barrel = 1) {
      const c = calibers.get(caliber)
      if (!c) throw new Error(`game-weapons: unknown calibre "${caliber}"`)
      return muzzleEnergy(c, barrel)
    },
    explosiveBody(use) {
      return createExplosiveBody(use, explosives, rules.explosives)
    },
    energy(id) {
      const def = weapons.get(id)
      if (!def) throw new Error(`game-weapons: unknown weapon "${id}"`)
      return energyOf(def, calibers, explosives)
    },
    name(id) {
      const weapon = weapons.get(id)
      if (weapon) return strings.weapons[id] ?? weapon.name ?? id
      return strings.explosives[id] ?? explosives.get(id)?.name ?? strings.modes[id] ?? strings.categories[id] ?? strings.faults[id] ?? strings.conditions[id] ?? calibers.get(id)?.label ?? attachments.get(id)?.name ?? id
    },
    list(category?: WeaponCategory) {
      const all = [...weapons.values()]
      return category ? all.filter((w) => w.category === category) : all
    },
  }
}
