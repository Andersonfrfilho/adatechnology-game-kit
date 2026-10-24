import type * as THREE_NS from 'three'

/** How the gallery builders describe a weapon: the short keys of `data/models.json` (the page's own option names), all optional. */
export interface ModelOptions {
  /** Total length and barrel length in mm, and the calibre text, as the weapons table gives them. */
  L?: number
  B?: number
  cal?: string
  /** Pistol style (`glock`, `taurus`, `g2c`, `beretta`, `pt100`, `sig`, `cz`, `m1911`, `makarov`, `fiveseven`, `deagle`), slide height, grip length. */
  st?: string
  h?: number
  gl?: number
  deagle?: number
  /** Metal and furniture finish. */
  steel?: number
  stain?: number
  wood?: number
  olive?: number
  tan?: number
  /** Selector or safety mark, cyclic rate (rpm), rounds in a burst, how unreliable (`rel`). */
  sel?: number
  rpm?: number
  burst?: number
  rel?: number
  /** Rifle layout. */
  stock?: string
  stockLen?: number
  hg?: string
  hgFrac?: number
  hR?: number
  wR?: number
  br?: number
  grip?: string
  gripAt?: number
  mag?: string
  magLen?: number
  magAt?: number
  magMat?: string
  curve?: number
  fore?: number
  tubeLen?: number
  scope?: number
  brake?: number
  ejectBack?: number
  round?: number
  ar?: number
  ak?: number
  g3?: number
  charge?: number
  rail?: number
  jacket?: number
  gas?: number
  noFH?: number
  carry?: number
  bipod?: number
  bolt?: number
  lever?: number
  tube?: number
  pump?: number
  heat?: number
  /** Chambers of the revolver cylinder (default 6): the capacity of the weapon. */
  chambers?: number
  bayo?: number
  rod?: number
  bands?: number
  shot?: number
  /** Launcher type: `rpg`, `m72`, `at4`, `carl`, `flame`, `flameDIY`. */
  lt?: string
}

/**
 * Numbers the builders write down while they draw, in the space of `inner` (metres along the barrel, before `fitLength` stretches it): where the accessories go.
 * Written by the rifle and the M134 builders; the others get theirs measured from the model (`deriveFrames`).
 */
export interface ModelFrames {
  length: number
  barrelY: number
  barrelRadius: number
  receiverStart: number
  receiverEnd: number
  receiverHeight: number
  receiverWidth: number
  handguardEnd: number
  magazineX: number
  gripX: number
  /** The top rail is drawn (an optic sits on it without an adapter). */
  hasRail: boolean
  /** Where the gun joins what is under the barrel (x, y), when the model has a place for it that the rule does not derive from the handguard. */
  underbarrel?: readonly [number, number]
}

/** The moving mechanism of a model, which picks its fire, reload and clear motion. */
export type ModelFamily = 'pistol' | 'revolver' | 'rifle' | 'semiint' | 'semi12' | 'p90' | 'belt' | 'pump' | 'lever' | 'bolt' | 'boltmag' | 'break' | 'rocket' | 'flame'

/** The named parts a model exposes to the animation: pivots and marks inside the model, never copies. */
export interface ModelParts {
  family: ModelFamily
  /** Recoil strength of the model (the page's `kick`). */
  kick?: number
  /** How far the slide or bolt travels back, in metres. */
  stroke?: number
  slide?: THREE_NS.Object3D
  bolt?: THREE_NS.Object3D
  boltHandle?: THREE_NS.Object3D
  boltHandleRest?: number
  mag?: THREE_NS.Object3D | null
  /** How far a magazine drops, and `1` for one that goes up. */
  magDrop?: number
  magDir?: number
  trigger?: THREE_NS.Object3D
  hammer?: THREE_NS.Object3D
  lever?: THREE_NS.Object3D
  pump?: THREE_NS.Object3D
  belt?: THREE_NS.Object3D
  cover?: THREE_NS.Object3D
  crane?: THREE_NS.Object3D
  cylinder?: THREE_NS.Object3D
  chambers?: THREE_NS.Object3D[]
  barrels?: THREE_NS.Object3D
  breech?: THREE_NS.Object3D[]
  /** The existing selector or safety mesh; the gallery draws it but does not move it. */
  safety?: THREE_NS.Object3D
  muzzle?: THREE_NS.Object3D
  eject?: THREE_NS.Object3D
  loadPort?: THREE_NS.Object3D
  topLoad?: THREE_NS.Object3D
  /** Parts that glow with barrel heat; each owns a clone of its material. */
  glow: THREE_NS.Mesh[]
  /** Launchers. */
  launcherType?: string
  disposable?: boolean
  rear?: THREE_NS.Object3D
  round?: THREE_NS.Object3D
  roundRest?: number
  makeRound?: () => THREE_NS.Object3D
  gauge?: THREE_NS.Object3D
  /** Where the accessories go (see `ModelFrames`). */
  frames?: ModelFrames
  /** The meshes of the stock the builder drew, in the order it drew them: `rigStock` moves them into one pivot. */
  stockMeshes?: THREE_NS.Object3D[]
  /** The stock pivot `rigStock` made, and how it moves. */
  stock?: THREE_NS.Object3D
  stockMove?: StockMove
  /** The meshes of each part that ships on the weapon, by accessory id (`red_dot`, `bipod`, `muzzle_brake`): taking the accessory off hides them. */
  fittings?: Record<string, THREE_NS.Object3D[]>
  /** The pivot a launcher under the barrel sits in (made by `rigUnderbarrel`), and its muzzle mark once one is fitted. */
  ugl?: THREE_NS.Object3D
  uglMuzzle?: THREE_NS.Object3D
}

/** How the stock moves when it collapses: a slide of `travel` metres along the weapon (in `inner` units), or a half turn about `axis` (`foldAxis` of the rule). */
export interface StockMove {
  kind: 'fold' | 'retract'
  axis: 'x' | 'y' | 'z'
  travel: number
}

export interface BuiltModel {
  /** The builder's root (the gallery's `inner`), before it is fitted to the real length. */
  group: THREE_NS.Group
  parts: ModelParts
}
