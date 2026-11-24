import type { CityPlanInput } from '../../src'
import type { NetworkLot } from '../../src/networks'

/** A cut of a district like the reference one: a main street cut by a river, a cross street, the centre west and the periphery east. */
export const PLAN: CityPlanInput = {
  id: 'network_cut',
  scale: 'town',
  size: [445, 270],
  districts: [
    { id: 'centre', kind: 'mixed', rect: [-220, -120, -40, 120] },
    { id: 'periphery', kind: 'residential_popular', rect: [0, -135, 225, 135] },
  ],
  lines: [
    { id: 'main_street', kind: 'street', width: 10, points: [[-220, 0], [225, 0]] },
    { id: 'crossing_street', kind: 'street', width: 10, points: [[-100, -120], [-100, 120]] },
    { id: 'river', kind: 'river', width: 30, points: [[-20, -135], [-20, 135]] },
  ],
}

const row = (prefix: string, z0: number, z1: number, xs: readonly number[]): NetworkLot[] => xs.slice(1).map((x, index) => ({ id: `${prefix}_${index + 1}`, rect: [xs[index] as number, z0, x, z1] }))

export const LOTS: readonly NetworkLot[] = [
  ...row('north', -32.5, -7.5, [50, 62, 74, 86, 98, 110]),
  { id: 'north_6', rect: [126, -32.5, 138, -7.5] },
  ...row('south', 7.5, 32.5, [50, 62, 74, 86, 98, 110]),
  { id: 'centre_pharmacy', rect: [-150, -37.5, -124, -7.5] },
  { id: 'centre_market', rect: [-150, 7.5, -120, 37.5] },
  { id: 'centre_police', rect: [-90, 7.5, -60, 32.5] },
  { id: 'centre_church', rect: [-150, 70, -120, 100] },
]
