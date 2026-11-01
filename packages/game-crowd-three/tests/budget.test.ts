import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { createCrowd } from '@adatechnology/game-crowd'
import type { CrowdPack } from '@adatechnology/game-crowd'
import { describe, expect, it } from 'vitest'

import { createCrowdInstances } from '../src'

const pack = undeadCrowdPack() as unknown as CrowdPack
const eyes = pack.types.map((type) => type.eye ?? null)
const sizes = Array.from({ length: 20 }, () => ({ s: 1.7, bulk: 1 }))
const frame = { camera: { x: 0, z: 0 }, viewYaw: 0 }

/** A horde packed in front of the camera, a ring of bodies every 0.05 m out to `reach`. */
const packed = (count: number, reach: number) => {
  const crowd = createCrowd({ pack, seed: 3, capacity: count })
  for (let k = 0; k < count; k++) crowd.spawn(0, -(1 + (k / count) * reach), 0)
  return crowd
}

const levelsOf = (budget: readonly number[] | undefined, count: number, detailScale = 1, frames = 300): number[] => {
  const crowd = packed(count, 60)
  const instances = createCrowdInstances({ eyes, variety: { impostorFrom: 90, ...(budget ? { budget } : {}) } })
  let counts: number[] = []
  for (let f = 0; f < frames; f++) {
    counts = [0, 0, 0, 0]
    instances.agents(crowd.store, sizes, { ...frame, detailScale }, (_v, level) => counts[level]!++)
  }
  return counts
}

describe('the level budget of a packed horde', () => {
  it('keeps the nominal levels without a budget', () => {
    const [near, middle, far, impostor] = levelsOf(undefined, 400)
    expect(near! + middle! + far! + impostor!).toBe(400)
    expect(near).toBeGreaterThan(100)
  })

  it('holds each level to its budget, the nearest bodies on the best mesh', () => {
    const [near, middle, far, impostor] = levelsOf([40, 80, 120], 400)
    expect(near).toBeLessThanOrEqual(50)
    expect(near! + middle!).toBeLessThanOrEqual(150)
    expect(near! + middle! + far!).toBeLessThanOrEqual(300)
    expect(near! + middle! + far! + impostor!).toBe(400)
  })

  it('leaves a horde that fits the budget on the nominal levels', () => {
    expect(levelsOf([400, 400, 400], 400)).toEqual(levelsOf(undefined, 400))
  })

  it('shrinks the levels with the detail scale', () => {
    const full = levelsOf([200, 300, 400], 400)
    const half = levelsOf([200, 300, 400], 400, 0.5)
    expect(half[0]).toBeLessThan(full[0]!)
    expect(half[2]).toBeGreaterThan(full[2]!)
  })
})
