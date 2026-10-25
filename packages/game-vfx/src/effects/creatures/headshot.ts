import { ite, mod, INDEX, scaled, vnorm } from '../dsl'
import { after, burst, debris, decal, flash, repeat } from '../steps'
import type { EffectDef } from '../types'

const FRESH_BLOOD = 0x8a0a0a

/** W474-486: the head bursts, the eyes go out in the same frame and the body falls. */
export const HEADSHOT: EffectDef = {
  id: 'headshot',
  pageId: 'headshot',
  team: 'creatures',
  budget: { particles: 70, debris: 8, decals: 1 },
  loop: 3.2,
  view: { eye: [2.2, 1.8, 3], target: [0, 1.2, -0.5] },
  timeline: [
    after(
      0.45,
      burst('normal', 20, { p: [0, 1.7, 0], r: 0.1, sp: [0.4, 1.8], drag: 3, life: [0.4, 0.75], size: [0.12, 0.2], grow: 3, c0: FRESH_BLOOD, a: 0.7 }),
      burst('normal', 35, { p: [0, 1.7, 0], dir: vnorm([0, 0.45, -1]), cone: 0.8, sp: [2, 5], life: 1.5, size: [0.035, 0.065], c0: FRESH_BLOOD, g: 9.8, fi: 0, gnd: 3, ds: [0.06, 0.14] }),
      repeat(scaled(8), debris({ p: [0, 1.7, 0], dir: vnorm([0, 0.6, -1]), cone: 0.9, sp: [1.5, 4], size: [0.06, 0.05, 0.06], k: [0.5, 1.2], c: ite(mod(INDEX, 2), 0xd9cfbf, 0x6d7a5a), life: 8 })),
      flash([0, 1.7, 0], 0xff3020, 1.2, 0.08, 4),
    ),
    after(1.4, decal(0, 0, -1.5, 0.9, FRESH_BLOOD, { grow: 2.4, dark: 60, dry: 0x3b1d14 })),
  ],
}
