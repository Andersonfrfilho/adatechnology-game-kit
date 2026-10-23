import type * as ThreeNS from 'three'
import type { PropsApi } from '@adatechnology/game-props3d'

/** The host's `THREE` namespace (or any object with the same classes). Always passed in, never imported at runtime. */
export type ThreeLib = typeof ThreeNS
export type { ThreeNS }

export type Vec3 = [number, number, number]

/** Material keys the mesh api understands (same as `PropsApi` materials). */
export type MaterialKey = 'plain' | 'metal' | 'wood' | 'glass' | 'fabric' | 'plant' | 'water' | 'emissive' | 'atlas_picture' | 'atlas_floor'

export const MATERIAL_KEYS: readonly MaterialKey[] = ['plain', 'metal', 'wood', 'glass', 'fabric', 'plant', 'water', 'emissive', 'atlas_picture', 'atlas_floor']

export type Quality = 'high' | 'game'

/**
 * What content packs draw through: the props primitives plus `part`.
 * `part(id, pivot, ry, draw)` runs `draw()` and routes every primitive drawn inside it into the movable part `id`.
 * `pivot` and the primitives' coordinates are object-local; the part's group origin sits at `pivot`, turned by `ry` around +y.
 */
export interface HouseholdApi extends PropsApi {
  part(id: string, pivot: Vec3, ry: number, draw: () => void): void
}

/** Anything that can create a canvas (the global `document`, or a fake in tests). */
export interface CanvasFactory {
  createElement(tag: 'canvas'): any
}
