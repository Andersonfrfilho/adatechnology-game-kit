// A bullet passing the listener without hitting: a supersonic one cracks (its shock wave, a sharp "crack" heard before the muzzle report), a
// subsonic one whizzes (a short "fiu" sliding down as it passes). Pure; the sample ids are `bullet_crack_by` and `bullet_whiz` (checklist-sons.md 5.1).
import { SPEED_OF_SOUND } from './gunshot'

export interface FlybyInput {
  /** Bullet speed where it passes the listener, m/s. */
  readonly speed: number
  /** Closest distance from the bullet path to the listener's head, metres. Past `maxMiss` nothing is heard. */
  readonly miss: number
  /** Pitch factor around 1. */
  readonly pitch?: number
  /** Default 6 m. */
  readonly maxMiss?: number
}

export interface FlybyVoice {
  readonly kind: 'noise' | 'tone'
  readonly filter?: 'highpass' | 'bandpass'
  readonly frequency: number
  readonly to?: number
  readonly q?: number
  readonly gain: number
  readonly seconds: number
}

export interface FlybySound {
  readonly supersonic: boolean
  readonly sample: 'bullet_crack_by' | 'bullet_whiz'
  readonly voices: readonly FlybyVoice[]
}

export function computeFlyby(input: FlybyInput): FlybySound | null {
  const maxMiss = input.maxMiss ?? 6
  if (input.miss > maxMiss || input.speed <= 0) return null
  const near = 1 / (1 + input.miss / 1.5)
  const pitch = input.pitch ?? 1
  if (input.speed > SPEED_OF_SOUND * 1.05) {
    // the N-wave: a very short, very bright snap, louder the closer and the faster
    const gain = 0.7 * near * Math.min(1.3, input.speed / 800)
    return {
      supersonic: true,
      sample: 'bullet_crack_by',
      voices: [
        { kind: 'noise', filter: 'highpass', frequency: 3000 * pitch, q: 0.7, gain, seconds: 0.012 },
        { kind: 'noise', filter: 'bandpass', frequency: 1800 * pitch, q: 1.2, gain: gain * 0.35, seconds: 0.05 },
      ],
    }
  }
  // the whiz: a band of noise and a faint tone sliding down (Doppler) over the pass
  const gain = 0.22 * near
  const seconds = 0.12 + 0.05 * input.miss
  return {
    supersonic: false,
    sample: 'bullet_whiz',
    voices: [
      { kind: 'noise', filter: 'bandpass', frequency: 2400 * pitch, q: 4, gain, seconds },
      { kind: 'tone', frequency: 1500 * pitch, to: 900 * pitch, gain: gain * 0.35, seconds },
    ],
  }
}
