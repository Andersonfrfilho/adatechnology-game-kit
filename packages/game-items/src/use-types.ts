import type { ItemCategory } from './types'

/** One way of using an item, read from the team's `useItem`: which items or categories trigger it and what it does. */
export interface UseEffectDef {
  id: string
  /** Id of the effect the host applies (`consume_nutrition`, `stop_bleeding`, `heal`, `calm`, `clean_wound`, `assemble_molotov`, `toggle_light`, `swap_bag`, `equip_melee`). */
  effect: string
  params?: Readonly<Record<string, unknown>>
  /** The item is spent when used. */
  consumes: boolean
  /** Items that trigger it, by id; wins over `category`. */
  items?: readonly string[]
  category?: readonly ItemCategory[]
}
