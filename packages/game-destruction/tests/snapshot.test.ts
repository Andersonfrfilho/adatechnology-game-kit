import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import { plate } from './helpers'

describe('snapshot', () => {
  it('state is live, snapshot is a deep copy that does not move afterwards', () => {
    const w = createDestruction()
    w.add(plate('steel', 0.4, 0.4, 0.05, 'door'), { id: 'd' })
    const live = w.state('d')!
    const snap = w.snapshot('d')!
    expect(snap).toEqual(live)
    expect(snap).not.toBe(live)
    expect(snap.parts[0]).not.toBe(live.parts[0])
    w.hit('d', { type: 'blunt', point: [0, 0, 0.03], direction: [0, 0, -1], energy: 400, radius: 0.05 })
    expect(w.state('d')).toBe(live)
    expect(live.parts[0].hp).toBeLessThan(snap.parts[0].maxHp)
    expect(snap.parts[0].hp).toBe(snap.parts[0].maxHp)
    expect(w.snapshot('nope')).toBeNull()
  })
})
