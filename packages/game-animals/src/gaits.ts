import gaitsData from './data/gaits.json'
import type { AnimalGaitName, GaitPhases } from './types'

/** The phase of each leg per gait, in radians, from the Bichos do Vale page (`GAIT`); the leg order is front right, front left, hind right, hind left. */
export const GAIT_PHASES = gaitsData as unknown as Readonly<Record<AnimalGaitName, GaitPhases>>
