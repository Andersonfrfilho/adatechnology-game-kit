import { describe, expect, it } from 'vitest'

import { createFluids } from '../src'
import type { FluidWorld, Quat, SurfacePose, Vec3 } from '../src'

const TOP = 0.78
/** A table top 1.6 x 0.8 m with coffee spilled on it. */
function tableWithCoffee(): FluidWorld {
  const world = createFluids({ seed: 3 })
  world.addSurface({ id: 'table', point: [0, TOP, 0], normal: [0, 1, 0], halfSize: [0.8, 0.4], porosity: 0.3 })
  world.splash('coffee', [0.3, 1, 0], 0.2)
  world.update(0.5)
  return world
}

/** The pose that turns the top by `angle` about the x axis through `pivot` (a table going over on two legs). */
function tippedAbout(pivot: Vec3, angle: number): SurfacePose {
  const rotation: Quat = [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)]
  const [qx, , , qw] = rotation
  // R · pivot for a turn about x
  const y = pivot[1] * (qw * qw - qx * qx) - pivot[2] * 2 * qx * qw
  const z = pivot[1] * 2 * qx * qw + pivot[2] * (qw * qw - qx * qx)
  return { position: [0, pivot[1] - y, pivot[2] - z], rotation }
}

const run = (world: FluidWorld, seconds: number): void => {
  for (let t = 0; t < seconds; t += 0.05) world.update(0.05)
}
const onTable = (world: FluidWorld) => world.stains().filter((s) => s.surface === 'table')
const onGround = (world: FluidWorld) => world.stains().filter((s) => s.surface === 'ground')

describe('a stain goes with the surface it lies on', () => {
  it('a table that tips over: the pool runs off its low rim and spreads on the floor, the soaked part stays on the top', () => {
    const world = tableWithCoffee()
    const before = onTable(world)
    expect(before).toHaveLength(1)
    const pooled = before[0]!.liters
    // over on its side about the far edge of the top
    world.setSurfacePose('table', tippedAbout([0, TOP, -0.4], -Math.PI / 2))
    const carried = onTable(world)[0]!
    // the stain lies on the top where the top is now: off the old plane, its normal turned with it
    expect(carried.center[1]).not.toBeCloseTo(TOP, 1)
    expect(Math.abs(carried.normal![1])).toBeLessThan(0.1)
    run(world, 1)
    const floor = onGround(world)
    expect(floor.length).toBeGreaterThan(0)
    for (const s of floor) expect(s.center[1]).toBeCloseTo(0, 2)
    expect(floor.reduce((sum, s) => sum + s.liters + s.soaked, 0)).toBeGreaterThan(pooled * 0.5)
    for (const s of onTable(world)) expect(s.liters).toBe(0)
  })

  it('a top turned over drops what was on it straight down', () => {
    const world = tableWithCoffee()
    world.setSurfacePose('table', tippedAbout([0, TOP / 2, 0], Math.PI))
    run(world, 1)
    const floor = onGround(world)
    expect(floor.length).toBeGreaterThan(0)
    expect(Math.abs(floor[0]!.center[0] - 0.3)).toBeLessThan(0.3)
  })

  it('a top that only leans a little keeps its pool', () => {
    const world = tableWithCoffee()
    world.setSurfacePose('table', tippedAbout([0, TOP, -0.4], (-3 * Math.PI) / 180))
    run(world, 1)
    expect(onGround(world)).toHaveLength(0)
    expect(onTable(world)[0]!.liters).toBeGreaterThan(0)
  })

  it('a thick liquid clings past the tilt that sheds water', () => {
    const world = createFluids({ seed: 3 })
    world.addSurface({ id: 'table', point: [0, TOP, 0], normal: [0, 1, 0], halfSize: [0.8, 0.4], porosity: 0.3 })
    world.splash('honey', [0.3, 1, 0], 0.2)
    world.update(0.5)
    world.setSurfacePose('table', tippedAbout([0, TOP, -0.4], (-20 * Math.PI) / 180))
    run(world, 1)
    expect(onGround(world)).toHaveLength(0)
  })

  it('a push and a pose add up, and a snapshot keeps where the surface was moved to', () => {
    const world = tableWithCoffee()
    world.moveSurface('table', [0, 0, -1])
    const stain = onTable(world)[0]!
    expect(stain.center[2]).toBeCloseTo(-1, 1)
    const copy = createFluids({ seed: 3 })
    copy.load(world.serialize())
    copy.setSurfacePose('table', { position: [0, 0, -1], rotation: [0, 0, 0, 1] })
    expect(onTable(copy)[0]!.center).toEqual(stain.center)
    world.setSurfacePose('nothing', { position: [0, 0, 0], rotation: [0, 0, 0, 1] })
  })
})
