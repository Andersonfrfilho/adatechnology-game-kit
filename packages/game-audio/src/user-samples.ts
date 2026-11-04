/**
 * The owner's own sounds, kept out of the kit. Files whose licence the kit cannot redistribute (game rips, paid libraries) never enter git or npm:
 * a list of picks (`user-sounds/picks.json`: sound id, the pack and the files in it) says which file answers which sound, the script `sfx:user`
 * converts those files from the owner's folder into `.sfx-local/` (ignored by git) with a manifest, and `loadUserSamples` registers them on an
 * engine from where that folder is served.
 *
 * Each pick has a role. `primary`: the kit has no recording of that sound, so the owner's file plays. `fallback`: the kit's recording plays first;
 * the owner's file is registered under the same id only when the kit has none loaded (its manifest could not be fetched). Every pick is also
 * registered under `user:<id>`, so a panel can play the owner's take next to the kit's.
 */
import { sampleBankFromManifest, splitTier } from './manifest'
import type { SfxLayer } from './manifest'
import { kitSampleDefaults } from './kit-samples'
import type { SoundBank } from './recipe'

export const USER_SAMPLES_BANK = 'user_samples'
export const KIT_SAMPLES_BANK = 'kit_samples'
/** Prefix of the id each pick is also registered under. */
export const USER_SOUND_PREFIX = 'user:'

export type UserSoundRole = 'primary' | 'fallback'

/** One sound the owner's files answer. */
export type UserSoundPick = {
  readonly id: string
  readonly role: UserSoundRole
  /** The kit category (`armas`, `personagem`...): the bus and the folder of the converted files. */
  readonly category: string
  readonly label: string
  /** The pack the files come from (a folder of the owner's sounds). */
  readonly pack: string
  /** Paths inside the pack (matched by their end, so the pack may be nested differently). */
  readonly files: readonly string[]
  /** 0–10: how well the files fit the sound (rate, clipping, band). */
  readonly score: number
  readonly loop?: boolean
}

export type UserSoundPicks = {
  readonly version: 1
  readonly author: string
  readonly license: string
  readonly picks: readonly UserSoundPick[]
}

/** One converted file, as `sfx:user` writes it. */
export type UserSfxFile = {
  readonly file: string
  readonly sampleRate: number
  readonly channels: number
  readonly peak: number
  readonly seconds: number
  readonly source: string
  readonly author: string
  readonly license: string
}

export type UserSfxSound = {
  readonly id: string
  readonly category: string
  readonly role: UserSoundRole
  readonly label: string
  readonly layers: Partial<Readonly<Record<SfxLayer, readonly UserSfxFile[]>>>
}

/** The manifest `sfx:user` writes in `.sfx-local/manifest.json`. */
export type UserSfxManifest = {
  readonly version: 1
  readonly sounds: readonly UserSfxSound[]
}

/** Where a voice came from: the kit's recording, the owner's file, or the synthesized recipe. */
export type SoundSource = 'sdk' | 'user' | 'synth'

/** The source of a started voice, from its kind and the bank its id is registered in. */
export function soundSourceOf(event: { readonly kind: 'recipe' | 'sample'; readonly bank?: string }): SoundSource {
  if (event.kind === 'recipe') return 'synth'
  return event.bank === USER_SAMPLES_BANK ? 'user' : 'sdk'
}

export type UserSampleBankOptions = {
  readonly baseUrl?: string
  /** True for an id the kit already plays from a file: a `fallback` pick is then only registered under `user:<id>`. */
  readonly kitHas?: (id: string) => boolean
}

export type UserSampleBankResult = {
  readonly bank: SoundBank
  /** Ids the owner's files now answer (primary picks, and fallbacks the kit lacks). */
  readonly playing: readonly string[]
  /** Fallback ids the kit answers, kept under `user:<id>`. */
  readonly behindKit: readonly string[]
}

/** The bank of the owner's converted files. */
export function userSampleBank(manifest: UserSfxManifest, options: UserSampleBankOptions = {}): UserSampleBankResult {
  const playing: string[] = []
  const behindKit: string[] = []
  const sounds: UserSfxSound[] = []
  for (const picked of manifest.sounds) {
    // a strength tier (`mag_seat_medium`) answers its base id (`mag_seat`), the id the kit's tiers are played by
    const sound = { ...picked, id: splitTier(picked.id).base }
    sounds.push({ ...sound, id: `${USER_SOUND_PREFIX}${sound.id}` })
    if (sound.role === 'fallback' && options.kitHas?.(sound.id)) {
      behindKit.push(sound.id)
      continue
    }
    sounds.push(sound)
    playing.push(sound.id)
  }
  const bank = sampleBankFromManifest(
    { sounds },
    {
      id: USER_SAMPLES_BANK,
      baseUrl: options.baseUrl ?? '',
      defaults: (sound) => kitSampleDefaults({ id: sound.id.replace(USER_SOUND_PREFIX, ''), category: sound.category }),
    },
  )
  return { bank, playing, behindKit }
}

export type LoadUserSamplesOptions = UserSampleBankOptions & {
  readonly fetchManifest?: (url: string) => Promise<UserSfxManifest>
}

type Registers = { register(bank: SoundBank): void; readonly registry?: { sample(id: string): unknown } }

const fetchManifestJson = async (url: string): Promise<UserSfxManifest> => {
  const page = (globalThis as { location?: { href?: string } }).location?.href
  if (new URL(url, page ?? 'http://localhost/').protocol === 'file:') throw new Error(`${url}: file:// is not fetched`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return (await response.json()) as UserSfxManifest
}

/**
 * Fetches `<baseUrl>manifest.json` (default `./sfx-local/`) and registers the owner's files. Call it after the kit's bank loaded, so a fallback
 * pick stays behind the kit's recording. Resolves to `null` when the folder is not there (a machine without the owner's sounds): nothing changes.
 */
export async function loadUserSamples(engine: Registers, options: LoadUserSamplesOptions = {}): Promise<UserSampleBankResult | null> {
  const baseUrl = options.baseUrl ?? './sfx-local/'
  let manifest: UserSfxManifest
  try {
    manifest = await (options.fetchManifest ?? fetchManifestJson)(`${baseUrl}manifest.json`)
  } catch {
    return null
  }
  const kitHas = options.kitHas ?? ((id: string): boolean => Boolean(engine.registry?.sample(id)))
  const result = userSampleBank(manifest, { baseUrl, kitHas })
  engine.register(result.bank)
  return result
}
