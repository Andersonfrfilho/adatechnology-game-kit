// The wires of an object (conduit runs, cables, cords, drops: `ObjectSpec.wires`) as thin tubes. The kit's builders leave them to the host ("the host draws them
// as thin tubes"); a house folds them into its own batches, any other host takes these meshes.
import { createCord } from '@adatechnology/game-shapes-three'
import type { ObjectSpec } from '@adatechnology/game-interactables'

import type { ThreeLib, ThreeNS } from './types'

type Wire = NonNullable<ObjectSpec['wires']>[number]

/** The colour each kind of wire is drawn in (a grey PVC conduit, a black cable, a dark cord). */
export const WIRE_COLORS: Readonly<Record<Wire['kind'], number>> = { conduit: 0xcfcdc4, cable: 0x2a2724, drop: 0x151515, cord: 0x1b1b1d }
/** Radius a wire is drawn with when its spec gives none, metres. */
export const WIRE_RADIUS = 0.006

/** One tube per wire with two points or more, named by the wire's id, in the object's own space. */
export function wireMeshes(THREE: ThreeLib, wires: ObjectSpec['wires']): ThreeNS.Mesh[] {
  const meshes: ThreeNS.Mesh[] = []
  for (const wire of wires ?? []) {
    if (wire.points.length < 2) continue
    const material = new THREE.MeshStandardMaterial({ color: WIRE_COLORS[wire.kind], roughness: 0.8 })
    const mesh = createCord(THREE, wire.points, wire.radius ?? WIRE_RADIUS, material)
    mesh.name = wire.id
    meshes.push(mesh)
  }
  return meshes
}
