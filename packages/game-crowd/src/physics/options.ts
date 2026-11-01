import type { BlastShoveOptions } from '@adatechnology/game-contracts'

import type { OffloadTransport, PhysicsWorkerFactory } from './offload/types'

export type CrowdContactOptions = {
  /** Body radius over build (default 0.25 → 0.5 m between two average bodies; the separation keeps them at 0.78 m when it can). */
  readonly radius?: number
  /** Iterations per fixed step in band R0 (default 2; 3 is the ceiling). */
  readonly iterations?: 1 | 2 | 3
  /** Push velocity damping per second: push ← push·exp(−friction·h) (default 6 → λ = 0.905 at 60 Hz). */
  readonly friction?: number
  /** Ceiling of the push velocity, m/s (default 3). */
  readonly maxPush?: number
  /** Ceiling of the position correction of one agent in one iteration, m (default 0.1; the design started at 0.06). */
  readonly maxCorrection?: number
  /** Jacobi relaxation of the position correction (default 1; the design started at 0.5, which left 0.25 m overlaps in a crush of 800). */
  readonly relaxation?: number
  /** kg of a body of height 1 and build 1 (default 70). */
  readonly baseMass?: number
  /** Ceiling of the separation term `|Σ sep · separationPush|`, m/s (default 1.5). */
  readonly separationMax?: number
}

export type CrowdPressureOptions = {
  /** Share kept per hop, τ (default 0.97). */
  readonly transmission?: number
  /** Ceiling of the field per agent, N (default 6000). */
  readonly cap?: number
  /** Cosine of the half angle that counts as "in front" (default 0.5 → 60°). */
  readonly frontCone?: number
  /** Share of the will speed of a staggering agent (default 0.35); the field keeps the full drive. */
  readonly staggerSpeed?: number
}

export type CrowdBalanceOptions = {
  /** `P_crit = criticalFactor · m · g · stability` (default 2.0 → 1372 N for a walker). */
  readonly criticalFactor?: number
  /** P/P_crit to start staggering (default 0.7). */
  readonly staggerEnter?: number
  /** P/P_crit to stop, after `staggerMin` (default 0.4). */
  readonly staggerLeave?: number
  /** Seconds (default 0.5). */
  readonly staggerMin?: number
  /** 1/s, rate = fallRate·(P/P_crit − 1)² above 1 (default 1.5). */
  readonly fallRate?: number
  /** |Δpush| in one step that staggers, m/s (default 1.2). */
  readonly shoveStagger?: number
  /** |Δpush| that knocks down, m/s, times stability (default 2.5). */
  readonly shoveFall?: number
  /** Seconds on the ground before trying to get up (default 1.5, plus reaction). */
  readonly fallenMin?: number
  /** P/P_crit under which a fallen one may get up (default 0.3). */
  readonly releaseFactor?: number
  /** Default 1.2. */
  readonly getUpSeconds?: number
  /** Seconds of the exponential mean (default 0.3). */
  readonly pressureTau?: number
  /** Ceiling of new falls per fixed step (default 8). */
  readonly maxFallsPerStep?: number
  /** Ceiling of agents on the ground (default 300); above it a fall becomes a stagger. */
  readonly maxFallen?: number
  /** Damage per second to a fallen body per 70 kg standing on it (default 6). */
  readonly trampleDps?: number
}

export type CrowdMoundOptions = {
  /** m per cell of a lying body, times build (default 0.28). */
  readonly bodyThickness?: number
  /** Default 0.25. */
  readonly corpseThickness?: number
  /** Ceiling of the mound per cell, m (default 1.6, about 5 or 6 bodies). */
  readonly maxHeight?: number
  /** Corpses within this distance of the band centre count (default 35, band R0). */
  readonly corpseRadius?: number
}

export type CrowdThrownOptions = {
  /** Slots of the pool (default 32, at most 127). */
  readonly pool?: number
  /** Only within this distance of the band centre (default 30 m). */
  readonly radius?: number
  /** m around the landing point that is knocked (default 0.7). */
  readonly landingRadius?: number
  /** Damage per m/s of landing speed above 6 m/s (default 8). */
  readonly fallDamage?: number
  /** Who gets a slot when there are more candidates than slots: half the slots to the fastest and half to the nearest to the band centre (`'mixed'`, default), or only one criterion. */
  readonly priority?: 'mixed' | 'fastest' | 'nearest'
  /** Share of the slots that goes to the fastest in `'mixed'` (default 0.5). */
  readonly mixedRatio?: number
}

export type CrowdBlastOptions = {
  /** Damage at the centre per kJ before falloff (default 0.6 → m67 120 points). */
  readonly pointsPerKilojoule?: number
  /** Shove speed from which a body flies, m/s (default 4). */
  readonly throwSpeed?: number
  /** Blasts resolved in one fixed step; more wait for the next one, in order (default 8). */
  readonly maxBlastsPerStep?: number
  /** `limb` effects per blast; the rest is summed into one blood effect (default 24). */
  readonly limbEffectsPerBlast?: number
  /** `blood` effects per blast (default 32). */
  readonly bloodEffectsPerBlast?: number
  /** The shove rule of `game-contracts`, the same numbers the host lends to the items and the furniture. */
  readonly shove?: BlastShoveOptions
}

export type CrowdPersonalityOptions = {
  /** Chase and wander factor (default [0.9, 1.1]). */
  readonly speed?: readonly [number, number]
  /** Seconds added to getting up and to the alert hop (default [0.05, 0.35]). */
  readonly reaction?: readonly [number, number]
  readonly stability?: readonly [number, number]
  readonly trip?: readonly [number, number]
  /** Pushing will (default [0.7, 1.3]). */
  readonly drive?: readonly [number, number]
  /** Walk cadence factor (default [0.88, 1.12]). */
  readonly cadence?: readonly [number, number]
  /** Attack will (default [0.8, 1.2]): divides `attackEvery`, multiplies the bite chance and decides who gets the last attack slots. */
  readonly aggression?: readonly [number, number]
  /** Weights of sway, shuffle, head twitch, still (default [3, 2, 2, 1]). */
  readonly idle?: readonly number[]
}

/** Pressure of the horde on the target (D13.2): above `knockThreshold` N it knocks the target down; the excess crushes at `crushDamagePerSecond`. */
export type CrowdPlayerPressureOptions = {
  readonly enabled?: boolean
  readonly knockThreshold?: number
  readonly crushDamagePerSecond?: number
}

export type CrowdPhysicsOptions = {
  readonly contact?: CrowdContactOptions | boolean
  /** Needs `contact`. */
  readonly pressure?: CrowdPressureOptions | boolean
  /** Needs `contact`. */
  readonly balance?: CrowdBalanceOptions | boolean
  /** Needs `balance`. */
  readonly mound?: CrowdMoundOptions | boolean
  /** Needs `balance`. */
  readonly thrown?: CrowdThrownOptions | boolean
  readonly blast?: CrowdBlastOptions
  readonly personality?: CrowdPersonalityOptions | boolean
  readonly door?: { readonly pressureDamage?: number }
  /** Needs `pressure`. Off in the package; a game turns it on. */
  readonly playerPressure?: CrowdPlayerPressureOptions
  /** Flow budget in cells per step, `attackPose` in the simulation, positions kept for interpolation. */
  readonly deterministic?: boolean
  /**
   * Where the contact and the pressure run. `'off'` (default): in the step, exactly as before. `'on'`: in a worker, one step behind (the main thread applies what the worker
   * computed from the previous step), and an error when no worker can be made. `'auto'`: the same when a worker can be made, `'off'` when it cannot. Needs `contact`.
   */
  readonly worker?: 'off' | 'auto' | 'on'
  /** Makes the worker (default: a module worker that loads `physics-worker.js` next to the bundle). A host that bundles its own worker gives the factory and calls `attachPhysicsWorker` in it. */
  readonly workerFactory?: PhysicsWorkerFactory
  /** `'shared'` (a `SharedArrayBuffer`, deterministic, needs `crossOriginIsolated`), `'transfer'` (`postMessage`, any host, the answer is as late as the event loop makes it), `'inline'` (no worker: the same protocol on the main thread, the reference). Default: `'shared'` when it is available, else `'transfer'`. */
  readonly workerTransport?: OffloadTransport
  /** Steps between the state the worker is handed and the step that applies its answer (default 1). 2 gives the worker a whole step to finish in, so the main thread never waits for it, and costs one more step of lag in the contact. */
  readonly workerLatency?: 1 | 2
}

export const CONTACT_DEFAULTS: Required<CrowdContactOptions> = { radius: 0.25, iterations: 2, friction: 6, maxPush: 3, maxCorrection: 0.1, relaxation: 1, baseMass: 70, separationMax: 1.5 }
export const PRESSURE_DEFAULTS: Required<CrowdPressureOptions> = { transmission: 0.97, cap: 6000, frontCone: 0.5, staggerSpeed: 0.35 }
export const BALANCE_DEFAULTS: Required<CrowdBalanceOptions> = {
  criticalFactor: 2,
  staggerEnter: 0.7,
  staggerLeave: 0.4,
  staggerMin: 0.5,
  fallRate: 1.5,
  shoveStagger: 1.2,
  shoveFall: 2.5,
  fallenMin: 1.5,
  releaseFactor: 0.3,
  getUpSeconds: 1.2,
  pressureTau: 0.3,
  maxFallsPerStep: 8,
  maxFallen: 300,
  trampleDps: 6,
}
export const MOUND_DEFAULTS: Required<CrowdMoundOptions> = { bodyThickness: 0.28, corpseThickness: 0.25, maxHeight: 1.6, corpseRadius: 35 }
export const THROWN_DEFAULTS: Required<CrowdThrownOptions> = { pool: 32, radius: 30, landingRadius: 0.7, fallDamage: 8, priority: 'mixed', mixedRatio: 0.5 }
export const BLAST_DEFAULTS: Required<CrowdBlastOptions> = { pointsPerKilojoule: 0.6, throwSpeed: 4, maxBlastsPerStep: 8, limbEffectsPerBlast: 24, bloodEffectsPerBlast: 32, shove: {} }
export const PERSONALITY_DEFAULTS: Required<CrowdPersonalityOptions> = {
  speed: [0.9, 1.1],
  reaction: [0.05, 0.35],
  stability: [0.75, 1.25],
  trip: [0.5, 1.5],
  drive: [0.7, 1.3],
  cadence: [0.88, 1.12],
  aggression: [0.8, 1.2],
  idle: [3, 2, 2, 1],
}
export const PLAYER_PRESSURE_DEFAULTS: Required<CrowdPlayerPressureOptions> = { enabled: false, knockThreshold: 1500, crushDamagePerSecond: 6 }
/** Pressure damage per N·s on a door pushed by the horde (§6.5). */
export const DOOR_PRESSURE_DAMAGE = 0.004
/** Flow cells per step in deterministic mode. */
export const DETERMINISTIC_FLOW_CELLS = 20000

/** Everything on, deterministic, the numbers of the design (`design-chain-horde.md`); the player pressure stays off, a game turns it on. */
export const CROWD_PHYSICS_DEFAULTS: CrowdPhysicsOptions = {
  contact: CONTACT_DEFAULTS,
  pressure: PRESSURE_DEFAULTS,
  balance: BALANCE_DEFAULTS,
  mound: MOUND_DEFAULTS,
  thrown: THROWN_DEFAULTS,
  blast: BLAST_DEFAULTS,
  personality: PERSONALITY_DEFAULTS,
  door: { pressureDamage: DOOR_PRESSURE_DAMAGE },
  playerPressure: PLAYER_PRESSURE_DEFAULTS,
  deterministic: true,
}

export type ResolvedPhysics = {
  readonly contact: Required<CrowdContactOptions> | null
  readonly pressure: Required<CrowdPressureOptions> | null
  readonly balance: Required<CrowdBalanceOptions> | null
  readonly mound: Required<CrowdMoundOptions> | null
  readonly thrown: Required<CrowdThrownOptions> | null
  readonly blast: Required<CrowdBlastOptions>
  readonly personality: Required<CrowdPersonalityOptions> | null
  readonly doorPressureDamage: number
  readonly playerPressure: Required<CrowdPlayerPressureOptions>
  readonly deterministic: boolean
  readonly worker: 'off' | 'auto' | 'on'
  readonly workerFactory: PhysicsWorkerFactory | undefined
  readonly workerTransport: OffloadTransport | undefined
  readonly workerLatency: 1 | 2
}

const part = <T extends object>(option: T | boolean | undefined, defaults: Required<T>): Required<T> | null => {
  if (option === undefined || option === false) return null
  return option === true ? defaults : { ...defaults, ...option }
}

/** Reads `CrowdOptions.physics`: the defaults filled in, and a thrown error that lists every part whose dependency is missing. */
export function resolvePhysics(physics: CrowdPhysicsOptions = {}): ResolvedPhysics {
  const contact = part(physics.contact, CONTACT_DEFAULTS)
  const pressure = part(physics.pressure, PRESSURE_DEFAULTS)
  const balance = part(physics.balance, BALANCE_DEFAULTS)
  const mound = part(physics.mound, MOUND_DEFAULTS)
  const thrown = part(physics.thrown, THROWN_DEFAULTS)
  const playerPressure = { ...PLAYER_PRESSURE_DEFAULTS, ...physics.playerPressure }
  const missing: string[] = []
  if (!contact && pressure) missing.push('pressure needs contact')
  if (!contact && balance) missing.push('balance needs contact')
  if (!balance && mound) missing.push('mound needs balance')
  if (!balance && thrown) missing.push('thrown needs balance')
  if (!pressure && playerPressure.enabled) missing.push('playerPressure needs pressure')
  if (!contact && physics.worker === 'on') missing.push('worker needs contact')
  if (missing.length) throw new Error(`crowd physics: ${missing.join('; ')}`)
  return {
    contact,
    pressure,
    balance,
    mound,
    thrown,
    blast: { ...BLAST_DEFAULTS, ...physics.blast },
    personality: part(physics.personality, PERSONALITY_DEFAULTS),
    doorPressureDamage: physics.door?.pressureDamage ?? DOOR_PRESSURE_DAMAGE,
    playerPressure,
    deterministic: physics.deterministic ?? false,
    worker: physics.worker ?? 'off',
    workerFactory: physics.workerFactory,
    workerTransport: physics.workerTransport,
    workerLatency: physics.workerLatency ?? 1,
  }
}
