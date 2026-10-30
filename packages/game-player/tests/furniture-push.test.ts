import { describe, expect, it } from 'vitest'

import { canPush, createFurniturePush, gripSecondsFor, pushSpeedFor } from '../src'

const FREE = { walk: [0, -1], isFree: () => true } as const

const engaged = (massKg: number, material?: string): ReturnType<typeof createFurniturePush> => {
  const push = createFurniturePush()
  push.begin(material ? { massKg, material } : { massKg })
  push.update(10, FREE)
  return push
}

describe('furniture push', () => {
  it('holds longer the heavier the piece, up to a limit', () => {
    expect(gripSecondsFor(12)).toBeCloseTo(0.58)
    expect(gripSecondsFor(90)).toBeCloseTo(1.75)
    expect(gripSecondsFor(5000)).toBe(2.5)
  })

  it('slows down with the load and stops past the force of the legs', () => {
    const light = pushSpeedFor({ massKg: 12, material: 'wood_hard' })
    const heavy = pushSpeedFor({ massKg: 90, material: 'wood_hard' })
    expect(light).toBeGreaterThan(heavy)
    expect(heavy).toBeGreaterThan(0.35)
    expect(pushSpeedFor({ massKg: 400, material: 'steel' })).toBe(0)
    expect(canPush({ massKg: 400, material: 'steel' })).toBe(false)
  })

  it('a material that grips the floor is harder to push', () => {
    expect(pushSpeedFor({ massKg: 60, material: 'rubber' })).toBeLessThan(pushSpeedFor({ massKg: 60, material: 'steel' }))
  })

  it('fills the timer, then walks; a short press is a tap', () => {
    const push = createFurniturePush()
    push.begin({ massKg: 12 })
    push.update(0.1, FREE)
    expect(push.phase).toBe('grip')
    expect(push.isTap).toBe(true)
    push.update(0.2, FREE)
    expect(push.isTap).toBe(false)
    expect(push.progress).toBeCloseTo(0.3 / gripSecondsFor(12))
    expect(push.update(0.4, FREE).engaged).toBe(true)
    expect(push.phase).toBe('push')
    const step = push.update(0.1, FREE)
    expect(step.dz).toBeCloseTo(-pushSpeedFor({ massKg: 12 }) * 0.1)
  })

  it('too heavy: the timer fills and it strains without a step', () => {
    const push = engaged(400, 'steel')
    expect(push.phase).toBe('strain')
    expect(push.block).toBe('too_heavy')
    expect(push.update(0.1, FREE).dz).toBe(0)
    expect(push.phase).toBe('strain')
  })

  it('locks at an obstacle, says so once, and frees when the way is clear', () => {
    const push = engaged(30)
    const blocked = { walk: [0, -1], isFree: () => false } as const
    expect(push.update(0.1, blocked)).toEqual({ dx: 0, dz: 0, engaged: false, hitObstacle: true })
    expect(push.update(0.1, blocked).hitObstacle).toBe(false)
    expect(push.phase).toBe('strain')
    expect(push.block).toBe('obstacle')
    push.update(0.3, { walk: [0, 1], isFree: () => true })
    push.update(0.05, { walk: [0, 1], isFree: () => true })
    expect(push.phase).toBe('push')
    expect(push.block).toBe(null)
  })

  it('takes the numbers of the game', () => {
    const push = createFurniturePush({ forceN: 5000 })
    push.begin({ massKg: 400, material: 'steel' })
    push.update(10, FREE)
    expect(push.phase).toBe('push')
  })

  it('letting go ends it', () => {
    const push = engaged(30)
    push.release()
    expect(push.phase).toBe('idle')
    expect(push.update(0.1, FREE).dz).toBe(0)
  })
})
