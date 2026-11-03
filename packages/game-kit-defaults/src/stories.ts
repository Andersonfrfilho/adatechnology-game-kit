import { getNamePools, getProfession, SHEET_RULESET } from '@adatechnology/game-characters-people'

/** The name pools of the language and the sheet ruleset of `game-characters-people`, as the options `createStoryWorld` and `createStoriesTestModule` of `game-stories` take them. */
export function defaultStoryContent(locale = 'pt-BR'): { names: ReturnType<typeof getNamePools>; ruleset: typeof SHEET_RULESET; professionName: (professionId: string, language: string) => string | undefined } {
  return { names: getNamePools(locale), ruleset: SHEET_RULESET, professionName: defaultProfessionName }
}

/** The name of a profession of `game-characters-people` in `en` or `pt-BR` (the `professionName` option of the stories bench). */
export function defaultProfessionName(professionId: string, locale: string): string | undefined {
  return getProfession(professionId)?.name[locale === 'en' ? 'en' : 'pt-BR']
}
