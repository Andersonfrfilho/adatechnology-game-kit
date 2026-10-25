import type { FluidEvent, LiquidId } from './types'

/** Locales shipped with the package. Unknown locales fall back to `en`. */
export type FluidLocale = 'en' | 'pt-BR'

export interface FluidStrings {
  /** Display name per liquid id (unknown ids fall back to the id itself). */
  liquids: Record<LiquidId, string>
  /** Short label per event type. */
  events: Record<FluidEvent['type'], string>
  on: string
  off: string
}

export const locales: Record<FluidLocale, FluidStrings> = {
  en: {
    liquids: {
      water: 'water',
      coffee: 'coffee',
      tea: 'tea',
      milk: 'milk',
      soda: 'soda',
      juice: 'juice',
      beer: 'beer',
      wine: 'wine',
      spirits: 'spirits',
      fuel: 'gasoline',
      diesel: 'diesel',
      motor_oil: 'motor oil',
      cooking_oil: 'cooking oil',
      blood: 'blood',
      old_blood: 'old blood',
      bile: 'bile',
      sap: 'sap',
      acid: 'acid',
      paint: 'paint',
      bleach: 'bleach',
      honey: 'honey',
    },
    events: {
      fill: 'filled',
      pour: 'poured',
      spill: 'spilled',
      leak: 'leaking',
      drink: 'drank',
      empty: 'emptied',
      stream_end: 'stream ended',
      splash: 'splash',
      stain: 'stain',
      dried: 'dried',
      steam: 'steam',
      mix: 'mixed',
      tap: 'tap',
    },
    on: 'on',
    off: 'off',
  },
  'pt-BR': {
    liquids: {
      water: 'água',
      coffee: 'café',
      tea: 'chá',
      milk: 'leite',
      soda: 'refrigerante',
      juice: 'suco',
      beer: 'cerveja',
      wine: 'vinho',
      spirits: 'destilado',
      fuel: 'gasolina',
      diesel: 'diesel',
      motor_oil: 'óleo de motor',
      cooking_oil: 'óleo de cozinha',
      blood: 'sangue',
      old_blood: 'sangue antigo',
      bile: 'bile',
      sap: 'seiva',
      acid: 'ácido',
      paint: 'tinta',
      bleach: 'água sanitária',
      honey: 'mel',
    },
    events: {
      fill: 'encheu',
      pour: 'despejou',
      spill: 'derramou',
      leak: 'vazando',
      drink: 'bebeu',
      empty: 'esvaziou',
      stream_end: 'parou de escorrer',
      splash: 'respingo',
      stain: 'mancha',
      dried: 'secou',
      steam: 'vapor',
      mix: 'misturou',
      tap: 'torneira',
    },
    on: 'ligado',
    off: 'desligado',
  },
}

export const resolveStrings = (locale: string | undefined): FluidStrings => locales[(locale as FluidLocale) ?? 'en'] ?? locales.en

const fmt = (n: number): string => `${(Math.round(n * 1000) / 1000).toString()} l`
const pt = (p: [number, number, number]): string => `(${p.map((v) => Math.round(v * 100) / 100).join(', ')})`

/** One-line description of an event for logs and debug panels, e.g. `drank: coffee 0.03 l`. */
export const describeEvent = (strings: FluidStrings, event: FluidEvent): string => {
  const label = strings.events[event.type]
  const name = (id: LiquidId) => strings.liquids[id] ?? id
  switch (event.type) {
    case 'fill':
      return `${label}: ${event.container} ${name(event.liquid)} ${fmt(event.liters)}`
    case 'pour':
    case 'spill':
      return `${label}: ${event.container} ${name(event.liquid)} ${fmt(event.rate)}/s`
    case 'leak':
      return `${label}: ${event.container} ${name(event.liquid)} ${fmt(event.rate)}/s ${pt(event.point)}`
    case 'drink':
      return `${label}: ${event.container} ${name(event.liquid)} ${fmt(event.liters)}${event.effects.length ? ` [${event.effects.join(', ')}]` : ''}${event.burn ? ' !' : ''}`
    case 'empty':
      return `${label}: ${event.container}`
    case 'stream_end':
      return `${label}: ${event.stream}`
    case 'splash':
      return `${label}: ${name(event.liquid)} ${pt(event.point)}`
    case 'stain':
      return `${label}: ${event.stain} ${name(event.liquid)} ${event.surface} ${pt(event.point)}`
    case 'dried':
      return `${label}: ${event.stain}${event.mark ? ' (mark)' : ''}`
    case 'steam':
      return `${label}: ${event.container} ${event.on ? strings.on : strings.off}`
    case 'mix':
      return `${label}: ${event.container} ${name(event.from)} -> ${name(event.into)}`
    case 'tap':
      return `${label}: ${event.tap} ${event.on ? strings.on : strings.off}`
  }
}
