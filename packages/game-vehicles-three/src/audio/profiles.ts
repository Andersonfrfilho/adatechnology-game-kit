/**
 * How a vehicle sounds, as data. An engine is a few loops crossfaded by RPM (idle, low/mid, high) plus a load layer (intake and exhaust roar) that
 * follows the throttle, the way a sampled engine is mixed: when recorded loops arrive they take the same ids and the same crossfade. The pitch of
 * each tone layer is the firing frequency of the engine (`rpm / 60 × cylinders / 2` for a four-stroke) times its harmonic.
 */

/** One tone layer of the engine: the loop id, where in the RPM range it is loudest (0 idle … 1 redline), and its level and cutoff. */
export type EngineLayer = {
  readonly sound: string
  /** Normalised RPM (0 at idle, 1 at the redline) where the layer is loudest. */
  readonly centre: number
  /** How far from `centre` the layer fades out (equal-power crossfade). */
  readonly width: number
  /** Multiple of the firing frequency the oscillator plays at. */
  readonly harmonic: number
  /** Level at full load. */
  readonly gain: number
  /** Low-pass cutoff, Hz, from no load at idle to full load at the redline. */
  readonly cutoff: readonly [min: number, max: number]
}

/** The roar of the intake and exhaust: a noise loop that opens with the throttle and the RPM. */
export type EngineLoadLayer = { readonly sound: string; readonly gain: number; readonly cutoff: readonly [min: number, max: number] }

export type EngineProfile = {
  readonly id: string
  readonly cylinders: number
  readonly idleRpm: number
  readonly redlineRpm: number
  /** Gear ratios times final drive per m/s, to guess the RPM from the speed when the driver has no engine model (the arcade driver). */
  readonly rpmPerMps: readonly number[]
  readonly layers: readonly EngineLayer[]
  readonly load: EngineLoadLayer
  /** Level with the throttle closed, as a share of full load (engine braking is quieter and darker). */
  readonly closedThrottle: number
}

/** The sound ids a vehicle plays besides its engine. Every one is a key of `VEHICLE_SOUND_BANK`, and a game can point any of them elsewhere. */
export type VehicleSoundKeys = {
  readonly start: string
  readonly stop: string
  readonly fail: string
  readonly crashLight: string
  readonly crashMedium: string
  readonly crashHeavy: string
  readonly skidAsphalt: string
  readonly skidDirt: string
  readonly roll: string
  /** Tyres rolling on earth, gravel, sand or grass (`frame.surface` `dirt`), in place of `roll`. */
  readonly rollDirt: string
  /** Compressed air let out of the brake chambers as a truck stops (`VehicleSoundOptions.airBrake`). */
  readonly airBrake: string
  /** Pads squealing on the discs as a car brakes to a stop (not a skid: the tyres still grip). */
  readonly brakeSqueal: string
  /** A body hit by the vehicle; a game points it at its own (a zombie, an animal) through `sounds` or the `hit` call. */
  readonly hitBody: string
  /** An emergency siren, its pitch swept by the vehicle (`frame.siren`). */
  readonly siren: string
  /** A helicopter's blades (`frame.rotor`). */
  readonly rotor: string
}

export const DEFAULT_VEHICLE_SOUND_KEYS: VehicleSoundKeys = {
  start: 'engine_start',
  stop: 'engine_stop',
  fail: 'engine_fail',
  crashLight: 'crash_light',
  crashMedium: 'crash_medium',
  crashHeavy: 'crash_heavy',
  skidAsphalt: 'tire_skid_asphalt',
  skidDirt: 'tire_skid_dirt',
  roll: 'tire_roll',
  rollDirt: 'tire_roll_gravel',
  airBrake: 'air_brake',
  brakeSqueal: 'brake_squeal',
  hitBody: 'vehicle_hit_pedestrian',
  siren: 'siren',
  rotor: 'helicopter_rotor_loop',
}

/** The speed of the hit, m/s, where a crash stops being light (≈ 22 km/h: dents and plastic) and where it turns heavy (≈ 50 km/h: metal folds, glass goes). */
export const CRASH_SPEEDS = { medium: 6, heavy: 14 } as const

const layers = (id: string, cutoffs: readonly (readonly [number, number])[], gains: readonly number[]): EngineLayer[] => [
  { sound: `engine_${id}_low`, centre: 0, width: 0.5, harmonic: 1, gain: gains[0] as number, cutoff: cutoffs[0] as readonly [number, number] },
  { sound: `engine_${id}_mid`, centre: 0.45, width: 0.5, harmonic: 1, gain: gains[1] as number, cutoff: cutoffs[1] as readonly [number, number] },
  { sound: `engine_${id}_high`, centre: 1, width: 0.6, harmonic: 2, gain: gains[2] as number, cutoff: cutoffs[2] as readonly [number, number] },
]

/** A four-cylinder petrol car: 800 to 6 500 rpm. */
export const CAR_ENGINE: EngineProfile = {
  id: 'car',
  cylinders: 4,
  idleRpm: 800,
  redlineRpm: 6500,
  // a 5-speed hatch: 1st tops at ~13 m/s, 5th at ~50 m/s
  rpmPerMps: [500, 300, 205, 155, 125],
  layers: layers('car', [[220, 520], [420, 1300], [900, 2600]], [0.11, 0.075, 0.04]),
  load: { sound: 'engine_car_load', gain: 0.05, cutoff: [350, 1600] },
  closedThrottle: 0.55,
}

/** A six-cylinder diesel truck or bus: 650 to 2 600 rpm, low and clattering. */
export const TRUCK_ENGINE: EngineProfile = {
  id: 'truck',
  cylinders: 6,
  idleRpm: 650,
  redlineRpm: 2600,
  rpmPerMps: [420, 260, 170, 120, 90, 72],
  layers: layers('truck', [[160, 380], [300, 800], [600, 1500]], [0.13, 0.08, 0.035]),
  load: { sound: 'engine_truck_load', gain: 0.06, cutoff: [250, 900] },
  closedThrottle: 0.6,
}

/** A four-cylinder sport bike: 1 300 to 12 000 rpm, bright and fast to rev. */
export const BIKE_ENGINE: EngineProfile = {
  id: 'bike',
  cylinders: 4,
  idleRpm: 1300,
  redlineRpm: 12000,
  rpmPerMps: [900, 640, 500, 410, 350, 310],
  layers: layers('bike', [[350, 900], [700, 2200], [1500, 4200]], [0.08, 0.07, 0.05]),
  load: { sound: 'engine_bike_load', gain: 0.045, cutoff: [600, 2600] },
  closedThrottle: 0.5,
}

export const ENGINE_PROFILES: Readonly<Record<string, EngineProfile>> = { car: CAR_ENGINE, truck: TRUCK_ENGINE, bike: BIKE_ENGINE }

/** The fleet groups whose engine is a truck's (heavy trucks, buses, tractors) and a bike's (motorcycles); every other group is a car. */
const TRUCK_GROUPS: ReadonlySet<string> = new Set(['heavy', 'agricultural'])

/** The engine profile of a fleet group (`ProvingSubject.category`): `motorcycles` a bike, `heavy` and `agricultural` a truck, the rest a car. */
export const engineProfileOfGroup = (group: string): EngineProfile => (group === 'motorcycles' ? BIKE_ENGINE : TRUCK_GROUPS.has(group) ? TRUCK_ENGINE : CAR_ENGINE)

/** The horn of a fleet group: a motorcycle's thin beep, a truck's air horn, a car's. */
export const hornOfGroup = (group: string): string => (group === 'motorcycles' ? 'horn_bike' : TRUCK_GROUPS.has(group) ? 'horn_truck' : 'horn_car')
