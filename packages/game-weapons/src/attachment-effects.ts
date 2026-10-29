import type { AttachmentDef, AttachmentId, FittedAttachment, StatModifier, WeaponStat } from './attachment-types'
import type { CaliberDef, FirearmAction, WeaponAction, WeaponDef, WeaponRules } from './types'

/** How the weapon is held and what it is in: what the conditional effects (`aiming`, `hip`, `supported`, `subsonic`, `collapsed`) ask. */
export interface LoadoutContext {
  readonly aiming: boolean
  readonly supported: boolean
  readonly stock: 'collapsed' | 'extended'
  readonly caliber: CaliberDef | null
  readonly rules: Pick<WeaponRules, 'attachments' | 'aim' | 'stock'>
}

export interface Loadout {
  /** The action with every effect applied; the very object of the def when nothing differs from the weapon as it ships. */
  readonly action: WeaponAction
  /** Kg: the weapon with what is on it. */
  readonly mass: number
  /** Seconds to raise the weapon to the sights. */
  readonly aimSeconds: number
  /** Times the spread when not aiming. */
  readonly hipFactor: number
  readonly suppressed: boolean
  readonly drawFactor: number
  readonly heatFactor: number
  readonly faultFactor: number
  /** What a dual coupler does to the reload of every second magazine change (1: nothing). */
  readonly secondReloadFactor: number
  readonly optic: AttachmentDef['optic'] | undefined
  readonly light: (NonNullable<AttachmentDef['light']> & { readonly id: AttachmentId }) | undefined
  readonly laser: (NonNullable<AttachmentDef['laser']> & { readonly id: AttachmentId }) | undefined
}

type Catalogue = ReadonlyMap<AttachmentId, AttachmentDef>
type Condition = NonNullable<StatModifier['when']>
type Effects = readonly (readonly StatModifier[])[]

/** The accessories that count: a light or a laser only while it is on. */
const activeParts = (fitted: readonly FittedAttachment[], catalogue: Catalogue): AttachmentDef[] =>
  fitted.flatMap((part) => {
    const def = catalogue.get(part.id)
    const isOn = def?.kind !== 'light' && def?.kind !== 'laser' ? true : part.on === true
    return def && isOn ? [def] : []
  })

const holds = (when: Condition | undefined, active: ReadonlySet<Condition>): boolean => when === undefined || when === 'always' || active.has(when)

const modifiersOf = (name: WeaponStat, sources: Effects, active: ReadonlySet<Condition>): StatModifier[] =>
  sources.flatMap((effects) => effects.filter((effect) => effect.stat === name && holds(effect.when, active)))

const sum = (modifiers: readonly StatModifier[]): number => modifiers.reduce((total, modifier) => total + (modifier.add ?? 0), 0)
const product = (modifiers: readonly StatModifier[]): number => modifiers.reduce((total, modifier) => total * (modifier.mul ?? 1), 1)

interface StatSources {
  readonly now: Effects
  /** The effects of what the weapon ships with: they are in the base numbers already. */
  readonly shipped: Effects
  /** What already held when the base numbers were made: only `subsonic`, for a weapon that is subsonic with its factory parts on (the MP5SD). */
  readonly shippedActive?: ReadonlySet<Condition>
}

/** Takes out of both lists the very same modifier objects (one for one), so a factory part that is still on cancels exactly whatever order the parts are in. */
const cancelShipped = (current: readonly StatModifier[], shipped: readonly StatModifier[]): [StatModifier[], StatModifier[]] => {
  const added = [...current]
  const taken: StatModifier[] = []
  for (const modifier of shipped) {
    const index = added.indexOf(modifier)
    if (index === -1) taken.push(modifier)
    else added.splice(index, 1)
  }
  return [added, taken]
}

/**
 * One number of the weapon with everything on it: every `set` first (the last wins), then the sum of the `add`s, then the product of the `mul`s.
 * The factory parts' effects that always count are in `base` already, so they are taken back out: with the same parts on, the result is `base`
 * itself, and without one of them it is what the weapon would be without it.
 */
const stat = (name: WeaponStat, base: number, sources: StatSources, active: ReadonlySet<Condition>): number => {
  const current = modifiersOf(name, sources.now, active)
  const lastSet = [...current].reverse().find((modifier) => modifier.set !== undefined)?.set
  if (lastSet !== undefined) return (lastSet + sum(current)) * product(current)
  const [added, taken] = cancelShipped(current, modifiersOf(name, sources.shipped, sources.shippedActive ?? new Set<Condition>()))
  return (base + (sum(added) - sum(taken))) * (product(added) / product(taken))
}

const baseSpeedOf = (action: FirearmAction, caliber: CaliberDef | null): number => action.muzzleSpeed ?? (caliber?.muzzleSpeed ?? 0) * (action.barrel ?? 1)

const scaleTimings = (timings: NonNullable<FirearmAction['timings']>, reload: number, empty: number): NonNullable<FirearmAction['timings']> => ({
  ...timings,
  reload: timings.reload * reload,
  ...(timings.reloadEmpty === undefined ? {} : { reloadEmpty: timings.reloadEmpty * reload * empty }),
  ...(timings.perRound === undefined ? {} : { perRound: timings.perRound * reload }),
})

interface ActionEffects {
  readonly spread: number
  readonly recoil: [number, number]
  readonly range: number
  readonly noise: number | undefined
  readonly speed: number
  readonly magazine: number
  readonly reload: number
  readonly empty: number
}

const isUnchanged = (action: FirearmAction, effects: ActionEffects, context: LoadoutContext): boolean =>
  effects.spread === action.spreadDeg &&
  effects.recoil[0] === action.recoil[0] &&
  effects.recoil[1] === action.recoil[1] &&
  effects.range === action.range &&
  effects.noise === (action.noise ?? context.caliber?.noise) &&
  effects.speed === baseSpeedOf(action, context.caliber) &&
  effects.magazine === action.magazine &&
  effects.reload === 1 &&
  effects.empty === 1

const applyEffects = (action: FirearmAction, effects: ActionEffects): FirearmAction => ({
  ...action,
  spreadDeg: effects.spread,
  recoil: effects.recoil,
  range: effects.range,
  ...(effects.noise === undefined ? {} : { noise: effects.noise }),
  muzzleSpeed: effects.speed,
  magazine: effects.magazine,
  reload: action.reload * effects.reload,
  ...(action.timings ? { timings: scaleTimings(action.timings, effects.reload, effects.empty) } : {}),
})

/** The weapon with what is on it: the numbers of the action, the mass, the time to aim, and the lights, laser and optic that are on. */
export const resolveLoadout = (def: WeaponDef, fitted: readonly FittedAttachment[], catalogue: Catalogue, context: LoadoutContext): Loadout => {
  const parts = activeParts(fitted, catalogue)
  const factory = activeParts(def.fitted ?? [], catalogue)
  const isRegular = (part: AttachmentDef): boolean => part.secondReload !== true
  const collapsedStock = context.stock === 'collapsed' ? [context.rules.stock.collapsed] : []
  const shipsSubsonic = def.action.kind === 'firearm' && baseSpeedOf(def.action, context.caliber) < context.rules.attachments.speedOfSound
  const sources: StatSources = {
    now: [...parts.filter(isRegular).map((part) => part.effects), ...collapsedStock],
    shipped: factory.filter(isRegular).map((part) => part.effects),
    ...(shipsSubsonic ? { shippedActive: new Set<Condition>(['subsonic']) } : {}),
  }
  const baseActive = new Set<Condition>([context.aiming ? 'aiming' : 'hip'])
  if (context.supported || parts.some((part) => part.kind === 'mount')) baseActive.add('supported')
  if (context.stock === 'collapsed') baseActive.add('collapsed')

  const firearm = def.action.kind === 'firearm' ? def.action : undefined
  const speed = firearm ? stat('muzzleSpeed', baseSpeedOf(firearm, context.caliber), sources, baseActive) : 0
  const active = new Set(baseActive)
  if (firearm && speed < context.rules.attachments.speedOfSound) active.add('subsonic')
  const read = (name: WeaponStat, base: number): number => stat(name, base, sources, active)

  const mass = read('mass', def.mass + parts.reduce((total, part) => total + part.mass, 0) - factory.reduce((total, part) => total + part.mass, 0))
  const hipFactor = context.aiming ? 1 : 1 + (context.rules.aim.hipSpread - 1) * read('hipSpreadExcess', 1)
  let action: WeaponAction = def.action
  if (firearm) {
    const baseNoise = firearm.noise ?? context.caliber?.noise
    const effects: ActionEffects = {
      spread: read('spread', firearm.spreadDeg) * hipFactor,
      recoil: [read('recoilVertical', firearm.recoil[0]), read('recoilHorizontal', firearm.recoil[1])],
      range: read('range', firearm.range),
      noise: baseNoise === undefined ? undefined : read('noise', baseNoise),
      speed,
      magazine: Math.max(1, Math.round(read('capacity', firearm.magazine))),
      reload: read('reload', 1),
      empty: read('reloadEmpty', 1),
    }
    if (!isUnchanged(firearm, effects, context)) action = applyEffects(firearm, effects)
  }
  const lit = parts.find((part) => part.light)
  const beam = parts.find((part) => part.laser)
  return {
    action,
    mass,
    aimSeconds: read('aim', context.rules.aim.base + context.rules.aim.perKg * mass),
    hipFactor,
    suppressed: parts.some((part) => part.kind === 'suppressor'),
    drawFactor: read('draw', 1),
    heatFactor: read('heatPerShot', 1),
    faultFactor: read('faultChance', 1),
    secondReloadFactor: stat('reload', 1, { now: parts.filter((part) => !isRegular(part)).map((part) => part.effects), shipped: [] }, active),
    optic: parts.find((part) => part.optic)?.optic,
    light: lit?.light ? { ...lit.light, id: lit.id } : undefined,
    laser: beam?.laser ? { ...beam.laser, id: beam.id } : undefined,
  }
}
