import { describe, expect, it } from 'vitest'
import { makeRoom } from './helpers'

type Vec = [number, number, number]
type Room = ReturnType<typeof makeRoom>

/** The player standing at the origin (crouched or not), a crate lying on the floor `ahead` metres in front of the feet, the eye looking at it. */
function lying(ahead: number, crouched: boolean): { room: Room; look: () => void } {
  const room = makeRoom()
  room.spawn('wooden_crate', [0, 0, -ahead], 0)
  room.update(0.4)
  if (crouched) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }))
  }
  const eye: Vec = [0, 1.7, 0]
  const look = (): void => room.look(eye, [0, 0.2, -ahead])
  for (let i = 0; i < 90; i++) {
    look()
    room.update(1 / 60)
  }
  return { room, look }
}

const blow = (tool: string, ahead: number, crouched: boolean): boolean => {
  const { room, look } = lying(ahead, crouched)
  room.setTool(tool)
  for (let i = 0; i < 60; i++) {
    look()
    room.update(1 / 60)
  }
  room.use()
  for (let i = 0; i < 90; i++) {
    look()
    room.update(1 / 60)
  }
  const hit = room.log.entries({ type: 'melee' }).filter((entry) => entry.objectId !== undefined && entry.objectId.startsWith('wooden_crate'))
  return hit.length > 0
}

describe('a melee blow reaches from the body, down to the floor', () => {
  it('crouched fists hit what lies 0.6 m in front of the feet, and not what lies 2 m away', () => {
    expect(blow('fists', 0.6, true)).toBe(true)
    expect(blow('fists', 2, true)).toBe(false)
  })

  it('a sledgehammer swung standing, aimed down, hits what lies 0.6 m in front of the feet, and not 2 m away', () => {
    expect(blow('sledgehammer', 0.6, false)).toBe(true)
    expect(blow('sledgehammer', 2, false)).toBe(false)
  })

  it('a shovel swung at a crate (not ground, so it does not dig) reaches down the same way', () => {
    expect(blow('shovel', 0.6, false)).toBe(true)
  })
})
