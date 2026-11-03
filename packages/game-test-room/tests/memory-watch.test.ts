// The on-screen memory warning (CLAUDE.md, "Memória"): after each clear the GPU counts come back to the scenery; when they keep growing the room says so.
import { describe, expect, it } from 'vitest'
import { createMemoryWatch } from '../src/memory-watch'
import { makeRoom, stubRenderer } from './helpers'

describe('createMemoryWatch', () => {
  const counts = { geometries: 100, textures: 10 }
  const watch = () => createMemoryWatch({ read: () => ({ ...counts }), clears: 4 })

  it('stays quiet when each clear comes back to the same level, and when a cache fills once', () => {
    const w = watch()
    counts.geometries = 100
    w.cleared('a')
    counts.geometries = 160 // the first use filled a cache
    for (let i = 0; i < 6; i++) expect(w.cleared('a')?.leaking).toBe(false)
  })

  it('warns when the counts grow on every clear past the budget', () => {
    const w = watch()
    counts.geometries = 100
    const verdicts = []
    for (let i = 0; i < 5; i++) {
      verdicts.push(w.cleared('a')?.leaking)
      counts.geometries += 30
    }
    expect(verdicts).toEqual([false, false, false, false, true])
    expect(w.last?.grew.geometries).toBe(120)
  })

  it('compares a clear only with the clears of the same area (a new area fills its own caches)', () => {
    const w = watch()
    counts.geometries = 100
    for (const area of ['a', 'b', 'c', 'd', 'e']) {
      expect(w.cleared(area)?.leaking).toBe(false)
      counts.geometries += 50
    }
  })
})

describe('the room warns on screen when memory keeps growing after each clear', () => {
  it('logs memory_leak and shows it on the counters line, and not when the clears come back down', () => {
    const memory = { geometries: 50, textures: 5 }
    const renderer = Object.assign(stubRenderer(), { info: { memory, render: { calls: 0, triangles: 0 } } })
    const room = makeRoom({ renderer })
    for (let i = 0; i < 6; i++) room.clear()
    expect(room.log.entries({ type: 'memory_leak' })).toHaveLength(0)
    expect(room.metrics().room.geometries).toBe(50)
    for (let i = 0; i < 6; i++) {
      memory.geometries += 40
      room.clear()
    }
    const leaks = room.log.entries({ type: 'memory_leak' })
    expect(leaks.length).toBeGreaterThan(0)
    expect(leaks[0].text).toContain('discardObject3D')
  })
})
