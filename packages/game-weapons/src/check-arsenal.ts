import type { CaliberDef, CaliberId, ExplosiveDef, ExplosiveId, WeaponDef, WeaponId, WeaponRules } from './types'

export interface ArsenalParts {
  readonly weapons: ReadonlyMap<WeaponId, WeaponDef>
  readonly calibers: ReadonlyMap<CaliberId, CaliberDef>
  readonly explosives: ReadonlyMap<ExplosiveId, ExplosiveDef>
  /** When given, the default condition and ammunition quality must be ones the rules define. */
  readonly rules?: Pick<WeaponRules, 'conditions' | 'defaultCondition' | 'ammoQualities' | 'defaultAmmoQuality'>
}

/** Ids that appear more than once in a list a game passed in. */
export const findDuplicateIds = (kind: string, entries: readonly { readonly id: string }[] | undefined): string[] => {
  const seen = new Set<string>()
  const problems: string[] = []
  for (const { id } of entries ?? []) {
    if (seen.has(id)) problems.push(`${kind} "${id}" is listed more than once`)
    seen.add(id)
  }
  return problems
}

const checkFirearm = (def: WeaponDef, calibers: ArsenalParts['calibers']): string[] => {
  if (def.action.kind !== 'firearm') return []
  const problems: string[] = []
  for (const caliber of [def.action.caliber, ...(def.action.acceptsCalibers ?? [])]) {
    if (!calibers.has(caliber)) problems.push(`weapon "${def.id}" uses unknown calibre "${caliber}"`)
  }
  if (def.action.modes.length === 0) problems.push(`weapon "${def.id}" has no fire modes`)
  if (!(def.action.rpm > 0)) problems.push(`weapon "${def.id}" has a rate of fire of ${def.action.rpm} rpm`)
  if (!(def.action.reload > 0)) problems.push(`weapon "${def.id}" has a reload time of ${def.action.reload} s`)
  return problems
}

const checkTimings = (def: WeaponDef): string[] => {
  const timings = 'timings' in def.action ? def.action.timings : undefined
  return Object.entries(timings ?? {})
    .filter(([, seconds]) => typeof seconds === 'number' && !(seconds > 0))
    .map(([name, seconds]) => `weapon "${def.id}" has a ${name} time of ${seconds} s`)
}

const checkExplosiveReference = (def: WeaponDef, explosives: ArsenalParts['explosives']): string[] => {
  const id = def.action.kind === 'launcher' ? def.action.projectile : def.action.kind === 'throwable' ? def.action.explosive : undefined
  return id !== undefined && !explosives.has(id) ? [`weapon "${def.id}" uses unknown explosive "${id}"`] : []
}

const checkExplosiveNumbers = (explosive: ExplosiveDef): string[] => {
  const problems: string[] = []
  const [low, high] = explosive.fuseRange ?? [1, 1]
  if (!(low > 0 && high >= low)) problems.push(`explosive "${explosive.id}" has a fuse range of ${low} to ${high} s`)
  if (explosive.fuseLength !== undefined && !(explosive.fuseLength > 0)) problems.push(`explosive "${explosive.id}" has a fuse length of ${explosive.fuseLength} m`)
  if (explosive.burnRate !== undefined && !(explosive.burnRate > 0)) problems.push(`explosive "${explosive.id}" has a burn rate of ${explosive.burnRate} s/m`)
  if (explosive.burnTolerance !== undefined && !(explosive.burnTolerance >= 0 && explosive.burnTolerance < 1)) problems.push(`explosive "${explosive.id}" has a burn tolerance of ${explosive.burnTolerance}`)
  if (explosive.tripwire && !(explosive.tripwire.length > 0)) problems.push(`explosive "${explosive.id}" has a trip wire of ${explosive.tripwire.length} m`)
  return problems
}

const checkRuleDefaults = (rules: ArsenalParts['rules']): string[] => {
  if (!rules) return []
  const problems: string[] = []
  if (!rules.conditions.some((condition) => condition.id === rules.defaultCondition)) problems.push(`the default condition "${rules.defaultCondition}" is not one of the conditions`)
  if (!rules.ammoQualities.some((quality) => quality.id === rules.defaultAmmoQuality)) problems.push(`the default ammunition quality "${rules.defaultAmmoQuality}" is not one of the qualities`)
  return problems
}

/** Every problem found in an arsenal, so a game sees them all at once instead of one per run. Empty when it is consistent. */
export const checkArsenal = ({ weapons, calibers, explosives, rules }: ArsenalParts): string[] => [
  ...[...weapons.values()].flatMap((def) => [...checkFirearm(def, calibers), ...checkTimings(def), ...checkExplosiveReference(def, explosives)]),
  ...[...explosives.values()].flatMap(checkExplosiveNumbers),
  ...checkRuleDefaults(rules),
]
