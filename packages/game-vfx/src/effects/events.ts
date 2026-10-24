import { cos, local, mul, rnd, scaled, sin, variable, vnorm } from './dsl'
import { burst, call, debris, repeat, screen, spawn } from './steps'
import type { EffectDef } from './types'

const FACING = [0, 0, 1] as const
const UP = [0, 1, 0] as const
const ORIGIN = [0, 0, 0] as const
const IMPACT_MATERIALS = ['concrete', 'metal', 'wood', 'glass', 'flesh', 'water'] as const

/** What a hit leaves on one material, the way the Workshop's `impact` helper does (W374-391), played once at the hit. */
const impactEffect = (material: (typeof IMPACT_MATERIALS)[number]): EffectDef => ({
  id: `impact_${material}`,
  pageId: `event:impact_${material}`,
  team: 'weapons',
  budget: { particles: 40, decals: 1 },
  loop: 2,
  timeline: [call('impact', material, ORIGIN, FACING, 1, 0)],
})

/**
 * The effects the destruction events play, as slices of the Workshop's recipes: the same bursts, with the recipe's own numbers, centred on the point the event
 * happens (`data/event-effects.json` says which event plays which). They are not Workshop pages, so they have no golden of their own; each cites the lines it was cut from.
 */
export const EVENT_EFFECTS: readonly EffectDef[] = [
  ...IMPACT_MATERIALS.map(impactEffect),
  {
    // door_stages (W856-871): the dust a blow shakes loose from the frame and the splinters.
    id: 'stage_crack',
    pageId: 'event:stage_crack',
    team: 'destruction',
    budget: { particles: 12, debris: 5 },
    loop: 2,
    timeline: [
      burst('normal', 12, { p: ORIGIN, box: [0.6, 0.05, 0.02], dir: [0, -0.287, 0.958], cone: 0.6, sp: [0.2, 0.8], drag: 1.5, life: [0.8, 1.4], size: [0.08, 0.16], grow: 3, c0: 0x7a7366, a: 0.45, g: 0.4 }),
      repeat(scaled(2), debris({ p: [rnd(-0.5, 0.5), rnd(0, 1.6), 0], dir: [0, 0.287, 0.958], cone: 0.6, sp: [1, 2.5], size: [0.015, 0.015, 0.1], c: 0x7a5530, life: 12 })),
    ],
  },
  {
    // block_wall (W872-886, 3.6 s): the ring of dust that rolls out when the wall gives way.
    id: 'breach_dust',
    pageId: 'event:breach_dust',
    team: 'destruction',
    budget: { particles: 90, debris: 16 },
    loop: 5,
    timeline: [
      screen({ add: { shake: 0.25 } }),
      burst('normal', 30, { p: ORIGIN, box: [1.4, 0.8, 0.2], sp: [0.3, 1.2], drag: 1.5, life: [1.5, 2.6], size: [0.4, 0.7], grow: 3, c0: 0x8a857a, c1: 0x4a4640, a: 0.45 }),
      repeat(scaled(16), debris({ p: ORIGIN, box: [1.3, 0.8, 0.1], sp: [1, 3], size: [0.08, 0.07, 0.08], k: [0.5, 1.5], c: 0x6e6a63, life: 20 })),
      repeat(
        scaled(60),
        spawn('normal', local('angle', rnd(0, 6.283), {
          p: [rnd(-1.4, 1.4), 0.2, rnd(-0.6, 0.4)],
          dir: vnorm([cos(variable('angle')), 0.3, sin(variable('angle'))]),
          cone: 0.4, sp: [0.8, 2.4], drag: 1.3, life: [2.5, 4.5], size: [0.6, 1], grow: 3, c0: 0x7a7268, c1: 0x4a4640, a: 0.45, fi: 0.12,
        })),
      ),
    ],
  },
  {
    // building_collapse (W872-886): the slab dropping in blocks and the cloud that rolls along the street.
    id: 'collapse_dust',
    pageId: 'event:collapse_dust',
    team: 'destruction',
    budget: { particles: 350, debris: 26 },
    loop: 8,
    timeline: [
      screen({ add: { shake: 0.45 } }),
      repeat(6, debris({ p: ORIGIN, box: [2, 0.05, 0.6], v: [rnd(-0.5, 0.5), rnd(-0.5, 0), rnd(0, 0.8)], sp: 0, size: [rnd(0.5, 1.1), 0.25, rnd(0.4, 0.8)], c: 0x6e6a63, spin: 3, life: 30, bounce: 0.1 })),
      repeat(scaled(20), debris({ p: ORIGIN, box: [2.1, 0.1, 0.7], v: [rnd(-1, 1), rnd(-1, 1), rnd(0, 1.5)], sp: 0, size: [0.12, 0.1, 0.12], k: [0.5, 1.5], c: 0x5e5a54, life: 30 })),
      repeat(
        scaled(70),
        spawn('normal', local('angle', rnd(-0.4, 3.5), {
          p: [rnd(-2, 2), 0.2, rnd(-0.5, 0.5)],
          dir: vnorm([mul(cos(variable('angle')), 0.6), 0.25, sin(variable('angle'))]),
          cone: 0.5, sp: [1, 3.2], drag: 1.1, life: [3, 6], size: [0.7, 1.2], grow: 3, c0: 0x7a7268, c1: 0x4a4640, a: 0.5, fi: 0.12,
        })),
      ),
    ],
  },
  {
    // shopfront_glass (W846-855): the pane coming down as shards, the flash of the glints and the pale dust.
    id: 'glass_burst',
    pageId: 'event:glass_burst',
    team: 'destruction',
    budget: { debris: 80, particles: 50 },
    loop: 5,
    timeline: [
      screen({ add: { shake: 0.08 } }),
      repeat(
        scaled(75),
        debris({ p: ORIGIN, box: [1.25, 0.85, 0.02], v: [rnd(-0.4, 0.4), rnd(-0.5, 0.8), rnd(0.6, 2)], sp: 0, size: [rnd(0.05, 0.18), 0.006, rnd(0.05, 0.18)], c: 0xa8c8d8, spin: 14, life: 30, bounce: 0.15 }),
      ),
      burst('add', 30, { p: ORIGIN, box: [1.2, 0.8, 0.05], size: [0.02, 0.05], life: [0.2, 0.6], c0: 0xffffff, a: 0.9, fi: 0.3 }),
      burst('normal', 20, { p: [0, -0.6, 0.1], box: [1.2, 0.5, 0.1], sp: [0.2, 0.6], drag: 2, life: [0.8, 1.4], size: [0.12, 0.2], grow: 3, c0: 0xbfd6e2, a: 0.2 }),
    ],
  },
  {
    // The chips macro the page uses on wood (W849) plus rust (`rustAt`), for rebar laid bare in concrete.
    id: 'rebar_expose',
    pageId: 'event:rebar_expose',
    team: 'destruction',
    budget: { particles: 20, debris: 8 },
    loop: 2,
    timeline: [call('chips', ORIGIN, UP, 8, 0.9), call('rust_at', ORIGIN, 6)],
  },
]
