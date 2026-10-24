import { describe, expect, it } from 'vitest'
import { makeRoom } from './helpers'

describe('waitUntilReady', () => {
  it('waits out the draw that setTool plays, so the first pull fires', () => {
    const room = makeRoom()
    room.setTool('pistol_9mm')
    expect(room.tool.phase?.id).toBe('draw')
    const waited = room.waitUntilReady()
    expect(waited).toBeGreaterThanOrEqual(0.35)
    expect(waited).toBeLessThan(0.5)
    expect(room.tool.phase).toBeNull()
    const ammo = room.tool.ammo
    room.use()
    expect(room.tool.ammo).toBe(ammo - 1)
  })

  it('stops at the limit when the phase does not end', () => {
    const room = makeRoom()
    room.setTool('pistol_9mm')
    expect(room.waitUntilReady(0.1)).toBeLessThan(0.2)
  })
})
