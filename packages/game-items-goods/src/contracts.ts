import { checkSpec } from '@adatechnology/game-contracts'
import type { BodySlot, ContractChecker, DestructibleSpec } from '@adatechnology/game-contracts'
import type { ItemDef, RecipeDef } from '@adatechnology/game-items'

import { GOODS_ITEMS, GOODS_RECIPES } from './data'
import contractData from './data/item-contracts.json'

/**
 * The fields the kinds add to `ItemDef`, as a catalog row after `resolveEntry` (the kind's defaults underneath the item's own fields).
 * Every one is plain data: a kind sets it once and the items of the kind inherit it.
 */
export interface KindedItem extends Omit<ItemDef, 'category' | 'rarity'> {
  readonly category: string
  readonly kind: string
  /** The `category` values the kind's items may carry (the loot rolls read `category`): a kind default, never set on an item. */
  readonly lootCategory?: readonly string[] | string
  /** Parts of the item for the destruction engine; a part may be a full `PartSpec` (shape and position) or only `{ id, material, thickness? }`. */
  readonly parts?: readonly ItemPart[]
  readonly impact?: ItemImpact
  readonly use?: { readonly clip?: string; readonly sounds?: readonly string[] }
  readonly leftover?: ItemLeftover
  /** What eating or drinking it raw does. `sickChance` is the chance of getting sick, 0..1. */
  readonly rawEffect?: { readonly sickChance?: number }
  /** True when the item never spoils: the explicit form of a missing `shelfLife`. */
  readonly nonPerishable?: boolean
  /** Loose dry contents (the flakes of a cereal box, flour, coffee) in their colour (0xRRGGBB): a hole through the item lets out a puff of them. */
  readonly powder?: { readonly color: number }
  /** A container's capacity (an empty bucket); `fluid` is what it holds now. */
  readonly container?: { readonly capacityLiters?: number }
  /** Names of the fields whose value was estimated from the real world, not given by a team: the teams may adjust them. */
  readonly estimated?: readonly string[]
  /** The arsenal caliber an ammunition item belongs to. */
  readonly caliber?: string
}

export interface ItemPart {
  readonly id: string
  readonly material: string
  readonly thickness?: number
  readonly shape?: unknown
  readonly position?: unknown
}

/** How the item answers an impact: `response` is one of `IMPACT_RESPONSES`; `shed` says it throws off fragments. */
export interface ItemImpact {
  readonly response?: string
  readonly pushImpulse?: boolean
  readonly shed?: boolean
}

export type ItemLeftover = 'none' | { readonly item?: string; readonly despawnSeconds?: number }

export interface ItemContractOptions {
  /** Ids of the destruction materials (`MATERIALS` of game-destruction). Without it the material names are not checked against the engine. */
  readonly materials?: Iterable<string>
  /** Ids of the weapons of the arsenal (`WEAPONS` of game-weapons). Without it a `weapon` id is only checked to be a name. */
  readonly weaponIds?: Iterable<string>
  /** Ids of the calibers of the arsenal (`CALIBERS` of game-weapons). */
  readonly calibers?: Iterable<string>
  /** The catalog the leftovers and recipes are checked against (default: the goods catalog). */
  readonly items?: readonly Pick<KindedItem, 'id' | 'kind' | 'category' | 'cookable'>[]
  readonly recipes?: readonly RecipeDef[]
  /** Kilograms per litre of the bounding box an item may have (default `densityKgPerLitre` of `data/item-contracts.json`). */
  readonly density?: { readonly min: number; readonly max: number }
  /** Materials that take a flame (default `heatResistantMaterials` of `data/item-contracts.json`). */
  readonly heatResistant?: readonly string[]
}

export const IMPACT_RESPONSES: readonly string[] = contractData.impactResponses
export const HEAT_RESISTANT_MATERIALS: readonly string[] = contractData.heatResistantMaterials
export const DENSITY_KG_PER_LITRE = contractData.densityKgPerLitre
/** `BodySlot` of game-contracts, as a list. */
export const BODY_SLOTS = contractData.bodySlots as readonly BodySlot[]

const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/
const LITRES_PER_CUBIC_METRE = 1000

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isFraction = (value: unknown): boolean => isNumber(value) && value >= 0 && value <= 1
type CatalogRow = Pick<KindedItem, 'id' | 'kind' | 'category' | 'cookable'>
const catalogOf = (options: ItemContractOptions): readonly CatalogRow[] => options.items ?? (GOODS_ITEMS as unknown as readonly CatalogRow[])
const parts = (item: KindedItem): readonly ItemPart[] => (Array.isArray(item.parts) ? (item.parts as readonly ItemPart[]) : [])

type Checker = ContractChecker<KindedItem>

const physical = (options: ItemContractOptions): Checker => {
  const range = options.density ?? DENSITY_KG_PER_LITRE
  return {
    id: 'physical',
    check: (item) => {
      const problems: string[] = []
      const size = item.size as unknown
      const sizeOk = Array.isArray(size) && size.length === 3 && size.every((side) => isNumber(side) && side > 0)
      if (!sizeOk) problems.push('size must be 3 finite positive numbers in metres')
      if (!isNumber(item.weight) || item.weight < 0) problems.push('weight must be a finite number >= 0 (kg)')
      if (sizeOk && isNumber(item.weight) && item.weight > 0) {
        const [width, height, depth] = size as number[]
        const density = item.weight / (width * height * depth * LITRES_PER_CUBIC_METRE)
        if (density < range.min || density > range.max) problems.push(`density ${Number(density.toPrecision(2))} kg/L is outside ${range.min}..${range.max}`)
      }
      return problems
    },
  }
}

const destructible = (options: ItemContractOptions): Checker => {
  const materials = options.materials ? new Set(options.materials) : undefined
  return {
    id: 'destructible',
    check: (item) => {
      const list = parts(item)
      if (list.length === 0) return ['missing parts']
      const problems: string[] = []
      const seen = new Set<string>()
      for (const part of list) {
        if (typeof part.id !== 'string' || part.id === '') problems.push('a part has no id')
        else if (seen.has(part.id)) problems.push(`duplicate part "${part.id}"`)
        else seen.add(part.id)
        if (typeof part.material !== 'string' || part.material === '') problems.push(`part "${part.id}" has no material`)
        else if (materials && !materials.has(part.material)) problems.push(`part "${part.id}" has unknown material "${part.material}"`)
        if (part.thickness !== undefined && !(isNumber(part.thickness) && part.thickness > 0)) problems.push(`part "${part.id}" thickness must be a positive number`)
      }
      // A full spec (every part with its shape and position) goes through the same static check as any destructible object.
      if (problems.length === 0 && list.every((part) => part.shape !== undefined && part.position !== undefined)) {
        const report = checkSpec({ parts: list } as unknown as DestructibleSpec, materials ? { materials } : {})
        for (const problem of report.problems) problems.push(`spec: ${problem}`)
      }
      return problems
    },
  }
}

const impact: Checker = {
  id: 'impact',
  check: (item) => {
    const value = item.impact
    if (!value) return ['missing impact']
    const problems: string[] = []
    if (!IMPACT_RESPONSES.includes(value.response ?? '')) problems.push(`impact.response must be one of ${IMPACT_RESPONSES.join(', ')}`)
    if (typeof value.pushImpulse !== 'boolean') problems.push('impact.pushImpulse must be true or false')
    if (value.shed !== undefined && typeof value.shed !== 'boolean') problems.push('impact.shed must be true or false')
    return problems
  },
}

const useAnimation: Checker = {
  id: 'use_animation',
  check: (item) => {
    const problems: string[] = []
    const clip = item.use?.clip
    if (clip === undefined) problems.push('missing use.clip')
    else if (!SNAKE_CASE.test(clip)) problems.push(`use.clip "${clip}" must be snake_case`)
    const sounds = item.use?.sounds
    if (!Array.isArray(sounds) || sounds.length === 0 || sounds.some((sound) => typeof sound !== 'string' || sound === '')) problems.push('missing use.sounds (a non-empty list of sound ids)')
    return problems
  },
}

const leftover = (options: ItemContractOptions): Checker => {
  const ids = new Set(catalogOf(options).map((item) => item.id))
  return {
    id: 'leftover',
    check: (item) => {
      const value = item.leftover
      if (value === undefined) return ['missing leftover']
      if (value === 'none') return []
      const problems: string[] = []
      if (typeof value !== 'object' || value === null) return ['leftover must be an object or "none"']
      if (typeof value.item !== 'string' || value.item === '') problems.push('missing leftover.item')
      else if (!ids.has(value.item)) problems.push(`leftover.item "${value.item}" is not in the catalog`)
      if (!isNumber(value.despawnSeconds) || value.despawnSeconds < 0) problems.push('missing leftover.despawnSeconds')
      return problems
    },
  }
}

const edible: Checker = {
  id: 'edible',
  check: (item) => {
    const problems: string[] = []
    const nutrition = item.nutrition
    if (!nutrition || !(isNumber(nutrition.satiety) || isNumber(nutrition.hydration))) problems.push('missing nutrition')
    if (item.shelfLife === undefined && item.nonPerishable !== true) problems.push('missing shelfLife (a number of days, or nonPerishable: true)')
    else if (item.shelfLife !== undefined && !(isNumber(item.shelfLife) && item.shelfLife > 0)) problems.push('shelfLife must be a positive number of days')
    if (!isFraction(item.rawEffect?.sickChance)) problems.push('missing rawEffect.sickChance (0..1)')
    return problems
  },
}

type RecipeInput = { item?: string; any?: readonly string[]; match?: Record<string, unknown> }
type RecipeTool = { anyOf?: readonly string[]; world?: readonly string[] }

const inputsOf = (recipe: RecipeDef): readonly RecipeInput[] => ((recipe as unknown as { inputs?: RecipeInput[] }).inputs ?? [])
const toolsOf = (recipe: RecipeDef): readonly RecipeTool[] => ((recipe as unknown as { tools?: RecipeTool[] }).tools ?? [])

/** True when the recipe input names the item, lists it, or matches it (`{ match: { category } }`, `{ match: { cookable: true } }`). */
const consumes = (input: RecipeInput, item: KindedItem): boolean => {
  if (input.item === item.id) return true
  if (input.any?.includes(item.id)) return true
  if (!input.match) return false
  const entries = Object.entries(input.match)
  return entries.length > 0 && entries.every(([key, value]) => (item as unknown as Record<string, unknown>)[key] === value)
}

const recipeInput = (options: ItemContractOptions): Checker => {
  const recipes = options.recipes ?? GOODS_RECIPES
  return {
    id: 'recipe_input',
    check: (item) => (recipes.some((recipe) => inputsOf(recipe).some((input) => consumes(input, item))) ? [] : ['is not an input of any recipe']),
  }
}

const preparation = (options: ItemContractOptions): Checker => {
  const recipes = options.recipes ?? GOODS_RECIPES
  const cookware = new Set(catalogOf(options).filter((item) => item.kind === 'cookware').map((item) => item.id))
  return {
    id: 'preparation',
    check: (item) => {
      const usable = recipes.filter((recipe) => inputsOf(recipe).some((input) => consumes(input, item)))
      if (usable.length === 0) return ['has no recipe that prepares it']
      const prepares = usable.some((recipe) => {
        const heat = toolsOf(recipe).some((tool) => tool.world?.includes('fire'))
        const vessel = [...inputsOf(recipe).flatMap((input) => (input.item ? [input.item] : [])), ...toolsOf(recipe).flatMap((tool) => tool.anyOf ?? [])].some((id) => cookware.has(id))
        return heat && vessel
      })
      return prepares ? [] : ['has no recipe that needs fire and a cooking vessel']
    },
  }
}

const liquidContainer: Checker = {
  id: 'liquid_container',
  check: (item) => {
    const fluid = item.fluid
    if (fluid) {
      const problems: string[] = []
      if (typeof fluid.liquid !== 'string' || !SNAKE_CASE.test(fluid.liquid)) problems.push('fluid.liquid must be a liquid id')
      if (!isNumber(fluid.liters) || fluid.liters < 0) problems.push('fluid.liters must be a number >= 0')
      return problems
    }
    return isNumber(item.container?.capacityLiters) && (item.container?.capacityLiters ?? 0) > 0 ? [] : ['missing fluid { liquid, liters } or container.capacityLiters']
  },
}

const heatResistant = (options: ItemContractOptions): Checker => {
  const allowed = new Set(options.heatResistant ?? HEAT_RESISTANT_MATERIALS)
  return {
    id: 'heat_resistant',
    check: (item) => parts(item).filter((part) => !allowed.has(part.material)).map((part) => `part "${part.id}" is ${part.material}, which does not take a flame`),
  }
}

const weapon = (options: ItemContractOptions): Checker => {
  const weaponIds = options.weaponIds ? new Set(options.weaponIds) : undefined
  const calibers = options.calibers ? new Set(options.calibers) : undefined
  return {
    id: 'weapon',
    check: (item, ctx) => {
      if (ctx.chain.includes('ammo')) {
        if (typeof item.caliber !== 'string' || item.caliber === '') return ['missing caliber']
        return calibers && !calibers.has(item.caliber) ? [`caliber "${item.caliber}" is not in the arsenal`] : []
      }
      if (typeof item.weapon !== 'string' || item.weapon === '') return ['missing weapon (the arsenal id)']
      return weaponIds && !weaponIds.has(item.weapon) ? [`weapon "${item.weapon}" is not in the arsenal`] : []
    },
  }
}

const wearable: Checker = {
  id: 'wearable',
  check: (item, ctx) => {
    const problems: string[] = []
    const { protection, carry } = item
    if (!protection && !carry) return [ctx.chain.includes('bag') ? 'missing carry' : 'missing protection']
    if (ctx.chain.includes('bag') && !carry) problems.push('missing carry')
    if (ctx.chain.includes('clothing') && !protection) problems.push('missing protection')
    if (protection) {
      const slots = protection.slots as readonly string[] | undefined
      if (!Array.isArray(slots) || slots.length === 0) problems.push('protection.slots must list at least one body slot')
      else for (const slot of slots) if (!(BODY_SLOTS as readonly string[]).includes(slot)) problems.push(`protection.slots has unknown slot "${slot}"`)
      for (const field of ['bite', 'scratch', 'warmth'] as const) if (protection[field] !== undefined && !isFraction(protection[field])) problems.push(`protection.${field} must be between 0 and 1`)
    }
    if (carry) {
      if (!(isNumber(carry.capacityKg) && carry.capacityKg > 0)) problems.push('carry.capacityKg must be positive')
      if (!isFraction(carry.weightReduction)) problems.push('carry.weightReduction must be between 0 and 1')
      if (!(isNumber(carry.quickSlots) && carry.quickSlots >= 0)) problems.push('carry.quickSlots must be >= 0')
    }
    return problems
  },
}

const battery: Checker = {
  id: 'battery',
  check: (item) => (isNumber(item.charge?.lossPerMonth) && (item.charge?.lossPerMonth ?? -1) >= 0 ? [] : ['missing charge.lossPerMonth']),
}

/** The checkers of the contracts the kinds of `kinds.json` require, built over the catalog and the engines they are given. */
export const createItemContracts = (options: ItemContractOptions = {}): readonly ContractChecker<KindedItem>[] => [
  physical(options),
  destructible(options),
  impact,
  useAnimation,
  leftover(options),
  edible,
  preparation(options),
  recipeInput(options),
  liquidContainer,
  heatResistant(options),
  weapon(options),
  wearable,
  battery,
]

/** `createItemContracts()` over the goods catalog, without the engine lists (materials, arsenal): the CLI and the tests pass those. */
export const ITEM_CONTRACTS: readonly ContractChecker<KindedItem>[] = createItemContracts()
