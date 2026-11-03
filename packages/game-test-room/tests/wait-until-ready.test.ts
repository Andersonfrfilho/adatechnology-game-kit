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

describe('use answers what the trigger said', () => {
  it('answers drawing in the frame that ends the draw, and ok one frame later', () => {
    const room = makeRoom()
    room.setTool('pistol_9mm')
    // frame by frame, as the room's own loop: tool.phase turns null in the frame that ends the draw
    while (room.tool.phase) room.update(1 / 60)
    const ammo = room.tool.ammo
    expect(room.use()).toBe('drawing')
    expect(room.tool.ammo).toBe(ammo)
    room.update(1 / 60)
    expect(room.use()).toBe('ok')
    expect(room.tool.ammo).toBe(ammo - 1)
  })

  it('answers ok for bare hands', () => {
    const room = makeRoom()
    room.setTool('fists')
    room.waitUntilReady()
    expect(room.use()).toBe('ok')
  })
})
