import type * as THREE_NS from 'three'
import type { StructurePart } from '@adatechnology/game-floorplan-structure'
import type { Three } from '../kernel-types.js'

export function addInclinedTimber(
  THREE: Three,
  parent: THREE_NS.Group,
  p0: readonly [number, number, number],
  p1: readonly [number, number, number],
  radius: number,
  mat: THREE_NS.Material,
  partId?: string,
): void {
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const dz = p1[2] - p0[2]
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-3) return
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), mat)
  mesh.position.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2)
  const up = new THREE.Vector3(0, 1, 0)
  const dir = new THREE.Vector3(dx / len, dy / len, dz / len)
  mesh.quaternion.setFromUnitVectors(up, dir)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (partId) mesh.userData.structurePartId = partId
  parent.add(mesh)
}

export function addRafter(
  THREE: Three,
  parent: THREE_NS.Group,
  p: StructurePart,
  mat: THREE_NS.Material,
): void {
  const [u0, v0, u1, v1] = p.aabb
  const spanU = u1 - u0
  const spanV = v1 - v0
  const radius = 0.04
  const isSideA = p.id.includes('_a_') || p.id.endsWith('_a')
  const overhang = 0.40

  // Recess rafters slightly below tile envelope so they sit cleanly under the roof tiles
  const yEave = p.y0 - 0.04
  const yRidge = p.y1 - 0.06

  if (spanV >= spanU) {
    const cx = (u0 + u1) / 2
    const zEave = isSideA ? v0 : v1
    const zRidge = isSideA ? v1 : v0
    // Wall bearing point: inside the house envelope (not sticking out into the gutter/facade)
    const zWall = isSideA ? v0 + overhang : v1 - overhang

    // Inclined rafter running under the roof slope
    addInclinedTimber(THREE, parent, [cx, yEave, zEave], [cx, yRidge, zRidge], radius, mat, p.id)
    // Horizontal truss tie beam resting safely on the wall bearing (never protruding through facade)
    addInclinedTimber(THREE, parent, [cx, p.y0 - 0.02, zWall], [cx, p.y0 - 0.02, zRidge], 0.03, mat)
    // King post (pontalete vertical) from tie beam to ridge
    addInclinedTimber(THREE, parent, [cx, p.y0 - 0.02, zRidge], [cx, yRidge, zRidge], 0.03, mat)
  } else {
    const cz = (v0 + v1) / 2
    const xEave = isSideA ? u0 : u1
    const xRidge = isSideA ? u1 : u0
    const xWall = isSideA ? u0 + overhang : u1 - overhang

    // Inclined rafter running under the roof slope
    addInclinedTimber(THREE, parent, [xEave, yEave, cz], [xRidge, yRidge, cz], radius, mat, p.id)
    // Horizontal truss tie beam resting safely on the wall bearing
    addInclinedTimber(THREE, parent, [xWall, p.y0 - 0.02, cz], [xRidge, p.y0 - 0.02, cz], 0.03, mat)
    // King post (pontalete vertical) from tie beam to ridge
    addInclinedTimber(THREE, parent, [xRidge, p.y0 - 0.02, cz], [xRidge, yRidge, cz], 0.03, mat)
  }
}

export function addRidgeBeam(
  THREE: Three,
  parent: THREE_NS.Group,
  p: StructurePart,
  mat: THREE_NS.Material,
): void {
  const [u0, v0, u1, v1] = p.aabb
  const cx = (u0 + u1) / 2
  const cz = (v0 + v1) / 2
  const y = p.y1 - 0.08
  const radius = 0.045
  if (u1 - u0 >= v1 - v0) {
    addInclinedTimber(THREE, parent, [u0, y, cz], [u1, y, cz], radius, mat, p.id)
  } else {
    addInclinedTimber(THREE, parent, [cx, y, v0], [cx, y, v1], radius, mat, p.id)
  }
}
