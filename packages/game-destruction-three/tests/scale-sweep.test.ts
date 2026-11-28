import { describe, expect, it } from 'vitest'

import { INTEGRATORS, SCALES, STEP, fall, slide, tip } from './scale-scenarios'
import type { Integrator } from './scale-scenarios'

/**
 * The same motion at 0.1x, 1x, 3x and 10x the size, under the same gravity: with every length times s, a body that obeys only gravity, friction and its own shape takes
 * √s times as long, moves √s times as fast, goes s times as far and turns 1/√s times as fast (analysis of dimensions: g is the only constant with a unit of time).
 * Each reading is divided by its power of s and compared with the same reading at 1x. A rule written for one size (a speed, a turn or a time in absolute units)
 * breaks the relation, and this is where it shows, whatever the size the rule was tuned at.
 */

/** How a reading grows with the size s: the power of s it is divided by before it is compared. */
const POWER = { time: 0.5, speed: 0.5, distance: 1, spin: -0.5 } as const
type Kind = keyof typeof POWER

/**
 * What the comparison allows besides the steps: 2 %, the engine's contact (its slop and push-out per step are fixed lengths, `KIT_WORLD`) on a motion that otherwise obeys.
 * The steps: every reading here is off by at most two steps of what it measures over the time T the motion lasts (a time by the step it lands in, a speed or a spin by
 * the change it has over the step it is read in), so each size contributes 2 · STEP / T. T is √s times its 1x value, so the band is widest at 0.1x, where a fall of
 * 10 cm lasts 17 steps.
 */
const ENGINE_SHARE = 0.02
const tolerance = (seconds: number, secondsAt1x: number): number => ENGINE_SHARE + 2 * STEP * (1 / seconds + 1 / secondsAt1x)

/** One reading of a motion: its value and the time the motion took to it (s), the T of `tolerance`. */
type Reading = { readonly kind: Kind; readonly value: number; readonly seconds: number }
type Readings = Readonly<Record<string, Reading>>

const MOTIONS: Readonly<Record<string, (integrator: Integrator, scale: number) => Readings>> = {
  fall: (integrator, scale) => {
    const motion = fall(integrator, scale)
    return {
      'time to fall 90% of the drop': { kind: 'time', value: motion.read, seconds: motion.read },
      'speed then': { kind: 'speed', value: motion.speed, seconds: motion.read },
      'time to come to rest on the floor': { kind: 'time', value: motion.settled, seconds: motion.settled },
    }
  },
  slide: (integrator, scale) => {
    const motion = slide(integrator, scale)
    return {
      'distance slid': { kind: 'distance', value: motion.distance, seconds: motion.stopped },
      'time to stop': { kind: 'time', value: motion.stopped, seconds: motion.stopped },
    }
  },
  tip: (integrator, scale) => {
    const motion = tip(integrator, scale)
    return {
      'time to tip to 85 degrees': { kind: 'time', value: motion.read, seconds: motion.read },
      'spin at 85 degrees': { kind: 'spin', value: motion.spin, seconds: motion.read },
    }
  },
}

/**
 * What does not scale today, by `<integrator> <motion>: <reading> at <s>x`, with the line that makes it so. A debt that only goes down: an entry that scales once its
 * cause is fixed fails here until it is taken out, and a new one fails until its cause is fixed (not added: see `docs/analise-arquitetura-e-validacao-2026-11.md` 10.4).
 */
const KNOWN: Readonly<Record<string, string>> = {
  // no weight turns a light fragment: one on its end is laid flat by `settle`, a turn of 7 times its lean a second (fragments.ts:822, :944), at any length
  'light tip: time to tip to 85 degrees at 0.1x': 'fragments.ts:944 slerp(dt * 7): the lying-down rate is a fixed 7/s, not √(g/L)',
  'light tip: time to tip to 85 degrees at 3x': 'fragments.ts:944 slerp(dt * 7): the lying-down rate is a fixed 7/s, not √(g/L)',
  'light tip: time to tip to 85 degrees at 10x': 'fragments.ts:944 slerp(dt * 7): the lying-down rate is a fixed 7/s, not √(g/L)',
  'light tip: spin at 85 degrees at 0.1x': 'fragments.ts:944 slerp(dt * 7): the lying-down rate is a fixed 7/s, not √(g/L)',
  'light tip: spin at 85 degrees at 3x': 'fragments.ts:944 slerp(dt * 7): the lying-down rate is a fixed 7/s, not √(g/L)',
  'light tip: spin at 85 degrees at 10x': 'fragments.ts:944 slerp(dt * 7): the lying-down rate is a fixed 7/s, not √(g/L)',
  // after the landing: a bounce only over 0.6 m/s, a tumble of up to 1 rad/s a corner hit gives (rad/s for anything up to 20 cm), the lying flat at 7/s; none of the three alone
  // makes the rest scale (measured with each made size-aware in turn)
  'light fall: time to come to rest on the floor at 0.1x': 'fragments.ts:793 bounce over 0.6 m/s, :799 tumble in rad/s, :944 slerp(dt * 7)',
  'light fall: time to come to rest on the floor at 3x': 'fragments.ts:793 bounce over 0.6 m/s, :799 tumble in rad/s, :944 slerp(dt * 7)',
  'light fall: time to come to rest on the floor at 10x': 'fragments.ts:793 bounce over 0.6 m/s, :799 tumble in rad/s, :944 slerp(dt * 7)',
}

/** The readings of `motion` that do not scale: each at each size, against the same at 1x, with what was measured. */
function unscaled(integrator: Integrator, motion: string): Map<string, string> {
  const run = MOTIONS[motion] as (integrator: Integrator, scale: number) => Readings
  const base = run(integrator, 1)
  const found = new Map<string, string>()
  for (const scale of SCALES.filter((s) => s !== 1)) {
    const readings = run(integrator, scale)
    for (const [name, reading] of Object.entries(readings)) {
      const at1x = base[name] as Reading
      const ratio = reading.value / scale ** POWER[reading.kind] / at1x.value
      const allowed = tolerance(reading.seconds, at1x.seconds)
      if (Math.abs(ratio - 1) > allowed) found.set(`${integrator} ${motion}: ${name} at ${scale}x`, `${(100 * (ratio - 1)).toFixed(1)}% off the 1x one scaled (allowed ${(100 * allowed).toFixed(1)}%)`)
    }
  }
  return found
}

describe('the integrators of loose debris obey the scaling of gravity: √s in time and speed, s in distance, 1/√s in spin', () => {
  for (const integrator of INTEGRATORS) {
    for (const motion of Object.keys(MOTIONS)) {
      it(`${integrator === 'light' ? 'the light physics of the fragments' : 'the rigid bodies'}, ${motion}: every reading at 0.1x, 3x and 10x as at 1x (but the debt in KNOWN)`, () => {
        const found = unscaled(integrator, motion)
        const known = Object.keys(KNOWN).filter((key) => key.startsWith(`${integrator} ${motion}:`))
        expect([...found.keys()].sort(), [...found].map(([key, why]) => `${key}: ${why}`).join('\n')).toEqual(known.sort())
      }, 120000)
    }
  }
})
