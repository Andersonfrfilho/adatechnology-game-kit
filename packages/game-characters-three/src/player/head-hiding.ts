import type { THREE_NS } from '../three'

export type AvatarViewMode = 'first' | 'third'

export type HeadHider = {
  setView(mode: AvatarViewMode, camera: THREE_NS.Object3D | null): void
}

type Drawable = THREE_NS.Object3D & { material?: THREE_NS.Material | THREE_NS.Material[] }
type Flags = { material: THREE_NS.Material; colorWrite: boolean; depthWrite: boolean }

const isDrawable = (object: THREE_NS.Object3D): boolean => {
  const flagged = object as THREE_NS.Object3D & { isMesh?: boolean; isSprite?: boolean; isPoints?: boolean }
  return Boolean(flagged.isMesh || flagged.isSprite || flagged.isPoints)
}

/**
 * Draws nothing of the given objects for one camera: while that camera renders, the materials write neither colour nor depth. The materials stay visible
 * and untouched for every other pass (shadow, mirror, third person), and are restored after each draw, so a material shared with the hands comes back intact.
 */
export const createHeadHider = (roots: readonly THREE_NS.Object3D[]): HeadHider => {
  let isHiding = false
  let viewCamera: THREE_NS.Object3D | null = null
  const drawables: Drawable[] = []
  for (const root of roots) root.traverse((object) => isDrawable(object) && drawables.push(object))

  for (const drawable of drawables) {
    const previousBefore = drawable.onBeforeRender
    const previousAfter = drawable.onAfterRender
    let saved: Flags[] = []
    drawable.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      previousBefore.call(drawable, renderer, scene, camera, geometry, material, group)
      if (!isHiding || camera !== viewCamera) return
      const drawn = Array.isArray(drawable.material) ? drawable.material : [material]
      saved = drawn.map((entry) => ({ material: entry, colorWrite: entry.colorWrite, depthWrite: entry.depthWrite }))
      for (const entry of drawn) {
        entry.colorWrite = false
        entry.depthWrite = false
      }
    }
    drawable.onAfterRender = (renderer, scene, camera, geometry, material, group) => {
      previousAfter.call(drawable, renderer, scene, camera, geometry, material, group)
      for (const flags of saved) {
        flags.material.colorWrite = flags.colorWrite
        flags.material.depthWrite = flags.depthWrite
      }
      saved = []
    }
  }

  return {
    setView(mode, camera) {
      isHiding = mode === 'first' && camera !== null
      viewCamera = camera
    },
  }
}
