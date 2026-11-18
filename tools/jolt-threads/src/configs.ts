/** The configurations measured, the page query each one adds, and the summary of a round (pure: tested without a browser). */

export type ThreadConfig = {
  readonly id: string
  readonly label: string
  /** Query parameters added to the room page (`?area=floorplan&solver=jolt&blastDebris=1` plus these). */
  readonly query: string
  /** Whether the kit's rules all run (JS contact listener on): only these are valid for the game. */
  readonly isGameValid: boolean
}

export const THREAD_CONFIGS: readonly ThreadConfig[] = [
  { id: 'single', label: 'single-thread (hoje), contatos JS', query: '', isGameValid: true },
  { id: 'mt0-js', label: 'multithread build, 0 workers, contatos JS', query: '&joltBuild=multithread', isGameValid: true },
  { id: 'single-off', label: 'single-thread, sem listener', query: '&joltContacts=off', isGameValid: false },
  { id: 'mt0-off', label: 'multithread build, 0 workers, sem listener', query: '&joltBuild=multithread&joltContacts=off', isGameValid: false },
  { id: 'mt2-off', label: 'multithread, 2 workers, sem listener', query: '&joltThreads=2&joltContacts=off', isGameValid: false },
  { id: 'mt4-off', label: 'multithread, 4 workers, sem listener', query: '&joltThreads=4&joltContacts=off', isGameValid: false },
  { id: 'mtN-off', label: 'multithread, auto = min(hardwareConcurrency-1, 16) workers, sem listener', query: '&joltThreads=auto&joltContacts=off', isGameValid: false },
]

export const configById = (id: string): ThreadConfig | undefined => THREAD_CONFIGS.find((config) => config.id === id)

export type Stats = { readonly mean: number; readonly p99: number; readonly worst: number }

const round2 = (value: number): number => Math.round(value * 100) / 100

export const statsOf = (values: readonly number[]): Stats => {
  if (values.length === 0) return { mean: 0, p99: 0, worst: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length
  return { mean: round2(mean), p99: round2(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? 0), worst: round2(sorted[sorted.length - 1] ?? 0) }
}

/** What the page reports about the engine it booted (`window.__joltInfo`). */
export type JoltInfo = {
  readonly build: string
  readonly workerThreads: number
  readonly contactCallbacks: string
  readonly crossOriginIsolated: boolean
  readonly hardwareConcurrency: number
  readonly fallback: string | null
}

export type RoundResult = {
  readonly config: string
  readonly round: number
  readonly load: number
  readonly info: JoltInfo
  /** Jolt's step (`world.stepFixed`) per frame, the wake frame (frame 0) apart. */
  readonly step: Stats
  readonly wakeStep: number
  /** The room's whole update per frame (physics, pieces, everything but the render), the wake frame apart. */
  readonly update: Stats
  readonly frames: number
  readonly error?: string
}

/** One round from the probe's frames: column 4 is the whole update and column 6 the `joltStep` stage (`tools/gpu/room-explosion.mjs`, `inPage`). */
export const summariseRound = (frames: readonly (readonly number[])[]): Pick<RoundResult, 'step' | 'wakeStep' | 'update' | 'frames'> => {
  const rest = frames.slice(1)
  return {
    step: statsOf(rest.map((frame) => frame[6] ?? 0)),
    wakeStep: round2(frames[0]?.[6] ?? 0),
    update: statsOf(rest.map((frame) => frame[4] ?? 0)),
    frames: rest.length,
  }
}

/** The rounds of a config pooled: the mean of the means, the median of the p99s and the worst frame of all. */
export const poolRounds = (rounds: readonly RoundResult[], pick: (round: RoundResult) => Stats): Stats => {
  const ok = rounds.filter((round) => !round.error)
  if (ok.length === 0) return { mean: 0, p99: 0, worst: 0 }
  const p99s = ok.map((round) => pick(round).p99).sort((a, b) => a - b)
  return {
    mean: round2(ok.reduce((total, round) => total + pick(round).mean, 0) / ok.length),
    p99: p99s[Math.floor(p99s.length / 2)] ?? 0,
    worst: Math.max(...ok.map((round) => pick(round).worst)),
  }
}
