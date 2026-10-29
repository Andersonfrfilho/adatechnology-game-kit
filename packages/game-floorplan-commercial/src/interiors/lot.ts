import type { LotConfig } from '@adatechnology/game-floorplan'

type ShopLotOptions = {
  readonly backyard?: number
  /** Position of the cargo gate along the back (u); none when omitted. */
  readonly cargoU?: number
  readonly marginLeft?: number
  readonly marginRight?: number
  readonly extraZones?: LotConfig['extraZones']
  readonly doorTarget: { a: string; side: string }
  readonly libraries?: Record<string, string>
  /** Open yard between the street and the facade (the front garden zone, with the library named in `libraries.garden`). */
  readonly frontSetback?: number
  /** Pedestrian gate in the front fence (needs `frontSetback`). */
  readonly pedestrian?: { u: number }
  /** Vehicle gate in the front fence. */
  readonly garage?: { u: number; width: number }
}

const CARGO_GATE_WIDTH = 3.0
const DEFAULT_BACKYARD_DEPTH = 4.5

/** Lot of an interior building: on the street line with no garden by default, a cargo gate at the back when `cargoU` is given. */
export function buildingLot(options: ShopLotOptions): LotConfig {
  return {
    frontSetback: options.frontSetback ?? 0,
    marginLeft: options.marginLeft ?? 0,
    marginRight: options.marginRight ?? 0,
    backyardDepth: options.backyard ?? DEFAULT_BACKYARD_DEPTH,
    ...(options.cargoU === undefined ? {} : { cargo: { u: options.cargoU, width: CARGO_GATE_WIDTH } }),
    ...(options.extraZones ? { extraZones: options.extraZones } : {}),
    ...(options.garage ? { garage: options.garage } : {}),
    ...(options.pedestrian ? { pedestrian: options.pedestrian } : {}),
    doorTarget: options.doorTarget,
    libraries: { backyard: 'backyard_service', ...options.libraries },
  }
}
