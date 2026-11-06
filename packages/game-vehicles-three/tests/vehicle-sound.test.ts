import { describe, expect, it } from 'vitest'
import type { AudioSink, LoopHandle, SoundRequest } from '@adatechnology/game-contracts'
import { createSoundRegistry, loopRate } from '@adatechnology/game-audio'
import type { SampleSound } from '@adatechnology/game-audio'
import { CAR_ENGINE, CAR_RECORDED_RPM, CAR_START_RUN_STOP, CRASH_SPEEDS, TRUCK_ENGINE, VEHICLE_SAMPLE_ALIASES, VEHICLE_SOUND_BANK, createGearGuess, createVehicleSound, engineMix, firingHz } from '../src/audio'

type LoopCall = { sound: string; volume?: number; frequency?: number; cutoff?: number }

const fakeSink = (): { sink: AudioSink; played: SoundRequest[]; sets: LoopCall[] } => {
  const played: SoundRequest[] = []
  const sets: LoopCall[] = []
  const sink: AudioSink = {
    play: (request) => (played.push(request), { id: played.length }),
    stop: () => undefined,
    loop: (sound): LoopHandle => ({
      set: (state) => void sets.push({ sound, ...(state.volume === undefined ? {} : { volume: state.volume }), ...(state.frequency === undefined ? {} : { frequency: state.frequency }), ...(state.params?.['cutoff'] === undefined ? {} : { cutoff: state.params['cutoff'] }) }),
      stop: () => undefined,
    }),
  }
  return { sink, played, sets }
}

const lastOf = (sets: readonly LoopCall[], sound: string): LoopCall | undefined => [...sets].reverse().find((s) => s.sound === sound)

describe('engine by RPM', () => {
  it('plays every tone layer at the firing frequency of a four-stroke (rpm / 60 × cylinders / 2) times its harmonic', () => {
    expect(firingHz(CAR_ENGINE, 3000)).toBe(100)
    expect(firingHz(TRUCK_ENGINE, 1200)).toBe(60)
    const mix = engineMix(CAR_ENGINE, { rpm: 3000, throttle: 1 })
    expect(mix.slice(0, 3).map((l) => l.frequency)).toEqual([100, 100, 200])
  })

  it('crossfades the layers by RPM: the low one at idle, the high one at the redline, the sum of powers even across the range', () => {
    const level = (rpm: number, sound: string): number => engineMix(CAR_ENGINE, { rpm, throttle: 1 }).find((l) => l.sound === sound)!.volume
    expect(level(CAR_ENGINE.idleRpm, 'engine_car_low')).toBeGreaterThan(level(CAR_ENGINE.idleRpm, 'engine_car_high'))
    expect(level(CAR_ENGINE.redlineRpm, 'engine_car_high')).toBeGreaterThan(level(CAR_ENGINE.redlineRpm, 'engine_car_low'))
    expect(level(CAR_ENGINE.idleRpm, 'engine_car_high')).toBe(0)
    expect(level(CAR_ENGINE.redlineRpm, 'engine_car_low')).toBe(0)
  })

  it('is louder and brighter under load than coasting at the same RPM, and silent when stopped', () => {
    const on = engineMix(CAR_ENGINE, { rpm: 4000, throttle: 1 })
    const off = engineMix(CAR_ENGINE, { rpm: 4000, throttle: 0 })
    for (let i = 0; i < on.length; i++) {
      // a layer faded out at this RPM is silent either way
      if (on[i]!.volume === 0) continue
      expect(on[i]!.volume).toBeGreaterThan(off[i]!.volume)
      expect(on[i]!.cutoff).toBeGreaterThan(off[i]!.cutoff)
    }
    expect(engineMix(CAR_ENGINE, { rpm: 0, throttle: 1 }).every((l) => l.volume === 0)).toBe(true)
  })

  it('guesses the RPM from the speed with gears: it climbs, drops at each upshift, and stays inside idle and redline', () => {
    const guess = createGearGuess(CAR_ENGINE)
    let last = 0
    let drops = 0
    for (let v = 1; v <= 45; v += 0.25) {
      const rpm = guess.rpm(v, 1)
      expect(rpm).toBeGreaterThanOrEqual(CAR_ENGINE.idleRpm)
      expect(rpm).toBeLessThanOrEqual(CAR_ENGINE.redlineRpm)
      if (rpm < last - 500) drops++
      last = rpm
    }
    expect(guess.gear).toBe(CAR_ENGINE.rpmPerMps.length - 1)
    expect(drops).toBe(CAR_ENGINE.rpmPerMps.length - 1)
  })
})

describe('createVehicleSound', () => {
  it('turns the key: the starter first, the engine silent while it cranks, then it catches with a flare of RPM that settles to idle', () => {
    const { sink, played, sets } = fakeSink()
    const car = createVehicleSound(sink)
    car.start([0, 0, 0])
    expect(played.map((p) => p.sound)).toEqual(['engine_start'])
    car.update({ dt: 0.5, position: [0, 0, 0], speed: 0, throttle: 0 })
    expect(car.reading.running).toBe(false)
    expect(sets.filter((s) => s.sound.startsWith('engine_')).every((s) => !s.volume)).toBe(true)
    car.update({ dt: 0.3, position: [0, 0, 0], speed: 0, throttle: 0 })
    expect(car.reading.running).toBe(true)
    const flare = car.reading.rpm
    expect(flare).toBeGreaterThan(CAR_ENGINE.idleRpm * 1.5)
    for (let i = 0; i < 30; i++) car.update({ dt: 1 / 30, position: [0, 0, 0], speed: 0, throttle: 0 })
    expect(car.reading.rpm).toBe(CAR_ENGINE.idleRpm)
    expect(lastOf(sets, 'engine_car_low')!.frequency).toBeCloseTo(firingHz(CAR_ENGINE, CAR_ENGINE.idleRpm))
  })

  it('a dead engine cranks without catching; ignition off plays the run-down and silences the loops', () => {
    const { sink, played, sets } = fakeSink()
    const car = createVehicleSound(sink)
    car.start([0, 0, 0], { fail: true })
    for (let i = 0; i < 90; i++) car.update({ dt: 1 / 30, position: [0, 0, 0], speed: 0, throttle: 0 })
    expect(played.map((p) => p.sound)).toEqual(['engine_fail'])
    expect(car.reading.running).toBe(false)
    const running = createVehicleSound(sink)
    running.start([0, 0, 0])
    running.update({ dt: 1, position: [0, 0, 0], speed: 0, throttle: 0 })
    running.stop([0, 0, 0])
    running.update({ dt: 1 / 30, position: [0, 0, 0], speed: 0, throttle: 0 })
    expect(played.map((p) => p.sound)).toContain('engine_stop')
    expect(lastOf(sets, 'engine_car_low')!.volume).toBe(0)
  })

  it('follows the driver RPM when it has one, and passes the vehicle position and a cutoff to every loop', () => {
    const { sink, sets } = fakeSink()
    const car = createVehicleSound(sink)
    car.start([0, 0, 0])
    car.update({ dt: 2, position: [0, 0, 0], speed: 0, throttle: 0 })
    car.update({ dt: 1 / 30, position: [5, 0.5, 2], speed: 20, throttle: 1, rpm: 5200 })
    expect(car.reading.rpm).toBe(5200)
    expect(lastOf(sets, 'engine_car_high')!.frequency).toBeCloseTo(firingHz(CAR_ENGINE, 5200) * 2)
    expect(lastOf(sets, 'engine_car_high')!.cutoff).toBeGreaterThan(CAR_ENGINE.layers[2]!.cutoff[0])
  })

  it('crashes by speed: light below 22 km/h, medium to 50 km/h, heavy above, louder with the speed', () => {
    const { sink, played } = fakeSink()
    const car = createVehicleSound(sink)
    expect(car.crash(4, [0, 0, 0])).toBe('light')
    expect(car.crash(CRASH_SPEEDS.medium, [0, 0, 0])).toBe('medium')
    expect(car.crash(-20, [0, 0, 0])).toBe('heavy')
    expect(played.map((p) => p.sound)).toEqual(['crash_light', 'crash_medium', 'crash_heavy'])
    expect(played[2]!.volume!).toBeGreaterThan(played[0]!.volume!)
  })

  it('squeals on asphalt and hisses on dirt only when the tyres slide and the car moves; the road noise grows with the speed', () => {
    const { sink, sets } = fakeSink()
    const car = createVehicleSound(sink)
    car.update({ dt: 1 / 30, position: [0, 0, 0], speed: 15, throttle: 0, slip: 0.05 })
    expect(car.reading.levels['tire_skid_asphalt']).toBe(0)
    car.update({ dt: 1 / 30, position: [0, 0, 0], speed: 15, throttle: 0, slip: 0.8 })
    expect(car.reading.levels['tire_skid_asphalt']).toBeGreaterThan(0.1)
    car.update({ dt: 1 / 30, position: [0, 0, 0], speed: 15, throttle: 0, slip: 0.8, surface: 'dirt' })
    expect(car.reading.levels['tire_skid_asphalt']).toBe(0)
    expect(car.reading.levels['tire_skid_dirt']).toBeGreaterThan(0.1)
    car.update({ dt: 1 / 30, position: [0, 0, 0], speed: 0.1, throttle: 0, slip: 1 })
    expect(car.reading.levels['tire_skid_dirt']).toBeLessThan(0.01)
    expect(lastOf(sets, 'tire_roll')!.volume!).toBeLessThan(0.01)
  })

  it('works without a sink, and every id it plays is in the vehicle bank', () => {
    const car = createVehicleSound(undefined)
    car.start([0, 0, 0])
    car.update({ dt: 1, position: [0, 0, 0], speed: 3, throttle: 1 })
    expect(car.crash(30, [0, 0, 0])).toBe('heavy')
    const ids = new Set([...(VEHICLE_SOUND_BANK.sounds ?? []).map((s) => s.id), ...(VEHICLE_SOUND_BANK.loops ?? []).map((l) => l.id)])
    for (const id of ['engine_start', 'engine_stop', 'engine_fail', 'crash_light', 'crash_medium', 'crash_heavy', 'car_door_open', 'car_door_close', 'car_trunk_close', 'car_hood_close', 'horn_car', 'horn_truck', 'tire_skid_asphalt', 'tire_skid_dirt', 'tire_roll', ...CAR_ENGINE.layers.map((l) => l.sound), CAR_ENGINE.load.sound]) expect([id, ids.has(id)]).toEqual([id, true])
  })
})

describe('car recordings by reference', () => {
  // the manifest's file ids as the kit registers them (the files themselves stay in the game)
  const FILES = {
    id: 'kit_samples',
    samples: ['engine_loop_car_idle', 'engine_loop_car_high', 'engine_start_run_stop', 'car_door_shut', 'car_trunk_shut', 'car_door_open'].map((id) => ({
      id,
      bus: 'world' as const,
      close: [{ url: `veiculos/${id}_01.ogg` }],
      sources: ['test'],
    })),
  }

  it('each car layer plays its file at rpm / recorded rpm, and the start and stop are cut out of one recording', () => {
    const registry = createSoundRegistry([VEHICLE_SOUND_BANK, FILES])
    const rpm = 2000
    for (const layer of engineMix(CAR_ENGINE, { rpm, throttle: 0.5 }).filter((setting) => setting.frequency !== undefined)) {
      const sample = registry.sample(layer.sound)
      const recorded = layer.sound === 'engine_car_low' ? CAR_RECORDED_RPM.idle : CAR_RECORDED_RPM.high
      expect(sample?.loop, layer.sound).toBe(true)
      expect(loopRate(sample as SampleSound, layer.frequency as number), layer.sound).toBeCloseTo(rpm / recorded, 6)
      // the recipe loop of the same id plays while the file loads or where the game has none
      expect(sample?.fallback).toBe(layer.sound)
      expect(registry.loop(layer.sound)).toBeDefined()
    }
    expect(registry.sample('engine_start')?.close[0]).toMatchObject({ url: 'veiculos/engine_start_run_stop_01.ogg', ...CAR_START_RUN_STOP.start })
    expect(registry.sample('engine_stop')?.close[0]).toMatchObject(CAR_START_RUN_STOP.stop)
    expect(registry.sample('car_door_close')?.close[0]?.url).toBe('veiculos/car_door_shut_01.ogg')
    expect(registry.sample('car_trunk_close')?.close[0]?.url).toBe('veiculos/car_trunk_shut_01.ogg')
    // without recordings (no game folder, CI) every vehicle id is still its recipe
    const bare = createSoundRegistry([VEHICLE_SOUND_BANK])
    for (const alias of VEHICLE_SAMPLE_ALIASES) {
      expect(bare.sample(alias.id)).toBeUndefined()
      expect(bare.sound(alias.id) ?? bare.loop(alias.id), alias.id).toBeDefined()
    }
  })
})
