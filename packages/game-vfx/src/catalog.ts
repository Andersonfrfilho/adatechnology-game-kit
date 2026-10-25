import aliasData from './data/explosion-aliases.json'
import explosionData from './data/explosions.json'
import type { ExplosionDef } from './types'

/**
 * The 16 profiles of the Explosion Lab (`PROF`, L795-812) keyed by the id of the explosive in `game-weapons` (`m67`, `molotov`, `pipe_bomb`,
 * `propane_p13`, `dynamite`, `c4`, `claymore`, `flashbang`, `m79_40mm`, `m72_66mm`, `at4_84mm`, `pg7v`, `fuel_barrel`, `car_fuel_tank`, `fuel_pump`,
 * `fuel_station_tank`), plus `generic` (the M67 for a part with no explosive id: scale it by `injury / 15`). Each one lists the Lab lines it comes from.
 */
export const EXPLOSIONS = explosionData as unknown as Readonly<Record<string, ExplosionDef>>

/** Explosives with no profile of their own: the Carl Gustaf blasts like the AT4, the VOG-25 like the M79. */
export const EXPLOSION_ALIASES: Readonly<Record<string, string>> = aliasData

/** A copy of a catalogue with some profiles changed (a partial replaces the fields it names) or removed (`null`); a game adds, tunes or drops effects without touching the core. */
export function patchExplosions(base: Readonly<Record<string, ExplosionDef>>, changes: Readonly<Record<string, Partial<ExplosionDef> | ExplosionDef | null>>): Record<string, ExplosionDef> {
  const result: Record<string, ExplosionDef> = { ...base }
  for (const [id, change] of Object.entries(changes)) {
    if (change === null) delete result[id]
    else result[id] = { ...(base[id] ?? {}), ...change, id } as ExplosionDef
  }
  return result
}
