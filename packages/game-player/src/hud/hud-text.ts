/** The words of the player's HUD and of the death screen, in a locale. */
export type PlayerHudText = {
  readonly health: string
  readonly stamina: string
  readonly hunger: string
  readonly thirst: string
  readonly bleeding: string
  readonly wounds: string
  readonly infected: string
  readonly stageMalaise: string
  readonly stageFever: string
  readonly stageDelirium: string
  readonly woundScratch: string
  readonly woundLaceration: string
  readonly woundBite: string
  readonly died: string
  readonly survived: string
  readonly restart: string
  readonly backToStart: string
}

const PT_BR: PlayerHudText = {
  health: 'Vida',
  stamina: 'Fôlego',
  hunger: 'Fome',
  thirst: 'Sede',
  bleeding: 'Sangrando',
  wounds: 'Ferimentos',
  infected: 'Infectado',
  stageMalaise: 'mal-estar',
  stageFever: 'febre',
  stageDelirium: 'delírio',
  woundScratch: 'arranhão',
  woundLaceration: 'corte',
  woundBite: 'mordida',
  died: 'Você morreu',
  survived: 'Sobreviveu {time}',
  restart: 'Reiniciar cena',
  backToStart: 'Voltar ao início',
}

const EN: PlayerHudText = {
  health: 'Health',
  stamina: 'Stamina',
  hunger: 'Hunger',
  thirst: 'Thirst',
  bleeding: 'Bleeding',
  wounds: 'Wounds',
  infected: 'Infected',
  stageMalaise: 'malaise',
  stageFever: 'fever',
  stageDelirium: 'delirium',
  woundScratch: 'scratch',
  woundLaceration: 'laceration',
  woundBite: 'bite',
  died: 'You died',
  survived: 'Survived {time}',
  restart: 'Restart scene',
  backToStart: 'Back to the start',
}

export const PLAYER_HUD_TEXT: Readonly<Record<'en' | 'pt-BR', PlayerHudText>> = { en: EN, 'pt-BR': PT_BR }

/** The HUD's words for a locale (`pt-BR` or `en`, the language part is enough; anything else is `pt-BR`). */
export const playerHudTextOf = (locale = 'pt-BR'): PlayerHudText => (locale.toLowerCase().startsWith('en') ? EN : PT_BR)

const WOUND_KEY: Readonly<Record<string, keyof PlayerHudText>> = { scratch: 'woundScratch', laceration: 'woundLaceration', bite: 'woundBite' }
const STAGE_KEY: Readonly<Record<string, keyof PlayerHudText>> = { malaise: 'stageMalaise', fever: 'stageFever', delirium: 'stageDelirium' }

/** A wound kind in words; a kind the table does not know (a game's own) comes back as it is. */
export const woundTextOf = (text: PlayerHudText, kind: string): string => {
  const key = WOUND_KEY[kind]
  return key ? text[key] : kind
}

/** An infection stage in words (`none` gives an empty text). */
export const stageTextOf = (text: PlayerHudText, stage: string): string => {
  const key = STAGE_KEY[stage]
  return key ? text[key] : ''
}

/** Seconds as `m:ss` (or `h:mm:ss` past the hour). */
export const formatSurvived = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
