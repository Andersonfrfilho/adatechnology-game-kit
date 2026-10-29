import type * as THREE_NS from 'three'

import { tagForDestruction } from './destruction'
import { createItemKit } from './kit'
import type { ItemKit, Vec3Tuple } from './kit'
import { itemModelBuilder, itemModelEntry } from './models/registry'
import { drawShape, shapeOf } from './shapes'
import type { ShapeId, ShapeSubject } from './shapes'
import { setWear } from './wear'
import type { WearStage } from './wear'

/** The fields of an item the drawing reads (an `ItemDef` of `game-items` has them all). */
export interface DrawableItem extends ShapeSubject {
  id: string
  size: Vec3Tuple
  /** Key of a showcase model; without one (or when the model is not registered) the simple shape is drawn. */
  model?: string
  /** Real weight in kg; with `destructible` it becomes the mass of the destruction body. */
  weight?: number
}

export interface BuildItemOptions {
  /** Wear of the materials, 0 new (default), 1 used, 2 spoiled. */
  wear?: WearStage
  /** Draw the simple shape even when the item has a model (the second level of detail). */
  simple?: boolean
  /** Level of detail of the simple shape, 1 (default) or 0.5 for half the segments. */
  detail?: number
  /** Write the `userData` that `game-destruction-three`'s `specFromObject3D` reads (material of each mesh, hollow shells, welded parts, skins; see `tagForDestruction`). Default off. */
  destructible?: boolean
  /** A kit to draw with (and to collect the materials in); default a new one. */
  kit?: ItemKit
}

/** What `buildItem` returns. */
export interface ItemModel {
  /** The object to add to a scene: origin at the bottom centre of the item, y up, in metres. */
  readonly root: THREE_NS.Group
  /** `model` when the showcase builder drew it, `shape` otherwise. */
  readonly kind: 'model' | 'shape'
  readonly shape?: ShapeId
  /** Size in metres the drawing was fitted to (the item's `size`). */
  readonly size: Vec3Tuple
  /** The materials made for this item. */
  readonly materials: readonly THREE_NS.MeshStandardMaterial[]
}

/** Moves a group so that its box has the centre of its base at the origin. */
function restOnBase(T: typeof THREE_NS, inner: THREE_NS.Object3D): void {
  const box = new T.Box3().setFromObject(inner)
  const centre = box.getCenter(new T.Vector3())
  inner.position.set(-centre.x, -box.min.y, -centre.z)
}

/**
 * Draws an item at its real size. An item whose `model` is registered gets the showcase builder, ported as it is (page units, scaled to metres by the scale of
 * `models.json` on the root, so that the group inside is still the team's); every other item gets the simple shape of its `shape` hint (refined by category and
 * proportions) at its `size`. Either way the origin is the bottom centre and y is up.
 */
export function buildItem(T: typeof THREE_NS, item: DrawableItem, options: BuildItemOptions = {}): ItemModel {
  const kit = options.kit ?? createItemKit(T)
  const first = kit.materials.length
  const root = new T.Group()
  root.name = item.id
  const entry = item.model === undefined ? undefined : itemModelEntry(item.model)
  const builder = item.model === undefined ? undefined : itemModelBuilder(item.model)
  let kind: ItemModel['kind'] = 'shape'
  let shape: ShapeId | undefined
  if (entry && builder && !options.simple) {
    kind = 'model'
    const inner = builder(kit)
    inner.name = entry.teamId
    root.scale.setScalar(entry.scale)
    root.add(inner)
    restOnBase(T, inner)
  } else {
    shape = shapeOf(item)
    const inner = drawShape(kit, shape, item.size, { ...(item.color === undefined ? {} : { color: item.color }), ...(options.detail === undefined ? {} : { detail: options.detail }) })
    inner.name = shape
    root.add(inner)
    restOnBase(T, inner)
  }
  const materials = kit.materials.slice(first)
  if (options.wear) setWear(materials, options.wear)
  root.userData.wear = options.wear ?? 0
  if (options.destructible) tagForDestruction(root, { ...(kind === 'model' && item.model !== undefined ? { modelId: item.model } : {}), ...(item.weight === undefined ? {} : { weight: item.weight }), size: item.size })
  return { root, kind, ...(shape ? { shape } : {}), size: item.size, materials }
}
