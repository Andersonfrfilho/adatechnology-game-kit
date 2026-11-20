import { describe, expect, it } from 'vitest'
import { makeRoom } from './helpers'

describe('room.update and the frame budget mode', () => {
  it('without frameStartMs the budget runs in quota', () => {
    const room = makeRoom()
    room.update(1 / 60)
    expect(room.frameStats?.().budget.mode).toBe('quota')
  })

  it('with frameStartMs the budget runs in deadline against the room target', () => {
    const room = makeRoom()
    room.update(1 / 60, { frameStartMs: performance.now() })
    const budget = room.frameStats?.().budget
    expect(budget?.mode).toBe('deadline')
    expect(budget?.targetMs).toBeGreaterThan(0)
  })
})
