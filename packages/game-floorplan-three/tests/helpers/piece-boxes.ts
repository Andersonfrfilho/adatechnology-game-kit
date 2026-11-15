import type { House } from '../../src'
import { THREE } from './houses'

/** The boxes a piece is drawn with: the vertices of its ranges joined by the triangles they share (each box of the piece has vertices of its own), in world space. */
export const pieceBoxes = (house: House, id: string): THREE.Box3[] => {
  const boxes: THREE.Box3[] = []
  for (const item of house.structure.meshesOf(id)) {
    if (!item.mesh) continue
    const index = item.mesh.geometry.getIndex()!.array
    const position = item.mesh.geometry.getAttribute('position')
    const parent = new Map<number, number>()
    const find = (v: number): number => {
      let root = v
      while (parent.get(root) !== root) root = parent.get(root) ?? root
      return root
    }
    for (let i = item.i0; i < item.i1; i += 3) {
      for (let k = 0; k < 3; k++) if (!parent.has(index[i + k]!)) parent.set(index[i + k]!, index[i + k]!)
      parent.set(find(index[i + 1]!), find(index[i]!))
      parent.set(find(index[i + 2]!), find(index[i]!))
    }
    const byRoot = new Map<number, THREE.Box3>()
    item.mesh.updateWorldMatrix(true, false)
    for (const vertex of parent.keys()) {
      const root = find(vertex)
      const box = byRoot.get(root) ?? new THREE.Box3()
      byRoot.set(root, box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, vertex).applyMatrix4(item.mesh.matrixWorld)))
    }
    boxes.push(...byRoot.values())
  }
  return boxes
}

/** The depth two boxes overlap by on their shallowest axis (m): positive when they share volume, negative the gap when they do not. */
export const overlapOf = (a: THREE.Box3, b: THREE.Box3): number =>
  Math.min(a.max.x - b.min.x, b.max.x - a.min.x, a.max.y - b.min.y, b.max.y - a.min.y, a.max.z - b.min.z, b.max.z - a.min.z)
