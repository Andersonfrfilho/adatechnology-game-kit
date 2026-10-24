import { add, atan2, DELTA, FRESH, INDEX, lt, mul, neg, not, pick, sub, TIME, variable } from '../dsl'
import { call, cue, repeat, set, when } from '../steps'
import type { EffectDef } from '../types'

/** The five bodies the blast reaches (W826), where they stand and the way each faces (`atan2(-x, -z)`, toward the origin). */
const BODIES = [[1.6, 0.8], [-1.8, 1.2], [0.6, -2], [-1, -1.8], [2.4, -1.2]] as const
const BODY_X = BODIES.map(([x]) => x)
const BODY_Z = BODIES.map(([, z]) => z)
const FACING = BODIES.map(([x, z]) => Math.atan2(-x, -z))
const FUSE = 1.8
const GRAVITY = 9.8
const FLOOR = 0.07
const BOUNCE = -0.4
const SIDE_LOSS = 0.5

/** W819-830 (`lab: 1`): a grenade thrown in an arc, bouncing on the asphalt, then the Workshop's blast and the five bodies turning away to fall. */
export const GRENADE: EffectDef = {
  id: 'grenade',
  pageId: 'granada',
  team: 'weapons',
  lab: 'm67',
  budget: { particles: 400, debris: 16, decals: 1 },
  loop: 6.5,
  view: { eye: [7, 3.4, 7.5], target: [0, 0.8, -0.2] },
  setup: [
    cue('zombie_visible', { index: -1, visible: false }),
    // three.js draws 12 random numbers (the object ids of the grenade's geometry, material and mesh) the first time the page builds it
    when(FRESH, [cue('prop_created', { prop: 'grenade' }, 12)]),
    repeat(BODIES.length, cue('zombie_place', { index: INDEX, x: pick(BODY_X, INDEX), z: pick(BODY_Z, INDEX), turn: pick(FACING, INDEX) })),
  ],
  timeline: [
    set('px', -4), set('py', 1.4), set('pz', 4.5),
    set('vx', 3.2), set('vy', 2.4), set('vz', -3.6),
    set('boom', false),
    cue('grenade_visible', { visible: true }),
  ],
  tick: [
    when(lt(TIME, FUSE), [
      set('vy', sub(variable('vy'), mul(GRAVITY, DELTA))),
      set('px', add(variable('px'), mul(variable('vx'), DELTA))),
      set('py', add(variable('py'), mul(variable('vy'), DELTA))),
      set('pz', add(variable('pz'), mul(variable('vz'), DELTA))),
      when(lt(variable('py'), FLOOR), [
        set('py', FLOOR),
        set('vy', mul(variable('vy'), BOUNCE)),
        set('vx', mul(variable('vx'), SIDE_LOSS)),
        set('vz', mul(variable('vz'), SIDE_LOSS)),
      ]),
      cue('grenade_move', { position: [variable('px'), variable('py'), variable('pz')] }),
    ], [
      when(not(variable('boom')), [
        set('boom', true),
        cue('grenade_visible', { visible: false }),
        call('explode', [variable('px'), 0, variable('pz')], 1),
        repeat(
          BODIES.length,
          cue('zombie_turn_and_fall', {
            index: INDEX,
            turn: atan2(neg(sub(pick(BODY_X, INDEX), variable('px'))), neg(sub(pick(BODY_Z, INDEX), variable('pz')))),
            delay: 0.02,
            duration: 0.45,
          }),
        ),
      ]),
    ]),
  ],
}
