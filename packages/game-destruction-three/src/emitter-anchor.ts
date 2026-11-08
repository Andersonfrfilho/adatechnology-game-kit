import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { MeshVis } from './internal'

/**
 * Where a lasting emitter (grit trickling off a broken face) sits on the mesh it came off, in that mesh's own space: it goes wherever the mesh goes
 * (the object tips, a loose group falls as a piece of its own), never left pouring where the object stood. `mv.mesh` is read each time, so a part
 * moved to a mesh of its own (`Visuals.extract`, same space) keeps it.
 */
export interface EmitterAnchor {
  readonly mv: MeshVis
  readonly local: Vec3
  readonly localNormal: Vec3
}

type ThreeMath = Pick<typeof THREE_NS, 'Vector3' | 'Matrix4'>

export function anchorOnMesh(THREE: ThreeMath, mv: MeshVis, point: Vec3, normal: Vec3): EmitterAnchor {
  mv.mesh.updateWorldMatrix(true, false)
  const inverse = new THREE.Matrix4().copy(mv.mesh.matrixWorld).invert()
  const local = new THREE.Vector3(point[0], point[1], point[2]).applyMatrix4(inverse)
  const localNormal = new THREE.Vector3(normal[0], normal[1], normal[2]).transformDirection(inverse)
  return { mv, local: [local.x, local.y, local.z], localNormal: [localNormal.x, localNormal.y, localNormal.z] }
}

function inScene(object: THREE_NS.Object3D): boolean {
  let top = object
  while (top.parent) top = top.parent
  return (top as THREE_NS.Scene).isScene === true
}

/**
 * Writes where the anchor is now (world point, world normal). False when there is nothing left to emit from: the mesh is no longer shown (the part
 * broke into fragments, burnt away) or no longer in a scene (restored away, discarded).
 */
export function anchorWorld(anchor: EmitterAnchor, shown: boolean, point: THREE_NS.Vector3, normal: THREE_NS.Vector3): boolean {
  const mesh = anchor.mv.mesh
  if (!shown || !inScene(mesh)) return false
  mesh.updateWorldMatrix(true, false)
  point.set(anchor.local[0], anchor.local[1], anchor.local[2]).applyMatrix4(mesh.matrixWorld)
  normal.set(anchor.localNormal[0], anchor.localNormal[1], anchor.localNormal[2]).transformDirection(mesh.matrixWorld)
  return true
}
