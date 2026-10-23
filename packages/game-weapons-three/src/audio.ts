// Weapon sounds synthesized with WebAudio: no sound files, so the kit stays offline and small. Every call is a no-op where there is no
// AudioContext (tests, workers), and the context is only created on the first sound, which comes from a click or a key (browsers allow it).

/** Sounds the weapon presentation plays. */
export interface WeaponAudio {
  /** A shot: louder and longer the more muzzle energy (joules). */
  shot(energyJ: number, category: string): void
  /** Dry click of an empty weapon. */
  click(): void
  /** Magazine out, or the first shell in. */
  reloadStart(category: string): void
  /** Magazine seated and the action racked. */
  reloadEnd(category: string): void
  /** The pump or lever cycling after a shot. */
  cycle(): void
  /** A casing bouncing on the floor. */
  clink(): void
  /** A magazine landing on the floor. */
  thud(): void
  /** Master volume, 0 to 1. */
  setVolume(volume: number): void
  dispose(): void
}

type AudioContextCtor = new () => AudioContext

const NOISE_SECONDS = 0.6

export function createWeaponAudio(volume = 0.6): WeaponAudio {
  const Ctor = (globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ?? (globalThis as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noise: AudioBuffer | null = null
  let level = volume

  const ready = (): AudioContext | null => {
    if (!Ctor) return null
    if (!ctx) {
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = level
      master.connect(ctx.destination)
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  // a filtered noise burst with a fast attack and an exponential tail
  const burst = (options: { at?: number; seconds: number; gain: number; filter: BiquadFilterType; frequency: number; q?: number }): void => {
    const audio = ready()
    if (!audio || !noise || !master) return
    const start = audio.currentTime + (options.at ?? 0)
    const source = audio.createBufferSource()
    source.buffer = noise
    const filter = audio.createBiquadFilter()
    filter.type = options.filter
    filter.frequency.value = options.frequency
    filter.Q.value = options.q ?? 0.8
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(options.gain, start + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.seconds)
    source.connect(filter).connect(gain).connect(master)
    source.start(start)
    source.stop(start + options.seconds + 0.05)
  }

  const tone = (options: { at?: number; seconds: number; gain: number; frequency: number; to?: number; type?: OscillatorType }): void => {
    const audio = ready()
    if (!audio || !master) return
    const start = audio.currentTime + (options.at ?? 0)
    const osc = audio.createOscillator()
    osc.type = options.type ?? 'sine'
    osc.frequency.setValueAtTime(options.frequency, start)
    if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, start + options.seconds)
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(options.gain, start + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.seconds)
    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(start + options.seconds + 0.05)
  }

  const metal = (at: number, frequency: number, gain: number): void => {
    burst({ at, seconds: 0.05, gain, filter: 'highpass', frequency, q: 2 })
    tone({ at, seconds: 0.04, gain: gain * 0.6, frequency: frequency * 0.6, type: 'square' })
  }

  return {
    shot(energyJ, category) {
      // 200 J (.22) to 15 000 J (.50 BMG) mapped to 0..1
      const k = Math.min(1, Math.max(0, Math.log10(Math.max(energyJ, 50) / 50) / 2.5))
      const shotgun = category === 'shotgun'
      burst({ seconds: 0.12 + k * 0.35 + (shotgun ? 0.1 : 0), gain: 0.5 + k * 0.5, filter: 'lowpass', frequency: 4200 - k * 2600 })
      burst({ seconds: 0.03, gain: 0.6, filter: 'highpass', frequency: 3000 })
      tone({ seconds: 0.14 + k * 0.2, gain: 0.35 + k * 0.4, frequency: 140 - k * 70, to: 40 })
    },
    click() {
      metal(0, 2600, 0.25)
    },
    reloadStart(category) {
      metal(0, 1500, 0.35)
      if (category !== 'shotgun' && category !== 'revolver') metal(0.12, 900, 0.2)
    },
    reloadEnd(category) {
      metal(0, 1100, 0.45)
      if (category !== 'revolver') metal(0.18, 1900, 0.4)
    },
    cycle() {
      metal(0.22, 900, 0.35)
      metal(0.36, 1300, 0.35)
    },
    clink() {
      const f = 3200 + Math.random() * 2000
      tone({ seconds: 0.09, gain: 0.12, frequency: f })
      tone({ seconds: 0.06, gain: 0.06, frequency: f * 2.7 })
    },
    thud() {
      burst({ seconds: 0.09, gain: 0.35, filter: 'lowpass', frequency: 380 })
    },
    setVolume(next) {
      level = Math.max(0, Math.min(1, next))
      if (master) master.gain.value = level
    },
    dispose() {
      void ctx?.close()
      ctx = null
      master = null
      noise = null
    },
  }
}
