import { describe, expect, it } from 'vitest'

import { FURNITURE_PUSH_DEFAULTS, canPush, createFurniturePush, dragMarkFor, frictionFor, gripSecondsFor, pushAccelerationFor, pushSpeedFor, slipsOnTop } from '../src'

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
    // it speeds up first, then walks at the speed of the load
    expect(push.update(0.1, FREE).dz).toBeCloseTo(-pushAccelerationFor({ massKg: 12 }) * 0.1 * 0.1)
    for (let k = 0; k < 30; k++) push.update(0.1, FREE)
    expect(push.update(0.1, FREE).dz).toBeCloseTo(-pushSpeedFor({ massKg: 12 }) * 0.1)
  })

  it('speeds up no faster than a person, slower with a heavy piece, and brakes harder than it speeds up', () => {
    expect(pushAccelerationFor({ massKg: 12 })).toBe(1.5)
    const heavy = pushAccelerationFor({ massKg: 100, material: 'wood_hard' })
    expect(heavy).toBeCloseTo((500 - 0.4 * 100 * 9.81) / 100)
    expect(heavy).toBeLessThan(1.5)
    const push = engaged(12)
    for (let k = 0; k < 30; k++) push.update(0.1, FREE)
    const stop = push.update(0.1, { walk: [0, 0], isFree: () => true })
    expect(stop.acceleration).toBeCloseTo(3)
    expect(stop.velocity[1]).toBeCloseTo(-pushSpeedFor({ massKg: 12 }) + 0.3)
  })

  it('what rests on top rides while the push speeds up, and slides when the piece stops at once', () => {
    const cup = frictionFor('ceramic')
    expect(slipsOnTop(pushAccelerationFor({ massKg: 12 }), cup)).toBe(false)
    expect(slipsOnTop(3, frictionFor('glass'))).toBe(true)
    const push = engaged(12)
    for (let k = 0; k < 30; k++) push.update(0.1, FREE)
    const hit = push.update(0.1, { walk: [0, -1], isFree: () => false })
    expect(hit.hitObstacle).toBe(true)
    expect(hit.stoppedFrom?.[1]).toBeCloseTo(-pushSpeedFor({ massKg: 12 }))
    expect(slipsOnTop(hit.acceleration, cup)).toBe(true)
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
    expect(push.update(0.1, blocked)).toMatchObject({ dx: 0, dz: 0, engaged: false, hitObstacle: true })
    expect(push.update(0.1, blocked).hitObstacle).toBe(false)
    expect(push.phase).toBe('strain')
    expect(push.block).toBe('obstacle')
    push.update(0.3, { walk: [0, 1], isFree: () => true })
    push.update(0.05, { walk: [0, 1], isFree: () => true })
    expect(push.phase).toBe('push')
    expect(push.block).toBe(null)
  })

  it('a row of pieces pushed one against the next adds up its frictions and its masses', () => {
    const sofa = { massKg: 45, material: 'fabric' }
    const chair = { massKg: 8, material: 'wood_hard' }
    expect(canPush([sofa, chair])).toBe(true)
    expect(pushSpeedFor([sofa, chair])).toBeLessThan(pushSpeedFor(sofa))
    expect(pushAccelerationFor([sofa, chair])).toBeLessThanOrEqual(pushAccelerationFor(sofa))
    // the sofa alone goes; against the 400 kg grill the row is too heavy and locks
    expect(canPush([sofa, { massKg: 400, material: 'steel' }])).toBe(false)
  })

  it('a load that grows while pushing slows the push', () => {
    const push = engaged(20)
    for (let k = 0; k < 30; k++) push.update(0.1, FREE)
    const alone = -push.update(0.1, FREE).dz
    push.setLoad([{ massKg: 20 }, { massKg: 60 }])
    for (let k = 0; k < 30; k++) push.update(0.1, FREE)
    expect(-push.update(0.1, FREE).dz).toBeLessThan(alone)
  })

  it('dragging scratches wood and tile, scuffs concrete, and leaves carpet and grass clean', () => {
    expect(dragMarkFor('wood')).not.toBeNull()
    expect(dragMarkFor('tile')).not.toBeNull()
    expect(dragMarkFor('concrete')).not.toBeNull()
    expect(dragMarkFor('carpet')).toBeNull()
    expect(dragMarkFor('grass')).toBeNull()
    expect(dragMarkFor('wood', { ...FURNITURE_PUSH_DEFAULTS, dragMarks: {} })).toBeNull()
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
