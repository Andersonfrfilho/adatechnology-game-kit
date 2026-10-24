import { and, gt, lt, TIME, vnorm } from '../dsl'
import { cue, emit, when } from '../steps'
import type { EffectDef } from '../types'

const UP: readonly [number, number, number] = [0, 1, 0]

/** W554-561: green motes while the body twitches (two random draws a frame for the arms), the eyes light up and a breath of steam on the first scream. */
export const REANIMATION: EffectDef = {
  id: 'reanimation',
  pageId: 'reanima',
  team: 'creatures',
  budget: { particles: 30 },
  loop: 6.5,
  view: { eye: [2.4, 1.4, 2.4], target: [0, 0.6, -0.4] },
  timeline: [],
  tick: [
    when(lt(TIME, 3.4), [
      when(gt(TIME, 1), [cue('zombie_arm_twitch', undefined, 2)]),
      when(gt(TIME, 0.6), [
        emit('mote', 'add', 8, { p: [0, 0.2, -0.8], box: [0.25, 0.05, 0.6], dir: UP, cone: 0.4, sp: [0.2, 0.5], life: [0.6, 1], size: [0.03, 0.05], c0: 0x9fc25a, a: 0.7, fi: 0.3 }),
      ]),
    ]),
    when(and(gt(TIME, 5), lt(TIME, 5.6)), [
      emit('br', 'normal', 20, { p: [0, 1.68, 0.2], dir: vnorm([0, 0.3, 1]), cone: 0.3, sp: [0.6, 1.1], drag: 1.5, life: 1.2, size: [0.05, 0.1], grow: 5, c0: 0xd8dde2, a: 0.2 }),
    ]),
  ],
}
