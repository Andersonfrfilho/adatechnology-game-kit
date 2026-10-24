import { generate } from '@adatechnology/game-shapes'
import { describe, expect, it } from 'vitest'

import { create, createShapeRecorder, TYPE_DEFS } from '../src'
import { stubDocument } from './helpers'

const props = create(undefined, { document: stubDocument() })

describe('createShapeRecorder', () => {
  it('draws every builder into a valid schema that game-shapes bakes', () => {
    for (const def of TYPE_DEFS) {
      const recorder = createShapeRecorder({ name: def.id })
      props.builders[def.id]({ w: def.w, d: def.d, h: def.h, seed: 'rec', x: 1, z: 2, ry: 0.3 }, recorder.api)
      const buffers = generate(recorder.schema())
      expect(buffers.stats.triangles, def.id).toBeGreaterThan(0)
      expect(buffers.name).toBe(def.id)
    }
  })

  it('one frame group per run of the same item, unit templates, parts and lights', () => {
    const recorder = createShapeRecorder({ cylinderSegments: 8, sphereSegments: [8, 6] })
    const M = { x: 1, z: -2, ry: 0.5 }
    recorder.api.box(M, 'wood', 0, 0, 0, 1, 2, 3, 0x886644, 0, 0, 0)
    recorder.api.cylinder(M, 'metal', 0, 0, 0, 0.1, 1, 0x999999, 0, 0, 'cone')
    recorder.api.cylinder({ x: 0 }, 'metal', 0, 1, 0, 0.2, 0.4, 0x999999, 0, 0, 'sphere')
    recorder.api.part('door', [0.5, 0, 0], 0.2, () => {
      recorder.api.plane(M, 'atlas_picture', 0, 1, 0, 1, 1, 0xffffff, 0, 0, 0, { u0: 0.5, v0: 0, u1: 1, v1: 0.5 })
      recorder.api.light(M, 0, 2, 0, 0xffeedd, 4, 'lamp')
    })
    recorder.api.part('door', [9, 9, 9], 1, () => recorder.api.leaf(M, 0, 0, 0, 0.1, 0.2, 0x228833, 0, 0.3))
    const root = recorder.schema().root as unknown as { children: Array<Record<string, any>> }
    expect(root.children.map((c) => c.part ?? c.heading)).toEqual([0.5, 0, 'door'])
    expect(root.children[0]!.children.map((c: { kind: string }) => c.kind)).toEqual(['box', 'cylinder'])
    expect(root.children[0]!.children[0]).toMatchObject({ position: [0, 1, 0], scale: [1, 2, 3], rotationOrder: 'YXZ' })
    expect(root.children[0]!.children[1]).toMatchObject({ radiusTop: 0, radiusBottom: 1, radialSegments: 8 })
    expect(root.children[1]!.children[0]).toMatchObject({ kind: 'sphere', widthSegments: 8, heightSegments: 6, position: [0, 1.2, 0], scale: [0.2, 0.2, 0.2] })
    // the second call of a part draws into the first one, at the first pivot
    expect(recorder.parts).toEqual([{ id: 'door', pivot: [0.5, 0, 0], ry: 0.2 }])
    const door = root.children[2]!
    expect(door.children.map((c: { children: Array<{ kind: string }> }) => c.children.map((n) => n.kind))).toEqual([['plane', 'point', 'mesh']]) // same item frame, last in the part: shared
    const buffers = generate(recorder.schema())
    expect(buffers.points).toEqual([{ part: 'door', position: buffers.points[0]!.position, data: { light: true, color: 0xffeedd, range: 4, kind: 'lamp' } }])
    expect(buffers.levels[0]!.batches.map((b) => `${b.part}:${b.material}`)).toEqual(['null:wood', 'null:metal', 'door:atlas_picture', 'door:plant'])
  })
})
