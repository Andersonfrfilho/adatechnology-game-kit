import type { AudioSink, LoopHandle, Vec3 } from '@adatechnology/game-contracts'

import { createGearGuess, engineMix } from './engine-mix'
import { CAR_ENGINE, CRASH_SPEEDS, DEFAULT_VEHICLE_SOUND_KEYS } from './profiles'
import type { EngineProfile, VehicleSoundKeys } from './profiles'

/** What the vehicle is doing this frame. Without `rpm` (a driver with no engine model) the RPM is guessed from the speed through the profile's gears. */
export type VehicleSoundFrame = {
  readonly dt: number
  readonly position: Vec3
  /** m/s, signed or not. */
  readonly speed: number
  /** 0..1. */
  readonly throttle: number
  readonly rpm?: number
  /** 0..1: how much the tyres slide (the largest wheel slip; 1 = locked or spinning). */
  readonly slip?: number
  /** What the tyres are on: `dirt` for earth, gravel, sand or grass; anything else squeals as asphalt. */
  readonly surface?: 'asphalt' | 'dirt'
}

export type VehicleSoundOptions = {
  readonly profile?: EngineProfile
  /** Any of the one-shot and tyre ids, pointed at other sounds. */
  readonly sounds?: Partial<VehicleSoundKeys>
  /** Seconds the starter turns before the engine catches (the `engine_start` recipe catches at 0.75 s). */
  readonly crankSeconds?: number
}

/** What was asked of the sink, for the checks and the bench: the RPM in use and the level of each loop. */
export type VehicleSoundReading = {
  readonly running: boolean
  readonly rpm: number
  readonly levels: Readonly<Record<string, number>>
}

export type VehicleSound = {
  /** Turns the key: the starter, then the engine catches with a flare of RPM. `fail` cranks without catching (no fuel, a dead engine). */
  start(position: Vec3, options?: { readonly fail?: boolean }): void
  /** Ignition off: the engine runs down. */
  stop(position: Vec3): void
  /** A hit at `speed` m/s: light, medium or heavy by speed, louder with it. */
  crash(speed: number, position: Vec3): 'light' | 'medium' | 'heavy'
  update(frame: VehicleSoundFrame): void
  readonly reading: VehicleSoundReading
  dispose(): void
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * The sounds of one vehicle on a host's sink (`ModuleHost.audio`): the engine loops by RPM and load, the starter, the tyres skidding and rolling,
 * and crashes by speed. The loops are placed at the vehicle every frame (distance and side come from the sink). Works without a sink (silent).
 */
export function createVehicleSound(audio: AudioSink | undefined, options: VehicleSoundOptions = {}): VehicleSound {
  const profile = options.profile ?? CAR_ENGINE
  const keys = { ...DEFAULT_VEHICLE_SOUND_KEYS, ...options.sounds }
  const crankSeconds = options.crankSeconds ?? 0.75
  const gears = createGearGuess(profile)
  const loops = new Map<string, LoopHandle>()
  const levels: Record<string, number> = {}
  // running: the engine turns; cranking counts down the starter; flare is the RPM the engine overshoots to as it catches
  const state = { running: false, cranking: 0, catches: false, flare: 0, rpm: 0 }

  const loopOf = (sound: string): LoopHandle | undefined => {
    let handle = loops.get(sound)
    if (!handle && audio?.loop) {
      handle = audio.loop(sound)
      loops.set(sound, handle)
    }
    return handle
  }
  const setLoop = (sound: string, volume: number, position: Vec3, extra: { frequency?: number; cutoff?: number } = {}): void => {
    levels[sound] = volume
    // a silent loop that was never made stays unmade
    if (volume <= 0 && !loops.has(sound)) return
    loopOf(sound)?.set({ volume, position, ...(extra.frequency === undefined ? {} : { frequency: extra.frequency }), ...(extra.cutoff === undefined ? {} : { params: { cutoff: extra.cutoff } }) })
  }
  const play = (sound: string, position: Vec3, volume = 1): void => void audio?.play({ sound, position, volume })

  return {
    start(position, startOptions = {}) {
      if (state.running || state.cranking > 0) return
      state.catches = !startOptions.fail
      state.cranking = state.catches ? crankSeconds : 1.7
      play(state.catches ? keys.start : keys.fail, position)
    },
    stop(position) {
      if (!state.running && state.cranking <= 0) return
      state.running = false
      state.cranking = 0
      play(keys.stop, position)
    },
    crash(speed, position) {
      const v = Math.abs(speed)
      const kind = v >= CRASH_SPEEDS.heavy ? 'heavy' : v >= CRASH_SPEEDS.medium ? 'medium' : 'light'
      play(kind === 'heavy' ? keys.crashHeavy : kind === 'medium' ? keys.crashMedium : keys.crashLight, position, Math.min(1, 0.35 + v / 20))
      return kind
    },
    update(frame) {
      if (state.cranking > 0) {
        state.cranking -= frame.dt
        if (state.cranking <= 0 && state.catches) {
          state.running = true
          state.flare = 1
        }
      }
      state.flare = Math.max(0, state.flare - frame.dt / 0.9)
      const throttle = clamp01(frame.throttle)
      const driven = frame.rpm ?? gears.rpm(frame.speed, throttle)
      // as it catches the engine overshoots to ~2.2× idle and settles back
      const rpm = state.running ? Math.max(driven, profile.idleRpm * (1 + 1.2 * state.flare * state.flare)) : 0
      state.rpm = rpm
      for (const layer of engineMix(profile, { rpm, throttle: Math.max(throttle, state.flare * 0.6) })) {
        setLoop(layer.sound, layer.volume, frame.position, { ...(layer.frequency === undefined ? {} : { frequency: layer.frequency }), cutoff: layer.cutoff })
      }
      const speed = Math.abs(frame.speed)
      // a slide squeals once the slip passes ~15% and the car moves; on dirt it is a hiss, not a squeal
      const slide = clamp01(((frame.slip ?? 0) - 0.15) / 0.5) * clamp01(speed / 4)
      const dirt = frame.surface === 'dirt'
      setLoop(keys.skidAsphalt, dirt ? 0 : 0.16 * slide, frame.position, { cutoff: 1700 + 600 * slide })
      setLoop(keys.skidDirt, dirt ? 0.2 * slide : 0, frame.position, { cutoff: 500 + 500 * slide })
      // road noise grows with the speed and gets brighter
      setLoop(keys.roll, 0.06 * clamp01(speed / 25), frame.position, { cutoff: 250 + 45 * Math.min(speed, 40) })
    },
    get reading() {
      return { running: state.running, rpm: state.rpm, levels: { ...levels } }
    },
    dispose() {
      for (const handle of loops.values()) handle.stop()
      loops.clear()
    },
  }
}
