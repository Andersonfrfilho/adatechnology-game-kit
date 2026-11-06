import { describe, expect, it } from 'vitest'
import { createAudioEngine } from '@adatechnology/game-audio'
import type { HostEvent } from '@adatechnology/game-contracts'
import { makeRoom } from './helpers'
import type { TestRoom } from '../src'

const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) room.update(1 / 60)
}

describe('the M18 smoke grenade in the room', () => {
  it('lights after its fuse, lets out smoke for 50 to 90 s, tells the host of no explosion, and leaves nothing when it is spent', () => {
    const room = makeRoom()
    const explosions: HostEvent[] = []
    room.loadModule({ id: 'spy', name: 'spy', group: 'spy', items: () => [], attach: (host) => host.on((event) => void (event.type === 'explosion' && explosions.push(event))) })
    room.setTool('smoke_grenade')
    run(room, 0.5)
    room.look([0, 1.7, 5], [0, 0.6, 1.5])
    room.use()
    run(room, 6)
    expect(room.vfx.sprites().live).toBeGreaterThan(20)
    run(room, 40)
    expect(room.vfx.sprites().live).toBeGreaterThan(20)
    run(room, 60)
    expect(room.vfx.sprites().live).toBe(0)
    expect(explosions).toHaveLength(0)
    expect(room.log.entries().some((entry) => entry.type === 'smoke')).toBe(true)
  })

  it('clicks its pin when thrown and hisses while it burns, louder near, silent once it is spent', () => {
    const engine = createAudioEngine({ createContext: () => null })
    const played: string[] = []
    const levels: number[] = []
    let stopped = 0
    const spy = {
      ...engine,
      register: engine.register,
      play: (id: string) => (played.push(id), null),
      loop: (id: string) => (played.push(id), { set: (state: { volume?: number }) => void levels.push(state.volume ?? 0), stop: () => void stopped++ }),
    } as unknown as typeof engine
    const room = makeRoom({ audio: spy })
    room.setTool('smoke_grenade')
    run(room, 0.5)
    room.look([0, 1.7, 5], [0, 0.6, 1.5])
    room.use()
    expect(played).toContain('grenade_pin_pull')
    run(room, 6)
    expect(played.filter((id) => id === 'smoke_grenade_hiss')).toHaveLength(1)
    expect(levels.at(-1)).toBeGreaterThan(0.05)
    const near = levels.at(-1)!
    room.look([0, 1.7, 40], [0, 0.6, 1.5])
    run(room, 1)
    expect(levels.at(-1)).toBeLessThan(near)
    run(room, 100)
    expect(stopped).toBe(1)
  })
})
