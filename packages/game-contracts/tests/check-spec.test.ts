import { describe, expect, it } from 'vitest'
import { checkSpec } from '../src'
import type { DestructibleSpec, PartSpec } from '../src'

const part = (id: string, over: Partial<PartSpec> = {}): PartSpec => ({ id, material: 'wood_soft', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0, 0], ...over })
const ok = (spec: DestructibleSpec) => checkSpec(spec, { materials: ['wood_soft', 'steel'] })

describe('checkSpec', () => {
  it('accepts a good spec', () => {
    expect(ok({ parts: [part('a'), part('b', { material: 'steel' })], joints: [{ a: 'a', b: 'b', kind: 'screw' }] })).toEqual({ ok: true, problems: [], warnings: [] })
  })

  it('reports duplicate ids, unknown materials, bad joints and bad numbers', () => {
    const r = ok({
      parts: [
        part('a'), part('a'), part('c', { material: 'unobtainium' }),
        part('d', { shape: { kind: 'box', size: [1, 0, 1] } }), part('e', { shape: { kind: 'cylinder', radius: NaN, height: 1 } }), part('f', { mass: -1, hp: -2 }),
        part('g', { structure: { role: 'tower' as never, capacity: -5 } }),
      ],
      joints: [{ a: 'a', b: 'a', kind: 'weld' }, { a: 'a', b: 'zzz', kind: 'weld' }, { a: 'a', b: 'c', kind: 'weld', bears: 'sideways' as never }],
    })
    expect(r.ok).toBe(false)
    const text = r.problems.join('\n')
    for (const m of [/duplicate part id "a"/, /unknown material "unobtainium"/, /box size/, /cylinder radius/, /mass must be/, /hp must be/, /invalid structure role "tower"/, /capacity/, /to itself/, /unknown part "zzz"/, /invalid bears/]) {
      expect(text).toMatch(m)
    }
  })

  it('skips the material check without a list', () => {
    expect(checkSpec({ parts: [part('a', { material: 'whatever' })] }).ok).toBe(true)
  })

  it('warns, without failing, when structural parts cannot reach an anchored part', () => {
    const structure = (role: 'column' | 'foundation' | 'beam') => ({ structure: { role } })
    const joined = checkSpec({ parts: [part('f', structure('foundation')), part('c', structure('column'))], joints: [{ a: 'f', b: 'c', kind: 'mortar' }] })
    expect(joined.warnings).toEqual([])
    const lost = checkSpec({ parts: [part('f', structure('foundation')), part('c', structure('column')), part('b', structure('beam'))], joints: [{ a: 'f', b: 'c', kind: 'mortar' }] })
    expect(lost.ok).toBe(true)
    expect(lost.warnings).toHaveLength(1)
    expect(lost.warnings[0]).toMatch(/"b".*cannot reach an anchored part/)
  })
})
