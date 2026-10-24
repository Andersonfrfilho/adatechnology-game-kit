/** Traits that pick any item of the catalog ("1 clothing" is any item of the category, "ingredients" is anything cookable). */
export interface RecipeMatch {
  readonly category?: string
  readonly cookable?: true
}

/**
 * What a recipe consumes: one item, one of several (`any`), a fluid in `liters`, a thing of the world that is only near (`world`: furniture, ground) or any item
 * with some traits (`match`). `qty` defaults to 1; `meters` marks a length taken from the item (the host measures it).
 */
export interface RecipeInput {
  item?: string
  any?: readonly string[]
  fluid?: string
  world?: readonly string[]
  match?: RecipeMatch
  qty?: number
  liters?: number
  meters?: number
  label?: string
}

/** A tool requirement: one of `anyOf` must be in the inventory, and a station of `world` (a fire) must be near; both empty is bare hands. Tools are not consumed. */
export interface RecipeTool {
  anyOf: readonly string[]
  world?: readonly string[]
  label?: string
}

export type RecipeOutput =
  | { item: string; qty: readonly [number, number]; label?: string; note?: string }
  | { effect: string; params: Readonly<Record<string, unknown>>; text?: string }

export interface RecipeDef {
  id: string
  inputs: readonly RecipeInput[]
  tools: readonly RecipeTool[]
  skill?: { id: string; level: number }
  seconds: number
  /** Id of something the character must have unlocked first (a magazine read, a blueprint). Checked only when the host passes `unlocked`. */
  unlockedBy?: string
  output: RecipeOutput
}
