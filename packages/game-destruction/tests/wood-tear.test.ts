import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructionEvent } from '../src'

type Chip = Extract<DestructionEvent, { type: 'chip' }>

describe('a round through wood tears splinters out of the exit', () => {
  const shelf = () => {
    const world = createDestruction({ seed: 3 })
    world.add({ parts: [{ id: 'board', material: 'wood_soft', shape: { kind: 'box', size: [0.8, 0.018, 0.3] }, position: [0, 1, 0], mass: 2.5 }] }, { id: 's' })
    const chips: Chip[] = []
    world.on('chip', (e) => chips.push(e as Chip))
    return { world, chips }
  }

  it('every pistol round through a shelf board throws real splinters of fresh wood, most along the shot', () => {
    const { world, chips } = shelf()
    world.shoot([0, 2, 0], [0, -1, 0], 500, 9, 'test')
    expect(chips).toHaveLength(1)
    const c = chips[0]!
    expect(c.part).toBe('board')
    expect(c.center[1]).toBeLessThan(1)
    expect(c.fragments.length).toBeGreaterThanOrEqual(2)
    for (const f of c.fragments) {
      expect(f.shape).toBe('splinter')
      expect(f.inner).toBe(true)
      expect(Math.max(...f.size)).toBeLessThan(0.07)
    }
    const down = c.fragments.filter((f) => f.velocity![1] < 0).length
    expect(down).toBeGreaterThan(c.fragments.length - down)
    world.shoot([0.2, 2, 0], [0, -1, 0], 500, 9, 'test')
    expect(chips).toHaveLength(2)
    expect(world.part('s', 'board')!.status).not.toBe('broken')
  })

  it('a stronger round tears more', () => {
    const a = shelf()
    a.world.shoot([0, 2, 0], [0, -1, 0], 400, 9, 'test')
    const b = shelf()
    b.world.shoot([0, 2, 0], [0, -1, 0], 3000, 7.62, 'test')
    expect(b.chips[0]!.fragments.length).toBeGreaterThan(a.chips[0]!.fragments.length)
  })
})

describe('each material tears its own way, by the kind of blow', () => {
  const board = (material: string) => {
    const world = createDestruction({ seed: 3 })
    world.add({ parts: [{ id: 'board', material, shape: { kind: 'box', size: [0.8, 0.018, 0.3] }, position: [0, 1, 0], mass: 3 }] }, { id: 's' })
    const chips: Chip[] = []
    world.on('chip', (e) => chips.push(e as Chip))
    return { world, chips }
  }
  const punch = (world: ReturnType<typeof createDestruction>, energy: number) =>
    world.hitPart('s', 'board', { type: 'blunt', point: [0, 1.009, 0], energy, radius: 0.05, direction: [0, -1, 0], source: 'test' })

  it('a shot into MDF crumbles lumps, into pine tears splinters', () => {
    const mdf = board('mdf')
    mdf.world.shoot([0, 2, 0], [0, -1, 0], 500, 9, 'test')
    expect(mdf.chips[0]!.fragments.every((f) => f.shape === 'chunk')).toBe(true)
    const pine = board('wood_soft')
    pine.world.shoot([0, 2, 0], [0, -1, 0], 500, 9, 'test')
    expect(pine.chips[0]!.fragments.every((f) => f.shape === 'splinter')).toBe(true)
  })

  it('a punch crumbles MDF but not pine; a kick splinters pine; hardwood takes the kick', () => {
    const mdf = board('mdf')
    punch(mdf.world, 25)
    expect(mdf.chips).toHaveLength(1)
    expect(mdf.chips[0]!.center[1]).toBeCloseTo(1.009, 2)
    const pine = board('wood_soft')
    punch(pine.world, 25)
    expect(pine.chips).toHaveLength(0)
    punch(pine.world, 130)
    expect(pine.chips).toHaveLength(1)
    expect(pine.chips[0]!.fragments.every((f) => f.shape === 'splinter' && f.velocity![1] > -0.5)).toBe(true)
    const oak = board('wood_hard')
    punch(oak.world, 130)
    expect(oak.chips).toHaveLength(0)
  })

  it('steel tears nothing', () => {
    const steel = board('steel')
    steel.world.shoot([0, 2, 0], [0, -1, 0], 500, 9, 'test')
    punch(steel.world, 200)
    expect(steel.chips).toHaveLength(0)
  })
})
