import type { InteractablesLocale, Strings } from './types'

/** Engine-level prompts and messages. Content packs add their own keys through `WorldOptions.strings`. */
export const locales: Record<InteractablesLocale, Strings> = {
  en: {
    'prompt.open': 'Open {name}',
    'prompt.close': 'Close {name}',
    'prompt.turn_on': 'Turn on {name}',
    'prompt.turn_off': 'Turn off {name}',
    'prompt.take': 'Take',
    'prompt.sit': 'Sit',
    'prompt.lie_down': 'Lie down',
    'prompt.get_up': 'Get up',
    'prompt.light': 'Light',
    'prompt.change_channel': 'Change channel',
    'prompt.read': 'Read',
    'prompt.breaker_on': 'Switch on {circuit}',
    'prompt.breaker_off': 'Switch off {circuit}',
    'prompt.open_valve': 'Open valve',
    'prompt.close_valve': 'Close valve',
    no_power: 'No power',
    no_gas: 'No gas',
    no_water: 'No water',
    locked: 'Locked',
    empty: 'Empty',
    full: 'Full',
  },
  'pt-BR': {
    'prompt.open': 'Abrir {name}',
    'prompt.close': 'Fechar {name}',
    'prompt.turn_on': 'Ligar {name}',
    'prompt.turn_off': 'Desligar {name}',
    'prompt.take': 'Pegar',
    'prompt.sit': 'Sentar',
    'prompt.lie_down': 'Deitar',
    'prompt.get_up': 'Levantar',
    'prompt.light': 'Acender',
    'prompt.change_channel': 'Trocar de canal',
    'prompt.read': 'Ler',
    'prompt.breaker_on': 'Ligar {circuit}',
    'prompt.breaker_off': 'Desligar {circuit}',
    'prompt.open_valve': 'Abrir registro',
    'prompt.close_valve': 'Fechar registro',
    no_power: 'Sem energia',
    no_gas: 'Sem gás',
    no_water: 'Sem água',
    locked: 'Trancado',
    empty: 'Vazio',
    full: 'Cheio',
  },
}

/** Pick a built-in locale for an arbitrary tag (`pt`, `pt-br`, `en-GB`...). Unknown tags give `en`. */
export function pickLocale(locale: string | undefined): InteractablesLocale {
  if (!locale) return 'en'
  const l = locale.toLowerCase()
  if (l === 'pt-br' || l === 'pt') return 'pt-BR'
  return 'en'
}

/**
 * Merged table for a locale: built-in `en`, then the built-in table of `locale`, then the extra strings for `en` and for `locale`.
 * Lookup therefore falls back to English, and the caller never gets undefined for engine keys.
 */
export function resolveStrings(locale?: string, extra?: Partial<Record<InteractablesLocale, Strings>>): Strings {
  const loc = pickLocale(locale)
  return { ...locales.en, ...locales[loc], ...(extra?.en ?? {}), ...(loc === 'en' ? {} : (extra?.[loc] ?? {})) }
}

/** Replace `{name}` placeholders. Unknown placeholders are left untouched. */
export function format(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
