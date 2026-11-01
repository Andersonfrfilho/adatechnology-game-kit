import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'

import { SHIPPED_WEAPON_ITEM_MODELS, weaponPropsOver } from './props'
import type { WeaponItemModel, WeaponProps } from './props'

export interface WeaponPropsOptions {
  /** Item model overrides by weapon id, added to the shipped ones (`null` keeps the low-poly prop); later packs replace earlier ones. */
  readonly packs?: readonly Readonly<Record<string, WeaponItemModel | null>>[]
  /** Changes to an override by weapon id, merged field by field. */
  readonly patch?: Readonly<Record<string, DeepPartial<WeaponItemModel>>>
  /** Weapon ids whose override is taken out (the weapon id itself is then the item model id). */
  readonly remove?: readonly string[]
}

type Entry = { readonly id: string; readonly model: WeaponItemModel }

/** A set of weapon prop overrides of its own: the shipped ones plus `packs`, `patch` and `remove`. Nothing is shared with any other set on the page. */
export function createWeaponProps(options: WeaponPropsOptions = {}): WeaponProps {
  const entryOf = ([id, model]: readonly [string, WeaponItemModel | null]): Entry => ({ id, model: model ?? { item: '' } })
  const entries = mergeById<Entry>(SHIPPED_WEAPON_ITEM_MODELS.map(entryOf), (options.packs ?? []).flatMap((pack) => Object.entries(pack).map(entryOf)))
  const patches: Record<string, { model: DeepPartial<WeaponItemModel> }> = {}
  for (const [id, model] of Object.entries(options.patch ?? {})) patches[id] = { model }
  applyPatches(entries, patches)
  removeIds(entries, options.remove)
  return weaponPropsOver(new Map([...entries].map(([id, entry]) => [id, entry.model])))
}
