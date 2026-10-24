import { abs, clamp, DELTA, div, eq, gt, lt, min, mul, not, PARAM, query, sub, TIME, variable, vx, vz } from '../dsl'
import { after, behavior, call, cue, emit, set, screen, when } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef } from '../types'
import { SPOT, UP } from './spot'

const OXYGEN = 1
const PUNCTURE_AT = 0.6
const JET_SECONDS = 3.4
const CLOUD_UNTIL = 7
const SHOT_FROM = [0.4, 1.2, 6.4] as const
const SHOT_DIRECTION = normalized([-0.5, -0.15, -1])
const SCRAPE_DIRECTION = normalized([1, 0.4, 0])
const jetStrength = variable('jet')
const isOxygen = eq(PARAM, OXYGEN)

/** W1021-1038 (`pressao`): a shot into an extinguisher (a white cloud and a spin) or into an oxygen bottle (the valve breaks and it flies off as a rocket). */
export const PRESSURE_CYLINDERS: EffectDef = {
  id: 'pressure_cylinders',
  pageId: 'pressao',
  team: 'destruction',
  params: { id: 'cylinder', options: ['extinguisher', 'oxygen'], default: 0 },
  budget: { particles: 250 },
  loop: 7,
  view: { eye: [1.6, 1.5, 6.4], target: [-1.6, 0.4, 2.4] },
  props: ['cylinder'],
  setup: [cue('zombie_visible', { index: -1, visible: false }), cue('work_light', { intensity: 2.2 }), behavior('cylinder', 'choose', { oxygen: isOxygen }), cue('cylinder_visible', { oxygen: isOxygen })],
  timeline: [
    after(
      PUNCTURE_AT,
      call('muzzle', 'glock', SHOT_FROM, SHOT_DIRECTION),
      screen({ add: { shake: 0.1 } }),
      behavior('cylinder', 'puncture'),
      when(isOxygen, [call('spark_at', [SPOT[0], 1.3, SPOT[2]], UP, 20, 1.2)]),
    ),
  ],
  tick: [
    when(query('cylinder', 'live'), [
      set('jet', clamp(sub(1, div(sub(TIME, PUNCTURE_AT), JET_SECONDS)), 0, 1)),
      behavior('cylinder', 'step', { dt: DELTA, t: TIME }),
      when(not(isOxygen), [
        when(gt(jetStrength, 0), [
          emit('jet', 'normal', 60, { p: query('cylinder', 'tip'), dir: query('cylinder', 'direction'), cone: 0.3, sp: [3, 6], drag: 2.5, life: [2, 3.5], size: [0.15, 0.3], grow: 6, c0: 0xeeeeea, c1: 0xbfc3c8, a: 0.45, g: -0.05, fi: 0.05 }),
        ]),
        when(lt(TIME, CLOUD_UNTIL), [
          emit('cloud', 'normal', 4, { p: [SPOT[0], 0.6, SPOT[2]], r: 2.5, flat: true, sp: [0.05, 0.2], life: [3, 5], size: [1.5, 2.5], grow: 1.3, c0: 0xe2e2de, a: mul(0.18, min(1, sub(TIME, PUNCTURE_AT))), fi: 0.3 }),
        ]),
      ], [
        when(gt(jetStrength, 0), [
          emit('jet', 'normal', 50, { p: query('cylinder', 'back'), dir: [1, 0, 0], cone: 0.25, sp: [2, 4], drag: 3, life: [0.5, 0.9], size: [0.1, 0.2], grow: 4, c0: 0xdde6ee, a: 0.2 }),
        ]),
        when(gt(abs(query('cylinder', 'speed_x')), 0.5), [
          emit('scr', 'streak', 120, { p: [vx(query('cylinder', 'position')), 0.03, vz(query('cylinder', 'position'))], dir: SCRAPE_DIRECTION, cone: 0.6, sp: [2, 6], v: [mul(query('cylinder', 'speed_x'), 0.5), 0, 0], life: [0.2, 0.45], len: 0.02, c0: 0xfff0c0, c1: 0xff5010, g: 9.8, gnd: 2 }),
        ]),
      ]),
    ]),
  ],
}
