import { describe, expect, it } from 'vitest'

import { generate, shapeKey } from '../src'
import type { ShapeBatch, ShapeNode, ShapeSchema, ShapeSolid } from '../src'

const shape = (root: ShapeNode): ShapeSchema => ({ version: 1, root })
const solidsOf = (root: ShapeNode): readonly ShapeSolid[] => generate(shape(root), { solids: true }).levels[0]!.batches.flatMap((batch) => batch.solids ?? [])

/** The point in the solid's own frame (the inverse of its turn, about its centre). */
const inFrame = (solid: ShapeSolid, x: number, y: number, z: number): [number, number, number] => {
  const [qx, qy, qz, qw] = solid.rotation
  const [px, py, pz] = [x - solid.center[0], y - solid.center[1], z - solid.center[2]]
  // q^-1 * p * q
  const [ix, iy, iz] = [-qx, -qy, -qz]
  const tx = 2 * (iy * pz - iz * py)
  const ty = 2 * (iz * px - ix * pz)
  const tz = 2 * (ix * py - iy * px)
  return [px + qw * tx + iy * tz - iz * ty, py + qw * ty + iz * tx - ix * tz, pz + qw * tz + ix * ty - iy * tx]
}
const holds = (solid: ShapeSolid, x: number, y: number, z: number, slack = 1e-4): boolean => inFrame(solid, x, y, z).every((v, k) => Math.abs(v) <= solid.half[k]! + slack)

/** Every vertex the solid says it added is inside it, and it is no bigger than they need (each face has a vertex on it). */
const hugsItsVertices = (batch: ShapeBatch, solid: ShapeSolid): void => {
  const reach = [0, 0, 0]
  for (let v = solid.vertexStart; v < solid.vertexStart + solid.vertexCount; v++) {
    const [x, y, z] = [batch.positions[v * 3]!, batch.positions[v * 3 + 1]!, batch.positions[v * 3 + 2]!]
    expect(holds(solid, x, y, z)).toBe(true)
    inFrame(solid, x, y, z).forEach((value, k) => (reach[k] = Math.max(reach[k]!, Math.abs(value))))
  }
  reach.forEach((value, k) => expect(value).toBeCloseTo(solid.half[k]!, 4))
}

describe('the solids of a batch (spec 019)', () => {
  it('without the option a batch has none, and the output and the key are what they were', () => {
    const root: ShapeNode = { kind: 'group', children: [{ kind: 'box', size: [1, 2, 3], position: [1, 0, 0] }, { kind: 'cylinder', radiusTop: 0.2, radiusBottom: 0.2, height: 1 }] }
    const plain = generate(shape(root))
    const withSolids = generate(shape(root), { solids: true })
    expect(plain.levels[0]!.batches.every((batch) => batch.solids === undefined)).toBe(true)
    expect(shapeKey(shape(root))).toBe(shapeKey(shape(root), {}))
    expect(shapeKey(shape(root), { solids: true })).not.toBe(shapeKey(shape(root)))
    for (const [i, batch] of plain.levels[0]!.batches.entries()) {
      const other = withSolids.levels[0]!.batches[i]!
      expect([...other.positions]).toEqual([...batch.positions])
      expect([...(other.indices ?? [])]).toEqual([...(batch.indices ?? [])])
    }
  })

  it('a box is its own box where it was put: one solid per box, in order, with the vertices it added', () => {
    const solids = solidsOf({ kind: 'group', children: [{ kind: 'box', size: [1, 2, 3], position: [4, 5, 6] }, { kind: 'box', size: [0.2, 0.2, 0.2] }] })
    expect(solids).toHaveLength(2)
    expect(solids[0]).toMatchObject({ kind: 'box', center: [4, 5, 6], half: [0.5, 1, 1.5], vertexStart: 0, vertexCount: 24 })
    expect(solids[0]!.fitted).toBeUndefined()
    expect(solids[1]).toMatchObject({ center: [0, 0, 0], vertexStart: 24, vertexCount: 24 })
    expect([...solids[1]!.half].map((h) => +h.toFixed(6))).toEqual([0.1, 0.1, 0.1])
  })

  it('boards round the air are the boards: the air between them is in none of the solids', () => {
    const board = (size: [number, number, number], position: [number, number, number]): ShapeNode => ({ kind: 'box', size, position })
    const solids = solidsOf({ kind: 'group', children: [board([0.7, 0.03, 0.7], [0, 0.015, 0]), board([0.03, 0.54, 0.64], [-0.335, 0.3, 0]), board([0.03, 0.54, 0.64], [0.335, 0.3, 0]), board([0.7, 0.54, 0.03], [0, 0.3, -0.335])] })
    expect(solids).toHaveLength(4)
    expect(solids.some((solid) => holds(solid, 0, 0.3, 0))).toBe(false)
    expect(solids.some((solid) => holds(solid, 0.335, 0.3, 0))).toBe(true)
  })

  it.each([
    ['turned', { rotation: [0.3, 0.7, -0.4] as [number, number, number] }],
    ['turned and scaled unevenly', { rotation: [1.1, 0, 0.5] as [number, number, number], scale: [2, 0.5, 3] as [number, number, number] }],
    ['inside turned groups', { rotation: [0, 0, 0.5] as [number, number, number] }],
    ['mirrored', { scale: [-1, 1, 1] as [number, number, number], rotation: [0.2, 0.4, 0] as [number, number, number] }],
  ])('a box %s keeps its own box, turned with it', (_name, transform) => {
    const out = generate(shape({ kind: 'group', rotation: [0.2, -0.6, 0.1], position: [1, 2, 3], children: [{ kind: 'box', size: [0.5, 0.03, 0.84], position: [0.1, 0.2, 0.3], ...transform }] }), { solids: true })
    const batch = out.levels[0]!.batches[0]!
    const solid = batch.solids![0]!
    expect(solid.fitted).toBeUndefined()
    expect(Math.hypot(...solid.rotation)).toBeCloseTo(1, 6)
    hugsItsVertices(batch, solid)
  })

  it('a round primitive is the box around that one primitive (2r x h x 2r), turned as it stands: four legs are four solids, with the air between them in none', () => {
    const leg = (x: number, z: number): ShapeNode => ({ kind: 'cylinder', radiusTop: 0.02, radiusBottom: 0.02, height: 0.4, position: [x, 0.2, z] })
    const out = generate(shape({ kind: 'group', children: [leg(-0.15, -0.15), leg(0.15, -0.15), leg(-0.15, 0.15), leg(0.15, 0.15), { kind: 'cylinder', radiusTop: 0.2, radiusBottom: 0.2, height: 0.03, position: [0, 0.415, 0] }] }), { solids: true })
    const batch = out.levels[0]!.batches[0]!
    expect(batch.solids).toHaveLength(5)
    expect(batch.solids![0]).toMatchObject({ kind: 'cylinder' })
    expect([...batch.solids![0]!.half].map((h) => +h.toFixed(3))).toEqual([0.02, 0.2, 0.02])
    for (const solid of batch.solids!) hugsItsVertices(batch, solid)
    // under the seat, between the legs
    expect(batch.solids!.some((solid) => holds(solid, 0, 0.2, 0))).toBe(false)
  })

  it('a movable part has its solids in its own space, in its own batch', () => {
    const out = generate(shape({ kind: 'group', children: [{ kind: 'box', size: [1, 1, 1] }, { kind: 'group', part: 'door', position: [5, 0, 0], children: [{ kind: 'box', size: [0.4, 0.8, 0.02], position: [0.2, 0.4, 0] }] }] }), { solids: true })
    const door = out.levels[0]!.batches.find((batch) => batch.part === 'door')!
    expect(door.solids).toHaveLength(1)
    expect(door.solids![0]).toMatchObject({ center: [0.2, 0.4, 0], vertexStart: 0 })
    expect([...door.solids![0]!.half].map((h) => +h.toFixed(3))).toEqual([0.2, 0.4, 0.01])
  })

  it('a sheared transform has no box of its own: the solid is the box around it along the batch, marked fitted, and still holds its vertices', () => {
    const out = generate(shape({ kind: 'group', rotation: [0, 0, 0.6], scale: [1, 3, 1], children: [{ kind: 'box', size: [1, 0.2, 0.5], rotation: [0, 0, 0.4] }] }), { solids: true })
    const batch = out.levels[0]!.batches[0]!
    const solid = batch.solids![0]!
    expect(solid.fitted).toBe(true)
    for (let v = 0; v < solid.vertexCount; v++) expect(holds(solid, batch.positions[v * 3]!, batch.positions[v * 3 + 1]!, batch.positions[v * 3 + 2]!)).toBe(true)
  })
})
