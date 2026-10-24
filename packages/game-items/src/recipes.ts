import type { ItemsCatalog } from './catalog-types'
import type { RecipeDef, RecipeInput, RecipeOutput } from './recipe-types'

export interface CraftContext {
  catalog: ItemsCatalog
  /** Count of each item the character has, by id. */
  inventory: ReadonlyMap<string, number>
  /** Litres of each fluid at hand, by fluid id. */
  fluids?: Readonly<Record<string, number>>
  /** Stations and things of the world that are near (`fire`, `table`, `soil`). */
  world?: ReadonlySet<string>
  /** Skill levels by id. Without it the skill requirement is ignored. */
  skills?: Readonly<Record<string, number>>
  /** Ids unlocked so far. Without it `unlockedBy` is ignored. */
  unlocked?: ReadonlySet<string>
}

export interface CraftCheck {
  isPossible: boolean
  /** One entry per unmet requirement: `item:nails`, `any:salt|sugar`, `match:cookable`, `fluid:water`, `world:fire`, `tool:hammer|axe`, `skill:carpentry:2`, `unlock:magazine`. */
  missing: string[]
}

export type Consumption = { item: string; count: number; meters?: number } | { fluid: string; liters: number }

export type CraftOutcome = { item: string; count: number } | { effect: string; params: Readonly<Record<string, unknown>>; text?: string }

export type CraftResult = { isCrafted: true; seconds: number; consumed: Consumption[]; output: CraftOutcome } | { isCrafted: false; missing: string[] }

const countOf = (context: CraftContext, id: string): number => context.inventory.get(id) ?? 0

/** Ids that satisfy an item input, in the order they are used. */
const candidatesOf = (input: RecipeInput, context: CraftContext): string[] => {
  if (input.item !== undefined) return [input.item]
  if (input.any) return [...input.any]
  if (!input.match) return []
  const { category, cookable } = input.match
  return context.catalog.list().filter((item) => (category === undefined || item.category === category) && (cookable === undefined || item.cookable === cookable)).map((item) => item.id)
}

const describeInput = (input: RecipeInput): string => {
  if (input.item !== undefined) return `item:${input.item}`
  if (input.any) return `any:${input.any.join('|')}`
  if (input.match) return `match:${input.match.category ?? 'cookable'}`
  if (input.fluid !== undefined) return `fluid:${input.fluid}`
  return `world:${(input.world ?? []).join('|')}`
}

/** Takes `needed` units from the candidates in order; returns what was taken, or undefined when there is not enough. */
const takeUnits = (candidates: readonly string[], needed: number, context: CraftContext): Consumption[] | undefined => {
  const taken: Consumption[] = []
  let remaining = needed
  for (const id of candidates) {
    if (remaining <= 0) break
    const count = Math.min(remaining, countOf(context, id))
    if (count > 0) taken.push({ item: id, count })
    remaining -= count
  }
  return remaining > 0 ? undefined : taken
}

const consumptionFor = (input: RecipeInput, context: CraftContext): Consumption[] | undefined => {
  if (input.world) return input.world.some((thing) => context.world?.has(thing)) ? [] : undefined
  if (input.fluid !== undefined) {
    const liters = input.liters ?? 1
    return (context.fluids?.[input.fluid] ?? 0) >= liters ? [{ fluid: input.fluid, liters }] : undefined
  }
  const taken = takeUnits(candidatesOf(input, context), input.qty ?? 1, context)
  if (!taken || input.meters === undefined) return taken
  return taken.map((entry) => ('item' in entry ? { ...entry, meters: input.meters as number } : entry))
}

const toolMissing = (recipe: RecipeDef, context: CraftContext): string[] =>
  recipe.tools.flatMap((tool) => {
    const missing: string[] = []
    if (tool.anyOf.length > 0 && !tool.anyOf.some((id) => countOf(context, id) > 0)) missing.push(`tool:${tool.anyOf.join('|')}`)
    if (tool.world && !tool.world.some((station) => context.world?.has(station))) missing.push(`world:${tool.world.join('|')}`)
    return missing
  })

const gateMissing = (recipe: RecipeDef, context: CraftContext): string[] => {
  const missing: string[] = []
  if (context.skills && recipe.skill && (context.skills[recipe.skill.id] ?? 0) < recipe.skill.level) missing.push(`skill:${recipe.skill.id}:${recipe.skill.level}`)
  if (context.unlocked && recipe.unlockedBy !== undefined && !context.unlocked.has(recipe.unlockedBy)) missing.push(`unlock:${recipe.unlockedBy}`)
  return missing
}

/** Whether the character can make the recipe now, and what is missing when not. Skill and `unlockedBy` are ignored when the host does not pass `skills` or `unlocked`. */
export const canCraft = (recipe: RecipeDef, context: CraftContext): CraftCheck => {
  const missing = [
    ...gateMissing(recipe, context),
    ...toolMissing(recipe, context),
    ...recipe.inputs.filter((input) => consumptionFor(input, context) === undefined).map(describeInput),
  ]
  return { isPossible: missing.length === 0, missing }
}

const outcomeOf = (output: RecipeOutput, random: () => number): CraftOutcome => {
  if ('effect' in output) return { effect: output.effect, params: output.params, ...(output.text === undefined ? {} : { text: output.text }) }
  const [low, high] = output.qty
  return { item: output.item, count: low + Math.floor(random() * (high - low + 1)) }
}

/**
 * Makes the recipe: what is consumed and what comes out. Pure: the host takes the consumed things from its inventory and applies the output (an item is
 * added, an effect such as "window with 200 life" is the host's to handle). Draws one number only when the output quantity is a range.
 */
export const craft = (recipe: RecipeDef, context: CraftContext, random: () => number): CraftResult => {
  const check = canCraft(recipe, context)
  if (!check.isPossible) return { isCrafted: false, missing: check.missing }
  const consumed = recipe.inputs.flatMap((input) => consumptionFor(input, context) ?? [])
  return { isCrafted: true, seconds: recipe.seconds, consumed, output: outcomeOf(recipe.output, random) }
}
