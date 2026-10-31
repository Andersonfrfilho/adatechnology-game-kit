import type * as THREE_NS from 'three'
import type { LightPool } from '@adatechnology/game-vfx'
import { LIGHT_PRIORITY } from '@adatechnology/game-render-three'
import type { LightBudget, LightHandle } from '@adatechnology/game-render-three'
import type { ThreeLib } from './types'

/** Below this the pool entry counts as off, so its slot goes back to the budget in the same frame. */
export const LIGHT_ON_THRESHOLD = 0.05
const FIRE_COLOR = 0xff7a2a
const FIRE_DECAY = 2
const BLAST_DECAY = 2

/** Keeps one budget handle per pool entry: takes a slot while the entry burns, gives it back the frame it goes out. */
export function followEntry(
  budget: LightBudget,
  handles: (LightHandle | null)[],
  index: number,
  entry: { readonly intensity: number },
  request: Parameters<LightBudget['acquire']>[0],
): void {
  const handle = handles[index] ?? null
  if (entry.intensity <= LIGHT_ON_THRESHOLD) {
    handle?.release({ fadeMs: 0 })
    handles[index] = null
    return
  }
  if (handle?.alive) {
    handle.update({ color: request.color, intensity: request.intensity, distance: request.distance, position: request.position })
    return
  }
  handles[index] = budget.acquire(request)
}

export interface LightLayer {
  readonly group: THREE_NS.Group
  /** Moves and lights the 4 blast lights and 2 fire lights from the pool; answers how many are lit. */
  sync(): number
  dispose(): void
}

/** The Lab's light pool as real point lights (L349-365). Colours are the raw numbers the Lab used, not converted from sRGB. */
export function createLightLayer(THREE: ThreeLib, pool: LightPool, scale: number, budget?: LightBudget): LightLayer {
  const group = new THREE.Group()
  if (budget) return createBudgetedLightLayer(group, pool, scale, budget)
  const blast = pool.blast.map(() => {
    // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
    const light = new THREE.PointLight(0xffa050, 0, 30, 2)
    light.position.set(0, -50, 0)
    group.add(light)
    return light
  })
  const fire = pool.fire.map(() => {
    // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
    const light = new THREE.PointLight(0xff7a2a, 0, 16, 2)
    light.position.set(0, -50, 0)
    group.add(light)
    return light
  })
  return {
    group,
    sync() {
      let lit = 0
      pool.blast.forEach((entry, index) => {
        const light = blast[index]!
        light.position.set(entry.x, entry.y, entry.z)
        light.distance = entry.distance
        light.color.setRGB(entry.color[0], entry.color[1], entry.color[2], THREE.LinearSRGBColorSpace)
        light.intensity = entry.intensity * scale
        if (entry.intensity > 0.05) lit++
      })
      pool.fire.forEach((entry, index) => {
        const light = fire[index]!
        light.position.set(entry.x, entry.y, entry.z)
        light.distance = entry.distance
        light.intensity = entry.intensity * scale
        if (entry.intensity > 0.05) lit++
      })
      return lit
    },
    dispose() {
      for (const light of [...blast, ...fire]) light.dispose()
    },
  }
}

/** The same lights as requests to the budget; the group stays in the root, empty, so the indices of the root's children do not move. */
function createBudgetedLightLayer(group: THREE_NS.Group, pool: LightPool, scale: number, budget: LightBudget): LightLayer {
  const blast: (LightHandle | null)[] = pool.blast.map(() => null)
  const fire: (LightHandle | null)[] = pool.fire.map(() => null)
  return {
    group,
    sync() {
      let lit = 0
      pool.blast.forEach((entry, index) => {
        const request = { owner: 'vfx.blast', priority: LIGHT_PRIORITY.blast, urgent: true, color: entry.color, intensity: entry.intensity * scale, distance: entry.distance, decay: BLAST_DECAY, position: [entry.x, entry.y, entry.z] as const }
        followEntry(budget, blast, index, entry, request)
        if (entry.intensity > LIGHT_ON_THRESHOLD) lit++
      })
      pool.fire.forEach((entry, index) => {
        const request = { owner: 'vfx.fire', priority: LIGHT_PRIORITY.fire, color: FIRE_COLOR, intensity: entry.intensity * scale, distance: entry.distance, decay: FIRE_DECAY, position: [entry.x, entry.y, entry.z] as const }
        followEntry(budget, fire, index, entry, request)
        if (entry.intensity > LIGHT_ON_THRESHOLD) lit++
      })
      return lit
    },
    dispose() {
      for (const handle of [...blast, ...fire]) handle?.release({ fadeMs: 0 })
    },
  }
}
