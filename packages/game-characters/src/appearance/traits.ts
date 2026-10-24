import { createRng } from '../damage/points'

import {
  BAG_COLORS,
  CAP_COLORS,
  DECAY_SKIN,
  HAIR_COLORS,
  HAIR_STYLES_FEMALE,
  HAIR_STYLES_MALE,
  OLD_HAIR,
  PANTS_COLORS,
  SHOE_COLORS,
  SKIN_TONES,
  SLEEVES,
  TOP_COLORS,
  UNIFORM_PANTS,
  UNIFORM_SHIRTS,
  UNIFORM_SHOES,
} from './palette'

export type HairStyle = (typeof HAIR_STYLES_FEMALE)[number] | (typeof HAIR_STYLES_MALE)[number]

export type OutfitLook = { readonly cloth?: number; readonly pants?: number; readonly hat?: string }

export type AppearanceParams = {
  readonly seed: number
  /** 0 fresh .. 3 decrepit: sets the skin of a uniform body. */
  readonly decay?: number
  /** The look of an outfit (police, military ...): its colours replace the draws, so the stream does not spend them. */
  readonly outfit?: OutfitLook
  /** A baked crowd variant: no random look, fixed skin, shirt by `typeIndex`, short hair. */
  readonly uniform?: boolean
  readonly typeIndex?: number
  readonly clothIndex?: number
  /** Forces the sex; unset draws it (42% female). */
  readonly female?: boolean
  /** False for bodies that are never female (a brute): the draw is skipped. */
  readonly allowFemale?: boolean
  readonly tone?: number
  readonly hairStyle?: HairStyle
  readonly hairColor?: number
  /** The type's own look: wet bodies have long hair, charred ones are bald. */
  readonly wet?: boolean
  readonly charred?: boolean
  /** A living person: no bag, no tear. */
  readonly human?: boolean
  /** 0 fresh-dead, 1 normal, 2 old (grey hair). */
  readonly life?: number
}

export type AppearanceTraits = {
  readonly female: boolean
  readonly tone: number
  readonly topColor: number
  readonly pantsColor: number
  readonly sleeve: string
  readonly hair: string
  readonly headWidth: number
  readonly headHeight: number
  readonly jaw: number
  readonly nose: number
  readonly beard: boolean
  readonly glasses: boolean
  readonly cap: boolean
  readonly capColor: number
  readonly bag: boolean
  readonly bagColor: number
  readonly torn: boolean
  readonly apron: boolean
  readonly hairColor: number
  readonly shoeColor: number
}

export type DrawnAppearance = {
  readonly traits: AppearanceTraits
  /** The stream, positioned after the look: the body builder keeps drawing from it (the hair of a decrepit body). */
  readonly random: () => number
}

/** The seed of the blood stream (the same drips on every level of detail). */
export const BLOOD_SEED_OFFSET = 99

export const createBloodStream = (seed: number): (() => number) => createRng(seed + BLOOD_SEED_OFFSET)

const FEMALE_SHARE = 0.42
const BEARD_SHARE = 0.25
const GLASSES_SHARE = 0.12
const CAP_SHARE = 0.12
const BAG_SHARE = 0.15
const TORN_SHARE = 0.35
const APRON_SHARE = 0.05

/**
 * A person's look from a seed, drawing in exactly the order the Bestiário v17 builder draws from its `VR` stream, including the draws a
 * short-circuit skips (no beard roll for a woman, no cap roll under a hat). Returns the stream so the builder can continue from it.
 */
export const drawAppearance = (params: AppearanceParams): DrawnAppearance => {
  const { seed, outfit = {}, uniform = false, typeIndex = 0, human = false, life = 1 } = params
  const random = createRng(seed)
  const pick = <T>(options: readonly T[]): T => options[Math.floor(random() * options.length)] as T
  const female = !uniform && (params.allowFemale ?? true) && (params.female ?? random() < FEMALE_SHARE)
  const tone = params.tone ?? (uniform ? (DECAY_SKIN[0] as number) : pick(SKIN_TONES))
  const topColor = outfit.cloth ?? (uniform ? (UNIFORM_SHIRTS[(params.clothIndex ?? typeIndex) % UNIFORM_SHIRTS.length] as number) : pick(TOP_COLORS))
  const pantsColor = outfit.pants ?? (uniform ? UNIFORM_PANTS : pick(PANTS_COLORS))
  const look = uniform ? uniformLook() : drawLook({ random, pick, female, outfit, human, params })
  const hairColor = params.hairColor ?? (life === 2 ? OLD_HAIR : pick(HAIR_COLORS))
  const shoeColor = uniform ? UNIFORM_SHOES : pick(SHOE_COLORS)
  return { traits: { female, tone, topColor, pantsColor, ...look, hairColor, shoeColor }, random }
}

type Look = Omit<AppearanceTraits, 'female' | 'tone' | 'topColor' | 'pantsColor' | 'hairColor' | 'shoeColor'>

const uniformLook = (): Look => ({
  sleeve: 'short',
  hair: 'short',
  headWidth: 1,
  headHeight: 1,
  jaw: 1,
  nose: 1,
  beard: false,
  glasses: false,
  cap: false,
  capColor: 0,
  bag: false,
  bagColor: 0,
  torn: false,
  apron: false,
})

type DrawLookParams = {
  readonly random: () => number
  readonly pick: <T>(options: readonly T[]) => T
  readonly female: boolean
  readonly outfit: OutfitLook
  readonly human: boolean
  readonly params: AppearanceParams
}

const drawLook = ({ random, pick, female, outfit, human, params }: DrawLookParams): Look => {
  const sleeve = outfit.cloth ? 'long' : pick(SLEEVES)
  const hair = params.hairStyle ?? (params.wet ? 'long' : params.charred ? 'bald' : pick(female ? HAIR_STYLES_FEMALE : HAIR_STYLES_MALE))
  const headWidth = 1 + (random() - 0.5) * 0.16
  const headHeight = 1 + (random() - 0.5) * 0.14
  const jaw = 1 + (random() - 0.5) * 0.3
  const nose = 1 + (random() - 0.5) * 0.5
  const beard = !female && random() < BEARD_SHARE
  const glasses = random() < GLASSES_SHARE
  const cap = !outfit.hat && random() < CAP_SHARE
  const capColor = pick(CAP_COLORS)
  const bag = random() < BAG_SHARE && !human
  const bagColor = pick(BAG_COLORS)
  const torn = random() < TORN_SHARE && !human
  const apron = random() < APRON_SHARE
  return { sleeve, hair, headWidth, headHeight, jaw, nose, beard, glasses, cap, capColor, bag, bagColor, torn, apron }
}
