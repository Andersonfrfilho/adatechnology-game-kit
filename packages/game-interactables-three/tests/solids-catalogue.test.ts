import type { ShapeSolid } from '@adatechnology/game-shapes'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { cases } from './catalog-cases'

/** How far (m) out of its solid a vertex may be: the float of the baked positions. */
const SLACK = 1e-3

/** The meshes of a built piece with the solids they carry. */
const meshesOf = (root: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = []
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) out.push(object as THREE.Mesh)
  })
  return out
}

/** What is wrong with the solids of a mesh, if anything: a vertex no solid holds, a vertex two solids claim, a vertex outside the solid that claims it. */
const faultsOf = (mesh: THREE.Mesh): string[] => {
  const solids = mesh.userData.solids as readonly ShapeSolid[] | undefined
  const positions = mesh.geometry.getAttribute('position')
  if (!solids) return [`${mesh.name}: no solids`]
  const out: string[] = []
  const claimed = new Uint8Array(positions.count)
  const turn = new THREE.Quaternion()
  const point = new THREE.Vector3()
  solids.forEach((solid, n) => {
    turn.set(solid.rotation[0], solid.rotation[1], solid.rotation[2], solid.rotation[3]).invert()
    let outside = 0
    for (let v = solid.vertexStart; v < solid.vertexStart + solid.vertexCount; v++) {
      claimed[v]!++
      point.set(positions.getX(v) - solid.center[0], positions.getY(v) - solid.center[1], positions.getZ(v) - solid.center[2]).applyQuaternion(turn)
      if (Math.abs(point.x) > solid.half[0] + SLACK || Math.abs(point.y) > solid.half[1] + SLACK || Math.abs(point.z) > solid.half[2] + SLACK) outside++
    }
    if (solid.vertexCount === 0) out.push(`${mesh.name}: solid ${n} (${solid.kind}) has no vertex`)
    if (outside > 0) out.push(`${mesh.name}: ${outside} vertices outside solid ${n} (${solid.kind})`)
  })
  const unclaimed = claimed.reduce((count, times) => count + (times === 0 ? 1 : 0), 0)
  const twice = claimed.reduce((count, times) => count + (times > 1 ? 1 : 0), 0)
  if (unclaimed > 0) out.push(`${mesh.name}: ${unclaimed} vertices in no solid`)
  if (twice > 0) out.push(`${mesh.name}: ${twice} vertices in two solids`)
  return out
}

// spec 019 A3: a physics engine holds a piece by the solids its mesh carries, so they must be the whole of what is drawn and nothing else
describe('every piece of the catalogue carries the solids it was drawn with', () => {
  it.each(cases)('%s: every mesh has its solids, each vertex in one of them and inside it', (_name, build) => {
    // a piece drawn with no mesh of the mesh api (a run of conduit is a cord) has nothing to carry
    const meshes = meshesOf(build())
    expect(meshes.flatMap(faultsOf)).toEqual([])
  })
})
