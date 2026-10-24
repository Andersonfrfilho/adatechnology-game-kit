import { readFileSync } from 'node:fs'

import { extractLiteral } from './cut-literal'
import { SOURCE_PATHS } from './paths'

export type GalleryOptions = Readonly<Record<string, string | number | boolean | undefined>>
/** name, category, calibre, capacity, length mm, barrel mm, empty mass kg, builder, options */
export type GalleryWeaponRow = readonly [string, string, string, string, number, number, number, string, GalleryOptions]
/** name, case diameter, overall length, case length, projectile diameter (mm), cartridge type */
export type GalleryAmmoRow = readonly [string, number, number, number, number, string]
export type GalleryExplosiveRow = readonly [string, string, string, string]
export type GalleryCondition = { readonly n: string; readonly p: number }

export type GalleryData = {
  readonly weapons: readonly GalleryWeaponRow[]
  readonly categories: Readonly<Record<string, string>>
  readonly ammo: readonly GalleryAmmoRow[]
  readonly explosives: readonly GalleryExplosiveRow[]
  readonly conditions: Readonly<Record<string, GalleryCondition>>
}

export const extractGallery = (): GalleryData => {
  const source = readFileSync(SOURCE_PATHS.gallery, 'utf8')
  return {
    weapons: extractLiteral(source, 'WEAP'),
    categories: extractLiteral(source, 'CATS'),
    ammo: extractLiteral(source, 'AMMO'),
    explosives: extractLiteral(source, 'EXP'),
    conditions: extractLiteral(source, 'QUAL'),
  }
}

/** Gallery `capOf`: rounds in the first option, chamber included. */
export const galleryCapacity = (capacity: string): number =>
  String(capacity)
    .split('/')[0]!
    .split('+')
    .reduce((total, part) => total + parseInt(part, 10), 0)

/** Gallery `P.fam` (the reload family of each builder), ported from the builders at lines 82, 148, 252, 256, 269, 280, 296 and 402. */
export const galleryFamily = (row: GalleryWeaponRow): string => {
  const [, , , , , , , builder, options] = row
  if (builder === 'pistol') return 'pistol'
  if (builder === 'revolver') return 'revolver'
  if (builder === 'bullpup') return options.shot ? 'pump' : 'rifle'
  if (builder === 'p90') return 'p90'
  if (builder === 'break') return 'break'
  if (builder === 'm2') return 'belt'
  if (builder === 'launcher') return options.lt === 'flame' || options.lt === 'flameDIY' ? 'flame' : 'rocket'
  if (options.mag === 'belt') return 'belt'
  if (options.pump) return 'pump'
  if (options.lever) return 'lever'
  if (options.tube) return 'semi12'
  if (options.bolt) return options.mag === 'box' ? 'boltmag' : 'bolt'
  return options.mag === 'internal' ? 'semiint' : 'rifle'
}
