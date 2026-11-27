import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop, createPhysicsServices } from '@adatechnology/game-physics'
import type { BodyId, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createWalker } from '../src/index'
import type { Walker, WalkerOptions } from '../src/index'

const H = KIT_WORLD.fixedStep ?? 1 / 120
const COLLIDER = { heightMetres: 1.8, radiusMetres: 0.3 }

const scene = async (rest: Partial<WalkerOptions> = {}) => {
  const world: PhysicsWorld = (await createJoltEngine()).createWorld(KIT_WORLD)
  world.createBody({ shape: { kind: 'box', half: [50, 0.5, 50] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  const services = createPhysicsServices({ loop: createPhysicsLoop(world) })
  const walker = createWalker(services, { position: [0, 0, 0], collider: COLLIDER, ...rest })
  const run = (seconds: number): void => services.loop.stepFixed(Math.round(seconds / H))
  const feet = new Float64Array(3)
  return { world, services, walker, run, feet }
}

const heightOf = (walker: Walker, feet: Float64Array): number => {
  walker.read(feet)
  return feet[1] as number
}

describe('createWalker: the player body in the loop (spec 008 TS.9f)', () => {
  it('walks the intent every fixed step, and keeps it until it changes', { timeout: 60000 }, async () => {
    const { world, walker, run, feet } = await scene()
    walker.setIntent(0, -1.5)
    run(2)
    walker.read(feet)
    expect(feet[2]).toBeLessThan(-2.8)
    expect(walker.supported()).toBe(true)
    walker.setIntent(0, 0)
    run(1)
    const stopped = feet[2] as number
    walker.read(feet)
    expect(Math.abs((feet[2] as number) - stopped)).toBeLessThan(0.3)
    world.dispose()
  })

  it('draws the feet between the last two steps with the alpha it is given', { timeout: 60000 }, async () => {
    const { world, walker, run } = await scene()
    walker.setIntent(0, -1.5)
    run(1)
    const last = new Float64Array(3)
    const out = new Float64Array(3)
    walker.read(last)
    walker.drawn(1, out)
    expect(Array.from(out)).toEqual(Array.from(last))
    walker.drawn(0, out)
    const step = (last[2] as number) - (out[2] as number)
    expect(step).toBeLessThan(0)
    expect(Math.abs(step)).toBeGreaterThan(1.5 * H * 0.8)
    expect(Math.abs(step)).toBeLessThan(1.5 * H * 1.2)
    walker.drawn(0.5, out)
    expect(out[2]).toBeCloseTo((last[2] as number) - step / 2, 6)
    walker.drawn(7, out)
    expect(out[2]).toBe(last[2])
    world.dispose()
  })

  it('jumps v^2 / 2g (0.81 m) from the ground and not in the air', { timeout: 60000 }, async () => {
    const { world, walker, run, feet } = await scene()
    run(0.5)
    expect(walker.jump()).toBe(true)
    let peak = 0
    let jumpedAgain = false
    for (let i = 0; i < Math.round(2 / H); i++) {
      run(H)
      peak = Math.max(peak, heightOf(walker, feet))
      if (i === 30 && walker.jump()) jumpedAgain = true
    }
    expect(Math.abs(peak - 0.81)).toBeLessThan(0.02)
    expect(jumpedAgain).toBe(false)
    expect(walker.supported()).toBe(true)
    world.dispose()
  })

  it('crouches under a 1.3 m beam and cannot stand up there: the stance stays', { timeout: 60000 }, async () => {
    const { world, walker, run, feet } = await scene()
    world.createBody({ shape: { kind: 'box', half: [2, 0.1, 1] }, motion: 'static', position: [0, 1.4, -4], user: -1 })
    expect(walker.setStance('crouched')).toBe(true)
    walker.setIntent(0, -1.5)
    run(3)
    walker.read(feet)
    expect(feet[2]).toBeLessThan(-3.5)
    expect(walker.setStance('standing')).toBe(false)
    expect(walker.stance).toBe('crouched')
    expect(walker.setStance('prone')).toBe(true)
    world.dispose()
  })

  it('parks out of the world and comes back at the first candidate where it fits', { timeout: 60000 }, async () => {
    const { world, walker, run, feet } = await scene({ shadow: 'agent' })
    world.createBody({ shape: { kind: 'box', half: [1, 1.5, 0.2] }, motion: 'static', position: [3, 1.5, 0], user: -1 })
    walker.park()
    expect(walker.parked).toBe(true)
    expect(walker.jump()).toBe(false)
    const found: BodyId[] = []
    expect(world.overlapShape({ kind: 'sphere', radius: 0.5 }, [0, 0.9, 0], [0, 0, 0, 1], found, { layers: ['agent'] })).toBe(0)
    run(0.5)
    expect(walker.unpark([[3, 0, 0], [3, 0, 1.5]])).toBe(true)
    run(0.5)
    walker.read(feet)
    expect(Math.hypot((feet[0] as number) - 3, (feet[2] as number) - 1.5)).toBeLessThan(0.05)
    expect(world.overlapShape({ kind: 'sphere', radius: 0.5 }, [3, 0.9, 1.5], [0, 0, 0, 1], found, { layers: ['agent'] })).toBe(1)
    world.dispose()
  })

  it('stays parked when no candidate fits', { timeout: 60000 }, async () => {
    const { world, walker } = await scene()
    world.createBody({ shape: { kind: 'box', half: [1, 1.5, 0.2] }, motion: 'static', position: [3, 1.5, 0], user: -1 })
    walker.park()
    expect(walker.unpark([[3, 0, 0], [3.2, 0, 0.1]])).toBe(false)
    expect(walker.parked).toBe(true)
    world.dispose()
  })

  it('teleports the feet and the drawn feet at once, and does nothing while parked', { timeout: 60000 }, async () => {
    const { world, walker, run, feet } = await scene()
    walker.setIntent(0, -1.5)
    run(0.5)
    walker.teleport([4, 0, 6])
    walker.read(feet)
    expect(feet[0]).toBeCloseTo(4, 3)
    expect(feet[2]).toBeCloseTo(6, 3)
    const drawn = new Float64Array(3)
    walker.drawn(0, drawn)
    expect(drawn[2]).toBeCloseTo(6, 3)
    walker.park()
    walker.teleport([9, 0, 9])
    walker.read(feet)
    expect(feet[0]).toBeCloseTo(4, 3)
    world.dispose()
  })

  it('leaves the loop and the world on dispose', { timeout: 60000 }, async () => {
    const { world, walker, run } = await scene({ shadow: 'agent' })
    const before = world.bodyCount
    const { id } = walker
    walker.dispose()
    expect(world.bodyCount).toBe(before - 1)
    expect(world.characterSupported(id)).toBe(false)
    expect(() => run(0.2)).not.toThrow()
    world.dispose()
  })
})
