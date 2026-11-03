import type { Vec3 } from './destruction'

/** One sound a module asks the host to play. `sound` is a key in a sound bank the host knows (`weapon_shot`, `glass_break`...); a host that does not know it plays nothing. */
export interface SoundRequest {
  readonly sound: string
  /** World position; without it the sound is heard at the listener (no distance, no pan). */
  readonly position?: Vec3
  /** 0..1 level before distance falloff. Default 1. */
  readonly volume?: number
  /** Named numbers the sound's recipe reads (a caliber's energy, a zombie's pitch...). */
  readonly params?: Readonly<Record<string, number>>
  /** Seed for the sound's own random stream: same seed, same sound. */
  readonly seed?: number
  /** Seconds from now (the hit of a blow after its swing); the host schedules it on the audio clock, not on a timer. */
  readonly delay?: number
  /** Built now instead of waiting in the engine's deferred start queue: for a sound that has to land on the frame the player sees it (a blow's
   * contact, a heel strike, a landing). The queue builds a voice on the next frame budget and drops it after its latency, which at a low frame
   * rate is late or silent. Default false. */
  readonly urgent?: boolean
}

/** What `AudioSink.play` hands back; opaque to the module, given back to `stop`. */
export interface SoundHandle {
  readonly id: number
}

/** A continuous sound (rain, an engine, a crowd): created once, then driven by `set`. */
export interface LoopHandle {
  set(state: { readonly volume?: number; readonly frequency?: number; readonly params?: Readonly<Record<string, number>>; readonly position?: Vec3 }): void
  stop(): void
}

export interface AudioListener {
  readonly position: Vec3
  /** Heading in radians around the y axis. */
  readonly yaw: number
}

/**
 * The sound the host lends a module (`ModuleHost.audio`): one shared engine, so every module is mixed, limited and panned the same way.
 * Every method may do nothing (no AudioContext, muted, unknown sound), and a module must work without a sink.
 */
export interface AudioSink {
  play(request: SoundRequest): SoundHandle | null
  stop(handle: SoundHandle): void
  /** Starts a looping sound; a host without loops leaves it out. */
  loop?(sound: string, options?: { readonly position?: Vec3 }): LoopHandle
  setListener?(listener: AudioListener): void
  /** Adds a sound bank to the host's engine. `bank` is the engine's own type, `unknown` here because the contracts do not know it. */
  register?(bank: unknown): void
}
