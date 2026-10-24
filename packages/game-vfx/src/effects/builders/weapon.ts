import type { WorkshopEngine } from '../../workshop/engine'
import type { Vec3Tuple } from '../../workshop/types'
import { normalized, plus, plusScaled, scaledBy } from '../vector-math'

const FULL_TURN_DRAWN = 6.283

export const WEAPON_NAMES = ['glock', 'ak', 'r870', 'barrett'] as const
export type WeaponName = (typeof WEAPON_NAMES)[number]

/** Per weapon: flash size, petals, light, smoke puffs and length of the petals (W417). */
const WEAPON_SIZES: Readonly<Record<WeaponName, readonly [number, number, number, number, number]>> = {
  glock: [0.35, 4, 3, 3, 0.25],
  ak: [0.6, 5, 5, 5, 0.45],
  r870: [0.95, 8, 7, 10, 0.6],
  barrett: [1.45, 6, 11, 14, 0.5],
}

function barrettBrake(engine: WorkshopEngine, tip: Vec3Tuple, direction: Vec3Tuple): void {
  const side = normalized([direction[2], 0, -direction[0]])
  for (const sign of [-1, 1]) {
    const sideways = scaledBy(side, sign)
    for (let index = 0; index < engine.scaled(8); index++) {
      engine.spawn('add', { p: plusScaled(tip, side, sign * 0.06), dir: sideways, cone: 0.25, sp: [2, 5], drag: 6, life: 0.09, size: [0.25, 0.4], c0: 0xffc070, c1: 0xff6010, fi: 0 })
    }
    engine.burst('normal', 10, { p: tip, dir: normalized(plus(sideways, 0, 0.2, 0)), cone: 0.3, sp: [1.5, 3], drag: 2, life: [1.2, 2], size: [0.15, 0.25], grow: 5, c0: 0x8a8a86, a: 0.3, g: -0.2 })
  }
  for (let index = 0; index < engine.scaled(26); index++) {
    const angle = engine.random.next() * FULL_TURN_DRAWN
    engine.spawn('normal', { p: [tip[0] + Math.cos(angle) * 0.3, 0.05, tip[2] + Math.sin(angle) * 0.3], dir: [Math.cos(angle), 0.15, Math.sin(angle)], cone: 0.2, sp: [1.5, 3.5], drag: 2, life: [1, 1.8], size: [0.2, 0.35], grow: 3, c0: 0x5a554b, a: 0.4 })
  }
}

/** `muzzle` (W417-429): flash core, petals along the barrel and smoke, scaled by weapon; the Barrett also vents sideways and lifts the dust. */
export function muzzle(engine: WorkshopEngine, weapon: WeaponName, tip: Vec3Tuple, direction: Vec3Tuple): void {
  const [flashSize, petals, light, smoke, length] = WEAPON_SIZES[weapon]
  engine.burst('add', 3, { p: tip, size: [flashSize * 0.45, flashSize * 0.75], life: 0.055, c0: 0xfff4d0, fi: 0 })
  for (let index = 0; index < engine.scaled(petals * 2); index++) {
    engine.spawn('add', { p: plusScaled(tip, direction, engine.random.between(0, length)), r: 0.03, size: [flashSize * 0.22, flashSize * 0.38], life: 0.06, c0: 0xffb050, c1: 0xff7020, fi: 0 })
  }
  engine.burst('streak', petals, { p: tip, dir: direction, cone: 0.55, sp: [6, 12], life: 0.05, len: 0.025, c0: 0xffd080 })
  if (weapon === 'barrett') barrettBrake(engine, tip, direction)
  engine.burst('normal', smoke, { p: tip, dir: direction, cone: 0.45, sp: [0.4, 1.6], drag: 2.2, life: [1, 2.2], size: [0.06, 0.14], grow: 6, c0: 0x8a8a86, c1: 0x55565a, a: 0.22, g: -0.25, fi: 0.05 })
  engine.flash([tip, 0xffc070, light, 0.05, 10])
}

export type CasingType = 'shell' | '50' | ''

/** `casing` (W430): a brass case, or a red shell, thrown out of the port. */
export function casing(engine: WorkshopEngine, port: Vec3Tuple, type: CasingType): void {
  const size = type === 'shell' ? ([0.03, 0.03, 0.07] as const) : type === '50' ? ([0.024, 0.024, 0.13] as const) : ([0.014, 0.014, 0.05] as const)
  engine.debrisPiece({ p: port, dir: normalized([0.8, 0.6, 0.2]), cone: 0.3, sp: [1.6, 2.6], size, c: type === 'shell' ? 0xb5281e : 0xc9a24a, spin: 20, bounce: 0.45, life: 20 })
}
