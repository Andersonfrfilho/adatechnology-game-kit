import type { AttachmentDef, AttachmentId } from './attachment-types'
import type { CaliberDef, CaliberId, ExplosiveDef, ExplosiveId, WeaponDef, WeaponId, WeaponRules } from './types'

export interface ArsenalParts {
  readonly weapons: ReadonlyMap<WeaponId, WeaponDef>
  readonly calibers: ReadonlyMap<CaliberId, CaliberDef>
  readonly explosives: ReadonlyMap<ExplosiveId, ExplosiveDef>
  readonly attachments?: ReadonlyMap<AttachmentId, AttachmentDef>
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

const STATS: ReadonlySet<string> = new Set(['noise', 'spread', 'hipSpreadExcess', 'recoilVertical', 'recoilHorizontal', 'range', 'muzzleSpeed', 'mass', 'capacity', 'reload', 'reloadEmpty', 'draw', 'aim', 'faultChance', 'heatPerShot'])
const INSTALLS: ReadonlySet<string> = new Set(['field', 'tool', 'bench'])

const checkAttachment = (attachment: AttachmentDef, weapons: ArsenalParts['weapons']): string[] => {
  const problems: string[] = []
  if (attachment.launcher !== undefined && weapons.get(attachment.launcher)?.action.kind !== 'launcher') problems.push(`attachment "${attachment.id}" names "${attachment.launcher}" as its launcher, which is not a launcher weapon`)
  const label = `attachment "${attachment.id}"`
  if (!INSTALLS.has(attachment.install)) problems.push(`${label} installs "${attachment.install}"`)
  if (attachment.mounts.length === 0) problems.push(`${label} has no mount`)
  if (attachment.interfaces.length === 0) problems.push(`${label} has no interface`)
  for (const effect of attachment.effects) {
    if (!STATS.has(effect.stat)) problems.push(`${label} changes the unknown stat "${effect.stat}"`)
    if (effect.mul !== undefined && !(effect.mul > 0)) problems.push(`${label} multiplies ${effect.stat} by ${effect.mul}`)
  }
  return problems
}

const checkFitted = (def: WeaponDef, attachments: ArsenalParts['attachments']): string[] => {
  if (!attachments) return []
  return (def.fitted ?? []).flatMap((part) => {
    const problems: string[] = []
    if (!attachments.has(part.id)) problems.push(`weapon "${def.id}" is fitted with unknown attachment "${part.id}"`)
    if (!(def.mounts ?? []).some((mount) => mount.kind === part.mount)) problems.push(`weapon "${def.id}" has "${part.id}" on "${part.mount}", which it has no mount for`)
    return problems
  })
}

const checkRuleDefaults = (rules: ArsenalParts['rules']): string[] => {
  if (!rules) return []
  const problems: string[] = []
  if (!rules.conditions.some((condition) => condition.id === rules.defaultCondition)) problems.push(`the default condition "${rules.defaultCondition}" is not one of the conditions`)
  if (!rules.ammoQualities.some((quality) => quality.id === rules.defaultAmmoQuality)) problems.push(`the default ammunition quality "${rules.defaultAmmoQuality}" is not one of the qualities`)
  return problems
}

/** Every problem found in an arsenal, so a game sees them all at once instead of one per run. Empty when it is consistent. */
export const checkArsenal = ({ weapons, calibers, explosives, attachments, rules }: ArsenalParts): string[] => [
  ...[...weapons.values()].flatMap((def) => [...checkFirearm(def, calibers), ...checkTimings(def), ...checkExplosiveReference(def, explosives), ...checkFitted(def, attachments)]),
  ...[...(attachments?.values() ?? [])].flatMap((attachment) => checkAttachment(attachment, weapons)),
  ...[...explosives.values()].flatMap(checkExplosiveNumbers),
  ...checkRuleDefaults(rules),
]
