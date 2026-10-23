import type { FloorplanLocale } from './types'

type Namespace = keyof FloorplanLocale

const locales: Record<string, FloorplanLocale> = {}

/** Registers (or extends) the strings of a language. Packs call this with their JSON files. */
export function registerLocale(code: string, table: FloorplanLocale): void {
  const cur = (locales[code] = locales[code] || {})
  for (const ns of Object.keys(table) as Namespace[]) cur[ns] = Object.assign(cur[ns] || {}, table[ns])
}

export const listLocales = (): string[] => Object.keys(locales)

/** Looks a key up in a namespace. Falls back to English, then to the key itself. `{n}`-style variables are replaced. */
export function translate(ns: Namespace, key: string, locale = 'en', vars?: Record<string, string | number>): string {
  const raw = locales[locale]?.[ns]?.[key] ?? locales.en?.[ns]?.[key] ?? key
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : raw
}
