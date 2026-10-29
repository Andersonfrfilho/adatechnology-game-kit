import { rnd, scaled, query, vadd } from '../dsl'
import { behavior, call, cue, debris, repeat } from '../steps'
import type { EffectStep } from '../types'
import { carPoint } from './car'

const UP = [0, 1, 0] as const

/** The velocity the page gives a door: the car's own space pushed outward by `s * 4`, minus the centre, with the height set to 3 (W1124). */
const doorVelocity = (side: number): readonly [number, number, number] => {
  const out = carPoint(side * 4, 3, 0.3)
  const centre = carPoint(0, 0, 0.3)
  return [out[0] - centre[0], 3, out[2] - centre[2]]
}

/** `vehicleBoom` (W1118-1128): the blast at the car, the car jumping, glass in the air, then the bonnet, both doors and a wheel flying off. */
export const VEHICLE_BOOM: readonly EffectStep[] = [
  call('explode', vadd(query('car', 'position'), [0, 0.6, 0]), 1.8, 0x2a1a14),
  cue('car_burnt'),
  behavior('car', 'launch', { rise: 4.5, spin: 0.9 }),
  repeat(scaled(30), debris({ p: vadd(query('car', 'position'), [0, 1.3, 0]), dir: UP, cone: 1.3, sp: [2, 6], size: [0.06, 0.006, 0.06], c: 0xa8c8d8, life: 20 })),
  debris({ p: carPoint(0, 1, 1.4), v: [rnd(-1, 1), 9, rnd(-1, 1)], sp: 0, size: [1.6, 0.06, 1.2], c: 0x3a1d18, spin: 6, life: 20, bounce: 0.2 }),
  ...[-1, 1].map((side) => debris({ p: carPoint(side * 0.95, 0.7, 0.3), v: doorVelocity(side), sp: 0, size: [0.06, 0.7, 1.1], c: 0x3a1d18, spin: 5, life: 20, bounce: 0.2 })),
  debris({ p: carPoint(0.95, 0.38, 1.35), v: [3, 4, 2], sp: 0, size: [0.3, 0.76, 0.76], c: 0x111111, spin: 8, life: 20, bounce: 0.4 }),
]
