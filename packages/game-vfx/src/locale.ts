import { en } from './locales/en'
import { ptBR } from './locales/pt-BR'

/** Locales shipped with the package. Unknown locales fall back to `en`. */
export type VfxLocale = 'en' | 'pt-BR'

/** The texts of one Workshop effect: its card in the list and its sheet (when, how it looks, what it costs, what goes over the network). */
export interface EffectTexts {
  readonly name: string
  readonly short: string
  /** The cost shown on the card, and what comes with it. */
  readonly cost: string
  readonly costNote: string
  /** The label of the effect's parameter, when it has one. */
  readonly paramLabel?: string
  readonly when: string
  readonly look: string
  readonly budget: string
  readonly network: string
}

/** The words around the sheet (`renderSheet`, W1266). */
export interface SheetLabels {
  readonly when: string
  readonly look: string
  readonly budget: string
  readonly network: string
  readonly quality: string
  readonly replay: string
  readonly auto: string
}

export interface VfxStrings {
  readonly effects: Readonly<Record<string, EffectTexts>>
  readonly sheet: SheetLabels
  readonly groups: Readonly<Record<string, string>>
}

export const locales: Record<VfxLocale, VfxStrings> = {
  en: {
    effects: en,
    sheet: { when: 'When', look: 'Look', budget: 'Budget', network: 'Network', quality: 'Quality', replay: 'Replay', auto: 'Auto replay' },
    groups: { explosions: 'Explosions', creatures: 'Zombies', weapons: 'Weapons and explosives', world: 'Map, weather and destruction', destruction: 'Scenery destruction', vehicles: 'Vehicles', screen: 'Characters and screen effects' },
  },
  'pt-BR': {
    effects: ptBR,
    sheet: { when: 'Quando', look: 'Visual', budget: 'Orçamento', network: 'Rede', quality: 'Qualidade', replay: 'Repetir', auto: 'Repetição automática' },
    groups: { explosions: 'Explosões', creatures: 'Zumbis', weapons: 'Armas e explosivos', world: 'Mapa, clima e destruição', destruction: 'Destruição de cenário', vehicles: 'Veículos', screen: 'Personagens e efeitos de tela' },
  },
}

export const resolveStrings = (locale: string | undefined): VfxStrings => locales[(locale as VfxLocale) ?? 'en'] ?? locales.en
