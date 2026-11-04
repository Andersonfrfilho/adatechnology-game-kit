/**
 * A local sound pack: files a project keeps in its own folders (never in the SDK, never published) mapped to the SDK's sound ids by a JSON config.
 * `parseLocalSoundPack` checks the config at the boundary; `localPackSamples` turns it into sample sounds whose urls are relative to a base the
 * consuming project chooses (`audio/`, `https://cdn.example/sfx/`). Each entry says its licence; anything but `CC0` / `CC-BY` is shown as
 * unlicensed by the sound panel. `applyLocalSoundPack` (local-pack-loader.ts) loads them in idle time and swaps each id in only once its files decode.
 */
import { SFX_CATALOG, SFX_IMPACTS } from './catalog'
import { kitSampleDefaults } from './kit-samples'
import { SDK_LICENSES } from './manifest'
import { BUS_IDS } from './recipe'
import type { BusId, SampleSound } from './recipe'

export const LOCAL_PACK_LICENSES = ['CC0', 'CC-BY', 'unknown', 'proprietary'] as const
export type LocalPackLicense = (typeof LOCAL_PACK_LICENSES)[number]

/** Which sound an id plays when the SDK also has a recording for it: the pack's files (default) or the SDK's, the pack staying as the alternative. */
export const LOCAL_PACK_PREFERENCES = ['pack', 'sdk'] as const
export type LocalPackPreference = (typeof LOCAL_PACK_PREFERENCES)[number]

export type LocalSoundEntry = {
  /** Paths or urls of the takes, relative to the pack's base. */
  readonly files: readonly string[]
  readonly license: LocalPackLicense
  /** Default `pack`; `sdk` keeps the SDK recording when there is one (the pack's files are then not even fetched). */
  readonly prefer?: LocalPackPreference
  /** Bus of the sound (default the bus of its catalogue category). */
  readonly bus?: BusId
  readonly gain?: number
  /** 0–10: how well the files fit the id (a reviewer's note, shown by tools). */
  readonly score?: number
  readonly note?: string
}

export type LocalSoundPack = {
  readonly version: 1
  /** Prefix of every file (a folder served next to the page, or a url); the consumer can override it. */
  readonly baseUrl?: string
  /** SDK sound id → its files. */
  readonly sounds: Readonly<Record<string, LocalSoundEntry>>
}

export class LocalSoundPackError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`invalid local sound pack: ${problems.join('; ')}`)
    this.name = 'LocalSoundPackError'
    this.problems = problems
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isLicense = (value: unknown): value is LocalPackLicense => (LOCAL_PACK_LICENSES as readonly unknown[]).includes(value)
const isBus = (value: unknown): value is BusId => (BUS_IDS as readonly unknown[]).includes(value)

function entryProblems(id: string, entry: unknown): string[] {
  if (!isRecord(entry)) return [`${id}: not an object`]
  const problems: string[] = []
  const files = entry.files
  if (!Array.isArray(files) || files.length === 0 || !files.every((file) => typeof file === 'string' && file.length > 0)) problems.push(`${id}: files must be a non-empty list of paths`)
  if (!isLicense(entry.license)) problems.push(`${id}: license must be one of ${LOCAL_PACK_LICENSES.join(', ')}`)
  if (entry.prefer !== undefined && !(LOCAL_PACK_PREFERENCES as readonly unknown[]).includes(entry.prefer)) problems.push(`${id}: prefer must be pack or sdk`)
  if (entry.bus !== undefined && !isBus(entry.bus)) problems.push(`${id}: unknown bus ${String(entry.bus)}`)
  if (entry.gain !== undefined && (typeof entry.gain !== 'number' || entry.gain < 0)) problems.push(`${id}: gain must be a number ≥ 0`)
  if (entry.score !== undefined && (typeof entry.score !== 'number' || entry.score < 0 || entry.score > 10)) problems.push(`${id}: score must be 0–10`)
  return problems
}

/** Checks a parsed JSON config; every problem is reported at once. */
export function parseLocalSoundPack(value: unknown): LocalSoundPack {
  if (!isRecord(value)) throw new LocalSoundPackError(['the pack is not an object'])
  const problems: string[] = []
  if (value.version !== 1) problems.push('version must be 1')
  if (value.baseUrl !== undefined && typeof value.baseUrl !== 'string') problems.push('baseUrl must be a string')
  if (!isRecord(value.sounds)) problems.push('sounds must be an object of id → entry')
  else for (const [id, entry] of Object.entries(value.sounds)) problems.push(...entryProblems(id, entry))
  if (problems.length > 0) throw new LocalSoundPackError(problems)
  return value as LocalSoundPack
}

/** Whether the SDK may ship a file of this licence (public domain or attribution). */
export const isShippableLicense = (license: string | undefined): boolean => (SDK_LICENSES as readonly (string | undefined)[]).includes(license)

const CATALOG = new Map([...SFX_CATALOG, ...SFX_IMPACTS].map((entry) => [entry.id, entry]))

const busOf = (id: string, entry: LocalSoundEntry): BusId => {
  if (entry.bus) return entry.bus
  const category = CATALOG.get(id)?.category ?? ''
  return kitSampleDefaults({ id, category, layers: {} })?.bus ?? 'world'
}

export type LocalPackSampleOptions = {
  /** Overrides the pack's `baseUrl`. */
  readonly baseUrl?: string
}

/** The pack as sample sounds, one per id, with the synthesized sound of the catalogue as the fallback. */
export function localPackSamples(pack: LocalSoundPack, options: LocalPackSampleOptions = {}): SampleSound[] {
  const baseUrl = options.baseUrl ?? pack.baseUrl ?? ''
  return Object.entries(pack.sounds).map(([id, entry]) => {
    const current = CATALOG.get(id)?.current
    const isLoop = /_loop(_|$)/.test(id)
    return {
      id,
      bus: busOf(id, entry),
      close: entry.files.map((file) => ({ url: `${baseUrl}${file}` })),
      pitch: isLoop ? 0 : 0.04,
      ...(isLoop ? { loop: true } : {}),
      ...(entry.gain === undefined ? {} : { gain: entry.gain }),
      ...(current ? { fallback: current } : {}),
      license: entry.license,
      sources: entry.files.map((file) => `local: ${file} ${entry.license}`),
    }
  })
}
