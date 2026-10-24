import ammoJson from './data/ammo.json'
import type { AmmoDef, AmmoKind, AmmoLoad, CaliberDef } from './types'

/**
 * The ammo table: per calibre and kind of round, the construction (core, jacket, tracer, incendiary) and how far it goes through steel, concrete,
 * brick and wood. The notes of `data/ammo.json` say where the numbers come from (one is published, the rest are estimates to be refined).
 */
export const AMMO = ammoJson.loads as unknown as AmmoDef[]

/** Id of a load in the table. */
export const ammoId = (caliber: string, kind: string): string => `${caliber}:${kind}`

/** Resolves a load of `caliber` (its own kind when `kind` is left out) against the table, or null when the table has none. */
export const resolveLoad = (caliber: CaliberDef, ammo: ReadonlyMap<string, AmmoDef>, kind?: AmmoKind): AmmoLoad | null => {
  const k = kind ?? caliber.kind
  if (k === undefined) return null
  const def = ammo.get(ammoId(caliber.id, k))
  if (!def) return null
  const grams = def.bulletGrams ?? caliber.bulletGrams
  const speed = def.muzzleSpeed ?? caliber.muzzleSpeed
  return { def, kind: k, grams, speed, energy: 0.5 * (grams / 1000) * speed * speed, penetration: def.penetration }
}
