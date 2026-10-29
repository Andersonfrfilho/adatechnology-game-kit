import type { ZoneDef } from '@adatechnology/game-floorplan'

/**
 * Typical Brazilian urban zones for housing, modelled on common municipal codes and simplified
 * (real codes differ per city). Names are in the locale files under `zones`.
 */
export const zones: ZoneDef[] = [
  // ZR1: low-density residential, houses only
  { id: 'zr1', allowedUses: ['residential_single'], maxFloors: 2, maxHeight: 9, setbacks: { front: 5, side: 1.5, back: 3 }, maxCoverage: 0.5, maxFar: 1.0, minLot: 250, minFrontage: 10, permeableMin: 0.25 },
  // ZR-AP: high-end gated residential, large lots
  { id: 'zr_ap', allowedUses: ['residential_single'], maxFloors: 3, maxHeight: 12, setbacks: { front: 8, side: 3, back: 5 }, maxCoverage: 0.4, maxFar: 1.2, minLot: 600, minFrontage: 18, permeableMin: 0.4 },
  // ZR2: medium density, houses and small apartment buildings
  { id: 'zr2', allowedUses: ['residential_single', 'residential_multi'], maxFloors: 4, maxHeight: 14, setbacks: { front: 4, side: 1.5, back: 3 }, maxCoverage: 0.6, maxFar: 2.0, minLot: 180, minFrontage: 6, permeableMin: 0.2 },
  // ZR3 / ZM: mixed use, mid-rise
  { id: 'zr3_zm', allowedUses: ['residential_single', 'residential_multi', 'commercial', 'mixed'], maxFloors: 12, maxHeight: 40, setbacks: { front: 0, side: 0, back: 3 }, maxCoverage: 0.7, maxFar: 4.0, minLot: 125, minFrontage: 5, permeableMin: 0.15 },
  // ZT: towers, the central zone with the storeys and the height of a skyscraper (the typology of the office and residential towers)
  { id: 'zt', allowedUses: ['commercial', 'institutional', 'mixed', 'residential_multi'], maxFloors: 60, maxHeight: 240, setbacks: { front: 0, side: 0, back: 3 }, maxCoverage: 0.7, maxFar: 20, minLot: 1000, minFrontage: 30, permeableMin: 0 },
]
