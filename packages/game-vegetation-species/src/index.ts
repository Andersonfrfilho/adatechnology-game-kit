import type { PlantSpec } from '@adatechnology/game-vegetation'
import trees from '../data/species/trees.json'
import palms from '../data/species/palms.json'
import shrubs from '../data/species/shrubs.json'
import flowers from '../data/species/flowers.json'
import cacti from '../data/species/cacti.json'
import succulents from '../data/species/succulents.json'
import grasses from '../data/species/grasses.json'
import vines from '../data/species/vines.json'
import potted from '../data/species/potted.json'
import ptBR from '../data/locales/pt-BR.json'
import en from '../data/locales/en.json'
import br from '../data/regions/br.json'
import defaultRegion from '../data/regions/default.json'
import type { Locale, LocaleTable, Region, Species } from './types'

export * from './types'

/** Every species of the pack. */
export const species: Species[] = [
  ...trees,
  ...palms,
  ...shrubs,
  ...flowers,
  ...cacti,
  ...succulents,
  ...grasses,
  ...vines,
  ...potted,
] as Species[]

const byId = new Map<string, Species>(species.map((s) => [s.id, s]))

export function getSpecies(id: string): Species | undefined {
  return byId.get(id)
}

export function listIds(): string[] {
  return species.map((s) => s.id)
}

export function byTag(tag: string): Species[] {
  return species.filter((s) => s.tags.includes(tag))
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** Replace `#rrggbb` strings by 0xRRGGBB integers, recursively. */
function resolveColors(v: unknown): unknown {
  if (typeof v === 'string' && HEX.test(v)) return parseInt(v.slice(1), 16)
  if (Array.isArray(v)) return v.map(resolveColors)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) out[k] = resolveColors(x)
    return out
  }
  return v
}

/** Convert a species (or its id) into a spec for `generate()`, with hex colors turned into integers. */
export function toSpec(s: Species | string): PlantSpec {
  const sp = typeof s === 'string' ? getSpecies(s) : s
  if (!sp) throw new Error(`game-vegetation-species: unknown species "${String(s)}"`)
  return { archetype: sp.archetype, ...(resolveColors(sp.params) as Record<string, unknown>) } as PlantSpec
}

const locales: Record<Locale, LocaleTable> = { 'pt-BR': ptBR as LocaleTable, en: en as LocaleTable }

/** Display texts for a locale (unknown locales fall back to `en`). */
export function loadLocale(locale: Locale | string = 'en'): LocaleTable {
  return (locales as Record<string, LocaleTable>)[locale] ?? locales.en
}

export function name(id: string, locale: Locale | string = 'en'): string {
  return loadLocale(locale)[id]?.name ?? locales.en[id]?.name ?? id
}

export function description(id: string, locale: Locale | string = 'en'): string {
  return loadLocale(locale)[id]?.description ?? locales.en[id]?.description ?? ''
}

export const regions = { br: br as Region, default: defaultRegion as Region }

/** Anything that yields numbers in [0, 1): a function, an object with `next()`, or a seed. */
export type RngLike = (() => number) | { next(): number } | number | string

function toNext(rng: RngLike): () => number {
  if (typeof rng === 'function') return rng
  if (typeof rng === 'object') return () => rng.next()
  // mulberry32 seeded from a number or string
  let s = typeof rng === 'number' ? rng >>> 0 : 0x811c9dc5
  if (typeof rng === 'string') {
    for (let i = 0; i < rng.length; i++) {
      s ^= rng.charCodeAt(i)
      s = Math.imul(s, 0x01000193)
    }
    s >>>= 0
  }
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Weighted pick of a species id for a context ('front_yard', 'sidewalk_tree', ...) of a region. */
export function pickForContext(region: Region, context: string, rng: RngLike): string {
  const list = region.contexts[context]
  if (!list || list.length === 0) throw new Error(`game-vegetation-species: region "${region.id}" has no context "${context}"`)
  const next = toNext(rng)
  const total = list.reduce((a, b) => a + b.weight, 0)
  let r = next() * total
  for (const it of list) {
    r -= it.weight
    if (r <= 0) return it.species
  }
  return list[list.length - 1].species
}

export { scatterRulesFor, defaultClassify } from './rules'
export type { PlantGroup, ScatterRulesOptions, ScatterRulesResult } from './rules'
