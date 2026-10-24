import type { ZoneDef } from '@adatechnology/game-floorplan'

/**
 * Typical Brazilian commercial and industrial zones, modelled on common municipal codes and
 * simplified (real codes differ per city). Names are in the locale files under `zones`.
 */
export const zones: ZoneDef[] = [
  // ZC: commercial / central, tall and dense, no front setback, waived permeability
  { id: 'zc', allowedUses: ['commercial', 'institutional', 'mixed', 'residential_multi'], maxFloors: 24, maxHeight: 80, setbacks: { front: 0, side: 0, back: 3 }, maxCoverage: 0.85, maxFar: 6.0, minLot: 150, minFrontage: 6, permeableMin: 0 },
  // ZI: industrial, large lots and generous setbacks
  { id: 'zi', allowedUses: ['industrial', 'commercial'], maxFloors: 4, maxHeight: 20, setbacks: { front: 10, side: 5, back: 5 }, maxCoverage: 0.6, maxFar: 1.2, minLot: 1000, minFrontage: 20, permeableMin: 0.15 },
  // ZA: agricultural, farms on large lots with deep setbacks
  { id: 'za', allowedUses: ['agricultural'], maxFloors: 2, maxHeight: 12, setbacks: { front: 5, side: 3, back: 3 }, maxCoverage: 0.1, maxFar: 0.15, minLot: 2000, minFrontage: 30, permeableMin: 0.8 },
]
