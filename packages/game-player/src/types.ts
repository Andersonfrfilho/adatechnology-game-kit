import type defaults from './data/defaults.json'

export type AttributeId = 'strength' | 'vigor' | 'agility' | 'perception' | 'intellect' | 'presence'
export type Attributes = Readonly<Record<AttributeId, number>>

/** `(base + Σ coefficient × attribute) / divide`, summed left to right in the order given (the game's own order, so the floats match). */
export type LinearFormula = {
  readonly base: number
  readonly terms: readonly (readonly [AttributeId, number])[]
  readonly divide?: number
}
export type DerivedId = 'maxHealth' | 'maxStamina' | 'runSpeed' | 'walkSpeed' | 'footstepNoise' | 'composure'
export type DerivedFormulas = Readonly<Record<DerivedId, LinearFormula>>
export type Derived = Readonly<Record<DerivedId, number>>

/** A wound kind: its share of the hits (drawn in the listed order, the last one takes the rest), its infection chance and whether it bleeds. */
export type WoundRule = { readonly share: number; readonly infectionChance: number; readonly bleeds: boolean }
export type WoundTable = Readonly<Record<string, WoundRule>>

/** An individual infection that runs on its own clock and kills at `deathSeconds`. Off by default: a normal world has none. */
export type InfectionRule = {
  readonly feverSeconds: number
  readonly deliriumSeconds: number
  readonly deathSeconds: number
  /** Seconds after death the body turns (`turned` event). */
  readonly reanimateSeconds: number
  /** With fever, every this many seconds there is a `feverNoiseChance` of a cough: noise of `feverNoiseRadius` m. */
  readonly feverNoiseEvery: number
  readonly feverNoiseChance: number
  readonly feverNoiseRadius: number
  readonly feverNoiseVolume: number
  readonly feverSpeed: number
  readonly feverSpread: number
  /** Infection chance per wound kind; a kind left out uses the wound table's `infectionChance`. */
  readonly chances?: Readonly<Record<string, number>>
}

export type PlayerNumbers = typeof defaults.numbers

/** What is in the hand for melee (the fist when absent): damage, critical (0..60 turns into a cut), reach in metres, noise radius, mass. */
export type MeleeItem = { readonly damage: number; readonly crit?: number; readonly reach?: number; readonly noise?: number; readonly kg?: number }

/** One frame of input. Held keys are booleans; the `pressed` ones are true only on the frame the key went down. */
export type PlayerInput = {
  /** -1 back, 0, 1 forward. */
  readonly forward?: number
  /** -1 left, 0, 1 right. */
  readonly right?: number
  readonly run?: boolean
  /** Aiming down the sights: speed is capped and the body turns with the view at once. */
  readonly aim?: boolean
  /** The trigger is held or the weapon is cooling: the body turns with the view at once. */
  readonly firing?: boolean
  /** Where the view looks (radians, the camera's yaw: forward is `(-sin, -cos)`). */
  readonly yaw?: number
  /** Held: dress the bleeding wound. */
  readonly bandage?: boolean
  readonly pressed?: Readonly<Partial<Record<PlayerAction, boolean>>>
  /** The melee item in hand. */
  readonly melee?: MeleeItem
}
export type PlayerAction = 'crouch' | 'push' | 'knife' | 'vault' | 'throw'

/**
 * The crowd the player touches (a horde, any crowd): read by index, written through a few verbs. `game-crowd` implements it; a game with its own
 * agents writes a small adapter. Only agents that are `active` (close and simulated every frame) are pushed, counted for panic or hit.
 */
export interface PlayerCrowd {
  count(): number
  active(i: number): boolean
  x(i: number): number
  z(i: number): number
  y(i: number): number
  floor(i: number): number
  chasing(i: number): boolean
  /** On the ground: crawling or stunned. A melee blow on it always goes to the head. */
  down(i: number): boolean
  /** How much it adds to panic (default 1). */
  panicWeight?(i: number): number
  /** The grabbing agent is glued to the player's body: move by `k` of the way to (x, z), stop, and face (lookX, lookZ). */
  hold(i: number, x: number, z: number, k: number, lookX: number, lookZ: number): void
  stun(i: number, seconds: number, vx: number, vz: number): void
  /** Back to chasing, with the attack cooling for `cooldown` seconds. */
  chase(i: number, cooldown: number): void
  damage(i: number, hit: { region: number; amount: number; distance: number; cut: number }): void
}

/** What the player asks of the world. Everything is optional: the default is an open, dry field. */
export interface PlayerWorld {
  /** Occupancy code of the cell at (x, z): -1 outside, 0 free, 1 solid, 2 low wall that can be vaulted, 3 open door, others solid. */
  cellKind?(x: number, z: number): number
  solidAt?(x: number, z: number, y: number): boolean
  /** Blocks the player's body at (x, z). Default `solidAt(x, z, blockHeight)` (a roof or a floor plan passes its own). */
  blocked?(x: number, z: number): boolean
  inWater?(x: number, z: number): boolean
  /** Something else drives the player this frame (a car seat, a chair, a ladder): skip moving. */
  busy?(dt: number): boolean
  /** Low walls can be vaulted here (the game says no on a roof or an upper floor). Default: only on the ground floor. */
  canVault?(): boolean
  /** After the move (stairs change the floor and the height). */
  afterMove?(player: PlayerState): void
  crowd?: PlayerCrowd
}

export type PlayerState = {
  x: number
  z: number
  y: number
  vx: number
  vz: number
  /** The body's yaw (the view's yaw + π, smoothed). */
  yaw: number
  floor: number
  alive: boolean
  turned: boolean
  health: number
  stamina: number
  crouch: boolean
  running: boolean
  stepTimer: number
  phase: number
  hip: number
  grabbedBy: number
  grabTimer: number
  grabPushes: number
  grabNoJaw: boolean
  grabDrown: boolean
  infected: boolean
  infectionTime: number
  infectionSource: string
  wounds: string[]
  bleeding: number
  blind: number
  screamBoost: number
  panic: number
  hurtFlash: number
  deathTime: number
  cause: string
  downTimer: number
  burnTimer: number
  scentTimer: number
  vaultTimer: number
  vault: [number, number, number, number] | null
}

export type PlayerSoundId = 'step' | 'flesh'
export type PlayerMessageId =
  | 'grabbed'
  | 'grabbed_drown'
  | 'bitten'
  | 'bandaged'
  | 'knife_head'
  | 'knife_miss'
  | 'pushed_off'
  | 'drowning'
  | 'no_jaw'
  | 'stood_up'
export type KnownDeathCause = 'infected' | 'killed' | 'bitten_to_death' | 'infection' | 'bled_out' | 'hunger_thirst' | 'drowned' | 'burned'
/** Why the player died: the rule's own causes, or any id the host passes to `die`. */
export type DeathCause = KnownDeathCause | (string & {})

export type PlayerEventMap = {
  noise: { x: number; z: number; radius: number }
  sound: { sound: PlayerSoundId; volume: number; position: [number, number, number] }
  step: { x: number; z: number; yaw: number }
  message: { id: PlayerMessageId | DeathCause; seconds: number }
  hurt: { amount: number; wound: string }
  infected: { source: string }
  stage: { stage: 'fever' | 'delirium' }
  died: { cause: DeathCause }
  turned: { x: number; z: number; floor: number }
  grabbed: { by: number; noJaw: boolean; drown: boolean }
  released: { by: number; how: 'push' | 'knife' | 'bite' | 'scratch' | 'free' }
  vault: { from: [number, number]; to: [number, number] }
  shove: { targets: number[] }
  melee: { target: number; region: number; damage: number; distance: number; cut: number }
  throw: Record<string, never>
}
export type PlayerEventName = keyof PlayerEventMap
export type PlayerEvent<K extends PlayerEventName = PlayerEventName> = PlayerEventMap[K]

export type PlayerSave = { readonly state: PlayerState; readonly attributes: Attributes }
