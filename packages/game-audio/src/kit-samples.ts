/**
 * The kit's own recorded sounds: the files in `assets/sfx/` (CC0 / CC-BY, credited in `assets/sfx/CREDITOS.md`) and the numbers each one plays
 * with. `kitSampleBank` turns the converter's manifest into a bank; `KIT_SAMPLE_ALIASES` lets a recipe id the kit already plays (`shut_wood`,
 * `rattle`...) be answered by the takes of a file id (`door_wood_shut`), so a sound that was synthesized becomes the recording with no change where
 * it is played: the recipe of the same id plays while the files load, and wherever they cannot be fetched (`file://`). `loadKitSamples` fetches the
 * manifest from where the folder is served and registers the bank on an engine.
 */
import { sampleBankFromManifest } from './manifest'
import type { SampleDefaults, SfxManifest, SfxManifestSound } from './manifest'
import type { BusId, SoundBank } from './recipe'

/** The bus of a manifest category (the folder the file sits in). */
export const KIT_CATEGORY_BUS: Readonly<Record<string, BusId>> = {
  armas: 'weapons',
  impactos: 'world',
  'explosoes-fogo': 'world',
  personagem: 'world',
  veiculos: 'world',
  'itens-portas': 'world',
  ambiente: 'ambience',
}

/** Voice sounds go on the voices bus whatever folder they are in. */
const VOICE_IDS = /^(player_(hurt|death|effort|breath)|scream|zombie_)/

/**
 * Recipe id → file id. The recipe keeps playing until the takes of the file id load. Hand-worked leaves (doors, drawers) of `game-destruction-three`
 * and the hand sounds of items.
 */
export const KIT_SAMPLE_ALIASES: Readonly<Record<string, string>> = {
  // a house door: the latch giving, the hinge, the leaf meeting the frame, a locked one shaken; a drawer on its runners
  latch: 'metal_latch',
  creak_wood: 'door_creak',
  shut_wood: 'door_wood_shut',
  rattle: 'door_locked_rattle',
  // a drawer stays on its recipe: the recorded runs (1 to 1.9 s) outlast a drawer's pull
  // an item taken in the hand (game-destruction-three grab_* keys)
  grab_hard: 'item_pickup_generic',
  grab_soft: 'item_pickup_leather',
}

/** The numbers of a sound the files do not say: the bus of its folder, a little pitch spread. */
export function kitSampleDefaults(sound: { readonly id: string; readonly category: string }): SampleDefaults | undefined {
  const bus = VOICE_IDS.test(sound.id) ? 'voices' : KIT_CATEGORY_BUS[sound.category]
  if (!bus) return undefined
  return { bus, pitch: sound.category === 'ambiente' || /_loop/.test(sound.id) ? 0 : 0.04 }
}

export type KitSampleBankOptions = {
  /** Where the `assets/sfx/` folder is served (`./sfx/`). */
  readonly baseUrl?: string
  /** Recipe id → file id (default `KIT_SAMPLE_ALIASES`); `{}` adds none. */
  readonly aliases?: Readonly<Record<string, string>>
  readonly id?: string
}

/** The manifest with each alias as one more sound, holding the takes of its file id. */
export function withAliases(manifest: SfxManifest, aliases: Readonly<Record<string, string>>): SfxManifest {
  const byId = new Map(manifest.sounds.map((sound) => [sound.id, sound]))
  const extra: SfxManifestSound[] = []
  for (const [alias, target] of Object.entries(aliases)) {
    const sound = byId.get(target)
    if (sound && !byId.has(alias)) extra.push({ ...sound, id: alias })
  }
  return { ...manifest, sounds: [...manifest.sounds, ...extra] }
}

/** The bank of the kit's files. */
export function kitSampleBank(manifest: SfxManifest, options: KitSampleBankOptions = {}): SoundBank {
  return sampleBankFromManifest(withAliases(manifest, options.aliases ?? KIT_SAMPLE_ALIASES), {
    id: options.id ?? 'kit_samples',
    baseUrl: options.baseUrl ?? '',
    defaults: kitSampleDefaults,
  })
}

export type LoadKitSamplesOptions = KitSampleBankOptions & {
  /** Gets the manifest (default `fetch` of `<baseUrl>manifest.json`). */
  readonly fetchManifest?: (url: string) => Promise<SfxManifest>
  /** Ids to load right away instead of on their first play (the sounds of the first seconds, so they are not the recipe). */
  readonly preload?: readonly string[]
}

type Registers = { register(bank: SoundBank): void; loadSamples?(ids?: readonly string[]): Promise<unknown> }

/** True when `url`, read against the page, is a `file://` one: `fetch` refuses that scheme and the browser logs an error for each try. */
const isFileUrl = (url: string): boolean => {
  const page = (globalThis as { location?: { href?: string } }).location?.href
  try {
    return new URL(url, page).protocol === 'file:'
  } catch {
    return false
  }
}

const fetchJson = async (url: string): Promise<SfxManifest> => {
  // a page opened from disk keeps the recipes without asking: the refused fetch would only put an error in the console
  if (isFileUrl(url)) throw new Error(`${url}: file:// is not fetched`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return (await response.json()) as SfxManifest
}

/**
 * Fetches the manifest and registers the bank on the engine. Resolves to the bank, or `null` when the manifest cannot be had (a page opened from
 * `file://`, the folder not served): the recipes keep playing, so that is not an error.
 */
export async function loadKitSamples(engine: Registers, options: LoadKitSamplesOptions = {}): Promise<SoundBank | null> {
  const baseUrl = options.baseUrl ?? ''
  let manifest: SfxManifest
  try {
    manifest = await (options.fetchManifest ?? fetchJson)(`${baseUrl}manifest.json`)
  } catch {
    return null
  }
  const bank = kitSampleBank(manifest, options)
  engine.register(bank)
  if (options.preload && engine.loadSamples) void engine.loadSamples(options.preload).catch(() => undefined)
  return bank
}
