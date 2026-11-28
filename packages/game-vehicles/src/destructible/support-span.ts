import type { Matrix4, Mesh, Object3D } from '../three-types'

/** How far (m) above the lowest drawn point a mesh may start and still be what the vehicle stands on (a skid tube, a tyre, a gear leg's wheel). */
export const SUPPORT_BAND_M = 0.12

/** The stretch along x (the vehicle's own space) of what it stands on: the drawn meshes whose bottom is within `SUPPORT_BAND_M` of the lowest one. */
export interface SupportSpan {
  readonly rear: number
  readonly front: number
}

type Box = { readonly minX: number; readonly maxX: number; readonly minY: number }

/** The vehicle's support from its drawing, or undefined when nothing is drawn. Decals are paint, not structure. */
export function supportSpanOf(vehicle: Object3D, inverse: Matrix4): SupportSpan | undefined {
  const boxes: Box[] = []
  vehicle.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh || mesh.userData.decal || !mesh.geometry) return
    mesh.geometry.computeBoundingBox()
    const bounds = mesh.geometry.boundingBox
    if (!bounds) return
    const box = bounds.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse)
    if (box.isEmpty()) return
    boxes.push({ minX: box.min.x, maxX: box.max.x, minY: box.min.y })
  })
  if (boxes.length === 0) return undefined
  const ground = Math.min(...boxes.map((box) => box.minY))
  const resting = boxes.filter((box) => box.minY <= ground + SUPPORT_BAND_M)
  return { rear: Math.min(...resting.map((box) => box.minX)), front: Math.max(...resting.map((box) => box.maxX)) }
}
