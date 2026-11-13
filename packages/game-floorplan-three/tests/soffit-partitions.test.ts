import { describe, expect, it } from 'vitest'

import { coincidentFaces } from '../../game-shapes/src'
import type { CoincidentBatch } from '../../game-shapes/src'
import type { StructurePart } from '@adatechnology/game-floorplan-structure'

import { houseOf, planOf, THREE } from './helpers/houses'

/** Faces this near one plane, facing the same way, fight for the same pixels (the 5 mm between the beam's and the partition's faces did). */
const NEAR_PLANE = 0.006

/** Every shown triangle whose box meets `box` (world, metres), one batch per mesh. */
function trianglesNear(root: THREE.Object3D, box: THREE.Box3): CoincidentBatch[] {
  const batches: CoincidentBatch[] = []
  const shown = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true }
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !shown(mesh)) return
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex(), count = index ? index.count : position.count
    const out: number[] = []
    for (let k = 0; k < count; k += 3) {
      for (let j = 0; j < 3; j++) v[j]!.fromBufferAttribute(position, index ? index.getX(k + j) : k + j).applyMatrix4(mesh.matrixWorld)
      if (new THREE.Box3().setFromPoints(v).intersectsBox(box)) for (const p of v) out.push(p.x, p.y, p.z)
    }
    if (out.length) batches.push({ positions: out, label: `${mesh.name}#${mesh.uuid.slice(0, 6)}` })
  })
  return batches
}

describe('a partition cut under an eave beam is drawn as the structure has it', () => {
  it('high_end_contemporary {floors: 3}: the partitions under eave_beam_1_0 stop at its soffit on screen, and no face there fights another', () => {
    const plan = planOf('high_end_contemporary', 1, 'normal', { floors: 3 })
    const parts = plan.structure.parts as StructurePart[]
    const beam = parts.find((p) => p.id === 'eave_beam_1_0')!
    const cut = parts.filter((p) => p.soffit === beam.id)
    expect(cut.map((p) => p.id).sort()).toEqual(['wall_1_38', 'wall_1_39'])
    // (the masonry over their door is laid after them, up to their cut top)
    for (const wall of [...cut, parts.find((p) => p.id === 'wall_1_over_d1_7')!]) expect(wall.y1).toBeCloseTo(beam.y0, 3)
    const { house } = houseOf(plan as never, {}, { quality: 'game' })
    house.group.updateMatrixWorld(true)
    // the drawn wall: what rises from the storey's floor in the partitions' plan (their faces, of whatever thickness the drawing gives them) stops at the
    // structure's top; the beam's own faces start at its soffit
    const [x0, x1] = [Math.min(...cut.map((w) => w.aabb[0])), Math.max(...cut.map((w) => w.aabb[2]))]
    // (clear of the walls across the beam's ends)
    const rising = trianglesNear(house.group, new THREE.Box3(new THREE.Vector3(x0 + 0.005, beam.y0 - 1, beam.aabb[1] + 0.2), new THREE.Vector3(x1 - 0.005, beam.y1, beam.aabb[3] - 0.2)))
    let wallTop = -Infinity
    for (const { positions } of rising) {
      for (let k = 0; k < positions.length; k += 9) {
        const ys = [positions[k + 1]!, positions[k + 4]!, positions[k + 7]!]
        if (Math.min(...ys) < beam.y0 - 0.3) wallTop = Math.max(wallTop, ...ys)
      }
    }
    expect(wallTop).toBeGreaterThan(beam.y0 - 1)
    expect(wallTop).toBeLessThanOrEqual(beam.y0 + 0.001)
    // and around the beam, no two faces on (nearly) one plane facing the same way overlap
    const around = trianglesNear(house.group, new THREE.Box3(new THREE.Vector3(beam.aabb[0] - 0.05, beam.y0 - 0.3, beam.aabb[1] + 0.3), new THREE.Vector3(beam.aabb[2] + 0.05, beam.y1 - 0.01, beam.aabb[3] - 0.3)))
    expect(coincidentFaces(around, { eps: NEAR_PLANE }).map((hit) => `${hit.labelA} / ${hit.labelB} at ${hit.point.map((x) => x.toFixed(2)).join(',')}`)).toEqual([])
  })
})
