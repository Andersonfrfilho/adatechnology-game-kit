// The one energy ruler of spec 008 (C1, C2, C3, C3b, C4). No imports on purpose: the bowl test uses it from vitest, and the room probes (plain JS run in the
// page) take it bundled by `specs/008-motor-fisico-jolt/decision/probes/run.sh`. It lives in `tests/`, so it is in no package's public API.

const GRAVITY = 9.81
const REST_SPEED = 0.05
const REST_SPIN = 0.1
/** C1 allowance: an island may gain this much energy height per update (m). */
const C1_ALLOWANCE = 0.001
/** C2 limit: energy height a piece may gain above its last rest in an episode (m). */
export const C2_LIMIT = 0.035

export type Vec3 = readonly [number, number, number]

/** The inertia tensor of a body about its centre of mass in its own frame (kg m^2): xx, yy, zz, xy, xz, yz. */
export type InertiaTensor = readonly [number, number, number, number, number, number]

/**
 * Energy height of a body (DECISION-fable §2): y of the centre of mass + (|v|^2 + w.Iw/m) / 2g; `bodyAngularVelocity` is w in the body's frame. I is the inertia of the body's box,
 * unless the engine's own tensor is given (`inertia`): a piece whose parts are thin plates at one end turns with an inertia that is not its box's.
 */
export const energyHeightOf = (body: { readonly centreY: number; readonly velocity: Vec3; readonly bodyAngularVelocity: Vec3; readonly halfExtents: Vec3; readonly mass?: number; readonly inertia?: InertiaTensor }): number => {
  const [hx, hy, hz] = body.halfExtents
  const [wx, wy, wz] = body.bodyAngularVelocity
  const tensor = body.inertia
  const spin = tensor && body.mass
    ? (tensor[0] * wx * wx + tensor[1] * wy * wy + tensor[2] * wz * wz + 2 * (tensor[3] * wx * wy + tensor[4] * wx * wz + tensor[5] * wy * wz)) / body.mass
    : ((hy * hy + hz * hz) * wx * wx + (hx * hx + hz * hz) * wy * wy + (hx * hx + hy * hy) * wz * wz) / 3
  const [vx, vy, vz] = body.velocity
  return body.centreY + (vx * vx + vy * vy + vz * vz + spin) / (2 * GRAVITY)
}

/** One piece at one instant. `radius` is the bounding sphere that decides which pieces are touching (an island) when no contact graph is given. `groundY` is the ground right below the centre, when known. */
export type EnergySample = {
  readonly id: string
  readonly mass: number
  readonly centre: Vec3
  readonly radius: number
  readonly energyHeight: number
  readonly velocityY: number
  readonly speed: number
  readonly spin: number
  readonly sleeping: boolean
  readonly groundY?: number
}

/**
 * What came from outside during one update: `'none'`; `'wake'` (the region was woken: only the sleep clock restarts); `'energy'` (a blast, a hammer blow, ground
 * that changes, the net: the update leaves C1, C2 and C3 alone, and the sleep clock restarts).
 */
export type OutsideInput = 'none' | 'wake' | 'energy'

export type EnergyRulerResult = {
  /** C1: most `Σ m * energy height` an island gained in one update, over `m_island * 1 mm` (kg m; > 0 fails). */
  readonly c1Excess: number
  /** Island-updates that went over C1. */
  readonly c1Violations: number
  /** C2: most energy height a piece gained above its last rest in an episode where its island also broke C1 (m): a gain the island paid for is not a launch. */
  readonly c2Gain: number
  /** C2 without the C1 condition (the old ruler, the gate 0 column) (m). */
  readonly c2GainUnconditioned: number
  /** Pieces over C2_LIMIT with the C1 condition, and without it (the room column of gate 0). */
  readonly c2PiecesOver: number
  readonly c2PiecesOverUnconditioned: number
  /** C3: most centre rise beyond the piece's own upward speed, summed per piece (m). */
  readonly c3Lift: number
  /** C3b: deepest any centre was under the ground below it, every update (m; > 0 means under the ground). */
  readonly deepest: number
  /** C3b: pieces the engine's net had to put back; 0 on the kit's own solver. */
  readonly fellThrough: number
  /** C4: seconds from the last outside input until every piece slept (-1: not yet). */
  readonly c4AsleepAfter: number
  /** Highest upward speed a piece gained in one update (m/s). */
  readonly maxUp: number
}

type Episode = { base: number; gain: number; violated: boolean }

const isAtRest = (sample: EnergySample): boolean => sample.speed < REST_SPEED && sample.spin < REST_SPIN

/** What a host adds to one update: the contact graph, and the energy height (m) its own rules gave each piece from outside (a delayed blast's shove, the kit's balancing push). */
export type StepContext = {
  readonly touching?: readonly TouchingPair[]
  readonly given?: ReadonlyMap<string, number>
  /** R3: pieces whose continuous-motion body made its first contact in this update (the host reads it from the engine's contact log); only these may have the pull-back below counted out of C1. */
  readonly firstContact?: ReadonlySet<string>
}

/** Two pieces (their ids) the engine had touching at some point of the update: an edge of the contact graph. */
export type TouchingPair = readonly [string, string]

/**
 * The island of every piece (an index). With `touching`, the contact graph the engine gave for the update (pairs touching when it began, and every contact added during it):
 * two pieces are one island when a chain of contacts joins them, as the spec defines it. Without it, the fallback: pieces whose bounding spheres overlap, before or after the
 * update (wider than the contact: one big island when a pile is near).
 */
export const islandsOf = (before: readonly EnergySample[], after: readonly EnergySample[], touching?: readonly TouchingPair[]): number[] => {
  const parent = before.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root] as number
    return root
  }
  if (touching) {
    const indexOf = new Map(before.map((sample, index) => [sample.id, index] as const))
    for (const [first, second] of touching) {
      const a = indexOf.get(first)
      const b = indexOf.get(second)
      if (a !== undefined && b !== undefined) parent[find(a)] = find(b)
    }
    return before.map((_, index) => find(index))
  }
  const near = (a: EnergySample, b: EnergySample): boolean => Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1], a.centre[2] - b.centre[2]) <= a.radius + b.radius
  for (let i = 0; i < before.length; i++) {
    for (let j = i + 1; j < before.length; j++) {
      if (near(before[i] as EnergySample, before[j] as EnergySample) || near(after[i] as EnergySample, after[j] as EnergySample)) parent[find(i)] = find(j)
    }
  }
  return before.map((_, index) => find(index))
}

/** R3: how much less (m) the centre moved than the mean of its vertical speeds over the update says: the part the engine's continuous collision took back. Never negative. */
const pullBackOf = (from: EnergySample, to: EnergySample, dt: number): number =>
  // audit of #311: only a body that is still coming down is pulled back by the cast; one at rest lifted by the position solver (a wake, a tile laid again) is a real gain
  to.centre[1] - from.centre[1] <= 0 && from.velocityY < 0 && to.velocityY < 0 ? Math.max(0, to.centre[1] - from.centre[1] - ((from.velocityY + to.velocityY) / 2) * dt) : 0

/** R1: how much less (rad/s) a piece must turn after the update for its lost energy to be taken as spin that paid for the rise. */
const SPIN_PAYS = 0.1

export class EnergyRuler {
  private time = 0
  private lastInputAt = 0
  private asleepAt: number | undefined
  private c1Excess = -Infinity
  private c1Violations = 0
  private c2Gain = 0
  private c2GainUnconditioned = 0
  private c3Lift = 0
  private deepest = -Infinity
  private fellThrough = 0
  private maxUp = 0
  private readonly episodes = new Map<string, Episode>()
  private readonly pieceGains = new Map<string, { conditioned: number; unconditioned: number }>()
  private readonly lift = new Map<string, number>()

  /**
   * One update: the samples of the same pieces, in the same order, before and after it. `context.touching` is the engine's contact graph for it (`islandsOf`); `context.given` the energy
   * height (m) the host's own rules added to a piece in it: the island's gain is counted without it, the piece's episode starts that much higher, and the sleep clock restarts. What
   * the engine made on top of it still counts; `'energy'` forgives the whole update instead.
   */
  step(before: readonly EnergySample[], after: readonly EnergySample[], dt: number, input: OutsideInput = 'none', context: StepContext = {}): void {
    this.time += dt
    const given = context.given ?? new Map<string, number>()
    if (input !== 'none' || given.size > 0) this.lastInputAt = this.time
    const islands = islandsOf(before, after, context.touching)
    const violated = input === 'energy' ? new Set<number>() : this.measureC1(before, after, { islands, given, firstContact: context.firstContact, dt })
    before.forEach((from, index) => {
      const to = after[index] as EnergySample
      const added = given.get(from.id) ?? 0
      this.measureEpisode(from, to, violated.has(islands[index] as number), input === 'energy', added)
      this.measureLift(from, to, dt, input === 'energy', added)
      this.measureGround(to)
    })
    this.measureSleep(after, input)
  }

  /** C3b: the engine's own count of pieces its net put back (`EnginePieces.fellThrough`). */
  recordFellThrough(count: number): void {
    this.fellThrough = count
  }

  result(): EnergyRulerResult {
    let c2Gain = this.c2Gain
    const gains = new Map(this.pieceGains)
    for (const [id, episode] of this.episodes) {
      if (episode.violated) c2Gain = Math.max(c2Gain, episode.gain)
      gains.set(id, this.withEpisode(gains.get(id), episode))
    }
    const over = (pick: (gain: { conditioned: number; unconditioned: number }) => number): number => [...gains.values()].filter((gain) => pick(gain) > C2_LIMIT).length
    return {
      c1Excess: this.c1Excess,
      c1Violations: this.c1Violations,
      c2Gain,
      c2GainUnconditioned: this.c2GainUnconditioned,
      c2PiecesOver: over((gain) => gain.conditioned),
      c2PiecesOverUnconditioned: over((gain) => gain.unconditioned),
      c3Lift: this.c3Lift,
      deepest: this.deepest,
      fellThrough: this.fellThrough,
      c4AsleepAfter: this.asleepAt === undefined ? -1 : this.asleepAt - this.lastInputAt,
      maxUp: this.maxUp,
    }
  }

  /**
   * C1 per island over `m_island * 1 mm`; returns the islands that went over it. R3: a piece in `firstContact` has the pull-back of the engine's continuous collision
   * taken out of its gain: at the first contact the body is moved back to the instant of impact and keeps its velocity, so its centre moved less than the mean of its
   * vertical speeds says (`from.velocityY`, `to.velocityY`) while nothing was added to it. Only that shortfall counts out, never more than the piece's own gain.
   */
  private measureC1(before: readonly EnergySample[], after: readonly EnergySample[], update: { islands: readonly number[]; given: ReadonlyMap<string, number>; firstContact: ReadonlySet<string> | undefined; dt: number }): Set<number> {
    const gained = new Map<number, { energy: number; mass: number }>()
    before.forEach((from, index) => {
      const to = after[index] as EnergySample
      const island = update.islands[index] as number
      const entry = gained.get(island) ?? { energy: 0, mass: 0 }
      const gain = from.mass * (to.energyHeight - from.energyHeight - (update.given.get(from.id) ?? 0))
      entry.energy += gain - (update.firstContact?.has(from.id) ? Math.min(Math.max(0, gain), from.mass * pullBackOf(from, to, update.dt)) : 0)
      entry.mass += from.mass
      gained.set(island, entry)
    })
    const violated = new Set<number>()
    for (const [island, { energy, mass }] of gained) {
      const excess = energy - mass * C1_ALLOWANCE
      this.c1Excess = Math.max(this.c1Excess, excess)
      if (excess <= 0) continue
      this.c1Violations++
      violated.add(island)
    }
    return violated
  }

  /** C2: gain above the last rest, per episode; an update with outside energy closes the episode and absorbs what it gave. */
  private measureEpisode(from: EnergySample, to: EnergySample, islandViolated: boolean, isOutsideEnergy: boolean, added: number): void {
    const open = this.episodes.get(from.id)
    if (isOutsideEnergy || isAtRest(from) || !open) {
      if (open) this.closeEpisode(from.id, open)
      this.episodes.set(from.id, { base: isOutsideEnergy ? to.energyHeight : from.energyHeight, gain: 0, violated: false })
      if (isOutsideEnergy) return
    }
    const episode = this.episodes.get(from.id) as Episode
    episode.base += added
    episode.gain = Math.max(episode.gain, to.energyHeight - episode.base)
    if (islandViolated) episode.violated = true
    this.c2GainUnconditioned = Math.max(this.c2GainUnconditioned, episode.gain)
  }

  private closeEpisode(id: string, episode: Episode): void {
    if (episode.violated) this.c2Gain = Math.max(this.c2Gain, episode.gain)
    this.pieceGains.set(id, this.withEpisode(this.pieceGains.get(id), episode))
  }

  private withEpisode(gain: { conditioned: number; unconditioned: number } | undefined, episode: Episode): { conditioned: number; unconditioned: number } {
    return { conditioned: Math.max(gain?.conditioned ?? 0, episode.violated ? episode.gain : 0), unconditioned: Math.max(gain?.unconditioned ?? 0, episode.gain) }
  }

  /**
   * C3: centre rise beyond its own upward speed, summed per piece; also the highest upward speed gained. R2 (audit of #311): the energy height the kit declared is taken out of the
   * rise, not the whole update (a pole under the balancing push declares a little on most updates and would never be read). R1: a rise the piece paid for with its own spin (a pole
   * turning flat that climbs a ledge) is not a launch, but a rise with the energy falling and the spin not (a piece that lands at 3 m/s and pops up 5 cm) counts.
   */
  private measureLift(from: EnergySample, to: EnergySample, dt: number, isOutsideEnergy: boolean, declared: number): void {
    if (isOutsideEnergy) return
    const paidBySpin = to.energyHeight <= from.energyHeight && from.spin - to.spin > SPIN_PAYS
    const rise = paidBySpin ? 0 : Math.max(0, to.centre[1] - from.centre[1] - Math.max(0, from.velocityY) * dt - declared)
    const total = (this.lift.get(from.id) ?? 0) + rise
    this.lift.set(from.id, total)
    this.c3Lift = Math.max(this.c3Lift, total)
    if (to.velocityY > Math.max(0, from.velocityY) + 1e-9) this.maxUp = Math.max(this.maxUp, to.velocityY)
  }

  private measureGround(to: EnergySample): void {
    if (to.groundY !== undefined) this.deepest = Math.max(this.deepest, to.groundY - to.centre[1])
  }

  /** C4: the clock runs from the last outside input; it restarts if something wakes after everything slept. */
  private measureSleep(after: readonly EnergySample[], input: OutsideInput): void {
    const allAsleep = input === 'none' && after.every((sample) => sample.sleeping)
    if (!allAsleep) this.asleepAt = undefined
    else this.asleepAt ??= this.time
  }
}
