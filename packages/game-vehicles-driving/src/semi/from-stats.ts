import { defaultSemiSpec, torqueAt } from './driver'
import type { SemiPedal, SemiSimSpec } from './types'
import { CYCLIST, drivetrainOfType, isTwoWheeler, trackStandIn, tracksOfBody, wheelsOfAxles } from './vehicle-type'
import type { AxleDimensions, TrackDimensions, VehicleType } from './vehicle-type'

/** The design ratings of a vehicle (the shape of `fleetStats` in `game-vehicles-fleet`; any object with these fields works). */
export interface DesignStats {
  /** 0-10. */
  acceleration: number
  /** 0-10. */
  handling: number
  maxSpeedKmh: number
}

export interface BodyDimensions {
  mass: number
  wheelbase: number
  track: number
  fourWheelDrive?: boolean
  /** What it is built as (a car when omitted): the wheels, the engine, the gearbox and the controller come from the type. */
  type?: VehicleType
  /** The axles of the model, front first. Without them the vehicle has two, from `wheelbase` and `track` (a single wheel each for a two-wheeler). */
  axles?: readonly AxleDimensions[]
  /** A tracked vehicle's tracks. */
  tracks?: TrackDimensions
}

/** A motorcycle is simulated with its rider on (the real 0-100 km/h figures are measured with one): the mass of a rider, an assumption of the spec. */
export const RIDER_MASS_KG = 75

/**
 * Power per kg of bike and rider by acceleration rating: the real power-to-weight of the two bikes that anchor the 0-100 km/h band of the class (`accelerationByClass.motorcycles`),
 * rating 1 the Honda PCX 160 (11.8 kW at 8 500 rpm, 132 kg: https://zigwheels.com/honda-bikes/pcx150/specifications) and rating 10 the Kawasaki Ninja 400 (33.4 kW at 10 000 rpm, 168 kg:
 * https://www.motorcyclespecs.co.za/model/kawasaki/kawasaki_ninja_400_21.html), linear in between.
 */
/** Fitted: with the real power to weight alone the physics engine's bikes take 8.6 to 8.9 s to 100 km/h at rating 9 against the 3.9-8.1 s band; 1.3 puts all ten models inside the band (evidence T6.2c). */
const MOTORCYCLE_POWER_FACTOR = 1.3
const MOTORCYCLE_POWER_RATING_1 = 11800 / (132 + RIDER_MASS_KG)
const MOTORCYCLE_POWER_RATING_10 = 33400 / (168 + RIDER_MASS_KG)
const motorcyclePower = (rating: number): number => MOTORCYCLE_POWER_FACTOR * (MOTORCYCLE_POWER_RATING_1 + ((MOTORCYCLE_POWER_RATING_10 - MOTORCYCLE_POWER_RATING_1) * (rating - 1)) / 9)

/** The default engine's power per kg at a rating: its torque per kg times its peak speed (unchanged for a car). */
const carPower = (rating: number): number => (0.06 + 0.015 * rating) * ((defaultSemiSpec.engine.peakRpm * 2 * Math.PI) / 60)

const peakTorqueOf = (type: VehicleType, rating: number, mass: number, peakRpm: number): number => {
  const power = type === 'motorcycle' ? motorcyclePower(rating) : carPower(rating)
  return (mass * power * 60) / (2 * Math.PI * peakRpm)
}

/** The cyclist with a bicycle geared so that the top gear turns the cranks at his cadence at the top speed, the lower ones a step of 1.4 apart (wheel turns per crank turn). */
const cyclistFor = (top: number, wheelRadius: number): SemiPedal => {
  const topGear = top / (2 * Math.PI * wheelRadius) / (CYCLIST.cadenceRpm / 60)
  return { ...CYCLIST, gears: [topGear / 1.4 ** 2, topGear / 1.4, topGear] }
}

const axlesOfBody = (body: BodyDimensions, twoWheeler: boolean): readonly AxleDimensions[] =>
  body.axles ?? [{ x: body.wheelbase / 2, track: twoWheeler ? 0 : body.track, radius: defaultSemiSpec.wheelRadius }, { x: -body.wheelbase / 2, track: twoWheeler ? 0 : body.track, radius: defaultSemiSpec.wheelRadius }]

/** The radius the engine turns: the driven axles' tyres (every axle's when all drive, the rear one's on a bike). */
const drivenRadius = (axles: readonly AxleDimensions[], driveAll: boolean, twoWheeler: boolean): number => {
  const driven = twoWheeler ? axles.slice(-1) : driveAll ? axles : axles.slice(1)
  return driven.reduce((sum, axle) => sum + axle.radius, 0) / driven.length
}

/**
 * A semi-simulation spec from the design ratings and the body: the grip follows the handling, the torque follows the acceleration (a motorcycle's from its real power to weight), the air drag
 * is set so that the top gear tops out at the design top speed (a bicycle's from the cyclist's watts), and the brake force follows the mass. The `type` sets the wheels (two for a bike, one
 * pair per axle for the rest, the model's own when `axles` is given), the engine and the gearbox, and a tracked vehicle gets its tracks.
 */
export function semiSpecFromStats(stats: DesignStats, body: BodyDimensions, base: Partial<SemiSimSpec> = {}): SemiSimSpec {
  const type = body.type ?? 'car'
  const mass = body.mass + (type === 'motorcycle' ? RIDER_MASS_KG : 0)
  const twoWheeler = isTwoWheeler(type)
  const drivetrain = drivetrainOfType(type)
  const tracks = type === 'tracked' && body.tracks ? tracksOfBody(body.tracks) : undefined
  const axles = axlesOfBody(body, twoWheeler)
  const driveAll = !!body.fourWheelDrive
  const wheelRadius = tracks?.roadRadius ?? drivenRadius(axles, driveAll, twoWheeler)
  const spec: SemiSimSpec = {
    ...defaultSemiSpec,
    ...(drivetrain ? { engine: { ...defaultSemiSpec.engine, ...drivetrain.engine }, gears: drivetrain.gears, finalDrive: drivetrain.finalDrive, efficiency: drivetrain.efficiency, upshiftFraction: drivetrain.upshift, downshiftFraction: drivetrain.downshift } : {}),
    ...(type === 'bicycle' ? { finalDrive: 1, efficiency: 0.95 } : {}),
    wheelRadius,
    centreHeight: twoWheeler ? 0.6 : Math.max(defaultSemiSpec.centreHeight, wheelRadius + 0.1),
    ...base,
  }
  const wheels = tracks ? trackStandIn(tracks) : wheelsOfAxles({ axles, fourWheelDrive: driveAll, twoWheeler })
  const pedal = type === 'bicycle' ? cyclistFor(stats.maxSpeedKmh / 3.6, wheelRadius) : undefined
  const peakTorque = pedal ? (pedal.watts * 60) / (2 * Math.PI * pedal.cadenceRpm) : peakTorqueOf(type, stats.acceleration, mass, spec.engine.peakRpm)
  const engine = pedal ? { idleRpm: 40, peakRpm: pedal.cadenceRpm, redlineRpm: pedal.cadenceRpm * 1.5, peakTorque } : { ...spec.engine, peakTorque }
  const top = stats.maxSpeedKmh / 3.6
  // the last gear puts the redline at the top speed
  const topShare = drivetrain?.topShare ?? 0.95
  const lastRatio = (engine.redlineRpm * topShare * 2 * Math.PI * spec.wheelRadius) / (60 * top * spec.finalDrive)
  const stack = drivetrain?.gears ?? spec.gears
  const step = drivetrain?.step ?? 1.25
  const gears = pedal ? pedal.gears.map((ratio) => 1 / ratio) : [...stack.slice(0, -1).map((g, i, all) => Math.max(g, lastRatio * step ** (all.length - i))), lastRatio]
  // a car keeps the 0.76 of its first calibration; the other types use the torque their own curve gives at the speed the last gear puts the redline at
  const torqueAtTop = type === 'car' ? peakTorque * 0.76 : torqueAt({ ...spec, engine }, engine.redlineRpm * topShare)
  const topRatio = pedal ? gears[gears.length - 1]! : lastRatio
  // a cyclist's thrust at the top speed is the sustained power over the speed; an engine's is its torque there through the last gear
  const thrust = pedal ? (pedal.watts * spec.efficiency) / top : (torqueAtTop * topRatio * spec.finalDrive * spec.efficiency) / spec.wheelRadius
  const rollingForce = spec.rolling * mass * 9.81
  const drag = Math.max(0.01, (thrust - rollingForce) / (top * top))
  // the brakes grow with the mass, so a bus is not stopped by a hatch's brakes: the default car's ratio (about 1.1 g) up to 2 t, easing to the 0.6 g of a loaded truck or bus at 10 t (the tyres still cap it)
  const carRatio = defaultSemiSpec.brakeForce / (defaultSemiSpec.mass * 9.81)
  const heavyShare = Math.max(0, Math.min(1, (mass - 2000) / 8000))
  const brakeForce = base.brakeForce ?? mass * 9.81 * (carRatio + (0.6 - carRatio) * heavyShare)
  return {
    ...spec,
    mass,
    wheels,
    fourWheelDrive: driveAll,
    engine,
    gears,
    drag,
    brakeForce,
    tyre: { ...spec.tyre, friction: 0.8 + 0.03 * stats.handling },
    ...(pedal ? { pedal } : {}),
    ...(tracks ? { tracks } : {}),
  }
}
