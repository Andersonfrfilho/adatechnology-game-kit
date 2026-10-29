import { add, and, DELTA, gt, lt, mod, mul, rnd, TIME } from '../dsl'
import { after, burst, cue, lens, repeat, screen, when } from '../steps'
import type { EffectDef, EffectStep } from '../types'

const FRESH_BLOOD = 0x8a0a0a
const BEAT_RATE = 1.9

/** A blow from one side (`swing`, W1178): a red edge on that side, a shake and splashes on the lens, 0.18 s after the swing starts. */
const blow = (side: 0 | 1): EffectStep[] => [
  cue('zombie_swing', { index: -1, side }),
  after(
    add(TIME, 0.18),
    screen({ set: side === 0 ? { dirL: 1 } : { dirR: 1 }, add: { shake: 0.3 } }),
    repeat(4, lens(side === 0 ? rnd(0.05, 0.3) : rnd(0.7, 0.95), rnd(0.3, 0.8), rnd(0.02, 0.05), '110,8,8', 0.8)),
    burst('normal', 12, { p: [0, 1.4, 0.9], dir: [0, 0.2, 1], cone: 0.6, sp: [1, 2], life: 1, size: [0.03, 0.05], c0: FRESH_BLOOD, g: 9.8, fi: 0, gnd: 3, ds: [0.05, 0.1] }),
  ),
]

/** W1169-1185 (`dano`): two blows, from the left and from the right, then the bite: a red flash, the colour drains, the heartbeat pulses and big blood runs down the lens. */
export const DAMAGE_AND_BITE: EffectDef = {
  id: 'damage_and_bite',
  pageId: 'dano',
  team: 'screen',
  budget: {},
  loop: 5.6,
  view: { eye: [0, 1.6, 1.7], target: [0, 1.5, 0] },
  timeline: [
    after(0.3, ...blow(0)),
    after(1.6, ...blow(1)),
    after(3, cue('zombie_lunge', { z: 0.45 })),
    after(
      3.15,
      screen({ set: { red: 1, desat: 0.9 }, add: { shake: 0.6 } }),
      cue('bite', { infection: 1 }),
      repeat(7, lens(rnd(0.2, 0.8), rnd(0.2, 0.7), rnd(0.04, 0.1), '100,6,6', 1)),
    ),
  ],
  tick: [
    when(and(gt(TIME, 3.2), lt(TIME, 5.4)), [when(lt(mod(mul(TIME, BEAT_RATE), 1), mul(DELTA, BEAT_RATE)), [screen({ set: { beat: 1 } })])]),
  ],
}
