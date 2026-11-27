import { fleetGroupOf } from './proving'

/** Hulls a vehicle of each fleet group may have (design `veiculos.md` 10.3, K7). */
const HULL_CEILING: Readonly<Record<string, number>> = { motorcycles: 64, cars: 256, suvs: 256, pickups: 256, vans: 300, heavy: 550, agricultural: 150, military: 500, air: 500, water: 450 }

/** The hull ceiling of a fleet vehicle by its group; undefined for an id of no group. */
export const fleetHullCeilingOf = (id: string): number | undefined => HULL_CEILING[fleetGroupOf(id) ?? '']
