export type LocaleId = 'en' | 'pt-BR'

/** What happens to the species when a bite lands: it turns, it dies of it, or the infection does nothing. */
export type AnimalOutcome = 'turns' | 'dies' | 'immune'

export type AnimalVisualState = 'alive' | 'infected' | 'dead'

/** A canvas texture as data: the renderer paints it (`stripes`: horizontal bands; `spots`: rosettes). */
export type TextureMarker = { readonly kind: 'stripes'; readonly base: string; readonly stripe: string } | { readonly kind: 'spots'; readonly base: string; readonly spot: string }

export type AnimalColors = { readonly main: number; readonly belly: number; readonly dark: number; readonly nose?: number }

export type QuadrupedLeg = {
  /** Upper and lower length of the front (`fu`, `fl`) and hind (`hu`, `hl`) legs, metres. */
  readonly fu: number
  readonly fl: number
  readonly hu: number
  readonly hl: number
  readonly r: number
  readonly hoof?: number
  readonly dark?: number
  /** Rest angles of the front (`fa1`, `fa2`) and hind (`ha1`, `ha2`) joints, radians. */
  readonly fa1?: number
  readonly fa2?: number
  readonly ha1?: number
  readonly ha2?: number
}

export type QuadrupedSpec = {
  readonly kind: 'quadruped'
  /** Body length and radius, metres. */
  readonly L: number
  readonly R: number
  readonly sx?: number
  readonly sy?: number
  /** Share of the length between the shoulders and the hips. */
  readonly span: number
  readonly up?: number
  /** Radius profile along the body, rear to front, relative to `R`. */
  readonly prof: readonly number[]
  readonly c: AnimalColors
  readonly leg: QuadrupedLeg
  readonly neck: { readonly len: number; readonly r: number; readonly r2?: number; readonly ang: number; readonly y?: number; readonly z?: number }
  readonly head: {
    readonly r: number
    readonly s: readonly [number, number, number]
    readonly sl: number
    readonly sr1: number
    readonly sr2: number
    readonly down?: number
    readonly sy?: number
    readonly muzzle?: number
    readonly sq?: number
  }
  readonly ears: { readonly t: 'cone' | 'round' | 'flop'; readonly s: number; readonly tilt?: number; readonly fwd?: number }
  readonly tail?: {
    readonly n: number
    readonly len: number
    readonly r: number
    readonly ang: number
    readonly y?: number
    readonly curl?: number
    readonly dark?: number
    readonly tuft?: number
    readonly bushy?: number
  } | null
  readonly texture?: TextureMarker
  /** The species has parts that the page builds with code (horns, mane, comb); the renderer owns them. */
  readonly hasExtraBuilder?: boolean
}

export type BirdSpec = {
  readonly kind: 'bird'
  readonly r: number
  readonly s: readonly [number, number, number]
  readonly tars: number
  readonly shank: number
  readonly pitch?: number
  readonly tailA?: number
  readonly tailW: number
  readonly tailL: number
  readonly wi: number
  readonly wo: number
  readonly wc: number
  readonly nr: number
  readonly nl: number
  readonly neckA: number
  readonly headA?: number
  readonly hr: number
  readonly hs?: readonly [number, number, number]
  readonly br: number
  readonly bl: number
  readonly hook?: number
  readonly fingers?: number
  readonly spur?: number
  readonly eyeC?: number
  readonly featherLeg?: number
  readonly c: { readonly main: number; readonly dark: number; readonly leg: number; readonly beak: number; readonly belly?: number }
  readonly tailM?: number
  readonly wingM?: number
  readonly neckM?: number
  readonly headM?: number
  readonly hasExtraBuilder?: boolean
}

export type SnakeSpec = { readonly kind: 'snake' }

export type AnimalBodySpec = QuadrupedSpec | BirdSpec | SnakeSpec

/** How the infection plays out; the engine ignores it, `game-characters-undead` (T4.3c) reads it. */
export type AnimalOutbreak = {
  readonly turnMinutes?: { readonly min: number; readonly max: number }
  readonly biteInfectionChance?: number
  readonly deathHours?: { readonly min: number; readonly max: number }
  readonly carcass?: { readonly lureRadiusMetres: number; readonly lureDays: number; readonly vulturesArriveMinutes: number }
}

export type AnimalSpecies = {
  readonly id: string
  readonly order: number
  readonly name: Readonly<Record<LocaleId, string>>
  readonly scientificName: string
  readonly group: string
  readonly phase: string
  readonly outcome: AnimalOutcome
  readonly outbreak?: AnimalOutbreak
  /** How far its sound carries, metres. */
  readonly soundRangeMetres?: number
  readonly body: AnimalBodySpec
  readonly walkHz: number
  readonly runHz: number
  readonly gallop?: boolean
}

export type AnimalGaitName = 'walk' | 'trot' | 'gallop'

/** Phase of each leg (front right, front left, hind right, hind left) in radians. */
export type GaitPhases = readonly [number, number, number, number]

export type AnimalPack = { readonly id: string; readonly species?: readonly AnimalSpecies[] }

export type AnimalsOptions = {
  readonly packs?: readonly AnimalPack[]
  readonly patch?: Readonly<Record<string, Partial<AnimalSpecies>>>
  readonly remove?: readonly string[]
  /** Replaces the gait tables by name. */
  readonly gaits?: Partial<Record<AnimalGaitName, GaitPhases>>
}
