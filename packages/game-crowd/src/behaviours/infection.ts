import type { Crowd } from '../crowd'
import type { Civilians } from './civilians'

/** What the crowd needs of a region model: `game-infection`'s `Infection` is one as it is. */
export type InfectionModelLike = {
  materialize(region: string, n: number): { state: 'active' | 'contained' | 'removed'; seed: number }[]
  giveBack(region: string, batch: { state: 'active' | 'contained' | 'removed'; seed: number }[]): void
  infect(region: string, n?: number, hoursElapsed?: number): void
}

export type InfectionBindingOptions = {
  /** Where the k-th agent of a batch is born in the region, from its seed; null skips it (it goes straight back). */
  readonly place: (region: string, seed: number, k: number) => readonly [number, number] | null
  /** The crowd type of an agent (default: drawn by the pack's weights). */
  readonly typeFor?: (agent: { readonly state: 'active' | 'contained' | 'removed'; readonly seed: number }, region: string) => number
  /** The relevance band from which an agent goes back to the model (default 3: farther than 400 m). */
  readonly giveBackBand?: number
  /** Civilians whose bites the model hears about (`infect`), in the region `regionOf` gives. */
  readonly civilians?: Civilians
  readonly regionOf?: (x: number, z: number) => string | null
}

export type InfectionBinding = {
  /** Brings up to `n` infected of `region` out of the model into the crowd. Returns the agents born. */
  materialize(region: string, n: number): number[]
  /** Gives back to the model the agents of `region` (all regions when left out) that are in the far band, or all of them with `all`. */
  giveBack(region?: string, options?: { readonly all?: boolean }): number
  /** The region of a materialised agent, or null. */
  regionOf(agent: number): string | null
  unbind(): void
}

/**
 * Ties a crowd to a region model (`game-infection`): `materialize` turns the model's numbers into agents near the player, a kill of one of them
 * goes back to its region as removed, the far ones go back with `giveBack`, and a civilian's bite is an `infect`. No team code exists for this bridge
 * (decision P12 of the spec); the model's own API is used as it is.
 */
export function bindInfection(crowd: Crowd, model: InfectionModelLike, options: InfectionBindingOptions): InfectionBinding {
  const tracked = new Map<number, { region: string; state: 'active' | 'contained' | 'removed'; seed: number }>()
  const band = options.giveBackBand ?? 3
  const offKill = crowd.on('kill', ({ agent }) => {
    const entry = tracked.get(agent)
    if (!entry) return
    // it left the numbers when it was materialised: it goes back as removed (a `remove` would take one more active from the model)
    model.giveBack(entry.region, [{ state: 'removed', seed: entry.seed }])
    tracked.delete(agent)
  })
  const offRemove = crowd.on('remove', ({ agent, moved }) => {
    tracked.delete(agent)
    if (moved < 0) return
    const entry = tracked.get(moved)
    if (!entry) return
    tracked.delete(moved)
    tracked.set(agent, entry)
  })
  const offBite = options.civilians?.on('bitten', ({ id }) => {
    const n = options.civilians?.get(id)
    const region = n && options.regionOf?.(n.x, n.z)
    if (region) model.infect(region, 1, 0)
  })
  return {
    materialize(region, n) {
      const batch = model.materialize(region, n)
      const born: number[] = []
      const back: typeof batch = []
      batch.forEach((agent, k) => {
        const at = options.place(region, agent.seed, k)
        const i = at ? crowd.spawn(at[0], at[1], options.typeFor?.(agent, region) ?? -1) : -1
        if (i < 0) {
          back.push(agent)
          return
        }
        tracked.set(i, { region, state: agent.state, seed: agent.seed })
        born.push(i)
      })
      if (back.length) model.giveBack(region, back)
      return born
    },
    giveBack(region, opts = {}) {
      const byRegion = new Map<string, { state: 'active' | 'contained' | 'removed'; seed: number }[]>()
      const indices = [...tracked.keys()].sort((a, b) => b - a)
      for (const i of indices) {
        const entry = tracked.get(i)
        if (!entry || (region !== undefined && entry.region !== region)) continue
        if (!opts.all && crowd.store.band[i]! < band) continue
        let list = byRegion.get(entry.region)
        if (!list) byRegion.set(entry.region, (list = []))
        list.push({ state: entry.state, seed: entry.seed })
        tracked.delete(i)
        crowd.remove(i)
      }
      let count = 0
      for (const [r, list] of byRegion) {
        model.giveBack(r, list)
        count += list.length
      }
      return count
    },
    regionOf: (agent) => tracked.get(agent)?.region ?? null,
    unbind() {
      offKill()
      offRemove()
      offBite?.()
      tracked.clear()
    },
  }
}
