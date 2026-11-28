import type { Three, THREE_NS } from '../three'
import type { AvatarViewMode } from './head-hiding'

export type EyeClip = {
  setView(mode: AvatarViewMode, camera: THREE_NS.Object3D | null): void
}

export type EyeClipOptions = {
  /** What is cut: the trunk (torso, shoulders, arms, hips). The legs stay whole, as a person looking down sees them. */
  readonly roots: readonly THREE_NS.Object3D[]
  /** The eye socket the first-person camera sits at. */
  readonly eye: THREE_NS.Object3D
  /** The object whose +z is the body's front (the upper body, so a lean or a lie turns the plane with it). */
  readonly front: THREE_NS.Object3D
  /** Metres behind the eye the plane stands (0: at the eyes): what is in front of it shows, the shoulders and the back do not. */
  readonly behind: number
  /**
   * What only the lens cuts: the legs, whole otherwise. Any part of the body (these and the trunk) closer to the camera than its near plane plus `nearMargin` is not
   * drawn for it: the near plane would slice it into a sliver across the view (a thigh seen edge-on as a thin line from the middle of the screen down).
   */
  readonly lensRoots?: readonly THREE_NS.Object3D[]
  /** Metres past the camera's near plane the lens cut stands (default `LENS_MARGIN`). */
  readonly nearMargin?: number
}

/** The lens cut stands this far past the near plane, metres: a part that close is a blur of colour at best, a sliver at worst. */
export const LENS_MARGIN = 0.06

type Drawable = THREE_NS.Object3D & { material?: THREE_NS.Material | THREE_NS.Material[] }
type Saved = { material: THREE_NS.Material; planes: THREE_NS.Plane[] | null }

const isDrawable = (object: THREE_NS.Object3D): boolean => {
  const flagged = object as THREE_NS.Object3D & { isMesh?: boolean; isSprite?: boolean; isPoints?: boolean }
  return Boolean(flagged.isMesh || flagged.isSprite || flagged.isPoints)
}

/**
 * Cuts the body at a plane just behind the eyes, for one camera: what a real head hides from its own eyes (the tops of the shoulders, the collar, the
 * back) is not drawn, so a look down shows the front of the chest and the legs instead of the shirt seen from above as a ring around the camera. The plane
 * goes on the materials only while that camera draws them (`clippingPlanes`, world space) and comes off after, so shadows, mirrors and the third person
 * keep the whole body. The renderer's `localClippingEnabled` is switched on the first time: it takes effect from the next frame. A second cut, at the lens
 * (`lensRoots`), keeps every part of the body out of the camera's near plane: a leg the eye stands right over never shows as a sliver across the view.
 */
export const createEyeClip = (THREE: Three, options: EyeClipOptions): EyeClip => {
  let isCutting = false
  let viewCamera: THREE_NS.Object3D | null = null
  const plane = new THREE.Plane()
  const lens = new THREE.Plane()
  const trunkPlanes = [plane, lens]
  const lensPlanes = [lens]
  const eyeAt = new THREE.Vector3()
  const front = new THREE.Vector3()
  const lensAt = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const margin = options.nearMargin ?? LENS_MARGIN
  const place = (camera: THREE_NS.Object3D): void => {
    options.eye.getWorldPosition(eyeAt)
    front.set(0, 0, 1).transformDirection(options.front.matrixWorld)
    plane.setFromNormalAndCoplanarPoint(front, eyeAt.addScaledVector(front, -options.behind))
    // the lens cut: what lies nearer the camera than its near plane and the margin, along where it looks
    camera.getWorldPosition(lensAt)
    camera.getWorldDirection(forward)
    const near = (camera as THREE_NS.Object3D & { near?: number }).near ?? 0
    lens.setFromNormalAndCoplanarPoint(forward, lensAt.addScaledVector(forward, near + margin))
  }
  const drawablesOf = (roots: readonly THREE_NS.Object3D[]): Drawable[] => {
    const drawables: Drawable[] = []
    for (const root of roots) root.traverse((object) => isDrawable(object) && drawables.push(object))
    return drawables
  }
  const materialsOf = (drawable: Drawable): THREE_NS.Material[] => (drawable.material ? (Array.isArray(drawable.material) ? drawable.material : [drawable.material]) : [])
  const trunk = drawablesOf(options.roots)
  const lensOnly = drawablesOf(options.lensRoots ?? [])
  // a material the trunk shares with the legs (the trousers) is drawn by three.js with the clipping it was last given while it stays the current material:
  // the legs drawn right after the hips would take the hips' cut. The legs get their own copy of it.
  const trunkMaterials = new Set(trunk.flatMap(materialsOf))
  for (const drawable of lensOnly) {
    const own = materialsOf(drawable).map((material) => (trunkMaterials.has(material) ? material.clone() : material))
    if (drawable.material) drawable.material = Array.isArray(drawable.material) ? own : own[0]!
  }
  const clipFor = (drawable: Drawable, planes: THREE_NS.Plane[]): void => {
    const previousBefore = drawable.onBeforeRender
    const previousAfter = drawable.onAfterRender
    let saved: Saved[] = []
    drawable.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      previousBefore.call(drawable, renderer, scene, camera, geometry, material, group)
      if (!isCutting || camera !== viewCamera) return
      renderer.localClippingEnabled = true
      place(camera)
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
  for (const drawable of trunk) clipFor(drawable, trunkPlanes)
  for (const drawable of lensOnly) clipFor(drawable, lensPlanes)

  return {
    setView(mode, camera) {
      isCutting = mode === 'first' && camera !== null
      viewCamera = camera
    },
  }
}
