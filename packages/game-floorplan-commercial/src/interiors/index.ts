import type { FindsHint, InteriorModule } from './types'
import { drugstore } from './drugstore'
import { emergencyRoom } from './emergency-room'
import { gunShop } from './gun-shop'
import { policeStation } from './police-station'
import { school } from './school'
import { supermarket } from './supermarket'

/** Buildings of the interior pass, in registration order. */
export const interiorModules: readonly InteriorModule[] = [supermarket, drugstore, gunShop, policeStation, emergencyRoom, school]

/** Library of the rooms with no fixtures of their own (a corridor, a hall). */
export const sharedInteriorLibraries = { no_fixtures: () => [] }

export const interiorTemplateIds = interiorModules.map((module) => module.template.id)

/** What each building can hold (from the pins of the team's gallery scenes), keyed by template id. */
export const interiorFindsHints: Readonly<Record<string, readonly FindsHint[]>> = Object.fromEntries(interiorModules.map((module) => [module.template.id, module.hints]))

export type { FindsHint, InteriorModule }
