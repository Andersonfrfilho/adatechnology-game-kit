import levelsJson from './data/sample-levels.json'
import type { SampleDefaults } from './manifest'
import type { Falloff } from './recipe'

type LevelEntry = {
  readonly gainDb: number
  readonly pitch: number
  readonly cutoffK: number
  readonly priority: number
  readonly falloff: Falloff
  readonly choke: { readonly voices: number; readonly fade: number }
}

/** Level numbers of the sounds that must stay under a gunshot (`data/sample-levels.json`). */
export const SAMPLE_LEVELS = levelsJson as { readonly casing: LevelEntry; readonly magazine: LevelEntry }

const gainOf = (gainDb: number): number => 10 ** (gainDb / 20)

const defaultsOf = (entry: LevelEntry): SampleDefaults => ({
  bus: 'weapons',
  gain: gainOf(entry.gainDb),
  pitch: entry.pitch,
  falloff: entry.falloff,
  cutoffK: entry.cutoffK,
  priority: entry.priority,
  choke: entry.choke,
})

/** A spent case landing (`casing_drop_<floor>`). */
export const CASING_DEFAULTS: SampleDefaults = defaultsOf(SAMPLE_LEVELS.casing)
/** A magazine landing (`mag_drop_<floor>`). */
export const MAGAZINE_DROP_DEFAULTS: SampleDefaults = defaultsOf(SAMPLE_LEVELS.magazine)

/** The numbers of a sound that lands on the floor after a shot, or `undefined` for any other id. */
export const droppedPartDefaults = (id: string): SampleDefaults | undefined => (id.startsWith('casing_drop_') ? CASING_DEFAULTS : id.startsWith('mag_drop_') ? MAGAZINE_DROP_DEFAULTS : undefined)
