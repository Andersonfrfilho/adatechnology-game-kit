import type { DestructibleSpec, TestableItem } from '@adatechnology/game-contracts'

import { furnitureSpec } from '../furniture/spec.js'
import type { FurnitureCatalogEntry, FurnitureSpecOptions } from '../furniture/spec.js'
import type { Three } from '../kernel-types.js'
import type * as THREE_NS from 'three'

/** Furniture the houses area offers by default: tables on legs, to break a leg and see what stood on the top go with it. */
export const DEFAULT_AREA_FURNITURE = ['dining_table', 'coffee_table', 'desk'] as const

/** Prefix of the catalogue ids of the area's furniture (`furniture_dining_table`). */
export const FURNITURE_ITEM_PREFIX = 'furniture_'

export type FurnitureItemsOptions = {
  readonly types: readonly string[]
  readonly catalog?: readonly FurnitureCatalogEntry[]
  /** The document the procedural textures are drawn on (the page's own by default). */
  readonly document?: FurnitureSpecOptions['document']
  readonly nameOf: (type: string) => string
}

/**
 * The furniture of the plans as catalogue items of the room: each is the builder's drawing with its destructible spec (`furnitureSpec`), every leg,
 * board and top a part of its own, so a shot or a kick breaks the leg it hits and the rest stands or goes over on what is left. Chairs around a table
 * are left out: in a house they are objects of their own.
 */
export const furnitureItems = (options: FurnitureItemsOptions): TestableItem[] =>
  options.types.map((type) => ({
    id: `${FURNITURE_ITEM_PREFIX}${type}`,
    name: options.nameOf(type),
    movable: true,
    build: (T: unknown) => {
      const made = furnitureSpec(T as Three, type, { ...(options.catalog ? { catalog: options.catalog } : {}), ...(options.document ? { document: options.document } : {}), options: { chairs: false } })
      const root = made.build(T as Three)
      root.userData.furnitureSpec = made.spec
      return root
    },
    spec: (root: unknown): DestructibleSpec => JSON.parse(JSON.stringify((root as THREE_NS.Object3D).userData.furnitureSpec)) as DestructibleSpec,
  }))
