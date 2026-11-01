import { describe, expect, it } from 'vitest'

import { createShapes, defaultShapeGenerators, generate, getGenerator, registerGenerator, unregisterGenerator } from '../src'
import type { ShapeGenerator, ShapeNode, ShapeSchema } from '../src'

const box = (x: number): ShapeNode => ({ kind: 'box', size: [1, 1, 1], position: [x, 0, 0] })
const stones: ShapeGenerator = (params: { count: number }, context) => ({ kind: 'group', children: Array.from({ length: params.count }, () => box(context.random())) })
const schemaOf = (generator: string): ShapeSchema => ({ version: 1, root: { kind: 'custom', generator, params: { count: 3 } } })

describe('shape generators by instance', () => {
  it('the global functions and an instance with the same generator produce the same bytes', () => {
    registerGenerator('test.stones', stones)
    try {
      const made = createShapes({ packs: [{ 'test.stones': stones }] })
      const schema = schemaOf('test.stones')
      expect(made.generate(schema, { seed: 5 })).toEqual(generate(schema, { seed: 5 }))
      expect(defaultShapeGenerators().list()).toContain('test.stones')
      expect(getGenerator('test.stones')).toBe(stones)
    } finally {
      unregisterGenerator('test.stones')
    }
    expect(getGenerator('test.stones')).toBeUndefined()
  })

  it('two sets with different packs do not leak into each other or into the global registry', () => {
    const first = createShapes({ packs: [{ 'test.stones': stones }] })
    const second = createShapes({ packs: [{ 'test.other': stones }], remove: ['test.gone'] })
    expect(first.list()).toEqual(['test.stones'])
    expect(second.list()).toEqual(['test.other'])
    expect(getGenerator('test.stones')).toBeUndefined()
    expect(() => second.generate(schemaOf('test.stones'))).toThrow(/no generator "test.stones"/)
    expect(() => first.generate(schemaOf('test.other'))).toThrow(/no generator "test.other"/)
    expect(() => first.generate(schemaOf('test.stones'))).not.toThrow()
    registerGenerator('test.global', stones)
    try {
      expect(() => first.generate(schemaOf('test.global'))).toThrow(/no generator "test.global"/)
    } finally {
      unregisterGenerator('test.global')
    }
    first.register('test.late', stones)
    expect(second.get('test.late')).toBeUndefined()
  })

  it('patch replaces a generator by name and remove takes it out', () => {
    const calm: ShapeGenerator = () => box(0)
    const patched = createShapes({ packs: [{ 'test.stones': stones, 'test.drop': stones }], patch: { 'test.stones': calm }, remove: ['test.drop'] })
    expect(patched.get('test.stones')).toBe(calm)
    expect(patched.get('test.drop')).toBeUndefined()
  })
})
