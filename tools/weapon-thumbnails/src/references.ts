import { readFileSync, writeFileSync } from 'node:fs'

import { createArsenal, genericWeapons } from '@adatechnology/game-weapons'

/** A photo of the real weapon to compare the model with: the free image the Wikipedia article of the weapon shows, or a Commons photo of it. */
export type WeaponReference = {
  readonly title: string
  readonly page: string
  /** A copy about 960 px wide, from the Commons servers. */
  readonly url: string
  readonly width: number
  readonly height: number
  readonly author: string
  readonly license: string
  readonly licenseUrl?: string
  /** How it was found: the image of the article (`wikipedia: <article>`) or a search of Commons (`commons: <query>`). */
  readonly found: string
}

export type ReferenceFile = {
  readonly about: string
  readonly references: Readonly<Record<string, WeaponReference>>
  /** Weapons with no free photo found: kept so a person fills them by hand. */
  readonly missing: readonly string[]
  /** The Commons file a person chose for a weapon (`File:...`): always used, before any search. An empty name: there is no free photo of that exact model (a G36K is not a G36), so it stays missing instead of borrowing another's. */
  readonly pinned?: Readonly<Record<string, string>>
}

type Fetch = (url: string) => Promise<unknown>
type Page = { readonly title?: string; readonly pageimage?: string; readonly imageinfo?: readonly ImageInfo[] }
type ImageInfo = { readonly url: string; readonly thumburl?: string; readonly descriptionurl: string; readonly width: number; readonly height: number; readonly extmetadata?: Record<string, { readonly value?: string }> }

const USER_AGENT = 'adatechnology-game-kit/1.0 (weapon references; https://github.com/Andersonfrfilho/adatechnology-game-kit)'
const THUMB_WIDTH = 960
// a gun seen from the side is long: a photo much taller than that is a person holding it, a map or a detail
const MIN_SIDE_RATIO = 1.6
// what a Commons search brings that is not the weapon seen from the side
const NOT_A_PROFILE = /map|operators|users|flag|logo|diagram|chart|insignia|coat of arms|stamp|manual|patent|cartridge|ammunition|soldier|policeman|training|firing|range|exercise|re-enactment|show|mission|catalog|coin|school|switch|cybergun|airsoft|toy|replica/i
// a photo, never a drawing, a sound or a video
const PHOTO = /\.(jpe?g|png|webp|tiff?)$/i
// what is long and seen from the side: a gun, a blade, a bat, a bow
const LONG_CATEGORIES = new Set(['pistol', 'revolver', 'smg', 'pdw', 'carbine', 'rifle', 'dmr', 'hunting', 'sniper', 'shotgun', 'machine_gun', 'launcher', 'bow', 'crossbow', 'melee_blade', 'melee_blunt'])
// the licences a reference may carry: free ones, never a fair-use image of the article
const FREE_LICENSE = /public domain|^pd|cc0|cc[ -]by|gfdl|attribution/i

const strip = (html: string | undefined): string => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

const asPages = (body: unknown): Page[] => Object.values(((body as { query?: { pages?: Record<string, Page> } }).query?.pages ?? {}))

/** The reference of a Commons file, or null when it is not a free photo of the weapon (`isSideView`: of the whole weapon from the side). */
export const referenceOf = (page: Page, found: string, isSideView: boolean): WeaponReference | null => {
  const info = page.imageinfo?.[0]
  if (!info || !page.title) return null
  const meta = info.extmetadata ?? {}
  const license = strip(meta['LicenseShortName']?.value)
  if (!FREE_LICENSE.test(license) || !PHOTO.test(page.title)) return null
  if (isSideView && info.width / info.height < MIN_SIDE_RATIO) return null
  const licenseUrl = strip(meta['LicenseUrl']?.value)
  return {
    title: page.title,
    page: info.descriptionurl,
    url: info.thumburl ?? info.url,
    width: info.width,
    height: info.height,
    author: strip(meta['Artist']?.value).slice(0, 160) || 'unknown',
    license,
    ...(licenseUrl ? { licenseUrl } : {}),
    found,
  }
}

/** What to search for a weapon: its name, with the word that keeps a gun's search off films and games of the same name. */
export const queryOf = (weapon: { readonly name: string; readonly category: string }): string =>
  ['melee_blade', 'melee_blunt', 'tool', 'heat', 'flame', 'extinguisher', 'throwable', 'bow', 'crossbow'].includes(weapon.category) ? weapon.name : `${weapon.name} firearm`

const commonsInfo = async (fetchJson: Fetch, files: readonly string[]): Promise<Page[]> => {
  if (!files.length) return []
  const titles = files.map((file) => (file.startsWith('File:') ? file : `File:${file}`)).join('|')
  return asPages(await fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=${THUMB_WIDTH}&titles=${encodeURIComponent(titles)}`))
}

/** A photo a search brought: `referenceOf`, and never a file whose name says it is not the weapon itself. */
const searched = (page: Page, found: string, isSideView: boolean): WeaponReference | null => (page.title && NOT_A_PROFILE.test(page.title) ? null : referenceOf(page, found, isSideView))

/** The free image of the Wikipedia article on the weapon (its infobox photo), when it shows the weapon from the side. */
const fromWikipedia = async (fetchJson: Fetch, query: string, isSideView: boolean): Promise<WeaponReference | null> => {
  const search = (await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(query)}`)) as { query?: { search?: { title: string }[] } }
  const article = search.query?.search?.[0]?.title
  if (!article) return null
  const [page] = asPages(await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=name&titles=${encodeURIComponent(article)}`))
  if (!page?.pageimage) return null
  const [file] = await commonsInfo(fetchJson, [page.pageimage])
  return file ? searched(file, `wikipedia: ${article}`, isSideView) : null
}

/** The first Commons photo of the weapon seen from the side. */
const fromCommons = async (fetchJson: Fetch, query: string, isSideView: boolean): Promise<WeaponReference | null> => {
  const body = (await fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=${THUMB_WIDTH}`)) as { query?: { pages?: Record<string, Page & { index?: number }> } }
  // the search order is the relevance: the pages come keyed by id
  const pages = Object.values(body.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  for (const page of pages) {
    const reference = searched(page, `commons: ${query}`, isSideView)
    if (reference) return reference
  }
  return null
}

// the Wikimedia APIs answer 429 to a burst: one request at a time, spaced, and a wait that doubles on each 429
const REQUEST_GAP_MS = 700
const RETRIES = 5
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const nodeFetch: Fetch = async (url) => {
  for (let attempt = 0; ; attempt++) {
    await wait(REQUEST_GAP_MS)
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (response.ok) return response.json() as Promise<unknown>
    if (response.status !== 429 || attempt >= RETRIES) throw new Error(`weapon references: ${response.status} for ${url}`)
    await wait(Number(response.headers.get('retry-after') ?? 0) * 1000 || 2000 * 2 ** attempt)
  }
}

/** Finds a reference photo for every weapon of the arsenal (the generic guns and the body's own blows left out): the file pinned by a person, else a Commons photo found by the weapon's own name (a variant is told apart: G36C is not G36), else the photo of its Wikipedia article. */
export async function findReferences(previous: ReferenceFile | null, fetchJson: Fetch = nodeFetch): Promise<ReferenceFile> {
  const arsenal = createArsenal({ locale: 'en' })
  const generics = genericWeapons(arsenal)
  const references: Record<string, WeaponReference> = {}
  const pinned = previous?.pinned ?? {}
  const missing: string[] = []
  for (const def of arsenal.weapons.values()) {
    if (generics.has(def.id) || def.category === 'hand' || ['kick', 'shove', 'fists'].includes(def.id)) continue
    const name = arsenal.name(def.id)
    const isSideView = LONG_CATEGORIES.has(def.category)
    const pin = pinned[def.id]
    const kept = previous?.references[def.id]
    if (pin && kept?.title === pin) {
      references[def.id] = kept
      continue
    }
    if (pin === '') {
      missing.push(def.id)
      continue
    }
    const [pinnedFile] = pin ? await commonsInfo(fetchJson, [pin]) : []
    const found = (pinnedFile && referenceOf(pinnedFile, 'pinned', false)) || (await fromCommons(fetchJson, name, isSideView)) || (await fromWikipedia(fetchJson, queryOf({ name, category: def.category }), isSideView))
    if (found) references[def.id] = found
    else missing.push(def.id)
  }
  return {
    about: 'Photos of the real weapons, to compare each model with: the Commons file pinned by a person, else a Commons photo found by the name, else the image of the Wikipedia article. A found photo may be the wrong weapon: check it, and pin the right file in `pinned`. The images stay on the Commons servers; author and licence are here.',
    references,
    missing,
    pinned,
  }
}

export async function writeReferences(path: string): Promise<ReferenceFile> {
  let previous: ReferenceFile | null = null
  try {
    previous = JSON.parse(readFileSync(path, 'utf8')) as ReferenceFile
  } catch {
    previous = null
  }
  const file = await findReferences(previous)
  writeFileSync(path, `${JSON.stringify(file, null, 1)}\n`)
  return file
}
