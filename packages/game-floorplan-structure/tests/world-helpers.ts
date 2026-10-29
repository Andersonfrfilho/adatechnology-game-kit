import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec } from '@adatechnology/game-contracts'

export interface Fallen {
  /** Parts that ended broken or in a `collapse` event. */
  down: Set<string>
  /** Ids of the parts that were not touched and are still up. */
  stands(id: string): boolean
}

const BLOW_ENERGY = 5e6
const SECONDS = 90

/** Strikes each listed part once with a blow that breaks it (a cut, a demolition charge) and lets the world run until it settles. */
export function breakParts(spec: DestructibleSpec, removed: readonly string[], seconds = SECONDS): Fallen {
  const world = createDestruction({ seed: 5 })
  const id = world.add(spec)
  const collapsed: string[] = []
  world.on('*', (event) => {
    if (event.type === 'collapse') collapsed.push(...event.parts)
  })
  for (const part of removed) {
    const spec_ = spec.parts.find((p) => p.id === part)
    if (!spec_) throw new Error(`No part ${part}`)
    world.hitPart(id, part, { type: 'blunt', point: spec_.position, energy: BLOW_ENERGY, radius: 0.05, source: 'test' })
  }
  for (let t = 0; t < seconds; t += 0.1) world.update(0.1)
  const broken = world.state(id)!.parts.filter((p) => p.status === 'broken').map((p) => p.id)
  const down = new Set([...broken, ...collapsed])
  return { down, stands: (part) => !down.has(part) }
}

export const idsStarting = (spec: DestructibleSpec, prefix: string): string[] => spec.parts.filter((p) => p.id.startsWith(prefix)).map((p) => p.id)
