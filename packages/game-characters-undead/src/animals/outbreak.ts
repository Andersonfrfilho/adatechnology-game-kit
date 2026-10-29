/** What the outbreak needs to know of a species: structural, so this package does not import `game-animals`. */
export type OutbreakSpecies = {
  readonly id: string
  /** `turns` becomes a zombie animal, `dies` dies of it (and leaves a carcass), `immune` shrugs it off. */
  readonly outcome: 'turns' | 'dies' | 'immune'
  readonly outbreak?: {
    readonly turnMinutes?: { readonly min: number; readonly max: number }
    /** Chance that a bite infects (default 1). */
    readonly biteInfectionChance?: number
    readonly deathHours?: { readonly min: number; readonly max: number }
    readonly carcass?: { readonly lureRadiusMetres: number; readonly lureDays: number; readonly vulturesArriveMinutes: number }
  }
}

export type OutbreakOptions = {
  readonly species: readonly OutbreakSpecies[]
  /** The game switches the rule on or off. Default on. */
  readonly enabled?: boolean
  /** Game seconds per real second: 1 is real time, 60 makes a 10-minute turn take 10 seconds. Default 1. */
  readonly timeScale?: number
}

/** The fate a bite set going for one animal. Times are absolute, in real seconds. */
export type AnimalFate = {
  readonly speciesId: string
  readonly outcome: 'turns' | 'dies'
  readonly bittenAt: number
  /** When it turns or dies. */
  readonly dueAt: number
}

export type AnimalFateState = 'incubating' | 'turned' | 'dead'

export type Carcass = {
  readonly speciesId: string
  readonly position: readonly [number, number, number]
  readonly createdAt: number
  /** Zombies within this many metres are drawn to it. */
  readonly lureRadiusMetres: number
  readonly lureUntil: number
  /** When the vultures arrive. */
  readonly vulturesAt: number
}

export type AnimalOutbreak = {
  enabled: boolean
  /** A bite lands on an animal of `speciesId`. `undefined`: the rule is off, the species is immune, or the infection did not take. */
  bite(speciesId: string, random: () => number, now: number): AnimalFate | undefined
  stateOf(fate: AnimalFate, now: number): AnimalFateState
  /** The carcass a dead animal leaves (species with a `carcass` rule); `undefined` for the rest or when the rule is off. */
  carcass(speciesId: string, position: readonly [number, number, number], now: number): Carcass | undefined
  /** Whether a zombie at `distance` metres is drawn by the carcass at `now`. */
  lures(carcass: Carcass, distance: number, now: number): boolean
  /** Whether the vultures have arrived. */
  vulturesArrived(carcass: Carcass, now: number): boolean
}

const SECONDS = { minute: 60, hour: 3600, day: 86_400 } as const

const between = (range: { readonly min: number; readonly max: number }, random: () => number): number => (range.min === range.max ? range.min : range.min + random() * (range.max - range.min))

/**
 * The rule that makes bitten animals turn or die (the Bichos do Vale: a species turns in 10 to 30 minutes, the rat in 2, the jaguar in an hour; the big
 * herbivores die in 2 to 6 hours and leave a carcass that draws zombies within 200 m for a day while vultures arrive in 10 minutes). All the numbers
 * come from the species' own `outbreak` data; the rule is switchable and the clock scalable.
 */
export const createAnimalOutbreak = (options: OutbreakOptions): AnimalOutbreak => {
  const species = new Map(options.species.map((entry) => [entry.id, entry]))
  const scale = options.timeScale ?? 1
  const seconds = (value: number, unit: number): number => (value * unit) / scale
  const outbreak: AnimalOutbreak = {
    enabled: options.enabled ?? true,
    bite(speciesId, random, now) {
      const entry = species.get(speciesId)
      if (!outbreak.enabled || !entry || entry.outcome === 'immune') return undefined
      const chance = entry.outbreak?.biteInfectionChance ?? 1
      if (chance < 1 && random() >= chance) return undefined
      if (entry.outcome === 'turns') {
        const range = entry.outbreak?.turnMinutes
        return range ? { speciesId, outcome: 'turns', bittenAt: now, dueAt: now + seconds(between(range, random), SECONDS.minute) } : undefined
      }
      const range = entry.outbreak?.deathHours
      return range ? { speciesId, outcome: 'dies', bittenAt: now, dueAt: now + seconds(between(range, random), SECONDS.hour) } : undefined
    },
    stateOf: (fate, now) => (now < fate.dueAt ? 'incubating' : fate.outcome === 'turns' ? 'turned' : 'dead'),
    carcass(speciesId, position, now) {
      const rule = species.get(speciesId)?.outbreak?.carcass
      if (!outbreak.enabled || !rule) return undefined
      return {
        speciesId,
        position,
        createdAt: now,
        lureRadiusMetres: rule.lureRadiusMetres,
        lureUntil: now + seconds(rule.lureDays, SECONDS.day),
        vulturesAt: now + seconds(rule.vulturesArriveMinutes, SECONDS.minute),
      }
    },
    lures: (carcass, distance, now) => now < carcass.lureUntil && distance <= carcass.lureRadiusMetres,
    vulturesArrived: (carcass, now) => now >= carcass.vulturesAt,
  }
  return outbreak
}
