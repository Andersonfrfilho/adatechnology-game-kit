/**
 * Armour levels of a vehicle, after NIJ 0108: the level says which rounds the glass and the steel stop, and how many hits they take
 * before they give. Every number is configurable: a game passes its own table in `VehicleDestructibleOptions.armourLevels`.
 */

export type ArmourLevelId = 'IIIA' | 'III'

export type ArmourLevel = {
  /** Energy in joules a round needs to go through the armoured glass. */
  readonly glassStops: number
  /** Joules of hits the armoured glass takes before it gives way. */
  readonly glassHp: number
  /** Share of a stopped round's energy the glass takes as damage (it cracks round the hit and holds). */
  readonly glassTakes: number
  /** How much harder the steel skin is than a plain car's. */
  readonly steel: number
}

/** IIIA: civilian armour, stops handguns up to .44 Magnum, a rifle goes through. III: armour against rifles up to 7.62x51 (cash in transit, military). */
export const ARMOUR_LEVELS: Readonly<Record<ArmourLevelId, ArmourLevel>> = {
  IIIA: { glassStops: 1700, glassHp: 6000, glassTakes: 0.25, steel: 8 },
  III: { glassStops: 3600, glassHp: 9000, glassTakes: 0.25, steel: 30 },
}

/** The level a vehicle has: the host's option, else its spec (`armor`), else III for the old `armored`/`bullet` flags, else none. */
export function armourLevelOf(meta: { armor?: string; armored?: boolean; bullet?: boolean }, option?: ArmourLevelId | null): ArmourLevelId | null {
  if (option !== undefined) return option
  if (meta.armor === 'IIIA' || meta.armor === 'III') return meta.armor
  return meta.armored || meta.bullet ? 'III' : null
}
