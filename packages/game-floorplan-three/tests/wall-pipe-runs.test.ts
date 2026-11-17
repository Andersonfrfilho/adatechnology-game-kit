import type { DestructionEvent } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { fakeRoom } from './helpers/area-room'
import { TEMPLATES, THREE, houseOf, planOf } from './helpers/houses'

const LIMIT = 2.5
/** The sleeves at the ends of a pipe stand this far beyond its end (m). */
const SLEEVE = 0.05
const STAGED = { quality: 'game', constructionStages: true, constructionLevel: 8 } as const
const CASES = Object.keys(TEMPLATES).flatMap((template) => [1, 2].map((seed) => [template, seed] as const))

type Part = House['structure']['parts'][number]
const wallRuns = (house: House): Part[] => house.structure.parts.filter((part) => /^pipe:run_wall/.test(part.id))
const diagonalOf = (part: Part): number => Math.hypot(part.aabb[2] - part.aabb[0], part.y1 - part.y0, part.aabb[3] - part.aabb[1])
const heldBy = (house: House): Map<string, string> => new Map(house.structure.supports.map((support) => [support.part, support.on]))

describe('the pipes hidden in the walls of a house built by stages detach in segments too', () => {
  it.each(CASES)('%s, seed %i: no stretch is longer than the limit', (template, seed) => {
    const { house } = houseOf(planOf(template, seed), {}, STAGED)
    expect(wallRuns(house).filter((part) => diagonalOf(part) > LIMIT + 2 * SLEEVE).map((part) => `${part.id}: ${diagonalOf(part).toFixed(2)} m`)).toEqual([])
  })

  it.each(CASES)('%s, seed %i: every stretch is held by a piece that exists, the ones inside a wall or slab are hosted by it, and a run weighs 3 kg', (template, seed) => {
    const { house } = houseOf(planOf(template, seed), {}, STAGED)
    const ids = new Set(house.structure.parts.map((part) => part.id))
    const held = heldBy(house)
    const byRun = new Map<string, number>()
    for (const part of wallRuns(house)) {
      const run = part.id.replace(/:\d+$/, '')
      byRun.set(run, (byRun.get(run) ?? 0) + part.mass)
      const holder = held.get(part.id)
      expect(holder, `${part.id} is held`).toBeDefined()
      expect(ids.has(holder!) || holder === 'ground', `${part.id} -> ${holder}`).toBe(true)
      if (part.hostedIn !== undefined) {
        expect(ids.has(part.hostedIn as string), `${part.id} hosted by ${String(part.hostedIn)}`).toBe(true)
        expect(holder, part.id).toBe(part.hostedIn)
      }
    }
    for (const [run, mass] of byRun) expect(mass, run).toBeCloseTo(3, 6)
  })

  it('the stretches in the walls of a house are hosted by their wall', () => {
    const { house } = houseOf(planOf('casaA', 1), {}, STAGED)
    const hosted = wallRuns(house).filter((part) => part.hostedIn !== undefined)
    expect(wallRuns(house).length).toBeGreaterThan(3)
    expect(hosted.length).toBeGreaterThan(2)
    for (const part of hosted) expect(String(part.hostedIn), part.id).toMatch(/^(wall|slab|partition)/)
  })

  it('the limit is configurable, and no limit draws each run as one part', () => {
    const plan = planOf('casaA', 1)
    for (const part of wallRuns(houseOf(plan, {}, { ...STAGED, segmentLimits: { pipe: 1 } }).house)) expect(diagonalOf(part), part.id).toBeLessThanOrEqual(1 + 2 * SLEEVE)
    const whole = wallRuns(houseOf(plan, {}, { ...STAGED, segmentLimits: { pipe: Infinity } }).house)
    expect(whole.map((part) => part.id).sort()).toEqual(['pipe:run_wall_backyard_outside', 'pipe:run_wall_bathroom_0', 'pipe:run_wall_kitchen_0'])
  })
})

/** A house of the room (built by stages), with every event of its destruction world recorded. */
const roomHouse = (template: string, seed: number) => {
  const room = fakeRoom()
  room.set('template', template)
  room.set('seed', seed)
  room.act('build')
  room.frame(0.2)
  const { house } = room.module.houses[0]!
  const events: DestructionEvent[] = []
  room.world.on('*', (event) => events.push(event))
  return { room, house, id: house.destruction.id!, events }
}

describe('a blast hole in a wall reveals only the stretches of the wall pipe that it reaches', () => {
  it('reveals the stretch at the hole, and the stretches far from it stay embedded and held', () => {
    const scene = roomHouse('single_storey_a', 1)
    const run = scene.house.destruction.spec!.parts.filter((part) => /^pipe:run_wall_bathroom_0/.test(part.id) && part.hostedIn !== undefined)
    expect(run.length).toBeGreaterThan(2)
    // a stretch in the brick of its wall (the lowest: the top one runs up into the bond beam and the slab, cast concrete a 30 kJ blast does not open)
    const stretchOf = (id: string) => scene.house.structure.parts.find((part) => part.id === id)!
    const target = run.filter((part) => /^wall/.test(String(part.hostedIn))).sort((a, b) => stretchOf(a.id).y0 - stretchOf(b.id).y0)[0]!
    const stretch = stretchOf(target.id)
    const centre: [number, number, number] = [(stretch.aabb[0] + stretch.aabb[2]) / 2, (stretch.y0 + stretch.y1) / 2, (stretch.aabb[1] + stretch.aabb[3]) / 2]
    const at = scene.house.group.localToWorld(new THREE.Vector3(...centre))
    scene.room.world.explode([at.x, at.y, at.z], 30000, 15)
    scene.room.frame(3, 0.05)
    const shown = scene.events.filter((event) => event.type === 'reveal').map((event) => (event as { part: string }).part).filter((id) => run.some((part) => part.id === id))
    expect(shown).toContain(target.id)
    expect(shown.length).toBeLessThan(run.length)
    const state = scene.room.world.state(scene.id)!
    for (const part of run.filter((candidate) => !shown.includes(candidate.id))) {
      expect(scene.room.world.part(scene.id, part.id)!.exposed, part.id).toBeUndefined()
      expect(state.joints.some((joint) => joint.id === `${part.id}~${String(part.hostedIn)}` && !joint.open), `${part.id} stays held`).toBe(true)
    }
  })
})
