import { describe, expect, it } from 'vitest'

import { BALANCE, CELL, createRng } from '../../src'
import { THROWN_DEFAULTS } from '../../src/physics/options'
import { CARRIED_BODY, FREE_SLOT, chooseCandidates } from '../../src/physics/thrown'
import type { ThrownCandidate } from '../../src/physics/thrown'
import { COMPRESS_STEPS, createChainScene, createQueueScene, mortarAt, physicsOptions, runSteps } from './scenes'

describe('thrown bodies', () => {
  it('every one lands within 3 s of the grenade, and no more than 32 fly at once', () => {
    const scene = createChainScene()
    runSteps(scene, COMPRESS_STEPS)
    scene.crowd.blast(mortarAt(scene.crowd))
    let peak = 0
    runSteps(scene, 180, () => {
      peak = Math.max(peak, scene.crowd.thrown.active())
    })
    expect(peak).toBeGreaterThan(20)
    expect(peak).toBeLessThanOrEqual(32)
    expect(scene.crowd.thrown.active()).toBe(0)
  })

  it('after 50 removals in the middle of the flight, each slot in use still points at the agent it carried (the last index included)', () => {
    const scene = createChainScene()
    const { crowd } = scene
    runSteps(scene, COMPRESS_STEPS)
    crowd.blast(mortarAt(crowd))
    runSteps(scene, 8)
    const { store, thrown } = crowd
    expect(thrown.active()).toBeGreaterThan(20)
    const random = createRng(9)
    const check = (): void => {
      for (let slot = 0; slot < thrown.size; slot++) {
        const agent = thrown.agent[slot]!
        if (agent === FREE_SLOT || agent === CARRIED_BODY) continue
        expect(agent).toBeLessThan(store.n)
        expect(store.identity[agent]).toBe(thrown.identity[slot])
        expect(store.balance[agent]).toBe(BALANCE.THROWN)
        expect(store.thrown[agent]).toBe(slot)
      }
    }
    let carried = 0
    for (let removed = 0; removed < 50; removed++) {
      const flying = Array.from({ length: thrown.size }, (_, slot) => thrown.agent[slot]!).filter((agent) => agent >= 0)
      const index = removed % 5 === 0 ? store.n - 1 : removed % 2 === 0 ? flying[Math.floor(random() * flying.length)]! : Math.floor(random() * store.n)
      crowd.remove(index)
      check()
    }
    for (let slot = 0; slot < thrown.size; slot++) if (thrown.agent[slot] === CARRIED_BODY) carried++
    expect(carried).toBeGreaterThan(0)
    runSteps(scene, 200)
    expect(thrown.active()).toBe(0)
  })

  // a wall taller than the highest arc of a blast this close (about 7 m): a lower one is flown over, as it should be
  const wallScene = (energy: number, withWall = true) => {
    const scene = createQueueScene({ columns: 4, rows: 3, physics: physicsOptions({ personality: false }) })
    if (withWall) scene.grid.fillRect(-40, -11, 40, -10, CELL.SOLID, 12)
    const { store } = scene.crowd
    for (let i = 0; i < store.n; i++) {
      store.x[i] = ((i % 4) - 1.5) * 0.7
      store.z[i] = -6.5 - Math.floor(i / 4) * 0.7
    }
    scene.crowd.blast({ point: [0, 0.3, -5], energy, radius: 60 })
    runSteps(scene, 240)
    return scene.crowd
  }

  it.each([
    ['15 m/s', 453000],
    ['20 m/s', 2000000],
  ])('nothing thrown at %s through a solid wall ends on the other side', (_label, energy) => {
    const crowd = wallScene(energy)
    expect(crowd.stats.physics.thrownPeak).toBeGreaterThan(0)
    for (let i = 0; i < crowd.store.n; i++) expect(crowd.store.z[i]!).toBeGreaterThan(-10)
    for (const { data } of crowd.corpses.entries) expect(data.z).toBeGreaterThan(-10)
    expect(crowd.corpses.entries.length + crowd.store.n).toBeGreaterThan(0)
  })

  it('without the wall the same bodies do land past it, so the test above proves the wall and not the aim', () => {
    const landed = wallScene(2000000, false).corpses.entries.filter(({ data }) => data.z < -10).length
    expect(landed).toBeGreaterThan(0)
  })
})

describe('who gets the slots: mixed, fastest, nearest', () => {
  const random = createRng(2)
  const candidates: ThrownCandidate[] = Array.from({ length: 100 }, (_, index) => ({ index, speed: 4 + random() * 6, vx: 1, vy: 1, vz: 1, distance: random() * 30 }))
  const identityOf = (index: number): number => index
  const pick = (priority: 'mixed' | 'fastest' | 'nearest', mixedRatio = 0.5) => chooseCandidates([...candidates], 32, { ...THROWN_DEFAULTS, priority, mixedRatio }, identityOf)
  const fastest = [...candidates].sort((a, b) => b.speed - a.speed)

  it('mixed gives half the slots to the fastest and half to the nearest of the others', () => {
    const chosen = new Set(pick('mixed').map((candidate) => candidate.index))
    expect(chosen.size).toBe(32)
    const fastHalf = fastest.slice(0, 16)
    expect(fastHalf.every((candidate) => chosen.has(candidate.index))).toBe(true)
    const rest = fastest.slice(16).sort((a, b) => a.distance - b.distance).slice(0, 16)
    expect(rest.every((candidate) => chosen.has(candidate.index))).toBe(true)
  })

  it('the ratio moves the division, and the choice is the same every time', () => {
    const quarter = new Set(pick('mixed', 0.25).map((candidate) => candidate.index))
    expect(fastest.slice(0, 8).every((candidate) => quarter.has(candidate.index))).toBe(true)
    expect(quarter.has(fastest[8]!.index) || fastest[8]!.distance <= 30).toBe(true)
    expect(pick('mixed').map((candidate) => candidate.index)).toEqual(pick('mixed').map((candidate) => candidate.index))
  })

  it('fastest takes only the fastest, nearest only the nearest, and everybody flies when there is room', () => {
    expect(pick('fastest').map((candidate) => candidate.index).sort()).toEqual(fastest.slice(0, 32).map((candidate) => candidate.index).sort())
    const nearest = [...candidates].sort((a, b) => a.distance - b.distance).slice(0, 32)
    expect(pick('nearest').map((candidate) => candidate.index).sort()).toEqual(nearest.map((candidate) => candidate.index).sort())
    expect(chooseCandidates(candidates.slice(0, 10), 32, THROWN_DEFAULTS, identityOf)).toHaveLength(10)
  })

  it('in the queue the default pool is full of bodies of both kinds, and the same scene gives the same pool', () => {
    const flying = (): number[] => {
      const scene = createQueueScene({ columns: 8, rows: 30 })
      runSteps(scene, COMPRESS_STEPS)
      scene.crowd.blast(mortarAt(scene.crowd))
      scene.crowd.update(1 / 60, scene.context)
      const { thrown } = scene.crowd
      return Array.from({ length: thrown.size }, (_, slot) => thrown.identity[slot]!).sort()
    }
    const first = flying()
    expect(first).toHaveLength(32)
    expect(flying()).toEqual(first)
  })
})
