// @vitest-environment happy-dom
import { defaultVehicleFleet } from '@adatechnology/game-kit-defaults'
import { describe, expect, it, vi } from 'vitest'

import { defaultEffectIds, defaultSoundIds, VEHICLES_AREA_ID, VEHICLE_SCENARIO_IDS, createVehiclesTestModule } from '../src'
import { CAR_ENGINE } from '../src/audio/profiles'
import { fakeDocument } from './fake-dom'
import { roomWithVehicles } from './vehicles-room'

// The tests about one car lay only the sedan; the whole fleet is in vehicles-area-fleet.test.ts.
vi.setConfig({ testTimeout: 600_000 })

describe('vehicles test area', () => {
  it('asks the room engine for the horn, the starter, the engine loops by RPM, the tyres and the crashes, all from banks the room knows', () => {
    const { room } = roomWithVehicles('en', 'sedan')
    for (const id of [defaultSoundIds.horn, defaultSoundIds.start, defaultSoundIds.crashLight, defaultSoundIds.crashMedium, defaultSoundIds.crashHeavy]) expect([id, room.audio!.registry.sound(id) !== undefined]).toEqual([id, true])
    for (const id of [...CAR_ENGINE.layers.map((l) => l.sound), CAR_ENGINE.load.sound, defaultSoundIds.roll, defaultSoundIds.skidAsphalt]) expect([id, room.audio!.registry.loop(id) !== undefined]).toEqual([id, true])
    const played: string[] = []
    const loops: string[] = []
    const audio = room.audio!
    const play = audio.play.bind(audio)
    audio.play = ((sound: string, ...rest: unknown[]) => (played.push(sound), (play as (...a: unknown[]) => unknown)(sound, ...rest))) as never
    const loop = audio.loop.bind(audio)
    audio.loop = ((sound: string, ...rest: unknown[]) => (loops.push(sound), (loop as (...a: unknown[]) => unknown)(sound, ...rest))) as never
    const bench = room.bench(VEHICLES_AREA_ID)
    room.openArea(VEHICLES_AREA_ID)
    bench?.act('honk')
    bench?.act('drive_lane')
    for (let i = 0; i < 600; i++) room.update(1 / 30)
    expect(played).toContain(defaultSoundIds.horn)
    // the key first, then the engine; the lane car brakes hard before the wall (the tyres squeal) and is switched off once it stops
    expect(played.indexOf(defaultSoundIds.start)).toBeGreaterThanOrEqual(0)
    expect(loops).toContain(defaultSoundIds.skidAsphalt)
    expect(played.indexOf(defaultSoundIds.stop)).toBeGreaterThan(played.indexOf(defaultSoundIds.start))
    expect(loops).toContain(CAR_ENGINE.layers[0]!.sound)
  })

  it('asks the room effects for ids the game-vfx catalogue knows (no particle code of its own)', () => {
    const { room } = roomWithVehicles('en', 'sedan')
    const known = new Set([...room.vfx.catalog(), ...room.vfx.effectIds()])
    for (const [event, id] of Object.entries(defaultEffectIds)) expect([event, known.has(id)]).toEqual([event, true])
    expect(room.vfx.play(defaultEffectIds.sparks, [0, 1, 0])).not.toBeNull()
    expect(room.vfx.explosion(defaultEffectIds.explode, [0, 0.6, 4])).not.toBeNull()
  })

  it('a shut car holds the room smoke out of its cabin; opening the doors lets it in; a car taken away holds nothing', () => {
    const { room } = roomWithVehicles('en', 'sedan')
    room.openArea(VEHICLES_AREA_ID)
    room.clear()
    const sedan = room.spawn('sedan', [0, 0, -4], 0)
    room.update(1 / 60)
    const spaces = room.vfx.enclosures()
    expect(spaces.ids()).toEqual([sedan.objectId])
    const cabin = spaces.get(sedan.objectId)!
    expect(cabin.openings).toEqual([])
    // smoke thrown at the car from each side for 3 s: none of it inside the cabin
    const inside = (): number => {
      const pool = room.vfx.sprites().normal
      let n = 0
      for (let i = 0; i < pool.capacity; i++) if (pool.size[i]! > 0 && spaces.inside(pool.position[i * 3]!, pool.position[i * 3 + 1]!, pool.position[i * 3 + 2]!)) n++
      return n
    }
    const c = cabin.center
    let most = 0
    for (let f = 0; f < 180; f++) {
      if (f % 4 === 0) for (const side of [-1, 1]) {
        room.vfx.burst('smoke', [c[0] + side * 2.4, c[1], c[2]], [-side, 0, 0], 6, 3.5)
        room.vfx.burst('smoke', [c[0], c[1], c[2] + side * 3.2], [0, 0, -side], 6, 3.5)
      }
      room.update(1 / 60)
      most = Math.max(most, inside())
    }
    expect(room.vfx.sprites().live).toBeGreaterThan(50)
    expect(most).toBe(0)
    // the doors open: the cabin is open at each door
    expect(room.playAnimation('open_doors', sedan.objectId)).toBe(true)
    for (let f = 0; f < 90; f++) room.update(1 / 60)
    expect(spaces.get(sedan.objectId)!.openings!.length).toBeGreaterThanOrEqual(2)
    room.clear()
    room.update(1 / 60)
    expect(spaces.ids()).toEqual([])
  })

  it('keeps the walking player out of a vehicle (turned with it) and lets them walk on once it is gone', () => {
    const { room } = roomWithVehicles('en', 'sedan')
    room.openArea(VEHICLES_AREA_ID)
    room.clear()
    // a sedan across the path, turned a quarter: its length lies along x
    room.spawn('sedan', [0, 0, -4], Math.PI / 2)
    room.update(1 / 60)
    room.look([0, 1.6, 2], [0, 1.6, -4])
    // the walk ends in the middle of the car: the player stops at its side
    room.walk([0, 0, -4], 3)
    for (let i = 0; i < 80; i++) room.update(0.05)
    // stopped at the side of the car (half its width, about 0.9 m, plus the player's radius), not through it
    expect(room.camera.position.z).toBeGreaterThan(-4 + 0.8)
    expect(room.camera.position.z).toBeLessThan(-4 + 1.6)
    // along its length the car is longer: walking past its end is free (x = 5.5, clear of the room's own table at x = 3.5 and shelf at x = -3.5)
    room.look([5.5, 1.6, 2], [5.5, 1.6, -4])
    room.walk([5.5, 0, -8], 3)
    for (let i = 0; i < 80; i++) room.update(0.05)
    expect(room.camera.position.z).toBeLessThan(-7.5)
    room.clear()
    room.update(1 / 60)
    room.look([0, 1.6, 2], [0, 1.6, -4])
    room.walk([0, 0, -4], 3)
    for (let i = 0; i < 80; i++) room.update(0.05)
    expect(room.camera.position.z).toBeLessThan(-3.9)
  })

  it('names the burnt wrecks in both languages and lays none when the wrecks option is empty', () => {
    for (const [locale, names] of [['en', ['Burnt sedan', 'Burnt hatch']], ['pt-BR', ['Sedã queimado', 'Hatch queimado']]] as const) {
      // no three.js namespace: the names are read without building each vehicle for its clips
      const module = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale, document: fakeDocument as never })
      const wrecks = module.items(locale).filter((item) => item.id === 'sedan_burnt' || item.id === 'hatch_burnt')
      expect(wrecks.map((item) => item.name)).toEqual([...names])
    }
    const module = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never, wrecks: [] })
    expect(module.items('en').map((item) => item.id)).toHaveLength(8)
  })

  it('has the 11 scenarios of the page, the burnt wreck and the 2 of the drivers, in both languages', async () => {
    for (const locale of ['pt-BR', 'en']) {
      const { room } = roomWithVehicles(locale, 'sedan')
      room.openArea(VEHICLES_AREA_ID)
      const mine = room.scenarios.filter((scenario) => VEHICLE_SCENARIO_IDS.includes(scenario.id))
      expect(mine.map((scenario) => scenario.id)).toEqual([...VEHICLE_SCENARIO_IDS])
      expect(mine.every((scenario) => scenario.name.startsWith(locale === 'en' ? 'Vehicles' : 'Veículos'))).toBe(true)
    }
  })
})
