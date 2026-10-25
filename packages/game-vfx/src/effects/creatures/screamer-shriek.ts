import { add, cos, div, INDEX, local, lt, mul, rand, sin, sub, TIME, variable, vnorm } from '../dsl'
import { after, emit, repeat, ring, screen, set, when } from '../steps'
import type { EffectDef } from '../types'

const WHITE_RING = 0xe8e2d0
const PREPARATION_END = 1.7
const SHRIEK_END = 2.6

/** W521-539: a steam of breath while the screamer prepares, then three pressure rings, a ring of dust and a burst of chromatic aberration. */
export const SCREAMER_SHRIEK: EffectDef = {
  id: 'screamer_shriek',
  pageId: 'grito',
  team: 'creatures',
  budget: { particles: 150 },
  loop: 5,
  view: { eye: [6, 3, 7], target: [0, 1, -1] },
  timeline: [
    after(
      PREPARATION_END,
      repeat(3, after(add(PREPARATION_END, mul(INDEX, 0.18)), ring([0, 0.03, 0], 0.3, 9, 0.9, WHITE_RING))),
      screen({ add: { chroma: 7, shake: 0.25 } }),
    ),
  ],
  tick: [
    when(lt(TIME, PREPARATION_END), [
      emit('vap', 'normal', 18, { p: [0, 1.68, 0.2], dir: vnorm([0, 0.5, 1]), cone: 0.3, sp: [0.6, 1.2], drag: 1.5, life: [0.8, 1.3], size: [0.05, 0.1], grow: 5, c0: 0xd8dde2, a: 0.2 }),
    ], [
      when(lt(TIME, SHRIEK_END), [
        set('shriekRadius', mul(div(sub(TIME, PREPARATION_END), 0.9), 8)),
        emit(
          'dust', 'normal', 140,
          local('angle', mul(rand(), 6.283), {
            p: [mul(cos(variable('angle')), variable('shriekRadius')), 0.05, mul(sin(variable('angle')), variable('shriekRadius'))],
            dir: vnorm([cos(variable('angle')), 0.6, sin(variable('angle'))]),
            cone: 0.3, sp: [0.6, 1.6], drag: 2, life: [0.8, 1.4], size: [0.2, 0.35], grow: 3, c0: 0x5d574d, a: 0.35,
          }),
        ),
      ]),
    ]),
  ],
}
