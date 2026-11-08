import { rnd, scaled } from './dsl'
import { MATERIAL_EVENT_EFFECTS } from './material-events'
import { burst, call, debris, repeat, screen } from './steps'
import type { EffectDef } from './types'

const FACING = [0, 0, 1] as const
const ORIGIN = [0, 0, 0] as const
const FORWARD = [0, 0, -1] as const
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

/** The flash of one weapon at its muzzle (W417 `muzzle`), played once: the recipe's own per-weapon sizes, petals, light and smoke. */
const muzzleEffect = (weapon: 'glock' | 'ak' | 'r870' | 'barrett'): EffectDef => ({
  id: `muzzle_${weapon}`,
  pageId: `event:muzzle_${weapon}`,
  team: 'weapons',
  budget: { particles: 60, lights: 1 },
  loop: 2.4,
  timeline: [call('muzzle', weapon, ORIGIN, FORWARD)],
})

/** A case thrown out of the port (W430 `casing`): brass, a red shell or a .50 case. */
const casingEffect = (id: string, type: '' | 'shell' | '50'): EffectDef => ({
  id,
  pageId: `event:${id}`,
  team: 'weapons',
  budget: { debris: 1 },
  loop: 2,
  timeline: [call('casing', ORIGIN, type)],
})

/**
 * The effects the destruction events play, as slices of the Workshop's recipes: the same bursts, with the recipe's own numbers, centred on the point the event
 * happens (`data/event-effects.json` says which event plays which). They are not Workshop pages, so they have no golden of their own; each cites the lines it was cut from.
 */
export const EVENT_EFFECTS: readonly EffectDef[] = [
  ...IMPACT_MATERIALS.map(impactEffect),
  ...(['glock', 'ak', 'r870', 'barrett'] as const).map(muzzleEffect),
  casingEffect('casing_brass', ''),
  casingEffect('casing_shell', 'shell'),
  casingEffect('casing_50', '50'),
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
  ...MATERIAL_EVENT_EFFECTS,
]
