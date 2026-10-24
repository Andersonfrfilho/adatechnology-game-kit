import { describe, expect, it } from 'vitest'

import { cutLiteral, extractLiteral } from '../src/cut-literal'

const SOURCE = `const OTHER = [1]
const DATA = { a: [1, 2, '}'], b: { c: "]" }, /* } */ d: 3 } // trailing
const AFTER = 4`

describe('cutLiteral', () => {
  it('cuts the literal only, skipping brackets inside strings and comments', () => {
    expect(cutLiteral(SOURCE, 'DATA')).toBe(`{ a: [1, 2, '}'], b: { c: "]" }, /* } */ d: 3 }`)
  })

  it('evaluates the literal in an empty context with the given scope', () => {
    expect(extractLiteral(SOURCE, 'DATA')).toEqual({ a: [1, 2, '}'], b: { c: ']' }, d: 3 })
    expect(extractLiteral('const X = [seed, 2]', 'X', { seed: 7 })).toEqual([7, 2])
  })

  it('throws when the name is missing or the brackets do not close', () => {
    expect(() => cutLiteral(SOURCE, 'MISSING')).toThrow('not found')
    expect(() => cutLiteral('const BAD = { a: [1 }', 'BAD')).toThrow()
  })
})
