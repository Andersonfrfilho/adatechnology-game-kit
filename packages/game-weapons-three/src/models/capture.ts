import type * as THREE_NS from 'three'
import type { ModelParts } from './types'

/** Runs `draw` and returns what it added to `parent` (the meshes of one part), so that the part can be hidden later; the scene is exactly what `draw` made. */
export function captured(parent: THREE_NS.Object3D, draw: () => void): THREE_NS.Object3D[] {
  const before = parent.children.length
  draw()
  return parent.children.slice(before)
}

/** Draws a part that ships on the weapon and records its meshes under the id of the accessory it stands for. */
export function recordFitting(parts: ModelParts, id: string, parent: THREE_NS.Object3D, draw: () => void): void {
  parts.fittings = { ...parts.fittings, [id]: captured(parent, draw) }
}
