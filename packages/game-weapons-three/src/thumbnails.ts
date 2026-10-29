import manifest from '../assets/weapon-svg/manifest.json'

/** Where a thumbnail came from: the model of the kit (`generated`) or a freely licensed drawing of the real weapon (`commons`, with its author and licence). */
export interface WeaponThumbnailEntry {
  readonly source: 'generated' | 'commons'
  /** Path of the SVG inside `assets/weapon-svg`. */
  readonly file: string
  readonly author?: string
  readonly license?: string
  readonly licenseUrl?: string
  readonly page?: string
}

/** Every weapon (and world explosive) that has a thumbnail, by weapon id: the Commons file when one was kept, else the one generated from the 3D model. */
export const WEAPON_THUMBNAILS: Readonly<Record<string, WeaponThumbnailEntry>> = (manifest as { assets: Record<string, WeaponThumbnailEntry> }).assets

/** `Author, licence` of a Commons thumbnail (the credit its licence asks for), or undefined for a generated one. */
export function weaponThumbnailCredit(id: string): string | undefined {
  const entry = WEAPON_THUMBNAILS[id]
  return entry?.source === 'commons' && entry.author && entry.license ? `${entry.author}, ${entry.license}` : undefined
}

/** The folder of the thumbnails relative to the page that shows them; the site build copies `assets/weapon-svg` there. */
export const DEFAULT_THUMBNAIL_BASE = 'weapon-svg/'

/** The URL of a weapon's thumbnail under `base` (which ends with a slash), or undefined when it has none. */
export function weaponThumbnailUrl(id: string, base: string = DEFAULT_THUMBNAIL_BASE): string | undefined {
  const entry = WEAPON_THUMBNAILS[id]
  return entry ? `${base}${entry.file}` : undefined
}
