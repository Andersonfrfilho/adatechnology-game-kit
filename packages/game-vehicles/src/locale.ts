import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

/** Every user-visible string of the engine, grouped by area. Missing keys of a locale fall back to English. */
export type LocaleStrings = typeof en

/** A locale given by the caller: any subset of {@link LocaleStrings}. */
export type PartialLocaleStrings = { [K in keyof LocaleStrings]?: Partial<LocaleStrings[K]> }

const registry: Record<string, PartialLocaleStrings> = { en, 'pt-BR': ptBR }

/** Registers (or extends) a locale under a code such as `es` or `pt-BR`. Missing keys fall back to English. */
export function registerLocale(code: string, strings: PartialLocaleStrings | Record<string, any>): void {
  registry[code] = merge(registry[code] || {}, strings)
}

/** Codes of the registered locales. */
export function listLocales(): string[] {
  return Object.keys(registry)
}

function merge(base: any, extra: any): any {
  const out: any = Array.isArray(base) ? base.slice() : Object.assign({}, base)
  Object.keys(extra || {}).forEach(function (k) {
    const v = extra[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge(out[k] && typeof out[k] === 'object' ? out[k] : {}, v)
    else if (v !== undefined) out[k] = v
  })
  return out
}

/** Copies `source` into `target` in place, level by level (the string table of a live kit has to stay the same object). */
export function assignDeep(target: any, source: any): any {
  Object.keys(source || {}).forEach(function (k) {
    const v = source[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) target[k] = assignDeep(target[k] && typeof target[k] === 'object' ? target[k] : {}, v)
    else if (v !== undefined) target[k] = v
  })
  return target
}

/**
 * Resolves a locale to a complete string table.
 * Accepts a registered code (`'pt-BR'`; `'pt'` finds `'pt-BR'`, `'en-US'` finds `'en'`), or a partial table that overrides English.
 */
export function resolveStrings(locale?: string | PartialLocaleStrings): LocaleStrings {
  /* English is the base of every locale, including the keys content packs add to it with registerLocale */
  const base = registry.en || en
  if (locale && typeof locale === 'object') return merge(base, locale)
  const code = locale || 'en'
  const hit = findLocale(code)
  return hit ? merge(base, hit) : (merge(base, {}) as LocaleStrings)
}

function findLocale(code: string): PartialLocaleStrings | null {
  if (registry[code]) return registry[code]
  const lower = code.toLowerCase()
  const exact = Object.keys(registry).find((k) => k.toLowerCase() === lower)
  if (exact) return registry[exact]
  const lang = lower.split(/[-_]/)[0]
  const byLang = Object.keys(registry).find((k) => k.toLowerCase().split(/[-_]/)[0] === lang)
  return byLang ? registry[byLang] : null
}

/** Replaces `{name}` in a template. `{Name}` (capital first letter) capitalises the value of `name`. Unknown names stay as written. */
export function format(template: string, vars?: Record<string, unknown>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, function (whole, name: string) {
    if (name in vars) return String(vars[name])
    const lower = name.charAt(0).toLowerCase() + name.slice(1)
    if (lower !== name && lower in vars) {
      const v = String(vars[lower])
      return v.charAt(0).toUpperCase() + v.slice(1)
    }
    return whole
  })
}

/** A function that looks up a dotted key (`'zones.hood'`) and fills in its variables. */
export type Translate = (key: string, vars?: Record<string, unknown>) => string

/**
 * Builds the translate function of a string table. The variable `s` (-1 left, +1 right) is expanded to
 * `{side}` (feminine word) and `{sideM}` (masculine word), so one template reads right in languages with grammatical gender.
 */
export function createTranslate(strings: LocaleStrings): Translate {
  return function t(key, vars) {
    let cur: any = strings
    for (const part of key.split('.')) {
      cur = cur == null ? undefined : cur[part]
      if (cur === undefined) break
    }
    if (typeof cur !== 'string') return key
    if (vars && typeof vars.s === 'number') {
      const left = vars.s < 0
      vars = Object.assign({ side: strings.sides[left ? 'left' : 'right'], sideM: strings.sides[left ? 'leftM' : 'rightM'] }, vars)
    }
    return format(cur, vars)
  }
}

/** Regular expressions that recognise a part by its label when no `key` was given. Built from the `matchers` of the string table. */
export interface Matchers {
  windshield: RegExp
  rear: RegExp
  side: RegExp
  tank: RegExp
  diesel: RegExp
  fuel: RegExp
  /** Zone ids that already start like a glass id, so no `glass_` prefix is added. */
  glassId: RegExp
}

export function createMatchers(strings: LocaleStrings): Matchers {
  const m = strings.matchers
  return {
    windshield: new RegExp(m.windshield, 'i'),
    rear: new RegExp(m.rear, 'i'),
    side: new RegExp(m.side, 'i'),
    tank: new RegExp(m.tank, 'i'),
    diesel: new RegExp(m.diesel, 'i'),
    fuel: new RegExp(m.fuel, 'i'),
    glassId: new RegExp('^(?:' + m.glass_id + ')'),
  }
}
