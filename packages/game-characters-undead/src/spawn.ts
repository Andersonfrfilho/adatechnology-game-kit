import { drawBodyVariance, variantCountFor } from '@adatechnology/game-characters'
import type { BodyVariance } from '@adatechnology/game-characters'

import type { UndeadRules } from './rules'
import { baseSpeedsOf } from './speed'
import type { SpeedSet } from './speed'
import type { UndeadAge, UndeadOutfit, UndeadType } from './types'

export type SpawnContext = {
  /** The place has water: types that `requires` it can spawn (the drowned). */
  readonly water?: boolean
  /** It is night: types with a `nightShare` are drawn with that share. */
  readonly night?: boolean
}

/** What a spawn left besides the numbers the damage model needs: the draws the game makes for the look and the first moments of the body. */
export type UndeadLook = {
  /** Index into the baked variants of all types, in catalog order (the game's `Z.vr`). */
  readonly variant: number
  /** Cloth colour, 0xRRGGBB. */
  readonly color: number
  /** 0..1, where in the skin tones this body falls. */
  readonly skin: number
  /** First attack timer, 0..1 (G `atkT`). */
  readonly attackTimer: number
  readonly yaw: number
  readonly phase: number
  readonly nextTick: number
}

export type UndeadTraits = {
  readonly type: string
  readonly age: string
  readonly outfit: string
  readonly ageIndex: number
  readonly outfitIndex: number
  readonly speeds: SpeedSet
  readonly health: number
  readonly crawls: boolean
  readonly helmet: boolean
  readonly posture: 'upright' | 'playingDead' | 'submerged'
  readonly look: UndeadLook
  readonly variance: BodyVariance
  /** The person this body was before it turned, when it was one. */
  readonly turnedFrom?: { readonly id: string; readonly kind: string }
}

export type SpawnTables = {
  readonly types: readonly UndeadType[]
  readonly ages: readonly UndeadAge[]
  readonly outfits: readonly UndeadOutfit[]
  readonly rules: UndeadRules
  readonly speedOverrides: Readonly<Record<string, Readonly<Record<string, number>>>>
  readonly speedPreset: 'default' | 'team-game'
}

/** The game's `pick(list)`: one draw walked along the cumulative probabilities (the first entry when nothing is reached). */
export const pickByProbability = <TItem extends { readonly probability: number }>(list: readonly TItem[], random: () => number): number => {
  const r = random()
  let acc = 0
  for (let index = 0; index < list.length; index++) {
    acc += (list[index] as TItem).probability
    if (r < acc) return index
  }
  return 0
}

/** The game's `catTable[floor(R() * length)]`: one draw over the weights, the table being each type repeated `weight` times. */
export const drawType = (types: readonly UndeadType[], random: () => number, context: SpawnContext = {}, pool?: readonly string[]): UndeadType => {
  const eligible = types.filter((type) => (!pool || pool.includes(type.id)) && (!type.requires || (type.requires === 'water' && context.water)))
  const weight = (type: UndeadType): number => (context.night && type.nightShare !== undefined ? type.spawnWeight + type.nightShare * 100 : type.spawnWeight)
  const total = eligible.reduce((sum, type) => sum + weight(type), 0)
  let index = Math.floor(random() * total)
  for (const type of eligible) {
    index -= weight(type)
    if (index < 0) return type
  }
  return eligible[0] as UndeadType
}

const variantOffsets = (types: readonly UndeadType[]): number[] => {
  const offsets: number[] = []
  let next = 0
  for (const type of types) {
    offsets.push(next)
    next += variantCountFor(type.id)
  }
  return offsets
}

export type DrawnSpawn = { readonly type: UndeadType; readonly age: UndeadAge; readonly outfit: UndeadOutfit; readonly traits: UndeadTraits }

/**
 * One body, drawn in the order of the game's `zSpawn` (G 66746): type (unless given), age, outfit, height (three draws), build band and build, speed jitter,
 * wander jitter, first attack timer, variant, yaw, phase, next tick, the cloth colour (only a civilian draws one), the skin tone and the special start.
 * With the same stream and the `team-game` speed preset the numbers are the game's.
 */
export const drawSpawn = (tables: SpawnTables, random: () => number, pick: { readonly type?: string; readonly age?: string; readonly outfit?: string } = {}, context: SpawnContext = {}, pool?: readonly string[]): DrawnSpawn => {
  const { types, ages, outfits, rules } = tables
  const type = pick.type ? (types.find((candidate) => candidate.id === pick.type) as UndeadType | undefined) : drawType(types, random, context, pool)
  if (!type) throw new Error(`game-characters-undead: unknown type "${pick.type}"`)
  const typeIndex = types.indexOf(type)
  const drawnAge = pickByProbability(ages, random)
  const limit = rules.ageLimit[type.id] ? ages.findIndex((age) => age.id === rules.ageLimit[type.id]) : -1
  const ageIndex = pick.age ? ages.findIndex((age) => age.id === pick.age) : limit >= 0 ? Math.min(drawnAge, limit) : drawnAge
  const drawnOutfit = pickByProbability(outfits, random)
  const outfitIndex = pick.outfit ? outfits.findIndex((outfit) => outfit.id === pick.outfit) : drawnOutfit
  const age = ages[ageIndex] as UndeadAge
  const outfit = outfits[outfitIndex] as UndeadOutfit
  const variance = drawBodyVariance(random, { height: type.scale ?? 1, build: type.build ?? (type.scale ? rules.scaledBuild : 1) })
  const speeds: Record<string, number> = {}
  for (const [name, value] of Object.entries(baseSpeedsOf(type, tables.speedPreset))) speeds[name] = value * age.speed * (name === 'wander' ? variance.wanderFactor : variance.speedFactor)
  // the extra speeds of the rules are the game's absolute ones (the stalker creeps at 1.4 whatever its age)
  Object.assign(speeds, tables.speedOverrides[type.id])
  const health = type.health * age.health * variance.healthFactor
  const attackTimer = random()
  const variantCount = variantCountFor(type.id)
  const variant = (variantOffsets(types)[typeIndex] as number) + Math.floor(random() * variantCount)
  const yaw = random() * 6.28
  const phase = random() * 10
  const nextTick = random() * 0.05
  const outfitColor = outfit.color ? Number.parseInt(outfit.color, 16) : 0
  const color = outfitColor || (rules.civilianColors[Math.floor(random() * rules.civilianColors.length)] as number)
  let skin = random()
  let finalColor = color
  let posture: UndeadTraits['posture'] = 'upright'
  let finalYaw = yaw
  const fixed = rules.fixedLook[type.id]
  if (fixed) {
    finalColor = fixed.color
    skin = fixed.skin
  }
  const special = rules.specialSpawn[type.id]
  if (special) {
    if (special.chance >= 1 || random() < special.chance) {
      posture = special.posture
      if (special.posture === 'playingDead') finalYaw = random() * 6.28
      if (special.color !== undefined) finalColor = special.color
    }
  }
  return {
    type,
    age,
    outfit,
    traits: {
      type: type.id,
      age: age.id,
      outfit: outfit.id,
      ageIndex,
      outfitIndex,
      speeds,
      health,
      crawls: type.crawls === true,
      helmet: outfit.helmet === true,
      posture,
      look: { variant, color: finalColor, skin, attackTimer, yaw: finalYaw, phase, nextTick },
      variance,
    },
  }
}
