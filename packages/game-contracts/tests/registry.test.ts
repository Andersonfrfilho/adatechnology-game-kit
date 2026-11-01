import { describe, expect, it, vi } from 'vitest'

import { applyPatches, deepMerge, mergeById, removeIds } from '../src'
import { resetWarnOnce } from '../src/testing'

type Entry = { id: string; weight: number; box?: { width: number; depth: number }; tags?: string[] }

describe('registry helpers', () => {
  it('mergeById adds and replaces by id, keeping order of first appearance', () => {
    const merged = mergeById<Entry>([{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }], [{ id: 'b', weight: 3 }, { id: 'c', weight: 4 }])
    expect([...merged.entries()].map(([id, entry]) => [id, entry.weight])).toEqual([['a', 1], ['b', 3], ['c', 4]])
    expect(mergeById<Entry>([{ id: 'a', weight: 1 }], undefined).size).toBe(1)
  })

  it('applyPatches merges nested objects, replaces arrays and ignores unknown ids', () => {
    const entries = mergeById<Entry>([{ id: 'a', weight: 1, box: { width: 1, depth: 2 }, tags: ['x', 'y'] }], undefined)
    applyPatches(entries, { a: { box: { depth: 5 }, tags: ['z'] }, ghost: { weight: 9 } })
    expect(entries.get('a')).toEqual({ id: 'a', weight: 1, box: { width: 1, depth: 5 }, tags: ['z'] })
    expect(entries.has('ghost')).toBe(false)
  })

  it('removeIds deletes the listed ids', () => {
    const entries = mergeById<Entry>([{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }], undefined)
    removeIds(entries, ['a', 'missing'])
    expect([...entries.keys()]).toEqual(['b'])
  })

  it('deepMerge ignores undefined and keys that would reach the prototype', () => {
    const merged = deepMerge({ a: 1, nested: { b: 2 } }, JSON.parse('{"a": null, "__proto__": {"polluted": true}, "nested": {"c": 3}}'))
    expect(merged).toMatchObject({ a: null, nested: { b: 2, c: 3 } })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 })
  })

  it('warns once in development about a patch or a remove for an id that does not exist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    resetWarnOnce()
    try {
      const entries = mergeById<Entry>([{ id: 'a', weight: 1 }], undefined)
      applyPatches(entries, { ghost: { weight: 9 } })
      applyPatches(entries, { ghost: { weight: 9 } })
      removeIds(entries, ['missing', 'a'])
      expect(warn.mock.calls).toEqual([['[game-kit] patch for "ghost" ignored: no entry has that id'], ['[game-kit] remove of "missing" ignored: no entry has that id']])
    } finally {
      warn.mockRestore()
      resetWarnOnce()
    }
  })
})
