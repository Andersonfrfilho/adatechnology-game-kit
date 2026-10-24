import { and, DELTA, gt, INDEX, le, lt, mod, mul, add, pick, rnd, sub, TIME, variable } from '../dsl'
import { after, append, call, cue, decal, repeat, set, spawn, when } from '../steps'
import type { EffectDef } from '../types'

const BLOOD = [0x8a0a0a, 0x5a0c10, 0x3a1c12, 0x1d1914]
/** Where the five bodies stand along the line of the shot (W786). */
const BODY_Z = [2.2, 1, -0.2, -1.4, -2.6]
const MUZZLE_Z = 8.5
const SPEED = 12
const WALL_Z = -4.4
const FORWARD = [0, 0, -1] as const
const bulletAt = [0, 1.45, variable('bulletZ')]

/** W776-785: a tracer of the Barrett crosses five bodies, each bleeding the colour of its age, then hits the wall. */
export const PENETRATION: EffectDef = {
  id: 'penetration',
  pageId: 'penetra',
  team: 'weapons',
  budget: { particles: 250 },
  loop: 4.2,
  view: { eye: [4.2, 2.2, 6.5], target: [0, 1.2, -0.5] },
  setup: [
    cue('zombie_visible', { index: -1, visible: false }),
    repeat(
      BODY_Z.length,
      set('bodyX', rnd(-0.05, 0.05)),
      set('bodyTurn', rnd(-0.3, 0.3)),
      append('bodiesX', variable('bodyX')),
      cue('zombie_place', { index: INDEX, x: variable('bodyX'), z: pick(BODY_Z, INDEX), turn: variable('bodyTurn') }),
    ),
  ],
  timeline: [set('bulletZ', MUZZLE_Z), set('bulletOn', true), call('muzzle', 'barrett', [0, 1.45, MUZZLE_Z], FORWARD)],
  tick: [
    when(variable('bulletOn'), [
      set('previousZ', variable('bulletZ')),
      set('bulletZ', sub(variable('bulletZ'), mul(SPEED, DELTA))),
      spawn('streak', { p: bulletAt, dir: FORWARD, cone: 0, sp: 12, life: 0.04, len: 0.07, c0: 0xffd090 }),
      spawn('add', { p: bulletAt, size: 0.09, life: 0.05, c0: 0xffc070, fi: 0 }),
      spawn('normal', { p: bulletAt, r: 0.02, sp: [0, 0.05], life: [1.2, 2], size: 0.05, grow: 3, c0: 0xc8ccd2, a: 0.12, fi: 0.1 }),
      repeat(
        BODY_Z.length,
        when(and(gt(variable('previousZ'), pick(BODY_Z, INDEX)), le(variable('bulletZ'), pick(BODY_Z, INDEX))), [
          call('blood_hit', [0, 1.45, sub(pick(BODY_Z, INDEX), 0.1)], [0, 0.05, -1], mod(INDEX, 4), 0.8),
          cue('zombie_fall', { index: INDEX, delay: 0.05, duration: 0.6 }),
          after(
            add(TIME, 0.6),
            decal(pick(variable('bodiesX'), INDEX), 0, sub(pick(BODY_Z, INDEX), 1.2), 0.6, pick(BLOOD, mod(INDEX, 4)), { grow: 2, dark: 60, dry: 0x3b1d14 }),
          ),
        ]),
      ),
      when(lt(variable('bulletZ'), WALL_Z), [set('bulletOn', false), call('impact', 'concrete', [0, 1.45, -4.45], [0, 0, 1], 2.2)]),
    ]),
  ],
}
