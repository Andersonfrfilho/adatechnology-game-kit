import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '../src'
import { DOOR_SHELL_DEPTH, doorShell, openEdgeCount } from '../src/destructible/door-shell'
import { makeKit } from './helpers/kit'

/** A curved strip of skin, as the cut leaves it: a grid of triangles bulging out across the car, open on all four edges. */
function curvedSkin(side: number): number[] {
  const out: number[] = []
  const at = (i: number, j: number): [number, number, number] => [i * 0.1, j * 0.1, side * (0.9 + 0.03 * Math.sin((j / 6) * Math.PI))]
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 6; j++) {
      const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]
      out.push(...a, ...b, ...c, ...a, ...c, ...d)
    }
  }
  return out
}

const visibleMeshesIn = (root: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = []
  root.traverseVisible((object: THREE.Object3D) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh)
  })
  return meshes
}

/** Every triangle of the meshes, in the frame of `frame`. */
function trianglesOf(meshes: THREE.Mesh[], frame: THREE.Object3D): number[] {
  const inverse = new THREE.Matrix4().copy(frame.matrixWorld).invert()
  const out: number[] = []
  const v = new THREE.Vector3()
  for (const mesh of meshes) {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) out.push(...v.fromBufferAttribute(position, i).applyMatrix4(matrix).toArray())
  }
  return out
}

/** Mean depth across the car (z) of the meshes' corners, in the frame of `frame`. */
function meanAcross(meshes: THREE.Mesh[], frame: THREE.Object3D): number {
  const points = trianglesOf(meshes, frame)
  let sum = 0
  for (let k = 2; k < points.length; k += 3) sum += points[k]!
  return sum / (points.length / 3)
}

describe('a door is a closed volume with depth', () => {
  it('closes an open skin: the fold covers every free edge and the inner panel stands the depth behind it', () => {
    for (const side of [-1, 1]) {
      const skin = curvedSkin(side)
      expect(openEdgeCount(skin)).toBeGreaterThan(0)
      const shell = doorShell({ positions: skin, side })
      expect(openEdgeCount([...skin, ...shell.flange, ...shell.inner])).toBe(0)
      // each triangle moved in by the depth (its corners in reversed order: it faces into the car)
      for (let t = 0; t < skin.length; t += 9) {
        const across = (points: ArrayLike<number>): number => (points[t + 2]! + points[t + 5]! + points[t + 8]!) / 3
        expect(across(skin) - across(shell.inner)).toBeCloseTo(side * DOOR_SHELL_DEPTH, 6)
      }
    }
    expect(DOOR_SHELL_DEPTH).toBeGreaterThanOrEqual(0.08)
    expect(DOOR_SHELL_DEPTH).toBeLessThanOrEqual(0.12)
  })

  it('every door of a car, once open, is its skin closed by the fold and the inner panel, with no card short of its edge', () => {
    const kit = makeKit()
    const item = buildVehicleItem(kit, 'proto')
    const d = createVehicleDestructible(kit, item.vehicle, { id: 'proto_shell', frame: item.root })
    const doors = d.describe().parts.map((part) => part.id).filter((id) => /^door_/.test(id))
    expect(doors.length).toBeGreaterThanOrEqual(2)
    const vehicle = d.vehicle.vehicle as THREE.Object3D
    for (const id of doors) {
      const piv = item.root.getObjectByName(id)!
      piv.rotation.set(0, 0.8, 0)
      piv.rotation.set(0, 0, 0)
      item.root.updateMatrixWorld(true)
      const meshes = visibleMeshesIn(piv)
      const fold = meshes.filter((mesh) => mesh.userData.doorShell === 'fold')
      const inner = meshes.filter((mesh) => mesh.userData.doorShell === 'inner')
      expect([fold.length, inner.length], id).toEqual([1, 1])
      // the skin is what the door took off the body; with the fold and the inner panel it closes, with no edge left open
      const skin = meshes.filter((mesh) => mesh.userData.doorSkin)
      expect(skin.length, id).toBeGreaterThan(0)
      expect(openEdgeCount(trianglesOf([...skin, ...fold, ...inner], vehicle)), id).toBe(0)
      // the inner panel stands the door's depth behind the skin across the car
      // (the paint on the door also draws small parts that follow it, the handle's base, so the means only frame the depth)
      const depth = Math.abs(meanAcross(skin, vehicle) - meanAcross(inner, vehicle))
      expect(depth, id).toBeGreaterThanOrEqual(0.08)
      expect(depth, id).toBeLessThanOrEqual(0.12)
      // the flat card of the old construction (inset from the edge, short of it) is gone from the door
      expect(meshes.filter((mesh) => !mesh.userData.doorShell && mesh.geometry.type === 'BufferGeometry' && (mesh.material as THREE.MeshStandardMaterial).color?.getHexString() === '3b3e42'), id).toEqual([])
    }
  })
})
