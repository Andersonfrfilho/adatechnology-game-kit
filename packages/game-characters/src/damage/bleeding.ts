import type { DestructionEvent, Vec3 } from '@adatechnology/game-contracts'

import type { SegmentId } from '../body/segment-tree'

/** A bleeding wound: `rate` in drops per second (the Arsenal's unit) fading to 0 over `duration` seconds; `spurt` pulses like an artery. */
export type Bleeder = {
  readonly part: SegmentId
  readonly rate: number
  readonly duration: number
  readonly spurt: boolean
  age: number
  /** Whole seconds of this bleeder already reported as `leak` events. */
  reported: number
}

/** Volume of one drop (a 4 mm drop of the Arsenal's blood): `leak` events carry litres per second. */
export const BLOOD_LITERS_PER_DROP = 0.00027

export const bleedRateAt = (bleeder: Bleeder): number => (bleeder.age >= bleeder.duration ? 0 : bleeder.rate * (1 - bleeder.age / bleeder.duration))

export type StepBleedingParams = {
  readonly bleeders: Bleeder[]
  readonly dt: number
  readonly emit: (event: Omit<Extract<DestructionEvent, { type: 'leak' }>, 'object' | 'time'>) => void
  readonly pointOf: (id: SegmentId) => Vec3
}

/** Ages the bleeders; each one still running reports a `leak` with its current rate once per second of its life. */
export const stepBleeding = ({ bleeders, dt, emit, pointOf }: StepBleedingParams): void => {
  for (const bleeder of bleeders) {
    if (bleeder.age >= bleeder.duration) continue
    bleeder.age += dt
    const second = Math.floor(bleeder.age)
    if (second <= bleeder.reported) continue
    bleeder.reported = second
    const rate = bleedRateAt(bleeder)
    if (rate > 0) emit({ type: 'leak', part: bleeder.part, fluid: 'blood', point: pointOf(bleeder.part), direction: [0, -1, 0], rate: rate * BLOOD_LITERS_PER_DROP, pressurized: bleeder.spurt })
  }
}
