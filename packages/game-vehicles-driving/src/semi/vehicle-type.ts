import type { SemiPedal, SemiSimSpec, SemiTracks, SemiWheel } from './types'

/** What a vehicle is built as: the wheels it has, the engine and gearbox it carries, how it is driven. A car when a body says nothing. */
export type VehicleType = 'car' | 'motorcycle' | 'bicycle' | 'truck' | 'tractor' | 'tracked'

/** One axle as the model has it: metres ahead of the middle of the vehicle, the distance between its outer wheels (0 for a single wheel) and the radius of its tyres. */
export interface AxleDimensions {
  readonly x: number
  readonly track: number
  readonly radius: number
}

/** The tracks as the model has them (x ahead of the middle of the vehicle). */
export interface TrackDimensions {
  readonly gauge: number
  readonly rearX: number
  readonly frontX: number
  readonly roadWheels: number
  readonly radius: number
}

/** A cyclist sustains this much: the middle of the 150-400 W range of design 14.2 (specs/008-motor-fisico-jolt/design/veiculos.md), at the cadence and with the gears of the T6.2 bicycle test. */
export const CYCLIST: SemiPedal = { watts: 250, cadenceRpm: 80, gears: [1.5, 2.5, 3.5] }

/** The engine and gearbox a type carries (five gears at most: the physics engine's automatic gearbox stops upshifting with six, measured on the scooter in specs/008 evidence T6.2c): the speeds the engine turns at, the gears below the top one (the top gear is set by the top speed) and the final drive. */
export interface TypeDrivetrain {
  readonly engine: Pick<SemiSimSpec['engine'], 'idleRpm' | 'peakRpm' | 'redlineRpm'>
  readonly gears: readonly number[]
  readonly finalDrive: number
  readonly efficiency: number
  /** The ratio between neighbouring gears from the top gear down: the steps of the box. */
  readonly step: number
  /** Share of the redline the engine turns at in the top gear at the top speed: the rest is headroom for the tyre's slip (a slipping wheel spins the engine past the limiter). */
  readonly topShare: number
  /** Shifts, shares of the redline. */
  readonly upshift: number
  readonly downshift: number
}

const MOTORCYCLE: TypeDrivetrain = { engine: { idleRpm: 1300, peakRpm: 7500, redlineRpm: 10000 }, gears: [2.8, 2.0, 1.5, 1.2, 1.0], finalDrive: 3, efficiency: 0.9, step: 1.25, topShare: 0.8, upshift: 0.6, downshift: 0.3 }
const TRUCK: TypeDrivetrain = { engine: { idleRpm: 600, peakRpm: 1500, redlineRpm: 2500 }, gears: [7, 4.7, 3.2, 2.2, 1.5], finalDrive: 4.5, efficiency: 0.85, step: 1.5, topShare: 0.95, upshift: 0.85, downshift: 0.35 }
const TRACTOR: TypeDrivetrain = { engine: { idleRpm: 800, peakRpm: 1600, redlineRpm: 2300 }, gears: [7, 4.7, 3.2, 2.2, 1.5], finalDrive: 4.5, efficiency: 0.85, step: 1.5, topShare: 0.95, upshift: 0.85, downshift: 0.35 }
const TRACKED: TypeDrivetrain = { engine: { idleRpm: 600, peakRpm: 1500, redlineRpm: 2500 }, gears: [7, 4.7, 3.2, 2.2, 1.5], finalDrive: 4.5, efficiency: 0.85, step: 1.5, topShare: 0.95, upshift: 0.85, downshift: 0.35 }

/** The drivetrain of a type; undefined for a car (the semi-simulation's own defaults) and a bicycle (the cyclist). */
export const drivetrainOfType = (type: VehicleType): TypeDrivetrain | undefined => {
  if (type === 'motorcycle') return MOTORCYCLE
  if (type === 'truck') return TRUCK
  if (type === 'tractor') return TRACTOR
  if (type === 'tracked') return TRACKED
  return undefined
}

/** A two-wheeler has no track: a single wheel on the centre line per axle. */
export const isTwoWheeler = (type: VehicleType): boolean => type === 'motorcycle' || type === 'bicycle'

export interface WheelPlanParams {
  readonly axles: readonly AxleDimensions[]
  readonly fourWheelDrive: boolean
  readonly twoWheeler: boolean
}

/** The wheels of a vehicle from its axles (front first): the front axle steers, the others drive unless all do, and the last one holds the handbrake. A bike drives its rear wheel only. */
export const wheelsOfAxles = ({ axles, fourWheelDrive, twoWheeler }: WheelPlanParams): SemiWheel[] => {
  const front = axles[0]!.x
  const rear = axles[axles.length - 1]!.x
  const middle = (front + rear) / 2
  return axles.flatMap((axle, index): SemiWheel[] => {
    const isFront = index === 0
    const isRear = index === axles.length - 1
    const common = { x: axle.x - middle, ...(isFront ? { steer: true } : {}), ...(isRear ? { handbrake: true } : {}) }
    const drive = twoWheeler ? isRear : fourWheelDrive || !isFront
    const wheel = (z: number): SemiWheel => ({ ...common, z, ...(drive ? { drive: true } : {}) })
    return axle.track > 0 ? [wheel(-axle.track / 2), wheel(axle.track / 2)] : [wheel(0)]
  })
}

/** The four-wheel stand-in of a tracked vehicle for the semi-simulation: two wheels a side at the ends of the track, the front pair steering. */
export const trackStandIn = (tracks: SemiTracks): SemiWheel[] => {
  const side = tracks.gauge / 2
  return [
    { x: tracks.frontX, z: -side, steer: true, drive: true },
    { x: tracks.frontX, z: side, steer: true, drive: true },
    { x: tracks.rearX, z: -side, drive: true, handbrake: true },
    { x: tracks.rearX, z: side, drive: true, handbrake: true },
  ]
}

/** The tracks of a body re-centred on the middle of the track run. */
export const tracksOfBody = (tracks: TrackDimensions): SemiTracks => {
  const middle = (tracks.frontX + tracks.rearX) / 2
  return { gauge: tracks.gauge, rearX: tracks.rearX - middle, frontX: tracks.frontX - middle, roadWheels: tracks.roadWheels, roadRadius: tracks.radius }
}
