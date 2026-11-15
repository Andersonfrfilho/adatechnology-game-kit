import type * as THREE_NS from 'three'
import type { DestructibleSpec } from '@adatechnology/game-contracts'

import data from './data/makeups.json'

/** What an item is physically made of, part by part: the one description both the goods catalog and the weapons counter build the world object from. */
export interface ItemMakeup {
  /** Kit material tag of a drawn mesh to the id of the part it belongs to. */
  readonly meshes: Readonly<Record<string, string>>
  /** The parts and joints in metres, in the frame of a built item: origin at the bottom centre, x along its length, y up. */
  readonly spec: DestructibleSpec
}

const MAKEUPS = data as unknown as Readonly<Record<string, ItemMakeup>>

/** The make-up of the model `modelId` (`shovel`), if it has one. */
export const itemMakeup = (modelId: string): ItemMakeup | undefined => MAKEUPS[modelId]

/** A fresh copy of the spec of the model's make-up, for the destruction world to own; `tags` are added to the spec's. */
export function makeupSpec(modelId: string, tags: readonly string[] = []): DestructibleSpec | undefined {
  const makeup = MAKEUPS[modelId]
  if (!makeup) return undefined
  const spec = structuredClone(makeup.spec)
  return { ...spec, tags: [...new Set([...(spec.tags ?? []), ...tags])] }
}

/** The part of the make-up each mesh under `root` belongs to, by its kit material tag: written as `userData.destructionPart`/`destructionMaterial` for the renderer to bind. */
export function tagMakeupParts(root: THREE_NS.Object3D, modelId: string): void {
  const makeup = MAKEUPS[modelId]
  if (!makeup) return
  const materialOf = new Map(makeup.spec.parts.map((part) => [part.id, part.material] as const))
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh) return
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    const tag = (material?.userData as { tag?: unknown } | undefined)?.tag
    const part = typeof tag === 'string' ? makeup.meshes[tag] : undefined
    if (part === undefined) return
    mesh.userData.destructionPart = part
    mesh.userData.destructionMaterial = materialOf.get(part)
  })
}
