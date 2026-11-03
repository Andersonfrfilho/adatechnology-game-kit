import type { ProvingRange, ProvingSubject } from './types'

const lerpTable = (table: ReadonlyArray<readonly [number, number]>, x: number): number => {
  if (x <= table[0]![0]) return table[0]![1]
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!
    const [x0, y0] = table[i - 1]!
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return table[table.length - 1]![1]
}

/**
 * The numbers the ranges come from. Real-world bands for road vehicles (a family car stops from 100 km/h in 35-45 m, turns in 10-11 m, a hatch reaches 100 km/h in about 10 s); every one can
 * be replaced per class through `createProvingTests({ ranges })`.
 */
export interface RangeTable {
  /** 0-100 km/h seconds by the card's acceleration rating (0-10). */
  accelerationSeconds: ReadonlyArray<readonly [number, number]>
  /** Accepted spread around the expected 0-100 time (0.35 = ±35 %). */
  accelerationSpread: number
  /** Accepted spread around the card's top speed. */
  topSpeedSpread: number
  /** Braking deceleration on dry asphalt, m/s², by class. */
  dryBrake: Readonly<Record<string, readonly [number, number]>>
  /** Braking deceleration on wet asphalt, m/s², by class. */
  wetBrake: Readonly<Record<string, readonly [number, number]>>
  /** Turning circle diameter, metres, by class. */
  turnCircle: Readonly<Record<string, readonly [number, number]>>
  /** Metres a four-wheel-drive vehicle has to cover in the mud test. */
  mudFourWheelDrive: number
}

export const defaultRangeTable: RangeTable = {
  accelerationSeconds: [
    [1, 34],
    [3, 21],
    [5, 14],
    [7, 10],
    [9, 6],
    [10, 4.2],
  ],
  accelerationSpread: 0.35,
  topSpeedSpread: 0.1,
  dryBrake: { default: [6.5, 11], heavy: [4.5, 8.5], agricultural: [3.5, 7.5], military: [4.5, 9] },
  wetBrake: { default: [3.5, 8.5], heavy: [2.5, 7], agricultural: [2, 6], military: [2.5, 7] },
  turnCircle: { default: [7, 13.5], motorcycles: [3, 9], suvs: [9, 15], pickups: [9, 16], vans: [9, 15], heavy: [10, 26], military: [9, 24], agricultural: [6, 16] },
  mudFourWheelDrive: 10,
}

const byClass = <T>(table: Readonly<Record<string, T>>, category: string): T => (table[category] ?? table.default) as T

/** Expected 0-100 (or 0-`target`) seconds for a subject. Below 100 km/h the time scales linearly with the target speed. */
export const expectedAcceleration = (table: RangeTable, subject: ProvingSubject, target: number): number => {
  const base = lerpTable(table.accelerationSeconds, subject.stats.acceleration)
  return base * (target / 100)
}

export const accelerationRange = (table: RangeTable, subject: ProvingSubject, target: number): ProvingRange => {
  const t = expectedAcceleration(table, subject, target)
  return { min: round(t * (1 - table.accelerationSpread)), max: round(t * (1 + table.accelerationSpread)) }
}

export const topSpeedRange = (table: RangeTable, subject: ProvingSubject): ProvingRange => ({
  min: round(subject.stats.maxSpeedKmh * (1 - table.topSpeedSpread)),
  max: round(subject.stats.maxSpeedKmh * (1 + table.topSpeedSpread)),
})

/** Stopping distance band from `kmh` for the class's deceleration band. */
export const brakeRange = (decel: readonly [number, number], kmh: number): ProvingRange => {
  const v = kmh / 3.6
  return { min: round((v * v) / (2 * decel[1])), max: round((v * v) / (2 * decel[0])) }
}

export const dryBrakeRange = (table: RangeTable, subject: ProvingSubject, kmh: number): ProvingRange => brakeRange(byClass(table.dryBrake, subject.category), kmh)
export const wetBrakeRange = (table: RangeTable, subject: ProvingSubject, kmh: number): ProvingRange => brakeRange(byClass(table.wetBrake, subject.category), kmh)
export const turnCircleRange = (table: RangeTable, subject: ProvingSubject): ProvingRange => {
  const [min, max] = byClass(table.turnCircle, subject.category)
  return { min, max }
}

export const inRange = (value: number, range: ProvingRange): boolean => (range.min == null || value >= range.min) && (range.max == null || value <= range.max)

export const round = (x: number, digits = 1): number => {
  const k = 10 ** digits
  return Math.round(x * k) / k
}
