import appearance from '../data/appearance.json'

const { variance } = appearance

export type BuildClass = 'lean' | 'average' | 'heavy'

/** What `zSpawn` draws for a body: height, width, how it builds up and the speed jitters. Every field comes from the stream, in the game's order. */
export type BodyVariance = {
  readonly height: number
  readonly build: number
  readonly buildClass: BuildClass
  /** Multiplies the chase speed: the build factor times a 0.92 .. 1.08 jitter. */
  readonly speedFactor: number
  /** Multiplies the wander speed: 0.8 .. 1.2. */
  readonly wanderFactor: number
  /** Multiplies the health: 0.9 lean, 1.15 heavy. */
  readonly healthFactor: number
}

export type VarianceScale = { readonly height?: number; readonly build?: number }

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/**
 * One body's variance from `random`, drawing exactly what the game's `zSpawn` draws after the type, age and outfit picks:
 * three draws for the height (a gaussian), one for the build band plus one inside it, one for the speed and one for the wander speed.
 * `scale` is the type's own scale (a brute's 1.42) and `build` its width factor.
 */
export const drawBodyVariance = (random: () => number, scale: VarianceScale = {}): BodyVariance => {
  const spread = (random() + random() + random() - 1.5) * variance.height.gaussianSpread
  const height = clamp(1 + spread, variance.height.min, variance.height.max) * (scale.height ?? 1)
  const band = random()
  const bands = variance.buildBands as readonly { below?: number; base: number; range: number }[]
  const found = bands.find((candidate) => candidate.below !== undefined && band < candidate.below) ?? (bands[bands.length - 1] as { base: number; range: number })
  const { base, range } = found
  const build = (base + random() * range) * (scale.build ?? 1)
  const buildClass: BuildClass = band < 0.3 ? 'lean' : band >= 0.8 ? 'heavy' : 'average'
  const speedBuild = buildClass === 'lean' ? variance.buildSpeed.lean : buildClass === 'heavy' ? variance.buildSpeed.heavy : 1
  const healthBuild = buildClass === 'lean' ? variance.buildHealth.lean : buildClass === 'heavy' ? variance.buildHealth.heavy : 1
  return {
    height,
    build,
    buildClass,
    speedFactor: speedBuild * (variance.speedJitter.base + random() * variance.speedJitter.range),
    wanderFactor: variance.wanderJitter.base + random() * variance.wanderJitter.range,
    healthFactor: healthBuild,
  }
}

/** Variants baked per type (the game's `nv`): 4 walkers, 3 runners, 2 crawlers and brutes, 1 for the rest. */
export const variantCountFor = (typeId: string): number => (variance.variantCount as Readonly<Record<string, number>>)[typeId] ?? 1

/** The seed of variant `variant` of the type at `typeIndex` (the game's ZVAR rule: `7000 + c·101 + v·13`). */
export const variantSeed = (typeIndex: number, variant: number): number => variance.variantSeedBase + typeIndex * 101 + variant * 13

/** The decay each variant is baked at: 1, 2, 1, 2. */
export const variantDecay = (variant: number): number => (variant % 2 === 0 ? 1 : 2)
