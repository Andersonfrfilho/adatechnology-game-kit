import type { BodyDesc, Curve, VehicleDesc, WheelDesc } from '@adatechnology/game-physics'

import { FLAT_BELOW, RIM_FRICTION, RIM_RADIUS_SHARE, torqueAt } from './semi/driver'
import type { SemiSimSpec, SemiWheel, VehicleCondition } from './semi/types'

const GRAVITY = 9.81
/** Where the torque curve still gives its torque before the redline cuts it (rpm under the redline). */
const CURVE_CUT_GAP_RPM = 1
/** Share of the brake force the front axle takes, and of the handbrake force each locked wheel takes. */
const FRONT_BRAKE_SHARE = 0.6
const HANDBRAKE_SHARE = 0.5
/** Suspension travel left when fully compressed, as a share of the free length. */
const SUSPENSION_MIN_SHARE = 0.4
/** The most of the free length the static sag may take. */
const MAX_SAG = 0.5
/** A motorcycle's lean spring and damper per kg m^2 of roll inertia (measured: the engine's own values are for a real bike's inertia), and its lean limit. */
const LEAN_SPRING_PER_INERTIA = 400
const LEAN_DAMPING_PER_INERTIA = 40
const LEAN_LIMIT = 0.7
const WHEEL_WIDTH = 0.2
const CLUTCH_STRENGTH = 10
const CLUTCH_SLIP = 0.03
const BICYCLE_WHEEL_INERTIA = 0.1
/** A wheel with its tyre and brake weighs about 1.5% of the vehicle: its inertia `1/2 m r^2` is this per kg of the vehicle at a 0.32 m radius (0.83 kg m^2 on a 1 t car; the engine's own 0.9 is a car's, and four of them on a 150 kg bike weigh as much as the bike). */
const WHEEL_INERTIA_PER_MASS = 0.0008
const REFERENCE_RADIUS = 0.32
const MIN_WHEEL_INERTIA = 0.02
/** The wheels' spin damping: the engine's own (0.2) is a drag of 7.8 N per m/s on a car's four wheels (0.4 kN at 50 m/s) the spec's rolling resistance already covers. */
const WHEEL_DAMPING = 0.02
/** The engine's friction: the semi-simulation has none beyond its efficiency (the engine's own, 0.2, would take 85 N m of a 187 N m engine at 4 000 rpm). */
const ENGINE_DAMPING = 0.005
/** The engine's rotating mass per N m of peak torque (kg m^2): 0.19 for a 190 N m car engine; the engine's own 0.5 is a third of a ton of inertia in first gear on a car and a ton on a bike. */
const ENGINE_INERTIA_PER_TORQUE = 0.001
/** What a worn engine and a worn suspension keep of their torque and of their spring and damper (the semi-simulation's own floors). */
const ENGINE_FLOOR = 0.55
const SUSPENSION_FLOOR = 0.5

/** A cyclist as the engine: sustained power at the cadence it is held, and the bicycle's gears (wheel turns per crank turn, lowest first). */
export interface PedalOptions {
  readonly watts: number
  readonly cadenceRpm: number
  readonly gears: readonly number[]
}

export interface VehicleFromSemiOptions {
  /** The body: shape, pose, user, velocity, layer. Its origin is the centre of mass (`centreAtOrigin` is set); mass and inertia come from the spec. */
  readonly chassis: Omit<BodyDesc, 'motion' | 'mass' | 'inertia' | 'centreAtOrigin'>
  /** What is wrong with it now: a flat tyre or a bare rim rides on the rim's radius with its grip, a worn engine gives less, worn brakes brake less. */
  readonly condition?: VehicleCondition
  readonly wheelWidth?: number
  /** Rotational inertia of each wheel with its tyre, kg m^2: by default 0.0008 per kg of the vehicle (a bicycle: 0.1). */
  readonly wheelInertia?: number
  /** A bicycle's engine in place of `spec.engine`. */
  readonly pedal?: PedalOptions
}

/** The clutch passes `strength x (engine speed - wheel speed)`: strong enough that the full torque goes through with 3% of slip at the top of the range (never under the engine's own 10: a bicycle's 28 N m at 120 rpm needs 75). */
const clutchFor = (peakTorque: number, maxRpm: number): number => Math.max(CLUTCH_STRENGTH, peakTorque / (CLUTCH_SLIP * ((maxRpm * 2 * Math.PI) / 60)))

const clamp = (x: number, low: number, high: number): number => Math.max(low, Math.min(high, x))

const torqueCurve = (spec: SemiSimSpec): Curve => {
  const { idleRpm, peakRpm, redlineRpm, peakTorque } = spec.engine
  const at = (rpm: number): number => torqueAt(spec, rpm) / peakTorque
  return [[0, at(0)], [idleRpm / redlineRpm, at(idleRpm)], [peakRpm / redlineRpm, at(peakRpm)], [(redlineRpm - CURVE_CUT_GAP_RPM) / redlineRpm, at(redlineRpm - CURVE_CUT_GAP_RPM)], [1, 0]]
}

/** Grip across the wheel by slip angle (degrees): rising to `friction` where `corneringStiffness` says, then easing to 0.75 of it sideways. */
const lateralCurve = (friction: number, corneringStiffness: number): Curve => [[0, 0], [((friction / corneringStiffness) * 180) / Math.PI, friction], [90, 0.75 * friction]]

/** Grip along the wheel by slip ratio: the peak at 6% slip, 0.8 of it locked. */
const longitudinalCurve = (friction: number): Curve => [[0, 0], [0.06, friction], [1, 0.8 * friction]]

const isFlat = (condition: VehicleCondition, index: number): boolean => (condition.tyres?.[index] ?? 1) < FLAT_BELOW || condition.rims?.[index] === true

interface WheelContext {
  readonly spec: SemiSimSpec
  readonly condition: VehicleCondition
  readonly options: VehicleFromSemiOptions
  /** The x the front axle starts at: wheels ahead of the mean x. */
  readonly frontFrom: number
  readonly frontCount: number
  readonly rearCount: number
  readonly handbrakeCount: number
}

const wheelOf = (wheel: SemiWheel, index: number, context: WheelContext): WheelDesc => {
  const { spec, condition, options } = context
  const cornerMass = spec.mass / spec.wheels.length
  const wear = SUSPENSION_FLOOR + (1 - SUSPENSION_FLOOR) * clamp(condition.suspension ?? 1, 0, 1)
  const free = spec.suspension.restLength
  // the spec's spring is a car's: a heavy vehicle that kept it would sag past its own travel and sit on its belly, so the spring stiffens (the damper with it) until the sag is the share MAX_SAG of the travel
  const stiffening = Math.max(1, (cornerMass * GRAVITY) / (MAX_SAG * free * spec.suspension.spring * wear))
  const spring = spec.suspension.spring * wear * stiffening
  const damper = spec.suspension.damper * wear * stiffening
  const sag = (cornerMass * GRAVITY) / spring
  const flat = isFlat(condition, index)
  const rimRadius = spec.rimRadius ?? RIM_RADIUS_SHARE * spec.wheelRadius
  const friction = flat ? RIM_FRICTION : spec.tyre.friction
  const front = wheel.x >= context.frontFrom
  const brakeShare = front ? FRONT_BRAKE_SHARE / context.frontCount : (1 - FRONT_BRAKE_SHARE) / context.rearCount
  const brakeTorque = spec.brakeForce * clamp(condition.brakes ?? 1, 0, 1) * spec.wheelRadius * brakeShare
  return {
    // x is to the vehicle's left and z ahead; the semi-simulation has z to the right
    position: [-wheel.z, spec.wheelRadius - spec.centreHeight + (free - sag), wheel.x],
    radius: flat ? rimRadius : spec.wheelRadius,
    width: options.wheelWidth ?? WHEEL_WIDTH,
    suspensionMin: free * SUSPENSION_MIN_SHARE,
    suspensionMax: free,
    frequency: Math.sqrt(spring / cornerMass) / (2 * Math.PI),
    damping: damper / (2 * Math.sqrt(spring * cornerMass)),
    maxSteer: wheel.steer ? spec.maxSteer : 0,
    driven: spec.fourWheelDrive || wheel.drive === true,
    maxBrakeTorque: brakeTorque,
    maxHandBrakeTorque: wheel.handbrake ? (spec.brakeForce * spec.wheelRadius * HANDBRAKE_SHARE) / context.handbrakeCount : 0,
    inertia: options.wheelInertia ?? (options.pedal ? BICYCLE_WHEEL_INERTIA : Math.max(MIN_WHEEL_INERTIA, WHEEL_INERTIA_PER_MASS * spec.mass * (spec.wheelRadius / REFERENCE_RADIUS) ** 2)),
    angularDamping: WHEEL_DAMPING,
    longitudinalFriction: longitudinalCurve(friction),
    lateralFriction: lateralCurve(friction, spec.tyre.corneringStiffness),
  }
}

const wheelContext = (spec: SemiSimSpec, options: VehicleFromSemiOptions): WheelContext => {
  const meanX = spec.wheels.reduce((sum, wheel) => sum + wheel.x, 0) / spec.wheels.length
  const frontCount = spec.wheels.filter((wheel) => wheel.x >= meanX).length
  return {
    spec,
    condition: options.condition ?? {},
    options,
    frontFrom: meanX,
    frontCount,
    rearCount: Math.max(1, spec.wheels.length - frontCount),
    handbrakeCount: Math.max(1, spec.wheels.filter((wheel) => wheel.handbrake).length),
  }
}

const inertiaOf = (spec: SemiSimSpec): readonly [number, number, number] => {
  const xs = spec.wheels.map((wheel) => wheel.x)
  const zs = spec.wheels.map((wheel) => wheel.z)
  const wheelbase = Math.max(...xs) - Math.min(...xs)
  const track = Math.max(...zs) - Math.min(...zs)
  // the semi-simulation's own moments: pitch and roll with 1 m of height, yaw from the plan
  return [(spec.mass * (wheelbase * wheelbase + 1)) / 12, spec.yawInertia ?? (spec.mass * (wheelbase * wheelbase + track * track)) / 12, (spec.mass * (track * track + 1)) / 12]
}

const drivetrainOf = (spec: SemiSimSpec, options: VehicleFromSemiOptions): Pick<VehicleDesc, 'maxTorque' | 'engineDamping' | 'engineInertia' | 'minRpm' | 'maxRpm' | 'gears' | 'reverseGears' | 'differentialRatio' | 'torqueCurve' | 'transmission'> => {
  const { pedal } = options
  if (pedal) {
    const crankSpeed = (pedal.cadenceRpm * 2 * Math.PI) / 60
    return {
      engineDamping: ENGINE_DAMPING,
      engineInertia: ENGINE_INERTIA_PER_TORQUE * (pedal.watts / crankSpeed),
      maxTorque: (pedal.watts / crankSpeed) * spec.efficiency,
      minRpm: 0,
      maxRpm: pedal.cadenceRpm * 1.5,
      // the engine turns once for every wheel turn / ratio: a gear of 2 turns the wheel twice a pedal turn
      gears: pedal.gears.map((ratio) => 1 / ratio),
      reverseGears: [],
      differentialRatio: 1,
      torqueCurve: [[0, 1], [0.67, 1], [1, 0]],
      transmission: { shiftUpRpm: pedal.cadenceRpm * 1.1, shiftDownRpm: pedal.cadenceRpm * 0.6, clutchStrength: clutchFor(pedal.watts / crankSpeed, pedal.cadenceRpm * 1.5) },
    }
  }
  const health = clamp(options.condition?.engine ?? 1, 0, 1)
  return {
    engineDamping: ENGINE_DAMPING,
    engineInertia: ENGINE_INERTIA_PER_TORQUE * spec.engine.peakTorque,
    maxTorque: spec.engine.peakTorque * spec.efficiency * (ENGINE_FLOOR + (1 - ENGINE_FLOOR) * health),
    minRpm: spec.engine.idleRpm,
    maxRpm: spec.engine.redlineRpm,
    gears: spec.gears,
    reverseGears: [-spec.reverseRatio],
    differentialRatio: spec.finalDrive,
    torqueCurve: torqueCurve(spec),
    transmission: { shiftUpRpm: spec.engine.redlineRpm * spec.upshiftFraction, shiftDownRpm: spec.engine.redlineRpm * spec.downshiftFraction, clutchStrength: clutchFor(spec.engine.peakTorque, spec.engine.redlineRpm) },
  }
}

/**
 * The semi-simulation's vehicle as a physics-engine vehicle (design 7.1): the wheels where the spec has them (x to the left, z ahead, from the centre of mass),
 * the suspension as a frequency and a damping ratio from the spring and the corner's mass, the engine and gearbox, the tyres as the two grip curves, the brake
 * force split 60/40, the mass and the moments of the spec. Two wheels make a motorcycle (a bicycle with `pedal`). The ground's grip is the ground body's own
 * friction, and the air drag and the rolling resistance are `resistanceImpulse`.
 */
export const vehicleDescFromSemi = (spec: SemiSimSpec, options: VehicleFromSemiOptions): VehicleDesc => {
  const context = wheelContext(spec, options)
  const inertia = inertiaOf(spec)
  const bike = spec.wheels.length === 2
  return {
    // no damping of the body's own: it would be a drag of 0.05 m/s per m/s (1.8 kN at 28 m/s on a 1.3 t car) the spec never asked for; `resistanceImpulse` is the drag
    chassis: { linearDamping: 0, angularDamping: 0, ...options.chassis, motion: 'dynamic', mass: spec.mass, inertia, centreAtOrigin: true, allowSleep: true },
    wheels: spec.wheels.map((wheel, index) => wheelOf(wheel, index, context)),
    ...drivetrainOf(spec, options),
    ...(bike
      ? { controller: 'motorcycle' as const, motorcycle: { maxLeanAngle: LEAN_LIMIT, leanSpring: LEAN_SPRING_PER_INERTIA * inertia[2], leanDamping: LEAN_DAMPING_PER_INERTIA * inertia[2] } }
      : {}),
  }
}
