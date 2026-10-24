import { applyPatches, createRng, mergeById, removeIds } from '@adatechnology/game-characters'
import type { CharacterKit, CharacterPack, CharacterSpec, DamageCharacter } from '@adatechnology/game-characters'

import agesData from './data/ages.json'
import infectionData from './data/infection.json'
import momentsData from './data/moments.json'
import outfitsData from './data/outfits.json'
import typesData from './data/types.json'
import { deathEffects, doorDamageFactor, headAreaFactor, isFireImmune, waterHealthLoss } from './hooks'
import type { UndeadEffect } from './hooks'
import { createInfectionCase, pickWound, woundInfects } from './infection'
import type { InfectionCase, InfectionClock } from './infection'
import { DEFAULT_SPEED_OVERRIDES, DEFAULT_UNDEAD_RULES } from './rules'
import type { UndeadRules } from './rules'
import { speedFor } from './speed'
import type { SpeedContext } from './speed'
import { drawSpawn, drawType } from './spawn'
import type { SpawnContext, UndeadTraits } from './spawn'
import type { UndeadAges, UndeadInfection, UndeadMoments, UndeadOutfit, UndeadType, WoundKind } from './types'

const TYPES = typesData as unknown as readonly UndeadType[]
const AGES = agesData as unknown as UndeadAges
const OUTFITS = outfitsData as unknown as readonly UndeadOutfit[]
const INFECTION = infectionData as unknown as UndeadInfection
const MOMENTS = momentsData as unknown as UndeadMoments

export type UndeadOptions = {
  /** Fields to change in types, by id (a game's own numbers); `remove` takes types out. */
  readonly patch?: Readonly<Record<string, Partial<UndeadType>>>
  readonly remove?: readonly string[]
  /** More types, or types replaced by id. */
  readonly types?: readonly UndeadType[]
  readonly ages?: UndeadAges
  readonly outfits?: readonly UndeadOutfit[]
  readonly infection?: UndeadInfection
  readonly moments?: Partial<UndeadMoments>
  readonly rules?: Partial<UndeadRules>
  /** `default`: the chase speed is the type's `chase`. `team-game`: the game's single speed per type (a type with a `frenzy` chases at it). */
  readonly speedPreset?: 'default' | 'team-game'
  /** Ids a child can turn into (design question 2). Default: every type except the ones with `childEligible: false`. */
  readonly childTypePool?: readonly string[]
  /** Speeds the rules add per type, in m/s (not scaled by age). Default: the stalker's creep of 1.4. */
  readonly speedOverrides?: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Real-time clock of the infection: the Elenco's hours, or the game's accelerated seconds. Default `accelerated`. */
  readonly infectionClock?: InfectionClock
  /** Game hours that pass per real second on the `hours` clock. Default 1/3600. */
  readonly hoursPerSecond?: number
}

export type AssignOptions = {
  /** Fixes the type; absent, it is a weighted draw from the stream. */
  readonly type?: string
  readonly age?: string
  readonly outfit?: string
  readonly context?: SpawnContext
  /** The stream to draw from. Default `createRng(spec.seed)`. */
  readonly random?: () => number
}

export type UndeadSpawn = {
  /** The spec to give `kit.create`: type multipliers, age, outfit protection, health and the speeds in `traits.undead`. */
  readonly spec: CharacterSpec
  readonly traits: UndeadTraits
}

export type Undead = {
  readonly types: ReadonlyMap<string, UndeadType>
  readonly moments: UndeadMoments
  readonly rules: UndeadRules
  /** Draws a zombie: the spec and traits, nothing created yet. */
  assign(spec: Pick<CharacterSpec, 'seed'> & Partial<CharacterSpec>, options?: AssignOptions): UndeadSpawn
  /** `assign` then `kit.create`. */
  create(spec: Pick<CharacterSpec, 'seed'> & Partial<CharacterSpec>, options?: AssignOptions): DamageCharacter
  /** A living person becomes a zombie of a drawn (or given) type: same body, same look, same missing limbs, fresh health. Children turn too. */
  turn(person: DamageCharacter, options?: { readonly now?: number; readonly type?: string; readonly random?: () => number; readonly context?: SpawnContext }): DamageCharacter
  /** The bridge from `game-infection`: a seed from `materialize` becomes a zombie of `region`'s context. A `removed` agent makes none. */
  fromAgent(agent: { readonly state: string; readonly seed: number }, region?: SpawnContext & { readonly id?: string }): DamageCharacter | undefined
  /** Absolute metres per second of a body at a moment (the traits come from `spec.traits.undead`). */
  speedFor(traits: Pick<UndeadTraits, 'speeds' | 'type'>, context: SpeedContext): number
  /** Whether a wound infects (one draw), and the case that follows when it does. */
  infect(wound: WoundKind | undefined, random: () => number): InfectionCase | undefined
  readonly pickWound: (random: () => number) => WoundKind
  /** Effects of a death (the bloater's burst). */
  onDeath(character: DamageCharacter): UndeadEffect[]
  isFireImmune(character: DamageCharacter): boolean
  /** Fraction of health lost on entering water. */
  waterHealthLoss(character: DamageCharacter): number
  headAreaFactor(character: DamageCharacter): number
  doorDamageFactor(character: DamageCharacter): number
  /** The traits a created zombie carries. */
  traitsOf(character: DamageCharacter): UndeadTraits | undefined
}

const traitsOf = (character: { readonly spec: CharacterSpec }): UndeadTraits | undefined => (character.spec.traits?.undead as UndeadTraits | undefined)

/** The types as presets of `createCharacters({ packs: [createUndeadPack()] })`: `kit.create({ seed, kind: 'brute' })` already has the type's multipliers. */
export const createUndeadPack = (options: UndeadOptions = {}): CharacterPack => {
  const types = resolveTypes(options)
  const rules = { ...DEFAULT_UNDEAD_RULES, ...options.rules }
  return {
    id: 'undead',
    presets: types.map((type) => ({
      id: type.id,
      kind: type.id,
      age: 'adult' as const,
      vitality: type.health,
      multipliers: type.multipliers,
      ...(type.bodyCount ? { bodyCount: type.bodyCount } : {}),
      ...(type.crawls ? { crawling: true } : {}),
      stunSeconds: rules.stunSeconds.byType[type.id] ?? rules.stunSeconds.default,
      traits: { undeadType: type.id },
    })),
  }
}

const resolveTypes = (options: UndeadOptions): UndeadType[] => {
  const registry = mergeById(TYPES as UndeadType[], options.types ?? [])
  applyPatches(registry, options.patch as Record<string, Partial<UndeadType>> | undefined)
  removeIds(registry, options.remove)
  return [...registry.values()]
}

/**
 * The zombie layer over a `CharacterKit`. `assign` draws a body the way the game's `zSpawn` does; `turn` makes a person one; `speedFor` answers the speed
 * of any moment; the hooks answer what a type does on death, in fire, in water and at a door. The kit is the one made with `createUndeadPack()` (or any
 * kit: the spec carries everything).
 */
export const createUndead = (kit: CharacterKit, options: UndeadOptions = {}): Undead => {
  const types = resolveTypes(options)
  const byId = new Map(types.map((type) => [type.id, type]))
  const ages = options.ages ?? AGES
  const outfits = options.outfits ?? OUTFITS
  const infection = options.infection ?? INFECTION
  const moments: UndeadMoments = { ...MOMENTS, ...options.moments, water: { ...MOMENTS.water, ...options.moments?.water } }
  const rules: UndeadRules = { ...DEFAULT_UNDEAD_RULES, ...options.rules }
  const tables = { types, ages: ages.ages, outfits, rules, speedOverrides: options.speedOverrides ?? DEFAULT_SPEED_OVERRIDES, speedPreset: options.speedPreset ?? 'default' }
  const childPool = options.childTypePool ?? types.filter((type) => type.childEligible !== false).map((type) => type.id)
  const clock = options.infectionClock ?? 'accelerated'

  const typeOf = (character: { readonly spec: CharacterSpec }): UndeadType | undefined => byId.get(traitsOf(character)?.type ?? character.spec.kind)

  const assign: Undead['assign'] = (spec, assignOptions = {}) => {
    const random = assignOptions.random ?? spec.random ?? createRng(spec.seed)
    const isChild = spec.age === 'child'
    const drawn = drawSpawn(tables, random, assignOptions, assignOptions.context, isChild && !assignOptions.type ? childPool : undefined)
    const { type, age, outfit, traits } = drawn
    const limbFactor = age.limbDamage * (outfit.limbs ?? 1)
    const full: CharacterSpec = {
      kind: type.id,
      ...spec,
      vitality: spec.vitality ?? traits.health,
      height: spec.height ?? kit.body.heightMetres * traits.variance.height,
      build: spec.build ?? traits.variance.build,
      multipliers: { ...type.multipliers, ...spec.multipliers },
      limbFactor: spec.limbFactor ?? limbFactor,
      bloodFactor: spec.bloodFactor ?? age.blood,
      bodyCount: spec.bodyCount ?? type.bodyCount ?? 1,
      stunSeconds: spec.stunSeconds ?? rules.stunSeconds.byType[type.id] ?? rules.stunSeconds.default,
      crawling: spec.crawling ?? traits.crawls,
      protection: spec.protection ?? outfit.protection,
      traits: { ...spec.traits, undead: traits },
    }
    return { spec: { ...full, kind: type.id }, traits }
  }

  const create: Undead['create'] = (spec, assignOptions) => kit.create(assign(spec, assignOptions).spec)

  return {
    types: byId,
    moments,
    rules,
    assign,
    create,
    turn(person, turnOptions = {}) {
      const { spec } = person
      const random = turnOptions.random ?? createRng((spec.seed ^ 0x2f6e2b1) >>> 0)
      const childRule = spec.age === 'child'
      const drawn = turnOptions.type ?? (drawType(types, random, turnOptions.context, childRule ? childPool : undefined).id)
      const { spec: turned, traits } = assign(
        { seed: spec.seed, ...(spec.sex ? { sex: spec.sex } : {}), ...(spec.age ? { age: spec.age } : {}), height: spec.height, build: spec.build, ...(spec.outfit ? { outfit: spec.outfit } : {}), id: `${spec.id}_undead` },
        { type: drawn, random },
      )
      const zombie = kit.create({ ...turned, traits: { ...turned.traits, undead: { ...traits, turnedFrom: { id: spec.id, kind: spec.kind } } } })
      // the body stays what it was: severed and destroyed parts stay gone, everything else is whole again with the type's health
      const saved = person.serialize() as { body: { vitality: number; alive: boolean; stunSeconds: number; segments: { status: string; hp: number; max: number }[]; consumed: string[] }; bleeders: unknown[] }
      saved.body.vitality = traits.health
      saved.body.alive = true
      saved.body.stunSeconds = 0
      saved.body.consumed = []
      for (const segment of saved.body.segments) if (segment.status !== 'severed' && segment.status !== 'destroyed') Object.assign(segment, { status: 'ok', hp: segment.max })
      saved.bleeders = []
      zombie.load(saved)
      return zombie
    },
    fromAgent(agent, region = {}) {
      if (agent.state === 'removed') return undefined
      const context: SpawnContext = { ...(region.water !== undefined ? { water: region.water } : {}), ...(region.night !== undefined ? { night: region.night } : {}) }
      return create({ seed: agent.seed }, { context })
    },
    speedFor: (traits, context) => speedFor(traits.speeds, context, moments, traits.type),
    infect(wound, random) {
      const kind = wound ?? pickWound(infection, random)
      if (!woundInfects(infection, kind, random)) return undefined
      return createInfectionCase(infection, kind, clock, options.hoursPerSecond)
    },
    pickWound: (random) => pickWound(infection, random),
    onDeath: (character) => {
      const type = typeOf(character)
      return type ? deathEffects(type, rules) : []
    },
    isFireImmune: (character) => {
      const type = typeOf(character)
      return type ? isFireImmune(type) : false
    },
    waterHealthLoss: (character) => {
      const type = typeOf(character)
      return type ? waterHealthLoss(type) : 0
    },
    headAreaFactor: (character) => {
      const type = typeOf(character)
      return type ? headAreaFactor(type) : 1
    },
    doorDamageFactor: (character) => {
      const type = typeOf(character)
      return type ? doorDamageFactor(type) : 1
    },
    traitsOf,
  }
}
