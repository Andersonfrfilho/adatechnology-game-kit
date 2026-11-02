import { fuse, liteMaterials, liteMeshes } from './lite'
import { primaryPaint } from './build'

/** Past this distance (m) an untouched vehicle draws fused: nobody sees a door seam from here, and the full model costs hundreds of draw calls. */
export const VEHICLE_LOD_DISTANCE = 14
/** Frames the full model stays on after it is built: its geometry reaches the GPU now, and not in the frame someone walks up to it. */
const WARM_FRAMES = 3

export type VehicleLod = {
  /** `touched`: hit, opened or driven, from now on it always draws in full (its damage only exists there). */
  update(distance: number, touched: boolean): void
  readonly fused: boolean
  dispose(): void
}

/** Shows `full` near and the kit's fused light mode (one mesh per class of material) far, in `root`'s own space. Hit tests read the full model, visible or not. */
export function createVehicleLod(kit: any, context: any, root: any, full: any): VehicleLod {
  const THREE = kit.THREE
  let frames = 0
  let lite: any = null
  let isFused = false
  let isLocked = false
  const build = (): any => {
    root.updateMatrixWorld(true)
    const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const fusion = fuse(THREE, { ...context, vehicle: full }, inverse, null, primaryPaint(context), kit.lodHiddenMaterials())
    const group = new THREE.Group()
    group.name = 'vehicle-lite'
    for (const mesh of liteMeshes(THREE, fusion, liteMaterials(THREE, kit.studioEnvironment()))) group.add(mesh)
    root.add(group)
    return group
  }
  const show = (shouldFuse: boolean): void => {
    if (shouldFuse === isFused) return
    isFused = shouldFuse
    full.visible = !shouldFuse
    if (lite) lite.visible = shouldFuse
  }
  return {
    update(distance, touched) {
      isLocked ||= touched
      if (isLocked) return show(false)
      if (++frames <= WARM_FRAMES) return
      const shouldFuse = distance > (isFused ? VEHICLE_LOD_DISTANCE * 0.9 : VEHICLE_LOD_DISTANCE)
      if (shouldFuse && !lite) lite = build()
      show(shouldFuse)
    },
    get fused() {
      return isFused
    },
    dispose() {
      show(false)
      if (!lite) return
      lite.removeFromParent()
      lite.traverse((object: any) => object.geometry?.dispose())
      lite = null
    },
  }
}
