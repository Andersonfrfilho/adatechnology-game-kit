import type { ItemInput, SlotKit, SlotLibrary, TemplateDef } from '@adatechnology/game-floorplan'

/** What a place of the interior pass can hold, taken from the pins of the team's gallery scene: a hint for the finds provider, never an item id. */
export type FindsHint = {
  readonly id: string
  /** `loot` is a find; `danger`, `breakable` and `scene` are not finds and stay in the scene notes of the game. */
  readonly kind: 'loot'
  readonly room: string
  /** Furniture category that holds the finds (`FindsQuery.container`). */
  readonly container: string
  readonly tags: readonly string[]
}

/** One building of the interior pass: its template, the items and slot libraries only it uses, and what it can hold. */
export type InteriorModule = {
  readonly template: TemplateDef
  readonly items: readonly ItemInput[]
  readonly libraries: (kit: SlotKit) => Record<string, SlotLibrary>
  readonly hints: readonly FindsHint[]
}
