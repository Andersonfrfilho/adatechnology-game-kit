import type { FindStack, FindsQuery, Plan, ResultItem } from '@adatechnology/game-floorplan'

import type { WaterTank } from '../types'
import { hasContent } from './content'
import type { EnergyConfig, Electrical } from './electrical'
import { planElectrical } from './electrical'
import { planGas } from './gas'
import type { Gas } from './gas'
import { planPlumbing } from './plumbing'
import type { Rng } from './shared'
import type { Plumbing, Solar } from './types'
import { planSolar } from './solar'

export interface Utilities {
  gas: Gas | null
  electrical: Electrical
  solar: Solar | null
  plumbing: Plumbing
}

export interface UtilitiesContext {
  plan: Plan
  items: ResultItem[]
  stateItems: ResultItem[]
  tank: WaterTank | null
  energy?: EnergyConfig
  /** Seeded stream by name: `gas`, `electrical`, `solar`. */
  rngFor(key: string): Rng
}

/** Gas, electricity, solar panels and plumbing of a house, in the order that lets the later ones see the cylinders the first adds to `items`. */
export function planUtilities(context: UtilitiesContext): Utilities {
  const { plan, items, stateItems, tank, energy, rngFor } = context
  const gas = planGas({ plan, items, stateItems, rng: rngFor('gas') })
  const electrical = planElectrical({ plan, items, rng: rngFor('eletrica'), ...(energy ? { energy } : {}) })
  const solar = planSolar({ plan, rng: rngFor('solar'), ...(energy ? { energy } : {}) })
  const plumbing = planPlumbing({ plan, items, tank })
  return { gas, electrical, solar, plumbing }
}

const OVERHEAD = 'overhead_cabinet'
const ALWAYS_HOLD: readonly string[] = ['trash_bin', 'outdoor_bin', 'mailbox']

export interface ContentsContext {
  items: ResultItem[]
  state: string
  place: string
  /** Outbreak days and region of the world, passed to the finds provider. */
  day?: number
  region?: string
  rngFor(key: string): Rng
  findsFor(query: FindsQuery): readonly FindStack[]
}

/** What every container holds, asked of the registered finds provider: by item id, and `<id>#overhead` for the wall cabinet over a sink. */
export function planContents(context: ContentsContext): Record<string, readonly FindStack[]> {
  const out: Record<string, readonly FindStack[]> = {}
  const ask = (item: ResultItem, container: string, key: string): readonly FindStack[] =>
    context.findsFor({ place: context.place, container, state: context.state, rng: context.rngFor(key), footprint: item.w * item.d, key: item.id, ...(context.day === undefined ? {} : { day: context.day }), ...(context.region === undefined ? {} : { region: context.region }) })
  for (const item of context.items) {
    if (item.decor && item.mount !== 'wall_top') continue
    const container = hasContent(item.type) ? item.type : item.category
    if (!hasContent(container)) continue
    if (!ALWAYS_HOLD.includes(container) && item.decor) continue
    out[item.id] = ask(item, container, `content:${item.id}`)
    if (container === 'kitchen_cabinet' && item.overhead !== false) out[`${item.id}#overhead`] = ask(item, OVERHEAD, `content:${item.id}:overhead`)
  }
  return out
}
