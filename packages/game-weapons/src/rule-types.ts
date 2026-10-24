import type { AttachmentId, AttachmentInstall, MountKind, StatModifier, StockDef, StockState } from './attachment-types'
import type { ExplosiveTripwire } from './explosive-types'
import type { CaseType, FireMode, WeaponDef } from './types'

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
  /** Heat of the weapon, 0 to `rules.heat.cap`. */
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
  readonly heat: {
    readonly cap: number
    readonly displayMax: number
    readonly decayBase: number
    readonly decayPerPoint: number
    readonly faultFrom: number
    readonly faultSpan: number
    readonly perShot: Readonly<Record<CaseType, number>>
    readonly perRocket: number
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
  readonly aim: { readonly base: number; readonly perKg: number; readonly hipSpread: number }
  /** Folding or sliding in the stock: the seconds it takes and what it does to the weapon while it is in. */
  readonly stock: { readonly seconds: number; readonly collapsed: readonly StatModifier[] }
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
