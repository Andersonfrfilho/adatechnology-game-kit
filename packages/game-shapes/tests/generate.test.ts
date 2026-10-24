import { describe, expect, it } from 'vitest'

import { SHAPE_SCHEMA, buildPrimitive, canonicalJson, cloneBuffers, generate, registerGenerator, shapeKey, transferablesOf, unregisterGenerator, validateShape } from '../src'
import type { ShapeNode, ShapeSchema } from '../src'
import schemaFile from '../schema/shape.schema.json'

const shape = (root: ShapeNode, extra: Partial<ShapeSchema> = {}): ShapeSchema => ({ version: 1, root, ...extra })
const box = (extra: Partial<Extract<ShapeNode, { kind: 'box' }>> = {}): ShapeNode => ({ kind: 'box', size: [1, 1, 1], ...extra })

describe('batches', () => {
  it('one batch per (part, material), static first, in order of first use', () => {
    const out = generate(
      shape({
        kind: 'group',
        children: [
          box({ material: 'wood' }),
          { kind: 'group', part: 'door', position: [0.5, 0, 0], rotation: [0, 0.3, 0], children: [box({ material: 'metal' }), box({ material: 'wood' })] },
          box({ material: 'metal' }),
          box({ material: 'wood' }),
        ],
      }),
    )
    const level = out.levels[0]!
    expect(level.batches.map((b) => `${b.part}:${b.material}`)).toEqual(['null:wood', 'null:metal', 'door:metal', 'door:wood'])
    expect(level.batches[0]!.positions.length).toBe(24 * 3 * 2)
    expect(out.parts).toEqual([expect.objectContaining({ id: 'door', position: [0.5, 0, 0], rotation: [0, 0.3, 0] })])
    expect(out.stats).toMatchObject({ batches: 4, primitives: 5, triangles: 60, vertices: 120 })
  })

  it('content inside a part is in the part space: the pivot is not baked', () => {
    const out = generate(shape({ kind: 'group', part: 'lid', position: [10, 0, 0], children: [box({ position: [0, 2, 0] })] }))
    const b = out.levels[0]!.batches[0]!
    expect(b.bounds).toEqual({ min: [-0.5, 1.5, -0.5], max: [0.5, 2.5, 0.5] })
  })

  it('material fallback and aliases', () => {
    const out = generate(shape({ kind: 'group', children: [box({ material: 'glass' }), box({ material: 'unknown' }), box({ material: 'metal' })] }), {
      materials: ['plain', 'metal', 'glass'],
      fallbackMaterial: 'plain',
      materialAlias: { metal: 'plain' },
    })
    expect(out.levels[0]!.batches.map((b) => [b.material, b.positions.length / 3])).toEqual([['glass', 24], ['plain', 48]])
  })

  it('colours: linear by default, srgb on request, none drops them', () => {
    const node = box({ color: '#808080' })
    const linear = generate(shape(node)).levels[0]!.batches[0]!.colors!
    const srgb = generate(shape(node), { colors: 'srgb' }).levels[0]!.batches[0]!.colors!
    expect(srgb[0]).toBeCloseTo(128 / 255, 6)
    expect(linear[0]).toBeCloseTo(0.2158605, 6)
    expect(generate(shape(node), { colors: 'none' }).levels[0]!.batches[0]!.colors).toBeUndefined()
  })

  it('non-indexed output', () => {
    const b = generate(shape(box()), { indexed: false }).levels[0]!.batches[0]!
    expect(b.indices).toBeUndefined()
    expect(b.positions.length / 3).toBe(36)
  })

  it('switches to 32-bit indices above 65 535 vertices', () => {
    const big = generate(shape({ kind: 'plane', width: 1, height: 1, widthSegments: 300, heightSegments: 300 })).levels[0]!.batches[0]!
    expect(big.indices).toBeInstanceOf(Uint32Array)
    expect(generate(shape(box())).levels[0]!.batches[0]!.indices).toBeInstanceOf(Uint16Array)
  })

  it('uv rect remaps uvs', () => {
    const b = generate(shape({ kind: 'plane', uv: { u0: 0.5, v0: 0.25, u1: 0.75, v1: 0.5 } })).levels[0]!.batches[0]!
    expect([...b.uvs]).toEqual([0.5, 0.5, 0.75, 0.5, 0.5, 0.25, 0.75, 0.25])
  })
})

describe('named ranges and points', () => {
  it('a named node reports what it added to each batch', () => {
    const out = generate(shape({ kind: 'group', children: [box({ material: 'a' }), { kind: 'group', name: 'handle', tags: ['grip'], children: [box({ material: 'a' }), box({ material: 'b' })] }] }))
    const [a, b] = out.levels[0]!.batches
    expect(a!.ranges).toEqual([{ name: 'handle', tags: ['grip'], vertexStart: 24, vertexCount: 24, indexStart: 36, indexCount: 36 }])
    expect(b!.ranges).toEqual([{ name: 'handle', tags: ['grip'], vertexStart: 0, vertexCount: 24, indexStart: 0, indexCount: 36 }])
  })
  it('points are placed by their parent', () => {
    const out = generate(shape({ kind: 'group', position: [1, 2, 3], children: [{ kind: 'point', name: 'lamp', position: [0, 1, 0], data: { light: { range: 4 } } }] }))
    expect(out.points).toEqual([{ name: 'lamp', part: null, position: [1, 3, 3], data: { light: { range: 4 } } }])
  })
})

describe('LOD', () => {
  const schema = shape(
    {
      kind: 'group',
      children: [
        { kind: 'cylinder', radialSegments: 16 },
        { kind: 'sphere', radius: 0.01, widthSegments: 8, heightSegments: 6 },
        { kind: 'box', minDetail: 0.75 },
        { kind: 'group', part: 'door', position: [2, 0, 0], children: [box()] },
      ],
    },
    { lod: [{ distance: 20, detail: 0.5, minSize: 0.05, minSegments: 5 }], cullDistance: 60 },
  )
  it('scales segments, drops small and detail-limited nodes, bakes parts at rest', () => {
    const out = generate(schema)
    expect(out.levels.map((l) => [l.distance, l.detail])).toEqual([[0, 1], [20, 0.5]])
    const near = out.levels[0]!
    const far = out.levels[1]!
    expect(near.batches.map((b) => b.part)).toEqual([null, 'door'])
    expect(far.batches.map((b) => b.part)).toEqual([null])
    const cylinder8 = buildPrimitive({ kind: 'cylinder', radialSegments: 8 })
    const box1 = buildPrimitive({ kind: 'box' })
    expect(far.batches[0]!.positions.length).toBe(cylinder8.positions.length + box1.positions.length)
    // the door box is baked at its pivot
    expect(far.batches[0]!.bounds.max[0]).toBe(2.5)
    expect(out.cullDistance).toBe(60)
    expect(generate(schema, { levels: [1] }).levels).toHaveLength(1)
  })
})

describe('instancing', () => {
  it('explicit instances become an instanced batch, never merged', () => {
    const out = generate(shape({ kind: 'group', children: [box(), { kind: 'cylinder', material: 'metal', name: 'post', instances: [{ position: [0, 0, 0] }, { position: [1, 0, 0], color: 0xff0000 }, { heading: 1, position: [2, 0, 0] }] }] }))
    const level = out.levels[0]!
    expect(level.batches).toHaveLength(1)
    expect(level.instanced).toHaveLength(1)
    const inst = level.instanced[0]!
    expect(inst).toMatchObject({ material: 'metal', name: 'post', count: 3 })
    expect(inst.matrices.length).toBe(48)
    expect(inst.matrices[16 + 12]).toBe(1)
    expect(inst.colors![3]).toBe(1)
    expect(out.stats.instances).toBe(3)
  })
  it('automatic instancing is opt-in and only for repeats of the same leaf', () => {
    const children: ShapeNode[] = Array.from({ length: 10 }, (_, i) => box({ position: [i, 0, 0], color: 0x336699 }))
    children.push(box({ size: [2, 1, 1] }))
    const plain = generate(shape({ kind: 'group', children }))
    expect(plain.levels[0]!.instanced).toHaveLength(0)
    const auto = generate(shape({ kind: 'group', children }), { instancing: { minCount: 8 } })
    expect(auto.levels[0]!.instanced).toHaveLength(1)
    expect(auto.levels[0]!.instanced[0]!.count).toBe(10)
    expect(auto.levels[0]!.batches[0]!.positions.length / 3).toBe(24)
  })
})

describe('custom generators and the seed', () => {
  it('are deterministic by seed and path', () => {
    registerGenerator('test.rocks', (params: { count: number }, ctx) => ({ kind: 'group', children: Array.from({ length: params.count }, () => box({ position: [ctx.random() * 10, 0, ctx.random() * 10] })) }))
    try {
      const schema = shape({ kind: 'group', children: [{ kind: 'custom', generator: 'test.rocks', params: { count: 3 } }, { kind: 'custom', generator: 'test.rocks', params: { count: 3 } }] })
      const a = generate(schema, { seed: 7 })
      const b = generate(schema, { seed: 7 })
      const c = generate(schema, { seed: 8 })
      expect(a.levels[0]!.batches[0]!.positions).toEqual(b.levels[0]!.batches[0]!.positions)
      expect(a.levels[0]!.batches[0]!.positions).not.toEqual(c.levels[0]!.batches[0]!.positions)
      expect(a.key).not.toBe(c.key)
      // the two nodes have their own streams
      const p = a.levels[0]!.batches[0]!.positions
      expect(p[0]).not.toBe(p[24 * 3 * 3])
    } finally {
      unregisterGenerator('test.rocks')
    }
    expect(() => generate(shape({ kind: 'custom', generator: 'missing' }))).toThrow(/no generator "missing"/)
  })
})

describe('difference (box minus through-holes)', () => {
  it('a wall with a window: same outline, a hole, closed reveals', () => {
    const wall = buildPrimitive({ kind: 'difference', size: [4, 2.6, 0.2], subtract: [{ min: [-0.6, -0.2], max: [0.6, 0.8] }] })
    // 3 x 3 grid minus the middle cell: 8 solid cells, 2 faces each; outer sides 4 x 3 edges, 4 reveals
    expect(wall.indices!.length / 6).toBe(8 * 2 + 12 + 4)
    let area = 0
    for (let i = 0; i < wall.indices!.length; i += 3) {
      const [a, b, c] = [wall.indices![i]!, wall.indices![i + 1]!, wall.indices![i + 2]!].map((k) => [wall.positions[k * 3]!, wall.positions[k * 3 + 1]!, wall.positions[k * 3 + 2]!])
      const n = wall.normals.slice(wall.indices![i]! * 3, wall.indices![i]! * 3 + 3)
      const u = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!]
      const v = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!]
      const cross = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!]
      // every triangle faces its normal
      expect(cross[0]! * n[0]! + cross[1]! * n[1]! + cross[2]! * n[2]!).toBeGreaterThan(0)
      if (n[2] === 1) area += Math.hypot(...cross) / 2
    }
    expect(area).toBeCloseTo(4 * 2.6 - 1.2 * 1, 5)
  })
  it('a door that reaches the bottom opens the bottom side', () => {
    const wall = buildPrimitive({ kind: 'difference', size: [2, 2, 0.1], subtract: [{ min: [-0.4, -2], max: [0.4, 0.8] }] })
    let bottom = 0
    for (let i = 0; i < wall.normals.length; i += 3) if (wall.normals[i + 1] === -1 && wall.positions[i + 1]! < -0.99) bottom++
    // two bottom quads (left and right of the door), 4 vertices each
    expect(bottom).toBe(8)
  })
})

describe('mesh nodes', () => {
  it('compute normals when missing', () => {
    const tri = buildPrimitive({ kind: 'mesh', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] })
    expect([...tri.normals]).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1])
    expect(tri.uvs.length).toBe(6)
  })
})

describe('schema, validation and keys', () => {
  it('the exported schema is the shipped file', () => {
    expect(SHAPE_SCHEMA).toEqual(schemaFile)
  })
  it('reports problems with their path', () => {
    expect(validateShape(shape({ kind: 'group', children: [{ kind: 'cylinder', radialSegments: 2.5 } as ShapeNode, { kind: 'nope' } as unknown as ShapeNode] }))).toEqual([
      'root.children[0].radialSegments: expected an integer >= 1',
      'root.children[1].kind: expected one of group, box, cylinder, cone, sphere, plane, circle, ring, lathe, torus, extrude, difference, mesh, point, custom',
    ])
    expect(validateShape({ version: 2, root: { kind: 'box', heading: 1, rotation: [0, 0, 0] } })).toEqual(['version: expected 1', 'root.heading: cannot be combined with rotation or scale'])
    expect(validateShape(shape(box({ color: 'red' })))).toEqual(['root.color: expected 0xRRGGBB or "#rrggbb"'])
    expect(() => generate({ version: 1 } as ShapeSchema)).toThrow(/root: required/)
  })
  it('keys: same schema same key, order of object keys does not matter, -0 does', () => {
    const a = shape(box({ position: [1, 2, 3], color: 0xff0000 }))
    const b = { root: { color: 0xff0000, position: [1, 2, 3], size: [1, 1, 1], kind: 'box' }, version: 1 } as ShapeSchema
    expect(shapeKey(a)).toBe(shapeKey(b))
    expect(shapeKey(a)).toMatch(/^[0-9a-f]{16}$/)
    expect(shapeKey(a, { seed: 1 })).not.toBe(shapeKey(a))
    expect(canonicalJson([-0, 0])).toBe('[-0,0]')
  })
  it('results are transferable and clonable', () => {
    const out = generate(shape({ kind: 'group', children: [box(), { kind: 'box', instances: [{}, {}] }] }))
    const buffers = transferablesOf(out)
    expect(buffers.length).toBe(4 + 1 + 4 + 1)
    const copy = cloneBuffers(out)
    copy.levels[0]!.batches[0]!.positions[0] = 99
    expect(out.levels[0]!.batches[0]!.positions[0]).toBe(0.5)
  })
  it('the same input gives the same bytes', () => {
    const schema = shape({ kind: 'group', children: [box({ heading: 0.3, position: [1, 0, 2] }), { kind: 'lathe', points: [[0, 0], [1, 1], [0, 2]], rotation: [0.1, 0.2, 0.3] }] })
    expect(generate(schema)).toEqual(generate(schema))
  })
})
