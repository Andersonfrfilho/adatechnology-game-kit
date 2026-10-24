/**
 * @adatechnology/game-characters-people: generic people for `game-characters`, as data and one pack. 12 professions, 4 age presets, the appearance
 * pools and the accessory ids the portraits builder knows. Named people and their stories belong to the game.
 */
import type { CharacterPack } from '@adatechnology/game-characters'

import accessoriesData from './data/accessories.json'
import agesData from './data/ages.json'
import appearanceData from './data/appearance.json'
import professionsData from './data/professions.json'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'
import type { Accessory, AgePreset, AppearancePools, LocaleId, PeopleLocale, Profession } from './types'

export type * from './types'

export const PROFESSIONS = professionsData as unknown as readonly Profession[]
export const AGE_PRESETS = agesData as unknown as readonly AgePreset[]
export const APPEARANCE_POOLS = appearanceData as unknown as AppearancePools
export const ACCESSORIES = accessoriesData as unknown as readonly Accessory[]
export const PEOPLE_LOCALES = { en, 'pt-BR': ptBR } as unknown as Readonly<Record<LocaleId, PeopleLocale>>

export const getProfession = (id: string): Profession | undefined => PROFESSIONS.find((profession) => profession.id === id)
export const getAgePreset = (id: string): AgePreset | undefined => AGE_PRESETS.find((preset) => preset.id === id)

/** The professions as presets of `createCharacters({ packs: [createPeoplePack()] })`: `kit.create({ seed, kind: 'nurse' })`. */
export const createPeoplePack = (): CharacterPack => ({
  id: 'people',
  presets: PROFESSIONS.map((profession) => ({
    id: profession.id,
    kind: 'person',
    age: 'adult',
    ...(profession.female ? { sex: 'female' as const } : {}),
    ...(profession.protection.length > 0 ? { protection: profession.protection } : {}),
    traits: { profession: profession.id, look: profession.look, accessories: profession.accessories, hand: profession.hand, leftHand: profession.leftHand },
  })),
})
