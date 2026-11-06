import type { Three, THREE_NS } from '../three'
import type { AvatarViewMode } from './head-hiding'

export type EyeClip = {
  setView(mode: AvatarViewMode, camera: THREE_NS.Object3D | null): void
}

export type EyeClipOptions = {
  /** What is cut: the upper body (torso, shoulders, arms). The legs stay whole, as a person lying down still sees them. */
  readonly roots: readonly THREE_NS.Object3D[]
  /** The eye socket the first-person camera sits at. */
  readonly eye: THREE_NS.Object3D
  /** The object whose +z is the body's front (the upper body, so a lean or a lie turns the plane with it). */
  readonly front: THREE_NS.Object3D
  /** Metres behind the eye the plane stands: the chest in front of it shows, the shoulders and the back do not. */
  readonly behind: number
}

type Drawable = THREE_NS.Object3D & { material?: THREE_NS.Material | THREE_NS.Material[] }
type Saved = { material: THREE_NS.Material; planes: THREE_NS.Plane[] | null }

const isDrawable = (object: THREE_NS.Object3D): boolean => {
  const flagged = object as THREE_NS.Object3D & { isMesh?: boolean; isSprite?: boolean; isPoints?: boolean }
  return Boolean(flagged.isMesh || flagged.isSprite || flagged.isPoints)
}

/**
 * Cuts the body at a plane just behind the eyes, for one camera: what a real head hides from its own eyes (the tops of the shoulders, the collar, the
 * back) is not drawn, so a look down shows the chest, the belly and the legs instead of the shirt seen from above as a ring around the camera. The plane
 * goes on the materials only while that camera draws them (`clippingPlanes`, world space) and comes off after, so shadows, mirrors and the third person
 * keep the whole body. The renderer's `localClippingEnabled` is switched on the first time: it takes effect from the next frame.
 */
export const createEyeClip = (THREE: Three, options: EyeClipOptions): EyeClip => {
  let isCutting = false
  let viewCamera: THREE_NS.Object3D | null = null
  const plane = new THREE.Plane()
  const planes = [plane]
  const eyeAt = new THREE.Vector3()
  const front = new THREE.Vector3()
  const place = (): void => {
    options.eye.getWorldPosition(eyeAt)
    front.set(0, 0, 1).transformDirection(options.front.matrixWorld)
    plane.setFromNormalAndCoplanarPoint(front, eyeAt.addScaledVector(front, -options.behind))
  }
  const drawables: Drawable[] = []
  for (const root of options.roots) root.traverse((object) => isDrawable(object) && drawables.push(object))

  for (const drawable of drawables) {
    const previousBefore = drawable.onBeforeRender
    const previousAfter = drawable.onAfterRender
    let saved: Saved[] = []
    drawable.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      previousBefore.call(drawable, renderer, scene, camera, geometry, material, group)
      if (!isCutting || camera !== viewCamera) return
      renderer.localClippingEnabled = true
      place()
      const drawn = Array.isArray(drawable.material) ? drawable.material : [material]
      saved = drawn.map((entry) => ({ material: entry, planes: entry.clippingPlanes }))
      for (const entry of drawn) entry.clippingPlanes = planes
    }
    drawable.onAfterRender = (renderer, scene, camera, geometry, material, group) => {
      previousAfter.call(drawable, renderer, scene, camera, geometry, material, group)
      for (const entry of saved) entry.material.clippingPlanes = entry.planes
      saved = []
    }
  }

  return {
    setView(mode, camera) {
      isCutting = mode === 'first' && camera !== null
      viewCamera = camera
    },
  }
}
