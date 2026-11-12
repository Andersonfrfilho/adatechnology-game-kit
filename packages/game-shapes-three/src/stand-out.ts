import type * as THREE_NS from 'three'
import { coincidentFaces } from '@adatechnology/game-shapes'
import type { CoincidentFaceHit } from '@adatechnology/game-shapes'

import { meshBatchesOf } from './coincident'

export interface StandOutOptions {
  /** How far a fighting face of the smaller piece moves out, in metres. Default 0.002 (CLAUDE.md §13). */
  readonly gap?: number
  /** Rounds of check-and-move; a moved face can meet a third piece. Default 3. */
  readonly rounds?: number
}

export interface StandOutReport {
  /** Meshes that were moved out. */
  readonly grown: number
  /** Face pairs still fighting after the last round (0 when it worked). */
  readonly left: number
}

/** How each side of a mesh's own box moves, `[-x, +x, -y, +y, -z, +z]`: 1 out, -1 in, 0 stays. */
type Sides = [number, number, number, number, number, number]

function localSize(mesh: THREE_NS.Mesh, out: THREE_NS.Vector3): THREE_NS.Vector3 {
  const geometry = mesh.geometry as THREE_NS.BufferGeometry
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  return geometry.boundingBox!.getSize(out)
}

/** Volume of the mesh's box in the world: the smaller of a fighting pair is the detail that moves. */
function volumeOf(mesh: THREE_NS.Mesh): number {
  const size = localSize(mesh, mesh.position.clone())
  const scale = mesh.getWorldScale(mesh.position.clone())
  return Math.max(Math.abs(size.x * scale.x), 1e-4) * Math.max(Math.abs(size.y * scale.y), 1e-4) * Math.max(Math.abs(size.z * scale.z), 1e-4)
}

/** Marks the side of the mesh's box that faces along the world normal of the hit, to go out (1) or in (-1). */
function markSide(mesh: THREE_NS.Mesh, hit: CoincidentFaceHit, sides: Sides, way: 1 | -1): void {
  const inverse = mesh.getWorldQuaternion(mesh.quaternion.clone()).invert()
  const n = mesh.position.clone().set(hit.normal[0], hit.normal[1], hit.normal[2]).applyQuaternion(inverse)
  const scale = mesh.getWorldScale(mesh.position.clone())
  const local = [n.x * Math.sign(scale.x || 1), n.y * Math.sign(scale.y || 1), n.z * Math.sign(scale.z || 1)]
  const axis = local.reduce((best, v, i) => (Math.abs(v) > Math.abs(local[best]!) ? i : best), 0)
  sides[axis * 2 + (local[axis]! > 0 ? 1 : 0)] = way
}

/** Moves the marked sides of the mesh's box `gap` metres out or in (in the world), keeping the other sides where they are. */
function pushSides(mesh: THREE_NS.Mesh, sides: Sides, gap: number): void {
  const size = localSize(mesh, mesh.position.clone())
  const world = mesh.getWorldScale(mesh.position.clone())
  const shift = mesh.position.clone().set(0, 0, 0)
  const scale = [mesh.scale.x, mesh.scale.y, mesh.scale.z]
  const extent = [size.x, size.y, size.z]
  const worldScale = [Math.abs(world.x), Math.abs(world.y), Math.abs(world.z)]
  const centre = mesh.geometry.boundingBox!.getCenter(mesh.position.clone())
  const centres = [centre.x, centre.y, centre.z]
  for (let axis = 0; axis < 3; axis++) {
    const minus = sides[axis * 2]! * gap, plus = sides[axis * 2 + 1]! * gap
    const s = extent[axis]! * worldScale[axis]!
    if ((!minus && !plus) || s < 1e-6 || s + minus + plus < s / 2) continue
    const oldScale = scale[axis]!
    scale[axis] = (oldScale * (s + minus + plus)) / s
    // in the parent's frame the centre moves by half the difference of the two sides, so a side that is not marked stays where it was
    const parentPerWorld = oldScale / worldScale[axis]!
    const outward = ((plus - minus) / 2) * parentPerWorld
    const recentre = centres[axis]! * (oldScale - scale[axis]!)
    shift.setComponent(axis, outward + recentre)
  }
  mesh.scale.set(scale[0]!, scale[1]!, scale[2]!)
  mesh.position.add(shift.applyQuaternion(mesh.quaternion))
  mesh.updateMatrixWorld(true)
}

/**
 * Makes the faces of `root` stop fighting: of each pair of meshes with coincident faces, the face of the smaller one (the label, band, rim
 * or lining) moves `gap` out of the bigger one, the rule of `CLAUDE.md` §13 ("a detail stands out at least 2 mm"). Only the sides that
 * fight move. For pieces ported as they were drawn, where the detail sits flush on its body; a builder of the kit draws the gap itself.
 * Instanced meshes are left alone.
 */
export function standOutCoincident(root: THREE_NS.Object3D, options: StandOutOptions = {}): StandOutReport {
  const gap = options.gap ?? 0.002
  const grown = new Set<THREE_NS.Mesh>()
  const volumes = new Map<THREE_NS.Mesh, number>()
  const volume = (mesh: THREE_NS.Mesh): number => volumes.get(mesh) ?? volumes.set(mesh, volumeOf(mesh)).get(mesh)!
  let left = 0
  for (let round = 0; round < (options.rounds ?? 3); round++) {
    const { batches, meshes } = meshBatchesOf(root)
    const hits = coincidentFaces(batches, { maxHits: Number.POSITIVE_INFINITY })
    left = hits.length
    if (!left) break
    const toPush = new Map<THREE_NS.Mesh, Sides>()
    for (const hit of hits) {
      const a = meshes[hit.batchA]!, b = meshes[hit.batchB]!
      const [smaller, bigger] = volume(a) <= volume(b) ? [a, b] : [b, a]
      // a piece moves once: when the detail already stood out, the piece it now meets moves instead (a piece never grows twice)
      const mesh = grown.has(smaller) ? bigger : smaller
      if (grown.has(mesh) || (mesh as THREE_NS.InstancedMesh).isInstancedMesh) continue
      const sides = toPush.get(mesh) ?? [0, 0, 0, 0, 0, 0]
      markSide(mesh, hit, sides, 1)
      toPush.set(mesh, sides)
    }
    for (const [mesh, sides] of toPush) {
      pushSides(mesh, sides, gap)
      grown.add(mesh)
    }
  }
  return { grown: grown.size, left }
}
