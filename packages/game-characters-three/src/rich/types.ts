// Types of the Retratos do Vale survivor builder (the port in `person-builder.ts` keeps the page's short field names, so a diff against it stays readable).
import type { HairStyle, MoveBlend } from '@adatechnology/game-characters'

import type { THREE_NS } from '../three'

/** A clothing or gear entry: its id and, for the ones that take it, a colour. */
export type PersonExtra = readonly [id: string, color?: number, ...more: number[]]

/** A survivor as the page describes one (`sp`): colours are hex numbers, the short names are the page's. */
export type PersonSpec = {
  /** Height scale (default 1). */
  readonly h?: number
  /** Width scale (default 1). */
  readonly bulk?: number
  /** Female body. */
  readonly fem?: boolean | number
  readonly skin: number
  readonly hair: { readonly s: string; readonly c: number }
  /** Top: colour, plaid colour (a checked shirt) and sleeve (`tank`, `short`, `long`). */
  readonly top: { readonly c: number; readonly plaid?: number; readonly sl?: string }
  readonly pants: { readonly c: number; readonly skirt?: boolean }
  readonly shoes: number
  readonly ex?: readonly PersonExtra[]
  /** Face features by id (beard, glasses, scar...). */
  readonly face?: readonly string[]
  /** Hat kind and colour; a helmet can carry tape (its colour), a photo and night vision goggles. */
  readonly hat?: { readonly k: string; readonly c: number; readonly tape?: number; readonly photo?: boolean | number; readonly nvg?: boolean | number }
  /** Weapon on the back (`shotgun`). */
  readonly back?: string
  /** Item in the right and in the left hand. */
  readonly hand?: string
  readonly lhand?: string
  /** A dog at the person's side. */
  readonly dog?: boolean | number
  /** Resting forward lean (radians). */
  readonly hunch?: number
}

/** A household as the page lists it: the adult (`b`) and the children, each at its `x`. */
export type PersonGroupSpec = {
  readonly b?: PersonSpec
  readonly kid?: boolean | number
  /** Zombie category (eye colour). */
  readonly zcat?: string
  readonly kids?: ReadonlyArray<PersonSpec & { readonly x: number }>
}

export type ArmRig = {
  g: THREE_NS.Group
  el: THREE_NS.Group
  hg: THREE_NS.Group
  mount: THREE_NS.Group
  /** Side: 1 right, -1 left. */
  s: number
  fingers: THREE_NS.Group[]
  th: THREE_NS.Group | null
  /** Holds an item. */
  hold?: boolean
  /** Two-handed grip. */
  grip?: boolean
}

export type LegRig = { g: THREE_NS.Group; kn: THREE_NS.Group; s: number }

/** One body segment a hit or a cut can reach. */
export type BodySegment = {
  node?: THREE_NS.Object3D
  label: string
  hp: number
  max?: number
  state?: string
  r?: number
  flip?: number
  arm?: number
  leg?: number
  kind?: string
}

export type DogRig = { tail: THREE_NS.Group; dlegs: Array<{ lg: THREE_NS.Group; ph: number }> }

/** A built survivor: the scene graph and the rig `pose` moves. */
export type PersonCharacter = {
  mv: MoveBlend
  phase: number
  turnA: number
  segs: Record<string, BodySegment>
  dmg: { leg: number; dead: number }
  pends: unknown[]
  limp: [number, number]
  skirt: boolean
  root: THREE_NS.Group
  fig: THREE_NS.Group
  upper: THREE_NS.Group
  headG: THREE_NS.Group
  arms: ArmRig[]
  legs: LegRig[]
  skinM: THREE_NS.MeshStandardMaterial
  base: THREE_NS.Color
  eyeM: THREE_NS.MeshBasicMaterial
  bags: THREE_NS.Mesh<THREE_NS.BufferGeometry, THREE_NS.MeshBasicMaterial>
  zb: THREE_NS.Object3D[]
  mouth: THREE_NS.Mesh
  dog: THREE_NS.Group | null
  hunch: number
  ph: number
  /** Drawn as a zombie. */
  z?: boolean
}

/** Where a Bestiário body is cut or torn (each flag draws a stump, a hole or a hanging part). */
export type BestCuts = {
  readonly legs?: boolean
  readonly gut?: boolean
  readonly flaps?: boolean
  readonly head?: boolean
  readonly blown?: boolean
  readonly jaw?: boolean
  readonly armR?: boolean
  readonly armL?: boolean
  readonly dangleR?: boolean
  readonly dangleL?: boolean
  readonly shoulderR?: boolean
  readonly shoulderL?: boolean
}

/** The pose and the look switches of a Bestiário type: the base pose (`BEST` `BASE`) and what a type changes. Angles in radians. */
export type BestPose = {
  s?: number
  bulk?: number
  lean?: number
  armL?: number
  armR?: number
  elbL?: number
  elbR?: number
  legL?: number
  legR?: number
  kneeL?: number
  kneeR?: number
  headX?: number
  headZ?: number
  headFwd?: number
  drop?: number
  neck?: number
  armOut?: number
  noLegs?: boolean
  mouth?: boolean
  bloat?: boolean
  dim?: boolean
  nose?: boolean
  blind?: boolean
  wet?: boolean
  char?: boolean
  gore?: boolean
}

/** A body of the Bestiário (`BEST.build(spec)`): the type by name and what varies. */
export type BestSpec = {
  /** Type name (`Lento`, `Corredor`, ...); unknown names draw the first card. */
  readonly type?: string
  readonly pose?: BestPose
  /** 0 fresh to 3 rotten. */
  readonly decay?: number
  /** 0 fresh-dead, 1 normal, 2 old. */
  readonly life?: number
  readonly cut?: BestCuts
  readonly h?: number
  readonly bulk?: number
  readonly lying?: boolean
  readonly opacity?: number
  /** Outfit id (`policial`, `militar`, ...). */
  readonly outfit?: string
  readonly seed?: number
  /** A baked crowd variant (see `drawAppearance`). */
  readonly uniform?: boolean
  readonly clothIdx?: number
  readonly fem?: boolean
  readonly tone?: number
  readonly hs?: HairStyle
  readonly hair?: number
  /** A living person: human eyes and mouth, no blood. */
  readonly human?: boolean
  readonly skin?: number
  readonly wounds?: number
  readonly eyeDim?: boolean
  readonly eye?: number
  readonly eyesOff?: boolean
  readonly bandage?: boolean
  readonly phase?: number
}
