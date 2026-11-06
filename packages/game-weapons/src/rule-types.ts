import type { AttachmentId, AttachmentInstall, MountKind, StatModifier, StockDef, StockState } from './attachment-types'
import type { ExplosiveTripwire } from './explosive-types'
import type { AmmoCore, AmmoJacket, CaseType, FireMode, WeaponCategory, WeaponDef, WeaponId } from './types'

export type FaultId = 'misfire' | 'stovepipe' | 'double_feed' | 'failure_to_extract'

/** Wear of a weapon and how likely it jams. */
export interface ConditionDef {
  readonly id: string
  /** Chance of a fault per round, 0 to 1. */
  readonly faultChance: number
}

/** Quality of the ammunition and how likely a round does not fire. */
export interface AmmoQualityDef {
  readonly id: string
  readonly faultChance: number
}

export interface FaultContext {
  readonly def: WeaponDef
  readonly condition: ConditionDef
  /** Barrel temperature above ambient in °C. */
  readonly heat: number
}

/** Numbers that rule how weapons behave in a game; override any of them with `ArsenalOptions.rules`. */
export interface WeaponRules {
  readonly faults: boolean
  readonly conditions: readonly ConditionDef[]
  readonly defaultCondition: string
  readonly ammoQualities: readonly AmmoQualityDef[]
  readonly defaultAmmoQuality: string
  readonly faultChance: (context: FaultContext) => number
  /** Barrel temperature above ambient, in °C. A round adds `share x muzzle energy / (barrel mass x specificHeat)`; the barrel cools by Newton's law with a time constant that grows with its mass. */
  readonly heat: {
    /** Highest temperature above ambient the barrel can reach. */
    readonly cap: number
    /** The temperature the display shows as full (`heatLevel` 1). */
    readonly displayMax: number
    /** The warning: from here the weapon is hot enough to fail (the fault chance grows by `1 / faultSpan` per °C). */
    readonly faultFrom: number
    readonly faultSpan: number
    /** J/(kg·K) of the barrel steel. */
    readonly specificHeat: number
    /** Fraction of the muzzle energy of a round that ends as heat in the barrel, by cartridge case. */
    readonly barrelShare: Readonly<Record<CaseType, number>>
    /** Barrel kg per metre of barrel length, by category. */
    readonly barrelKilogramsPerMetre: Readonly<Partial<Record<WeaponCategory, number>>>
    /** What a weapon with no barrel length or no listed category is given. */
    readonly barrelFallback: { readonly metres: number; readonly kilogramsPerMetre: number }
    /** Cooling time constant in seconds: `baseSeconds + secondsPerKilogram x barrel mass`. */
    readonly cooling: { readonly baseSeconds: number; readonly secondsPerKilogram: number }
    /** °C a rocket launch adds to the tube. */
    readonly perRocket: number
    /** What the player sees of the heat: wisps of smoke only while the barrel is above `smokeFrom` and for `smokeSeconds` after the last shot, thicker over `smokeSpan` °C; the red glow from `glowFrom` over `glowSpan` °C. */
    readonly visual: {
      readonly smokeFrom: number
      readonly smokeSpan: number
      readonly smokeSeconds: number
      readonly glowFrom: number
      readonly glowSpan: number
    }
    /** The abstract units the Galeria 3D do Arsenal recorded (a fixed amount per case and linear cooling); when present they replace the physical model, so the recorded runs stay reproducible. */
    readonly gallery?: {
      readonly perShot: Readonly<Record<CaseType, number>>
      readonly decayBase: number
      readonly decayPerPoint: number
    }
  }
  /** Each shot in the last `window` seconds raises the noise radius by `step`, up to `cap`. */
  readonly noiseBurst: { readonly step: number; readonly window: number; readonly cap: number }
  /** How thrown and launched explosives fly and bounce. */
  readonly explosives: {
    /** m/s². */
    readonly gravity: number
    /** Fraction of the speed along the surface normal kept (and reversed) in a bounce off the ground. */
    readonly groundRestitution: number
    /** Fraction of the speed along the ground kept after a bounce off the ground. */
    readonly groundFriction: number
    /** Fraction of the speed kept (and reversed) in a bounce off a wall. */
    readonly wallRestitution: number
    /** A timer explosive whose fuse is at least this many seconds is set down lit instead of thrown (a long safety fuse: a delayed trap). */
    readonly placeFuseFrom: number
    /** The wire of a charge set down with the `wire` trigger that does not name one. */
    readonly tripwire: Required<ExplosiveTripwire>
  }
  /** Putting accessories on and taking them off. */
  readonly attachments: {
    /** Seconds the work takes, by where it can be done: with the hands, with a tool, at a bench. */
    readonly fitSeconds: Readonly<Record<AttachmentInstall, number>>
    /** Seconds to change between the weapon and the launcher under its barrel. */
    readonly switchSeconds: number
    /** m/s: a bullet slower than this is subsonic (a suppressor mutes it more). */
    readonly speedOfSound: number
  }
  /** Time to raise the weapon to the sights (`base` + `perKg` × mass) and how much worse the hip is: `hipSpread` times the spread when not aiming (1: no difference). */
  readonly aim: {
    readonly base: number
    readonly perKg: number
    readonly hipSpread: number
    /**
     * How much the view closes in while aiming down the iron sights, by weapon category (1 no change): the eye settles on the sights and the field narrows. A fitted optic gives its
     * own magnification instead. A category left out does not zoom.
     */
    readonly ironSightZoom: Readonly<Record<string, number>>
  }
  /**
   * A weapon in each hand: which weapons a body can hold one of in each hand (by `categories`, plus the ids in `weapons`, less the ids in `exclude`), and how much worse each one shoots
   * then (`spread` and `recoil` multiply the one-handed numbers: one hand holds the weapon, none steadies it, and the eye cannot sight two at once).
   */
  readonly dualWield: {
    readonly categories: readonly WeaponCategory[]
    readonly weapons: readonly WeaponId[]
    readonly exclude: readonly WeaponId[]
    readonly spread: number
    readonly recoil: number
  }
  /** Folding or sliding in the stock: the seconds it takes and what it does to the weapon while it is in. */
  readonly stock: { readonly seconds: number; readonly collapsed: readonly StatModifier[] }
  /**
   * What a round does to flammable fluid it leaks into (a fuel tank, a jerrycan, a gas bottle): it goes into `Shot.ignition` and `Hit.ignition`, and
   * the damage model rolls it against the container (see `IgnitionRules` of `@adatechnology/game-contracts` for the target side: how full it is, the
   * wall, a fire nearby). A plain bullet that goes through only makes a leak.
   */
  readonly ignition: {
    /**
     * Chance, 0 to 1, that the hard part of the round throws a spark that lights the vapour when it goes through STEEL (nothing sparks against a
     * part that is not metal). Built from construction: the chance of the core and the chance of the jacket are independent, so
     * spark = 1 - (1 - core) x (1 - jacket).
     */
    readonly core: Readonly<Record<AmmoCore, number>>
    readonly jacket: Readonly<Record<AmmoJacket, number>>
    /** Chance, 0 to 1, that the flame of the round lights the fluid (any wall): an incendiary composition, a tracer pyrotechnic. */
    readonly flame: { readonly incendiary: number; readonly tracer: number }
  }
  readonly draw: number
  readonly clear: number
  readonly startSafe: boolean
}

export type ReloadKind = 'tactical' | 'empty' | 'one_by_one'

export type ReloadStageId =
  | 'magazine_out'
  | 'magazine_in'
  | 'charge'
  | 'bolt_open'
  | 'round_in'
  | 'bolt_close'
  | 'pump_cycle'
  | 'lever_cycle'
  | 'cylinder_open'
  | 'cylinder_eject'
  | 'cylinder_load'
  | 'cylinder_close'
  | 'barrels_open'
  | 'casings_eject'
  | 'rounds_in'
  | 'barrels_close'
  | 'cover_open'
  | 'belt_swap'
  | 'cover_close'
  | 'tank_swap'
  | 'tube_drop'
  | 'tube_seat'
  | 'rocket_seat'
  | 'breech_open'
  | 'breech_close'

/** `at` is a fraction (0 to 1) of the whole reload. */
export interface ReloadStage {
  readonly stage: ReloadStageId
  readonly at: number
}

/** Events a weapon emits for a host to animate and play sounds; `at` is the weapon clock in seconds. */
export type WeaponEvent =
  | { type: 'draw'; phase: 'start' | 'end'; at: number }
  | { type: 'shot'; shots: number; rounds: number; mode: FireMode; at: number; suppressed?: boolean }
  | { type: 'misfire'; at: number }
  | { type: 'cycle'; phase: 'start' | 'end'; at: number }
  | { type: 'reload'; phase: 'start' | 'end'; kind: ReloadKind; at: number }
  | { type: 'reload_stage'; stage: ReloadStageId; at: number }
  | { type: 'feed'; at: number }
  | { type: 'empty'; at: number }
  | { type: 'mode'; mode: FireMode; at: number }
  | { type: 'fault'; fault: FaultId; at: number }
  | { type: 'clear'; fault: FaultId; phase: 'start' | 'end'; at: number }
  | { type: 'safety'; on: boolean; at: number }
  /** Cooking a throwable: `start` pulls the pin, `throw` releases it with `fuse` seconds left, `burst` is the fuse running out while held (`fuse` 0). */
  | { type: 'cook'; phase: 'start' | 'throw' | 'burst'; fuse: number; at: number }
  /** An accessory goes on (`fit`), comes off (`remove`) or breaks (`break`, a home-made suppressor). `mount` is where it was. */
  | { type: 'attachment'; action: 'fit' | 'remove' | 'break'; id: AttachmentId; mount: MountKind; at: number }
  /** A light or a laser is turned on or off. */
  | { type: 'toggle'; id: AttachmentId; on: boolean; at: number }
  /** The stock is folded or slid in (`collapsed`) or opened (`extended`). */
  | { type: 'stock'; state: StockState; kind: StockDef['kind']; at: number }
  /** The weapon in the hand changes between the rifle and the launcher under its barrel. */
  | { type: 'underbarrel'; on: boolean; at: number }
