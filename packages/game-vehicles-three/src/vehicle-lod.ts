import { markKitOrigin } from '@adatechnology/game-contracts'

import { fuse, liteMaterials, liteMeshes } from './lite'
import { primaryPaint } from './build'

/** Past this distance (m) an untouched vehicle draws fused: nobody sees a door seam from here, and the full model costs hundreds of draw calls. */
export const VEHICLE_LOD_DISTANCE = 14
/** Frames the full model stays on after it is built: its geometry reaches the GPU now, and not in the frame someone walks up to it. */
const WARM_FRAMES = 3

export type VehicleLod = {
  /** `touched`: hit or driven, from now on it always draws in full (its damage only exists there); `posed`: a door, hood or lid is open now (fused only while all are shut). */
  update(distance: number, touched: boolean, posed?: boolean): void
  readonly fused: boolean
  dispose(): void
}

const isShown = (object: any, top: any): boolean => {
  for (let node = object; node && node !== top; node = node.parent) if (node.visible === false) return false
  return true
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
    // a painted texture (a livery, a lettering) does not survive the fusion into vertex colours: those meshes stay as they are, drawn from the same geometry
    const textured: any[] = []
    full.traverse((object: any) => {
      if (!object.isMesh || object.userData.skipLite || !isShown(object, full)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.some((material: any) => material?.map && !/plate/i.test(material.name ?? '')) && !/plate/i.test(object.name ?? '')) textured.push(object)
    })
    for (const mesh of textured) mesh.userData.skipLite = true
    const fusion = fuse(THREE, { ...context, vehicle: full }, inverse, null, primaryPaint(context), kit.lodHiddenMaterials())
    for (const mesh of textured) delete mesh.userData.skipLite
    const group = new THREE.Group()
    group.name = 'vehicle-lite'
    markKitOrigin(group, { owner: 'game-vehicles-three', kind: 'vehicle', id: root.name })
    for (const mesh of liteMeshes(THREE, fusion, liteMaterials(THREE, kit.studioEnvironment()))) group.add(mesh)
    for (const mesh of textured) {
      const copy = new THREE.Mesh(mesh.geometry, mesh.material)
      copy.matrixAutoUpdate = false
      copy.matrix.multiplyMatrices(inverse, mesh.matrixWorld)
      copy.castShadow = mesh.castShadow
      copy.receiveShadow = mesh.receiveShadow
      group.add(copy)
    }
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
    update(distance, touched, posed = false) {
      isLocked ||= touched
      if (isLocked || posed) return show(false)
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
