import { describe, expect, it } from 'vitest'
import { createAudioEngine } from '@adatechnology/game-audio'
import { makeRoom } from './helpers'
import { ROCKET_MOTOR } from '../src/explosives'

const run = (seconds: number, step: (dt: number) => void): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) step(1 / 60)
}

describe('the motor of a rocket in flight', () => {
  it('roars from the launch for as long as the rocket flies, one loop, and goes quiet once it has burst', () => {
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
    room.setTool('m72_law')
    run(0.5, (dt) => room.update(dt))
    room.look([0, 1.7, 5], [0, 1.2, -60])
    room.use()
    run(0.5, (dt) => room.update(dt))
    expect(played.filter((id) => id === ROCKET_MOTOR.loop)).toHaveLength(1)
    expect(levels.at(-1)).toBeGreaterThan(0.1)
    for (let seconds = 0; seconds < 20 && stopped === 0; seconds += 1 / 60) room.update(1 / 60)
    expect(stopped).toBe(1)
  }, 60000)
})

describe('a 40 mm grenade from a launcher', () => {
  it('has no motor: it flies without the rocket roar', () => {
    const engine = createAudioEngine({ createContext: () => null })
    const played: string[] = []
    const spy = {
      ...engine,
      register: engine.register,
      play: (id: string) => (played.push(id), null),
      loop: (id: string) => (played.push(id), { set: () => undefined, stop: () => undefined }),
    } as unknown as typeof engine
    const room = makeRoom({ audio: spy })
    room.setTool('m79')
    run(0.5, (dt) => room.update(dt))
    room.look([0, 1.7, 5], [0, 1.2, -60])
    room.use()
    run(0.5, (dt) => room.update(dt))
    expect(played).not.toContain(ROCKET_MOTOR.loop)
  }, 60000)
})
