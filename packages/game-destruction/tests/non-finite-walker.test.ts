import { describe, expect, it } from 'vitest'

import { nonFinitePaths } from '../../../test-support/non-finite'

describe('the walker of non-finite numbers (test-support)', () => {
  it('finds NaN and Infinity with their paths, in objects, arrays and typed arrays', () => {
    const value = { a: [1, Number.NaN], b: { c: new Float32Array([0, Number.POSITIVE_INFINITY, 2]), d: new Float64Array([Number.NaN]) }, e: 3 }
    expect(nonFinitePaths(value, Infinity, 'v')).toEqual(['v.a[1]=NaN', 'v.b.c[1]=Infinity', 'v.b.d[0]=NaN'])
    expect(nonFinitePaths(value, 1, 'v')).toEqual(['v.a[1]=NaN'])
    expect(nonFinitePaths({ ok: [1, 2, new Int32Array([4])] })).toEqual([])
  })

  it('walks a cyclic object once instead of overflowing the stack', () => {
    const node: { value: number; next?: unknown; list: unknown[] } = { value: Number.NEGATIVE_INFINITY, list: [] }
    node.next = node
    node.list.push(node, { back: node })
    expect(nonFinitePaths(node, Infinity, 'n')).toEqual(['n.value=-Infinity'])
  })
})
