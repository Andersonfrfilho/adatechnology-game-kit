/**
 * Public types of @adatechnology/game-weapons.
 *
 * Weapons and ammunition as data plus a tiny runtime: a `WeaponState` holds the magazine, chamber, fire mode, heat and recoil; `trigger()` turns
 * a trigger pull into `Shot`s (one per pellet) with muzzle energy, calibre, direction with spread, and range falloff. Shots are plain data, so
 * any damage model can consume them (@adatechnology/game-destruction takes `energy` and `caliber` as is). Melee, flame, heat, throwables and
 * tools use the same shape so a test room or a game can treat every tool in the hand the same way.
 *
 * Units: metres, seconds, joules, millimetres for calibres, grams for bullets, metres per second for speeds, °C.
 * Every random choice (spread) comes from the state's seed: same inputs, same shots on every machine.
 */

import type { Shot, Use, Vec3 } from '@adatechnology/game-contracts'

import type { ExplosiveBody } from './explosive-body'
import type { ExplosiveDef, ExplosiveId } from './explosive-types'
import type { WeaponsStrings } from './locale'
import type { FaultId, WeaponEvent, WeaponRules } from './rule-types'

// `Shot` and `Use` are contracts: they live in @adatechnology/game-contracts and are re-exported here so that no import breaks.
export type { Shot, Use, Vec3 }

/** snake_case calibre id, e.g. `9x19`, `5_56x45`, `12ga_00buck`. */
export type CaliberId = string
/** snake_case weapon id. */
export type WeaponId = string

export interface CaliberDef {
  id: CaliberId
  /** Display label, e.g. `9×19 mm`, `12 ga 00 buck`. Not translated (it is a technical name). */
  label: string
  /** Bullet (or each pellet) diameter in mm. */
  diameter: number
  /** Bullet or pellet mass in grams. */
  bulletGrams: number
  /** Typical muzzle speed from a reference barrel, m/s. Muzzle energy = 0.5 × mass × speed². */
  muzzleSpeed: number
  /** Pellets per shell (shotgun), default 1. */
  pellets?: number
  /** Speed lost per 100 m as a fraction (default 0.1 rifle, 0.2 pistol, 0.45 buckshot). */
  dragPer100m?: number
  /** Armour-piercing or hollow-point flavour (a damage model may use it). */
  kind?: 'fmj' | 'hp' | 'ap' | 'buck' | 'slug' | 'birdshot' | 'rimfire' | 'arrow' | 'bolt'
  tags?: string[]
  /** Audible distance of a shot in this calibre, metres. A weapon may override it (suppressor). */
  noise?: number
  caseType?: CaseType
  rim?: RimType
  cartridge?: CartridgeDims
  /** Where the numbers come from (team deliveries, the SDK itself, a published reference, or derived from a sibling). */
  sources?: readonly DataSource[]
}

export type CaseType = 'pistol' | 'rifle' | 'shell' | 'big' | 'tiny'
export type RimType = 'rimfire' | 'rimmed' | 'rimless' | 'shell'
export type DataSource = 'gallery' | 'arsenal' | 'game' | 'lab' | 'sdk' | 'reference' | 'derived'

/** Real cartridge dimensions in mm. */
export interface CartridgeDims {
  readonly caseDiameter: number
  readonly overallLength: number
  readonly caseLength: number
  readonly projectileDiameter: number
}

/** What a `firearm` action holds. */
export type FirearmAction = Extract<WeaponAction, { kind: 'firearm' }>

export type FireMode = 'single' | 'semi' | 'burst' | 'auto' | 'pump' | 'bolt' | 'lever' | 'break' | 'volley'

export type WeaponCategory =
  | 'pistol'
  | 'revolver'
  | 'smg'
  | 'rifle'
  | 'carbine'
  | 'sniper'
  | 'dmr'
  | 'hunting'
  | 'machine_gun'
  | 'launcher'
  | 'shotgun'
  | 'bow'
  | 'crossbow'
  | 'melee_blunt'
  | 'melee_blade'
  | 'flame'
  | 'heat'
  | 'throwable'
  | 'tool'
  | 'extinguisher'
  | 'hand'

/** How a weapon is reloaded; it picks the animation set and the order of the reload stages. */
export type ReloadFamily =
  | 'pistol'
  | 'magazine'
  | 'top_magazine'
  | 'top_load_semi'
  | 'tube_semi'
  | 'pump'
  | 'lever'
  | 'bolt'
  | 'bolt_magazine'
  | 'belt'
  | 'revolver'
  | 'break'
  | 'rocket'
  | 'flame'

/** Seconds of each phase of handling a weapon. */
export interface WeaponTimings {
  readonly draw: number
  readonly reload: number
  readonly reloadEmpty?: number
  /** Seconds per round when the weapon loads one round at a time. */
  readonly perRound?: number
  /** Seconds to cycle a manual action between shots. */
  readonly cycle?: number
  /** Seconds to clear a fault. */
  readonly clear: number
  readonly modeSwitch?: number
}

/** Real dimensions: metres and kilograms. */
export interface WeaponDimensions {
  readonly length: number
  readonly barrel: number
  readonly emptyMass: number
  readonly lengthCollapsed?: number
}

/** What using the item does. Firearms produce ballistic shots; the rest produce one `Use` of their kind. */
export type WeaponAction =
  | {
      kind: 'firearm'
      caliber: CaliberId
      /** Rounds per minute (cyclic for auto, practical for the rest). */
      rpm: number
      modes: FireMode[]
      /** Rounds in the burst mode (default 3). */
      burst?: number
      magazine: number
      /** Seconds to reload a full magazine (tube-fed: per round, see `perRound`). */
      reload: number
      perRound?: boolean
      /** Barrel speed factor vs. the calibre reference (short barrel 0.9, long 1.05), default 1. */
      barrel?: number
      /** Base spread in degrees (cone half-angle) and extra degrees per consecutive shot (bloom), with recovery per second. */
      spreadDeg: number
      bloomDeg?: number
      recoveryDegPerS?: number
      /** Pellet spread for shotguns in degrees (default 3). */
      pelletSpreadDeg?: number
      /** Camera kick per shot in degrees (pitch, yaw jitter). */
      recoil: [number, number]
      /** Effective range in metres (shots past it keep going with drag; the host may cut them). */
      range: number
      /** Audible distance in metres (a horde game uses it to attract zombies). Defaults to the calibre's `noise`. */
      noise?: number
      /** Muzzle speed of this weapon, m/s. Defaults to the calibre reference times `barrel`. */
      muzzleSpeed?: number
      family?: ReloadFamily
      timings?: WeaponTimings
      /** Rounds that fit in the chamber on top of the magazine. */
      chamber?: number
      /** Other magazine sizes the weapon accepts. */
      magazineOptions?: readonly number[]
      /** Magazine tubes (a bullpup shotgun has two). */
      tubes?: number
      /** Multiplies the fault chance (1 = average, below 1 more reliable). */
      faultFactor?: number
      /** Real accuracy in minutes of angle (data only). */
      moa?: number
      /** Shotgun pattern width at 25 m in centimetres (data only). */
      patternCm?: number
      /** Other calibres the weapon fires (a .357 revolver also fires .38 Special). */
      acceptsCalibers?: readonly CaliberId[]
    }
  | {
      kind: 'launcher'
      projectile: ExplosiveId
      magazine: number
      reload: number
      timings?: WeaponTimings
      family: 'rocket' | 'break'
      disposable?: boolean
      speed: number
      /** Distance in metres below which the projectile hits without exploding. */
      minArmDistance: number
      /** Radius in metres of the blast behind the launcher. */
      backblast: number
      /** Half-angle in degrees of the cone behind the launcher where the blast is dangerous (default 180: the whole sphere of `backblast`). */
      backblastHalfAngleDeg?: number
      recoil: [number, number]
      noise?: number
    }
  | { kind: 'melee'; damage: 'blunt' | 'slash'; energy: number; radius: number; reach: number; rpm: number; noise: number; stamina?: number }
  | { kind: 'flame'; temperature: number; radius: number; range: number; fuelPerSecond: number; fuel: number; cone?: boolean; noise: number; family?: ReloadFamily; timings?: WeaponTimings }
  | { kind: 'heat'; temperature: number; radius: number; range: number; fuelPerSecond: number; fuel: number; noise: number }
  | { kind: 'throwable'; /** Throwables carried (default 3). */ count?: number; /** The explosive this throwable uses; `energy`, `radius` and `noise` come from it. */ explosive?: ExplosiveId; energy: number; radius: number; fuse: number; throwSpeed: number; fire?: { temperature: number; radius: number; seconds: number }; noise: number }
  | { kind: 'tool'; tool: 'screwdriver' | 'wrench' | 'pry_bar' | 'saw' | 'cutting_torch' | 'knife' | 'hammer'; reach: number; noise: number }
  | { kind: 'extinguisher'; range: number; coolC: number; charge: number; noise: number }
  | { kind: 'hand'; reach: number }

export interface WeaponDef {
  id: WeaponId
  /** Generic real-world description used as the default name, e.g. `9 mm service pistol`. Hosts translate with the locale or rename. */
  name?: string
  category: WeaponCategory
  action: WeaponAction
  /** Mass in kg (carry weight, and thrown melee weapons). */
  mass: number
  tags?: string[]
  dimensions?: WeaponDimensions
  /** Maker of a real-world model, e.g. `Glock`. */
  maker?: string
  /** The generic weapon whose handling numbers (spread, bloom, range, recoil) this model uses. */
  archetype?: WeaponId
  /** The weapon this one is a variant of. */
  variantOf?: WeaponId
  sources?: readonly DataSource[]
}

export interface TriggerResult {
  /** Shots fired this call (firearms). */
  shots: Shot[]
  /** Uses this call (everything else). */
  uses: Use[]
  /** `ok`, or why nothing happened. */
  status: 'ok' | 'empty' | 'reloading' | 'cooldown' | 'no_fuel' | 'safe' | 'drawing' | 'fault' | 'misfire' | 'clearing'
  /** Camera kick to apply, degrees [pitch, yaw]. */
  recoil: [number, number]
  /** Audible radius of what happened, metres (0 when nothing). */
  noise: number
  /** Cartridges spent by this call: a shotgun shell is one, a burst is several. */
  rounds: number
  /** Seconds after the start of the call at which each round left the barrel. */
  roundTimes: number[]
  /** The fault that stopped the weapon during this call, if any. */
  fault?: FaultId
}

export type ReloadRequest = 'auto' | 'full' | 'one_by_one'

/** What the weapon is busy with right now, and between which seconds of its own clock. */
export interface WeaponPhase {
  readonly id: 'draw' | 'cycle' | 'reload' | 'clear' | 'mode'
  readonly start: number
  readonly end: number
}

export interface WeaponState {
  readonly def: WeaponDef
  readonly caliber: CaliberDef | null
  /** Rounds in the magazine, fuel or charge left. */
  readonly ammo: number
  readonly capacity: number
  /** Rounds in reserve (the host fills it from the inventory). */
  reserve: number
  mode: FireMode
  readonly reloading: boolean
  /** True after a pistol fires its last round: the slide stays back until the magazine is changed. */
  readonly locked: boolean
  readonly phase: WeaponPhase | null
  /** The fault the weapon is stuck with until it is cleared. */
  readonly fault: FaultId | null
  readonly clearing: boolean
  /** With the safety on the trigger does nothing. */
  readonly safety: boolean
  /** Heat of the barrel, 0 to `rules.heat.cap`. */
  readonly heat: number
  /** 0 to 1: the heat against what the display shows as full. */
  readonly heatLevel: number
  readonly condition: string
  readonly ammoQuality: string
  /** Current spread in degrees (base + bloom). */
  readonly spread: number
  /**
   * Pull or hold the trigger for `dt` seconds from `origin` towards `direction`. `held` = the trigger stays down (auto fire, continuous
   * flame); a new pull with `held: false` fires semi/single once.
   */
  trigger(origin: Vec3, direction: Vec3, dt: number, held?: boolean, source?: string): TriggerResult
  release(): void
  /** Turns the safety on or off; returns the state it is in now. */
  setSafety(on: boolean): boolean
  /** Starts clearing the fault (it takes `timings.clear` seconds); false when there is nothing to clear. */
  clearFault(): boolean
  /** Wear of the weapon, by `rules.conditions` id; it sets how likely a round jams. */
  setCondition(id: string): void
  /** Quality of the rounds, by `rules.ammoQualities` id. */
  setAmmoQuality(id: string): void
  /** Metres of safety fuse for explosives that burn one (dynamite): replaces the explosive's `fuseLength`; `undefined` goes back to it. */
  setFuseLength(metres: number | undefined): void
  /** Start putting the weapon in hand; the trigger answers `drawing` until it is ready. */
  draw(): void
  /**
   * Start a reload; false when there is nothing to do. `auto` picks by the weapon (one by one when it loads that way, a magazine swap
   * otherwise); `full` loads a revolver all at once (speed loader); `one_by_one` forces round by round.
   */
  reload(kind?: ReloadRequest): boolean
  cycleMode(): FireMode
  /** Advance reload, cooldown and spread recovery. */
  update(dt: number): void
  /** Fill the magazine and reserve (test rooms). */
  refill(): void
  /** What happened since the last call (for animation and sound), in order of time; empties the list. */
  drain(): WeaponEvent[]
}

/** Recursively optional; arrays and functions are replaced as a whole, objects are merged. */
export type DeepPartial<TValue> = TValue extends (...args: never[]) => unknown
  ? TValue
  : TValue extends readonly unknown[]
    ? TValue
    : TValue extends object
      ? { [TKey in keyof TValue]?: DeepPartial<TValue[TKey]> }
      : TValue

/** Changes to a weapon def: `action`, `timings` and `dimensions` merge field by field, anything else replaces. */
export type WeaponPatch = DeepPartial<Omit<WeaponDef, 'id'>>

export interface ArsenalOptions {
  /** Extra or overriding calibres, weapons and explosives (merged by id over the ones the kit ships). */
  calibers?: CaliberDef[]
  weapons?: WeaponDef[]
  explosives?: ExplosiveDef[]
  /** Changes to shipped or added entries, by id, applied after the lists above are merged. */
  patch?: {
    weapons?: Record<WeaponId, WeaponPatch>
    calibers?: Record<CaliberId, Partial<CaliberDef>>
    explosives?: Record<ExplosiveId, Partial<ExplosiveDef>>
  }
  /** Entries to leave out, by id. */
  remove?: { weapons?: WeaponId[]; calibers?: CaliberId[]; explosives?: ExplosiveId[] }
  /** Keeps a weapon only when this returns true (applied after `remove`). */
  include?: (def: WeaponDef) => boolean
  /** Numbers that rule faults, heat, noise bursts and handling times. */
  rules?: DeepPartial<WeaponRules>
  /** Replaces display names (merged over the locale). */
  strings?: DeepPartial<WeaponsStrings>
  seed?: number
  locale?: string
}

export interface Arsenal {
  readonly calibers: ReadonlyMap<CaliberId, CaliberDef>
  readonly weapons: ReadonlyMap<WeaponId, WeaponDef>
  readonly explosives: ReadonlyMap<ExplosiveId, ExplosiveDef>
  readonly rules: WeaponRules
  /** Make a runtime state for a weapon (each holder gets its own). Unknown id throws. */
  create(id: WeaponId, options?: { seed?: number; reserve?: number; condition?: string; ammoQuality?: string }): WeaponState
  /** Muzzle energy of a calibre (optionally with a barrel factor). */
  muzzleEnergy(caliber: CaliberId, barrel?: number): number
  /** The explosive a `throw` or `place` use carries, ready to fly (`step`) or wait for its trigger; undefined when the use carries none. */
  explosiveBody(use: Use): ExplosiveBody | undefined
  /** Joules of what one use of a weapon delivers: one projectile (or one pellet), a blast, or a melee blow. */
  energy(id: WeaponId): number
  /** Translated name of a weapon, explosive, fire mode, category, fault, condition or calibre. */
  name(id: string): string
  list(category?: WeaponCategory): WeaponDef[]
}

export type * from './explosive-types'
export type * from './rule-types'
