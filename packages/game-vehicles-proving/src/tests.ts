import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'
import type { SemiInput, SemiState } from '@adatechnology/game-vehicles-driving'

import { accelerationRange, defaultRangeTable, dryBrakeRange, round, topSpeedRange, turnCircleRange, wetBrakeRange } from './ranges'
import type { RangeTable } from './ranges'
import type { ProvingMemo, ProvingProcedure, ProvingSubject, ProvingTest } from './types'

const KMH = 3.6
const idle: SemiInput = { throttle: 0, brake: 0, steer: 0, handbrake: false }
const kmh = (s: SemiState): number => Math.abs(s.u) * KMH
const travelled = (s: SemiState, memo: ProvingMemo, key: string): number => Math.hypot(s.x - (memo[`${key}X`] as number), s.z - (memo[`${key}Z`] as number))

/** Speed a run aims for: `wanted`, or 80 % of the vehicle's top speed when it cannot reach it (a tractor, a bicycle). */
const reachable = (subject: ProvingSubject, wanted: number): number => Math.min(wanted, Math.round(subject.stats.maxSpeedKmh * 0.8))

/** Accelerates to the target, then brakes flat out in a straight line; the value is the distance from the first metre of braking to the stop. */
const brakeFrom = (wanted: number, surface?: string): ProvingProcedure => ({
  ...(surface ? { surface } : {}),
  maxSeconds: 90,
  target: (subject) => reachable(subject, wanted),
  input(state, _time, memo) {
    if (!memo.braking && kmh(state) >= memo.target) {
      memo.braking = true
      memo.brakeX = state.x
      memo.brakeZ = state.z
    }
    return memo.braking ? { ...idle, brake: 1 } : { ...idle, throttle: 1 }
  },
  sample: (state) => kmh(state),
  finished: (state, _t, memo) => !!memo.braking && kmh(state) < 0.3,
  value: (state, _t, memo) => (memo.braking ? round(travelled(state, memo, 'brake')) : null),
})

/** The tests of the kit. Every number comes from the range table; a game replaces the table, patches a test or adds its own. */
export function defaultProvingTests(ranges: RangeTable = defaultRangeTable): ProvingTest[] {
  return [
    {
      id: 'accel_0_100',
      kind: 'measured',
      domains: ['land'],
      unit: 's',
      procedure: {
        maxSeconds: 90,
        target: (subject) => reachable(subject, 100),
        input: () => ({ ...idle, throttle: 1 }),
        sample: (state) => kmh(state),
        finished: (state, _t, memo) => kmh(state) >= memo.target,
        value: (state, time, memo) => (kmh(state) >= memo.target ? round(time, 2) : null),
      },
      range: (subject) => accelerationRange(ranges, subject, reachable(subject, 100)),
    },
    {
      id: 'top_speed',
      kind: 'measured',
      domains: ['land'],
      unit: 'km/h',
      procedure: {
        maxSeconds: 150,
        input: () => ({ ...idle, throttle: 1 }),
        sample: (state) => kmh(state),
        // stops when the speed has grown less than 0.5 km/h in the last 4 seconds
        finished(state, time, memo) {
          const history = (memo.history ??= []) as Array<[number, number]>
          history.push([time, kmh(state)])
          while (history.length > 1 && time - history[0]![0] > 4) history.shift()
          memo.best = Math.max((memo.best as number | undefined) ?? 0, kmh(state))
          return time > 8 && history.length > 1 && kmh(state) - history[0]![1] < 0.5
        },
        value: (_state, _t, memo) => round((memo.best as number | undefined) ?? 0),
      },
      range: (subject) => topSpeedRange(ranges, subject),
    },
    {
      id: 'brake_100_0',
      kind: 'measured',
      domains: ['land'],
      unit: 'm',
      procedure: brakeFrom(100),
      range: (subject) => dryBrakeRange(ranges, subject, reachable(subject, 100)),
    },
    {
      id: 'turn_circle',
      kind: 'measured',
      domains: ['land'],
      unit: 'm',
      procedure: {
        maxSeconds: 30,
        target: () => 12,
        // full lock at a walking pace, the throttle holding 12 km/h; after the circle settles the diameter is twice the speed over the yaw rate
        input: (state, _t, memo) => ({ ...idle, steer: 1, throttle: kmh(state) < memo.target ? 0.5 : 0, brake: kmh(state) > memo.target + 3 ? 0.3 : 0 }),
        sample: (state) => (Math.abs(state.yawRate) > 1e-3 ? (2 * Math.abs(state.u)) / Math.abs(state.yawRate) : 0),
        finished(state, time, memo) {
          if (time < 6) return false
          const d = Math.abs(state.yawRate) > 1e-3 ? (2 * Math.abs(state.u)) / Math.abs(state.yawRate) : Infinity
          const samples = (memo.samples ??= []) as number[]
          samples.push(d)
          return samples.length > 240
        },
        value(_state, _t, memo) {
          const samples = (memo.samples as number[] | undefined) ?? []
          if (!samples.length) return null
          return round(samples.reduce((a, b) => a + b, 0) / samples.length)
        },
      },
      range: (subject) => turnCircleRange(ranges, subject),
    },
    {
      id: 'wet_brake_80_0',
      kind: 'measured',
      domains: ['land'],
      unit: 'm',
      procedure: brakeFrom(80, 'wet_asphalt'),
      range: (subject) => wetBrakeRange(ranges, subject, reachable(subject, 80)),
    },
    {
      id: 'mud_traction',
      kind: 'measured',
      domains: ['land'],
      unit: 'm',
      procedure: {
        surface: 'mud',
        maxSeconds: 10,
        input: () => ({ ...idle, throttle: 1 }),
        sample: (state) => kmh(state),
        finished: () => false,
        value: (state) => round(Math.hypot(state.x, state.z)),
      },
      // a four-wheel-drive vehicle has to get through; a two-wheel-drive one sinks, which is right, so it has no band
      range: (subject) => (subject.body.fourWheelDrive ? { min: ranges.mudFourWheelDrive } : {}),
    },
    // seen by a person in the test room and signed off with a print
    { id: 'cabin', kind: 'visual', domains: ['land', 'water', 'air'], unit: '' },
    { id: 'cameras', kind: 'visual', domains: ['land', 'water', 'air'], unit: '' },
    { id: 'mirrors', kind: 'visual', domains: ['land'], unit: '' },
    // rooms of the next phases: pending until each room reports
    { id: 'terrain', kind: 'room', domains: ['land'], unit: '', available: false },
    { id: 'wind_tunnel', kind: 'room', domains: ['land', 'air'], unit: '', available: false },
    { id: 'crash_test', kind: 'room', domains: ['land'], unit: '', available: false },
    { id: 'pedestrian', kind: 'room', domains: ['land'], unit: '', available: false },
    { id: 'performance', kind: 'room', domains: ['land', 'water', 'air'], unit: '', available: false },
    { id: 'buoyancy', kind: 'room', domains: ['water'], unit: '', available: false },
    { id: 'flight', kind: 'room', domains: ['air'], unit: '', available: false },
  ]
}

export interface ProvingTestOptions {
  /** Replaces numbers of the range table (`{ turnCircle: { heavy: [12, 28] } }`). Nested tables are merged by class. */
  ranges?: Partial<RangeTable>
  /** Tests a game adds (or replaces by id). */
  packs?: ReadonlyArray<{ tests?: readonly ProvingTest[] }>
  patch?: Readonly<Record<string, Partial<ProvingTest>>>
  remove?: readonly string[]
}

export interface ProvingTestRegistry {
  readonly tests: readonly ProvingTest[]
  get(id: string): ProvingTest | undefined
  /** The tests that apply to a domain, in order. */
  forDomain(domain: ProvingSubject['domain']): ProvingTest[]
  readonly ranges: RangeTable
}

export function createProvingTests(options: ProvingTestOptions = {}): ProvingTestRegistry {
  const given = options.ranges ?? {}
  const ranges: RangeTable = {
    ...defaultRangeTable,
    ...given,
    dryBrake: { ...defaultRangeTable.dryBrake, ...given.dryBrake },
    wetBrake: { ...defaultRangeTable.wetBrake, ...given.wetBrake },
    turnCircle: { ...defaultRangeTable.turnCircle, ...given.turnCircle },
  }
  const entries = mergeById(defaultProvingTests(ranges), options.packs?.flatMap((pack) => pack.tests ?? []))
  applyPatches(entries, options.patch)
  removeIds(entries, options.remove)
  const list = (): ProvingTest[] => [...entries.values()]
  return {
    get tests() {
      return list()
    },
    get: (id) => entries.get(id),
    forDomain: (domain) => list().filter((t) => t.domains.includes(domain)),
    ranges,
  }
}
