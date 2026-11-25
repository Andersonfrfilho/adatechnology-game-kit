import type * as THREE_NS from 'three'
import type { ModuleHost } from '@adatechnology/game-contracts'
import { drainLeak, startLeak } from '@adatechnology/game-urban/networks'
import type { LeakState, PipeContent } from '@adatechnology/game-urban/networks'

import { createHouseBuriedPipes } from '../construction-stages/buried-pipes.js'
import type { HouseBuriedPipes } from '../construction-stages/buried-pipes.js'
import type { Three } from '../kernel-types.js'

/** The liquid of `game-fluids` each content of a pipe leaks: the rain pipe runs clear. */
const LIQUID_OF: Readonly<Record<PipeContent, string>> = { water: 'water', sewage: 'sewage', stormwater: 'water' }
/** How far down along the pipe a leak that does not spray leaves (it runs out of the broken end into the hole). */
const RUN_DIP = -0.2

export interface BuriedLeaks {
  /** The houses now standing: their buried pipes, read again after each build. */
  setHouses(houses: readonly THREE_NS.Object3D[]): void
  /** One simulated step: each running leak lets out what it has, and its tap closes once it is empty. */
  step(dt: number): void
  /** Mends the pipes and closes the taps (the host cleared or reset the area). */
  reset(): void
  dispose(): void
}

interface Running {
  readonly state: LeakState
  readonly stop: () => void
}

/**
 * The houses' buried sewer and rain pipes in the host's ground: each bowl the host digs (`onCrater`) is asked of every house (`createHouseBuriedPipes`), a pipe it reaches shows in the hole,
 * one it breaks leaks into it through a tap of the host (`addTap`) until what it held has run out. A host without a terrain or liquids gets the pipes shown and broken, nothing running.
 */
export function createBuriedLeaks(host: ModuleHost, THREE: Three): BuriedLeaks {
  let houses: HouseBuriedPipes[] = []
  const running: Running[] = []

  const stopAll = (): void => {
    for (const { stop } of running.splice(0)) stop()
  }
  const stopCraters = host.onCrater?.((crater) => {
    const isRaining = (host.environment?.get().rain ?? 0) > 0
    for (const house of houses) {
      const { leaks } = house.crater(crater, { isRaining })
      for (const leak of leaks) {
        const pipe = house.pipes.find((piece) => piece.id === leak.id)!
        const [dx, dz] = [pipe.to[0] - pipe.from[0], pipe.to[2] - pipe.from[2]]
        const length = Math.hypot(dx, dz) || 1
        // the sewer falls towards the street: what it carries runs out of the end that broke off upstream, on down the line
        const direction: [number, number, number] = [dx / length, RUN_DIP, dz / length]
        const stop = host.addTap?.({ id: `leak:${leak.id}`, position: [leak.at[0], leak.at[1] + leak.diameter / 2, leak.at[2]], direction, liquid: LIQUID_OF[leak.content], rate: leak.rate }) ?? (() => undefined)
        running.push({ state: startLeak(leak), stop })
        host.log(`${leak.content} pipe broken by a crater: ${leak.rate} L/s`, { pipe: leak.id, content: leak.content, rate: leak.rate, volume: leak.volume, crater }, 'network_leak')
      }
    }
  })

  return {
    setHouses(groups) {
      stopAll()
      for (const house of houses) house.dispose()
      houses = groups.flatMap((group) => createHouseBuriedPipes(THREE, group) ?? [])
    },
    step(dt) {
      for (let index = running.length - 1; index >= 0; index--) {
        const entry = running[index]!
        drainLeak(entry.state, dt)
        if (entry.state.remaining > 0) continue
        entry.stop()
        running.splice(index, 1)
      }
    },
    reset() {
      stopAll()
      for (const house of houses) house.reset()
    },
    dispose() {
      stopCraters?.()
      stopAll()
      for (const house of houses) house.dispose()
      houses = []
    },
  }
}
