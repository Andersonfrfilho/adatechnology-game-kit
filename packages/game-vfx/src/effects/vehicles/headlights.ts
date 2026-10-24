import { add, cos, DELTA, INDEX, local, mul, not, pick, query, rand, rnd, sin, sqrt, variable, vadd, vscale, vwith, vy } from '../dsl'
import { behavior, cue, emit, repeat, set, when } from '../steps'
import type { EffectDef } from '../types'
import { carDirection, carPoint } from './car'

/** Where the beam starts (between the two lamps, W1176) and which way it points: the car's own +z. */
const BEAM_FROM = carPoint(0, 0.74, 2.15)
const BEAM_DIRECTION = carDirection(BEAM_FROM, carPoint(0, 0.74, 3.15))
const BEAM_SIDE = [BEAM_DIRECTION[2], 0, -BEAM_DIRECTION[0]] as const
/** The six zombies that come into the light walk toward a point 2.6 m in front of the car (W1168). */
const WALKERS = 6
const WALK_SPEED = 0.7
const DROPS = 1800
const SLANT = 0.8

const startWalking = [
  set('spot', query('car', 'point', rnd(-2, 2), 0, rnd(8, 18))),
  set('goal', query('car', 'point', rnd(-0.6, 0.6), 0, 2.6)),
  behavior('walkers', 'place', { index: INDEX, x: pick(variable('spot'), 0), z: pick(variable('spot'), 2), facing: 0 }),
  behavior('walkers', 'walk', { index: INDEX, to: variable('goal'), speed: WALK_SPEED }),
]

/**
 * W1161-1170 (the page's `farol`): two beams in the air, rain that glows only inside the cone (up to 600 lit drops a second, thrown into the beam and
 * falling), and zombies that walk into the light. The lamps, the cones and the fog (0.05) are cues for whoever owns the scene.
 */
export const HEADLIGHTS_IN_RAIN: EffectDef = {
  id: 'headlights_in_rain',
  pageId: 'farol',
  team: 'vehicles',
  budget: { particles: 600, lights: 2 },
  loop: 0,
  view: { eye: [-2.5, 2, 5.5], target: [4, 1, 6] },
  setup: [
    cue('fog', { density: 0.05 }),
    cue('headlights', { on: true, intensity: 2.4, color: 0xfff1d0 }),
    behavior('rain', 'init', { count: DROPS, wind: SLANT }),
    repeat(WALKERS, ...startWalking),
  ],
  timeline: [],
  tick: [
    behavior('rain', 'update', { dt: DELTA, splash: true }),
    emit(
      'lit',
      'streak',
      600,
      local(
        'depth',
        rnd(1, 13),
        local(
          'spread',
          mul(variable('depth'), 0.33, sqrt(rand())),
          local(
            'turn',
            rnd(0, 6.283),
            local('base', vadd(BEAM_FROM, vscale(BEAM_DIRECTION, variable('depth')), vscale(BEAM_SIDE, mul(cos(variable('turn')), variable('spread')))), {
              p: vwith(variable('base'), 1, add(vy(variable('base')), mul(sin(variable('turn')), variable('spread'), 0.6))),
              v: [0.8, -14, 0],
              sp: 0,
              life: 0.06,
              len: 0.035,
              c0: 0xcfdcf0,
              a: 0.9,
            }),
          ),
        ),
      ),
    ),
    repeat(WALKERS, when(not(query('walkers', 'is_walking', INDEX)), startWalking)),
  ],
}
