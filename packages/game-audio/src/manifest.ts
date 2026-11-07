/**
 * The manifest the converter (`scripts/sfx-convert.mjs`) writes next to the converted files: every sound id with its takes per layer, the file
 * facts the criteria check (rate, channels, peak, length) and where each file came from. `sampleBankFromManifest` turns it into a `SoundBank`
 * of `SampleSound`s, with the bus and the numbers of each sound given by the caller.
 */
import type { BusId, Falloff, SoundBank } from './recipe'
import type { SampleCrossover, SampleRef, SampleSound } from './sample'

/** Licences the SDK accepts (the files are redistributed on npm): public domain or attribution only. */
export const SDK_LICENSES = ['CC0', 'CC-BY'] as const
export type SdkLicense = (typeof SDK_LICENSES)[number]

export type SfxFileEntry = {
  /** Path from the manifest's folder: `armas/pistol_9mm_close_01.ogg`. */
  readonly file: string
  readonly sampleRate: number
  readonly channels: number
  /** dBFS. */
  readonly peak: number
  readonly seconds: number
  readonly source: string
  readonly author: string
  readonly license: SdkLicense
}

/** The layers a file name can end in: `<id>_<layer>_<nn>` (`pistol_9mm_close_01`); a name without one is a `close` take. */
export const SFX_LAYERS = ['close', 'far', 'tail_in', 'tail_out'] as const
export type SfxLayer = (typeof SFX_LAYERS)[number]

export type SfxManifestSound = {
  readonly id: string
  readonly category: string
  readonly layers: Partial<Readonly<Record<SfxLayer, readonly SfxFileEntry[]>>>
}

export type SfxManifest = {
  readonly version: 1
  readonly format: { readonly codec: 'vorbis'; readonly sampleRate: number; readonly channels: number; readonly peakDb: number }
  readonly sounds: readonly SfxManifestSound[]
}

/** The numbers of one sound that the files do not say (bus, curve, pitch...). */
export type SampleDefaults = {
  readonly bus: BusId
  readonly gain?: number
  readonly pitch?: number
  readonly crossover?: SampleCrossover
  readonly tailGain?: number
  readonly falloff?: Falloff
  readonly cutoffK?: number
  readonly group?: string
  readonly priority?: number
  readonly choke?: { readonly voices: number; readonly fade?: number }
  readonly fallback?: string
}

export type SampleBankOptions = {
  readonly id: string
  /** Prefix of every url (where the manifest's folder is served: `/sfx/`). Default ''. */
  readonly baseUrl?: string
  /** Numbers per sound id, or one function; a sound with neither is left out (it has no bus). */
  readonly sounds?: Readonly<Record<string, SampleDefaults>>
  readonly defaults?: (sound: { readonly id: string; readonly category: string }) => SampleDefaults | undefined
}

/** The strength suffixes of a sound id (`kick_hit_heavy`): takes of the tiers of `kick_hit`, from these intensities. */
export const SFX_TIERS: Readonly<Record<string, number>> = { light: 0, medium: 0.34, heavy: 0.67 }

/** Splits a file name (no extension) into its sound id, layer and take number. */
export function parseSfxName(name: string): { readonly id: string; readonly layer: SfxLayer; readonly take: number } {
  const match = /^(.*?)(?:_(close|far|tail_in|tail_out))?(?:_(\d+))?$/.exec(name)
  const id = match?.[1] || name
  const layer = (match?.[2] as SfxLayer | undefined) ?? 'close'
  const take = match?.[3] ? Number(match[3]) : 1
  return { id, layer, take }
}

/** The base id and tier of a sound id: `kick_hit_heavy` → `kick_hit`, `heavy`. */
export function splitTier(id: string): { readonly base: string; readonly tier?: string } {
  const match = /^(.*)_(light|medium|heavy)$/.exec(id)
  return match ? { base: match[1] as string, tier: match[2] as string } : { base: id }
}

/** What `sampleBankFromManifest` reads of a manifest: the sounds, their layers and where each file came from (any licence string). */
export type SfxManifestLike = {
  readonly sounds: readonly {
    readonly id: string
    readonly category: string
    readonly layers: Partial<Readonly<Record<SfxLayer, readonly { readonly file: string; readonly source: string; readonly author: string; readonly license: string }[]>>>
  }[]
}

const refsOf = (entries: readonly { readonly file: string }[] | undefined, baseUrl: string): SampleRef[] => (entries ?? []).map((entry) => ({ url: `${baseUrl}${entry.file}` }))

/** A bank of sample sounds from a manifest. */
export function sampleBankFromManifest(manifest: SfxManifestLike, options: SampleBankOptions): SoundBank {
  const baseUrl = options.baseUrl ?? ''
  const samples: SampleSound[] = []
  // `<id>_light`, `_medium`, `_heavy` are the tiers of `<id>`, gathered under it
  type Sound = SfxManifestLike['sounds'][number]
  const tiersOf = new Map<string, Sound[]>()
  for (const sound of manifest.sounds) {
    const { base, tier } = splitTier(sound.id)
    if (tier) tiersOf.set(base, [...(tiersOf.get(base) ?? []), sound])
  }
  const bases = new Map<string, Sound>()
  for (const sound of manifest.sounds) {
    if (!splitTier(sound.id).tier) bases.set(sound.id, sound)
  }
  for (const [base, tiers] of tiersOf) {
    if (!bases.has(base)) bases.set(base, { id: base, category: tiers[0]?.category ?? '', layers: { close: tiers[0]?.layers.close ?? [] } })
  }
  for (const sound of bases.values()) {
    const numbers = options.sounds?.[sound.id] ?? options.defaults?.(sound)
    const close = refsOf(sound.layers.close, baseUrl)
    if (!numbers || close.length === 0) continue
    const tiers = (tiersOf.get(sound.id) ?? [])
      .map((tier) => {
        const name = splitTier(tier.id).tier as string
        const tierFar = refsOf(tier.layers.far, baseUrl)
        return { name, from: SFX_TIERS[name] ?? 0, close: refsOf(tier.layers.close, baseUrl), ...(tierFar.length > 0 ? { far: tierFar } : {}) }
      })
      .sort((a, b) => a.from - b.from)
    const far = refsOf(sound.layers.far, baseUrl)
    const indoor = refsOf(sound.layers.tail_in, baseUrl)
    const outdoor = refsOf(sound.layers.tail_out, baseUrl)
    const files = [sound, ...(tiersOf.get(sound.id) ?? [])].flatMap((entry) => Object.values(entry.layers).flatMap((entries) => entries ?? []))
    samples.push({
      id: sound.id,
      bus: numbers.bus,
      close,
      ...(far.length > 0 ? { far } : {}),
      ...(tiers.length > 0 ? { tiers } : {}),
      ...(numbers.crossover ? { crossover: numbers.crossover } : {}),
      ...(indoor.length > 0 || outdoor.length > 0
        ? { tail: { ...(indoor.length > 0 ? { indoor } : {}), ...(outdoor.length > 0 ? { outdoor } : {}), ...(numbers.tailGain === undefined ? {} : { gain: numbers.tailGain }) } }
        : {}),
      ...(numbers.pitch === undefined ? {} : { pitch: numbers.pitch }),
      ...(numbers.gain === undefined ? {} : { gain: numbers.gain }),
      ...(numbers.falloff ? { falloff: numbers.falloff } : {}),
      ...(numbers.cutoffK === undefined ? {} : { cutoffK: numbers.cutoffK }),
      ...(numbers.group ? { group: numbers.group } : {}),
      ...(numbers.priority === undefined ? {} : { priority: numbers.priority }),
      ...(numbers.choke ? { choke: numbers.choke } : {}),
      ...(numbers.fallback ? { fallback: numbers.fallback } : {}),
      sources: files.map((file) => `${file.file}: ${file.source} ${file.author} ${file.license}`),
    })
  }
  return { id: options.id, samples }
}
