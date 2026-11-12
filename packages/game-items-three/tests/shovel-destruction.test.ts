import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent, HitResult } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { makeupSpec } from '../src'

type V = [number, number, number]

// The shovel lies on its side (x along it): the handle from x -0.55 to 0.35 up at y 0.053, the blade from x 0.25 to 0.55 down at y 0.006.
const HANDLE_X = -0.3
const BLADE_X = 0.4
const fresh = (seed = 5) => {
  const world = createDestruction({ seed })
  const id = world.add(makeupSpec('shovel')!, { id: 'shovel' })
  return { world, id }
}
const shootDown = (x: number, energy: number, caliber: number, tilt = 0): { results: HitResult[]; world: ReturnType<typeof fresh>['world']; id: string } => {
  const { world, id } = fresh()
  const direction: V = [Math.sin(tilt), -Math.cos(tilt), 0]
  const results = world.shoot([x - direction[0], 0.006 - direction[1], 0], direction, energy, caliber, 'test')
  return { results, world, id }
}
const typesOf = (results: HitResult[]): Set<string> => new Set(results.flatMap((r) => r.events).map((e) => e.type))
const blow = (world: ReturnType<typeof fresh>['world'], id: string, part: string, point: V, energy: number): HitResult =>
  world.hitPart(id, part, { type: 'blunt', point, direction: [0, -1, 0], energy, radius: 0.05, source: 'test' })

describe('a shot into the handle', () => {
  it('a 9 mm that does not reach the 3.5 cm of ash lodges in it and tears splinters out of the hole', () => {
    const { results, world, id } = shootDown(HANDLE_X, 300, 9)
    expect(results[0]).toMatchObject({ part: 'handle', penetrated: false })
    const handle = world.part(id, 'handle')!
    expect(handle.holes).toHaveLength(1)
    expect(handle.holes[0]!.through).toBe(false)
    expect(handle.holes[0]!.point[0]).toBeCloseTo(HANDLE_X, 2)
    expect(typesOf(results)).toContain('chip')
    expect(handle.status).not.toBe('broken')
  })

  it('a bigger round goes through and keeps most of its energy: 7.62 and 12-gauge cut the handle in two where they cross it', () => {
    const splitAt: number[] = []
    for (const [energy, caliber] of [[3000, 7.62], [2800, 18.5]] as const) {
      const { results, world, id } = shootDown(HANDLE_X, energy, caliber)
      expect(results[0]).toMatchObject({ part: 'handle', penetrated: true })
      expect(results[0]!.exitEnergy).toBeGreaterThan(energy * 0.7)
      const fracture = results.flatMap((r) => r.events).find((e): e is Extract<DestructionEvent, { type: 'fracture' }> => e.type === 'fracture')
      expect(fracture).toBeDefined()
      expect(world.part(id, 'handle')!.status).toBe('broken')
      splitAt.push(fracture!.fragments.filter((f) => f.shape === 'slab').length)
    }
    expect(splitAt).toEqual([2, 2])
  })

  it('the 9 mm at 500 J only just crosses it (energy against thickness): little is left of the round', () => {
    const { results } = shootDown(HANDLE_X, 500, 9)
    expect(results[0]).toMatchObject({ part: 'handle', penetrated: true })
    expect(results[0]!.exitEnergy).toBeLessThan(50)
  })
})

describe('a shot into the blade', () => {
  it('a small round dents the 2 mm steel and stays out of it', () => {
    const { results, world, id } = shootDown(BLADE_X, 150, 5.6)
    expect(results[0]).toMatchObject({ part: 'blade', penetrated: false })
    const blade = world.part(id, 'blade')!
    expect(blade.dents).toHaveLength(1)
    expect(blade.holes).toHaveLength(0)
  })

  it('a 9 mm punches a hole through it, 7.62 and 12-gauge too, and the blade stays in one piece', () => {
    for (const [energy, caliber] of [[500, 9], [3000, 7.62], [2800, 18.5]] as const) {
      const { results, world, id } = shootDown(BLADE_X, energy, caliber)
      expect(results[0]).toMatchObject({ part: 'blade', penetrated: true })
      const blade = world.part(id, 'blade')!
      expect(blade.holes.some((h) => h.through)).toBe(true)
      expect(blade.status).not.toBe('broken')
      expect(typesOf(results)).toContain('hole')
    }
  })

  it('a round that meets the flat of the steel at a graze ricochets off instead of going in', () => {
    const { results, world, id } = shootDown(BLADE_X, 500, 9, -(Math.PI / 2 - 0.17))
    expect(typesOf(results)).toContain('ricochet')
    expect(results[0]!.penetrated).toBe(false)
    expect(world.part(id, 'blade')!.holes).toHaveLength(0)
  })
})

describe('blows on a 2 kg tool', () => {
  it('a punch (25 J) and a kick (130 J) break nothing: the handle stays whole, the rivets hold, the blade does not bend', () => {
    for (const energy of [25, 130]) {
      const { world, id } = fresh()
      blow(world, id, 'handle', [-0.1, 0.0705, 0], energy)
      blow(world, id, 'blade', [0.4, 0.012, 0], energy)
      const state = world.state(id)!
      expect(world.part(id, 'handle')!.status).not.toBe('broken')
      expect(state.joints[0]!.open).toBe(false)
      expect(state.groups).toHaveLength(1)
    }
    const { world, id } = fresh()
    blow(world, id, 'blade', [0.4, 0.012, 0], 25)
    expect(world.part(id, 'blade')!.bend).toBeUndefined()
  })

  it('a knife only scratches the steel of the blade and bites a little into the wood of the handle', () => {
    const { world, id } = fresh()
    const knife = (part: string, point: V) => world.hitPart(id, part, { type: 'slash', point, direction: [0, -1, 0], energy: 40, radius: 0.005, source: 'test' })
    knife('blade', [0.4, 0.012, 0])
    knife('handle', [-0.1, 0.0705, 0])
    const blade = world.part(id, 'blade')!
    const handle = world.part(id, 'handle')!
    expect(blade.holes).toHaveLength(0)
    expect(blade.maxHp - blade.hp).toBeLessThan(1)
    expect(handle.maxHp - handle.hp).toBeGreaterThan(blade.maxHp - blade.hp)
    expect(handle.status).not.toBe('broken')
  })
})

describe('fire on the shovel', () => {
  it('chars and burns the ash handle, and only heats the steel blade', () => {
    const { world, id } = fresh()
    world.hit(id, { type: 'fire', point: [-0.1, 0.053, 0], temperature: 900, radius: 0.5, duration: 20 })
    world.hit(id, { type: 'fire', point: [0.4, 0.006, 0], temperature: 900, radius: 0.5, duration: 20 })
    // a minute of it
    for (let step = 0; step < 600; step++) world.update(0.1)
    const handle = world.part(id, 'handle')!
    const blade = world.part(id, 'blade')!
    expect(handle.burning).toBe(true)
    expect(handle.char).toBeGreaterThan(0.05)
    expect(handle.mass).toBeLessThan(0.87)
    expect(blade.burning).toBe(false)
    expect(blade.char).toBe(0)
    expect(blade.mass).toBeCloseTo(1.1, 6)
    expect(blade.temperature).toBeGreaterThan(100)
  })
})

describe('an explosion beside the shovel', () => {
  it('a grenade a metre away opens the rivets and breaks the handle, which comes off as pieces', () => {
    const { world, id } = fresh()
    const result = world.hit(id, { type: 'explosive', point: [0.2, 0.3, 1], energy: 100000, radius: 5, source: 'test' })
    expect(world.state(id)!.joints[0]!.open).toBe(true)
    expect(world.part(id, 'handle')!.status).toBe('broken')
    expect(result.events.map((e) => e.type)).toEqual(expect.arrayContaining(['detach', 'fracture']))
    // the blade is dented by the blast, not destroyed: it is thrown on its own
    expect(world.part(id, 'blade')!.status).not.toBe('broken')
  })

  it('a firecracker across the room does not', () => {
    const { world, id } = fresh()
    world.hit(id, { type: 'explosive', point: [0.2, 0.3, 3.5], energy: 2000, radius: 4, source: 'test' })
    expect(world.state(id)!.joints[0]!.open).toBe(false)
  })
})

describe('a handle that runs out of hit points', () => {
  it('splits into two stubs of wood that are pieces of their own', () => {
    const { world, id } = fresh()
    const events: DestructionEvent[] = []
    for (let n = 0; n < 60 && world.part(id, 'handle')!.status !== 'broken'; n++) events.push(...world.shoot([HANDLE_X, 1, 0], [0, -1, 0], 300, 9, 'test').flatMap((r) => r.events))
    expect(world.part(id, 'handle')!.status).toBe('broken')
    const fracture = events.find((e): e is Extract<DestructionEvent, { type: 'fracture' }> => e.type === 'fracture')!
    const stubs = fracture.fragments.filter((f) => f.shape === 'slab')
    expect(stubs).toHaveLength(2)
    // both stubs are real lengths of the 0.9 m handle, together about all of it
    const lengths = stubs.map((stub) => Math.max(...stub.size))
    expect(Math.min(...lengths)).toBeGreaterThan(0.1)
    expect(lengths[0]! + lengths[1]!).toBeGreaterThan(0.7)
  })
})
