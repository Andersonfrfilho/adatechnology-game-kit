/**
 * @adatechnology/game-characters-people: generic people for `game-characters`, as data and one pack. 12 professions, 4 age presets, the appearance
 * pools and the accessory ids the portraits builder knows, the name pools and the character sheet ruleset. Named people and their stories belong to the game.
 */
import type { CharacterPack, FirstPersonClip, PoseClip } from '@adatechnology/game-characters'

import accessoriesData from './data/accessories.json'
import agesData from './data/ages.json'
import appearanceData from './data/appearance.json'
import attackClipsData from './data/attack-clips.json'
import firstPersonClipsData from './data/first-person-clips.json'
import namesData from './data/names.json'
import professionsData from './data/professions.json'
import sheetData from './data/sheet.json'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'
import type { Accessory, AgePreset, AppearancePools, LocaleId, NamePools, PeopleLocale, Profession, SheetRuleset } from './types'

export type * from './types'

export const PROFESSIONS = professionsData as unknown as readonly Profession[]
export const AGE_PRESETS = agesData as unknown as readonly AgePreset[]
export const APPEARANCE_POOLS = appearanceData as unknown as AppearancePools
export const ACCESSORIES = accessoriesData as unknown as readonly Accessory[]
/**
 * The player's attack pose clips (the punches: `punch_right` the cross, `jab`, `hook`, `uppercut`, all written for the right hand; shove, kick, the recoil of a rifle and of a pistol) in the `PoseClip` format of `game-characters`.
 * Authored in the kit; replace with the Elenco team's clips when delivered. A game registers them with `createPoseClipRegistry([...POSE_CLIPS, ...ATTACK_CLIPS])`.
 */
export const ATTACK_CLIPS = attackClipsData.clips as unknown as readonly PoseClip[]
/** One blow of a combo: the strike clip (`ATTACK_CLIPS` and `FIRST_PERSON_CLIPS`, written for the right hand) and the hand that throws it (the left plays the mirror). */
export type StrikeComboStep = { readonly clip: string; readonly hand: 'left' | 'right' }
/**
 * A combo the player can have (an ability): while it is on, each blow of `tools` is the next step of `steps`, and a pause longer than `reset` seconds starts it over.
 * The test room takes it as `strikeCombo`; a game turns it on when the character has it (a skill, a milestone, an item).
 */
export type StrikeCombo = {
  readonly id: string
  readonly name: Readonly<Record<LocaleId, string>>
  readonly tools: readonly string[]
  readonly steps: readonly StrikeComboStep[]
  readonly reset: number
}
/** The boxer's four-punch combo, orthodox stance: jab (left), cross (right, `punch_right`), hook (left), uppercut (right). */
export const PUNCH_COMBO: StrikeCombo = {
  id: 'punch_combo',
  name: { 'pt-BR': 'Sequência de socos', en: 'Punch combo' },
  tools: ['hand', 'fists'],
  steps: [
    { clip: 'jab', hand: 'left' },
    { clip: 'punch_right', hand: 'right' },
    { clip: 'hook', hand: 'left' },
    { clip: 'uppercut', hand: 'right' },
  ],
  reset: 1,
}
/** Texts of the phase labels of `ATTACK_CLIPS` by locale, in the shape of `POSE_CLIP_LOCALES` of `game-characters`. */
export const ATTACK_CLIP_LOCALES = attackClipsData.locales as Readonly<Record<LocaleId, Readonly<Record<string, string>>>>
/**
 * The first-person counterpart of the strikes of `ATTACK_CLIPS` (`punch_right`, `jab`, `hook`, `uppercut`, `shove_two_hands`, `front_kick`): the same duration and the same events, so the `impact` of a clip lands at the same
 * second in both views, but as hands and a foot in the camera's space instead of joint angles. Authored in the kit; replace with the Elenco team's clips when delivered. The arms of
 * `game-characters-three` (`createFirstPersonArms`) play them.
 */
export const FIRST_PERSON_CLIPS = firstPersonClipsData.clips as unknown as readonly FirstPersonClip[]
export const PEOPLE_LOCALES = { en, 'pt-BR': ptBR } as unknown as Readonly<Record<LocaleId, PeopleLocale>>

/** First names, surnames, babies' names and kinship words by language (Os Vivos do Vale `NM`, `RELW`); pt-BR is the one the teams wrote. */
export const NAME_POOLS = { 'pt-BR': (namesData as unknown as Record<string, NamePools>)['pt-BR']! } as Readonly<Partial<Record<LocaleId, NamePools>>>
export const getNamePools = (locale: LocaleId | string = 'pt-BR'): NamePools => NAME_POOLS[locale as LocaleId] ?? NAME_POOLS['pt-BR']!

/**
 * The character sheet ruleset of the Personagens document: 6 attributes that start at 3 with a pool of 14 (1 to 8 each), 24 skills in 5 groups
 * with milestones at levels 3, 6 and 9, the 12 professions' points, skills, bonus and kit, 18 traits with costs and exclusions, and the derived
 * values as formulas. `game-stories` evaluates it.
 */
export const SHEET_RULESET = sheetData as unknown as SheetRuleset

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
