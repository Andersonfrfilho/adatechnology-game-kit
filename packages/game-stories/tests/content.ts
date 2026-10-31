import { getNamePools, getProfession, SHEET_RULESET } from '@adatechnology/game-characters-people'

/** The content the core takes by option: the tests run on the people pack, as a game that wants the default would. */
export const contentOf = (locale = 'pt-BR') => ({ names: getNamePools(locale), ruleset: SHEET_RULESET })

export const professionNameOf = (professionId: string, locale: string): string | undefined => getProfession(professionId)?.name[locale === 'en' ? 'en' : 'pt-BR']
