/** What the player (or an AI) asks of the vehicle in one step. */
export interface DriveInput {
  /** 0..1, accelerates (and brakes hard against a reverse move). */
  throttle: number
  /** 0..1, brakes hard against a forward move, reverses from a stop. Throttle and brake together cancel. */
  brake: number
  /** -1..1, positive steers to the left (the game's A key), as the yaw grows counter-clockwise seen from above. */
  steer: number
  handbrake: boolean
  /** The horn this step. */
  horn?: boolean
}

/** The position and motion of the vehicle. Yaw 0 points to +x; the forward vector is `(cos yaw, -sin yaw)` on (x, z). */
export interface DriverState {
  x: number
  z: number
  yaw: number
  /** Signed speed along the forward vector, m/s. */
  v: number
  /** Current steering angle, radians (smoothed toward the input). */
  steer: number
  /** Seconds until the engine noise is next emitted. */
  noiseTimer: number
}

/** A body the vehicle can run over. */
export interface DrivingBody {
  x: number
  z: number
}

/** What the vehicle drives through. All hooks are optional except `blocked`. */
export interface DrivingWorld {
  /** True when a vehicle at (x, z) with this yaw overlaps something solid. `vehicleCorners` lists the points the game tests. */
  blocked(x: number, z: number, yaw: number): boolean
  /** The bodies that can be run over right now, indexed as the host indexes them; a dead or absent one is `undefined`. */
  bodies?(): ReadonlyArray<DrivingBody | undefined>
}

export type DrivingEvent =
  /** A hard hit (above `crash.minSpeed`): the host damages the vehicle by `damage`, shakes the camera, hurts the driver when `hurtDriver` is above 0. */
  | { type: 'crash'; speed: number; damage: number; shake: number; hurtDriver: number }
  /** A noise the horde can hear. */
  | { type: 'noise'; radius: number; x: number; z: number; source: 'crash' | 'engine' | 'horn' }
  /** A body hit above `runOver.killSpeed`: dies, limbs come off; the vehicle takes `vehicleDamage`. */
  | { type: 'run_over'; outcome: 'kill'; index: number; speed: number; vehicleDamage: number }
  /** A body hit between `knockSpeed` and `killSpeed`: it loses `damage`, is stunned and thrown with (`vx`, `vz`); the vehicle slows by `slow`. */
  | { type: 'run_over'; outcome: 'knock'; index: number; speed: number; damage: number; stunSeconds: number; vx: number; vz: number; slow: number }
  /** A body hit below `knockSpeed`: the horde holds the vehicle (it slows) and the body is pushed aside by (`dx`, `dz`). */
  | { type: 'run_over'; outcome: 'push'; index: number; speed: number; dx: number; dz: number }
  | { type: 'horn' }

export interface StepResult {
  state: DriverState
  events: DrivingEvent[]
}

/** A driver turns inputs into motion. */
export interface Driver {
  readonly state: DriverState
  step(input: DriveInput, dt: number, world: DrivingWorld): StepResult
  /** Puts the vehicle somewhere, standing still. */
  place(x: number, z: number, yaw: number): void
}
