import type { CaliberId, DataSource, FireMode, WeaponCategory, WeaponId } from './types'

export type AttachmentId = string

/** Where on a weapon something goes. */
export type MountKind = 'muzzle' | 'rail_top' | 'rail_bottom' | 'rail_left' | 'rail_right' | 'underbarrel' | 'magazine' | 'stock' | 'barrel' | 'sling' | 'feed'

/**
 * A place on a weapon an accessory can take. `interfaces` is what the place accepts: `picatinny`, `mlok`, `ak_side`, `dovetail`, `thread_1/2x28`, `thread_5/8x24`,
 * `thread_14x1lh`, `thread_24x1.5`, `hk_3lug`, `m203`, `gp25`, `ag36`, `mag_<family>`, `buffer_tube`, `swivel`, `belt`, `tripod`.
 */
export interface MountDef {
  readonly kind: MountKind
  readonly interfaces: readonly string[]
  /** Metres of rail or free length at the place. */
  readonly length?: number
  readonly sources: readonly DataSource[]
}

/** What an accessory changes on the weapon it is on. */
export type WeaponStat =
  | 'noise'
  | 'spread'
  | 'hipSpreadExcess'
  | 'recoilVertical'
  | 'recoilHorizontal'
  | 'range'
  | 'muzzleSpeed'
  | 'mass'
  | 'capacity'
  | 'reload'
  | 'reloadEmpty'
  | 'draw'
  | 'aim'
  | 'faultChance'
  | 'heatPerShot'

/** When an effect counts: `supported` is lying down or on a bipod or tripod, `subsonic` the bullet is slower than sound, `collapsed` the stock is folded. */
export type EffectCondition = 'always' | 'aiming' | 'hip' | 'supported' | 'subsonic' | 'collapsed'

/** One change of one number: every `set` first, then the sum of the `add`s, then the product of the `mul`s. */
export interface StatModifier {
  readonly stat: WeaponStat
  readonly mul?: number
  readonly add?: number
  readonly set?: number
  readonly when?: EffectCondition
}

export type AttachmentKind =
  | 'suppressor'
  | 'muzzle_device'
  | 'optic'
  | 'light'
  | 'laser'
  | 'grip'
  | 'bipod'
  | 'underbarrel'
  | 'magazine'
  | 'stock'
  | 'barrel'
  | 'sling'
  | 'feed'
  | 'mount'

export type AttachmentInstall = 'field' | 'tool' | 'bench'

export interface AttachmentDef {
  readonly id: AttachmentId
  /** Generic real-world description used as the default name. */
  readonly name?: string
  readonly kind: AttachmentKind
  /** The places it can take. */
  readonly mounts: readonly MountKind[]
  /** The interfaces it fits (one of them must be on the mount). */
  readonly interfaces: readonly string[]
  /** Places that stop being usable while it is on (a grenade launcher takes the lower rail). */
  readonly blocks?: readonly MountKind[]
  /** A suppressor takes calibres up to a diameter and an energy; `ids` limits it to named calibres. */
  readonly calibers?: { readonly maxDiameter?: number; readonly maxEnergy?: number; readonly ids?: readonly CaliberId[] }
  readonly categories?: readonly WeaponCategory[]
  /** Kg. */
  readonly mass: number
  /** Metres. */
  readonly dims?: { readonly length: number; readonly diameter?: number; readonly width?: number; readonly height?: number }
  /** Where it can be put on: in the field with the hands, with a tool, or only at a bench. */
  readonly install: AttachmentInstall
  readonly removable?: boolean
  readonly effects: readonly StatModifier[]
  readonly optic?: { readonly zoom: readonly [number, number]; readonly reticle: 'dot' | 'holo' | 'chevron' | 'duplex' | 'mildot'; readonly vision?: 'day' | 'night' | 'thermal'; readonly batteryHours?: number }
  readonly light?: { readonly coneDeg: number; readonly range: number; readonly visibleFrom: number; readonly batteryHours?: number }
  readonly laser?: { readonly color: number; readonly range: number; readonly visibleFrom: number }
  /** The weapon a grenade launcher accessory is. */
  readonly launcher?: WeaponId
  /** Shots until it breaks, between the two numbers (a home-made suppressor). */
  readonly durability?: { readonly shots: readonly [number, number] }
  /** Carried on the back (an ammunition backpack). */
  readonly carry?: 'back'
  /** Can be slung, which lets the weapon be stowed on the body (a sling). */
  readonly stowable?: boolean
  /** The effects count on every second reload only: the spare magazine is already coupled (a dual coupler). */
  readonly secondReload?: boolean
  /** Name of the model the renderer draws it with. */
  readonly model: string
  readonly sources: readonly DataSource[]
}

/** An accessory on a weapon: the place it is in, whether it came with the weapon (`integral`) and, for a light or a laser, whether it is on. */
export interface FittedAttachment {
  readonly id: AttachmentId
  readonly mount: MountKind
  readonly integral?: boolean
  readonly on?: boolean
  /** Shots until a home-made accessory breaks (drawn when it goes on). */
  readonly shotsLeft?: number
}

export type StockState = 'collapsed' | 'extended'

/** What the stock of a weapon does: `fold` swings to a side, `retract` slides in, `none` has no shoulder piece. */
export interface StockDef {
  readonly kind: 'fixed' | 'fold' | 'retract' | 'fold_retract' | 'none'
  readonly foldAxis?: 'right' | 'left' | 'under' | 'over'
}

/** What `snapshot()` gives and `arsenal.restore()` takes: enough to rebuild a weapon exactly as it was (the random streams restart from the seed given). */
export interface WeaponSnapshot {
  readonly id: WeaponId
  readonly attachments: readonly FittedAttachment[]
  readonly stock: StockState
  readonly ammo: number
  readonly reserve: number
  readonly mode: FireMode
  readonly condition: string
  readonly ammoQuality: string
  readonly ammoKind?: string
  readonly underbarrel?: WeaponSnapshot
}
