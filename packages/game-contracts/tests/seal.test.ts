import { describe, expect, it } from 'vitest'

import { sealBlock, sealOpener } from '../src'

describe('seal', () => {
  const tin = { openWith: ['can_opener', 'knife'], spoilsWhenBreached: true }
  it('a tin opens only with one of its tools; a pull tab by hand', () => {
    expect(sealOpener(tin, []).ok).toBe(false)
    expect(sealOpener(tin, ['spoon', 'knife'])).toEqual({ ok: true, tool: 'knife' })
    expect(sealOpener({ byHand: true }, [])).toEqual({ ok: true })
  })
  it('a closed tin is sealed; a holed or leaking one is spoiled even open; a dent alone is fine', () => {
    expect(sealBlock(tin, {})).toBe('sealed')
    expect(sealBlock(tin, { opened: true })).toBeUndefined()
    expect(sealBlock(tin, { opened: true, breached: true })).toBe('breached')
    expect(sealBlock(tin, { opened: false, leaked: true })).toBe('leaked')
    expect(sealBlock({ openWith: ['can_opener'] }, { opened: true, breached: true })).toBeUndefined()
  })
})
