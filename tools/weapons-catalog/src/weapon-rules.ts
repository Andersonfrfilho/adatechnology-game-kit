import type { Decisions } from './decisions'
import type { GalleryWeaponRow } from './extract-gallery'
import { galleryFamily } from './extract-gallery'

export type ReloadFamilyId =
  | 'pistol' | 'magazine' | 'top_magazine' | 'top_load_semi' | 'tube_semi' | 'pump' | 'lever' | 'bolt' | 'bolt_magazine' | 'belt' | 'revolver' | 'break' | 'rocket' | 'flame'

const FAMILY_BY_GALLERY: Readonly<Record<string, ReloadFamilyId>> = {
  pistol: 'pistol',
  revolver: 'revolver',
  rifle: 'magazine',
  p90: 'top_magazine',
  pump: 'pump',
  semi12: 'tube_semi',
  break: 'break',
  semiint: 'top_load_semi',
  bolt: 'bolt',
  boltmag: 'bolt_magazine',
  lever: 'lever',
  belt: 'belt',
  rocket: 'rocket',
  flame: 'flame',
}

export const GALLERY_CATEGORIES: Readonly<Record<string, string>> = {
  pis: 'pistol',
  rev: 'revolver',
  smg: 'smg',
  esc: 'shotgun',
  fuz: 'rifle',
  dmr: 'dmr',
  snp: 'sniper',
  cac: 'hunting',
  mtr: 'machine_gun',
  lan: 'launcher',
}

export const reloadFamilyOf = (row: GalleryWeaponRow): ReloadFamilyId => {
  const family = FAMILY_BY_GALLERY[galleryFamily(row)]
  if (!family) throw new Error(`weapons-catalog: no reload family for "${galleryFamily(row)}"`)
  return family
}

const MANUAL_FAMILIES = new Set<string>(['pump', 'bolt', 'bolt_magazine', 'lever'])
export const isManualAction = (family: string): boolean => MANUAL_FAMILIES.has(family)

const BRAND_SEPARATOR = /[^a-z0-9]+/g
export const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/'/g, '')
    .replace(BRAND_SEPARATOR, '_')
    .replace(/^_+|_+$/g, '')

export const makerOf = (name: string, decisions: Decisions): string | undefined =>
  [...decisions.makers.value].sort((first, second) => second.length - first.length).find((brand) => name === brand || name.startsWith(`${brand} `))

/** Archetype for a weapon: `category:caliber`, then `shotgun:family`, then `category:*`. */
export const archetypeOf = (category: string, caliber: string, family: string, decisions: Decisions): string => {
  const keys = [`${category}:${caliber}`, ...(category === 'shotgun' ? [`shotgun:${family}`] : []), `${category}:*`]
  for (const key of keys) {
    const decision = decisions.archetypes[key]
    if (decision) return decision.value
  }
  throw new Error(`weapons-catalog: no archetype for ${category} in ${caliber}`)
}

export type ModeResult = { readonly modes: readonly string[]; readonly burst?: number }

export const modesOf = (row: GalleryWeaponRow, family: string, decisions: Decisions): ModeResult => {
  const named = decisions.modes.byName[row[0]]
  if (named) return named.value
  const hasRate = typeof row[8].rpm === 'number'
  if (hasRate) return { modes: family === 'belt' ? ['auto'] : decisions.modes.withRate.value }
  const byFamily = decisions.modes.byFamily.value[family]
  return { modes: byFamily ?? decisions.modes.default.value }
}

const ROUND_RPM = 100
const roundRpm = (value: number): number => Math.round(value * ROUND_RPM) / ROUND_RPM

/** Q1 and Q2: the gallery rate when there is one, 60 over the cycle for manual actions, else the practical semi rate. */
export const rateOf = (row: GalleryWeaponRow, family: string, caliber: string, category: string, decisions: Decisions): number => {
  const galleryRate = row[8].rpm
  if (typeof galleryRate === 'number') return galleryRate
  const cycle = decisions.cycleSeconds.value[family]
  if (isManualAction(family) && cycle !== undefined) return roundRpm(60 / cycle)
  const rates = decisions.semiRate.value
  return rates[caliber] ?? rates[category] ?? rates['*'] ?? 0
}

export type MagazineResult = { readonly magazine: number; readonly chamber?: number; readonly magazineOptions?: readonly number[]; readonly tubes?: number }

/** Gallery capacity text: `6+1` is magazine plus chamber, `17/33` is the base magazine and an option, `7+7+1` is decided by hand. */
export const magazineOf = (row: GalleryWeaponRow, arsenalCapacity: string | undefined, decisions: Decisions): MagazineResult => {
  const named = decisions.magazine[row[0]]
  if (named) return named.value
  const text = String(row[3])
  const [first = '', ...options] = text.split('/')
  const parts = first.split('+').map((part) => parseInt(part, 10))
  const drum = /\/\s*(\d+)\s*\(tambor\)/.exec(arsenalCapacity ?? '')
  const magazine = parts[0] ?? 0
  const magazineOptions = [...options.map((option) => parseInt(option, 10)), ...(drum ? [parseInt(drum[1] ?? '', 10)] : [])].filter((value) => value !== magazine)
  return {
    magazine,
    ...(parts[1] === undefined ? {} : { chamber: parts[1] }),
    ...(magazineOptions.length > 0 ? { magazineOptions: [...new Set(magazineOptions)] } : {}),
  }
}
