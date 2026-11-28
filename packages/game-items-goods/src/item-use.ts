/**
 * What an item of the goods catalogue does in the hand (`ModuleItemUse` of game-contracts): the hand use its kind plays (`use.clip` of `kinds.json`, or the `clip` an
 * effect of `use-effects.json` asks for, such as alcohol dabbed on a wound), and the effect `resolveUse` of game-items works out for it. A host hands it to the room.
 * What a drink quenches comes from the volume drunk, from one source: the thirst a litre of its liquid quenches (`drink.thirst` of game-fluids `LIQUIDS`), times
 * the litres of one use (the bottle, or one dose of a jug). So 500 ml from a bottle and 500 ml poured from a tap into a cup quench the same.
 */
import { resolveEntry } from '@adatechnology/game-contracts'
import type { CategoryRegistry, ModuleItemUse } from '@adatechnology/game-contracts'
import { LIQUIDS } from '@adatechnology/game-fluids'
import type { LiquidDef } from '@adatechnology/game-fluids'
import { resolveUse } from '@adatechnology/game-items'
import type { ItemDef, UseEffectDef } from '@adatechnology/game-items'

import { GOODS_USE_EFFECTS } from './data'
import { createGoodsKinds } from './kinds'

export interface GoodsItemUseOptions {
  readonly kinds?: CategoryRegistry
  readonly effects?: readonly UseEffectDef[]
  /** The liquids whose `drink.thirst` (per litre) sets what a drink quenches. Default game-fluids `LIQUIDS`. */
  readonly liquids?: readonly LiquidDef[]
}

/** What one use of the item's liquid quenches: thirst per litre of the liquid times the litres of a use; undefined when it holds no drinkable liquid. */
export const drinkHydrationOf = (item: ItemDef, liquids: readonly LiquidDef[] = LIQUIDS): number | undefined => {
  const fluid = item.fluid
  const drink = fluid ? liquids.find((liquid) => liquid.id === fluid.liquid)?.drink : undefined
  if (!fluid || !drink) return undefined
  const doses = item.durability?.kind === 'doses' ? Math.max(1, item.durability.amount ?? 1) : 1
  return (drink.thirst * fluid.liters) / doses
}

type UseDefaults = { readonly use?: { readonly clip?: string } }

/** The use of an item, or undefined when its kind plays none. */
export type GoodsItemUse = (item: ItemDef & { readonly kind?: string }) => ModuleItemUse | undefined

export const createGoodsItemUse = (options: GoodsItemUseOptions = {}): GoodsItemUse => {
  const kinds = options.kinds ?? createGoodsKinds()
  const effects = options.effects ?? GOODS_USE_EFFECTS
  const liquids = options.liquids ?? LIQUIDS
  return (item) => {
    if (item.kind === undefined || !kinds.has(item.kind)) return undefined
    const result = resolveUse(item, effects)
    const { clip: effectClip, ...params } = (result?.params ?? {}) as { readonly clip?: unknown }
    const clip = typeof effectClip === 'string' ? effectClip : (resolveEntry(kinds, item as UseDefaults & { kind: string }) as UseDefaults).use?.clip
    if (clip === undefined) return undefined
    if (!result) return { clip, consumes: false }
    const nutrition = result.nutrition ? { satiety: result.nutrition.satiety, hydration: drinkHydrationOf(item, liquids) ?? result.nutrition.hydration } : {}
    return { clip, consumes: result.consumes, effect: { id: result.effect, ...(Object.keys(params).length > 0 ? { params } : {}), ...nutrition } }
  }
}

/** `createGoodsItemUse()` with the shipped kinds and effects. */
export const goodsItemUse: GoodsItemUse = createGoodsItemUse()
