/**
 * @adatechnology/game-characters-undead: the zombie-only layer over `game-characters`, as data. 13 types, 4 infection ages, 4 outfits, the infection
 * timeline and the speed moments, with `en` and `pt-BR` text. Nothing here is imported by a game that has no undead.
 */
import agesData from './data/ages.json'
import infectionData from './data/infection.json'
import momentsData from './data/moments.json'
import outfitsData from './data/outfits.json'
import typesData from './data/types.json'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'
import type { LocaleId, UndeadAge, UndeadAges, UndeadInfection, UndeadLocale, UndeadMoments, UndeadOutfit, UndeadType } from './types'

export type * from './types'

/** The 13 types in the order of the game's catalog. */
export const UNDEAD_TYPES = typesData as unknown as readonly UndeadType[]
export const UNDEAD_AGES = agesData as unknown as UndeadAges
export const UNDEAD_OUTFITS = outfitsData as unknown as readonly UndeadOutfit[]
export const UNDEAD_INFECTION = infectionData as unknown as UndeadInfection
export const UNDEAD_MOMENTS = momentsData as unknown as UndeadMoments
export const UNDEAD_LOCALES: Readonly<Record<LocaleId, UndeadLocale>> = { en, 'pt-BR': ptBR } as unknown as Readonly<Record<LocaleId, UndeadLocale>>

export const getUndeadType = (id: string): UndeadType | undefined => UNDEAD_TYPES.find((type) => type.id === id)
export const getUndeadAge = (id: string): UndeadAge | undefined => UNDEAD_AGES.ages.find((age) => age.id === id)
export const getUndeadOutfit = (id: string): UndeadOutfit | undefined => UNDEAD_OUTFITS.find((outfit) => outfit.id === id)

/** Ids of the types a child can turn into: every type except the ones marked `childEligible: false` (brute, bloater). */
export const childTypeIds = (): string[] => UNDEAD_TYPES.filter((type) => type.childEligible !== false).map((type) => type.id)
