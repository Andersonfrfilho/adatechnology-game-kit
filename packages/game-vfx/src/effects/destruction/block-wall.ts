import { add, cos, INDEX, local, mul, rnd, scaled, sin, variable, vnorm } from '../dsl'
import { after, behavior, burst, call, cue, debris, repeat, screen, spawn } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef } from '../types'

const FIRING_FROM = [0.6, 1.3, 7] as const
const FIRING_DIRECTION = normalized([-2.8, -0.4, -4.4])
const WALL_CENTRE = [-2.2, 1, 2.6] as const

/** W1039-1053 (`parede`): a burst of AK fire leaves holes that are stuck to the blocks, then the wall gives way and the holes fall with them. */
export const BLOCK_WALL: EffectDef = {
  id: 'block_wall',
  pageId: 'parede',
  team: 'destruction',
  budget: { particles: 300, debris: 16 },
  loop: 8,
  view: { eye: [0.4, 1.7, 6.6], target: [-2.2, 0.9, 2.4] },
  props: ['blocks'],
  setup: [cue('zombie_visible', { index: -1, visible: false }), cue('work_light', { intensity: 2.2 })],
  timeline: [
    repeat(
      14,
      after(
        add(0.3, mul(INDEX, 0.11)),
        call('muzzle', 'ak', FIRING_FROM, FIRING_DIRECTION),
        behavior('blocks', 'hit', { x: rnd(-1.3, 1.3), y: rnd(0.4, 1.9), scale: 1 }),
      ),
    ),
    after(2.2, behavior('blocks', 'hit', { x: -0.2, y: 1.1, scale: 2.2 })),
    after(
      3,
      screen({ add: { shake: 0.4 } }),
      behavior('blocks', 'collapse', { x: -0.2, y: 1.1 }),
      burst('normal', 30, { p: WALL_CENTRE, box: [1.4, 0.8, 0.2], sp: [0.3, 1.2], drag: 1.5, life: [1.5, 2.6], size: [0.4, 0.7], grow: 3, c0: 0x8a857a, c1: 0x4a4640, a: 0.45 }),
      repeat(scaled(16), debris({ p: WALL_CENTRE, box: [1.3, 0.8, 0.1], sp: [1, 3], size: [0.08, 0.07, 0.08], k: [0.5, 1.5], c: 0x6e6a63, life: 20 })),
    ),
    after(
      3.6,
      screen({ add: { shake: 0.25 } }),
      repeat(
        scaled(60),
        spawn('normal', local('angle', rnd(0, 6.283), {
          p: [add(-2.2, rnd(-1.4, 1.4)), 0.2, add(2.4, rnd(-0.6, 0.4))],
          dir: vnorm([cos(variable('angle')), 0.3, sin(variable('angle'))]),
          cone: 0.4, sp: [0.8, 2.4], drag: 1.3, life: [2.5, 4.5], size: [0.6, 1], grow: 3, c0: 0x7a7268, c1: 0x4a4640, a: 0.45, fi: 0.12,
        })),
      ),
    ),
  ],
}
