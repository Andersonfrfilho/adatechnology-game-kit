import { add, DELTA, eq, ge, gt, ite, lt, mul, PARAM, rnd, TIME, variable } from '../dsl'
import { behavior, cue, decal, emit, screen, set, when } from '../steps'
import type { EffectDef } from '../types'
import { WORKSHOP_PUDDLES } from '../../workshop/rain'

/** How many streaks, and how much the wind slants them, for the garoa, the chuva and the temporal (W1070). */
const DROPS = [900, 2200, 4000]
const SLANT = [0.3, 1.2, 4.5]
const STORM = 2
/** The double flash (W1072): at full for 0.08 s, 0.2 for 0.08 s, 0.8 for 0.1 s, then dark; it ends at 0.4 s. */
const FLASH_STEPS = ite(lt(variable('flash'), 0.08), 1, ite(lt(variable('flash'), 0.16), 0.2, ite(lt(variable('flash'), 0.26), 0.8, 0)))

/**
 * W1063-1072 (the page's `chuva`): up to 4000 streaks in a box by the camera, slanted by the wind; splashes and rings only within 12 m and only on the
 * four dark puddles; in the storm, sheets of water pass and a double flash lights the scene for 0.2 s every 3.5 to 6 s. The flash is a cue (`lightning`) for
 * whoever owns the lights; the screen goes white by itself.
 */
export const RAIN_AND_PUDDLES: EffectDef = {
  id: 'rain_and_puddles',
  pageId: 'chuva',
  team: 'world',
  params: { id: 'intensity', options: ['drizzle', 'rain', 'storm'], default: 1 },
  budget: { particles: 4000, decals: 4 },
  loop: 0,
  view: { eye: [2, 2, 7], target: [-1, 0.6, 1] },
  setup: [
    cue('lamp_cone', { visible: true }),
    ...WORKSHOP_PUDDLES.map(([x, z, radiusX, radiusZ]) => decal(x, 0, z, radiusX * 2, 0x0c1016, { grow: 0, life: 1e6, ar: radiusZ / radiusX })),
  ],
  timeline: [
    behavior('rain', 'init', { count: ite(eq(PARAM, 0), DROPS[0], ite(eq(PARAM, 1), DROPS[1], DROPS[2])), wind: ite(eq(PARAM, 0), SLANT[0], ite(eq(PARAM, 1), SLANT[1], SLANT[2])) }),
    set('nextStrike', rnd(2, 4)),
    set('flash', -1),
  ],
  tick: [
    behavior('rain', 'update', { dt: DELTA, splash: gt(PARAM, 0) }),
    when(eq(PARAM, STORM), [
      when(gt(TIME, variable('nextStrike')), [set('nextStrike', add(TIME, rnd(3.5, 6))), set('flash', 0)]),
      when(ge(variable('flash'), 0), [
        set('flash', add(variable('flash'), DELTA)),
        set('light', FLASH_STEPS),
        cue('lightning', { intensity: variable('light') }),
        screen({ max: { white: mul(variable('light'), 0.12) } }),
        when(gt(variable('flash'), 0.4), [set('flash', -1), cue('lightning', { intensity: 0 })]),
      ]),
      emit('sheet', 'normal', 2.5, { p: [-12, 2.5, rnd(-1, 8)], box: [0, 2, 0], v: [7, -0.5, 0], sp: 0, life: [3, 4], size: [3, 5], grow: 1.3, c0: 0x8a9ab0, a: 0.06, fi: 0.3 }),
    ]),
  ],
}
