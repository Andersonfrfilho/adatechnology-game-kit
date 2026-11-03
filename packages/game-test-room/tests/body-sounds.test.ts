import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createAudioEngine } from '@adatechnology/game-audio'
import type { HostEvent, ModuleHost, TestableModule } from '@adatechnology/game-contracts'
import type { RoomAvatar } from '../src'
import { blowOfTool, createStrideCounter } from '../src/body-sounds'
import { makeRoom } from './helpers'

type Played = { id: string; frame: number }

/** A room whose engine records what is played (no AudioContext in Node, so nothing sounds), on frame numbers. */
const setup = (avatar: RoomAvatar | null = null) => {
  const audio = createAudioEngine({ createContext: () => null })
  const played: Played[] = []
  let frame = 0
  const play = audio.play.bind(audio)
  audio.play = (id, options) => {
    played.push({ id, frame })
    return play(id, options)
  }
  const room = makeRoom({ audio })
  if (avatar) room.setAvatar(avatar)
  const events: HostEvent[] = []
  const listener: TestableModule = {
    id: 'ear',
    name: 'ear',
    group: 'test',
    items: () => [],
    attach: (host: ModuleHost) => host.on((event) => void events.push(event)),
  }
  room.loadModule(listener)
  const step = (seconds: number, each?: () => void): void => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      each?.()
      frame++
      room.update(1 / 60)
    }
  }
  return { room, played, events, step, frameNow: () => frame }
}

/** A body that says a foot is down every `every` frames while it walks. */
const walkingAvatar = (every: number): RoomAvatar & { frames: number } => {
  let n = 0
  let speed = 0
  const body = {
    root: new THREE.Group(),
    frames: 0,
    update: (_dt: number, state: { speed: number }) => {
      speed = state.speed
      n++
    },
    footfall: () => (speed > 0.3 && n % every === 0 ? (n % (2 * every) === 0 ? 'left' : 'right') : null),
  }
  return body as RoomAvatar & { frames: number }
}

const footfalls = (events: HostEvent[]) => events.filter((e): e is Extract<HostEvent, { type: 'footfall' }> => e.type === 'footfall')

describe('footfalls', () => {
  it('sends the body’s heel strikes to the modules, with the floor under them and the gait', () => {
    const { room, events, step } = setup(walkingAvatar(20))
    room.look([0, 1.7, 6], [0, 1.7, 0])
    step(0.2)
    events.length = 0
    // a scripted walk of 2.8 m in 2 s: the fake body puts a foot down every 20 frames
    room.walk([0, 1.7, 3.2], 2)
    step(2)
    const feet = footfalls(events)
    expect(feet.length).toBeGreaterThanOrEqual(4)
    expect(feet.every((f) => f.surface === 'concrete' && f.gait === 'walk')).toBe(true)
    expect(new Set(feet.map((f) => f.foot))).toEqual(new Set(['left', 'right']))
  })

  it('counts strides by distance when the room has no body, and names the ground profile under them', () => {
    const { room, events, step } = setup(null)
    room.terrain.setLayout({ surface: 'concrete_slab', zones: [{ rect: [-2, -14, 2, 14], surface: 'lawn' }] })
    room.look([0, 1.7, 6], [0, 1.7, 0])
    step(0.2)
    events.length = 0
    room.walk([0, 1.7, 1.8], 3)
    step(3)
    const feet = footfalls(events)
    // 4.2 m walked: about 6 strides of 0.72 m
    expect(feet.length).toBeGreaterThanOrEqual(5)
    expect(feet.length).toBeLessThanOrEqual(7)
    expect(feet.every((f) => f.surface === 'grass')).toBe(true)
  })

  it('a stride counter alternates the feet and starts with half a stride', () => {
    const counter = createStrideCounter({ walk: 1, run: 2 })
    expect(counter.advance(0.4, 'walk')).toBeNull()
    expect(counter.advance(0.2, 'walk')).toBe('right')
    expect(counter.advance(0.8, 'walk')).toBeNull()
    expect(counter.advance(0.2, 'walk')).toBe('left')
  })
})

describe('blows', () => {
  it('maps the arsenal’s melee tools to their blow', () => {
    expect(blowOfTool('hand', 'hand')).toBe('punch')
    expect(blowOfTool('kick', 'melee_blunt')).toBe('kick')
    expect(blowOfTool('axe', 'melee_blade')).toBe('chop')
    expect(blowOfTool('machete', 'melee_blade')).toBe('blade')
    expect(blowOfTool('sledgehammer', 'melee_blunt')).toBe('blunt')
    expect(blowOfTool('some_club', 'melee_blunt')).toBe('blunt')
    expect(blowOfTool('glock_17', 'pistol')).toBeNull()
  })

  it('a punch with a clip: the swing starts just before the contact (in the room’s time) and the knuckles sound with the contact', () => {
    const impact = 0.3
    const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, strike: () => impact }
    const { room, played, step, frameNow } = setup(avatar)
    room.spawn('chair', [0, 0, -4], 0)
    step(0.4)
    room.look([-0.6, 0.5, -4.18], [0.22, 0.5, -4.18])
    room.setTool('hand')
    const start = frameNow()
    room.use()
    step(0.6, () => room.look([-0.6, 0.5, -4.18], [0.22, 0.5, -4.18]))
    const swing = played.find((p) => p.id === 'punch_swing')
    const hit = played.find((p) => p.id === 'punch_hit_object')
    expect(swing, 'swing').toBeDefined()
    expect(hit, 'hit').toBeDefined()
    // 0.3 s to the contact, the swing's loudest point 0.07 s after its start: it starts at about 0.23 s
    expect((swing!.frame - start) / 60).toBeCloseTo(impact - 0.07, 1)
    expect((hit!.frame - start) / 60).toBeCloseTo(impact, 1)
  })

  it('a punch into the air swings and hits nothing', () => {
    const { room, played, step } = setup(null)
    room.look([0, 1.6, 6], [0, 1.6, 14])
    room.setTool('hand')
    room.use()
    step(0.5)
    expect(played.map((p) => p.id)).toContain('punch_swing')
    expect(played.some((p) => p.id.includes('_hit'))).toBe(false)
  })
})

describe('jump and landing', () => {
  it('jumps and lands on the floor it stands on', () => {
    const { played, step } = setup(null)
    step(0.3)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    step(0.05)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    step(1.2)
    const ids = played.map((p) => p.id)
    expect(ids).toContain('jump')
    expect(ids.filter((id) => id.startsWith('land_'))).toEqual(['land_concrete_light'])
    expect(ids.indexOf('jump')).toBeLessThan(ids.indexOf('land_concrete_light'))
  })
})
