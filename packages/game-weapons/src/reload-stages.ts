import type { ReloadFamily, ReloadKind, ReloadStage } from './types'

type StageTable = Readonly<Record<ReloadKind, readonly ReloadStage[]>>

const magazineOut = { stage: 'magazine_out', at: 0 } as const
// 0.45 s of the 0.82 s magazine swap in the gallery
const magazineIn = { stage: 'magazine_in', at: 0.549 } as const

const byMagazine = (chargeAt: number): StageTable => ({
  tactical: [magazineOut, magazineIn],
  empty: [magazineOut, magazineIn, { stage: 'charge', at: chargeAt }],
  one_by_one: [magazineOut, magazineIn],
})

// A reload that loads rounds one at a time: `round_in` opens the loading and the closing stage comes after the last round.
const byTube = (closing: ReloadStage | undefined): StageTable => ({
  tactical: [{ stage: 'round_in', at: 0 }],
  empty: closing ? [{ stage: 'round_in', at: 0 }, closing] : [{ stage: 'round_in', at: 0 }],
  one_by_one: [{ stage: 'round_in', at: 0 }],
})

const revolverOpen = { stage: 'cylinder_open', at: 0 } as const
const revolverEject = { stage: 'cylinder_eject', at: 0.246 } as const
const revolverClose = { stage: 'cylinder_close', at: 0.808 } as const
const revolverJet: readonly ReloadStage[] = [revolverOpen, revolverEject, { stage: 'cylinder_load', at: 0.538 }, revolverClose]
const revolverRounds: readonly ReloadStage[] = [revolverOpen, revolverEject, revolverClose]

const breechSwing: readonly ReloadStage[] = [
  { stage: 'barrels_open', at: 0 },
  { stage: 'casings_eject', at: 0.208 },
  { stage: 'rounds_in', at: 0.542 },
  { stage: 'barrels_close', at: 0.833 },
]

// A grenade launcher under a barrel: the breech opens, the grenade goes in, the breech closes (the same stages for every kind of reload)
const breechLoad: readonly ReloadStage[] = [
  { stage: 'breech_open', at: 0 },
  { stage: 'round_in', at: 0.305 },
  { stage: 'breech_close', at: 0.724 },
]

const beltSwap: readonly ReloadStage[] = [
  { stage: 'cover_open', at: 0 },
  { stage: 'belt_swap', at: 0.129 },
  { stage: 'cover_close', at: 0.581 },
  { stage: 'charge', at: 0.742 },
]

/** Families that load an empty tube round by round and then work the action (pump, lever, charging handle) to chamber the first round. */
export const LOADS_THEN_WORKS: ReadonlySet<ReloadFamily> = new Set<ReloadFamily>(['top_load_semi', 'tube_semi', 'pump', 'lever'])

/** Where each step of a reload falls, as a fraction of its duration, from the key frames of the gallery animations. The runtime scales them to the duration of the weapon. */
export const RELOAD_STAGES: Readonly<Record<ReloadFamily, StageTable>> = {
  pistol: byMagazine(0.872),
  magazine: byMagazine(0.701),
  top_magazine: byMagazine(0.701),
  top_load_semi: byTube({ stage: 'charge', at: 0.893 }),
  tube_semi: byTube({ stage: 'charge', at: 0.88 }),
  pump: byTube({ stage: 'pump_cycle', at: 0.88 }),
  lever: byTube({ stage: 'lever_cycle', at: 0.873 }),
  bolt: {
    tactical: [{ stage: 'bolt_open', at: 0 }, { stage: 'round_in', at: 0.14 }, { stage: 'bolt_close', at: 0.86 }],
    empty: [{ stage: 'bolt_open', at: 0 }, { stage: 'round_in', at: 0.14 }, { stage: 'bolt_close', at: 0.86 }],
    one_by_one: [{ stage: 'bolt_open', at: 0 }, { stage: 'round_in', at: 0.14 }, { stage: 'bolt_close', at: 0.86 }],
  },
  bolt_magazine: {
    tactical: [magazineOut, magazineIn, { stage: 'bolt_open', at: 0.599 }, { stage: 'bolt_close', at: 0.89 }],
    empty: [magazineOut, magazineIn, { stage: 'bolt_open', at: 0.599 }, { stage: 'bolt_close', at: 0.89 }],
    one_by_one: [magazineOut, magazineIn],
  },
  belt: { tactical: beltSwap, empty: beltSwap, one_by_one: beltSwap },
  revolver: { tactical: revolverJet, empty: revolverJet, one_by_one: revolverRounds },
  break: { tactical: breechSwing, empty: breechSwing, one_by_one: breechSwing },
  // tactical: reusable launcher takes a rocket; empty: disposable tube is dropped and a new one seated; one_by_one: breech-loaded grenade
  rocket: {
    tactical: [{ stage: 'rocket_seat', at: 0 }],
    empty: [{ stage: 'tube_drop', at: 0 }, { stage: 'tube_seat', at: 0.522 }],
    one_by_one: [
      { stage: 'breech_open', at: 0 },
      { stage: 'round_in', at: 0.305 },
      { stage: 'breech_close', at: 0.724 },
    ],
  },
  underbarrel: { tactical: breechLoad, empty: breechLoad, one_by_one: breechLoad },
  flame: {
    tactical: [{ stage: 'tank_swap', at: 0 }],
    empty: [{ stage: 'tank_swap', at: 0 }],
    one_by_one: [{ stage: 'tank_swap', at: 0 }],
  },
}
