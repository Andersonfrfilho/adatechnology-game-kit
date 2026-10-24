/**
 * @adatechnology/game-stories: a pure, seeded story generator. Roles cast at the world's creation, stories as data that cross each other, a chronicle,
 * the character sheet that keeps what each person lived, and the life simulation of the team's Os Vivos do Vale as generic rules with options.
 * Knows nothing about any game: the people, the stories and the places come in as data.
 */
import lifeNumbersData from './data/life.json'
import lifeTextData from './data/life-text.json'
import sheetNumbersData from './data/sheet.json'

export type * from './types'
export type { LifeNumbers, LifeNumbersPatch, LifeOptions, LifeRule, LifeStats, LifeText, LifeTextPatch, LifeTimer, LifeWorld } from './life/types'
export type { Casting, CastOptions } from './casting'
export type { Chronicle } from './chronicle'
export type { ConditionContext } from './conditions'
export type { BeatContext } from './story/beat'
export type { CharacterSheet, Memory, SheetEntry, SheetInput, SheetNumbers, SheetOptions } from './sheet/sheet'
export type { StoryWorld, StoryWorldOptions } from './world'
export type { StoriesContent, StoriesTestModule, StoriesTestModuleOptions } from './bench/module'

export { castStories } from './casting'
export { createChronicle } from './chronicle'
export { holds } from './conditions'
export { createLifeWorld, fillWorld, lifeDay } from './life/life'
export { applyChanges, FINAL_STATES, setState } from './story/apply'
export { runBeat } from './story/beat'
export { createSheet, drawSheet } from './sheet/sheet'
export { fillText, shortName } from './text'
export { createStoryWorld, lifeNumbersOf, lifeTextOf, simulateStories } from './world'
export { createStoriesTestModule, STORIES_AREA_ID } from './bench/module'
export { STORIES_EXAMPLE } from './bench/example'

/** The life simulation's numbers, each with its source line (`data/life.json`). */
export const LIFE_DEFAULTS = lifeNumbersData
/** The life simulation's texts: the team's pt-BR and the English translation. */
export const LIFE_TEXT = lifeTextData
/** The memory and opinion numbers of the sheet (Personagens). */
export const SHEET_DEFAULTS = sheetNumbersData
