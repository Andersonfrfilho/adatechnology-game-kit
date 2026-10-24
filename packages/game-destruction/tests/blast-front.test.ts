import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec } from '../src'
import { plate } from './helpers'

const pane = (): DestructibleSpec => plate('glass', 1, 1, 0.004, 'pane')

describe('blastFrontSpeed', () => {
  it('breaks glass when the front arrives, not at once', () => {
    const world = createDestruction({ blastFrontSpeed: 340 })
    const id = world.add(pane())
    const hits = world.explode([0, 0, 3], 1000000, 12)
    expect(hits[0]?.events.some((event) => event.type === 'fracture')).toBe(false)
    expect(world.part(id, 'pane')?.status).not.toBe('broken')
    // 3 m at 340 m/s: about 9 ms
    const early = world.update(0.002)
    expect(early.some((event) => event.type === 'fracture')).toBe(false)
    const later = world.update(0.02)
    expect(later.some((event) => event.type === 'fracture')).toBe(true)
    expect(world.part(id, 'pane')?.status).toBe('broken')
  })

  it('is off by default: the glass takes the blast on the spot', () => {
    const world = createDestruction()
    const id = world.add(pane())
    world.explode([0, 0, 3], 1000000, 12)
    expect(world.part(id, 'pane')?.status).toBe('broken')
  })

  it('drops the delayed damage of an object that was reset', () => {
    const world = createDestruction({ blastFrontSpeed: 340 })
    const id = world.add(pane())
    world.explode([0, 0, 3], 1000000, 12)
    world.reset(id)
    world.update(0.05)
    expect(world.part(id, 'pane')?.status).not.toBe('broken')
  })
})

describe('explode event effect', () => {
  it('carries the effect id of the exploding part', () => {
    const world = createDestruction()
    world.add({ parts: [{ id: 'tank', material: 'steel', shape: { kind: 'box', size: [0.4, 0.4, 0.4] }, position: [0, 0, 0], thickness: 0.003, explodes: { energy: 5000, radius: 4, effect: 'fuel_barrel' } }] })
    const seen: Array<string | undefined> = []
    world.on('explode', (event) => {
      if (event.type === 'explode') seen.push(event.effect)
    })
    world.explode([0, 0, 0], 1e9, 3)
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((effect) => effect === 'fuel_barrel')).toBe(true)
  })
})
