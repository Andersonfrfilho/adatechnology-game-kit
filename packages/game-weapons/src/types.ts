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

export type Vec3 = [number, number, number]

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
}

export type FireMode = 'single' | 'semi' | 'burst' | 'auto' | 'pump' | 'bolt' | 'lever' | 'break'

export type WeaponCategory =
  | 'pistol'
  | 'revolver'
  | 'smg'
  | 'rifle'
  | 'carbine'
  | 'sniper'
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
      /** Audible distance in metres (a horde game uses it to attract zombies). */
      noise: number
    }
  | { kind: 'melee'; damage: 'blunt' | 'slash'; energy: number; radius: number; reach: number; rpm: number; noise: number; stamina?: number }
  | { kind: 'flame'; temperature: number; radius: number; range: number; fuelPerSecond: number; fuel: number; cone?: boolean; noise: number }
  | { kind: 'heat'; temperature: number; radius: number; range: number; fuelPerSecond: number; fuel: number; noise: number }
  | { kind: 'throwable'; /** Throwables carried (default 3). */ count?: number; energy: number; radius: number; fuse: number; throwSpeed: number; fire?: { temperature: number; radius: number; seconds: number }; noise: number }
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
}

/** A ballistic shot (one per pellet). */
export interface Shot {
  origin: Vec3
  /** Unit vector. */
  direction: Vec3
  /** Muzzle energy in joules. */
  energy: number
  /** mm */
  caliber: number
  caliberId: CaliberId
  speed: number
  /** Energy at a distance, with the calibre's drag. */
  energyAt(distance: number): number
  pellet: number
  weapon: WeaponId
  source?: string
}

/** One use of a non-firearm (melee swing, flame tick, heat tick, throw, tool tick, extinguisher tick). */
export type Use =
  | { kind: 'melee'; damage: 'blunt' | 'slash'; energy: number; radius: number; reach: number; origin: Vec3; direction: Vec3 }
  | { kind: 'flame'; temperature: number; radius: number; range: number; cone: boolean; duration: number; origin: Vec3; direction: Vec3 }
  | { kind: 'heat'; temperature: number; radius: number; range: number; duration: number; origin: Vec3; direction: Vec3 }
  | { kind: 'throw'; energy: number; radius: number; fuse: number; velocity: Vec3; origin: Vec3; fire?: { temperature: number; radius: number; seconds: number } }
  | { kind: 'tool'; tool: string; reach: number; duration: number; origin: Vec3; direction: Vec3 }
  | { kind: 'extinguish'; range: number; coolC: number; duration: number; origin: Vec3; direction: Vec3 }
  | { kind: 'hand'; reach: number; origin: Vec3; direction: Vec3 }

export interface TriggerResult {
  /** Shots fired this call (firearms). */
  shots: Shot[]
  /** Uses this call (everything else). */
  uses: Use[]
  /** `ok`, or why nothing happened. */
  status: 'ok' | 'empty' | 'reloading' | 'cooldown' | 'no_fuel' | 'safe'
  /** Camera kick to apply, degrees [pitch, yaw]. */
  recoil: [number, number]
  /** Audible radius of what happened, metres (0 when nothing). */
  noise: number
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
  /** Current spread in degrees (base + bloom). */
  readonly spread: number
  /**
   * Pull or hold the trigger for `dt` seconds from `origin` towards `direction`. `held` = the trigger stays down (auto fire, continuous
   * flame); a new pull with `held: false` fires semi/single once.
   */
  trigger(origin: Vec3, direction: Vec3, dt: number, held?: boolean, source?: string): TriggerResult
  release(): void
  reload(): boolean
  cycleMode(): FireMode
  /** Advance reload, cooldown and spread recovery. */
  update(dt: number): void
  /** Fill the magazine and reserve (test rooms). */
  refill(): void
}

export interface ArsenalOptions {
  /** Extra or overriding calibres and weapons (merged by id over `CALIBERS` and `WEAPONS`). */
  calibers?: CaliberDef[]
  weapons?: WeaponDef[]
  seed?: number
  locale?: string
}

export interface Arsenal {
  readonly calibers: ReadonlyMap<CaliberId, CaliberDef>
  readonly weapons: ReadonlyMap<WeaponId, WeaponDef>
  /** Make a runtime state for a weapon (each holder gets its own). Unknown id throws. */
  create(id: WeaponId, options?: { seed?: number; reserve?: number }): WeaponState
  /** Muzzle energy of a calibre (optionally with a barrel factor). */
  muzzleEnergy(caliber: CaliberId, barrel?: number): number
  /** Translated name of a weapon / calibre category / fire mode. */
  name(id: WeaponId): string
  list(category?: WeaponCategory): WeaponDef[]
}
