import { add, eq, gt, INDEX, mod, mul, or, pick } from '../dsl'
import { after, behavior, burst, camera, cue, screen, repeat, when } from '../steps'
import type { EffectDef } from '../types'
import { carPoint } from './car'

const HITS = [[90, 40], [170, 60], [120, 75], [60, 50]]
const HIT_X = HITS.map(([x]) => x)
const HIT_Y = HITS.map(([, y]) => y)
const ZOMBIE = carPoint(0, 0, 3.1)
const CAR_YAW = -0.4

/** W1140-1152 (`parabrisa`): from inside the car, blows shake the camera and add a star crack; at the second and fourth a smear of blood with a handprint runs down. */
export const WINDSHIELD: EffectDef = {
  id: 'windshield',
  pageId: 'parabrisa',
  team: 'vehicles',
  budget: { particles: 6, decals: 1 },
  loop: 5.8,
  setup: [
    cue('zombie_visible', { index: -1, visible: false }),
    behavior('walkers', 'place', { index: 0, x: ZOMBIE[0], z: ZOMBIE[2], facing: CAR_YAW + Math.PI }),
    camera(carPoint(-0.3, 1.35, -0.2), carPoint(0, 1.2, 2.2), true),
  ],
  timeline: [
    repeat(
      HITS.length,
      after(
        add(0.6, mul(INDEX, 0.85)),
        cue('zombie_swing', { index: 0, side: mod(INDEX, 2) }),
        after(
          add(0.6, mul(INDEX, 0.85), 0.15),
          behavior('cracks', 'crack', { x: pick(HIT_X, INDEX), y: pick(HIT_Y, INDEX), big: gt(INDEX, 1) }),
          when(or(eq(INDEX, 1), eq(INDEX, 3)), [behavior('cracks', 'blood_streaks', { x: pick(HIT_X, INDEX), y: pick(HIT_Y, INDEX) })]),
          screen({ add: { shake: 0.18 } }),
          burst('add', 6, { p: carPoint(-0.1, 1.25, 0.75), box: [0.4, 0.1, 0.05], size: [0.01, 0.03], life: [0.2, 0.5], c0: 0xffffff, a: 0.8, fi: 0.2 }),
          cue('windshield_stage', { stage: add(INDEX, 1) }),
        ),
      ),
    ),
  ],
}
