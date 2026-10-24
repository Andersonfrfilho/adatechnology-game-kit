import type { KnownDeathCause, PlayerMessageId } from '../types'

export type PlayerText = Readonly<Record<PlayerMessageId | KnownDeathCause, string>>

/** The game's own words (G 68434, 68452, 68518, 68525-68541, 68547) and the death causes it shows (G 68448, 68454, 68510, 68519, 68539). */
const PT_BR: PlayerText = {
  grabbed: 'AGARRADO! Aperte E várias vezes para empurrar ou F para a faca',
  grabbed_drown: 'O AFOGADO TE PUXA PARA O FUNDO! E várias vezes ou F para a faca',
  bitten: 'Você foi mordido. Não há cura.',
  bandaged: 'Curativo feito',
  knife_head: 'Faca na cabeça!',
  knife_miss: 'Errou a facada',
  pushed_off: 'Empurrou!',
  drowning: 'Afogando! Solte-se!',
  no_jaw: 'Sem mandíbula: só arranhou',
  stood_up: 'De pé!',
  infected: 'Morreu infectado',
  killed: 'Morto pela horda',
  bitten_to_death: 'Mordido',
  infection: 'A infecção venceu',
  bled_out: 'Sangrou até a morte',
  hunger_thirst: 'Fome e sede',
  drowned: 'Afogado',
  burned: 'Queimado',
}

const EN: PlayerText = {
  grabbed: 'GRABBED! Press E repeatedly to push or F for the knife',
  grabbed_drown: 'THE DROWNED PULLS YOU UNDER! E repeatedly or F for the knife',
  bitten: 'You were bitten. There is no cure.',
  bandaged: 'Wound dressed',
  knife_head: 'Knife to the head!',
  knife_miss: 'The stab missed',
  pushed_off: 'Pushed off!',
  drowning: 'Drowning! Break free!',
  no_jaw: 'No jaw: only a scratch',
  stood_up: 'Back on your feet!',
  infected: 'Died infected',
  killed: 'Killed by the horde',
  bitten_to_death: 'Bitten',
  infection: 'The infection won',
  bled_out: 'Bled to death',
  hunger_thirst: 'Hunger and thirst',
  drowned: 'Drowned',
  burned: 'Burned',
}

export const PLAYER_TEXT: Readonly<Record<'en' | 'pt-BR', PlayerText>> = { en: EN, 'pt-BR': PT_BR }

/** The text of a message or death cause id in a locale (`pt-BR` or `en`, the language part is enough); unknown ids come back as they are. */
export const playerTextOf = (id: string, locale = 'pt-BR'): string => {
  const table = locale.toLowerCase().startsWith('en') ? EN : PT_BR
  return (table as Readonly<Record<string, string>>)[id] ?? id
}
