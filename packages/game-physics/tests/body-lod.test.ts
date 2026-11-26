import { describe, expect, it } from 'vitest'

import { createBodyLod, DEFAULT_BODY_LOD, farthestSleeping, newBodyLodDecision, rungBelow } from '../src/index'
import type { BodyLodInput } from '../src/index'

const input = (change: Partial<BodyLodInput>): BodyLodInput => ({
  rung: 'r1', distance: 5, asleepSeconds: 0, sinceChangeSeconds: 10, touchingCorpses: 0, moundHeight: 0, hasBodyAbove: false, pileRank: 0, woken: false, ...change,
})

describe('the body LOD policy', () => {
  const lod = createBodyLod()
  const decide = (change: Partial<BodyLodInput>) => {
    const out = newBodyLodDecision()
    lod.decide(input(change), out)
    return { to: out.to, forced: out.forced }
  }

  it('has the numbers of the design as its defaults', () => {
    expect(lod.numbers).toEqual(DEFAULT_BODY_LOD)
    expect(DEFAULT_BODY_LOD).toMatchObject({ ragdollDistance: 18, chainDistance: 55, chainReturnDistance: 50, unloadDistance: 80, loadDistance: 75, ragdollsMax: 1, dynamicBodiesMax: 900, islandBodiesMax: 300 })
  })

  it('a ragdoll in a pile (two dead bodies touching, or a mound over 50 cm) becomes a chain at once, forced', () => {
    expect(decide({ rung: 'r0', touchingCorpses: 2, sinceChangeSeconds: 0 })).toEqual({ to: 'r1', forced: true })
    expect(decide({ rung: 'r0', moundHeight: 0.6, sinceChangeSeconds: 0 })).toEqual({ to: 'r1', forced: true })
    expect(decide({ rung: 'r0', touchingCorpses: 1, moundHeight: 0.5 })).toEqual({ to: 'r0', forced: false })
  })

  it('a pile keeps only its `pileChainsMax` nearest chains: the rest are capsules, changed at once, and a woken capsule does not come back while beyond them', () => {
    const limited = createBodyLod({ pileChainsMax: 10 })
    const run = (change: Partial<BodyLodInput>) => {
      const out = newBodyLodDecision()
      limited.decide(input(change), out)
      return { to: out.to, forced: out.forced }
    }
    expect(run({ rung: 'r1', touchingCorpses: 2, pileRank: 9 })).toEqual({ to: 'r1', forced: false })
    expect(run({ rung: 'r1', touchingCorpses: 2, pileRank: 10 })).toEqual({ to: 'r2', forced: true })
    expect(run({ rung: 'r1', touchingCorpses: 1, pileRank: 50 })).toEqual({ to: 'r1', forced: false })
    expect(run({ rung: 'r2', touchingCorpses: 2, pileRank: 10, distance: 5, woken: true })).toEqual({ to: 'r2', forced: false })
    expect(run({ rung: 'r2', touchingCorpses: 2, pileRank: 9, distance: 5, woken: true })).toEqual({ to: 'r1', forced: false })
    expect(decide({ rung: 'r1', touchingCorpses: 2, pileRank: 1000 })).toEqual({ to: 'r1', forced: false })
  })

  it('a capsule that sleeps 2 s under another body in a pile freezes, as a chain does', () => {
    expect(decide({ rung: 'r2', touchingCorpses: 2, hasBodyAbove: true, asleepSeconds: 2 })).toEqual({ to: 'r2f', forced: false })
    expect(decide({ rung: 'r2', touchingCorpses: 2, hasBodyAbove: true, asleepSeconds: 1 })).toEqual({ to: 'r2', forced: false })
  })

  it('a ragdoll past 18 m becomes a chain, not forced, and never goes back up by distance', () => {
    expect(decide({ rung: 'r0', distance: 18.5 })).toEqual({ to: 'r1', forced: false })
    expect(decide({ rung: 'r0', distance: 17.5 })).toEqual({ to: 'r0', forced: false })
    expect(decide({ rung: 'r1', distance: 2 })).toEqual({ to: 'r1', forced: false })
  })

  it('the base of a pile that has slept 2 s under another body freezes; one that has not, does not', () => {
    expect(decide({ rung: 'r1', touchingCorpses: 3, hasBodyAbove: true, asleepSeconds: 2 })).toEqual({ to: 'r2f', forced: false })
    expect(decide({ rung: 'r1', touchingCorpses: 3, hasBodyAbove: true, asleepSeconds: 1.9 })).toEqual({ to: 'r1', forced: false })
    expect(decide({ rung: 'r1', touchingCorpses: 3, hasBodyAbove: false, asleepSeconds: 5 })).toEqual({ to: 'r1', forced: false })
    expect(decide({ rung: 'r2f', distance: 500, asleepSeconds: 100 })).toEqual({ to: 'r2f', forced: false })
  })

  it('goes down by distance only when it sleeps, and comes back with the gap of the hysteresis', () => {
    expect(decide({ rung: 'r1', distance: 56, asleepSeconds: 2 })).toEqual({ to: 'r2', forced: false })
    expect(decide({ rung: 'r1', distance: 56, asleepSeconds: 1 })).toEqual({ to: 'r1', forced: false })
    expect(decide({ rung: 'r2', distance: 51, woken: true })).toEqual({ to: 'r2', forced: false })
    expect(decide({ rung: 'r2', distance: 49, woken: true })).toEqual({ to: 'r1', forced: false })
    expect(decide({ rung: 'r2', distance: 49, woken: false })).toEqual({ to: 'r2', forced: false })
    expect(decide({ rung: 'r2', distance: 81, asleepSeconds: 3 })).toEqual({ to: 'r3', forced: false })
    expect(decide({ rung: 'r3', distance: 76 })).toEqual({ to: 'r3', forced: false })
    expect(decide({ rung: 'r3', distance: 74 })).toEqual({ to: 'r2', forced: false })
  })

  it('a body that changed rung less than a second ago stays, whatever its distance does (no flicker at the edge)', () => {
    expect(decide({ rung: 'r0', distance: 19, sinceChangeSeconds: 0.5 })).toEqual({ to: 'r0', forced: false })
    expect(decide({ rung: 'r1', distance: 60, asleepSeconds: 5, sinceChangeSeconds: 0.5 })).toEqual({ to: 'r1', forced: false })
    expect(decide({ rung: 'r3', distance: 10, sinceChangeSeconds: 0.5 })).toEqual({ to: 'r3', forced: false })
  })

  it('the quota takes the farthest sleeper, the lowest id among equals, and nothing when none sleeps', () => {
    const bodies = [
      { id: 1, rung: 'r0' as const, distance: 10, asleep: true },
      { id: 2, rung: 'r0' as const, distance: 30, asleep: false },
      { id: 4, rung: 'r0' as const, distance: 20, asleep: true },
      { id: 3, rung: 'r0' as const, distance: 20, asleep: true },
    ]
    expect(farthestSleeping(bodies, 'r0')).toBe(3)
    expect(farthestSleeping(bodies, 'r1')).toBe(-1)
    expect(farthestSleeping(bodies.filter((body) => !body.asleep), 'r0')).toBe(-1)
    expect([rungBelow('r0'), rungBelow('r1'), rungBelow('r2'), rungBelow('r3'), rungBelow('r2f')]).toEqual(['r1', 'r2', 'r3', 'r3', 'r2f'])
  })

  it('options replace the numbers one by one', () => {
    const custom = createBodyLod({ ragdollDistance: 30, ragdollsMax: 4 })
    expect(custom.numbers).toMatchObject({ ragdollDistance: 30, ragdollsMax: 4, chainDistance: 55 })
  })
})
