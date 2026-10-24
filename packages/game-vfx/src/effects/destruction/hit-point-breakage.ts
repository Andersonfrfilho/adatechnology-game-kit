import { add, INDEX, mul, rnd, variable, vadd } from '../dsl'
import { after, call, cue, debris, burst, repeat, screen, set } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef } from '../types'
import { SPOT, UP } from './spot'

const at = (x: number, y: number, z: number): readonly [number, number, number] => [SPOT[0] + x, SPOT[1] + y, SPOT[2] + z]
/**
 * Where each part of the table is in the world. The page asks its scene graph for it (`tbW`), and the capture does not render, so the table's tilt never
 * reaches the world matrix it reads: the parts are always where the table stands level (W1009, recorded at 2.2 s, 3.8 s and 5.3 s).
 */
const FRONT_LEG = at(-0.52, 0.2, 0.32)
const TOP_CORNER = at(0.3, 0.78, 0.2)
const TOP_PIECE = at(-0.3, 0.78, -0.2)
const FAR_CORNER = at(0.3, 0.78, -0.2)
const HOLE_OBJECT_ID_DRAWS = 12
const HOLES = 9
const GLOCK_FROM = [-0.4, 1, 6] as const
const SHOTGUN_FROM = [0.2, 1.1, 4.6] as const
const toward = (target: readonly [number, number, number], from: readonly [number, number, number]) => normalized([target[0] - from[0], target[1] - from[1], target[2] - from[2]])

/** W1008-1020 (`pontos`): a 9 mm in the leg, a machete on a corner, a bat on the top and a 12-gauge up close: each breaks only the part it hit. */
export const HIT_POINT_BREAKAGE: EffectDef = {
  id: 'hit_point_breakage',
  pageId: 'pontos',
  team: 'destruction',
  budget: { particles: 120, debris: 20 },
  loop: 7.5,
  view: { eye: [0.2, 1.6, 5.4], target: [-2.2, 0.6, 2.6] },
  setup: [cue('zombie_visible', { index: -1, visible: false }), cue('work_light', { intensity: 2.2 })],
  timeline: [
    after(
      0.6,
      call('muzzle', 'glock', GLOCK_FROM, toward(FRONT_LEG, GLOCK_FROM)),
      call('chips', FRONT_LEG, normalized([0, 0.2, 1]), 6),
      cue('table_part_detached', { part: 'front_leg' }),
      debris({ p: FRONT_LEG, v: [0.4, 0.6, 1.4], sp: 0, size: [0.07, 0.4, 0.07], c: 0x7a5530, spin: 6, life: 20, bounce: 0.25 }),
      cue('table_tilt'),
    ),
    after(
      2.2,
      repeat(8, call('chips', vadd(TOP_CORNER, [add(-0.3, mul(INDEX, 0.08)), 0.03, 0]), normalized([0, 0.6, 1]), 1, 0.4)),
      cue('table_part_detached', { part: 'top_corner' }),
      debris({ p: TOP_CORNER, v: [1.2, 1.5, 1], sp: 0, size: [0.6, 0.06, 0.4], c: 0x7a5530, spin: 6, life: 20, bounce: 0.25 }),
    ),
    after(
      3.8,
      screen({ add: { shake: 0.12 } }),
      call('chips', TOP_PIECE, UP, 10, 1.3),
      cue('table_part_gone', { part: 'top_piece' }),
      repeat(4, debris({ p: [add(TOP_PIECE[0], rnd(-0.2, 0.2)), TOP_PIECE[1], add(TOP_PIECE[2], rnd(-0.1, 0.1))], dir: UP, cone: 1.2, sp: [1, 2.5], size: [rnd(0.15, 0.3), 0.06, rnd(0.12, 0.25)], c: 0x6b4a2a, spin: 8, life: 20, bounce: 0.2 })),
      burst('normal', 20, { p: TOP_PIECE, r: 0.2, sp: [0.3, 1], drag: 2, life: [1, 1.8], size: [0.2, 0.35], grow: 3, c0: 0x7a6048, a: 0.4 }),
    ),
    after(
      5.3,
      call('muzzle', 'r870', SHOTGUN_FROM, toward(FAR_CORNER, SHOTGUN_FROM)),
      repeat(HOLES, set('holeX', rnd(-0.15, 0.15)), set('holeZ', rnd(-0.1, 0.1)), cue('table_hole', { x: variable('holeX'), z: variable('holeZ') }, HOLE_OBJECT_ID_DRAWS)),
      call('chips', FAR_CORNER, UP, 10, 1),
    ),
  ],
}
