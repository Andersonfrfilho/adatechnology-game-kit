import { add, and, div, DELTA, FRESH, ge, gt, ite, lerp, lt, max, min, mul, not, scaled, sin, sub, TIME, variable, vadd, vlerp, vwith } from '../dsl'
import { call, cue, debris, burst, decal, emit, fireLight, fireLightOff, flash, repeat, set, when } from '../steps'
import type { EffectDef } from '../types'

const FROM = [-4, 1.6, 5] as const
const TARGET = [0, 0, -0.5] as const
const UP = [0, 1, 0] as const
const FLIGHT = 1
const ARC_HEIGHT = 2.2
const GLASS_GREEN = 0x3a6a3a
const OBJECT_ID_DRAWS = 12
const at = (offset: readonly [number, number, number]) => vadd(TARGET, offset)

/** W798-818 (`lab: 1`): a bottle in an arc with a wick burning, glass and a splash of fire on landing, and a pool of fire that spreads for 6 s. */
export const MOLOTOV: EffectDef = {
  id: 'molotov',
  pageId: 'molotov',
  team: 'weapons',
  lab: 'molotov',
  budget: { particles: 300, lights: 1 },
  loop: 9.5,
  view: { eye: [5, 3, 6.5], target: [0, 0.6, -0.5] },
  // three.js draws 12 random numbers (the object ids of the bottle's geometry, material and mesh) the first time the page builds the bottle
  setup: [cue('zombie_visible', { index: -1, visible: false }), when(FRESH, [cue('prop_created', { prop: 'bottle' }, OBJECT_ID_DRAWS)])],
  timeline: [set('landed', false), cue('bottle_visible', { visible: true })],
  tick: [
    when(lt(TIME, FLIGHT), [
      set('bottle', vwith(vlerp(FROM, TARGET, TIME), 1, add(lerp(FROM[1], TARGET[1], TIME), mul(sin(mul(TIME, Math.PI)), ARC_HEIGHT)))),
      cue('bottle_move', { position: variable('bottle'), spin: mul(10, DELTA) }),
      emit('wick', 'add', 40, { p: vadd(variable('bottle'), [0, 0.12, 0]), r: 0.03, sp: [0.1, 0.3], life: [0.15, 0.3], size: [0.08, 0.14], grow: 0.5, c0: 0xffd27a, c1: 0xff5010, fi: 0, g: -1 }),
      emit('wsm', 'normal', 14, { p: variable('bottle'), size: [0.06, 0.1], grow: 4, life: [0.8, 1.2], c0: 0x3a3530, a: 0.3, sp: [0, 0.2] }),
    ], [
      when(not(variable('landed')), [
        set('landed', true),
        cue('bottle_visible', { visible: false }),
        repeat(scaled(12), debris({ p: at([0, 0.1, 0]), dir: UP, cone: 1.3, sp: [1, 3], size: [0.04, 0.01, 0.04], c: GLASS_GREEN, life: 12 })),
        burst('add', 45, { p: at([0, 0.15, 0]), dir: UP, cone: 1.35, sp: [2, 4], drag: 2, life: [0.3, 0.6], size: [0.3, 0.5], c0: 0xffd27a, c1: 0xa02008, fi: 0.05 }),
        flash(at([0, 0.6, 0]), 0xff8a30, 6, 0.3, 12, true),
        decal(TARGET[0], 0, TARGET[2], 4.2, 0x0d0b09, { grow: 0.8, life: 60 }),
      ]),
    ]),
    when(and(gt(TIME, FLIGHT), lt(TIME, 8.2)), [
      set('poolRadius', min(2.2, add(0.5, mul(sub(TIME, 1), 2.1)))),
      set('poolFade', ite(gt(TIME, 7), max(0.1, sub(1, div(sub(TIME, 7), 1.2))), 1)),
      call('fire_emit', 'mol', at([0, 0.05, 0]), variable('poolRadius'), mul(1.6, variable('poolFade')), { smoke: 16 }),
      fireLight(0, at([0, 1, 0]), mul(3.2, variable('poolFade')), TIME),
    ], [
      when(ge(TIME, 8.2), [
        fireLightOff(0),
        emit('emb', 'add', 6, { p: TARGET, r: 2, flat: true, size: [0.04, 0.07], life: [0.6, 1.2], c0: 0xff6a20, a: 0.8, fi: 0.3 }),
      ]),
    ]),
  ],
}
