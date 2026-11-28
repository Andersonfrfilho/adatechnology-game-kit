import { KIT_WORLD } from '@adatechnology/game-physics'
import { describe, expect, it } from 'vitest'

import { FALL_HEIGHT, FALL_READ, FRICTION, GRAVITY, INTEGRATORS, ROD_LEAN_DEGREES, ROD_LENGTH, ROD_THICKNESS, SCALES, SLIDE_SIZE, SLIDE_SPEED, STEP, STILL_SHARE, TIP_READ, fall, slide, tip } from './scale-scenarios'
import type { Integrator } from './scale-scenarios'

/**
 * The kit's two integrators of loose debris against motions with a closed-form answer, at four sizes: a free fall (½ g t²), a slide to a stop under Coulomb friction
 * (v² / 2 μ g, in v / μ g) and a rod tipping over its foot from a lean (the spin its drop of height buys about that foot). Each tolerance is what the step of the integrator
 * explains, said where it is set; nothing is a fixed number of rad/s or m/s.
 */

/** Where the readings of each case stand against its answer: a name of the case and what is wrong, or nothing. */
type Check = (integrator: Integrator, scale: number) => ReadonlyArray<readonly [string, string | undefined]>

const off = (measured: number, expected: number, allowed: number): string | undefined =>
  Math.abs(measured - expected) <= allowed ? undefined : `measured ${measured.toPrecision(4)}, closed form ${expected.toPrecision(4)}, allowed ±${allowed.toPrecision(2)}`

const freeFall: Check = (integrator, scale) => {
  const height = FALL_HEIGHT * scale
  const motion = fall(integrator, scale)
  // the step's integration (symplectic Euler, both) is ahead of ½ g t² by ½ g STEP t: twice that is allowed at each step, before the floor
  let worst: string | undefined
  for (let i = 1; (i - 1) * STEP < motion.read; i++) worst ??= off(motion.drops[i] as number, (GRAVITY * (i * STEP) ** 2) / 2, GRAVITY * STEP * i * STEP + 1e-9)
  const reach = FALL_READ * height
  return [
    ['drops ½ g t² at every step', worst],
    // the reading is interpolated between two steps; the integration leads by half of one
    [`falls ${100 * FALL_READ}% of the drop in √(2 h / g)`, off(motion.read, Math.sqrt((2 * reach) / GRAVITY), STEP)],
    // the speed is read as a step's drop over the step: it is the speed somewhere in that step, which differs from the one at the crossing by at most g STEP
    ['comes down at √(2 g h) then', off(motion.speed, Math.sqrt(2 * GRAVITY * reach), GRAVITY * STEP)],
  ]
}

const coulombSlide: Check = (integrator, scale) => {
  const speed = SLIDE_SPEED * Math.sqrt(scale)
  const mu = FRICTION[integrator]
  const motion = slide(integrator, scale)
  return [
    // each step it moves at the speed of the step's start or end: the sum differs from the integral by at most one step at the start speed
    ['slides v² / (2 μ g)', off(motion.distance, (speed * speed) / (2 * mu * GRAVITY), speed * STEP)],
    // it stops within the step the speed runs out in; the engine holds it still once it slides slower than its slip speed (`KIT_WORLD.slipSpeed`), and the reading counts
    // it still once a step moves it less than `STILL_SHARE` of its size: each that much speed earlier
    ['stops after v / (μ g)', off(motion.stopped, speed / (mu * GRAVITY), STEP + ((KIT_WORLD.slipSpeed ?? 0) + (STILL_SHARE * SLIDE_SIZE[0] * scale) / STEP) / (mu * GRAVITY))],
  ]
}

/** The rod's centre height over its foot at tilt `tilt` (rad from upright), for a rod `length` long and `thickness` thick standing on a bottom edge. */
const rodHeight = (length: number, thickness: number, tilt: number): number => (length / 2) * Math.cos(tilt) + (thickness / 2) * Math.sin(tilt)

/**
 * A rod turning about its foot from rest at `lean`: its spin at `tilt` from the height its centre lost (m g Δh = ½ I ω², I about the foot's edge (L² + t²) m / 3), and the time
 * to it, the integral of dθ / ω (a closed-form integrand, summed in 2000 slices of √(θ - lean)).
 */
function rodAnswer(length: number, thickness: number): { readonly spin: number; readonly seconds: number } {
  const lean = (ROD_LEAN_DEGREES * Math.PI) / 180
  const inertia = (length * length + thickness * thickness) / 3
  const spinAt = (tilt: number): number => Math.sqrt((2 * GRAVITY * (rodHeight(length, thickness, lean) - rodHeight(length, thickness, tilt))) / inertia)
  // with θ = lean + u², dθ / ω = 2 u du / ω: the integrand stays finite where the rod starts from rest
  const slices = 2000
  const reach = Math.sqrt(TIP_READ - lean)
  let seconds = 0
  for (let i = 0; i < slices; i++) {
    const u = (reach * (i + 0.5)) / slices
    seconds += (2 * u * (reach / slices)) / spinAt(lean + u * u)
  }
  return { spin: spinAt(TIP_READ), seconds }
}

/**
 * What the foot does is between two limits, held by friction (the answer above) and sliding freely; at 85 degrees the two spins differ by 0.7 %, and the slip the floor's
 * friction allows takes energy (measured: 2 % of it on the engine). So 5 % is allowed for the foot, and on top of it what the spin changes in one step (its angular
 * acceleration there, g (L sinθ / 2 - t cosθ / 2) / I, over a step): the reading is a step's turn over the step.
 */
const FOOT_SHARE = 0.05

const rodTip: Check = (integrator, scale) => {
  const length = ROD_LENGTH * scale
  const thickness = ROD_THICKNESS * scale
  const answer = rodAnswer(length, thickness)
  const motion = tip(integrator, scale)
  const inertia = (length * length + thickness * thickness) / 3
  const growth = (GRAVITY * ((length / 2) * Math.sin(TIP_READ) - (thickness / 2) * Math.cos(TIP_READ))) / inertia
  return [
    ['spins at 85 degrees as the drop of its centre gives', off(motion.spin, answer.spin, FOOT_SHARE * answer.spin + growth * STEP)],
    ['takes the time to 85 degrees the spin gives', off(motion.read, answer.seconds, FOOT_SHARE * answer.seconds + STEP)],
  ]
}

const CASES: Readonly<Record<string, Check>> = { 'free fall': freeFall, 'Coulomb slide': coulombSlide, 'rod tipping over its foot': rodTip }

/**
 * What does not match its closed form today, by `<integrator> <case>: <reading> at <s>x`, with the line that makes it so. A debt that only goes down, as in `scale-sweep`.
 */
const KNOWN: Readonly<Record<string, string>> = Object.fromEntries(
  SCALES.flatMap((scale) => [
    [`light rod tipping over its foot: spins at 85 degrees as the drop of its centre gives at ${scale}x`, 'fragments.ts:822, :944: no weight turns a light fragment; settle lays it flat at a fixed 7/s'],
    [`light rod tipping over its foot: takes the time to 85 degrees the spin gives at ${scale}x`, 'fragments.ts:822, :944: no weight turns a light fragment; settle lays it flat at a fixed 7/s'],
  ]),
)

describe('the integrators of loose debris against closed-form motions, at 0.1x, 1x, 3x and 10x', () => {
  for (const integrator of INTEGRATORS) {
    for (const [name, check] of Object.entries(CASES)) {
      it(`${integrator === 'light' ? 'the light physics of the fragments' : 'the rigid bodies'}: ${name} (but the debt in KNOWN)`, () => {
        const wrong = SCALES.flatMap((scale) => check(integrator, scale).flatMap(([reading, why]) => (why ? [[`${integrator} ${name}: ${reading} at ${scale}x`, why] as const] : [])))
        const known = Object.keys(KNOWN).filter((key) => key.startsWith(`${integrator} ${name}:`))
        expect(wrong.map(([key]) => key).sort(), wrong.map(([key, why]) => `${key}: ${why}`).join('\n')).toEqual(known.sort())
      }, 120000)
    }
  }
})
